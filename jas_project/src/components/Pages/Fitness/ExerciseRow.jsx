import { kgToLbs, lbsToKg } from "../../../lib/weight";

export default function ExerciseRow({ exercise, index, onChange, onRemove, showRemove }) {
  return (
    <div className="fitness__exercise-row">
      <div className="fitness__exercise-fields">
        <input
          type="text"
          className="fitness__exercise-name"
          placeholder="Exercise name"
          value={exercise.name}
          maxLength={80}
          onChange={(e) => onChange(index, "name", e.target.value)}
        />
        <div className="fitness__exercise-numbers">
          <input
            type="number"
            className="fitness__exercise-input"
            placeholder="kg"
            min="0"
            step="0.5"
            value={exercise.weight}
            onChange={(e) => {
              onChange(index, "weight", e.target.value);
              onChange(index, "weight_lbs", kgToLbs(e.target.value));
            }}
          />
          <input
            type="number"
            className="fitness__exercise-input"
            placeholder="lbs"
            min="0"
            step="0.5"
            value={exercise.weight_lbs || ""}
            onChange={(e) => {
              onChange(index, "weight_lbs", e.target.value);
              onChange(index, "weight", lbsToKg(e.target.value));
            }}
          />
          <input
            type="number"
            className="fitness__exercise-input"
            placeholder="sets"
            min="0"
            value={exercise.sets}
            onChange={(e) => onChange(index, "sets", e.target.value)}
          />
          <input
            type="number"
            className="fitness__exercise-input"
            placeholder="reps"
            min="0"
            value={exercise.reps}
            onChange={(e) => onChange(index, "reps", e.target.value)}
          />
        </div>
      </div>
      {showRemove && (
        <button
          type="button"
          className="fitness__exercise-remove"
          onClick={() => onRemove(index)}
          aria-label="Remove exercise"
        >
          ×
        </button>
      )}
    </div>
  );
}
