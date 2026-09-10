import React, { useState, useEffect } from 'react';
import { api as gasClient } from '../lib/gasClient';
import { toast } from 'sonner';
import { useGlobalLoading as useLoading } from '../context/LoadingContext';
import { Plus, Edit2, Trash2, Search, X, Calendar as CalendarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from '../components/ui/CustomSelect';

export default function KaryawanPage() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const { showLoading, hideLoading } = useLoading();

  const [formData, setFormData] = useState({
    nik: '',
    name: '',
    role: 'Karyawan',
    status: 'Active',
    birthdate: '',
    password: ''
  });

  const fetchUsers = async () => {
    showLoading();
    try {
      const res = await gasClient.getUsers();
      if (res.ok) setUsers(res.data || []);
      else toast.error(res.message || 'Gagal memuat pengguna');
    } catch (e) {
      toast.error('Terjadi kesalahan jaringan');
    } finally {
      hideLoading();
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        nik: user.nik || '',
        name: user.name || '',
        role: user.role || 'Karyawan',
        status: user.status || 'Active',
        birthdate: user.birthdate || '',
        password: '' // empty password so we don't accidentally override
      });
    } else {
      setEditingUser(null);
      setFormData({
        nik: '',
        name: '',
        role: 'Karyawan',
        status: 'Active',
        birthdate: '',
        password: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nik || !formData.name) {
      return toast.warning('NIK dan Nama wajib diisi');
    }
    if (!editingUser && !formData.password) {
      return toast.warning('Password wajib diisi untuk pengguna baru');
    }

    showLoading();
    try {
      let res;
      if (editingUser) {
        // If password is not filled, don't send it so it's not overridden
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        res = await gasClient.updateUser(editingUser.id, payload);
      } else {
        res = await gasClient.createUser(formData);
      }

      if (res.ok) {
        toast.success(editingUser ? 'Pengguna diperbarui' : 'Pengguna berhasil ditambahkan');
        closeModal();
        fetchUsers();
      } else {
        toast.error(res.message || 'Gagal menyimpan');
      }
    } catch (e) {
      toast.error('Kesalahan jaringan');
    } finally {
      hideLoading();
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Yakin ingin menghapus ${name}?`)) return;
    showLoading();
    try {
      const res = await gasClient.deleteUser(id);
      if (res.ok) {
        toast.success('Pengguna berhasil dihapus');
        fetchUsers();
      } else {
        toast.error(res.message || 'Gagal menghapus pengguna');
      }
    } catch (e) {
      toast.error('Kesalahan jaringan');
    } finally {
      hideLoading();
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (u.nik || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'Semua' || u.role === filterRole;
    const matchesStatus = filterStatus === 'Semua' || u.status === filterStatus;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-[var(--foreground)] tracking-tight">Manajemen Karyawan</h1>
          <p className="text-[var(--muted-foreground)] text-sm">Kelola data, akses, dan tanggal lahir seluruh karyawan</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary)]/90 transition-colors shadow-sm flex items-center group active:scale-95"
        >
          <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" /> Tambah Karyawan
        </button>
      </div>

      {/* Tools / Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[var(--card)] p-3 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-sm">
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Cari berdasarkan NIK atau Nama..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="w-full sm:w-auto flex flex-1 items-center gap-3">
          <CustomSelect 
            value={filterRole} 
            onChange={setFilterRole}
            className="sm:w-40 z-20"
            options={[
              { value: 'Semua', label: 'Semua Role' },
              { value: 'Admin', label: 'Admin' },
              { value: 'Karyawan', label: 'Karyawan' }
            ]}
          />
          
          <CustomSelect 
            value={filterStatus} 
            onChange={setFilterStatus}
            className="sm:w-40 z-20"
            options={[
              { value: 'Semua', label: 'Semua Status' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' }
            ]}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <th className="px-6 py-3 font-medium">Karyawan</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Tgl Lahir</th>
                <th className="px-6 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-[var(--muted-foreground)]">
                    Tidak ada data ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold shadow-sm mr-3">
                          {u.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-[var(--foreground)]">{u.name}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">{u.nik}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'Admin' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' 
                                           : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        u.status === 'Active' 
                          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400' 
                          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)] flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 opacity-50" />
                      {u.birthdate || '-'}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => openModal(u)}
                        className="p-1.5 text-[var(--muted-foreground)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(u.id, u.name)}
                        className="p-1.5 text-[var(--muted-foreground)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
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
              className="relative bg-[var(--card)] w-full max-w-md rounded-[var(--radius-lg)] shadow-xl border border-[var(--border)] overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                <h2 className="text-lg font-semibold text-[var(--foreground)] font-display tracking-tight">
                  {editingUser ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}
                </h2>
                <button onClick={closeModal} className="p-1.5 rounded-full text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors active:scale-95">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[var(--foreground)]">NIK <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      disabled={!!editingUser}
                      value={formData.nik}
                      onChange={(e) => setFormData({...formData, nik: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow shadow-sm disabled:opacity-50 disabled:bg-[var(--muted)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[var(--foreground)]">Nama <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow shadow-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    {editingUser ? 'Reset Password (kosongkan jika tidak diubah)' : 'Password'} <span className={!editingUser ? "text-red-500" : ""}>{!editingUser && '*'}</span>
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow shadow-sm"
                    placeholder={editingUser ? 'Kosongkan jika tidak ada perubahan' : 'Password login'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 z-20">
                    <label className="text-sm font-medium text-[var(--foreground)]">Role</label>
                    <CustomSelect 
                      value={formData.role} 
                      onChange={(val) => setFormData({...formData, role: val})}
                      options={[
                        { value: 'Karyawan', label: 'Karyawan' },
                        { value: 'Admin', label: 'Admin' }
                      ]}
                    />
                  </div>
                  
                  <div className="space-y-1 z-10">
                    <label className="text-sm font-medium text-[var(--foreground)]">Status</label>
                    <CustomSelect 
                      value={formData.status} 
                      onChange={(val) => setFormData({...formData, status: val})}
                      options={[
                        { value: 'Active', label: 'Active' },
                        { value: 'Inactive', label: 'Inactive' }
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-[var(--foreground)]">Tanggal Lahir</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
                    <input
                      type="date"
                      value={formData.birthdate}
                      onChange={(e) => setFormData({...formData, birthdate: e.target.value})}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow shadow-sm"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-[var(--foreground)] bg-[var(--background)] hover:bg-[var(--muted)] border border-[var(--border)] rounded-[var(--radius-md)] transition-colors active:scale-95 shadow-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-[var(--radius-md)] transition-colors active:scale-95 shadow-sm"
                  >
                    Simpan Data
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
