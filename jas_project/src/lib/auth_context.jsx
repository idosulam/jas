import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./superbase.jsx";

const AuthContext = createContext({
  session: null,
  user: null,
  userId: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
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
      setLoading(false);
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
  const userId = user?.id ?? null;

  return (
    <AuthContext.Provider value={{ session, user, userId, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useUserId() {
  const { userId } = useAuth();
  return userId;
}
