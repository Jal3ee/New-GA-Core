import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api as gasClient } from '../lib/gasClient';
import { useGlobalLoading } from '../context/LoadingContext';
import { toast } from 'sonner';
import { User, Lock, Key, Calendar as CalendarIcon, Hash, Shield } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const { showLoading, hideLoading } = useGlobalLoading();
  
  const [passwords, setPasswords] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.warning('Konfirmasi password baru tidak cocok');
    }
    
    if (passwords.newPassword.length < 5) {
      return toast.warning('Password baru minimal 5 karakter');
    }

    showLoading('Memverifikasi...');
    try {
      const res = await gasClient.updatePassword(user.nik, passwords.oldPassword, passwords.newPassword);
      if (res.ok) {
        toast.success('Password berhasil diperbarui!');
        setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(res.message || 'Gagal mengubah password');
      }
    } catch (err) {
      toast.error('Kesalahan jaringan saat memproses permintaan');
    } finally {
      hideLoading();
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-display text-[var(--foreground)] tracking-tight">Profil Pengguna</h1>
        <p className="text-[var(--muted-foreground)] text-sm mt-1">Lihat informasi akun Anda dan atur keamanan password.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - User Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden text-center p-6 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-3xl font-bold mb-4 shadow-md">
              {user.name.charAt(0)}
            </div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">{user.name}</h2>
            <p className="text-[var(--muted-foreground)] text-sm mb-4">{user.role}</p>
            
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
              user.status === 'Active' 
                ? 'border-green-200 bg-green-50 text-green-700' 
                : 'border-red-200 bg-red-50 text-red-700'
            }`}>
              Status: {user.status}
            </span>
          </div>

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-sm p-5 space-y-4">
            <h3 className="font-medium text-[var(--foreground)] border-b border-[var(--border)] pb-2">Informasi Personal</h3>
            
            <div className="space-y-3">
              <div className="flex items-start text-sm">
                <Hash className="w-4 h-4 mr-3 mt-0.5 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs">Nomor Induk Karyawan</p>
                  <p className="font-medium text-[var(--foreground)]">{user.nik}</p>
                </div>
              </div>
              
              <div className="flex items-start text-sm">
                <User className="w-4 h-4 mr-3 mt-0.5 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs">Nama Lengkap</p>
                  <p className="font-medium text-[var(--foreground)]">{user.name}</p>
                </div>
              </div>
              
              <div className="flex items-start text-sm">
                <Shield className="w-4 h-4 mr-3 mt-0.5 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs">Hak Akses Sistem</p>
                  <p className="font-medium text-[var(--foreground)]">{user.role}</p>
                </div>
              </div>
              
              <div className="flex items-start text-sm">
                <CalendarIcon className="w-4 h-4 mr-3 mt-0.5 text-[var(--muted-foreground)]" />
                <div>
                  <p className="text-[var(--muted-foreground)] text-xs">Tanggal Lahir</p>
                  <p className="font-medium text-[var(--foreground)]">{user.birthdate || 'Belum diatur'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Change Password Form */}
        <div className="md:col-span-2">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-sm p-6">
            <div className="flex items-center mb-6 border-b border-[var(--border)] pb-4">
              <div className="p-2 bg-[var(--primary)]/10 text-[var(--primary)] rounded-lg mr-3">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-[var(--foreground)] tracking-tight">Ubah Password</h3>
                <p className="text-[var(--muted-foreground)] text-sm">Perbarui password Anda secara berkala untuk menjaga keamanan akun.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)] flex items-center">
                  <Lock className="w-4 h-4 mr-2 text-[var(--muted-foreground)]" />
                  Password Lama
                </label>
                <input
                  type="password"
                  required
                  value={passwords.oldPassword}
                  onChange={(e) => setPasswords({...passwords, oldPassword: e.target.value})}
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm transition-shadow"
                  placeholder="Masukkan password saat ini"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)] flex items-center">
                  <Key className="w-4 h-4 mr-2 text-[var(--muted-foreground)]" />
                  Password Baru
                </label>
                <input
                  type="password"
                  required
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm transition-shadow"
                  placeholder="Masukkan password baru"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-[var(--foreground)] flex items-center">
                  <Key className="w-4 h-4 mr-2 text-[var(--muted-foreground)]" />
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  required
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                  className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] shadow-sm transition-shadow"
                  placeholder="Ulangi password baru"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary)]/90 rounded-[var(--radius-md)] transition-colors active:scale-95 shadow-md flex items-center"
                >
                  Simpan Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
