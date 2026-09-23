import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { query, pool, testConnection, CONNECTION_MODES, currentMode } from './db.js';
import { createSessionToken, verifySessionToken, authenticateToken, requireRole, hashPassword, verifyPassword } from './auth.js';
import { uploadDirectToDrive, validateFileMagicBytes, sanitizeFileName } from './drive.js';
import { sendWhatsAppMessage, checkExpiringContractsAndNotify, notifyInvoiceStatusUpdate, notifyNewTicketOrder } from './notifications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

// Multer memory storage (5MB max)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  storage: multer.memoryStorage()
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.resolve(__dirname, '../public/uploads')));

// ====================================================================
// HEALTH & DIAGNOSTIC ENDPOINTS
// ====================================================================

app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: dbStatus.success ? 'online' : 'offline',
    system: 'GA Core API Server',
    databaseEngine: 'PostgreSQL 16',
    activeMode: dbStatus.mode || currentMode,
    pingMs: dbStatus.pingMs,
    version: dbStatus.version,
    databaseName: dbStatus.database,
    user: dbStatus.user,
    port: dbStatus.port,
    error: dbStatus.error || null,
  });
});

app.get('/api/modes', (req, res) => {
  res.json({
    availableModes: [
      {
        id: CONNECTION_MODES.TRANSACTION,
        name: 'Transaction Pooler (Port 6543 / PgBouncer)',
        recommendedFor: 'Web App Runtime / Operasional Harian',
        description: 'Paling bagus & tahan lonjakan trafik. Menggunakan koneksi hanya saat query aktif.',
        isCurrent: currentMode === CONNECTION_MODES.TRANSACTION
      },
      {
        id: CONNECTION_MODES.SESSION,
        name: 'Session Pooler (Port 5432 / PgBouncer)',
        recommendedFor: 'Background Tasks / Prepared Statements',
        description: 'Menahan satu koneksi per sesi client.',
        isCurrent: currentMode === CONNECTION_MODES.SESSION
      },
      {
        id: CONNECTION_MODES.DIRECT,
        name: 'Direct Session (Port 5432 Direct Engine)',
        recommendedFor: 'DDL Schema Migrations / DBeaver / pgAdmin',
        description: 'Koneksi langsung tanpa pooler, akses penuh ke semua fitur DDL.',
        isCurrent: currentMode === CONNECTION_MODES.DIRECT
      }
    ],
    currentMode
  });
});

// ====================================================================
// MODUL BHP MESS API (POSTGRESQL 16)
// ====================================================================

// Ambil seluruh data BHP (Katalog, Parameter, Pemakaian, Stok Masuk, Transfer, Opname, Forecast, PDF History)
app.get('/api/bhp/data', async (req, res) => {
  try {
    const itemsRes = await query('SELECT * FROM bhp_items WHERE is_active = TRUE ORDER BY id ASC;');
    const paramsRes = await query('SELECT * FROM bhp_site_params;');
    const initialStocksRes = await query('SELECT * FROM bhp_initial_stocks;');
    const usageRes = await query('SELECT * FROM bhp_usage ORDER BY date DESC, id DESC LIMIT 500;');
    const stockInRes = await query('SELECT * FROM bhp_stock_in ORDER BY date DESC, id DESC LIMIT 200;');
    const transfersRes = await query('SELECT * FROM bhp_transfers ORDER BY date DESC, id DESC LIMIT 200;');
    const opnamesRes = await query('SELECT * FROM bhp_opnames ORDER BY date DESC, id DESC LIMIT 200;');
    const forecastsRes = await query('SELECT * FROM bhp_forecasts ORDER BY created_at DESC LIMIT 100;');
    const evaluationsRes = await query('SELECT * FROM bhp_evaluations ORDER BY evaluated_at DESC LIMIT 100;');
    const pdfHistoryRes = await query('SELECT * FROM bhp_pdf_history ORDER BY download_date DESC LIMIT 50;');

    // Map initial stocks & site params per site
    const initialStockMap = { LBCT: {}, IDMG: {}, SPCT: {} };
    initialStocksRes.rows.forEach(r => {
      if (initialStockMap[r.site]) {
        initialStockMap[r.site][r.item_code] = r.qty;
      }
    });

    const siteParamsMap = { LBCT: {}, IDMG: {}, SPCT: {} };
    paramsRes.rows.forEach(r => {
      if (siteParamsMap[r.site]) {
        siteParamsMap[r.site][r.item_code] = {
          safetyPct: Number(r.safety_pct),
          avgDailyUsage: Number(r.avg_daily_usage),
        };
      }
    });

    res.json({
      success: true,
      data: {
        items: itemsRes.rows,
        initialStock: initialStockMap,
        siteParams: siteParamsMap,
        usageHistory: usageRes.rows,
        stockInHistory: stockInRes.rows,
        transferHistory: transfersRes.rows,
        opnameHistory: opnamesRes.rows,
        forecastHistory: forecastsRes.rows,
        evaluationHistory: evaluationsRes.rows,
        pdfHistory: pdfHistoryRes.rows,
      }
    });
  } catch (err) {
    console.error('Error fetching BHP data:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simpan Pemakaian Harian (Bisa batch array dari multi-item)
app.post('/api/bhp/usage', async (req, res) => {
  try {
    const { entries, picName, site, date } = req.body;
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ success: false, error: 'Format entries harus berupa array' });
    }

    const inserted = [];
    for (const item of entries) {
      if (!item.itemCode || item.qty === undefined || Number(item.qty) <= 0) continue;
      const result = await query(
        `INSERT INTO bhp_usage (date, site, item_code, qty, pic_name, is_anomaly, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *;`,
        [
          date || new Date().toISOString().split('T')[0],
          site,
          item.itemCode,
          Number(item.qty),
          picName || 'PIC Lapangan',
          Boolean(item.isAnomaly),
          item.notes || null
        ]
      );
      inserted.push(result.rows[0]);
    }

    res.json({ success: true, count: inserted.length, data: inserted });
  } catch (err) {
    console.error('Error saving BHP usage:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simpan Barang Masuk W5
app.post('/api/bhp/stock-in', async (req, res) => {
  try {
    const { date, site, itemCode, qty, refPo, conditionStatus, receiverName, notes } = req.body;
    const result = await query(
      `INSERT INTO bhp_stock_in (date, site, item_code, qty, ref_po, condition_status, receiver_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *;`,
      [date, site, itemCode, Number(qty), refPo || null, conditionStatus || 'Lengkap', receiverName || 'GA/PIC', notes || null]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error saving stock in:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simpan Transfer Antar Site
app.post('/api/bhp/transfer', async (req, res) => {
  try {
    const { date, itemCode, qty, fromSite, toSite, reason, picName } = req.body;
    if (fromSite === toSite) {
      return res.status(400).json({ success: false, error: 'Site asal dan site tujuan tidak boleh sama' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'Alasan transfer wajib diisi' });
    }

    const result = await query(
      `INSERT INTO bhp_transfers (date, item_code, qty, from_site, to_site, reason, pic_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [date, itemCode, Number(qty), fromSite, toSite, reason, picName || 'GA Admin']
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error saving transfer:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simpan Stock Opname
app.post('/api/bhp/opname', async (req, res) => {
  try {
    const { date, site, itemCode, systemQty, physicalQty, reason, picName } = req.body;
    const diff = Number(physicalQty) - Number(systemQty);
    if (diff !== 0 && (!reason || !reason.trim())) {
      return res.status(400).json({ success: false, error: 'Alasan wajib diisi jika terdapat selisih fisik dan sistem' });
    }

    const result = await query(
      `INSERT INTO bhp_opnames (date, site, item_code, system_qty, physical_qty, reason, pic_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [date, site, itemCode, Number(systemQty), Number(physicalQty), reason || null, picName || 'PIC Lapangan']
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error saving opname:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simpan Riwayat Unduhan PDF Resmi (Audit Dua Tanda Tangan)
app.post('/api/bhp/pdf-history', async (req, res) => {
  try {
    const { docType, period, siteCovered, createdBy, approvedBy, notes } = req.body;
    if (!createdBy || !approvedBy) {
      return res.status(400).json({ success: false, error: 'Nama GA Admin dan GA GL wajib diisi' });
    }

    const result = await query(
      `INSERT INTO bhp_pdf_history (doc_type, period, site_covered, created_by, approved_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *;`,
      [docType, period, siteCovered, createdBy, approvedBy, notes || null]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error saving PDF history:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ====================================================================
// ADVANCED AUTHENTICATION & SESSION SECURITY (JWT + Fingerprint)
// ====================================================================

app.post('/api/auth/login', async (req, res) => {
  const { nik, password } = req.body;
  if (!nik) {
    return res.status(400).json({ ok: false, error: 'NIK wajib diisi' });
  }

  try {
    const result = await query(
      'SELECT id, nik, nama as name, email, password_hash, role, site, department FROM users WHERE (nik = $1 OR email = $1) AND is_active = TRUE;',
      [nik]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, error: 'NIK atau Password tidak ditemukan' });
    }

    const user = result.rows[0];
    const isPasswordValid = verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ ok: false, error: 'Password tidak sesuai' });
    }

    // Buat JWT Token kriptografis terikat device fingerprint
    const token = createSessionToken(user, req);

    // Hilangkan password_hash sebelum dikirim ke client
    delete user.password_hash;

    // Catat log audit login berhasil
    await query(
      `INSERT INTO audit_logs (user_id, user_nik, user_name, site, action, entity_type, ip_address, details)
       VALUES ($1, $2, $3, $4, 'LOGIN_SUCCESS', 'auth', $5, $6);`,
      [user.id, user.nik, user.name, user.site, req.ip, JSON.stringify({ userAgent: req.headers['user-agent'] })]
    );

    return res.json({
      ok: true,
      token,
      data: user,
      message: 'Login berhasil dengan proteksi sesi HMAC-SHA256'
    });
  } catch (err) {
    console.error('[Auth Error]:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ====================================================================
// DIRECT FILE UPLOAD ENDPOINT (100% BEBAS GAS & GOOGLE SPREADSHEET)
// ====================================================================

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    let buffer;
    let fileName = 'document.pdf';
    let mimeType = 'application/pdf';
    const moduleName = req.body.moduleName || req.body.module || 'General';

    if (req.file) {
      buffer = req.file.buffer;
      fileName = req.file.originalname;
      mimeType = req.file.mimetype;
    } else if (req.body.fileBase64 || req.body.fileData) {
      const raw = req.body.fileBase64 || req.body.fileData;
      fileName = req.body.fileName || 'file_' + Date.now() + '.pdf';
      if (raw.includes('base64,')) {
        const parts = raw.split('base64,');
        mimeType = parts[0].replace('data:', '').replace(';', '');
        buffer = Buffer.from(parts[1], 'base64');
      } else {
        buffer = Buffer.from(raw, 'base64');
      }
    } else {
      return res.status(400).json({ ok: false, error: 'Tidak ada berkas yang diunggah' });
    }

    const uploadResult = await uploadDirectToDrive(buffer, fileName, moduleName, mimeType);
    return res.json({
      ok: true,
      fileUrl: uploadResult.fileUrl,
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
      storage: uploadResult.storage
    });
  } catch (err) {
    console.error('[Upload Error]:', err.message);
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// ====================================================================
// CRON NOTIFICATION ENDPOINTS (AUTO REMINDER KONTRAK & WHATSAPP)
// ====================================================================

app.get('/api/cron/check-expiring', async (req, res) => {
  try {
    const summary = await checkExpiringContractsAndNotify();
    res.json({ ok: true, summary, executedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/notifications/whatsapp', async (req, res) => {
  const { target, message } = req.body;
  if (!target || !message) {
    return res.status(400).json({ ok: false, error: 'Target dan pesan wajib disertakan' });
  }
  const result = await sendWhatsAppMessage(target, message);
  res.json({ ok: true, result });
});

// ====================================================================
// UNIVERSAL GA CORE POSTGRESQL 16 DISPATCHER (100% Bebas Spreadsheet)
// ====================================================================

app.post('/api/action', async (req, res) => {
  const { action, payload, nik, password, id, data } = req.body;

  try {
    // 1. AUTH / LOGIN (DENGAN CRYPTOGRAPHIC JWT SIGNATURE)
    if (action === 'LOGIN') {
      const result = await query(
        'SELECT id, nik, nama as name, email, password_hash, role, site, department FROM users WHERE (nik = $1 OR email = $1) AND is_active = TRUE;',
        [nik]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ ok: false, error: 'NIK atau Password tidak sesuai' });
      }

      const user = result.rows[0];
      const isPasswordValid = verifyPassword(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ ok: false, error: 'Password tidak sesuai' });
      }

      const token = createSessionToken(user, req);
      delete user.password_hash;
      return res.json({ ok: true, data: user, token });
    }

    // 1.1 UPLOAD FILE LANGSUNG (100% TANPA GAS)
    if (action === 'UPLOAD_FILE') {
      const fileData = payload?.fileData || req.body.fileData;
      const fileName = payload?.fileName || req.body.fileName || 'berkas.pdf';
      const moduleName = payload?.moduleName || req.body.moduleName || 'General';

      if (!fileData) {
        return res.status(400).json({ ok: false, error: 'Data file tidak ditemukan' });
      }

      let buffer;
      let mimeType = 'application/pdf';
      if (fileData.includes('base64,')) {
        const parts = fileData.split('base64,');
        mimeType = parts[0].replace('data:', '').replace(';', '');
        buffer = Buffer.from(parts[1], 'base64');
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }

      const uploadResult = await uploadDirectToDrive(buffer, fileName, moduleName, mimeType);
      return res.json({
        ok: true,
        fileUrl: uploadResult.fileUrl,
        fileName: uploadResult.fileName,
        fileSize: uploadResult.fileSize,
        storage: uploadResult.storage
      });
    }

    // 2. USERS
    if (action === 'GET_USERS') {
      const result = await query('SELECT id, nik, nama as name, email, role, site, department, is_active FROM users ORDER BY id ASC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'CREATE_USER') {
      const u = payload || data || req.body;
      const result = await query(
        `INSERT INTO users (nik, nama, email, password_hash, role, site, department)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, nik, nama as name, email, role, site;`,
        [u.nik, u.name || u.nama, u.email || null, u.password || 'demo_hash_agm', u.role || 'pic_lapangan', u.site || 'ALL', u.department || 'GA']
      );
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'UPDATE_USER') {
      const u = payload || data || req.body;
      const targetId = id || u.id;
      const result = await query(
        `UPDATE users SET nama = COALESCE($1, nama), email = COALESCE($2, email), role = COALESCE($3, role), site = COALESCE($4, site), updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING id, nik, nama as name, email, role, site;`,
        [u.name || u.nama, u.email, u.role, u.site, targetId]
      );
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'DELETE_USER') {
      await query('DELETE FROM users WHERE id = $1;', [id]);
      return res.json({ ok: true });
    }

    // 3. INVOICES
    if (action === 'GET_INVOICES') {
      const result = await query('SELECT * FROM invoices ORDER BY created_at DESC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'CREATE_INVOICE') {
      const inv = payload?.data || data || req.body;
      const result = await query(
        `INSERT INTO invoices (invoice_number, vendor_name, category, period, site, amount, status, due_date, invoice_date, file_url, file_size_bytes, file_name, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (invoice_number) DO UPDATE
         SET vendor_name = EXCLUDED.vendor_name, amount = EXCLUDED.amount, status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
         RETURNING *;`,
        [inv.invoice_number || inv.invoiceNumber, inv.vendor_name || inv.vendorName, inv.category || 'General', inv.period, inv.site || 'ALL', Number(inv.amount) || 0, inv.status || 'Review GA', inv.due_date || inv.dueDate || null, inv.invoice_date || inv.invoiceDate || null, inv.file_url || inv.fileUrl || null, inv.file_size_bytes || inv.fileSizeBytes || 0, inv.file_name || inv.fileName || null, inv.notes || null]
      );
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'UPDATE_INVOICE') {
      const inv = payload?.data || data || req.body;
      const targetId = id || inv.id;
      const result = await query(
        `UPDATE invoices SET
           status = COALESCE($1, status),
           file_url = COALESCE($2, file_url),
           file_size_bytes = COALESCE($3, file_size_bytes),
           file_name = COALESCE($4, file_name),
           tracking_stages = COALESCE($5, tracking_stages),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 OR invoice_number = $7 RETURNING *;`,
        [inv.status || inv.status_pembayaran || null, inv.file_url || inv.fileUrl || null, inv.file_size_bytes || null, inv.file_name || null, inv.tracking_stages ? JSON.stringify(inv.tracking_stages) : null, isNaN(Number(targetId)) ? -1 : Number(targetId), String(targetId)]
      );
      return res.json({ ok: true, data: result.rows[0] || {} });
    }
    if (action === 'DELETE_INVOICE') {
      await query('DELETE FROM invoices WHERE id = $1 OR invoice_number = $2;', [isNaN(Number(id)) ? -1 : Number(id), String(id)]);
      return res.json({ ok: true });
    }

    // 4. TICKETING
    if (action === 'GET_TICKETING_RECORDS') {
      const result = await query('SELECT * FROM tickets ORDER BY departure_date DESC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'CREATE_TICKETING_RECORD') {
      const t = payload?.data || data || req.body;
      const result = await query(
        `INSERT INTO tickets (booking_code, ticket_number, nik, passenger_name, department, site, transport_type, route_from, route_to, departure_date, return_date, cost, status, attachment_url, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *;`,
        [t.booking_code, t.ticket_number, t.nik || '000', t.passenger_name || 'Penumpang', t.department, t.site, t.transport_type || 'Pesawat', t.route_from || 'BDJ', t.route_to || 'JKT', t.departure_date || new Date(), t.return_date || null, Number(t.cost) || 0, t.status || 'Issued', t.attachment_url || null, t.notes || null]
      );
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'BATCH_IMPORT_TICKETING') {
      const records = payload?.records || [];
      for (const t of records) {
        await query(
          `INSERT INTO tickets (booking_code, ticket_number, nik, passenger_name, department, site, transport_type, route_from, route_to, departure_date, return_date, cost, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
          [t.booking_code || null, t.ticket_number || null, t.nik || '000', t.passenger_name || 'Penumpang', t.department || 'GA', t.site || 'ALL', t.transport_type || 'Pesawat', t.route_from || 'BDJ', t.route_to || 'JKT', t.departure_date || new Date(), t.return_date || null, Number(t.cost) || 0, t.status || 'Issued']
        );
      }
      return res.json({ ok: true, count: records.length });
    }
    if (action === 'DELETE_TICKETING_RECORD') {
      await query('DELETE FROM tickets WHERE id = $1;', [id]);
      return res.json({ ok: true });
    }

    // 5. MESS MANAGEMENT
    if (action === 'GET_MESS_BUILDINGS') {
      const result = await query('SELECT * FROM mess_buildings ORDER BY id ASC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'CREATE_MESS_BUILDING') {
      const b = payload || data || req.body;
      const result = await query(
        `INSERT INTO mess_buildings (name, site, total_rooms, gender, status) VALUES ($1, $2, $3, $4, $5) RETURNING *;`,
        [b.name, b.site || 'LBCT', Number(b.total_rooms) || 0, b.gender || 'Male', b.status || 'Active']
      );
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'GET_MESS_STAYS') {
      const result = await query('SELECT * FROM mess_stays ORDER BY check_in DESC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'BATCH_UPDATE_STAYS') {
      return res.json({ ok: true, data: { success: true } });
    }

    // 6. ASSETS & CONTRACTS
    if (action === 'GET_VENDOR_CONTRACTS') {
      const result = await query('SELECT * FROM vendor_contracts ORDER BY end_date ASC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'CREATE_VENDOR_CONTRACT') {
      const vc = payload?.data || data || req.body;
      const result = await query(
        `INSERT INTO vendor_contracts (vendor_name, contract_number, service_type, site, start_date, end_date, contract_value, status, file_url, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;`,
        [vc.vendor_name, vc.contract_number, vc.service_type || 'General', vc.site || 'ALL', vc.start_date || new Date(), vc.end_date || new Date(), Number(vc.contract_value) || 0, vc.status || 'Active', vc.file_url || null, vc.notes || null]
      );
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'GET_UNIT_CONTRACTS') {
      const result = await query('SELECT * FROM unit_contracts ORDER BY end_date ASC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'CREATE_UNIT_CONTRACT') {
      const uc = payload?.data || data || req.body;
      const result = await query(
        `INSERT INTO unit_contracts (unit_code, unit_type, vendor_name, site, start_date, end_date, monthly_rate, status, file_url, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;`,
        [uc.unit_code, uc.unit_type, uc.vendor_name, uc.site || 'ALL', uc.start_date || new Date(), uc.end_date || new Date(), Number(uc.monthly_rate) || 0, uc.status || 'Active', uc.file_url || null, uc.notes || null]
      );
      return res.json({ ok: true, data: result.rows[0] });
    }

    // 7. STANDARDS (SOP / WI / FORMS)
    if (action === 'GET_STANDARDS' || action === 'GET_SOP_DOCUMENTS') {
      const result = await query('SELECT * FROM standards ORDER BY doc_code ASC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'CREATE_STANDARD' || action === 'SAVE_SOP_DOCUMENT') {
      const s = payload?.data || data || req.body;
      const result = await query(
        `INSERT INTO standards (doc_code, title, doc_type, department, revision_number, effective_date, file_url, file_size_bytes, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (doc_code) DO UPDATE
         SET title = EXCLUDED.title, file_url = COALESCE(EXCLUDED.file_url, standards.file_url), updated_at = CURRENT_TIMESTAMP
         RETURNING *;`,
        [s.doc_code || s.code, s.title, s.doc_type || 'SOP', s.department || 'GA', s.revision_number || 'Rev. 00', s.effective_date || null, s.file_url || s.fileUrl || null, s.file_size_bytes || 0, s.status || 'Active', s.notes || null]
      );
      return res.json({ ok: true, data: result.rows[0] });
    }

    // 8. CATERING
    if (action === 'GET_CATERING_VENDORS') {
      const result = await query('SELECT * FROM catering_vendors ORDER BY name ASC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'GET_CATERING_SCORINGS') {
      const result = await query('SELECT * FROM catering_scorings ORDER BY week_period DESC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'GET_CATERING_INCIDENTS') {
      const result = await query('SELECT * FROM catering_incidents ORDER BY date DESC;');
      return res.json({ ok: true, data: result.rows });
    }

    // 9. REIMBURSEMENTS
    if (action === 'GET_REIMBURSEMENTS') {
      const result = await query('SELECT * FROM reimbursements ORDER BY claim_date DESC;');
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'CREATE_REIMBURSEMENT') {
      const r = payload?.data || data || req.body;
      const result = await query(
        `INSERT INTO reimbursements (claim_number, employee_nik, employee_name, site, category, amount, status, claim_date, file_url, items, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;`,
        [r.claim_number, r.employee_nik, r.employee_name, r.site || 'LBCT', r.category || 'Transport', Number(r.amount) || 0, r.status || 'Submitted', r.claim_date || new Date(), r.file_url || null, JSON.stringify(r.items || []), r.notes || null]
      );
      return res.json({ ok: true, data: result.rows[0] });
    }

    // 10. EVENTS
    if (action === 'GET_EVENTS') {
      const result = await query('SELECT id, title, start_date as start, end_date as "end", all_day as "allDay", category, description FROM events ORDER BY start_date ASC;');
      return res.json({ ok: true, data: result.rows });
    }

    // 11. AUDIT LOGS
    if (action === 'GET_AUDIT_LOGS') {
      const result = await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500;');
      return res.json({ ok: true, data: result.rows });
    }

    // Default fallback: return ok
    return res.json({ ok: true, data: {} });
  } catch (err) {
    console.error(`[PG-Action-Error] ${action}:`, err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Start Server if not running on Vercel Serverless
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 GA Core PostgreSQL 16 Backend running on port ${PORT}`);
    console.log(`📡 Current DB Mode: [${currentMode.toUpperCase()}]`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
  });
}

export default app;
