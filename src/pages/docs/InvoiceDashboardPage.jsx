import React, { useState, useEffect, useMemo } from 'react';
import { api as gasClient } from '../../lib/gasClient';
import { useGlobalLoading } from '../../context/LoadingContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Activity, Clock, FileText, DollarSign, ArrowRight, BarChart3, AlertCircle, Building2, Store } from 'lucide-react';
import { differenceInHours, subDays } from 'date-fns';

const MOCK_INVOICES = Array.from({ length: 45 }).map((_, i) => {
  const vendors = ['Gemoy', 'Moms Ainun', 'Medali Mart', 'Berkah Laundry', 'Sandaga', 'Ila Miawa'];
  const sites = ['LBCT', 'IDMG', 'SPCT'];
  const isPaid = Math.random() > 0.4;
  const now = new Date();
  
  // Create randomized workflow dates
  const tglBerkas = subDays(now, Math.floor(Math.random() * 20) + 2);
  const adminGa = new Date(tglBerkas.getTime() + (Math.random() * 10 + 2) * 3600000);
  const gaGl = new Date(adminGa.getTime() + (Math.random() * 24 + 5) * 3600000);
  const gaSpv = new Date(gaGl.getTime() + (Math.random() * 12 + 2) * 3600000);
  const gaSect = new Date(gaSpv.getTime() + (Math.random() * 24 + 10) * 3600000);
  const gaDept = new Date(gaSect.getTime() + (Math.random() * 12 + 5) * 3600000);
  const sm = new Date(gaDept.getTime() + (Math.random() * 48 + 12) * 3600000);
  const acc = new Date(sm.getTime() + (Math.random() * 24 + 10) * 3600000);
  const faGl = new Date(acc.getTime() + (Math.random() * 48 + 12) * 3600000);

  return {
    id: `mock-${i}`,
    vendor: vendors[Math.floor(Math.random() * vendors.length)],
    site: sites[Math.floor(Math.random() * sites.length)],
    nilai: `Rp ${(Math.floor(Math.random() * 100) + 10) * 100000}`,
    status_pembayaran: isPaid ? 'Paid' : 'Open',
    tgl_berkas: tglBerkas.toISOString(),
    tracking_admin_ga: adminGa.toISOString(),
    tracking_ga_gl: gaGl.toISOString(),
    tracking_ga_spv: gaSpv.toISOString(),
    tracking_ga_sect_head: gaSect.toISOString(),
    tracking_ga_dept_head: gaDept.toISOString(),
    tracking_site_manager: sm.toISOString(),
    tracking_accounting: acc.toISOString(),
    tracking_fa_gl: isPaid ? faGl.toISOString() : null,
  };
});

export default function InvoiceDashboardPage() {
  const [invoices, setInvoices] = useState([]);
  const { showLoading, hideLoading } = useGlobalLoading();

  useEffect(() => {
    const fetchInvoices = async () => {
      showLoading();
      try {
        const res = await gasClient.getInvoices();
        if (res.ok) {
          setInvoices(res.data || []);
        } else {
          toast.error(res.message || 'Gagal memuat data');
        }
      } catch (e) {
        toast.error('Terjadi kesalahan jaringan');
      } finally {
        hideLoading();
      }
    };
    fetchInvoices();
  }, []);

  // Utility to parse 'Rp 1.000.000' to 1000000
  const parseNilai = (str) => {
    if (!str) return 0;
    const numStr = String(str).replace(/\D/g, '');
    const parsed = parseInt(numStr, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const formatLeadTime = (hours) => {
    if (hours < 24) return `${hours} Jam`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days} Hari ${remHours} Jam` : `${days} Hari`;
  };

  const parseDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
  };

  // Metrics Calculations
  const metrics = useMemo(() => {
    let totalNilai = 0;
    let totalPaid = 0;
    let openCount = 0;
    let paidCount = 0;
    let overSLA = 0; // arbitrary metric: lead time > 7 days

    const leadTimes = {
      'Admin GA': [],
      'GA GL': [],
      'GA SPV': [],
      'GA Sect Head': [],
      'GA Dept Head': [],
      'Site Manager': [],
      'Accounting': [],
      'FA GL': []
    };

    const vendorsMap = {};
    const sitesMap = {};

    const trackingKeys = [
      { key: 'tgl_berkas', label: 'Diserahkan' },
      { key: 'tracking_admin_ga', label: 'Admin GA' },
      { key: 'tracking_ga_gl', label: 'GA GL' },
      { key: 'tracking_ga_spv', label: 'GA SPV' },
      { key: 'tracking_ga_sect_head', label: 'GA Sect Head' },
      { key: 'tracking_ga_dept_head', label: 'GA Dept Head' },
      { key: 'tracking_site_manager', label: 'Site Manager' },
      { key: 'tracking_accounting', label: 'Accounting' },
      { key: 'tracking_fa_gl', label: 'FA GL' },
    ];

    let totalTotalHours = 0;
    let completedLeadTimes = 0;

    const dataToProcess = invoices.length > 0 ? invoices : MOCK_INVOICES;

    dataToProcess.forEach(inv => {
      const val = parseNilai(inv.nilai);
      totalNilai += val;
      
      if (inv.status_pembayaran?.toLowerCase() === 'paid') {
        paidCount++;
        totalPaid += val;
      } else {
        openCount++;
      }

      const v = inv.vendor || 'Unknown Vendor';
      const s = inv.site || 'Unknown Site';

      if (!vendorsMap[v]) vendorsMap[v] = { vendor: v, count: 0, totalValue: 0 };
      vendorsMap[v].count += 1;
      vendorsMap[v].totalValue += val;

      if (!sitesMap[s]) sitesMap[s] = { site: s, count: 0, totalValue: 0 };
      sitesMap[s].count += 1;
      sitesMap[s].totalValue += val;

      // Calculate Lead Times per stage
      let lastValidDate = parseDate(inv.tgl_berkas);
      let invTotalHours = 0;

      for (let i = 1; i < trackingKeys.length; i++) {
        const stage = trackingKeys[i];
        const currentDate = parseDate(inv[stage.key]);
        if (currentDate && lastValidDate) {
          const hours = differenceInHours(currentDate, lastValidDate);
          if (hours >= 0) {
            leadTimes[stage.label].push(hours);
            invTotalHours += hours;
          }
        }
        if (currentDate) {
          lastValidDate = currentDate;
        }
      }

      if (invTotalHours > 0) {
        totalTotalHours += invTotalHours;
        completedLeadTimes++;
        if (invTotalHours > 168) overSLA++; // 168 hours = 7 days
      }
    });

    // Averages per stage
    const avgLeadTimes = Object.keys(leadTimes).map(stage => {
      const arr = leadTimes[stage];
      const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      return { stage, avg };
    });

    // Find the max avg for scaling the bar chart
    const maxAvg = Math.max(...avgLeadTimes.map(l => l.avg), 1);
    const overallAvgLeadTime = completedLeadTimes ? Math.round(totalTotalHours / completedLeadTimes) : 0;

    const topVendors = Object.values(vendorsMap).sort((a, b) => b.totalValue - a.totalValue);
    const topSites = Object.values(sitesMap).sort((a, b) => b.totalValue - a.totalValue);

    const maxVendorVal = Math.max(...topVendors.map(v => v.totalValue), 1);
    const maxSiteVal = Math.max(...topSites.map(s => s.totalValue), 1);

    return {
      totalNilai,
      totalPaid,
      openCount,
      paidCount,
      totalInvoices: dataToProcess.length,
      avgLeadTimes,
      maxAvg,
      overallAvgLeadTime,
      overSLA,
      topVendors,
      topSites,
      maxVendorVal,
      maxSiteVal,
      isMock: invoices.length === 0
    };
  }, [invoices]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight font-display">Dashboard Invoices</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Analitik lead time dan nilai tagihan dokumen</p>
        </div>
        {metrics.isMock && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            Menampilkan Data Simulasi (Belum ada tagihan asli)
          </div>
        )}
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} 
          className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--muted-foreground)]">Total Invoices</p>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FileText className="w-5 h-5" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-[var(--foreground)]">{metrics.totalInvoices}</h3>
            <p className="text-sm text-green-600 mt-1 font-medium">{metrics.openCount} Open / {metrics.paidCount} Paid</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} 
          className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--muted-foreground)]">Total Nilai Tagihan</p>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign className="w-5 h-5" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-[var(--foreground)]">{formatCurrency(metrics.totalNilai)}</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 font-medium truncate">Terbayar: {formatCurrency(metrics.totalPaid)}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} 
          className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--muted-foreground)]">Rata-rata Lead Time Total</p>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Clock className="w-5 h-5" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-[var(--foreground)]">{formatLeadTime(metrics.overallAvgLeadTime)}</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 font-medium">Dari diserahkan hingga FA GL</p>
          </div>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} 
          className="bg-[var(--card)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--muted-foreground)]">Over SLA (&gt;7 Hari)</p>
            <div className="p-2 bg-ruby-50 text-ruby-600 rounded-lg"><AlertCircle className="w-5 h-5" /></div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-[var(--foreground)]">{metrics.overSLA}</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1 font-medium">Invoice melampaui batas waktu</p>
          </div>
        </motion.div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lead Time Breakdown */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} 
          className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-sm lg:col-span-2">
          <div className="flex items-center space-x-2 mb-6">
            <Activity className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">Lead Time Antar Proses</h2>
          </div>
          
          <div className="space-y-5">
            {metrics.avgLeadTimes.map((item, idx) => {
              const widthPerc = Math.max((item.avg / metrics.maxAvg) * 100, 1); // Min 1% to show bar
              return (
                <div key={idx} className="relative">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-medium text-[var(--foreground)] flex items-center">
                       {idx > 0 && <ArrowRight className="w-3 h-3 mx-1 text-gray-400" />} {item.stage}
                    </span>
                    <span className="text-sm font-semibold text-[var(--muted-foreground)]">{formatLeadTime(item.avg)}</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPerc}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="bg-[var(--primary)] h-full rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Status Distribusi */}
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }} 
          className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center space-x-2 mb-6">
            <BarChart3 className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">Distribusi Status</h2>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Open</span>
                <span className="text-sm font-bold text-gray-900">{metrics.openCount}</span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${metrics.totalInvoices ? (metrics.openCount / metrics.totalInvoices) * 100 : 0}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Paid</span>
                <span className="text-sm font-bold text-gray-900">{metrics.paidCount}</span>
              </div>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${metrics.totalInvoices ? (metrics.paidCount / metrics.totalInvoices) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Insight Singkat</h4>
            <ul className="text-xs text-gray-600 space-y-2">
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] mt-1 mr-2 shrink-0" />
                Rata-rata waktu proses terlama ada di tahap <strong>{metrics.avgLeadTimes.length > 0 ? metrics.avgLeadTimes.reduce((prev, curr) => (prev.avg > curr.avg) ? prev : curr).stage : '-'}</strong>.
              </li>
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-ruby-500 mt-1 mr-2 shrink-0" />
                <strong>{((metrics.paidCount / (metrics.totalInvoices || 1)) * 100).toFixed(1)}%</strong> invoice telah terbayarkan.
              </li>
            </ul>
          </div>
        </motion.div>

      </div>

      {/* Vendors and Sites Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
        
        {/* Top Vendors */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
          className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center space-x-2 mb-6">
            <Store className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">Sebaran Tagihan per Vendor</h2>
          </div>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {metrics.topVendors.length > 0 ? metrics.topVendors.map((v, i) => {
              const perc = Math.max((v.totalValue / metrics.maxVendorVal) * 100, 2);
              return (
                <div key={i} className="relative">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800 truncate pr-4">{v.vendor} <span className="text-gray-400 font-normal ml-1">({v.count} inv)</span></span>
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{formatCurrency(v.totalValue)}</span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${perc}%` }} transition={{ duration: 1, delay: 0.2 + (i * 0.1) }}
                      className="h-full bg-indigo-500 rounded-full" />
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-10 text-gray-400 text-sm">Belum ada data vendor</div>
            )}
          </div>
        </motion.div>

        {/* Top Sites */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          className="bg-[var(--card)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center space-x-2 mb-6">
            <Building2 className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">Distribusi Tagihan per Site</h2>
          </div>
          <div className="space-y-4">
            {metrics.topSites.length > 0 ? metrics.topSites.map((s, i) => {
              const perc = Math.max((s.totalValue / metrics.maxSiteVal) * 100, 2);
              return (
                <div key={i} className="relative">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{s.site} <span className="text-gray-400 font-normal ml-1">({s.count} inv)</span></span>
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{formatCurrency(s.totalValue)}</span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${perc}%` }} transition={{ duration: 1, delay: 0.3 + (i * 0.1) }}
                      className="h-full bg-sky-500 rounded-full" />
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-10 text-gray-400 text-sm">Belum ada data site</div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
