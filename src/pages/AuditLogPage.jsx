import React, { useState, useEffect } from 'react';
import { api as gasClient } from '../lib/gasClient';
import { toast } from 'sonner';
import { useGlobalLoading as useLoading } from '../context/LoadingContext';
import { Search, Activity, Clock, ShieldAlert, X, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../components/ui/CustomSelect';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('Semua');
  const [filterModule, setFilterModule] = useState('Semua');
  const [selectedLog, setSelectedLog] = useState(null);
  const { showLoading, hideLoading } = useLoading();

  useEffect(() => {
    const fetchLogs = async () => {
      showLoading();
      try {
        const res = await gasClient.getAuditLogs();
        if (res.ok) {
          setLogs(res.data || []);
        } else {
          toast.error(res.message || 'Gagal memuat log');
        }
      } catch (e) {
        toast.error('Kesalahan jaringan');
      } finally {
        hideLoading();
      }
    };
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(l => {
    const matchesSearch = (l.user_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (l.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (l.resource || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = filterAction === 'Semua' || l.action === filterAction;
    const matchesModule = filterModule === 'Semua' || l.resource === filterModule;
    return matchesSearch && matchesAction && matchesModule;
  });

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)] tracking-tight flex items-center">
            <Activity className="w-6 h-6 mr-2 text-[var(--primary)]" />
            System Audit Log
          </h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">Pantau seluruh aktivitas modifikasi data pada sistem secara real-time</p>
        </div>
      </div>

      {/* Tools / Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[var(--card)] p-3 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm">
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Cari aktor, aksi, atau modul..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="w-full sm:w-auto flex flex-1 items-center gap-3">
          <CustomSelect 
            value={filterAction} 
            onChange={setFilterAction}
            className="sm:w-48 z-20"
            options={[
              { value: 'Semua', label: 'Semua Aksi' },
              { value: 'CREATE', label: 'CREATE' },
              { value: 'UPDATE', label: 'UPDATE' },
              { value: 'DELETE', label: 'DELETE' },
              { value: 'UPDATE_PASSWORD', label: 'UPDATE_PASSWORD' }
            ]}
          />
          
          <CustomSelect 
            value={filterModule} 
            onChange={setFilterModule}
            className="sm:w-40 z-20"
            options={[
              { value: 'Semua', label: 'Semua Modul' },
              { value: 'tbl_users', label: 'tbl_users' },
              { value: 'tbl_events', label: 'tbl_events' }
            ]}
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <th className="px-6 py-3 font-medium w-48">Waktu (WITA)</th>
                <th className="px-6 py-3 font-medium">Aktor</th>
                <th className="px-6 py-3 font-medium">Aksi</th>
                <th className="px-6 py-3 font-medium">Modul</th>
                <th className="px-6 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[var(--muted-foreground)]">
                    <ShieldAlert className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    Belum ada rekaman audit trail.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l, idx) => (
                  <tr key={l.id || idx} className="hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-[var(--muted-foreground)] text-xs">
                        <Clock className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                        {new Date(l.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-[var(--foreground)]">{l.user_email}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getActionColor(l.action)}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded">
                        {l.resource}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setSelectedLog(l)}
                        className="inline-flex items-center text-xs font-medium text-[var(--primary)] hover:text-[var(--primary)]/80 hover:underline transition-colors active:scale-95"
                      >
                        <Eye className="w-4 h-4 mr-1.5" />
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedLog(null)}
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-[var(--card)] w-full max-w-2xl max-h-[90vh] rounded-[var(--radius-lg)] shadow-xl border border-[var(--border)] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
                <h2 className="text-lg font-semibold text-[var(--foreground)] font-display tracking-tight flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-[var(--primary)]" />
                  Detail Audit Log
                </h2>
                <button onClick={() => setSelectedLog(null)} className="p-1.5 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors active:scale-95">
                  <X className="w-5 h-5" />
                </button>
              </div>
            
            <div className="p-4 overflow-y-auto space-y-5">
               <div className="grid grid-cols-2 gap-4 text-sm bg-[var(--muted)]/30 p-4 rounded-[var(--radius-md)] border border-[var(--border)]">
                 <div>
                   <p className="text-[var(--muted-foreground)] mb-1 text-xs">Aktor</p>
                   <p className="font-medium text-[var(--foreground)]">{selectedLog.user_email}</p>
                 </div>
                 <div>
                   <p className="text-[var(--muted-foreground)] mb-1 text-xs">Waktu (WITA)</p>
                   <p className="font-medium text-[var(--foreground)]">{new Date(selectedLog.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })}</p>
                 </div>
                 <div>
                   <p className="text-[var(--muted-foreground)] mb-1 text-xs">Aksi</p>
                   <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getActionColor(selectedLog.action)}`}>
                     {selectedLog.action}
                   </span>
                 </div>
                 <div>
                   <p className="text-[var(--muted-foreground)] mb-1 text-xs">Modul & ID</p>
                   <p className="font-medium text-[var(--foreground)]">{selectedLog.resource} / <span className="text-[var(--muted-foreground)] text-xs">{selectedLog.resource_id}</span></p>
                 </div>
               </div>

               {selectedLog.before_json && selectedLog.before_json !== '{}' && (
                 <div className="space-y-2">
                   <h3 className="text-sm font-medium flex items-center text-red-600 dark:text-red-400">
                     Data Sebelumnya (Before)
                   </h3>
                   <div className="text-xs p-3 bg-[#1e1e1e] text-[#d4d4d4] rounded-[var(--radius-md)] overflow-x-auto shadow-inner custom-scrollbar">
                     <pre className="font-mono">
                       {JSON.stringify(JSON.parse(selectedLog.before_json), null, 2)}
                     </pre>
                   </div>
                 </div>
               )}

               {selectedLog.after_json && selectedLog.after_json !== '{}' && (
                 <div className="space-y-2 mt-4">
                   <h3 className="text-sm font-medium flex items-center text-green-600 dark:text-green-400">
                     Data Baru (After)
                   </h3>
                   <div className="text-xs p-3 bg-[#1e1e1e] text-[#d4d4d4] rounded-[var(--radius-md)] overflow-x-auto shadow-inner custom-scrollbar">
                     <pre className="font-mono">
                       {JSON.stringify(JSON.parse(selectedLog.after_json), null, 2)}
                     </pre>
                   </div>
                 </div>
               )}
            </div>
            <div className="p-4 border-t border-[var(--border)] shrink-0 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--background)] hover:bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-md)] transition-colors active:scale-95 shadow-sm"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>
    </div>
  );
}
