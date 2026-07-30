import { useMemo } from "react";
import Sheet_modal from "../../../Components/UI/Modals/Sheet_modal";
import Form_field from "../../UI/Form/Form_field.jsx";
import {
  Parse_time_to_minutes,
  Minutes_to_time,
} from "../../../Lib/Calendar_sync";
import { Format_money } from "../../../Lib/Format";
import { PAY_TYPES, calc_pay } from "./Shift_utils";

/**
 * Add / Edit shift form inside a Sheet_modal.
 *
 * Props:
 *   open, closing, onClose          – modal visibility
 *   form, Set_form                   – form state
 *   Editing_shift                    – shift being edited (null = add)
 *   Saving                          – submit-in-progress flag
 *   Field_errors, Field_states        – validation state maps
 *   Shake_key                        – counter that triggers shake animation
 *   onFieldBlur(field_name)          – blur validation handler
 *   onTimeChange(field, value)      – start/end time change handler
 *   onHoursChange(value)            – hours input change (reverse-calculates end)
 *   onSubmit(e)                     – form submit handler
 *   onSaveAsPreset                  – "save current as preset" handler
 *   places                          – PLACES map { slug: { label, rate, color } }
 *   Deactivated_slugs                – Set of deactivated workplace slugs
 *   Is_form_valid                     – boolean
 */
export default function Shift_form({
  open,
  closing,
  onClose,
  form,
  Set_form,
  Editing_shift,
  Saving,
  Field_errors,
  Field_states,
  Shake_key,
  onFieldBlur,
  onTimeChange,
  onHoursChange,
  onSubmit,
  onSaveAsPreset,
  places,
  Deactivated_slugs,
  Is_form_valid,
}) {
  const preview_pay = calc_pay(places, form.place, form.hours, form.pay_type);

  const endHint = useMemo(() => {
    if (!form.start_time || !form.hours || form.end_time) return null;
    const startMin = Parse_time_to_minutes(form.start_time);
    const h = parseFloat(form.hours);
    if (startMin != null && !isNaN(h) && h > 0) {
      const endMin = startMin + Math.round(h * 60);
      return Minutes_to_time(endMin);
    }
    return null;
  }, [form.start_time, form.hours, form.end_time]);

  return (
    <Sheet_modal
      open={open}
      closing={closing}
      onClose={onClose}
      title={Editing_shift ? "Edit shift" : "Add shift"}
    >
      <form className="shifts__form" onSubmit={onSubmit}>
        <Form_field
          label="Place"
          error={Field_errors.place}
          state={Field_states.place}
          show_indicator
        >
          <select
            value={form.place}
            onChange={(e) => {
              Set_form({ ...form, place: e.target.value });
            }}
          >
            {Object.entries(places).map(([key, { label, rate }]) => (
              <option key={key} value={key}>
                {label} — ₪{rate}/hr
                {Deactivated_slugs.has(key) ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </Form_field>

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
              onClick={() => Set_form({ ...form, pay_type: id })}
              aria-pressed={form.pay_type === id}
            >
              {label}
            </button>
          ))}
        </div>

        <Form_field
          label="Date"
          error={Field_errors.shift_date}
          state={Field_states.shift_date}
          show_indicator
          shake={Field_errors.shift_date ? Shake_key : 0}
        >
          <input
            type="date"
            value={form.shift_date}
            onChange={(e) => {
              Set_form({ ...form, shift_date: e.target.value });
            }}
            onBlur={() => onFieldBlur("shift_date")}
            required
          />
        </Form_field>

        <div className="form-time-row">
          <Form_field
            label="Start time"
            error={Field_errors.start_time}
            state={Field_states.start_time}
            show_indicator
            shake={Field_errors.start_time ? Shake_key : 0}
          >
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => onTimeChange("start_time", e.target.value)}
              onBlur={() => onFieldBlur("start_time")}
            />
          </Form_field>
          <Form_field
            label="End time"
            error={Field_errors.end_time}
            state={Field_states.end_time}
            show_indicator
            shake={Field_errors.end_time ? Shake_key : 0}
          >
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => onTimeChange("end_time", e.target.value)}
              onBlur={() => onFieldBlur("end_time")}
            />
          </Form_field>
        </div>

        {endHint && (
          <p className="form-field__hint">
            End time will be {endHint}
          </p>
        )}

        <Form_field
          label="Hours"
          error={Field_errors.hours}
          state={Field_states.hours}
          show_indicator
          shake={Field_errors.hours ? Shake_key : 0}
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
        </Form_field>

        <Form_field
          label="Tips"
          error={Field_errors.tips}
          state={Field_states.tips}
          show_indicator
          shake={Field_errors.tips ? Shake_key : 0}
          optional={form.pay_type !== "tips_only"}
        >
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.tips}
            onChange={(e) => Set_form({ ...form, tips: e.target.value })}
            onBlur={() => onFieldBlur("tips")}
          />
        </Form_field>

        <Form_field
          label="Notes"
          optional
          char_count={form.notes.length}
          max_chars={500}
        >
          <textarea
            placeholder="e.g. Covered for Dana, closed the register"
            value={form.notes}
            maxLength={500}
            onChange={(e) => Set_form({ ...form, notes: e.target.value })}
          />
        </Form_field>

        {form.hours && (
          <p className="shifts__preview shifts__preview--pop">
            {form.pay_type === "tips_only" ? (
              <>
                Tips only shift — total{" "}
                <strong>{Format_money(parseFloat(form.tips) || 0)}</strong>
              </>
            ) : (
              <>
                Estimated pay: <strong>{Format_money(preview_pay)}</strong>
                {form.tips && (
                  <>
                    {" "}
                    + tips {Format_money(parseFloat(form.tips) || 0)} ={" "}
                    <strong>
                      {Format_money(preview_pay + (parseFloat(form.tips) || 0))}
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
            disabled={Saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--outline"
            onClick={onSaveAsPreset}
            disabled={!Is_form_valid}
            title="Save current form as a reusable preset"
          >
            Save as preset
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={Saving || !Is_form_valid}
          >
            {Saving ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                Saving…
              </>
            ) : Editing_shift ? (
              "Save changes"
            ) : (
              "Add shift"
            )}
          </button>
        </div>
      </form>
    </Sheet_modal>
  );
}
