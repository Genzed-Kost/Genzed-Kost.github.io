-- ============================================================
-- Jadwal otomatis: kirim pengingat jatuh tempo tiap hari jam 09:00 WIB.
-- Butuh 2 secret di Supabase Vault (diisi manual sekali per project,
-- caranya ada di README bagian "Setup Supabase" — TIDAK di-hardcode
-- di migrasi ini supaya tidak bocor ke git):
--   - 'reminder_function_url'  -> https://<project-ref>.supabase.co/functions/v1/send-due-reminders
--   - 'reminder_cron_secret'   -> nilai acak sama dengan secret CRON_SECRET Edge Function
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-due-reminders-daily',
  '0 2 * * *', -- 02:00 UTC = 09:00 WIB
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'reminder_function_url');
  $$
);
