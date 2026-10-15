import { loadReimbursementRecords } from './reimbursementRecords.js';
import { reimbursementRecordKey, REIMBURSEMENT_DOCUMENTS } from '../src/utils/reimbursementEdits.js';

export function validateReimbursementEdit(data, record) {
  if(!data || !['actual','lumpsum'].includes(data.mode) || !Number.isSafeInteger(data.revision) || data.revision<0)throw new Error('Jenis reimbursement atau versi perubahan tidak valid.');
  const input=data.excluded;
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('Pilihan halaman tidak valid.');
  const excluded={};
  for(const [field,files] of Object.entries(input)){
    if(!REIMBURSEMENT_DOCUMENTS.some(doc=>doc[1]===field) || !files || typeof files!=='object' || Array.isArray(files) || Object.keys(files).length>30)throw new Error('Jenis lampiran tidak valid.');
    const allowed=new Set([...String(record[field] || '').matchAll(/(?:[?&]id=|\/d\/)([\w-]+)/g)].map(match=>match[1]));
    excluded[field]={};
    for(const [id,edit] of Object.entries(files)){
      if(!allowed.has(id) || !edit || !/^[a-f0-9]{64}$/.test(edit.hash) || !Number.isSafeInteger(edit.count) || edit.count<1 || edit.count>10000 || !Array.isArray(edit.pages) || edit.pages.length>edit.count || edit.pages.some(page=>!Number.isInteger(page)||page<1||page>edit.count) || new Set(edit.pages).size!==edit.pages.length)throw new Error('Nomor halaman atau identitas file tidak valid.');
      if(edit.pages.length)excluded[field][id]={hash:edit.hash,count:edit.count,pages:[...edit.pages].sort((a,b)=>a-b)};
    }
  }
  return {mode:data.mode,excluded};
}
export function registerReimbursementEdits(app,{query,authenticateToken,requireRole,loadRecords=loadReimbursementRecords}){
  let ready;
  const ensure=()=>ready ||= query(`CREATE TABLE IF NOT EXISTS reimbursement_document_edits (record_key TEXT PRIMARY KEY, mode TEXT NOT NULL CHECK (mode IN ('actual','lumpsum')), excluded JSONB NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 1, updated_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`).catch(error=>{ready=null;throw error;});
  app.get('/api/reimbursements/document-edits',authenticateToken,async(_req,res)=>{
    res.set('Cache-Control','no-store');
    try{await ensure();const result=await query('SELECT * FROM reimbursement_document_edits');return res.json({ok:true,data:Object.fromEntries(result.rows.map(row=>[row.record_key,row]))});}
    catch(error){console.error('[Reimbursement edits]',error.message);return res.status(503).json({ok:false,error:'Pengaturan lampiran belum dapat dimuat. Coba kembali sebelum membuat rekap.'});}
  });
  app.put('/api/reimbursements/document-edits',authenticateToken,requireRole('admin','ga_admin','ga_gl','ga_sh','finance'),async(req,res)=>{
    try{
      const key=req.body?.record_key;
      if(typeof key!=='string'||key.length>1500)return res.status(400).json({ok:false,error:'Identitas pengajuan tidak valid.'});
      const record=(await loadRecords()).find(row=>reimbursementRecordKey(row)===key);
      if(!record)return res.status(400).json({ok:false,error:'Pengajuan tidak ditemukan pada spreadsheet sumber. Sinkronkan ulang.'});
      let edit;
      try{edit=validateReimbursementEdit(req.body,record);}catch(error){return res.status(400).json({ok:false,error:error.message});}
      await ensure();
      const result=await query(`INSERT INTO reimbursement_document_edits(record_key,mode,excluded,updated_by) SELECT $1,$2,$3::jsonb,$4 WHERE $5::integer=0 OR EXISTS(SELECT 1 FROM reimbursement_document_edits WHERE record_key=$1) ON CONFLICT(record_key) DO UPDATE SET mode=EXCLUDED.mode, excluded=EXCLUDED.excluded, updated_by=EXCLUDED.updated_by, revision=reimbursement_document_edits.revision+1,updated_at=NOW() WHERE reimbursement_document_edits.revision=$5 RETURNING *`,[key,edit.mode,JSON.stringify(edit.excluded),String(req.user.nik || req.user.id),req.body.revision]);
      if(!result.rows.length)return res.status(409).json({ok:false,error:'Pengaturan telah diubah pengguna lain. Tutup dan buka kembali Kelola Lampiran sebelum menyimpan.'});
      return res.json({ok:true,data:result.rows[0]});
    }catch(error){console.error('[Reimbursement edits]',error.message);return res.status(503).json({ok:false,error:'Pengaturan lampiran belum tersimpan. Silakan coba kembali.'});}
  });
}
