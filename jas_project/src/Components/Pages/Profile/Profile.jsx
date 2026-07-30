import "./Profile.css";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { get_supabase_client } from "../../../Lib/Superbase";
import { use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  get_user_facing_error,
  sanitize_date,
  sanitize_number,
  sanitize_text,
  haptic_error,
} from "../../../Lib/Security";

import { use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import {
  SheetModal,
  ConfirmModal,
  FormField,
  PageHeader,
  FAB,
  LoadingSkeleton,
} from "../../../components";
import { use_household } from "../../../Lib/Household_context.jsx";
import {
  use_body_scroll_lock,
  use_modal,
  use_floating_actions,
} from "../../../Hooks";
import { ACTIVITY_LEVELS, GENDER_OPTIONS } from "../Fitness/Macro_calculator";

import { format_date_label } from "../../../Lib/format";

import { load_unit, to_display_kg, format_weight, format_weight_both, kg_to_lbs, lbs_to_kg, cm_to_feet_and_inches, feet_and_inches_to_cm, format_height, calc_bmi, bmi_label, healthy_weight_range_kg } from "../../../Lib/weight";

import WeightChart from "./Weight_chart";
import { daysBetween, buildInsight } from "./Weight_utils";
import ProfileStats from "./Profile_stats";
import ProfileHistory from "./Profile_history";
import WeightForm from "./Weight_form";

const KG_TO_LBS = 2.20462;
const MODAL_EXIT_MS = 260;
const emptyProfileForm = () => ({
  display_name: "",
  age: "",
  height_cm: "",
  height_ft: "",
  height_in: "",
  goal_weight_kg: "",
  goal_weight_lbs: "",
  gender: "",
  activity_level: "",
});

const emptyWeightForm = () => ({
  entry_date: new Date().toISOString().slice(0, 10),
  weight_kg: "",
  weight_lbs: "",
  notes: "",
});



function Profile({ onNavigate }) {
  const { household_name } = use_household();
  const user_id = use_user_id();
  const [removing_id, set_removing_id] = useState(null);
  const [unit, setUnit] = useState("kg");
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState(null);

  const weightModal = use_modal(MODAL_EXIT_MS);
  const profileModal = use_modal(MODAL_EXIT_MS);
  const delete_modal = use_modal(MODAL_EXIT_MS);
  const deleteAccountModal = use_modal(MODAL_EXIT_MS);

  const [delete_target, set_delete_target] = useState(null);

  const [weightForm, setWeightForm] = useState(emptyWeightForm);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, set_saving] = useState(false);
  const [deleting, set_deleting] = useState(false);
  const [duplicate_date_confirm, set_duplicate_date_confirm] = useState(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState({});
  const [profileFieldStates, setProfileFieldStates] = useState({});
  const [profileShakeKey, setProfileShakeKey] = useState(0);
  const [weightFieldErrors, setWeightFieldErrors] = useState({});
  const [weightFieldStates, setWeightFieldStates] = useState({});
  const [weightShakeKey, setWeightShakeKey] = useState(0);
  const hasLoadedOnce = useRef(false);
  const { success: toast_success, error: toast_error } = use_glass_toast();

  const { ref: logWeightBtnRef, visible: show_floating_actions } =
    use_floating_actions();

  const fetchData = useCallback(async () => {
    if (!user_id) return;

    // only show the full-page loading state the first time
    if (!hasLoadedOnce.current) {
      set_loading(true);
    }
    set_error(null);

    try {
      const supabase = get_supabase_client();
      const [profileRes, entriesRes] = await Promise.all([
        supabase
          .from("profile")
          .select("*")
          .eq("user_id", user_id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("weight_entries")
          .select("*")
          .eq("user_id", user_id)
          .order("entry_date", { ascending: true }),
      ]);

      if (profileRes.error) {
        set_error(get_user_facing_error(profileRes.error.message));
        setProfile(null);
      } else {
        setProfile(profileRes.data);
        if (profileRes.data?.weight_unit) {
          setUnit(profileRes.data.weight_unit);
        }
      }

      if (entriesRes.error) {
        set_error(get_user_facing_error(entriesRes.error.message));
        setEntries([]);
      } else {
        setEntries(entriesRes.data ?? []);
      }
    } catch (err) {
      set_error(get_user_facing_error(err.message));
      setProfile(null);
      setEntries([]);
    }

    hasLoadedOnce.current = true;
    set_loading(false);
  }, [user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  use_body_scroll_lock(
    weightModal.open,
    weightModal.closing,
    profileModal.open,
    profileModal.closing,
    delete_modal.open,
    delete_modal.closing,
  );

  const handleUnitChange = async (nextUnit) => {
    setUnit(nextUnit);
    if (profile) {
      try {
        const supabase = get_supabase_client();
        await supabase
          .from("profile")
          .update({ weight_unit: nextUnit })
          .eq("id", profile.id);
      } catch {
        // silent
      }
    }
  };

  const open_add_weight = () => {
    setEditingEntry(null);
    setWeightForm(emptyWeightForm());
    setWeightFieldErrors({});
    setWeightFieldStates({});
    weightModal.open_modal();
  };

  const openEditWeight = (entry) => {
    const weight_kg = Number(entry.weight_kg);
    setEditingEntry(entry);
    setWeightForm({
      entry_date: entry.entry_date,
      weight_kg: String(weight_kg.toFixed(1)),
      weight_lbs: String(kg_to_lbs(weight_kg)?.toFixed(1) ?? ""),
      notes: entry.notes ?? "",
    });
    setWeightFieldErrors({});
    setWeightFieldStates({});
    weightModal.open_modal();
  };

  const closeWeightModal = () => {
    weightModal.close_modal();
    setTimeout(() => {
      setEditingEntry(null);
      setWeightForm(emptyWeightForm());
      setWeightFieldErrors({});
      setWeightFieldStates({});
    }, MODAL_EXIT_MS);
  };

  const openProfileEdit = () => {
    if (profile) {
      const height_cm =
        profile.height_cm != null ? Number(profile.height_cm) : null;
      const { feet, inches } = cm_to_feet_and_inches(height_cm);
      const goalKg =
        profile.goal_weight_kg != null ? Number(profile.goal_weight_kg) : null;
      setProfileForm({
        display_name: profile.display_name ?? "",
        age: profile.age != null ? String(profile.age) : "",
        height_cm: height_cm != null ? String(height_cm) : "",
        height_ft: feet,
        height_in: inches,
        goal_weight_kg: goalKg != null ? String(goalKg.toFixed(1)) : "",
        goal_weight_lbs:
          goalKg != null ? String(kg_to_lbs(goalKg)?.toFixed(1) ?? "") : "",
        gender: profile.gender || "",
        activity_level: profile.activity_level || "",
      });
    } else {
      setProfileForm(emptyProfileForm());
    }
    setProfileFieldErrors({});
    setProfileFieldStates({});
    profileModal.open_modal();
  };

  const closeProfileModal = () => {
    profileModal.close_modal();
    setTimeout(() => {
      setProfileFieldErrors({});
      setProfileFieldStates({});
    }, MODAL_EXIT_MS);
  };

  const openDeleteConfirm = (entry) => {
    set_delete_target(entry);
    delete_modal.open_modal();
  };

  const close_delete_modal = () => {
    delete_modal.close_modal();
    setTimeout(() => {
      set_delete_target(null);
    }, MODAL_EXIT_MS);
  };

  const handleHeightCmChange = (value) => {
    const cmValue = sanitize_number(value, 1, 300);
    const { feet, inches } = cm_to_feet_and_inches(cmValue);
    setProfileForm((current) => ({
      ...current,
      height_cm: value,
      height_ft: cmValue != null ? feet : "",
      height_in: cmValue != null ? inches : "",
    }));
  };

  const handleGoalWeightKgChange = (value) => {
    const kgValue = sanitize_number(value, 1, 1000);
    setProfileForm((current) => ({
      ...current,
      goal_weight_kg: value,
      goal_weight_lbs:
        kgValue != null ? String(kg_to_lbs(kgValue)?.toFixed(1) ?? "") : "",
    }));
  };

  const handleGoalWeightLbsChange = (value) => {
    const lbsValue = sanitize_number(value, 1, 2200);
    setProfileForm((current) => ({
      ...current,
      goal_weight_kg:
        lbsValue != null ? String(lbs_to_kg(lbsValue)?.toFixed(2) ?? "") : "",
      goal_weight_lbs: value,
    }));
  };

  const handleWeightKgChange = (value) => {
    const kgValue = sanitize_number(value, 1, 1000);
    setWeightForm((current) => ({
      ...current,
      weight_kg: value,
      weight_lbs:
        kgValue != null ? String(kg_to_lbs(kgValue)?.toFixed(1) ?? "") : "",
    }));
  };

  const handleWeightLbsChange = (value) => {
    const lbsValue = sanitize_number(value, 1, 2200);
    setWeightForm((current) => ({
      ...current,
      weight_kg:
        lbsValue != null ? String(lbs_to_kg(lbsValue)?.toFixed(2) ?? "") : "",
      weight_lbs: value,
    }));
  };

  const handleHeightImperialChange = (field, value) => {
    const nextState = {
      ...profileForm,
      [field]: value,
    };
    const convertedCm = feet_and_inches_to_cm(
      nextState.height_ft,
      nextState.height_in,
    );
    setProfileForm({
      ...nextState,
      height_cm: convertedCm != null ? String(convertedCm) : "",
    });
  };

  const performSaveWeight = async () => {
    const weight_kg =
      sanitize_number(weightForm.weight_kg, 1, 1000) ??
      lbs_to_kg(weightForm.weight_lbs);
    const entry_date = sanitize_date(
      weightForm.entry_date,
      emptyWeightForm().entry_date,
    );
    const notes = sanitize_text(weightForm.notes, 240);
    if (!weight_kg || weight_kg <= 0 || !entry_date) return;

    set_saving(true);
    set_error(null);
    set_duplicate_date_confirm(null);

    const payload = {
      entry_date: entry_date,
      weight_kg: Number(weight_kg.toFixed(2)),
      notes: notes || null,
      ...(user_id && { user_id: user_id }),
    };

    try {
      const supabase = get_supabase_client();
      const query = editingEntry
        ? supabase
            .from("weight_entries")
            .update(payload)
            .eq("id", editingEntry.id)
        : supabase
            .from("weight_entries")
            .upsert(payload, { onConflict: "user_id,entry_date" });

      const { error: saveError } = await query;
      set_saving(false);

      if (saveError) {
        const rawMsg = saveError.message || "";
        // Supabase returns this when the unique constraint is missing
        if (/on conflict|no unique/i.test(rawMsg)) {
          const existing = entries.find((e) => e.entry_date === entry_date);
          if (existing) {
            set_duplicate_date_confirm({
              existing_entry: existing,
              newWeight: weight_kg,
              newNotes: notes,
            });
            return;
          }
        }
        const friendly = /permission|duplicate|conflict/i.test(rawMsg)
          ? `Could not save — there's already an entry for ${format_date_label(entry_date)}. Edit the existing one instead.`
          : get_user_facing_error(rawMsg);
        set_error(friendly);
        toast_error(friendly);
        return;
      }

      const isUpdate = !!editingEntry || !!duplicate_date_confirm;
      closeWeightModal();
      toast_success(
        isUpdate
          ? `Weight updated for ${format_date_label(entry_date)}.`
          : `Weight logged for ${format_date_label(entry_date)}.`,
      );
      fetchData();
    } catch (err) {
      set_saving(false);
      set_error(get_user_facing_error(err.message));
      toast_error("Something went wrong. Please try again.");
    }
  };

  const isWeightFormValid = useMemo(() => {
    if (!weightForm.entry_date) return false;
    const weight_kg =
      sanitize_number(weightForm.weight_kg, 1, 1000) ??
      lbs_to_kg(weightForm.weight_lbs);
    if (!weight_kg || weight_kg <= 0) return false;
    return true;
  }, [weightForm]);

  const isProfileFormValid = useMemo(() => {
    if (!profileForm.display_name || !profileForm.display_name.trim())
      return false;
    const age = sanitize_number(profileForm.age, 13, 120);
    if (!profileForm.age || age == null) return false;
    const height_cm =
      sanitize_number(profileForm.height_cm, 1, 300) ??
      feet_and_inches_to_cm(profileForm.height_ft, profileForm.height_in);
    if (!height_cm) return false;
    if (!profileForm.gender) return false;
    if (!profileForm.activity_level) return false;
    return true;
  }, [profileForm]);

  const validateProfileField = (field_name) => {
    switch (field_name) {
      case "display_name": {
        if (!profileForm.display_name || !profileForm.display_name.trim())
          return "Name is required";
        if (profileForm.display_name.trim().length > 40)
          return "Max 40 characters";
        return null;
      }
      case "age": {
        if (!profileForm.age) return "Age is required";
        const age = sanitize_number(profileForm.age, 13, 120);
        if (age == null) return "Enter a valid age (13–120)";
        return null;
      }
      case "height_cm": {
        if (!profileForm.height_cm && !profileForm.height_ft && !profileForm.height_in)
          return "Height is required";
        const cm = sanitize_number(profileForm.height_cm, 1, 300);
        if (profileForm.height_cm && cm == null) return "Enter a valid height";
        return null;
      }
      case "goal_weight_kg": {
        if (!profileForm.goal_weight_kg) return null; // optional
        const kg = sanitize_number(profileForm.goal_weight_kg, 1, 1000);
        if (kg == null) return "Enter a valid weight";
        return null;
      }
      case "gender": {
        if (!profileForm.gender) return "Gender is required";
        const valid = GENDER_OPTIONS.some((g) => g.id === profileForm.gender);
        if (!valid) return "Select a valid option";
        return null;
      }
      case "activity_level": {
        if (!profileForm.activity_level) return "Activity level is required";
        const valid = ACTIVITY_LEVELS.some(
          (l) => l.id === profileForm.activity_level,
        );
        if (!valid) return "Select a valid option";
        return null;
      }
      default:
        return null;
    }
  };

  const handleProfileFieldBlur = (field_name) => {
    const error = validateProfileField(field_name);
    setProfileFieldErrors((prev) => ({ ...prev, [field_name]: error }));
    setProfileFieldStates((prev) => ({
      ...prev,
      [field_name]: error ? "error" : profileForm[field_name] ? "valid" : "idle",
    }));
    if (error) {
      setProfileShakeKey((k) => k + 1);
      haptic_error();
    }
  };

  const validateWeightField = (field_name) => {
    switch (field_name) {
      case "entry_date": {
        if (!weightForm.entry_date) return "Pick a date";
        return null;
      }
      case "weight_kg": {
        if (!weightForm.weight_kg && !weightForm.weight_lbs)
          return "Enter your weight";
        const kg = sanitize_number(weightForm.weight_kg, 1, 1000);
        if (weightForm.weight_kg && kg == null)
          return "Must be between 1 and 1000";
        return null;
      }
      case "weight_lbs": {
        if (!weightForm.weight_lbs && !weightForm.weight_kg)
          return "Enter your weight";
        const lbs = sanitize_number(weightForm.weight_lbs, 1, 2200);
        if (weightForm.weight_lbs && lbs == null)
          return "Must be between 1 and 2200";
        return null;
      }
      default:
        return null;
    }
  };

  const handleWeightFieldBlur = (field_name) => {
    const error = validateWeightField(field_name);
    // If the other field has a valid value, don't show error on this one
    const otherField = field_name === "weight_kg" ? "weight_lbs" : "weight_kg";
    const otherHasValue = !!weightForm[otherField];
    const effectiveError = otherHasValue ? null : error;

    // When one field is filled, mark both as valid
    const hasAnyWeight = weightForm.weight_kg || weightForm.weight_lbs;
    setWeightFieldErrors((prev) => ({
      ...prev,
      [field_name]: effectiveError,
      ...(hasAnyWeight ? { [otherField]: null } : {}),
    }));
    setWeightFieldStates((prev) => ({
      ...prev,
      [field_name]: effectiveError
        ? "error"
        : weightForm[field_name]
          ? "valid"
          : hasAnyWeight
            ? "valid"
            : "idle",
      ...(hasAnyWeight ? { [otherField]: "valid" } : {}),
    }));
    if (effectiveError) {
      setWeightShakeKey((k) => k + 1);
      haptic_error();
    }
  };

  const saveWeight = async (e) => {
    e.preventDefault();
    const weight_kg =
      sanitize_number(weightForm.weight_kg, 1, 1000) ??
      lbs_to_kg(weightForm.weight_lbs);
    const entry_date = sanitize_date(
      weightForm.entry_date,
      emptyWeightForm().entry_date,
    );
    if (!weight_kg || weight_kg <= 0 || !entry_date) {
      // Trigger validation display
      const errors = {};
      const states = {};
      if (!entry_date) {
        errors.entry_date = "Pick a date";
        states.entry_date = "error";
      }
      if (!weight_kg || weight_kg <= 0) {
        errors.weight_kg = "Enter your weight";
        states.weight_kg = "error";
      }
      setWeightFieldErrors((prev) => ({ ...prev, ...errors }));
      setWeightFieldStates((prev) => ({ ...prev, ...states }));
      setWeightShakeKey((k) => k + 1);
      return;
    }

    // If adding (not editing), check for an existing entry on the same date
    if (!editingEntry) {
      const existing = entries.find((e) => e.entry_date === entry_date);
      if (existing) {
        set_duplicate_date_confirm({
          existing_entry: existing,
          newWeight: weight_kg,
          newNotes: sanitize_text(weightForm.notes, 240),
        });
        return;
      }
    }

    performSaveWeight();
  };

  const confirmDuplicateSave = () => {
    // User confirmed — switch to edit mode on the existing entry
    if (duplicate_date_confirm?.existing_entry) {
      setEditingEntry(duplicate_date_confirm.existing_entry);
    }
    performSaveWeight();
  };

  const closeDuplicateConfirm = () => {
    set_duplicate_date_confirm(null);
  };

  const save_profile = async (e) => {
    e.preventDefault();
    set_saving(true);
    set_error(null);

    const goalKg =
      sanitize_number(profileForm.goal_weight_kg, 1, 1000) ??
      lbs_to_kg(profileForm.goal_weight_lbs);
    const display_name = sanitize_text(profileForm.display_name, 40) || "Jas";
    const age = sanitize_number(profileForm.age, 13, 120);
    const heightCmFromCm = sanitize_number(profileForm.height_cm, 1, 300);
    const heightCmFromImperial = feet_and_inches_to_cm(
      profileForm.height_ft,
      profileForm.height_in,
    );
    const height_cm = heightCmFromCm ?? heightCmFromImperial;

    const payload = {
      display_name: display_name,
      age,
      height_cm: height_cm ?? null,
      goal_weight_kg: goalKg ? Number(goalKg.toFixed(2)) : null,
      gender: profileForm.gender,
      activity_level: profileForm.activity_level,
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

      closeProfileModal();
      toast_success("Profile saved.");
      fetchData();
    } catch (err) {
      set_saving(false);
      set_error(get_user_facing_error(err.message));
      toast_error("Couldn't save profile.");
    }
  };

  const confirm_delete = async () => {
    if (!delete_target) return;
    const targetId = delete_target.id;

    set_deleting(true);
    set_removing_id(targetId);
    close_delete_modal();

    // wait for the exit animation, then optimistically remove it
    await new Promise((resolve) => setTimeout(resolve, 240));
    setEntries((prev) => prev.filter((e) => e.id !== targetId));
    set_removing_id(null);

    try {
      const supabase = get_supabase_client();
      const { error: deleteError } = await supabase
        .from("weight_entries")
        .delete()
        .eq("id", targetId);

      set_deleting(false);

      if (deleteError) {
        set_error(get_user_facing_error(deleteError.message));
        toast_error("Failed to delete weight entry.");
        fetchData(); // resync in case the optimistic update was wrong
        return;
      }

      toast_success("Entry deleted.");
      fetchData(); // quiet background resync, no loading flash now
    } catch (err) {
      set_deleting(false);
      set_error(get_user_facing_error(err.message));
      toast_error("Couldn't delete entry.");
      fetchData();
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    try {
      const supabase = get_supabase_client();
      const { error } = await supabase.rpc("delete_current_user");
      if (error) throw error;
      deleteAccountModal.close_modal();
      toast_success("Account deleted.");
      await supabase.auth.signOut();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
  };

  const analytics = useMemo(() => {
    const sorted = [...entries].sort((a, b) =>
      a.entry_date.localeCompare(b.entry_date),
    );
    const latest = sorted[sorted.length - 1];
    const first = sorted[0];
    const height_cm = profile?.height_cm ? Number(profile.height_cm) : null;
    const goalKg = profile?.goal_weight_kg
      ? Number(profile.goal_weight_kg)
      : null;
    const age = profile?.age ? Number(profile.age) : null;

    const currentKg = latest ? Number(latest.weight_kg) : null;
    const startKg = first ? Number(first.weight_kg) : null;
    const totalChangeKg =
      currentKg != null && startKg != null && sorted.length > 1
        ? currentKg - startKg
        : null;

    let weeklyChangeKg = null;
    if (sorted.length >= 2 && totalChangeKg != null) {
      const spanDays = daysBetween(first.entry_date, latest.entry_date);
      weeklyChangeKg = (totalChangeKg / spanDays) * 7;
    }

    const bmi = calc_bmi(currentKg, height_cm);
    const range = healthy_weight_range_kg(height_cm);

    let goalProgress = null;
    let remainingKg = null;
    if (
      currentKg != null &&
      goalKg != null &&
      startKg != null &&
      startKg !== goalKg
    ) {
      const totalNeeded = startKg - goalKg;
      const done = startKg - currentKg;
      goalProgress = Math.min(100, Math.max(0, (done / totalNeeded) * 100));
      remainingKg = currentKg - goalKg;
    }

    const insight = buildInsight({
      age,
      weeklyChangeKg,
      bmi,
      goalProgress,
      isLosing: totalChangeKg != null && totalChangeKg < 0,
    });

    return {
      currentKg,
      startKg,
      totalChangeKg,
      weeklyChangeKg,
      bmi,
      bmiCategory: bmi_label(bmi),
      range,
      goalProgress,
      remainingKg,
      goalKg,
      height_cm,
      age,
      insight,
      sorted,
    };
  }, [entries, profile]);

  const display_name = profile?.display_name || "";
  const unitLabel = unit === "kg" ? "kg" : "lbs";

  return (
    <section>
      <PageHeader
        className="profile__header"
        eyebrow={
          household_name ? `Progress · ${household_name}` : "Your progress"
        }
        title={`Hi ${display_name}`}
        subtitle="Weight loss analytics tuned for your training."
      >
        <div className="profile__avatar" aria-hidden="true">
          {display_name.charAt(0).toUpperCase()}
        </div>
        <div
          className="profile__unit-toggle"
          role="group"
          aria-label="Weight unit"
        >
          <span
            className={`profile__unit-indicator profile__unit-indicator--${unit}`}
            aria-hidden="true"
          />
          <button
            type="button"
            className={`profile__unit-btn${unit === "kg" ? " profile__unit-btn--active" : ""}`}
            onClick={() => handleUnitChange("kg")}
            aria-pressed={unit === "kg"}
          >
            kg
          </button>
          <button
            type="button"
            className={`profile__unit-btn${unit === "lbs" ? " profile__unit-btn--active" : ""}`}
            onClick={() => handleUnitChange("lbs")}
            aria-pressed={unit === "lbs"}
          >
            lbs
          </button>
        </div>
      </PageHeader>

      {error && (
        <p className="profile__error profile__error--glass" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="profile__summary">
          <LoadingSkeleton count={4} variant="stat" contents />
          <div style={{ gridColumn: "span 2", marginTop: "1rem" }}>
            <LoadingSkeleton count={1} variant="card" height="10rem" />
          </div>
        </div>
      ) : (
        <>
          <ProfileStats analytics={analytics} unit={unit} unitLabel={unitLabel} />

          <section
            className="profile__panel"
            aria-labelledby="profile-chart-title"
          >
            <div className="profile__panel-head">
              <h2 id="profile-chart-title" className="profile__panel-title">
                Weight trend
              </h2>
              <button
                type="button"
                className="profile__text-btn"
                onClick={open_add_weight}
                ref={logWeightBtnRef}
              >
                + Log weight
              </button>
            </div>
            <WeightChart
              entries={entries}
              unit={unit}
              goalKg={analytics.goalKg}
            />
          </section>

          {analytics.goalKg != null && analytics.currentKg != null && (
            <section
              className="profile__panel"
              aria-labelledby="profile-goal-title"
            >
              <h2 id="profile-goal-title" className="profile__panel-title">
                Goal progress
              </h2>
              <div
                className={`profile__goal-bar-wrap${analytics.remainingKg != null && analytics.remainingKg <= 0 ? " profile__goal-reached" : ""}`}
              >
                <div
                  className="profile__goal-bar"
                  role="progressbar"
                  aria-valuenow={Math.round(analytics.goalProgress ?? 0)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progress toward goal weight"
                >
                  <div
                    className="profile__goal-bar-fill"
                    style={{
                      width: `${Math.min(analytics.goalProgress ?? 0, 100)}%`,
                    }}
                  />
                </div>
                <div className="profile__goal-meta">
                  <span>
                    Target{" "}
                    <strong>
                      {format_weight_both(analytics.goalKg)}
                    </strong>
                  </span>
                  {analytics.remainingKg != null && (
                    <span>
                      {analytics.remainingKg > 0
                        ? `${format_weight_both(analytics.remainingKg)} to go`
                        : "🎉 Goal reached!"}
                    </span>
                  )}
                </div>
                {analytics.remainingKg != null &&
                  analytics.remainingKg <= 0 && (
                    <div className="profile__celebration" aria-hidden="true">
                      {[...Array(12)].map((_, i) => (
                        <span
                          key={i}
                          className={`profile__confetti profile__confetti--${i % 6}`}
                          style={{ animationDelay: `${i * 0.1}s` }}
                        />
                      ))}
                    </div>
                  )}
              </div>
            </section>
          )}

          <section
            className="profile__panel profile__insight"
            aria-labelledby="profile-insight-title"
          >
            <h2 id="profile-insight-title" className="profile__panel-title">
              Training insight
            </h2>
            <p className="profile__insight-text">{analytics.insight}</p>
            {analytics.range && analytics.height_cm && (
              <p className="profile__insight-meta">
                Healthy weight for your height:{" "}
                <strong>
                  {format_weight_both(analytics.range.min, 0)}
                  {" – "}
                  {format_weight_both(analytics.range.max, 0)}
                </strong>
                {analytics.age ? ` · Age ${analytics.age}` : ""}
              </p>
            )}
            {analytics.height_cm && (
              <p className="profile__insight-meta">
                Height: {format_height(analytics.height_cm)}
              </p>
            )}
            {!analytics.height_cm && (
              <button
                type="button"
                className="profile__link-btn"
                onClick={openProfileEdit}
              >
                Add height & goal for BMI and range
              </button>
            )}
          </section>

          <section
            className="profile__panel"
            aria-labelledby="profile-history-title"
          >
            <div className="profile__panel-head">
              <h2 id="profile-history-title" className="profile__panel-title">
                Weight history
              </h2>
              <button
                type="button"
                className="profile__text-btn"
                onClick={openProfileEdit}
              >
                Edit profile
              </button>
              <button
                type="button"
                className="profile__text-btn profile__text-btn--danger"
                onClick={() => deleteAccountModal.open_modal()}
              >
                Delete account
              </button>
              {onNavigate && (
                <button
                  type="button"
                  className="profile__text-btn"
                  onClick={() => onNavigate("Workplaces")}
                >
                  ⚙ Workplaces
                </button>
              )}
            </div>
            <ProfileHistory
              sorted={analytics.sorted}
              removing_id={removing_id}
              unit={unit}
              unitLabel={unitLabel}
              onEdit={openEditWeight}
              onDelete={openDeleteConfirm}
            />
          </section>
        </>
      )}

      {/* Weight Log/Edit Modal */}
      <WeightForm
        weightModal={weightModal}
        weightForm={weightForm}
        setWeightForm={setWeightForm}
        editingEntry={editingEntry}
        saving={saving}
        weightFieldErrors={weightFieldErrors}
        setWeightFieldErrors={setWeightFieldErrors}
        weightFieldStates={weightFieldStates}
        weightShakeKey={weightShakeKey}
        onSubmit={saveWeight}
        onClose={closeWeightModal}
        onKgChange={handleWeightKgChange}
        onLbsChange={handleWeightLbsChange}
        onFieldBlur={handleWeightFieldBlur}
        isValid={isWeightFormValid}
      />

      {/* Profile Edit Modal */}
      <SheetModal
        open={profileModal.open}
        closing={profileModal.closing}
        onClose={closeProfileModal}
        title="Edit profile"
      >
        <form className="profile__form" onSubmit={save_profile}>
          <FormField
            label="Name"
            error={profileFieldErrors.display_name}
            state={profileFieldStates.display_name}
            show_indicator
            shake={profileFieldErrors.display_name ? profileShakeKey : 0}
          >
            <input
              type="text"
              value={profileForm.display_name}
              onChange={(e) => {
                setProfileForm((f) => ({
                  ...f,
                  display_name: e.target.value,
                }));
                setProfileFieldErrors((prev) => ({
                  ...prev,
                  display_name: null,
                }));
              }}
              onBlur={() => handleProfileFieldBlur("display_name")}
            />
          </FormField>
          <FormField
            label="Age"
            error={profileFieldErrors.age}
            state={profileFieldStates.age}
            show_indicator
            shake={profileFieldErrors.age ? profileShakeKey : 0}
          >
            <input
              type="number"
              min="13"
              max="120"
              placeholder="26"
              value={profileForm.age}
              onChange={(e) => {
                setProfileForm((f) => ({ ...f, age: e.target.value }));
                setProfileFieldErrors((prev) => ({ ...prev, age: null }));
              }}
              onBlur={() => handleProfileFieldBlur("age")}
            />
          </FormField>
          <FormField
            label="Height (cm)"
            error={profileFieldErrors.height_cm}
            state={profileFieldStates.height_cm}
            show_indicator
            shake={profileFieldErrors.height_cm ? profileShakeKey : 0}
          >
            <input
              type="number"
              step="0.1"
              min="1"
              placeholder="165"
              value={profileForm.height_cm}
              onChange={(e) => {
                handleHeightCmChange(e.target.value);
                setProfileFieldErrors((prev) => ({
                  ...prev,
                  height_cm: null,
                }));
              }}
              onBlur={() => handleProfileFieldBlur("height_cm")}
            />
          </FormField>
          <div className="profile__height-row">
            <FormField label="Feet">
              <input
                type="number"
                min="0"
                max="9"
                placeholder="5"
                value={profileForm.height_ft}
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
                value={profileForm.height_in}
                onChange={(e) =>
                  handleHeightImperialChange("height_in", e.target.value)
                }
              />
            </FormField>
          </div>
          <div className="profile__weight-row">
            <FormField
              label="Goal weight (kg)"
              error={profileFieldErrors.goal_weight_kg}
              state={profileFieldStates.goal_weight_kg}
              show_indicator
              shake={profileFieldErrors.goal_weight_kg ? profileShakeKey : 0}
              optional
            >
              <input
                type="number"
                step="0.1"
                min="1"
                placeholder="58"
                value={profileForm.goal_weight_kg}
                onChange={(e) => {
                  handleGoalWeightKgChange(e.target.value);
                  setProfileFieldErrors((prev) => ({
                    ...prev,
                    goal_weight_kg: null,
                  }));
                }}
                onBlur={() => handleProfileFieldBlur("goal_weight_kg")}
              />
            </FormField>
            <FormField label="Goal weight (lbs)" optional>
              <input
                type="number"
                step="0.1"
                min="1"
                placeholder="128"
                value={profileForm.goal_weight_lbs}
                onChange={(e) => handleGoalWeightLbsChange(e.target.value)}
              />
            </FormField>
          </div>

          <FormField
            label="Gender"
            error={profileFieldErrors.gender}
            state={profileFieldStates.gender}
            show_indicator
            shake={profileFieldErrors.gender ? profileShakeKey : 0}
          >
            <select
              value={profileForm.gender}
              className={!profileForm.gender ? "select--placeholder" : ""}
              onChange={(e) => {
                setProfileForm((f) => ({ ...f, gender: e.target.value }));
                setProfileFieldErrors((prev) => ({ ...prev, gender: null }));
              }}
              onBlur={() => handleProfileFieldBlur("gender")}
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
          <FormField
            label="Activity Level"
            error={profileFieldErrors.activity_level}
            state={profileFieldStates.activity_level}
            show_indicator
            shake={profileFieldErrors.activity_level ? profileShakeKey : 0}
          >
            <select
              value={profileForm.activity_level}
              className={!profileForm.activity_level ? "select--placeholder" : ""}
              onChange={(e) => {
                setProfileForm((f) => ({
                  ...f,
                  activity_level: e.target.value,
                }));
                setProfileFieldErrors((prev) => ({
                  ...prev,
                  activity_level: null,
                }));
              }}
              onBlur={() => handleProfileFieldBlur("activity_level")}
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

          <p className="profile__form-hint">
            Enter height in centimeters or feet and inches. Weight fields follow
            your {unitLabel} toggle.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closeProfileModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !isProfileFormValid}
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </SheetModal>

      {/* Delete Confirmation Modal */}
      {delete_target && (
        <ConfirmModal
          open={delete_modal.open}
          closing={delete_modal.closing}
          onClose={close_delete_modal}
          onConfirm={confirm_delete}
          loading={deleting}
          title="Delete weigh-in?"
          description={`Remove ${format_date_label(delete_target.entry_date)} (${format_weight_both(Number(delete_target.weight_kg))})?`}
          confirm_label="Delete"
          variant="danger"
        />
      )}

      {/* Duplicate Date Confirmation */}
      {duplicate_date_confirm && (
        <SheetModal
          open={!!duplicate_date_confirm}
          closing={false}
          onClose={closeDuplicateConfirm}
          compact
          variant="warning"
        >
          <div className="profile__dup-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <h2 className="sheet-modal__title sheet-modal__title--compact">
            Already logged for{" "}
            {format_date_label(duplicate_date_confirm.existing_entry.entry_date)}
          </h2>
          <p className="profile__dup-desc">
            You have{" "}
            <strong>
              {format_weight_both(Number(duplicate_date_confirm.existing_entry.weight_kg))}
            </strong>{" "}
            recorded for this day.
          </p>
          <p className="profile__dup-desc">
            Updating to{" "}
            <strong>
              {format_weight_both(duplicate_date_confirm.newWeight)}
            </strong>
            ?
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closeDuplicateConfirm}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={confirmDuplicateSave}
              disabled={saving}
            >
              {saving ? "Updating…" : "Update entry"}
            </button>
          </div>
        </SheetModal>
      )}

      <FAB
        visible={show_floating_actions}
        on_scroll_top={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        on_add={open_add_weight}
        add_label="Log weight"
      />

      {/* Delete Account Confirmation */}
      <ConfirmModal
        open={deleteAccountModal.open}
        closing={deleteAccountModal.closing}
        onClose={() => deleteAccountModal.close_modal()}
        onConfirm={handleDeleteAccount}
        title="Delete your account?"
        description="This will permanently delete your account, all shifts, weight entries, and household data. This cannot be undone."
        confirm_label="Delete account"
        variant="danger"
      />
    </section>
  );
}

export default Profile;
