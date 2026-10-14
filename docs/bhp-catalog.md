# Katalog BHP dari SC BHP NEW.pdf

Katalog aktif berasal dari lima halaman PDF, registration AGM240901, tanggal 17 September 2026, district BM06, site LBR1. Terdapat 138 barang. Nomor 36 berulang pada dua barang berbeda; kedua barang dipertahankan. Baris 23 dan 25 tidak memiliki Stock Code/Part Number: kode internal PDF-BHP-023/PDF-BHP-025 dipakai untuk relasi transaksi dan tampilan menyatakan kode belum tersedia.

Nama, Mnemonic, Unit Of Issue, Stock Class/Type, Equipment ID, Qty Instal, Repairable, Expense Element dan harga IDR/USD mengikuti sumber, termasuk dua angka desimal. Metadata sumber dan SHA-256 tercatat pada `src/data/bhpCatalogSource.json`. Gambar adalah cuplikan kolom Image dari PDF. Tanda tangan/form approval tidak dimasukkan sebagai instruksi aplikasi atau gambar katalog.

Kategori mengikuti Stock Type sumber: K (Office Supplies). ABC dan safety margin adalah parameter aplikasi, bukan Stock Class P. Stok dihitung dalam Unit Of Issue (BOX/PACK/EACH dan lainnya); pack_size 1 berarti satu satuan penerbitan, bukan satu barang di dalam box. Qty Instal 1 bukan saldo stok. PDF tidak menyebut stok aktual atau transaksi sehingga penggantian ini memulai saldo nol dan riwayat kosong.

`node scripts/import-bhp-pdf.mjs <path>` mengekstrak katalog dan cuplikan gambar; `node server/generateBhpData.js` membuat default frontend. `node server/replaceBhpCatalog.js` adalah penggantian penuh BHP: mengunci hanya tabel BHP, mencadangkan data lama ke `tmp/backups`, lalu mengganti data dalam satu transaksi. Kegagalan dibatalkan dengan rollback. Modul lain tidak diubah. Browser memigrasikan cache satu kali berdasarkan versi katalog; data server harus cocok dengan seluruh kode katalog aktif.

Verifikasi: `node scripts/verify-bhp-catalog.mjs` dan `npm run build`. Katalog Excel lama disalin ke cadangan lokal lalu dihapus dari sumber aplikasi agar tidak dipakai kembali.
