import assert from 'node:assert/strict';
import { calculateBhpForecast, calculateBhpStocks, DEFAULT_BHP_PLANNING, addDays, todayMakassar } from '../src/utils/bhpForecast.js';
import { pool } from '../server/db.js';
import { createSessionToken } from '../server/auth.js';

const asOf = todayMakassar(), from = addDays(asOf,-89);
const item = { code:'TEST-BHP',name:'Test & Water',unit:'box',price_est:100,category:'K (Office Supplies)' };
const settings = Object.fromEntries(['LBCT','IDMG','SPCT'].map(site=>[site,{...DEFAULT_BHP_PLANNING,history_complete_from:from}]));
const empty = () => ({items:[item],initialStocks:[],usages:[],stockIns:[],transfers:[],opnames:[]});
const data = empty();
data.usages = Array.from({length:90},(_,i)=>({id:i+1,site:'LBCT',item_code:item.code,date:addDays(from,i),qty:1,created_at:addDays(from,i)+'T12:00:00Z'}));
data.opnames = [{id:1,site:'LBCT',item_code:item.code,date:asOf,physical_qty:3,created_at:asOf+'T23:00:00Z'}];
const run = (input=data, cfg=settings, site='LBCT')=>calculateBhpForecast(input,cfg,asOf,site);
let row=run().rows[0];assert.equal(row.daily_rate,1);assert.equal(row.horizon_days,37);assert.equal(row.safety_stock,0);assert.equal(row.recommended_qty,34);assert.equal(row.quality,'READY');assert(row.urgent);
assert.equal(run({...data,opnames:[{...data.opnames[0],physical_qty:0}]}).rows[0].recommended_qty,37);
assert.equal(run({...data,opnames:[{...data.opnames[0],physical_qty:100}]}).rows[0].recommended_qty,0);
assert.equal(run(empty(),{}).rows[0].recommended_qty,null);
assert.equal(run(empty(),settings).rows[0].recommended_qty,0); // confirmed zero demand is different from missing history
const splitA={...data,usages:[{site:'LBCT',item_code:item.code,date:addDays(asOf,-10),qty:100}]};
const splitB={...splitA,usages:[{...splitA.usages[0],qty:50},{...splitA.usages[0],qty:50}]};
assert.deepEqual(run(splitA).rows[0],run(splitB).rows[0]);
const old=run({...data,usages:[...data.usages,{site:'LBCT',item_code:item.code,date:'2020-01-01',qty:10000}]});assert.equal(old.rows[0].total_used_hist,90);
const future=run({...data,usages:[...data.usages,{site:'LBCT',item_code:item.code,date:addDays(asOf,1),qty:10000}]});assert.equal(future.rows[0].total_used_hist,90);
const few=run({...data,usages:[{site:'LBCT',item_code:item.code,date:asOf,qty:100}]},{}).rows[0];assert.equal(few.quality,'LIMITED');assert.equal(few.recommended_qty,null);
const manual={LBCT:{...settings.LBCT,item_controls:{[item.code]:{baseline_daily:2,buffer_days:2,moq:10,order_multiple:5,allocated:0}}}};
row=run(empty(),manual).rows[0];assert.equal(row.quality,'MANUAL');assert.equal(row.recommended_qty,80);
const unpriced=run({...empty(),items:[{...item,price_est:null}]},manual).rows[0];assert.equal(unpriced.recommended_qty,80);assert.equal(unpriced.price_est,null);assert.equal(unpriced.total_cost,null);
const poCfg={LBCT:{...settings.LBCT,item_controls:{[item.code]:{incoming:[{qty:20,eta:addDays(asOf,3),reference:'PO-1'}]}}}};
row=run(data,poCfg).rows[0];assert.equal(row.on_order,20);assert.equal(row.recommended_qty,14);
const gapCfg={LBCT:{...settings.LBCT,item_controls:{[item.code]:{incoming:[{qty:20,eta:addDays(asOf,6)}]}}}};
assert(run(data,gapCfg).rows[0].urgent); // supply arriving before day 7 still cannot cover a stockout on day 4
const receipt={site:'LBCT',item_code:item.code,date:asOf,qty:5,ref_po:'PO-1',condition_status:'Lengkap',created_at:asOf+'T23:30:00Z'};
row=run({...data,stockIns:[receipt]},poCfg).rows[0];assert.equal(row.current_stock,8);assert.equal(row.on_order,15);assert.equal(row.recommended_qty,14); // arrival only moves supply from on-order to on-hand
const overdue={LBCT:{...settings.LBCT,item_controls:{[item.code]:{incoming:[{qty:20,eta:addDays(asOf,-1)}]}}}};
assert.equal(run(data,overdue).rows[0].on_order,0);assert(run(data,overdue).rows[0].overdue_incoming);
const distant={LBCT:{...settings.LBCT,item_controls:{[item.code]:{incoming:[{qty:20,eta:addDays(asOf,100)}]}}}};assert.equal(run(data,distant).rows[0].on_order,0);
const negative=run({...data,opnames:[]}).rows[0];assert.equal(negative.current_stock,-90);assert.equal(negative.quality,'RECONCILE');assert.equal(negative.recommended_qty,null);
const both={...data,opnames:[...data.opnames,{site:'IDMG',item_code:item.code,date:asOf,physical_qty:999,created_at:asOf+'T23:00:00Z'}]};assert.equal(run(both,settings,'ALL').rows.find(x=>x.site==='LBCT').recommended_qty,34);
const intermittent={...data,usages:data.usages.map((entry,i)=>({...entry,qty:i%2?0:10}))};assert.equal(run(intermittent).rows[0].safety_method,'EMPIRICAL');
assert.equal(calculateBhpStocks({...data,transfers:[{item_code:item.code,date:asOf,from_site:'LBCT',to_site:'IDMG',qty:2,created_at:asOf+'T23:30:00Z'}]},asOf).LBCT[item.code],1);
console.log('PASS: daily aggregation invariance, bounded history, empty versus confirmed zero demand, short-history guard, excess/zero/low/negative stock, per-site order, empirical safety stock, MOQ, manual baseline and PO receipt netting.');

const client=await pool.connect();await client.query('BEGIN');const original=pool.query.bind(pool);let server;
try {
  await client.query('SET LOCAL search_path TO pg_temp, public');
  const tables=['bhp_items','bhp_usage','bhp_stock_in','bhp_transfers','bhp_opnames','bhp_initial_stocks','bhp_site_params','bhp_forecasts','bhp_evaluations','bhp_pdf_history'];
  for(const table of tables){
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    await client.query(`CREATE TEMP SEQUENCE ${table}_test_ids`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.${table}_test_ids')`);
  }
  await client.query('ALTER TABLE bhp_stock_in ADD FOREIGN KEY (item_code) REFERENCES bhp_items(code)');
  await client.query('ALTER TABLE bhp_usage ADD FOREIGN KEY (item_code) REFERENCES bhp_items(code)');
  await client.query("INSERT INTO bhp_items (code,name,unit,category,price_est) VALUES ('TEST-BHP','Test Water','box','K (Office Supplies)',100),('OTHER-BHP','Other','each','K (Office Supplies)',50)");
  for(const entry of data.usages)await client.query('INSERT INTO bhp_usage (site,item_code,date,qty,pic_name,created_at) VALUES ($1,$2,$3,$4,$5,$6)',['LBCT',item.code,entry.date,1,'Test',entry.created_at]);
  await client.query('INSERT INTO bhp_opnames(site,item_code,date,system_qty,physical_qty,pic_name,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',['LBCT',item.code,asOf,0,3,'Test',asOf+'T23:00:00Z']);
  pool.query=(...args)=>client.query(...args);process.env.VERCEL='1';
  const {default:app}=await import('../server/index.js');server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port, token=createSessionToken({id:'qa',nik:'qa',name:'Test',role:'admin'});
  async function request(path,method='GET',input,authenticated=true){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+token}:{})},...(input?{body:JSON.stringify(input)}:{})});return {status:response.status,body:await response.json()};}
  assert.equal((await request('/api/bhp/forecast?site=LBCT','GET',null,false)).status,401);
  assert.equal((await request('/api/bhp/forecast/settings/LBCT','PUT',{history_days:0})).status,400);
  assert.equal((await request('/api/bhp/forecast/settings/LBCT','PUT',{...DEFAULT_BHP_PLANNING,history_complete_from:from})).status,200);
  let response=await request('/api/bhp/forecast?site=LBCT&as_of='+asOf);assert.equal(response.status,200);assert.equal(response.body.data.rows[0].recommended_qty,34);
  await client.query("INSERT INTO bhp_usage(site,item_code,date,qty,pic_name) SELECT 'IDMG','OTHER-BHP',$1,1,'Test' FROM generate_series(1,600)",[asOf]);
  response=await request('/api/bhp/forecast?site=LBCT&as_of='+asOf);
  assert.equal(response.body.data.rows[0].total_used_hist,90); // independent of the global latest-500 UI log limit
  assert.equal((await request('/api/bhp/forecast/settings/LBCT','PUT',{item_control:{code:item.code,controls:{baseline_daily:2,reason:''}}})).status,400);
  assert.equal((await request('/api/bhp/forecast/settings/LBCT','PUT',{item_control:{code:item.code,controls:{baseline_daily:2,reason:'Approved initial estimate',incoming:[],moq:1,order_multiple:1}}})).status,200);
  response=await request('/api/bhp/forecast?site=LBCT&as_of='+asOf);assert.equal(response.body.data.rows[0].quality,'MANUAL');assert.equal(response.body.data.rows[0].recommended_qty,71);
  const saved=await request('/api/bhp/forecast/snapshots','POST',{site:'LBCT',as_of:asOf});assert.equal(saved.status,200);
  const frozen=(await client.query('SELECT result FROM bhp_forecast_runs WHERE id=$1',[saved.body.data.id])).rows[0].result;assert.equal(frozen.rows[0].recommended_qty,71);
  const configUpdate=await request('/api/bhp/forecast/settings/ALL','PUT',{review_days:7});assert.equal(configUpdate.status,200);
  assert.equal(configUpdate.body.data.LBCT.item_controls[item.code].baseline_daily,2);
  assert.equal((await client.query('SELECT result FROM bhp_forecast_runs WHERE id=$1',[saved.body.data.id])).rows[0].result.rows[0].recommended_qty,71);
  const receiptPayload={site:'LBCT',date:asOf,receiverName:'Test',entries:[{itemCode:'TEST-BHP',qty:5},{itemCode:'OTHER-BHP',qty:6}]};
  assert.equal((await request('/api/bhp/stock-in','POST',receiptPayload)).status,200);
  assert.equal(Number((await client.query('SELECT count(*) FROM bhp_stock_in')).rows[0].count),2);
  await client.query('SAVEPOINT failed_receipt');
  assert.equal((await request('/api/bhp/stock-in','POST',{...receiptPayload,entries:[{itemCode:'TEST-BHP',qty:1},{itemCode:'INVALID',qty:1}]})).status,400);
  await client.query('ROLLBACK TO SAVEPOINT failed_receipt');
  assert.equal(Number((await client.query('SELECT count(*) FROM bhp_stock_in')).rows[0].count),2);
  const balances=await request('/api/bhp/data');assert.equal(balances.status,200);assert.equal(balances.body.data.currentStocks.LBCT['OTHER-BHP'],6);
  console.log('PASS: authenticated live API routes, persisted site/settings/item controls, immutable snapshot, global settings preserve item controls, atomic receipt rollback and canonical server stocks. Temporary tables only; production data untouched.');
} finally {if(server)await new Promise(resolve=>server.close(resolve));pool.query=original;await client.query('ROLLBACK');client.release();await pool.end();}
