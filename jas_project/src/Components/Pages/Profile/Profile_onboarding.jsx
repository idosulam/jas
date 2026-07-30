import { useCallback, useEffect, useMemo, useState } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase";
import { Use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  Get_user_facing_error,
  Sanitize_number,
  Sanitize_text,
  Haptic_error,
} from "../../../Lib/Security";
import { Use_body_scroll_lock } from "../../../Hooks";
import { Use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import { ACTIVITY_LEVELS, GENDER_OPTIONS } from "../Fitness/Macro_calculator";
import Sheet_modal from "../../UI/Modals/Sheet_modal";
import Form_field from "../../UI/Form/Form_field.jsx";

function Cm_to_feet_and_inches(Height_cm) {
  if (Height_cm == null || Number.isNaN(Height_cm))
    return { feet: "", inches: "" };
  const totalInches = Height_cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Number((totalInches % 12).toFixed(1));
  return { feet: String(feet), inches: String(inches) };
}

function Feet_and_inches_to_cm(feet, inches) {
  const parsedFeet = Sanitize_number(feet, 0, 9);
  const parsedInches = Sanitize_number(inches, 0, 11.9);
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
export default function Profile_onboarding() {
  const user_id = Use_user_id();
  const [profile, setProfile] = useState(null);
  const [Loading, Set_loading] = useState(true);
  const [open, Set_open] = useState(false);
  const [Saving, Set_saving] = useState(false);
  const [error, Set_error] = useState(null);

  const [form, Set_form] = useState({
    display_name: "",
    age: "",
    Height_cm: "",
    height_ft: "",
    height_in: "",
    goal_weight_kg: "",
    gender: "",
    activity_level: "",
  });

  const [Field_errors, Set_field_errors] = useState({});
  const [Field_states, Set_field_states] = useState({});
  const [Shake_key, Set_shake_key] = useState(0);

  const { success: Toast_success, error: Toast_error } = Use_glass_toast();

  // Fetch profile on mount
  const Fetch_profile = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = Get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("profile")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .maybeSingle();

      if (fetch_error) {
        Set_loading(false);
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
        const Height_cm = data?.height_cm != null ? Number(data.height_cm) : null;
        const { feet, inches } = Cm_to_feet_and_inches(Height_cm);
        Set_form({
          display_name: data?.display_name ?? "",
          age: data?.age != null ? String(data.age) : "",
          Height_cm: Height_cm != null ? String(Height_cm) : "",
          height_ft: feet,
          height_in: inches,
          goal_weight_kg:
            data?.goal_weight_kg != null
              ? String(Number(data.goal_weight_kg).toFixed(1))
              : "",
          gender: data?.gender || "",
          activity_level: data?.activity_level || "",
        });
        Set_open(true);
      }
    } catch {
      // silent
    }
    Set_loading(false);
  }, [user_id]);

  useEffect(() => {
    Fetch_profile();
  }, [Fetch_profile]);

  // Prevent closing via backdrop/escape (non-dismissable)
  const handle_close = () => {
    // Only allow close if profile is now complete
    if (isProfileComplete) {
      Set_open(false);
    }
  };

  Use_body_scroll_lock(open);

  // Validation
  const Validate_field = (field_name) => {
    switch (field_name) {
      case "display_name": {
        if (!form.display_name || !form.display_name.trim())
          return "Name is required";
        if (form.display_name.trim().length > 40) return "Max 40 characters";
        return null;
      }
      case "age": {
        if (!form.age) return "Age is required";
        const age = Sanitize_number(form.age, 13, 120);
        if (age == null) return "Enter a valid age (13–120)";
        return null;
      }
      case "Height_cm": {
        if (!form.Height_cm && !form.height_ft && !form.height_in)
          return "Height is required";
        const cm = Sanitize_number(form.Height_cm, 1, 300);
        if (form.Height_cm && cm == null) return "Enter a valid height";
        return null;
      }
      case "goal_weight_kg": {
        if (!form.goal_weight_kg) return null; // optional
        const kg = Sanitize_number(form.goal_weight_kg, 1, 1000);
        if (kg == null) return "Enter a valid weight";
        return null;
      }
      default:
        return null;
    }
  };

  const Handle_field_blur = (field_name) => {
    const error = Validate_field(field_name);
    Set_field_errors((prev) => ({ ...prev, [field_name]: error }));
    Set_field_states((prev) => ({
      ...prev,
      [field_name]: error ? "error" : form[field_name] ? "valid" : "idle",
    }));
    if (error) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };

  const isProfileComplete = useMemo(() => {
    if (!form.display_name || !form.display_name.trim()) return false;
    const age = Sanitize_number(form.age, 13, 120);
    if (!form.age || age == null) return false;
    const Height_cm =
      Sanitize_number(form.Height_cm, 1, 300) ??
      Feet_and_inches_to_cm(form.height_ft, form.height_in);
    if (!Height_cm) return false;
    return true;
  }, [form]);

  // Height helpers
  const handleHeightCmChange = (value) => {
    const cmValue = Sanitize_number(value, 1, 300);
    const { feet, inches } = Cm_to_feet_and_inches(cmValue);
    Set_form((f) => ({
      ...f,
      Height_cm: value,
      height_ft: cmValue != null ? feet : "",
      height_in: cmValue != null ? inches : "",
    }));
  };

  const handleHeightImperialChange = (field, value) => {
    const next = { ...form, [field]: value };
    const convertedCm = Feet_and_inches_to_cm(next.height_ft, next.height_in);
    Set_form({
      ...next,
      Height_cm: convertedCm != null ? String(convertedCm) : "",
    });
  };

  const Handle_submit = async (e) => {
    e.preventDefault();

    // Validate all required fields
    const errors = {};
    const nameErr = Validate_field("display_name");
    const ageErr = Validate_field("age");
    const heightErr = Validate_field("Height_cm");
    if (nameErr) errors.display_name = nameErr;
    if (ageErr) errors.age = ageErr;
    if (heightErr) errors.Height_cm = heightErr;

    if (Object.keys(errors).length > 0) {
      Set_field_errors(errors);
      const newStates = {};
      Object.keys(errors).forEach((k) => {
        newStates[k] = "error";
      });
      Set_field_states((prev) => ({ ...prev, ...newStates }));
      Set_shake_key((k) => k + 1);
      return;
    }

    Set_saving(true);
    Set_error(null);

    const display_name = Sanitize_text(form.display_name, 40) || "Jas";
    const age = Sanitize_number(form.age, 13, 120);
    const Height_cm =
      Sanitize_number(form.Height_cm, 1, 300) ??
      Feet_and_inches_to_cm(form.height_ft, form.height_in);
    const goalKg = Sanitize_number(form.goal_weight_kg, 1, 1000);

    const payload = {
      display_name: display_name,
      age,
      height_cm: Height_cm ?? null,
      goal_weight_kg: goalKg ? Number(goalKg.toFixed(2)) : null,
      gender: form.gender || "male",
      activity_level: form.activity_level || "moderate",
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = Get_supabase_client();
      const { error: saveError } = profile
        ? await supabase.from("profile").update(payload).eq("id", profile.id)
        : await supabase
            .from("profile")
            .insert({ ...payload, ...(user_id && { user_id: user_id }) });

      Set_saving(false);

      if (saveError) {
        Set_error(Get_user_facing_error(saveError.message));
        Toast_error("Couldn't save profile.");
        return;
      }

      Set_open(false);
      Toast_success("Profile saved! Welcome aboard.");
    } catch (err) {
      Set_saving(false);
      Set_error(err.message || "Something went wrong.");
      Toast_error("Couldn't save profile.");
    }
  };

  if (Loading || !open) return null;

  return (
    <Sheet_modal
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

      <form className="profile-onboarding__form" onSubmit={Handle_submit}>
        <Form_field
          label="Name"
          error={Field_errors.display_name}
          state={Field_states.display_name}
          show_indicator
          shake={Field_errors.display_name ? Shake_key : 0}
        >
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => {
              Set_form((f) => ({ ...f, display_name: e.target.value }));
              Set_field_errors((prev) => ({ ...prev, display_name: null }));
            }}
            onBlur={() => Handle_field_blur("display_name")}
            placeholder="Your name"
            autoFocus
            required
          />
        </Form_field>

        <Form_field
          label="Age"
          error={Field_errors.age}
          state={Field_states.age}
          show_indicator
          shake={Field_errors.age ? Shake_key : 0}
        >
          <input
            type="number"
            min="13"
            max="120"
            placeholder="26"
            value={form.age}
            onChange={(e) => {
              Set_form((f) => ({ ...f, age: e.target.value }));
              Set_field_errors((prev) => ({ ...prev, age: null }));
            }}
            onBlur={() => Handle_field_blur("age")}
            required
          />
        </Form_field>

        <Form_field
          label="Height (cm)"
          error={Field_errors.Height_cm}
          state={Field_states.Height_cm}
          show_indicator
          shake={Field_errors.Height_cm ? Shake_key : 0}
        >
          <input
            type="number"
            step="0.1"
            min="1"
            placeholder="165"
            value={form.Height_cm}
            onChange={(e) => {
              handleHeightCmChange(e.target.value);
              Set_field_errors((prev) => ({ ...prev, Height_cm: null }));
            }}
            onBlur={() => Handle_field_blur("Height_cm")}
            required
          />
        </Form_field>

        <div className="profile-onboarding__height-row">
          <Form_field label="Feet">
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
          </Form_field>
          <Form_field label="Inches">
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
          </Form_field>
        </div>

        <Form_field
          label="Goal weight (kg)"
          error={Field_errors.goal_weight_kg}
          state={Field_states.goal_weight_kg}
          show_indicator
          shake={Field_errors.goal_weight_kg ? Shake_key : 0}
          optional
        >
          <input
            type="number"
            step="0.1"
            min="1"
            placeholder="58"
            value={form.goal_weight_kg}
            onChange={(e) => {
              Set_form((f) => ({ ...f, goal_weight_kg: e.target.value }));
              Set_field_errors((prev) => ({ ...prev, goal_weight_kg: null }));
            }}
            onBlur={() => Handle_field_blur("goal_weight_kg")}
          />
        </Form_field>

        <Form_field label="Gender" optional>
          <select
            value={form.gender}
            onChange={(e) => Set_form((f) => ({ ...f, gender: e.target.value }))}
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
        </Form_field>

        <Form_field label="Activity level" optional>
          <select
            value={form.activity_level}
            onChange={(e) =>
              Set_form((f) => ({ ...f, activity_level: e.target.value }))
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
        </Form_field>

        <div className="btn-row">
          <button
            type="submit"
            className="btn btn--primary profile-onboarding__submit"
            disabled={Saving || !isProfileComplete}
          >
            {Saving ? (
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
    </Sheet_modal>
  );
}
