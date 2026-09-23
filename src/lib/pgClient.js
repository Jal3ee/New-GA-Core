/**
 * PostgreSQL 16 Client Adapter for GA Core
 * Mendukung Transaction Pooler, Session Pooler, dan Direct Session.
 */

const PG_API_BASE = import.meta.env.VITE_PG_API_URL || '/api';

/**
 * Cek status koneksi PostgreSQL 16 & active pooler mode
 */
export async function checkPgHealth() {
  try {
    const res = await fetch(`${PG_API_BASE}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      status: 'offline',
      databaseEngine: 'PostgreSQL 16',
      error: err.message,
    };
  }
}

/**
 * Dapatkan informasi mode pooler yang tersedia
 */
export async function getPoolerModes() {
  try {
    const res = await fetch(`${PG_API_BASE}/modes`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return {
      availableModes: [
        { id: 'transaction', name: 'Transaction Pooler (Port 6543)', isCurrent: true },
        { id: 'session', name: 'Session Pooler (Port 5432)', isCurrent: false },
        { id: 'direct', name: 'Direct Session (Port 5432 Direct)', isCurrent: false }
      ],
      currentMode: 'transaction'
    };
  }
}

/**
 * Ambil seluruh data BHP Mess dari PostgreSQL 16
 */
export async function fetchPgBhpData() {
  try {
    const res = await fetch(`${PG_API_BASE}/bhp/data`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  } catch (err) {
    console.warn('[PG-Client] Gagal mengambil data BHP via PostgreSQL, beralih ke fallback:', err.message);
    return null;
  }
}

/**
 * Simpan pemakaian harian BHP ke PostgreSQL 16
 */
export async function savePgBhpUsage(payload) {
  const res = await fetch(`${PG_API_BASE}/bhp/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

/**
 * Simpan penerimaan barang masuk W5 ke PostgreSQL 16
 */
export async function savePgBhpStockIn(payload) {
  const res = await fetch(`${PG_API_BASE}/bhp/stock-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

/**
 * Simpan mutasi transfer stok antar site ke PostgreSQL 16
 */
export async function savePgBhpTransfer(payload) {
  const res = await fetch(`${PG_API_BASE}/bhp/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

/**
 * Simpan stock opname dan penyesuaian selisih ke PostgreSQL 16
 */
export async function savePgBhpOpname(payload) {
  const res = await fetch(`${PG_API_BASE}/bhp/opname`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

/**
 * Simpan jejak audit unduhan PDF ke PostgreSQL 16
 */
export async function savePgBhpPdfHistory(payload) {
  const res = await fetch(`${PG_API_BASE}/bhp/pdf-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}
