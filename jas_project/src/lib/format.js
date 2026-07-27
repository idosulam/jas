/**
 * format.js — Shared formatting utilities
 */

/**
 * Format a number as currency (USD).
 * @param {number} amount
 * @returns {string}
 */
export function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
}

/**
 * Format a date string (YYYY-MM-DD) to a short readable format.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date string to a group label (Today, Yesterday, or full date).
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateGroup(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
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
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
