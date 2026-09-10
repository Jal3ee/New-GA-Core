import React, { useState, useEffect, useMemo } from 'react';
import { useGlobalLoading } from '../context/LoadingContext';
import { api } from '../lib/gasClient';
import { toast } from 'sonner';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import CustomSelect from '../components/ui/CustomSelect';

export default function MessMatrixPage() {
  const { showLoading, hideLoading } = useGlobalLoading();
  const [buildings, setBuildings] = useState([]);
  const [stays, setStays] = useState([]);
  
  const [site, setSite] = useState('LBCT');
  const [filterBuilding, setFilterBuilding] = useState('All');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const sites = ['LBCT', 'IDMG', 'SPCT'];

  useEffect(() => {
    setFilterBuilding('All');
  }, [site]);

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
      toast.error(`Gagal memuat data matriks`);
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter for current site and building
  const siteBuildings = useMemo(() => {
    let list = buildings.filter(b => b.site === site);
    if (filterBuilding !== 'All') {
      list = list.filter(b => b.id === filterBuilding);
    }
    return list;
  }, [buildings, site, filterBuilding]);
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

  const today = new Date();

  // Calendar logic
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // Determine if a bed is occupied on a specific day
  const isOccupiedOnDay = (stay, day) => {
    if (!stay.start_date) return false;
    const dStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const start = stay.start_date.split('T')[0];
    const end = stay.end_date ? stay.end_date.split('T')[0] : '9999-12-31';
    return dStr >= start && dStr <= end;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-120px)] flex flex-col">
      
      {/* Header & Site Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)] flex items-center">
            <CalendarDays className="w-6 h-6 mr-2 text-[var(--primary)]" />
            Matriks Okupansi
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Lihat detail penghuni pada setiap kasur dalam tampilan kalender bulanan.
          </p>
        </div>
        
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

      {/* Calendar Matrix View */}
      <div className="bg-[var(--card)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm flex flex-col flex-1 overflow-hidden animate-in slide-in-from-bottom-4 duration-700 relative">
        
        {/* Calendar Header */}
        <div className="p-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between bg-[var(--muted)]/20 shrink-0 gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="font-bold text-[var(--foreground)] flex items-center">
              <CalendarDays className="w-5 h-5 mr-2 text-[var(--primary)]" />
              Matriks Kamar - {site}
            </h2>
            <div className="w-56">
              <CustomSelect 
                value={filterBuilding}
                onChange={setFilterBuilding}
                options={[
                  { value: 'All', label: 'Semua Bangunan' },
                  ...buildings.filter(b => b.site === site).map(b => ({
                    value: b.id,
                    label: b.name
                  }))
                ]}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1.5 hover:bg-[var(--muted)] rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-medium text-sm w-32 text-center bg-[var(--background)] py-1 rounded-md border border-[var(--border)]">
              {currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className="p-1.5 hover:bg-[var(--muted)] rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Matrix Grid */}
        <div className="overflow-auto custom-scrollbar flex-1 relative">
          <div className="min-w-max pb-4">
            
            {/* Headers (Days) */}
            <div className="flex border-b border-[var(--border)] bg-[var(--muted)]/50 sticky top-0 z-20 shadow-sm">
              <div className="w-48 shrink-0 p-3 font-semibold text-xs text-[var(--muted-foreground)] border-r border-[var(--border)] sticky left-0 bg-[var(--card)] z-30 flex items-center">
                Bangunan / Kamar
              </div>
              {daysArray.map(d => {
                const isToday = (today.getDate() === d && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear());
                return (
                  <div key={d} className={`w-10 shrink-0 p-2 text-center text-xs font-medium border-r border-[var(--border)] flex items-center justify-center ${isToday ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : 'text-[var(--foreground)]'}`}>
                    {d}
                  </div>
                )
              })}
            </div>

            {/* Rows (Beds) */}
            <div className="divide-y divide-[var(--border)]">
              {siteBuildings.map(b => {
                const bBeds = allBeds.filter(bed => bed.building_id === b.id);
                if (bBeds.length === 0) return null;
                
                return (
                  <React.Fragment key={b.id}>
                    {/* Building Group Header */}
                    <div className="flex bg-[var(--muted)]/20">
                      <div className="w-48 shrink-0 p-2 pl-3 font-bold text-xs text-[var(--foreground)] border-r border-[var(--border)] sticky left-0 bg-[var(--card)]/95 backdrop-blur z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] flex items-center">
                        {b.name}
                      </div>
                      <div className="flex-1" />
                    </div>

                    {/* Beds */}
                    {bBeds.map(bed => {
                      // Find stay history for this bed in this month
                      const bedStays = siteStays.filter(s => s.building_id === b.id && s.room_no === bed.room_no && s.bed_no === bed.bed_no);
                      
                      return (
                        <div key={bed.full_id} className="flex hover:bg-[var(--muted)]/30 transition-colors group">
                          <div className="w-48 shrink-0 p-2 pl-6 text-xs font-medium text-[var(--muted-foreground)] border-r border-[var(--border)] sticky left-0 bg-[var(--card)] z-10 group-hover:text-[var(--foreground)] transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] flex items-center">
                            {bed.label}
                          </div>
                          {daysArray.map(d => {
                            const occupiedStay = bedStays.find(s => isOccupiedOnDay(s, d));
                            
                            let cellBg = 'bg-transparent';
                            let tooltip = '';
                            if (occupiedStay) {
                              if (occupiedStay.status === 'Onsite') cellBg = 'bg-blue-500/80';
                              else if (occupiedStay.status === 'Leave' || occupiedStay.status === 'On Leave') cellBg = 'bg-amber-500/80';
                              else cellBg = 'bg-gray-500/80'; // fallback
                              
                              tooltip = `${occupiedStay.guest_name} (${occupiedStay.status})`;
                              if (occupiedStay.leave_start) tooltip += ` | Cuti: ${occupiedStay.leave_start} s/d ${occupiedStay.leave_end}`;
                            }

                            return (
                              <div 
                                key={d} 
                                title={tooltip}
                                className={`w-10 shrink-0 border-r border-[var(--border)] h-8 flex items-center justify-center p-0.5`}
                              >
                                {occupiedStay && (
                                  <div className={`w-full h-full rounded-sm ${cellBg} shadow-sm transition-transform hover:scale-110 cursor-pointer`} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      );
                    })}
                  </React.Fragment>
                )
              })}
              {siteBuildings.length === 0 && (
                <div className="p-8 text-center text-sm text-[var(--muted-foreground)] sticky left-0">
                  Tidak ada data kamar untuk ditampilkan.
                </div>
              )}
            </div>
            
          </div>
        </div>

        {/* Legend */}
        <div className="p-3 border-t border-[var(--border)] bg-[var(--muted)]/20 flex gap-4 text-xs font-medium text-[var(--muted-foreground)] justify-center shrink-0">
          <div className="flex items-center"><div className="w-3 h-3 rounded-sm bg-blue-500/80 mr-2" /> Onsite</div>
          <div className="flex items-center"><div className="w-3 h-3 rounded-sm bg-amber-500/80 mr-2" /> On Leave</div>
        </div>
      </div>

    </div>
  );
}
