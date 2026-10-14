import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pool} from '../server/db.js';
import {applyBhpHistoryImport,validateBhpHistoryManifest} from '../server/bhpHistoryImport.js';

const [manifestPath,sourcePath,mode]=process.argv.slice(2);
try {
  if(!manifestPath||!sourcePath)throw new Error('Usage: node scripts/import-bhp-history.mjs <manifest.json> <source.xlsx> [--apply]');
  const manifest=validateBhpHistoryManifest(JSON.parse(await fs.readFile(manifestPath,'utf8')));
  const hash=createHash('sha256').update(await fs.readFile(sourcePath)).digest('hex');
  if(hash!==manifest.source_sha256)throw new Error('File sumber tidak cocok dengan SHA256 manifest');
  if(mode!=='--apply')console.log(JSON.stringify({dry_run:true,opening_policy:'carry_forward',site:manifest.site,period_start:manifest.period_start,period_end:manifest.period_end,source_rows:manifest.rows.length,items:new Set(manifest.rows.map(row=>row.item_code)).size,usage_records:manifest.rows.reduce((s,r)=>s+r.usages.length,0),weekly_receipt_records:manifest.rows.reduce((s,r)=>s+r.receipts.length,0)}));
  else console.log(JSON.stringify(await applyBhpHistoryImport(pool,manifest)));
} finally {await pool.end();}
