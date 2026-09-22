// Admin hapus permanen akun penghuni. PERINGATAN: karena banyak tabel
// (tenancies, invoices, payments, deposits, complaints, dll) referensi
// profiles.id dengan ON DELETE CASCADE, ini juga menghapus SELURUH riwayat
// tagihan & pembayaran penghuni itu — bukan cuma nonaktifkan akun.
// Konfirmasi tegas soal ini WAJIB ada di sisi frontend sebelum manggil ini.
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

    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", caller.user.id).single();
    if (callerProfile?.role !== "admin") return jsonResponse({ error: "Hanya admin yang bisa menghapus penghuni." }, 403);

    const { profile_id } = await req.json();
    if (!profile_id) return jsonResponse({ error: "profile_id wajib diisi." }, 400);
    if (profile_id === caller.user.id) return jsonResponse({ error: "Nggak bisa hapus akun sendiri." }, 400);

    const { data: target } = await admin.from("profiles").select("full_name, role").eq("id", profile_id).maybeSingle();
    if (!target) return jsonResponse({ error: "Penghuni tidak ditemukan." }, 404);
    if (target.role !== "penghuni") return jsonResponse({ error: "Cuma bisa hapus akun dengan role penghuni." }, 400);

    // Menghapus dari auth.users otomatis cascade ke profiles + semua tabel
    // turunannya (tenancies, invoices, payments, dst) lewat FK ON DELETE CASCADE.
    const { error: deleteErr } = await admin.auth.admin.deleteUser(profile_id);
    if (deleteErr) return jsonResponse({ error: deleteErr.message }, 500);

    await admin.from("audit_logs").insert({
      actor_id: caller.user.id,
      action: "delete_tenant",
      target_table: "profiles",
      target_id: profile_id,
      metadata: { full_name: target.full_name },
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
