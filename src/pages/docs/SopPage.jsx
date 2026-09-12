import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  FileText,
  Search,
  Plus,
  Filter,
  ExternalLink,
  Edit2,
  Trash2,
  Copy,
  Building,
  Plane,
  Package,
  Utensils,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  Layers,
  RotateCcw,
  Upload,
  Database,
  Loader2
} from 'lucide-react';
import { api as gasClient } from '../../lib/gasClient';

// 4 Main Business Process Categories
const CATEGORIES = [
  { id: 'all', label: 'Semua Kategori', icon: Layers, desc: 'Seluruh dokumen operasional' },
  { id: 'mess_building', label: 'Mess & Building', icon: Building, desc: 'Fasilitas mess, kamar, housekeeping, & gedung kantor' },
  { id: 'travel_transport', label: 'Travel & Transport', icon: Plane, desc: 'Tiket pesawat, armada kendaraan dinas, BBM, & driver' },
  { id: 'assets', label: 'Assets', icon: Package, desc: 'Pengadaan, kontrak vendor, inventaris, & pemeliharaan unit' },
  { id: 'catering', label: 'Catering', icon: Utensils, desc: 'Pengelolaan katering karyawan, food safety, & organoleptik' },
];

const DOC_TYPES = [
  { id: 'all', label: 'Semua Tipe' },
  { id: 'SOP', label: 'SOP (Standard Operating Procedure)', badgeBg: 'bg-teal-50 text-teal-800 border-teal-200' },
  { id: 'WI', label: 'WI (Work Instruction)', badgeBg: 'bg-sky-50 text-sky-800 border-sky-200' },
  { id: 'STD', label: 'STD (Standard Specification)', badgeBg: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'FORM', label: 'FORM (Formulir & Template)', badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
];

// Sample standard seed definitions if user triggers quick initial database setup
const GA_STANDARDS_TEMPLATE = [
  {
    doc_number: 'SOP-GA-MB-001',
    title: 'SOP Alur Penerimaan & Check-In Penghuni Mess Karyawan',
    category: 'mess_building',
    type: 'SOP',
    version: 'Rev. 02',
    effective_date: '2026-01-15',
    file_url: 'https://drive.google.com/file/d/sample_sop_mess_checkin/view',
    file_name: 'SOP_Penerimaan_Penghuni_Mess_Rev02.pdf',
    description: 'Prosedur baku verifikasi identitas, penempatan kamar, serah terima kunci, dan tata tertib hunian mess site.'
  },
  {
    doc_number: 'WI-GA-MB-002',
    title: 'Instruksi Kerja Sanitasi & Pembersihan Harian Kamar Mess',
    category: 'mess_building',
    type: 'WI',
    version: 'Rev. 01',
    effective_date: '2026-02-01',
    file_url: 'https://drive.google.com/file/d/sample_wi_housekeeping/view',
    file_name: 'WI_Sanitasi_Kamar_Mess.pdf',
    description: 'Panduan teknis langkah demi langkah pembersihan tempat tidur, kamar mandi, disinfeksi, dan penggantian linen.'
  },
  {
    doc_number: 'SOP-GA-TT-001',
    title: 'SOP Pengajuan & Penerbitan Tiket Perjalanan Dinas',
    category: 'travel_transport',
    type: 'SOP',
    version: 'Rev. 02',
    effective_date: '2026-01-20',
    file_url: 'https://drive.google.com/file/d/sample_sop_ticketing/view',
    file_name: 'SOP_Pemesanan_Tiket_Pesawat_GA.pdf',
    description: 'Tata cara permohonan tiket minimal H-7, verifikasi PNR, persetujuan atasan, dan ketentuan bagasi dinas.'
  },
  {
    doc_number: 'SOP-GA-AST-001',
    title: 'SOP Pengadaan, Registrasi & Pelabelan Aset Tetap General Affairs',
    category: 'assets',
    type: 'SOP',
    version: 'Rev. 02',
    effective_date: '2026-01-05',
    file_url: 'https://drive.google.com/file/d/sample_sop_aset/view',
    file_name: 'SOP_Pengadaan_dan_Registrasi_Aset.pdf',
    description: 'Mekanisme inventarisasi aset, penomoran kode barcode, penentuan COA, dan berita acara serah terima (BAST).'
  },
  {
    doc_number: 'SOP-GA-CAT-001',
    title: 'SOP Pengawasan Kualitas Makanan & Food Safety Catering',
    category: 'catering',
    type: 'SOP',
    version: 'Rev. 03',
    effective_date: '2026-01-10',
    file_url: 'https://drive.google.com/file/d/sample_sop_food_safety/view',
    file_name: 'SOP_Pengawasan_Kualitas_Catering.pdf',
    description: 'Standar baku penerimaan bahan baku, kebersihan dapur pengolahan, suhu penyimpanan, dan pengujian organoleptik.'
  }
];

export default function SopPage() {
  const [documents, setDocuments] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    docNumber: '',
    title: '',
    category: 'mess_building',
    type: 'SOP',
    version: 'Rev. 01',
    effectiveDate: new Date().toISOString().slice(0, 10),
    fileUrl: '',
    fileName: '',
    description: '',
    fileData: null // base64 string
  });

  // Map spreadsheet record to frontend doc object
  const mapRecordToDoc = (r) => ({
    id: r.id || `DOC-${Math.random().toString(36).substr(2, 9)}`,
    docNumber: r.doc_number || r.docNumber || '',
    title: r.title || '',
    category: r.category || 'mess_building',
    type: r.type || 'SOP',
    version: r.version || 'Rev. 01',
    effectiveDate: r.effective_date || r.effectiveDate || '',
    fileUrl: r.file_url || r.fileUrl || '',
    fileName: r.file_name || r.fileName || '',
    description: r.description || ''
  });

  // Fetch standards from Spreadsheet via GAS
  const fetchStandards = async () => {
    setIsLoading(true);
    try {
      const res = await gasClient.getStandards();
      if (res && res.ok && Array.isArray(res.data)) {
        setDocuments(res.data.map(mapRecordToDoc));
      } else {
        // Check cache in localStorage as fallback
        const cached = localStorage.getItem('garda_cache_GET_STANDARDS');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.ok && Array.isArray(parsed.data)) {
              setDocuments(parsed.data.map(mapRecordToDoc));
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Error fetching standards from GAS:', err);
      toast.error('Gagal memuat dokumen dari spreadsheet. Periksa koneksi internet.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStandards();
  }, []);

  // One-click helper to seed initial GA standards to Spreadsheet
  const handleSeedDatabase = async () => {
    if (!window.confirm('Muat dan simpan template standar operasional baku GA ke spreadsheet tbl_docs_standards?')) {
      return;
    }
    setIsSeeding(true);
    try {
      let successCount = 0;
      for (const item of GA_STANDARDS_TEMPLATE) {
        const res = await gasClient.createStandard(item);
        if (res && res.ok) successCount++;
      }
      toast.success(`Berhasil menyimpan ${successCount} dokumen standar ke spreadsheet!`);
      await fetchStandards();
    } catch (err) {
      toast.error('Gagal inisialisasi: ' + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      // 1. Category filter
      if (activeCategory !== 'all' && doc.category !== activeCategory) {
        return false;
      }
      // 2. Type filter
      if (selectedType !== 'all' && doc.type !== selectedType) {
        return false;
      }
      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = (doc.docNumber || '').toLowerCase().includes(q);
        const matchTitle = (doc.title || '').toLowerCase().includes(q);
        const matchDesc = (doc.description || '').toLowerCase().includes(q);
        if (!matchNumber && !matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [documents, activeCategory, selectedType, searchQuery]);

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts = { all: documents.length, mess_building: 0, travel_transport: 0, assets: 0, catering: 0 };
    documents.forEach(doc => {
      if (counts[doc.category] !== undefined) {
        counts[doc.category]++;
      }
    });
    return counts;
  }, [documents]);

  // Handle open modal for new document
  const handleOpenAddModal = () => {
    setEditingDoc(null);
    setFormData({
      docNumber: '',
      title: '',
      category: activeCategory !== 'all' ? activeCategory : 'mess_building',
      type: 'SOP',
      version: 'Rev. 01',
      effectiveDate: new Date().toISOString().slice(0, 10),
      fileUrl: '',
      fileName: '',
      description: '',
      fileData: null
    });
    setIsModalOpen(true);
  };

  // Handle open modal for editing
  const handleOpenEditModal = (doc) => {
    setEditingDoc(doc);
    setFormData({
      docNumber: doc.docNumber || '',
      title: doc.title || '',
      category: doc.category || 'mess_building',
      type: doc.type || 'SOP',
      version: doc.version || 'Rev. 01',
      effectiveDate: doc.effectiveDate || '',
      fileUrl: doc.fileUrl || '',
      fileName: doc.fileName || '',
      description: doc.description || '',
      fileData: null
    });
    setIsModalOpen(true);
  };

  // Handle local file selection -> read as base64 for GAS Drive upload
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 15MB untuk unggah langsung ke Google Drive.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({
        ...prev,
        fileName: file.name,
        fileData: reader.result // data URL base64
      }));
      toast.info(`File dipilih: ${file.name}. Akan diunggah ke Google Drive saat disimpan.`);
    };
    reader.onerror = () => {
      toast.error('Gagal membaca file lokal.');
    };
    reader.readAsDataURL(file);
  };

  // Handle Save (Create or Update in Spreadsheet)
  const handleSaveDoc = async (e) => {
    e.preventDefault();
    if (!formData.docNumber.trim() || !formData.title.trim()) {
      toast.error('Nomor Dokumen dan Judul Dokumen wajib diisi.');
      return;
    }

    setIsSaving(true);
    const payload = {
      doc_number: formData.docNumber.trim(),
      title: formData.title.trim(),
      category: formData.category,
      type: formData.type,
      version: formData.version.trim(),
      effective_date: formData.effectiveDate,
      file_url: formData.fileUrl.trim(),
      file_name: formData.fileName.trim(),
      description: formData.description.trim()
    };

    if (formData.fileData) {
      payload.fileData = formData.fileData;
      payload.fileName = formData.fileName;
    }

    try {
      if (editingDoc) {
        const res = await gasClient.updateStandard(editingDoc.id, payload);
        if (res && res.ok) {
          toast.success('Dokumen standar berhasil diperbarui di spreadsheet!');
        } else {
          toast.info('Pembaruan dikirim ke server.');
        }
      } else {
        const res = await gasClient.createStandard(payload);
        if (res && res.ok) {
          toast.success('Dokumen standar berhasil disimpan ke spreadsheet dan Drive!');
        } else {
          toast.info('Penyimpanan dikirim ke server.');
        }
      }
      setIsModalOpen(false);
      await fetchStandards();
    } catch (err) {
      toast.error('Gagal menyimpan dokumen: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleDeleteDoc = async (doc) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus dokumen "${doc.title}" dari database?`)) {
      return;
    }

    try {
      const res = await gasClient.deleteStandard(doc.id);
      if (res && res.ok) {
        toast.success('Dokumen berhasil dihapus dari spreadsheet.');
      } else {
        toast.info('Permintaan hapus diproses.');
      }
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) {
      toast.error('Gagal menghapus dokumen: ' + err.message);
    }
  };

  // Copy file link
  const handleCopyLink = (url) => {
    if (!url) {
      toast.info('Tautan file belum tersedia.');
      return;
    }
    navigator.clipboard.writeText(url);
    toast.success('Tautan berhasil disalin ke clipboard.');
  };

  const getTypeBadge = (type) => {
    const item = DOC_TYPES.find(t => t.id === type);
    return item ? item.badgeBg : 'bg-slate-50 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              General Affairs Governance
            </span>
            <span className="text-xs font-mono text-[var(--muted-foreground)] flex items-center gap-1">
              <Database className="w-3 h-3 text-teal-600" />
              tbl_docs_standards
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] font-display">
            Standards Repository (SOP / WI / STD & FORM)
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Penyimpanan terpusat SOP, Instruksi Kerja (WI), Dokumen Standar (STD), dan Formulir (FORM) terintegrasi langsung dengan Database Spreadsheet & Google Drive.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchStandards}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors disabled:opacity-50"
            title="Muat ulang data dari spreadsheet"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[var(--primary)]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {documents.length === 0 && (
            <button
              onClick={handleSeedDatabase}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors disabled:opacity-50"
              title="Inisialisasi template standar baku GA ke spreadsheet"
            >
              {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              <span className="hidden sm:inline">Setup Template GA</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Dokumen</span>
          </button>
        </div>
      </div>

      {/* 4 Business Process Category Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                isActive
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 shadow-sm ring-1 ring-[var(--primary)]/20'
                  : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 hover:bg-[var(--muted)]/40'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className={`p-2 rounded-lg ${isActive ? 'bg-[var(--primary)] text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-[var(--primary)] text-white' : 'bg-[var(--muted)] text-[var(--muted-foreground)]'
                }`}>
                  {count}
                </span>
              </div>
              <span className={`text-sm font-semibold ${isActive ? 'text-[var(--primary)] font-display' : 'text-[var(--foreground)]'}`}>
                {cat.label}
              </span>
              <span className="text-[11px] text-[var(--muted-foreground)] line-clamp-1 mt-0.5">
                {cat.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nomor dokumen, judul, atau deskripsi..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Filter className="w-4 h-4 text-[var(--muted-foreground)] mr-1 shrink-0" />
          {DOC_TYPES.map(type => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap transition-all ${
                selectedType === type.id
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
              }`}
            >
              {type.id === 'all' ? 'Semua Tipe' : type.id}
            </button>
          ))}
        </div>
      </div>

      {/* Main Documents Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mb-3" />
            <p className="text-sm font-medium text-[var(--foreground)]">Memuat dokumen standar dari database spreadsheet...</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">Sinkronisasi tbl_docs_standards via Google Apps Script</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-[var(--foreground)]">Belum ada dokumen standar</h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-md mt-1 mb-5">
              {searchQuery || activeCategory !== 'all' || selectedType !== 'all'
                ? 'Tidak ada dokumen yang cocok dengan filter atau pencarian Anda.'
                : 'Tabel database tbl_docs_standards masih kosong. Anda dapat menambahkan dokumen baru atau memuat template standar operasional baku GA.'}
            </p>
            <div className="flex items-center gap-3">
              {documents.length === 0 && (
                <button
                  onClick={handleSeedDatabase}
                  disabled={isSeeding}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors"
                >
                  <Database className="w-4 h-4" />
                  Inisialisasi Template Baku GA
                </button>
              )}
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Tambah Dokumen Baru
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)] text-xs text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 w-44">No. Dokumen</th>
                  <th className="py-3 px-4 w-28">Tipe & Kategori</th>
                  <th className="py-3 px-4">Judul & Ruang Lingkup</th>
                  <th className="py-3 px-4 w-24">Revisi</th>
                  <th className="py-3 px-4 w-32">Tgl Berlaku</th>
                  <th className="py-3 px-4 w-36">File & Sumber</th>
                  <th className="py-3 px-4 w-28 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredDocs.map((doc, idx) => {
                  const categoryInfo = CATEGORIES.find(c => c.id === doc.category);
                  const hasFile = Boolean(doc.fileUrl);

                  return (
                    <tr key={doc.id || idx} className="hover:bg-[var(--muted)]/30 transition-colors">
                      <td className="py-3 px-4 text-center text-xs font-mono text-[var(--muted-foreground)]">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-[var(--foreground)] bg-[var(--muted)] px-2 py-1 rounded border border-[var(--border)] block w-fit">
                          {doc.docNumber || '-'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${getTypeBadge(doc.type)}`}>
                            {doc.type}
                          </span>
                          <span className="text-[11px] text-[var(--muted-foreground)]">
                            {categoryInfo ? categoryInfo.label : doc.category}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="max-w-md">
                          <p className="font-semibold text-[var(--foreground)] line-clamp-2 leading-snug">
                            {doc.title}
                          </p>
                          {doc.description && (
                            <p className="text-xs text-[var(--muted-foreground)] line-clamp-1 mt-1">
                              {doc.description}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {doc.version || 'Rev. 00'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="text-xs font-mono text-[var(--muted-foreground)]">
                          {doc.effectiveDate || '-'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {hasFile ? (
                          <div className="flex flex-col gap-1 items-start">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline font-medium"
                              title="Buka file dokumen di Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate max-w-[130px]">{doc.fileName || 'Lihat Dokumen'}</span>
                            </a>
                            <button
                              onClick={() => handleCopyLink(doc.fileUrl)}
                              className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] flex items-center gap-1"
                              title="Salin tautan dokumen"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Salin Link</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)] italic">Tidak ada file</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(doc)}
                            className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded transition-colors"
                            title="Edit Dokumen"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title="Hapus Dokumen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info */}
        <div className="py-3 px-4 border-t border-[var(--border)] bg-[var(--muted)]/30 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <span>Menampilkan <strong>{filteredDocs.length}</strong> dari <strong>{documents.length}</strong> dokumen standar di database</span>
          <span className="font-mono text-[11px]">GA-Core Standards v2.0 • Google Drive Sync</span>
        </div>
      </div>

      {/* Modal Add / Edit Document */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--foreground)] font-display flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--primary)]" />
                {editingDoc ? 'Edit Dokumen Standar' : 'Tambah Dokumen Standar Baru'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDoc} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* No Dokumen */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Nomor Dokumen <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SOP-GA-MB-001"
                    value={formData.docNumber}
                    onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] font-mono focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  />
                </div>

                {/* Tipe Dokumen */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Tipe Dokumen <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  >
                    <option value="SOP">SOP (Standard Operating Procedure)</option>
                    <option value="WI">WI (Work Instruction / Instruksi Kerja)</option>
                    <option value="STD">STD (Standard Specification / Spesifikasi)</option>
                    <option value="FORM">FORM (Formulir & Template)</option>
                  </select>
                </div>
              </div>

              {/* Judul Dokumen */}
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Judul Dokumen Standar <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Prosedur Pengelolaan dan Pemeriksaan Sanitasi Kamar Mess"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Kategori Bisnis Proses */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Kategori Proses Bisnis
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  >
                    <option value="mess_building">Mess & Building</option>
                    <option value="travel_transport">Travel & Transport</option>
                    <option value="assets">Assets</option>
                    <option value="catering">Catering</option>
                  </select>
                </div>

                {/* Versi / Revisi */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Nomor Revisi
                  </label>
                  <input
                    type="text"
                    placeholder="Rev. 01"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] font-mono focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  />
                </div>

                {/* Tanggal Berlaku */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Tanggal Efektif Berlaku
                  </label>
                  <input
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              {/* Deskripsi */}
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Deskripsi Singkat / Ruang Lingkup
                </label>
                <textarea
                  rows={2}
                  placeholder="Ringkasan poin utama, pihak yang bertanggung jawab, atau prosedur pelaksanaan..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                />
              </div>

              {/* Upload File to Google Drive */}
              <div className="border border-dashed border-[var(--border)] rounded-xl p-4 bg-[var(--muted)]/20">
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5 flex items-center justify-between">
                  <span>File Dokumen (PDF / DOC / XLS)</span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">Otomatis diunggah ke Google Drive</span>
                </label>

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5 text-[var(--primary)]" />
                    Pilih File Lokal...
                  </button>

                  <span className="text-xs text-[var(--muted-foreground)] truncate flex-1 font-mono">
                    {formData.fileName || 'Belum ada file dipilih'}
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--border)]">
                  <label className="block text-[11px] text-[var(--muted-foreground)] mb-1">
                    Atau Masukkan Tautan Google Drive / Cloud Manual:
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/file/d/..."
                    value={formData.fileUrl}
                    onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)] rounded-lg text-[var(--foreground)] font-mono focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-white hover:opacity-90 flex items-center gap-2 transition-opacity disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan ke Database'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
