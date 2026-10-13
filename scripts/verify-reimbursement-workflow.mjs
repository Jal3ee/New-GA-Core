import assert from 'node:assert/strict';
import express from 'express';
import { pool } from '../server/db.js';
import { authenticateToken, createSessionToken, requireRole } from '../server/auth.js';
import { registerReimbursementWorkflow } from '../server/reimbursementWorkflow.js';
import { formatEmployeeName } from '../src/utils/reimbursementWorkflow.js';

// Every write is rolled back. The tests use the real database without changing operational statuses.
const client = await pool.connect();
await client.query('BEGIN');
const records = [
  { nik: '123456', nama: 'ANTOK SUBAKTI', departemen: 'Engineering', site: 'LBCT', periode_tahun: 2026, periode_bulan: 'Januari', periode_ke: 'Periode 2 (16-31)', no_hp: 'PRIVATE PHONE', amount: 999, catatan: 'PRIVATE NOTE', url_boarding_pass: 'PRIVATE DRIVE URL' },
  { nik: '123456', nama: 'ANTOK SUBAKTI', departemen: 'Engineering', site: 'LBCT', periode_tahun: 2025, periode_bulan: 'Desember', periode_ke: 'Periode 1 (1-15)' },
  { nik: '0000123456', nama: 'ANTOK SUBAKTI', departemen: 'Engineering', site: 'LBCT', periode_tahun: 2026, periode_bulan: 'Januari', periode_ke: 'Periode 1 (1-15)' },
  { nik: '0000123456', nama: 'ANTOK SUBAKTI', periode_tahun: 2026, periode_bulan: 'Januari', periode_ke: 'Periode 1 (1-15)' },
  { nik: '9999999999', nama: 'OTHER PERSON', periode_tahun: 2026, periode_bulan: 'Januari', periode_ke: 'Periode 1 (1-15)' },
  { nik: '262210023', nama: 'KARYAWAN NOL', periode_tahun: 2026, periode_bulan: 'Januari', periode_ke: 'Periode 1 (1-15)' }
];
const app = express(); app.use(express.json());
registerReimbursementWorkflow(app, { query: (sql, params) => client.query(sql, params), authenticateToken, requireRole, loadRecords: async () => records });
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const admin = createSessionToken({ id: 'qa', nik: 'qa', role: 'admin' });
const pic = createSessionToken({ id: 'qa', nik: 'qa', role: 'pic_lapangan' });
async function request(path, { token, method = 'GET', data } = {}) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, result: await response.json() };
}
const lookup = nik => request('/api/public/reimbursements/lookup', { method: 'POST', data: { nik } });
try {
  // Clear only the fixtures inside this rollback-only transaction.
  await client.query("DELETE FROM reimbursement_period_status WHERE period_key IN ('2025-12-P1','2026-01-P1','2026-01-P2')");
  assert.equal(formatEmployeeName('aNTOK SUBAKTI'), 'Antok Subakti');
  assert.equal((await lookup('123')).status, 400);
  assert.equal((await lookup('0000000000')).status, 400);
  assert.equal((await lookup('123457')).result.employee, null);
  assert.equal((await lookup('23456')).result.employee, null);
  const lostZero = await lookup('0262210023');
  assert.equal(lostZero.result.employee.nama, 'Karyawan Nol');
  assert.equal(lostZero.result.employee.nik, '0262210023');
  assert.equal((await lookup('0262210024')).result.employee, null);
  const initial = await lookup('0000123456');
  assert.equal(initial.status, 200);
  assert.equal(initial.result.employee.nama, 'Antok Subakti');
  assert.equal(initial.result.employee.nik, '0000123456');
  assert.deepEqual(initial.result.periods.map(period => period.key), ['2025-12-P1', '2026-01-P1', '2026-01-P2']);
  assert.deepEqual((await lookup('123456')).result.periods, initial.result.periods);
  assert(initial.result.periods.every(period => period.workflow_status === 'not_started'));
  assert(!/PRIVATE|OTHER PERSON|amount|url_|catatan|no_hp/.test(JSON.stringify(initial.result)));
  const path = '/api/reimbursements/period-status/2026-01-P1';
  assert.equal((await request(path, { method: 'PUT', data: { workflow_status: 'compiling' } })).status, 401);
  assert.equal((await request(path, { token: pic, method: 'PUT', data: { workflow_status: 'compiling' } })).status, 403);
  assert.equal((await request(path, { token: admin, method: 'PUT', data: { workflow_status: 'made_up' } })).status, 400);
  assert.equal((await request('/api/reimbursements/period-status/2099-01-P1', { token: admin, method: 'PUT', data: { workflow_status: 'compiling' } })).status, 400);
  assert.equal((await request(path, { token: admin, method: 'PUT', data: { workflow_status: 'compiling', tgl_pengajuan_finance: '2026-02-31' } })).status, 400);
  for (const status of ['compiling', 'site_approval', 'head_finance_approval', 'payment_pending', 'paid']) {
    const saved = await request(path, { token: admin, method: 'PUT', data: { workflow_status: status, catatan: 'PRIVATE INTERNAL NOTE', ...(status === 'paid' ? { tgl_pencairan_finance: '2026-10-14' } : {}) } });
    assert.equal(saved.status, 200);
    const publicResult = await lookup('0000123456');
    assert.equal(publicResult.result.periods[1].workflow_status, status);
    if (status === 'head_finance_approval') assert.equal(publicResult.result.periods[1].status_label, 'Approval Dept Head GA & Finance');
    assert(!JSON.stringify(publicResult.result).includes('PRIVATE'));
  }
  await request('/api/reimbursements/period-status/import', { token: admin, method: 'POST', data: { periods: { '2026-01-P1': { status_finance: 'Draft' }, '2026-01-P2': { status_finance: 'Diajukan' } } } });
  const final = await lookup('0000123456');
  assert.equal(final.result.periods[1].workflow_status, 'paid');
  assert.equal(final.result.periods[2].workflow_status, 'payment_pending');
  const privateResult = await request('/api/reimbursements/period-status', { token: admin });
  assert.equal(privateResult.result.data['2026-01-P1'].tgl_pencairan_finance, '2026-10-14');
  assert.equal(privateResult.result.data['2026-01-P1'].catatan, 'PRIVATE INTERNAL NOTE');
  console.log('PASS: complete NIK matching despite lost leading zeros, mixed-format history, no suffix matching, Dept Head terminology, all workflow stages, database persistence, private-field allowlist, role protection and safe migration.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await client.query('ROLLBACK'); client.release(); await pool.end();
}
