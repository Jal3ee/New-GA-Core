import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gasFetch } from '../lib/gasClient';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const [nik, setNik] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nik || !password) {
      toast.error('NIK dan Password wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      // call our GAS backend to verify login
      const res = await gasFetch('LOGIN', { nik, password });
      if (res.ok) {
        if (res.data.status !== 'Active') {
          toast.error('Akun Anda tidak aktif. Silakan hubungi admin.');
        } else {
          login(res.data);
          toast.success('Berhasil masuk.');
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      toast.error(err.message || 'Gagal login. Periksa NIK dan Password Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="max-w-md w-full bg-[var(--card)] p-8 rounded-[var(--radius-lg)] shadow-md border border-[var(--border)]">
        <div className="mb-8 text-center">
          <img src="/logo-gacore-horizontal.png" alt="GA-Core Logo" className="h-14 w-auto mx-auto object-contain" />
          <p className="text-[var(--muted-foreground)] mt-2">Masuk ke platform operasional GA</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[var(--foreground)] text-sm font-medium mb-1.5" htmlFor="nik">
              NIK
            </label>
            <input
              id="nik"
              type="text"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              className="w-full px-4 py-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent transition-all"
              placeholder="Masukkan NIK Anda"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-[var(--foreground)] text-sm font-medium mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent transition-all"
              placeholder="Masukkan password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] rounded-[var(--radius-md)] font-medium transition-transform active:scale-[0.97] flex items-center justify-center h-[44px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Masuk'}
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          Gunakan NIK <strong>admin</strong> / <strong>admin</strong> untuk demo Admin.<br/>
          Atau NIK <strong>karyawan</strong> / <strong>karyawan</strong> untuk Karyawan.
        </div>
      </div>
    </div>
  );
}
