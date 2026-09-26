import { pool } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  try {
    const jsonPath = path.resolve(__dirname, '../src/data/bhpItemsExcel.json');
    const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    console.log('Altering table if needed...');
    await pool.query(`ALTER TABLE bhp_items ADD COLUMN IF NOT EXISTS price_est NUMERIC(12, 2) DEFAULT 0, ADD COLUMN IF NOT EXISTS coa VARCHAR(100), ADD COLUMN IF NOT EXISTS remarks TEXT;`);
    await pool.query(`ALTER TABLE bhp_items ALTER COLUMN name TYPE VARCHAR(255);`);

    console.log('Truncating old dummy tables...');
    await pool.query(`TRUNCATE TABLE bhp_usage, bhp_stock_in, bhp_transfers, bhp_opnames, bhp_forecasts, bhp_evaluations, bhp_pdf_history, bhp_initial_stocks, bhp_site_params CASCADE;`);
    await pool.query(`DELETE FROM bhp_items;`);

    console.log(`Inserting ${items.length} real BHP items from Excel September 2026 into PostgreSQL 16...`);
    for (const it of items) {
      await pool.query(
        `INSERT INTO bhp_items (code, name, category, unit, pack_size, abc_class, is_active, price_est, coa, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           unit = EXCLUDED.unit,
           pack_size = EXCLUDED.pack_size,
           abc_class = EXCLUDED.abc_class,
           price_est = EXCLUDED.price_est,
           coa = EXCLUDED.coa,
           remarks = EXCLUDED.remarks;`,
        [it.code, it.name, it.category, it.unit, it.pack_qty || 1, it.default_abc || 'C', it.price_est || 0, it.coa || '', it.remarks || '']
      );
    }

    const count = await pool.query('SELECT count(*) FROM bhp_items;');
    console.log(`✅ Success! Total BHP items in PostgreSQL 16: ${count.rows[0].count}`);
  } catch (err) {
    console.error('❌ Error during sync:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
