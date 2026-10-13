async function request(path, { method = 'GET', data, publicRequest = false, signal } = {}) {
  const token = publicRequest ? null : sessionStorage.getItem('garda_jwt_token');
  const response = await fetch(`/api/${path}`, {
    method, signal: signal || AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(!publicRequest && token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {})
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.error || 'Data belum dapat diakses. Silakan coba lagi.');
  return result;
}

export const reimbursementClient = {
  getPeriodStatuses: () => request('reimbursements/period-status'),
  importPeriodStatuses: periods => request('reimbursements/period-status/import', { method: 'POST', data: { periods } }),
  savePeriodStatus: (key, data) => request(`reimbursements/period-status/${encodeURIComponent(key)}`, { method: 'PUT', data }),
  lookup: (nik, signal) => request('public/reimbursements/lookup', { method: 'POST', data: { nik }, publicRequest: true, signal })
};
