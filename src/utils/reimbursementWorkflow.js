export const REIMBURSEMENT_STEPS = [
  { code: 'not_started', label: 'Belum Diproses', short: 'Belum Diproses', description: 'Pengajuan tercatat dan menunggu penyusunan rekap.' },
  { code: 'compiling', label: 'Penyusunan Rekap', short: 'Rekap', description: 'GA sedang menyusun dan memeriksa berkas periode ini.' },
  { code: 'site_approval', label: 'Persetujuan GA Site', short: 'GA Site', description: 'Rekap menunggu persetujuan dari GA Site.' },
  { code: 'head_finance_approval', label: 'Persetujuan Kepala GA & Finance', short: 'Kepala GA & Finance', description: 'Rekap menunggu persetujuan Kepala Departemen GA dan Finance.' },
  { code: 'payment_pending', label: 'Proses Pencairan', short: 'Pencairan', description: 'Persetujuan selesai. Pengajuan menunggu pencairan dari Finance.' },
  { code: 'paid', label: 'Selesai Dicairkan', short: 'Selesai', description: 'Pencairan untuk periode ini sudah selesai.' }
];

export function formatEmployeeName(name) {
  return String(name || '').trim().toLocaleLowerCase('id-ID').replace(/(^|[\s-])\p{L}/gu, letter => letter.toLocaleUpperCase('id-ID'));
}

export function workflowCode(meta = {}) {
  if (REIMBURSEMENT_STEPS.some(step => step.code === meta.workflow_status)) return meta.workflow_status;
  if (meta.status_finance === 'Dicairkan') return 'paid';
  if (meta.status_finance === 'Diajukan') return 'payment_pending';
  return 'not_started';
}

export function workflowLabel(code) {
  return REIMBURSEMENT_STEPS.find(step => step.code === code)?.label || REIMBURSEMENT_STEPS[0].label;
}

export function legacyFinanceStatus(code) {
  return code === 'paid' ? 'Dicairkan' : code === 'not_started' || code === 'compiling' ? 'Draft' : 'Diajukan';
}

export function periodKey(record) {
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${record.periode_tahun}-${String(months.indexOf(record.periode_bulan) + 1).padStart(2, '0')}-${record.periode_ke?.includes('1-15') ? 'P1' : 'P2'}`;
}
