# Input invoice

Form Invoice mengirim `vendor`, `nilai`, tanggal awal/akhir periode, tanggal diserahkan dan berkas File. Backend sebelumnya hanya menerima nama kolom PostgreSQL sehingga `invoice_number` menjadi NULL dan vendor/nilai tidak tersimpan dengan benar.

Backend menerima format form maupun format canonical, membuat nomor referensi internal `INV-<UUID>` jika nomor belum dikirim, dan mengembalikan alias yang dibutuhkan halaman daftar/detail/dashboard. Nomor yang diberikan caller tetap digunakan; nomor duplikat menghasilkan HTTP 409 tanpa menimpa invoice. Input vendor, nilai dan tanggal yang tidak valid menghasilkan HTTP 400. Kolom periode/tanggal diserahkan ditambahkan secara aditif saat endpoint invoice pertama dipakai; tidak memerlukan ulang seeding.

Client mengunggah File terlebih dahulu melalui `/api/upload`, lalu menyimpan URL/nama/ukuran berkas pada invoice. Kegagalan upload menghentikan pembuatan invoice. Penyimpanan lampiran tetap memakai adapter storage aplikasi yang ada. Penggantian lampiran memakai alur yang sama. Tracking tanggal disimpan dalam `tracking_stages` JSONB dan pembaruan satu tahap tidak menghapus tahap lain.

`node scripts/verify-invoice-create.mjs` menguji form/client aktual dan route API aktual dengan PostgreSQL. Tabel sementara dan rollback mengisolasi semua data uji; upload menggunakan storage palsu agar tidak menulis ke Drive. Pengujian mencakup nomor otomatis, vendor/nilai/tanggal, pembacaan ulang, tracking, status PAID, ganti lampiran, penolakan upload dan nomor duplikat. `npm run build` memeriksa build frontend.
