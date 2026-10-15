import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../server/db.js';
import {BHP_HISTORY_IMPORT_SCHEMA,applyBhpHistoryImport} from '../server/bhpHistoryImport.js';
import {migrateBhpQuantities} from '../server/bhpQuantityMigration.js';
import {validBhpQuantity} from '../src/utils/bhpQuantity.js';
import {createSessionToken} from '../server/auth.js';

assert(validBhpQuantity(0.125));assert(validBhpQuantity(0,true));
for(const value of [0,-1,NaN,Infinity,null,'',true,0.0001,1.1234])assert(!validBhpQuantity(value));
const client=await pool.connect();await client.query('BEGIN');const originalQuery=pool.query.bind(pool);let server;
try {
  await client.query('SET LOCAL search_path TO pg_temp,public');
  for(const table of ['bhp_items','bhp_initial_stocks','bhp_usage','bhp_stock_in','bhp_opnames','bhp_transfers']) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    await client.query(`CREATE TEMP SEQUENCE ${table}_fraction_test_ids`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.${table}_fraction_test_ids')`);
  }
  await client.query(BHP_HISTORY_IMPORT_SCHEMA.replaceAll('CREATE TABLE IF NOT EXISTS','CREATE TEMP TABLE'));
  await client.query("INSERT INTO bhp_items(code,name,category,unit,price_est) VALUES('TEST-ROLL','Tissue toilet','IR','pack',57500),('TEST-PR','Plastic','PR','unit',NULL)");
  await migrateBhpQuantities((...args)=>client.query(...args));
  await migrateBhpQuantities((...args)=>client.query(...args));
  const baseId=randomUUID(),hash='a'.repeat(64);
  await client.query("INSERT INTO bhp_history_imports(id,source_sha256,source_file,source_sheet,site,period_start,period_end,manifest,before_data,result) VALUES($1,$2,'Test.xlsx','August','IDMG','2026-08-01','2026-08-31','{}','{}',$3)",[baseId,hash,JSON.stringify({opening_receipts_conversion:{date:'2026-08-01'}})]);
  const nested={async query(sql,args){
    if(sql==='BEGIN')return client.query('SAVEPOINT fractional_import');
    if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT fractional_import');
    if(sql==='ROLLBACK'){await client.query('ROLLBACK TO SAVEPOINT fractional_import');return client.query('RELEASE SAVEPOINT fractional_import');}
    return client.query(sql,args);
  },release(){}};
  const isolatedPool={connect:async()=>nested};
  const aug={site:'IDMG',source_sha256:hash,source_file:'Test.xlsx',source_sheet:'August',period_start:'2026-08-01',period_end:'2026-08-31',initialization_of_import_id:baseId,rows:[
    {source_row:24,source_name:'Tissue roll',item_code:'TEST-ROLL',unit:'pack',opening_qty:303/8,total_usage:1/8,total_receipts:0,closing_qty:302/8,conversion_note:'8 roll = 1 pack',usages:[{date:'2026-08-01',qty:1/8}],receipts:[]},
    {source_row:34,source_name:'Plastic',item_code:'TEST-PR',unit:'unit',opening_qty:36,total_usage:24,total_receipts:0,closing_qty:12,usages:[{date:'2026-08-05',qty:24}],receipts:[]},
  ]};
  let result=await applyBhpHistoryImport(isolatedPool,aug,{backupDir:'tmp/backups/fraction-tests'});assert.equal(result.initialization_receipt_records,2);
  assert.equal(Number((await client.query("SELECT qty FROM bhp_stock_in WHERE item_code='TEST-ROLL'")).rows[0].qty),37.875);
  assert.equal(Number((await client.query("SELECT qty FROM bhp_usage WHERE item_code='TEST-ROLL'")).rows[0].qty),0.125);
  assert.equal((await applyBhpHistoryImport(isolatedPool,aug)).already_imported,true);
  await assert.rejects(()=>applyBhpHistoryImport(isolatedPool,{...aug,initialization_of_import_id:randomUUID(),source_sha256:'c'.repeat(64)}),/Inisiasi tambahan/);
  const sep={...aug,source_sha256:'b'.repeat(64),source_sheet:'September',period_start:'2026-09-01',period_end:'2026-09-30',initialization_of_import_id:undefined,rows:[
    {...aug.rows[0],opening_qty:302/8,total_usage:2/8,closing_qty:300/8,usages:[{date:'2026-09-01',qty:2/8}]},
    {...aug.rows[1],opening_qty:12,total_usage:7,total_receipts:15,closing_qty:20,usages:[{date:'2026-09-05',qty:7}],receipts:[{period_start:'2026-09-06',period_end:'2026-09-12',qty:15}]},
  ]};
  result=await applyBhpHistoryImport(isolatedPool,sep,{backupDir:'tmp/backups/fraction-tests'});assert.equal(result.initialization_receipt_records,0);assert.equal(result.opening_policy,'carry_forward');
  assert.equal(Number((await client.query("SELECT count(*) AS n FROM bhp_initial_stocks")).rows[0].n),0);
  pool.query=(...args)=>client.query(...args);process.env.VERCEL='1';
  const {default:app}=await import('../server/index.js');server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port,token=createSessionToken({id:'qa',nik:'qa',role:'admin'});
  async function post(path,body){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});return {status:response.status,body:await response.json()};}
  assert.equal((await post('/api/bhp/usage',{site:'IDMG',date:'2026-09-02',picName:'Test',entries:[{itemCode:'TEST-ROLL',qty:0.125}]})).status,200);
  assert.equal((await post('/api/bhp/usage',{site:'IDMG',date:'2026-09-02',picName:'Test',entries:[{itemCode:'TEST-ROLL',qty:0.0001}]})).status,400);
  assert.equal((await post('/api/bhp/stock-in',{site:'IDMG',date:'2026-09-02',receiverName:'Test',entries:[{itemCode:'TEST-ROLL',qty:0.375}]})).status,200);
  assert.equal((await post('/api/bhp/transfer',{fromSite:'IDMG',toSite:'LBCT',date:'2026-09-02',picName:'Test',itemCode:'TEST-ROLL',qty:0.125,reason:'Test'})).status,200);
  assert.equal((await post('/api/bhp/opname',{site:'IDMG',date:'2026-09-03',picName:'Test',itemCode:'TEST-ROLL',systemQty:37.625,physicalQty:37.5,reason:'Test'})).status,200);
  assert.equal(Number((await client.query("SELECT difference FROM bhp_opnames WHERE item_code='TEST-ROLL'")).rows[0].difference),-0.125);
  assert.equal((await post('/api/bhp/opname',{site:'LBCT',date:'2026-09-03',picName:'Test',itemCode:'TEST-ROLL',systemQty:-0.125,physicalQty:0,reason:'Test'})).status,200);
  console.log('PASS: exact 8-roll pack conversion, decimal-preserving schema and API usage/receipt/transfer/opname, generated fractional difference, approved initialization extension guard, no September opening duplication, import idempotence and decimal precision rejection. Temporary tables only.');
} finally {if(server)await new Promise(resolve=>server.close(resolve));pool.query=originalQuery;await client.query('ROLLBACK');client.release();await pool.end();}
