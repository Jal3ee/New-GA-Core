import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import express from 'express';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {PDFDocument} from 'pdf-lib';
import {registerReimbursementAttachments} from '../server/reimbursementAttachments.js';
import {authenticateToken,createSessionToken} from '../server/auth.js';
import {parseReimbursementCSV,SPREADSHEET_CSV_URL} from '../src/utils/reimbursementSource.js';
import {compileReimbursementPdf,extractDriveFileId,splitAttachmentUrls} from '../src/utils/reimbursementPdfCompiler.js';
const app=express();registerReimbursementAttachments(app,authenticateToken);
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
try {
 const records=parseReimbursementCSV(await(await fetch(SPREADSHEET_CSV_URL,{signal:AbortSignal.timeout(20000)})).text());
 const selectedRecords=records.filter(r=>r.periode_tahun===2026&&r.periode_bulan==='Oktober'&&r.periode_ke==='Periode 1 (1-15)');
 assert(selectedRecords.length >= 11);
 const token=createSessionToken({id:'verification',nik:'TEST',name:'Test',role:'admin',site:'ALL'});
 const urls=[...new Set(selectedRecords.flatMap(r=>['url_boarding_pass','url_bukti_cuti','url_nota_berangkat','url_nota_pulang'].flatMap(k=>splitAttachmentUrls(r[k]))))];
 const cache=new Map();let position=0;let downloaded=0;const formats={};
 await Promise.all(Array.from({length:4},async()=>{
  while(position<urls.length){
   const url=urls[position++];const id=extractDriveFileId(url);
   const response=await fetch(base+'/api/reimbursements/attachment/'+id,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000)});
   if(!response.ok){const data=await response.json();throw new Error('Drive attachment HTTP '+response.status+': '+data.error);}
   let bytes=new Uint8Array(await response.arrayBuffer());
   const format=String.fromCharCode(...bytes.slice(0,5))==='%PDF-'?'PDF':bytes[0]===137?'PNG':bytes[0]===255?'JPEG':'OTHER';
   formats[format]=(formats[format]||0)+1;
   if(format==='OTHER') {const image=await loadImage(Buffer.from(bytes));const canvas=createCanvas(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);bytes=new Uint8Array(canvas.toBuffer('image/png'));}
   cache.set(url,bytes);downloaded++;console.log('Downloaded '+downloaded+'/'+urls.length+' ('+format+')');
  }
 }));
 const blob=await compileReimbursementPdf({selectedRecords,options:{periodLabel:'Oktober 2026 - Periode 1 (1-15)'},loadAttachment:async url=>cache.get(url)});
 const bytes=new Uint8Array(await blob.arrayBuffer());const pdf=await PDFDocument.load(bytes);assert(pdf.getPageCount()>=45);
 await fs.mkdir('output/pdf',{recursive:true});await fs.mkdir('tmp/pdfs/reimbursement-live',{recursive:true});
 const output='output/pdf/Rekap_Reimbursement_Oktober_2026_Periode_1.pdf';await fs.writeFile(output,bytes);
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const loading=getDocument({data:bytes,wasmUrl:fileURLToPath(new URL('../node_modules/pdfjs-dist/wasm/',import.meta.url)).replaceAll('\\','/'),standardFontDataUrl:fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url)).replaceAll('\\','/')});const rendered=await loading.promise;
 const sheets=[];let sheet,ctx;
 for(let i=1;i<=rendered.numPages;i++){
  const page=await rendered.getPage(i);const viewport=page.getViewport({scale:1.3});const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
  await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  if(i<=6)await fs.writeFile('tmp/pdfs/reimbursement-live/page-'+i+'.png',canvas.toBuffer('image/png'));
  const text=(await page.getTextContent()).items.map(item=>item.str).join(' ');
  assert(text.includes('Oktober 2026'));assert(text.includes('NIK'));
  assert(Math.abs(page.view[2]-page.view[0]-595.28)<0.1);assert(Math.abs(page.view[3]-page.view[1]-841.89)<0.1);
  const local=(i-1)%12;if(local===0){sheet=createCanvas(1600,2350);ctx=sheet.getContext('2d');ctx.fillStyle='#e2e8f0';ctx.fillRect(0,0,1600,2350);sheets.push(sheet);}
  const x=(local%4)*400+10;const y=Math.floor(local/4)*780+25;ctx.drawImage(canvas,x,y,380,537);ctx.fillStyle='#000000';ctx.font='18px sans-serif';ctx.fillText('Halaman '+i,x,y+562);
 }
 for(let i=0;i<sheets.length;i++)await fs.writeFile('tmp/pdfs/reimbursement-live/contact-'+(i+1)+'.png',sheets[i].toBuffer('image/png'));
 await loading.destroy();
 const summary={period:'Oktober 2026 Periode 1',records:selectedRecords.length,attachments:downloaded,formats,pages:pdf.getPageCount(),output};
 await fs.writeFile('tmp/pdfs/reimbursement-live/result.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
} finally {await new Promise(resolve=>server.close(resolve));}
