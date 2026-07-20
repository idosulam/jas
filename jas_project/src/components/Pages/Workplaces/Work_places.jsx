import "./Work_places.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase.jsx";
import { useUserId } from "../../../lib/Auth_context.jsx";
import {
  getUserFacingError,
  sanitizeText,
  sanitizeNumber,
} from "../../../lib/security.js";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import {
  SheetModal,
  FormField,
  PageHeader,
  ConfirmModal,
  EmptyState,
  LoadingSkeleton,
} from "../../index.js";
import { useBodyScrollLock, useModal } from "../../../hooks/index.js";
import { TrashIcon } from "../../../components/ui/modals/Confirm_modal";

const emptyForm = () => ({
  slug: "",
  label: "",
  rate: "",
  color: "#818cf8",
});

function formatMoney(amount) {
  return `₪${Number(amount).toFixed(2)}`;
}

function Workplaces({ onNavigate, returnTo }) {
  const userId = useUserId();
  const [workplaces, setWorkplaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldStates, setFieldStates] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const colorPickerRef = useRef(null);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const formModal = useModal(320);
  const deactivateModal = useModal(320);
  const deleteModal = useModal(320);

  useBodyScrollLock(formModal.open, deactivateTarget, deleteTarget);

  const fetchWorkplaces = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("workplaces")
        .select("*")
        .eq("user_id", userId)
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
  }, [userId]);

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
    setFieldStates({});
    formModal.openModal();
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
    setFieldStates({});
    formModal.openModal();
  };

  const closeModal = () => {
    formModal.closeModal();
    setTimeout(() => {
      setEditing(null);
      setForm(emptyForm());
      setFieldStates({});
    }, 320);
  };

  const validateField = (name, value) => {
    switch (name) {
      case "slug": {
        if (!value.trim()) return "Slug is required";
        if (!/^[a-z0-9_-]+$/.test(value.trim()))
          return "Lowercase letters, numbers, hyphens, underscores only";
        if (!editing && workplaces.some((wp) => wp.slug === value.trim()))
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
    setFieldStates((prev) => ({
      ...prev,
      [name]: err ? "error" : form[name] ? "valid" : "idle",
    }));
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
    if (!isFormValid) {
      // Trigger validation display for all fields
      const errors = {};
      const states = {};
      ["slug", "label", "rate"].forEach((name) => {
        const err = validateField(name, form[name]);
        if (err) {
          errors[name] = err;
          states[name] = "error";
        } else if (form[name]) {
          states[name] = "valid";
        }
      });
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      setFieldStates((prev) => ({ ...prev, ...states }));
      setShakeKey((k) => k + 1);
      return;
    }

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
        ({ error: dbError } = await supabase.from("workplaces").insert({
          slug,
          label,
          rate,
          color,
          ...(userId && { user_id: userId }),
        }));
      }

      setSaving(false);

      if (dbError) {
        const message = getUserFacingError(dbError.message);
        setError(message);
        toastError(
          editing ? "Couldn't update workplace." : "Couldn't create workplace.",
        );
        return;
      }

      closeModal();
      toastSuccess(editing ? "Workplace updated." : "Workplace created.");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("shifts:refresh"));
        window.dispatchEvent(new CustomEvent("calendar:refresh"));
      }

      fetchWorkplaces();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError(
        editing ? "Couldn't update workplace." : "Couldn't create workplace.",
      );
    }
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

      deactivateModal.closeModal();
      setTimeout(() => setDeactivateTarget(null), 320);
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const { error: shiftsDeleteError } = await supabase
        .from("shifts")
        .delete()
        .eq("place", deleteTarget.slug);

      if (shiftsDeleteError) {
        setDeleting(false);
        setError(getUserFacingError(shiftsDeleteError.message));
        toastError("Failed to delete associated shifts.");
        return;
      }

      const { error: dbError } = await supabase
        .from("workplaces")
        .delete()
        .eq("id", deleteTarget.id);

      setDeleting(false);

      if (dbError) {
        setError(getUserFacingError(dbError.message));
        toastError("Failed to delete workplace.");
        return;
      }

      deleteModal.closeModal();
      setTimeout(() => setDeleteTarget(null), 320);
      toastSuccess(`${deleteTarget.label} and all its shifts deleted.`);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("shifts:refresh"));
        window.dispatchEvent(new CustomEvent("calendar:refresh"));
      }
      fetchWorkplaces();
    } catch (err) {
      setDeleting(false);
      setError(getUserFacingError(err.message));
      toastError("Failed to delete workplace.");
    }
  };

  return (
    <section className="workplaces page">
      <PageHeader
        eyebrow="Settings"
        title="Workplaces"
        subtitle="Manage your workplaces, pay rates, and colors."
        className="workplaces__header animate-in"
      >
        {onNavigate && (
          <button
            type="button"
            className="workplaces__back-btn"
            onClick={() => onNavigate(returnTo || "Shifts")}
          >
            ← Back to {returnTo || "Shifts"}
          </button>
        )}
      </PageHeader>

      {error && (
        <p className="workplaces__error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <LoadingSkeleton count={3} height="5rem" />
      ) : (
        <>
          <div className="workplaces__list animate-in animate-in--1">
            {activeWorkplaces.length === 0 ? (
              <EmptyState
                title="No workplaces yet."
                text="Add your first workplace to start tracking shifts."
              />
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
                    <span className="workplaces__card-rate">
                      {formatMoney(wp.rate)}/hr
                    </span>
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
                        onClick={() => {
                          setDeactivateTarget(wp);
                          deactivateModal.openModal();
                        }}
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
                  <div
                    key={wp.id}
                    className="workplaces__card workplaces__card--inactive glass-card"
                  >
                    <div className="workplaces__card-left">
                      <span
                        className="workplaces__color-dot workplaces__color-dot--inactive"
                        style={{ background: wp.color }}
                        aria-hidden="true"
                      />
                      <div className="workplaces__card-info">
                        <span className="workplaces__card-label">
                          {wp.label}
                        </span>
                        <span className="workplaces__card-slug">{wp.slug}</span>
                      </div>
                    </div>
                    <div className="workplaces__card-right">
                      <span className="workplaces__card-rate">
                        {formatMoney(wp.rate)}/hr
                      </span>
                      <div className="workplaces__card-actions">
                        <button
                          type="button"
                          className="workplaces__action workplaces__action--reactivate"
                          onClick={() => reactivateWorkplace(wp)}
                        >
                          Reactivate
                        </button>
                        <button
                          type="button"
                          className="workplaces__action workplaces__action--delete"
                          onClick={() => {
                            setDeleteTarget(wp);
                            deleteModal.openModal();
                          }}
                        >
                          Delete
                        </button>
                      </div>
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

      {/* Add/Edit Workplace Modal */}
      <SheetModal
        open={formModal.open}
        closing={formModal.closing}
        onClose={closeModal}
        title={editing ? "Edit workplace" : "Add workplace"}
      >
        <form className="workplaces__form" onSubmit={handleSubmit}>
          <FormField
            label="Slug (ID)"
            error={fieldErrors.slug}
            state={fieldStates.slug}
            showIndicator
            shake={fieldErrors.slug ? shakeKey : 0}
          >
            <input
              type="text"
              value={form.slug}
              onChange={(e) => {
                setForm({ ...form, slug: e.target.value.toLowerCase() });
                setFieldErrors((prev) => ({ ...prev, slug: null }));
              }}
              onBlur={() => handleFieldBlur("slug")}
              placeholder="e.g. warehouse, bar"
              disabled={!!editing}
              required
              autoComplete="off"
            />
            {editing && (
              <span className="form-field__hint">Slug cannot be changed.</span>
            )}
          </FormField>

          <FormField
            label="Display name"
            error={fieldErrors.label}
            state={fieldStates.label}
            showIndicator
            shake={fieldErrors.label ? shakeKey : 0}
          >
            <input
              type="text"
              value={form.label}
              onChange={(e) => {
                setForm({ ...form, label: e.target.value });
                setFieldErrors((prev) => ({ ...prev, label: null }));
              }}
              onBlur={() => handleFieldBlur("label")}
              placeholder="e.g. Warehouse, The Bar"
              required
              autoComplete="off"
            />
          </FormField>

          <FormField
            label="Hourly rate (₪)"
            error={fieldErrors.rate}
            state={fieldStates.rate}
            showIndicator
            shake={fieldErrors.rate ? shakeKey : 0}
          >
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
              required
            />
          </FormField>

          <FormField label="Color">
            <div className="workplaces__color-input-row">
              <input
                ref={colorPickerRef}
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="workplaces__color-native-hidden"
                aria-label="Pick a color"
              />
              <button
                type="button"
                className="workplaces__color-swatch"
                style={{ background: form.color }}
                onClick={() => colorPickerRef.current?.click()}
                aria-label="Open color picker"
              />
              <input
                type="text"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="#818cf8"
                maxLength={7}
                className="workplaces__color-hex"
              />
            </div>
          </FormField>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !isFormValid}
            >
              {saving ? (
                <>
                  <span className="btn__spinner" aria-hidden="true" />
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
      </SheetModal>

      {/* Deactivate Confirmation */}
      <ConfirmModal
        open={deactivateModal.open}
        closing={deactivateModal.closing}
        onClose={() => {
          deactivateModal.closeModal();
          setTimeout(() => setDeactivateTarget(null), 320);
        }}
        onConfirm={confirmDeactivate}
        loading={deactivating}
        title={`Deactivate ${deactivateTarget?.label}?`}
        description="This workplace will be shown as faded but its shifts will still be visible and counted in totals. You can reactivate it anytime."
        confirmLabel="Deactivate"
        variant="warning"
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={deleteModal.open}
        closing={deleteModal.closing}
        onClose={() => {
          deleteModal.closeModal();
          setTimeout(() => setDeleteTarget(null), 320);
        }}
        onConfirm={confirmDelete}
        loading={deleting}
        title={`Delete ${deleteTarget?.label}?`}
        description={
          <>
            This will permanently remove the workplace{" "}
            <strong>and all shifts</strong> associated with it. All shift
            records using &ldquo;{deleteTarget?.label}&rdquo; will be deleted
            from the database. This cannot be undone.
          </>
        }
        confirmLabel="Delete workplace"
        icon={TrashIcon}
        variant="danger"
      />
    </section>
  );
}

export default Workplaces;
