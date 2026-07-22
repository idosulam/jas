import "./Household.css";
import "./HouseholdSpendee.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { useUserId } from "../../../lib/Auth_context.jsx";
import { getUserFacingError, hapticError } from "../../../lib/security";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import { useBodyScrollLock, useModal } from "../../../hooks";
import SheetModal from "../../ui/modals/Sheet_modal";
import ConfirmModal from "../../ui/modals/Confirm_modal";
import FormField from "../../ui/form/Form_field.jsx";
import PageHeader from "../../ui/Page_header";
import GlassCard from "../../ui/Glass_card";
import LoadingSkeleton from "../../ui/Loading_skeleton";
import EmptyState from "../../ui/Empty_state";
import EarningsChart from "./EarningsChart";
import SavingsGoals from "./SavingsGoals";
import Transactions from "./Transactions";
import RecurringTransactions from "./RecurringTransactions";
import Analytics from "./Analytics";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "transactions", label: "Transactions", icon: "💳" },
  { id: "recurring", label: "Recurring", icon: "🔄" },
  { id: "analytics", label: "Analytics", icon: "📈" },
];

function formatMoney(amount) {
  return `₪${Number(amount || 0).toFixed(2)}`;
}

function formatDateShort(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

function Household() {
  const userId = useUserId();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [memberShifts, setMemberShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todayShifts, setTodayShifts] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [workplaces, setWorkplaces] = useState({});
  const [activeTab, setActiveTab] = useState("overview");
  const [allTransactions, setAllTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [goals, setGoals] = useState([]);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const joinModal = useModal(260);
  const createModal = useModal(260);
  const deleteModal = useModal(260);
  const [householdName, setHouseholdName] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Field validation states
  const [nameFieldState, setNameFieldState] = useState("idle");
  const [nameFieldError, setNameFieldError] = useState(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [codeFieldState, setCodeFieldState] = useState("idle");
  const [codeFieldError, setCodeFieldError] = useState(null);
  const [codeTouched, setCodeTouched] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  useBodyScrollLock(joinModal.open, createModal.open, deleteModal.open);

  // Fetch household membership
  const fetchHousehold = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const { data: membership, error: memError } = await supabase
        .from("household_members")
        .select("household_id, role, households(id, name, invite_code, created_by)")
        .eq("user_id", userId)
        .maybeSingle();

      if (memError) throw memError;

      if (!membership) {
        setHousehold(null);
        setMembers([]);
        setLoading(false);
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
      (profiles || []).forEach((p) => { profileMap[p.user_id] = p.display_name; });

      const enrichedMembers = (memberData || []).map((m) => ({
        ...m,
        display_name: profileMap[m.user_id] || "User",
        is_me: m.user_id === userId,
      }));

      setMembers(enrichedMembers);
    } catch (err) {
      setError(getUserFacingError(err.message));
    }
  }, [userId]);

  // Fetch shifts
  const fetchMemberShifts = useCallback(async () => {
    if (!userId || !household) return;
    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    try {
      const supabase = getSupabaseClient();
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
        return { ...s, display_name: member?.display_name || "User", is_me: s.user_id === userId };
      });

      setMemberShifts(enriched);
      setTodayShifts(enriched.filter((s) => s.shift_date === today));
    } catch (err) {
      setError(getUserFacingError(err.message));
    }
  }, [userId, household, members, month, year]);

  // Fetch workplaces
  const fetchWorkplaces = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const memberIds = members.map((m) => m.user_id);
      if (memberIds.length === 0) return;

      const { data } = await supabase
        .from("workplaces")
        .select("slug, label, rate, color, user_id")
        .in("user_id", memberIds);

      const wpMap = {};
      (data || []).forEach((wp) => {
        if (!wpMap[wp.user_id]) wpMap[wp.user_id] = {};
        wpMap[wp.user_id][wp.slug] = { label: wp.label, rate: Number(wp.rate), color: wp.color };
      });
      setWorkplaces(wpMap);
    } catch { /* silent */ }
  }, [userId, members]);

  // Fetch transactions for analytics (full month)
  const fetchAllTransactions = useCallback(async () => {
    if (!household) return;
    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    try {
      const supabase = getSupabaseClient();
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
          is_me: t.user_id === userId,
          category_name: t.transaction_categories?.name || "Other",
          category_icon: t.transaction_categories?.icon || "📦",
          category_color: t.transaction_categories?.color || "#6b7280",
        };
      });

      setAllTransactions(enriched);
    } catch { /* silent */ }
  }, [household, members, userId, month, year]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!household) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("transaction_categories")
        .select("*")
        .eq("household_id", household.id)
        .order("name");
      if (error) throw error;
      setCategories(data ?? []);
    } catch { /* silent */ }
  }, [household]);

  // Fetch savings goals
  const fetchGoals = useCallback(async () => {
    if (!household) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("household_id", household.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setGoals(data ?? []);
    } catch { /* silent */ }
  }, [household]);

  useEffect(() => { fetchHousehold(); }, [fetchHousehold]);

  useEffect(() => {
    if (household && members.length > 0) {
      fetchMemberShifts();
      fetchWorkplaces();
      fetchAllTransactions();
      fetchCategories();
      fetchGoals();
      setLoading(false);
    }
  }, [household, members, fetchMemberShifts, fetchWorkplaces, fetchAllTransactions, fetchCategories, fetchGoals]);

  // Calculate combined stats
  const combinedStats = useMemo(() => {
    const stats = {};
    let totalHours = 0, totalPay = 0, totalTips = 0;

    members.forEach((member) => {
      const memberShiftsFiltered = memberShifts.filter((s) => s.user_id === member.user_id);
      const wp = workplaces[member.user_id] || {};
      let mHours = 0, mPay = 0, mTips = 0;

      memberShiftsFiltered.forEach((shift) => {
        const hours = parseFloat(shift.hours) || 0;
        const tips = parseFloat(shift.tips) || 0;
        const rate = shift.pay_type === "tips_only" ? 0 : (wp[shift.place]?.rate ?? 0);
        mHours += hours;
        mPay += rate * hours;
        mTips += tips;
      });

      stats[member.user_id] = {
        display_name: member.display_name, is_me: member.is_me,
        hours: mHours, pay: mPay, tips: mTips, total: mPay + mTips,
        shiftCount: memberShiftsFiltered.length,
      };

      totalHours += mHours;
      totalPay += mPay;
      totalTips += mTips;
    });

    return {
      byMember: stats,
      combined: { hours: totalHours, pay: totalPay, tips: totalTips, total: totalPay + totalTips, shiftCount: memberShifts.length },
    };
  }, [memberShifts, members, workplaces]);

  // Transaction summary for overview
  const txSummary = useMemo(() => {
    let totalExpense = 0, totalIncome = 0;
    allTransactions.forEach((t) => {
      if (t.type === "expense") totalExpense += Number(t.amount);
      else totalIncome += Number(t.amount);
    });
    return { totalExpense, totalIncome, balance: totalIncome - totalExpense };
  }, [allTransactions]);

  // Chart data
  const chartData = useMemo(() => {
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
          const rate = shift.pay_type === "tips_only" ? 0 : (wp[shift.place]?.rate ?? 0);
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

  // Field validation
  const validateNameField = (value, isBlur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (isBlur) { setNameFieldState("error"); setNameFieldError("Household name is required"); }
      else { setNameFieldState("idle"); setNameFieldError(null); }
      return;
    }
    if (trimmed.length >= 2 && trimmed.length <= 40) { setNameFieldState("valid"); setNameFieldError(null); }
    else if (trimmed.length > 40) { setNameFieldState("error"); setNameFieldError("Name too long (max 40)"); }
    else { setNameFieldState("error"); setNameFieldError("At least 2 characters"); }
  };

  const validateCodeField = (value, isBlur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (isBlur) { setCodeFieldState("error"); setCodeFieldError("Invite code is required"); }
      else { setCodeFieldState("idle"); setCodeFieldError(null); }
      return;
    }
    setCodeFieldState("valid"); setCodeFieldError(null);
  };

  const handleNameBlur = () => {
    setNameTouched(true); validateNameField(householdName, true);
    if (!householdName.trim() || householdName.trim().length < 2) { setShakeKey((k) => k + 1); hapticError(); }
  };

  const handleCodeBlur = () => {
    setCodeTouched(true); validateCodeField(joinCode, true);
    if (!joinCode.trim()) { setShakeKey((k) => k + 1); hapticError(); }
  };

  const handleNameChange = (e) => { const v = e.target.value; setHouseholdName(v); if (nameTouched) validateNameField(v); };
  const handleCodeChange = (e) => { const v = e.target.value; setJoinCode(v); if (codeTouched) validateCodeField(v); };

  // Create household
  const handleCreate = async () => {
    setNameTouched(true);
    if (!householdName.trim() || householdName.trim().length < 2) {
      validateNameField(householdName, true); setShakeKey((k) => k + 1); return;
    }
    setJoinLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: hh, error: createError } = await supabase
        .rpc("create_household", { household_name: householdName.trim() || "Our Household" }).single();
      if (createError) throw createError;
      createModal.closeModal();
      toastSuccess("Household created! Share the invite code with your partner.");
      fetchHousehold();
    } catch (err) { toastError(getUserFacingError(err.message)); }
    setJoinLoading(false);
  };

  // Join household
  const handleJoin = async () => {
    setCodeTouched(true);
    if (!joinCode.trim()) { validateCodeField(joinCode, true); setShakeKey((k) => k + 1); return; }
    if (!userId) { toastError("You must be logged in to join a household."); return; }
    setJoinLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error: joinError } = await supabase.rpc("join_household", { invite_code_param: joinCode.trim() });
      if (joinError) {
        if (joinError.message.includes("duplicate")) toastError("You're already in this household.");
        else if (joinError.message.includes("Invalid invite code")) toastError("Invalid invite code. Check and try again.");
        else throw joinError;
      } else {
        joinModal.closeModal();
        toastSuccess("Joined household!");
        fetchHousehold();
      }
    } catch (err) { toastError(getUserFacingError(err.message)); }
    setJoinLoading(false);
  };

  const copyInviteCode = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code).then(() => toastSuccess("Invite code copied!"));
    }
  };

  const handleDelete = async () => {
    if (!household) return;
    setDeleting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc("delete_household", { household_id_param: household.id });
      if (error) throw error;
      deleteModal.closeModal();
      toastSuccess("Household deleted.");
      setHousehold(null); setMembers([]); setMemberShifts([]);
    } catch (err) { toastError(getUserFacingError(err.message)); }
    setDeleting(false);
  };

  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 11 }, (_, i) => current - 5 + i);
  }, []);

  // No household state
  if (!loading && !household) {
    return (
      <section className="household page">
        <PageHeader eyebrow="Together" title="Household" className="household__header animate-in" />
        <EmptyState
          className="household__empty animate-in animate-in--1"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M9 22V12h6v10" /><path d="M12 5.5v.01" /></svg>}
          title="Set up your household"
          text="Create a household or join your partner's to track expenses, earnings, and savings together."
          action={
            <div className="household__setup-btns">
              <button type="button" className="btn btn--primary" onClick={() => {
                setNameTouched(false); setNameFieldState("idle"); setNameFieldError(null); setHouseholdName("");
                createModal.openModal();
              }}>Create household</button>
              <button type="button" className="btn btn--ghost" onClick={() => {
                setCodeTouched(false); setCodeFieldState("idle"); setCodeFieldError(null); setJoinCode("");
                joinModal.openModal();
              }}>Join with code</button>
            </div>
          }
        />

        <SheetModal open={createModal.open} closing={createModal.closing} onClose={() => createModal.closeModal()} title="Create household">
          <div className="household__form">
            <FormField label="Household name" error={nameFieldError} state={nameFieldState} showIndicator shake={nameFieldError ? shakeKey : 0}>
              <input type="text" value={householdName} onChange={handleNameChange} onBlur={handleNameBlur} placeholder="Our Household" maxLength={40} autoFocus />
            </FormField>
            <p className="household__form-hint">You'll get an invite code to share with your partner.</p>
            <div className="btn-row">
              <button type="button" className="btn btn--ghost" onClick={() => { setNameTouched(false); setNameFieldState("idle"); setNameFieldError(null); createModal.closeModal(); }}>Cancel</button>
              <button type="button" className="btn btn--primary" onClick={handleCreate} disabled={joinLoading || !householdName.trim()}>{joinLoading ? "Creating…" : "Create"}</button>
            </div>
          </div>
        </SheetModal>

        <SheetModal open={joinModal.open} closing={joinModal.closing} onClose={() => joinModal.closeModal()} title="Join household">
          <div className="household__form">
            <FormField label="Invite code" error={codeFieldError} state={codeFieldState} showIndicator shake={codeFieldError ? shakeKey : 0}>
              <input type="text" value={joinCode} onChange={handleCodeChange} onBlur={handleCodeBlur} placeholder="Enter code" autoFocus />
            </FormField>
            <p className="household__form-hint">Ask your partner for the invite code from their Household page.</p>
            <div className="btn-row">
              <button type="button" className="btn btn--ghost" onClick={() => { setCodeTouched(false); setCodeFieldState("idle"); setCodeFieldError(null); joinModal.closeModal(); }}>Cancel</button>
              <button type="button" className="btn btn--primary" onClick={handleJoin} disabled={joinLoading || !joinCode.trim()}>{joinLoading ? "Joining…" : "Join"}</button>
            </div>
          </div>
        </SheetModal>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="household page">
        <PageHeader eyebrow="Together" title="Household" className="household__header" />
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
      <div className="household__header-actions animate-in animate-in--1" style={{ display: "flex", justifyContent: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
        <button type="button" className="household__invite-btn" onClick={copyInviteCode}>
          <span className="household__invite-icon">🔗</span>
          <span className="household__invite-code">{household?.invite_code}</span>
        </button>
        <button type="button" className="household__delete-btn" onClick={() => deleteModal.openModal()} title="Delete household">
          🗑
        </button>
      </div>

      {/* Member count */}
      <p style={{ textAlign: "center", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)", marginBottom: "1rem" }}>
        {members.length} member{members.length !== 1 ? "s" : ""}
      </p>

      {/* Error */}
      {error && <div className="household__error">{error}</div>}

      {/* Tab Navigation */}
      <div className="household__tab-nav animate-in animate-in--2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
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
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
        <div className="household__filter">
          <label>Year</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tab Content */}
      <div className="household__tab-content animate-in animate-in--4">
        {activeTab === "overview" && (
          <>
            {/* Quick Transaction Summary */}
            {allTransactions.length > 0 && (
              <div className="household__tx-summary">
                <GlassCard value={formatMoney(txSummary.totalIncome)} label="Income" valueClassName="glass-card__value--green" />
                <GlassCard value={formatMoney(txSummary.totalExpense)} label="Expenses" valueClassName="glass-card__value--orange" />
                <GlassCard
                  value={formatMoney(txSummary.balance)}
                  label="Balance"
                  valueClassName={txSummary.balance >= 0 ? "glass-card__value--green" : "glass-card__value--orange"}
                />
              </div>
            )}

            {/* Combined Earnings Stats */}
            <h3 className="household__section-title">Shift Earnings</h3>
            <div className="household__stats">
              <GlassCard className="household__stat" value={`${combinedStats.combined.hours.toFixed(1)}h`} label="Combined Hours" />
              <GlassCard className="household__stat" value={formatMoney(combinedStats.combined.pay)} label="Combined Pay" />
              <GlassCard className="household__stat" value={formatMoney(combinedStats.combined.tips)} label="Combined Tips" />
              <GlassCard className="household__stat household__stat--total" value={formatMoney(combinedStats.combined.total)} label="Combined Total" />
            </div>

            {/* Per-Member Breakdown */}
            {members.length > 1 && (
              <div className="household__breakdown">
                <h3 className="household__section-title">Per Member</h3>
                <div className="household__member-cards">
                  {members.map((member) => {
                    const s = combinedStats.byMember[member.user_id];
                    if (!s) return null;
                    return (
                      <div key={member.user_id} className="household__member-card">
                        <div className="household__member-header">
                          <span className="household__member-avatar">{s.display_name.charAt(0).toUpperCase()}</span>
                          <span className="household__member-name">{s.is_me ? "You" : s.display_name}</span>
                          <span className="household__member-shifts">{s.shiftCount} shifts</span>
                        </div>
                        <div className="household__member-stats">
                          <div className="household__member-stat">
                            <span className="household__member-stat-value">{s.hours.toFixed(1)}h</span>
                            <span className="household__member-stat-label">Hours</span>
                          </div>
                          <div className="household__member-stat">
                            <span className="household__member-stat-value">{formatMoney(s.pay)}</span>
                            <span className="household__member-stat-label">Pay</span>
                          </div>
                          <div className="household__member-stat">
                            <span className="household__member-stat-value">{formatMoney(s.tips)}</span>
                            <span className="household__member-stat-label">Tips</span>
                          </div>
                          <div className="household__member-stat">
                            <span className="household__member-stat-value" style={{ color: "var(--color-primary, #818cf8)" }}>{formatMoney(s.total)}</span>
                            <span className="household__member-stat-label">Total</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Today's Shifts */}
            {todayShifts.length > 0 && (
              <div className="household__today">
                <h3 className="household__section-title">Today</h3>
                <div className="household__today-cards">
                  {todayShifts.map((shift) => {
                    const wp = workplaces[shift.user_id]?.[shift.place];
                    return (
                      <div key={shift.id} className="household__today-card">
                        <span className="household__today-dot" style={{ background: wp?.color || "#818cf8" }} />
                        <div className="household__today-info">
                          <span className="household__today-name">{shift.display_name} — {wp?.label || shift.place}</span>
                          <span className="household__today-detail">{shift.hours}h · {formatMoney(shift.tips)} tips</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Earnings Chart */}
            <div className="household__chart-section">
              <h3 className="household__section-title">Daily Earnings</h3>
              <EarningsChart data={chartData} members={members} month={month} year={year} />
            </div>

            {/* Savings Goals */}
            <div className="household__savings-section">
              <SavingsGoals householdId={household?.id} userId={userId} members={members} />
            </div>
          </>
        )}

        {activeTab === "transactions" && (
          <Transactions householdId={household?.id} userId={userId} members={members} goals={goals} />
        )}

        {activeTab === "recurring" && (
          <RecurringTransactions householdId={household?.id} userId={userId} categories={categories} />
        )}

        {activeTab === "analytics" && (
          <Analytics transactions={allTransactions} members={members} month={month} year={year} />
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={deleteModal.open}
        closing={deleteModal.closing}
        onClose={() => deleteModal.closeModal()}
        title="Delete household"
        message="This will permanently delete the household, all savings goals, and shared data. Members' shifts won't be affected."
        confirmText={deleting ? "Deleting…" : "Delete"}
        onConfirm={handleDelete}
        danger
      />
    </section>
  );
}

export default Household;
