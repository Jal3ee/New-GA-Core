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
    return payload[h] !== undefined ? sanitizeCell(payload[h]) : '';
  });
  
  sheet.appendRow(newRow);
  
  const after = {};
  headers.forEach((h, i) => { after[h] = newRow[i]; });
  writeAuditLog(actorEmail, 'CREATE', sheetName, id, null, after);
  
  return jsonResponse({ ok: true, data: after });
}

function updateRecord(sheetName, id, payload, actorEmail) {
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
          updatedRow[idx] = sanitizeCell(payload[h]);
        }
        after[h] = updatedRow[idx];
      });
      
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([updatedRow]);
      writeAuditLog(actorEmail, 'UPDATE', sheetName, id, before, after);
      
      return jsonResponse({ ok: true, data: after });
    }
  }
  
  return jsonResponse({ ok: false, error: 'NOT_FOUND', message: 'Record not found' });
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
