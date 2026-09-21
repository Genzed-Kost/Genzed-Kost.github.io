// Admin membuat akun penghuni baru + kirim kode undangan via WhatsApp.
// Wajib dipanggil dengan Authorization header milik admin yang sudah login.
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generateNumericCode, sha256Hex } from "../_shared/crypto.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";

const INVITE_EXPIRY_DAYS = 3;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = getSupabaseAdmin();

    const { data: caller, error: callerErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (callerErr || !caller?.user) {
      return jsonResponse({ error: "Tidak terautentikasi." }, 401);
    }

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.user.id)
      .single();
    if (callerProfile?.role !== "admin") {
      return jsonResponse({ error: "Hanya admin yang bisa membuat undangan." }, 403);
    }

    const { full_name, email, phone } = await req.json();
    if (!full_name || !email || !phone) {
      return jsonResponse({ error: "full_name, email, dan phone wajib diisi." }, 400);
    }

    const tempPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return jsonResponse({ error: createErr?.message ?? "Gagal membuat akun." }, 400);
    }

    const { error: profileErr } = await admin.from("profiles").insert({
      id: created.user.id,
      full_name,
      email,
      phone,
      role: "penghuni",
    });
    if (profileErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return jsonResponse({ error: profileErr.message }, 400);
    }

    const inviteCode = generateNumericCode(6);
    const inviteCodeHash = await sha256Hex(inviteCode);
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const { error: inviteErr } = await admin.from("invites").insert({
      profile_id: created.user.id,
      invite_code_hash: inviteCodeHash,
      status: "MENUNGGU_AKTIVASI",
      expires_at: expiresAt.toISOString(),
      created_by: caller.user.id,
    });
    if (inviteErr) {
      return jsonResponse({ error: inviteErr.message }, 400);
    }

    const appUrl = Deno.env.get("APP_BASE_URL") ?? "https://genzed-kost.github.io";
    await sendWhatsApp(
      phone,
      `Halo ${full_name}! 👋\nAkun penghuni Genzed Kost lo udah dibuat.\n\nKode undangan: *${inviteCode}*\n(berlaku ${INVITE_EXPIRY_DAYS} hari)\n\nAktivasi di: ${appUrl}/penghuni/aktivasi`
    );

    await admin.from("audit_logs").insert({
      actor_id: caller.user.id,
      action: "create_invite",
      target_table: "profiles",
      target_id: created.user.id,
      metadata: { full_name, email, phone },
    });

    return jsonResponse({ ok: true, profile_id: created.user.id });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
