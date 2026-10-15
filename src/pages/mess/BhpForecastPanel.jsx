import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, FileDown, Save, X, SlidersHorizontal, Search, AlertTriangle } from 'lucide-react';
import { DEFAULT_BHP_PLANNING, todayMakassar, endOfNextMonth, addDays } from '../../utils/bhpForecast';
import { formatRupiah } from '../../utils/bhpPdfExport';
import Pagination from '../../components/ui/Pagination';
import { useAuth } from '../../context/AuthContext';

const base = import.meta.env.VITE_PG_API_URL || '/api';
const labels = { NO_HISTORY: 'Belum Ada Histori', LIMITED: 'Histori Terbatas', READY: 'Histori Lengkap', MANUAL: 'Baseline Manual', RECONCILE: 'Perlu Rekonsiliasi' };
async function request(path, method = 'GET', body) {
  const token = sessionStorage.getItem('garda_jwt_token') || localStorage.getItem('garda_jwt_token');
  const response = await fetch(`${base}/bhp/forecast${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(30000), ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message || result.error || 'Forecast belum dapat dimuat.');
  return result.data;
}

export default function BhpForecastPanel({ site, onCalculated, onExport, onEreq }) {
  const { token } = useAuth();
  const [cutoff, setCutoff] = useState(todayMakassar);
  const [horizonMode,setHorizonMode] = useState('DATE');
  const [forecastTo,setForecastTo] = useState(() => {
    try {const saved=localStorage.getItem('bhp_forecast_to');if(saved&&/^\d{4}-\d{2}-\d{2}$/.test(saved)&&saved>todayMakassar()&&saved<=addDays(todayMakassar(),366))return saved;}catch{}
    return endOfNextMonth(todayMakassar());
  });
  const [result, setResult] = useState(null);
  const [config, setConfig] = useState(DEFAULT_BHP_PLANNING);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState(null);
  const [controls, setControls] = useState({});
  const generation = useRef(0);
  const context = useRef({ site, cutoff, forecastTo,horizonMode });
  context.current = { site, cutoff,forecastTo,horizonMode };
  const inputClass = 'w-full mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs';

  const load = useCallback(async () => {
    if (context.current.site !== site || context.current.cutoff !== cutoff || context.current.forecastTo!==forecastTo || context.current.horizonMode!==horizonMode) return;
    const id = ++generation.current;
    setBusy(true); setError(''); setResult(null); onCalculated(null);
    try {
      const data = await request(`?site=${encodeURIComponent(site)}&as_of=${cutoff}${horizonMode==='DATE'?`&forecast_to=${encodeURIComponent(forecastTo)}`:''}`);
      if (id !== generation.current) return;
      setResult(data); setConfig(data.settings[site === 'ALL' ? 'LBCT' : site]); setDirty(false); onCalculated(data);
    } catch (failure) { if (id === generation.current) { setError(failure.message); setResult(null); } }
    finally { if (id === generation.current) setBusy(false); }
  }, [site, cutoff, forecastTo,horizonMode,onCalculated]);
  useEffect(() => { load(); return () => { generation.current++; }; }, [load, token]);
  useEffect(() => { setPage(1);setSelected(null); }, [search, filter, site, cutoff,forecastTo,horizonMode]);
  const changeTarget = value => {setForecastTo(value);try{localStorage.setItem('bhp_forecast_to',value);}catch{}};
  const change = (key, value) => { setConfig(previous => ({ ...previous, [key]: value })); setDirty(true); };
  async function saveConfig() {
    setBusy(true);
    try {
      const { history_days, review_days, lead_days, service_level, history_complete_from } = config;
      await request(`/settings/${site}`, 'PUT', { history_days, review_days, lead_days, service_level, history_complete_from });
      await load(); toast.success('Parameter tersimpan dan forecast diperbarui.');
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function saveControls() {
    setBusy(true);
    try {
      await request(`/settings/${selected.site}`, 'PUT', { item_control: { code: selected.code, controls } });
      setSelected(null); await load(); toast.success('Parameter barang tersimpan.');
    } catch (failure) { toast.error(failure.message); } finally { setBusy(false); }
  }
  const all = result?.rows || [];
  const rows = all.filter(row => {
    const text = `${row.code} ${row.name} ${row.site}`.toLowerCase();
    return text.includes(search.trim().toLowerCase()) && (filter === 'ALL' || filter === 'ORDER' && row.recommended_qty > 0 || filter === 'REVIEW' && ['NO_HISTORY','LIMITED','RECONCILE'].includes(row.quality));
  });
  const amount = all.reduce((sum, row) => sum + (row.total_cost || 0), 0);

  return <div className="space-y-4">
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
      <div className="flex flex-wrap justify-between items-start gap-3"><div><h3 className="font-semibold">Forecast Berdasarkan Pemakaian</h3><p className="text-xs text-[var(--muted-foreground)] mt-1">Setiap barang mengikuti histori per site. Menggunakan saldo aktual dan pemakaian yang tercatat.</p></div><button type="button" onClick={load} disabled={busy} className="flex items-center gap-2 text-xs border border-[var(--border)] rounded-lg px-3 py-2"><RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Refresh Data</button></div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
        <label>Cutoff (pencatatan selesai)<input className={inputClass} disabled={busy} type="date" max={todayMakassar()} value={cutoff} onChange={event => {const day=event.target.value||todayMakassar();setCutoff(day);if(forecastTo<=day||forecastTo>addDays(day,366))changeTarget(endOfNextMonth(day));}} /></label>
        <label>Periode Forecast<select className={inputClass} disabled={busy} value={horizonMode} onChange={event=>setHorizonMode(event.target.value)}><option value="DATE">Sampai Tanggal</option><option value="INTERVAL">Interval Order + Lead Time</option></select></label>
        {horizonMode==='DATE'?<label>Forecast Sampai (termasuk tanggal ini)<input className={inputClass} disabled={busy} type="date" min={addDays(cutoff,1)} max={addDays(cutoff,366)} value={forecastTo} onChange={event=>changeTarget(event.target.value||endOfNextMonth(cutoff))} /><button type="button" disabled={busy} onClick={()=>changeTarget(endOfNextMonth(cutoff))} className="mt-1 text-teal-700 underline">Akhir Bulan Depan</button></label>:<label>Interval Order (hari)<input className={inputClass} disabled={busy} type="number" min={1} max={90} value={config.review_days} onChange={event => change('review_days', Number(event.target.value))} /></label>}
        <label>Histori (hari)<input className={inputClass} disabled={busy} type="number" min={7} max={366} value={config.history_days} onChange={event => change('history_days', Number(event.target.value))} /></label>
        <label>Lead Time Total (hari)<input className={inputClass} disabled={busy} type="number" min={0} max={90} value={config.lead_days} onChange={event => change('lead_days', Number(event.target.value))} /></label>
        <label>Target Service Level<select className={inputClass} value={config.service_level} onChange={event => change('service_level', Number(event.target.value))}>{[0.9,0.95,0.975,0.99].map(value => <option key={value} value={value}>{value * 100}%</option>)}</select></label>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-end"><label className="text-xs sm:w-64 w-full">Pencatatan Lengkap Sejak<input className={inputClass} disabled={busy} type="date" max={cutoff} value={config.history_complete_from || ''} onChange={event => change('history_complete_from', event.target.value)} /></label><p className="text-[11px] text-[var(--muted-foreground)] flex-1">Isi hanya jika seluruh pemakaian tercatat sejak tanggal tersebut. Hari tanpa pemakaian dihitung nol. Kosongkan jika belum yakin; hasil ditandai Histori Terbatas.</p><button type="button" disabled={busy || !result} onClick={saveConfig} className="px-4 py-2 rounded-lg bg-[#0F5C56] text-white text-xs whitespace-nowrap">Simpan & Hitung{site === 'ALL' ? ' Semua Site' : ''}</button></div>
      {dirty && <p className="text-xs text-amber-700">Parameter berubah. Simpan & Hitung sebelum menggunakan hasil.</p>}
      <p className="text-[11px] text-[var(--muted-foreground)]">{horizonMode==='DATE'?'Kebutuhan dihitung mulai sehari setelah cutoff sampai tanggal akhir yang dipilih, maksimal 366 hari. Lead time tidak menambah rentang ini; tetap digunakan untuk menilai risiko kehabisan sebelum barang tiba.':'Coverage = interval order + lead time.'} Target stok = kebutuhan selama coverage + safety stock. Order = target − (stok + incoming − alokasi), dibulatkan sesuai MOQ/kelipatan.</p>
      {result?.latest_usage_date&&result.latest_usage_date<cutoff&&<p className="text-xs text-amber-700">Pemakaian terakhir tercatat {result.latest_usage_date}. Pastikan pencatatan sampai cutoff sudah lengkap. <button type="button" disabled={busy} className="underline" onClick={()=>setCutoff(result.latest_usage_date)}>Pakai tanggal pemakaian terakhir sebagai cutoff</button></p>}
    </div>
    {error && <div role="alert" className="p-3 border border-red-300 rounded-lg bg-red-50 text-red-700 text-xs">{error}</div>}
    {!error && result && <>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm"><strong>Periode forecast: {result.forecast_from} s.d. {result.forecast_to||'sesuai coverage per site'}</strong><p className="text-xs text-[var(--muted-foreground)] mt-1">{result.horizon_mode==='DATE'?`${result.rows[0]?.horizon_days||0} hari kalender, termasuk tanggal akhir.`:'Mode interval menggunakan interval order + lead time masing-masing site.'} Saldo memakai posisi pada cutoff {result.as_of}.</p></div>
      {all.some(row=>row.lead_time_beyond_horizon)&&<p role="status" className="p-3 text-xs rounded-lg bg-amber-500/10 text-amber-700">Lead time melewati akhir forecast pada sebagian site. Kebutuhan mendesak perlu pengiriman lebih cepat atau transfer stok.</p>}
      {all.some(row=>row.horizon_exceeds_history)&&<p className="p-3 text-xs rounded-lg bg-amber-500/10 text-amber-700">Rentang forecast lebih panjang dari histori yang tersedia pada sebagian barang. Tinjau baseline dan perbarui forecast ketika histori bertambah.</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[
        ['SKU / Site Perlu Order', all.filter(row => row.recommended_qty > 0).length],
        ['Perlu Review Histori / Saldo', all.filter(row => ['NO_HISTORY','LIMITED','RECONCILE'].includes(row.quality)).length],
        ['Risiko Habis Sebelum Barang Tiba', all.filter(row => row.urgent).length],
        ['Biaya Order (yang terhitung)', all.some(row => row.total_cost !== null) ? formatRupiah(amount) : 'Belum ada estimasi']
      ].map(([label,value]) => <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4" key={label}><div className="text-[11px] text-[var(--muted-foreground)]">{label}</div><div className="font-mono font-bold text-xl mt-2">{value}</div></div>)}</div>
      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs leading-relaxed">Histori Terbatas perlu review; rekomendasi belum dihitung jika histori kurang dari 7 hari. Belum Ada Histori tidak dianggap order nol: lengkapi periode pencatatan atau baseline manual beserta alasan. Saldo negatif perlu opname. Pemakaian tercatat dapat lebih rendah dari kebutuhan saat stockout. Target service level bukan jaminan ketersediaan.</div>
      <div className="flex flex-wrap gap-2 items-center justify-between"><div className="flex gap-2 items-center"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs" placeholder="Cari kode / barang / site" /><select value={filter} onChange={event => setFilter(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"><option value="ALL">Semua Barang</option><option value="ORDER">Perlu Order</option><option value="REVIEW">Perlu Review</option></select></div><div className="flex gap-2"><button type="button" disabled={busy || dirty} onClick={async () => { setBusy(true); try { const saved = await request('/snapshots','POST',{ site,as_of:cutoff,...(horizonMode==='DATE'?{forecast_to:forecastTo}:{}) }); toast.success(`Snapshot #${saved.id} tersimpan.`); } catch(failure) { toast.error(failure.message); } finally {setBusy(false);} }} className="flex items-center gap-2 border border-[var(--border)] rounded-lg px-3 py-2 text-xs"><Save size={14} /> Simpan Snapshot</button><button type="button" disabled={busy || dirty} onClick={onExport} className="flex items-center gap-2 bg-[#0F5C56] text-white rounded-lg px-3 py-2 text-xs"><FileDown size={14} /> Rekap PDF</button><button type="button" disabled={busy || dirty} onClick={onEreq} className="flex items-center gap-2 border border-teal-600 text-teal-700 rounded-lg px-3 py-2 text-xs">Auto e-Req</button></div></div>
      <div className={`rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden ${busy || dirty ? 'opacity-50' : ''}`}><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-[var(--muted)] text-[var(--muted-foreground)]"><tr>{['Site / Kode','Barang','Kualitas Data','Histori / Hari','Pemakaian / Hari','Stok','Incoming','Coverage / SS','Order','Biaya','Detail'].map(label => <th key={label} className="px-3 py-3 text-left whitespace-nowrap">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{rows.slice((page-1)*pageSize,page*pageSize).map(row => <tr key={row.key} className="hover:bg-[var(--muted)]/40"><td className="p-3 whitespace-nowrap"><strong>{row.site}</strong><div className="font-mono mt-1">{row.code.startsWith('PDF-') ? 'Kode belum tersedia' : row.code}</div></td><td className="p-3 min-w-64 max-w-xs">{row.name}</td><td className="p-3 min-w-36"><span className={`font-medium ${row.quality === 'READY' ? 'text-teal-700' : 'text-amber-700'}`}>{labels[row.quality]}</span>{row.urgent && <div className="text-red-600 mt-1 flex gap-1"><AlertTriangle size={12} /> Risiko habis</div>}{row.overdue_incoming && <div className="text-amber-700 mt-1">Incoming jatuh tempo</div>}</td><td className="p-3 font-mono whitespace-nowrap">{row.total_used_hist} {row.unit}<div className="text-[var(--muted-foreground)]">{row.observed_days} hari</div></td><td className="p-3 font-mono">{row.daily_rate ?? '—'}</td><td className="p-3 font-mono whitespace-nowrap">{row.current_stock} {row.unit}</td><td className="p-3 font-mono whitespace-nowrap">{row.on_order} {row.unit}</td><td className="p-3 whitespace-nowrap">{row.horizon_days} hari<div className="font-mono text-[var(--muted-foreground)]">SS: {row.safety_stock ?? '—'} {row.unit}</div></td><td className="p-3 font-bold whitespace-nowrap">{row.recommended_qty === null ? 'Perlu data' : `${row.recommended_qty} ${row.unit}`}</td><td className="p-3 font-mono whitespace-nowrap">{row.total_cost === null ? '—' : formatRupiah(row.total_cost)}</td><td className="p-3"><button type="button" disabled={busy || dirty} onClick={() => {setSelected(row);setControls({ allocated:0,moq:1,order_multiple:1,baseline_daily:null,buffer_days:0,reason:'',incoming:[],...row.controls });}} className="p-2 rounded hover:bg-[var(--muted)]" aria-label={`Detail ${row.name} di ${row.site}`}><SlidersHorizontal size={16} /></button></td></tr>)}{!rows.length && <tr><td colSpan={11} className="p-8 text-center">Tidak ada barang sesuai pencarian.</td></tr>}</tbody></table></div><div className="p-3"><Pagination currentPage={page} totalItems={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[25,50,100]} /></div></div>
    </>}
    {busy && !result && <p className="p-6 text-center text-sm">Memuat stok dan histori dari server...</p>}
    {selected && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Detail forecast barang" className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{selected.site} · {selected.code}</h3><p className="text-xs mt-1">{selected.name}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Tutup"><X size={20} /></button></div><div className="text-xs p-3 rounded-lg bg-[var(--muted)] space-y-1"><p>Histori: {selected.history_from || 'Belum tersedia'} s/d {cutoff}, {selected.observed_days} hari; {selected.nonzero_days} hari ada pemakaian.</p><p>Rate: {selected.daily_rate ?? '—'} {selected.unit}/hari × {selected.horizon_days} hari = {selected.base_forecast ?? '—'} {selected.unit}.</p><p>Safety stock: {selected.safety_stock ?? '—'} {selected.unit} ({selected.safety_method === 'EMPIRICAL' ? 'variasi kebutuhan selama coverage dari histori' : selected.safety_method === 'MANUAL_BUFFER' ? 'buffer baseline manual' : 'variasi pemakaian harian; estimasi awal'}).</p><p>Inventory position: {selected.current_stock} + {selected.on_order} − {selected.allocated} = {selected.inventory_position} {selected.unit}.</p><p>Coverage sampai {selected.coverage_to}. {labels[selected.quality]}.</p><p>Days of cover: {selected.stock_cover_days ?? "—"} hari. {selected.urgent ? "Ada risiko stockout sebelum replenishment tiba." : "Periksa jadwal kedatangan dan stockout aktual."}</p></div>
      <div className="grid grid-cols-2 gap-3 text-xs">{[['allocated','Alokasi Tambahan di Luar Forecast'],['moq','Minimum Order'],['order_multiple','Kelipatan Order'],['buffer_days','Buffer Manual (hari)']].map(([key,label]) => <label key={key}>{label}<input className={inputClass} disabled={busy} type="number" min={key==='moq'||key==='order_multiple'?1:0} step={1} value={controls[key]} onChange={event => setControls(previous=>({...previous,[key]:Number(event.target.value)}))} /></label>)}<label className="col-span-2">Baseline Manual ({selected.unit}/hari), opsional<input className={inputClass} disabled={busy} type="number" min={0} step="any" value={controls.baseline_daily ?? ''} placeholder="Kosong = gunakan histori" onChange={event=>setControls(previous=>({...previous,baseline_daily:event.target.value===''?null:Number(event.target.value)}))} /></label><label className="col-span-2">Alasan Baseline Manual<textarea className={inputClass} value={controls.reason} onChange={event=>setControls(previous=>({...previous,reason:event.target.value}))} /></label></div>
      <div className="space-y-2 text-xs"><div className="flex justify-between items-center"><h4 className="font-semibold">Incoming / PO Belum Diterima</h4><button type="button" onClick={()=>setControls(previous=>({...previous,incoming:[...previous.incoming,{qty:1,eta:'',reference:''}]}))} className="text-teal-700">+ Tambah</button></div><p className="text-[11px] text-[var(--muted-foreground)]">Isi jumlah total PO. Jika Ref. PO sama dengan penerimaan, jumlah yang diterima otomatis mengurangi incoming. Tanpa Ref. PO, hapus incoming setelah diterima. ETA terlewat tidak mengurangi order.</p>{controls.incoming.map((row,index)=><div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2" key={index}>{[['qty','number'],['eta','date'],['reference','text']].map(([key,type])=><input key={key} aria-label={key === 'qty' ? 'Jumlah total PO' : key} className={inputClass} disabled={busy} type={type} min={type==='number'?1:undefined} value={row[key]} placeholder={key==='reference'?'Ref. PO':''} onChange={event=>setControls(previous=>({...previous,incoming:previous.incoming.map((entry,i)=>i===index?{...entry,[key]:type==='number'?Number(event.target.value):event.target.value}:entry)}))} />)}<button type="button" onClick={()=>setControls(previous=>({...previous,incoming:previous.incoming.filter((_,i)=>i!==index)}))} aria-label="Hapus incoming"><X size={14}/></button></div>)}</div>
      <div className="flex justify-end gap-2"><button type="button" className="px-4 py-2 text-xs border border-[var(--border)] rounded-lg" onClick={()=>setSelected(null)}>Tutup</button><button type="button" disabled={busy} className="px-4 py-2 text-xs text-white bg-[#0F5C56] rounded-lg" onClick={saveControls}>{busy?'Menyimpan...':'Simpan & Hitung Ulang'}</button></div>
    </div></div>}
  </div>;
}
