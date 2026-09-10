import { toast } from 'sonner';

export function calculateDaysRemaining(endDateString) {
  if (!endDateString) return null;
  const end = new Date(endDateString);
  const now = new Date();
  
  // Set both to midnight to count full days properly
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function getStatusColorBadge(daysLeft) {
  if (daysLeft === null) return { bg: 'bg-gray-100', text: 'text-gray-700' };
  if (daysLeft < 0) return { bg: 'bg-ruby-100', text: 'text-ruby-800' };
  if (daysLeft <= 30) return { bg: 'bg-ruby-100', text: 'text-ruby-800' }; // <= 1 Month (Red)
  if (daysLeft <= 60) return { bg: 'bg-amber-100', text: 'text-amber-800' }; // <= 2 Months (Yellow)
  return { bg: 'bg-emerald-100', text: 'text-emerald-800' }; // > 2 Months (Green)
}

export function checkContractNotifications(contracts, contractNameKey = 'nama_vendor') {
  if (!contracts || !Array.isArray(contracts)) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  contracts.forEach(contract => {
    if (contract.status === 'Tidak Aktif' || contract.status === 'BD') return; // Skip inactive
    
    const daysLeft = calculateDaysRemaining(contract.end_date || contract.kontrak_berakhir);
    if (daysLeft === null || daysLeft < 0) return; // Already expired or no date

    const name = contract[contractNameKey] || contract.nama_vendor || contract.no_lambung || 'Kontrak';
    
    // Notification logic: 3 months (90 days), 2 months (60 days), 1 month (30 days), 3-1 weeks (21-7 days)
    // We will show a toast if they match specific milestones exactly or are within the 1-3 weeks critical window.
    // To avoid spamming, in a real app this would be tracked if it has been notified, but for demo we will toast for critical thresholds.
    
    if (daysLeft === 90) {
      toast(`Kontrak ${name} akan berakhir dalam 3 bulan (90 hari).`, { icon: '🗓️' });
    } else if (daysLeft === 60) {
      toast.warning(`Kontrak ${name} akan berakhir dalam 2 bulan (60 hari).`);
    } else if (daysLeft === 30) {
      toast.warning(`Kontrak ${name} akan berakhir dalam 1 bulan (30 hari).`, {
        description: 'Mohon segera persiapkan perpanjangan.',
      });
    } else if (daysLeft <= 21 && daysLeft >= 7) {
      toast.error(`Peringatan: Kontrak ${name} akan berakhir dalam ${daysLeft} hari!`, {
        duration: 8000,
        description: 'Tindakan segera diperlukan.',
      });
    }
  });
}
