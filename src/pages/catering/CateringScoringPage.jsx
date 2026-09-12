import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  Utensils,
  Plus,
  Search,
  Filter,
  Calendar,
  Building,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  RotateCcw,
  Award,
  TrendingUp,
  Clock,
  Eye,
  Trash2,
  Edit,
  Check,
  X,
  Database,
  Loader2,
  Info,
  Layers,
  FileDown,
  Camera,
  Image as ImageIcon,
  UploadCloud
} from 'lucide-react';
import criteriaData from '../../data/cateringChecklistCriteria.json';
import { api as gasClient } from '../../lib/gasClient';
import CustomSelect from '../../components/ui/CustomSelect';
import { generateCateringPdfReport } from '../../utils/cateringPdfExport';

// Default Catering Vendors profile matching Excel Standar Report
const DEFAULT_VENDORS = [
  {
    id: 'VEND-ABS',
    vendor_name: 'CV ABS',
    catering_name: 'Catering GAS',
    site: 'LBCT',
    kitchen_type: 'A1',
    pic_name: 'Pak Agus',
    target_frequency: 2,
    target_score: 85,
    status: 'Aktif'
  },
  {
    id: 'VEND-MOMS',
    vendor_name: 'CV Moms Ainun',
    catering_name: "Catering Mom's",
    site: 'IDMG',
    kitchen_type: 'A2',
    pic_name: 'Ibu Ainun',
    target_frequency: 2,
    target_score: 85,
    status: 'Aktif'
  },
  {
    id: 'VEND-SANDAGA',
    vendor_name: 'PT Sandaga Perkasa',
    catering_name: 'Catering Sandaga',
    site: 'SPCT',
    kitchen_type: 'A3',
    pic_name: 'Pak Rudi',
    target_frequency: 2,
    target_score: 85,
    status: 'Aktif'
  },
  {
    id: 'VEND-MANGGALA',
    vendor_name: 'CV Manggala Raya',
    catering_name: 'Catering Manggala raya',
    site: 'LBCT',
    kitchen_type: 'A2',
    pic_name: 'Pak Hendra',
    target_frequency: 2,
    target_score: 85,
    status: 'Aktif'
  }
];

// Months list
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const WEEKS = [
  { value: 'W1', label: 'W1 (Minggu Ke-1)' },
  { value: 'W2', label: 'W2 (Minggu Ke-2)' },
  { value: 'W3', label: 'W3 (Minggu Ke-3)' },
  { value: 'W4', label: 'W4 (Minggu Ke-4)' }
];

// Initial realistic inspection seeds for test/demo
const INITIAL_SCORINGS_DEMO = [
  {
    id: 'SC-202601-001',
    vendor_id: 'VEND-ABS',
    vendor_name: 'CV ABS',
    catering_name: 'Catering GAS',
    site: 'LBCT',
    kitchen_type: 'A1',
    year: 2026,
    month: 'Januari',
    week: 'W1',
    inspection_date: '2026-01-07',
    auditor_name: 'Fauzan GA',
    total_score: 54,
    max_score: 59,
    food_index_percent: 91.5,
    grade: 'Sangat Baik (A)',
    findings_notes: 'Penyimpanan sayur sudah baik. Chiller suhu 5°C. Ada 2 talenan tergores perlu diganti.',
    corrective_actions: 'Ganti talenan baru dalam 3 hari kerja.',
    photos: [],
    created_at: '2026-01-07T10:30:00Z'
  },
  {
    id: 'SC-202601-002',
    vendor_id: 'VEND-ABS',
    vendor_name: 'CV ABS',
    catering_name: 'Catering GAS',
    site: 'LBCT',
    kitchen_type: 'A1',
    year: 2026,
    month: 'Januari',
    week: 'W3',
    inspection_date: '2026-01-21',
    auditor_name: 'Fauzan GA',
    total_score: 56,
    max_score: 59,
    food_index_percent: 94.9,
    grade: 'Sangat Baik (A)',
    findings_notes: 'Talenan sudah diganti. Kondisi dapur sangat bersih dan higienis.',
    corrective_actions: 'Pertahankan sanitasi.',
    photos: [],
    created_at: '2026-01-21T11:00:00Z'
  },
  {
    id: 'SC-202601-003',
    vendor_id: 'VEND-MOMS',
    vendor_name: 'CV Moms Ainun',
    catering_name: "Catering Mom's",
    site: 'IDMG',
    kitchen_type: 'A2',
    year: 2026,
    month: 'Januari',
    week: 'W2',
    inspection_date: '2026-01-14',
    auditor_name: 'Fikri GA',
    total_score: 53,
    max_score: 60,
    food_index_percent: 88.3,
    grade: 'Baik (B)',
    findings_notes: 'Kitchen hood berfungsi baik. Petugas perlu disiplin memakai masker saat packing.',
    corrective_actions: 'Briefing APD wajib setiap pagi.',
    photos: [],
    created_at: '2026-01-14T09:45:00Z'
  },
  {
    id: 'SC-202601-004',
    vendor_id: 'VEND-MOMS',
    vendor_name: 'CV Moms Ainun',
    catering_name: "Catering Mom's",
    site: 'IDMG',
    kitchen_type: 'A2',
    year: 2026,
    month: 'Januari',
    week: 'W4',
    inspection_date: '2026-01-28',
    auditor_name: 'Fikri GA',
    total_score: 55,
    max_score: 60,
    food_index_percent: 91.7,
    grade: 'Sangat Baik (A)',
    findings_notes: 'Penggunaan masker packing tertib 100%. Makanan hangat saat distribusi.',
    corrective_actions: 'Pertahankan konsistensi APD.',
    photos: [],
    created_at: '2026-01-28T14:15:00Z'
  },
  {
    id: 'SC-202601-005',
    vendor_id: 'VEND-SANDAGA',
    vendor_name: 'PT Sandaga Perkasa',
    catering_name: 'Catering Sandaga',
    site: 'SPCT',
    kitchen_type: 'A3',
    year: 2026,
    month: 'Januari',
    week: 'W1',
    inspection_date: '2026-01-08',
    auditor_name: 'Bambang HSE/GA',
    total_score: 57,
    max_score: 62,
    food_index_percent: 91.9,
    grade: 'Sangat Baik (A)',
    findings_notes: 'Ruang butcher dingin dan bersih. Steel gloves digunakan dengan baik.',
    corrective_actions: 'Lakukan kalibrasi termometer chiller.',
    photos: [],
    created_at: '2026-01-08T10:00:00Z'
  },
  {
    id: 'SC-202601-006',
    vendor_id: 'VEND-SANDAGA',
    vendor_name: 'PT Sandaga Perkasa',
    catering_name: 'Catering Sandaga',
    site: 'SPCT',
    kitchen_type: 'A3',
    year: 2026,
    month: 'Januari',
    week: 'W3',
    inspection_date: '2026-01-22',
    auditor_name: 'Bambang HSE/GA',
    total_score: 59,
    max_score: 62,
    food_index_percent: 95.2,
    grade: 'Sangat Baik (A)',
    findings_notes: 'Semua item checklist terpenuhi prima. Sanitasi umum rapi.',
    corrective_actions: 'Pertahankan predikat bintang.',
    photos: [],
    created_at: '2026-01-22T10:30:00Z'
  },
  {
    id: 'SC-202601-007',
    vendor_id: 'VEND-MANGGALA',
    vendor_name: 'CV Manggala Raya',
    catering_name: 'Catering Manggala raya',
    site: 'LBCT',
    kitchen_type: 'A2',
    year: 2026,
    month: 'Januari',
    week: 'W2',
    inspection_date: '2026-01-15',
    auditor_name: 'Fauzan GA',
    total_score: 51,
    max_score: 60,
    food_index_percent: 85.0,
    grade: 'Baik (B)',
    findings_notes: 'Bak sampah sempat tidak tertutup rapat saat pengolahan sibuk.',
    corrective_actions: 'Pastikan tutup bak sampah selalu tertutup rapat.',
    photos: [],
    created_at: '2026-01-15T11:30:00Z'
  },
  {
    id: 'SC-202601-008',
    vendor_id: 'VEND-MANGGALA',
    vendor_name: 'CV Manggala Raya',
    catering_name: 'Catering Manggala raya',
    site: 'LBCT',
    kitchen_type: 'A2',
    year: 2026,
    month: 'Januari',
    week: 'W4',
    inspection_date: '2026-01-29',
    auditor_name: 'Fauzan GA',
    total_score: 54,
    max_score: 60,
    food_index_percent: 90.0,
    grade: 'Sangat Baik (A)',
    findings_notes: 'Tutup bak sampah sudah terpasang rapi, kebersihan lantai meningkat.',
    corrective_actions: 'Monitor berkala.',
    photos: [],
    created_at: '2026-01-29T10:15:00Z'
  }
];

export default function CateringScoringPage() {
  // State
  const [vendors, setVendors] = useState(() => {
    try {
      const saved = localStorage.getItem('garda_catering_vendors');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_VENDORS;
  });

  const [scorings, setScorings] = useState(() => {
    try {
      const saved = localStorage.getItem('garda_catering_scorings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SCORINGS_DEMO;
  });

  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState('Januari');
  const [selectedSite, setSelectedSite] = useState('all');
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'report', 'history'
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInspectionDetail, setSelectedInspectionDetail] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState({
    month: 'Januari',
    vendor: 'all',
    site: 'all'
  });

  // Multiple Photos Upload Ref
  const photoInputRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    vendor_id: 'VEND-ABS',
    vendor_name: 'CV ABS',
    catering_name: 'Catering GAS',
    site: 'LBCT',
    kitchen_type: 'A1',
    year: 2026,
    month: 'Januari',
    week: 'W1',
    inspection_date: new Date().toISOString().slice(0, 10),
    auditor_name: '',
    findings_notes: '',
    corrective_actions: '',
    checklist_answers: {},
    photos: [] // [{ id, name, data, caption }]
  });

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('garda_catering_vendors', JSON.stringify(vendors));
      localStorage.setItem('garda_catering_scorings', JSON.stringify(scorings));
    } catch {}
  }, [vendors, scorings]);

  // Sync from GAS Database
  const syncWithDatabase = async () => {
    setIsLoading(true);
    try {
      const [vRes, sRes] = await Promise.allSettled([
        gasClient.getCateringVendors(),
        gasClient.getCateringScorings()
      ]);

      if (vRes.status === 'fulfilled' && vRes.value?.ok && Array.isArray(vRes.value.data) && vRes.value.data.length > 0) {
        setVendors(vRes.value.data);
      }
      if (sRes.status === 'fulfilled' && sRes.value?.ok && Array.isArray(sRes.value.data) && sRes.value.data.length > 0) {
        setScorings(sRes.value.data.map(item => ({
          ...item,
          photos: item.photos_json ? JSON.parse(item.photos_json) : (item.photos || [])
        })));
        toast.success(`Berhasil sinkronisasi ${sRes.value.data.length} data inspeksi dari spreadsheet!`);
      } else {
        toast.info('Data lokal katering aktif.');
      }
    } catch (err) {
      console.warn('Sync catering failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to calculate total max score for a kitchen type
  const getKitchenTypeDefaultMax = (kitchenType) => {
    if (kitchenType === 'A1') return 59;
    if (kitchenType === 'A2') return 60;
    return 62;
  };

  // Handle vendor change in form -> AUTO-GENERATE fields!
  const handleVendorSelect = (vendorId) => {
    const v = vendors.find(item => item.id === vendorId || item.vendor_name === vendorId);
    if (!v) return;

    // Reset default checklist answers based on new kitchen type
    const initialAnswers = {};
    criteriaData.forEach(cat => {
      cat.items.forEach(item => {
        if (item.is_header) return;
        if (v.kitchen_type === 'A1' && item.a1_na) {
          initialAnswers[item.id] = 'NA';
        } else if (v.kitchen_type === 'A2' && item.a2_na) {
          initialAnswers[item.id] = 'NA';
        } else {
          initialAnswers[item.id] = 1;
        }
      });
    });

    setFormData(prev => ({
      ...prev,
      vendor_id: v.id,
      vendor_name: v.vendor_name,
      catering_name: v.catering_name,
      site: v.site,
      kitchen_type: v.kitchen_type,
      checklist_answers: initialAnswers
    }));
  };

  // Open modal with pre-populated answers
  const handleOpenAddInspection = () => {
    const defaultVendor = vendors[0] || DEFAULT_VENDORS[0];
    const initialAnswers = {};

    criteriaData.forEach(cat => {
      cat.items.forEach(item => {
        if (item.is_header) return;
        if (defaultVendor.kitchen_type === 'A1' && item.a1_na) {
          initialAnswers[item.id] = 'NA';
        } else if (defaultVendor.kitchen_type === 'A2' && item.a2_na) {
          initialAnswers[item.id] = 'NA';
        } else {
          initialAnswers[item.id] = 1;
        }
      });
    });

    setFormData({
      vendor_id: defaultVendor.id,
      vendor_name: defaultVendor.vendor_name,
      catering_name: defaultVendor.catering_name,
      site: defaultVendor.site,
      kitchen_type: defaultVendor.kitchen_type,
      year: selectedYear,
      month: selectedMonth === 'all' ? 'Januari' : selectedMonth,
      week: 'W1',
      inspection_date: new Date().toISOString().slice(0, 10),
      auditor_name: '',
      findings_notes: '',
      corrective_actions: '',
      checklist_answers: initialAnswers,
      photos: []
    });
    setIsModalOpen(true);
  };

  // Live Auto-Calculation for Form
  const formCalculation = useMemo(() => {
    const answers = formData.checklist_answers || {};
    let totalScore = 0;
    let maxPoints = 0;
    const categoryScores = {};

    criteriaData.forEach(cat => {
      let catScore = 0;
      let catMax = 0;

      cat.items.forEach(item => {
        if (item.is_header) return;

        const val = answers[item.id];
        if (val === 'NA') return;

        catMax += item.max || 1;
        if (val === 1 || val === '1') {
          catScore += item.max || 1;
        }
      });

      categoryScores[cat.code] = {
        score: catScore,
        max: catMax,
        percent: catMax > 0 ? ((catScore / catMax) * 100).toFixed(1) : 100
      };

      totalScore += catScore;
      maxPoints += catMax;
    });

    const percent = maxPoints > 0 ? ((totalScore / maxPoints) * 100) : 0;
    let grade = 'Kurang (D)';
    let gradeBadge = 'bg-slate-100 text-slate-800 border-slate-300';

    if (percent >= 90) {
      grade = 'Sangat Baik (A)';
      gradeBadge = 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30';
    } else if (percent >= 80) {
      grade = 'Baik (B)';
      gradeBadge = 'bg-teal-50 text-teal-800 border-teal-200';
    } else if (percent >= 70) {
      grade = 'Cukup (C)';
      gradeBadge = 'bg-amber-50 text-amber-800 border-amber-200';
    } else {
      gradeBadge = 'bg-rose-50 text-rose-800 border-rose-200';
    }

    return {
      categoryScores,
      totalScore,
      maxPoints,
      percent: percent.toFixed(1),
      grade,
      gradeBadge
    };
  }, [formData.checklist_answers, formData.kitchen_type]);

  // Handle setting all answers to Yes (1)
  const handleSetAllYes = () => {
    const updated = { ...formData.checklist_answers };
    criteriaData.forEach(cat => {
      cat.items.forEach(item => {
        if (item.is_header) return;
        if (formData.kitchen_type === 'A1' && item.a1_na) return;
        if (formData.kitchen_type === 'A2' && item.a2_na) return;
        updated[item.id] = 1;
      });
    });
    setFormData(prev => ({ ...prev, checklist_answers: updated }));
    toast.success('Semua item yang berlaku diset menjadi Memenuhi (Yes).');
  };

  // Handle Photo File Upload (Multiple Photos)
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`File ${file.name} bukan format gambar.`);
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`Ukuran ${file.name} melebihi 8MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setFormData(prev => ({
          ...prev,
          photos: [
            ...prev.photos,
            {
              id: `PHOTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              name: file.name,
              data: reader.result,
              caption: ''
            }
          ]
        }));
      };
      reader.readAsDataURL(file);
    });
    toast.info(`${files.length} foto berhasil ditambahkan.`);
  };

  const handleRemovePhoto = (photoId) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter(p => p.id !== photoId)
    }));
  };

  const handleUpdatePhotoCaption = (photoId, caption) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.map(p => p.id === photoId ? { ...p, caption } : p)
    }));
  };

  // Handle Save Inspection
  const handleSaveInspection = async (e) => {
    e.preventDefault();
    if (!formData.auditor_name.trim()) {
      toast.error('Nama Auditor / Petugas Inspeksi wajib diisi.');
      return;
    }

    const newRecord = {
      id: `SC-${formData.year}${String(MONTHS.indexOf(formData.month) + 1).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      vendor_id: formData.vendor_id,
      vendor_name: formData.vendor_name,
      catering_name: formData.catering_name,
      site: formData.site,
      kitchen_type: formData.kitchen_type,
      year: formData.year,
      month: formData.month,
      week: formData.week,
      inspection_date: formData.inspection_date,
      auditor_name: formData.auditor_name.trim(),
      total_score: formCalculation.totalScore,
      max_score: formCalculation.maxPoints,
      food_index_percent: parseFloat(formCalculation.percent),
      grade: formCalculation.grade,
      checklist_answers: formData.checklist_answers,
      findings_notes: formData.findings_notes.trim(),
      corrective_actions: formData.corrective_actions.trim(),
      photos: formData.photos,
      created_at: new Date().toISOString()
    };

    setScorings(prev => [newRecord, ...prev]);
    toast.success(`Skoring Food Index ${formData.vendor_name} (${formData.week}) berhasil disimpan! Skor: ${formCalculation.percent}%`);
    setIsModalOpen(false);

    // Also send to spreadsheet via GAS
    try {
      await gasClient.createCateringScoring({
        ...newRecord,
        checklist_answers_json: JSON.stringify(newRecord.checklist_answers),
        photos_json: JSON.stringify(newRecord.photos)
      });
    } catch (err) {
      console.warn('Background sync error:', err);
    }
  };

  // Delete Inspection
  const handleDeleteScoring = async (id) => {
    if (!window.confirm('Hapus data inspeksi ini?')) return;
    setScorings(prev => prev.filter(s => s.id !== id));
    toast.success('Data inspeksi dihapus.');
    try {
      await gasClient.deleteCateringScoring(id);
    } catch {}
  };

  // Filtered Scorings for Current Period
  const periodScorings = useMemo(() => {
    return scorings.filter(s => {
      if (s.year !== selectedYear) return false;
      if (selectedMonth !== 'all' && s.month !== selectedMonth) return false;
      if (selectedSite !== 'all' && s.site !== selectedSite) return false;
      return true;
    });
  }, [scorings, selectedYear, selectedMonth, selectedSite]);

  // Standar Report Matrix Calculations (like Excel Standar Report sheet)
  const reportMatrix = useMemo(() => {
    return vendors.map((vendor, idx) => {
      const vendorInspections = periodScorings.filter(s =>
        s.vendor_name === vendor.vendor_name || s.vendor_id === vendor.id
      );

      const w1 = vendorInspections.find(s => s.week === 'W1');
      const w2 = vendorInspections.find(s => s.week === 'W2');
      const w3 = vendorInspections.find(s => s.week === 'W3');
      const w4 = vendorInspections.find(s => s.week === 'W4');

      const scores = [w1, w2, w3, w4].filter(Boolean).map(s => s.food_index_percent);
      const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const targetScore = vendor.target_score || 85;
      const scoreAchievement = avgScore !== null ? ((avgScore / targetScore) * 100) : null;

      const targetFreq = vendor.target_frequency || 2;
      const actualFreq = scores.length;
      const freqAchievement = ((actualFreq / targetFreq) * 100);

      return {
        no: idx + 1,
        vendor_id: vendor.id,
        vendor_name: vendor.vendor_name,
        catering_name: vendor.catering_name,
        site: vendor.site,
        kitchen_type: vendor.kitchen_type,
        w1: w1 ? w1.food_index_percent : null,
        w2: w2 ? w2.food_index_percent : null,
        w3: w3 ? w3.food_index_percent : null,
        w4: w4 ? w4.food_index_percent : null,
        avgScore: avgScore !== null ? avgScore.toFixed(1) : '-',
        targetScore,
        scoreAchievement: scoreAchievement !== null ? scoreAchievement.toFixed(1) : '-',
        targetFreq,
        actualFreq,
        freqAchievement: freqAchievement.toFixed(0),
        status: (avgScore !== null && avgScore >= targetScore && actualFreq >= targetFreq) ? 'Memenuhi Standar' : (actualFreq === 0 ? 'Belum Inspeksi' : 'Perlu Peningkatan')
      };
    });
  }, [vendors, periodScorings]);

  // Overall KPI metrics
  const kpiMetrics = useMemo(() => {
    const scores = periodScorings.map(s => s.food_index_percent);
    const avgFoodIndex = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : '0.0';

    const totalInspections = periodScorings.length;
    const vendorsWithInspection = new Set(periodScorings.map(s => s.vendor_name)).size;
    const complianceCount = reportMatrix.filter(r => r.status === 'Memenuhi Standar').length;

    return {
      avgFoodIndex,
      totalInspections,
      vendorsWithInspection,
      totalVendors: vendors.length,
      complianceRate: vendors.length > 0 ? ((complianceCount / vendors.length) * 100).toFixed(0) : 0
    };
  }, [periodScorings, reportMatrix, vendors]);

  // Trigger PDF Report Download
  const handleTriggerPdfExport = () => {
    generateCateringPdfReport({
      selectedYear,
      selectedMonth: exportScope.month,
      selectedVendor: exportScope.vendor,
      selectedSite: exportScope.site,
      reportMatrix,
      scorings,
      kpiMetrics
    });
    setIsExportModalOpen(false);
  };

  // Dropdown options
  const monthOptions = [
    { value: 'all', label: 'Semua Bulan (2026)' },
    ...MONTHS.map(m => ({ value: m, label: `${m} ${selectedYear}` }))
  ];

  const siteOptions = [
    { value: 'all', label: 'Semua Site Operasional' },
    { value: 'LBCT', label: 'Site LBCT' },
    { value: 'IDMG', label: 'Site IDMG' },
    { value: 'SPCT', label: 'Site SPCT' }
  ];

  const vendorOptions = [
    { value: 'all', label: 'Semua Vendor Katering' },
    ...vendors.map(v => ({ value: v.vendor_name, label: `${v.vendor_name} (${v.catering_name})` }))
  ];

  const formVendorOptions = vendors.map(v => ({
    value: v.id,
    label: v.vendor_name,
    subtext: `${v.catering_name} • Site ${v.site} (Tipe ${v.kitchen_type})`
  }));

  const formMonthOptions = MONTHS.map(m => ({ value: m, label: m }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] font-display flex items-center gap-2">
            <Utensils className="w-6 h-6 text-[var(--primary)]" />
            Vendor Catering Scoring & Food Index
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
            Monitoring inspeksi rutin, penilaian 9 sub-kriteria (A s/d I), dan evaluasi frekuensi inspeksi katering General Affairs.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setExportScope({
                month: selectedMonth,
                vendor: 'all',
                site: selectedSite
              });
              setIsExportModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors shadow-xs"
            title="Download dan Cetak Laporan PDF Resmi"
          >
            <FileDown className="w-4 h-4 text-[var(--primary)]" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={syncWithDatabase}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] transition-colors disabled:opacity-50"
            title="Sinkronisasi database spreadsheet"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[var(--primary)]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenAddInspection}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Input Inspeksi Baru</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar (Custom Dropdowns, No Ugly Native Selects!) */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Custom Month Select */}
          <div className="w-48">
            <CustomSelect
              icon={Calendar}
              value={selectedMonth}
              onChange={(val) => setSelectedMonth(val)}
              options={monthOptions}
              placeholder="Pilih Bulan..."
            />
          </div>

          {/* Custom Site Select */}
          <div className="w-48">
            <CustomSelect
              icon={Building}
              value={selectedSite}
              onChange={(val) => setSelectedSite(val)}
              options={siteOptions}
              placeholder="Pilih Site..."
            />
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 bg-[var(--muted)]/50 p-1 rounded-lg border border-[var(--border)]">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'dashboard'
                ? 'bg-[var(--card)] text-[var(--primary)] shadow-xs font-bold'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Dashboard Monitoring
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'report'
                ? 'bg-[var(--card)] text-[var(--primary)] shadow-xs font-bold'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Matriks Standar Report
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'history'
                ? 'bg-[var(--card)] text-[var(--primary)] shadow-xs font-bold'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Riwayat Log ({periodScorings.length})
          </button>
        </div>
      </div>

      {/* KPI Cards Row (Minimalist Modern, No Rainbow "AI" Chips) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-2">
            <span className="text-xs font-medium">Rata-rata Food Index</span>
            <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-[var(--foreground)]">
              {kpiMetrics.avgFoodIndex}%
            </span>
            <span className="text-xs font-semibold text-[var(--primary)]">
              (&ge; 85%)
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
            Status Kepatuhan: {parseFloat(kpiMetrics.avgFoodIndex) >= 85 ? 'Memenuhi Standar' : 'Perlu Peningkatan'}
          </p>
        </div>

        {/* KPI 2 */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-2">
            <span className="text-xs font-medium">Total Sesi Inspeksi</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-[var(--foreground)]">
              {kpiMetrics.totalInspections}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">Sesi</span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
            Mencakup W1 s/d W4 di seluruh site
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-2">
            <span className="text-xs font-medium">Kepatuhan Target Vendor</span>
            <Award className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-[var(--foreground)]">
              {kpiMetrics.complianceRate}%
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              ({kpiMetrics.vendorsWithInspection}/{kpiMetrics.totalVendors} Vendor)
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
            Vendor memenuhi kuota minimal 2x/bulan
          </p>
        </div>

        {/* KPI 4: Minimalist Modern Kitchen Standards (No Rainbow AI Chips!) */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[var(--muted-foreground)] mb-2">
            <span className="text-xs font-medium">Standar Poin Maksimal</span>
            <Layers className="w-4 h-4 text-[var(--primary)]" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 py-1 px-2 rounded-md bg-[var(--muted)]/50 border border-[var(--border)] text-center">
              <span className="text-[10px] text-[var(--muted-foreground)] block">A1</span>
              <span className="font-mono text-xs font-bold text-[var(--foreground)]">59 Poin</span>
            </div>
            <div className="flex-1 py-1 px-2 rounded-md bg-[var(--muted)]/50 border border-[var(--border)] text-center">
              <span className="text-[10px] text-[var(--muted-foreground)] block">A2</span>
              <span className="font-mono text-xs font-bold text-[var(--foreground)]">60 Poin</span>
            </div>
            <div className="flex-1 py-1 px-2 rounded-md bg-[var(--muted)]/50 border border-[var(--border)] text-center">
              <span className="text-[10px] text-[var(--muted-foreground)] block">A3</span>
              <span className="font-mono text-xs font-bold text-[var(--foreground)]">62 Poin</span>
            </div>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5">
            Sesuai Standar Food Index PT AGM
          </p>
        </div>
      </div>

      {/* VIEW TAB 1: DASHBOARD MONITORING MINGGUAN */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)] font-display">
                  Monitoring Perkembangan Food Index Mingguan ({selectedMonth} {selectedYear})
                </h3>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Evaluasi mingguan (W1, W2, W3, W4) terhadap target kepatuhan 85%.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reportMatrix.map(vendor => (
                <div
                  key={vendor.vendor_id}
                  className="border border-[var(--border)] rounded-xl p-4 bg-[var(--background)] hover:border-[var(--primary)]/40 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--foreground)]">{vendor.vendor_name}</span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)] font-semibold border border-[var(--border)]">
                          Tipe {vendor.kitchen_type}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]">
                          Site {vendor.site}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        Brand: <strong>{vendor.catering_name}</strong> • Target: {vendor.targetScore}%
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-medium text-[var(--muted-foreground)] block">Rata-rata</span>
                      <span className={`text-base font-bold font-mono ${
                        parseFloat(vendor.avgScore) >= 85 ? 'text-[var(--primary)]' : 'text-amber-600'
                      }`}>
                        {vendor.avgScore !== '-' ? `${vendor.avgScore}%` : '-'}
                      </span>
                    </div>
                  </div>

                  {/* 4 Weeks Bar Visualization */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[var(--border)]">
                    {[
                      { label: 'W1', val: vendor.w1 },
                      { label: 'W2', val: vendor.w2 },
                      { label: 'W3', val: vendor.w3 },
                      { label: 'W4', val: vendor.w4 }
                    ].map(w => {
                      const hasVal = w.val !== null;
                      const isPassing = hasVal && w.val >= 85;

                      return (
                        <div
                          key={w.label}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all ${
                            hasVal
                              ? isPassing
                                ? 'bg-[var(--primary)]/5 border-[var(--primary)]/30 text-[var(--primary)]'
                                : 'bg-amber-500/5 border-amber-500/30 text-amber-700'
                              : 'bg-[var(--card)] border-dashed border-[var(--border)] text-[var(--muted-foreground)]'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-[var(--muted-foreground)]">{w.label}</span>
                          <span className="text-sm font-bold font-mono mt-0.5">
                            {hasVal ? `${w.val}%` : '-'}
                          </span>
                          <span className="text-[9px] mt-0.5">
                            {hasVal ? (isPassing ? 'Memenuhi' : '< Target') : 'Belum Ada'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Frequency Progress Bar */}
                  <div className="mt-3 pt-2.5 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span>Frekuensi Inspeksi: <strong>{vendor.actualFreq}</strong> / {vendor.targetFreq} Sesi</span>
                    <span className={`font-semibold ${vendor.actualFreq >= vendor.targetFreq ? 'text-[var(--primary)]' : 'text-amber-600'}`}>
                      {vendor.freqAchievement}% Ketercapaian
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW TAB 2: MATRIKS STANDAR REPORT */}
      {activeTab === 'report' && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--muted)]/20">
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)] font-display">
                FORM PENCAPAIAN INSPEKSI CATERING ({selectedMonth} {selectedYear})
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Format Standar Report evaluasi Food Index dan Frekuensi Inspeksi PT Antang Gunung Meratus.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]">
              Periode 2026
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--muted)]/60 border-b border-[var(--border)] text-[var(--muted-foreground)] font-semibold uppercase">
                  <th rowSpan={2} className="py-2.5 px-3 text-center border-r border-[var(--border)] w-10">No</th>
                  <th rowSpan={2} className="py-2.5 px-3 border-r border-[var(--border)] w-48">Nama Vendor & Catering</th>
                  <th rowSpan={2} className="py-2.5 px-3 border-r border-[var(--border)] w-24">Site & Tipe</th>
                  <th colSpan={4} className="py-2 px-3 text-center border-r border-[var(--border)] bg-[var(--card)]">
                    Minggu Inspeksi ({selectedMonth})
                  </th>
                  <th colSpan={3} className="py-2 px-3 text-center border-r border-[var(--border)] bg-[var(--muted)]/40">
                    Food Index (%)
                  </th>
                  <th colSpan={3} className="py-2 px-3 text-center bg-[var(--card)]">
                    Frekuensi Inspeksi (Sesi)
                  </th>
                </tr>
                <tr className="bg-[var(--muted)]/40 border-b border-[var(--border)] text-[var(--muted-foreground)] font-semibold">
                  <th className="py-2 px-3 text-center w-14 border-r border-[var(--border)]">W1</th>
                  <th className="py-2 px-3 text-center w-14 border-r border-[var(--border)]">W2</th>
                  <th className="py-2 px-3 text-center w-14 border-r border-[var(--border)]">W3</th>
                  <th className="py-2 px-3 text-center w-14 border-r border-[var(--border)]">W4</th>

                  <th className="py-2 px-3 text-center w-14 border-r border-[var(--border)]">Target</th>
                  <th className="py-2 px-3 text-center w-14 border-r border-[var(--border)]">Actual</th>
                  <th className="py-2 px-3 text-center w-16 border-r border-[var(--border)]">Capaian</th>

                  <th className="py-2 px-3 text-center w-14 border-r border-[var(--border)]">Target</th>
                  <th className="py-2 px-3 text-center w-14 border-r border-[var(--border)]">Actual</th>
                  <th className="py-2 px-3 text-center w-16">Capaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-mono">
                {reportMatrix.map(row => (
                  <tr key={row.vendor_id} className="hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="py-3 px-3 text-center text-[var(--muted-foreground)] border-r border-[var(--border)]">
                      {row.no}
                    </td>

                    <td className="py-3 px-3 border-r border-[var(--border)] font-sans">
                      <p className="font-bold text-[var(--foreground)]">{row.vendor_name}</p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">{row.catering_name}</p>
                    </td>

                    <td className="py-3 px-3 border-r border-[var(--border)] font-sans">
                      <span className="font-semibold">{row.site}</span>
                      <span className="text-[10px] ml-1.5 px-1 py-0.5 rounded bg-[var(--muted)] font-mono font-bold">
                        {row.kitchen_type}
                      </span>
                    </td>

                    {/* W1 to W4 */}
                    <td className="py-3 px-3 text-center border-r border-[var(--border)]">
                      {row.w1 !== null ? <span className="font-bold text-[var(--primary)]">{row.w1}%</span> : '-'}
                    </td>
                    <td className="py-3 px-3 text-center border-r border-[var(--border)]">
                      {row.w2 !== null ? <span className="font-bold text-[var(--primary)]">{row.w2}%</span> : '-'}
                    </td>
                    <td className="py-3 px-3 text-center border-r border-[var(--border)]">
                      {row.w3 !== null ? <span className="font-bold text-[var(--primary)]">{row.w3}%</span> : '-'}
                    </td>
                    <td className="py-3 px-3 text-center border-r border-[var(--border)]">
                      {row.w4 !== null ? <span className="font-bold text-[var(--primary)]">{row.w4}%</span> : '-'}
                    </td>

                    {/* Food Index Summary */}
                    <td className="py-3 px-3 text-center border-r border-[var(--border)] text-[var(--muted-foreground)]">
                      {row.targetScore}%
                    </td>
                    <td className="py-3 px-3 text-center border-r border-[var(--border)] font-bold text-[var(--foreground)]">
                      {row.avgScore !== '-' ? `${row.avgScore}%` : '-'}
                    </td>
                    <td className={`py-3 px-3 text-center border-r border-[var(--border)] font-bold ${
                      parseFloat(row.scoreAchievement) >= 100 ? 'text-[var(--primary)]' : 'text-amber-600'
                    }`}>
                      {row.scoreAchievement !== '-' ? `${row.scoreAchievement}%` : '-'}
                    </td>

                    {/* Frekuensi Summary */}
                    <td className="py-3 px-3 text-center border-r border-[var(--border)] text-[var(--muted-foreground)]">
                      {row.targetFreq}
                    </td>
                    <td className="py-3 px-3 text-center border-r border-[var(--border)] font-bold text-[var(--foreground)]">
                      {row.actualFreq}
                    </td>
                    <td className={`py-3 px-3 text-center font-bold ${
                      parseFloat(row.freqAchievement) >= 100 ? 'text-[var(--primary)]' : 'text-amber-600'
                    }`}>
                      {row.freqAchievement}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW TAB 3: DAFTAR RIWAYAT LOG INSPEKSI */}
      {activeTab === 'history' && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--foreground)] font-display">
              Riwayat Log Formulir Inspeksi ({periodScorings.length} Laporan)
            </h3>
          </div>

          {periodScorings.length === 0 ? (
            <div className="p-12 text-center text-[var(--muted-foreground)]">
              Belum ada log inspeksi pada periode {selectedMonth} {selectedYear}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--muted)]/50 border-b border-[var(--border)] text-[var(--muted-foreground)] font-semibold uppercase">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Vendor & Katering</th>
                    <th className="py-3 px-4 w-24">Site & Tipe</th>
                    <th className="py-3 px-4 w-20">Minggu</th>
                    <th className="py-3 px-4 w-28">Tgl Inspeksi</th>
                    <th className="py-3 px-4 w-32">Auditor</th>
                    <th className="py-3 px-4 w-24 text-right">Skor Poin</th>
                    <th className="py-3 px-4 w-28 text-center">Food Index</th>
                    <th className="py-3 px-4 w-32 text-center">Predikat</th>
                    <th className="py-3 px-4 w-24 text-center">Lampiran</th>
                    <th className="py-3 px-4 w-20 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {periodScorings.map((sc, idx) => (
                    <tr key={sc.id} className="hover:bg-[var(--muted)]/30 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-[var(--muted-foreground)]">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-[var(--foreground)] block">{sc.vendor_name}</span>
                        <span className="text-[11px] text-[var(--muted-foreground)]">{sc.catering_name}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-[var(--foreground)]">{sc.site}</span>
                        <span className="text-[10px] ml-1.5 px-1 py-0.5 rounded bg-[var(--muted)] font-mono font-bold">
                          {sc.kitchen_type}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]">
                          {sc.week}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[var(--muted-foreground)]">
                        {sc.inspection_date}
                      </td>

                      <td className="py-3 px-4 text-[var(--foreground)]">
                        {sc.auditor_name}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[var(--foreground)]">
                        {sc.total_score} / {sc.max_score}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-sm text-[var(--primary)]">
                        {sc.food_index_percent}%
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                          sc.food_index_percent >= 90
                            ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30'
                            : sc.food_index_percent >= 80
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {sc.grade}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {sc.photos && sc.photos.length > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--primary)] font-semibold bg-[var(--primary)]/10 px-2 py-0.5 rounded-full">
                            <ImageIcon className="w-3 h-3" />
                            {sc.photos.length} Foto
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--muted-foreground)]">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedInspectionDetail(sc)}
                            className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] rounded transition-colors"
                            title="Lihat Rincian Checklist & Foto"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteScoring(sc.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title="Hapus Log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* EXPORT PDF MODAL (FILTER ALL / SPECIFIC MONTH / SPECIFIC VENDOR) */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--muted)]/20">
              <h2 className="text-sm font-bold text-[var(--foreground)] font-display flex items-center gap-2">
                <FileDown className="w-4 h-4 text-[var(--primary)]" />
                Cetak & Unduh Laporan PDF Katering
              </h2>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-[var(--muted-foreground)] leading-relaxed">
                Laporan resmi PT. Antang Gunung Meratus (HCGA) lengkap dengan logo perusahaan, monitoring mingguan, form pencapaian, dan detailing catatan temuan.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Pilih Periode Bulan:
                </label>
                <CustomSelect
                  value={exportScope.month}
                  onChange={(val) => setExportScope(prev => ({ ...prev, month: val }))}
                  options={monthOptions}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Pilih Vendor Katering:
                </label>
                <CustomSelect
                  value={exportScope.vendor}
                  onChange={(val) => setExportScope(prev => ({ ...prev, vendor: val }))}
                  options={vendorOptions}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Pilih Site Operasional:
                </label>
                <CustomSelect
                  value={exportScope.site}
                  onChange={(val) => setExportScope(prev => ({ ...prev, site: val }))}
                  options={siteOptions}
                />
              </div>

              <div className="p-3 bg-[var(--muted)]/40 rounded-lg text-[11px] text-[var(--muted-foreground)]">
                Format PDF standar A4 portrait, sudah dioptimasi untuk pencetakan fisik atau arsip digital.
              </div>
            </div>

            <div className="p-4 border-t border-[var(--border)] flex justify-end gap-2 bg-[var(--muted)]/10">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleTriggerPdfExport}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--primary)] text-white hover:opacity-90 flex items-center gap-1.5 transition-opacity"
              >
                <FileDown className="w-3.5 h-3.5" />
                Cetak / Simpan PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL INPUT INSPEKSI BARU (DENGAN MULTI-FOTO LAMPIRAN & CUSTOM SELECTS) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--muted)]/30">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[var(--primary)]" />
                <div>
                  <h2 className="text-base font-bold text-[var(--foreground)] font-display">
                    Formulir Skoring Food Index & Kepatuhan Katering
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Evaluasi 9 Kriteria Sanitasi Dapur PT Antang Gunung Meratus
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <form onSubmit={handleSaveInspection} className="p-5 space-y-6 overflow-y-auto flex-1">
              {/* SECTION 1: PROFILE VENDOR (AUTO GENERATE + CUSTOM DROPDOWN) */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                    <Building className="w-4 h-4" />
                    1. Identitas Vendor Katering (Auto-Populate)
                  </span>
                  <span className="text-[11px] text-[var(--muted-foreground)]">
                    Pilih nama vendor untuk mengisi otomatis profil katering
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Select Vendor with CustomSelect */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                      Nama Vendor <span className="text-rose-500">*</span>
                    </label>
                    <CustomSelect
                      value={formData.vendor_id}
                      onChange={(val) => handleVendorSelect(val)}
                      options={formVendorOptions}
                      placeholder="Pilih Vendor..."
                    />
                  </div>

                  {/* Auto-filled Catering Brand */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1">
                      Nama Katering
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formData.catering_name}
                      className="w-full px-3 py-2 text-xs bg-[var(--muted)]/50 border border-[var(--border)] rounded-lg font-medium text-[var(--foreground)] cursor-not-allowed"
                    />
                  </div>

                  {/* Auto-filled Site */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1">
                      Site Operasional
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formData.site}
                      className="w-full px-3 py-2 text-xs bg-[var(--muted)]/50 border border-[var(--border)] rounded-lg font-medium text-[var(--foreground)] cursor-not-allowed font-mono"
                    />
                  </div>

                  {/* Auto-filled Kitchen Type */}
                  <div>
                    <label className="block text-xs font-semibold text-[var(--muted-foreground)] mb-1">
                      Tipe Dapur (Max Point)
                    </label>
                    <div className="px-3 py-2 text-xs bg-[var(--muted)]/50 border border-[var(--border)] rounded-lg font-bold text-[var(--primary)] flex items-center justify-between">
                      <span>Tipe {formData.kitchen_type}</span>
                      <span className="font-mono text-[11px] font-normal text-[var(--muted-foreground)]">
                        {getKitchenTypeDefaultMax(formData.kitchen_type)} Poin
                      </span>
                    </div>
                  </div>
                </div>

                {/* Periode & Auditor */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                      Bulan Inspeksi
                    </label>
                    <CustomSelect
                      value={formData.month}
                      onChange={(val) => setFormData({ ...formData, month: val })}
                      options={formMonthOptions}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                      Minggu Ke- (Week)
                    </label>
                    <CustomSelect
                      value={formData.week}
                      onChange={(val) => setFormData({ ...formData, week: val })}
                      options={WEEKS}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                      Tanggal Pelaksanaan
                    </label>
                    <input
                      type="date"
                      value={formData.inspection_date}
                      onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                      Nama Auditor / GA <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama auditor..."
                      value={formData.auditor_name}
                      onChange={(e) => setFormData({ ...formData, auditor_name: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: CHECKLIST ITEMS ACCORDION (A s/d I) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    2. Evaluasi 9 Sub-Kriteria Inspeksi
                  </span>

                  <button
                    type="button"
                    onClick={handleSetAllYes}
                    className="text-xs px-2.5 py-1 rounded bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30 hover:bg-[var(--primary)]/20 font-semibold transition-colors"
                  >
                    Tandai Semua Memenuhi (Set All Yes)
                  </button>
                </div>

                {criteriaData.map((cat) => {
                  const catScoreInfo = formCalculation.categoryScores[cat.code] || { score: 0, max: 0, percent: 100 };

                  return (
                    <div key={cat.code} className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card)] shadow-xs">
                      {/* Category Header */}
                      <div className="p-3 bg-[var(--muted)]/40 border-b border-[var(--border)] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center font-mono">
                            {cat.code}
                          </span>
                          <span className="font-bold text-xs text-[var(--foreground)]">{cat.title}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[var(--primary)]">
                            {catScoreInfo.score} / {catScoreInfo.max} Poin ({catScoreInfo.percent}%)
                          </span>
                        </div>
                      </div>

                      {/* Items list */}
                      <div className="p-3 space-y-2.5 divide-y divide-[var(--border)]/40">
                        {cat.items.map((item) => {
                          if (item.is_header) {
                            return (
                              <div key={item.id} className="pt-2 font-semibold text-xs text-[var(--foreground)]">
                                {item.num}. {item.text}
                              </div>
                            );
                          }

                          const currentVal = formData.checklist_answers[item.id];
                          const isNativeNA = (formData.kitchen_type === 'A1' && item.a1_na) ||
                                            (formData.kitchen_type === 'A2' && item.a2_na);

                          return (
                            <div key={item.id} className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              <div className="flex-1 pr-2">
                                <span className="font-bold text-[var(--muted-foreground)] mr-1.5 font-mono">{item.num}.</span>
                                <span className="text-[var(--foreground)]">{item.text}</span>
                                {isNativeNA && (
                                  <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                                    N/A untuk Tipe {formData.kitchen_type}
                                  </span>
                                )}
                              </div>

                              {/* Toggle Buttons: Yes (1), No (0), NA */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={isNativeNA}
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    checklist_answers: { ...prev.checklist_answers, [item.id]: 1 }
                                  }))}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                                    currentVal === 1 || currentVal === '1'
                                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                                      : 'bg-[var(--background)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                  }`}
                                >
                                  Yes (1)
                                </button>

                                <button
                                  type="button"
                                  disabled={isNativeNA}
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    checklist_answers: { ...prev.checklist_answers, [item.id]: 0 }
                                  }))}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                                    currentVal === 0 || currentVal === '0'
                                      ? 'bg-rose-600 text-white font-bold shadow-xs'
                                      : 'bg-[var(--background)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                  }`}
                                >
                                  No (0)
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    checklist_answers: { ...prev.checklist_answers, [item.id]: 'NA' }
                                  }))}
                                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                                    currentVal === 'NA'
                                      ? 'bg-slate-700 text-white font-bold shadow-xs'
                                      : 'bg-[var(--background)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                                  }`}
                                >
                                  N/A
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SECTION 3: MULTIPLE PHOTOS LAMPIRAN (FOTO BISA LEBIH DARI 1) */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                    <Camera className="w-4 h-4" />
                    3. Lampiran Dokumentasi Foto Inspeksi (Bisa Banyak Foto)
                  </span>

                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-xs font-semibold text-[var(--foreground)] transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Upload Foto...</span>
                  </button>
                </div>

                <input
                  type="file"
                  ref={photoInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />

                {formData.photos.length === 0 ? (
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    className="border border-dashed border-[var(--border)] rounded-xl p-6 text-center cursor-pointer hover:border-[var(--primary)]/50 hover:bg-[var(--muted)]/20 transition-all"
                  >
                    <ImageIcon className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-medium text-[var(--foreground)]">Klik untuk menambahkan foto dokumentasi temuan</p>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">Mendukung format JPG, PNG, WEBP (bisa pilih beberapa foto sekaligus)</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    {formData.photos.map((photo, idx) => (
                      <div key={photo.id || idx} className="relative group border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--card)] shadow-xs">
                        <img
                          src={photo.data}
                          alt={photo.name}
                          className="w-full h-24 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo.id)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center transition-colors"
                          title="Hapus foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="p-1.5 border-t border-[var(--border)]">
                          <input
                            type="text"
                            placeholder="Catatan / keterangan foto..."
                            value={photo.caption || ''}
                            onChange={(e) => handleUpdatePhotoCaption(photo.id, e.target.value)}
                            className="w-full text-[10px] px-1.5 py-1 bg-transparent border border-transparent hover:border-[var(--border)] focus:border-[var(--primary)] rounded text-[var(--foreground)]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 4: FINDINGS & ACTIONS */}
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-1.5">
                  <Info className="w-4 h-4" />
                  4. Catatan Temuan & Rekomendasi Perbaikan
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                      Uraian Temuan / Ketidaksesuaian
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Catatan kebersihan, kondisi sarana, atau perilaku food handler..."
                      value={formData.findings_notes}
                      onChange={(e) => setFormData({ ...formData, findings_notes: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                      Tindakan Perbaikan (Corrective Action)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Tindakan yang harus dilakukan vendor beserta batas waktu..."
                      value={formData.corrective_actions}
                      onChange={(e) => setFormData({ ...formData, corrective_actions: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-[var(--card)] border border-[var(--border)] rounded-lg text-[var(--foreground)] focus:ring-1 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* LIVE SCORE BANNER */}
              <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                <div>
                  <span className="text-xs font-semibold text-[var(--muted-foreground)]">Total Skor Pencapaian:</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-[var(--foreground)]">
                      {formCalculation.totalScore} / {formCalculation.maxPoints}
                    </span>
                    <span className="text-sm font-bold font-mono text-[var(--primary)]">
                      ({formCalculation.percent}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-[var(--muted-foreground)] block">Predikat Kepatuhan:</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${formCalculation.gradeBadge}`}>
                      {formCalculation.grade}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold rounded-lg bg-[var(--primary)] text-white hover:opacity-90 shadow-sm transition-all"
                  >
                    Simpan Skoring Inspeksi
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL DRAWER FOR LOG INSPECTION */}
      {selectedInspectionDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--muted)]/20">
              <h2 className="text-sm font-bold text-[var(--foreground)] font-display flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[var(--primary)]" />
                Rincian Evaluasi Inspeksi - {selectedInspectionDetail.vendor_name} ({selectedInspectionDetail.week})
              </h2>
              <button
                onClick={() => setSelectedInspectionDetail(null)}
                className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[var(--muted)]/30 rounded-lg">
                <div>
                  <span className="text-[10px] text-[var(--muted-foreground)] block">Vendor & Katering</span>
                  <span className="font-bold text-[var(--foreground)]">{selectedInspectionDetail.vendor_name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted-foreground)] block">Site & Dapur</span>
                  <span className="font-semibold text-[var(--foreground)]">{selectedInspectionDetail.site} (Tipe {selectedInspectionDetail.kitchen_type})</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted-foreground)] block">Periode</span>
                  <span className="font-mono text-[var(--foreground)]">{selectedInspectionDetail.week} - {selectedInspectionDetail.month} {selectedInspectionDetail.year}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted-foreground)] block">Auditor</span>
                  <span className="font-medium text-[var(--foreground)]">{selectedInspectionDetail.auditor_name}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[11px] text-[var(--muted-foreground)]">Skor Total Food Index</span>
                  <div className="text-xl font-bold font-mono text-[var(--foreground)]">
                    {selectedInspectionDetail.total_score} / {selectedInspectionDetail.max_score} ({selectedInspectionDetail.food_index_percent}%)
                  </div>
                </div>
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30">
                  {selectedInspectionDetail.grade}
                </span>
              </div>

              {selectedInspectionDetail.findings_notes && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
                  <span className="font-bold text-amber-900 block mb-1">Catatan Temuan:</span>
                  <p className="text-amber-800">{selectedInspectionDetail.findings_notes}</p>
                </div>
              )}

              {selectedInspectionDetail.corrective_actions && (
                <div className="p-3 bg-[var(--muted)]/40 border border-[var(--border)] rounded-lg">
                  <span className="font-bold text-[var(--foreground)] block mb-1">Tindakan Perbaikan:</span>
                  <p className="text-[var(--muted-foreground)]">{selectedInspectionDetail.corrective_actions}</p>
                </div>
              )}

              {/* Photos Gallery */}
              {selectedInspectionDetail.photos && selectedInspectionDetail.photos.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <span className="font-bold text-xs text-[var(--foreground)] block">
                    Lampiran Foto Inspeksi ({selectedInspectionDetail.photos.length} Foto):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedInspectionDetail.photos.map((p, pIdx) => (
                      <div key={p.id || pIdx} className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--background)]">
                        <img src={p.data || p.url} alt={p.name} className="w-full h-28 object-cover" />
                        {p.caption && (
                          <div className="p-1.5 text-[10px] text-[var(--muted-foreground)] truncate bg-[var(--card)]">
                            {p.caption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-[var(--border)] flex justify-end">
              <button
                onClick={() => setSelectedInspectionDetail(null)}
                className="px-4 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
