const GAS_URL = import.meta.env.VITE_GAS_URL;
const API_SECRET = import.meta.env.VITE_API_SECRET;

// Get session email from sessionStorage to track rate limit
function getSessionEmail() {
  try {
    const raw = sessionStorage.getItem('garda_session');
    if (!raw) return null;
    const SALT = import.meta.env.VITE_SESSION_SALT || 'garda-internal-2024';
    const decoded = decodeURIComponent(atob(raw));
    const [json] = decoded.split('|' + SALT);
    const parsed = JSON.parse(json);
    return parsed.email || parsed.nik || null;
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

export async function gasFetch(action, payload = {}, options = {}) {
  const { maxRetries = 3, retryDelay = 1000 } = options;

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

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300_000); // 5 menit timeout untuk upload file besar

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
        return { ok: true, data: {} };
      }

      let fetchOptions = {
        method: 'POST',
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'follow',
      };

      let res;
      let text;
      
      if (hasFile) {
        // Ponytail Hack: Bypass GAS 10MB limit and JSON.parse OOM by sending metadata in URL and file as raw body
        const urlParams = new URLSearchParams();
        urlParams.append('action', bodyObj.action);
        urlParams.append('secret', bodyObj.secret);
        urlParams.append('userEmail', bodyObj.userEmail || '');
        
        // Ensure payload is small (fileData is removed)
        urlParams.append('payload', JSON.stringify(bodyObj.payload || {}));
        urlParams.append('fileName', fileName);

        // Convert File to Base64
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('Gagal membaca file'));
          reader.readAsDataURL(fileObj);
        });
        
        fetchOptions.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        fetchOptions.body = base64Data;
        
        const finalUrl = GAS_URL + (GAS_URL.includes('?') ? '&' : '?') + urlParams.toString();
        res = await fetch(finalUrl, fetchOptions);
        
        clearTimeout(timeoutId);
        text = await res.text();
      } else {
        fetchOptions.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        fetchOptions.body = JSON.stringify(bodyObj);

        res = await fetch(GAS_URL, fetchOptions);
        clearTimeout(timeoutId);
        text = await res.text();
      }
      
      if (text.startsWith('<')) {
        throw new GASError('HTML_RESPONSE', 'Google server returned HTML', attempt);
      }

      const data = JSON.parse(text);

      if (data.code === 401) throw new GASError('UNAUTHORIZED', data.error, attempt);
      if (data.code === 429) throw new GASError('RATE_LIMITED', data.error, attempt);
      if (!data.ok) throw new GASError(data.error || 'API_ERROR', data.message, attempt);

      return data;

    } catch (err) {
      if (err instanceof GASError && err.code === 'UNAUTHORIZED') throw err; 
      if (err instanceof GASError && err.code === 'RATE_LIMITED') throw err; 
      if (err.name === 'AbortError') throw new GASError('TIMEOUT', 'Request timeout', attempt);

      if (attempt === maxRetries) throw err;

      const delay = retryDelay * Math.pow(2, attempt - 1);
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

  // Finance Portal
  async authFinancePortal(role, password) {
    return this.post({ action: 'FINANCE_PORTAL_AUTH', payload: { role, password } });
  },

  // File Upload
  async uploadFile(fileData, fileName) {
    return this.post({ action: 'UPLOAD_FILE', payload: { fileData, fileName } });
  }
};
