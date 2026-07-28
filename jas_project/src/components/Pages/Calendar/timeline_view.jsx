import {
  DAY_START_HOUR,
  HOUR_HEIGHT,
  TOTAL_HOURS,
  eventStyle,
  resolveColor,
  formatTime12,
} from "./calendar_layout";
import { parseTimeToMinutes } from "../../../lib/calendar_sync";

export default function TimelineView({
  hourLabels,
  laidOutEvents,
  nowLineTop,
  onGridClick,
  onEventClick,
  onCheck,
  onDelete,
  togglingId,
  removingId,
  isWakeEvent,
}) {
  return (
    <div className="calendar__timeline">
      <div className="calendar__hours" aria-hidden="true">
        {hourLabels.map((label) => (
          <div
            key={label}
            className="calendar__hour-label"
            style={{ height: `${HOUR_HEIGHT}px` }}
          >
            {label}
          </div>
        ))}
      </div>

      <div
        className="calendar__grid"
        style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
        onClick={onGridClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onGridClick(e);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Click to add event at that time"
      >
        {hourLabels.map((_, i) => (
          <div
            key={i}
            className="calendar__grid-line"
            style={{ top: `${i * HOUR_HEIGHT}px` }}
          />
        ))}

        {nowLineTop !== null && (
          <div
            className="calendar__now-line"
            style={{ top: `${nowLineTop}px` }}
            aria-hidden="true"
          >
            <span className="calendar__now-dot" />
          </div>
        )}

        {laidOutEvents.map((event) => {
          if (isWakeEvent(event)) {
            const minutes = parseTimeToMinutes(event.start_time);
            const dayStartMin = DAY_START_HOUR * 60;
            const top = ((minutes - dayStartMin) / 60) * HOUR_HEIGHT;
            return (
              <div
                key={event.id}
                className="calendar__wake-line"
                style={{ top: `${top}px` }}
                aria-hidden="true"
              >
                <span className="calendar__wake-label">{event.title}</span>
              </div>
            );
          }

          const style = eventStyle(event);
          if (!style) return null;

          const colorInfo = resolveColor(event.color);
          const isShort = parseInt(style.height, 10) < 44;

          return (
            <article
              key={event.id}
              className={`calendar__event calendar__event--${event.color}${event.is_completed ? " calendar__event--done" : ""}${removingId === event.id ? " calendar__event--removing" : ""}`}
              style={{
                ...style,
                "--event-accent": colorInfo.accent,
                "--event-bg": colorInfo.bg,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="calendar__check"
                onClick={() => onCheck(event)}
                disabled={togglingId === event.id}
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
                className="calendar__event-body"
                onClick={() => onEventClick(event)}
              >
                <span className="calendar__event-title">{event.title}</span>
                {!isShort && (
                  <span className="calendar__event-time">
                    {formatTime12(event.start_time)} –{" "}
                    {formatTime12(event.end_time)}
                  </span>
                )}
              </button>

              <div className="calendar__event-actions">
                <button
                  type="button"
                  className="calendar__event-action calendar__event-action--delete"
                  onClick={() => onDelete(event)}
                  aria-label={`Delete ${event.title}`}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
