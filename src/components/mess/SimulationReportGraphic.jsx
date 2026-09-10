import React from 'react';
import { ArrowRightLeft, UserPlus, LogOut, Calendar, MapPin, CheckCircle2 } from 'lucide-react';

export default function SimulationReportGraphic({ actions, site, date, innerRef }) {
  const dateStr = date ? date.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }) : '';

  return (
    <div 
      ref={innerRef}
      className="bg-[var(--background)] w-[800px] flex flex-col font-sans"
      style={{
        // Ensure explicit background and text colors so html-to-image captures them correctly
        backgroundColor: '#ffffff',
        color: '#1B211F', 
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0F5C56] to-[#0A3B37] p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ArrowRightLeft className="w-32 h-32 text-white transform rotate-12" />
        </div>
        
        <div className="relative z-10">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold uppercase tracking-wider mb-4">
            GA Core Operations
          </div>
          <h1 className="text-4xl font-bold font-display mb-2">Transfer Report</h1>
          <p className="text-[#B3D8D3] text-lg font-medium flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Mess Site {site}
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-[#EEF2F1] px-8 py-4 border-b border-[#DDE4E2] flex items-center justify-between">
        <div className="flex items-center text-[#566461] text-sm font-medium">
          <Calendar className="w-4 h-4 mr-2" />
          {dateStr}
        </div>
        <div className="flex space-x-6 text-sm font-bold">
          <div className="flex items-center">
            <span className="text-emerald-600 mr-2">Check-in:</span>
            <span>{actions.filter(a => a.type === 'CHECK_IN').length}</span>
          </div>
          <div className="flex items-center">
            <span className="text-amber-600 mr-2">Check-out:</span>
            <span>{actions.filter(a => a.type === 'CHECK_OUT').length}</span>
          </div>
          <div className="flex items-center">
            <span className="text-purple-600 mr-2">Transfer:</span>
            <span>{actions.filter(a => a.type === 'TRANSFER').length}</span>
          </div>
        </div>
      </div>

      {/* Body: Action Cards */}
      <div className="p-8 bg-[#F7F9F8] flex-1">
        <div className="grid grid-cols-1 gap-4">
          {actions.length === 0 && (
            <div className="text-center py-12 text-[#71827D] font-medium">
              Tidak ada aktivitas simulasi.
            </div>
          )}
          {actions.map((action, idx) => {
            
            // Render different card types based on action.type
            if (action.type === 'CHECK_IN') {
              return (
                <div key={action.id} className="bg-white rounded-xl border-l-4 border-emerald-500 shadow-sm p-5 flex items-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mr-4">
                    <UserPlus className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-[#1B211F]">{action.payload.guest_name}</h3>
                    <p className="text-sm text-[#71827D]">Masuk ke <span className="font-bold text-[#434E4B]">{action.desc.split(' ke ')[1]}</span></p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">CHECK-IN</span>
                    {action.payload.status && <div className="text-[10px] text-[#9AA8A4] mt-1 uppercase font-bold">{action.payload.status}</div>}
                  </div>
                </div>
              );
            }

            if (action.type === 'CHECK_OUT') {
              return (
                <div key={action.id} className="bg-white rounded-xl border-l-4 border-amber-500 shadow-sm p-5 flex items-center">
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0 mr-4">
                    <LogOut className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-[#1B211F]">{action.desc.split(' dari ')[0].replace('Check-out ', '')}</h3>
                    <p className="text-sm text-[#71827D]">Keluar dari <span className="font-bold text-[#434E4B]">{action.desc.split(' dari ')[1]}</span></p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded">CHECK-OUT</span>
                  </div>
                </div>
              );
            }

            if (action.type === 'TRANSFER') {
              // Parse desc assuming format: Pindah [Nama] ke [Bangunan] ([Kamar])
              // Wait, the desc is: `Pindah ${selectedBed.occupant.guest_name} ke ${targetBed.building_name} (${targetBed.label})`
              // Or `Update status ...`
              const isStatusUpdate = action.desc.startsWith('Update status');
              const name = isStatusUpdate ? action.payload.guest_name : action.desc.match(/Pindah (.*?) ke/)?.[1] || action.payload.guest_name;
              
              return (
                <div key={action.id} className="bg-white rounded-xl border-l-4 border-purple-500 shadow-sm p-5 flex items-center">
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center shrink-0 mr-4">
                    <ArrowRightLeft className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-[#1B211F]">{name}</h3>
                    <p className="text-sm text-[#71827D]">
                      {isStatusUpdate 
                        ? action.desc 
                        : <>Pindah ke <span className="font-bold text-[#434E4B]">{action.desc.split(' ke ')[1]}</span></>}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded">
                      {isStatusUpdate ? 'UPDATE' : 'TRANSFER'}
                    </span>
                    {action.payload.leave_start && (
                      <div className="text-[10px] text-amber-600 mt-1 uppercase font-bold text-right">
                        CUTI {action.payload.leave_start}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[#101514] text-white p-6 flex items-center justify-between">
        <div className="flex items-center text-[#9AA8A4] text-xs">
          <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
          Simulasi divalidasi oleh sistem
        </div>
        <div className="text-xs font-bold tracking-wider text-[#71827D]">
          GARDA OPERATIONS PLATFORM
        </div>
      </div>
    </div>
  );
}
