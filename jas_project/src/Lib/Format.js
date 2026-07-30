/**
 * format.js — Shared formatting utilities
 */

/**
 * Format a number as currency (USD).
 * @param {number} amount
 * @returns {string}
 */
export function Format_money(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

/**
 * Format a date string (YYYY-MM-DD) to a short readable format.
 * @param {string} date_str
 * @returns {string}
 */
export function Format_date(date_str) {
  const d = new Date(`${date_str}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date string to a group label (Today, Yesterday, or full date).
 * @param {string} date_str
 * @returns {string}
 */
export function Format_date_group(date_str) {
  const d = new Date(`${date_str}T12:00:00`);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date string to a short label (Mon, Jul 27).
 * @param {string} date_str
 * @returns {string}
 */
export function Format_date_label(date_str) {
  const d = new Date(`${date_str}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
