import ColorPalettePicker from "../../../Lib/Color_palette_picker.jsx";
import { SheetModal, FormField } from "../../../components";

export default function EventForm({
  open,
  closing,
  onClose,
  editing_event,
  form,
  on_form_change,
  saving,
  field_errors,
  field_states,
  shake_key,
  onFieldBlur,
  onSubmit,
  onClearFieldError,
  onSetFieldState,
  isValid,
}) {
  const handle_change = (field, value) => {
    on_form_change({ ...form, [field]: value });
  };

  const handleClearErrors = (fields) => {
    if (onClearFieldError) {
      fields.forEach((f) => onClearFieldError(f));
    }
  };

  return (
    <SheetModal
      open={open}
      closing={closing}
      onClose={onClose}
      title={editing_event ? "Edit event" : "Add event"}
    >
      <form className="calendar__form" onSubmit={onSubmit}>
        <FormField
          label="Title"
          error={field_errors.title}
          state={field_states.title}
          show_indicator
          shake={field_errors.title ? shake_key : 0}
        >
          <input
            type="text"
            value={form.title}
            onChange={(e) => {
              handle_change("title", e.target.value);
              handleClearErrors(["title"]);
            }}
            onBlur={() => onFieldBlur("title")}
            placeholder="Workout, meeting…"
            required
            autoComplete="off"
          />
        </FormField>

        <FormField
          label="Date"
          error={field_errors.event_date}
          state={field_states.event_date}
          show_indicator
          shake={field_errors.event_date ? shake_key : 0}
        >
          <input
            type="date"
            value={form.event_date}
            onChange={(e) => {
              handle_change("event_date", e.target.value);
              handleClearErrors(["event_date"]);
            }}
            onBlur={() => onFieldBlur("event_date")}
            required
          />
        </FormField>

        <FormField
          label="Start"
          error={field_errors.start_time}
          state={field_states.start_time}
          show_indicator
          shake={field_errors.start_time ? shake_key : 0}
        >
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => {
              handle_change("start_time", e.target.value);
              handleClearErrors(["start_time", "end_time"]);
            }}
            onBlur={() => onFieldBlur("start_time")}
            required
          />
        </FormField>

        <FormField
          label="End"
          error={field_errors.end_time}
          state={field_states.end_time}
          show_indicator
          shake={field_errors.end_time ? shake_key : 0}
        >
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => {
              handle_change("end_time", e.target.value);
              handleClearErrors(["end_time", "start_time"]);
            }}
            onBlur={() => onFieldBlur("end_time")}
            required
          />
        </FormField>

        <FormField
          label="Color"
          error={field_errors.color}
          state={field_states.color || (form.color ? "valid" : "idle")}
          show_indicator
          shake={field_errors.color ? shake_key : 0}
        >
          <ColorPalettePicker
            value={form.color}
            onChange={(hex) => {
              handle_change("color", hex);
              handleClearErrors(["color"]);
              if (hex && onSetFieldState) {
                onSetFieldState("color", "valid");
              }
            }}
          />
        </FormField>

        <FormField
          label="Notes"
          optional
          char_count={form.notes.length}
          max_chars={240}
        >
          <textarea
            rows={3}
            value={form.notes}
            maxLength={240}
            onChange={(e) => handle_change("notes", e.target.value)}
            placeholder="Reminder details…"
          />
        </FormField>

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
            type="submit"
            className="btn btn--primary"
            disabled={saving || !isValid}
          >
            {saving ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                Saving…
              </>
            ) : editing_event ? (
              "Save changes"
            ) : (
              "Add event"
            )}
          </button>
        </div>
      </form>
    </SheetModal>
  );
}
