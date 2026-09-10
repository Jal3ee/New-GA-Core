import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api as gasClient } from '../../lib/gasClient';
import { useGlobalLoading } from '../../context/LoadingContext';
import { toast } from 'sonner';
import { ArrowLeft, Plus, PenTool, Type, Highlighter, Trash2, CheckCircle, Save, Calendar, Settings, X, Upload, Download } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Rnd } from 'react-rnd';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument, rgb } from 'pdf-lib';
import { useAuth } from '../../context/AuthContext';
import PdfOrganizerModal from '../../components/pdf/PdfOrganizerModal';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showLoading, hideLoading } = useGlobalLoading();
  
  const [invoice, setInvoice] = useState(null);
  const [pdfDataUri, setPdfDataUri] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [annotations, setAnnotations] = useState([]); // { id, pageIndex, type, x, y, width, height, data }
  
  // Annotation state
  const [activeSignId, setActiveSignId] = useState(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const sigCanvasRef = useRef({});
  
  // User selection state for signature assignment
  const [users, setUsers] = useState([]);
  const [isSelectUserModalOpen, setIsSelectUserModalOpen] = useState(false);
  const [pendingSignPage, setPendingSignPage] = useState(null);

  // PDF Organizer state
  const [isPdfOrganizerOpen, setIsPdfOrganizerOpen] = useState(false);

  // Workflow tracking structure
  const WORKFLOW_STEPS = [
    { key: 'tgl_berkas', label: 'Diserahkan' },
    { key: 'tracking_admin_ga', label: 'Admin GA' },
    { key: 'tracking_ga_gl', label: 'GA GL' },
    { key: 'tracking_ga_spv', label: 'GA SPV' },
    { key: 'tracking_ga_sect_head', label: 'GA Sect Head' },
    { key: 'tracking_ga_dept_head', label: 'GA Dept Head' },
    { key: 'tracking_site_manager', label: 'Site Manager' },
    { key: 'tracking_accounting', label: 'Accounting' },
    { key: 'tracking_fa_gl', label: 'FA GL' },
  ];

  const fetchDetail = async () => {
    showLoading();
    try {
      const res = await gasClient.getInvoices();
      if (res.ok) {
        const inv = res.data.find(r => String(r.id) === String(id));
        if (inv) {
          setInvoice(inv);
          if (inv.annotations_json) {
            try {
              setAnnotations(JSON.parse(inv.annotations_json));
            } catch(e) {}
          }
          
          // Ponytail Hack: Proxy PDF download via Google Apps Script to bypass CORS
          if (inv.file_url) {
            const match = inv.file_url.match(/d\/([a-zA-Z0-9_-]+)/);
            if (match && match[1]) {
              try {
                const resPdf = await gasClient.downloadFile(match[1]);
                if (resPdf.ok && resPdf.data) {
                  setPdfDataUri(`data:${resPdf.mimeType || 'application/pdf'};base64,${resPdf.data}`);
                }
              } catch(e) {
                console.error("Gagal mendownload PDF via GAS", e);
              }
            }
          }
          
        } else {
          toast.error('Invoice tidak ditemukan');
          navigate('/invoice');
        }
      }
    } catch (e) {
      toast.error('Gagal memuat detail');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    fetchDetail();
    // Pre-fetch active users for signature assignment
    gasClient.getUsers().then(res => {
      if (res.ok) setUsers(res.data.filter(u => u.status === 'Active'));
    });
  }, [id]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const saveAnnotations = async (newAnnots) => {
    setAnnotations(newAnnots);
    try {
      await gasClient.updateInvoice(id, { annotations_json: JSON.stringify(newAnnots) });
      toast.success('Anotasi disimpan');
    } catch (e) {
      toast.error('Gagal menyimpan anotasi');
    }
  };

  const addAnnotation = (type, pageIndex) => {
    if (type === 'sign') {
      setPendingSignPage(pageIndex);
      setIsSelectUserModalOpen(true);
      return;
    }
    const newAnn = {
      id: Date.now().toString(),
      pageIndex,
      type, // 'text', 'highlight'
      x: 50,
      y: 50,
      width: type === 'highlight' ? 200 : 150,
      height: type === 'highlight' ? 30 : 50,
      data: type === 'text' ? 'Klik untuk edit text' : null,
      pic: '',
      signedImageData: null
    };
    saveAnnotations([...annotations, newAnn]);
  };

  const updateAnnotation = (annId, updates) => {
    const updated = annotations.map(a => a.id === annId ? { ...a, ...updates } : a);
    setAnnotations(updated);
    // Auto save? Maybe debounced or explicit save button is better.
    // For now, let's explicit save.
  };

  const deleteAnnotation = (annId) => {
    const updated = annotations.filter(a => a.id !== annId);
    saveAnnotations(updated);
  };

  const openSignModal = (ann) => {
    if (ann.assignedUser && user.nik !== ann.assignedUser.nik) {
      toast.error(`Akses Ditolak: Tanda tangan ini khusus untuk ${ann.assignedUser.name}`);
      return;
    }
    setActiveSignId(ann.id);
    setIsSignModalOpen(true);
  };

  const handleSignSave = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      // Use getCanvas() instead of getTrimmedCanvas() to avoid trim-canvas dependency error
      const dataURL = sigCanvasRef.current.getCanvas().toDataURL('image/png');
      updateAnnotation(activeSignId, { signedImageData: dataURL, signedBy: user.name });
      setIsSignModalOpen(false);
      // Automatically save to DB
      const updated = annotations.map(a => a.id === activeSignId ? { ...a, signedImageData: dataURL, signedBy: user.name } : a);
      saveAnnotations(updated);
    }
  };

  const handleSignUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Harap unggah file gambar (.png/.jpg)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataURL = event.target.result;
        updateAnnotation(activeSignId, { signedImageData: dataURL, signedBy: user.name });
        setIsSignModalOpen(false);
        const updated = annotations.map(a => a.id === activeSignId ? { ...a, signedImageData: dataURL, signedBy: user.name } : a);
        saveAnnotations(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  const [editingStep, setEditingStep] = useState(null);
  const [stepDateValue, setStepDateValue] = useState('');

  const updateTrackingDate = async (stepKey, selectedDate) => {
    if (!selectedDate) return;
    showLoading();
    try {
      const res = await gasClient.updateInvoice(id, { [stepKey]: selectedDate });
      if (res.ok) {
        toast.success(`Berhasil update tanggal ${stepKey}`);
        setInvoice({ ...invoice, [stepKey]: selectedDate });
        setEditingStep(null);
      }
    } catch(e) {
      toast.error('Gagal update tracking');
    } finally {
      hideLoading();
    }
  };

  // Helper function to safely format dates avoiding timezone shifts
  const formatDateSafe = (dateString) => {
    if (!dateString) return '-';
    // If it's an ISO string from GAS, it might be in UTC. 
    // To safely display it, we just slice the YYYY-MM-DD part if it matches
    if (dateString.includes('T')) {
      const parts = dateString.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
      }
    }
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  const handleDownloadPdf = async () => {
    if (!pdfDataUri) {
      if (invoice.file_url) window.open(invoice.file_url, '_blank');
      return;
    }
    
    showLoading();
    toast.loading('Menyusun PDF...', { id: 'pdf-download' });
    try {
      // 1. Load original PDF
      const existingPdfBytes = await fetch(pdfDataUri).then(res => res.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      // 2. Iterate annotations and embed them
      for (const ann of annotations) {
        const page = pages[ann.pageIndex];
        if (!page) continue;

        // The react-pdf page width was fixed to 800 in the UI
        const scaleX = page.getWidth() / 800;
        const scaleY = scaleX;

        // pdf-lib's origin (0,0) is bottom-left. React's origin (0,0) is top-left.
        const pdfWidth = ann.width * scaleX;
        const pdfHeight = ann.height * scaleY;
        const pdfX = ann.x * scaleX;
        const pdfY = page.getHeight() - (ann.y * scaleY) - pdfHeight;

        if (ann.type === 'sign' && ann.signedImageData) {
          try {
            // Check if it's a PNG or JPEG based on dataURI
            const isJpeg = ann.signedImageData.includes('image/jpeg');
            const imgBytes = await fetch(ann.signedImageData).then(res => res.arrayBuffer());
            const imageToEmbed = isJpeg ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);

            page.drawImage(imageToEmbed, {
              x: pdfX,
              y: pdfY,
              width: pdfWidth,
              height: pdfHeight,
            });
          } catch(err) {
            console.error('Failed to embed signature image', err);
          }
        } else if (ann.type === 'highlight') {
          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight,
            color: rgb(0.99, 0.8, 0.2), // amber color roughly
            opacity: 0.3,
          });
        } else if (ann.type === 'text' && ann.data) {
           page.drawText(ann.data, {
             x: pdfX,
             y: pdfY + pdfHeight - (14 * scaleY), // simple top-align baseline
             size: 14 * scaleY,
             color: rgb(0, 0, 0),
             maxWidth: pdfWidth
           });
        }
      }

      // 3. Save & Download
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${invoice.vendor}_${invoice.id.substring(0,5)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('PDF berhasil didownload', { id: 'pdf-download' });
    } catch (e) {
      console.error(e);
      toast.error('Gagal menyusun PDF', { id: 'pdf-download' });
    } finally {
      hideLoading();
    }
  };

  if (!invoice) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--background)] -m-6">
      
      {/* Left: PDF & Annotation Canvas */}
      <div className="flex-1 flex flex-col border-r border-[var(--border)] bg-[#f3f4f6]">
        {/* Toolbar */}
        <div className="h-14 bg-[var(--card)] border-b border-[var(--border)] flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate('/invoice')} className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-[var(--foreground)]">Invoice: {invoice.vendor}</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleDownloadPdf} className="flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition-colors">
              <Download className="w-4 h-4 mr-1.5" /> Download
            </button>
            <button onClick={() => setIsPdfOrganizerOpen(true)} className="flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-semibold transition-colors">
              <Settings className="w-4 h-4 mr-1.5" /> Atur PDF
            </button>
            <button onClick={() => saveAnnotations(annotations)} className="flex items-center px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-sm font-semibold transition-colors">
              <Save className="w-4 h-4 mr-1.5" /> Simpan Anotasi
            </button>
          </div>
        </div>

        {/* Scrollable PDF Area */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center custom-scrollbar">
          {invoice.file_url ? (
            <Document
              file={pdfDataUri || (() => {
                // Fallback to Google Drive view URL if proxy fails
                return invoice.file_url;
              })()}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<div className="text-[var(--muted-foreground)] p-10 animate-pulse">Memuat Dokumen PDF...</div>}
              error={<div className="text-ruby-600 p-10">Gagal memuat PDF. Pastikan file valid dan dapat diakses.</div>}
            >
              {Array.from(new Array(numPages), (el, index) => (
                <div key={`page_${index + 1}`} className="relative mb-8 shadow-xl rounded overflow-hidden" style={{ width: 'fit-content' }}>
                  
                  {/* Floating Action Bar for this specific page */}
                  <div className="absolute top-2 left-2 z-20 flex flex-col space-y-1 opacity-20 hover:opacity-100 transition-opacity bg-white/90 p-1 rounded-lg shadow border border-gray-200">
                    <button onClick={() => addAnnotation('sign', index)} className="p-1.5 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Tambah Sign Box">
                      <PenTool className="w-4 h-4" />
                    </button>
                    <button onClick={() => addAnnotation('text', index)} className="p-1.5 text-gray-600 hover:text-sky-600 hover:bg-sky-50 rounded" title="Tambah Text">
                      <Type className="w-4 h-4" />
                    </button>
                    <button onClick={() => addAnnotation('highlight', index)} className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded" title="Tambah Highlight">
                      <Highlighter className="w-4 h-4" />
                    </button>
                  </div>

                  <Page pageNumber={index + 1} renderTextLayer={false} renderAnnotationLayer={false} width={800} />
                  
                  {/* Overlay Annotations for this page */}
                  {annotations.filter(a => a.pageIndex === index).map((ann) => (
                    <Rnd
                      key={ann.id}
                      bounds="parent"
                      size={{ width: ann.width, height: ann.height }}
                      position={{ x: ann.x, y: ann.y }}
                      onDragStop={(e, d) => updateAnnotation(ann.id, { x: d.x, y: d.y })}
                      onResizeStop={(e, dir, ref, delta, pos) => {
                        updateAnnotation(ann.id, {
                          width: parseInt(ref.style.width),
                          height: parseInt(ref.style.height),
                          ...pos
                        });
                      }}
                      className={`absolute border-2 ${ann.type === 'highlight' ? 'bg-amber-300/30 border-amber-400' : 'bg-white/80 border-dashed border-sky-400'} group`}
                    >
                      {/* Delete button (visible on hover) */}
                      <button onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }} className="absolute -top-3 -right-3 p-1 bg-ruby-100 text-ruby-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow-sm hover:bg-ruby-200">
                        <Trash2 className="w-3 h-3" />
                      </button>

                      {/* Content based on type */}
                      {ann.type === 'sign' && (
                        <div className="w-full h-full flex flex-col items-center justify-center cursor-pointer relative" onClick={() => openSignModal(ann)}>
                          {ann.signedImageData ? (
                            <img src={ann.signedImageData} alt="Signature" className="w-full h-full object-contain p-1" />
                          ) : (
                            <>
                              <PenTool className="w-6 h-6 text-sky-300 mb-1" />
                              <span className="text-[10px] text-sky-600 font-bold uppercase tracking-wider text-center px-1">Sign Here</span>
                            </>
                          )}
                          <input 
                            type="text" 
                            className="absolute bottom-0 w-full text-center text-[10px] bg-sky-50 outline-none border-t border-sky-100 text-sky-800 font-semibold" 
                            placeholder="PIC / Tag Nama" 
                            value={ann.pic || (ann.assignedUser?.name) || 'PIC'} 
                            readOnly
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}

                      {ann.type === 'text' && (
                        <textarea 
                          className="w-full h-full resize-none bg-transparent outline-none p-1 text-sm text-[var(--foreground)]"
                          value={ann.data}
                          onChange={(e) => updateAnnotation(ann.id, { data: e.target.value })}
                        />
                      )}
                    </Rnd>
                  ))}
                </div>
              ))}
            </Document>
          ) : (
            <div className="text-[var(--muted-foreground)]">File PDF tidak tersedia</div>
          )}
        </div>
      </div>

      {/* Right: Sidebar (Timeline & Nav) */}
      <div className="w-80 bg-[var(--card)] flex flex-col shrink-0 overflow-y-auto">
        <div className="p-5 border-b border-[var(--border)]">
          <h2 className="font-bold text-[var(--foreground)] text-lg mb-1">Status Dokumen</h2>
          <div className="flex items-center text-sm">
             <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] tracking-wide border ${invoice.status_pembayaran === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {invoice.status_pembayaran || 'OPEN'}
             </span>
             <span className="text-[var(--muted-foreground)] ml-2">{invoice.periode_start}</span>
          </div>
        </div>

        {/* Timeline Stepper */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-6">Workflow Progress</h3>
          <div className="relative border-l-2 border-gray-100 ml-3 space-y-6">
            {WORKFLOW_STEPS.map((step, index) => {
              const stepValue = invoice[step.key];
              const isCompleted = !!stepValue;
              const isCurrent = index === 0 || (!!invoice[WORKFLOW_STEPS[index - 1]?.key] && !isCompleted);
              
              return (
                <div key={step.key} className="relative pl-6">
                  {/* Node */}
                  <div className={`absolute -left-[9px] top-0.5 w-4 h-4 rounded-full border-2 bg-[var(--card)]
                    ${isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : isCurrent ? 'border-sky-500 ring-4 ring-sky-50' : 'border-gray-200'}
                  `}>
                    {isCompleted && <CheckCircle className="w-full h-full absolute -top-[1.5px] -left-[1.5px]" />}
                  </div>

                  <div className="flex flex-col">
                    <span className={`text-sm font-bold ${isCompleted ? 'text-[var(--foreground)]' : isCurrent ? 'text-sky-700' : 'text-[var(--muted-foreground)]'}`}>
                      {step.label}
                    </span>
                    
                    {isCompleted ? (
                      <span className="text-xs text-[var(--muted-foreground)] mt-0.5 font-mono">
                        {formatDateSafe(stepValue)}
                      </span>
                    ) : isCurrent ? (
                      editingStep === step.key ? (
                        <div className="mt-2 flex flex-col space-y-2 bg-[var(--background)] p-2 rounded border border-[var(--border)] shadow-sm">
                          <input 
                            type="date" 
                            value={stepDateValue}
                            onChange={(e) => setStepDateValue(e.target.value)}
                            className="px-2 py-1 text-xs border border-[var(--border)] rounded bg-white outline-none focus:ring-1 focus:ring-sky-500"
                          />
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => updateTrackingDate(step.key, stepDateValue)} 
                              className="text-[10px] bg-sky-600 text-white px-2 py-1 rounded font-semibold hover:bg-sky-700 transition-colors flex-1"
                            >
                              Simpan
                            </button>
                            <button 
                              onClick={() => setEditingStep(null)} 
                              className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-semibold hover:bg-gray-200 transition-colors flex-1"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            setEditingStep(step.key);
                            // Set default value to today local time
                            const localDate = new Date();
                            localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
                            setStepDateValue(localDate.toISOString().split('T')[0]);
                          }}
                          className="mt-2 text-left w-max inline-flex items-center text-[10px] px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded border border-sky-200 transition-colors"
                        >
                          <Calendar className="w-3 h-3 mr-1" /> Set Tanggal
                        </button>
                      )
                    ) : (
                      <span className="text-[10px] text-gray-300 mt-0.5 italic">Menunggu...</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Signatures Navigator */}
        <div className="p-5 border-t border-[var(--border)] bg-[var(--muted)]/20">
           <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Daftar Tanda Tangan</h3>
           <div className="space-y-2">
             {annotations.filter(a => a.type === 'sign').length === 0 && (
               <div className="text-xs text-[var(--muted-foreground)] italic">Belum ada blok tanda tangan.</div>
             )}
             {annotations.filter(a => a.type === 'sign').map((ann, i) => (
               <div key={ann.id} className="flex items-center justify-between p-2 bg-[var(--card)] border border-[var(--border)] rounded shadow-sm">
                 <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--foreground)]">Page {ann.pageIndex + 1}</span>
                    <span className="text-[10px] text-[var(--primary)]">{ann.pic || 'Tanpa Nama'}</span>
                 </div>
                 {ann.signedImageData ? (
                   <CheckCircle className="w-4 h-4 text-emerald-500" />
                 ) : (
                   <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded">Pending</span>
                 )}
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* Select User Modal for Signature */}
      {isSelectUserModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsSelectUserModalOpen(false)}></div>
          <div className="relative bg-[var(--card)] rounded-xl shadow-2xl overflow-hidden w-full max-w-sm">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--background)]">
              <h3 className="font-bold">Pilih PIC Penandatangan</h3>
              <button onClick={() => setIsSelectUserModalOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4 bg-gray-50 max-h-80 overflow-y-auto">
              {users.length === 0 ? <p className="text-sm text-gray-500">Memuat PIC aktif...</p> : (
                <div className="space-y-2">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        const newAnn = {
                          id: Date.now().toString(),
                          pageIndex: pendingSignPage,
                          type: 'sign',
                          x: 50, y: 50, width: 150, height: 50,
                          data: null,
                          assignedUser: { nik: u.nik, name: u.name },
                          pic: u.name,
                          signedImageData: null,
                          signedBy: null
                        };
                        saveAnnotations([...annotations, newAnn]);
                        setIsSelectUserModalOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-sky-500 hover:ring-1 ring-sky-500 transition-all shadow-sm"
                    >
                      <div className="font-bold text-sm text-gray-800">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.role} - {u.nik}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {isSignModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsSignModalOpen(false)}></div>
          <div className="relative bg-[var(--card)] rounded-xl shadow-2xl overflow-hidden w-full max-w-lg">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--background)]">
              <h3 className="font-bold">Input Tanda Tangan</h3>
              <button onClick={() => setIsSignModalOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4 bg-gray-50">
              <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white overflow-hidden">
                <SignatureCanvas 
                  ref={sigCanvasRef} 
                  penColor="blue"
                  canvasProps={{width: 500, height: 200, className: 'sigCanvas'}} 
                />
              </div>
              <div className="flex justify-between items-center mt-3">
                <button onClick={() => sigCanvasRef.current.clear()} className="text-xs text-ruby-600 hover:text-ruby-700 font-semibold px-2 py-1 rounded hover:bg-ruby-50 transition-colors">Hapus Kanvas</button>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">atau</span>
                  <label className="flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded cursor-pointer text-xs font-semibold transition-colors">
                    <Upload className="w-3 h-3 mr-1.5" /> Unggah Gambar
                    <input type="file" accept="image/*" className="hidden" onChange={handleSignUpload} />
                  </label>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-[var(--border)] flex justify-end space-x-3 bg-gray-50/50">
              <button onClick={() => setIsSignModalOpen(false)} className="px-4 py-2 text-sm bg-gray-100 rounded-lg font-medium">Batal</button>
              <button onClick={handleSignSave} className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-lg font-medium shadow">Terapkan Tanda Tangan</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Organizer Modal */}
      <PdfOrganizerModal 
        isOpen={isPdfOrganizerOpen}
        onClose={() => setIsPdfOrganizerOpen(false)}
        invoice={invoice}
        pdfDataUri={pdfDataUri}
        onSaveSuccess={(newFileUrl) => {
          setInvoice({ ...invoice, file_url: newFileUrl });
          setAnnotations([]); // Reset annotations because pages changed
          // force re-render pdf
        }}
      />

    </div>
  );
}
