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
  return PropertiesService.getScriptProperties().getProperty('FONNTE_TOKEN') || '5CRBjxu7tyN4t2cM31vd';
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
  if (!token || token === 'DUMMY_TOKEN') {
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

/**
 * ============================================================================
 * GOOGLE FORM SUBMIT TRIGGER (WHATSAPP NOTIFICATION)
 * ============================================================================
 */

/**
 * Fungsi ini dipanggil secara otomatis setiap kali ada form yang di-submit
 * @param {Object} e Event object dari onFormSubmit
 */
function onFormSubmit(e) {
  try {
    const values = e.values;
    if (!values || values.length < 2) return; 
    
    const TARGET_GROUP_ID = '120363430348999097@g.us';
    
    // Index 1: "Silahkan pilih kebutuhan yang diperlukan"
    const keperluan = values[1] || '';
    let message = '';
    
    const val = (index) => values[index] ? values[index].trim() : '-';

    if (keperluan.toLowerCase().includes('order tiket')) {
      message = `🎫 *PERMINTAAN ORDER TIKET BARU* 🎫\n\n` +
                `*Nama:* ${val(2)}\n` +
                `*NIK:* ${val(3)}\n` +
                `*No HP:* ${val(4)}\n` +
                `*Status:* ${val(5)}\n` +
                `*Site:* ${val(6)}\n` +
                `*Departemen:* ${val(7)}\n\n` +
                `*Tgl Keberangkatan:* ${val(10)}\n` +
                `*Rute Keberangkatan:* ${val(11)}\n` +
                `*Maskapai Berangkat:* ${val(12)}\n\n` +
                `*Tgl Kepulangan:* ${val(13)}\n` +
                `*Rute Kepulangan:* ${val(14)}\n` +
                `*Maskapai Pulang:* ${val(15)}\n\n` + 
                `*Lokasi Penjemputan:* ${val(16)}\n` +
                `*Catatan:* ${val(17)}\n`;
                
    } else if (keperluan.toLowerCase().includes('reimbursement')) {
      message = `💰 *INFO REIMBURSEMENT BARU* 💰\n\n` +
                `*Nama:* ${val(18)}\n` +
                `*NIK:* ${val(19)}\n` +
                `*No HP:* ${val(20)}\n` +
                `*Status:* ${val(21)}\n` +
                `*Departemen:* ${val(22)}\n`;
                
    } else if (keperluan.toLowerCase().includes('unit service')) {
      message = `🔧 *PERMINTAAN UNIT SERVICE BARU* 🔧\n\n` +
                `*Nama:* ${val(27)}\n` +
                `*NIK:* ${val(28)}\n` +
                `*No Lambung:* ${val(29)}\n` +
                `*No Polisi:* ${val(30)}\n` +
                `*Departemen:* ${val(31)}\n` +
                `*COA Dept:* ${val(32)}\n` +
                `*Sisa Budget:* ${val(33)}\n` +
                `*Site:* ${val(39)}\n` +
                `*Catatan:* ${val(34)}\n`;
    } else {
      message = `📝 *FORM BARU MASUK* 📝\n\n` +
                `Keperluan: ${keperluan}\n` +
                `Dikirim oleh: ${val(2) || val(18) || val(27)} (${val(3) || val(19) || val(28)})`;
    }

    const timestamp = values[0] || new Date().toLocaleString('id-ID');
    message += `\n_Waktu Submit: ${timestamp}_`;

    // Gunakan fungsi sendWhatsAppMessage yang sudah ada di atas
    sendWhatsAppMessage(TARGET_GROUP_ID, message);
    
  } catch (error) {
    Logger.log("Error onFormSubmit: " + error.toString());
  }
}

/**
 * JALANKAN FUNGSI INI SEKALI SAJA UNTUK MEMASANG TRIGGER
 */
function setupFormTrigger() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(sheet)
    .onFormSubmit()
    .create();
    
  Logger.log("Trigger Form WhatsApp berhasil dibuat!");
}

/**
 * ============================================================================
 * INVOICE FA GL & PAID NOTIFICATIONS
 * Target WhatsApp Group: 120363410250789471@g.us
 * ============================================================================
 */
const INVOICE_FA_GL_PAID_GROUP_ID = '120363410250789471@g.us';

/**
 * Memeriksa perubahan status invoice (apakah mencapai FA GL atau status Paid)
 * dan mengirimkan notifikasi resmi ke grup WA tujuan.
 * @param {Object} before Objek baris invoice sebelum update (bisa null jika create)
 * @param {Object} after Objek baris invoice setelah update
 */
function checkAndNotifyInvoiceStatus(before, after) {
  if (!after) return;
  const targetGroup = INVOICE_FA_GL_PAID_GROUP_ID;

  const formatRupiah = (val) => {
    if (!val) return 'Rp 0';
    if (typeof val === 'number') {
      return 'Rp ' + val.toLocaleString('id-ID');
    }
    const num = String(val).replace(/\D/g, '');
    return num ? 'Rp ' + Number(num).toLocaleString('id-ID') : String(val);
  };

  const formatDateStr = (d) => {
    if (!d) return '-';
    try {
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return String(d);
      return Utilities.formatDate(dateObj, "GMT+8", "dd MMM yyyy");
    } catch(e) {
      return String(d);
    }
  };

  const vendorName = after.vendor || '-';
  const siteName = after.site || '-';
  const invoiceNilai = formatRupiah(after.nilai);
  const invoiceId = after.id || '-';
  const periode = (after.periode_start && after.periode_end) 
    ? `${formatDateStr(after.periode_start)} s/d ${formatDateStr(after.periode_end)}` 
    : (after.tgl_berkas ? formatDateStr(after.tgl_berkas) : '-');

  // Trigger 1: FA GL tercapai / terisi baru
  const isNewlyFaGl = Boolean(after.tracking_fa_gl) && (!before || !before.tracking_fa_gl);

  // Trigger 2: Status pembayaran menjadi PAID
  const isNewlyPaid = String(after.status_pembayaran || '').toLowerCase() === 'paid' && 
                      (!before || String(before.status_pembayaran || '').toLowerCase() !== 'paid');

  // Skenario 1: FA GL sekaligus PAID dalam 1 kali update
  if (isNewlyPaid && isNewlyFaGl) {
    const paidDate = after.updated_at ? formatDateStr(after.updated_at) : formatDateStr(new Date());
    const message = 
      `🎉 *INVOICE: SELESAI FA GL & TELAH DIBAYAR (PAID)* 🎉\n\n` +
      `*Vendor:* ${vendorName}\n` +
      `*Site:* Site ${siteName}\n` +
      `*Nilai Tagihan:* *${invoiceNilai}*\n` +
      `*ID Berkas:* ${invoiceId}\n` +
      `*Periode Berkas:* ${periode}\n` +
      `*Tanggal Masuk FA GL:* ${formatDateStr(after.tracking_fa_gl)}\n` +
      `*Status Pembayaran:* *PAID (LUNAS)*\n` +
      `*Waktu Update:* ${paidDate}\n\n` +
      `_Invoice telah diverifikasi FA GL dan pembayaran telah selesai diproses._\n` +
      `_Notifikasi Otomatis Sistem GA Core_`;

    sendWhatsAppMessage(targetGroup, message);
    Logger.log(`Notifikasi INVOICE FA GL & PAID dikirim ke ${targetGroup} untuk ${vendorName}`);
  } 
  // Skenario 2: Status baru berubah menjadi PAID
  else if (isNewlyPaid) {
    const paidDate = after.updated_at ? formatDateStr(after.updated_at) : formatDateStr(new Date());
    const message = 
      `💸 *INVOICE TELAH DIBAYAR (PAID)* 💸\n\n` +
      `*Vendor:* ${vendorName}\n` +
      `*Site:* Site ${siteName}\n` +
      `*Nilai Tagihan:* *${invoiceNilai}*\n` +
      `*ID Berkas:* ${invoiceId}\n` +
      `*Periode Berkas:* ${periode}\n` +
      `*Status Pembayaran:* *PAID (LUNAS)*\n` +
      `*Waktu Pembayaran:* ${paidDate}\n` +
      (after.tracking_fa_gl ? `*Tgl FA GL:* ${formatDateStr(after.tracking_fa_gl)}\n` : '') +
      `\n_Pembayaran tagihan invoice telah selesai diverifikasi oleh Finance & Accounting._\n` +
      `_Notifikasi Otomatis Sistem GA Core_`;

    sendWhatsAppMessage(targetGroup, message);
    Logger.log(`Notifikasi INVOICE PAID dikirim ke ${targetGroup} untuk ${vendorName}`);
  }
  // Skenario 3: Status baru sampai di tahap FA GL
  else if (isNewlyFaGl) {
    const tglFaGl = formatDateStr(after.tracking_fa_gl);
    const message = 
      `📋 *UPDATE INVOICE: TELAH SAMPAI DI FA GL* 📋\n\n` +
      `*Vendor:* ${vendorName}\n` +
      `*Site:* Site ${siteName}\n` +
      `*Nilai Tagihan:* *${invoiceNilai}*\n` +
      `*ID Berkas:* ${invoiceId}\n` +
      `*Periode Berkas:* ${periode}\n` +
      `*Tahap Verifikasi:* *FA GL (Finance & Accounting Group Leader)*\n` +
      `*Tanggal Terima FA GL:* ${tglFaGl}\n` +
      `*Status Pembayaran:* ${after.status_pembayaran || 'Open'}\n\n` +
      `_Dokumen invoice telah memasuki tahap verifikasi akhir FA GL untuk proses pembayaran._\n` +
      `_Notifikasi Otomatis Sistem GA Core_`;

    sendWhatsAppMessage(targetGroup, message);
    Logger.log(`Notifikasi INVOICE FA GL dikirim ke ${targetGroup} untuk ${vendorName}`);
  }
}

/**
 * Tes pengiriman notifikasi invoice ke grup WA FA GL / Paid
 */
function testSendInvoiceNotification() {
  const dummyInvoice = {
    id: 'INV-TEST-001',
    vendor: 'CV Sandaga Perkasa (TEST)',
    site: 'LBCT',
    nilai: 122418000,
    periode_start: '2026-01-01',
    periode_end: '2026-01-31',
    tgl_berkas: '2026-01-05',
    tracking_fa_gl: new Date().toISOString(),
    status_pembayaran: 'PAID',
    updated_at: new Date().toISOString()
  };

  Logger.log("Mengirim pesan uji coba invoice ke grup: " + INVOICE_FA_GL_PAID_GROUP_ID);
  checkAndNotifyInvoiceStatus(null, dummyInvoice);
  return { ok: true, message: "Pesan uji coba telah dikirim ke grup " + INVOICE_FA_GL_PAID_GROUP_ID };
}

/**
 * Trigger otomatis saat ada edit manual langsung di sheet tbl_docs_invoices
 */
function onInvoiceSheetEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (sheet.getName() !== 'tbl_docs_invoices') return;

    const row = e.range.getRow();
    if (row < 2) return; // Header row

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowValues = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
    
    const after = {};
    headers.forEach((h, idx) => { after[h] = rowValues[idx]; });

    const editedCol = e.range.getColumn();
    const editedHeader = headers[editedCol - 1];

    if (editedHeader === 'tracking_fa_gl' || editedHeader === 'status_pembayaran') {
      const before = { ...after };
      before[editedHeader] = e.oldValue || '';
      checkAndNotifyInvoiceStatus(before, after);
    }
  } catch (err) {
    Logger.log("Error onInvoiceSheetEdit: " + err.toString());
  }
}
