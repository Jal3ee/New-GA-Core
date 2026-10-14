import * as XLSX from 'xlsx';
import { formatEmployeeName, workflowLabel } from './reimbursementWorkflow';

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
    ['Status Proses', workflowLabel(periodBatch.workflow_status)],
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
      'Status Proses',
      '1. Link Boarding Pass',
      '2. Link Bukti Cuti',
      '3. Link Nota Keberangkatan',
      '4. Link Nota Kepulangan',
      'Catatan'
    ]
  ];

  // Append items
  periodBatch.items.forEach((item, idx) => {
    rows.push([
      idx + 1,
      item.timestamp || '-',
      formatEmployeeName(item.nama) || '-',
      item.nik || '-',
      item.no_hp || '-',
      item.status || 'CUTI',
      item.departemen || '-',
      item.site || '-',
      item.tgl_berangkat || '-',
      item.tgl_pulang || '-',
      workflowLabel(periodBatch.workflow_status),
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

/**
 * Export the Reimbursement Period Summary Data Table to an Excel (.xlsx) file
 * Includes: Nilai Rupiah, Tanggal Pengajuan, Tanggal Pencairan, and Status Proses.
 * 
 * @param {Object} options
 * @param {Array} options.periodBatches - List of period batch objects
 * @param {Object} options.filterInfo - Current filter parameters
 * @param {string} options.userName - User generating the report
 */
export function exportPeriodSummaryTableToExcel({ periodBatches = [], filterInfo = {}, userName = 'GA Administrator' }) {
  if (!periodBatches || periodBatches.length === 0) {
    throw new Error('Tidak ada data tabel reimbursement untuk diekspor ke Excel.');
  }

  const wb = XLSX.utils.book_new();

  const nowStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const filterSummary = [];
  if (filterInfo.month && filterInfo.month !== 'all') filterSummary.push(`Bulan: ${filterInfo.month}`);
  if (filterInfo.cut && filterInfo.cut !== 'all') {
    filterSummary.push(`Periode: ${filterInfo.cut === 'p1' ? 'Periode 1 (1-15)' : 'Periode 2 (16-31)'}`);
  }
  if (filterInfo.status && filterInfo.status !== 'all') {
    filterSummary.push(`Status: ${workflowLabel(filterInfo.status)}`);
  }
  const filterDesc = filterSummary.length > 0 ? filterSummary.join(' | ') : 'Semua Periode (Keseluruhan)';

  const rows = [
    ['REKAPITULASI TABEL REIMBURSEMENT TIKET & TRANSPORT'],
    ['PT. ANTANG GUNUNG MERATUS - DEPARTEMEN GENERAL AFFAIRS'],
    [''],
    ['Tanggal Cetak/Unduh', nowStr],
    ['Diekspor Oleh', `${userName} (GA Administrator)`],
    ['Filter Data', filterDesc],
    ['Total Paket Periode', `${periodBatches.length} Periode`],
    [''],
    // Table Header
    [
      'No',
      'Paket Periode',
      'Cut-Off Periode',
      'Rentang Tanggal Form',
      'Jumlah Berkas Karyawan',
      'Status Proses',
      'Tanggal Pengajuan Finance',
      'Tanggal Pencairan Finance',
      'Total Nilai Reimbursement (Rp)',
      'Catatan / No. Batch Finance'
    ]
  ];

  let totalEmployees = 0;
  let totalRupiah = 0;

  periodBatches.forEach((batch, idx) => {
    const itemCount = batch.items ? batch.items.length : 0;
    totalEmployees += itemCount;

    const rawRupiah = Number(batch.total_reimbursement);
    const hasRupiah = batch.total_reimbursement !== null && batch.total_reimbursement !== undefined && !isNaN(rawRupiah);
    const rupiahVal = hasRupiah ? rawRupiah : 0;
    totalRupiah += rupiahVal;

    rows.push([
      idx + 1,
      batch.label || '-',
      batch.periode_ke || '-',
      batch.rentang_tanggal || '-',
      itemCount,
      workflowLabel(batch.workflow_status),
      batch.tgl_pengajuan_finance || '-',
      batch.tgl_pencairan_finance || '-',
      hasRupiah ? rupiahVal : 'Belum diisi',
      batch.catatan || '-'
    ]);
  });

  // Grand Total Row
  rows.push([
    '',
    'TOTAL KESELURUHAN',
    '',
    '',
    totalEmployees,
    '',
    '',
    '',
    totalRupiah,
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 28 }, // Paket Periode
    { wch: 20 }, // Cut-off
    { wch: 30 }, // Rentang Tanggal
    { wch: 22 }, // Jumlah Berkas
    { wch: 26 }, // Status Proses
    { wch: 24 }, // Tgl Pengajuan
    { wch: 24 }, // Tgl Pencairan
    { wch: 30 }, // Total Nilai Rupiah
    { wch: 30 }  // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Tabel Reimbursement');

  const filterMonthStr = filterInfo.month && filterInfo.month !== 'all' ? filterInfo.month : 'Semua';
  const fileName = `Rekap_Tabel_Reimbursement_AGM_${filterMonthStr}_${Date.now()}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

