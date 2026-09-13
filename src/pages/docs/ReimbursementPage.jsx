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
  Printer,
  ChevronRight,
  Sparkles,
  DollarSign
} from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';
import initialReimbursementData from '../../data/initialReimbursementData.json';
import {
  compileReimbursementPdf,
  openReimbursementPrintWindow,
  formatRupiah
} from '../../utils/reimbursementPdfCompiler';
import { exportPeriodToExcel } from '../../utils/reimbursementExportExcel';
import { api as gasClient } from '../../lib/gasClient';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function ReimbursementPage() {
  // State: Raw employee reimbursement records
  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('garda_reimbursements_data');
      if (saved) return JSON.parse(saved);
    } catch {}
    return initialReimbursementData;
  });

  // Period-level Finance Overrides (stored per period key)
  const [periodFinanceMeta, setPeriodFinanceMeta] = useState(() => {
    try {
      const saved = localStorage.getItem('garda_period_finance_meta');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // UI state
  const [viewMode, setViewMode] = useState('periods'); // 'periods' (1 paket per periode) or 'individuals' (flat list)
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedPeriodCut, setSelectedPeriodCut] = useState('all'); // 'all', 'p1', 'p2'
  const [selectedStatusFinance, setSelectedStatusFinance] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Drawer state: active selected period
  const [activeDrawerPeriod, setActiveDrawerPeriod] = useState(null);
  const [drawerSelectedIds, setDrawerSelectedIds] = useState([]);

  // Modals
  const [isPeriodEditModalOpen, setIsPeriodEditModalOpen] = useState(false);
  const [targetPeriodForEdit, setTargetPeriodForEdit] = useState(null);
  const [periodEditForm, setPeriodEditForm] = useState({
    status_finance: 'Diajukan',
    tgl_pengajuan_finance: '',
    tgl_pencairan_finance: '',
    catatan: ''
  });

  // PDF Compile modal
  const [isCompileModalOpen, setIsCompileModalOpen] = useState(false);
  const [compileScopeRecords, setCompileScopeRecords] = useState([]);
  const [compileScopeTitle, setCompileScopeTitle] = useState('');
  const [compileProgress, setCompileProgress] = useState(null);
  const [compileOptions, setCompileOptions] = useState({
    includeCover: true,
    includeBuktiCuti: true,
    includeNotaBerangkat: true,
    includeNotaPulang: true
  });

  // CSV Import ref
  const fileImportRef = useRef(null);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('garda_reimbursements_data', JSON.stringify(records));
      localStorage.setItem('garda_period_finance_meta', JSON.stringify(periodFinanceMeta));
    } catch {}
  }, [records, periodFinanceMeta]);

  // Sync with remote spreadsheet
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
      console.warn('Sync fallback to local:', err);
      toast.info('Sinkronisasi selesai (database lokal aktif).');
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
            periode_tahun: 2026,
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
          toast.success(`Berhasil mengimpor ${imported.length} data reimbursement!`);
        } else {
          toast.error('Tidak ditemukan data reimbursement yang valid di CSV.');
        }
      } catch (err) {
        toast.error('Gagal membaca file CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // -------------------------------------------------------------
  // GROUPING: Build Period Batches (1 Paket per Periode)
  // -------------------------------------------------------------
  const periodBatches = useMemo(() => {
    // Generate standard order of periods for 2026: Januari P1, P2, Februari P1, P2, ...
    const batchMap = {};

    MONTHS.forEach((m, mIdx) => {
      ['Periode 1 (1-15)', 'Periode 2 (16-31)'].forEach((pCut, pIdx) => {
        const key = `2026-${String(mIdx + 1).padStart(2, '0')}-${pIdx === 0 ? 'P1' : 'P2'}`;
        const cutNumber = pIdx === 0 ? 1 : 2;
        const dateRangeStr = pIdx === 0 
          ? `01 ${m} 2026 - 15 ${m} 2026` 
          : `16 ${m} 2026 - ${[3, 5, 8, 10].includes(mIdx) ? '30' : mIdx === 1 ? '28' : '31'} ${m} 2026`;

        batchMap[key] = {
          key,
          tahun: 2026,
          bulan: m,
          monthIndex: mIdx,
          cutNumber,
          periode_ke: pCut,
          label: `${m} 2026 - Periode ${cutNumber}`,
          rentang_tanggal: dateRangeStr,
          items: [],
          total_nominal: 0,
          status_finance: 'Draft',
          tgl_pengajuan_finance: '',
          tgl_pencairan_finance: '',
          catatan: ''
        };
      });
    });

    // Populate with actual records
    records.forEach(r => {
      const mIdx = MONTHS.indexOf(r.periode_bulan);
      if (mIdx === -1) return;

      const isP1 = r.periode_ke?.includes('1-15');
      const key = `2026-${String(mIdx + 1).padStart(2, '0')}-${isP1 ? 'P1' : 'P2'}`;

      if (batchMap[key]) {
        batchMap[key].items.push(r);
        batchMap[key].total_nominal += (Number(r.nominal) || 0);

        // Inherit dates/status from items if meta not manually set
        if (!batchMap[key].tgl_pengajuan_finance && r.tgl_pengajuan_finance) {
          batchMap[key].tgl_pengajuan_finance = r.tgl_pengajuan_finance;
        }
        if (!batchMap[key].tgl_pencairan_finance && r.tgl_pencairan_finance) {
          batchMap[key].tgl_pencairan_finance = r.tgl_pencairan_finance;
        }
      }
    });

    // Apply periodFinanceMeta overrides and calculate overall batch status
    return Object.values(batchMap).map(batch => {
      const meta = periodFinanceMeta[batch.key] || {};

      let status = meta.status_finance;
      if (!status) {
        if (batch.items.length === 0) {
          status = 'Belum Ada Berkas';
        } else if (batch.items.every(item => item.status_finance === 'Dicairkan')) {
          status = 'Dicairkan';
        } else if (batch.items.some(item => item.status_finance === 'Diajukan' || item.status_finance === 'Dicairkan')) {
          status = 'Diajukan';
        } else {
          status = 'Draft';
        }
      }

      return {
        ...batch,
        status_finance: status,
        tgl_pengajuan_finance: meta.tgl_pengajuan_finance || batch.tgl_pengajuan_finance || '',
        tgl_pencairan_finance: meta.tgl_pencairan_finance || batch.tgl_pencairan_finance || '',
        catatan: meta.catatan || batch.catatan || ''
      };
    });
  }, [records, periodFinanceMeta]);

  // Filtered Period Batches
  const filteredPeriodBatches = useMemo(() => {
    return periodBatches.filter(batch => {
      // Don't show empty periods in the future unless selected specifically
      if (selectedMonth === 'all' && batch.items.length === 0 && batch.monthIndex > 8) return false;

      // Month
      if (selectedMonth !== 'all' && batch.bulan !== selectedMonth) return false;

      // Period Cut (1 or 2)
      if (selectedPeriodCut === 'p1' && batch.cutNumber !== 1) return false;
      if (selectedPeriodCut === 'p2' && batch.cutNumber !== 2) return false;

      // Status Finance
      if (selectedStatusFinance !== 'all' && batch.status_finance !== selectedStatusFinance) return false;

      // Search (matches month name or employee name inside this period)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPeriod = batch.label.toLowerCase().includes(q);
        const matchEmployee = batch.items.some(it =>
          (it.nama || '').toLowerCase().includes(q) ||
          (it.nik || '').toLowerCase().includes(q) ||
          (it.departemen || '').toLowerCase().includes(q)
        );
        if (!matchPeriod && !matchEmployee) return false;
      }

      return true;
    });
  }, [periodBatches, selectedMonth, selectedPeriodCut, selectedStatusFinance, searchQuery]);

  // Macro KPI Metrics
  const macroKPIs = useMemo(() => {
    const activeBatches = periodBatches.filter(b => b.items.length > 0);
    const totalPeriodsCount = activeBatches.length;
    const totalEmployeesCount = activeBatches.reduce((sum, b) => sum + b.items.length, 0);
    const totalNominalAll = activeBatches.reduce((sum, b) => sum + b.total_nominal, 0);

    const dicairkanBatches = activeBatches.filter(b => b.status_finance === 'Dicairkan');
    const totalDicairkanNominal = dicairkanBatches.reduce((sum, b) => sum + b.total_nominal, 0);
    const persenCair = totalNominalAll > 0 ? ((totalDicairkanNominal / totalNominalAll) * 100).toFixed(1) : 0;

    const pendingBatches = activeBatches.filter(b => b.status_finance === 'Diajukan');
    const totalPendingNominal = pendingBatches.reduce((sum, b) => sum + b.total_nominal, 0);

    return {
      totalPeriodsCount,
      totalEmployeesCount,
      totalNominalAll,
      totalDicairkanNominal,
      persenCair,
      totalPendingNominal,
      pendingCount: pendingBatches.length
    };
  }, [periodBatches]);

  // -------------------------------------------------------------
  // Drawer Handlers
  // -------------------------------------------------------------
  const handleOpenPeriodDrawer = (batch) => {
    setActiveDrawerPeriod(batch);
    setDrawerSelectedIds(batch.items.map(it => it.id)); // select all in drawer by default
  };

  const handleCloseDrawer = () => {
    setActiveDrawerPeriod(null);
    setDrawerSelectedIds([]);
  };

  const handleToggleDrawerSelectAll = () => {
    if (!activeDrawerPeriod) return;
    if (drawerSelectedIds.length === activeDrawerPeriod.items.length) {
      setDrawerSelectedIds([]);
    } else {
      setDrawerSelectedIds(activeDrawerPeriod.items.map(it => it.id));
    }
  };

  const handleToggleDrawerItem = (id) => {
    setDrawerSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // -------------------------------------------------------------
  // Excel Export Handler (Single Period)
  // -------------------------------------------------------------
  const handleExportPeriodExcel = (batch) => {
    try {
      exportPeriodToExcel(batch);
      toast.success(`Rekapitulasi Excel untuk ${batch.label} berhasil diunduh!`);
    } catch (err) {
      toast.error('Gagal mengekspor Excel: ' + err.message);
    }
  };

  // -------------------------------------------------------------
  // PDF Compilation Trigger for 1 Period Package
  // -------------------------------------------------------------
  const handleTriggerPeriodPdfCompile = (batch, itemsToCompile = null) => {
    const list = itemsToCompile || batch.items;
    if (!list || list.length === 0) {
      toast.error('Tidak ada berkas karyawan dalam periode ini.');
      return;
    }
    setCompileScopeRecords(list);
    setCompileScopeTitle(batch.label);
    setIsCompileModalOpen(true);
  };

  const handleExecutePdfCompile = async () => {
    if (compileScopeRecords.length === 0) {
      toast.error('Tidak ada berkas yang dipilih.');
      return;
    }

    try {
      setCompileProgress({ current: 1, total: compileScopeRecords.length + 1, text: 'Menyiapkan berkas...' });

      const blob = await compileReimbursementPdf({
        selectedRecords: compileScopeRecords,
        options: {
          ...compileOptions,
          periodLabel: compileScopeTitle
        },
        onProgress: (current, total, text) => {
          setCompileProgress({ current, total, text });
        }
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = compileScopeTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Kompilasi_Lampiran_${safeTitle}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Berhasil mengompilasi paket PDF ${compileScopeTitle}!`);
      setIsCompileModalOpen(false);
      setCompileProgress(null);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengompilasi PDF: ' + err.message);
      setCompileProgress(null);
    }
  };

  // -------------------------------------------------------------
  // Period Finance Edit Handlers
  // -------------------------------------------------------------
  const handleOpenPeriodFinanceEdit = (batch) => {
    setTargetPeriodForEdit(batch);
    setPeriodEditForm({
      status_finance: batch.status_finance === 'Belum Ada Berkas' ? 'Draft' : batch.status_finance,
      tgl_pengajuan_finance: batch.tgl_pengajuan_finance || new Date().toISOString().slice(0, 10),
      tgl_pencairan_finance: batch.tgl_pencairan_finance || '',
      catatan: batch.catatan || ''
    });
    setIsPeriodEditModalOpen(true);
  };

  const handleSavePeriodFinance = () => {
    if (!targetPeriodForEdit) return;

    // 1. Update period finance meta
    setPeriodFinanceMeta(prev => ({
      ...prev,
      [targetPeriodForEdit.key]: {
        status_finance: periodEditForm.status_finance,
        tgl_pengajuan_finance: periodEditForm.tgl_pengajuan_finance,
        tgl_pencairan_finance: periodEditForm.tgl_pencairan_finance,
        catatan: periodEditForm.catatan
      }
    }));

    // 2. Propagate to individual records belonging to this period
    setRecords(prev =>
      prev.map(r => {
        const isThisPeriod = targetPeriodForEdit.items.some(it => it.id === r.id);
        if (!isThisPeriod) return r;
        return {
          ...r,
          status_finance: periodEditForm.status_finance,
          tgl_pengajuan_finance: periodEditForm.tgl_pengajuan_finance,
          tgl_pencairan_finance: periodEditForm.tgl_pencairan_finance,
          catatan: periodEditForm.catatan
        };
      })
    );

    // If currently active in drawer, update active drawer copy too
    if (activeDrawerPeriod && activeDrawerPeriod.key === targetPeriodForEdit.key) {
      setActiveDrawerPeriod(prev => ({
        ...prev,
        status_finance: periodEditForm.status_finance,
        tgl_pengajuan_finance: periodEditForm.tgl_pengajuan_finance,
        tgl_pencairan_finance: periodEditForm.tgl_pencairan_finance,
        catatan: periodEditForm.catatan,
        items: prev.items.map(it => ({
          ...it,
          status_finance: periodEditForm.status_finance,
          tgl_pengajuan_finance: periodEditForm.tgl_pengajuan_finance,
          tgl_pencairan_finance: periodEditForm.tgl_pencairan_finance
        }))
      }));
    }

    toast.success(`Status Finance untuk paket ${targetPeriodForEdit.label} berhasil diperbarui.`);
    setIsPeriodEditModalOpen(false);
  };

  // Dropdown options
  const monthOptions = [
    { value: 'all', label: 'Semua Bulan (2026)' },
    ...MONTHS.map(m => ({ value: m, label: `Bulan ${m}` }))
  ];

  const periodCutOptions = [
    { value: 'all', label: 'Semua Periode (P1 & P2)' },
    { value: 'p1', label: 'Periode 1 (Cut-off Tgl 1-15)' },
    { value: 'p2', label: 'Periode 2 (Cut-off Tgl 16-31)' }
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
          1. MINIMALIST HEADER (Matches Kontrak Page Style)
      ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] font-display flex items-center gap-2">
            <FileText className="w-6 h-6 text-[var(--primary)]" />
            Reimbursement Tiket & Transport
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Monitoring pengajuan per periode (cut-off 2x sebulan), verifikasi lampiran, dan pencatatan pencairan Finance.
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
            title="Import data respons Form CSV"
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

          {/* View Mode Switcher */}
          <button
            onClick={() => setViewMode(viewMode === 'periods' ? 'individuals' : 'periods')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors shadow-xs"
            title="Ganti antara mode Paket Periode dan mode Daftar Perorangan"
          >
            <Layers className="w-4 h-4 text-[var(--primary)]" />
            <span>{viewMode === 'periods' ? 'Mode Perorangan' : 'Mode Paket Periode'}</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. MACRO KPI MONITORING DASHBOARD (Collapsible)
      ------------------------------------------------------------- */}
      {isDashboardVisible && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Paket Periode Aktif
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--primary)] mt-1">
                {macroKPIs.totalPeriodsCount} <span className="text-sm font-normal text-[var(--muted-foreground)]">Periode</span>
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[var(--primary)]" />
                Total {macroKPIs.totalEmployeesCount} berkas permohonan
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Total Akumulasi Klaim
              </div>
              <div className="text-2xl font-bold font-mono text-[var(--foreground)] mt-1">
                {formatRupiah(macroKPIs.totalNominalAll)}
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">
                Seluruh pengajuan tiket & transport 2026
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Sudah Dicairkan Finance
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {formatRupiah(macroKPIs.totalDicairkanNominal)}
              </div>
              <div className="text-xs text-emerald-700 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {macroKPIs.persenCair}% dari total permohonan
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Paket Menunggu Finance
              </div>
              <div className="text-2xl font-bold font-mono text-amber-600 mt-1">
                {formatRupiah(macroKPIs.totalPendingNominal)}
              </div>
              <div className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600" />
                {macroKPIs.pendingCount} periode dalam proses Finance
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          3. FILTER TOOLBAR
      ------------------------------------------------------------- */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Filter */}
          <div className="w-48">
            <CustomSelect
              icon={Calendar}
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={monthOptions}
              placeholder="Filter Bulan..."
            />
          </div>

          {/* Period Cut Filter */}
          <div className="w-52">
            <CustomSelect
              icon={Layers}
              value={selectedPeriodCut}
              onChange={setSelectedPeriodCut}
              options={periodCutOptions}
              placeholder="Filter Periode..."
            />
          </div>

          {/* Status Finance Filter */}
          <div className="w-52">
            <CustomSelect
              icon={CheckCircle2}
              value={selectedStatusFinance}
              onChange={setSelectedStatusFinance}
              options={statusFinanceOptions}
              placeholder="Status Finance..."
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari Periode / Karyawan..."
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

      {/* -------------------------------------------------------------
          4. PRIMARY VIEW: TABLE OF PERIOD PACKAGES (1 PAKET PER PERIODE)
      ------------------------------------------------------------- */}
      {viewMode === 'periods' ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
                <tr>
                  <th className="p-3.5 w-12 text-center">No</th>
                  <th className="p-3.5 min-w-[200px]">Paket Periode</th>
                  <th className="p-3.5 min-w-[180px]">Rentang Waktu Submit</th>
                  <th className="p-3.5 min-w-[120px] text-center">Jumlah Berkas</th>
                  <th className="p-3.5 min-w-[140px] text-right">Total Nilai Paket</th>
                  <th className="p-3.5 min-w-[130px] text-center">Status Finance</th>
                  <th className="p-3.5 min-w-[150px]">Jadwal Finance</th>
                  <th className="p-3.5 min-w-[260px] text-center">Aksi Paket Periode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                {filteredPeriodBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[var(--muted-foreground)]">
                      <Calendar className="w-10 h-10 mx-auto text-[var(--muted-foreground)]/40 mb-2" />
                      <p className="font-semibold text-sm">Tidak ada paket periode yang cocok dengan filter.</p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">Coba ubah filter bulan atau status finance.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPeriodBatches.map((batch, idx) => {
                    let statusBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                    if (batch.status_finance === 'Dicairkan') {
                      statusBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    } else if (batch.status_finance === 'Diajukan') {
                      statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                    }

                    const hasItems = batch.items.length > 0;

                    return (
                      <tr
                        key={batch.key}
                        className="hover:bg-[var(--muted)]/30 transition-colors group cursor-pointer"
                        onClick={() => hasItems && handleOpenPeriodDrawer(batch)}
                      >
                        {/* No */}
                        <td className="p-3.5 text-center font-mono text-[var(--muted-foreground)]">
                          {idx + 1}
                        </td>

                        {/* Paket Periode */}
                        <td className="p-3.5">
                          <div className="font-bold text-sm text-[var(--foreground)] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                            {batch.label}
                          </div>
                          <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                            Cut-off: {batch.periode_ke}
                          </div>
                        </td>

                        {/* Rentang Tanggal */}
                        <td className="p-3.5 font-mono text-[11px]">
                          <div className="flex items-center gap-1 text-[var(--foreground)]">
                            <Calendar className="w-3.5 h-3.5 text-[var(--primary)]" />
                            <span>{batch.rentang_tanggal}</span>
                          </div>
                        </td>

                        {/* Jumlah Berkas */}
                        <td className="p-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold font-mono text-xs ${hasItems ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'bg-slate-100 text-slate-500'}`}>
                            <Users className="w-3 h-3" />
                            {batch.items.length} Berkas
                          </span>
                        </td>

                        {/* Total Nilai */}
                        <td className="p-3.5 text-right font-mono font-bold text-sm text-[var(--primary)]">
                          {formatRupiah(batch.total_nominal)}
                        </td>

                        {/* Status Finance */}
                        <td className="p-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusBadgeClass}`}>
                            {batch.status_finance === 'Dicairkan' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {batch.status_finance === 'Diajukan' && <Clock className="w-3 h-3 text-amber-600" />}
                            {batch.status_finance}
                          </span>
                        </td>

                        {/* Jadwal Finance */}
                        <td className="p-3.5 font-mono text-[10px]">
                          <div>Diajukan: <strong>{batch.tgl_pengajuan_finance || '-'}</strong></div>
                          <div className="text-emerald-700">Pencairan: <strong>{batch.tgl_pencairan_finance || '-'}</strong></div>
                        </td>

                        {/* Aksi Paket Periode */}
                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Detail Drawer Button */}
                            <button
                              onClick={() => handleOpenPeriodDrawer(batch)}
                              disabled={!hasItems}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] disabled:opacity-40 transition-colors"
                              title="Buka rincian seluruh berkas karyawan pada periode ini"
                            >
                              <Eye className="w-3.5 h-3.5 text-[var(--primary)]" />
                              <span>Detail</span>
                            </button>

                            {/* Update Finance Button */}
                            <button
                              onClick={() => handleOpenPeriodFinanceEdit(batch)}
                              disabled={!hasItems}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] disabled:opacity-40 transition-colors"
                              title="Update status dan jadwal Finance 1 paket periode ini"
                            >
                              <Edit className="w-3.5 h-3.5 text-amber-600" />
                              <span>Finance</span>
                            </button>

                            {/* Unduh Rekapan Excel */}
                            <button
                              onClick={() => handleExportPeriodExcel(batch)}
                              disabled={!hasItems}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 disabled:opacity-40 transition-colors"
                              title="Unduh file Rekapan Excel (.xlsx) untuk diserahkan ke Finance"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Excel</span>
                            </button>

                            {/* Compile PDF Button */}
                            <button
                              onClick={() => handleTriggerPeriodPdfCompile(batch)}
                              disabled={!hasItems}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-2xs"
                              title="Compile seluruh lampiran (Bukti Cuti, Nota Berangkat, Nota Pulang) periode ini ke 1 file PDF"
                            >
                              <DownloadCloud className="w-3.5 h-3.5" />
                              <span>PDF</span>
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
      ) : (
        /* -------------------------------------------------------------
            ALTERNATIVE VIEW: FLAT LIST OF ALL INDIVIDUALS
        ------------------------------------------------------------- */
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xs overflow-hidden">
          <div className="p-3 bg-[var(--muted)]/20 border-b border-[var(--border)] flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--foreground)]">
              Tampilan Daftar Perorangan (Semua Karyawan)
            </span>
            <button
              onClick={() => setViewMode('periods')}
              className="text-[var(--primary)] font-bold hover:underline"
            >
              Kembali ke Mode Paket Periode
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
                <tr>
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3">Tgl Form & Periode</th>
                  <th className="p-3">Nama Karyawan & NIK</th>
                  <th className="p-3">Departemen & Site</th>
                  <th className="p-3">Tgl Perjalanan</th>
                  <th className="p-3">Lampiran (X, Y, AO)</th>
                  <th className="p-3 text-right">Nilai Klaim</th>
                  <th className="p-3 text-center">Status Finance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                {records.slice(0, 100).map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-[var(--muted)]/30">
                    <td className="p-3 text-center font-mono text-[var(--muted-foreground)]">{idx + 1}</td>
                    <td className="p-3">
                      <div>{r.timestamp?.split(' ')[0]}</div>
                      <div className="text-[10px] text-[var(--primary)] font-bold">{r.periode_bulan} • {r.periode_ke}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold">{r.nama}</div>
                      <div className="text-[10px] font-mono text-[var(--muted-foreground)]">NIK: {r.nik}</div>
                    </td>
                    <td className="p-3">
                      <div>{r.departemen}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">Site {r.site}</div>
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      <div>{r.tgl_berangkat} s/d {r.tgl_pulang}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {r.url_bukti_cuti && (
                          <a href={r.url_bukti_cuti} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-800 border border-teal-200">
                            Cuti (X)
                          </a>
                        )}
                        {r.url_nota_berangkat && (
                          <a href={r.url_nota_berangkat} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-800 border border-sky-200">
                            Pergi (Y)
                          </a>
                        )}
                        {r.url_nota_pulang && (
                          <a href={r.url_nota_pulang} target="_blank" rel="noreferrer" className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200">
                            Pulang (AO)
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[var(--primary)]">{formatRupiah(r.nominal)}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {r.status_finance || 'Draft'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          5. RIGHT DRAWER: DETAIL RINCIAN KARYAWAN 1 PERIODE
      ------------------------------------------------------------- */}
      {activeDrawerPeriod && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={handleCloseDrawer}
            className="absolute inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-[var(--card)] border-l border-[var(--border)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              {/* Drawer Header */}
              <div className="p-5 border-b border-[var(--border)] bg-[var(--muted)]/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">
                      Paket Periode Terpilih
                    </span>
                    <h2 className="text-lg font-bold text-[var(--foreground)] mt-1">
                      {activeDrawerPeriod.label}
                    </h2>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Rentang Form: {activeDrawerPeriod.rentang_tanggal} • {activeDrawerPeriod.items.length} Karyawan Terdaftar
                    </p>
                  </div>

                  <button
                    onClick={handleCloseDrawer}
                    className="p-1 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer KPI Snapshot Bar */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-[var(--border)]">
                  <div>
                    <div className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Total Klaim Periode</div>
                    <div className="text-sm font-bold font-mono text-[var(--primary)]">
                      {formatRupiah(activeDrawerPeriod.total_nominal)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Status Finance</div>
                    <div className="text-xs font-bold text-[var(--foreground)]">
                      {activeDrawerPeriod.status_finance}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Jadwal Pencairan</div>
                    <div className="text-xs font-mono font-semibold text-emerald-700">
                      {activeDrawerPeriod.tgl_pencairan_finance || 'Belum Dijadwalkan'}
                    </div>
                  </div>
                </div>

                {/* Quick Action Strip inside Drawer Header */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {/* Compile PDF Button */}
                  <button
                    onClick={() => {
                      const selectedInDrawer = activeDrawerPeriod.items.filter(it => drawerSelectedIds.includes(it.id));
                      handleTriggerPeriodPdfCompile(activeDrawerPeriod, selectedInDrawer.length > 0 ? selectedInDrawer : activeDrawerPeriod.items);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--primary)] text-white hover:opacity-90 shadow-2xs"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Compile PDF Paket ({drawerSelectedIds.length})</span>
                  </button>

                  {/* Unduh Rekapan Excel Button */}
                  <button
                    onClick={() => handleExportPeriodExcel(activeDrawerPeriod)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Unduh Excel Rekapan</span>
                  </button>

                  {/* Edit Finance Button */}
                  <button
                    onClick={() => handleOpenPeriodFinanceEdit(activeDrawerPeriod)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] shadow-2xs"
                  >
                    <Edit className="w-3.5 h-3.5 text-amber-600" />
                    <span>Update Finance</span>
                  </button>
                </div>
              </div>

              {/* Drawer Body: Employee Table */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleDrawerSelectAll}
                      className="p-1 hover:bg-[var(--muted)] rounded text-[var(--foreground)]"
                    >
                      {drawerSelectedIds.length === activeDrawerPeriod.items.length ? (
                        <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                      ) : (
                        <Square className="w-4 h-4 text-[var(--muted-foreground)]" />
                      )}
                    </button>
                    <span className="font-semibold text-[var(--foreground)]">
                      {drawerSelectedIds.length} dari {activeDrawerPeriod.items.length} Karyawan Terpilih
                    </span>
                  </div>

                  <span className="text-[11px] font-mono">
                    Sub-total: {formatRupiah(
                      activeDrawerPeriod.items
                        .filter(it => drawerSelectedIds.includes(it.id))
                        .reduce((sum, it) => sum + (Number(it.nominal) || 0), 0)
                    )}
                  </span>
                </div>

                <div className="space-y-3">
                  {activeDrawerPeriod.items.map((emp, empIdx) => {
                    const isChecked = drawerSelectedIds.includes(emp.id);

                    return (
                      <div
                        key={emp.id || empIdx}
                        className={`border border-[var(--border)] rounded-xl p-3.5 transition-all ${isChecked ? 'bg-[var(--card)] shadow-xs border-[var(--primary)]/40 ring-1 ring-[var(--primary)]/20' : 'bg-[var(--muted)]/10 opacity-70'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => handleToggleDrawerItem(emp.id)}
                              className="mt-0.5 text-[var(--foreground)] p-0.5 hover:bg-[var(--muted)] rounded"
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                              ) : (
                                <Square className="w-4 h-4 text-[var(--muted-foreground)]" />
                              )}
                            </button>

                            <div>
                              <div className="font-bold text-xs text-[var(--foreground)]">
                                {emp.nama}
                              </div>
                              <div className="text-[11px] font-mono text-[var(--muted-foreground)]">
                                NIK: {emp.nik || '-'} • HP: {emp.no_hp || '-'}
                              </div>
                              <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                                {emp.departemen} • Site <strong className="text-[var(--primary)]">{emp.site}</strong>
                              </div>
                              <div className="text-[10px] text-[var(--muted-foreground)] font-mono mt-1">
                                Perjalanan: {emp.tgl_berangkat || '-'} s/d {emp.tgl_pulang || '-'}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-xs text-[var(--primary)]">
                              {formatRupiah(emp.nominal)}
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 mt-1 inline-block">
                              {emp.status_finance || 'Draft'}
                            </span>
                          </div>
                        </div>

                        {/* Document Attachment Links */}
                        <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] font-semibold text-[var(--muted-foreground)] mr-1">
                            Lampiran:
                          </span>

                          {/* Col X: Bukti Cuti */}
                          {emp.url_bukti_cuti ? (
                            <a
                              href={emp.url_bukti_cuti}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-800 border border-teal-200 hover:underline"
                            >
                              <span>Bukti Cuti (Col X)</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400">No Cuti</span>
                          )}

                          {/* Col Y: Nota Keberangkatan */}
                          {emp.url_nota_berangkat ? (
                            <a
                              href={emp.url_nota_berangkat}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-800 border border-sky-200 hover:underline"
                            >
                              <span>Nota Berangkat (Col Y)</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400">No Nota Pergi</span>
                          )}

                          {/* Col AO: Nota Kepulangan */}
                          {emp.url_nota_pulang ? (
                            <a
                              href={emp.url_nota_pulang}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-800 border border-indigo-200 hover:underline"
                            >
                              <span>Nota Pulang (Col AO)</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-[var(--border)] bg-[var(--muted)]/20 flex items-center justify-between">
                <div className="text-xs text-[var(--muted-foreground)]">
                  {drawerSelectedIds.length} berkas siap diproses
                </div>
                <button
                  onClick={handleCloseDrawer}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)]"
                >
                  Tutup Rincian
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          6. MODAL: UPDATE FINANCE LEVEL PAKET PERIODE
      ------------------------------------------------------------- */}
      {isPeriodEditModalOpen && targetPeriodForEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  Update Finance Paket Periode
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {targetPeriodForEdit.label} ({targetPeriodForEdit.items.length} Berkas • {formatRupiah(targetPeriodForEdit.total_nominal)})
                </p>
              </div>
              <button
                onClick={() => setIsPeriodEditModalOpen(false)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded-lg hover:bg-[var(--muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Status Finance untuk 1 Paket Ini
                </label>
                <select
                  value={periodEditForm.status_finance}
                  onChange={(e) => setPeriodEditForm(p => ({ ...p, status_finance: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-semibold"
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
                    value={periodEditForm.tgl_pengajuan_finance}
                    onChange={(e) => setPeriodEditForm(p => ({ ...p, tgl_pengajuan_finance: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Tanggal Pencairan
                  </label>
                  <input
                    type="date"
                    value={periodEditForm.tgl_pencairan_finance}
                    onChange={(e) => setPeriodEditForm(p => ({ ...p, tgl_pencairan_finance: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Catatan / No. Batch Finance
                </label>
                <textarea
                  rows={2}
                  value={periodEditForm.catatan}
                  onChange={(e) => setPeriodEditForm(p => ({ ...p, catatan: e.target.value }))}
                  placeholder="Catatan penyerahan berkas atau referensi pencairan Finance..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
                />
              </div>

              <div className="text-[11px] text-[var(--muted-foreground)] bg-[var(--muted)]/40 p-3 rounded-lg border border-[var(--border)] leading-relaxed">
                ℹ️ Status dan tanggal yang diisi di sini akan otomatis diterapkan ke seluruh <strong>{targetPeriodForEdit.items.length} berkas karyawan</strong> di dalam paket periode ini.
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border)] bg-[var(--muted)]/10 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsPeriodEditModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                Batal
              </button>
              <button
                onClick={handleSavePeriodFinance}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--primary)] text-white hover:opacity-90"
              >
                Simpan Perubahan Paket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          7. MODAL: COMPILE PDF UNTUK 1 PAKET PERIODE
      ------------------------------------------------------------- */}
      {isCompileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  Compile & Download PDF {compileScopeTitle}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Menggabungkan {compileScopeRecords.length} berkas karyawan menjadi 1 paket dokumen PDF.
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
                    <span className="font-semibold text-[var(--foreground)]">Halaman Cover & Ringkasan Rekapitulasi Periode</span>
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
                ℹ️ Setiap halaman lampiran akan otomatis ditempel strip header warna Teal di bagian atas yang memuat <strong>Nama Karyawan, NIK, Departemen, dan Jenis Dokumen</strong>.
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
    </div>
  );
}
