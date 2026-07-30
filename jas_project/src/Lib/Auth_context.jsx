import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./Superbase.jsx";

const auth_context = createContext({
  session: null,
  user: null,
  user_id: null,
  Loading: true,
});

export function Auth_provider({ children }) {
  const [session, setSession] = useState(null);
  const [Loading, Set_loading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      Set_loading(false);
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
      Set_loading(false);
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
    <auth_context.Provider value={{ session, user, user_id, Loading }}>
      {children}
    </auth_context.Provider>
  );
}

export function Use_auth() {
  return useContext(auth_context);
}

export function Use_user_id() {
  const { user_id } = Use_auth();
  return user_id;
}
