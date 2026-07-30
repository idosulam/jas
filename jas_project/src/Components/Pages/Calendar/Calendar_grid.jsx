import { to_date_key } from "./Calendar_layout";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarGrid({
  visible_days,
  selected_date,
  today,
  view_mode,
  busy_dates,
  onDaySelect,
}) {
  const selected_key = to_date_key(selected_date);

  return (
    <div
      className={`calendar__week animate-in animate-in--2${view_mode === "month" ? " calendar__week--month" : " calendar__week--week"}`}
      role="group"
      aria-label={view_mode === "week" ? "Week days" : "Month days"}
    >
      {visible_days.map((day) => {
        const key = to_date_key(day);
        const isSelected = key === selected_key;
        const isDayToday = key === to_date_key(today);
        const hasEvents = busy_dates.has(key);
        const isInCurrentMonth =
          view_mode === "month"
            ? day.getMonth() === selected_date.getMonth()
            : true;

        return (
          <button
            key={key}
            type="button"
            className={`calendar__week-day${isSelected ? " calendar__week-day--active" : ""}${isDayToday ? " calendar__week-day--today" : ""}${hasEvents ? " calendar__week-day--busy" : ""}${!isInCurrentMonth ? " calendar__week-day--muted" : ""}`}
            onClick={() => onDaySelect(day)}
            aria-pressed={isSelected}
          >
            {view_mode === "week" && (
              <span className="calendar__week-label">
                {WEEKDAYS[day.getDay()]}
              </span>
            )}
            <span className="calendar__week-num">{day.getDate()}</span>
            {hasEvents && (
              <span className="calendar__week-dot" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}
