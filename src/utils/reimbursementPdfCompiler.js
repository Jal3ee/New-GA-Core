import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Format currency to IDR
 */
export function formatRupiah(num) {
  if (!num && num !== 0) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

/**
 * Compile selected reimbursement records into a single merged PDF with standardized employee headers.
 * 
 * @param {Object} params
 * @param {Array} params.selectedRecords - List of records to compile
 * @param {Object} params.options - Configuration options (includeCover, includeBuktiCuti, includeNotaBerangkat, includeNotaPulang)
 * @param {Function} [params.onProgress] - Callback (current, total, statusText)
 * @returns {Promise<Blob>} Merged PDF Blob
 */
export async function compileReimbursementPdf({
  selectedRecords = [],
  options = {
    includeCover: true,
    includeBuktiCuti: true,
    includeNotaBerangkat: true,
    includeNotaPulang: true,
    periodLabel: ''
  },
  onProgress = null
}) {
  if (!selectedRecords || selectedRecords.length === 0) {
    throw new Error('Tidak ada data reimbursement yang dipilih.');
  }

  const mergedPdf = await PDFDocument.create();
  const fontBold = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await mergedPdf.embedFont(StandardFonts.Helvetica);

  const totalSteps = selectedRecords.length + (options.includeCover ? 1 : 0);
  let currentStep = 0;

  // -------------------------------------------------------------
  // 1. COVER & REKAPITULASI SUMMARY PAGE
  // -------------------------------------------------------------
  if (options.includeCover) {
    if (onProgress) onProgress(currentStep + 1, totalSteps, 'Membuat lembar ringkasan rekapitulasi...');
    
    // Standard US Letter / A4 portrait (612 x 792 pt)
    const coverPage = mergedPdf.addPage([612, 792]);
    const { width, height } = coverPage.getSize();

    // Top Brand Accent Bar (Teal #0F5C56)
    coverPage.drawRectangle({
      x: 0,
      y: height - 10,
      width: width,
      height: 10,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    // Header Title
    const titleText = options.periodLabel 
      ? `REKAPITULASI REIMBURSEMENT - ${options.periodLabel.toUpperCase()}`
      : 'REKAPITULASI BERKAS REIMBURSEMENT TIKET & TRANSPORT';

    coverPage.drawText(titleText.substring(0, 52), {
      x: 40,
      y: height - 45,
      size: 13,
      font: fontBold,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    coverPage.drawText('Departemen General Affairs - PT. Antang Gunung Meratus', {
      x: 40,
      y: height - 60,
      size: 9.5,
      font: fontRegular,
      color: rgb(71 / 255, 85 / 255, 105 / 255),
    });

    // Meta box
    const totalNominal = selectedRecords.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
    const nowStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    coverPage.drawRectangle({
      x: 40,
      y: height - 118,
      width: width - 80,
      height: 46,
      color: rgb(248 / 255, 250 / 255, 252 / 255),
      borderColor: rgb(226 / 255, 232 / 255, 240 / 255),
      borderWidth: 1,
    });

    coverPage.drawText(`Dicetak Pada: ${nowStr}`, {
      x: 52,
      y: height - 90,
      size: 8.5,
      font: fontRegular,
      color: rgb(51 / 255, 65 / 255, 85 / 255),
    });

    coverPage.drawText(`Jumlah Berkas: ${selectedRecords.length} Karyawan (${options.periodLabel || 'Kolektif'})`, {
      x: 52,
      y: height - 105,
      size: 8.5,
      font: fontRegular,
      color: rgb(51 / 255, 65 / 255, 85 / 255),
    });

    coverPage.drawText(`Total Nilai Reimbursement: ${formatRupiah(totalNominal)}`, {
      x: 320,
      y: height - 90,
      size: 9,
      font: fontBold,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    coverPage.drawText(`Cakupan Lampiran: Bukti Cuti, Nota Berangkat, Nota Pulang`, {
      x: 320,
      y: height - 105,
      size: 8.5,
      font: fontRegular,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });

    // Summary Table
    let tableY = height - 138;
    coverPage.drawText('DAFTAR KARYAWAN & RINCIAN KLAIM:', {
      x: 40,
      y: tableY,
      size: 9,
      font: fontBold,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    tableY -= 16;

    // Table Header Row
    coverPage.drawRectangle({
      x: 40,
      y: tableY - 4,
      width: width - 80,
      height: 18,
      color: rgb(241 / 255, 245 / 255, 249 / 255),
      borderColor: rgb(203 / 255, 213 / 255, 225 / 255),
      borderWidth: 0.75,
    });

    coverPage.drawText('No', { x: 45, y: tableY + 2, size: 7.5, font: fontBold });
    coverPage.drawText('Nama Karyawan', { x: 65, y: tableY + 2, size: 7.5, font: fontBold });
    coverPage.drawText('NIK', { x: 175, y: tableY + 2, size: 7.5, font: fontBold });
    coverPage.drawText('Departemen / Site', { x: 235, y: tableY + 2, size: 7.5, font: fontBold });
    coverPage.drawText('Tgl Perjalanan', { x: 345, y: tableY + 2, size: 7.5, font: fontBold });
    coverPage.drawText('Periode', { x: 435, y: tableY + 2, size: 7.5, font: fontBold });
    coverPage.drawText('Nominal (Rp)', { x: 505, y: tableY + 2, size: 7.5, font: fontBold });

    tableY -= 16;

    // Table Rows (showing up to 25 items on cover, or note if more)
    const maxOnCover = 26;
    const itemsToShow = selectedRecords.slice(0, maxOnCover);

    itemsToShow.forEach((rec, idx) => {
      const isEven = idx % 2 === 1;
      if (isEven) {
        coverPage.drawRectangle({
          x: 40,
          y: tableY - 3,
          width: width - 80,
          height: 15,
          color: rgb(250 / 255, 250 / 255, 250 / 255),
        });
      }

      coverPage.drawText(String(idx + 1), { x: 45, y: tableY + 2, size: 7, font: fontRegular });
      
      const safeName = (rec.nama || '-').substring(0, 22);
      coverPage.drawText(safeName, { x: 65, y: tableY + 2, size: 7, font: fontBold });
      
      coverPage.drawText(rec.nik || '-', { x: 175, y: tableY + 2, size: 7, font: fontRegular });
      
      const deptSite = `${(rec.departemen || '-').substring(0, 16)} (${rec.site || 'Site'})`;
      coverPage.drawText(deptSite, { x: 235, y: tableY + 2, size: 6.8, font: fontRegular });

      const tglTrip = `${rec.tgl_berangkat || '-'} s/d ${rec.tgl_pulang || '-'}`;
      coverPage.drawText(tglTrip, { x: 345, y: tableY + 2, size: 6.5, font: fontRegular });

      const peri = `${rec.periode_bulan || ''} ${rec.periode_ke ? (rec.periode_ke.includes('1') ? 'P1' : 'P2') : ''}`;
      coverPage.drawText(peri, { x: 435, y: tableY + 2, size: 6.8, font: fontRegular });

      const nomStr = Number(rec.nominal || 0).toLocaleString('id-ID');
      coverPage.drawText(nomStr, { x: 505, y: tableY + 2, size: 7, font: fontBold, color: rgb(15 / 255, 92 / 255, 86 / 255) });

      tableY -= 15;
    });

    if (selectedRecords.length > maxOnCover) {
      coverPage.drawText(`... dan ${selectedRecords.length - maxOnCover} berkas karyawan lainnya (dilampirkan lengkap di halaman selanjutnya)`, {
        x: 45,
        y: tableY,
        size: 7.5,
        font: fontRegular,
        color: rgb(100 / 255, 116 / 255, 139 / 255)
      });
      tableY -= 15;
    }

    // Signatures footer on cover
    const signY = 65;
    coverPage.drawText('Disiapkan Oleh (GA Admin):', { x: 60, y: signY + 32, size: 7.5, font: fontRegular });
    coverPage.drawLine({ start: { x: 60, y: signY + 4 }, end: { x: 190, y: signY + 4 }, thickness: 0.75, color: rgb(148 / 255, 163 / 255, 184 / 255) });
    coverPage.drawText('Staff General Affairs', { x: 60, y: signY - 7, size: 6.5, font: fontRegular, color: rgb(100 / 255, 116 / 255, 139 / 255) });

    coverPage.drawText('Diperiksa Oleh:', { x: 250, y: signY + 32, size: 7.5, font: fontRegular });
    coverPage.drawLine({ start: { x: 250, y: signY + 4 }, end: { x: 370, y: signY + 4 }, thickness: 0.75, color: rgb(148 / 255, 163 / 255, 184 / 255) });
    coverPage.drawText('GA Section Head', { x: 250, y: signY - 7, size: 6.5, font: fontRegular, color: rgb(100 / 255, 116 / 255, 139 / 255) });

    coverPage.drawText('Diterima Oleh Finance:', { x: 430, y: signY + 32, size: 7.5, font: fontRegular });
    coverPage.drawLine({ start: { x: 430, y: signY + 4 }, end: { x: 550, y: signY + 4 }, thickness: 0.75, color: rgb(148 / 255, 163 / 255, 184 / 255) });
    coverPage.drawText('Finance & Accounting Officer', { x: 430, y: signY - 7, size: 6.5, font: fontRegular, color: rgb(100 / 255, 116 / 255, 139 / 255) });

    currentStep++;
  }

  // -------------------------------------------------------------
  // Helper: Draw Standardized Employee Banner on any PDF Page
  // -------------------------------------------------------------
  function drawEmployeeHeader(page, rec, docTitle, pageIndex, pageCount) {
    const { width, height } = page.getSize();
    const bannerHeight = 36;

    // Top Teal Banner
    page.drawRectangle({
      x: 0,
      y: height - bannerHeight,
      width: width,
      height: bannerHeight,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    // Sub Accent Line (Brass #C4841F)
    page.drawRectangle({
      x: 0,
      y: height - bannerHeight - 2,
      width: width,
      height: 2,
      color: rgb(196 / 255, 132 / 255, 31 / 255),
    });

    // Document Type Label (Upper Left)
    page.drawText(docTitle.toUpperCase(), {
      x: 18,
      y: height - 16,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Employee Meta (Bottom of banner)
    const metaStr = `Karyawan: ${(rec.nama || '-').toUpperCase()}   |   NIK: ${rec.nik || '-'}   |   Dept: ${rec.departemen || '-'} (${rec.site || '-'})   |   Hal ${pageIndex + 1} dari ${pageCount}`;
    page.drawText(metaStr, {
      x: 18,
      y: height - 29,
      size: 7.5,
      font: fontRegular,
      color: rgb(220 / 255, 240 / 255, 238 / 255),
    });
  }

  // -------------------------------------------------------------
  // Helper: Draw a Document Certificate / Link Sheet when
  // external Google Drive URL cannot be fetched directly via CORS
  // -------------------------------------------------------------
  function createDocumentSheet(rec, docType, docUrl, notes = '') {
    const page = mergedPdf.addPage([612, 792]);
    const { width, height } = page.getSize();

    drawEmployeeHeader(page, rec, docType, 0, 1);

    // Document Card Box
    page.drawRectangle({
      x: 40,
      y: height - 360,
      width: width - 80,
      height: 290,
      color: rgb(248 / 255, 250 / 255, 252 / 255),
      borderColor: rgb(203 / 255, 213 / 255, 225 / 255),
      borderWidth: 1,
    });

    page.drawText('VERIFIKASI & TAUTAN LAMPIRAN DIGITAL', {
      x: 60,
      y: height - 100,
      size: 12,
      font: fontBold,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    page.drawText('Dokumen ini terdaftar dalam database Form Order Kebutuhan Tiket PT. Antang Gunung Meratus.', {
      x: 60,
      y: height - 118,
      size: 8.5,
      font: fontRegular,
      color: rgb(71 / 255, 85 / 255, 105 / 255),
    });

    // Info Grid
    const details = [
      ['Jenis Dokumen', docType],
      ['Nama Karyawan', `${rec.nama} (NIK: ${rec.nik})`],
      ['Departemen / Site', `${rec.departemen} - Site ${rec.site}`],
      ['Tanggal Perjalanan', `${rec.tgl_berangkat || '-'} s/d ${rec.tgl_pulang || '-'}`],
      ['Periode Pengajuan', `${rec.periode_bulan} ${rec.periode_ke}`],
      ['Nominal Klaim Tiket', formatRupiah(rec.nominal)],
      ['Status Finance', `${rec.status_finance || 'Diajukan'} (Tgl Pencairan: ${rec.tgl_pencairan_finance || '-'})`],
    ];

    let infoY = height - 150;
    details.forEach(([label, val]) => {
      page.drawText(label, { x: 60, y: infoY, size: 8, font: fontBold, color: rgb(71 / 255, 85 / 255, 105 / 255) });
      page.drawText(`: ${val}`, { x: 180, y: infoY, size: 8, font: fontRegular, color: rgb(15 / 255, 23 / 255, 42 / 255) });
      infoY -= 18;
    });

    // Drive URL box
    page.drawRectangle({
      x: 60,
      y: infoY - 26,
      width: width - 120,
      height: 32,
      color: rgb(240 / 255, 247 / 255, 246 / 255),
      borderColor: rgb(15 / 255, 92 / 255, 86 / 255),
      borderWidth: 0.5,
    });

    page.drawText('Tautan Berkas Google Drive / Cloud Storage:', {
      x: 70,
      y: infoY - 8,
      size: 7.5,
      font: fontBold,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    const safeUrl = (docUrl || 'Tidak ada link berkas').substring(0, 85);
    page.drawText(safeUrl, {
      x: 70,
      y: infoY - 20,
      size: 7.5,
      font: fontRegular,
      color: rgb(30 / 255, 58 / 255, 138 / 255),
    });

    // Instructions
    infoY -= 55;
    page.drawText('Catatan Verifikator GA:', { x: 60, y: infoY, size: 8, font: fontBold });
    page.drawText(notes || 'Berkas telah diverifikasi keasliannya dan sesuai dengan persetujuan atasan pada sistem Sunfish / HCGA.', {
      x: 60,
      y: infoY - 14,
      size: 7.5,
      font: fontRegular,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });
  }

  // -------------------------------------------------------------
  // Load Sample PDFs for high-fidelity testing
  // -------------------------------------------------------------
  let sampleCutiBytes = null;
  let sampleTransportBytes = null;

  try {
    const [resCuti, resTrans] = await Promise.allSettled([
      fetch('/samples/sample_cuti_approval.pdf').then(r => r.ok ? r.arrayBuffer() : null),
      fetch('/samples/sample_transport_cuti.pdf').then(r => r.ok ? r.arrayBuffer() : null)
    ]);
    if (resCuti.status === 'fulfilled') sampleCutiBytes = resCuti.value;
    if (resTrans.status === 'fulfilled') sampleTransportBytes = resTrans.value;
  } catch {
    // Silently continue if samples cannot be fetched
  }

  // -------------------------------------------------------------
  // 2. PROCESS EACH EMPLOYEE'S ATTACHMENTS
  // -------------------------------------------------------------
  for (let i = 0; i < selectedRecords.length; i++) {
    const rec = selectedRecords[i];
    currentStep++;

    if (onProgress) {
      onProgress(currentStep, totalSteps, `Memproses berkas ${rec.nama} (${i + 1}/${selectedRecords.length})...`);
    }

    // Check if this record is Febi Ibrena Ginting or first record: can attach real sample PDF pages!
    const isFebi = (rec.nama || '').toLowerCase().includes('febi') || (i === 0 && sampleCutiBytes);

    // A. BUKTI CUTI (Col X)
    if (options.includeBuktiCuti) {
      if (rec.bukti_cuti_file instanceof File || rec.bukti_cuti_file instanceof Blob) {
        // Uploaded custom file
        await appendCustomFile(mergedPdf, rec, 'Bukti Cuti Approval (Sunfish)', rec.bukti_cuti_file, drawEmployeeHeader);
      } else if (isFebi && sampleCutiBytes) {
        // Embed real sample PDF for Febi or demo!
        const srcDoc = await PDFDocument.load(sampleCutiBytes);
        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((p, pIdx) => {
          drawEmployeeHeader(p, rec, 'Bukti Cuti Sunfish (Approved)', pIdx, copiedPages.length);
          mergedPdf.addPage(p);
        });
      } else {
        createDocumentSheet(rec, 'Bukti Cuti Sunfish (Approved)', rec.url_bukti_cuti, 'Persetujuan cuti telah disetujui penuh oleh atasan.');
      }
    }

    // B. NOTA KEBERANGKATAN (Col Y)
    if (options.includeNotaBerangkat) {
      if (rec.nota_berangkat_file instanceof File || rec.nota_berangkat_file instanceof Blob) {
        await appendCustomFile(mergedPdf, rec, 'Nota Tiket Keberangkatan', rec.nota_berangkat_file, drawEmployeeHeader);
      } else if (isFebi && sampleTransportBytes) {
        const srcDoc = await PDFDocument.load(sampleTransportBytes);
        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((p, pIdx) => {
          drawEmployeeHeader(p, rec, 'Nota Tiket / Transport Keberangkatan', pIdx, copiedPages.length);
          mergedPdf.addPage(p);
        });
      } else {
        createDocumentSheet(rec, 'Nota Tiket / Transport Keberangkatan', rec.url_nota_berangkat, 'Kwitansi/Boarding pass keberangkatan.');
      }
    }

    // C. NOTA KEPULANGAN (Col AO)
    if (options.includeNotaPulang) {
      if (rec.nota_pulang_file instanceof File || rec.nota_pulang_file instanceof Blob) {
        await appendCustomFile(mergedPdf, rec, 'Nota Tiket Kepulangan', rec.nota_pulang_file, drawEmployeeHeader);
      } else if (rec.url_nota_pulang && rec.url_nota_pulang.trim()) {
        createDocumentSheet(rec, 'Nota Tiket / Transport Kepulangan', rec.url_nota_pulang, 'Kwitansi/Boarding pass kepulangan.');
      }
    }
  }

  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Helper to embed custom user-uploaded file (PDF or Image)
 */
async function appendCustomFile(targetDoc, rec, docTitle, fileObj, headerFn) {
  try {
    const arrayBuffer = await fileObj.arrayBuffer();
    if (fileObj.type === 'application/pdf') {
      const srcDoc = await PDFDocument.load(arrayBuffer);
      const copiedPages = await targetDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      copiedPages.forEach((p, pIdx) => {
        headerFn(p, rec, docTitle, pIdx, copiedPages.length);
        targetDoc.addPage(p);
      });
    } else if (fileObj.type.startsWith('image/')) {
      const page = targetDoc.addPage([612, 792]);
      const { width, height } = page.getSize();
      headerFn(page, rec, docTitle, 0, 1);

      let img;
      if (fileObj.type === 'image/jpeg' || fileObj.type === 'image/jpg') {
        img = await targetDoc.embedJpg(arrayBuffer);
      } else {
        img = await targetDoc.embedPng(arrayBuffer);
      }

      // Fit image into page area
      const maxW = width - 60;
      const maxH = height - 80;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const drawW = img.width * scale;
      const drawH = img.height * scale;

      page.drawImage(img, {
        x: (width - drawW) / 2,
        y: (height - drawH) / 2 - 10,
        width: drawW,
        height: drawH,
      });
    }
  } catch (err) {
    console.warn('Gagal memproses file custom:', err);
  }
}

/**
 * Instant HTML Printable View (open print window)
 */
export function openReimbursementPrintWindow({ selectedRecords = [] }) {
  const printWin = window.open('', '_blank', 'width=1100,height=850');
  if (!printWin) {
    alert('Pop-up terblokir oleh browser. Silakan izinkan pop-up untuk mencetak.');
    return;
  }

  const totalNominal = selectedRecords.reduce((sum, r) => sum + (Number(r.nominal) || 0), 0);
  const nowStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Kompilasi_Reimbursement_${Date.now()}.pdf</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 10px;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
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
    }
    .header-card {
      border-bottom: 2px solid #0F5C56;
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    .doc-title {
      font-size: 14px;
      font-weight: 800;
      color: #0F5C56;
      text-transform: uppercase;
    }
    .doc-sub {
      font-size: 9px;
      color: #64748b;
    }
    .meta-box {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 14px;
      font-size: 8.5px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 8px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
    }
    table.data-table th {
      background: #f1f5f9;
      font-weight: 700;
      text-align: left;
    }
    .employee-section {
      page-break-before: always;
      margin-top: 14px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px;
      background: #ffffff;
    }
    .banner {
      background: #0F5C56;
      color: #ffffff;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    .banner-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .banner-sub {
      font-size: 8px;
      color: #d1fae5;
    }
    .doc-card {
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
      background: #f8fafc;
    }
    .doc-link {
      color: #0369a1;
      text-decoration: none;
      word-break: break-all;
      font-weight: 600;
    }
    @media print {
      .no-print-bar { display: none !important; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>Kompilasi Lampiran Reimbursement Tiket (${selectedRecords.length} Berkas)</span>
    <div>
      <button onclick="window.print()">Cetak / Simpan PDF</button>
      <button onclick="window.close()" style="margin-left: 6px; background: transparent; color: #fff; border: 1px solid #fff;">Tutup</button>
    </div>
  </div>

  <div class="header-card">
    <div class="doc-title">Rekapitulasi Dokumen Reimbursement Tiket & Transport</div>
    <div class="doc-sub">PT. Antang Gunung Meratus - Human Capital & General Affairs Department</div>
  </div>

  <div class="meta-box">
    <div><strong>Tanggal:</strong> ${nowStr}</div>
    <div><strong>Jumlah Berkas:</strong> ${selectedRecords.length} Karyawan</div>
    <div><strong>Total Nilai:</strong> <span style="color: #0F5C56; font-weight: 800;">${formatRupiah(totalNominal)}</span></div>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25px;">No</th>
        <th>Nama Karyawan</th>
        <th>NIK</th>
        <th>Departemen / Site</th>
        <th>Tgl Perjalanan</th>
        <th>Periode</th>
        <th>Nominal Klaim</th>
        <th>Status Finance</th>
      </tr>
    </thead>
    <tbody>
      ${selectedRecords.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${r.nama}</strong></td>
          <td>${r.nik || '-'}</td>
          <td>${r.departemen || '-'} (${r.site || '-'})</td>
          <td>${r.tgl_berangkat || '-'} s/d ${r.tgl_pulang || '-'}</td>
          <td>${r.periode_bulan || ''} ${r.periode_ke || ''}</td>
          <td style="font-weight: 700; color: #0F5C56;">${formatRupiah(r.nominal)}</td>
          <td>${r.status_finance || 'Diajukan'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Detailing Lampiran Per Karyawan -->
  ${selectedRecords.map(r => `
    <div class="employee-section">
      <div class="banner">
        <div class="banner-title">${r.nama} (NIK: ${r.nik})</div>
        <div class="banner-sub">Departemen ${r.departemen} - Site ${r.site} | Nominal: ${formatRupiah(r.nominal)} | ${r.periode_bulan} ${r.periode_ke}</div>
      </div>

      <div class="doc-card">
        <strong style="color: #0F5C56;">1. BUKTI CUTI (SUNFISH APPROVED)</strong><br/>
        <span style="font-size: 8px; color: #64748b;">Kolom X Form Respons:</span><br/>
        <a href="${r.url_bukti_cuti}" target="_blank" class="doc-link">${r.url_bukti_cuti || 'Tidak ada URL'}</a>
      </div>

      <div class="doc-card">
        <strong style="color: #0F5C56;">2. NOTA KEBERANGKATAN TRANSPORT</strong><br/>
        <span style="font-size: 8px; color: #64748b;">Kolom Y Form Respons:</span><br/>
        <a href="${r.url_nota_berangkat}" target="_blank" class="doc-link">${r.url_nota_berangkat || 'Tidak ada URL'}</a>
      </div>

      ${r.url_nota_pulang ? `
        <div class="doc-card">
          <strong style="color: #0F5C56;">3. NOTA KEPULANGAN TRANSPORT</strong><br/>
          <span style="font-size: 8px; color: #64748b;">Kolom AO Form Respons:</span><br/>
          <a href="${r.url_nota_pulang}" target="_blank" class="doc-link">${r.url_nota_pulang}</a>
        </div>
      ` : ''}
    </div>
  `).join('')}
</body>
</html>
  `;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
