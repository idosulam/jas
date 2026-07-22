import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../../../lib/superbase";
import { getUserFacingError, sanitizeNumber, sanitizeText, hapticError } from "../../../../lib/security";
import { useGlassToast } from "../../../../lib/glass_toast_provider.jsx";
import { useModal, useBodyScrollLock } from "../../../../hooks";
import SheetModal from "../../../ui/modals/Sheet_modal";
import ConfirmModal from "../../../ui/modals/Confirm_modal";
import FormField from "../../../ui/form/Form_field.jsx";

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

const EXPENSE_CATEGORIES = [
  { name: "Food & Dining", icon: "🍔", color: "#f97316" },
  { name: "Transport", icon: "🚗", color: "#3b82f6" },
  { name: "Shopping", icon: "🛍️", color: "#ec4899" },
  { name: "Bills & Utilities", icon: "💡", color: "#eab308" },
  { name: "Entertainment", icon: "🎬", color: "#a855f7" },
  { name: "Health", icon: "💊", color: "#22c55e" },
  { name: "Education", icon: "📚", color: "#06b6d4" },
  { name: "Home", icon: "🏠", color: "#78716c" },
  { name: "Clothing", icon: "👕", color: "#f472b6" },
  { name: "Gifts", icon: "🎁", color: "#fb923c" },
  { name: "Subscriptions", icon: "📱", color: "#8b5cf6" },
  { name: "Other", icon: "📦", color: "#6b7280" },
];

const INCOME_CATEGORIES = [
  { name: "Salary", icon: "💰", color: "#22c55e" },
  { name: "Freelance", icon: "💻", color: "#3b82f6" },
  { name: "Tips", icon: "💵", color: "#f97316" },
  { name: "Gifts Received", icon: "🎉", color: "#ec4899" },
  { name: "Other Income", icon: "📈", color: "#a855f7" },
];

function Transactions({ householdId, userId, members }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState("all"); // all | expense | income

  const { success: toastSuccess, error: toastError } = useGlassToast();
  const addModal = useModal(260);
  const editModal = useModal(260);
  const deleteModal = useModal(260);

  const [form, setForm] = useState({
    type: "expense",
    amount: "",
    description: "",
    note: "",
    category_id: "",
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  const [editingTx, setEditingTx] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Field states
  const [amountState, setAmountState] = useState("idle");
  const [amountError, setAmountError] = useState(null);
  const [amountTouched, setAmountTouched] = useState(false);
  const [descState, setDescState] = useState("idle");
  const [descError, setDescError] = useState(null);
  const [descTouched, setDescTouched] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  useBodyScrollLock(addModal.open, editModal.open, deleteModal.open);

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
      // Use defaults if fetch fails
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
        .select("*, transaction_categories(name, icon, color)")
        .eq("household_id", householdId)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with member info
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

      setTransactions(enriched);
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setLoading(false);
  }, [householdId, members, userId, month, year]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { if (householdId) fetchTransactions(); }, [householdId, fetchTransactions]);

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
    transactions.forEach((t) => {
      if (t.type === "expense") totalExpense += Number(t.amount);
      else totalIncome += Number(t.amount);
    });
    return {
      totalExpense,
      totalIncome,
      balance: totalIncome - totalExpense,
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

  const maxCategoryTotal = categoryBreakdown.length > 0
    ? Math.max(...categoryBreakdown.map((c) => c.total))
    : 0;

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
      transaction_date: tx.transaction_date,
    });
    resetFieldStates();
    editModal.openModal();
  };

  const handleSubmit = async () => {
    // Validate
    setAmountTouched(true);
    setDescTouched(true);
    validateAmount(form.amount, true);
    validateDesc(form.description, true);

    if (!form.amount || Number(form.amount) <= 0 || !form.description.trim()) {
      setShakeKey((k) => k + 1);
      hapticError();
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const payload = {
        household_id: householdId,
        user_id: userId,
        category_id: form.category_id || null,
        type: form.type,
        amount: Number(Number(form.amount).toFixed(2)),
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
        toastSuccess(`${form.type === "expense" ? "Expense" : "Income"} added!`);
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
      const { error } = await supabase.from("transactions").delete().eq("id", deleteTarget.id);
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

  const currentCategories = form.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const availableCategories = categories.length > 0
    ? categories.filter((c) => c.type === form.type)
    : currentCategories;

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
        <div className="transactions__balance-net">
          <span className="transactions__balance-net-label">Balance</span>
          <span className={`transactions__balance-net-value ${stats.balance >= 0 ? "positive" : "negative"}`}>
            {stats.balance >= 0 ? "+" : ""}{formatMoney(stats.balance)}
          </span>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="transactions__tabs">
        {["all", "expense", "income"].map((t) => (
          <button
            key={t}
            className={`transactions__tab ${typeFilter === t ? "transactions__tab--active" : ""}`}
            onClick={() => setTypeFilter(t)}
          >
            {t === "all" ? "All" : t === "expense" ? "Expenses" : "Income"}
          </button>
        ))}
      </div>

      {/* Category Breakdown (expenses only) */}
      {typeFilter !== "income" && categoryBreakdown.length > 0 && (
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
          <button className="btn btn--primary btn--sm" onClick={() => openAdd("income")}>
            + Income
          </button>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="transactions__empty">
          <p>No transactions this month</p>
          <span>Add an expense or income to get started.</span>
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
                    {dayTotal >= 0 ? "+" : ""}{formatMoney(Math.abs(dayTotal))}
                  </span>
                </div>
                <div className="transactions__group-items">
                  {items.map((tx) => (
                    <div
                      key={tx.id}
                      className="transactions__item"
                      onClick={() => openEdit(tx)}
                    >
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
                        {tx.type === "expense" ? "-" : "+"}{formatMoney(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <SheetModal
        open={addModal.open || editModal.open}
        closing={addModal.closing || editModal.closing}
        onClose={() => { addModal.closeModal(); editModal.closeModal(); }}
        title={editingTx ? "Edit transaction" : "Add transaction"}
      >
        <div className="transactions__form">
          {/* Type Toggle */}
          <div className="transactions__type-toggle">
            <button
              className={`transactions__type-btn ${form.type === "expense" ? "transactions__type-btn--active expense" : ""}`}
              onClick={() => setForm((f) => ({ ...f, type: "expense", category_id: "" }))}
            >
              Expense
            </button>
            <button
              className={`transactions__type-btn ${form.type === "income" ? "transactions__type-btn--active income" : ""}`}
              onClick={() => setForm((f) => ({ ...f, type: "income", category_id: "" }))}
            >
              Income
            </button>
          </div>

          <FormField
            label="Amount"
            error={amountError}
            state={amountState}
            showIndicator
            shake={amountError ? shakeKey : 0}
          >
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => {
                setForm((f) => ({ ...f, amount: e.target.value }));
                if (amountTouched) validateAmount(e.target.value);
              }}
              onBlur={() => {
                setAmountTouched(true);
                validateAmount(form.amount, true);
                if (!form.amount || Number(form.amount) <= 0) {
                  setShakeKey((k) => k + 1); hapticError();
                }
              }}
              placeholder="0.00"
              autoFocus
            />
          </FormField>

          <FormField
            label="Description"
            error={descError}
            state={descState}
            showIndicator
            shake={descError ? shakeKey : 0}
          >
            <input
              type="text"
              value={form.description}
              onChange={(e) => {
                setForm((f) => ({ ...f, description: e.target.value }));
                if (descTouched) validateDesc(e.target.value);
              }}
              onBlur={() => {
                setDescTouched(true);
                validateDesc(form.description, true);
                if (!form.description.trim()) {
                  setShakeKey((k) => k + 1); hapticError();
                }
              }}
              placeholder="What was this for?"
              maxLength={100}
            />
          </FormField>

          {/* Category Grid */}
          <div className="transactions__category-grid-wrap">
            <label className="transactions__form-label">Category</label>
            <div className="transactions__category-grid">
              {availableCategories.map((cat) => {
                const catId = cat.id || cat.name;
                const isActive = form.category_id === catId || (!form.category_id && cat.name === "Other");
                return (
                  <button
                    key={catId}
                    type="button"
                    className={`transactions__category-chip ${isActive ? "active" : ""}`}
                    style={isActive ? { borderColor: cat.color, background: `${cat.color}15` } : {}}
                    onClick={() => setForm((f) => ({ ...f, category_id: catId }))}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

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
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => { addModal.closeModal(); editModal.closeModal(); }}
            >
              Cancel
            </button>
            {editingTx && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => { setDeleteTarget(editingTx); deleteModal.openModal(); }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Saving…" : editingTx ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* Delete Confirmation */}
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
    </div>
  );
}

export default Transactions;
