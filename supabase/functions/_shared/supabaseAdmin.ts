import { createClient } from "npm:@supabase/supabase-js@2";

// SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY otomatis tersedia di runtime Edge Functions.
export function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
