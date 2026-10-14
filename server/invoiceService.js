import { randomUUID } from 'node:crypto';

export class InvoiceInputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const stages = ['tracking_admin_ga', 'tracking_ga_gl', 'tracking_ga_spv', 'tracking_ga_sect_head', 'tracking_ga_dept_head', 'tracking_site_manager', 'tracking_accounting', 'tracking_fa_gl'];
const day = value => value instanceof Date ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : value || null;
const date = value => {
  if (!value) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new InvoiceInputError('Tanggal invoice tidak valid.');
  return value;
};
const tracking = (input, validate = true) => {
  const result = Array.isArray(input) ? Object.fromEntries(input.filter(item => item?.key).map(item => [item.key, item.date || item.timestamp])) : { ...(input || {}) };
  return Object.fromEntries(stages.filter(key => Object.hasOwn(result, key)).map(key => [key, validate ? date(result[key]) : day(result[key])]));
};
export function invoiceDTO(row) {
  return { ...row, vendor: row.vendor_name, nilai: Number(row.amount), status_pembayaran: /^(paid|dicairkan)$/i.test(row.status) ? 'PAID' : 'OPEN', ...tracking(row.tracking_stages, false), periode_start: day(row.periode_start), periode_end: day(row.periode_end), tgl_berkas: day(row.tgl_berkas), invoice_date: day(row.invoice_date), due_date: day(row.due_date) };
}

export function createInvoiceService(query) {
  let ready;
  const ensure = () => ready ||= query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS periode_start DATE, ADD COLUMN IF NOT EXISTS periode_end DATE, ADD COLUMN IF NOT EXISTS tgl_berkas DATE`).catch(error => { ready = null; throw error; });
  return {
    async list() { await ensure(); return (await query('SELECT * FROM invoices ORDER BY created_at DESC')).rows.map(invoiceDTO); },
    async create(input) {
      const number = input.invoice_number ?? input.invoiceNumber;
      const invoiceNumber = number == null || number === '' ? `INV-${randomUUID().toUpperCase()}` : typeof number === 'string' ? number.trim() : '';
      if (!invoiceNumber || invoiceNumber.length > 100) throw new InvoiceInputError('Nomor invoice tidak valid.');
      const vendor = input.vendor_name ?? input.vendorName ?? input.vendor;
      if (typeof vendor !== 'string' || !vendor.trim() || vendor.trim().length > 150) throw new InvoiceInputError('Vendor invoice wajib diisi (maksimal 150 karakter).');
      const amount = input.amount ?? input.nilai;
      if (!/^\d{1,13}(\.\d{1,2})?$/.test(String(amount ?? '')) || !Number.isFinite(Number(amount))) throw new InvoiceInputError('Nilai invoice harus berupa angka positif atau nol, maksimal dua desimal.');
      const start = date(input.periode_start), end = date(input.periode_end), submitted = date(input.tgl_berkas);
      if (start && end && start > end) throw new InvoiceInputError('Tanggal akhir periode harus setelah atau sama dengan tanggal awal.');
      const fileUrl = input.file_url ?? input.fileUrl ?? null;
      if (input.fileData && !fileUrl) throw new InvoiceInputError('Lampiran belum diunggah. Refresh halaman lalu unggah kembali berkas invoice.');
      const dates = tracking({ ...tracking(input.tracking_stages), ...Object.fromEntries(stages.filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]])) });
      const values = [invoiceNumber, vendor.trim(), input.category || 'General', input.period || (start && end ? `${start} - ${end}` : null), input.site || 'ALL', amount, input.status || String(input.status_pembayaran || 'OPEN').toUpperCase(), date(input.due_date || input.dueDate), date(input.invoice_date || input.invoiceDate), fileUrl, input.file_size_bytes ?? input.fileSizeBytes ?? 0, input.file_name || input.fileName || null, input.notes || null, start, end, submitted, JSON.stringify(dates)];
      await ensure();
      const result = await query(`INSERT INTO invoices (invoice_number,vendor_name,category,period,site,amount,status,due_date,invoice_date,file_url,file_size_bytes,file_name,notes,periode_start,periode_end,tgl_berkas,tracking_stages)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT (invoice_number) DO NOTHING RETURNING *`, values);
      if (!result.rows.length) throw new InvoiceInputError('Nomor invoice sudah digunakan. Invoice yang sudah ada tidak ditimpa.', 409);
      return invoiceDTO(result.rows[0]);
    },
    async update(targetId, input) {
      const dates = { ...tracking(input.tracking_stages), ...Object.fromEntries(stages.filter(key => Object.hasOwn(input, key)).map(key => [key, date(input[key])])) };
      await ensure();
      const result = await query(`UPDATE invoices SET status=COALESCE($1,status), file_url=COALESCE($2,file_url), file_size_bytes=COALESCE($3,file_size_bytes), file_name=COALESCE($4,file_name), tracking_stages=CASE WHEN $5::jsonb='{}'::jsonb THEN tracking_stages ELSE (CASE WHEN jsonb_typeof(tracking_stages)='object' THEN tracking_stages ELSE '{}'::jsonb END) || $5::jsonb END, tgl_berkas=CASE WHEN $6::boolean THEN $7::date ELSE tgl_berkas END, updated_at=CURRENT_TIMESTAMP WHERE id=$8 OR invoice_number=$9 RETURNING *`,
        [input.status || (input.status_pembayaran ? String(input.status_pembayaran).toUpperCase() : null), input.file_url || input.fileUrl || null, input.file_size_bytes ?? input.fileSizeBytes ?? null, input.file_name || input.fileName || null, JSON.stringify(dates), Object.hasOwn(input, 'tgl_berkas'), date(input.tgl_berkas), Number.isSafeInteger(Number(targetId)) ? Number(targetId) : -1, String(targetId)]);
      if (!result.rows.length) throw new InvoiceInputError('Invoice tidak ditemukan.', 404);
      return invoiceDTO(result.rows[0]);
    }
  };
}
