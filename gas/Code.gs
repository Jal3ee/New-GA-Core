const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // GANTI DENGAN ID SPREADSHEET ANDA

const SECURITY = {
  // Diset di File > Project Properties > Script Properties
  // Key: API_SECRET_TOKEN
  API_SECRET_TOKEN: PropertiesService.getScriptProperties().getProperty('API_SECRET_TOKEN') || 'my_dev_secret',
  RATE_LIMIT_MAX: 30,
  RATE_LIMIT_WINDOW_MS: 60000,
};

function validateSecretToken(requestBody) {
  if (!SECURITY.API_SECRET_TOKEN) return false;
  return requestBody?.secret === SECURITY.API_SECRET_TOKEN;
}

function checkRateLimit(identifier) {
  const cache = CacheService.getScriptCache();
  const key = 'rl_' + String(identifier).replace(/[^a-zA-Z0-9]/g, '_');
  const now = Date.now();

  const raw = cache.get(key);
  const record = raw ? JSON.parse(raw) : { count: 0, windowStart: now };

  if (now - record.windowStart > SECURITY.RATE_LIMIT_WINDOW_MS) {
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count++;
  }

  cache.put(key, JSON.stringify(record), 120);

  if (record.count > SECURITY.RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

function doPost(e) {
  try {
    let body;
    // Ponytail Hack: Bypass GAS 10MB limit and JSON.parse OOM
    // If action is passed in URL query parameter, it means file is sent as RAW postData contents
    if (e.parameter && e.parameter.action) {
      body = {
        action: e.parameter.action,
        payload: e.parameter.payload ? JSON.parse(e.parameter.payload) : {},
        userEmail: e.parameter.userEmail || 'anonymous',
        secret: e.parameter.secret
      };
      // Extract file if uploaded as raw POST body
      if (e.postData && e.postData.contents) {
        body.payload.data = body.payload.data || {};
        body.payload.data.fileData = e.postData.contents; // This is the pure Base64 string
        body.payload.data.fileName = e.parameter.fileName || 'uploaded_file';
      }
    } else if (e.postData && e.postData.type && (e.postData.type.includes('application/json') || e.postData.type.includes('text/plain'))) {
      // Standard JSON request without large files
      body = JSON.parse(e.postData.contents);
    } else {
      throw new Error("No valid post data or parameters found");
    }

    if (!validateSecretToken(body)) {
      return jsonResponse({ ok: false, error: 'UNAUTHORIZED', code: 401 });
    }

    const identifier = body.userEmail || 'anonymous';
    if (!checkRateLimit(identifier)) {
      return jsonResponse({ ok: false, error: 'RATE_LIMITED', code: 429 });
    }

    return routeAction(body);

  } catch (err) {
    return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: err.toString(), code: 500 });
  }
}

function routeAction(body) {
  const actor = body.userEmail || 'system';
  switch (body.action) {
    case 'LOGIN':
      return loginUser(body.nik, body.password);
    // Events
    case 'GET_EVENTS':
      return getEvents();
    case 'CREATE_EVENT':
      body.payload.actorEmail = actor;
      return createEvent(body.payload);
    case 'UPDATE_EVENT':
      body.payload.actorEmail = actor;
      return updateEvent(body.id, body.payload);
    case 'DELETE_EVENT':
      return deleteEvent(body.id, actor);
    // Users
    case 'GET_USERS':
      return getUsers();
    case 'CREATE_USER':
      return createUser(body.payload, actor);
    case 'UPDATE_USER':
      return updateUser(body.id, body.payload, actor);
    case 'DELETE_USER':
      return deleteUser(body.id, actor);
    case 'UPDATE_PASSWORD':
      return updatePassword(body.payload.nik, body.payload.oldPassword, body.payload.newPassword, actor);
    // Audit Logs
    case 'GET_AUDIT_LOGS':
      return getAuditLogs();
    // Mess Management
    case 'GET_MESS_BUILDINGS':
      return getMessBuildings();
    case 'CREATE_MESS_BUILDING':
      return createMessBuilding(body.payload, actor);
    case 'UPDATE_MESS_BUILDING':
      return updateMessBuilding(body.id, body.payload, actor);
    case 'DELETE_MESS_BUILDING':
      return deleteMessBuilding(body.id, actor);
    case 'GET_MESS_STAYS':
      return getMessStays();
    case 'BATCH_UPDATE_STAYS':
      return batchUpdateStays(body.payload.actions, actor);
    // Vendor Contracts
    case 'GET_VENDOR_CONTRACTS':
      return getRecords('tbl_assets_vendor_contracts');
    case 'CREATE_VENDOR_CONTRACT':
      return createRecord('tbl_assets_vendor_contracts', body.payload.data, actor);
    case 'UPDATE_VENDOR_CONTRACT':
      return updateRecord('tbl_assets_vendor_contracts', body.id, body.payload.data, actor);
    case 'DELETE_VENDOR_CONTRACT':
      return deleteRecord('tbl_assets_vendor_contracts', body.id, actor);
    // Unit Contracts
    case 'GET_UNIT_CONTRACTS':
      return getRecords('tbl_assets_unit_contracts');
    case 'CREATE_UNIT_CONTRACT':
      return createRecord('tbl_assets_unit_contracts', body.payload.data, actor);
    case 'UPDATE_UNIT_CONTRACT':
      return updateRecord('tbl_assets_unit_contracts', body.id, body.payload.data, actor);
    case 'DELETE_UNIT_CONTRACT':
      return deleteRecord('tbl_assets_unit_contracts', body.id, actor);
    // Invoices
    case 'GET_INVOICES':
      return getRecords('tbl_docs_invoices');
    case 'CREATE_INVOICE':
      return createRecord('tbl_docs_invoices', body.payload.data, actor);
    case 'DOWNLOAD_FILE':
      const result = downloadFile(body.payload.fileId);
      if (!result.ok) {
        return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: result.error });
      }
      return jsonResponse(result);
    case 'UPDATE_INVOICE':
      return updateRecord('tbl_docs_invoices', body.id, body.payload.data, actor);
    case 'DELETE_INVOICE':
      return deleteRecord('tbl_docs_invoices', body.id, actor);
    // Finance Portal
    case 'FINANCE_PORTAL_AUTH':
      return authFinancePortal(body.payload.role, body.payload.password);
    case 'UPLOAD_FILE':
      try {
        const fileUrl = uploadFileToDrive(body.payload.fileData, body.payload.fileName, 'uploads');
        return jsonResponse({ ok: true, fileUrl });
      } catch (e) {
        return jsonResponse({ ok: false, error: 'UPLOAD_FAILED', message: e.message });
      }
    default:
      return jsonResponse({ ok: false, error: 'UNKNOWN_ACTION', message: 'Action not found' });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function loginUser(nik, password) {
  if (!nik || !password) {
    return jsonResponse({ ok: false, error: 'BAD_REQUEST', message: 'NIK and password required' });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tbl_users');
  
  if (!sheet) {
    return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: 'Sheet tbl_users not found' });
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const nikIdx = headers.indexOf('nik');
  const passIdx = headers.indexOf('password_hashed');
  const statusIdx = headers.indexOf('status');
  
  if (nikIdx === -1 || passIdx === -1) {
    return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: 'Invalid table structure' });
  }

  for (let i = 1; i < data.length; i++) {
    // Strip leading zeros for robust comparison since spreadsheets might drop them
    const storedNik = String(data[i][nikIdx]).replace(/^0+/, '');
    const inputNik = String(nik).replace(/^0+/, '');
    
    if (storedNik === inputNik) {
      const storedHash = data[i][passIdx];
      const status = statusIdx > -1 ? data[i][statusIdx] : 'Active';
      
      // Verify password
      if (verifyPassword(password, storedHash)) {
        if (status !== 'Active') {
           return jsonResponse({ ok: true, data: { status: 'Inactive' } });
        }
        
        // Success
        const userData = {};
        headers.forEach((h, idx) => {
          if (h !== 'password_hashed' && h !== 'password') {
            userData[h] = data[i][idx];
          }
        });
        
        return jsonResponse({ ok: true, data: userData });
      }
      break; // wrong password
    }
  }

  return jsonResponse({ ok: false, error: 'UNAUTHORIZED', message: 'NIK atau Password salah' });
}

function authFinancePortal(role, password) {
  const correctPassword = PropertiesService.getScriptProperties().getProperty('FINANCE_PORTAL_PASSWORD') || '123456';
  if (password === correctPassword) {
    const token = Utilities.base64Encode(role + ':' + Date.now());
    return jsonResponse({ ok: true, data: { token, role } });
  }
  return jsonResponse({ ok: false, error: 'UNAUTHORIZED', message: 'Password salah' });
}
