-- ============================================================
-- Tambah tipe pembayaran CRYPTO (BTC/USDT/dst) ke payment_accounts,
-- dipakai sebagai salah satu pilihan di bawah metode Transfer Manual
-- yang sudah ada (20250112000000_payment_accounts.sql).
-- ============================================================

alter type public.payment_account_type add value 'CRYPTO';

alter table public.payment_accounts add column if not exists crypto_asset text;
alter table public.payment_accounts add column if not exists crypto_network text;
-- Alamat wallet-nya disimpan di kolom account_number yang sudah ada
-- (sama seperti nomor e-wallet), supaya nggak perlu kolom baru lagi.
