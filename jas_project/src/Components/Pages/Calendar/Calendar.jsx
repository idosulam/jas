import "./Calendar.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase";
import { Use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  Add_days,
  DAY_END_HOUR,
  DAY_START_HOUR,
  EVENT_COLORS,
  Event_style,
  Resolve_color,
  Format_time_12,
  HOUR_HEIGHT,
  Layout_overlapping_events,
  Start_of_week,
  To_date_key,
  TOTAL_HOURS,
} from "./Calendar_layout";
import {
  Get_user_facing_error,
  Sanitize_date,
  Sanitize_text,
  Sanitize_time,
  Haptic_error,
} from "../../../Lib/Security";
import {
  Parse_time_to_minutes,
  Is_shift_link_note,
  Get_visible_event_notes,
  Recalc_wake_walk_for_date,
} from "../../../Lib/Calendar_sync";
import {
  Use_body_scroll_lock,
  Use_modal,
  Use_floating_actions,
} from "../../../Hooks";
import {
  Confirm_modal,
  Empty_state,
  Loading_skeleton,
  Page_header,
  Glass_card,
  FAB,
} from "../../../Components";
import { Use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import { Fetch_palette } from "../../../Lib/Color_palette.js";
import { Use_household } from "../../../Lib/Household_context.jsx";
import Event_form from "./Event_form.jsx";
import Calendar_grid from "./Calendar_grid.jsx";
import Timeline_view from "./Timeline_view.jsx";
import Reminder_list from "./Reminder_list.jsx";

const MODAL_EXIT_MS = 260;

const Empty_form = (date_key) => ({
  title: "",
  notes: "",
  event_date: date_key,
  start_time: "09:00",
  end_time: "10:00",
  color: "",
});

function Calendar() {
  const { Household_name } = Use_household();
  const user_id = Use_user_id();
  const today = useMemo(() => new Date(), []);
  const [Selected_date, Set_selected_date] = useState(today);
  const [View_mode, Set_view_mode] = useState("week");
  const [events, Set_events] = useState([]);
  const [all_events, Set_all_events] = useState([]);
  const [Loading, Set_loading] = useState(true);
  const [error, Set_error] = useState(null);
  const [Delete_target, Set_delete_target] = useState(null);
  const [Editing_event, Set_editing_event] = useState(null);
  const [form, Set_form] = useState(() => Empty_form(To_date_key(today)));
  const [Saving, Set_saving] = useState(false);
  const [Deleting, Set_deleting] = useState(false);
  const [Toggling_id, Set_toggling_id] = useState(null);
  const [Removing_id, Set_removing_id] = useState(null);
  const [Now_tick, Set_now_tick] = useState(() => Date.now());
  const [Field_errors, Set_field_errors] = useState({});
  const [Field_states, Set_field_states] = useState({});
  const [Shake_key, Set_shake_key] = useState(0);
  const [palette, Set_palette] = useState([]);

  const Form_modal = Use_modal(MODAL_EXIT_MS);
  const Delete_modal = Use_modal(MODAL_EXIT_MS);
  const { ref: Add_btn_ref, visible: Show_floating_actions } = Use_floating_actions();
  const { success: Toast_success, error: Toast_error } = Use_glass_toast();

  const Selected_key = To_date_key(Selected_date);
  const Is_today = Selected_key === To_date_key(today);

  // Load color palette from DB
  useEffect(() => {
    Fetch_palette().then(Set_palette);
  }, []);

  const Week_days = useMemo(() => {
    const start = Start_of_week(Selected_date);
    return Array.from({ length: 7 }, (_, i) => Add_days(start, i));
  }, [Selected_date]);

  const Month_days = useMemo(() => {
    const start = Start_of_week(
      new Date(Selected_date.getFullYear(), Selected_date.getMonth(), 1),
    );
    return Array.from({ length: 42 }, (_, i) => Add_days(start, i));
  }, [Selected_date]);

  const Visible_days = View_mode === "week" ? Week_days : Month_days;

  const Hour_labels = useMemo(
    () =>
      Array.from({ length: TOTAL_HOURS }, (_, i) => {
        const hour = DAY_START_HOUR + i;
        const period = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12} ${period}`;
      }),
    [],
  );

  const Laid_out_events = useMemo(
    () => Layout_overlapping_events(events),
    [events],
  );

  const Is_wake_event = (e) =>
    typeof e.title === "string" && e.title.toLowerCase().includes("wake");

  const Is_generated_wake_event = (event) =>
    event?.title === "Wake up" || event?.title === "Go for a walk";

  const pending_count = useMemo(
    () => events.filter((event) => !event.is_completed).length,
    [events],
  );

  const busy_dates = useMemo(
    () => new Set(all_events.map((event) => event.event_date)),
    [all_events],
  );

  const Now_line_top = useMemo(() => {
    if (!Is_today) return null;
    const now = new Date(Now_tick);
    const minutes = now.getHours() * 60 + now.getMinutes();
    const day_start = DAY_START_HOUR * 60;
    const day_end = (DAY_END_HOUR + 1) * 60;
    if (minutes < day_start || minutes > day_end) return null;
    return ((minutes - day_start) / 60) * HOUR_HEIGHT;
  }, [Is_today, Now_tick]);

  const Fetch_events = useCallback(async () => {
    if (!user_id) return;
    Set_loading(true);
    Set_error(null);

    const range_start =
      View_mode === "week"
        ? Start_of_week(Selected_date)
        : new Date(Selected_date.getFullYear(), Selected_date.getMonth(), 1);
    const range_end =
      View_mode === "week"
        ? Add_days(range_start, 6)
        : new Date(Selected_date.getFullYear(), Selected_date.getMonth() + 1, 0);

    const start_key = To_date_key(range_start);
    const end_key = To_date_key(range_end);

    try {
      const supabase = Get_supabase_client();

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
        Set_error(Get_user_facing_error(fetch_error.message));
        Set_all_events([]);
        Set_events([]);
      } else {
        const items = data ?? [];
        Set_all_events(items);
        Set_events(items.filter((event) => event.event_date === Selected_key));
      }
    } catch (err) {
      Set_error(Get_user_facing_error(err.message));
      Set_all_events([]);
      Set_events([]);
    }
    Set_loading(false);
  }, [Selected_date, Selected_key, View_mode, user_id]);

  useEffect(() => {
    Fetch_events();
  }, [Fetch_events]);

  useEffect(() => {
    const Handle_calendar_refresh = (event) => {
      const refreshed_date = event?.detail?.date;
      if (refreshed_date && refreshed_date === Selected_key) {
        Fetch_events();
      }
    };

    window.addEventListener("calendar:refresh", Handle_calendar_refresh);
    return () => {
      window.removeEventListener("calendar:refresh", Handle_calendar_refresh);
    };
  }, [Fetch_events, Selected_key]);

  useEffect(() => {
    const timer = setInterval(() => Set_now_tick(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  Use_body_scroll_lock(Form_modal.open, Delete_target);

  const Validate_calendar_field = (field_name) => {
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

  const Handle_calendar_field_blur = (field_name) => {
    const errors = Validate_calendar_field(field_name);
    const fieldError = errors[field_name] || null;
    Set_field_errors((prev) => ({
      ...prev,
      [field_name]: fieldError,
    }));
    Set_field_states((prev) => ({
      ...prev,
      [field_name]: fieldError ? "error" : form[field_name] ? "valid" : "idle",
    }));
    if (fieldError) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };

  const Is_calendar_form_valid = useMemo(() => {
    if (!form.title || !form.title.trim()) return false;
    if (!form.event_date) return false;
    if (!form.start_time || !form.end_time) return false;
    if (form.start_time >= form.end_time) return false;
    if (!form.color) return false;
    return true;
  }, [form]);

  const Shift_selected_date = (direction) => {
    const delta = direction === "next" ? 1 : -1;
    if (View_mode === "month") {
      const next = new Date(Selected_date);
      next.setMonth(next.getMonth() + delta);
      Set_selected_date(next);
      return;
    }

    Set_selected_date((date) => Add_days(date, delta * 7));
  };

  const Open_add_modal = (start_time = "09:00") => {
    const [h] = start_time.split(":").map(Number);
    const endHour = Math.min(h + 1, DAY_END_HOUR);
    Set_editing_event(null);
    Set_form({
      ...Empty_form(Selected_key),
      color: "",
      start_time: start_time,
      end_time: `${String(endHour).padStart(2, "0")}:00`,
    });
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  const Open_edit_modal = (event) => {
    Set_editing_event(event);
    Set_form({
      title: event.title,
      notes: Get_visible_event_notes(event.notes),
      event_date: event.event_date,
      start_time: event.start_time.slice(0, 5),
      end_time: event.end_time.slice(0, 5),
      color: event.color ?? "green",
    });
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  const Close_form_modal = () => {
    Form_modal.close_modal();
    setTimeout(() => {
      Set_editing_event(null);
      Set_form(Empty_form(Selected_key));
      Set_field_errors({});
      Set_field_states({});
    }, MODAL_EXIT_MS);
  };

  const Close_delete_modal = () => {
    Delete_modal.close_modal();
    setTimeout(() => {
      Set_delete_target(null);
    }, MODAL_EXIT_MS);
  };

  const Handle_submit = async (e) => {
    e.preventDefault();

    const title = Sanitize_text(form.title, 80);
    const event_date = Sanitize_date(form.event_date, Selected_key);
    const start_time = Sanitize_time(form.start_time, "09:00");
    const end_time = Sanitize_time(form.end_time, "10:00");

    const errors = {};
    if (!title) errors.title = "Give it a name";
    if (!event_date) errors.event_date = "Pick a date";
    if (!start_time) errors.start_time = "Required";
    if (!end_time) errors.end_time = "Required";
    if (start_time && end_time && end_time <= start_time)
      errors.end_time = "Must be after start";
    if (!form.color) errors.color = "Pick a color";

    if (Object.keys(errors).length > 0) {
      Set_field_errors(errors);
      const newStates = {};
      Object.keys(errors).forEach((k) => {
        newStates[k] = "error";
      });
      Set_field_states((prev) => ({ ...prev, ...newStates }));
      Set_shake_key((k) => k + 1);
      return;
    }

    Set_saving(true);
    Set_error(null);

    const nextNotes = Sanitize_text(form.notes, 240) || null;
    const payload = {
      title,
      notes:
        Editing_event && Is_shift_link_note(Editing_event.notes)
          ? Editing_event.notes
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
      const supabase = Get_supabase_client();
      let dbError;
      if (Editing_event) {
        ({ error: dbError } = await supabase
          .from("events")
          .update(payload)
          .eq("id", Editing_event.id));
      } else {
        ({ error: dbError } = await supabase.from("events").insert(payload));
      }

      Set_saving(false);

      if (dbError) {
        const message = Get_user_facing_error(dbError.message);
        Set_error(message);
        Toast_error(
          Editing_event ? "Couldn't edit event." : "Couldn't save event.",
        );
        return;
      }

      // If this event is linked to a shift, mirror the new time back onto
      // the shift record and recompute Wake up / Go for a walk for the day
      // so editing from the Calendar page stays in sync with the Shifts page.
      if (Editing_event && Is_shift_link_note(Editing_event.notes)) {
        const linked_shift_id = Editing_event.notes.match(
          /Linked shift id:\s*([a-zA-Z0-9-]+)/,
        )?.[1];

        if (linked_shift_id) {
          try {
            const startMin = Parse_time_to_minutes(start_time);
            const endMin = Parse_time_to_minutes(end_time);
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

            await Recalc_wake_walk_for_date(supabase, event_date, user_id);
            window.dispatchEvent(new CustomEvent("shifts:refresh"));
          } catch {
            Toast_error(
              "Event saved, but syncing the linked shift and wake/walk times failed.",
            );
          }
        }
      }

      Close_form_modal();
      Toast_success(
        Editing_event ? "Event edited successfully." : "Event saved.",
      );
      Fetch_events();
    } catch (err) {
      Set_saving(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error(
        Editing_event ? "Couldn't edit event." : "Couldn't save event.",
      );
    }
  };

  const Confirm_delete = async () => {
    if (!Delete_target) return;

    Set_deleting(true);
    Set_error(null);

    try {
      const supabase = Get_supabase_client();
      const event_date = Delete_target.event_date;
      const linked_shift_id =
        typeof Delete_target.notes === "string"
          ? Delete_target.notes.match(/Linked shift id:\s*([a-zA-Z0-9-]+)/)?.[1]
          : null;

      const { error: dbError } = await supabase
        .from("events")
        .delete()
        .eq("id", Delete_target.id);

      Set_deleting(false);

      if (dbError) {
        Set_error(Get_user_facing_error(dbError.message));
        Toast_error("Failed to delete event.");
        return;
      }

      if (linked_shift_id) {
        const { error: shiftDeleteError } = await supabase
          .from("shifts")
          .delete()
          .eq("id", linked_shift_id);

        if (shiftDeleteError) {
          Toast_error(
            "Deleted calendar event, but the linked shift could not be removed.",
          );
        } else {
          window.dispatchEvent(new CustomEvent("shifts:refresh"));
        }
      }

      const removedId = Delete_target.id;
      Close_delete_modal();
      Toast_success("Event deleted.");
      Set_removing_id(removedId);

      setTimeout(async () => {
        const { data: remainingEvents = [] } = await supabase
          .from("events")
          .select("*")
          .eq("event_date", event_date);

        let generatedIds = [];
        const shouldRemoveGenerated = remainingEvents.every(
          (event) => Is_generated_wake_event(event) || event.id === removedId,
        );

        if (shouldRemoveGenerated) {
          generatedIds = (remainingEvents || [])
            .filter((event) => Is_generated_wake_event(event))
            .map((event) => event.id);

          if (generatedIds.length > 0) {
            await supabase.from("events").delete().in("id", generatedIds);
          }
        }

        const idsToRemove = [removedId, ...generatedIds];
        Set_events((prev) =>
          prev.filter((item) => !idsToRemove.includes(item.id)),
        );
        Set_all_events((prev) =>
          prev.filter((item) => !idsToRemove.includes(item.id)),
        );
        Set_removing_id(null);
        window.dispatchEvent(
          new CustomEvent("calendar:refresh", { detail: { date: event_date } }),
        );
      }, 380);
    } catch (err) {
      Set_deleting(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error("Failed to delete event.");
    }
  };

  const Toggle_complete = async (event) => {
    Set_toggling_id(event.id);
    Set_error(null);

    const nextCompleted = !event.is_completed;

    try {
      const supabase = Get_supabase_client();
      const { error: dbError } = await supabase
        .from("events")
        .update({
          is_completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
        })
        .eq("id", event.id);

      Set_toggling_id(null);

      if (dbError) {
        Set_error(Get_user_facing_error(dbError.message));
        return;
      }

      Set_events((prev) =>
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
      Set_toggling_id(null);
      Set_error(Get_user_facing_error(err.message));
    }
  };

  const Handle_grid_click = (e) => {
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
    Open_add_modal(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
  };

  const Day_title = Selected_date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="calendar page">
      <Page_header
        className="calendar__header animate-in"
        eyebrow={Household_name ? `Calendar · ${Household_name}` : "Daily planner"}
        title="Calendar"
      />

      <div className="calendar__nav animate-in animate-in--1">
        <button
          type="button"
          className="calendar__nav-btn"
          onClick={() => Shift_selected_date("prev")}
          aria-label={View_mode === "month" ? "Previous month" : "Previous week"}
        >
          ‹
        </button>
        <div className="calendar__nav-center">
          <p className="calendar__date-label">
            {View_mode === "month"
              ? Selected_date.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })
              : Day_title}
          </p>
          {!Is_today && (
            <button
              type="button"
              className="calendar__today-btn"
              onClick={() => Set_selected_date(new Date())}
            >
              Today
            </button>
          )}
        </div>
        <button
          type="button"
          className="calendar__nav-btn"
          onClick={() => Shift_selected_date("next")}
          aria-label={View_mode === "month" ? "Next month" : "Next week"}
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
          className={`calendar__view-btn${View_mode === "week" ? " calendar__view-btn--active" : ""}`}
          onClick={() => Set_view_mode("week")}
          aria-pressed={View_mode === "week"}
        >
          1 week
        </button>
        <button
          type="button"
          className={`calendar__view-btn${View_mode === "month" ? " calendar__view-btn--active" : ""}`}
          onClick={() => Set_view_mode("month")}
          aria-pressed={View_mode === "month"}
        >
          1 month
        </button>
      </div>

      <Calendar_grid
        Visible_days={Visible_days}
        Selected_date={Selected_date}
        today={today}
        View_mode={View_mode}
        busy_dates={busy_dates}
        onDaySelect={Set_selected_date}
      />

      <div className="calendar__summary animate-in animate-in--3">
        <Glass_card
          className="calendar__stat"
          value={events.length}
          label="Events"
        />
        <Glass_card
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
          onClick={() => Open_add_modal()}
          ref={Add_btn_ref}
        >
          + Add event
        </button>
      </div>

      {Loading ? (
        <Loading_skeleton count={3} height="4rem" />
      ) : (
        <div className="calendar__day animate-in animate-in--4">
          <Timeline_view
            Hour_labels={Hour_labels}
            Laid_out_events={Laid_out_events}
            Now_line_top={Now_line_top}
            onGridClick={Handle_grid_click}
            onEventClick={Open_edit_modal}
            onCheck={Toggle_complete}
            onDelete={(event) => {
              Set_delete_target(event);
              Delete_modal.open_modal();
            }}
            Toggling_id={Toggling_id}
            Removing_id={Removing_id}
            Is_wake_event={Is_wake_event}
          />
        </div>
      )}

      {events.length === 0 && !Loading && (
        <div style={{ marginTop: "1rem" }}>
          <Empty_state
            text="No events today. Tap the timeline or + Add event."
            className="animate-in"
          />
        </div>
      )}

      <Reminder_list
        events={events}
        Is_wake_event={Is_wake_event}
        onCheck={Toggle_complete}
        onEdit={Open_edit_modal}
        onDelete={(event) => {
          Set_delete_target(event);
          Delete_modal.open_modal();
        }}
        Toggling_id={Toggling_id}
        Removing_id={Removing_id}
      />

      <Event_form
        open={Form_modal.open}
        closing={Form_modal.closing}
        onClose={Close_form_modal}
        Editing_event={Editing_event}
        form={form}
        on_form_change={Set_form}
        Saving={Saving}
        Field_errors={Field_errors}
        Field_states={Field_states}
        Shake_key={Shake_key}
        onFieldBlur={Handle_calendar_field_blur}
        onSubmit={Handle_submit}
        onClearFieldError={(field) =>
          Set_field_errors((prev) => ({ ...prev, [field]: null }))
        }
        onSetFieldState={(field, state) =>
          Set_field_states((prev) => ({ ...prev, [field]: state }))
        }
        isValid={Is_calendar_form_valid}
      />

      <Confirm_modal
        open={!!Delete_target && Delete_modal.open}
        closing={Delete_modal.closing}
        onClose={Close_delete_modal}
        onConfirm={Confirm_delete}
        Loading={Deleting}
        title="Delete this event?"
        preview={
          Delete_target && (
            <strong>
              {Delete_target.title} on {Delete_target.event_date} (
              {Format_time_12(Delete_target.start_time)} –{" "}
              {Format_time_12(Delete_target.end_time)})
            </strong>
          )
        }
        confirm_label="Delete event"
      />

      <FAB
        visible={Show_floating_actions}
        on_scroll_top={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        on_add={() => Open_add_modal()}
        add_label="Add event"
      />
    </section>
  );
}

export default Calendar;
