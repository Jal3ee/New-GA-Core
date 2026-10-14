import assert from 'node:assert/strict';
import { pool } from '../server/db.js';
import { hashPassword } from '../server/auth.js';

// Real PostgreSQL and real API routes, with transaction-local shadow tables.
// Production users and audit history are never modified.
const client = await pool.connect();
await client.query('BEGIN');
const originalQuery = pool.query.bind(pool);
let server;
try {
  await client.query('CREATE TEMP TABLE users (LIKE public.users INCLUDING DEFAULTS) ON COMMIT DROP');
  await client.query(`CREATE TEMP TABLE audit_logs (id SERIAL, user_id INTEGER, user_nik TEXT, user_name TEXT, site TEXT, action TEXT, entity_type TEXT, entity_id TEXT, details JSONB, ip_address TEXT, created_at TIMESTAMPTZ DEFAULT NOW()) ON COMMIT DROP`);
  const fixtures = [
    [-101, '0262210037', 'padded@example.test', true],
    [-102, '262210038', 'plain@example.test', true],
    [-103, '0262210039', 'inactive@example.test', false],
    [-104, 'ADM001', 'admin@example.test', true],
    [-105, 'GL001', 'gl@example.test', true],
    [-106, '0001234567890123456789012345', 'long@example.test', true]
  ];
  for (const [id, nik, email, active] of fixtures) {
    await client.query('INSERT INTO users (id,nik,nama,email,password_hash,role,site,department,is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, nik, 'Login Test', email, hashPassword('fixture-password', 'test-salt'), 'pic_lapangan', 'LBCT', 'General Affairs', active]);
  }
  pool.query = (...args) => client.query(...args);
  process.env.VERCEL = '1';
  const { default: app } = await import('../server/index.js');
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const login = async (path, nik, password = 'fixture-password') => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nik, password, ...(path === '/api/action' ? { action: 'LOGIN' } : {}) }) });
    return { status: response.status, body: await response.json() };
  };
  for (const path of ['/api/auth/login', '/api/action']) {
    for (const [inputs, expected] of [
      [['0262210037', '262210037', '000262210037', ' 262210037 '], '0262210037'],
      [['0262210038', '262210038'], '262210038'],
      [['admin', 'adm001', 'ADMIN@EXAMPLE.TEST'], 'ADM001'],
      [['gl001'], 'GL001'],
      [['1234567890123456789012345'], '0001234567890123456789012345']
    ]) {
      const identities = [];
      for (const input of inputs) {
        const result = await login(path, input);
        assert.equal(result.status, 200);
        assert.equal(result.body.data.nik, expected);
        assert(result.body.token);
        assert(!Object.hasOwn(result.body.data, 'password_hash'));
        identities.push(result.body.data.id);
      }
      assert.equal(new Set(identities).size, 1);
    }
    for (const input of ['262210039', '0262210039', '262210036', '62210037', '0000000000']) assert.equal((await login(path, input)).status, 401);
    assert.equal((await login(path, '262210037', 'wrong-password')).status, 401);
    assert.equal((await login(path, '')).status, 400);
  }
  console.log('PASS: both login routes accept NIK with/without leading zeros, preserve stored account/JWT identity, support email/admin/alphanumeric and long NIKs, reject wrong password, inactive accounts and partial NIKs. Production data untouched.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  pool.query = originalQuery;
  await client.query('ROLLBACK');
  client.release(); await pool.end();
}
