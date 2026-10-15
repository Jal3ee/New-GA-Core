# Jenis reimbursement dan pengaturan halaman lampiran

Buka **Reimbursement > Rincian Periode > Kelola Lampiran** pada karyawan, atau gunakan tombol yang sama pada Mode Perorangan. Pengaturan berlaku per pengajuan, tidak per periode atau seluruh karyawan.

- **Actual** memakai urutan Boarding Pass, Bukti Cuti, Nota Keberangkatan, Nota Kepulangan.
- **Lumpsum** memakai Boarding Pass, Bukti Cuti, lalu **Lampiran Lumpsum** dari upload keberangkatan. Nota kepulangan tidak dimuat dan tidak dibuatkan halaman kosong. Checkbox jenis dokumen saat compile tetap menentukan apakah Boarding Pass/Bukti Cuti disertakan.
- **Preview & pilih halaman** menampilkan halaman PDF atau gambar. **Keluarkan** menghilangkan halaman tersebut dari rekap berikutnya; **Pulihkan** membatalkannya. Semua halaman pada file duplikat dapat dikeluarkan. File asli di Google Drive tidak dihapus/diubah.
- Klik **Simpan Perubahan** sebelum mencetak/compile. PDF yang sudah diunduh sebelumnya tetap merupakan versi lama dan perlu dibuat ulang.

Preview dipaginasi 12 halaman sekaligus. Setiap file disimpan dengan Drive ID, SHA-256, jumlah halaman dan nomor halaman asli berbasis 1. Nomor tampilan rekap dihitung ulang setelah penyaringan. Jika file dengan ID sama berubah isi, compile menolak pilihan lama; buka preview lagi, tinjau pilihan dan simpan. Seluruh dokumen gagal dimuat atau perubahan file tidak dilewati secara diam-diam.

Metadata tersimpan di PostgreSQL `reimbursement_document_edits`, terpisah dari sumber spreadsheet. Identitas memakai timestamp pengajuan, NIK tanpa perbedaan nol di depan, nama dan site; pergantian nomor baris/ID hasil parser tidak memindahkan pilihan ke pengajuan lain. Sinkronisasi ulang tidak menghapus metadata. Pergantian timestamp/nama/site mengubah identitas pengajuan dan perlu peninjauan ulang.

GET `/api/reimbursements/document-edits` membutuhkan login. PUT pada endpoint yang sama membutuhkan peran admin/ga_admin/ga_gl/ga_sh/finance dan memvalidasi pengajuan serta Drive ID terhadap sumber spreadsheet. Versi revision mencegah perubahan pengguna lain tertimpa tanpa diketahui (HTTP 409). Metadata dan halaman lampiran tidak disertakan pada API lookup publik. Compiler download dan print memuat metadata terbaru sebelum membuat PDF; kegagalan pemuatan menghentikan pembuatan rekap.

Verifikasi: `node scripts/verify-reimbursement-edits.mjs` menguji lumpsum, penghapusan halaman 3 dari tiga halaman, pemulihan, penghapusan seluruh lampiran duplikat, perubahan isi file, identitas stabil, validasi, izin akses, persistensi dan konflik versi. Tes database menggunakan tabel sementara dan rollback. `node scripts/verify-reimbursement.mjs` memverifikasi parser, urutan dokumen, pemuatan gambar/PDF, rotasi, pemisahan periode, layout dan tidak adanya nominal. QA browser terpisah memeriksa worker PDF, thumbnail tiga halaman, simpan/buka ulang dan pemulihan dengan fixture tanpa menulis pengajuan operasional.
