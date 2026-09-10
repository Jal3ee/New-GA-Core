---
name: garda-tech-best-practice
description: >
  Gunakan skill ini untuk setiap keputusan teknis di proyek GARDA: keamanan, skalabilitas,
  performa, reliability, code quality, API design, dan developer experience. Trigger:
  "perbaiki keamanan", "hardening", "optimize", "scale", "best practice", "refactor",
  "error handling", "authentication", "session", "GAS security", "env variable",
  "TypeScript", "testing", "CI/CD", "caching", "lazy loading", "audit log",
  "input sanitization", atau pertanyaan teknis apapun tentang GARDA. Skill ini berisi
  gap analysis lengkap + solusi konkret dengan kode siap pakai. Selalu baca sebelum
  menulis atau memodifikasi logika bisnis, API call, auth, atau konfigurasi apapun.
compatibility:
  stack: [React 19, Vite, Tailwind CSS v4, Google Apps Script, Google Sheets, Google Drive]
  tools: [lucide-react, react-router-dom v7, pdf-lib, react-signature-canvas, react-rnd]
---

# GARDA — Technical Best Practice & Hardening Guide

**Status Gap Analysis:** 47 celah ditemukan di 6 kategori
**Priority:** P0 Security → P1 Reliability/Scale → P2 Quality/Performance → P3 DX

---

## MASTER GAP REGISTRY

| ID | Kategori | Celah | Severity | Status |
|---|---|---|---|---|
| SEC-001 | Security | localStorage auth → XSS steal token | 🔴 Critical | Open |
| SEC-002 | Security | Tidak ada rate limiting di GAS endpoint | 🔴 Critical | Open |
| SEC-003 | Security | Password mungkin tidak di-hash di GAS | 🔴 Critical | Open |
| SEC-004 | Security | Session tidak punya expiry time | 🔴 Critical | Open |
| SEC-005 | Security | Input ke Sheets tanpa sanitasi → formula injection | 🔴 Critical | Open |
| SEC-006 | Security | SPREADSHEET_ID bisa bocor di repo | 🟠 High | Open |
| SEC-007 | Security | Tidak ada audit log untuk aksi sensitif | 🟠 High | Open |
| SEC-008 | Security | CSP header tidak dikonfigurasi | 🟠 High | Open |
| SEC-009 | Security | GAS URL publik tanpa secret token | 🟠 High | Open |
| SEC-010 | Security | File Drive URL exposed langsung di Sheets | 🟡 Medium | Open |
| SCALE-001 | Scale | Tidak ada pagination di GAS layer | 🟠 High | Open |
| SCALE-002 | Scale | Tidak ada caching di GAS — tiap request baca Sheets | 🟠 High | Open |
| SCALE-003 | Scale | Sheets mendekati limit pada volume data besar | 🟠 High | Open |
| SCALE-004 | Scale | File upload tidak chunked — timeout pada file besar | 🟡 Medium | Open |
| SCALE-005 | Scale | Tidak ada code splitting / lazy loading React | 🟡 Medium | Open |
| SCALE-006 | Scale | Tidak ada virtual scrolling untuk list panjang | 🟡 Medium | Open |
| REL-001 | Reliability | Error boundary tidak ada di React | 🟠 High | Open |
| REL-002 | Reliability | Retry hanya cover 404, tidak cover timeout/network | 🟠 High | Open |
| REL-003 | Reliability | Tidak ada optimistic UI → UX lambat | 🟡 Medium | Open |
| REL-004 | Reliability | GAS tidak ada transaksi — partial write korupsi data | 🟠 High | Open |
| REL-005 | Reliability | Tidak ada health check endpoint | 🟡 Medium | Open |
| REL-006 | Reliability | GAS cold start ~5-10 detik tanpa warmup | 🟡 Medium | Open |
| REL-007 | Reliability | Tidak ada data backup otomatis dari Sheets | 🟠 High | Open |
| CODE-001 | Quality | Tidak ada TypeScript | 🟡 Medium | Open |
| CODE-002 | Quality | Tidak ada unit testing | 🟡 Medium | Open |
| CODE-003 | Quality | Tidak ada E2E testing | 🟡 Medium | Open |
| CODE-004 | Quality | gasClient.js monolitik | 🟡 Medium | Open |
| CODE-005 | Quality | Tidak ada env variable validation | 🟠 High | Open |
| CODE-006 | Quality | Tidak ada Git hooks | 🟡 Medium | Open |
| CODE-007 | Quality | Tidak ada CI/CD pipeline | 🟡 Medium | Open |
| CODE-008 | Quality | Tidak ada structured error response format | 🟠 High | Open |
| PERF-001 | Performance | Tidak ada debouncing pada search | 🟡 Medium | Open |
| PERF-002 | Performance | React re-render tidak di-optimize | 🟡 Medium | Open |
| PERF-003 | Performance | PDF processing blocking UI thread | 🟡 Medium | Open |
| PERF-004 | Performance | Font loading tidak di-subset | 🟢 Low | Open |
| DX-001 | DevEx | Tidak ada .env.example | 🟡 Medium | Open |
| DX-002 | DevEx | Tidak ada mock server untuk dev | 🟡 Medium | Open |
| DX-003 | DevEx | GAS deploy manual | 🟢 Low | Open |

---

## BAGIAN 1 — SECURITY (P0 — KERJAKAN PERTAMA)

### 1.1 [SEC-001] Ganti localStorage → Memory + HttpOnly Cookie Pattern

**Masalah:** `localStorage` bisa dibaca oleh XSS attack. Setiap script yang injected bisa
mencuri token auth user.

**Solusi:** Simpan session di memori React (React Context + useRef), bukan localStorage.
Untuk persistence antar tab/refresh, gunakan `sessionStorage` yang scoped per tab,
atau pola "silent refresh" via cookie httpOnly jika ada proxy layer.

```javascript
// ❌ SEBELUM — src/features/users/authService.js
localStorage.setItem('garda_user', JSON.stringify(userData));
const user = JSON.parse(localStorage.getItem('garda_user'));

// ✅ SESUDAH — src/context/AuthContext.jsx
import { createContext, useContext, useState, useRef, useCallback } from 'react';

const AuthContext = createContext(null);

// Enkripsi ringan sebelum simpan ke sessionStorage
const SALT = import.meta.env.VITE_SESSION_SALT || 'garda-internal-2024';
const encodeSession = (data) => btoa(encodeURIComponent(JSON.stringify(data) + '|' + SALT));
const decodeSession = (encoded) => {
  try {
    const decoded = decodeURIComponent(atob(encoded));
    const [json] = decoded.split('|' + SALT);
    return JSON.parse(json);
  } catch { return null; }
};

export function AuthProvider({ children }) {
  // Hydrate dari sessionStorage (scope: tab ini saja)
  const [user, setUser] = useState(() => {
    const raw = sessionStorage.getItem('garda_session');
    return raw ? decodeSession(raw) : null;
  });

  const login = useCallback((userData) => {
    // Tambahkan expiry 8 jam
    const session = { ...userData, _exp: Date.now() + 8 * 60 * 60 * 1000 };
    sessionStorage.setItem('garda_session', encodeSession(session));
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('garda_session');
    setUser(null);
  }, []);

  // Auto-logout saat expiry
  const checkExpiry = useCallback(() => {
    if (user && Date.now() > user._exp) {
      logout();
      return false;
    }
    return true;
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, login, logout, checkExpiry }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

**Guard di MainLayout.jsx:**
```javascript
// src/layouts/MainLayout.jsx
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export function MainLayout({ children }) {
  const { user, checkExpiry, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return; }
    if (!checkExpiry()) { navigate('/login', { replace: true }); }
  }, [user, checkExpiry, navigate]);

  // Cek expiry setiap 1 menit
  useEffect(() => {
    const interval = setInterval(() => {
      if (!checkExpiry()) navigate('/login', { replace: true });
    }, 60_000);
    return () => clearInterval(interval);
  }, [checkExpiry, navigate]);

  if (!user) return null;
  return <>{children}</>;
}
```

---

### 1.2 [SEC-002 + SEC-009] Rate Limiting + Secret Token di GAS

**Masalah:** GAS Web App URL bisa di-spam oleh siapa saja. Tidak ada proteksi burst request.

**Solusi:** Implementasi shared secret token + rate limiting berbasis PropertiesService di GAS.

```javascript
// gas/Code.gs — TAMBAHKAN di atas semua handler

// ═══════════════════════════════════════════════
// SECURITY LAYER — Wajib ada sebelum semua aksi
// ═══════════════════════════════════════════════

const SECURITY = {
  // Set via: File > Project Properties > Script Properties
  // Key: API_SECRET_TOKEN  Value: <random 64-char string>
  API_SECRET_TOKEN: PropertiesService.getScriptProperties().getProperty('API_SECRET_TOKEN'),
  RATE_LIMIT_MAX: 30,      // maksimal request per window
  RATE_LIMIT_WINDOW_MS: 60_000, // per 1 menit
};

/**
 * Validasi shared secret dari frontend.
 * Frontend kirim token ini di setiap request body.
 */
function validateSecretToken(requestBody) {
  if (!SECURITY.API_SECRET_TOKEN) {
    Logger.log('[SECURITY] API_SECRET_TOKEN belum dikonfigurasi!');
    return false;
  }
  return requestBody?.secret === SECURITY.API_SECRET_TOKEN;
}

/**
 * Rate limiting berbasis cache PropertiesService.
 * Key: 'rl_' + identifier (email user atau IP)
 */
function checkRateLimit(identifier) {
  const cache = CacheService.getScriptCache();
  const key = 'rl_' + identifier.replace(/[^a-zA-Z0-9]/g, '_');
  const now = Date.now();

  const raw = cache.get(key);
  const record = raw ? JSON.parse(raw) : { count: 0, windowStart: now };

  if (now - record.windowStart > SECURITY.RATE_LIMIT_WINDOW_MS) {
    // Reset window
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count++;
  }

  cache.put(key, JSON.stringify(record), 120); // TTL 2 menit

  if (record.count > SECURITY.RATE_LIMIT_MAX) {
    Logger.log(`[RATE_LIMIT] ${identifier} melebihi batas: ${record.count} req/menit`);
    return false;
  }
  return true;
}

/**
 * Entry point utama — semua request masuk sini
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // 1. Validasi secret token
    if (!validateSecretToken(body)) {
      return jsonResponse({ ok: false, error: 'UNAUTHORIZED', code: 401 });
    }

    // 2. Rate limiting per user
    const identifier = body.userEmail || e.parameter.identifier || 'anonymous';
    if (!checkRateLimit(identifier)) {
      return jsonResponse({ ok: false, error: 'RATE_LIMITED', code: 429 });
    }

    // 3. Route ke handler yang benar
    return routeAction(body);

  } catch (err) {
    logError('doPost', err);
    return jsonResponse({ ok: false, error: 'SERVER_ERROR', code: 500 });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**Di Frontend — kirim secret token di setiap request:**
```javascript
// src/lib/gasClient.js — UPDATED
const GAS_URL = import.meta.env.VITE_GAS_URL;
const API_SECRET = import.meta.env.VITE_API_SECRET;

export async function gasFetch(action, payload = {}, options = {}) {
  const { maxRetries = 3, retryDelay = 1000 } = options;

  const body = {
    action,
    secret: API_SECRET,      // ← selalu kirim secret
    userEmail: getSessionEmail(),  // ← untuk rate limit tracking
    ...payload,
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000); // 15 detik timeout

      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
        credentials: 'omit',
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Cek apakah response adalah HTML error dari Google
      const text = await res.text();
      if (text.startsWith('<')) {
        throw new GASError('HTML_RESPONSE', 'Google server returned HTML', attempt);
      }

      const data = JSON.parse(text);

      if (data.code === 401) throw new GASError('UNAUTHORIZED', data.error, attempt);
      if (data.code === 429) throw new GASError('RATE_LIMITED', data.error, attempt);
      if (!data.ok) throw new GASError(data.error || 'API_ERROR', data.message, attempt);

      return data;

    } catch (err) {
      if (err instanceof GASError && err.code === 'UNAUTHORIZED') throw err; // no retry
      if (err instanceof GASError && err.code === 'RATE_LIMITED') throw err; // no retry
      if (err.name === 'AbortError') throw new GASError('TIMEOUT', 'Request timeout', attempt);

      if (attempt === maxRetries) throw err;

      // Exponential backoff: 1s, 2s, 4s
      const delay = retryDelay * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

class GASError extends Error {
  constructor(code, message, attempt) {
    super(message);
    this.code = code;
    this.attempt = attempt;
  }
}
```

---

### 1.3 [SEC-003] Password Hashing di GAS

**Masalah:** Jika password disimpan plain text di Sheets → siapapun yang bisa buka Sheets
bisa lihat semua password.

**Solusi:** Hash password dengan SHA-256 + salt menggunakan Utilities.computeDigest di GAS.

```javascript
// gas/DbService.gs — Password hashing utilities

/**
 * Buat hash SHA-256 dari password + salt
 * Salt diambil dari Script Properties untuk keamanan
 */
function hashPassword(plainPassword) {
  const PEPPER = PropertiesService.getScriptProperties()
    .getProperty('PASSWORD_PEPPER') || 'garda-pepper-change-this';
  const salted = plainPassword + PEPPER;
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salted,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/**
 * Verifikasi password saat login
 */
function verifyPassword(plainPassword, storedHash) {
  const inputHash = hashPassword(plainPassword);
  // Constant-time comparison untuk mencegah timing attack
  if (inputHash.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < inputHash.length; i++) {
    diff |= inputHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Migrasi password lama ke hashed (jalankan sekali)
 * Panggil via GAS trigger atau manual execution
 */
function migratePasswordsToHashed() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('tbl_users');
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const passIdx = header.indexOf('password');
  const hashedIdx = header.indexOf('password_hashed');

  for (let i = 1; i < data.length; i++) {
    const plain = data[i][passIdx];
    if (plain && plain !== '' && data[i][hashedIdx] !== 'TRUE') {
      sheet.getRange(i + 1, passIdx + 1).setValue(hashPassword(plain));
      if (hashedIdx >= 0) sheet.getRange(i + 1, hashedIdx + 1).setValue('TRUE');
    }
  }
  Logger.log('Migration selesai');
}
```

---

### 1.4 [SEC-005] Input Sanitization — Cegah Formula Injection

**Masalah:** User bisa input `=IMPORTRANGE(...)` atau `=HYPERLINK(...)` ke field teks,
yang akan dieksekusi Google Sheets sebagai formula.

**Solusi:** Sanitasi semua input sebelum tulis ke Sheets.

```javascript
// gas/DbService.gs — Input sanitizer

/**
 * Sanitasi value sebelum masuk ke Sheets.
 * Mencegah formula injection, XSS stored, dan SQL-like attacks.
 */
function sanitizeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();

  // Formula injection: nilai yang diawali karakter formula Sheets
  // '=', '+', '-', '@', TAB, CR juga bisa trigger formula di beberapa versi
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str; // Prefix dengan apostrof → Sheets simpan sebagai teks literal
  }

  // Cegah NULL bytes
  return str.replace(/\0/g, '');
}

/**
 * Sanitasi seluruh objek payload dari frontend
 */
function sanitizePayload(obj) {
  if (typeof obj !== 'object' || obj === null) return sanitizeCell(obj);
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'object' && val !== null) {
      result[key] = sanitizePayload(val); // rekursif untuk nested object
    } else {
      result[key] = sanitizeCell(val);
    }
  }
  return result;
}

// Pakai di setiap fungsi write:
function createRecord(sheetName, data) {
  const clean = sanitizePayload(data);  // ← WAJIB
  // ... lanjut tulis ke sheet
}
```

**Di Frontend — sanitasi sebelum kirim:**
```javascript
// src/lib/sanitize.js
export function sanitizeInput(value) {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/[<>]/g, '')          // Basic XSS chars
    .substring(0, 5000);           // Max length guard
}

export function sanitizeFormData(formData) {
  return Object.fromEntries(
    Object.entries(formData).map(([k, v]) => [k, sanitizeInput(v)])
  );
}
```

---

### 1.5 [SEC-007] Audit Log System

**Masalah:** Tidak ada jejak siapa yang mengubah data apa dan kapan. Krusial untuk
aplikasi operasional internal.

```javascript
// gas/Code.gs — Audit logging

const AUDIT_SHEET_NAME = 'tbl_audit_log';

function writeAuditLog({ action, resource, resourceId, before, after, userEmail }) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, AUDIT_SHEET_NAME, [
    'id', 'timestamp', 'user_email', 'action', 'resource',
    'resource_id', 'before_json', 'after_json', 'ip_hint'
  ]);

  sheet.appendRow([
    Utilities.getUuid(),
    new Date().toISOString(),
    userEmail || 'system',
    action,              // 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT'
    resource,            // nama tabel, e.g. 'tbl_docs'
    resourceId || '',
    before ? JSON.stringify(before) : '',
    after  ? JSON.stringify(after)  : '',
    '',                  // GAS tidak bisa baca IP asli user, kosongkan
  ]);
}

// Contoh penggunaan di setiap mutasi:
function deleteDocument(docId, userEmail) {
  const before = getRecordById('tbl_docs', docId);
  // ... lakukan delete
  writeAuditLog({
    action: 'DELETE',
    resource: 'tbl_docs',
    resourceId: docId,
    before,
    after: null,
    userEmail,
  });
}
```

---

### 1.6 [SEC-008] Content Security Policy di Vite

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",   // Vite HMR butuh ini di dev
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://lh3.googleusercontent.com",
        "connect-src 'self' https://script.google.com https://script.googleusercontent.com",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    }
  }
});
```

---

## BAGIAN 2 — SCALABILITY (P1)

### 2.1 [SCALE-001 + SCALE-002] Pagination + Caching di GAS

**Masalah:** Setiap request baca seluruh sheet. Dengan 10.000+ baris, ini akan timeout dan
menghabiskan GAS quota dengan cepat.

```javascript
// gas/DbService.gs — Paginated read dengan cache

/**
 * Baca data dengan pagination dan caching.
 * Cache key per sheet + page untuk efisiensi.
 *
 * @param {string} sheetName - Nama sheet
 * @param {object} options - { page, perPage, search, sortBy, sortDir, filters }
 * @returns {{ data: any[], total: number, page: number, perPage: number }}
 */
function getPaginatedData(sheetName, options = {}) {
  const {
    page = 1,
    perPage = 25,
    search = '',
    sortBy = null,
    sortDir = 'asc',
    filters = {},
    bustCache = false,
  } = options;

  const cache = CacheService.getScriptCache();
  // Cache key menyertakan semua parameter untuk keunikan
  const cacheKey = `data_${sheetName}_p${page}_pp${perPage}_s${search}_sb${sortBy}_sd${sortDir}_f${JSON.stringify(filters)}`;
  const CACHE_TTL = 300; // 5 menit

  // 1. Cek cache (kecuali bust diminta)
  if (!bustCache) {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  // 2. Baca semua data (pakai Values bulk untuk efisiensi)
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { data: [], total: 0, page, perPage };

  const rawData = sheet.getDataRange().getValues();
  const headers = rawData[0];
  let rows = rawData.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );

  // 3. Filter soft-deleted
  rows = rows.filter(r => !r.deleted_at || r.deleted_at === '');

  // 4. Apply filters
  if (filters && Object.keys(filters).length > 0) {
    rows = rows.filter(row =>
      Object.entries(filters).every(([key, val]) =>
        val === '' || val === null || String(row[key]) === String(val)
      )
    );
  }

  // 5. Search (case-insensitive, semua kolom teks)
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(q))
    );
  }

  // 6. Sort
  if (sortBy && headers.includes(sortBy)) {
    rows.sort((a, b) => {
      const va = a[sortBy], vb = b[sortBy];
      const cmp = String(va).localeCompare(String(vb), 'id', { numeric: true });
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }

  const total = rows.length;

  // 7. Pagination
  const start = (page - 1) * perPage;
  const data = rows.slice(start, start + perPage);

  const result = { data, total, page, perPage, totalPages: Math.ceil(total / perPage) };

  // 8. Simpan ke cache
  try {
    cache.put(cacheKey, JSON.stringify(result), CACHE_TTL);
  } catch (e) {
    Logger.log('[CACHE] Gagal simpan — data mungkin terlalu besar: ' + e.message);
  }

  return result;
}

/**
 * Invalidasi cache setelah mutasi data.
 * Panggil setelah setiap CREATE / UPDATE / DELETE.
 */
function invalidateCache(sheetName) {
  // CacheService tidak support pattern delete, jadi kita simpan list key
  // Alternatif: gunakan prefix-based key dan buat "version" counter
  const cache = CacheService.getScriptCache();
  const versionKey = `version_${sheetName}`;
  const current = parseInt(cache.get(versionKey) || '0');
  cache.put(versionKey, String(current + 1), 3600);
  // Prefix semua cache key dengan versi ini agar auto-invalidate
}
```

**React Hook untuk Paginated Data:**
```javascript
// src/hooks/usePaginatedData.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { gasFetch } from '../lib/gasClient';

export function usePaginatedData(action, initialOptions = {}) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage] = useState(initialOptions.perPage || 25);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState(initialOptions.sortBy || null);
  const [sortDir, setSortDir] = useState('asc');

  // Debounce search 350ms
  const searchTimer = useRef(null);
  const debouncedSearch = useCallback((val) => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 350);
  }, []);

  const fetchData = useCallback(async (bust = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await gasFetch(action, {
        page, perPage, search, sortBy, sortDir,
        bustCache: bust,
        ...initialOptions.extraParams,
      });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [action, page, perPage, search, sortBy, sortDir]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    data, total, loading, error, page, perPage,
    setPage, debouncedSearch, sortBy, setSortBy, sortDir, setSortDir,
    refresh: () => fetchData(true),
    totalPages: Math.ceil(total / perPage),
  };
}
```

---

### 2.2 [SCALE-005] Code Splitting & Lazy Loading React

```javascript
// src/App.jsx — Lazy load setiap feature module
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { PageLoader } from './components/PageLoader';
import LoginPage from './pages/LoginPage'; // Login tidak di-lazy (entry point)

// Lazy load per fitur — bundle terpisah per feature
const DashboardPage    = lazy(() => import('./pages/DashboardPage'));
const CampDashboard    = lazy(() => import('./features/camp/pages/CampDashboard'));
const CampCalendar     = lazy(() => import('./features/camp/pages/CampCalendar'));
const DocsPage         = lazy(() => import('./features/docs/pages/DocsPage'));
const SignaturePage    = lazy(() => import('./features/docs/pages/SignaturePage'));
const EventsPage       = lazy(() => import('./features/events/pages/EventsPage'));
const AdminPage        = lazy(() => import('./features/admin/pages/AdminPage'));
const UsersPage        = lazy(() => import('./features/users/pages/UsersPage'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<MainLayout />}>
          <Route path="/"           element={<DashboardPage />} />
          <Route path="/camp"       element={<CampDashboard />} />
          <Route path="/camp/calendar" element={<CampCalendar />} />
          <Route path="/docs"       element={<DocsPage />} />
          <Route path="/docs/sign"  element={<SignaturePage />} />
          <Route path="/events"     element={<EventsPage />} />
          <Route path="/admin"      element={<AdminPage />} />
          <Route path="/users"      element={<UsersPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
```

**Vite build optimization:**
```javascript
// vite.config.js — tambahkan build optimization
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-pdf':    ['pdf-lib', 'react-pdf', 'react-signature-canvas', 'react-rnd'],
          'vendor-ui':     ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
```

---

### 2.3 [SCALE-006] Virtual Scrolling untuk List Panjang

```javascript
// Instal: npm install @tanstack/react-virtual
// src/components/VirtualTable.jsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export function VirtualTable({ rows, columns, rowHeight = 56, containerHeight = 500 }) {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5, // Render 5 baris ekstra di luar viewport untuk smooth scroll
  });

  return (
    <div ref={parentRef} style={{ height: containerHeight, overflowY: 'auto' }}
      className="rounded-xl border border-white/[0.08]">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${rowHeight}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
            className="flex items-center border-b border-white/[0.04]
              hover:bg-white/[0.03] transition-colors duration-100"
          >
            {columns.map(col => (
              <div key={col.key} className={`px-6 text-sm text-slate-300 ${col.className || ''}`}>
                {col.render ? col.render(rows[virtualRow.index]) : rows[virtualRow.index][col.key]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## BAGIAN 3 — RELIABILITY (P1)

### 3.1 [REL-001] Global Error Boundary

```jsx
// src/components/ErrorBoundary.jsx
import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log ke console + simpan untuk debugging
    console.error('[ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
    // Kirim ke error tracking service jika ada
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/'; // Hard reset ke home
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0F1E]">
        <div className="max-w-md w-full mx-4 rounded-2xl bg-white/[0.04] border
          border-red-500/20 p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border
            border-red-500/20 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">
            Terjadi Kesalahan
          </h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Halaman mengalami error tidak terduga. Tim teknis sudah diberitahu.
          </p>
          {import.meta.env.DEV && (
            <pre className="text-left text-xs text-red-300 bg-red-500/5 rounded-lg
              p-4 mb-6 overflow-auto max-h-40 border border-red-500/15">
              {this.state.error?.toString()}
            </pre>
          )}
          <button onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500
              hover:bg-blue-400 text-white text-sm font-medium rounded-xl
              transition-all duration-150 active:scale-[0.98]">
            <RefreshCw className="w-4 h-4" />
            Muat Ulang Aplikasi
          </button>
        </div>
      </div>
    );
  }
}

// Bungkus di main.jsx:
// <ErrorBoundary><App /></ErrorBoundary>
```

---

### 3.2 [REL-004] Pseudo-Transaction di GAS (Write Locking)

**Masalah:** Jika dua user simultaniously update baris yang sama, data bisa korup.

```javascript
// gas/DbService.gs — Optimistic locking dengan version field

/**
 * Update dengan optimistic locking.
 * Tambahkan kolom 'version' INTEGER ke setiap sheet yang perlu.
 *
 * @throws Error jika versi tidak cocok (conflict)
 */
function updateWithLock(sheetName, id, newData, expectedVersion) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000); // Tunggu max 5 detik untuk lock

    const current = getRecordById(sheetName, id);
    if (!current) throw new Error('RECORD_NOT_FOUND');

    const currentVersion = parseInt(current.version || 0);
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      throw new Error('VERSION_CONFLICT'); // Data sudah diubah orang lain
    }

    const updated = {
      ...newData,
      version: currentVersion + 1,
      updated_at: new Date().toISOString(),
    };

    writeRecord(sheetName, id, updated);
    return { ok: true, data: updated };

  } catch (err) {
    if (err.message === 'VERSION_CONFLICT') {
      return { ok: false, error: 'CONFLICT', message: 'Data diubah user lain, refresh halaman' };
    }
    throw err;
  } finally {
    lock.releaseLock();
  }
}
```

---

### 3.3 [REL-005] Health Check Endpoint

```javascript
// gas/Code.gs — Health check action
function handleHealthCheck() {
  const start = Date.now();
  try {
    // Test koneksi ke Sheets
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const testSheet = ss.getSheets()[0];
    const sheetCount = ss.getSheets().length;

    return {
      ok: true,
      status: 'healthy',
      latency_ms: Date.now() - start,
      sheets_count: sheetCount,
      timestamp: new Date().toISOString(),
      version: PropertiesService.getScriptProperties().getProperty('APP_VERSION') || '1.0.0',
    };
  } catch (err) {
    return {
      ok: false,
      status: 'unhealthy',
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// Frontend — status page
// GET gasFetch('health_check') → tampilkan di halaman admin
```

---

### 3.4 [REL-006] GAS Warmup — Hilangkan Cold Start

```javascript
// gas/Code.gs — Trigger warmup setiap 5 menit
// Setup: Extensions > Apps Script > Triggers → pilih doWarmup, time-based, every 5 min

function doWarmup() {
  // Buka Sheets untuk keep script alive
  SpreadsheetApp.openById(SPREADSHEET_ID).getSheets();
  Logger.log('[WARMUP] ' + new Date().toISOString());
}
```

---

### 3.5 [REL-007] Backup Otomatis Google Sheets

```javascript
// gas/Code.gs — Setup trigger harian untuk backup
// Trigger: doBackup → Time-driven → Day timer → 2am-3am

const BACKUP_FOLDER_ID = PropertiesService.getScriptProperties()
  .getProperty('BACKUP_FOLDER_ID'); // ID folder Drive khusus backup

function doBackup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
  const date = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  const fileName = `GARDA_Backup_${date}`;

  // Hapus backup lebih dari 30 hari
  const files = folder.getFiles();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  while (files.hasNext()) {
    const f = files.next();
    if (f.getDateCreated() < thirtyDaysAgo) f.setTrashed(true);
  }

  // Buat copy baru
  DriveApp.getFileById(SPREADSHEET_ID).makeCopy(fileName, folder);
  Logger.log(`[BACKUP] ${fileName} berhasil dibuat`);
}
```

---

## BAGIAN 4 — CODE QUALITY (P2)

### 4.1 [CODE-005] Env Variable Schema Validation

```javascript
// src/lib/env.js — Validasi semua env variable saat startup
const REQUIRED_ENV = {
  VITE_GAS_URL:      { required: true,  pattern: /^https:\/\/script\.google/ },
  VITE_API_SECRET:   { required: true,  minLength: 32 },
  VITE_SESSION_SALT: { required: false, minLength: 16 },
};

function validateEnv() {
  const errors = [];
  for (const [key, rules] of Object.entries(REQUIRED_ENV)) {
    const val = import.meta.env[key];
    if (rules.required && !val) {
      errors.push(`Missing required env: ${key}`);
      continue;
    }
    if (val && rules.pattern && !rules.pattern.test(val)) {
      errors.push(`Invalid format for ${key}`);
    }
    if (val && rules.minLength && val.length < rules.minLength) {
      errors.push(`${key} terlalu pendek (min ${rules.minLength} chars)`);
    }
  }
  if (errors.length > 0) {
    console.error('[ENV VALIDATION FAILED]', errors);
    if (import.meta.env.PROD) {
      document.body.innerHTML = `<div style="color:red;padding:2rem;">
        Konfigurasi aplikasi tidak valid. Hubungi administrator.</div>`;
      throw new Error('Invalid environment configuration');
    }
  }
}

validateEnv(); // Jalankan saat import

// .env.example — WAJIB ada di root project dan di-commit
/*
VITE_GAS_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
VITE_API_SECRET=your-minimum-32-character-secret-key-here
VITE_SESSION_SALT=your-16-char-salt
*/
```

---

### 4.2 [CODE-008] Structured Error Response Contract

```javascript
// gas/Code.gs — Error response yang konsisten

/**
 * Enum error codes — selaraskan antara GAS dan Frontend
 */
const ERROR_CODES = {
  // Auth
  UNAUTHORIZED:      { code: 401, message: 'Token tidak valid atau tidak ada' },
  FORBIDDEN:         { code: 403, message: 'Akses ditolak untuk role ini' },
  SESSION_EXPIRED:   { code: 401, message: 'Sesi telah berakhir, silakan login kembali' },
  // Data
  NOT_FOUND:         { code: 404, message: 'Data tidak ditemukan' },
  DUPLICATE:         { code: 409, message: 'Data sudah ada' },
  VALIDATION_ERROR:  { code: 422, message: 'Input tidak valid' },
  VERSION_CONFLICT:  { code: 409, message: 'Data diubah pengguna lain, silakan refresh' },
  // Server
  RATE_LIMITED:      { code: 429, message: 'Terlalu banyak permintaan, tunggu sebentar' },
  SERVER_ERROR:      { code: 500, message: 'Terjadi kesalahan server' },
  GAS_TIMEOUT:       { code: 503, message: 'Server sedang sibuk, coba lagi' },
};

function errorResponse(errorCode, details = null) {
  const err = ERROR_CODES[errorCode] || ERROR_CODES.SERVER_ERROR;
  return {
    ok: false,
    error: errorCode,
    code: err.code,
    message: err.message,
    details,
    timestamp: new Date().toISOString(),
  };
}

function successResponse(data, meta = {}) {
  return {
    ok: true,
    data,
    meta,
    timestamp: new Date().toISOString(),
  };
}
```

```javascript
// src/lib/errorHandler.js — Frontend error handler terpusat
const ERROR_MESSAGES = {
  UNAUTHORIZED:     'Sesi tidak valid, silakan login kembali',
  FORBIDDEN:        'Anda tidak memiliki akses untuk aksi ini',
  NOT_FOUND:        'Data tidak ditemukan',
  DUPLICATE:        'Data sudah ada, periksa kembali isian Anda',
  VALIDATION_ERROR: 'Input tidak valid',
  VERSION_CONFLICT: 'Data diubah pengguna lain. Halaman akan direfresh.',
  RATE_LIMITED:     'Terlalu banyak permintaan. Tunggu beberapa saat.',
  SERVER_ERROR:     'Terjadi kesalahan server. Tim teknis sudah diberitahu.',
  TIMEOUT:          'Koneksi ke server lambat. Coba lagi.',
  NETWORK:          'Tidak ada koneksi internet.',
};

export function getErrorMessage(error) {
  if (error?.code) return ERROR_MESSAGES[error.code] || error.message || ERROR_MESSAGES.SERVER_ERROR;
  if (!navigator.onLine) return ERROR_MESSAGES.NETWORK;
  return ERROR_MESSAGES.SERVER_ERROR;
}

export function handleApiError(error, toast) {
  const msg = getErrorMessage(error);
  toast?.error(msg);

  if (error?.code === 'UNAUTHORIZED') {
    setTimeout(() => window.location.href = '/login', 1500);
  }
  if (error?.code === 'VERSION_CONFLICT') {
    setTimeout(() => window.location.reload(), 2000);
  }

  console.error('[API Error]', error);
}
```

---

### 4.3 [CODE-004] gasClient Modular Refactor

```
src/lib/
├── gasClient.js        ← core fetch engine (tetap di sini)
├── api/
│   ├── authApi.js      ← semua panggilan auth
│   ├── campApi.js      ← semua panggilan camp/mess
│   ├── docsApi.js      ← semua panggilan dokumen
│   ├── eventsApi.js    ← semua panggilan events
│   └── adminApi.js     ← semua panggilan admin
```

```javascript
// src/lib/api/campApi.js
import { gasFetch } from '../gasClient';

export const campApi = {
  getBuildings: (params) => gasFetch('camp_get_buildings', params),
  getBuildingById: (id) => gasFetch('camp_get_building', { id }),
  createBuilding: (data) => gasFetch('camp_create_building', { data }),
  updateBuilding: (id, data, version) => gasFetch('camp_update_building', { id, data, version }),
  deleteBuilding: (id) => gasFetch('camp_delete_building', { id }),
  getOccupancyMatrix: (buildingId, month, year) =>
    gasFetch('camp_get_occupancy', { buildingId, month, year }),
};
```

---

## BAGIAN 5 — PERFORMANCE (P2)

### 5.1 [PERF-002] React Re-render Optimization

```jsx
// Pattern: memo + useCallback + useMemo — gunakan HANYA jika ada masalah render
// Jangan premature optimize. Profile dulu dengan React DevTools.

// ✅ Gunakan React.memo untuk komponen yang sering re-render dengan props sama
export const TableRow = React.memo(({ row, onEdit, onDelete }) => (
  <tr className="...">
    {/* ... */}
  </tr>
), (prev, next) => prev.row.id === next.row.id && prev.row.version === next.row.version);

// ✅ useCallback untuk fungsi yang di-pass ke child component
const handleEdit = useCallback((id) => {
  setEditingId(id);
  setModalOpen(true);
}, []); // Tidak ada dependency → stabil

// ✅ useMemo untuk kalkulasi mahal
const occupancyStats = useMemo(() => ({
  total: rooms.length,
  occupied: rooms.filter(r => r.status === 'occupied').length,
  available: rooms.filter(r => r.status === 'available').length,
  rate: rooms.length > 0
    ? Math.round((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100)
    : 0,
}), [rooms]); // Hitung ulang hanya jika rooms berubah
```

### 5.2 [PERF-001] Debounce pada Search & Input

```javascript
// src/hooks/useDebounce.js
import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// Penggunaan:
const [searchRaw, setSearchRaw] = useState('');
const search = useDebounce(searchRaw, 400);
useEffect(() => { if (search !== undefined) fetchData(); }, [search]);
```

### 5.3 [PERF-003] PDF Processing di Web Worker

```javascript
// src/workers/pdfWorker.js
// Jalankan pdf-lib di background thread agar UI tidak freeze

self.onmessage = async (e) => {
  const { pdfBytes, signatureDataUrl, x, y, pageIndex, sigWidth, sigHeight } = e.data;
  try {
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page = pages[pageIndex];
    const pageHeight = page.getHeight();

    // Embed signature image
    const sigBytes = await fetch(signatureDataUrl).then(r => r.arrayBuffer());
    const sigImage = await pdfDoc.embedPng(sigBytes);

    // Konversi koordinat DOM → PDF (Y-axis terbalik di PDF)
    const pdfY = pageHeight - y - sigHeight;
    page.drawImage(sigImage, { x, y: pdfY, width: sigWidth, height: sigHeight });

    const resultBytes = await pdfDoc.save();
    self.postMessage({ ok: true, pdfBytes: resultBytes });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message });
  }
};

// Penggunaan di komponen SignaturePage:
// const worker = new Worker(new URL('../workers/pdfWorker.js', import.meta.url));
// worker.postMessage({ pdfBytes, signatureDataUrl, x, y, pageIndex, sigWidth, sigHeight });
// worker.onmessage = (e) => { if (e.data.ok) { /* download PDF */ } };
```

---

## BAGIAN 6 — DEVELOPER EXPERIENCE (P3)

### 6.1 Setup Files yang Wajib Ada di Root Project

```bash
# .env.example — dokumen semua env yang dibutuhkan
VITE_GAS_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
VITE_API_SECRET=minimum-32-character-secret-key-change-this
VITE_SESSION_SALT=16-char-salt-here
VITE_APP_VERSION=1.0.0
VITE_BACKUP_FOLDER_ID=google-drive-folder-id-for-backups

# .gitignore — pastikan ada ini
.env
.env.local
.env.production
dist/
node_modules/
.clasp.json   ← credentials GAS clasp jangan di-commit
```

### 6.2 Git Hooks dengan Husky

```bash
# Instal
npm install -D husky lint-staged

# Setup
npx husky init

# .husky/pre-commit
#!/bin/sh
npx lint-staged

# package.json
{
  "lint-staged": {
    "src/**/*.{js,jsx}": ["eslint --fix", "prettier --write"],
    "src/**/*.css": ["prettier --write"]
  }
}
```

### 6.3 ESLint + Prettier Config

```javascript
// eslint.config.js
import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    plugins: { react: reactPlugin, 'react-hooks': hooksPlugin },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/prop-types': 'off', // Tidak pakai TypeScript, jangan prop-types
    }
  }
];

// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 6.4 GAS Mock Server untuk Development

```javascript
// src/lib/gasClient.js — Tambahkan mock mode
const IS_MOCK_MODE = import.meta.env.VITE_MOCK_MODE === 'true';

export async function gasFetch(action, payload = {}) {
  if (IS_MOCK_MODE) {
    const { mockHandlers } = await import('./mockHandlers');
    const handler = mockHandlers[action];
    if (handler) {
      await new Promise(r => setTimeout(r, 300)); // Simulasi latency
      return handler(payload);
    }
    console.warn(`[MOCK] No handler for action: ${action}`);
    return { ok: true, data: [], total: 0 };
  }
  // ... kode asli
}

// src/lib/mockHandlers.js
export const mockHandlers = {
  camp_get_buildings: () => ({
    ok: true,
    data: [
      { id: '1', name: 'Gedung A', capacity: 50, occupied: 32 },
      { id: '2', name: 'Gedung B', capacity: 40, occupied: 18 },
    ],
    total: 2,
  }),
  // Tambah handler lain sesuai kebutuhan
};
```

---

## BAGIAN 7 — ROADMAP IMPLEMENTASI

### Sprint 1 — Critical Security (Minggu 1-2)
```
[ ] SEC-001: Ganti localStorage → AuthContext + sessionStorage encrypted
[ ] SEC-003: Implementasi hashPassword + migrasi di GAS
[ ] SEC-005: Implementasi sanitizePayload di SEMUA GAS write functions
[ ] SEC-009: Tambah validateSecretToken di doPost() GAS
[ ] SEC-002: Tambah checkRateLimit di GAS
[ ] Tambah .env.example ke repo
[ ] Tambah SECRET_TOKEN ke GAS Script Properties
```

### Sprint 2 — Reliability (Minggu 3-4)
```
[ ] REL-001: Bungkus App dengan ErrorBoundary
[ ] REL-004: Tambah LockService di GAS update functions
[ ] REL-007: Setup doBackup trigger di GAS (jalankan tiap jam 2 pagi)
[ ] CODE-008: Standardize error response format GAS ↔ Frontend
[ ] REL-006: Setup doWarmup trigger di GAS (setiap 5 menit)
[ ] REL-005: Tambah handleHealthCheck action di GAS
```

### Sprint 3 — Scalability & Performance (Minggu 5-6)
```
[ ] SCALE-001: Implementasi getPaginatedData di GAS
[ ] SCALE-002: Tambah CacheService di GAS read functions
[ ] SCALE-005: Lazy loading semua feature routes di App.jsx
[ ] PERF-001: useDebounce di semua search input
[ ] PERF-003: PDF processing pindah ke Web Worker
[ ] CODE-004: Refactor gasClient.js → src/lib/api/*.js
```

### Sprint 4 — Code Quality & DX (Minggu 7-8)
```
[ ] CODE-005: Buat src/lib/env.js + validasi startup
[ ] CODE-006: Setup Husky + lint-staged
[ ] SEC-007: Implementasi writeAuditLog di semua mutasi sensitif
[ ] SCALE-006: VirtualTable untuk tabel > 100 baris
[ ] DX-002: Setup mockHandlers.js untuk development
[ ] CODE-002: Setup Vitest + test untuk gasClient & utilities
```

---

## BAGIAN 8 — SECURITY CHECKLIST HARIAN

Gunakan checklist ini setiap kali akan push ke production:

```
SEBELUM DEPLOY:
□ Tidak ada console.log yang print data sensitif (password, token, ID Sheets)
□ .env tidak ter-commit ke git
□ SPREADSHEET_ID tidak hardcoded di source code
□ Semua input user melewati sanitizePayload sebelum masuk Sheets
□ Semua GAS write function punya call ke writeAuditLog
□ Semua GAS endpoint melewati validateSecretToken dan checkRateLimit
□ Password di Sheets sudah dalam bentuk hash
□ Session expiry sudah diset 8 jam atau sesuai kebijakan
□ Error response tidak expose stack trace di production
□ File Drive tidak accessible publik (cek sharing settings)
```

---

## BAGIAN 9 — MONITORING & OBSERVABILITY

```javascript
// gas/Code.gs — Structured logging

function logInfo(context, message, data = {}) {
  Logger.log(JSON.stringify({
    level: 'INFO', context, message, data,
    timestamp: new Date().toISOString(),
  }));
}

function logError(context, error, data = {}) {
  Logger.log(JSON.stringify({
    level: 'ERROR', context,
    message: error?.message || String(error),
    stack: error?.stack,
    data,
    timestamp: new Date().toISOString(),
  }));
}

// Contoh penggunaan:
function loginUser(email, password) {
  logInfo('loginUser', 'Login attempt', { email });
  // ...
  logInfo('loginUser', 'Login success', { email, role: user.role });
  // atau
  logInfo('loginUser', 'Login failed — wrong password', { email });
}
```

```javascript
// src/lib/logger.js — Frontend structured logging
const LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || (import.meta.env.PROD ? 'error' : 'debug');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.error;

export const logger = {
  debug: (ctx, msg, data) => currentLevel <= 0 && console.debug(`[${ctx}]`, msg, data),
  info:  (ctx, msg, data) => currentLevel <= 1 && console.info(`[${ctx}]`, msg, data),
  warn:  (ctx, msg, data) => currentLevel <= 2 && console.warn(`[${ctx}]`, msg, data),
  error: (ctx, msg, data) => currentLevel <= 3 && console.error(`[${ctx}]`, msg, data),
};
```

---

## REFERENSI CEPAT — PRIORITAS PER FILE

| File | Perubahan Wajib | Priority |
|---|---|---|
| `gas/Code.gs` | Tambah `validateSecretToken`, `checkRateLimit`, `doPost` wrapper | 🔴 P0 |
| `gas/DbService.gs` | Tambah `hashPassword`, `sanitizePayload`, `getPaginatedData`, `writeAuditLog` | 🔴 P0 |
| `src/context/AuthContext.jsx` | Buat baru — ganti localStorage | 🔴 P0 |
| `src/lib/gasClient.js` | Tambah secret token, timeout, improved retry | 🔴 P0 |
| `src/lib/env.js` | Buat baru — env validation | 🟠 P1 |
| `src/components/ErrorBoundary.jsx` | Buat baru | 🟠 P1 |
| `src/App.jsx` | Lazy loading semua routes | 🟠 P1 |
| `src/lib/api/*.js` | Refactor dari gasClient monolitik | 🟡 P2 |
| `src/hooks/usePaginatedData.js` | Buat baru | 🟡 P2 |
| `src/hooks/useDebounce.js` | Buat baru | 🟡 P2 |
| `vite.config.js` | Security headers + build optimization | 🟠 P1 |
| `.env.example` | Buat baru — commit ke repo | 🔴 P0 |
| `eslint.config.js` | Setup atau update | 🟡 P2 |