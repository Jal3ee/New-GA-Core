import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { formatEmployeeName } from './reimbursementWorkflow.js';
import { reimbursementDocuments, reimbursementAttachmentHash, attachmentExcludedPages } from './reimbursementEdits.js';

const TYPES = [
  ['includeBoardingPass', 'url_boarding_pass', 'Boarding Pass', 'AP'],
  ['includeBuktiCuti', 'url_bukti_cuti', 'Bukti Cuti Approve', 'X'],
  ['includeNotaBerangkat', 'url_nota_berangkat', 'Scan Nota Keberangkatan', 'Y'],
  ['includeNotaPulang', 'url_nota_pulang', 'Bukti Nota Kepulangan', 'AO']
];
const A4 = [595.28, 841.89];
const INK = rgb(0.12, 0.18, 0.25);
const TEAL = rgb(0.06, 0.36, 0.34);
const MUTED = rgb(0.38, 0.44, 0.51);

export function extractDriveFileId(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (!['drive.google.com', 'docs.google.com', 'drive.usercontent.google.com'].includes(parsed.hostname)) return null;
    return parsed.searchParams.get('id') || parsed.pathname.match(/\/d\/([\w-]+)/)?.[1] || null;
  } catch { return null; }
}

export function splitAttachmentUrls(value) {
  return [...new Set(String(value || '').match(/https?:\/\/[^\s,]+/g) || [])];
}

export async function fetchReimbursementAttachment(url) {
  const id = extractDriveFileId(url);
  if (!id) throw new Error('Tautan lampiran Google Drive tidak valid.');
  const resourceKey = new URL(url).searchParams.get('resourcekey');
  const base = import.meta.env?.VITE_PG_API_URL || '/api';
  const token = typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('garda_jwt_token') || localStorage.getItem('garda_jwt_token')) : null;
  const response = await fetch(`${base}/reimbursements/attachment/${encodeURIComponent(id)}${resourceKey ? '?resourcekey=' + encodeURIComponent(resourceKey) : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Lampiran tidak dapat diunduh (HTTP ' + response.status + ').');
  }
  return new Uint8Array(await response.arrayBuffer());
}

// Convert formats unsupported by pdf-lib through the browser's image decoder or Node canvas.
export function detectImageFormat(bytes) {
  if (!bytes || bytes.length < 4) return { type: 'unknown', mime: 'application/octet-stream' };
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { type: 'pdf', mime: 'application/pdf' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let isProgressive = false;
    let pos = 2;
    const len = bytes.length;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    while (pos < len - 1) {
      if (bytes[pos] === 0xff) {
        const marker = bytes[pos + 1];
        if (marker === 0xc2) { // SOF2 Progressive DCT
          isProgressive = true;
          break;
        }
        if (marker === 0xc0 || marker === 0xc1) break;
        if (marker === 0xda || marker === 0xd9) break;
        if (marker >= 0xd0 && marker <= 0xd7) { pos += 2; continue; }
        if (pos + 3 < len) {
          const segLen = view.getUint16(pos + 2);
          pos += 2 + segLen;
          continue;
        }
      }
      pos++;
    }
    return { type: 'jpeg', mime: 'image/jpeg', isProgressive };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { type: 'png', mime: 'image/png' };
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { type: 'webp', mime: 'image/webp' };
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { type: 'gif', mime: 'image/gif' };
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { type: 'bmp', mime: 'image/bmp' };
  }
  return { type: 'image', mime: 'image/jpeg' };
}

async function normalizeImage(bytes, mime = 'image/jpeg') {
  if (typeof window === 'undefined' && typeof createImageBitmap === 'undefined') {
    try {
      const pkg = '@napi-rs/' + 'canvas';
      const { createCanvas, loadImage } = await import(/* @vite-ignore */ pkg);
      const img = await loadImage(Buffer.from(bytes));
      const maxDim = 2400;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      return { bytes: new Uint8Array(canvas.toBuffer('image/png')), isPng: true, isJpg: false };
    } catch (e) {
      throw new Error('Konversi gambar di server/Node gagal: ' + e.message);
    }
  }

  const blob = new Blob([bytes], mime ? { type: mime } : undefined);
  let drawSource = null;
  let width = 0;
  let height = 0;
  let cleanup = () => {};

  if (typeof createImageBitmap !== 'undefined') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      drawSource = bmp;
      width = bmp.width;
      height = bmp.height;
      cleanup = () => bmp.close();
    } catch {
      try {
        const bmp = await createImageBitmap(blob);
        drawSource = bmp;
        width = bmp.width;
        height = bmp.height;
        cleanup = () => bmp.close();
      } catch {
        // Fall through to Image element
      }
    }
  }

  if (!drawSource && typeof Image !== 'undefined') {
    await new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Waktu tunggu pembacaan foto habis.'));
        }
      }, 15000);

      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        drawSource = img;
        width = img.naturalWidth || img.width;
        height = img.naturalHeight || img.height;
        cleanup = () => URL.revokeObjectURL(objectUrl);
        resolve();
      };

      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Format foto/gambar tidak didukung decoder peramban.'));
      };

      img.src = objectUrl;
    });
  }

  if (!drawSource || !width || !height) {
    throw new Error('Decoder browser tidak dapat memproses berkas foto ini.');
  }

  try {
    const maxDim = 2400;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Kanvas grafis tidak tersedia pada peramban.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(drawSource, 0, 0, targetW, targetH);

    let outBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.90));
    let isJpg = true;

    if (!outBlob) {
      outBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      isJpg = false;
    }

    if (!outBlob) throw new Error('Gagal mengonversi gambar ke kanvas.');
    return {
      bytes: new Uint8Array(await outBlob.arrayBuffer()),
      isJpg,
      isPng: !isJpg
    };
  } finally {
    cleanup();
  }
}

export function reimbursementPeriodKey(record) {
  return `${record.periode_tahun}|${record.periode_bulan}|${record.periode_ke}`;
}

/** A single period, employee-by-employee, full-size attachments with no amount summary. */
export async function compileReimbursementPdf({ selectedRecords = [], options = {}, onProgress, loadAttachment = fetchReimbursementAttachment }) {
  if (!selectedRecords.length) throw new Error('Tidak ada data reimbursement yang dipilih.');
  if (new Set(selectedRecords.map(reimbursementPeriodKey)).size !== 1) throw new Error('Pilih karyawan dari satu periode yang sama.');
  const types = TYPES.filter(([option]) => options[option] !== false);
  if (!types.length) throw new Error('Pilih minimal satu jenis lampiran.');
  const records = selectedRecords.map(record => ({ ...record, nama: formatEmployeeName(record.nama) })).sort((a, b) => a.nama.localeCompare(b.nama, 'id') || String(a.nik).localeCompare(String(b.nik)) || String(a.id).localeCompare(String(b.id)));
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const period = options.periodLabel || `${records[0].periode_bulan} ${records[0].periode_tahun} - ${records[0].periode_ke}`;
  const safe = value => Array.from(String(value ?? '-').replace(/[\r\n\t]/g, ' ')).map(c => {
    try { regular.encodeText(c); return c; } catch { return '?'; }
  }).join('');
  const wrap = (value, width, font, size) => {
    const lines = [];
    let line = '';
    for (const char of safe(value)) {
      if (line && font.widthOfTextAtSize(line + char, size) > width) { lines.push(line.trimEnd()); line = ''; }
      line += char;
    }
    lines.push(line.trimEnd());
    return lines;
  };
  const text = (page, value, x, y, width, size = 10, font = regular, color = INK) => {
    const lines = wrap(value, width, font, size);
    lines.forEach((line, i) => page.drawText(line, { x, y: y - i * (size + 4), font, size, color }));
    return y - lines.length * (size + 4);
  };
  const total = records.reduce((sum,record)=>sum+reimbursementDocuments(record,options).length,0);
  if(!total)throw new Error('Pilih minimal satu jenis lampiran yang sesuai dengan jenis reimbursement.');
  let current = 0;
  const loaded = [];
  const cache = new Map();
  // Resolve every submitted attachment first. Never export a misleading link-only report.
  for (const record of records) {
    const docs = [];
    for (const {option,field,label} of reimbursementDocuments(record,options)) {
      onProgress?.(++current, total, `Memuat ${record.nama}: ${label}...`);
      const urls = splitAttachmentUrls(record[field]);
      if (String(record[field] || '').trim() && !urls.length) throw new Error(`${record.nama} - ${label}: tautan tidak valid.`);
      const assets = [];
      for (const url of urls) {
        try {
          if (!cache.has(url)) {
            const rawBytes = await loadAttachment(url);
            const bytes = rawBytes.byteOffset === 0 && rawBytes.byteLength === rawBytes.buffer.byteLength
              ? rawBytes
              : new Uint8Array(rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength));
            const hash = await reimbursementAttachmentHash(bytes);
            let asset;
            if (String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') {
              const source = await PDFDocument.load(bytes);
              if (!source.getPageCount()) throw new Error('PDF tidak memiliki halaman.');
              // Normalize rotation/crop by wrapping each source page before embedding.
              const normalized = await PDFDocument.create();
              for (const original of source.getPages()) {
                const box = original.getCropBox();
                const embedded = await normalized.embedPage(original, { left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height });
                const angle = ((original.getRotation().angle % 360) + 360) % 360;
                const rotated = angle === 90 || angle === 270;
                const page = normalized.addPage(rotated ? [box.height, box.width] : [box.width, box.height]);
                page.drawPage(embedded, { x: angle === 180 || angle === 270 ? page.getWidth() : 0, y: angle === 90 || angle === 180 ? page.getHeight() : 0, rotate: degrees(-angle) });
              }
              asset = { pages: await pdf.embedPdf(await normalized.save(), normalized.getPageIndices()), hash, count: source.getPageCount() };
            } else {
              const formatInfo = detectImageFormat(bytes);
              let image = null;

              // Step 1: Direct embed if standard baseline JPEG (not progressive) or PNG
              if (formatInfo.type === 'jpeg' && !formatInfo.isProgressive) {
                try {
                  image = await pdf.embedJpg(bytes);
                } catch {
                  image = null;
                }
              } else if (formatInfo.type === 'png') {
                try {
                  image = await pdf.embedPng(bytes);
                } catch {
                  image = null;
                }
              }

              // Step 2: Normalize through canvas if direct embed not viable (progressive JPEG, WebP, photo, etc.)
              if (!image) {
                const normalized = await normalizeImage(bytes, formatInfo.mime);
                if (normalized.isJpg) {
                  image = await pdf.embedJpg(normalized.bytes);
                } else {
                  image = await pdf.embedPng(normalized.bytes);
                }
              }

              asset = { image, hash, count: 1 };
            }
            cache.set(url, asset);
          }
          const asset = cache.get(url);
          if (asset.isPlaceholder) {
            assets.push(asset);
          } else {
            const excluded = attachmentExcludedPages(record, field, extractDriveFileId(url), asset.hash, asset.count);
            if (asset.pages) assets.push({ ...asset, pages: asset.pages.filter((_, index) => !excluded.includes(index + 1)) });
            else if (!excluded.includes(1)) assets.push(asset);
          }
        } catch (error) {
          if (options.tolerateErrors) {
            console.warn(`Lampiran tidak dapat dimuat (${record.nama} - ${label}):`, error);
            const placeholder = {
              isPlaceholder: true,
              error: error.message || 'Gagal memuat lampiran',
              url,
              label,
              count: 1
            };
            cache.set(url, placeholder);
            assets.push(placeholder);
          } else {
            throw new Error(`${record.nama} - ${label}: ${error.message}`);
          }
        }
      }
      const intentionallyEmpty = urls.length > 0 && assets.every(asset => asset.pages ? asset.pages.length === 0 : false);
      if (!intentionallyEmpty) docs.push({ option, label, assets });
    }
    loaded.push({ record, docs });
  }

  // Multiple submissions for one employee belong to one continuous attachment section.
  const employeeMap = new Map();
  for (const entry of loaded) {
    const key = String(entry.record.nik || entry.record.nama).trim().toLowerCase()+'|'+(entry.record.reimbursement_edit?.mode || 'actual');
    const existing = employeeMap.get(key);
    if (!existing) employeeMap.set(key, entry);
    else entry.docs.forEach(doc => {const target=existing.docs.find(existingDoc=>existingDoc.option===doc.option);if(target)target.assets.push(...doc.assets);else existing.docs.push(doc);});
  }
  const employees = [...employeeMap.values()];
  employees.forEach(employee=>employee.docs.sort((a,b)=>TYPES.findIndex(type=>type[0]===a.option)-TYPES.findIndex(type=>type[0]===b.option)));

  if (options.includeCover !== false) {
    let page, y;
    const startSummary = continuation => {
      page = pdf.addPage(A4);
      page.drawRectangle({ x: 0, y: A4[1] - 8, width: A4[0], height: 8, color: TEAL });
      y = text(page, continuation ? 'DAFTAR KARYAWAN - LANJUTAN' : 'REKAP BERKAS REIMBURSEMENT', 36, 800, 523, 18, bold, TEAL);
      y = text(page, 'PT. Antang Gunung Meratus | General Affairs', 36, y - 5, 523, 10, regular, MUTED);
      y = text(page, period, 36, y - 12, 523, 12, bold);
      y = text(page, `${records.length} pengajuan | ${new Set(records.map(r => r.nik || r.nama)).size} karyawan`, 36, y - 4, 523, 10);
      y = text(page, 'Urutan: Boarding Pass / Bukti Cuti / Nota Keberangkatan / Nota Kepulangan', 36, y - 8, 523, 9, regular, MUTED) - 14;
      page.drawRectangle({ x: 36, y: y - 24, width: 523, height: 25, color: TEAL });
      text(page, 'NO', 44, y - 15, 25, 9, bold, rgb(1, 1, 1));
      text(page, 'KARYAWAN / NIK', 76, y - 15, 235, 9, bold, rgb(1, 1, 1));
      text(page, 'DEPARTEMEN / SITE', 324, y - 15, 223, 9, bold, rgb(1, 1, 1));
      y -= 25;
    };
    startSummary(false);
    employees.forEach(({ record }, index) => {
      const nameLines = wrap(record.nama, 235, bold, 10);
      const deptLines = wrap(record.departemen || '-', 223, regular, 10);
      const height = Math.max(nameLines.length, deptLines.length) * 14 + 32;
      if (y - height < 60) startSummary(true);
      if (index % 2 === 0) page.drawRectangle({ x: 36, y: y - height, width: 523, height, color: rgb(0.96, 0.98, 0.98) });
      text(page, index + 1, 44, y - 16, 25, 10);
      const nameY = text(page, record.nama, 76, y - 16, 235, 10, bold);
      text(page, `NIK: ${record.nik || '-'}`, 76, nameY - 2, 235, 9, regular, MUTED);
      const deptY = text(page, record.departemen || '-', 324, y - 16, 223, 10);
      text(page, `Site: ${record.site || '-'}`, 324, deptY - 2, 223, 9, regular, MUTED);
      y -= height;
    });
  }

  for (const { record, docs } of employees) {
    for (const { option, label, assets } of docs) {
      const units = assets.flatMap(asset => asset.pages ? asset.pages.map(unit => ({ unit, isPdf: true })) : [{ unit: asset.image, isPdf: false, isPlaceholder: asset.isPlaceholder, error: asset.error, url: asset.url }]);
      // Missing submissions remain explicit in their correct position.
      for (const [index, item] of (units.length ? units : [null]).entries()) {
        const page = pdf.addPage(A4);
        page.drawRectangle({ x: 0, y: A4[1] - 8, width: A4[0], height: 8, color: TEAL });
        let y = text(page, record.nama, 36, 800, 523, 16, bold, TEAL);
        y = text(page, `NIK: ${record.nik || '-'} | Site: ${record.site || '-'}`, 36, y - 4, 523, 10);
        y = text(page, `Departemen: ${record.departemen || '-'}`, 36, y - 2, 523, 10);
        y = text(page, period, 36, y - 3, 523, 9, regular, MUTED);
        const order = TYPES.findIndex(type => type[0] === option) + 1;
        y = text(page, `${order}. ${label}${units.length > 1 ? ` | Halaman lampiran ${index + 1}/${units.length}` : ''}`, 36, y - 12, 523, 12, bold) - 10;
        page.drawLine({ start: { x: 36, y }, end: { x: 559, y }, thickness: 1, color: TEAL });
        if (item) {
          if (item.isPlaceholder) {
            page.drawRectangle({ x: 36, y: y - 140, width: 523, height: 120, color: rgb(0.99, 0.95, 0.95), borderColor: rgb(0.85, 0.25, 0.25), borderWidth: 1 });
            text(page, 'PERHATIAN: LAMPIRAN TIDAK DAPAT DITAMPILKAN SECARA OTOMATIS', 52, y - 24, 491, 10, bold, rgb(0.8, 0.2, 0.2));
            text(page, `Keterangan: ${safe(item.error)}`, 52, y - 44, 491, 9, regular, INK);
            text(page, 'Tautan berkas Google Drive asli:', 52, y - 68, 491, 8, bold, MUTED);
            text(page, safe(item.url), 52, y - 82, 491, 8, regular, rgb(0.1, 0.35, 0.75));
            text(page, 'Pastikan berkas telah dibagikan (akses siapa saja dengan tautan) atau unggah kembali format gambar standar (JPG/PNG).', 52, y - 104, 491, 8, regular, MUTED);
          } else {
            const { unit, isPdf } = item;
            const maxHeight = y - 60;
            const scale = Math.min(523 / unit.width, maxHeight / unit.height);
            const width = unit.width * scale, height = unit.height * scale;
            const bounds = { x: 36 + (523 - width) / 2, y: 46 + (maxHeight - height) / 2, width, height };
            if (isPdf) page.drawPage(unit, bounds);
            else page.drawImage(unit, bounds);
          }
        } else {
          text(page, 'Lampiran ' + label.toLowerCase() + ' belum tersedia pada pengajuan ini.', 52, y - 48, 491, 12, regular, MUTED);
        }
      }
    }
  }
  const count = pdf.getPageCount();
  if(!count)throw new Error('Tidak ada halaman lampiran yang tersisa. Pulihkan halaman atau sertakan cover sebelum membuat PDF.');
  pdf.getPages().forEach((page, index) => {
    page.drawLine({ start: { x: 36, y: 35 }, end: { x: 559, y: 35 }, thickness: 0.5, color: MUTED });
    text(page, 'PT. AGM | Rekap lampiran reimbursement', 36, 22, 400, 8, regular, MUTED);
    text(page, `${index + 1} / ${count}`, 506, 22, 53, 8, regular, MUTED);
  });
  pdf.setTitle(`Rekap Berkas Reimbursement - ${safe(period)}`);
  pdf.setAuthor('General Affairs - PT. Antang Gunung Meratus');
  return new Blob([await pdf.save()], { type: 'application/pdf' });
}

export function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

// Print and download use the exact same PDF, including all source PDF pages.
export async function openReimbursementPrintWindow({ selectedRecords = [], periodLabel = '', options = {}, resolveRecords }) {
  const popup = window.open('', '_blank');
  if (!popup) { alert('Izinkan pop-up untuk membuka format cetak.'); return; }
  popup.document.title = 'Rekap berkas reimbursement';
  popup.document.body.textContent = 'Memuat lampiran reimbursement...';
  try {
    const latestRecords=resolveRecords ? await resolveRecords() : selectedRecords;
    const blob = await compileReimbursementPdf({ selectedRecords:latestRecords, options: { tolerateErrors: true, ...options, periodLabel }, onProgress: (_current, _total, message) => { if (!popup.closed) popup.document.body.textContent = message; } });
    if (popup.closed) return;
    const url = URL.createObjectURL(blob);
    popup.location.replace(url);
    // Keep the blob alive while the preview is open, including later printing.
    const timer = setInterval(() => { if (popup.closed) { URL.revokeObjectURL(url); clearInterval(timer); } }, 1000);
  } catch (error) {
    if (!popup.closed) popup.document.body.textContent = 'Rekap belum dapat dibuat: ' + error.message;
  }
}
