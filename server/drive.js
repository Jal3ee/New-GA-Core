import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB Maksimal

// Direktori lokal untuk berkas yang diunggah
const UPLOADS_DIR = path.resolve(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Validasi Magic Bytes (File Signature)
 * Mencegah file berbahaya (misal executable .exe yang di-rename jadi .pdf)
 */
export function validateFileMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;

  const hexHeader = buffer.subarray(0, 8).toString('hex').toLowerCase();

  // 1. PDF: %PDF- (25 50 44 46)
  if (hexHeader.startsWith('25504446')) {
    return { valid: true, type: 'pdf', mime: 'application/pdf' };
  }

  // 2. PNG: 89 50 4e 47 0d 0a 1a 0a
  if (hexHeader.startsWith('89504e470d0a1a0a')) {
    return { valid: true, type: 'png', mime: 'image/png' };
  }

  // 3. JPEG/JPG: ff d8 ff
  if (hexHeader.startsWith('ffd8ff')) {
    return { valid: true, type: 'jpg', mime: 'image/jpeg' };
  }

  // 4. Excel xlsx / docx / zip: 50 4b 03 04
  if (hexHeader.startsWith('504b0304')) {
    return { valid: true, type: 'document', mime: mimeType || 'application/octet-stream' };
  }

  return { valid: false, error: 'Tipe file tidak dikenal atau tidak diizinkan. Hanya PDF, JPG, PNG, dan Dokumen resmi yang diperbolehkan.' };
}

/**
 * Sanitisasi nama file untuk mencegah path traversal (../)
 */
export function sanitizeFileName(originalName) {
  const base = path.basename(originalName);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Upload file langsung ke Google Drive via Google Drive API v3 (OAuth2 / Service Account)
 * Jika service account belum dikonfigurasi, gunakan secure server storage dengan link permanen.
 */
export async function uploadDirectToDrive(buffer, originalFileName, moduleName = 'General', mimeType = 'application/pdf') {
  // 1. Validasi Ukuran (Maksimal 5MB)
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Ukuran file melebihi batas maksimal 5 MB (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
  }

  // 2. Validasi Magic Bytes Signature
  const signatureCheck = validateFileMagicBytes(buffer, mimeType);
  if (!signatureCheck.valid) {
    throw new Error(signatureCheck.error);
  }

  const cleanName = sanitizeFileName(originalFileName);
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 12);
  const uniqueFileName = `${Date.now()}_${fileHash}_${cleanName}`;

  // 3. Cek apakah ada Google Cloud Service Account Credentials untuk Drive API v3 langsung
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const folderId = process.env.DRIVE_FOLDER_ID;

  if (serviceAccountEmail && privateKey && folderId) {
    try {
      console.log(`[Google Drive API v3] Mengunggah file langsung ke Drive: ${cleanName}...`);
      const driveUrl = await uploadViaGoogleServiceAccount(buffer, uniqueFileName, mimeType, folderId, serviceAccountEmail, privateKey);
      return {
        success: true,
        storage: 'google_drive_v3',
        fileName: cleanName,
        fileSize: buffer.length,
        fileUrl: driveUrl
      };
    } catch (gErr) {
      console.warn('[Google Drive API v3] Gagal mengunggah ke Drive, beralih ke secure storage:', gErr.message);
    }
  }

  // 4. Default Secure Storage (Disimpan di public/uploads dengan link HTTPS langsung)
  const targetSubDir = path.join(UPLOADS_DIR, moduleName);
  if (!fs.existsSync(targetSubDir)) {
    fs.mkdirSync(targetSubDir, { recursive: true });
  }

  const filePath = path.join(targetSubDir, uniqueFileName);
  fs.writeFileSync(filePath, buffer);

  const publicUrl = `/uploads/${moduleName}/${uniqueFileName}`;
  console.log(`[Secure Storage] File berhasil disimpan: ${publicUrl}`);

  return {
    success: true,
    storage: 'system_secure_storage',
    fileName: cleanName,
    fileSize: buffer.length,
    fileUrl: publicUrl
  };
}

/**
 * Helper untuk mengunggah ke Google Drive API v3 via JWT Service Account
 */
async function uploadViaGoogleServiceAccount(buffer, fileName, mimeType, folderId, clientEmail, rawPrivateKey) {
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

  // 1. Buat JWT Grant untuk Google OAuth2 Token
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: 'RS256', typ: 'JWT' };
  const jwtClaim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = Buffer.from(JSON.stringify(jwtHeader)).toString('base64url');
  const encodedClaim = Buffer.from(JSON.stringify(jwtClaim)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(privateKey, 'base64url');
  const assertion = `${signatureInput}.${signature}`;

  // Request Access Token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('Gagal mendapatkan access token Google Drive: ' + (tokenData.error_description || tokenData.error));
  }

  // 2. Upload file multipart ke Drive API v3
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    parents: [folderId]
  };

  const multipartBody = Buffer.concat([
    Buffer.from(delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) + delimiter + `Content-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(closeDelimiter)
  ]);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });

  const uploadData = await uploadRes.json();
  if (uploadData.error) {
    throw new Error('Drive API error: ' + uploadData.error.message);
  }

  // Set file permissions agar can be viewed
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
  } catch {}

  return uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`;
}
