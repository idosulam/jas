import "./Calendar.css";
import "./calendar_glassy.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseClient } from "../../../lib/superbase";
import {
  addDays,
  DAY_END_HOUR,
  DAY_START_HOUR,
  EVENT_COLORS,
  eventStyle,
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

const MODAL_EXIT_MS = 260;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const emptyForm = (dateKey) => ({
  title: "",
  notes: "",
  event_date: dateKey,
  start_time: "09:00",
  end_time: "10:00",
  color: "indigo",
});

function Calendar() {
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
  const addBtnRef = useRef(null);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const selectedKey = toDateKey(selectedDate);
  const isToday = selectedKey === toDateKey(today);

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

    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .gte("event_date", toDateKey(rangeStart))
        .lte("event_date", toDateKey(rangeEnd))
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
  }, [selectedDate, selectedKey, viewMode]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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
    }, MODAL_EXIT_MS);
  };

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
      notes: event.notes ?? "",
      event_date: event.event_date,
      start_time: event.start_time.slice(0, 5),
      end_time: event.end_time.slice(0, 5),
      color: event.color ?? "indigo",
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

    if (!title || !eventDate || !startTime || !endTime) {
      setError("Please fill in title, date, and times.");
      return;
    }

    if (endTime <= startTime) {
      setError("End time must be after start time.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      title,
      notes: sanitizeText(form.notes, 240) || null,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      color: ["indigo", "pink", "orange", "green", "cyan"].includes(form.color)
        ? form.color
        : "indigo",
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
        toastError(editingEvent ? "Edit didn’t work." : "Upload event didn’t work.");
        return;
      }

      closeFormModal();
      toastSuccess(editingEvent ? "Edit was ok." : "Upload event was ok.");
      fetchEvents();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError(editingEvent ? "Edit didn’t work." : "Upload event didn’t work.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("events")
        .delete()
        .eq("id", deleteTarget.id);

      setDeleting(false);

      if (dbError) {
        setError(getUserFacingError(dbError.message));
        toastError("Delete didn’t work.");
        return;
      }

      const removedId = deleteTarget.id;
      closeDeleteModal();
      toastSuccess("Delete was ok.");
      setRemovingId(removedId);

      setTimeout(() => {
        setEvents((prev) => prev.filter((item) => item.id !== removedId));
        setAllEvents((prev) => prev.filter((item) => item.id !== removedId));
        setRemovingId(null);
      }, 380);
    } catch (err) {
      setDeleting(false);
      setError(getUserFacingError(err.message));
      toastError("Delete didn’t work.");
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
    const hourOffset = Math.floor(y / HOUR_HEIGHT);
    const hour = Math.min(DAY_START_HOUR + hourOffset, DAY_END_HOUR);
    openAddModal(`${String(hour).padStart(2, "0")}:00`);
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
        className={`calendar__week animate-in animate-in--2${viewMode === "month" ? " calendar__week--month" : ""}`}
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
        <div className="calendar__loading">
          <span className="calendar__spinner" aria-hidden="true" />
          <p className="calendar__empty">Loading events…</p>
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
              role="presentation"
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
                const style = eventStyle(event);
                if (!style) return null;

                const colorInfo =
                  EVENT_COLORS[event.color] ?? EVENT_COLORS.indigo;
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
                        className="calendar__event-action"
                        onClick={() => openEditModal(event)}
                        aria-label={`Edit ${event.title}`}
                      >
                        Edit
                      </button>
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
          {events.map((event) => (
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
                <span className="calendar__reminder-title">{event.title}</span>
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
                  <span>Title</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="Workout, meeting…"
                    required
                    autoComplete="off"
                  />
                </label>

                <label className="calendar__field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) =>
                      setForm({ ...form, event_date: e.target.value })
                    }
                    required
                  />
                </label>

                <div className="calendar__field-row">
                  <label className="calendar__field">
                    <span>Start</span>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) =>
                        setForm({ ...form, start_time: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label className="calendar__field">
                    <span>End</span>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) =>
                        setForm({ ...form, end_time: e.target.value })
                      }
                      required
                    />
                  </label>
                </div>

                <label className="calendar__field">
                  <span>Color</span>
                  <div
                    className="calendar__colors"
                    role="radiogroup"
                    aria-label="Event color"
                  >
                    {Object.entries(EVENT_COLORS).map(
                      ([key, { label, accent }]) => (
                        <button
                          key={key}
                          type="button"
                          className={`calendar__color${form.color === key ? " calendar__color--active" : ""}`}
                          style={{ "--swatch": accent }}
                          onClick={() => setForm({ ...form, color: key })}
                          aria-label={label}
                          aria-pressed={form.color === key}
                        />
                      ),
                    )}
                  </div>
                </label>

                <label className="calendar__field">
                  <span>Notes (optional)</span>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    placeholder="Reminder details…"
                  />
                </label>

                <div className="calendar__form-actions">
                  <button
                    type="button"
                    className="calendar__btn calendar__btn--ghost"
                    onClick={closeFormModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="calendar__btn calendar__btn--primary"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving…"
                      : editingEvent
                        ? "Save changes"
                        : "Add event"}
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
                  {deleting ? "Deleting…" : "Delete event"}
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
