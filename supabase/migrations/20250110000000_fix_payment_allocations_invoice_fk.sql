-- Kelanjutan dari 20250109000000_fix_delete_tenant_fk.sql: itu baru nutup
-- payments.created_by & audit_logs.actor_id, tapi ternyata ada beberapa FK
-- lain yang sama persis masalahnya — nunjuk ke payments/invoices TANPA
-- cascade, padahal invoices.tenant_id & payments.tenant_id sendiri udah
-- cascade dari profiles. Begitu penghuni yang tagihannya udah LUNAS (bikin
-- payment_allocations) atau yang pernah pakai voucher (bikin voucher_usages)
-- atau yang punya deposit dari kelebihan bayar (bikin deposits.source_payment_id)
-- dihapus, cascade-delete invoices/payments-nya diblokir FK ini — sama persis
-- pola bug yang udah kejadian 2x sebelumnya. Baris-baris ini nggak ada
-- gunanya lagi kalau invoice/payment yang dirujuknya udah hilang, jadi wajar
-- ikut kehapus.
alter table public.payment_allocations drop constraint payment_allocations_invoice_id_fkey;
alter table public.payment_allocations add constraint payment_allocations_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id) on delete cascade;

alter table public.voucher_usages drop constraint voucher_usages_payment_id_fkey;
alter table public.voucher_usages add constraint voucher_usages_payment_id_fkey
  foreign key (payment_id) references public.payments(id) on delete cascade;

alter table public.voucher_usages drop constraint voucher_usages_invoice_id_fkey;
alter table public.voucher_usages add constraint voucher_usages_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id) on delete cascade;

alter table public.deposits drop constraint deposits_source_payment_id_fkey;
alter table public.deposits add constraint deposits_source_payment_id_fkey
  foreign key (source_payment_id) references public.payments(id) on delete cascade;
