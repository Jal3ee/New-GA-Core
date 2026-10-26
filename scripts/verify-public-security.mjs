import assert from 'node:assert/strict';
import express from 'express';
import {pool} from '../server/db.js';
import {createSessionToken,verifySessionToken,verifyPassword} from '../server/auth.js';
import {createPublicRateLimit,trustedClientIp} from '../server/publicRateLimit.js';
process.env.VERCEL='1';
const {default:app}=await import('../server/index.js');
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const url='http://127.0.0.1:'+server.address().port;
async function request(path,{method='GET',data,token,origin}={}){const response=await fetch(url+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},...(data?{body:JSON.stringify(data)}:{})});return {status:response.status,data:await response.json(),headers:response.headers};}
let client,rateServer;
try{
  for(const [path,method,data] of [
    ['/api/reimbursements/period-status','GET'],['/api/reimbursements/document-edits','GET'],['/api/reimbursements/attachment/unlisted_file_123','GET'],['/api/bhp/data','GET'],['/api/bhp/usage','POST',{entries:[]}],['/api/auth/token','POST',{nik:'123456'}],['/api/upload','POST',{}],['/api/notifications/whatsapp','POST',{}],['/api/cron/check-expiring','GET'],
    ...['GET_USERS','GET_REIMBURSEMENTS','CREATE_USER','DELETE_USER','DELETE_INVOICE','BATCH_UPDATE_STAYS'].map(action=>['/api/action','POST',{action}])
  ]) assert.equal((await request(path,{method,data})).status,401,path+' must require authentication');
  const attackerToken='eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYWRtaW4ifQ.invalid';
  assert.equal(verifySessionToken(attackerToken).valid,false);
  assert.equal((await request('/api/action',{method:'POST',token:attackerToken,data:{action:'GET_USERS'}})).status,401);
  const admin=createSessionToken({id:'security-qa',nik:'security-qa',role:'admin'}),pic=createSessionToken({id:'security-qa',nik:'security-qa',role:'pic_lapangan'});
  assert.equal((await request('/api/auth/me',{token:admin})).status,200);
  assert.equal((await request('/api/action',{method:'POST',token:pic,data:{action:'CREATE_USER'}})).status,403);
  assert.equal((await request('/api/public/reimbursements/lookup',{method:'POST',origin:'https://attacker.example',data:{nik:'123456'}})).status,403);
  assert.equal(verifyPassword('random-password','demo_hash_agm'),false);assert.equal(verifyPassword(undefined,'demo_hash_agm'),false);
  const large=await request('/api/public/reimbursements/lookup',{method:'POST',data:{nik:'1'.repeat(3000)}});assert.equal(large.status,413);assert(!JSON.stringify(large.data).includes('stack'));
  const health=await request('/api/health');assert.equal(health.status,200);assert(!JSON.stringify(health.data).includes('databaseName'));
  client=await pool.connect();await client.query('BEGIN');await client.query('CREATE TEMP TABLE public_api_rate_limits(bucket TEXT PRIMARY KEY,hits INTEGER NOT NULL,expires_at TIMESTAMPTZ NOT NULL)');
  const rateApp=express();rateApp.use(express.json());
  const query=(...args)=>client.query(...args),first=createPublicRateLimit(query),second=createPublicRateLimit(query);let alternate=false;
  delete process.env.VERCEL;
  rateApp.post('/lookup',(req,res,next)=>{alternate=!alternate;(alternate?first:second)(req,res,next);},(_req,res)=>res.json({ok:true}));rateServer=rateApp.listen(0,'127.0.0.1');await new Promise(resolve=>rateServer.once('listening',resolve));
  assert.equal(trustedClientIp({headers:{'x-forwarded-for':'9.9.9.9'},socket:{remoteAddress:'127.0.0.1'}}),'127.0.0.1');
  for(let i=0;i<31;i++){const response=await fetch('http://127.0.0.1:'+rateServer.address().port+'/lookup',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':`10.0.0.${i}`},body:JSON.stringify({nik:'99999999999999999999'})});assert.equal(response.status,i<30?200:429);if(i===30)assert(response.headers.get('Retry-After'));}
  console.log('PASS: private API deny-by-default, token minting blocked, forged JWT rejected, admin authorization, cron protection, CORS origin rejection, body-size limit, demo-password bypass removed, non-sensitive health, durable rate limit shared by instances and spoofed-IP resistance. No operational mutations.');
}finally{if(rateServer)await new Promise(resolve=>rateServer.close(resolve));await new Promise(resolve=>server.close(resolve));if(client){await client.query('ROLLBACK');client.release();}await pool.end();}
