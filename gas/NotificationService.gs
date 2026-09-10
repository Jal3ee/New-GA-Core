/**
 * ============================================================================
 * NOTIFICATION SERVICE (WhatsApp via Fonnte)
 * Mengelola pengecekan tanggal kontrak dan pengiriman notifikasi WA.
 * ============================================================================
 */

/**
 * Token Fonnte API dan Nomor Tujuan bisa disimpan di Script Properties.
 * Untuk sementara menggunakan token dummy jika tidak diset.
 */
const GET_FONNTE_TOKEN = () => {
  return PropertiesService.getScriptProperties().getProperty('FONNTE_TOKEN') || 'DUMMY_TOKEN';
};

const GET_TARGET_WA_NUMBERS = () => {
  // Bisa berupa nomor tunggal (misal: "08123456789") atau koma separated ("0812...,0813...")
  return PropertiesService.getScriptProperties().getProperty('FONNTE_TARGET_NUMBER') || '081234567890';
};

/**
 * Mengirim pesan teks ke WhatsApp via Fonnte API
 */
function sendWhatsAppMessage(target, message) {
  const token = GET_FONNTE_TOKEN();
  if (token === 'DUMMY_TOKEN') {
    Logger.log(`[DUMMY WA] To: ${target} | Msg: ${message}`);
    return;
  }
  
  const payload = {
    target: target,
    message: message
  };

  const options = {
    method: 'post',
    headers: {
      'Authorization': token
    },
    payload: payload,
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://api.fonnte.com/send', options);
    Logger.log('Fonnte Response: ' + response.getContentText());
  } catch (err) {
    Logger.log('Gagal mengirim WA: ' + err.message);
  }
}

/**
 * UTILITY: Fungsi untuk melakukan tes kirim pesan ke grup vendor.
 * Jalankan ini secara manual dari Apps Script Editor untuk memastikan koneksi Fonnte ke Grup berhasil.
 */
function testSendToGroup() {
  const VENDOR_GROUP_ID = '120363409992397705@g.us';
  const dummyMessage = "🤖 *TEST BOT FONNTE*\n\nHalo! Ini adalah pesan uji coba (dummy) dari sistem Google Apps Script. Jika Anda melihat pesan ini, berarti koneksi Fonnte ke grup ini telah berhasil!";
  
  Logger.log("Mencoba mengirim pesan test ke grup: " + VENDOR_GROUP_ID);
  sendWhatsAppMessage(VENDOR_GROUP_ID, dummyMessage);
  Logger.log("Selesai mencoba kirim.");
}

/**
 * UTILITY: Fungsi untuk melakukan tes kirim pesan ke grup Unit STNK.
 * Jalankan ini secara manual dari Apps Script Editor.
 */
function testSendToUnitGroup() {
  const UNIT_GROUP_ID = '120363430348999097@g.us';
  const dummyMessage = "🤖 *TEST BOT FONNTE - STNK UNIT*\n\n🚗 *Peringatan Masa Berlaku STNK Unit (Sisa 30 Hari)*\n\nUnit Asset: PT.AGM\nNo Lambung: LV-099\nNo Polisi: B 1234 CD\nSTNK Berakhir: 15 Okt 2026\n\nMohon segera lakukan perpanjangan STNK unit.";
  
  Logger.log("Mencoba mengirim pesan test STNK Unit ke grup: " + UNIT_GROUP_ID);
  sendWhatsAppMessage(UNIT_GROUP_ID, dummyMessage);
  Logger.log("Selesai mencoba kirim STNK Unit.");
}

/**
 * Menghitung selisih hari antara 2 tanggal (Date object)
 */
function daysBetween(date1, date2) {
  // Hapus jam, menit, detik
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffTime = d1 - d2;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Fungsi Utama: Cek Kontrak Berakhir dan Kirim WA
 * Disarankan untuk di-trigger setiap hari pada jam 08:00 pagi (Time-driven trigger).
 */
function checkExpiringContractsAndNotify() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const targetNumbers = GET_TARGET_WA_NUMBERS();
  const today = new Date();
  
  // Tentukan target hari pengingat
  const targetDays = [90, 60, 30, 21, 14, 7]; // 3 bln, 2 bln, 1 bln, 3 mgg, 2 mgg, 1 mgg
  let vendorMessages = [];
  let unitMessages = [];
  
  const VENDOR_GROUP_ID = '120363409992397705@g.us'; // Target grup spesifik untuk vendor

  // --- 1. Cek Kontrak Vendor ---
  const vendorSheet = ss.getSheetByName('tbl_assets_vendor_contracts');
  if (vendorSheet) {
    const vendorData = vendorSheet.getDataRange().getValues();
    const headers = vendorData[0];
    const endKontrakIdx = headers.indexOf('end_kontrak');
    const namaVendorIdx = headers.indexOf('nama_vendor');
    const noKontrakIdx = headers.indexOf('no_kontrak');
    const siteIdx = headers.indexOf('site');

    if (endKontrakIdx > -1) {
      for (let i = 1; i < vendorData.length; i++) {
        const row = vendorData[i];
        if (!row[endKontrakIdx]) continue;
        
        const endDate = new Date(row[endKontrakIdx]);
        if (isNaN(endDate.getTime())) continue; // Skip jika format invalid
        
        const sisaHari = daysBetween(endDate, today);
        
        if (targetDays.includes(sisaHari)) {
          let sisaTeks = sisaHari + " hari";
          if (sisaHari === 90) sisaTeks = "3 Bulan";
          else if (sisaHari === 60) sisaTeks = "2 Bulan";
          else if (sisaHari === 30) sisaTeks = "1 Bulan";
          else if (sisaHari === 21) sisaTeks = "3 Minggu";
          else if (sisaHari === 14) sisaTeks = "2 Minggu";
          else if (sisaHari === 7) sisaTeks = "1 Minggu";

          vendorMessages.push(
            `⚠️ *Peringatan Kontrak Vendor (Sisa ${sisaTeks})*\n\n` +
            `Vendor: ${row[namaVendorIdx]}\n` +
            `No Kontrak: ${row[noKontrakIdx]}\n` +
            `Site: ${row[siteIdx]}\n` +
            `Berakhir Pada: ${Utilities.formatDate(endDate, "GMT+8", "dd MMM yyyy")}\n` +
            `\nMohon segera lakukan evaluasi atau perpanjangan.`
          );
        }
      }
    }
  }

  // --- 2. Cek STNK Unit Internal ---
  const UNIT_GROUP_ID = '120363430348999097@g.us'; // Target grup spesifik untuk Unit
  const unitSheet = ss.getSheetByName('tbl_assets_unit_contracts');
  if (unitSheet) {
    const unitData = unitSheet.getDataRange().getValues();
    const headers = unitData[0];
    const stnkEndIdx = headers.indexOf('stnk_end');
    const unitAssetIdx = headers.indexOf('unit_asset');
    const noPolisiIdx = headers.indexOf('no_polisi');
    const noLambungIdx = headers.indexOf('no_lambung');

    if (stnkEndIdx > -1) {
      for (let i = 1; i < unitData.length; i++) {
        const row = unitData[i];
        if (!row[stnkEndIdx]) continue;
        
        const endDate = new Date(row[stnkEndIdx]);
        if (isNaN(endDate.getTime())) continue;
        
        const sisaHari = daysBetween(endDate, today);
        
        if (targetDays.includes(sisaHari)) {
          let sisaTeks = sisaHari + " hari";
          if (sisaHari === 90) sisaTeks = "3 Bulan";
          else if (sisaHari === 60) sisaTeks = "2 Bulan";
          else if (sisaHari === 30) sisaTeks = "1 Bulan";
          else if (sisaHari === 21) sisaTeks = "3 Minggu";
          else if (sisaHari === 14) sisaTeks = "2 Minggu";
          else if (sisaHari === 7) sisaTeks = "1 Minggu";

          unitMessages.push(
            `🚗 *Peringatan Masa Berlaku STNK Unit (Sisa ${sisaTeks})*\n\n` +
            `Unit Asset: ${row[unitAssetIdx]}\n` +
            `No Lambung: ${row[noLambungIdx]}\n` +
            `No Polisi: ${row[noPolisiIdx]}\n` +
            `STNK Berakhir: ${Utilities.formatDate(endDate, "GMT+8", "dd MMM yyyy")}\n` +
            `\nMohon segera lakukan perpanjangan STNK unit.`
          );
        }
      }
    }
  }

  // Kirim peringatan Vendor ke grup spesifik
  if (vendorMessages.length > 0) {
    const combinedVendorMessage = "🔔 *REKAP PENGINGAT KONTRAK VENDOR*\n\n" + vendorMessages.join("\n\n---\n\n");
    sendWhatsAppMessage(VENDOR_GROUP_ID, combinedVendorMessage);
    Logger.log("Pesan vendor berhasil dikirim ke grup: " + VENDOR_GROUP_ID);
  } else {
    Logger.log("Tidak ada kontrak vendor yang expiring pada target hari ini.");
  }

  // Kirim peringatan Unit ke grup spesifik
  if (unitMessages.length > 0) {
    const combinedUnitMessage = "🚗 *REKAP PENGINGAT STNK UNIT*\n\n" + unitMessages.join("\n\n---\n\n");
    sendWhatsAppMessage(UNIT_GROUP_ID, combinedUnitMessage);
    Logger.log("Pesan unit berhasil dikirim ke grup: " + UNIT_GROUP_ID);
  } else {
    Logger.log("Tidak ada STNK unit yang expiring pada target hari ini.");
  }
}
