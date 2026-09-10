import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  
  return (
    <div className="space-y-6">
      {/* Dashboard konten utama */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI Cards */}
        {[
          { label: 'Total Kamar Terisi', value: '42', delta: '+2 dari bulan lalu', border: 'border-[var(--teal-600)]' },
          { label: 'Stok BHP Kritis', value: '3', delta: 'Perlu restock', border: 'border-[var(--destructive)]' },
          { label: 'Pengajuan Transport', value: '12', delta: 'Hari ini', border: 'border-[var(--accent)]' },
          { label: 'Keluhan Masuk', value: '5', delta: '2 belum ditangani', border: 'border-[var(--info)]' }
        ].map((kpi, idx) => (
          <div key={idx} className={`bg-[var(--card)] p-6 rounded-[var(--radius-lg)] border border-[var(--border)] border-l-4 ${kpi.border}`}>
            <h3 className="text-[var(--muted-foreground)] text-sm font-medium">{kpi.label}</h3>
            <div className="text-3xl font-display font-bold text-[var(--foreground)] mt-2">{kpi.value}</div>
            <p className="text-xs text-[var(--muted-foreground)] mt-2">{kpi.delta}</p>
          </div>
        ))}
      </div>

      <div className="bg-[var(--card)] p-6 rounded-[var(--radius-lg)] border border-[var(--border)] min-h-[300px] flex items-center justify-center">
        <p className="text-[var(--muted-foreground)] text-center">
          Konten dashboard utama akan ditempatkan di sini. <br/>
          (Chart tren pemakaian, dsb.)
        </p>
      </div>
    </div>
  );
}
