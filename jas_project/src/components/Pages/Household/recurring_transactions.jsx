import { useCallback, useEffect, useRef, useState } from "react";
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
import GlassCard from "../../UI/glass_card";
import EmptyState from "../../UI/Empty_state";

import { format_money } from "../../../lib/format";

function format_date(dateStr) {
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

function RecurringTransactions({ householdId, user_id, categories }) {
  const [recurring, setRecurring] = useState([]);
  const [loading, set_loading] = useState(true);
  const { success: toast_success, error: toast_error } = use_glass_toast();

  const addModal = use_modal(260);
  const editModal = use_modal(260);
  const delete_modal = use_modal(260);

  const [form, set_form] = useState({
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
  const [delete_target, set_delete_target] = useState(null);
  const [deleting, set_deleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Field states
  const [amountState, setAmountState] = useState("idle");
  const [amountError, setAmountError] = useState(null);
  const [amountTouched, setAmountTouched] = useState(false);
  const [descState, setDescState] = useState("idle");
  const [descError, setDescError] = useState(null);
  const [descTouched, setDescTouched] = useState(false);
  const [shake_key, set_shake_key] = useState(0);

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

  use_body_scroll_lock(addModal.open, editModal.open, delete_modal.open);

  const fetch_recurring = useCallback(async () => {
    if (!householdId) return;
    try {
      const supabase = get_supabase_client();
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
    set_loading(false);
  }, [householdId]);

  useEffect(() => {
    fetch_recurring();
  }, [fetch_recurring]);

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

  const open_add = () => {
    setEditingRec(null);
    set_form({
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

  const open_edit = (rec) => {
    setEditingRec(rec);
    set_form({
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

  const handle_submit = async () => {
    setAmountTouched(true);
    setDescTouched(true);
    validateAmount(form.amount, true);
    validateDesc(form.description, true);

    if (!form.amount || Number(form.amount) <= 0 || !form.description.trim()) {
      set_shake_key((k) => k + 1);
      haptic_error();
      return;
    }

    setSubmitting(true);
    try {
      const supabase = get_supabase_client();
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
        description: sanitize_text(form.description, 100),
        note: sanitize_text(form.note, 500) || null,
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
        toast_success("Recurring transaction updated.");
      } else {
        const { error } = await supabase
          .from("recurring_transactions")
          .insert(payload);
        if (error) throw error;
        toast_success("Recurring transaction created!");
      }

      addModal.close_modal();
      editModal.close_modal();
      fetch_recurring();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    setSubmitting(false);
  };

  const toggleActive = async (rec) => {
    try {
      const supabase = get_supabase_client();
      const { error } = await supabase
        .from("recurring_transactions")
        .update({ is_active: !rec.is_active })
        .eq("id", rec.id);
      if (error) throw error;
      fetch_recurring();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
  };

  const confirm_delete = async () => {
    if (!delete_target) return;
    set_deleting(true);
    try {
      const supabase = get_supabase_client();
      const { error } = await supabase
        .from("recurring_transactions")
        .delete()
        .eq("id", delete_target.id);
      if (error) throw error;
      delete_modal.close_modal();
      toast_success("Recurring transaction deleted.");
      fetch_recurring();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
    set_deleting(false);
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

  const availableCategories = categories.filter((c) => c.type === form.type);

  // Monthly total estimate
  const monthly_estimate = recurring
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
        <GlassCard
          value={format_money(monthly_estimate)}
          label="Monthly Estimate"
        />
        <GlassCard
          value={String(recurring.filter((r) => r.is_active).length)}
          label="Active"
        />
        <GlassCard
          value={String(recurring.filter((r) => !r.is_active).length)}
          label="Paused"
        />
      </div>

      {/* List */}
      <div className="recurring__header">
        <h3 className="recurring__section-title">Recurring</h3>
        <button className="btn btn--primary btn--sm" onClick={open_add}>
          + Add
        </button>
      </div>

      {recurring.length === 0 ? (
        <EmptyState
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
            <button className="btn btn--primary" onClick={open_add}>
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
                      ` · Next: ${format_date(rec.next_due_date)}`}
                  </span>
                </div>
                <div className="recurring__item-right">
                  <span className={`recurring__item-amount ${rec.type}`}>
                    {rec.type === "expense" ? "-" : "+"}
                    {format_money(rec.amount)}
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
                      onClick={() => open_edit(rec)}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      className="recurring__delete-btn"
                      onClick={() => {
                        set_delete_target(rec);
                        delete_modal.open_modal();
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
      <SheetModal
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
          <div className="recurring__type-toggle" ref={typeToggleRef}>
            <span
              className={`recurring__type-indicator ${form.type}`}
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
                className={`recurring__type-btn ${form.type === t ? `active ${t}` : ""}`}
                onClick={() =>
                  set_form((f) => ({ ...f, type: t, category_id: "" }))
                }
              >
                {t === "expense" ? "Expense" : "Income"}
              </button>
            ))}
          </div>

          <FormField
            label="Amount"
            error={amountError}
            state={amountState}
            show_indicator
            shake={amountError ? shake_key : 0}
          >
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => {
                set_form((f) => ({ ...f, amount: e.target.value }));
                if (amountTouched) validateAmount(e.target.value);
              }}
              onBlur={() => {
                setAmountTouched(true);
                validateAmount(form.amount, true);
                if (!form.amount || Number(form.amount) <= 0) {
                  set_shake_key((k) => k + 1);
                  haptic_error();
                }
              }}
              placeholder="0.00"
            />
          </FormField>

          <FormField
            label="Description"
            error={descError}
            state={descState}
            show_indicator
            shake={descError ? shake_key : 0}
          >
            <input
              type="text"
              value={form.description}
              onChange={(e) => {
                set_form((f) => ({ ...f, description: e.target.value }));
                if (descTouched) validateDesc(e.target.value);
              }}
              onBlur={() => {
                setDescTouched(true);
                validateDesc(form.description, true);
                if (!form.description.trim()) {
                  set_shake_key((k) => k + 1);
                  haptic_error();
                }
              }}
              placeholder="e.g. Netflix, Rent, Salary"
              maxLength={100}
            />
          </FormField>

          {/* Category */}
          <div className="recurring__category-grid-wrap">
            <label className="recurring__form-label">Category</label>
            {availableCategories.length === 0 ? (
              <p style={{ color: "var(--text-muted, #888)", fontSize: 14 }}>
                No labels yet. Create labels in the Transactions tab first.
              </p>
            ) : (
              <div className="recurring__category-grid">
                {availableCategories.map((cat) => {
                  const is_active = form.category_id === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`recurring__category-chip ${is_active ? "active" : ""}`}
                      style={
                        is_active
                          ? {
                              borderColor: cat.color,
                              background: `${cat.color}15`,
                            }
                          : {}
                      }
                      onClick={() =>
                        set_form((f) => ({ ...f, category_id: cat.id }))
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
          <FormField label="Frequency">
            <select
              value={form.frequency}
              onChange={(e) =>
                set_form((f) => ({ ...f, frequency: e.target.value }))
              }
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </FormField>

          {/* Day of Month (for monthly) */}
          {form.frequency === "monthly" && (
            <FormField label="Day of month">
              <select
                value={form.day_of_month}
                onChange={(e) =>
                  set_form((f) => ({ ...f, day_of_month: e.target.value }))
                }
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {/* Day of Week (for weekly/biweekly) */}
          {["weekly", "biweekly"].includes(form.frequency) && (
            <FormField label="Day of week">
              <select
                value={form.day_of_week}
                onChange={(e) =>
                  set_form((f) => ({ ...f, day_of_week: e.target.value }))
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
            </FormField>
          )}

          <FormField label="Note (optional)">
            <input
              type="text"
              value={form.note}
              onChange={(e) => set_form((f) => ({ ...f, note: e.target.value }))}
              placeholder="Add a note..."
              maxLength={500}
            />
          </FormField>

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
                  set_delete_target(editingRec);
                  delete_modal.open_modal();
                }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={handle_submit}
              disabled={submitting}
            >
              {submitting ? "Saving…" : editingRec ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={delete_modal.open}
        closing={delete_modal.closing}
        onClose={() => delete_modal.close_modal()}
        title="Delete recurring transaction"
        message={`Delete "${delete_target?.description}"? Future transactions won't be generated.`}
        confirmText={deleting ? "Deleting…" : "Delete"}
        onConfirm={confirm_delete}
        danger
      />
    </div>
  );
}

export default RecurringTransactions;
