import React, { useState, useEffect } from 'react';
import { api as gasClient } from '../../lib/gasClient';
import { toast } from 'sonner';
import { useGlobalLoading as useLoading } from '../../context/LoadingContext';
import { Lock, FileText, CheckCircle, ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';

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

  const handleSetDate = async (invoice) => {
    const today = new Date().toISOString().split('T')[0];
    const key = role === 'Accounting' ? 'tracking_accounting' : 'tracking_fa_gl';
    
    showLoading();
    try {
      const res = await gasClient.updateInvoice(invoice.id, { [key]: today });
      if (res.ok) {
        toast.success(`Berhasil set tanggal penerimaan ${role}`);
        fetchInvoices();
      }
    } catch(e) {
      toast.error('Gagal update tanggal');
    } finally {
      hideLoading();
    }
  };

  const handleMarkPaid = async (invoice) => {
    if (!window.confirm('Tandai invoice ini sebagai PAID?')) return;
    showLoading();
    try {
      const res = await gasClient.updateInvoice(invoice.id, { status_pembayaran: 'PAID' });
      if (res.ok) {
        toast.success('Invoice berhasil ditutup');
        fetchInvoices();
      }
    } catch(e) {
      toast.error('Gagal menutup invoice');
    } finally {
      hideLoading();
    }
  };

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
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--foreground)] font-display">Daftar Invoice Menunggu</h2>
          <p className="text-[var(--muted-foreground)]">Hanya menampilkan invoice yang telah disetujui oleh Site Manager GA.</p>
        </div>

        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-[var(--border)] rounded-2xl">
              <FileText className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3 opacity-50" />
              <p className="text-[var(--muted-foreground)] font-medium">Belum ada invoice yang perlu diproses.</p>
            </div>
          ) : (
            invoices.map(inv => {
              const myTrackingDate = role === 'Accounting' ? inv.tracking_accounting : inv.tracking_fa_gl;
              const isPaid = inv.status_pembayaran === 'PAID';

              return (
                <div key={inv.id} className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                        {inv.vendor}
                      </span>
                      {isPaid && (
                        <span className="flex items-center text-emerald-600 text-xs font-bold">
                          <CheckCircle className="w-4 h-4 mr-1" /> PAID
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-[var(--foreground)] text-lg">Periode: {inv.periode_start} s/d {inv.periode_end}</h3>
                    <div className="text-sm font-mono text-emerald-600 font-bold">Rp {Number(inv.nilai || 0).toLocaleString('id-ID')}</div>
                    <div className="text-sm text-[var(--muted-foreground)] space-y-1 mt-2">
                      <p>• Site: {inv.site || '-'}</p>
                      <p>• GA Admin: {inv.tracking_admin_ga ? new Date(inv.tracking_admin_ga).toLocaleDateString() : '-'}</p>
                      <p>• Site Manager: {inv.tracking_site_manager ? new Date(inv.tracking_site_manager).toLocaleDateString() : '-'}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 border-t md:border-t-0 md:border-l border-[var(--border)] pt-4 md:pt-0 md:pl-6">
                    {inv.file_url && (
                      <a href={inv.file_url} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-[var(--muted)] text-[var(--foreground)] hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Lihat PDF
                      </a>
                    )}
                    
                    {!myTrackingDate && !isPaid && (
                      <button onClick={() => handleSetDate(inv)} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-sky-600 text-white hover:bg-sky-700 rounded-lg text-sm font-bold transition-colors shadow-sm">
                        Set Diterima {role}
                      </button>
                    )}

                    {myTrackingDate && role === 'FA GL' && !isPaid && (
                      <button onClick={() => handleMarkPaid(inv)} className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-bold transition-colors shadow-sm">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Close & PAID
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
