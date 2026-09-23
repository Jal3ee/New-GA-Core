import { LOGO_AGM_BASE64, LOGO_HCGA_BASE64 } from '../assets/logos/logosBase64';

/**
 * Utility to format currency into Rupiah
 */
export const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(number || 0);
};

/**
 * Generate Printable Corporate PDF for BHP Mess Forecast & Ordering Recommendation
 */
export function generateBhpForecastPdfReport({
  forecastData = [],
  periodCycle = 'September 2026 (W3)',
  siteScope = 'Konsolidasi (LBCT, IDMG, SPCT)',
  createdByName = 'GA Admin',
  approvedByName = 'GA GL',
  summaryMetrics = {}
}) {
  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) {
    alert('Pop-up terblokir oleh browser. Silakan izinkan pop-up untuk mengunduh/mencetak dokumen PDF.');
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

  const totalItems = forecastData.length;
  const totalRecommendedPcs = forecastData.reduce((acc, curr) => acc + (curr.recommended_qty_pcs || 0), 0);
  const totalRecommendedPacks = forecastData.reduce((acc, curr) => acc + (curr.recommended_packs || 0), 0);
  const totalEstimatedCost = forecastData.reduce((acc, curr) => acc + ((curr.recommended_qty_pcs || 0) * (curr.price_est || 0)), 0);

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekap Forecast & Rekomendasi Pemesanan BHP Mess - ${periodCycle}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      font-size: 11px;
      line-height: 1.35;
      padding: 10px;
    }
    .header-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #0f766e;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .logo-img {
      height: 48px;
      object-fit: contain;
    }
    .company-title {
      text-align: center;
      flex-grow: 1;
      padding: 0 16px;
    }
    .company-title h1 {
      font-size: 15px;
      font-weight: 800;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .company-title h2 {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 1px;
    }
    .company-title p {
      font-size: 9.5px;
      color: #64748b;
      font-style: italic;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr 1fr;
      gap: 8px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
    }
    .meta-item {
      font-size: 10.5px;
    }
    .meta-item strong {
      color: #334155;
    }
    .kpi-row {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    .kpi-card {
      flex: 1;
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      border-radius: 6px;
      padding: 6px 10px;
      text-align: center;
    }
    .kpi-card .val {
      font-size: 13px;
      font-weight: 800;
      color: #0f766e;
      font-family: monospace;
    }
    .kpi-card .lbl {
      font-size: 9px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 9.5px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 4px 6px;
      vertical-align: middle;
    }
    table.data-table th {
      background-color: #0f766e;
      color: #ffffff;
      font-weight: 700;
      text-align: center;
      font-size: 9.5px;
      letter-spacing: 0.2px;
    }
    table.data-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-mono { font-family: monospace; }
    .font-bold { font-weight: 700; }
    .badge-abc {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 3px;
      font-weight: bold;
      font-size: 8.5px;
    }
    .badge-a { background: #fee2e2; color: #991b1b; }
    .badge-b { background: #fef3c7; color: #92400e; }
    .badge-c { background: #e0f2fe; color: #075985; }
    
    .signature-container {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
      page-break-inside: avoid;
    }
    .sig-box {
      width: 42%;
      text-align: center;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      background: #fafafa;
    }
    .sig-role {
      font-weight: 700;
      color: #0f766e;
      font-size: 10.5px;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
    .sig-dept {
      font-size: 9px;
      color: #64748b;
      margin-bottom: 45px;
    }
    .sig-name {
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
      text-decoration: underline;
    }
    .sig-status {
      font-size: 8.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .footer-note {
      margin-top: 10px;
      font-size: 8.5px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      border-top: 1px dashed #cbd5e1;
      padding-top: 5px;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- HEADER -->
  <div class="header-container">
    <img src="${LOGO_AGM_BASE64}" class="logo-img" alt="AGM Logo" />
    <div class="company-title">
      <h1>PT. Antang Gunung Meratus</h1>
      <h2>Rekapitulasi & Rekomendasi Pemesanan BHP Mess</h2>
      <p>General Affairs Department • Dokumen Resmi Pengajuan Kebutuhan Barang Habis Pakai</p>
    </div>
    <img src="${LOGO_HCGA_BASE64}" class="logo-img" alt="HCGA Logo" />
  </div>

  <!-- METADATA -->
  <div class="meta-grid">
    <div class="meta-item">
      <div><strong>Siklus & Periode:</strong> ${periodCycle} (Horizon 28 Hari)</div>
      <div><strong>Cakupan Lokasi:</strong> ${siteScope}</div>
    </div>
    <div class="meta-item">
      <div><strong>Waktu Penutupan:</strong> Awal Minggu ke-3 (W3)</div>
      <div><strong>Status Dokumen:</strong> Rekap Final untuk Pengajuan Manual PO</div>
    </div>
    <div class="meta-item">
      <div><strong>Tanggal Cetak:</strong> ${printDateStr}</div>
      <div><strong>Waktu Cetak:</strong> ${printTimeStr}</div>
    </div>
  </div>

  <!-- KPI SUMMARY -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="val">${totalItems} Item</div>
      <div class="lbl">Total SKU Terdaftar</div>
    </div>
    <div class="kpi-card">
      <div class="val font-mono">${totalRecommendedPcs.toLocaleString('id-ID')} Pcs</div>
      <div class="lbl">Total Rekomendasi (Pcs)</div>
    </div>
    <div class="kpi-card">
      <div class="val font-mono">${totalRecommendedPacks.toLocaleString('id-ID')} Pack/Dus</div>
      <div class="lbl">Total Rekomendasi (Pack)</div>
    </div>
    <div class="kpi-card">
      <div class="val font-mono">${formatRupiah(totalEstimatedCost)}</div>
      <div class="lbl">Estimasi Anggaran Pengadaan</div>
    </div>
  </div>

  <!-- DATA TABLE -->
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25px;">No</th>
        <th style="width: 75px;">Kode Item</th>
        <th>Nama Barang Habis Pakai (BHP)</th>
        <th style="width: 80px;">Kategori</th>
        <th style="width: 40px;">Satuan</th>
        <th style="width: 50px;">Isi/Pack</th>
        <th style="width: 35px;">ABC</th>
        <th style="width: 55px;">Avg Pakai/Hari</th>
        <th style="width: 60px;">Horizon Demand (28h)</th>
        <th style="width: 55px;">Safety Stock</th>
        <th style="width: 55px;">Stok Proyeksi Sisa</th>
        <th style="width: 65px; background-color: #0d9488;">Rekomendasi (Pcs)</th>
        <th style="width: 65px; background-color: #0f766e;">Rekomendasi (Pack)</th>
        <th style="width: 90px;">Catatan / Flag</th>
      </tr>
    </thead>
    <tbody>
      ${forecastData.map((row, idx) => {
        const abcClass = row.abc_class || 'B';
        const abcBadgeClass = abcClass === 'A' ? 'badge-a' : abcClass === 'C' ? 'badge-c' : 'badge-b';
        return `
          <tr>
            <td class="text-center font-mono">${idx + 1}</td>
            <td class="text-center font-mono font-bold">${row.code || row.item_id}</td>
            <td><strong>${row.name}</strong></td>
            <td>${row.category || '-'}</td>
            <td class="text-center">${row.unit || 'pcs'}</td>
            <td class="text-center font-mono">${row.pack_qty || 1} ${row.unit}</td>
            <td class="text-center"><span class="badge-abc ${abcBadgeClass}">${abcClass}</span></td>
            <td class="text-right font-mono">${Number(row.avg_daily_usage || 0).toFixed(1)}</td>
            <td class="text-right font-mono">${Math.round(row.period_demand || 0)}</td>
            <td class="text-right font-mono">+${Math.round(row.safety_stock || 0)} (${row.safety_pct || 5}%)</td>
            <td class="text-right font-mono text-muted">${Math.round(row.projected_stock || 0)}</td>
            <td class="text-right font-mono font-bold" style="color: #0f766e; background: #f0fdf4;">${row.recommended_qty_pcs || 0}</td>
            <td class="text-right font-mono font-bold" style="color: #0f766e; background: #ccfbf1;">${row.recommended_packs || 0} ${row.pack_unit || 'pack'}</td>
            <td style="font-size: 8.5px; color: ${row.variance_flag ? '#b91c1c' : '#475569'};">
              ${row.variance_flag ? '⚠️ Variasi tinggi' : (row.notes || 'Normal')}
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <!-- SIGNATURES -->
  <div class="signature-container">
    <div class="sig-box">
      <div class="sig-role">Dibuat Oleh:</div>
      <div class="sig-dept">General Affairs Administrator</div>
      <div class="sig-name">${createdByName}</div>
      <div class="sig-status">Disiapkan pada: ${printDateStr}</div>
    </div>

    <div class="sig-box">
      <div class="sig-role">Disetujui Oleh:</div>
      <div class="sig-dept">General Affairs Group Leader (GA GL)</div>
      <div class="sig-name">${approvedByName}</div>
      <div class="sig-status">Disetujui untuk Lampiran Pemesanan PO Manual</div>
    </div>
  </div>

  <!-- FOOTER NOTE -->
  <div class="footer-note">
    <span>Sistem Manajemen BHP Mess GA Core — PT. Antang Gunung Meratus</span>
    <span>Dokumen ini sah sebagai lampiran pendukung pengajuan pemesanan & pembuatan PO di luar sistem</span>
    <span>Hal. 1 / 1</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Generate Printable Corporate PDF for BHP Forecast Accuracy & Evaluation
 */
export function generateBhpEvaluationPdfReport({
  evaluationData = [],
  periodCycle = 'Agustus 2026',
  siteScope = 'Konsolidasi (LBCT, IDMG, SPCT)',
  createdByName = 'GA Admin',
  approvedByName = 'GA GL'
}) {
  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) {
    alert('Pop-up terblokir oleh browser. Silakan izinkan pop-up untuk mengunduh/mencetak dokumen PDF.');
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

  const totalEvaluated = evaluationData.length;
  const avgError = totalEvaluated > 0
    ? (evaluationData.reduce((acc, curr) => acc + Math.abs(curr.diff_pct || 0), 0) / totalEvaluated).toFixed(1)
    : 0;

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekapitulasi Evaluasi & Akurasi Forecast BHP Mess - ${periodCycle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1e293b;
      font-size: 11px;
      line-height: 1.4;
      padding: 10px;
    }
    .header-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .logo-img { height: 45px; object-fit: contain; }
    .company-title { text-align: center; flex-grow: 1; }
    .company-title h1 { font-size: 14px; font-weight: 800; color: #0f766e; text-transform: uppercase; }
    .company-title h2 { font-size: 11.5px; font-weight: 700; color: #1e293b; }
    .meta-box {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 8px 12px; margin-bottom: 12px; font-size: 10.5px;
      display: flex; justify-content: space-between;
    }
    table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; }
    table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 5px 8px; }
    table.data-table th { background: #0f766e; color: #fff; text-align: center; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: monospace; }
    .sig-container { display: flex; justify-content: space-between; margin-top: 25px; }
    .sig-box { width: 44%; text-align: center; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; }
    .sig-name { font-size: 11px; font-weight: 800; text-decoration: underline; margin-top: 50px; }
  </style>
</head>
<body>
  <div class="header-container">
    <img src="${LOGO_AGM_BASE64}" class="logo-img" alt="AGM Logo" />
    <div class="company-title">
      <h1>PT. Antang Gunung Meratus</h1>
      <h2>Rekapitulasi Evaluasi & Akurasi Forecast BHP Mess</h2>
      <p style="font-size: 9px; color: #64748b;">Perbandingan Forecast vs Pemakaian Aktual Siklus ${periodCycle}</p>
    </div>
    <img src="${LOGO_HCGA_BASE64}" class="logo-img" alt="HCGA Logo" />
  </div>

  <div class="meta-box">
    <div>
      <div><strong>Siklus Evaluasi:</strong> ${periodCycle}</div>
      <div><strong>Cakupan Site:</strong> ${siteScope}</div>
    </div>
    <div style="text-align: right;">
      <div><strong>Rata-rata Deviasi Error:</strong> <span class="font-mono font-bold" style="color: #0f766e;">${avgError}%</span></div>
      <div><strong>Tanggal Cetak:</strong> ${printDateStr} (${printTimeStr})</div>
    </div>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 30px;">No</th>
        <th>Nama Item</th>
        <th style="width: 70px;">Site</th>
        <th style="width: 75px;">Forecast (Pcs)</th>
        <th style="width: 75px;">Actual (Pcs)</th>
        <th style="width: 70px;">Selisih</th>
        <th style="width: 65px;">Error (%)</th>
        <th style="width: 110px;">Arah Bias</th>
        <th>Catatan Evaluasi</th>
      </tr>
    </thead>
    <tbody>
      ${evaluationData.map((row, idx) => `
        <tr>
          <td class="text-center font-mono">${idx + 1}</td>
          <td><strong>${row.name || row.item_id}</strong></td>
          <td class="text-center font-mono">${row.site}</td>
          <td class="text-right font-mono">${row.forecast_qty}</td>
          <td class="text-right font-mono font-bold">${row.actual_qty}</td>
          <td class="text-right font-mono" style="color: ${row.diff_qty > 0 ? '#b91c1c' : '#047857'};">
            ${row.diff_qty > 0 ? `+${row.diff_qty}` : row.diff_qty}
          </td>
          <td class="text-right font-mono font-bold">${Number(row.diff_pct).toFixed(1)}%</td>
          <td class="text-center" style="font-size: 9px;">${row.bias}</td>
          <td style="font-size: 9px; color: #475569;">${row.notes || '-'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="sig-container">
    <div class="sig-box">
      <div style="font-weight: 700; color: #0f766e; text-transform: uppercase;">Dibuat Oleh:</div>
      <div style="font-size: 9px; color: #64748b;">General Affairs Administrator</div>
      <div class="sig-name">${createdByName}</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 3px;">Tanggal: ${printDateStr}</div>
    </div>
    <div class="sig-box">
      <div style="font-weight: 700; color: #0f766e; text-transform: uppercase;">Disetujui Oleh:</div>
      <div style="font-size: 9px; color: #64748b;">General Affairs Group Leader (GA GL)</div>
      <div class="sig-name">${approvedByName}</div>
      <div style="font-size: 8.5px; color: #64748b; margin-top: 3px;">Persetujuan Hasil Evaluasi Siklus</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
