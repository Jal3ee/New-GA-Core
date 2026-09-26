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

// Normalizer middleware untuk Vercel Serverless Function rewrites
app.use((req, res, next) => {
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

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

// Simpan Logistik / Penerimaan Barang Masuk
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

// Helper pencatatan audit log otomatis (Zero over-engineering - Ponytail rule)
async function recordAuditLog(req, action, entityType, entityId, details) {
  try {
    let userNik = 'SYSTEM';
    let userName = 'System Automator';
    let userId = null;
    let site = 'ALL';

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const verified = verifySessionToken(authHeader.split(' ')[1]);
      if (verified && verified.valid && verified.user) {
        userNik = verified.user.nik || userNik;
        userName = verified.user.name || userName;
        userId = verified.user.id || null;
        site = verified.user.site || site;
      }
    }

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    await query(
      `INSERT INTO audit_logs (user_id, user_nik, user_name, site, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
      [userId, userNik, userName, site, action, entityType, String(entityId || ''), JSON.stringify(details || {}), String(ip).substring(0, 50)]
    );
  } catch (err) {
    console.warn('[Audit-Log-Error]:', err.message);
  }
}

// ====================================================================
// UNIVERSAL GA CORE POSTGRESQL 16 DISPATCHER (100% Bebas Spreadsheet)
// ====================================================================

app.post('/api/action', async (req, res) => {
  const { action, payload, nik, password, id, data } = req.body;

  try {
    // 1. AUTH / LOGIN (DENGAN CRYPTOGRAPHIC JWT SIGNATURE)
    if (action === 'LOGIN') {
      const result = await query(
        'SELECT id, nik, nama as name, email, password_hash, role, site, department, birthdate, is_active FROM users WHERE (nik = $1 OR email = $1) AND is_active = TRUE;',
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
      user.status = user.is_active ? 'Active' : 'Inactive';
      await recordAuditLog(req, 'LOGIN', 'Authentication', user.nik, { status: 'Success', nik: user.nik });
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
      const result = await query(`
        SELECT id, nik, nama as name, email, role, site, department, birthdate, is_active,
               CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END as status
        FROM users 
        ORDER BY id ASC;
      `);
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'CREATE_USER') {
      const u = payload?.data || payload || data || req.body;
      const isActive = u.status ? (u.status === 'Active' || u.status === 'aktif') : (u.is_active !== false);
      const result = await query(
        `INSERT INTO users (nik, nama, email, password_hash, role, site, department, birthdate, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING id, nik, nama as name, email, role, site, department, birthdate, is_active,
                   CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END as status;`,
        [u.nik, u.name || u.nama, u.email || null, u.password || 'demo_hash_agm', u.role || 'Karyawan', u.site || 'ALL', u.department || 'General Affairs', u.birthdate || null, isActive]
      );
      await recordAuditLog(req, 'CREATE', 'User Management', result.rows[0].nik, { nik: u.nik, name: u.name || u.nama, role: u.role });
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'UPDATE_USER') {
      const u = payload?.data || payload || data || req.body;
      const targetId = id || u.id;
      const isActive = u.status ? (u.status === 'Active' || u.status === 'aktif') : (u.is_active !== undefined ? u.is_active : null);
      const result = await query(
        `UPDATE users 
         SET nama = COALESCE($1, nama), 
             email = COALESCE($2, email), 
             role = COALESCE($3, role), 
             site = COALESCE($4, site), 
             birthdate = COALESCE($5, birthdate),
             is_active = COALESCE($6, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 
         RETURNING id, nik, nama as name, email, role, site, department, birthdate, is_active,
                   CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END as status;`,
        [u.name || u.nama, u.email, u.role, u.site, u.birthdate, isActive, targetId]
      );
      await recordAuditLog(req, 'UPDATE', 'User Management', targetId, { role: u.role, site: u.site, status: u.status });
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'DELETE_USER') {
      const targetId = id || payload?.id || req.body.id;
      await query('DELETE FROM users WHERE id = $1;', [targetId]);
      await recordAuditLog(req, 'DELETE', 'User Management', targetId, { id: targetId });
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
      await recordAuditLog(req, 'CREATE', 'Invoices', result.rows[0].invoice_number, { invoice_number: inv.invoice_number || inv.invoiceNumber, vendor: inv.vendor_name, amount: inv.amount });
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
      await recordAuditLog(req, 'UPDATE', 'Invoices', targetId, { status: inv.status });
      return res.json({ ok: true, data: result.rows[0] || {} });
    }
    if (action === 'DELETE_INVOICE') {
      await query('DELETE FROM invoices WHERE id = $1 OR invoice_number = $2;', [isNaN(Number(id)) ? -1 : Number(id), String(id)]);
      await recordAuditLog(req, 'DELETE', 'Invoices', id, { id });
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
      await recordAuditLog(req, 'CREATE', 'Ticketing Records', result.rows[0].ticket_number || result.rows[0].booking_code, { passenger: t.passenger_name, cost: t.cost });
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
      await recordAuditLog(req, 'CREATE', 'Ticketing Records', 'import', { count: records.length });
      return res.json({ ok: true, count: records.length });
    }
    if (action === 'DELETE_TICKETING_RECORD') {
      await query('DELETE FROM tickets WHERE id = $1;', [id]);
      await recordAuditLog(req, 'DELETE', 'Ticketing Records', id, { id });
      return res.json({ ok: true });
    }

    // 5. MESS MANAGEMENT (BUILDINGS & ROOMS CONFIGURATION)
    if (action === 'GET_MESS_BUILDINGS') {
      const result = await query('SELECT * FROM mess_buildings ORDER BY id ASC;');
      return res.json({ ok: true, data: result.rows });
    }

    if (action === 'CREATE_MESS_BUILDING') {
      const b = payload?.data || payload || data || req.body;
      const rawConfig = b.room_config_json || b.room_config || [];
      const config = Array.isArray(rawConfig) ? rawConfig : (typeof rawConfig === 'string' ? JSON.parse(rawConfig || '[]') : []);

      let totalRooms = 0;
      let totalBeds = 0;
      config.forEach(c => {
        const start = parseInt(c.range_start, 10) || 1;
        const end = parseInt(c.range_end, 10) || start;
        const beds = parseInt(c.beds, 10) || 1;
        const r = (end >= start) ? (end - start + 1) : 1;
        totalRooms += r;
        totalBeds += (r * beds);
      });

      if (totalRooms === 0 && Number(b.total_rooms) > 0) {
        totalRooms = Number(b.total_rooms);
      }

      const result = await query(
        `INSERT INTO mess_buildings (name, site, total_rooms, total_beds, gender, status, room_config_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`,
        [b.name, b.site || 'LBCT', totalRooms, totalBeds, b.gender || 'Male', b.status || 'Active', JSON.stringify(config)]
      );
      await recordAuditLog(req, 'CREATE', 'Mess Buildings', result.rows[0].id, { name: b.name, site: b.site, total_rooms: totalRooms });
      return res.json({ ok: true, data: result.rows[0] });
    }

    if (action === 'UPDATE_MESS_BUILDING') {
      const b = payload?.data || payload || data || req.body;
      const targetId = id || b.id || req.body.id;
      const rawConfig = b.room_config_json || b.room_config || [];
      const config = Array.isArray(rawConfig) ? rawConfig : (typeof rawConfig === 'string' ? JSON.parse(rawConfig || '[]') : []);

      let totalRooms = 0;
      let totalBeds = 0;
      config.forEach(c => {
        const start = parseInt(c.range_start, 10) || 1;
        const end = parseInt(c.range_end, 10) || start;
        const beds = parseInt(c.beds, 10) || 1;
        const r = (end >= start) ? (end - start + 1) : 1;
        totalRooms += r;
        totalBeds += (r * beds);
      });

      if (totalRooms === 0 && Number(b.total_rooms) > 0) {
        totalRooms = Number(b.total_rooms);
      }

      const result = await query(
        `UPDATE mess_buildings 
         SET name = COALESCE($1, name),
             site = COALESCE($2, site),
             total_rooms = $3,
             total_beds = $4,
             gender = COALESCE($5, gender),
             status = COALESCE($6, status),
             room_config_json = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 RETURNING *;`,
        [b.name, b.site, totalRooms, totalBeds, b.gender, b.status, JSON.stringify(config), targetId]
      );
      await recordAuditLog(req, 'UPDATE', 'Mess Buildings', targetId, { name: b.name, total_rooms: totalRooms });
      return res.json({ ok: true, data: result.rows[0] });
    }

    if (action === 'DELETE_MESS_BUILDING') {
      const targetId = id || payload?.id || req.body.id;
      await query('DELETE FROM mess_buildings WHERE id = $1;', [targetId]);
      await recordAuditLog(req, 'DELETE', 'Mess Buildings', targetId, { id: targetId });
      return res.json({ ok: true, data: { deleted: true } });
    }

    if (action === 'GET_MESS_STAYS') {
      const result = await query(`
        SELECT s.*, 
               s.check_in as start_date, 
               s.check_out as end_date, 
               s.room_number as room_no, 
               s.bed_number as bed_no, 
               s.employee_name as guest_name,
               b.site,
               b.name as building_name
        FROM mess_stays s
        LEFT JOIN mess_buildings b ON s.building_id = b.id
        ORDER BY s.check_in DESC;
      `);
      return res.json({ ok: true, data: result.rows });
    }

    if (action === 'BATCH_UPDATE_STAYS') {
      const actionsList = payload?.actions || payload?.data || [];
      for (const act of actionsList) {
        if (act.type === 'CREATE' && act.payload) {
          const p = act.payload;
          await query(
            `INSERT INTO mess_stays (building_id, room_number, bed_number, employee_name, check_in, check_out, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
            [p.building_id, p.room_no || p.room_number, p.bed_no || p.bed_number, p.guest_name || p.employee_name, p.start_date || p.check_in || new Date(), p.end_date || p.check_out || null, p.status || 'Active', p.notes || null]
          );
        } else if (act.type === 'UPDATE' && act.id) {
          const p = act.payload || {};
          await query(
            `UPDATE mess_stays SET check_out = COALESCE($1, check_out), status = COALESCE($2, status), updated_at = CURRENT_TIMESTAMP WHERE id = $3;`,
            [p.end_date || p.check_out, p.status, act.id]
          );
        }
      }
      await recordAuditLog(req, 'UPDATE', 'Mess Stays', 'batch', { actions_count: actionsList.length });
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
      await recordAuditLog(req, 'CREATE', 'Vendor Contracts', result.rows[0].id, { vendor: vc.vendor_name, number: vc.contract_number });
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
      await recordAuditLog(req, 'CREATE', 'Unit Contracts', result.rows[0].id, { unit: uc.unit_code, vendor: uc.vendor_name });
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
      await recordAuditLog(req, 'CREATE', 'SOP Documents', result.rows[0].doc_code, { title: s.title, code: s.doc_code });
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'DELETE_SOP_DOCUMENT') {
      const targetId = id || payload?.id;
      await query('DELETE FROM standards WHERE id = $1 OR doc_code = $2;', [isNaN(Number(targetId)) ? -1 : Number(targetId), String(targetId)]);
      await recordAuditLog(req, 'DELETE', 'SOP Documents', targetId, { id: targetId });
      return res.json({ ok: true });
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
    if (action === 'CREATE_CATERING_SCORING') {
      const cs = payload?.data || data || req.body;
      const result = await query(
        `INSERT INTO catering_scorings (vendor_id, vendor_name, site, week_period, total_score, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`,
        [cs.vendor_id || null, cs.vendor_name || 'Vendor', cs.site || 'LBCT', cs.week_period || 'W1', Number(cs.total_score) || 0, cs.status || 'Verified', cs.notes || null]
      );
      await recordAuditLog(req, 'CREATE', 'Catering Scoring', result.rows[0].id, { vendor: cs.vendor_name, score: cs.total_score });
      return res.json({ ok: true, data: result.rows[0] });
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
      await recordAuditLog(req, 'CREATE', 'Reimbursements', result.rows[0].claim_number, { employee: r.employee_name, amount: r.amount });
      return res.json({ ok: true, data: result.rows[0] });
    }

    // 10. EVENTS (CALENDAR OF EVENT)
    if (action === 'GET_EVENTS') {
      const result = await query(`
        SELECT id, title, start_date as start, end_date as "end", start_date as start_time, end_date as end_time,
               all_day as "allDay", category, description, pic, status, recurrence_rule, notes, checklist_json
        FROM events 
        ORDER BY start_date ASC;
      `);
      return res.json({ ok: true, data: result.rows });
    }
    if (action === 'CREATE_EVENT') {
      const e = payload?.data || payload || data || req.body;
      const result = await query(
        `INSERT INTO events (title, start_date, end_date, all_day, category, description, pic, status, recurrence_rule, notes, checklist_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;`,
        [e.title, e.start_time || e.start_date || e.start || new Date(), e.end_time || e.end_date || e.end || null, e.all_day || false, e.category || 'General', e.description || e.notes || null, Array.isArray(e.pic) ? e.pic.join(', ') : (e.pic || null), e.status || 'Open', e.recurrence_rule || null, e.notes || null, JSON.stringify(e.checklist_json || e.checklist || [])]
      );
      await recordAuditLog(req, 'CREATE', 'Calendar Event', result.rows[0].id, { title: e.title, start: e.start_time });
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'UPDATE_EVENT') {
      const e = payload?.data || payload || data || req.body;
      const targetId = id || e.id || req.body.id;
      const result = await query(
        `UPDATE events 
         SET title = COALESCE($1, title),
             start_date = COALESCE($2, start_date),
             end_date = COALESCE($3, end_date),
             category = COALESCE($4, category),
             description = COALESCE($5, description),
             pic = COALESCE($6, pic),
             status = COALESCE($7, status),
             recurrence_rule = COALESCE($8, recurrence_rule),
             notes = COALESCE($9, notes),
             checklist_json = COALESCE($10, checklist_json),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $11 RETURNING *;`,
        [e.title, e.start_time || e.start_date || null, e.end_time || e.end_date || null, e.category, e.description, Array.isArray(e.pic) ? e.pic.join(', ') : e.pic, e.status, e.recurrence_rule, e.notes, e.checklist_json ? JSON.stringify(e.checklist_json) : null, targetId]
      );
      await recordAuditLog(req, 'UPDATE', 'Calendar Event', targetId, { title: e.title, status: e.status });
      return res.json({ ok: true, data: result.rows[0] });
    }
    if (action === 'DELETE_EVENT') {
      const targetId = id || payload?.id || req.body.id;
      await query('DELETE FROM events WHERE id = $1;', [targetId]);
      await recordAuditLog(req, 'DELETE', 'Calendar Event', targetId, { id: targetId });
      return res.json({ ok: true });
    }

    // 11. AUDIT LOGS (FULL AUDIT TRAIL)
    if (action === 'GET_AUDIT_LOGS') {
      const result = await query(`
        SELECT id, user_id, user_nik, user_name,
               COALESCE(user_name, user_nik, 'System') as user_email,
               action, entity_type as resource, entity_type, entity_id, site,
               details, ip_address, created_at as timestamp, created_at
        FROM audit_logs 
        ORDER BY created_at DESC 
        LIMIT 500;
      `);
      return res.json({ ok: true, data: result.rows });
    }

    // Default fallback: return ok
    return res.json({ ok: true, data: {} });
  } catch (err) {
    console.error(`[PG-Action-Error] ${action}:`, err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Global Error Handler agar function tidak crash di Vercel
app.use((err, req, res, next) => {
  console.error('[Global-API-Error]:', err.message || err);
  res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
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
