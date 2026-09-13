import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  UploadCloud,
  Printer,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  ChevronRight,
  ShieldAlert,
  Building,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  Trash2,
  DollarSign
} from 'lucide-react';
import { api as gasClient } from '../../lib/gasClient';
import initialIncidents from '../../data/initialCateringIncidents.json';
import { printCateringIncident } from '../../utils/cateringIncidentPrint';

const VENDORS_LIST = [
  { id: 'VEND-ABS', name: 'CV ABS', catering: 'Catering GAS', site: 'LBCT' },
  { id: 'VEND-MOMS', name: 'CV Moms Ainun', catering: "Catering Mom's", site: 'IDMG' },
  { id: 'VEND-SANDAGA', name: 'PT Sandaga Perkasa', catering: 'Catering Sandaga', site: 'SPCT' },
  { id: 'VEND-MANGGALA', name: 'CV Manggala Raya', catering: 'Catering Manggala raya', site: 'LBCT' }
];

const CATEGORIES = [
  'Higiene & Sanitasi',
  'Kualitas & Cita Rasa Makanan',
  'Benda Asing (Food Hazard)',
  'Ketepatan Waktu / Distribusi',
  'Kelengkapan Menu & Porsi',
  'Kepatuhan APD Petugas',
  'Kelayakan Sarana / Dapur',
  'Lain-lain'
];

const ACTION_TYPES = [
  'Teguran Lisan',
  'Surat Teguran 1',
  'Surat Teguran 2',
  'Surat Peringatan 1 (SP 1)',
  'Surat Peringatan 2 (SP 2)',
  'Surat Peringatan 3 (SP 3)',
  'Denda / Pinalti Finansial',
  'Tindakan Korektif Langsung'
];

export default function CateringIncidentsPage() {
  // State: Incidents data
  const [incidents, setIncidents] = useState(() => {
    try {
      const saved = localStorage.getItem('garda_catering_incidents');
      if (saved) return JSON.parse(saved);
    } catch {}
    return initialIncidents;
  });

  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSite, setFilterSite] = useState('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Form State for New Incident
  const [formData, setFormData] = useState({
    site: 'LBCT',
    vendor_id: 'VEND-ABS',
    vendor_name: 'CV ABS',
    catering_name: 'Catering GAS',
    incident_date: new Date().toISOString().slice(0, 10),
    category: 'Higiene & Sanitasi',
    severity: 'Sedang',
    reporter_name: '',
    title: '',
    description: '',
    evidence_urls: '',
    action_type: 'Teguran Lisan',
    action_details: '',
    penalty_amount: 0,
    target_completion_date: '',
    actual_completion_date: '',
    action_evidence_urls: '',
    status: 'Open',
    verification_notes: ''
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('garda_catering_incidents', JSON.stringify(incidents));
    } catch {}
  }, [incidents]);

  // Sync with Remote GAS Database
  const syncWithDatabase = async () => {
    setIsLoading(true);
    try {
      const res = await gasClient.getCateringIncidents();
      if (res?.ok && Array.isArray(res.data) && res.data.length > 0) {
        setIncidents(res.data);
        toast.success(`Berhasil menarik ${res.data.length} data temuan dari spreadsheet!`);
      } else {
        toast.info('Spreadsheet kosong atau menggunakan data lokal aktif.');
      }
    } catch (err) {
      console.warn('Sync catering incidents failed:', err);
      toast.info('Sinkronisasi selesai (database lokal aktif).');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-sync on mount
  useEffect(() => {
    syncWithDatabase();
  }, []);

  // Push Local to Spreadsheet
  const handlePushToDatabase = async () => {
    if (!incidents || incidents.length === 0) {
      toast.error('Tidak ada data temuan untuk diunggah.');
      return;
    }

    const confirmPush = window.confirm(
      `Unggah ${incidents.length} data temuan katering ke spreadsheet database (tbl_catering_incidents)? Data di spreadsheet akan disinkronkan.`
    );
    if (!confirmPush) return;

    setIsLoading(true);
    try {
      const res = await gasClient.batchImportCateringIncidents(incidents, 'replace');
      if (res?.ok) {
        toast.success(`Berhasil mengunggah ${res.count || incidents.length} data ke spreadsheet!`);
      } else {
        toast.error('Gagal mengunggah: ' + (res?.error || 'Koneksi gagal'));
      }
    } catch (err) {
      console.error('Push error:', err);
      toast.error('Gagal mengunggah ke spreadsheet: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Vendor selection handler in form
  const handleVendorSelect = (vendorId) => {
    const v = VENDORS_LIST.find(item => item.id === vendorId);
    if (v) {
      setFormData(prev => ({
        ...prev,
        vendor_id: v.id,
        vendor_name: v.name,
        catering_name: v.catering,
        site: v.site
      }));
    }
  };

  // Submit New Incident
  const handleSubmitNewIncident = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.reporter_name) {
      toast.error('Mohon lengkapi judul temuan dan nama pelapor.');
      return;
    }

    const nextId = `INC-${Date.now().toString().slice(-6)}`;
    const nextReportNo = `NCR-CAT-2026-${String(incidents.length + 1).padStart(3, '0')}`;
    const newRecord = {
      ...formData,
      id: nextId,
      report_number: nextReportNo,
      penalty_amount: Number(formData.penalty_amount) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setIsLoading(true);
    try {
      // Optimistic state update
      const updatedList = [newRecord, ...incidents];
      setIncidents(updatedList);
      setIsCreateModalOpen(false);
      toast.success(`Temuan ${nextReportNo} berhasil dicatat!`);

      // Try background remote save
      gasClient.createCateringIncident(newRecord).catch(err => {
        console.warn('Background save to GAS delayed:', err);
      });
    } catch (err) {
      toast.error('Gagal menyimpan: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Update Existing Incident (Status / Follow-up / Notes)
  const handleUpdateIncident = async (e) => {
    e.preventDefault();
    if (!selectedIncident) return;

    setIsLoading(true);
    try {
      const updatedList = incidents.map(item => {
        if (item.id === selectedIncident.id) {
          return {
            ...selectedIncident,
            updated_at: new Date().toISOString()
          };
        }
        return item;
      });

      setIncidents(updatedList);
      setIsDetailModalOpen(false);
      toast.success(`Tindak lanjut ${selectedIncident.report_number || selectedIncident.id} berhasil diperbarui!`);

      // Push update to GAS
      gasClient.updateCateringIncident(selectedIncident.id, selectedIncident).catch(err => {
        console.warn('Background update to GAS delayed:', err);
      });
    } catch (err) {
      toast.error('Gagal memperbarui: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Incident
  const handleDeleteIncident = async (id, reportNum) => {
    if (!window.confirm(`Yakin ingin menghapus temuan ${reportNum || id}?`)) return;

    setIsLoading(true);
    try {
      const updatedList = incidents.filter(item => item.id !== id);
      setIncidents(updatedList);
      if (isDetailModalOpen && selectedIncident?.id === id) {
        setIsDetailModalOpen(false);
      }
      toast.success(`Laporan ${reportNum || id} berhasil dihapus.`);

      gasClient.deleteCateringIncident(id).catch(err => {
        console.warn('Delete in GAS delayed:', err);
      });
    } catch (err) {
      toast.error('Gagal menghapus: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered Records
  const filteredIncidents = useMemo(() => {
    return incidents.filter(item => {
      if (filterSite !== 'all' && item.site !== filterSite) return false;
      if (filterVendor !== 'all' && item.vendor_id !== filterVendor) return false;
      if (filterStatus !== 'all' && item.status !== filterStatus) return false;
      if (filterSeverity !== 'all' && item.severity !== filterSeverity) return false;
      if (filterAction !== 'all' && !item.action_type?.includes(filterAction)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchRep = item.report_number?.toLowerCase().includes(q);
        const matchAuditor = item.reporter_name?.toLowerCase().includes(q);
        const matchVendor = item.vendor_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchRep && !matchAuditor && !matchVendor) {
          return false;
        }
      }
      return true;
    });
  }, [incidents, filterSite, filterVendor, filterStatus, filterSeverity, filterAction, searchQuery]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = incidents.length;
    const open = incidents.filter(i => i.status === 'Open').length;
    const inProgress = incidents.filter(i => i.status === 'Dalam Tindak Lanjut').length;
    const closed = incidents.filter(i => i.status === 'Closed').length;

    // SP count
    const spCount = incidents.filter(i => i.action_type?.includes('SP')).length;
    const teguranCount = incidents.filter(i => i.action_type?.includes('Teguran')).length;
    const totalPenalty = incidents.reduce((sum, i) => sum + (Number(i.penalty_amount) || 0), 0);

    return { total, open, inProgress, closed, spCount, teguranCount, totalPenalty };
  }, [incidents]);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'Kritis':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'Tinggi':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Sedang':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-sky-50 text-sky-700 border-sky-200';
    }
  };

  const getActionBadge = (actionType) => {
    if (!actionType) return 'bg-slate-50 text-slate-700 border-slate-200';
    if (actionType.includes('SP 3')) return 'bg-purple-50 text-purple-800 border-purple-300 font-bold';
    if (actionType.includes('SP 2')) return 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
    if (actionType.includes('SP 1')) return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
    if (actionType.includes('Teguran')) return 'bg-blue-50 text-blue-700 border-blue-200 font-medium';
    if (actionType.includes('Denda')) return 'bg-red-50 text-red-700 border-red-200 font-bold';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Closed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Dalam Tindak Lanjut':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Top Navigation Switcher */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <Link
            to="/catering/scoring"
            className="px-4 py-2 text-sm font-semibold rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50 transition-colors"
          >
            Scoring & Food Index
          </Link>
          <div className="px-4 py-2 text-sm font-bold rounded-lg bg-[var(--primary)] text-white shadow-xs">
            Temuan & Tindakan / Sanksi
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={syncWithDatabase}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors shadow-xs"
            title="Tarik pembaruan dari spreadsheet"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--primary)] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Tarik Data</span>
          </button>
          <button
            onClick={handlePushToDatabase}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-colors shadow-xs"
            title="Unggah dan simpan data ke Google Sheet tbl_catering_incidents"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Unggah ke Spreadsheet</span>
          </button>
        </div>
      </div>

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] font-display flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            Laporan Temuan & Tindakan Disiplin Katering
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Log insiden mutu pangan, pemberian sanksi (teguran lisan hingga SP), evaluasi denda, serta monitoring penyelesaian perbaikan vendor.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              site: 'LBCT',
              vendor_id: 'VEND-ABS',
              vendor_name: 'CV ABS',
              catering_name: 'Catering GAS',
              incident_date: new Date().toISOString().slice(0, 10),
              category: 'Higiene & Sanitasi',
              severity: 'Sedang',
              reporter_name: '',
              title: '',
              description: '',
              evidence_urls: '',
              action_type: 'Teguran Lisan',
              action_details: '',
              penalty_amount: 0,
              target_completion_date: '',
              actual_completion_date: '',
              action_evidence_urls: '',
              status: 'Open',
              verification_notes: ''
            });
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-[var(--primary)] text-white hover:opacity-90 transition-opacity shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Lapor Temuan / Buat Tindakan</span>
        </button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-1">
            <span className="text-xs font-medium">Total Temuan</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--foreground)]">{stats.total}</div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Tercatat di sistem</p>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-1">
            <span className="text-xs font-medium">Status Open</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600">{stats.open}</div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Menunggu respon vendor</p>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-1">
            <span className="text-xs font-medium">Dalam Tindak Lanjut</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600">{stats.inProgress}</div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Sedang diperbaiki vendor</p>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-1">
            <span className="text-xs font-medium">Terselesaikan (Closed)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">{stats.closed}</div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Verifikasi GA selesai</p>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-1">
            <span className="text-xs font-medium">Sanksi & Denda</span>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-lg font-bold font-mono text-purple-700">
            {stats.spCount} SP / {stats.teguranCount} Teguran
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
            Denda: {formatCurrency(stats.totalPenalty)}
          </p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Cari nomor NCR, judul temuan, pelapor, atau rincian..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
            >
              <option value="all">Semua Site</option>
              <option value="LBCT">Site LBCT</option>
              <option value="IDMG">Site IDMG</option>
              <option value="SPCT">Site SPCT</option>
            </select>

            <select
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
            >
              <option value="all">Semua Vendor</option>
              {VENDORS_LIST.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
            >
              <option value="all">Semua Status</option>
              <option value="Open">Open</option>
              <option value="Dalam Tindak Lanjut">Dalam Tindak Lanjut</option>
              <option value="Closed">Closed</option>
            </select>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
            >
              <option value="all">Semua Keparahan</option>
              <option value="Rendah">Rendah</option>
              <option value="Sedang">Sedang</option>
              <option value="Tinggi">Tinggi</option>
              <option value="Kritis">Kritis</option>
            </select>

            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
            >
              <option value="all">Semua Tindakan</option>
              <option value="Teguran">Teguran (Lisan/1/2)</option>
              <option value="SP">Surat Peringatan (SP)</option>
              <option value="Denda">Denda Finansial</option>
              <option value="Korektif">Tindakan Korektif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table of Incidents */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--muted)]/40 border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <th className="py-3 px-4 font-semibold">No. Laporan & Tgl</th>
                <th className="py-3 px-4 font-semibold">Vendor & Site</th>
                <th className="py-3 px-4 font-semibold">Temuan & Kategori</th>
                <th className="py-3 px-4 font-semibold text-center">Keparahan</th>
                <th className="py-3 px-4 font-semibold">Tindakan / Sanksi</th>
                <th className="py-3 px-4 font-semibold">Target SLA</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredIncidents.length > 0 ? (
                filteredIncidents.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono font-bold text-[var(--foreground)]">{item.report_number || item.id}</div>
                      <div className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {item.incident_date}
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-[var(--foreground)]">{item.vendor_name}</div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">
                        Site <span className="font-medium text-[var(--foreground)]">{item.site}</span> • {item.catering_name}
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-[var(--foreground)] line-clamp-1" title={item.title}>
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[var(--primary)] mt-0.5">
                        {item.category}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 text-[11px] rounded-full border font-semibold ${getSeverityBadge(item.severity)}`}>
                        {item.severity}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 text-[11px] rounded-md border ${getActionBadge(item.action_type)}`}>
                        {item.action_type}
                      </span>
                      {item.penalty_amount > 0 && (
                        <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                          Denda: {formatCurrency(item.penalty_amount)}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-[11px]">
                      <div className="font-medium text-[var(--foreground)]">
                        {item.target_completion_date || '-'}
                      </div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">
                        {item.actual_completion_date ? `Selesai: ${item.actual_completion_date}` : 'Target Max'}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 text-[11px] rounded-full border font-semibold ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => printCateringIncident(item)}
                          className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                          title="Cetak Berita Acara Temuan (PDF)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedIncident({ ...item });
                            setIsDetailModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 text-xs font-semibold transition-colors"
                        >
                          Detail & Tindak Lanjut
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-[var(--muted-foreground)]">
                    Tidak ditemukan laporan temuan katering yang sesuai dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Input Laporan Temuan Baru */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <h3 className="text-lg font-bold text-[var(--foreground)]">Formulir Temuan & Tindakan Katering</h3>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitNewIncident} className="space-y-4 text-xs">
                {/* Section A: Info Dasar */}
                <div className="bg-[var(--muted)]/30 p-3.5 rounded-xl border border-[var(--border)] space-y-3">
                  <div className="font-semibold text-xs text-[var(--foreground)] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[var(--primary)]"></span>
                    1. Identitas Lokasi & Vendor
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Vendor Katering *</label>
                      <select
                        value={formData.vendor_id}
                        onChange={(e) => handleVendorSelect(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                      >
                        {VENDORS_LIST.map(v => (
                          <option key={v.id} value={v.id}>{v.name} ({v.catering})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Site Operasional</label>
                      <input
                        type="text"
                        disabled
                        value={`Site ${formData.site}`}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Tanggal Kejadian / Temuan *</label>
                      <input
                        type="date"
                        required
                        value={formData.incident_date}
                        onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Nama Auditor / Pelapor GA *</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Fauzan GA / Bambang HSE"
                        value={formData.reporter_name}
                        onChange={(e) => setFormData({ ...formData, reporter_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Detail Temuan */}
                <div className="bg-[var(--muted)]/30 p-3.5 rounded-xl border border-[var(--border)] space-y-3">
                  <div className="font-semibold text-xs text-[var(--foreground)] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    2. Rincian & Bukti Temuan
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Kategori Masalah *</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Tingkat Keparahan *</label>
                      <select
                        value={formData.severity}
                        onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-semibold"
                      >
                        <option value="Rendah">Rendah (Penyimpangan minor)</option>
                        <option value="Sedang">Sedang (Perlu perbaikan segera)</option>
                        <option value="Tinggi">Tinggi (Berdampak pada cita rasa/kesehatan)</option>
                        <option value="Kritis">Kritis (Food hazard, kontaminan bahaya)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--muted-foreground)] mb-1">Judul Ringkas Temuan *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Ditemukan kawat pembersih pada sup ayam"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-medium"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--muted-foreground)] mb-1">Uraian / Kronologi Temuan *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Jelaskan detail lokasi temuan, waktu, jumlah porsi terdampak, dan kondisi fisik..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--muted-foreground)] mb-1">Tautan Lampiran Bukti Temuan (Foto / Dokumen Google Drive)</label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/.../view"
                      value={formData.evidence_urls}
                      onChange={(e) => setFormData({ ...formData, evidence_urls: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* Section C: Tindakan Yang Diambil / Sanksi */}
                <div className="bg-[var(--muted)]/30 p-3.5 rounded-xl border border-[var(--border)] space-y-3">
                  <div className="font-semibold text-xs text-[var(--foreground)] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    3. Tindakan Yang Diambil & Sanksi Vendor
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Tingkatan Tindakan / Sanksi *</label>
                      <select
                        value={formData.action_type}
                        onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-bold text-purple-700"
                      >
                        {ACTION_TYPES.map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Nominal Denda / Pinalti Finansial (Rp)</label>
                      <input
                        type="number"
                        min="0"
                        step="100000"
                        placeholder="0 jika tanpa denda"
                        value={formData.penalty_amount}
                        onChange={(e) => setFormData({ ...formData, penalty_amount: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--muted-foreground)] mb-1">Rincian Tindakan / Instruksi Perbaikan</label>
                    <textarea
                      rows={2}
                      placeholder="Contoh: Diberikan surat teguran I, wajib ganti alat masak dan re-briefing seluruh juru masak..."
                      value={formData.action_details}
                      onChange={(e) => setFormData({ ...formData, action_details: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Batas Waktu Perbaikan (Target SLA)</label>
                      <input
                        type="date"
                        value={formData.target_completion_date}
                        onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Status Laporan Awal</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                      >
                        <option value="Open">Open (Baru Dilaporkan)</option>
                        <option value="Dalam Tindak Lanjut">Dalam Tindak Lanjut</option>
                        <option value="Closed">Closed (Sudah Langsung Selesai)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--muted-foreground)] mb-1">Tautan Lampiran Dokumen Tindakan (Surat Teguran / Scan SP / Foto Perbaikan)</label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/.../view"
                      value={formData.action_evidence_urls}
                      onChange={(e) => setFormData({ ...formData, action_evidence_urls: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono text-[11px]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] font-semibold text-[var(--foreground)] transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 rounded-xl bg-[var(--primary)] text-white hover:opacity-90 font-semibold shadow-xs transition-opacity"
                  >
                    Simpan & Terbitkan Laporan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: Detail & Update Tindak Lanjut */}
      <AnimatePresence>
        {isDetailModalOpen && selectedIncident && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-5 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--muted)] font-bold">
                      {selectedIncident.report_number || selectedIncident.id}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full border font-semibold ${getStatusBadge(selectedIncident.status)}`}>
                      {selectedIncident.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[var(--foreground)] mt-1">{selectedIncident.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => printCateringIncident(selectedIncident)}
                    className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
                    title="Cetak Berita Acara PDF"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="p-1 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdateIncident} className="space-y-4 text-xs">
                {/* Info Display Box */}
                <div className="bg-[var(--muted)]/30 p-3.5 rounded-xl border border-[var(--border)] grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-[var(--muted-foreground)]">Vendor:</span> <strong className="text-[var(--foreground)]">{selectedIncident.vendor_name} ({selectedIncident.catering_name})</strong></div>
                  <div><span className="text-[var(--muted-foreground)]">Site Operasional:</span> <strong className="text-[var(--foreground)]">Site {selectedIncident.site}</strong></div>
                  <div><span className="text-[var(--muted-foreground)]">Tgl Kejadian:</span> <strong className="text-[var(--foreground)]">{selectedIncident.incident_date}</strong></div>
                  <div><span className="text-[var(--muted-foreground)]">Pelapor GA:</span> <strong className="text-[var(--foreground)]">{selectedIncident.reporter_name}</strong></div>
                  <div><span className="text-[var(--muted-foreground)]">Kategori:</span> <strong className="text-[var(--foreground)]">{selectedIncident.category}</strong></div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">Keparahan:</span>{' '}
                    <span className={`px-2 py-0.5 rounded text-[10px] border font-bold ${getSeverityBadge(selectedIncident.severity)}`}>
                      {selectedIncident.severity}
                    </span>
                  </div>
                </div>

                {/* Deskripsi & Bukti Temuan */}
                <div className="space-y-1.5">
                  <div className="font-semibold text-[var(--foreground)]">Kronologi Kejadian:</div>
                  <div className="p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] leading-relaxed">
                    {selectedIncident.description}
                  </div>
                  {selectedIncident.evidence_urls && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--primary)] pt-1">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <a href={selectedIncident.evidence_urls} target="_blank" rel="noreferrer" className="hover:underline font-semibold">
                        Lihat Lampiran Bukti Temuan Awal
                      </a>
                    </div>
                  )}
                </div>

                {/* Update Action & Resolution */}
                <div className="bg-[var(--muted)]/20 p-3.5 rounded-xl border border-[var(--border)] space-y-3">
                  <div className="font-semibold text-xs text-[var(--foreground)]">Tindakan Yang Diambil & Pelacakan Komitmen:</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Jenis Tindakan / Sanksi</label>
                      <select
                        value={selectedIncident.action_type}
                        onChange={(e) => setSelectedIncident({ ...selectedIncident, action_type: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-bold text-purple-700"
                      >
                        {ACTION_TYPES.map(a => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Status Progres *</label>
                      <select
                        value={selectedIncident.status}
                        onChange={(e) => setSelectedIncident({ ...selectedIncident, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-bold"
                      >
                        <option value="Open">Open (Belum Ada Tindakan)</option>
                        <option value="Dalam Tindak Lanjut">Dalam Tindak Lanjut (Proses Perbaikan)</option>
                        <option value="Closed">Closed (Tindakan Selesai & Terverifikasi)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--muted-foreground)] mb-1">Rincian Tindakan / Sanksi / Memo</label>
                    <textarea
                      rows={2}
                      value={selectedIncident.action_details || ''}
                      onChange={(e) => setSelectedIncident({ ...selectedIncident, action_details: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Target Batas Waktu (SLA)</label>
                      <input
                        type="date"
                        value={selectedIncident.target_completion_date || ''}
                        onChange={(e) => setSelectedIncident({ ...selectedIncident, target_completion_date: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[var(--muted-foreground)] mb-1">Tanggal Realisasi Selesai</label>
                      <input
                        type="date"
                        value={selectedIncident.actual_completion_date || ''}
                        onChange={(e) => setSelectedIncident({ ...selectedIncident, actual_completion_date: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--muted-foreground)] mb-1">Tautan Lampiran Bukti Aksi / Dokumen Surat Sanksi</label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/.../view"
                      value={selectedIncident.action_evidence_urls || ''}
                      onChange={(e) => setSelectedIncident({ ...selectedIncident, action_evidence_urls: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono text-[11px]"
                    />
                    {selectedIncident.action_evidence_urls && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--primary)]">
                        <ExternalLink className="w-3 h-3" />
                        <a href={selectedIncident.action_evidence_urls} target="_blank" rel="noreferrer" className="hover:underline">
                          Buka tautan lampiran aksi saat ini
                        </a>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-medium text-[var(--muted-foreground)] mb-1">Catatan Evaluasi / Verifikasi GA</label>
                    <textarea
                      rows={2}
                      placeholder="Tuliskan catatan hasil inspeksi ulang setelah perbaikan dilakukan..."
                      value={selectedIncident.verification_notes || ''}
                      onChange={(e) => setSelectedIncident({ ...selectedIncident, verification_notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => handleDeleteIncident(selectedIncident.id, selectedIncident.report_number)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Laporan</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDetailModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--muted)] font-semibold text-[var(--foreground)] transition-colors"
                    >
                      Tutup
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-5 py-2 rounded-xl bg-[var(--primary)] text-white hover:opacity-90 font-semibold shadow-xs transition-opacity"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
