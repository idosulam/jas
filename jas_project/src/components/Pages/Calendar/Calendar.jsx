import "./Calendar.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseClient } from "../../../lib/superbase";
import { useUserId } from "../../../lib/useAuth.js";
import {
  addDays,
  DAY_END_HOUR,
  DAY_START_HOUR,
  EVENT_COLORS,
  eventStyle,
  resolveColor,
  parseTimeToMinutes,
  formatTime12,
  HOUR_HEIGHT,
  layoutOverlappingEvents,
  startOfWeek,
  toDateKey,
  TOTAL_HOURS,
} from "./calendar_layout";
import {
  getUserFacingError,
  sanitizeDate,
  sanitizeText,
  sanitizeTime,
} from "../../../lib/security";

import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import ColorPalettePicker from "../../../lib/ColorPalettePicker.jsx";
import { fetchPalette } from "../../../lib/color_palette.js";

const MODAL_EXIT_MS = 260;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Wake/walk generation defaults — mirrors the logic in Shifts.jsx so that
// editing a shift-linked event directly on the Calendar page keeps the
// linked shift and the generated Wake up / Go for a walk events in sync.
const CALENDAR_WAKEUP_BEFORE_MINUTES = 120;
const CALENDAR_WALK_AFTER_WAKE_MINUTES = 30;
const CALENDAR_WAKE_TITLE = "Wake up";
const CALENDAR_WALK_TITLE = "Go for a walk";

const emptyForm = (dateKey) => ({
  title: "",
  notes: "",
  event_date: dateKey,
  start_time: "09:00",
  end_time: "10:00",
  color: "#818cf8",
});

function isShiftLinkNote(value) {
  return typeof value === "string" && value.startsWith("Linked shift id:");
}

function getVisibleEventNotes(value) {
  if (isShiftLinkNote(value)) return "";
  return value ?? "";
}

function minutesToTime(min) {
  const total = Math.max(0, Math.floor(min));
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Recomputes the Wake up / Go for a walk events for a given date based on
// whatever shifts currently exist that day. Deletes the old generated
// events and inserts fresh ones. Safe to call even if there are no shifts
// (it will just clean up any stale wake/walk events).
async function recalcWakeWalkForDate(supabase, dateKey, userId) {
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

  const generatedIds = eventsOnDate
    .filter(
      (e) => e.title === CALENDAR_WAKE_TITLE || e.title === CALENDAR_WALK_TITLE,
    )
    .map((e) => e.id);

  if (!shiftsOnDate.length) {
    if (generatedIds.length > 0) {
      await supabase.from("events").delete().in("id", generatedIds);
    }
    return;
  }

  const starts = shiftsOnDate.map((shift) => {
    if (shift.start_time) {
      const m = parseTimeToMinutes(shift.start_time);
      if (m != null) return m;
    }
    if (shift.end_time && shift.hours) {
      const end = parseTimeToMinutes(shift.end_time);
      if (end != null) {
        return Math.max(
          0,
          end - Math.round((parseFloat(shift.hours) || 0) * 60),
        );
      }
    }
    return 9 * 60;
  });

  const earliest = Math.min(...starts);
  const desiredWake = Math.max(0, earliest - CALENDAR_WAKEUP_BEFORE_MINUTES);
  const desiredWalk = desiredWake + CALENDAR_WALK_AFTER_WAKE_MINUTES;

  if (generatedIds.length > 0) {
    await supabase.from("events").delete().in("id", generatedIds);
  }

  await supabase.from("events").insert({
    title: CALENDAR_WAKE_TITLE,
    notes: null,
    event_date: dateKey,
    start_time: minutesToTime(desiredWake),
    end_time: minutesToTime(desiredWake + 15),
    color: "pink",
    ...(userId && { user_id: userId }),
  });

  await supabase.from("events").insert({
    title: CALENDAR_WALK_TITLE,
    notes: null,
    event_date: dateKey,
    start_time: minutesToTime(desiredWalk),
    end_time: minutesToTime(desiredWalk + 30),
    color: "green",
    ...(userId && { user_id: userId }),
  });
}

function Calendar() {
  const userId = useUserId();
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState("week");
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formModalClosing, setFormModalClosing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteModalClosing, setDeleteModalClosing] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(() => emptyForm(toDateKey(today)));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [palette, setPalette] = useState([]);
  const addBtnRef = useRef(null);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const selectedKey = toDateKey(selectedDate);
  const isToday = selectedKey === toDateKey(today);

  // Load color palette from DB
  useEffect(() => {
    fetchPalette().then(setPalette);
  }, []);

  const firstColor = palette[0]?.hex || "#818cf8";

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    );
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const visibleDays = viewMode === "week" ? weekDays : monthDays;

  const hourLabels = useMemo(
    () =>
      Array.from({ length: TOTAL_HOURS }, (_, i) => {
        const hour = DAY_START_HOUR + i;
        const period = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12} ${period}`;
      }),
    [],
  );

  const laidOutEvents = useMemo(
    () => layoutOverlappingEvents(events),
    [events],
  );

  const isWakeEvent = (e) =>
    typeof e.title === "string" && e.title.toLowerCase().includes("wake");

  const isGeneratedWakeEvent = (event) =>
    event?.title === "Wake up" || event?.title === "Go for a walk";

  const pendingCount = useMemo(
    () => events.filter((event) => !event.is_completed).length,
    [events],
  );

  const busyDates = useMemo(
    () => new Set(allEvents.map((event) => event.event_date)),
    [allEvents],
  );

  const nowLineTop = useMemo(() => {
    if (!isToday) return null;
    const now = new Date(nowTick);
    const minutes = now.getHours() * 60 + now.getMinutes();
    const dayStart = DAY_START_HOUR * 60;
    const dayEnd = (DAY_END_HOUR + 1) * 60;
    if (minutes < dayStart || minutes > dayEnd) return null;
    return ((minutes - dayStart) / 60) * HOUR_HEIGHT;
  }, [isToday, nowTick]);

  const fetchEvents = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const rangeStart =
      viewMode === "week"
        ? startOfWeek(selectedDate)
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const rangeEnd =
      viewMode === "week"
        ? addDays(rangeStart, 6)
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

    const startKey = toDateKey(rangeStart);
    const endKey = toDateKey(rangeEnd);

    try {
      const supabase = getSupabaseClient();

      // Sync any shifts that don't have calendar events yet
      try {
        const { data: shiftsInRange = [] } = await supabase
          .from("shifts")
          .select("*")
          .eq("user_id", userId)
          .gte("shift_date", startKey)
          .lte("shift_date", endKey);

        const { data: existingEvents = [] } = await supabase
          .from("events")
          .select("id, notes")
          .eq("user_id", userId)
          .gte("event_date", startKey)
          .lte("event_date", endKey);

        const linkedShiftIds = new Set(
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
          (s) => !linkedShiftIds.has(s.id),
        );
        if (unsynced.length > 0) {
          for (const shift of unsynced) {
            const dateKey = shift.shift_date;
            const title = `Shift: ${shift.place}`;
            const start = shift.start_time || "09:00";
            const end = shift.end_time || "17:00";
            await supabase.from("events").insert({
              title,
              notes: `Linked shift id: ${shift.id}`,
              event_date: dateKey,
              start_time: start,
              end_time: end,
              color: shift.color || "cyan",
              ...(userId && { user_id: userId }),
            });
          }
        }
      } catch (syncErr) {
        // non-critical, continue fetching
      }

      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .gte("event_date", startKey)
        .lte("event_date", endKey)
        .order("start_time", { ascending: true });

      if (fetchError) {
        setError(getUserFacingError(fetchError.message));
        setAllEvents([]);
        setEvents([]);
      } else {
        const items = data ?? [];
        setAllEvents(items);
        setEvents(items.filter((event) => event.event_date === selectedKey));
      }
    } catch (err) {
      setError(getUserFacingError(err.message));
      setAllEvents([]);
      setEvents([]);
    }
    setLoading(false);
  }, [selectedDate, selectedKey, viewMode, userId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    const handleCalendarRefresh = (event) => {
      const refreshedDate = event?.detail?.date;
      if (refreshedDate && refreshedDate === selectedKey) {
        fetchEvents();
      }
    };

    window.addEventListener("calendar:refresh", handleCalendarRefresh);
    return () => {
      window.removeEventListener("calendar:refresh", handleCalendarRefresh);
    };
  }, [fetchEvents, selectedKey]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (modalOpen || deleteTarget) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [modalOpen, deleteTarget]);

  useEffect(() => {
    const target = addBtnRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowFloatingActions(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const closeFormModal = () => {
    setFormModalClosing(true);
    setTimeout(() => {
      setModalOpen(false);
      setFormModalClosing(false);
      setEditingEvent(null);
      setForm(emptyForm(selectedKey));
      setFieldErrors({});
    }, MODAL_EXIT_MS);
  };

  const validateCalendarField = (fieldName) => {
    const errors = {};
    switch (fieldName) {
      case "title": {
        if (!form.title || !form.title.trim()) {
          errors[fieldName] = "Give it a name";
        }
        break;
      }
      case "event_date": {
        if (!form.event_date) {
          errors[fieldName] = "Pick a date";
        }
        break;
      }
      case "start_time": {
        if (!form.start_time) {
          errors[fieldName] = "Required";
        } else if (form.end_time && form.start_time >= form.end_time) {
          errors[fieldName] = "Must be before end";
        }
        break;
      }
      case "end_time": {
        if (!form.end_time) {
          errors[fieldName] = "Required";
        } else if (form.start_time && form.end_time <= form.start_time) {
          errors[fieldName] = "Must be after start";
        }
        break;
      }
    }
    return errors;
  };

  const handleCalendarFieldBlur = (fieldName) => {
    const errors = validateCalendarField(fieldName);
    setFieldErrors((prev) => ({
      ...prev,
      [fieldName]: errors[fieldName] || null,
    }));
  };

  const isCalendarFormValid = useMemo(() => {
    if (!form.title || !form.title.trim()) return false;
    if (!form.event_date) return false;
    if (!form.start_time || !form.end_time) return false;
    if (form.start_time >= form.end_time) return false;
    return true;
  }, [form]);

  const shiftSelectedDate = (direction) => {
    const delta = direction === "next" ? 1 : -1;
    if (viewMode === "month") {
      const next = new Date(selectedDate);
      next.setMonth(next.getMonth() + delta);
      setSelectedDate(next);
      return;
    }

    setSelectedDate((date) => addDays(date, delta * 7));
  };

  const openAddModal = (startTime = "09:00") => {
    const [h] = startTime.split(":").map(Number);
    const endHour = Math.min(h + 1, DAY_END_HOUR);
    setEditingEvent(null);
    setForm({
      ...emptyForm(selectedKey),
      color: firstColor,
      start_time: startTime,
      end_time: `${String(endHour).padStart(2, "0")}:00`,
    });
    setFormModalClosing(false);
    setModalOpen(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      notes: getVisibleEventNotes(event.notes),
      event_date: event.event_date,
      start_time: event.start_time.slice(0, 5),
      end_time: event.end_time.slice(0, 5),
      color: event.color ?? "green",
    });
    setFormModalClosing(false);
    setModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalClosing(true);
    setTimeout(() => {
      setDeleteTarget(null);
      setDeleteModalClosing(false);
    }, MODAL_EXIT_MS);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const title = sanitizeText(form.title, 80);
    const eventDate = sanitizeDate(form.event_date, selectedKey);
    const startTime = sanitizeTime(form.start_time, "09:00");
    const endTime = sanitizeTime(form.end_time, "10:00");

    const errors = {};
    if (!title) errors.title = "Give it a name";
    if (!eventDate) errors.event_date = "Pick a date";
    if (!startTime) errors.start_time = "Required";
    if (!endTime) errors.end_time = "Required";
    if (startTime && endTime && endTime <= startTime)
      errors.end_time = "Must be after start";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setError(null);

    const nextNotes = sanitizeText(form.notes, 240) || null;
    const payload = {
      title,
      notes:
        editingEvent && isShiftLinkNote(editingEvent.notes)
          ? editingEvent.notes
          : nextNotes,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      ...(userId && { user_id: userId }),
      color:
        form.color && form.color.startsWith("#")
          ? form.color
          : EVENT_COLORS[form.color]
            ? form.color
            : "#818cf8",
    };

    try {
      const supabase = getSupabaseClient();
      let dbError;
      if (editingEvent) {
        ({ error: dbError } = await supabase
          .from("events")
          .update(payload)
          .eq("id", editingEvent.id));
      } else {
        ({ error: dbError } = await supabase.from("events").insert(payload));
      }

      setSaving(false);

      if (dbError) {
        const message = getUserFacingError(dbError.message);
        setError(message);
        toastError(
          editingEvent ? "Couldn't edit event." : "Couldn't save event.",
        );
        return;
      }

      // If this event is linked to a shift, mirror the new time back onto
      // the shift record and recompute Wake up / Go for a walk for the day
      // so editing from the Calendar page stays in sync with the Shifts page.
      if (editingEvent && isShiftLinkNote(editingEvent.notes)) {
        const linkedShiftId = editingEvent.notes.match(
          /Linked shift id:\s*([a-zA-Z0-9-]+)/,
        )?.[1];

        if (linkedShiftId) {
          try {
            const startMin = parseTimeToMinutes(startTime);
            const endMin = parseTimeToMinutes(endTime);
            const hours =
              startMin != null && endMin != null
                ? Number(((endMin - startMin) / 60).toFixed(2))
                : null;

            await supabase
              .from("shifts")
              .update({
                start_time: startTime,
                end_time: endTime,
                ...(hours != null ? { hours } : {}),
              })
              .eq("id", linkedShiftId);

            await recalcWakeWalkForDate(supabase, eventDate, userId);
            window.dispatchEvent(new CustomEvent("shifts:refresh"));
          } catch (syncErr) {
            toastError(
              "Event saved, but syncing the linked shift and wake/walk times failed.",
            );
          }
        }
      }

      closeFormModal();
      toastSuccess(
        editingEvent ? "Event edited successfully." : "Event saved.",
      );
      fetchEvents();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError(
        editingEvent ? "Couldn't edit event." : "Couldn't save event.",
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const eventDate = deleteTarget.event_date;
      const linkedShiftId =
        typeof deleteTarget.notes === "string"
          ? deleteTarget.notes.match(/Linked shift id:\s*([a-zA-Z0-9-]+)/)?.[1]
          : null;

      const { error: dbError } = await supabase
        .from("events")
        .delete()
        .eq("id", deleteTarget.id);

      setDeleting(false);

      if (dbError) {
        setError(getUserFacingError(dbError.message));
        toastError("Failed to delete event.");
        return;
      }

      if (linkedShiftId) {
        const { error: shiftDeleteError } = await supabase
          .from("shifts")
          .delete()
          .eq("id", linkedShiftId);

        if (shiftDeleteError) {
          toastError(
            "Deleted calendar event, but the linked shift could not be removed.",
          );
        } else {
          window.dispatchEvent(new CustomEvent("shifts:refresh"));
        }
      }

      const removedId = deleteTarget.id;
      closeDeleteModal();
      toastSuccess("Event deleted.");
      setRemovingId(removedId);

      setTimeout(async () => {
        const { data: remainingEvents = [] } = await supabase
          .from("events")
          .select("*")
          .eq("event_date", eventDate);

        let generatedIds = [];
        const shouldRemoveGenerated = remainingEvents.every(
          (event) => isGeneratedWakeEvent(event) || event.id === removedId,
        );

        if (shouldRemoveGenerated) {
          generatedIds = (remainingEvents || [])
            .filter((event) => isGeneratedWakeEvent(event))
            .map((event) => event.id);

          if (generatedIds.length > 0) {
            await supabase.from("events").delete().in("id", generatedIds);
          }
        }

        const idsToRemove = [removedId, ...generatedIds];
        setEvents((prev) =>
          prev.filter((item) => !idsToRemove.includes(item.id)),
        );
        setAllEvents((prev) =>
          prev.filter((item) => !idsToRemove.includes(item.id)),
        );
        setRemovingId(null);
        window.dispatchEvent(
          new CustomEvent("calendar:refresh", { detail: { date: eventDate } }),
        );
      }, 380);
    } catch (err) {
      setDeleting(false);
      setError(getUserFacingError(err.message));
      toastError("Failed to delete event.");
    }
  };

  const toggleComplete = async (event) => {
    setTogglingId(event.id);
    setError(null);

    const nextCompleted = !event.is_completed;

    try {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("events")
        .update({
          is_completed: nextCompleted,
          completed_at: nextCompleted ? new Date().toISOString() : null,
        })
        .eq("id", event.id);

      setTogglingId(null);

      if (dbError) {
        setError(getUserFacingError(dbError.message));
        return;
      }

      setEvents((prev) =>
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
      setTogglingId(null);
      setError(getUserFacingError(err.message));
    }
  };
  const handleGridClick = (e) => {
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
    openAddModal(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
  };

  const dayTitle = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="calendar page">
      <header className="calendar__header animate-in">
        <p className="page__eyebrow">Daily planner</p>
        <h1 className="page__title">Calendar</h1>
      </header>

      <div className="calendar__nav animate-in animate-in--1">
        <button
          type="button"
          className="calendar__nav-btn"
          onClick={() => shiftSelectedDate("prev")}
          aria-label={viewMode === "month" ? "Previous month" : "Previous week"}
        >
          ‹
        </button>
        <div className="calendar__nav-center">
          <p className="calendar__date-label">
            {viewMode === "month"
              ? selectedDate.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })
              : dayTitle}
          </p>
          {!isToday && (
            <button
              type="button"
              className="calendar__today-btn"
              onClick={() => setSelectedDate(new Date())}
            >
              Today
            </button>
          )}
        </div>
        <button
          type="button"
          className="calendar__nav-btn"
          onClick={() => shiftSelectedDate("next")}
          aria-label={viewMode === "month" ? "Next month" : "Next week"}
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
          className={`calendar__view-btn${viewMode === "week" ? " calendar__view-btn--active" : ""}`}
          onClick={() => setViewMode("week")}
          aria-pressed={viewMode === "week"}
        >
          1 week
        </button>
        <button
          type="button"
          className={`calendar__view-btn${viewMode === "month" ? " calendar__view-btn--active" : ""}`}
          onClick={() => setViewMode("month")}
          aria-pressed={viewMode === "month"}
        >
          1 month
        </button>
      </div>

      <div
        className={`calendar__week animate-in animate-in--2${viewMode === "month" ? " calendar__week--month" : " calendar__week--week"}`}
        role="group"
        aria-label={viewMode === "week" ? "Week days" : "Month days"}
      >
        {visibleDays.map((day) => {
          const key = toDateKey(day);
          const isSelected = key === selectedKey;
          const isDayToday = key === toDateKey(today);
          const hasEvents = busyDates.has(key);
          const isInCurrentMonth =
            viewMode === "month"
              ? day.getMonth() === selectedDate.getMonth()
              : true;

          return (
            <button
              key={key}
              type="button"
              className={`calendar__week-day${isSelected ? " calendar__week-day--active" : ""}${isDayToday ? " calendar__week-day--today" : ""}${hasEvents ? " calendar__week-day--busy" : ""}${!isInCurrentMonth ? " calendar__week-day--muted" : ""}`}
              onClick={() => setSelectedDate(day)}
              aria-pressed={isSelected}
            >
              {viewMode === "week" && (
                <span className="calendar__week-label">
                  {WEEKDAYS[day.getDay()]}
                </span>
              )}
              <span className="calendar__week-num">{day.getDate()}</span>
              {hasEvents && (
                <span className="calendar__week-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      <div className="calendar__summary animate-in animate-in--3">
        <div className="glass-card calendar__stat">
          <span className="glass-card__value">{events.length}</span>
          <span className="glass-card__label">Events</span>
        </div>
        <div className="glass-card calendar__stat">
          <span className="glass-card__value">{pendingCount}</span>
          <span className="glass-card__label">Pending</span>
        </div>
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
          onClick={() => openAddModal()}
          ref={addBtnRef}
        >
          + Add event
        </button>
      </div>

      {loading ? (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="skeleton skeleton--card"
              style={{ height: "4rem" }}
            />
          ))}
        </div>
      ) : (
        <div className="calendar__day animate-in animate-in--4">
          <div className="calendar__timeline">
            <div className="calendar__hours" aria-hidden="true">
              {hourLabels.map((label) => (
                <div
                  key={label}
                  className="calendar__hour-label"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  {label}
                </div>
              ))}
            </div>

            <div
              className="calendar__grid"
              style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
              onClick={handleGridClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleGridClick(e);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label="Click to add event at that time"
            >
              {hourLabels.map((_, i) => (
                <div
                  key={i}
                  className="calendar__grid-line"
                  style={{ top: `${i * HOUR_HEIGHT}px` }}
                />
              ))}

              {nowLineTop !== null && (
                <div
                  className="calendar__now-line"
                  style={{ top: `${nowLineTop}px` }}
                  aria-hidden="true"
                >
                  <span className="calendar__now-dot" />
                </div>
              )}

              {laidOutEvents.map((event) => {
                // Render wake events as a thin, full-width line (not a task card)
                if (isWakeEvent(event)) {
                  const minutes = parseTimeToMinutes(event.start_time);
                  const dayStartMin = DAY_START_HOUR * 60;
                  const top = ((minutes - dayStartMin) / 60) * HOUR_HEIGHT;
                  return (
                    <div
                      key={event.id}
                      className="calendar__wake-line"
                      style={{ top: `${top}px` }}
                      aria-hidden="true"
                    >
                      <span className="calendar__wake-label">
                        {event.title}
                      </span>
                    </div>
                  );
                }

                const style = eventStyle(event);
                if (!style) return null;

                const colorInfo = resolveColor(event.color);
                const isShort = parseInt(style.height, 10) < 44;

                return (
                  <article
                    key={event.id}
                    className={`calendar__event calendar__event--${event.color}${event.is_completed ? " calendar__event--done" : ""}${removingId === event.id ? " calendar__event--removing" : ""}`}
                    style={{
                      ...style,
                      "--event-accent": colorInfo.accent,
                      "--event-bg": colorInfo.bg,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="calendar__check"
                      onClick={() => toggleComplete(event)}
                      disabled={togglingId === event.id}
                      aria-label={
                        event.is_completed
                          ? `Mark ${event.title} as pending`
                          : `Mark ${event.title} as done`
                      }
                      aria-pressed={event.is_completed}
                    >
                      <span
                        className="calendar__check-icon"
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      className="calendar__event-body"
                      onClick={() => openEditModal(event)}
                    >
                      <span className="calendar__event-title">
                        {event.title}
                      </span>
                      {!isShort && (
                        <span className="calendar__event-time">
                          {formatTime12(event.start_time)} –{" "}
                          {formatTime12(event.end_time)}
                        </span>
                      )}
                    </button>

                    <div className="calendar__event-actions">
                      <button
                        type="button"
                        className="calendar__event-action calendar__event-action--delete"
                        onClick={() => {
                          setDeleteModalClosing(false);
                          setDeleteTarget(event);
                        }}
                        aria-label={`Delete ${event.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {events.length === 0 && (
        <p
          className="calendar__empty calendar__reminder"
          style={{ marginTop: "1rem" }}
        >
          No events today. Tap the timeline or + Add event.
        </p>
      )}
      {events.length > 0 && (
        <ul className="calendar__reminders animate-in animate-in--4">
          {events
            .filter((event) => !isWakeEvent(event))
            .map((event) => (
              <li
                key={`list-${event.id}`}
                className={`calendar__reminder${event.is_completed ? " calendar__reminder--done" : ""}${removingId === event.id ? " calendar__reminder--removing" : ""}`}
              >
                <button
                  type="button"
                  className="calendar__check calendar__check--list"
                  onClick={() => toggleComplete(event)}
                  disabled={togglingId === event.id}
                  aria-label={
                    event.is_completed
                      ? `Mark ${event.title} as pending`
                      : `Mark ${event.title} as done`
                  }
                  aria-pressed={event.is_completed}
                >
                  <span className="calendar__check-icon" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="calendar__reminder-main"
                  onClick={() => openEditModal(event)}
                >
                  <span className="calendar__reminder-title">
                    {event.title}
                  </span>
                  <span className="calendar__reminder-time">
                    {formatTime12(event.start_time)} –{" "}
                    {formatTime12(event.end_time)}
                  </span>
                </button>
                <button
                  type="button"
                  className="calendar__reminder-delete"
                  onClick={() => {
                    setDeleteModalClosing(false);
                    setDeleteTarget(event);
                  }}
                  aria-label={`Delete ${event.title}`}
                >
                  Delete
                </button>
              </li>
            ))}
        </ul>
      )}

      {modalOpen &&
        createPortal(
          <div
            className={`calendar__overlay${formModalClosing ? " calendar__overlay--closing" : ""}`}
            onClick={closeFormModal}
          >
            <div
              className={`calendar__modal${formModalClosing ? " calendar__modal--closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="event-modal-title"
            >
              <h2 id="event-modal-title" className="calendar__modal-title">
                {editingEvent ? "Edit event" : "Add event"}
              </h2>

              <form className="calendar__form" onSubmit={handleSubmit}>
                <label className="calendar__field">
                  <span>
                    Title{" "}
                    {fieldErrors.title && (
                      <span className="calendar__field-error-text">
                        —{fieldErrors.title}
                      </span>
                    )}
                  </span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => {
                      setForm({ ...form, title: e.target.value });
                      setFieldErrors((prev) => ({ ...prev, title: null }));
                    }}
                    onBlur={() => handleCalendarFieldBlur("title")}
                    placeholder="Workout, meeting…"
                    className={fieldErrors.title ? "calendar__field-error" : ""}
                    required
                    autoComplete="off"
                  />
                </label>

                <label className="calendar__field">
                  <span>
                    Date{" "}
                    {fieldErrors.event_date && (
                      <span className="calendar__field-error-text">
                        —{fieldErrors.event_date}
                      </span>
                    )}
                  </span>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => {
                      setForm({ ...form, event_date: e.target.value });
                      setFieldErrors((prev) => ({ ...prev, event_date: null }));
                    }}
                    onBlur={() => handleCalendarFieldBlur("event_date")}
                    className={
                      fieldErrors.event_date ? "calendar__field-error" : ""
                    }
                    required
                  />
                </label>

                <label className="calendar__field">
                  <span>
                    Start{" "}
                    {fieldErrors.start_time && (
                      <span className="calendar__field-error-text">
                        —{fieldErrors.start_time}
                      </span>
                    )}
                  </span>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => {
                      setForm({ ...form, start_time: e.target.value });
                      setFieldErrors((prev) => ({
                        ...prev,
                        start_time: null,
                        end_time: null,
                      }));
                    }}
                    onBlur={() => handleCalendarFieldBlur("start_time")}
                    className={
                      fieldErrors.start_time ? "calendar__field-error" : ""
                    }
                    required
                  />
                </label>
                <label className="calendar__field">
                  <span>
                    End{" "}
                    {fieldErrors.end_time && (
                      <span className="calendar__field-error-text">
                        —{fieldErrors.end_time}
                      </span>
                    )}
                  </span>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => {
                      setForm({ ...form, end_time: e.target.value });
                      setFieldErrors((prev) => ({
                        ...prev,
                        end_time: null,
                        start_time: null,
                      }));
                    }}
                    onBlur={() => handleCalendarFieldBlur("end_time")}
                    className={
                      fieldErrors.end_time ? "calendar__field-error" : ""
                    }
                    required
                  />
                </label>

                <label className="calendar__field">
                  <span>Color</span>
                  <ColorPalettePicker
                    value={form.color}
                    onChange={(hex) => setForm({ ...form, color: hex })}
                  />
                </label>

                <label className="calendar__field">
                  <span>Notes (optional)</span>
                  <textarea
                    rows={3}
                    value={form.notes}
                    maxLength={240}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    placeholder="Reminder details…"
                  />
                  {form.notes.length > 0 && (
                    <span className="calendar__char-count">
                      {form.notes.length}/240
                    </span>
                  )}
                </label>

                <div className="calendar__form-actions">
                  <button
                    type="button"
                    className="calendar__btn calendar__btn--ghost"
                    onClick={closeFormModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="calendar__btn calendar__btn--primary"
                    disabled={saving || !isCalendarFormValid}
                  >
                    {saving ? (
                      <>
                        <span
                          className="calendar__btn-spinner"
                          aria-hidden="true"
                        />
                        Saving…
                      </>
                    ) : editingEvent ? (
                      "Save changes"
                    ) : (
                      "Add event"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {deleteTarget &&
        createPortal(
          <div
            className={`calendar__overlay calendar__overlay--delete${deleteModalClosing ? " calendar__overlay--closing" : ""}`}
            onClick={closeDeleteModal}
          >
            <div
              className={`calendar__modal calendar__modal--delete${deleteModalClosing ? " calendar__modal--closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-event-title"
            >
              {" "}
              <div className="calendar__delete-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path
                    d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                </svg>
              </div>
              <h2 id="delete-event-title" className="calendar__modal-title">
                Delete this event?
              </h2>
              <p className="calendar__delete-desc">
                <strong>{deleteTarget.title}</strong> on{" "}
                {deleteTarget.event_date} (
                {formatTime12(deleteTarget.start_time)} –{" "}
                {formatTime12(deleteTarget.end_time)})
              </p>
              <div className="calendar__form-actions">
                <button
                  type="button"
                  className="calendar__btn calendar__btn--ghost"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  className="calendar__btn calendar__btn--danger"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <span
                        className="calendar__btn-spinner"
                        aria-hidden="true"
                      />
                      Deleting…
                    </>
                  ) : (
                    "Delete event"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showFloatingActions &&
        createPortal(
          <div className="calendar__fab-stack">
            <button
              type="button"
              className="calendar__fab calendar__fab--up"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Scroll to top"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  d="M12 19V5M5 12l7-7 7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="calendar__fab calendar__fab--add"
              onClick={() => openAddModal()}
              aria-label="Add event"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  d="M12 5v14M5 12h14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>,
          document.body,
        )}
    </section>
  );
}

export default Calendar;
