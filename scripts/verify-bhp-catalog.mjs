import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pool } from '../server/db.js';
import { INITIAL_BHP_ITEMS, INITIAL_BHP_STOCKS } from '../src/data/initialBhpData.js';

assert.equal(INITIAL_BHP_ITEMS.length, 138);
assert.equal(new Set(INITIAL_BHP_ITEMS.map(item => item.code)).size, 138);
assert.deepEqual(INITIAL_BHP_ITEMS.filter(item => !item.stock_code).map(item => item.source_no), ['23', '25']);
assert.equal(INITIAL_BHP_ITEMS.filter(item => item.source_no === '36').length, 2);
assert.equal(INITIAL_BHP_ITEMS.find(item => item.code === '43847').price_est, 9800.92);
assert.equal(INITIAL_BHP_ITEMS[0].part_number, 'IPN-BHP-00003');
assert.equal(INITIAL_BHP_ITEMS.at(-1).part_number, 'IPN-BHP-00138');
assert(Object.values(INITIAL_BHP_STOCKS).every(stocks => Object.values(stocks).every(qty => qty === 0)));
for (const item of INITIAL_BHP_ITEMS) {
  const image = await fs.readFile('public' + item.image_url);
  assert.equal(image[0], 137);
  assert.equal(item.unit.toUpperCase(), item.pack_unit);
  // Quantities are measured in Unit Of Issue, not inner-pack pieces.
  assert.equal(item.pack_qty, 1);
}
try {
  const rows = (await pool.query('SELECT code, name, unit, price_est, coa, catalog_details FROM bhp_items WHERE is_active = TRUE ORDER BY id')).rows;
  assert.equal(rows.length, 138);
  rows.forEach((row, i) => {
    const item = INITIAL_BHP_ITEMS[i];
    assert.deepEqual(row.catalog_details, item);
    assert.equal(row.code, item.code);
    assert.equal(row.name, item.name);
    assert.equal(row.unit, item.unit);
    assert.equal(Number(row.price_est), item.price_est);
    assert.equal(row.coa, item.coa);
  });
  console.log('PASS: 138 PDF items, 2 uncoded items retained, repeated source numbering preserved, exact decimal prices, unit-of-issue stock, 138 images and full database parity.');
} finally { await pool.end(); }
