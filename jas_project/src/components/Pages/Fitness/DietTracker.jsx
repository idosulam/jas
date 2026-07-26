import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { useUserId } from "../../../lib/Auth_context.jsx";
import {
  getUserFacingError,
  sanitizeDate,
  sanitizeNumber,
  sanitizeText,
  hapticError,
} from "../../../lib/security";
import { useBodyScrollLock, useModal } from "../../../hooks";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import {
  calcBMR,
  calcTDEE,
  calcMacroTargets,
  ACTIVITY_LEVELS,
  GENDER_OPTIONS,
} from "./macro_calculator";

import SheetModal from "../../../components/ui/modals/Sheet_modal";
import ConfirmModal from "../../../components/ui/modals/Confirm_modal";
import FormField from "../../../components/ui/form/Form_field.jsx";
import EmptyState from "../../../components/ui/Empty_state";
import LoadingSkeleton from "../../../components/ui/Loading_skeleton";
import GlassCard from "../../../components/ui/Glass_card";

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

function MacroProgressBar({ label, current, target, unit, color }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const over = current > target;

  return (
    <div className="fitness__macro-bar">
      <div className="fitness__macro-bar-header">
        <span className="fitness__macro-bar-label">{label}</span>
        <span className="fitness__macro-bar-values">
          <span className={`fitness__macro-bar-current${over ? " fitness__macro-bar-current--over" : ""}`}>
            {Math.round(current)}
          </span>
          <span className="fitness__macro-bar-sep">/</span>
          <span className="fitness__macro-bar-target">{target}{unit}</span>
        </span>
      </div>
      <div className="fitness__macro-bar-track">
        <div
          className={`fitness__macro-bar-fill${over ? " fitness__macro-bar-fill--over" : ""}`}
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: over ? "#f87171" : color,
          }}
        />
      </div>
    </div>
  );
}

function DietTracker({ profileData }) {
  const userId = useUserId();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState("week");
  const [entries, setEntries] = useState([]);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyEntryForm());
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldStates, setFieldStates] = useState({});
  const [shakeKey, setShakeKey] = useState(0);
  const [presets, setPresets] = useState([]);
  const [editingPreset, setEditingPreset] = useState(null);
  const [presetForm, setPresetForm] = useState({
    name: "",
    meal_type: "breakfast",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fats_g: "",
    fiber_g: "",
  });
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const addBtnRef = useRef(null);
  const hasLoadedOnce = useRef(false);

  const formModal = useModal(MODAL_EXIT_MS);
  const deleteModal = useModal(MODAL_EXIT_MS);
  const presetModal = useModal(MODAL_EXIT_MS);

  const { success: toastSuccess, error: toastError } = useGlassToast();

  // ── Profile-derived macro targets ──
  const profile = profileData;
  const weightKg = profile?.weight_kg ? Number(profile.weight_kg) : null;
  const heightCm = profile?.height_cm ? Number(profile.height_cm) : null;
  const age = profile?.age ? Number(profile.age) : null;
  const gender = profile?.gender || "male";
  const rawActivityLevel = profile?.activity_level || "moderate";
  const activityLevel = ACTIVITY_LEVELS.some((l) => l.id === rawActivityLevel)
    ? rawActivityLevel
    : "moderate";

  const bmr = calcBMR(weightKg, heightCm, age, gender);
  const tdee = calcTDEE(bmr, activityLevel);
  const macroTargets = calcMacroTargets(weightKg, tdee);

  // ── Fetch entries for selected date ──
  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    if (!hasLoadedOnce.current) setLoading(true);
    setError(null);

    const d = new Date(`${selectedDate}T12:00:00`);
    const rangeStart =
      viewMode === "week"
        ? startOfWeek(d)
        : new Date(d.getFullYear(), d.getMonth(), 1);
    const rangeEnd =
      viewMode === "week"
        ? addDays(rangeStart, 6)
        : new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startDateKey = toDateKey(rangeStart);
    const endDateKey = toDateKey(rangeEnd);

    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("diet_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("entry_date", startDateKey)
        .lte("entry_date", endDateKey)
        .order("created_at", { ascending: true });

      if (fetchError) {
        setError(getUserFacingError(fetchError.message));
        setEntries([]);
      } else {
        setEntries(data ?? []);
      }

      // Fetch calories burned from workouts for this date
      const { data: workoutData } = await supabase
        .from("workout_logs")
        .select("calories_burned")
        .eq("user_id", userId)
        .eq("workout_date", selectedDate);

      const totalBurned = (workoutData ?? []).reduce(
        (sum, w) => sum + (parseInt(w.calories_burned, 10) || 0),
        0,
      );
      setCaloriesBurned(totalBurned);
    } catch (err) {
      setError(getUserFacingError(err.message));
      setEntries([]);
    }
    hasLoadedOnce.current = true;
    setLoading(false);
  }, [selectedDate, viewMode, userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Fetch presets ──
  const fetchPresets = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("diet_presets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (!fetchError) setPresets(data ?? []);
    } catch {
      // silent
    }
  }, [userId]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  useBodyScrollLock(formModal.open, deleteModal.open, presetModal.open);

  // ── Floating actions ──
  useEffect(() => {
    const target = addBtnRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const scrolledPastIt =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setShowFloatingActions(scrolledPastIt);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // ── Daily totals ──
  // ── Entries for the selected date only ──
  const dayEntries = useMemo(
    () => entries.filter((e) => e.entry_date === selectedDate),
    [entries, selectedDate],
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
  const startOfWeek = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const addDays = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  };

  const toDateKey = (date) => date.toISOString().slice(0, 10);

  const changeDate = (offset) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const shiftNav = (direction) => {
    const offset = viewMode === "week" ? 7 : 30;
    changeDate(direction === "next" ? offset : -offset);
  };

  const formatSelectedDate = () => {
    const d = new Date(`${selectedDate}T12:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const isToday = selectedDate === today;

  const weekDays = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00`);
    const start = startOfWeek(d);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const d = new Date(`${selectedDate}T12:00:00`);
    const start = startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const visibleDays = viewMode === "week" ? weekDays : monthDays;

  // ── Modal open/close ──
  const openAddModal = (mealType = "breakfast") => {
    setEditingEntry(null);
    setForm({
      ...emptyEntryForm(),
      entry_date: selectedDate,
      meal_type: mealType,
    });
    setFieldErrors({});
    setFieldStates({});
    formModal.openModal();
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setForm({
      entry_date: entry.entry_date,
      meal_type: entry.meal_type,
      food_name: entry.food_name ?? "",
      calories: entry.calories ? String(entry.calories) : "",
      protein_g: entry.protein_g ? String(entry.protein_g) : "",
      carbs_g: entry.carbs_g ? String(entry.carbs_g) : "",
      fats_g: entry.fats_g ? String(entry.fats_g) : "",
      fiber_g: entry.fiber_g ? String(entry.fiber_g) : "",
    });
    setFieldErrors({});
    setFieldStates({});
    formModal.openModal();
  };

  const closeFormModal = () => {
    formModal.closeModal();
    setTimeout(() => {
      setEditingEntry(null);
      setForm(emptyEntryForm());
      setFieldStates({});
    }, MODAL_EXIT_MS);
  };

  // ── Presets ──
  const openPresetModal = (preset = null) => {
    if (preset) {
      setEditingPreset(preset);
      setPresetForm({
        name: preset.name,
        meal_type: preset.meal_type || "breakfast",
        calories: preset.calories ? String(preset.calories) : "",
        protein_g: preset.protein_g ? String(preset.protein_g) : "",
        carbs_g: preset.carbs_g ? String(preset.carbs_g) : "",
        fats_g: preset.fats_g ? String(preset.fats_g) : "",
        fiber_g: preset.fiber_g ? String(preset.fiber_g) : "",
      });
    } else {
      setEditingPreset(null);
      setPresetForm({
        name: "",
        meal_type: "breakfast",
        calories: "",
        protein_g: "",
        carbs_g: "",
        fats_g: "",
        fiber_g: "",
      });
    }
    presetModal.openModal();
  };

  const closePresetModal = () => {
    presetModal.closeModal();
    setTimeout(() => {
      setEditingPreset(null);
    }, MODAL_EXIT_MS);
  };

  const savePreset = useCallback(async () => {
    const name = presetForm.name.trim();
    if (!name) return;
    const payload = {
      name,
      meal_type: presetForm.meal_type,
      calories: sanitizeNumber(presetForm.calories, 0, 10000) ?? 0,
      protein_g: sanitizeNumber(presetForm.protein_g, 0, 999) ?? 0,
      carbs_g: sanitizeNumber(presetForm.carbs_g, 0, 999) ?? 0,
      fats_g: sanitizeNumber(presetForm.fats_g, 0, 999) ?? 0,
      fiber_g: sanitizeNumber(presetForm.fiber_g, 0, 99) ?? 0,
      ...(userId && { user_id: userId }),
    };
    try {
      const supabase = getSupabaseClient();
      let dbError;
      if (editingPreset) {
        ({ error: dbError } = await supabase
          .from("diet_presets")
          .update(payload)
          .eq("id", editingPreset.id));
      } else {
        ({ error: dbError } = await supabase
          .from("diet_presets")
          .insert(payload));
      }
      if (dbError) {
        toastError(getUserFacingError(dbError.message));
        return;
      }
      closePresetModal();
      toastSuccess(editingPreset ? "Preset updated." : "Preset created.");
      fetchPresets();
    } catch (err) {
      toastError(getUserFacingError(err.message));
    }
  }, [presetForm, editingPreset, fetchPresets, toastSuccess, toastError, userId]);

  const deletePreset = useCallback(
    async (id) => {
      try {
        const supabase = getSupabaseClient();
        const { error: dbError } = await supabase
          .from("diet_presets")
          .delete()
          .eq("id", id);
        if (dbError) {
          toastError(getUserFacingError(dbError.message));
          return;
        }
        toastSuccess("Preset removed.");
        fetchPresets();
      } catch (err) {
        toastError(getUserFacingError(err.message));
      }
    },
    [fetchPresets, toastSuccess, toastError],
  );

  const applyPreset = (preset) => {
    setEditingEntry(null);
    setForm({
      entry_date: selectedDate,
      meal_type: preset.meal_type || "breakfast",
      food_name: preset.name,
      calories: preset.calories ? String(preset.calories) : "",
      protein_g: preset.protein_g ? String(preset.protein_g) : "",
      carbs_g: preset.carbs_g ? String(preset.carbs_g) : "",
      fats_g: preset.fats_g ? String(preset.fats_g) : "",
      fiber_g: preset.fiber_g ? String(preset.fiber_g) : "",
    });
    setFieldErrors({});
    setFieldStates({});
    formModal.openModal();
  };

  // ── Validation ──
  const validateField = (fieldName, value) => {
    switch (fieldName) {
      case "food_name":
        return !value || !value.trim() ? "Enter food name" : null;
      case "entry_date":
        return !value ? "Pick a date" : null;
      default:
        return null;
    }
  };

  const handleFieldBlur = (fieldName) => {
    const error = validateField(fieldName, form[fieldName]);
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

  const isFormValid = useMemo(() => {
    if (!form.food_name || !form.food_name.trim()) return false;
    if (!form.entry_date) return false;
    return true;
  }, [form]);

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();

    const foodName = sanitizeText(form.food_name, 120);
    const entryDate = sanitizeDate(
      form.entry_date,
      new Date().toISOString().slice(0, 10),
    );

    if (!foodName || !entryDate) {
      const errors = {};
      const states = {};
      if (!foodName) {
        errors.food_name = "Enter food name";
        states.food_name = "error";
      }
      if (!entryDate) {
        errors.entry_date = "Pick a date";
        states.entry_date = "error";
      }
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      setFieldStates((prev) => ({ ...prev, ...states }));
      setShakeKey((k) => k + 1);
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      entry_date: entryDate,
      meal_type: form.meal_type,
      food_name: foodName,
      calories: sanitizeNumber(form.calories, 0, 10000) ?? 0,
      protein_g: sanitizeNumber(form.protein_g, 0, 999) ?? 0,
      carbs_g: sanitizeNumber(form.carbs_g, 0, 999) ?? 0,
      fats_g: sanitizeNumber(form.fats_g, 0, 999) ?? 0,
      fiber_g: sanitizeNumber(form.fiber_g, 0, 99) ?? 0,
      ...(userId && { user_id: userId }),
    };

    try {
      const supabase = getSupabaseClient();
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

      setSaving(false);

      if (dbError) {
        const message = getUserFacingError(dbError.message);
        setError(message);
        toastError(
          editingEntry ? "Couldn't update entry." : "Couldn't save entry.",
        );
        return;
      }

      closeFormModal();
      toastSuccess(editingEntry ? "Entry updated." : "Food logged.");
      fetchEntries();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError(
        editingEntry ? "Couldn't update entry." : "Couldn't save entry.",
      );
    }
  };

  // ── Delete ──
  const openDeleteModal = (entry) => {
    setDeleteTarget(entry);
    deleteModal.openModal();
  };

  const closeDeleteModal = () => {
    deleteModal.closeModal();
    setTimeout(() => {
      setDeleteTarget(null);
    }, MODAL_EXIT_MS);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("diet_entries")
        .delete()
        .eq("id", deleteTarget.id);

      setDeleting(false);

      if (dbError) {
        setError(getUserFacingError(dbError.message));
        toastError("Failed to delete entry.");
        return;
      }

      const removedId = deleteTarget.id;
      closeDeleteModal();
      toastSuccess("Entry deleted.");
      setRemovingId(removedId);
      setTimeout(() => {
        setEntries((prev) => prev.filter((e) => e.id !== removedId));
        setRemovingId(null);
      }, 380);
    } catch (err) {
      setDeleting(false);
      setError(getUserFacingError(err.message));
      toastError("Failed to delete entry.");
    }
  };

  const hasProfileForBMR = !!(weightKg && heightCm && age);

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
                target={macroTargets.calories + caloriesBurned}
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
        {!isToday && (
          <button
            type="button"
            className="fitness__date-today"
            onClick={() => setSelectedDate(today)}
          >
            Today
          </button>
        )}
      </div>

      {/* Week day selector */}
      <div
        className={`fitness__week-days animate-in animate-in--2${viewMode === "month" ? " fitness__week-days--month" : ""}`}
        role="group"
        aria-label={viewMode === "week" ? "Week days" : "Month days"}
      >
        {visibleDays.map((day) => {
          const key = toDateKey(day);
          const isSelected = key === selectedDate;
          const isDayToday = key === today;
          const hasEntries = entries.some((e) => e.entry_date === key);
          const d = new Date(`${selectedDate}T12:00:00`);
          const isInCurrentMonth =
            viewMode === "month"
              ? day.getMonth() === d.getMonth()
              : true;

          return (
            <button
              key={key}
              type="button"
              className={`fitness__week-day${isSelected ? " fitness__week-day--active" : ""}${isDayToday ? " fitness__week-day--today" : ""}${hasEntries ? " fitness__week-day--busy" : ""}${!isInCurrentMonth ? " fitness__week-day--muted" : ""}`}
              onClick={() => setSelectedDate(key)}
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
          className={`fitness__view-btn${viewMode === "week" ? " fitness__view-btn--active" : ""}`}
          onClick={() => setViewMode("week")}
          aria-pressed={viewMode === "week"}
        >
          1 week
        </button>
        <button
          type="button"
          className={`fitness__view-btn${viewMode === "month" ? " fitness__view-btn--active" : ""}`}
          onClick={() => setViewMode("month")}
          aria-pressed={viewMode === "month"}
        >
          1 month
        </button>
      </div>

      {/* Daily summary */}
      <div className="fitness__summary animate-in animate-in--3" key={selectedDate}>
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
          value={caloriesBurned > 0 ? caloriesBurned.toString() : "—"}
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
              onClick={() => openPresetModal(preset)}
              aria-label={`Edit ${preset.name} preset`}
            >
              ✎
            </button>
          </div>
        ))}
        <button
          type="button"
          className="fitness__template-chip fitness__template-chip--add"
          onClick={() => openPresetModal()}
        >
          + New preset
        </button>
      </div>

      {/* Food log grouped by meal */}
      <div className="fitness__meals animate-in animate-in--4">
        {MEAL_TYPES.map((meal) => {
          const mealEntries = groupedEntries[meal.id];
          const mealCals = mealEntries.reduce(
            (s, e) => s + (Number(e.calories) || 0),
            0,
          );

          return (
            <div key={meal.id} className="fitness__meal-group">
              <div className="fitness__meal-header">
                <h3 className="fitness__meal-title">{meal.label}</h3>
                <div className="fitness__meal-actions">
                  <span className="fitness__meal-cals">
                    {Math.round(mealCals)} kcal
                  </span>
                  <button
                    type="button"
                    className="fitness__meal-add"
                    onClick={() => openAddModal(meal.id)}
                    ref={meal.id === "breakfast" ? addBtnRef : undefined}
                    aria-label={`Add ${meal.label} entry`}
                  >
                    +
                  </button>
                </div>
              </div>
              {mealEntries.length === 0 ? (
                <p className="fitness__meal-empty">No entries</p>
              ) : (
                <ul className="fitness__meal-list">
                  {mealEntries.map((entry) => {
                    const isRemoving = removingId === entry.id;
                    return (
                      <li
                        key={entry.id}
                        className={`fitness__entry${isRemoving ? " fitness__entry--removing" : ""}`}
                      >
                        <div className="fitness__entry-main">
                          <span className="fitness__entry-name">
                            {entry.food_name}
                          </span>
                          <span className="fitness__entry-macros">
                            {Number(entry.calories) > 0 && (
                              <span>{Math.round(Number(entry.calories))}kcal</span>
                            )}
                            {Number(entry.protein_g) > 0 && (
                              <span>P:{Math.round(Number(entry.protein_g))}g</span>
                            )}
                            {Number(entry.carbs_g) > 0 && (
                              <span>C:{Math.round(Number(entry.carbs_g))}g</span>
                            )}
                            {Number(entry.fats_g) > 0 && (
                              <span>F:{Math.round(Number(entry.fats_g))}g</span>
                            )}
                          </span>
                        </div>
                        <div className="fitness__entry-actions">
                          <button
                            type="button"
                            className="fitness__entry-btn fitness__entry-btn--edit"
                            onClick={() => openEditModal(entry)}
                            aria-label="Edit entry"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="fitness__entry-btn fitness__entry-btn--delete"
                            onClick={() => openDeleteModal(entry)}
                            aria-label="Delete entry"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Entry Modal */}
      <SheetModal
        open={formModal.open}
        closing={formModal.closing}
        onClose={closeFormModal}
        title={editingEntry ? "Edit food" : "Log food"}
      >
        <form className="fitness__form" onSubmit={handleSubmit}>
          <FormField
            label="Date"
            error={fieldErrors.entry_date}
            state={fieldStates.entry_date}
            showIndicator
            shake={fieldErrors.entry_date ? shakeKey : 0}
          >
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => {
                setForm((f) => ({ ...f, entry_date: e.target.value }));
                setFieldErrors((prev) => ({ ...prev, entry_date: null }));
              }}
              onBlur={() => handleFieldBlur("entry_date")}
              required
            />
          </FormField>

          <FormField label="Meal type">
            <select
              value={form.meal_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, meal_type: e.target.value }))
              }
            >
              {MEAL_TYPES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Food name"
            error={fieldErrors.food_name}
            state={fieldStates.food_name}
            showIndicator
            shake={fieldErrors.food_name ? shakeKey : 0}
          >
            <input
              type="text"
              placeholder="e.g. Chicken breast, Rice"
              value={form.food_name}
              maxLength={120}
              onChange={(e) => {
                setForm((f) => ({ ...f, food_name: e.target.value }));
                setFieldErrors((prev) => ({ ...prev, food_name: null }));
              }}
              onBlur={() => handleFieldBlur("food_name")}
              required
            />
          </FormField>

          <FormField label="Calories (kcal)">
            <input
              type="number"
              min="0"
              max="10000"
              step="1"
              placeholder="0"
              value={form.calories}
              onChange={(e) =>
                setForm((f) => ({ ...f, calories: e.target.value }))
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
                value={form.protein_g}
                onChange={(e) =>
                  setForm((f) => ({ ...f, protein_g: e.target.value }))
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
                value={form.carbs_g}
                onChange={(e) =>
                  setForm((f) => ({ ...f, carbs_g: e.target.value }))
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
                value={form.fats_g}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fats_g: e.target.value }))
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
              value={form.fiber_g}
              onChange={(e) =>
                setForm((f) => ({ ...f, fiber_g: e.target.value }))
              }
            />
          </FormField>

          <div className="btn-row">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closeFormModal}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !isFormValid}
            >
              {saving ? (
                <>
                  <span className="btn__spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : editingEntry ? (
                "Save changes"
              ) : (
                "Log food"
              )}
            </button>
          </div>
        </form>
      </SheetModal>

      {/* Preset Modal */}
      <SheetModal
        open={presetModal.open}
        closing={presetModal.closing}
        onClose={closePresetModal}
        title={editingPreset ? "Edit meal preset" : "Create meal preset"}
      >
        <p className="fitness__preset-hint">
          Save common meals for quick logging.
        </p>
        <div className="fitness__form">
          <FormField label="Preset name">
            <input
              type="text"
              value={presetForm.name}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Protein shake, Chicken & rice"
              maxLength={60}
              autoFocus
            />
          </FormField>
          <FormField label="Meal type">
            <select
              value={presetForm.meal_type}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, meal_type: e.target.value }))
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
              value={presetForm.calories}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, calories: e.target.value }))
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
                value={presetForm.protein_g}
                onChange={(e) =>
                  setPresetForm((f) => ({ ...f, protein_g: e.target.value }))
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
                value={presetForm.carbs_g}
                onChange={(e) =>
                  setPresetForm((f) => ({ ...f, carbs_g: e.target.value }))
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
                value={presetForm.fats_g}
                onChange={(e) =>
                  setPresetForm((f) => ({ ...f, fats_g: e.target.value }))
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
              value={presetForm.fiber_g}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, fiber_g: e.target.value }))
              }
            />
          </FormField>
          <div className="btn-row">
            {editingPreset && (
              <button
                type="button"
                className="btn btn--danger-outline"
                onClick={() => {
                  deletePreset(editingPreset.id);
                  closePresetModal();
                }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closePresetModal}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={savePreset}
              disabled={!presetForm.name.trim()}
            >
              {editingPreset ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </SheetModal>

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        closing={deleteModal.closing}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this food entry?"
        description="This action cannot be undone."
        confirmLabel="Delete entry"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        }
        preview={
          deleteTarget && (
            <>
              <span className="fitness__delete-date">
                {deleteTarget.food_name}
              </span>
              <span className="fitness__delete-name">
                {Math.round(Number(deleteTarget.calories))} kcal
              </span>
            </>
          )
        }
      />
    </div>
  );
}

export default DietTracker;
