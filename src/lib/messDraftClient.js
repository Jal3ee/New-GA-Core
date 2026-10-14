const API_URL = import.meta.env.VITE_PG_API_URL || '/api';
async function request(path, method = 'GET', body) {
  const token = sessionStorage.getItem('garda_jwt_token') || localStorage.getItem('garda_jwt_token');
  const response = await fetch(`${API_URL}/mess/${path}`, {
    signal: AbortSignal.timeout(30000),
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || 'Draf belum dapat diproses.');
  return result.data;
}
export const messDraftApi = {
  list: () => request('drafts'),
  get: id => request(`drafts/${id}`),
  save: (id, data) => request(id ? `drafts/${id}` : 'drafts', id ? 'PUT' : 'POST', data),
  remove: (id, version) => request(`drafts/${id}`, 'DELETE', { version }),
  realize: data => request('simulation/realize', 'POST', data),
};
