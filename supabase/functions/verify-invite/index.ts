// Langkah 1 aktivasi: penghuni masukkan No HP + kode undangan.
// Jika valid, sistem generate OTP baru dan kirim via WhatsApp.
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generateNumericCode, sha256Hex } from "../_shared/crypto.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const { phone, invite_code } = await req.json();
    if (!phone || !invite_code) {
      return jsonResponse({ error: "Nomor HP dan kode undangan wajib diisi." }, 400);
    }

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (!profile) {
      return jsonResponse({ error: "Nomor HP tidak ditemukan. Hubungi admin kost." }, 404);
    }

    const { data: invite } = await admin
      .from("invites")
      .select("*")
      .eq("profile_id", profile.id)
      .in("status", ["MENUNGGU_AKTIVASI", "OTP_TERKIRIM"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invite) {
      return jsonResponse({ error: "Undangan tidak ditemukan atau sudah dipakai." }, 404);
    }
    if (new Date(invite.expires_at) < new Date()) {
      await admin.from("invites").update({ status: "KEDALUWARSA" }).eq("id", invite.id);
      return jsonResponse({ error: "Kode undangan sudah kedaluwarsa. Hubungi admin kost." }, 410);
    }
    if (invite.attempt_count >= MAX_ATTEMPTS) {
      return jsonResponse({ error: "Terlalu banyak percobaan. Hubungi admin kost." }, 429);
    }

    const inputHash = await sha256Hex(invite_code);
    if (inputHash !== invite.invite_code_hash) {
      await admin
        .from("invites")
        .update({ attempt_count: invite.attempt_count + 1 })
        .eq("id", invite.id);
      return jsonResponse({ error: "Kode undangan salah." }, 400);
    }

    const otp = generateNumericCode(6);
    const otpHash = await sha256Hex(otp);
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await admin
      .from("invites")
      .update({
        otp_code_hash: otpHash,
        otp_expires_at: otpExpiresAt.toISOString(),
        status: "OTP_TERKIRIM",
        attempt_count: 0,
      })
      .eq("id", invite.id);

    await sendWhatsApp(
      phone,
      `Kode OTP aktivasi akun Genzed Kost lo: *${otp}*\nBerlaku ${OTP_TTL_MINUTES} menit. Jangan kasih kode ini ke siapa pun ya.`
    );

    return jsonResponse({ ok: true, message: "OTP terkirim via WhatsApp." });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
