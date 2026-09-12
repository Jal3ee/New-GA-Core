/**
 * Buat hash SHA-256 dari password + salt
 */
function hashPassword(plainPassword) {
  const PEPPER = PropertiesService.getScriptProperties().getProperty('PASSWORD_PEPPER') || 'garda-pepper-change-this';
  const salted = plainPassword + PEPPER;
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salted,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Verifikasi password
 */
function verifyPassword(plainPassword, storedHash) {
  const plainStr = String(plainPassword);
  const strippedStr = plainStr.replace(/^0+/, '');
  const storedStr = String(storedHash);

  // 1. Plaintext direct match (in case admin manually typed password in spreadsheet)
  if (plainStr === storedStr || strippedStr === storedStr.replace(/^0+/, '')) {
    return true;
  }

  // 2. Hash check (exact password)
  const inputHash = hashPassword(plainStr);
  if (inputHash === storedStr) return true;

  // 3. Hash check (stripped password, in case default NIK lost zero)
  if (strippedStr !== plainStr) {
    const strippedHash = hashPassword(strippedStr);
    if (strippedHash === storedStr) return true;
  }

  // 4. Hash check (padded password, in case input lost zero but hash has zero)
  // Wait, if strippedStr !== plainStr, we already check both.
  return false;
}

/**
 * Sanitizer (mencegah formula injection)
 */
function sanitizeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  const str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str.replace(/\0/g, '');
}

/**
 * Jalankan ini SEKALI saja untuk mendaftarkan Admin pertama
 */
function seedInitialAdmin() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('tbl_users');
  
  if (!sheet) {
    sheet = ss.insertSheet('tbl_users');
    sheet.appendRow(['id', 'nik', 'name', 'password_hashed', 'role', 'status', 'birthdate']);
  }
  
  const initialPassword = 'admin'; // Ganti dengan password yang aman
  const hashedPassword = hashPassword(initialPassword);
  
  sheet.appendRow([
    Utilities.getUuid(),
    'admin',
    'Super Admin',
    hashedPassword,
    'Admin',
    'Active',
    ''
  ]);
  
  Logger.log('Admin user seeded!');
}

/**
 * ============================================================================
 * ASSETS DB INITIALIZATION
 * ============================================================================
 */
function setupAssetsSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. Vendor Contracts
  let vendorSheet = ss.getSheetByName('tbl_assets_vendor_contracts');
  if (!vendorSheet) {
    vendorSheet = ss.insertSheet('tbl_assets_vendor_contracts');
    vendorSheet.appendRow(['id', 'nomor', 'nama_vendor', 'dept', 'site', 'jenis_kontrak', 'start_kontrak', 'end_kontrak', 'no_kontrak', 'coa', 'file_url', 'created_at', 'updated_at']);
  }
  
  // 2. Unit Internal
  let unitSheet = ss.getSheetByName('tbl_assets_unit_contracts');
  if (!unitSheet) {
    unitSheet = ss.insertSheet('tbl_assets_unit_contracts');
    unitSheet.appendRow(['id', 'no_lambung', 'no_polisi', 'unit_asset', 'site', 'dept', 'user_pengguna', 'merk', 'warna', 'type', 'tahun_unit', 'no_rangka', 'no_mesin', 'bahan_bakar', 'stnk_start', 'stnk_end', 'kir_start', 'kir_end', 'file_url', 'coa', 'budget_tahunan', 'status_unit', 'created_at', 'updated_at']);
  }
  
  Logger.log('Assets sheets initialized!');
}

/**
 * ============================================================================
 * DOCS INVOICES DB INITIALIZATION
 * ============================================================================
 */
function setupDocsInvoicesSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let invSheet = ss.getSheetByName('tbl_docs_invoices');
  if (!invSheet) {
    invSheet = ss.insertSheet('tbl_docs_invoices');
    invSheet.appendRow(['id', 'vendor', 'site', 'nilai', 'periode_start', 'periode_end', 'tgl_berkas', 'file_url', 'annotations_json', 'tracking_admin_ga', 'tracking_ga_gl', 'tracking_ga_spv', 'tracking_ga_sect_head', 'tracking_ga_dept_head', 'tracking_site_manager', 'tracking_accounting', 'tracking_fa_gl', 'status_pembayaran', 'created_at', 'updated_at']);
  }
  
  Logger.log('Docs invoices sheet initialized!');
}

/**
 * ============================================================================
 * DOCS STANDARDS (SOP / WI / STD & FORM) INITIALIZATION
 * ============================================================================
 */
function setupStandardsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('tbl_docs_standards');
  if (!sheet) {
    sheet = ss.insertSheet('tbl_docs_standards');
    sheet.appendRow([
      'id', 'doc_number', 'title', 'category', 'type', 'version',
      'effective_date', 'description', 'file_url', 'file_name',
      'created_at', 'updated_at'
    ]);
  }
  Logger.log('Standards sheet initialized!');
}

/**
 * ============================================================================
 * CATERING FOOD INDEX SCORING & VENDORS INITIALIZATION
 * ============================================================================
 */
function setupCateringSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. Catering Vendors Master
  let vSheet = ss.getSheetByName('tbl_catering_vendors');
  if (!vSheet) {
    vSheet = ss.insertSheet('tbl_catering_vendors');
    vSheet.appendRow([
      'id', 'vendor_name', 'catering_name', 'site', 'kitchen_type',
      'pic_name', 'target_frequency', 'target_score', 'status',
      'created_at', 'updated_at'
    ]);
    
    // Seed default vendors from Excel
    const now = new Date().toISOString();
    const defaults = [
      [Utilities.getUuid(), 'CV ABS', 'Catering GAS', 'LBCT', 'A1', 'Pak Agus', 2, 85, 'Aktif', now, now],
      [Utilities.getUuid(), 'CV Moms Ainun', "Catering Mom's", 'IDMG', 'A2', 'Ibu Ainun', 2, 85, 'Aktif', now, now],
      [Utilities.getUuid(), 'PT Sandaga Perkasa', 'Catering Sandaga', 'SPCT', 'A3', 'Pak Rudi', 2, 85, 'Aktif', now, now],
      [Utilities.getUuid(), 'CV Manggala Raya', 'Catering Manggala raya', 'LBCT', 'A2', 'Pak Hendra', 2, 85, 'Aktif', now, now]
    ];
    defaults.forEach(function(r) { vSheet.appendRow(r); });
  }
  
  // 2. Catering Weekly Scorings
  let sSheet = ss.getSheetByName('tbl_catering_scorings');
  if (!sSheet) {
    sSheet = ss.insertSheet('tbl_catering_scorings');
    sSheet.appendRow([
      'id', 'vendor_id', 'vendor_name', 'catering_name', 'site', 'kitchen_type',
      'year', 'month', 'week', 'inspection_date', 'auditor_name',
      'score_a', 'score_b', 'score_c', 'score_d', 'score_e', 'score_f', 'score_g', 'score_h', 'score_i',
      'total_score', 'max_score', 'food_index_percent', 'grade',
      'checklist_answers_json', 'findings_notes', 'corrective_actions', 'file_url',
      'created_at', 'updated_at'
    ]);
  }
  
  Logger.log('Catering sheets initialized!');
}

/**
 * ============================================================================
 * SYSTEM AUDIT LOG
 * ============================================================================
 */
function ensureAuditLogSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('tbl_audit_log');
  if (!sheet) {
    sheet = ss.insertSheet('tbl_audit_log');
    sheet.appendRow([
      'id', 'timestamp', 'user_email', 'action', 'resource',
      'resource_id', 'before_json', 'after_json'
    ]);
  }
  return sheet;
}

function writeAuditLog(userEmail, action, resource, resourceId, before, after) {
  try {
    const sanitizeForAudit = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const safe = {};
      for (const k in obj) {
        const v = obj[k];
        if (typeof v === 'string' && v.length > 500) {
          safe[k] = `[Truncated text, length: ${v.length}]`;
        } else {
          safe[k] = v;
        }
      }
      return safe;
    };

    const sheet = ensureAuditLogSheet();
    let beforeStr = before ? JSON.stringify(sanitizeForAudit(before)) : '';
    let afterStr = after ? JSON.stringify(sanitizeForAudit(after)) : '';

    if (beforeStr.length > 40000) beforeStr = beforeStr.substring(0, 40000);
    if (afterStr.length > 40000) afterStr = afterStr.substring(0, 40000);

    sheet.appendRow([
      Utilities.getUuid(),
      new Date().toISOString(),
      userEmail || 'system',
      action,
      resource,
      resourceId || '',
      beforeStr,
      afterStr
    ]);
  } catch (e) {
    Logger.log('Error writing audit log: ' + e);
  }
}

function getAuditLogs() {
  const sheet = ensureAuditLogSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse({ ok: true, data: [] });
  
  const headers = data[0];
  const logs = [];
  // Read backwards to get latest first, limit to 200 for performance
  const limit = Math.max(1, data.length - 200);
  for (let i = data.length - 1; i >= limit; i--) {
    const row = data[i];
    const log = {};
    headers.forEach((h, idx) => { log[h] = row[idx]; });
    logs.push(log);
  }
  return jsonResponse({ ok: true, data: logs });
}

/**
 * ============================================================================
 * USERS CRUD
 * ============================================================================
 */
function getUsers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tbl_users');
  if (!sheet) return jsonResponse({ ok: true, data: [] });
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse({ ok: true, data: [] });
  
  const headers = data[0];
  const users = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const user = {};
    headers.forEach((h, idx) => {
      // Don't send password hash to frontend
      if (h !== 'password_hashed' && h !== 'password') {
        user[h] = row[idx];
      }
    });
    users.push(user);
  }
  return jsonResponse({ ok: true, data: users });
}

function createUser(payload, actorEmail) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tbl_users');
  if (!sheet) return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: 'tbl_users not found' });
  
  // Check Duplicate NIK
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const nikIdx = headers.indexOf('nik');
  for (let i = 1; i < data.length; i++) {
    const storedNik = String(data[i][nikIdx]).replace(/^0+/, '');
    const inputNik = String(payload.nik).replace(/^0+/, '');
    if (storedNik === inputNik) {
      return jsonResponse({ ok: false, error: 'BAD_REQUEST', message: 'NIK sudah terdaftar' });
    }
  }

  const id = Utilities.getUuid();
  const hashedPassword = hashPassword(payload.password || payload.nik); // default pass = nik
  
  sheet.appendRow([
    id,
    sanitizeCell(payload.nik),
    sanitizeCell(payload.name),
    hashedPassword,
    sanitizeCell(payload.role || 'Karyawan'),
    sanitizeCell(payload.status || 'Active'),
    sanitizeCell(payload.birthdate || '')
  ]);

  writeAuditLog(actorEmail, 'CREATE', 'tbl_users', id, null, payload);
  return jsonResponse({ ok: true, data: { id } });
}

function updateUser(id, payload, actorEmail) {
  if (!id) return jsonResponse({ ok: false, error: 'BAD_REQUEST', message: 'ID required' });
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tbl_users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === id) {
      const rowIdx = i + 1;
      const before = {};
      headers.forEach((h, colIdx) => { before[h] = data[i][colIdx]; });
      delete before.password_hashed;

      headers.forEach((h, colIdx) => {
        if (payload[h] !== undefined && h !== 'id') {
          sheet.getRange(rowIdx, colIdx + 1).setValue(sanitizeCell(payload[h]));
        }
      });
      // Handle password reset
      if (payload.password) {
        const passIdx = headers.indexOf('password_hashed');
        if (passIdx > -1) {
          sheet.getRange(rowIdx, passIdx + 1).setValue(hashPassword(payload.password));
        }
      }
      
      const safePayload = { ...payload };
      delete safePayload.password;
      writeAuditLog(actorEmail, 'UPDATE', 'tbl_users', id, before, safePayload);
      return jsonResponse({ ok: true, data: { id } });
    }
  }
  return jsonResponse({ ok: false, error: 'NOT_FOUND', message: 'User not found' });
}

function deleteUser(id, actorEmail) {
  if (!id) return jsonResponse({ ok: false, error: 'BAD_REQUEST', message: 'ID required' });
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tbl_users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === id) {
      const before = {};
      headers.forEach((h, colIdx) => { before[h] = data[i][colIdx]; });
      delete before.password_hashed;

      sheet.deleteRow(i + 1);
      writeAuditLog(actorEmail, 'DELETE', 'tbl_users', id, before, null);
      return jsonResponse({ ok: true, data: { success: true } });
    }
  }
  return jsonResponse({ ok: false, error: 'NOT_FOUND', message: 'User not found' });
}

function updatePassword(nik, oldPassword, newPassword, actorEmail) {
  if (!nik || !oldPassword || !newPassword) {
    return jsonResponse({ ok: false, error: 'BAD_REQUEST', message: 'Incomplete data' });
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tbl_users');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const nikIdx = headers.indexOf('nik');
  const passIdx = headers.indexOf('password_hashed');
  const idIdx = headers.indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    const storedNik = String(data[i][nikIdx]).replace(/^0+/, '');
    const inputNik = String(nik).replace(/^0+/, '');
    if (storedNik === inputNik) {
      const storedHash = data[i][passIdx];
      
      if (!verifyPassword(oldPassword, storedHash)) {
        return jsonResponse({ ok: false, error: 'UNAUTHORIZED', message: 'Password lama salah' });
      }
      
      const newHash = hashPassword(newPassword);
      sheet.getRange(i + 1, passIdx + 1).setValue(newHash);
      
      const id = data[i][idIdx];
      writeAuditLog(actorEmail, 'UPDATE_PASSWORD', 'tbl_users', id, null, null);
      
      return jsonResponse({ ok: true, data: { success: true } });
    }
  }
  return jsonResponse({ ok: false, error: 'NOT_FOUND', message: 'User not found' });
}

/**
 * ============================================================================
 * EVENTS CRUD (Calendar of Events)
 * ============================================================================
 */

function ensureEventsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('tbl_events');
  if (!sheet) {
    sheet = ss.insertSheet('tbl_events');
    sheet.appendRow([
      'id', 'title', 'category', 'pic', 'start_time', 'end_time', 
      'recurrence_rule', 'notes', 'checklist_json', 'status', 
      'created_at', 'created_by'
    ]);
  }
  return sheet;
}

function getEvents() {
  const sheet = ensureEventsSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse({ ok: true, data: [] });
  
  const headers = data[0];
  const events = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const event = {};
    headers.forEach((h, idx) => {
      event[h] = row[idx];
    });
    // Parse json string back to object
    try {
      if (event.checklist_json) event.checklist_json = JSON.parse(event.checklist_json);
      if (event.pic) event.pic = JSON.parse(event.pic);
    } catch (e) {}
    events.push(event);
  }
  return jsonResponse({ ok: true, data: events });
}

function createEvent(payload) {
  const sheet = ensureEventsSheet();
  const id = Utilities.getUuid();
  const now = new Date().toISOString();
  
  sheet.appendRow([
    id,
    sanitizeCell(payload.title),
    sanitizeCell(payload.category),
    JSON.stringify(payload.pic || []),
    payload.start_time,
    payload.end_time,
    payload.recurrence_rule || '',
    sanitizeCell(payload.notes || ''),
    JSON.stringify(payload.checklist_json || []),
    payload.status || 'Open',
    now,
    sanitizeCell(payload.created_by || 'system')
  ]);
  
  writeAuditLog(payload.actorEmail, 'CREATE', 'tbl_events', id, null, payload);
  return jsonResponse({ ok: true, data: { id } });
}

function updateEvent(id, payload) {
  if (!id) return jsonResponse({ ok: false, error: 'BAD_REQUEST', message: 'ID required' });
  const sheet = ensureEventsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === id) {
      // Update fields selectively
      const rowIdx = i + 1;
      headers.forEach((h, colIdx) => {
        if (payload[h] !== undefined && h !== 'id' && h !== 'created_at') {
          let val = payload[h];
          if (h === 'checklist_json' || h === 'pic') val = JSON.stringify(val);
          sheet.getRange(rowIdx, colIdx + 1).setValue(sanitizeCell(val));
        }
      });
      const before = {}; // Minimal audit trail for updates due to array map complexity, real app should deep copy
      writeAuditLog(payload.actorEmail, 'UPDATE', 'tbl_events', id, { previous: 'data' }, payload);
      return jsonResponse({ ok: true, data: { id } });
    }
  }
  return jsonResponse({ ok: false, error: 'NOT_FOUND' });
}

function deleteEvent(id) {
  if (!id) return jsonResponse({ ok: false, error: 'BAD_REQUEST' });
  const sheet = ensureEventsSheet();
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === id) {
      sheet.deleteRow(i + 1);
      writeAuditLog(actorEmail, 'DELETE', 'tbl_events', id, { id }, null);
      return jsonResponse({ ok: true, data: { success: true } });
    }
  }
  return jsonResponse({ ok: false, error: 'NOT_FOUND' });
}

/**
 * ============================================================================
 * MESS MANAGEMENT (Buildings & Stays)
 * ============================================================================
 */

function ensureMessBuildingsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('tbl_mess_buildings');
  if (!sheet) {
    sheet = ss.insertSheet('tbl_mess_buildings');
    sheet.appendRow(['id', 'site', 'name', 'room_config_json']);
  }
  return sheet;
}

function ensureMessStaysSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('tbl_mess_stays');
  if (!sheet) {
    sheet = ss.insertSheet('tbl_mess_stays');
    sheet.appendRow(['id', 'site', 'building_id', 'room_no', 'bed_no', 'guest_name', 'status', 'start_date', 'end_date', 'leave_start', 'leave_end']);
  }
  return sheet;
}

function getMessBuildings() {
  const sheet = ensureMessBuildingsSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse({ ok: true, data: [] });
  const headers = data[0];
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    headers.forEach((h, idx) => { item[h] = row[idx]; });
    try { if (item.room_config_json) item.room_config_json = JSON.parse(item.room_config_json); } catch(e) {}
    items.push(item);
  }
  return jsonResponse({ ok: true, data: items });
}

function createMessBuilding(payload, actorEmail) {
  const sheet = ensureMessBuildingsSheet();
  const id = Utilities.getUuid();
  sheet.appendRow([
    id,
    sanitizeCell(payload.site),
    sanitizeCell(payload.name),
    JSON.stringify(payload.room_config_json || [])
  ]);
  writeAuditLog(actorEmail, 'CREATE', 'tbl_mess_buildings', id, null, payload);
  return jsonResponse({ ok: true, data: { id } });
}

function updateMessBuilding(id, payload, actorEmail) {
  if (!id) return jsonResponse({ ok: false, error: 'BAD_REQUEST' });
  const sheet = ensureMessBuildingsSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === id) {
      const rowIdx = i + 1;
      headers.forEach((h, colIdx) => {
        if (payload[h] !== undefined && h !== 'id') {
          let val = payload[h];
          if (h === 'room_config_json') val = JSON.stringify(val);
          sheet.getRange(rowIdx, colIdx + 1).setValue(sanitizeCell(val));
        }
      });
      writeAuditLog(actorEmail, 'UPDATE', 'tbl_mess_buildings', id, null, payload);
      return jsonResponse({ ok: true, data: { id } });
    }
  }
  return jsonResponse({ ok: false, error: 'NOT_FOUND' });
}

function deleteMessBuilding(id, actorEmail) {
  if (!id) return jsonResponse({ ok: false, error: 'BAD_REQUEST' });
  const sheet = ensureMessBuildingsSheet();
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] === id) {
      sheet.deleteRow(i + 1);
      writeAuditLog(actorEmail, 'DELETE', 'tbl_mess_buildings', id, null, null);
      return jsonResponse({ ok: true, data: { success: true } });
    }
  }
  return jsonResponse({ ok: false, error: 'NOT_FOUND' });
}

function getMessStays() {
  const sheet = ensureMessStaysSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse({ ok: true, data: [] });
  const headers = data[0];
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};
    headers.forEach((h, idx) => { item[h] = row[idx]; });
    items.push(item);
  }
  return jsonResponse({ ok: true, data: items });
}

function batchUpdateStays(actions, actorEmail) {
  // actions: array of { type: 'CREATE'|'UPDATE', id: '...', payload: {...} }
  if (!actions || !actions.length) return jsonResponse({ ok: false, error: 'BAD_REQUEST' });
  const sheet = ensureMessStaysSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('id');
  
  for (const action of actions) {
    if (action.type === 'CREATE') {
      const id = Utilities.getUuid();
      const p = action.payload;
      sheet.appendRow([
        id,
        sanitizeCell(p.site),
        sanitizeCell(p.building_id),
        sanitizeCell(p.room_no),
        sanitizeCell(p.bed_no),
        sanitizeCell(p.guest_name),
        sanitizeCell(p.status),
        p.start_date || new Date().toISOString(),
        p.end_date || '',
        p.leave_start || '',
        p.leave_end || ''
      ]);
    } else if (action.type === 'UPDATE' && action.id) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][idIdx] === action.id) {
          const rowIdx = i + 1;
          const p = action.payload;
          headers.forEach((h, colIdx) => {
            if (p[h] !== undefined && h !== 'id') {
              sheet.getRange(rowIdx, colIdx + 1).setValue(sanitizeCell(p[h]));
            }
          });
          break; // Found and updated this ID in data snapshot (note: doesn't reflect multiple updates to same ID well, but sufficient for batch checkouts)
        }
      }
    }
  }
  
  writeAuditLog(actorEmail, 'BATCH_UPDATE_STAYS', 'tbl_mess_stays', 'batch', null, actions);
  return jsonResponse({ ok: true, data: { success: true } });
}
