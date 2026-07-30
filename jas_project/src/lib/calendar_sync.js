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
export function parse_time_to_minutes(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Convert total minutes to "HH:MM" string.
 */
export function minutes_to_time(min) {
  const total = Math.max(0, Math.floor(min));
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Estimate a shift's start minutes — prefers explicit start_time,
 * falls back to deriving from end_time + hours, then 09:00.
 */
export function estimate_shift_start_minutes(shift) {
  if (shift.start_time) {
    const m = parse_time_to_minutes(shift.start_time);
    if (m != null) return m;
  }
  if (shift.end_time && shift.hours) {
    const end = parse_time_to_minutes(shift.end_time);
    if (end != null) {
      return Math.max(0, end - Math.round((parseFloat(shift.hours) || 0) * 60));
    }
  }
  return 9 * 60;
}

/**
 * Get the calendar event title for a shift record.
 */
export function get_shift_event_title(shift_record, places_map) {
  const place_label = places_map[shift_record.place]?.label ?? shift_record.place;
  return `${SHIFT_TITLE_PREFIX}${place_label}`;
}

/**
 * Check if an event's notes indicate it's linked to a shift.
 */
export function is_shift_link_note(value) {
  return typeof value === "string" && value.startsWith("Linked shift id:");
}

/**
 * Extract visible notes (strips shift link metadata).
 */
export function get_visible_event_notes(value) {
  if (is_shift_link_note(value)) return "";
  return value ?? "";
}

/**
 * Remove generated calendar events (wake, walk, shift-linked) for a date.
 */
export async function remove_generated_calendar_events(
  supabase,
  date_key,
  user_id,
  linked_shift_id = null,
) {
  const { data: events_on_date = [] } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user_id)
    .eq("event_date", date_key);

  const ids_to_delete = (events_on_date || [])
    .filter((event) => {
      const is_wake_or_walk =
        event.title === WAKE_TITLE || event.title === WALK_TITLE;
      const is_linked =
        linked_shift_id == null
          ? is_shift_link_note(event.notes)
          : typeof event.notes === "string" &&
            event.notes.includes(`Linked shift id: ${linked_shift_id}`);
      return is_wake_or_walk || is_linked;
    })
    .map((event) => event.id);

  if (ids_to_delete.length > 0) {
    await supabase.from("events").delete().in("id", ids_to_delete);
  }
}

/**
 * Recompute Wake up / Go for a walk events for a given date based on
 * the earliest shift that day. Safe to call even if there are no shifts.
 */
export async function recalc_wake_walk_for_date(supabase, date_key, user_id) {
  const { data: shifts_on_date = [] } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", user_id)
    .eq("shift_date", date_key);

  const { data: events_on_date = [] } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user_id)
    .eq("event_date", date_key);

  const generated_ids = (events_on_date || [])
    .filter((e) => e.title === WAKE_TITLE || e.title === WALK_TITLE)
    .map((e) => e.id);

  if (!shifts_on_date.length) {
    if (generated_ids.length > 0) {
      await supabase.from("events").delete().in("id", generated_ids);
    }
    return;
  }

  const starts = shifts_on_date.map(estimate_shift_start_minutes);
  const earliest = Math.min(...starts);
  const desired_wake = Math.max(0, earliest - WAKEUP_BEFORE_MINUTES);
  const desired_walk = desired_wake + WALK_AFTER_WAKE_MINUTES;

  if (generated_ids.length > 0) {
    await supabase.from("events").delete().in("id", generated_ids);
  }

  await supabase.from("events").insert({
    title: WAKE_TITLE,
    notes: null,
    event_date: date_key,
    start_time: minutes_to_time(desired_wake),
    end_time: minutes_to_time(desired_wake + 15),
    color: "pink",
    user_id,
  });

  await supabase.from("events").insert({
    title: WALK_TITLE,
    notes: null,
    event_date: date_key,
    start_time: minutes_to_time(desired_walk),
    end_time: minutes_to_time(desired_walk + 30),
    color: "green",
    user_id,
  });
}

/**
 * Full sync of a shift record to the calendar.
 * Creates/updates the shift event and recalculates wake/walk events.
 */
export async function sync_shift_to_calendar(
  supabase,
  shift_record,
  user_id,
  places_map,
) {
  if (!shift_record || !user_id) return;

  const date_key = shift_record.shift_date;

  const { data: shifts_on_date = [] } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", user_id)
    .eq("shift_date", date_key);

  const { data: events_on_date = [] } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user_id)
    .eq("event_date", date_key);

  // If no shifts left on this date, clean up everything
  if (!shifts_on_date.length) {
    const ids_to_delete = (events_on_date || [])
      .filter(
        (event) =>
          event.title === WAKE_TITLE ||
          event.title === WALK_TITLE ||
          is_shift_link_note(event.notes),
      )
      .map((event) => event.id);
    if (ids_to_delete.length > 0) {
      await supabase.from("events").delete().in("id", ids_to_delete);
    }
    return;
  }

  // Recompute wake/walk
  const starts = shifts_on_date.map(estimate_shift_start_minutes);
  const earliest = Math.min(...starts);
  const desired_wake = Math.max(0, earliest - WAKEUP_BEFORE_MINUTES);
  const desired_walk = desired_wake + WALK_AFTER_WAKE_MINUTES;

  const generated_ids = (events_on_date || [])
    .filter((e) => e.title === WAKE_TITLE || e.title === WALK_TITLE)
    .map((e) => e.id);

  if (generated_ids.length > 0) {
    await supabase.from("events").delete().in("id", generated_ids);
  }

  await supabase.from("events").insert({
    title: WAKE_TITLE,
    notes: null,
    event_date: date_key,
    start_time: minutes_to_time(desired_wake),
    end_time: minutes_to_time(desired_wake + 15),
    color: "pink",
    user_id,
  });

  await supabase.from("events").insert({
    title: WALK_TITLE,
    notes: null,
    event_date: date_key,
    start_time: minutes_to_time(desired_walk),
    end_time: minutes_to_time(desired_walk + 30),
    color: "green",
    user_id,
  });

  // Sync the shift event itself
  const shift_title = get_shift_event_title(shift_record, places_map);
  const shift_start =
    shift_record.start_time ||
    minutes_to_time(estimate_shift_start_minutes(shift_record));
  const shift_end =
    shift_record.end_time ||
    minutes_to_time(
      estimate_shift_start_minutes(shift_record) +
        Math.round((parseFloat(shift_record.hours) || 0) * 60),
    );

  const existing_shift_event = (events_on_date || []).find(
    (event) =>
      typeof event.notes === "string" &&
      event.notes.includes(`Linked shift id: ${shift_record.id}`),
  );

  const shift_event_payload = {
    title: shift_title,
    notes: `Linked shift id: ${shift_record.id}`,
    event_date: date_key,
    start_time: shift_start,
    end_time: shift_end,
    color: shift_record.color || places_map[shift_record.place]?.color || "cyan",
    user_id,
  };

  if (existing_shift_event) {
    await supabase
      .from("events")
      .update(shift_event_payload)
      .eq("id", existing_shift_event.id);
  } else {
    const fallback = (events_on_date || []).find(
      (event) =>
        event.title === shift_title &&
        (typeof event.notes !== "string" ||
          !event.notes.includes("Linked shift id:")),
    );
    if (fallback) {
      await supabase
        .from("events")
        .update(shift_event_payload)
        .eq("id", fallback.id);
    } else {
      await supabase.from("events").insert(shift_event_payload);
    }
  }
}
