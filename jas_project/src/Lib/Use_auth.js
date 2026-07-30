import { useState, useEffect } from "react";
import { supabase } from "./Superbase.jsx";

/**
 * Returns the current Supabase auth session and user.
 * { session, user, loading }
 * user is null when not logged in or when Supabase is not configured.
 */
export function use_auth() {
  const [session, set_session] = useState(null);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      set_loading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      set_session(s);
      set_loading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      set_session(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
  };
}

/**
 * Returns the current user_id or null.
 * Convenience for queries — use in components like:
 *   const user_id = use_user_id();
 *   if (!user_id) return;
 */
export function use_user_id() {
  const { user } = use_auth();
  return user?.id ?? null;
}
