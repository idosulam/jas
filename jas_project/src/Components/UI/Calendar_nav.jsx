/**
 * Calendar_nav — Smart shared calendar navigation component
 *
 * Fully controlled: parent owns selectedDate & viewMode state.
 * Calendar_nav handles all date computation (week/month days),
 * renders nav + toggle + day grid, and fires callbacks on change.
 *
 * Props (required):
 *   selectedDate       – Date object, currently selected date
 *   viewMode           – "week" | "month"
 *   onDateChange(date) – called when user picks a date or navigates
 *   onViewModeChange(mode) – called when user toggles week/month
 *
 * Props (optional):
 *   busyDates          – Set<string> of date keys that have events
 *   formatLabel(date, viewMode) – custom label formatter
 *   showDayLabels      – show weekday abbreviations in week mode (default: true)
 *   className          – extra class on the root wrapper
 *   animateClass       – animation class (default: "animate-in animate-in--1")
 */
import { useMemo } from "react";
import { To_date_key, Add_days, Start_of_week } from "../../Lib/Date_utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar_nav({
  selectedDate,
  viewMode,
  onDateChange,
  onViewModeChange,
  busyDates = new Set(),
  formatLabel,
  showDayLabels = true,
  className = "",
  animateClass = "animate-in animate-in--1",
}) {
  const today = useMemo(() => new Date(), []);
  const selectedKey = To_date_key(selectedDate);
  const isToday = selectedKey === To_date_key(today);

  // ── Derived days ──

  const weekDays = useMemo(() => {
    const start = Start_of_week(selectedDate);
    return Array.from({ length: 7 }, (_, i) => Add_days(start, i));
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const start = Start_of_week(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    );
    return Array.from({ length: 42 }, (_, i) => Add_days(start, i));
  }, [selectedDate]);

  const visibleDays = viewMode === "week" ? weekDays : monthDays;

  // ── Label ──

  const label = formatLabel
    ? formatLabel(selectedDate, viewMode)
    : viewMode === "month"
      ? selectedDate.toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })
      : selectedDate.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        });

  // ── Handlers ──

  const navigate = (direction) => {
    const delta = direction === "next" ? 1 : -1;
    if (viewMode === "month") {
      const next = new Date(selectedDate);
      next.setMonth(next.getMonth() + delta);
      onDateChange(next);
    } else {
      onDateChange(Add_days(selectedDate, delta * 7));
    }
  };

  const goToday = () => onDateChange(new Date());

  // ── Render ──

  return (
    <div className={className}>
      {/* Date navigation */}
      <div className={`date-nav ${animateClass}`}>
        <button
          type="button"
          className="date-nav__btn"
          onClick={() => navigate("prev")}
          aria-label={viewMode === "month" ? "Previous month" : "Previous week"}
        >
          ‹
        </button>
        <div className="date-nav__center">
          <span className="date-nav__label">{label}</span>
          {!isToday && (
            <button
              type="button"
              className="date-nav__today"
              onClick={goToday}
            >
              Today
            </button>
          )}
        </div>
        <button
          type="button"
          className="date-nav__btn"
          onClick={() => navigate("next")}
          aria-label={viewMode === "month" ? "Next month" : "Next week"}
        >
          ›
        </button>
      </div>

      {/* View toggle */}
      <div
        className="view-toggle animate-in animate-in--2"
        role="tablist"
        aria-label="Calendar view"
      >
        <button
          type="button"
          className={`view-btn${viewMode === "week" ? " view-btn--active" : ""}`}
          onClick={() => onViewModeChange("week")}
          aria-pressed={viewMode === "week"}
        >
          1 week
        </button>
        <button
          type="button"
          className={`view-btn${viewMode === "month" ? " view-btn--active" : ""}`}
          onClick={() => onViewModeChange("month")}
          aria-pressed={viewMode === "month"}
        >
          1 month
        </button>
      </div>

      {/* Day grid */}
      <div
        className={`week-days animate-in animate-in--2${viewMode === "month" ? " week-days--month" : ""}`}
        role="group"
        aria-label={viewMode === "week" ? "Week days" : "Month days"}
      >
        {visibleDays.map((day) => {
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
              onClick={() => onDateChange(day)}
              aria-pressed={isSelected}
            >
              {viewMode === "week" && showDayLabels && (
                <span className="week-day__label">
                  {WEEKDAYS[day.getDay()]}
                </span>
              )}
              <span className="week-day__num">{day.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
