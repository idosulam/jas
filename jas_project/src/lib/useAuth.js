import { useState, useEffect } from "react";
import { supabase } from "./superbase.jsx";

/**
 * Returns the current Supabase auth session and user.
 * { session, user, loading }
 * user is null when not logged in or when Supabase is not configured.
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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
 *   const userId = useUserId();
 *   if (!userId) return;
 */
export function useUserId() {
  const { user } = useAuth();
  return user?.id ?? null;
}
