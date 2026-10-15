# Auto e-Req BHP

Tombol **Auto e-Req** tersedia pada BHP Mess > Forecast setelah hasil selesai dihitung. Satu draft dipilih untuk satu site (IDMG, LBCT atau SPCT), hanya dari rekomendasi order positif. K dan IR dipetakan ke Issue Requisition sesuai arahan pengguna; PR ke Purchase Requisition. Preview memungkinkan edit jenis, quantity, part number dan harga serta mengeluarkan barang dari draft. Pengeditan ini tidak mengubah katalog, snapshot, stok atau status order GA Core.

OPU memakai site AGM yang dipilih, departemen dipilih dari opsi **AGM - HCGA**, keperluan **Pengadaan Baru**. Alasan, tanggal permintaan/dibutuhkan dan PIC pengaju dikosongkan. Quantity mengikuti validasi bilangan bulat pada situs tujuan. Harga rupiah pada preview diperlakukan sebagai harga satuan sebelum PPN, dikonversi ke USD dengan kurs tetap Rp16.500 dan dibulatkan dua desimal. Situs e-Req menghitung PPN 11% dan totalnya. Harga yang belum tersedia harus dilengkapi; sistem tidak menerka harga nol.

## Memasang ekstensi

Tidak ada akses source code/API integrasi e-Req, sehingga pengisian lintas domain dilakukan oleh ekstensi Manifest V3 pada Chrome/Edge desktop. Unduh `/downloads/ga-core-auto-ereq.zip` dari modal, ekstrak ke folder permanen, buka `chrome://extensions` atau `edge://extensions`, aktifkan Developer mode, lalu **Load unpacked** pada folder yang berisi manifest.json. Refresh GA Core. Setelah update paket, ekstrak versi baru, reload ekstensi, dan refresh GA Core.

Login disetel melalui ikon ekstensi atau panel pada jendela e-Req pertama. Email/password disimpan di `chrome.storage.session` selama sesi browser saja dan dapat dihapus melalui ikon ekstensi. Password tidak disertakan dalam repository, paket ZIP, payload GA Core atau localStorage. Situs e-Req tetap mengelola sesi login situsnya sendiri. Tidak ada browser jarak jauh atau database e-Req yang dibuat.

Ekstensi memiliki permission storage dan scripting dengan host permission terbatas pada e-Req, serta content scripts pada dua origin produksi serta localhost:5173/5174 untuk QA. Transport memeriksa origin dan request ID; background memvalidasi payload dan origin pengirim. Draft diikat ke tab popup, kedaluwarsa 30 menit, serta dihapus setelah verifikasi atau tab ditutup. Credentials dipakai background untuk login pada tab e-Req yang memiliki job; tidak dikembalikan ke halaman GA Core atau pesan JOB. Jendela dibuat melalui API ekstensi agar pembukaan tidak bergantung pada izin popup JavaScript halaman.

## Pengisian dan batas kompatibilitas

Ekstensi memilih site, opsi departemen dan keperluan melalui kontrol asli. Jumlah PR/IR disesuaikan dengan tombol plus/minus asli, termasuk nol baris. Kolom IR stock class, unit dan harga adalah read-only pada situs tujuan, sehingga detail barang disimpan melalui struktur draft browser `request-item-storage` versi 0 yang sudah digunakan e-Req, kemudian halaman dimuat ulang untuk menghidrasi form. Ekstensi memeriksa struktur sebelum mengganti daftar, lalu memverifikasi site, departemen, keperluan, jumlah baris, part number, quantity dan harga setelah reload. Perubahan struktur situs bisa memerlukan pembaruan ekstensi; kegagalan diperlihatkan di panel dan tidak dilanjutkan ke pencetakan.

Jika browser sudah menyimpan form berisi barang, pengguna memilih penggantian daftar atau pembatalan di panel e-Req. Form tetap terbuka sesudah terisi, agar alasan, tanggal dan PIC dapat dilengkapi serta quantity/part number dapat diedit. Harga/satuan IR yang read-only pada situs asli dapat disesuaikan melalui preview GA Core sebelum membuka ulang. Ekstensi tidak menekan Cetak atau mengirim pengajuan.

## Verifikasi dan pengemasan

- `node scripts/verify-bhp-ereq.mjs`: pemetaan, isolasi site, order positif, validasi harga/quantity/part number, konversi dan preservasi data asal.
- `node scripts/package-bhp-ereq.mjs`: membangun ZIP deterministik dari source ekstensi dan validator bersama `src/utils/bhpEreq.js`, tanpa password atau dependency browser baru.
- `npm run build`: build frontend. Paket ZIP terbaru harus dibuat dan disertakan sebelum deployment.
- `scripts/verify-bhp-ereq-browser.mjs`: smoke test opsional dengan Playwright dan Chrome/Edge, login berizin berupa JSON melalui stdin. `BHP_PLAYWRIGHT_MODULE` dapat menunjuk module Playwright yang sudah tersedia; `BHP_BROWSER_PATH` menunjuk executable browser. Test memakai profil sementara sendiri, mencoba transport ekstensi dan form asli, lalu menghapus profilnya.

QA browser pada situs tujuan dilakukan dengan profil terpisah: login akun yang diizinkan, isi draft uji di IDMG/LBCT/SPCT, uji kombinasi IR/PR termasuk nol baris, reload dan periksa persistensi, lalu edit quantity. Tidak mencetak atau mengirim pengajuan dan tidak mengubah database transaksi GA Core.
