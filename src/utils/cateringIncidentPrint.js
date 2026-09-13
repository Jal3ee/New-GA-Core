// Print and PDF utility for Catering Incidents & Action Reports (NCR)

export function printCateringIncident(incident) {
  const win = window.open('', '_blank', 'width=900,height=750');
  if (!win) {
    alert('Popup diblokir browser. Izinkan popup untuk mencetak laporan.');
    return;
  }

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  };

  const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Temuan & Tindakan Katering - ${incident.report_number || incident.id}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; line-height: 1.5; margin: 0; padding: 15px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .company-title { font-size: 16px; font-weight: bold; color: #0f172a; }
    .company-sub { font-size: 11px; color: #64748b; }
    .doc-badge { text-align: right; }
    .doc-num { font-size: 14px; font-weight: bold; font-family: monospace; color: #0f172a; }
    .doc-type { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 4px; font-weight: 600; }
    
    .title-banner { text-align: center; margin: 16px 0; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
    .title-banner h2 { margin: 0; font-size: 14px; font-weight: bold; text-transform: uppercase; color: #0f172a; }
    .title-banner p { margin: 2px 0 0; font-size: 11px; color: #64748b; }

    table.info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    table.info-table td { padding: 6px 10px; border: 1px solid #cbd5e1; font-size: 11px; vertical-align: top; }
    table.info-table td.label { width: 22%; font-weight: bold; background: #f8fafc; color: #475569; }

    .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; border-left: 4px solid #0f766e; padding-left: 8px; margin: 16px 0 8px; color: #0f766e; }

    .content-box { border: 1px solid #cbd5e1; background: #fff; padding: 10px 14px; border-radius: 4px; font-size: 11px; margin-bottom: 14px; }
    
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }
    .badge-critical { background: #ffe4e6; color: #9f1239; }
    .badge-high { background: #ffedd5; color: #9a3412; }
    .badge-medium { background: #fef9c3; color: #854d0e; }
    .badge-low { background: #e0f2fe; color: #075985; }

    .action-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }

    .signatures { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; }
    .sig-col { width: 30%; }
    .sig-space { height: 60px; }
    .sig-name { font-weight: bold; text-decoration: underline; font-size: 11px; }
    .sig-title { font-size: 10px; color: #64748b; }

    .print-btn-bar { margin-bottom: 20px; text-align: right; }
    .btn-print { background: #0f766e; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px; }
    @media print {
      .print-btn-bar { display: none; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="btn-print" onclick="window.print()">Cetak / Simpan PDF</button>
  </div>

  <div class="header">
    <div>
      <div class="company-title">GENERAL AFFAIRS DEPARTMENT</div>
      <div class="company-sub">Non-Conformance & Food Safety Incident Investigation Report</div>
    </div>
    <div class="doc-badge">
      <div class="doc-num">${incident.report_number || incident.id}</div>
      <div class="doc-type">BERITA ACARA TEMUAN KATERING</div>
    </div>
  </div>

  <div class="title-banner">
    <h2>FORMULIR LAPORAN TEMUAN & TINDAKAN DISIPLIN VENDOR</h2>
    <p>Site Operasional: ${incident.site} • Tanggal Kejadian: ${incident.incident_date}</p>
  </div>

  <table class="info-table">
    <tr>
      <td class="label">Nama Vendor / Katering</td>
      <td style="width: 28%; font-weight: bold;">${incident.vendor_name} (${incident.catering_name || '-'})</td>
      <td class="label">Site Kerja</td>
      <td>Site ${incident.site}</td>
    </tr>
    <tr>
      <td class="label">Kategori Temuan</td>
      <td style="font-weight: 600;">${incident.category}</td>
      <td class="label">Tingkat Keparahan</td>
      <td>
        <span class="badge ${incident.severity === 'Kritis' ? 'badge-critical' : incident.severity === 'Tinggi' ? 'badge-high' : incident.severity === 'Sedang' ? 'badge-medium' : 'badge-low'}">
          ${incident.severity}
        </span>
      </td>
    </tr>
    <tr>
      <td class="label">Petugas Pemeriksa / Pelapor</td>
      <td>${incident.reporter_name}</td>
      <td class="label">Status Saat Ini</td>
      <td style="font-weight: bold;">${incident.status}</td>
    </tr>
  </table>

  <div class="section-title">A. Uraian Temuan / Kronologi Kejadian</div>
  <div class="content-box">
    <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px; color: #0f172a;">${incident.title}</div>
    <div style="white-space: pre-wrap; color: #334155;">${incident.description}</div>
    ${incident.evidence_urls ? `<div style="margin-top: 8px; font-size: 10px; color: #0f766e;"><strong>Tautan Lampiran Bukti:</strong> <a href="${incident.evidence_urls}" target="_blank">${incident.evidence_urls}</a></div>` : ''}
  </div>

  <div class="section-title">B. Tindakan Yang Diambil / Sanksi Disiplin</div>
  <div class="content-box">
    <div style="margin-bottom: 8px;">
      <span class="action-badge">${incident.action_type}</span>
      ${incident.penalty_amount > 0 ? `<span style="margin-left: 10px; font-weight: bold; color: #dc2626;">Denda/Pinalti: ${formatCurrency(incident.penalty_amount)}</span>` : ''}
    </div>
    <div style="font-weight: bold; font-size: 11px; margin-bottom: 2px;">Rincian Tindakan / Instruksi Perbaikan:</div>
    <div style="white-space: pre-wrap; color: #334155;">${incident.action_details || 'Teguran lisan dan evaluasi standar kebersihan.'}</div>
    <div style="display: flex; gap: 24px; margin-top: 10px; font-size: 11px; border-top: 1px dashed #e2e8f0; padding-top: 8px;">
      <div><strong>Target Selesai (SLA):</strong> ${incident.target_completion_date || '-'}</div>
      <div><strong>Realisasi Penyelesaian:</strong> ${incident.actual_completion_date || (incident.status === 'Closed' ? 'Selesai' : 'Dalam Proses')}</div>
    </div>
    ${incident.action_evidence_urls ? `<div style="margin-top: 8px; font-size: 10px; color: #0f766e;"><strong>Tautan Dokumen/Foto Tindakan:</strong> <a href="${incident.action_evidence_urls}" target="_blank">${incident.action_evidence_urls}</a></div>` : ''}
  </div>

  <div class="section-title">C. Verifikasi dan Catatan General Affairs</div>
  <div class="content-box">
    <div>${incident.verification_notes || 'Telah diverifikasi sesuai standar mutu penyajian makanan GA.'}</div>
  </div>

  <div class="signatures">
    <div class="sig-col">
      <div class="sig-title">Dilaporkan / Diperiksa Oleh:</div>
      <div class="sig-space"></div>
      <div class="sig-name">${incident.reporter_name}</div>
      <div class="sig-title">Auditor / Pengawas GA</div>
    </div>
    <div class="sig-col">
      <div class="sig-title">Diterima & Disanggupi Oleh:</div>
      <div class="sig-space"></div>
      <div class="sig-name">PIC ${incident.vendor_name}</div>
      <div class="sig-title">Perwakilan Vendor Katering</div>
    </div>
    <div class="sig-col">
      <div class="sig-title">Mengetahui & Menyetujui:</div>
      <div class="sig-space"></div>
      <div class="sig-name">Section Head General Affairs</div>
      <div class="sig-title">GA Department</div>
    </div>
  </div>

  <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; text-align: center;">
    Dokumen Berita Acara ini diterbitkan secara resmi melalui Sistem Informasi GA Core PT AGM.
  </div>
</body>
</html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
}
