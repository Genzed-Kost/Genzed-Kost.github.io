// Dipanggil harian oleh pg_cron. Cek tagihan yang jatuh tempo H-7/H-3/H-1/H-0,
// simpan notifikasi ke dashboard, dan kirim pengingat via WhatsApp.
// Endpoint ini TIDAK untuk dipanggil dari klien — proteksi lewat CRON_SECRET.
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";
import { jsonResponse } from "../_shared/cors.ts";

const MILESTONES = [
  { daysBefore: 7, label: "H-7" },
  { daysBefore: 3, label: "H-3" },
  { daysBefore: 1, label: "H-1" },
  { daysBefore: 0, label: "hari ini" },
];

function jakartaDateString(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

function jakartaTodayStartISO(): string {
  return `${jakartaDateString(0)}T00:00:00+07:00`;
}

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "Tidak diizinkan." }, 401);
  }

  const admin = getSupabaseAdmin();
  let totalSent = 0;

  try {
    for (const milestone of MILESTONES) {
      const targetDate = jakartaDateString(milestone.daysBefore);

      const { data: invoices, error: invErr } = await admin
        .from("invoices")
        .select("id, invoice_number, due_date, total, paid_total, tenant_id, profiles(full_name, phone)")
        .in("status", ["TERBIT", "SEBAGIAN_DIBAYAR", "JATUH_TEMPO"])
        .eq("due_date", targetDate);

      if (invErr) continue;

      for (const inv of invoices ?? []) {
        const sisa = Number(inv.total) - Number(inv.paid_total);
        if (sisa <= 0) continue;

        const tenant = inv.profiles as unknown as { full_name: string; phone: string } | null;
        if (!tenant) continue;

        const title = `Tagihan ${inv.invoice_number} jatuh tempo ${milestone.label}`;

        const { data: existing } = await admin
          .from("notifications")
          .select("id")
          .eq("tenant_id", inv.tenant_id)
          .eq("title", title)
          .gte("created_at", jakartaTodayStartISO())
          .maybeSingle();
        if (existing) continue;

        const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(sisa);
        const body =
          milestone.daysBefore === 0
            ? `Tagihan ${inv.invoice_number} sebesar ${rupiah} jatuh tempo HARI INI. Yuk segera bayar biar nggak kena denda.`
            : `Tagihan ${inv.invoice_number} sebesar ${rupiah} jatuh tempo dalam ${milestone.daysBefore} hari (${inv.due_date}).`;

        await admin.from("notifications").insert({
          tenant_id: inv.tenant_id,
          channel: "whatsapp",
          category: "jatuh_tempo",
          title,
          body,
          send_status: "PENDING",
        });

        try {
          await sendWhatsApp(tenant.phone, `Halo ${tenant.full_name}! 👋\n\n${body}`);
          await admin
            .from("notifications")
            .update({ send_status: "TERKIRIM", sent_at: new Date().toISOString() })
            .eq("tenant_id", inv.tenant_id)
            .eq("title", title);
        } catch {
          await admin.from("notifications").update({ send_status: "GAGAL" }).eq("tenant_id", inv.tenant_id).eq("title", title);
        }

        totalSent += 1;
      }
    }

    return jsonResponse({ ok: true, total_sent: totalSent });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
