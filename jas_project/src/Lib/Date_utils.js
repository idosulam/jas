/**
 * Date_utils.js — Shared date utility functions
 * Used by: Calendar, Shifts, Calendar_nav
 */

export function To_date_key(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function Add_days(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function Start_of_week(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
