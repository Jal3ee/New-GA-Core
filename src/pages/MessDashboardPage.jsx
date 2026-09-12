import React, { useState, useEffect, useMemo } from 'react';
import { useGlobalLoading } from '../context/LoadingContext';
import { api } from '../lib/gasClient';
import { toast } from 'sonner';
import { 
  BedDouble, 
  Users, 
  Plane, 
  CheckCircle2, 
  Building, 
  Eye, 
  X, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  History, 
  User, 
  Clock, 
  Grid3X3, 
  List, 
  Layers, 
  Building2,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect';

export default function MessDashboardPage() {
  const { showLoading, hideLoading } = useGlobalLoading();
  const [buildings, setBuildings] = useState([]);
  const [stays, setStays] = useState([]);
  
  // Dashboard & Navigation state
  const [site, setSite] = useState('LBCT');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'history'
  
  // Building detail modal state
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailStatusFilter, setDetailStatusFilter] = useState('ALL');
  const [detailViewMode, setDetailViewMode] = useState('grid'); // 'grid' | 'table'

  // History database state
  const [historySearch, setHistorySearch] = useState('');
  const [historyBuildingId, setHistoryBuildingId] = useState('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  const sites = ['LBCT', 'IDMG', 'SPCT'];

  const loadData = async () => {
    try {
      showLoading();
      const [bRes, sRes] = await Promise.all([
        api.getMessBuildings(),
        api.getMessStays()
      ]);
      setBuildings(bRes.data || []);
      setStays(sRes.data || []);
    } catch (err) {
      toast.error('Gagal memuat data mess');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter for current site
  const siteBuildings = useMemo(() => buildings.filter(b => b.site === site), [buildings, site]);
  const siteStays = useMemo(() => stays.filter(s => s.site === site), [stays, site]);

  // Building lookup map for fast name resolving
  const buildingMap = useMemo(() => {
    const map = {};
    buildings.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [buildings]);

  // Generate all beds flat list for site
  const allBeds = useMemo(() => {
    const list = [];
    siteBuildings.forEach(b => {
      const config = Array.isArray(b.room_config_json) ? b.room_config_json : [];
      config.forEach(c => {
        const start = parseInt(c.range_start) || 1;
        const end = parseInt(c.range_end) || start;
        const beds = parseInt(c.beds) || 1;
        for (let r = start; r <= end; r++) {
          for (let bed = 1; bed <= beds; bed++) {
            list.push({
              building_id: b.id,
              building_name: b.name,
              room_no: `K${r}`,
              bed_no: `B${bed}`,
              label: beds > 1 ? `K${r} - B${bed}` : `K${r} - B1`,
              full_id: `${b.id}_K${r}_B${bed}`
            });
          }
        }
      });
    });
    return list;
  }, [siteBuildings]);

  // Today stats
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const activeStaysToday = useMemo(() => {
    return siteStays.filter(s => {
      if (!s.start_date) return false;
      const start = s.start_date.split('T')[0];
      const end = s.end_date ? s.end_date.split('T')[0] : '9999-12-31';
      return todayStr >= start && todayStr <= end;
    });
  }, [siteStays, todayStr]);

  const stats = useMemo(() => {
    const totalBed = allBeds.length;
    let onsite = 0;
    let leave = 0;
    activeStaysToday.forEach(s => {
      if (s.status === 'Onsite') onsite++;
      if (s.status === 'Leave' || s.status === 'On Leave') leave++;
    });
    const terisi = onsite + leave;
    const vacant = Math.max(0, totalBed - terisi);
    return { totalBed, terisi, onsite, leave, vacant };
  }, [allBeds.length, activeStaysToday]);

  // Building stats
  const buildingStats = useMemo(() => {
    return siteBuildings.map(b => {
      const bBeds = allBeds.filter(bed => bed.building_id === b.id).length;
      const bStays = activeStaysToday.filter(s => s.building_id === b.id);
      let onsite = 0, leave = 0;
      bStays.forEach(s => {
        if (s.status === 'Onsite') onsite++;
        if (s.status === 'Leave' || s.status === 'On Leave') leave++;
      });
      const terisi = onsite + leave;
      const vacant = Math.max(0, bBeds - terisi);
      const pct = bBeds === 0 ? 0 : Math.round((terisi / bBeds) * 100);
      return { 
        id: b.id, 
        name: b.name, 
        site: b.site,
        total: bBeds, 
        onsite, 
        leave, 
        vacant, 
        pct,
        rawBuilding: b
      };
    });
  }, [siteBuildings, allBeds, activeStaysToday]);

  // Date formatter helper
  const formatDate = (isoStr) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  // Duration in days helper
  const getDurationDays = (startDate, endDate) => {
    if (!startDate) return '-';
    try {
      const s = new Date(startDate.split('T')[0]);
      const e = endDate ? new Date(endDate.split('T')[0]) : new Date();
      const diffTime = Math.max(0, e - s);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return `${diffDays} hari`;
    } catch {
      return '-';
    }
  };

  // Detail Building Rooms & Beds structure
  const detailedBuildingRooms = useMemo(() => {
    if (!selectedBuilding) return [];
    const b = selectedBuilding.rawBuilding || selectedBuilding;
    const config = Array.isArray(b.room_config_json) ? b.room_config_json : [];
    const rooms = [];

    config.forEach(c => {
      const start = parseInt(c.range_start) || 1;
      const end = parseInt(c.range_end) || start;
      const bedCount = parseInt(c.beds) || 1;

      for (let r = start; r <= end; r++) {
        const roomNo = `K${r}`;
        const beds = [];

        for (let bed = 1; bed <= bedCount; bed++) {
          const bedNo = `B${bed}`;
          const occupant = activeStaysToday.find(s => 
            s.building_id === b.id && 
            s.room_no === roomNo && 
            s.bed_no === bedNo
          );

          let status = 'Vacant';
          if (occupant) {
            status = (occupant.status === 'Leave' || occupant.status === 'On Leave') ? 'On Leave' : 'Onsite';
          }

          beds.push({
            bedNo,
            label: bedCount > 1 ? `${roomNo} - ${bedNo}` : `${roomNo}`,
            occupant: occupant || null,
            status
          });
        }

        const occupiedBeds = beds.filter(item => item.occupant).length;

        rooms.push({
          roomNo,
          bedCount,
          beds,
          occupiedBeds,
          vacantBeds: bedCount - occupiedBeds,
          isFull: occupiedBeds === bedCount,
          isEmpty: occupiedBeds === 0
        });
      }
    });

    return rooms;
  }, [selectedBuilding, activeStaysToday]);

  // Filtered rooms for the detail modal
  const filteredRooms = useMemo(() => {
    let result = detailedBuildingRooms;

    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase().trim();
      result = result.filter(room => {
        const roomMatch = room.roomNo.toLowerCase().includes(q);
        const occupantMatch = room.beds.some(b => 
          b.occupant && b.occupant.guest_name && b.occupant.guest_name.toLowerCase().includes(q)
        );
        return roomMatch || occupantMatch;
      });
    }

    if (detailStatusFilter !== 'ALL') {
      result = result.filter(room => {
        if (detailStatusFilter === 'VACANT') return room.vacantBeds > 0;
        if (detailStatusFilter === 'OCCUPIED') return room.occupiedBeds > 0;
        if (detailStatusFilter === 'ONSITE') {
          return room.beds.some(b => b.status === 'Onsite');
        }
        if (detailStatusFilter === 'LEAVE') {
          return room.beds.some(b => b.status === 'On Leave');
        }
        return true;
      });
    }

    return result;
  }, [detailedBuildingRooms, detailSearch, detailStatusFilter]);

  // Flat list of occupants for selected building (table view in modal)
  const selectedBuildingOccupants = useMemo(() => {
    if (!selectedBuilding) return [];
    const bId = selectedBuilding.id;
    return activeStaysToday
      .filter(s => s.building_id === bId)
      .map((s, idx) => ({
        ...s,
        index: idx + 1,
        building_name: selectedBuilding.name
      }));
  }, [selectedBuilding, activeStaysToday]);

  const filteredOccupantsInModal = useMemo(() => {
    let list = selectedBuildingOccupants;
    if (detailSearch.trim()) {
      const q = detailSearch.toLowerCase().trim();
      list = list.filter(o => 
        (o.guest_name && o.guest_name.toLowerCase().includes(q)) ||
        (o.room_no && o.room_no.toLowerCase().includes(q)) ||
        (o.bed_no && o.bed_no.toLowerCase().includes(q))
      );
    }
    if (detailStatusFilter !== 'ALL') {
      if (detailStatusFilter === 'ONSITE') list = list.filter(o => o.status === 'Onsite');
      if (detailStatusFilter === 'LEAVE') list = list.filter(o => o.status === 'Leave' || o.status === 'On Leave');
    }
    return list;
  }, [selectedBuildingOccupants, detailSearch, detailStatusFilter]);

  // ==========================================
  // HISTORY DATABASE LOGIC
  // ==========================================
  const filteredHistoryStays = useMemo(() => {
    let list = siteStays.map(s => {
      const sStart = s.start_date ? s.start_date.split('T')[0] : '';
      const sEnd = s.end_date ? s.end_date.split('T')[0] : '';
      
      let computedStatus = s.status || 'Active';
      if (sEnd && sEnd < todayStr) {
        computedStatus = 'Selesai';
      } else if (computedStatus === 'Leave' || computedStatus === 'On Leave') {
        computedStatus = 'On Leave';
      } else if (computedStatus === 'Onsite') {
        computedStatus = 'Onsite';
      }

      return {
        ...s,
        building_name: buildingMap[s.building_id] || s.building_id || '-',
        computedStatus,
        startDateStr: sStart,
        endDateStr: sEnd
      };
    });

    // Date Range Filter
    if (historyStartDate) {
      list = list.filter(item => {
        const itemEnd = item.endDateStr || '9999-12-31';
        return itemEnd >= historyStartDate;
      });
    }
    if (historyEndDate) {
      list = list.filter(item => {
        const itemStart = item.startDateStr || '0000-01-01';
        return itemStart <= historyEndDate;
      });
    }

    // Building Filter
    if (historyBuildingId !== 'ALL') {
      list = list.filter(item => item.building_id === historyBuildingId);
    }

    // Status Filter
    if (historyStatusFilter !== 'ALL') {
      if (historyStatusFilter === 'ONSITE') {
        list = list.filter(item => item.computedStatus === 'Onsite');
      } else if (historyStatusFilter === 'LEAVE') {
        list = list.filter(item => item.computedStatus === 'On Leave');
      } else if (historyStatusFilter === 'SELESAI') {
        list = list.filter(item => item.computedStatus === 'Selesai');
      }
    }

    // Search Filter
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter(item => 
        (item.guest_name && item.guest_name.toLowerCase().includes(q)) ||
        (item.building_name && item.building_name.toLowerCase().includes(q)) ||
        (item.room_no && item.room_no.toLowerCase().includes(q)) ||
        (item.bed_no && item.bed_no.toLowerCase().includes(q))
      );
    }

    // Sort descending by start_date
    return list.sort((a, b) => (b.startDateStr || '').localeCompare(a.startDateStr || ''));
  }, [siteStays, buildingMap, todayStr, historyStartDate, historyEndDate, historyBuildingId, historyStatusFilter, historySearch]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredHistoryStays.length === 0) {
      toast.error('Tidak ada data riwayat untuk diunduh');
      return;
    }

    const headers = [
      'No',
      'Site',
      'Bangunan',
      'Kamar',
      'Bed',
      'Nama Penghuni',
      'Status',
      'Tanggal Masuk',
      'Tanggal Keluar',
      'Mulai Cuti',
      'Selesai Cuti',
      'Durasi Hari'
    ];

    const rows = filteredHistoryStays.map((item, idx) => {
      const duration = getDurationDays(item.start_date, item.end_date);
      return [
        idx + 1,
        `"${item.site || site}"`,
        `"${(item.building_name || '-').replace(/"/g, '""')}"`,
        `"${item.room_no || '-'}"`,
        `"${item.bed_no || '-'}"`,
        `"${(item.guest_name || '').replace(/"/g, '""')}"`,
        `"${item.computedStatus || item.status || '-'}"`,
        `"${item.startDateStr || '-'}"`,
        `"${item.endDateStr || 'Masih Menginap'}"`,
        `"${item.leave_start ? item.leave_start.split('T')[0] : '-'}"`,
        `"${item.leave_end ? item.leave_end.split('T')[0] : '-'}"`,
        `"${duration}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const nowStr = new Date().toISOString().split('T')[0];
    
    link.href = url;
    link.download = `Riwayat_Mess_${site}_${nowStr}.csv`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success(`Berhasil mengunduh ${filteredHistoryStays.length} baris riwayat`);
  };

  // Quick period presets for history
  const setPeriodPreset = (preset) => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curDay = String(now.getDate()).padStart(2, '0');
    const todayFormatted = `${curYear}-${curMonth}-${curDay}`;

    if (preset === 'ALL') {
      setHistoryStartDate('');
      setHistoryEndDate('');
    } else if (preset === 'THIS_MONTH') {
      setHistoryStartDate(`${curYear}-${curMonth}-01`);
      setHistoryEndDate(todayFormatted);
    } else if (preset === 'LAST_30_DAYS') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      const startStr = d.toISOString().split('T')[0];
      setHistoryStartDate(startStr);
      setHistoryEndDate(todayFormatted);
    } else if (preset === 'THIS_YEAR') {
      setHistoryStartDate(`${curYear}-01-01`);
      setHistoryEndDate(todayFormatted);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Site Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)] flex items-center">
            <Building className="w-6 h-6 mr-2 text-[var(--primary)]" />
            Dashboard Mess
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Pantau okupansi, detail per kamar pada setiap bangunan, dan riwayat penghuni mess.
          </p>
        </div>
        
        {/* Pill Site Selector */}
        <div className="flex p-1 bg-[var(--muted)]/50 rounded-full border border-[var(--border)] relative z-10 w-fit">
          {sites.map(s => (
            <button
              key={s}
              onClick={() => {
                setSite(s);
                setSelectedBuilding(null);
                setHistoryBuildingId('ALL');
              }}
              className={`relative px-6 py-2 text-sm font-bold rounded-full transition-all duration-300 ${
                site === s ? 'text-white shadow-md' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              {site === s && (
                <span className="absolute inset-0 bg-[var(--primary)] rounded-full -z-10 animate-in zoom-in-95 duration-200" />
              )}
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tabs: Ringkasan & Gedung vs History Database */}
      <div className="flex border-b border-[var(--border)] gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'overview'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <Layers className="w-4 h-4" />
          Ringkasan & Bangunan
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'history'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          <History className="w-4 h-4" />
          Database Riwayat ({site})
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--foreground)] font-mono">
            {siteStays.length}
          </span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW & BUILDING CARDS */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Top Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center text-[var(--muted-foreground)] mb-2">
                <BedDouble className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Total Bed</span>
              </div>
              <div className="text-2xl font-bold font-display text-[var(--foreground)]">{stats.totalBed}</div>
            </div>
            
            <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--primary)]/30 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all">
                <CheckCircle2 className="w-12 h-12 text-[var(--primary)]" />
              </div>
              <div className="flex items-center text-[var(--primary)] mb-2">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Bed Terisi</span>
              </div>
              <div className="text-2xl font-bold font-display text-[var(--primary)]">{stats.terisi}</div>
            </div>
            
            <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center text-blue-500 mb-2">
                <Users className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Onsite</span>
              </div>
              <div className="text-2xl font-bold font-display text-[var(--foreground)]">{stats.onsite}</div>
            </div>
            
            <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center text-amber-500 mb-2">
                <Plane className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">On Leave</span>
              </div>
              <div className="text-2xl font-bold font-display text-[var(--foreground)]">{stats.leave}</div>
            </div>
            
            <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center text-emerald-500 mb-2">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Vacant</span>
              </div>
              <div className="text-2xl font-bold font-display text-[var(--foreground)]">{stats.vacant}</div>
            </div>
          </div>

          {/* Building Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" key={site + '-cards'}>
            {buildingStats.map(b => {
              let color = 'bg-emerald-500';
              if (b.pct > 75) color = 'bg-amber-500';
              if (b.pct >= 100) color = 'bg-[var(--destructive)]';

              return (
                <div 
                  key={b.id} 
                  className="bg-[var(--card)] p-5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm flex flex-col group hover:border-[var(--primary)]/50 hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-[var(--foreground)] text-lg truncate group-hover:text-[var(--primary)] transition-colors">
                        {b.name}
                      </h3>
                      <p className="text-xs text-[var(--muted-foreground)]">Site {b.site}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]">
                      {b.total} Beds
                    </span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-[var(--muted-foreground)] font-medium">Okupansi Gedung</span>
                      <span className="font-bold text-[var(--foreground)]">{b.pct}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-[var(--muted)] rounded-full overflow-hidden">
                      <div className={`h-full ${color} transition-all duration-700 ease-out`} style={{ width: `${Math.min(b.pct, 100)}%` }} />
                    </div>
                  </div>

                  {/* Stats Footer */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs divide-x divide-[var(--border)] border-t border-[var(--border)] py-3 bg-[var(--muted)]/20 rounded-[var(--radius-md)] mb-4">
                    <div className="flex flex-col">
                      <span className="text-[var(--muted-foreground)] mb-0.5">Onsite</span>
                      <span className="font-bold text-blue-500 text-sm">{b.onsite}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[var(--muted-foreground)] mb-0.5">Leave</span>
                      <span className="font-bold text-amber-500 text-sm">{b.leave}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[var(--muted-foreground)] mb-0.5">Vacant</span>
                      <span className="font-bold text-emerald-500 text-sm">{b.vacant}</span>
                    </div>
                  </div>

                  {/* Button Detail */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBuilding(b);
                      setDetailSearch('');
                      setDetailStatusFilter('ALL');
                      setDetailViewMode('grid');
                    }}
                    className="w-full mt-auto flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)] hover:text-white rounded-[var(--radius-md)] border border-[var(--primary)]/20 transition-all active:scale-[0.98]"
                  >
                    <Eye className="w-4 h-4" />
                    Lihat Detail Bangunan
                  </button>
                </div>
              );
            })}

            {buildingStats.length === 0 && (
              <div className="col-span-full p-12 text-center text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--muted)]/10">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-[var(--muted-foreground)]" />
                <p className="font-medium text-[var(--foreground)]">Belum ada data bangunan</p>
                <p className="text-xs mt-1">Bangunan belum dikonfigurasi untuk site {site}. Silakan atur di menu Setup Mess.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 2: DATABASE RIWAYAT SITE */}
      {activeTab === 'history' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          
          {/* Controls & Filter Bar */}
          <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm space-y-4">
            
            {/* Top row: search & export button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  placeholder="Cari nama penghuni, kamar, bed..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
                />
                {historySearch && (
                  <button 
                    onClick={() => setHistorySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadData}
                  title="Muat ulang data"
                  className="p-2 border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] hover:opacity-90 rounded-[var(--radius-md)] shadow-sm active:scale-[0.98] transition-all"
                >
                  <Download className="w-4 h-4" />
                  Download CSV / Excel
                </button>
              </div>
            </div>

            {/* Filter Row: Building, Status, Date Period */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[var(--border)]">
              
              {/* Building selector */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                  Bangunan / Gedung
                </label>
                <CustomSelect
                  value={historyBuildingId}
                  onChange={setHistoryBuildingId}
                  options={[
                    { value: 'ALL', label: 'Semua Bangunan' },
                    ...siteBuildings.map(b => ({ value: b.id, label: b.name }))
                  ]}
                />
              </div>

              {/* Status selector */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                  Status Penghuni
                </label>
                <CustomSelect
                  value={historyStatusFilter}
                  onChange={setHistoryStatusFilter}
                  options={[
                    { value: 'ALL', label: 'Semua Status' },
                    { value: 'ONSITE', label: 'Onsite (Aktif)' },
                    { value: 'LEAVE', label: 'On Leave (Cuti)' },
                    { value: 'SELESAI', label: 'Selesai (Past Stay)' }
                  ]}
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-all"
                />
              </div>

            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-[var(--muted-foreground)] font-medium mr-1">Preset Periode:</span>
              <button
                type="button"
                onClick={() => setPeriodPreset('ALL')}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  !historyStartDate && !historyEndDate
                    ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30 font-semibold'
                    : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('THIS_MONTH')}
                className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-all"
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('LAST_30_DAYS')}
                className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-all"
              >
                30 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('THIS_YEAR')}
                className="text-xs px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-all"
              >
                Tahun Ini
              </button>

              {(historyStartDate || historyEndDate || historySearch || historyBuildingId !== 'ALL' || historyStatusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearch('');
                    setHistoryBuildingId('ALL');
                    setHistoryStatusFilter('ALL');
                    setPeriodPreset('ALL');
                  }}
                  className="text-xs text-ruby-500 hover:underline ml-auto"
                >
                  Reset Semua Filter
                </button>
              )}
            </div>

          </div>

          {/* History Flat Table */}
          <div className="bg-[var(--card)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--muted)]/20">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="font-bold text-sm text-[var(--foreground)]">
                  Data Riwayat Penghuni Mess - Site {site}
                </h3>
              </div>
              <span className="text-xs text-[var(--muted-foreground)]">
                Menampilkan <strong className="text-[var(--foreground)]">{filteredHistoryStays.length}</strong> catatan
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Penghuni</th>
                    <th className="py-3 px-4">Bangunan</th>
                    <th className="py-3 px-3">Kamar & Bed</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4">Tgl Masuk</th>
                    <th className="py-3 px-4">Tgl Keluar</th>
                    <th className="py-3 px-4">Info Cuti</th>
                    <th className="py-3 px-3 text-right">Durasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredHistoryStays.map((item, idx) => {
                    let statusBadge = (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        <Users className="w-3 h-3 mr-1" /> Onsite
                      </span>
                    );
                    if (item.computedStatus === 'On Leave') {
                      statusBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          <Plane className="w-3 h-3 mr-1" /> On Leave
                        </span>
                      );
                    } else if (item.computedStatus === 'Selesai') {
                      statusBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-500/10 text-gray-600 border border-gray-500/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Selesai
                        </span>
                      );
                    }

                    return (
                      <tr 
                        key={item.id || idx} 
                        className="hover:bg-[var(--muted)]/30 transition-colors"
                      >
                        <td className="py-3 px-3 text-center text-[var(--muted-foreground)] font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[var(--foreground)]">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-xs shrink-0">
                              {(item.guest_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span>{item.guest_name || '-'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[var(--foreground)] font-medium">
                          {item.building_name}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--foreground)] font-medium">
                            {item.room_no || '-'} - {item.bed_no || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {statusBadge}
                        </td>
                        <td className="py-3 px-4 font-mono text-[var(--muted-foreground)]">
                          {formatDate(item.start_date)}
                        </td>
                        <td className="py-3 px-4 font-mono text-[var(--muted-foreground)]">
                          {item.end_date ? formatDate(item.end_date) : (
                            <span className="text-emerald-600 font-sans font-medium">Masih Menginap</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[var(--muted-foreground)]">
                          {item.leave_start ? (
                            <div className="text-[11px] font-mono">
                              {formatDate(item.leave_start)} s/d {formatDate(item.leave_end)}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-medium text-[var(--foreground)]">
                          {getDurationDays(item.start_date, item.end_date)}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredHistoryStays.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[var(--muted-foreground)]">
                        <History className="w-8 h-8 mx-auto mb-2 opacity-30 text-[var(--muted-foreground)]" />
                        <p className="font-medium">Tidak ada data riwayat yang sesuai</p>
                        <p className="text-xs mt-1">Coba sesuaikan filter tanggal atau kata kunci pencarian Anda.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DETAIL BANGUNAN MESS */}
      {/* ======================================================== */}
      {selectedBuilding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-[var(--card)] w-full max-w-5xl max-h-[90vh] rounded-[var(--radius-xl)] border border-[var(--border)] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--muted)]/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[var(--foreground)] font-display">
                      {selectedBuilding.name}
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/20">
                      Site {selectedBuilding.site || site}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Informasi terperinci kapasitas kamar, ketersediaan kasur, dan status seluruh penghuni saat ini.
                  </p>
                </div>
              </div>

              {/* View Switcher & Close */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <div className="flex p-0.5 bg-[var(--muted)] rounded-[var(--radius-md)] border border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setDetailViewMode('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${
                      detailViewMode === 'grid'
                        ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                    Grid Kamar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${
                      detailViewMode === 'table'
                        ? 'bg-[var(--card)] text-[var(--foreground)] shadow-sm'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    Daftar Penghuni ({selectedBuildingOccupants.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBuilding(null)}
                  className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-full transition-colors ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick KPI Bar inside Modal */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-[var(--background)]/50 border-b border-[var(--border)] shrink-0">
              <div className="bg-[var(--card)] p-3 rounded-[var(--radius-md)] border border-[var(--border)]">
                <span className="text-xs text-[var(--muted-foreground)] block">Total Kamar</span>
                <span className="text-lg font-bold text-[var(--foreground)]">{detailedBuildingRooms.length} Kamar</span>
              </div>
              <div className="bg-[var(--card)] p-3 rounded-[var(--radius-md)] border border-[var(--border)]">
                <span className="text-xs text-[var(--muted-foreground)] block">Kapasitas Bed</span>
                <span className="text-lg font-bold text-[var(--foreground)]">{selectedBuilding.total} Bed</span>
              </div>
              <div className="bg-[var(--card)] p-3 rounded-[var(--radius-md)] border border-[var(--border)]">
                <span className="text-xs text-[var(--muted-foreground)] block">Onsite (Di Mess)</span>
                <span className="text-lg font-bold text-blue-500">{selectedBuilding.onsite} Orang</span>
              </div>
              <div className="bg-[var(--card)] p-3 rounded-[var(--radius-md)] border border-[var(--border)]">
                <span className="text-xs text-[var(--muted-foreground)] block">On Leave (Cuti)</span>
                <span className="text-lg font-bold text-amber-500">{selectedBuilding.leave} Orang</span>
              </div>
              <div className="bg-[var(--card)] p-3 rounded-[var(--radius-md)] border border-[var(--border)]">
                <span className="text-xs text-[var(--muted-foreground)] block">Bed Kosong (Vacant)</span>
                <span className="text-lg font-bold text-emerald-500">{selectedBuilding.vacant} Bed</span>
              </div>
            </div>

            {/* Filter & Search inside Modal */}
            <div className="p-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--card)] shrink-0">
              <div className="relative flex-1 min-w-[240px] max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  placeholder="Cari penghuni atau nomor kamar..."
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                {detailSearch && (
                  <button onClick={() => setDetailSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Status Filter Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[var(--muted-foreground)] mr-1">Filter:</span>
                {[
                  { key: 'ALL', label: 'Semua' },
                  { key: 'OCCUPIED', label: 'Terisi' },
                  { key: 'ONSITE', label: 'Onsite' },
                  { key: 'LEAVE', label: 'Cuti' },
                  { key: 'VACANT', label: 'Kosong' }
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setDetailStatusFilter(f.key)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      detailStatusFilter === f.key
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)] font-semibold'
                        : 'bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body: Grid or Table View */}
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-[var(--background)]/30">
              
              {/* VIEW 1: GRID KAMAR & BED */}
              {detailViewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRooms.map(room => (
                    <div 
                      key={room.roomNo}
                      className="bg-[var(--card)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm overflow-hidden flex flex-col hover:border-[var(--primary)]/40 transition-colors"
                    >
                      {/* Room Header */}
                      <div className="px-4 py-2.5 bg-[var(--muted)]/30 border-b border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                          <span className="font-bold text-sm text-[var(--foreground)] font-display">
                            Kamar {room.roomNo}
                          </span>
                        </div>
                        <span className="text-xs text-[var(--muted-foreground)] font-medium">
                          {room.occupiedBeds} / {room.bedCount} Bed Terisi
                        </span>
                      </div>

                      {/* Beds in Room */}
                      <div className="p-3 space-y-2.5 flex-1">
                        {room.beds.map(bed => {
                          const isOccupied = !!bed.occupant;
                          const isLeave = bed.status === 'On Leave';

                          return (
                            <div 
                              key={bed.bedNo}
                              className={`p-3 rounded-[var(--radius-md)] border transition-all ${
                                !isOccupied
                                  ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                  : isLeave
                                    ? 'bg-amber-500/5 border-amber-500/20'
                                    : 'bg-blue-500/5 border-blue-500/20'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <BedDouble className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                                  <span className="font-bold text-xs text-[var(--foreground)]">
                                    {bed.bedNo}
                                  </span>
                                </div>

                                {isOccupied ? (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                    isLeave 
                                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' 
                                      : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                  }`}>
                                    {isLeave ? <Plane className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                                    {bed.status}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    Vacant
                                  </span>
                                )}
                              </div>

                              {isOccupied ? (
                                <div className="space-y-1 mt-2">
                                  <div className="flex items-center gap-1.5">
                                    <User className="w-3 h-3 text-[var(--primary)] shrink-0" />
                                    <span className="font-bold text-xs text-[var(--foreground)] truncate">
                                      {bed.occupant.guest_name}
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
                                    <span>Masuk: {formatDate(bed.occupant.start_date)}</span>
                                  </div>

                                  {bed.occupant.end_date && (
                                    <div className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-[var(--muted-foreground)] shrink-0" />
                                      <span>Sampai: {formatDate(bed.occupant.end_date)}</span>
                                    </div>
                                  )}

                                  {isLeave && bed.occupant.leave_start && (
                                    <div className="mt-1 p-1.5 rounded bg-amber-500/10 text-amber-800 dark:text-amber-200 text-[10px]">
                                      Cuti: {formatDate(bed.occupant.leave_start)} s/d {formatDate(bed.occupant.leave_end)}
                                    </div>
                                  )}

                                  <div className="text-[10px] text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)]/50 mt-1 flex justify-between">
                                    <span>Durasi menginap:</span>
                                    <span className="font-medium text-[var(--foreground)]">
                                      {getDurationDays(bed.occupant.start_date, bed.occupant.end_date)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-2 text-center text-xs text-emerald-600/80 font-medium">
                                  Kamar & bed tersedia
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  ))}

                  {filteredRooms.length === 0 && (
                    <div className="col-span-full py-12 text-center text-[var(--muted-foreground)]">
                      <BedDouble className="w-8 h-8 mx-auto mb-2 opacity-30 text-[var(--muted-foreground)]" />
                      <p className="font-medium">Tidak ada kamar yang sesuai filter</p>
                      <p className="text-xs mt-1">Coba sesuaikan kata kunci pencarian atau filter status.</p>
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: TABLE DAFTAR PENGHUNI */}
              {detailViewMode === 'table' && (
                <div className="bg-[var(--card)] rounded-[var(--radius-lg)] border border-[var(--border)] overflow-hidden shadow-sm">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                          <th className="py-2.5 px-3 w-10 text-center">No</th>
                          <th className="py-2.5 px-4">Nama Penghuni</th>
                          <th className="py-2.5 px-3">Kamar</th>
                          <th className="py-2.5 px-3">Bed</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-4">Tanggal Masuk</th>
                          <th className="py-2.5 px-4">Tanggal Keluar</th>
                          <th className="py-2.5 px-4">Info Cuti</th>
                          <th className="py-2.5 px-3 text-right">Durasi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {filteredOccupantsInModal.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-[var(--muted)]/30 transition-colors">
                            <td className="py-2.5 px-3 text-center text-[var(--muted-foreground)] font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-[var(--foreground)]">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-xs shrink-0">
                                  {(item.guest_name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span>{item.guest_name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium text-[var(--foreground)]">
                              {item.room_no}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[var(--muted-foreground)]">
                              {item.bed_no}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === 'Leave' || item.status === 'On Leave'
                                  ? 'bg-amber-500/15 text-amber-600 border border-amber-500/20'
                                  : 'bg-blue-500/15 text-blue-600 border border-blue-500/20'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[var(--muted-foreground)]">
                              {formatDate(item.start_date)}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-[var(--muted-foreground)]">
                              {item.end_date ? formatDate(item.end_date) : (
                                <span className="text-emerald-600 font-sans font-medium">Masih Menginap</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-[var(--muted-foreground)]">
                              {item.leave_start ? (
                                <span className="text-[11px] font-mono">
                                  {formatDate(item.leave_start)} s/d {formatDate(item.leave_end)}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-[var(--foreground)]">
                              {getDurationDays(item.start_date, item.end_date)}
                            </td>
                          </tr>
                        ))}

                        {filteredOccupantsInModal.length === 0 && (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-[var(--muted-foreground)]">
                              Tidak ada penghuni aktif yang ditemukan pada bangunan ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--border)] flex justify-between items-center bg-[var(--muted)]/20 shrink-0">
              <span className="text-xs text-[var(--muted-foreground)]">
                Terakhir diperbarui: {new Date().toLocaleTimeString('id-ID')}
              </span>
              <button
                type="button"
                onClick={() => setSelectedBuilding(null)}
                className="px-4 py-2 text-xs font-semibold rounded-[var(--radius-md)] bg-[var(--muted)] hover:bg-[var(--muted)]/80 text-[var(--foreground)] transition-colors"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
