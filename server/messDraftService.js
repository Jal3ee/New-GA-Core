import { randomUUID } from 'node:crypto';
import { buildMessTransferBatch, messDraftBaseline, messStaySnapshot } from '../src/utils/messTransfer.js';
import { todayMakassar } from '../src/utils/bhpForecast.js';

export const MESS_DRAFT_SCHEMA = `CREATE TABLE IF NOT EXISTS mess_simulation_drafts (
  id UUID PRIMARY KEY, name VARCHAR(120) NOT NULL, site VARCHAR(20) NOT NULL,
  planned_date DATE NOT NULL, notes TEXT NOT NULL DEFAULT '', actions JSONB NOT NULL,
  baseline JSONB NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','realized')),
  created_by VARCHAR(100) NOT NULL, updated_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  realized_at TIMESTAMPTZ, realized_by VARCHAR(100)
);`;

class DraftError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const fail = message => { throw new DraftError(message); };
const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const dto = row => ({ ...row, planned_date: row.planned_date instanceof Date ? row.planned_date.toISOString().slice(0,10) : String(row.planned_date).slice(0,10) });

function validate(input, metadata = true) {
  if (!input || !['LBCT','IDMG','SPCT'].includes(input.site)) fail('Site draf tidak valid.');
  if (metadata && (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120 || !validDay(input.planned_date) || typeof (input.notes ?? '') !== 'string' || (input.notes || '').length > 2000)) fail('Isi nama, tanggal rencana, dan catatan draf dengan benar.');
  if (!Array.isArray(input.actions) || !input.actions.length || input.actions.length > 1000 || !Array.isArray(input.baseline)) fail('Draf harus berisi perubahan simulasi.');
  const ids = new Set(), temporary = new Set();
  for (const action of input.actions) {
    if (!action || !['CHECK_IN','TRANSFER','CHECK_OUT'].includes(action.type) || typeof action.id !== 'string' || ids.has(action.id)) fail('Urutan aksi draf tidak valid.');
    ids.add(action.id);
    if (action.type !== 'CHECK_IN') {
      if (String(action.stayId).startsWith('temp_')) {
        if (!temporary.delete(String(action.stayId))) fail('Draf penghuni sumber tidak ditemukan.');
      } else if (!/^[1-9]\d*$/.test(String(action.stayId))) fail('ID penghuni tidak valid.');
    }
    if (action.type !== 'CHECK_OUT') {
      const p = action.payload;
      if (typeof action.tempId !== 'string' || !action.tempId.startsWith('temp_') || temporary.has(action.tempId) || !p || p.site !== input.site || !/^[1-9]\d*$/.test(String(p.building_id)) || !/^K[1-9]\d*$/.test(p.room_no) || !/^B[1-9]\d*$/.test(p.bed_no) || typeof p.guest_name !== 'string' || !p.guest_name.trim() || p.guest_name.length > 200 || !['Onsite','Leave','On Leave','Active'].includes(p.status)) fail('Data kamar atau penghuni draf tidak valid.');
      temporary.add(action.tempId);
    }
  }
  const batch = buildMessTransferBatch(input.actions, todayMakassar());
  const baseline = messDraftBaseline(input.actions, input.baseline);
  if (batch.filter(a => a.type === 'UPDATE').some(a => !baseline.some(s => s.id === String(a.id)))) fail('Data awal penghuni tidak lengkap. Muat ulang simulasi.');
  return { ...input, name: input.name?.trim(), baseline };
}

export function registerMessDrafts(app, { query, pool, authenticateToken }) {
  let ready;
  const ensure = () => ready ||= query(MESS_DRAFT_SCHEMA).catch(error => { ready = null; throw error; });
  const route = handler => async (req, res) => {
    res.set('Cache-Control','no-store');
    try { await ensure(); await handler(req, res); }
    catch (error) {
      console.error('[Mess drafts]', error.message);
      res.status(error.status || 500).json({ ok: false, error: error.status ? error.message : 'Draf belum dapat diproses. Silakan coba kembali.' });
    }
  };
  app.get('/api/mess/drafts', authenticateToken, route(async (req,res) => {
    const result = await query("SELECT id,name,site,planned_date::text,notes,status,version,created_by,updated_by,created_at,updated_at,realized_at,jsonb_array_length(actions) AS action_count FROM mess_simulation_drafts WHERE status='draft' ORDER BY updated_at DESC");
    res.json({ ok:true, data:result.rows.map(dto) });
  }));
  app.get('/api/mess/drafts/:id', authenticateToken, route(async (req,res) => {
    if (!validId(req.params.id)) fail('ID draf tidak valid.');
    const row = (await query("SELECT *,planned_date::text AS planned_date FROM mess_simulation_drafts WHERE id=$1 AND status='draft'",[req.params.id])).rows[0];
    if (!row) throw new DraftError('Draf sudah dihapus atau direalisasikan.',404);
    res.json({ ok:true,data:dto(row) });
  }));
  app.post('/api/mess/drafts', authenticateToken, route(async (req,res) => {
    const input=validate(req.body), actor=String(req.user.nik);
    const row=(await query('INSERT INTO mess_simulation_drafts(id,name,site,planned_date,notes,actions,baseline,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *,planned_date::text AS planned_date',[randomUUID(),input.name,input.site,input.planned_date,input.notes||'',JSON.stringify(input.actions),JSON.stringify(input.baseline),actor])).rows[0];
    res.json({ok:true,data:dto(row)});
  }));
  app.put('/api/mess/drafts/:id', authenticateToken, route(async (req,res) => {
    if (!validId(req.params.id) || !Number.isInteger(req.body.version)) fail('Versi draf tidak valid.');
    const input=validate(req.body);
    const row=(await query("UPDATE mess_simulation_drafts SET name=$2,site=$3,planned_date=$4,notes=$5,actions=$6,baseline=$7,updated_by=$8,updated_at=NOW(),version=version+1 WHERE id=$1 AND version=$9 AND status='draft' RETURNING *,planned_date::text AS planned_date",[req.params.id,input.name,input.site,input.planned_date,input.notes||'',JSON.stringify(input.actions),JSON.stringify(input.baseline),String(req.user.nik),input.version])).rows[0];
    if(!row) throw new DraftError('Draf telah berubah. Buka ulang versi terbaru sebelum menyimpan.',409);
    res.json({ok:true,data:dto(row)});
  }));
  app.delete('/api/mess/drafts/:id', authenticateToken, route(async (req,res) => {
    if (!validId(req.params.id) || !Number.isInteger(req.body.version)) fail('Versi draf tidak valid.');
    const result=await query("DELETE FROM mess_simulation_drafts WHERE id=$1 AND version=$2 AND status='draft' RETURNING id",[req.params.id,req.body.version]);
    if(!result.rows.length) throw new DraftError('Draf telah berubah atau tidak tersedia. Muat ulang daftar draf.',409);
    res.json({ok:true});
  }));

  app.post('/api/mess/simulation/realize', authenticateToken, route(async(req,res) => {
    const client=await pool.connect();
    try {
      await client.query('BEGIN');
      let input, draft;
      if(req.body.draft_id) {
        if(!validId(req.body.draft_id)||!Number.isInteger(req.body.version)) fail('Versi draf tidak valid.');
        draft=(await client.query("SELECT * FROM mess_simulation_drafts WHERE id=$1 FOR UPDATE",[req.body.draft_id])).rows[0];
        if(!draft||draft.status!=='draft'||draft.version!==req.body.version) throw new DraftError('Draf telah berubah atau sudah direalisasikan. Buka ulang draf.',409);
        input=validate(draft,false);
      } else input=validate(req.body,false);
      // All mess writers are serialized while checking and applying occupancy.
      await client.query('LOCK TABLE mess_buildings IN SHARE MODE');
      await client.query('LOCK TABLE mess_stays IN SHARE ROW EXCLUSIVE MODE');
      const today=todayMakassar();
      const stays=(await client.query("SELECT *,check_in::text AS start_date,check_out::text AS end_date FROM mess_stays WHERE check_in <= $1::date AND (check_out IS NULL OR check_out > $1::date)",[today])).rows;
      const batch=buildMessTransferBatch(input.actions,today);
      for(const act of batch.filter(a=>a.type==='UPDATE')) {
        const original=input.baseline.find(s=>s.id===String(act.id));
        const current=stays.find(s=>String(s.id)===String(act.id));
        if(!current||JSON.stringify(messStaySnapshot(current))!==JSON.stringify(original)) throw new DraftError('Data penghuni sumber sudah berubah sejak draf dibuat. Periksa dan edit kembali simulasi.',409);
      }
      const buildings=(await client.query('SELECT * FROM mess_buildings WHERE site=$1',[input.site])).rows;
      if (batch.filter(a=>a.type==='UPDATE').some(a=>!buildings.some(b=>String(b.id)===stays.find(s=>String(s.id)===String(a.id))?.building_id?.toString()))) fail('Penghuni sumber berada di site lain.');
      const removed=new Set(batch.filter(a=>a.type==='UPDATE').map(a=>String(a.id)));
      const bedKey=p=>`${p.building_id}:${p.room_no??p.room_number}:${p.bed_no??p.bed_number}`;
      const occupied=new Set(stays.filter(s=>!removed.has(String(s.id))).map(bedKey));
      for(const act of batch.filter(a=>a.type==='CREATE')) {
        const p=act.payload, building=buildings.find(b=>String(b.id)===String(p.building_id));
        const room=Number(p.room_no.slice(1)),bed=Number(p.bed_no.slice(1));
        if(!building||!Array.isArray(building.room_config_json)||!building.room_config_json.some(c=>room >= (Number(c.range_start)||1)&&room <= (Number(c.range_end)||Number(c.range_start)||1)&&bed <= (Number(c.beds)||1))) throw new DraftError('Kamar tujuan sudah berubah atau tidak tersedia. Edit kembali simulasi.',409);
        if(occupied.has(bedKey(p))) throw new DraftError('Kamar tujuan sudah terisi. Edit draf dan pilih kasur lain.',409);
        occupied.add(bedKey(p));
      }
      for(const act of batch) {
        if(act.type==='UPDATE') await client.query('UPDATE mess_stays SET check_out=$1,updated_at=NOW() WHERE id=$2',[today,act.id]);
        else {
          const p=act.payload;
          await client.query('INSERT INTO mess_stays(building_id,room_number,bed_number,employee_name,check_in,status,notes) VALUES($1,$2,$3,$4,$5,$6,$7)',[p.building_id,p.room_no,p.bed_no,p.guest_name,today,p.status,p.notes||null]);
        }
      }
      if(draft) await client.query("UPDATE mess_simulation_drafts SET status='realized',realized_at=NOW(),realized_by=$2,updated_by=$2,updated_at=NOW(),version=version+1 WHERE id=$1",[draft.id,String(req.user.nik)]);
      await client.query('COMMIT');
      res.json({ok:true,data:{actions_count:batch.length,realized_date:today}});
    } catch(error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }));
}
