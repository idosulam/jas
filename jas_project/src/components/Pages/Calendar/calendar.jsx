import "./calendar.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { get_supabase_client } from "../../../lib/superbase";
import { use_user_id } from "../../../lib/auth_context.jsx";
import {
  add_days,
  DAY_END_HOUR,
  DAY_START_HOUR,
  EVENT_COLORS,
  event_style,
  resolve_color,
  format_time_12,
  HOUR_HEIGHT,
  layout_overlapping_events,
  start_of_week,
  to_date_key,
  TOTAL_HOURS,
} from "./calendar_layout";
import {
  get_user_facing_error,
  sanitize_date,
  sanitize_text,
  sanitize_time,
  haptic_error,
} from "../../../lib/security";
import {
  parse_time_to_minutes,
  is_shift_link_note,
  get_visible_event_notes,
  recalc_wake_walk_for_date,
} from "../../../lib/calendar_sync";
import {
  use_body_scroll_lock,
  use_modal,
  use_floating_actions,
} from "../../../Hooks";
import {
  ConfirmModal,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  GlassCard,
  FAB,
} from "../../../components";
import { use_glass_toast } from "../../../lib/glass_toast_provider.jsx";
import { fetch_palette } from "../../../lib/color_palette.js";
import { use_household } from "../../../lib/household_context.jsx";
import EventForm from "./event_form.jsx";
import CalendarGrid from "./calendar_grid.jsx";
import TimelineView from "./timeline_view.jsx";
import ReminderList from "./reminder_list.jsx";

const MODAL_EXIT_MS = 260;

const empty_form = (date_key) => ({
  title: "",
  notes: "",
  event_date: date_key,
  start_time: "09:00",
  end_time: "10:00",
  color: "",
});

function Calendar() {
  const { household_name } = use_household();
  const user_id = use_user_id();
  const today = useMemo(() => new Date(), []);
  const [selected_date, set_selected_date] = useState(today);
  const [view_mode, set_view_mode] = useState("week");
  const [events, set_events] = useState([]);
  const [all_events, set_all_events] = useState([]);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState(null);
  const [delete_target, set_delete_target] = useState(null);
  const [editing_event, set_editing_event] = useState(null);
  const [form, set_form] = useState(() => empty_form(to_date_key(today)));
  const [saving, set_saving] = useState(false);
  const [deleting, set_deleting] = useState(false);
  const [toggling_id, set_toggling_id] = useState(null);
  const [removing_id, set_removing_id] = useState(null);
  const [now_tick, set_now_tick] = useState(() => Date.now());
  const [field_errors, set_field_errors] = useState({});
  const [field_states, set_field_states] = useState({});
  const [shake_key, set_shake_key] = useState(0);
  const [palette, set_palette] = useState([]);

  const form_modal = use_modal(MODAL_EXIT_MS);
  const delete_modal = use_modal(MODAL_EXIT_MS);
  const { ref: add_btn_ref, visible: show_floating_actions } = use_floating_actions();
  const { success: toast_success, error: toast_error } = use_glass_toast();

  const selected_key = to_date_key(selected_date);
  const is_today = selected_key === to_date_key(today);

  // Load color palette from DB
  useEffect(() => {
    fetch_palette().then(set_palette);
  }, []);

  const week_days = useMemo(() => {
    const start = start_of_week(selected_date);
    return Array.from({ length: 7 }, (_, i) => add_days(start, i));
  }, [selected_date]);

  const month_days = useMemo(() => {
    const start = start_of_week(
      new Date(selected_date.getFullYear(), selected_date.getMonth(), 1),
    );
    return Array.from({ length: 42 }, (_, i) => add_days(start, i));
  }, [selected_date]);

  const visible_days = view_mode === "week" ? week_days : month_days;

  const hour_labels = useMemo(
    () =>
      Array.from({ length: TOTAL_HOURS }, (_, i) => {
        const hour = DAY_START_HOUR + i;
        const period = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12} ${period}`;
      }),
    [],
  );

  const laid_out_events = useMemo(
    () => layout_overlapping_events(events),
    [events],
  );

  const is_wake_event = (e) =>
    typeof e.title === "string" && e.title.toLowerCase().includes("wake");

  const is_generated_wake_event = (event) =>
    event?.title === "Wake up" || event?.title === "Go for a walk";

  const pending_count = useMemo(
    () => events.filter((event) => !event.is_completed).length,
    [events],
  );

  const busy_dates = useMemo(
    () => new Set(all_events.map((event) => event.event_date)),
    [all_events],
  );

  const now_line_top = useMemo(() => {
    if (!is_today) return null;
    const now = new Date(now_tick);
    const minutes = now.getHours() * 60 + now.getMinutes();
    const day_start = DAY_START_HOUR * 60;
    const day_end = (DAY_END_HOUR + 1) * 60;
    if (minutes < day_start || minutes > day_end) return null;
    return ((minutes - day_start) / 60) * HOUR_HEIGHT;
  }, [is_today, now_tick]);

  const fetch_events = useCallback(async () => {
    if (!user_id) return;
    set_loading(true);
    set_error(null);

    const range_start =
      view_mode === "week"
        ? start_of_week(selected_date)
        : new Date(selected_date.getFullYear(), selected_date.getMonth(), 1);
    const range_end =
      view_mode === "week"
        ? add_days(range_start, 6)
        : new Date(selected_date.getFullYear(), selected_date.getMonth() + 1, 0);

    const start_key = to_date_key(range_start);
    const end_key = to_date_key(range_end);

    try {
      const supabase = get_supabase_client();

      // Sync any shifts that don't have calendar events yet
      try {
        const { data: shiftsInRange = [] } = await supabase
          .from("shifts")
          .select("*")
          .eq("user_id", user_id)
          .gte("shift_date", start_key)
          .lte("shift_date", end_key);

        const { data: existingEvents = [] } = await supabase
          .from("events")
          .select("id, notes")
          .eq("user_id", user_id)
          .gte("event_date", start_key)
          .lte("event_date", end_key);

        const linked_shift_ids = new Set(
          (existingEvents || [])
            .map((e) => {
              const m =
                typeof e.notes === "string"
                  ? e.notes.match(/Linked shift id:\s*([a-zA-Z0-9-]+)/)
                  : null;
              return m ? m[1] : null;
            })
            .filter(Boolean),
        );

        const unsynced = (shiftsInRange || []).filter(
          (s) => !linked_shift_ids.has(s.id),
        );
        if (unsynced.length > 0) {
          for (const shift of unsynced) {
            const date_key = shift.shift_date;
            const title = `Shift: ${shift.place}`;
            const start = shift.start_time || "09:00";
            const end = shift.end_time || "17:00";
            await supabase.from("events").insert({
              title,
              notes: `Linked shift id: ${shift.id}`,
              event_date: date_key,
              start_time: start,
              end_time: end,
              color: shift.color || "cyan",
              ...(user_id && { user_id: user_id }),
            });
          }
        }
      } catch {
        // non-critical, continue fetching
      }

      const { data, error: fetch_error } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user_id)
        .gte("event_date", start_key)
        .lte("event_date", end_key)
        .order("start_time", { ascending: true });

      if (fetch_error) {
        set_error(get_user_facing_error(fetch_error.message));
        set_all_events([]);
        set_events([]);
      } else {
        const items = data ?? [];
        set_all_events(items);
        set_events(items.filter((event) => event.event_date === selected_key));
      }
    } catch (err) {
      set_error(get_user_facing_error(err.message));
      set_all_events([]);
      set_events([]);
    }
    set_loading(false);
  }, [selected_date, selected_key, view_mode, user_id]);

  useEffect(() => {
    fetch_events();
  }, [fetch_events]);

  useEffect(() => {
    const handle_calendar_refresh = (event) => {
      const refreshed_date = event?.detail?.date;
      if (refreshed_date && refreshed_date === selected_key) {
        fetch_events();
      }
    };

    window.addEventListener("calendar:refresh", handle_calendar_refresh);
    return () => {
      window.removeEventListener("calendar:refresh", handle_calendar_refresh);
    };
  }, [fetch_events, selected_key]);

  useEffect(() => {
    const timer = setInterval(() => set_now_tick(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  use_body_scroll_lock(form_modal.open, delete_target);

  const validate_calendar_field = (field_name) => {
    const errors = {};
    switch (field_name) {
      case "title": {
        if (!form.title || !form.title.trim()) {
          errors[field_name] = "Give it a name";
        }
        break;
      }
      case "event_date": {
        if (!form.event_date) {
          errors[field_name] = "Pick a date";
        }
        break;
      }
      case "start_time": {
        if (!form.start_time) {
          errors[field_name] = "Required";
        } else if (form.end_time && form.start_time >= form.end_time) {
          errors[field_name] = "Must be before end";
        }
        break;
      }
      case "end_time": {
        if (!form.end_time) {
          errors[field_name] = "Required";
        } else if (form.start_time && form.end_time <= form.start_time) {
          errors[field_name] = "Must be after start";
        }
        break;
      }
      case "color": {
        if (!form.color) {
          errors[field_name] = "Pick a color";
        }
        break;
      }
    }
    return errors;
  };

  const handle_calendar_field_blur = (field_name) => {
    const errors = validate_calendar_field(field_name);
    const fieldError = errors[field_name] || null;
    set_field_errors((prev) => ({
      ...prev,
      [field_name]: fieldError,
    }));
    set_field_states((prev) => ({
      ...prev,
      [field_name]: fieldError ? "error" : form[field_name] ? "valid" : "idle",
    }));
    if (fieldError) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };

  const is_calendar_form_valid = useMemo(() => {
    if (!form.title || !form.title.trim()) return false;
    if (!form.event_date) return false;
    if (!form.start_time || !form.end_time) return false;
    if (form.start_time >= form.end_time) return false;
    if (!form.color) return false;
    return true;
  }, [form]);

  const shift_selected_date = (direction) => {
    const delta = direction === "next" ? 1 : -1;
    if (view_mode === "month") {
      const next = new Date(selected_date);
      next.setMonth(next.getMonth() + delta);
      set_selected_date(next);
      return;
    }

    set_selected_date((date) => add_days(date, delta * 7));
  };

  const open_add_modal = (start_time = "09:00") => {
    const [h] = start_time.split(":").map(Number);
    const endHour = Math.min(h + 1, DAY_END_HOUR);
    set_editing_event(null);
    set_form({
      ...empty_form(selected_key),
      color: "",
      start_time: start_time,
      end_time: `${String(endHour).padStart(2, "0")}:00`,
    });
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  const open_edit_modal = (event) => {
    set_editing_event(event);
    set_form({
      title: event.title,
      notes: get_visible_event_notes(event.notes),
      event_date: event.event_date,
      start_time: event.start_time.slice(0, 5),
      end_time: event.end_time.slice(0, 5),
      color: event.color ?? "green",
    });
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  const close_form_modal = () => {
    form_modal.close_modal();
    setTimeout(() => {
      set_editing_event(null);
      set_form(empty_form(selected_key));
      set_field_errors({});
      set_field_states({});
    }, MODAL_EXIT_MS);
  };

  const close_delete_modal = () => {
    delete_modal.close_modal();
    setTimeout(() => {
      set_delete_target(null);
    }, MODAL_EXIT_MS);
  };

  const handle_submit = async (e) => {
    e.preventDefault();

    const title = sanitize_text(form.title, 80);
    const event_date = sanitize_date(form.event_date, selected_key);
    const start_time = sanitize_time(form.start_time, "09:00");
    const end_time = sanitize_time(form.end_time, "10:00");

    const errors = {};
    if (!title) errors.title = "Give it a name";
    if (!event_date) errors.event_date = "Pick a date";
    if (!start_time) errors.start_time = "Required";
    if (!end_time) errors.end_time = "Required";
    if (start_time && end_time && end_time <= start_time)
      errors.end_time = "Must be after start";
    if (!form.color) errors.color = "Pick a color";

    if (Object.keys(errors).length > 0) {
      set_field_errors(errors);
      const newStates = {};
      Object.keys(errors).forEach((k) => {
        newStates[k] = "error";
      });
      set_field_states((prev) => ({ ...prev, ...newStates }));
      set_shake_key((k) => k + 1);
      return;
    }

    set_saving(true);
    set_error(null);

    const nextNotes = sanitize_text(form.notes, 240) || null;
    const payload = {
      title,
      notes:
        editing_event && is_shift_link_note(editing_event.notes)
          ? editing_event.notes
          : nextNotes,
      event_date: event_date,
      start_time: start_time,
      end_time: end_time,
      ...(user_id && { user_id: user_id }),
      color:
        form.color && form.color.startsWith("#")
          ? form.color
          : EVENT_COLORS[form.color]
            ? form.color
            : "#818cf8",
    };

    try {
      const supabase = get_supabase_client();
      let dbError;
      if (editing_event) {
        ({ error: dbError } = await supabase
          .from("events")
          .update(payload)
          .eq("id", editing_event.id));
      } else {
        ({ error: dbError } = await supabase.from("events").insert(payload));
      }

      set_saving(false);

      if (dbError) {
        const message = get_user_facing_error(dbError.message);
        set_error(message);
        toast_error(
          editing_event ? "Couldn't edit event." : "Couldn't save event.",
        );
        return;
      }

      // If this event is linked to a shift, mirror the new time back onto
      // the shift record and recompute Wake up / Go for a walk for the day
      // so editing from the Calendar page stays in sync with the Shifts page.
      if (editing_event && is_shift_link_note(editing_event.notes)) {
        const linked_shift_id = editing_event.notes.match(
          /Linked shift id:\s*([a-zA-Z0-9-]+)/,
        )?.[1];

        if (linked_shift_id) {
          try {
            const startMin = parse_time_to_minutes(start_time);
            const endMin = parse_time_to_minutes(end_time);
            const hours =
              startMin != null && endMin != null
                ? Number(((endMin - startMin) / 60).toFixed(2))
                : null;

            await supabase
              .from("shifts")
              .update({
                start_time: start_time,
                end_time: end_time,
                ...(hours != null ? { hours } : {}),
              })
              .eq("id", linked_shift_id);

            await recalc_wake_walk_for_date(supabase, event_date, user_id);
            window.dispatchEvent(new CustomEvent("shifts:refresh"));
          } catch {
            toast_error(
              "Event saved, but syncing the linked shift and wake/walk times failed.",
            );
          }
        }
      }

      close_form_modal();
      toast_success(
        editing_event ? "Event edited successfully." : "Event saved.",
      );
      fetch_events();
    } catch (err) {
      set_saving(false);
      set_error(get_user_facing_error(err.message));
      toast_error(
        editing_event ? "Couldn't edit event." : "Couldn't save event.",
      );
    }
  };

  const confirm_delete = async () => {
    if (!delete_target) return;

    set_deleting(true);
    set_error(null);

    try {
      const supabase = get_supabase_client();
      const event_date = delete_target.event_date;
      const linked_shift_id =
        typeof delete_target.notes === "string"
          ? delete_target.notes.match(/Linked shift id:\s*([a-zA-Z0-9-]+)/)?.[1]
          : null;

      const { error: dbError } = await supabase
        .from("events")
        .delete()
        .eq("id", delete_target.id);

      set_deleting(false);

      if (dbError) {
        set_error(get_user_facing_error(dbError.message));
        toast_error("Failed to delete event.");
        return;
      }

      if (linked_shift_id) {
        const { error: shiftDeleteError } = await supabase
          .from("shifts")
          .delete()
          .eq("id", linked_shift_id);

        if (shiftDeleteError) {
          toast_error(
            "Deleted calendar event, but the linked shift could not be removed.",
          );
        } else {
          window.dispatchEvent(new CustomEvent("shifts:refresh"));
        }
      }

      const removedId = delete_target.id;
      close_delete_modal();
      toast_success("Event deleted.");
      set_removing_id(removedId);

      setTimeout(async () => {
        const { data: remainingEvents = [] } = await supabase
          .from("events")
          .select("*")
          .eq("event_date", event_date);

        let generatedIds = [];
        const shouldRemoveGenerated = remainingEvents.every(
          (event) => is_generated_wake_event(event) || event.id === removedId,
        );

        if (shouldRemoveGenerated) {
          generatedIds = (remainingEvents || [])
            .filter((event) => is_generated_wake_event(event))
            .map((event) => event.id);

          if (generatedIds.length > 0) {
            await supabase.from("events").delete().in("id", generatedIds);
          }
        }

        const idsToRemove = [removedId, ...generatedIds];
        set_events((prev) =>
          prev.filter((item) => !idsToRemove.includes(item.id)),
        );
        set_all_events((prev) =>
          prev.filter((item) => !idsToRemove.includes(item.id)),
        );
        set_removing_id(null);
        window.dispatchEvent(
          new CustomEvent("calendar:refresh", { detail: { date: event_date } }),
        );
      }, 380);
    } catch (err) {
      set_deleting(false);
      set_error(get_user_facing_error(err.message));
      toast_error("Failed to delete event.");
    }
  };

  const toggle_complete = async (event) => {
    set_toggling_id(event.id);
    set_error(null);

    const nextCompleted = !event.is_completed;

    try {
      const supabase = get_supabase_client();
      const { error: dbError } = await supabase
        .from("events")
        .update({
          is_completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
        })
        .eq("id", event.id);

      set_toggling_id(null);

      if (dbError) {
        set_error(get_user_facing_error(dbError.message));
        return;
      }

      set_events((prev) =>
        prev.map((item) =>
          item.id === event.id
            ? {
                ...item,
                is_completed: nextCompleted,
                completed_at: nextCompleted ? new Date().toISOString() : null,
              }
            : item,
        ),
      );
    } catch (err) {
      set_toggling_id(null);
      set_error(get_user_facing_error(err.message));
    }
  };

  const handle_grid_click = (e) => {
    const grid = e.currentTarget;
    const rect = grid.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = (y / HOUR_HEIGHT) * 60;
    // Snap to nearest 30 minutes
    const snappedMinutes = Math.round(totalMinutes / 30) * 30;
    const hour = Math.min(
      DAY_START_HOUR + Math.floor(snappedMinutes / 60),
      DAY_END_HOUR,
    );
    const minute = snappedMinutes % 60;
    open_add_modal(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
  };

  const day_title = selected_date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="calendar page">
      <PageHeader
        className="calendar__header animate-in"
        eyebrow={household_name ? `Calendar · ${household_name}` : "Daily planner"}
        title="Calendar"
      />

      <div className="calendar__nav animate-in animate-in--1">
        <button
          type="button"
          className="calendar__nav-btn"
          onClick={() => shift_selected_date("prev")}
          aria-label={view_mode === "month" ? "Previous month" : "Previous week"}
        >
          ‹
        </button>
        <div className="calendar__nav-center">
          <p className="calendar__date-label">
            {view_mode === "month"
              ? selected_date.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })
              : day_title}
          </p>
          {!is_today && (
            <button
              type="button"
              className="calendar__today-btn"
              onClick={() => set_selected_date(new Date())}
            >
              Today
            </button>
          )}
        </div>
        <button
          type="button"
          className="calendar__nav-btn"
          onClick={() => shift_selected_date("next")}
          aria-label={view_mode === "month" ? "Next month" : "Next week"}
        >
          ›
        </button>
      </div>

      <div
        className="calendar__view-toggle animate-in animate-in--2"
        role="tablist"
        aria-label="Calendar view"
      >
        <button
          type="button"
          className={`calendar__view-btn${view_mode === "week" ? " calendar__view-btn--active" : ""}`}
          onClick={() => set_view_mode("week")}
          aria-pressed={view_mode === "week"}
        >
          1 week
        </button>
        <button
          type="button"
          className={`calendar__view-btn${view_mode === "month" ? " calendar__view-btn--active" : ""}`}
          onClick={() => set_view_mode("month")}
          aria-pressed={view_mode === "month"}
        >
          1 month
        </button>
      </div>

      <CalendarGrid
        visible_days={visible_days}
        selected_date={selected_date}
        today={today}
        view_mode={view_mode}
        busy_dates={busy_dates}
        onDaySelect={set_selected_date}
      />

      <div className="calendar__summary animate-in animate-in--3">
        <GlassCard
          className="calendar__stat"
          value={events.length}
          label="Events"
        />
        <GlassCard
          className="calendar__stat"
          value={pending_count}
          label="Pending"
        />
      </div>

      {error && (
        <p className="calendar__error calendar__error--glass" role="alert">
          {error}
        </p>
      )}

      <div className="calendar__toolbar animate-in animate-in--4">
        <h2 className="calendar__section-title">Day overview</h2>
        <button
          type="button"
          className="calendar__add-btn"
          onClick={() => open_add_modal()}
          ref={add_btn_ref}
        >
          + Add event
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton count={3} height="4rem" />
      ) : (
        <div className="calendar__day animate-in animate-in--4">
          <TimelineView
            hour_labels={hour_labels}
            laid_out_events={laid_out_events}
            now_line_top={now_line_top}
            onGridClick={handle_grid_click}
            onEventClick={open_edit_modal}
            onCheck={toggle_complete}
            onDelete={(event) => {
              set_delete_target(event);
              delete_modal.open_modal();
            }}
            toggling_id={toggling_id}
            removing_id={removing_id}
            is_wake_event={is_wake_event}
          />
        </div>
      )}

      {events.length === 0 && !loading && (
        <div style={{ marginTop: "1rem" }}>
          <EmptyState
            text="No events today. Tap the timeline or + Add event."
            className="animate-in"
          />
        </div>
      )}

      <ReminderList
        events={events}
        is_wake_event={is_wake_event}
        onCheck={toggle_complete}
        onEdit={open_edit_modal}
        onDelete={(event) => {
          set_delete_target(event);
          delete_modal.open_modal();
        }}
        toggling_id={toggling_id}
        removing_id={removing_id}
      />

      <EventForm
        open={form_modal.open}
        closing={form_modal.closing}
        onClose={close_form_modal}
        editing_event={editing_event}
        form={form}
        on_form_change={set_form}
        saving={saving}
        field_errors={field_errors}
        field_states={field_states}
        shake_key={shake_key}
        onFieldBlur={handle_calendar_field_blur}
        onSubmit={handle_submit}
        onClearFieldError={(field) =>
          set_field_errors((prev) => ({ ...prev, [field]: null }))
        }
        onSetFieldState={(field, state) =>
          set_field_states((prev) => ({ ...prev, [field]: state }))
        }
        isValid={is_calendar_form_valid}
      />

      <ConfirmModal
        open={!!delete_target && delete_modal.open}
        closing={delete_modal.closing}
        onClose={close_delete_modal}
        onConfirm={confirm_delete}
        loading={deleting}
        title="Delete this event?"
        preview={
          delete_target && (
            <strong>
              {delete_target.title} on {delete_target.event_date} (
              {format_time_12(delete_target.start_time)} –{" "}
              {format_time_12(delete_target.end_time)})
            </strong>
          )
        }
        confirm_label="Delete event"
      />

      <FAB
        visible={show_floating_actions}
        on_scroll_top={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        on_add={() => open_add_modal()}
        add_label="Add event"
      />
    </section>
  );
}

export default Calendar;
