import { useCallback, useEffect, useState } from "react";
import { get_supabase_client } from "../../../lib/superbase";
import {
  get_user_facing_error,
  sanitize_number,
  sanitize_text,
  haptic_error,
} from "../../../lib/security";
import { use_glass_toast } from "../../../lib/glass_toast_provider.jsx";
import { use_modal, use_body_scroll_lock } from "../../../Hooks";
import SheetModal from "../../UI/modals/sheet_modal";
import ConfirmModal from "../../UI/modals/confirm_modal";
import FormField from "../../UI/form/form_field.jsx";
import EmptyState from "../../UI/Empty_state";

import { format_money } from "../../../lib/format";

function SavingsGoals({ householdId, user_id, members, hideTitle }) {
  const [goals, setGoals] = useState([]);
  const [loading, set_loading] = useState(true);
  const [delete_target, set_delete_target] = useState(null);
  const [deleting, set_deleting] = useState(false);
  const { success: toast_success, error: toast_error } = use_glass_toast();

  const goalModal = use_modal(260);
  const contributeModal = use_modal(260);
  const delete_modal = use_modal(260);

  // Field validation states for goal form
  const [goalShakeKey, setGoalShakeKey] = useState(0);
  const [goalTitleState, setGoalTitleState] = useState("idle");
  const [goalTitleError, setGoalTitleError] = useState(null);
  const [goalTitleTouched, setGoalTitleTouched] = useState(false);
  const [goalAmountState, setGoalAmountState] = useState("idle");
  const [goalAmountError, setGoalAmountError] = useState(null);
  const [goalAmountTouched, setGoalAmountTouched] = useState(false);

  // Field validation states for contribute form
  const [contribAmountState, setContribAmountState] = useState("idle");
  const [contribAmountError, setContribAmountError] = useState(null);
  const [contribAmountTouched, setContribAmountTouched] = useState(false);

  const [goalForm, setGoalForm] = useState({
    title: "",
    target_amount: "",
    icon: "🎯",
    color: "#818cf8",
  });
  const [editingGoal, setEditingGoal] = useState(null);

  const [contribute_form, set_contribute_form] = useState({
    amount: "",
    note: "",
  });
  const [active_goal, set_active_goal] = useState(null);

  use_body_scroll_lock(goalModal.open, contributeModal.open, delete_modal.open);

  const fetch_goals = useCallback(async () => {
    if (!householdId) {
      set_loading(false);
      return;
    }
    try {
      const supabase = get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: true });

      if (fetch_error) throw fetch_error;

      // Also fetch orphaned goals (created before householdId was available)
      const { data: orphanData } = await supabase
        .from("savings_goals")
        .select("*")
        .is("household_id", null)
        .eq("created_by", user_id);

      // Backfill orphaned goals with correct household_id
      if (orphanData && orphanData.length > 0) {
        await supabase
          .from("savings_goals")
          .update({ household_id: householdId })
          .is("household_id", null)
          .eq("created_by", user_id);
        // Re-fetch after fixing
        const { data: fixed } = await supabase
          .from("savings_goals")
          .select("*")
          .eq("household_id", householdId)
          .order("created_at", { ascending: true });
        setGoals(fixed ?? []);
      } else {
        setGoals(data ?? []);
      }
    } catch (err) {
      // silent
    }
    set_loading(false);
  }, [householdId, user_id]);

  useEffect(() => {
    fetch_goals();
  }, [fetch_goals]);

  const saveGoal = async () => {
    const title = sanitize_text(goalForm.title, 60);
    const target = sanitize_number(goalForm.target_amount, 1, 999999);
    if (!title || !target) return;

    try {
      const supabase = get_supabase_client();
      const payload = {
        title,
        target_amount: Number(target.toFixed(2)),
        icon: goalForm.icon,
        color: goalForm.color,
        household_id: householdId,
        created_by: user_id,
      };

      if (editingGoal) {
        const { error } = await supabase
          .from("savings_goals")
          .update(payload)
          .eq("id", editingGoal.id);
        if (error) throw error;
        toast_success("Goal updated.");
      } else {
        const { error } = await supabase.from("savings_goals").insert(payload);
        if (error) throw error;
        toast_success("Goal created!");
      }

      goalModal.close_modal();
      fetch_goals();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
  };

  // Validation helpers
  const validateGoalTitle = (value, is_blur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (is_blur) {
        setGoalTitleState("error");
        setGoalTitleError("Goal name is required");
      } else {
        setGoalTitleState("idle");
        setGoalTitleError(null);
      }
      return;
    }
    setGoalTitleState("valid");
    setGoalTitleError(null);
  };

  const validateGoalAmount = (value, is_blur = false) => {
    if (!value) {
      if (is_blur) {
        setGoalAmountState("error");
        setGoalAmountError("Target amount is required");
      } else {
        setGoalAmountState("idle");
        setGoalAmountError(null);
      }
      return;
    }
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      setGoalAmountState("error");
      setGoalAmountError("Enter a valid amount");
    } else {
      setGoalAmountState("valid");
      setGoalAmountError(null);
    }
  };

  const validateContribAmount = (value, is_blur = false) => {
    if (!value) {
      if (is_blur) {
        setContribAmountState("error");
        setContribAmountError("Amount is required");
      } else {
        setContribAmountState("idle");
        setContribAmountError(null);
      }
      return;
    }
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      setContribAmountState("error");
      setContribAmountError("Enter a valid amount");
    } else {
      setContribAmountState("valid");
      setContribAmountError(null);
    }
  };

  const resetGoalFieldStates = () => {
    setGoalTitleTouched(false);
    setGoalTitleState("idle");
    setGoalTitleError(null);
    setGoalAmountTouched(false);
    setGoalAmountState("idle");
    setGoalAmountError(null);
  };

  const resetContribFieldStates = () => {
    setContribAmountTouched(false);
    setContribAmountState("idle");
    setContribAmountError(null);
  };

  const openEditGoal = (goal) => {
    setEditingGoal(goal);
    setGoalForm({
      title: goal.title,
      target_amount: String(goal.target_amount),
      icon: goal.icon || "🎯",
      color: goal.color || "#818cf8",
    });
    resetGoalFieldStates();
    goalModal.open_modal();
  };

  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalForm({ title: "", target_amount: "", icon: "🎯", color: "#818cf8" });
    resetGoalFieldStates();
    goalModal.open_modal();
  };

  const confirmDeleteGoal = async () => {
    if (!delete_target) return;
    set_deleting(true);
    try {
      const supabase = get_supabase_client();
      const { error } = await supabase
        .from("savings_goals")
        .delete()
        .eq("id", delete_target.id);
      if (error) throw error;
      delete_modal.close_modal();
      toast_success("Goal deleted.");
      setGoals((prev) => prev.filter((g) => g.id !== delete_target.id));
      set_delete_target(null);
      fetch_goals();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    set_deleting(false);
  };

  const openContribute = (goal) => {
    set_active_goal(goal);
    set_contribute_form({ amount: "", note: "" });
    resetContribFieldStates();
    contributeModal.open_modal();
  };

  const submitContribution = async () => {
    const amount = sanitize_number(contribute_form.amount, 0.01, 999999);
    if (!amount || !active_goal) return;

    try {
      const supabase = get_supabase_client();

      // Insert contribution record
      const { error: contribError } = await supabase
        .from("savings_contributions")
        .insert({
          goal_id: active_goal.id,
          user_id: user_id,
          amount: Number(amount.toFixed(2)),
          note: sanitize_text(contribute_form.note, 200) || null,
        });

      if (contribError) throw contribError;

      // Update goal's current_amount
      const newAmount = Number(active_goal.current_amount) + amount;
      const { error: updateError } = await supabase
        .from("savings_goals")
        .update({ current_amount: Number(newAmount.toFixed(2)) })
        .eq("id", active_goal.id);

      if (updateError) throw updateError;

      contributeModal.close_modal();
      toast_success(`Added ${format_money(amount)}!`);
      fetch_goals();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
  };

  if (loading) return null;

  return (
    <div className="savings-goals">
      <div className="savings-goals__header">
        {!hideTitle && (
          <h3 className="household__section-title">💰 Savings Goals</h3>
        )}
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={openNewGoal}
        >
          + New goal
        </button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          className="savings-goals__empty-state"
          icon={<span style={{ fontSize: "2rem" }}>🎯</span>}
          title="No savings goals yet"
          text="Create a goal to start tracking your savings together!"
          action={
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={openNewGoal}
            >
              + Create goal
            </button>
          }
        />
      ) : (
        <div className="savings-goals__list">
          {goals.map((goal) => {
            const progress =
              goal.target_amount > 0
                ? Math.min(
                    100,
                    (goal.current_amount / goal.target_amount) * 100,
                  )
                : 0;
            const remaining = Math.max(
              0,
              goal.target_amount - goal.current_amount,
            );

            return (
              <div
                key={goal.id}
                className={`savings-goals__card${goal.is_completed ? " savings-goals__card--completed" : ""}`}
              >
                <div className="savings-goals__card-header">
                  <span className="savings-goals__icon">
                    {goal.icon || "🎯"}
                  </span>
                  <div className="savings-goals__card-info">
                    <span className="savings-goals__title">{goal.title}</span>
                    <span className="savings-goals__amounts">
                      {format_money(goal.current_amount)} /{" "}
                      {format_money(goal.target_amount)}
                    </span>
                  </div>
                  <div className="savings-goals__card-actions">
                    {!goal.is_completed && (
                      <button
                        type="button"
                        className="savings-goals__add-btn"
                        onClick={() => openContribute(goal)}
                        title="Add money"
                      >
                        +
                      </button>
                    )}
                    <button
                      type="button"
                      className="savings-goals__edit-btn"
                      onClick={() => openEditGoal(goal)}
                      title="Edit goal"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="savings-goals__delete-btn"
                      onClick={() => {
                        set_delete_target(goal);
                        delete_modal.open_modal();
                      }}
                      title="Delete goal"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="savings-goals__progress-wrap">
                  <div
                    className="savings-goals__progress-bar"
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="savings-goals__progress-fill"
                      style={{
                        width: `${progress}%`,
                        background: goal.color || "#818cf8",
                      }}
                    />
                  </div>
                  <div className="savings-goals__progress-meta">
                    <span>{Math.round(progress)}%</span>
                    {remaining > 0 ? (
                      <span>{format_money(remaining)} to go</span>
                    ) : (
                      <span className="savings-goals__reached">
                        🎉 Reached!
                      </span>
                    )}
                  </div>
                </div>

                {goal.is_completed && (
                  <div
                    className="savings-goals__celebration"
                    aria-hidden="true"
                  >
                    {[...Array(8)].map((_, i) => (
                      <span
                        key={i}
                        className={`savings-goals__confetti savings-goals__confetti--${i % 4}`}
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Goal Modal */}
      <SheetModal
        open={goalModal.open}
        closing={goalModal.closing}
        onClose={() => goalModal.close_modal()}
        title={editingGoal ? "Edit goal" : "New savings goal"}
      >
        <div className="savings-goals__form">
          <FormField
            label="Goal name"
            error={goalTitleError}
            state={goalTitleState}
            show_indicator
            shake={goalTitleError ? goalShakeKey : 0}
          >
            <input
              type="text"
              value={goalForm.title}
              onChange={(e) => {
                setGoalForm((f) => ({ ...f, title: e.target.value }));
                if (goalTitleTouched) validateGoalTitle(e.target.value);
              }}
              onBlur={() => {
                setGoalTitleTouched(true);
                validateGoalTitle(goalForm.title, true);
                if (!goalForm.title.trim()) {
                  setGoalShakeKey((k) => k + 1);
                  haptic_error();
                }
              }}
              placeholder="e.g. Vacation fund"
              maxLength={60}
              autoFocus
            />
          </FormField>
          <FormField
            label="Target amount (₪)"
            error={goalAmountError}
            state={goalAmountState}
            show_indicator
            shake={goalAmountError ? goalShakeKey : 0}
          >
            <input
              type="number"
              min="1"
              step="0.01"
              value={goalForm.target_amount}
              onChange={(e) => {
                setGoalForm((f) => ({ ...f, target_amount: e.target.value }));
                if (goalAmountTouched) validateGoalAmount(e.target.value);
              }}
              onBlur={() => {
                setGoalAmountTouched(true);
                validateGoalAmount(goalForm.target_amount, true);
                if (
                  !goalForm.target_amount ||
                  Number(goalForm.target_amount) <= 0
                ) {
                  setGoalShakeKey((k) => k + 1);
                  haptic_error();
                }
              }}
              placeholder="5000"
            />
          </FormField>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => goalModal.close_modal()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={saveGoal}
              disabled={
                !goalForm.title.trim() ||
                !goalForm.target_amount ||
                Number(goalForm.target_amount) <= 0
              }
            >
              {editingGoal ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* Contribute Modal */}
      <SheetModal
        open={contributeModal.open}
        closing={contributeModal.closing}
        onClose={() => contributeModal.close_modal()}
        title={`Add to "${active_goal?.title || ""}"`}
      >
        <div className="savings-goals__form">
          {/* Goal progress preview */}
          {active_goal && (() => {
            const progress = active_goal.target_amount > 0
              ? Math.min(100, (active_goal.current_amount / active_goal.target_amount) * 100)
              : 0;
            const remaining = Math.max(0, active_goal.target_amount - active_goal.current_amount);
            return (
              <div className="savings-goals__contrib-preview">
                <div className="savings-goals__contrib-header">
                  <span className="savings-goals__contrib-icon">{active_goal.icon || "🎯"}</span>
                  <div className="savings-goals__contrib-info">
                    <span className="savings-goals__contrib-title">{active_goal.title}</span>
                    <span className="savings-goals__contrib-amounts">
                      {format_money(active_goal.current_amount)} / {format_money(active_goal.target_amount)}
                    </span>
                  </div>
                </div>
                <div className="savings-goals__progress-wrap">
                  <div className="savings-goals__progress-bar">
                    <div
                      className="savings-goals__progress-fill"
                      style={{ width: `${progress}%`, background: active_goal.color || "#818cf8" }}
                    />
                  </div>
                  <div className="savings-goals__progress-meta">
                    <span>{Math.round(progress)}%</span>
                    {remaining > 0 ? (
                      <span>{format_money(remaining)} to go</span>
                    ) : (
                      <span className="savings-goals__reached">🎉 Reached!</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <FormField
            label="Amount (₪)"
            error={contribAmountError}
            state={contribAmountState}
            show_indicator
            shake={contribAmountError ? goalShakeKey : 0}
          >
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={contribute_form.amount}
              onChange={(e) => {
                set_contribute_form((f) => ({ ...f, amount: e.target.value }));
                if (contribAmountTouched) validateContribAmount(e.target.value);
              }}
              onBlur={() => {
                setContribAmountTouched(true);
                validateContribAmount(contribute_form.amount, true);
                if (
                  !contribute_form.amount ||
                  Number(contribute_form.amount) <= 0
                ) {
                  setGoalShakeKey((k) => k + 1);
                  haptic_error();
                }
              }}
              placeholder="100"
              autoFocus
            />
          </FormField>
          <FormField label="Note" optional>
            <input
              type="text"
              value={contribute_form.note}
              onChange={(e) =>
                set_contribute_form((f) => ({ ...f, note: e.target.value }))
              }
              placeholder="e.g. From my tips this week"
              maxLength={200}
            />
          </FormField>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => contributeModal.close_modal()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={submitContribution}
              disabled={
                !contribute_form.amount || Number(contribute_form.amount) <= 0
              }
            >
              Add{" "}
              {contribute_form.amount
                ? format_money(Number(contribute_form.amount))
                : ""}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!delete_target}
        closing={delete_modal.closing}
        onClose={() => {
          delete_modal.close_modal();
          setTimeout(() => set_delete_target(null), 260);
        }}
        onConfirm={confirmDeleteGoal}
        loading={deleting}
        title="Delete this goal?"
        description={`"${delete_target?.title}" and all its contributions will be removed.`}
        confirm_label="Delete"
        variant="danger"
      />
    </div>
  );
}

export default SavingsGoals;
