import fs from 'node:fs/promises';
import {pool} from '../server/db.js';
import {migrateBhpQuantities} from '../server/bhpQuantityMigration.js';
if(!process.argv.includes('--apply'))throw new Error('Usage: node scripts/migrate-bhp-quantities.mjs --apply');
const client=await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('LOCK TABLE bhp_usage,bhp_stock_in,bhp_initial_stocks,bhp_transfers,bhp_opnames IN ACCESS EXCLUSIVE MODE');
  const before={};
  for(const table of ['bhp_usage','bhp_stock_in','bhp_initial_stocks','bhp_transfers','bhp_opnames'])before[table]=(await client.query(`SELECT * FROM ${table}`)).rows;
  await fs.mkdir('tmp/backups',{recursive:true});
  const backupPath=`tmp/backups/bhp-quantity-schema-${Date.now()}.json`;
  await fs.writeFile(backupPath,JSON.stringify(before,null,2));
  await migrateBhpQuantities((...args)=>client.query(...args));
  await client.query('COMMIT');console.log(JSON.stringify({precision:'NUMERIC(16,3)',backupPath}));
} catch(error){await client.query('ROLLBACK');throw error;}
finally{client.release();await pool.end();}
