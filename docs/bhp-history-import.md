# Import histori BHP dari Excel

Importer menggunakan manifest hasil pemeriksaan workbook dan memverifikasi SHA256 file sumber sebelum menulis. Jalankan tanpa `--apply` untuk memeriksa manifest, lalu dengan `--apply` untuk melakukan import:

```
node scripts/import-bhp-history.mjs <manifest.json> <source.xlsx> [--apply]
```

Manifest mencantumkan site, rentang tanggal, nama sheet, baris sumber, nama barang asli, kode/satuan tujuan, stok awal, pemakaian harian, penerimaan mingguan, dan stok akhir. Semua jumlah harus bilangan bulat nonnegatif; total harian/mingguan dan persamaan saldo akhir harus cocok dengan sumber.

## Aturan pencatatan

- Persetujuan pengguna menentukan periode dan pemetaan barang. Penggantian SKU terdekat mempertahankan jumlah kemasan 1:1; tidak mengubah jumlah menjadi ekuivalen volume/berat. Nama asli tetap tercatat pada notes dan audit.
- Beberapa barang sumber boleh dipetakan ke SKU yang sama. Stok awal dan stok akhir dijumlahkan per SKU; setiap pemakaian dan penerimaan masih menyimpan identitas baris sumber.
- Stok awal menggunakan tanggal awal periode dari Excel pada pukul 00:00 Asia/Makassar. Stok awal yang sudah ada tidak ditimpa; importer menghentikan proses untuk rekonsiliasi manual.
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

Validasi: `node scripts/verify-bhp-history-import.mjs`. Pengujian menggunakan tabel temporer PostgreSQL dan rollback untuk menguji rekonsiliasi, penggabungan SKU, tanggal awal, rentang mingguan, koreksi dengan backup, isolasi site/periode lain, idempotensi, penolakan pemetaan ulang, dan rollback saat insert gagal.
