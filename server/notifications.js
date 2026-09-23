import { query } from './db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FONNTE_TOKEN = process.env.FONNTE_TOKEN || '5CRBjxu7tyN4t2cM31vd';
const VENDOR_GROUP_ID = process.env.FONNTE_VENDOR_GROUP || '120363409992397705@g.us';
const UNIT_GROUP_ID = process.env.FONNTE_UNIT_GROUP || '120363430348999097@g.us';

/**
 * Kirim Pesan WhatsApp via Fonnte API
 */
export async function sendWhatsAppMessage(target, message) {
  if (!FONNTE_TOKEN || FONNTE_TOKEN === 'DUMMY_TOKEN') {
    console.log(`[WA-Mock] Target: ${target}\nPesan:\n${message}\n`);
    return { ok: true, mock: true };
  }

  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target, message })
    });
    const data = await res.json();
    console.log(`[WA-Fonnte] Sent to ${target}:`, data.status ? 'Berhasil' : data.reason || 'Gagal');
    return data;
  } catch (err) {
    console.error(`[WA-Fonnte Error] Target: ${target}:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Format tanggal Indonesia (DD MMM YYYY)
 */
function formatDateId(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Hitung selisih hari antara tanggal target dan hari ini
 */
function calculateDaysRemaining(targetDateStr) {
  const target = new Date(targetDateStr);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Job Scheduler: Pengecekan Kontrak & STNK Expiring (Dipindahkan dari GAS NotificationService)
 * Target peringatan: H-90 (3 bln), H-60 (2 bln), H-30 (1 bln), H-21 (3 mgg), H-14 (2 mgg), H-7 (1 mgg)
 */
export async function checkExpiringContractsAndNotify() {
  const targetDays = [90, 60, 30, 21, 14, 7];
  const vendorMessages = [];
  const unitMessages = [];

  console.log('[Notification Cron] Memeriksa tanggal berakhir kontrak di PostgreSQL 16...');

  try {
    // 1. Cek Kontrak Vendor di PostgreSQL 16
    const vendorRes = await query('SELECT * FROM vendor_contracts WHERE status = $1;', ['Active']);
    for (const v of vendorRes.rows) {
      if (!v.end_date) continue;
      const daysLeft = calculateDaysRemaining(v.end_date);

      if (targetDays.includes(daysLeft)) {
        let textLeft = `${daysLeft} Hari`;
        if (daysLeft === 90) textLeft = '3 Bulan';
        else if (daysLeft === 60) textLeft = '2 Bulan';
        else if (daysLeft === 30) textLeft = '1 Bulan';
        else if (daysLeft === 21) textLeft = '3 Minggu';
        else if (daysLeft === 14) textLeft = '2 Minggu';
        else if (daysLeft === 7) textLeft = '1 Minggu';

        vendorMessages.push(
          `⚠️ *Peringatan Kontrak Vendor (Sisa ${textLeft})*\n\n` +
          `• Vendor: ${v.vendor_name}\n` +
          `• No Kontrak: ${v.contract_number || '-'}\n` +
          `• Layanan: ${v.service_type || '-'}\n` +
          `• Site: ${v.site || 'ALL'}\n` +
          `• Berakhir Pada: ${formatDateId(v.end_date)}\n\n` +
          `Mohon tim GA segera melakukan evaluasi atau perpanjangan kontrak.`
        );
      }
    }

    // 2. Cek Kontrak Unit & STNK di PostgreSQL 16
    const unitRes = await query('SELECT * FROM unit_contracts WHERE status = $1;', ['Active']);
    for (const u of unitRes.rows) {
      if (!u.end_date) continue;
      const daysLeft = calculateDaysRemaining(u.end_date);

      if (targetDays.includes(daysLeft)) {
        let textLeft = `${daysLeft} Hari`;
        if (daysLeft === 90) textLeft = '3 Bulan';
        else if (daysLeft === 60) textLeft = '2 Bulan';
        else if (daysLeft === 30) textLeft = '1 Bulan';
        else if (daysLeft === 21) textLeft = '3 Minggu';
        else if (daysLeft === 14) textLeft = '2 Minggu';
        else if (daysLeft === 7) textLeft = '1 Minggu';

        unitMessages.push(
          `🚗 *Peringatan Masa Berlaku Unit / STNK (Sisa ${textLeft})*\n\n` +
          `• Kode Unit: ${u.unit_code}\n` +
          `• Jenis Unit: ${u.unit_type}\n` +
          `• Vendor: ${u.vendor_name || '-'}\n` +
          `• Site: ${u.site || 'ALL'}\n` +
          `• Berakhir Pada: ${formatDateId(u.end_date)}\n\n` +
          `Mohon segera tindak lanjuti perpanjangan masa berlaku unit.`
        );
      }
    }

    // Kirim rekap Vendor ke grup WhatsApp vendor
    if (vendorMessages.length > 0) {
      const msg = `🔔 *REKAP PENGINGAT KONTRAK VENDOR*\n\n` + vendorMessages.join('\n\n---\n\n');
      await sendWhatsAppMessage(VENDOR_GROUP_ID, msg);
    }

    // Kirim rekap Unit ke grup WhatsApp unit
    if (unitMessages.length > 0) {
      const msg = `🚗 *REKAP PENGINGAT MASA BERLAKU UNIT*\n\n` + unitMessages.join('\n\n---\n\n');
      await sendWhatsAppMessage(UNIT_GROUP_ID, msg);
    }

    return {
      success: true,
      vendorNotifsSent: vendorMessages.length,
      unitNotifsSent: unitMessages.length
    };
  } catch (err) {
    console.error('[Notification Cron Error]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Notifikasi Perubahan Status Invoice ke WhatsApp
 */
export async function notifyInvoiceStatusUpdate(invoiceNo, vendorName, status, targetNumber) {
  const target = targetNumber || process.env.FONNTE_INVOICE_NOTIF_TARGET || VENDOR_GROUP_ID;
  const msg = `📄 *UPDATE STATUS INVOICE*\n\n` +
              `• No Invoice: ${invoiceNo}\n` +
              `• Vendor: ${vendorName}\n` +
              `• Status Baru: *${status}*\n` +
              `• Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
              `Silakan cek detail invoice pada sistem GA Core.`;
  return await sendWhatsAppMessage(target, msg);
}

/**
 * Notifikasi Pengajuan Tiket Baru ke WhatsApp
 */
export async function notifyNewTicketOrder(ticketData) {
  const msg = `🎫 *PERMINTAAN TIKET PERJALANAN DINAS/CUTI*\n\n` +
              `• Nama Penumpang: ${ticketData.passenger_name}\n` +
              `• NIK: ${ticketData.nik}\n` +
              `• Rute: ${ticketData.route_from} ➔ ${ticketData.route_to}\n` +
              `• Tgl Berangkat: ${formatDateId(ticketData.departure_date)}\n` +
              (ticketData.return_date ? `• Tgl Pulang: ${formatDateId(ticketData.return_date)}\n` : '') +
              `• Jenis: ${ticketData.transport_type || 'Pesawat'}\n` +
              `• Status: Diajukan\n\n` +
              `Telah tercatat di database PostgreSQL 16 GA Core.`;
  return await sendWhatsAppMessage(UNIT_GROUP_ID, msg);
}
