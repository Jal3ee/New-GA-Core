# Reimbursement: spreadsheet dan laporan periode

Sumber adalah Google Spreadsheet `1qBCW0L34wtuvzM690Ajk2IFJgXm78aQidjblQHYT-90`, tab `413081409`. Pembacaan spreadsheet tidak mengubah Google Form atau responsnya. Hanya baris kolom B bernilai `Reimbursement` yang digunakan. Identitas dan tanggal diambil dari S-AA; site dari AN. Lampiran mengikuti AP, X, Y, AO sesuai kebutuhan rekap.

Periode mengikuti **timestamp pengajuan (kolom A)**: tanggal 1-15 masuk periode 1, tanggal 16 hingga akhir bulan masuk periode 2. Tahun mengikuti data sumber. Tanggal perjalanan Z-AA tidak menentukan periode pengajuan.

PDF menggunakan A4, daftar seluruh karyawan yang dapat berlanjut ke halaman berikutnya, lalu lampiran berurutan untuk setiap karyawan. Nama, NIK, departemen, site, periode dan nomor halaman muncul pada setiap halaman lampiran. Gambar dimasukkan ke PDF; semua halaman PDF sumber dimasukkan dengan rasio asli dan rotasi/crop sumber. Tidak ada nominal yang dihitung atau ditambahkan ke rekap. Isi asli nota tetap ditampilkan utuh.

## Akses lampiran Drive

Endpoint `/api/reimbursements/attachment/:id` membutuhkan sesi aplikasi yang valid. Berkas harus tercantum di kolom lampiran baris reimbursement pada spreadsheet sumber. Endpoint tidak menerima URL arbitrary.

Untuk berkas privat:

1. Aktifkan Google Drive API pada proyek Google Cloud service account.
2. Isi `GOOGLE_SERVICE_ACCOUNT_EMAIL` dan `GOOGLE_PRIVATE_KEY` pada konfigurasi server `.env`. Private key dapat menggunakan literal `\n` sebagai pemisah baris. Jangan simpan kredensial di frontend atau Git.
3. Bagikan folder/berkas lampiran sebagai **Viewer** kepada alamat service account tersebut. Untuk Shared Drive, berikan akses yang sesuai pada drive/folder.
4. Restart backend Node. Sinkronkan reimbursement dan ekspor satu periode.

Tanpa kredensial, backend mencoba mengunduh berkas yang tersedia melalui tautan publik. Halaman login Google atau HTML tidak dianggap sebagai gambar. Jika lampiran yang memiliki tautan gagal diakses, ekspor berhenti dengan nama karyawan dan jenis lampiran yang bermasalah. Kolom yang memang kosong diberi halaman keterangan. Kegagalan sinkronisasi mempertahankan data terakhir dan menampilkan status gagal.

## Verifikasi

Halaman publik `/cek-reimbursement` memiliki tampilan tersendiri dan tidak memerlukan login. Pencarian memakai NIK lengkap dan membandingkan digit tanpa nol di depan agar NIK numerik dari spreadsheet tetap ditemukan (misalnya 262210023 cocok dengan 0262210023). NIK yang dimasukkan tetap ditampilkan utuh; riwayat dari kedua format digabungkan, tanpa pencarian potongan/sufiks NIK. Periode ditampilkan dari lama sampai terbaru. API hanya mengirim nama, NIK, departemen, site, periode dan status; nominal, kontak, catatan internal dan tautan lampiran tidak dikirim.

Di GA Core, pilih periode reimbursement lalu **Ubah Status Proses Periode**. Status disimpan di PostgreSQL (`reimbursement_period_status`), sehingga pencarian publik membaca status yang sama. Tahapnya: Belum Diproses, Penyusunan Rekap, Approval GA Site, Approval Dept Head GA & Finance, Proses Pencairan, Selesai Dicairkan. Periode tanpa status tersimpan dimulai sebagai Belum Diproses. Admin/GA/Finance berwenang menyimpan status; pengunjung publik hanya dapat mencari NIK. Data lama yang tersimpan di browser admin dimigrasikan hanya jika periode belum mempunyai status di server.

Tabel dibuat secara aditif saat endpoint pertama kali dipakai; skema tersedia di `database/reimbursement-period-status.sql` dan disertakan dalam fungsi Vercel. Tidak perlu menjalankan ulang migrasi/seeding aplikasi. Nama pada rekap memakai kapital awal setiap kata dan judul lampiran tidak menampilkan kode kolom.

- `npm run build`
- `node scripts/verify-reimbursement-workflow.mjs`: pencarian persis, urutan periode, pembatasan informasi publik, izin edit, semua tahap, persistensi dan migrasi. Perubahan data uji dibatalkan dengan rollback transaksi.
- `node scripts/verify-reimbursement.mjs`: pemetaan CSV referensi dan spreadsheet live, pengawetan NIK, periode, gambar, PDF multi-halaman dan rotasi, pagination daftar, penolakan campuran periode dan kegagalan unduh, serta rendering PNG untuk pemeriksaan visual.
- `node scripts/verify-reimbursement-api.mjs`: server pengujian lokal terpisah, autentikasi wajib, penolakan ID yang tidak tercantum dan pemeriksaan akses Drive asli. Tidak mengubah data aplikasi.

Pemeriksaan 14 Oktober 2026: kredensial service account sudah dipasang di konfigurasi lokal, Google Drive API sudah aktif, dan autentikasi serta unduhan lampiran asli berhasil. Rekap Oktober 2026 Periode 1 mencakup 11 pengajuan dari 10 karyawan, 44 berkas sumber (27 PDF, 4 PNG, 13 JPEG), dan 90 halaman hasil. Beberapa pengajuan dari NIK yang sama disatukan dalam satu bagian karyawan: seluruh boarding pass, seluruh bukti cuti, seluruh nota keberangkatan, lalu seluruh nota kepulangan. Semua lampiran pengajuan tetap dipertahankan. PDF hasil disimpan di `output/pdf/Rekap_Reimbursement_Oktober_2026_Periode_1.pdf`.

`node scripts/verify-reimbursement-live.mjs` mengunduh seluruh lampiran periode tersebut melalui endpoint autentikasi, menyusun PDF menggunakan compiler aplikasi, dan merender seluruh halaman dengan decoder WASM PDF.js untuk pemeriksaan visual. Pengujian tidak menulis ke spreadsheet atau Drive.
