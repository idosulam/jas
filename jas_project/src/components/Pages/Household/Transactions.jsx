import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import {
  getUserFacingError,
  sanitizeNumber,
  sanitizeText,
  hapticError,
} from "../../../lib/security";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import { useModal, useBodyScrollLock } from "../../../hooks";
import SheetModal from "../../ui/modals/Sheet_modal";
import ConfirmModal from "../../ui/modals/Confirm_modal";
import FormField from "../../ui/form/Form_field.jsx";

function formatMoney(amount) {
  return `₪${Number(amount || 0).toFixed(2)}`;
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateGroup(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const DEFAULT_ICONS = [
  "🍔", "🚗", "🛍️", "💡", "🎬", "💊", "📚", "🏠",
  "👕", "🎁", "📱", "📦", "💰", "💻", "💵", "🎉",
  "📈", "☕", "✈️", "🏋️", "🐕", "🎵", "💊", "🔧",
];

const DEFAULT_COLORS = [
  "#f97316", "#3b82f6", "#ec4899", "#eab308", "#a855f7",
  "#22c55e", "#06b6d4", "#78716c", "#f472b6", "#fb923c",
  "#8b5cf6", "#6b7280", "#ef4444", "#14b8a6", "#f59e0b",
];

function Transactions({ householdId, userId, members, goals = [] }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState("all");

  const { success: toastSuccess, error: toastError } = useGlassToast();
  const addModal = useModal(260);
  const editModal = useModal(260);
  const deleteModal = useModal(260);
  const categoryModal = useModal(260);
  const deleteCategoryModal = useModal(260);

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    description: "",
    note: "",
    category_id: "",
    goal_id: "",
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  const [editingTx, setEditingTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    icon: "📦",
    color: "#818cf8",
    type: "expense",
  });
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  // Field states
  const [amountState, setAmountState] = useState("idle");
  const [amountError, setAmountError] = useState(null);
  const [amountTouched, setAmountTouched] = useState(false);
  const [descState, setDescState] = useState("idle");
  const [descError, setDescError] = useState(null);
  const [descTouched, setDescTouched] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  useBodyScrollLock(
    addModal.open, editModal.open, deleteModal.open,
    categoryModal.open, deleteCategoryModal.open
  );

  const now = new Date();
  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 11 }, (_, i) => current - 5 + i);
  }, []);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!householdId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("transaction_categories")
        .select("*")
        .eq("household_id", householdId)
        .order("name");

      if (error) throw error;
      setCategories(data ?? []);
    } catch {
      // silent
    }
  }, [householdId]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!householdId) return;
    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("transactions")
        .select("*, transaction_categories(name, icon, color), savings_goals(title, icon, color)")
        .eq("household_id", householdId)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((t) => {
        const member = members.find((m) => m.user_id === t.user_id);
        if (t.type === "contribute") {
          return {
            ...t,
            display_name: member?.display_name || "User",
            is_me: t.user_id === userId,
            category_name: t.savings_goals?.title || "Savings",
            category_icon: t.savings_goals?.icon || "🎯",
            category_color: t.savings_goals?.color || "#818cf8",
          };
        }
        return {
          ...t,
          display_name: member?.display_name || "User",
          is_me: t.user_id === userId,
          category_name: t.transaction_categories?.name || "Other",
          category_icon: t.transaction_categories?.icon || "📦",
          category_color: t.transaction_categories?.color || "#6b7280",
        };
      });

      setTransactions(enriched);
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setLoading(false);
  }, [householdId, members, userId, month, year]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => {
    if (householdId) fetchTransactions();
  }, [householdId, fetchTransactions]);

  // Filtered transactions
  const filtered = useMemo(() => {
    if (typeFilter === "all") return transactions;
    return transactions.filter((t) => t.type === typeFilter);
  }, [transactions, typeFilter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((t) => {
      const key = t.transaction_date;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  // Summary stats
  const stats = useMemo(() => {
    let totalExpense = 0;
    let totalIncome = 0;
    let totalContribute = 0;
    transactions.forEach((t) => {
      const amt = Number(t.amount);
      if (t.type === "expense") totalExpense += amt;
      else if (t.type === "income") totalIncome += amt;
      else if (t.type === "contribute") totalContribute += amt;
    });
    return {
      totalExpense,
      totalIncome,
      totalContribute,
      balance: totalIncome - totalExpense - totalContribute,
    };
  }, [transactions]);

  // Category breakdown for expenses
  const categoryBreakdown = useMemo(() => {
    const map = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const key = t.category_id || t.category_name;
        if (!map[key]) {
          map[key] = {
            name: t.category_name,
            icon: t.category_icon,
            color: t.category_color,
            total: 0,
            count: 0,
          };
        }
        map[key].total += Number(t.amount);
        map[key].count += 1;
      });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [transactions]);

  const maxCategoryTotal =
    categoryBreakdown.length > 0
      ? Math.max(...categoryBreakdown.map((c) => c.total))
      : 0;

  // Categories for current form type (from DB only)
  const availableCategories = useMemo(() => {
    if (form.type === "contribute") return [];
    return categories.filter((c) => c.type === form.type);
  }, [categories, form.type]);

  // Active goals for contribute picker
  const activeGoals = useMemo(() => {
    return goals.filter((g) => !g.is_completed);
  }, [goals]);

  // Validation
  const validateAmount = (value, isBlur = false) => {
    if (!value) {
      if (isBlur) { setAmountState("error"); setAmountError("Amount is required"); }
      else { setAmountState("idle"); setAmountError(null); }
      return;
    }
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      setAmountState("error"); setAmountError("Enter a valid amount");
    } else {
      setAmountState("valid"); setAmountError(null);
    }
  };

  const validateDesc = (value, isBlur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (isBlur) { setDescState("error"); setDescError("Description is required"); }
      else { setDescState("idle"); setDescError(null); }
      return;
    }
    setDescState("valid"); setDescError(null);
  };

  const resetFieldStates = () => {
    setAmountTouched(false); setAmountState("idle"); setAmountError(null);
    setDescTouched(false); setDescState("idle"); setDescError(null);
  };

  const openAdd = (type = "expense") => {
    setEditingTx(null);
    setForm({
      type,
      amount: "",
      description: "",
      note: "",
      category_id: "",
      goal_id: "",
      transaction_date: new Date().toISOString().slice(0, 10),
    });
    resetFieldStates();
    addModal.openModal();
  };

  const openEdit = (tx) => {
    setEditingTx(tx);
    setForm({
      type: tx.type,
      amount: String(tx.amount),
      description: tx.description || "",
      note: tx.note || "",
      category_id: tx.category_id || "",
      goal_id: tx.goal_id || "",
      transaction_date: tx.transaction_date,
    });
    resetFieldStates();
    editModal.openModal();
  };

  const handleSubmit = async () => {
    setAmountTouched(true);
    setDescTouched(true);
    validateAmount(form.amount, true);
    validateDesc(form.description, true);

    if (!form.amount || Number(form.amount) <= 0 || !form.description.trim()) {
      setShakeKey((k) => k + 1);
      hapticError();
      return;
    }

    // For contribute, require a goal
    if (form.type === "contribute" && !form.goal_id) {
      toastError("Please select a savings goal.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const amount = Number(Number(form.amount).toFixed(2));
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const payload = {
        household_id: householdId,
        user_id: userId,
        category_id: isUUID.test(form.category_id) ? form.category_id : null,
        goal_id: form.type === "contribute" && isUUID.test(form.goal_id) ? form.goal_id : null,
        type: form.type,
        amount,
        description: sanitizeText(form.description, 100),
        note: sanitizeText(form.note, 500) || null,
        transaction_date: form.transaction_date,
      };

      if (editingTx) {
        const { error } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", editingTx.id);
        if (error) throw error;
        toastSuccess("Transaction updated.");
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;

        // For contribute, also update the savings goal and create contribution record
        if (form.type === "contribute" && form.goal_id) {
          const goal = goals.find((g) => g.id === form.goal_id);
          if (goal) {
            const newAmount = Number(goal.current_amount) + amount;
            await supabase
              .from("savings_goals")
              .update({ current_amount: Number(newAmount.toFixed(2)) })
              .eq("id", form.goal_id);

            await supabase.from("savings_contributions").insert({
              goal_id: form.goal_id,
              user_id: userId,
              amount,
              note: sanitizeText(form.note, 200) || null,
            });
          }
        }

        const labels = { expense: "Expense", income: "Income", contribute: "Contribution" };
        toastSuccess(`${labels[form.type] || "Transaction"} added!`);
      }

      addModal.closeModal();
      editModal.closeModal();
      fetchTransactions();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setSubmitting(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      deleteModal.closeModal();
      editModal.closeModal();
      setEditingTx(null);
      toastSuccess("Transaction deleted.");
      fetchTransactions();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setDeleting(false);
  };

  // ── Category Management ──────────────────────────────────

  const openNewCategory = (type = "expense") => {
    setEditingCategory(null);
    setCategoryForm({ name: "", icon: "📦", color: "#818cf8", type });
    categoryModal.openModal();
  };

  const openEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      type: cat.type,
    });
    categoryModal.openModal();
  };

  const saveCategory = async () => {
    const name = sanitizeText(categoryForm.name, 40);
    if (!name) return;

    try {
      const supabase = getSupabaseClient();
      const payload = {
        name,
        icon: categoryForm.icon,
        color: categoryForm.color,
        type: categoryForm.type,
        household_id: householdId,
      };

      if (editingCategory) {
        const { error } = await supabase
          .from("transaction_categories")
          .update(payload)
          .eq("id", editingCategory.id);
        if (error) throw error;
        toastSuccess("Label updated.");
      } else {
        const { error } = await supabase
          .from("transaction_categories")
          .insert(payload);
        if (error) throw error;
        toastSuccess("Label created!");
      }

      categoryModal.closeModal();
      fetchCategories();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    setDeletingCategory(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("transaction_categories")
        .delete()
        .eq("id", deleteCategoryTarget.id);
      if (error) throw error;
      deleteCategoryModal.closeModal();
      categoryModal.closeModal();
      setEditingCategory(null);
      toastSuccess("Label deleted.");
      fetchCategories();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setDeletingCategory(false);
  };

  // ── Render ───────────────────────────────────────────────

  const typeLabel = form.type === "contribute" ? "contribution" : form.type;

  return (
    <div className="transactions">
      {/* Balance Card */}
      <div className="transactions__balance-card">
        <div className="transactions__balance-row">
          <div className="transactions__balance-item transactions__balance-item--income">
            <span className="transactions__balance-icon">↑</span>
            <div>
              <span className="transactions__balance-label">Income</span>
              <span className="transactions__balance-value transactions__balance-value--income">
                {formatMoney(stats.totalIncome)}
              </span>
            </div>
          </div>
          <div className="transactions__balance-divider" />
          <div className="transactions__balance-item transactions__balance-item--expense">
            <span className="transactions__balance-icon">↓</span>
            <div>
              <span className="transactions__balance-label">Expenses</span>
              <span className="transactions__balance-value transactions__balance-value--expense">
                {formatMoney(stats.totalExpense)}
              </span>
            </div>
          </div>
        </div>
        {stats.totalContribute > 0 && (
          <div className="transactions__balance-row" style={{ marginTop: 8 }}>
            <div className="transactions__balance-item" style={{ flex: 1 }}>
              <span className="transactions__balance-icon">🎯</span>
              <div>
                <span className="transactions__balance-label">Contributions</span>
                <span className="transactions__balance-value" style={{ color: "#818cf8" }}>
                  {formatMoney(stats.totalContribute)}
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="transactions__balance-net">
          <span className="transactions__balance-net-label">Balance</span>
          <span className={`transactions__balance-net-value ${stats.balance >= 0 ? "positive" : "negative"}`}>
            {stats.balance >= 0 ? "+" : ""}
            {formatMoney(stats.balance)}
          </span>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="transactions__tabs">
        {["all", "expense", "income", "contribute"].map((t) => (
          <button
            key={t}
            className={`transactions__tab ${typeFilter === t ? "transactions__tab--active" : ""}`}
            onClick={() => setTypeFilter(t)}
          >
            {t === "all" ? "All" : t === "expense" ? "Expenses" : t === "income" ? "Income" : "Contributions"}
          </button>
        ))}
      </div>

      {/* Category Breakdown (expenses only) */}
      {typeFilter !== "income" && typeFilter !== "contribute" && categoryBreakdown.length > 0 && (
        <div className="transactions__breakdown">
          <h3 className="transactions__section-title">By Category</h3>
          <div className="transactions__category-list">
            {categoryBreakdown.slice(0, 6).map((cat) => (
              <div key={cat.name} className="transactions__category-item">
                <div className="transactions__category-left">
                  <span className="transactions__category-icon">{cat.icon}</span>
                  <span className="transactions__category-name">{cat.name}</span>
                </div>
                <div className="transactions__category-right">
                  <div className="transactions__category-bar-wrap">
                    <div
                      className="transactions__category-bar"
                      style={{
                        width: `${maxCategoryTotal > 0 ? (cat.total / maxCategoryTotal) * 100 : 0}%`,
                        background: cat.color,
                      }}
                    />
                  </div>
                  <span className="transactions__category-amount">{formatMoney(cat.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="transactions__list-header">
        <h3 className="transactions__section-title">Transactions</h3>
        <div className="transactions__add-btns">
          <button className="btn btn--ghost btn--sm" onClick={() => openAdd("expense")}>
            + Expense
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => openAdd("income")} style={{ marginLeft: 6 }}>
            + Income
          </button>
          {activeGoals.length > 0 && (
            <button className="btn btn--primary btn--sm" onClick={() => openAdd("contribute")} style={{ marginLeft: 6 }}>
              + Contribute
            </button>
          )}
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="transactions__empty">
          <p>No transactions this month</p>
          <span>Add an expense, income, or contribution to get started.</span>
        </div>
      ) : (
        <div className="transactions__groups">
          {grouped.map(([date, items]) => {
            const dayTotal = items.reduce((sum, t) => {
              return sum + (t.type === "expense" ? -Number(t.amount) : Number(t.amount));
            }, 0);

            return (
              <div key={date} className="transactions__group">
                <div className="transactions__group-header">
                  <span className="transactions__group-date">{formatDateGroup(date)}</span>
                  <span className={`transactions__group-total ${dayTotal >= 0 ? "positive" : "negative"}`}>
                    {dayTotal >= 0 ? "+" : ""}
                    {formatMoney(Math.abs(dayTotal))}
                  </span>
                </div>
                <div className="transactions__group-items">
                  {items.map((tx) => (
                    <div key={tx.id} className="transactions__item" onClick={() => openEdit(tx)}>
                      <div
                        className="transactions__item-icon"
                        style={{ background: `${tx.category_color}18`, color: tx.category_color }}
                      >
                        {tx.category_icon}
                      </div>
                      <div className="transactions__item-info">
                        <span className="transactions__item-desc">{tx.description}</span>
                        <span className="transactions__item-meta">
                          {tx.category_name}
                          {` · ${tx.is_me ? "You" : tx.display_name}`}
                          {tx.is_recurring && " · 🔄"}
                        </span>
                      </div>
                      <span className={`transactions__item-amount ${tx.type}`}>
                        {tx.type === "expense" ? "-" : "+"}
                        {formatMoney(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add/Edit Modal ─────────────────────────────────── */}
      <SheetModal
        open={addModal.open || editModal.open}
        closing={addModal.closing || editModal.closing}
        onClose={() => { addModal.closeModal(); editModal.closeModal(); }}
        title={editingTx ? "Edit transaction" : `Add ${typeLabel}`}
      >
        <div className="transactions__form">
          {/* Type Toggle */}
          <div className="transactions__type-toggle">
            {["expense", "income", "contribute"].map((t) => (
              <button
                key={t}
                className={`transactions__type-btn ${form.type === t ? `transactions__type-btn--active ${t}` : ""}`}
                onClick={() => setForm((f) => ({ ...f, type: t, category_id: "", goal_id: "" }))}
              >
                {t === "expense" ? "Expense" : t === "income" ? "Income" : "🎯 Contribute"}
              </button>
            ))}
          </div>

          <FormField label="Amount" error={amountError} state={amountState} showIndicator shake={amountError ? shakeKey : 0}>
            <input
              type="number" min="0.01" step="0.01"
              value={form.amount}
              onChange={(e) => { setForm((f) => ({ ...f, amount: e.target.value })); if (amountTouched) validateAmount(e.target.value); }}
              onBlur={() => {
                setAmountTouched(true); validateAmount(form.amount, true);
                if (!form.amount || Number(form.amount) <= 0) { setShakeKey((k) => k + 1); hapticError(); }
              }}
              placeholder="0.00" autoFocus
            />
          </FormField>

          <FormField label="Description" error={descError} state={descState} showIndicator shake={descError ? shakeKey : 0}>
            <input
              type="text"
              value={form.description}
              onChange={(e) => { setForm((f) => ({ ...f, description: e.target.value })); if (descTouched) validateDesc(e.target.value); }}
              onBlur={() => {
                setDescTouched(true); validateDesc(form.description, true);
                if (!form.description.trim()) { setShakeKey((k) => k + 1); hapticError(); }
              }}
              placeholder={form.type === "contribute" ? "e.g. Monthly savings" : "What was this for?"}
              maxLength={100}
            />
          </FormField>

          {/* Goal Picker (contribute type) */}
          {form.type === "contribute" && (
            <div className="transactions__category-grid-wrap">
              <label className="transactions__form-label">Savings Goal</label>
              {activeGoals.length === 0 ? (
                <p style={{ color: "var(--text-muted, #888)", fontSize: 14 }}>No active goals. Create one first.</p>
              ) : (
                <div className="transactions__category-grid">
                  {activeGoals.map((goal) => {
                    const isActive = form.goal_id === goal.id;
                    return (
                      <button
                        key={goal.id}
                        type="button"
                        className={`transactions__category-chip ${isActive ? "active" : ""}`}
                        style={isActive ? { borderColor: goal.color, background: `${goal.color}15` } : {}}
                        onClick={() => setForm((f) => ({ ...f, goal_id: goal.id }))}
                      >
                        <span>{goal.icon || "🎯"}</span>
                        <span>{goal.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Category Grid (expense / income) */}
          {form.type !== "contribute" && (
            <div className="transactions__category-grid-wrap">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="transactions__form-label">Category</label>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ fontSize: 12, padding: "2px 8px" }}
                  onClick={() => openNewCategory(form.type)}
                >
                  + Edit labels
                </button>
              </div>
              {availableCategories.length === 0 ? (
                <p style={{ color: "var(--text-muted, #888)", fontSize: 14 }}>
                  No labels yet. Tap "+ Edit labels" to create your own.
                </p>
              ) : (
                <div className="transactions__category-grid">
                  {availableCategories.map((cat) => {
                    const isActive = form.category_id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={`transactions__category-chip ${isActive ? "active" : ""}`}
                        style={isActive ? { borderColor: cat.color, background: `${cat.color}15` } : {}}
                        onClick={() => setForm((f) => ({ ...f, category_id: cat.id }))}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <FormField label="Date">
            <input
              type="date"
              value={form.transaction_date}
              onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
            />
          </FormField>

          <FormField label="Note (optional)">
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Add a note..."
              maxLength={500}
            />
          </FormField>

          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => { addModal.closeModal(); editModal.closeModal(); }}>
              Cancel
            </button>
            {editingTx && (
              <button type="button" className="btn btn--danger" onClick={() => { setDeleteTarget(editingTx); deleteModal.openModal(); }}>
                Delete
              </button>
            )}
            <button type="button" className="btn btn--primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving…" : editingTx ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* ── Delete Confirmation ────────────────────────────── */}
      <ConfirmModal
        open={deleteModal.open}
        closing={deleteModal.closing}
        onClose={() => deleteModal.closeModal()}
        title="Delete transaction"
        message={`Delete "${deleteTarget?.description}"? This can't be undone.`}
        confirmText={deleting ? "Deleting…" : "Delete"}
        onConfirm={confirmDelete}
        danger
      />

      {/* ── Category Management Modal ──────────────────────── */}
      <SheetModal
        open={categoryModal.open}
        closing={categoryModal.closing}
        onClose={() => categoryModal.closeModal()}
        title={editingCategory ? "Edit label" : "Manage labels"}
      >
        <div className="transactions__form">
          {/* Existing categories list */}
          {!editingCategory && (
            <div style={{ marginBottom: 16 }}>
              <label className="transactions__form-label">Your {form.type} labels</label>
              {categories.filter((c) => c.type === form.type).length === 0 ? (
                <p style={{ color: "var(--text-muted, #888)", fontSize: 14, margin: "8px 0" }}>No labels yet. Create one below.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {categories.filter((c) => c.type === form.type).map((cat) => (
                    <div
                      key={cat.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", borderRadius: 10,
                        background: "rgba(255,255,255,0.05)", cursor: "pointer",
                      }}
                      onClick={() => openEditCategory(cat)}
                    >
                      <span style={{ fontSize: 20 }}>{cat.icon}</span>
                      <span style={{ flex: 1, fontSize: 14 }}>{cat.name}</span>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: cat.color }} />
                      <span style={{ color: "var(--text-muted, #888)", fontSize: 12 }}>✎</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create / Edit form */}
          <FormField label="Label name">
            <input
              type="text"
              value={categoryForm.name}
              onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Coffee, Rent, Groceries"
              maxLength={40}
              autoFocus
            />
          </FormField>

          {/* Icon picker */}
          <div className="transactions__category-grid-wrap">
            <label className="transactions__form-label">Icon</label>
            <div className="transactions__category-grid">
              {DEFAULT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`transactions__category-chip ${categoryForm.icon === icon ? "active" : ""}`}
                  style={categoryForm.icon === icon ? { borderColor: categoryForm.color, background: `${categoryForm.color}15` } : {}}
                  onClick={() => setCategoryForm((f) => ({ ...f, icon }))}
                >
                  <span>{icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div className="transactions__category-grid-wrap">
            <label className="transactions__form-label">Color</label>
            <div className="transactions__category-grid">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`transactions__category-chip ${categoryForm.color === color ? "active" : ""}`}
                  style={categoryForm.color === color ? { borderColor: color, background: `${color}15` } : {}}
                  onClick={() => setCategoryForm((f) => ({ ...f, color }))}
                >
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: color }} />
                </button>
              ))}
            </div>
          </div>

          {/* Type selector */}
          <div className="transactions__category-grid-wrap">
            <label className="transactions__form-label">Type</label>
            <div className="transactions__type-toggle" style={{ maxWidth: 220 }}>
              {["expense", "income"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`transactions__type-btn ${categoryForm.type === t ? `transactions__type-btn--active ${t}` : ""}`}
                  onClick={() => setCategoryForm((f) => ({ ...f, type: t }))}
                >
                  {t === "expense" ? "Expense" : "Income"}
                </button>
              ))}
            </div>
          </div>

          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => categoryModal.closeModal()}>
              {editingCategory ? "Back" : "Done"}
            </button>
            {editingCategory && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => { setDeleteCategoryTarget(editingCategory); deleteCategoryModal.openModal(); }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={saveCategory}
              disabled={!categoryForm.name.trim()}
            >
              {editingCategory ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* ── Delete Category Confirmation ───────────────────── */}
      <ConfirmModal
        open={deleteCategoryModal.open}
        closing={deleteCategoryModal.closing}
        onClose={() => deleteCategoryModal.closeModal()}
        title="Delete label"
        message={`Delete "${deleteCategoryTarget?.name}"? Existing transactions will keep their data.`}
        confirmText={deletingCategory ? "Deleting…" : "Delete"}
        onConfirm={confirmDeleteCategory}
        danger
      />
    </div>
  );
}

export default Transactions;
