import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Optional live smoke test. Credentials arrive on stdin; never log or save them.
if(process.stdin.isTTY)throw new Error('Provide authorized e-Req login JSON through stdin.');
let input='';for await(const chunk of process.stdin)input+=chunk;
const credentials=JSON.parse(input);input='';
assert.ok(credentials.email && credentials.password,'Authorized e-Req credentials required.');
const moduleName=process.env.BHP_PLAYWRIGHT_MODULE || 'playwright';
const {chromium}=await import(path.isAbsolute(moduleName)?pathToFileURL(moduleName).href:moduleName);
const tempRoot=path.resolve('tmp/ereq-browser-qa');await fs.mkdir(tempRoot,{recursive:true});
const profile=await fs.mkdtemp(path.join(tempRoot,'run-'));
const extension=path.join(profile,'extension');await fs.cp('browser-extension/ga-core-ereq',extension,{recursive:true});await fs.copyFile('src/utils/bhpEreq.js',path.join(extension,'bhpEreq.js'));
const context=await chromium.launchPersistentContext(path.join(profile,'browser'),{
  ...(process.env.BHP_BROWSER_PATH?{executablePath:process.env.BHP_BROWSER_PATH}:{}),headless:true,
  args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]
});
try {
  const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  await worker.evaluate(credentials=>chrome.storage.session.set({credentials}),credentials);
  // Source transport is isolated from GA Core production and cannot write its DB.
  await context.route('http://localhost:5174/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>GA Core transport QA</body></html>'}));
  const source=await context.newPage();await source.goto('http://localhost:5174/');
  const ask=(type,draft)=>source.evaluate(({type,draft})=>new Promise((resolve,reject)=>{
    const requestId=crypto.randomUUID(),timer=setTimeout(()=>reject(new Error('Bridge timeout')),20000);
    const listener=event=>{if(event.data?.source==='GA_CORE_EREQ_EXTENSION'&&event.data.requestId===requestId){clearTimeout(timer);window.removeEventListener('message',listener);resolve(event.data);}};
    window.addEventListener('message',listener);window.postMessage({source:'GA_CORE_EREQ',type,requestId,draft},location.origin);
  }),{type,draft});
  assert.equal((await ask('PING')).ok,true);
  const draft={version:1,site:'IDMG',department:'HCGA',purpose:'PENGADAAN BARU',exchange_rate:16500,cutoff:'2026-10-12',forecast_to:'2026-11-30',rows:[{type:'IR',code:'28573',part_number:'IPN-BHP-00036',stock_class:'P',mnemonic:'WINGS',name:'TEST QA AUTO EREQ',unit:'PACK',qty:2,price_idr:165000}]};
  const popupEvent=context.waitForEvent('page');assert.equal((await ask('OPEN',draft)).ok,true);const popup=await popupEvent;
  await popup.waitForURL('https://e-requisition-test.vercel.app/**');
  let completed=false;
  for(let i=0;i<90;i++){
    const pending=await worker.evaluate(async()=>Object.keys(await chrome.storage.session.get(null)).some(key=>key.startsWith('job:')));
    if(!pending){completed=true;break;}
    await popup.waitForTimeout(1000);
  }
  assert.equal(completed,true,'Autofill did not finish verification.');
  assert.equal(await popup.locator('[name=department]').inputValue(),'AGM - HCGA');
  assert.equal(await popup.locator('[name=RequirementReasonInput]').inputValue(),'');
  assert.equal(await popup.locator('[name=dateRequest]').inputValue(),'');
  const data=await popup.evaluate(()=>JSON.parse(localStorage.getItem('request-item-storage')).state);
  assert.equal(data.prItems.length,0);assert.equal(data.irItems.length,1);assert.equal(data.irItems[0].quantity,2);assert.equal(data.irItems[0].estimatedUnitPriceBeforeTax,10);assert.equal(data.irItems[0].partNumber,'IPN-BHP-00036');assert.equal(data.irItems[0].stockClass,'P');
  const quantity=popup.locator('tr').filter({has:popup.locator('input[type=number]:not([readonly])')}).first().locator('input[type=number]');await quantity.fill('3');await popup.locator('[name=woNumber]').click();
  assert.equal(await popup.evaluate(()=>JSON.parse(localStorage.getItem('request-item-storage')).state.irItems[0].quantity),3);
  console.log('PASS: installed MV3 extension, source bridge, popup, automatic login, IR form hydration, price/quantity, manual editing and job cleanup. No print or requisition submission.');
} finally {
  await context.close();
  const resolved=path.resolve(profile);
  if(!resolved.startsWith(tempRoot+path.sep))throw new Error('QA cleanup target escaped its workspace directory.');
  await fs.rm(resolved,{recursive:true,force:true});
}
