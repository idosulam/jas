import { useMemo } from "react";
import Sheet_modal from "../../../Components/UI/Modals/Sheet_modal";
import Form_field from "../../../Components/UI/Form/Form_field.jsx";
import Exercise_row from "./Exercise_row";
import { Calc_volume, Format_volume } from "./Workout_utils";

export default function Workout_form({
  open,
  closing,
  onClose,
  editingWorkout,
  form,
  Set_form,
  Field_errors,
  Field_states,
  Shake_key,
  Saving,
  Is_form_valid,
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
  const volume = useMemo(() => Calc_volume(form.exercises), [form.exercises]);

  const Handle_exercise_change = (index, field, value) => {
    onUpdateExercise(index, field, value);
  };

  const handleExerciseRemove = (index) => {
    onRemoveExercise(index);
  };

  return (
    <Sheet_modal
      open={open}
      closing={closing}
      onClose={onClose}
      title={editingWorkout ? "Edit workout" : "Log workout"}
    >
      <form className="fitness__form" onSubmit={onSubmit}>
        <Form_field
          label="Date"
          error={Field_errors.workout_date}
          state={Field_states.workout_date}
          show_indicator
          shake={Field_errors.workout_date ? Shake_key : 0}
        >
          <input
            type="date"
            value={form.workout_date}
            onChange={(e) => {
              Set_form((f) => ({ ...f, workout_date: e.target.value }));
            }}
            onBlur={() => onFieldBlur("workout_date")}
            required
          />
        </Form_field>

        <Form_field
          label="Workout name"
          error={Field_errors.preset_name}
          state={Field_states.preset_name}
          show_indicator
          shake={Field_errors.preset_name ? Shake_key : 0}
        >
          <input
            type="text"
            placeholder="e.g. Push day, Leg day"
            value={form.preset_name}
            maxLength={60}
            onChange={(e) => {
              Set_form((f) => ({ ...f, preset_name: e.target.value }));
            }}
            onBlur={() => onFieldBlur("preset_name")}
            required
          />
        </Form_field>

        <div className="fitness__exercises-section">
          <div className="fitness__exercises-header">
            <span className="fitness__exercises-label">Exercises</span>
            {Field_errors.exercises && (
              <span className="fitness__field-error-text">
                {Field_errors.exercises}
              </span>
            )}
          </div>
          {form.exercises.map((ex, i) => (
            <Exercise_row
              key={i}
              exercise={ex}
              index={i}
              onChange={Handle_exercise_change}
              onRemove={handleExerciseRemove}
              showRemove={exerciseCount > 1}
              errors={exerciseErrors}
              states={exerciseStates}
              Shake_key={Shake_key}
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

        <Form_field label="Duration (minutes)" optional>
          <input
            type="number"
            min="1"
            max="600"
            placeholder="e.g. 60"
            value={form.duration_minutes}
            onChange={(e) =>
              Set_form((f) => ({ ...f, duration_minutes: e.target.value }))
            }
          />
        </Form_field>

        <Form_field
          label="Calories burned"
          error={Field_errors.Calories_burned}
          state={Field_states.Calories_burned}
          show_indicator
          shake={Field_errors.Calories_burned ? Shake_key : 0}
          optional
        >
          <input
            type="number"
            min="0"
            max="9999"
            placeholder="e.g. 350"
            value={form.Calories_burned}
            onChange={(e) => {
              Set_form((f) => ({ ...f, Calories_burned: e.target.value }));
            }}
            onBlur={() => onFieldBlur("Calories_burned")}
          />
        </Form_field>

        <Form_field
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
              Set_form((f) => ({ ...f, notes: e.target.value }))
            }
          />
        </Form_field>

        {volume > 0 && (
          <p className="fitness__preview">
            Total volume: <strong>{Format_volume(volume)} kg</strong>
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
            type="submit"
            className="btn btn--primary"
            disabled={Saving || !Is_form_valid}
          >
            {Saving ? (
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
    </Sheet_modal>
  );
}
