import { format_date_label } from "../../../Lib/format";
import { format_weight_both } from "../../../Lib/weight";

export default function ProfileHistory({
  sorted,
  removing_id,
  unit,
  unitLabel,
  onEdit,
  onDelete,
}) {
  if (sorted.length === 0) {
    return (
      <p className="profile__empty">
        No entries yet — log your first weigh-in above.
      </p>
    );
  }

  return (
    <ul className="profile__history">
      {[...sorted].map((entry) => (
        <li
          key={entry.id}
          className={`profile__history-item${
            removing_id === entry.id
              ? " profile__history-item--removing"
              : ""
          }`}
        >
          {" "}
          <div>
            <span className="profile__history-date">
              {format_date_label(entry.entry_date)}
            </span>
            {entry.notes && (
              <span className="profile__history-note">
                {entry.notes}
              </span>
            )}
          </div>
          <div className="profile__history-actions">
            <span className="profile__history-weight">
              {format_weight_both(Number(entry.weight_kg))}
            </span>
            <button
              type="button"
              className="profile__icon-btn"
              onClick={() => onEdit(entry)}
              aria-label="Edit weigh-in"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
            <button
              type="button"
              className="profile__icon-btn profile__icon-btn--danger"
              onClick={() => onDelete(entry)}
              aria-label="Delete weigh-in"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
