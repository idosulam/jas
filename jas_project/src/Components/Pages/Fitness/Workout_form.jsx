import { useMemo } from "react";
import SheetModal from "../../../Components/UI/Modals/Sheet_modal";
import FormField from "../../../Components/UI/Form/Form_field.jsx";
import ExerciseRow from "./Exercise_row";
import { calcVolume, formatVolume } from "./Workout_utils";

export default function WorkoutForm({
  open,
  closing,
  onClose,
  editingWorkout,
  form,
  set_form,
  field_errors,
  field_states,
  shake_key,
  saving,
  is_form_valid,
  on_add_exercise,
  onRemoveExercise,
  onUpdateExercise,
  onSubmit,
  onFieldBlur,
  exerciseCount,
  exerciseErrors = {},
  exerciseStates = {},
  onExerciseFieldBlur,
}) {
  const volume = useMemo(() => calcVolume(form.exercises), [form.exercises]);

  const handle_exercise_change = (index, field, value) => {
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
          error={field_errors.workout_date}
          state={field_states.workout_date}
          show_indicator
          shake={field_errors.workout_date ? shake_key : 0}
        >
          <input
            type="date"
            value={form.workout_date}
            onChange={(e) => {
              set_form((f) => ({ ...f, workout_date: e.target.value }));
            }}
            onBlur={() => onFieldBlur("workout_date")}
            required
          />
        </FormField>

        <FormField
          label="Workout name"
          error={field_errors.preset_name}
          state={field_states.preset_name}
          show_indicator
          shake={field_errors.preset_name ? shake_key : 0}
        >
          <input
            type="text"
            placeholder="e.g. Push day, Leg day"
            value={form.preset_name}
            maxLength={60}
            onChange={(e) => {
              set_form((f) => ({ ...f, preset_name: e.target.value }));
            }}
            onBlur={() => onFieldBlur("preset_name")}
            required
          />
        </FormField>

        <div className="fitness__exercises-section">
          <div className="fitness__exercises-header">
            <span className="fitness__exercises-label">Exercises</span>
            {field_errors.exercises && (
              <span className="fitness__field-error-text">
                {field_errors.exercises}
              </span>
            )}
          </div>
          {form.exercises.map((ex, i) => (
            <ExerciseRow
              key={i}
              exercise={ex}
              index={i}
              onChange={handle_exercise_change}
              onRemove={handleExerciseRemove}
              showRemove={exerciseCount > 1}
              errors={exerciseErrors}
              states={exerciseStates}
              shake_key={shake_key}
              onFieldBlur={onExerciseFieldBlur}
            />
          ))}
          <button
            type="button"
            className="fitness__exercise-add"
            onClick={on_add_exercise}
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
              set_form((f) => ({ ...f, duration_minutes: e.target.value }))
            }
          />
        </FormField>

        <FormField
          label="Calories burned"
          error={field_errors.calories_burned}
          state={field_states.calories_burned}
          show_indicator
          shake={field_errors.calories_burned ? shake_key : 0}
          optional
        >
          <input
            type="number"
            min="0"
            max="9999"
            placeholder="e.g. 350"
            value={form.calories_burned}
            onChange={(e) => {
              set_form((f) => ({ ...f, calories_burned: e.target.value }));
            }}
            onBlur={() => onFieldBlur("calories_burned")}
          />
        </FormField>

        <FormField
          label="Notes"
          optional
          char_count={form.notes.length}
          max_chars={500}
        >
          <textarea
            placeholder="e.g. Felt strong, increased bench PR"
            value={form.notes}
            maxLength={500}
            onChange={(e) =>
              set_form((f) => ({ ...f, notes: e.target.value }))
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
            disabled={saving || !is_form_valid}
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
