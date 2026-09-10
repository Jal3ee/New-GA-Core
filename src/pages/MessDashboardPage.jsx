import React, { useState, useEffect, useMemo } from 'react';
import { useGlobalLoading } from '../context/LoadingContext';
import { api } from '../lib/gasClient';
import { toast } from 'sonner';
import { BedDouble, Users, Plane, CheckCircle2, ChevronLeft, ChevronRight, Building } from 'lucide-react';

export default function MessDashboardPage() {
  const { showLoading, hideLoading } = useGlobalLoading();
  const [buildings, setBuildings] = useState([]);
  const [stays, setStays] = useState([]);
  
  // Single dashboard states
  const [site, setSite] = useState('LBCT');
  const [currentDate, setCurrentDate] = useState(new Date());
  
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
      toast.error(`Gagal memuat data mess`);
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

  // Generate all beds flat list
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
    const vacant = totalBed - terisi;
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
      const vacant = bBeds - terisi;
      const pct = bBeds === 0 ? 0 : Math.round((terisi / bBeds) * 100);
      return { id: b.id, name: b.name, total: bBeds, onsite, leave, vacant, pct };
    });
  }, [siteBuildings, allBeds, activeStaysToday]);



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
            Pantau ringkasan okupansi dan ketersediaan tempat tidur secara keseluruhan.
          </p>
        </div>
        
        {/* Pill Site Selector */}
        <div className="flex p-1 bg-[var(--muted)]/50 rounded-full border border-[var(--border)] relative z-10 w-fit">
          {sites.map(s => (
            <button
              key={s}
              onClick={() => setSite(s)}
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

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center text-[var(--muted-foreground)] mb-2">
            <BedDouble className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Total Bed</span>
          </div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{stats.totalBed}</div>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--primary)]/30 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 group-hover:opacity-20 transition-all">
            <CheckCircle2 className="w-12 h-12 text-[var(--primary)]" />
          </div>
          <div className="flex items-center text-[var(--primary)] mb-2">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Bed Terisi</span>
          </div>
          <div className="text-2xl font-bold text-[var(--primary)]">{stats.terisi}</div>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center text-blue-500 mb-2">
            <Users className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Onsite</span>
          </div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{stats.onsite}</div>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center text-amber-500 mb-2">
            <Plane className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">On Leave</span>
          </div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{stats.leave}</div>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center text-emerald-500 mb-2">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Vacant</span>
          </div>
          <div className="text-2xl font-bold text-[var(--foreground)]">{stats.vacant}</div>
        </div>
      </div>

      {/* Building Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-bottom-2 duration-500" key={site + '-cards'}>
        {buildingStats.map(b => {
          let color = 'bg-emerald-500'; // vacant
          if (b.pct > 75) color = 'bg-amber-500'; // near full
          if (b.pct >= 100) color = 'bg-[var(--destructive)]'; // full

          return (
            <div key={b.id} className="bg-[var(--card)] p-5 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm flex flex-col group hover:border-[var(--primary)]/50 transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-[var(--foreground)] text-lg truncate group-hover:text-[var(--primary)] transition-colors">{b.name}</h3>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  {b.total} Beds
                </span>
              </div>
              
              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--muted-foreground)] font-medium">Okupansi</span>
                  <span className="font-bold text-[var(--foreground)]">{b.pct}%</span>
                </div>
                <div className="w-full h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div className={`h-full ${color} transition-all duration-1000 ease-out`} style={{ width: `${Math.min(b.pct, 100)}%` }} />
                </div>
              </div>

              {/* Stats Footer */}
              <div className="mt-auto grid grid-cols-3 gap-2 text-center text-xs divide-x divide-[var(--border)] border-t border-[var(--border)] pt-3">
                <div className="flex flex-col">
                  <span className="text-[var(--muted-foreground)] mb-1">Onsite</span>
                  <span className="font-bold text-blue-500">{b.onsite}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[var(--muted-foreground)] mb-1">Leave</span>
                  <span className="font-bold text-amber-500">{b.leave}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[var(--muted-foreground)] mb-1">Vacant</span>
                  <span className="font-bold text-emerald-500">{b.vacant}</span>
                </div>
              </div>
            </div>
          )
        })}
        {buildingStats.length === 0 && (
          <div className="col-span-full p-8 text-center text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-[var(--radius-lg)] bg-[var(--muted)]/10">
            Belum ada bangunan yang dikonfigurasi untuk site {site}.
          </div>
        )}
      </div>

    </div>
  );
}
