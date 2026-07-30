import { Format_date_friendly } from "../../../Lib/Security";
import { Kg_to_lbs } from "../../../Lib/Weight";
import { Calc_volume, Format_volume } from "./Workout_utils";

export default function Workout_card({
  workout,
  index,
  onEdit,
  onDelete,
  onToggleNote,
  Expanded_note_id,
  isRemoving,
}) {
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const vol = Calc_volume(exercises);

  return (
    <li
      className={`fitness__card${isRemoving ? " fitness__card--removing" : ""}`}
      style={{ "--card-delay": `${index * 0.06}s` }}
    >
      <div className="fitness__card-main">
        <div className="fitness__card-top">
          <span className="fitness__card-date">
            {Format_date_friendly(workout.workout_date)}
          </span>
          {workout.preset_name && (
            <span className="fitness__card-preset">
              {workout.preset_name}
            </span>
          )}
          {workout.notes && (
            <button
              type="button"
              className={`fitness__note-toggle${Expanded_note_id === workout.id ? " fitness__note-toggle--active" : ""}`}
              onClick={() => onToggleNote(workout.id)}
              aria-expanded={Expanded_note_id === workout.id}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12c0 4.418-4.03 8-9 8-1.06 0-2.07-.16-3-.46L3 21l1.5-4.5C3.55 15.13 3 13.62 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
              </svg>
            </button>
          )}
        </div>
        <div className="fitness__card-exercises">
          {exercises.map((ex, i) => (
            <span key={i} className="fitness__card-exercise">
              {ex.name}
              {ex.weight ? ` ${ex.weight}kg (${Kg_to_lbs(ex.weight)}lbs)` : ""}
              {ex.sets && ex.reps ? ` ${ex.sets}×${ex.reps}` : ""}
            </span>
          ))}
        </div>
        <div className="fitness__card-meta">
          {vol > 0 && (
            <span className="fitness__card-volume">
              Vol: {Format_volume(vol)} kg
            </span>
          )}
          {workout.duration_minutes && (
            <span className="fitness__card-duration">
              {workout.duration_minutes}m
            </span>
          )}
          {workout.Calories_burned > 0 && (
            <span className="fitness__card-calories">
              {workout.Calories_burned} kcal
            </span>
          )}
        </div>
        {workout.notes && Expanded_note_id === workout.id && (
          <p className="fitness__note-panel">{workout.notes}</p>
        )}
      </div>
      <div className="fitness__card-actions">
        <button
          type="button"
          className="fitness__action fitness__action--edit"
          onClick={() => onEdit(workout)}
          aria-label="Edit workout"
        >
          Edit
        </button>
        <button
          type="button"
          className="fitness__action fitness__action--delete"
          onClick={() => onDelete(workout)}
          aria-label="Delete workout"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
