# FinTrack — Aplikasi Pencatatan Keuangan Pribadi

Aplikasi web pencatatan keuangan pribadi (*single-user*, *mobile-friendly*) yang dibangun sesuai dokumen spesifikasi **[PRD.md](PRD.md)** untuk memantau arus kas harian secara instan tanpa biaya *server*.

---

## Fitur Utama

1. **Modul Input Transaksi Cepat**
   - **Tanggal** otomatis terisi hari ini dan dapat disesuaikan.
   - **Jenis Transaksi** (*Pengeluaran* / *Pemasukan*).
   - **Kategori** dinamis sesuai jenis transaksi yang dipilih.
   - **Nominal** dengan pemformatan angka Rupiah otomatis (`Rp 50.000`) serta tombol pintasan nominal cepat.
   - **Catatan** opsional dan validasi *form* sebelum penyimpanan.
2. **Dashboard & Visualisasi Real-Time**
   - Kartu ringkasan bulan berjalan: **Total Pemasukan**, **Total Pengeluaran**, dan **Saldo Tersisa (Net)** beserta persentase alokasi pengeluaran.
   - Grafik distribusi interaktif (**Pie / Doughnut Chart** dan **Bar Chart**) beserta daftar persentase pengeluaran/pemasukan per kategori.
3. **Riwayat & Tabel Data Responsif**
   - Tabel transaksi pada layar desktop/MacBook dan *card list* ringkas pada layar *smartphone*.
   - Filter berdasarkan **Bulan**, **Tahun**, **Jenis Transaksi**, serta kolom **Pencarian** berdasarkan kata kunci pada *Catatan* atau *Kategori*.
   - Fitur **Edit** dan **Hapus** transaksi, serta ekspor laporan ke **CSV** atau **Cetak PDF**.
4. **Manajemen Kategori**
   - Kategori dasar bawaan (*Makan*, *Transportasi*, *Tagihan*, *Hiburan*, *Gaji*, dll.).
   - Kemampuan menambah kategori baru, mengubah nama/jenis kategori, atau menghapus kategori.
5. **Pelacakan Aset, Kekayaan (All-Time Net Worth) & Transfer Antar Aset**
   - Memantau total kekayaan pribadi lintas waktu: **Total Nilai Portofolio Aset**, perbandingan **Aset Likuid (Kas, Bank, E-Wallet)** vs **Investasi & Aset Fisik**, serta **Akumulasi Kas Transaksi (All-Time)**.
   - **Transfer / Mutasi Antar Aset:** Memindahkan saldo dari satu rekening/aset ke rekening/kas/e-wallet lain secara otomatis (dengan opsi **Biaya Admin Transfer** seperti BI-Fast `Rp 2.500` yang otomatis dihitung ke pengeluaran tanpa menggelembungkan pemasukan/pengeluaran pokok).
   - **Integrasi Transaksi ke Saldo Aset:** Pemasukan dan pengeluaran harian dapat dihubungkan ke rekening/dompet tertentu agar saldonya otomatis bertambah/berkurang (dan otomatis *rollback* jika transaksi diedit atau dihapus).
   - Visualisasi proporsi alokasi aset per kategori (*Kas & Bank*, *E-Wallet*, *Investasi*, *Emas & Logam Mulia*, *Aset Fisik & Properti*, *Lainnya*).
6. **Arsitektur Penyimpanan Ganda (Lokal & Google Sheets)**
   - Berjalan langsung secara instan menggunakan `localStorage` browser.
   - Dapat dihubungkan ke **Google Sheets** melalui **Google Apps Script (`Code.gs`)** sebagai *database* relasional sederhana (`Sheet Transaksi`, `Sheet Kategori`, & `Sheet Aset`).

---

## Struktur File

- `index.html` — Antarmuka utama aplikasi berbasis HTML5, Tailwind CSS, dan Chart.js.
- `app.js` — Logika *frontend*, pemformatan Rupiah, kalkulasi dashboard, manajemen kategori, dan konektor API Google Apps Script.
- `Code.gs` — *Backend* Google Apps Script untuk mengelola *Sheet* `Transaksi` dan `Kategori` di Google Sheets.
- `PRD.md` — Dokumen spesifikasi kebutuhan produk (*Product Requirements Document*).

---

## Cara Menjalankan

### Opsi 1: Langsung di Browser (Mode Lokal / GitHub Pages)
1. Buka file `index.html` langsung di browser (Safari, Chrome, Arc, dll.) di MacBook atau HP.
2. Seluruh transaksi dan kategori otomatis tersimpan di penyimpanan browser perangkat Anda (`localStorage`).

### Opsi 2: Terhubung ke Database Google Sheets (Google Apps Script)
1. Buat *spreadsheet* baru di [Google Sheets](https://sheets.new).
2. Klik menu **Extensions (Ekstensi)** > **Apps Script**.
3. Salin seluruh isi file `Code.gs` ke dalam editor `Code.gs` di Apps Script, lalu tekan **Save (Simpan)**.
4. Klik tombol **Deploy (Terapkan)** > **New deployment (Deployment baru)**:
   - Pilih jenis: **Web app (Aplikasi web)**.
   - *Execute as (Jalankan sebagai)*: **Me (Saya)**.
   - *Who has access (Siapa yang memiliki akses)*: **Anyone (Siapa saja)**.
   - Klik **Deploy**, berikan izin akses Google Sheets, lalu salin **Web App URL** (`https://script.google.com/macros/s/.../exec`).
5. Buka aplikasi **FinTrack** (`index.html`), klik tombol **Google Sheets** di pojok kanan atas, tempelkan **Web App URL** tersebut, lalu klik **Simpan Pengaturan**.
6. Sheet `Transaksi` dan `Kategori` akan dibuat secara otomatis di Google Sheets Anda!
