import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  BedDouble,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Layers,
  ListTodo,
  Plane,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Utensils,
  XCircle
} from 'lucide-react';

import { api as gasClient } from '../lib/gasClient';
import CustomSelect from '../components/ui/CustomSelect';
import { calculateDaysRemaining, getStatusColorBadge } from '../lib/utils';
import { formatRupiah } from '../utils/reimbursementPdfCompiler';

// Default Catering Vendors for reference
const DEFAULT_CATERING_VENDORS = [
  { id: 'VEND-ABS', vendor_name: 'CV ABS', catering_name: 'Catering GAS', site: 'LBCT', target_score: 85 },
  { id: 'VEND-MOMS', vendor_name: 'CV Moms Ainun', catering_name: "Catering Mom's", site: 'IDMG', target_score: 85 },
  { id: 'VEND-SANDAGA', vendor_name: 'PT Sandaga Perkasa', catering_name: 'Catering Sandaga', site: 'SPCT', target_score: 85 },
  { id: 'VEND-MANGGALA', vendor_name: 'CV Manggala Raya', catering_name: 'Catering Manggala raya', site: 'LBCT', target_score: 85 }
];

// Default Tasks Checklist seed
const DEFAULT_TASKS = [
  { id: 'task-1', title: 'Rekap berkas cuti & nota Reimbursement Periode P1 ke Finance', category: 'Finance', due: '15 Sep 2026', completed: false },
  { id: 'task-2', title: 'Follow-up approval invoice catering & laundry ke Manager Dept', category: 'Invoicing', due: '16 Sep 2026', completed: true },
  { id: 'task-3', title: 'Inspeksi mingguan Food Index Catering Site LBCT (CV ABS)', category: 'Catering', due: '18 Sep 2026', completed: false },
  { id: 'task-4', title: 'Review evaluasi perpanjangan kontrak unit yang habis < 30 hari', category: 'Assets', due: '20 Sep 2026', completed: false },
  { id: 'task-5', title: 'Audit fisik ketersediaan ranjang mess & verifikasi roster cuti', category: 'Mess', due: '21 Sep 2026', completed: false }
];

export default function DashboardPage() {
  const [selectedSite, setSelectedSite] = useState('Semua');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Helper to read initial state from real local cache (persisted by gasClient / modules)
  const getCache = (key, fallback = []) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (parsed?.data && Array.isArray(parsed.data)) return parsed.data;
      }
    } catch {}
    return fallback;
  };

  // Real data states initialized from cache for instant zero-latency render
  const [invoices, setInvoices] = useState(() => getCache('garda_cache_GET_INVOICES', getCache('garda_invoices_data')));
  const [vendorContracts, setVendorContracts] = useState(() => getCache('garda_cache_GET_VENDOR_CONTRACTS'));
  const [unitContracts, setUnitContracts] = useState(() => getCache('garda_cache_GET_UNIT_CONTRACTS'));
  const [cateringVendors, setCateringVendors] = useState(() => getCache('garda_cache_GET_CATERING_VENDORS', getCache('garda_catering_vendors')));
  const [cateringScorings, setCateringScorings] = useState(() => getCache('garda_cache_GET_CATERING_SCORINGS', getCache('garda_catering_scorings')));
  const [messBuildings, setMessBuildings] = useState(() => getCache('garda_cache_GET_MESS_BUILDINGS'));
  const [messStays, setMessStays] = useState(() => getCache('garda_cache_GET_MESS_STAYS'));
  const [events, setEvents] = useState(() => getCache('garda_cache_GET_EVENTS'));
  const [ticketingRecords, setTicketingRecords] = useState(() => getCache('garda_cache_GET_TICKETING_RECORDS', getCache('garda_ticketing_db')));
  const [reimbursements, setReimbursements] = useState(() => getCache('garda_cache_GET_REIMBURSEMENTS', getCache('garda_reimbursements_data')));
  const [auditLogs, setAuditLogs] = useState(() => getCache('garda_cache_GET_AUDIT_LOGS'));

  // If we already have cached real records, don't block the screen with a skeleton
  const hasCachedData = invoices.length > 0 || ticketingRecords.length > 0 || unitContracts.length > 0;
  const [isLoading, setIsLoading] = useState(!hasCachedData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Local Task/Reminder checklist
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem('garda_dashboard_reminders');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TASKS;
  });
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('Umum');

  // Save tasks to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('garda_dashboard_reminders', JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  // Real-time clock updater
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch all real GA operations data in parallel directly from GAS spreadsheet database
  const fetchDashboardData = async (manualRefresh = false) => {
    if (manualRefresh) setIsRefreshing(true);
    else if (!hasCachedData) setIsLoading(true);

    try {
      const [
        invRes,
        vendRes,
        unitRes,
        catVendRes,
        catScorRes,
        bldRes,
        styRes,
        evtRes,
        reimbRes,
        tktRes,
        auditRes
      ] = await Promise.allSettled([
        gasClient.getInvoices(),
        gasClient.getVendorContracts(),
        gasClient.getUnitContracts(),
        gasClient.getCateringVendors(),
        gasClient.getCateringScorings(),
        gasClient.getMessBuildings(),
        gasClient.getMessStays(),
        gasClient.getEvents(),
        gasClient.getReimbursements(),
        gasClient.getTicketingRecords(),
        gasClient.getAuditLogs()
      ]);

      // 1. Invoices
      if (invRes.status === 'fulfilled' && invRes.value?.ok && Array.isArray(invRes.value.data)) {
        setInvoices(invRes.value.data);
      }

      // 2. Vendor Contracts
      if (vendRes.status === 'fulfilled' && vendRes.value?.ok && Array.isArray(vendRes.value.data)) {
        setVendorContracts(vendRes.value.data);
      }

      // 3. Unit Contracts
      if (unitRes.status === 'fulfilled' && unitRes.value?.ok && Array.isArray(unitRes.value.data)) {
        setUnitContracts(unitRes.value.data);
      }

      // 4. Catering Vendors & Scorings
      if (catVendRes.status === 'fulfilled' && catVendRes.value?.ok && Array.isArray(catVendRes.value.data)) {
        setCateringVendors(catVendRes.value.data);
      }
      if (catScorRes.status === 'fulfilled' && catScorRes.value?.ok && Array.isArray(catScorRes.value.data)) {
        setCateringScorings(catScorRes.value.data);
      } else {
        const localCat = getCache('garda_catering_scorings');
        if (localCat.length > 0) setCateringScorings(localCat);
      }

      // 5. Mess Buildings & Stays
      if (bldRes.status === 'fulfilled' && bldRes.value?.ok && Array.isArray(bldRes.value.data)) {
        setMessBuildings(bldRes.value.data);
      }
      if (styRes.status === 'fulfilled' && styRes.value?.ok && Array.isArray(styRes.value.data)) {
        setMessStays(styRes.value.data);
      }

      // 6. Events
      if (evtRes.status === 'fulfilled' && evtRes.value?.ok && Array.isArray(evtRes.value.data)) {
        setEvents(evtRes.value.data);
      }

      // 7. Reimbursements
      if (reimbRes.status === 'fulfilled' && reimbRes.value?.ok && Array.isArray(reimbRes.value.data) && reimbRes.value.data.length > 0) {
        setReimbursements(reimbRes.value.data);
      } else {
        const localReimb = getCache('garda_reimbursements_data');
        if (localReimb.length > 0) {
          setReimbursements(localReimb);
        } else {
          try {
            const fallbackMod = await import('../data/initialReimbursementData.json');
            setReimbursements(fallbackMod.default || []);
          } catch {}
        }
      }

      // 8. Ticketing Records
      if (tktRes.status === 'fulfilled' && tktRes.value?.ok && Array.isArray(tktRes.value.data) && tktRes.value.data.length > 0) {
        setTicketingRecords(tktRes.value.data);
      } else {
        const localTkt = getCache('garda_ticketing_db');
        if (localTkt.length > 0) {
          setTicketingRecords(localTkt);
        } else {
          try {
            const fallbackTkt = await import('../data/initialTicketingData.json');
            setTicketingRecords(fallbackTkt.default || []);
          } catch {}
        }
      }

      // 9. Audit Logs
      if (auditRes.status === 'fulfilled' && auditRes.value?.ok && Array.isArray(auditRes.value.data)) {
        setAuditLogs(auditRes.value.data);
      }

      if (manualRefresh) {
        toast.success('Data riil dashboard berhasil disinkronkan langsung dari Spreadsheet!');
      }

    } catch (err) {
      console.warn('Dashboard sync warning:', err);
      if (manualRefresh) toast.error('Gagal menyinkronkan: ' + err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filtered datasets by selected site
  const filteredInvoices = useMemo(() => {
    if (selectedSite === 'Semua') return invoices;
    return invoices.filter(i => (i.site || '').toLowerCase() === selectedSite.toLowerCase());
  }, [invoices, selectedSite]);

  const filteredVendorContracts = useMemo(() => {
    if (selectedSite === 'Semua') return vendorContracts;
    return vendorContracts.filter(c => (c.site || '').toLowerCase() === selectedSite.toLowerCase());
  }, [vendorContracts, selectedSite]);

  const filteredUnitContracts = useMemo(() => {
    if (selectedSite === 'Semua') return unitContracts;
    return unitContracts.filter(c => (c.site || '').toLowerCase() === selectedSite.toLowerCase());
  }, [unitContracts, selectedSite]);

  const filteredCatering = useMemo(() => {
    if (selectedSite === 'Semua') return cateringScorings;
    return cateringScorings.filter(s => (s.site || '').toLowerCase() === selectedSite.toLowerCase());
  }, [cateringScorings, selectedSite]);

  const filteredReimbursements = useMemo(() => {
    if (selectedSite === 'Semua') return reimbursements;
    return reimbursements.filter(r => (r.site || '').toLowerCase() === selectedSite.toLowerCase());
  }, [reimbursements, selectedSite]);

  // -------------------------------------------------------------
  // CALCULATED METRICS & EXECUTIVE KPIs
  // -------------------------------------------------------------

  // Financial Metrics: Invoices
  const invoiceFinancials = useMemo(() => {
    let totalNilai = 0;
    let openNilai = 0;
    let paidNilai = 0;
    let openCount = 0;
    let paidCount = 0;

    filteredInvoices.forEach(inv => {
      const num = typeof inv.nilai === 'number' ? inv.nilai : (Number(String(inv.nilai || '').replace(/\D/g, '')) || 0);
      totalNilai += num;
      if ((inv.status_pembayaran || '').toUpperCase() === 'PAID') {
        paidNilai += num;
        paidCount++;
      } else {
        openNilai += num;
        openCount++;
      }
    });

    return { totalNilai, openNilai, paidNilai, openCount, paidCount };
  }, [filteredInvoices]);

  // Financial Metrics: Reimbursement
  const reimbursementFinancials = useMemo(() => {
    let totalKlaim = 0;
    let cairKlaim = 0;
    let pendingKlaim = 0;
    let pendingCount = 0;

    filteredReimbursements.forEach(r => {
      const nom = Number(r.nominal || r['Total Biaya Keseluruhan']) || 0;
      totalKlaim += nom;
      if (r.status_finance === 'Dicairkan' || r.status === 'Selesai') {
        cairKlaim += nom;
      } else {
        pendingKlaim += nom;
        pendingCount++;
      }
    });

    return { totalKlaim, cairKlaim, pendingKlaim, pendingCount };
  }, [filteredReimbursements]);

  // Combined Financial Outstanding (Invoices Open + Pending Reimbursement)
  const totalOutstandingCommitments = invoiceFinancials.openNilai + reimbursementFinancials.pendingKlaim;

  // Contracts: Expiry analysis (< 30 days critical, 31-60 days warning)
  const allExpiringContracts = useMemo(() => {
    const list = [];
    filteredVendorContracts.forEach(vc => {
      const exp = vc.end_kontrak || vc.stnk_end;
      const days = calculateDaysRemaining(exp);
      if (days !== null && days <= 60 && vc.status !== 'Tidak Aktif') {
        list.push({
          id: vc.id,
          name: vc.nama_vendor,
          type: `Vendor: ${vc.jenis_kontrak || 'Layanan'}`,
          site: vc.site || 'Site',
          daysLeft: days,
          expiryDate: cleanFlightDate(exp),
          category: 'vendor'
        });
      }
    });

    filteredUnitContracts.forEach(uc => {
      const exp = uc.kontrak_berakhir || uc.stnk_end || uc.end_kontrak;
      const days = calculateDaysRemaining(exp);
      if (days !== null && days <= 60 && uc.status_unit !== 'Tidak Aktif') {
        list.push({
          id: uc.id,
          name: `${uc.no_lambung} (${uc.merk || uc.jenis_unit || 'Unit'})`,
          type: `Unit: ${uc.dept || uc.type || 'Kendaraan'}`,
          site: uc.site || 'Site',
          daysLeft: days,
          expiryDate: cleanFlightDate(exp),
          category: 'unit'
        });
      }
    });

    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [filteredVendorContracts, filteredUnitContracts]);

  const criticalContractAlerts = allExpiringContracts.filter(c => c.daysLeft <= 30);
  const warningContractAlerts = allExpiringContracts.filter(c => c.daysLeft > 30 && c.daysLeft <= 60);

  // Mess Live Status (Occupancy, Leave, ATC)
  const messOverview = useMemo(() => {
    let totalBeds = 0;
    const siteBreakdown = {
      LBCT: { total: 0, onsite: 0, leave: 0 },
      IDMG: { total: 0, onsite: 0, leave: 0 },
      SPCT: { total: 0, onsite: 0, leave: 0 }
    };

    messBuildings.forEach(b => {
      let config = b.room_config_json;
      if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch { config = []; }
      }
      if (!Array.isArray(config)) config = [];

      let bBeds = 0;
      config.forEach(c => {
        const start = parseInt(c.range_start) || 1;
        const end = parseInt(c.range_end) || start;
        const beds = parseInt(c.beds) || 1;
        bBeds += Math.max(0, (end - start + 1)) * beds;
      });

      const sSite = (b.site || '').toUpperCase();
      if (siteBreakdown[sSite]) {
        siteBreakdown[sSite].total += bBeds;
      }
      totalBeds += bBeds;
    });

    let totalOnsite = 0;
    let totalLeave = 0;
    messStays.forEach(s => {
      const sSite = (s.site || 'LBCT').toUpperCase();
      const st = (s.status || '').toLowerCase();
      if (st.includes('leave') || st.includes('cuti')) {
        totalLeave++;
        if (siteBreakdown[sSite]) siteBreakdown[sSite].leave++;
      } else {
        totalOnsite++;
        if (siteBreakdown[sSite]) siteBreakdown[sSite].onsite++;
      }
    });

    const totalTerisi = totalOnsite + totalLeave;
    const totalVacant = Math.max(0, totalBeds - totalTerisi);
    const overallPct = totalBeds > 0 ? Math.round((totalTerisi / totalBeds) * 100) : 0;

    return {
      totalBeds,
      totalTerisi,
      totalOnsite,
      totalLeave,
      totalVacant,
      overallPct,
      siteBreakdown
    };
  }, [messBuildings, messStays]);

  // Catering Food Index Summary
  const cateringOverview = useMemo(() => {
    const targetInspections = Math.max(4, (cateringVendors.length || 4) * 2);
    if (filteredCatering.length === 0) {
      return {
        avgScore: null,
        grade: 'Belum Ada Penilaian',
        completedInspections: 0,
        targetInspections,
        subStandardCount: 0,
        subStandardList: []
      };
    }
    const sum = filteredCatering.reduce((acc, c) => acc + (Number(c.food_index_percent) || 0), 0);
    const avg = (sum / filteredCatering.length).toFixed(1);
    const subStandard = filteredCatering.filter(c => (Number(c.food_index_percent) || 0) < 85);
    const grade = avg >= 90 ? 'Sangat Baik (A)' : avg >= 80 ? 'Baik (B)' : 'Cukup (C)';

    return {
      avgScore: avg,
      grade,
      completedInspections: filteredCatering.length,
      targetInspections,
      subStandardCount: subStandard.length,
      subStandardList: subStandard
    };
  }, [filteredCatering, cateringVendors]);

  // Clean date and time helper for flights and events
  const cleanFlightDate = (val) => {
    if (!val) return '-';
    if (typeof val === 'string' && val.includes('T')) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }
    return val;
  };

  const cleanFlightTime = (val) => {
    if (!val) return '';
    if (typeof val === 'string' && (val.includes('1899-') || val.includes('T'))) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      }
    }
    return String(val).slice(0, 5);
  };

  const cleanEventDate = (val) => {
    if (!val) return 'Jadwal Mendatang';
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    } catch {}
    return String(val);
  };

  // Upcoming Flights (Sorted by Departure Date from real ticketing records)
  const upcomingDepartures = useMemo(() => {
    if (!ticketingRecords || ticketingRecords.length === 0) return [];
    
    // Sort tickets: prioritize records with Departure Date
    const sorted = [...ticketingRecords].sort((a, b) => {
      const da = new Date(a['Departure Date'] || a['Booking Date Time'] || 0).getTime();
      const db = new Date(b['Departure Date'] || b['Booking Date Time'] || 0).getTime();
      return db - da; // most recent
    });

    return sorted.slice(0, 4).map((t, idx) => ({
      id: t.id || idx,
      name: `${t['First Name'] || ''} ${t['Last Name'] || ''}`.trim() || t['User Id'] || 'Karyawan',
      airline: t['Airline'] || 'Citilink',
      flight: t['Flight Number'] || '-',
      route: `${t['Origination'] || 'BDJ'} ➔ ${t['Destination'] || 'CGK'}`,
      date: cleanFlightDate(t['Departure Date']),
      time: cleanFlightTime(t['Departure Time']),
      pnr: t['Pnr Code'] || '-'
    }));
  }, [ticketingRecords]);

  // Upcoming Calendar Events from real database
  const upcomingCalendarEvents = useMemo(() => {
    if (!events || events.length === 0) return [];
    return events.slice(0, 4).map(e => ({
      id: e.id,
      title: e.title || 'Agenda GA',
      category: e.category || 'Operasional',
      status: e.status || 'Open',
      time: cleanEventDate(e.start_time)
    }));
  }, [events]);

  // Recently Closed / Selesai Milestones (Real paid invoices, real closed events, real logs)
  const recentlyClosedMilestones = useMemo(() => {
    const items = [];

    // 1. Real Paid invoices
    filteredInvoices
      .filter(i => (i.status_pembayaran || '').toUpperCase() === 'PAID')
      .slice(0, 2)
      .forEach(inv => {
        items.push({
          id: `inv-${inv.id}`,
          title: `Pembayaran Lunas: ${inv.vendor || 'Mitra'}`,
          category: 'Invoice Paid',
          amount: typeof inv.nilai === 'number' ? formatRupiah(inv.nilai) : (inv.nilai || 'Rp 0'),
          site: inv.site || 'IDMG',
          date: cleanFlightDate(inv.updated_at || inv.created_at || inv.tgl_berkas),
          status: 'Closed'
        });
      });

    // 2. Real Disbursed Reimbursements
    filteredReimbursements
      .filter(r => r.status_finance === 'Dicairkan' || r.status === 'Selesai')
      .slice(0, 2)
      .forEach(rm => {
        items.push({
          id: `rm-${rm.id || rm.No}`,
          title: `Pencairan Klaim: ${rm.nama || rm['Nama Lengkap']}`,
          category: 'Reimbursement Cair',
          amount: formatRupiah(rm.nominal || rm['Total Biaya Keseluruhan'] || 0),
          site: rm.site || rm.Site || 'LBCT',
          date: cleanFlightDate(rm.tgl_pencairan_finance || rm.created_at),
          status: 'Closed'
        });
      });

    // 3. Real Closed events
    events
      .filter(e => (e.status || '').toLowerCase() === 'closed')
      .slice(0, 2)
      .forEach(evt => {
        items.push({
          id: `evt-${evt.id}`,
          title: `Agenda Selesai: ${evt.title}`,
          category: evt.category || 'Event',
          amount: 'Selesai',
          site: 'All',
          date: cleanFlightDate(evt.end_time || evt.start_time),
          status: 'Closed'
        });
      });

    // 4. Real Completed catering audit
    filteredCatering
      .filter(c => (Number(c.food_index_percent) || 0) >= 85)
      .slice(0, 1)
      .forEach(cat => {
        items.push({
          id: `cat-${cat.id}`,
          title: `Audit Selesai: ${cat.vendor_name} (${cat.food_index_percent}%)`,
          category: 'Food Safety Passed',
          amount: cat.grade || 'Lulus',
          site: cat.site || 'Site',
          date: cleanFlightDate(cat.inspection_date),
          status: 'Closed'
        });
      });

    // 5. Recent verified audit logs if few milestones exist
    if (items.length < 3 && Array.isArray(auditLogs) && auditLogs.length > 0) {
      auditLogs
        .filter(l => l.action === 'UPDATE' || l.action === 'CREATE')
        .slice(0, 3 - items.length)
        .forEach(log => {
          items.push({
            id: `log-${log.id}`,
            title: `Aktivitas: ${log.action} ${log.resource?.replace('tbl_', '').replace(/_/g, ' ')}`,
            category: 'Audit Log',
            amount: String(log.user_email || '').split('@')[0] || 'GA User',
            site: 'GA Core',
            date: cleanFlightDate(log.timestamp),
            status: 'Closed'
          });
        });
    }

    return items;
  }, [filteredInvoices, filteredReimbursements, filteredCatering, events, auditLogs]);

  // Handlers for Task Checklist
  const handleToggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask = {
      id: `task-${Date.now()}`,
      title: newTaskText.trim(),
      category: newTaskCategory,
      due: 'Minggu Ini',
      completed: false
    };
    setTasks(prev => [newTask, ...prev]);
    setNewTaskText('');
    toast.success('Pengingat tugas berhasil ditambahkan!');
  };

  const handleDeleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Determine current active reimbursement cycle
  const currentDay = currentTime.getDate();
  const currentMonthName = currentTime.toLocaleString('id-ID', { month: 'long' });
  const activeCycleText = currentDay <= 15
    ? `Periode 1 (${currentMonthName} 1–15)`
    : `Periode 2 (${currentMonthName} 16–31)`;
  const daysToNextCutoff = currentDay <= 15 ? (15 - currentDay) : (30 - currentDay);

  // =============================================================
  // SKELETON LOADING STATE
  // =============================================================
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div className="space-y-2">
            <div className="h-7 w-72 bg-[var(--muted)] rounded-lg" />
            <div className="h-4 w-96 bg-[var(--muted)]/60 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-32 bg-[var(--muted)] rounded-lg" />
            <div className="h-9 w-36 bg-[var(--muted)] rounded-lg" />
          </div>
        </div>

        {/* Macro KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-3">
              <div className="h-3.5 w-28 bg-[var(--muted)] rounded" />
              <div className="h-7 w-40 bg-[var(--muted)] rounded" />
              <div className="h-3 w-48 bg-[var(--muted)]/60 rounded" />
            </div>
          ))}
        </div>

        {/* 2-Column Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="h-5 w-48 bg-[var(--muted)] rounded" />
            <div className="h-20 bg-[var(--muted)]/40 rounded-lg" />
            <div className="h-20 bg-[var(--muted)]/40 rounded-lg" />
            <div className="h-20 bg-[var(--muted)]/40 rounded-lg" />
          </div>
          <div className="h-96 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="h-5 w-36 bg-[var(--muted)] rounded" />
            <div className="h-16 bg-[var(--muted)]/40 rounded-lg" />
            <div className="h-16 bg-[var(--muted)]/40 rounded-lg" />
            <div className="h-16 bg-[var(--muted)]/40 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // =============================================================
  // MAIN EXECUTIVE DASHBOARD RENDER
  // =============================================================
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* -------------------------------------------------------------
          1. HEADER & EXECUTIVE CONTEXT BAR
      ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] font-display">
              Executive Summary & Operational Hub
            </h1>
          </div>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Monitoring real-time operasional lintas modul GA: Mess, Transport, Invoicing, Reimbursement, Catering, & Kontrak.
          </p>
        </div>

        {/* Top Control Strip */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Real-time Clock (WITA) */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-mono text-[var(--foreground)] shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>
              {currentTime.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', second: '2-digit' })} WITA
            </span>
          </div>

          {/* Cut-off Cycle Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--accent)]/30 bg-[var(--brass-50)] dark:bg-[var(--card)] text-[var(--accent)] text-xs font-medium shadow-2xs">
            <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{activeCycleText} • <strong>{daysToNextCutoff} hari</strong> lagi</span>
          </div>

          {/* Site Filter */}
          <div className="w-36">
            <CustomSelect
              icon={Building2}
              value={selectedSite}
              onChange={setSelectedSite}
              options={[
                { value: 'Semua', label: 'Semua Site' },
                { value: 'LBCT', label: 'Site LBCT' },
                { value: 'IDMG', label: 'Site IDMG' },
                { value: 'SPCT', label: 'Site SPCT' }
              ]}
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchDashboardData}
            className="p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors active:scale-95 shadow-2xs"
            title="Muat ulang seluruh data operasional"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          2. EXECUTIVE MACRO METRIC STRIP (4 Key Pillars)
      ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Financial Commitments */}
        <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[var(--accent)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Komitmen Keuangan Pending</span>
            <DollarSign className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--foreground)] mt-2">
            {formatRupiah(totalOutstandingCommitments)}
          </div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1.5 flex items-center justify-between">
            <span>{invoiceFinancials.openCount} Invoice Open</span>
            <span className="font-mono text-[var(--accent)]">{formatRupiah(invoiceFinancials.openNilai)}</span>
          </div>
          <div className="text-xs text-[var(--muted-foreground)] mt-0.5 flex items-center justify-between border-t border-[var(--border)]/60 pt-1">
            <span>{reimbursementFinancials.pendingCount} Klaim Reimburse</span>
            <span className="font-mono text-[var(--primary)]">{formatRupiah(reimbursementFinancials.pendingKlaim)}</span>
          </div>
        </div>

        {/* Pillar 2: Mess Live Occupancy */}
        <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-[var(--primary)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Okupansi Mess Hari Ini</span>
            <BedDouble className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="text-2xl font-bold font-mono text-[var(--foreground)]">
              {messOverview.overallPct}%
            </div>
            <span className="text-xs text-[var(--muted-foreground)] font-mono">
              ({messOverview.totalTerisi}/{messOverview.totalBeds} Ranjang)
            </span>
          </div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1.5 flex items-center justify-between">
            <span>Onsite: <strong className="text-[var(--foreground)]">{messOverview.totalOnsite}</strong></span>
            <span>Cuti: <strong className="text-[var(--accent)]">{messOverview.totalLeave}</strong></span>
            <span>Kosong (ATC): <strong className="text-emerald-700">{messOverview.totalVacant}</strong></span>
          </div>
          <div className="w-full bg-[var(--muted)] rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-[var(--primary)] h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, messOverview.overallPct)}%` }}
            />
          </div>
        </div>

        {/* Pillar 3: Active Fleet & Asset Contracts */}
        <div className={`bg-[var(--card)] border border-[var(--border)] border-l-4 ${criticalContractAlerts.length > 0 ? 'border-l-[var(--destructive)]' : 'border-l-emerald-600'} rounded-xl p-4 shadow-xs`}>
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Kontrak Aktif & Alert</span>
            <Truck className={`w-4 h-4 ${criticalContractAlerts.length > 0 ? 'text-[var(--destructive)]' : 'text-emerald-600'}`} />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--foreground)] mt-2">
            {filteredVendorContracts.length + filteredUnitContracts.length} <span className="text-xs font-normal text-[var(--muted-foreground)]">Kontrak</span>
          </div>
          <div className="text-xs mt-1.5 flex items-center justify-between">
            <span className="text-[var(--muted-foreground)]">Status Kedaluwarsa:</span>
            {criticalContractAlerts.length > 0 ? (
              <span className="inline-flex items-center gap-1 font-bold text-[var(--destructive)] font-mono">
                <AlertTriangle className="w-3 h-3" />
                {criticalContractAlerts.length} habis &lt;30 hari
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Aman (&gt;30 hari)
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--muted-foreground)] mt-0.5 flex items-center justify-between border-t border-[var(--border)]/60 pt-1">
            <span>Unit: {filteredUnitContracts.length} armada</span>
            <span>Vendor: {filteredVendorContracts.length} mitra</span>
          </div>
        </div>

        {/* Pillar 4: Catering Food Safety Index */}
        <div className="bg-[var(--card)] border border-[var(--border)] border-l-4 border-l-emerald-600 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold uppercase tracking-wider">Food Safety Index Katering</span>
            <Utensils className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            {cateringOverview.avgScore !== null ? (
              <>
                <div className="text-2xl font-bold font-mono text-emerald-700">
                  {cateringOverview.avgScore}%
                </div>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {cateringOverview.grade}
                </span>
              </>
            ) : (
              <>
                <div className="text-xl font-bold font-mono text-[var(--foreground)]">
                  {cateringVendors.length || 4} Vendor
                </div>
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Siap Inspeksi
                </span>
              </>
            )}
          </div>
          <div className="text-xs text-[var(--muted-foreground)] mt-1.5 flex items-center justify-between">
            <span>Audit Selesai Bulan Ini:</span>
            <span className="font-semibold text-[var(--foreground)]">
              {cateringOverview.completedInspections}/{cateringOverview.targetInspections}
            </span>
          </div>
          <div className="text-xs text-[var(--muted-foreground)] mt-0.5 flex items-center justify-between border-t border-[var(--border)]/60 pt-1">
            {cateringOverview.completedInspections > 0 ? (
              <>
                <span>Anomali Skor &lt; 85%:</span>
                <span className={cateringOverview.subStandardCount > 0 ? 'text-[var(--destructive)] font-bold' : 'text-emerald-700'}>
                  {cateringOverview.subStandardCount} vendor
                </span>
              </>
            ) : (
              <>
                <span>Katering Aktif:</span>
                <Link to="/catering/scoring" className="text-[var(--primary)] font-semibold hover:underline flex items-center gap-1">
                  Mulai Inspeksi &rarr;
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          3. CRITICAL ACTIONS & ANOMALIES ("Masalah Sesuatu & Belum Close")
      ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Contract Expiry Warnings & Urgent Invoices */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--destructive)]" />
              <h2 className="font-bold text-sm text-[var(--foreground)]">
                Perhatian: Kontrak & Tagihan Urgent
              </h2>
            </div>
            <span className="text-xs font-mono bg-red-50 text-[var(--destructive)] border border-red-200 px-2 py-0.5 rounded-full font-semibold">
              {criticalContractAlerts.length + invoiceFinancials.openCount} Butuh Follow-up
            </span>
          </div>

          {/* Expiring Contracts List */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center justify-between">
              <span>Kontrak Berakhir &lt; 60 Hari</span>
              <Link to="/assets/vendor" className="text-[var(--primary)] hover:underline flex items-center gap-1 font-normal normal-case">
                Kelola Kontrak <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {allExpiringContracts.length === 0 ? (
              <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)]/20 p-3 rounded-lg text-center">
                Tidak ada kontrak yang akan berakhir dalam 60 hari ke depan.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {allExpiringContracts.map((c, idx) => {
                  const isCritical = c.daysLeft <= 30;
                  return (
                    <div
                      key={c.id || idx}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                        isCritical
                          ? 'border-red-200 bg-red-50/60 dark:bg-red-950/20 text-red-900 dark:text-red-300'
                          : 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300'
                      }`}
                    >
                      <div>
                        <div className="font-bold">{c.name}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">
                          {c.type} • Site <strong className="font-semibold">{c.site}</strong> • Exp: {c.expiryDate}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] shrink-0 border ${
                        isCritical ? 'bg-red-100 text-red-800 border-red-300' : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}>
                        Sisa {c.daysLeft} Hari
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Invoices Strip */}
          <div className="space-y-2 pt-2 border-t border-[var(--border)]">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center justify-between">
              <span>Invoice Belum Lunas (Open Status)</span>
              <Link to="/docs/invoice" className="text-[var(--primary)] hover:underline flex items-center gap-1 font-normal normal-case">
                Lihat Semua <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {filteredInvoices.filter(i => (i.status_pembayaran || '').toUpperCase() !== 'PAID').length === 0 ? (
                <div className="text-xs text-emerald-700 bg-emerald-50/60 border border-emerald-200 p-3 rounded-lg text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Semua invoice telah diproses / lunas (0 tagihan open).</span>
                </div>
              ) : (
                filteredInvoices.filter(i => (i.status_pembayaran || '').toUpperCase() !== 'PAID').slice(0, 3).map((inv, idx) => (
                  <div key={inv.id || idx} className="flex items-center justify-between p-2 rounded-lg bg-[var(--muted)]/30 border border-[var(--border)] text-xs">
                    <div>
                      <span className="font-semibold text-[var(--foreground)]">{inv.vendor}</span>
                      <span className="text-[11px] text-[var(--muted-foreground)] ml-2">Site {inv.site}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[var(--primary)]">{typeof inv.nilai === 'number' ? formatRupiah(inv.nilai) : inv.nilai}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                        Open
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Catering Anomalies & Operational Action Checklist */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="font-bold text-sm text-[var(--foreground)]">
                Roadmap &amp; Agenda Tindakan Minggu Ini
              </h2>
            </div>
            <span className="text-xs text-[var(--muted-foreground)] font-mono">
              {tasks.filter(t => t.completed).length}/{tasks.length} Selesai
            </span>
          </div>

          {/* Checklist Container */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {tasks.map(t => (
              <div
                key={t.id}
                onClick={() => handleToggleTask(t.id)}
                className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  t.completed
                    ? 'border-[var(--border)] bg-[var(--muted)]/20 opacity-60 line-through text-[var(--muted-foreground)]'
                    : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]/20 text-[var(--foreground)] shadow-2xs'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button className="mt-0.5 text-[var(--primary)] shrink-0">
                    {t.completed ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-[var(--muted-foreground)]" />}
                  </button>
                  <div>
                    <p className="font-medium leading-snug">{t.title}</p>
                    <div className="text-[10px] text-[var(--muted-foreground)] mt-1 flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-[var(--muted)] font-semibold">{t.category}</span>
                      <span>Target: {t.due}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTask(t.id);
                  }}
                  className="p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)] rounded transition-colors"
                  title="Hapus task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Quick Add Task Form */}
          <form onSubmit={handleAddTask} className="flex gap-2 pt-2 border-t border-[var(--border)]">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="Tambah agenda/reminder baru..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Simpan</span>
            </button>
          </form>
        </div>
      </div>

      {/* -------------------------------------------------------------
          4. LIVE MESS OPERATIONS & UPCOMING FLIGHT SCHEDULE
      ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mess Site Breakdown (LBCT, IDMG, SPCT) */}
        <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="font-bold text-sm text-[var(--foreground)]">
                Status Mess Real-Time per Site (Check-in / Leave / ATC)
              </h2>
            </div>
            <Link to="/mess/dashboard" className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1">
              Buka Mess Matrix <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['LBCT', 'IDMG', 'SPCT'].map(sName => {
              const sData = messOverview.siteBreakdown[sName] || { total: 0, onsite: 0, leave: 0 };
              const sTerisi = sData.onsite + sData.leave;
              const sVacant = Math.max(0, sData.total - sTerisi);
              const sPct = sData.total > 0 ? Math.round((sTerisi / sData.total) * 100) : 0;

              return (
                <div key={sName} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[var(--foreground)] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                      Site {sName}
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--primary)]">{sPct}%</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-[var(--muted)] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[var(--primary)] h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, sPct)}%` }}
                    />
                  </div>

                  {sData.total > 0 ? (
                    <div className="grid grid-cols-3 gap-1 text-[11px] text-center pt-1">
                      <div className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)]">
                        <div className="text-[10px] text-[var(--muted-foreground)]">Onsite</div>
                        <div className="font-mono font-bold text-[var(--foreground)]">{sData.onsite}</div>
                      </div>
                      <div className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)]">
                        <div className="text-[10px] text-[var(--muted-foreground)]">Cuti</div>
                        <div className="font-mono font-bold text-[var(--accent)]">{sData.leave}</div>
                      </div>
                      <div className="p-1.5 rounded bg-[var(--card)] border border-[var(--border)]">
                        <div className="text-[10px] text-[var(--muted-foreground)]">ATC</div>
                        <div className="font-mono font-bold text-emerald-700">{sVacant}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[var(--muted-foreground)] text-center py-2 bg-[var(--card)] rounded border border-[var(--border)]">
                      Belum terdaftar di spreadsheet
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)]/20 p-3 rounded-lg flex items-center justify-between">
            <span>Kapasitas total ranjang terdaftar: <strong className="text-[var(--foreground)]">{messOverview.totalBeds} bed</strong></span>
            <span>Ranjang siap huni (ATC): <strong className="text-emerald-700">{messOverview.totalVacant} bed</strong></span>
          </div>
        </div>

        {/* Upcoming Flight Departures (Ticketing) */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <Plane className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="font-bold text-sm text-[var(--foreground)]">
                Keberangkatan Tiket Mendatang
              </h2>
            </div>
            <Link to="/transport/ticketing" className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1">
              Lihat Rute <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {upcomingDepartures.map(flight => (
              <div key={flight.id} className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-[var(--foreground)]">
                  <span>{flight.name}</span>
                  <span className="font-mono text-[var(--primary)]">{flight.route}</span>
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)] flex items-center justify-between">
                  <span>{flight.airline} ({flight.flight})</span>
                  <span className="font-mono">{flight.date} • {flight.time}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Calendar Upcoming Events */}
          <div className="pt-2 border-t border-[var(--border)] space-y-2">
            <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center justify-between">
              <span>Agenda Kalender Terdekat</span>
              <Link to="/calendar" className="text-[var(--primary)] hover:underline text-[11px] font-normal normal-case">
                Kalender Event &rarr;
              </Link>
            </div>
            <div className="space-y-1.5">
              {upcomingCalendarEvents.map(evt => (
                <div key={evt.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--muted)]/20 text-xs">
                  <span className="font-medium text-[var(--foreground)] truncate max-w-[180px]">{evt.title}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{evt.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          5. RECENTLY CLOSED MILESTONES & QUICK JUMP HUB
      ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recently Closed / Completed Milestones */}
        <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-[var(--foreground)]">
                Aktivitas &amp; Task yang Baru Saja Selesai (Closed)
              </h2>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
              Verified
            </span>
          </div>

          <div className="space-y-2">
            {recentlyClosedMilestones.length === 0 ? (
              <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)]/20 p-4 rounded-lg text-center">
                Belum ada aktivitas baru yang dicatat.
              </div>
            ) : (
              recentlyClosedMilestones.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/10 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--foreground)]">{m.title}</div>
                      <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                        {m.category} • Site {m.site} • {m.date}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-[var(--foreground)]">{m.amount}</div>
                    <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">Lunas / Selesai</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Quick Module Jump-Hub */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs space-y-3">
          <h2 className="font-bold text-sm text-[var(--foreground)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--primary)]" />
            Akses Cepat Modul GA
          </h2>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link
              to="/docs/reimbursement"
              className="p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5 transition-all text-[var(--foreground)] group"
            >
              <FileSpreadsheet className="w-4 h-4 text-[var(--primary)] mb-1 group-hover:scale-110 transition-transform" />
              <div className="font-bold">Reimbursement</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">Klaim &amp; Cut-off</div>
            </Link>

            <Link
              to="/catering/scoring"
              className="p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5 transition-all text-[var(--foreground)] group"
            >
              <Utensils className="w-4 h-4 text-[var(--accent)] mb-1 group-hover:scale-110 transition-transform" />
              <div className="font-bold">Food Index</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">Inspeksi Katering</div>
            </Link>

            <Link
              to="/mess/dashboard"
              className="p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5 transition-all text-[var(--foreground)] group"
            >
              <BedDouble className="w-4 h-4 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
              <div className="font-bold">Mess Camp</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">Okupansi &amp; Bed</div>
            </Link>

            <Link
              to="/transport/ticketing"
              className="p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5 transition-all text-[var(--foreground)] group"
            >
              <Plane className="w-4 h-4 text-sky-600 mb-1 group-hover:scale-110 transition-transform" />
              <div className="font-bold">Ticketing</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">Transport &amp; Tiket</div>
            </Link>

            <Link
              to="/docs/invoice"
              className="p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5 transition-all text-[var(--foreground)] group"
            >
              <FileText className="w-4 h-4 text-amber-600 mb-1 group-hover:scale-110 transition-transform" />
              <div className="font-bold">Invoicing</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">Approval Workflow</div>
            </Link>

            <Link
              to="/assets/vendor"
              className="p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5 transition-all text-[var(--foreground)] group"
            >
              <Truck className="w-4 h-4 text-indigo-600 mb-1 group-hover:scale-110 transition-transform" />
              <div className="font-bold">Kontrak Asset</div>
              <div className="text-[10px] text-[var(--muted-foreground)]">Vendor &amp; Unit</div>
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
