# Import histori BHP dari Excel

Importer menggunakan manifest hasil pemeriksaan workbook dan memverifikasi SHA256 file sumber sebelum menulis. Jalankan tanpa `--apply` untuk memeriksa manifest, lalu dengan `--apply` untuk melakukan import:

```
node scripts/import-bhp-history.mjs <manifest.json> <source.xlsx> [--apply]
```

Manifest mencantumkan site, rentang tanggal, nama sheet, baris sumber, nama barang asli, kode/satuan tujuan, stok awal, pemakaian harian, penerimaan mingguan, dan stok akhir. Semua jumlah harus nonnegatif dengan maksimal tiga angka desimal; total harian/mingguan dan persamaan saldo akhir harus cocok dengan sumber.

## Aturan pencatatan

- Persetujuan pengguna menentukan periode dan pemetaan barang. Penggantian SKU terdekat mempertahankan jumlah kemasan 1:1; tidak mengubah jumlah menjadi ekuivalen volume/berat. Nama asli tetap tercatat pada notes dan audit.
- Konversi satuan eksplisit disimpan dalam `conversion_note` beserta jumlah asli `source_quantities`. Untuk tisu toilet SC43951, pengguna mengonfirmasi **8 roll = 1 pack**: semua stok, pemakaian, dan penerimaan sumber dibagi 8 tanpa pembulatan ke pack utuh.
- Beberapa barang sumber boleh dipetakan ke SKU yang sama. Stok awal dan stok akhir dijumlahkan per SKU; setiap pemakaian dan penerimaan masih menyimpan identitas baris sumber.
- Untuk import rutin, stok awal Excel hanya menjadi kontrol rekonsiliasi: nilainya harus cocok dengan saldo sistem akhir hari sebelum periode dimulai. Importer tidak menulis stok awal baru dan tidak membuat penerimaan dari kolom stok awal. Selisih menghentikan import untuk pemeriksaan; tidak dibuat penyesuaian otomatis.
- Pemakaian menggunakan tanggal actual dari header harian Excel. Sel kosong tidak dibuat menjadi transaksi pemakaian nol.
- Penerimaan mingguan memiliki `period_start` dan `period_end`. Field `date` merupakan akhir periode pencatatan, bukan tanggal actual barang tiba. UI menampilkan rentang tanggal dan label rekap mingguan. Saldo dalam minggu tersebut belum dapat dipastikan sebelum akhir periode; saldo akhir bulan telah direkonsiliasi.
- PIC dan penerima ditandai tidak tercantum pada Excel; tidak menggunakan identitas manusia yang tidak diketahui.
- Pengguna harus menetapkan Excel sebagai acuan actual sebelum mengganti pemakaian/penerimaan existing pada site, SKU, dan periode yang sama. Record sebelum perubahan disimpan dalam backup lokal dan `bhp_history_imports.before_data`. Site, SKU, dan periode lain tetap dipertahankan.
- Tidak mengisi bulan lain dengan nol, tidak mengubah pengaturan kelengkapan histori forecast, dan tidak menyatakan saldo akhir bulan sumber sebagai hasil stock opname bulan berjalan.

## Konsistensi

Seluruh import menggunakan satu transaksi dan penguncian tabel terkait. Setelah import, saldo akhir setiap SKU dihitung ulang dengan engine stok server; perbedaan menggagalkan seluruh transaksi. Kunci sumber SHA256/sheet/site/baris mencegah import ganda; perubahan pemetaan atau isi baris yang sudah diimport ditolak.

`bhp_history_imports` menyimpan manifest, data sebelum import, hasil dan waktu import. `bhp_history_import_rows` menyimpan identitas baris sumber dan batch. Pembuatan tabel audit serta kolom rentang penerimaan bersifat aditif. File mentah, manifest actual, dan backup berada di direktori yang diabaikan Git.

## Import IDMG Agustus 2026

Sumber yang diterima hanya berisi sheet **Office IDMG Agustus** dan header tanggal 1 Agustus 2026. Pengguna mengonfirmasi input sebagai Agustus, kopi 380 gram per bungkus, penerimaan sebagai rekap mingguan, Excel sebagai acuan actual untuk koreksi catatan gula existing, serta penggantian ke SKU terdekat (contoh Sunlight 755 ml menjadi 635 ml).

42 dari 81 baris dipetakan ke 38 SKU, menghasilkan 184 catatan pemakaian harian dan 10 penerimaan mingguan. Satu catatan pemakaian existing diganti agar sesuai Excel. Seluruh 38 saldo SKU akhir Agustus diverifikasi terhadap jumlah saldo sumber. 39 baris tanpa padanan fungsi atau dengan satuan yang tidak dapat dipertukarkan tidak diimport; rincian dan alasan tersimpan pada `manifest.unresolved` dalam audit batch. Katalog barang tidak ditambah atau diubah oleh import.

Khusus inisiasi batch `a901b226-d573-40c4-b9c9-77a9f45d912c`, pengguna meminta saldo awal diperlakukan sebagai penerimaan tanggal **1 Agustus 2026**. Koreksi satu kali ini menghapus 38 record `bhp_initial_stocks` yang berasal dari batch tersebut dan membuat 30 penerimaan berstatus **Inisiasi Awal**. Delapan saldo nol tidak dibuat menjadi penerimaan. Sepuluh penerimaan mingguan serta 184 catatan pemakaian tetap dipertahankan.

Koreksi dijalankan melalui `node scripts/convert-bhp-opening-receipts.mjs <audited-import-id> --apply`. Batch harus ditemukan di audit import, jumlah dan tanggal stok awal harus masih sama dengan sumber. Sebelum perubahan, data dicadangkan; setelahnya, saldo harian 38 SKU dari 1 Agustus sampai tanggal koreksi diverifikasi tetap sama. Penanda pada `result.opening_receipts_conversion` menyimpan ID penerimaan, stok awal sebelumnya, serta tanggal koreksi dan mencegah eksekusi dua kali. Mekanisme ini tidak dipanggil oleh import rutin bulan berikutnya.

Validasi: `node scripts/verify-bhp-history-import.mjs` dan `node scripts/verify-bhp-opening-receipts.mjs`. Pengujian menggunakan tabel temporer PostgreSQL dan rollback untuk menguji rekonsiliasi, penggabungan SKU, saldo bawaan dan import bulan berikutnya tanpa stok awal tambahan, rentang mingguan, koreksi dengan backup, isolasi site/periode lain, idempotensi, penolakan pemetaan ulang, rollback saat insert gagal, dan konversi penerimaan inisiasi satu kali.

## Pelengkap kategori PR dan IR untuk Agustus dan September

Sesuai konfirmasi pengguna, hanya dua plastik ditambahkan sebagai barang **PR**, dengan nama/keterangan sesuai Excel: `PR-IDMG-40X60` dan `PR-IDMG-100X120`. Kode tersebut adalah identitas internal, bukan StockCode PDF. Harga dibiarkan NULL karena tidak tersedia pada sumber; web menampilkan **Belum ada harga**, dan biaya forecast yang belum memiliki harga tidak dihitung sebagai nol.

Barang yang sudah ada dipakai sebagai **IR**: tisu toilet SC43951 (pack isi 8 roll) dan toilet gel SC44046 (set, pemetaan terdekat yang disetujui). Barang lain di katalog mempertahankan kategorinya. Tidak menambahkan 35 barang lain yang masih ditunda pengguna.

Pelengkap Agustus mengacu pada `initialization_of_import_id` dari batch inisiasi awal yang sudah dikonversi. Referensi, SHA256, sheet, site, dan tanggal harus cocok; saldo sebelum periode untuk SKU tambahan harus nol. Import membuat penerimaan inisiasi pada 1 Agustus untuk empat SKU tambahan. Pelengkap September tetap `carry_forward` dan tidak membuat penerimaan inisiasi. Jejak baris sumber mencegah pengulangan; baris yang sudah diimport sebelumnya tidak diinput ulang.

Pelengkap Agustus berisi 24 catatan pemakaian, 1 penerimaan mingguan, dan 4 penerimaan inisiasi. September berisi 19 catatan pemakaian dan 2 penerimaan mingguan. Tisu: 303 roll menjadi 37.875 pack pada inisiasi, pemakaian Agustus 5.625 pack, saldo akhir Agustus 32.25 pack, pemakaian September 4.25 pack, dan saldo akhir September 28 pack.

Kolom jumlah pada pemakaian, penerimaan, transfer, stok awal, serta sistem/fisik/selisih opname mendukung `NUMERIC(16,3)`. Kolom selisih opname tetap dihitung otomatis. Migrasi tersendiri: `node scripts/migrate-bhp-quantities.mjs --apply`, yang membuat backup dan menggunakan transaksi. API dan form mendukung maksimal tiga desimal dan menolak presisi lebih tinggi. Pengujian: `node scripts/verify-bhp-fractional-import.mjs` mencakup konversi tepat, inisiasi tambahan, carry-forward September, input API pecahan, selisih opname negatif, penolakan presisi berlebih, dan pencegahan duplikasi.
