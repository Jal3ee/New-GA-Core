import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import express from 'express';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {pool} from '../server/db.js';
import {authenticateToken,requireRole,createSessionToken} from '../server/auth.js';
import {registerReimbursementEdits,validateReimbursementEdit} from '../server/reimbursementEdits.js';
import {reimbursementRecordKey,reimbursementAttachmentHash} from '../src/utils/reimbursementEdits.js';
import {compileReimbursementPdf} from '../src/utils/reimbursementPdfCompiler.js';

const departure='https://drive.google.com/file/d/source-receipt-123456789/view',back='https://drive.google.com/file/d/return-receipt-123456789/view';
const record={id:'REIMB-QA-1',timestamp:'10/10/2026 10:00:00',nama:'ANTOK SUBAKTI',nik:'0262210037',site:'IDMG',departemen:'HCGA',periode_tahun:2026,periode_bulan:'Oktober',periode_ke:'Periode 1 (1-15)',url_nota_berangkat:departure,url_nota_pulang:back};
assert.equal(reimbursementRecordKey(record),reimbursementRecordKey({...record,id:'MOVED-ROW',nik:'262210037'}));
const source=await PDFDocument.create(),font=await source.embedFont(StandardFonts.Helvetica);
for(let i=1;i<=3;i++)source.addPage([400,600]).drawText(`SOURCE PAGE ${i}`,{x:30,y:530,font,size:24});
const bytes=await source.save(),hash=await reimbursementAttachmentHash(bytes);
const excluded={url_nota_berangkat:{'source-receipt-123456789':{hash,count:3,pages:[3]}}};
const options={includeCover:false,includeBoardingPass:false,includeBuktiCuti:false};
const revised={...record,reimbursement_edit:{mode:'lumpsum',excluded}};
let requests=[];
const load=async url=>{requests.push(url);return bytes;};
const blob=await compileReimbursementPdf({selectedRecords:[revised],options,loadAttachment:load});
assert.deepEqual(requests,[departure]);assert.equal((await PDFDocument.load(await blob.arrayBuffer())).getPageCount(),2);
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const pdfTask=getDocument({data:new Uint8Array(await blob.arrayBuffer())}),pdf=await pdfTask.promise;
for(let i=1;i<=2;i++){const text=(await(await pdf.getPage(i)).getTextContent()).items.map(item=>item.str).join(' ');assert(text.includes('Lampiran Lumpsum'));assert(text.includes(`SOURCE PAGE ${i}`));assert(!/Keberangkatan|Kepulangan|SOURCE PAGE 3/.test(text));}
await pdfTask.destroy();
await assert.rejects(()=>compileReimbursementPdf({selectedRecords:[{...revised,reimbursement_edit:{mode:'lumpsum',excluded:{url_nota_berangkat:{'source-receipt-123456789':{hash:'a'.repeat(64),count:3,pages:[3]}}}}}],options,loadAttachment:load}),/Isi file lampiran berubah/);
requests=[];const restored=await compileReimbursementPdf({selectedRecords:[{...record,reimbursement_edit:{mode:'actual',excluded:{}}}],options,loadAttachment:load});assert.equal((await PDFDocument.load(await restored.arrayBuffer())).getPageCount(),6);assert.equal(requests.length,2);
const removeReturn={...excluded,url_nota_pulang:{'return-receipt-123456789':{hash,count:3,pages:[1,2,3]}}};
const actual=await compileReimbursementPdf({selectedRecords:[{...record,reimbursement_edit:{mode:'actual',excluded:removeReturn}}],options,loadAttachment:load});assert.equal((await PDFDocument.load(await actual.arrayBuffer())).getPageCount(),2);
assert.throws(()=>validateReimbursementEdit({mode:'actual',revision:0,excluded:{url_nota_berangkat:{'not-in-source':{hash,count:3,pages:[1]}}}},record));
for(const pages of [[0],[4],[1,1]])assert.throws(()=>validateReimbursementEdit({mode:'actual',revision:0,excluded:{url_nota_berangkat:{'source-receipt-123456789':{hash,count:3,pages}}}},record));
await fs.mkdir('tmp/pdfs/reimbursement-edits',{recursive:true});await fs.writeFile('tmp/pdfs/reimbursement-edits/lumpsum.pdf',new Uint8Array(await blob.arrayBuffer()));await fs.writeFile('tmp/pdfs/reimbursement-edits/source-three-pages.pdf',bytes);

const client=await pool.connect();let server;
try{
  await client.query('BEGIN');
  await client.query("CREATE TEMP TABLE reimbursement_document_edits (record_key TEXT PRIMARY KEY,mode TEXT NOT NULL,excluded JSONB NOT NULL DEFAULT '{}',revision INTEGER NOT NULL DEFAULT 1,updated_by TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  const app=express();app.use(express.json());registerReimbursementEdits(app,{query:(...args)=>client.query(...args),authenticateToken,requireRole,loadRecords:async()=>[record]});
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const url=`http://127.0.0.1:${server.address().port}/api/reimbursements/document-edits`;
  const admin=createSessionToken({id:'qa',nik:'qa',role:'admin'}),pic=createSessionToken({id:'qa',nik:'qa',role:'pic_lapangan'});
  const request=async(method,token,data)=>{const res=await fetch(url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:res.status,json:await res.json()};};
  assert.equal((await request('GET')).status,401);
  const payload={record_key:reimbursementRecordKey(record),mode:'lumpsum',excluded,revision:0};
  assert.equal((await request('PUT',pic,payload)).status,403);
  const saved=await request('PUT',admin,payload);assert.equal(saved.status,200);assert.equal(saved.json.data.revision,1);assert.deepEqual(saved.json.data.excluded,excluded);
  assert.equal((await request('PUT',admin,payload)).status,409);
  assert.equal((await request('PUT',admin,{...payload,record_key:'unknown'})).status,400);
  const read=await request('GET',admin);assert.equal(read.json.data[payload.record_key].mode,'lumpsum');
  const changed=await request('PUT',admin,{...payload,mode:'actual',excluded:{},revision:1});assert.equal(changed.status,200);assert.equal(changed.json.data.revision,2);assert.deepEqual(changed.json.data.excluded,{});
}finally{if(server)await new Promise(resolve=>server.close(resolve));await client.query('ROLLBACK');client.release();await pool.end();}
console.log('PASS: lumpsum source/labels, page 3 exclusion, restore, entire duplicate-file exclusion, source-change detection, stable identity, protected persistence, validation and concurrent edit rejection. DB writes rolled back.');
