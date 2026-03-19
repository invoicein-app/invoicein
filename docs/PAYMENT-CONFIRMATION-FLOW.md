# Alur Konfirmasi Pembayaran Langganan (MVP)

## Tujuan
User bisa submit konfirmasi transfer dari halaman Langganan; admin bisa review dan tandai konfirmasi dari Billing Admin. Pembayaran tetap manual; proses terstruktur di dalam website.

## Model data

**Tabel: `payment_confirmations`**
- `id` uuid PK
- `org_id` uuid FK → organizations (organisasi yang diperpanjang)
- `user_id` uuid FK → auth.users (yang submit; untuk audit)
- `target_package` text: 'basic' | 'standard'
- `sender_account_name`, `sender_bank`, `sender_account_number` text
- `transfer_amount` text (user input bebas)
- `transfer_date` date
- `note` text nullable
- `status` text: 'pending' | 'confirmed' | 'rejected'
- `admin_note` text nullable
- `resolved_at` timestamptz nullable
- `resolved_by` uuid nullable (user_id admin)
- `created_at`, `updated_at` timestamptz

RLS: insert hanya oleh user yang punya membership ke org tersebut; read/update hanya via service role (backend admin API).

## Alur user
1. User buka Langganan → form konfirmasi (org_code & nama org auto dari session).
2. User isi: paket target, nama rekening pengirim, bank, no rekening, nominal, tanggal transfer, catatan.
3. Submit → POST /api/subscription/confirm-payment → insert status=pending.

## Alur admin
1. Admin buka Billing Admin → section "Konfirmasi pembayaran tertunda".
2. List konfirmasi pending (org, paket, pengirim, nominal, tanggal, catatan).
3. Admin pilih: Confirm / Reject (+ admin note opsional).
4. Setelah confirm, admin tetap lakukan perpanjang manual (search org, extend) seperti biasa.

## API
- **POST /api/subscription/confirm-payment** — auth user, org dari membership, body: target_package, sender_*, transfer_amount, transfer_date, note. Insert payment_confirmations.
- **GET /api/admin/payment-confirmations** — billing admin only. Query pending (atau all dengan filter).
- **PATCH /api/admin/payment-confirmations/[id]** — billing admin only. body: status ('confirmed'|'rejected'), admin_note. Set resolved_at, resolved_by.

Logic billing/admin yang ada (search org, extend, PATCH subscription) tidak diubah.

---

## Riwayat & struktur Billing Admin (extended)

### Di mana data hidup

1. **Konfirmasi tertunda (pending)**  
   Tabel `payment_confirmations` dengan `status = 'pending'`. Ditampilkan di bagian atas halaman Billing Admin.

2. **Riwayat konfirmasi (sudah diproses)**  
   Tabel yang sama `payment_confirmations` dengan `status IN ('confirmed','rejected')`. Kolom `resolved_at` = waktu review, `resolved_by` = admin yang review. Ditampilkan di section "Riwayat konfirmasi" di Billing Admin (list terbatas, mis. 50 terakhir).

3. **Data langganan organisasi saat ini**  
   Tetap dari `organizations` (search by org_code). Section "Cari organisasi" + data org + perpanjang/update seperti sekarang.

4. **Riwayat perubahan langganan (subscription history)**  
   Tabel baru `subscription_history`: setiap kali admin mengubah paket atau expires_at via Billing Admin, satu baris dicatat (org_id, org_code, previous/new plan & expires_at, changed_by, changed_at). Ditampilkan opsional di Billing Admin (mis. per org saat org sedang dibuka).
