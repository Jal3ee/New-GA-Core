import {useEffect,useRef,useState} from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {X,Trash2,RotateCcw} from 'lucide-react';
import {reimbursementClient} from '../../lib/reimbursementClient';
import {extractDriveFileId,splitAttachmentUrls,fetchReimbursementAttachment} from '../../utils/reimbursementPdfCompiler';
import {reimbursementRecordKey,reimbursementDocuments,reimbursementAttachmentHash} from '../../utils/reimbursementEdits';

pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
function Thumbnail({asset,page}){
  const ref=useRef(null);
  useEffect(()=>{
    if(!asset.pdf)return;
    let active=true,task;
    asset.pdf.getPage(page).then(pdfPage=>{
      if(!active)return;
      const viewport=pdfPage.getViewport({scale:220/pdfPage.getViewport({scale:1}).width});
      const canvas=ref.current;canvas.width=viewport.width;canvas.height=viewport.height;
      task=pdfPage.render({canvasContext:canvas.getContext('2d'),viewport});return task.promise;
    }).catch(error=>{if(active&&error.name!=='RenderingCancelledException')console.warn('Preview lampiran:',error.message);});
    return()=>{active=false;task?.cancel();};
  },[asset,page]);
  return asset.pdf?<canvas ref={ref} className="w-full h-auto"/>:<img src={asset.url} alt={`Lampiran halaman ${page}`} className="w-full h-auto object-contain"/>;
}
function AttachmentFile({field,label,url,excluded,onChange,busy}){
  const [asset,setAsset]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[warning,setWarning]=useState(''),[offset,setOffset]=useState(0);
  const resources=useRef([]),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;for(const asset of resources.current){asset.task?.destroy();if(asset.url)URL.revokeObjectURL(asset.url);}};},[]);
  const id=extractDriveFileId(url),saved=excluded[field]?.[id],pages=saved?.pages || [];
  const load=async()=>{
    setLoading(true);setError('');
    try{
      const bytes=await fetchReimbursementAttachment(url),hash=await reimbursementAttachmentHash(bytes);
      const isPdf=String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
      const task=isPdf?pdfjs.getDocument({data:bytes.slice()}):null;
      const pdf=task?await task.promise:null;
      const result={pdf,task,count:pdf?.numPages || 1,hash,url:pdf?null:URL.createObjectURL(new Blob([bytes]))};
      resources.current.push(result);
      if(!mounted.current){task?.destroy();if(result.url)URL.revokeObjectURL(result.url);return;}
      setAsset(result);
      const changed=saved&&(saved.hash!==hash||saved.count!==result.count);
      if(changed)setWarning('Isi file berubah sejak pengeditan terakhir. Pilihan halaman lama telah dibersihkan untuk file ini; periksa kembali sebelum menyimpan.');
      onChange(field,id,{hash,count:result.count,pages:changed?[]:pages});
    }catch(failure){if(mounted.current)setError(failure.message);}finally{if(mounted.current)setLoading(false);}
  };
  const toggle=page=>onChange(field,id,{hash:asset.hash,count:asset.count,pages:pages.includes(page)?pages.filter(value=>value!==page):[...pages,page].sort((a,b)=>a-b)});
  return <section className="rounded-lg border border-[var(--border)] p-3 space-y-3"><div className="flex flex-wrap justify-between gap-2 text-xs"><div><strong>{label}</strong><a href={url} target="_blank" rel="noreferrer" className="ml-3 underline text-teal-700">Buka file asli</a>{pages.length>0&&<p className="mt-1 text-red-700">Dikeluarkan: halaman {pages.join(', ')}</p>}</div>{!asset&&<button type="button" disabled={loading||busy} className="rounded border border-[var(--border)] px-3 py-1" onClick={load}>{loading?'Memuat...':'Preview & pilih halaman'}</button>}</div>
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}{warning&&<p className="text-xs text-amber-700">{warning}</p>}
    {asset&&<><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({length:Math.min(12,asset.count-offset)},(_,index)=>offset+index+1).map(page=><div key={page} className={`rounded-lg border p-2 ${pages.includes(page)?'border-red-400 bg-red-50':'border-[var(--border)]'}`}><div className={`max-h-80 overflow-y-auto bg-white ${pages.includes(page)?'opacity-40':''}`}><Thumbnail asset={asset} page={page}/></div><div className="mt-2 flex justify-between items-center text-xs"><span>Halaman {page}{pages.includes(page)?' · Dikeluarkan':''}</span><button type="button" disabled={busy} aria-label={`${pages.includes(page)?'Pulihkan':'Keluarkan'} halaman ${page} ${label}`} onClick={()=>toggle(page)} className={`flex items-center gap-1 rounded px-2 py-1 ${pages.includes(page)?'text-teal-800 bg-teal-50':'text-red-700 bg-red-50'}`}>{pages.includes(page)?<RotateCcw size={13}/>:<Trash2 size={13}/>} {pages.includes(page)?'Pulihkan':'Keluarkan'}</button></div></div>)}</div>{asset.count>12&&<div className="flex items-center gap-3 text-xs"><button type="button" disabled={offset===0} onClick={()=>setOffset(value=>value-12)}>Sebelumnya</button><span>{offset+1}–{Math.min(offset+12,asset.count)} / {asset.count}</span><button type="button" disabled={offset+12>=asset.count} onClick={()=>setOffset(value=>value+12)}>Berikutnya</button></div>}</>}
  </section>;
}
export default function ReimbursementAttachmentEditor({record,canEdit,onSaved,onClose}){
  const [draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let active=true;reimbursementClient.getDocumentEdits().then(result=>{if(active)setDraft(result.data[reimbursementRecordKey(record)] || {mode:'actual',excluded:{},revision:0});}).catch(failure=>{if(active)setError(failure.message);});return()=>{active=false;};},[record]);
  const change=(field,id,edit)=>setDraft(previous=>({...previous,excluded:{...previous.excluded,[field]:{...previous.excluded[field],[id]:edit}}}));
  const save=async()=>{
    setBusy(true);setError('');
    try{const result=await reimbursementClient.saveDocumentEdit({record_key:reimbursementRecordKey(record),...draft});onSaved(result.data);onClose();}catch(failure){setError(failure.message);}finally{setBusy(false);}
  };
  const effective={...record,reimbursement_edit:draft};
  return <div className="fixed inset-0 z-[70] bg-black/50 p-4 flex items-center justify-center"><div role="dialog" aria-modal="true" aria-labelledby="attachment-editor-title" className="w-full max-w-5xl max-h-[92vh] rounded-xl bg-[var(--card)] flex flex-col"><div className="p-4 border-b border-[var(--border)] flex justify-between gap-3"><div><h2 id="attachment-editor-title" className="font-bold">Kelola Lampiran · {record.nama}</h2><p className="text-xs mt-1">NIK {record.nik} · {record.periode_bulan} {record.periode_tahun} · {record.periode_ke}</p></div><button type="button" disabled={busy} aria-label="Tutup kelola lampiran" onClick={onClose}><X size={20}/></button></div><div className="p-4 overflow-y-auto space-y-4"><p className="text-xs">Keluarkan halaman yang salah atau duplikat dari rekap PDF. File asli di Drive tetap utuh. Klik Pulihkan untuk memasukkannya kembali.</p>
    {draft&&<><label className="block text-xs font-semibold">Jenis Reimbursement<select disabled={busy||!canEdit} aria-label="Jenis Reimbursement" className="block mt-1 border border-[var(--border)] bg-[var(--background)] rounded p-2" value={draft.mode} onChange={event=>setDraft(previous=>({...previous,mode:event.target.value}))}><option value="actual">Actual · Nota Keberangkatan & Kepulangan</option><option value="lumpsum">Lumpsum · Lampiran Lumpsum</option></select></label>{draft.mode==='lumpsum'&&<p className="text-xs rounded bg-teal-50 text-teal-900 p-3">Lampiran Lumpsum diambil dari upload keberangkatan. Nota kepulangan tidak dimasukkan ke rekap. Boarding Pass dan Bukti Cuti tetap sesuai dokumen yang dipilih saat mencetak.</p>}
    {reimbursementDocuments(effective).map(({field,label})=>{const urls=splitAttachmentUrls(record[field]);return urls.length?urls.map(url=><AttachmentFile key={field+url} {...{field,label,url}} excluded={draft.excluded} onChange={change} busy={busy||!canEdit}/>):<div key={field} className="text-xs text-[var(--muted-foreground)]">{label}: belum ada lampiran.</div>;})}</>}
    {!draft&&!error&&<p className="text-sm">Memuat pengaturan lampiran...</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}</div><div className="p-4 border-t border-[var(--border)] flex justify-between items-center gap-3"><span className="text-xs text-[var(--muted-foreground)]">Perubahan berlaku untuk rekap berikutnya dan tersimpan di server.</span><div className="flex gap-2"><button type="button" disabled={busy} onClick={onClose} className="text-xs border rounded px-3 py-2">Batal</button>{canEdit&&<button type="button" disabled={busy||!draft} onClick={save} className="text-xs rounded px-3 py-2 bg-[#0F5C56] text-white disabled:opacity-50">{busy?'Menyimpan...':'Simpan Perubahan'}</button>}</div></div></div></div>;
}
