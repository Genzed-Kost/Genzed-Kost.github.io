-- Tenant bisa update complaint mereka sendiri lewat kebijakan lama
-- ("complaints_update_own_or_admin"), termasuk kolom status & admin_response —
-- artinya penghuni bisa langsung PATCH complaints miliknya sendiri jadi
-- status SELESAI dengan admin_response palsu tanpa admin pernah menyentuhnya.
-- Update cuma boleh dilakukan admin; penghuni cuma boleh insert laporan baru.
drop policy if exists "complaints_update_own_or_admin" on public.complaints;
create policy "complaints_update_admin_only" on public.complaints
  for update using (public.is_admin())
  with check (public.is_admin());
