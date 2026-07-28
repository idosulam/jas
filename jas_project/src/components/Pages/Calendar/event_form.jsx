import ColorPalettePicker from "../../../lib/color_palette_picker.jsx";
import { SheetModal, FormField } from "../../../components";

export default function EventForm({
  open,
  closing,
  onClose,
  editingEvent,
  form,
  onFormChange,
  saving,
  fieldErrors,
  fieldStates,
  shakeKey,
  onFieldBlur,
  onSubmit,
  onClearFieldError,
  onSetFieldState,
  isValid,
}) {
  const handleChange = (field, value) => {
    onFormChange({ ...form, [field]: value });
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
      title={editingEvent ? "Edit event" : "Add event"}
    >
      <form className="calendar__form" onSubmit={onSubmit}>
        <FormField
          label="Title"
          error={fieldErrors.title}
          state={fieldStates.title}
          showIndicator
          shake={fieldErrors.title ? shakeKey : 0}
        >
          <input
            type="text"
            value={form.title}
            onChange={(e) => {
              handleChange("title", e.target.value);
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
          error={fieldErrors.event_date}
          state={fieldStates.event_date}
          showIndicator
          shake={fieldErrors.event_date ? shakeKey : 0}
        >
          <input
            type="date"
            value={form.event_date}
            onChange={(e) => {
              handleChange("event_date", e.target.value);
              handleClearErrors(["event_date"]);
            }}
            onBlur={() => onFieldBlur("event_date")}
            required
          />
        </FormField>

        <FormField
          label="Start"
          error={fieldErrors.start_time}
          state={fieldStates.start_time}
          showIndicator
          shake={fieldErrors.start_time ? shakeKey : 0}
        >
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => {
              handleChange("start_time", e.target.value);
              handleClearErrors(["start_time", "end_time"]);
            }}
            onBlur={() => onFieldBlur("start_time")}
            required
          />
        </FormField>

        <FormField
          label="End"
          error={fieldErrors.end_time}
          state={fieldStates.end_time}
          showIndicator
          shake={fieldErrors.end_time ? shakeKey : 0}
        >
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => {
              handleChange("end_time", e.target.value);
              handleClearErrors(["end_time", "start_time"]);
            }}
            onBlur={() => onFieldBlur("end_time")}
            required
          />
        </FormField>

        <FormField
          label="Color"
          error={fieldErrors.color}
          state={fieldStates.color || (form.color ? "valid" : "idle")}
          showIndicator
          shake={fieldErrors.color ? shakeKey : 0}
        >
          <ColorPalettePicker
            value={form.color}
            onChange={(hex) => {
              handleChange("color", hex);
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
          charCount={form.notes.length}
          maxChars={240}
        >
          <textarea
            rows={3}
            value={form.notes}
            maxLength={240}
            onChange={(e) => handleChange("notes", e.target.value)}
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
            ) : editingEvent ? (
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
