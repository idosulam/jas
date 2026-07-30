import "./household.css";
import "./household_spendee.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get_supabase_client } from "../../../lib/superbase";
import { use_user_id } from "../../../lib/auth_context.jsx";
import { get_user_facing_error } from "../../../lib/security";
import { use_glass_toast } from "../../../lib/glass_toast_provider.jsx";
import { use_body_scroll_lock, use_modal } from "../../../Hooks";
import ConfirmModal from "../../UI/modals/confirm_modal";
import PageHeader from "../../UI/page_header";
import LoadingSkeleton from "../../UI/loading_skeleton";
import SavingsGoals from "./savings_goals";
import Transactions from "./transactions";
import RecurringTransactions from "./recurring_transactions";
import Analytics from "./analytics";
import Budgets from "./budgets";
import HouseholdInvite from "./household_invite";
import HouseholdStats from "./household_stats";
import HouseholdShiftList from "./household_shift_list";

import "./budgets.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "transactions", label: "Transactions", icon: "💳" },
  { id: "budgets", label: "Budgets", icon: "💰" },
  { id: "recurring", label: "Recurring", icon: "🔄" },
  { id: "analytics", label: "Analytics", icon: "📈" },
];

function Household() {
  const user_id = use_user_id();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberShifts, setMemberShifts] = useState([]);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState(null);
  const [todayShifts, setTodayShifts] = useState([]);

  const [workplaces, set_workplaces] = useState({});
  const [activeTab, setActiveTab] = useState("overview");

  // Sliding tab indicator — uses callback refs for instant positioning
  const tabNavRef = useRef(null);
  const tabBtnRefs = useRef({});
  const [tabIndicatorStyle, setTabIndicatorStyle] = useState({
    left: 0,
    width: 0,
  });
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const calcTabIndicator = useCallback(() => {
    const btn = tabBtnRefs.current[activeTabRef.current];
    const container = tabNavRef.current;
    if (btn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      if (btnRect.width > 0) {
        setTabIndicatorStyle({
          left: btnRect.left - containerRect.left,
          width: btnRect.width,
        });
      }
    }
  }, []);

  const tabBtnRef = useCallback(
    (el, tabId) => {
      if (el) {
        tabBtnRefs.current[tabId] = el;
        // Recalculate when any tab button mounts
        requestAnimationFrame(calcTabIndicator);
      }
    },
    [calcTabIndicator],
  );

  useEffect(() => {
    calcTabIndicator();
  }, [activeTab, calcTabIndicator]);

  useEffect(() => {
    window.addEventListener("resize", calcTabIndicator);
    return () => window.removeEventListener("resize", calcTabIndicator);
  }, [calcTabIndicator]);

  // Goals/Budgets sub-view toggle — same callback ref pattern
  const [savingsSubView, setSavingsSubView] = useState("goals");
  const savingsToggleRef = useRef(null);
  const savingsBtnRefs = useRef({});
  const [savingsIndicatorStyle, setSavingsIndicatorStyle] = useState({
    left: 0,
    width: 0,
  });
  const savingsSubViewRef = useRef(savingsSubView);
  savingsSubViewRef.current = savingsSubView;

  const calcSavingsIndicator = useCallback(() => {
    const btn = savingsBtnRefs.current[savingsSubViewRef.current];
    const container = savingsToggleRef.current;
    if (btn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      if (btnRect.width > 0) {
        setSavingsIndicatorStyle({
          left: btnRect.left - containerRect.left,
          width: btnRect.width,
        });
      }
    }
  }, []);

  const savingsBtnRef = useCallback(
    (el, viewId) => {
      if (el) {
        savingsBtnRefs.current[viewId] = el;
        requestAnimationFrame(calcSavingsIndicator);
      }
    },
    [calcSavingsIndicator],
  );

  useEffect(() => {
    calcSavingsIndicator();
  }, [savingsSubView, household, calcSavingsIndicator]);

  useEffect(() => {
    window.addEventListener("resize", calcSavingsIndicator);
    return () => window.removeEventListener("resize", calcSavingsIndicator);
  }, [calcSavingsIndicator]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [goals, setGoals] = useState([]);
  const { success: toast_success, error: toast_error } = use_glass_toast();

  const joinModal = use_modal(260);
  const createModal = use_modal(260);
  const delete_modal = use_modal(260);
  const [deleting, set_deleting] = useState(false);

  use_body_scroll_lock(joinModal.open, createModal.open, delete_modal.open);

  // Fetch household membership
  const fetch_household = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = get_supabase_client();
      const { data: membership, error: memError } = await supabase
        .from("household_members")
        .select(
          "household_id, role, households(id, name, invite_code, created_by)",
        )
        .eq("user_id", user_id)
        .maybeSingle();

      if (memError) throw memError;

      if (!membership) {
        setHousehold(null);
        setMembers([]);
        set_loading(false);
        return;
      }

      const hh = membership.households;
      setHousehold(hh);

      const { data: memberData, error: memberError } = await supabase
        .from("household_members")
        .select("user_id, role, joined_at")
        .eq("household_id", hh.id);

      if (memberError) throw memberError;

      const memberUserIds = (memberData || []).map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profile")
        .select("user_id, display_name")
        .in("user_id", memberUserIds);

      const profileMap = {};
      (profiles || []).forEach((p) => {
        profileMap[p.user_id] = p.display_name;
      });

      const enrichedMembers = (memberData || []).map((m) => ({
        ...m,
        display_name: profileMap[m.user_id] || "User",
        is_me: m.user_id === user_id,
      }));

      setMembers(enrichedMembers);
    } catch (err) {
      set_error(get_user_facing_error(err.message));
    }
  }, [user_id]);

  // Fetch shifts
  const fetchMemberShifts = useCallback(async () => {
    if (!user_id || !household) return;
    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    try {
      const supabase = get_supabase_client();
      const memberIds = members.map((m) => m.user_id);
      if (memberIds.length === 0) return;

      const { data: shifts, error: shiftError } = await supabase
        .from("shifts")
        .select("*")
        .in("user_id", memberIds)
        .gte("shift_date", startDate)
        .lte("shift_date", endDate)
        .order("shift_date", { ascending: true });

      if (shiftError) throw shiftError;

      const enriched = (shifts || []).map((s) => {
        const member = members.find((m) => m.user_id === s.user_id);
        return {
          ...s,
          display_name: member?.display_name || "User",
          is_me: s.user_id === user_id,
        };
      });

      setMemberShifts(enriched);
      setTodayShifts(enriched.filter((s) => s.shift_date === today));
    } catch (err) {
      set_error(get_user_facing_error(err.message));
    }
  }, [user_id, household, members, month, year]);

  // Fetch workplaces
  const fetch_workplaces = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = get_supabase_client();
      const memberIds = members.map((m) => m.user_id);
      if (memberIds.length === 0) return;

      const { data } = await supabase
        .from("workplaces")
        .select("slug, label, rate, color, user_id")
        .in("user_id", memberIds);

      const wpMap = {};
      (data || []).forEach((wp) => {
        if (!wpMap[wp.user_id]) wpMap[wp.user_id] = {};
        wpMap[wp.user_id][wp.slug] = {
          label: wp.label,
          rate: Number(wp.rate),
          color: wp.color,
        };
      });
      set_workplaces(wpMap);
    } catch {
      /* silent */
    }
  }, [user_id, members]);

  // Fetch transactions for analytics (full month)
  const fetchAllTransactions = useCallback(async () => {
    if (!household) return;
    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    try {
      const supabase = get_supabase_client();
      const { data, error } = await supabase
        .from("transactions")
        .select("*, transaction_categories(name, icon, color)")
        .eq("household_id", household.id)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .order("transaction_date", { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((t) => {
        const member = members.find((m) => m.user_id === t.user_id);
        return {
          ...t,
          display_name: member?.display_name || "User",
          is_me: t.user_id === user_id,
          category_name: t.transaction_categories?.name || "Other",
          category_icon: t.transaction_categories?.icon || "📦",
          category_color: t.transaction_categories?.color || "#6b7280",
        };
      });

      setAllTransactions(enriched);
    } catch {
      /* silent */
    }
  }, [household, members, user_id, month, year]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!household) return;
    try {
      const supabase = get_supabase_client();
      const { data, error } = await supabase
        .from("transaction_categories")
        .select("*")
        .eq("household_id", household.id)
        .order("name");
      if (error) throw error;
      setCategories(data ?? []);
    } catch {
      /* silent */
    }
  }, [household]);

  // Fetch savings goals
  const fetch_goals = useCallback(async () => {
    if (!household) return;
    try {
      const supabase = get_supabase_client();
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("household_id", household.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setGoals(data ?? []);
    } catch {
      /* silent */
    }
  }, [household]);

  useEffect(() => {
    fetch_household();
  }, [fetch_household]);

  useEffect(() => {
    if (household && members.length > 0) {
      fetchMemberShifts();
      fetch_workplaces();
      fetchAllTransactions();
      fetchCategories();
      fetch_goals();
      set_loading(false);
    }
  }, [
    household,
    members,
    fetchMemberShifts,
    fetch_workplaces,
    fetchAllTransactions,
    fetchCategories,
    fetch_goals,
  ]);

  // Calculate combined stats
  const combined_stats = useMemo(() => {
    const stats = {};
    let totalHours = 0,
      totalPay = 0,
      totalTips = 0;

    members.forEach((member) => {
      const memberShiftsFiltered = memberShifts.filter(
        (s) => s.user_id === member.user_id,
      );
      const wp = workplaces[member.user_id] || {};
      let mHours = 0,
        mPay = 0,
        mTips = 0;

      memberShiftsFiltered.forEach((shift) => {
        const hours = parseFloat(shift.hours) || 0;
        const tips = parseFloat(shift.tips) || 0;
        const rate =
          shift.pay_type === "tips_only" ? 0 : (wp[shift.place]?.rate ?? 0);
        mHours += hours;
        mPay += rate * hours;
        mTips += tips;
      });

      stats[member.user_id] = {
        display_name: member.display_name,
        is_me: member.is_me,
        hours: mHours,
        pay: mPay,
        tips: mTips,
        total: mPay + mTips,
        shiftCount: memberShiftsFiltered.length,
      };

      totalHours += mHours;
      totalPay += mPay;
      totalTips += mTips;
    });

    return {
      byMember: stats,
      combined: {
        hours: totalHours,
        pay: totalPay,
        tips: totalTips,
        total: totalPay + totalTips,
        shiftCount: memberShifts.length,
      },
    };
  }, [memberShifts, members, workplaces]);

  // Transaction summary for overview
  const tx_summary = useMemo(() => {
    let totalExpense = 0,
      totalIncome = 0;
    allTransactions.forEach((t) => {
      if (t.type === "expense") totalExpense += Number(t.amount);
      else totalIncome += Number(t.amount);
    });
    return { totalExpense, totalIncome, balance: totalIncome - totalExpense };
  }, [allTransactions]);

  // Budget overview for summary cards
  const budget_overview = useMemo(() => {
    const expenseCats = categories.filter(
      (c) => c.type === "expense" && c.budget_amount != null,
    );
    if (expenseCats.length === 0) return null;

    let totalBudget = 0;
    let totalSpent = 0;
    const alerts = [];

    expenseCats.forEach((cat) => {
      const budget = Number(cat.budget_amount);
      const spent = allTransactions
        .filter((t) => t.type === "expense" && t.category_id === cat.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      totalBudget += budget;
      totalSpent += spent;

      const pct = budget > 0 ? (spent / budget) * 100 : 0;
      if (pct >= 80) {
        alerts.push({
          name: cat.name,
          icon: cat.icon,
          color: cat.color,
          pct,
          over: pct >= 100,
        });
      }
    });

    alerts.sort((a, b) => b.pct - a.pct);

    return {
      totalBudget,
      totalSpent,
      remaining: totalBudget - totalSpent,
      progress:
        totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0,
      alerts: alerts.slice(0, 3),
    };
  }, [categories, allTransactions]);

  // Chart data
  const chart_data = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const data = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayShifts = memberShifts.filter((s) => s.shift_date === dateStr);
      const entry = { date: dateStr, day: d };
      let dayTotal = 0;
      members.forEach((member) => {
        const wp = workplaces[member.user_id] || {};
        const mShifts = dayShifts.filter((s) => s.user_id === member.user_id);
        let earnings = 0;
        mShifts.forEach((shift) => {
          const hours = parseFloat(shift.hours) || 0;
          const tips = parseFloat(shift.tips) || 0;
          const rate =
            shift.pay_type === "tips_only" ? 0 : (wp[shift.place]?.rate ?? 0);
          earnings += rate * hours + tips;
        });
        entry[member.user_id] = earnings;
        dayTotal += earnings;
      });
      entry.total = dayTotal;
      data.push(entry);
    }
    return data;
  }, [memberShifts, members, workplaces, month, year]);



  const navigateToTransactions = () => setActiveTab("transactions");

  const handle_delete = async () => {
    if (!household) return;
    set_deleting(true);
    try {
      const supabase = get_supabase_client();
      const { error } = await supabase.rpc("delete_household", {
        household_id_param: household.id,
      });
      if (error) throw error;
      delete_modal.close_modal();
      toast_success("Household deleted.");
      setHousehold(null);
      setMembers([]);
      setMemberShifts([]);
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    set_deleting(false);
  };

  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 11 }, (_, i) => current - 5 + i);
  }, []);

  // No household state
  if (!loading && !household) {
    return (
      <section className="household page">
        <PageHeader
          eyebrow="Together"
          title="Household"
          className="household__header animate-in"
        />
        <HouseholdInvite
          household={null}
          members={[]}
          joinModal={joinModal}
          createModal={createModal}
          delete_modal={delete_modal}
          fetch_household={fetch_household}
          deleting={deleting}
          handle_delete={handle_delete}
        />
      </section>
    );
  }

  if (loading) {
    return (
      <section className="household page">
        <PageHeader
          eyebrow="Together"
          title="Household"
          className="household__header"
        />
        <LoadingSkeleton lines={6} />
      </section>
    );
  }

  return (
    <section className="household page">
      {/* Header */}
      <PageHeader
        eyebrow="Together"
        title={household?.name || "Household"}
        className="household__header animate-in"
      />

      {/* Invite + Delete */}
      <HouseholdInvite
        household={household}
        members={members}
        joinModal={joinModal}
        createModal={createModal}
        delete_modal={delete_modal}
        fetch_household={fetch_household}
        deleting={deleting}
        handle_delete={handle_delete}
      />

      {/* Error */}
      {error && <div className="household__error">{error}</div>}

      {/* Tab Navigation */}
      <div
        className="household__tab-nav animate-in animate-in--2"
        ref={tabNavRef}
      >
        <span
          className="household__tab-indicator"
          style={{
            transform: `translateX(${tabIndicatorStyle.left}px)`,
            width: `${tabIndicatorStyle.width}px`,
          }}
        />
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => tabBtnRef(el, tab.id)}
            className={`household__tab ${activeTab === tab.id ? "household__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="household__tab-icon">{tab.icon}</span>
            <span className="household__tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Month/Year Filter (shared across tabs) */}
      <div className="household__filters animate-in animate-in--3">
        <div className="household__filter">
          <label>Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="household__filter">
          <label>Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Content */}
      <div className="household__tab-content animate-in animate-in--4">
        {activeTab === "overview" && (
          <>
            {/* Transaction Summary + Budget + Shift Stats */}
            {allTransactions.length > 0 && (
              <HouseholdStats
                tx_summary={tx_summary}
                budget_overview={budget_overview}
                combined_stats={combined_stats}
                members={members}
              />
            )}
            {allTransactions.length === 0 && (
              <HouseholdStats
                tx_summary={null}
                budget_overview={budget_overview}
                combined_stats={combined_stats}
                members={members}
              />
            )}

            {/* Today's Shifts + Earnings Chart */}
            <HouseholdShiftList
              todayShifts={todayShifts}
              workplaces={workplaces}
              chart_data={chart_data}
              members={members}
              month={month}
              year={year}
            />

            {/* Savings Goals / Budgets Toggle */}
            <div className="household__savings-section">
              <div
                className="household__goals-budgets-toggle"
                ref={savingsToggleRef}
              >
                <span
                  className={`household__goals-budgets-indicator ${savingsSubView}`}
                  style={{
                    transform: `translateX(${savingsIndicatorStyle.left}px)`,
                    width: `${savingsIndicatorStyle.width}px`,
                  }}
                />
                <button
                  ref={(el) => savingsBtnRef(el, "goals")}
                  className={`household__goals-budgets-btn ${savingsSubView === "goals" ? "household__goals-budgets-btn--active goals" : ""}`}
                  onClick={() => setSavingsSubView("goals")}
                >
                  💰 Goals
                </button>
                <button
                  ref={(el) => savingsBtnRef(el, "budgets")}
                  className={`household__goals-budgets-btn ${savingsSubView === "budgets" ? "household__goals-budgets-btn--active budgets" : ""}`}
                  onClick={() => setSavingsSubView("budgets")}
                >
                  📊 Budgets
                </button>
              </div>

              {savingsSubView === "goals" && (
                <SavingsGoals
                  householdId={household?.id}
                  user_id={user_id}
                  members={members}
                  hideTitle
                />
              )}
              {savingsSubView === "budgets" && (
                <Budgets
                  householdId={household?.id}
                  transactions={allTransactions}
                  month={month}
                  year={year}
                  onNavigateToTransactions={navigateToTransactions}
                />
              )}
            </div>
          </>
        )}

        {activeTab === "transactions" && (
          <Transactions
            householdId={household?.id}
            user_id={user_id}
            members={members}
            goals={goals}
          />
        )}

        {activeTab === "budgets" && (
          <Budgets
            householdId={household?.id}
            transactions={allTransactions}
            month={month}
            year={year}
            onNavigateToTransactions={navigateToTransactions}
          />
        )}

        {activeTab === "recurring" && (
          <RecurringTransactions
            householdId={household?.id}
            user_id={user_id}
            categories={categories}
          />
        )}

        {activeTab === "analytics" && (
          <Analytics
            transactions={allTransactions}
            members={members}
            month={month}
            year={year}
          />
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={delete_modal.open}
        closing={delete_modal.closing}
        onClose={() => delete_modal.close_modal()}
        title="Delete household"
        message="This will permanently delete the household, all savings goals, and shared data. Members' shifts won't be affected."
        confirmText={deleting ? "Deleting…" : "Delete"}
        onConfirm={handle_delete}
        danger
      />
    </section>
  );
}

export default Household;
