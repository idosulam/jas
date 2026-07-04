import "./Shifts.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import {
  getUserFacingError,
  sanitizeDate,
  sanitizeNumber,
  sanitizeText,
} from "../../../lib/security";

const PLACES = {
  pasta: { label: "Pasta Via", rate: 50 },
  coffee: { label: "Cafe Nimrod", rate: 34 },
};

const PLACE_FILTERS = [
  { id: "all", label: "All" },
  { id: "pasta", label: "Pasta Via" },
  { id: "coffee", label: "Cafe Nimrod" },
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
  shift_date: new Date().toISOString().slice(0, 10),
  hours: "",
  tips: "",
});

function calcPay(place, hours) {
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

  const filteredShifts = useMemo(() => {
    if (placeFilter === "all") return shifts;
    return shifts.filter((shift) => shift.place === placeFilter);
  }, [shifts, placeFilter]);

  const totals = useMemo(() => {
    return filteredShifts.reduce(
      (acc, shift) => {
        const pay = calcPay(shift.place, shift.hours);
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
      shift_date: shift.shift_date,
      hours: String(shift.hours),
      tips: shift.tips ? String(shift.tips) : "",
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

    if (!shiftDate || !form.place || !hours || hours <= 0) {
      setError("Please fill in place, date, and valid hours.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      place: ["pasta", "coffee"].includes(form.place) ? form.place : "pasta",
      shift_date: shiftDate,
      hours: Number(hours.toFixed(2)),
      tips: Number(tips.toFixed(2)),
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
        setError(getUserFacingError(dbError.message));
        return;
      }

      closeFormModal();
      fetchShifts();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
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
        return;
      }

      const removedId = deleteTarget.id;
      closeDeleteModal();
      setRemovingId(removedId);

      setTimeout(() => {
        setShifts((prev) => prev.filter((s) => s.id !== removedId));
        setRemovingId(null);
      }, 380);
    } catch (err) {
      setDeleting(false);
      setError(getUserFacingError(err.message));
    }
  };

  const previewPay = calcPay(form.place, form.hours);

  const deletePay = deleteTarget
    ? calcPay(deleteTarget.place, deleteTarget.hours)
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
          className="shifts__empty shifts__empty--fade"
          key={`empty-${placeFilter}`}
        >
          {placeFilter === "all"
            ? "No shifts this month. Add one to get started."
            : `No ${PLACES[placeFilter]?.label} shifts this month.`}
        </p>
      ) : (
        <ul className="shifts__list" key={`list-${placeFilter}`}>
          {filteredShifts.map((shift, index) => {
            const pay = calcPay(shift.place, shift.hours);
            const tips = parseFloat(shift.tips) || 0;
            const placeInfo = PLACES[shift.place];
            const isRemoving = removingId === shift.id;

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
                    <span className="shifts__date">{shift.shift_date}</span>
                  </div>
                  <div className="shifts__card-details">
                    <span>
                      {shift.hours}h × ₪{placeInfo?.rate}
                    </span>
                    <span>Pay {formatMoney(pay)}</span>
                    {tips > 0 && <span>Tips {formatMoney(tips)}</span>}
                    <span className="shifts__card-total">
                      {formatMoney(pay + tips)}
                    </span>
                  </div>
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

      {modalOpen && (
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
                  onChange={(e) => setForm({ ...form, place: e.target.value })}
                >
                  {Object.entries(PLACES).map(([key, { label, rate }]) => (
                    <option key={key} value={key}>
                      {label} — ₪{rate}/hr
                    </option>
                  ))}
                </select>
              </label>

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

              <label className="shifts__field">
                <span>Hours</span>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  placeholder="e.g. 6"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  required
                />
              </label>

              <label className="shifts__field">
                <span>Tips (optional)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={form.tips}
                  onChange={(e) => setForm({ ...form, tips: e.target.value })}
                />
              </label>

              {form.hours && (
                <p className="shifts__preview shifts__preview--pop">
                  Estimated pay: <strong>{formatMoney(previewPay)}</strong>
                  {form.tips && (
                    <>
                      {" "}
                      + tips {formatMoney(parseFloat(form.tips) || 0)} ={" "}
                      <strong>
                        {formatMoney(previewPay + (parseFloat(form.tips) || 0))}
                      </strong>
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
        </div>
      )}

      {deleteTarget && (
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
        </div>
      )}
    </section>
  );
}

export default Shifts;
