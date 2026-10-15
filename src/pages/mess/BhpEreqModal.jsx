import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { buildBhpEreqDraft, ereqUnitUsd, validateBhpEreqDraft } from '../../utils/bhpEreq';

function extensionRequest(type, draft, timeout=1500) {
  return new Promise((resolve,reject)=>{
    const requestId=crypto.randomUUID();
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',receive);};
    const receive=event=>{
      if(event.source!==window || event.origin!==location.origin || event.data?.source!=='GA_CORE_EREQ_EXTENSION' || event.data.requestId!==requestId)return;
      cleanup();event.data.ok?resolve(event.data):reject(new Error(event.data.error || 'Ekstensi belum dapat membuka e-Req.'));
    };
    const timer=setTimeout(()=>{cleanup();reject(new Error('Ekstensi belum terhubung. Pasang/aktifkan ekstensi, lalu refresh GA Core.'));},timeout);
    window.addEventListener('message',receive);
    window.postMessage({source:'GA_CORE_EREQ',type,requestId,draft},location.origin);
  });
}

export default function BhpEreqModal({ forecast, catalog, selectedSite, onClose }) {
  const available=['IDMG','LBCT','SPCT'].filter(site=>forecast?.rows.some(row=>row.site===site && row.recommended_qty>0));
  const [site,setSite]=useState(available.includes(selectedSite)?selectedSite:available[0] || 'IDMG');
  const [draft,setDraft]=useState(null),[error,setError]=useState(''),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[opened,setOpened]=useState(false);
  useEffect(()=>{
    try{setDraft(buildBhpEreqDraft(forecast,catalog,site));setError('');setOpened(false);}catch(failure){setError(failure.message);setDraft(null);}
  },[forecast,catalog,site]);
  useEffect(()=>{let active=true;extensionRequest('PING').then(()=>{if(active)setConnected(true);}).catch(()=>{});return()=>{active=false;};},[]);
  useEffect(()=>{const close=event=>{if(event.key==='Escape'&&!busy)onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose,busy]);
  const change=(index,key,value)=>setDraft(previous=>({...previous,rows:previous.rows.map((row,i)=>i===index?{...row,[key]:value}:row)}));
  const open=async()=>{
    setError('');setOpened(false);setBusy(true);
    try {validateBhpEreqDraft(draft);await extensionRequest('OPEN',draft,20000);setConnected(true);setOpened(true);}
    catch(failure){setError(failure.message);}finally{setBusy(false);}
  };
  const input='w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="ereq-title" className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-xl bg-[var(--card)] p-5 space-y-4">
    <div className="flex justify-between items-start gap-4"><div><h2 id="ereq-title" className="font-bold text-lg">Auto e-Req BHP</h2><p className="text-xs text-[var(--muted-foreground)] mt-1">Cutoff {forecast?.as_of} · Forecast sampai {forecast?.forecast_to || draft?.forecast_to} · Kurs Rp16.500/USD</p></div><button type="button" aria-label="Tutup Auto e-Req" disabled={busy} onClick={onClose}><X size={20}/></button></div>
    <div className="flex flex-wrap gap-4 text-xs items-center"><label>Site<select aria-label="Site e-Req" disabled={busy} className={input} value={site} onChange={event=>setSite(event.target.value)}>{available.map(value=><option key={value}>{value}</option>)}</select></label><span>Departemen: <strong>HCGA</strong></span><span>Keperluan: <strong>Pengadaan Baru</strong></span><span>K &amp; IR → IR · PR → PR</span></div>
    <p className="text-xs leading-relaxed">Hanya barang perlu order untuk site ini yang dikirim. Quantity, jenis permintaan, part number dan harga dapat Anda edit di bawah. Harga rupiah diperlakukan sebagai harga satuan sebelum PPN; form e-Req menghitung PPN 11%. Alasan permintaan, tanggal dan PIC dikosongkan untuk Anda isi di jendela e-Req.</p>
    {!connected && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-2"><strong>Pasang ekstensi satu kali di Chrome / Edge</strong><p>Unduh dan ekstrak ZIP. Buka <code>chrome://extensions</code> atau <code>edge://extensions</code>, aktifkan Developer mode, pilih Load unpacked, lalu pilih folder hasil ekstrak yang berisi manifest.json. Refresh GA Core setelah pemasangan.</p><a className="inline-block font-semibold underline" href="/downloads/ga-core-auto-ereq.zip" download>Unduh ekstensi Auto e-Req</a><p>Masukkan login e-Req melalui ikon ekstensi atau saat jendela login terbuka. Password hanya disimpan selama sesi browser.</p></div>}
    {draft && <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-[var(--muted)] text-left"><th className="p-2">Barang / Satuan</th><th className="p-2">Jenis</th><th className="p-2">Part Number</th><th className="p-2">Qty</th><th className="p-2">Harga Satuan Rp<br/>Sebelum PPN</th><th className="p-2">USD<br/>Sebelum PPN</th><th className="p-2"></th></tr></thead><tbody>{draft.rows.map((row,index)=><tr key={row.code} className="border-b border-[var(--border)]"><td className="p-2 min-w-52">{row.name}<div className="text-[var(--muted-foreground)] mt-1">{row.code} · {row.unit}</div></td><td className="p-2"><select className={input} aria-label={`Jenis ${row.code}`} disabled={busy} value={row.type} onChange={event=>change(index,'type',event.target.value)}><option>IR</option><option>PR</option></select></td><td className="p-2 min-w-40"><input className={input} aria-label={`Part number ${row.code}`} disabled={busy} value={row.part_number} onChange={event=>change(index,'part_number',event.target.value)}/></td><td className="p-2 min-w-24"><input className={input} aria-label={`Qty ${row.code}`} disabled={busy} type="number" min="1" step="1" value={row.qty} onChange={event=>change(index,'qty',Number(event.target.value))}/></td><td className="p-2 min-w-36"><input className={input} aria-label={`Harga rupiah ${row.code}`} disabled={busy} type="number" min="0" step="0.01" placeholder="Isi harga" value={row.price_idr ?? ''} onChange={event=>change(index,'price_idr',event.target.value===''?null:Number(event.target.value))}/>{row.price_idr==null && <span className="text-amber-700">Harga belum tersedia</span>}</td><td className="p-2 font-mono">{ereqUnitUsd(row.price_idr)?.toFixed(2) ?? '—'}</td><td className="p-2"><button type="button" aria-label={`Keluarkan ${row.name}`} disabled={busy} onClick={()=>setDraft(previous=>({...previous,rows:previous.rows.filter((_,i)=>i!==index)}))}><X size={14}/></button></td></tr>)}</tbody></table></div>}
    {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
    {opened && <p className="text-xs text-teal-700" role="status">Jendela e-Req sudah dibuka. Tunggu pengisian selesai, lalu lengkapi alasan, tanggal dan PIC di sana. Form tetap terbuka untuk ditinjau dan diedit.</p>}
    <div className="flex flex-wrap justify-between gap-3 items-center"><span className="text-xs text-[var(--muted-foreground)]">{draft?.rows.length || 0} barang · Pengisian ini tidak mengubah stok atau status order di GA Core.</span><button type="button" disabled={busy || !draft?.rows.length} onClick={open} className="flex items-center gap-2 rounded-lg bg-[#0F5C56] px-4 py-2 text-sm text-white disabled:opacity-50"><ExternalLink size={16}/>{busy?'Membuka...':'Buka & Isi e-Req'}</button></div>
  </div></div>;
}
