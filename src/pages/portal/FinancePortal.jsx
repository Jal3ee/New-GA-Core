import React, { useState, useEffect } from 'react';
import { api as gasClient } from '../../lib/gasClient';
import { toast } from 'sonner';
import { useGlobalLoading as useLoading } from '../../context/LoadingContext';
import { Lock, FileText, CheckCircle, ArrowRight, ExternalLink, ShieldCheck, RotateCcw } from 'lucide-react';

export default function FinancePortal() {
  const [sessionToken, setSessionToken] = useState(sessionStorage.getItem('finance_token'));
  const [role, setRole] = useState(sessionStorage.getItem('finance_role') || 'Accounting');
  const [password, setPassword] = useState('');
  const [invoices, setInvoices] = useState([]);
  const { showLoading, hideLoading } = useLoading();

  const fetchInvoices = async () => {
    showLoading();
    try {
      const res = await gasClient.getInvoices();
      if (res.ok) {
        // Only show invoices that have reached Site Manager (i.e., tracking_site_manager is not empty)
        // Or for now, let's just show those that are relevant
        const relevant = res.data.filter(inv => !!inv.tracking_site_manager);
        setInvoices(relevant);
      }
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    if (sessionToken) {
      fetchInvoices();
    }
  }, [sessionToken]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password) return toast.warning('Masukkan password');
    showLoading();
    try {
      const res = await gasClient.authFinancePortal(role, password);
      if (res.ok) {
        toast.success('Login Berhasil');
        sessionStorage.setItem('finance_token', res.data.token);
        sessionStorage.setItem('finance_role', res.data.role);
        setSessionToken(res.data.token);
        setRole(res.data.role);
      } else {
        toast.error(res.message || 'Gagal login');
      }
    } catch(e) {
      toast.error('Kesalahan jaringan');
    } finally {
      hideLoading();
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('finance_token');
    sessionStorage.removeItem('finance_role');
    setSessionToken(null);
  };

  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSetDate = async (invoice) => {
    const today = new Date().toISOString().split('T')[0];
    const key = role === 'Accounting' ? 'tracking_accounting' : 'tracking_fa_gl';
    
    // Optimistic UI update
    setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, [key]: today } : inv));
    showLoading();
    try {
      const res = await gasClient.updateInvoice(invoice.id, { [key]: today });
      if (res.ok) {
        toast.success(`Berhasil set tanggal penerimaan ${role}`);
      } else {
        toast.error(res.message || 'Gagal update tanggal');
        fetchInvoices();
      }
    } catch(e) {
      toast.error('Gagal update tanggal: ' + (e.message || 'Kesalahan jaringan'));
      fetchInvoices();
    } finally {
      hideLoading();
    }
  };

  const handleUpdatePaymentStatus = async (invoice, newStatus) => {
    const confirmMsg = newStatus === 'PAID' 
      ? 'Tandai invoice ini sebagai PAID (Lunas)?' 
      : 'Kembalikan status invoice ini ke OPEN?';
    if (!window.confirm(confirmMsg)) return;
    
    // Optimistic UI update
    setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, status_pembayaran: newStatus } : inv));
    showLoading();
    try {
      const res = await gasClient.updateInvoice(invoice.id, { status_pembayaran: newStatus });
      if (res.ok) {
        toast.success(`Status invoice berhasil diubah ke ${newStatus}`);
      } else {
        toast.error(res.message || 'Gagal mengubah status');
        fetchInvoices();
      }
    } catch(e) {
      toast.error('Gagal mengubah status: ' + (e.message || 'Kesalahan jaringan'));
      fetchInvoices();
    } finally {
      hideLoading();
    }
  };

  const getDrivePreviewUrl = (url) => {
    if (!url) return null;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/preview`;
    }
    return url;
  };

  const filteredInvoices = invoices.filter(inv => {
    const term = searchTerm.toLowerCase();
    return (
      String(inv.vendor || '').toLowerCase().includes(term) ||
      String(inv.site || '').toLowerCase().includes(term)
    );
  });

  if (!sessionToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="max-w-md w-full bg-[var(--card)] p-8 rounded-2xl shadow-xl border border-[var(--border)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4">
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--foreground)] font-display">Finance Portal</h1>
            <p className="text-[var(--muted-foreground)] mt-2 text-sm">Akses khusus tim Finance (Accounting & FA GL) untuk validasi Invoice GA.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Login Sebagai</label>
              <select 
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Accounting">Accounting</option>
                <option value="FA GL">Finance & Accounting GL</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Portal Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-[var(--muted-foreground)]" />
                </div>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow font-mono"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-sm active:scale-[0.98]">
              Akses Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <header className="h-16 bg-[var(--card)] border-b border-[var(--border)] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="font-bold font-display text-[var(--foreground)]">Finance Portal</h1>
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-bold">{role} ACCESS</p>
          </div>
        </div>
        <button onClick={handleLogout} className="px-4 py-2 text-sm text-[var(--muted-foreground)] hover:text-ruby-600 hover:bg-ruby-50 rounded-lg transition-colors font-medium">
          Keluar
        </button>
      </header>

      <main className="flex-1 overflow-auto p-6 lg:p-10 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[var(--foreground)] font-display">Daftar Invoice Menunggu</h2>
            <p className="text-[var(--muted-foreground)]">Hanya menampilkan invoice yang telah disetujui oleh Site Manager GA.</p>
          </div>
          <div className="w-full md:w-72">
            <input 
              type="text"
              placeholder="Cari vendor atau site..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-[var(--border)] rounded-2xl">
              <FileText className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3 opacity-50" />
              <p className="text-[var(--muted-foreground)] font-medium">Belum ada invoice yang perlu diproses.</p>
            </div>
          ) : (
            filteredInvoices.map(inv => {
              const myTrackingDate = role === 'Accounting' ? inv.tracking_accounting : inv.tracking_fa_gl;
              const isPaid = inv.status_pembayaran === 'PAID';

              return (
                <div key={inv.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-emerald-500/30 transition-colors">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-emerald-200">
                        {inv.vendor}
                      </span>
                      {isPaid ? (
                        <span className="flex items-center text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> PAID
                        </span>
                      ) : (
                        <span className="flex items-center text-amber-600 text-xs font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          PENDING {myTrackingDate ? 'CLOSING' : role.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-[var(--foreground)] text-lg">Periode: {inv.periode_start} s/d {inv.periode_end}</h3>
                    <div className="text-sm font-mono text-emerald-600 font-bold">Rp {Number(inv.nilai || 0).toLocaleString('id-ID')}</div>
                    <div className="text-xs text-[var(--muted-foreground)] grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 bg-[var(--muted)]/40 p-3 rounded-lg border border-[var(--border)]">
                      <p><span className="font-semibold text-[var(--foreground)]">Site:</span> {inv.site || '-'}</p>
                      <p><span className="font-semibold text-[var(--foreground)]">GA Admin:</span> {inv.tracking_admin_ga ? new Date(inv.tracking_admin_ga).toLocaleDateString('id-ID') : '-'}</p>
                      <p><span className="font-semibold text-[var(--foreground)]">Site Manager:</span> {inv.tracking_site_manager ? new Date(inv.tracking_site_manager).toLocaleDateString('id-ID') : '-'}</p>
                      <p><span className="font-semibold text-[var(--foreground)]">Accounting:</span> {inv.tracking_accounting ? new Date(inv.tracking_accounting).toLocaleDateString('id-ID') : '-'}</p>
                      <p><span className="font-semibold text-[var(--foreground)]">FA GL:</span> {inv.tracking_fa_gl ? new Date(inv.tracking_fa_gl).toLocaleDateString('id-ID') : '-'}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 border-t md:border-t-0 md:border-l border-[var(--border)] pt-4 md:pt-0 md:pl-6">
                    {inv.file_url && (
                      <button 
                        onClick={() => setPreviewPdfUrl(getDrivePreviewUrl(inv.file_url))}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)] rounded-lg text-sm font-medium transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 mr-2 text-sky-600" />
                        Preview PDF
                      </button>
                    )}
                    
                    {!myTrackingDate && !isPaid && (
                      <button onClick={() => handleSetDate(inv)} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-sky-600 text-white hover:bg-sky-700 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95">
                        Set Diterima {role}
                      </button>
                    )}

                    {role === 'FA GL' && (
                      !isPaid ? (
                        <button onClick={() => handleUpdatePaymentStatus(inv, 'PAID')} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-[var(--primary)] text-white hover:opacity-90 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Close & PAID
                        </button>
                      ) : (
                        <button onClick={() => handleUpdatePaymentStatus(inv, 'OPEN')} className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-lg text-xs font-semibold transition-colors">
                          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                          Re-open (Set OPEN)
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* PDF Quick Preview Modal via Google Drive Native Iframe */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--card)] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl border border-[var(--border)] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--background)]">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-[var(--foreground)]">Dokumen Invoice</h3>
              </div>
              <div className="flex items-center space-x-2">
                <a 
                  href={previewPdfUrl.replace('/preview', '/view')} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center"
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
    </div>
  );
}
