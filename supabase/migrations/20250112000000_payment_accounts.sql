-- ============================================================
-- Multi rekening transfer manual. Sebelumnya cuma ada 1 rekening
-- (setting key 'bank_transfer_info'), sekarang admin bisa kelola banyak
-- (bank, QRIS statis/gambar, e-wallet) dan penghuni pilih salah satu
-- sebelum upload bukti transfer.
-- ============================================================

create type public.payment_account_type as enum ('BANK', 'QRIS', 'EWALLET');

create table public.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  account_type public.payment_account_type not null,
  bank_code text,
  bank_name text,
  account_number text,
  account_holder text,
  qris_image_path text,
  ewallet_provider text,
  instructions text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_accounts_active_sort_idx on public.payment_accounts(is_active, sort_order);

alter table public.payment_accounts enable row level security;
-- Penghuni (dan siapa pun yang login) cuma lihat rekening aktif; admin lihat semua
-- termasuk yang nonaktif (buat dikelola). Akses dari link bayar publik (anon, tanpa
-- login) TIDAK lewat RLS ini — selalu lewat resolve-payment-link pakai service role.
create policy "payment_accounts_select_active_or_admin" on public.payment_accounts
  for select using (is_active = true or public.is_admin());
create policy "payment_accounts_write_admin_only" on public.payment_accounts
  for all using (public.is_admin()) with check (public.is_admin());

-- Rekening yang dipilih penghuni saat transfer manual, biar admin tau di /admin/verifikasi
-- bukti itu transfer ke rekening yang mana kalau ada lebih dari satu aktif.
alter table public.payment_proofs add column if not exists payment_account_id uuid references public.payment_accounts(id);
-- Disimpan juga di payments (diisi saat create-payment) supaya halaman ringkasan bayar
-- dan link bayar publik tau rekening yang dipilih SEBELUM bukti transfer diupload —
-- payment_proofs.payment_account_id di atas cuma menyalin nilai ini saat submit bukti.
alter table public.payments add column if not exists payment_account_id uuid references public.payment_accounts(id);

-- Bucket buat gambar QRIS statis (bukan data pribadi penghuni — QRIS merchant/rekening
-- kost sendiri, jadi aman public supaya bisa ditampilkan juga di link bayar publik
-- tanpa perlu signed URL / Edge Function tambahan).
insert into storage.buckets (id, name, public)
values ('payment-account-qris', 'payment-account-qris', true)
on conflict (id) do nothing;

create policy "payment_account_qris_select_public" on storage.objects
  for select using (bucket_id = 'payment-account-qris');
create policy "payment_account_qris_write_admin_only" on storage.objects
  for all using (bucket_id = 'payment-account-qris' and public.is_admin())
  with check (bucket_id = 'payment-account-qris' and public.is_admin());

-- Pindahkan rekening lama (kalau sudah pernah diisi) jadi baris payment_accounts pertama.
insert into public.payment_accounts (account_type, bank_name, account_number, account_holder, is_active, sort_order)
select
  'BANK',
  value->>'bank_name',
  value->>'account_number',
  value->>'account_holder',
  true,
  0
from public.settings
where key = 'bank_transfer_info'
  and value->>'account_number' is not null;

delete from public.settings where key = 'bank_transfer_info';
