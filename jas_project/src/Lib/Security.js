const SAFE_TEXT_MAX_LENGTH = 160;

export function sanitize_text(value, max_length = SAFE_TEXT_MAX_LENGTH) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/<[^>]*>/g, "").trim();
  return normalized.slice(0, max_length);
}

export function sanitize_number(
  value,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < min || value > max ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    return parsed < min || parsed > max ? null : parsed;
  }

  return null;
}

export function sanitize_date(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return fallback;
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return fallback;
  }
  return trimmed;
}

export function sanitize_time(value, fallback = "09:00") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return fallback;
  const [hours, minutes] = trimmed.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return trimmed;
}

/**
 * Maps Supabase/JS errors to specific, actionable user-facing messages.
 * Each pattern match returns a distinct message so the user knows what happened.
 */
export function get_user_facing_error(error) {
  if (typeof error !== "string" || !error.trim()) {
    return "Something went wrong. Please try again.";
  }

  const msg = error.trim();

  // Auth / session errors
  if (/JWT expired|token.*expired|session.*expired/i.test(msg)) {
    return "Your session expired. Please log in again.";
  }
  if (/invalid.*token|JWT.*invalid|not authenticated/i.test(msg)) {
    return "You're not signed in. Please refresh the page.";
  }

  // Permission errors
  if (
    /permission denied|insufficient.*privilege|RLS|row-level security/i.test(
      msg,
    )
  ) {
    return "You don't have permission to do that.";
  }

  // Network errors
  if (
    /Failed to fetch|NetworkError|ERR_NETWORK|ECONNREFUSED|offline/i.test(msg)
  ) {
    return "Check your connection and try again.";
  }

  // Timeout errors
  if (/timeout|timed? ?out|took too long/i.test(msg)) {
    return "The server took too long. Please try again.";
  }

  // Database / relation errors
  if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
    return "There's a problem with the server setup. Please contact support.";
  }

  // Duplicate / conflict errors
  if (/duplicate key|unique.*violation|already exists|conflict/i.test(msg)) {
    return "This entry already exists. Try editing it instead.";
  }

  // Rate limiting
  if (/rate.*limit|too many requests|429/i.test(msg)) {
    return "Slow down a bit — try again in a few seconds.";
  }

  // Validation errors from Supabase
  if (/invalid input|check constraint|not null violation/i.test(msg)) {
    return "Some of the information you entered isn't valid. Please check and try again.";
  }

  // Storage / file errors
  if (/file.*too large|payload.*too large|413/i.test(msg)) {
    return "The file is too large. Try a smaller one.";
  }

  // Fallback — return the original message if it's already user-friendly
  return msg;
}

/**
 * Format a date string (YYYY-MM-DD) into a human-readable format.
 * @param {string} date_str - ISO date string like "2026-01-15"
 * @param {object} opts - Intl.DateTimeFormat options
 * @returns {string} Formatted date like "Mon, Jan 15"
 */
export function format_date_friendly(date_str, opts = {}) {
  if (!date_str || typeof date_str !== "string") return "";
  const d = new Date(`${date_str}T12:00:00`);
  if (isNaN(d.getTime())) return date_str;

  const defaults = {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...opts,
  };

  return d.toLocaleDateString(undefined, defaults);
}

/**
 * Haptic feedback — vibrate the device briefly.
 * Safe no-op on desktop / unsupported browsers.
 */
export function haptic_error() {
  try {
    navigator.vibrate?.(30);
  } catch {
    // ignore
  }
}
