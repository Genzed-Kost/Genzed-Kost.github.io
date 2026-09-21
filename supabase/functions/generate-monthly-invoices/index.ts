// Dipanggil harian oleh pg_cron. Untuk tiap kontrak sewa aktif, cek apakah
// sudah waktunya terbitkan tagihan periode berikutnya (dengan prorata otomatis
// kalau penghuni baru masuk/mau keluar di tengah periode).
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { calculateSewaAmount, computePeriodEnd, cycleMonths, formatInvoiceNumber, type BillingCycle } from "../_shared/billing.ts";

const DEFAULT_LEAD_DAYS = 5;
const DEFAULT_DUE_DAYS = 5;

function jakartaToday(): Date {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  return new Date(`${s}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "Tidak diizinkan." }, 401);
  }

  const admin = getSupabaseAdmin();
  const today = jakartaToday();
  let createdCount = 0;

  try {
    const { data: settingsRows } = await admin
      .from("settings")
      .select("key, value")
      .in("key", ["invoice_lead_days", "invoice_due_days_after_period_start"]);
    const settingsMap = new Map((settingsRows ?? []).map((r) => [r.key, r.value]));
    const leadDays = Number(settingsMap.get("invoice_lead_days") ?? DEFAULT_LEAD_DAYS);
    const dueDays = Number(settingsMap.get("invoice_due_days_after_period_start") ?? DEFAULT_DUE_DAYS);

    const { data: tenancies, error: tenErr } = await admin
      .from("tenancies")
      .select("id, tenant_id, room_id, billing_cycle, monthly_rate, start_date, end_date, status, rooms(room_number, room_types(name)), profiles(full_name, phone)")
      .eq("status", "AKTIF");
    if (tenErr) return jsonResponse({ error: tenErr.message }, 500);

    for (const tenancy of tenancies ?? []) {
      const { data: lastInvoice } = await admin
        .from("invoices")
        .select("period_end")
        .eq("tenancy_id", tenancy.id)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      const periodStart = lastInvoice ? addDays(new Date(`${lastInvoice.period_end}T00:00:00.000Z`), 1) : new Date(`${tenancy.start_date}T00:00:00.000Z`);
      const tenancyEnd = tenancy.end_date ? new Date(`${tenancy.end_date}T00:00:00.000Z`) : null;

      if (tenancyEnd && periodStart > tenancyEnd) continue; // kontrak sudah lunas sampai berakhir
      if (periodStart > addDays(today, leadDays)) continue; // belum waktunya terbitkan

      const periodEndFull = computePeriodEnd(periodStart, tenancy.billing_cycle as BillingCycle);
      const periodEnd = tenancyEnd && tenancyEnd < periodEndFull ? tenancyEnd : periodEndFull;

      const { data: exists } = await admin
        .from("invoices")
        .select("id")
        .eq("tenancy_id", tenancy.id)
        .eq("period_start", toDateOnlyString(periodStart))
        .maybeSingle();
      if (exists) continue; // sudah pernah dibuat, jangan duplikat

      const fullPeriodRate = tenancy.monthly_rate * cycleMonths(tenancy.billing_cycle as BillingCycle);
      const sewa = calculateSewaAmount(fullPeriodRate, periodStart, periodEnd, new Date(`${tenancy.start_date}T00:00:00.000Z`), tenancyEnd);

      const monthKey = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
      const { count } = await admin
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .like("invoice_number", `INV-${monthKey}-%`);
      const invoiceNumber = formatInvoiceNumber(today, (count ?? 0) + 1);

      const dueDate = toDateOnlyString(addDays(periodStart, dueDays));
      const room = tenancy.rooms as unknown as { room_number: string; room_types: { name: string } } | null;
      const tenant = tenancy.profiles as unknown as { full_name: string; phone: string } | null;

      const { data: invoice, error: invInsertErr } = await admin
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          tenant_id: tenancy.tenant_id,
          tenancy_id: tenancy.id,
          period_start: toDateOnlyString(periodStart),
          period_end: toDateOnlyString(periodEnd),
          due_date: dueDate,
          status: "TERBIT",
          subtotal: sewa.amount,
          discount_total: 0,
          penalty_total: 0,
          total: sewa.amount,
          paid_total: 0,
        })
        .select("id")
        .single();
      if (invInsertErr || !invoice) continue;

      const desc = sewa.isProrated
        ? `Sewa kamar ${room?.room_number ?? ""} (${room?.room_types?.name ?? ""}) — prorata ${sewa.occupiedDays}/${sewa.totalDays} hari`
        : `Sewa kamar ${room?.room_number ?? ""} (${room?.room_types?.name ?? ""}) — periode ${toDateOnlyString(periodStart)} s/d ${toDateOnlyString(periodEnd)}`;

      await admin.from("invoice_items").insert({
        invoice_id: invoice.id,
        item_type: "SEWA_KAMAR",
        description: desc,
        quantity: 1,
        unit_price: sewa.amount,
        amount: sewa.amount,
      });

      await admin.from("audit_logs").insert({
        actor_id: null,
        action: "generate_invoice",
        target_table: "invoices",
        target_id: invoice.id,
        metadata: { invoice_number: invoiceNumber, tenancy_id: tenancy.id, prorated: sewa.isProrated },
      });

      if (tenant) {
        const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(sewa.amount);
        const body = `Tagihan baru ${invoiceNumber} sebesar ${rupiah} sudah terbit. Jatuh tempo ${dueDate}. Cek detail di portal ya.`;
        await admin.from("notifications").insert({
          tenant_id: tenancy.tenant_id,
          channel: "whatsapp",
          category: "pembayaran",
          title: `Tagihan baru: ${invoiceNumber}`,
          body,
        });
        try {
          await sendWhatsApp(tenant.phone, `Halo ${tenant.full_name}! 👋\n\n${body}`);
        } catch {
          // gagal kirim WA tidak menggagalkan pembuatan tagihan
        }
      }

      createdCount += 1;
    }

    return jsonResponse({ ok: true, created: createdCount });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
