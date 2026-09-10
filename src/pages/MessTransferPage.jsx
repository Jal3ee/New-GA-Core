import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useGlobalLoading } from '../context/LoadingContext';
import { api } from '../lib/gasClient';
import { toast } from 'sonner';
import { ArrowRightLeft, UserPlus, LogOut, CheckCircle2, PlayCircle, Undo2, Users, Download, Building2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../components/ui/CustomSelect';
import { toPng } from 'html-to-image';
import SimulationReportGraphic from '../components/mess/SimulationReportGraphic';

export default function MessTransferPage() {
  const { showLoading, hideLoading } = useGlobalLoading();
  const [buildings, setBuildings] = useState([]);
  const [stays, setStays] = useState([]);
  
  const [selectedSite, setSelectedSite] = useState('LBCT');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [pendingActions, setPendingActions] = useState([]);
  
  const draftPanelRef = useRef(null);
  const reportGraphicRef = useRef(null);

  // Modals
  const [modalMode, setModalMode] = useState(null); // 'CHECK_IN', 'MANAGE_OCCUPANT', 'TRANSFER_SELECT_TARGET'
  const [selectedBed, setSelectedBed] = useState(null); 
  
  const [guestName, setGuestName] = useState('');
  const [guestStatus, setGuestStatus] = useState('Onsite');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');

  const loadData = async () => {
    try {
      showLoading();
      const [bRes, sRes] = await Promise.all([
        api.getMessBuildings(),
        api.getMessStays()
      ]);
      setBuildings(bRes.data || []);
      setStays(sRes.data || []);
      setPendingActions([]);
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

  // Update selected building when site changes
  const siteBuildings = useMemo(() => buildings.filter(b => b.site === selectedSite), [buildings, selectedSite]);
  
  useEffect(() => {
    if (siteBuildings.length > 0 && !siteBuildings.find(b => b.id === selectedBuildingId)) {
      setSelectedBuildingId(siteBuildings[0].id);
    } else if (siteBuildings.length === 0) {
      setSelectedBuildingId('');
    }
  }, [siteBuildings, selectedBuildingId]);

  // Compute Current State (Merging Database + Pending Actions)
  const currentState = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Get active stays from DB
    let currentStays = stays.filter(s => {
      if (!s.start_date) return false;
      const start = s.start_date.split('T')[0];
      const end = s.end_date ? s.end_date.split('T')[0] : '9999-12-31';
      return today >= start && today <= end;
    });

    // 2. Apply pending actions to simulate future state
    pendingActions.forEach(action => {
      if (action.type === 'CHECK_IN') {
        currentStays.push({ ...action.payload, id: action.tempId });
      } else if (action.type === 'CHECK_OUT') {
        currentStays = currentStays.filter(s => s.id !== action.stayId);
      } else if (action.type === 'TRANSFER') {
        currentStays = currentStays.filter(s => s.id !== action.stayId);
        currentStays.push({ ...action.payload, id: action.tempId });
      }
    });

    return currentStays;
  }, [stays, pendingActions]);

  // Generate beds for SELECTED BUILDING ONLY
  const activeBuildingBeds = useMemo(() => {
    const list = [];
    const b = siteBuildings.find(b => b.id === selectedBuildingId);
    if (!b) return list;

    const config = Array.isArray(b.room_config_json) ? b.room_config_json : [];
    config.forEach(c => {
      const start = parseInt(c.range_start) || 1;
      const end = parseInt(c.range_end) || start;
      const beds = parseInt(c.beds) || 1;
      for (let r = start; r <= end; r++) {
        for (let bed = 1; bed <= beds; bed++) {
          const bedFullId = `${b.id}_K${r}_B${bed}`;
          const occupant = currentState.find(s => s.building_id === b.id && s.room_no === `K${r}` && s.bed_no === `B${bed}`);
          
          list.push({
            building_id: b.id,
            building_name: b.name,
            room_no: `K${r}`,
            bed_no: `B${bed}`,
            label: beds > 1 ? `K${r} - B${bed}` : `K${r} - B1`,
            full_id: bedFullId,
            occupant: occupant || null,
            isPendingTarget: pendingActions.some(a => 
              (a.type === 'CHECK_IN' || a.type === 'TRANSFER') && 
              a.payload.building_id === b.id && a.payload.room_no === `K${r}` && a.payload.bed_no === `B${bed}`
            ),
            isPendingSource: pendingActions.some(a => 
              (a.type === 'CHECK_OUT' || a.type === 'TRANSFER') && a.originalBedFullId === bedFullId
            )
          });
        }
      }
    });
    return list;
  }, [siteBuildings, selectedBuildingId, currentState, pendingActions]);


  // Action Handlers
  const handleCheckInSubmit = (e) => {
    e.preventDefault();
    if (!selectedBed || !guestName) return;
    if ((guestStatus === 'Leave' || guestStatus === 'On Leave') && (!leaveStart || !leaveEnd)) {
      toast.error('Harap isi durasi cuti');
      return;
    }
    
    setPendingActions(prev => [...prev, {
      id: Date.now().toString(),
      tempId: `temp_${Date.now()}`,
      type: 'CHECK_IN',
      desc: `Check-in ${guestName} ke ${selectedBed.building_name} (${selectedBed.label})`,
      payload: {
        site: selectedSite,
        building_id: selectedBed.building_id,
        room_no: selectedBed.room_no,
        bed_no: selectedBed.bed_no,
        guest_name: guestName,
        status: guestStatus,
        start_date: new Date().toISOString(),
        end_date: '',
        leave_start: guestStatus === 'Leave' ? leaveStart : '',
        leave_end: guestStatus === 'Leave' ? leaveEnd : ''
      }
    }]);
    closeModal();
  };

  const handleUpdateStatus = (e) => {
    e.preventDefault();
    if (!selectedBed || !selectedBed.occupant) return;
    
    // Simulate Status Change as TRANSFER to same bed
    const occupant = selectedBed.occupant;
    setPendingActions(prev => [...prev, {
      id: Date.now().toString(),
      tempId: `temp_${Date.now()}`,
      type: 'TRANSFER',
      stayId: occupant.id,
      originalBedFullId: selectedBed.full_id,
      desc: `Update status ${occupant.guest_name} menjadi ${guestStatus}`,
      payload: {
        site: selectedSite,
        building_id: selectedBed.building_id,
        room_no: selectedBed.room_no,
        bed_no: selectedBed.bed_no,
        guest_name: occupant.guest_name,
        status: guestStatus,
        start_date: occupant.start_date,
        end_date: '',
        leave_start: guestStatus === 'Leave' ? leaveStart : '',
        leave_end: guestStatus === 'Leave' ? leaveEnd : ''
      }
    }]);
    closeModal();
  };

  const handleCheckOutSubmit = () => {
    if (!selectedBed || !selectedBed.occupant) return;
    
    setPendingActions(prev => [...prev, {
      id: Date.now().toString(),
      type: 'CHECK_OUT',
      stayId: selectedBed.occupant.id,
      originalBedFullId: selectedBed.full_id,
      desc: `Check-out ${selectedBed.occupant.guest_name} dari ${selectedBed.building_name} (${selectedBed.label})`
    }]);
    closeModal();
  };

  const handleTransferInit = () => {
    setModalMode('TRANSFER_SELECT_TARGET');
  };

  const handleTransferSelectTarget = (targetBed) => {
    if (targetBed.occupant) {
      toast.error('Kasur tujuan sudah terisi!');
      return;
    }
    
    setPendingActions(prev => [...prev, {
      id: Date.now().toString(),
      tempId: `temp_${Date.now()}`,
      type: 'TRANSFER',
      stayId: selectedBed.occupant.id,
      originalBedFullId: selectedBed.full_id,
      desc: `Pindah ${selectedBed.occupant.guest_name} ke ${targetBed.building_name} (${targetBed.label})`,
      payload: {
        site: selectedSite,
        building_id: targetBed.building_id,
        room_no: targetBed.room_no,
        bed_no: targetBed.bed_no,
        guest_name: selectedBed.occupant.guest_name,
        status: selectedBed.occupant.status,
        start_date: new Date().toISOString(),
        end_date: '',
        leave_start: selectedBed.occupant.leave_start || '',
        leave_end: selectedBed.occupant.leave_end || ''
      }
    }]);
    closeModal();
  };

  const undoAction = (actionId) => {
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedBed(null);
    setGuestName('');
    setGuestStatus('Onsite');
    setLeaveStart('');
    setLeaveEnd('');
  };

  const commitChanges = async () => {
    if (pendingActions.length === 0) return;
    const today = new Date().toISOString();
    const batchApiPayload = [];
    
    pendingActions.forEach(action => {
      if (action.type === 'CHECK_IN') {
        batchApiPayload.push({ type: 'CREATE', payload: action.payload });
      } else if (action.type === 'CHECK_OUT') {
        if (!action.stayId.startsWith('temp_')) {
          batchApiPayload.push({ type: 'UPDATE', id: action.stayId, payload: { end_date: today } });
        }
      } else if (action.type === 'TRANSFER') {
        if (!action.stayId.startsWith('temp_')) {
          batchApiPayload.push({ type: 'UPDATE', id: action.stayId, payload: { end_date: today } });
        }
        batchApiPayload.push({ type: 'CREATE', payload: action.payload });
      }
    });

    try {
      showLoading();
      await api.batchUpdateStays(batchApiPayload);
      toast.success('Simulasi berhasil direalisasikan ke database!');
      loadData();
    } catch (err) {
      toast.error('Gagal menyimpan perubahan ke database');
    } finally {
      hideLoading();
    }
  };

  const exportAsImage = async () => {
    if (!reportGraphicRef.current) return;
    try {
      showLoading();
      const dataUrl = await toPng(reportGraphicRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `Draft_Simulasi_${selectedSite}_${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Draf simulasi berhasil diunduh sebagai gambar');
    } catch (err) {
      console.error("Export Image Error:", err);
      toast.error('Gagal mengunduh draf simulasi: ' + (err.message || 'Error tidak diketahui'));
    } finally {
      hideLoading();
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)] flex items-center">
            <ArrowRightLeft className="w-6 h-6 mr-2 text-[var(--primary)]" />
            Simulasi & Transfer
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Pilih site, lalu pilih bangunan untuk mengatur draft check-in / check-out.
          </p>
        </div>
        
        <div className="flex p-1 bg-[var(--muted)]/50 rounded-full border border-[var(--border)] relative z-10 w-fit">
          {['LBCT', 'IDMG', 'SPCT'].map(s => (
            <button
              key={s}
              onClick={() => {
                if (pendingActions.length > 0) {
                  if (window.confirm('Berpindah site akan menghapus draft simulasi saat ini. Lanjutkan?')) {
                    setPendingActions([]);
                    setSelectedSite(s);
                  }
                } else {
                  setSelectedSite(s);
                }
              }}
              className={`relative px-5 py-2 text-sm font-bold rounded-full transition-all duration-300 ${
                selectedSite === s ? 'text-white shadow-md' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]'
              }`}
            >
              {selectedSite === s && (
                <span className="absolute inset-0 bg-[var(--primary)] rounded-full -z-10 animate-in zoom-in-95 duration-200" />
              )}
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        
        {/* Left Sidebar: Building Selector */}
        <div className="w-64 shrink-0 bg-[var(--card)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
            <h2 className="font-semibold text-[var(--foreground)] text-sm uppercase tracking-wide">Pilih Bangunan</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {siteBuildings.length === 0 ? (
              <div className="p-4 text-center text-sm text-[var(--muted-foreground)]">Belum ada bangunan</div>
            ) : (
              siteBuildings.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBuildingId(b.id)}
                  className={`w-full flex items-center p-3 text-left rounded-md transition-colors ${
                    selectedBuildingId === b.id 
                      ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-bold' 
                      : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] font-medium'
                  }`}
                >
                  <Building2 className={`w-4 h-4 mr-3 ${selectedBuildingId === b.id ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'}`} />
                  <span className="truncate">{b.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center: Bed Map */}
        <div className="flex-1 bg-[var(--card)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm flex flex-col overflow-hidden relative">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--muted)]/30 flex justify-between items-center shrink-0">
            <h2 className="font-semibold text-[var(--foreground)]">
              Peta Kamar - {siteBuildings.find(b => b.id === selectedBuildingId)?.name || 'Pilih Bangunan'}
            </h2>
            {modalMode === 'TRANSFER_SELECT_TARGET' && (
              <span className="text-sm px-3 py-1 bg-amber-500/10 text-amber-500 font-medium rounded-full animate-pulse flex items-center">
                Pilih kamar tujuan untuk {selectedBed?.occupant?.guest_name}...
              </span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {activeBuildingBeds.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
                {selectedBuildingId ? 'Tidak ada data kamar.' : 'Silakan pilih bangunan di sebelah kiri.'}
              </div>
            ) : (
              <div key={selectedBuildingId} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 animate-in slide-in-from-bottom-2 duration-300">
                {activeBuildingBeds.map(bed => {
                  const isOccupied = !!bed.occupant;
                  
                  let bg = 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30';
                  let text = 'text-emerald-700 dark:text-emerald-400';
                  let statusDot = 'bg-emerald-500';
                  
                  if (isOccupied) {
                    bg = 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30';
                    text = 'text-blue-700 dark:text-blue-400';
                    statusDot = 'bg-blue-500';
                    if (bed.occupant.status === 'Leave' || bed.occupant.status === 'On Leave') {
                      bg = 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30';
                      text = 'text-amber-700 dark:text-amber-400';
                      statusDot = 'bg-amber-500';
                    }
                  }

                  if (bed.isPendingTarget) {
                    bg = 'bg-purple-500/20 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)] animate-pulse';
                    text = 'text-purple-700 dark:text-purple-400';
                  } else if (bed.isPendingSource && !isOccupied) {
                    bg = 'bg-[var(--muted)] opacity-50 border-dashed border-[var(--border)]';
                    text = 'text-[var(--muted-foreground)] line-through';
                  }

                  return (
                    <button
                      key={bed.full_id}
                      onClick={() => {
                        if (modalMode === 'TRANSFER_SELECT_TARGET') {
                          handleTransferSelectTarget(bed);
                        } else {
                          setSelectedBed(bed);
                          if (isOccupied) {
                            setGuestStatus(bed.occupant.status);
                            setLeaveStart(bed.occupant.leave_start || '');
                            setLeaveEnd(bed.occupant.leave_end || '');
                            setModalMode('MANAGE_OCCUPANT');
                          } else {
                            setModalMode('CHECK_IN');
                          }
                        }
                      }}
                      disabled={modalMode === 'TRANSFER_SELECT_TARGET' && isOccupied}
                      className={`p-4 text-left rounded-[var(--radius-lg)] border flex flex-col transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] active:scale-95 disabled:active:scale-100 disabled:cursor-not-allowed group ${bg}`}
                    >
                      <div className="flex justify-between items-center mb-2 w-full">
                        <span className={`text-sm font-bold ${text}`}>{bed.label}</span>
                        <div className={`w-2.5 h-2.5 rounded-full ${statusDot} shadow-sm group-hover:scale-125 transition-transform`} />
                      </div>
                      <div className="text-sm font-medium text-[var(--foreground)] truncate w-full">
                        {isOccupied ? bed.occupant.guest_name : 'Kosong'}
                      </div>
                      {isOccupied && bed.occupant.status === 'Leave' && (
                        <div className="text-[10px] text-[var(--muted-foreground)] mt-1 truncate">
                          {bed.occupant.leave_start} s/d {bed.occupant.leave_end}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Draft Panel (Exportable) */}
        <div className="w-80 shrink-0 bg-[var(--card)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm flex flex-col overflow-hidden">
          <div ref={draftPanelRef} className="flex flex-col h-full bg-[var(--card)]">
            <div className="p-4 border-b border-[var(--border)] bg-[var(--muted)]/30 flex justify-between items-center shrink-0">
              <h2 className="font-semibold text-[var(--foreground)] flex items-center">
                Draf Simulasi
                {pendingActions.length > 0 && (
                  <span className="ml-2 bg-[var(--primary)] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingActions.length}
                  </span>
                )}
              </h2>
              {pendingActions.length > 0 && (
                <button onClick={exportAsImage} title="Download Laporan (Gambar)" className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-md transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
              {pendingActions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 opacity-50">
                  <PlayCircle className="w-12 h-12 mb-3 text-[var(--muted-foreground)]" />
                  <p className="text-sm text-[var(--muted-foreground)]">Belum ada aksi.<br/>Klik kamar untuk memulai check-in atau memindahkan tamu.</p>
                </div>
              ) : (
                pendingActions.map(action => (
                  <div key={action.id} className="p-3 bg-[var(--background)] border border-[var(--border)] shadow-sm rounded-[var(--radius-md)] text-sm group relative animate-in slide-in-from-right-4">
                    <div className="flex items-start">
                      {action.type === 'CHECK_IN' && <UserPlus className="w-4 h-4 mr-2 text-emerald-500 shrink-0 mt-0.5" />}
                      {action.type === 'CHECK_OUT' && <LogOut className="w-4 h-4 mr-2 text-amber-500 shrink-0 mt-0.5" />}
                      {action.type === 'TRANSFER' && <ArrowRightLeft className="w-4 h-4 mr-2 text-purple-500 shrink-0 mt-0.5" />}
                      <p className="text-[var(--foreground)] pr-6 leading-tight">{action.desc}</p>
                    </div>
                    {action.payload?.leave_start && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-2 border-t border-[var(--border)] pt-1">
                        Cuti: {action.payload.leave_start} - {action.payload.leave_end}
                      </p>
                    )}
                    <button 
                      onClick={() => undoAction(action.id)}
                      className="absolute top-2 right-2 p-1 text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Batal aksi ini"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 border-t border-[var(--border)] bg-[var(--muted)]/30 shrink-0 mt-auto">
              <button
                onClick={commitChanges}
                disabled={pendingActions.length === 0}
                className="w-full flex items-center justify-center px-4 py-2.5 bg-[var(--primary)] text-white font-medium rounded-[var(--radius-md)] hover:bg-[var(--primary)]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-95"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Realisasikan Data
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Hidden Export Component */}
      <div className="fixed top-[-9999px] left-[-9999px] z-[-9999] pointer-events-none opacity-0">
        <SimulationReportGraphic 
          innerRef={reportGraphicRef} 
          actions={pendingActions} 
          site={selectedSite} 
          date={new Date()} 
        />
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modalMode === 'CHECK_IN' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-[var(--card)] w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xl p-6"
            >
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-4">Check-In Kamar</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                Menempatkan tamu di <b>{selectedBed?.building_name}</b>, Kasur <b>{selectedBed?.label}</b>
              </p>
              <form onSubmit={handleCheckInSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--foreground)]">Nama Tamu</label>
                  <input required autoFocus value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:ring-2 focus:ring-[var(--ring)] focus:outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--foreground)]">Status</label>
                  <CustomSelect
                    value={guestStatus}
                    onChange={setGuestStatus}
                    options={[
                      { value: 'Onsite', label: 'Onsite' },
                      { value: 'Leave', label: 'On Leave' }
                    ]}
                  />
                </div>
                
                {/* Conditional Leave Dates Input */}
                <AnimatePresence>
                {(guestStatus === 'Leave' || guestStatus === 'On Leave') && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-2 gap-3"
                  >
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--muted-foreground)]">Mulai Cuti</label>
                      <input type="date" required value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--muted-foreground)]">Selesai Cuti</label>
                      <input type="date" required value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} min={leaveStart} className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>

                <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)] mt-4">
                  <button type="button" onClick={closeModal} className="px-3 py-1.5 text-sm hover:bg-[var(--muted)] rounded-md transition-colors">Batal</button>
                  <button type="submit" className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded-md hover:bg-[var(--primary)]/90 transition-colors shadow-md">Simpan Draf</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalMode === 'MANAGE_OCCUPANT' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-[var(--card)] w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xl p-6"
            >
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">Kelola Penghuni</h3>
              <div className="p-3 bg-[var(--muted)] rounded-md mb-4 border border-[var(--border)]">
                <p className="text-sm font-bold text-[var(--foreground)]">{selectedBed?.occupant?.guest_name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{selectedBed?.building_name} - {selectedBed?.label}</p>
              </div>
              
              <form onSubmit={handleUpdateStatus} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--foreground)]">Ubah Status</label>
                  <CustomSelect
                    value={guestStatus}
                    onChange={setGuestStatus}
                    options={[
                      { value: 'Onsite', label: 'Onsite' },
                      { value: 'Leave', label: 'On Leave' }
                    ]}
                  />
                </div>

                <AnimatePresence>
                {(guestStatus === 'Leave' || guestStatus === 'On Leave') && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-2 gap-3"
                  >
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--muted-foreground)]">Mulai Cuti</label>
                      <input type="date" required value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-[var(--muted-foreground)]">Selesai Cuti</label>
                      <input type="date" required value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} min={leaveStart} className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]" />
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>

                <div className="pt-2">
                  <button 
                    type="submit"
                    className="w-full flex items-center justify-center px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white font-medium rounded-[var(--radius-md)] transition-colors shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Update Status
                  </button>
                </div>
              </form>

              <div className="flex items-center gap-2 my-4">
                <div className="h-px bg-[var(--border)] flex-1"></div>
                <span className="text-xs text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">Atau</span>
                <div className="h-px bg-[var(--border)] flex-1"></div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={handleTransferInit}
                  className="w-full flex items-center justify-center px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-[var(--radius-md)] transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" /> Pindah Kamar / Kasur
                </button>
                <button 
                  onClick={handleCheckOutSubmit}
                  className="w-full flex items-center justify-center px-4 py-2 bg-[var(--destructive)] hover:bg-[var(--destructive)]/90 text-white font-medium rounded-[var(--radius-md)] transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Check-Out (Tamu Keluar)
                </button>
                <button 
                  onClick={closeModal}
                  className="w-full px-4 py-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-[var(--radius-md)] transition-colors border border-[var(--border)]"
                >
                  Batal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {modalMode === 'TRANSFER_SELECT_TARGET' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5">
          <div className="bg-[var(--card)] border border-[var(--primary)] shadow-xl rounded-full px-6 py-3 flex items-center gap-4">
            <span className="text-sm font-medium text-[var(--foreground)]">Pilih kasur kosong untuk tujuan transfer...</span>
            <button onClick={closeModal} className="text-sm font-bold text-[var(--destructive)] hover:underline">Batal Pindah</button>
          </div>
        </div>
      )}

    </div>
  );
}
