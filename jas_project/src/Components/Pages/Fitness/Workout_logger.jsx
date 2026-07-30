import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get_supabase_client } from "../../../Lib/Superbase";
import { use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  get_user_facing_error,
  sanitize_date,
  sanitize_number,
  sanitize_text,
  format_date_friendly,
  haptic_error,
} from "../../../Lib/Security";
import { use_body_scroll_lock, use_modal } from "../../../Hooks";
import { use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";

import SheetModal from "../../../Components/UI/Modals/Sheet_modal";
import ConfirmModal from "../../../Components/UI/Modals/Confirm_modal";
import FormField from "../../../Components/UI/Form/Form_field.jsx";
import EmptyState from "../../../Components/UI/Empty_state";
import LoadingSkeleton from "../../../Components/UI/Loading_skeleton";
import GlassCard from "../../../Components/UI/Glass_card";
import FAB from "../../../Components/UI/fab";

import { kg_to_lbs } from "../../../Lib/weight";

import {
  MODAL_EXIT_MS,
  WEEKDAYS,
  emptyExercise,
  empty_form,
  calcVolume,
  formatVolume,
} from "./Workout_utils";
import ExerciseRow from "./Exercise_row";
import WorkoutCard from "./Workout_card";
import WorkoutForm from "./Workout_form";

function WorkoutLogger() {
  const user_id = use_user_id();
  const now = new Date();
  const [selected_date, set_selected_date] = useState(now);
  const [view_mode, set_view_mode] = useState("week");
  const [workouts, setWorkouts] = useState([]);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState(null);
  const [form, set_form] = useState(empty_form());
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [saving, set_saving] = useState(false);
  const [delete_target, set_delete_target] = useState(null);
  const [deleting, set_deleting] = useState(false);
  const [removing_id, set_removing_id] = useState(null);
  const [field_errors, set_field_errors] = useState({});
  const [field_states, set_field_states] = useState({});
  const [shake_key, set_shake_key] = useState(0);
  const [presets, set_presets] = useState([]);
  const [editing_preset, set_editing_preset] = useState(null);
  const [preset_form, set_preset_form] = useState({
    name: "",
    exercises: [emptyExercise()],
  });
  const [presetFieldErrors, setPresetFieldErrors] = useState({});
  const [presetFieldStates, setPresetFieldStates] = useState({});
  const [presetShakeKey, setPresetShakeKey] = useState(0);
  const [expanded_note_id, set_expanded_note_id] = useState(null);
  const [show_floating_actions, set_show_floating_actions] = useState(false);
  const add_btn_ref = useRef(null);

  const form_modal = use_modal(MODAL_EXIT_MS);
  const delete_modal = use_modal(MODAL_EXIT_MS);
  const preset_modal = use_modal(MODAL_EXIT_MS);

  const { success: toast_success, error: toast_error } = use_glass_toast();

  // Week helpers
  const start_of_week = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const add_days = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  };

  const to_date_key = (date) => date.toISOString().slice(0, 10);

  const selected_key = to_date_key(selected_date);
  const is_today = selected_key === to_date_key(now);

  const week_days = useMemo(() => {
    const start = start_of_week(selected_date);
    return Array.from({ length: 7 }, (_, i) => add_days(start, i));
  }, [selected_date]);

  const month_days = useMemo(() => {
    const d = new Date(selected_date);
    const start = start_of_week(new Date(d.getFullYear(), d.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => add_days(start, i));
  }, [selected_date]);

  const visible_days = view_mode === "week" ? week_days : month_days;

  const day_title = useMemo(() => {
    return selected_date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [selected_date]);

  // ── Fetch workouts ──
  const fetchWorkouts = useCallback(async () => {
    if (!user_id) return;
    set_loading(true);
    set_error(null);

    const d = new Date(selected_date);
    const range_start =
      view_mode === "week"
        ? start_of_week(d)
        : new Date(d.getFullYear(), d.getMonth(), 1);
    const range_end =
      view_mode === "week"
        ? add_days(range_start, 6)
        : new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startDate = to_date_key(range_start);
    const endDate = to_date_key(range_end);

    try {
      const supabase = get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", user_id)
        .gte("workout_date", startDate)
        .lte("workout_date", endDate)
        .order("workout_date", { ascending: true });

      if (fetch_error) {
        set_error(get_user_facing_error(fetch_error.message));
        setWorkouts([]);
      } else {
        setWorkouts(data ?? []);
      }
    } catch (err) {
      set_error(get_user_facing_error(err.message));
      setWorkouts([]);
    }
    set_loading(false);
  }, [selected_date, view_mode, user_id]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  // ── Fetch presets ──
  const fetch_presets = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("workout_presets")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: true });
      if (!fetch_error) set_presets(data ?? []);
    } catch {
      // silent
    }
  }, [user_id]);

  useEffect(() => {
    fetch_presets();
  }, [fetch_presets]);

  use_body_scroll_lock(form_modal.open, delete_modal.open, preset_modal.open);

  // ── Floating actions observer ──
  useEffect(() => {
    const target = add_btn_ref.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const scrolledPastIt =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        set_show_floating_actions(scrolledPastIt);
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
        acc.volume += calcVolume(exercises);
        acc.duration += parseInt(w.duration_minutes, 10) || 0;
        acc.calories += parseInt(w.calories_burned, 10) || 0;
        return acc;
      },
      { workouts: 0, volume: 0, duration: 0, calories: 0 },
    );
  }, [workouts]);

  // ── Form: exercise helpers ──
  const add_exercise = () => {
    if (form.exercises.length >= 20) return;
    set_form((f) => ({
      ...f,
      exercises: [...f.exercises, emptyExercise()],
    }));
  };

  const remove_exercise = (index) => {
    set_form((f) => ({
      ...f,
      exercises: f.exercises.filter((_, i) => i !== index),
    }));
  };

  const updateExercise = (index, field, value) => {
    set_form((f) => {
      const next = [...f.exercises];
      next[index] = { ...next[index], [field]: value };
      return { ...f, exercises: next };
    });
    // Re-validate if field was previously validated (has a state)
    const key = `${index}_${field}`;
    if (field_states[key]) {
      const err = validateExerciseField(index, field, value);
      set_field_errors((prev) => ({ ...prev, [key]: err }));
      set_field_states((prev) => ({
        ...prev,
        [key]: err ? "error" : value ? "valid" : "idle",
      }));
    }
    // Also re-validate the paired weight field
    const pairedField = field === "weight" ? "weight_lbs" : field === "weight_lbs" ? "weight" : null;
    if (pairedField) {
      const pairedKey = `${index}_${pairedField}`;
      if (field_states[pairedKey]) {
        // Compute the paired value from the current form state
        const pairedValue = field === "weight" ? kg_to_lbs(value) : lbs_to_kg(value);
        const err = validateExerciseField(index, pairedField, pairedValue);
        set_field_errors((prev) => ({ ...prev, [pairedKey]: err }));
        set_field_states((prev) => ({
          ...prev,
          [pairedKey]: err ? "error" : pairedValue ? "valid" : "idle",
        }));
      }
    }
  };

  // ── Modal open/close ──
  const open_add_modal = () => {
    setEditingWorkout(null);
    const f = empty_form();
    f.workout_date = selected_key;
    set_form(f);
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  const open_edit_modal = (workout) => {
    setEditingWorkout(workout);
    const exercises =
      Array.isArray(workout.exercises) && workout.exercises.length > 0
        ? workout.exercises.map((ex) => ({
            ...ex,
            weight_lbs: ex.weight ? kg_to_lbs(ex.weight) : "",
          }))
        : [emptyExercise()];
    set_form({
      workout_date: workout.workout_date,
      preset_name: workout.preset_name ?? "",
      exercises,
      notes: workout.notes ?? "",
      duration_minutes: workout.duration_minutes
        ? String(workout.duration_minutes)
        : "",
      calories_burned: workout.calories_burned
        ? String(workout.calories_burned)
        : "",
    });
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  const close_form_modal = () => {
    form_modal.close_modal();
    setTimeout(() => {
      setEditingWorkout(null);
      set_form(empty_form());
      set_field_states({});
    }, MODAL_EXIT_MS);
  };

  // ── Presets ──
  const open_preset_modal = (preset = null) => {
    if (preset) {
      set_editing_preset(preset);
      const exercises =
        Array.isArray(preset.exercises) && preset.exercises.length > 0
          ? preset.exercises
          : [emptyExercise()];
      set_preset_form({ name: preset.name, exercises });
    } else {
      set_editing_preset(null);
      set_preset_form({ name: "", exercises: [emptyExercise()] });
    }
    setPresetFieldErrors({});
    setPresetFieldStates({});
    preset_modal.open_modal();
  };

  const close_preset_modal = () => {
    preset_modal.close_modal();
    setTimeout(() => {
      set_editing_preset(null);
      setPresetFieldStates({});
    }, MODAL_EXIT_MS);
  };

  const addPresetExercise = () => {
    if (preset_form.exercises.length >= 20) return;
    set_preset_form((f) => ({
      ...f,
      exercises: [...f.exercises, emptyExercise()],
    }));
  };

  const removePresetExercise = (index) => {
    set_preset_form((f) => ({
      ...f,
      exercises: f.exercises.filter((_, i) => i !== index),
    }));
  };

  const updatePresetExercise = (index, field, value) => {
    set_preset_form((f) => {
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
        const pairedValue = field === "weight" ? kg_to_lbs(value) : lbs_to_kg(value);
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
    const ex = preset_form.exercises[index];
    if (!ex) return null;
    const val = overrideValue !== undefined ? overrideValue : ex[field];
    switch (field) {
      case "name":
        return !val || !val.trim() ? "Required" : null;
      case "weight":
      case "weight_lbs": {
        if (!val && val !== 0) return "Required";
        const n = sanitize_number(val, 0, 9999);
        return n == null ? "Invalid" : null;
      }
      case "sets": {
        if (!val && val !== 0) return "Required";
        const n = sanitize_number(val, 0, 999);
        return n == null ? "Invalid" : null;
      }
      case "reps": {
        if (!val && val !== 0) return "Required";
        const n = sanitize_number(val, 0, 9999);
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
      [key]: err ? "error" : preset_form.exercises[index]?.[field] ? "valid" : "idle",
    }));
    if (err) {
      setPresetShakeKey((k) => k + 1);
      haptic_error();
    }
    // Also validate the paired weight field
    const pairedField = field === "weight" ? "weight_lbs" : field === "weight_lbs" ? "weight" : null;
    if (pairedField) {
      const pairedKey = `${index}_${pairedField}`;
      const pairedVal = preset_form.exercises[index]?.[pairedField];
      const pairedErr = validatePresetExerciseField(index, pairedField);
      setPresetFieldErrors((prev) => ({ ...prev, [pairedKey]: pairedErr }));
      setPresetFieldStates((prev) => ({
        ...prev,
        [pairedKey]: pairedErr ? "error" : pairedVal ? "valid" : "idle",
      }));
    }
  };

  const save_preset = useCallback(async () => {
    const name = preset_form.name.trim();
    if (!name) return;
    const cleanedExercises = preset_form.exercises
      .filter((ex) => ex.name.trim())
      .map((ex) => ({
        name: sanitize_text(ex.name, 80),
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
      const supabase = get_supabase_client();
      let dbError;
      if (editing_preset) {
        ({ error: dbError } = await supabase
          .from("workout_presets")
          .update(payload)
          .eq("id", editing_preset.id));
      } else {
        ({ error: dbError } = await supabase
          .from("workout_presets")
          .insert(payload));
      }
      if (dbError) {
        toast_error(get_user_facing_error(dbError.message));
        return;
      }
      close_preset_modal();
      toast_success(editing_preset ? "Preset updated." : "Preset created.");
      fetch_presets();
    } catch (err) {
      toast_error(get_user_facing_error(err.message));
    }
  }, [
    preset_form,
    editing_preset,
    fetch_presets,
    toast_success,
    toast_error,
    user_id,
  ]);

  const delete_preset = useCallback(
    async (id) => {
      try {
        const supabase = get_supabase_client();
        const { error: dbError } = await supabase
          .from("workout_presets")
          .delete()
          .eq("id", id);
        if (dbError) {
          toast_error(get_user_facing_error(dbError.message));
          return;
        }
        toast_success("Preset removed.");
        fetch_presets();
      } catch (err) {
        toast_error(get_user_facing_error(err.message));
      }
    },
    [fetch_presets, toast_success, toast_error],
  );

  const applyPreset = (preset) => {
    const exercises =
      Array.isArray(preset.exercises) && preset.exercises.length > 0
        ? preset.exercises.map((ex) => ({
            ...ex,
            name: sanitize_text(ex.name, 80),
            weight_lbs: ex.weight ? kg_to_lbs(ex.weight) : "",
          }))
        : [emptyExercise()];
    setEditingWorkout(null);
    set_form({
      workout_date: new Date().toISOString().slice(0, 10),
      preset_name: preset.name,
      exercises,
      notes: "",
      duration_minutes: "",
    });
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  // ── Validation ──
  const validate_field = (field_name, value) => {
    switch (field_name) {
      case "workout_date":
        return !value ? "Pick a date" : null;
      case "preset_name":
        return !value || !value.trim() ? "Workout name is required" : null;
      case "calories_burned": {
        if (!value) return null;
        const n = sanitize_number(value, 0, 9999);
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
        const n = sanitize_number(val, 0, 9999);
        return n == null ? "Invalid" : null;
      }
      case "sets": {
        if (!val && val !== 0) return "Required";
        const n = sanitize_number(val, 0, 999);
        return n == null ? "Invalid" : null;
      }
      case "reps": {
        if (!val && val !== 0) return "Required";
        const n = sanitize_number(val, 0, 9999);
        return n == null ? "Invalid" : null;
      }
      default:
        return null;
    }
  };

  const handle_field_blur = (field_name) => {
    const err = validate_field(field_name, form[field_name]);
    set_field_errors((prev) => ({ ...prev, [field_name]: err }));
    set_field_states((prev) => ({
      ...prev,
      [field_name]: err ? "error" : form[field_name] ? "valid" : "idle",
    }));
    if (err) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };

  const handleExerciseFieldBlur = (index, field) => {
    const err = validateExerciseField(index, field);
    const key = `${index}_${field}`;
    set_field_errors((prev) => ({ ...prev, [key]: err }));
    set_field_states((prev) => ({
      ...prev,
      [key]: err ? "error" : form.exercises[index]?.[field] ? "valid" : "idle",
    }));
    if (err) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
    // Also validate the paired weight field
    const pairedField = field === "weight" ? "weight_lbs" : field === "weight_lbs" ? "weight" : null;
    if (pairedField) {
      const pairedKey = `${index}_${pairedField}`;
      const pairedVal = form.exercises[index]?.[pairedField];
      const pairedErr = validateExerciseField(index, pairedField);
      set_field_errors((prev) => ({ ...prev, [pairedKey]: pairedErr }));
      set_field_states((prev) => ({
        ...prev,
        [pairedKey]: pairedErr ? "error" : pairedVal ? "valid" : "idle",
      }));
    }
  };

  const exerciseErrors = {};
  const exerciseStates = {};
  Object.keys(field_errors).forEach((k) => {
    if (k.includes("_")) exerciseErrors[k] = field_errors[k];
  });
  Object.keys(field_states).forEach((k) => {
    if (k.includes("_")) exerciseStates[k] = field_states[k];
  });

  const is_form_valid = useMemo(() => {
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
  const handle_submit = async (e) => {
    e.preventDefault();

    const workoutDate = sanitize_date(
      form.workout_date,
      new Date().toISOString().slice(0, 10),
    );
    if (!workoutDate) {
      set_field_errors({ workout_date: "Pick a date" });
      set_field_states({ workout_date: "error" });
      set_shake_key((k) => k + 1);
      return;
    }

    const cleanedExercises = form.exercises
      .filter((ex) => ex.name.trim())
      .map((ex) => ({
        name: sanitize_text(ex.name, 80),
        weight: String(sanitize_number(ex.weight, 0, 9999) ?? ""),
        sets: String(sanitize_number(ex.sets, 0, 999) ?? ""),
        reps: String(sanitize_number(ex.reps, 0, 9999) ?? ""),
      }));

    if (cleanedExercises.length === 0) {
      set_field_errors({ exercises: "Add at least one exercise" });
      set_shake_key((k) => k + 1);
      return;
    }

    const workoutName = form.preset_name.trim();
    if (!workoutName) {
      set_field_errors({ preset_name: "Workout name is required" });
      set_field_states({ preset_name: "error" });
      set_shake_key((k) => k + 1);
      return;
    }

    const duration = sanitize_number(form.duration_minutes, 1, 600);
    const calories_burned = sanitize_number(form.calories_burned, 0, 9999);
    const notes = form.notes.trim() ? sanitize_text(form.notes, 500) : null;

    set_saving(true);
    set_error(null);

    const payload = {
      workout_date: workoutDate,
      preset_name: workoutName,
      exercises: cleanedExercises,
      notes,
      duration_minutes: duration ?? null,
      calories_burned: calories_burned ?? null,
      ...(user_id && { user_id: user_id }),
    };

    try {
      const supabase = get_supabase_client();
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

      set_saving(false);

      if (dbError) {
        const message = get_user_facing_error(dbError.message);
        set_error(message);
        toast_error(
          editingWorkout
            ? "Couldn't update workout."
            : "Couldn't save workout.",
        );
        return;
      }

      close_form_modal();
      toast_success(editingWorkout ? "Workout updated." : "Workout logged.");
      fetchWorkouts();
    } catch (err) {
      set_saving(false);
      set_error(get_user_facing_error(err.message));
      toast_error(
        editingWorkout ? "Couldn't update workout." : "Couldn't save workout.",
      );
    }
  };

  // ── Delete ──
  const openDeleteModal = (workout) => {
    set_delete_target(workout);
    delete_modal.open_modal();
  };

  const close_delete_modal = () => {
    delete_modal.close_modal();
    setTimeout(() => {
      set_delete_target(null);
    }, MODAL_EXIT_MS);
  };

  const confirm_delete = async () => {
    if (!delete_target) return;
    set_deleting(true);
    set_error(null);

    try {
      const supabase = get_supabase_client();
      const { error: dbError } = await supabase
        .from("workout_logs")
        .delete()
        .eq("id", delete_target.id);

      set_deleting(false);

      if (dbError) {
        set_error(get_user_facing_error(dbError.message));
        toast_error("Failed to delete workout.");
        return;
      }

      const removedId = delete_target.id;
      close_delete_modal();
      toast_success("Workout deleted.");
      set_removing_id(removedId);
      setTimeout(() => {
        setWorkouts((prev) => prev.filter((w) => w.id !== removedId));
        set_removing_id(null);
      }, 380);
    } catch (err) {
      set_deleting(false);
      set_error(get_user_facing_error(err.message));
      toast_error("Failed to delete workout.");
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
            onClick={() => set_selected_date((d) => add_days(d, view_mode === "week" ? -7 : -30))}
            aria-label="Previous day"
          >
            ‹
          </button>
          <span className="fitness__date-label">{day_title}</span>
          <button
            type="button"
            className="fitness__date-btn"
            onClick={() => set_selected_date((d) => add_days(d, view_mode === "week" ? 7 : 30))}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
        {!is_today && (
          <button
            type="button"
            className="fitness__date-today"
            onClick={() => set_selected_date(new Date())}
          >
            Today
          </button>
        )}
      </div>

      {/* Week day selector */}
      <div
        className={`fitness__week-days animate-in animate-in--1${view_mode === "month" ? " fitness__week-days--month" : ""}`}
        role="group"
        aria-label={view_mode === "week" ? "Week days" : "Month days"}
      >
        {visible_days.map((day) => {
          const key = to_date_key(day);
          const isSelected = key === selected_key;
          const isDayToday = key === to_date_key(now);
          const hasWorkout = workouts.some((w) => w.workout_date === key);
          const isInCurrentMonth =
            view_mode === "month"
              ? day.getMonth() === selected_date.getMonth()
              : true;

          return (
            <button
              key={key}
              type="button"
              className={`fitness__week-day${isSelected ? " fitness__week-day--active" : ""}${isDayToday ? " fitness__week-day--today" : ""}${hasWorkout ? " fitness__week-day--busy" : ""}${!isInCurrentMonth ? " fitness__week-day--muted" : ""}`}
              onClick={() => set_selected_date(day)}
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
          className={`fitness__view-btn${view_mode === "week" ? " fitness__view-btn--active" : ""}`}
          onClick={() => set_view_mode("week")}
          aria-pressed={view_mode === "week"}
        >
          1 week
        </button>
        <button
          type="button"
          className={`fitness__view-btn${view_mode === "month" ? " fitness__view-btn--active" : ""}`}
          onClick={() => set_view_mode("month")}
          aria-pressed={view_mode === "month"}
        >
          1 month
        </button>
      </div>

      {/* Summary */}
      <div
        className="fitness__summary animate-in animate-in--2"
        key={selected_key}
      >
        <GlassCard
          value={String(totals.workouts)}
          label="Workouts"
          className="fitness__stat fitness__stat--workout"
        />
        <GlassCard
          value={formatVolume(totals.volume)}
          label="Volume (kg)"
          className="fitness__stat fitness__stat--workout"
        />
        <GlassCard
          value={totals.duration > 0 ? `${totals.duration}m` : "—"}
          label="Duration"
          className="fitness__stat fitness__stat--workout"
        />
        <GlassCard
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
        {presets.map((preset) => (
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
              onClick={() => open_preset_modal(preset)}
              aria-label={`Edit ${preset.name} preset`}
            >
              ✎
            </button>
          </div>
        ))}
        <button
          type="button"
          className="fitness__template-chip fitness__template-chip--add"
          onClick={() => open_preset_modal()}
        >
          + New preset
        </button>
      </div>

      {/* List header */}
      <div className="fitness__list-header animate-in animate-in--4">
        <h2 className="fitness__list-title">{day_title}</h2>
        <button
          type="button"
          className="fitness__add-btn"
          onClick={open_add_modal}
          ref={add_btn_ref}
        >
          + Add workout
        </button>
      </div>

      {/* Workout list */}
      {loading ? (
        <div className="fitness__list">
          <LoadingSkeleton count={3} height="5.5rem" />
        </div>
      ) : workouts.length === 0 ? (
        <EmptyState
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
        <ul className="fitness__list" key={`list-${selected_key}`}>
          {workouts.map((workout, index) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              index={index}
              onEdit={open_edit_modal}
              onDelete={openDeleteModal}
              onToggleNote={(id) =>
                set_expanded_note_id(expanded_note_id === id ? null : id)
              }
              expanded_note_id={expanded_note_id}
              isRemoving={removing_id === workout.id}
            />
          ))}
        </ul>
      )}

      {/* Add/Edit Workout Modal */}
      <WorkoutForm
        open={form_modal.open}
        closing={form_modal.closing}
        onClose={close_form_modal}
        editingWorkout={editingWorkout}
        form={form}
        set_form={set_form}
        field_errors={field_errors}
        field_states={field_states}
        shake_key={shake_key}
        saving={saving}
        is_form_valid={is_form_valid}
        on_add_exercise={add_exercise}
        onRemoveExercise={remove_exercise}
        onUpdateExercise={updateExercise}
        onSubmit={handle_submit}
        onFieldBlur={handle_field_blur}
        exerciseCount={form.exercises.length}
        exerciseErrors={exerciseErrors}
        exerciseStates={exerciseStates}
        onExerciseFieldBlur={handleExerciseFieldBlur}
      />

      {/* Preset Modal */}
      <SheetModal
        open={preset_modal.open}
        closing={preset_modal.closing}
        onClose={close_preset_modal}
        title={editing_preset ? "Edit preset" : "Create preset"}
      >
        <p className="fitness__preset-hint">
          Presets let you quick-add common workouts with one tap.
        </p>
        <div className="fitness__form">
          <FormField
            label="Preset name"
            error={presetFieldErrors.preset_name}
            state={presetFieldStates.preset_name}
            show_indicator
            shake={presetFieldErrors.preset_name ? presetShakeKey : 0}
          >
            <input
              type="text"
              value={preset_form.name}
              onChange={(e) =>
                set_preset_form((f) => ({ ...f, name: e.target.value }))
              }
              onBlur={() => {
                const err = !preset_form.name.trim() ? "Preset name is required" : null;
                setPresetFieldErrors((prev) => ({ ...prev, preset_name: err }));
                setPresetFieldStates((prev) => ({
                  ...prev,
                  preset_name: err ? "error" : preset_form.name ? "valid" : "idle",
                }));
                if (err) {
                  setPresetShakeKey((k) => k + 1);
                  haptic_error();
                }
              }}
              placeholder="e.g. Push day"
              maxLength={40}
              autoFocus
            />
          </FormField>

          <div className="fitness__exercises-section">
            <span className="fitness__exercises-label">Exercises</span>
            {preset_form.exercises.map((ex, i) => (
              <ExerciseRow
                key={i}
                exercise={ex}
                index={i}
                onChange={updatePresetExercise}
                onRemove={removePresetExercise}
                showRemove={preset_form.exercises.length > 1}
                errors={presetFieldErrors}
                states={presetFieldStates}
                shake_key={presetShakeKey}
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
            {editing_preset && (
              <button
                type="button"
                className="btn btn--danger-outline"
                onClick={() => {
                  delete_preset(editing_preset.id);
                  close_preset_modal();
                }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={close_preset_modal}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={save_preset}
              disabled={!preset_form.name.trim()}
            >
              {editing_preset ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!delete_target}
        closing={delete_modal.closing}
        onClose={close_delete_modal}
        onConfirm={confirm_delete}
        loading={deleting}
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
          delete_target && (
            <>
              <span className="fitness__delete-date">
                {format_date_friendly(delete_target.workout_date)}
              </span>
              {delete_target.preset_name && (
                <span className="fitness__delete-name">
                  {delete_target.preset_name}
                </span>
              )}
            </>
          )
        }
      />

      <FAB
        visible={show_floating_actions}
        on_scroll_top={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        on_add={open_add_modal}
        add_label="Log workout"
      />
    </div>
  );
}

export default WorkoutLogger;
