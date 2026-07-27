import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { useUserId } from "../../../lib/Auth_context.jsx";
import {
  getUserFacingError,
  sanitizeNumber,
  sanitizeText,
  hapticError,
} from "../../../lib/security";
import { useBodyScrollLock } from "../../../hooks";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import { ACTIVITY_LEVELS, GENDER_OPTIONS } from "../Fitness/macro_calculator";
import SheetModal from "../../ui/modals/Sheet_modal";
import FormField from "../../ui/form/Form_field.jsx";

const MODAL_EXIT_MS = 260;

function cmToFeetAndInches(heightCm) {
  if (heightCm == null || Number.isNaN(heightCm))
    return { feet: "", inches: "" };
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Number((totalInches % 12).toFixed(1));
  return { feet: String(feet), inches: String(inches) };
}

function feetAndInchesToCm(feet, inches) {
  const parsedFeet = sanitizeNumber(feet, 0, 9);
  const parsedInches = sanitizeNumber(inches, 0, 11.9);
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
  const userId = useUserId();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    display_name: "",
    age: "",
    height_cm: "",
    height_ft: "",
    height_in: "",
    goal_weight_kg: "",
    gender: "",
    activity_level: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldStates, setFieldStates] = useState({});
  const [shakeKey, setShakeKey] = useState(0);

  const { success: toastSuccess, error: toastError } = useGlassToast();

  // Fetch profile on mount
  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("profile")
        .select("*")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        setLoading(false);
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
        const heightCm = data?.height_cm != null ? Number(data.height_cm) : null;
        const { feet, inches } = cmToFeetAndInches(heightCm);
        setForm({
          display_name: data?.display_name ?? "",
          age: data?.age != null ? String(data.age) : "",
          height_cm: heightCm != null ? String(heightCm) : "",
          height_ft: feet,
          height_in: inches,
          goal_weight_kg:
            data?.goal_weight_kg != null
              ? String(Number(data.goal_weight_kg).toFixed(1))
              : "",
          gender: data?.gender || "",
          activity_level: data?.activity_level || "",
        });
        setOpen(true);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Prevent closing via backdrop/escape (non-dismissable)
  const handleClose = () => {
    // Only allow close if profile is now complete
    if (isProfileComplete) {
      setOpen(false);
    }
  };

  useBodyScrollLock(open);

  // Validation
  const validateField = (fieldName) => {
    switch (fieldName) {
      case "display_name": {
        if (!form.display_name || !form.display_name.trim())
          return "Name is required";
        if (form.display_name.trim().length > 40) return "Max 40 characters";
        return null;
      }
      case "age": {
        if (!form.age) return "Age is required";
        const age = sanitizeNumber(form.age, 13, 120);
        if (age == null) return "Enter a valid age (13–120)";
        return null;
      }
      case "height_cm": {
        if (!form.height_cm && !form.height_ft && !form.height_in)
          return "Height is required";
        const cm = sanitizeNumber(form.height_cm, 1, 300);
        if (form.height_cm && cm == null) return "Enter a valid height";
        return null;
      }
      case "goal_weight_kg": {
        if (!form.goal_weight_kg) return null; // optional
        const kg = sanitizeNumber(form.goal_weight_kg, 1, 1000);
        if (kg == null) return "Enter a valid weight";
        return null;
      }
      default:
        return null;
    }
  };

  const handleFieldBlur = (fieldName) => {
    const error = validateField(fieldName);
    setFieldErrors((prev) => ({ ...prev, [fieldName]: error }));
    setFieldStates((prev) => ({
      ...prev,
      [fieldName]: error ? "error" : form[fieldName] ? "valid" : "idle",
    }));
    if (error) {
      setShakeKey((k) => k + 1);
      hapticError();
    }
  };

  const isProfileComplete = useMemo(() => {
    if (!form.display_name || !form.display_name.trim()) return false;
    const age = sanitizeNumber(form.age, 13, 120);
    if (!form.age || age == null) return false;
    const heightCm =
      sanitizeNumber(form.height_cm, 1, 300) ??
      feetAndInchesToCm(form.height_ft, form.height_in);
    if (!heightCm) return false;
    return true;
  }, [form]);

  // Height helpers
  const handleHeightCmChange = (value) => {
    const cmValue = sanitizeNumber(value, 1, 300);
    const { feet, inches } = cmToFeetAndInches(cmValue);
    setForm((f) => ({
      ...f,
      height_cm: value,
      height_ft: cmValue != null ? feet : "",
      height_in: cmValue != null ? inches : "",
    }));
  };

  const handleHeightImperialChange = (field, value) => {
    const next = { ...form, [field]: value };
    const convertedCm = feetAndInchesToCm(next.height_ft, next.height_in);
    setForm({
      ...next,
      height_cm: convertedCm != null ? String(convertedCm) : "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all required fields
    const errors = {};
    const nameErr = validateField("display_name");
    const ageErr = validateField("age");
    const heightErr = validateField("height_cm");
    if (nameErr) errors.display_name = nameErr;
    if (ageErr) errors.age = ageErr;
    if (heightErr) errors.height_cm = heightErr;

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

    const displayName = sanitizeText(form.display_name, 40) || "Jas";
    const age = sanitizeNumber(form.age, 13, 120);
    const heightCm =
      sanitizeNumber(form.height_cm, 1, 300) ??
      feetAndInchesToCm(form.height_ft, form.height_in);
    const goalKg = sanitizeNumber(form.goal_weight_kg, 1, 1000);

    const payload = {
      display_name: displayName,
      age,
      height_cm: heightCm ?? null,
      goal_weight_kg: goalKg ? Number(goalKg.toFixed(2)) : null,
      gender: form.gender || "male",
      activity_level: form.activity_level || "moderate",
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = getSupabaseClient();
      const { error: saveError } = profile
        ? await supabase.from("profile").update(payload).eq("id", profile.id)
        : await supabase
            .from("profile")
            .insert({ ...payload, ...(userId && { user_id: userId }) });

      setSaving(false);

      if (saveError) {
        setError(getUserFacingError(saveError.message));
        toastError("Couldn't save profile.");
        return;
      }

      setOpen(false);
      toastSuccess("Profile saved! Welcome aboard.");
    } catch (err) {
      setSaving(false);
      setError(err.message || "Something went wrong.");
      toastError("Couldn't save profile.");
    }
  };

  if (loading || !open) return null;

  return (
    <SheetModal
      open={open}
      closing={false}
      onClose={handleClose}
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

      <form className="profile-onboarding__form" onSubmit={handleSubmit}>
        <FormField
          label="Name"
          error={fieldErrors.display_name}
          state={fieldStates.display_name}
          showIndicator
          shake={fieldErrors.display_name ? shakeKey : 0}
        >
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => {
              setForm((f) => ({ ...f, display_name: e.target.value }));
              setFieldErrors((prev) => ({ ...prev, display_name: null }));
            }}
            onBlur={() => handleFieldBlur("display_name")}
            placeholder="Your name"
            autoFocus
            required
          />
        </FormField>

        <FormField
          label="Age"
          error={fieldErrors.age}
          state={fieldStates.age}
          showIndicator
          shake={fieldErrors.age ? shakeKey : 0}
        >
          <input
            type="number"
            min="13"
            max="120"
            placeholder="26"
            value={form.age}
            onChange={(e) => {
              setForm((f) => ({ ...f, age: e.target.value }));
              setFieldErrors((prev) => ({ ...prev, age: null }));
            }}
            onBlur={() => handleFieldBlur("age")}
            required
          />
        </FormField>

        <FormField
          label="Height (cm)"
          error={fieldErrors.height_cm}
          state={fieldStates.height_cm}
          showIndicator
          shake={fieldErrors.height_cm ? shakeKey : 0}
        >
          <input
            type="number"
            step="0.1"
            min="1"
            placeholder="165"
            value={form.height_cm}
            onChange={(e) => {
              handleHeightCmChange(e.target.value);
              setFieldErrors((prev) => ({ ...prev, height_cm: null }));
            }}
            onBlur={() => handleFieldBlur("height_cm")}
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
          error={fieldErrors.goal_weight_kg}
          state={fieldStates.goal_weight_kg}
          showIndicator
          shake={fieldErrors.goal_weight_kg ? shakeKey : 0}
          optional
        >
          <input
            type="number"
            step="0.1"
            min="1"
            placeholder="58"
            value={form.goal_weight_kg}
            onChange={(e) => {
              setForm((f) => ({ ...f, goal_weight_kg: e.target.value }));
              setFieldErrors((prev) => ({ ...prev, goal_weight_kg: null }));
            }}
            onBlur={() => handleFieldBlur("goal_weight_kg")}
          />
        </FormField>

        <FormField label="Gender" optional>
          <select
            value={form.gender}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
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
              setForm((f) => ({ ...f, activity_level: e.target.value }))
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
