import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.resolve(__dirname, '../src/data/bhpItemsExcel.json');
const targetPath = path.resolve(__dirname, '../src/data/initialBhpData.js');

const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const lbctStocks = {};
const idmgStocks = {};
const spctStocks = {};
items.forEach(it => {
  lbctStocks[it.id] = 0;
  idmgStocks[it.id] = 0;
  spctStocks[it.id] = 0;
});

const content = `/**
 * Master Data & Initial State for BHP Mess (Barang Habis Pakai)
 * Sumber Data Resmi: List item BHP Update September 2026.xlsx (139 SKU)
 * Multi-Site: LBCT, IDMG, SPCT
 */

import bhpItemsRaw from './bhpItemsExcel.json';

export const INITIAL_BHP_ITEMS = bhpItemsRaw;

export const SITES_BHP = [
  { id: 'LBCT', name: 'Site LBCT', resident_capacity: 180, current_occupancy: 165 },
  { id: 'IDMG', name: 'Site IDMG', resident_capacity: 120, current_occupancy: 110 },
  { id: 'SPCT', name: 'Site SPCT', resident_capacity: 90, current_occupancy: 82 }
];

// Initial stock per site (pcs) - Siap pencatatan aktual
export const INITIAL_BHP_STOCKS = {
  'LBCT': ${JSON.stringify(lbctStocks, null, 2)},
  'IDMG': ${JSON.stringify(idmgStocks, null, 2)},
  'SPCT': ${JSON.stringify(spctStocks, null, 2)}
};

// Parameter operasional standar per site
export const INITIAL_BHP_SITE_PARAMS = {
  'LBCT': { safety_margin_pct: 5, order_lead_time_days: 10, forecast_horizon_days: 28 },
  'IDMG': { safety_margin_pct: 5, order_lead_time_days: 10, forecast_horizon_days: 28 },
  'SPCT': { safety_margin_pct: 5, order_lead_time_days: 10, forecast_horizon_days: 28 }
};

// Log transaksi operasional bersih (Zero dummy data, siap input operasional)
export const INITIAL_BHP_USAGES = [];
export const INITIAL_BHP_STOCK_INS = [];
export const INITIAL_BHP_TRANSFERS = [];
export const INITIAL_BHP_OPNAMES = [];
export const INITIAL_BHP_EVALUATIONS = [];
export const INITIAL_BHP_PDF_HISTORY = [];
`;

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully updated src/data/initialBhpData.js with 139 real items!');
