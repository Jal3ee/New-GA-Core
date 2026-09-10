import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { X, Plus, Trash2, Calendar, Clock, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import CustomSelect from '../../../components/ui/CustomSelect';

export default function EventFormModal({ isOpen, onClose, onSave, initialData = null, activeEmployees = [] }) {
  const isEdit = !!initialData;
  const { register, control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      title: '',
      category: 'Meeting',
      pic: [], // Changed to array
      start_date: '',
      start_time: '',
      end_date: '',
      end_time: '',
      recurrence: 'none', // none, daily, weekly, biweekly, monthly
      notes: '',
      status: 'Open',
      checklist: []
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'checklist' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const currentPic = watch('pic') || [];
  const currentCategory = watch('category');
  const currentRecurrence = watch('recurrence');
  const currentStatus = watch('status');

  const togglePic = (name) => {
    if (name === 'All') {
      setValue('pic', ['All'], { shouldDirty: true });
      return;
    }
    
    let newPic = [...currentPic];
    // If 'All' was selected, remove it
    newPic = newPic.filter(p => p !== 'All');
    
    if (newPic.includes(name)) {
      newPic = newPic.filter(p => p !== name);
    } else {
      newPic.push(name);
    }
    setValue('pic', newPic, { shouldDirty: true });
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Parse date/time strings (assuming ISO input from event obj)
        const s = new Date(initialData.start_time || initialData.start);
        const e = new Date(initialData.end_time || initialData.end);
        
        // simple parsing
        const sDate = !isNaN(s) ? s.toISOString().split('T')[0] : '';
        const sTime = !isNaN(s) ? s.toISOString().split('T')[1].substring(0, 5) : '';
        const eDate = !isNaN(e) ? e.toISOString().split('T')[0] : '';
        const eTime = !isNaN(e) ? e.toISOString().split('T')[1].substring(0, 5) : '';

        // Derive simple recurrence rule back to UI if possible (very basic)
        let rec = 'none';
        if (initialData.recurrence_rule) {
          if (initialData.recurrence_rule.includes('FREQ=DAILY')) rec = 'daily';
          if (initialData.recurrence_rule.includes('FREQ=WEEKLY')) {
            rec = initialData.recurrence_rule.includes('INTERVAL=2') ? 'biweekly' : 'weekly';
          }
          if (initialData.recurrence_rule.includes('FREQ=MONTHLY')) rec = 'monthly';
        }

        reset({
          title: initialData.title || '',
          category: initialData.category || 'Meeting',
          pic: Array.isArray(initialData.pic) ? initialData.pic : 
               (typeof initialData.pic === 'string' ? initialData.pic.split(',').map(s=>s.trim()).filter(Boolean) : []),
          start_date: sDate,
          start_time: sTime,
          end_date: eDate,
          end_time: eTime,
          recurrence: rec,
          notes: initialData.notes || '',
          status: initialData.status || 'Open',
          checklist: initialData.checklist_json || []
        });
      } else {
        // Reset for new
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setHours(tomorrow.getHours() + 1);
        reset({
          title: '', category: 'Meeting', pic: [],
          start_date: now.toISOString().split('T')[0],
          start_time: now.toISOString().split('T')[1].substring(0, 5),
          end_date: tomorrow.toISOString().split('T')[0],
          end_time: tomorrow.toISOString().split('T')[1].substring(0, 5),
          recurrence: 'none', notes: '', status: 'Open', checklist: []
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      // Combine date and time
      const startISO = new Date(`${data.start_date}T${data.start_time}:00`).toISOString();
      const endISO = new Date(`${data.end_date}T${data.end_time}:00`).toISOString();

      // Build RRULE
      let rrule = '';
      if (data.recurrence === 'daily') rrule = 'FREQ=DAILY';
      if (data.recurrence === 'weekly') rrule = 'FREQ=WEEKLY';
      if (data.recurrence === 'biweekly') rrule = 'FREQ=WEEKLY;INTERVAL=2';
      if (data.recurrence === 'monthly') rrule = 'FREQ=MONTHLY';

      const payload = {
        title: data.title,
        category: data.category,
        pic: data.pic,
        start_time: startISO,
        end_time: endISO,
        recurrence_rule: rrule,
        notes: data.notes,
        status: data.status,
        checklist_json: data.checklist
      };

      await onSave(payload, initialData?.id);
    } catch (err) {
      toast.error('Gagal menyimpan jadwal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-[var(--card)] w-full max-w-2xl rounded-[var(--radius-lg)] border border-[var(--border)] shadow-xl flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)] shrink-0">
              <h2 className="text-xl font-bold font-display text-[var(--foreground)]">
                {isEdit ? 'Detail / Edit Kegiatan' : 'Buat Kegiatan Baru'}
              </h2>
              <button onClick={onClose} className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="event-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Nama Kegiatan</label>
                <input required {...register('title')} className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm transition-shadow" placeholder="Contoh: Rapat Koordinasi Bulanan" />
              </div>

              <div className="space-y-2 z-30">
                <label className="text-sm font-medium text-[var(--foreground)]">Kategori</label>
                <CustomSelect 
                  value={currentCategory}
                  onChange={(val) => setValue('category', val, { shouldDirty: true })}
                  options={[
                    { value: 'Meeting', label: 'Meeting' },
                    { value: 'Maintenance', label: 'Maintenance' },
                    { value: 'Audit', label: 'Audit' },
                    { value: 'Visit', label: 'Kunjungan' },
                    { value: 'Other', label: 'Lain-lain' }
                  ]}
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-[var(--foreground)]">PIC (Karyawan Aktif)</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => togglePic('All')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
                      currentPic.includes('All')
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                        : 'bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    Semua (All PIC)
                  </button>
                  {activeEmployees.map(emp => {
                    const isSelected = currentPic.includes(emp.name);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => togglePic(emp.name)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
                          isSelected
                            ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30'
                            : 'bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                      >
                        {emp.name}
                      </button>
                    );
                  })}
                  {activeEmployees.length === 0 && (
                    <span className="text-xs text-[var(--muted-foreground)] italic p-1">Tidak ada karyawan aktif.</span>
                  )}
                </div>
                {/* Hidden input to register pic field for validation if needed */}
                <input type="hidden" {...register('pic')} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Mulai (WITA)</label>
                <div className="flex gap-2">
                  <input type="date" required {...register('start_date')} className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm transition-shadow" />
                  <input type="time" required {...register('start_time')} className="w-24 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm transition-shadow" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)]">Selesai (WITA)</label>
                <div className="flex gap-2">
                  <input type="date" required {...register('end_date')} className="flex-1 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm transition-shadow" />
                  <input type="time" required {...register('end_time')} className="w-24 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm transition-shadow" />
                </div>
              </div>

              <div className="space-y-2 z-20">
                <label className="text-sm font-medium text-[var(--foreground)]">Perulangan</label>
                <CustomSelect 
                  value={currentRecurrence}
                  onChange={(val) => setValue('recurrence', val, { shouldDirty: true })}
                  options={[
                    { value: 'none', label: 'Tidak Diulang' },
                    { value: 'daily', label: 'Setiap Hari' },
                    { value: 'weekly', label: 'Setiap Minggu' },
                    { value: 'biweekly', label: 'Setiap 2 Minggu' },
                    { value: 'monthly', label: 'Setiap Bulan' }
                  ]}
                />
              </div>

              <div className="space-y-2 z-10">
                <label className="text-sm font-medium text-[var(--foreground)]">Status</label>
                <CustomSelect 
                  value={currentStatus}
                  onChange={(val) => setValue('status', val, { shouldDirty: true })}
                  options={[
                    { value: 'Open', label: 'Open' },
                    { value: 'Closed', label: 'Closed' }
                  ]}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Catatan</label>
              <textarea {...register('notes')} rows="3" className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm transition-shadow resize-none" placeholder="Catatan tambahan..."></textarea>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[var(--foreground)]">Checklist / Todo</label>
                <button type="button" onClick={() => append({ label: '', isChecked: false })} className="text-xs flex items-center text-[var(--primary)] hover:underline">
                  <Plus className="w-3 h-3 mr-1" /> Tambah Item
                </button>
              </div>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <input type="checkbox" {...register(`checklist.${index}.isChecked`)} className="w-4 h-4 text-[var(--primary)] rounded border-[var(--border)] focus:ring-[var(--ring)]" />
                    <input {...register(`checklist.${index}.label`)} placeholder="Deskripsi tugas..." className="flex-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm transition-shadow" />
                    <button type="button" onClick={() => remove(index)} className="p-1.5 text-[var(--destructive)] hover:bg-[var(--destructive)]/10 rounded-md transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {fields.length === 0 && (
                  <p className="text-xs text-[var(--muted-foreground)] italic">Belum ada checklist.</p>
                )}
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--muted)]/30 shrink-0 rounded-b-[var(--radius-lg)]">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] rounded-[var(--radius-md)] transition-colors border border-[var(--border)]">
            Batal
          </button>
          <button type="submit" form="event-form" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-[var(--radius-md)] transition-colors disabled:opacity-50">
            {isSubmitting ? 'Menyimpan...' : 'Simpan Kegiatan'}
          </button>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
