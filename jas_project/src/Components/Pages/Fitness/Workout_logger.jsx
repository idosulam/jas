import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase";
import { Use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  Get_user_facing_error,
  Sanitize_date,
  Sanitize_number,
  Sanitize_text,
  Format_date_friendly,
  Haptic_error,
} from "../../../Lib/Security";
import { Use_body_scroll_lock, Use_modal } from "../../../Hooks";
import { Use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";

import Sheet_modal from "../../../Components/UI/Modals/Sheet_modal";
import Confirm_modal from "../../../Components/UI/Modals/Confirm_modal";
import Form_field from "../../../Components/UI/Form/Form_field.jsx";
import Empty_state from "../../../Components/UI/Empty_state";
import Loading_skeleton from "../../../Components/UI/Loading_skeleton";
import Glass_card from "../../../Components/UI/Glass_card";
import FAB from "../../../Components/UI/Fab";

import { Kg_to_lbs } from "../../../Lib/Weight";

import {
  MODAL_EXIT_MS,
  WEEKDAYS,
  Empty_exercise,
  Empty_form,
  Calc_volume,
  Format_volume,
} from "./Workout_utils";
import Exercise_row from "./Exercise_row";
import Workout_card from "./Workout_card";
import Workout_form from "./Workout_form";

function Workout_logger() {
  const user_id = Use_user_id();
  const now = new Date();
  const [Selected_date, Set_selected_date] = useState(now);
  const [View_mode, Set_view_mode] = useState("week");
  const [workouts, setWorkouts] = useState([]);
  const [Loading, Set_loading] = useState(true);
  const [error, Set_error] = useState(null);
  const [form, Set_form] = useState(Empty_form());
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [Saving, Set_saving] = useState(false);
  const [Delete_target, Set_delete_target] = useState(null);
  const [Deleting, Set_deleting] = useState(false);
  const [Removing_id, Set_removing_id] = useState(null);
  const [Field_errors, Set_field_errors] = useState({});
  const [Field_states, Set_field_states] = useState({});
  const [Shake_key, Set_shake_key] = useState(0);
  const [Presets, Set_presets] = useState([]);
  const [Editing_preset, Set_editing_preset] = useState(null);
  const [Preset_form, Set_preset_form] = useState({
    name: "",
    exercises: [Empty_exercise()],
  });
  const [presetFieldErrors, setPresetFieldErrors] = useState({});
  const [presetFieldStates, setPresetFieldStates] = useState({});
  const [presetShakeKey, setPresetShakeKey] = useState(0);
  const [Expanded_note_id, Set_expanded_note_id] = useState(null);
  const [Show_floating_actions, Set_show_floating_actions] = useState(false);
  const Add_btn_ref = useRef(null);

  const Form_modal = Use_modal(MODAL_EXIT_MS);
  const Delete_modal = Use_modal(MODAL_EXIT_MS);
  const Preset_modal = Use_modal(MODAL_EXIT_MS);

  const { success: Toast_success, error: Toast_error } = Use_glass_toast();

  // Week helpers
  const Start_of_week = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const Add_days = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  };

  const To_date_key = (date) => date.toISOString().slice(0, 10);

  const Selected_key = To_date_key(Selected_date);
  const Is_today = Selected_key === To_date_key(now);

  const Week_days = useMemo(() => {
    const start = Start_of_week(Selected_date);
    return Array.from({ length: 7 }, (_, i) => Add_days(start, i));
  }, [Selected_date]);

  const Month_days = useMemo(() => {
    const d = new Date(Selected_date);
    const start = Start_of_week(new Date(d.getFullYear(), d.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => Add_days(start, i));
  }, [Selected_date]);

  const Visible_days = View_mode === "week" ? Week_days : Month_days;

  const Day_title = useMemo(() => {
    return Selected_date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [Selected_date]);

  // ── Fetch workouts ──
  const fetchWorkouts = useCallback(async () => {
    if (!user_id) return;
    Set_loading(true);
    Set_error(null);

    const d = new Date(Selected_date);
    const range_start =
      View_mode === "week"
        ? Start_of_week(d)
        : new Date(d.getFullYear(), d.getMonth(), 1);
    const range_end =
      View_mode === "week"
        ? Add_days(range_start, 6)
        : new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startDate = To_date_key(range_start);
    const endDate = To_date_key(range_end);

    try {
      const supabase = Get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", user_id)
        .gte("workout_date", startDate)
        .lte("workout_date", endDate)
        .order("workout_date", { ascending: true });

      if (fetch_error) {
        Set_error(Get_user_facing_error(fetch_error.message));
        setWorkouts([]);
      } else {
        setWorkouts(data ?? []);
      }
    } catch (err) {
      Set_error(Get_user_facing_error(err.message));
      setWorkouts([]);
    }
    Set_loading(false);
  }, [Selected_date, View_mode, user_id]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  // ── Fetch Presets ──
  const Fetch_presets = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = Get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("workout_presets")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: true });
      if (!fetch_error) Set_presets(data ?? []);
    } catch {
      // silent
    }
  }, [user_id]);

  useEffect(() => {
    Fetch_presets();
  }, [Fetch_presets]);

  Use_body_scroll_lock(Form_modal.open, Delete_modal.open, Preset_modal.open);

  // ── Floating actions observer ──
  useEffect(() => {
    const target = Add_btn_ref.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const scrolledPastIt =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        Set_show_floating_actions(scrolledPastIt);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // ── Summary stats ──
  const totals = useMemo(() => {
    return workouts.reduce(
      (acc, w) => {
        const exercises = Array.isArray(w.exercises) ? w.exercises : [];
        acc.workouts += 1;
        acc.volume += Calc_volume(exercises);
        acc.duration += parseInt(w.duration_minutes, 10) || 0;
        acc.calories += parseInt(w.Calories_burned, 10) || 0;
        return acc;
      },
      { workouts: 0, volume: 0, duration: 0, calories: 0 },
    );
  }, [workouts]);

  // ── Form: exercise helpers ──
  const Add_exercise = () => {
    if (form.exercises.length >= 20) return;
    Set_form((f) => ({
      ...f,
      exercises: [...f.exercises, Empty_exercise()],
    }));
  };

  const Remove_exercise = (index) => {
    Set_form((f) => ({
      ...f,
      exercises: f.exercises.filter((_, i) => i !== index),
    }));
  };

  const updateExercise = (index, field, value) => {
    Set_form((f) => {
      const next = [...f.exercises];
      next[index] = { ...next[index], [field]: value };
      return { ...f, exercises: next };
    });
    // Re-validate if field was previously validated (has a state)
    const key = `${index}_${field}`;
    if (Field_states[key]) {
      const err = validateExerciseField(index, field, value);
      Set_field_errors((prev) => ({ ...prev, [key]: err }));
      Set_field_states((prev) => ({
        ...prev,
        [key]: err ? "error" : value ? "valid" : "idle",
      }));
    }
    // Also re-validate the paired weight field
    const pairedField = field === "weight" ? "weight_lbs" : field === "weight_lbs" ? "weight" : null;
    if (pairedField) {
      const pairedKey = `${index}_${pairedField}`;
      if (Field_states[pairedKey]) {
        // Compute the paired value from the current form state
        const pairedValue = field === "weight" ? Kg_to_lbs(value) : Lbs_to_kg(value);
        const err = validateExerciseField(index, pairedField, pairedValue);
        Set_field_errors((prev) => ({ ...prev, [pairedKey]: err }));
        Set_field_states((prev) => ({
          ...prev,
          [pairedKey]: err ? "error" : pairedValue ? "valid" : "idle",
        }));
      }
    }
  };

  // ── Modal open/close ──
  const Open_add_modal = () => {
    setEditingWorkout(null);
    const f = Empty_form();
    f.workout_date = Selected_key;
    Set_form(f);
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  const Open_edit_modal = (workout) => {
    setEditingWorkout(workout);
    const exercises =
      Array.isArray(workout.exercises) && workout.exercises.length > 0
        ? workout.exercises.map((ex) => ({
            ...ex,
            weight_lbs: ex.weight ? Kg_to_lbs(ex.weight) : "",
          }))
        : [Empty_exercise()];
    Set_form({
      workout_date: workout.workout_date,
      preset_name: workout.preset_name ?? "",
      exercises,
      notes: workout.notes ?? "",
      duration_minutes: workout.duration_minutes
        ? String(workout.duration_minutes)
        : "",
      Calories_burned: workout.Calories_burned
        ? String(workout.Calories_burned)
        : "",
    });
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  const Close_form_modal = () => {
    Form_modal.close_modal();
    setTimeout(() => {
      setEditingWorkout(null);
      Set_form(Empty_form());
      Set_field_states({});
    }, MODAL_EXIT_MS);
  };

  // ── Presets ──
  const Open_preset_modal = (preset = null) => {
    if (preset) {
      Set_editing_preset(preset);
      const exercises =
        Array.isArray(preset.exercises) && preset.exercises.length > 0
          ? preset.exercises
          : [Empty_exercise()];
      Set_preset_form({ name: preset.name, exercises });
    } else {
      Set_editing_preset(null);
      Set_preset_form({ name: "", exercises: [Empty_exercise()] });
    }
    setPresetFieldErrors({});
    setPresetFieldStates({});
    Preset_modal.open_modal();
  };

  const Close_preset_modal = () => {
    Preset_modal.close_modal();
    setTimeout(() => {
      Set_editing_preset(null);
      setPresetFieldStates({});
    }, MODAL_EXIT_MS);
  };

  const addPresetExercise = () => {
    if (Preset_form.exercises.length >= 20) return;
    Set_preset_form((f) => ({
      ...f,
      exercises: [...f.exercises, Empty_exercise()],
    }));
  };

  const removePresetExercise = (index) => {
    Set_preset_form((f) => ({
      ...f,
      exercises: f.exercises.filter((_, i) => i !== index),
    }));
  };

  const updatePresetExercise = (index, field, value) => {
    Set_preset_form((f) => {
      const next = [...f.exercises];
      next[index] = { ...next[index], [field]: value };
      return { ...f, exercises: next };
    });
    // Re-validate if field was previously validated
    const key = `${index}_${field}`;
    if (presetFieldStates[key]) {
      const err = validatePresetExerciseField(index, field, value);
      setPresetFieldErrors((prev) => ({ ...prev, [key]: err }));
      setPresetFieldStates((prev) => ({
        ...prev,
        [key]: err ? "error" : value ? "valid" : "idle",
      }));
    }
    // Also re-validate the paired weight field
    const pairedField = field === "weight" ? "weight_lbs" : field === "weight_lbs" ? "weight" : null;
    if (pairedField) {
      const pairedKey = `${index}_${pairedField}`;
      if (presetFieldStates[pairedKey]) {
        const pairedValue = field === "weight" ? Kg_to_lbs(value) : Lbs_to_kg(value);
        const err = validatePresetExerciseField(index, pairedField, pairedValue);
        setPresetFieldErrors((prev) => ({ ...prev, [pairedKey]: err }));
        setPresetFieldStates((prev) => ({
          ...prev,
          [pairedKey]: err ? "error" : pairedValue ? "valid" : "idle",
        }));
      }
    }
  };

  const validatePresetExerciseField = (index, field, overrideValue) => {
    const ex = Preset_form.exercises[index];
    if (!ex) return null;
    const val = overrideValue !== undefined ? overrideValue : ex[field];
    switch (field) {
      case "name":
        return !val || !val.trim() ? "Required" : null;
      case "weight":
      case "weight_lbs": {
        if (!val && val !== 0) return "Required";
        const n = Sanitize_number(val, 0, 9999);
        return n == null ? "Invalid" : null;
      }
      case "sets": {
        if (!val && val !== 0) return "Required";
        const n = Sanitize_number(val, 0, 999);
        return n == null ? "Invalid" : null;
      }
      case "reps": {
        if (!val && val !== 0) return "Required";
        const n = Sanitize_number(val, 0, 9999);
        return n == null ? "Invalid" : null;
      }
      default:
        return null;
    }
  };

  const handlePresetExerciseFieldBlur = (index, field) => {
    const err = validatePresetExerciseField(index, field);
    const key = `${index}_${field}`;
    setPresetFieldErrors((prev) => ({ ...prev, [key]: err }));
    setPresetFieldStates((prev) => ({
      ...prev,
      [key]: err ? "error" : Preset_form.exercises[index]?.[field] ? "valid" : "idle",
    }));
    if (err) {
      setPresetShakeKey((k) => k + 1);
      Haptic_error();
    }
    // Also validate the paired weight field
    const pairedField = field === "weight" ? "weight_lbs" : field === "weight_lbs" ? "weight" : null;
    if (pairedField) {
      const pairedKey = `${index}_${pairedField}`;
      const pairedVal = Preset_form.exercises[index]?.[pairedField];
      const pairedErr = validatePresetExerciseField(index, pairedField);
      setPresetFieldErrors((prev) => ({ ...prev, [pairedKey]: pairedErr }));
      setPresetFieldStates((prev) => ({
        ...prev,
        [pairedKey]: pairedErr ? "error" : pairedVal ? "valid" : "idle",
      }));
    }
  };

  const Save_preset = useCallback(async () => {
    const name = Preset_form.name.trim();
    if (!name) return;
    const cleanedExercises = Preset_form.exercises
      .filter((ex) => ex.name.trim())
      .map((ex) => ({
        name: Sanitize_text(ex.name, 80),
        weight: ex.weight || "",
        sets: ex.sets || "",
        reps: ex.reps || "",
      }));
    const payload = {
      name,
      exercises: cleanedExercises,
      ...(user_id && { user_id: user_id }),
    };
    try {
      const supabase = Get_supabase_client();
      let dbError;
      if (Editing_preset) {
        ({ error: dbError } = await supabase
          .from("workout_presets")
          .update(payload)
          .eq("id", Editing_preset.id));
      } else {
        ({ error: dbError } = await supabase
          .from("workout_presets")
          .insert(payload));
      }
      if (dbError) {
        Toast_error(Get_user_facing_error(dbError.message));
        return;
      }
      Close_preset_modal();
      Toast_success(Editing_preset ? "Preset updated." : "Preset created.");
      Fetch_presets();
    } catch (err) {
      Toast_error(Get_user_facing_error(err.message));
    }
  }, [
    Preset_form,
    Editing_preset,
    Fetch_presets,
    Toast_success,
    Toast_error,
    user_id,
  ]);

  const Delete_preset = useCallback(
    async (id) => {
      try {
        const supabase = Get_supabase_client();
        const { error: dbError } = await supabase
          .from("workout_presets")
          .delete()
          .eq("id", id);
        if (dbError) {
          Toast_error(Get_user_facing_error(dbError.message));
          return;
        }
        Toast_success("Preset removed.");
        Fetch_presets();
      } catch (err) {
        Toast_error(Get_user_facing_error(err.message));
      }
    },
    [Fetch_presets, Toast_success, Toast_error],
  );

  const applyPreset = (preset) => {
    const exercises =
      Array.isArray(preset.exercises) && preset.exercises.length > 0
        ? preset.exercises.map((ex) => ({
            ...ex,
            name: Sanitize_text(ex.name, 80),
            weight_lbs: ex.weight ? Kg_to_lbs(ex.weight) : "",
          }))
        : [Empty_exercise()];
    setEditingWorkout(null);
    Set_form({
      workout_date: new Date().toISOString().slice(0, 10),
      preset_name: preset.name,
      exercises,
      notes: "",
      duration_minutes: "",
    });
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  // ── Validation ──
  const Validate_field = (field_name, value) => {
    switch (field_name) {
      case "workout_date":
        return !value ? "Pick a date" : null;
      case "preset_name":
        return !value || !value.trim() ? "Workout name is required" : null;
      case "Calories_burned": {
        if (!value) return null;
        const n = Sanitize_number(value, 0, 9999);
        return n == null ? "Enter a valid number" : null;
      }
      default:
        return null;
    }
  };

  const validateExerciseField = (index, field, overrideValue) => {
    const ex = form.exercises[index];
    if (!ex) return null;
    const val = overrideValue !== undefined ? overrideValue : ex[field];
    switch (field) {
      case "name":
        return !val || !val.trim() ? "Required" : null;
      case "weight":
      case "weight_lbs": {
        if (!val && val !== 0) return "Required";
        const n = Sanitize_number(val, 0, 9999);
        return n == null ? "Invalid" : null;
      }
      case "sets": {
        if (!val && val !== 0) return "Required";
        const n = Sanitize_number(val, 0, 999);
        return n == null ? "Invalid" : null;
      }
      case "reps": {
        if (!val && val !== 0) return "Required";
        const n = Sanitize_number(val, 0, 9999);
        return n == null ? "Invalid" : null;
      }
      default:
        return null;
    }
  };

  const Handle_field_blur = (field_name) => {
    const err = Validate_field(field_name, form[field_name]);
    Set_field_errors((prev) => ({ ...prev, [field_name]: err }));
    Set_field_states((prev) => ({
      ...prev,
      [field_name]: err ? "error" : form[field_name] ? "valid" : "idle",
    }));
    if (err) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };

  const handleExerciseFieldBlur = (index, field) => {
    const err = validateExerciseField(index, field);
    const key = `${index}_${field}`;
    Set_field_errors((prev) => ({ ...prev, [key]: err }));
    Set_field_states((prev) => ({
      ...prev,
      [key]: err ? "error" : form.exercises[index]?.[field] ? "valid" : "idle",
    }));
    if (err) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
    // Also validate the paired weight field
    const pairedField = field === "weight" ? "weight_lbs" : field === "weight_lbs" ? "weight" : null;
    if (pairedField) {
      const pairedKey = `${index}_${pairedField}`;
      const pairedVal = form.exercises[index]?.[pairedField];
      const pairedErr = validateExerciseField(index, pairedField);
      Set_field_errors((prev) => ({ ...prev, [pairedKey]: pairedErr }));
      Set_field_states((prev) => ({
        ...prev,
        [pairedKey]: pairedErr ? "error" : pairedVal ? "valid" : "idle",
      }));
    }
  };

  const exerciseErrors = {};
  const exerciseStates = {};
  Object.keys(Field_errors).forEach((k) => {
    if (k.includes("_")) exerciseErrors[k] = Field_errors[k];
  });
  Object.keys(Field_states).forEach((k) => {
    if (k.includes("_")) exerciseStates[k] = Field_states[k];
  });

  const Is_form_valid = useMemo(() => {
    if (!form.workout_date) return false;
    if (!form.preset_name || !form.preset_name.trim()) return false;
    const hasAtLeastOneExercise = form.exercises.some(
      (ex) =>
        ex.name.trim() &&
        (ex.weight || ex.weight_lbs) &&
        ex.sets &&
        ex.reps,
    );
    return hasAtLeastOneExercise;
  }, [form]);

  // ── Submit ──
  const Handle_submit = async (e) => {
    e.preventDefault();

    const workoutDate = Sanitize_date(
      form.workout_date,
      new Date().toISOString().slice(0, 10),
    );
    if (!workoutDate) {
      Set_field_errors({ workout_date: "Pick a date" });
      Set_field_states({ workout_date: "error" });
      Set_shake_key((k) => k + 1);
      return;
    }

    const cleanedExercises = form.exercises
      .filter((ex) => ex.name.trim())
      .map((ex) => ({
        name: Sanitize_text(ex.name, 80),
        weight: String(Sanitize_number(ex.weight, 0, 9999) ?? ""),
        sets: String(Sanitize_number(ex.sets, 0, 999) ?? ""),
        reps: String(Sanitize_number(ex.reps, 0, 9999) ?? ""),
      }));

    if (cleanedExercises.length === 0) {
      Set_field_errors({ exercises: "Add at least one exercise" });
      Set_shake_key((k) => k + 1);
      return;
    }

    const workoutName = form.preset_name.trim();
    if (!workoutName) {
      Set_field_errors({ preset_name: "Workout name is required" });
      Set_field_states({ preset_name: "error" });
      Set_shake_key((k) => k + 1);
      return;
    }

    const duration = Sanitize_number(form.duration_minutes, 1, 600);
    const Calories_burned = Sanitize_number(form.Calories_burned, 0, 9999);
    const notes = form.notes.trim() ? Sanitize_text(form.notes, 500) : null;

    Set_saving(true);
    Set_error(null);

    const payload = {
      workout_date: workoutDate,
      preset_name: workoutName,
      exercises: cleanedExercises,
      notes,
      duration_minutes: duration ?? null,
      Calories_burned: Calories_burned ?? null,
      ...(user_id && { user_id: user_id }),
    };

    try {
      const supabase = Get_supabase_client();
      let dbError;
      if (editingWorkout) {
        ({ error: dbError } = await supabase
          .from("workout_logs")
          .update(payload)
          .eq("id", editingWorkout.id));
      } else {
        ({ error: dbError } = await supabase
          .from("workout_logs")
          .insert(payload));
      }

      Set_saving(false);

      if (dbError) {
        const message = Get_user_facing_error(dbError.message);
        Set_error(message);
        Toast_error(
          editingWorkout
            ? "Couldn't update workout."
            : "Couldn't save workout.",
        );
        return;
      }

      Close_form_modal();
      Toast_success(editingWorkout ? "Workout updated." : "Workout logged.");
      fetchWorkouts();
    } catch (err) {
      Set_saving(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error(
        editingWorkout ? "Couldn't update workout." : "Couldn't save workout.",
      );
    }
  };

  // ── Delete ──
  const openDeleteModal = (workout) => {
    Set_delete_target(workout);
    Delete_modal.open_modal();
  };

  const Close_delete_modal = () => {
    Delete_modal.close_modal();
    setTimeout(() => {
      Set_delete_target(null);
    }, MODAL_EXIT_MS);
  };

  const Confirm_delete = async () => {
    if (!Delete_target) return;
    Set_deleting(true);
    Set_error(null);

    try {
      const supabase = Get_supabase_client();
      const { error: dbError } = await supabase
        .from("workout_logs")
        .delete()
        .eq("id", Delete_target.id);

      Set_deleting(false);

      if (dbError) {
        Set_error(Get_user_facing_error(dbError.message));
        Toast_error("Failed to delete workout.");
        return;
      }

      const removedId = Delete_target.id;
      Close_delete_modal();
      Toast_success("Workout deleted.");
      Set_removing_id(removedId);
      setTimeout(() => {
        setWorkouts((prev) => prev.filter((w) => w.id !== removedId));
        Set_removing_id(null);
      }, 380);
    } catch (err) {
      Set_deleting(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error("Failed to delete workout.");
    }
  };

  return (
    <div className="fitness__workout">
      {/* Weekly date navigation */}
      <div className="fitness__date-nav animate-in animate-in--1">
        <div className="fitness__date-top">
          <button
            type="button"
            className="fitness__date-btn"
            onClick={() => Set_selected_date((d) => Add_days(d, View_mode === "week" ? -7 : -30))}
            aria-label="Previous day"
          >
            ‹
          </button>
          <span className="fitness__date-label">{Day_title}</span>
          <button
            type="button"
            className="fitness__date-btn"
            onClick={() => Set_selected_date((d) => Add_days(d, View_mode === "week" ? 7 : 30))}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
        {!Is_today && (
          <button
            type="button"
            className="fitness__date-today"
            onClick={() => Set_selected_date(new Date())}
          >
            Today
          </button>
        )}
      </div>

      {/* Week day selector */}
      <div
        className={`fitness__week-days animate-in animate-in--1${View_mode === "month" ? " fitness__week-days--month" : ""}`}
        role="group"
        aria-label={View_mode === "week" ? "Week days" : "Month days"}
      >
        {Visible_days.map((day) => {
          const key = To_date_key(day);
          const isSelected = key === Selected_key;
          const isDayToday = key === To_date_key(now);
          const hasWorkout = workouts.some((w) => w.workout_date === key);
          const isInCurrentMonth =
            View_mode === "month"
              ? day.getMonth() === Selected_date.getMonth()
              : true;

          return (
            <button
              key={key}
              type="button"
              className={`fitness__week-day${isSelected ? " fitness__week-day--active" : ""}${isDayToday ? " fitness__week-day--today" : ""}${hasWorkout ? " fitness__week-day--busy" : ""}${!isInCurrentMonth ? " fitness__week-day--muted" : ""}`}
              onClick={() => Set_selected_date(day)}
              aria-pressed={isSelected}
            >
              <span className="fitness__week-day-label">
                {WEEKDAYS[day.getDay()]}
              </span>
              <span className="fitness__week-day-num">{day.getDate()}</span>
              {hasWorkout && (
                <span className="fitness__week-day-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* View toggle */}
      <div
        className="fitness__view-toggle animate-in animate-in--2"
        role="tablist"
        aria-label="Workout view"
      >
        <button
          type="button"
          className={`fitness__view-btn${View_mode === "week" ? " fitness__view-btn--active" : ""}`}
          onClick={() => Set_view_mode("week")}
          aria-pressed={View_mode === "week"}
        >
          1 week
        </button>
        <button
          type="button"
          className={`fitness__view-btn${View_mode === "month" ? " fitness__view-btn--active" : ""}`}
          onClick={() => Set_view_mode("month")}
          aria-pressed={View_mode === "month"}
        >
          1 month
        </button>
      </div>

      {/* Summary */}
      <div
        className="fitness__summary animate-in animate-in--2"
        key={Selected_key}
      >
        <Glass_card
          value={String(totals.workouts)}
          label="Workouts"
          className="fitness__stat fitness__stat--workout"
        />
        <Glass_card
          value={Format_volume(totals.volume)}
          label="Volume (kg)"
          className="fitness__stat fitness__stat--workout"
        />
        <Glass_card
          value={totals.duration > 0 ? `${totals.duration}m` : "—"}
          label="Duration"
          className="fitness__stat fitness__stat--workout"
        />
        <Glass_card
          value={totals.calories > 0 ? `${totals.calories}` : "—"}
          label="Cal Burned"
          className="fitness__stat fitness__stat--workout"
        />
      </div>

      {error && (
        <p className="fitness__error fitness__error--shake" role="alert">
          {error}
        </p>
      )}

      {/* Presets */}
      <div className="fitness__templates animate-in animate-in--3">
        {Presets.map((preset) => (
          <div key={preset.id} className="fitness__preset">
            <button
              type="button"
              className="fitness__template-chip"
              onClick={() => applyPreset(preset)}
            >
              {preset.name}
            </button>
            <button
              type="button"
              className="fitness__preset-edit"
              onClick={() => Open_preset_modal(preset)}
              aria-label={`Edit ${preset.name} preset`}
            >
              ✎
            </button>
          </div>
        ))}
        <button
          type="button"
          className="fitness__template-chip fitness__template-chip--add"
          onClick={() => Open_preset_modal()}
        >
          + New preset
        </button>
      </div>

      {/* List header */}
      <div className="fitness__list-header animate-in animate-in--4">
        <h2 className="fitness__list-title">{Day_title}</h2>
        <button
          type="button"
          className="fitness__add-btn"
          onClick={Open_add_modal}
          ref={Add_btn_ref}
        >
          + Add workout
        </button>
      </div>

      {/* Workout list */}
      {Loading ? (
        <div className="fitness__list">
          <Loading_skeleton count={3} height="5.5rem" />
        </div>
      ) : workouts.length === 0 ? (
        <Empty_state
          className="fitness__empty"
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6.5 6.5h11M6.5 17.5h11M3 12h2m14 0h2M6 12h12" />
              <rect x="1" y="8" width="4" height="8" rx="1" />
              <rect x="19" y="8" width="4" height="8" rx="1" />
            </svg>
          }
          title="No workouts this week"
          text='Tap "+ Add workout" to log your first one.'
        />
      ) : (
        <ul className="fitness__list" key={`list-${Selected_key}`}>
          {workouts.map((workout, index) => (
            <Workout_card
              key={workout.id}
              workout={workout}
              index={index}
              onEdit={Open_edit_modal}
              onDelete={openDeleteModal}
              onToggleNote={(id) =>
                Set_expanded_note_id(Expanded_note_id === id ? null : id)
              }
              Expanded_note_id={Expanded_note_id}
              isRemoving={Removing_id === workout.id}
            />
          ))}
        </ul>
      )}

      {/* Add/Edit Workout Modal */}
      <Workout_form
        open={Form_modal.open}
        closing={Form_modal.closing}
        onClose={Close_form_modal}
        editingWorkout={editingWorkout}
        form={form}
        Set_form={Set_form}
        Field_errors={Field_errors}
        Field_states={Field_states}
        Shake_key={Shake_key}
        Saving={Saving}
        Is_form_valid={Is_form_valid}
        on_add_exercise={Add_exercise}
        onRemoveExercise={Remove_exercise}
        onUpdateExercise={updateExercise}
        onSubmit={Handle_submit}
        onFieldBlur={Handle_field_blur}
        exerciseCount={form.exercises.length}
        exerciseErrors={exerciseErrors}
        exerciseStates={exerciseStates}
        onExerciseFieldBlur={handleExerciseFieldBlur}
      />

      {/* Preset Modal */}
      <Sheet_modal
        open={Preset_modal.open}
        closing={Preset_modal.closing}
        onClose={Close_preset_modal}
        title={Editing_preset ? "Edit preset" : "Create preset"}
      >
        <p className="fitness__preset-hint">
          Presets let you quick-add common workouts with one tap.
        </p>
        <div className="fitness__form">
          <Form_field
            label="Preset name"
            error={presetFieldErrors.preset_name}
            state={presetFieldStates.preset_name}
            show_indicator
            shake={presetFieldErrors.preset_name ? presetShakeKey : 0}
          >
            <input
              type="text"
              value={Preset_form.name}
              onChange={(e) =>
                Set_preset_form((f) => ({ ...f, name: e.target.value }))
              }
              onBlur={() => {
                const err = !Preset_form.name.trim() ? "Preset name is required" : null;
                setPresetFieldErrors((prev) => ({ ...prev, preset_name: err }));
                setPresetFieldStates((prev) => ({
                  ...prev,
                  preset_name: err ? "error" : Preset_form.name ? "valid" : "idle",
                }));
                if (err) {
                  setPresetShakeKey((k) => k + 1);
                  Haptic_error();
                }
              }}
              placeholder="e.g. Push day"
              maxLength={40}
              autoFocus
            />
          </Form_field>

          <div className="fitness__exercises-section">
            <span className="fitness__exercises-label">Exercises</span>
            {Preset_form.exercises.map((ex, i) => (
              <Exercise_row
                key={i}
                exercise={ex}
                index={i}
                onChange={updatePresetExercise}
                onRemove={removePresetExercise}
                showRemove={Preset_form.exercises.length > 1}
                errors={presetFieldErrors}
                states={presetFieldStates}
                Shake_key={presetShakeKey}
                onFieldBlur={handlePresetExerciseFieldBlur}
              />
            ))}
            <button
              type="button"
              className="fitness__exercise-add"
              onClick={addPresetExercise}
            >
              + Add exercise
            </button>
          </div>

          <div className="btn-row">
            {Editing_preset && (
              <button
                type="button"
                className="btn btn--danger-outline"
                onClick={() => {
                  Delete_preset(Editing_preset.id);
                  Close_preset_modal();
                }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={Close_preset_modal}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={Save_preset}
              disabled={!Preset_form.name.trim()}
            >
              {Editing_preset ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Sheet_modal>

      {/* Delete Confirmation */}
      <Confirm_modal
        open={!!Delete_target}
        closing={Delete_modal.closing}
        onClose={Close_delete_modal}
        onConfirm={Confirm_delete}
        Loading={Deleting}
        title="Delete this workout?"
        description="This action cannot be undone."
        confirm_label="Delete workout"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        }
        preview={
          Delete_target && (
            <>
              <span className="fitness__delete-date">
                {Format_date_friendly(Delete_target.workout_date)}
              </span>
              {Delete_target.preset_name && (
                <span className="fitness__delete-name">
                  {Delete_target.preset_name}
                </span>
              )}
            </>
          )
        }
      />

      <FAB
        visible={Show_floating_actions}
        on_scroll_top={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        on_add={Open_add_modal}
        add_label="Log workout"
      />
    </div>
  );
}

export default Workout_logger;
