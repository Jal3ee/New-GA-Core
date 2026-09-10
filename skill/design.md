# Design System — "Base" GA Operations Platform

> **Base** adalah nama produk usulan (singkatan dari "home base" — markas operasional General Affairs: mess, logistik, transport, hingga administrasi). Ganti sesuai nama internal perusahaan; seluruh token pada dokumen ini tidak bergantung pada nama tersebut.

Dokumen ini adalah rujukan tunggal (single source of truth) untuk desainer dan front-end engineer dalam membangun antarmuka platform GA — mencakup keputusan warna, tipografi, komponen, animasi, hingga pola halaman per modul (Mess, BHP, Transport, Keluhan, Calendar of Event, Invoice, Laundry).

---

## 1. Ringkasan & Filosofi Desain

**Konteks produk:** ini bukan situs pemasaran, melainkan alat kerja harian staf GA dan karyawan — dipakai berkali-kali sehari, sering dalam kondisi terburu-buru (mengajukan transport sebelum jam kerja, mengecek status laundry di sela rapat). Prioritas nomor satu adalah **kejelasan dan kecepatan**, bukan eksplorasi visual yang agresif.

Namun GA juga mengurus dua sisi yang berbeda karakter: sisi **manusiawi/harian** (mess, laundry, keluhan — tempat karyawan "hidup" sehari-hari) dan sisi **administratif/presisi** (BHP, invoice, transport — data, angka, persetujuan). Identitas visual "Base" dibangun untuk menjembatani keduanya: hangat secukupnya di permukaan, tapi rapi dan presisi di data.

### 1.1 Proses Perancangan Token (ringkas)

| Elemen | Keputusan | Alasan |
| --- | --- | --- |
| **Warna dasar** | `#0F5C56` (Teal tua) sebagai primary, `#C4841F` (Brass/kuningan) sebagai aksen tunggal, netral abu-abu bertona teal ("Ledger") | Teal terasa operasional & tepercaya tanpa jatuh ke klise indigo/biru SaaS generik. Brass merujuk pada kuningan kunci kamar mess, gagang lemari, cap dokumen — elemen fisik dunia GA — dan sengaja **dibatasi pemakaiannya** agar tetap terasa istimewa. |
| **Tipografi** | *Plus Jakarta Sans* untuk judul, *Inter* untuk teks/tabel padat, *JetBrains Mono* untuk angka/kode | Inter saja terasa terlalu "default dashboard". Jakarta Sans punya karakter yang sedikit lebih hangat di judul (mendukung sisi manusiawi), sementara Inter tetap dipertahankan untuk body/tabel karena keterbacaan pada ukuran kecil belum tertandingi untuk data padat. |
| **Layout** | Sidebar kiri persisten + pola "list halaman → drawer detail di kanan" (bukan pindah halaman penuh) | GA banyak bekerja dengan daftar (stok, pengajuan, tagihan). Drawer menjaga konteks daftar tetap terlihat saat memeriksa/menyetujui satu item — mengurangi jumlah klik "kembali". |
| **Kartu & elevasi** | **Bukan** "semua dibungkus card dengan shadow abu-abu seragam". Tabel tampil flat dengan border tipis; shadow hanya dipakai untuk elemen yang benar-benar melayang (modal, dropdown, toast, command palette). | Elevasi yang seragam di semua tempat justru menghilangkan makna elevasi itu sendiri. Dengan membedakannya, mata pengguna otomatis tahu mana yang "di atas" halaman dan mana yang "menyatu" dengan halaman. |
| **Dark mode** | Bukan hitam pekat (`#000000`), tapi abu-abu gelap bertona teal (`#101514`) | Sesuai permintaan: gelap tapi tidak menyilaukan/kontras berlebihan, dan tetap terasa satu keluarga warna dengan mode terang. |

### 1.2 Prinsip Inti

1. **Jelas dulu, baru indah.** Setiap layar harus bisa dipahami dalam < 3 detik: apa ini, apa statusnya, apa aksi berikutnya.
2. **Satu momen keberanian per halaman.** Warna aksen (Brass), confetti, atau animasi mencolok hanya dipakai di satu titik paling penting per layar — bukan ditebar ke semua tombol.
3. **Motion menjawab aksi pengguna.** Animasi hadir ketika pengguna membuka, menutup, mengonfirmasi, atau berhasil melakukan sesuatu — bukan animasi otomatis yang berjalan sendiri saat halaman dimuat.
4. **Konsisten menamai aksi.** Tombol "Ajukan Transport" akan menghasilkan toast "Pengajuan transport dikirim" — nama aksi tidak berubah di sepanjang alur.
5. **Kepadatan yang tenang.** Tabel dan data boleh padat, tapi selalu diberi ruang napas (whitespace) yang cukup agar tidak melelahkan mata untuk pemakaian berjam-jam.

---

## 2. Design Tokens

### 2.1 Warna

**Palet dasar (bernama):**

| Nama | Hex | Peran |
| --- | --- | --- |
| Teal (Primary) | `#0F5C56` | Aksi utama, link, fokus, identitas brand |
| Brass (Accent) | `#C4841F` | Aksen tunggal — status "perlu perhatian/persetujuan", highlight statistik kunci, indikator navigasi aktif |
| Ruby (Danger) | `#D6483D` | Error, aksi destruktif |
| Emerald (Success) | `#1F9463` | Berhasil, lunas, selesai |
| Sky (Info) | `#3D7DBF` | Informasi netral, tautan sekunder |
| Ledger (Neutral) | `#101514` → `#F7F9F8` | Latar, teks, border — abu-abu dengan sedikit tona teal agar menyatu dengan brand |

**Skala lengkap:**

| Skala | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Teal | `#F0F7F6` | `#D9EBE8` | `#B3D8D3` | `#7EBDB5` | `#3E9992` | `#14746C` | `#0F5C56` | `#0C4A45` | `#0A3B37` | `#082E2B` | `#051F1D` |
| Brass | `#FBF3E5` | `#F3DFB6` | `#E8C583` | `#DDA950` | `#E0A83E` | `#C4841F` | `#A6690E` | `#84520B` | `#623D08` | `#432A06` | `#2C1B03` |
| Ledger | `#F7F9F8` | `#EEF2F1` | `#DDE4E2` | `#C3CDCA` | `#9AA8A4` | `#71827D` | `#566461` | `#434E4B` | `#2E3634` | `#1B211F` | `#101514` |

*(Ruby, Emerald, Sky cukup 2 varian: `-400` untuk dark mode, `-500` untuk light mode — lihat tabel token semantik.)*

**Token semantik — Mode Terang vs Gelap:**

| Token | Light | Dark | Catatan |
| --- | --- | --- | --- |
| `background` | `#F7F9F8` | `#101514` | Dark **bukan** hitam pekat, tetap bertona teal |
| `foreground` (teks utama) | `#1B211F` | `#E7ECEA` | Teks dark mode sedikit di-soft, bukan putih murni |
| `card` | `#FFFFFF` | `#1B211F` | Elevasi dibentuk lewat beda lightness, bukan shadow |
| `muted` (bg sekunder, header tabel) | `#EEF2F1` | `#2E3634` | |
| `muted-foreground` | `#71827D` | `#9AA8A4` | |
| `border` | `#DDE4E2` | `#434E4B` | |
| `primary` | `#0F5C56` | `#3E9992` | Dark pakai varian lebih terang agar tetap kontras |
| `primary-foreground` | `#FFFFFF` | `#06201C` | |
| `accent` (Brass) | `#C4841F` | `#E0A83E` | Dipakai terbatas: badge, indikator aktif, ikon |
| `accent-foreground` | `#2B1D06` | `#241A08` | Teks gelap di atas Brass agar tetap AA |
| `destructive` (Ruby) | `#D6483D` | `#E5564A` | |
| `success` (Emerald) | `#1F9463` | `#34B57F` | |
| `info` (Sky) | `#3D7DBF` | `#5C9AD1` | |
| `ring` (focus outline) | `#14746C` | `#3E9992` | 2px, offset 2px |

> Validasi akhir kontras (WCAG AA) tetap wajib dicek dengan tool seperti WebAIM Contrast Checker sebelum rilis, khususnya kombinasi Brass di atas latar terang.

### 2.2 Tipografi

| Peran | Font | Sumber | Alasan |
| --- | --- | --- | --- |
| Judul (H1–H3, angka KPI besar) | **Plus Jakarta Sans** (600/700) | Google Fonts / Fontshare | Geometris, sedikit hangat di ujung huruf — memberi karakter tanpa jadi dekoratif |
| Body, UI, tabel | **Inter** (400/500/600) | Google Fonts | Keterbacaan terbaik di ukuran kecil, mendukung teks Indonesia dengan baik |
| Angka, kode, ID | **JetBrains Mono** (400/500) | Google Fonts | Angka tabular sejajar — penting untuk kolom nominal invoice, no. kendaraan, kode aset BHP |

**Skala tipe:**

| Level | Ukuran / Line-height | Weight | Font | Contoh Pemakaian |
| --- | --- | --- | --- | --- |
| Display | 36px / 1.15 | 700 | Display | Angka KPI besar di dashboard |
| H1 | 28px / 1.2 | 700 | Display | Judul halaman |
| H2 | 20px / 1.3 | 600 | Display | Judul kartu / section |
| H3 | 16px / 1.4 | 600 | Display | Sub-judul, header grup tabel |
| Body Large | 15px / 1.5 | 500 | Sans | Label form penting, isi modal konfirmasi |
| Body | 14px / 1.5 | 400 | Sans | Teks default UI, isi tabel |
| Caption | 12px / 1.4 | 400 | Sans (muted) | Helper text, timestamp, metadata |
| Numeric | 14px, `tabular-nums` | 500 | Mono | Nominal rupiah, kode invoice, plat nomor |

Aturan tambahan: panjang baris teks deskriptif dibatasi ±70–80 karakter; heading tidak menggunakan huruf kapital semua (UPPERCASE) kecuali singkatan resmi yang memang demikian (mis. **BHP**); tombol/CTA ditulis sebagai kata kerja langsung ("Simpan Perubahan", bukan "Submit" atau "Kirim →").

### 2.3 Spacing & Grid

- Basis spacing 4px (mengikuti skala default Tailwind): `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- Padding kartu: 24px (desktop) / 16px (mobile).
- Margin horizontal halaman: 32px (desktop) / 16px (mobile).
- Jarak antar field form: 20px. Jarak antar section halaman: 40px.
- Grid 12 kolom, container max-width 1440px, sidebar 264px (72px saat collapsed).
- Breakpoint: `sm 640` · `md 768` · `lg 1024` · `xl 1280` · `2xl 1536`.

### 2.4 Radius & Elevasi

Radius **dibedakan menurut hierarki**, bukan satu nilai untuk semua elemen:

| Elemen | Radius |
| --- | --- |
| Input, button, select | 10px (`md`) |
| Card, modal, container | 14px (`lg`) |
| Panel besar / ilustrasi empty state | 20px (`xl`) |
| Badge, avatar, pill, chip | full (9999px) |

Elevasi (shadow) **hanya untuk elemen yang benar-benar melayang** di atas konten:

| Level | Light | Dark | Dipakai untuk |
| --- | --- | --- | --- |
| `sm` | `0 2px 8px rgba(16,33,31,.06)` | border 1px `#434E4B` (shadow nyaris tak terlihat di gelap) | Tooltip, dropdown kecil |
| `md` | `0 8px 24px rgba(16,33,31,.10)` | `0 8px 24px rgba(0,0,0,.35)` + border | Modal, drawer, popover |
| `lg` | `0 16px 48px rgba(16,33,31,.14)` | `0 16px 48px rgba(0,0,0,.45)` + border | Command palette (⌘K) |

Tabel, kartu KPI dashboard, dan container list **tidak** memakai shadow — cukup `background: var(--card)` + `border: 1px solid var(--border)` agar tidak jatuh ke pola "semua dibungkus card abu-abu" yang generik.

### 2.5 Ikonografi

- Library: **lucide-react** (ringan, konsisten dengan stack yang sudah dipilih).
- Stroke width: 1.75 (default), 1.5 untuk ikon besar (≥32px).
- Ukuran: 16px (inline teks/tabel) · 18px (tombol, nav) · 20px (header section) · 24–32px (empty state, highlight).
- Warna default `muted-foreground`, berubah ke `foreground`/`primary` saat hover/aktif.

---

## 3. Mode Terang & Gelap

Toggle tema ditempatkan di topbar (ikon matahari/bulan yang bertransisi morph halus via Framer Motion, ±200ms), dengan tiga opsi: **Terang**, **Gelap**, **Ikuti Sistem** (disimpan di `localStorage`, dibaca ulang saat load untuk menghindari flash tema salah).

Prinsip mode gelap "Base": **gelap tapi tidak ekstrem**.

- Latar paling gelap `#101514` (bukan `#000000`) — tetap ada sedikit kehangatan warna sehingga tidak terasa seperti "mode OLED super hitam".
- Elevasi dibentuk dengan menaikkan lightness bertahap (`background` → `card` → `muted`), bukan dengan shadow gelap yang nyaris tak terlihat.
- Teks utama memakai putih yang di-*soften* (`#E7ECEA`), bukan putih murni `#FFFFFF`, untuk mengurangi silau saat dipakai lama.
- Warna semantik (Teal, Brass, Ruby, Emerald, Sky) memakai varian yang sedikit lebih terang di dark mode agar tetap kontras tanpa terasa neon.

---

## 4. Arsitektur Navigasi

**Sidebar kiri** (persisten desktop, collapsible ke mode ikon-saja):

- Dashboard
- Mess
- BHP (Barang Habis Pakai)
- Transport
- Keluhan
- Calendar of Event
- Invoice
- Laundry
- — divider —
- Laporan *(opsional, fase berikutnya)*
- Pengaturan

Setiap item memakai ikon lucide + label; item aktif ditandai garis vertikal tipis warna **Brass** di sisi kiri (bukan background block penuh) — konsisten dengan prinsip "aksen dipakai hemat".

**Topbar:** search global (memicu command palette ⌘K/Ctrl+K lintas modul — "cari pengajuan transport #TR-0231", "cari penghuni mess Budi"), lonceng notifikasi (badge merah + dot animasi halus saat ada notifikasi baru), toggle tema, avatar pengguna dengan dropdown (Profil, Pengaturan, Keluar).

**Breadcrumb** dipakai di halaman detail bertingkat, contoh: `Mess > Kamar 2B > Riwayat Penghuni`.

**Mobile:** bottom navigation untuk 4 modul paling sering dipakai (Dashboard, Transport, Keluhan, Laundry) + tombol "Lainnya" membuka drawer sidebar penuh. FAB (Floating Action Button) muncul di halaman list untuk aksi "Buat baru" sesuai konteks modul.

---

## 5. Rekomendasi Komponen & Library

Stack inti sudah ditentukan (React 19, Vite 8, Tailwind v4, react-router-dom v7, lucide-react, react-pdf/pdf-lib/react-signature-canvas/react-rnd). Berikut lapisan tambahan yang direkomendasikan agar setiap kebutuhan UI dari daftar referensi terpenuhi dengan komponen best-practice:

| Kebutuhan | Rekomendasi | Alasan |
| --- | --- | --- |
| Primitif aksesibel (Dialog, Dropdown, Select, Tabs, Accordion, Switch, Popover, Tooltip, Checkbox, Radio, Slider) | **Radix UI Primitives** dengan pola styling ala **shadcn/ui** (di-*copy* ke codebase, di-styling pakai token di atas) | Aksesibilitas (ARIA, keyboard nav, focus trap) sudah teruji; kita tetap pegang kendali penuh atas tampilan, tidak terkunci ke satu "look" pihak ketiga |
| Tabel data (stok BHP, log transport, antrian laundry, daftar invoice) | **TanStack Table v8** (headless) + **TanStack Virtual** untuk daftar panjang | Sorting/filter/pagination/kolom custom tanpa dikte visual; virtual scroll penting untuk log yang bisa mencapai ribuan baris |
| Form & validasi | **React Hook Form** + **Zod** | Validasi skema konsisten dengan struktur data backend, re-render minim, cocok dipadukan animasi *shake* saat error |
| Notifikasi toast | **Sonner** | Toast berbasis promise (`loading → success/error`) bawaan, animasi stack rapi, mendukung tema gelap/terang secara native |
| Date picker (form) | **react-day-picker** | Ringan, mudah di-styling sesuai token |
| Calendar of Event (tampilan bulan/minggu/hari + drag-resize event) | **FullCalendar (React)** | Paling matang untuk kalender kompleks dengan drag & drop, resize durasi, multi-resource (mis. per gedung mess) |
| Grafik & chart | **Recharts** sebagai basis, dibungkus komponen internal `StatCard` / `ChartCard` | SVG native React, ringan, warnanya mudah disamakan dengan token brand; menghindari *lock-in* ke seluruh design system pihak ketiga |
| Command palette (⌘K pencarian global) | **cmdk** | Standar de-facto di ekosistem React untuk command palette yang ringan & aksesibel |
| Papan status drag & drop (mis. antrian Laundry: Diterima → Proses → Selesai → Diambil) | **@dnd-kit/core** | Modern, aksesibel (keyboard-draggable), lebih ringan dan aktif dipelihara dibanding alternatif lama |
| Upload file (lampiran keluhan, bukti transfer invoice) | **react-dropzone** | Drag-drop + preview, dipadukan dengan stack PDF yang sudah dipilih |
| Skeleton loading | Komponen internal berbasis Tailwind (`animate-pulse` + token `muted`) | Tanpa dependency tambahan, otomatis mengikuti tema |
| Momen sukses istimewa (invoice lunas, keluhan selesai) | **canvas-confetti** (dipicu terbatas, partikel sedikit, warna dari token brand) | Hanya untuk pencapaian benar-benar penting — bukan tiap submit form biasa |
| Progress bar navigasi halaman | **nprogress**-style bar di topbar (atau custom Framer Motion) | Memberi rasa "sistem sedang bekerja" saat pindah halaman/muat data besar |
| Animasi & transisi | **Framer Motion** (`motion/react`) + `AnimatePresence` | Kontrol penuh durasi/easing, mendukung `prefers-reduced-motion`, dipakai untuk modal, drawer, list stagger, page transition |
| Drawer detail cepat di mobile | **Vaul** | Bottom-sheet dengan gestur native-feel di layar kecil, cocok untuk aksi cepat (update status keluhan dari HP) |

---

## 6. Sistem Feedback & Notifikasi

| Jenis | Pemicu | Perilaku | Contoh Copy |
| --- | --- | --- | --- |
| Toast sukses | Aksi berhasil (simpan, kirim, setujui) | Slide-in kanan-atas, ikon centang Emerald, progress bar 4 detik, bisa di-dismiss manual | "Pengajuan transport dikirim." |
| Toast error | Aksi gagal | Warna Ruby, ikon seru, bertahan 6 detik atau sampai ditutup, disertai getaran halus (*shake* 300ms) saat muncul | "Gagal menyimpan. Periksa koneksi internet, lalu coba lagi." |
| Toast loading → resolve | Proses async (submit form, upload file) | Berbasis promise: tampil "Mengirim pengajuan…" lalu otomatis berubah jadi sukses/gagal tanpa toast baru | "Mengunggah bukti transfer…" → "Bukti transfer terunggah." |
| Banner/alert halaman | Kondisi level-halaman yang perlu perhatian terus-menerus | Menempel di atas konten, tidak auto-dismiss, warna sesuai semantik (Brass untuk peringatan, Ruby untuk kondisi kritis) | "3 item BHP di bawah stok minimum." |
| Modal konfirmasi | Aksi destruktif/tidak bisa dibatalkan (hapus data, batalkan pengajuan) | Radix Dialog + Framer Motion (scale 0.96→1 & fade, 200ms, ease-out), backdrop blur, tombol konfirmasi warna Ruby | "Batalkan pengajuan ini? Tindakan ini tidak bisa dibatalkan." |
| Validasi form inline | Field tidak valid saat submit atau saat blur | Border Ruby + ikon + helper text di bawah field, animasi *shake* ringan (±6px, 3x, 300ms) — dipicu saat submit, bukan tiap ketikan | "Nomor kendaraan wajib diisi." |
| Skeleton loading | Data awal/pagination sedang dimuat | Blok abu-abu (`muted`) dengan shimmer halus, meniru bentuk tabel/kartu asli | — |
| Empty state | Tidak ada data untuk ditampilkan | Ilustrasi garis sederhana warna netral + 1 kalimat ajakan bertindak + tombol CTA primer | "Belum ada pengajuan transport. Buat pengajuan pertamamu." |

Prinsip penulisan pesan: aktif, jelas, tanpa basa-basi permintaan maaf berlebihan, dan **selalu menjelaskan apa yang terjadi dan apa langkah berikutnya** — bukan sekadar "Terjadi kesalahan".

---

## 7. Mikro-interaksi & Panduan Motion

Motion dipakai untuk **menjawab aksi pengguna**, bukan berjalan otomatis saat halaman dimuat.

| Trigger | Durasi | Easing | Catatan |
| --- | --- | --- | --- |
| Hover tombol/kartu | 120ms | ease-out | Tombol: scale 1.02 + shadow naik satu level. Kartu list: translateY(-2px) |
| Tekan/klik (active state) | 80ms | ease-out | Scale 0.97 — memberi kesan "tertekan" secara fisik |
| Buka dropdown/tooltip/popover | 150ms | ease-out | Fade + scale dari titik asal (transform-origin sesuai posisi trigger) |
| Buka modal/drawer | 220ms | cubic-bezier(0.16,1,0.3,1) | Modal: scale+fade. Drawer: slide dari kanan (320–420px) |
| Tutup modal/drawer/toast | 150ms | ease-in | Lebih cepat dari saat membuka — terasa responsif |
| Toggle/switch | spring (stiffness 500, damping 30) | — | Framer Motion spring, bukan easing linear, agar terasa "hidup" |
| List/tabel baru dimuat | stagger 30–40ms per item, maksimal 8 item pertama | ease-out | Setelahnya tanpa delay tambahan agar tidak terasa lambat di list panjang |
| Pindah halaman (route) | 250ms | ease-in-out | Fade + slide vertikal 8px via `AnimatePresence`, disertai progress bar tipis di topbar |
| Pencapaian penting (invoice lunas, keluhan selesai) | sekali, ~1.2 detik | — | Confetti ringan (canvas-confetti), warna Teal+Brass+Emerald, jumlah partikel dibatasi agar tidak berlebihan |

Semua motion menghormati media query `prefers-reduced-motion: reduce` — saat aktif, transform/scale dimatikan dan hanya tersisa transisi opacity singkat. Tersedia juga toggle manual "Kurangi Animasi" di halaman Pengaturan.

---

## 8. Visualisasi Data per Modul

| Modul | Metrik | Jenis Chart | Catatan |
| --- | --- | --- | --- |
| Dashboard | Ringkasan seluruh modul | Kartu KPI (angka besar + delta % bulan lalu + sparkline mini) | Grid 4 kolom di atas, tanpa shadow, dibedakan lewat garis aksen kiri per kategori |
| Mess | Okupansi kamar | Donut/radial (terisi vs tersedia) | |
| Mess | Tren check-in/out bulanan | Line chart | |
| BHP | Stok per kategori | Bar chart horizontal | |
| BHP | Item stok kritis | Progress bar warna per item (bukan gauge penuh — lebih ringkas dalam tabel) | |
| BHP | Tren pemakaian | Area chart | |
| Transport | Pemakaian kendaraan per tujuan/driver | Bar chart | |
| Transport | Jadwal armada | Tampilan kalender/resource timeline (FullCalendar resource view) | |
| Keluhan | Kategori keluhan | Donut chart | |
| Keluhan | Rata-rata waktu penyelesaian | Kartu KPI + indikator target | |
| Keluhan | Tren masuk vs selesai | Line chart dua seri | |
| Calendar of Event | Jadwal kegiatan | Kalender bulan/minggu/hari (FullCalendar) | |
| Invoice | Status pembayaran | Donut (Lunas / Menunggu / Jatuh Tempo) | |
| Invoice | Tren tagihan bulanan | Bar/area chart | |
| Laundry | Volume per minggu | Bar/area chart | |
| Laundry | Status antrian | Papan Kanban (Diterima → Proses → Selesai → Diambil) | |

Seluruh chart memakai palet warna dari token `--color-chart-1..5` (dipetakan ke Teal, Brass, Sky, Emerald, Ledger) agar visual antar modul terasa satu kesatuan, bukan warna acak per komponen.

---

## 9. Pola Halaman

**Pola List (paling sering dipakai — BHP, Transport, Keluhan, Invoice, Laundry):**

```
┌─────────────────────────────────────────────┐
│ Judul Halaman            [+ Buat Baru]       │  ← header + CTA primer kanan
├─────────────────────────────────────────────┤
│ [Cari...] [Filter Status ▾] [Rentang Tanggal]│  ← filter bar, collapsible di mobile
├─────────────────────────────────────────────┤
│ Nama     Status    Tanggal    Jumlah   ⋯     │  ← tabel flat, border tipis
│ ───────────────────────────────────────────  │
│ ...baris data (hover highlight, bukan zebra) │
├─────────────────────────────────────────────┤
│              ← 1 2 3 4 5 →                    │
└─────────────────────────────────────────────┘
```

Klik satu baris **tidak** berpindah halaman penuh — membuka **drawer di kanan** (320–420px) berisi detail + aksi (Setujui/Tolak/Edit), agar konteks daftar tetap terlihat.

**Pola Dashboard:**

```
┌───────┬───────┬───────┬───────┐
│ KPI 1 │ KPI 2 │ KPI 3 │ KPI 4 │   ← flat card, garis aksen kiri
├───────┴───────┼───────┴───────┤
│  Chart utama  │  Chart kedua  │
├───────────────┴───────────────┤
│  Aktivitas terbaru (list)     │
└───────────────────────────────┘
```

**Pola Form:** form sederhana (Keluhan) satu langkah dengan validasi inline. Form kompleks (Pengajuan Transport: tujuan → pilih kendaraan → info persetujuan) memakai **stepper bernomor** — penomoran hanya dipakai di sini karena kontennya memang berurutan.

---

## 10. Rincian per Modul

- **Mess** — Daftar gedung/kamar (grid kartu okupansi) → detail kamar (drawer: penghuni saat ini, riwayat, kondisi fasilitas) → form check-in/check-out (stepper singkat).
- **BHP (Barang Habis Pakai)** — Tabel stok (TanStack Table, badge status "Menipis"/"Aman") → drawer detail item (grafik tren pemakaian) → form permintaan barang + alur persetujuan (badge Brass "Menunggu Persetujuan").
- **Transport** — Tabel pengajuan → stepper form pengajuan (tujuan, tanggal, kendaraan) → kalender jadwal armada (FullCalendar resource view) → drawer detail dengan status real-time.
- **Keluhan** — Tabel tiket (filter status: Baru/Diproses/Selesai) → form pengaduan (upload lampiran via react-dropzone) → drawer detail dengan timeline percakapan/status + assign PIC.
- **Calendar of Event** — Kalender penuh (bulan/minggu/hari), klik tanggal membuka modal buat event, klik event membuka drawer detail + RSVP.
- **Invoice** — Tabel tagihan (kolom nominal pakai font mono, tabular-nums) → drawer detail (breakdown biaya, upload bukti bayar) → modal konfirmasi sebelum menandai "Lunas" (memicu confetti ringan).
- **Laundry** — Papan Kanban status (drag & drop @dnd-kit) + tampilan tabel alternatif → form request laundry sederhana → riwayat per karyawan.

---

## 11. Aksesibilitas

- Kontras minimum WCAG AA: 4.5:1 untuk teks body, 3:1 untuk teks besar/ikon — termasuk kombinasi Brass di kedua tema.
- Navigasi penuh via keyboard (ditopang oleh Radix primitives), focus ring selalu terlihat (token `ring`, 2px + offset 2px).
- Label ARIA untuk seluruh tombol berbasis ikon saja; toast memakai `aria-live="polite"` (sukses/info) dan `aria-live="assertive"` (error).
- `prefers-reduced-motion` dihormati di seluruh animasi.
- Target sentuh minimum 40×40px di mobile; unit ukuran teks berbasis `rem` agar mengikuti pengaturan zoom browser.

---

## 12. Strategi Responsif

| Breakpoint | Perilaku |
| --- | --- |
| < 640px (mobile) | Sidebar tersembunyi (drawer), bottom nav 4 modul utama, tabel bertransformasi jadi kartu bertumpuk per baris, FAB untuk aksi utama |
| 640–1024px (tablet) | Sidebar collapsed (ikon saja), drawer detail menjadi bottom-sheet (Vaul) alih-alih panel samping |
| ≥ 1024px (desktop) | Sidebar penuh, drawer detail di sisi kanan, layout multi-kolom untuk dashboard |

---

## 13. Panduan Penulisan (Voice & Copy)

- Gunakan kata kerja aktif pada tombol: "Simpan Perubahan", "Ajukan Transport", "Setujui Permintaan" — bukan "Submit" atau "OK".
- Nama aksi konsisten dari tombol → toast konfirmasi: tombol "Ajukan" menghasilkan toast "diajukan", bukan berubah jadi "dikirim".
- Pesan error menjelaskan apa yang terjadi **dan** cara memperbaikinya, tanpa permintaan maaf berlebihan.
- Empty state ditulis sebagai ajakan bertindak, bukan sekadar pemberitahuan kosong.
- Hindari label ALL-CAPS dekoratif dan tanda panah "→" tempelan di akhir tombol/link.

---

## 14. Checklist Konsistensi Sebelum Rilis

- [ ] Semua warna semantik lulus kontras AA di kedua tema
- [ ] Semua komponen interaktif punya focus state yang terlihat
- [ ] Semua tombol memuat state: default, hover, active, loading, disabled
- [ ] Semua form memuat state: kosong, terisi, error, berhasil
- [ ] Semua tabel memuat state: loading (skeleton), kosong (empty state), terisi
- [ ] Toast, modal, drawer sudah diuji dengan `prefers-reduced-motion`
- [ ] Nama aksi tombol konsisten dengan pesan toast yang dihasilkan
- [ ] Tema gelap diuji bukan hanya "invert warna", tapi elevasi & kontras disesuaikan manual

---

## 15. Ringkasan Paket Tambahan

| Kebutuhan | Package |
| --- | --- |
| Primitif UI aksesibel | `@radix-ui/react-*` |
| Tabel data | `@tanstack/react-table`, `@tanstack/react-virtual` |
| Form & validasi | `react-hook-form`, `zod`, `@hookform/resolvers` |
| Toast | `sonner` |
| Date picker | `react-day-picker` |
| Kalender event | `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`, `@fullcalendar/resource-timeline` |
| Chart | `recharts` |
| Command palette | `cmdk` |
| Drag & drop board | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Upload file | `react-dropzone` |
| Animasi | `framer-motion` |
| Confetti | `canvas-confetti` |
| Drawer mobile | `vaul` |
| Tema gelap/terang | `next-themes` (atau context custom setara) |
| *(sudah ditentukan sebelumnya)* | `react`, `react-dom`, `vite`, `tailwindcss`, `react-router-dom`, `lucide-react`, `react-pdf`, `pdf-lib`, `react-signature-canvas`, `react-rnd` |

---

## 16. Lampiran — Token dalam Tailwind CSS v4

```css
@import "tailwindcss";

/* 1. Palet dasar — tidak berubah antar tema */
:root {
  --teal-50:  #F0F7F6; --teal-400: #3E9992; --teal-500: #14746C;
  --teal-600: #0F5C56; --teal-700: #0C4A45;

  --brass-50: #FBF3E5; --brass-400: #E0A83E; --brass-500: #C4841F;
  --brass-600: #A6690E;

  --ruby-400: #E5564A; --ruby-500: #D6483D;
  --emerald-400: #34B57F; --emerald-500: #1F9463;
  --sky-400: #5C9AD1; --sky-500: #3D7DBF;

  --ledger-50: #F7F9F8; --ledger-100: #EEF2F1; --ledger-200: #DDE4E2;
  --ledger-300: #C3CDCA; --ledger-400: #9AA8A4; --ledger-500: #71827D;
  --ledger-600: #566461; --ledger-700: #434E4B; --ledger-800: #2E3634;
  --ledger-900: #1B211F; --ledger-950: #101514;
}

/* 2. Token semantik — mode terang (default) */
:root {
  --background: var(--ledger-50);
  --foreground: var(--ledger-900);
  --card: #FFFFFF;
  --muted: var(--ledger-100);
  --muted-foreground: var(--ledger-500);
  --border: var(--ledger-200);
  --ring: var(--teal-500);
  --primary: var(--teal-600);
  --primary-foreground: #FFFFFF;
  --accent: var(--brass-500);
  --accent-foreground: #2B1D06;
  --destructive: var(--ruby-500);
  --success: var(--emerald-500);
  --info: var(--sky-500);
}

/* 3. Token semantik — mode gelap */
.dark {
  --background: var(--ledger-950);
  --foreground: #E7ECEA;
  --card: var(--ledger-900);
  --muted: var(--ledger-800);
  --muted-foreground: var(--ledger-400);
  --border: var(--ledger-700);
  --ring: var(--teal-400);
  --primary: var(--teal-400);
  --primary-foreground: #06201C;
  --accent: var(--brass-400);
  --accent-foreground: #241A08;
  --destructive: var(--ruby-400);
  --success: var(--emerald-400);
  --info: var(--sky-400);
}

/* 4. Daftarkan ke Tailwind v4 */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-success: var(--success);
  --color-info: var(--info);

  --font-display: "Plus Jakarta Sans", ui-sans-serif, sans-serif;
  --font-sans: "Inter", ui-sans-serif, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
}

@custom-variant dark (&:where(.dark, .dark *));
```