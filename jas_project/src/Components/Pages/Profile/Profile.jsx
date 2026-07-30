import "./Profile.css";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase";
import { Use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  Get_user_facing_error,
  Sanitize_date,
  Sanitize_number,
  Sanitize_text,
  Haptic_error,
} from "../../../Lib/Security";

import { Use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import {
  Sheet_modal,
  Confirm_modal,
  Form_field,
  Page_header,
  FAB,
  Loading_skeleton,
} from "../../../components";
import { Use_household } from "../../../Lib/Household_context.jsx";
import {
  Use_body_scroll_lock,
  Use_modal,
  Use_floating_actions,
} from "../../../Hooks";
import { ACTIVITY_LEVELS, GENDER_OPTIONS } from "../Fitness/Macro_calculator";

import { Format_date_label } from "../../../Lib/format";

import { Load_unit, To_display_kg, Format_weight, Format_weight_both, Kg_to_lbs, Lbs_to_kg, Cm_to_feet_and_inches, Feet_and_inches_to_cm, Format_height, Calc_bmi, Bmi_label, Healthy_weight_range_kg } from "../../../Lib/weight";

import Weight_chart from "./Weight_chart";
import { Days_between, Build_insight } from "./Weight_utils";
import Profile_stats from "./Profile_stats";
import Profile_history from "./Profile_history";
import Weight_form from "./Weight_form";

const KG_TO_LBS = 2.20462;
const MODAL_EXIT_MS = 260;
const emptyProfileForm = () => ({
  display_name: "",
  age: "",
  Height_cm: "",
  height_ft: "",
  height_in: "",
  goal_weight_kg: "",
  goal_weight_lbs: "",
  gender: "",
  activity_level: "",
});

const emptyWeightForm = () => ({
  Entry_date: new Date().toISOString().slice(0, 10),
  Weight_kg: "",
  weight_lbs: "",
  notes: "",
});



function Profile({ onNavigate }) {
  const { Household_name } = Use_household();
  const user_id = Use_user_id();
  const [Removing_id, Set_removing_id] = useState(null);
  const [unit, setUnit] = useState("kg");
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [Loading, Set_loading] = useState(true);
  const [error, Set_error] = useState(null);

  const weightModal = Use_modal(MODAL_EXIT_MS);
  const profileModal = Use_modal(MODAL_EXIT_MS);
  const Delete_modal = Use_modal(MODAL_EXIT_MS);
  const deleteAccountModal = Use_modal(MODAL_EXIT_MS);

  const [Delete_target, Set_delete_target] = useState(null);

  const [weightForm, setWeightForm] = useState(emptyWeightForm);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [editingEntry, setEditingEntry] = useState(null);
  const [Saving, Set_saving] = useState(false);
  const [Deleting, Set_deleting] = useState(false);
  const [Duplicate_date_confirm, Set_duplicate_date_confirm] = useState(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState({});
  const [profileFieldStates, setProfileFieldStates] = useState({});
  const [profileShakeKey, setProfileShakeKey] = useState(0);
  const [weightFieldErrors, setWeightFieldErrors] = useState({});
  const [weightFieldStates, setWeightFieldStates] = useState({});
  const [weightShakeKey, setWeightShakeKey] = useState(0);
  const hasLoadedOnce = useRef(false);
  const { success: Toast_success, error: Toast_error } = Use_glass_toast();

  const { ref: logWeightBtnRef, visible: Show_floating_actions } =
    Use_floating_actions();

  const fetchData = useCallback(async () => {
    if (!user_id) return;

    // only show the full-page Loading state the first time
    if (!hasLoadedOnce.current) {
      Set_loading(true);
    }
    Set_error(null);

    try {
      const supabase = Get_supabase_client();
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
          .order("Entry_date", { ascending: true }),
      ]);

      if (profileRes.error) {
        Set_error(Get_user_facing_error(profileRes.error.message));
        setProfile(null);
      } else {
        setProfile(profileRes.data);
        if (profileRes.data?.Weight_unit) {
          setUnit(profileRes.data.Weight_unit);
        }
      }

      if (entriesRes.error) {
        Set_error(Get_user_facing_error(entriesRes.error.message));
        setEntries([]);
      } else {
        setEntries(entriesRes.data ?? []);
      }
    } catch (err) {
      Set_error(Get_user_facing_error(err.message));
      setProfile(null);
      setEntries([]);
    }

    hasLoadedOnce.current = true;
    Set_loading(false);
  }, [user_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  Use_body_scroll_lock(
    weightModal.open,
    weightModal.closing,
    profileModal.open,
    profileModal.closing,
    Delete_modal.open,
    Delete_modal.closing,
  );

  const handleUnitChange = async (nextUnit) => {
    setUnit(nextUnit);
    if (profile) {
      try {
        const supabase = Get_supabase_client();
        await supabase
          .from("profile")
          .update({ Weight_unit: nextUnit })
          .eq("id", profile.id);
      } catch {
        // silent
      }
    }
  };

  const Open_add_weight = () => {
    setEditingEntry(null);
    setWeightForm(emptyWeightForm());
    setWeightFieldErrors({});
    setWeightFieldStates({});
    weightModal.open_modal();
  };

  const openEditWeight = (entry) => {
    const Weight_kg = Number(entry.Weight_kg);
    setEditingEntry(entry);
    setWeightForm({
      Entry_date: entry.Entry_date,
      Weight_kg: String(Weight_kg.toFixed(1)),
      weight_lbs: String(Kg_to_lbs(Weight_kg)?.toFixed(1) ?? ""),
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
      const Height_cm =
        profile.Height_cm != null ? Number(profile.Height_cm) : null;
      const { feet, inches } = Cm_to_feet_and_inches(Height_cm);
      const goalKg =
        profile.goal_weight_kg != null ? Number(profile.goal_weight_kg) : null;
      setProfileForm({
        display_name: profile.display_name ?? "",
        age: profile.age != null ? String(profile.age) : "",
        Height_cm: Height_cm != null ? String(Height_cm) : "",
        height_ft: feet,
        height_in: inches,
        goal_weight_kg: goalKg != null ? String(goalKg.toFixed(1)) : "",
        goal_weight_lbs:
          goalKg != null ? String(Kg_to_lbs(goalKg)?.toFixed(1) ?? "") : "",
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
    Set_delete_target(entry);
    Delete_modal.open_modal();
  };

  const Close_delete_modal = () => {
    Delete_modal.close_modal();
    setTimeout(() => {
      Set_delete_target(null);
    }, MODAL_EXIT_MS);
  };

  const handleHeightCmChange = (value) => {
    const cmValue = Sanitize_number(value, 1, 300);
    const { feet, inches } = Cm_to_feet_and_inches(cmValue);
    setProfileForm((current) => ({
      ...current,
      Height_cm: value,
      height_ft: cmValue != null ? feet : "",
      height_in: cmValue != null ? inches : "",
    }));
  };

  const handleGoalWeightKgChange = (value) => {
    const kgValue = Sanitize_number(value, 1, 1000);
    setProfileForm((current) => ({
      ...current,
      goal_weight_kg: value,
      goal_weight_lbs:
        kgValue != null ? String(Kg_to_lbs(kgValue)?.toFixed(1) ?? "") : "",
    }));
  };

  const handleGoalWeightLbsChange = (value) => {
    const lbsValue = Sanitize_number(value, 1, 2200);
    setProfileForm((current) => ({
      ...current,
      goal_weight_kg:
        lbsValue != null ? String(Lbs_to_kg(lbsValue)?.toFixed(2) ?? "") : "",
      goal_weight_lbs: value,
    }));
  };

  const handleWeightKgChange = (value) => {
    const kgValue = Sanitize_number(value, 1, 1000);
    setWeightForm((current) => ({
      ...current,
      Weight_kg: value,
      weight_lbs:
        kgValue != null ? String(Kg_to_lbs(kgValue)?.toFixed(1) ?? "") : "",
    }));
  };

  const handleWeightLbsChange = (value) => {
    const lbsValue = Sanitize_number(value, 1, 2200);
    setWeightForm((current) => ({
      ...current,
      Weight_kg:
        lbsValue != null ? String(Lbs_to_kg(lbsValue)?.toFixed(2) ?? "") : "",
      weight_lbs: value,
    }));
  };

  const handleHeightImperialChange = (field, value) => {
    const nextState = {
      ...profileForm,
      [field]: value,
    };
    const convertedCm = Feet_and_inches_to_cm(
      nextState.height_ft,
      nextState.height_in,
    );
    setProfileForm({
      ...nextState,
      Height_cm: convertedCm != null ? String(convertedCm) : "",
    });
  };

  const performSaveWeight = async () => {
    const Weight_kg =
      Sanitize_number(weightForm.Weight_kg, 1, 1000) ??
      Lbs_to_kg(weightForm.weight_lbs);
    const Entry_date = Sanitize_date(
      weightForm.Entry_date,
      emptyWeightForm().Entry_date,
    );
    const notes = Sanitize_text(weightForm.notes, 240);
    if (!Weight_kg || Weight_kg <= 0 || !Entry_date) return;

    Set_saving(true);
    Set_error(null);
    Set_duplicate_date_confirm(null);

    const payload = {
      Entry_date: Entry_date,
      Weight_kg: Number(Weight_kg.toFixed(2)),
      notes: notes || null,
      ...(user_id && { user_id: user_id }),
    };

    try {
      const supabase = Get_supabase_client();
      const query = editingEntry
        ? supabase
            .from("weight_entries")
            .update(payload)
            .eq("id", editingEntry.id)
        : supabase
            .from("weight_entries")
            .upsert(payload, { onConflict: "user_id,Entry_date" });

      const { error: saveError } = await query;
      Set_saving(false);

      if (saveError) {
        const rawMsg = saveError.message || "";
        // Supabase returns this when the unique constraint is missing
        if (/on conflict|no unique/i.test(rawMsg)) {
          const existing = entries.find((e) => e.Entry_date === Entry_date);
          if (existing) {
            Set_duplicate_date_confirm({
              Existing_entry: existing,
              newWeight: Weight_kg,
              newNotes: notes,
            });
            return;
          }
        }
        const friendly = /permission|duplicate|conflict/i.test(rawMsg)
          ? `Could not save — there's already an entry for ${Format_date_label(Entry_date)}. Edit the existing one instead.`
          : Get_user_facing_error(rawMsg);
        Set_error(friendly);
        Toast_error(friendly);
        return;
      }

      const isUpdate = !!editingEntry || !!Duplicate_date_confirm;
      closeWeightModal();
      Toast_success(
        isUpdate
          ? `Weight updated for ${Format_date_label(Entry_date)}.`
          : `Weight logged for ${Format_date_label(Entry_date)}.`,
      );
      fetchData();
    } catch (err) {
      Set_saving(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error("Something went wrong. Please try again.");
    }
  };

  const isWeightFormValid = useMemo(() => {
    if (!weightForm.Entry_date) return false;
    const Weight_kg =
      Sanitize_number(weightForm.Weight_kg, 1, 1000) ??
      Lbs_to_kg(weightForm.weight_lbs);
    if (!Weight_kg || Weight_kg <= 0) return false;
    return true;
  }, [weightForm]);

  const isProfileFormValid = useMemo(() => {
    if (!profileForm.display_name || !profileForm.display_name.trim())
      return false;
    const age = Sanitize_number(profileForm.age, 13, 120);
    if (!profileForm.age || age == null) return false;
    const Height_cm =
      Sanitize_number(profileForm.Height_cm, 1, 300) ??
      Feet_and_inches_to_cm(profileForm.height_ft, profileForm.height_in);
    if (!Height_cm) return false;
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
        const age = Sanitize_number(profileForm.age, 13, 120);
        if (age == null) return "Enter a valid age (13–120)";
        return null;
      }
      case "Height_cm": {
        if (!profileForm.Height_cm && !profileForm.height_ft && !profileForm.height_in)
          return "Height is required";
        const cm = Sanitize_number(profileForm.Height_cm, 1, 300);
        if (profileForm.Height_cm && cm == null) return "Enter a valid height";
        return null;
      }
      case "goal_weight_kg": {
        if (!profileForm.goal_weight_kg) return null; // optional
        const kg = Sanitize_number(profileForm.goal_weight_kg, 1, 1000);
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
      Haptic_error();
    }
  };

  const validateWeightField = (field_name) => {
    switch (field_name) {
      case "Entry_date": {
        if (!weightForm.Entry_date) return "Pick a date";
        return null;
      }
      case "Weight_kg": {
        if (!weightForm.Weight_kg && !weightForm.weight_lbs)
          return "Enter your weight";
        const kg = Sanitize_number(weightForm.Weight_kg, 1, 1000);
        if (weightForm.Weight_kg && kg == null)
          return "Must be between 1 and 1000";
        return null;
      }
      case "weight_lbs": {
        if (!weightForm.weight_lbs && !weightForm.Weight_kg)
          return "Enter your weight";
        const lbs = Sanitize_number(weightForm.weight_lbs, 1, 2200);
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
    const otherField = field_name === "Weight_kg" ? "weight_lbs" : "Weight_kg";
    const otherHasValue = !!weightForm[otherField];
    const effectiveError = otherHasValue ? null : error;

    // When one field is filled, mark both as valid
    const hasAnyWeight = weightForm.Weight_kg || weightForm.weight_lbs;
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
      Haptic_error();
    }
  };

  const saveWeight = async (e) => {
    e.preventDefault();
    const Weight_kg =
      Sanitize_number(weightForm.Weight_kg, 1, 1000) ??
      Lbs_to_kg(weightForm.weight_lbs);
    const Entry_date = Sanitize_date(
      weightForm.Entry_date,
      emptyWeightForm().Entry_date,
    );
    if (!Weight_kg || Weight_kg <= 0 || !Entry_date) {
      // Trigger validation display
      const errors = {};
      const states = {};
      if (!Entry_date) {
        errors.Entry_date = "Pick a date";
        states.Entry_date = "error";
      }
      if (!Weight_kg || Weight_kg <= 0) {
        errors.Weight_kg = "Enter your weight";
        states.Weight_kg = "error";
      }
      setWeightFieldErrors((prev) => ({ ...prev, ...errors }));
      setWeightFieldStates((prev) => ({ ...prev, ...states }));
      setWeightShakeKey((k) => k + 1);
      return;
    }

    // If adding (not editing), check for an existing entry on the same date
    if (!editingEntry) {
      const existing = entries.find((e) => e.Entry_date === Entry_date);
      if (existing) {
        Set_duplicate_date_confirm({
          Existing_entry: existing,
          newWeight: Weight_kg,
          newNotes: Sanitize_text(weightForm.notes, 240),
        });
        return;
      }
    }

    performSaveWeight();
  };

  const confirmDuplicateSave = () => {
    // User confirmed — switch to edit mode on the existing entry
    if (Duplicate_date_confirm?.Existing_entry) {
      setEditingEntry(Duplicate_date_confirm.Existing_entry);
    }
    performSaveWeight();
  };

  const closeDuplicateConfirm = () => {
    Set_duplicate_date_confirm(null);
  };

  const Save_profile = async (e) => {
    e.preventDefault();
    Set_saving(true);
    Set_error(null);

    const goalKg =
      Sanitize_number(profileForm.goal_weight_kg, 1, 1000) ??
      Lbs_to_kg(profileForm.goal_weight_lbs);
    const display_name = Sanitize_text(profileForm.display_name, 40) || "Jas";
    const age = Sanitize_number(profileForm.age, 13, 120);
    const heightCmFromCm = Sanitize_number(profileForm.Height_cm, 1, 300);
    const heightCmFromImperial = Feet_and_inches_to_cm(
      profileForm.height_ft,
      profileForm.height_in,
    );
    const Height_cm = heightCmFromCm ?? heightCmFromImperial;

    const payload = {
      display_name: display_name,
      age,
      Height_cm: Height_cm ?? null,
      goal_weight_kg: goalKg ? Number(goalKg.toFixed(2)) : null,
      gender: profileForm.gender,
      activity_level: profileForm.activity_level,
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

      closeProfileModal();
      Toast_success("Profile saved.");
      fetchData();
    } catch (err) {
      Set_saving(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error("Couldn't save profile.");
    }
  };

  const Confirm_delete = async () => {
    if (!Delete_target) return;
    const targetId = Delete_target.id;

    Set_deleting(true);
    Set_removing_id(targetId);
    Close_delete_modal();

    // wait for the exit animation, then optimistically remove it
    await new Promise((resolve) => setTimeout(resolve, 240));
    setEntries((prev) => prev.filter((e) => e.id !== targetId));
    Set_removing_id(null);

    try {
      const supabase = Get_supabase_client();
      const { error: deleteError } = await supabase
        .from("weight_entries")
        .delete()
        .eq("id", targetId);

      Set_deleting(false);

      if (deleteError) {
        Set_error(Get_user_facing_error(deleteError.message));
        Toast_error("Failed to delete weight entry.");
        fetchData(); // resync in case the optimistic update was wrong
        return;
      }

      Toast_success("Entry deleted.");
      fetchData(); // quiet background resync, no Loading flash now
    } catch (err) {
      Set_deleting(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error("Couldn't delete entry.");
      fetchData();
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    try {
      const supabase = Get_supabase_client();
      const { error } = await supabase.rpc("delete_current_user");
      if (error) throw error;
      deleteAccountModal.close_modal();
      Toast_success("Account deleted.");
      await supabase.auth.signOut();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
  };

  const analytics = useMemo(() => {
    const sorted = [...entries].sort((a, b) =>
      a.Entry_date.localeCompare(b.Entry_date),
    );
    const latest = sorted[sorted.length - 1];
    const first = sorted[0];
    const Height_cm = profile?.Height_cm ? Number(profile.Height_cm) : null;
    const goalKg = profile?.goal_weight_kg
      ? Number(profile.goal_weight_kg)
      : null;
    const age = profile?.age ? Number(profile.age) : null;

    const currentKg = latest ? Number(latest.Weight_kg) : null;
    const startKg = first ? Number(first.Weight_kg) : null;
    const totalChangeKg =
      currentKg != null && startKg != null && sorted.length > 1
        ? currentKg - startKg
        : null;

    let weeklyChangeKg = null;
    if (sorted.length >= 2 && totalChangeKg != null) {
      const spanDays = Days_between(first.Entry_date, latest.Entry_date);
      weeklyChangeKg = (totalChangeKg / spanDays) * 7;
    }

    const bmi = Calc_bmi(currentKg, Height_cm);
    const range = Healthy_weight_range_kg(Height_cm);

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

    const insight = Build_insight({
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
      bmiCategory: Bmi_label(bmi),
      range,
      goalProgress,
      remainingKg,
      goalKg,
      Height_cm,
      age,
      insight,
      sorted,
    };
  }, [entries, profile]);

  const display_name = profile?.display_name || "";
  const unitLabel = unit === "kg" ? "kg" : "lbs";

  return (
    <section>
      <Page_header
        className="profile__header"
        eyebrow={
          Household_name ? `Progress · ${Household_name}` : "Your progress"
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
      </Page_header>

      {error && (
        <p className="profile__error profile__error--glass" role="alert">
          {error}
        </p>
      )}

      {Loading ? (
        <div className="profile__summary">
          <Loading_skeleton count={4} variant="stat" contents />
          <div style={{ gridColumn: "span 2", marginTop: "1rem" }}>
            <Loading_skeleton count={1} variant="card" height="10rem" />
          </div>
        </div>
      ) : (
        <>
          <Profile_stats analytics={analytics} unit={unit} unitLabel={unitLabel} />

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
                onClick={Open_add_weight}
                ref={logWeightBtnRef}
              >
                + Log weight
              </button>
            </div>
            <Weight_chart
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
                      {Format_weight_both(analytics.goalKg)}
                    </strong>
                  </span>
                  {analytics.remainingKg != null && (
                    <span>
                      {analytics.remainingKg > 0
                        ? `${Format_weight_both(analytics.remainingKg)} to go`
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
            {analytics.range && analytics.Height_cm && (
              <p className="profile__insight-meta">
                Healthy weight for your height:{" "}
                <strong>
                  {Format_weight_both(analytics.range.min, 0)}
                  {" – "}
                  {Format_weight_both(analytics.range.max, 0)}
                </strong>
                {analytics.age ? ` · Age ${analytics.age}` : ""}
              </p>
            )}
            {analytics.Height_cm && (
              <p className="profile__insight-meta">
                Height: {Format_height(analytics.Height_cm)}
              </p>
            )}
            {!analytics.Height_cm && (
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
            <Profile_history
              sorted={analytics.sorted}
              Removing_id={Removing_id}
              unit={unit}
              unitLabel={unitLabel}
              onEdit={openEditWeight}
              onDelete={openDeleteConfirm}
            />
          </section>
        </>
      )}

      {/* Weight Log/Edit Modal */}
      <Weight_form
        weightModal={weightModal}
        weightForm={weightForm}
        setWeightForm={setWeightForm}
        editingEntry={editingEntry}
        Saving={Saving}
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
      <Sheet_modal
        open={profileModal.open}
        closing={profileModal.closing}
        onClose={closeProfileModal}
        title="Edit profile"
      >
        <form className="profile__form" onSubmit={Save_profile}>
          <Form_field
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
          </Form_field>
          <Form_field
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
          </Form_field>
          <Form_field
            label="Height (cm)"
            error={profileFieldErrors.Height_cm}
            state={profileFieldStates.Height_cm}
            show_indicator
            shake={profileFieldErrors.Height_cm ? profileShakeKey : 0}
          >
            <input
              type="number"
              step="0.1"
              min="1"
              placeholder="165"
              value={profileForm.Height_cm}
              onChange={(e) => {
                handleHeightCmChange(e.target.value);
                setProfileFieldErrors((prev) => ({
                  ...prev,
                  Height_cm: null,
                }));
              }}
              onBlur={() => handleProfileFieldBlur("Height_cm")}
            />
          </Form_field>
          <div className="profile__height-row">
            <Form_field label="Feet">
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
            </Form_field>
            <Form_field label="Inches">
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
            </Form_field>
          </div>
          <div className="profile__weight-row">
            <Form_field
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
            </Form_field>
            <Form_field label="Goal weight (lbs)" optional>
              <input
                type="number"
                step="0.1"
                min="1"
                placeholder="128"
                value={profileForm.goal_weight_lbs}
                onChange={(e) => handleGoalWeightLbsChange(e.target.value)}
              />
            </Form_field>
          </div>

          <Form_field
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
          </Form_field>
          <Form_field
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
          </Form_field>

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
              disabled={Saving || !isProfileFormValid}
            >
              {Saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </Sheet_modal>

      {/* Delete Confirmation Modal */}
      {Delete_target && (
        <Confirm_modal
          open={Delete_modal.open}
          closing={Delete_modal.closing}
          onClose={Close_delete_modal}
          onConfirm={Confirm_delete}
          Loading={Deleting}
          title="Delete weigh-in?"
          description={`Remove ${Format_date_label(Delete_target.Entry_date)} (${Format_weight_both(Number(Delete_target.Weight_kg))})?`}
          confirm_label="Delete"
          variant="danger"
        />
      )}

      {/* Duplicate Date Confirmation */}
      {Duplicate_date_confirm && (
        <Sheet_modal
          open={!!Duplicate_date_confirm}
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
            {Format_date_label(Duplicate_date_confirm.Existing_entry.Entry_date)}
          </h2>
          <p className="profile__dup-desc">
            You have{" "}
            <strong>
              {Format_weight_both(Number(Duplicate_date_confirm.Existing_entry.Weight_kg))}
            </strong>{" "}
            recorded for this day.
          </p>
          <p className="profile__dup-desc">
            Updating to{" "}
            <strong>
              {Format_weight_both(Duplicate_date_confirm.newWeight)}
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
              disabled={Saving}
            >
              {Saving ? "Updating…" : "Update entry"}
            </button>
          </div>
        </Sheet_modal>
      )}

      <FAB
        visible={Show_floating_actions}
        on_scroll_top={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        on_add={Open_add_weight}
        add_label="Log weight"
      />

      {/* Delete Account Confirmation */}
      <Confirm_modal
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
