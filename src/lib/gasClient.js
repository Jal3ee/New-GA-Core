const PG_API_URL = import.meta.env.VITE_PG_API_URL || '/api';

export async function gasFetch(action, payload = {}, options = {}) {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('garda_jwt_token') : null;

  // 1. UPLOAD BERKAS LANGSUNG KE SISTEM / DRIVE (100% REAL STORAGE, TANPA GAS & TANPA MOCK)
  if (action === 'UPLOAD_FILE') {
    let fileObj = null;
    let fileName = '';

    if (payload.payload && payload.payload.data && payload.payload.data.fileData instanceof File) {
      fileObj = payload.payload.data.fileData;
      fileName = payload.payload.data.fileName || fileObj.name;
    } else if (payload.fileData instanceof File) {
      fileObj = payload.fileData;
      fileName = payload.fileName || fileObj.name;
    }

    try {
      const formData = new FormData();
      if (fileObj) {
        formData.append('file', fileObj, fileName);
      } else {
        const rawData = payload.fileData || payload.payload?.data?.fileData;
        formData.append('fileBase64', rawData);
        formData.append('fileName', fileName || payload.fileName || 'berkas.pdf');
      }
      formData.append('moduleName', payload.moduleName || payload.payload?.moduleName || 'General');

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${PG_API_URL}/upload`, {
        method: 'POST',
        headers,
        body: formData
      });

      const json = await res.json().catch(() => null);
      if (res.ok && json && json.ok) {
        return json;
      }
      throw new Error(json?.error || `Upload gagal: HTTP ${res.status}`);
    } catch (uploadErr) {
      console.error('[Upload Error]:', uploadErr.message);
      throw uploadErr;
    }
  }

  // 2. SEMUA DATA CRUD BERJALAN 100% DI POSTGRESQL 16 ASLI (TIDAK ADA DUMMY / MOCK DATA)
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${PG_API_URL}/action`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload })
    });

    let json;
    try {
      json = await res.json();
    } catch (parseErr) {
      throw new Error(`Server API Error (HTTP ${res.status}): Respon bukan format JSON valid`);
    }

    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}: Gagal memproses permintaan ${action}`);
    }

    if (json.ok === false) {
      throw new Error(json.error || `Aksi ${action} gagal dieksekusi di database.`);
    }

    return json;
  } catch (err) {
    console.error(`[PostgreSQL 16 Error] ${action}:`, err.message);
    throw err;
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
  async testInvoiceWhatsApp() {
    return this.post({ action: 'TEST_INVOICE_WHATSAPP' });
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

  // Catering Incidents & Actions Tracker
  async getCateringIncidents() {
    return this.post({ action: 'GET_CATERING_INCIDENTS' });
  },
  async createCateringIncident(data) {
    return this.post({ action: 'CREATE_CATERING_INCIDENT', payload: { data } });
  },
  async updateCateringIncident(id, data) {
    return this.post({ action: 'UPDATE_CATERING_INCIDENT', id, payload: { data } });
  },
  async deleteCateringIncident(id) {
    return this.post({ action: 'DELETE_CATERING_INCIDENT', id });
  },
  async batchImportCateringIncidents(records, mode = 'append') {
    return this.post({ action: 'BATCH_IMPORT_CATERING_INCIDENTS', payload: { records, mode } });
  },

  // Reimbursement Tiket & Transport
  async getReimbursements() {
    return this.post({ action: 'GET_REIMBURSEMENTS' });
  },
  async createReimbursement(data) {
    return this.post({ action: 'CREATE_REIMBURSEMENT', payload: { data } });
  },
  async updateReimbursement(id, data) {
    return this.post({ action: 'UPDATE_REIMBURSEMENT', id, payload: { data } });
  },
  async deleteReimbursement(id) {
    return this.post({ action: 'DELETE_REIMBURSEMENT', id });
  },
  async batchImportReimbursements(records, mode = 'append') {
    return this.post({ action: 'BATCH_IMPORT_REIMBURSEMENTS', payload: { records, mode } });
  },

  // Database Setup / Sheet Init
  async setupNewTables() {
    return this.post({ action: 'SETUP_NEW_TABLES' });
  },

  // BHP Mess (Stok, Forecast & Rekap)
  async getBhpData() {
    return this.post({ action: 'GET_BHP_DATA' });
  },
  async saveBhpUsage(records) {
    return this.post({ action: 'SAVE_BHP_USAGE', payload: { records } });
  },
  async saveBhpStockIn(data) {
    return this.post({ action: 'SAVE_BHP_STOCK_IN', payload: { data } });
  },
  async saveBhpTransfer(data) {
    return this.post({ action: 'SAVE_BHP_TRANSFER', payload: { data } });
  },
  async saveBhpOpname(data) {
    return this.post({ action: 'SAVE_BHP_OPNAME', payload: { data } });
  },
  async saveBhpForecast(data) {
    return this.post({ action: 'SAVE_BHP_FORECAST', payload: { data } });
  },
  async saveBhpPdfHistory(data) {
    return this.post({ action: 'SAVE_BHP_PDF_HISTORY', payload: { data } });
  },
  async updateBhpItem(data) {
    return this.post({ action: 'UPDATE_BHP_ITEM', payload: { data } });
  },
  async updateBhpSiteParams(site, params) {
    return this.post({ action: 'UPDATE_BHP_SITE_PARAMS', payload: { site, params } });
  }
};
