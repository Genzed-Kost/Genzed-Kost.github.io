-- ============================================================
-- Penghuni sekarang nggak bisa ubah data profil sendiri (nama, no HP)
-- langsung — harus lewat komplain, admin yang proses. Perluas trigger
-- proteksi kolom privileged yang sudah ada (role/is_active/email) supaya
-- full_name & phone juga dikunci buat non-admin, bukan cuma di level UI.
--
-- PENTING: request lewat service_role (dari Edge Function) auth.uid()-nya
-- NULL, jadi public.is_admin() selalu FALSE untuk service_role — tanpa
-- pengecualian ini, Edge Function (mis. end-tenancy nanti di Modul Refund)
-- yang perlu menonaktifkan akun penghuni (is_active) lewat service_role
-- bakal DIAM-DIAM GAGAL (update ke-revert trigger, tanpa error). Edge
-- Function sudah melakukan pengecekan admin sendiri di kodenya sebelum
-- sampai ke sini, jadi aman dilewatkan.
-- ============================================================

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and auth.role() <> 'service_role' then
    new.role := old.role;
    new.is_active := old.is_active;
    new.email := old.email;
    new.full_name := old.full_name;
    new.phone := old.phone;
  end if;
  return new;
end;
$$;
