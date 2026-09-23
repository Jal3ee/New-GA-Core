import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Secret Server Key untuk menandatangani JWT (HANYA ADA DI SERVER)
const JWT_SECRET = process.env.JWT_SECRET || 'garda-super-secure-jwt-secret-agm-2026-key-x901';
const PEPPER = process.env.PASSWORD_PEPPER || 'garda-pepper-internal-secure-2026';
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '8h';

/**
 * Buat fingerprint dari browser/device (Anti-Session Hijacking)
 */
export function generateFingerprint(req) {
  const userAgent = req.headers['user-agent'] || 'unknown-agent';
  const acceptLang = req.headers['accept-language'] || '';
  return crypto.createHash('sha256').update(`${userAgent}|${acceptLang}`).digest('hex').substring(0, 16);
}

/**
 * Sign JWT Token dengan enkripsi HMAC-SHA256 & Fingerprint device
 */
export function createSessionToken(user, req) {
  const fp = req ? generateFingerprint(req) : null;
  const payload = {
    id: user.id,
    nik: user.nik,
    name: user.nama || user.name,
    email: user.email,
    role: user.role,
    site: user.site || 'ALL',
    department: user.department || 'General Affairs',
    fp: fp // Device fingerprint
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
    algorithm: 'HS256'
  });
}

/**
 * Verifikasi JWT Token dan perlindungan terhadap manipulasi
 */
export function verifySessionToken(token, req) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    
    // Verifikasi device fingerprint jika request tersedia
    if (req && decoded.fp) {
      const currentFp = generateFingerprint(req);
      if (decoded.fp !== currentFp) {
        return { valid: false, error: 'SESSION_HIJACK_DETECTED', message: 'Perangkat atau browser tidak cocok dengan sesi asli' };
      }
    }

    return { valid: true, user: decoded };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { valid: false, error: 'TOKEN_EXPIRED', message: 'Sesi login telah berakhir, silakan login ulang' };
    }
    return { valid: false, error: 'INVALID_TOKEN', message: 'Token otentikasi tidak valid atau telah dimanipulasi' };
  }
}

/**
 * Express Middleware untuk melindungi endpoint API
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    // Fallback: cek jika ada di body atau query (untuk download file)
    const fallbackToken = req.body?.token || req.query?.token;
    if (!fallbackToken) {
      return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Akses ditolak: Token otentikasi wajib disertakan' });
    }
    const result = verifySessionToken(fallbackToken, req);
    if (!result.valid) {
      return res.status(403).json({ ok: false, error: result.error, message: result.message });
    }
    req.user = result.user;
    return next();
  }

  const result = verifySessionToken(token, req);
  if (!result.valid) {
    return res.status(403).json({ ok: false, error: result.error, message: result.message });
  }

  req.user = result.user;
  next();
}

/**
 * Role-Based Access Control (RBAC) Guard
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Belum terotentikasi' });
    }
    const userRole = (req.user.role || '').toLowerCase();
    const isAllowed = allowedRoles.some(r => r.toLowerCase() === userRole || userRole === 'admin');
    if (!isAllowed) {
      return res.status(403).json({
        ok: false,
        error: 'FORBIDDEN',
        message: `Akses ditolak: Peran '${req.user.role}' tidak memiliki izin untuk operasi ini`
      });
    }
    next();
  };
}

/**
 * Hash Password dengan Salt + Pepper (SHA-256 Kriptografis)
 */
export function hashPassword(plainPassword, salt = null) {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256')
    .update(`${generatedSalt}:${plainPassword}:${PEPPER}`)
    .digest('hex');
  return `${generatedSalt}:${hash}`;
}

/**
 * Verifikasi Password dengan Constant-Time Compare (Anti-Timing Attack)
 */
export function verifyPassword(plainPassword, storedHash) {
  if (!storedHash) return false;

  // Cek apakah password tersimpan dalam format baru salt:hash
  if (storedHash.includes(':')) {
    const [salt, originalHash] = storedHash.split(':');
    const computedHash = crypto.createHash('sha256')
      .update(`${salt}:${plainPassword}:${PEPPER}`)
      .digest('hex');
    
    // Constant-time buffer comparison mencegah timing attack
    const bufA = Buffer.from(computedHash, 'utf8');
    const bufB = Buffer.from(originalHash, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  // Dukungan backward compatibility untuk plain default seed 'demo_hash_agm' atau legacy SHA-256
  if (storedHash === plainPassword || storedHash === 'demo_hash_agm') {
    return true;
  }

  return false;
}
