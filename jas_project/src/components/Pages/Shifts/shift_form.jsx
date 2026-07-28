import { useMemo } from "react";
import SheetModal from "../../../components/ui/modals/sheet_modal";
import FormField from "../../ui/form/form_field.jsx";
import {
  parseTimeToMinutes,
  minutesToTime,
} from "../../../lib/calendar_sync";
import { formatMoney } from "../../../lib/format";
import { PAY_TYPES, calcPay } from "./shift_utils";

/**
 * Add / Edit shift form inside a SheetModal.
 *
 * Props:
 *   open, closing, onClose          – modal visibility
 *   form, setForm                   – form state
 *   editingShift                    – shift being edited (null = add)
 *   saving                          – submit-in-progress flag
 *   fieldErrors, fieldStates        – validation state maps
 *   shakeKey                        – counter that triggers shake animation
 *   onFieldBlur(fieldName)          – blur validation handler
 *   onTimeChange(field, value)      – start/end time change handler
 *   onHoursChange(value)            – hours input change (reverse-calculates end)
 *   onSubmit(e)                     – form submit handler
 *   onSaveAsPreset                  – "save current as preset" handler
 *   places                          – PLACES map { slug: { label, rate, color } }
 *   deactivatedSlugs                – Set of deactivated workplace slugs
 *   isFormValid                     – boolean
 */
export default function ShiftForm({
  open,
  closing,
  onClose,
  form,
  setForm,
  editingShift,
  saving,
  fieldErrors,
  fieldStates,
  shakeKey,
  onFieldBlur,
  onTimeChange,
  onHoursChange,
  onSubmit,
  onSaveAsPreset,
  places,
  deactivatedSlugs,
  isFormValid,
}) {
  const previewPay = calcPay(places, form.place, form.hours, form.pay_type);

  const endHint = useMemo(() => {
    if (!form.start_time || !form.hours || form.end_time) return null;
    const startMin = parseTimeToMinutes(form.start_time);
    const h = parseFloat(form.hours);
    if (startMin != null && !isNaN(h) && h > 0) {
      const endMin = startMin + Math.round(h * 60);
      return minutesToTime(endMin);
    }
    return null;
  }, [form.start_time, form.hours, form.end_time]);

  return (
    <SheetModal
      open={open}
      closing={closing}
      onClose={onClose}
      title={editingShift ? "Edit shift" : "Add shift"}
    >
      <form className="shifts__form" onSubmit={onSubmit}>
        <FormField
          label="Place"
          error={fieldErrors.place}
          state={fieldStates.place}
          showIndicator
        >
          <select
            value={form.place}
            onChange={(e) => {
              setForm({ ...form, place: e.target.value });
            }}
          >
            {Object.entries(places).map(([key, { label, rate }]) => (
              <option key={key} value={key}>
                {label} — ₪{rate}/hr
                {deactivatedSlugs.has(key) ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </FormField>

        <div
          className="shifts__pay-toggle"
          role="group"
          aria-label="Pay type"
        >
          {PAY_TYPES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`shifts__pay-toggle-btn${form.pay_type === id ? " shifts__pay-toggle-btn--active" : ""}`}
              onClick={() => setForm({ ...form, pay_type: id })}
              aria-pressed={form.pay_type === id}
            >
              {label}
            </button>
          ))}
        </div>

        <FormField
          label="Date"
          error={fieldErrors.shift_date}
          state={fieldStates.shift_date}
          showIndicator
          shake={fieldErrors.shift_date ? shakeKey : 0}
        >
          <input
            type="date"
            value={form.shift_date}
            onChange={(e) => {
              setForm({ ...form, shift_date: e.target.value });
            }}
            onBlur={() => onFieldBlur("shift_date")}
            required
          />
        </FormField>

        <div className="form-time-row">
          <FormField
            label="Start time"
            error={fieldErrors.start_time}
            state={fieldStates.start_time}
            showIndicator
            shake={fieldErrors.start_time ? shakeKey : 0}
          >
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => onTimeChange("start_time", e.target.value)}
              onBlur={() => onFieldBlur("start_time")}
            />
          </FormField>
          <FormField
            label="End time"
            error={fieldErrors.end_time}
            state={fieldStates.end_time}
            showIndicator
            shake={fieldErrors.end_time ? shakeKey : 0}
          >
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => onTimeChange("end_time", e.target.value)}
              onBlur={() => onFieldBlur("end_time")}
            />
          </FormField>
        </div>

        {endHint && (
          <p className="form-field__hint">
            End time will be {endHint}
          </p>
        )}

        <FormField
          label="Hours"
          error={fieldErrors.hours}
          state={fieldStates.hours}
          showIndicator
          shake={fieldErrors.hours ? shakeKey : 0}
        >
          <input
            type="number"
            min="0.01"
            step="any"
            placeholder="e.g. 6.5"
            value={form.hours}
            onChange={(e) => onHoursChange(e.target.value)}
            onBlur={() => onFieldBlur("hours")}
            required
          />
        </FormField>

        <FormField
          label="Tips"
          error={fieldErrors.tips}
          state={fieldStates.tips}
          showIndicator
          shake={fieldErrors.tips ? shakeKey : 0}
          optional={form.pay_type !== "tips_only"}
        >
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.tips}
            onChange={(e) => setForm({ ...form, tips: e.target.value })}
            onBlur={() => onFieldBlur("tips")}
          />
        </FormField>

        <FormField
          label="Notes"
          optional
          charCount={form.notes.length}
          maxChars={500}
        >
          <textarea
            placeholder="e.g. Covered for Dana, closed the register"
            value={form.notes}
            maxLength={500}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </FormField>

        {form.hours && (
          <p className="shifts__preview shifts__preview--pop">
            {form.pay_type === "tips_only" ? (
              <>
                Tips only shift — total{" "}
                <strong>{formatMoney(parseFloat(form.tips) || 0)}</strong>
              </>
            ) : (
              <>
                Estimated pay: <strong>{formatMoney(previewPay)}</strong>
                {form.tips && (
                  <>
                    {" "}
                    + tips {formatMoney(parseFloat(form.tips) || 0)} ={" "}
                    <strong>
                      {formatMoney(previewPay + (parseFloat(form.tips) || 0))}
                    </strong>
                  </>
                )}
              </>
            )}
          </p>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={onSaveAsPreset}
            disabled={!isFormValid}
            title="Save current form as a reusable preset"
          >
            Save as preset
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || !isFormValid}
          >
            {saving ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                Saving…
              </>
            ) : editingShift ? (
              "Save changes"
            ) : (
              "Add shift"
            )}
          </button>
        </div>
      </form>
    </SheetModal>
  );
}
