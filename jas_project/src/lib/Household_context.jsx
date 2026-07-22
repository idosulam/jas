import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "./superbase";
import { useUserId } from "./Auth_context.jsx";

const HouseholdContext = createContext({
  household: null,
  householdName: null,
  isMember: false,
  loading: false,
  refresh: () => {},
});

export function HouseholdProvider({ children }) {
  const userId = useUserId();
  const [household, setHousehold] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchHousehold = useCallback(async () => {
    if (!userId) {
      setHousehold(null);
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: membership, error } = await supabase
        .from("household_members")
        .select("household_id, households(id, name, invite_code)")
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !membership) {
        setHousehold(null);
      } else {
        setHousehold(membership.households);
      }
    } catch {
      setHousehold(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchHousehold();
  }, [fetchHousehold]);

  const value = {
    household,
    householdName: household?.name || null,
    isMember: !!household,
    loading,
    refresh: fetchHousehold,
  };

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  return useContext(HouseholdContext);
}
