import React, { useState, useEffect } from 'react';
import { api as gasClient } from '../../lib/gasClient';
import { toast } from 'sonner';
import { useGlobalLoading as useLoading } from '../../context/LoadingContext';
import { Plus, Edit2, Trash2, Search, X, Calendar as CalendarIcon, UploadCloud, Download, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../../components/ui/CustomSelect';
import { calculateDaysRemaining, getStatusColorBadge, checkContractNotifications } from '../../lib/utils';

export default function VendorContractsPage() {
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

  const [formData, setFormData] = useState({
    nama_vendor: '',
    site: 'LBCT',
    dept: 'Operation',
    jenis_kontrak: 'Catering',
    start_kontrak: '',
    end_kontrak: '',
    no_kontrak: '',
    fileData: null,
    fileName: '',
    file_url: ''
  });

  const fetchContracts = async () => {
    showLoading();
    try {
      const res = await gasClient.getVendorContracts();
      if (res.ok) {
        setContracts(res.data || []);
        checkContractNotifications(res.data || [], 'nama_vendor');
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
        nama_vendor: contract.nama_vendor || '',
        site: contract.site || 'LBCT',
        dept: contract.dept || 'Operation',
        jenis_kontrak: contract.jenis_kontrak || 'Catering',
        start_kontrak: contract.start_kontrak ? contract.start_kontrak.split('T')[0] : '',
        end_kontrak: contract.end_kontrak ? contract.end_kontrak.split('T')[0] : '',
        no_kontrak: contract.no_kontrak || '',
        coa: contract.coa || '',
        fileData: null,
        fileName: '',
        file_url: contract.file_url || ''
      });
    } else {
      setEditingContract(null);
      setFormData({
        nama_vendor: '',
        site: 'LBCT',
        dept: 'Operation',
        jenis_kontrak: 'Catering',
        start_kontrak: '',
        end_kontrak: '',
        no_kontrak: '',
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
    if (!formData.nama_vendor || !formData.end_kontrak) {
      return toast.warning('Nama Vendor dan Tanggal Berakhir wajib diisi');
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
        res = await gasClient.updateVendorContract(editingContract.id, payload);
      } else {
        res = await gasClient.createVendorContract(payload);
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
    if (!window.confirm('Hapus kontrak ini?')) return;
    showLoading();
    try {
      const res = await gasClient.deleteVendorContract(id);
      if (res.ok) {
        toast.success('Kontrak dihapus');
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)]">Kontrak Vendor</h1>
          <p className="text-[var(--muted-foreground)] text-sm mt-1">Kelola data vendor, kontrak, dan lampiran.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg font-medium hover:bg-teal-700 transition-colors shadow-sm active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah Kontrak
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
            placeholder="Cari nomor, vendor, kontrak..."
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
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--muted)] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-6 py-4 font-medium">No.</th>
                <th className="px-6 py-4 font-medium">Vendor</th>
                <th className="px-6 py-4 font-medium">Site</th>
                <th className="px-6 py-4 font-medium">Jenis</th>
                <th className="px-6 py-4 font-medium">No. Kontrak</th>
                <th className="px-6 py-4 font-medium">Periode</th>
                <th className="px-6 py-4 font-medium text-center">Status / Sisa</th>
                <th className="px-6 py-4 font-medium text-center">File</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-[var(--muted-foreground)]">
                    Tidak ada data kontrak yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredContracts.map((contract, index) => {
                  const daysLeft = contract.end_kontrak ? calculateDaysRemaining(contract.end_kontrak) : null;
                  const badge = getStatusColorBadge(daysLeft);
                  
                  return (
                    <tr key={contract.id} className="hover:bg-[var(--muted)]/50 transition-colors">
                      <td className="px-6 py-4 text-[var(--muted-foreground)] font-medium">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[var(--foreground)]">{contract.nama_vendor}</div>
                        <div className="text-[var(--muted-foreground)] text-xs mt-0.5">{contract.dept || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--muted)] text-[var(--foreground)]">
                          {contract.site}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--foreground)]">{contract.jenis_kontrak}</td>
                      <td className="px-6 py-4 text-[var(--foreground)] font-mono">{contract.no_kontrak || '-'}</td>
                      <td className="px-6 py-4 text-[var(--muted-foreground)] text-xs">
                        {contract.start_kontrak ? new Date(contract.start_kontrak).toLocaleDateString('id-ID') : '-'}
                        <br />s/d<br />
                        {contract.end_kontrak ? new Date(contract.end_kontrak).toLocaleDateString('id-ID') : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {daysLeft !== null ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                            {daysLeft < 0 ? 'Expired' : `${daysLeft} Hari`}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {contract.file_url ? (
                          <a href={contract.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-2 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors" title="Lihat Lampiran">
                            <Download className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-[var(--muted-foreground)] text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
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
              className="relative w-full max-w-lg bg-[var(--background)] h-full shadow-2xl flex flex-col"
            >
              <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--card)]">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                {editingContract ? 'Edit Kontrak Vendor' : 'Tambah Kontrak Vendor'}
              </h2>
              <button onClick={closeModal} className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--muted)] rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="vendorForm" onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Nama Vendor <span className="text-ruby-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.nama_vendor}
                    onChange={(e) => setFormData({...formData, nama_vendor: e.target.value})}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Site</label>
                    <CustomSelect
                      value={formData.site}
                      onChange={(val) => setFormData({...formData, site: val})}
                      options={[
                        { label: 'LBCT', value: 'LBCT' },
                        { label: 'IDMG', value: 'IDMG' },
                        { label: 'SPCT', value: 'SPCT' }
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Departement</label>
                    <CustomSelect
                      value={formData.dept}
                      onChange={(val) => setFormData({...formData, dept: val})}
                      options={DEPARTMENTS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Jenis Kontrak</label>
                    <CustomSelect
                      value={formData.jenis_kontrak}
                      onChange={(val) => setFormData({...formData, jenis_kontrak: val})}
                      options={[
                        { label: 'Catering', value: 'Catering' },
                        { label: 'Gas & Galon', value: 'Gas & Galon' },
                        { label: 'Laundry', value: 'Laundry' },
                        { label: 'Transport', value: 'Transport' },
                        { label: 'Lainnya', value: 'Lainnya' }
                      ]}
                    />
                  </div>
                  <div className="hidden sm:block"></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">No Kontrak PKS</label>
                    <input
                      type="text"
                      value={formData.no_kontrak}
                      onChange={(e) => setFormData({...formData, no_kontrak: e.target.value})}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent transition-all outline-none font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">CoA Dept</label>
                    <input
                      type="text"
                      value={formData.coa}
                      onChange={(e) => setFormData({...formData, coa: e.target.value})}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent transition-all outline-none font-mono text-sm"
                      placeholder="Misal: 6010-001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Mulai Kontrak</label>
                    <input
                      type="date"
                      value={formData.start_kontrak}
                      onChange={(e) => setFormData({...formData, start_kontrak: e.target.value})}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Kontrak Berakhir <span className="text-ruby-500">*</span></label>
                    <input
                      type="date"
                      required
                      value={formData.end_kontrak}
                      onChange={(e) => setFormData({...formData, end_kontrak: e.target.value})}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--card)] focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent transition-all outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Lampiran Kontrak (PDF/Image)</label>
                  {formData.file_url && !formData.fileData && (
                    <div className="mb-2 p-3 bg-sky-50 rounded-lg flex items-center justify-between border border-sky-100">
                      <span className="text-sm text-sky-800 font-medium">Ada lampiran terlampir</span>
                      <a href={formData.file_url} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline text-sm font-bold">Lihat</a>
                    </div>
                  )}
                  
                  <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-6 text-center hover:bg-[var(--muted)] transition-colors relative">
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--foreground)] font-medium">
                      {formData.fileName ? formData.fileName : 'Klik atau seret file ke sini'}
                    </p>
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
                  form="vendorForm"
                  className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-lg transition-colors shadow-sm active:scale-95"
                >
                  {editingContract ? 'Simpan Perubahan' : 'Tambah Kontrak'}
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
