import { to_date_key } from "./Calendar_layout";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarGrid({
  Visible_days,
  Selected_date,
  today,
  View_mode,
  busy_dates,
  onDaySelect,
}) {
  const Selected_key = to_date_key(Selected_date);

  return (
    <div
      className={`calendar__week animate-in animate-in--2${View_mode === "month" ? " calendar__week--month" : " calendar__week--week"}`}
      role="group"
      aria-label={View_mode === "week" ? "Week days" : "Month days"}
    >
      {Visible_days.map((day) => {
        const key = to_date_key(day);
        const isSelected = key === Selected_key;
        const isDayToday = key === to_date_key(today);
        const hasEvents = busy_dates.has(key);
        const isInCurrentMonth =
          View_mode === "month"
            ? day.getMonth() === Selected_date.getMonth()
            : true;

        return (
          <button
            key={key}
            type="button"
            className={`calendar__week-day${isSelected ? " calendar__week-day--active" : ""}${isDayToday ? " calendar__week-day--today" : ""}${hasEvents ? " calendar__week-day--busy" : ""}${!isInCurrentMonth ? " calendar__week-day--muted" : ""}`}
            onClick={() => onDaySelect(day)}
            aria-pressed={isSelected}
          >
            {View_mode === "week" && (
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
