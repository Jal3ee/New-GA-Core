import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { X, Plus, Trash2, Calendar, Clock, Users, Check, Search, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import CustomSelect from '../../../components/ui/CustomSelect';

export default function EventFormModal({ isOpen, onClose, onSave, initialData = null, activeEmployees = [] }) {
  const isEdit = !!initialData;
  const { register, control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      title: '',
      category: 'Meeting',
      pic: [],
      start_date: '',
      start_time: '',
      end_date: '',
      end_time: '',
      recurrence: 'none',
      notes: '',
      status: 'Open',
      checklist: []
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'checklist' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [picSearch, setPicSearch] = useState('');
  
  const currentPic = watch('pic') || [];
  const currentCategory = watch('category');
  const currentRecurrence = watch('recurrence');
  const currentStatus = watch('status');

  const filteredEmployees = useMemo(() => {
    if (!picSearch.trim()) return activeEmployees;
    const q = picSearch.toLowerCase();
    return activeEmployees.filter(emp => 
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.role && emp.role.toLowerCase().includes(q)) ||
      (emp.nik && emp.nik.toLowerCase().includes(q))
    );
  }, [activeEmployees, picSearch]);

  const togglePic = (name) => {
    if (name === 'All') {
      if (currentPic.includes('All')) {
        setValue('pic', [], { shouldDirty: true });
      } else {
        setValue('pic', ['All'], { shouldDirty: true });
      }
      return;
    }
    
    let newPic = [...currentPic].filter(p => p !== 'All');
    if (newPic.includes(name)) {
      newPic = newPic.filter(p => p !== name);
    } else {
      newPic.push(name);
    }
    setValue('pic', newPic, { shouldDirty: true });
  };

  const selectAllPic = () => {
    setValue('pic', ['All'], { shouldDirty: true });
  };

  const clearAllPic = () => {
    setValue('pic', [], { shouldDirty: true });
  };

  const getInitials = (name) => {
    if (!name) return 'GA';
    const clean = name.replace(/\(.*?\)/g, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  useEffect(() => {
    if (isOpen) {
      setPicSearch('');
      if (initialData) {
        const s = new Date(initialData.start_time || initialData.start);
        const e = new Date(initialData.end_time || initialData.end);
        
        const sDate = !isNaN(s) ? s.toISOString().split('T')[0] : '';
        const sTime = !isNaN(s) ? s.toISOString().split('T')[1].substring(0, 5) : '';
        const eDate = !isNaN(e) ? e.toISOString().split('T')[0] : '';
        const eTime = !isNaN(e) ? e.toISOString().split('T')[1].substring(0, 5) : '';

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
      const startISO = new Date(`${data.start_date}T${data.start_time}:00`).toISOString();
      const endISO = new Date(`${data.end_date}T${data.end_time}:00`).toISOString();

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-[var(--card)] w-full max-w-2xl lg:max-w-3xl rounded-[var(--radius-lg)] border border-[var(--border)] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--muted)]/20 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#0F5C56]/10 text-[#0F5C56] flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display text-[var(--foreground)]">
                    {isEdit ? 'Detail & Edit Kegiatan' : 'Buat Kegiatan Baru'}
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)]">Calendar of Event Operasional GA</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
              <form id="event-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                
                {/* 1. Nama Kegiatan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Nama Kegiatan <span className="text-[var(--destructive)]">*</span>
                  </label>
                  <input 
                    required 
                    {...register('title')} 
                    className="w-full px-3.5 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[#0F5C56] focus:border-[#0F5C56] shadow-sm transition-all" 
                    placeholder="Contoh: Rapat Koordinasi Bulanan, Inspeksi Mess, dll." 
                  />
                </div>

                {/* 2. Kategori, Status & Perulangan (3 Kolom Ringkas) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1.5 z-30">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Kategori
                    </label>
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

                  <div className="space-y-1.5 z-20">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Status Kegiatan
                    </label>
                    <CustomSelect 
                      value={currentStatus}
                      onChange={(val) => setValue('status', val, { shouldDirty: true })}
                      options={[
                        { value: 'Open', label: 'Open (Berjalan)' },
                        { value: 'Closed', label: 'Closed (Selesai)' }
                      ]}
                    />
                  </div>

                  <div className="space-y-1.5 z-10">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      Perulangan (Recurrence)
                    </label>
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
                </div>

                {/* 3. Waktu Pelaksanaan (Mulai & Selesai WITA) - Space Proporsional agar Jam tidak terpotong */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]">
                  {/* Mulai */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#0F5C56]" />
                      Mulai (WITA) <span className="text-[var(--destructive)]">*</span>
                    </label>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7">
                        <input 
                          type="date" 
                          required 
                          {...register('start_date')} 
                          className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[#0F5C56] shadow-sm transition-all" 
                        />
                      </div>
                      <div className="col-span-5">
                        <input 
                          type="time" 
                          required 
                          {...register('start_time')} 
                          className="w-full px-2.5 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm font-medium text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[#0F5C56] shadow-sm transition-all" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Selesai */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#0F5C56]" />
                      Selesai (WITA) <span className="text-[var(--destructive)]">*</span>
                    </label>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7">
                        <input 
                          type="date" 
                          required 
                          {...register('end_date')} 
                          className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[#0F5C56] shadow-sm transition-all" 
                        />
                      </div>
                      <div className="col-span-5">
                        <input 
                          type="time" 
                          required 
                          {...register('end_time')} 
                          className="w-full px-2.5 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm font-medium text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[#0F5C56] shadow-sm transition-all" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. PIC (Karyawan Aktif) - Redesigned UI & UX */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#0F5C56]" />
                      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                        PIC / Penanggung Jawab
                      </label>
                      {currentPic.includes('All') ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#C4841F]/15 text-[#C4841F] border border-[#C4841F]/30">
                          Semua PIC Aktif
                        </span>
                      ) : currentPic.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#0F5C56]/15 text-[#0F5C56] border border-[#0F5C56]/30">
                          {currentPic.length} Orang Terpilih
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)]">
                          Belum Dipilih
                        </span>
                      )}
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={selectAllPic}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all border ${
                          currentPic.includes('All')
                            ? 'bg-[#C4841F] text-white border-[#C4841F] shadow-sm'
                            : 'bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] hover:border-[#C4841F] hover:text-[#C4841F]'
                        }`}
                      >
                        Pilih Semua
                      </button>
                      {currentPic.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAllPic}
                          className="px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[var(--muted)] rounded-lg transition-colors flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Bersihkan
                        </button>
                      )}
                    </div>
                  </div>

                  {/* PIC Search (aktif jika karyawan > 4) */}
                  {activeEmployees.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <input 
                        type="text"
                        value={picSearch}
                        onChange={(e) => setPicSearch(e.target.value)}
                        placeholder="Cari nama karyawan / PIC..."
                        className="w-full pl-8 pr-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[#0F5C56]"
                      />
                    </div>
                  )}

                  {/* Interactive PIC Chips Box */}
                  <div className="p-3 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-md)] max-h-44 overflow-y-auto custom-scrollbar shadow-inner">
                    <div className="flex flex-wrap gap-2">
                      {filteredEmployees.map(emp => {
                        const isSelected = currentPic.includes('All') || currentPic.includes(emp.name);
                        const initials = getInitials(emp.name);

                        return (
                          <button
                            key={emp.id || emp.name}
                            type="button"
                            onClick={() => togglePic(emp.name)}
                            className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all border ${
                              isSelected
                                ? 'bg-[#0F5C56] text-white border-[#0F5C56] shadow-sm font-semibold'
                                : 'bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:border-[#0F5C56]/60 hover:bg-[#0F5C56]/5'
                            }`}
                          >
                            {/* Avatar Badge */}
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isSelected 
                                ? 'bg-white/20 text-white' 
                                : 'bg-[#0F5C56]/10 text-[#0F5C56] group-hover:bg-[#0F5C56]/20'
                            }`}>
                              {initials}
                            </span>

                            {/* Name */}
                            <span className="truncate max-w-[200px]">{emp.name}</span>

                            {/* Active Check Indicator */}
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                            )}
                          </button>
                        );
                      })}

                      {filteredEmployees.length === 0 && activeEmployees.length > 0 && (
                        <p className="text-xs text-[var(--muted-foreground)] italic py-2">
                          Tidak ditemukan karyawan dengan kata kunci "{picSearch}".
                        </p>
                      )}

                      {activeEmployees.length === 0 && (
                        <p className="text-xs text-[var(--muted-foreground)] italic py-2">
                          Tidak ada karyawan aktif yang terdaftar di sistem.
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Hidden input to register pic field for validation */}
                  <input type="hidden" {...register('pic')} />
                </div>

                {/* 5. Catatan */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Catatan Kegiatan
                  </label>
                  <textarea 
                    {...register('notes')} 
                    rows="2" 
                    className="w-full px-3.5 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[#0F5C56] shadow-sm transition-all resize-none" 
                    placeholder="Tuliskan catatan atau instruksi tambahan untuk kegiatan ini..."
                  />
                </div>

                {/* 6. Checklist / Todo */}
                <div className="space-y-2.5 pt-1 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#0F5C56]" />
                      Checklist / Todo
                    </label>
                    <button 
                      type="button" 
                      onClick={() => append({ label: '', isChecked: false })} 
                      className="text-xs font-semibold flex items-center text-[#0F5C56] hover:text-[#0D4E49] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Item
                    </button>
                  </div>

                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          {...register(`checklist.${index}.isChecked`)} 
                          className="w-4 h-4 text-[#0F5C56] rounded border-[var(--border)] focus:ring-[#0F5C56]" 
                        />
                        <input 
                          {...register(`checklist.${index}.label`)} 
                          placeholder="Deskripsi tugas checklist..." 
                          className="flex-1 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[#0F5C56] shadow-sm transition-all" 
                        />
                        <button 
                          type="button" 
                          onClick={() => remove(index)} 
                          className="p-1.5 text-[var(--destructive)] hover:bg-[var(--destructive)]/10 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {fields.length === 0 && (
                      <p className="text-xs text-[var(--muted-foreground)] italic">
                        Belum ada checklist tugas untuk kegiatan ini.
                      </p>
                    )}
                  </div>
                </div>

              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--muted)]/20 shrink-0">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] rounded-[var(--radius-md)] transition-colors border border-[var(--border)] shadow-sm"
              >
                Batal
              </button>
              <button 
                type="submit" 
                form="event-form" 
                disabled={isSubmitting} 
                className="px-5 py-2 text-sm font-semibold text-white bg-[#0F5C56] hover:bg-[#0D4E49] rounded-[var(--radius-md)] transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Kegiatan'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
