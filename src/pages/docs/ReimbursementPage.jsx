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
  DollarSign,
  Loader2
} from 'lucide-react';
import { reimbursementClient } from '../../lib/reimbursementClient';
import { useAuth } from '../../context/AuthContext';
import { REIMBURSEMENT_STEPS, workflowCode, workflowLabel, legacyFinanceStatus, formatEmployeeName, reimbursementNikKey } from '../../utils/reimbursementWorkflow';
import CustomSelect from '../../components/ui/CustomSelect';
import { parseReimbursementCSV } from '../../utils/reimbursementSource';
import initialReimbursementData from '../../data/initialReimbursementData.json';
import {
  compileReimbursementPdf,
  openReimbursementPrintWindow,
  formatRupiah
} from '../../utils/reimbursementPdfCompiler';
import { exportPeriodToExcel, exportPeriodSummaryTableToExcel } from '../../utils/reimbursementExportExcel';
import { exportReimbursementTableToPdf } from '../../utils/reimbursementTablePdfExport';
import { api as gasClient } from '../../lib/gasClient';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const SPREADSHEET_SOURCE_URL = 'https://docs.google.com/spreadsheets/d/1qBCW0L34wtuvzM690Ajk2IFJgXm78aQidjblQHYT-90/edit?resourcekey=&gid=413081409#gid=413081409';
export const SPREADSHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1qBCW0L34wtuvzM690Ajk2IFJgXm78aQidjblQHYT-90/export?format=csv&gid=413081409';

export { parseReimbursementCSV } from '../../utils/reimbursementSource';

const formatRupiahInput = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export default function ReimbursementPage() {
  const { user } = useAuth();
  const canEditStatus = !user || !user.role || ['admin', 'ga_admin', 'ga_gl', 'ga_sh', 'finance', 'pic_lapangan', 'pic'].includes(String(user.role).toLowerCase());
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

  const [statusReady, setStatusReady] = useState(true);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const remote = await reimbursementClient.getPeriodStatuses();
        let local = {};
        try { local = JSON.parse(localStorage.getItem('garda_period_finance_meta') || '{}') || {}; } catch {}
        const missing = Object.fromEntries(Object.entries(local).filter(([key]) => !remote.data[key]));
        if (canEditStatus && Object.keys(missing).length) {
          try {
            await reimbursementClient.importPeriodStatuses(missing);
            const refreshed = await reimbursementClient.getPeriodStatuses();
            if (refreshed?.data) remote.data = refreshed.data;
          } catch (importErr) {
            console.warn('[Reimbursement import fallback]:', importErr.message);
          }
        }
        if (active && remote?.data) {
          setPeriodFinanceMeta(remote.data);
          try { localStorage.setItem('garda_period_finance_meta', JSON.stringify(remote.data)); } catch {}
        }
      } catch (error) {
        console.warn('[Reimbursement period status load]:', error.message);
      } finally {
        if (active) setStatusReady(true);
      }
    };
    load();
    return () => { active = false; };
  }, [canEditStatus]);

  // UI state
  const [viewMode, setViewMode] = useState('periods'); // 'periods' (1 paket per periode) or 'individuals' (flat list)
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedPeriodCut, setSelectedPeriodCut] = useState('all'); // 'all', 'p1', 'p2'
  const [selectedStatusFinance, setSelectedStatusFinance] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Data tersimpan; belum diverifikasi dengan sumber');

  // Drawer state: active selected period
  const [activeDrawerPeriod, setActiveDrawerPeriod] = useState(null);
  const [drawerSelectedIds, setDrawerSelectedIds] = useState([]);

  // Modals
  const [isPeriodEditModalOpen, setIsPeriodEditModalOpen] = useState(false);
  const [targetPeriodForEdit, setTargetPeriodForEdit] = useState(null);
  const [periodEditForm, setPeriodEditForm] = useState({
    workflow_status: 'not_started',
    status_finance: 'Draft',
    total_reimbursement: '',
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
    includeBoardingPass: true,
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

  // Sync with remote Google Spreadsheet (Sumber Data)
  const syncWithDatabase = async () => {
    setIsLoading(true);
    try {
      // 1. Coba lewat backend node API (yang juga terhubung langsung ke spreadsheet)
      const res = await gasClient.getReimbursements();
      if (res?.ok && Array.isArray(res.data) && res.source === 'google_spreadsheet') {
        setRecords(res.data);
        localStorage.setItem('garda_reimbursements_data', JSON.stringify(res.data));
        toast.success(`Berhasil menarik ${res.data.length} data reimbursement dari Google Spreadsheet!`);
        setSyncStatus('Tersinkron dari spreadsheet sumber');
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Backend sync failed, trying direct Google Sheet fetch:', err);
    }

    // 2. Direct browser fetch ke export CSV Google Spreadsheet
    try {
      const resp = await fetch(SPREADSHEET_CSV_URL, { signal: AbortSignal.timeout(20000) });
      if (resp.ok && resp.headers.get('content-type')?.includes('csv')) {
        const text = await resp.text();
        const parsed = parseReimbursementCSV(text);
        if (Array.isArray(parsed)) {
          setRecords(parsed);
          localStorage.setItem('garda_reimbursements_data', JSON.stringify(parsed));
          toast.success(`Berhasil menarik ${parsed.length} data reimbursement langsung dari Google Spreadsheet!`);
          setSyncStatus('Tersinkron dari spreadsheet sumber');
          setIsLoading(false);
          return;
        }
      }
    } catch (directErr) {
      console.warn('Direct fetch failed:', directErr);
    }

    // Keep the last known data if synchronization fails.
    setSyncStatus('Sinkronisasi gagal; menampilkan data terakhir');
    toast.error('Sinkronisasi spreadsheet gagal. Data terakhir tetap ditampilkan; coba sinkronkan kembali.');
    setIsLoading(false);
  };

  // Auto-sync on component mount
  useEffect(() => {
    syncWithDatabase();
  }, []);

  // Push local records to Spreadsheet tbl_docs_reimbursements
  const handlePushToDatabase = async () => {
    if (!records || records.length === 0) {
      toast.error('Tidak ada data reimbursement untuk diunggah.');
      return;
    }

    const confirmPush = window.confirm(
      `Unggah ${records.length} data reimbursement ke spreadsheet database (tbl_docs_reimbursements)? Data di spreadsheet akan diperbarui.`
    );
    if (!confirmPush) return;

    setIsLoading(true);
    try {
      const res = await gasClient.batchImportReimbursements(records, 'replace');
      if (res?.ok) {
        toast.success(`Berhasil mengunggah ${res.count || records.length} data ke spreadsheet!`);
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

  // CSV Import handler
  const handleCsvImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result;
        if (!text) return;
        const imported = parseReimbursementCSV(text);
        if (imported.length > 0) {
          setRecords(imported);
          localStorage.setItem('garda_reimbursements_data', JSON.stringify(imported));
          toast.success(`Berhasil mengimpor ${imported.length} data reimbursement!`);
          setSyncStatus('Data impor CSV; belum disinkronkan dari spreadsheet');
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
    // Build periods for every source year.
    const batchMap = {};

    const years = [...new Set([new Date().getFullYear(), ...records.map(r => Number(r.periode_tahun)).filter(Boolean)])].sort();
    years.forEach(year => MONTHS.forEach((m, mIdx) => {
      ['Periode 1 (1-15)', 'Periode 2 (16-31)'].forEach((pCut, pIdx) => {
        const key = `${year}-${String(mIdx + 1).padStart(2, '0')}-${pIdx === 0 ? 'P1' : 'P2'}`;
        const cutNumber = pIdx === 0 ? 1 : 2;
        const dateRangeStr = pIdx === 0 
          ? `01 ${m} ${year} - 15 ${m} ${year}`
          : `16 ${m} ${year} - ${new Date(year, mIdx + 1, 0).getDate()} ${m} ${year}`;

        batchMap[key] = {
          key,
          tahun: year,
          bulan: m,
          monthIndex: mIdx,
          cutNumber,
          periode_ke: pCut,
          label: `${m} ${year} - Periode ${cutNumber}`,
          rentang_tanggal: dateRangeStr,
          items: [],
          status_finance: 'Draft',
          tgl_pengajuan_finance: '',
          tgl_pencairan_finance: '',
          catatan: ''
        };
      });
    }));

    // Populate with actual records
    records.forEach(r => {
      const mIdx = MONTHS.indexOf(r.periode_bulan);
      if (mIdx === -1) return;

      const year = Number(r.periode_tahun);
      const isP1 = r.periode_ke?.includes('1-15');
      const key = `${year}-${String(mIdx + 1).padStart(2, '0')}-${isP1 ? 'P1' : 'P2'}`;

      if (batchMap[key]) {
        batchMap[key].items.push(r);

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

      const code = workflowCode(meta);
      const status = batch.items.length ? legacyFinanceStatus(code) : 'Belum Ada Berkas';

      const total_bp = batch.items.filter(it => it.url_boarding_pass).length;
      const total_cuti = batch.items.filter(it => it.url_bukti_cuti).length;
      const total_berangkat = batch.items.filter(it => it.url_nota_berangkat).length;
      const total_pulang = batch.items.filter(it => it.url_nota_pulang).length;

      return {
        ...batch,
        total_bp,
        total_cuti,
        total_berangkat,
        total_pulang,
        status_finance: status,
        workflow_status: code,
        total_reimbursement: meta.total_reimbursement ?? null,
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

      // Status Proses
      if (selectedStatusFinance !== 'all' && batch.workflow_status !== selectedStatusFinance) return false;

      // Search (matches month name or employee name inside this period)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPeriod = batch.label.toLowerCase().includes(q);
        const matchEmployee = batch.items.some(it =>
          (it.nama || '').toLowerCase().includes(q) ||
          (it.nik || '').toLowerCase().includes(q) ||
          (!!reimbursementNikKey(q) && reimbursementNikKey(it.nik) === reimbursementNikKey(q)) ||
          (it.departemen || '').toLowerCase().includes(q)
        );
        if (!matchPeriod && !matchEmployee) return false;
      }

      return true;
    });
  }, [periodBatches, selectedMonth, selectedPeriodCut, selectedStatusFinance, searchQuery]);

  // Macro KPI Metrics (Lampiran-centric, tanpa nominal)
  const macroKPIs = useMemo(() => {
    const activeBatches = periodBatches.filter(b => b.items.length > 0);
    const totalPeriodsCount = activeBatches.length;
    const totalEmployeesCount = activeBatches.reduce((sum, b) => sum + b.items.length, 0);

    const totalBoardingPass = activeBatches.reduce((sum, b) => sum + (b.total_bp || 0), 0);
    const totalBuktiCuti = activeBatches.reduce((sum, b) => sum + (b.total_cuti || 0), 0);
    const totalNotaBerangkat = activeBatches.reduce((sum, b) => sum + (b.total_berangkat || 0), 0);
    const totalNotaPulang = activeBatches.reduce((sum, b) => sum + (b.total_pulang || 0), 0);

    const dicairkanBatches = activeBatches.filter(b => b.status_finance === 'Dicairkan');
    const pendingBatches = activeBatches.filter(b => b.status_finance === 'Diajukan');
    const draftBatches = activeBatches.filter(b => b.status_finance === 'Draft');

    return {
      totalPeriodsCount,
      totalEmployeesCount,
      totalBoardingPass,
      totalBuktiCuti,
      totalNotaBerangkat,
      totalNotaPulang,
      totalReimbursement: activeBatches.reduce((sum, batch) => sum + Number(batch.total_reimbursement || 0), 0),
      recordedTotalsCount: activeBatches.filter(batch => batch.total_reimbursement !== null).length,
      dicairkanCount: dicairkanBatches.length,
      pendingCount: pendingBatches.length,
      draftCount: draftBatches.length
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
  // Table Data Reimbursement Download Handlers (PDF & Excel)
  // -------------------------------------------------------------
  const handleDownloadTablePdf = (targetBatches = null) => {
    try {
      const batches = targetBatches || filteredPeriodBatches;
      if (!batches || batches.length === 0) {
        toast.error('Tidak ada data tabel reimbursement yang dapat dicetak/diunduh.');
        return;
      }
      exportReimbursementTableToPdf({
        periodBatches: batches,
        filterInfo: {
          month: selectedMonth,
          cut: selectedPeriodCut,
          status: selectedStatusFinance
        },
        userName: user?.nama || user?.name || user?.username || 'GA Administrator',
        userRole: 'GA Administrator'
      });
      toast.success('Format cetak PDF tabel reimbursement berhasil dibuka!');
    } catch (err) {
      toast.error('Gagal membuka format cetak PDF tabel: ' + err.message);
    }
  };

  const handleDownloadTableExcel = (targetBatches = null) => {
    try {
      const batches = targetBatches || filteredPeriodBatches;
      if (!batches || batches.length === 0) {
        toast.error('Tidak ada data tabel reimbursement untuk diekspor ke Excel.');
        return;
      }
      exportPeriodSummaryTableToExcel({
        periodBatches: batches,
        filterInfo: {
          month: selectedMonth,
          cut: selectedPeriodCut,
          status: selectedStatusFinance
        },
        userName: user?.nama || user?.name || user?.username || 'GA Administrator'
      });
      toast.success('Rekapitulasi Excel tabel reimbursement berhasil diunduh!');
    } catch (err) {
      toast.error('Gagal mengekspor Excel tabel: ' + err.message);
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
    const rawTotal = batch.total_reimbursement !== null && batch.total_reimbursement !== undefined
      ? String(batch.total_reimbursement).replace(/\D/g, '')
      : '';
    setPeriodEditForm({
      workflow_status: batch.workflow_status,
      status_finance: legacyFinanceStatus(batch.workflow_status),
      total_reimbursement: rawTotal,
      tgl_pengajuan_finance: batch.tgl_pengajuan_finance || '',
      tgl_pencairan_finance: batch.tgl_pencairan_finance || '',
      catatan: batch.catatan || ''
    });
    setIsPeriodEditModalOpen(true);
  };

  const handleSavePeriodFinance = async () => {
    if (!targetPeriodForEdit || isSavingStatus) return;
    setIsSavingStatus(true);
    
    const key = targetPeriodForEdit.key;
    const cleanDigits = String(periodEditForm.total_reimbursement || '').replace(/\D/g, '');
    const cleanTotal = cleanDigits === '' ? null : cleanDigits;

    const payload = {
      ...periodEditForm,
      total_reimbursement: cleanTotal
    };
    const updatedMeta = {
      ...payload,
      period_key: key,
      updated_at: new Date().toISOString()
    };

    // 1. Simpan segera secara lokal (Optimistic UI - data tidak akan hilang)
    try {
      const currentLocal = JSON.parse(localStorage.getItem('garda_period_finance_meta') || '{}') || {};
      currentLocal[key] = updatedMeta;
      localStorage.setItem('garda_period_finance_meta', JSON.stringify(currentLocal));
    } catch {}

    setPeriodFinanceMeta(prev => ({ ...prev, [key]: updatedMeta }));
    setRecords(prev => prev.map(record => targetPeriodForEdit.items.some(item => item.id === record.id) ? { ...record, ...updatedMeta } : record));
    if (activeDrawerPeriod?.key === key) {
      setActiveDrawerPeriod(prev => ({ ...prev, ...updatedMeta, items: prev.items.map(item => ({ ...item, ...updatedMeta })) }));
    }

    // 2. Sinkronisasi ke server database
    try {
      const result = await reimbursementClient.savePeriodStatus(key, payload);
      const saved = result?.data || updatedMeta;
      setPeriodFinanceMeta(prev => ({ ...prev, [key]: saved }));
      setRecords(prev => prev.map(record => targetPeriodForEdit.items.some(item => item.id === record.id) ? { ...record, ...saved } : record));
      if (activeDrawerPeriod?.key === key) {
        setActiveDrawerPeriod(prev => ({ ...prev, ...saved, items: prev.items.map(item => ({ ...item, ...saved })) }));
      }
      toast.success('Data periode tersimpan. Status diperbarui di server & web publik.');
      setIsPeriodEditModalOpen(false);
    } catch (error) {
      console.warn('[Sync period status warning]:', error.message);
      toast.warning('Tersimpan di browser lokal, belum tersinkron ke server: ' + (error.message || 'Izin terbatas'));
      setIsPeriodEditModalOpen(false);
    } finally {
      setIsSavingStatus(false);
    }
  };

  // Dropdown options
  const monthOptions = [
    { value: 'all', label: 'Semua Bulan' },
    ...MONTHS.map(m => ({ value: m, label: `Bulan ${m}` }))
  ];

  const periodCutOptions = [
    { value: 'all', label: 'Semua Periode (P1 & P2)' },
    { value: 'p1', label: 'Periode 1 (Cut-off Tgl 1-15)' },
    { value: 'p2', label: 'Periode 2 (Cut-off Tgl 16-31)' }
  ];

  const statusFinanceOptions = [
    { value: 'all', label: 'Semua Status Proses' },
    ...REIMBURSEMENT_STEPS.map(step => ({ value: step.code, label: step.label }))
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
          <a href="/cek-reimbursement" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--foreground)]"><ExternalLink className="w-4 h-4" /> Halaman Publik</a>
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

          {/* Refresh / Tarik dari Spreadsheet */}
          <button
            onClick={syncWithDatabase}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors disabled:opacity-50 shadow-xs"
            title="Tarik data terbaru dari Google Spreadsheet"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[var(--primary)]' : ''}`} />
            <span className="hidden sm:inline">Tarik Spreadsheet</span>
          </button>

          {/* Upload / Push ke Spreadsheet */}
          <button
            onClick={handlePushToDatabase}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 text-[var(--primary)] transition-colors disabled:opacity-50 shadow-xs"
            title="Kirim dan sinkronkan seluruh data ke Google Spreadsheet tbl_docs_reimbursements"
          >
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Push ke Spreadsheet</span>
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
          SINKRONISASI SUMBER DATA GOOGLE SPREADSHEET
      ------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-teal-500/10 via-[var(--card)] to-sky-500/10 border border-teal-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-700 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--foreground)]">
                Terhubung Langsung dengan Spreadsheet Sumber Data
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync Active
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
              Gid: <span className="font-mono font-medium">413081409</span> • {records.length} berkas • {syncStatus}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <a
            href={SPREADSHEET_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors shadow-2xs"
            title="Buka Google Spreadsheet Sumber Data di Tab Baru"
          >
            <span>Buka Google Spreadsheet</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. MACRO KPI MONITORING DASHBOARD (Collapsible, Tanpa Nominal)
      ------------------------------------------------------------- */}
      {isDashboardVisible && (
        <div className="space-y-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted-foreground)]"><DollarSign className="w-4 h-4" /> Total Nilai Reimbursement</div>
            <div className="text-2xl font-bold font-mono text-[var(--primary)] mt-1">{statusReady ? formatRupiah(macroKPIs.totalReimbursement) : 'Memuat...'}</div>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">{macroKPIs.recordedTotalsCount} dari {macroKPIs.totalPeriodsCount} periode sudah diisi. Klik <strong>Ubah Status & Nilai</strong> pada periode untuk mencatat total manual dan memperbarui tahap proses.</p>
          </div>
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
                Boarding Pass
              </div>
              <div className="text-2xl font-bold font-mono text-indigo-600 mt-1">
                {macroKPIs.totalBoardingPass} <span className="text-sm font-normal text-[var(--muted-foreground)]">Berkas</span>
              </div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                {macroKPIs.totalEmployeesCount > 0 ? ((macroKPIs.totalBoardingPass / macroKPIs.totalEmployeesCount) * 100).toFixed(0) : 0}% terlampir tiket/boarding pass
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Bukti Cuti Approve
              </div>
              <div className="text-2xl font-bold font-mono text-teal-600 mt-1">
                {macroKPIs.totalBuktiCuti} <span className="text-sm font-normal text-[var(--muted-foreground)]">Berkas</span>
              </div>
              <div className="text-xs text-teal-700 mt-1 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3 text-teal-600" />
                {macroKPIs.totalEmployeesCount > 0 ? ((macroKPIs.totalBuktiCuti / macroKPIs.totalEmployeesCount) * 100).toFixed(0) : 0}% persetujuan cuti Sunfish valid
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Scan Nota Transport
              </div>
              <div className="text-xl font-bold font-mono text-sky-600 mt-1">
                {macroKPIs.totalNotaBerangkat} <span className="text-xs font-normal text-[var(--muted-foreground)]">Pergi</span> • {macroKPIs.totalNotaPulang} <span className="text-xs font-normal text-[var(--muted-foreground)]">Pulang</span>
              </div>
              <div className="text-xs text-sky-700 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-600" />
                Nota riil keberangkatan & kepulangan
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

          {/* Status Proses Filter */}
          <div className="w-52">
            <CustomSelect
              icon={CheckCircle2}
              value={selectedStatusFinance}
              onChange={setSelectedStatusFinance}
              options={statusFinanceOptions}
              placeholder="Status Proses..."
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
          {/* Action Bar for Table Download (PDF & Excel) */}
          <div className="px-4 py-3 bg-[var(--muted)]/20 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--foreground)]">
                Tabel Rekapitulasi Data Reimbursement
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-semibold font-mono">
                {filteredPeriodBatches.length} Periode
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Tombol Cetak / Unduh PDF Reworked Table */}
              <button
                onClick={() => handleDownloadTablePdf()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-teal-600/30 bg-teal-50 hover:bg-teal-100 text-teal-800 transition-colors shadow-2xs cursor-pointer"
                title="Buka & Unduh PDF Format Rekapitulasi Tabel (Landscape Reworked Layout Lengkap dengan Nilai Rupiah, Tanggal Pengajuan, Pencairan, dan Status)"
              >
                <Printer className="w-3.5 h-3.5 text-teal-700" />
                <span>Cetak / PDF Tabel</span>
              </button>

              {/* Tombol Unduh Excel Tabel */}
              <button
                onClick={() => handleDownloadTableExcel()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-600/30 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors shadow-2xs cursor-pointer"
                title="Unduh Tabel Rekapitulasi ke Excel (.xlsx) dengan Nilai Rupiah, Tanggal Pengajuan, Pencairan, dan Status"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Unduh Excel Tabel</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
                <tr>
                  <th className="py-3 px-2.5 w-8 text-center">No</th>
                  <th className="py-3 px-3 whitespace-nowrap">Paket Periode</th>
                  <th className="py-3 px-3 whitespace-nowrap">Rentang Form</th>
                  <th className="py-3 px-2.5 text-center whitespace-nowrap">Jumlah Berkas</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Kelengkapan Lampiran</th>
                  <th className="py-3 px-2.5 text-center whitespace-nowrap">Status Proses</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Total Reimbursement</th>
                  <th className="py-3 px-3 whitespace-nowrap">Jadwal Finance</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap w-[260px]">Aksi Paket Periode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                {filteredPeriodBatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[var(--muted-foreground)]">
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
                        <td className="py-2.5 px-2.5 text-center font-mono text-[var(--muted-foreground)]">
                          {idx + 1}
                        </td>

                        {/* Paket Periode */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-xs text-[var(--foreground)] flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0" />
                            {batch.label}
                          </div>
                          <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5 whitespace-nowrap">
                            Cut-off: {batch.periode_ke}
                          </div>
                        </td>

                        {/* Rentang Tanggal */}
                        <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                          <div className="flex items-center gap-1 text-[var(--foreground)]">
                            <Calendar className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                            <span>{batch.rentang_tanggal}</span>
                          </div>
                        </td>

                        {/* Jumlah Berkas */}
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${hasItems ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'bg-slate-100 text-slate-500'}`}>
                            <Users className="w-3 h-3 shrink-0" />
                            {batch.items.length} Berkas
                          </span>
                        </td>

                        {/* Kelengkapan Lampiran */}
                        <td className="py-2.5 px-3 whitespace-nowrap text-center">
                          <div className="inline-flex items-center gap-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${batch.total_bp > 0 ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                              title={`Boarding Pass: ${batch.total_bp} / ${batch.items.length}`}
                            >
                              BP:{batch.total_bp}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${batch.total_cuti > 0 ? 'bg-teal-50 text-teal-800 border border-teal-200' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                              title={`Bukti Cuti: ${batch.total_cuti} / ${batch.items.length}`}
                            >
                              Cuti:{batch.total_cuti}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${batch.total_berangkat > 0 ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                              title={`Nota Berangkat: ${batch.total_berangkat} / ${batch.items.length}`}
                            >
                              Pergi:{batch.total_berangkat}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${batch.total_pulang > 0 ? 'bg-purple-50 text-purple-800 border border-purple-200' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                              title={`Nota Pulang: ${batch.total_pulang} / ${batch.items.length}`}
                            >
                              Pulang:{batch.total_pulang}
                            </span>
                          </div>
                        </td>

                        {/* Status Proses */}
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadgeClass}`}>
                            {batch.status_finance === 'Dicairkan' && <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />}
                            {batch.status_finance === 'Diajukan' && <Clock className="w-3 h-3 text-amber-600 shrink-0" />}
                            {batch.items.length ? workflowLabel(batch.workflow_status) : 'Belum Ada Berkas'}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap">
                          {statusReady ? batch.total_reimbursement === null ? <span className="text-[var(--muted-foreground)]">Belum diisi</span> : formatRupiah(batch.total_reimbursement) : 'Memuat...'}
                        </td>
                        {/* Jadwal Finance */}
                        <td className="py-2.5 px-3 font-mono text-[10px] whitespace-nowrap">
                          <div className="text-[var(--foreground)]">Ajuan: <span className="font-semibold">{batch.tgl_pengajuan_finance || '-'}</span></div>
                          <div className="text-emerald-700">Cair: <span className="font-semibold">{batch.tgl_pencairan_finance || '-'}</span></div>
                        </td>

                        {/* Aksi Paket Periode */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                            {/* Detail Drawer Button */}
                            <button
                              onClick={() => handleOpenPeriodDrawer(batch)}
                              disabled={!hasItems}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] disabled:opacity-40 transition-colors shadow-2xs shrink-0"
                              title="Buka rincian seluruh berkas karyawan pada periode ini"
                            >
                              <Eye className="w-3.5 h-3.5 text-[var(--primary)]" />
                              <span>Detail</span>
                            </button>

                            {/* Format Cetak / Preview Laporan Window */}
                            <button
                              onClick={() => openReimbursementPrintWindow({ selectedRecords: batch.items, periodLabel: batch.label })}
                              disabled={!hasItems}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 disabled:opacity-40 transition-colors shadow-2xs shrink-0"
                              title="Buka Format Cetak A4 Laporan Rekapitulasi Periode (Best Practice Layout dengan 4 Lampiran per Karyawan)"
                            >
                              <Printer className="w-3.5 h-3.5 text-sky-700" />
                              <span>Cetak</span>
                            </button>

                            {/* Update Finance Button */}
                            <button
                              onClick={() => handleOpenPeriodFinanceEdit(batch)}
                              disabled={!hasItems}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-amber-300/80 bg-amber-50/70 hover:bg-amber-100 text-amber-900 disabled:opacity-40 transition-colors shadow-2xs shrink-0"
                              title="Ubah status proses periode dan tampilkan di halaman publik"
                            >
                              <Edit className="w-3.5 h-3.5 text-amber-700" />
                              <span>Ubah Status & Nilai</span>
                            </button>

                            {/* Unduh Rekapan Excel */}
                            <button
                              onClick={() => handleExportPeriodExcel(batch)}
                              disabled={!hasItems}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 disabled:opacity-40 transition-colors shadow-2xs shrink-0"
                              title="Unduh file Rekapan Excel (.xlsx) untuk diserahkan ke Finance"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Excel</span>
                            </button>

                            {/* Compile PDF Button */}
                            <button
                              onClick={() => handleTriggerPeriodPdfCompile(batch)}
                              disabled={!hasItems}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-2xs shrink-0"
                              title="Compile seluruh lampiran (Boarding Pass, Bukti Cuti, Nota Berangkat, Nota Pulang) periode ini ke 1 file PDF"
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
                  <th className="py-3 px-3 w-10 text-center">No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[130px]">Tgl Form & Periode</th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[160px]">Nama Karyawan & NIK</th>
                  <th className="py-3 px-3.5 whitespace-nowrap min-w-[180px]">Departemen & Site</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[140px]">Tgl Perjalanan</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap min-w-[260px]">4 Lampiran Dokumen (AP, X, Y, AO)</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap min-w-[110px]">Status Proses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                {records.slice(0, 150).map((r, idx) => (
                  <tr key={r.id || idx} className="hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="py-3 px-3 text-center font-mono text-[var(--muted-foreground)]">{idx + 1}</td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="font-mono text-[11px] text-[var(--foreground)]">{r.timestamp?.split(' ')[0]}</div>
                      <div className="text-[10px] text-[var(--primary)] font-bold">{r.periode_bulan} • {r.periode_ke}</div>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="font-bold text-xs text-[var(--foreground)]">{formatEmployeeName(r.nama)}</div>
                      <div className="text-[10px] font-mono text-[var(--muted-foreground)]">NIK: {r.nik}</div>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="text-xs text-[var(--foreground)] truncate max-w-[200px]" title={r.departemen}>{r.departemen}</div>
                      <div className="text-[10px] text-[var(--muted-foreground)]">Site <strong className="text-[var(--foreground)]">{r.site}</strong></div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">
                      <div>{r.tgl_berangkat} s/d {r.tgl_pulang}</div>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {/* 1. Boarding Pass (Col AP) */}
                        {r.url_boarding_pass ? (
                          <a
                            href={r.url_boarding_pass}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs"
                            title="[1] Boarding Pass Penerbangan Cuti"
                          >
                            BP
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-300">-</span>
                        )}

                        {/* 2. Bukti Cuti (Col X) */}
                        {r.url_bukti_cuti ? (
                          <a
                            href={r.url_bukti_cuti}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-colors shadow-2xs"
                            title="[2] Bukti Cuti Approval Sunfish"
                          >
                            Cuti
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-300">-</span>
                        )}

                        {/* 3. Nota Berangkat (Col Y) */}
                        {r.url_nota_berangkat ? (
                          <a
                            href={r.url_nota_berangkat}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 transition-colors shadow-2xs"
                            title="[3] Nota Keberangkatan"
                          >
                            Pergi
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-300">-</span>
                        )}

                        {/* 4. Nota Pulang (Col AO) */}
                        {r.url_nota_pulang ? (
                          <a
                            href={r.url_nota_pulang}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 transition-colors shadow-2xs"
                            title="[4] Nota Kepulangan"
                          >
                            Pulang
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-300">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${r.status_finance === 'Dicairkan' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : r.status_finance === 'Diajukan' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {workflowLabel(workflowCode(periodFinanceMeta[`${r.periode_tahun}-${String(MONTHS.indexOf(r.periode_bulan)+1).padStart(2,'0')}-${r.periode_ke?.includes('1-15') ? 'P1' : 'P2'}`] || {}))}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[var(--border)]">
                  <div>
                    <div className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Kelengkapan Lampiran</div>
                    <div className="text-xs font-bold font-mono text-[var(--primary)] mt-0.5">
                      {activeDrawerPeriod.items.filter(it => it.url_boarding_pass && it.url_bukti_cuti && it.url_nota_berangkat).length} / {activeDrawerPeriod.items.length} Lengkap (AP, X, Y)
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Status Proses</div>
                    <div className="text-xs font-bold text-[var(--foreground)]">
                      {workflowLabel(activeDrawerPeriod.workflow_status)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Total Reimbursement</div>
                    <div className="text-xs font-mono font-bold text-emerald-700">
                      {activeDrawerPeriod.total_reimbursement !== null && activeDrawerPeriod.total_reimbursement !== undefined
                        ? formatRupiah(activeDrawerPeriod.total_reimbursement)
                        : <span className="text-[var(--muted-foreground)] font-normal">Belum diisi</span>}
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
                  {/* Cetak / Rekap PDF A4 Window Button */}
                  <button
                    onClick={() => {
                      const selectedInDrawer = activeDrawerPeriod.items.filter(it => drawerSelectedIds.includes(it.id));
                      openReimbursementPrintWindow({
                        selectedRecords: selectedInDrawer.length > 0 ? selectedInDrawer : activeDrawerPeriod.items,
                        periodLabel: activeDrawerPeriod.label
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 shadow-2xs"
                    title="Buka Format Cetak A4 Laporan Rekapitulasi Periode (Best Practice Layout dengan 4 Lampiran per Karyawan)"
                  >
                    <Printer className="w-3.5 h-3.5 text-sky-700" />
                    <span>Cetak / Rekap PDF A4</span>
                  </button>

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

                  {/* Cetak / PDF Tabel Ringkasan Periode Ini */}
                  <button
                    onClick={() => handleDownloadTablePdf([activeDrawerPeriod])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-teal-600/30 bg-teal-50 hover:bg-teal-100 text-teal-800 shadow-2xs"
                    title="Cetak Format PDF Reworked Tabel untuk Periode Ini Saja"
                  >
                    <Printer className="w-3.5 h-3.5 text-teal-700" />
                    <span>PDF Ringkasan Periode</span>
                  </button>

                  {/* Edit Finance Button */}
                  <button
                    onClick={() => handleOpenPeriodFinanceEdit(activeDrawerPeriod)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] shadow-2xs"
                  >
                    <Edit className="w-3.5 h-3.5 text-amber-600" />
                    <span>Ubah Status & Nilai</span>
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

                  <span className="text-[11px] font-mono text-[var(--muted-foreground)]">
                    Urutan: [1] BP • [2] Cuti • [3] Nota Berangkat • [4] Nota Pulang
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
                                {formatEmployeeName(emp.nama)}
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
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block ${emp.status_finance === 'Dicairkan' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : emp.status_finance === 'Diajukan' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                              {workflowLabel(activeDrawerPeriod.workflow_status)}
                            </span>
                          </div>
                        </div>

                        {/* Document Attachment Links (Urutan Pasti: 1. Boarding pass AP, 2. Bukti Cuti X, 3. Scan nota berangkat Y, 4. Bukti nota pulang AO) */}
                        <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] font-semibold text-[var(--muted-foreground)] mr-1">
                            Lampiran:
                          </span>

                          {/* 1. Col AP: Boarding Pass */}
                          {emp.url_boarding_pass ? (
                            <a
                              href={emp.url_boarding_pass}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 hover:underline"
                            >
                              <span>[1] BP</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">[1] No BP</span>
                          )}

                          {/* 2. Col X: Bukti Cuti */}
                          {emp.url_bukti_cuti ? (
                            <a
                              href={emp.url_bukti_cuti}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200 hover:underline"
                            >
                              <span>[2] Cuti</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">[2] No Cuti</span>
                          )}

                          {/* 3. Col Y: Nota Keberangkatan */}
                          {emp.url_nota_berangkat ? (
                            <a
                              href={emp.url_nota_berangkat}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 hover:underline"
                            >
                              <span>[3] Pergi</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">[3] No Nota Pergi</span>
                          )}

                          {/* 4. Col AO: Nota Kepulangan */}
                          {emp.url_nota_pulang ? (
                            <a
                              href={emp.url_nota_pulang}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 hover:underline"
                            >
                              <span>[4] Pulang</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded">[4] No Nota Pulang</span>
                          )}
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
                  Ubah Status & Nilai Periode
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {targetPeriodForEdit.label} ({targetPeriodForEdit.items.length} Berkas Karyawan)
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
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="reimbursement-total" className="block text-xs font-semibold text-[var(--foreground)]">
                    Total Nilai Reimbursement (Rp)
                  </label>
                  {periodEditForm.total_reimbursement ? (
                    <span className="text-[11px] font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      {formatRupiah(periodEditForm.total_reimbursement)}
                    </span>
                  ) : null}
                </div>
                <div className="relative rounded-lg shadow-2xs">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-xs font-bold text-[var(--muted-foreground)]">Rp</span>
                  </div>
                  <input
                    id="reimbursement-total"
                    type="text"
                    inputMode="numeric"
                    value={formatRupiahInput(periodEditForm.total_reimbursement)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      if (digits.length > 12) return;
                      setPeriodEditForm(form => ({ ...form, total_reimbursement: digits }));
                    }}
                    placeholder="0 (contoh: 15.000.000)"
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-mono font-bold rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--primary)] focus:outline-none transition-all"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] mt-1.5">
                  <span>Ketik nominal rupiah. Otomatis diformat ribuan.</span>
                  {periodEditForm.total_reimbursement ? (
                    <button
                      type="button"
                      onClick={() => setPeriodEditForm(form => ({ ...form, total_reimbursement: '' }))}
                      className="text-[10px] text-red-500 hover:text-red-700 underline cursor-pointer"
                    >
                      Hapus Nilai
                    </button>
                  ) : null}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Tahap Proses Periode
                </label>
                <select
                  value={periodEditForm.workflow_status}
                  onChange={(e) => setPeriodEditForm(p => ({ ...p, workflow_status: e.target.value, status_finance: legacyFinanceStatus(e.target.value) }))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-semibold"
                >
                  {REIMBURSEMENT_STEPS.map(step => <option key={step.code} value={step.code}>{step.label}</option>)}
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
                    disabled={periodEditForm.workflow_status !== 'paid'}
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
                type="button"
                onClick={handleSavePeriodFinance}
                disabled={isSavingStatus}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                {isSavingStatus ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan Data Periode</span>
                )}
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
                      checked={compileOptions.includeBoardingPass}
                      onChange={(e) => setCompileOptions(p => ({ ...p, includeBoardingPass: e.target.checked }))}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span>[1] Lampiran <strong>Boarding Pass Penerbangan Cuti</strong></span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compileOptions.includeBuktiCuti}
                      onChange={(e) => setCompileOptions(p => ({ ...p, includeBuktiCuti: e.target.checked }))}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span>[2] Lampiran <strong>Bukti Cuti Approval Sunfish</strong></span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compileOptions.includeNotaBerangkat}
                      onChange={(e) => setCompileOptions(p => ({ ...p, includeNotaBerangkat: e.target.checked }))}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span>[3] Lampiran <strong>Nota Keberangkatan Transport</strong></span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compileOptions.includeNotaPulang}
                      onChange={(e) => setCompileOptions(p => ({ ...p, includeNotaPulang: e.target.checked }))}
                      className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span>[4] Lampiran <strong>Nota Kepulangan Transport</strong></span>
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

            <div className="p-4 border-t border-[var(--border)] bg-[var(--muted)]/10 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  openReimbursementPrintWindow({
                    selectedRecords: compileScopeRecords,
                    periodLabel: compileScopeTitle,
                    options: compileOptions
                  });
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 inline-flex items-center gap-1.5 shadow-2xs"
                title="Buka format print preview A4 langsung di browser untuk dicetak atau disimpan ke PDF"
              >
                <Printer className="w-4 h-4 text-sky-700" />
                <span>Buka Format Cetak (Print View)</span>
              </button>

              <div className="flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
}
