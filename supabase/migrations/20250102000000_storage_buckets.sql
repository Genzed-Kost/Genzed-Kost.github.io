-- ============================================================
-- Supabase Storage: bucket dokumen penghuni & bukti transfer
-- Struktur path: <bucket>/<tenant_id>/<nama_file>
-- Penghuni cuma bisa akses foldernya sendiri; admin bisa akses semua.
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('tenant-documents', 'tenant-documents', false),
  ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- ────────────────────────────────────────────────────────────
-- tenant-documents (KTP, kontrak sewa, dokumen pribadi penghuni)
-- ────────────────────────────────────────────────────────────
create policy "tenant_documents_select_own_or_admin" on storage.objects
  for select using (
    bucket_id = 'tenant-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "tenant_documents_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'tenant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "tenant_documents_delete_own_or_admin" on storage.objects
  for delete using (
    bucket_id = 'tenant-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ────────────────────────────────────────────────────────────
-- payment-proofs (bukti transfer manual — dipakai di Modul Pembayaran)
-- ────────────────────────────────────────────────────────────
create policy "payment_proofs_bucket_select_own_or_admin" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy "payment_proofs_bucket_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
