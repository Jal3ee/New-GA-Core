import fs from 'node:fs';
import { loadReimbursementRecords } from './reimbursementRecords.js';
import { formatEmployeeName, periodKey, workflowCode, workflowLabel, legacyFinanceStatus, REIMBURSEMENT_STEPS } from '../src/utils/reimbursementWorkflow.js';

const schema = fs.readFileSync(new URL('../database/reimbursement-period-status.sql', import.meta.url), 'utf8');
const codes = new Set(REIMBURSEMENT_STEPS.map(step => step.code));
const keyPattern = /^\d{4}-(0[1-9]|1[0-2])-P[12]$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const toDate = value => value ? (value instanceof Date
  ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  : String(value).slice(0, 10)) : '';
const metadata = row => ({ ...row, status_finance: legacyFinanceStatus(row.workflow_status), tgl_pengajuan_finance: toDate(row.tgl_pengajuan_finance), tgl_pencairan_finance: toDate(row.tgl_pencairan_finance) });

export function registerReimbursementWorkflow(app, { query, authenticateToken, requireRole, loadRecords = loadReimbursementRecords }) {
  let initialized;
  const ensureTable = () => {
    if (!initialized) initialized = query(schema).catch(error => { initialized = null; throw error; });
    return initialized;
  };
  const protect = [authenticateToken, requireRole('admin', 'ga_admin', 'ga_gl', 'ga_sh', 'finance')];
  const errors = res => error => {
    console.error('[Reimbursement workflow]', error.message);
    res.status(503).json({ ok: false, error: 'Data reimbursement belum dapat diakses. Silakan coba lagi.' });
  };
  const rate = new Map();

  app.post('/api/public/reimbursements/lookup', async (req, res) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    const nik = typeof req.body?.nik === 'string' ? req.body.nik.trim() : '';
    if (!/^\d{4,24}$/.test(nik)) return res.status(400).json({ ok: false, error: 'Masukkan NIK lengkap sesuai data karyawan.' });
    const ip = String(req.headers['x-forwarded-for'] || req.ip).split(',')[0].trim();
    const now = Date.now();
    for (const [key, entry] of rate) if (entry.until < now) rate.delete(key);
    const entry = rate.get(ip) || { count: 0, until: now + 60000 };
    rate.set(ip, entry);
    if (++entry.count > 30) return res.status(429).json({ ok: false, error: 'Terlalu banyak pencarian. Coba kembali dalam satu menit.' });
    try {
      const matches = (await loadRecords()).filter(record => record.nik?.trim() === nik);
      if (!matches.length) return res.json({ ok: true, employee: null, periods: [] });
      await ensureTable();
      const groups = Object.groupBy(matches, periodKey);
      const keys = Object.keys(groups).sort();
      const result = await query('SELECT period_key, workflow_status, updated_at FROM reimbursement_period_status WHERE period_key = ANY($1::text[])', [keys]);
      const statusMap = new Map(result.rows.map(row => [row.period_key, row]));
      const employee = matches[matches.length - 1];
      // Explicit allowlist: never return source rows, attachments, notes, contacts or amounts.
      return res.json({
        ok: true,
        employee: { nama: formatEmployeeName(employee.nama), nik, departemen: employee.departemen || '-', site: employee.site || '-' },
        periods: keys.map(key => {
          const record = groups[key][0];
          const code = statusMap.get(key)?.workflow_status || 'not_started';
          return { key, label: `${record.periode_bulan} ${record.periode_tahun} - Periode ${key.endsWith('P1') ? 1 : 2}`, workflow_status: code, status_label: workflowLabel(code), updated_at: statusMap.get(key)?.updated_at || null };
        })
      });
    } catch (error) { errors(res)(error); }
  });

  app.get('/api/reimbursements/period-status', authenticateToken, async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      await ensureTable();
      const result = await query('SELECT * FROM reimbursement_period_status ORDER BY period_key');
      return res.json({ ok: true, data: Object.fromEntries(result.rows.map(row => [row.period_key, metadata(row)])) });
    } catch (error) { errors(res)(error); }
  });

  const save = async (key, data, user, importOnly = false) => {
    const code = importOnly ? workflowCode(data) : data.workflow_status;
    if (!keyPattern.test(key) || !codes.has(code)) throw new Error('Periode atau status tidak valid.');
    for (const field of ['tgl_pengajuan_finance', 'tgl_pencairan_finance']) {
      if (data[field] && (!datePattern.test(data[field]) || Number.isNaN(Date.parse(data[field])) || new Date(data[field]).toISOString().slice(0, 10) !== data[field])) throw new Error('Tanggal tidak valid.');
    }
    if (typeof data.catatan !== 'undefined' && (typeof data.catatan !== 'string' || data.catatan.length > 2000)) throw new Error('Catatan maksimal 2000 karakter.');
    const result = await query(`INSERT INTO reimbursement_period_status (period_key, workflow_status, tgl_pengajuan_finance, tgl_pencairan_finance, catatan, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (period_key) ${importOnly ? 'DO NOTHING' : `DO UPDATE SET workflow_status=EXCLUDED.workflow_status, tgl_pengajuan_finance=EXCLUDED.tgl_pengajuan_finance, tgl_pencairan_finance=EXCLUDED.tgl_pencairan_finance, catatan=EXCLUDED.catatan, updated_by=EXCLUDED.updated_by, updated_at=NOW()`} RETURNING *`,
      [key, code, data.tgl_pengajuan_finance || null, code === 'paid' ? data.tgl_pencairan_finance || null : null, data.catatan || '', user.nik || user.id]);
    return result.rows[0] ? metadata(result.rows[0]) : null;
  };

  app.put('/api/reimbursements/period-status/:key', ...protect, async (req, res) => {
    try {
      const key = req.params.key;
      const data = req.body || {};
      if (!keyPattern.test(key) || !codes.has(data.workflow_status)) return res.status(400).json({ ok: false, error: 'Periode atau status tidak valid.' });
      if (!(await loadRecords()).some(record => periodKey(record) === key)) return res.status(400).json({ ok: false, error: 'Periode ini belum memiliki pengajuan reimbursement.' });
      await ensureTable();
      const saved = await save(key, data, req.user);
      return res.json({ ok: true, data: saved });
    } catch (error) {
      if (/Tanggal tidak valid|Catatan maksimal/.test(error.message)) return res.status(400).json({ ok: false, error: error.message });
      errors(res)(error);
    }
  });

  // Preserve existing browser-stored period overrides once; never overwrite a server status.
  app.post('/api/reimbursements/period-status/import', ...protect, async (req, res) => {
    try {
      const input = req.body?.periods;
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length > 200) return res.status(400).json({ ok: false, error: 'Data periode tidak valid.' });
      const valid = new Set((await loadRecords()).map(periodKey));
      await ensureTable();
      let imported = 0;
      for (const [key, data] of Object.entries(input)) {
        if (!valid.has(key) || !data || typeof data !== 'object') continue;
        if (await save(key, data, req.user, true)) imported++;
      }
      return res.json({ ok: true, imported });
    } catch (error) { errors(res)(error); }
  });
}
