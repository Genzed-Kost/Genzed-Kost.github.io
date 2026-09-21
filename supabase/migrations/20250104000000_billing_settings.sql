-- Pengaturan default buat mesin tagihan otomatis (Modul 3).
-- Admin bisa ubah nilai-nilai ini lewat panel admin nanti (Modul 5).

insert into public.settings (key, value) values
('invoice_lead_days', '5'),                          -- terbitkan tagihan N hari sebelum periode mulai
('invoice_due_days_after_period_start', '5')         -- jatuh tempo N hari setelah periode mulai
on conflict (key) do nothing;

insert into public.penalties (name, calc_type, value, grace_period_days, max_amount, is_active) values
('Denda Keterlambatan Standar', 'NOMINAL_PER_HARI', 10000, 3, 150000, true);
