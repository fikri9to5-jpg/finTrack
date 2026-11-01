## Product Requirements Document (PRD): Aplikasi Pencatatan Keuangan Pribadi

**Nama Produk:** (Belum ditentukan - misal: FinTrack / DompetKu)
**Status Dokumen:** Draft v1.0
**Target Pengguna:** Penggunaan mandiri (Single-user)
**Platform:** Web App (Mobile-friendly)

---

### 1. Ringkasan Eksekutif (Executive Summary)

Aplikasi pencatatan keuangan ini dirancang sebagai alat bantu pribadi untuk memantau arus kas harian secara instan. Fokus utamanya adalah kecepatan input data dan kemudahan dalam melihat ringkasan pengeluaran bulanan tanpa fitur rumit yang sering membebani aplikasi komersial.

### 2. Tujuan Produk (Objectives)

* Mengurangi friksi (hambatan) saat mencatat pengeluaran atau pemasukan harian, terutama saat sedang bepergian.
* Memberikan visualisasi data yang jelas terkait tren alokasi dana setiap bulannya.
* Memastikan kepemilikan, kendali, dan privasi data sepenuhnya berada di tangan pengguna.

### 3. Ruang Lingkup & Fitur Inti (MVP - Minimum Viable Product)

**A. Modul Input Transaksi**

* Pengguna dapat memasukkan transaksi baru dengan *field* esensial:
* **Tanggal** (Otomatis terisi hari ini, dapat disesuaikan)
* **Jenis Transaksi** (Pemasukan / Pengeluaran)
* **Kategori** (Dropdown)
* **Nominal** (Format angka rupiah)
* **Catatan** (Teks opsional)


* Validasi *form* untuk memastikan data wajib terisi sebelum dikirim.

**B. Dashboard & Visualisasi**

* Menampilkan ringkasan keuangan bulan berjalan:
* Total Pemasukan
* Total Pengeluaran
* Saldo Tersisa (Net)


* Grafik distribusi (*Pie chart* atau *Bar chart* sederhana) untuk melihat persentase pengeluaran berdasarkan kategori.

**C. Riwayat & Tabel Data**

* Menampilkan daftar transaksi terbaru dalam tata letak tabel yang responsif.
* Fitur filter berdasarkan bulan dan tahun.

**D. Manajemen Kategori**

* Kategori dasar bawaan (Makan, Transportasi, Tagihan, Hiburan, Gaji).
* Kemampuan menambah atau mengubah nama kategori sesuai pola pengeluaran pribadi.

**E. Pelacakan Aset, Kekayaan (All-Time Net Worth) & Mutasi Antar Aset**

* Menampilkan akumulasi kekayaan yang dimiliki selama ini (lintas bulan/tahun):
  * **Total Nilai Aset:** Akumulasi nilai dari seluruh aset yang dicatat pengguna.
  * **Akumulasi Saldo Arus Kas (All-Time):** Selisih total pemasukan dan pengeluaran dari seluruh riwayat transaksi selama ini.
  * **Komposisi Aset:** Rincian aset berdasarkan jenisnya (*Kas & Bank*, *E-Wallet*, *Investasi*, *Emas & Logam Mulia*, *Aset Fisik & Properti*).
* **Transfer / Perpindahan Antar Aset:** Mencatat perpindahan dana dari satu aset/bank ke aset/bank/kas lainnya (otomatis memotong saldo aset asal dan menambah saldo aset tujuan tanpa menggelembungkan pemasukan/pengeluaran bulanan), lengkap dengan dukungan **Biaya Admin Transfer** opsional.
* **Integrasi Transaksi dengan Saldo Aset:** Setiap pemasukan/pengeluaran dapat dikaitkan langsung ke akun aset/rekening tertentu sehingga saldonya ter-update otomatis (termasuk *rollback* saldo otomatis saat transaksi diedit atau dihapus).

### 4. Rekomendasi Arsitektur & Tech Stack

Mengingat aplikasi ini untuk kebutuhan pribadi yang mengutamakan kelincahan, kustomisasi tinggi, dan tanpa biaya *server*:

* **Frontend:** HTML dengan Tailwind CSS. Pendekatan ini memastikan antarmuka (UI) tetap bersih, modern, dan sangat responsif saat diakses dari *smartphone* maupun MacBook.
* **Backend:** Google Apps Script (GAS) untuk menangani logika bisnis, menerima *post request*, dan mengembalikan respons ke *frontend*.
* **Database:** Google Sheets. Berfungsi sebagai *database* relasional sederhana (Sheet Transaksi, Sheet Kategori) yang memungkinkan pemrosesan, rekapitulasi bawaan, serta mempermudah analisis lanjutan menggunakan *pivot table* secara manual jika diperlukan.

### 5. Alur Pengguna (User Flow)

1. **Buka Aplikasi:** Pengguna membuka tautan Web App dari *shortcut browser* di layar utama HP.
2. **Tampilan Utama:** Layar langsung menampilkan sisa saldo bulan ini dan *form* input cepat.
3. **Mencatat Transaksi:** Pengguna mengetik nominal, memilih kategori "Makan Siang", lalu menekan "Simpan".
4. **Konfirmasi:** Muncul notifikasi sukses, data tersimpan di baris baru *database*, dan visualisasi angka di dashboard langsung ter-update (*real-time* atau *refresh* otomatis).

### 6. Rencana Pengembangan Lanjutan (Post-MVP)

* **Ekspor Laporan:** Fitur mengekspor laporan bulanan ke format PDF (bisa diintegrasikan melalui *script* Python menggunakan PyMuPDF jika di-generate secara lokal via terminal, atau menggunakan fungsi *export* bawaan GAS).
* **Sistem Anggaran (Budgeting):** Indikator visual jika pengeluaran pada kategori tertentu sudah mendekati atau melebihi batas (limit) bulanan yang ditetapkan.
* **Fitur Pencarian:** Kolom *search* untuk mencari riwayat pengeluaran spesifik berdasarkan kata kunci pada "Catatan".

Silakan direview draf struktur ini. Jika ada penambahan modul spesifik, misalnya pemisahan dompet digital (e-wallet) dan rekening bank, atau penyesuaian pada arsitektur, dokumen ini siap direvisi.
