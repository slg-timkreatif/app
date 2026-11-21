# Strategi Distribusi iOS — Guru Berbagi

## Konteks

- Android memakai **APK TWA yang ditandatangani lokal** (`io.github.slg_timkreatif.twa`).
- Menu generik **"Pasang di HP"** (alur `beforeinstallprompt` PWA) sudah dihapus dari Pengaturan, karena Android tidak lagi mengandalkan PWA.
- iOS **tidak bisa menjalankan APK** dan tidak mengizinkan sideloading tanpa akun developer.

## Jangka pendek (sudah diterapkan)

- Tombol install PWA generik dihapus dari `index.html`; halaman legacy `creative.html` sudah dihapus dari repo.
- Tombol **"Panduan iPhone/iPad"** hanya muncul di perangkat iOS (iPhone/iPad/iPod, termasuk iPadOS desktop-mode).
- Modal `mIos` memberitahu pengguna:
  1. Buka portal di **Safari**
  2. Ketuk **Bagikan**
  3. Pilih **Tambahkan ke Layar Utama**
- Event `appinstalled` tetap dipakai untuk mencatat instalasi sebagai `client='pwa'` di `creative_installs`.
- `beforeinstallprompt` tidak lagi dipasang, jadi Android/browser tidak melihat prompt PWA.

Ini adalah **fallback web**, bukan aplikasi native. Belum memerlukan App Store.

## Jangka menengah (perlu keputusan/akun)

- Bungkus web app dengan **Capacitor** menjadi aplikasi iOS native.
- Daftar **Apple Developer Program** (berbayar) untuk distribusi **TestFlight**.
- Uji coba internal lewat TestFlight sebelum rilis publik.
- Penyesuaian teknis yang perlu disiapkan:
  - ikon & splash screen iOS
  - `Info.plist`, privacy manifest, dan izin
  - **Associated Domains** untuk `applinks:` (padanan `assetlinks.json` di Android)
  - penyesuaian URL start dan penanganan `?apkv=` di native shell

## Jangka panjang

- Rilis di **App Store**.
- Perbarui `related_applications` di `manifest.json` dengan entri iOS bila tersedia.
- Tambahkan tautan App Store di modal `mIos`, menggantikan panduan Add to Home Screen.
- Samakan kebijakan privasi dengan pengumpulan data install/aktivitas.

## Keputusan yang dibutuhkan

1. Apakah akun Apple Developer sudah tersedia?
2. Target waktu: TestFlight dulu atau langsung App Store?
3. Apakah fallback PWA iOS boleh tetap dipertahankan sampai aplikasi native tersedia?
