import { useCallback, useEffect, useMemo, useState } from "react";
import { get_supabase_client } from "../../../Lib/Superbase";
import { use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  get_user_facing_error,
  sanitize_number,
  sanitize_text,
  haptic_error,
} from "../../../Lib/Security";
import { use_body_scroll_lock } from "../../../Hooks";
import { use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import { ACTIVITY_LEVELS, GENDER_OPTIONS } from "../Fitness/Macro_calculator";
import SheetModal from "../../UI/Modals/Sheet_modal";
import FormField from "../../UI/Form/Form_field.jsx";

function cm_to_feet_and_inches(height_cm) {
  if (height_cm == null || Number.isNaN(height_cm))
    return { feet: "", inches: "" };
  const totalInches = height_cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Number((totalInches % 12).toFixed(1));
  return { feet: String(feet), inches: String(inches) };
}

function feet_and_inches_to_cm(feet, inches) {
  const parsedFeet = sanitize_number(feet, 0, 9);
  const parsedInches = sanitize_number(inches, 0, 11.9);
  if (parsedFeet == null && parsedInches == null) return null;
  const totalInches = (parsedFeet ?? 0) * 12 + (parsedInches ?? 0);
  return Number((totalInches * 2.54).toFixed(2));
}

/**
 * Profile onboarding modal.
 * Shows automatically when the logged-in user hasn't completed
 * their profile (missing display_name, age, or height).
 * Non-dismissable until the required fields are filled.
 */
export default function ProfileOnboarding() {
  const user_id = use_user_id();
  const [profile, setProfile] = useState(null);
  const [loading, set_loading] = useState(true);
  const [open, set_open] = useState(false);
  const [saving, set_saving] = useState(false);
  const [error, set_error] = useState(null);

  const [form, set_form] = useState({
    display_name: "",
    age: "",
    height_cm: "",
    height_ft: "",
    height_in: "",
    goal_weight_kg: "",
    gender: "",
    activity_level: "",
  });

  const [field_errors, set_field_errors] = useState({});
  const [field_states, set_field_states] = useState({});
  const [shake_key, set_shake_key] = useState(0);

  const { success: toast_success, error: toast_error } = use_glass_toast();

  // Fetch profile on mount
  const fetch_profile = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("profile")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .maybeSingle();

      if (fetch_error) {
        set_loading(false);
        return;
      }

      setProfile(data);

      // Check if profile is incomplete
      const isIncomplete =
        !data ||
        !data.display_name?.trim() ||
        data.age == null ||
        !data.height_cm;

      if (isIncomplete) {
        // Pre-fill form with existing data
        const height_cm = data?.height_cm != null ? Number(data.height_cm) : null;
        const { feet, inches } = cm_to_feet_and_inches(height_cm);
        set_form({
          display_name: data?.display_name ?? "",
          age: data?.age != null ? String(data.age) : "",
          height_cm: height_cm != null ? String(height_cm) : "",
          height_ft: feet,
          height_in: inches,
          goal_weight_kg:
            data?.goal_weight_kg != null
              ? String(Number(data.goal_weight_kg).toFixed(1))
              : "",
          gender: data?.gender || "",
          activity_level: data?.activity_level || "",
        });
        set_open(true);
      }
    } catch {
      // silent
    }
    set_loading(false);
  }, [user_id]);

  useEffect(() => {
    fetch_profile();
  }, [fetch_profile]);

  // Prevent closing via backdrop/escape (non-dismissable)
  const handle_close = () => {
    // Only allow close if profile is now complete
    if (isProfileComplete) {
      set_open(false);
    }
  };

  use_body_scroll_lock(open);

  // Validation
  const validate_field = (field_name) => {
    switch (field_name) {
      case "display_name": {
        if (!form.display_name || !form.display_name.trim())
          return "Name is required";
        if (form.display_name.trim().length > 40) return "Max 40 characters";
        return null;
      }
      case "age": {
        if (!form.age) return "Age is required";
        const age = sanitize_number(form.age, 13, 120);
        if (age == null) return "Enter a valid age (13–120)";
        return null;
      }
      case "height_cm": {
        if (!form.height_cm && !form.height_ft && !form.height_in)
          return "Height is required";
        const cm = sanitize_number(form.height_cm, 1, 300);
        if (form.height_cm && cm == null) return "Enter a valid height";
        return null;
      }
      case "goal_weight_kg": {
        if (!form.goal_weight_kg) return null; // optional
        const kg = sanitize_number(form.goal_weight_kg, 1, 1000);
        if (kg == null) return "Enter a valid weight";
        return null;
      }
      default:
        return null;
    }
  };

  const handle_field_blur = (field_name) => {
    const error = validate_field(field_name);
    set_field_errors((prev) => ({ ...prev, [field_name]: error }));
    set_field_states((prev) => ({
      ...prev,
      [field_name]: error ? "error" : form[field_name] ? "valid" : "idle",
    }));
    if (error) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };

  const isProfileComplete = useMemo(() => {
    if (!form.display_name || !form.display_name.trim()) return false;
    const age = sanitize_number(form.age, 13, 120);
    if (!form.age || age == null) return false;
    const height_cm =
      sanitize_number(form.height_cm, 1, 300) ??
      feet_and_inches_to_cm(form.height_ft, form.height_in);
    if (!height_cm) return false;
    return true;
  }, [form]);

  // Height helpers
  const handleHeightCmChange = (value) => {
    const cmValue = sanitize_number(value, 1, 300);
    const { feet, inches } = cm_to_feet_and_inches(cmValue);
    set_form((f) => ({
      ...f,
      height_cm: value,
      height_ft: cmValue != null ? feet : "",
      height_in: cmValue != null ? inches : "",
    }));
  };

  const handleHeightImperialChange = (field, value) => {
    const next = { ...form, [field]: value };
    const convertedCm = feet_and_inches_to_cm(next.height_ft, next.height_in);
    set_form({
      ...next,
      height_cm: convertedCm != null ? String(convertedCm) : "",
    });
  };

  const handle_submit = async (e) => {
    e.preventDefault();

    // Validate all required fields
    const errors = {};
    const nameErr = validate_field("display_name");
    const ageErr = validate_field("age");
    const heightErr = validate_field("height_cm");
    if (nameErr) errors.display_name = nameErr;
    if (ageErr) errors.age = ageErr;
    if (heightErr) errors.height_cm = heightErr;

    if (Object.keys(errors).length > 0) {
      set_field_errors(errors);
      const newStates = {};
      Object.keys(errors).forEach((k) => {
        newStates[k] = "error";
      });
      set_field_states((prev) => ({ ...prev, ...newStates }));
      set_shake_key((k) => k + 1);
      return;
    }

    set_saving(true);
    set_error(null);

    const display_name = sanitize_text(form.display_name, 40) || "Jas";
    const age = sanitize_number(form.age, 13, 120);
    const height_cm =
      sanitize_number(form.height_cm, 1, 300) ??
      feet_and_inches_to_cm(form.height_ft, form.height_in);
    const goalKg = sanitize_number(form.goal_weight_kg, 1, 1000);

    const payload = {
      display_name: display_name,
      age,
      height_cm: height_cm ?? null,
      goal_weight_kg: goalKg ? Number(goalKg.toFixed(2)) : null,
      gender: form.gender || "male",
      activity_level: form.activity_level || "moderate",
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = get_supabase_client();
      const { error: saveError } = profile
        ? await supabase.from("profile").update(payload).eq("id", profile.id)
        : await supabase
            .from("profile")
            .insert({ ...payload, ...(user_id && { user_id: user_id }) });

      set_saving(false);

      if (saveError) {
        set_error(get_user_facing_error(saveError.message));
        toast_error("Couldn't save profile.");
        return;
      }

      set_open(false);
      toast_success("Profile saved! Welcome aboard.");
    } catch (err) {
      set_saving(false);
      set_error(err.message || "Something went wrong.");
      toast_error("Couldn't save profile.");
    }
  };

  if (loading || !open) return null;

  return (
    <SheetModal
      open={open}
      closing={false}
      onClose={handle_close}
      title="Complete your profile"
      // Non-dismissable: no swipe-to-close
    >
      <p className="profile-onboarding__desc">
        We need a few details to personalize your experience.
      </p>

      {error && (
        <p className="profile-onboarding__error" role="alert">
          {error}
        </p>
      )}

      <form className="profile-onboarding__form" onSubmit={handle_submit}>
        <FormField
          label="Name"
          error={field_errors.display_name}
          state={field_states.display_name}
          show_indicator
          shake={field_errors.display_name ? shake_key : 0}
        >
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => {
              set_form((f) => ({ ...f, display_name: e.target.value }));
              set_field_errors((prev) => ({ ...prev, display_name: null }));
            }}
            onBlur={() => handle_field_blur("display_name")}
            placeholder="Your name"
            autoFocus
            required
          />
        </FormField>

        <FormField
          label="Age"
          error={field_errors.age}
          state={field_states.age}
          show_indicator
          shake={field_errors.age ? shake_key : 0}
        >
          <input
            type="number"
            min="13"
            max="120"
            placeholder="26"
            value={form.age}
            onChange={(e) => {
              set_form((f) => ({ ...f, age: e.target.value }));
              set_field_errors((prev) => ({ ...prev, age: null }));
            }}
            onBlur={() => handle_field_blur("age")}
            required
          />
        </FormField>

        <FormField
          label="Height (cm)"
          error={field_errors.height_cm}
          state={field_states.height_cm}
          show_indicator
          shake={field_errors.height_cm ? shake_key : 0}
        >
          <input
            type="number"
            step="0.1"
            min="1"
            placeholder="165"
            value={form.height_cm}
            onChange={(e) => {
              handleHeightCmChange(e.target.value);
              set_field_errors((prev) => ({ ...prev, height_cm: null }));
            }}
            onBlur={() => handle_field_blur("height_cm")}
            required
          />
        </FormField>

        <div className="profile-onboarding__height-row">
          <FormField label="Feet">
            <input
              type="number"
              min="0"
              max="9"
              placeholder="5"
              value={form.height_ft}
              onChange={(e) =>
                handleHeightImperialChange("height_ft", e.target.value)
              }
            />
          </FormField>
          <FormField label="Inches">
            <input
              type="number"
              min="0"
              max="11"
              step="0.1"
              placeholder="5"
              value={form.height_in}
              onChange={(e) =>
                handleHeightImperialChange("height_in", e.target.value)
              }
            />
          </FormField>
        </div>

        <FormField
          label="Goal weight (kg)"
          error={field_errors.goal_weight_kg}
          state={field_states.goal_weight_kg}
          show_indicator
          shake={field_errors.goal_weight_kg ? shake_key : 0}
          optional
        >
          <input
            type="number"
            step="0.1"
            min="1"
            placeholder="58"
            value={form.goal_weight_kg}
            onChange={(e) => {
              set_form((f) => ({ ...f, goal_weight_kg: e.target.value }));
              set_field_errors((prev) => ({ ...prev, goal_weight_kg: null }));
            }}
            onBlur={() => handle_field_blur("goal_weight_kg")}
          />
        </FormField>

        <FormField label="Gender" optional>
          <select
            value={form.gender}
            onChange={(e) => set_form((f) => ({ ...f, gender: e.target.value }))}
          >
            <option value="" disabled>
              Select gender…
            </option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Activity level" optional>
          <select
            value={form.activity_level}
            onChange={(e) =>
              set_form((f) => ({ ...f, activity_level: e.target.value }))
            }
          >
            <option value="" disabled>
              Select activity level…
            </option>
            {ACTIVITY_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label} — {l.desc}
              </option>
            ))}
          </select>
        </FormField>

        <div className="btn-row">
          <button
            type="submit"
            className="btn btn--primary profile-onboarding__submit"
            disabled={saving || !isProfileComplete}
          >
            {saving ? (
              <>
                <span className="btn__spinner" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Get started"
            )}
          </button>
        </div>
      </form>
    </SheetModal>
  );
}
