import assert from 'node:assert/strict';
import {pool} from '../server/db.js';
import {applyBhpHistoryImport,validateBhpHistoryManifest,BHP_HISTORY_IMPORT_SCHEMA} from '../server/bhpHistoryImport.js';
import {bhpCalendarDate,bhpReceiptPeriod} from '../src/utils/bhpReceiptPeriod.js';

assert.equal(bhpCalendarDate('2026-08-04T16:00:00.000Z'),'2026-08-05');
assert.deepEqual(bhpReceiptPeriod({date:'2026-08-05',period_start:'2026-07-31T16:00:00Z',period_end:'2026-08-04T16:00:00Z'}),{label:'2026-08-01 s.d. 2026-08-05',weekly:true});
assert.deepEqual(bhpReceiptPeriod({date:'2026-08-05'}),{label:'2026-08-05',weekly:false});
const input={site:'IDMG',source_sha256:'a'.repeat(64),source_file:'Test.xlsx',source_sheet:'Agustus',period_start:'2026-08-01',period_end:'2026-08-31',rows:[
  {source_row:10,source_name:'Original product',item_code:'IMPORT-1',unit:'each',opening_qty:10,total_usage:3,total_receipts:5,closing_qty:12,usages:[{date:'2026-08-05',qty:3}],receipts:[{period_start:'2026-08-01',period_end:'2026-08-05',qty:5}]},
  {source_row:11,source_name:'Nearest equivalent',item_code:'IMPORT-1',unit:'each',opening_qty:2,total_usage:1,total_receipts:0,closing_qty:1,usages:[{date:'2026-08-06',qty:1}],receipts:[]},
  {source_row:12,source_name:'Second product',item_code:'IMPORT-2',unit:'each',opening_qty:0,total_usage:1,total_receipts:3,closing_qty:2,usages:[{date:'2026-08-04',qty:1}],receipts:[{period_start:'2026-08-01',period_end:'2026-08-05',qty:3}]},
]};
assert.throws(()=>validateBhpHistoryManifest({...input,rows:[{...input.rows[0],total_usage:4}]}),/Total pemakaian/);
const client=await pool.connect();await client.query('BEGIN');
try {
  await client.query('SET LOCAL search_path TO pg_temp,public');
  for(const table of ['bhp_items','bhp_initial_stocks','bhp_usage','bhp_stock_in','bhp_opnames','bhp_transfers']) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    await client.query(`CREATE TEMP SEQUENCE ${table}_import_test_ids`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.${table}_import_test_ids')`);
  }
  await client.query(BHP_HISTORY_IMPORT_SCHEMA.replaceAll('CREATE TABLE IF NOT EXISTS','CREATE TEMP TABLE'));
  await client.query("INSERT INTO bhp_items(code,name,unit,category) VALUES('IMPORT-1','Test 1','each','K'),('IMPORT-2','Test 2','each','K'),('IMPORT-3','Test 3','each','K')");
  await client.query("INSERT INTO bhp_stock_in(date,site,item_code,qty,receiver_name) VALUES('2026-07-31','IDMG','IMPORT-1',12,'Test')");
  await client.query("INSERT INTO bhp_usage(date,site,item_code,qty,pic_name) VALUES('2026-08-05','IDMG','IMPORT-1',6,'Test'),('2026-09-01','IDMG','IMPORT-1',1,'Test'),('2026-08-05','LBCT','IMPORT-1',2,'Test')");
  const nested={async query(sql,args){
    if(sql==='BEGIN')return client.query('SAVEPOINT bhp_history_import');
    if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT bhp_history_import');
    if(sql==='ROLLBACK'){await client.query('ROLLBACK TO SAVEPOINT bhp_history_import');return client.query('RELEASE SAVEPOINT bhp_history_import');}
    return client.query(sql,args);
  },release(){}};
  const isolatedPool={connect:async()=>nested};
  const result=await applyBhpHistoryImport(isolatedPool,input,{backupDir:'tmp/backups/import-tests'});
  assert.equal(result.items,2);assert.equal(result.source_rows,3);assert.equal(result.replaced_usage_records,1);assert.equal(result.closing_balances_verified,2);
  assert.equal((await client.query("SELECT count(*)::integer AS n FROM bhp_initial_stocks")).rows[0].n,0);
  assert.equal((await client.query("SELECT qty FROM bhp_usage WHERE site='IDMG' AND item_code='IMPORT-1' AND date='2026-08-05'")).rows[0].qty,3);
  assert.equal((await client.query("SELECT qty FROM bhp_usage WHERE site='LBCT'")).rows[0].qty,2);
  assert.equal((await client.query("SELECT qty FROM bhp_usage WHERE date='2026-09-01'")).rows[0].qty,1);
  const receipt=(await client.query("SELECT period_start::text,period_end::text,date::text,notes FROM bhp_stock_in WHERE period_start IS NOT NULL LIMIT 1")).rows[0];
  assert.equal(receipt.period_start,'2026-08-01');assert.equal(receipt.period_end,'2026-08-05');assert.match(receipt.notes,/tanggal harian tidak tersedia/);
  const before=(await client.query('SELECT count(*)::integer AS n FROM bhp_usage')).rows[0].n;
  assert.equal((await applyBhpHistoryImport(isolatedPool,input)).already_imported,true);
  assert.equal((await client.query('SELECT count(*)::integer AS n FROM bhp_usage')).rows[0].n,before);
  const audit=(await client.query('SELECT before_data FROM bhp_history_imports')).rows[0];assert.equal(audit.before_data.bhp_usage.find(r=>r.qty===6).site,'IDMG');
  await assert.rejects(()=>applyBhpHistoryImport(isolatedPool,{...input,rows:[{...input.rows[0],item_code:'WRONG'}]}),/kode berbeda/);
  await client.query(`CREATE FUNCTION pg_temp.fail_import_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.item_code='IMPORT-3' THEN RAISE EXCEPTION 'Test receipt failure'; END IF; RETURN NEW; END $$`);
  await client.query('CREATE TRIGGER fail_import_receipt BEFORE INSERT ON bhp_stock_in FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_import_receipt()');
  await client.query("INSERT INTO bhp_initial_stocks(site,item_code,qty,recorded_at) VALUES('IDMG','IMPORT-3',10,'2026-07-31T00:00:00+08:00')");
  await assert.rejects(()=>applyBhpHistoryImport(isolatedPool,{...input,source_sha256:'b'.repeat(64),rows:[{...input.rows[0],item_code:'IMPORT-3'}]},{backupDir:'tmp/backups/import-tests'}),/Test receipt failure/);
  assert.equal((await client.query("SELECT qty FROM bhp_initial_stocks WHERE item_code='IMPORT-3'")).rows[0].qty,10);
  assert.equal((await client.query("SELECT count(*)::integer AS n FROM bhp_usage WHERE item_code='IMPORT-3'")).rows[0].n,0);
  assert.equal((await client.query('SELECT count(*)::integer AS n FROM bhp_history_imports')).rows[0].n,1);
  const nextMonth={...input,source_sha256:'d'.repeat(64),period_start:'2026-09-01',period_end:'2026-09-30',rows:[
    {...input.rows[0],opening_qty:13,total_usage:1,total_receipts:0,closing_qty:12,usages:[{date:'2026-09-01',qty:1}],receipts:[]},
  ]};
  const receiptCount=(await client.query('SELECT count(*)::integer AS n FROM bhp_stock_in')).rows[0].n;
  assert.equal((await applyBhpHistoryImport(isolatedPool,nextMonth,{backupDir:'tmp/backups/import-tests'})).opening_policy,'carry_forward');
  assert.equal((await client.query('SELECT count(*)::integer AS n FROM bhp_stock_in')).rows[0].n,receiptCount);
  assert.equal((await client.query("SELECT count(*)::integer AS n FROM bhp_initial_stocks WHERE item_code='IMPORT-1'")).rows[0].n,0);
  await assert.rejects(()=>applyBhpHistoryImport(isolatedPool,{...nextMonth,source_sha256:'e'.repeat(64),rows:[{...nextMonth.rows[0],opening_qty:14,closing_qty:13}]}),/Saldo awal Excel berbeda/);
  console.log('PASS: source totals, merged SKU balances, carried opening balances, next-month imports without extra opening receipts, mismatch guard, weekly date ranges, source-authoritative correction with audit backup, other sites/periods unchanged, idempotence, mapping-change guard, and atomic rollback on DB failure. Temporary tables only.');
} finally {await client.query('ROLLBACK');client.release();await pool.end();}
