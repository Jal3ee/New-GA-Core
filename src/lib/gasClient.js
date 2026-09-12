const GAS_URL = import.meta.env.VITE_GAS_URL;
const API_SECRET = import.meta.env.VITE_API_SECRET;

// Get session email from sessionStorage to track rate limit
function getSessionEmail() {
  try {
    const raw = sessionStorage.getItem('garda_session');
    if (raw) {
      const SALT = import.meta.env.VITE_SESSION_SALT || 'garda-internal-2024';
      const decoded = decodeURIComponent(atob(raw));
      const [json] = decoded.split('|' + SALT);
      const parsed = JSON.parse(json);
      return parsed.email || parsed.nik || null;
    }
    const financeRole = sessionStorage.getItem('finance_role');
    if (financeRole) {
      return `finance_${financeRole.toLowerCase().replace(/[^a-z0-9]/g, '_')}@portal`;
    }
    return null;
  } catch {
    return null;
  }
}

class GASError extends Error {
  constructor(code, message, attempt) {
    super(message);
    this.code = code;
    this.attempt = attempt;
  }
}

// Throttled Request Queue to prevent Google Apps Script concurrent redirect 404 collision
let requestQueue = Promise.resolve();
function enqueueRequest(fn) {
  const next = requestQueue.then(async () => {
    // 180ms delay between consecutive calls to ensure GAS macro router assigns distinct redirect keys
    await new Promise(res => setTimeout(res, 180));
    return fn();
  });
  requestQueue = next.catch(() => {});
  return next;
}

export async function gasFetch(action, payload = {}, options = {}) {
  const { maxRetries = 3, retryDelay = 800 } = options;

  let hasFile = false;
  let fileObj = null;
  let fileName = '';

  // Check if there is a File in the payload data
  if (payload.payload && payload.payload.data && payload.payload.data.fileData instanceof File) {
    hasFile = true;
    fileObj = payload.payload.data.fileData;
    fileName = payload.payload.data.fileName || fileObj.name;
    delete payload.payload.data.fileData; // remove from JSON
    delete payload.payload.data.fileName;
  }

  const bodyObj = {
    action,
    secret: API_SECRET,
    userEmail: getSessionEmail(),
    ...payload,
  };

  // If in dev and no GAS_URL, return mock data
  if (!GAS_URL) {
    console.warn("GAS_URL is not set. Using mock for action:", action);
    if (action === 'LOGIN') {
      if (payload.nik === 'admin' && payload.password === 'admin') {
        return { ok: true, data: { id: 1, nik: 'admin', name: 'Admin Base', role: 'Admin', status: 'Active' }};
      }
      if (payload.nik === 'karyawan' && payload.password === 'karyawan') {
        return { ok: true, data: { id: 2, nik: 'karyawan', name: 'Karyawan', role: 'Karyawan', status: 'Active' }};
      }
      throw new GASError('UNAUTHORIZED', 'Invalid credentials or inactive status', 1);
    }
    if (action === 'GET_EVENTS') return { ok: true, data: [] };
    if (action === 'CREATE_EVENT') return { ok: true, data: { id: 'mock-123' } };
    if (action === 'DELETE_EVENT') return { ok: true, data: {} };
    if (action === 'GET_USERS') return { ok: true, data: [] };
    if (action === 'CREATE_USER') return { ok: true, data: { id: 'mock-user-123' } };
    if (action === 'UPDATE_USER' || action === 'DELETE_USER') return { ok: true, data: {} };
    if (action === 'GET_AUDIT_LOGS') return { ok: true, data: [] };
    if (action === 'GET_MESS_BUILDINGS') return { ok: true, data: [] };
    if (action === 'GET_MESS_STAYS') return { ok: true, data: [] };
    if (action === 'CREATE_MESS_BUILDING') return { ok: true, data: { id: 'mock-building-123' } };
    if (action === 'BATCH_UPDATE_STAYS') return { ok: true, data: { success: true } };
    if (action === 'UPLOAD_FILE') return { ok: true, fileUrl: 'https://mock-file-url.com/invoice.pdf' };
    if (action === 'GET_TICKETING_RECORDS') return { ok: true, data: [] };
    if (action === 'BATCH_IMPORT_TICKETING') return { ok: true, count: payload.payload?.records?.length || 0 };
    if (action === 'DELETE_TICKETING_RECORD') return { ok: true };
    if (action === 'GET_SOP_DOCUMENTS') return { ok: true, data: [] };
    if (action === 'SAVE_SOP_DOCUMENT') return { ok: true, data: { id: 'mock-sop-1' } };
    if (action === 'DELETE_SOP_DOCUMENT') return { ok: true };
    return { ok: true, data: {} };
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const responseData = await enqueueRequest(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300_000); // 5 menit timeout untuk upload

        let fetchOptions = {
          method: 'POST',
          signal: controller.signal,
          credentials: 'omit',
          redirect: 'follow',
        };

        if (hasFile) {
          const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Gagal membaca file'));
            reader.readAsDataURL(fileObj);
          });
          
          bodyObj.payload = bodyObj.payload || {};
          if (bodyObj.payload.data) {
            bodyObj.payload.data.fileName = fileName;
          } else {
            bodyObj.payload.fileName = fileName;
          }

          const metaStr = JSON.stringify(bodyObj);
          fetchOptions.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
          fetchOptions.body = metaStr + '-----FILE_DELIMITER_PONYTAIL_V2-----' + base64Data;
        } else {
          fetchOptions.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
          fetchOptions.body = JSON.stringify(bodyObj);
        }

        const res = await fetch(GAS_URL, fetchOptions);
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new GASError('HTTP_' + res.status, `Google Apps Script returned HTTP ${res.status}`, attempt);
        }

        const text = await res.text();
        const trimmed = text.trim();
        
        if (trimmed.startsWith('<') || trimmed === 'Not Found') {
          throw new GASError('HTML_RESPONSE', 'Google macro echo server returned HTML/404 response', attempt);
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (jsonErr) {
          throw new GASError('INVALID_JSON', 'Failed to parse JSON response: ' + jsonErr.message, attempt);
        }

        if (data.code === 401) throw new GASError('UNAUTHORIZED', data.error, attempt);
        if (data.code === 429) throw new GASError('RATE_LIMITED', data.error, attempt);
        if (!data.ok) throw new GASError(data.error || 'API_ERROR', data.message, attempt);

        // Cache successful GET responses in localStorage for instant offline/error resilience
        if (action.startsWith('GET_') && data.ok) {
          try {
            localStorage.setItem('garda_cache_' + action, JSON.stringify(data));
          } catch {
            // Storage quota ignore
          }
        }

        return data;
      });

      return responseData;

    } catch (err) {
      if (err instanceof GASError && err.code === 'UNAUTHORIZED') throw err; 
      if (err instanceof GASError && err.code === 'RATE_LIMITED') throw err; 
      if (err.name === 'AbortError') throw new GASError('TIMEOUT', 'Request timeout', attempt);

      if (attempt === maxRetries) {
        // Fallback: if GET action fails completely, try to retrieve cached data to prevent blank screen
        if (action.startsWith('GET_')) {
          try {
            const cached = localStorage.getItem('garda_cache_' + action);
            if (cached) {
              const parsed = JSON.parse(cached);
              console.warn(`[gasClient] Using cached data for ${action} due to network/GAS error:`, err.message);
              return { ...parsed, fromCache: true };
            }
          } catch {
            // ignore
          }
        }
        throw err;
      }

      // Jittered exponential backoff
      const delay = (retryDelay * Math.pow(1.6, attempt - 1)) + (Math.random() * 300);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

export const api = {
  post: async (payload, options) => {
    const { action, ...rest } = payload;
    return gasFetch(action, rest, options);
  },
  
  async login(nik, password) {
    return this.post({ action: 'LOGIN', nik, password });
  },

  // Events API
  async getEvents() {
    return this.post({ action: 'GET_EVENTS' });
  },
  async createEvent(payload) {
    return this.post({ action: 'CREATE_EVENT', payload });
  },
  async updateEvent(id, payload) {
    return this.post({ action: 'UPDATE_EVENT', id, payload });
  },
  async deleteEvent(id) {
    return this.post({ action: 'DELETE_EVENT', id });
  },

  // Users API
  async getUsers() {
    return this.post({ action: 'GET_USERS' });
  },
  async createUser(payload) {
    return this.post({ action: 'CREATE_USER', payload });
  },
  async updateUser(id, payload) {
    return this.post({ action: 'UPDATE_USER', id, payload });
  },
  async updatePassword(nik, oldPassword, newPassword) {
    return this.post({ action: 'UPDATE_PASSWORD', payload: { nik, oldPassword, newPassword } });
  },
  async deleteUser(id) {
    return this.post({ action: 'DELETE_USER', id });
  },

  // Audit Logs API
  async getAuditLogs() {
    return this.post({ action: 'GET_AUDIT_LOGS' });
  },

  // Mess Management API
  async getMessBuildings() {
    return this.post({ action: 'GET_MESS_BUILDINGS' });
  },
  async createMessBuilding(payload) {
    return this.post({ action: 'CREATE_MESS_BUILDING', payload });
  },
  async updateMessBuilding(id, payload) {
    return this.post({ action: 'UPDATE_MESS_BUILDING', id, payload });
  },
  async deleteMessBuilding(id) {
    return this.post({ action: 'DELETE_MESS_BUILDING', id });
  },
  async getMessStays() {
    return this.post({ action: 'GET_MESS_STAYS' });
  },
  async batchUpdateStays(actions) {
    return this.post({ action: 'BATCH_UPDATE_STAYS', payload: { actions } });
  },

  // Assets Vendor Contracts
  async getVendorContracts() {
    return this.post({ action: 'GET_VENDOR_CONTRACTS' });
  },
  async createVendorContract(data) {
    return this.post({ action: 'CREATE_VENDOR_CONTRACT', payload: { data } });
  },
  async updateVendorContract(id, data) {
    return this.post({ action: 'UPDATE_VENDOR_CONTRACT', id, payload: { data } });
  },
  async deleteVendorContract(id) {
    return this.post({ action: 'DELETE_VENDOR_CONTRACT', id });
  },

  // Assets Unit Contracts
  async getUnitContracts() {
    return this.post({ action: 'GET_UNIT_CONTRACTS' });
  },
  async createUnitContract(data) {
    return this.post({ action: 'CREATE_UNIT_CONTRACT', payload: { data } });
  },
  async updateUnitContract(id, data) {
    return this.post({ action: 'UPDATE_UNIT_CONTRACT', id, payload: { data } });
  },
  async deleteUnitContract(id) {
    return this.post({ action: 'DELETE_UNIT_CONTRACT', id });
  },

  // Docs Invoices
  async getInvoices() {
    return this.post({ action: 'GET_INVOICES' });
  },
  async createInvoice(data) {
    return this.post({ action: 'CREATE_INVOICE', payload: { data } });
  },
  async updateInvoice(id, data) {
    return this.post({ action: 'UPDATE_INVOICE', id, payload: { data } });
  },
  async deleteInvoice(id) {
    return this.post({ action: 'DELETE_INVOICE', id });
  },
  async downloadFile(fileId) {
    return this.post({ action: 'DOWNLOAD_FILE', payload: { fileId } });
  },

  // Transport Ticketing
  async getTicketingRecords() {
    return this.post({ action: 'GET_TICKETING_RECORDS' });
  },
  async createTicketingRecord(data) {
    return this.post({ action: 'CREATE_TICKETING_RECORD', payload: { data } });
  },
  async batchImportTicketing(records, mode = 'append') {
    return this.post({ action: 'BATCH_IMPORT_TICKETING', payload: { records, mode } });
  },
  async deleteTicketingRecord(id) {
    return this.post({ action: 'DELETE_TICKETING_RECORD', id });
  },

  // Finance Portal
  async authFinancePortal(role, password) {
    return this.post({ action: 'FINANCE_PORTAL_AUTH', payload: { role, password } });
  },

  // File Upload
  async uploadFile(fileData, fileName) {
    return this.post({ action: 'UPLOAD_FILE', payload: { fileData, fileName } });
  },

  // Standards (SOP / WI / STD & FORM)
  async getStandards() {
    return this.post({ action: 'GET_STANDARDS' });
  },
  async createStandard(data) {
    return this.post({ action: 'CREATE_STANDARD', payload: { data } });
  },
  async updateStandard(id, data) {
    return this.post({ action: 'UPDATE_STANDARD', id, payload: { data } });
  },
  async deleteStandard(id) {
    return this.post({ action: 'DELETE_STANDARD', id });
  },
  // Backward compatibility aliases
  async getSopDocuments() {
    return this.getStandards();
  },
  async saveSopDocument(data) {
    if (data.id) {
      return this.updateStandard(data.id, data);
    }
    return this.createStandard(data);
  },
  async deleteSopDocument(id) {
    return this.deleteStandard(id);
  },

  // Catering Vendors Master
  async getCateringVendors() {
    return this.post({ action: 'GET_CATERING_VENDORS' });
  },
  async createCateringVendor(data) {
    return this.post({ action: 'CREATE_CATERING_VENDOR', payload: { data } });
  },
  async updateCateringVendor(id, data) {
    return this.post({ action: 'UPDATE_CATERING_VENDOR', id, payload: { data } });
  },
  async deleteCateringVendor(id) {
    return this.post({ action: 'DELETE_CATERING_VENDOR', id });
  },

  // Catering Weekly Food Index Scorings
  async getCateringScorings() {
    return this.post({ action: 'GET_CATERING_SCORINGS' });
  },
  async createCateringScoring(data) {
    return this.post({ action: 'CREATE_CATERING_SCORING', payload: { data } });
  },
  async updateCateringScoring(id, data) {
    return this.post({ action: 'UPDATE_CATERING_SCORING', id, payload: { data } });
  },
  async deleteCateringScoring(id) {
    return this.post({ action: 'DELETE_CATERING_SCORING', id });
  },

  // Database Setup / Sheet Init
  async setupNewTables() {
    return this.post({ action: 'SETUP_NEW_TABLES' });
  }
};
