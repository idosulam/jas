import "./Work_places.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase.jsx";
import { Use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  Get_user_facing_error,
  Sanitize_text,
  Sanitize_number,
  Haptic_error,
} from "../../../Lib/Security.js";
import { Use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import {
  Sheet_modal,
  Form_field,
  Page_header,
  Confirm_modal,
  Empty_state,
  Loading_skeleton,
} from "../..";
import { Use_body_scroll_lock, Use_modal } from "../../../Hooks";
import { TrashIcon } from "../../../Components/UI/Modals/Confirm_modal";

import { Format_money } from "../../../Lib/Format";

const Empty_form = () => ({
  slug: "",
  label: "",
  rate: "",
  color: "",
});

function Workplaces({ onNavigate, return_to }) {
  const user_id = Use_user_id();
  const [Workplaces, Set_workplaces] = useState([]);
  const [Loading, Set_loading] = useState(true);
  const [error, Set_error] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, Set_form] = useState(Empty_form);
  const [Saving, Set_saving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [Delete_target, Set_delete_target] = useState(null);
  const [Deleting, Set_deleting] = useState(false);
  const [Field_errors, Set_field_errors] = useState({});
  const [Field_states, Set_field_states] = useState({});
  const [Shake_key, Set_shake_key] = useState(0);

  const { success: Toast_success, error: Toast_error } = Use_glass_toast();

  const Form_modal = Use_modal(320);
  const deactivateModal = Use_modal(320);
  const Delete_modal = Use_modal(320);

  Use_body_scroll_lock(Form_modal.open, deactivateTarget, Delete_target);

  const Fetch_workplaces = useCallback(async () => {
    if (!user_id) return;
    Set_loading(true);
    Set_error(null);
    try {
      const supabase = Get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("Workplaces")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: true });

      if (fetch_error) {
        Set_error(Get_user_facing_error(fetch_error.message));
        Set_workplaces([]);
      } else {
        Set_workplaces(data ?? []);
      }
    } catch (err) {
      Set_error(Get_user_facing_error(err.message));
      Set_workplaces([]);
    }
    Set_loading(false);
  }, [user_id]);

  useEffect(() => {
    Fetch_workplaces();
  }, [Fetch_workplaces]);

  const activeWorkplaces = useMemo(
    () => Workplaces.filter((wp) => wp.active),
    [Workplaces],
  );

  const inactiveWorkplaces = useMemo(
    () => Workplaces.filter((wp) => !wp.active),
    [Workplaces],
  );

  const Open_add_modal = () => {
    setEditing(null);
    Set_form(Empty_form());
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  const Open_edit_modal = (wp) => {
    setEditing(wp);
    Set_form({
      slug: wp.slug,
      label: wp.label,
      rate: String(wp.rate),
      color: wp.color,
    });
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  const close_modal = () => {
    Form_modal.close_modal();
    setTimeout(() => {
      setEditing(null);
      Set_form(Empty_form());
      Set_field_states({});
    }, 320);
  };

  const Validate_field = (name, value) => {
    switch (name) {
      case "slug": {
        if (!value.trim()) return "Slug is required";
        if (!/^[a-z0-9_-]+$/.test(value.trim()))
          return "Lowercase letters, numbers, hyphens, underscores only";
        if (!editing && Workplaces.some((wp) => wp.slug === value.trim()))
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

  const Handle_field_blur = (name) => {
    const err = Validate_field(name, form[name]);
    Set_field_errors((prev) => ({ ...prev, [name]: err }));
    Set_field_states((prev) => ({
      ...prev,
      [name]: err ? "error" : form[name] ? "valid" : "idle",
    }));
    if (err) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };

  const Is_form_valid = useMemo(() => {
    if (!form.slug.trim()) return false;
    if (!/^[a-z0-9_-]+$/.test(form.slug.trim())) return false;
    if (!editing && Workplaces.some((wp) => wp.slug === form.slug.trim()))
      return false;
    if (!form.label.trim()) return false;
    const rate = parseFloat(form.rate);
    if (!form.rate || isNaN(rate) || rate < 0) return false;
    if (!form.color || !/^#[0-9a-fA-F]{6}$/.test(form.color.trim()))
      return false;
    return true;
  }, [form, editing, Workplaces]);

  const Handle_submit = async (e) => {
    e.preventDefault();
    if (!Is_form_valid) {
      // Trigger validation display for all fields
      const errors = {};
      const states = {};
      ["slug", "label", "rate"].forEach((name) => {
        const err = Validate_field(name, form[name]);
        if (err) {
          errors[name] = err;
          states[name] = "error";
        } else if (form[name]) {
          states[name] = "valid";
        }
      });
      Set_field_errors((prev) => ({ ...prev, ...errors }));
      Set_field_states((prev) => ({ ...prev, ...states }));
      Set_shake_key((k) => k + 1);
      return;
    }

    Set_saving(true);
    Set_error(null);

    const slug = Sanitize_text(form.slug, 40).toLowerCase().trim();
    const label = Sanitize_text(form.label, 60).trim();
    const rate = Number(Sanitize_number(form.rate, 0, 99999));
    const color = form.color;

    try {
      const supabase = Get_supabase_client();
      let dbError;

      if (editing) {
        ({ error: dbError } = await supabase
          .from("Workplaces")
          .update({ label, rate, color })
          .eq("id", editing.id));
      } else {
        ({ error: dbError } = await supabase.from("Workplaces").insert({
          slug,
          label,
          rate,
          color,
          ...(user_id && { user_id: user_id }),
        }));
      }

      Set_saving(false);

      if (dbError) {
        const message = Get_user_facing_error(dbError.message);
        Set_error(message);
        Toast_error(
          editing ? "Couldn't update workplace." : "Couldn't create workplace.",
        );
        return;
      }

      close_modal();
      Toast_success(editing ? "Workplace updated." : "Workplace created.");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("shifts:refresh"));
        window.dispatchEvent(new CustomEvent("calendar:refresh"));
      }

      Fetch_workplaces();
    } catch (err) {
      Set_saving(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error(
        editing ? "Couldn't update workplace." : "Couldn't create workplace.",
      );
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;

    setDeactivating(true);
    Set_error(null);

    try {
      const supabase = Get_supabase_client();
      const { error: dbError } = await supabase
        .from("Workplaces")
        .update({ active: false })
        .eq("id", deactivateTarget.id);

      setDeactivating(false);

      if (dbError) {
        Set_error(Get_user_facing_error(dbError.message));
        Toast_error("Failed to deactivate workplace.");
        return;
      }

      deactivateModal.close_modal();
      setTimeout(() => setDeactivateTarget(null), 320);
      Toast_success("Workplace deactivated.");
      Fetch_workplaces();
    } catch (err) {
      setDeactivating(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error("Failed to deactivate workplace.");
    }
  };

  const reactivateWorkplace = async (wp) => {
    Set_error(null);
    try {
      const supabase = Get_supabase_client();
      const { error: dbError } = await supabase
        .from("Workplaces")
        .update({ active: true })
        .eq("id", wp.id);

      if (dbError) {
        Set_error(Get_user_facing_error(dbError.message));
        Toast_error("Failed to reactivate workplace.");
        return;
      }

      Toast_success(`${wp.label} reactivated.`);
      Fetch_workplaces();
    } catch (err) {
      Set_error(Get_user_facing_error(err.message));
      Toast_error("Failed to reactivate workplace.");
    }
  };

  const Confirm_delete = async () => {
    if (!Delete_target) return;

    Set_deleting(true);
    Set_error(null);

    try {
      const supabase = Get_supabase_client();

      const { error: shiftsDeleteError } = await supabase
        .from("shifts")
        .delete()
        .eq("place", Delete_target.slug);

      if (shiftsDeleteError) {
        Set_deleting(false);
        Set_error(Get_user_facing_error(shiftsDeleteError.message));
        Toast_error("Failed to delete associated shifts.");
        return;
      }

      const { error: dbError } = await supabase
        .from("Workplaces")
        .delete()
        .eq("id", Delete_target.id);

      Set_deleting(false);

      if (dbError) {
        Set_error(Get_user_facing_error(dbError.message));
        Toast_error("Failed to delete workplace.");
        return;
      }

      Delete_modal.close_modal();
      setTimeout(() => Set_delete_target(null), 320);
      Toast_success(`${Delete_target.label} and all its shifts deleted.`);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("shifts:refresh"));
        window.dispatchEvent(new CustomEvent("calendar:refresh"));
      }
      Fetch_workplaces();
    } catch (err) {
      Set_deleting(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error("Failed to delete workplace.");
    }
  };

  return (
    <section className="Workplaces page">
      <Page_header
        eyebrow="Settings"
        title="Workplaces"
        subtitle="Manage your Workplaces, pay rates, and colors."
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
      </Page_header>

      {error && (
        <p className="workplaces__error" role="alert">
          {error}
        </p>
      )}

      {Loading ? (
        <Loading_skeleton count={3} height="5rem" />
      ) : (
        <>
          <div className="workplaces__list animate-in animate-in--1">
            {activeWorkplaces.length === 0 ? (
              <Empty_state
                title="No Workplaces yet."
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
                      {Format_money(wp.rate)}/hr
                    </span>
                    <div className="workplaces__card-actions">
                      <button
                        type="button"
                        className="workplaces__action workplaces__action--edit"
                        onClick={() => Open_edit_modal(wp)}
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
                        {Format_money(wp.rate)}/hr
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
                            Set_delete_target(wp);
                            Delete_modal.open_modal();
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
              onClick={Open_add_modal}
            >
              + Add workplace
            </button>
          </div>
        </>
      )}

      {/* Add/Edit Workplace Modal */}
      <Sheet_modal
        open={Form_modal.open}
        closing={Form_modal.closing}
        onClose={close_modal}
        title={editing ? "Edit workplace" : "Add workplace"}
      >
        <form className="workplaces__form" onSubmit={Handle_submit}>
          <Form_field
            label="Slug (ID)"
            error={Field_errors.slug}
            state={Field_states.slug}
            show_indicator
            shake={Field_errors.slug ? Shake_key : 0}
          >
            <input
              type="text"
              value={form.slug}
              onChange={(e) => {
                Set_form({ ...form, slug: e.target.value.toLowerCase() });
                Set_field_errors((prev) => ({ ...prev, slug: null }));
              }}
              onBlur={() => Handle_field_blur("slug")}
              placeholder="e.g. warehouse, bar"
              disabled={!!editing}
              required
              autoComplete="off"
            />
            {editing && (
              <span className="form-field__hint">Slug cannot be changed.</span>
            )}
          </Form_field>

          <Form_field
            label="Display name"
            error={Field_errors.label}
            state={Field_states.label}
            show_indicator
            shake={Field_errors.label ? Shake_key : 0}
          >
            <input
              type="text"
              value={form.label}
              onChange={(e) => {
                Set_form({ ...form, label: e.target.value });
                Set_field_errors((prev) => ({ ...prev, label: null }));
              }}
              onBlur={() => Handle_field_blur("label")}
              placeholder="e.g. Warehouse, The Bar"
              required
              autoComplete="off"
            />
          </Form_field>

          <Form_field
            label="Hourly rate (₪)"
            error={Field_errors.rate}
            state={Field_states.rate}
            show_indicator
            shake={Field_errors.rate ? Shake_key : 0}
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.rate}
              onChange={(e) => {
                Set_form({ ...form, rate: e.target.value });
                Set_field_errors((prev) => ({ ...prev, rate: null }));
              }}
              onBlur={() => Handle_field_blur("rate")}
              placeholder="e.g. 50"
              required
            />
          </Form_field>

          <Form_field
            label="Color"
            error={Field_errors.color}
            state={Field_states.color}
            show_indicator
            shake={Field_errors.color ? Shake_key : 0}
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
                    Set_form({ ...form, color: e.target.value });
                    Set_field_errors((prev) => ({ ...prev, color: null }));
                    Set_field_states((prev) => ({ ...prev, color: "valid" }));
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
                  Set_form({ ...form, color: e.target.value });
                  if (Field_states.color) {
                    const err = Validate_field("color", e.target.value);
                    Set_field_errors((prev) => ({ ...prev, color: err }));
                    Set_field_states((prev) => ({
                      ...prev,
                      color: err ? "error" : e.target.value ? "valid" : "idle",
                    }));
                  }
                }}
                onBlur={() => Handle_field_blur("color")}
                placeholder="#818cf8"
                maxLength={7}
                className="workplaces__color-hex"
              />
            </div>
          </Form_field>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={close_modal}
              disabled={Saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={Saving || !Is_form_valid}
            >
              {Saving ? (
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
      </Sheet_modal>

      {/* Deactivate Confirmation */}
      <Confirm_modal
        open={deactivateModal.open}
        closing={deactivateModal.closing}
        onClose={() => {
          deactivateModal.close_modal();
          setTimeout(() => setDeactivateTarget(null), 320);
        }}
        onConfirm={confirmDeactivate}
        Loading={deactivating}
        title={`Deactivate ${deactivateTarget?.label}?`}
        description="This workplace will be shown as faded but its shifts will still be visible and counted in totals. You can reactivate it anytime."
        confirm_label="Deactivate"
        variant="warning"
      />

      {/* Delete Confirmation */}
      <Confirm_modal
        open={Delete_modal.open}
        closing={Delete_modal.closing}
        onClose={() => {
          Delete_modal.close_modal();
          setTimeout(() => Set_delete_target(null), 320);
        }}
        onConfirm={Confirm_delete}
        Loading={Deleting}
        title={`Delete ${Delete_target?.label}?`}
        description={
          <>
            This will permanently remove the workplace{" "}
            <strong>and all shifts</strong> associated with it. All shift
            records using &ldquo;{Delete_target?.label}&rdquo; will be deleted
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
