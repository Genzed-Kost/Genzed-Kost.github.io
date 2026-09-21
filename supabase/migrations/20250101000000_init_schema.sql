-- ============================================================
-- Genzed Kost — Portal Penghuni & Admin
-- Migrasi awal: semua tabel inti, relasi, index, RLS, dan seed data
-- ============================================================

create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ────────────────────────────────────────────────────────────
create type public.user_role as enum ('penghuni', 'admin');
create type public.tenancy_status as enum ('AKTIF', 'BERAKHIR', 'DIBATALKAN');
create type public.billing_cycle as enum ('BULANAN', 'TRIWULAN', 'SEMESTER', 'TAHUNAN');
create type public.invoice_status as enum ('DRAFT', 'TERBIT', 'SEBAGIAN_DIBAYAR', 'LUNAS', 'JATUH_TEMPO', 'DIBATALKAN');
create type public.invoice_item_type as enum ('SEWA_KAMAR', 'LAUNDRY', 'PARKIR_TAMBAHAN', 'TAMU_MENGINAP', 'PERBAIKAN', 'DENDA', 'DISKON', 'LAINNYA');
create type public.payment_method as enum ('TRANSFER_MANUAL', 'QRIS_STATIS', 'VIRTUAL_ACCOUNT', 'QRIS_DINAMIS', 'EWALLET', 'GERAI_RETAIL', 'SALDO_DEPOSIT', 'VOUCHER');
create type public.payment_status as enum ('MENUNGGU', 'MENUNGGU_VERIFIKASI', 'LUNAS', 'DITOLAK', 'KEDALUWARSA', 'DIBATALKAN');
create type public.ledger_entry_type as enum ('DEPOSIT_MASUK', 'DEPOSIT_KELUAR', 'PEMBAYARAN_TAGIHAN', 'REFUND', 'VOUCHER_PAKAI', 'PENYESUAIAN');
create type public.voucher_type as enum ('NOMINAL', 'PERSEN');
create type public.penalty_calc_type as enum ('NOMINAL_PER_HARI', 'PERSEN_PER_HARI');
create type public.complaint_status as enum ('BARU', 'DIPROSES', 'SELESAI', 'DITOLAK');
create type public.invite_status as enum ('MENUNGGU_AKTIVASI', 'OTP_TERKIRIM', 'AKTIF', 'KEDALUWARSA', 'DIBATALKAN');

-- ────────────────────────────────────────────────────────────
-- HELPER: cek role admin tanpa memicu rekursi RLS
-- ────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'penghuni',
  full_name text not null,
  email text not null,
  phone text not null,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_phone_key on public.profiles(phone);
create unique index profiles_email_key on public.profiles(email);

alter table public.profiles enable row level security;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());
create policy "profiles_insert_admin_only" on public.profiles
  for insert with check (public.is_admin());
create policy "profiles_delete_admin_only" on public.profiles
  for delete using (public.is_admin());

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- ROOM TYPES
-- ────────────────────────────────────────────────────────────
create table public.room_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_price numeric(12,2) not null check (base_price >= 0),
  description text,
  facilities jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_types enable row level security;
create policy "room_types_select_authenticated" on public.room_types
  for select using (auth.role() = 'authenticated');
create policy "room_types_write_admin_only" on public.room_types
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_room_types_updated_at before update on public.room_types
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- ROOMS
-- ────────────────────────────────────────────────────────────
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_number text not null unique,
  room_type_id uuid not null references public.room_types(id),
  floor int,
  is_occupied boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rooms_room_type_id_idx on public.rooms(room_type_id);

alter table public.rooms enable row level security;
create policy "rooms_select_authenticated" on public.rooms
  for select using (auth.role() = 'authenticated');
create policy "rooms_write_admin_only" on public.rooms
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- TENANCIES (kontrak sewa)
-- ────────────────────────────────────────────────────────────
create table public.tenancies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.rooms(id),
  billing_cycle public.billing_cycle not null default 'BULANAN',
  monthly_rate numeric(12,2) not null check (monthly_rate >= 0),
  start_date date not null,
  end_date date,
  status public.tenancy_status not null default 'AKTIF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenancies_dates_check check (end_date is null or end_date >= start_date)
);
create index tenancies_tenant_id_idx on public.tenancies(tenant_id);
create index tenancies_room_id_idx on public.tenancies(room_id);
create index tenancies_status_idx on public.tenancies(status);

alter table public.tenancies enable row level security;
create policy "tenancies_select_own_or_admin" on public.tenancies
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy "tenancies_write_admin_only" on public.tenancies
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_tenancies_updated_at before update on public.tenancies
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- INVOICES
-- ────────────────────────────────────────────────────────────
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  tenancy_id uuid not null references public.tenancies(id),
  period_start date not null,
  period_end date not null,
  due_date date not null,
  status public.invoice_status not null default 'DRAFT',
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  penalty_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_total numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_tenant_id_idx on public.invoices(tenant_id);
create index invoices_status_idx on public.invoices(status);
create index invoices_due_date_idx on public.invoices(due_date);

alter table public.invoices enable row level security;
create policy "invoices_select_own_or_admin" on public.invoices
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy "invoices_write_admin_only" on public.invoices
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- INVOICE ITEMS
-- ────────────────────────────────────────────────────────────
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  item_type public.invoice_item_type not null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index invoice_items_invoice_id_idx on public.invoice_items(invoice_id);

alter table public.invoice_items enable row level security;
create policy "invoice_items_select_own_or_admin" on public.invoice_items
  for select using (
    exists (select 1 from public.invoices i where i.id = invoice_id and (i.tenant_id = auth.uid() or public.is_admin()))
  );
create policy "invoice_items_write_admin_only" on public.invoice_items
  for all using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- PAYMENTS
-- ────────────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  method public.payment_method not null,
  status public.payment_status not null default 'MENUNGGU',
  amount numeric(12,2) not null check (amount >= 0),
  admin_fee numeric(12,2) not null default 0,
  unique_code smallint,
  gateway_provider text,
  gateway_transaction_id text,
  gateway_raw_response jsonb,
  idempotency_key text not null unique,
  expires_at timestamptz,
  paid_at timestamptz,
  rejected_reason text,
  split_group_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_tenant_id_idx on public.payments(tenant_id);
create index payments_status_idx on public.payments(status);
create index payments_gateway_transaction_id_idx on public.payments(gateway_transaction_id);

alter table public.payments enable row level security;
create policy "payments_select_own_or_admin" on public.payments
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy "payments_insert_own_or_admin" on public.payments
  for insert with check (tenant_id = auth.uid() or public.is_admin());
create policy "payments_update_admin_only" on public.payments
  for update using (public.is_admin()) with check (public.is_admin());
create policy "payments_delete_admin_only" on public.payments
  for delete using (public.is_admin());

create trigger trg_payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PAYMENT ALLOCATIONS (alokasi 1 pembayaran ke 1..N tagihan)
-- ────────────────────────────────────────────────────────────
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid references public.invoices(id),
  amount numeric(12,2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index payment_allocations_payment_id_idx on public.payment_allocations(payment_id);
create index payment_allocations_invoice_id_idx on public.payment_allocations(invoice_id);

alter table public.payment_allocations enable row level security;
create policy "payment_allocations_select_own_or_admin" on public.payment_allocations
  for select using (
    exists (select 1 from public.payments p where p.id = payment_id and (p.tenant_id = auth.uid() or public.is_admin()))
  );
create policy "payment_allocations_write_admin_only" on public.payment_allocations
  for all using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- LEDGER ENTRIES (buku besar saldo — sumber kebenaran)
-- ────────────────────────────────────────────────────────────
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  entry_type public.ledger_entry_type not null,
  amount numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  reference_type text,
  reference_id uuid,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index ledger_entries_tenant_id_idx on public.ledger_entries(tenant_id);
create index ledger_entries_created_at_idx on public.ledger_entries(created_at);

alter table public.ledger_entries enable row level security;
create policy "ledger_entries_select_own_or_admin" on public.ledger_entries
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy "ledger_entries_write_admin_only" on public.ledger_entries
  for all using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- DEPOSITS
-- ────────────────────────────────────────────────────────────
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null,
  source_payment_id uuid references public.payments(id),
  amount numeric(12,2) not null check (amount >= 0),
  remaining_amount numeric(12,2) not null check (remaining_amount >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index deposits_tenant_id_idx on public.deposits(tenant_id);

alter table public.deposits enable row level security;
create policy "deposits_select_own_or_admin" on public.deposits
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy "deposits_write_admin_only" on public.deposits
  for all using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- VOUCHERS
-- ────────────────────────────────────────────────────────────
create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  voucher_type public.voucher_type not null,
  value numeric(12,2) not null check (value >= 0),
  max_discount numeric(12,2),
  min_transaction numeric(12,2) not null default 0,
  quota int,
  used_count int not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vouchers enable row level security;
create policy "vouchers_select_authenticated" on public.vouchers
  for select using (auth.role() = 'authenticated');
create policy "vouchers_write_admin_only" on public.vouchers
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_vouchers_updated_at before update on public.vouchers
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- VOUCHER USAGES
-- ────────────────────────────────────────────────────────────
create table public.voucher_usages (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  payment_id uuid references public.payments(id),
  invoice_id uuid references public.invoices(id),
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  created_at timestamptz not null default now()
);
create index voucher_usages_voucher_id_idx on public.voucher_usages(voucher_id);
create index voucher_usages_tenant_id_idx on public.voucher_usages(tenant_id);

alter table public.voucher_usages enable row level security;
create policy "voucher_usages_select_own_or_admin" on public.voucher_usages
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy "voucher_usages_write_admin_only" on public.voucher_usages
  for all using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- PENALTIES (aturan denda, diatur admin)
-- ────────────────────────────────────────────────────────────
create table public.penalties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calc_type public.penalty_calc_type not null,
  value numeric(12,2) not null check (value >= 0),
  grace_period_days int not null default 0,
  max_amount numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.penalties enable row level security;
create policy "penalties_select_authenticated" on public.penalties
  for select using (auth.role() = 'authenticated');
create policy "penalties_write_admin_only" on public.penalties
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_penalties_updated_at before update on public.penalties
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PAYMENT PROOFS (bukti transfer manual)
-- ────────────────────────────────────────────────────────────
create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_status text not null default 'MENUNGGU',
  review_note text
);
create index payment_proofs_payment_id_idx on public.payment_proofs(payment_id);

alter table public.payment_proofs enable row level security;
create policy "payment_proofs_select_own_or_admin" on public.payment_proofs
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy "payment_proofs_insert_own" on public.payment_proofs
  for insert with check (tenant_id = auth.uid());
create policy "payment_proofs_review_admin_only" on public.payment_proofs
  for update using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null,
  category text not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  sent_at timestamptz,
  send_status text not null default 'PENDING',
  created_at timestamptz not null default now()
);
create index notifications_tenant_id_idx on public.notifications(tenant_id);
create index notifications_is_read_idx on public.notifications(is_read);

alter table public.notifications enable row level security;
create policy "notifications_select_own_or_admin" on public.notifications
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy "notifications_update_own_or_admin" on public.notifications
  for update using (tenant_id = auth.uid() or public.is_admin())
  with check (tenant_id = auth.uid() or public.is_admin());
create policy "notifications_insert_admin_only" on public.notifications
  for insert with check (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- COMPLAINTS
-- ────────────────────────────────────────────────────────────
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.rooms(id),
  category text not null,
  title text not null,
  description text not null,
  status public.complaint_status not null default 'BARU',
  photo_paths text[] not null default '{}',
  admin_response text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index complaints_tenant_id_idx on public.complaints(tenant_id);
create index complaints_status_idx on public.complaints(status);

alter table public.complaints enable row level security;
create policy "complaints_select_own_or_admin" on public.complaints
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy "complaints_insert_own" on public.complaints
  for insert with check (tenant_id = auth.uid());
create policy "complaints_update_own_or_admin" on public.complaints
  for update using (tenant_id = auth.uid() or public.is_admin())
  with check (tenant_id = auth.uid() or public.is_admin());

create trigger trg_complaints_updated_at before update on public.complaints
  for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- AUDIT LOGS
-- ────────────────────────────────────────────────────────────
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at);

alter table public.audit_logs enable row level security;
create policy "audit_logs_select_admin_only" on public.audit_logs
  for select using (public.is_admin());
create policy "audit_logs_insert_admin_only" on public.audit_logs
  for insert with check (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- SETTINGS (key-value pengaturan global)
-- ────────────────────────────────────────────────────────────
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;
create policy "settings_select_authenticated" on public.settings
  for select using (auth.role() = 'authenticated');
create policy "settings_write_admin_only" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- INVITES (khusus alur aktivasi akun penghuni — hanya via Edge Function)
-- ────────────────────────────────────────────────────────────
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  invite_code_hash text not null,
  otp_code_hash text,
  otp_expires_at timestamptz,
  attempt_count int not null default 0,
  status public.invite_status not null default 'MENUNGGU_AKTIVASI',
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id),
  activated_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_profile_id_idx on public.invites(profile_id);

alter table public.invites enable row level security;
-- Tidak ada akses tulis langsung dari client sama sekali — semua lewat Edge Function (service role).
create policy "invites_admin_select_only" on public.invites
  for select using (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- SEED DATA
-- ────────────────────────────────────────────────────────────
insert into public.room_types (name, base_price, description, facilities) values
(
  'Starter Pack Room',
  800000,
  'Cocok untuk mahasiswa. Kamar 3x4 meter dengan kamar mandi dalam (WC jongkok).',
  '["WiFi 100 Mbps","AC","Kamar Mandi Dalam (WC Jongkok)","Wastafel","Parkir Motor","Akses Rooftop & Dapur Bersama"]'::jsonb
),
(
  'Big Mood Suite',
  1000000,
  'Cocok untuk mahasiswa & karyawan. Kamar 3x4 meter dengan kamar mandi dalam (WC duduk), WiFi priority.',
  '["WiFi 100 Mbps Priority","AC","Kamar Mandi Dalam (WC Duduk)","Wastafel","Parkir Motor","Akses Rooftop & Dapur Bersama"]'::jsonb
);

insert into public.settings (key, value) values
('payment_gateway_enabled', 'false'),
('payment_gateway_provider', '"midtrans"'),
('admin_fee_borne_by', '"tenant"'),
('wa_notification_provider', '"fonnte"'),
('unique_code_range', '{"min": 1, "max": 999}');
