import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api as gasClient } from '../../lib/gasClient';
import { useGlobalLoading } from '../../context/LoadingContext';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Calendar,
  Building2,
  MapPin,
  CreditCard,
  FileText,
  ExternalLink,
  Trash2,
  Save,
  Check,
  Layers,
  UploadCloud,
  RotateCcw,
  ShieldCheck,
  CheckCircle,
  Paperclip
} from 'lucide-react';

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

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useGlobalLoading();

  const [invoice, setInvoice] = useState(null);
  const [trackingDraft, setTrackingDraft] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  // Helper function to safely format dates
  const formatDateSafe = (dateString, options = {}) => {
    if (!dateString) return '-';
    if (String(dateString).includes('T')) {
      const parts = String(dateString).split('T')[0].split('-');
      if (parts.length === 3) {
        if (options.month === 'short') {
          const d = new Date(parts[0], parts[1] - 1, parts[2]);
          return d.toLocaleDateString('id-ID', options);
        }
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return new Date(dateString).toLocaleDateString('id-ID', options);
  };

  const fetchDetail = async () => {
    showLoading();
    try {
      const res = await gasClient.getInvoices();
      if (res.ok) {
        const inv = res.data.find(r => String(r.id) === String(id));
        if (inv) {
          setInvoice(inv);
          // Initialize draft
          const draft = {};
          WORKFLOW_STEPS.forEach(step => {
            draft[step.key] = inv[step.key] ? String(inv[step.key]).split('T')[0] : '';
          });
          setTrackingDraft(draft);
        } else {
          toast.error('Invoice tidak ditemukan');
          navigate('/invoice');
        }
      } else {
        toast.error(res.message || 'Gagal memuat data');
      }
    } catch (e) {
      toast.error('Gagal memuat data: ' + (e.message || 'Kesalahan jaringan'));
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const driveFileId = useMemo(() => {
    if (!invoice?.file_url) return null;
    const match = invoice.file_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }, [invoice?.file_url]);

  const drivePreviewUrl = useMemo(() => {
    if (!driveFileId) return null;
    return `https://drive.google.com/file/d/${driveFileId}/preview`;
  }, [driveFileId]);

  // Calculate completed workflow steps
  const workflowProgress = useMemo(() => {
    if (!invoice) return { completed: 0, total: WORKFLOW_STEPS.length, percent: 0 };
    const completed = WORKFLOW_STEPS.filter(s => !!trackingDraft[s.key]).length;
    const percent = Math.round((completed / WORKFLOW_STEPS.length) * 100);
    return { completed, total: WORKFLOW_STEPS.length, percent };
  }, [invoice, trackingDraft]);

  // Update a single date in the draft
  const handleDateChange = (stepKey, value) => {
    setTrackingDraft(prev => ({ ...prev, [stepKey]: value }));
  };

  // Set today's date for a step
  const handleSetToday = (stepKey) => {
    const today = new Date().toISOString().split('T')[0];
    setTrackingDraft(prev => ({ ...prev, [stepKey]: today }));
  };

  // Clear a date for a step
  const handleClearStep = (stepKey) => {
    setTrackingDraft(prev => ({ ...prev, [stepKey]: '' }));
  };

  // Save all tracking dates to backend
  const handleSaveTracking = async () => {
    if (!invoice) return;
    setIsSaving(true);
    showLoading();

    try {
      const isNewFaGl = trackingDraft.tracking_fa_gl && !invoice.tracking_fa_gl;
      const res = await gasClient.updateInvoice(id, trackingDraft);
      if (res.ok) {
        setInvoice(prev => ({ ...prev, ...trackingDraft }));
        if (isNewFaGl) {
          toast.success('Status tracking disimpan & notifikasi WA otomatis dikirim ke grup FA GL!');
        } else {
          toast.success('Status tracking berhasil diperbarui!');
        }
      } else {
        toast.error(res.message || 'Gagal menyimpan tracking');
      }
    } catch (e) {
      toast.error('Gagal menyimpan: ' + (e.message || 'Kesalahan jaringan'));
    } finally {
      setIsSaving(false);
      hideLoading();
    }
  };

  // Toggle Payment Status (Open vs Paid)
  const handleTogglePaymentStatus = async () => {
    if (!invoice) return;
    const newStatus = invoice.status_pembayaran === 'PAID' ? 'OPEN' : 'PAID';
    const confirmMsg = newStatus === 'PAID'
      ? 'Tandai invoice ini sebagai PAID (Lunas)? Notifikasi WA otomatis akan dikirim ke tim Finance.'
      : 'Kembalikan status invoice ini menjadi OPEN?';

    if (!window.confirm(confirmMsg)) return;

    showLoading();
    try {
      const res = await gasClient.updateInvoice(id, { status_pembayaran: newStatus });
      if (res.ok) {
        setInvoice(prev => ({ ...prev, status_pembayaran: newStatus }));
        toast.success(`Status pembayaran berhasil diubah ke ${newStatus}`);
      } else {
        toast.error(res.message || 'Gagal mengubah status');
      }
    } catch (e) {
      toast.error('Gagal mengubah status: ' + (e.message || 'Kesalahan jaringan'));
    } finally {
      hideLoading();
    }
  };

  // Handle uploading or replacing attachment with max 5MB validation
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isValidType = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!isValidType) {
      e.target.value = '';
      return toast.error('Format lampiran harus berupa PDF atau Gambar (JPG/PNG)');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      e.target.value = '';
      return toast.error(`Ukuran file terlalu besar (${sizeMb} MB)! Batas maksimal lampiran adalah 5MB.`);
    }

    setIsUploadingFile(true);
    showLoading();
    toast.loading('Mengunggah berkas lampiran invoice...', { id: 'upload-toast' });

    try {
      const res = await gasClient.updateInvoice(id, {
        fileData: file,
        fileName: file.name
      });
      toast.dismiss('upload-toast');
      if (res.ok) {
        toast.success('Berkas lampiran berhasil diperbarui');
        fetchDetail();
      } else {
        toast.error(res.message || 'Gagal mengunggah berkas');
      }
    } catch (err) {
      toast.dismiss('upload-toast');
      toast.error('Gagal upload: ' + (err.message || 'Kesalahan jaringan'));
    } finally {
      setIsUploadingFile(false);
      hideLoading();
    }
  };

  // Handle delete invoice
  const handleDeleteInvoice = async () => {
    if (!window.confirm('Yakin ingin menghapus data invoice ini?')) return;
    showLoading();
    try {
      const res = await gasClient.deleteInvoice(id);
      if (res.ok) {
        toast.success('Invoice berhasil dihapus');
        navigate('/invoice');
      } else {
        toast.error(res.message || 'Gagal menghapus');
      }
    } catch (e) {
      toast.error('Kesalahan jaringan saat menghapus');
    } finally {
      hideLoading();
    }
  };

  if (!invoice) {
    return null;
  }

  const isPaid = invoice.status_pembayaran === 'PAID';

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/invoice')}
            className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-xl transition-colors border border-[var(--border)]"
            title="Kembali ke Daftar Invoice"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Dokumen Invoice #{invoice.id}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center space-x-1 ${
                  isPaid
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30'
                }`}
              >
                {isPaid ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <Clock className="w-3.5 h-3.5 mr-1" />}
                {invoice.status_pembayaran || 'OPEN'}
              </span>
            </div>
            <h1 className="text-2xl font-bold font-display text-[var(--foreground)] mt-0.5">
              {invoice.vendor}
            </h1>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center space-x-3 flex-wrap">
          <button
            onClick={handleTogglePaymentStatus}
            className={`inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs ${
              isPaid
                ? 'bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] border-[var(--border)]'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
            }`}
          >
            <CheckCircle className="w-4 h-4 mr-1.5" />
            {isPaid ? 'Ubah ke Status OPEN' : 'Tandai Selesai (PAID)'}
          </button>

          {invoice.file_url && (
            <a
              href={invoice.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3.5 py-2 bg-[var(--background)] hover:bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              <ExternalLink className="w-4 h-4 mr-1.5 text-sky-600" />
              Buka di Drive
            </a>
          )}

          <button
            onClick={handleDeleteInvoice}
            className="p-2 text-ruby-600 hover:text-ruby-700 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 rounded-xl transition-colors border border-transparent hover:border-ruby-200"
            title="Hapus Invoice"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Invoice Overview Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center text-sky-600 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Vendor & Site</p>
            <p className="text-sm font-bold text-[var(--foreground)] line-clamp-1">{invoice.vendor}</p>
            <p className="text-xs text-[var(--muted-foreground)] font-semibold">{invoice.site || '-'}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Nilai Tagihan</p>
            <p className="text-sm font-mono font-bold text-emerald-600">
              Rp {Number(invoice.nilai || 0).toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">Total Invoice</p>
          </div>
        </div>

        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Periode Tagihan</p>
            <p className="text-sm font-bold text-[var(--foreground)]">
              {invoice.periode_start ? formatDateSafe(invoice.periode_start, { month: 'short', year: 'numeric' }) : '-'}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              {formatDateSafe(invoice.periode_start)} s/d {formatDateSafe(invoice.periode_end)}
            </p>
          </div>
        </div>

        <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center text-[var(--primary)] shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Status Tracking</p>
              <span className="text-[11px] font-bold text-[var(--primary)]">
                {workflowProgress.completed}/{workflowProgress.total} ({workflowProgress.percent}%)
              </span>
            </div>
            <div className="w-full bg-[var(--muted)] h-2 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-[var(--primary)] h-full rounded-full transition-all duration-300"
                style={{ width: `${workflowProgress.percent}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
              Diserahkan: <strong className="text-[var(--foreground)]">{formatDateSafe(invoice.tgl_berkas)}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content: Left Tracking Stepper, Right PDF Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: 9 Workflow Tracking Steps (5 Cols) */}
        <div className="lg:col-span-5 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--foreground)] text-sm">Tahapan Tracking Approval</h3>
                <p className="text-xs text-[var(--muted-foreground)]">Pantau tanggal penyerahan berkas setiap level</p>
              </div>
            </div>
            <button
              onClick={handleSaveTracking}
              disabled={isSaving}
              className="inline-flex items-center px-3 py-1.5 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>

          <div className="p-5 space-y-3 overflow-y-auto max-h-[720px]">
            {WORKFLOW_STEPS.map((step, idx) => {
              const val = trackingDraft[step.key] || '';
              const isCompleted = !!val;
              const isNextPending =
                !isCompleted &&
                (idx === 0 || !!trackingDraft[WORKFLOW_STEPS[idx - 1].key]);

              return (
                <div
                  key={step.key}
                  className={`p-3 rounded-xl border transition-all ${
                    isCompleted
                      ? 'bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20'
                      : isNextPending
                      ? 'bg-[var(--card)] border-[var(--primary)]/50 ring-1 ring-[var(--primary)]/20 shadow-xs'
                      : 'bg-[var(--muted)]/20 border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-600 text-white'
                            : isNextPending
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--foreground)] truncate">{step.label}</p>
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          {isCompleted ? `Tercatat: ${val}` : isNextPending ? 'Tahap Selanjutnya' : 'Belum tercatat'}
                        </p>
                      </div>
                    </div>

                    {/* Date Input and Shortcut Buttons */}
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <input
                        type="date"
                        value={val}
                        onChange={(e) => handleDateChange(step.key, e.target.value)}
                        className="px-2 py-1 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs outline-none focus:ring-1 focus:ring-[var(--ring)] text-[var(--foreground)]"
                      />
                      {!isCompleted ? (
                        <button
                          type="button"
                          onClick={() => handleSetToday(step.key)}
                          className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-xs"
                          title="Set tanggal hari ini"
                        >
                          Hari Ini
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleClearStep(step.key)}
                          className="px-1.5 py-1 text-ruby-500 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 rounded-lg text-[11px] transition-colors"
                          title="Hapus tanggal"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
            <span className="text-xs text-[var(--muted-foreground)]">
              Perubahan tracking akan otomatis disinkronkan ke seluruh sistem.
            </span>
            <button
              onClick={handleSaveTracking}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isSaving ? 'Menyimpan...' : 'Simpan Tracking'}
            </button>
          </div>
        </div>

        {/* Right Column: Clean PDF/Image Document Viewer (7 Cols) */}
        <div className="lg:col-span-7 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--background)] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2">
              <Paperclip className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="font-bold text-[var(--foreground)] text-sm">Lampiran Dokumen Invoice</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                Maks. 5MB
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <label className="inline-flex items-center px-2.5 py-1.5 bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] rounded-lg text-xs font-semibold cursor-pointer transition-colors">
                <UploadCloud className="w-3.5 h-3.5 mr-1" />
                {isUploadingFile ? 'Mengunggah...' : invoice.file_url ? 'Ganti Lampiran (Maks 5MB)' : 'Unggah Lampiran (Maks 5MB)'}
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploadingFile}
                />
              </label>

              {drivePreviewUrl && (
                <a
                  href={drivePreviewUrl.replace('/preview', '/view')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-2.5 py-1.5 bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  Tab Baru
                </a>
              )}
            </div>
          </div>

          {/* Embedded Viewer or Empty State */}
          <div className="p-4 bg-[var(--muted)]/20 min-h-[640px] flex flex-col justify-center">
            {drivePreviewUrl ? (
              <div className="w-full h-[700px] rounded-xl overflow-hidden border border-[var(--border)] bg-white shadow-xs">
                <iframe
                  src={drivePreviewUrl}
                  className="w-full h-full border-0"
                  title="Lampiran Invoice Preview"
                  allow="autoplay"
                />
              </div>
            ) : (
              <div className="text-center py-20 px-4 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center text-[var(--muted-foreground)]">
                  <Paperclip className="w-8 h-8" />
                </div>
                <div className="max-w-md">
                  <h4 className="text-base font-bold text-[var(--foreground)]">Belum Ada Berkas Lampiran Terlampir</h4>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Invoice ini belum memiliki berkas fisik lampiran. Anda dapat mengunggah berkas lampiran invoice (format PDF atau Gambar) dengan batas maksimal 5MB.
                  </p>
                </div>
                <label className="inline-flex items-center px-4 py-2 bg-[var(--primary)] text-white hover:bg-teal-700 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm active:scale-95">
                  <UploadCloud className="w-4 h-4 mr-1.5" />
                  Pilih & Unggah Lampiran (Maks. 5MB)
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploadingFile}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
