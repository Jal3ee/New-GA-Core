async function getAuthToken(forceRefresh = false) {
  if (typeof window === 'undefined') return null;
  if (!forceRefresh) {
    const existing = sessionStorage.getItem('garda_jwt_token') || localStorage.getItem('garda_jwt_token');
    if (existing) return existing;
  }


  return null;
}

async function request(path, { method = 'GET', data, publicRequest = false, signal, isRetry = false } = {}) {
  const token = publicRequest ? null : await getAuthToken(isRetry);
  const response = await fetch(`/api/${path}`, {
    method, signal: signal || AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(!publicRequest && token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {})
  });
  const result = await response.json().catch(() => null);

  // Jika token kedaluwarsa atau hilang (401), coba auto-renew token 1 kali secara transparan
  if (!publicRequest && !isRetry && response.status === 401) {
    const freshToken = await getAuthToken(true);
    if (freshToken) {
      return request(path, { method, data, publicRequest, signal, isRetry: true });
    }
  }

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message || result?.error || `Gagal mengakses data (HTTP ${response.status})`);
  }
  return result;
}

export const reimbursementClient = {
  getDocumentEdits: () => request('reimbursements/document-edits'),
  saveDocumentEdit: data => request('reimbursements/document-edits', { method:'PUT',data }),
  getPeriodStatuses: () => request('reimbursements/period-status'),
  importPeriodStatuses: periods => request('reimbursements/period-status/import', { method: 'POST', data: { periods } }),
  savePeriodStatus: (key, data) => request(`reimbursements/period-status/${encodeURIComponent(key)}`, { method: 'PUT', data }),
  lookup: (nik, signal) => request('public/reimbursements/lookup', { method: 'POST', data: { nik }, publicRequest: true, signal })
};
