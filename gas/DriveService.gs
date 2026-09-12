/**
 * ============================================================================
 * DRIVE SERVICE
 * Mengelola upload file ke Google Drive (Lampiran Kontrak, Bukti, dll)
 * ============================================================================
 */

/**
 * Konfigurasi ID Folder utama untuk aplikasi ini.
 * Pastikan untuk mengganti ID Folder ini dengan ID Folder Google Drive yang sebenarnya
 * (di mana file-file attachment akan disimpan).
 * Alternatifnya, simpan di Script Properties.
 */
const GET_DRIVE_FOLDER_ID = () => {
  return PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID') || ''; 
};

/**
 * Membuat sub-folder jika belum ada, atau mengambil yang sudah ada
 */
function getOrCreateSubFolder(parentFolder, subFolderName) {
  const folders = parentFolder.getFoldersByName(subFolderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(subFolderName);
}

/**
 * Mengunggah file (dari base64) ke Google Drive
 * @param {string} base64Data - String base64 dari file (termasuk MimeType data URI prefix atau tidak)
 * @param {string} fileName - Nama file yang diinginkan
 * @param {string} moduleName - Nama modul (misalnya 'VendorContracts', 'Keluhan') untuk subfolder
 * @returns {string} URL publik/view dari file yang diupload
 */
function uploadFileToDrive(base64Data, fileName, moduleName) {
  try {
    const parentFolderId = GET_DRIVE_FOLDER_ID();
    if (!parentFolderId) {
      throw new Error("DRIVE_FOLDER_ID belum dikonfigurasi di Script Properties.");
    }

    const parentFolder = DriveApp.getFolderById(parentFolderId);
    const subFolder = getOrCreateSubFolder(parentFolder, moduleName || 'General');

    let blob;
    if (typeof base64Data === 'string') {
      let data = base64Data;
      let mimeType = 'application/octet-stream';
      
      if (base64Data.indexOf('data:') === 0 && base64Data.indexOf('base64,') !== -1) {
        const parts = base64Data.split('base64,');
        mimeType = parts[0].replace('data:', '').replace(';', '');
        data = parts[1];
      }
      blob = Utilities.newBlob(Utilities.base64Decode(data), mimeType, fileName);
    } else {
      // It's already a Blob (from multipart/form-data)
      blob = base64Data;
      blob.setName(fileName);
    }
    
    const file = subFolder.createFile(blob);
    
    // Opsional: Set file sharing agar siapa saja yang memiliki link dapat melihat
    // Dibungkus try-catch karena beberapa Google Workspace perusahaan memblokir fitur ANYONE_WITH_LINK
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log("Peringatan: Gagal mengatur sharing file ke publik (kemungkinan dibatasi oleh Workspace Admin). URL tetap akan disimpan.");
    }
    
    return file.getUrl(); // Mengembalikan URL view file
  } catch (err) {
    Logger.log("Error upload file to drive: " + err.message);
    throw new Error("Gagal mengunggah lampiran: " + err.message);
  }
}

/**
 * Mengunduh file dari Google Drive sebagai Base64
 * Digunakan untuk mem-bypass masalah CORS saat memuat PDF di frontend
 */
function downloadFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const size = file.getSize();
    // Jika file lebih besar dari 10MB, hindari base64 decode di memory GAS untuk mencegah OOM / timeout
    if (size > 10 * 1024 * 1024) {
      return { 
        ok: false, 
        error: 'FILE_TOO_LARGE', 
        message: 'Ukuran file terlalu besar (' + Math.round(size / 1024 / 1024) + 'MB). Gunakan preview Google Drive.',
        previewUrl: file.getUrl()
      };
    }
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    return { ok: true, data: base64, mimeType: blob.getContentType() };
  } catch (err) {
    Logger.log("Error download file: " + err.message);
    return { ok: false, error: err.message };
  }
}
