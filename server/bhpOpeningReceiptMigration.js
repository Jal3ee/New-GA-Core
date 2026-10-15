import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readBhpLedger } from './bhpForecastService.js';
import { addDays, calculateBhpStocks, todayMakassar } from '../src/utils/bhpForecast.js';

// Explicit one-time correction of an existing audited import. Recurring import
// behavior lives in bhpHistoryImport and never seeds opening balances again.
export async function convertBhpOpeningToReceipts(pool, importId, {backupDir='tmp/backups'}={}) {
  assert(typeof importId==='string'&&/^[0-9a-f-]{36}$/i.test(importId),'ID batch tidak valid');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const batch=(await client.query('SELECT *,period_start::text AS period_start,period_end::text AS period_end FROM bhp_history_imports WHERE id=$1 FOR UPDATE',[importId])).rows[0];
    assert(batch,'Batch import tidak ditemukan');
    if(batch.result.opening_receipts_conversion) {
      await client.query('COMMIT');
      return {already_converted:true,...batch.result.opening_receipts_conversion};
    }
    await client.query('LOCK TABLE bhp_initial_stocks,bhp_usage,bhp_stock_in,bhp_opnames,bhp_transfers IN SHARE ROW EXCLUSIVE MODE');
    const codes=[...new Set(batch.manifest.rows.map(row=>row.item_code))];
    const initial=(await client.query('SELECT * FROM bhp_initial_stocks WHERE site=$1 AND item_code=ANY($2::text[]) AND recorded_at=$3::timestamptz FOR UPDATE',[batch.site,codes,batch.period_start+'T00:00:00+08:00'])).rows;
    assert.equal(initial.length,codes.length,'Jumlah stok awal batch berbeda; perlu pemeriksaan manual');
    for(const code of codes) {
      const matching=initial.filter(row=>row.item_code===code);
      assert.equal(matching.length,1,'Stok awal SKU ganda: '+code);
      assert.equal(Number(matching[0].qty),batch.manifest.rows.filter(row=>row.item_code===code).reduce((sum,row)=>sum+row.opening_qty,0),'Stok awal telah berubah: '+code);
    }
    const asOf=todayMakassar();
    assert(batch.period_start<=asOf,'Batch inisiasi berada di masa depan');
    const before=await readBhpLedger((...args)=>client.query(...args),asOf);
    await fs.mkdir(backupDir,{recursive:true});
    const backupPath=`${backupDir}/bhp-opening-to-receipts-${importId}.json`;
    await fs.writeFile(backupPath,JSON.stringify({batch,initial,ledger:before},null,2));
    const receipts=[];
    for(const row of initial.filter(row=>row.qty>0)) {
      const sourceRows=batch.manifest.rows.filter(source=>source.item_code===row.item_code).map(source=>source.source_row).join(', ');
      const receipt=(await client.query(`INSERT INTO bhp_stock_in(date,site,item_code,qty,condition_status,receiver_name,notes)
        VALUES($1,$2,$3,$4,'Inisiasi Awal','Tidak tercantum (Excel)',$5) RETURNING id,item_code,qty,date::text`,
      [batch.period_start,batch.site,row.item_code,row.qty,`Inisiasi awal ${batch.site} ${batch.period_start}: saldo awal Excel diperlakukan sebagai penerimaan satu kali, bukan pembelian tambahan. Sumber ${batch.source_file}, sheet ${batch.source_sheet}, baris ${sourceRows}. Batch ${importId}.`])).rows[0];
      receipts.push(receipt);
    }
    const removed=await client.query('DELETE FROM bhp_initial_stocks WHERE id=ANY($1::integer[]) RETURNING id',[initial.map(row=>row.id)]);
    assert.equal(removed.rowCount,initial.length,'Penghapusan stok awal tidak lengkap');
    const after=await readBhpLedger((...args)=>client.query(...args),asOf);
    // Compare each daily balance, including later transactions and opnames.
    // Restrict initial balances by effective date as readBhpLedger normally does.
    const snapshot=(ledger,day)=>calculateBhpStocks({...ledger,initialStocks:ledger.initialStocks.filter(row=>new Date(row.recorded_at).getTime()<=Date.parse(day+'T23:59:59.999+08:00'))},day)[batch.site];
    let checkedDays=0;
    for(let day=batch.period_start;day<=asOf;day=addDays(day,1)) {
      const oldStocks=snapshot(before,day),newStocks=snapshot(after,day);
      for(const code of codes)assert.equal(newStocks[code]||0,oldStocks[code]||0,`Saldo berubah pada ${day}, SKU ${code}`);
      checkedDays++;
    }
    const conversion={converted_at:new Date().toISOString(),date:batch.period_start,removed_initial_records:initial.length,receipt_records:receipts.length,zero_balances_without_receipt:initial.filter(row=>Number(row.qty)===0).length,receipts,verified_skus:codes.length,verified_days:checkedDays,backup_path:backupPath,recurring_opening_policy:'carry_forward'};
    await client.query("UPDATE bhp_history_imports SET result=jsonb_set(result,'{opening_receipts_conversion}',$2::jsonb) WHERE id=$1",[importId,JSON.stringify({...conversion,previous_initial_rows:initial})]);
    await client.query('COMMIT');
    return conversion;
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
}
