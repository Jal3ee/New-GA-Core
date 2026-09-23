/**
 * Initial Master Data and Transactions for BHP Mess (Barang Habis Pakai)
 * Multi-Site: LBCT, IDMG, SPCT
 */

export const INITIAL_BHP_ITEMS = [
  {
    id: 'BHP-001',
    code: 'BHP-SBN-CD',
    name: 'Sabun Mandi Cair (Pouch 450ml)',
    category: 'Toiletries & Mandi',
    unit: 'pouch',
    pack_qty: 12,
    pack_unit: 'karton',
    default_abc: 'A',
    default_safety_pct: 10,
    price_est: 22000
  },
  {
    id: 'BHP-002',
    code: 'BHP-SMP-BT',
    name: 'Sampo Rambut Anti Ketombe (Botol 170ml)',
    category: 'Toiletries & Mandi',
    unit: 'botol',
    pack_qty: 24,
    pack_unit: 'karton',
    default_abc: 'B',
    default_safety_pct: 5,
    price_est: 28000
  },
  {
    id: 'BHP-003',
    code: 'BHP-ODL-120',
    name: 'Pasta Gigi Fresh Mint (Tube 120g)',
    category: 'Toiletries & Mandi',
    unit: 'tube',
    pack_qty: 24,
    pack_unit: 'karton',
    default_abc: 'B',
    default_safety_pct: 5,
    price_est: 14500
  },
  {
    id: 'BHP-004',
    code: 'BHP-SKT-GG',
    name: 'Sikat Gigi Dewasa Bulu Lembut',
    category: 'Toiletries & Mandi',
    unit: 'pcs',
    pack_qty: 24,
    pack_unit: 'box',
    default_abc: 'C',
    default_safety_pct: 5,
    price_est: 8500
  },
  {
    id: 'BHP-005',
    code: 'BHP-DTJ-800',
    name: 'Deterjen Bubuk Cuci Pakaian (Bag 800g)',
    category: 'Laundry & Cuci',
    unit: 'bag',
    pack_qty: 12,
    pack_unit: 'karton',
    default_abc: 'A',
    default_safety_pct: 10,
    price_est: 26000
  },
  {
    id: 'BHP-006',
    code: 'BHP-KRB-04L',
    name: 'Karbol Wangi Desinfektan Lantai (Jerigen 4L)',
    category: 'Kebersihan & Sanitasi',
    unit: 'jerigen',
    pack_qty: 4,
    pack_unit: 'dus',
    default_abc: 'A',
    default_safety_pct: 10,
    price_est: 65000
  },
  {
    id: 'BHP-007',
    code: 'BHP-PPR-750',
    name: 'Sabun Cuci Piring Jeruk Nipis (Pouch 750ml)',
    category: 'Kebersihan & Sanitasi',
    unit: 'pouch',
    pack_qty: 12,
    pack_unit: 'karton',
    default_abc: 'A',
    default_safety_pct: 5,
    price_est: 16500
  },
  {
    id: 'BHP-008',
    code: 'BHP-TIS-ROL',
    name: 'Tisu Toilet Emboss Roll (Isi 10 Roll/Pack)',
    category: 'Hygiene & Kertas',
    unit: 'pack',
    pack_qty: 8,
    pack_unit: 'karton',
    default_abc: 'A',
    default_safety_pct: 10,
    price_est: 42000
  },
  {
    id: 'BHP-009',
    code: 'BHP-TIS-KOT',
    name: 'Tisu Kotak Facial Tissue (250 Sheets)',
    category: 'Hygiene & Kertas',
    unit: 'kotak',
    pack_qty: 24,
    pack_unit: 'karton',
    default_abc: 'B',
    default_safety_pct: 5,
    price_est: 13500
  },
  {
    id: 'BHP-010',
    code: 'BHP-KST-BS',
    name: 'Kantong Sampah Hitam Tebal Besar (90x120cm)',
    category: 'Perlengkapan Umum',
    unit: 'pack',
    pack_qty: 20,
    pack_unit: 'karung',
    default_abc: 'B',
    default_safety_pct: 5,
    price_est: 35000
  },
  {
    id: 'BHP-011',
    code: 'BHP-KST-SD',
    name: 'Kantong Sampah Hitam Sedang (60x100cm)',
    category: 'Perlengkapan Umum',
    unit: 'pack',
    pack_qty: 25,
    pack_unit: 'karung',
    default_abc: 'C',
    default_safety_pct: 5,
    price_est: 22000
  },
  {
    id: 'BHP-012',
    code: 'BHP-PGR-SPY',
    name: 'Pengharum Ruangan Otomatis Spray (400ml)',
    category: 'Perlengkapan Kamar',
    unit: 'kaleng',
    pack_qty: 12,
    pack_unit: 'karton',
    default_abc: 'B',
    default_safety_pct: 5,
    price_est: 32000
  },
  {
    id: 'BHP-013',
    code: 'BHP-KPR-BAR',
    name: 'Kapur Barus Kamper Toilet (Pack 500g)',
    category: 'Kebersihan & Sanitasi',
    unit: 'pack',
    pack_qty: 12,
    pack_unit: 'karton',
    default_abc: 'C',
    default_safety_pct: 5,
    price_est: 28000
  },
  {
    id: 'BHP-014',
    code: 'BHP-HND-WSH',
    name: 'Sabun Cuci Tangan Anti Bakteri (Jerigen 4L)',
    category: 'Kebersihan & Sanitasi',
    unit: 'jerigen',
    pack_qty: 4,
    pack_unit: 'dus',
    default_abc: 'A',
    default_safety_pct: 10,
    price_est: 72000
  },
  {
    id: 'BHP-015',
    code: 'BHP-PMS-KLS',
    name: 'Pembersih Porselen & Kloset Kuat (Botol 750ml)',
    category: 'Kebersihan & Sanitasi',
    unit: 'botol',
    pack_qty: 12,
    pack_unit: 'karton',
    default_abc: 'B',
    default_safety_pct: 5,
    price_est: 24000
  }
];

export const SITES_BHP = [
  { id: 'LBCT', name: 'Site LBCT', resident_capacity: 180, current_occupancy: 165 },
  { id: 'IDMG', name: 'Site IDMG', resident_capacity: 120, current_occupancy: 110 },
  { id: 'SPCT', name: 'Site SPCT', resident_capacity: 90, current_occupancy: 82 }
];

// Initial stock per site (pcs)
export const INITIAL_BHP_STOCKS = {
  'LBCT': {
    'BHP-001': 48,  // Sabun Mandi Cair
    'BHP-002': 32,  // Sampo
    'BHP-003': 40,  // Pasta Gigi
    'BHP-004': 50,  // Sikat Gigi
    'BHP-005': 18,  // Deterjen Cuci (Kritis)
    'BHP-006': 12,  // Karbol 4L
    'BHP-007': 26,  // Cuci Piring
    'BHP-008': 16,  // Tisu Toilet (Menipis)
    'BHP-009': 35,  // Tisu Kotak
    'BHP-010': 28,  // Kantong Sampah Besar
    'BHP-011': 42,  // Kantong Sampah Sedang
    'BHP-012': 14,  // Pengharum Ruangan
    'BHP-013': 22,  // Kapur Barus
    'BHP-014': 8,   // Hand Wash 4L
    'BHP-015': 16   // Pembersih Kloset
  },
  'IDMG': {
    'BHP-001': 36,
    'BHP-002': 24,
    'BHP-003': 30,
    'BHP-004': 38,
    'BHP-005': 28,
    'BHP-006': 8,
    'BHP-007': 18,
    'BHP-008': 22,
    'BHP-009': 24,
    'BHP-010': 20,
    'BHP-011': 30,
    'BHP-012': 10,
    'BHP-013': 15,
    'BHP-014': 6,
    'BHP-015': 12
  },
  'SPCT': {
    'BHP-001': 24,
    'BHP-002': 18,
    'BHP-003': 20,
    'BHP-004': 25,
    'BHP-005': 6,   // Kritis
    'BHP-006': 5,
    'BHP-007': 14,
    'BHP-008': 10,  // Menipis
    'BHP-009': 16,
    'BHP-010': 15,
    'BHP-011': 20,
    'BHP-012': 8,
    'BHP-013': 10,
    'BHP-014': 4,
    'BHP-015': 8
  }
};

// Site-specific parameter overrides (safety %, ABC class)
export const INITIAL_BHP_SITE_PARAMS = {
  'LBCT': {
    'BHP-001': { abc_class: 'A', safety_pct: 10, custom_notes: 'Konsumsi tinggi di mess transit' },
    'BHP-005': { abc_class: 'A', safety_pct: 12, custom_notes: 'Laundry beroperasi 2 shift' },
    'BHP-008': { abc_class: 'A', safety_pct: 10, custom_notes: 'Kebutuhan toilet umum mess' }
  },
  'IDMG': {
    'BHP-001': { abc_class: 'A', safety_pct: 8, custom_notes: '' },
    'BHP-005': { abc_class: 'A', safety_pct: 10, custom_notes: '' }
  },
  'SPCT': {
    'BHP-001': { abc_class: 'B', safety_pct: 5, custom_notes: 'Site port terminal' },
    'BHP-005': { abc_class: 'A', safety_pct: 10, custom_notes: 'Pencucian coverall mekanik' }
  }
};

// Historical usage samples across W1 and W2 (approx 14 days)
export const INITIAL_BHP_USAGES = [
  // LBCT Recent Usages
  { id: 'USG-101', date: '2026-09-18', site: 'LBCT', item_id: 'BHP-001', qty: 6, pic_name: 'Ahmad Syafii', pic_nik: 'PIC-LBCT-01', notes: 'Distribusi kamar blok A-C', is_anomaly: false },
  { id: 'USG-102', date: '2026-09-18', site: 'LBCT', item_id: 'BHP-005', qty: 4, pic_name: 'Ahmad Syafii', pic_nik: 'PIC-LBCT-01', notes: 'Laundry harian shift pagi', is_anomaly: false },
  { id: 'USG-103', date: '2026-09-18', site: 'LBCT', item_id: 'BHP-008', qty: 5, pic_name: 'Ahmad Syafii', pic_nik: 'PIC-LBCT-01', notes: 'Toilet umum koridor 1 & 2', is_anomaly: false },
  { id: 'USG-104', date: '2026-09-17', site: 'LBCT', item_id: 'BHP-001', qty: 5, pic_name: 'Ahmad Syafii', pic_nik: 'PIC-LBCT-01', notes: 'Pengisian dispenser shower', is_anomaly: false },
  { id: 'USG-105', date: '2026-09-17', site: 'LBCT', item_id: 'BHP-006', qty: 2, pic_name: 'Ahmad Syafii', pic_nik: 'PIC-LBCT-01', notes: 'General cleaning selasar', is_anomaly: false },
  { id: 'USG-106', date: '2026-09-16', site: 'LBCT', item_id: 'BHP-007', qty: 3, pic_name: 'Ahmad Syafii', pic_nik: 'PIC-LBCT-01', notes: 'Dapur mess & pantry', is_anomaly: false },
  { id: 'USG-107', date: '2026-09-15', site: 'LBCT', item_id: 'BHP-005', qty: 15, pic_name: 'Ahmad Syafii', pic_nik: 'PIC-LBCT-01', notes: 'Pencucian massal sprei & selimut', is_anomaly: true }, // Anomaly sample
  
  // IDMG Recent Usages
  { id: 'USG-201', date: '2026-09-18', site: 'IDMG', item_id: 'BHP-001', qty: 3, pic_name: 'Bambang Irawan', pic_nik: 'PIC-IDMG-01', notes: 'Mess staf dan non-staf', is_anomaly: false },
  { id: 'USG-202', date: '2026-09-18', site: 'IDMG', item_id: 'BHP-005', qty: 3, pic_name: 'Bambang Irawan', pic_nik: 'PIC-IDMG-01', notes: 'Laundry operasional', is_anomaly: false },
  { id: 'USG-203', date: '2026-09-17', site: 'IDMG', item_id: 'BHP-008', qty: 3, pic_name: 'Bambang Irawan', pic_nik: 'PIC-IDMG-01', notes: 'Toilet mess', is_anomaly: false },
  { id: 'USG-204', date: '2026-09-16', site: 'IDMG', item_id: 'BHP-006', qty: 1, pic_name: 'Bambang Irawan', pic_nik: 'PIC-IDMG-01', notes: 'Pel lantai kamar mandi', is_anomaly: false },

  // SPCT Recent Usages
  { id: 'USG-301', date: '2026-09-18', site: 'SPCT', item_id: 'BHP-001', qty: 2, pic_name: 'Dedi Kurniawan', pic_nik: 'PIC-SPCT-01', notes: 'Mess dermaga port', is_anomaly: false },
  { id: 'USG-302', date: '2026-09-18', site: 'SPCT', item_id: 'BHP-005', qty: 2, pic_name: 'Dedi Kurniawan', pic_nik: 'PIC-SPCT-01', notes: 'Laundry port crew', is_anomaly: false },
  { id: 'USG-303', date: '2026-09-17', site: 'SPCT', item_id: 'BHP-008', qty: 2, pic_name: 'Dedi Kurniawan', pic_nik: 'PIC-SPCT-01', notes: 'Kamar mandi bersama', is_anomaly: false }
];

// Initial stock in (penerimaan barang)
export const INITIAL_BHP_STOCK_INS = [
  {
    id: 'RCV-001',
    date: '2026-08-28',
    site: 'LBCT',
    item_id: 'BHP-001',
    qty: 60,
    qty_packs: 5,
    ref_no: 'PO-MANUAL/GA/2026/08/112',
    supplier_name: 'CV. Berkah Sanitasi Kalsel',
    condition_status: 'Lengkap',
    pic_name: 'Ahmad Syafii',
    notes: 'Diterima dalam kondisi kardus baik dan tersegel'
  },
  {
    id: 'RCV-002',
    date: '2026-08-28',
    site: 'LBCT',
    item_id: 'BHP-005',
    qty: 36,
    qty_packs: 3,
    ref_no: 'PO-MANUAL/GA/2026/08/112',
    supplier_name: 'CV. Berkah Sanitasi Kalsel',
    condition_status: 'Lengkap',
    pic_name: 'Ahmad Syafii',
    notes: 'Karton utuh'
  },
  {
    id: 'RCV-003',
    date: '2026-08-29',
    site: 'IDMG',
    item_id: 'BHP-001',
    qty: 36,
    qty_packs: 3,
    ref_no: 'PO-MANUAL/GA/2026/08/113',
    supplier_name: 'CV. Berkah Sanitasi Kalsel',
    condition_status: 'Lengkap',
    pic_name: 'Bambang Irawan',
    notes: 'Sesuai pesanan'
  },
  {
    id: 'RCV-004',
    date: '2026-08-29',
    site: 'SPCT',
    item_id: 'BHP-001',
    qty: 24,
    qty_packs: 2,
    ref_no: 'PO-MANUAL/GA/2026/08/114',
    supplier_name: 'CV. Berkah Sanitasi Kalsel',
    condition_status: 'Sebagian',
    pic_name: 'Dedi Kurniawan',
    notes: 'Kekurangan 1 karton dikirim menyusul'
  }
];

// Initial stock transfer records
export const INITIAL_BHP_TRANSFERS = [
  {
    id: 'TRF-001',
    date: '2026-09-10',
    item_id: 'BHP-005',
    qty: 6,
    from_site: 'IDMG',
    to_site: 'SPCT',
    reason: 'Emergency: Stok SPCT menipis menjelang W3, pengalihan stok IDMG yang berlebih',
    pic_name: 'GA Admin (Bagus Prasetyo)',
    status: 'Selesai'
  }
];

// Initial stock opnames (Awal W3)
export const INITIAL_BHP_OPNAMES = [
  {
    id: 'OPN-001',
    date: '2026-09-15',
    site: 'LBCT',
    cycle: '2026-09-W3',
    item_id: 'BHP-001',
    system_qty: 50,
    physical_qty: 48,
    diff_qty: -2,
    reason: 'Pouch sabun bocor di gudang penyimpanan dan dibuang',
    pic_name: 'Ahmad Syafii'
  },
  {
    id: 'OPN-002',
    date: '2026-09-15',
    site: 'LBCT',
    cycle: '2026-09-W3',
    item_id: 'BHP-005',
    system_qty: 18,
    physical_qty: 18,
    diff_qty: 0,
    reason: 'Sesuai fisik',
    pic_name: 'Ahmad Syafii'
  },
  {
    id: 'OPN-003',
    date: '2026-09-15',
    site: 'IDMG',
    cycle: '2026-09-W3',
    item_id: 'BHP-008',
    system_qty: 23,
    physical_qty: 22,
    diff_qty: -1,
    reason: '1 roll rusak terkena air rembesan atap gudang',
    pic_name: 'Bambang Irawan'
  }
];

// Initial evaluations from previous cycle (August 2026)
export const INITIAL_BHP_EVALUATIONS = [
  {
    id: 'EVL-001',
    cycle: '2026-08',
    site: 'LBCT',
    item_id: 'BHP-001',
    forecast_qty: 120,
    actual_qty: 114,
    diff_qty: -6,
    diff_pct: 5.0,
    bias: 'Overforecast (Sedikit Berlebih)',
    notes: 'Akurasi sangat baik (95%)'
  },
  {
    id: 'EVL-002',
    cycle: '2026-08',
    site: 'LBCT',
    item_id: 'BHP-005',
    forecast_qty: 72,
    actual_qty: 84,
    diff_qty: 12,
    diff_pct: 16.7,
    bias: 'Underforecast (Kurang)',
    notes: 'Ada lonjakan penghuni kontraktor di pertengahan bulan'
  },
  {
    id: 'EVL-003',
    cycle: '2026-08',
    site: 'IDMG',
    item_id: 'BHP-001',
    forecast_qty: 72,
    actual_qty: 68,
    diff_qty: -4,
    diff_pct: 5.5,
    bias: 'Overforecast (Sedikit Berlebih)',
    notes: 'Pola konsumsi stabil'
  },
  {
    id: 'EVL-004',
    cycle: '2026-08',
    site: 'SPCT',
    item_id: 'BHP-001',
    forecast_qty: 48,
    actual_qty: 42,
    diff_qty: -6,
    diff_pct: 12.5,
    bias: 'Overforecast',
    notes: 'Kapal sandar lebih sedikit dari estimasi'
  }
];

// Initial PDF download history
export const INITIAL_BHP_PDF_HISTORY = [
  {
    id: 'PDF-HIST-001',
    download_date: '2026-08-16 10:45',
    recap_type: 'Rekomendasi Pemesanan BHP Mess (Forecast W3)',
    period_cycle: 'Agustus 2026 (W3-W5 & Sep W1-W2)',
    site: 'Konsolidasi (LBCT, IDMG, SPCT)',
    created_by_name: 'Bagus Prasetyo (GA Admin)',
    approved_by_name: 'M. Rizky Ramadhan (GA GL)',
    item_count: 15,
    total_qty: 540
  }
];
