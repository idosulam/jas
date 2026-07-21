import "./Household.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { useUserId } from "../../../lib/Auth_context.jsx";
import { getUserFacingError } from "../../../lib/security";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import { useBodyScrollLock, useModal } from "../../../hooks";
import SheetModal from "../../ui/modals/Sheet_modal";
import FormField from "../../ui/form/Form_field.jsx";
import PageHeader from "../../ui/Page_header";
import GlassCard from "../../ui/Glass_card";
import LoadingSkeleton from "../../ui/Loading_skeleton";
import EmptyState from "../../ui/Empty_state";
import EarningsChart from "./EarningsChart";
import SavingsGoals from "./SavingsGoals";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMoney(amount) {
  return `₪${Number(amount || 0).toFixed(2)}`;
}

function formatDateShort(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
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
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const joinModal = useModal(260);
  const createModal = useModal(260);
  const [householdName, setHouseholdName] = useState("Our Household");

  useBodyScrollLock(joinModal.open, createModal.open);

  // Fetch household membership
  const fetchHousehold = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();

      // Check if user is in a household
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

      // Fetch all members
      const { data: memberData, error: memberError } = await supabase
        .from("household_members")
        .select("user_id, role, joined_at")
        .eq("household_id", hh.id);

      if (memberError) throw memberError;

      // Fetch display names for members
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
        is_me: m.user_id === userId,
      }));

      setMembers(enrichedMembers);
    } catch (err) {
      setError(getUserFacingError(err.message));
    }
  }, [userId]);

  // Fetch shifts for all household members
  const fetchMemberShifts = useCallback(async () => {
    if (!userId || !household) return;

    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);

    try {
      const supabase = getSupabaseClient();

      // Get all member user IDs
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

      // Enrich shifts with member info
      const enriched = (shifts || []).map((s) => {
        const member = members.find((m) => m.user_id === s.user_id);
        return {
          ...s,
          display_name: member?.display_name || "User",
          is_me: s.user_id === userId,
        };
      });

      setMemberShifts(enriched);

      // Today's shifts
      const todayEnriched = enriched.filter((s) => s.shift_date === today);
      setTodayShifts(todayEnriched);
    } catch (err) {
      setError(getUserFacingError(err.message));
    }
  }, [userId, household, members, month, year]);

  // Fetch workplaces for pay calculation
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
        wpMap[wp.user_id][wp.slug] = {
          label: wp.label,
          rate: Number(wp.rate),
          color: wp.color,
        };
      });
      setWorkplaces(wpMap);
    } catch {
      // silent
    }
  }, [userId, members]);

  useEffect(() => {
    fetchHousehold();
  }, [fetchHousehold]);

  useEffect(() => {
    if (household && members.length > 0) {
      fetchMemberShifts();
      fetchWorkplaces();
      setLoading(false);
    }
  }, [household, members, fetchMemberShifts, fetchWorkplaces]);

  // Calculate combined stats
  const combinedStats = useMemo(() => {
    const stats = {};
    let totalHours = 0;
    let totalPay = 0;
    let totalTips = 0;

    members.forEach((member) => {
      const memberShiftsFiltered = memberShifts.filter(
        (s) => s.user_id === member.user_id
      );
      const wp = workplaces[member.user_id] || {};

      let mHours = 0;
      let mPay = 0;
      let mTips = 0;

      memberShiftsFiltered.forEach((shift) => {
        const hours = parseFloat(shift.hours) || 0;
        const tips = parseFloat(shift.tips) || 0;
        const rate = shift.pay_type === "tips_only" ? 0 : (wp[shift.place]?.rate ?? 0);

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

  // Chart data: daily earnings per member
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

  // Create household
  const handleCreate = async () => {
    // Safety: ensure we have a valid user ID before attempting insert
    if (!userId) {
      toastError("You must be logged in to create a household.");
      return;
    }

    setJoinLoading(true);
    try {
      const supabase = getSupabaseClient();

      // Double-check session is still valid
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || userId;
      if (!uid) {
        toastError("Session expired. Please sign in again.");
        setJoinLoading(false);
        return;
      }

      const { data: hh, error: createError } = await supabase
        .from("households")
        .insert({
          name: householdName.trim() || "Our Household",
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add self as owner
      const { error: memberError } = await supabase
        .from("household_members")
        .insert({
          household_id: hh.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      createModal.closeModal();
      toastSuccess("Household created! Share the invite code with your partner.");
      fetchHousehold();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setJoinLoading(false);
  };

  // Join household by code
  const handleJoin = async () => {
    if (!joinCode.trim()) return;

    if (!userId) {
      toastError("You must be logged in to join a household.");
      return;
    }

    setJoinLoading(true);
    try {
      const supabase = getSupabaseClient();

      // Double-check session
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || userId;
      if (!uid) {
        toastError("Session expired. Please sign in again.");
        setJoinLoading(false);
        return;
      }

      // Find household by invite code
      const { data: hh, error: findError } = await supabase
        .from("households")
        .select("id")
        .eq("invite_code", joinCode.trim())
        .maybeSingle();

      if (findError) throw findError;
      if (!hh) {
        toastError("Invalid invite code. Check and try again.");
        setJoinLoading(false);
        return;
      }

      // Join as member
      const { error: joinError } = await supabase
        .from("household_members")
        .insert({
          household_id: hh.id,
          role: "member",
        });

      if (joinError) {
        if (joinError.message.includes("duplicate")) {
          toastError("You're already in this household.");
        } else {
          throw joinError;
        }
      } else {
        joinModal.closeModal();
        toastSuccess("Joined household!");
        fetchHousehold();
      }
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setJoinLoading(false);
  };

  // Copy invite code
  const copyInviteCode = () => {
    if (household?.invite_code) {
      navigator.clipboard.writeText(household.invite_code).then(() => {
        toastSuccess("Invite code copied!");
      });
    }
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
        <EmptyState
          className="household__empty animate-in animate-in--1"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <path d="M9 22V12h6v10" />
              <path d="M12 5.5v.01" />
            </svg>
          }
          title="Set up your household"
          text="Create a household or join your partner's to see combined earnings, shared goals, and more."
          action={
            <div className="household__setup-btns">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => createModal.openModal()}
              >
                Create household
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => joinModal.openModal()}
              >
                Join with code
              </button>
            </div>
          }
        />

        <SheetModal
          open={createModal.open}
          closing={createModal.closing}
          onClose={() => createModal.closeModal()}
          title="Create household"
        >
          <div className="household__form">
            <FormField label="Household name">
              <input
                type="text"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="Our Household"
                maxLength={40}
                autoFocus
              />
            </FormField>
            <p className="household__form-hint">
              You'll get an invite code to share with your partner.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn--ghost" onClick={() => createModal.closeModal()}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleCreate}
                disabled={joinLoading}
              >
                {joinLoading ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </SheetModal>

        <SheetModal
          open={joinModal.open}
          closing={joinModal.closing}
          onClose={() => joinModal.closeModal()}
          title="Join household"
        >
          <div className="household__form">
            <FormField label="Invite code">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter code"
                autoFocus
              />
            </FormField>
            <p className="household__form-hint">
              Ask your partner for the invite code from their Household page.
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn--ghost" onClick={() => joinModal.closeModal()}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleJoin}
                disabled={joinLoading || !joinCode.trim()}
              >
                {joinLoading ? "Joining…" : "Join"}
              </button>
            </div>
          </div>
        </SheetModal>
      </section>
    );
  }

  return (
    <section className="household page">
      <PageHeader
        eyebrow="Together"
        title={household?.name || "Household"}
        subtitle={`${members.length} member${members.length !== 1 ? "s" : ""}`}
        className="household__header animate-in"
      >
        {household && (
          <button
            type="button"
            className="household__invite-btn"
            onClick={copyInviteCode}
            title="Copy invite code"
          >
            <span className="household__invite-icon">🔗</span>
            <span className="household__invite-code">{household.invite_code}</span>
          </button>
        )}
      </PageHeader>

      {error && (
        <p className="household__error" role="alert">{error}</p>
      )}

      {/* Who's working today */}
      {todayShifts.length > 0 && (
        <div className="household__today animate-in animate-in--1">
          <h3 className="household__section-title">📅 Today</h3>
          <div className="household__today-cards">
            {todayShifts.map((shift) => (
              <div key={shift.id} className="household__today-card">
                <span
                  className="household__today-dot"
                  style={{ background: shift.color || "#818cf8" }}
                />
                <div className="household__today-info">
                  <span className="household__today-name">
                    {shift.is_me ? "You" : shift.display_name}
                  </span>
                  <span className="household__today-detail">
                    {shift.place} · {shift.start_time}–{shift.end_time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month/Year filters */}
      <div className="household__filters animate-in animate-in--1">
        <label className="household__filter">
          <span>Month</span>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((name, i) => (
              <option key={name} value={i}>{name}</option>
            ))}
          </select>
        </label>
        <label className="household__filter">
          <span>Year</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="household__stats">
          <LoadingSkeleton count={4} height="5.5rem" />
        </div>
      ) : (
        <>
          {/* Combined stats */}
          <div className="household__stats animate-in animate-in--2">
            <GlassCard
              value={`${combinedStats.combined.hours.toFixed(1)}h`}
              label="Combined hours"
              className="household__stat"
            />
            <GlassCard
              value={formatMoney(combinedStats.combined.pay)}
              label="Combined pay"
              className="household__stat"
            />
            <GlassCard
              value={formatMoney(combinedStats.combined.tips)}
              label="Combined tips"
              className="household__stat"
            />
            <GlassCard
              value={formatMoney(combinedStats.combined.total)}
              label="Combined total"
              className="household__stat household__stat--total"
            />
          </div>

          {/* Per-member breakdown */}
          {members.length > 1 && (
            <div className="household__breakdown animate-in animate-in--3">
              <h3 className="household__section-title">Per person</h3>
              <div className="household__member-cards">
                {members.map((member) => {
                  const stats = combinedStats.byMember[member.user_id];
                  if (!stats) return null;
                  return (
                    <div key={member.user_id} className="household__member-card">
                      <div className="household__member-header">
                        <span className="household__member-avatar">
                          {stats.display_name.charAt(0).toUpperCase()}
                        </span>
                        <span className="household__member-name">
                          {stats.is_me ? "You" : stats.display_name}
                        </span>
                        <span className="household__member-shifts">
                          {stats.shiftCount} shift{stats.shiftCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="household__member-stats">
                        <div className="household__member-stat">
                          <span className="household__member-stat-value">{stats.hours.toFixed(1)}h</span>
                          <span className="household__member-stat-label">Hours</span>
                        </div>
                        <div className="household__member-stat">
                          <span className="household__member-stat-value">{formatMoney(stats.total)}</span>
                          <span className="household__member-stat-label">Earned</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Earnings chart */}
          <div className="household__chart-section animate-in animate-in--4">
            <h3 className="household__section-title">Daily earnings</h3>
            <EarningsChart
              data={chartData}
              members={members}
              month={month}
              year={year}
            />
          </div>

          {/* Savings Goals */}
          <div className="household__savings-section animate-in animate-in--5">
            <SavingsGoals householdId={household?.id} userId={userId} members={members} />
          </div>
        </>
      )}
    </section>
  );
}

export default Household;
