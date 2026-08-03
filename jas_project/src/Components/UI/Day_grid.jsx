/**
 * Day_grid — Shared week/month day selector grid
 *
 * Props:
 *   days           – array of Date objects to render
 *   selectedDate   – currently selected Date
 *   today          – today's Date
 *   viewMode       – "week" | "month"
 *   busyDates      – Set<string> of date keys that have events/shifts
 *   onDaySelect(date) – called when a day is tapped
 *   className      – optional extra class on the root element
 */
import { To_date_key } from "../../Lib/Date_utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Day_grid({
  days,
  selectedDate,
  today,
  viewMode,
  busyDates,
  onDaySelect,
  className = "",
}) {
  const selectedKey = To_date_key(selectedDate);

  return (
    <div
      className={`week-days ${className}${viewMode === "month" ? " week-days--month" : ""}`}
      role="group"
      aria-label={viewMode === "week" ? "Week days" : "Month days"}
    >
      {days.map((day) => {
        const key = To_date_key(day);
        const isSelected = key === selectedKey;
        const isDayToday = key === To_date_key(today);
        const isBusy = busyDates?.has(key) ?? false;
        const isInCurrentMonth =
          viewMode === "month"
            ? day.getMonth() === selectedDate.getMonth()
            : true;

        return (
          <button
            key={key}
            type="button"
            className={`week-day${isSelected ? " week-day--active" : ""}${isDayToday ? " week-day--today" : ""}${isBusy ? " week-day--busy" : ""}${!isInCurrentMonth ? " week-day--muted" : ""}`}
            onClick={() => onDaySelect(day)}
            aria-pressed={isSelected}
          >
            {viewMode === "week" && (
              <span className="week-day__label">
                {WEEKDAYS[day.getDay()]}
              </span>
            )}
            <span className="week-day__num">{day.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}
