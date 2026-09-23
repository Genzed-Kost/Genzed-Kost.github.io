-- Hapus penghuni gagal dengan error FK kalau penghuni itu pernah bikin
-- payment sendiri atau pernah aktivasi akun — karena create-payment nyimpen
-- created_by = tenant.id sendiri, dan verify-otp-activate / submit-payment-proof
-- nyimpen actor_id = profile.id sendiri di audit_logs, TAPI kolom itu nggak
-- di-cascade (beda sama tenant_id yang udah cascade). Postgres blokir DELETE
-- profiles selama ada baris lain yang masih nunjuk ke situ lewat FK apapun,
-- termasuk yang non-cascade ini — jadi delete-tenant gagal buat SEMUA penghuni
-- yang udah pernah aktivasi (yaitu semua penghuni aktif).
alter table public.payments drop constraint payments_created_by_fkey;
alter table public.payments add constraint payments_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.audit_logs drop constraint audit_logs_actor_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;
