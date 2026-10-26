import { googleDriveToken } from './googleAuth.js';
import { loadReimbursementRecords } from './reimbursementRecords.js';
let allowedCache;
async function allowedFiles() {
  if (allowedCache?.expires > Date.now()) return allowedCache.ids;
  const records=await loadReimbursementRecords();
  const ids = new Set();
  for (const record of records) {
    for (const field of ['url_boarding_pass', 'url_bukti_cuti', 'url_nota_berangkat', 'url_nota_pulang']) {
      for (const match of record[field].matchAll(/(?:[?&]id=|\/d\/)([\w-]+)/g)) ids.add(match[1]);
    }
  }
  allowedCache = { ids, expires: Date.now() + 60000 };
  return ids;
}

export function registerReimbursementAttachments(app, authenticate) {
  // Only signed-in application users and files referenced by reimbursement rows.
  app.get('/api/reimbursements/attachment/:id', authenticate, async (req, res) => {
    try {
      const id = req.params.id;
      if (!/^[\w-]{10,200}$/.test(id) || !(await allowedFiles()).has(id)) {
        return res.status(403).json({ error: 'Berkas tidak tercantum pada spreadsheet reimbursement.' });
      }
      const token = await googleDriveToken();
      const resourceKey = /^[\w-]+$/.test(req.query.resourcekey || '') ? req.query.resourcekey : '';
      const url = token
        ? `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`
        : `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t&resourcekey=${resourceKey}`;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      if (resourceKey && token) headers['X-Goog-Drive-Resource-Keys'] = `${id}/${resourceKey}`;
      let response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
      let type = (response.headers.get('content-type') || '').split(';')[0];
      if (token && !response.ok) {
        const upstream = await response.json().catch(() => ({}));
        const reasons = upstream.error?.errors?.map(error => error.reason) || [];
        if (reasons.includes('accessNotConfigured') || upstream.error?.details?.some(detail => detail.reason === 'SERVICE_DISABLED')) {
          return res.status(503).json({ error: 'Google Drive API belum aktif pada proyek service account. Aktifkan Google Drive API di Google Cloud Console, lalu coba ekspor kembali.' });
        }
        // Fallback: If service account gets 404 (file in personal Drive not shared with SA) or 403, try public direct download
        if (response.status === 404 || response.status === 403) {
          const publicUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t&resourcekey=${resourceKey}`;
          const fallbackRes = await fetch(publicUrl, { signal: AbortSignal.timeout(30000) });
          const fallbackType = (fallbackRes.headers.get('content-type') || '').split(';')[0];
          if (fallbackRes.ok && ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/octet-stream'].includes(fallbackType)) {
            response = fallbackRes;
            type = fallbackType;
          }
        }
      }
      if (!response.ok || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/octet-stream'].includes(type)) {
        return res.status(422).json({ error: 'Lampiran Drive tidak dapat dibaca. Bagikan berkas kepada service account aplikasi atau aktifkan akses pembaca melalui tautan.' });
      }
      // Bound downloads, including responses without Content-Length.
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 30 * 1024 * 1024) throw new Error('Lampiran melebihi batas 30 MB.');
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      const isPdf = bytes.subarray(0, 5).toString() === '%PDF-';
      const isJpg = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
      const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const isGif = bytes.length >= 3 && bytes.subarray(0, 3).toString() === 'GIF';
      const isWebp = bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
      const isFtyp = bytes.length >= 12 && bytes.subarray(4, 8).toString() === 'ftyp';

      if (!isPdf && !isJpg && !isPng && !isGif && !isWebp && !isFtyp) {
        throw new Error('Respons Drive bukan PDF atau gambar yang valid.');
      }

      let detectedType = type;
      if (!detectedType || detectedType === 'application/octet-stream') {
        if (isPdf) detectedType = 'application/pdf';
        else if (isJpg) detectedType = 'image/jpeg';
        else if (isPng) detectedType = 'image/png';
        else if (isWebp) detectedType = 'image/webp';
        else if (isGif) detectedType = 'image/gif';
      }

      res.set({ 'Content-Type': detectedType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.send(bytes);
    } catch (error) {
      return res.status(502).json({ error: error.message });
    }
  });
}
