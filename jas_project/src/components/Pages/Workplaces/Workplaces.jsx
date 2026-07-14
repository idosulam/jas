import "./Workplaces.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getSupabaseClient } from "../../../lib/superbase";
import { getUserFacingError, sanitizeText, sanitizeNumber } from "../../../lib/security";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";

const MODAL_EXIT_MS = 320;

const PRESET_COLORS = [
  "#fb923c", // orange
  "#a78bfa", // purple
  "#34d399", // green
  "#60a5fa", // blue
  "#f472b6", // pink
  "#fbbf24", // yellow
  "#f87171", // red
  "#2dd4bf", // teal
  "#818cf8", // indigo
  "#c084fc", // violet
];

const emptyForm = () => ({
  slug: "",
  label: "",
  rate: "",
  color: PRESET_COLORS[0],
});

function formatMoney(amount) {
  return `₪${Number(amount).toFixed(2)}`;
}

function Workplaces({ onNavigate, returnTo }) {
  const [workplaces, setWorkplaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateModalClosing, setDeactivateModalClosing] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const fetchWorkplaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("workplaces")
        .select("*")
        .order("created_at", { ascending: true });

      if (fetchError) {
        setError(getUserFacingError(fetchError.message));
        setWorkplaces([]);
      } else {
        setWorkplaces(data ?? []);
      }
    } catch (err) {
      setError(getUserFacingError(err.message));
      setWorkplaces([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchWorkplaces();
  }, [fetchWorkplaces]);

  const activeWorkplaces = useMemo(
    () => workplaces.filter((wp) => wp.active),
    [workplaces],
  );

  const inactiveWorkplaces = useMemo(
    () => workplaces.filter((wp) => !wp.active),
    [workplaces],
  );

  const openAddModal = () => {
    setEditing(null);
    setForm(emptyForm());
    setFieldErrors({});
    setModalClosing(false);
    setModalOpen(true);
  };

  const openEditModal = (wp) => {
    setEditing(wp);
    setForm({
      slug: wp.slug,
      label: wp.label,
      rate: String(wp.rate),
      color: wp.color,
    });
    setFieldErrors({});
    setModalClosing(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalClosing(true);
    setTimeout(() => {
      setModalOpen(false);
      setModalClosing(false);
      setEditing(null);
      setForm(emptyForm());
    }, MODAL_EXIT_MS);
  };

  const validateField = (name, value) => {
    switch (name) {
      case "slug": {
        if (!value.trim()) return "Slug is required";
        if (!/^[a-z0-9_-]+$/.test(value.trim()))
          return "Lowercase letters, numbers, hyphens, underscores only";
        if (
          !editing &&
          workplaces.some((wp) => wp.slug === value.trim())
        )
          return "This slug already exists";
        return null;
      }
      case "label": {
        if (!value.trim()) return "Name is required";
        if (value.trim().length > 60) return "Max 60 characters";
        return null;
      }
      case "rate": {
        const n = parseFloat(value);
        if (!value || isNaN(n) || n < 0) return "Enter a valid rate";
        if (n > 99999) return "Rate too high";
        return null;
      }
      default:
        return null;
    }
  };

  const handleFieldBlur = (name) => {
    const err = validateField(name, form[name]);
    setFieldErrors((prev) => ({ ...prev, [name]: err }));
  };

  const isFormValid = useMemo(() => {
    if (!form.slug.trim()) return false;
    if (!/^[a-z0-9_-]+$/.test(form.slug.trim())) return false;
    if (!editing && workplaces.some((wp) => wp.slug === form.slug.trim()))
      return false;
    if (!form.label.trim()) return false;
    const rate = parseFloat(form.rate);
    if (!form.rate || isNaN(rate) || rate < 0) return false;
    return true;
  }, [form, editing, workplaces]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    setSaving(true);
    setError(null);

    const slug = sanitizeText(form.slug, 40).toLowerCase().trim();
    const label = sanitizeText(form.label, 60).trim();
    const rate = Number(sanitizeNumber(form.rate, 0, 99999));
    const color = form.color;

    try {
      const supabase = getSupabaseClient();
      let dbError;

      if (editing) {
        ({ error: dbError } = await supabase
          .from("workplaces")
          .update({ label, rate, color })
          .eq("id", editing.id));
      } else {
        ({ error: dbError } = await supabase
          .from("workplaces")
          .insert({ slug, label, rate, color }));
      }

      setSaving(false);

      if (dbError) {
        const message = getUserFacingError(dbError.message);
        setError(message);
        toastError(editing ? "Couldn't update workplace." : "Couldn't create workplace.");
        return;
      }

      closeModal();
      toastSuccess(editing ? "Workplace updated." : "Workplace created.");
      fetchWorkplaces();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError(editing ? "Couldn't update workplace." : "Couldn't create workplace.");
    }
  };

  const openDeactivateModal = (wp) => {
    setDeactivateModalClosing(false);
    setDeactivateTarget(wp);
  };

  const closeDeactivateModal = () => {
    setDeactivateModalClosing(true);
    setTimeout(() => {
      setDeactivateTarget(null);
      setDeactivateModalClosing(false);
    }, MODAL_EXIT_MS);
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;

    setDeactivating(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("workplaces")
        .update({ active: false })
        .eq("id", deactivateTarget.id);

      setDeactivating(false);

      if (dbError) {
        setError(getUserFacingError(dbError.message));
        toastError("Failed to deactivate workplace.");
        return;
      }

      closeDeactivateModal();
      toastSuccess("Workplace deactivated.");
      fetchWorkplaces();
    } catch (err) {
      setDeactivating(false);
      setError(getUserFacingError(err.message));
      toastError("Failed to deactivate workplace.");
    }
  };

  const reactivateWorkplace = async (wp) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("workplaces")
        .update({ active: true })
        .eq("id", wp.id);

      if (dbError) {
        setError(getUserFacingError(dbError.message));
        toastError("Failed to reactivate workplace.");
        return;
      }

      toastSuccess(`${wp.label} reactivated.`);
      fetchWorkplaces();
    } catch (err) {
      setError(getUserFacingError(err.message));
      toastError("Failed to reactivate workplace.");
    }
  };

  return (
    <section className="workplaces page">
      <header className="workplaces__header animate-in">
        {onNavigate && (
          <button
            type="button"
            className="workplaces__back-btn"
            onClick={() => onNavigate(returnTo || "Shifts")}
          >
            ← Back to {returnTo || "Shifts"}
          </button>
        )}
        <p className="page__eyebrow">Settings</p>
        <h1 className="page__title">Workplaces</h1>
        <p className="page__subtitle">
          Manage your workplaces, pay rates, and colors.
        </p>
      </header>

      {error && (
        <p className="workplaces__error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="workplaces__list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton--card" style={{ height: "5rem" }} />
          ))}
        </div>
      ) : (
        <>
          <div className="workplaces__list animate-in animate-in--1">
            {activeWorkplaces.length === 0 ? (
              <div className="workplaces__empty glass-card">
                <p className="workplaces__empty-text">No workplaces yet.</p>
                <p className="workplaces__empty-hint">
                  Add your first workplace to start tracking shifts.
                </p>
              </div>
            ) : (
              activeWorkplaces.map((wp) => (
                <div key={wp.id} className="workplaces__card glass-card">
                  <div className="workplaces__card-left">
                    <span
                      className="workplaces__color-dot"
                      style={{ background: wp.color }}
                      aria-hidden="true"
                    />
                    <div className="workplaces__card-info">
                      <span className="workplaces__card-label">{wp.label}</span>
                      <span className="workplaces__card-slug">{wp.slug}</span>
                    </div>
                  </div>
                  <div className="workplaces__card-right">
                    <span className="workplaces__card-rate">{formatMoney(wp.rate)}/hr</span>
                    <div className="workplaces__card-actions">
                      <button
                        type="button"
                        className="workplaces__action workplaces__action--edit"
                        onClick={() => openEditModal(wp)}
                        aria-label={`Edit ${wp.label}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="workplaces__action workplaces__action--deactivate"
                        onClick={() => openDeactivateModal(wp)}
                        aria-label={`Deactivate ${wp.label}`}
                      >
                        Deactivate
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {inactiveWorkplaces.length > 0 && (
            <div className="workplaces__section animate-in animate-in--2">
              <h2 className="workplaces__section-title">Inactive</h2>
              <div className="workplaces__list">
                {inactiveWorkplaces.map((wp) => (
                  <div key={wp.id} className="workplaces__card workplaces__card--inactive glass-card">
                    <div className="workplaces__card-left">
                      <span
                        className="workplaces__color-dot workplaces__color-dot--inactive"
                        style={{ background: wp.color }}
                        aria-hidden="true"
                      />
                      <div className="workplaces__card-info">
                        <span className="workplaces__card-label">{wp.label}</span>
                        <span className="workplaces__card-slug">{wp.slug}</span>
                      </div>
                    </div>
                    <div className="workplaces__card-right">
                      <span className="workplaces__card-rate">{formatMoney(wp.rate)}/hr</span>
                      <button
                        type="button"
                        className="workplaces__action workplaces__action--reactivate"
                        onClick={() => reactivateWorkplace(wp)}
                      >
                        Reactivate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="workplaces__add-row animate-in animate-in--2">
            <button
              type="button"
              className="workplaces__add-btn"
              onClick={openAddModal}
            >
              + Add workplace
            </button>
          </div>
        </>
      )}

      {modalOpen &&
        createPortal(
          <div
            className={`workplaces__overlay${modalClosing ? " workplaces__overlay--closing" : ""}`}
            onClick={closeModal}
          >
            <div
              className={`workplaces__modal${modalClosing ? " workplaces__modal--closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="workplace-modal-title"
            >
              <h2 id="workplace-modal-title" className="workplaces__modal-title">
                {editing ? "Edit workplace" : "Add workplace"}
              </h2>

              <form className="workplaces__form" onSubmit={handleSubmit}>
                <label className="workplaces__field">
                  <span>
                    Slug (ID){" "}
                    {fieldErrors.slug && (
                      <span className="workplaces__field-error">—{fieldErrors.slug}</span>
                    )}
                  </span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => {
                      setForm({ ...form, slug: e.target.value.toLowerCase() });
                      setFieldErrors((prev) => ({ ...prev, slug: null }));
                    }}
                    onBlur={() => handleFieldBlur("slug")}
                    placeholder="e.g. warehouse, bar"
                    className={fieldErrors.slug ? "workplaces__field-input--error" : ""}
                    disabled={!!editing}
                    required
                    autoComplete="off"
                  />
                  {editing && (
                    <span className="workplaces__field-hint">Slug cannot be changed.</span>
                  )}
                </label>

                <label className="workplaces__field">
                  <span>
                    Display name{" "}
                    {fieldErrors.label && (
                      <span className="workplaces__field-error">—{fieldErrors.label}</span>
                    )}
                  </span>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => {
                      setForm({ ...form, label: e.target.value });
                      setFieldErrors((prev) => ({ ...prev, label: null }));
                    }}
                    onBlur={() => handleFieldBlur("label")}
                    placeholder="e.g. Warehouse, The Bar"
                    className={fieldErrors.label ? "workplaces__field-input--error" : ""}
                    required
                    autoComplete="off"
                  />
                </label>

                <label className="workplaces__field">
                  <span>
                    Hourly rate (₪){" "}
                    {fieldErrors.rate && (
                      <span className="workplaces__field-error">—{fieldErrors.rate}</span>
                    )}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.rate}
                    onChange={(e) => {
                      setForm({ ...form, rate: e.target.value });
                      setFieldErrors((prev) => ({ ...prev, rate: null }));
                    }}
                    onBlur={() => handleFieldBlur("rate")}
                    placeholder="e.g. 50"
                    className={fieldErrors.rate ? "workplaces__field-input--error" : ""}
                    required
                  />
                </label>

                <label className="workplaces__field">
                  <span>Color</span>
                  <div className="workplaces__colors" role="radiogroup" aria-label="Workplace color">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`workplaces__color-btn${form.color === c ? " workplaces__color-btn--active" : ""}`}
                        style={{ "--swatch": c }}
                        onClick={() => setForm({ ...form, color: c })}
                        aria-label={c}
                        aria-pressed={form.color === c}
                      />
                    ))}
                  </div>
                </label>

                <div className="workplaces__form-actions">
                  <button
                    type="button"
                    className="workplaces__btn workplaces__btn--ghost"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="workplaces__btn workplaces__btn--primary"
                    disabled={saving || !isFormValid}
                  >
                    {saving ? (
                      <>
                        <span className="workplaces__btn-spinner" aria-hidden="true" />
                        Saving…
                      </>
                    ) : editing ? (
                      "Save changes"
                    ) : (
                      "Add workplace"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {deactivateTarget &&
        createPortal(
          <div
            className={`workplaces__overlay${deactivateModalClosing ? " workplaces__overlay--closing" : ""}`}
            onClick={closeDeactivateModal}
          >
            <div
              className={`workplaces__modal workplaces__modal--compact${deactivateModalClosing ? " workplaces__modal--closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="deactivate-title"
            >
              <h2 id="deactivate-title" className="workplaces__modal-title">
                Deactivate {deactivateTarget.label}?
              </h2>
              <p className="workplaces__deactivate-desc">
                This workplace will be hidden from shift forms. Existing shifts
                using it will keep their data. You can reactivate it anytime.
              </p>
              <div className="workplaces__form-actions">
                <button
                  type="button"
                  className="workplaces__btn workplaces__btn--ghost"
                  onClick={closeDeactivateModal}
                  disabled={deactivating}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="workplaces__btn workplaces__btn--danger"
                  onClick={confirmDeactivate}
                  disabled={deactivating}
                >
                  {deactivating ? "Deactivating…" : "Deactivate"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}

export default Workplaces;
