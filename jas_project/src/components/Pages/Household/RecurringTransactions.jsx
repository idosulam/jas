import { useCallback, useEffect, useRef, useState } from "react";
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


function RecurringTransactions({ householdId, userId, categories }) {
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);
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
    frequency: "monthly",
    day_of_month: new Date().getDate().toString(),
    day_of_week: "1",
  });
  const [editingRec, setEditingRec] = useState(null);
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
      setIndicatorStyle({ left: btnRect.left - containerRect.left, width: btnRect.width });
    }
  }, [form.type]);

  useBodyScrollLock(addModal.open, editModal.open, deleteModal.open);

  const fetchRecurring = useCallback(async () => {
    if (!householdId) return;
    try {
      const supabase = getSupabaseClient();
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
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetchRecurring();
  }, [fetchRecurring]);

  const validateAmount = (value, isBlur = false) => {
    if (!value) {
      if (isBlur) {
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

  const validateDesc = (value, isBlur = false) => {
    if (!value.trim()) {
      if (isBlur) {
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

  const openAdd = () => {
    setEditingRec(null);
    setForm({
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
    addModal.openModal();
  };

  const openEdit = (rec) => {
    setEditingRec(rec);
    setForm({
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
    editModal.openModal();
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

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const payload = {
        household_id: householdId,
        user_id: userId,
        category_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(form.category_id) ? form.category_id : null,
        type: form.type,
        amount: Number(Number(form.amount).toFixed(2)),
        description: sanitizeText(form.description, 100),
        note: sanitizeText(form.note, 500) || null,
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
        toastSuccess("Recurring transaction updated.");
      } else {
        const { error } = await supabase
          .from("recurring_transactions")
          .insert(payload);
        if (error) throw error;
        toastSuccess("Recurring transaction created!");
      }

      addModal.closeModal();
      editModal.closeModal();
      fetchRecurring();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setSubmitting(false);
  };

  const toggleActive = async (rec) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("recurring_transactions")
        .update({ is_active: !rec.is_active })
        .eq("id", rec.id);
      if (error) throw error;
      fetchRecurring();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("recurring_transactions")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      deleteModal.closeModal();
      toastSuccess("Recurring transaction deleted.");
      fetchRecurring();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
    setDeleting(false);
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
  const monthlyEstimate = recurring
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
      {/* Monthly Estimate */}
      <div className="recurring__estimate">
        <div className="recurring__estimate-info">
          <span className="recurring__estimate-label">Monthly Estimate</span>
          <span className="recurring__estimate-value">
            {formatMoney(monthlyEstimate)}
          </span>
        </div>
        <span className="recurring__estimate-note">
          Based on {recurring.filter((r) => r.is_active).length} active
          recurring transactions
        </span>
      </div>

      {/* List */}
      <div className="recurring__header">
        <h3 className="recurring__section-title">Recurring</h3>
        <button className="btn btn--primary btn--sm" onClick={openAdd}>
          + Add
        </button>
      </div>

      {recurring.length === 0 ? (
        <div className="recurring__empty">
          <p>No recurring transactions</p>
          <span>
            Set up bills, subscriptions, or regular income to auto-track them.
          </span>
        </div>
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
                      ` · Next: ${formatDate(rec.next_due_date)}`}
                  </span>
                </div>
                <div className="recurring__item-right">
                  <span className={`recurring__item-amount ${rec.type}`}>
                    {rec.type === "expense" ? "-" : "+"}
                    {formatMoney(rec.amount)}
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
                      onClick={() => openEdit(rec)}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      className="recurring__delete-btn"
                      onClick={() => {
                        setDeleteTarget(rec);
                        deleteModal.openModal();
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
          addModal.closeModal();
          editModal.closeModal();
        }}
        title={editingRec ? "Edit recurring" : "New recurring transaction"}
      >
        <div className="recurring__form">
          {/* Type Toggle */}
          <div className="recurring__type-toggle" ref={typeToggleRef}>
            <span
              className={`recurring__type-indicator ${form.type}`}
              style={{ transform: `translateX(${indicatorStyle.left}px)`, width: `${indicatorStyle.width}px` }}
            />
            {['expense', 'income'].map((t) => (
              <button
                key={t}
                ref={(el) => { if (el) typeBtnRefs.current[t] = el; }}
                type="button"
                className={`recurring__type-btn ${form.type === t ? `active ${t}` : ''}`}
                onClick={() => setForm((f) => ({ ...f, type: t, category_id: '' }))}
              >
                {t === 'expense' ? 'Expense' : 'Income'}
              </button>
            ))}
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
                  setShakeKey((k) => k + 1);
                  hapticError();
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
                  setShakeKey((k) => k + 1);
                  hapticError();
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
                  const isActive = form.category_id === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`recurring__category-chip ${isActive ? "active" : ""}`}
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

          {/* Frequency */}
          <FormField label="Frequency">
            <select
              value={form.frequency}
              onChange={(e) =>
                setForm((f) => ({ ...f, frequency: e.target.value }))
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
                  setForm((f) => ({ ...f, day_of_month: e.target.value }))
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
                  setForm((f) => ({ ...f, day_of_week: e.target.value }))
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
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Add a note..."
              maxLength={500}
            />
          </FormField>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                addModal.closeModal();
                editModal.closeModal();
              }}
            >
              Cancel
            </button>
            {editingRec && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  setDeleteTarget(editingRec);
                  deleteModal.openModal();
                }}
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
              {submitting ? "Saving…" : editingRec ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={deleteModal.open}
        closing={deleteModal.closing}
        onClose={() => deleteModal.closeModal()}
        title="Delete recurring transaction"
        message={`Delete "${deleteTarget?.description}"? Future transactions won't be generated.`}
        confirmText={deleting ? "Deleting…" : "Delete"}
        onConfirm={confirmDelete}
        danger
      />
    </div>
  );
}

export default RecurringTransactions;
