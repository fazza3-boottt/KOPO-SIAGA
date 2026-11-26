# KOPO SIAGA

KOPO SIAGA (Kopo Sistem Informasi dan Antisipasi Gangguan Jalan) adalah aplikasi pemantauan kondisi jalan untuk koridor Bandung Kiwari–Kopo–Katapang, Kabupaten Bandung.

## Status pengembangan

KOPO SIAGA menyediakan dashboard publik tanpa login, peta OpenStreetMap, pencarian lokasi berbasis Nominatim, kontrol lokasi GPS berbasis izin browser, filter kategori, ringkasan laporan, dan halaman prakiraan cuaca BMKG.

Warga dapat mengirim laporan tanpa akun. Tanpa konfigurasi backend, data tersimpan di browser yang digunakan; dengan Supabase, laporan dibagikan secara realtime ke semua pengunjung yang sedang membuka aplikasi. Status koneksi di header menunjukkan apakah realtime aktif atau masih dalam mode lokal. Laporan baru muncul sebagai pemberitahuan di situs dan di Pusat Notifikasi. Badge menghitung laporan yang belum dibaca; membukanya akan menghapus badge dan menyimpan status baca pada browser tersebut. Notifikasi sistem browser bersifat opsional dan memerlukan izin pengunjung. Laporan tampil langsung dan tidak menunggu atau memerlukan pemeriksaan admin. Informasi laporan berasal dari warga dan tidak diverifikasi petugas. Notifikasi push saat aplikasi tertutup belum disediakan.

Pencarian alamat laporan menggunakan layanan publik Nominatim. Tautan pencarian jalan sekitar membuka Google Maps, tetapi bukan perhitungan rute alternatif yang mengetahui gangguan terkini.

## Persyaratan

- Node.js 18 atau lebih baru
- npm
- Koneksi internet untuk memuat peta OpenStreetMap, pencarian Nominatim, dan font
- Koneksi internet untuk mengambil prakiraan cuaca resmi BMKG

## Menjalankan aplikasi

```bash
npm install
npm run dev
```

Vite akan menampilkan URL lokal (biasanya `http://localhost:5173`). Untuk memeriksa build produksi:

```bash
npm run build
npm run preview
```

## Peta dan privasi

Basemap menggunakan tile OpenStreetMap. Pencarian menggunakan layanan geocoding publik Nominatim dan dibatasi ke area Kabupaten Bandung di sekitar koridor pemantauan; layanan eksternal ini memiliki kebijakan penggunaan dan dapat tidak tersedia. Lokasi perangkat hanya diminta setelah pengguna menekan tombol lokasi, melalui izin geolocation browser. Posisi pengguna tidak dikirim atau disimpan oleh aplikasi.

### Mengaktifkan sinkronisasi Supabase (opsional)

1. Buat proyek Supabase, lalu jalankan isi [`supabase/schema.sql`](./supabase/schema.sql) melalui SQL Editor. Skema memberi akses publik untuk membaca dan mengirim laporan, tanpa izin perubahan status oleh admin.
2. Salin `.env.example` menjadi `.env.local`, lalu isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dari pengaturan proyek Supabase.
3. Jalankan ulang aplikasi dan pastikan header menunjukkan **Realtime aktif**. Laporan dan notifikasi dibagikan ke perangkat lain selama pengunjung membuka aplikasi. Gunakan hanya anon/publishable key di frontend; jangan pernah menaruh service-role key di kode sumber.

### Prakiraan cuaca BMKG

Halaman **Cuaca** mengambil prakiraan publik BMKG untuk wilayah Kopo/Margahayu, Margaasih, Katapang, atau Bojongsoang. Karena API BMKG tidak mengizinkan permintaan langsung dari browser, middleware Vite meneruskan permintaan same-origin yang hanya menerima kode wilayah yang diizinkan. Ini tersedia melalui `npm run dev` dan `npm run preview`; deployment di luar Vite perlu menyediakan proxy same-origin yang setara ke `https://api.bmkg.go.id/publik/prakiraan-cuaca`. Data suhu, kelembapan, angin, hujan, dan waktu prakiraan ditampilkan terpisah dari laporan warga; animasi siang/malam dan hujan mengikuti waktu Bandung serta kondisi prakiraan. Sumber dan analisis prakiraan dicantumkan di halaman.

Halaman CCTV menampilkan baris `public.cctv_cameras` yang `is_public = true`. Ganti nilai contoh berikut dengan URL kamera dan portal resmi yang telah diverifikasi:

```sql
insert into public.cctv_cameras (name, area, official_url, embed_url, status, is_public)
values ('Nama kamera resmi', 'Nama wilayah', 'https://portal-resmi.example/cctv', 'https://portal-resmi.example/embed/kamera', 'aktif', true);
```

`embed_url` harus berupa URL HTTPS yang memang menyediakan tampilan embed; jika kamera hanya menyediakan halaman portal, isi `official_url` dan biarkan `embed_url` kosong. Aplikasi tidak mengarang atau mengisi sumber kamera yang belum dikonfirmasi.
