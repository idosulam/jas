const SAFE_TEXT_MAX_LENGTH = 160;

export function sanitizeText(value, maxLength = SAFE_TEXT_MAX_LENGTH) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/<[^>]*>/g, "").trim();
  return normalized.slice(0, maxLength);
}

export function sanitizeNumber(
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

export function sanitizeDate(value, fallback = "") {
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

export function sanitizeTime(value, fallback = "09:00") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return fallback;
  const [hours, minutes] = trimmed.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return trimmed;
}

export function getUserFacingError(error) {
  if (typeof error !== "string")
    return "We couldn't save your changes right now. Please try again.";
  const trimmed = error.trim();
  if (!trimmed)
    return "We couldn't save your changes right now. Please try again.";
  if (
    /relation does not exist|permission denied|jwt|network|timeout|database/i.test(
      trimmed,
    )
  ) {
    return "We couldn't save your changes right now. Please try again.";
  }
  return trimmed;
}
