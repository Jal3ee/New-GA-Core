import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import { getConnectionString, CONNECTION_MODES } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Client } = pg;

async function runMigration() {
  console.log('====================================================');
  console.log('  GA CORE - POSTGRESQL 16 MIGRATION RUNNER');
  console.log('====================================================');

  // Untuk DDL (CREATE TABLE dll), koneksi Direct atau Session adalah yang paling aman
  const targetMode = process.env.DATABASE_URL_DIRECT
    ? CONNECTION_MODES.DIRECT
    : CONNECTION_MODES.SESSION;

  const connStr = getConnectionString(targetMode) || process.env.DATABASE_URL;

  if (!connStr) {
    console.error('❌ ERROR: Belum ada DATABASE_URL yang diatur di file .env!');
    console.error('Silakan atur DATABASE_URL di .env terlebih dahulu.');
    process.exit(1);
  }

  console.log(`📡 Menghubungkan menggunakan mode: [${targetMode.toUpperCase()}]...`);

  const client = new Client({
    connectionString: connStr,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('✅ Berhasil terhubung ke engine PostgreSQL 16!');

    const schemaPath = path.resolve(__dirname, '../database/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`File skema tidak ditemukan di ${schemaPath}`);
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log('🚀 Menjalankan DDL skema & seed data...');

    await client.query(sql);

    console.log('✨ Skema database berhasil dibuat dan di-seed!');

    // Verifikasi tabel-tabel yang terbentuk
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n📋 Daftar Tabel Aktif di Database:');
    res.rows.forEach(r => console.log(` - ${r.table_name}`));

    // Hitung item BHP
    const bhpCount = await client.query('SELECT COUNT(*) FROM bhp_items;');
    console.log(`\n📦 Total Item BHP terdaftar: ${bhpCount.rows[0].count} item`);

    console.log('\n====================================================');
    console.log('  MIGRASI POSTGRESQL 16 SELESAI DENGAN SUKSES! 🚀');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Gagal menjalankan migrasi:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
