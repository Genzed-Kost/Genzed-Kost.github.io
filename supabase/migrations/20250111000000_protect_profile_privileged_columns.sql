-- KRITIS: kebijakan "profiles_update_own_or_admin" cuma ngatur BARIS mana
-- yang boleh diupdate (punya sendiri atau admin), TAPI nggak ngatur KOLOM
-- mana yang boleh diubah. Row Level Security di Postgres emang nggak bisa
-- ngebatasin kolom lewat USING/WITH CHECK doang — jadi penghuni mana pun
-- bisa langsung PATCH profiles miliknya sendiri dan ganti role jadi 'admin'
-- lewat REST API langsung (dibuktikan lewat test: berhasil, status 200).
-- Trigger BEFORE UPDATE ini nutup celahnya: kalau yang update BUKAN admin,
-- paksa role/is_active/email balik ke nilai lama, apa pun yang dikirim
-- client — jadi penghuni cuma bisa ubah full_name/phone/avatar_url kayak
-- yang dimaksud halaman Profil, sisanya cuma bisa diubah admin.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    new.email := old.email;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_protect_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();
