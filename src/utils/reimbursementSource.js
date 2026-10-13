export const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
export const SPREADSHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1qBCW0L34wtuvzM690Ajk2IFJgXm78aQidjblQHYT-90/export?format=csv&gid=413081409';
export function parseReimbursementCSV(csvText) {
  if (typeof csvText !== 'string') throw new Error('Sumber data bukan CSV.');
  csvText = csvText.replace(/^\uFEFF/, '');
  const lines = [];
  let curLine = [];
  let curField = '';
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i];
    if (c === '"') {
      if (inQuotes && csvText[i+1] === '"') {
        curField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      curLine.push(curField);
      curField = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && csvText[i+1] === '\n') i++;
      curLine.push(curField);
      curField = '';
      lines.push(curLine);
      curLine = [];
    } else {
      curField += c;
    }
  }
  if (curField || curLine.length > 0) {
    curLine.push(curField);
    lines.push(curLine);
  }

  if (inQuotes || lines[0]?.length < 42 || lines[0]?.[0]?.trim() !== 'Timestamp' || !lines[0]?.[1]?.includes('kebutuhan')) {
    throw new Error('Format spreadsheet sumber tidak sesuai. Gunakan CSV Form Order dengan kolom A-AP.');
  }
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i];
    const kebutuhan = (parts[1] || '').trim();
    if (!/^reimbursement$/i.test(kebutuhan)) continue;

    const nama = (parts[18] || '').trim();
    if (!nama) continue;

    const timestamp = (parts[0] || '').trim();
    const nik = (parts[19] || '').trim();
    const no_hp = (parts[20] || '').trim();
    const status = (parts[21] || '').trim();
    const departemen = (parts[22] || '').trim();
    const site = (parts[39] || '').trim();

    const url_bukti_cuti = (parts[23] || '').trim();     // Kolom X
    const url_nota_berangkat = (parts[24] || '').trim();                           // Kolom Y
    const url_nota_pulang = (parts[40] || '').trim();                              // Kolom AO
    const url_boarding_pass = (parts[41] || '').trim();                            // Kolom AP

    const tgl_berangkat = (parts[25] || '').trim();
    const tgl_pulang = (parts[26] || '').trim();

    const match = timestamp.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) throw new Error('Timestamp tidak valid pada baris ' + (i + 1));
    const [, d, m, y] = match;
    const day = Number(d), month = Number(m), year = Number(y);
    if (month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate()) {
      throw new Error('Tanggal tidak valid pada baris ' + (i + 1));
    }
    const monthName = MONTHS[month - 1] || 'Januari';
    const periodeKe = day <= 15 ? 'Periode 1 (1-15)' : 'Periode 2 (16-31)';

    result.push({
      id: `REIMB-${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
      no: result.length + 1,
      timestamp,
      nama,
      nik,
      no_hp,
      status,
      departemen,
      site,
      tgl_berangkat,
      tgl_pulang,
      url_boarding_pass,
      url_bukti_cuti,
      url_nota_berangkat,
      url_nota_pulang,
      periode_tahun: year,
      periode_bulan: monthName,
      periode_ke: periodeKe,
      status_finance: 'Diajukan',
      tgl_pengajuan_finance: '',
      tgl_pencairan_finance: '',
      catatan: ''
    });
  }
  return result;
}
