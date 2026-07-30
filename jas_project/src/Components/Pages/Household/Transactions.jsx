import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get_supabase_client } from "../../../Lib/Superbase";
import {
  get_user_facing_error,
  sanitize_text,
} from "../../../Lib/Security";
import { use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import { use_modal, use_body_scroll_lock } from "../../../Hooks";
import SheetModal from "../../UI/Modals/Sheet_modal";
import ConfirmModal from "../../UI/Modals/Confirm_modal";
import EmptyState from "../../UI/Empty_state";
import FormField from "../../UI/Form/form_field";
import ColorPalettePicker from "../../../Lib/Color_palette_picker.jsx";

import { format_money, format_date_group } from "../../../Lib/format";
import TransactionForm from "./Transaction_form";
import TransactionCard from "./Transaction_card";
import CategoryManager, { DEFAULT_ICONS } from "./Category_manager";

function Transactions({ householdId, user_id, members, goals = [] }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, set_loading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState("all");

  const { success: toast_success, error: toast_error } = use_glass_toast();
  const addModal = use_modal(260);
  const editModal = use_modal(260);
  const delete_modal = use_modal(260);
  const categoryModal = use_modal(260);
  const deleteCategoryModal = use_modal(260);

  const [form, set_form] = useState({
    type: "expense",
    amount: "",
    description: "",
    note: "",
    category_id: "",
    goal_id: "",
    transaction_date: new Date().toISOString().slice(0, 10),
  });
  const [editingTx, setEditingTx] = useState(null);
  const [delete_target, set_delete_target] = useState(null);
  const [deleting, set_deleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Category form
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    icon: "📦",
    color: "",
    type: "expense",
  });
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  // Filter tabs sliding indicator
  const filterTabRef = useRef(null);
  const filterBtnRefs = useRef({});
  const [filterIndicatorStyle, setFilterIndicatorStyle] = useState({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    const btn = filterBtnRefs.current[typeFilter];
    const container = filterTabRef.current;
    if (btn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      setFilterIndicatorStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [typeFilter]);

  use_body_scroll_lock(
    addModal.open,
    editModal.open,
    delete_modal.open,
    categoryModal.open,
    deleteCategoryModal.open,
  );

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!householdId) return;
    try {
      const supabase = get_supabase_client();
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
  const fetch_transactions = useCallback(async () => {
    if (!householdId) return;
    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    try {
      const supabase = get_supabase_client();
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "*, transaction_categories(name, icon, color), savings_goals(title, icon, color)",
        )
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
            is_me: t.user_id === user_id,
            category_name: t.savings_goals?.title || "Savings",
            category_icon: t.savings_goals?.icon || "🎯",
            category_color: t.savings_goals?.color || "#818cf8",
          };
        }
        return {
          ...t,
          display_name: member?.display_name || "User",
          is_me: t.user_id === user_id,
          category_name: t.transaction_categories?.name || "Other",
          category_icon: t.transaction_categories?.icon || "📦",
          category_color: t.transaction_categories?.color || "#6b7280",
        };
      });

      setTransactions(enriched);
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    set_loading(false);
  }, [householdId, members, user_id, month, year]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);
  useEffect(() => {
    if (householdId) fetch_transactions();
  }, [householdId, fetch_transactions]);

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

  const open_add = (type = "expense") => {
    setEditingTx(null);
    set_form({
      type,
      amount: "",
      description: "",
      note: "",
      category_id: "",
      goal_id: "",
      transaction_date: new Date().toISOString().slice(0, 10),
    });
    addModal.open_modal();
  };

  const open_edit = (tx) => {
    setEditingTx(tx);
    set_form({
      type: tx.type,
      amount: String(tx.amount),
      description: tx.description || "",
      note: tx.note || "",
      category_id: tx.category_id || "",
      goal_id: tx.goal_id || "",
      transaction_date: tx.transaction_date,
    });
    editModal.open_modal();
  };

  const handle_submit = async () => {
    setSubmitting(true);
    try {
      const supabase = get_supabase_client();
      const amount = Number(Number(form.amount).toFixed(2));
      const isUUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const payload = {
        household_id: householdId,
        user_id: user_id,
        category_id: isUUID.test(form.category_id) ? form.category_id : null,
        goal_id:
          form.type === "contribute" && isUUID.test(form.goal_id)
            ? form.goal_id
            : null,
        type: form.type,
        amount,
        description: sanitize_text(form.description, 100),
        note: sanitize_text(form.note, 500) || null,
        transaction_date: form.transaction_date,
      };

      if (editingTx) {
        const { error } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", editingTx.id);
        if (error) throw error;
        toast_success("Transaction updated.");
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
              user_id: user_id,
              amount,
              note: sanitize_text(form.note, 200) || null,
            });
          }
        }

        const labels = {
          expense: "Expense",
          income: "Income",
          contribute: "Contribution",
        };
        toast_success(`${labels[form.type] || "Transaction"} added!`);
      }

      addModal.close_modal();
      editModal.close_modal();
      fetch_transactions();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    setSubmitting(false);
  };

  const confirm_delete = async () => {
    if (!delete_target) return;
    set_deleting(true);
    try {
      const supabase = get_supabase_client();
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", delete_target.id);
      if (error) throw error;
      delete_modal.close_modal();
      editModal.close_modal();
      setEditingTx(null);
      toast_success("Transaction deleted.");
      fetch_transactions();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    set_deleting(false);
  };

  // ── Category Management ──────────────────────────────────

  const openNewCategory = (type = "expense") => {
    setEditingCategory(null);
    setCategoryForm({ name: "", icon: "📦", color: "", type });
    categoryModal.open_modal();
  };

  const openEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      type: cat.type,
    });
    categoryModal.open_modal();
  };

  const saveCategory = async () => {
    const name = sanitize_text(categoryForm.name, 40);
    if (!name) return;

    try {
      const supabase = get_supabase_client();
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
        toast_success("Label updated.");
      } else {
        const { error } = await supabase
          .from("transaction_categories")
          .insert(payload);
        if (error) throw error;
        toast_success("Label created!");
      }

      categoryModal.close_modal();
      fetchCategories();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    setDeletingCategory(true);
    try {
      const supabase = get_supabase_client();
      const { error } = await supabase
        .from("transaction_categories")
        .delete()
        .eq("id", deleteCategoryTarget.id);
      if (error) throw error;
      deleteCategoryModal.close_modal();
      categoryModal.close_modal();
      setEditingCategory(null);
      toast_success("Label deleted.");
      fetchCategories();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
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
                {format_money(stats.totalIncome)}
              </span>
            </div>
          </div>
          <div className="transactions__balance-divider" />
          <div className="transactions__balance-item transactions__balance-item--expense">
            <span className="transactions__balance-icon">↓</span>
            <div>
              <span className="transactions__balance-label">Expenses</span>
              <span className="transactions__balance-value transactions__balance-value--expense">
                {format_money(stats.totalExpense)}
              </span>
            </div>
          </div>
        </div>
        {stats.totalContribute > 0 && (
          <div className="transactions__balance-row" style={{ marginTop: 8 }}>
            <div className="transactions__balance-item" style={{ flex: 1 }}>
              <span className="transactions__balance-icon">🎯</span>
              <div>
                <span className="transactions__balance-label">
                  Contributions
                </span>
                <span
                  className="transactions__balance-value"
                  style={{ color: "#818cf8" }}
                >
                  {format_money(stats.totalContribute)}
                </span>
              </div>
            </div>
          </div>
        )}
        <div className="transactions__balance-net">
          <span className="transactions__balance-net-label">Balance</span>
          <span
            className={`transactions__balance-net-value ${stats.balance >= 0 ? "positive" : "negative"}`}
          >
            {stats.balance >= 0 ? "+" : ""}
            {format_money(stats.balance)}
          </span>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="transactions__tabs" ref={filterTabRef}>
        <span
          className="transactions__tab-indicator"
          style={{
            transform: `translateX(${filterIndicatorStyle.left}px)`,
            width: `${filterIndicatorStyle.width}px`,
          }}
        />
        {["all", "expense", "income", "contribute"].map((t) => (
          <button
            key={t}
            ref={(el) => {
              if (el) filterBtnRefs.current[t] = el;
            }}
            className={`transactions__tab ${typeFilter === t ? "transactions__tab--active" : ""}`}
            onClick={() => setTypeFilter(t)}
          >
            {t === "all"
              ? "All"
              : t === "expense"
                ? "Expenses"
                : t === "income"
                  ? "Income"
                  : "Contributions"}
          </button>
        ))}
      </div>

      {/* Category Breakdown (expenses only) */}
      {typeFilter !== "income" &&
        typeFilter !== "contribute" &&
        categoryBreakdown.length > 0 && (
          <div className="transactions__breakdown">
            <h3 className="transactions__section-title">By Category</h3>
            <div className="transactions__category-list">
              {categoryBreakdown.slice(0, 6).map((cat) => (
                <div key={cat.name} className="transactions__category-item">
                  <div className="transactions__category-left">
                    <span className="transactions__category-icon">
                      {cat.icon}
                    </span>
                    <span className="transactions__category-name">
                      {cat.name}
                    </span>
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
                    <span className="transactions__category-amount">
                      {format_money(cat.total)}
                    </span>
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
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => open_add("expense")}
          >
            + Expense
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => open_add("income")}
            style={{ marginLeft: 6 }}
          >
            + Income
          </button>
          {activeGoals.length > 0 && (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => open_add("contribute")}
              style={{ marginLeft: 6 }}
            >
              + Contribute
            </button>
          )}
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          className="transactions__empty-state"
          icon={<span style={{ fontSize: "2rem" }}>💳</span>}
          title="No transactions this month"
          text="Add an expense, income, or contribution to get started."
          action={
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => open_add("expense")}
            >
              + Add transaction
            </button>
          }
        />
      ) : (
        <div className="transactions__groups">
          {grouped.map(([date, items]) => {
            const dayTotal = items.reduce((sum, t) => {
              return (
                sum +
                (t.type === "expense" ? -Number(t.amount) : Number(t.amount))
              );
            }, 0);

            return (
              <div key={date} className="transactions__group">
                <div className="transactions__group-header">
                  <span className="transactions__group-date">
                    {format_date_group(date)}
                  </span>
                  <span
                    className={`transactions__group-total ${dayTotal >= 0 ? "positive" : "negative"}`}
                  >
                    {dayTotal >= 0 ? "+" : ""}
                    {format_money(Math.abs(dayTotal))}
                  </span>
                </div>
                <div className="transactions__group-items">
                  {items.map((tx) => (
                    <TransactionCard
                      key={tx.id}
                      transaction={tx}
                      onEdit={open_edit}
                    />
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
        onClose={() => {
          addModal.close_modal();
          editModal.close_modal();
        }}
        title={editingTx ? "Edit transaction" : `Add ${typeLabel}`}
      >
        <TransactionForm
          form={form}
          set_form={set_form}
          editingTx={editingTx}
          categories={categories}
          goals={goals}
          submitting={submitting}
          onSubmit={handle_submit}
          onCancel={() => {
            addModal.close_modal();
            editModal.close_modal();
          }}
          onDelete={() => {
            set_delete_target(editingTx);
            delete_modal.open_modal();
          }}
          onOpenNewCategory={openNewCategory}
          onError={toast_error}
        />
      </SheetModal>

      {/* ── Delete Confirmation ────────────────────────────── */}
      <ConfirmModal
        open={delete_modal.open}
        closing={delete_modal.closing}
        onClose={() => delete_modal.close_modal()}
        title="Delete transaction"
        message={`Delete "${delete_target?.description}"? This can't be undone.`}
        confirmText={deleting ? "Deleting…" : "Delete"}
        onConfirm={confirm_delete}
        danger
      />

      {/* ── Category Management Modal ──────────────────────── */}
      <SheetModal
        open={categoryModal.open}
        closing={categoryModal.closing}
        onClose={() => categoryModal.close_modal()}
        title={editingCategory ? "Edit label" : "Manage labels"}
      >
        <div className="transactions__form">
          {/* Existing categories list */}
          {!editingCategory && (
            <div style={{ marginBottom: 16 }}>
              <label className="transactions__form-label">
                Your {form.type} labels
              </label>
              {categories.filter((c) => c.type === form.type).length === 0 ? (
                <p
                  style={{
                    color: "var(--text-muted, #888)",
                    fontSize: 14,
                    margin: "8px 0",
                  }}
                >
                  No labels yet. Create one below.
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  {categories
                    .filter((c) => c.type === form.type)
                    .map((cat) => (
                      <div
                        key={cat.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 12px",
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.05)",
                          cursor: "pointer",
                        }}
                        onClick={() => openEditCategory(cat)}
                      >
                        <span style={{ fontSize: 20 }}>{cat.icon}</span>
                        <span style={{ flex: 1, fontSize: 14 }}>
                          {cat.name}
                        </span>
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: cat.color,
                          }}
                        />
                        <span
                          style={{
                            color: "var(--text-muted, #888)",
                            fontSize: 12,
                          }}
                        >
                          ✎
                        </span>
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
              onChange={(e) =>
                setCategoryForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Coffee, Rent, Groceries"
              maxLength={40}
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
                  style={
                    categoryForm.icon === icon
                      ? {
                          borderColor: categoryForm.color,
                          background: `${categoryForm.color}15`,
                        }
                      : {}
                  }
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
            <ColorPalettePicker
              value={categoryForm.color}
              onChange={(color) => setCategoryForm((f) => ({ ...f, color }))}
            />
          </div>

          {/* Type selector */}
          <div className="transactions__category-grid-wrap">
            <label className="transactions__form-label">Type</label>
            <div
              className="transactions__type-toggle"
              style={{ maxWidth: 220 }}
            >
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
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => categoryModal.close_modal()}
            >
              {editingCategory ? "Back" : "Done"}
            </button>
            {editingCategory && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  setDeleteCategoryTarget(editingCategory);
                  deleteCategoryModal.open_modal();
                }}
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
        onClose={() => deleteCategoryModal.close_modal()}
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
