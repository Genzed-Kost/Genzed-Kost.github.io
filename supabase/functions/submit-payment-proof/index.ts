// Dipanggil setelah penghuni upload bukti transfer ke Storage (bucket payment-proofs,
// langsung dari klien lewat RLS insert-own). Fungsi ini yang mencatat baris payment_proofs
// dan mindahin status payment ke MENUNGGU_VERIFIKASI — dilakukan lewat Edge Function
// (bukan langsung dari klien) karena RLS payments sengaja update-admin-only untuk
// tabel keuangan, jadi transisi status terkontrol ini butuh service role.
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = getSupabaseAdmin();
    const { data: caller, error: callerErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (callerErr || !caller?.user) return jsonResponse({ error: "Tidak terautentikasi." }, 401);

    const { payment_id, file_path } = await req.json();
    if (!payment_id || !file_path) return jsonResponse({ error: "payment_id dan file_path wajib diisi." }, 400);

    const { data: payment } = await admin
      .from("payments")
      .select("id, tenant_id, status, method")
      .eq("id", payment_id)
      .maybeSingle();
    if (!payment || payment.tenant_id !== caller.user.id) {
      return jsonResponse({ error: "Pembayaran tidak ditemukan." }, 404);
    }
    if (!["TRANSFER_MANUAL", "QRIS_STATIS"].includes(payment.method)) {
      return jsonResponse({ error: "Metode pembayaran ini nggak butuh upload bukti." }, 400);
    }
    if (payment.status !== "MENUNGGU") {
      return jsonResponse({ error: "Pembayaran ini sudah diproses atau sudah kedaluwarsa." }, 409);
    }
    if (!file_path.startsWith(`${caller.user.id}/`)) {
      return jsonResponse({ error: "Path file tidak valid." }, 400);
    }

    await admin.from("payment_proofs").insert({
      payment_id: payment.id,
      tenant_id: caller.user.id,
      file_path,
    });

    await admin.from("payments").update({ status: "MENUNGGU_VERIFIKASI" }).eq("id", payment.id);

    await admin.from("audit_logs").insert({
      actor_id: caller.user.id,
      action: "submit_payment_proof",
      target_table: "payments",
      target_id: payment.id,
      metadata: { file_path },
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
