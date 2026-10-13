import * as XLSX from 'xlsx';

/**
 * Export a single period package to an Excel (.xlsx) file
 * Standardized order:
 * 1. Boarding Pass (Kolom AP)
 * 2. Bukti Cuti Approve (Kolom X)
 * 3. Scan Nota Keberangkatan (Kolom Y)
 * 4. Bukti Nota Kepulangan (Kolom AO)
 * Nominal tidak di-include sesuai instruksi pengguna.
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
    ['REKAPITULASI BERKAS REIMBURSEMENT TIKET & TRANSPORT'],
    ['PT. ANTANG GUNUNG MERATUS - DEPARTEMEN GENERAL AFFAIRS'],
    [''],
    ['Periode', periodBatch.label || `${periodBatch.bulan} ${periodBatch.periode_ke}`],
    ['Rentang Waktu', periodBatch.rentang_tanggal || '-'],
    ['Jumlah Berkas', `${periodBatch.items.length} Karyawan`],
    ['Status Finance', periodBatch.status_finance || 'Diajukan'],
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
      'Status Finance',
      '1. Link Boarding Pass (Col AP)',
      '2. Link Bukti Cuti Sunfish (Col X)',
      '3. Link Nota Keberangkatan (Col Y)',
      '4. Link Nota Kepulangan (Col AO)',
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
      item.status_finance || periodBatch.status_finance || 'Diajukan',
      item.url_boarding_pass || '-',
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
    { wch: 25 }, // Dept
    { wch: 10 }, // Site
    { wch: 14 }, // Tgl Berangkat
    { wch: 14 }, // Tgl Pulang
    { wch: 14 }, // Status Finance
    { wch: 42 }, // Link Boarding Pass AP
    { wch: 42 }, // Link Bukti Cuti X
    { wch: 42 }, // Link Nota Keberangkatan Y
    { wch: 42 }, // Link Nota Kepulangan AO
    { wch: 20 }  // Catatan
  ];

  // Append to workbook
  const safeSheetName = (periodBatch.bulan ? `${periodBatch.bulan.substring(0, 3)}_${periodBatch.periode_ke ? (periodBatch.periode_ke.includes('1') ? 'P1' : 'P2') : ''}` : 'Rekap').substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  // Generate file and trigger download
  const safeTitle = (periodBatch.label || 'Periode').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Rekap_Berkas_Reimbursement_${safeTitle}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
