import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Get_supabase_client } from "./Superbase";
import { Use_user_id } from "./Auth_context.jsx";

const household_context = createContext({
  household: null,
  Household_name: null,
  Is_member: false,
  Loading: false,
  refresh: () => {},
});

export function Household_provider({ children }) {
  const user_id = Use_user_id();
  const [household, setHousehold] = useState(null);
  const [Loading, Set_loading] = useState(false);

  const Fetch_household = useCallback(async () => {
    if (!user_id) {
      setHousehold(null);
      return;
    }
    Set_loading(true);
    try {
      const supabase = Get_supabase_client();
      const { data: membership, error } = await supabase
        .from("household_members")
        .select("household_id, households(id, name, Invite_code)")
        .eq("user_id", user_id)
        .maybeSingle();

      if (error || !membership) {
        setHousehold(null);
      } else {
        setHousehold(membership.households);
      }
    } catch {
      setHousehold(null);
    }
    Set_loading(false);
  }, [user_id]);

  useEffect(() => {
    Fetch_household();
  }, [Fetch_household]);

  const value = {
    household,
    Household_name: household?.name || null,
    Is_member: !!household,
    Loading,
    refresh: Fetch_household,
  };

  return (
    <household_context.Provider value={value}>
      {children}
    </household_context.Provider>
  );
}

export function Use_household() {
  return useContext(household_context);
}
