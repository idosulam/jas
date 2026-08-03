import "./Fitness.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase";
import { Use_user_id } from "../../../Lib/Auth_context.jsx";
import { Use_household } from "../../../Lib/Household_context.jsx";

import Page_header from "../../../Components/UI/Page_header";
import Tab_toggle from "../../../Components/UI/Tab_toggle";
import Workout_logger from "./Workout_logger";
import Diet_tracker from "./Diet_tracker";

const SUB_TABS = [
  { id: "workouts", label: "Workouts" },
  { id: "diet", label: "Diet" },
];

function Fitness() {
  const user_id = Use_user_id();
  const { Household_name } = Use_household();
  const [activeTab, setActiveTab] = useState("workouts");
  const [profileData, setProfileData] = useState(null);
  const tabRef = useRef(null);
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });

  // Fetch profile data for BMR/macro calculations
  const Fetch_profile = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = Get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("profile")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .maybeSingle();
      if (!fetch_error && data) {
        // Fetch latest weight
        const { data: weightData } = await supabase
          .from("weight_entries")
          .select("weight_kg")
          .eq("user_id", user_id)
          .order("entry_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        setProfileData({
          ...data,
          Weight_kg: weightData?.weight_kg ?? data?.goal_weight_kg ?? null,
        });
      }
    } catch {
      // silent — BMR dashboard will show setup prompt
    }
  }, [user_id]);

  useEffect(() => {
    Fetch_profile();
  }, [Fetch_profile]);

  // Sliding indicator for sub-tabs
  const updateTabIndicator = useCallback(() => {
    const container = tabRef.current;
    if (!container) return;
    const active = container.querySelector(".tab-toggle__btn--active");
    if (!active) return;
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    setTabIndicator({
      left: aRect.left - cRect.left,
      width: aRect.width,
    });
  }, [activeTab]);

  useEffect(() => {
    const id = requestAnimationFrame(updateTabIndicator);
    window.addEventListener("resize", updateTabIndicator);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", updateTabIndicator);
    };
  }, [updateTabIndicator]);

  return (
    <section className="fitness page">
      <Page_header
        eyebrow={
          Household_name ? `Fitness · ${Household_name}` : "Fitness tracker"
        }
        title="Fitness"
        className="fitness__header animate-in"
      />

      {/* Sub-tab toggle */}
      <Tab_toggle
        options={SUB_TABS.map((tab) => ({
          ...tab,
          controlId: `fitness-panel-${tab.id}`,
        }))}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Fitness sections"
        indicator={tabIndicator}
        setIndicator={setTabIndicator}
        containerRef={tabRef}
      />

      {/* Sub-tab content */}
      <div
        id="fitness-panel-workouts"
        role="tabpanel"
        hidden={activeTab !== "workouts"}
      >
        {activeTab === "workouts" && <Workout_logger />}
      </div>
      <div
        id="fitness-panel-diet"
        role="tabpanel"
        hidden={activeTab !== "diet"}
      >
        {activeTab === "diet" && <Diet_tracker profileData={profileData} />}
      </div>
    </section>
  );
}

export default Fitness;
