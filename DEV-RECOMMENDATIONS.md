# Rekomendasi Pengembangan — InvoiceKu

Dokumen ini berisi opini hal-hal yang **perlu atau layak dikembangkan** di project InvoiceKu, berdasarkan penelusuran codebase. Prioritas bisa disesuaikan dengan tujuan bisnis dan waktu tim.

---

## 1. Kualitas kode & keandalan

### Validasi input (API)
- **Saat ini**: Hampir tidak ada library validasi (mis. Zod); validasi hanya berupa komentar "validate basic" atau pengecekan manual.
- **Rekomendasi**: Pakai **Zod** (atau Yup) di semua API route untuk body/query. Contoh: `POST /api/invoice/create` dan `PATCH /api/invoices/[id]` validasi schema items (qty, price), tanggal, customer_id, dll. Ini mengurangi bug dan serangan input jahat.

### TypeScript
- Banyak pemakaian `as any` dan type longgar (mis. di dashboard, sidebar).
- **Rekomendasi**: Perlahan perkenalkan type yang jelas untuk Supabase response (mis. generated types dari `supabase gen types`), dan kurangi `any` di komponen penting (dashboard, invoice, settings).

### Testing
- Belum ada test (unit/e2e) yang terlihat di project.
- **Rekomendasi**: Mulai dengan **critical path**: buat invoice, record payment, convert quotation ke invoice. Bisa pakai Vitest (unit) + Playwright (e2e). Tidak harus full coverage dulu; fokus alur yang paling sering dipakai dan paling riskan.

---

## 2. Pengalaman pengguna (UX)

### Feedback aksi (toast / notifikasi)
- Setelah simpan, hapus, atau bayar, feedback ke user sering hanya teks di halaman atau alert.
- **Rekomendasi**: Tambah **toast/notification** (mis. react-hot-toast atau sonner) untuk sukses/gagal. Konsisten di semua aksi: create/edit customer, invoice, payment, PO, dll.

### Loading & error state
- Beberapa halaman client-side (customers, products, dll) punya loading, tapi tidak seragam; error kadang hanya string di state.
- **Rekomendasi**: Standarkan pola: skeleton atau spinner saat loading, dan tampilan error yang jelas (pesan + tombol coba lagi) di list dan form.

### Responsif (mobile)
- Layout pakai `gridTemplateColumns: "260px 1fr"` — sidebar 260px bisa memakan layar kecil.
- **Rekomendasi**: Di breakpoint kecil, ubah sidebar jadi drawer/hamburger agar bisa dipakai nyaman dari HP/tablet. Ini penting kalau kasir/staff pakai dari ponsel.

### Aksesibilitas
- Beberapa tombol/tab sudah pakai `aria-label`; belum merata.
- **Rekomendasi**: Pastikan form punya label yang terhubung, tombol penting punya aria-label, dan navigasi bisa dipakai dengan keyboard (Tab, Enter).

---

## 3. Fitur bisnis yang bernilai

### Laporan & analitik
- Dashboard sudah ada KPI dan chart omset 6 bulan; belum ada laporan terstruktur.
- **Rekomendasi**:
  - **Laporan penjualan**: Ringkasan per periode (hari/minggu/bulan), filter by customer/produk.
  - **Aging piutang**: Daftar invoice unpaid/partial dikelompokkan umur (0–30, 31–60, 60+ hari).
  - **Laporan pembelian**: Ringkasan PO per vendor/periode.
  - Bisa tetap pakai chart sederhana (seperti di dashboard) atau tambah library (mis. Recharts) untuk tampilan lebih rapi.

### Export data
- Saat ini tidak ada export ke Excel/CSV.
- **Rekomendasi**: Tambah export untuk:
  - Daftar invoice (filter sama dengan list) → CSV/Excel.
  - Daftar customer, produk, vendor → CSV.
  Berguna untuk backup, audit, dan analisis di spreadsheet.

### Pengingat invoice (reminder)
- Sudah ada **WhatsApp** (link share invoice); belum ada pengingat otomatis.
- **Rekomendasi**: Fitur "reminder piutang": jadwal otomatis (mis. 7 hari setelah jatuh tempo) kirim link invoice via WhatsApp atau email ke nomor/email customer. Bisa pakai cron (Vercel Cron / Supabase Edge Function) + template pesan.

### Invoice berulang (recurring)
- Belum ada.
- **Rekomendasi**: Opsi buat invoice berulang (mingguan/bulanan) untuk langganan. Butuh tabel jadwal + job yang generate invoice dari template.

---

## 4. Keamanan & multi-tenant

### Filter per organisasi
- Banyak query sudah pakai `org_id`; beberapa halaman client (mis. customers) load data tanpa filter `org_id` di query — mengandalkan RLS.
- **Rekomendasi**: Pastikan **RLS (Row Level Security)** di Supabase benar-benar membatasi semua tabel (invoices, customers, products, quotations, delivery_notes, purchase_orders, warehouses, dll) per `org_id`. Cek juga API route: setiap aksi harus pakai `org_id` dari membership user yang login, jangan percaya client.

### Middleware & API
- Middleware hanya redirect login; semua `/api/*` dianggap "public" (tidak redirect), lalu di dalam route dicek user/session.
- **Rekomendasi**: Tetap boleh; yang penting **setiap API route** yang mengubah data harus: (1) get user dari Supabase auth, (2) cek membership + org_id, (3) validasi input. Buat helper (mis. `requireMembership` yang sudah ada) dipakai konsisten di semua route.

### Rate limiting
- Belum ada.
- **Rekomendasi**: Untuk production, tambah rate limit di API (mis. per IP atau per user) untuk login dan endpoint yang berat (generate PDF, export) agar tidak disalahgunakan.

---

## 5. Konsistensi & skala data

### Pagination
- Halaman **invoice** sudah pakai pagination (`.range()`); halaman **customers**, **vendors**, **quotations**, **delivery-notes**, **purchase-orders** banyak yang pakai `.limit(200)` atau sejenis tanpa halaman.
- **Rekomendasi**: Standarkan **pagination** di semua list (parameter `p` & `ps`), agar saat data membesar performa tetap baik dan UX konsisten.

### Pencarian & filter
- Invoice sudah punya filter (nomor, customer, tanggal, status bayar); list lain tidak seragam.
- **Rekomendasi**: Tambah **search/filter** di Customer, Barang, Vendor, Quotation, Surat Jalan, PO (minimal search by nama/nomor, filter tanggal kalau relevan).

---

## 6. DevOps & dokumentasi

### README & env
- README masih template default Next.js.
- **Rekomendasi**: Update README: cara setup (clone, `npm i`, env vars), variabel yang wajib (`NEXT_PUBLIC_SUPABASE_*`, dll), dan langkah jalankan dev/build. Sertakan contoh `.env.example` tanpa nilai rahasia.

### Skema database
- Tidak ada dokumen skema di repo.
- **Rekomendasi**: Simpan ringkasan tabel utama dan relasi (bisa dari `supabase gen types` atau export SQL) di folder `docs/` atau di README, agar onboarding dan migrasi lebih mudah.

### Error monitoring
- Belum terlihat integrasi error tracking.
- **Rekomendasi**: Untuk production, tambah layanan seperti **Sentry** (atau alternatif) untuk menangkap error di client dan server, sehingga bisa cepat perbaiki bug.

---

## 7. Ringkasan prioritas (saran)

| Prioritas | Area              | Contoh aksi |
|-----------|-------------------|-------------|
| Tinggi    | Keamanan / RLS    | Pastikan RLS + org_id di semua tabel & API |
| Tinggi    | Validasi API      | Tambah Zod di route create/update penting |
| Sedang    | UX                | Toast notifikasi, loading/error konsisten, sidebar responsif |
| Sedang    | Data              | Pagination + search/filter di semua list |
| Sedang    | Laporan           | Laporan penjualan & aging piutang |
| Sedang    | Export            | Export invoice & master data ke CSV/Excel |
| Rendah    | Testing           | Beberapa e2e untuk alur invoice & payment |
| Rendah    | Fitur lanjutan    | Reminder piutang, recurring invoice, rate limit |

---

*Dokumen ini bisa diperbarui seiring perubahan codebase dan prioritas produk.*
