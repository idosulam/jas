import { formatDateFriendly } from "../../../lib/security";
import { kgToLbs } from "../../../lib/weight";
import { calcVolume, formatVolume } from "./workout_utils";

export default function WorkoutCard({
  workout,
  index,
  onEdit,
  onDelete,
  onToggleNote,
  expandedNoteId,
  isRemoving,
}) {
  const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
  const vol = calcVolume(exercises);

  return (
    <li
      className={`fitness__card${isRemoving ? " fitness__card--removing" : ""}`}
      style={{ "--card-delay": `${index * 0.06}s` }}
    >
      <div className="fitness__card-main">
        <div className="fitness__card-top">
          <span className="fitness__card-date">
            {formatDateFriendly(workout.workout_date)}
          </span>
          {workout.preset_name && (
            <span className="fitness__card-preset">
              {workout.preset_name}
            </span>
          )}
          {workout.notes && (
            <button
              type="button"
              className={`fitness__note-toggle${expandedNoteId === workout.id ? " fitness__note-toggle--active" : ""}`}
              onClick={() => onToggleNote(workout.id)}
              aria-expanded={expandedNoteId === workout.id}
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
              {ex.weight ? ` ${ex.weight}kg (${kgToLbs(ex.weight)}lbs)` : ""}
              {ex.sets && ex.reps ? ` ${ex.sets}×${ex.reps}` : ""}
            </span>
          ))}
        </div>
        <div className="fitness__card-meta">
          {vol > 0 && (
            <span className="fitness__card-volume">
              Vol: {formatVolume(vol)} kg
            </span>
          )}
          {workout.duration_minutes && (
            <span className="fitness__card-duration">
              {workout.duration_minutes}m
            </span>
          )}
          {workout.calories_burned > 0 && (
            <span className="fitness__card-calories">
              {workout.calories_burned} kcal
            </span>
          )}
        </div>
        {workout.notes && expandedNoteId === workout.id && (
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
