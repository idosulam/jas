import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./superbase.jsx";

const auth_context = createContext({
  session: null,
  user: null,
  user_id: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      set_loading(false);
      return;
    }

    // Get initial session and validate it
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) {
        // Validate session is actually valid (user exists, token not expired)
        const { error } = await supabase.auth.getUser();
        if (error) {
          await supabase.auth.signOut();
          setSession(null);
        } else {
          setSession(s);
        }
      } else {
        setSession(null);
      }
      set_loading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const user_id = user?.id ?? null;

  return (
    <auth_context.Provider value={{ session, user, user_id, loading }}>
      {children}
    </auth_context.Provider>
  );
}

export function use_auth() {
  return useContext(auth_context);
}

export function use_user_id() {
  const { user_id } = use_auth();
  return user_id;
}
