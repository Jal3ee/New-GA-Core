# Forecast BHP historikal

Semua SKU menggunakan histori pemakaian per site. Tidak ada klasifikasi STATIC atau ketergantungan pada kategori katalog. Penghitungan dilakukan di server, dari seluruh ledger yang tersedia, bukan 500 baris terakhir di layar atau saldo browser.

## Mulai menguji

1. Buka BHP Mess > Forecast & Rekap Kebutuhan dan pilih site. Mode utama **Sampai Tanggal** memakai akhir bulan depan sebagai tanggal awal pilihan (untuk Oktober 2026: 30 November 2026). Tanggal dapat diubah sampai maksimal 366 hari setelah cutoff. Tombol **Akhir Bulan Depan** menghitung ulang dari cutoff; pilihan tanggal diingat di browser selama masih berlaku. Default histori 90 hari, lead time total 7 hari, target service level 95%. Mode **Interval Order + Lead Time** tetap tersedia dengan default interval order 30 hari. Semua parameter adalah pengaturan awal yang dapat diubah.
2. Tetapkan cutoff pada tanggal yang pencatatannya sudah selesai. Panel menunjukkan pemakaian terakhir yang tercatat bila lebih awal daripada cutoff, disertai tombol untuk memakai tanggal tersebut; tanggal terakhir ada transaksi tidak otomatis membuktikan hari sesudahnya kosong. Untuk import actual IDMG yang saat ini baru terisi sampai 12 Oktober, gunakan cutoff 12 Oktober dan target 30 November: periode forecast 13 Oktober–30 November, 49 hari kalender. Input Pencatatan Lengkap Sejak hanya jika seluruh pemakaian sejak tanggal itu benar-benar tercatat. Tanpa konfirmasi, hasil memakai rentang dari pemakaian pertama dan ditandai Histori Terbatas; hari yang tidak mempunyai log belum dapat dipastikan sebagai demand nol.
3. Cocokkan saldo dengan tab Opname. Riwayat pemakaian, penerimaan, transfer dan opname di database membentuk saldo server. Saldo negatif tidak dipotong menjadi nol; hasil perlu rekonsiliasi dan order belum direkomendasikan.
4. Tekan Simpan & Hitung. Stok kecil/nol dibandingkan dengan histori, stok berlebih dapat menghasilkan order nol. Histori kosong tidak otomatis berarti tidak perlu barang. Histori di bawah 7 hari tidak menghasilkan jumlah order, kecuali ada baseline manual.
5. Tombol detail di baris barang membuka perhitungan dan pengaturan barang/site: minimum order, kelipatan order, alokasi tambahan di luar forecast, baseline manual dengan alasan, buffer manual, incoming dan ETA.
6. Jika belum ada histori, baseline manual opsional memungkinkan estimasi awal yang disetujui pengguna. Kosongkan baseline untuk kembali ke histori. Angka baseline tidak berasal dari sistem dan tidak dianggap forecast statistik teruji.
7. Incoming dengan Ref. PO unik memakai jumlah total PO: penerimaan dengan item/site/Ref. PO yang sama otomatis mengurangi sisa incoming. Tanpa Ref. PO, hapus incoming manual setelah diterima. ETA jatuh tempo yang belum diterima serta ETA di luar coverage tidak dipakai untuk mengurangi order. Satu baris per Ref. PO/SKU/site; jadwal pengiriman terpisah membutuhkan referensi yang jelas.
8. Simpan Snapshot untuk membekukan hasil, konfigurasi, cutoff, tanggal akhir forecast dan actor. Rekap PDF dan judul riwayat PDF menampilkan periode yang sama. Versi perhitungan `history-v2` tidak mengubah snapshot versi lama. Rekap PDF menampilkan data kualitas, site, Unit Of Issue, inventory position dan angka belum diketahui secara jelas; tidak menjumlah BOX, PACK dan EACH sebagai total pcs.

Rekap PDF hanya memuat baris dengan rekomendasi order lebih dari nol. Barang dengan order nol atau rekomendasi belum diketahui tidak dicetak. Ringkasan biaya, jumlah jenis barang, jumlah baris SKU/site, dan riwayat PDF dihitung dari baris yang dicetak. Jika tidak ada order, sistem menampilkan pemberitahuan dan tidak membuat PDF/riwayat kosong. Snapshot serta tabel analisis forecast tetap menyimpan seluruh hasil untuk review.

## Perhitungan

Histori memakai tanggal cutoff inklusif dan maksimal history_days ke belakang. Transaksi pada tanggal/SKU/site yang sama dijumlah dahulu. Tanggal lama di luar jendela dan tanggal setelah cutoff tidak masuk demand forecast. Coverage historis dimulai dari tanggal pencatatan lengkap yang dikonfirmasi; jika belum dikonfirmasi, dari tanggal pertama pemakaian yang tersedia di dalam rentang yang bisa dihitung.

Rate = total pemakaian / jumlah hari histori. Hari tanpa log menjadi nol pada seri; hasil tersebut tetap ditandai terbatas bila pencatatan lengkap belum dikonfirmasi. Pemakaian gudang borongan dan stockout perlu review karena tidak selalu mewakili konsumsi/demand harian sesungguhnya.

Dalam mode tanggal, coverage H adalah jumlah hari dari sehari setelah cutoff sampai tanggal akhir pilihan, inklusif. Lead time **tidak** ditambahkan lagi ke tanggal akhir tersebut. Dalam mode interval, coverage H = interval review/order R + lead time total L, dalam hari kalender. Forecast kebutuhan = rate x H. Lead time mencakup approval/PO, pengiriman dan penerimaan sampai barang siap digunakan, serta tetap dipakai untuk mengevaluasi risiko kehabisan sebelum replenishment. Jika lead time melewati akhir horizon, panel memberi peringatan perlunya percepatan pengiriman atau transfer stok. Rentang forecast yang lebih panjang dari histori juga ditandai untuk review.

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

API `GET /api/bhp/forecast?site=IDMG&as_of=2026-10-12&forecast_to=2026-11-30` menggunakan tanggal akhir pilihan. `POST /api/bhp/forecast/snapshots` menerima `forecast_to` yang sama. Tanggal harus valid, setelah cutoff, dan maksimal 366 hari; tanggal yang sama dengan cutoff, tanggal tidak valid, serta rentang terlalu panjang ditolak HTTP 400. Tanpa `forecast_to`, API tetap memakai mode interval untuk kompatibilitas integrasi lama.

Prinsip inventory position mempertimbangkan on-hand, incoming, demand, safety stock dan pembulatan pengadaan, sejalan dengan dokumentasi [Oracle Min-Max Planning](https://docs.oracle.com/en/cloud/saas/supply-chain-and-manufacturing/26a/famml/min-max-planning.html) dan [perhitungan replenishment](https://docs.oracle.com/en/cloud/saas/supply-chain-and-manufacturing/25c/famml/how-min-max-planning-replenishment-quantities-are-calculated.html). Pemilihan tanggal akhir dan batas rentang adalah keputusan desain fitur ini.

Tahap berikutnya setelah pengguna memasukkan histori adalah kalibrasi: bandingkan forecast yang dibekukan dengan aktual, ukur bias, error, stockout, days of cover dan persediaan berlebih. Hindari klaim akurasi sebelum hasil backtest tersedia.
