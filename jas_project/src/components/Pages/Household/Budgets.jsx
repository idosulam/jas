import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { getUserFacingError, sanitizeNumber, hapticError } from "../../../lib/security";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import { useModal, useBodyScrollLock } from "../../../hooks";
import SheetModal from "../../ui/modals/Sheet_modal";
import FormField from "../../ui/form/Form_field.jsx";

function formatMoney(amount) {
  return `₪${Number(amount || 0).toFixed(2)}`;
}

function Budgets({ householdId, transactions, month, year }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const editModal = useModal(260);
  const [editingCategory, setEditingCategory] = useState(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetState, setBudgetState] = useState("idle");
  const [budgetError, setBudgetError] = useState(null);
  const [budgetTouched, setBudgetTouched] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useBodyScrollLock(editModal.open);

  const fetchCategories = useCallback(async () => {
    if (!householdId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("transaction_categories")
        .select("*")
        .eq("household_id", householdId)
        .eq("type", "expense")
        .order("name");
      if (error) throw error;
      setCategories(data ?? []);
    } catch {
      // silent
    }
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Calculate spending per category for current month
  const categoryBudgets = useMemo(() => {
    const expenseTx = transactions.filter((t) => t.type === "expense");

    return categories.map((cat) => {
      const spent = expenseTx
        .filter((t) => t.category_id === cat.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const budget = cat.budget_amount != null ? Number(cat.budget_amount) : null;
      const remaining = budget != null ? budget - spent : null;
      const progress = budget != null && budget > 0
        ? Math.min(100, (spent / budget) * 100)
        : null;

      return {
        ...cat,
        spent,
        budget,
        remaining,
        progress,
      };
    });
  }, [categories, transactions]);

  // Split into budgeted and unbudgeted
  const budgeted = categoryBudgets.filter((c) => c.budget != null);
  const unbudgeted = categoryBudgets.filter((c) => c.budget == null);

  // Overall summary
  const summary = useMemo(() => {
    const totalBudget = budgeted.reduce((sum, c) => sum + c.budget, 0);
    const totalSpent = budgeted.reduce((sum, c) => sum + c.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overallProgress = totalBudget > 0
      ? Math.min(100, (totalSpent / totalBudget) * 100)
      : 0;

    return { totalBudget, totalSpent, totalRemaining, overallProgress };
  }, [budgeted]);

  // Status color
  const getStatusColor = (progress, remaining) => {
    if (remaining != null && remaining < 0) return "var(--color-danger, #f87171)";
    if (progress >= 90) return "var(--color-warning, #fbbf24)";
    if (progress >= 70) return "var(--color-orange, #f97316)";
    return "var(--color-success, #34d399)";
  };

  // Validation
  const validateBudget = (value, isBlur = false) => {
    if (!value && value !== "0") {
      if (isBlur) {
        setBudgetState("error");
        setBudgetError("Budget amount is required");
      } else {
        setBudgetState("idle");
        setBudgetError(null);
      }
      return;
    }
    const num = Number(value);
    if (isNaN(num) || num < 0) {
      setBudgetState("error");
      setBudgetError("Enter a valid amount");
    } else {
      setBudgetState("valid");
      setBudgetError(null);
    }
  };

  const openEditBudget = (cat) => {
    setEditingCategory(cat);
    setBudgetInput(cat.budget != null ? String(cat.budget) : "");
    setBudgetTouched(false);
    setBudgetState("idle");
    setBudgetError(null);
    editModal.openModal();
  };

  const saveBudget = async () => {
    setBudgetTouched(true);
    validateBudget(budgetInput, true);

    if (!budgetInput && budgetInput !== "0") {
      setShakeKey((k) => k + 1);
      hapticError();
      return;
    }

    const amount = Number(Number(budgetInput).toFixed(2));
    if (isNaN(amount) || amount < 0) {
      setShakeKey((k) => k + 1);
      hapticError();
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("transaction_categories")
        .update({ budget_amount: amount === 0 ? null : amount })
        .eq("id", editingCategory.id);

      if (error) throw error;

      editModal.closeModal();
      toastSuccess(
        amount === 0
          ? `Budget removed from "${editingCategory.name}".`
          : `Budget set for "${editingCategory.name}": ${formatMoney(amount)}/month`
      );
      fetchCategories();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setSubmitting(false);
  };

  const removeBudget = async () => {
    if (!editingCategory) return;
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("transaction_categories")
        .update({ budget_amount: null })
        .eq("id", editingCategory.id);

      if (error) throw error;

      editModal.closeModal();
      toastSuccess(`Budget removed from "${editingCategory.name}".`);
      fetchCategories();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setSubmitting(false);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  if (loading) return null;

  return (
    <div className="budgets">
      {/* Overall Budget Summary */}
      {budgeted.length > 0 && (
        <div className="budgets__summary">
          <div className="budgets__summary-header">
            <h3 className="household__section-title">
              📊 {monthNames[month]} Budget
            </h3>
          </div>

          <div className="budgets__summary-card">
            <div className="budgets__summary-numbers">
              <div className="budgets__summary-item">
                <span className="budgets__summary-label">Budget</span>
                <span className="budgets__summary-value">
                  {formatMoney(summary.totalBudget)}
                </span>
              </div>
              <div className="budgets__summary-divider" />
              <div className="budgets__summary-item">
                <span className="budgets__summary-label">Spent</span>
                <span className="budgets__summary-value budgets__summary-value--spent">
                  {formatMoney(summary.totalSpent)}
                </span>
              </div>
              <div className="budgets__summary-divider" />
              <div className="budgets__summary-item">
                <span className="budgets__summary-label">Remaining</span>
                <span
                  className={`budgets__summary-value ${summary.totalRemaining >= 0 ? "budgets__summary-value--ok" : "budgets__summary-value--over"}`}
                >
                  {summary.totalRemaining >= 0 ? "" : "-"}
                  {formatMoney(Math.abs(summary.totalRemaining))}
                </span>
              </div>
            </div>

            <div className="budgets__overall-bar">
              <div
                className="budgets__overall-fill"
                style={{
                  width: `${summary.overallProgress}%`,
                  background:
                    summary.overallProgress >= 100
                      ? "var(--color-danger, #f87171)"
                      : summary.overallProgress >= 85
                        ? "var(--color-warning, #fbbf24)"
                        : "var(--color-success, #34d399)",
                }}
              />
            </div>
            <span className="budgets__overall-pct">
              {Math.round(summary.overallProgress)}% used
            </span>
          </div>
        </div>
      )}

      {/* Budgeted Categories */}
      {budgeted.length > 0 && (
        <div className="budgets__section">
          <h3 className="household__section-title">Budgeted</h3>
          <div className="budgets__list">
            {budgeted.map((cat) => {
              const statusColor = getStatusColor(cat.progress, cat.remaining);
              const isOver = cat.remaining != null && cat.remaining < 0;

              return (
                <div
                  key={cat.id}
                  className={`budgets__card ${isOver ? "budgets__card--over" : ""}`}
                  onClick={() => openEditBudget(cat)}
                >
                  <div className="budgets__card-header">
                    <div
                      className="budgets__card-icon"
                      style={{
                        background: `${cat.color}18`,
                        color: cat.color,
                      }}
                    >
                      {cat.icon}
                    </div>
                    <div className="budgets__card-info">
                      <span className="budgets__card-name">{cat.name}</span>
                      <span className="budgets__card-amounts">
                        {formatMoney(cat.spent)}{" "}
                        <span className="budgets__card-sep">of</span>{" "}
                        {formatMoney(cat.budget)}
                      </span>
                    </div>
                    <div className="budgets__card-status">
                      {isOver ? (
                        <span className="budgets__card-over-badge">
                          Over by {formatMoney(Math.abs(cat.remaining))}
                        </span>
                      ) : cat.progress >= 90 ? (
                        <span className="budgets__card-warn-badge">
                          {formatMoney(cat.remaining)} left
                        </span>
                      ) : (
                        <span className="budgets__card-remaining">
                          {formatMoney(cat.remaining)} left
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="budgets__card-bar-wrap">
                    <div className="budgets__card-bar">
                      <div
                        className="budgets__card-fill"
                        style={{
                          width: `${Math.min(cat.progress, 100)}%`,
                          background: statusColor,
                        }}
                      />
                      {isOver && (
                        <div
                          className="budgets__card-fill budgets__card-fill--over"
                          style={{
                            width: `${Math.min(cat.progress - 100, 100)}%`,
                            background: "var(--color-danger, #f87171)",
                            opacity: 0.4,
                          }}
                        />
                      )}
                    </div>
                    <span className="budgets__card-pct" style={{ color: statusColor }}>
                      {Math.round(cat.progress)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unbudgeted Categories */}
      {categoryBudgets.length > 0 && (
        <div className="budgets__section">
          <h3 className="household__section-title">
            {budgeted.length > 0 ? "Set a Budget" : "Categories"}
          </h3>
          {unbudgeted.length === 0 && budgeted.length > 0 ? (
            <p className="budgets__all-set">
              All categories have budgets! 🎉
            </p>
          ) : (
            <div className="budgets__unbudgeted-list">
              {(budgeted.length > 0 ? unbudgeted : categoryBudgets).map((cat) => (
                <div
                  key={cat.id}
                  className="budgets__unbudgeted-item"
                  onClick={() => openEditBudget(cat)}
                >
                  <div
                    className="budgets__unbudgeted-icon"
                    style={{
                      background: `${cat.color}18`,
                      color: cat.color,
                    }}
                  >
                    {cat.icon}
                  </div>
                  <div className="budgets__unbudgeted-info">
                    <span className="budgets__unbudgeted-name">{cat.name}</span>
                    <span className="budgets__unbudgeted-spent">
                      {formatMoney(cat.spent)} spent this month
                    </span>
                  </div>
                  <span className="budgets__unbudgeted-action">Set budget →</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {categoryBudgets.length === 0 && (
        <div className="budgets__empty">
          <span className="budgets__empty-icon">📊</span>
          <p>No expense categories yet.</p>
          <span>Create categories in the Transactions tab first.</span>
        </div>
      )}

      {/* Edit Budget Modal */}
      <SheetModal
        open={editModal.open}
        closing={editModal.closing}
        onClose={() => editModal.closeModal()}
        title={`${editingCategory?.budget != null ? "Edit" : "Set"} budget for ${editingCategory?.name || ""}`}
      >
        <div className="budgets__form">
          <div className="budgets__form-category">
            <span
              className="budgets__form-icon"
              style={{
                background: `${editingCategory?.color}18`,
                color: editingCategory?.color,
              }}
            >
              {editingCategory?.icon}
            </span>
            <div className="budgets__form-cat-info">
              <span className="budgets__form-cat-name">{editingCategory?.name}</span>
              <span className="budgets__form-cat-spent">
                {formatMoney(editingCategory?.spent || 0)} spent this month
              </span>
            </div>
          </div>

          <FormField
            label="Monthly budget (₪)"
            error={budgetError}
            state={budgetState}
            showIndicator
            shake={budgetError ? shakeKey : 0}
          >
            <input
              type="number"
              min="0"
              step="10"
              value={budgetInput}
              onChange={(e) => {
                setBudgetInput(e.target.value);
                if (budgetTouched) validateBudget(e.target.value);
              }}
              onBlur={() => {
                setBudgetTouched(true);
                validateBudget(budgetInput, true);
                if (!budgetInput && budgetInput !== "0") {
                  setShakeKey((k) => k + 1);
                  hapticError();
                }
              }}
              placeholder="500"
              autoFocus
            />
          </FormField>

          {/* Quick amount buttons */}
          <div className="budgets__quick-amounts">
            {[100, 200, 500, 1000, 2000].map((amt) => (
              <button
                key={amt}
                type="button"
                className={`budgets__quick-btn ${budgetInput === String(amt) ? "active" : ""}`}
                onClick={() => {
                  setBudgetInput(String(amt));
                  setBudgetTouched(true);
                  validateBudget(String(amt));
                }}
              >
                {formatMoney(amt)}
              </button>
            ))}
          </div>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => editModal.closeModal()}
            >
              Cancel
            </button>
            {editingCategory?.budget != null && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={removeBudget}
                disabled={submitting}
              >
                Remove
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={saveBudget}
              disabled={submitting || (!budgetInput && budgetInput !== "0")}
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </SheetModal>
    </div>
  );
}

export default Budgets;
