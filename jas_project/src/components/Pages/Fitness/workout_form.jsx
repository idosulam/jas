import { useMemo } from "react";
import SheetModal from "../../../components/ui/modals/sheet_modal";
import FormField from "../../../components/ui/form/form_field.jsx";
import ExerciseRow from "./exercise_row";
import { calcVolume, formatVolume } from "./workout_utils";

export default function WorkoutForm({
  open,
  closing,
  onClose,
  editingWorkout,
  form,
  setForm,
  fieldErrors,
  fieldStates,
  shakeKey,
  saving,
  isFormValid,
  onAddExercise,
  onRemoveExercise,
  onUpdateExercise,
  onSubmit,
  onFieldBlur,
  exerciseCount,
}) {
  const volume = useMemo(() => calcVolume(form.exercises), [form.exercises]);

  const handleExerciseChange = (index, field, value) => {
    onUpdateExercise(index, field, value);
  };

  const handleExerciseRemove = (index) => {
    onRemoveExercise(index);
  };

  return (
    <SheetModal
      open={open}
      closing={closing}
      onClose={onClose}
      title={editingWorkout ? "Edit workout" : "Log workout"}
    >
      <form className="fitness__form" onSubmit={onSubmit}>
        <FormField
          label="Date"
          error={fieldErrors.workout_date}
          state={fieldStates.workout_date}
          showIndicator
          shake={fieldErrors.workout_date ? shakeKey : 0}
        >
          <input
            type="date"
            value={form.workout_date}
            onChange={(e) => {
              setForm((f) => ({ ...f, workout_date: e.target.value }));
            }}
            onBlur={() => onFieldBlur("workout_date")}
            required
          />
        </FormField>

        <FormField
          label="Workout name"
          error={fieldErrors.preset_name}
          state={fieldStates.preset_name}
          showIndicator
          shake={fieldErrors.preset_name ? shakeKey : 0}
        >
          <input
            type="text"
            placeholder="e.g. Push day, Leg day"
            value={form.preset_name}
            maxLength={60}
            onChange={(e) => {
              setForm((f) => ({ ...f, preset_name: e.target.value }));
            }}
            onBlur={() => onFieldBlur("preset_name")}
            required
          />
        </FormField>

        <div className="fitness__exercises-section">
          <div className="fitness__exercises-header">
            <span className="fitness__exercises-label">Exercises</span>
            {fieldErrors.exercises && (
              <span className="fitness__field-error-text">
                {fieldErrors.exercises}
              </span>
            )}
          </div>
          {form.exercises.map((ex, i) => (
            <ExerciseRow
              key={i}
              exercise={ex}
              index={i}
              onChange={handleExerciseChange}
              onRemove={handleExerciseRemove}
              showRemove={exerciseCount > 1}
            />
          ))}
          <button
            type="button"
            className="fitness__exercise-add"
            onClick={onAddExercise}
          >
            + Add exercise
          </button>
        </div>

        <FormField label="Duration (minutes)" optional>
          <input
            type="number"
            min="1"
            max="600"
            placeholder="e.g. 60"
            value={form.duration_minutes}
            onChange={(e) =>
              setForm((f) => ({ ...f, duration_minutes: e.target.value }))
            }
          />
        </FormField>

        <FormField
          label="Calories burned"
          error={fieldErrors.calories_burned}
          state={fieldStates.calories_burned}
          showIndicator
          shake={fieldErrors.calories_burned ? shakeKey : 0}
          optional
        >
          <input
            type="number"
            min="0"
            max="9999"
            placeholder="e.g. 350"
            value={form.calories_burned}
            onChange={(e) => {
              setForm((f) => ({ ...f, calories_burned: e.target.value }));
            }}
            onBlur={() => onFieldBlur("calories_burned")}
          />
        </FormField>

        <FormField
          label="Notes"
          optional
          charCount={form.notes.length}
          maxChars={500}
        >
          <textarea
            placeholder="e.g. Felt strong, increased bench PR"
            value={form.notes}
            maxLength={500}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
          />
        </FormField>

        {volume > 0 && (
          <p className="fitness__preview">
            Total volume: <strong>{formatVolume(volume)} kg</strong>
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
            type="submit"
            className="btn btn--primary"
            disabled={saving || !isFormValid}
          >
            {saving ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                Saving…
              </>
            ) : editingWorkout ? (
              "Save changes"
            ) : (
              "Log workout"
            )}
          </button>
        </div>
      </form>
    </SheetModal>
  );
}
