import { createClient } from "@supabase/supabase-js";

const supabase_url = import.meta.env.VITE_SUPABASE_URL;
const supabase_key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const has_supabase_config = Boolean(supabase_url && supabase_key);

export const supabase = has_supabase_config
  ? createClient(supabase_url, supabase_key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: "jas-auth-token",
      },
    })
  : null;

export function get_supabase_client() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

/**
 * Get the current authenticated user's ID.
 * Returns null if not logged in or Supabase not configured.
 */
export async function get_current_user_id() {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}
