import { reimbursementNikKey } from './reimbursementWorkflow.js';

export const REIMBURSEMENT_DOCUMENTS = [
  ['includeBoardingPass','url_boarding_pass','Boarding Pass'],
  ['includeBuktiCuti','url_bukti_cuti','Bukti Cuti Approve'],
  ['includeNotaBerangkat','url_nota_berangkat','Scan Nota Keberangkatan'],
  ['includeNotaPulang','url_nota_pulang','Bukti Nota Kepulangan']
];
// Source row numbers can move when the sheet is edited. Identity follows the submission.
export function reimbursementRecordKey(record) {
  return JSON.stringify([record.timestamp || record.id, reimbursementNikKey(record.nik), String(record.nama || '').trim().toLowerCase(), record.site || '']);
}
export function reimbursementDocuments(record, options={}) {
  const lumpsum=record.reimbursement_edit?.mode==='lumpsum';
  return REIMBURSEMENT_DOCUMENTS.filter(([option,field])=>options[option]!==false && !(lumpsum&&field==='url_nota_pulang'))
    .map(([option,field,label])=>({option,field,label:lumpsum&&field==='url_nota_berangkat'?'Lampiran Lumpsum':label}));
}
export async function reimbursementAttachmentHash(bytes) {
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function attachmentExcludedPages(record, field, id, hash, count) {
  const edit=record.reimbursement_edit?.excluded?.[field]?.[id];
  if(!edit?.pages?.length)return [];
  if(edit.hash!==hash || edit.count!==count)throw new Error('Isi file lampiran berubah. Tinjau ulang pilihan halaman di Kelola Lampiran.');
  if(edit.pages.some(page=>!Number.isInteger(page)||page<1||page>count))throw new Error('Pilihan halaman lampiran tidak valid.');
  return edit.pages;
}
