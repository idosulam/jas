import { useCallback, useEffect, useState } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase";
import {
  Get_user_facing_error,
  Sanitize_number,
  Sanitize_text,
  Haptic_error,
} from "../../../Lib/Security";
import { Use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import { Use_modal, Use_body_scroll_lock } from "../../../Hooks";
import SheetModal from "../../UI/Modals/Sheet_modal";
import ConfirmModal from "../../UI/Modals/Confirm_modal";
import FormField from "../../UI/Form/Form_field.jsx";
import EmptyState from "../../UI/Empty_state";

import { Format_money } from "../../../Lib/format";

function SavingsGoals({ householdId, user_id, members, hideTitle }) {
  const [goals, setGoals] = useState([]);
  const [Loading, Set_loading] = useState(true);
  const [Delete_target, Set_delete_target] = useState(null);
  const [Deleting, Set_deleting] = useState(false);
  const { success: Toast_success, error: Toast_error } = Use_glass_toast();

  const goalModal = Use_modal(260);
  const contributeModal = Use_modal(260);
  const Delete_modal = Use_modal(260);

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

  const [Contribute_form, Set_contribute_form] = useState({
    amount: "",
    note: "",
  });
  const [Active_goal, Set_active_goal] = useState(null);

  Use_body_scroll_lock(goalModal.open, contributeModal.open, Delete_modal.open);

  const Fetch_goals = useCallback(async () => {
    if (!householdId) {
      Set_loading(false);
      return;
    }
    try {
      const supabase = Get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("Savings_goals")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: true });

      if (fetch_error) throw fetch_error;

      // Also fetch orphaned goals (created before householdId was available)
      const { data: orphanData } = await supabase
        .from("Savings_goals")
        .select("*")
        .is("household_id", null)
        .eq("created_by", user_id);

      // Backfill orphaned goals with correct household_id
      if (orphanData && orphanData.length > 0) {
        await supabase
          .from("Savings_goals")
          .update({ household_id: householdId })
          .is("household_id", null)
          .eq("created_by", user_id);
        // Re-fetch after fixing
        const { data: fixed } = await supabase
          .from("Savings_goals")
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
    Set_loading(false);
  }, [householdId, user_id]);

  useEffect(() => {
    Fetch_goals();
  }, [Fetch_goals]);

  const saveGoal = async () => {
    const title = Sanitize_text(goalForm.title, 60);
    const target = Sanitize_number(goalForm.target_amount, 1, 999999);
    if (!title || !target) return;

    try {
      const supabase = Get_supabase_client();
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
          .from("Savings_goals")
          .update(payload)
          .eq("id", editingGoal.id);
        if (error) throw error;
        Toast_success("Goal updated.");
      } else {
        const { error } = await supabase.from("Savings_goals").insert(payload);
        if (error) throw error;
        Toast_success("Goal created!");
      }

      goalModal.close_modal();
      Fetch_goals();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
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
    if (!Delete_target) return;
    Set_deleting(true);
    try {
      const supabase = Get_supabase_client();
      const { error } = await supabase
        .from("Savings_goals")
        .delete()
        .eq("id", Delete_target.id);
      if (error) throw error;
      Delete_modal.close_modal();
      Toast_success("Goal deleted.");
      setGoals((prev) => prev.filter((g) => g.id !== Delete_target.id));
      Set_delete_target(null);
      Fetch_goals();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
    Set_deleting(false);
  };

  const openContribute = (goal) => {
    Set_active_goal(goal);
    Set_contribute_form({ amount: "", note: "" });
    resetContribFieldStates();
    contributeModal.open_modal();
  };

  const submitContribution = async () => {
    const amount = Sanitize_number(Contribute_form.amount, 0.01, 999999);
    if (!amount || !Active_goal) return;

    try {
      const supabase = Get_supabase_client();

      // Insert contribution record
      const { error: contribError } = await supabase
        .from("savings_contributions")
        .insert({
          goal_id: Active_goal.id,
          user_id: user_id,
          amount: Number(amount.toFixed(2)),
          note: Sanitize_text(Contribute_form.note, 200) || null,
        });

      if (contribError) throw contribError;

      // Update goal's current_amount
      const newAmount = Number(Active_goal.current_amount) + amount;
      const { error: updateError } = await supabase
        .from("Savings_goals")
        .update({ current_amount: Number(newAmount.toFixed(2)) })
        .eq("id", Active_goal.id);

      if (updateError) throw updateError;

      contributeModal.close_modal();
      Toast_success(`Added ${Format_money(amount)}!`);
      Fetch_goals();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
  };

  if (Loading) return null;

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
                      {Format_money(goal.current_amount)} /{" "}
                      {Format_money(goal.target_amount)}
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
                        Set_delete_target(goal);
                        Delete_modal.open_modal();
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
                      <span>{Format_money(remaining)} to go</span>
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
                  Haptic_error();
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
                  Haptic_error();
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
        title={`Add to "${Active_goal?.title || ""}"`}
      >
        <div className="savings-goals__form">
          {/* Goal progress preview */}
          {Active_goal && (() => {
            const progress = Active_goal.target_amount > 0
              ? Math.min(100, (Active_goal.current_amount / Active_goal.target_amount) * 100)
              : 0;
            const remaining = Math.max(0, Active_goal.target_amount - Active_goal.current_amount);
            return (
              <div className="savings-goals__contrib-preview">
                <div className="savings-goals__contrib-header">
                  <span className="savings-goals__contrib-icon">{Active_goal.icon || "🎯"}</span>
                  <div className="savings-goals__contrib-info">
                    <span className="savings-goals__contrib-title">{Active_goal.title}</span>
                    <span className="savings-goals__contrib-amounts">
                      {Format_money(Active_goal.current_amount)} / {Format_money(Active_goal.target_amount)}
                    </span>
                  </div>
                </div>
                <div className="savings-goals__progress-wrap">
                  <div className="savings-goals__progress-bar">
                    <div
                      className="savings-goals__progress-fill"
                      style={{ width: `${progress}%`, background: Active_goal.color || "#818cf8" }}
                    />
                  </div>
                  <div className="savings-goals__progress-meta">
                    <span>{Math.round(progress)}%</span>
                    {remaining > 0 ? (
                      <span>{Format_money(remaining)} to go</span>
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
              value={Contribute_form.amount}
              onChange={(e) => {
                Set_contribute_form((f) => ({ ...f, amount: e.target.value }));
                if (contribAmountTouched) validateContribAmount(e.target.value);
              }}
              onBlur={() => {
                setContribAmountTouched(true);
                validateContribAmount(Contribute_form.amount, true);
                if (
                  !Contribute_form.amount ||
                  Number(Contribute_form.amount) <= 0
                ) {
                  setGoalShakeKey((k) => k + 1);
                  Haptic_error();
                }
              }}
              placeholder="100"
              autoFocus
            />
          </FormField>
          <FormField label="Note" optional>
            <input
              type="text"
              value={Contribute_form.note}
              onChange={(e) =>
                Set_contribute_form((f) => ({ ...f, note: e.target.value }))
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
                !Contribute_form.amount || Number(Contribute_form.amount) <= 0
              }
            >
              Add{" "}
              {Contribute_form.amount
                ? Format_money(Number(Contribute_form.amount))
                : ""}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!Delete_target}
        closing={Delete_modal.closing}
        onClose={() => {
          Delete_modal.close_modal();
          setTimeout(() => Set_delete_target(null), 260);
        }}
        onConfirm={confirmDeleteGoal}
        Loading={Deleting}
        title="Delete this goal?"
        description={`"${Delete_target?.title}" and all its contributions will be removed.`}
        confirm_label="Delete"
        variant="danger"
      />
    </div>
  );
}

export default SavingsGoals;
