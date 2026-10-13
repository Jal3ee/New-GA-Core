import assert from 'node:assert/strict';
import express from 'express';
import { registerReimbursementAttachments } from '../server/reimbursementAttachments.js';
import { authenticateToken, createSessionToken } from '../server/auth.js';
import { parseReimbursementCSV, SPREADSHEET_CSV_URL } from '../src/utils/reimbursementSource.js';
const app=express(); registerReimbursementAttachments(app,authenticateToken);
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
try {
 const noAuth=await fetch(base+'/api/reimbursements/attachment/unlisted_file_123');assert.equal(noAuth.status,401);
 const token=createSessionToken({id:'verification',nik:'TEST',name:'Test',role:'admin',site:'ALL'});
 const headers={Authorization:'Bearer '+token};
 const unlisted=await fetch(base+'/api/reimbursements/attachment/unlisted_file_123',{headers}); assert.equal(unlisted.status,403);
 const response=await fetch(SPREADSHEET_CSV_URL,{signal:AbortSignal.timeout(20000)});
 const record=parseReimbursementCSV(await response.text())[0];
 const id=record.url_bukti_cuti.match(/id=([\w-]+)/)[1];
 const real=await fetch(base+'/api/reimbursements/attachment/'+id,{headers});
 assert([200,422,503].includes(real.status));
 if(real.status===422) assert((await real.json()).error.includes('service account'));
 if(real.status===503) assert((await real.json()).error.includes('Google Drive API belum aktif'));
 console.log('PASS: authentication required, unlisted Drive IDs blocked, actual Drive access status',real.status);
} finally {await new Promise(resolve=>server.close(resolve));}
