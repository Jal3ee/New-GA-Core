export const BHP_FORECAST_VERSION = 'history-v2';
export const BHP_SITES = ['LBCT', 'IDMG', 'SPCT'];
export const todayMakassar = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const addDays = (day, days) => new Date(Date.parse(day + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export const endOfNextMonth = day => {
  const [year,month]=day.split('-').map(Number);
  return new Date(Date.UTC(year,month+1,0)).toISOString().slice(0,10);
};
export const dayCount = (start, end) => Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
export const DEFAULT_BHP_PLANNING = { history_days: 90, review_days: 30, lead_days: 7, service_level: 0.95, history_complete_from: '', item_controls: {} };
const mean = values => values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
const sd = values => values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean(values)) ** 2, 0) / (values.length - 1)) : 0;
const quantile = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] || 0; };
const round = value => Math.round(value * 10000) / 10000;
const zFor = level => ({ '0.9': 1.282, '0.95': 1.645, '0.975': 1.96, '0.99': 2.326 })[String(level)];

export function calculateBhpStocks(data, asOf) {
  const stocks = Object.fromEntries(BHP_SITES.map(site => [site, {}]));
  for (const row of data.initialStocks || []) if (stocks[row.site]) stocks[row.site][row.item_code] = Number(row.qty);
  const events = [
    ...(data.stockIns || []).filter(row => row.condition_status !== 'Belum Datang').map(row => ({ ...row, type: 'in' })),
    ...(data.usages || []).map(row => ({ ...row, type: 'out' })),
    ...(data.transfers || []).map(row => ({ ...row, type: 'transfer' })),
    ...(data.opnames || []).map(row => ({ ...row, type: 'opname' }))
  ].filter(row => row.date <= asOf).sort((a, b) => a.date.localeCompare(b.date) || String(a.created_at || '').localeCompare(String(b.created_at || '')) || Number(a.id) - Number(b.id));
  const change = (site, code, qty) => { if (stocks[site]) stocks[site][code] = (stocks[site][code] || 0) + qty; };
  for (const row of events) {
    if (row.type === 'opname') { if (stocks[row.site]) stocks[row.site][row.item_code] = Number(row.physical_qty); }
    else if (row.type === 'transfer') { change(row.from_site, row.item_code, -Number(row.qty)); change(row.to_site, row.item_code, Number(row.qty)); }
    else change(row.site, row.item_code, Number(row.qty) * (row.type === 'out' ? -1 : 1));
  }
  return stocks;
}

export function calculateBhpForecast(data, settings, asOf, siteFilter = 'ALL', options = {}) {
  const forecastTo=options.forecast_to || null;
  if(forecastTo && (!/^\d{4}-\d{2}-\d{2}$/.test(forecastTo)||!Number.isFinite(Date.parse(forecastTo))||new Date(forecastTo).toISOString().slice(0,10)!==forecastTo||forecastTo<=asOf||dayCount(asOf,forecastTo)-1>366)) throw new Error('Tanggal akhir forecast harus setelah cutoff, maksimal 366 hari.');
  const stocks = calculateBhpStocks(data, asOf);
  const reportMonthStart=asOf.slice(0,7)+'-01';
  const beforeMonth=addDays(reportMonthStart,-1);
  const monthOpening=calculateBhpStocks({...data,initialStocks:(data.initialStocks||[]).filter(row=>!row.recorded_at||Date.parse(row.recorded_at)<Date.parse(reportMonthStart+'T00:00:00+08:00'))},beforeMonth);
  const monthReceipts=new Map();
  for(const row of data.stockIns||[]) if(row.date>=reportMonthStart&&row.date<=asOf&&row.condition_status!=='Belum Datang') {
    const key=`${row.site}:${row.item_code}`;
    monthReceipts.set(key,(monthReceipts.get(key)||0)+Number(row.qty));
  }
  const usageByKey = new Map();
  for (const row of data.usages) if (row.date <= asOf) {
    const key = `${row.site}:${row.item_code}`;
    if (!usageByKey.has(key)) usageByKey.set(key, []);
    usageByKey.get(key).push(row);
  }
  const rows = [];
  for (const site of siteFilter === 'ALL' ? BHP_SITES : [siteFilter]) {
    const config = { ...DEFAULT_BHP_PLANNING, ...settings[site] };
    const historyStart = addDays(asOf, 1 - config.history_days);
    const horizon = forecastTo ? dayCount(asOf,forecastTo)-1 : config.review_days + config.lead_days;
    const end = forecastTo || addDays(asOf, horizon);
    for (const item of data.items) {
      const code = item.code;
      const unitPrice = item.price_est == null || item.price_est === '' ? null : Number(item.price_est);
      const controls = config.item_controls?.[code] || {};
      const allItemHistory = usageByKey.get(`${site}:${code}`) || [];
      const history = allItemHistory.filter(row => row.date >= historyStart);
      const firstObserved = allItemHistory.map(row => row.date).sort()[0];
      const confirmed = !!config.history_complete_from && config.history_complete_from <= asOf;
      const from = confirmed ? [historyStart, config.history_complete_from].sort().at(-1) : firstObserved ? [historyStart, firstObserved].sort().at(-1) : null;
      const n = from ? dayCount(from, asOf) : 0;
      const dailyTotals = new Map();
      for (const row of history) dailyTotals.set(row.date, (dailyTotals.get(row.date) || 0) + Number(row.qty));
      const series = Array.from({ length: n }, (_, i) => dailyTotals.get(addDays(from, i)) || 0);
      const nonzeroDays = series.filter(value => value > 0).length;
      const used = series.reduce((sum, value) => sum + value, 0);
      const manual = controls.baseline_daily != null && controls.baseline_daily !== '';
      const daily = manual ? Number(controls.baseline_daily) : n ? mean(series) : null;
      const stock = stocks[site][code] || 0;
      const windows = [];
      if (n >= horizon + 14) for (let i = 0; i <= n - horizon; i++) windows.push(series.slice(i, i + horizon).reduce((sum, value) => sum + value, 0));
      const safetyMethod = manual ? 'MANUAL_BUFFER' : windows.length >= 15 && nonzeroDays >= 3 ? 'EMPIRICAL' : 'DAILY_VARIABILITY';
      const safety = daily === null ? null : manual ? Math.ceil(daily * Number(controls.buffer_days || 0)) : safetyMethod === 'EMPIRICAL' ? Math.ceil(Math.max(0, quantile(windows, config.service_level) - mean(windows))) : Math.ceil(zFor(config.service_level) * sd(series) * Math.sqrt(horizon));
      const incoming = [];
      for (const row of data.stockIns || []) if (row.site === site && row.item_code === code && (row.condition_status === 'Belum Datang' || row.date > asOf)) incoming.push({ qty: Number(row.qty), eta: row.date, reference: row.ref_po });
      for (const row of controls.incoming || []) {
        const received = row.reference ? (data.stockIns || []).filter(receipt => receipt.site === site && receipt.item_code === code && receipt.ref_po === row.reference && receipt.date <= asOf && receipt.condition_status !== 'Belum Datang').reduce((sum, receipt) => sum + Number(receipt.qty), 0) : 0;
        if (row.reference) for (let i = incoming.length - 1; i >= 0; i--) if (incoming[i].reference === row.reference) incoming.splice(i, 1);
        const remaining = Math.max(0, Number(row.qty) - received);
        if (remaining) incoming.push({ ...row, qty: remaining });
      }
      const onOrder = incoming.filter(row => row.eta > asOf && row.eta <= end).reduce((sum, row) => sum + Number(row.qty), 0);
      const allocated = Number(controls.allocated || 0);
      const position = stock + onOrder - allocated;
      const forecast = daily === null ? null : daily * horizon;
      const actualMonth=allItemHistory.filter(row=>row.date>=reportMonthStart).reduce((sum,row)=>sum+Number(row.qty),0);
      const receivedMonth=monthReceipts.get(`${site}:${code}`)||0;
      const openingMonth=monthOpening[site][code]||0;
      const adjustments=stock-openingMonth-receivedMonth+actualMonth;
      const rawOrder = forecast === null || stock < 0 || !manual && n < 7 ? null : Math.max(0, forecast + safety - position);
      const multiple = Number(controls.order_multiple || 1), moq = Number(controls.moq || 1);
      const order = rawOrder === null ? null : rawOrder > 0 ? Math.ceil(Math.max(moq, rawOrder) / multiple) * multiple : 0;
      const quality = stock < 0 ? 'RECONCILE' : manual ? 'MANUAL' : !n ? 'NO_HISTORY' : !confirmed || n < 28 || nonzeroDays > 0 && nonzeroDays < 3 ? 'LIMITED' : 'READY';
      let projectedStock = stock - allocated, urgent = false;
      if (daily !== null) for (let d = 1; d <= Math.min(config.lead_days,horizon); d++) {
        projectedStock += incoming.filter(row => row.eta === addDays(asOf,d)).reduce((sum,row) => sum + Number(row.qty),0);
        projectedStock -= daily;
        if (projectedStock < 0) urgent = true;
      }
      rows.push({ key: `${site}:${code}`, site, code, item_id: code, name: item.name, unit: item.unit, price_est: unitPrice, model_type: manual ? 'MANUAL' : 'HISTORY', quality,
        history_from: from, history_to: asOf, observed_days: n, nonzero_days: nonzeroDays, total_used_hist: used, daily_series: series,
        daily_rate: daily === null ? null : round(daily), std_dev: round(sd(series)), base_forecast: forecast === null ? null : round(forecast), safety_stock: safety, safety_method: safetyMethod,
        current_stock: stock, on_order: onOrder, allocated, inventory_position: position, horizon_days: horizon, coverage_to: end,
        forecast_from:addDays(asOf,1), horizon_mode:forecastTo?'DATE':'INTERVAL', lead_time_beyond_horizon:config.lead_days>horizon, horizon_exceeds_history:n>0&&horizon>n,
        report_period_start:reportMonthStart,opening_stock_month:round(openingMonth),received_month:round(receivedMonth),actual_usage_month:round(actualMonth),stock_adjustments_month:round(adjustments),
        total_usage_to_forecast:forecast===null?null:round(actualMonth+forecast),projected_stock_end:forecast===null?null:round(stock-forecast),
        recommended_qty: order,
        total_cost: order === null || unitPrice === null ? null : Math.round(order * unitPrice * 100) / 100,
        stock_cover_days: daily > 0 ? round(Math.max(0, stock - allocated) / daily) : null,
        urgent,
        overdue_incoming: incoming.some(row => row.eta <= asOf), controls, config, version: BHP_FORECAST_VERSION });
    }
  }
  const latestUsage=data.usages.filter(row=>row.date<=asOf&&(siteFilter==='ALL'||row.site===siteFilter)).map(row=>row.date).sort().at(-1)||null;
  return { as_of: asOf, site: siteFilter, report_period_start:reportMonthStart,forecast_from:addDays(asOf,1), forecast_to:forecastTo, horizon_mode:forecastTo?'DATE':'INTERVAL', latest_usage_date:latestUsage, settings, rows, stocks, version: BHP_FORECAST_VERSION };
}
