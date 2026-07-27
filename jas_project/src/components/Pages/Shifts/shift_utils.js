import { parseTimeToMinutes } from "../../../lib/calendar_sync";
import { formatMoney } from "../../../lib/format";

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
export function getCurrentLocalTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Calculate hours between two "HH:MM" time strings, handling overnight.
 * Returns a number (decimal hours) or null when inputs are missing.
 */
export function calculateHoursFromTimes(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return null;
  const diffMinutes = end >= start ? end - start : 24 * 60 - start + end;
  return Number((diffMinutes / 60).toFixed(2));
}

/**
 * Calculate the pay for a shift given the PLACES map and shift fields.
 */
export function calcPay(places, place, hours, payType = "hourly") {
  if (payType === "tips_only") return 0;
  return (places[place]?.rate ?? 0) * (parseFloat(hours) || 0);
}

/**
 * Default empty form factory.
 */
export const emptyForm = (firstPlace) => ({
  place: firstPlace || "",
  pay_type: "hourly",
  shift_date: new Date().toISOString().slice(0, 10),
  start_time: getCurrentLocalTime(),
  end_time: "",
  hours: "",
  tips: "",
  notes: "",
});

// Re-export formatMoney so consumers can get everything from one module.
export { formatMoney };
