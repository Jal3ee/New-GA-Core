import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGlobalLoading } from '../../context/LoadingContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, Plus, ArrowRightLeft, ClipboardCheck,
  FileDown, X, ChevronRight, Truck, Clock,
  SlidersHorizontal, Building2, ShieldCheck, Check, Trash2,
  Users, Info, ArrowUpRight, Calculator, AlertTriangle, Sparkles, RefreshCw
} from 'lucide-react';
import { api as gasClient } from '../../lib/gasClient';
import CustomSelect from '../../components/ui/CustomSelect';
import Pagination from '../../components/ui/Pagination';
import {
  INITIAL_BHP_ITEMS,
  INITIAL_BHP_STOCKS,
  INITIAL_BHP_USAGES,
  INITIAL_BHP_STOCK_INS,
  INITIAL_BHP_TRANSFERS,
  INITIAL_BHP_OPNAMES
} from '../../data/initialBhpData';
import {
  generateBhpForecastPdfReport,
  formatRupiah
} from '../../utils/bhpPdfExport';
import {
  savePgBhpUsage,
  savePgBhpStockIn,
  savePgBhpTransfer,
  savePgBhpOpname,
  savePgBhpPdfHistory
} from '../../lib/pgClient';

export default function BhpMessPage() {
  const { user } = useAuth();
  const { showLoading, hideLoading } = useGlobalLoading();

  // Active Tab & Site Filter
  const [activeTab, setActiveTab] = useState('stok'); // 'stok', 'pemakaian', 'penerimaan', 'mutasi_opname', 'forecast'
  const [selectedSite, setSelectedSite] = useState('ALL'); // 'ALL', 'LBCT', 'IDMG', 'SPCT'
  
  // Tab 1: Catalog Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'aman', 'restock'
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState(25);

  // Tab 2: Usage Search & Pagination
  const [usageSearch, setUsageSearch] = useState('');
  const [usagePage, setUsagePage] = useState(1);
  const [usagePageSize, setUsagePageSize] = useState(15);

  // Tab 3: Stock-In Search & Pagination
  const [stockInSearch, setStockInSearch] = useState('');
  const [stockInPage, setStockInPage] = useState(1);
  const [stockInPageSize, setStockInPageSize] = useState(15);

  // Tab 4: Mutasi & Opname Sub-tab, Search & Pagination
  const [mutasiSubTab, setMutasiSubTab] = useState('transfer'); // 'transfer', 'opname'
  const [transferSearch, setTransferSearch] = useState('');
  const [transferPage, setTransferPage] = useState(1);
  const [transferPageSize, setTransferPageSize] = useState(10);
  const [opnameSearch, setOpnameSearch] = useState('');
  const [opnamePage, setOpnamePage] = useState(1);
  const [opnamePageSize, setOpnamePageSize] = useState(10);

  // Tab 5: Forecast Search, Pagination, Model Filter & Detail Modals
  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastPage, setForecastPage] = useState(1);
  const [forecastPageSize, setForecastPageSize] = useState(25);
  const [forecastModelFilter, setForecastModelFilter] = useState('ALL'); // 'ALL', 'MANDAYS', 'STATIC'
  const [selectedForecastDetail, setSelectedForecastDetail] = useState(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isSyncingMess, setIsSyncingMess] = useState(false);
  const [messSyncStatus, setMessSyncStatus] = useState(null);

  // Mandays Headcount & Risk Parameters (Integrated with Mess Occupancy)
  const [mandaysParams, setMandaysParams] = useState({
    histResidentCount: 150,     // Total Penghuni Tetap Historis
    histDays: 30,              // Jumlah Hari Periode Historis
    histVisitorCount: 25,       // Total Visitor Historis
    histVisitorAvgStay: 5,     // Rata-rata Lama Inap Visitor Historis (Hari)
    nextResidentCount: 160,     // Estimasi Penghuni Tetap Bulan Depan
    nextDays: 30,              // Estimasi Hari Bulan Depan (30 Hari)
    nextVisitorCount: 35,       // Estimasi Visitor Bulan Depan
    nextVisitorAvgStay: 5,     // Estimasi Lama Inap Visitor Bulan Depan (Hari)
    leadTimeDays: 7,           // Lead Time Pengiriman Supplier (Hari)
    zScore: 1.65               // Z-Score untuk 95% Service Level
  });

  // Item Detail Drawer
  const [selectedItemForDrawer, setSelectedItemForDrawer] = useState(null);

  // Quick Transaction Modals
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Signer names for PDF Export (Default to active staff or saved choice)
  const [signerAdminName, setSignerAdminName] = useState(() => {
    return localStorage.getItem('bhp_signer_admin') || (user?.name ? `${user.name.replace(/\s*\([^)]*\)\s*$/, '').trim()} (GA Admin)` : 'GA Super Administrator (GA Admin)');
  });
  const [signerGlName, setSignerGlName] = useState(() => {
    return localStorage.getItem('bhp_signer_gl') || 'Hendra Setiawan (GA GL)';
  });

  // State Management with Version Check (Prevents showing old dummy data)
  const STORAGE_VERSION_KEY = 'garda_bhp_sep2026_v2';

  const [items, setItems] = useState(() => {
    const isSynced = localStorage.getItem(STORAGE_VERSION_KEY);
    if (!isSynced) {
      localStorage.removeItem('garda_bhp_items');
      localStorage.removeItem('garda_bhp_stocks');
      localStorage.removeItem('garda_bhp_usages');
      localStorage.removeItem('garda_bhp_stock_ins');
      localStorage.removeItem('garda_bhp_transfers');
      localStorage.removeItem('garda_bhp_opnames');
      localStorage.removeItem('garda_bhp_pdf_history');
      localStorage.setItem(STORAGE_VERSION_KEY, 'true');
      return INITIAL_BHP_ITEMS;
    }
    const saved = localStorage.getItem('garda_bhp_items');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 139) return parsed;
      } catch (e) {}
    }
    return INITIAL_BHP_ITEMS;
  });

  const [stocks, setStocks] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_stocks');
    return saved ? JSON.parse(saved) : INITIAL_BHP_STOCKS;
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

  const [pdfHistory, setPdfHistory] = useState(() => {
    const saved = localStorage.getItem('garda_bhp_pdf_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('garda_bhp_items', JSON.stringify(items));
    localStorage.setItem('garda_bhp_stocks', JSON.stringify(stocks));
    localStorage.setItem('garda_bhp_usages', JSON.stringify(usages));
    localStorage.setItem('garda_bhp_stock_ins', JSON.stringify(stockIns));
    localStorage.setItem('garda_bhp_transfers', JSON.stringify(transfers));
    localStorage.setItem('garda_bhp_opnames', JSON.stringify(opnames));
    localStorage.setItem('garda_bhp_pdf_history', JSON.stringify(pdfHistory));
  }, [items, stocks, usages, stockIns, transfers, opnames, pdfHistory]);

  // Load from PostgreSQL 16 on mount
  useEffect(() => {
    fetch('/api/bhp/data')
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data?.items?.length >= 139) {
          const mapped = res.data.items.map(it => ({
            id: it.code,
            code: it.code,
            name: it.name,
            category: it.category,
            unit: it.unit,
            pack_qty: Number(it.pack_size) || 1,
            pack_unit: it.unit?.toUpperCase() || 'PCS',
            default_abc: it.abc_class || 'C',
            default_safety_pct: 5,
            price_est: Number(it.price_est) || 0,
            coa: it.coa || '',
            remarks: it.remarks || ''
          }));
          setItems(mapped);

          if (res.data.usageHistory && Array.isArray(res.data.usageHistory) && res.data.usageHistory.length > 0) {
            setUsages(res.data.usageHistory);
          }
          if (res.data.stockInHistory && Array.isArray(res.data.stockInHistory) && res.data.stockInHistory.length > 0) {
            setStockIns(res.data.stockInHistory);
          }
          if (res.data.transferHistory && Array.isArray(res.data.transferHistory) && res.data.transferHistory.length > 0) {
            setTransfers(res.data.transferHistory);
          }
          if (res.data.opnameHistory && Array.isArray(res.data.opnameHistory) && res.data.opnameHistory.length > 0) {
            setOpnames(res.data.opnameHistory);
          }
        }
      })
  }, []);

  // Business Rule: Kategori Mandays vs Maintenance Area Statis
  const isMandaysCategory = (category) => {
    if (!category) return false;
    const c = category.toLowerCase();
    return c.includes('makanan') || c.includes('konsumsi') || c.includes('toiletries') || c.includes('mandi');
  };

  // Sync Headcount from mess_stays table (PostgreSQL 16)
  const syncWithMessOccupancy = async (silent = false) => {
    setIsSyncingMess(true);
    try {
      const res = await gasClient.getMessStays();
      const stays = res?.data || [];
      const targetStays = selectedSite === 'ALL' 
        ? stays 
        : stays.filter(s => s.site === selectedSite);
      
      const today = new Date().toISOString().split('T')[0];
      const activeStays = targetStays.filter(s => {
        if (!s.start_date) return false;
        const start = s.start_date.split('T')[0];
        const end = s.end_date ? s.end_date.split('T')[0] : '9999-12-31';
        return today >= start && today <= end && (s.status === 'Onsite' || s.status === 'Active');
      });

      let visitors = 0;
      let residents = 0;
      let totalVisitorStayDays = 0;

      activeStays.forEach(s => {
        const notes = (s.notes || '').toLowerCase();
        const role = (s.role || s.guest_name || '').toLowerCase();
        const isVis = notes.includes('visitor') || notes.includes('tamu') || notes.includes('vendor') || role.includes('visitor') || role.includes('tamu');
        
        let stayDays = 5;
        if (s.start_date && s.end_date) {
          const diffMs = new Date(s.end_date) - new Date(s.start_date);
          stayDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        }

        if (isVis || stayDays < 14) {
          visitors++;
          totalVisitorStayDays += Math.min(stayDays, 14);
        } else {
          residents++;
        }
      });

      const avgStay = visitors > 0 ? Math.max(1, Math.round(totalVisitorStayDays / visitors)) : 5;
      const safeResidents = residents > 0 ? residents : (selectedSite === 'LBCT' ? 165 : selectedSite === 'IDMG' ? 110 : selectedSite === 'SPCT' ? 82 : 150);
      const safeVisitors = visitors > 0 ? visitors : (selectedSite === 'ALL' ? 25 : 10);

      setMandaysParams(prev => ({
        ...prev,
        histResidentCount: safeResidents,
        histVisitorCount: safeVisitors,
        histVisitorAvgStay: avgStay,
        nextResidentCount: safeResidents,
        nextVisitorCount: Math.round(safeVisitors * 1.2), // Buffer 20% antisipasi lonjakan visitor
        nextVisitorAvgStay: avgStay
      }));

      setMessSyncStatus({
        timestamp: new Date().toLocaleTimeString('id-ID'),
        residents: safeResidents,
        visitors: safeVisitors,
        avgStay: avgStay
      });
    } catch (err) {
      console.warn('Mess stays auto-sync fallback:', err);
    } finally {
      setIsSyncingMess(false);
    }
  };

  // Auto-sync mess occupancy on mount & whenever site changes (Silent & seamless)
  useEffect(() => {
    syncWithMessOccupancy();
  }, [selectedSite]);

  // Load active employees from system database for PDF signers
  const [activeEmployees, setActiveEmployees] = useState([]);
  useEffect(() => {
    gasClient.getUsers()
      .then(res => {
        if (res?.data && Array.isArray(res.data)) {
          const active = res.data.filter(u => u.is_active !== false && u.status !== 'Inactive');
          setActiveEmployees(active);
        }
      })
      .catch(() => {});
  }, []);

  // Dropdown options for PDF signers from active employees
  const employeeSelectOptions = useMemo(() => {
    if (activeEmployees.length === 0) {
      return [
        { value: 'GA Super Administrator (GA Admin)', label: 'GA Super Administrator (GA Admin)', subtext: 'GA Admin • General Affairs' },
        { value: 'Hendra Setiawan (GA GL)', label: 'Hendra Setiawan (GA GL)', subtext: 'GA GL • General Affairs' },
        { value: 'Ahmad Rizki (PIC LBCT)', label: 'Ahmad Rizki (PIC LBCT)', subtext: 'PIC Lapangan • Site LBCT' },
        { value: 'Budi Santoso (PIC IDMG)', label: 'Budi Santoso (PIC IDMG)', subtext: 'PIC Lapangan • Site IDMG' },
        { value: 'Chandra Wijaya (PIC SPCT)', label: 'Chandra Wijaya (PIC SPCT)', subtext: 'PIC Lapangan • Site SPCT' },
        { value: 'Ahmad Tajali (Karyawan)', label: 'Ahmad Tajali (Karyawan)', subtext: 'Karyawan • GA' }
      ];
    }
    return activeEmployees.map(u => {
      const roleLabel = u.role === 'admin' ? 'GA Admin' : u.role === 'ga_gl' ? 'GA GL' : u.role === 'pic_lapangan' ? 'PIC Lapangan' : (u.role || 'Staff GA');
      const cleanName = (u.name || u.nama || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
      const val = `${cleanName} (${roleLabel})`;
      return {
        value: val,
        label: val,
        subtext: `NIK: ${u.nik || '-'} • Site: ${u.site || 'ALL'} • ${u.department || 'General Affairs'}`
      };
    });
  }, [activeEmployees]);

  // Unique Categories from master items
  const categoriesList = useMemo(() => {
    const set = new Set();
    items.forEach(it => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set);
  }, [items]);

  // Searchable Options for Form Selects (139 items with subtext and clean labels)
  const itemSelectOptions = useMemo(() => {
    return items.map(it => {
      const stock = (stocks.LBCT?.[it.id] || 0) + (stocks.IDMG?.[it.id] || 0) + (stocks.SPCT?.[it.id] || 0);
      return {
        value: it.id,
        label: `${it.code} — ${it.name}`,
        subtext: `${it.category} • Total Stok: ${stock} ${it.unit} • Harga: ${formatRupiah(it.price_est)}`,
        category: it.category
      };
    });
  }, [items, stocks]);

  const SITE_OPTIONS = [
    { value: 'LBCT', label: 'Site LBCT' },
    { value: 'IDMG', label: 'Site IDMG' },
    { value: 'SPCT', label: 'Site SPCT' }
  ];

  const categoryFilterOptions = useMemo(() => [
    { value: 'ALL', label: `Semua Kategori (${items.length} SKU)` },
    ...categoriesList.map(c => ({
      value: c,
      label: c,
      badge: `${items.filter(i => i.category === c).length} SKU`
    }))
  ], [categoriesList, items]);

  const statusFilterOptions = [
    { value: 'ALL', label: 'Semua Status Stok' },
    { value: 'aman', label: 'Stok Tersedia (> 0)', badge: 'Aman' },
    { value: 'restock', label: 'Stok Kosong (0 Unit)', badge: 'Restock' }
  ];

  // Helper to get stock for an item
  const getItemStock = (itemId, site = selectedSite) => {
    if (site === 'ALL') {
      return (stocks.LBCT?.[itemId] || 0) + (stocks.IDMG?.[itemId] || 0) + (stocks.SPCT?.[itemId] || 0);
    }
    return stocks[site]?.[itemId] || 0;
  };

  // --------------------------------------------------------------------------
  // TAB 1: FILTER & PAGINATION FOR CATALOG
  // --------------------------------------------------------------------------
  const filteredCatalogItems = useMemo(() => {
    return items.filter(it => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        it.code.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.coa && it.coa.toLowerCase().includes(q))
      );
      const matchCat = selectedCategory === 'ALL' || it.category === selectedCategory;
      const currentStock = getItemStock(it.id);
      let matchStatus = true;
      if (statusFilter === 'aman') matchStatus = currentStock > 0;
      if (statusFilter === 'restock') matchStatus = currentStock === 0;

      return matchSearch && matchCat && matchStatus;
    });
  }, [items, searchQuery, selectedCategory, statusFilter, selectedSite, stocks]);

  // Reset page when filters change
  useEffect(() => {
    setCatalogPage(1);
  }, [searchQuery, selectedCategory, statusFilter, selectedSite]);

  const paginatedCatalogItems = useMemo(() => {
    const start = (catalogPage - 1) * catalogPageSize;
    return filteredCatalogItems.slice(start, start + catalogPageSize);
  }, [filteredCatalogItems, catalogPage, catalogPageSize]);

  // --------------------------------------------------------------------------
  // TAB 2: FILTER & PAGINATION FOR USAGE
  // --------------------------------------------------------------------------
  const filteredUsages = useMemo(() => {
    return usages.filter(u => {
      const matchSite = selectedSite === 'ALL' || u.site === selectedSite;
      const q = usageSearch.toLowerCase().trim();
      const matchSearch = !q || (
        (u.item_name && u.item_name.toLowerCase().includes(q)) ||
        (u.item_id && u.item_id.toLowerCase().includes(q)) ||
        (u.pic_name && u.pic_name.toLowerCase().includes(q)) ||
        (u.notes && u.notes.toLowerCase().includes(q)) ||
        (u.date && u.date.includes(q))
      );
      return matchSite && matchSearch;
    });
  }, [usages, selectedSite, usageSearch]);

  useEffect(() => {
    setUsagePage(1);
  }, [usageSearch, selectedSite]);

  const paginatedUsages = useMemo(() => {
    const start = (usagePage - 1) * usagePageSize;
    return filteredUsages.slice(start, start + usagePageSize);
  }, [filteredUsages, usagePage, usagePageSize]);

  // --------------------------------------------------------------------------
  // TAB 3: FILTER & PAGINATION FOR STOCK-IN
  // --------------------------------------------------------------------------
  const filteredStockIns = useMemo(() => {
    return stockIns.filter(s => {
      const matchSite = selectedSite === 'ALL' || s.site === selectedSite;
      const q = stockInSearch.toLowerCase().trim();
      const matchSearch = !q || (
        (s.item_name && s.item_name.toLowerCase().includes(q)) ||
        (s.item_code && s.item_code.toLowerCase().includes(q)) ||
        (s.ref_po && s.ref_po.toLowerCase().includes(q)) ||
        (s.receiver_name && s.receiver_name.toLowerCase().includes(q)) ||
        (s.date && s.date.includes(q))
      );
      return matchSite && matchSearch;
    });
  }, [stockIns, selectedSite, stockInSearch]);

  useEffect(() => {
    setStockInPage(1);
  }, [stockInSearch, selectedSite]);

  const paginatedStockIns = useMemo(() => {
    const start = (stockInPage - 1) * stockInPageSize;
    return filteredStockIns.slice(start, start + stockInPageSize);
  }, [filteredStockIns, stockInPage, stockInPageSize]);

  // --------------------------------------------------------------------------
  // TAB 4: FILTER & PAGINATION FOR TRANSFERS & OPNAMES
  // --------------------------------------------------------------------------
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const q = transferSearch.toLowerCase().trim();
      return !q || (
        (t.item_name && t.item_name.toLowerCase().includes(q)) ||
        (t.from_site && t.from_site.toLowerCase().includes(q)) ||
        (t.to_site && t.to_site.toLowerCase().includes(q)) ||
        (t.reason && t.reason.toLowerCase().includes(q))
      );
    });
  }, [transfers, transferSearch]);

  const paginatedTransfers = useMemo(() => {
    const start = (transferPage - 1) * transferPageSize;
    return filteredTransfers.slice(start, start + transferPageSize);
  }, [filteredTransfers, transferPage, transferPageSize]);

  const filteredOpnames = useMemo(() => {
    return opnames.filter(o => {
      const matchSite = selectedSite === 'ALL' || o.site === selectedSite;
      const q = opnameSearch.toLowerCase().trim();
      return matchSite && (!q || (
        (o.item_name && o.item_name.toLowerCase().includes(q)) ||
        (o.reason && o.reason.toLowerCase().includes(q)) ||
        (o.pic_name && o.pic_name.toLowerCase().includes(q))
      ));
    });
  }, [opnames, selectedSite, opnameSearch]);

  const paginatedOpnames = useMemo(() => {
    const start = (opnamePage - 1) * opnamePageSize;
    return filteredOpnames.slice(start, start + opnamePageSize);
  }, [filteredOpnames, opnamePage, opnamePageSize]);

  // --------------------------------------------------------------------------
  // TAB 5: FORECAST & REKAP KEBUTUHAN (MANDAYS CONSUMPTION & SAFETY STOCK)
  // --------------------------------------------------------------------------
  
  // Perhitungan Metrik Mandays Global (Tahap 1.1 & Tahap 1.3)
  const mandaysMetrics = useMemo(() => {
    const {
      histResidentCount, histDays, histVisitorCount, histVisitorAvgStay,
      nextResidentCount, nextDays, nextVisitorCount, nextVisitorAvgStay,
      leadTimeDays, zScore
    } = mandaysParams;

    // Tahap 1.1: Mandays Historis = (Penghuni Tetap × Hari) + (Visitor × Lama Inap)
    const histResidentMandays = (Number(histResidentCount) || 0) * (Number(histDays) || 30);
    const histVisitorMandays = (Number(histVisitorCount) || 0) * (Number(histVisitorAvgStay) || 1);
    const totalHistMandays = Math.max(1, histResidentMandays + histVisitorMandays);

    // Tahap 1.3: Estimasi Mandays Bulan Depan = (Penghuni Tetap Next × 30) + (Visitor Next × Lama Inap)
    const nextResidentMandays = (Number(nextResidentCount) || 0) * (Number(nextDays) || 30);
    const nextVisitorMandays = (Number(nextVisitorCount) || 0) * (Number(nextVisitorAvgStay) || 1);
    const totalNextMandays = Math.max(1, nextResidentMandays + nextVisitorMandays);

    const mandaysGrowthPct = totalHistMandays > 0 ? (((totalNextMandays - totalHistMandays) / totalHistMandays) * 100) : 0;
    const sqrtLeadTime = Math.sqrt(Math.max(1, Number(leadTimeDays) || 7));

    return {
      totalHistMandays,
      histResidentMandays,
      histVisitorMandays,
      totalNextMandays,
      nextResidentMandays,
      nextVisitorMandays,
      mandaysGrowthPct,
      leadTimeDays: Number(leadTimeDays) || 7,
      sqrtLeadTime,
      zScore: Number(zScore) || 1.65
    };
  }, [mandaysParams]);

  // Kalkulasi Step-by-Step Rekomendasi Pemesanan per Item BHP
  const allForecastRecommendations = useMemo(() => {
    const targetSites = selectedSite === 'ALL' ? ['LBCT', 'IDMG', 'SPCT'] : [selectedSite];
    const { totalHistMandays, totalNextMandays, leadTimeDays, sqrtLeadTime, zScore } = mandaysMetrics;

    return items.map(it => {
      let sumCurrentStock = 0;
      let totalUsedHist = 0;
      const usageValues = [];

      targetSites.forEach(st => {
        const currentStock = stocks[st]?.[it.id] || 0;
        sumCurrentStock += currentStock;

        // Ambil riwayat pemakaian aktual
        const siteUsages = usages.filter(u => u.site === st && u.item_id === it.id);
        siteUsages.forEach(u => {
          const q = Number(u.qty || 0);
          totalUsedHist += q;
          usageValues.push(q);
        });
      });

      const isMandays = isMandaysCategory(it.category);
      const modelType = isMandays ? 'MANDAYS' : 'STATIC';

      // ----------------------------------------------------------------------
      // TAHAP 1: PERHITUNGAN BASE FORECAST (BF)
      // ----------------------------------------------------------------------
      let consumptionRate = 0; // CR
      let baseForecast = 0;

      if (isMandays) {
        // Aturan Mandays: Total Terpakai / Mandays Historis
        consumptionRate = totalHistMandays > 0 ? (totalUsedHist / totalHistMandays) : 0;
        baseForecast = totalNextMandays * consumptionRate;
      } else {
        // Aturan Maintenance Area Statis: Berdasarkan base historis tanpa dikalikan headcount
        const histDays = Number(mandaysParams.histDays) || 30;
        const nextDays = Number(mandaysParams.nextDays) || 30;
        consumptionRate = histDays > 0 ? (totalUsedHist / histDays) : 0;
        baseForecast = totalUsedHist * (nextDays / histDays);
      }

      // ----------------------------------------------------------------------
      // TAHAP 2: PERHITUNGAN SAFETY STOCK (SS) DENGAN STANDAR DEVIASI (σ)
      // ----------------------------------------------------------------------
      // 1. Hitung Standar Deviasi (σ)
      let stdDev = 0;
      if (usageValues.length > 1) {
        const mean = totalUsedHist / usageValues.length;
        const variance = usageValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (usageValues.length - 1);
        stdDev = Math.sqrt(variance);
      } else if (usageValues.length === 1) {
        stdDev = usageValues[0] * 0.20; // Estimasi variabilitas baseline 20%
      } else {
        stdDev = 0;
      }

      // 2. Safety Stock = Z-Score × Standar Deviasi (σ) × Akar Kuadrat Lead Time (√L)
      const rawSafetyStock = zScore * stdDev * sqrtLeadTime;
      const safetyStock = Math.ceil(rawSafetyStock);

      // ----------------------------------------------------------------------
      // TAHAP 3: KALKULASI FINAL ORDER (OUTPUT AKHIR)
      // Rumus: (Base Forecast + Safety Stock) - Sisa Stok Saat Ini
      // Aturan: Jika bernilai minus, ubah menjadi 0 (tidak perlu order)
      // ----------------------------------------------------------------------
      const grossOrder = (baseForecast + safetyStock) - sumCurrentStock;
      const finalOrderPcs = Math.max(0, Math.ceil(grossOrder));

      const packQty = it.pack_qty || 1;
      const recommendedPacks = Math.ceil(finalOrderPcs / packQty);
      const recommendedQtyPcs = recommendedPacks * packQty;
      const totalCost = recommendedQtyPcs * (it.price_est || 0);

      return {
        item_id: it.id,
        code: it.code,
        name: it.name,
        category: it.category,
        unit: it.unit,
        pack_qty: packQty,
        pack_unit: it.pack_unit,
        price_est: it.price_est,
        model_type: modelType,
        is_mandays: isMandays,
        current_stock: sumCurrentStock,
        total_used_hist: totalUsedHist,
        consumption_rate: consumptionRate,
        base_forecast: Math.round(baseForecast * 100) / 100,
        std_dev: Math.round(stdDev * 100) / 100,
        safety_stock: safetyStock,
        gross_order: Math.round(grossOrder * 100) / 100,
        final_order: finalOrderPcs,
        recommended_qty_pcs: recommendedQtyPcs,
        recommended_packs: recommendedPacks,
        total_cost: totalCost,
        breakdown_context: {
          histMandays: totalHistMandays,
          nextMandays: totalNextMandays,
          histResident: mandaysParams.histResidentCount,
          histVisitor: mandaysParams.histVisitorCount,
          histVisitorStay: mandaysParams.histVisitorAvgStay,
          nextResident: mandaysParams.nextResidentCount,
          nextVisitor: mandaysParams.nextVisitorCount,
          nextVisitorStay: mandaysParams.nextVisitorAvgStay,
          leadTime: leadTimeDays,
          sqrtLeadTime: Math.round(sqrtLeadTime * 1000) / 1000,
          zScore: zScore
        }
      };
    });
  }, [items, stocks, usages, selectedSite, mandaysMetrics, mandaysParams]);

  const filteredForecastList = useMemo(() => {
    return allForecastRecommendations.filter(f => {
      const q = forecastSearch.toLowerCase().trim();
      const matchSearch = !q || (
        f.code.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
      const matchModel = forecastModelFilter === 'ALL' || f.model_type === forecastModelFilter;
      const matchCategory = selectedCategory === 'ALL' || f.category === selectedCategory;
      return matchSearch && matchModel && matchCategory;
    });
  }, [allForecastRecommendations, forecastSearch, forecastModelFilter, selectedCategory]);

  useEffect(() => {
    setForecastPage(1);
  }, [forecastSearch, forecastModelFilter, selectedCategory, selectedSite]);

  const paginatedForecastList = useMemo(() => {
    const start = (forecastPage - 1) * forecastPageSize;
    return filteredForecastList.slice(start, start + forecastPageSize);
  }, [filteredForecastList, forecastPage, forecastPageSize]);

  // Overall forecast metrics
  const forecastSummary = useMemo(() => {
    const totalOrderCost = allForecastRecommendations.reduce((acc, curr) => acc + (curr.total_cost || 0), 0);
    const totalPcs = allForecastRecommendations.reduce((acc, curr) => acc + (curr.recommended_qty_pcs || 0), 0);
    const totalPacks = allForecastRecommendations.reduce((acc, curr) => acc + (curr.recommended_packs || 0), 0);
    const itemsNeedingOrder = allForecastRecommendations.filter(f => f.recommended_qty_pcs > 0).length;
    const mandaysItems = allForecastRecommendations.filter(f => f.is_mandays).length;
    const staticItems = allForecastRecommendations.length - mandaysItems;
    return { totalOrderCost, totalPcs, totalPacks, itemsNeedingOrder, mandaysItems, staticItems };
  }, [allForecastRecommendations]);

  // --------------------------------------------------------------------------
  // FORM HANDLERS (SEARCHABLE COMBOBOXES)
  // --------------------------------------------------------------------------

  // Usage Form State
  const [usageForm, setUsageForm] = useState({
    site: 'LBCT',
    date: new Date().toISOString().split('T')[0],
    item_id: items[0]?.id || 'BHP001',
    qty: '',
    notes: ''
  });

  const handleSaveUsage = (e) => {
    e.preventDefault();
    if (!usageForm.qty || Number(usageForm.qty) <= 0) {
      return toast.warning('Jumlah pemakaian harus lebih dari 0');
    }

    const itemObj = items.find(it => it.id === usageForm.item_id);
    const newRecord = {
      id: `USG-${Date.now()}`,
      date: usageForm.date,
      site: usageForm.site,
      item_id: usageForm.item_id,
      item_name: itemObj?.name || usageForm.item_id,
      qty: Number(usageForm.qty),
      pic_name: user?.name || 'PIC Lapangan',
      notes: usageForm.notes || 'Pemakaian harian'
    };

    setStocks(prev => {
      const updated = { ...prev };
      const siteStock = { ...(updated[usageForm.site] || {}) };
      siteStock[usageForm.item_id] = Math.max(0, (siteStock[usageForm.item_id] || 0) - Number(usageForm.qty));
      updated[usageForm.site] = siteStock;
      return updated;
    });

    setUsages(prev => [newRecord, ...prev]);

    savePgBhpUsage({
      entries: [{ itemCode: usageForm.item_id, qty: usageForm.qty, notes: usageForm.notes }],
      picName: user?.name || 'PIC Lapangan',
      site: usageForm.site,
      date: usageForm.date
    }).catch(err => console.warn('[PG-Sync] Usage:', err.message));

    toast.success(`Pemakaian ${usageForm.qty} ${itemObj?.unit || 'unit'} tercatat untuk ${usageForm.site}`);
    setIsUsageModalOpen(false);
    setUsageForm(prev => ({ ...prev, qty: '', notes: '' }));
  };

  // Stock-In Form State (Multi-Item Batch Receipt, No PO requirement)
  const [stockInForm, setStockInForm] = useState({
    site: 'LBCT',
    date: new Date().toISOString().split('T')[0],
    source: '',
    notes: '',
    items: [
      { item_id: '', qty: 1, notes: '' }
    ]
  });

  const handleAddStockInRow = () => {
    setStockInForm(prev => ({
      ...prev,
      items: [...prev.items, { item_id: '', qty: 1, notes: '' }]
    }));
  };

  const handleRemoveStockInRow = (index) => {
    if (stockInForm.items.length <= 1) return;
    setStockInForm(prev => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const handleUpdateStockInRow = (index, field, value) => {
    setStockInForm(prev => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const handleSaveStockIn = (e) => {
    e.preventDefault();
    if (!stockInForm.items || stockInForm.items.length === 0) {
      return toast.warning('Tambahkan minimal 1 item barang yang diterima');
    }

    // Validate that each row has an item and qty > 0
    for (let i = 0; i < stockInForm.items.length; i++) {
      const row = stockInForm.items[i];
      if (!row.item_id) {
        return toast.warning(`Baris ke-${i + 1}: Silakan pilih barang BHP terlebih dahulu`);
      }
      if (!row.qty || Number(row.qty) <= 0) {
        return toast.warning(`Baris ke-${i + 1}: Jumlah qty diterima harus lebih dari 0`);
      }
    }

    const timestamp = Date.now();
    const newRecords = [];
    const stockDeltas = {};

    stockInForm.items.forEach((row, idx) => {
      const itemObj = items.find(it => it.id === row.item_id);
      const qtyNum = Number(row.qty);
      const record = {
        id: `RCV-${timestamp}-${idx}`,
        date: stockInForm.date,
        site: stockInForm.site,
        item_id: row.item_id,
        item_code: itemObj?.code || row.item_id,
        item_name: itemObj?.name || row.item_id,
        qty: qtyNum,
        unit: itemObj?.unit || 'Pcs',
        source: stockInForm.source || 'Pengiriman Masuk',
        condition_status: 'Lengkap',
        receiver_name: user?.name || 'PIC Gudang',
        notes: row.notes || stockInForm.notes || 'Penerimaan logistik'
      };
      newRecords.push(record);
      stockDeltas[row.item_id] = (stockDeltas[row.item_id] || 0) + qtyNum;

      // Sync to PostgreSQL backend
      savePgBhpStockIn({
        date: stockInForm.date,
        site: stockInForm.site,
        itemCode: row.item_id,
        qty: qtyNum,
        refPo: stockInForm.source || null,
        conditionStatus: 'Lengkap',
        receiverName: user?.name || 'PIC Gudang',
        notes: row.notes || stockInForm.notes || null
      }).catch(err => console.warn('[PG-Sync] Stock-In:', err.message));
    });

    // Update physical stocks in real-time
    setStocks(prev => {
      const updated = { ...prev };
      const siteStock = { ...(updated[stockInForm.site] || {}) };
      Object.entries(stockDeltas).forEach(([itemId, addedQty]) => {
        siteStock[itemId] = (siteStock[itemId] || 0) + addedQty;
      });
      updated[stockInForm.site] = siteStock;
      return updated;
    });

    setStockIns(prev => [...newRecords, ...prev]);

    const totalQty = stockInForm.items.reduce((acc, curr) => acc + Number(curr.qty || 0), 0);
    toast.success(`Berhasil menerima ${stockInForm.items.length} item barang (${totalQty} total unit) ke Site ${stockInForm.site}`);

    setIsStockInModalOpen(false);
    setStockInForm({
      site: stockInForm.site,
      date: new Date().toISOString().split('T')[0],
      source: '',
      notes: '',
      items: [{ item_id: '', qty: 1, notes: '' }]
    });
  };

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    from_site: 'LBCT',
    to_site: 'IDMG',
    date: new Date().toISOString().split('T')[0],
    item_id: items[0]?.id || 'BHP001',
    qty: '',
    reason: ''
  });

  const handleSaveTransfer = (e) => {
    e.preventDefault();
    if (transferForm.from_site === transferForm.to_site) {
      return toast.error('Site asal dan site tujuan tidak boleh sama!');
    }
    const currentFromStock = stocks[transferForm.from_site]?.[transferForm.item_id] || 0;
    if (Number(transferForm.qty) > currentFromStock) {
      return toast.error(`Stok di ${transferForm.from_site} tidak mencukupi (Tersedia: ${currentFromStock})`);
    }
    if (!transferForm.reason.trim()) {
      return toast.error('Alasan transfer wajib diisi!');
    }

    const itemObj = items.find(it => it.id === transferForm.item_id);
    const newRecord = {
      id: `TRF-${Date.now()}`,
      date: transferForm.date,
      from_site: transferForm.from_site,
      to_site: transferForm.to_site,
      item_id: transferForm.item_id,
      item_name: itemObj?.name || transferForm.item_id,
      qty: Number(transferForm.qty),
      reason: transferForm.reason,
      pic_name: user?.name || 'GA Admin'
    };

    setStocks(prev => {
      const updated = { ...prev };
      const fromSiteStock = { ...(updated[transferForm.from_site] || {}) };
      const toSiteStock = { ...(updated[transferForm.to_site] || {}) };

      fromSiteStock[transferForm.item_id] = Math.max(0, (fromSiteStock[transferForm.item_id] || 0) - Number(transferForm.qty));
      toSiteStock[transferForm.item_id] = (toSiteStock[transferForm.item_id] || 0) + Number(transferForm.qty);

      updated[transferForm.from_site] = fromSiteStock;
      updated[transferForm.to_site] = toSiteStock;
      return updated;
    });

    setTransfers(prev => [newRecord, ...prev]);

    savePgBhpTransfer({
      date: transferForm.date,
      fromSite: transferForm.from_site,
      toSite: transferForm.to_site,
      itemCode: transferForm.item_id,
      qty: transferForm.qty,
      reason: transferForm.reason,
      picName: user?.name || 'GA Admin'
    }).catch(err => console.warn('[PG-Sync] Transfer:', err.message));

    toast.success(`Transfer ${transferForm.qty} ${itemObj?.unit || 'unit'} dari ${transferForm.from_site} ke ${transferForm.to_site} berhasil!`);
    setTransferForm(prev => ({ ...prev, qty: '', reason: '' }));
  };

  // Stock Opname Form State
  const [opnameForm, setOpnameForm] = useState({
    site: 'LBCT',
    date: new Date().toISOString().split('T')[0],
    item_id: items[0]?.id || 'BHP001',
    physical_qty: '',
    reason: ''
  });

  const handleSaveOpname = (e) => {
    e.preventDefault();
    const systemQty = stocks[opnameForm.site]?.[opnameForm.item_id] || 0;
    const physicalQty = Number(opnameForm.physical_qty);
    const diff = physicalQty - systemQty;

    if (diff !== 0 && !opnameForm.reason.trim()) {
      return toast.error('Alasan selisih opname wajib diisi!');
    }

    const itemObj = items.find(it => it.id === opnameForm.item_id);
    const newRecord = {
      id: `OPN-${Date.now()}`,
      date: opnameForm.date,
      site: opnameForm.site,
      item_id: opnameForm.item_id,
      item_name: itemObj?.name || opnameForm.item_id,
      system_qty: systemQty,
      physical_qty: physicalQty,
      diff_qty: diff,
      reason: diff === 0 ? 'Sesuai fisik' : opnameForm.reason,
      pic_name: user?.name || 'PIC Opname'
    };

    setStocks(prev => {
      const updated = { ...prev };
      const siteStock = { ...(updated[opnameForm.site] || {}) };
      siteStock[opnameForm.item_id] = physicalQty;
      updated[opnameForm.site] = siteStock;
      return updated;
    });

    setOpnames(prev => [newRecord, ...prev]);

    savePgBhpOpname({
      date: opnameForm.date,
      site: opnameForm.site,
      itemCode: opnameForm.item_id,
      systemQty,
      physicalQty,
      reason: newRecord.reason,
      picName: user?.name || 'PIC Opname'
    }).catch(err => console.warn('[PG-Sync] Opname:', err.message));

    toast.success(`Stok ${itemObj?.name} di ${opnameForm.site} disinkronkan ke ${physicalQty} pcs`);
    setOpnameForm(prev => ({ ...prev, physical_qty: '', reason: '' }));
  };

  // Execute PDF Export with Signature Validation
  const handleDownloadPdf = () => {
    if (!signerAdminName.trim() || !signerGlName.trim()) {
      return toast.error('Nama GA Admin dan Nama GA GL WAJIB diisi sebelum dokumen PDF dapat diunduh!');
    }

    localStorage.setItem('bhp_signer_admin', signerAdminName.trim());
    localStorage.setItem('bhp_signer_gl', signerGlName.trim());
    setIsPdfModalOpen(false);

    const siteLabel = selectedSite === 'ALL' ? 'Konsolidasi (LBCT, IDMG, SPCT)' : `Site: ${selectedSite}`;
    const periodLabel = 'September 2026 (Rekap Kebutuhan & Rekomendasi Pemesanan)';

    generateBhpForecastPdfReport({
      forecastData: allForecastRecommendations,
      periodCycle: periodLabel,
      siteScope: siteLabel,
      createdByName: signerAdminName.trim(),
      approvedByName: signerGlName.trim()
    });

    const newLog = {
      id: `PDF-${Date.now()}`,
      download_date: new Date().toLocaleString('id-ID'),
      recap_type: 'Rekomendasi Pemesanan BHP Mess (Forecast & Kebutuhan)',
      period_cycle: periodLabel,
      site: siteLabel,
      created_by_name: signerAdminName.trim(),
      approved_by_name: signerGlName.trim(),
      item_count: allForecastRecommendations.length,
      total_qty: allForecastRecommendations.reduce((s, r) => s + (r.recommended_qty_pcs || 0), 0)
    };
    setPdfHistory(prev => [newLog, ...prev]);

    savePgBhpPdfHistory({
      docType: newLog.recap_type,
      period: newLog.period_cycle,
      siteCovered: newLog.site,
      createdBy: newLog.created_by_name,
      approvedBy: newLog.approved_by_name,
      notes: `Total SKU: ${newLog.item_count}, Total pcs: ${newLog.total_qty}`
    }).catch(err => console.warn('[PG-Sync] PDF History:', err.message));

    toast.success('Dokumen PDF berhasil dibuka untuk dicetak dan dicatat dalam riwayat unduhan.');
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. Header Section - Flush & Modern (No boxed indent!) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0F5C56]/10 text-[#0F5C56] border border-[#0F5C56]/20">
              Operasional Mess • Inventaris BHP
            </span>
            <span className="text-xs text-[var(--muted-foreground)] font-mono">
              139 SKU Terdaftar
            </span>
          </div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)] tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-[#0F5C56]" />
            Barang Habis Pakai (BHP)
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-2xl">
            Pencatatan pemakaian harian, penerimaan suplai multi-item, mutasi stok antar mess, dan estimasi kebutuhan pengadaan 3 site (LBCT, IDMG, SPCT).
          </p>
        </div>

        {/* Site Switcher & Action CTAs */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Site Filter Pills */}
          <div className="flex bg-[var(--muted)]/70 p-1 rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setSelectedSite('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                selectedSite === 'ALL'
                  ? 'bg-[var(--card)] text-[#0F5C56] shadow-xs'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              Semua Site
            </button>
            {['LBCT', 'IDMG', 'SPCT'].map(st => (
              <button
                key={st}
                onClick={() => setSelectedSite(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                  selectedSite === st
                    ? 'bg-[var(--card)] text-[#0F5C56] shadow-xs'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Quick Action CTAs with Micro-Animations */}
          <button
            onClick={() => setIsUsageModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-[#0F5C56] hover:bg-[#0D4E49] rounded-xl transition-all shadow-xs active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Catat Pemakaian
          </button>

          <button
            onClick={() => setIsStockInModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-[var(--foreground)] bg-[var(--card)] hover:bg-[var(--muted)] border border-[var(--border)] rounded-xl transition-all shadow-xs active:scale-95"
          >
            <Truck className="w-3.5 h-3.5 mr-1.5 text-[#0F5C56]" />
            Penerimaan Barang
          </button>


        </div>
      </div>

      {/* 2. Navigation Tabs - 5 Focused Operational Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 overflow-x-auto custom-scrollbar">
        {[
          { id: 'stok', label: 'Katalog & Stok Fisik', icon: Package, count: filteredCatalogItems.length },
          { id: 'pemakaian', label: 'Pencatatan Pemakaian', icon: Clock, count: filteredUsages.length },
          { id: 'penerimaan', label: 'Penerimaan Barang', icon: Truck, count: filteredStockIns.length },
          { id: 'mutasi_opname', label: 'Transfer & Stock Opname', icon: ArrowRightLeft },
          { id: 'forecast', label: 'Forecast & Rekap Kebutuhan', icon: SlidersHorizontal }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#0F5C56] text-white shadow-xs'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mr-1.5" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: KATALOG & STOK FISIK (Searchable, Filterable & Paginated)     */}
      {/* ==================================================================== */}
      {activeTab === 'stok' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--card)] p-3.5 rounded-xl border border-[var(--border)] shadow-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode (BHP...), nama barang, atau COA..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
              />
            </div>

            {/* Filter Kategori & Status (Custom Searchable Selects) */}
            <div className="flex flex-wrap items-center gap-2">
              <CustomSelect
                value={selectedCategory}
                onChange={(val) => setSelectedCategory(val)}
                options={categoryFilterOptions}
                placeholder="Pilih Kategori..."
                className="w-52 sm:w-60"
                buttonClassName="py-1.5"
                searchPlaceholder="Cari kategori..."
              />

              <CustomSelect
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={statusFilterOptions}
                placeholder="Status Stok..."
                className="w-44 sm:w-52"
                buttonClassName="py-1.5"
                searchable={false}
              />
            </div>
          </div>

          {/* Flat Table */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 w-24">Kode</th>
                    <th className="py-3 px-4">Nama Barang (FPA Update Sep 2026)</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Satuan / Pack</th>
                    <th className="py-3 px-4 text-right">Harga FPA</th>
                    <th className="py-3 px-4 text-center">Stok {selectedSite === 'ALL' ? 'Total' : selectedSite}</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                  {paginatedCatalogItems.map((item) => {
                    const stock = getItemStock(item.id);
                    const isAvailable = stock > 0;

                    return (
                      <tr 
                        key={item.id}
                        onClick={() => setSelectedItemForDrawer(item)}
                        className="hover:bg-[var(--muted)]/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#0F5C56]">
                          {item.code}
                        </td>
                        <td className="py-3 px-4 font-medium max-w-sm">
                          <p className="line-clamp-2">{item.name}</p>
                          {item.remarks && (
                            <span className="text-[10px] text-[var(--muted-foreground)] font-normal italic">
                              {item.remarks}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 uppercase text-[var(--muted-foreground)]">
                          {item.unit} {item.pack_qty > 1 ? `(Isi ${item.pack_qty})` : ''}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                          {formatRupiah(item.price_est)}
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded-md font-mono ${
                            isAvailable ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                          }`}>
                            {stock} {item.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isAvailable ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              Aman
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              Kosong
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItemForDrawer(item);
                            }}
                            className="p-1 text-[var(--muted-foreground)] hover:text-[#0F5C56] hover:bg-[var(--muted)] rounded-lg transition-colors"
                            title="Buka Drawer Detail"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedCatalogItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[var(--muted-foreground)]">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-sm">Tidak ditemukan barang yang sesuai</p>
                        <p className="text-xs mt-0.5">Coba ubah kata kunci pencarian atau filter kategori Anda.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--card)]">
              <Pagination
                currentPage={catalogPage}
                totalItems={filteredCatalogItems.length}
                pageSize={catalogPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                onPageChange={setCatalogPage}
                onPageSizeChange={setCatalogPageSize}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: RIWAYAT PEMAKAIAN HARIAN (Search & Pagination)                 */}
      {/* ==================================================================== */}
      {activeTab === 'pemakaian' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--card)] p-3.5 rounded-xl border border-[var(--border)] shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={usageSearch}
                onChange={(e) => setUsageSearch(e.target.value)}
                placeholder="Cari transaksi pemakaian (barang, PIC, catatan)..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
              />
            </div>

            <button
              onClick={() => setIsUsageModalOpen(true)}
              className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-white bg-[#0F5C56] hover:bg-[#0D4E49] rounded-xl transition-all shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Catat Pemakaian Baru
            </button>
          </div>

          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Site</th>
                  <th className="py-3 px-4">Barang</th>
                  <th className="py-3 px-4 text-center">Jumlah Pakai</th>
                  <th className="py-3 px-4">PIC Lapangan</th>
                  <th className="py-3 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                {paginatedUsages.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="py-3 px-4 font-mono">{u.date}</td>
                    <td className="py-3 px-4 font-semibold text-[#0F5C56]">{u.site}</td>
                    <td className="py-3 px-4 font-medium">{u.item_name || u.item_id}</td>
                    <td className="py-3 px-4 text-center font-bold font-mono text-rose-600">-{u.qty}</td>
                    <td className="py-3 px-4 text-[var(--muted-foreground)]">{u.pic_name}</td>
                    <td className="py-3 px-4 text-[var(--muted-foreground)]">{u.notes || '-'}</td>
                  </tr>
                ))}

                {paginatedUsages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[var(--muted-foreground)]">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#0F5C56]" />
                      <p className="font-semibold text-sm">Belum Ada Catatan Pemakaian</p>
                      <p className="text-xs mt-0.5">Gunakan tombol "Catat Pemakaian Baru" untuk mencatat pengeluaran barang aktual.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {filteredUsages.length > 0 && (
              <div className="p-4 border-t border-[var(--border)] bg-[var(--card)]">
                <Pagination
                  currentPage={usagePage}
                  totalItems={filteredUsages.length}
                  pageSize={usagePageSize}
                  pageSizeOptions={[10, 15, 30, 50]}
                  onPageChange={setUsagePage}
                  onPageSizeChange={setUsagePageSize}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: PENERIMAAN BARANG MASUK (Search & Pagination)                 */}
      {/* ==================================================================== */}
      {activeTab === 'penerimaan' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--card)] p-3.5 rounded-xl border border-[var(--border)] shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                value={stockInSearch}
                onChange={(e) => setStockInSearch(e.target.value)}
                placeholder="Cari transaksi penerimaan (barang, sumber pengiriman, penerima)..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
              />
            </div>

            <button
              onClick={() => setIsStockInModalOpen(true)}
              className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-white bg-[#0F5C56] hover:bg-[#0D4E49] rounded-xl transition-all shadow-xs shrink-0 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Catat Penerimaan Baru
            </button>
          </div>

          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Tanggal Tiba</th>
                  <th className="py-3 px-4">Site</th>
                  <th className="py-3 px-4">Barang</th>
                  <th className="py-3 px-4 text-center">Jumlah Diterima</th>
                  <th className="py-3 px-4">Sumber / Keterangan</th>
                  <th className="py-3 px-4">Kondisi</th>
                  <th className="py-3 px-4">Penerima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                {paginatedStockIns.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="py-3 px-4 font-mono">{s.date}</td>
                    <td className="py-3 px-4 font-semibold text-[#0F5C56]">{s.site}</td>
                    <td className="py-3 px-4 font-medium">{s.item_name || s.item_id}</td>
                    <td className="py-3 px-4 text-center font-bold font-mono text-emerald-600">+{s.qty}</td>
                    <td className="py-3 px-4 text-[var(--muted-foreground)]">{s.source || s.ref_po || s.notes || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        {s.condition_status || 'Lengkap'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--muted-foreground)]">{s.receiver_name}</td>
                  </tr>
                ))}

                {paginatedStockIns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[var(--muted-foreground)]">
                      <Truck className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#0F5C56]" />
                      <p className="font-semibold text-sm">Belum Ada Catatan Penerimaan Barang</p>
                      <p className="text-xs mt-0.5">Gunakan tombol "Catat Penerimaan Baru" saat barang pesanan tiba di site.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {filteredStockIns.length > 0 && (
              <div className="p-4 border-t border-[var(--border)] bg-[var(--card)]">
                <Pagination
                  currentPage={stockInPage}
                  totalItems={filteredStockIns.length}
                  pageSize={stockInPageSize}
                  pageSizeOptions={[10, 15, 30, 50]}
                  onPageChange={setStockInPage}
                  onPageSizeChange={setStockInPageSize}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: MUTASI & STOCK OPNAME (Searchable & Paginated Tables)          */}
      {/* ==================================================================== */}
      {activeTab === 'mutasi_opname' && (
        <div className="space-y-4">
          {/* Sub-tab navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setMutasiSubTab('transfer')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mutasiSubTab === 'transfer'
                  ? 'bg-[#0F5C56] text-white shadow-xs'
                  : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)]'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 inline mr-1.5" />
              Transfer Antar Site
            </button>
            <button
              onClick={() => setMutasiSubTab('opname')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mutasiSubTab === 'opname'
                  ? 'bg-[#0F5C56] text-white shadow-xs'
                  : 'bg-[var(--card)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)]'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 inline mr-1.5" />
              Stock Opname Fisik
            </button>
          </div>

          {/* Sub-tab: Transfer Antar Site */}
          {mutasiSubTab === 'transfer' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Input Transfer (1 Kolom) */}
              <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-[#0F5C56]" />
                    Form Transfer Antar Site
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Mutasi stok darurat antar site LBCT, IDMG, dan SPCT.
                  </p>
                </div>

                <form onSubmit={handleSaveTransfer} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-semibold text-[var(--muted-foreground)]">Dari Site Asal</label>
                      <CustomSelect
                        value={transferForm.from_site}
                        onChange={(val) => setTransferForm({ ...transferForm, from_site: val })}
                        options={SITE_OPTIONS}
                        searchable={false}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[var(--muted-foreground)]">Ke Site Tujuan</label>
                      <CustomSelect
                        value={transferForm.to_site}
                        onChange={(val) => setTransferForm({ ...transferForm, to_site: val })}
                        options={SITE_OPTIONS}
                        searchable={false}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Pilih Barang BHP</label>
                    <CustomSelect
                      value={transferForm.item_id}
                      onChange={(val) => setTransferForm({ ...transferForm, item_id: val })}
                      options={itemSelectOptions}
                      placeholder="Cari barang BHP..."
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-semibold text-[var(--muted-foreground)]">Jumlah Transfer</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={transferForm.qty}
                        onChange={(e) => setTransferForm({ ...transferForm, qty: e.target.value })}
                        placeholder="Qty unit"
                        className="w-full mt-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[var(--muted-foreground)]">Tanggal</label>
                      <input
                        type="date"
                        required
                        value={transferForm.date}
                        onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })}
                        className="w-full mt-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Alasan Transfer (Wajib)</label>
                    <input
                      type="text"
                      required
                      value={transferForm.reason}
                      onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                      placeholder="Contoh: Kebutuhan mendesak pengalihan stok"
                      className="w-full mt-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 text-xs font-semibold text-white bg-[#0F5C56] hover:bg-[#0D4E49] rounded-lg transition-all shadow-xs"
                  >
                    Proses Transfer
                  </button>
                </form>
              </div>

              {/* Tabel Riwayat Transfer (2 Kolom) */}
              <div className="lg:col-span-2 bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                      Riwayat Transfer Antar Site
                    </h4>
                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <input
                        type="text"
                        value={transferSearch}
                        onChange={(e) => setTransferSearch(e.target.value)}
                        placeholder="Cari riwayat transfer..."
                        className="w-full pl-8 pr-3 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                      />
                    </div>
                  </div>

                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)] text-[var(--muted-foreground)] text-[10px] font-semibold uppercase">
                          <th className="py-2.5 px-3">Tanggal</th>
                          <th className="py-2.5 px-3">Rute</th>
                          <th className="py-2.5 px-3">Barang & Qty</th>
                          <th className="py-2.5 px-3">Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {paginatedTransfers.map(t => (
                          <tr key={t.id} className="hover:bg-[var(--muted)]/20">
                            <td className="py-2.5 px-3 font-mono">{t.date}</td>
                            <td className="py-2.5 px-3 font-bold text-[#0F5C56]">{t.from_site} &rarr; {t.to_site}</td>
                            <td className="py-2.5 px-3 font-medium">{t.item_name} ({t.qty})</td>
                            <td className="py-2.5 px-3 text-[var(--muted-foreground)]">{t.reason}</td>
                          </tr>
                        ))}
                        {paginatedTransfers.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-[var(--muted-foreground)] italic text-xs">
                              Belum ada mutasi transfer antar-site.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {filteredTransfers.length > 0 && (
                  <Pagination
                    currentPage={transferPage}
                    totalItems={filteredTransfers.length}
                    pageSize={transferPageSize}
                    pageSizeOptions={[10, 20, 50]}
                    onPageChange={setTransferPage}
                    onPageSizeChange={setTransferPageSize}
                  />
                )}
              </div>
            </div>
          )}

          {/* Sub-tab: Stock Opname Fisik */}
          {mutasiSubTab === 'opname' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Input Opname (1 Kolom) */}
              <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-[#0F5C56]" />
                    Pencatatan Opname Fisik
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Sesuaikan stok sistem dengan hasil perhitungan fisik aktual.
                  </p>
                </div>

                <form onSubmit={handleSaveOpname} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="font-semibold text-[var(--muted-foreground)]">Site Opname</label>
                      <CustomSelect
                        value={opnameForm.site}
                        onChange={(val) => setOpnameForm({ ...opnameForm, site: val })}
                        options={SITE_OPTIONS}
                        searchable={false}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[var(--muted-foreground)]">Tanggal Opname</label>
                      <input
                        type="date"
                        required
                        value={opnameForm.date}
                        onChange={(e) => setOpnameForm({ ...opnameForm, date: e.target.value })}
                        className="w-full mt-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Pilih Barang BHP</label>
                    <CustomSelect
                      value={opnameForm.item_id}
                      onChange={(val) => setOpnameForm({ ...opnameForm, item_id: val })}
                      options={itemSelectOptions}
                      placeholder="Cari barang BHP..."
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">
                      Jumlah Hitung Fisik Sebenarnya (Sistem: {stocks[opnameForm.site]?.[opnameForm.item_id] || 0})
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={opnameForm.physical_qty}
                      onChange={(e) => setOpnameForm({ ...opnameForm, physical_qty: e.target.value })}
                      placeholder="Angka aktual fisik di gudang"
                      className="w-full mt-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Alasan Selisih (Wajib jika ada beda)</label>
                    <input
                      type="text"
                      value={opnameForm.reason}
                      onChange={(e) => setOpnameForm({ ...opnameForm, reason: e.target.value })}
                      placeholder="Contoh: Kemasan bocor / Selisih pencatatan / Sesuai"
                      className="w-full mt-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 text-xs font-semibold text-white bg-[#0F5C56] hover:bg-[#0D4E49] rounded-lg transition-all shadow-xs"
                  >
                    Terapkan Hasil Opname
                  </button>
                </form>
              </div>

              {/* Tabel Riwayat Opname (2 Kolom) */}
              <div className="lg:col-span-2 bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                      Riwayat Rekonsiliasi Opname Fisik
                    </h4>
                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <input
                        type="text"
                        value={opnameSearch}
                        onChange={(e) => setOpnameSearch(e.target.value)}
                        placeholder="Cari riwayat opname..."
                        className="w-full pl-8 pr-3 py-1 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                      />
                    </div>
                  </div>

                  <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)] text-[var(--muted-foreground)] text-[10px] font-semibold uppercase">
                          <th className="py-2.5 px-3">Tanggal</th>
                          <th className="py-2.5 px-3">Site</th>
                          <th className="py-2.5 px-3">Barang</th>
                          <th className="py-2.5 px-3 text-center">Fisik (Selisih)</th>
                          <th className="py-2.5 px-3">Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {paginatedOpnames.map(o => (
                          <tr key={o.id} className="hover:bg-[var(--muted)]/20">
                            <td className="py-2.5 px-3 font-mono">{o.date}</td>
                            <td className="py-2.5 px-3 font-bold text-[#0F5C56]">{o.site}</td>
                            <td className="py-2.5 px-3 font-medium">{o.item_name}</td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold">
                              {o.physical_qty} ({o.diff_qty > 0 ? `+${o.diff_qty}` : o.diff_qty})
                            </td>
                            <td className="py-2.5 px-3 text-[var(--muted-foreground)]">{o.reason}</td>
                          </tr>
                        ))}
                        {paginatedOpnames.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-[var(--muted-foreground)] italic text-xs">
                              Belum ada catatan rekonsiliasi opname fisik.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {filteredOpnames.length > 0 && (
                  <Pagination
                    currentPage={opnamePage}
                    totalItems={filteredOpnames.length}
                    pageSize={opnamePageSize}
                    pageSizeOptions={[10, 20, 50]}
                    onPageChange={setOpnamePage}
                    onPageSizeChange={setOpnamePageSize}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: FORECAST & REKAP KEBUTUHAN (MANDAYS & RISK MANAGEMENT)       */}
      {/* ==================================================================== */}
      {activeTab === 'forecast' && (
        <div className="space-y-4">
          {/* 1. Headcount & Mandays KPI 4-Card Strip (Clean, Flat, Calm Density) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Card 1: Okupansi Mess Terintegrasi */}
            <div className="p-4 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xs transition-all hover:border-[#0F5C56]/40">
              <div className="flex items-center justify-between text-[var(--muted-foreground)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Okupansi Mess Terintegrasi</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-[var(--foreground)]">
                  {mandaysParams.nextResidentCount} <span className="text-xs font-normal text-[var(--muted-foreground)]">Tetap</span>
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">•</span>
                <span className="text-xl font-bold font-mono text-[#0F5C56]">
                  {mandaysParams.nextVisitorCount} <span className="text-xs font-normal text-[var(--muted-foreground)]">Visitor</span>
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1 truncate">
                Rata-rata inap: <span className="font-semibold text-[var(--foreground)] font-mono">{mandaysParams.nextVisitorAvgStay} hari</span> • Terintegrasi modul Mess
              </p>
            </div>

            {/* Card 2: Proyeksi Mandays Bulan Depan */}
            <div className="p-4 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xs transition-all hover:border-[#0F5C56]/40">
              <div className="flex items-center justify-between text-[var(--muted-foreground)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Estimasi Mandays Next</span>
                <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                  mandaysMetrics.mandaysGrowthPct > 0 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                }`}>
                  {mandaysMetrics.mandaysGrowthPct >= 0 ? '+' : ''}{mandaysMetrics.mandaysGrowthPct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-[#0F5C56]">
                  {mandaysMetrics.totalNextMandays.toLocaleString('id-ID')}
                </span>
                <span className="text-xs text-[var(--muted-foreground)] font-mono">Mandays</span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1 truncate">
                Historis: <span className="font-mono font-medium text-[var(--foreground)]">{mandaysMetrics.totalHistMandays.toLocaleString('id-ID')}</span> mandays (periode lalu)
              </p>
            </div>

            {/* Card 3: Safety Stock Buffer */}
            <div className="p-4 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xs transition-all hover:border-[#0F5C56]/40">
              <div className="flex items-center justify-between text-[var(--muted-foreground)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Mitigasi Risiko (SS)</span>
                <ShieldCheck className="w-4 h-4 text-[#C4841F]" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl font-bold font-mono text-[var(--foreground)]">95%</span>
                <span className="text-xs text-[var(--muted-foreground)] font-mono">Service Level</span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                Lead Time supplier: <span className="font-semibold text-[var(--foreground)] font-mono">{mandaysParams.leadTimeDays} hari</span>
              </p>
            </div>

            {/* Card 4: Total Rekomendasi Pemesanan */}
            <div className="p-4 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xs transition-all hover:border-[#0F5C56]/40">
              <div className="flex items-center justify-between text-[var(--muted-foreground)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Estimasi Anggaran PO</span>
                <Package className="w-4 h-4 text-[#0F5C56]" />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold font-mono text-[#0F5C56]">
                  {formatRupiah(forecastSummary.totalOrderCost)}
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                <span className="font-semibold text-[var(--foreground)] font-mono">{forecastSummary.itemsNeedingOrder}</span> SKU perlu order ({forecastSummary.totalPacks} Pack)
              </p>
            </div>
          </div>

          {/* 2. Unified Single-Row Controls Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-xl border border-[var(--border)] shadow-xs">
            {/* Model Filter Pills */}
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setForecastModelFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  forecastModelFilter === 'ALL'
                    ? 'bg-[#0F5C56] text-white shadow-xs font-semibold'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50'
                }`}
              >
                Semua Model ({allForecastRecommendations.length})
              </button>
              <button
                type="button"
                onClick={() => setForecastModelFilter('MANDAYS')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  forecastModelFilter === 'MANDAYS'
                    ? 'bg-[#0F5C56] text-white shadow-xs font-semibold'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Mandays Dependent ({forecastSummary.mandaysItems})
              </button>
              <button
                type="button"
                onClick={() => setForecastModelFilter('STATIC')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                  forecastModelFilter === 'STATIC'
                    ? 'bg-[#0F5C56] text-white shadow-xs font-semibold'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Maintenance Area Statis ({forecastSummary.staticItems})
              </button>
            </div>

            {/* Right: Search + Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  value={forecastSearch}
                  onChange={(e) => setForecastSearch(e.target.value)}
                  placeholder="Cari kode atau nama BHP..."
                  className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsConfigModalOpen(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] bg-[var(--background)] hover:bg-[var(--muted)] border border-[var(--border)] rounded-lg transition-all shadow-xs active:scale-95 shrink-0"
                title="Sesuaikan headcount simulasi atau lead time supplier"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-[#C4841F]" />
                Parameter
              </button>

              <button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0F5C56] hover:bg-[#0D4E49] rounded-lg transition-all shadow-xs active:scale-95 shrink-0"
                title="Cetak & Unduh Dokumen Rekap Resmi (PDF Dua Tanda Tangan)"
              >
                <FileDown className="w-3.5 h-3.5 mr-1.5" />
                Unduh Rekap PDF
              </button>
            </div>
          </div>

          {/* 3. Paginated Forecast Table */}
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3.5 w-24">Kode</th>
                    <th className="py-3 px-3.5">Nama Barang</th>
                    <th className="py-3 px-3.5 text-center">Model</th>
                    <th className="py-3 px-3.5 text-right">CR</th>
                    <th className="py-3 px-3.5 text-right">Base Forecast</th>
                    <th className="py-3 px-3.5 text-right">Safety Stock</th>
                    <th className="py-3 px-3.5 text-right">Sisa Stok</th>
                    <th className="py-3 px-3.5 text-center font-bold text-[#0F5C56]">Final Order</th>
                    <th className="py-3 px-3.5 text-right">Estimasi Biaya</th>
                    <th className="py-3 px-3 text-center w-20">Rumus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                  {paginatedForecastList.map((f) => {
                    const isMandays = f.is_mandays;
                    return (
                      <tr key={f.item_id} className="hover:bg-[var(--muted)]/30 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-bold text-[#0F5C56]">{f.code}</td>
                        <td className="py-3 px-3.5 font-medium max-w-xs">
                          <p className="line-clamp-2 leading-snug">{f.name}</p>
                          <span className="text-[10px] text-[var(--muted-foreground)]">{f.category}</span>
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {isMandays ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0F5C56]/10 text-[#0F5C56] border border-[#0F5C56]/20">
                              <Users className="w-2.5 h-2.5" />
                              Mandays
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              <Building2 className="w-2.5 h-2.5" />
                              Statis
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono">
                          {f.consumption_rate > 0 ? (
                            <span title={isMandays ? `${f.consumption_rate.toFixed(5)} unit/manday` : `${f.consumption_rate.toFixed(2)} unit/hari mess`}>
                              {isMandays ? f.consumption_rate.toFixed(4) : f.consumption_rate.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[var(--muted-foreground)]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono">{Math.round(f.base_forecast)} {f.unit}</td>
                        <td className="py-3 px-3.5 text-right font-mono text-[var(--muted-foreground)]" title={`σ=${f.std_dev}, Z=1.65, √L=${mandaysMetrics.sqrtLeadTime.toFixed(2)}`}>
                          +{f.safety_stock}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono">{f.current_stock} {f.unit}</td>
                        <td className="py-3 px-3.5 text-center font-bold">
                          {f.final_order > 0 ? (
                            <span className="px-2.5 py-1 rounded-lg bg-[#0F5C56]/10 text-[#0F5C56] font-mono">
                              {f.recommended_packs} {f.pack_unit} ({f.final_order} {f.unit})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] font-mono text-[11px]">
                              0 (Aman)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono tabular-nums font-semibold">
                          {formatRupiah(f.total_cost)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedForecastDetail(f)}
                            className="p-1.5 text-[var(--muted-foreground)] hover:text-[#0F5C56] hover:bg-[#0F5C56]/10 rounded-lg transition-colors"
                            title="Lihat Rincian Rumus Step-by-Step"
                          >
                            <Calculator className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedForecastList.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[var(--muted-foreground)]">
                        Tidak ada barang yang cocok dengan kriteria filter atau pencarian "{forecastSearch}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--card)]">
              <Pagination
                currentPage={forecastPage}
                totalItems={filteredForecastList.length}
                pageSize={forecastPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                onPageChange={setForecastPage}
                onPageSizeChange={setForecastPageSize}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* RIGHT SLIDE-OVER DRAWER (Pola List -> Drawer per design.md)           */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {selectedItemForDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItemForDrawer(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-full max-w-md bg-[var(--card)] h-full border-l border-[var(--border)] shadow-2xl z-10 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-[var(--border)] flex items-start justify-between bg-[var(--muted)]/20">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-[#0F5C56]/10 text-[#0F5C56]">
                    {selectedItemForDrawer.code}
                  </span>
                  <h3 className="text-base font-bold font-display text-[var(--foreground)] mt-1.5 leading-snug">
                    {selectedItemForDrawer.name}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {selectedItemForDrawer.category}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItemForDrawer(null)}
                  className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                
                {/* Rincian Finansial & Master */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-[var(--muted)]/40 rounded-xl border border-[var(--border)] text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)]">Harga Satuan (FPA)</span>
                    <p className="font-mono font-bold text-sm text-[var(--foreground)] mt-0.5">
                      {formatRupiah(selectedItemForDrawer.price_est)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)]">Satuan / Pack</span>
                    <p className="font-medium text-[var(--foreground)] mt-0.5 uppercase">
                      {selectedItemForDrawer.unit} (Isi {selectedItemForDrawer.pack_qty})
                    </p>
                  </div>
                  {selectedItemForDrawer.coa && (
                    <div className="col-span-2 pt-2 border-t border-[var(--border)]">
                      <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)]">Chart of Accounts (COA)</span>
                      <p className="font-mono text-xs text-[var(--foreground)] mt-0.5">
                        {selectedItemForDrawer.coa}
                      </p>
                    </div>
                  )}
                </div>

                {/* Stok Fisik Berjalan per Site */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Stok Fisik Saat Ini
                  </h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    {['LBCT', 'IDMG', 'SPCT'].map(st => {
                      const count = stocks[st]?.[selectedItemForDrawer.id] || 0;
                      return (
                        <div key={st} className="p-3 bg-[var(--background)] rounded-xl border border-[var(--border)] text-center">
                          <span className="text-[10px] font-bold text-[var(--muted-foreground)]">{st}</span>
                          <p className={`font-mono font-bold text-lg mt-0.5 ${
                            count > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {count}
                          </p>
                          <span className="text-[10px] text-[var(--muted-foreground)] uppercase">{selectedItemForDrawer.unit}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Aksi Cepat Item Ini */}
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Aksi Cepat untuk Item Ini
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setUsageForm(prev => ({ ...prev, item_id: selectedItemForDrawer.id }));
                        setIsUsageModalOpen(true);
                        setSelectedItemForDrawer(null);
                      }}
                      className="p-2.5 bg-[var(--background)] hover:bg-[var(--muted)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--foreground)] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#0F5C56]" />
                      Catat Pakai
                    </button>

                    <button
                      onClick={() => {
                        setStockInForm(prev => ({ ...prev, item_id: selectedItemForDrawer.id }));
                        setIsStockInModalOpen(true);
                        setSelectedItemForDrawer(null);
                      }}
                      className="p-2.5 bg-[var(--background)] hover:bg-[var(--muted)] border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--foreground)] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Truck className="w-3.5 h-3.5 text-[#0F5C56]" />
                      Tambah Stok
                    </button>
                  </div>
                </div>

                {/* Riwayat Pemakaian Item Ini */}
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Riwayat Transaksi Terakhir
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {usages.filter(u => u.item_id === selectedItemForDrawer.id).slice(0, 5).map(u => (
                      <div key={u.id} className="p-2 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)] text-xs flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-[#0F5C56]">{u.site}</span>
                          <span className="text-[10px] text-[var(--muted-foreground)] ml-2">{u.date}</span>
                        </div>
                        <span className="font-mono font-bold text-rose-600">-{u.qty} {selectedItemForDrawer.unit}</span>
                      </div>
                    ))}
                    {usages.filter(u => u.item_id === selectedItemForDrawer.id).length === 0 && (
                      <p className="text-xs text-[var(--muted-foreground)] italic py-2">
                        Belum ada riwayat pemakaian untuk item ini.
                      </p>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ==================================================================== */}
      {/* MODAL 1: FORM PENCATATAN PEMAKAIAN (Searchable Dropdown)             */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isUsageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUsageModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[var(--card)] w-full max-w-lg rounded-2xl border border-[var(--border)] shadow-2xl p-6 z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#0F5C56]/10 text-[#0F5C56]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold font-display text-[var(--foreground)]">
                    Catat Pemakaian Harian
                  </h3>
                </div>
                <button 
                  onClick={() => setIsUsageModalOpen(false)} 
                  className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)] transition-colors active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveUsage} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Site Mess</label>
                    <CustomSelect
                      value={usageForm.site}
                      onChange={(val) => setUsageForm({ ...usageForm, site: val })}
                      options={SITE_OPTIONS}
                      searchable={false}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={usageForm.date}
                      onChange={(e) => setUsageForm({ ...usageForm, date: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-[var(--muted-foreground)]">Pilih Barang BHP</label>
                  <CustomSelect
                    value={usageForm.item_id}
                    onChange={(val) => setUsageForm({ ...usageForm, item_id: val })}
                    options={itemSelectOptions}
                    placeholder="Ketik untuk mencari dari 139 barang..."
                    className="mt-1"
                    searchPlaceholder="Cari nama barang atau kode BHP..."
                  />
                </div>

                <div>
                  <label className="font-semibold text-[var(--muted-foreground)]">Jumlah Pemakaian (Pcs / Unit)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={usageForm.qty}
                    onChange={(e) => setUsageForm({ ...usageForm, qty: e.target.value })}
                    placeholder="Contoh: 5"
                    className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--foreground)] font-mono focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[var(--muted-foreground)]">Catatan / Peruntukan</label>
                  <input
                    type="text"
                    value={usageForm.notes}
                    onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })}
                    placeholder="Contoh: Kebutuhan mess VIP & ruang makan"
                    className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsUsageModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-all active:scale-95"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#0F5C56] hover:bg-[#0D4E49] text-white font-semibold shadow-xs transition-all active:scale-95"
                  >
                    Simpan Pemakaian
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* MODAL 2: FORM PENERIMAAN BARANG BATCH MULTI-ITEM (No PO requirement) */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isStockInModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsStockInModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[var(--card)] w-full max-w-3xl rounded-2xl border border-[var(--border)] shadow-2xl p-6 z-10 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#0F5C56]/10 text-[#0F5C56]">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-display text-[var(--foreground)]">
                      Pencatatan Penerimaan Barang Masuk
                    </h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Input kedatangan stok barang ke mess — bisa langsung banyak item sekaligus tanpa nomor PO.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsStockInModalOpen(false)} 
                  className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)] transition-colors active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStockIn} className="space-y-4 text-xs">
                {/* Site, Tanggal, Sumber Info (No PO Required) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[var(--muted)]/20 p-3.5 rounded-xl border border-[var(--border)]">
                  <div>
                    <label className="font-semibold text-[var(--foreground)] block mb-1">Site Penerima</label>
                    <CustomSelect
                      value={stockInForm.site}
                      onChange={(val) => setStockInForm({ ...stockInForm, site: val })}
                      options={SITE_OPTIONS}
                      searchable={false}
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--foreground)] block mb-1">Tanggal Terima</label>
                    <input
                      type="date"
                      required
                      value={stockInForm.date}
                      onChange={(e) => setStockInForm({ ...stockInForm, date: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-[var(--foreground)] block mb-1">Sumber / Pengirim (Opsional)</label>
                    <input
                      type="text"
                      value={stockInForm.source}
                      onChange={(e) => setStockInForm({ ...stockInForm, source: e.target.value })}
                      placeholder="Contoh: Gudang Pusat / Vendor"
                      className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
                    />
                  </div>
                </div>

                {/* Multi-Item Table Entry */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-xs text-[var(--foreground)] flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#0F5C56]" />
                      Daftar Item Barang yang Diterima ({stockInForm.items.length} item)
                    </label>
                    <button
                      type="button"
                      onClick={handleAddStockInRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0F5C56] bg-[#0F5C56]/10 hover:bg-[#0F5C56]/20 rounded-xl transition-all shadow-xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Baris Barang
                    </button>
                  </div>

                  <div className="border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--muted)]/60 text-[var(--muted-foreground)] border-b border-[var(--border)] font-semibold text-[11px] uppercase">
                        <tr>
                          <th className="py-2.5 px-3 w-8 text-center">#</th>
                          <th className="py-2.5 px-3 min-w-[230px]">Pilih Barang BHP (139 SKU)</th>
                          <th className="py-2.5 px-3 w-28">Qty Diterima</th>
                          <th className="py-2.5 px-3 w-24">Satuan</th>
                          <th className="py-2.5 px-3">Keterangan Baris</th>
                          <th className="py-2.5 px-3 w-10 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] bg-[var(--card)]">
                        {stockInForm.items.map((row, idx) => {
                          const selectedItem = items.find(it => it.id === row.item_id);
                          return (
                            <tr key={idx} className="hover:bg-[var(--muted)]/20 transition-colors">
                              <td className="py-2.5 px-3 text-center font-mono text-[var(--muted-foreground)]">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <CustomSelect
                                  value={row.item_id}
                                  onChange={(val) => handleUpdateStockInRow(idx, 'item_id', val)}
                                  options={itemSelectOptions}
                                  placeholder="Ketik cari dari 139 item..."
                                  searchPlaceholder="Cari nama barang atau kode BHP..."
                                  buttonClassName="py-1.5"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={row.qty}
                                  onChange={(e) => handleUpdateStockInRow(idx, 'qty', e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] font-mono font-bold text-center focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
                                  placeholder="1"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-1 rounded-md bg-[var(--muted)] font-mono text-[11px] font-semibold text-[var(--foreground)] block text-center truncate border border-[var(--border)]">
                                  {selectedItem?.unit || '-'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={row.notes}
                                  onChange={(e) => handleUpdateStockInRow(idx, 'notes', e.target.value)}
                                  placeholder="Opsional (mis: kondisi baik)"
                                  className="w-full px-2.5 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  disabled={stockInForm.items.length <= 1}
                                  onClick={() => handleRemoveStockInRow(idx)}
                                  className="p-1 rounded-lg text-[var(--muted-foreground)] hover:text-rose-600 hover:bg-rose-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-95"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Modal Footer with Summary & Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--border)]">
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Total: <strong className="text-[var(--foreground)] font-mono">{stockInForm.items.reduce((s, r) => s + Number(r.qty || 0), 0)} unit</strong> dari <strong className="text-[var(--foreground)] font-mono">{stockInForm.items.length} item</strong> akan ditambahkan ke stok Site <strong className="text-[#0F5C56]">{stockInForm.site}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsStockInModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-all active:scale-95"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#0F5C56] hover:bg-[#0D4E49] text-white font-semibold shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      Simpan Penerimaan
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* MODAL 3: DOUBLE-SIGNATURE VERIFICATION UNTUK UNDUH REKAP PDF         */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isPdfModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPdfModalOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[var(--card)] w-full max-w-lg rounded-2xl border border-[var(--border)] shadow-2xl p-6 z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#C4841F]" />
                  <h3 className="text-base font-bold font-display text-[var(--foreground)]">
                    Verifikasi Tanda Tangan PDF
                  </h3>
                </div>
                <button onClick={() => setIsPdfModalOpen(false)} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Dokumen Rekap Resmi AGM-HCGA mewajibkan pencantuman nama pejabat pembuat dan penyetuju untuk keperluan audit:
              </p>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="font-semibold text-[var(--foreground)] block mb-1">
                    Dibuat Oleh (GA Admin / Staff Pembuat) <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={signerAdminName}
                    onChange={(val) => {
                      setSignerAdminName(val);
                      localStorage.setItem('bhp_signer_admin', val);
                    }}
                    options={employeeSelectOptions}
                    placeholder="Pilih karyawan pembuat dokumen..."
                    searchPlaceholder="Cari nama karyawan aktif atau NIK..."
                    className="mt-1"
                  />
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                    Dipilih dari daftar karyawan aktif terdaftar di sistem.
                  </p>
                </div>

                <div>
                  <label className="font-semibold text-[var(--foreground)] block mb-1">
                    Disetujui Oleh (GA GL / Pimpinan Penyetuju) <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={signerGlName}
                    onChange={(val) => {
                      setSignerGlName(val);
                      localStorage.setItem('bhp_signer_gl', val);
                    }}
                    options={employeeSelectOptions}
                    placeholder="Pilih penanggung jawab / GL..."
                    searchPlaceholder="Cari nama karyawan aktif atau NIK..."
                    className="mt-1"
                  />
                  <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                    Pejabat pengesah dokumen rekapitulasi kebutuhan BHP.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] text-xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="px-5 py-2 rounded-lg bg-[#C4841F] hover:bg-[#A6690E] text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <FileDown className="w-4 h-4" />
                  Buka & Cetak PDF Resmi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* MODAL 4: DETAIL RUMUS PERHITUNGAN STEP-BY-STEP PER ITEM BHP         */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {selectedForecastDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedForecastDetail(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[var(--card)] w-full max-w-2xl rounded-2xl border border-[var(--border)] shadow-2xl p-6 z-10 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              {/* Header Modal */}
              <div className="flex items-start justify-between border-b border-[var(--border)] pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#0F5C56]/10 text-[#0F5C56]">
                      {selectedForecastDetail.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      selectedForecastDetail.is_mandays
                        ? 'bg-[#0F5C56]/10 text-[#0F5C56]'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    }`}>
                      {selectedForecastDetail.is_mandays ? 'Model Mandays Dependent' : 'Model Maintenance Area Statis'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold font-display text-[var(--foreground)] mt-1.5 leading-snug">
                    {selectedForecastDetail.name}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {selectedForecastDetail.category} • Stok Fisik: <strong className="text-[var(--foreground)] font-mono">{selectedForecastDetail.current_stock} {selectedForecastDetail.unit}</strong> • Harga: <strong className="text-[#0F5C56] font-mono">{formatRupiah(selectedForecastDetail.price_est)}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedForecastDetail(null)}
                  className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step-by-Step Mathematical Transparency */}
              <div className="space-y-4 text-xs">
                
                {/* TAHAP 1: Base Forecast */}
                <div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--border)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#0F5C56] text-white flex items-center justify-center text-[10px] font-bold">1</span>
                      Tahap 1: Perhitungan Base Forecast ({selectedForecastDetail.is_mandays ? 'Pendekatan Mandays' : 'Baseline Statis Mess'})
                    </span>
                    <span className="font-mono font-bold text-[#0F5C56]">
                      BF = {selectedForecastDetail.base_forecast} {selectedForecastDetail.unit}
                    </span>
                  </div>

                  {selectedForecastDetail.is_mandays ? (
                    <div className="space-y-1.5 text-[11px] text-[var(--muted-foreground)] bg-[var(--card)] p-3 rounded-lg border border-[var(--border)] font-mono">
                      <p>
                        <strong>1.1 Mandays Historis:</strong> ({selectedForecastDetail.breakdown_context.histResident} T × {mandaysParams.histDays}h) + ({selectedForecastDetail.breakdown_context.histVisitor} V × {selectedForecastDetail.breakdown_context.histVisitorStay}h) = <strong>{selectedForecastDetail.breakdown_context.histMandays.toLocaleString('id-ID')} Mandays</strong>
                      </p>
                      <p>
                        <strong>1.2 Consumption Rate (CR):</strong> {selectedForecastDetail.total_used_hist} {selectedForecastDetail.unit} / {selectedForecastDetail.breakdown_context.histMandays.toLocaleString('id-ID')} = <strong>{selectedForecastDetail.consumption_rate.toFixed(5)} {selectedForecastDetail.unit}/manday</strong>
                      </p>
                      <p>
                        <strong>1.3 Mandays Bulan Depan:</strong> ({selectedForecastDetail.breakdown_context.nextResident} T × 30h) + ({selectedForecastDetail.breakdown_context.nextVisitor} V × {selectedForecastDetail.breakdown_context.nextVisitorStay}h) = <strong>{selectedForecastDetail.breakdown_context.nextMandays.toLocaleString('id-ID')} Mandays</strong>
                      </p>
                      <p className="text-[var(--foreground)] pt-1 border-t border-[var(--border)]">
                        <strong>1.4 Base Forecast (BF):</strong> {selectedForecastDetail.breakdown_context.nextMandays.toLocaleString('id-ID')} × {selectedForecastDetail.consumption_rate.toFixed(5)} = <strong>{selectedForecastDetail.base_forecast} {selectedForecastDetail.unit}</strong>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-[11px] text-[var(--muted-foreground)] bg-[var(--card)] p-3 rounded-lg border border-[var(--border)] font-mono">
                      <p>
                        <strong>Aturan Maintenance Area:</strong> Kebutuhan area gedung tidak dipengaruhi fluktuasi penghuni (statis historis).
                      </p>
                      <p>
                        <strong>Total Pemakaian Historis:</strong> {selectedForecastDetail.total_used_hist} {selectedForecastDetail.unit} selama {mandaysParams.histDays} hari.
                      </p>
                      <p className="text-[var(--foreground)] pt-1 border-t border-[var(--border)]">
                        <strong>Base Forecast (BF):</strong> {selectedForecastDetail.total_used_hist} × (30 / {mandaysParams.histDays}) = <strong>{selectedForecastDetail.base_forecast} {selectedForecastDetail.unit}</strong>
                      </p>
                    </div>
                  )}
                </div>

                {/* TAHAP 2: Safety Stock */}
                <div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--border)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#C4841F] text-white flex items-center justify-center text-[10px] font-bold">2</span>
                      Tahap 2: Perhitungan Safety Stock (Manajemen Risiko Lonjakan)
                    </span>
                    <span className="font-mono font-bold text-[#C4841F]">
                      SS = +{selectedForecastDetail.safety_stock} {selectedForecastDetail.unit}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-[var(--muted-foreground)] bg-[var(--card)] p-3 rounded-lg border border-[var(--border)] font-mono">
                    <p>
                      <strong>Rumus:</strong> Safety Stock = Z-Score × Standar Deviasi (σ) × √(Lead Time L)
                    </p>
                    <p>
                      <strong>2.1 Standar Deviasi (σ):</strong> {selectedForecastDetail.std_dev} {selectedForecastDetail.unit} (fluktuasi konsumsi aktual)
                    </p>
                    <p>
                      <strong>2.2 Z-Score (Service Level 95%):</strong> {selectedForecastDetail.breakdown_context.zScore}
                    </p>
                    <p>
                      <strong>2.3 Lead Time (L):</strong> {selectedForecastDetail.breakdown_context.leadTime} hari (√{selectedForecastDetail.breakdown_context.leadTime} ≈ {selectedForecastDetail.breakdown_context.sqrtLeadTime})
                    </p>
                    <p className="text-[var(--foreground)] pt-1 border-t border-[var(--border)]">
                      <strong>Hasil Safety Stock:</strong> {selectedForecastDetail.breakdown_context.zScore} × {selectedForecastDetail.std_dev} × {selectedForecastDetail.breakdown_context.sqrtLeadTime} = <strong>+{selectedForecastDetail.safety_stock} {selectedForecastDetail.unit}</strong>
                    </p>
                  </div>
                </div>

                {/* TAHAP 3: Final Order */}
                <div className="p-4 bg-[var(--background)] rounded-xl border border-[var(--border)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                      Tahap 3: Kalkulasi Final Order & Rekomendasi Pengadaan
                    </span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">
                      {selectedForecastDetail.final_order} {selectedForecastDetail.unit} ({selectedForecastDetail.recommended_packs} {selectedForecastDetail.pack_unit})
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-[var(--muted-foreground)] bg-[var(--card)] p-3 rounded-lg border border-[var(--border)] font-mono">
                    <p>
                      <strong>Rumus:</strong> Final Order = (Base Forecast + Safety Stock) - Sisa Stok Saat Ini
                    </p>
                    <p>
                      <strong>Substitusi:</strong> ({selectedForecastDetail.base_forecast} + {selectedForecastDetail.safety_stock}) - {selectedForecastDetail.current_stock} = <strong>{selectedForecastDetail.gross_order} {selectedForecastDetail.unit}</strong>
                    </p>
                    <p>
                      <strong>Aturan Non-Negatif:</strong> max(0, {selectedForecastDetail.gross_order}) = <strong>{selectedForecastDetail.final_order} {selectedForecastDetail.unit}</strong>
                    </p>
                    <p>
                      <strong>Kemasan Pengadaan:</strong> Isi {selectedForecastDetail.pack_qty} {selectedForecastDetail.unit}/{selectedForecastDetail.pack_unit} → ⌈{selectedForecastDetail.final_order} / {selectedForecastDetail.pack_qty}⌉ = <strong>{selectedForecastDetail.recommended_packs} {selectedForecastDetail.pack_unit}</strong> ({selectedForecastDetail.recommended_qty_pcs} {selectedForecastDetail.unit})
                    </p>
                    <p className="text-[var(--foreground)] pt-1 border-t border-[var(--border)] text-xs font-bold text-[#0F5C56]">
                      Estimasi Total Biaya: {selectedForecastDetail.recommended_qty_pcs} × {formatRupiah(selectedForecastDetail.price_est)} = {formatRupiah(selectedForecastDetail.total_cost)}
                    </p>
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setSelectedForecastDetail(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--muted)] hover:bg-[var(--border)] text-[var(--foreground)] font-semibold text-xs transition-colors"
                >
                  Tutup Breakdown
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* MODAL 5: PENGATURAN PARAMETER HEADCOUNT OKUPANSI & LEAD TIME        */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isConfigModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfigModalOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[var(--card)] w-full max-w-xl rounded-2xl border border-[var(--border)] shadow-2xl p-6 z-10 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-[#0F5C56]" />
                  <div>
                    <h3 className="text-base font-bold font-display text-[var(--foreground)]">
                      Pengaturan Parameter Mandays & Mitigasi Risiko
                    </h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Sesuaikan variabel input headcount mess dan parameter lead time untuk kalkulasi forecast.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Section A: Headcount Historis */}
                <div className="bg-[var(--muted)]/20 p-3.5 rounded-xl border border-[var(--border)] space-y-3">
                  <h4 className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#0F5C56]" />
                    1. Data Headcount Periode Historis
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted-foreground)]">Penghuni Tetap</label>
                      <input
                        type="number"
                        min="0"
                        value={mandaysParams.histResidentCount}
                        onChange={(e) => setMandaysParams({ ...mandaysParams, histResidentCount: Number(e.target.value) })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg font-mono text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted-foreground)]">Jumlah Hari</label>
                      <input
                        type="number"
                        min="1"
                        value={mandaysParams.histDays}
                        onChange={(e) => setMandaysParams({ ...mandaysParams, histDays: Number(e.target.value) })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg font-mono text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted-foreground)]">Total Visitor</label>
                      <input
                        type="number"
                        min="0"
                        value={mandaysParams.histVisitorCount}
                        onChange={(e) => setMandaysParams({ ...mandaysParams, histVisitorCount: Number(e.target.value) })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg font-mono text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted-foreground)]">Avg Lama Inap (Hari)</label>
                      <input
                        type="number"
                        min="1"
                        value={mandaysParams.histVisitorAvgStay}
                        onChange={(e) => setMandaysParams({ ...mandaysParams, histVisitorAvgStay: Number(e.target.value) })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg font-mono text-[var(--foreground)]"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-[#0F5C56]">
                    = Mandays Historis: <strong>{mandaysMetrics.totalHistMandays.toLocaleString('id-ID')} Mandays</strong>
                  </div>
                </div>

                {/* Section B: Estimasi Bulan Depan */}
                <div className="bg-[var(--muted)]/20 p-3.5 rounded-xl border border-[var(--border)] space-y-3">
                  <h4 className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C4841F]" />
                    2. Estimasi Headcount 1 Bulan ke Depan
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted-foreground)]">Penghuni Tetap Next (30 Hari)</label>
                      <input
                        type="number"
                        min="0"
                        value={mandaysParams.nextResidentCount}
                        onChange={(e) => setMandaysParams({ ...mandaysParams, nextResidentCount: Number(e.target.value) })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg font-mono text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted-foreground)]">Estimasi Visitor Next</label>
                      <input
                        type="number"
                        min="0"
                        value={mandaysParams.nextVisitorCount}
                        onChange={(e) => setMandaysParams({ ...mandaysParams, nextVisitorCount: Number(e.target.value) })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg font-mono text-[var(--foreground)]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted-foreground)]">Estimasi Lama Inap (Hari)</label>
                      <input
                        type="number"
                        min="1"
                        value={mandaysParams.nextVisitorAvgStay}
                        onChange={(e) => setMandaysParams({ ...mandaysParams, nextVisitorAvgStay: Number(e.target.value) })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg font-mono text-[var(--foreground)]"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-[#0F5C56]">
                    = Estimasi Mandays Next: <strong>{mandaysMetrics.totalNextMandays.toLocaleString('id-ID')} Mandays</strong> ({mandaysMetrics.mandaysGrowthPct >= 0 ? '+' : ''}{mandaysMetrics.mandaysGrowthPct.toFixed(1)}%)
                  </div>
                </div>

                {/* Section C: Risk & Procurement Parameters */}
                <div className="bg-[var(--muted)]/20 p-3.5 rounded-xl border border-[var(--border)] space-y-3">
                  <h4 className="font-bold text-[var(--foreground)] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0F5C56]" />
                    3. Manajemen Risiko & Pengadaan Supplier
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted-foreground)]">Lead Time Pengiriman (Hari)</label>
                      <input
                        type="number"
                        min="1"
                        value={mandaysParams.leadTimeDays}
                        onChange={(e) => setMandaysParams({ ...mandaysParams, leadTimeDays: Number(e.target.value) })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg font-mono text-[var(--foreground)]"
                      />
                      <span className="text-[10px] text-[var(--muted-foreground)] mt-0.5 block font-mono">
                        √L = {mandaysMetrics.sqrtLeadTime.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--muted-foreground)]">Service Level Z-Score</label>
                      <input
                        type="number"
                        step="0.01"
                        value={mandaysParams.zScore}
                        onChange={(e) => setMandaysParams({ ...mandaysParams, zScore: Number(e.target.value) })}
                        className="w-full mt-1 px-2.5 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg font-mono text-[var(--foreground)]"
                      />
                      <span className="text-[10px] text-[var(--muted-foreground)] mt-0.5 block font-mono">
                        1.65 = 95% Ketersediaan Aman
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    syncWithMessOccupancy(false);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-[var(--foreground)] bg-[var(--background)] hover:bg-[var(--muted)] border border-[var(--border)] rounded-xl transition-all"
                >
                  Reset dari Data Okupansi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfigModalOpen(false);
                    toast.success('Parameter Mandays & Safety Stock berhasil diperbarui!');
                  }}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0F5C56] hover:bg-[#0D4E49] rounded-xl transition-all shadow-xs"
                >
                  Terapkan Parameter
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
