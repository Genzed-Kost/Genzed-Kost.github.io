import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function functionsUrl(name: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
}
