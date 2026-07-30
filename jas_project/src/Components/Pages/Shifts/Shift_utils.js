import { Parse_time_to_minutes } from "../../../Lib/Calendar_sync";
import { Format_money } from "../../../Lib/format";

// ── Constants ──────────────────────────────────────────────────────

export const PAY_TYPES = [
  { id: "hourly", label: "Hourly + tips" },
  { id: "tips_only", label: "Tips only" },
];

export const FILTER_PICKER_BREAKPOINT = 768;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const MODAL_EXIT_MS = 320;

// ── Pure helper functions ──────────────────────────────────────────

/**
 * Return the current local time as "HH:MM".
 */
export function get_current_local_time() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Calculate hours between two "HH:MM" time strings, handling overnight.
 * Returns a number (decimal hours) or null when inputs are missing.
 */
export function calculate_hours_from_times(start_time, end_time) {
  const start = Parse_time_to_minutes(start_time);
  const end = Parse_time_to_minutes(end_time);
  if (start == null || end == null) return null;
  const diffMinutes = end >= start ? end - start : 24 * 60 - start + end;
  return Number((diffMinutes / 60).toFixed(2));
}

/**
 * Calculate the pay for a shift given the PLACES map and shift fields.
 */
export function calc_pay(places, place, hours, pay_type = "hourly") {
  if (pay_type === "tips_only") return 0;
  return (places[place]?.rate ?? 0) * (parseFloat(hours) || 0);
}

/**
 * Default empty form factory.
 */
export const Empty_form = (firstPlace) => ({
  place: firstPlace || "",
  pay_type: "hourly",
  shift_date: new Date().toISOString().slice(0, 10),
  start_time: get_current_local_time(),
  end_time: "",
  hours: "",
  tips: "",
  notes: "",
});

// Re-export Format_money so consumers can get everything from one module.
export { Format_money };
