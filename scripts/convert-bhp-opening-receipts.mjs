import {pool} from '../server/db.js';
import {convertBhpOpeningToReceipts} from '../server/bhpOpeningReceiptMigration.js';
try {
  const [importId,mode]=process.argv.slice(2);
  if(!importId||mode!=='--apply')throw new Error('Usage: node scripts/convert-bhp-opening-receipts.mjs <audited-import-id> --apply');
  const result=await convertBhpOpeningToReceipts(pool,importId);
  const {receipts:_receipts,previous_initial_rows:_previous,...summary}=result;
  console.log(JSON.stringify(summary));
} finally {await pool.end();}
