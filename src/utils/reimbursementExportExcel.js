import * as XLSX from 'xlsx';

/**
 * Format currency to IDR number
 */
export function formatRupiah(num) {
  if (!num && num !== 0) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

/**
 * Export a single period package to an Excel (.xlsx) file
 * 
 * @param {Object} periodBatch - The period package object
 * @param {string} periodBatch.label - e.g. "Januari 2026 - Periode 1 (1-15 Jan)"
 * @param {Array} periodBatch.items - List of individual employee records
 */
export function exportPeriodToExcel(periodBatch) {
  if (!periodBatch || !periodBatch.items || periodBatch.items.length === 0) {
    throw new Error('Tidak ada data karyawan dalam periode ini.');
  }

  const wb = XLSX.utils.book_new();

  // 1. Data Rows
  const rows = [
    ['REKAPITULASI REIMBURSEMENT TIKET & TRANSPORT'],
    ['PT. ANTANG GUNUNG MERATUS - DEPARTEMEN GENERAL AFFAIRS'],
    [''],
    ['Periode', periodBatch.label || `${periodBatch.bulan} ${periodBatch.periode_ke}`],
    ['Rentang Waktu', periodBatch.rentang_tanggal || '-'],
    ['Jumlah Berkas', `${periodBatch.items.length} Karyawan`],
    ['Total Nilai Reimbursement', Number(periodBatch.total_nominal || 0)],
    ['Status Finance', periodBatch.status_finance || 'Draft'],
    ['Tanggal Pengajuan ke Finance', periodBatch.tgl_pengajuan_finance || '-'],
    ['Tanggal Pencairan dari Finance', periodBatch.tgl_pencairan_finance || '-'],
    ['Tanggal Unduh Rekapan', new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })],
    [''],
    // Table Headers
    [
      'No',
      'Tanggal Submit Form',
      'Nama Karyawan',
      'NIK',
      'Nomor Handphone',
      'Status Cuti/Dinas',
      'Departemen',
      'Site',
      'Tgl Berangkat',
      'Tgl Pulang',
      'Nilai Klaim (Rp)',
      'Status Finance',
      'Link Bukti Cuti (Col X)',
      'Link Nota Keberangkatan (Col Y)',
      'Link Nota Kepulangan (Col AO)',
      'Catatan'
    ]
  ];

  // Append items
  periodBatch.items.forEach((item, idx) => {
    rows.push([
      idx + 1,
      item.timestamp || '-',
      item.nama || '-',
      item.nik || '-',
      item.no_hp || '-',
      item.status || 'CUTI',
      item.departemen || '-',
      item.site || '-',
      item.tgl_berangkat || '-',
      item.tgl_pulang || '-',
      Number(item.nominal || 0),
      item.status_finance || periodBatch.status_finance || 'Draft',
      item.url_bukti_cuti || '-',
      item.url_nota_berangkat || '-',
      item.url_nota_pulang || '-',
      item.catatan || '-'
    ]);
  });

  // Convert array of arrays to worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },  // No
    { wch: 18 }, // Tanggal Submit
    { wch: 25 }, // Nama
    { wch: 14 }, // NIK
    { wch: 15 }, // HP
    { wch: 12 }, // Status
    { wch: 22 }, // Dept
    { wch: 10 }, // Site
    { wch: 14 }, // Tgl Berangkat
    { wch: 14 }, // Tgl Pulang
    { wch: 16 }, // Nominal
    { wch: 14 }, // Status Finance
    { wch: 40 }, // Link X
    { wch: 40 }, // Link Y
    { wch: 40 }, // Link AO
    { wch: 20 }, // Catatan
  ];

  const sheetName = (periodBatch.periode_ke ? periodBatch.periode_ke.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25) : 'Rekap_Periode');
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // File Name
  const safeTitle = (periodBatch.label || `${periodBatch.bulan}_${periodBatch.periode_ke}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Rekap_Reimbursement_${safeTitle}.xlsx`;

  // Trigger write and download
  XLSX.writeFile(wb, fileName);
}
