import React, { useState, useEffect } from 'react';
import { api as gasClient } from '../../lib/gasClient';
import { toast } from 'sonner';
import { useGlobalLoading as useLoading } from '../../context/LoadingContext';
import { Plus, Trash2, Search, X, Paperclip, FileText, ArrowRight, Clock, CheckCircle2, Calendar, ExternalLink, ShieldCheck, Check, Layers, UploadCloud, AlertCircle, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../components/ui/CustomSelect';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB batas maksimal lampiran

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

export default function InvoicePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState(''); // Format: 'YYYY-MM'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { showLoading, hideLoading } = useLoading();

  const VENDORS = [
    { label: 'Gemoy', value: 'Gemoy' },
    { label: 'Moms Ainun', value: 'Moms Ainun' },
    { label: 'Medali Mart', value: 'Medali Mart' },
    { label: 'Berkah Laundry', value: 'Berkah Laundry' },
    { label: 'Sandaga', value: 'Sandaga' },
    { label: 'Ila Miawa', value: 'Ila Miawa' },
    { label: 'Manggala Raya Catering', value: 'Manggala Raya Catering' },
    { label: 'Manggala Raya gas & galon', value: 'Manggala Raya gas & galon' },
    { label: 'Salsa Laundry', value: 'Salsa Laundry' }
  ];

  const SITES = [
    { label: 'LBCT', value: 'LBCT' },
    { label: 'IDMG', value: 'IDMG' },
    { label: 'SPCT', value: 'SPCT' }
  ];

  const [formData, setFormData] = useState({
    vendor: 'Gemoy',
    site: 'LBCT',
    nilai: '',
    periode_start: '',
    periode_end: '',
    tgl_berkas: '',
    fileData: null,
    fileName: '',
    file_url: ''
  });

  const fetchInvoices = async () => {
    showLoading();
    try {
      const res = await gasClient.getInvoices();
      if (res.ok) {
        setInvoices(res.data || []);
      } else toast.error(res.message || 'Gagal memuat data');
    } catch (e) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const openModal = () => {
    setFormData({
      vendor: 'Gemoy',
      site: 'LBCT',
      nilai: '',
      periode_start: '',
      periode_end: '',
      tgl_berkas: '',
      fileData: null,
      fileName: '',
      fileSize: '',
      file_url: ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const isValidType = file.type === 'application/pdf' || file.type.startsWith('image/');
      if (!isValidType) {
        toast.error('Format lampiran harus berupa PDF atau Gambar (JPG/PNG)');
        e.target.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
        toast.error(`Ukuran file terlalu besar (${sizeMb} MB)! Batas maksimal lampiran adalah 5MB.`);
        e.target.value = '';
        return;
      }
      setFormData({
        ...formData,
        fileData: file, // Store File object reference natively
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(2)
      });
    }
  };

  // Quick upload / replace attachment directly for any invoice
  const handleQuickUploadAttachment = async (invoiceId, file) => {
    if (!file) return;
    const isValidType = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!isValidType) {
      toast.error('Format lampiran harus berupa PDF atau Gambar (JPG/PNG)');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(`Ukuran file melebihi batas 5MB (${sizeMb} MB)!`);
      return;
    }

    showLoading();
    toast.loading('Mengunggah berkas lampiran invoice...', { id: 'upload-lampiran' });
    try {
      const res = await gasClient.updateInvoice(invoiceId, {
        fileData: file,
        fileName: file.name
      });
      toast.dismiss('upload-lampiran');
      if (res.ok) {
        toast.success('Lampiran invoice berhasil diunggah!');
        fetchInvoices();
      } else {
        toast.error(res.message || 'Gagal mengunggah lampiran');
      }
    } catch (err) {
      toast.dismiss('upload-lampiran');
      toast.error('Gagal upload lampiran: ' + (err.message || 'Kesalahan jaringan'));
    } finally {
      hideLoading();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.tgl_berkas) {
      return toast.warning('Tanggal diserahkan wajib diisi');
    }
    if (!formData.fileData) {
      return toast.warning('Berkas lampiran invoice wajib diunggah (maks. 5MB)');
    }
    if (formData.fileData.size > MAX_FILE_SIZE_BYTES) {
      return toast.error('Ukuran berkas lampiran melebihi batas maksimal 5MB');
    }

    showLoading();
    try {
      let payload = { 
        vendor: formData.vendor,
        site: formData.site,
        nilai: formData.nilai,
        periode_start: formData.periode_start,
        periode_end: formData.periode_end,
        tgl_berkas: formData.tgl_berkas,
        status_pembayaran: 'Open',
        tracking_admin_ga: formData.tgl_berkas,
        fileData: formData.fileData,
        fileName: formData.fileName
      };

      toast.loading('Menyimpan Data & Mengunggah Lampiran...', { id: 'save-toast' });
      const res = await gasClient.createInvoice(payload);
      toast.dismiss('save-toast');
      if (res.ok) {
        toast.success('Invoice & lampiran berhasil ditambahkan');
        closeModal();
        fetchInvoices();
      } else {
        toast.error(res.message || 'Gagal menyimpan');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      toast.dismiss('save-toast');
      hideLoading();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus invoice ini?')) return;
    showLoading();
    try {
      const res = await gasClient.deleteInvoice(id);
      if (res.ok) {
        toast.success('Invoice dihapus');
        fetchInvoices();
      } else {
        toast.error('Gagal menghapus');
      }
    } catch (e) {
      toast.error('Kesalahan jaringan');
    } finally {
      hideLoading();
    }
  };

  // Helper function to safely format dates avoiding timezone shifts
  const formatDateSafe = (dateString, options = {}) => {
    if (!dateString) return '-';
    // If it's an ISO string from GAS, it might be in UTC. 
    // To safely display it, we just slice the YYYY-MM-DD part if it matches
    if (dateString.includes('T')) {
      const parts = dateString.split('T')[0].split('-');
      if (parts.length === 3) {
        if (options.month === 'short') {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          return d.toLocaleDateString('id-ID', options);
        }
        return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
      }
    }
    return new Date(dateString).toLocaleDateString('id-ID', options);
  };

  const [trackingModalInvoice, setTrackingModalInvoice] = useState(null);
  const [trackingDraft, setTrackingDraft] = useState({});
  const [savingTracking, setSavingTracking] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);

  const getWorkflowStatus = (inv) => {
    const completed = WORKFLOW_STEPS.filter(s => !!inv[s.key]).length;
    if (inv.status_pembayaran === 'PAID') {
      return { label: 'PAID & Selesai', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', count: 9 };
    }
    if (completed === WORKFLOW_STEPS.length) {
      return { label: 'Menunggu Closing / PAID', color: 'bg-teal-50 text-teal-700 border-teal-200', count: 9 };
    }
    const nextStep = WORKFLOW_STEPS.find(s => !inv[s.key]);
    return {
      label: nextStep ? `Menunggu ${nextStep.label}` : 'Sedang Berjalan',
      color: completed >= 6 ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-sky-50 text-sky-700 border-sky-200',
      count: completed
    };
  };

  const getDrivePreviewUrl = (url) => {
    if (!url) return null;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    return url;
  };

  const openTrackingModal = (inv) => {
    setTrackingModalInvoice(inv);
    const draft = {};
    WORKFLOW_STEPS.forEach(step => {
      draft[step.key] = inv[step.key] ? String(inv[step.key]).split('T')[0] : '';
    });
    setTrackingDraft(draft);
  };

  const handleSaveTracking = async () => {
    if (!trackingModalInvoice) return;
    setSavingTracking(true);
    const targetId = trackingModalInvoice.id;
    
    // Optimistic update
    setInvoices(prev => prev.map(inv => inv.id === targetId ? { ...inv, ...trackingDraft } : inv));
    
    try {
      const res = await gasClient.updateInvoice(targetId, trackingDraft);
      if (res.ok) {
        if (trackingDraft.tracking_fa_gl && !trackingModalInvoice.tracking_fa_gl) {
          toast.success('Tracking FA GL disimpan & notifikasi WA otomatis dikirim ke grup!');
        } else {
          toast.success('Status tracking berhasil disimpan!');
        }
        setTrackingModalInvoice(null);
      } else {
        toast.error(res.message || 'Gagal update status tracking');
        fetchInvoices();
      }
    } catch (e) {
      toast.error('Gagal update status: ' + (e.message || 'Kesalahan jaringan'));
      fetchInvoices();
    } finally {
      setSavingTracking(false);
    }
  };

  const handleSetTodayForStep = (key) => {
    const today = new Date().toISOString().split('T')[0];
    setTrackingDraft(prev => ({ ...prev, [key]: today }));
  };

  const filteredInvoices = invoices.filter(c => {
    const matchesSearch = String(c.vendor).toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    let matchesStatus = true;
    const invStatus = (c.status_pembayaran || 'OPEN').toUpperCase();
    if (filterStatus === 'OPEN') {
      matchesStatus = invStatus !== 'PAID' && invStatus !== 'CLOSED';
    } else if (filterStatus === 'CLOSED') {
      matchesStatus = invStatus === 'PAID' || invStatus === 'CLOSED';
    }

    // Month filter (based on periode_start)
    let matchesMonth = true;
    if (filterMonth && c.periode_start) {
      // filterMonth is 'YYYY-MM', e.g., '2026-08'
      const [year, month] = filterMonth.split('-');
      const formattedPeriode = formatDateSafe(c.periode_start);
      matchesMonth = formattedPeriode.endsWith(`${month}/${year}`);
    }

    return matchesSearch && matchesStatus && matchesMonth;
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)]">Manajemen Invoice</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">Kelola data invoice masuk, update progress dokumen tanpa download PDF, dan tracking approval.</p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center justify-center px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium hover:bg-teal-700 transition-colors shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Invoice Baru
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] shadow-sm">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow text-sm"
            placeholder="Cari vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="flex bg-[var(--muted)] p-1 rounded-lg border border-[var(--border)]">
            {['ALL', 'OPEN', 'CLOSED'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${filterStatus === status ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}
              >
                {status === 'ALL' ? 'Semua' : status === 'OPEN' ? 'Open' : 'Closed'}
              </button>
            ))}
          </div>
          
          <div className="relative flex items-center bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[var(--ring)] transition-shadow">
            <span className="pl-3 text-[var(--muted-foreground)] border-r border-[var(--border)] pr-2 py-2 text-xs font-bold uppercase tracking-wider bg-[var(--muted)]/50">Bulan</span>
            <input 
              type="month" 
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-2 bg-transparent text-sm text-[var(--foreground)] outline-none cursor-pointer"
              title="Filter berdasarkan bulan penyerahan berkas"
            />
            {filterMonth && (
              <button 
                onClick={() => setFilterMonth('')}
                className="pr-3 pl-1 text-[var(--muted-foreground)] hover:text-ruby-500 transition-colors"
                title="Reset Bulan"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredInvoices.map(invoice => {
          const statusInfo = getWorkflowStatus(invoice);
          return (
            <div key={invoice.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between">
              <div className="p-5 flex-1 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="bg-sky-50 text-sky-700 px-3 py-1 rounded-full text-xs font-semibold border border-sky-100">
                    {invoice.vendor}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border
                    ${invoice.status_pembayaran === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
                  `}>
                    {invoice.status_pembayaran || 'OPEN'}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-[var(--foreground)] text-lg">
                    Periode: {invoice.periode_start ? formatDateSafe(invoice.periode_start, { month: 'short', year: 'numeric'}) : '-'}
                  </h3>
                  <div className="mt-1 font-mono text-emerald-600 font-bold">
                    Rp {Number(invoice.nilai || 0).toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="text-xs text-[var(--muted-foreground)] flex flex-col space-y-1.5 bg-[var(--muted)]/40 p-3 rounded-lg border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="w-3.5 h-3.5 mr-2 text-[var(--muted-foreground)]" />
                      <span>Site: <strong className="text-[var(--foreground)]">{invoice.site || '-'}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-2 text-[var(--muted-foreground)]" />
                      <span>Diserahkan: <strong className="text-[var(--foreground)]">{formatDateSafe(invoice.tgl_berkas)}</strong></span>
                    </div>
                  </div>
                  {/* Lampiran indicator for each invoice */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-[var(--border)]/60 text-[11px]">
                    <div className="flex items-center">
                      <Paperclip className={`w-3.5 h-3.5 mr-1.5 ${invoice.file_url ? 'text-emerald-600' : 'text-amber-500'}`} />
                      <span>Lampiran: <strong className={invoice.file_url ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {invoice.file_url ? 'Tersedia' : 'Belum Ada'}
                      </strong></span>
                    </div>
                    {invoice.file_url ? (
                      <button
                        onClick={() => setPreviewPdfUrl(getDrivePreviewUrl(invoice.file_url))}
                        className="text-sky-600 hover:text-sky-700 dark:text-sky-400 font-bold hover:underline flex items-center"
                        title="Buka Berkas Lampiran"
                      >
                        Lihat <Eye className="w-3 h-3 ml-0.5" />
                      </button>
                    ) : (
                      <label className="text-[var(--primary)] hover:underline font-bold cursor-pointer flex items-center" title="Unggah berkas lampiran (Maks. 5MB)">
                        + Unggah File
                        <input
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/jpg"
                          className="hidden"
                          onChange={(e) => handleQuickUploadAttachment(invoice.id, e.target.files[0])}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Workflow pipeline stage badge */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-[var(--muted-foreground)] flex items-center font-medium">
                    <Layers className="w-3.5 h-3.5 mr-1 text-[var(--primary)]" />
                    Status Tracking:
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-bold border text-[11px] ${statusInfo.color}`}>
                    {statusInfo.label} ({statusInfo.count}/9)
                  </span>
                </div>
              </div>
              
              <div className="bg-[var(--muted)]/30 border-t border-[var(--border)] p-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleDelete(invoice.id)}
                    className="text-ruby-600 hover:text-ruby-700 p-2 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 rounded-lg transition-colors"
                    title="Hapus Invoice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {invoice.file_url ? (
                    <button
                      onClick={() => setPreviewPdfUrl(getDrivePreviewUrl(invoice.file_url))}
                      className="text-[var(--muted-foreground)] hover:text-sky-600 p-2 hover:bg-sky-50 dark:hover:bg-sky-950/30 rounded-lg transition-colors"
                      title="Lihat Berkas Lampiran"
                    >
                      <Paperclip className="w-4 h-4 text-emerald-600" />
                    </button>
                  ) : (
                    <label
                      className="text-[var(--muted-foreground)] hover:text-[var(--primary)] p-2 hover:bg-[var(--muted)] rounded-lg transition-colors cursor-pointer"
                      title="Unggah Lampiran (Maks. 5MB)"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                        className="hidden"
                        onChange={(e) => handleQuickUploadAttachment(invoice.id, e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openTrackingModal(invoice)}
                    className="inline-flex items-center px-2.5 py-1.5 bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] rounded-lg text-xs font-semibold transition-colors"
                    title="Update cepat status tracking"
                  >
                    <Clock className="w-3.5 h-3.5 mr-1 text-[var(--muted-foreground)]" />
                    Quick Update
                  </button>
                  
                  <button
                    onClick={() => navigate(`/invoice/${invoice.id}`)}
                    className="inline-flex items-center px-3 py-1.5 bg-[var(--primary)] text-white hover:bg-teal-700 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-xs"
                    title="Buka detail dan tracking status lengkap"
                  >
                    Detail Tracking
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredInvoices.length === 0 && (
          <div className="col-span-full py-12 text-center text-[var(--muted-foreground)]">
            Tidak ada data invoice ditemukan.
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
              onClick={closeModal} 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--card)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--background)]">
                <h2 className="text-lg font-bold text-[var(--foreground)]">Tambah Invoice Baru</h2>
                <button onClick={closeModal} className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                <form id="invForm" onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Pilih Vendor *</label>
                    <CustomSelect 
                      value={formData.vendor} 
                      onChange={(val) => setFormData({...formData, vendor: val})}
                      options={VENDORS}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Nilai (Rp)</label>
                      <input 
                        type="text" 
                        required 
                        value={formData.nilai ? 'Rp ' + Number(formData.nilai).toLocaleString('id-ID') : ''} 
                        onChange={(e) => setFormData({...formData, nilai: e.target.value.replace(/\D/g, '')})} 
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm font-mono" 
                        placeholder="Rp 0" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Site</label>
                      <CustomSelect 
                        value={formData.site} 
                        onChange={(val) => setFormData({...formData, site: val})}
                        options={SITES}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Periode Awal</label>
                      <input type="date" value={formData.periode_start} onChange={(e) => setFormData({...formData, periode_start: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Periode Akhir</label>
                      <input type="date" value={formData.periode_end} onChange={(e) => setFormData({...formData, periode_end: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Tanggal Berkas Diserahkan *</label>
                    <input type="date" required value={formData.tgl_berkas} onChange={(e) => setFormData({...formData, tgl_berkas: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-[var(--foreground)]">Lampiran Invoice *</label>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                        Batas Maks. 5MB
                      </span>
                    </div>
                    <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-dashed border-[var(--border)] rounded-xl cursor-pointer hover:bg-[var(--muted)]/50 transition-colors bg-[var(--background)]">
                      <div className="flex flex-col items-center text-center">
                        {formData.fileName ? (
                          <>
                            <Paperclip className="w-8 h-8 text-emerald-600 mb-1.5" />
                            <span className="text-xs font-bold text-[var(--foreground)] truncate max-w-xs">
                              {formData.fileName}
                            </span>
                            <span className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                              {formData.fileSize ? `${formData.fileSize} MB • Siap diunggah` : 'Siap diunggah'}
                            </span>
                            <span className="text-[10px] text-[var(--muted-foreground)] mt-1 underline">
                              Klik untuk ganti file lampiran
                            </span>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="w-8 h-8 text-[var(--muted-foreground)] mb-1.5" />
                            <span className="text-xs font-semibold text-[var(--foreground)]">
                              Klik untuk pilih berkas lampiran invoice
                            </span>
                            <span className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                              Format: PDF, JPG, PNG (Maksimal 5MB)
                            </span>
                          </>
                        )}
                      </div>
                      <input type="file" className="hidden" accept=".pdf,image/png,image/jpeg,image/jpg" onChange={handleFileChange} />
                    </label>
                  </div>
                </form>
              </div>
              
              <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--muted)]/30 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--border)] rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="invForm"
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-teal-700 rounded-lg transition-colors shadow-sm active:scale-95"
                >
                  Simpan Invoice
                </button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Quick Tracking Status Modal - No PDF Loading Required */}
        {trackingModalInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
              onClick={() => !savingTracking && setTrackingModalInvoice(null)} 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--card)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-[var(--border)]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--background)]">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-display text-[var(--foreground)]">Update Status & Tracking</h2>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {trackingModalInvoice.vendor} • {trackingModalInvoice.site} • Rp {Number(trackingModalInvoice.nilai || 0).toLocaleString('id-ID')}
                      </p>
                      {trackingModalInvoice.file_url && (
                        <button
                          type="button"
                          onClick={() => setPreviewPdfUrl(getDrivePreviewUrl(trackingModalInvoice.file_url))}
                          className="text-[11px] font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center"
                          title="Lihat Berkas Lampiran"
                        >
                          <Paperclip className="w-3 h-3 mr-0.5" />
                          Lampiran
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => !savingTracking && setTrackingModalInvoice(null)} 
                  className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {/* 9 Tracking Steps Timeline */}
                <div>
                  <h4 className="text-sm font-bold text-[var(--foreground)] mb-3 flex items-center">
                    <Layers className="w-4 h-4 mr-1.5 text-[var(--primary)]" />
                    Tahapan Approval & Penyerahan Berkas
                  </h4>

                  <div className="space-y-3">
                    {WORKFLOW_STEPS.map((step, idx) => {
                      const val = trackingDraft[step.key] || '';
                      const isCompleted = !!val;
                      return (
                        <div 
                          key={step.key} 
                          className={`p-3 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isCompleted ? 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20' : 'bg-[var(--card)] border-[var(--border)]'}`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isCompleted ? 'bg-emerald-600 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                              {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[var(--foreground)]">{step.label}</p>
                              <p className="text-[11px] text-[var(--muted-foreground)]">
                                {isCompleted ? `Tercatat: ${val}` : 'Belum tercatat'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            <input
                              type="date"
                              value={val}
                              onChange={(e) => setTrackingDraft(prev => ({ ...prev, [step.key]: e.target.value }))}
                              className="px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs outline-none focus:ring-2 focus:ring-[var(--ring)]"
                            />
                            {!isCompleted ? (
                              <button
                                type="button"
                                onClick={() => handleSetTodayForStep(step.key)}
                                className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                                title="Set tanggal hari ini"
                              >
                                Hari Ini
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setTrackingDraft(prev => ({ ...prev, [step.key]: '' }))}
                                className="px-2 py-1.5 text-ruby-500 hover:bg-ruby-50 rounded-lg text-xs transition-colors"
                                title="Reset / Hapus tanggal"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => !savingTracking && setTrackingModalInvoice(null)}
                  className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
                  disabled={savingTracking}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveTracking}
                  disabled={savingTracking}
                  className="inline-flex items-center px-5 py-2 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {savingTracking ? 'Menyimpan...' : 'Simpan Status Tracking'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Quick Drive PDF Preview Modal */}
        {previewPdfUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[var(--card)] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl border border-[var(--border)] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--background)]">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-[var(--primary)]" />
                  <h3 className="font-bold text-[var(--foreground)]">Dokumen Invoice (Google Drive Preview)</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <a 
                    href={previewPdfUrl.replace('/preview', '/view')} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--muted)] rounded-lg transition-colors flex items-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Buka Tab Baru
                  </a>
                  <button 
                    onClick={() => setPreviewPdfUrl(null)}
                    className="px-3 py-1.5 text-xs font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-gray-100 dark:bg-zinc-900 relative">
                <iframe 
                  src={previewPdfUrl} 
                  className="w-full h-full border-0" 
                  title="PDF Preview"
                  allow="autoplay"
                />
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
