import { useEffect, useRef, useState } from "react";
import {
  haptic_error,
} from "../../../Lib/Security";
import FormField from "../../UI/Form/Form_field.jsx";

const TYPE_OPTIONS = ["expense", "income", "contribute"];

export default function TransactionForm({
  form,
  set_form,
  editingTx,
  categories = [],
  goals = [],
  submitting,
  onSubmit,
  onCancel,
  onDelete,
  onOpenNewCategory,
  onError,
}) {
  // Field validation states
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

  // Reset field states when form opens / editingTx changes
  useEffect(() => {
    setAmountTouched(false);
    setAmountState("idle");
    setAmountError(null);
    setDescTouched(false);
    setDescState("idle");
    setDescError(null);
  }, [editingTx]);

  // Categories for current form type
  const availableCategories =
    form.type === "contribute"
      ? []
      : categories.filter((c) => c.type === form.type);

  // Active goals
  const activeGoals = goals.filter((g) => !g.is_completed);

  const typeLabel = form.type === "contribute" ? "contribution" : form.type;

  // Validation helpers
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
    const trimmed = value.trim();
    if (!trimmed) {
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

  const handle_submit = () => {
    setAmountTouched(true);
    setDescTouched(true);
    validateAmount(form.amount, true);
    validateDesc(form.description, true);

    if (!form.amount || Number(form.amount) <= 0 || !form.description.trim()) {
      set_shake_key((k) => k + 1);
      haptic_error();
      return;
    }

    if (form.type === "contribute" && !form.goal_id) {
      if (onError) onError("Please select a savings goal.");
      return;
    }

    onSubmit();
  };

  return (
    <div className="transactions__form">
      {/* Type Toggle */}
      <div className="transactions__type-toggle" ref={typeToggleRef}>
        <span
          className={`transactions__type-indicator ${form.type}`}
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width: `${indicatorStyle.width}px`,
          }}
        />
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t}
            ref={(el) => {
              if (el) typeBtnRefs.current[t] = el;
            }}
            className={`transactions__type-btn ${form.type === t ? `transactions__type-btn--active ${t}` : ""}`}
            onClick={() =>
              set_form((f) => ({
                ...f,
                type: t,
                category_id: "",
                goal_id: "",
              }))
            }
          >
            {t === "expense"
              ? "Expense"
              : t === "income"
                ? "Income"
                : "🎯 Contribute"}
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
          placeholder={
            form.type === "contribute"
              ? "e.g. Monthly savings"
              : "What was this for?"
          }
          maxLength={100}
        />
      </FormField>

      {/* Goal Picker (contribute type) */}
      {form.type === "contribute" && (
        <div className="transactions__category-grid-wrap">
          <label className="transactions__form-label">Savings Goal</label>
          {activeGoals.length === 0 ? (
            <p style={{ color: "var(--text-muted, #888)", fontSize: 14 }}>
              No active goals. Create one first.
            </p>
          ) : (
            <div className="transactions__category-grid">
              {activeGoals.map((goal) => {
                const is_active = form.goal_id === goal.id;
                return (
                  <button
                    key={goal.id}
                    type="button"
                    className={`transactions__category-chip ${is_active ? "active" : ""}`}
                    style={
                      is_active
                        ? {
                            borderColor: goal.color,
                            background: `${goal.color}15`,
                          }
                        : {}
                    }
                    onClick={() =>
                      set_form((f) => ({ ...f, goal_id: goal.id }))
                    }
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <label className="transactions__form-label">Category</label>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ fontSize: 12, padding: "2px 8px" }}
              onClick={() => onOpenNewCategory(form.type)}
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
                const is_active = form.category_id === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`transactions__category-chip ${is_active ? "active" : ""}`}
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
      )}

      <FormField label="Date">
        <input
          type="date"
          value={form.transaction_date}
          onChange={(e) =>
            set_form((f) => ({ ...f, transaction_date: e.target.value }))
          }
        />
      </FormField>

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
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        {editingTx && (
          <button
            type="button"
            className="btn btn--danger"
            onClick={onDelete}
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
          {submitting ? "Saving…" : editingTx ? "Update" : "Add"}
        </button>
      </div>
    </div>
  );
}
