async function request(path, { method = 'GET', data, publicRequest = false, signal } = {}) {
  const token = publicRequest ? null : (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('garda_jwt_token') : null);
  const response = await fetch(`/api/${path}`, {
    method, signal: signal || AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(!publicRequest && token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {})
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    if (response.status === 401 || response.status === 403) {
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('garda_jwt_token');
        }
      } catch {}
    }
    throw new Error(result?.message || result?.error || `Gagal mengakses data (HTTP ${response.status})`);
  }
  return result;
}

export const reimbursementClient = {
  getPeriodStatuses: () => request('reimbursements/period-status'),
  importPeriodStatuses: periods => request('reimbursements/period-status/import', { method: 'POST', data: { periods } }),
  savePeriodStatus: (key, data) => request(`reimbursements/period-status/${encodeURIComponent(key)}`, { method: 'PUT', data }),
  lookup: (nik, signal) => request('public/reimbursements/lookup', { method: 'POST', data: { nik }, publicRequest: true, signal })
};
