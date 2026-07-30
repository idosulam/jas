import { useCallback, useEffect, useMemo, useState } from "react";
import { get_supabase_client } from "../../../Lib/Superbase";
import { get_user_facing_error, haptic_error } from "../../../Lib/Security";
import { use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import { use_modal, use_body_scroll_lock } from "../../../Hooks";
import SheetModal from "../../UI/Modals/Sheet_modal";
import ConfirmModal from "../../UI/Modals/Confirm_modal";
import FormField from "../../UI/Form/Form_field.jsx";
import EmptyState from "../../UI/Empty_state";
import { format_money } from "../../../Lib/format";
import ColorPalettePicker from "../../../Lib/Color_palette_picker.jsx";
import { DEFAULT_ICONS } from "./Category_manager";

function Budgets({
  householdId,
  transactions,
  month,
  year,
  onNavigateToTransactions,
}) {
  const [budgets, setBudgets] = useState([]);
  const [budgetCategories, setBudgetCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, set_loading] = useState(true);
  const { success: toast_success, error: toast_error } = use_glass_toast();

  // Edit budget modal
  const editModal = use_modal(260);
  const [editingBudget, setEditingBudget] = useState(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("📊");
  const [editColor, setEditColor] = useState("#818cf8");
  const [editAmount, setEditAmount] = useState("");
  const [editSelectedCats, setEditSelectedCats] = useState(new Set());
  const [editNameError, setEditNameError] = useState(null);
  const [editAmountError, setEditAmountError] = useState(null);

  // Create budget modal
  const createModal = use_modal(260);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📊");
  const [newColor, setNewColor] = useState("#818cf8");
  const [newAmount, setNewAmount] = useState("");
  const [newSelectedCats, setNewSelectedCats] = useState(new Set());
  const [newNameError, setNewNameError] = useState(null);
  const [newAmountError, setNewAmountError] = useState(null);

  // Delete confirm
  const delete_modal = use_modal(260);
  const [delete_target, set_delete_target] = useState(null);

  const [shake_key, set_shake_key] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  use_body_scroll_lock(editModal.open, createModal.open, delete_modal.open);

  // ── Fetch ──

  const fetchCategories = useCallback(async () => {
    if (!householdId) return;
    try {
      const supabase = get_supabase_client();
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
  }, [householdId]);

  const fetch_budgets = useCallback(async () => {
    if (!householdId) {
      set_loading(false);
      return;
    }
    try {
      const supabase = get_supabase_client();
      const { data: budgetData, error: budgetErr } = await supabase
        .from("budgets")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at");

      if (budgetErr) throw budgetErr;

      const budgetIds = (budgetData ?? []).map((b) => b.id);
      let catLinks = [];
      if (budgetIds.length > 0) {
        const { data: linkData, error: linkErr } = await supabase
          .from("budget_categories")
          .select("*")
          .in("budget_id", budgetIds);
        if (linkErr) throw linkErr;
        catLinks = linkData ?? [];
      }

      setBudgets(budgetData ?? []);
      setBudgetCategories(catLinks);
    } catch {
      // silent
    }
    set_loading(false);
  }, [householdId]);

  useEffect(() => {
    fetchCategories();
    fetch_budgets();
  }, [fetchCategories, fetch_budgets]);

  // ── Derived data ──

  const catMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => (m[c.id] = c));
    return m;
  }, [categories]);

  const budgetData = useMemo(() => {
    const expenseTx = transactions.filter((t) => t.type === "expense");

    return budgets.map((budget) => {
      const catIds = budgetCategories
        .filter((bc) => bc.budget_id === budget.id)
        .map((bc) => bc.category_id);

      const spent = expenseTx
        .filter((t) => catIds.includes(t.category_id))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const amount = Number(budget.amount);
      const remaining = amount - spent;
      const progress =
        amount > 0 ? Math.min(100, (spent / amount) * 100) : 0;

      const linkedCats = catIds.map((id) => catMap[id]).filter(Boolean);

      return {
        ...budget,
        catIds,
        linkedCats,
        spent,
        remaining,
        progress,
      };
    });
  }, [budgets, budgetCategories, transactions, catMap]);

  const overall_summary = useMemo(() => {
    const totalBudget = budgetData.reduce((s, b) => s + Number(b.amount), 0);
    const totalSpent = budgetData.reduce((s, b) => s + b.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const progress =
      totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
    return { totalBudget, totalSpent, totalRemaining, progress };
  }, [budgetData]);

  const getStatusColor = (progress, remaining) => {
    if (remaining != null && remaining < 0)
      return "var(--color-danger, #f87171)";
    if (progress >= 90) return "var(--color-warning, #fbbf24)";
    if (progress >= 70) return "var(--color-orange, #f97316)";
    return "var(--color-success, #34d399)";
  };

  // ── Create ──

  const openCreateModal = () => {
    setNewName("");
    setNewIcon("📊");
    setNewColor("#818cf8");
    setNewAmount("");
    setNewSelectedCats(new Set());
    setNewNameError(null);
    setNewAmountError(null);
    createModal.open_modal();
  };

  const toggleNewCat = (catId) => {
    setNewSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const createBudget = async () => {
    let has_error = false;
    if (!newName.trim()) {
      setNewNameError("Name is required");
      has_error = true;
    }
    const amount = Number(newAmount);
    if (!newAmount || isNaN(amount) || amount <= 0) {
      setNewAmountError("Enter a valid amount");
      has_error = true;
    }
    if (newSelectedCats.size === 0) {
      toast_error("Select at least one category to track.");
      return;
    }
    if (has_error) {
      set_shake_key((k) => k + 1);
      haptic_error();
      return;
    }

    setSubmitting(true);
    try {
      const supabase = get_supabase_client();
      const { data: budgetRow, error: budgetErr } = await supabase
        .from("budgets")
        .insert({
          household_id: householdId,
          name: newName.trim(),
          icon: newIcon,
          color: newColor,
          amount: Number(Number(amount).toFixed(2)),
        })
        .select()
        .single();

      if (budgetErr) throw budgetErr;

      const links = [...newSelectedCats].map((catId) => ({
        budget_id: budgetRow.id,
        category_id: catId,
      }));
      const { error: linkErr } = await supabase
        .from("budget_categories")
        .insert(links);

      if (linkErr) throw linkErr;

      createModal.close_modal();
      toast_success(`Budget "${newName.trim()}" created.`);
      fetch_budgets();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    setSubmitting(false);
  };

  // ── Edit ──

  const openEditBudget = (budget) => {
    setEditingBudget(budget);
    setEditName(budget.name);
    setEditIcon(budget.icon);
    setEditColor(budget.color);
    setEditAmount(String(budget.amount));
    setEditSelectedCats(new Set(budget.catIds));
    setEditNameError(null);
    setEditAmountError(null);
    editModal.open_modal();
  };

  const toggleEditCat = (catId) => {
    setEditSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const saveEdit = async () => {
    let has_error = false;
    if (!editName.trim()) {
      setEditNameError("Name is required");
      has_error = true;
    }
    const amount = Number(editAmount);
    if (!editAmount || isNaN(amount) || amount <= 0) {
      setEditAmountError("Enter a valid amount");
      has_error = true;
    }
    if (editSelectedCats.size === 0) {
      toast_error("Select at least one category to track.");
      return;
    }
    if (has_error) {
      set_shake_key((k) => k + 1);
      haptic_error();
      return;
    }

    setSubmitting(true);
    try {
      const supabase = get_supabase_client();

      // Update budget row
      const { error: updateErr } = await supabase
        .from("budgets")
        .update({
          name: editName.trim(),
          icon: editIcon,
          color: editColor,
          amount: Number(Number(amount).toFixed(2)),
        })
        .eq("id", editingBudget.id);

      if (updateErr) throw updateErr;

      // Replace category links: delete old, insert new
      await supabase
        .from("budget_categories")
        .delete()
        .eq("budget_id", editingBudget.id);

      const links = [...editSelectedCats].map((catId) => ({
        budget_id: editingBudget.id,
        category_id: catId,
      }));
      if (links.length > 0) {
        const { error: linkErr } = await supabase
          .from("budget_categories")
          .insert(links);
        if (linkErr) throw linkErr;
      }

      editModal.close_modal();
      toast_success(`Budget "${editName.trim()}" updated.`);
      fetch_budgets();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    setSubmitting(false);
  };

  // ── Delete ──

  const openDeleteBudget = (budget) => {
    set_delete_target(budget);
    delete_modal.open_modal();
  };

  const confirm_delete = async () => {
    if (!delete_target) return;
    setSubmitting(true);
    try {
      const supabase = get_supabase_client();
      const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("id", delete_target.id);
      if (error) throw error;

      delete_modal.close_modal();
      toast_success(`Budget "${delete_target.name}" deleted.`);
      fetch_budgets();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    setSubmitting(false);
  };

  // ── Render helpers ──

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const renderCategoryPicker = (selectedSet, toggleFn) => (
    <div className="budgets__cat-picker">
      {categories.map((cat) => {
        const isSelected = selectedSet.has(cat.id);
        return (
          <button
            key={cat.id}
            type="button"
            className={`budgets__cat-chip${isSelected ? " budgets__cat-chip--selected" : ""}`}
            style={{
              "--chip-color": cat.color,
              borderColor: isSelected ? cat.color : undefined,
            }}
            onClick={() => toggleFn(cat.id)}
          >
            <span className="budgets__cat-chip-icon">{cat.icon}</span>
            <span className="budgets__cat-chip-name">{cat.name}</span>
          </button>
        );
      })}
    </div>
  );

  if (loading) return null;

  return (
    <div className="budgets">
      {/* Create Budget Button — match goals header */}
      <div className="budgets__header">
        <h3 className="household__section-title">Budgets</h3>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="budgets__header-add"
          onClick={openCreateModal}
          title="Create budget"
        >
          +
        </button>
      </div>

      {/* Overall Summary */}
      {budgetData.length > 0 && (
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
                  {format_money(overall_summary.totalBudget)}
                </span>
              </div>
              <div className="budgets__summary-divider" />
              <div className="budgets__summary-item">
                <span className="budgets__summary-label">Spent</span>
                <span className="budgets__summary-value budgets__summary-value--spent">
                  {format_money(overall_summary.totalSpent)}
                </span>
              </div>
              <div className="budgets__summary-divider" />
              <div className="budgets__summary-item">
                <span className="budgets__summary-label">Remaining</span>
                <span
                  className={`budgets__summary-value ${overall_summary.totalRemaining >= 0 ? "budgets__summary-value--ok" : "budgets__summary-value--over"}`}
                >
                  {overall_summary.totalRemaining >= 0 ? "" : "-"}
                  {format_money(Math.abs(overall_summary.totalRemaining))}
                </span>
              </div>
            </div>

            <div className="budgets__overall-bar">
              <div
                className="budgets__overall-fill"
                style={{
                  width: `${overall_summary.progress}%`,
                  background:
                    overall_summary.progress >= 100
                      ? "var(--color-danger, #f87171)"
                      : overall_summary.progress >= 85
                        ? "var(--color-warning, #fbbf24)"
                        : "var(--color-success, #34d399)",
                }}
              />
            </div>
            <span className="budgets__overall-pct">
              {Math.round(overall_summary.progress)}% used
            </span>
          </div>
        </div>
      )}

      {/* Budget Cards */}
      {budgetData.length > 0 && (
        <div className="budgets__section">
          <div className="budgets__list">
            {budgetData.map((budget) => {
              const statusColor = getStatusColor(
                budget.progress,
                budget.remaining,
              );
              const isOver =
                budget.remaining != null && budget.remaining < 0;

              return (
                <div
                  key={budget.id}
                  className={`budgets__card${isOver ? " budgets__card--over" : ""}`}
                >
                  <div className="budgets__card-header">
                    <span className="budgets__card-icon">
                      {budget.icon || "📊"}
                    </span>
                    <div className="budgets__card-info">
                      <span className="budgets__card-name">
                        {budget.name}
                      </span>
                      <span className="budgets__card-amounts">
                        {format_money(budget.spent)} /{" "}
                        {format_money(budget.amount)}
                      </span>
                    </div>
                    <div className="budgets__card-actions">
                      <button
                        type="button"
                        className="budgets__card-edit"
                        onClick={() => openEditBudget(budget)}
                        title="Edit budget"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="budgets__card-delete"
                        onClick={() => openDeleteBudget(budget)}
                        title="Delete budget"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Linked categories */}
                  <div className="budgets__card-cats">
                    {budget.linkedCats.map((cat) => (
                      <span
                        key={cat.id}
                        className="budgets__card-cat-tag"
                        style={{ color: cat.color, background: `${cat.color}15` }}
                      >
                        {cat.icon} {cat.name}
                      </span>
                    ))}
                  </div>

                  <div className="budgets__progress-wrap">
                    <div
                      className="budgets__progress-bar"
                      role="progressbar"
                      aria-valuenow={Math.round(budget.progress)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="budgets__progress-fill"
                        style={{
                          width: `${Math.min(budget.progress, 100)}%`,
                          background: statusColor,
                        }}
                      />
                    </div>
                    <div className="budgets__progress-meta">
                      <span>{Math.round(budget.progress)}%</span>
                      {budget.remaining >= 0 ? (
                        <span>{format_money(budget.remaining)} left</span>
                      ) : (
                        <span style={{ color: "var(--color-danger, #f87171)" }}>
                          Over by {format_money(Math.abs(budget.remaining))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {budgetData.length === 0 && (
        <EmptyState
          className="budgets__empty-state"
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 32, height: 32 }}
            >
              <path d="M3 3v18h18" />
              <path d="M7 16l4-8 4 4 4-6" />
            </svg>
          }
          title="No budgets yet"
          text="Create your first budget to start tracking spending across your categories."
          action={
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={openCreateModal}
            >
              + Add budget
            </button>
          }
        />
      )}

      {/* ── Create Modal ── */}
      <SheetModal
        open={createModal.open}
        closing={createModal.closing}
        onClose={() => createModal.close_modal()}
        title="Create budget"
      >
        <div className="budgets__form">
          <FormField
            label="Budget name"
            error={newNameError}
            state={newNameError ? "error" : newName ? "valid" : "idle"}
            show_indicator
            shake={newNameError ? shake_key : 0}
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNewNameError(null);
              }}
              placeholder="e.g. Monthly essentials, Ido, Fun"
              maxLength={32}
              autoFocus
            />
          </FormField>

          <FormField label="Icon">
            <div className="budgets__icon-picker">
              {DEFAULT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`budgets__icon-btn${newIcon === icon ? " budgets__icon-btn--active" : ""}`}
                  onClick={() => setNewIcon(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Color">
            <ColorPalettePicker value={newColor} onChange={setNewColor} />
          </FormField>

          <FormField
            label="Track categories"
            error={
              newSelectedCats.size === 0
                ? undefined
                : undefined
            }
          >
            <p className="budgets__form-hint">
              Pick which expense categories this budget tracks.
            </p>
            {renderCategoryPicker(newSelectedCats, toggleNewCat)}
          </FormField>

          <FormField
            label="Monthly budget (₪)"
            error={newAmountError}
            state={newAmountError ? "error" : newAmount ? "valid" : "idle"}
            show_indicator
            shake={newAmountError ? shake_key : 0}
          >
            <input
              type="number"
              min="1"
              step="10"
              value={newAmount}
              onChange={(e) => {
                setNewAmount(e.target.value);
                setNewAmountError(null);
              }}
              placeholder="500"
            />
          </FormField>

          <div className="budgets__quick-amounts">
            {[100, 200, 500, 1000, 2000].map((amt) => (
              <button
                key={amt}
                type="button"
                className={`budgets__quick-btn ${newAmount === String(amt) ? "active" : ""}`}
                onClick={() => {
                  setNewAmount(String(amt));
                  setNewAmountError(null);
                }}
              >
                {format_money(amt)}
              </button>
            ))}
          </div>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => createModal.close_modal()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={createBudget}
              disabled={
                submitting ||
                !newName.trim() ||
                !newAmount ||
                newSelectedCats.size === 0
              }
            >
              {submitting ? "Creating…" : "Create budget"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* ── Edit Modal ── */}
      <SheetModal
        open={editModal.open}
        closing={editModal.closing}
        onClose={() => editModal.close_modal()}
        title={`Edit ${editingBudget?.name || "budget"}`}
      >
        <div className="budgets__form">
          <FormField
            label="Budget name"
            error={editNameError}
            state={editNameError ? "error" : editName ? "valid" : "idle"}
            show_indicator
            shake={editNameError ? shake_key : 0}
          >
            <input
              type="text"
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                setEditNameError(null);
              }}
              maxLength={32}
            />
          </FormField>

          <FormField label="Icon">
            <div className="budgets__icon-picker">
              {DEFAULT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`budgets__icon-btn${editIcon === icon ? " budgets__icon-btn--active" : ""}`}
                  onClick={() => setEditIcon(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Color">
            <ColorPalettePicker value={editColor} onChange={setEditColor} />
          </FormField>

          <FormField label="Track categories">
            <p className="budgets__form-hint">
              Pick which expense categories this budget tracks.
            </p>
            {renderCategoryPicker(editSelectedCats, toggleEditCat)}
          </FormField>

          <FormField
            label="Monthly budget (₪)"
            error={editAmountError}
            state={editAmountError ? "error" : editAmount ? "valid" : "idle"}
            show_indicator
            shake={editAmountError ? shake_key : 0}
          >
            <input
              type="number"
              min="1"
              step="10"
              value={editAmount}
              onChange={(e) => {
                setEditAmount(e.target.value);
                setEditAmountError(null);
              }}
            />
          </FormField>

          <div className="budgets__quick-amounts">
            {[100, 200, 500, 1000, 2000].map((amt) => (
              <button
                key={amt}
                type="button"
                className={`budgets__quick-btn ${editAmount === String(amt) ? "active" : ""}`}
                onClick={() => {
                  setEditAmount(String(amt));
                  setEditAmountError(null);
                }}
              >
                {format_money(amt)}
              </button>
            ))}
          </div>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn--danger-outline"
              onClick={() => {
                editModal.close_modal();
                setTimeout(() => openDeleteBudget(editingBudget), 280);
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => editModal.close_modal()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={saveEdit}
              disabled={
                submitting ||
                !editName.trim() ||
                !editAmount ||
                editSelectedCats.size === 0
              }
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* ── Delete Confirm ── */}
      {delete_target && (
        <ConfirmModal
          open={delete_modal.open}
          closing={delete_modal.closing}
          onClose={() => delete_modal.close_modal()}
          onConfirm={confirm_delete}
          loading={submitting}
          title={`Delete "${delete_target.name}"?`}
          description="This will remove the budget. Transactions and categories are not affected."
          confirm_label="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}

export default Budgets;
