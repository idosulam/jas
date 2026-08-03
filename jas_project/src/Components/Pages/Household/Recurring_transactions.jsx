import { useCallback, useEffect, useRef, useState } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase";
import {
  Get_user_facing_error,
  Sanitize_number,
  Sanitize_text,
  Haptic_error,
} from "../../../Lib/Security";
import { Use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import { Use_modal, Use_body_scroll_lock } from "../../../Hooks";
import Sheet_modal from "../../UI/Modals/Sheet_modal";
import Confirm_modal from "../../UI/Modals/Confirm_modal";
import Form_field from "../../UI/Form/Form_field.jsx";
import Glass_card from "../../UI/Glass_card";
import Empty_state from "../../UI/Empty_state";
import Color_palette_picker from "../../../Lib/Color_palette_picker.jsx";
import { DEFAULT_ICONS } from "./Category_manager";

import { Format_money } from "../../../Lib/Format";

function Format_date(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function Recurring_transactions({ householdId, user_id, categories: categoriesProp, onCategoriesChanged }) {
  const [recurring, setRecurring] = useState([]);
  const [localCategories, setLocalCategories] = useState([]);
  const [Loading, Set_loading] = useState(true);
  const { success: Toast_success, error: Toast_error } = Use_glass_toast();

  // Sync prop → local state on initial mount
  useEffect(() => {
    setLocalCategories(categoriesProp);
  }, []);

  const addModal = Use_modal(260);
  const editModal = Use_modal(260);
  const Delete_modal = Use_modal(260);

  const [form, Set_form] = useState({
    type: "expense",
    amount: "",
    description: "",
    note: "",
    category_id: "",
    frequency: "monthly",
    day_of_month: new Date().getDate().toString(),
    day_of_week: "1",
  });
  const [editingRec, setEditingRec] = useState(null);
  const [Delete_target, Set_delete_target] = useState(null);
  const [Deleting, Set_deleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Field states
  const [amountState, setAmountState] = useState("idle");
  const [amountError, setAmountError] = useState(null);
  const [amountTouched, setAmountTouched] = useState(false);
  const [descState, setDescState] = useState("idle");
  const [descError, setDescError] = useState(null);
  const [descTouched, setDescTouched] = useState(false);
  const [Shake_key, Set_shake_key] = useState(0);
  const [Cat_shake_key, Set_cat_shake_key] = useState(0);

  // Category management state
  const categoryModal = Use_modal(260);
  const deleteCategoryModal = Use_modal(260);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    icon: "",
    color: "",
    type: "expense",
  });
  const [catNameTouched, setCatNameTouched] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  // Sliding indicator state
  const typeToggleRef = useRef(null);
  const typeBtnRefs = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const btn = typeBtnRefs.current[form.type];
    const container = typeToggleRef.current;
    if (btn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      setIndicatorStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    }
  }, [form.type]);

  Use_body_scroll_lock(addModal.open, editModal.open, Delete_modal.open, categoryModal.open, deleteCategoryModal.open);

  const Fetch_categories = useCallback(async () => {
    if (!householdId) return;
    try {
      const supabase = Get_supabase_client();
      const { data, error } = await supabase
        .from("transaction_categories")
        .select("*")
        .eq("household_id", householdId)
        .order("name");
      if (error) throw error;
      setLocalCategories(data ?? []);
    } catch {
      // silent
    }
  }, [householdId]);

  const Fetch_recurring = useCallback(async () => {
    if (!householdId) return;
    try {
      const supabase = Get_supabase_client();
      const { data, error } = await supabase
        .from("recurring_transactions")
        .select("*, transaction_categories(name, icon, color)")
        .eq("household_id", householdId)
        .order("next_due_date", { ascending: true });

      if (error) throw error;
      setRecurring(data ?? []);
    } catch {
      // silent
    }
    Set_loading(false);
  }, [householdId]);

  useEffect(() => {
    Fetch_recurring();
    Fetch_categories();
  }, [Fetch_recurring, Fetch_categories]);

  const validateAmount = (value, is_blur = false) => {
    if (!value) {
      if (is_blur) {
        setAmountState("error");
        setAmountError("Amount is required");
      } else {
        setAmountState("idle");
        setAmountError(null);
      }
      return;
    }
    const num = Number(value);
    if (isNaN(num) || num <= 0) {
      setAmountState("error");
      setAmountError("Enter a valid amount");
    } else {
      setAmountState("valid");
      setAmountError(null);
    }
  };

  const validateDesc = (value, is_blur = false) => {
    if (!value.trim()) {
      if (is_blur) {
        setDescState("error");
        setDescError("Description is required");
      } else {
        setDescState("idle");
        setDescError(null);
      }
      return;
    }
    setDescState("valid");
    setDescError(null);
  };

  const resetFieldStates = () => {
    setAmountTouched(false);
    setAmountState("idle");
    setAmountError(null);
    setDescTouched(false);
    setDescState("idle");
    setDescError(null);
  };

  const Open_add = () => {
    setEditingRec(null);
    Set_form({
      type: "expense",
      amount: "",
      description: "",
      note: "",
      category_id: "",
      frequency: "monthly",
      day_of_month: new Date().getDate().toString(),
      day_of_week: "1",
    });
    resetFieldStates();
    addModal.open_modal();
  };

  const Open_edit = (rec) => {
    setEditingRec(rec);
    Set_form({
      type: rec.type,
      amount: String(rec.amount),
      description: rec.description || "",
      note: rec.note || "",
      category_id: rec.category_id || "",
      frequency: rec.frequency,
      day_of_month: String(rec.day_of_month || new Date().getDate()),
      day_of_week: String(rec.day_of_week ?? 1),
    });
    resetFieldStates();
    editModal.open_modal();
  };

  const calcNextDueDate = () => {
    const today = new Date();
    const dom = parseInt(form.day_of_month) || 1;
    const dow = parseInt(form.day_of_week) || 1;

    switch (form.frequency) {
      case "daily":
        return today.toISOString().slice(0, 10);
      case "weekly": {
        const d = new Date(today);
        const diff = (dow - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        return d.toISOString().slice(0, 10);
      }
      case "biweekly": {
        const d = new Date(today);
        const diff = (dow - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        return d.toISOString().slice(0, 10);
      }
      case "monthly": {
        const d = new Date(today.getFullYear(), today.getMonth(), dom);
        if (d <= today) d.setMonth(d.getMonth() + 1);
        return d.toISOString().slice(0, 10);
      }
      case "yearly": {
        const d = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1,
        );
        return d.toISOString().slice(0, 10);
      }
      default:
        return today.toISOString().slice(0, 10);
    }
  };

  const Handle_submit = async () => {
    setAmountTouched(true);
    setDescTouched(true);
    validateAmount(form.amount, true);
    validateDesc(form.description, true);

    if (!form.amount || Number(form.amount) <= 0 || !form.description.trim()) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
      return;
    }

    setSubmitting(true);
    try {
      const supabase = Get_supabase_client();
      const payload = {
        household_id: householdId,
        user_id: user_id,
        category_id:
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            form.category_id,
          )
            ? form.category_id
            : null,
        type: form.type,
        amount: Number(Number(form.amount).toFixed(2)),
        description: Sanitize_text(form.description, 100),
        note: Sanitize_text(form.note, 500) || null,
        frequency: form.frequency,
        day_of_month:
          form.frequency === "monthly" ? parseInt(form.day_of_month) : null,
        day_of_week: ["weekly", "biweekly"].includes(form.frequency)
          ? parseInt(form.day_of_week)
          : null,
        next_due_date: editingRec
          ? editingRec.next_due_date
          : calcNextDueDate(),
        is_active: true,
      };

      if (editingRec) {
        const { error } = await supabase
          .from("recurring_transactions")
          .update(payload)
          .eq("id", editingRec.id);
        if (error) throw error;
        Toast_success("Recurring transaction updated.");
      } else {
        const { error } = await supabase
          .from("recurring_transactions")
          .insert(payload);
        if (error) throw error;
        Toast_success("Recurring transaction created!");
      }

      addModal.close_modal();
      editModal.close_modal();
      Fetch_recurring();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
    setSubmitting(false);
  };

  const toggleActive = async (rec) => {
    try {
      const supabase = Get_supabase_client();
      const { error } = await supabase
        .from("recurring_transactions")
        .update({ is_active: !rec.is_active })
        .eq("id", rec.id);
      if (error) throw error;
      Fetch_recurring();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
  };

  const Confirm_delete = async () => {
    if (!Delete_target) return;
    Set_deleting(true);
    try {
      const supabase = Get_supabase_client();
      const { error } = await supabase
        .from("recurring_transactions")
        .delete()
        .eq("id", Delete_target.id);
      if (error) throw error;
      Delete_modal.close_modal();
      Toast_success("Recurring transaction deleted.");
      Fetch_recurring();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
    Set_deleting(false);
  };

  const getFrequencyLabel = (freq) => {
    return FREQUENCIES.find((f) => f.value === freq)?.label || freq;
  };

  const getDayLabel = (rec) => {
    if (rec.frequency === "monthly" && rec.day_of_month) {
      return `on day ${rec.day_of_month}`;
    }
    if (
      ["weekly", "biweekly"].includes(rec.frequency) &&
      rec.day_of_week != null
    ) {
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `on ${days[rec.day_of_week]}`;
    }
    return "";
  };

  const availableCategories = localCategories.filter((c) => c.type === form.type);

  // ── Category Management ──────────────────────────────────

  const openNewCategory = (type = "expense") => {
    setEditingCategory(null);
    setCategoryForm({ name: "", icon: "", color: "", type });
    setCatNameTouched(false);
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
    setCatNameTouched(false);
    categoryModal.open_modal();
  };

  const saveCategory = async () => {
    const name = Sanitize_text(categoryForm.name, 40);
    if (!name || !categoryForm.icon) {
      Set_cat_shake_key((k) => k + 1);
      Haptic_error();
      return;
    }

    try {
      const supabase = Get_supabase_client();
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
        Toast_success("Label updated.");
      } else {
        const { error } = await supabase
          .from("transaction_categories")
          .insert(payload);
        if (error) throw error;
        Toast_success("Label created!");
      }

      categoryModal.close_modal();
      Fetch_categories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    setDeletingCategory(true);
    try {
      const supabase = Get_supabase_client();
      const { error } = await supabase
        .from("transaction_categories")
        .delete()
        .eq("id", deleteCategoryTarget.id);
      if (error) throw error;
      deleteCategoryModal.close_modal();
      categoryModal.close_modal();
      setEditingCategory(null);
      Toast_success("Label deleted.");
      Fetch_categories();
      if (onCategoriesChanged) onCategoriesChanged();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
    setDeletingCategory(false);
  };

  // Monthly total estimate
  const Monthly_estimate = recurring
    .filter((r) => r.is_active)
    .reduce((sum, r) => {
      const amt = Number(r.amount);
      switch (r.frequency) {
        case "daily":
          return sum + amt * 30;
        case "weekly":
          return sum + amt * 4.33;
        case "biweekly":
          return sum + amt * 2.17;
        case "monthly":
          return sum + amt;
        case "yearly":
          return sum + amt / 12;
        default:
          return sum + amt;
      }
    }, 0);

  return (
    <div className="recurring">
      {/* Summary Cards */}
      <div className="recurring__summary">
        <Glass_card
          value={Format_money(Monthly_estimate)}
          label="Monthly Estimate"
        />
        <Glass_card
          value={String(recurring.filter((r) => r.is_active).length)}
          label="Active"
        />
        <Glass_card
          value={String(recurring.filter((r) => !r.is_active).length)}
          label="Paused"
        />
      </div>

      {/* List */}
      <div className="recurring__header">
        <h3 className="section-title">Recurring</h3>
        <button className="btn btn--primary btn--sm" onClick={Open_add}>
          + Add
        </button>
      </div>

      {recurring.length === 0 ? (
        <Empty_state
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
          title="No recurring transactions"
          text="Set up bills, subscriptions, or regular income to auto-track them."
          action={
            <button className="btn btn--primary" onClick={Open_add}>
              + Add recurring
            </button>
          }
        />
      ) : (
        <div className="recurring__list">
          {recurring.map((rec) => {
            const cat = rec.transaction_categories;
            return (
              <div
                key={rec.id}
                className={`recurring__item ${!rec.is_active ? "recurring__item--disabled" : ""}`}
              >
                <div
                  className="recurring__item-icon"
                  style={{
                    background: `${cat?.color || "#6b7280"}18`,
                    color: cat?.color || "#6b7280",
                  }}
                >
                  {cat?.icon || "📦"}
                </div>
                <div className="recurring__item-info">
                  <span className="recurring__item-desc">
                    {rec.description}
                  </span>
                  <span className="recurring__item-meta">
                    {getFrequencyLabel(rec.frequency)} {getDayLabel(rec)}
                    {rec.next_due_date &&
                      ` · Next: ${Format_date(rec.next_due_date)}`}
                  </span>
                </div>
                <div className="recurring__item-right">
                  <span className={`recurring__item-amount ${rec.type}`}>
                    {rec.type === "expense" ? "-" : "+"}
                    {Format_money(rec.amount)}
                  </span>
                  <div className="recurring__item-actions">
                    <button
                      className={`recurring__toggle ${rec.is_active ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActive(rec);
                      }}
                      title={rec.is_active ? "Pause" : "Resume"}
                    >
                      {rec.is_active ? "●" : "○"}
                    </button>
                    <button
                      className="recurring__edit-btn"
                      onClick={() => Open_edit(rec)}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      className="recurring__delete-btn"
                      onClick={() => {
                        Set_delete_target(rec);
                        Delete_modal.open_modal();
                      }}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Sheet_modal
        open={addModal.open || editModal.open}
        closing={addModal.closing || editModal.closing}
        onClose={() => {
          addModal.close_modal();
          editModal.close_modal();
        }}
        title={editingRec ? "Edit recurring" : "New recurring transaction"}
      >
        <div className="recurring__form">
          {/* Type Toggle */}
          <div className="type-toggle" ref={typeToggleRef}>
            <span
              className={`type-toggle__indicator ${form.type}`}
              style={{
                transform: `translateX(${indicatorStyle.left}px)`,
                width: `${indicatorStyle.width}px`,
              }}
            />
            {["expense", "income"].map((t) => (
              <button
                key={t}
                ref={(el) => {
                  if (el) typeBtnRefs.current[t] = el;
                }}
                type="button"
                className={`type-toggle__btn ${form.type === t ? `type-toggle__btn--active ${t}` : ""}`}
                onClick={() =>
                  Set_form((f) => ({ ...f, type: t, category_id: "" }))
                }
              >
                {t === "expense" ? "Expense" : "Income"}
              </button>
            ))}
          </div>

          <Form_field
            label="Amount"
            error={amountError}
            state={amountState}
            show_indicator
            shake={amountError ? Shake_key : 0}
          >
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => {
                Set_form((f) => ({ ...f, amount: e.target.value }));
                if (amountTouched) validateAmount(e.target.value);
              }}
              onBlur={() => {
                setAmountTouched(true);
                validateAmount(form.amount, true);
                if (!form.amount || Number(form.amount) <= 0) {
                  Set_shake_key((k) => k + 1);
                  Haptic_error();
                }
              }}
              placeholder="0.00"
            />
          </Form_field>

          <Form_field
            label="Description"
            error={descError}
            state={descState}
            show_indicator
            shake={descError ? Shake_key : 0}
          >
            <input
              type="text"
              value={form.description}
              onChange={(e) => {
                Set_form((f) => ({ ...f, description: e.target.value }));
                if (descTouched) validateDesc(e.target.value);
              }}
              onBlur={() => {
                setDescTouched(true);
                validateDesc(form.description, true);
                if (!form.description.trim()) {
                  Set_shake_key((k) => k + 1);
                  Haptic_error();
                }
              }}
              placeholder="e.g. Netflix, Rent, Salary"
              maxLength={100}
            />
          </Form_field>

          {/* Category */}
          <div className="recurring__category-grid-wrap">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label className="recurring__form-label">Category</label>
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
              <div className="category-chips">
                {availableCategories.map((cat) => {
                  const is_active = form.category_id === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`category-chip ${is_active ? "category-chip--active" : ""}`}
                      style={
                        is_active
                          ? {
                              borderColor: cat.color,
                              background: `${cat.color}15`,
                            }
                          : {}
                      }
                      onClick={() =>
                        Set_form((f) => ({ ...f, category_id: cat.id }))
                      }
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Frequency */}
          <Form_field label="Frequency">
            <select
              value={form.frequency}
              onChange={(e) =>
                Set_form((f) => ({ ...f, frequency: e.target.value }))
              }
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Form_field>

          {/* Day of Month (for monthly) */}
          {form.frequency === "monthly" && (
            <Form_field label="Day of month">
              <select
                value={form.day_of_month}
                onChange={(e) =>
                  Set_form((f) => ({ ...f, day_of_month: e.target.value }))
                }
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Form_field>
          )}

          {/* Day of Week (for weekly/biweekly) */}
          {["weekly", "biweekly"].includes(form.frequency) && (
            <Form_field label="Day of week">
              <select
                value={form.day_of_week}
                onChange={(e) =>
                  Set_form((f) => ({ ...f, day_of_week: e.target.value }))
                }
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            </Form_field>
          )}

          <Form_field label="Note (optional)">
            <input
              type="text"
              value={form.note}
              onChange={(e) => Set_form((f) => ({ ...f, note: e.target.value }))}
              placeholder="Add a note..."
              maxLength={500}
            />
          </Form_field>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                addModal.close_modal();
                editModal.close_modal();
              }}
            >
              Cancel
            </button>
            {editingRec && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  Set_delete_target(editingRec);
                  Delete_modal.open_modal();
                }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={Handle_submit}
              disabled={submitting}
            >
              {submitting ? "Saving…" : editingRec ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Sheet_modal>

      {/* Delete Confirmation */}
      <Confirm_modal
        open={Delete_modal.open}
        closing={Delete_modal.closing}
        onClose={() => Delete_modal.close_modal()}
        title="Delete recurring transaction"
        message={`Delete "${Delete_target?.description}"? Future transactions won't be generated.`}
        confirmText={Deleting ? "Deleting…" : "Delete"}
        onConfirm={Confirm_delete}
        danger
      />

      {/* ── Category Management Modal ──────────────────────── */}
      <Sheet_modal
        open={categoryModal.open}
        closing={categoryModal.closing}
        onClose={() => categoryModal.close_modal()}
        title={editingCategory ? "Edit label" : "Manage labels"}
        overlay_class_name="sheet-overlay--nested"
        className="sheet-modal--nested"
      >
        <div className="recurring__form">
          {/* Existing categories list */}
          {!editingCategory && (
            <div style={{ marginBottom: 16 }}>
              <label className="recurring__form-label">
                Your {form.type} labels
              </label>
              {localCategories.filter((c) => c.type === form.type).length === 0 ? (
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
                  {localCategories
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
          <Form_field
            label="Label name"
            error={catNameTouched && !categoryForm.name.trim() ? "Label name is required" : null}
            state={!catNameTouched ? "idle" : categoryForm.name.trim() ? "valid" : "error"}
            show_indicator
            shake={catNameTouched && !categoryForm.name.trim() ? Cat_shake_key : 0}
          >
            <input
              type="text"
              value={categoryForm.name}
              onChange={(e) => {
                const val = e.target.value;
                setCategoryForm((f) => ({ ...f, name: val }));
                if (catNameTouched && !val.trim()) {
                  Set_cat_shake_key((k) => k + 1);
                  Haptic_error();
                }
              }}
              onBlur={() => {
                setCatNameTouched(true);
                if (!categoryForm.name.trim()) {
                  Set_cat_shake_key((k) => k + 1);
                  Haptic_error();
                }
              }}
              placeholder="e.g. Coffee, Rent, Groceries"
              maxLength={40}
            />
          </Form_field>

          {/* Icon picker */}
          <div className="recurring__category-grid-wrap">
            <label className="recurring__form-label">
              Icon
              {!categoryForm.icon && (
                <span style={{ color: "var(--error, #ef4444)", fontSize: 12, marginLeft: 6 }}>
                  — Pick an icon
                </span>
              )}
            </label>
            <div
              className={`category-chips ${!categoryForm.icon && Cat_shake_key > 0 ? "category-chips--shake" : ""}`}
              key={`icon-grid-${Cat_shake_key}`}
            >
              {DEFAULT_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`category-chip ${categoryForm.icon === icon ? "category-chip--active" : ""}`}
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
          <div className="recurring__category-grid-wrap">
            <label className="recurring__form-label">Color</label>
            <Color_palette_picker
              value={categoryForm.color}
              onChange={(color) => setCategoryForm((f) => ({ ...f, color }))}
            />
          </div>

          {/* Type selector */}
          <div className="recurring__category-grid-wrap">
            <label className="recurring__form-label">Type</label>
            <div className="type-toggle" style={{ maxWidth: 220 }}>
              {["expense", "income"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`type-toggle__btn ${categoryForm.type === t ? `type-toggle__btn--active ${t}` : ""}`}
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
              disabled={!categoryForm.name.trim() || !categoryForm.icon}
            >
              {editingCategory ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Sheet_modal>

      {/* ── Delete Category Confirmation ───────────────────── */}
      <Confirm_modal
        open={deleteCategoryModal.open}
        closing={deleteCategoryModal.closing}
        onClose={() => deleteCategoryModal.close_modal()}
        title="Delete label"
        message={`Delete "${deleteCategoryTarget?.name}"? Existing recurring transactions will keep their data.`}
        confirmText={deletingCategory ? "Deleting…" : "Delete"}
        onConfirm={confirmDeleteCategory}
        danger
      />
    </div>
  );
}

export default Recurring_transactions;
