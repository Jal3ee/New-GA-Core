import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { 
  Plane, 
  Search, 
  Filter, 
  Upload, 
  Download, 
  Calendar, 
  DollarSign, 
  Users, 
  MapPin, 
  ArrowRight, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  FileSpreadsheet,
  Trash2,
  Eye,
  EyeOff,
  Building,
  Phone,
  Mail,
  Ticket,
  SlidersHorizontal,
  Info,
  LayoutDashboard,
  ChevronUp,
  ChevronDown,
  Clock,
  TrendingUp,
  Compass,
  Briefcase
} from 'lucide-react';
import { api as gasClient } from '../../lib/gasClient';

// Helper for parsing prices
function parsePrice(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = String(val).replace(/[^0-9.-]/g, '');
  return parseFloat(clean) || 0;
}

// Helper for formatting Rupiah
function formatRupiah(num) {
  return 'Rp ' + Math.round(num || 0).toLocaleString('id-ID');
}

// Helper for parsing dates
function parseDateSafe(val) {
  if (!val) return null;
  const s = String(val).trim();
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Helper to calculate lead time in days between booking and departure
function getLeadTimeDays(bookingDateStr, departureDateStr) {
  const dBooking = parseDateSafe(bookingDateStr);
  const dDeparture = parseDateSafe(departureDateStr);
  if (!dBooking || !dDeparture) return null;
  const diffMs = dDeparture.getTime() - dBooking.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// Pure helper to consolidate transit legs and group bookings by PNR Code
function consolidateTicketingJourneys(rawList) {
  if (!Array.isArray(rawList)) return [];
  const pnrGroups = {};
  const standalone = [];

  rawList.forEach((r, idx) => {
    const pnr = String(r['Pnr Code'] || '').trim();
    if (!pnr) {
      standalone.push({ ...r, _rawIndex: idx, _legs: [r], _isConsolidated: false });
      return;
    }
    if (!pnrGroups[pnr]) pnrGroups[pnr] = [];
    pnrGroups[pnr].push({ ...r, _rawIndex: idx });
  });

  const consolidated = [...standalone];

  Object.entries(pnrGroups).forEach(([pnr, rows]) => {
    // Total cost across this entire PNR
    const totalPnrCost = rows.reduce((acc, row) => {
      return acc + parsePrice(row['Total Selling Price (VAT + StampFee + MDR Included)']);
    }, 0);

    // Group rows in this PNR by passenger name
    const passengerGroups = {};
    rows.forEach(r => {
      const pName = `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim().toUpperCase() || 'UNKNOWN';
      if (!passengerGroups[pName]) passengerGroups[pName] = [];
      passengerGroups[pName].push(r);
    });

    const uniquePassengerNames = Object.keys(passengerGroups);
    const passengerCount = uniquePassengerNames.length;
    // Rule: Jika PNR sama namun nama berbeda beda maka artinya berbeda orang, cost dibagi total orang
    const costPerPax = passengerCount > 0 ? (totalPnrCost / passengerCount) : 0;

    uniquePassengerNames.forEach(pName => {
      const pRows = passengerGroups[pName];
      // Sort legs chronologically
      pRows.sort((a, b) => {
        const timeA = String(a['Departure Time'] || '');
        const timeB = String(b['Departure Time'] || '');
        return timeA.localeCompare(timeB);
      });

      const firstLeg = pRows[0];
      const lastLeg = pRows[pRows.length - 1];
      // Rule: Jika nama dan PNR sama di tanggal yang sama maka jadikan 1 data:
      // secara rute tidak include bandara transit, langsung bandara awal ke bandara tujuan akhir
      const isTransit = pRows.length > 1;
      const transits = isTransit ? pRows.slice(0, -1).map(l => l['Destination']).filter(Boolean) : [];

      const airlines = [...new Set(pRows.map(l => l['Airline']).filter(Boolean))].join(' / ');
      const flights = [...new Set(pRows.map(l => l['Flight Number']).filter(Boolean))].join(' / ');

      consolidated.push({
        ...firstLeg,
        id: firstLeg.id || `TRX-${pnr}-${pName.replace(/[^A-Z0-9]/g, '').slice(0, 8)}`,
        Origination: firstLeg['Origination'],
        Destination: lastLeg['Destination'],
        Airline: airlines || firstLeg['Airline'],
        'Flight Number': flights || firstLeg['Flight Number'],
        'Departure Date': firstLeg['Departure Date'],
        'Departure Time': firstLeg['Departure Time'],
        'Arrival Date': lastLeg['Arrival Date'] || firstLeg['Arrival Date'],
        'Arrival Time': lastLeg['Arrival Time'] || firstLeg['Arrival Time'],
        'Total Selling Price (VAT + StampFee + MDR Included)': costPerPax,
        _isConsolidated: true,
        _isTransit: isTransit,
        _transits: transits,
        _isGroup: passengerCount > 1,
        _groupSize: passengerCount,
        _groupMembers: uniquePassengerNames,
        _legs: pRows,
        _pnrTotalCost: totalPnrCost
      });
    });
  });

  return consolidated;
}

export default function TicketingPage() {
  // Local storage cache or fallback to empty
  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('garda_ticketing_db');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);

  // View Mode: 'consolidated' (Rute Bersih & Pembagian PNR) or 'raw' (Semua Segmen Mentah)
  const [viewMode, setViewMode] = useState('consolidated');

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState('all'); // 'all', 'month', '30days', '7days', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [airlineFilter, setAirlineFilter] = useState('all');
  const [airportFilter, setAirportFilter] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selected row for Right Detail Drawer
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState('append'); // 'append' or 'replace'
  const [importedRows, setImportedRows] = useState([]);
  const [importedFileName, setImportedFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Dashboard visibility state
  const [isDashboardVisible, setIsDashboardVisible] = useState(true);

  // Fetch real-time records from Google Spreadsheet tbl_transport_ticketing
  const fetchRecords = async (showToast = false) => {
    setIsLoading(true);
    try {
      const res = await gasClient.getTicketingRecords();
      if (res && res.ok && Array.isArray(res.data)) {
        setRecords(res.data);
        try {
          localStorage.setItem('garda_ticketing_db', JSON.stringify(res.data));
        } catch {
          // ignore quota
        }
        if (showToast) {
          toast.success(`Berhasil menyinkronkan ${res.data.length} transaksi dari Spreadsheet`);
        }
      } else if (res && !res.ok) {
        toast.error(res.message || 'Gagal memuat data dari Spreadsheet');
      }
    } catch (err) {
      console.error('Fetch ticketing error:', err);
      toast.error('Gagal terhubung ke Spreadsheet: ' + (err.message || 'Koneksi terputus'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Date Presets logic
  const dateRangeBounds = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (datePreset === 'all') {
      return { start: null, end: null };
    }
    if (datePreset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    if (datePreset === '7days') {
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end: today };
    }
    if (datePreset === '30days') {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { start, end: today };
    }
    if (datePreset === 'custom') {
      const start = startDate ? new Date(startDate + 'T00:00:00') : null;
      const end = endDate ? new Date(endDate + 'T23:59:59') : null;
      return { start, end };
    }
    return { start: null, end: null };
  }, [datePreset, startDate, endDate]);

  // Consolidated records (PNR transit merged into origin -> destination, group booking cost distributed)
  const consolidatedRecords = useMemo(() => {
    return consolidateTicketingJourneys(records);
  }, [records]);

  // Current display dataset based on viewMode
  const activeDataset = useMemo(() => {
    return viewMode === 'consolidated' ? consolidatedRecords : records;
  }, [viewMode, consolidatedRecords, records]);

  // Unique options for dropdown filters
  const uniqueAirlines = useMemo(() => {
    const set = new Set();
    records.forEach(r => {
      if (r['Airline']) set.add(r['Airline'].trim());
    });
    return Array.from(set).sort();
  }, [records]);

  const uniqueAirports = useMemo(() => {
    const set = new Set();
    records.forEach(r => {
      if (r['Origination']) set.add(r['Origination'].trim());
      if (r['Destination']) set.add(r['Destination'].trim());
    });
    return Array.from(set).sort();
  }, [records]);

  // Filter helper
  const applyFilters = (list) => {
    return list.filter(r => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const passenger = `${r['First Name'] || ''} ${r['Last Name'] || ''}`.toLowerCase();
        const pnr = String(r['Pnr Code'] || '').toLowerCase();
        const ticket = String(r['Ticket No'] || '').toLowerCase();
        const flight = String(r['Flight Number'] || '').toLowerCase();
        const airline = String(r['Airline'] || '').toLowerCase();
        const route = `${r['Origination'] || ''} ${r['Destination'] || ''}`.toLowerCase();
        const booker = String(r['UserId/Company'] || r['User Id'] || '').toLowerCase();

        const match = passenger.includes(q) ||
          pnr.includes(q) ||
          ticket.includes(q) ||
          flight.includes(q) ||
          airline.includes(q) ||
          route.includes(q) ||
          booker.includes(q);

        if (!match) return false;
      }

      // 2. Airline Filter
      if (airlineFilter !== 'all' && r['Airline'] !== airlineFilter) {
        return false;
      }

      // 3. Airport Filter (Origination or Destination)
      if (airportFilter !== 'all') {
        if (r['Origination'] !== airportFilter && r['Destination'] !== airportFilter) {
          return false;
        }
      }

      // 4. Date Range Filter (Departure Date or Booking Date)
      if (dateRangeBounds.start || dateRangeBounds.end) {
        const d = parseDateSafe(r['Departure Date'] || r['Booking Date Time'] || r['Ticketing Date Time']);
        if (d) {
          if (dateRangeBounds.start && d < dateRangeBounds.start) return false;
          if (dateRangeBounds.end && d > dateRangeBounds.end) return false;
        }
      }

      return true;
    });
  };

  // Filtered dataset for active table view
  const filteredRecords = useMemo(() => {
    return applyFilters(activeDataset);
  }, [activeDataset, searchQuery, airlineFilter, airportFilter, dateRangeBounds]);

  // Filtered consolidated dataset specifically for dashboard metrics (ensures accurate journey count and routes)
  const filteredConsolidatedRecords = useMemo(() => {
    return applyFilters(consolidatedRecords);
  }, [consolidatedRecords, searchQuery, airlineFilter, airportFilter, dateRangeBounds]);

  // Analytical Metrics for Dashboard
  const analytics = useMemo(() => {
    let totalCost = 0;
    const passengerMap = {};
    const airlineMap = {};
    const routeMap = {};
    const bookerMap = {};

    let urgentCount = 0;   // < 3 hari
    let urgentCost = 0;
    let normalCount = 0;   // 3 - 7 hari
    let normalCost = 0;
    let plannedCount = 0;  // > 7 hari
    let plannedCost = 0;
    let totalWithLeadTime = 0;

    filteredConsolidatedRecords.forEach(r => {
      const cost = parsePrice(r['Total Selling Price (VAT + StampFee + MDR Included)']);
      totalCost += cost;

      // Passenger stats
      const passenger = `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim() || r['First Name'] || 'Tanpa Nama';
      if (!passengerMap[passenger]) {
        passengerMap[passenger] = { name: passenger, count: 0, cost: 0 };
      }
      passengerMap[passenger].count += 1;
      passengerMap[passenger].cost += cost;

      // Airline stats
      const airline = r['Airline'] ? r['Airline'].trim() : 'Lainnya';
      if (!airlineMap[airline]) {
        airlineMap[airline] = { airline, count: 0, cost: 0 };
      }
      airlineMap[airline].count += 1;
      airlineMap[airline].cost += cost;

      // Route stats (Top Routes: Origination -> Destination)
      const orig = r['Origination'] ? r['Origination'].trim() : null;
      const dest = r['Destination'] ? r['Destination'].trim() : null;
      if (orig && dest) {
        const routeKey = `${orig} → ${dest}`;
        if (!routeMap[routeKey]) {
          routeMap[routeKey] = { route: routeKey, orig, dest, count: 0, cost: 0 };
        }
        routeMap[routeKey].count += 1;
        routeMap[routeKey].cost += cost;
      }

      // Lead time stats
      const days = getLeadTimeDays(r['Booking Date Time'], r['Departure Date']);
      if (days !== null && days >= 0) {
        totalWithLeadTime++;
        if (days < 3) {
          urgentCount++;
          urgentCost += cost;
        } else if (days <= 7) {
          normalCount++;
          normalCost += cost;
        } else {
          plannedCount++;
          plannedCost += cost;
        }
      }

      // Booker / Company stats
      const booker = (r['UserId/Company'] || r['User Id'] || 'Lainnya').trim();
      if (!bookerMap[booker]) {
        bookerMap[booker] = { name: booker, count: 0, cost: 0 };
      }
      bookerMap[booker].count += 1;
      bookerMap[booker].cost += cost;
    });

    // Top 5 Spenders (Passengers)
    const topSpenders = Object.values(passengerMap)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    // Top 5 Routes (Rute Terpadat)
    const topRoutes = Object.values(routeMap)
      .map(item => ({
        ...item,
        avgCost: item.count > 0 ? Math.round(item.cost / item.count) : 0
      }))
      .sort((a, b) => b.count - a.count || b.cost - a.cost)
      .slice(0, 5);

    // Airline breakdown with avg ticket price
    const airlineStats = Object.values(airlineMap)
      .map(a => ({
        ...a,
        avgPrice: a.count > 0 ? Math.round(a.cost / a.count) : 0
      }))
      .sort((a, b) => b.cost - a.cost);

    // Top 5 Bookers / Entities
    const topBookers = Object.values(bookerMap)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    const totalTickets = filteredConsolidatedRecords.length;
    const avgCost = totalTickets > 0 ? Math.round(totalCost / totalTickets) : 0;
    const topSpender = topSpenders[0] || null;
    const topRoute = topRoutes[0] || null;

    const urgentPct = totalWithLeadTime > 0 ? Math.round((urgentCount / totalWithLeadTime) * 100) : 0;
    const normalPct = totalWithLeadTime > 0 ? Math.round((normalCount / totalWithLeadTime) * 100) : 0;
    const plannedPct = totalWithLeadTime > 0 ? Math.round((plannedCount / totalWithLeadTime) * 100) : 0;

    return {
      totalCost,
      totalTickets,
      avgCost,
      topSpender,
      topRoute,
      topSpenders,
      topRoutes,
      airlineStats,
      topBookers,
      leadTime: {
        totalWithLeadTime,
        urgentCount,
        urgentCost,
        urgentPct,
        normalCount,
        normalCost,
        normalPct,
        plannedCount,
        plannedCost,
        plannedPct
      }
    };
  }, [filteredConsolidatedRecords]);

  // Paginated records for table view
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, datePreset, startDate, endDate, airlineFilter, airportFilter, pageSize]);

  // Handle file selection for Excel Import
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          toast.error('File Excel kosong atau format tidak sesuai.');
          return;
        }

        // Normalize rows
        const normalized = rawJson.map((row, idx) => {
          const id = row.id || `TRX-${Date.now().toString().slice(-4)}-${idx + 1}`;
          
          // Map price variations
          let price = row['Total Selling Price (VAT + StampFee + MDR Included)'];
          if (price === undefined) price = row['Total Selling Price'] || row['Price'] || row['Biaya'] || row['Total'] || 0;

          return {
            id,
            'No': String(idx + 1),
            'User Id': row['User Id'] || row['Booker'] || row['UserId'] || '-',
            'UserId/Company': row['UserId/Company'] || row['Company'] || '-',
            'Booking Date Time': row['Booking Date Time'] || row['Booking Date'] || '-',
            'Ticketing Date Time': row['Ticketing Date Time'] || '-',
            'First Name': row['First Name'] || row['Nama Depan'] || '',
            'Last Name': row['Last Name'] || row['Nama Belakang'] || '',
            'Airline': row['Airline'] || row['Maskapai'] || '-',
            'Pnr Code': row['Pnr Code'] || row['PNR'] || '-',
            'Ticket No': row['Ticket No'] || row['No Tiket'] || '',
            'Flight Number': row['Flight Number'] || row['No Penerbangan'] || '-',
            'Origination': row['Origination'] || row['Asal'] || row['From'] || '-',
            'Destination': row['Destination'] || row['Tujuan'] || row['To'] || '-',
            'Class': row['Class'] || row['Kelas'] || 'Y',
            'Departure Date': row['Departure Date'] || row['Tgl Berangkat'] || '-',
            'Departure Time': row['Departure Time'] || row['Jam Berangkat'] || '-',
            'Arrival Date': row['Arrival Date'] || '-',
            'Arrival Time': row['Arrival Time'] || '-',
            'Total Selling Price (VAT + StampFee + MDR Included)': parsePrice(price),
            'Status': row['Status'] || 'Ticketed',
            'Remark 1 - Break 1': row['Remark 1 - Break 1'] || '',
            'Remark 2 - Break 2': row['Remark 2 - Break 2'] || '',
            'Remark 3 - Break 3': row['Remark 3 - Break 3'] || '',
            'Remark 4 - Break 4': row['Remark 4 - Break 4'] || '',
            'Remark 5 - Break 5': row['Remark 5 - Break 5'] || '',
            'Remark 6 - Break 6': row['Remark 6 - Break 6'] || '',
            'Emergency Contact Name': row['Emergency Contact Name'] || '-',
            'Emergency Contact Phone': row['Emergency Contact Phone'] || '-',
            'Emergency Contact Email': row['Emergency Contact Email'] || '-',
            'Insurance Booking Code': row['Insurance Booking Code'] || ''
          };
        });

        setImportedRows(normalized);
        setIsImportModalOpen(true);
      } catch (err) {
        console.error(err);
        toast.error('Gagal membaca file Excel: ' + (err.message || 'Format tidak valid'));
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset file input
    e.target.value = '';
  };

  // Confirm Import directly to Google Spreadsheet
  const handleConfirmImport = async () => {
    if (!importedRows.length) return;
    setIsImporting(true);

    try {
      toast.info('Mengirim data ke database Spreadsheet...');
      const res = await gasClient.batchImportTicketing(importedRows, importMode);
      if (res && res.ok) {
        toast.success(`Berhasil mengimpor ${importedRows.length} transaksi ke Spreadsheet (${importMode === 'replace' ? 'Ganti Baru' : 'Ditambahkan'})`);
        setIsImportModalOpen(false);
        setImportedRows([]);
        setImportedFileName('');
        await fetchRecords();
      } else {
        toast.error(res?.message || 'Gagal menyimpan transaksi ke Spreadsheet');
      }
    } catch (e) {
      toast.error('Gagal memproses import data: ' + e.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Export current filtered dataset to Excel
  const handleExportExcel = () => {
    if (!filteredRecords.length) {
      toast.error('Tidak ada data untuk diexport');
      return;
    }

    try {
      const exportData = filteredRecords.map((r, i) => ({
        'No': i + 1,
        'Booking Date': r['Booking Date Time'],
        'Ticketing Date': r['Ticketing Date Time'],
        'User Id': r['User Id'],
        'Company': r['UserId/Company'],
        'First Name': r['First Name'],
        'Last Name': r['Last Name'],
        'Airline': r['Airline'],
        'PNR': r['Pnr Code'],
        'Ticket No': r['Ticket No'],
        'Flight Number': r['Flight Number'],
        'From': r['Origination'],
        'To': r['Destination'],
        'Class': r['Class'],
        'Departure Date': r['Departure Date'],
        'Departure Time': r['Departure Time'],
        'Arrival Date': r['Arrival Date'],
        'Arrival Time': r['Arrival Time'],
        'Total Cost': parsePrice(r['Total Selling Price (VAT + StampFee + MDR Included)']),
        'Status': r['Status'],
        'Emergency Contact': r['Emergency Contact Name'],
        'Emergency Phone': r['Emergency Contact Phone']
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ticketing Report');
      XLSX.writeFile(wb, `Ticketing_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Data tiket berhasil diexport ke Excel');
    } catch (e) {
      console.error(e);
      toast.error('Gagal mengekspor data: ' + e.message);
    }
  };

  // Delete single record from Spreadsheet
  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Hapus data tiket ini dari database Spreadsheet?')) return;
    try {
      const res = await gasClient.deleteTicketingRecord(id);
      if (res && res.ok) {
        toast.success('Data tiket berhasil dihapus dari Spreadsheet');
        if (selectedRecord?.id === id) setSelectedRecord(null);
        await fetchRecords();
      } else {
        toast.error(res?.message || 'Gagal menghapus data dari Spreadsheet');
      }
    } catch (e) {
      toast.error('Gagal menghapus data: ' + e.message);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <div className="p-2 rounded-lg bg-[var(--muted)] text-[var(--primary)] border border-[var(--border)]">
              <Plane className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Ticketing Database</h1>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            Database dan monitoring operasional tiket perjalanan dinas (Travel & Transport).
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-semibold transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5 text-[var(--muted-foreground)]" />
            Import Excel
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-semibold transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-[var(--muted-foreground)]" />
            Export Data
          </button>

          <button
            onClick={() => fetchRecords(true)}
            disabled={isLoading}
            title="Sinkronkan data realtime dari tabel tbl_transport_ticketing Spreadsheet"
            className="inline-flex items-center px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin text-[var(--primary)]' : 'text-[var(--muted-foreground)]'}`} />
            {isLoading ? 'Menyinkronkan...' : 'Sinkronkan Database'}
          </button>
          
          <button
            onClick={() => setIsDashboardVisible(!isDashboardVisible)}
            className="inline-flex items-center px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] text-xs font-medium transition-colors shadow-xs"
          >
            <LayoutDashboard className="w-3.5 h-3.5 mr-1.5 text-[var(--muted-foreground)]" />
            {isDashboardVisible ? 'Sembunyikan Dashboard' : 'Tampilkan Dashboard'}
          </button>
        </div>
      </div>

      {/* Filter & Date Range Bar */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 space-y-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <input
              type="text"
              placeholder="Cari nama penumpang, PNR, tiket, maskapai, rute..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-xs text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
            <span className="text-xs text-[var(--muted-foreground)] mr-1 hidden sm:inline">Periode:</span>
            {[
              { id: 'all', label: 'Semua Waktu' },
              { id: 'month', label: 'Bulan Ini' },
              { id: '30days', label: '30 Hari Terakhir' },
              { id: '7days', label: '7 Hari Terakhir' },
              { id: 'custom', label: 'Kustom' },
            ].map((preset) => (
              <button
                key={preset.id}
                onClick={() => setDatePreset(preset.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  datePreset === preset.id
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs'
                    : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--border)]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Filter Row: Custom Dates + Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--border)] text-xs">
          {/* Custom Date Inputs if Custom selected */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-[var(--background)] p-1.5 rounded-lg border border-[var(--border)]">
              <span className="text-[var(--muted-foreground)] pl-1">Dari:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-[var(--foreground)] text-xs border-0 outline-none"
              />
              <span className="text-[var(--muted-foreground)]">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-[var(--foreground)] text-xs border-0 outline-none"
              />
            </div>
          )}

          {/* Maskapai Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--muted-foreground)]">Maskapai:</span>
            <select
              value={airlineFilter}
              onChange={(e) => setAirlineFilter(e.target.value)}
              className="bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[var(--ring)] font-medium"
            >
              <option value="all">Semua Maskapai</option>
              {uniqueAirlines.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Airport Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--muted-foreground)]">Bandara:</span>
            <select
              value={airportFilter}
              onChange={(e) => setAirportFilter(e.target.value)}
              className="bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[var(--ring)] font-medium"
            >
              <option value="all">Semua Bandara (Asal/Tujuan)</option>
              {uniqueAirports.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters button if any active */}
          {(searchQuery || datePreset !== 'all' || airlineFilter !== 'all' || airportFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDatePreset('all');
                setStartDate('');
                setEndDate('');
                setAirlineFilter('all');
                setAirportFilter('all');
              }}
              className="ml-auto inline-flex items-center text-[var(--muted-foreground)] hover:text-ruby-600 transition-colors py-1"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid (Following skill/design.md: Flat cards with left border accent) */}
      {isDashboardVisible && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* KPI 1: Total Cost */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] border-l-4 border-l-[var(--primary)] p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
              <span className="font-semibold uppercase tracking-wider">Total Biaya Tiket</span>
              <DollarSign className="w-4 h-4 text-[var(--primary)]" />
            </div>
            <div className="text-xl font-bold font-mono text-[var(--foreground)] tabular-nums">
              {formatRupiah(analytics.totalCost)}
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)] mt-1">
              Dari {analytics.totalTickets} perjalanan terfilter
            </div>
          </div>

          {/* KPI 2: Total Journeys */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] border-l-4 border-l-[var(--accent)] p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
              <span className="font-semibold uppercase tracking-wider">Total Perjalanan</span>
              <Plane className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="text-xl font-bold font-mono text-[var(--foreground)] tabular-nums">
              {analytics.totalTickets} <span className="text-sm font-normal text-[var(--muted-foreground)]">pax</span>
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)] mt-1">
              {viewMode === 'consolidated' ? 'Terkonsolidasi per rute' : 'Segmen penerbangan mentah'}
            </div>
          </div>

          {/* KPI 3: Average Cost per Pax */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] border-l-4 border-l-emerald-600 p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
              <span className="font-semibold uppercase tracking-wider">Rata-rata / Pax</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold font-mono text-[var(--foreground)] tabular-nums">
              {formatRupiah(analytics.avgCost)}
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)] mt-1">
              Efisiensi biaya rata-rata perjalanan
            </div>
          </div>

          {/* KPI 4: Top Route (Replaces Bandara Terpadat) */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] border-l-4 border-l-sky-600 p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
              <span className="font-semibold uppercase tracking-wider">Rute Terpadat</span>
              <Compass className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-base font-bold font-mono text-[var(--foreground)] truncate" title={analytics.topRoute?.route}>
              {analytics.topRoute?.route || '-'}
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)] mt-1">
              {analytics.topRoute ? `${analytics.topRoute.count} penerbangan (${formatRupiah(analytics.topRoute.cost)})` : 'Belum ada data'}
            </div>
          </div>

          {/* KPI 5: Booking Lead Time Risk */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] border-l-4 border-l-ruby-500 p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] mb-1">
              <span className="font-semibold uppercase tracking-wider">Booking Mendadak</span>
              <Clock className="w-4 h-4 text-ruby-500" />
            </div>
            <div className="text-xl font-bold font-mono text-ruby-600 tabular-nums">
              {analytics.leadTime?.urgentPct || 0}%
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)] mt-1">
              {analytics.leadTime?.urgentCount || 0} tiket dipesan &lt; 3 hari
            </div>
          </div>
        </div>
      )}

      {/* Monitoring Analytics: Spenders, Routes, Airlines, Lead Time & Bookers */}
      {isDashboardVisible && (
        <div className="space-y-4">
          {/* Row 1: Spenders, Top Routes, Airline Share */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Card 1: Top 5 Penumpang Biaya Terbesar */}
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-[var(--primary)]" />
                  Top 5 Penumpang (Biaya Tertinggi)
                </h3>
                <span className="text-[10px] text-[var(--muted-foreground)] font-mono">Ranked</span>
              </div>
              
              <div className="space-y-3 flex-1">
                {analytics.topSpenders.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)] italic py-4 text-center">Tidak ada data terfilter.</p>
                ) : (
                  analytics.topSpenders.map((sp, idx) => {
                    const maxCost = analytics.topSpenders[0]?.cost || 1;
                    const pct = Math.min(100, Math.round((sp.cost / maxCost) * 100));
                    return (
                      <div key={sp.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[var(--foreground)] truncate max-w-[180px]">
                            <span className="text-[var(--muted-foreground)] font-mono mr-1.5">{idx + 1}.</span>
                            {sp.name}
                          </span>
                          <span className="font-mono font-bold text-[var(--foreground)] tabular-nums">
                            {formatRupiah(sp.cost)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)]">
                          <span>{sp.count} perjalanan</span>
                          <span>{pct}% dari biaya tertinggi</span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--primary)] rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Card 2: Top 5 Rute Terpadat (Asal -> Tujuan Akhir) */}
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center">
                  <Compass className="w-3.5 h-3.5 mr-1.5 text-[var(--accent)]" />
                  Top 5 Rute Terpadat
                </h3>
                <span className="text-[10px] text-[var(--muted-foreground)] font-mono">Asal → Tujuan</span>
              </div>

              <div className="space-y-3 flex-1">
                {analytics.topRoutes.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)] italic py-4 text-center">Tidak ada data terfilter.</p>
                ) : (
                  analytics.topRoutes.map((rt, idx) => {
                    const maxCount = analytics.topRoutes[0]?.count || 1;
                    const pct = Math.min(100, Math.round((rt.count / maxCount) * 100));
                    return (
                      <div key={rt.route} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-[var(--foreground)] flex items-center">
                            <span className="text-[var(--muted-foreground)] mr-1.5 font-normal">{idx + 1}.</span>
                            {rt.route}
                          </span>
                          <span className="font-mono text-[var(--foreground)] tabular-nums font-bold">
                            {rt.count} penerbangan
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] font-mono">
                          <span>Total: {formatRupiah(rt.cost)}</span>
                          <span>Rata-rata: {formatRupiah(rt.avgCost)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Card 3: Distribusi Maskapai & Efisiensi Biaya */}
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center">
                  <Plane className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
                  Pangsa Maskapai & Harga Tiket
                </h3>
                <span className="text-[10px] text-[var(--muted-foreground)] font-mono">Share & Efisiensi</span>
              </div>

              <div className="space-y-3 flex-1">
                {analytics.airlineStats.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)] italic py-4 text-center">Tidak ada data terfilter.</p>
                ) : (
                  analytics.airlineStats.map((al) => {
                    const pct = analytics.totalCost > 0 ? Math.round((al.cost / analytics.totalCost) * 100) : 0;
                    return (
                      <div key={al.airline} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[var(--foreground)]">{al.airline}</span>
                          <span className="font-mono font-bold text-[var(--foreground)] tabular-nums">
                            {formatRupiah(al.cost)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] font-mono">
                          <span>{al.count} tiket ({pct}%)</span>
                          <span>Rata-rata: {formatRupiah(al.avgPrice)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-sky-600 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Lead Time Analysis & Top Bookers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Card 4: Analisis Lead Time Pemesanan */}
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                  Waktu Pemesanan Sebelum Berangkat (Lead Time)
                </h3>
                <span className="text-[10px] text-[var(--muted-foreground)] font-mono">Cost Compliance</span>
              </div>
              
              <div className="space-y-3.5 flex-1 text-xs">
                {/* 1. Mendadak */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ruby-600 flex items-center">
                      <span className="w-2 h-2 rounded-full bg-ruby-500 mr-2"></span>
                      Mendadak (&lt; 3 Hari Sebelum Berangkat)
                    </span>
                    <span className="font-mono font-bold text-ruby-600">
                      {analytics.leadTime?.urgentCount || 0} Tiket ({analytics.leadTime?.urgentPct || 0}%)
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] font-mono">
                    <span>Pengeluaran: {formatRupiah(analytics.leadTime?.urgentCost)}</span>
                    <span>Risiko tarif tiket mahal</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-ruby-500 rounded-full transition-all"
                      style={{ width: `${analytics.leadTime?.urgentPct || 0}%` }}
                    />
                  </div>
                </div>

                {/* 2. Normal */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-600 flex items-center">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span>
                      Standar / Normal (3 s/d 7 Hari)
                    </span>
                    <span className="font-mono font-bold text-amber-600">
                      {analytics.leadTime?.normalCount || 0} Tiket ({analytics.leadTime?.normalPct || 0}%)
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] font-mono">
                    <span>Pengeluaran: {formatRupiah(analytics.leadTime?.normalCost)}</span>
                    <span>Tarif reguler operasional</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${analytics.leadTime?.normalPct || 0}%` }}
                    />
                  </div>
                </div>

                {/* 3. Terencana */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-600 flex items-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                      Terencana Lebih Awal (&gt; 7 Hari)
                    </span>
                    <span className="font-mono font-bold text-emerald-600">
                      {analytics.leadTime?.plannedCount || 0} Tiket ({analytics.leadTime?.plannedPct || 0}%)
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] font-mono">
                    <span>Pengeluaran: {formatRupiah(analytics.leadTime?.plannedCost)}</span>
                    <span>Potensi diskon &amp; promo terbaik</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${analytics.leadTime?.plannedPct || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 5: Top Entitas Pemesan / Departemen */}
            <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 shadow-xs flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center">
                  <Briefcase className="w-3.5 h-3.5 mr-1.5 text-[var(--primary)]" />
                  Top Akun / Entitas Pemesan Tiket
                </h3>
                <span className="text-[10px] text-[var(--muted-foreground)] font-mono">Company / User Id</span>
              </div>

              <div className="space-y-3 flex-1">
                {analytics.topBookers.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)] italic py-4 text-center">Tidak ada data terfilter.</p>
                ) : (
                  analytics.topBookers.map((bk, idx) => {
                    const maxCost = analytics.topBookers[0]?.cost || 1;
                    const pct = Math.min(100, Math.round((bk.cost / maxCost) * 100));
                    return (
                      <div key={bk.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[var(--foreground)] truncate max-w-[220px]">
                            <span className="text-[var(--muted-foreground)] font-mono mr-1.5">{idx + 1}.</span>
                            {bk.name}
                          </span>
                          <span className="font-mono font-bold text-[var(--foreground)] tabular-nums">
                            {formatRupiah(bk.cost)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--muted-foreground)] font-mono">
                          <span>{bk.count} tiket</span>
                          <span>{pct}% dari akun tertinggi</span>
                        </div>
                        <div className="w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[var(--primary)] rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Main Database Table Container */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-xs overflow-hidden flex flex-col">
        
        {/* Table Controls Bar */}
        <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--background)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-[var(--foreground)] uppercase tracking-wider">
              Daftar Transaksi Tiket
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] font-mono">
              {filteredRecords.length} Data
            </span>

            {/* View Mode Toggle: Consolidated Journey vs Raw Segments */}
            <div className="inline-flex p-0.5 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-xs font-medium">
              <button
                onClick={() => setViewMode('consolidated')}
                title="Tampilkan data terkonsolidasi (transit digabung jadi 1 rute awal-akhir, biaya PNR rombongan dibagi rata)"
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${
                  viewMode === 'consolidated'
                    ? 'bg-[var(--card)] text-[var(--foreground)] font-bold shadow-xs'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                Rute Konsolidasi
              </button>
              <button
                onClick={() => setViewMode('raw')}
                title="Tampilkan setiap segmen/leg tiket mentah persis seperti file asal"
                className={`px-2.5 py-1 rounded-md text-[11px] transition-all ${
                  viewMode === 'raw'
                    ? 'bg-[var(--card)] text-[var(--foreground)] font-bold shadow-xs'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                Semua Segmen Mentah
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <span className="text-[var(--muted-foreground)] hidden sm:inline">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[var(--ring)]"
            >
              <option value={10}>10 per hal</option>
              <option value={25}>25 per hal</option>
              <option value={50}>50 per hal</option>
              <option value={100}>100 per hal</option>
            </select>
          </div>
        </div>

        {/* Tabular View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/50 text-[var(--muted-foreground)] font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Tgl Berangkat</th>
                <th className="py-3 px-4">Penumpang</th>
                <th className="py-3 px-4">Maskapai &amp; No Penerbangan</th>
                <th className="py-3 px-4">Rute</th>
                <th className="py-3 px-4">PNR / No Tiket</th>
                <th className="py-3 px-4 text-right">Biaya (Rp)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {isLoading && records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--muted-foreground)]">
                    <RotateCcw className="w-8 h-8 mx-auto mb-2 animate-spin text-[var(--primary)]" />
                    <p className="font-medium text-sm text-[var(--foreground)]">Menghubungkan ke Spreadsheet...</p>
                    <p className="text-xs mt-0.5">Memuat data transaksi dari tabel tbl_transport_ticketing.</p>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[var(--muted-foreground)]">
                    <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-sm text-[var(--foreground)]">Tidak ada data tiket yang cocok</p>
                    <p className="text-xs mt-0.5">Coba ubah filter pencarian atau gunakan tombol "Import Excel" untuk menambahkan data.</p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  const passengerName = `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim() || r['First Name'] || '-';
                  const price = parsePrice(r['Total Selling Price (VAT + StampFee + MDR Included)']);
                  const isSelected = selectedRecord?.id === r.id;

                  return (
                    <tr 
                      key={r.id || idx}
                      onClick={() => setSelectedRecord(r)}
                      className={`hover:bg-[var(--muted)]/40 transition-colors cursor-pointer group ${
                        isSelected ? 'bg-[var(--muted)]/70' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-mono text-[var(--muted-foreground)]">
                        {rowNum}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-[var(--foreground)]">{r['Departure Date'] || '-'}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)] font-mono">{r['Departure Time'] || ''}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[var(--foreground)] flex items-center">
                          {passengerName}
                          {r._isGroup && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Grup {r._groupSize} Pax
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--muted-foreground)] truncate max-w-[150px]">
                          {r['UserId/Company'] || r['User Id'] || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[var(--foreground)]">{r['Airline'] || '-'}</div>
                        <div className="text-[10px] font-mono text-[var(--muted-foreground)]">{r['Flight Number'] || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1 font-mono font-bold text-[var(--foreground)]">
                          <span>{r['Origination'] || '-'}</span>
                          <ArrowRight className="w-3 h-3 text-[var(--muted-foreground)]" />
                          <span>{r['Destination'] || '-'}</span>
                          {r._isTransit && (
                            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
                              Transit ({r._transits.join(', ')})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">Kelas: {r['Class'] || '-'}</div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-[var(--primary)]">{r['Pnr Code'] || '-'}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)] truncate max-w-[120px]">
                          {r['Ticket No'] || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[var(--foreground)] tabular-nums">
                        {price > 0 ? (
                          <div>
                            {formatRupiah(price)}
                            {r._isGroup && (
                              <div className="text-[9px] font-normal text-[var(--muted-foreground)]">
                                (bagi rata 1/{r._groupSize})
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--muted-foreground)] font-normal">Rp 0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {r['Status'] || 'Ticketed'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => setSelectedRecord(r)}
                            title="Lihat Detail Tiket"
                            className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(r.id)}
                            title="Hapus Record"
                            className="p-1 text-[var(--muted-foreground)] hover:text-ruby-600 hover:bg-ruby-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* Table Pagination Footer */}
        <div className="p-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-[var(--background)]">
          <span className="text-[var(--muted-foreground)]">
            Menampilkan {filteredRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, filteredRecords.length)} dari {filteredRecords.length} transaksi {viewMode === 'consolidated' ? '(terkonsolidasi)' : '(mentah)'}
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] rounded-lg font-medium disabled:opacity-40 transition-colors shadow-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
              Sebelumnya
            </button>
            <span className="px-2 font-mono font-medium text-[var(--foreground)]">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] rounded-lg font-medium disabled:opacity-40 transition-colors shadow-xs"
            >
              Selanjutnya
              <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Slide-Over Drawer (Right Drawer pattern as per skill/design.md section 9) */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[var(--card)] h-full shadow-2xl border-l border-[var(--border)] flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--background)]">
              <div className="flex items-center space-x-2.5">
                <Ticket className="w-5 h-5 text-[var(--primary)]" />
                <div>
                  <h3 className="font-bold text-sm text-[var(--foreground)]">Detail Tiket Penerbangan</h3>
                  <p className="text-[10px] font-mono text-[var(--muted-foreground)]">ID: {selectedRecord.id || '-'}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5 text-xs">
              
              {/* Flight Status Banner */}
              <div className="p-3 bg-[var(--muted)]/40 rounded-xl border border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider block">Status Tiket</span>
                  <span className="text-sm font-bold text-emerald-600">{selectedRecord['Status'] || 'Ticketed'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider block">Total Biaya Perjalanan</span>
                  <span className="text-sm font-bold font-mono text-[var(--foreground)] tabular-nums">
                    {formatRupiah(parsePrice(selectedRecord['Total Selling Price (VAT + StampFee + MDR Included)']))}
                  </span>
                </div>
              </div>

              {/* Transit Information Box if applicable */}
              {selectedRecord._isTransit && (
                <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-sky-800 font-bold text-[11px]">
                    <span className="flex items-center">
                      <Compass className="w-3.5 h-3.5 mr-1" />
                      Penerbangan Transit Terhubung
                    </span>
                    <span>{selectedRecord._legs?.length || 2} Segmen</span>
                  </div>
                  <p className="text-[11px] text-sky-700">
                    Rute langsung: <strong>{selectedRecord['Origination']} → {selectedRecord['Destination']}</strong> (via transit di {selectedRecord._transits?.join(', ')}).
                  </p>
                  <div className="space-y-1.5 pt-1 border-t border-sky-200">
                    {selectedRecord._legs?.map((leg, lIdx) => (
                      <div key={lIdx} className="bg-white/80 p-2 rounded border border-sky-100 flex items-center justify-between text-[10px] font-mono">
                        <div>
                          <strong>Leg {lIdx + 1}:</strong> {leg['Origination']} → {leg['Destination']} ({leg['Flight Number']})
                        </div>
                        <div className="text-[var(--muted-foreground)]">
                          {leg['Departure Date']} {leg['Departure Time']}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Group Booking Information Box if applicable */}
              {selectedRecord._isGroup && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-amber-800 font-bold text-[11px]">
                    <span className="flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Tiket Rombongan (Group PNR: {selectedRecord['Pnr Code']})
                    </span>
                    <span>{selectedRecord._groupSize} Penumpang</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Total biaya grup {formatRupiah(selectedRecord._pnrTotalCost)} dibagi rata untuk {selectedRecord._groupSize} penumpang ({formatRupiah(parsePrice(selectedRecord['Total Selling Price (VAT + StampFee + MDR Included)']))} / orang).
                  </p>
                  <div className="space-y-1 pt-1 border-t border-amber-200">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Daftar Penumpang Rombongan:</span>
                    {selectedRecord._groupMembers?.map((mName, mIdx) => (
                      <div key={mIdx} className="text-[11px] text-amber-900 flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                        {mName}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Passenger Info */}
              <div className="space-y-2">
                <h4 className="font-bold text-[var(--foreground)] uppercase tracking-wider text-[11px] flex items-center">
                  <Users className="w-3.5 h-3.5 mr-1 text-[var(--muted-foreground)]" />
                  Informasi Penumpang &amp; Pemesan
                </h4>
                <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] space-y-1.5">
                  <p><span className="text-[var(--muted-foreground)]">Nama Penumpang:</span> <strong className="text-[var(--foreground)]">{selectedRecord['First Name']} {selectedRecord['Last Name']}</strong></p>
                  <p><span className="text-[var(--muted-foreground)]">Pemesan (User Id):</span> {selectedRecord['User Id'] || '-'}</p>
                  <p><span className="text-[var(--muted-foreground)]">Perusahaan / Divisi:</span> {selectedRecord['UserId/Company'] || '-'}</p>
                  <p><span className="text-[var(--muted-foreground)]">Waktu Pemesanan:</span> <span className="font-mono">{selectedRecord['Booking Date Time'] || '-'}</span></p>
                  <p><span className="text-[var(--muted-foreground)]">Waktu Penerbitan:</span> <span className="font-mono">{selectedRecord['Ticketing Date Time'] || '-'}</span></p>
                </div>
              </div>

              {/* Flight Details */}
              <div className="space-y-2">
                <h4 className="font-bold text-[var(--foreground)] uppercase tracking-wider text-[11px] flex items-center">
                  <Plane className="w-3.5 h-3.5 mr-1 text-[var(--muted-foreground)]" />
                  Rincian Penerbangan
                </h4>
                <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                    <div>
                      <span className="text-base font-bold font-mono text-[var(--foreground)]">{selectedRecord['Origination']}</span>
                      <p className="text-[10px] text-[var(--muted-foreground)]">Berangkat: {selectedRecord['Departure Date']} {selectedRecord['Departure Time']}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[var(--muted-foreground)]" />
                    <div className="text-right">
                      <span className="text-base font-bold font-mono text-[var(--foreground)]">{selectedRecord['Destination']}</span>
                      <p className="text-[10px] text-[var(--muted-foreground)]">Tiba: {selectedRecord['Arrival Date']} {selectedRecord['Arrival Time']}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <p><span className="text-[var(--muted-foreground)]">Maskapai:</span> <strong>{selectedRecord['Airline']}</strong></p>
                    <p><span className="text-[var(--muted-foreground)]">No Penerbangan:</span> <span className="font-mono">{selectedRecord['Flight Number']}</span></p>
                    <p><span className="text-[var(--muted-foreground)]">PNR:</span> <span className="font-mono font-bold text-[var(--primary)]">{selectedRecord['Pnr Code']}</span></p>
                    <p><span className="text-[var(--muted-foreground)]">No Tiket:</span> <span className="font-mono">{selectedRecord['Ticket No'] || '-'}</span></p>
                    <p><span className="text-[var(--muted-foreground)]">Kelas:</span> {selectedRecord['Class'] || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-2">
                <h4 className="font-bold text-[var(--foreground)] uppercase tracking-wider text-[11px] flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-1 text-[var(--muted-foreground)]" />
                  Kontak Darurat
                </h4>
                <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] space-y-1">
                  <p><span className="text-[var(--muted-foreground)]">Nama:</span> {selectedRecord['Emergency Contact Name'] || '-'}</p>
                  <p><span className="text-[var(--muted-foreground)]">Telepon:</span> {selectedRecord['Emergency Contact Phone'] || '-'}</p>
                  <p><span className="text-[var(--muted-foreground)]">Email:</span> {selectedRecord['Emergency Contact Email'] || '-'}</p>
                </div>
              </div>

              {/* Remarks */}
              {(selectedRecord['Remark 1 - Break 1'] || selectedRecord['Insurance Booking Code']) && (
                <div className="space-y-2">
                  <h4 className="font-bold text-[var(--foreground)] uppercase tracking-wider text-[11px] flex items-center">
                    <Info className="w-3.5 h-3.5 mr-1 text-[var(--muted-foreground)]" />
                    Catatan Tambahan
                  </h4>
                  <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] space-y-1 text-[11px]">
                    {selectedRecord['Remark 1 - Break 1'] && <p><span className="text-[var(--muted-foreground)]">Remark 1:</span> {selectedRecord['Remark 1 - Break 1']}</p>}
                    {selectedRecord['Insurance Booking Code'] && <p><span className="text-[var(--muted-foreground)]">Kode Asuransi:</span> {selectedRecord['Insurance Booking Code']}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--background)] flex items-center justify-between">
              <button
                onClick={() => handleDeleteRecord(selectedRecord.id)}
                className="inline-flex items-center px-3 py-1.5 text-xs text-ruby-600 hover:bg-ruby-50 rounded-lg font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Hapus Data
              </button>

              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] rounded-lg text-xs font-medium transition-colors shadow-xs"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl w-full max-w-lg overflow-hidden animate-in scale-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--background)]">
              <div className="flex items-center space-x-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[var(--primary)]" />
                <div>
                  <h3 className="font-bold text-sm text-[var(--foreground)]">Konfirmasi Impor Data Excel</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">{importedFileName}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-[var(--muted)]/40 rounded-xl border border-[var(--border)] flex items-center justify-between">
                <div>
                  <p className="text-[var(--foreground)] font-bold">Baris Data Terdeteksi</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Sistem berhasil memetakan kolom tiket.</p>
                </div>
                <div className="text-xl font-bold font-mono text-[var(--primary)]">
                  {importedRows.length} <span className="text-xs font-normal text-[var(--muted-foreground)]">transaksi</span>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="font-bold text-[var(--foreground)]">Pilih Metode Impor:</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border cursor-pointer flex flex-col space-y-1 transition-all ${
                    importMode === 'append'
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--foreground)]'
                      : 'border-[var(--border)] hover:bg-[var(--muted)]/50'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        name="importMode" 
                        checked={importMode === 'append'} 
                        onChange={() => setImportMode('append')}
                        className="text-[var(--primary)]"
                      />
                      <strong className="text-xs">Tambahkan (Append)</strong>
                    </div>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      Menambah data baru ke database yang sudah ada ({records.length} data saat ini).
                    </span>
                  </label>

                  <label className={`p-3 rounded-xl border cursor-pointer flex flex-col space-y-1 transition-all ${
                    importMode === 'replace'
                      ? 'border-ruby-500 bg-ruby-50/20 text-[var(--foreground)]'
                      : 'border-[var(--border)] hover:bg-[var(--muted)]/50'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <input 
                        type="radio" 
                        name="importMode" 
                        checked={importMode === 'replace'} 
                        onChange={() => setImportMode('replace')}
                        className="text-ruby-600"
                      />
                      <strong className="text-xs text-ruby-600">Ganti Seluruh Data</strong>
                    </div>
                    <span className="text-[11px] text-[var(--muted-foreground)]">
                      Menghapus data lama dan menggantikannya dengan {importedRows.length} data baru dari file.
                    </span>
                  </label>
                </div>
              </div>

              {/* Sample preview */}
              <div className="space-y-1.5">
                <span className="text-[var(--muted-foreground)] font-semibold">Contoh 2 Baris Pertama:</span>
                <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] max-h-36 overflow-y-auto space-y-2">
                  {importedRows.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="text-[11px] pb-1.5 border-b border-[var(--border)] last:border-0 last:pb-0">
                      <span className="font-bold text-[var(--foreground)]">{item['First Name']} {item['Last Name']}</span>
                      <span className="text-[var(--muted-foreground)] font-mono ml-2">({item['Airline']} • {item['Flight Number']})</span>
                      <div className="text-[10px] text-[var(--muted-foreground)] font-mono">
                        {item['Origination']} → {item['Destination']} | {formatRupiah(parsePrice(item['Total Selling Price (VAT + StampFee + MDR Included)']))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--background)] flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                disabled={isImporting}
                className="px-4 py-2 border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] rounded-lg text-xs font-medium transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="inline-flex items-center px-4 py-2 bg-[var(--primary)] hover:opacity-90 text-[var(--primary-foreground)] rounded-lg text-xs font-semibold transition-all shadow-xs"
              >
                {isImporting ? 'Memproses...' : 'Terapkan Impor'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
