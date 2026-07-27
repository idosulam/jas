import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { useUserId } from "../../../lib/auth_context.jsx";
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

import SheetModal from "../../../components/ui/modals/sheet_modal";
import ConfirmModal from "../../../components/ui/modals/confirm_modal";
import FormField from "../../../components/ui/form/form_field.jsx";
import EmptyState from "../../../components/ui/Empty_state";
import LoadingSkeleton from "../../../components/ui/loading_skeleton";
import GlassCard from "../../../components/ui/glass_card";
import FAB from "../../../components/ui/fab";

import { kgToLbs } from "../../../lib/weight";

import {
  MODAL_EXIT_MS,
  WEEKDAYS,
  emptyExercise,
  emptyForm,
  calcVolume,
  formatVolume,
} from "./workout_utils";
import ExerciseRow from "./exercise_row";
import WorkoutCard from "./workout_card";
import WorkoutForm from "./workout_form";

function WorkoutLogger() {
  const userId = useUserId();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(now);
  const [viewMode, setViewMode] = useState("week");
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

  const monthDays = useMemo(() => {
    const d = new Date(selectedDate);
    const start = startOfWeek(new Date(d.getFullYear(), d.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const visibleDays = viewMode === "week" ? weekDays : monthDays;

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

    const d = new Date(selectedDate);
    const rangeStart =
      viewMode === "week"
        ? startOfWeek(d)
        : new Date(d.getFullYear(), d.getMonth(), 1);
    const rangeEnd =
      viewMode === "week"
        ? addDays(rangeStart, 6)
        : new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const startDate = toDateKey(rangeStart);
    const endDate = toDateKey(rangeEnd);

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
  }, [selectedDate, viewMode, userId]);

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
        ? workout.exercises.map((ex) => ({
            ...ex,
            weight_lbs: ex.weight ? kgToLbs(ex.weight) : "",
          }))
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
  }, [
    presetForm,
    editingPreset,
    fetchPresets,
    toastSuccess,
    toastError,
    userId,
  ]);

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
            weight_lbs: ex.weight ? kgToLbs(ex.weight) : "",
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
    const err = validateField(fieldName, form[fieldName]);
    setFieldErrors((prev) => ({ ...prev, [fieldName]: err }));
    setFieldStates((prev) => ({
      ...prev,
      [fieldName]: err ? "error" : form[fieldName] ? "valid" : "idle",
    }));
    if (err) {
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
        editingWorkout ? "Couldn't update workout." : "Couldn't save workout.",
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

  return (
    <div className="fitness__workout">
      {/* Weekly date navigation */}
      <div className="fitness__date-nav animate-in animate-in--1">
        <div className="fitness__date-top">
          <button
            type="button"
            className="fitness__date-btn"
            onClick={() => setSelectedDate((d) => addDays(d, viewMode === "week" ? -7 : -30))}
            aria-label="Previous day"
          >
            ‹
          </button>
          <span className="fitness__date-label">{dayTitle}</span>
          <button
            type="button"
            className="fitness__date-btn"
            onClick={() => setSelectedDate((d) => addDays(d, viewMode === "week" ? 7 : 30))}
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
      <div
        className={`fitness__week-days animate-in animate-in--1${viewMode === "month" ? " fitness__week-days--month" : ""}`}
        role="group"
        aria-label={viewMode === "week" ? "Week days" : "Month days"}
      >
        {visibleDays.map((day) => {
          const key = toDateKey(day);
          const isSelected = key === selectedKey;
          const isDayToday = key === toDateKey(now);
          const hasWorkout = workouts.some((w) => w.workout_date === key);
          const isInCurrentMonth =
            viewMode === "month"
              ? day.getMonth() === selectedDate.getMonth()
              : true;

          return (
            <button
              key={key}
              type="button"
              className={`fitness__week-day${isSelected ? " fitness__week-day--active" : ""}${isDayToday ? " fitness__week-day--today" : ""}${hasWorkout ? " fitness__week-day--busy" : ""}${!isInCurrentMonth ? " fitness__week-day--muted" : ""}`}
              onClick={() => setSelectedDate(day)}
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
        <h2 className="fitness__list-title">{dayTitle}</h2>
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
        <ul className="fitness__list" key={`list-${selectedKey}`}>
          {workouts.map((workout, index) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              index={index}
              onEdit={openEditModal}
              onDelete={openDeleteModal}
              onToggleNote={(id) =>
                setExpandedNoteId(expandedNoteId === id ? null : id)
              }
              expandedNoteId={expandedNoteId}
              isRemoving={removingId === workout.id}
            />
          ))}
        </ul>
      )}

      {/* Add/Edit Workout Modal */}
      <WorkoutForm
        open={formModal.open}
        closing={formModal.closing}
        onClose={closeFormModal}
        editingWorkout={editingWorkout}
        form={form}
        setForm={setForm}
        fieldErrors={fieldErrors}
        fieldStates={fieldStates}
        shakeKey={shakeKey}
        saving={saving}
        isFormValid={isFormValid}
        onAddExercise={addExercise}
        onRemoveExercise={removeExercise}
        onUpdateExercise={updateExercise}
        onSubmit={handleSubmit}
        onFieldBlur={handleFieldBlur}
        exerciseCount={form.exercises.length}
      />

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
              <ExerciseRow
                key={i}
                exercise={ex}
                index={i}
                onChange={updatePresetExercise}
                onRemove={removePresetExercise}
                showRemove={presetForm.exercises.length > 1}
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
