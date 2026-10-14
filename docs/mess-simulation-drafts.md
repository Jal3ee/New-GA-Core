# Draf Simulasi & Transfer Mess

Perubahan kamar dapat disimpan ke PostgreSQL dan dibuka kembali lintas sesi/perangkat. Simpan draf tidak mengubah `mess_stays`. Nama, site, tanggal rencana, catatan approval, urutan aksi, dan snapshot penghuni sumber disimpan bersama.

## Pemakaian

1. Buka **Simulasi & Transfer**, pilih site dan buat perubahan kamar.
2. Isi **Nama draf**, **Tanggal rencana**, dan catatan bila diperlukan. Klik **Simpan Draf**.
3. Di sesi berikutnya pilih **Draf Tersimpan → Buka / Edit**. Data kamar terkini dimuat kembali, lalu aksi draf diterapkan sebagai simulasi.
4. Edit kamar/status, batalkan aksi, atau ubah catatan; klik **Simpan Perubahan Draf**.
5. Setelah approval diperoleh, klik **Realisasikan Data**. Perubahan yang sedang diedit disimpan terlebih dahulu sebelum realisasi. Draf yang berhasil direalisasikan keluar dari daftar aktif dan tetap tercatat di database.
6. Gunakan **Hapus** pada daftar draf untuk menghapus draf yang tidak digunakan, atau **Simulasi Baru** untuk memulai rencana lain. Gambar ekspor menyertakan nama draf, tanggal rencana, dan catatan.

Tanggal rencana adalah informasi rencana, bukan jadwal otomatis. Realisasi selalu berlaku pada tanggal tombol ditekan (Asia/Makassar). Approval dilakukan di luar fitur ini; catatan bukan bukti approval yang divalidasi sistem.

## Konsistensi

- Endpoint memerlukan JWT GA Core. Draf dibagikan dalam menu internal yang sama; metadata mencatat NIK pembuat, pengubah, dan pelaksana.
- Versi optimistis mencegah penyimpanan/penghapusan versi lama menimpa perubahan pengguna lain.
- Realisasi menggunakan satu transaksi dengan penguncian draf dan tabel mess; status realized dan seluruh perubahan okupansi berhasil bersama atau seluruhnya dibatalkan.
- Snapshot penghuni sumber diperiksa ulang. Tujuan harus masih ada pada konfigurasi kamar site yang sama dan belum terisi. Konflik mengembalikan HTTP 409 dan draf tetap tersedia.
- Jika penghuni sumber berubah, batalkan aksi terkait lalu buat kembali dari data penghuni terbaru; aksi lain tetap dapat digunakan. Jangan mengubah snapshot lama diam-diam.
- Check-out tidak termasuk okupansi aktif pada tanggal check-out. Check-in hasil realisasi menggunakan tanggal realisasi, bukan tanggal saat draf dibuat.
- Check-in/pindah berantai disederhanakan ke kamar akhir sehingga tidak membuat penghuni ganda. Membatalkan aksi sumber juga membatalkan aksi turunannya.
- Tidak ada migrasi destruktif: tabel `mess_simulation_drafts` dibuat aditif pada akses awal; data mess lama tidak direset.

## API dan verifikasi

`GET/POST /api/mess/drafts`, `GET/PUT/DELETE /api/mess/drafts/:id`, `POST /api/mess/simulation/realize`.

Jalankan `node scripts/verify-mess-transfer.mjs`, `node scripts/verify-mess-drafts.mjs`, dan `npm run build`. Pengujian API menggunakan tabel temporer PostgreSQL dan rollback, termasuk simpan/buka/edit/hapus, tanggal rencana, konflik versi/sumber/tujuan, realisasi atomik, dan pencegahan realisasi ganda. Data operasional tidak diubah oleh pengujian.
