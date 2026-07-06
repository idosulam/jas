import "./Shifts.css";
import "./shifts_glassy.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseClient } from "../../../lib/superbase";
import {
  getUserFacingError,
  sanitizeDate,
  sanitizeNumber,
  sanitizeText,
} from "../../../lib/security";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";

const PLACES = {
  pasta: { label: "Pasta Via", rate: 50 },
  coffee: { label: "Cafe Nimrod", rate: 34 },
};

const PLACE_FILTERS = [
  { id: "all", label: "All" },
  { id: "pasta", label: "Pasta Via" },
  { id: "coffee", label: "Cafe Nimrod" },
];

const PAY_TYPES = [
  { id: "hourly", label: "Hourly + tips" },
  { id: "tips_only", label: "Tips only" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MODAL_EXIT_MS = 260;

const emptyForm = () => ({
  place: "pasta",
  pay_type: "hourly",
  shift_date: new Date().toISOString().slice(0, 10),
  start_time: "",
  end_time: "",
  hours: "",
  tips: "",
  notes: "",
});

function parseTimeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function calculateHoursFromTimes(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return null;
  const diffMinutes = end >= start ? end - start : 24 * 60 - start + end;
  return Number((diffMinutes / 60).toFixed(2));
}

function calcPay(place, hours, payType = "hourly") {
  if (payType === "tips_only") return 0;
  return (PLACES[place]?.rate ?? 0) * (parseFloat(hours) || 0);
}

function formatMoney(amount) {
  return `₪${amount.toFixed(2)}`;
}

function Shifts() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [placeFilter, setPlaceFilter] = useState("all");
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formModalClosing, setFormModalClosing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteModalClosing, setDeleteModalClosing] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [editingShift, setEditingShift] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const addBtnRef = useRef(null);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  function useCountUp(value, duration = 500) {
    const [display, setDisplay] = useState(value);
    const prevRef = useRef(value);
    useEffect(() => {
      const from = prevRef.current;
      const to = value;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        setDisplay(from + (to - from) * eased);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      prevRef.current = value;
    }, [value]);
    return display;
  }

  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 101 }, (_, i) => current + i);
  }, []);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("shifts")
        .select("*")
        .gte("shift_date", startDate)
        .lte("shift_date", endDate)
        .order("shift_date", { ascending: true });

      if (fetchError) {
        setError(getUserFacingError(fetchError.message));
        setShifts([]);
      } else {
        setShifts(data ?? []);
      }
    } catch (err) {
      setError(getUserFacingError(err.message));
      setShifts([]);
    }
    setLoading(false);
  }, [month, year]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

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

  const filteredShifts = useMemo(() => {
    if (placeFilter === "all") return shifts;
    return shifts.filter((shift) => shift.place === placeFilter);
  }, [shifts, placeFilter]);

  const totals = useMemo(() => {
    return filteredShifts.reduce(
      (acc, shift) => {
        const pay = calcPay(shift.place, shift.hours, shift.pay_type);
        const tips = parseFloat(shift.tips) || 0;
        acc.hours += parseFloat(shift.hours) || 0;
        acc.pay += pay;
        acc.tips += tips;
        acc.total += pay + tips;
        return acc;
      },
      { hours: 0, pay: 0, tips: 0, total: 0 },
    );
  }, [filteredShifts]);

  const openAddModal = () => {
    setEditingShift(null);
    setForm(emptyForm());
    setFormModalClosing(false);
    setModalOpen(true);
  };

  const openEditModal = (shift) => {
    setEditingShift(shift);
    setForm({
      place: shift.place,
      pay_type: shift.pay_type === "tips_only" ? "tips_only" : "hourly",
      shift_date: shift.shift_date,
      start_time: shift.start_time ?? "",
      end_time: shift.end_time ?? "",
      hours: String(shift.hours),
      tips: shift.tips ? String(shift.tips) : "",
      notes: shift.notes ?? "",
    });
    setFormModalClosing(false);
    setModalOpen(true);
  };

  const closeFormModal = () => {
    setFormModalClosing(true);
    setTimeout(() => {
      setModalOpen(false);
      setFormModalClosing(false);
      setEditingShift(null);
      setForm(emptyForm());
    }, MODAL_EXIT_MS);
  };

  const handleTimeChange = (field, value) => {
    const nextForm = { ...form, [field]: value };
    const computedHours = calculateHoursFromTimes(
      nextForm.start_time,
      nextForm.end_time,
    );
    if (computedHours != null) {
      nextForm.hours = String(computedHours);
    }
    setForm(nextForm);
  };

  const openDeleteModal = (shift) => {
    setDeleteModalClosing(false);
    setDeleteTarget(shift);
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

    const shiftDate = sanitizeDate(
      form.shift_date,
      new Date().toISOString().slice(0, 10),
    );
    const hours = sanitizeNumber(form.hours, 0.01, 24);
    const tips = sanitizeNumber(form.tips, 0, 10000) ?? 0;
    const notes = form.notes.trim() ? sanitizeText(form.notes, 500) : null;

    if (!shiftDate || !form.place || !hours || hours <= 0) {
      setError("Please fill in place, date, and valid hours.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      place: ["pasta", "coffee"].includes(form.place) ? form.place : "pasta",
      pay_type: form.pay_type === "tips_only" ? "tips_only" : "hourly",
      shift_date: shiftDate,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      hours: Number(hours.toFixed(2)),
      tips: Number(tips.toFixed(2)),
      notes,
    };

    try {
      const supabase = getSupabaseClient();
      let dbError;
      if (editingShift) {
        ({ error: dbError } = await supabase
          .from("shifts")
          .update(payload)
          .eq("id", editingShift.id));
      } else {
        ({ error: dbError } = await supabase.from("shifts").insert(payload));
      }

      setSaving(false);

      if (dbError) {
        const message = getUserFacingError(dbError.message);
        setError(message);
        toastError(editingShift ? "Edit didn’t work." : "Upload shift didn’t work.");
        return;
      }

      closeFormModal();
      toastSuccess(editingShift ? "Edit was ok." : "Upload shift was ok.");
      fetchShifts();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError(editingShift ? "Edit didn’t work." : "Upload shift didn’t work.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("shifts")
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
        setShifts((prev) => prev.filter((s) => s.id !== removedId));
        setRemovingId(null);
      }, 380);
    } catch (err) {
      setDeleting(false);
      setError(getUserFacingError(err.message));
      toastError("Delete didn’t work.");
    }
  };

  const previewPay = calcPay(form.place, form.hours, form.pay_type);

  const deletePay = deleteTarget
    ? calcPay(deleteTarget.place, deleteTarget.hours, deleteTarget.pay_type)
    : 0;
  const deleteTips = deleteTarget ? parseFloat(deleteTarget.tips) || 0 : 0;
  const deletePlaceInfo = deleteTarget ? PLACES[deleteTarget.place] : null;

  return (
    <section className="shifts page">
      <header className="shifts__header animate-in">
        <p className="page__eyebrow">Earnings tracker</p>
        <h1 className="page__title">Shifts</h1>
      </header>

      <div className="shifts__filters animate-in animate-in--1">
        <label className="shifts__filter">
          <span>Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="shifts__filter">
          <span>Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="shifts__place-filter animate-in animate-in--2"
        role="group"
        aria-label="Filter by place"
      >
        {PLACE_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`shifts__place-btn${placeFilter === id ? " shifts__place-btn--active" : ""}${id !== "all" ? ` shifts__place-btn--${id}` : ""}`}
            onClick={() => setPlaceFilter(id)}
            aria-pressed={placeFilter === id}
          >
            {label}
          </button>
        ))}
        <span
          className={`shifts__place-indicator shifts__place-indicator--${placeFilter}`}
          aria-hidden="true"
        />
      </div>

      <div
        className="shifts__summary animate-in animate-in--3"
        key={`${month}-${year}-${placeFilter}`}
      >
        <div className="glass-card shifts__stat">
          <span className="glass-card__value">{totals.hours.toFixed(1)}h</span>
          <span className="glass-card__label">Hours</span>
        </div>
        <div className="glass-card shifts__stat">
          <span className="glass-card__value">{formatMoney(totals.pay)}</span>
          <span className="glass-card__label">Pay</span>
        </div>
        <div className="glass-card shifts__stat">
          <span className="glass-card__value">{formatMoney(totals.tips)}</span>
          <span className="glass-card__label">Tips</span>
        </div>
        <div className="glass-card shifts__stat shifts__stat--total">
          <span className="glass-card__value">{formatMoney(totals.total)}</span>
          <span className="glass-card__label">Total</span>
        </div>
      </div>

      {error && (
        <p className="shifts__error shifts__error--shake" role="alert">
          {error}
        </p>
      )}

      <div className="shifts__list-header animate-in animate-in--4">
        <h2 className="shifts__list-title">
          {MONTHS[month]} {year}
          {placeFilter !== "all" && (
            <span className="shifts__list-subtitle">
              {" "}
              · {PLACES[placeFilter]?.label}
            </span>
          )}
        </h2>
        <button
          type="button"
          className="shifts__add-btn"
          onClick={openAddModal}
          ref={addBtnRef}
        >
          + Add shift
        </button>
      </div>

      {loading ? (
        <div className="shifts__loading">
          <span className="shifts__spinner" aria-hidden="true" />
          <p className="shifts__empty">Loading shifts…</p>
        </div>
      ) : filteredShifts.length === 0 ? (
        <p
          className="shifts__empty shifts__empty--fade glass-card shifts__stat"
          key={`empty-${placeFilter}`}
        >
          {placeFilter === "all"
            ? "No shifts this month. Add one to get started."
            : `No ${PLACES[placeFilter]?.label} shifts this month.`}
        </p>
      ) : (
        <ul className="shifts__list" key={`list-${placeFilter}`}>
          {filteredShifts.map((shift, index) => {
            const pay = calcPay(shift.place, shift.hours, shift.pay_type);
            const tips = parseFloat(shift.tips) || 0;
            const placeInfo = PLACES[shift.place];
            const isRemoving = removingId === shift.id;
            const isTipsOnly = shift.pay_type === "tips_only";

            return (
              <li
                key={shift.id}
                className={`shifts__card${isRemoving ? " shifts__card--removing" : ""}`}
                style={{ "--card-delay": `${index * 0.06}s` }}
              >
                <div className="shifts__card-main">
                  <div className="shifts__card-top">
                    <span
                      className={`shifts__badge shifts__badge--${shift.place}`}
                    >
                      {placeInfo?.label ?? shift.place}
                    </span>
                    <div className="shifts__card-top-right">
                      <span className="shifts__date">{shift.shift_date}</span>
                      {shift.notes && (
                        <button
                          type="button"
                          className={`shifts__note-toggle${expandedNoteId === shift.id ? " shifts__note-toggle--active" : ""}`}
                          onClick={() =>
                            setExpandedNoteId(
                              expandedNoteId === shift.id ? null : shift.id,
                            )
                          }
                          aria-expanded={expandedNoteId === shift.id}
                          aria-label={
                            expandedNoteId === shift.id
                              ? "Hide note"
                              : "View note"
                          }
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            aria-hidden="true"
                          >
                            <path
                              d="M21 12c0 4.418-4.03 8-9 8-1.06 0-2.07-.16-3-.46L3 21l1.5-4.5C3.55 15.13 3 13.62 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="shifts__card-details">
                    {isTipsOnly ? (
                      <span className="shifts__tips-only-tag">Tips only</span>
                    ) : (
                      <>
                        <span>
                          {shift.hours}h × ₪{placeInfo?.rate}
                        </span>
                        <span>Pay {formatMoney(pay)}</span>
                      </>
                    )}
                    {tips > 0 && <span>Tips {formatMoney(tips)}</span>}
                    <span className="shifts__card-total">
                      {formatMoney(pay + tips)}
                    </span>
                  </div>
                  {shift.notes && expandedNoteId === shift.id && (
                    <p className="shifts__note-panel">{shift.notes}</p>
                  )}
                </div>
                <div className="shifts__card-actions">
                  <button
                    type="button"
                    className="shifts__action shifts__action--edit"
                    onClick={() => openEditModal(shift)}
                    aria-label="Edit shift"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="shifts__action shifts__action--delete"
                    onClick={() => openDeleteModal(shift)}
                    aria-label="Delete shift"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen &&
        createPortal(
          <div
            className={`shifts__overlay${formModalClosing ? " shifts__overlay--closing" : ""}`}
            onClick={closeFormModal}
          >
            <div
              className={`shifts__modal${formModalClosing ? " shifts__modal--closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="shift-modal-title"
            >
              <h2 id="shift-modal-title" className="shifts__modal-title">
                {editingShift ? "Edit shift" : "Add shift"}
              </h2>

              <form className="shifts__form" onSubmit={handleSubmit}>
                <label className="shifts__field">
                  <span>Place</span>
                  <select
                    value={form.place}
                    onChange={(e) =>
                      setForm({ ...form, place: e.target.value })
                    }
                  >
                    {Object.entries(PLACES).map(([key, { label, rate }]) => (
                      <option key={key} value={key}>
                        {label} — ₪{rate}/hr
                      </option>
                    ))}
                  </select>
                </label>

                <div
                  className="shifts__pay-toggle"
                  role="group"
                  aria-label="Pay type"
                >
                  {PAY_TYPES.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={`shifts__pay-toggle-btn${form.pay_type === id ? " shifts__pay-toggle-btn--active" : ""}`}
                      onClick={() => setForm({ ...form, pay_type: id })}
                      aria-pressed={form.pay_type === id}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="shifts__field">
                  <span>Date</span>
                  <input
                    type="date"
                    value={form.shift_date}
                    onChange={(e) =>
                      setForm({ ...form, shift_date: e.target.value })
                    }
                    required
                  />
                </label>

                <div className="shifts__time-row">
                  <label className="shifts__field">
                    <span>Start time</span>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) =>
                        handleTimeChange("start_time", e.target.value)
                      }
                    />
                  </label>
                  <label className="shifts__field">
                    <span>End time</span>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) =>
                        handleTimeChange("end_time", e.target.value)
                      }
                    />
                  </label>
                </div>

                <label className="shifts__field">
                  <span>Hours</span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="e.g. 6"
                    value={form.hours}
                    onChange={(e) =>
                      setForm({ ...form, hours: e.target.value })
                    }
                    required
                  />
                </label>

                <label className="shifts__field">
                  <span>
                    Tips{form.pay_type === "tips_only" ? "" : " (optional)"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={form.tips}
                    onChange={(e) => setForm({ ...form, tips: e.target.value })}
                  />
                </label>

                <label className="shifts__field">
                  <span>Notes (optional)</span>
                  <textarea
                    placeholder="e.g. Covered for Dana, closed the register"
                    value={form.notes}
                    maxLength={500}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </label>

                {form.hours && (
                  <p className="shifts__preview shifts__preview--pop">
                    {form.pay_type === "tips_only" ? (
                      <>
                        Tips only shift — total{" "}
                        <strong>
                          {formatMoney(parseFloat(form.tips) || 0)}
                        </strong>
                      </>
                    ) : (
                      <>
                        Estimated pay:{" "}
                        <strong>{formatMoney(previewPay)}</strong>
                        {form.tips && (
                          <>
                            {" "}
                            + tips {formatMoney(
                              parseFloat(form.tips) || 0,
                            )} ={" "}
                            <strong>
                              {formatMoney(
                                previewPay + (parseFloat(form.tips) || 0),
                              )}
                            </strong>
                          </>
                        )}
                      </>
                    )}
                  </p>
                )}

                <div className="shifts__form-actions">
                  <button
                    type="button"
                    className="shifts__btn shifts__btn--ghost"
                    onClick={closeFormModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="shifts__btn shifts__btn--primary"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving…"
                      : editingShift
                        ? "Save changes"
                        : "Add shift"}
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
            className={`shifts__overlay shifts__overlay--delete${deleteModalClosing ? " shifts__overlay--closing" : ""}`}
            onClick={closeDeleteModal}
          >
            <div
              className={`shifts__modal shifts__modal--delete${deleteModalClosing ? " shifts__modal--closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
              aria-describedby="delete-modal-desc"
            >
              <div className="shifts__delete-icon" aria-hidden="true">
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

              <h2
                id="delete-modal-title"
                className="shifts__modal-title shifts__modal-title--delete"
              >
                Delete this shift?
              </h2>

              <p id="delete-modal-desc" className="shifts__delete-desc">
                This action cannot be undone.
              </p>

              <div className="shifts__delete-preview">
                <span
                  className={`shifts__badge shifts__badge--${deleteTarget.place}`}
                >
                  {deletePlaceInfo?.label}
                </span>
                <span className="shifts__delete-date">
                  {deleteTarget.shift_date}
                </span>
                <span className="shifts__delete-amount">
                  {formatMoney(deletePay + deleteTips)}
                </span>
              </div>

              <div className="shifts__form-actions">
                <button
                  type="button"
                  className="shifts__btn shifts__btn--ghost"
                  onClick={closeDeleteModal}
                  disabled={deleting}
                >
                  Keep it
                </button>
                <button
                  type="button"
                  className="shifts__btn shifts__btn--danger"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete shift"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {showFloatingActions &&
        createPortal(
          <div className="shifts__fab-stack">
            <button
              type="button"
              className="shifts__fab shifts__fab--up"
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
              className="shifts__fab shifts__fab--add"
              onClick={openAddModal}
              aria-label="Add shift"
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

export default Shifts;
