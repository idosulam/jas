import "./Work_places.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { get_supabase_client } from "../../../Lib/Superbase.jsx";
import { use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  get_user_facing_error,
  sanitize_text,
  sanitize_number,
  haptic_error,
} from "../../../Lib/Security.js";
import { use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import {
  SheetModal,
  FormField,
  PageHeader,
  ConfirmModal,
  EmptyState,
  LoadingSkeleton,
} from "../../Index.js";
import { use_body_scroll_lock, use_modal } from "../../../Hooks/Index.js";
import { TrashIcon } from "../../../Components/UI/Modals/Confirm_modal";

import { format_money } from "../../../Lib/format";

const empty_form = () => ({
  slug: "",
  label: "",
  rate: "",
  color: "",
});

function Workplaces({ onNavigate, return_to }) {
  const user_id = use_user_id();
  const [workplaces, set_workplaces] = useState([]);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, set_form] = useState(empty_form);
  const [saving, set_saving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [delete_target, set_delete_target] = useState(null);
  const [deleting, set_deleting] = useState(false);
  const [field_errors, set_field_errors] = useState({});
  const [field_states, set_field_states] = useState({});
  const [shake_key, set_shake_key] = useState(0);

  const { success: toast_success, error: toast_error } = use_glass_toast();

  const form_modal = use_modal(320);
  const deactivateModal = use_modal(320);
  const delete_modal = use_modal(320);

  use_body_scroll_lock(form_modal.open, deactivateTarget, delete_target);

  const fetch_workplaces = useCallback(async () => {
    if (!user_id) return;
    set_loading(true);
    set_error(null);
    try {
      const supabase = get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("workplaces")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: true });

      if (fetch_error) {
        set_error(get_user_facing_error(fetch_error.message));
        set_workplaces([]);
      } else {
        set_workplaces(data ?? []);
      }
    } catch (err) {
      set_error(get_user_facing_error(err.message));
      set_workplaces([]);
    }
    set_loading(false);
  }, [user_id]);

  useEffect(() => {
    fetch_workplaces();
  }, [fetch_workplaces]);

  const activeWorkplaces = useMemo(
    () => workplaces.filter((wp) => wp.active),
    [workplaces],
  );

  const inactiveWorkplaces = useMemo(
    () => workplaces.filter((wp) => !wp.active),
    [workplaces],
  );

  const open_add_modal = () => {
    setEditing(null);
    set_form(empty_form());
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  const open_edit_modal = (wp) => {
    setEditing(wp);
    set_form({
      slug: wp.slug,
      label: wp.label,
      rate: String(wp.rate),
      color: wp.color,
    });
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  const close_modal = () => {
    form_modal.close_modal();
    setTimeout(() => {
      setEditing(null);
      set_form(empty_form());
      set_field_states({});
    }, 320);
  };

  const validate_field = (name, value) => {
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
      case "color": {
        if (!value || !/^#[0-9a-fA-F]{6}$/.test(value.trim()))
          return "Enter a valid hex color";
        return null;
      }
      default:
        return null;
    }
  };

  const handle_field_blur = (name) => {
    const err = validate_field(name, form[name]);
    set_field_errors((prev) => ({ ...prev, [name]: err }));
    set_field_states((prev) => ({
      ...prev,
      [name]: err ? "error" : form[name] ? "valid" : "idle",
    }));
    if (err) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };

  const is_form_valid = useMemo(() => {
    if (!form.slug.trim()) return false;
    if (!/^[a-z0-9_-]+$/.test(form.slug.trim())) return false;
    if (!editing && workplaces.some((wp) => wp.slug === form.slug.trim()))
      return false;
    if (!form.label.trim()) return false;
    const rate = parseFloat(form.rate);
    if (!form.rate || isNaN(rate) || rate < 0) return false;
    if (!form.color || !/^#[0-9a-fA-F]{6}$/.test(form.color.trim()))
      return false;
    return true;
  }, [form, editing, workplaces]);

  const handle_submit = async (e) => {
    e.preventDefault();
    if (!is_form_valid) {
      // Trigger validation display for all fields
      const errors = {};
      const states = {};
      ["slug", "label", "rate"].forEach((name) => {
        const err = validate_field(name, form[name]);
        if (err) {
          errors[name] = err;
          states[name] = "error";
        } else if (form[name]) {
          states[name] = "valid";
        }
      });
      set_field_errors((prev) => ({ ...prev, ...errors }));
      set_field_states((prev) => ({ ...prev, ...states }));
      set_shake_key((k) => k + 1);
      return;
    }

    set_saving(true);
    set_error(null);

    const slug = sanitize_text(form.slug, 40).toLowerCase().trim();
    const label = sanitize_text(form.label, 60).trim();
    const rate = Number(sanitize_number(form.rate, 0, 99999));
    const color = form.color;

    try {
      const supabase = get_supabase_client();
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
          ...(user_id && { user_id: user_id }),
        }));
      }

      set_saving(false);

      if (dbError) {
        const message = get_user_facing_error(dbError.message);
        set_error(message);
        toast_error(
          editing ? "Couldn't update workplace." : "Couldn't create workplace.",
        );
        return;
      }

      close_modal();
      toast_success(editing ? "Workplace updated." : "Workplace created.");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("shifts:refresh"));
        window.dispatchEvent(new CustomEvent("calendar:refresh"));
      }

      fetch_workplaces();
    } catch (err) {
      set_saving(false);
      set_error(get_user_facing_error(err.message));
      toast_error(
        editing ? "Couldn't update workplace." : "Couldn't create workplace.",
      );
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;

    setDeactivating(true);
    set_error(null);

    try {
      const supabase = get_supabase_client();
      const { error: dbError } = await supabase
        .from("workplaces")
        .update({ active: false })
        .eq("id", deactivateTarget.id);

      setDeactivating(false);

      if (dbError) {
        set_error(get_user_facing_error(dbError.message));
        toast_error("Failed to deactivate workplace.");
        return;
      }

      deactivateModal.close_modal();
      setTimeout(() => setDeactivateTarget(null), 320);
      toast_success("Workplace deactivated.");
      fetch_workplaces();
    } catch (err) {
      setDeactivating(false);
      set_error(get_user_facing_error(err.message));
      toast_error("Failed to deactivate workplace.");
    }
  };

  const reactivateWorkplace = async (wp) => {
    set_error(null);
    try {
      const supabase = get_supabase_client();
      const { error: dbError } = await supabase
        .from("workplaces")
        .update({ active: true })
        .eq("id", wp.id);

      if (dbError) {
        set_error(get_user_facing_error(dbError.message));
        toast_error("Failed to reactivate workplace.");
        return;
      }

      toast_success(`${wp.label} reactivated.`);
      fetch_workplaces();
    } catch (err) {
      set_error(get_user_facing_error(err.message));
      toast_error("Failed to reactivate workplace.");
    }
  };

  const confirm_delete = async () => {
    if (!delete_target) return;

    set_deleting(true);
    set_error(null);

    try {
      const supabase = get_supabase_client();

      const { error: shiftsDeleteError } = await supabase
        .from("shifts")
        .delete()
        .eq("place", delete_target.slug);

      if (shiftsDeleteError) {
        set_deleting(false);
        set_error(get_user_facing_error(shiftsDeleteError.message));
        toast_error("Failed to delete associated shifts.");
        return;
      }

      const { error: dbError } = await supabase
        .from("workplaces")
        .delete()
        .eq("id", delete_target.id);

      set_deleting(false);

      if (dbError) {
        set_error(get_user_facing_error(dbError.message));
        toast_error("Failed to delete workplace.");
        return;
      }

      delete_modal.close_modal();
      setTimeout(() => set_delete_target(null), 320);
      toast_success(`${delete_target.label} and all its shifts deleted.`);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("shifts:refresh"));
        window.dispatchEvent(new CustomEvent("calendar:refresh"));
      }
      fetch_workplaces();
    } catch (err) {
      set_deleting(false);
      set_error(get_user_facing_error(err.message));
      toast_error("Failed to delete workplace.");
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
            onClick={() => onNavigate(return_to || "Shifts")}
          >
            ← Back to {return_to || "Shifts"}
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
                      {format_money(wp.rate)}/hr
                    </span>
                    <div className="workplaces__card-actions">
                      <button
                        type="button"
                        className="workplaces__action workplaces__action--edit"
                        onClick={() => open_edit_modal(wp)}
                        aria-label={`Edit ${wp.label}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="workplaces__action workplaces__action--deactivate"
                        onClick={() => {
                          setDeactivateTarget(wp);
                          deactivateModal.open_modal();
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
                        {format_money(wp.rate)}/hr
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
                            set_delete_target(wp);
                            delete_modal.open_modal();
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
              onClick={open_add_modal}
            >
              + Add workplace
            </button>
          </div>
        </>
      )}

      {/* Add/Edit Workplace Modal */}
      <SheetModal
        open={form_modal.open}
        closing={form_modal.closing}
        onClose={close_modal}
        title={editing ? "Edit workplace" : "Add workplace"}
      >
        <form className="workplaces__form" onSubmit={handle_submit}>
          <FormField
            label="Slug (ID)"
            error={field_errors.slug}
            state={field_states.slug}
            show_indicator
            shake={field_errors.slug ? shake_key : 0}
          >
            <input
              type="text"
              value={form.slug}
              onChange={(e) => {
                set_form({ ...form, slug: e.target.value.toLowerCase() });
                set_field_errors((prev) => ({ ...prev, slug: null }));
              }}
              onBlur={() => handle_field_blur("slug")}
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
            error={field_errors.label}
            state={field_states.label}
            show_indicator
            shake={field_errors.label ? shake_key : 0}
          >
            <input
              type="text"
              value={form.label}
              onChange={(e) => {
                set_form({ ...form, label: e.target.value });
                set_field_errors((prev) => ({ ...prev, label: null }));
              }}
              onBlur={() => handle_field_blur("label")}
              placeholder="e.g. Warehouse, The Bar"
              required
              autoComplete="off"
            />
          </FormField>

          <FormField
            label="Hourly rate (₪)"
            error={field_errors.rate}
            state={field_states.rate}
            show_indicator
            shake={field_errors.rate ? shake_key : 0}
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.rate}
              onChange={(e) => {
                set_form({ ...form, rate: e.target.value });
                set_field_errors((prev) => ({ ...prev, rate: null }));
              }}
              onBlur={() => handle_field_blur("rate")}
              placeholder="e.g. 50"
              required
            />
          </FormField>

          <FormField
            label="Color"
            error={field_errors.color}
            state={field_states.color}
            show_indicator
            shake={field_errors.color ? shake_key : 0}
          >
            <div className="workplaces__color-input-row">
              <label
                className="workplaces__color-swatch"
                style={{ background: form.color || "rgba(255,255,255,0.08)" }}
                aria-label="Open color picker"
              >
                <input
                  type="color"
                  value={form.color || "#818cf8"}
                  onChange={(e) => {
                    set_form({ ...form, color: e.target.value });
                    set_field_errors((prev) => ({ ...prev, color: null }));
                    set_field_states((prev) => ({ ...prev, color: "valid" }));
                  }}
                  className="workplaces__color-native-hidden"
                />
                {!form.color && (
                  <span className="workplaces__color-placeholder">?</span>
                )}
              </label>
              <input
                type="text"
                value={form.color}
                onChange={(e) => {
                  set_form({ ...form, color: e.target.value });
                  if (field_states.color) {
                    const err = validate_field("color", e.target.value);
                    set_field_errors((prev) => ({ ...prev, color: err }));
                    set_field_states((prev) => ({
                      ...prev,
                      color: err ? "error" : e.target.value ? "valid" : "idle",
                    }));
                  }
                }}
                onBlur={() => handle_field_blur("color")}
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
              onClick={close_modal}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !is_form_valid}
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
          deactivateModal.close_modal();
          setTimeout(() => setDeactivateTarget(null), 320);
        }}
        onConfirm={confirmDeactivate}
        loading={deactivating}
        title={`Deactivate ${deactivateTarget?.label}?`}
        description="This workplace will be shown as faded but its shifts will still be visible and counted in totals. You can reactivate it anytime."
        confirm_label="Deactivate"
        variant="warning"
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={delete_modal.open}
        closing={delete_modal.closing}
        onClose={() => {
          delete_modal.close_modal();
          setTimeout(() => set_delete_target(null), 320);
        }}
        onConfirm={confirm_delete}
        loading={deleting}
        title={`Delete ${delete_target?.label}?`}
        description={
          <>
            This will permanently remove the workplace{" "}
            <strong>and all shifts</strong> associated with it. All shift
            records using &ldquo;{delete_target?.label}&rdquo; will be deleted
            from the database. This cannot be undone.
          </>
        }
        confirm_label="Delete workplace"
        icon={TrashIcon}
        variant="danger"
      />
    </section>
  );
}

export default Workplaces;
