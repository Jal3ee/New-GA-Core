import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import express from 'express';
import multer from 'multer';
import { pool } from '../server/db.js';

const client = await pool.connect();
await client.query('BEGIN');
const originalQuery = pool.query.bind(pool);
let server;
try {
  await client.query('CREATE TEMP TABLE invoices (LIKE public.invoices INCLUDING DEFAULTS INCLUDING INDEXES) ON COMMIT DROP');
  await client.query('CREATE TEMP SEQUENCE invoice_test_ids');
  await client.query("ALTER TABLE invoices ALTER COLUMN id SET DEFAULT nextval('pg_temp.invoice_test_ids')");
  await client.query(`CREATE TEMP TABLE audit_logs (id SERIAL,user_id INTEGER,user_nik TEXT,user_name TEXT,site TEXT,action TEXT,entity_type TEXT,entity_id TEXT,details JSONB,ip_address TEXT,created_at TIMESTAMPTZ DEFAULT NOW()) ON COMMIT DROP`);
  pool.query = (...args) => client.query(...args);
  process.env.VERCEL = '1';
  const { default: routes } = await import('../server/index.js');
  const app = express();
  let uploadFails = false, uploadCount = 0;
  // Fake storage only: no test files are written to Drive or production storage.
  app.post('/api/upload', multer().single('file'), (req, res) => {
    if (uploadFails) return res.status(400).json({ ok: false, error: 'Fixture upload failure' });
    assert(req.file?.buffer.length); uploadCount++;
    res.json({ ok: true, fileUrl: 'https://files.example.test/invoice.pdf', fileName: req.file.originalname, fileSize: req.file.size });
  });
  app.use(routes);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const source = (await fs.readFile('src/lib/gasClient.js', 'utf8')).replace("import.meta.env.VITE_PG_API_URL || '/api'", JSON.stringify(base + '/api'));
  const { api } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const form = { vendor: 'Gemoy', site: 'LBCT', nilai: '1250000.50', periode_start: '2026-10-01', periode_end: '2026-10-31', tgl_berkas: '2026-10-14', status_pembayaran: 'Open', tracking_admin_ga: '2026-10-14', fileData: new File(['%PDF-1.7 fixture'], 'invoice.pdf', { type: 'application/pdf' }), fileName: 'invoice.pdf' };
  const created = await api.createInvoice(form);
  assert(created.ok); assert.match(created.data.invoice_number, /^INV-[A-F0-9-]+$/);
  assert.equal(created.data.vendor, 'Gemoy'); assert.equal(created.data.nilai, 1250000.5);
  assert.equal(created.data.status_pembayaran, 'OPEN'); assert.equal(created.data.periode_start, '2026-10-01'); assert.equal(created.data.periode_end, '2026-10-31');
  assert.equal(created.data.tgl_berkas, '2026-10-14'); assert.equal(created.data.tracking_admin_ga, '2026-10-14');
  assert.equal(created.data.file_url, 'https://files.example.test/invoice.pdf'); assert.equal(Number(created.data.file_size_bytes), form.fileData.size); assert.equal(uploadCount, 1);
  const read = await api.getInvoices(); assert.equal(read.data[0].invoice_number, created.data.invoice_number);
  assert.equal(read.data[0].periode_start, '2026-10-01');
  const updated = await api.updateInvoice(created.data.id, { tracking_ga_gl: '2026-10-15', status_pembayaran: 'PAID' });
  assert.equal(updated.data.status_pembayaran, 'PAID'); assert.equal(updated.data.tracking_ga_gl, '2026-10-15'); assert.equal(updated.data.tracking_admin_ga, '2026-10-14');
  const cleared = await api.updateInvoice(created.data.id, { tracking_ga_gl: '' }); assert.equal(cleared.data.tracking_ga_gl, null);
  await api.updateInvoice(created.data.id, { fileData: form.fileData, fileName: 'replacement.pdf' }); assert.equal(uploadCount, 2);
  uploadFails = true;
  await assert.rejects(api.createInvoice(form), /Fixture upload failure/);
  assert.equal(Number((await client.query('SELECT count(*) FROM invoices')).rows[0].count), 1);
  const post = async input => {
    const r = await fetch(base + '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'CREATE_INVOICE', payload: { data: input } }) });
    return { status: r.status, data: await r.json() };
  };
  assert.equal((await post({ vendor: '', nilai: 100 })).status, 400);
  assert.equal((await post({ vendor: 'Gemoy', nilai: -1 })).status, 400);
  assert.equal((await post({ vendor: 'Gemoy', nilai: 100, fileData: {} })).status, 400);
  assert.equal((await post({ vendor: 'Gemoy', nilai: 100, periode_start: '2026-10-31', periode_end: '2026-10-01' })).status, 400);
  const canonical = await post({ invoice_number: 'VENDOR-TEST-001', vendor_name: 'Vendor Test', amount: 200, category: 'General', site: 'SPCT' }); assert.equal(canonical.status, 200);
  assert.equal((await post({ invoice_number: 'VENDOR-TEST-001', vendor_name: 'Different vendor', amount: 999 })).status, 409);
  assert.equal(Number((await client.query("SELECT amount FROM invoices WHERE invoice_number='VENDOR-TEST-001'")).rows[0].amount), 200);
  console.log('PASS: real form/client upload and invoice API, auto number, vendor/amount/date roundtrip, tracking/status persistence, attachment replacement, upload failure leaves no invoice, invalid inputs return 400 and duplicate numbers preserve existing records. Real PostgreSQL rollback; no production data or files changed.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  pool.query = originalQuery;
  await client.query('ROLLBACK'); client.release(); await pool.end();
}
