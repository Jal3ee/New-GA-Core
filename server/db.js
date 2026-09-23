import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env dari root project
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

/**
 * Pilihan Mode Koneksi PostgreSQL 16:
 * 1. 'transaction' -> Transaction Pooler (Port 6543 / PgBouncer mode transaction)
 *    Paling bagus & wajib untuk operasional web harian dengan banyak user.
 * 2. 'session'     -> Session Pooler (Port 5432 / PgBouncer mode session)
 * 3. 'direct'      -> Direct Session (Port 5432 Direct ke Postgres engine)
 *    Digunakan saat initial setup / DDL schema migration.
 */
export const CONNECTION_MODES = {
  TRANSACTION: 'transaction',
  SESSION: 'session',
  DIRECT: 'direct'
};

// Ambil mode dari .env atau default ke 'transaction'
export const currentMode = (process.env.POSTGRES_MODE || CONNECTION_MODES.TRANSACTION).toLowerCase();

const DEFAULT_DATABASE_URL = 'postgresql://uswRfIdT6Zzn8XLoL.jkt1_006:620a042cad6aeb08c8624bb7@pgsql-dbas-jkt1-006.sumobase.my.id:6432/dba6b11936354a9e0a';

/**
 * Mendapatkan Connection String sesuai mode yang dipilih
 */
export function getConnectionString(mode = currentMode) {
  // Jika ada URL khusus per mode di .env
  if (mode === CONNECTION_MODES.TRANSACTION && process.env.DATABASE_URL_TRANSACTION) {
    return process.env.DATABASE_URL_TRANSACTION;
  }
  if (mode === CONNECTION_MODES.SESSION && process.env.DATABASE_URL_SESSION) {
    return process.env.DATABASE_URL_SESSION;
  }
  if (mode === CONNECTION_MODES.DIRECT && process.env.DATABASE_URL_DIRECT) {
    return process.env.DATABASE_URL_DIRECT;
  }

  // Gunakan URL utama DATABASE_URL atau default database PostgreSQL 16 live
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

// Konfigurasi Pooler
const activeConnString = getConnectionString(currentMode);

export const pool = new Pool(
  activeConnString
    ? {
        connectionString: activeConnString,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: currentMode === CONNECTION_MODES.TRANSACTION ? 15 : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        host: process.env.DB_HOST || 'pgsql-dbas-jkt1-006.sumobase.my.id',
        port: Number(process.env.DB_PORT) || 6432,
        database: process.env.DB_NAME || 'dba6b11936354a9e0a',
        user: process.env.DB_USER || 'uswRfIdT6Zzn8XLoL.jkt1_006',
        password: process.env.DB_PASSWORD || '620a042cad6aeb08c8624bb7',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: currentMode === CONNECTION_MODES.TRANSACTION ? 15 : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
);

/**
 * Eksekusi query dengan pooler
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production' && duration > 500) {
      console.warn(`[PG-SlowQuery] ${duration}ms:`, text.substring(0, 80));
    }
    return res;
  } catch (err) {
    console.error(`[PG-Error] Query error in mode (${currentMode}):`, err.message);
    throw err;
  }
}

/**
 * Tes konektivitas database dan periksa versi PostgreSQL
 */
export async function testConnection(customMode = currentMode) {
  const startTime = Date.now();
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT version(), current_database(), current_user, inet_server_port();');
      const pingTime = Date.now() - startTime;
      return {
        success: true,
        mode: customMode,
        pingMs: pingTime,
        database: res.rows[0].current_database,
        user: res.rows[0].current_user,
        port: res.rows[0].inet_server_port,
        version: res.rows[0].version,
      };
    } finally {
      client.release();
    }
  } catch (err) {
    return {
      success: false,
      mode: customMode,
      error: err.message,
      code: err.code,
    };
  }
}
