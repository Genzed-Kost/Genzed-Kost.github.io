// Langkah 2 aktivasi: verifikasi OTP, lalu keluarkan token recovery Supabase
// agar klien bisa login dan langsung set password baru.
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { sha256Hex } from "../_shared/crypto.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const { phone, otp } = await req.json();
    if (!phone || !otp) {
      return jsonResponse({ error: "Nomor HP dan kode OTP wajib diisi." }, 400);
    }

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email")
      .eq("phone", phone)
      .maybeSingle();
    if (!profile) {
      return jsonResponse({ error: "Nomor HP tidak ditemukan." }, 404);
    }

    const { data: invite } = await admin
      .from("invites")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("status", "OTP_TERKIRIM")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invite) {
      return jsonResponse({ error: "Tidak ada OTP aktif. Ulangi proses aktivasi." }, 404);
    }
    if (!invite.otp_expires_at || new Date(invite.otp_expires_at) < new Date()) {
      return jsonResponse({ error: "OTP sudah kedaluwarsa. Ulangi proses aktivasi." }, 410);
    }
    if (invite.attempt_count >= MAX_ATTEMPTS) {
      return jsonResponse({ error: "Terlalu banyak percobaan. Hubungi admin kost." }, 429);
    }

    const inputHash = await sha256Hex(otp);
    if (inputHash !== invite.otp_code_hash) {
      await admin
        .from("invites")
        .update({ attempt_count: invite.attempt_count + 1 })
        .eq("id", invite.id);
      return jsonResponse({ error: "Kode OTP salah." }, 400);
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
    });
    if (linkErr || !link) {
      return jsonResponse({ error: linkErr?.message ?? "Gagal membuat sesi aktivasi." }, 400);
    }

    await admin
      .from("invites")
      .update({ status: "AKTIF", activated_at: new Date().toISOString() })
      .eq("id", invite.id);

    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "activate_account",
      target_table: "profiles",
      target_id: profile.id,
      metadata: {},
    });

    return jsonResponse({
      ok: true,
      token_hash: link.properties.hashed_token,
      email: profile.email,
    });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
