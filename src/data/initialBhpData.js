/** BHP catalog: SC BHP NEW.pdf. No stock balances supplied by the PDF. */
import items from './bhpItemsPdf.json' with { type: 'json' };
import source from './bhpCatalogSource.json' with { type: 'json' };
export const BHP_CATALOG_VERSION = source.version;
export const BHP_CATALOG_SOURCE = source;
export const INITIAL_BHP_ITEMS = items;
export const SITES_BHP = [
  { id: 'LBCT', name: 'Site LBCT', resident_capacity: 180, current_occupancy: 165 },
  { id: 'IDMG', name: 'Site IDMG', resident_capacity: 120, current_occupancy: 110 },
  { id: 'SPCT', name: 'Site SPCT', resident_capacity: 90, current_occupancy: 82 }
];
export const INITIAL_BHP_STOCKS = Object.fromEntries(SITES_BHP.map(site => [site.id, Object.fromEntries(items.map(item => [item.id, 0]))]));
export const INITIAL_BHP_SITE_PARAMS = Object.fromEntries(SITES_BHP.map(site => [site.id, { safety_margin_pct: 5, order_lead_time_days: 10, forecast_horizon_days: 28 }]));
export const INITIAL_BHP_USAGES = [];
export const INITIAL_BHP_STOCK_INS = [];
export const INITIAL_BHP_TRANSFERS = [];
export const INITIAL_BHP_OPNAMES = [];
export const INITIAL_BHP_EVALUATIONS = [];
export const INITIAL_BHP_PDF_HISTORY = [];
