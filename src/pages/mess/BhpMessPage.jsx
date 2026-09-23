import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGlobalLoading } from '../../context/LoadingContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building,
  Package,
  Layers,
  Calendar,
  AlertTriangle,
  TrendingUp,
  ArrowRightLeft,
  ClipboardCheck,
  FileText,
  FileDown,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Save,
  Check,
  AlertCircle,
  Truck,
  RotateCcw,
  BarChart3,
  HelpCircle,
  Sliders,
  DollarSign,
  UserCheck,
  Database
} from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';
import {
  checkPgHealth,
  savePgBhpUsage,
  savePgBhpStockIn,
  savePgBhpTransfer,
  savePgBhpOpname,
  savePgBhpPdfHistory
} from '../../lib/pgClient';
import {
  INITIAL_BHP_ITEMS,
  INITIAL_BHP_STOCKS,
  INITIAL_BHP_SITE_PARAMS,
  INITIAL_BHP_USAGES,
  INITIAL_BHP_STOCK_INS,
  INITIAL_BHP_TRANSFERS,
  INITIAL_BHP_OPNAMES,
  INITIAL_BHP_EVALUATIONS,
  INITIAL_BHP_PDF_HISTORY,
  SITES_BHP
} from '../../data/initialBhpData';
import {
  generateBhpForecastPdfReport,
  generateBhpEvaluationPdfReport,
  formatRupiah
} from '../../utils/bhpPdfExport';
import { api as gasClient } from '../../lib/gasClient';

export default function BhpMessPage() {
  const { user } = useAuth();
  const { showLoading, hideLoading } = useGlobalLoading();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'usage', 'stock_in', 'transfer', 'opname', 'forecast', 'evaluation', 'master'
  // Active Site Filter
  const [selectedSite, setSelectedSite] = useState('ALL'); // 'ALL' (Konsolidasi), 'LBCT', 'IDMG', 'SPCT'

  // PostgreSQL 16 Connection Status & Diagnostics
  const [dbInfo, setDbInfo] = useState({ status: 'checking', activeMode: 'transaction', databaseEngine: 'PostgreSQL 16' });
  const [showDbModal, setShowDbModal] = useState(false);
  const [isTestingDb, setIsTestingDb] = useState(false);

  const refreshDbStatus = async () => {
    setIsTestingDb(true);
    try {
      const res = await checkPgHealth();
      setDbInfo(res);
      if (res.status === 'online') {
        toast.success(`Terhubung ke PostgreSQL 16 (${res.activeMode || 'Transaction Pooler'}) • Ping: ${res.pingMs}ms`);
      }
    } finally {
      setIsTestingDb(false);
    }
  };

  useEffect(() => {
    checkPgHealth().then(res => setDbInfo(res));
  }, []);
  
  // Storage state initialized from LocalStorage or Initial Data
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_items');
    return saved ? JSON.parse(saved) : INITIAL_BHP_ITEMS;
  });

  const [stocks, setStocks] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_stocks');
    return saved ? JSON.parse(saved) : INITIAL_BHP_STOCKS;
  });

  const [siteParams, setSiteParams] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_site_params');
    return saved ? JSON.parse(saved) : INITIAL_BHP_SITE_PARAMS;
  });

  const [usages, setUsages] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_usages');
    return saved ? JSON.parse(saved) : INITIAL_BHP_USAGES;
  });

  const [stockIns, setStockIns] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_stock_ins');
    return saved ? JSON.parse(saved) : INITIAL_BHP_STOCK_INS;
  });

  const [transfers, setTransfers] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_transfers');
    return saved ? JSON.parse(saved) : INITIAL_BHP_TRANSFERS;
  });

  const [opnames, setOpnames] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_opnames');
    return saved ? JSON.parse(saved) : INITIAL_BHP_OPNAMES;
  });

  const [evaluations, setEvaluations] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_evaluations');
    return saved ? JSON.parse(saved) : INITIAL_BHP_EVALUATIONS;
  });

  const [pdfHistory, setPdfHistory] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_pdf_history');
    return saved ? JSON.parse(saved) : INITIAL_BHP_PDF_HISTORY;
  });

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('garda_bhp_items', JSON.stringify(items));
    localStorage.setItem('garda_bhp_stocks', JSON.stringify(stocks));
    localStorage.setItem('garda_bhp_site_params', JSON.stringify(siteParams));
    localStorage.setItem('garda_bhp_usages', JSON.stringify(usages));
    localStorage.setItem('garda_bhp_stock_ins', JSON.stringify(stockIns));
    localStorage.setItem('garda_bhp_transfers', JSON.stringify(transfers));
    localStorage.setItem('garda_bhp_opnames', JSON.stringify(opnames));
    localStorage.setItem('garda_bhp_evaluations', JSON.stringify(evaluations));
    localStorage.setItem('garda_bhp_pdf_history', JSON.stringify(pdfHistory));
  }, [items, stocks, siteParams, usages, stockIns, transfers, opnames, evaluations, pdfHistory]);

  // Signature Modal for PDF Generation (Requires GA Admin & GA GL Names)
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfModalType, setPdfModalType] = useState('forecast'); // 'forecast' or 'evaluation'
  const [signerAdminName, setSignerAdminName] = useState(() => {
    return localStorage.getItem('bhp_signer_admin') || (user?.name ? `${user.name} (GA Admin)` : 'Bagus Prasetyo (GA Admin)');
  });
  const [signerGlName, setSignerGlName] = useState(() => {
    return localStorage.getItem('bhp_signer_gl') || 'M. Rizky Ramadhan (GA GL)';
  });

  // --------------------------------------------------------------------------
  // CALCULATED METRICS & DAILY USAGES
  // --------------------------------------------------------------------------

  // Average Daily Usage per item per site
  const itemMetrics = useMemo(() => {
    const metrics = {};
    const sites = ['LBCT', 'IDMG', 'SPCT'];

    items.forEach(it => {
      metrics[it.id] = {
        item: it,
        perSite: {},
        totalStock: 0,
        totalDailyAvg: 0
      };

      sites.forEach(st => {
        const siteUsages = usages.filter(u => u.site === st && u.item_id === it.id);
        const totalQty = siteUsages.reduce((sum, u) => sum + Number(u.qty || 0), 0);
        // Weighted average approximation based on records (default 14 days)
        const dailyAvg = siteUsages.length > 0 ? totalQty / Math.max(siteUsages.length, 10) : 1.5;
        const currentStock = stocks[st]?.[it.id] || 0;
        const doc = dailyAvg > 0 ? Math.round(currentStock / dailyAvg) : 999;
        
        const override = siteParams[st]?.[it.id] || {};
        const abcClass = override.abc_class || it.default_abc;
        const safetyPct = override.safety_pct || it.default_safety_pct || 5;

        // Early warning: If DoC <= 5 days, stock will deplete before arrival W5
        const isCriticalW5 = doc <= 5;
        const isWarningW4 = doc > 5 && doc <= 10;

        metrics[it.id].perSite[st] = {
          currentStock,
          dailyAvg,
          doc,
          abcClass,
          safetyPct,
          isCriticalW5,
          isWarningW4
        };

        metrics[it.id].totalStock += currentStock;
        metrics[it.id].totalDailyAvg += dailyAvg;
      });
    });

    return metrics;
  }, [items, stocks, siteParams, usages]);

  // Early Warning list: items where DoC <= 5 at any site (or selected site)
  const criticalItemsList = useMemo(() => {
    const list = [];
    const targetSites = selectedSite === 'ALL' ? ['LBCT', 'IDMG', 'SPCT'] : [selectedSite];

    items.forEach(it => {
      targetSites.forEach(st => {
        const stMetric = itemMetrics[it.id]?.perSite[st];
        if (stMetric && stMetric.isCriticalW5) {
          list.push({
            item: it,
            site: st,
            currentStock: stMetric.currentStock,
            dailyAvg: stMetric.dailyAvg,
            doc: stMetric.doc,
            abcClass: stMetric.abcClass
          });
        }
      });
    });
    return list;
  }, [items, itemMetrics, selectedSite]);

  // Forecast Recommendations Generation (Horizon 28 Days: W4-W5 + next W1-W2)
  const forecastRecommendations = useMemo(() => {
    const recs = [];
    const targetSites = selectedSite === 'ALL' ? ['LBCT', 'IDMG', 'SPCT'] : [selectedSite];

    items.forEach(it => {
      if (selectedSite === 'ALL') {
        // Consolidated
        let sumDemand = 0;
        let sumSafety = 0;
        let sumProj = 0;
        let sumPcs = 0;
        let sumPacks = 0;
        let avgUsage = 0;

        ['LBCT', 'IDMG', 'SPCT'].forEach(st => {
          const m = itemMetrics[it.id]?.perSite[st];
          if (m) {
            const hDemand = m.dailyAvg * 28;
            const sStock = hDemand * (m.safetyPct / 100);
            const pStock = Math.max(0, m.currentStock - (m.dailyAvg * 10)); // 10 days remaining to arrival
            const netPcs = Math.max(0, hDemand + sStock - pStock);
            const packs = Math.ceil(netPcs / it.pack_qty);
            const finalPcs = packs * it.pack_qty;

            sumDemand += hDemand;
            sumSafety += sStock;
            sumProj += pStock;
            sumPcs += finalPcs;
            sumPacks += packs;
            avgUsage += m.dailyAvg;
          }
        });

        recs.push({
          item_id: it.id,
          code: it.code,
          name: it.name,
          category: it.category,
          unit: it.unit,
          pack_qty: it.pack_qty,
          pack_unit: it.pack_unit,
          price_est: it.price_est,
          abc_class: it.default_abc,
          avg_daily_usage: avgUsage,
          period_demand: sumDemand,
          safety_pct: it.default_safety_pct,
          safety_stock: sumSafety,
          projected_stock: sumProj,
          recommended_qty_pcs: sumPcs,
          recommended_packs: sumPacks,
          variance_flag: sumPacks > 0 && sumDemand / Math.max(sumProj, 1) > 3,
          notes: 'Gabungan 3 Site (LBCT, IDMG, SPCT)'
        });
      } else {
        // Per single site
        const m = itemMetrics[it.id]?.perSite[selectedSite];
        if (m) {
          const hDemand = m.dailyAvg * 28;
          const sStock = hDemand * (m.safetyPct / 100);
          const pStock = Math.max(0, m.currentStock - (m.dailyAvg * 10));
          const netPcs = Math.max(0, hDemand + sStock - pStock);
          const packs = Math.ceil(netPcs / it.pack_qty);
          const finalPcs = packs * it.pack_qty;

          recs.push({
            item_id: it.id,
            code: it.code,
            name: it.name,
            category: it.category,
            unit: it.unit,
            pack_qty: it.pack_qty,
            pack_unit: it.pack_unit,
            price_est: it.price_est,
            abc_class: m.abcClass,
            avg_daily_usage: m.dailyAvg,
            period_demand: hDemand,
            safety_pct: m.safetyPct,
            safety_stock: sStock,
            projected_stock: pStock,
            recommended_qty_pcs: finalPcs,
            recommended_packs: packs,
            variance_flag: m.isCriticalW5 || (packs > 0 && hDemand / Math.max(pStock, 1) > 3),
            notes: `Rekomendasi khusus ${selectedSite}`
          });
        }
      }
    });

    return recs;
  }, [items, itemMetrics, selectedSite]);

  // --------------------------------------------------------------------------
  // FORM STATES: BULK USAGE ENTRY
  // --------------------------------------------------------------------------
  const [bulkSite, setBulkSite] = useState(selectedSite === 'ALL' ? 'LBCT' : selectedSite);
  const [bulkDate, setBulkDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bulkRows, setBulkRows] = useState([
    { item_id: 'BHP-001', qty: '', notes: '' },
    { item_id: 'BHP-005', qty: '', notes: '' }
  ]);

  const handleAddBulkRow = () => {
    setBulkRows([...bulkRows, { item_id: items[0]?.id || 'BHP-001', qty: '', notes: '' }]);
  };

  const handleRemoveBulkRow = (index) => {
    setBulkRows(bulkRows.filter((_, idx) => idx !== index));
  };

  const handleBulkRowChange = (index, field, value) => {
    const updated = [...bulkRows];
    updated[index][field] = value;
    setBulkRows(updated);
  };

  const handleSaveBulkUsage = () => {
    const validRows = bulkRows.filter(r => Number(r.qty) > 0);
    if (validRows.length === 0) {
      return toast.warning('Harap isi jumlah pemakaian minimal satu item dengan angka valid');
    }

    showLoading();
    try {
      const newUsages = validRows.map((r, i) => {
        const itemObj = items.find(it => it.id === r.item_id);
        const dailyAvg = itemMetrics[r.item_id]?.perSite[bulkSite]?.dailyAvg || 2;
        const isAnomaly = Number(r.qty) > 3 * dailyAvg;

        return {
          id: `USG-${Date.now()}-${i}`,
          date: bulkDate,
          site: bulkSite,
          item_id: r.item_id,
          qty: Number(r.qty),
          pic_name: user?.name || 'PIC Lapangan',
          pic_nik: user?.nik || 'PIC-SYS',
          notes: r.notes || (isAnomaly ? 'Pemakaian tinggi tercatat' : 'Pemakaian harian'),
          is_anomaly: isAnomaly
        };
      });

      // Automatically deduct from running stock
      setStocks(prev => {
        const updated = { ...prev };
        const siteStock = { ...(updated[bulkSite] || {}) };
        validRows.forEach(r => {
          siteStock[r.item_id] = Math.max(0, (siteStock[r.item_id] || 0) - Number(r.qty));
        });
        updated[bulkSite] = siteStock;
        return updated;
      });

      setUsages(prev => [...newUsages, ...prev]);

      // Sync to PostgreSQL 16 in background
      savePgBhpUsage({
        entries: validRows.map(r => ({
          itemCode: r.item_id,
          qty: r.qty,
          isAnomaly: Number(r.qty) > 3 * (itemMetrics[r.item_id]?.perSite[bulkSite]?.dailyAvg || 2),
          notes: r.notes
        })),
        picName: user?.name || 'PIC Lapangan',
        site: bulkSite,
        date: bulkDate
      }).catch(err => console.warn('[PG-Sync] Usage background sync:', err.message));

      const hasAnomaly = newUsages.some(u => u.is_anomaly);
      if (hasAnomaly) {
        toast.warning('Pemakaian dicatat! Terdeteksi input > 3x rata-rata historis (ditandai flag kuning untuk audit).');
      } else {
        toast.success(`Berhasil mencatat ${validRows.length} item pemakaian harian di ${bulkSite}!`);
      }

      // Reset bulk rows
      setBulkRows([
        { item_id: items[0]?.id || 'BHP-001', qty: '', notes: '' }
      ]);
    } catch (e) {
      toast.error('Gagal menyimpan pemakaian');
    } finally {
      hideLoading();
    }
  };

  // --------------------------------------------------------------------------
  // FORM STATES: STOCK IN (PENERIMAAN BARANG W5)
  // --------------------------------------------------------------------------
  const [stockInForm, setStockInForm] = useState({
    site: 'LBCT',
    date: new Date().toISOString().split('T')[0],
    item_id: 'BHP-001',
    qty_pcs: '',
    ref_no: '',
    supplier_name: 'CV. Berkah Sanitasi Kalsel',
    condition_status: 'Lengkap',
    notes: ''
  });

  const handleSaveStockIn = (e) => {
    e.preventDefault();
    if (!stockInForm.qty_pcs || Number(stockInForm.qty_pcs) <= 0) {
      return toast.warning('Jumlah qty diterima harus lebih dari 0');
    }

    showLoading();
    try {
      const itemObj = items.find(it => it.id === stockInForm.item_id);
      const packs = itemObj ? Math.round(Number(stockInForm.qty_pcs) / itemObj.pack_qty) : 1;

      const newRecord = {
        id: `RCV-${Date.now()}`,
        date: stockInForm.date,
        site: stockInForm.site,
        item_id: stockInForm.item_id,
        qty: Number(stockInForm.qty_pcs),
        qty_packs: packs,
        ref_no: stockInForm.ref_no || 'PO-MANUAL/PENDING',
        supplier_name: stockInForm.supplier_name,
        condition_status: stockInForm.condition_status,
        pic_name: user?.name || 'GA Staff',
        notes: stockInForm.notes || 'Penerimaan barang'
      };

      // Increase stock
      setStocks(prev => {
        const updated = { ...prev };
        const siteStock = { ...(updated[stockInForm.site] || {}) };
        siteStock[stockInForm.item_id] = (siteStock[stockInForm.item_id] || 0) + Number(stockInForm.qty_pcs);
        updated[stockInForm.site] = siteStock;
        return updated;
      });

      setStockIns(prev => [newRecord, ...prev]);

      // Sync to PostgreSQL 16 in background
      savePgBhpStockIn({
        date: stockInForm.date,
        site: stockInForm.site,
        itemCode: stockInForm.item_id,
        qty: stockInForm.qty_pcs,
        refPo: stockInForm.ref_no,
        conditionStatus: stockInForm.condition_status,
        receiverName: user?.name || 'GA Staff',
        notes: stockInForm.notes
      }).catch(err => console.warn('[PG-Sync] Stock-in background sync:', err.message));

      toast.success(`Stok masuk berhasil dicatat! Stok ${stockInForm.site} bertambah.`);
      setStockInForm({
        ...stockInForm,
        qty_pcs: '',
        ref_no: '',
        notes: ''
      });
    } catch (e) {
      toast.error('Gagal mencatat stok masuk');
    } finally {
      hideLoading();
    }
  };

  // --------------------------------------------------------------------------
  // FORM STATES: STOCK TRANSFER BETWEEN SITES (EMERGENCY)
  // --------------------------------------------------------------------------
  const [transferForm, setTransferForm] = useState({
    date: new Date().toISOString().split('T')[0],
    item_id: 'BHP-005',
    qty: '',
    from_site: 'IDMG',
    to_site: 'SPCT',
    reason: ''
  });

  const handleSaveTransfer = (e) => {
    e.preventDefault();
    if (!transferForm.qty || Number(transferForm.qty) <= 0) {
      return toast.warning('Jumlah transfer harus lebih dari 0');
    }
    if (transferForm.from_site === transferForm.to_site) {
      return toast.warning('Site asal dan site tujuan tidak boleh sama');
    }
    if (!transferForm.reason.trim()) {
      return toast.warning('Alasan transfer wajib diisi untuk audit pertanggungjawaban!');
    }

    const available = stocks[transferForm.from_site]?.[transferForm.item_id] || 0;
    if (Number(transferForm.qty) > available) {
      return toast.error(`Stok di ${transferForm.from_site} tidak mencukupi! (Tersedia: ${available} pcs)`);
    }

    showLoading();
    try {
      const qtyNum = Number(transferForm.qty);
      const newTransfer = {
        id: `TRF-${Date.now()}`,
        date: transferForm.date,
        item_id: transferForm.item_id,
        qty: qtyNum,
        from_site: transferForm.from_site,
        to_site: transferForm.to_site,
        reason: transferForm.reason,
        pic_name: user?.name || 'GA Admin',
        status: 'Selesai'
      };

      // Transfer stock calculation: deduct from source, add to destination
      setStocks(prev => {
        const updated = { ...prev };
        const sourceStock = { ...(updated[transferForm.from_site] || {}) };
        const destStock = { ...(updated[transferForm.to_site] || {}) };

        sourceStock[transferForm.item_id] = Math.max(0, (sourceStock[transferForm.item_id] || 0) - qtyNum);
        destStock[transferForm.item_id] = (destStock[transferForm.item_id] || 0) + qtyNum;

        updated[transferForm.from_site] = sourceStock;
        updated[transferForm.to_site] = destStock;
        return updated;
      });

      setTransfers(prev => [newTransfer, ...prev]);

      // Sync to PostgreSQL 16 in background
      savePgBhpTransfer({
        date: transferForm.date,
        itemCode: transferForm.item_id,
        qty: qtyNum,
        fromSite: transferForm.from_site,
        toSite: transferForm.to_site,
        reason: transferForm.reason,
        picName: user?.name || 'GA Admin'
      }).catch(err => console.warn('[PG-Sync] Transfer background sync:', err.message));

      toast.success(`Transfer ${qtyNum} pcs dari ${transferForm.from_site} ke ${transferForm.to_site} berhasil!`);
      setTransferForm({ ...transferForm, qty: '', reason: '' });
    } catch (e) {
      toast.error('Gagal memproses transfer');
    } finally {
      hideLoading();
    }
  };

  // --------------------------------------------------------------------------
  // FORM STATES: STOCK OPNAME & ADJUSTMENT (AWAL W3)
  // --------------------------------------------------------------------------
  const [opnameSite, setOpnameSite] = useState(selectedSite === 'ALL' ? 'LBCT' : selectedSite);
  const [opnameInputs, setOpnameInputs] = useState({});
  const [opnameReasons, setOpnameReasons] = useState({});

  const handleOpnamePhysicalChange = (itemId, val) => {
    setOpnameInputs(prev => ({ ...prev, [itemId]: val }));
  };

  const handleOpnameReasonChange = (itemId, val) => {
    setOpnameReasons(prev => ({ ...prev, [itemId]: val }));
  };

  const handleApplyOpname = () => {
    const modifiedItems = Object.keys(opnameInputs).filter(k => opnameInputs[k] !== '');
    if (modifiedItems.length === 0) {
      return toast.warning('Masukkan hasil hitung fisik pada minimal satu item');
    }

    // Check mandatory reasons for any discrepancies
    for (const itemId of modifiedItems) {
      const physical = Number(opnameInputs[itemId]);
      const system = stocks[opnameSite]?.[itemId] || 0;
      const diff = physical - system;
      if (diff !== 0 && (!opnameReasons[itemId] || !opnameReasons[itemId].trim())) {
        const it = items.find(x => x.id === itemId);
        return toast.error(`Alasan selisih wajib diisi untuk item: ${it?.name || itemId}!`);
      }
    }

    showLoading();
    try {
      const newOpnameRecords = [];
      const updatedSiteStock = { ...(stocks[opnameSite] || {}) };

      modifiedItems.forEach(itemId => {
        const physical = Number(opnameInputs[itemId]);
        const system = stocks[opnameSite]?.[itemId] || 0;
        const diff = physical - system;

        newOpnameRecords.push({
          id: `OPN-${Date.now()}-${itemId}`,
          date: new Date().toISOString().split('T')[0],
          site: opnameSite,
          cycle: '2026-09-W3',
          item_id: itemId,
          system_qty: system,
          physical_qty: physical,
          diff_qty: diff,
          reason: diff === 0 ? 'Sesuai fisik' : opnameReasons[itemId],
          pic_name: user?.name || 'PIC Opname'
        });

        // Set running stock to physical count
        updatedSiteStock[itemId] = physical;
      });

      setStocks(prev => ({ ...prev, [opnameSite]: updatedSiteStock }));
      setOpnames(prev => [...newOpnameRecords, ...prev]);

      // Sync to PostgreSQL 16 in background
      modifiedItems.forEach(itemId => {
        savePgBhpOpname({
          date: new Date().toISOString().split('T')[0],
          site: opnameSite,
          itemCode: itemId,
          systemQty: stocks[opnameSite]?.[itemId] || 0,
          physicalQty: Number(opnameInputs[itemId]),
          reason: opnameReasons[itemId] || 'Sesuai fisik',
          picName: user?.name || 'PIC Opname'
        }).catch(err => console.warn('[PG-Sync] Opname background sync:', err.message));
      });

      toast.success(`Opname berhasil disimpan! Stok berjalan di ${opnameSite} telah disesuaikan.`);
      setOpnameInputs({});
      setOpnameReasons({});
    } catch (e) {
      toast.error('Gagal menerapkan opname');
    } finally {
      hideLoading();
    }
  };

  // --------------------------------------------------------------------------
  // PDF EXPORT WITH SIGNATURE VALIDATION
  // --------------------------------------------------------------------------
  const openPdfModal = (type = 'forecast') => {
    setPdfModalType(type);
    setIsPdfModalOpen(true);
  };

  const handleExecutePdfDownload = () => {
    if (!signerAdminName.trim() || !signerGlName.trim()) {
      return toast.error('Nama GA Admin dan Nama GA GL WAJIB diisi sebelum dokumen PDF dapat diunduh!');
    }

    // Save names to local storage for automatic memory
    localStorage.setItem('bhp_signer_admin', signerAdminName.trim());
    localStorage.setItem('bhp_signer_gl', signerGlName.trim());

    setIsPdfModalOpen(false);

    const siteLabel = selectedSite === 'ALL' ? 'Konsolidasi (LBCT, IDMG, SPCT)' : `Site: ${selectedSite}`;
    const periodLabel = 'September 2026 (W3 Forecast & Horizon 28 Hari)';

    if (pdfModalType === 'forecast') {
      generateBhpForecastPdfReport({
        forecastData: forecastRecommendations,
        periodCycle: periodLabel,
        siteScope: siteLabel,
        createdByName: signerAdminName.trim(),
        approvedByName: signerGlName.trim()
      });

      // Record download audit log
      const newLog = {
        id: `PDF-${Date.now()}`,
        download_date: new Date().toLocaleString('id-ID'),
        recap_type: 'Rekomendasi Pemesanan BHP Mess (Forecast W3)',
        period_cycle: periodLabel,
        site: siteLabel,
        created_by_name: signerAdminName.trim(),
        approved_by_name: signerGlName.trim(),
        item_count: forecastRecommendations.length,
        total_qty: forecastRecommendations.reduce((s, r) => s + (r.recommended_qty_pcs || 0), 0)
      };
      setPdfHistory(prev => [newLog, ...prev]);

      // Sync to PostgreSQL 16 in background
      savePgBhpPdfHistory({
        docType: newLog.recap_type,
        period: newLog.period_cycle,
        siteCovered: newLog.site,
        createdBy: newLog.created_by_name,
        approvedBy: newLog.approved_by_name,
        notes: `Total items: ${newLog.item_count}, Total pcs: ${newLog.total_qty}`
      }).catch(err => console.warn('[PG-Sync] PDF history background sync:', err.message));

      toast.success('Dokumen PDF berhasil dibuka & dicatat dalam riwayat unduhan resmi!');
    } else {
      generateBhpEvaluationPdfReport({
        evaluationData: evaluations,
        periodCycle: 'Agustus 2026',
        siteScope: siteLabel,
        createdByName: signerAdminName.trim(),
        approvedByName: signerGlName.trim()
      });

      const newLog = {
        id: `PDF-${Date.now()}`,
        download_date: new Date().toLocaleString('id-ID'),
        recap_type: 'Evaluasi & Akurasi Forecast Siklus Lalu',
        period_cycle: 'Agustus 2026',
        site: siteLabel,
        created_by_name: signerAdminName.trim(),
        approved_by_name: signerGlName.trim(),
        item_count: evaluations.length,
        total_qty: evaluations.reduce((s, r) => s + (r.forecast_qty || 0), 0)
      };
      setPdfHistory(prev => [newLog, ...prev]);
      toast.success('Dokumen Evaluasi PDF berhasil dibuka & dicatat dalam riwayat unduhan!');
    }
  };

  return (
    <div className="w-full space-y-6 pb-16">
      {/* Top Header & Multi-Site Selector */}
      <div className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
              Siklus W1-W5 • BHP Mess
            </span>
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">
              Siklus Berjalan: <strong className="text-[var(--foreground)]">Awal W3 (Penutupan Data & Forecast)</strong>
            </span>
          </div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)]">
            Pencatatan, Forecast & Rekap BHP Mess
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] max-w-3xl">
            Sistem pengawasan stok barang habis pakai 3 site (LBCT, IDMG, SPCT) dengan kalkulasi Days of Cover (DoC), deteksi dini risiko habis sebelum W5, serta rekap resmi bertanda tangan sebagai lampiran PO manual.
          </p>
        </div>

        {/* Site Switcher & Export CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex bg-[var(--muted)] p-1 rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setSelectedSite('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedSite === 'ALL'
                  ? 'bg-[var(--card)] text-[var(--primary)] shadow-xs'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              🏢 Konsolidasi (3 Site)
            </button>
            {['LBCT', 'IDMG', 'SPCT'].map(st => (
              <button
                key={st}
                onClick={() => setSelectedSite(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedSite === st
                    ? 'bg-[var(--card)] text-[var(--primary)] shadow-xs'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* POSTGRESQL 16 CONNECTION BADGE */}
          <button
            onClick={() => setShowDbModal(true)}
            className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer ${
              dbInfo.status === 'online'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/20'
            }`}
            title="Klik untuk melihat Status & Konfigurasi PostgreSQL 16"
          >
            <Database className="w-4 h-4 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] leading-tight">Database</span>
              <span className="leading-tight font-extrabold">
                {dbInfo.status === 'online'
                  ? `PG-16: ${dbInfo.activeMode === 'transaction' ? 'Transaction Pooler' : dbInfo.activeMode}`
                  : 'Postgres 16: Siap'}
              </span>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dbInfo.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`} />
          </button>

          <button
            onClick={() => openPdfModal('forecast')}
            className="inline-flex items-center justify-center px-4 py-2 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0"
          >
            <FileDown className="w-4 h-4 mr-1.5" />
            Unduh Rekap PDF
          </button>
        </div>
      </div>

      {/* EARLY WARNING ALERT BANNER (W4 to W5 Safety Net) */}
      {criticalItemsList.length > 0 && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                Early Warning W4–W5: Terdeteksi {criticalItemsList.length} Item Berisiko Habis Sebelum Barang Tiba!
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-400 mt-0.5">
                Barang pesanan baru dijadwalkan tiba pada akhir W5. Beberapa item memiliki Days of Cover (DoC) &le; 5 hari di lokasi terkait. Segera pertimbangkan percepatan pemesanan atau lakukan transfer stok antar-site.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {criticalItemsList.slice(0, 4).map((c, i) => (
                  <span key={i} className="px-2 py-0.5 bg-amber-200/60 dark:bg-amber-950 text-amber-900 dark:text-amber-200 rounded text-[11px] font-semibold border border-amber-300">
                    {c.item.name} ({c.site} • DoC: {c.doc} hari)
                  </span>
                ))}
                {criticalItemsList.length > 4 && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 font-bold self-center">
                    +{criticalItemsList.length - 4} item lainnya
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('transfer')}
            className="inline-flex items-center px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 self-end md:self-center"
          >
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            Transfer Antar Site
          </button>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex items-center space-x-1.5 overflow-x-auto border-b border-[var(--border)] pb-2 scrollbar-none text-xs font-bold">
        {[
          { id: 'dashboard', label: 'Dashboard & Monitoring', icon: BarChart3 },
          { id: 'usage', label: 'Input Pemakaian Harian', icon: Plus },
          { id: 'stock_in', label: 'Penerimaan Barang (W5)', icon: Truck },
          { id: 'transfer', label: 'Transfer Antar Site', icon: ArrowRightLeft },
          { id: 'opname', label: 'Stock Opname (Awal W3)', icon: ClipboardCheck },
          { id: 'forecast', label: 'Forecast & Rekomendasi Qty', icon: TrendingUp },
          { id: 'evaluation', label: 'Evaluasi & Akurasi', icon: Sliders },
          { id: 'master', label: 'Master Item BHP', icon: Package }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              <Icon className="w-4 h-4 mr-1.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: DASHBOARD & MONITORING                                        */}
      {/* ==================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* KPI METRIC CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] shadow-xs flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/30 text-sky-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Total SKU BHP</p>
                <p className="text-lg font-bold text-[var(--foreground)]">{items.length} Item</p>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  {selectedSite === 'ALL' ? 'Katalog Global' : `Tersedia di ${selectedSite}`}
                </p>
              </div>
            </div>

            <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] shadow-xs flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Rata-rata Days of Cover</p>
                <p className="text-lg font-mono font-bold text-emerald-600">
                  {Math.round(
                    items.reduce((s, it) => {
                      const d = selectedSite === 'ALL'
                        ? (itemMetrics[it.id]?.totalStock / Math.max(itemMetrics[it.id]?.totalDailyAvg, 0.1))
                        : (itemMetrics[it.id]?.perSite[selectedSite]?.doc || 0);
                      return s + d;
                    }, 0) / Math.max(items.length, 1)
                  )} Hari
                </p>
                <p className="text-[10px] text-[var(--muted-foreground)]">Ketahanan Stok Saat Ini</p>
              </div>
            </div>

            <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] shadow-xs flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Item Kritis / Menipis</p>
                <p className="text-lg font-bold text-amber-600">
                  {criticalItemsList.length} Item
                </p>
                <p className="text-[10px] text-[var(--muted-foreground)]">Risiko Habis &le; 5 Hari</p>
              </div>
            </div>

            <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] shadow-xs flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-[var(--muted-foreground)]">Rekomendasi Pemesanan</p>
                <p className="text-lg font-mono font-bold text-purple-600">
                  {forecastRecommendations.reduce((s, r) => s + (r.recommended_packs || 0), 0)} Pack
                </p>
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  {forecastRecommendations.reduce((s, r) => s + (r.recommended_qty_pcs || 0), 0).toLocaleString('id-ID')} Pcs Total
                </p>
              </div>
            </div>
          </div>

          {/* RUNNING STOCK TABLE WITH DAYS OF COVER */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--background)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-[var(--foreground)] text-sm">Status Stok Berjalan & Days of Cover (DoC)</h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {selectedSite === 'ALL' ? 'Konsolidasi 3 Site' : `Data Spesifik ${selectedSite}`} • Stok dihitung otomatis dari mutasi transaksi
                </p>
              </div>
              <div className="flex items-center space-x-2 text-[11px]">
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1"></span> Aman (&gt;14h)</span>
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1"></span> Menipis (6-14h)</span>
                <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1"></span> Kritis (&le;5h)</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3 px-4">Item BHP</th>
                    <th className="py-3 px-3">Kategori</th>
                    <th className="py-3 px-2 text-center">Kelas</th>
                    <th className="py-3 px-3 text-center">Isi/Pack</th>
                    <th className="py-3 px-3 text-right">Stok Berjalan</th>
                    <th className="py-3 px-3 text-right">Avg Pakai/Hari</th>
                    <th className="py-3 px-3 text-center">Days of Cover (DoC)</th>
                    <th className="py-3 px-3 text-center">Status Ketersediaan</th>
                    <th className="py-3 px-4 text-center">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-[var(--border)]">
                  {items.map(it => {
                    const m = selectedSite === 'ALL'
                      ? {
                          currentStock: itemMetrics[it.id]?.totalStock,
                          dailyAvg: itemMetrics[it.id]?.totalDailyAvg,
                          doc: Math.round(itemMetrics[it.id]?.totalStock / Math.max(itemMetrics[it.id]?.totalDailyAvg, 0.1)),
                          abcClass: it.default_abc
                        }
                      : itemMetrics[it.id]?.perSite[selectedSite] || {};

                    const doc = m.doc || 0;
                    const isCrit = doc <= 5;
                    const isWarn = doc > 5 && doc <= 14;

                    return (
                      <tr key={it.id} className="hover:bg-[var(--muted)]/20 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-bold text-[var(--foreground)]">{it.name}</p>
                          <p className="text-[10px] text-[var(--muted-foreground)] font-mono">{it.code}</p>
                        </td>
                        <td className="py-3 px-3 text-[var(--muted-foreground)]">{it.category}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.abcClass === 'A' ? 'bg-red-50 text-red-700 border border-red-200' :
                            m.abcClass === 'C' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                            'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            Kelas {m.abcClass}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{it.pack_qty} {it.unit}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[var(--foreground)]">
                          {m.currentStock} {it.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[var(--muted-foreground)]">
                          {Number(m.dailyAvg || 0).toFixed(1)} /hr
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span className={`px-2 py-1 rounded-lg ${
                            isCrit ? 'bg-red-100 text-red-700 dark:bg-red-950/40' :
                            isWarn ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40' :
                            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40'
                          }`}>
                            {doc} Hari
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isCrit ? 'bg-red-50 text-red-700 border border-red-200' :
                            isWarn ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isCrit ? '⚠️ Kritis (W5)' : isWarn ? 'Menipis' : 'Aman'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setTransferForm(prev => ({
                                ...prev,
                                item_id: it.id,
                                from_site: selectedSite === 'SPCT' ? 'LBCT' : 'IDMG',
                                to_site: selectedSite === 'ALL' ? 'SPCT' : selectedSite
                              }));
                              setActiveTab('transfer');
                            }}
                            className="p-1.5 hover:bg-[var(--muted)] rounded-lg text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"
                            title="Transfer Item Ini"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* CROSS-SITE CONSUMPTION COMPARISON */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-[var(--foreground)] text-sm">Perbandingan Konsumsi Antar Site</h4>
                <span className="text-[11px] text-[var(--muted-foreground)]">Rata-rata Pemakaian Harian</span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Digunakan oleh GA untuk mengidentifikasi perbedaan pola pemakaian yang janggal antar site dengan karakteristik serupa.
              </p>

              <div className="space-y-3 pt-2">
                {items.slice(0, 5).map(it => {
                  const lbctAvg = itemMetrics[it.id]?.perSite['LBCT']?.dailyAvg || 1;
                  const idmgAvg = itemMetrics[it.id]?.perSite['IDMG']?.dailyAvg || 1;
                  const spctAvg = itemMetrics[it.id]?.perSite['SPCT']?.dailyAvg || 1;
                  const maxVal = Math.max(lbctAvg, idmgAvg, spctAvg, 1);

                  return (
                    <div key={it.id} className="p-3 bg-[var(--muted)]/20 rounded-xl border border-[var(--border)]/50 space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-[var(--foreground)]">{it.name}</span>
                        <span className="text-[var(--muted-foreground)] font-mono">{it.unit}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                        <div>
                          <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                            <span>LBCT</span>
                            <span className="font-mono font-bold text-sky-600">{lbctAvg.toFixed(1)}/hr</span>
                          </div>
                          <div className="w-full bg-[var(--muted)] h-1.5 rounded-full overflow-hidden mt-1">
                            <div className="bg-sky-500 h-full rounded-full" style={{ width: `${(lbctAvg / maxVal) * 100}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                            <span>IDMG</span>
                            <span className="font-mono font-bold text-teal-600">{idmgAvg.toFixed(1)}/hr</span>
                          </div>
                          <div className="w-full bg-[var(--muted)] h-1.5 rounded-full overflow-hidden mt-1">
                            <div className="bg-teal-500 h-full rounded-full" style={{ width: `${(idmgAvg / maxVal) * 100}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
                            <span>SPCT</span>
                            <span className="font-mono font-bold text-purple-600">{spctAvg.toFixed(1)}/hr</span>
                          </div>
                          <div className="w-full bg-[var(--muted)] h-1.5 rounded-full overflow-hidden mt-1">
                            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${(spctAvg / maxVal) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ANOMALY DETECTION LIST */}
            <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-[var(--foreground)] text-sm">Daftar Deteksi Anomali Pemakaian</h4>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                  &gt; 3x Rata-rata
                </span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Input harian yang melonjak drastis ditandai untuk dicek ulang oleh GA guna mencegah pemborosan atau salah catat, bukan otomatis ditolak.
              </p>

              <div className="space-y-2.5 pt-2">
                {usages.filter(u => u.is_anomaly).map(u => {
                  const it = items.find(x => x.id === u.item_id);
                  return (
                    <div key={u.id} className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-[var(--foreground)]">{it?.name}</span>
                          <span className="px-1.5 py-0.2 bg-amber-200 text-amber-800 rounded text-[10px] font-bold">
                            {u.site}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)]">
                          Tercatat: <strong className="text-amber-700 font-mono font-bold">{u.qty} {it?.unit}</strong> pada {u.date} oleh {u.pic_name}
                        </p>
                        <p className="text-[10px] text-amber-900/80 dark:text-amber-300 italic">
                          Alasan: {u.notes}
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-white dark:bg-zinc-900 text-amber-600 rounded-lg text-[10px] font-bold border border-amber-200 shrink-0">
                        Verifikasi GA
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: INPUT PEMAKAIAN HARIAN (BULK ENTRY)                          */}
      {/* ==================================================================== */}
      {activeTab === 'usage' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-5">
            <div>
              <h3 className="font-bold text-[var(--foreground)] text-base">Pencatatan Pemakaian Harian (W1–W2)</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                PIC Lapangan dapat menginput banyak item sekaligus dalam satu sesi. Tanggal otomatis terisi hari ini dan jumlah pakai dalam satuan pcs.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Site Mess Tugas *</label>
                <CustomSelect
                  value={bulkSite}
                  onChange={(val) => setBulkSite(val)}
                  options={[
                    { label: 'Site LBCT', value: 'LBCT' },
                    { label: 'Site IDMG', value: 'IDMG' },
                    { label: 'Site SPCT', value: 'SPCT' }
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Tanggal Pemakaian *</label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
            </div>

            {/* Dynamic Rows */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-[var(--foreground)]">Daftar Item yang Dikeluarkan:</label>
              {bulkRows.map((row, idx) => {
                const itemObj = items.find(it => it.id === row.item_id);
                const dailyAvg = itemMetrics[row.item_id]?.perSite[bulkSite]?.dailyAvg || 2;
                const isAnomaly = Number(row.qty) > 3 * dailyAvg && Number(row.qty) > 0;

                return (
                  <div key={idx} className="p-3 bg-[var(--muted)]/30 rounded-xl border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex-1 w-full sm:w-auto">
                      <select
                        value={row.item_id}
                        onChange={(e) => handleBulkRowChange(idx, 'item_id', e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs font-semibold text-[var(--foreground)] outline-none"
                      >
                        {items.map(it => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.unit}) • Stok: {stocks[bulkSite]?.[it.id] || 0}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-full sm:w-32">
                      <input
                        type="number"
                        placeholder={`Qty (${itemObj?.unit || 'pcs'})`}
                        value={row.qty}
                        min="1"
                        onChange={(e) => handleBulkRowChange(idx, 'qty', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg bg-[var(--background)] text-xs font-mono font-bold text-[var(--foreground)] outline-none ${
                          isAnomaly ? 'border-amber-500 ring-1 ring-amber-400' : 'border-[var(--border)]'
                        }`}
                      />
                    </div>

                    <div className="flex-1 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Keterangan distribusi (contoh: Kamar blok A / laundry)"
                        value={row.notes}
                        onChange={(e) => handleBulkRowChange(idx, 'notes', e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs text-[var(--foreground)] outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveBulkRow(idx)}
                      disabled={bulkRows.length <= 1}
                      className="p-2 text-ruby-500 hover:bg-ruby-50 dark:hover:bg-ruby-950/30 rounded-lg transition-colors disabled:opacity-30"
                      title="Hapus Baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {isAnomaly && (
                      <span className="w-full sm:w-auto text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                        ⚠️ &gt;3x Rata-rata ({dailyAvg.toFixed(1)}/hr)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleAddBulkRow}
                className="inline-flex items-center px-3 py-2 bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] rounded-xl text-xs font-semibold transition-colors"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Tambah Baris Item
              </button>

              <button
                type="button"
                onClick={handleSaveBulkUsage}
                className="inline-flex items-center px-5 py-2 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <Save className="w-4 h-4 mr-1.5" />
                Simpan Pemakaian
              </button>
            </div>
          </div>

          {/* RIWAYAT PEMAKAIAN HARIAN */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
              <h4 className="font-bold text-[var(--foreground)] text-sm">Riwayat Pemakaian Harian Tercatat</h4>
              <span className="text-xs text-[var(--muted-foreground)] font-mono">{usages.length} Transaksi</span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Tanggal</th>
                    <th className="py-2.5 px-3">Site</th>
                    <th className="py-2.5 px-4">Item BHP</th>
                    <th className="py-2.5 px-3 text-right">Jumlah Pakai</th>
                    <th className="py-2.5 px-3">PIC Penginput</th>
                    <th className="py-2.5 px-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-[var(--border)]">
                  {usages.map(u => {
                    const it = items.find(x => x.id === u.item_id);
                    return (
                      <tr key={u.id} className="hover:bg-[var(--muted)]/20">
                        <td className="py-2.5 px-4 font-mono text-[var(--muted-foreground)]">{u.date}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded font-bold text-[10px]">
                            {u.site}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-[var(--foreground)]">{it?.name || u.item_id}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--foreground)]">
                          {u.qty} {it?.unit}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--muted-foreground)]">{u.pic_name}</td>
                        <td className="py-2.5 px-4 text-[var(--muted-foreground)]">
                          {u.notes}
                          {u.is_anomaly && <span className="ml-2 text-amber-600 font-bold">⚠️ Flag Anomali</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: PENERIMAAN BARANG (STOK MASUK W5)                             */}
      {/* ==================================================================== */}
      {activeTab === 'stock_in' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-5 bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-[var(--foreground)] text-base">Penerimaan Barang Datang (W5)</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Catat barang yang tiba di site menjelang akhir bulan. Cantumkan nomor referensi manual pemesanan luar sistem sebagai keterangan bebas.
              </p>
            </div>

            <form onSubmit={handleSaveStockIn} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Site Penerima *</label>
                  <CustomSelect
                    value={stockInForm.site}
                    onChange={(val) => setStockInForm({ ...stockInForm, site: val })}
                    options={[
                      { label: 'Site LBCT', value: 'LBCT' },
                      { label: 'Site IDMG', value: 'IDMG' },
                      { label: 'Site SPCT', value: 'SPCT' }
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Tanggal Terima *</label>
                  <input
                    type="date"
                    required
                    value={stockInForm.date}
                    onChange={(e) => setStockInForm({ ...stockInForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs text-[var(--foreground)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Pilih Item BHP *</label>
                <select
                  value={stockInForm.item_id}
                  onChange={(e) => setStockInForm({ ...stockInForm, item_id: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs font-semibold text-[var(--foreground)] outline-none"
                >
                  {items.map(it => (
                    <option key={it.id} value={it.id}>
                      {it.name} (Isi {it.pack_qty} {it.unit}/{it.pack_unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Qty Diterima (Pcs) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Contoh: 60"
                    value={stockInForm.qty_pcs}
                    onChange={(e) => setStockInForm({ ...stockInForm, qty_pcs: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs font-mono font-bold text-[var(--foreground)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Status Kedatangan</label>
                  <select
                    value={stockInForm.condition_status}
                    onChange={(e) => setStockInForm({ ...stockInForm, condition_status: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs text-[var(--foreground)] outline-none"
                  >
                    <option value="Lengkap">Lengkap Sesuai Pesanan</option>
                    <option value="Sebagian">Sebagian (Ada Kekurangan)</option>
                    <option value="Belum Datang">Belum Datang</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">No. Referensi Pemesanan Luar (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: PO-MANUAL/GA/2026/09/145"
                  value={stockInForm.ref_no}
                  onChange={(e) => setStockInForm({ ...stockInForm, ref_no: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs text-[var(--foreground)] outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Keterangan / Kondisi Berkas</label>
                <textarea
                  rows="2"
                  placeholder="Catatan kondisi fisik kardus atau surat jalan"
                  value={stockInForm.notes}
                  onChange={(e) => setStockInForm({ ...stockInForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs text-[var(--foreground)] outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center"
              >
                <Truck className="w-4 h-4 mr-1.5" />
                Simpan & Tambah Stok
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
              <h4 className="font-bold text-[var(--foreground)] text-sm">Riwayat Barang Masuk Site</h4>
              <span className="text-xs text-[var(--muted-foreground)] font-mono">{stockIns.length} Riwayat</span>
            </div>
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-2">Site</th>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3">No. Ref</th>
                    <th className="py-2.5 px-3 text-center">Kondisi</th>
                    <th className="py-2.5 px-3">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-[var(--border)]">
                  {stockIns.map(r => {
                    const it = items.find(x => x.id === r.item_id);
                    return (
                      <tr key={r.id} className="hover:bg-[var(--muted)]/20">
                        <td className="py-2.5 px-3 font-mono text-[var(--muted-foreground)]">{r.date}</td>
                        <td className="py-2.5 px-2 font-bold text-[var(--primary)]">{r.site}</td>
                        <td className="py-2.5 px-3 font-bold text-[var(--foreground)]">{it?.name || r.item_id}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">+{r.qty} {it?.unit}</td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-[var(--muted-foreground)]">{r.ref_no || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.condition_status === 'Lengkap' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {r.condition_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[var(--muted-foreground)] text-[11px]">{r.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: TRANSFER STOK ANTAR SITE                                      */}
      {/* ==================================================================== */}
      {activeTab === 'transfer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          <div className="lg:col-span-5 bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-[var(--foreground)] text-base">Transfer Stok Darurat Antar Site</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Pengalihan stok darurat jika ada site yang kehabisan stok menjelang W5. Mutasi otomatis mengurangi stok asal dan menambah stok tujuan tanpa merusak angka pemakaian riil.
              </p>
            </div>

            <form onSubmit={handleSaveTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Pilih Item BHP *</label>
                <select
                  value={transferForm.item_id}
                  onChange={(e) => setTransferForm({ ...transferForm, item_id: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs font-semibold text-[var(--foreground)] outline-none"
                >
                  {items.map(it => (
                    <option key={it.id} value={it.id}>
                      {it.name} (LBCT: {stocks['LBCT']?.[it.id] || 0} | IDMG: {stocks['IDMG']?.[it.id] || 0} | SPCT: {stocks['SPCT']?.[it.id] || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Site Asal (Sumber) *</label>
                  <CustomSelect
                    value={transferForm.from_site}
                    onChange={(val) => setTransferForm({ ...transferForm, from_site: val })}
                    options={[
                      { label: `Site IDMG (Stok: ${stocks['IDMG']?.[transferForm.item_id] || 0})`, value: 'IDMG' },
                      { label: `Site LBCT (Stok: ${stocks['LBCT']?.[transferForm.item_id] || 0})`, value: 'LBCT' },
                      { label: `Site SPCT (Stok: ${stocks['SPCT']?.[transferForm.item_id] || 0})`, value: 'SPCT' }
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Site Tujuan *</label>
                  <CustomSelect
                    value={transferForm.to_site}
                    onChange={(val) => setTransferForm({ ...transferForm, to_site: val })}
                    options={[
                      { label: 'Site SPCT', value: 'SPCT' },
                      { label: 'Site LBCT', value: 'LBCT' },
                      { label: 'Site IDMG', value: 'IDMG' }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Jumlah Transfer (Pcs) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Contoh: 12"
                    value={transferForm.qty}
                    onChange={(e) => setTransferForm({ ...transferForm, qty: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs font-mono font-bold text-[var(--foreground)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Tanggal Transfer *</label>
                  <input
                    type="date"
                    required
                    value={transferForm.date}
                    onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs text-[var(--foreground)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--foreground)] mb-1">Alasan Transfer (Wajib Audit) *</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Contoh: Kebutuhan darurat di SPCT karena DoC kritis menjelang W5, diambil dari surplus IDMG"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs text-[var(--foreground)] outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center"
              >
                <ArrowRightLeft className="w-4 h-4 mr-1.5" />
                Proses Transfer Antar Site
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
              <h4 className="font-bold text-[var(--foreground)] text-sm">Riwayat Transfer Antar Site</h4>
              <span className="text-xs text-[var(--muted-foreground)] font-mono">{transfers.length} Mutasi</span>
            </div>
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3 text-center">Mutasi Site</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-4">Alasan Transfer</th>
                    <th className="py-2.5 px-3">PIC</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-[var(--border)]">
                  {transfers.map(t => {
                    const it = items.find(x => x.id === t.item_id);
                    return (
                      <tr key={t.id} className="hover:bg-[var(--muted)]/20">
                        <td className="py-2.5 px-3 font-mono text-[var(--muted-foreground)]">{t.date}</td>
                        <td className="py-2.5 px-3 font-bold text-[var(--foreground)]">{it?.name || t.item_id}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold text-amber-700">{t.from_site}</span>
                          <span className="mx-1 text-[var(--muted-foreground)]">&rarr;</span>
                          <span className="font-bold text-emerald-700">{t.to_site}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--foreground)]">{t.qty} {it?.unit}</td>
                        <td className="py-2.5 px-4 text-[var(--muted-foreground)] text-[11px] max-w-xs">{t.reason}</td>
                        <td className="py-2.5 px-3 text-[var(--muted-foreground)]">{t.pic_name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: STOCK OPNAME (AWAL W3)                                        */}
      {/* ==================================================================== */}
      {activeTab === 'opname' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-[var(--foreground)] text-base">Pelaksanaan Stock Opname (Awal W3)</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Wajib dilakukan sebelum forecast dijalankan. Item kelas A diopname 2 mingguan, kelas C bulanan. Selisih wajib disertai alasan (rusak, hilang, kadaluarsa, salah catat).
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-[var(--foreground)]">Site Opname:</span>
                <select
                  value={opnameSite}
                  onChange={(e) => setOpnameSite(e.target.value)}
                  className="px-3 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs font-bold text-[var(--primary)] outline-none"
                >
                  <option value="LBCT">Site LBCT</option>
                  <option value="IDMG">Site IDMG</option>
                  <option value="SPCT">Site SPCT</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="py-2.5 px-3">Kode & Item</th>
                    <th className="py-2.5 px-2 text-center">Kelas</th>
                    <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                    <th className="py-2.5 px-4 text-center" style={{ width: '130px' }}>Hasil Hitung Fisik</th>
                    <th className="py-2.5 px-3 text-right">Selisih Fisik</th>
                    <th className="py-2.5 px-4">Alasan Selisih (Wajib jika ada selisih)</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-[var(--border)]">
                  {items.map(it => {
                    const systemQty = stocks[opnameSite]?.[it.id] || 0;
                    const physicalInput = opnameInputs[it.id];
                    const hasInput = physicalInput !== undefined && physicalInput !== '';
                    const physicalVal = hasInput ? Number(physicalInput) : systemQty;
                    const diff = physicalVal - systemQty;

                    return (
                      <tr key={it.id} className="hover:bg-[var(--muted)]/20">
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-[var(--foreground)]">{it.name}</p>
                          <p className="text-[10px] text-[var(--muted-foreground)] font-mono">{it.code}</p>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            it.default_abc === 'A' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'
                          }`}>
                            {it.default_abc}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--foreground)]">
                          {systemQty} {it.unit}
                        </td>
                        <td className="py-2 px-4 text-center">
                          <input
                            type="number"
                            placeholder={`${systemQty}`}
                            value={physicalInput !== undefined ? physicalInput : ''}
                            onChange={(e) => handleOpnamePhysicalChange(it.id, e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs font-mono font-bold text-center outline-none focus:ring-1 focus:ring-[var(--ring)]"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {hasInput ? (
                            <span className={diff === 0 ? 'text-emerald-600' : diff < 0 ? 'text-ruby-600' : 'text-sky-600'}>
                              {diff > 0 ? `+${diff}` : diff} {it.unit}
                            </span>
                          ) : (
                            <span className="text-[var(--muted-foreground)]">-</span>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            placeholder={diff !== 0 && hasInput ? 'Wajib isi alasan: rusak, hilang, kadaluarsa...' : 'Catatan'}
                            value={opnameReasons[it.id] || ''}
                            onChange={(e) => handleOpnameReasonChange(it.id, e.target.value)}
                            className={`w-full px-2.5 py-1.5 border rounded-lg bg-[var(--background)] text-xs outline-none ${
                              diff !== 0 && hasInput && !opnameReasons[it.id]
                                ? 'border-ruby-500 bg-ruby-50/20'
                                : 'border-[var(--border)]'
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleApplyOpname}
                className="inline-flex items-center px-5 py-2.5 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <ClipboardCheck className="w-4 h-4 mr-1.5" />
                Terapkan Hasil Opname & Sesuaikan Stok
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: FORECAST & REKOMENDASI PEMESANAN                              */}
      {/* ==================================================================== */}
      {activeTab === 'forecast' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-[var(--foreground)] text-base">Rekomendasi Pemesanan BHP Mess (Forecast W3)</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--primary)]/10 text-[var(--primary)]">
                    Horizon 28 Hari
                  </span>
                </div>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Kalkulasi matematis transparan: (Rata-rata &times; 28 hari) + Safety Stock ({selectedSite === 'ALL' ? '5-10%' : 'Spesifik'}) &minus; Proyeksi Stok Sisa = Rekomendasi Pack (dibulatkan ke atas).
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <button
                  onClick={() => openPdfModal('forecast')}
                  className="inline-flex items-center px-4 py-2 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  <FileDown className="w-4 h-4 mr-1.5" />
                  Unduh Rekap PDF Resmi (2 Tanda Tangan)
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--muted)]/60 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3 px-3">No</th>
                    <th className="py-3 px-3">Kode & Nama Item</th>
                    <th className="py-3 px-2 text-center">ABC</th>
                    <th className="py-3 px-3 text-center">Isi/Pack</th>
                    <th className="py-3 px-3 text-right">Avg Pakai/Hari</th>
                    <th className="py-3 px-3 text-right">Horizon Demand (28h)</th>
                    <th className="py-3 px-3 text-right">Safety Stock</th>
                    <th className="py-3 px-3 text-right">Proyeksi Sisa</th>
                    <th className="py-3 px-3 text-right bg-emerald-500/10 font-bold text-emerald-700">Rekomendasi (Pcs)</th>
                    <th className="py-3 px-3 text-right bg-teal-500/10 font-bold text-[var(--primary)]">Rekomendasi (Pack)</th>
                    <th className="py-3 px-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-[var(--border)]">
                  {forecastRecommendations.map((r, idx) => (
                    <tr key={r.item_id} className="hover:bg-[var(--muted)]/20">
                      <td className="py-2.5 px-3 font-mono text-[var(--muted-foreground)]">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-[var(--foreground)]">{r.name}</p>
                        <p className="text-[10px] text-[var(--muted-foreground)] font-mono">{r.code}</p>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          r.abc_class === 'A' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'
                        }`}>
                          {r.abc_class}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">{r.pack_qty} {r.unit}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{r.avg_daily_usage.toFixed(1)}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{Math.round(r.period_demand)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600">+{Math.round(r.safety_stock)} ({r.safety_pct}%)</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--muted-foreground)]">{Math.round(r.projected_stock)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40">
                        {r.recommended_qty_pcs} {r.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[var(--primary)] bg-teal-50/40">
                        {r.recommended_packs} {r.pack_unit}
                      </td>
                      <td className="py-2.5 px-4 text-[11px]">
                        {r.variance_flag ? (
                          <span className="text-red-600 font-bold flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" /> Variasi tinggi
                          </span>
                        ) : (
                          <span className="text-[var(--muted-foreground)]">{r.notes}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 7: EVALUASI & AKURASI FORECAST                                   */}
      {/* ==================================================================== */}
      {activeTab === 'evaluation' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-[var(--foreground)] text-base">Evaluasi Akurasi Forecast Siklus Lalu (Agustus 2026)</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Membandingkan qty rekomendasi forecast dengan pemakaian riil actual di W1-W2 bulan berjalan untuk menghitung tingkat error dan mengoreksi kecenderungan bias.
                </p>
              </div>

              <button
                onClick={() => openPdfModal('evaluation')}
                className="inline-flex items-center px-4 py-2 bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <FileDown className="w-4 h-4 mr-1.5" />
                Unduh Evaluasi PDF
              </button>
            </div>

            <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--muted)]/60 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-2 text-center">Site</th>
                    <th className="py-2.5 px-3 text-right">Forecast (Pcs)</th>
                    <th className="py-2.5 px-3 text-right">Actual (Pcs)</th>
                    <th className="py-2.5 px-3 text-right">Selisih</th>
                    <th className="py-2.5 px-3 text-right">Error %</th>
                    <th className="py-2.5 px-3">Kecenderungan Bias</th>
                    <th className="py-2.5 px-4">Catatan Evaluasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-[var(--border)]">
                  {evaluations.map((e, idx) => {
                    const it = items.find(x => x.id === e.item_id);
                    return (
                      <tr key={e.id} className="hover:bg-[var(--muted)]/20">
                        <td className="py-2.5 px-3 font-mono text-[var(--muted-foreground)]">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-[var(--foreground)]">{it?.name || e.item_id}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-sky-700">{e.site}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{e.forecast_qty}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">{e.actual_qty}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          <span className={e.diff_qty > 0 ? 'text-red-600' : 'text-emerald-600'}>
                            {e.diff_qty > 0 ? `+${e.diff_qty}` : e.diff_qty}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">{e.diff_pct.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{e.bias}</td>
                        <td className="py-2.5 px-4 text-[var(--muted-foreground)]">{e.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 8: MASTER ITEM BHP & PARAMETER SITE                              */}
      {/* ==================================================================== */}
      {activeTab === 'master' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[var(--foreground)] text-base">Katalog Master Item BHP Global</h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Daftar item global seragam untuk seluruh site. Kode, satuan, dan isi per pack dikunci secara global agar konsisten.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--muted)]/60 text-[var(--muted-foreground)] font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="py-2.5 px-3">Kode</th>
                    <th className="py-2.5 px-4">Nama Barang Habis Pakai</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-2 text-center">Satuan</th>
                    <th className="py-2.5 px-3 text-center">Isi/Pack</th>
                    <th className="py-2.5 px-2 text-center">ABC</th>
                    <th className="py-2.5 px-3 text-right">Default Safety</th>
                    <th className="py-2.5 px-3 text-right">Est. Harga Satuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-[var(--border)]">
                  {items.map(it => (
                    <tr key={it.id} className="hover:bg-[var(--muted)]/20">
                      <td className="py-2.5 px-3 font-mono font-bold text-[var(--foreground)]">{it.code}</td>
                      <td className="py-2.5 px-4 font-bold text-[var(--foreground)]">{it.name}</td>
                      <td className="py-2.5 px-3 text-[var(--muted-foreground)]">{it.category}</td>
                      <td className="py-2.5 px-2 text-center font-mono">{it.unit}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">{it.pack_qty} {it.unit}/{it.pack_unit}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          it.default_abc === 'A' ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700'
                        }`}>
                          {it.default_abc}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">{it.default_safety_pct}%</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--muted-foreground)]">
                        {formatRupiah(it.price_est)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL VALIDASI TANDA TANGAN SEBELUM DOWNLOAD PDF (GA ADMIN & GA GL)  */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isPdfModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsPdfModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--card)] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[var(--border)]"
            >
              <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--background)]">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--foreground)] text-sm">Pengesahan Dokumen Rekap PDF</h3>
                    <p className="text-[11px] text-[var(--muted-foreground)]">Wajib cantumkan nama pembuat & penyetuju resmi</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-3.5 bg-[var(--muted)]/40 rounded-xl border border-[var(--border)] text-xs text-[var(--muted-foreground)] space-y-1">
                  <p className="font-bold text-[var(--foreground)]">Ketentuan Pencetakan PDF Dokumen Resmi:</p>
                  <p>
                    Sesuai prosedur operasional, dokumen rekap kebutuhan BHP Mess memerlukan pengesahan 2 pihak: <strong>GA Admin ("Dibuat Oleh")</strong> dan <strong>GA GL ("Disetujui Oleh")</strong> sebagai lampiran pembuatan PO di luar sistem.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                      Nama GA Admin (Kolom "Dibuat Oleh") *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama lengkap GA Admin"
                      value={signerAdminName}
                      onChange={(e) => setSignerAdminName(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs font-bold text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                    <span className="text-[10px] text-[var(--muted-foreground)]">Bertindak sebagai penyusun kalkulasi forecast.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[var(--foreground)] mb-1">
                      Nama GA Group Leader (Kolom "Disetujui Oleh") *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama lengkap GA GL"
                      value={signerGlName}
                      onChange={(e) => setSignerGlName(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-xs font-bold text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    />
                    <span className="text-[10px] text-[var(--muted-foreground)]">Bertindak sebagai pihak penyetuju rekap rekomendasi.</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleExecutePdfDownload}
                  className="inline-flex items-center px-5 py-2 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  <FileDown className="w-4 h-4 mr-1.5" />
                  Cetak & Unduh Dokumen PDF
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* MODAL: POSTGRESQL 16 STATUS & POOLER CONFIGURATION                   */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {showDbModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--card)] w-full max-w-xl rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-[var(--border)] bg-[var(--muted)]/30 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--foreground)]">
                      PostgreSQL 16 Multi-Mode Connection
                    </h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Konfigurasi Arsitektur Database GA Core (Shared 5GB)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDbModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Status Card */}
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold text-[var(--muted-foreground)]">Status Engine</span>
                    <div className="flex items-center space-x-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${dbInfo.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      <span className="text-sm font-bold text-[var(--foreground)]">
                        {dbInfo.status === 'online' ? 'Terhubung (Online)' : 'Siap Menghubungkan (Offline/Local)'}
                      </span>
                    </div>
                    {dbInfo.pingMs && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Latency Ping: {dbInfo.pingMs} ms • Port: {dbInfo.port || 6543}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={refreshDbStatus}
                    disabled={isTestingDb}
                    className="px-3.5 py-1.5 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isTestingDb ? 'animate-spin' : ''}`} />
                    <span>{isTestingDb ? 'Menguji...' : 'Uji Koneksi'}</span>
                  </button>
                </div>

                {/* Pooler Modes Comparison */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Analisis 3 Opsi Mode Koneksi:
                  </h4>

                  {/* 1. Transaction Pooler */}
                  <div className="p-3.5 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 bg-emerald-500 text-white rounded text-[10px] font-black uppercase">
                          ⭐ PALING BAGUS
                        </span>
                        <strong className="text-xs text-[var(--foreground)]">Transaction Pooler (Port 6543 / PgBouncer)</strong>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Direkomendasikan</span>
                    </div>
                    <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                      Koneksi hanya dipakai selama query transaksi dieksekusi lalu langsung dilepas. <strong>Sangat wajib untuk shared 5GB</strong> agar database tidak tumbang jika banyak PIC/GA membuka website secara bersamaan.
                    </p>
                  </div>

                  {/* 2. Session Pooler */}
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-[var(--foreground)]">Session Pooler (Port 5432 / Mode Session)</strong>
                      <span className="text-[10px] text-[var(--muted-foreground)] font-semibold">Background Worker</span>
                    </div>
                    <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                      Satu koneksi dialokasikan penuh selama sesi aktif. Cocok untuk aplikasi desktop atau daemon yang butuh prepared statement, namun boros koneksi untuk web.
                    </p>
                  </div>

                  {/* 3. Direct Session */}
                  <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-xs text-[var(--foreground)]">Direct Session (Port 5432 Direct Engine)</strong>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Khusus Migrasi DDL</span>
                    </div>
                    <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                      Koneksi langsung tanpa proxy pooler. Memiliki akses penuh DDL untuk menjalankan skrip pembuatan tabel (<code>npm run db:migrate</code>) atau dari DBeaver/pgAdmin.
                    </p>
                  </div>
                </div>

                {/* Configuration Help */}
                <div className="p-3.5 rounded-xl bg-[var(--muted)]/40 border border-[var(--border)] text-xs text-[var(--muted-foreground)] space-y-2">
                  <p className="font-bold text-[var(--foreground)]">Cara Mengaktifkan Full Akses PostgreSQL 16:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                    <li>Buka file <code>.env</code> di root proyek.</li>
                    <li>Tempelkan connection string Anda pada baris <code>DATABASE_URL</code> (atau kirimkan string koneksinya di chat ini agar saya eksekusikan langsung).</li>
                    <li>Jalankan migrasi skema tabel: <code>npm run db:migrate</code>.</li>
                    <li>Jalankan server API backend: <code>npm run server</code>.</li>
                  </ol>
                </div>
              </div>

              <div className="p-4 border-t border-[var(--border)] bg-[var(--background)] flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowDbModal(false)}
                  className="px-5 py-2 bg-[var(--primary)] hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
