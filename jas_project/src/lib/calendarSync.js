/**
 * Calendar ↔ Shifts sync logic.
 * Shared between Calendar.jsx and Shifts.jsx to keep wake/walk/event
 * generation in one place.
 */

const WAKEUP_BEFORE_MINUTES = 120;
const WALK_AFTER_WAKE_MINUTES = 30;
export const WAKE_TITLE = "Wake up";
export const WALK_TITLE = "Go for a walk";
export const SHIFT_TITLE_PREFIX = "Shift: ";

/**
 * Parse "HH:MM" to total minutes since midnight.
 */
export function parseTimeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Convert total minutes to "HH:MM" string.
 */
export function minutesToTime(min) {
  const total = Math.max(0, Math.floor(min));
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Estimate a shift's start minutes — prefers explicit start_time,
 * falls back to deriving from end_time + hours, then 09:00.
 */
export function estimateShiftStartMinutes(shift) {
  if (shift.start_time) {
    const m = parseTimeToMinutes(shift.start_time);
    if (m != null) return m;
  }
  if (shift.end_time && shift.hours) {
    const end = parseTimeToMinutes(shift.end_time);
    if (end != null) {
      return Math.max(0, end - Math.round((parseFloat(shift.hours) || 0) * 60));
    }
  }
  return 9 * 60;
}

/**
 * Get the calendar event title for a shift record.
 */
export function getShiftEventTitle(shiftRecord, placesMap) {
  const placeLabel = placesMap[shiftRecord.place]?.label ?? shiftRecord.place;
  return `${SHIFT_TITLE_PREFIX}${placeLabel}`;
}

/**
 * Check if an event's notes indicate it's linked to a shift.
 */
export function isShiftLinkNote(value) {
  return typeof value === "string" && value.startsWith("Linked shift id:");
}

/**
 * Extract visible notes (strips shift link metadata).
 */
export function getVisibleEventNotes(value) {
  if (isShiftLinkNote(value)) return "";
  return value ?? "";
}

/**
 * Extract the linked shift ID from event notes.
 */
export function getLinkedShiftId(notes) {
  if (typeof notes !== "string") return null;
  const m = notes.match(/Linked shift id:\s*([a-zA-Z0-9-]+)/);
  return m ? m[1] : null;
}

/**
 * Remove generated calendar events (wake, walk, shift-linked) for a date.
 */
export async function removeGeneratedCalendarEvents(supabase, dateKey, userId, linkedShiftId = null) {
  const { data: eventsOnDate = [] } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .eq("event_date", dateKey);

  const idsToDelete = (eventsOnDate || [])
    .filter((event) => {
      const isWakeOrWalk = event.title === WAKE_TITLE || event.title === WALK_TITLE;
      const isLinked = linkedShiftId == null
        ? isShiftLinkNote(event.notes)
        : typeof event.notes === "string" && event.notes.includes(`Linked shift id: ${linkedShiftId}`);
      return isWakeOrWalk || isLinked;
    })
    .map((event) => event.id);

  if (idsToDelete.length > 0) {
    await supabase.from("events").delete().in("id", idsToDelete);
  }
}

/**
 * Recompute Wake up / Go for a walk events for a given date based on
 * the earliest shift that day. Safe to call even if there are no shifts.
 */
export async function recalcWakeWalkForDate(supabase, dateKey, userId) {
  const { data: shiftsOnDate = [] } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", userId)
    .eq("shift_date", dateKey);

  const { data: eventsOnDate = [] } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .eq("event_date", dateKey);

  const generatedIds = (eventsOnDate || [])
    .filter((e) => e.title === WAKE_TITLE || e.title === WALK_TITLE)
    .map((e) => e.id);

  if (!shiftsOnDate.length) {
    if (generatedIds.length > 0) {
      await supabase.from("events").delete().in("id", generatedIds);
    }
    return;
  }

  const starts = shiftsOnDate.map(estimateShiftStartMinutes);
  const earliest = Math.min(...starts);
  const desiredWake = Math.max(0, earliest - WAKEUP_BEFORE_MINUTES);
  const desiredWalk = desiredWake + WALK_AFTER_WAKE_MINUTES;

  if (generatedIds.length > 0) {
    await supabase.from("events").delete().in("id", generatedIds);
  }

  await supabase.from("events").insert({
    title: WAKE_TITLE,
    notes: null,
    event_date: dateKey,
    start_time: minutesToTime(desiredWake),
    end_time: minutesToTime(desiredWake + 15),
    color: "pink",
    user_id: userId,
  });

  await supabase.from("events").insert({
    title: WALK_TITLE,
    notes: null,
    event_date: dateKey,
    start_time: minutesToTime(desiredWalk),
    end_time: minutesToTime(desiredWalk + 30),
    color: "green",
    user_id: userId,
  });
}

/**
 * Full sync of a shift record to the calendar.
 * Creates/updates the shift event and recalculates wake/walk events.
 */
export async function syncShiftToCalendar(supabase, shiftRecord, userId, placesMap) {
  if (!shiftRecord || !userId) return;

  const dateKey = shiftRecord.shift_date;

  const { data: shiftsOnDate = [] } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", userId)
    .eq("shift_date", dateKey);

  const { data: eventsOnDate = [] } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .eq("event_date", dateKey);

  // If no shifts left on this date, clean up everything
  if (!shiftsOnDate.length) {
    const idsToDelete = (eventsOnDate || [])
      .filter((event) =>
        event.title === WAKE_TITLE ||
        event.title === WALK_TITLE ||
        isShiftLinkNote(event.notes)
      )
      .map((event) => event.id);
    if (idsToDelete.length > 0) {
      await supabase.from("events").delete().in("id", idsToDelete);
    }
    return;
  }

  // Recompute wake/walk
  const starts = shiftsOnDate.map(estimateShiftStartMinutes);
  const earliest = Math.min(...starts);
  const desiredWake = Math.max(0, earliest - WAKEUP_BEFORE_MINUTES);
  const desiredWalk = desiredWake + WALK_AFTER_WAKE_MINUTES;

  const generatedIds = (eventsOnDate || [])
    .filter((e) => e.title === WAKE_TITLE || e.title === WALK_TITLE)
    .map((e) => e.id);

  if (generatedIds.length > 0) {
    await supabase.from("events").delete().in("id", generatedIds);
  }

  await supabase.from("events").insert({
    title: WAKE_TITLE, notes: null, event_date: dateKey,
    start_time: minutesToTime(desiredWake), end_time: minutesToTime(desiredWake + 15),
    color: "pink", user_id: userId,
  });

  await supabase.from("events").insert({
    title: WALK_TITLE, notes: null, event_date: dateKey,
    start_time: minutesToTime(desiredWalk), end_time: minutesToTime(desiredWalk + 30),
    color: "green", user_id: userId,
  });

  // Sync the shift event itself
  const shiftTitle = getShiftEventTitle(shiftRecord, placesMap);
  const shiftStart = shiftRecord.start_time || minutesToTime(estimateShiftStartMinutes(shiftRecord));
  const shiftEnd = shiftRecord.end_time || minutesToTime(
    estimateShiftStartMinutes(shiftRecord) + Math.round((parseFloat(shiftRecord.hours) || 0) * 60)
  );

  const existingShiftEvent = (eventsOnDate || []).find((event) =>
    typeof event.notes === "string" && event.notes.includes(`Linked shift id: ${shiftRecord.id}`)
  );

  const shiftEventPayload = {
    title: shiftTitle,
    notes: `Linked shift id: ${shiftRecord.id}`,
    event_date: dateKey,
    start_time: shiftStart,
    end_time: shiftEnd,
    color: shiftRecord.color || placesMap[shiftRecord.place]?.color || "cyan",
    user_id: userId,
  };

  if (existingShiftEvent) {
    await supabase.from("events").update(shiftEventPayload).eq("id", existingShiftEvent.id);
  } else {
    const fallback = (eventsOnDate || []).find((event) =>
      event.title === shiftTitle &&
      (typeof event.notes !== "string" || !event.notes.includes("Linked shift id:"))
    );
    if (fallback) {
      await supabase.from("events").update(shiftEventPayload).eq("id", fallback.id);
    } else {
      await supabase.from("events").insert(shiftEventPayload);
    }
  }
}
