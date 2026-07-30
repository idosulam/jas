import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { get_supabase_client } from "./Superbase";
import { use_user_id } from "./Auth_context.jsx";

const household_context = createContext({
  household: null,
  household_name: null,
  is_member: false,
  loading: false,
  refresh: () => {},
});

export function HouseholdProvider({ children }) {
  const user_id = use_user_id();
  const [household, setHousehold] = useState(null);
  const [loading, set_loading] = useState(false);

  const fetch_household = useCallback(async () => {
    if (!user_id) {
      setHousehold(null);
      return;
    }
    set_loading(true);
    try {
      const supabase = get_supabase_client();
      const { data: membership, error } = await supabase
        .from("household_members")
        .select("household_id, households(id, name, invite_code)")
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
    set_loading(false);
  }, [user_id]);

  useEffect(() => {
    fetch_household();
  }, [fetch_household]);

  const value = {
    household,
    household_name: household?.name || null,
    is_member: !!household,
    loading,
    refresh: fetch_household,
  };

  return (
    <household_context.Provider value={value}>
      {children}
    </Household_context.Provider>
  );
}

export function use_household() {
  return useContext(household_context);
}
