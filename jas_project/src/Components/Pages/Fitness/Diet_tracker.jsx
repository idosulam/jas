import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get_supabase_client } from "../../../Lib/Superbase";
import { use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  get_user_facing_error,
  sanitize_date,
  sanitize_number,
  sanitize_text,
  haptic_error,
} from "../../../Lib/Security";
import { use_body_scroll_lock, use_modal } from "../../../Hooks";
import { use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import {
  calcBMR,
  calcTDEE,
  calcMacroTargets,
  ACTIVITY_LEVELS,
  GENDER_OPTIONS,
} from "./Macro_calculator";

import SheetModal from "../../../Components/UI/Modals/Sheet_modal";
import ConfirmModal from "../../../Components/UI/Modals/Confirm_modal";
import FormField from "../../../Components/UI/Form/Form_field.jsx";
import GlassCard from "../../../Components/UI/Glass_card";

import MacroProgressBar from "./Macro_progress_bar";
import DietEntryForm from "./Diet_entry_form";
import MealGroup from "./Meal_group";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MODAL_EXIT_MS = 320;

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

function emptyEntryForm() {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    meal_type: "breakfast",
    food_name: "",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fats_g: "",
    fiber_g: "",
  };
}

function DietTracker({ profileData }) {
  const user_id = use_user_id();
  const today = new Date().toISOString().slice(0, 10);
  const [selected_date, set_selected_date] = useState(today);
  const [view_mode, set_view_mode] = useState("week");
  const [entries, setEntries] = useState([]);
  const [calories_burned, set_calories_burned] = useState(0);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState(null);
  const [form, set_form] = useState(emptyEntryForm());
  const [editingEntry, setEditingEntry] = useState(null);
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
    meal_type: "breakfast",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fats_g: "",
    fiber_g: "",
  });
  const [show_floating_actions, set_show_floating_actions] = useState(false);
  const add_btn_ref = useRef(null);
  const hasLoadedOnce = useRef(false);

  const form_modal = use_modal(MODAL_EXIT_MS);
  const delete_modal = use_modal(MODAL_EXIT_MS);
  const preset_modal = use_modal(MODAL_EXIT_MS);

  const { success: toast_success, error: toast_error } = use_glass_toast();

  // ── Profile-derived macro targets ──
  const profile = profileData;
  const weight_kg = profile?.weight_kg ? Number(profile.weight_kg) : null;
  const height_cm = profile?.height_cm ? Number(profile.height_cm) : null;
  const age = profile?.age ? Number(profile.age) : null;
  const gender = profile?.gender || "male";
  const rawActivityLevel = profile?.activity_level || "moderate";
  const activityLevel = ACTIVITY_LEVELS.some((l) => l.id === rawActivityLevel)
    ? rawActivityLevel
    : "moderate";

  const bmr = calcBMR(weight_kg, height_cm, age, gender);
  const tdee = calcTDEE(bmr, activityLevel);
  const macroTargets = calcMacroTargets(weight_kg, tdee);

  // ── Fetch entries for selected date ──
  const fetchEntries = useCallback(async () => {
    if (!user_id) return;
    if (!hasLoadedOnce.current) set_loading(true);
    set_error(null);

    const d = new Date(`${selected_date}T12:00:00`);
    const range_start =
      view_mode === "week"
        ? start_of_week(d)
        : new Date(d.getFullYear(), d.getMonth(), 1);
    const range_end =
      view_mode === "week"
        ? add_days(range_start, 6)
        : new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startDateKey = to_date_key(range_start);
    const endDateKey = to_date_key(range_end);

    try {
      const supabase = get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("diet_entries")
        .select("*")
        .eq("user_id", user_id)
        .gte("entry_date", startDateKey)
        .lte("entry_date", endDateKey)
        .order("created_at", { ascending: true });

      if (fetch_error) {
        set_error(get_user_facing_error(fetch_error.message));
        setEntries([]);
      } else {
        setEntries(data ?? []);
      }

      // Fetch calories burned from workouts for this date
      try {
        const { data: workoutData } = await supabase
          .from("workout_logs")
          .select("calories_burned")
          .eq("user_id", user_id)
          .eq("workout_date", selected_date);

        const totalBurned = (workoutData ?? []).reduce(
          (sum, w) => sum + (parseInt(w.calories_burned, 10) || 0),
          0,
        );
        set_calories_burned(totalBurned);
      } catch {
        // calories_burned column may not exist yet — ignore
        set_calories_burned(0);
      }
    } catch (err) {
      set_error(get_user_facing_error(err.message));
      setEntries([]);
    }
    hasLoadedOnce.current = true;
    set_loading(false);
  }, [selected_date, view_mode, user_id]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Fetch presets ──
  const fetch_presets = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("diet_presets")
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

  // ── Floating actions ──
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

  // ── Daily totals ──
  // ── Entries for the selected date only ──
  const dayEntries = useMemo(
    () => entries.filter((e) => e.entry_date === selected_date),
    [entries, selected_date],
  );

  const dailyTotals = useMemo(() => {
    return dayEntries.reduce(
      (acc, e) => {
        acc.calories += Number(e.calories) || 0;
        acc.protein += Number(e.protein_g) || 0;
        acc.carbs += Number(e.carbs_g) || 0;
        acc.fats += Number(e.fats_g) || 0;
        acc.fiber += Number(e.fiber_g) || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 },
    );
  }, [dayEntries]);

  // ── Group entries by meal type ──
  const groupedEntries = useMemo(() => {
    const groups = {};
    MEAL_TYPES.forEach((m) => {
      groups[m.id] = dayEntries.filter((e) => e.meal_type === m.id);
    });
    return groups;
  }, [dayEntries]);

  // ── Date navigation ──
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

  const changeDate = (offset) => {
    const d = new Date(`${selected_date}T12:00:00`);
    d.setDate(d.getDate() + offset);
    set_selected_date(d.toISOString().slice(0, 10));
  };

  const shiftNav = (direction) => {
    const offset = view_mode === "week" ? 7 : 30;
    changeDate(direction === "next" ? offset : -offset);
  };

  const formatSelectedDate = () => {
    const d = new Date(`${selected_date}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const is_today = selected_date === today;

  const week_days = useMemo(() => {
    const d = new Date(`${selected_date}T12:00:00`);
    const start = start_of_week(d);
    return Array.from({ length: 7 }, (_, i) => add_days(start, i));
  }, [selected_date]);

  const month_days = useMemo(() => {
    const d = new Date(`${selected_date}T12:00:00`);
    const start = start_of_week(new Date(d.getFullYear(), d.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => add_days(start, i));
  }, [selected_date]);

  const visible_days = view_mode === "week" ? week_days : month_days;

  // ── Modal open/close ──
  const open_add_modal = (mealType = "breakfast") => {
    setEditingEntry(null);
    set_form({
      ...emptyEntryForm(),
      entry_date: selected_date,
      meal_type: mealType,
    });
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  const open_edit_modal = (entry) => {
    setEditingEntry(entry);
    set_form({
      entry_date: entry.entry_date,
      meal_type: entry.meal_type,
      food_name: entry.food_name ?? "",
      calories: entry.calories ? String(entry.calories) : "",
      protein_g: entry.protein_g ? String(entry.protein_g) : "",
      carbs_g: entry.carbs_g ? String(entry.carbs_g) : "",
      fats_g: entry.fats_g ? String(entry.fats_g) : "",
      fiber_g: entry.fiber_g ? String(entry.fiber_g) : "",
    });
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  const close_form_modal = () => {
    form_modal.close_modal();
    setTimeout(() => {
      setEditingEntry(null);
      set_form(emptyEntryForm());
      set_field_states({});
    }, MODAL_EXIT_MS);
  };

  // ── Presets ──
  const open_preset_modal = (preset = null) => {
    if (preset) {
      set_editing_preset(preset);
      set_preset_form({
        name: preset.name,
        meal_type: preset.meal_type || "breakfast",
        calories: preset.calories ? String(preset.calories) : "",
        protein_g: preset.protein_g ? String(preset.protein_g) : "",
        carbs_g: preset.carbs_g ? String(preset.carbs_g) : "",
        fats_g: preset.fats_g ? String(preset.fats_g) : "",
        fiber_g: preset.fiber_g ? String(preset.fiber_g) : "",
      });
    } else {
      set_editing_preset(null);
      set_preset_form({
        name: "",
        meal_type: "breakfast",
        calories: "",
        protein_g: "",
        carbs_g: "",
        fats_g: "",
        fiber_g: "",
      });
    }
    preset_modal.open_modal();
  };

  const close_preset_modal = () => {
    preset_modal.close_modal();
    setTimeout(() => {
      set_editing_preset(null);
    }, MODAL_EXIT_MS);
  };

  const save_preset = useCallback(async () => {
    const name = preset_form.name.trim();
    if (!name) return;
    const payload = {
      name,
      meal_type: preset_form.meal_type,
      calories: sanitize_number(preset_form.calories, 0, 10000) ?? 0,
      protein_g: sanitize_number(preset_form.protein_g, 0, 999) ?? 0,
      carbs_g: sanitize_number(preset_form.carbs_g, 0, 999) ?? 0,
      fats_g: sanitize_number(preset_form.fats_g, 0, 999) ?? 0,
      fiber_g: sanitize_number(preset_form.fiber_g, 0, 99) ?? 0,
      ...(user_id && { user_id: user_id }),
    };
    try {
      const supabase = get_supabase_client();
      let dbError;
      if (editing_preset) {
        ({ error: dbError } = await supabase
          .from("diet_presets")
          .update(payload)
          .eq("id", editing_preset.id));
      } else {
        ({ error: dbError } = await supabase
          .from("diet_presets")
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
  }, [preset_form, editing_preset, fetch_presets, toast_success, toast_error, user_id]);

  const delete_preset = useCallback(
    async (id) => {
      try {
        const supabase = get_supabase_client();
        const { error: dbError } = await supabase
          .from("diet_presets")
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
    setEditingEntry(null);
    set_form({
      entry_date: selected_date,
      meal_type: preset.meal_type || "breakfast",
      food_name: preset.name,
      calories: preset.calories ? String(preset.calories) : "",
      protein_g: preset.protein_g ? String(preset.protein_g) : "",
      carbs_g: preset.carbs_g ? String(preset.carbs_g) : "",
      fats_g: preset.fats_g ? String(preset.fats_g) : "",
      fiber_g: preset.fiber_g ? String(preset.fiber_g) : "",
    });
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  // ── Validation ──
  const validate_field = (field_name, value) => {
    switch (field_name) {
      case "food_name":
        return !value || !value.trim() ? "Enter food name" : null;
      case "entry_date":
        return !value ? "Pick a date" : null;
      default:
        return null;
    }
  };

  const handle_field_blur = (field_name) => {
    const error = validate_field(field_name, form[field_name]);
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

  const is_form_valid = useMemo(() => {
    if (!form.food_name || !form.food_name.trim()) return false;
    if (!form.entry_date) return false;
    return true;
  }, [form]);

  // ── Submit ──
  const handle_submit = async (e) => {
    e.preventDefault();

    const foodName = sanitize_text(form.food_name, 120);
    const entry_date = sanitize_date(
      form.entry_date,
      new Date().toISOString().slice(0, 10),
    );

    if (!foodName || !entry_date) {
      const errors = {};
      const states = {};
      if (!foodName) {
        errors.food_name = "Enter food name";
        states.food_name = "error";
      }
      if (!entry_date) {
        errors.entry_date = "Pick a date";
        states.entry_date = "error";
      }
      set_field_errors((prev) => ({ ...prev, ...errors }));
      set_field_states((prev) => ({ ...prev, ...states }));
      set_shake_key((k) => k + 1);
      return;
    }

    set_saving(true);
    set_error(null);

    const payload = {
      entry_date: entry_date,
      meal_type: form.meal_type,
      food_name: foodName,
      calories: sanitize_number(form.calories, 0, 10000) ?? 0,
      protein_g: sanitize_number(form.protein_g, 0, 999) ?? 0,
      carbs_g: sanitize_number(form.carbs_g, 0, 999) ?? 0,
      fats_g: sanitize_number(form.fats_g, 0, 999) ?? 0,
      fiber_g: sanitize_number(form.fiber_g, 0, 99) ?? 0,
      ...(user_id && { user_id: user_id }),
    };

    try {
      const supabase = get_supabase_client();
      let dbError;
      if (editingEntry) {
        ({ error: dbError } = await supabase
          .from("diet_entries")
          .update(payload)
          .eq("id", editingEntry.id));
      } else {
        ({ error: dbError } = await supabase
          .from("diet_entries")
          .insert(payload));
      }

      set_saving(false);

      if (dbError) {
        const message = get_user_facing_error(dbError.message);
        set_error(message);
        toast_error(
          editingEntry ? "Couldn't update entry." : "Couldn't save entry.",
        );
        return;
      }

      close_form_modal();
      toast_success(editingEntry ? "Entry updated." : "Food logged.");
      fetchEntries();
    } catch (err) {
      set_saving(false);
      set_error(get_user_facing_error(err.message));
      toast_error(
        editingEntry ? "Couldn't update entry." : "Couldn't save entry.",
      );
    }
  };

  // ── Delete ──
  const openDeleteModal = (entry) => {
    set_delete_target(entry);
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
        .from("diet_entries")
        .delete()
        .eq("id", delete_target.id);

      set_deleting(false);

      if (dbError) {
        set_error(get_user_facing_error(dbError.message));
        toast_error("Failed to delete entry.");
        return;
      }

      const removedId = delete_target.id;
      close_delete_modal();
      toast_success("Entry deleted.");
      set_removing_id(removedId);
      setTimeout(() => {
        setEntries((prev) => prev.filter((e) => e.id !== removedId));
        set_removing_id(null);
      }, 380);
    } catch (err) {
      set_deleting(false);
      set_error(get_user_facing_error(err.message));
      toast_error("Failed to delete entry.");
    }
  };

  const hasProfileForBMR = !!(weight_kg && height_cm && age);

  return (
    <div className="fitness__diet">
      {/* BMR / Macro Dashboard */}
      <div className="fitness__macro-dashboard animate-in animate-in--1">
        {hasProfileForBMR && macroTargets ? (
          <>
            <div className="fitness__macro-header">
              <h3 className="fitness__macro-title">Daily Targets</h3>
              <span className="fitness__macro-subtitle">
                BMR {Math.round(bmr)} · TDEE {tdee} kcal
              </span>
            </div>
            <div className="fitness__macro-bars">
              <MacroProgressBar
                label="Calories"
                current={dailyTotals.calories}
                target={macroTargets.calories + calories_burned}
                unit=" kcal"
                color="#f59e0b"
              />
              <MacroProgressBar
                label="Protein"
                current={dailyTotals.protein}
                target={macroTargets.protein}
                unit="g"
                color="#34d399"
              />
              <MacroProgressBar
                label="Carbs"
                current={dailyTotals.carbs}
                target={macroTargets.carbs}
                unit="g"
                color="#60a5fa"
              />
              <MacroProgressBar
                label="Fats"
                current={dailyTotals.fats}
                target={macroTargets.fats}
                unit="g"
                color="#f472b6"
              />
              <MacroProgressBar
                label="Fiber"
                current={dailyTotals.fiber}
                target={macroTargets.fiber}
                unit="g"
                color="#a78bfa"
              />
            </div>
          </>
        ) : (
          <div className="fitness__macro-missing">
            <p className="fitness__macro-missing-title">
              Set up your profile for macro targets
            </p>
            <p className="fitness__macro-missing-text">
              Add your age, height, weight, and gender in the Profile tab to
              unlock personalized BMR and macro calculations.
            </p>
          </div>
        )}
      </div>

      {/* Date selector */}
      <div className="fitness__date-nav animate-in animate-in--2">
        <div className="fitness__date-top">
          <button
            type="button"
            className="fitness__date-btn"
            onClick={() => shiftNav("prev")}
            aria-label="Previous day"
          >
            ‹
          </button>
          <span className="fitness__date-label">{formatSelectedDate()}</span>
          <button
            type="button"
            className="fitness__date-btn"
            onClick={() => shiftNav("next")}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
        {!is_today && (
          <button
            type="button"
            className="fitness__date-today"
            onClick={() => set_selected_date(today)}
          >
            Today
          </button>
        )}
      </div>

      {/* Week day selector */}
      <div
        className={`fitness__week-days animate-in animate-in--2${view_mode === "month" ? " fitness__week-days--month" : ""}`}
        role="group"
        aria-label={view_mode === "week" ? "Week days" : "Month days"}
      >
        {visible_days.map((day) => {
          const key = to_date_key(day);
          const isSelected = key === selected_date;
          const isDayToday = key === today;
          const hasEntries = entries.some((e) => e.entry_date === key);
          const d = new Date(`${selected_date}T12:00:00`);
          const isInCurrentMonth =
            view_mode === "month"
              ? day.getMonth() === d.getMonth()
              : true;

          return (
            <button
              key={key}
              type="button"
              className={`fitness__week-day${isSelected ? " fitness__week-day--active" : ""}${isDayToday ? " fitness__week-day--today" : ""}${hasEntries ? " fitness__week-day--busy" : ""}${!isInCurrentMonth ? " fitness__week-day--muted" : ""}`}
              onClick={() => set_selected_date(key)}
              aria-pressed={isSelected}
            >
              <span className="fitness__week-day-label">{WEEKDAYS[day.getDay()]}</span>
              <span className="fitness__week-day-num">{day.getDate()}</span>
              {hasEntries && (
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
        aria-label="Diet view"
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

      {/* Daily summary */}
      <div className="fitness__summary animate-in animate-in--3" key={selected_date}>
        <GlassCard
          value={Math.round(dailyTotals.calories).toString()}
          label="Calories"
          className="fitness__stat fitness__stat--diet"
        />
        <GlassCard
          value={`${Math.round(dailyTotals.protein)}g`}
          label="Protein"
          className="fitness__stat fitness__stat--diet"
        />
        <GlassCard
          value={`${Math.round(dailyTotals.carbs)}g`}
          label="Carbs"
          className="fitness__stat fitness__stat--diet"
        />
        <GlassCard
          value={`${Math.round(dailyTotals.fats)}g`}
          label="Fats"
          className="fitness__stat fitness__stat--diet"
        />
        <GlassCard
          value={calories_burned > 0 ? calories_burned.toString() : "—"}
          label="Burned"
          className="fitness__stat fitness__stat--workout"
        />
      </div>

      {error && (
        <p className="fitness__error fitness__error--shake" role="alert">
          {error}
        </p>
      )}

      {/* Presets (quick-add) */}
      <div className="fitness__templates animate-in animate-in--3">
        {presets.map((preset) => (
          <div key={preset.id} className="fitness__preset">
            <button
              type="button"
              className="fitness__template-chip"
              onClick={() => applyPreset(preset)}
            >
              {preset.name}
              <span className="fitness__template-cal">
                {preset.calories}kcal
              </span>
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

      {/* Food log grouped by meal */}
      <div className="fitness__meals animate-in animate-in--4">
        {MEAL_TYPES.map((meal) => (
          <MealGroup
            key={meal.id}
            meal={meal}
            entries={groupedEntries[meal.id]}
            removing_id={removing_id}
            onEdit={open_edit_modal}
            onDelete={openDeleteModal}
            on_add_for_meal={open_add_modal}
            add_btn_ref={add_btn_ref}
          />
        ))}
      </div>

      {/* Add/Edit Entry Modal */}
      <DietEntryForm
        open={form_modal.open}
        closing={form_modal.closing}
        onClose={close_form_modal}
        editingEntry={editingEntry}
        form={form}
        set_form={set_form}
        saving={saving}
        is_form_valid={is_form_valid}
        field_errors={field_errors}
        set_field_errors={set_field_errors}
        field_states={field_states}
        shake_key={shake_key}
        onSubmit={handle_submit}
        onFieldBlur={handle_field_blur}
      />

      {/* Preset Modal */}
      <SheetModal
        open={preset_modal.open}
        closing={preset_modal.closing}
        onClose={close_preset_modal}
        title={editing_preset ? "Edit meal preset" : "Create meal preset"}
      >
        <p className="fitness__preset-hint">
          Save common meals for quick logging.
        </p>
        <div className="fitness__form">
          <FormField label="Preset name">
            <input
              type="text"
              value={preset_form.name}
              onChange={(e) =>
                set_preset_form((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Protein shake, Chicken & rice"
              maxLength={60}
              autoFocus
            />
          </FormField>
          <FormField label="Meal type">
            <select
              value={preset_form.meal_type}
              onChange={(e) =>
                set_preset_form((f) => ({ ...f, meal_type: e.target.value }))
              }
            >
              {MEAL_TYPES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Calories (kcal)">
            <input
              type="number"
              min="0"
              max="10000"
              step="1"
              placeholder="0"
              value={preset_form.calories}
              onChange={(e) =>
                set_preset_form((f) => ({ ...f, calories: e.target.value }))
              }
            />
          </FormField>
          <div className="fitness__macro-inputs">
            <FormField label="Protein (g)">
              <input
                type="number"
                min="0"
                max="999"
                step="0.1"
                placeholder="0"
                value={preset_form.protein_g}
                onChange={(e) =>
                  set_preset_form((f) => ({ ...f, protein_g: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Carbs (g)">
              <input
                type="number"
                min="0"
                max="999"
                step="0.1"
                placeholder="0"
                value={preset_form.carbs_g}
                onChange={(e) =>
                  set_preset_form((f) => ({ ...f, carbs_g: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Fats (g)">
              <input
                type="number"
                min="0"
                max="999"
                step="0.1"
                placeholder="0"
                value={preset_form.fats_g}
                onChange={(e) =>
                  set_preset_form((f) => ({ ...f, fats_g: e.target.value }))
                }
              />
            </FormField>
          </div>
          <FormField label="Fiber (g)" optional>
            <input
              type="number"
              min="0"
              max="99"
              step="0.1"
              placeholder="0"
              value={preset_form.fiber_g}
              onChange={(e) =>
                set_preset_form((f) => ({ ...f, fiber_g: e.target.value }))
              }
            />
          </FormField>
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
        title="Delete this food entry?"
        description="This action cannot be undone."
        confirm_label="Delete entry"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        }
        preview={
          delete_target && (
            <>
              <span className="fitness__delete-date">
                {delete_target.food_name}
              </span>
              <span className="fitness__delete-name">
                {Math.round(Number(delete_target.calories))} kcal
              </span>
            </>
          )
        }
      />
    </div>
  );
}

export default DietTracker;
