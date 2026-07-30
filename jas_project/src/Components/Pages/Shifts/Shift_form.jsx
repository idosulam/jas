import { useMemo } from "react";
import SheetModal from "../../../Components/UI/Modals/Sheet_modal";
import FormField from "../../UI/Form/Form_field.jsx";
import {
  parse_time_to_minutes,
  minutes_to_time,
} from "../../../Lib/Calendar_sync";
import { format_money } from "../../../Lib/format";
import { PAY_TYPES, calcPay } from "./Shift_utils";

/**
 * Add / Edit shift form inside a SheetModal.
 *
 * Props:
 *   open, closing, onClose          – modal visibility
 *   form, set_form                   – form state
 *   editing_shift                    – shift being edited (null = add)
 *   saving                          – submit-in-progress flag
 *   field_errors, field_states        – validation state maps
 *   shake_key                        – counter that triggers shake animation
 *   onFieldBlur(field_name)          – blur validation handler
 *   onTimeChange(field, value)      – start/end time change handler
 *   onHoursChange(value)            – hours input change (reverse-calculates end)
 *   onSubmit(e)                     – form submit handler
 *   onSaveAsPreset                  – "save current as preset" handler
 *   places                          – PLACES map { slug: { label, rate, color } }
 *   deactivated_slugs                – Set of deactivated workplace slugs
 *   is_form_valid                     – boolean
 */
export default function ShiftForm({
  open,
  closing,
  onClose,
  form,
  set_form,
  editing_shift,
  saving,
  field_errors,
  field_states,
  shake_key,
  onFieldBlur,
  onTimeChange,
  onHoursChange,
  onSubmit,
  onSaveAsPreset,
  places,
  deactivated_slugs,
  is_form_valid,
}) {
  const preview_pay = calcPay(places, form.place, form.hours, form.pay_type);

  const endHint = useMemo(() => {
    if (!form.start_time || !form.hours || form.end_time) return null;
    const startMin = parse_time_to_minutes(form.start_time);
    const h = parseFloat(form.hours);
    if (startMin != null && !isNaN(h) && h > 0) {
      const endMin = startMin + Math.round(h * 60);
      return minutes_to_time(endMin);
    }
    return null;
  }, [form.start_time, form.hours, form.end_time]);

  return (
    <SheetModal
      open={open}
      closing={closing}
      onClose={onClose}
      title={editing_shift ? "Edit shift" : "Add shift"}
    >
      <form className="shifts__form" onSubmit={onSubmit}>
        <FormField
          label="Place"
          error={field_errors.place}
          state={field_states.place}
          show_indicator
        >
          <select
            value={form.place}
            onChange={(e) => {
              set_form({ ...form, place: e.target.value });
            }}
          >
            {Object.entries(places).map(([key, { label, rate }]) => (
              <option key={key} value={key}>
                {label} — ₪{rate}/hr
                {deactivated_slugs.has(key) ? " (inactive)" : ""}
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
              onClick={() => set_form({ ...form, pay_type: id })}
              aria-pressed={form.pay_type === id}
            >
              {label}
            </button>
          ))}
        </div>

        <FormField
          label="Date"
          error={field_errors.shift_date}
          state={field_states.shift_date}
          show_indicator
          shake={field_errors.shift_date ? shake_key : 0}
        >
          <input
            type="date"
            value={form.shift_date}
            onChange={(e) => {
              set_form({ ...form, shift_date: e.target.value });
            }}
            onBlur={() => onFieldBlur("shift_date")}
            required
          />
        </FormField>

        <div className="form-time-row">
          <FormField
            label="Start time"
            error={field_errors.start_time}
            state={field_states.start_time}
            show_indicator
            shake={field_errors.start_time ? shake_key : 0}
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
            error={field_errors.end_time}
            state={field_states.end_time}
            show_indicator
            shake={field_errors.end_time ? shake_key : 0}
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
          error={field_errors.hours}
          state={field_states.hours}
          show_indicator
          shake={field_errors.hours ? shake_key : 0}
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
          error={field_errors.tips}
          state={field_states.tips}
          show_indicator
          shake={field_errors.tips ? shake_key : 0}
          optional={form.pay_type !== "tips_only"}
        >
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.tips}
            onChange={(e) => set_form({ ...form, tips: e.target.value })}
            onBlur={() => onFieldBlur("tips")}
          />
        </FormField>

        <FormField
          label="Notes"
          optional
          char_count={form.notes.length}
          max_chars={500}
        >
          <textarea
            placeholder="e.g. Covered for Dana, closed the register"
            value={form.notes}
            maxLength={500}
            onChange={(e) => set_form({ ...form, notes: e.target.value })}
          />
        </FormField>

        {form.hours && (
          <p className="shifts__preview shifts__preview--pop">
            {form.pay_type === "tips_only" ? (
              <>
                Tips only shift — total{" "}
                <strong>{format_money(parseFloat(form.tips) || 0)}</strong>
              </>
            ) : (
              <>
                Estimated pay: <strong>{format_money(preview_pay)}</strong>
                {form.tips && (
                  <>
                    {" "}
                    + tips {format_money(parseFloat(form.tips) || 0)} ={" "}
                    <strong>
                      {format_money(preview_pay + (parseFloat(form.tips) || 0))}
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
            disabled={!is_form_valid}
            title="Save current form as a reusable preset"
          >
            Save as preset
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || !is_form_valid}
          >
            {saving ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                Saving…
              </>
            ) : editing_shift ? (
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
