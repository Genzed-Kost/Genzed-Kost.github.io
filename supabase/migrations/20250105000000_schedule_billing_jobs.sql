-- ============================================================
-- Jadwal otomatis mesin tagihan (Modul 3), jalan tiap hari jam 06:00 WIB
-- (sebelum jadwal pengingat jatuh tempo jam 09:00 WIB, supaya tagihan baru
-- sudah ada duluan kalau kebetulan hari yang sama).
--
-- Butuh 2 secret tambahan di Supabase Vault (isi manual sekali, caranya di README):
--   - 'generate_invoices_function_url' -> https://<project-ref>.supabase.co/functions/v1/generate-monthly-invoices
--   - 'apply_penalties_function_url'   -> https://<project-ref>.supabase.co/functions/v1/apply-late-penalties
-- Keduanya pakai secret 'reminder_cron_secret' yang sama (sudah dibuat di migrasi pengingat).
-- ============================================================

select cron.schedule(
  'generate-monthly-invoices-daily',
  '0 23 * * *', -- 23:00 UTC = 06:00 WIB
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'generate_invoices_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'generate_invoices_function_url');
  $$
);

select cron.schedule(
  'apply-late-penalties-daily',
  '15 23 * * *', -- 23:15 UTC = 06:15 WIB (jalan setelah generate-monthly-invoices)
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'apply_penalties_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'apply_penalties_function_url');
  $$
);
