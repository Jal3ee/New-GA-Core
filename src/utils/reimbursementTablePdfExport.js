import { LOGO_AGM_BASE64, LOGO_HCGA_BASE64 } from '../assets/logos/logosBase64';
import { workflowLabel } from './reimbursementWorkflow';

/**
 * Utility to format currency into Indonesian Rupiah (Rp X.XXX.XXX)
 */
export const formatRupiah = (number) => {
  if (number === null || number === undefined || number === '' || isNaN(Number(number))) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(number) || 0);
};

/**
 * Format date string (YYYY-MM-DD or standard) to Indonesian readable date (DD MMMM YYYY)
 */
const formatDateIndo = (dateStr) => {
  if (!dateStr || dateStr === '-' || dateStr.trim() === '') return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

/**
 * Generate Printable Corporate PDF for Reimbursement Period Data Table (A4 Landscape)
 * Reworked corporate view specifically crafted for PDF export.
 */
export function exportReimbursementTableToPdf({
  periodBatches = [],
  filterInfo = {},
  userName = 'GA Administrator',
  userRole = 'GA Administrator'
}) {
  if (!periodBatches || periodBatches.length === 0) {
    alert('Tidak ada data tabel reimbursement yang dapat dicetak/diunduh.');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=1300,height=900');
  if (!printWindow) {
    alert('Pop-up terblokir oleh browser. Silakan izinkan pop-up untuk mengunduh/mencetak dokumen PDF tabel.');
    return;
  }

  const now = new Date();
  const printDateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const printTimeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';

  // Calculate metrics
  const totalBatches = periodBatches.length;
  const totalEmployees = periodBatches.reduce((acc, curr) => acc + (curr.items ? curr.items.length : 0), 0);
  const totalRupiahGrand = periodBatches.reduce((acc, curr) => acc + (Number(curr.total_reimbursement) || 0), 0);
  
  const dicairkanBatches = periodBatches.filter(b => b.workflow_status === 'paid' || b.status_finance === 'Dicairkan');
  const totalDicairkanRupiah = dicairkanBatches.reduce((acc, curr) => acc + (Number(curr.total_reimbursement) || 0), 0);
  
  const prosesBatches = periodBatches.filter(b => b.workflow_status !== 'paid' && b.status_finance !== 'Dicairkan');
  const totalProsesRupiah = prosesBatches.reduce((acc, curr) => acc + (Number(curr.total_reimbursement) || 0), 0);

  // Filter scope text
  const filterSummary = [];
  if (filterInfo.month && filterInfo.month !== 'all') filterSummary.push(`Bulan: ${filterInfo.month}`);
  if (filterInfo.cut && filterInfo.cut !== 'all') {
    filterSummary.push(`Periode: ${filterInfo.cut === 'p1' ? 'Periode 1 (1-15)' : 'Periode 2 (16-31)'}`);
  }
  if (filterInfo.status && filterInfo.status !== 'all') {
    filterSummary.push(`Status: ${workflowLabel(filterInfo.status)}`);
  }
  const filterDesc = filterSummary.length > 0 ? filterSummary.join(' | ') : 'Semua Periode & Status (Keseluruhan Data Aktif)';

  // Build table rows HTML
  const rowsHtml = periodBatches.map((batch, idx) => {
    const isPaid = batch.workflow_status === 'paid' || batch.status_finance === 'Dicairkan';
    const isPending = batch.workflow_status === 'payment_pending' || batch.workflow_status === 'head_finance_approval' || batch.status_finance === 'Diajukan';
    
    // Status badge style
    let statusBadgeStyle = 'background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;';
    let statusText = workflowLabel(batch.workflow_status);
    let statusIcon = '⏳';

    if (isPaid) {
      statusBadgeStyle = 'background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;';
      statusIcon = '✓';
    } else if (isPending) {
      statusBadgeStyle = 'background-color: #fffbeb; color: #92400e; border: 1px solid #fde68a;';
      statusIcon = '⏱';
    }

    const itemCount = batch.items ? batch.items.length : 0;
    const rawRupiah = Number(batch.total_reimbursement);
    const hasRupiah = batch.total_reimbursement !== null && batch.total_reimbursement !== undefined && !isNaN(rawRupiah);
    const rupiahFormatted = hasRupiah ? formatRupiah(rawRupiah) : '<span style="color: #94a3b8; font-style: italic;">Belum diisi</span>';

    const tglPengajuanFormatted = formatDateIndo(batch.tgl_pengajuan_finance);
    const tglPencairanFormatted = formatDateIndo(batch.tgl_pencairan_finance);

    const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

    return `
      <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 7px 5px; text-align: center; font-family: monospace; font-size: 10px; color: #64748b; font-weight: 600;">${idx + 1}</td>
        
        <td style="padding: 7px 8px;">
          <div style="font-weight: 700; color: #0f172a; font-size: 11px;">${batch.label || '-'}</div>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">Cut-Off: ${batch.periode_ke || '-'}</div>
        </td>

        <td style="padding: 7px 8px; font-size: 10.5px; color: #334155; white-space: nowrap;">
          <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #0f766e; margin-right: 4px; vertical-align: middle;"></span>
          ${batch.rentang_tanggal || '-'}
        </td>

        <td style="padding: 7px 6px; text-align: center; white-space: nowrap;">
          <span style="display: inline-block; padding: 2px 7px; border-radius: 9999px; font-size: 10px; font-weight: 700; font-family: monospace; ${itemCount > 0 ? 'background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;' : 'background-color: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0;'}">
            ${itemCount} Berkas
          </span>
        </td>

        <td style="padding: 7px 6px; text-align: center; white-space: nowrap;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 9.5px; font-weight: 700; ${statusBadgeStyle}">
            <span style="margin-right: 3px;">${statusIcon}</span> ${statusText}
          </span>
        </td>

        <td style="padding: 7px 8px; text-align: center; font-family: monospace; font-size: 10.5px; color: #1e293b; white-space: nowrap;">
          ${tglPengajuanFormatted}
        </td>

        <td style="padding: 7px 8px; text-align: center; font-family: monospace; font-size: 10.5px; white-space: nowrap; ${batch.tgl_pencairan_finance ? 'color: #047857; font-weight: 700;' : 'color: #64748b;'}">
          ${tglPencairanFormatted}
        </td>

        <td style="padding: 7px 10px; text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; font-weight: 700; color: #0f172a; white-space: nowrap;">
          ${rupiahFormatted}
        </td>

        <td style="padding: 7px 8px; font-size: 10px; color: #475569; max-width: 140px; word-wrap: break-word;">
          ${batch.catatan || '-'}
        </td>
      </tr>
    `;
  }).join('');

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekapitulasi Tabel Reimbursement Tiket & Transport - PT. Antang Gunung Meratus</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm 10mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      font-size: 11px;
      line-height: 1.35;
      padding: 6px;
    }

    /* Action bar for browser preview */
    .no-print-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: #042f2e;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .no-print-bar h3 {
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .no-print-bar .btn-group {
      display: flex;
      gap: 8px;
    }
    .btn {
      cursor: pointer;
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 700;
      border-radius: 6px;
      border: none;
      transition: all 0.2s;
    }
    .btn-print {
      background-color: #0d9488;
      color: #ffffff;
    }
    .btn-print:hover {
      background-color: #0f766e;
    }
    .btn-close {
      background-color: #334155;
      color: #ffffff;
    }
    .btn-close:hover {
      background-color: #475569;
    }

    @media print {
      .no-print-bar {
        display: none !important;
      }
      body {
        padding: 0;
      }
      tr {
        page-break-inside: avoid;
      }
    }

    /* Corporate Header (Kop Surat) */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      border-bottom: 2.5px solid #0f766e;
      padding-bottom: 6px;
    }
    .logo-td-left {
      width: 18%;
      vertical-align: middle;
      text-align: left;
    }
    .logo-td-right {
      width: 18%;
      vertical-align: middle;
      text-align: right;
    }
    .title-td-center {
      width: 64%;
      vertical-align: middle;
      text-align: center;
      padding: 0 10px;
    }
    .logo-img {
      height: 48px;
      max-width: 140px;
      object-fit: contain;
    }
    .company-title {
      font-size: 14px;
      font-weight: 800;
      color: #0f766e;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 1px;
    }
    .dept-title {
      font-size: 10.5px;
      font-weight: 700;
      color: #334155;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .doc-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.2px;
      text-transform: uppercase;
      margin-bottom: 1px;
    }
    .doc-subtitle {
      font-size: 9.5px;
      color: #64748b;
    }

    /* Document Metadata & Summary KPI */
    .meta-kpi-container {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 10px;
      margin-bottom: 10px;
    }
    .meta-box {
      flex: 1;
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 10px;
      font-size: 10px;
      color: #334155;
      line-height: 1.45;
    }
    .meta-box strong {
      color: #0f172a;
    }
    .kpi-cards {
      display: flex;
      gap: 8px;
    }
    .kpi-card {
      background-color: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 12px;
      min-width: 130px;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .kpi-card-title {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: #64748b;
      margin-bottom: 2px;
    }
    .kpi-card-val {
      font-size: 12px;
      font-weight: 800;
      font-family: 'Consolas', 'Courier New', monospace;
      color: #0f766e;
    }

    /* Main Table Rework */
    .main-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .main-table thead th {
      background-color: #0f766e;
      color: #ffffff;
      font-weight: 700;
      font-size: 9.5px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      padding: 7px 6px;
      border: 1px solid #0d9488;
      vertical-align: middle;
    }
    .main-table tfoot td {
      background-color: #f1f5f9;
      border-top: 2px solid #0f766e;
      padding: 8px 6px;
      font-weight: 700;
    }

    /* Signatures Section */
    .signature-section {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      page-break-inside: avoid;
    }
    .signature-col {
      width: 33.33%;
      text-align: center;
      vertical-align: top;
      padding: 0 10px;
    }
    .signature-title {
      font-size: 10.5px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 2px;
    }
    .signature-role {
      font-size: 9.5px;
      color: #64748b;
      margin-bottom: 50px;
    }
    .signature-line {
      display: inline-block;
      width: 170px;
      border-bottom: 1px solid #0f172a;
      margin-bottom: 3px;
    }
    .signature-name {
      font-size: 10px;
      font-weight: 700;
      color: #0f172a;
    }

    /* Footer Note */
    .footer-note {
      margin-top: 12px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 6px;
      font-size: 8.5px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <!-- No-print Bar with Quick Action Buttons -->
  <div class="no-print-bar">
    <h3>
      <span>📄</span> Format Cetak & Download PDF Tabel Reimbursement Tiket & Transport
    </h3>
    <div class="btn-group">
      <button class="btn btn-print" onclick="window.print()">🖨️ Cetak / Simpan sebagai PDF</button>
      <button class="btn btn-close" onclick="window.close()">Tutup</button>
    </div>
  </div>

  <!-- Corporate Header / Kop Surat PT. AGM -->
  <table class="header-table">
    <tr>
      <td class="logo-td-left">
        <img class="logo-img" src="${LOGO_AGM_BASE64}" alt="PT. Antang Gunung Meratus" />
      </td>
      <td class="title-td-center">
        <div class="company-title">PT. ANTANG GUNUNG MERATUS</div>
        <div class="dept-title">DEPARTEMEN GENERAL AFFAIRS • HUMAN CAPITAL & GENERAL AFFAIRS</div>
        <div class="doc-title">REKAPITULASI DATA PERIODE & STATUS PENCAIRAN REIMBURSEMENT TIKET / TRANSPORT</div>
        <div class="doc-subtitle">Rekapan Resmi Nilai Rupiah, Tanggal Pengajuan, Tanggal Pencairan Finance, dan Status Workflow</div>
      </td>
      <td class="logo-td-right">
        <img class="logo-img" src="${LOGO_HCGA_BASE64}" alt="HC & GA Logo" />
      </td>
    </tr>
  </table>

  <!-- Metadata Snapshot & Macro KPI -->
  <div class="meta-kpi-container">
    <div class="meta-box">
      <div><strong>Tanggal Cetak:</strong> ${printDateStr}, ${printTimeStr}</div>
      <div><strong>Dicetak Oleh:</strong> ${userName} (${userRole})</div>
      <div><strong>Filter Dokumen:</strong> <span style="color: #0f766e; font-weight: 600;">${filterDesc}</span></div>
    </div>
    <div class="kpi-cards">
      <div class="kpi-card">
        <div class="kpi-card-title">Paket Periode</div>
        <div class="kpi-card-val" style="color: #0284c7;">${totalBatches} <span style="font-size: 9px; font-weight: normal; color: #64748b;">Paket</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-title">Total Berkas</div>
        <div class="kpi-card-val" style="color: #4f46e5;">${totalEmployees} <span style="font-size: 9px; font-weight: normal; color: #64748b;">Karyawan</span></div>
      </div>
      <div class="kpi-card" style="border-color: #a7f3d0; background-color: #f0fdf4;">
        <div class="kpi-card-title" style="color: #065f46;">Total Dicairkan</div>
        <div class="kpi-card-val" style="color: #047857;">${formatRupiah(totalDicairkanRupiah)}</div>
      </div>
      <div class="kpi-card" style="border-color: #0f766e; background-color: #f0fdfa;">
        <div class="kpi-card-title" style="color: #0f766e;">Grand Total Nilai</div>
        <div class="kpi-card-val" style="color: #0f766e;">${formatRupiah(totalRupiahGrand)}</div>
      </div>
    </div>
  </div>

  <!-- Reworked Corporate Table -->
  <table class="main-table">
    <thead>
      <tr>
        <th style="width: 32px; text-align: center;">No</th>
        <th style="width: 145px; text-align: left;">Paket Periode</th>
        <th style="width: 140px; text-align: left;">Rentang Cut-Off</th>
        <th style="width: 80px; text-align: center;">Jumlah Berkas</th>
        <th style="width: 135px; text-align: center;">Status Proses</th>
        <th style="width: 95px; text-align: center;">Tgl Pengajuan</th>
        <th style="width: 95px; text-align: center;">Tgl Pencairan</th>
        <th style="width: 145px; text-align: right;">Total Reimbursement</th>
        <th style="width: 130px; text-align: left;">Catatan / No. Batch</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align: right; padding-right: 12px; font-size: 11px; text-transform: uppercase; color: #0f172a;">
          TOTAL KESELURUHAN (${totalBatches} PERIODE)
        </td>
        <td style="text-align: center; font-family: monospace; font-size: 11px; font-weight: 800; color: #0369a1;">
          ${totalEmployees} Berkas
        </td>
        <td colspan="3" style="text-align: center; font-size: 10px; color: #64748b;">
          Dicairkan: <strong>${formatRupiah(totalDicairkanRupiah)}</strong> | Proses: <strong>${formatRupiah(totalProsesRupiah)}</strong>
        </td>
        <td style="text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; font-weight: 800; color: #0f766e; white-space: nowrap; padding-right: 10px;">
          ${formatRupiah(totalRupiahGrand)}
        </td>
        <td style="text-align: center; color: #64748b; font-size: 9px;">
          Verified Data
        </td>
      </tr>
    </tfoot>
  </table>

  <!-- Official Corporate Sign-off Block (3 Kolom Pengesahan GA & Finance) -->
  <table class="signature-section">
    <tr>
      <td class="signature-col">
        <div class="signature-title">Dibuat Oleh,</div>
        <div class="signature-role">${userRole}</div>
        <div class="signature-line"></div>
        <div class="signature-name">( ${userName} )</div>
        <div style="font-size: 8.5px; color: #94a3b8; margin-top: 1px;">Tgl: .......................................</div>
      </td>
      <td class="signature-col">
        <div class="signature-title">Diperiksa Oleh,</div>
        <div class="signature-role">General Affairs Group Leader (GL)</div>
        <div class="signature-line"></div>
        <div class="signature-name">( .................................................... )</div>
        <div style="font-size: 8.5px; color: #94a3b8; margin-top: 1px;">Tgl: .......................................</div>
      </td>
      <td class="signature-col">
        <div class="signature-title">Disetujui Oleh,</div>
        <div class="signature-role">Section Head / Dept Head HC & GA</div>
        <div class="signature-line"></div>
        <div class="signature-name">( .................................................... )</div>
        <div style="font-size: 8.5px; color: #94a3b8; margin-top: 1px;">Tgl: .......................................</div>
      </td>
    </tr>
  </table>

  <!-- Footer Information -->
  <div class="footer-note">
    <span>Dokumen Sistem Internal General Affairs • PT. Antang Gunung Meratus • Terhubung Sumber Data Google Spreadsheet</span>
    <span>Halaman 1 dari 1 (Dokumen Rekapitulasi Resmi)</span>
  </div>

  <script>
    // Focus preview window
    window.focus();
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
