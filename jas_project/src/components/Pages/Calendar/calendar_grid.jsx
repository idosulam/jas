import { toDateKey } from "./calendar_layout";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarGrid({
  visibleDays,
  selectedDate,
  today,
  viewMode,
  busyDates,
  onDaySelect,
}) {
  const selectedKey = toDateKey(selectedDate);

  return (
    <div
      className={`calendar__week animate-in animate-in--2${viewMode === "month" ? " calendar__week--month" : " calendar__week--week"}`}
      role="group"
      aria-label={viewMode === "week" ? "Week days" : "Month days"}
    >
      {visibleDays.map((day) => {
        const key = toDateKey(day);
        const isSelected = key === selectedKey;
        const isDayToday = key === toDateKey(today);
        const hasEvents = busyDates.has(key);
        const isInCurrentMonth =
          viewMode === "month"
            ? day.getMonth() === selectedDate.getMonth()
            : true;

        return (
          <button
            key={key}
            type="button"
            className={`calendar__week-day${isSelected ? " calendar__week-day--active" : ""}${isDayToday ? " calendar__week-day--today" : ""}${hasEvents ? " calendar__week-day--busy" : ""}${!isInCurrentMonth ? " calendar__week-day--muted" : ""}`}
            onClick={() => onDaySelect(day)}
            aria-pressed={isSelected}
          >
            {viewMode === "week" && (
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
