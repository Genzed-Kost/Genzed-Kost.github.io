-- ============================================================
-- Modul 4 — Pembayaran: tambahan skema
-- ============================================================

-- Token buat link pembayaran publik (ortu/wali, tanpa perlu login).
-- Akses ke link ini SELALU lewat Edge Function pakai service role —
-- TIDAK ada policy RLS publik ditambahkan di sini, supaya tabel payments
-- tetap tidak bisa diakses langsung oleh anon/publik.
alter table public.payments add column if not exists public_link_token text unique;

-- Rincian sumber dana per payment, dibutuhkan supaya proses konfirmasi (webhook/approval)
-- tahu persis berapa yang harus dikurangi dari deposit & voucher mana yang harus ditandai terpakai,
-- tanpa perlu menghitung ulang (yang berisiko beda hasil kalau data berubah di antara waktu).
alter table public.payments add column if not exists deposit_used numeric(12,2) not null default 0;
alter table public.payments add column if not exists voucher_id uuid references public.vouchers(id);
alter table public.payments add column if not exists voucher_discount numeric(12,2) not null default 0;

-- Disimpan supaya penghuni bisa "lanjutkan pembayaran" (buka lagi halaman Midtrans)
-- tanpa perlu bikin transaksi baru kalau payment yang sama diminta ulang (retry/refresh).
alter table public.payments add column if not exists gateway_redirect_url text;

-- Bucket buat invoice PDF otomatis (dibuat sistem, bukan diupload penghuni).
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "invoices_bucket_select_own_or_admin" on storage.objects
  for select using (
    bucket_id = 'invoices'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Biaya admin disederhanakan jadi 2 kategori: MANUAL (transfer Bank Jago / QRIS statis
-- milik sendiri, biasanya gratis) dan GATEWAY (semua metode otomatis via Midtrans — VA,
-- e-wallet, QRIS dinamis, gerai retail — satu angka rata, karena tarif MDR per channel
-- Midtrans yang sesungguhnya diatur di kontrak merchant, bukan sesuatu yang bisa ditebak
-- akurat per channel di kode ini). Admin bisa sesuaikan nilainya lewat panel admin nanti.
insert into public.settings (key, value) values
(
  'payment_method_fees',
  '{
    "manual": {"type": "nominal", "value": 0},
    "gateway": {"type": "percent", "value": 2}
  }'::jsonb
),
('min_partial_payment', '50000'),
('payment_expiry_hours', '24'),
-- Diisi admin lewat SQL Editor / panel admin (Modul 5) sebelum jalur manual bisa dipakai.
-- Sengaja dikosongkan di sini — jangan pernah hardcode nomor rekening asli di file migrasi.
('bank_transfer_info', '{"bank_name": null, "account_number": null, "account_holder": null}')
on conflict (key) do nothing;
