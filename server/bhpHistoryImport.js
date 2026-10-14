import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { readBhpLedger } from './bhpForecastService.js';
import { calculateBhpStocks } from '../src/utils/bhpForecast.js';

export const BHP_HISTORY_IMPORT_SCHEMA = `
ALTER TABLE bhp_stock_in ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE bhp_stock_in ADD COLUMN IF NOT EXISTS period_end DATE;
CREATE TABLE IF NOT EXISTS bhp_history_imports (
 id UUID PRIMARY KEY, source_sha256 VARCHAR(64) NOT NULL, source_file TEXT NOT NULL,
 source_sheet TEXT NOT NULL, site VARCHAR(20) NOT NULL, period_start DATE NOT NULL,
 period_end DATE NOT NULL, manifest JSONB NOT NULL, before_data JSONB NOT NULL,
 result JSONB NOT NULL, imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bhp_history_import_rows (
 source_sha256 VARCHAR(64) NOT NULL, source_sheet TEXT NOT NULL, site VARCHAR(20) NOT NULL,
 source_row INTEGER NOT NULL, item_code TEXT NOT NULL, import_id UUID NOT NULL,
 source_data JSONB NOT NULL,
 PRIMARY KEY(source_sha256,source_sheet,site,source_row)
);`;

const day = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
const qty = value => Number.isSafeInteger(value) && value>=0;
export function validateBhpHistoryManifest(input) {
  assert(input && ['LBCT','IDMG','SPCT'].includes(input.site),'Site tidak valid');
  assert(/^[a-f0-9]{64}$/.test(input.source_sha256),'Hash sumber tidak valid');
  assert(input.source_file && input.source_sheet && day(input.period_start) && day(input.period_end) && input.period_start<=input.period_end,'Sumber/periode tidak valid');
  assert(Array.isArray(input.rows) && input.rows.length>0,'Baris import kosong');
  const sourceRows=new Set();
  for(const row of input.rows) {
    assert(Number.isInteger(row.source_row)&&row.source_row>0&&row.item_code&&row.unit&&row.source_name,'Identitas barang sumber tidak lengkap');
    assert(!sourceRows.has(row.source_row),'Baris sumber ganda');sourceRows.add(row.source_row);
    assert([row.opening_qty,row.total_usage,row.total_receipts,row.closing_qty].every(qty),'Jumlah tidak valid');
    assert(Array.isArray(row.usages)&&Array.isArray(row.receipts),'Mutasi tidak lengkap');
    const dates=new Set();
    for(const usage of row.usages) {
      assert(day(usage.date)&&usage.date>=input.period_start&&usage.date<=input.period_end&&qty(usage.qty)&&usage.qty>0&&!dates.has(usage.date),'Pemakaian harian tidak valid');dates.add(usage.date);
    }
    const ranges=new Set();
    for(const receipt of row.receipts) {
      const key=receipt.period_start+':'+receipt.period_end;
      assert(day(receipt.period_start)&&day(receipt.period_end)&&receipt.period_start>=input.period_start&&receipt.period_start<=receipt.period_end&&receipt.period_end<=input.period_end&&qty(receipt.qty)&&receipt.qty>0&&!ranges.has(key),'Rekap penerimaan tidak valid');ranges.add(key);
    }
    assert.equal(row.usages.reduce((sum,r)=>sum+r.qty,0),row.total_usage,'Total pemakaian berbeda dari sumber');
    assert.equal(row.receipts.reduce((sum,r)=>sum+r.qty,0),row.total_receipts,'Total penerimaan berbeda dari sumber');
    assert.equal(row.opening_qty+row.total_receipts-row.total_usage,row.closing_qty,'Rekonsiliasi stok sumber gagal');
  }
  return input;
}

export async function applyBhpHistoryImport(pool, input, {backupDir='tmp/backups'}={}) {
  validateBhpHistoryManifest(input);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(BHP_HISTORY_IMPORT_SCHEMA);
    await client.query('LOCK TABLE bhp_items IN SHARE MODE');
    await client.query('LOCK TABLE bhp_history_import_rows,bhp_initial_stocks,bhp_usage,bhp_stock_in,bhp_opnames,bhp_transfers IN SHARE ROW EXCLUSIVE MODE');
    const previous=(await client.query('SELECT source_row,item_code,source_data FROM bhp_history_import_rows WHERE source_sha256=$1 AND source_sheet=$2 AND site=$3',[input.source_sha256,input.source_sheet,input.site])).rows;
    const rows=input.rows.filter(row=>{
      const found=previous.find(p=>p.source_row===row.source_row);
      if(found) { assert.equal(found.item_code,row.item_code,'Baris sumber sudah diimport ke kode berbeda');assert.deepEqual(found.source_data,row,'Baris sumber sudah diimport dengan isi berbeda'); }
      return !found;
    });
    if(!rows.length) {await client.query('COMMIT');return {already_imported:true,skipped_rows:input.rows.length};}
    const codes=[...new Set(rows.map(row=>row.item_code))];
    const catalog=(await client.query('SELECT code,unit FROM bhp_items WHERE is_active=TRUE AND code=ANY($1::text[])',[codes])).rows;
    for(const row of rows) assert(catalog.some(item=>item.code===row.item_code&&item.unit===row.unit),'Kode/satuan katalog tidak sesuai manifest: '+row.item_code);
    const before={};
    for(const table of ['bhp_initial_stocks','bhp_usage','bhp_stock_in','bhp_opnames'])before[table]=(await client.query(`SELECT * FROM ${table} WHERE site=$1 AND item_code=ANY($2::text[])`,[input.site,codes])).rows;
    before.bhp_transfers=(await client.query('SELECT * FROM bhp_transfers WHERE (from_site=$1 OR to_site=$1) AND item_code=ANY($2::text[])',[input.site,codes])).rows;
    // Existing opening balances need a separate reconciliation, never overwrite.
    assert.equal(before.bhp_initial_stocks.length,0,'Stok awal sudah ada; perlu rekonsiliasi manual sebelum import');
    const id=randomUUID();
    await fs.mkdir(backupDir,{recursive:true});
    const backupPath=`${backupDir}/bhp-history-${input.site}-${id}.json`;
    await fs.writeFile(backupPath,JSON.stringify({source:input,before},null,2));
    // The user explicitly chose the source workbook as the actuals authority
    // for this period. Preserve other sites, SKUs and periods.
    const replacedUsage=await client.query('DELETE FROM bhp_usage WHERE site=$1 AND item_code=ANY($2::text[]) AND date BETWEEN $3::date AND $4::date',[input.site,codes,input.period_start,input.period_end]);
    const replacedReceipts=await client.query('DELETE FROM bhp_stock_in WHERE site=$1 AND item_code=ANY($2::text[]) AND date BETWEEN $3::date AND $4::date',[input.site,codes,input.period_start,input.period_end]);
    let usages=0,receipts=0;
    for(const code of codes) {
      const opening=rows.filter(row=>row.item_code===code).reduce((sum,row)=>sum+row.opening_qty,0);
      await client.query('INSERT INTO bhp_initial_stocks(item_code,site,qty,recorded_at) VALUES($1,$2,$3,$4)',[code,input.site,opening,input.period_start+'T00:00:00+08:00']);
    }
    for(const row of rows) {
      const source=`Excel ${input.source_file} | ${input.source_sheet} baris ${row.source_row} | Barang sumber: ${row.source_name} | SKU tujuan ${row.item_code}; jumlah kemasan 1:1 | SHA256 ${input.source_sha256}`;
      for(const usage of row.usages) {
        await client.query('INSERT INTO bhp_usage(date,site,item_code,qty,pic_name,is_anomaly,notes) VALUES($1,$2,$3,$4,$5,FALSE,$6)',[usage.date,input.site,row.item_code,usage.qty,'Import Excel (PIC tidak tercantum)',source]);usages++;
      }
      for(const receipt of row.receipts) {
        await client.query('INSERT INTO bhp_stock_in(date,site,item_code,qty,condition_status,receiver_name,notes,period_start,period_end) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$1)',[receipt.period_end,input.site,row.item_code,receipt.qty,'Histori Excel','Tidak tercantum (Excel)',`Rekap penerimaan ${receipt.period_start} s.d. ${receipt.period_end}; tanggal harian tidak tersedia. ${source}`,receipt.period_start]);receipts++;
      }
      await client.query('INSERT INTO bhp_history_import_rows(source_sha256,source_sheet,site,source_row,item_code,import_id,source_data) VALUES($1,$2,$3,$4,$5,$6,$7)',[input.source_sha256,input.source_sheet,input.site,row.source_row,row.item_code,id,JSON.stringify(row)]);
    }
    const ledger=await readBhpLedger((...args)=>client.query(...args),input.period_end);
    const stocks=calculateBhpStocks(ledger,input.period_end)[input.site];
    for(const code of codes) assert.equal(stocks[code]||0,rows.filter(row=>row.item_code===code).reduce((sum,row)=>sum+row.closing_qty,0),`Saldo akhir berbeda dari Excel: ${code}`);
    const result={import_id:id,site:input.site,period_start:input.period_start,period_end:input.period_end,items:codes.length,source_rows:rows.length,usage_records:usages,weekly_receipt_records:receipts,replaced_usage_records:replacedUsage.rowCount,replaced_receipt_records:replacedReceipts.rowCount,skipped_rows:input.rows.length-rows.length,closing_balances_verified:codes.length,backup_path:backupPath};
    await client.query('INSERT INTO bhp_history_imports(id,source_sha256,source_file,source_sheet,site,period_start,period_end,manifest,before_data,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,input.source_sha256,input.source_file,input.source_sheet,input.site,input.period_start,input.period_end,JSON.stringify({...input,rows}),JSON.stringify(before),JSON.stringify(result)]);
    await client.query('COMMIT');return result;
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}
