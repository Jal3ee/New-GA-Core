import { LOGO_AGM_BASE64, LOGO_HCGA_BASE64 } from '../assets/logos/logosBase64';

/**
 * generateCateringPdfReport
 * Exports high-resolution, modern minimalist corporate report for PT. Antang Gunung Meratus
 * with corporate headers, weekly monitoring, standar report matrix, detailing, and photos.
 */
export function generateCateringPdfReport({
  selectedYear = 2026,
  selectedMonth = 'Januari',
  selectedVendor = 'all',
  selectedSite = 'all',
  reportMatrix = [],
  scorings = [],
  kpiMetrics = {}
}) {
  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) {
    alert('Pop-up terblokir oleh browser. Silakan izinkan pop-up untuk mencetak PDF.');
    return;
  }

  // Filter matrix and scorings based on vendor/month/site
  const filteredMatrix = reportMatrix.filter(row => {
    if (selectedVendor !== 'all' && row.vendor_name !== selectedVendor && row.vendor_id !== selectedVendor) {
      return false;
    }
    if (selectedSite !== 'all' && row.site !== selectedSite) {
      return false;
    }
    return true;
  });

  const filteredScorings = scorings.filter(sc => {
    if (sc.year !== selectedYear) return false;
    if (selectedMonth !== 'all' && sc.month !== selectedMonth) return false;
    if (selectedVendor !== 'all' && sc.vendor_name !== selectedVendor && sc.vendor_id !== selectedVendor) return false;
    if (selectedSite !== 'all' && sc.site !== selectedSite) return false;
    return true;
  });

  // Format print date
  const now = new Date();
  const printDateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const printTimeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';

  // Period label
  const periodLabel = selectedMonth === 'all'
    ? `Seluruh Bulan (Tahun ${selectedYear})`
    : `Bulan ${selectedMonth} ${selectedYear}`;

  const vendorLabel = selectedVendor === 'all'
    ? 'Seluruh Vendor Katering'
    : selectedVendor;

  const siteLabel = selectedSite === 'all'
    ? 'Seluruh Site (LBCT, IDMG, SPCT)'
    : `Site ${selectedSite}`;

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan_Food_Index_Catering_${selectedYear}_${selectedMonth}.pdf</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10px;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #0F5C56;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .header-logo {
      height: 48px;
      object-fit: contain;
    }
    .header-title-box {
      text-align: center;
      padding: 0 10px;
    }
    .company-name {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0F5C56;
      text-transform: uppercase;
    }
    .dept-name {
      font-size: 10px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .doc-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 3px;
      text-transform: uppercase;
    }
    .meta-strip {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 14px;
      font-size: 9px;
    }
    .meta-item strong {
      color: #0F5C56;
    }

    /* KPI Cards */
    .kpi-row {
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
    }
    .kpi-card {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      background: #f8fafc;
    }
    .kpi-label {
      font-size: 8.5px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }
    .kpi-val {
      font-size: 14px;
      font-weight: 800;
      color: #0F5C56;
      font-family: monospace;
      margin-top: 2px;
    }
    .kpi-sub {
      font-size: 8px;
      color: #64748b;
    }

    /* Section Headings */
    .section-header {
      font-size: 10.5px;
      font-weight: 800;
      color: #0F5C56;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-left: 3px solid #0F5C56;
      padding-left: 6px;
      margin-top: 14px;
      margin-bottom: 6px;
    }

    /* Tables */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 8.5px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      vertical-align: middle;
    }
    table.data-table th {
      background-color: #f1f5f9;
      font-weight: 700;
      color: #334155;
      text-align: left;
    }
    table.data-table th.center, table.data-table td.center {
      text-align: center;
    }
    table.data-table th.right, table.data-table td.right {
      text-align: right;
    }
    table.data-table tr:nth-child(even) td {
      background-color: #fafbfc;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 7.5px;
      font-weight: 700;
    }
    .badge-pass {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .badge-warn {
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fde68a;
    }

    /* Photos Grid */
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-top: 6px;
      margin-bottom: 12px;
    }
    .photo-card {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      background: #f8fafc;
      page-break-inside: avoid;
    }
    .photo-img {
      width: 100%;
      height: 90px;
      object-fit: cover;
      display: block;
    }
    .photo-desc {
      padding: 4px 6px;
      font-size: 7.5px;
      color: #334155;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
    }

    /* Sign-off */
    .sign-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 24px;
      page-break-inside: avoid;
    }
    .sign-table td {
      width: 33.33%;
      text-align: center;
      vertical-align: top;
      padding: 0 10px;
    }
    .sign-title {
      font-size: 9px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 45px;
    }
    .sign-name {
      font-size: 9px;
      font-weight: 700;
      border-top: 1px solid #94a3b8;
      padding-top: 4px;
      color: #0f172a;
    }
    .sign-role {
      font-size: 8px;
      color: #64748b;
    }

    .no-print-bar {
      background: #0F5C56;
      color: #ffffff;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1000;
      font-size: 12px;
      font-weight: 600;
      border-bottom: 1px solid #0b433e;
      margin: -12mm -14mm 14px -14mm;
    }
    .no-print-bar button {
      background: #ffffff;
      color: #0F5C56;
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      font-weight: 700;
      cursor: pointer;
      font-size: 11px;
    }
    .no-print-bar button:hover {
      background: #f1f5f9;
    }

    @media print {
      .no-print-bar {
        display: none !important;
      }
      body {
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>Laporan Siap Cetak / Unduh PDF - PT. Antang Gunung Meratus</span>
    <div>
      <button onclick="window.print()">Cetak / Simpan PDF</button>
      <button onclick="window.close()" style="margin-left: 6px; background: transparent; color: #ffffff; border: 1px solid #ffffff;">Tutup</button>
    </div>
  </div>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td style="width: 15%; text-align: left; vertical-align: middle;">
        <img src="${LOGO_AGM_BASE64}" class="header-logo" alt="Logo AGM" />
      </td>
      <td class="header-title-box" style="width: 70%;">
        <div class="company-name">PT. Antang Gunung Meratus</div>
        <div class="dept-name">Human Capital & General Affairs Department</div>
        <div class="doc-title">Laporan Food Index & Frekuensi Inspeksi Katering</div>
      </td>
      <td style="width: 15%; text-align: right; vertical-align: middle;">
        <img src="${LOGO_HCGA_BASE64}" class="header-logo" alt="Logo HCGA" />
      </td>
    </tr>
  </table>

  <!-- Meta Info -->
  <div class="meta-strip">
    <div><strong>Periode:</strong> ${periodLabel}</div>
    <div><strong>Filter Vendor:</strong> ${vendorLabel}</div>
    <div><strong>Lokasi:</strong> ${siteLabel}</div>
    <div><strong>Dicetak Pada:</strong> ${printDateStr} (${printTimeStr})</div>
  </div>

  <!-- KPI Snapshot -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-label">Rata-rata Capaian Food Index</div>
      <div class="kpi-val">${kpiMetrics.avgFoodIndex || '0.0'}%</div>
      <div class="kpi-sub">Target Standar: &ge; 85.0%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Sesi Inspeksi</div>
      <div class="kpi-val">${filteredScorings.length} Sesi</div>
      <div class="kpi-sub">Evaluasi mingguan (W1 - W4)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Vendor Terdaftar</div>
      <div class="kpi-val">${filteredMatrix.length} Mitra</div>
      <div class="kpi-sub">Katering resmi site operasional</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Kepatuhan Target Frekuensi</div>
      <div class="kpi-val">${kpiMetrics.complianceRate || 0}%</div>
      <div class="kpi-sub">Target minimal 2x inspeksi / bulan</div>
    </div>
  </div>

  <!-- SECTION 1: Matriks Standar Report -->
  <div class="section-header">1. Form Pencapaian Inspeksi Katering (Standar Report)</div>
  <table class="data-table">
    <thead>
      <tr>
        <th rowspan="2" class="center" style="width: 25px;">No</th>
        <th rowspan="2">Nama Vendor & Katering</th>
        <th rowspan="2" class="center" style="width: 65px;">Site & Tipe</th>
        <th colspan="4" class="center">Capaian Mingguan (%)</th>
        <th colspan="3" class="center" style="background-color: #ecfdf5;">Food Index (%)</th>
        <th colspan="3" class="center" style="background-color: #f0f9ff;">Frekuensi (Sesi)</th>
        <th rowspan="2" class="center" style="width: 80px;">Status</th>
      </tr>
      <tr>
        <th class="center" style="width: 32px;">W1</th>
        <th class="center" style="width: 32px;">W2</th>
        <th class="center" style="width: 32px;">W3</th>
        <th class="center" style="width: 32px;">W4</th>
        <th class="center" style="width: 36px; background-color: #f0fdf4;">Target</th>
        <th class="center" style="width: 36px; background-color: #f0fdf4;">Actual</th>
        <th class="center" style="width: 40px; background-color: #f0fdf4;">Capaian</th>
        <th class="center" style="width: 32px; background-color: #f8fafc;">Target</th>
        <th class="center" style="width: 32px; background-color: #f8fafc;">Actual</th>
        <th class="center" style="width: 40px; background-color: #f8fafc;">Capaian</th>
      </tr>
    </thead>
    <tbody>
      ${filteredMatrix.length === 0 ? '<tr><td colspan="15" class="center">Tidak ada data untuk filter yang dipilih</td></tr>' : ''}
      ${filteredMatrix.map(row => `
        <tr>
          <td class="center">${row.no}</td>
          <td><strong>${row.vendor_name}</strong> <span style="color: #64748b;">(${row.catering_name})</span></td>
          <td class="center">${row.site} - Tipe ${row.kitchen_type}</td>
          <td class="center">${row.w1 !== null ? row.w1 + '%' : '-'}</td>
          <td class="center">${row.w2 !== null ? row.w2 + '%' : '-'}</td>
          <td class="center">${row.w3 !== null ? row.w3 + '%' : '-'}</td>
          <td class="center">${row.w4 !== null ? row.w4 + '%' : '-'}</td>
          <td class="center">${row.targetScore}%</td>
          <td class="center" style="font-weight: 700; color: #0F5C56;">${row.avgScore !== '-' ? row.avgScore + '%' : '-'}</td>
          <td class="center" style="font-weight: 700;">${row.scoreAchievement !== '-' ? row.scoreAchievement + '%' : '-'}</td>
          <td class="center">${row.targetFreq}</td>
          <td class="center" style="font-weight: 700;">${row.actualFreq}</td>
          <td class="center" style="font-weight: 700;">${row.freqAchievement}%</td>
          <td class="center">
            <span class="badge ${row.status === 'Memenuhi Standar' ? 'badge-pass' : 'badge-warn'}">
              ${row.status}
            </span>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- SECTION 2: Detailing Riwayat Inspeksi & Catatan Temuan -->
  <div class="section-header">2. Detailing Riwayat Log & Temuan Lapangan</div>
  <table class="data-table">
    <thead>
      <tr>
        <th class="center" style="width: 25px;">No</th>
        <th style="width: 80px;">Tgl & Minggu</th>
        <th style="width: 140px;">Vendor & Lokasi</th>
        <th style="width: 85px;">Auditor GA</th>
        <th class="center" style="width: 60px;">Skor Poin</th>
        <th class="center" style="width: 65px;">Food Index</th>
        <th>Uraian Temuan / Ketidaksesuaian</th>
        <th>Rekomendasi Tindakan Perbaikan</th>
      </tr>
    </thead>
    <tbody>
      ${filteredScorings.length === 0 ? '<tr><td colspan="8" class="center">Tidak ada log inspeksi pada periode ini.</td></tr>' : ''}
      ${filteredScorings.map((sc, idx) => `
        <tr>
          <td class="center">${idx + 1}</td>
          <td>${sc.inspection_date}<br/><strong style="color: #0F5C56;">${sc.week} (${sc.month})</strong></td>
          <td><strong>${sc.vendor_name}</strong><br/><span style="color: #64748b;">${sc.site} (Tipe ${sc.kitchen_type})</span></td>
          <td>${sc.auditor_name}</td>
          <td class="center" style="font-family: monospace;">${sc.total_score} / ${sc.max_score}</td>
          <td class="center">
            <strong style="color: #0F5C56; font-size: 9.5px;">${sc.food_index_percent}%</strong><br/>
            <span class="badge ${sc.food_index_percent >= 85 ? 'badge-pass' : 'badge-warn'}">${sc.grade}</span>
          </td>
          <td>${sc.findings_notes || '<span style="color: #94a3b8; font-style: italic;">Tidak ada temuan minor</span>'}</td>
          <td>${sc.corrective_actions || '<span style="color: #94a3b8; font-style: italic;">Pertahankan standar</span>'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- SECTION 3: Lampiran Foto Dokumentasi Inspeksi (jika ada) -->
  ${filteredScorings.some(s => s.photos && s.photos.length > 0) ? `
    <div class="section-header" style="page-break-before: auto;">3. Lampiran Dokumentasi Foto Inspeksi</div>
    <div class="photo-grid">
      ${filteredScorings.flatMap(s => (s.photos || []).map(p => `
        <div class="photo-card">
          <img src="${p.data || p.url}" class="photo-img" alt="Foto Inspeksi" />
          <div class="photo-desc">
            <strong>${s.vendor_name} (${s.week})</strong><br/>
            ${p.caption || p.name || 'Dokumentasi sanitasi dapur'}
          </div>
        </div>
      `)).join('')}
    </div>
  ` : ''}

  <!-- Lembar Tanda Tangan -->
  <table class="sign-table">
    <tr>
      <td>
        <div class="sign-title">Disiapkan Oleh (Auditor GA):</div>
        <div class="sign-name">Fauzan / Fikri</div>
        <div class="sign-role">General Affairs Officer</div>
      </td>
      <td>
        <div class="sign-title">Diperiksa Oleh:</div>
        <div class="sign-name">Ahmad Subagyo</div>
        <div class="sign-role">GA Section Head</div>
      </td>
      <td>
        <div class="sign-title">Disetujui Oleh:</div>
        <div class="sign-name">Budi Santoso</div>
        <div class="sign-role">HCGA Department Head</div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
