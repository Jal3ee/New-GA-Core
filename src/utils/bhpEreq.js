export const EREQ_EXCHANGE_RATE = 16500;
export const EREQ_ORIGIN = 'https://e-requisition-test.vercel.app';
export function buildBhpEreqDraft(forecast, catalog, site) {
  if (!['IDMG','LBCT','SPCT'].includes(site)) throw new Error('Pilih satu site untuk e-Req.');
  if (!forecast || (forecast.site !== 'ALL' && forecast.site !== site)) throw new Error('Hitung forecast untuk site yang dipilih terlebih dahulu.');
  const items = new Map(catalog.map(item => [String(item.code || item.id), item]));
  const rows = forecast.rows.filter(row => row.site === site && Number(row.recommended_qty) > 0).map(row => {
    const item = items.get(String(row.code));
    if (!item) throw new Error(`Barang ${row.code} tidak ditemukan di katalog.`);
    const category = String(item.category || '').toUpperCase();
    const type = category.startsWith('PR') ? 'PR' : category.startsWith('IR') || /^K(?:\s|$|\()/.test(category) ? 'IR' : '';
    if (!type) throw new Error(`Kategori ${item.category || '-'} pada ${row.code} belum dapat dipetakan ke IR/PR.`);
    return { code:String(row.code), name:row.name, type, stock_class:item.stock_class || 'K', part_number:item.part_number || '', mnemonic:item.mnemonic || '', unit:row.unit, qty:Number(row.recommended_qty), price_idr:row.price_est == null ? null : Number(row.price_est) };
  });
  if (!rows.length) throw new Error('Tidak ada barang yang perlu diorder untuk site ini.');
  return { version:1, site, department:'HCGA', purpose:'PENGADAAN BARU', exchange_rate:EREQ_EXCHANGE_RATE, cutoff:forecast.as_of, forecast_to:forecast.forecast_to || forecast.rows.find(row=>row.site===site)?.coverage_to, rows };
}
export function validateBhpEreqDraft(draft) {
  if (!draft || draft.version !== 1 || !['IDMG','LBCT','SPCT'].includes(draft.site) || draft.exchange_rate !== EREQ_EXCHANGE_RATE || !Array.isArray(draft.rows) || !draft.rows.length || draft.rows.length > 150) throw new Error('Draft e-Req tidak valid.');
  const codes=new Set();
  for (const row of draft.rows) {
    if (!['IR','PR'].includes(row.type) || !row.code || codes.has(row.code) || !Number.isSafeInteger(row.qty) || row.qty <= 0 || row.qty > 1000000) throw new Error('Periksa jenis dan quantity setiap barang. e-Req memerlukan quantity bilangan bulat.');
    codes.add(row.code);
    if (row.type === 'IR' && !String(row.part_number || '').trim()) throw new Error(`Part number ${row.name} wajib diisi untuk IR.`);
    if (!Number.isFinite(row.price_idr) || row.price_idr <= 0 || row.price_idr > 1000000000000 || ereqUnitUsd(row.price_idr) <= 0) throw new Error(`Lengkapi harga satuan sebelum PPN untuk ${row.name}.`);
    for(const key of ['code','name','part_number','unit','stock_class','mnemonic']) if(typeof row[key] !== 'string' || row[key].length > 1000) throw new Error('Informasi barang tidak valid.');
  }
  return draft;
}
export function ereqUnitUsd(priceIdr) { return priceIdr == null ? null : Math.round(Number(priceIdr) / EREQ_EXCHANGE_RATE * 100) / 100; }
