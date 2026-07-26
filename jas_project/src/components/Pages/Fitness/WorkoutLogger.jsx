import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { useUserId } from "../../../lib/Auth_context.jsx";
import {
  getUserFacingError,
  sanitizeDate,
  sanitizeNumber,
  sanitizeText,
  formatDateFriendly,
  hapticError,
} from "../../../lib/security";
import { useBodyScrollLock, useModal } from "../../../hooks";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";

import SheetModal from "../../../components/ui/modals/Sheet_modal";
import ConfirmModal from "../../../components/ui/modals/Confirm_modal";
import FormField from "../../../components/ui/form/Form_field.jsx";
import EmptyState from "../../../components/ui/Empty_state";
import LoadingSkeleton from "../../../components/ui/Loading_skeleton";
import GlassCard from "../../../components/ui/Glass_card";
import FAB from "../../../components/ui/FAB";

const MODAL_EXIT_MS = 320;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function emptyExercise() {
  return { name: "", weight: "", sets: "", reps: "" };
}

function emptyForm() {
  return {
    workout_date: new Date().toISOString().slice(0, 10),
    preset_name: "",
    exercises: [emptyExercise()],
    notes: "",
    duration_minutes: "",
    calories_burned: "",
  };
}

function calcVolume(exercises) {
  return exercises.reduce((sum, ex) => {
    const w = parseFloat(ex.weight) || 0;
    const s = parseInt(ex.sets, 10) || 0;
    const r = parseInt(ex.reps, 10) || 0;
    return sum + w * s * r;
  }, 0);
}

function formatVolume(vol) {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return String(Math.round(vol));
}

function WorkoutLogger() {
  const userId = useUserId();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(now);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [editingWorkout, setEditingWorkout] = useState(null);
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
    exercises: [emptyExercise()],
  });
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const addBtnRef = useRef(null);

  const formModal = useModal(MODAL_EXIT_MS);
  const deleteModal = useModal(MODAL_EXIT_MS);
  const presetModal = useModal(MODAL_EXIT_MS);

  const { success: toastSuccess, error: toastError } = useGlassToast();

  // Week helpers
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

  const selectedKey = toDateKey(selectedDate);
  const isToday = selectedKey === toDateKey(now);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const dayTitle = useMemo(() => {
    return selectedDate.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [selectedDate]);


  // ── Fetch workouts ──
  const fetchWorkouts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const weekStart = startOfWeek(selectedDate);
    const weekEnd = addDays(weekStart, 6);
    const startDate = toDateKey(weekStart);
    const endDate = toDateKey(weekEnd);

    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("workout_date", startDate)
        .lte("workout_date", endDate)
        .order("workout_date", { ascending: true });

      if (fetchError) {
        setError(getUserFacingError(fetchError.message));
        setWorkouts([]);
      } else {
        setWorkouts(data ?? []);
      }
    } catch (err) {
      setError(getUserFacingError(err.message));
      setWorkouts([]);
    }
    setLoading(false);
  }, [selectedDate, userId]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  // ── Fetch presets ──
  const fetchPresets = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("workout_presets")
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

  // ── Floating actions observer ──
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
  const addExercise = () => {
    if (form.exercises.length >= 20) return;
    setForm((f) => ({
      ...f,
      exercises: [...f.exercises, emptyExercise()],
    }));
  };

  const removeExercise = (index) => {
    setForm((f) => ({
      ...f,
      exercises: f.exercises.filter((_, i) => i !== index),
    }));
  };

  const updateExercise = (index, field, value) => {
    setForm((f) => {
      const next = [...f.exercises];
      next[index] = { ...next[index], [field]: value };
      return { ...f, exercises: next };
    });
  };

  // ── Modal open/close ──
  const openAddModal = () => {
    setEditingWorkout(null);
    const f = emptyForm();
    f.workout_date = selectedKey;
    setForm(f);
    setFieldErrors({});
    setFieldStates({});
    formModal.openModal();
  };

  const openEditModal = (workout) => {
    setEditingWorkout(workout);
    const exercises =
      Array.isArray(workout.exercises) && workout.exercises.length > 0
        ? workout.exercises
        : [emptyExercise()];
    setForm({
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
    setFieldErrors({});
    setFieldStates({});
    formModal.openModal();
  };

  const closeFormModal = () => {
    formModal.closeModal();
    setTimeout(() => {
      setEditingWorkout(null);
      setForm(emptyForm());
      setFieldStates({});
    }, MODAL_EXIT_MS);
  };

  // ── Presets ──
  const openPresetModal = (preset = null) => {
    if (preset) {
      setEditingPreset(preset);
      const exercises =
        Array.isArray(preset.exercises) && preset.exercises.length > 0
          ? preset.exercises
          : [emptyExercise()];
      setPresetForm({ name: preset.name, exercises });
    } else {
      setEditingPreset(null);
      setPresetForm({ name: "", exercises: [emptyExercise()] });
    }
    presetModal.openModal();
  };

  const closePresetModal = () => {
    presetModal.closeModal();
    setTimeout(() => {
      setEditingPreset(null);
    }, MODAL_EXIT_MS);
  };

  const addPresetExercise = () => {
    if (presetForm.exercises.length >= 20) return;
    setPresetForm((f) => ({
      ...f,
      exercises: [...f.exercises, emptyExercise()],
    }));
  };

  const removePresetExercise = (index) => {
    setPresetForm((f) => ({
      ...f,
      exercises: f.exercises.filter((_, i) => i !== index),
    }));
  };

  const updatePresetExercise = (index, field, value) => {
    setPresetForm((f) => {
      const next = [...f.exercises];
      next[index] = { ...next[index], [field]: value };
      return { ...f, exercises: next };
    });
  };

  const savePreset = useCallback(async () => {
    const name = presetForm.name.trim();
    if (!name) return;
    const cleanedExercises = presetForm.exercises
      .filter((ex) => ex.name.trim())
      .map((ex) => ({
        name: sanitizeText(ex.name, 80),
        weight: ex.weight || "",
        sets: ex.sets || "",
        reps: ex.reps || "",
      }));
    const payload = {
      name,
      exercises: cleanedExercises,
      ...(userId && { user_id: userId }),
    };
    try {
      const supabase = getSupabaseClient();
      let dbError;
      if (editingPreset) {
        ({ error: dbError } = await supabase
          .from("workout_presets")
          .update(payload)
          .eq("id", editingPreset.id));
      } else {
        ({ error: dbError } = await supabase
          .from("workout_presets")
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
          .from("workout_presets")
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
    const exercises =
      Array.isArray(preset.exercises) && preset.exercises.length > 0
        ? preset.exercises.map((ex) => ({
            ...ex,
            name: sanitizeText(ex.name, 80),
          }))
        : [emptyExercise()];
    setEditingWorkout(null);
    setForm({
      workout_date: new Date().toISOString().slice(0, 10),
      preset_name: preset.name,
      exercises,
      notes: "",
      duration_minutes: "",
    });
    setFieldErrors({});
    setFieldStates({});
    formModal.openModal();
  };

  // ── Validation ──
  const validateField = (fieldName, value) => {
    switch (fieldName) {
      case "workout_date":
        return !value ? "Pick a date" : null;
      case "preset_name":
        return !value || !value.trim() ? "Workout name is required" : null;
      case "calories_burned": {
        if (!value) return null;
        const n = sanitizeNumber(value, 0, 9999);
        return n == null ? "Enter a valid number" : null;
      }
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
    if (!form.workout_date) return false;
    if (!form.preset_name || !form.preset_name.trim()) return false;
    const hasAtLeastOneExercise = form.exercises.some((ex) => ex.name.trim());
    return hasAtLeastOneExercise;
  }, [form]);

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();

    const workoutDate = sanitizeDate(
      form.workout_date,
      new Date().toISOString().slice(0, 10),
    );
    if (!workoutDate) {
      setFieldErrors({ workout_date: "Pick a date" });
      setFieldStates({ workout_date: "error" });
      setShakeKey((k) => k + 1);
      return;
    }

    const cleanedExercises = form.exercises
      .filter((ex) => ex.name.trim())
      .map((ex) => ({
        name: sanitizeText(ex.name, 80),
        weight: String(sanitizeNumber(ex.weight, 0, 9999) ?? ""),
        sets: String(sanitizeNumber(ex.sets, 0, 999) ?? ""),
        reps: String(sanitizeNumber(ex.reps, 0, 9999) ?? ""),
      }));

    if (cleanedExercises.length === 0) {
      setFieldErrors({ exercises: "Add at least one exercise" });
      setShakeKey((k) => k + 1);
      return;
    }

    const workoutName = form.preset_name.trim();
    if (!workoutName) {
      setFieldErrors({ preset_name: "Workout name is required" });
      setFieldStates({ preset_name: "error" });
      setShakeKey((k) => k + 1);
      return;
    }

    const duration = sanitizeNumber(form.duration_minutes, 1, 600);
    const caloriesBurned = sanitizeNumber(form.calories_burned, 0, 9999);
    const notes = form.notes.trim() ? sanitizeText(form.notes, 500) : null;

    setSaving(true);
    setError(null);

    const payload = {
      workout_date: workoutDate,
      preset_name: workoutName,
      exercises: cleanedExercises,
      notes,
      duration_minutes: duration ?? null,
      calories_burned: caloriesBurned ?? null,
      ...(userId && { user_id: userId }),
    };

    try {
      const supabase = getSupabaseClient();
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

      setSaving(false);

      if (dbError) {
        const message = getUserFacingError(dbError.message);
        setError(message);
        toastError(
          editingWorkout
            ? "Couldn't update workout."
            : "Couldn't save workout.",
        );
        return;
      }

      closeFormModal();
      toastSuccess(editingWorkout ? "Workout updated." : "Workout logged.");
      fetchWorkouts();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError(
        editingWorkout
          ? "Couldn't update workout."
          : "Couldn't save workout.",
      );
    }
  };

  // ── Delete ──
  const openDeleteModal = (workout) => {
    setDeleteTarget(workout);
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
        .from("workout_logs")
        .delete()
        .eq("id", deleteTarget.id);

      setDeleting(false);

      if (dbError) {
        setError(getUserFacingError(dbError.message));
        toastError("Failed to delete workout.");
        return;
      }

      const removedId = deleteTarget.id;
      closeDeleteModal();
      toastSuccess("Workout deleted.");
      setRemovingId(removedId);
      setTimeout(() => {
        setWorkouts((prev) => prev.filter((w) => w.id !== removedId));
        setRemovingId(null);
      }, 380);
    } catch (err) {
      setDeleting(false);
      setError(getUserFacingError(err.message));
      toastError("Failed to delete workout.");
    }
  };

  const volume = calcVolume(form.exercises);

  return (
    <div className="fitness__workout">
      {/* Weekly date navigation */}
      <div className="fitness__date-nav animate-in animate-in--1">
        <div className="fitness__date-top">
          <button
            type="button"
            className="fitness__date-btn"
            onClick={() => setSelectedDate((d) => addDays(d, -1))}
            aria-label="Previous day"
          >
            ‹
          </button>
          <span className="fitness__date-label">{dayTitle}</span>
          <button
            type="button"
            className="fitness__date-btn"
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            aria-label="Next day"
          >
            ›
          </button>
        </div>
        {!isToday && (
          <button
            type="button"
            className="fitness__date-today"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </button>
        )}
      </div>

      {/* Week day selector */}
      <div className="fitness__week-days animate-in animate-in--1">
        {weekDays.map((day) => {
          const key = toDateKey(day);
          const isSelected = key === selectedKey;
          const isDayToday = key === toDateKey(now);
          const hasWorkout = workouts.some((w) => w.workout_date === key);

          return (
            <button
              key={key}
              type="button"
              className={`fitness__week-day${isSelected ? " fitness__week-day--active" : ""}${isDayToday ? " fitness__week-day--today" : ""}${hasWorkout ? " fitness__week-day--busy" : ""}`}
              onClick={() => setSelectedDate(day)}
              aria-pressed={isSelected}
            >
              <span className="fitness__week-day-label">{WEEKDAYS[day.getDay()]}</span>
              <span className="fitness__week-day-num">{day.getDate()}</span>
              {hasWorkout && (
                <span className="fitness__week-day-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div
        className="fitness__summary animate-in animate-in--2"
        key={selectedKey}
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

      {/* List header */}
      <div className="fitness__list-header animate-in animate-in--4">
        <h2 className="fitness__list-title">
          {dayTitle}
        </h2>
        <button
          type="button"
          className="fitness__add-btn"
          onClick={openAddModal}
          ref={addBtnRef}
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 6.5h11M6.5 17.5h11M3 12h2m14 0h2M6 12h12" />
              <rect x="1" y="8" width="4" height="8" rx="1" />
              <rect x="19" y="8" width="4" height="8" rx="1" />
            </svg>
          }
          title="No workouts this week"
          text='Tap "+ Add workout" to log your first one.'
        />
      ) : (
        <ul className="fitness__list" key={`list-${selectedKey}`}>
          {workouts.map((workout, index) => {
            const exercises = Array.isArray(workout.exercises)
              ? workout.exercises
              : [];
            const vol = calcVolume(exercises);
            const isRemoving = removingId === workout.id;

            return (
              <li
                key={workout.id}
                className={`fitness__card${isRemoving ? " fitness__card--removing" : ""}`}
                style={{ "--card-delay": `${index * 0.06}s` }}
              >
                <div className="fitness__card-main">
                  <div className="fitness__card-top">
                    <span className="fitness__card-date">
                      {formatDateFriendly(workout.workout_date)}
                    </span>
                    {workout.preset_name && (
                      <span className="fitness__card-preset">
                        {workout.preset_name}
                      </span>
                    )}
                    {workout.notes && (
                      <button
                        type="button"
                        className={`fitness__note-toggle${expandedNoteId === workout.id ? " fitness__note-toggle--active" : ""}`}
                        onClick={() =>
                          setExpandedNoteId(
                            expandedNoteId === workout.id ? null : workout.id,
                          )
                        }
                        aria-expanded={expandedNoteId === workout.id}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12c0 4.418-4.03 8-9 8-1.06 0-2.07-.16-3-.46L3 21l1.5-4.5C3.55 15.13 3 13.62 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="fitness__card-exercises">
                    {exercises.map((ex, i) => (
                      <span key={i} className="fitness__card-exercise">
                        {ex.name}
                        {ex.weight ? ` ${ex.weight}kg` : ""}
                        {ex.sets && ex.reps ? ` ${ex.sets}×${ex.reps}` : ""}
                      </span>
                    ))}
                  </div>
                  <div className="fitness__card-meta">
                    {vol > 0 && (
                      <span className="fitness__card-volume">
                        Vol: {formatVolume(vol)} kg
                      </span>
                    )}
                    {workout.duration_minutes && (
                      <span className="fitness__card-duration">
                        {workout.duration_minutes}m
                      </span>
                    )}
                    {workout.calories_burned > 0 && (
                      <span className="fitness__card-calories">
                        {workout.calories_burned} kcal
                      </span>
                    )}
                  </div>
                  {workout.notes && expandedNoteId === workout.id && (
                    <p className="fitness__note-panel">{workout.notes}</p>
                  )}
                </div>
                <div className="fitness__card-actions">
                  <button
                    type="button"
                    className="fitness__action fitness__action--edit"
                    onClick={() => openEditModal(workout)}
                    aria-label="Edit workout"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="fitness__action fitness__action--delete"
                    onClick={() => openDeleteModal(workout)}
                    aria-label="Delete workout"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add/Edit Workout Modal */}
      <SheetModal
        open={formModal.open}
        closing={formModal.closing}
        onClose={closeFormModal}
        title={editingWorkout ? "Edit workout" : "Log workout"}
      >
        <form className="fitness__form" onSubmit={handleSubmit}>
          <FormField
            label="Date"
            error={fieldErrors.workout_date}
            state={fieldStates.workout_date}
            showIndicator
            shake={fieldErrors.workout_date ? shakeKey : 0}
          >
            <input
              type="date"
              value={form.workout_date}
              onChange={(e) => {
                setForm((f) => ({ ...f, workout_date: e.target.value }));
                setFieldErrors((prev) => ({ ...prev, workout_date: null }));
              }}
              onBlur={() => handleFieldBlur("workout_date")}
              required
            />
          </FormField>

          <FormField
            label="Workout name"
            error={fieldErrors.preset_name}
            state={fieldStates.preset_name}
            showIndicator
            shake={fieldErrors.preset_name ? shakeKey : 0}
          >
            <input
              type="text"
              placeholder="e.g. Push day, Leg day"
              value={form.preset_name}
              maxLength={60}
              onChange={(e) => {
                setForm((f) => ({ ...f, preset_name: e.target.value }));
                setFieldErrors((prev) => ({ ...prev, preset_name: null }));
              }}
              onBlur={() => handleFieldBlur("preset_name")}
              required
            />
          </FormField>

          <div className="fitness__exercises-section">
            <div className="fitness__exercises-header">
              <span className="fitness__exercises-label">Exercises</span>
              {fieldErrors.exercises && (
                <span className="fitness__field-error-text">
                  {fieldErrors.exercises}
                </span>
              )}
            </div>
            {form.exercises.map((ex, i) => (
              <div key={i} className="fitness__exercise-row">
                <div className="fitness__exercise-fields">
                  <input
                    type="text"
                    className="fitness__exercise-name"
                    placeholder="Exercise name"
                    value={ex.name}
                    maxLength={80}
                    onChange={(e) => updateExercise(i, "name", e.target.value)}
                  />
                  <div className="fitness__exercise-numbers">
                    <input
                      type="number"
                      className="fitness__exercise-input"
                      placeholder="kg"
                      min="0"
                      step="0.5"
                      value={ex.weight}
                      onChange={(e) =>
                        updateExercise(i, "weight", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      className="fitness__exercise-input"
                      placeholder="sets"
                      min="0"
                      value={ex.sets}
                      onChange={(e) =>
                        updateExercise(i, "sets", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      className="fitness__exercise-input"
                      placeholder="reps"
                      min="0"
                      value={ex.reps}
                      onChange={(e) =>
                        updateExercise(i, "reps", e.target.value)
                      }
                    />
                  </div>
                </div>
                {form.exercises.length > 1 && (
                  <button
                    type="button"
                    className="fitness__exercise-remove"
                    onClick={() => removeExercise(i)}
                    aria-label="Remove exercise"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="fitness__exercise-add"
              onClick={addExercise}
            >
              + Add exercise
            </button>
          </div>

          <FormField label="Duration (minutes)" optional>
            <input
              type="number"
              min="1"
              max="600"
              placeholder="e.g. 60"
              value={form.duration_minutes}
              onChange={(e) =>
                setForm((f) => ({ ...f, duration_minutes: e.target.value }))
              }
            />
          </FormField>

          <FormField
            label="Calories burned"
            error={fieldErrors.calories_burned}
            state={fieldStates.calories_burned}
            showIndicator
            shake={fieldErrors.calories_burned ? shakeKey : 0}
            optional
          >
            <input
              type="number"
              min="0"
              max="9999"
              placeholder="e.g. 350"
              value={form.calories_burned}
              onChange={(e) => {
                setForm((f) => ({ ...f, calories_burned: e.target.value }));
                setFieldErrors((prev) => ({ ...prev, calories_burned: null }));
              }}
              onBlur={() => handleFieldBlur("calories_burned")}
            />
          </FormField>

          <FormField label="Notes" optional charCount={form.notes.length} maxChars={500}>
            <textarea
              placeholder="e.g. Felt strong, increased bench PR"
              value={form.notes}
              maxLength={500}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
          </FormField>

          {volume > 0 && (
            <p className="fitness__preview">
              Total volume: <strong>{formatVolume(volume)} kg</strong>
            </p>
          )}

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
              ) : editingWorkout ? (
                "Save changes"
              ) : (
                "Log workout"
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
        title={editingPreset ? "Edit preset" : "Create preset"}
      >
        <p className="fitness__preset-hint">
          Presets let you quick-add common workouts with one tap.
        </p>
        <div className="fitness__form">
          <FormField label="Preset name">
            <input
              type="text"
              value={presetForm.name}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Push day"
              maxLength={40}
              autoFocus
            />
          </FormField>

          <div className="fitness__exercises-section">
            <span className="fitness__exercises-label">Exercises</span>
            {presetForm.exercises.map((ex, i) => (
              <div key={i} className="fitness__exercise-row">
                <div className="fitness__exercise-fields">
                  <input
                    type="text"
                    className="fitness__exercise-name"
                    placeholder="Exercise name"
                    value={ex.name}
                    maxLength={80}
                    onChange={(e) =>
                      updatePresetExercise(i, "name", e.target.value)
                    }
                  />
                  <div className="fitness__exercise-numbers">
                    <input
                      type="number"
                      className="fitness__exercise-input"
                      placeholder="kg"
                      min="0"
                      step="0.5"
                      value={ex.weight}
                      onChange={(e) =>
                        updatePresetExercise(i, "weight", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      className="fitness__exercise-input"
                      placeholder="sets"
                      min="0"
                      value={ex.sets}
                      onChange={(e) =>
                        updatePresetExercise(i, "sets", e.target.value)
                      }
                    />
                    <input
                      type="number"
                      className="fitness__exercise-input"
                      placeholder="reps"
                      min="0"
                      value={ex.reps}
                      onChange={(e) =>
                        updatePresetExercise(i, "reps", e.target.value)
                      }
                    />
                  </div>
                </div>
                {presetForm.exercises.length > 1 && (
                  <button
                    type="button"
                    className="fitness__exercise-remove"
                    onClick={() => removePresetExercise(i)}
                    aria-label="Remove exercise"
                  >
                    ×
                  </button>
                )}
              </div>
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
        title="Delete this workout?"
        description="This action cannot be undone."
        confirmLabel="Delete workout"
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
                {formatDateFriendly(deleteTarget.workout_date)}
              </span>
              {deleteTarget.preset_name && (
                <span className="fitness__delete-name">
                  {deleteTarget.preset_name}
                </span>
              )}
            </>
          )
        }
      />

      <FAB
        visible={showFloatingActions}
        onScrollTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onAdd={openAddModal}
        addLabel="Log workout"
      />
    </div>
  );
}

export default WorkoutLogger;
