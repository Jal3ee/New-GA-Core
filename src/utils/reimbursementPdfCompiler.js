import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Extract Google Drive File ID from any Google Drive URL format
 */
export function extractDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId) return matchId[1];
  const matchD = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD) return matchD[1];
  return null;
}

/**
 * Compile selected reimbursement records into a single merged PDF with standardized employee headers.
 * 
 * Sesuai instruksi:
 * 1. Setiap orang direkap rapi dengan identitas: Nama, NIK, Departemen, Site, dan Tanggal Perjalanan.
 * 2. Urutan lampiran terstandarisasi:
 *    - [1] Boarding Pass (Kolom AP)
 *    - [2] Bukti Cuti Approve (Kolom X)
 *    - [3] Scan Nota Keberangkatan (Kolom Y)
 *    - [4] Bukti Nota Kepulangan (Kolom AO)
 * 3. NOMINAL TIDAK DI-INCLUDE (sesuai arahan pengguna).
 * 
 * @param {Object} params
 * @param {Array} params.selectedRecords - List of records to compile
 * @param {Object} params.options - Configuration options
 * @param {Function} [params.onProgress] - Callback (current, total, statusText)
 * @returns {Promise<Blob>} Merged PDF Blob
 */
export async function compileReimbursementPdf({
  selectedRecords = [],
  options = {
    includeCover: true,
    includeBoardingPass: true,
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
  // 1. COVER & REKAPITULASI SUMMARY PAGE (TANPA NOMINAL)
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
      ? `REKAPITULASI BERKAS REIMBURSEMENT - ${options.periodLabel.toUpperCase()}`
      : 'REKAPITULASI BERKAS REIMBURSEMENT TIKET & TRANSPORT';

    coverPage.drawText(titleText.substring(0, 56), {
      x: 40,
      y: height - 42,
      size: 12,
      font: fontBold,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    coverPage.drawText('Departemen General Affairs - PT. Antang Gunung Meratus', {
      x: 40,
      y: height - 57,
      size: 9,
      font: fontRegular,
      color: rgb(71 / 255, 85 / 255, 105 / 255),
    });

    // Meta box (TANPA NOMINAL)
    const nowStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    coverPage.drawRectangle({
      x: 40,
      y: height - 114,
      width: width - 80,
      height: 48,
      color: rgb(248 / 255, 250 / 255, 252 / 255),
      borderColor: rgb(203 / 255, 213 / 255, 225 / 255),
      borderWidth: 1,
    });

    coverPage.drawText(`Dicetak Pada: ${nowStr}`, {
      x: 52,
      y: height - 82,
      size: 8,
      font: fontRegular,
      color: rgb(51 / 255, 65 / 255, 85 / 255),
    });

    coverPage.drawText(`Jumlah Karyawan: ${selectedRecords.length} Orang (${options.periodLabel || 'Semua Periode'})`, {
      x: 52,
      y: height - 96,
      size: 8,
      font: fontBold,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    coverPage.drawText('Standar Urutan Lampiran:', {
      x: 320,
      y: height - 82,
      size: 8,
      font: fontBold,
      color: rgb(51 / 255, 65 / 255, 85 / 255),
    });

    coverPage.drawText('1. Boarding Pass (AP) • 2. Bukti Cuti (X) • 3. Nota Berangkat (Y) • 4. Nota Pulang (AO)', {
      x: 320,
      y: height - 96,
      size: 7,
      font: fontRegular,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });

    // Summary Table
    let tableY = height - 132;
    coverPage.drawText('DAFTAR KARYAWAN & CEK KELENGKAPAN LAMPIRAN:', {
      x: 40,
      y: tableY,
      size: 8.5,
      font: fontBold,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    tableY -= 15;

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

    coverPage.drawText('No', { x: 44, y: tableY + 2, size: 7, font: fontBold });
    coverPage.drawText('Nama Karyawan', { x: 62, y: tableY + 2, size: 7, font: fontBold });
    coverPage.drawText('NIK', { x: 185, y: tableY + 2, size: 7, font: fontBold });
    coverPage.drawText('Departemen / Site', { x: 245, y: tableY + 2, size: 7, font: fontBold });
    coverPage.drawText('Tgl Trip', { x: 375, y: tableY + 2, size: 7, font: fontBold });
    coverPage.drawText('B.Pass (AP)', { x: 445, y: tableY + 2, size: 6.5, font: fontBold });
    coverPage.drawText('Cuti (X)', { x: 485, y: tableY + 2, size: 6.5, font: fontBold });
    coverPage.drawText('Nota B (Y)', { x: 520, y: tableY + 2, size: 6.5, font: fontBold });
    coverPage.drawText('Nota P (AO)', { x: 555, y: tableY + 2, size: 6.5, font: fontBold });

    tableY -= 15;

    // Table Rows (showing up to 26 items on cover)
    const maxOnCover = 26;
    const itemsToShow = selectedRecords.slice(0, maxOnCover);

    itemsToShow.forEach((rec, idx) => {
      const isEven = idx % 2 === 1;
      if (isEven) {
        coverPage.drawRectangle({
          x: 40,
          y: tableY - 3,
          width: width - 80,
          height: 14,
          color: rgb(250 / 255, 250 / 250 / 255),
        });
      }

      coverPage.drawText(String(idx + 1), { x: 44, y: tableY + 1, size: 6.5, font: fontRegular });
      
      const safeName = (rec.nama || '-').substring(0, 24);
      coverPage.drawText(safeName, { x: 62, y: tableY + 1, size: 6.8, font: fontBold });
      
      coverPage.drawText(rec.nik || '-', { x: 185, y: tableY + 1, size: 6.5, font: fontRegular });
      
      const deptSite = `${(rec.departemen || '-').substring(0, 20)} (${rec.site || 'Site'})`;
      coverPage.drawText(deptSite, { x: 245, y: tableY + 1, size: 6.5, font: fontRegular });

      const tglTrip = `${rec.tgl_berangkat || '-'} s/d ${rec.tgl_pulang || '-'}`.substring(0, 22);
      coverPage.drawText(tglTrip, { x: 375, y: tableY + 1, size: 6, font: fontRegular });

      // Checkmarks for attachments
      const hasBP = Boolean(rec.url_boarding_pass);
      const hasCuti = Boolean(rec.url_bukti_cuti);
      const hasNotaB = Boolean(rec.url_nota_berangkat);
      const hasNotaP = Boolean(rec.url_nota_pulang);

      coverPage.drawText(hasBP ? 'Ada' : '-', { x: 450, y: tableY + 1, size: 6.5, font: fontBold, color: hasBP ? rgb(15/255, 92/255, 86/255) : rgb(150/255, 150/255, 150/255) });
      coverPage.drawText(hasCuti ? 'Ada' : '-', { x: 490, y: tableY + 1, size: 6.5, font: fontBold, color: hasCuti ? rgb(15/255, 92/255, 86/255) : rgb(150/255, 150/255, 150/255) });
      coverPage.drawText(hasNotaB ? 'Ada' : '-', { x: 525, y: tableY + 1, size: 6.5, font: fontBold, color: hasNotaB ? rgb(15/255, 92/255, 86/255) : rgb(150/255, 150/255, 150/255) });
      coverPage.drawText(hasNotaP ? 'Ada' : '-', { x: 560, y: tableY + 1, size: 6.5, font: fontBold, color: hasNotaP ? rgb(15/255, 92/255, 86/255) : rgb(150/255, 150/255, 150/255) });

      tableY -= 14;
    });

    if (selectedRecords.length > maxOnCover) {
      coverPage.drawText(`... dan ${selectedRecords.length - maxOnCover} berkas karyawan lainnya (dilampirkan lengkap per halaman)`, {
        x: 45,
        y: tableY,
        size: 7,
        font: fontRegular,
        color: rgb(100 / 255, 116 / 255, 139 / 255)
      });
      tableY -= 14;
    }

    // Signatures footer on cover
    const signY = 60;
    coverPage.drawText('Disiapkan Oleh (GA Admin):', { x: 60, y: signY + 30, size: 7, font: fontRegular });
    coverPage.drawLine({ start: { x: 60, y: signY + 4 }, end: { x: 190, y: signY + 4 }, thickness: 0.75, color: rgb(148 / 255, 163 / 255, 184 / 255) });
    coverPage.drawText('Staff General Affairs', { x: 60, y: signY - 7, size: 6.5, font: fontRegular, color: rgb(100 / 255, 116 / 255, 139 / 255) });

    coverPage.drawText('Diperiksa Oleh:', { x: 250, y: signY + 30, size: 7, font: fontRegular });
    coverPage.drawLine({ start: { x: 250, y: signY + 4 }, end: { x: 370, y: signY + 4 }, thickness: 0.75, color: rgb(148 / 255, 163 / 255, 184 / 255) });
    coverPage.drawText('GA Section Head / Group Leader', { x: 250, y: signY - 7, size: 6.5, font: fontRegular, color: rgb(100 / 255, 116 / 255, 139 / 255) });

    coverPage.drawText('Diterima Oleh Finance:', { x: 430, y: signY + 30, size: 7, font: fontRegular });
    coverPage.drawLine({ start: { x: 430, y: signY + 4 }, end: { x: 550, y: signY + 4 }, thickness: 0.75, color: rgb(148 / 255, 163 / 255, 184 / 255) });
    coverPage.drawText('Finance & Accounting Department', { x: 430, y: signY - 7, size: 6.5, font: fontRegular, color: rgb(100 / 255, 116 / 255, 139 / 255) });

    currentStep++;
  }

  // -------------------------------------------------------------
  // Helper: Draw Standardized Employee Banner on any PDF Page
  // -------------------------------------------------------------
  function drawEmployeeHeader(page, rec, docTitle, colLabel) {
    const { width, height } = page.getSize();
    const bannerHeight = 38;

    // Top Teal Banner (#0F5C56)
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
    page.drawText(`${docTitle.toUpperCase()} (${colLabel})`, {
      x: 18,
      y: height - 16,
      size: 9.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Employee Meta (Bottom of banner): Nama, NIK, Departemen, Site
    const metaStr = `Karyawan: ${(rec.nama || '-').toUpperCase()}   |   NIK: ${rec.nik || '-'}   |   Dept: ${rec.departemen || '-'}   |   Site: ${rec.site || '-'}`;
    page.drawText(metaStr, {
      x: 18,
      y: height - 29,
      size: 7.5,
      font: fontRegular,
      color: rgb(220 / 255, 240 / 255, 238 / 255),
    });
  }

  // -------------------------------------------------------------
  // Helper: Create Standardized Document Sheet for a Specific Attachment
  // -------------------------------------------------------------
  function createDocumentSheet(rec, docNumber, docTitle, colLabel, docUrl) {
    const page = mergedPdf.addPage([612, 792]);
    const { width, height } = page.getSize();

    drawEmployeeHeader(page, rec, `${docNumber}. ${docTitle}`, colLabel);

    // Document Card Box
    page.drawRectangle({
      x: 40,
      y: height - 370,
      width: width - 80,
      height: 300,
      color: rgb(248 / 255, 250 / 255, 252 / 255),
      borderColor: rgb(203 / 255, 213 / 255, 225 / 255),
      borderWidth: 1,
    });

    page.drawText('VERIFIKASI & TAUTAN LAMPIRAN DIGITAL', {
      x: 60,
      y: height - 95,
      size: 11,
      font: fontBold,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    page.drawText('Dokumen ini terdaftar dalam database Form Order Kebutuhan Tiket & Reimbursement PT. AGM.', {
      x: 60,
      y: height - 110,
      size: 8,
      font: fontRegular,
      color: rgb(71 / 255, 85 / 255, 105 / 255),
    });

    // Info Grid (TANPA NOMINAL)
    const details = [
      ['Jenis Dokumen', `${docNumber}. ${docTitle} (${colLabel})`],
      ['Nama Karyawan', `${rec.nama}`],
      ['NIK', `${rec.nik || '-'}`],
      ['Departemen', `${rec.departemen || '-'}`],
      ['Site Lokasi', `Site ${rec.site || '-'}`],
      ['Tanggal Perjalanan', `${rec.tgl_berangkat || '-'} s/d ${rec.tgl_pulang || '-'}`],
      ['Periode Rekap', `${rec.periode_bulan || ''} ${rec.periode_ke || ''}`],
      ['Status Lampiran', docUrl ? 'TERSEDIA DI GOOGLE DRIVE' : 'TIDAK DILAMPIRKAN / NIHIL'],
    ];

    let infoY = height - 138;
    details.forEach(([label, val]) => {
      page.drawText(label, { x: 60, y: infoY, size: 8, font: fontBold, color: rgb(71 / 255, 85 / 255, 105 / 255) });
      page.drawText(`: ${val}`, { x: 180, y: infoY, size: 8, font: fontRegular, color: rgb(15 / 255, 23 / 255, 42 / 255) });
      infoY -= 17;
    });

    // Drive URL box
    page.drawRectangle({
      x: 60,
      y: infoY - 30,
      width: width - 120,
      height: 36,
      color: rgb(240 / 255, 247 / 255, 246 / 255),
      borderColor: rgb(15 / 255, 92 / 255, 86 / 255),
      borderWidth: 0.5,
    });

    page.drawText('Tautan Berkas Google Drive / Cloud Storage:', {
      x: 70,
      y: infoY - 12,
      size: 7.5,
      font: fontBold,
      color: rgb(15 / 255, 92 / 255, 86 / 255),
    });

    const safeUrl = (docUrl || 'Tidak ada tautan berkas').substring(0, 85);
    page.drawText(safeUrl, {
      x: 70,
      y: infoY - 24,
      size: 7.5,
      font: fontRegular,
      color: docUrl ? rgb(3 / 255, 105 / 255, 161 / 255) : rgb(150 / 255, 150 / 255, 150 / 255),
    });

    // Verification Note
    infoY -= 58;
    page.drawText('Catatan Verifikasi Berkas GA:', { x: 60, y: infoY, size: 8, font: fontBold, color: rgb(51 / 255, 65 / 255, 85 / 255) });
    const noteText = docUrl 
      ? 'Tautan di atas tersimpan pada database Google Drive resmi dan dapat dibuka langsung oleh Finance & Accounting.'
      : 'Karyawan tidak menyertakan lampiran untuk bagian ini (tiket/dokumen nihil atau ditanggung langsung).';
    page.drawText(noteText, {
      x: 60,
      y: infoY - 14,
      size: 7.5,
      font: fontRegular,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });
  }

  // -------------------------------------------------------------
  // 2. PROCESS EACH EMPLOYEE IN STRICT ORDER:
  //    1. Boarding Pass (Kolom AP)
  //    2. Bukti Cuti Approve (Kolom X)
  //    3. Scan Nota Keberangkatan (Kolom Y)
  //    4. Bukti Nota Kepulangan (Kolom AO)
  // -------------------------------------------------------------
  for (let i = 0; i < selectedRecords.length; i++) {
    const rec = selectedRecords[i];
    currentStep++;

    if (onProgress) {
      onProgress(currentStep, totalSteps, `Menyusun berkas ${rec.nama} (${i + 1}/${selectedRecords.length})...`);
    }

    // 1. BOARDING PASS (Kolom AP)
    if (options.includeBoardingPass !== false) {
      createDocumentSheet(
        rec,
        1,
        'BOARDING PASS PENERBANGAN CUTI',
        'KOLOM AP',
        rec.url_boarding_pass
      );
    }

    // 2. BUKTI CUTI APPROVE (Kolom X)
    if (options.includeBuktiCuti !== false) {
      createDocumentSheet(
        rec,
        2,
        'BUKTI CUTI SUNFISH (FULL APPROVED)',
        'KOLOM X',
        rec.url_bukti_cuti
      );
    }

    // 3. SCAN NOTA KEBERANGKATAN (Kolom Y)
    if (options.includeNotaBerangkat !== false) {
      createDocumentSheet(
        rec,
        3,
        'SCAN NOTA KEBERANGKATAN TRANSPORT',
        'KOLOM Y',
        rec.url_nota_berangkat
      );
    }

    // 4. BUKTI NOTA KEPULANGAN (Kolom AO)
    if (options.includeNotaPulang !== false) {
      createDocumentSheet(
        rec,
        4,
        'BUKTI NOTA KEPULANGAN TRANSPORT',
        'KOLOM AO',
        rec.url_nota_pulang
      );
    }
  }

  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Format currency to IDR (kept for any backward compatibility)
 */
export function formatRupiah(num) {
  if (!num && num !== 0) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

/**
 * Open High-Fidelity Printable Window with clean best-practice layout.
 * 
 * Fitur:
 * 1. Setiap orang direkap rapi dengan tanda nama, NIK, departemen, site.
 * 2. Urutan lampiran terstandarisasi:
 *    [1] Boarding Pass (Kolom AP)
 *    [2] Bukti Cuti Approve (Kolom X)
 *    [3] Scan Nota Keberangkatan (Kolom Y)
 *    [4] Bukti Nota Kepulangan (Kolom AO)
 * 3. NOMINAL TIDAK DI-INCLUDE (sesuai permintaan pengguna).
 * 4. Tautan Google Drive aktif, langsung dapat diklik atau dicetak ke PDF browser.
 */
export function openReimbursementPrintWindow({ selectedRecords = [], periodLabel = '' }) {
  const printWin = window.open('', '_blank', 'width=1100,height=850');
  if (!printWin) {
    alert('Pop-up terblokir oleh browser. Silakan izinkan pop-up untuk mencetak berkas.');
    return;
  }

  const nowStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const titleSafe = periodLabel ? `Rekap_${periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_')}` : 'Rekap_Reimbursement';

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${titleSafe}_${Date.now()}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10px;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print-bar {
      background: #0F5C56;
      color: #ffffff;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1000;
      font-size: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
      margin: -12mm -14mm 16px -14mm;
    }
    .no-print-bar button {
      background: #ffffff;
      color: #0F5C56;
      border: none;
      padding: 7px 16px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .no-print-bar button:hover {
      background: #f1f5f9;
    }
    .header-card {
      border-bottom: 3px solid #0F5C56;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .doc-title {
      font-size: 15px;
      font-weight: 800;
      color: #0F5C56;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }
    .doc-sub {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .meta-box {
      display: flex;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 9px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 8.5px;
    }
    table.data-table th, table.data-table td {
      border: 1px solid #cbd5e1;
      padding: 6px 7px;
    }
    table.data-table th {
      background: #f1f5f9;
      font-weight: 700;
      text-align: left;
      color: #334155;
    }
    .badge-ok {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7.5px;
      font-weight: 700;
      background: #dcfce7;
      color: #166534;
      text-align: center;
    }
    .badge-empty {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7.5px;
      color: #94a3b8;
      background: #f1f5f9;
      text-align: center;
    }
    .employee-section {
      page-break-before: always;
      margin-top: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .banner {
      background: #0F5C56;
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 14px;
      border-left: 6px solid #C4841F;
    }
    .banner-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .banner-sub {
      font-size: 9px;
      color: #e2e8f0;
      margin-top: 4px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .banner-sub span {
      background: rgba(255,255,255,0.15);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .doc-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .doc-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      background: #f8fafc;
      transition: all 0.2s;
    }
    .doc-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .doc-order-tag {
      font-size: 10px;
      font-weight: 800;
      color: #0F5C56;
      text-transform: uppercase;
    }
    .doc-link-wrap {
      margin-top: 8px;
      padding: 8px 10px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .doc-link {
      color: #0284c7;
      text-decoration: none;
      word-break: break-all;
      font-weight: 600;
      font-size: 8.5px;
    }
    .doc-link:hover {
      text-decoration: underline;
      color: #0369a1;
    }
    .preview-box {
      margin-top: 10px;
      text-align: center;
      padding: 8px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .preview-img {
      max-height: 180px;
      max-width: 100%;
      border-radius: 4px;
      object-fit: contain;
    }
    @media print {
      .no-print-bar { display: none !important; }
      body { margin: 0; padding: 0; }
      .employee-section { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <strong>Kompilasi Berkas Reimbursement (${selectedRecords.length} Karyawan)</strong>
      <span style="opacity: 0.8; margin-left: 8px;">| Periode: ${periodLabel || 'Kolektif'}</span>
    </div>
    <div>
      <button onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
      <button onclick="window.close()" style="margin-left: 8px; background: transparent; color: #fff; border: 1px solid #fff;">Tutup</button>
    </div>
  </div>

  <div class="header-card">
    <div class="doc-title">Rekapitulasi Dokumen Reimbursement Tiket & Transport</div>
    <div class="doc-sub">PT. Antang Gunung Meratus - General Affairs Department (Human Capital & GA)</div>
  </div>

  <div class="meta-box">
    <div><strong>Tanggal Rekap:</strong> ${nowStr}</div>
    <div><strong>Periode Rekap:</strong> <strong>${periodLabel || 'Semua Periode'}</strong></div>
    <div><strong>Jumlah Karyawan:</strong> ${selectedRecords.length} Orang</div>
    <div><strong>Urutan Lampiran:</strong> 1. Boarding Pass (AP) • 2. Cuti (X) • 3. Nota Berangkat (Y) • 4. Nota Pulang (AO)</div>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25px;">No</th>
        <th>Nama Karyawan</th>
        <th>NIK</th>
        <th>Departemen</th>
        <th>Site</th>
        <th>Tgl Perjalanan</th>
        <th style="text-align: center; width: 75px;">1. B.Pass (AP)</th>
        <th style="text-align: center; width: 75px;">2. Cuti (X)</th>
        <th style="text-align: center; width: 75px;">3. Nota B (Y)</th>
        <th style="text-align: center; width: 75px;">4. Nota P (AO)</th>
      </tr>
    </thead>
    <tbody>
      ${selectedRecords.map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${r.nama}</strong></td>
          <td>${r.nik || '-'}</td>
          <td>${r.departemen || '-'}</td>
          <td>${r.site || '-'}</td>
          <td>${r.tgl_berangkat || '-'} s/d ${r.tgl_pulang || '-'}</td>
          <td style="text-align: center;">${r.url_boarding_pass ? '<span class="badge-ok">✓ Terlampir</span>' : '<span class="badge-empty">-</span>'}</td>
          <td style="text-align: center;">${r.url_bukti_cuti ? '<span class="badge-ok">✓ Terlampir</span>' : '<span class="badge-empty">-</span>'}</td>
          <td style="text-align: center;">${r.url_nota_berangkat ? '<span class="badge-ok">✓ Terlampir</span>' : '<span class="badge-empty">-</span>'}</td>
          <td style="text-align: center;">${r.url_nota_pulang ? '<span class="badge-ok">✓ Terlampir</span>' : '<span class="badge-empty">-</span>'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- SECTION PER KARYAWAN -->
  ${selectedRecords.map((r, idx) => {
    const fIdBP = extractDriveFileId(r.url_boarding_pass);
    const fIdCuti = extractDriveFileId(r.url_bukti_cuti);
    const fIdNotaB = extractDriveFileId(r.url_nota_berangkat);
    const fIdNotaP = extractDriveFileId(r.url_nota_pulang);

    return `
    <div class="employee-section">
      <!-- BANNER IDENTITAS KARYAWAN -->
      <div class="banner">
        <div class="banner-title">${idx + 1}. ${r.nama}</div>
        <div class="banner-sub">
          <span><strong>NIK:</strong> ${r.nik || '-'}</span>
          <span><strong>Departemen:</strong> ${r.departemen || '-'}</span>
          <span><strong>Site:</strong> Site ${r.site || '-'}</span>
          <span><strong>Tgl Trip:</strong> ${r.tgl_berangkat || '-'} s/d ${r.tgl_pulang || '-'}</span>
          <span><strong>Periode:</strong> ${r.periode_bulan || ''} ${r.periode_ke || ''}</span>
        </div>
      </div>

      <div class="doc-grid">
        <!-- 1. BOARDING PASS (KOLOM AP) -->
        <div class="doc-card">
          <div class="doc-card-header">
            <span class="doc-order-tag">1. BOARDING PASS PENERBANGAN CUTI (KOLOM AP)</span>
            ${r.url_boarding_pass ? '<span class="badge-ok">TERSEDIA DI GOOGLE DRIVE</span>' : '<span class="badge-empty">TIDAK DILAMPIRKAN</span>'}
          </div>
          ${r.url_boarding_pass ? `
            <div class="doc-link-wrap">
              <a href="${r.url_boarding_pass}" target="_blank" rel="noopener noreferrer" class="doc-link">
                🔗 Buka Dokumen Drive: ${r.url_boarding_pass}
              </a>
              <span style="font-size: 8px; color: #64748b;">(Klik untuk buka berkas asli)</span>
            </div>
            ${fIdBP ? `
              <div class="preview-box">
                <img src="https://drive.google.com/thumbnail?id=${fIdBP}&sz=w800" alt="Preview Boarding Pass" class="preview-img" onerror="this.parentElement.style.display='none'" />
              </div>
            ` : ''}
          ` : `
            <p style="font-size: 8.5px; color: #94a3b8; font-style: italic; margin-top: 6px;">Karyawan tidak mengunggah boarding pass pada pengajuan ini.</p>
          `}
        </div>

        <!-- 2. BUKTI CUTI APPROVE (KOLOM X) -->
        <div class="doc-card">
          <div class="doc-card-header">
            <span class="doc-order-tag">2. BUKTI CUTI APPROVAL SUNFISH (KOLOM X)</span>
            ${r.url_bukti_cuti ? '<span class="badge-ok">TERSEDIA DI GOOGLE DRIVE</span>' : '<span class="badge-empty">TIDAK DILAMPIRKAN</span>'}
          </div>
          ${r.url_bukti_cuti ? `
            <div class="doc-link-wrap">
              <a href="${r.url_bukti_cuti}" target="_blank" rel="noopener noreferrer" class="doc-link">
                🔗 Buka Dokumen Drive: ${r.url_bukti_cuti}
              </a>
              <span style="font-size: 8px; color: #64748b;">(Klik untuk buka berkas asli)</span>
            </div>
            ${fIdCuti ? `
              <div class="preview-box">
                <img src="https://drive.google.com/thumbnail?id=${fIdCuti}&sz=w800" alt="Preview Bukti Cuti" class="preview-img" onerror="this.parentElement.style.display='none'" />
              </div>
            ` : ''}
          ` : `
            <p style="font-size: 8.5px; color: #94a3b8; font-style: italic; margin-top: 6px;">Karyawan tidak mengunggah bukti cuti pada pengajuan ini.</p>
          `}
        </div>

        <!-- 3. SCAN NOTA KEBERANGKATAN (KOLOM Y) -->
        <div class="doc-card">
          <div class="doc-card-header">
            <span class="doc-order-tag">3. SCAN NOTA KEBERANGKATAN TRANSPORT (KOLOM Y)</span>
            ${r.url_nota_berangkat ? '<span class="badge-ok">TERSEDIA DI GOOGLE DRIVE</span>' : '<span class="badge-empty">TIDAK DILAMPIRKAN</span>'}
          </div>
          ${r.url_nota_berangkat ? `
            <div class="doc-link-wrap">
              <a href="${r.url_nota_berangkat}" target="_blank" rel="noopener noreferrer" class="doc-link">
                🔗 Buka Dokumen Drive: ${r.url_nota_berangkat}
              </a>
              <span style="font-size: 8px; color: #64748b;">(Klik untuk buka berkas asli)</span>
            </div>
            ${fIdNotaB ? `
              <div class="preview-box">
                <img src="https://drive.google.com/thumbnail?id=${fIdNotaB}&sz=w800" alt="Preview Nota Berangkat" class="preview-img" onerror="this.parentElement.style.display='none'" />
              </div>
            ` : ''}
          ` : `
            <p style="font-size: 8.5px; color: #94a3b8; font-style: italic; margin-top: 6px;">Karyawan tidak mengunggah nota keberangkatan pada pengajuan ini.</p>
          `}
        </div>

        <!-- 4. BUKTI NOTA KEPULANGAN (KOLOM AO) -->
        <div class="doc-card">
          <div class="doc-card-header">
            <span class="doc-order-tag">4. BUKTI NOTA KEPULANGAN TRANSPORT (KOLOM AO)</span>
            ${r.url_nota_pulang ? '<span class="badge-ok">TERSEDIA DI GOOGLE DRIVE</span>' : '<span class="badge-empty">TIDAK DILAMPIRKAN (NIHIL)</span>'}
          </div>
          ${r.url_nota_pulang ? `
            <div class="doc-link-wrap">
              <a href="${r.url_nota_pulang}" target="_blank" rel="noopener noreferrer" class="doc-link">
                🔗 Buka Dokumen Drive: ${r.url_nota_pulang}
              </a>
              <span style="font-size: 8px; color: #64748b;">(Klik untuk buka berkas asli)</span>
            </div>
            ${fIdNotaP ? `
              <div class="preview-box">
                <img src="https://drive.google.com/thumbnail?id=${fIdNotaP}&sz=w800" alt="Preview Nota Pulang" class="preview-img" onerror="this.parentElement.style.display='none'" />
              </div>
            ` : ''}
          ` : `
            <p style="font-size: 8.5px; color: #94a3b8; font-style: italic; margin-top: 6px;">Karyawan tidak menyertakan nota kepulangan (nihil / kepulangan ditanggung perusahaan).</p>
          `}
        </div>
      </div>
    </div>
    `;
  }).join('')}
</body>
</html>
  `;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
