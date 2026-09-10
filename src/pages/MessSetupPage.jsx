import React, { useState, useEffect } from 'react';
import { useGlobalLoading } from '../context/LoadingContext';
import { api } from '../lib/gasClient';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X, PlusCircle, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../components/ui/CustomSelect';
import { useForm, useFieldArray } from 'react-hook-form';

export default function MessSetupPage() {
  const { showLoading, hideLoading } = useGlobalLoading();
  const [buildings, setBuildings] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const { register, control, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      site: 'LBCT',
      name: '',
      room_config: [{ range_start: 1, range_end: 5, beds: 2 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'room_config'
  });

  const currentSite = watch('site');

  const loadBuildings = async () => {
    try {
      showLoading();
      const res = await api.getMessBuildings();
      setBuildings(res.data || []);
    } catch (err) {
      toast.error('Gagal memuat data mess bangunan');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    loadBuildings();
  }, []);

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      const configs = Array.isArray(item.room_config_json) ? item.room_config_json : [];
      if (configs.length === 0) configs.push({ range_start: 1, range_end: 1, beds: 1 });
      
      reset({
        site: item.site,
        name: item.name,
        room_config: configs
      });
    } else {
      setEditingItem(null);
      reset({
        site: 'LBCT',
        name: '',
        room_config: [{ range_start: 1, range_end: 10, beds: 2 }]
      });
    }
    setIsModalOpen(true);
  };

  const onSubmit = async (data) => {
    try {
      showLoading();
      
      // Validation & cleanup of config
      const cleanConfig = data.room_config.map(c => ({
        range_start: parseInt(c.range_start, 10) || 1,
        range_end: parseInt(c.range_end, 10) || parseInt(c.range_start, 10) || 1,
        beds: parseInt(c.beds, 10) || 1
      }));

      const payload = {
        site: data.site,
        name: data.name,
        room_config_json: cleanConfig
      };

      if (editingItem) {
        await api.updateMessBuilding(editingItem.id, payload);
        toast.success('Bangunan mess berhasil diperbarui');
      } else {
        await api.createMessBuilding(payload);
        toast.success('Bangunan mess berhasil ditambahkan');
      }
      setIsModalOpen(false);
      loadBuildings();
    } catch (err) {
      toast.error('Gagal menyimpan data bangunan');
    } finally {
      hideLoading();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus bangunan ini? Semua data terkait kamar akan hilang!')) return;
    try {
      showLoading();
      await api.deleteMessBuilding(id);
      toast.success('Bangunan berhasil dihapus');
      loadBuildings();
    } catch (err) {
      toast.error('Gagal menghapus bangunan');
    } finally {
      hideLoading();
    }
  };

  // Helper to calculate total rooms and beds
  const calcTotals = (config) => {
    if (!Array.isArray(config)) return { rooms: 0, beds: 0 };
    let rooms = 0;
    let beds = 0;
    config.forEach(c => {
      const r = (c.range_end >= c.range_start) ? (c.range_end - c.range_start + 1) : 1;
      rooms += r;
      beds += (r * c.beds);
    });
    return { rooms, beds };
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)] flex items-center">
            <Building2 className="w-6 h-6 mr-2 text-[var(--primary)]" />
            Master Setup Mess
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Kelola daftar bangunan, site, dan kapasitas kamar secara dinamis.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] hover:bg-[var(--primary)]/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Bangunan
        </button>
      </div>

      {/* List Table */}
      <div className="bg-[var(--card)] rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[var(--muted)]/50 text-[var(--muted-foreground)] border-b border-[var(--border)]">
              <tr>
                <th className="px-6 py-3 font-medium">Site</th>
                <th className="px-6 py-3 font-medium">Nama Bangunan</th>
                <th className="px-6 py-3 font-medium text-center">Total Kamar</th>
                <th className="px-6 py-3 font-medium text-center">Total Bed</th>
                <th className="px-6 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {buildings.map(item => {
                const { rooms, beds } = calcTotals(item.room_config_json);
                return (
                  <tr key={item.id} className="hover:bg-[var(--muted)]/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-[var(--foreground)]">
                      <span className="px-2 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full text-xs font-semibold">
                        {item.site}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--foreground)]">{item.name}</td>
                    <td className="px-6 py-4 text-center text-[var(--muted-foreground)]">{rooms}</td>
                    <td className="px-6 py-4 text-center text-[var(--muted-foreground)]">{beds}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openModal(item)}
                          className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 rounded-md transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {buildings.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-[var(--muted-foreground)]">
                    Belum ada bangunan yang ditambahkan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
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
                  {editingItem ? 'Edit Bangunan' : 'Tambah Bangunan Baru'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-full transition-colors active:scale-95">
                  <X className="w-5 h-5" />
                </button>
              </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form id="mess-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 z-20">
                    <label className="text-sm font-medium text-[var(--foreground)]">Site</label>
                    <CustomSelect
                      value={currentSite}
                      onChange={(val) => setValue('site', val)}
                      options={[
                        { value: 'LBCT', label: 'LBCT' },
                        { value: 'IDMG', label: 'IDMG' },
                        { value: 'SPCT', label: 'SPCT' }
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--foreground)]">Nama Bangunan</label>
                    <input 
                      required 
                      {...register('name')} 
                      className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm" 
                      placeholder="Contoh: Mess A" 
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-[var(--foreground)]">Konfigurasi Kamar & Kasur</h3>
                      <p className="text-xs text-[var(--muted-foreground)]">Atur rentang nomor kamar dan jumlah kasur di dalamnya.</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => append({ range_start: 1, range_end: 1, beds: 1 })}
                      className="text-xs flex items-center text-[var(--primary)] hover:underline font-medium"
                    >
                      <PlusCircle className="w-3.5 h-3.5 mr-1" /> Tambah Rentang
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-end gap-3 p-3 bg-[var(--muted)]/30 border border-[var(--border)] rounded-[var(--radius-md)] relative group">
                        <div className="flex-1 grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--muted-foreground)]">Kamar Awal</label>
                            <input type="number" min="1" required {...register(`room_config.${index}.range_start`)} className="w-full px-2 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--muted-foreground)]">Kamar Akhir</label>
                            <input type="number" min="1" required {...register(`room_config.${index}.range_end`)} className="w-full px-2 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-[var(--muted-foreground)]">Jml Bed/Kamar</label>
                            <input type="number" min="1" required {...register(`room_config.${index}.beds`)} className="w-full px-2 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" />
                          </div>
                        </div>
                        {fields.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => remove(index)} 
                            className="p-1.5 text-[var(--destructive)] hover:bg-[var(--destructive)]/10 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </form>
            </div>

            <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3 bg-[var(--muted)]/30 shrink-0 rounded-b-[var(--radius-lg)]">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--muted)] rounded-[var(--radius-md)] transition-colors border border-[var(--border)] active:scale-95 shadow-sm">
                Batal
              </button>
              <button type="submit" form="mess-form" className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-[var(--radius-md)] transition-colors active:scale-95 shadow-sm">
                Simpan Bangunan
              </button>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>
    </div>
  );
}
