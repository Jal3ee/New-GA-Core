import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUp, ArrowDown, Trash2, Plus, FileText, Loader2, Save } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { toast } from 'sonner';
import { api as gasClient } from '../../lib/gasClient';

export default function PdfOrganizerModal({ isOpen, onClose, invoice, pdfDataUri, onSaveSuccess }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // files: [{ id: 'f1', buffer: ArrayBuffer, name: 'original.pdf' }]
  const [files, setFiles] = useState([]);
  // pages: [{ id: 'p1', fileId: 'f1', pageIndex: 0 }]
  const [pages, setPages] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (pdfDataUri) {
        loadInitialPdf(pdfDataUri);
      } else if (invoice?.file_url) {
        loadInitialPdf(invoice.file_url);
      }
    }
  }, [isOpen, invoice, pdfDataUri]);

  const loadInitialPdf = async (url) => {
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch PDF');
      
      const buffer = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer);
      const numPages = pdfDoc.getPageCount();
      
      const fileId = 'original';
      setFiles([{ id: fileId, buffer, name: 'Invoice Original.pdf' }]);
      
      const newPages = [];
      for (let i = 0; i < numPages; i++) {
        newPages.push({
          id: `p_${fileId}_${i}_${Date.now()}`,
          fileId,
          pageIndex: i
        });
      }
      setPages(newPages);
    } catch (e) {
      toast.error('Gagal memuat PDF asli: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPdf = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Harap unggah file PDF');
      return;
    }
    
    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer);
      const numPages = pdfDoc.getPageCount();
      
      const fileId = `f_${Date.now()}`;
      setFiles(prev => [...prev, { id: fileId, buffer, name: file.name }]);
      
      const newPages = [];
      for (let i = 0; i < numPages; i++) {
        newPages.push({
          id: `p_${fileId}_${i}_${Date.now()}`,
          fileId,
          pageIndex: i
        });
      }
      setPages(prev => [...prev, ...newPages]);
      toast.success(`${numPages} halaman ditambahkan dari ${file.name}`);
    } catch (e) {
      toast.error('Gagal memproses PDF baru');
    }
  };

  const movePageUp = (index) => {
    if (index === 0) return;
    const newPages = [...pages];
    const temp = newPages[index - 1];
    newPages[index - 1] = newPages[index];
    newPages[index] = temp;
    setPages(newPages);
  };

  const movePageDown = (index) => {
    if (index === pages.length - 1) return;
    const newPages = [...pages];
    const temp = newPages[index + 1];
    newPages[index + 1] = newPages[index];
    newPages[index] = temp;
    setPages(newPages);
  };

  const removePage = (index) => {
    const newPages = [...pages];
    newPages.splice(index, 1);
    setPages(newPages);
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('pageIndex', index);
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('pageIndex'), 10);
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;
    
    const newPages = [...pages];
    const [draggedItem] = newPages.splice(sourceIndex, 1);
    newPages.splice(targetIndex, 0, draggedItem);
    setPages(newPages);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSave = async () => {
    if (pages.length === 0) {
      toast.error('PDF tidak boleh kosong');
      return;
    }

    setShowConfirm(true);
  };

  const executeSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    toast.loading('Memproses PDF...', { id: 'save-pdf' });
    try {
      const newPdf = await PDFDocument.create();
      
      // cache loaded documents to avoid parsing multiple times
      const loadedDocs = {};
      
      for (const p of pages) {
        if (!loadedDocs[p.fileId]) {
          const fileData = files.find(f => f.id === p.fileId);
          loadedDocs[p.fileId] = await PDFDocument.load(fileData.buffer);
        }
        
        const donorDoc = loadedDocs[p.fileId];
        const [copiedPage] = await newPdf.copyPages(donorDoc, [p.pageIndex]);
        newPdf.addPage(copiedPage);
      }
      
      const base64DataUri = await newPdf.saveAsBase64({ dataUri: true });
      // extract just the base64 part
      const base64Data = base64DataUri.split(',')[1];
      
      toast.loading('Mengunggah PDF ke server...', { id: 'save-pdf' });
      const uploadRes = await gasClient.uploadFile(base64Data, `Invoice_${invoice.vendor}_Reorganized.pdf`);
      
      if (!uploadRes.ok) throw new Error('Gagal mengunggah file');
      
      toast.loading('Memperbarui data...', { id: 'save-pdf' });
      const updateRes = await gasClient.updateInvoice(invoice.id, { 
        file_url: uploadRes.fileUrl,
        annotations_json: '[]' // Reset annotations because pages changed
      });
      
      if (updateRes.ok) {
        toast.success('PDF berhasil diperbarui!', { id: 'save-pdf' });
        onSaveSuccess(uploadRes.fileUrl, base64DataUri); // pass new URL and instant data uri to parent
        onClose();
      } else {
        throw new Error('Gagal update data invoice');
      }
      
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Terjadi kesalahan saat memproses PDF', { id: 'save-pdf' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-[var(--card)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--background)] shrink-0">
            <div>
              <h2 className="text-lg font-bold text-[var(--foreground)]">Atur Halaman PDF</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Hapus, urutkan ulang, atau gabungkan dengan file PDF lain.</p>
            </div>
            <button onClick={onClose} disabled={saving} className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mb-4" />
                <p className="text-[var(--muted-foreground)] font-medium">Memuat struktur PDF...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
                  <strong>Peringatan:</strong> Menyimpan perubahan akan mereset semua tanda tangan / anotasi yang sudah ada di dokumen ini.
                </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {pages.map((p, index) => {
                      const sourceFile = files.find(f => f.id === p.fileId);
                      return (
                        <motion.div 
                          layout
                          key={p.id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragOver={handleDragOver}
                          className="bg-white border border-[var(--border)] rounded-lg shadow-sm p-3 flex flex-col items-center relative group hover:ring-2 hover:ring-sky-400 transition-all cursor-grab active:cursor-grabbing"
                        >
                          <div className="w-full aspect-[1/1.4] bg-gray-100 border border-gray-200 shadow-inner flex items-center justify-center mb-3">
                            <FileText className="w-10 h-10 text-gray-400" />
                            <span className="absolute text-3xl font-bold text-gray-300 pointer-events-none opacity-50">{index + 1}</span>
                          </div>
                          <div className="text-center w-full">
                            <p className="text-xs font-bold text-[var(--foreground)]">Hal {index + 1}</p>
                            <p className="text-[10px] text-[var(--muted-foreground)] truncate px-1" title={sourceFile?.name}>
                              {p.fileId === 'original' ? 'Original' : sourceFile?.name} (Hal {p.pageIndex + 1})
                            </p>
                          </div>

                          {/* Action Overlay */}
                          <div className="absolute top-0 right-0 left-0 bottom-0 bg-white/90 backdrop-blur-[1px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center space-y-2">
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => movePageUp(index)} 
                                disabled={index === 0}
                                className="p-2 bg-sky-100 text-sky-700 rounded-full hover:bg-sky-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                                title="Pindah ke Atas"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => movePageDown(index)} 
                                disabled={index === pages.length - 1}
                                className="p-2 bg-sky-100 text-sky-700 rounded-full hover:bg-sky-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                                title="Pindah ke Bawah"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                            </div>
                            <button 
                              onClick={() => removePage(index)} 
                              className="p-2 bg-ruby-100 text-ruby-700 rounded-full hover:bg-ruby-200 shadow-sm cursor-pointer"
                              title="Hapus Halaman"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <p className="text-[10px] font-medium text-[var(--muted-foreground)] pt-2 select-none pointer-events-none">Tahan & Geser (Drag)</p>
                          </div>
                        </motion.div>
                      );
                    })}
                    
                    {/* Add New PDF Button */}
                    <label className="border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-gray-100 hover:border-sky-400 hover:text-sky-600 transition-colors aspect-[1/1.4]">
                      <Plus className="w-8 h-8 text-gray-400 mb-2 group-hover:text-sky-600" />
                      <span className="text-xs font-bold text-gray-600 text-center group-hover:text-sky-600">Tambah<br/>PDF Baru</span>
                      <input type="file" className="hidden" accept=".pdf" onChange={handleAddPdf} multiple={false} />
                    </label>
                  </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--background)] flex justify-end shrink-0">
            {showConfirm ? (
              <div className="flex items-center space-x-3 w-full justify-between">
                <div className="text-sm text-ruby-700 font-medium flex items-center bg-ruby-50 px-3 py-2 rounded-lg border border-ruby-200">
                  ⚠️ Menyimpan perubahan akan menimpa file dan menghapus anotasi. Lanjutkan?
                </div>
                <div className="flex space-x-2 shrink-0">
                  <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-gray-100 rounded-lg transition-colors">Batal</button>
                  <button onClick={executeSave} className="px-4 py-2 text-sm font-medium text-white bg-ruby-600 hover:bg-ruby-700 rounded-lg transition-colors shadow-sm">Ya, Lanjutkan</button>
                </div>
              </div>
            ) : (
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || loading || pages.length === 0}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-teal-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
