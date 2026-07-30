import "./Fitness.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase";
import { Use_user_id } from "../../../Lib/Auth_context.jsx";
import { Use_household } from "../../../Lib/Household_context.jsx";

import Page_header from "../../../Components/UI/Page_header";
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
          .select("Weight_kg")
          .eq("user_id", user_id)
          .order("Entry_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        setProfileData({
          ...data,
          Weight_kg: weightData?.Weight_kg ?? data?.goal_weight_kg ?? null,
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
    const active = container.querySelector(".fitness__tab-btn--active");
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
        eyebrow={Household_name ? `Fitness · ${Household_name}` : "Fitness tracker"}
        title="Fitness"
        className="fitness__header animate-in"
      />

      {/* Sub-tab toggle */}
      <div
        className="fitness__tabs animate-in animate-in--1"
        role="tablist"
        aria-label="Fitness sections"
        ref={tabRef}
      >
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`fitness__tab-btn${activeTab === tab.id ? " fitness__tab-btn--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`fitness-panel-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
        <span
          className="fitness__tab-indicator"
          style={{
            transform: `translateX(${tabIndicator.left}px)`,
            width: tabIndicator.width,
          }}
          aria-hidden="true"
        />
      </div>

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
