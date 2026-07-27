import "./Calendar.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { useUserId } from "../../../lib/Auth_context.jsx";
import {
  addDays,
  DAY_END_HOUR,
  DAY_START_HOUR,
  EVENT_COLORS,
  eventStyle,
  resolveColor,
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
  hapticError,
} from "../../../lib/security";
import {
  parseTimeToMinutes,
  isShiftLinkNote,
  getVisibleEventNotes,
  recalcWakeWalkForDate,
} from "../../../lib/calendar_sync";
import {
  useBodyScrollLock,
  useModal,
  useFloatingActions,
} from "../../../hooks";
import {
  ConfirmModal,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  GlassCard,
  FAB,
} from "../../../components";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import { fetchPalette } from "../../../lib/color_palette.js";
import { useHousehold } from "../../../lib/Household_context.jsx";
import EventForm from "./EventForm.jsx";
import CalendarGrid from "./CalendarGrid.jsx";
import TimelineView from "./TimelineView.jsx";
import ReminderList from "./ReminderList.jsx";

const MODAL_EXIT_MS = 260;

const emptyForm = (dateKey) => ({
  title: "",
  notes: "",
  event_date: dateKey,
  start_time: "09:00",
  end_time: "10:00",
  color: "",
});

function Calendar() {
  const { householdName } = useHousehold();
  const userId = useUserId();
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState("week");
  const [events, setEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(() => emptyForm(toDateKey(today)));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldStates, setFieldStates] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [palette, setPalette] = useState([]);

  const formModal = useModal(MODAL_EXIT_MS);
  const deleteModal = useModal(MODAL_EXIT_MS);
  const { ref: addBtnRef, visible: showFloatingActions } = useFloatingActions();
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const selectedKey = toDateKey(selectedDate);
  const isToday = selectedKey === toDateKey(today);

  // Load color palette from DB
  useEffect(() => {
    fetchPalette().then(setPalette);
  }, []);

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
      } catch {
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

  useBodyScrollLock(formModal.open, deleteTarget);

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
      case "color": {
        if (!form.color) {
          errors[fieldName] = "Pick a color";
        }
        break;
      }
    }
    return errors;
  };

  const handleCalendarFieldBlur = (fieldName) => {
    const errors = validateCalendarField(fieldName);
    const fieldError = errors[fieldName] || null;
    setFieldErrors((prev) => ({
      ...prev,
      [fieldName]: fieldError,
    }));
    setFieldStates((prev) => ({
      ...prev,
      [fieldName]: fieldError ? "error" : form[fieldName] ? "valid" : "idle",
    }));
    if (fieldError) {
      setShakeKey((k) => k + 1);
      hapticError();
    }
  };

  const isCalendarFormValid = useMemo(() => {
    if (!form.title || !form.title.trim()) return false;
    if (!form.event_date) return false;
    if (!form.start_time || !form.end_time) return false;
    if (form.start_time >= form.end_time) return false;
    if (!form.color) return false;
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
      color: "",
      start_time: startTime,
      end_time: `${String(endHour).padStart(2, "0")}:00`,
    });
    setFieldErrors({});
    setFieldStates({});
    formModal.openModal();
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
    setFieldErrors({});
    setFieldStates({});
    formModal.openModal();
  };

  const closeFormModal = () => {
    formModal.closeModal();
    setTimeout(() => {
      setEditingEvent(null);
      setForm(emptyForm(selectedKey));
      setFieldErrors({});
      setFieldStates({});
    }, MODAL_EXIT_MS);
  };

  const closeDeleteModal = () => {
    deleteModal.closeModal();
    setTimeout(() => {
      setDeleteTarget(null);
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
    if (!form.color) errors.color = "Pick a color";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const newStates = {};
      Object.keys(errors).forEach((k) => {
        newStates[k] = "error";
      });
      setFieldStates((prev) => ({ ...prev, ...newStates }));
      setShakeKey((k) => k + 1);
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
          } catch {
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
      <PageHeader
        className="calendar__header animate-in"
        eyebrow={householdName ? `Calendar · ${householdName}` : "Daily planner"}
        title="Calendar"
      />

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

      <CalendarGrid
        visibleDays={visibleDays}
        selectedDate={selectedDate}
        today={today}
        viewMode={viewMode}
        busyDates={busyDates}
        onDaySelect={setSelectedDate}
      />

      <div className="calendar__summary animate-in animate-in--3">
        <GlassCard
          className="calendar__stat"
          value={events.length}
          label="Events"
        />
        <GlassCard
          className="calendar__stat"
          value={pendingCount}
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
          onClick={() => openAddModal()}
          ref={addBtnRef}
        >
          + Add event
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton count={3} height="4rem" />
      ) : (
        <div className="calendar__day animate-in animate-in--4">
          <TimelineView
            hourLabels={hourLabels}
            laidOutEvents={laidOutEvents}
            nowLineTop={nowLineTop}
            onGridClick={handleGridClick}
            onEventClick={openEditModal}
            onCheck={toggleComplete}
            onDelete={(event) => {
              setDeleteTarget(event);
              deleteModal.openModal();
            }}
            togglingId={togglingId}
            removingId={removingId}
            isWakeEvent={isWakeEvent}
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
        isWakeEvent={isWakeEvent}
        onCheck={toggleComplete}
        onEdit={openEditModal}
        onDelete={(event) => {
          setDeleteTarget(event);
          deleteModal.openModal();
        }}
        togglingId={togglingId}
        removingId={removingId}
      />

      <EventForm
        open={formModal.open}
        closing={formModal.closing}
        onClose={closeFormModal}
        editingEvent={editingEvent}
        form={form}
        onFormChange={setForm}
        saving={saving}
        fieldErrors={fieldErrors}
        fieldStates={fieldStates}
        shakeKey={shakeKey}
        onFieldBlur={handleCalendarFieldBlur}
        onSubmit={handleSubmit}
        onClearFieldError={(field) =>
          setFieldErrors((prev) => ({ ...prev, [field]: null }))
        }
        onSetFieldState={(field, state) =>
          setFieldStates((prev) => ({ ...prev, [field]: state }))
        }
        isValid={isCalendarFormValid}
      />

      <ConfirmModal
        open={!!deleteTarget && deleteModal.open}
        closing={deleteModal.closing}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this event?"
        preview={
          deleteTarget && (
            <strong>
              {deleteTarget.title} on {deleteTarget.event_date} (
              {formatTime12(deleteTarget.start_time)} –{" "}
              {formatTime12(deleteTarget.end_time)})
            </strong>
          )
        }
        confirmLabel="Delete event"
      />

      <FAB
        visible={showFloatingActions}
        onScrollTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onAdd={() => openAddModal()}
        addLabel="Add event"
      />
    </section>
  );
}

export default Calendar;
