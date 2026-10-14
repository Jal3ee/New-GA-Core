import assert from 'node:assert/strict';
import express from 'express';
import { pool } from '../server/db.js';
import { authenticateToken, createSessionToken } from '../server/auth.js';
import { registerMessDrafts, MESS_DRAFT_SCHEMA } from '../server/messDraftService.js';
import { messDraftBaseline } from '../src/utils/messTransfer.js';
import { todayMakassar, addDays } from '../src/utils/bhpForecast.js';

const client = await pool.connect();
let server;
await client.query('BEGIN');
try {
  await client.query('SET LOCAL search_path TO pg_temp,public');
  for (const table of ['mess_stays','mess_buildings']) {
    await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING ALL) ON COMMIT DROP`);
    await client.query(`CREATE TEMP SEQUENCE ${table}_draft_test_ids`);
    await client.query(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT nextval('pg_temp.${table}_draft_test_ids')`);
  }
  await client.query(MESS_DRAFT_SCHEMA.replace('CREATE TABLE IF NOT EXISTS','CREATE TEMP TABLE'));
  await client.query('ALTER TABLE mess_stays ADD FOREIGN KEY (building_id) REFERENCES mess_buildings(id)');
  const building = (await client.query("INSERT INTO mess_buildings(name,site,room_config_json) VALUES('Draft test','LBCT',$1) RETURNING *",[JSON.stringify([{range_start:1,range_end:5,beds:1}])])).rows[0];
  const today=todayMakassar();
  const source=(await client.query("INSERT INTO mess_stays(building_id,room_number,bed_number,employee_name,check_in,status) VALUES($1,'K1','B1','Antok Subakti',$2,'Onsite') RETURNING *,check_in::text AS start_date,check_out::text AS end_date",[building.id,addDays(today,-7)])).rows[0];
  const transactionClient={
    async query(sql,args) {
      if(sql==='BEGIN') return client.query('SAVEPOINT draft_realization');
      if(sql==='COMMIT') return client.query('RELEASE SAVEPOINT draft_realization');
      if(sql==='ROLLBACK') { await client.query('ROLLBACK TO SAVEPOINT draft_realization'); return client.query('RELEASE SAVEPOINT draft_realization'); }
      return client.query(sql,args);
    }, release() {},
  };
  const app=express();app.use(express.json());
  registerMessDrafts(app,{ query:(...args)=>client.query(...args),pool:{connect:async()=>transactionClient},authenticateToken });
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/mess`;
  const token=createSessionToken({id:'qa',nik:'qa',name:'QA',role:'admin'});
  async function request(path,method='GET',body,auth=true) {
    const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,...await response.json()};
  }
  const payload=room=>({site:'LBCT',building_id:building.id,room_no:room,bed_no:'B1',guest_name:'Antok Subakti',status:'Onsite',start_date:today});
  const transfer={id:'move',type:'TRANSFER',stayId:source.id,tempId:'temp_move',payload:payload('K2'),desc:'Pindah Antok ke K2'};
  const input={name:'Minggu depan',site:'LBCT',planned_date:addDays(today,7),notes:'Menunggu approval GA Site',actions:[transfer],baseline:messDraftBaseline([transfer],[source])};
  assert.equal((await request('/drafts','GET',null,false)).status,401);
  assert.equal((await request('/drafts','POST',{...input,name:''})).status,400);
  let result=await request('/drafts','POST',input);assert.equal(result.status,200);
  let draft=result.data;assert.equal(draft.version,1);assert.equal(draft.planned_date,input.planned_date);
  assert.equal(Number((await client.query('SELECT count(*) FROM mess_stays')).rows[0].count),1);
  assert.equal((await request('/drafts')).data[0].id,draft.id);
  const reopened=(await request('/drafts/'+draft.id)).data;
  assert.deepEqual(reopened.actions,input.actions);assert.deepEqual(reopened.baseline,input.baseline);
  result=await request('/drafts/'+draft.id,'PUT',{...input,version:1,name:'Approved transfer',notes:'Approved'});assert.equal(result.status,200);draft=result.data;
  assert.equal((await request('/drafts/'+draft.id,'PUT',{...input,version:1})).status,409);
  assert.equal((await request('/drafts/'+draft.id,'DELETE',{version:1})).status,409);

  // A newly occupied target blocks the entire realization and preserves draft.
  const blocker=(await client.query("INSERT INTO mess_stays(building_id,room_number,bed_number,employee_name,check_in,status) VALUES($1,'K2','B1','New occupant',$2,'Onsite') RETURNING id",[building.id,today])).rows[0];
  assert.equal((await request('/simulation/realize','POST',{draft_id:draft.id,version:draft.version})).status,409);
  assert.equal((await client.query('SELECT check_out FROM mess_stays WHERE id=$1',[source.id])).rows[0].check_out,null);
  assert.equal((await request('/drafts/'+draft.id)).data.status,'draft');
  await client.query('DELETE FROM mess_stays WHERE id=$1',[blocker.id]);

  // Modified source records also block realization.
  await client.query("UPDATE mess_stays SET status='Leave' WHERE id=$1",[source.id]);
  assert.equal((await request('/simulation/realize','POST',{draft_id:draft.id,version:draft.version})).status,409);
  await client.query("UPDATE mess_stays SET status='Onsite' WHERE id=$1",[source.id]);

  result=await request('/simulation/realize','POST',{draft_id:draft.id,version:draft.version});assert.equal(result.status,200);assert.equal(result.data.realized_date,today);
  assert.equal((await request('/drafts')).data.length,0);
  assert.equal((await request('/simulation/realize','POST',{draft_id:draft.id,version:draft.version})).status,409);
  const active=(await client.query('SELECT * FROM mess_stays WHERE check_in <= $1 AND (check_out IS NULL OR check_out > $1)',[today])).rows;
  assert.equal(active.length,1);assert.equal(active[0].room_number,'K2');
  assert.equal((await client.query('SELECT status,realized_by FROM mess_simulation_drafts WHERE id=$1',[draft.id])).rows[0].realized_by,'qa');

  const checkin={id:'new',type:'CHECK_IN',tempId:'temp_new',payload:payload('K3')};
  const chain={id:'next',type:'TRANSFER',stayId:'temp_new',tempId:'temp_next',payload:payload('K4')};
  result=await request('/drafts','POST',{...input,name:'New placement',actions:[checkin,chain],baseline:[]});assert.equal(result.status,200);
  const chained=result.data;
  assert.equal((await request('/simulation/realize','POST',{draft_id:chained.id,version:1})).status,200);
  assert.equal(Number((await client.query("SELECT count(*) FROM mess_stays WHERE room_number='K3'")).rows[0].count),0);
  assert.equal(Number((await client.query("SELECT count(*) FROM mess_stays WHERE room_number='K4'")).rows[0].count),1);

  result=await request('/drafts','POST',{...input,name:'Delete test'});assert.equal(result.status,200);
  assert.equal((await request('/drafts/'+result.data.id,'DELETE',{version:1})).status,200);
  assert.equal((await request('/drafts/'+result.data.id)).status,404);

  // Invalid later target must not partially close a valid source stay.
  const invalid={id:'invalid',type:'CHECK_IN',tempId:'temp_invalid',payload:payload('K99')};
  const current=active[0];
  const currentTransfer={...transfer,id:'last',stayId:current.id,tempId:'temp_last',payload:payload('K5')};
  const beforeCount=Number((await client.query('SELECT count(*) FROM mess_stays')).rows[0].count);
  result=await request('/simulation/realize','POST',{site:'LBCT',actions:[currentTransfer,invalid],baseline:messDraftBaseline([currentTransfer],[{...current,start_date:today,end_date:null}])});
  assert.equal(result.status,409);
  assert.equal(Number((await client.query('SELECT count(*) FROM mess_stays')).rows[0].count),beforeCount);
  assert.equal((await client.query('SELECT check_out FROM mess_stays WHERE id=$1',[current.id])).rows[0].check_out,null);
  await client.query(`CREATE FUNCTION pg_temp.reject_test_stay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.employee_name='Reject test' THEN RAISE EXCEPTION 'Deliberate test insert failure'; END IF; RETURN NEW; END $$`);
  await client.query('CREATE TRIGGER reject_test_stay BEFORE INSERT ON mess_stays FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_test_stay()');
  const rejected={...currentTransfer,payload:{...currentTransfer.payload,guest_name:'Reject test'}};
  result=await request('/simulation/realize','POST',{site:'LBCT',actions:[rejected],baseline:messDraftBaseline([rejected],[{...current,start_date:today,end_date:null}])});
  assert.equal(result.status,500);
  assert.equal((await client.query('SELECT check_out FROM mess_stays WHERE id=$1',[current.id])).rows[0].check_out,null);
  assert.equal(Number((await client.query('SELECT count(*) FROM mess_stays')).rows[0].count),beforeCount);
  console.log('PASS: authenticated draft API, persistent reopen/edit/delete, planned date preservation, optimistic versions, source/target conflicts, atomic realization, prevention of double realization and chained placement. PostgreSQL temporary tables only; production data unchanged.');
} finally {
  if(server) await new Promise(resolve=>server.close(resolve));
  await client.query('ROLLBACK');client.release();await pool.end();
}
