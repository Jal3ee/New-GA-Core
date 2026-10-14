import { BHP_SITES, DEFAULT_BHP_PLANNING, calculateBhpForecast, todayMakassar } from '../src/utils/bhpForecast.js';

export async function readBhpLedger(query, asOf = todayMakassar()) {
  const result = await query(`SELECT json_build_object(
    'items',COALESCE((SELECT json_agg(x ORDER BY x.id) FROM bhp_items x WHERE is_active=TRUE),'[]'::json),
    'initialStocks',COALESCE((SELECT json_agg(x) FROM bhp_initial_stocks x WHERE (recorded_at AT TIME ZONE 'Asia/Makassar')::date <= $1::date),'[]'::json),
    'usages',COALESCE((SELECT json_agg(x) FROM bhp_usage x WHERE date <= $1::date),'[]'::json),
    'stockIns',COALESCE((SELECT json_agg(x) FROM bhp_stock_in x),'[]'::json),
    'transfers',COALESCE((SELECT json_agg(x) FROM bhp_transfers x WHERE date <= $1::date),'[]'::json),
    'opnames',COALESCE((SELECT json_agg(x) FROM bhp_opnames x WHERE date <= $1::date),'[]'::json)
  ) AS data`, [asOf]);
  return result.rows[0].data;
}

export function registerBhpForecast(app, { query, authenticateToken }) {
  let ready;
  const ensure = () => ready ||= query(`CREATE TABLE IF NOT EXISTS bhp_forecast_settings (site VARCHAR(20) PRIMARY KEY, settings JSONB NOT NULL, updated_by VARCHAR(100), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS bhp_forecast_runs (id BIGSERIAL PRIMARY KEY, as_of DATE NOT NULL, site VARCHAR(20) NOT NULL, version VARCHAR(50) NOT NULL, result JSONB NOT NULL, created_by VARCHAR(100), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`).catch(error => { ready = null; throw error; });
  const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const validateSite = site => site === 'ALL' || BHP_SITES.includes(site);
  const loadSettings = async () => {
    await ensure();
    const saved = (await query('SELECT site,settings FROM bhp_forecast_settings')).rows;
    return Object.fromEntries(BHP_SITES.map(site => [site, { ...DEFAULT_BHP_PLANNING, ...saved.find(row => row.site === site)?.settings }]));
  };
  const run = async (site, asOf) => calculateBhpForecast(await readBhpLedger(query, asOf), await loadSettings(), asOf, site);
  const fail = (res, error) => { console.error('[BHP Forecast]', error.message); return res.status(503).json({ ok: false, error: 'Forecast belum dapat dimuat. Silakan coba kembali.' }); };

  app.get('/api/bhp/forecast', authenticateToken, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const site = req.query.site || 'ALL', asOf = req.query.as_of || todayMakassar();
    if (!validateSite(site) || !validDay(asOf) || asOf > todayMakassar()) return res.status(400).json({ ok: false, error: 'Site atau tanggal cutoff tidak valid.' });
    try { return res.json({ ok: true, data: await run(site, asOf) }); } catch (error) { return fail(res, error); }
  });

  app.put('/api/bhp/forecast/settings/:site', authenticateToken, async (req, res) => {
    const site = req.params.site, input = req.body;
    if (!validateSite(site) || !input || Array.isArray(input)) return res.status(400).json({ ok: false, error: 'Parameter tidak valid.' });
    const patch = {};
    for (const [key, min, max] of [['history_days',7,366],['review_days',1,90],['lead_days',0,90]]) if (Object.hasOwn(input, key)) {
      if (!Number.isInteger(input[key]) || input[key] < min || input[key] > max) return res.status(400).json({ ok: false, error: `${key} harus ${min}-${max} hari.` });
      patch[key] = input[key];
    }
    if (Object.hasOwn(input,'service_level')) {
      if (![0.9,0.95,0.975,0.99].includes(input.service_level)) return res.status(400).json({ ok: false, error: 'Service level tidak valid.' });
      patch.service_level = input.service_level;
    }
    if (Object.hasOwn(input,'history_complete_from')) {
      if (input.history_complete_from !== '' && (!validDay(input.history_complete_from) || input.history_complete_from > todayMakassar())) return res.status(400).json({ ok: false, error: 'Tanggal pencatatan lengkap tidak valid.' });
      patch.history_complete_from = input.history_complete_from;
    }
    if (Object.hasOwn(input,'item_control')) {
      if (site === 'ALL') return res.status(400).json({ ok: false, error: 'Pilih satu site untuk parameter barang.' });
      const { code, controls } = input.item_control || {};
      if (!code || !controls || !(await query('SELECT code FROM bhp_items WHERE code=$1 AND is_active=TRUE',[code])).rows.length) return res.status(400).json({ ok: false, error: 'Barang tidak valid.' });
      const normalized = {};
      for (const [key, fallback] of [['allocated',0],['moq',1],['order_multiple',1],['buffer_days',0]]) {
        const value = controls[key] ?? fallback;
        if (!Number.isSafeInteger(value) || value < (key==='moq'||key==='order_multiple'?1:0) || value > 1000000) return res.status(400).json({ ok: false, error: `${key} tidak valid.` });
        normalized[key] = value;
      }
      const daily = controls.baseline_daily;
      if (daily != null && (!Number.isFinite(daily) || daily < 0 || daily > 1000000)) return res.status(400).json({ ok: false, error: 'Baseline harian tidak valid.' });
      normalized.baseline_daily = daily ?? null;
      if (normalized.baseline_daily !== null && (typeof controls.reason !== 'string' || !controls.reason.trim())) return res.status(400).json({ ok: false, error: 'Alasan baseline manual wajib diisi.' });
      normalized.reason = String(controls.reason || '').slice(0,1000);
      if (!Array.isArray(controls.incoming || []) || (controls.incoming || []).length > 20) return res.status(400).json({ ok: false, error: 'Daftar incoming tidak valid.' });
      normalized.incoming = [];
      const references = new Set();
      for (const row of controls.incoming || []) {
        if (!Number.isSafeInteger(row.qty) || row.qty <= 0 || row.qty > 1000000 || !validDay(row.eta)) return res.status(400).json({ ok: false, error: 'Jumlah/ETA incoming tidak valid.' });
        const reference = String(row.reference || '').trim().slice(0,100);
        if (reference && references.has(reference)) return res.status(400).json({ ok: false, error: 'Gunakan satu baris total untuk Ref. PO yang sama pada barang ini.' });
        if (reference) references.add(reference);
        normalized.incoming.push({ qty: row.qty, eta: row.eta, reference });
      }
      await ensure();
      await query(`INSERT INTO bhp_forecast_settings (site,settings,updated_by) VALUES ($1,jsonb_build_object('item_controls',jsonb_build_object($2::text,$3::jsonb)),$4) ON CONFLICT(site) DO UPDATE SET settings=jsonb_set(bhp_forecast_settings.settings,'{item_controls}',COALESCE(bhp_forecast_settings.settings->'item_controls','{}'::jsonb)||jsonb_build_object($2::text,$3::jsonb)), updated_by=$4, updated_at=NOW()`,[site,code,JSON.stringify(normalized),req.user.nik]);
    }
    try {
      await ensure();
      if (Object.keys(patch).length) await query(`INSERT INTO bhp_forecast_settings (site,settings,updated_by) SELECT unnest($1::text[]),$2::jsonb,$3 ON CONFLICT(site) DO UPDATE SET settings=bhp_forecast_settings.settings||EXCLUDED.settings,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[site==='ALL'?BHP_SITES:[site],JSON.stringify(patch),req.user.nik]);
      return res.json({ ok: true, data: await loadSettings() });
    } catch (error) { return fail(res,error); }
  });

  app.post('/api/bhp/forecast/snapshots', authenticateToken, async (req,res) => {
    const site=req.body?.site||'ALL',asOf=req.body?.as_of||todayMakassar();
    if(!validateSite(site)||!validDay(asOf)||asOf>todayMakassar())return res.status(400).json({ok:false,error:'Periode tidak valid.'});
    try {
      const result=await run(site,asOf);
      const saved=await query('INSERT INTO bhp_forecast_runs (as_of,site,version,result,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id,created_at',[asOf,site,result.version,JSON.stringify(result),req.user.nik]);
      return res.json({ok:true,data:saved.rows[0]});
    } catch(error){return fail(res,error);}
  });
}
