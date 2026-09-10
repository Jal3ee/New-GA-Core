import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Edit2, Trash2, CheckSquare, Square, Tag, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function EventDetailDrawer({ isOpen, onClose, eventData, onEdit, onDelete, onUpdateStatus, onUpdateChecklist }) {
  const [localChecklist, setLocalChecklist] = useState([]);
  
  useEffect(() => {
    if (isOpen && eventData) {
      setLocalChecklist(eventData.checklist_json || []);
    }
  }, [isOpen, eventData]);

  const isClosed = eventData?.status === 'Closed';

  const handleChecklistToggle = async (index) => {
    const updated = [...localChecklist];
    updated[index].isChecked = !updated[index].isChecked;
    setLocalChecklist(updated);
    try {
      await onUpdateChecklist(eventData.id, updated);
    } catch (e) {
      // Revert if error
      const reverted = [...updated];
      reverted[index].isChecked = !reverted[index].isChecked;
      setLocalChecklist(reverted);
      toast.error('Gagal mengupdate checklist');
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = isClosed ? 'Open' : 'Closed';
    try {
      await onUpdateStatus(eventData.id, newStatus);
    } catch (e) {
      toast.error('Gagal merubah status');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && eventData && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-md bg-[var(--card)] h-full shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-3">
                <h2 className={`text-xl font-bold font-display text-[var(--foreground)] ${isClosed ? 'line-through opacity-70' : ''}`}>
                  {eventData.title}
                </h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                  isClosed ? 'bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]' : 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20'
                }`}>
                  {eventData.status}
                </span>
              </div>
              <button onClick={onClose} className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-full transition-colors active:scale-95">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1"><Tag className="w-3 h-3"/> Kategori</div>
              <div className="text-sm font-medium text-[var(--foreground)]">{eventData.category}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1"><Users className="w-3 h-3"/> PIC</div>
              <div className="text-sm font-medium text-[var(--foreground)]">
                {Array.isArray(eventData.pic) ? eventData.pic.join(', ') : eventData.pic || '-'}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1"><Calendar className="w-3 h-3"/> Mulai</div>
              <div className="text-sm font-medium text-[var(--foreground)]">
                {new Date(eventData.start_time).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-1"><Clock className="w-3 h-3"/> Selesai</div>
              <div className="text-sm font-medium text-[var(--foreground)]">
                {new Date(eventData.end_time).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2">Catatan</h3>
            <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-wrap">
              {eventData.notes || <span className="italic">Tidak ada catatan</span>}
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-2 flex items-center justify-between">
              Checklist
              <span className="text-xs font-normal text-[var(--muted-foreground)]">
                {localChecklist.filter(c => c.isChecked).length} / {localChecklist.length} Selesai
              </span>
            </h3>
            
            {localChecklist.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] italic">Tidak ada checklist.</p>
            ) : (
              <div className="space-y-2">
                {localChecklist.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleChecklistToggle(idx)}
                    className="flex items-start gap-3 p-2 hover:bg-[var(--muted)] rounded-[var(--radius-md)] cursor-pointer transition-colors group"
                  >
                    <div className={`mt-0.5 text-[var(--primary)] transition-transform group-active:scale-90 ${item.isChecked ? 'opacity-100' : 'opacity-50 text-[var(--muted-foreground)]'}`}>
                      {item.isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </div>
                    <span className={`text-sm transition-all ${item.isChecked ? 'line-through text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-[var(--border)] bg-[var(--muted)]/30 shrink-0 grid grid-cols-2 gap-3">
          <button 
            onClick={handleStatusToggle}
            className={`flex items-center justify-center px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] transition-colors border ${
              isClosed 
              ? 'bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--border)]' 
              : 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 border-[var(--primary)]'
            }`}
          >
            {isClosed ? 'Buka Kembali' : 'Tandai Selesai'}
          </button>
          
          <div className="flex gap-2">
            <button 
              onClick={() => { onClose(); onEdit(eventData); }}
              className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] rounded-[var(--radius-md)] transition-colors"
            >
              <Edit2 className="w-4 h-4 mr-2" /> Edit
            </button>
            <button 
              onClick={() => {
                if (confirm('Yakin ingin menghapus kegiatan ini?')) {
                  onDelete(eventData.id);
                  onClose();
                }
              }}
              className="px-4 py-2 text-[var(--destructive)] bg-[var(--background)] border border-[var(--destructive)]/30 hover:bg-[var(--destructive)] hover:text-white rounded-[var(--radius-md)] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
