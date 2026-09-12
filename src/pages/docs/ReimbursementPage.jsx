import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  RotateCcw,
  FileDown,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Edit,
  ExternalLink,
  Users,
  Building,
  CheckSquare,
  Square,
  DownloadCloud,
  Check,
  X,
  UploadCloud,
  Layers,
  ArrowUpDown,
  Printer
} from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';
import initialReimbursementData from '../../data/initialReimbursementData.json';
import {
  compileReimbursementPdf,
  openReimbursementPrintWindow,
  formatRupiah
} from '../../utils/reimbursementPdfCompiler';
import { api as gasClient } from '../../lib/gasClient';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function ReimbursementPage() {
  // State: Main records
  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('garda_reimbursements_data');
      if (saved) return JSON.parse(saved);
    } catch {}
    return initialReimbursementData;
  });

  // State: UI & Controls
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('Januari');
  const [selectedPeriodCut, setSelectedPeriodCut] = useState('all'); // 'all', 'p1', 'p2'
  const [selectedSite, setSelectedSite] = useState('all');
  const [selectedStatusFinance, setSelectedStatusFinance] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isCompileModalOpen, setIsCompileModalOpen] = useState(false);
  const [isEditFinanceModalOpen, setIsEditFinanceModalOpen] = useState(false);
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null);
  const [isBatchEdit, setIsBatchEdit] = useState(false);
  const [compileProgress, setCompileProgress] = useState(null);

  // Compile options
  const [compileOptions, setCompileOptions] = useState({
    includeCover: true,
    includeBuktiCuti: true,
    includeNotaBerangkat: true,
    includeNotaPulang: true
  });

  // Finance edit form state
  const [financeForm, setFinanceForm] = useState({
    nominal: 0,
    status_finance: 'Diajukan',
    tgl_pengajuan_finance: '',
    tgl_pencairan_finance: '',
    catatan: ''
  });

  // File import ref
  const fileImportRef = useRef(null);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('garda_reimbursements_data', JSON.stringify(records));
    } catch {}
  }, [records]);

  // Sync with remote spreadsheet if configured
  const syncWithDatabase = async () => {
    setIsLoading(true);
    try {
      const res = await gasClient.getReimbursements();
      if (res?.ok && Array.isArray(res.data) && res.data.length > 0) {
        setRecords(res.data);
        toast.success(`Berhasil sinkronisasi ${res.data.length} data dari spreadsheet!`);
      } else {
        toast.info('Data reimbursement lokal aktif.');
      }
    } catch (err) {
      console.warn('Sync failed, using local data:', err);
      toast.info('Sinkronisasi selesai (menggunakan database lokal)');
    } finally {
      setIsLoading(false);
    }
  };

  // CSV Import handler
  const handleCsvImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result;
        if (!text) return;

        // Parse CSV
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const imported = [];

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map(p => p.replace(/^"|"$/g, '').trim());
          if (!parts[1] || !parts[1].toLowerCase().includes('reimburse')) continue;

          const timestamp = parts[0] || '';
          const nama = parts[18] || '';
          const nik = parts[19] || '';
          const no_hp = parts[20] || '';
          const status = parts[21] || 'CUTI';
          const departemen = parts[22] || '';
          const url_bukti_cuti = parts[23] || '';
          const url_nota_berangkat = parts[24] || '';
          const tgl_berangkat = parts[25] || '';
          const tgl_pulang = parts[26] || '';
          const site = parts[39] || 'LBCT';
          const url_nota_pulang = parts[40] || '';

          // Determine period
          const dayPart = parseInt(timestamp.split(' ')[0]?.split('/')?.[0] || '1', 10);
          const monthPart = parseInt(timestamp.split(' ')[0]?.split('/')?.[1] || '1', 10);
          const monthName = MONTHS[monthPart - 1] || 'Januari';
          const periodeKe = dayPart <= 15 ? 'Periode 1 (1-15)' : 'Periode 2 (16-31)';

          imported.push({
            id: `REIMB-${Date.now()}-${i}`,
            no: imported.length + 1,
            timestamp,
            nama,
            nik,
            no_hp,
            status,
            departemen,
            site,
            tgl_berangkat,
            tgl_pulang,
            url_bukti_cuti,
            url_nota_berangkat,
            url_nota_pulang,
            periode_bulan: monthName,
            periode_ke: periodeKe,
            nominal: 1250000,
            status_finance: 'Draft',
            tgl_pengajuan_finance: '',
            tgl_pencairan_finance: '',
            catatan: ''
          });
        }

        if (imported.length > 0) {
          setRecords(imported);
          toast.success(`Berhasil mengimpor ${imported.length} data reimbursement dari file CSV!`);
        } else {
          toast.error('Tidak ditemukan baris reimbursement yang valid di dalam file CSV.');
        }
      } catch (err) {
        toast.error('Gagal membaca file CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // -------------------------------------------------------------
  // Filtered Records
  // -------------------------------------------------------------
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Month
      if (selectedMonth !== 'all' && r.periode_bulan !== selectedMonth) return false;

      // Period Cut (1-15 vs 16-31)
      if (selectedPeriodCut === 'p1' && !r.periode_ke?.includes('1-15')) return false;
      if (selectedPeriodCut === 'p2' && !r.periode_ke?.includes('16-31')) return false;

      // Site
      if (selectedSite !== 'all' && r.site !== selectedSite) return false;

      // Status Finance
      if (selectedStatusFinance !== 'all' && r.status_finance !== selectedStatusFinance) return false;

      // Date Range Filter (based on tgl_berangkat or timestamp)
      if (startDateFilter) {
        const start = new Date(startDateFilter);
        const itemDateParts = (r.tgl_berangkat || '').split('/');
        if (itemDateParts.length === 3) {
          const itemDate = new Date(`${itemDateParts[2]}-${itemDateParts[1]}-${itemDateParts[0]}`);
          if (itemDate < start) return false;
        }
      }
      if (endDateFilter) {
        const end = new Date(endDateFilter);
        const itemDateParts = (r.tgl_berangkat || '').split('/');
        if (itemDateParts.length === 3) {
          const itemDate = new Date(`${itemDateParts[2]}-${itemDateParts[1]}-${itemDateParts[0]}`);
          if (itemDate > end) return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNama = (r.nama || '').toLowerCase().includes(q);
        const matchNik = (r.nik || '').toLowerCase().includes(q);
        const matchDept = (r.departemen || '').toLowerCase().includes(q);
        const matchPhone = (r.no_hp || '').toLowerCase().includes(q);
        if (!matchNama && !matchNik && !matchDept && !matchPhone) return false;
      }

      return true;
    });
  }, [records, selectedMonth, selectedPeriodCut, selectedSite, selectedStatusFinance, startDateFilter, endDateFilter, searchQuery]);

  // -------------------------------------------------------------
  // Dashboard Analytics & KPI Calculations
  // -------------------------------------------------------------
  const analytics = useMemo(() => {
    const totalCount = filteredRecords.length;
    const totalNominal = filteredRecords.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);

    const dicairkanRecords = filteredRecords.filter(r => r.status_finance === 'Dicairkan');
    const totalDicairkan = dicairkanRecords.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
    const persenCair = totalNominal > 0 ? ((totalDicairkan / totalNominal) * 100).toFixed(1) : 0;

    const pendingRecords = filteredRecords.filter(r => r.status_finance === 'Diajukan');
    const totalPending = pendingRecords.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);

    // Period 1 (1-15) vs Period 2 (16-31)
    const p1Records = filteredRecords.filter(r => r.periode_ke?.includes('1-15'));
    const p2Records = filteredRecords.filter(r => r.periode_ke?.includes('16-31'));
    const p1Nominal = p1Records.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
    const p2Nominal = p2Records.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);

    // Top Claimers (Karyawan paling sering reimbursement)
    const claimerMap = {};
    filteredRecords.forEach(r => {
      const key = r.nik ? `${r.nama} (${r.nik})` : r.nama;
      if (!claimerMap[key]) {
        claimerMap[key] = {
          nama: r.nama,
          nik: r.nik,
          departemen: r.departemen,
          site: r.site,
          count: 0,
          totalNominal: 0
        };
      }
      claimerMap[key].count++;
      claimerMap[key].totalNominal += (Number(r.nominal) || 0);
    });

    const topClaimers = Object.values(claimerMap)
      .sort((a, b) => b.count - a.count || b.totalNominal - a.totalNominal)
      .slice(0, 5);

    // Department breakdown
    const deptMap = {};
    filteredRecords.forEach(r => {
      const d = r.departemen || 'Lainnya';
      deptMap[d] = (deptMap[d] || 0) + 1;
    });

    // Site breakdown
    const siteMap = {};
    filteredRecords.forEach(r => {
      const s = r.site || 'Lainnya';
      siteMap[s] = (siteMap[s] || 0) + 1;
    });

    return {
      totalCount,
      totalNominal,
      totalDicairkan,
      persenCair,
      totalPending,
      pendingCount: pendingRecords.length,
      p1Count: p1Records.length,
      p1Nominal,
      p2Count: p2Records.length,
      p2Nominal,
      topClaimers,
      deptMap,
      siteMap
    };
  }, [filteredRecords]);

  // -------------------------------------------------------------
  // Selection Handlers
  // -------------------------------------------------------------
  const isAllSelected = useMemo(() => {
    if (filteredRecords.length === 0) return false;
    return filteredRecords.every(r => selectedIds.includes(r.id));
  }, [filteredRecords, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Remove visible records from selection
      const visibleIds = new Set(filteredRecords.map(r => r.id));
      setSelectedIds(prev => prev.filter(id => !visibleIds.has(id)));
    } else {
      // Add all visible records to selection
      const newIds = new Set([...selectedIds, ...filteredRecords.map(r => r.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Selected records array
  const selectedRecords = useMemo(() => {
    return records.filter(r => selectedIds.includes(r.id));
  }, [records, selectedIds]);

  // -------------------------------------------------------------
  // PDF Compilation & Download Execution
  // -------------------------------------------------------------
  const handleExecutePdfCompile = async () => {
    if (selectedRecords.length === 0) {
      toast.error('Pilih minimal 1 baris reimbursement untuk dikompilasi.');
      return;
    }

    try {
      setCompileProgress({ current: 1, total: selectedRecords.length + 1, text: 'Menyiapkan berkas...' });
      
      const blob = await compileReimbursementPdf({
        selectedRecords,
        options: compileOptions,
        onProgress: (current, total, text) => {
          setCompileProgress({ current, total, text });
        }
      });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Kompilasi_Lampiran_Reimbursement_${selectedMonth}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Berhasil mengompilasi ${selectedRecords.length} berkas ke dalam 1 file PDF!`);
      setIsCompileModalOpen(false);
      setCompileProgress(null);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengompilasi PDF: ' + err.message);
      setCompileProgress(null);
    }
  };

  // -------------------------------------------------------------
  // Finance Edit Handlers (Single / Batch)
  // -------------------------------------------------------------
  const handleOpenEditSingle = (rec) => {
    setIsBatchEdit(false);
    setSelectedRecordForDetail(rec);
    setFinanceForm({
      nominal: rec.nominal || 0,
      status_finance: rec.status_finance || 'Draft',
      tgl_pengajuan_finance: rec.tgl_pengajuan_finance || new Date().toISOString().slice(0, 10),
      tgl_pencairan_finance: rec.tgl_pencairan_finance || '',
      catatan: rec.catatan || ''
    });
    setIsEditFinanceModalOpen(true);
  };

  const handleOpenBatchEdit = () => {
    if (selectedIds.length === 0) {
      toast.error('Pilih baris data terlebih dahulu.');
      return;
    }
    setIsBatchEdit(true);
    setFinanceForm({
      nominal: 0,
      status_finance: 'Diajukan',
      tgl_pengajuan_finance: new Date().toISOString().slice(0, 10),
      tgl_pencairan_finance: '',
      catatan: ''
    });
    setIsEditFinanceModalOpen(true);
  };

  const handleSaveFinance = () => {
    if (isBatchEdit) {
      setRecords(prev =>
        prev.map(r => {
          if (!selectedIds.includes(r.id)) return r;
          return {
            ...r,
            status_finance: financeForm.status_finance,
            tgl_pengajuan_finance: financeForm.tgl_pengajuan_finance || r.tgl_pengajuan_finance,
            tgl_pencairan_finance: financeForm.tgl_pencairan_finance || r.tgl_pencairan_finance,
            catatan: financeForm.catatan ? financeForm.catatan : r.catatan
          };
        })
      );
      toast.success(`Status finance untuk ${selectedIds.length} data berhasil diperbarui.`);
    } else if (selectedRecordForDetail) {
      setRecords(prev =>
        prev.map(r => {
          if (r.id !== selectedRecordForDetail.id) return r;
          return {
            ...r,
            nominal: Number(financeForm.nominal) || r.nominal,
            status_finance: financeForm.status_finance,
            tgl_pengajuan_finance: financeForm.tgl_pengajuan_finance,
            tgl_pencairan_finance: financeForm.tgl_pencairan_finance,
            catatan: financeForm.catatan
          };
        })
      );
      toast.success(`Data finance ${selectedRecordForDetail.nama} berhasil diperbarui.`);
    }
    setIsEditFinanceModalOpen(false);
  };

  // Dropdown options
  const monthOptions = [
    { value: 'all', label: 'Semua Bulan' },
    ...MONTHS.map(m => ({ value: m, label: `Bulan ${m} 2026` }))
  ];

  const periodOptions = [
    { value: 'all', label: 'Semua Periode (P1 & P2)' },
    { value: 'p1', label: 'Periode 1 (Tanggal 1 - 15)' },
    { value: 'p2', label: 'Periode 2 (Tanggal 16 - 31)' }
  ];

  const siteOptions = [
    { value: 'all', label: 'Semua Site' },
    { value: 'LBCT', label: 'Site LBCT' },
    { value: 'IDMG', label: 'Site IDMG' },
    { value: 'SPCT', label: 'Site SPCT' }
  ];

  const statusFinanceOptions = [
    { value: 'all', label: 'Semua Status Finance' },
    { value: 'Draft', label: 'Draft / Belum Diajukan' },
    { value: 'Diajukan', label: 'Diajukan ke Finance' },
    { value: 'Dicairkan', label: 'Sudah Dicairkan (Lunas)' }
  ];

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------
          1. MINIMALIST HEADER (Matches Kontrak Page: No PT Badge, No Table Name)
      ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] font-display flex items-center gap-2">
            <FileText className="w-6 h-6 text-[var(--primary)]" />
            Reimbursement Tiket & Transport
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Monitoring permohonan penggantian biaya tiket, verifikasi berkas lampiran, dan pencatatan pencairan Finance.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Toggle Dashboard Button */}
          <button
            onClick={() => setIsDashboardVisible(!isDashboardVisible)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors shadow-xs"
            title={isDashboardVisible ? 'Sembunyikan Dashboard' : 'Tampilkan Dashboard'}
          >
            {isDashboardVisible ? <EyeOff className="w-4 h-4 text-[var(--muted-foreground)]" /> : <Eye className="w-4 h-4 text-[var(--primary)]" />}
            <span className="hidden sm:inline">{isDashboardVisible ? 'Tutup Dashboard' : 'Buka Dashboard'}</span>
          </button>

          {/* Import CSV */}
          <input
            type="file"
            ref={fileImportRef}
            onChange={handleCsvImport}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => fileImportRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors shadow-xs"
            title="Import data respons Form Google Sheets CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>

          {/* Refresh / Sync */}
          <button
            onClick={syncWithDatabase}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors disabled:opacity-50"
            title="Sinkronisasi Data"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[var(--primary)]' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          {/* Compile PDF Action */}
          <button
            onClick={() => {
              if (selectedIds.length === 0) {
                // Select all visible by default if none selected
                setSelectedIds(filteredRecords.map(r => r.id));
              }
              setIsCompileModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 shadow-sm transition-all"
          >
            <FileDown className="w-4 h-4" />
            <span>Compile PDF ({selectedIds.length > 0 ? selectedIds.length : filteredRecords.length})</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. COLLAPSIBLE MONITORING DASHBOARD
      ------------------------------------------------------------- */}
      {isDashboardVisible && (
        <div className="space-y-4">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Total Pengajuan
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--primary)] mt-1">
                {analytics.totalCount} <span className="text-sm font-normal text-[var(--muted-foreground)]">Klaim</span>
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 flex items-center gap-1">
                <Users className="w-3 h-3 text-[var(--primary)]" />
                Periode {selectedMonth} (P1 & P2)
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Total Nilai Klaim
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--foreground)] mt-1">
                {formatRupiah(analytics.totalNominal)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                Estimasi penggantian tiket & transport
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Sudah Dicairkan Finance
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {formatRupiah(analytics.totalDicairkan)}
              </div>
              <div className="text-xs text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {analytics.persenCair}% dari total permohonan
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Menunggu Finance
              </div>
              <div className="text-2xl font-bold font-mono text-amber-600 mt-1">
                {formatRupiah(analytics.totalPending)}
              </div>
              <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600" />
                {analytics.pendingCount} berkas dalam proses verifikasi
              </div>
            </div>
          </div>

          {/* Bi-Monthly Period Monitoring & Top Claimers Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 2-Cut Period Monitoring Card */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[var(--primary)]" />
                    Monitoring 2 Periode ({selectedMonth})
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                    Cut-off 2x/Bulan
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Periode 1 (1-15) */}
                  <div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--muted)]/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[var(--primary)]">Periode 1 (Tgl 1 - 15)</span>
                      <span className="text-xs font-mono font-bold text-[var(--foreground)]">{analytics.p1Count} Berkas</span>
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      Total Klaim: <strong className="text-[var(--foreground)]">{formatRupiah(analytics.p1Nominal)}</strong>
                    </div>
                    <div className="w-full bg-[var(--border)] h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-[var(--primary)] h-full"
                        style={{ width: `${analytics.totalCount > 0 ? (analytics.p1Count / analytics.totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Periode 2 (16-31) */}
                  <div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--muted)]/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-700">Periode 2 (Tgl 16 - 31)</span>
                      <span className="text-xs font-mono font-bold text-[var(--foreground)]">{analytics.p2Count} Berkas</span>
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      Total Klaim: <strong className="text-[var(--foreground)]">{formatRupiah(analytics.p2Nominal)}</strong>
                    </div>
                    <div className="w-full bg-[var(--border)] h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-amber-600 h-full"
                        style={{ width: `${analytics.totalCount > 0 ? (analytics.p2Count / analytics.totalCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-[var(--muted-foreground)] mt-3 pt-2 border-t border-[var(--border)]">
                Pengajuan Finance dijadwalkan setiap tanggal 16 (P1) dan tanggal 1 bulan berikutnya (P2).
              </div>
            </div>

            {/* Top Claimers (Karyawan Paling Sering) */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs lg:col-span-2">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[var(--primary)]" />
                  Top Claimers (Karyawan Paling Sering Reimbursement)
                </h2>
                <span className="text-xs text-[var(--muted-foreground)]">Berdasarkan frekuensi permohonan</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analytics.topClaimers.map((tc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[var(--foreground)] truncate max-w-[150px]">
                          {tc.nama}
                        </div>
                        <div className="text-[11px] text-[var(--muted-foreground)]">
                          {tc.departemen} • {tc.site}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                        {tc.count}x Klaim
                      </span>
                      <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                        {formatRupiah(tc.totalNominal)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. FILTER TOOLBAR
      ------------------------------------------------------------- */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Month Filter */}
            <div className="w-44">
              <CustomSelect
                icon={Calendar}
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={monthOptions}
                placeholder="Pilih Bulan..."
              />
            </div>

            {/* Period 1-15 vs 16-31 Filter */}
            <div className="w-52">
              <CustomSelect
                icon={Layers}
                value={selectedPeriodCut}
                onChange={setSelectedPeriodCut}
                options={periodOptions}
                placeholder="Pilih Periode..."
              />
            </div>

            {/* Site Filter */}
            <div className="w-40">
              <CustomSelect
                icon={Building}
                value={selectedSite}
                onChange={setSelectedSite}
                options={siteOptions}
                placeholder="Pilih Site..."
              />
            </div>

            {/* Status Finance Filter */}
            <div className="w-48">
              <CustomSelect
                icon={CheckCircle2}
                value={selectedStatusFinance}
                onChange={setSelectedStatusFinance}
                options={statusFinanceOptions}
                placeholder="Status Finance..."
              />
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Nama, NIK, Dept..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]">
          <span className="font-semibold flex items-center gap-1 text-[var(--foreground)]">
            <Filter className="w-3 h-3 text-[var(--primary)]" />
            Rentang Tgl Perjalanan:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            <span>s/d</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            {(startDateFilter || endDateFilter) && (
              <button
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
                className="text-[var(--primary)] hover:underline ml-1 font-medium"
              >
                Reset Tanggal
              </button>
            )}
          </div>

          <div className="ml-auto text-xs font-mono text-[var(--muted-foreground)]">
            Menampilkan <strong>{filteredRecords.length}</strong> dari {records.length} data reimbursement
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          4. DATA TABLE WITH MULTI-ROW SELECTION
      ------------------------------------------------------------- */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
              <tr>
                <th className="p-3 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAll}
                    className="p-1 hover:bg-[var(--muted)] rounded text-[var(--foreground)] transition-colors"
                    title={isAllSelected ? 'Batalkan pilihan semua' : 'Pilih semua baris yang tampil'}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                    ) : (
                      <Square className="w-4 h-4 text-[var(--muted-foreground)]" />
                    )}
                  </button>
                </th>
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3 min-w-[130px]">Tgl Form & Periode</th>
                <th className="p-3 min-w-[180px]">Nama Karyawan & NIK</th>
                <th className="p-3 min-w-[140px]">Departemen & Site</th>
                <th className="p-3 min-w-[130px]">Tgl Perjalanan</th>
                <th className="p-3 min-w-[170px]">Lampiran (X, Y, AO)</th>
                <th className="p-3 min-w-[110px] text-right">Nilai Klaim</th>
                <th className="p-3 min-w-[130px] text-center">Status Finance</th>
                <th className="p-3 min-w-[130px]">Jadwal Finance</th>
                <th className="p-3 w-20 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[var(--muted-foreground)]">
                    <FileText className="w-10 h-10 mx-auto text-[var(--muted-foreground)]/40 mb-2" />
                    <p className="font-semibold text-sm">Tidak ada data reimbursement yang cocok dengan filter.</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">Coba ubah filter bulan, periode, atau kata kunci pencarian Anda.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r, idx) => {
                  const isChecked = selectedIds.includes(r.id);

                  let statusBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                  if (r.status_finance === 'Dicairkan') {
                    statusBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  } else if (r.status_finance === 'Diajukan') {
                    statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                  }

                  return (
                    <tr
                      key={r.id || idx}
                      className={`hover:bg-[var(--muted)]/30 transition-colors ${isChecked ? 'bg-[var(--primary)]/5' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleSelectRow(r.id)}
                          className="p-1 hover:bg-[var(--muted)] rounded text-[var(--foreground)] transition-colors"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                          ) : (
                            <Square className="w-4 h-4 text-[var(--muted-foreground)]" />
                          )}
                        </button>
                      </td>

                      {/* No */}
                      <td className="p-3 text-center font-mono text-[var(--muted-foreground)]">
                        {idx + 1}
                      </td>

                      {/* Timestamp & Periode */}
                      <td className="p-3">
                        <div className="font-medium text-[var(--foreground)]">{r.timestamp?.split(' ')[0] || '-'}</div>
                        <div className="text-[10px] font-mono text-[var(--primary)] font-semibold">
                          {r.periode_bulan} • {r.periode_ke?.includes('1-15') ? 'P1' : 'P2'}
                        </div>
                      </td>

                      {/* Nama & NIK */}
                      <td className="p-3">
                        <div className="font-bold text-[var(--foreground)]">{r.nama}</div>
                        <div className="text-[11px] font-mono text-[var(--muted-foreground)]">
                          NIK: {r.nik || '-'} {r.no_hp ? `• ${r.no_hp}` : ''}
                        </div>
                      </td>

                      {/* Departemen & Site */}
                      <td className="p-3">
                        <div className="font-medium">{r.departemen || '-'}</div>
                        <div className="text-[10px] font-semibold text-[var(--muted-foreground)]">
                          Site <span className="text-[var(--primary)]">{r.site || '-'}</span> ({r.status || 'CUTI'})
                        </div>
                      </td>

                      {/* Tgl Perjalanan */}
                      <td className="p-3 font-mono text-[11px]">
                        <div>Pegi: {r.tgl_berangkat || '-'}</div>
                        <div className="text-[var(--muted-foreground)]">Plng: {r.tgl_pulang || '-'}</div>
                      </td>

                      {/* Lampiran Badges with links */}
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {/* Col X: Bukti Cuti */}
                          {r.url_bukti_cuti ? (
                            <a
                              href={r.url_bukti_cuti}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-800 border border-teal-200 hover:underline"
                              title="Lihat Bukti Cuti Sunfish (Kolom X)"
                            >
                              <span>Cuti (X)</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400">No Cuti</span>
                          )}

                          {/* Col Y: Nota Keberangkatan */}
                          {r.url_nota_berangkat ? (
                            <a
                              href={r.url_nota_berangkat}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-800 border border-sky-200 hover:underline"
                              title="Lihat Nota Keberangkatan (Kolom Y)"
                            >
                              <span>Pergi (Y)</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400">No Pergi</span>
                          )}

                          {/* Col AO: Nota Kepulangan */}
                          {r.url_nota_pulang ? (
                            <a
                              href={r.url_nota_pulang}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 hover:underline"
                              title="Lihat Nota Kepulangan (Kolom AO)"
                            >
                              <span>Pulang (AO)</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : null}
                        </div>
                      </td>

                      {/* Nilai Klaim */}
                      <td className="p-3 text-right font-mono font-bold text-[var(--primary)]">
                        {formatRupiah(r.nominal)}
                      </td>

                      {/* Status Finance */}
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeClass}`}>
                          {r.status_finance === 'Dicairkan' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {r.status_finance === 'Diajukan' && <Clock className="w-3 h-3 text-amber-600" />}
                          {r.status_finance || 'Draft'}
                        </span>
                      </td>

                      {/* Jadwal Finance */}
                      <td className="p-3 font-mono text-[10px]">
                        <div>Aju: {r.tgl_pengajuan_finance || '-'}</div>
                        <div className="text-emerald-700 font-semibold">Cair: {r.tgl_pencairan_finance || '-'}</div>
                      </td>

                      {/* Aksi */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditSingle(r)}
                            className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--muted)]"
                            title="Edit Data Finance & Nominal"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------------------------------------
          5. STICKY FLOATING ACTION BAR (When Rows Selected)
      ------------------------------------------------------------- */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--card)] border border-[var(--border)] shadow-xl rounded-full px-5 py-2.5 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xs font-mono font-bold">
              {selectedIds.length}
            </span>
            <span>Data Terpilih</span>
          </div>

          <div className="h-4 w-px bg-[var(--border)]" />

          {/* Quick Print Preview */}
          <button
            onClick={() => openReimbursementPrintWindow({ selectedRecords })}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)] hover:text-[var(--primary)] px-2.5 py-1 rounded-md hover:bg-[var(--muted)] transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print View</span>
          </button>

          {/* Compile PDF Button */}
          <button
            onClick={() => setIsCompileModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-1.5 rounded-full hover:opacity-90 transition-all shadow-xs"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Compile & Download PDF</span>
          </button>

          {/* Batch Edit Finance Button */}
          <button
            onClick={handleOpenBatchEdit}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)] hover:text-[var(--primary)] px-2.5 py-1 rounded-md hover:bg-[var(--muted)] transition-colors"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Update Finance</span>
          </button>

          {/* Clear Selection */}
          <button
            onClick={handleClearSelection}
            className="p-1 rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
            title="Batalkan Pilihan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------
          6. MODAL: COMPILE PDF OPTIONS
      ------------------------------------------------------------- */}
      {isCompileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  Compile & Download Lampiran PDF
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Gabungkan {selectedRecords.length} berkas reimbursement menjadi 1 dokumen PDF rapi.
                </p>
              </div>
              <button
                onClick={() => setIsCompileModalOpen(false)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded-lg hover:bg-[var(--muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
                  Cakupan Halaman yang Disertakan:
                </label>

                <div className="space-y-2 border border-[var(--border)] rounded-xl p-3 bg-[var(--muted)]/20">
                  <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compileOptions.includeCover}
                      onChange={(e) => setCompileOptions(p => ({ ...p, includeCover: e.target.checked }))}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="font-semibold text-[var(--foreground)]">Halaman Cover & Ringkasan Rekapitulasi</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compileOptions.includeBuktiCuti}
                      onChange={(e) => setCompileOptions(p => ({ ...p, includeBuktiCuti: e.target.checked }))}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span>Lampiran <strong>Bukti Cuti Approval Sunfish</strong> (Kolom X)</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compileOptions.includeNotaBerangkat}
                      onChange={(e) => setCompileOptions(p => ({ ...p, includeNotaBerangkat: e.target.checked }))}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span>Lampiran <strong>Nota Keberangkatan Transport</strong> (Kolom Y)</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compileOptions.includeNotaPulang}
                      onChange={(e) => setCompileOptions(p => ({ ...p, includeNotaPulang: e.target.checked }))}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span>Lampiran <strong>Nota Kepulangan Transport</strong> (Kolom AO, jika ada)</span>
                  </label>
                </div>
              </div>

              {/* Progress indicator */}
              {compileProgress && (
                <div className="border border-teal-200 bg-teal-50 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-teal-900">
                    <span>{compileProgress.text}</span>
                    <span className="font-mono">{compileProgress.current} / {compileProgress.total}</span>
                  </div>
                  <div className="w-full bg-teal-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[var(--primary)] h-full transition-all duration-300"
                      style={{ width: `${(compileProgress.current / compileProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="text-[11px] text-[var(--muted-foreground)] leading-relaxed bg-[var(--muted)]/40 p-3 rounded-lg border border-[var(--border)]">
                ℹ️ Setiap halaman lampiran akan otomatis ditempel strip header warna Teal di bagian atas yang memuat <strong>Nama Karyawan, NIK, Departemen, dan Jenis Dokumen</strong> sesuai standar General Affairs.
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--muted)]/10 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsCompileModalOpen(false)}
                disabled={compileProgress !== null}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                Batal
              </button>
              <button
                onClick={handleExecutePdfCompile}
                disabled={compileProgress !== null}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>{compileProgress ? 'Sedang Memproses...' : 'Proses & Unduh PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          7. MODAL: EDIT FINANCE (SINGLE / BATCH)
      ------------------------------------------------------------- */}
      {isEditFinanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  {isBatchEdit ? `Update Finance (${selectedIds.length} Data)` : `Edit Finance - ${selectedRecordForDetail?.nama}`}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Perbarui status pengajuan dan tanggal pencairan dari Finance.
                </p>
              </div>
              <button
                onClick={() => setIsEditFinanceModalOpen(false)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded-lg hover:bg-[var(--muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              {!isBatchEdit && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Nominal Reimbursement (Rp)
                  </label>
                  <input
                    type="number"
                    value={financeForm.nominal}
                    onChange={(e) => setFinanceForm(p => ({ ...p, nominal: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Status Finance
                </label>
                <select
                  value={financeForm.status_finance}
                  onChange={(e) => setFinanceForm(p => ({ ...p, status_finance: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                >
                  <option value="Draft">Draft (Belum Diajukan)</option>
                  <option value="Diajukan">Diajukan ke Finance</option>
                  <option value="Dicairkan">Sudah Dicairkan (Lunas)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Tanggal Pengajuan
                  </label>
                  <input
                    type="date"
                    value={financeForm.tgl_pengajuan_finance}
                    onChange={(e) => setFinanceForm(p => ({ ...p, tgl_pengajuan_finance: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Tanggal Pencairan
                  </label>
                  <input
                    type="date"
                    value={financeForm.tgl_pencairan_finance}
                    onChange={(e) => setFinanceForm(p => ({ ...p, tgl_pencairan_finance: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Catatan / Keterangan Finance
                </label>
                <textarea
                  rows={2}
                  value={financeForm.catatan}
                  onChange={(e) => setFinanceForm(p => ({ ...p, catatan: e.target.value }))}
                  placeholder="Keterangan transfer, no batch, atau catatan verifikasi..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                />
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--muted)]/10 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsEditFinanceModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                Batal
              </button>
              <button
                onClick={handleSaveFinance}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--primary)] text-white hover:opacity-90"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
