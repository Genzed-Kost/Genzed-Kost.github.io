// Dipanggil berkala oleh pg_cron. Tandai transaksi yang belum diselesaikan
// (MENUNGGU) tapi sudah lewat batas waktu sebagai KEDALUWARSA.
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "Tidak diizinkan." }, 401);
  }

  const admin = getSupabaseAdmin();
  try {
    const { data, error } = await admin
      .from("payments")
      .update({ status: "KEDALUWARSA" })
      .eq("status", "MENUNGGU")
      .lt("expires_at", new Date().toISOString())
      .select("id");
    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ ok: true, expired: data?.length ?? 0 });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
