-- Cek tiap jam, tandai transaksi yang kedaluwarsa (belum dibayar & lewat batas waktu).
-- Butuh secret Vault tambahan: 'expire_payments_function_url' -> .../functions/v1/expire-stale-payments
-- (pakai 'reminder_cron_secret' yang sama seperti job lain).

select cron.schedule(
  'expire-stale-payments-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'expire_payments_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'expire_payments_function_url');
  $$
);
