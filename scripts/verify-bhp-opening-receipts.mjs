import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../server/db.js';
import {BHP_HISTORY_IMPORT_SCHEMA} from '../server/bhpHistoryImport.js';
import {convertBhpOpeningToReceipts} from '../server/bhpOpeningReceiptMigration.js';

const client=await pool.connect();await client.query('BEGIN');
try {
  await client.query('SET LOCAL search_path TO pg_temp,public');
  for(const table of ['bhp_items','bhp_initial_stocks','bhp_usage','bhp_stock_in','bhp_opnames','bhp_transfers']) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    await client.query(`CREATE TEMP SEQUENCE ${table}_opening_test_ids`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.${table}_opening_test_ids')`);
  }
  await client.query(BHP_HISTORY_IMPORT_SCHEMA.replaceAll('CREATE TABLE IF NOT EXISTS','CREATE TEMP TABLE'));
  await client.query("INSERT INTO bhp_items(code,name,unit,category) VALUES('INIT-1','Initialization test','each','K'),('INIT-0','Zero test','each','K')");
  const manifest={rows:[{item_code:'INIT-1',source_row:10,opening_qty:4},{item_code:'INIT-0',source_row:11,opening_qty:0}]};
  const id=randomUUID();
  await client.query("INSERT INTO bhp_history_imports(id,source_sha256,source_file,source_sheet,site,period_start,period_end,manifest,before_data,result) VALUES($1,$2,'Test.xlsx','Agustus','IDMG','2026-08-01','2026-08-31',$3,'{}','{}')",[id,'a'.repeat(64),JSON.stringify(manifest)]);
  await client.query("INSERT INTO bhp_initial_stocks(site,item_code,qty,recorded_at) VALUES('IDMG','INIT-1',4,'2026-08-01T00:00:00+08:00'),('IDMG','INIT-0',0,'2026-08-01T00:00:00+08:00'),('LBCT','INIT-1',8,'2026-08-01T00:00:00+08:00')");
  await client.query("INSERT INTO bhp_usage(date,site,item_code,qty,pic_name) VALUES('2026-08-01','IDMG','INIT-1',1,'Test'),('2026-09-01','IDMG','INIT-1',1,'Test')");
  await client.query("INSERT INTO bhp_stock_in(date,site,item_code,qty,receiver_name) VALUES('2026-08-05','IDMG','INIT-1',2,'Test')");
  const nested={async query(sql,args){
    if(sql==='BEGIN')return client.query('SAVEPOINT opening_conversion');
    if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT opening_conversion');
    if(sql==='ROLLBACK'){await client.query('ROLLBACK TO SAVEPOINT opening_conversion');return client.query('RELEASE SAVEPOINT opening_conversion');}
    return client.query(sql,args);
  },release(){}};
  const isolatedPool={connect:async()=>nested};
  const result=await convertBhpOpeningToReceipts(isolatedPool,id,{backupDir:'tmp/backups/opening-tests'});
  assert.equal(result.removed_initial_records,2);assert.equal(result.receipt_records,1);assert.equal(result.zero_balances_without_receipt,1);
  assert(result.verified_days>=31);assert.equal(result.verified_skus,2);
  assert.equal((await client.query("SELECT count(*)::integer AS n FROM bhp_initial_stocks WHERE site='IDMG'")).rows[0].n,0);
  assert.equal((await client.query("SELECT qty FROM bhp_initial_stocks WHERE site='LBCT'")).rows[0].qty,8);
  const converted=(await client.query("SELECT *,date::text AS date FROM bhp_stock_in WHERE condition_status='Inisiasi Awal'")).rows;
  assert.equal(converted.length,1);assert.equal(converted[0].date,'2026-08-01');assert.equal(converted[0].qty,4);
  assert.equal(converted[0].period_start,null);assert.equal(converted[0].period_end,null);
  assert.equal((await convertBhpOpeningToReceipts(isolatedPool,id)).already_converted,true);
  assert.equal((await client.query("SELECT count(*)::integer AS n FROM bhp_stock_in WHERE condition_status='Inisiasi Awal'")).rows[0].n,1);
  assert.equal((await client.query('SELECT result FROM bhp_history_imports WHERE id=$1',[id])).rows[0].result.opening_receipts_conversion.previous_initial_rows.length,2);
  const mismatchId=randomUUID();
  await client.query("INSERT INTO bhp_history_imports(id,source_sha256,source_file,source_sheet,site,period_start,period_end,manifest,before_data,result) VALUES($1,$2,'Test.xlsx','Agustus','LBCT','2026-08-01','2026-08-31',$3,'{}','{}')",[mismatchId,'b'.repeat(64),JSON.stringify({rows:[{item_code:'INIT-1',source_row:10,opening_qty:9}]})]);
  await assert.rejects(()=>convertBhpOpeningToReceipts(isolatedPool,mismatchId),/Stok awal telah berubah/);
  assert.equal((await client.query("SELECT qty FROM bhp_initial_stocks WHERE site='LBCT'")).rows[0].qty,8);
  console.log('PASS: one-time opening-to-receipt conversion on period start, zero handling, all daily balances preserved, other sites and later transactions preserved, audit backup, repeat protection and changed-source guard. PostgreSQL temporary tables only.');
} finally {await client.query('ROLLBACK');client.release();await pool.end();}
