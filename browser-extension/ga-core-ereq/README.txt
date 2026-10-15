GA CORE AUTO E-REQ — Chrome / Microsoft Edge

1. Ekstrak ZIP ke folder permanen di komputer.
2. Buka chrome://extensions atau edge://extensions.
3. Aktifkan Developer mode, klik Load unpacked, pilih folder yang berisi manifest.json.
4. Refresh GA Core. Buka BHP Mess > Forecast > Simpan & Hitung > Auto e-Req.
5. Pilih satu site, periksa daftar, isi harga yang belum ada, edit bila perlu, lalu Buka & Isi e-Req.
6. Saat pertama login, masukkan akun e-Req di panel ekstensi atau melalui ikon ekstensi.
7. Form e-Req tetap terbuka. Lengkapi alasan, tanggal dan PIC, lalu tinjau sebelum mencetak.

Login hanya disimpan dalam chrome.storage.session sampai sesi browser berakhir.
Password tidak disertakan dalam ZIP, repository, atau GA Core. Hapus Login dari ikon ekstensi
untuk menghapus kredensial sesi (sesi login situs e-Req tetap mengikuti pengaturan situs itu).
Ekstensi hanya berjalan di GA Core, localhost untuk pengujian, dan e-requisition-test.vercel.app.

K dan IR menjadi ISSUE REQUISITION; PR menjadi PURCHASE REQUISITION. Satu popup untuk satu site.
Harga rupiah sebelum PPN dibagi 16.500 dan dibulatkan dua desimal USD. e-Req menghitung PPN 11%.
Quantity harus bilangan bulat sesuai validasi e-Req. Stok, order, dan approval GA Core tidak diubah.
Jika form e-Req sebelumnya sudah berisi barang, konfirmasi penggantian daftar di panel ekstensi.
IR stock class, satuan, dan harga mengikuti draft GA Core karena kolom tersebut read-only pada
form asli. Ubah data itu melalui preview Auto e-Req, kemudian buka ulang bila perlu.

Setelah update ekstensi: ekstrak versi baru, klik Reload di halaman extensions, refresh GA Core.
Untuk menghapus: Remove pada halaman extensions.
