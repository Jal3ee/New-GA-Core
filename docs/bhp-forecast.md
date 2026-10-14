# Forecast BHP historikal

Semua SKU menggunakan histori pemakaian per site. Tidak ada klasifikasi STATIC atau ketergantungan pada kategori katalog. Penghitungan dilakukan di server, dari seluruh ledger yang tersedia, bukan 500 baris terakhir di layar atau saldo browser.

## Mulai menguji

1. Buka BHP Mess > Forecast & Rekap Kebutuhan dan pilih site. Default histori 90 hari, interval order 30 hari, lead time total 7 hari, target service level 95%. Semua ini parameter awal yang bisa diubah, bukan fakta supplier yang dianggap sudah pasti.
2. Tetapkan cutoff pada tanggal yang pencatatannya sudah selesai. Input Pencatatan Lengkap Sejak hanya jika seluruh pemakaian sejak tanggal itu benar-benar tercatat. Tanpa konfirmasi, hasil memakai rentang dari pemakaian pertama dan ditandai Histori Terbatas; hari yang tidak mempunyai log belum dapat dipastikan sebagai demand nol.
3. Cocokkan saldo dengan tab Opname. Riwayat pemakaian, penerimaan, transfer dan opname di database membentuk saldo server. Saldo negatif tidak dipotong menjadi nol; hasil perlu rekonsiliasi dan order belum direkomendasikan.
4. Tekan Simpan & Hitung. Stok kecil/nol dibandingkan dengan histori, stok berlebih dapat menghasilkan order nol. Histori kosong tidak otomatis berarti tidak perlu barang. Histori di bawah 7 hari tidak menghasilkan jumlah order, kecuali ada baseline manual.
5. Tombol detail di baris barang membuka perhitungan dan pengaturan barang/site: minimum order, kelipatan order, alokasi tambahan di luar forecast, baseline manual dengan alasan, buffer manual, incoming dan ETA.
6. Jika belum ada histori, baseline manual opsional memungkinkan estimasi awal yang disetujui pengguna. Kosongkan baseline untuk kembali ke histori. Angka baseline tidak berasal dari sistem dan tidak dianggap forecast statistik teruji.
7. Incoming dengan Ref. PO unik memakai jumlah total PO: penerimaan dengan item/site/Ref. PO yang sama otomatis mengurangi sisa incoming. Tanpa Ref. PO, hapus incoming manual setelah diterima. ETA jatuh tempo yang belum diterima serta ETA di luar coverage tidak dipakai untuk mengurangi order. Satu baris per Ref. PO/SKU/site; jadwal pengiriman terpisah membutuhkan referensi yang jelas.
8. Simpan Snapshot untuk membekukan hasil, konfigurasi, cutoff dan actor. Rekap PDF menampilkan data kualitas, site, Unit Of Issue, inventory position dan angka belum diketahui secara jelas; tidak menjumlah BOX, PACK dan EACH sebagai total pcs.

## Perhitungan

Histori memakai tanggal cutoff inklusif dan maksimal history_days ke belakang. Transaksi pada tanggal/SKU/site yang sama dijumlah dahulu. Tanggal lama di luar jendela dan tanggal setelah cutoff tidak masuk demand forecast. Coverage historis dimulai dari tanggal pencatatan lengkap yang dikonfirmasi; jika belum dikonfirmasi, dari tanggal pertama pemakaian yang tersedia di dalam rentang yang bisa dihitung.

Rate = total pemakaian / jumlah hari histori. Hari tanpa log menjadi nol pada seri; hasil tersebut tetap ditandai terbatas bila pencatatan lengkap belum dikonfirmasi. Pemakaian gudang borongan dan stockout perlu review karena tidak selalu mewakili konsumsi/demand harian sesungguhnya.

Coverage H = interval review/order R + lead time total L, dalam hari kalender. Forecast kebutuhan = rate x H. Lead time mencakup approval/PO, pengiriman dan penerimaan sampai barang siap digunakan.

Jika tersedia minimal H+14 hari dan minimal tiga hari dengan pemakaian, safety stock berasal dari variasi total demand dalam jendela historis sepanjang H: max(0, kuantil service level - rata-rata demand jendela), dibulatkan ke atas. Ini pendekatan empiris awal dari sampel yang saling overlap, bukan bukti bahwa service level sudah tercapai.

Jika sampel belum cukup untuk jendela tersebut, safety stock = ceil(z x simpangan baku pemakaian harian x sqrt(H)); status kualitas tetap memberi informasi keterbatasan. Baseline manual menggunakan rate manual x buffer_days, bukan mengklaim service level statistik. Target 90/95/97,5/99% tersedia; asumsi dan performa perlu dievaluasi dengan data aktual.

Inventory position = stok + sisa incoming yang ETA-nya setelah cutoff dan masih dalam coverage - alokasi tambahan yang belum tercakup oleh forecast. Target stock = forecast + safety stock. Raw order = max(0, target - inventory position). Jika perlu order, terapkan MOQ lalu bulatkan ke kelipatan order. Jika stok berlebih, MOQ tidak memaksa pembelian.

Setiap SKU/site dihitung terpisah. Konsolidasi menampilkan hasil per site, sehingga stok berlebih site lain tidak menutupi kekurangan lokal. Risiko stockout sebelum replenishment dihitung secara harian selama lead time, memasukkan ETA tiap incoming, bukan hanya membandingkan total supply pada akhir lead time.

Saldo dibentuk dari saldo awal, penerimaan, pemakaian, transfer dan opname secara kronologis tanggal/created_at. Penerimaan Belum Datang dan bertanggal masa depan tidak menambah on-hand. Opname menetapkan saldo fisik, kemudian transaksi yang lebih baru mengubahnya. Forecast bukan instruksi pembelian otomatis.

## Persistensi dan verifikasi

Tabel tambahan dibuat secara aditif saat fitur dipakai: bhp_forecast_settings menyimpan konfigurasi per site dan kontrol per barang; bhp_forecast_runs menyimpan snapshot immutable. Tidak ada penghapusan transaksi atau pergantian katalog dalam perubahan ini. Parameter semua site dapat diubah sekaligus tanpa menghapus kontrol barang masing-masing site.

Penerimaan multi-item dan pemakaian batch memakai satu INSERT sehingga semua baris berhasil atau tidak ada baris tersimpan. UI menunggu server berhasil, lalu membaca ulang saldo canonical. Kegagalan refresh setelah save tidak diperlakukan sebagai kegagalan penyimpanan.

- `node scripts/verify-bhp-forecast.mjs`: invariansi pemecahan transaksi, stok rendah/nol/berlebih/negatif, cutoff, histori singkat/kosong/zero yang dikonfirmasi, per-site, safety stock empiris, MOQ, baseline, penerimaan PO, snapshot, konfigurasi dan penerimaan atomik. Pengujian database menggunakan tabel sementara dan rollback.
- `node scripts/verify-bhp-report.mjs`: laporan tetap menunjukkan rekomendasi tidak diketahui dan nama yang aman dalam HTML cetak.
- `npm run build`: build frontend.

Tahap berikutnya setelah pengguna memasukkan histori adalah kalibrasi: bandingkan forecast yang dibekukan dengan aktual, ukur bias, error, stockout, days of cover dan persediaan berlebih. Hindari klaim akurasi sebelum hasil backtest tersedia.
