import { format_time_12 } from "./Calendar_layout";

export default function ReminderList({
  events,
  Is_wake_event,
  onCheck,
  onEdit,
  onDelete,
  Toggling_id,
  Removing_id,
}) {
  const filtered = events.filter((event) => !Is_wake_event(event));

  if (filtered.length === 0) return null;

  return (
    <ul className="calendar__reminders animate-in animate-in--4">
      {filtered.map((event) => (
        <li
          key={`list-${event.id}`}
          className={`calendar__reminder${event.is_completed ? " calendar__reminder--done" : ""}${Removing_id === event.id ? " calendar__reminder--removing" : ""}`}
        >
          <button
            type="button"
            className="calendar__check calendar__check--list"
            onClick={() => onCheck(event)}
            disabled={Toggling_id === event.id}
            aria-label={
              event.is_completed
                ? `Mark ${event.title} as pending`
                : `Mark ${event.title} as done`
            }
            aria-pressed={event.is_completed}
          >
            <span className="calendar__check-icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="calendar__reminder-main"
            onClick={() => onEdit(event)}
          >
            <span className="calendar__reminder-title">{event.title}</span>
            <span className="calendar__reminder-time">
              {format_time_12(event.start_time)} –{" "}
              {format_time_12(event.end_time)}
            </span>
          </button>
          <button
            type="button"
            className="calendar__reminder-delete"
            onClick={() => onDelete(event)}
            aria-label={`Delete ${event.title}`}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
