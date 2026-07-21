import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { getUserFacingError, sanitizeNumber, sanitizeText } from "../../../lib/security";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import { useModal, useBodyScrollLock } from "../../../hooks";
import SheetModal from "../../ui/modals/Sheet_modal";
import ConfirmModal from "../../ui/modals/Confirm_modal";
import FormField from "../../ui/form/Form_field.jsx";
import GlassCard from "../../ui/Glass_card";

const GOAL_ICONS = ["🎯", "✈️", "🏠", "🚗", "💍", "📱", "💻", "🎸", "📚", "🏋️", "🐕", "🎓"];
const GOAL_COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24", "#f87171", "#60a5fa", "#a78bfa", "#fb923c"];

function formatMoney(amount) {
  return `₪${Number(amount || 0).toFixed(2)}`;
}

function SavingsGoals({ householdId, userId, members }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const goalModal = useModal(260);
  const contributeModal = useModal(260);
  const deleteModal = useModal(260);

  const [goalForm, setGoalForm] = useState({
    title: "",
    target_amount: "",
    icon: "🎯",
    color: "#818cf8",
  });
  const [editingGoal, setEditingGoal] = useState(null);

  const [contributeForm, setContributeForm] = useState({
    amount: "",
    note: "",
  });
  const [activeGoal, setActiveGoal] = useState(null);

  useBodyScrollLock(goalModal.open, contributeModal.open, deleteModal.open);

  const fetchGoals = useCallback(async () => {
    if (!householdId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("savings_goals")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;
      setGoals(data ?? []);
    } catch (err) {
      // silent
    }
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const saveGoal = async () => {
    const title = sanitizeText(goalForm.title, 60);
    const target = sanitizeNumber(goalForm.target_amount, 1, 999999);
    if (!title || !target) return;

    try {
      const supabase = getSupabaseClient();
      const payload = {
        title,
        target_amount: Number(target.toFixed(2)),
        icon: goalForm.icon,
        color: goalForm.color,
        household_id: householdId,
        created_by: userId,
      };

      if (editingGoal) {
        const { error } = await supabase
          .from("savings_goals")
          .update(payload)
          .eq("id", editingGoal.id);
        if (error) throw error;
        toastSuccess("Goal updated.");
      } else {
        const { error } = await supabase.from("savings_goals").insert(payload);
        if (error) throw error;
        toastSuccess("Goal created!");
      }

      goalModal.closeModal();
      fetchGoals();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
  };

  const openEditGoal = (goal) => {
    setEditingGoal(goal);
    setGoalForm({
      title: goal.title,
      target_amount: String(goal.target_amount),
      icon: goal.icon || "🎯",
      color: goal.color || "#818cf8",
    });
    goalModal.openModal();
  };

  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalForm({ title: "", target_amount: "", icon: "🎯", color: "#818cf8" });
    goalModal.openModal();
  };

  const confirmDeleteGoal = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("savings_goals")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      deleteModal.closeModal();
      toastSuccess("Goal deleted.");
      fetchGoals();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setDeleting(false);
  };

  const openContribute = (goal) => {
    setActiveGoal(goal);
    setContributeForm({ amount: "", note: "" });
    contributeModal.openModal();
  };

  const submitContribution = async () => {
    const amount = sanitizeNumber(contributeForm.amount, 0.01, 999999);
    if (!amount || !activeGoal) return;

    try {
      const supabase = getSupabaseClient();

      // Insert contribution record
      const { error: contribError } = await supabase
        .from("savings_contributions")
        .insert({
          goal_id: activeGoal.id,
          user_id: userId,
          amount: Number(amount.toFixed(2)),
          note: sanitizeText(contributeForm.note, 200) || null,
        });

      if (contribError) throw contribError;

      // Update goal's current_amount
      const newAmount = Number(activeGoal.current_amount) + amount;
      const { error: updateError } = await supabase
        .from("savings_goals")
        .update({ current_amount: Number(newAmount.toFixed(2)) })
        .eq("id", activeGoal.id);

      if (updateError) throw updateError;

      contributeModal.closeModal();
      toastSuccess(`Added ${formatMoney(amount)}!`);
      fetchGoals();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
  };

  if (loading) return null;

  return (
    <div className="savings-goals">
      <div className="savings-goals__header">
        <h3 className="household__section-title">💰 Savings Goals</h3>
        <button type="button" className="btn btn--ghost btn--sm" onClick={openNewGoal}>
          + New goal
        </button>
      </div>

      {goals.length === 0 ? (
        <p className="savings-goals__empty">
          No savings goals yet. Create one to start tracking together!
        </p>
      ) : (
        <div className="savings-goals__list">
          {goals.map((goal) => {
            const progress = goal.target_amount > 0
              ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
              : 0;
            const remaining = Math.max(0, goal.target_amount - goal.current_amount);

            return (
              <div
                key={goal.id}
                className={`savings-goals__card${goal.is_completed ? " savings-goals__card--completed" : ""}`}
              >
                <div className="savings-goals__card-header">
                  <span className="savings-goals__icon">{goal.icon || "🎯"}</span>
                  <div className="savings-goals__card-info">
                    <span className="savings-goals__title">{goal.title}</span>
                    <span className="savings-goals__amounts">
                      {formatMoney(goal.current_amount)} / {formatMoney(goal.target_amount)}
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
                      onClick={() => { setDeleteTarget(goal); deleteModal.openModal(); }}
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
                      <span>{formatMoney(remaining)} to go</span>
                    ) : (
                      <span className="savings-goals__reached">🎉 Reached!</span>
                    )}
                  </div>
                </div>

                {goal.is_completed && (
                  <div className="savings-goals__celebration" aria-hidden="true">
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
        onClose={() => goalModal.closeModal()}
        title={editingGoal ? "Edit goal" : "New savings goal"}
      >
        <div className="savings-goals__form">
          <FormField label="Goal name">
            <input
              type="text"
              value={goalForm.title}
              onChange={(e) => setGoalForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Vacation fund"
              maxLength={60}
              autoFocus
            />
          </FormField>
          <FormField label="Target amount (₪)">
            <input
              type="number"
              min="1"
              step="0.01"
              value={goalForm.target_amount}
              onChange={(e) => setGoalForm((f) => ({ ...f, target_amount: e.target.value }))}
              placeholder="5000"
            />
          </FormField>
          <FormField label="Icon">
            <div className="savings-goals__icon-picker">
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`savings-goals__icon-btn${goalForm.icon === icon ? " savings-goals__icon-btn--active" : ""}`}
                  onClick={() => setGoalForm((f) => ({ ...f, icon }))}
                >
                  {icon}
                </button>
              ))}
            </div>
          </FormField>
          <FormField label="Color">
            <div className="savings-goals__color-picker">
              {GOAL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`savings-goals__color-btn${goalForm.color === color ? " savings-goals__color-btn--active" : ""}`}
                  style={{ background: color }}
                  onClick={() => setGoalForm((f) => ({ ...f, color }))}
                />
              ))}
            </div>
          </FormField>
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => goalModal.closeModal()}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={saveGoal}
              disabled={!goalForm.title.trim() || !goalForm.target_amount || Number(goalForm.target_amount) <= 0}
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
        onClose={() => contributeModal.closeModal()}
        title={`Add to "${activeGoal?.title || ""}"`}
      >
        <div className="savings-goals__form">
          <FormField label="Amount (₪)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={contributeForm.amount}
              onChange={(e) => setContributeForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="100"
              autoFocus
            />
          </FormField>
          <FormField label="Note" optional>
            <input
              type="text"
              value={contributeForm.note}
              onChange={(e) => setContributeForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. From my tips this week"
              maxLength={200}
            />
          </FormField>
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => contributeModal.closeModal()}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={submitContribution}
              disabled={!contributeForm.amount || Number(contributeForm.amount) <= 0}
            >
              Add {contributeForm.amount ? formatMoney(Number(contributeForm.amount)) : ""}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        closing={deleteModal.closing}
        onClose={() => { deleteModal.closeModal(); setTimeout(() => setDeleteTarget(null), 260); }}
        onConfirm={confirmDeleteGoal}
        loading={deleting}
        title="Delete this goal?"
        description={`"${deleteTarget?.title}" and all its contributions will be removed.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

export default SavingsGoals;
