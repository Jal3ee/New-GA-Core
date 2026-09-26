import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGlobalLoading } from '../../context/LoadingContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Search, Plus, ArrowRightLeft, ClipboardCheck,
  FileDown, X, ChevronRight, Truck, Clock,
  SlidersHorizontal, Building2, ShieldCheck, Check
} from 'lucide-react';
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

  // Tab 5: Forecast Search & Pagination
  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastPage, setForecastPage] = useState(1);
  const [forecastPageSize, setForecastPageSize] = useState(25);

  // Item Detail Drawer
  const [selectedItemForDrawer, setSelectedItemForDrawer] = useState(null);

  // Quick Transaction Modals
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Signer names for PDF Export
  const [signerAdminName, setSignerAdminName] = useState(() => {
    return localStorage.getItem('bhp_signer_admin') || (user?.name ? `${user.name} (GA Admin)` : 'Bagus Prasetyo (GA Admin)');
  });
  const [signerGlName, setSignerGlName] = useState(() => {
    return localStorage.getItem('bhp_signer_gl') || 'M. Rizky Ramadhan (GA GL)';
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
      .catch(() => {});
  }, []);

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
        subtext: `${it.category} • Total Stok: ${stock} ${it.unit} • Harga: ${formatRupiah(it.price_est)}`
      };
    });
  }, [items, stocks]);

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
  // TAB 5: FORECAST & REKAP KEBUTUHAN
  // --------------------------------------------------------------------------
  const allForecastRecommendations = useMemo(() => {
    const targetSites = selectedSite === 'ALL' ? ['LBCT', 'IDMG', 'SPCT'] : [selectedSite];

    return items.map(it => {
      let sumCurrentStock = 0;
      let sumDailyAvg = 0;

      targetSites.forEach(st => {
        const currentStock = stocks[st]?.[it.id] || 0;
        sumCurrentStock += currentStock;

        // Daily average calculated from actual recorded usages
        const siteUsages = usages.filter(u => u.site === st && u.item_id === it.id);
        const totalUsed = siteUsages.reduce((sum, u) => sum + Number(u.qty || 0), 0);
        const dailyAvg = siteUsages.length > 0 ? (totalUsed / Math.max(siteUsages.length, 7)) : 0;
        sumDailyAvg += dailyAvg;
      });

      const horizonDays = 28;
      const periodDemand = Math.round(sumDailyAvg * horizonDays);
      const safetyStock = Math.ceil(periodDemand * 0.05); // 5% safety margin
      const projectedStock = Math.max(0, sumCurrentStock - Math.round(sumDailyAvg * 10));
      const netNeeded = Math.max(0, (periodDemand + safetyStock) - projectedStock);
      
      const packQty = it.pack_qty || 1;
      const recommendedPacks = Math.ceil(netNeeded / packQty);
      const recommendedPcs = recommendedPacks * packQty;
      const totalCost = recommendedPcs * (it.price_est || 0);

      return {
        item_id: it.id,
        code: it.code,
        name: it.name,
        category: it.category,
        unit: it.unit,
        pack_qty: packQty,
        pack_unit: it.pack_unit,
        price_est: it.price_est,
        current_stock: sumCurrentStock,
        daily_avg: Number(sumDailyAvg.toFixed(1)),
        period_demand: periodDemand,
        safety_stock: safetyStock,
        recommended_qty_pcs: recommendedPcs,
        recommended_packs: recommendedPacks,
        total_cost: totalCost
      };
    });
  }, [items, stocks, usages, selectedSite]);

  const filteredForecastList = useMemo(() => {
    return allForecastRecommendations.filter(f => {
      const q = forecastSearch.toLowerCase().trim();
      return !q || (
        f.code.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    });
  }, [allForecastRecommendations, forecastSearch]);

  useEffect(() => {
    setForecastPage(1);
  }, [forecastSearch, selectedSite]);

  const paginatedForecastList = useMemo(() => {
    const start = (forecastPage - 1) * forecastPageSize;
    return filteredForecastList.slice(start, start + forecastPageSize);
  }, [filteredForecastList, forecastPage, forecastPageSize]);

  // Overall forecast metrics
  const forecastSummary = useMemo(() => {
    const totalOrderCost = allForecastRecommendations.reduce((acc, curr) => acc + (curr.total_cost || 0), 0);
    const totalPcs = allForecastRecommendations.reduce((acc, curr) => acc + (curr.recommended_qty_pcs || 0), 0);
    const itemsNeedingOrder = allForecastRecommendations.filter(f => f.recommended_qty_pcs > 0).length;
    return { totalOrderCost, totalPcs, itemsNeedingOrder };
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

  // Stock-In Form State
  const [stockInForm, setStockInForm] = useState({
    site: 'LBCT',
    date: new Date().toISOString().split('T')[0],
    item_id: items[0]?.id || 'BHP001',
    qty: '',
    ref_po: '',
    condition_status: 'Lengkap',
    notes: ''
  });

  const handleSaveStockIn = (e) => {
    e.preventDefault();
    if (!stockInForm.qty || Number(stockInForm.qty) <= 0) {
      return toast.warning('Jumlah penerimaan harus lebih dari 0');
    }

    const itemObj = items.find(it => it.id === stockInForm.item_id);
    const newRecord = {
      id: `RCV-${Date.now()}`,
      date: stockInForm.date,
      site: stockInForm.site,
      item_id: stockInForm.item_id,
      item_name: itemObj?.name || stockInForm.item_id,
      qty: Number(stockInForm.qty),
      ref_po: stockInForm.ref_po || 'SJ-PENGIRIMAN',
      condition_status: stockInForm.condition_status,
      receiver_name: user?.name || 'PIC Gudang',
      notes: stockInForm.notes
    };

    setStocks(prev => {
      const updated = { ...prev };
      const siteStock = { ...(updated[stockInForm.site] || {}) };
      siteStock[stockInForm.item_id] = (siteStock[stockInForm.item_id] || 0) + Number(stockInForm.qty);
      updated[stockInForm.site] = siteStock;
      return updated;
    });

    setStockIns(prev => [newRecord, ...prev]);

    savePgBhpStockIn({
      date: stockInForm.date,
      site: stockInForm.site,
      itemCode: stockInForm.item_id,
      qty: stockInForm.qty,
      refPo: stockInForm.ref_po,
      conditionStatus: stockInForm.condition_status,
      receiverName: user?.name || 'PIC Gudang',
      notes: stockInForm.notes
    }).catch(err => console.warn('[PG-Sync] Stock-In:', err.message));

    toast.success(`Penerimaan ${stockInForm.qty} ${itemObj?.unit || 'unit'} berhasil ditambahkan ke ${stockInForm.site}`);
    setIsStockInModalOpen(false);
    setStockInForm(prev => ({ ...prev, qty: '', ref_po: '', notes: '' }));
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
      
      {/* 1. Header Section - Minimalist & Clear */}
      <div className="bg-[var(--card)] p-5 md:p-6 rounded-2xl border border-[var(--border)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0F5C56]/10 text-[#0F5C56] border border-[#0F5C56]/20">
              BHP Mess • FPA September 2026
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              139 SKU Aktif
            </span>
          </div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)] tracking-tight">
            Barang Habis Pakai (BHP)
          </h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Pencatatan pemakaian harian, penerimaan stok, dan rekap rekomendasi pemesanan bulanan 3 site (LBCT, IDMG, SPCT).
          </p>
        </div>

        {/* Site Switcher & Action CTAs */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Site Filter Pills */}
          <div className="flex bg-[var(--muted)] p-1 rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setSelectedSite('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedSite === st
                    ? 'bg-[var(--card)] text-[#0F5C56] shadow-xs'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Quick Action CTAs */}
          <button
            onClick={() => setIsUsageModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-[#0F5C56] hover:bg-[#0D4E49] rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Catat Pemakaian
          </button>

          <button
            onClick={() => setIsStockInModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-[var(--foreground)] bg-[var(--card)] hover:bg-[var(--muted)] border border-[var(--border)] rounded-xl transition-all shadow-xs"
          >
            <Truck className="w-3.5 h-3.5 mr-1.5 text-[#0F5C56]" />
            Penerimaan Barang
          </button>

          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-[#C4841F] hover:bg-[#A6690E] rounded-xl transition-all shadow-xs"
          >
            <FileDown className="w-3.5 h-3.5 mr-1.5" />
            Unduh Rekap PDF
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

            {/* Filter Kategori & Status */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
              >
                <option value="ALL">Semua Kategori ({items.length})</option>
                {categoriesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
              >
                <option value="ALL">Semua Status Stok</option>
                <option value="aman">Stok Tersedia (&gt; 0)</option>
                <option value="restock">Stok Kosong (0)</option>
              </select>
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
                placeholder="Cari penerimaan (PO, nomor surat jalan, barang)..."
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
              />
            </div>

            <button
              onClick={() => setIsStockInModalOpen(true)}
              className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold text-white bg-[#0F5C56] hover:bg-[#0D4E49] rounded-xl transition-all shadow-xs shrink-0"
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
                  <th className="py-3 px-4">No. PO / Surat Jalan</th>
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
                    <td className="py-3 px-4 font-mono text-[var(--muted-foreground)]">{s.ref_po || '-'}</td>
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
                      <select
                        value={transferForm.from_site}
                        onChange={(e) => setTransferForm({ ...transferForm, from_site: e.target.value })}
                        className="w-full mt-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                      >
                        {['LBCT', 'IDMG', 'SPCT'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold text-[var(--muted-foreground)]">Ke Site Tujuan</label>
                      <select
                        value={transferForm.to_site}
                        onChange={(e) => setTransferForm({ ...transferForm, to_site: e.target.value })}
                        className="w-full mt-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                      >
                        {['LBCT', 'IDMG', 'SPCT'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
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
                      <select
                        value={opnameForm.site}
                        onChange={(e) => setOpnameForm({ ...opnameForm, site: e.target.value })}
                        className="w-full mt-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                      >
                        {['LBCT', 'IDMG', 'SPCT'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
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
      {/* TAB 5: FORECAST & REKAP KEBUTUHAN (Search & Pagination)              */}
      {/* ==================================================================== */}
      {activeTab === 'forecast' && (
        <div className="space-y-4">
          {/* Summary Metric Header */}
          <div className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">
                Kalkulasi Kebutuhan & Rekomendasi Pemesanan
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Proyeksi kebutuhan horizon 28 hari berbasis data historis pemakaian aktual dengan cadangan pengaman (safety stock 5%).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)]">Estimasi Total Biaya</span>
                <p className="text-base font-bold font-mono text-[#0F5C56]">
                  {formatRupiah(forecastSummary.totalOrderCost)}
                </p>
              </div>

              <button
                onClick={() => setIsPdfModalOpen(true)}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-[#C4841F] hover:bg-[#A6690E] rounded-xl transition-all shadow-xs shrink-0"
              >
                <FileDown className="w-4 h-4 mr-1.5" />
                Unduh Rekap PDF
              </button>
            </div>
          </div>

          {/* Search Bar for Forecast Table */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              value={forecastSearch}
              onChange={(e) => setForecastSearch(e.target.value)}
              placeholder="Cari kode atau nama barang dalam tabel rekomendasi..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
            />
          </div>

          {/* Paginated Forecast Table */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 w-24">Kode</th>
                    <th className="py-3 px-4">Nama Barang (FPA Sep 2026)</th>
                    <th className="py-3 px-4 text-center">Stok Saat Ini</th>
                    <th className="py-3 px-4 text-center">Avg Harian</th>
                    <th className="py-3 px-4 text-center">Kebutuhan 28 Hari</th>
                    <th className="py-3 px-4 text-center">Safety (5%)</th>
                    <th className="py-3 px-4 text-center font-bold text-[#0F5C56]">Rekomendasi Order</th>
                    <th className="py-3 px-4 text-right">Estimasi Biaya</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--foreground)]">
                  {paginatedForecastList.map((f) => (
                    <tr key={f.item_id} className="hover:bg-[var(--muted)]/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#0F5C56]">{f.code}</td>
                      <td className="py-3 px-4 font-medium max-w-sm">
                        <p className="line-clamp-2">{f.name}</p>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">{f.current_stock} {f.unit}</td>
                      <td className="py-3 px-4 text-center font-mono">{f.daily_avg}</td>
                      <td className="py-3 px-4 text-center font-mono">{f.period_demand}</td>
                      <td className="py-3 px-4 text-center font-mono">{f.safety_stock}</td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className="px-2.5 py-1 rounded-lg bg-[#0F5C56]/10 text-[#0F5C56] font-mono">
                          {f.recommended_packs} {f.pack_unit} ({f.recommended_qty_pcs} {f.unit})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        {formatRupiah(f.total_cost)}
                      </td>
                    </tr>
                  ))}

                  {paginatedForecastList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-[var(--muted-foreground)]">
                        Tidak ada barang yang cocok dengan pencarian "{forecastSearch}".
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
                <h3 className="text-base font-bold font-display text-[var(--foreground)]">
                  Catat Pemakaian Harian
                </h3>
                <button onClick={() => setIsUsageModalOpen(false)} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveUsage} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Site</label>
                    <select
                      value={usageForm.site}
                      onChange={(e) => setUsageForm({ ...usageForm, site: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                    >
                      {['LBCT', 'IDMG', 'SPCT'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Tanggal</label>
                    <input
                      type="date"
                      required
                      value={usageForm.date}
                      onChange={(e) => setUsageForm({ ...usageForm, date: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
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
                    className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[var(--muted-foreground)]">Catatan / Peruntukan</label>
                  <input
                    type="text"
                    value={usageForm.notes}
                    onChange={(e) => setUsageForm({ ...usageForm, notes: e.target.value })}
                    placeholder="Contoh: Kebutuhan mess VIP & ruang makan"
                    className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsUsageModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#0F5C56] hover:bg-[#0D4E49] text-white font-semibold"
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
      {/* MODAL 2: FORM PENERIMAAN BARANG (Searchable Dropdown)                 */}
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
              className="relative bg-[var(--card)] w-full max-w-lg rounded-2xl border border-[var(--border)] shadow-2xl p-6 z-10 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 className="text-base font-bold font-display text-[var(--foreground)]">
                  Pencatatan Penerimaan Barang Masuk
                </h3>
                <button onClick={() => setIsStockInModalOpen(false)} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStockIn} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Site Penerima</label>
                    <select
                      value={stockInForm.site}
                      onChange={(e) => setStockInForm({ ...stockInForm, site: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                    >
                      {['LBCT', 'IDMG', 'SPCT'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Tanggal Terima</label>
                    <input
                      type="date"
                      required
                      value={stockInForm.date}
                      onChange={(e) => setStockInForm({ ...stockInForm, date: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-[var(--muted-foreground)]">Pilih Barang BHP</label>
                  <CustomSelect
                    value={stockInForm.item_id}
                    onChange={(val) => setStockInForm({ ...stockInForm, item_id: val })}
                    options={itemSelectOptions}
                    placeholder="Ketik untuk mencari dari 139 barang..."
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">Jumlah Qty Diterima</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={stockInForm.qty}
                      onChange={(e) => setStockInForm({ ...stockInForm, qty: e.target.value })}
                      placeholder="Qty unit"
                      className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-[var(--muted-foreground)]">No. PO / Surat Jalan</label>
                    <input
                      type="text"
                      value={stockInForm.ref_po}
                      onChange={(e) => setStockInForm({ ...stockInForm, ref_po: e.target.value })}
                      placeholder="PO-2026-09-xxx"
                      className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsStockInModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#0F5C56] hover:bg-[#0D4E49] text-white font-semibold"
                  >
                    Simpan Penerimaan
                  </button>
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
              className="relative bg-[var(--card)] w-full max-w-md rounded-2xl border border-[var(--border)] shadow-2xl p-6 z-10 space-y-4"
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

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-[var(--muted-foreground)]">
                    Dibuat Oleh (GA Admin) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={signerAdminName}
                    onChange={(e) => setSignerAdminName(e.target.value)}
                    placeholder="Contoh: Bagus Prasetyo (GA Admin)"
                    className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[var(--muted-foreground)]">
                    Disetujui Oleh (GA GL) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={signerGlName}
                    onChange={(e) => setSignerGlName(e.target.value)}
                    placeholder="Contoh: M. Rizky Ramadhan (GA GL)"
                    className="w-full mt-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                  />
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

    </div>
  );
}
