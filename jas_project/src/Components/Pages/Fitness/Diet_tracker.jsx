import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase";
import { Use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  Get_user_facing_error,
  Sanitize_date,
  Sanitize_number,
  Sanitize_text,
  Haptic_error,
} from "../../../Lib/Security";
import { Use_body_scroll_lock, Use_modal } from "../../../Hooks";
import { Use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";
import {
  Calc_bmr,
  Calc_tdee,
  Calc_macro_targets,
  ACTIVITY_LEVELS,
  GENDER_OPTIONS,
} from "./Macro_calculator";

import Sheet_modal from "../../../Components/UI/Modals/Sheet_modal";
import Confirm_modal from "../../../Components/UI/Modals/Confirm_modal";
import Form_field from "../../../Components/UI/Form/Form_field.jsx";
import Glass_card from "../../../Components/UI/Glass_card";

import Macro_progress_bar from "./Macro_progress_bar";
import Diet_entry_form from "./Diet_entry_form";
import Meal_group from "./Meal_group";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MODAL_EXIT_MS = 320;

const MEAL_TYPES = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

function Empty_entry_form() {
  return {
    Entry_date: new Date().toISOString().slice(0, 10),
    meal_type: "breakfast",
    food_name: "",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fats_g: "",
    fiber_g: "",
  };
}

function Diet_tracker({ profileData }) {
  const user_id = Use_user_id();
  const today = new Date().toISOString().slice(0, 10);
  const [Selected_date, Set_selected_date] = useState(today);
  const [View_mode, Set_view_mode] = useState("week");
  const [entries, setEntries] = useState([]);
  const [Calories_burned, Set_calories_burned] = useState(0);
  const [Loading, Set_loading] = useState(true);
  const [error, Set_error] = useState(null);
  const [form, Set_form] = useState(Empty_entry_form());
  const [editingEntry, setEditingEntry] = useState(null);
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
    meal_type: "breakfast",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fats_g: "",
    fiber_g: "",
  });
  const [Show_floating_actions, Set_show_floating_actions] = useState(false);
  const Add_btn_ref = useRef(null);
  const hasLoadedOnce = useRef(false);

  const Form_modal = Use_modal(MODAL_EXIT_MS);
  const Delete_modal = Use_modal(MODAL_EXIT_MS);
  const Preset_modal = Use_modal(MODAL_EXIT_MS);

  const { success: Toast_success, error: Toast_error } = Use_glass_toast();

  // ── Profile-derived macro targets ──
  const profile = profileData;
  const Weight_kg = profile?.weight_kg ? Number(profile.weight_kg) : null;
  const Height_cm = profile?.height_cm ? Number(profile.height_cm) : null;
  const age = profile?.age ? Number(profile.age) : null;
  const gender = profile?.gender || "male";
  const rawActivityLevel = profile?.activity_level || "moderate";
  const activityLevel = ACTIVITY_LEVELS.some((l) => l.id === rawActivityLevel)
    ? rawActivityLevel
    : "moderate";

  const bmr = Calc_bmr(Weight_kg, Height_cm, age, gender);
  const tdee = Calc_tdee(bmr, activityLevel);
  const macroTargets = Calc_macro_targets(Weight_kg, tdee);

  // ── Fetch entries for selected date ──
  const fetchEntries = useCallback(async () => {
    if (!user_id) return;
    if (!hasLoadedOnce.current) Set_loading(true);
    Set_error(null);

    const d = new Date(`${Selected_date}T12:00:00`);
    const range_start =
      View_mode === "week"
        ? Start_of_week(d)
        : new Date(d.getFullYear(), d.getMonth(), 1);
    const range_end =
      View_mode === "week"
        ? Add_days(range_start, 6)
        : new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startDateKey = To_date_key(range_start);
    const endDateKey = To_date_key(range_end);

    try {
      const supabase = Get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("diet_entries")
        .select("*")
        .eq("user_id", user_id)
        .gte("entry_date", startDateKey)
        .lte("entry_date", endDateKey)
        .order("created_at", { ascending: true });

      if (fetch_error) {
        Set_error(Get_user_facing_error(fetch_error.message));
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
          .eq("workout_date", Selected_date);

        const totalBurned = (workoutData ?? []).reduce(
          (sum, w) => sum + (parseInt(w.Calories_burned, 10) || 0),
          0,
        );
        Set_calories_burned(totalBurned);
      } catch {
        // Calories_burned column may not exist yet — ignore
        Set_calories_burned(0);
      }
    } catch (err) {
      Set_error(Get_user_facing_error(err.message));
      setEntries([]);
    }
    hasLoadedOnce.current = true;
    Set_loading(false);
  }, [Selected_date, View_mode, user_id]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Fetch Presets ──
  const Fetch_presets = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = Get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("diet_presets")
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

  // ── Floating actions ──
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

  // ── Daily totals ──
  // ── Entries for the selected date only ──
  const dayEntries = useMemo(
    () => entries.filter((e) => e.Entry_date === Selected_date),
    [entries, Selected_date],
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

  const changeDate = (offset) => {
    const d = new Date(`${Selected_date}T12:00:00`);
    d.setDate(d.getDate() + offset);
    Set_selected_date(d.toISOString().slice(0, 10));
  };

  const shiftNav = (direction) => {
    const offset = View_mode === "week" ? 7 : 30;
    changeDate(direction === "next" ? offset : -offset);
  };

  const formatSelectedDate = () => {
    const d = new Date(`${Selected_date}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const Is_today = Selected_date === today;

  const Week_days = useMemo(() => {
    const d = new Date(`${Selected_date}T12:00:00`);
    const start = Start_of_week(d);
    return Array.from({ length: 7 }, (_, i) => Add_days(start, i));
  }, [Selected_date]);

  const Month_days = useMemo(() => {
    const d = new Date(`${Selected_date}T12:00:00`);
    const start = Start_of_week(new Date(d.getFullYear(), d.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => Add_days(start, i));
  }, [Selected_date]);

  const Visible_days = View_mode === "week" ? Week_days : Month_days;

  // ── Modal open/close ──
  const Open_add_modal = (mealType = "breakfast") => {
    setEditingEntry(null);
    Set_form({
      ...Empty_entry_form(),
      Entry_date: Selected_date,
      meal_type: mealType,
    });
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  const Open_edit_modal = (entry) => {
    setEditingEntry(entry);
    Set_form({
      Entry_date: entry.entry_date,
      meal_type: entry.meal_type,
      food_name: entry.food_name ?? "",
      calories: entry.calories ? String(entry.calories) : "",
      protein_g: entry.protein_g ? String(entry.protein_g) : "",
      carbs_g: entry.carbs_g ? String(entry.carbs_g) : "",
      fats_g: entry.fats_g ? String(entry.fats_g) : "",
      fiber_g: entry.fiber_g ? String(entry.fiber_g) : "",
    });
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  const Close_form_modal = () => {
    Form_modal.close_modal();
    setTimeout(() => {
      setEditingEntry(null);
      Set_form(Empty_entry_form());
      Set_field_states({});
    }, MODAL_EXIT_MS);
  };

  // ── Presets ──
  const Open_preset_modal = (preset = null) => {
    if (preset) {
      Set_editing_preset(preset);
      Set_preset_form({
        name: preset.name,
        meal_type: preset.meal_type || "breakfast",
        calories: preset.calories ? String(preset.calories) : "",
        protein_g: preset.protein_g ? String(preset.protein_g) : "",
        carbs_g: preset.carbs_g ? String(preset.carbs_g) : "",
        fats_g: preset.fats_g ? String(preset.fats_g) : "",
        fiber_g: preset.fiber_g ? String(preset.fiber_g) : "",
      });
    } else {
      Set_editing_preset(null);
      Set_preset_form({
        name: "",
        meal_type: "breakfast",
        calories: "",
        protein_g: "",
        carbs_g: "",
        fats_g: "",
        fiber_g: "",
      });
    }
    Preset_modal.open_modal();
  };

  const Close_preset_modal = () => {
    Preset_modal.close_modal();
    setTimeout(() => {
      Set_editing_preset(null);
    }, MODAL_EXIT_MS);
  };

  const Save_preset = useCallback(async () => {
    const name = Preset_form.name.trim();
    if (!name) return;
    const payload = {
      name,
      meal_type: Preset_form.meal_type,
      calories: Sanitize_number(Preset_form.calories, 0, 10000) ?? 0,
      protein_g: Sanitize_number(Preset_form.protein_g, 0, 999) ?? 0,
      carbs_g: Sanitize_number(Preset_form.carbs_g, 0, 999) ?? 0,
      fats_g: Sanitize_number(Preset_form.fats_g, 0, 999) ?? 0,
      fiber_g: Sanitize_number(Preset_form.fiber_g, 0, 99) ?? 0,
      ...(user_id && { user_id: user_id }),
    };
    try {
      const supabase = Get_supabase_client();
      let dbError;
      if (Editing_preset) {
        ({ error: dbError } = await supabase
          .from("diet_presets")
          .update(payload)
          .eq("id", Editing_preset.id));
      } else {
        ({ error: dbError } = await supabase
          .from("diet_presets")
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
  }, [Preset_form, Editing_preset, Fetch_presets, Toast_success, Toast_error, user_id]);

  const Delete_preset = useCallback(
    async (id) => {
      try {
        const supabase = Get_supabase_client();
        const { error: dbError } = await supabase
          .from("diet_presets")
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
    setEditingEntry(null);
    Set_form({
      Entry_date: Selected_date,
      meal_type: preset.meal_type || "breakfast",
      food_name: preset.name,
      calories: preset.calories ? String(preset.calories) : "",
      protein_g: preset.protein_g ? String(preset.protein_g) : "",
      carbs_g: preset.carbs_g ? String(preset.carbs_g) : "",
      fats_g: preset.fats_g ? String(preset.fats_g) : "",
      fiber_g: preset.fiber_g ? String(preset.fiber_g) : "",
    });
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  // ── Validation ──
  const Validate_field = (field_name, value) => {
    switch (field_name) {
      case "food_name":
        return !value || !value.trim() ? "Enter food name" : null;
      case "Entry_date":
        return !value ? "Pick a date" : null;
      default:
        return null;
    }
  };

  const Handle_field_blur = (field_name) => {
    const error = Validate_field(field_name, form[field_name]);
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

  const Is_form_valid = useMemo(() => {
    if (!form.food_name || !form.food_name.trim()) return false;
    if (!form.Entry_date) return false;
    return true;
  }, [form]);

  // ── Submit ──
  const Handle_submit = async (e) => {
    e.preventDefault();

    const foodName = Sanitize_text(form.food_name, 120);
    const Entry_date = Sanitize_date(
      form.Entry_date,
      new Date().toISOString().slice(0, 10),
    );

    if (!foodName || !Entry_date) {
      const errors = {};
      const states = {};
      if (!foodName) {
        errors.food_name = "Enter food name";
        states.food_name = "error";
      }
      if (!Entry_date) {
        errors.Entry_date = "Pick a date";
        states.Entry_date = "error";
      }
      Set_field_errors((prev) => ({ ...prev, ...errors }));
      Set_field_states((prev) => ({ ...prev, ...states }));
      Set_shake_key((k) => k + 1);
      return;
    }

    Set_saving(true);
    Set_error(null);

    const payload = {
      entry_date: Entry_date,
      meal_type: form.meal_type,
      food_name: foodName,
      calories: Sanitize_number(form.calories, 0, 10000) ?? 0,
      protein_g: Sanitize_number(form.protein_g, 0, 999) ?? 0,
      carbs_g: Sanitize_number(form.carbs_g, 0, 999) ?? 0,
      fats_g: Sanitize_number(form.fats_g, 0, 999) ?? 0,
      fiber_g: Sanitize_number(form.fiber_g, 0, 99) ?? 0,
      ...(user_id && { user_id: user_id }),
    };

    try {
      const supabase = Get_supabase_client();
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

      Set_saving(false);

      if (dbError) {
        const message = Get_user_facing_error(dbError.message);
        Set_error(message);
        Toast_error(
          editingEntry ? "Couldn't update entry." : "Couldn't save entry.",
        );
        return;
      }

      Close_form_modal();
      Toast_success(editingEntry ? "Entry updated." : "Food logged.");
      fetchEntries();
    } catch (err) {
      Set_saving(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error(
        editingEntry ? "Couldn't update entry." : "Couldn't save entry.",
      );
    }
  };

  // ── Delete ──
  const openDeleteModal = (entry) => {
    Set_delete_target(entry);
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
        .from("diet_entries")
        .delete()
        .eq("id", Delete_target.id);

      Set_deleting(false);

      if (dbError) {
        Set_error(Get_user_facing_error(dbError.message));
        Toast_error("Failed to delete entry.");
        return;
      }

      const removedId = Delete_target.id;
      Close_delete_modal();
      Toast_success("Entry deleted.");
      Set_removing_id(removedId);
      setTimeout(() => {
        setEntries((prev) => prev.filter((e) => e.id !== removedId));
        Set_removing_id(null);
      }, 380);
    } catch (err) {
      Set_deleting(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error("Failed to delete entry.");
    }
  };

  const hasProfileForBMR = !!(Weight_kg && Height_cm && age);

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
              <Macro_progress_bar
                label="Calories"
                current={dailyTotals.calories}
                target={macroTargets.calories + Calories_burned}
                unit=" kcal"
                color="#f59e0b"
              />
              <Macro_progress_bar
                label="Protein"
                current={dailyTotals.protein}
                target={macroTargets.protein}
                unit="g"
                color="#34d399"
              />
              <Macro_progress_bar
                label="Carbs"
                current={dailyTotals.carbs}
                target={macroTargets.carbs}
                unit="g"
                color="#60a5fa"
              />
              <Macro_progress_bar
                label="Fats"
                current={dailyTotals.fats}
                target={macroTargets.fats}
                unit="g"
                color="#f472b6"
              />
              <Macro_progress_bar
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
      <div className="date-nav animate-in animate-in--2">
        <div className="date-nav__top">
          <button
            type="button"
            className="date-nav__btn"
            onClick={() => shiftNav("prev")}
            aria-label="Previous day"
          >
            ‹
          </button>
          <span className="date-nav__label">{formatSelectedDate()}</span>
          <button
            type="button"
            className="date-nav__btn"
            onClick={() => shiftNav("next")}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
        {!Is_today && (
          <button
            type="button"
            className="date-nav__today"
            onClick={() => Set_selected_date(today)}
          >
            Today
          </button>
        )}
      </div>

      {/* Week day selector */}
      <div
        className={`week-days animate-in animate-in--2${View_mode === "month" ? " week-days--month" : ""}`}
        role="group"
        aria-label={View_mode === "week" ? "Week days" : "Month days"}
      >
        {Visible_days.map((day) => {
          const key = To_date_key(day);
          const isSelected = key === Selected_date;
          const isDayToday = key === today;
          const hasEntries = entries.some((e) => e.Entry_date === key);
          const d = new Date(`${Selected_date}T12:00:00`);
          const isInCurrentMonth =
            View_mode === "month"
              ? day.getMonth() === d.getMonth()
              : true;

          return (
            <button
              key={key}
              type="button"
              className={`week-day${isSelected ? " week-day--active" : ""}${isDayToday ? " week-day--today" : ""}${hasEntries ? " week-day--busy" : ""}${!isInCurrentMonth ? " week-day--muted" : ""}`}
              onClick={() => Set_selected_date(key)}
              aria-pressed={isSelected}
            >
              <span className="week-day__label">{WEEKDAYS[day.getDay()]}</span>
              <span className="week-day__num">{day.getDate()}</span>
              {hasEntries && (
                <span className="week-day-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* View toggle */}
      <div
        className="view-toggle animate-in animate-in--2"
        role="tablist"
        aria-label="Diet view"
      >
        <button
          type="button"
          className={`view-btn${View_mode === "week" ? " view-btn--active" : ""}`}
          onClick={() => Set_view_mode("week")}
          aria-pressed={View_mode === "week"}
        >
          1 week
        </button>
        <button
          type="button"
          className={`view-btn${View_mode === "month" ? " view-btn--active" : ""}`}
          onClick={() => Set_view_mode("month")}
          aria-pressed={View_mode === "month"}
        >
          1 month
        </button>
      </div>

      {/* Daily summary */}
      <div className="fitness__summary animate-in animate-in--3" key={Selected_date}>
        <Glass_card
          value={Math.round(dailyTotals.calories).toString()}
          label="Calories"
          className="fitness__stat fitness__stat--diet glass-stat"
        />
        <Glass_card
          value={`${Math.round(dailyTotals.protein)}g`}
          label="Protein"
          className="fitness__stat fitness__stat--diet glass-stat"
        />
        <Glass_card
          value={`${Math.round(dailyTotals.carbs)}g`}
          label="Carbs"
          className="fitness__stat fitness__stat--diet glass-stat"
        />
        <Glass_card
          value={`${Math.round(dailyTotals.fats)}g`}
          label="Fats"
          className="fitness__stat fitness__stat--diet glass-stat"
        />
        <Glass_card
          value={Calories_burned > 0 ? Calories_burned.toString() : "—"}
          label="Burned"
          className="fitness__stat fitness__stat--workout glass-stat"
        />
      </div>

      {error && (
        <p className="error-box error-box--shake" role="alert">
          {error}
        </p>
      )}

      {/* Presets (quick-add) */}
      <div className="template-chips animate-in animate-in--3">
        {Presets.map((preset) => (
          <div key={preset.id} className="preset">
            <button
              type="button"
              className="template-chip"
              onClick={() => applyPreset(preset)}
            >
              {preset.name}
              <span className="template-chip__meta">
                {preset.calories}kcal
              </span>
            </button>
            <button
              type="button"
              className="preset__edit"
              onClick={() => Open_preset_modal(preset)}
              aria-label={`Edit ${preset.name} preset`}
            >
              ✎
            </button>
          </div>
        ))}
        <button
          type="button"
          className="template-chip template-chip--add"
          onClick={() => Open_preset_modal()}
        >
          + New preset
        </button>
      </div>

      {/* Food log grouped by meal */}
      <div className="fitness__meals animate-in animate-in--4">
        {MEAL_TYPES.map((meal) => (
          <Meal_group
            key={meal.id}
            meal={meal}
            entries={groupedEntries[meal.id]}
            Removing_id={Removing_id}
            onEdit={Open_edit_modal}
            onDelete={openDeleteModal}
            on_add_for_meal={Open_add_modal}
            Add_btn_ref={Add_btn_ref}
          />
        ))}
      </div>

      {/* Add/Edit Entry Modal */}
      <Diet_entry_form
        open={Form_modal.open}
        closing={Form_modal.closing}
        onClose={Close_form_modal}
        editingEntry={editingEntry}
        form={form}
        Set_form={Set_form}
        Saving={Saving}
        Is_form_valid={Is_form_valid}
        Field_errors={Field_errors}
        Set_field_errors={Set_field_errors}
        Field_states={Field_states}
        Shake_key={Shake_key}
        onSubmit={Handle_submit}
        onFieldBlur={Handle_field_blur}
      />

      {/* Preset Modal */}
      <Sheet_modal
        open={Preset_modal.open}
        closing={Preset_modal.closing}
        onClose={Close_preset_modal}
        title={Editing_preset ? "Edit meal preset" : "Create meal preset"}
      >
        <p className="fitness__preset-hint">
          Save common meals for quick logging.
        </p>
        <div className="fitness__form">
          <Form_field label="Preset name">
            <input
              type="text"
              value={Preset_form.name}
              onChange={(e) =>
                Set_preset_form((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Protein shake, Chicken & rice"
              maxLength={60}
              autoFocus
            />
          </Form_field>
          <Form_field label="Meal type">
            <select
              value={Preset_form.meal_type}
              onChange={(e) =>
                Set_preset_form((f) => ({ ...f, meal_type: e.target.value }))
              }
            >
              {MEAL_TYPES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Form_field>
          <Form_field label="Calories (kcal)">
            <input
              type="number"
              min="0"
              max="10000"
              step="1"
              placeholder="0"
              value={Preset_form.calories}
              onChange={(e) =>
                Set_preset_form((f) => ({ ...f, calories: e.target.value }))
              }
            />
          </Form_field>
          <div className="fitness__macro-inputs">
            <Form_field label="Protein (g)">
              <input
                type="number"
                min="0"
                max="999"
                step="0.1"
                placeholder="0"
                value={Preset_form.protein_g}
                onChange={(e) =>
                  Set_preset_form((f) => ({ ...f, protein_g: e.target.value }))
                }
              />
            </Form_field>
            <Form_field label="Carbs (g)">
              <input
                type="number"
                min="0"
                max="999"
                step="0.1"
                placeholder="0"
                value={Preset_form.carbs_g}
                onChange={(e) =>
                  Set_preset_form((f) => ({ ...f, carbs_g: e.target.value }))
                }
              />
            </Form_field>
            <Form_field label="Fats (g)">
              <input
                type="number"
                min="0"
                max="999"
                step="0.1"
                placeholder="0"
                value={Preset_form.fats_g}
                onChange={(e) =>
                  Set_preset_form((f) => ({ ...f, fats_g: e.target.value }))
                }
              />
            </Form_field>
          </div>
          <Form_field label="Fiber (g)" optional>
            <input
              type="number"
              min="0"
              max="99"
              step="0.1"
              placeholder="0"
              value={Preset_form.fiber_g}
              onChange={(e) =>
                Set_preset_form((f) => ({ ...f, fiber_g: e.target.value }))
              }
            />
          </Form_field>
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
          Delete_target && (
            <>
              <span className="fitness__delete-date">
                {Delete_target.food_name}
              </span>
              <span className="fitness__delete-name">
                {Math.round(Number(Delete_target.calories))} kcal
              </span>
            </>
          )
        }
      />
    </div>
  );
}

export default Diet_tracker;
