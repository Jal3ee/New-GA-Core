-- ====================================================================
-- GA CORE SYSTEM - POSTGRESQL 16 DATABASE SCHEMA
-- Multi-Site Support: LBCT, IDMG, SPCT
-- Compatibility: Transaction Pooler, Session Pooler, Direct Session
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TRIGGER FUNCTION UNTUK AUTO-UPDATE UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ====================================================================
-- TABEL PENGGUNA & AUDIT
-- ====================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nik VARCHAR(50) UNIQUE NOT NULL,
    nama VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'pic_lapangan', -- 'admin', 'ga_admin', 'ga_gl', 'pic_lapangan'
    site VARCHAR(50) DEFAULT 'ALL',          -- 'LBCT', 'IDMG', 'SPCT', 'ALL'
    department VARCHAR(100) DEFAULT 'General Affairs',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    user_nik VARCHAR(50),
    user_name VARCHAR(150),
    site VARCHAR(50),
    action VARCHAR(100) NOT NULL,            -- e.g. 'INPUT_BHP', 'UPDATE_INVOICE', 'TRANSFER_STOK'
    entity_type VARCHAR(100) NOT NULL,       -- e.g. 'bhp_usage', 'invoices', 'tickets'
    entity_id VARCHAR(100),
    details JSONB,                           -- payload / diff data
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_site ON audit_logs(site);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ====================================================================
-- MODUL BHP MESS (PENCATATAN, FORECAST & STOK MULTI-SITE)
-- ====================================================================

CREATE TABLE IF NOT EXISTS bhp_items (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,          -- 'Toiletries', 'Laundry', 'Sanitasi & Pembersih', 'Hygiene & Dapur', 'Perlengkapan Kamar'
    unit VARCHAR(20) DEFAULT 'pcs',          -- 'pcs', 'botol', 'kotak', 'roll', etc.
    pack_size INT DEFAULT 1,                 -- kelipatan isi pack untuk pembulatan forecast
    abc_class CHAR(1) DEFAULT 'B',           -- 'A', 'B', 'C'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bhp_site_params (
    id SERIAL PRIMARY KEY,
    item_code VARCHAR(50) REFERENCES bhp_items(code) ON DELETE CASCADE,
    site VARCHAR(20) NOT NULL,               -- 'LBCT', 'IDMG', 'SPCT'
    safety_pct NUMERIC(5, 2) DEFAULT 5.00,   -- default 5%
    avg_daily_usage NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bhp_site_params UNIQUE(item_code, site)
);

CREATE TABLE IF NOT EXISTS bhp_initial_stocks (
    id SERIAL PRIMARY KEY,
    item_code VARCHAR(50) REFERENCES bhp_items(code) ON DELETE CASCADE,
    site VARCHAR(20) NOT NULL,
    qty INT DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bhp_initial_stocks UNIQUE(item_code, site)
);

-- 1. Pemakaian Harian (W1 - W2)
CREATE TABLE IF NOT EXISTS bhp_usage (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    site VARCHAR(20) NOT NULL,
    item_code VARCHAR(50) REFERENCES bhp_items(code) ON DELETE RESTRICT,
    qty INT NOT NULL CHECK (qty >= 0),
    pic_name VARCHAR(100) NOT NULL,
    is_anomaly BOOLEAN DEFAULT FALSE,        -- True jika > 3x rata-rata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bhp_usage_site_date ON bhp_usage(site, date);
CREATE INDEX IF NOT EXISTS idx_bhp_usage_item ON bhp_usage(item_code);

-- 2. Penerimaan Barang Masuk (W5 Arrival)
CREATE TABLE IF NOT EXISTS bhp_stock_in (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    site VARCHAR(20) NOT NULL,
    item_code VARCHAR(50) REFERENCES bhp_items(code) ON DELETE RESTRICT,
    qty INT NOT NULL CHECK (qty > 0),
    ref_po VARCHAR(100),                     -- nomor referensi bebas (manual di luar sistem)
    condition_status VARCHAR(50) DEFAULT 'Lengkap', -- 'Lengkap', 'Sebagian', 'Belum Datang'
    receiver_name VARCHAR(100) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bhp_stock_in_site_date ON bhp_stock_in(site, date);

-- 3. Mutasi / Transfer Stok Antar Site (Emergency Redistribution)
CREATE TABLE IF NOT EXISTS bhp_transfers (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    item_code VARCHAR(50) REFERENCES bhp_items(code) ON DELETE RESTRICT,
    qty INT NOT NULL CHECK (qty > 0),
    from_site VARCHAR(20) NOT NULL,
    to_site VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,                    -- Wajib diisi!
    pic_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_diff_sites CHECK (from_site <> to_site)
);

CREATE INDEX IF NOT EXISTS idx_bhp_transfers_sites ON bhp_transfers(from_site, to_site);

-- 4. Stock Opname & Rekonsiliasi (Awal W3)
CREATE TABLE IF NOT EXISTS bhp_opnames (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    site VARCHAR(20) NOT NULL,
    item_code VARCHAR(50) REFERENCES bhp_items(code) ON DELETE RESTRICT,
    system_qty INT NOT NULL,
    physical_qty INT NOT NULL,
    difference INT GENERATED ALWAYS AS (physical_qty - system_qty) STORED,
    reason VARCHAR(100),                     -- Wajib diisi jika difference != 0 ('Rusak', 'Hilang', 'Kadaluarsa', 'Salah Catat')
    pic_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bhp_opnames_site_date ON bhp_opnames(site, date);

-- 5. Data Forecast Siklus Bulanan (Awal W3)
CREATE TABLE IF NOT EXISTS bhp_forecasts (
    id BIGSERIAL PRIMARY KEY,
    cycle VARCHAR(50) NOT NULL,              -- e.g. 'Oktober 2026'
    site VARCHAR(20) NOT NULL,
    item_code VARCHAR(50) REFERENCES bhp_items(code) ON DELETE RESTRICT,
    avg_daily NUMERIC(10, 2) NOT NULL,
    horizon_days INT DEFAULT 28,
    safety_pct NUMERIC(5, 2) DEFAULT 5.00,
    projected_stock INT DEFAULT 0,
    net_needed INT DEFAULT 0,
    recommended_qty INT NOT NULL,            -- dibulatkan ke kelipatan pack_size
    pack_size INT DEFAULT 1,
    calculation_details JSONB,               -- rincian lengkap formula
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_bhp_forecast_cycle_site_item UNIQUE(cycle, site, item_code)
);

-- 6. Evaluasi Akurasi Forecast vs Actual
CREATE TABLE IF NOT EXISTS bhp_evaluations (
    id BIGSERIAL PRIMARY KEY,
    cycle VARCHAR(50) NOT NULL,
    site VARCHAR(20) NOT NULL,
    item_code VARCHAR(50) REFERENCES bhp_items(code) ON DELETE RESTRICT,
    forecast_qty INT NOT NULL,
    actual_qty INT NOT NULL,
    diff_qty INT GENERATED ALWAYS AS (actual_qty - forecast_qty) STORED,
    error_pct NUMERIC(6, 2),
    bias VARCHAR(20),                        -- 'Underforecast', 'Overforecast', 'Sesuai'
    evaluated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Riwayat Unduhan PDF Resmi (Audit Dua Tanda Tangan)
CREATE TABLE IF NOT EXISTS bhp_pdf_history (
    id BIGSERIAL PRIMARY KEY,
    download_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    doc_type VARCHAR(100) NOT NULL,          -- 'Rekap Rekomendasi & Forecast BHP', 'Evaluasi Akurasi'
    period VARCHAR(50) NOT NULL,
    site_covered VARCHAR(50) NOT NULL,       -- 'LBCT', 'IDMG', 'SPCT', 'ALL'
    created_by VARCHAR(100) NOT NULL,        -- Nama GA Admin
    approved_by VARCHAR(100) NOT NULL,       -- Nama GA GL
    notes TEXT
);

-- ====================================================================
-- MODUL INVOICE & REIMBURSEMENT
-- ====================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    vendor_name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    period VARCHAR(50),
    site VARCHAR(50) DEFAULT 'ALL',
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Review GA',  -- 'Draft', 'Review GA', 'Approval Dept Head', 'Proses Finance', 'Paid', 'Rejected'
    due_date DATE,
    invoice_date DATE,
    file_url TEXT,                           -- Tautan lampiran (Google Drive / Cloudinary / Storage)
    file_size_bytes BIGINT DEFAULT 0,        -- Maks 5MB (5,242,880 bytes)
    file_name VARCHAR(255),
    tracking_stages JSONB DEFAULT '[]'::jsonb, -- Array tahapan tracking & timestamp
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON invoices(vendor_name);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period);

CREATE TABLE IF NOT EXISTS reimbursements (
    id SERIAL PRIMARY KEY,
    claim_number VARCHAR(100) UNIQUE NOT NULL,
    employee_nik VARCHAR(50) NOT NULL,
    employee_name VARCHAR(150) NOT NULL,
    site VARCHAR(50) DEFAULT 'LBCT',
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Submitted',
    claim_date DATE NOT NULL,
    file_url TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- MODUL TRAVEL & TICKETING
-- ====================================================================

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    booking_code VARCHAR(50),
    ticket_number VARCHAR(100),
    nik VARCHAR(50) NOT NULL,
    passenger_name VARCHAR(150) NOT NULL,
    department VARCHAR(100),
    site VARCHAR(50),
    transport_type VARCHAR(50) DEFAULT 'Pesawat', -- 'Pesawat', 'Travel Darat', 'Speedboat'
    route_from VARCHAR(100) NOT NULL,
    route_to VARCHAR(100) NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE,
    cost NUMERIC(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Issued',          -- 'Requested', 'Approved', 'Issued', 'Used', 'Cancelled'
    attachment_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_nik ON tickets(nik);
CREATE INDEX IF NOT EXISTS idx_tickets_departure_date ON tickets(departure_date);

-- ====================================================================
-- MODUL EVENTS / CALENDAR
-- ====================================================================

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    all_day BOOLEAN DEFAULT FALSE,
    category VARCHAR(50) DEFAULT 'General',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- MODUL MESS MANAGEMENT (GEDUNG, KAMAR, OKUPANSI)
-- ====================================================================

CREATE TABLE IF NOT EXISTS mess_buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    site VARCHAR(50) NOT NULL,              -- 'LBCT', 'IDMG', 'SPCT'
    total_rooms INT DEFAULT 0,
    gender VARCHAR(20) DEFAULT 'Male',       -- 'Male', 'Female', 'Mixed'
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mess_stays (
    id SERIAL PRIMARY KEY,
    building_id INT REFERENCES mess_buildings(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    bed_number VARCHAR(20),
    employee_nik VARCHAR(50),
    employee_name VARCHAR(150),
    company VARCHAR(100) DEFAULT 'PT AGM',
    check_in DATE NOT NULL,
    check_out DATE,
    status VARCHAR(50) DEFAULT 'Active',    -- 'Active', 'CheckedOut', 'Reserved'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- MODUL ASSETS (VENDOR & UNIT CONTRACTS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS vendor_contracts (
    id SERIAL PRIMARY KEY,
    vendor_name VARCHAR(150) NOT NULL,
    contract_number VARCHAR(100) UNIQUE,
    service_type VARCHAR(100) NOT NULL,
    site VARCHAR(50) DEFAULT 'ALL',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    contract_value NUMERIC(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Active',
    file_url TEXT,                           -- Tautan file berkas di Google Drive
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unit_contracts (
    id SERIAL PRIMARY KEY,
    unit_code VARCHAR(100) NOT NULL,
    unit_type VARCHAR(100) NOT NULL,
    vendor_name VARCHAR(150),
    site VARCHAR(50) DEFAULT 'ALL',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    monthly_rate NUMERIC(15, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Active',
    file_url TEXT,                           -- Tautan file berkas di Google Drive
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- MODUL STANDARDS (SOP / WORK INSTRUCTION / FORMS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS standards (
    id SERIAL PRIMARY KEY,
    doc_code VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    doc_type VARCHAR(50) NOT NULL,          -- 'SOP', 'WI', 'STD', 'FORM'
    department VARCHAR(100) DEFAULT 'General Affairs',
    revision_number VARCHAR(20) DEFAULT 'Rev. 00',
    effective_date DATE,
    file_url TEXT,                           -- Tautan file berkas PDF di Google Drive
    file_size_bytes BIGINT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- MODUL CATERING (VENDORS, SCORING & INCIDENTS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS catering_vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    site VARCHAR(50) NOT NULL,
    pic_name VARCHAR(100),
    pic_contact VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Active',
    rating NUMERIC(3, 2) DEFAULT 4.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catering_scorings (
    id SERIAL PRIMARY KEY,
    week_period VARCHAR(50) NOT NULL,
    site VARCHAR(50) NOT NULL,
    vendor_id INT REFERENCES catering_vendors(id) ON DELETE SET NULL,
    taste_score NUMERIC(4, 2) DEFAULT 0.00,
    hygiene_score NUMERIC(4, 2) DEFAULT 0.00,
    variety_score NUMERIC(4, 2) DEFAULT 0.00,
    punctuality_score NUMERIC(4, 2) DEFAULT 0.00,
    total_score NUMERIC(4, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS catering_incidents (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    site VARCHAR(50) NOT NULL,
    vendor_name VARCHAR(150),
    meal_type VARCHAR(50),                  -- 'Sarapan', 'Makan Siang', 'Makan Malam'
    issue_type VARCHAR(100) NOT NULL,       -- 'Rasa / Basi', 'Benda Asing', 'Keterlambatan'
    severity VARCHAR(50) DEFAULT 'Sedang',  -- 'Ringan', 'Sedang', 'Berat'
    description TEXT NOT NULL,
    action_taken TEXT,
    status VARCHAR(50) DEFAULT 'Open',      -- 'Open', 'Investigasi', 'Resolved'
    file_url TEXT,                           -- Tautan foto temuan di Google Drive
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- SEED INITIAL DATA UNTUK BHP MESS
-- ====================================================================

INSERT INTO bhp_items (code, name, category, unit, pack_size, abc_class) VALUES
('BHP-001', 'Sabun Mandi Batang 80g', 'Toiletries', 'pcs', 12, 'A'),
('BHP-002', 'Shampoo Sachet 10ml', 'Toiletries', 'pcs', 24, 'A'),
('BHP-003', 'Pasta Gigi 120g', 'Toiletries', 'pcs', 10, 'B'),
('BHP-004', 'Sikat Gigi Soft', 'Toiletries', 'pcs', 12, 'B'),
('BHP-005', 'Deterjen Bubuk 1kg', 'Laundry', 'pcs', 10, 'A'),
('BHP-006', 'Pewangi Pakaian 800ml', 'Laundry', 'pcs', 6, 'A'),
('BHP-007', 'Karbol Wangi Lantai 1L', 'Sanitasi & Pembersih', 'pcs', 6, 'B'),
('BHP-008', 'Cairan Pencuci Piring 750ml', 'Hygiene & Dapur', 'pcs', 12, 'A'),
('BHP-009', 'Tisu Gulung Toilet', 'Sanitasi & Pembersih', 'pcs', 48, 'B'),
('BHP-010', 'Sprei Single 90x200', 'Perlengkapan Kamar', 'pcs', 5, 'C'),
('BHP-011', 'Sarung Bantal Katun', 'Perlengkapan Kamar', 'pcs', 10, 'C'),
('BHP-012', 'Hand Sanitizer 500ml', 'Hygiene & Dapur', 'pcs', 10, 'C')
ON CONFLICT (code) DO NOTHING;

-- Seed Parameter Site Awal
INSERT INTO bhp_site_params (item_code, site, safety_pct, avg_daily_usage) VALUES
('BHP-001', 'LBCT', 5.00, 18.5),
('BHP-001', 'IDMG', 5.00, 12.0),
('BHP-001', 'SPCT', 5.00, 8.5),
('BHP-002', 'LBCT', 5.00, 22.0),
('BHP-002', 'IDMG', 5.00, 15.0),
('BHP-002', 'SPCT', 5.00, 9.0),
('BHP-005', 'LBCT', 7.50, 4.2),
('BHP-005', 'IDMG', 5.00, 2.8),
('BHP-005', 'SPCT', 5.00, 1.8),
('BHP-007', 'LBCT', 5.00, 2.5),
('BHP-007', 'IDMG', 5.00, 1.8),
('BHP-007', 'SPCT', 5.00, 1.2),
('BHP-008', 'LBCT', 5.00, 3.8),
('BHP-008', 'IDMG', 5.00, 2.5),
('BHP-008', 'SPCT', 5.00, 1.5),
('BHP-009', 'LBCT', 5.00, 14.0),
('BHP-009', 'IDMG', 5.00, 9.0),
('BHP-009', 'SPCT', 5.00, 6.0)
ON CONFLICT (item_code, site) DO NOTHING;

-- Seed Stok Awal
INSERT INTO bhp_initial_stocks (item_code, site, qty) VALUES
('BHP-001', 'LBCT', 280), ('BHP-001', 'IDMG', 180), ('BHP-001', 'SPCT', 110),
('BHP-002', 'LBCT', 320), ('BHP-002', 'IDMG', 210), ('BHP-002', 'SPCT', 130),
('BHP-005', 'LBCT', 65),  ('BHP-005', 'IDMG', 42),  ('BHP-005', 'SPCT', 25),
('BHP-007', 'LBCT', 35),  ('BHP-007', 'IDMG', 24),  ('BHP-007', 'SPCT', 16),
('BHP-008', 'LBCT', 55),  ('BHP-008', 'IDMG', 38),  ('BHP-008', 'SPCT', 22),
('BHP-009', 'LBCT', 190), ('BHP-009', 'IDMG', 120), ('BHP-009', 'SPCT', 80)
ON CONFLICT (item_code, site) DO NOTHING;

-- Seed User Default
INSERT INTO users (nik, nama, email, password_hash, role, site) VALUES
('ADM001', 'GA Super Administrator', 'admin.ga@agm.co.id', 'demo_hash_agm', 'admin', 'ALL'),
('PIC001', 'Ahmad Rizki (PIC LBCT)', 'pic.lbct@agm.co.id', 'demo_hash_agm', 'pic_lapangan', 'LBCT'),
('PIC002', 'Budi Santoso (PIC IDMG)', 'pic.idmg@agm.co.id', 'demo_hash_agm', 'pic_lapangan', 'IDMG'),
('PIC003', 'Chandra Wijaya (PIC SPCT)', 'pic.spct@agm.co.id', 'demo_hash_agm', 'pic_lapangan', 'SPCT'),
('GL001',  'Hendra Setiawan (GA GL)', 'ga.gl@agm.co.id', 'demo_hash_agm', 'ga_gl', 'ALL')
ON CONFLICT (nik) DO NOTHING;
