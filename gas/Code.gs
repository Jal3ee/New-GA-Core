const SPREADSHEET_ID = '1T0F3N2T8br_1awN51HPVxEic1YKp6HpXKaCZJ9Lxdn8';

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

function doGet(e) {
  return jsonResponse({
    ok: true,
    status: 'GA Core API Online',
    timestamp: new Date().toISOString(),
    action: e?.parameter?.action || 'HEALTH'
  });
}

function doPost(e) {
  try {
    let body;
    // Ponytail Hack V2: Bypass GAS 10MB limit and JSON.parse OOM
    // Payload contains Metadata JSON and Base64 File separated by delimiter
    if (e.postData && e.postData.contents) {
      if (e.postData.contents.indexOf('-----FILE_DELIMITER_PONYTAIL_V2-----') !== -1) {
        const parts = e.postData.contents.split('-----FILE_DELIMITER_PONYTAIL_V2-----');
        body = JSON.parse(parts[0]);
        const fileBase64 = parts[1];
        if (fileBase64 && fileBase64.length > 0) {
          body.payload = body.payload || {};
          body.payload.data = body.payload.data || {};
          body.payload.data.fileData = fileBase64;
          // fileName is already parsed from JSON metadata
        }
      } else if (e.parameter && e.parameter.action) {
        // Fallback for V1 Ponytail Hack (URL params + raw body)
        body = {
          action: e.parameter.action,
          payload: e.parameter.payload ? JSON.parse(e.parameter.payload) : {},
          userEmail: e.parameter.userEmail || 'anonymous',
          secret: e.parameter.secret
        };
        body.payload.data = body.payload.data || {};
        body.payload.data.fileData = e.postData.contents;
        body.payload.data.fileName = e.parameter.fileName || 'uploaded_file';
      } else if (e.postData.type && (e.postData.type.includes('application/json') || e.postData.type.includes('text/plain'))) {
        // Standard JSON request without large files
        body = JSON.parse(e.postData.contents);
      } else {
        throw new Error("No valid post data or parameters found");
      }
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
    // Transport Ticketing Database
    case 'GET_TICKETING_RECORDS':
      return getRecords('tbl_transport_ticketing');
    case 'CREATE_TICKETING_RECORD':
      return createRecord('tbl_transport_ticketing', body.payload.data, actor);
    case 'BATCH_IMPORT_TICKETING':
      return batchAppendRecords('tbl_transport_ticketing', body.payload.records, actor, body.payload.mode);
    case 'DELETE_TICKETING_RECORD':
      return deleteRecord('tbl_transport_ticketing', body.id, actor);
    // Standards (SOP / WI / STD & FORM)
    case 'GET_STANDARDS':
      return getRecords('tbl_docs_standards');
    case 'CREATE_STANDARD':
      return createRecord('tbl_docs_standards', body.payload.data, actor);
    case 'UPDATE_STANDARD':
      return updateRecord('tbl_docs_standards', body.id, body.payload.data, actor);
    case 'DELETE_STANDARD':
      return deleteRecord('tbl_docs_standards', body.id, actor);

    // Catering Vendors Master
    case 'GET_CATERING_VENDORS':
      return getRecords('tbl_catering_vendors');
    case 'CREATE_CATERING_VENDOR':
      return createRecord('tbl_catering_vendors', body.payload.data, actor);
    case 'UPDATE_CATERING_VENDOR':
      return updateRecord('tbl_catering_vendors', body.id, body.payload.data, actor);
    case 'DELETE_CATERING_VENDOR':
      return deleteRecord('tbl_catering_vendors', body.id, actor);

    // Catering Weekly Food Index Scorings
    case 'GET_CATERING_SCORINGS':
      return getRecords('tbl_catering_scorings');
    case 'CREATE_CATERING_SCORING':
      return createRecord('tbl_catering_scorings', body.payload.data, actor);
    case 'UPDATE_CATERING_SCORING':
      return updateRecord('tbl_catering_scorings', body.id, body.payload.data, actor);
    case 'DELETE_CATERING_SCORING':
      return deleteRecord('tbl_catering_scorings', body.id, actor);

    // Reimbursements Tiket & Transport
    case 'GET_REIMBURSEMENTS':
      return getRecords('tbl_docs_reimbursements');
    case 'CREATE_REIMBURSEMENT':
      return createRecord('tbl_docs_reimbursements', body.payload.data, actor);
    case 'UPDATE_REIMBURSEMENT':
      return updateRecord('tbl_docs_reimbursements', body.id, body.payload.data, actor);
    case 'DELETE_REIMBURSEMENT':
      return deleteRecord('tbl_docs_reimbursements', body.id, actor);

    // Setup / Migration Helper
    case 'SETUP_NEW_TABLES':
      setupStandardsSheet();
      setupCateringSheets();
      setupReimbursementsSheet();
      return jsonResponse({ ok: true, message: 'Standards, Catering, and Reimbursements sheets verified/created successfully' });

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
