/**
 * ============================================================================
 * GENERIC CRUD OPERATIONS
 * ============================================================================
 */

function getRecords(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ ok: true, data: [] });
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse({ ok: true, data: [] });
  
  const headers = data[0];
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record = {};
    headers.forEach((h, idx) => {
      record[h] = row[idx];
    });
    records.push(record);
  }
  return jsonResponse({ ok: true, data: records });
}

function createRecord(sheetName, payload, actorEmail) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return jsonResponse({ ok: false, error: 'LOCK_TIMEOUT', message: 'Server sibuk, silakan coba beberapa saat lagi.' });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: `Sheet ${sheetName} not found` });
    
    const headers = sheet.getDataRange().getValues()[0];
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const newRow = headers.map(h => {
      if (h === 'id') return id;
      if (h === 'created_at' || h === 'updated_at') return now;
      // Handle file upload if the payload contains base64 data for 'file_url'
      if (h === 'file_url' && payload.fileData) {
        try {
          return uploadFileToDrive(payload.fileData, payload.fileName || `file_${id}`, sheetName);
        } catch (e) {
          throw new Error("Gagal upload file: " + e.message);
        }
      }
      if (payload[h] !== undefined) {
        let val = sanitizeCell(payload[h]);
        if (typeof val === 'string' && val.length > 49000) {
          val = val.substring(0, 49000);
        }
        return val;
      }
      return '';
    });
    
    sheet.appendRow(newRow);
    
    const after = {};
    headers.forEach((h, i) => { after[h] = newRow[i]; });
    
    try {
      writeAuditLog(actorEmail, 'CREATE', sheetName, id, null, after);
    } catch (auditErr) {
      Logger.log("Audit log failed: " + auditErr.message);
    }
    
    return jsonResponse({ ok: true, data: after });
  } finally {
    lock.releaseLock();
  }
}

function updateRecord(sheetName, id, payload, actorEmail) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return jsonResponse({ ok: false, error: 'LOCK_TIMEOUT', message: 'Server sibuk, silakan coba beberapa saat lagi.' });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: `Sheet ${sheetName} not found` });
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('id');
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(id)) {
        const before = {};
        headers.forEach((h, idx) => { before[h] = data[i][idx]; });
        
        const now = new Date().toISOString();
        const updatedRow = [...data[i]];
        const after = {};
        
        headers.forEach((h, idx) => {
          if (h === 'id' || h === 'created_at') {
            after[h] = updatedRow[idx];
            return;
          }
          if (h === 'updated_at') {
            updatedRow[idx] = now;
            after[h] = now;
            return;
          }
          
          // Handle file upload
          if (h === 'file_url' && payload.fileData) {
            try {
               updatedRow[idx] = uploadFileToDrive(payload.fileData, payload.fileName || `file_${id}`, sheetName);
            } catch (e) {
               throw new Error("Gagal upload file: " + e.message);
            }
            after[h] = updatedRow[idx];
            return;
          }

          if (payload[h] !== undefined) {
            let val = sanitizeCell(payload[h]);
            if (typeof val === 'string' && val.length > 49000) {
              val = val.substring(0, 49000);
            }
            updatedRow[idx] = val;
          }
          after[h] = updatedRow[idx];
        });
        
        sheet.getRange(i + 1, 1, 1, headers.length).setValues([updatedRow]);
        
        try {
          writeAuditLog(actorEmail, 'UPDATE', sheetName, id, before, after);
        } catch (auditErr) {
          Logger.log("Audit log failed: " + auditErr.message);
        }
        
        return jsonResponse({ ok: true, data: after });
      }
    }
    
    return jsonResponse({ ok: false, error: 'NOT_FOUND', message: 'Record not found' });
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord(sheetName, id, actorEmail) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ ok: false, error: 'SERVER_ERROR', message: `Sheet ${sheetName} not found` });
  
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) {
      const before = {};
      data[0].forEach((h, idx) => { before[h] = data[i][idx]; });
      
      sheet.deleteRow(i + 1);
      writeAuditLog(actorEmail, 'DELETE', sheetName, id, before, null);
      
      return jsonResponse({ ok: true, message: 'Record deleted' });
    }
  }
  return jsonResponse({ ok: false, error: 'NOT_FOUND', message: 'Record not found' });
}

function batchAppendRecords(sheetName, records, actorEmail, mode) {
  if (!records || !records.length) return jsonResponse({ ok: true, count: 0 });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return jsonResponse({ ok: false, error: 'LOCK_TIMEOUT', message: 'Server sibuk, coba lagi nanti.' });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      const firstRowHeaders = ['id', ...Object.keys(records[0]).filter(k => k !== 'id'), 'created_at'];
      sheet.appendRow(firstRowHeaders);
    }
    
    const headers = sheet.getDataRange().getValues()[0];
    const now = new Date().toISOString();
    const rows = records.map(rec => {
      const id = rec.id || Utilities.getUuid();
      return headers.map(h => {
        if (h === 'id') return id;
        if (h === 'created_at') return now;
        return rec[h] !== undefined ? sanitizeCell(rec[h]) : '';
      });
    });

    if (mode === 'replace') {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
    }

    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    }
    writeAuditLog(actorEmail, mode === 'replace' ? 'BATCH_REPLACE' : 'BATCH_IMPORT', sheetName, 'batch', null, { count: rows.length });
    return jsonResponse({ ok: true, count: rows.length });
  } finally {
    lock.releaseLock();
  }
}

