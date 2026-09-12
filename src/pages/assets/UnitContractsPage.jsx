import React, { useState, useEffect } from 'react';
import { api as gasClient } from '../../lib/gasClient';
import { toast } from 'sonner';
import { useGlobalLoading as useLoading } from '../../context/LoadingContext';
import { Plus, Edit2, Trash2, Search, X, Paperclip, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../components/ui/CustomSelect';
import { calculateDaysRemaining, getStatusColorBadge, checkContractNotifications } from '../../lib/utils';

export default function UnitContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSite, setFilterSite] = useState('Semua');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const { showLoading, hideLoading } = useLoading();

  const DEPARTMENTS = [
    { label: 'CCI', value: 'CCI' },
    { label: 'CHRM', value: 'CHRM' },
    { label: 'Civil & Infra', value: 'Civil & Infra' },
    { label: 'Engineering', value: 'Engineering' },
    { label: 'Finance', value: 'Finance' },
    { label: 'HCGA', value: 'HCGA' },
    { label: 'HSE&C', value: 'HSE&C' },
    { label: 'IT', value: 'IT' },
    { label: 'LLG', value: 'LLG' },
    { label: 'Marine', value: 'Marine' },
    { label: 'Mining Production', value: 'Mining Production' },
    { label: 'Operation', value: 'Operation' },
    { label: 'P&M', value: 'P&M' },
    { label: 'Supply Chain', value: 'Supply Chain' }
  ];

  const TYPE_UNIT = [
    { label: 'Double Cabin', value: 'Double Cabin' },
    { label: 'Single Cabin', value: 'Single Cabin' },
    { label: 'Full Cabin', value: 'Full Cabin' },
    { label: 'Bus', value: 'Bus' },
    { label: 'Lainnya', value: 'Lainnya' }
  ];

  const [formData, setFormData] = useState({
    no_lambung: '',
    no_polisi: '',
    unit_asset: 'PT.AGM',
    site: 'LBCT',
    dept: 'Operation',
    user_pengguna: '',
    merk: '',
    warna: '',
    type: 'Double Cabin',
    no_rangka: '',
    no_mesin: '',
    bahan_bakar: 'Diesel',
    stnk_start: '',
    stnk_end: '',
    budget_tahunan: '',
    status_unit: 'Aktif',
    tahun_unit: '',
    coa: '',
    fileData: null,
    fileName: '',
    file_url: ''
  });

  const fetchContracts = async () => {
    showLoading();
    try {
      const res = await gasClient.getUnitContracts();
      if (res.ok) {
        setContracts(res.data || []);
        checkContractNotifications(res.data || [], 'stnk_end');
      }
      else toast.error(res.message || 'Gagal memuat data');
    } catch (e) {
      console.error("Fetch Error:", e);
      toast.error(e.message || 'Terjadi kesalahan jaringan');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const openModal = (contract = null) => {
    if (contract) {
      setEditingContract(contract);
      setFormData({
        no_lambung: contract.no_lambung || '',
        no_polisi: contract.no_polisi || '',
        unit_asset: contract.unit_asset || 'PT.AGM',
        site: contract.site || 'LBCT',
        dept: contract.dept || 'Operation',
        user_pengguna: contract.user_pengguna || '',
        merk: contract.merk || '',
        warna: contract.warna || '',
        type: contract.type || 'Double Cabin',
        no_rangka: contract.no_rangka || '',
        no_mesin: contract.no_mesin || '',
        bahan_bakar: contract.bahan_bakar || 'Diesel',
        stnk_start: contract.stnk_start ? contract.stnk_start.split('T')[0] : '',
        stnk_end: contract.stnk_end ? contract.stnk_end.split('T')[0] : '',
        budget_tahunan: contract.budget_tahunan || '',
        status_unit: contract.status_unit || 'Aktif',
        tahun_unit: contract.tahun_unit || '',
        coa: contract.coa || '',
        fileData: null,
        fileName: '',
        file_url: contract.file_url || ''
      });
    } else {
      setEditingContract(null);
      setFormData({
        no_lambung: '',
        no_polisi: '',
        unit_asset: 'PT.AGM',
        site: 'LBCT',
        dept: 'Operation',
        user_pengguna: '',
        merk: '',
        warna: '',
        type: 'Double Cabin',
        no_rangka: '',
        no_mesin: '',
        bahan_bakar: 'Diesel',
        stnk_start: '',
        stnk_end: '',
        budget_tahunan: '',
        status_unit: 'Aktif',
        tahun_unit: '',
        coa: '',
        fileData: null,
        fileName: '',
        file_url: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingContract(null);
  };

  const handleBudgetChange = (e) => {
    let rawValue = e.target.value.replace(/[^0-9]/g, '');
    if (!rawValue) {
      setFormData({ ...formData, budget_tahunan: '' });
      return;
    }
    const formatted = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(rawValue);
    setFormData({ ...formData, budget_tahunan: formatted });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        fileData: file, // Store File object natively
        fileName: file.name
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.no_polisi) {
      return toast.warning('No Polisi wajib diisi');
    }

    showLoading();
    try {
      let res;
      let payload = { ...formData };
      
      if (payload.fileData instanceof File) {
        toast.loading('Menyimpan Data & Mengunggah Lampiran...', { id: 'save-toast' });
      } else {
        toast.loading('Menyimpan Data...', { id: 'save-toast' });
      }

      if (editingContract) {
        res = await gasClient.updateUnitContract(editingContract.id, payload);
      } else {
        res = await gasClient.createUnitContract(payload);
      }
      toast.dismiss('save-toast');

      if (res.ok) {
        toast.success(editingContract ? 'Kontrak diperbarui' : 'Kontrak berhasil ditambahkan');
        closeModal();
        fetchContracts();
      } else {
        toast.error(res.message || 'Gagal menyimpan');
      }
    } catch (err) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      toast.dismiss('save-toast');
      hideLoading();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data unit ini?')) return;
    showLoading();
    try {
      const res = await gasClient.deleteUnitContract(id);
      if (res.ok) {
        toast.success('Data unit dihapus');
        fetchContracts();
      } else {
        toast.error(res.message || 'Gagal menghapus');
      }
    } catch (e) {
      console.error("Delete Error:", e);
      toast.error(e.message || 'Kesalahan jaringan');
    } finally {
      hideLoading();
    }
  };

  const filteredContracts = contracts.filter(c => {
    const matchSearch = Object.values(c).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchSite = filterSite === 'Semua' || c.site === filterSite;
    return matchSearch && matchSite;
  });

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)]">Data Unit Internal</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">Kelola data spesifikasi aset unit dan STNK internal perusahaan.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium hover:bg-teal-700 transition-colors shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Unit Internal
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow"
            placeholder="Cari no polisi, no lambung, pengguna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <CustomSelect
            options={[
              { value: 'Semua', label: 'Semua Site' },
              { value: 'LBCT', label: 'LBCT' },
              { value: 'IDMG', label: 'IDMG' },
              { value: 'SPCT', label: 'SPCT' }
            ]}
            value={filterSite}
            onChange={setFilterSite}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--muted)] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-6 py-4 font-medium sticky left-0 bg-[var(--muted)] z-10">Asset & Lambung</th>
                <th className="px-6 py-4 font-medium">Dept/User</th>
                <th className="px-6 py-4 font-medium">Tipe / Merk / Tahun</th>
                <th className="px-6 py-4 font-medium">No Polisi & Mesin</th>
                <th className="px-6 py-4 font-medium text-center">Masa STNK</th>
                <th className="px-6 py-4 font-medium text-center">Lampiran</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-right sticky right-0 bg-[var(--muted)] z-10">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-[var(--muted-foreground)]">
                    Tidak ada data unit internal yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredContracts.map(contract => {
                  const daysLeft = contract.stnk_end ? calculateDaysRemaining(contract.stnk_end) : null;
                  const badge = getStatusColorBadge(daysLeft);
                  
                  return (
                    <tr key={contract.id} className="hover:bg-[var(--muted)]/50 transition-colors">
                      <td className="px-6 py-4 sticky left-0 bg-[var(--card)] z-10 border-r border-transparent hover:border-[var(--border)]">
                        <div className="font-semibold text-[var(--foreground)] font-mono">{contract.no_lambung || '-'}</div>
                        <div className="text-xs text-[var(--primary)] font-medium bg-[var(--primary)]/10 px-2 py-0.5 rounded inline-block mt-1">{contract.unit_asset}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[var(--foreground)] font-medium">{contract.dept || '-'}</div>
                        <div className="text-[var(--muted-foreground)] text-xs mt-0.5">{contract.user_pengguna || '-'}</div>
                        <div className="text-[var(--muted-foreground)] text-[10px] mt-0.5">{contract.site || '-'}{contract.coa ? ` | CoA: ${contract.coa}` : ''}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[var(--foreground)]">{contract.merk} {contract.type}</div>
                        <div className="text-[var(--muted-foreground)] text-xs mt-0.5">{contract.tahun_unit ? `Th: ${contract.tahun_unit} | ` : ''}{contract.warna} | {contract.bahan_bakar}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[var(--foreground)] font-mono">{contract.no_polisi || '-'}</div>
                        <div className="text-[var(--muted-foreground)] text-[10px] font-mono mt-0.5">R: {contract.no_rangka || '-'}</div>
                        <div className="text-[var(--muted-foreground)] text-[10px] font-mono">M: {contract.no_mesin || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-[var(--muted-foreground)] text-xs mb-1">
                          s/d <span className="text-[var(--foreground)] font-medium">
                            {contract.stnk_end ? new Date(contract.stnk_end).toLocaleDateString('id-ID') : '-'}
                          </span>
                        </div>
                        {daysLeft !== null ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {daysLeft < 0 ? 'Expired' : `${daysLeft} Hari`}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {contract.file_url ? (
                          <a href={contract.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors" title="Lihat Lampiran">
                            <FileText className="w-5 h-5" />
                          </a>
                        ) : (
                          <span className="text-[var(--muted-foreground)] text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                          ${contract.status_unit === 'Aktif' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                            contract.status_unit === 'BD' ? 'bg-ruby-50 text-ruby-700 border-ruby-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
                        >
                          {contract.status_unit || 'Aktif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right sticky right-0 bg-[var(--card)] z-10 border-l border-transparent hover:border-[var(--border)]">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openModal(contract)}
                            className="p-2 text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(contract.id)}
                            className="p-2 text-[var(--muted-foreground)] hover:text-ruby-600 hover:bg-ruby-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer / Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
              onClick={closeModal} 
            />
            
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-[var(--background)] h-full shadow-2xl flex flex-col"
            >
              <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--card)]">
                <h2 className="text-lg font-bold text-[var(--foreground)]">
                  {editingContract ? 'Edit Data Unit Internal' : 'Tambah Unit Internal'}
                </h2>
                <button onClick={closeModal} className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="unitForm" onSubmit={handleSubmit} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <h3 className="font-bold text-[var(--primary)] text-sm uppercase tracking-wider mb-2 border-b border-[var(--border)] pb-2">Identitas Asset</h3>
                    
                    <div>
                      <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Unit Asset</label>
                      <input type="text" disabled value={formData.unit_asset} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] font-medium cursor-not-allowed text-sm" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">No Lambung</label>
                        <input type="text" value={formData.no_lambung} onChange={(e) => setFormData({...formData, no_lambung: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none font-mono text-sm uppercase" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--foreground)] mb-1">No Polisi *</label>
                        <input type="text" required value={formData.no_polisi} onChange={(e) => setFormData({...formData, no_polisi: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none font-mono text-sm uppercase" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Merk</label>
                        <input type="text" value={formData.merk} onChange={(e) => setFormData({...formData, merk: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" placeholder="Misal: Toyota" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Type Unit</label>
                        <CustomSelect 
                          value={formData.type} 
                          onChange={(val) => setFormData({...formData, type: val})}
                          options={TYPE_UNIT}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Tahun Unit</label>
                        <input type="text" value={formData.tahun_unit} onChange={(e) => setFormData({...formData, tahun_unit: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm font-mono" placeholder="Misal: 2023" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Warna</label>
                        <input type="text" value={formData.warna} onChange={(e) => setFormData({...formData, warna: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Bahan Bakar</label>
                        <CustomSelect 
                          value={formData.bahan_bakar} 
                          onChange={(val) => setFormData({...formData, bahan_bakar: val})}
                          options={[
                            {label: 'Diesel / Solar', value: 'Diesel'},
                            {label: 'Bensin / Pertamax', value: 'Bensin'},
                            {label: 'Listrik (EV)', value: 'Listrik (EV)'}
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Status Keaktifan</label>
                        <CustomSelect 
                          value={formData.status_unit} 
                          onChange={(val) => setFormData({...formData, status_unit: val})}
                          options={[
                            {label: 'Aktif (Beroperasi)', value: 'Aktif'},
                            {label: 'Tidak Aktif (Standby)', value: 'Tidak aktif'},
                            {label: 'BD (Breakdown)', value: 'BD'}
                          ]}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">No Rangka</label>
                        <input type="text" value={formData.no_rangka} onChange={(e) => setFormData({...formData, no_rangka: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none font-mono text-xs uppercase" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">No Mesin</label>
                        <input type="text" value={formData.no_mesin} onChange={(e) => setFormData({...formData, no_mesin: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none font-mono text-xs uppercase" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-[var(--primary)] text-sm uppercase tracking-wider mb-2 border-b border-[var(--border)] pb-2">Pengguna & Legal</h3>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Departement</label>
                        <CustomSelect 
                          value={formData.dept} 
                          onChange={(val) => setFormData({...formData, dept: val})}
                          options={DEPARTMENTS}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--foreground)] mb-1">Site</label>
                        <CustomSelect 
                          value={formData.site} 
                          onChange={(val) => setFormData({...formData, site: val})}
                          options={[
                            {label: 'LBCT', value: 'LBCT'},
                            {label: 'IDMG', value: 'IDMG'},
                            {label: 'SPCT', value: 'SPCT'}
                          ]}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Pengguna (User)</label>
                      <input type="text" value={formData.user_pengguna} onChange={(e) => setFormData({...formData, user_pengguna: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" />
                    </div>

                    <div className="p-3 bg-[var(--muted)]/50 rounded-lg border border-[var(--border)] space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Masa STNK (Dari)</label>
                          <input type="date" value={formData.stnk_start} onChange={(e) => setFormData({...formData, stnk_start: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Masa STNK (Akhir)</label>
                          <input type="date" value={formData.stnk_end} onChange={(e) => setFormData({...formData, stnk_end: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Masa KIR (Dari)</label>
                          <input type="date" value={formData.kir_start} onChange={(e) => setFormData({...formData, kir_start: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Masa KIR (Akhir)</label>
                          <input type="date" value={formData.kir_end} onChange={(e) => setFormData({...formData, kir_end: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Lampiran Dokumen</label>
                        <label className="flex items-center justify-center w-full px-4 py-2 border-2 border-dashed border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--muted)] transition-colors">
                          <Paperclip className="w-4 h-4 text-[var(--muted-foreground)] mr-2" />
                          <p className="text-sm text-[var(--foreground)] font-medium">
                            {formData.fileName ? formData.fileName : 'Klik atau seret file PDF/Gambar ke sini'}
                          </p>
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
                        </label>
                        {formData.file_url && !formData.fileName && (
                          <div className="mt-2 text-xs text-[var(--primary)] flex items-center">
                            <FileText className="w-3 h-3 mr-1" />
                            <a href={formData.file_url} target="_blank" rel="noopener noreferrer" className="hover:underline">Lihat Lampiran Saat Ini</a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">CoA Dept</label>
                        <input type="text" value={formData.coa} onChange={(e) => setFormData({...formData, coa: e.target.value})} className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" placeholder="Misal: 6010-001" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Budget Tahunan</label>
                        <input type="text" value={formData.budget_tahunan} onChange={handleBudgetChange} placeholder="Rp..." className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] outline-none text-sm" />
                      </div>
                    </div>

                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-[var(--border)] bg-[var(--muted)]/30">
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="unitForm"
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-lg transition-colors shadow-sm active:scale-95"
                >
                  {editingContract ? 'Simpan Perubahan' : 'Tambah Unit Internal'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
        )}
      </AnimatePresence>
    </div>
  );
}
