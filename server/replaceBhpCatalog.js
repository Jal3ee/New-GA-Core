import { pool } from './db.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

// Explicit full replacement, limited to BHP tables; backed up before any delete.
const tables = ['bhp_usage', 'bhp_stock_in', 'bhp_transfers', 'bhp_opnames', 'bhp_forecasts', 'bhp_evaluations', 'bhp_pdf_history', 'bhp_initial_stocks', 'bhp_site_params', 'bhp_items'];
const items = JSON.parse(await fs.readFile(new URL('../src/data/bhpItemsPdf.json', import.meta.url), 'utf8'));
const source = JSON.parse(await fs.readFile(new URL('../src/data/bhpCatalogSource.json', import.meta.url), 'utf8'));
assert.equal(items.length, source.count);
assert.equal(new Set(items.map(item => item.code)).size, items.length);
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`LOCK TABLE ${tables.join(', ')} IN EXCLUSIVE MODE`);
  const backup = {};
  for (const table of tables) backup[table] = (await client.query(`SELECT * FROM ${table}`)).rows;
  await fs.mkdir('tmp/backups', { recursive: true });
  const backupPath = `tmp/backups/bhp-before-pdf-${Date.now()}.json`;
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
  await client.query("ALTER TABLE bhp_items ADD COLUMN IF NOT EXISTS catalog_details JSONB NOT NULL DEFAULT '{}'::jsonb");
  for (const table of tables) await client.query(`DELETE FROM ${table}`);
  for (const item of items) {
    await client.query(`INSERT INTO bhp_items (code,name,category,unit,pack_size,abc_class,price_est,coa,remarks,is_active,catalog_details) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10)`,
      [item.code, item.name, item.category, item.unit, item.pack_qty, item.default_abc, item.price_est, item.coa, item.remarks, JSON.stringify(item)]);
  }
  const saved = (await client.query('SELECT code, price_est, catalog_details FROM bhp_items ORDER BY id')).rows;
  assert.equal(saved.length, items.length);
  saved.forEach((row, i) => { assert.equal(row.code, items[i].code); assert.equal(Number(row.price_est), items[i].price_est); assert.deepEqual(row.catalog_details, items[i]); });
  await client.query('COMMIT');
  console.log(JSON.stringify({ replaced: saved.length, backupPath, oldRows: Object.fromEntries(tables.map(table => [table, backup[table].length])) }));
} catch (error) {
  await client.query('ROLLBACK');
  console.error('BHP replacement rolled back:', error.message);
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }
