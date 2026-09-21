// Login bisa pakai email ATAU nomor HP. Fungsi ini menerjemahkan
// nomor HP -> email supaya klien tetap pakai signInWithPassword({email}).
import { getSupabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const { identifier } = await req.json();
    if (!identifier) {
      return jsonResponse({ error: "identifier wajib diisi." }, 400);
    }

    if (isEmail(identifier)) {
      return jsonResponse({ email: identifier });
    }

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("phone", identifier)
      .maybeSingle();

    // Selalu balas 200 walau tidak ketemu, supaya tidak bocorin data akun mana yang terdaftar.
    return jsonResponse({ email: profile?.email ?? null });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
