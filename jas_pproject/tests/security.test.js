import test from "node:test";
import assert from "node:assert/strict";

import {
  getUserFacingError,
  sanitizeDate,
  sanitizeNumber,
  sanitizeText,
  sanitizeTime,
} from "../src/lib/security.js";

test("sanitizes text input and removes unsafe characters", () => {
  assert.equal(
    sanitizeText("  Hello<script>alert(1)</script>  ", 24),
    "Helloalert(1)",
  );
});

test("validates date strings and falls back safely", () => {
  assert.equal(sanitizeDate("2026-07-04"), "2026-07-04");
  assert.equal(sanitizeDate("not-a-date", "2026-07-04"), "2026-07-04");
});

test("validates time strings", () => {
  assert.equal(sanitizeTime("09:30"), "09:30");
  assert.equal(sanitizeTime("25:00", "09:00"), "09:00");
});

test("validates numeric values", () => {
  assert.equal(sanitizeNumber("12.5", 0, 100), 12.5);
  assert.equal(sanitizeNumber("999", 0, 100), null);
});

test("converts unexpected errors to user-safe messages", () => {
  assert.equal(
    getUserFacingError("database error: relation does not exist"),
    "We couldn't save your changes right now. Please try again.",
  );
  assert.equal(
    getUserFacingError("Please fill in title, date, and times."),
    "Please fill in title, date, and times.",
  );
});
