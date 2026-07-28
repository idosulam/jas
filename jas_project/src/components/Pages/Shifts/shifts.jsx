import "./shifts.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { useHousehold } from "../../../lib/household_context.jsx";
import { useUserId } from "../../../lib/auth_context.jsx";
import {
  getUserFacingError,
  sanitizeDate,
  sanitizeNumber,
  sanitizeText,
  formatDateFriendly,
  hapticError,
} from "../../../lib/security";
import {
  parseTimeToMinutes,
  minutesToTime,
  removeGeneratedCalendarEvents,
  syncShiftToCalendar as syncShiftToCalendarUtil,
} from "../../../lib/calendar_sync";
import { useBodyScrollLock, useModal } from "../../../hooks";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";

import ConfirmModal from "../../../components/ui/modals/confirm_modal";
import Badge from "../../../components/ui/badge";
import EmptyState from "../../../components/ui/Empty_state";
import LoadingSkeleton from "../../../components/ui/loading_skeleton";
import PageHeader from "../../../components/ui/page_header";
import GlassCard from "../../../components/ui/glass_card";
import FAB from "../../../components/ui/fab";

import {
  PAY_TYPES,
  FILTER_PICKER_BREAKPOINT,
  WEEKDAYS,
  MODAL_EXIT_MS,
  getCurrentLocalTime,
  calculateHoursFromTimes,
  calcPay,
  emptyForm,
  formatMoney,
} from "./shift_utils";
import ShiftForm from "./shift_form";
import ShiftDeleteConfirm from "./shift_delete_confirm";
import PlacePicker from "./place_picker";
import ShiftPresets from "./shift_presets";
import ShiftCard from "./shift_card";

function Shifts({ onNavigate }) {
  const userId = useUserId();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(now);
  const [viewMode, setViewMode] = useState("week");
  const [placeFilter, setPlaceFilter] = useState("all");
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [editingShift, setEditingShift] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldStates, setFieldStates] = useState({});
  const { householdName } = useHousehold();
  const [shakeKey, setShakeKey] = useState(0);
  const [workplaces, setWorkplaces] = useState([]);

  const [presets, setPresets] = useState([]);
  const [editingPreset, setEditingPreset] = useState(null);
  const [presetForm, setPresetForm] = useState({
    label: "",
    place: "",
    start_time: "09:00",
    end_time: "17:00",
    hours: "8",
    pay_type: "hourly",
  });
  const addBtnRef = useRef(null);
  const placeFilterRef = useRef(null);
  const [placeIndicator, setPlaceIndicator] = useState({ left: 0, width: 0 });
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < FILTER_PICKER_BREAKPOINT,
  );
  const { success: toastSuccess, error: toastError } = useGlassToast();

  // Modal hooks for each modal
  const formModal = useModal(MODAL_EXIT_MS);
  const deleteModal = useModal(MODAL_EXIT_MS);
  const presetModal = useModal(MODAL_EXIT_MS);
  const placePicker = useModal(MODAL_EXIT_MS);

  // Track viewport width for responsive filter layout
  useEffect(() => {
    const mql = window.matchMedia(
      `(max-width: ${FILTER_PICKER_BREAKPOINT - 1}px)`,
    );
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // All workplaces come from the DB — no hardcoded fallback
  const effectiveWorkplaces = workplaces;

  // Track which workplace slugs are deactivated for faded display
  const deactivatedSlugs = useMemo(() => {
    const set = new Set();
    workplaces.forEach((wp) => {
      if (!wp.active) set.add(wp.slug);
    });
    return set;
  }, [workplaces]);

  // Build PLACES map from workplaces for backward compatibility
  const PLACES = useMemo(() => {
    const map = {};
    effectiveWorkplaces.forEach((wp) => {
      map[wp.slug] = {
        label: wp.label,
        rate: Number(wp.rate),
        color: wp.color,
      };
    });
    return map;
  }, [effectiveWorkplaces]);

  const PLACE_FILTERS = useMemo(
    () => [
      { id: "all", label: "All" },
      ...effectiveWorkplaces.map((wp) => ({
        id: wp.slug,
        label: wp.label,
        active: wp.active,
      })),
    ],
    [effectiveWorkplaces],
  );

  const fetchWorkplaces = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("workplaces")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (!fetchError && data && data.length > 0) setWorkplaces(data);
    } catch {
      // silent — will use defaults
    }
  }, [userId]);

  useEffect(() => {
    fetchWorkplaces();
  }, [fetchWorkplaces]);

  const useInlineFilters = !isMobile;

  // Sliding indicator for place filter (only when inline pills are shown)
  const updatePlaceIndicator = useCallback(() => {
    if (!useInlineFilters) return;
    const container = placeFilterRef.current;
    if (!container) return;
    const active = container.querySelector(".shifts__place-btn--active");
    if (!active) return;
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    setPlaceIndicator({
      left: aRect.left - cRect.left - container.scrollLeft,
      width: aRect.width,
    });
  }, [placeFilter, useInlineFilters]);
  useEffect(() => {
    // Wait a tick so the DOM has the up-to-date set of pills
    // (e.g. after effectiveWorkplaces loads asynchronously) before measuring.
    const id = requestAnimationFrame(updatePlaceIndicator);
    window.addEventListener("resize", updatePlaceIndicator);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", updatePlaceIndicator);
    };
  }, [updatePlaceIndicator, effectiveWorkplaces]);

  const openPlacePicker = useCallback(() => {
    placePicker.openModal();
  }, [placePicker]);

  const closePlacePicker = useCallback(() => {
    placePicker.closeModal();
  }, [placePicker]);

  const selectPlaceFilter = useCallback(
    (id) => {
      setPlaceFilter(id);
      closePlacePicker();
    },
    [closePlacePicker],
  );

  const fetchPresets = useCallback(async () => {
    if (!userId) return;
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("shift_presets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (!fetchError) setPresets(data ?? []);
    } catch {
      // silent — presets are non-critical
    }
  }, [userId]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const savePreset = useCallback(async () => {
    const label = presetForm.label.trim();
    if (!label) return;
    const payload = {
      label,
      place: presetForm.place,
      start_time: presetForm.start_time,
      end_time: presetForm.end_time,
      hours: Number(Number(presetForm.hours).toFixed(2)),
      pay_type: presetForm.pay_type,
      ...(userId && { user_id: userId }),
    };
    try {
      const supabase = getSupabaseClient();
      let dbError;
      if (editingPreset) {
        ({ error: dbError } = await supabase
          .from("shift_presets")
          .update(payload)
          .eq("id", editingPreset.id));
      } else {
        ({ error: dbError } = await supabase
          .from("shift_presets")
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
  }, [presetForm, editingPreset, fetchPresets, toastSuccess, toastError]);

  const deletePreset = useCallback(
    async (id) => {
      try {
        const supabase = getSupabaseClient();
        const { error: dbError } = await supabase
          .from("shift_presets")
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

  const openPresetModal = useCallback(
    (preset = null) => {
      if (preset) {
        setEditingPreset(preset);
        setPresetForm({
          label: preset.label,
          place: preset.place,
          start_time: preset.start_time,
          end_time: preset.end_time,
          hours: preset.hours,
          pay_type: preset.pay_type,
        });
      } else {
        setEditingPreset(null);
        setPresetForm({
          label: "",
          place: form.place || effectiveWorkplaces[0]?.slug || "pasta",
          start_time: "09:00",
          end_time: "17:00",
          hours: "8",
          pay_type: "hourly",
        });
      }
      presetModal.openModal();
    },
    [form.place, effectiveWorkplaces, presetModal],
  );

  const closePresetModal = useCallback(() => {
    presetModal.closeModal();
    // Clear editing preset after animation completes
    setTimeout(() => {
      setEditingPreset(null);
    }, MODAL_EXIT_MS);
  }, [presetModal]);

  const saveCurrentAsPreset = useCallback(() => {
    const placeLabel = PLACES[form.place]?.label ?? form.place;
    const timeLabel =
      form.start_time && form.end_time
        ? ` ${form.start_time}–${form.end_time}`
        : "";
    setEditingPreset(null);
    setPresetForm({
      label: `${placeLabel}${timeLabel}`,
      place: form.place,
      start_time: form.start_time || "09:00",
      end_time: form.end_time || "17:00",
      hours: form.hours || "8",
      pay_type: form.pay_type,
    });
    presetModal.openModal();
  }, [form, PLACES, presetModal]);

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
    const d = selectedDate; // already a Date object
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

  const fetchShifts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const d = selectedDate; // already a Date object
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
        .from("shifts")
        .select("*")
        .eq("user_id", userId)
        .gte("shift_date", startDate)
        .lte("shift_date", endDate)
        .order("shift_date", { ascending: true });

      if (fetchError) {
        setError(getUserFacingError(fetchError.message));
        setShifts([]);
      } else {
        setShifts(data ?? []);
      }
    } catch (err) {
      setError(getUserFacingError(err.message));
      setShifts([]);
    }
    setLoading(false);
  }, [selectedDate, viewMode, userId]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  useEffect(() => {
    const handleShiftsRefresh = () => {
      fetchShifts();
    };

    window.addEventListener("shifts:refresh", handleShiftsRefresh);
    return () => {
      window.removeEventListener("shifts:refresh", handleShiftsRefresh);
    };
  }, [fetchShifts]);

  useBodyScrollLock(
    formModal.open,
    deleteModal.open,
    presetModal.open,
    placePicker.open,
  );

  useEffect(() => {
    const target = addBtnRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only show floating actions once the button has scrolled
        // above the viewport (i.e. we're below it), not when it's
        // simply below the viewport because we haven't reached it yet.
        const scrolledPastIt =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        setShowFloatingActions(scrolledPastIt);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const filteredShifts = useMemo(() => {
    if (placeFilter === "all") return shifts;
    return shifts.filter((shift) => shift.place === placeFilter);
  }, [shifts, placeFilter]);

  const totals = useMemo(() => {
    return filteredShifts.reduce(
      (acc, shift) => {
        const pay = calcPay(PLACES, shift.place, shift.hours, shift.pay_type);
        const tips = parseFloat(shift.tips) || 0;
        acc.hours += parseFloat(shift.hours) || 0;
        acc.pay += pay;
        acc.tips += tips;
        acc.total += pay + tips;
        return acc;
      },
      { hours: 0, pay: 0, tips: 0, total: 0 },
    );
  }, [filteredShifts]);

  const openAddModal = () => {
    setEditingShift(null);
    const f = emptyForm(effectiveWorkplaces[0]?.slug);
    f.shift_date = selectedKey;
    setForm(f);
    setFieldErrors({});
    setFieldStates({});
    formModal.openModal();
  };

  const openEditModal = (shift) => {
    setEditingShift(shift);
    setForm({
      place: shift.place,
      pay_type: shift.pay_type === "tips_only" ? "tips_only" : "hourly",
      shift_date: shift.shift_date,
      start_time: shift.start_time ?? "",
      end_time: shift.end_time ?? "",
      hours: String(shift.hours),
      tips: shift.tips ? String(shift.tips) : "",
      notes: shift.notes ?? "",
      color: shift.color || PLACES[shift.place]?.color || "",
    });
    setFieldErrors({});
    setFieldStates({});
    formModal.openModal();
  };

  const closeFormModal = () => {
    formModal.closeModal();
    // Clear editing state after animation completes
    setTimeout(() => {
      setEditingShift(null);
      setForm(emptyForm(effectiveWorkplaces[0]?.slug));
      setFieldStates({});
    }, MODAL_EXIT_MS);
  };

  const handleTimeChange = (field, value) => {
    const nextForm = { ...form, [field]: value };
    const computedHours = calculateHoursFromTimes(
      nextForm.start_time,
      nextForm.end_time,
    );
    if (computedHours != null) {
      nextForm.hours = String(computedHours);
    }
    setForm(nextForm);
    setFieldErrors((prev) => ({ ...prev, [field]: null, hours: null }));
  };

  const handleHoursChange = (value) => {
    const nextForm = { ...form, hours: value };
    // Reverse-calculate end_time from start_time + hours
    if (nextForm.start_time && value) {
      const startMin = parseTimeToMinutes(nextForm.start_time);
      const hoursNum = parseFloat(value);
      if (
        startMin != null &&
        !isNaN(hoursNum) &&
        hoursNum > 0 &&
        hoursNum <= 24
      ) {
        const endMin = startMin + Math.round(hoursNum * 60);
        nextForm.end_time = minutesToTime(endMin);
      }
    }
    setForm(nextForm);
    setFieldErrors((prev) => ({ ...prev, hours: null, end_time: null }));
  };

  const validateField = (fieldName, value) => {
    const errors = {};
    switch (fieldName) {
      case "shift_date": {
        if (!value) {
          errors[fieldName] = "Pick a date";
        }
        break;
      }
      case "start_time": {
        if (!value) {
          errors[fieldName] = "Required";
        } else if (form.end_time) {
          const start = parseTimeToMinutes(value);
          const end = parseTimeToMinutes(form.end_time);
          if (start != null && end != null && start >= end) {
            errors[fieldName] = "Must be before end time";
          }
        }
        break;
      }
      case "end_time": {
        if (!value) {
          errors[fieldName] = "Required";
        } else if (form.start_time) {
          const start = parseTimeToMinutes(form.start_time);
          const end = parseTimeToMinutes(value);
          if (start != null && end != null && end <= start) {
            errors[fieldName] = "Must be after start time";
          }
        }
        break;
      }
      case "hours": {
        const hours = parseFloat(value);
        if (!value || isNaN(hours) || hours <= 0) {
          errors[fieldName] = "Enter hours worked";
        } else if (hours > 24) {
          errors[fieldName] = "Max 24 hours";
        } else if (hours > 0 && hours < 0.01) {
          errors[fieldName] = "Minimum 0.01 hours";
        }
        break;
      }
      case "tips": {
        const tips = parseFloat(value);
        if (value && (isNaN(tips) || tips < 0)) {
          errors[fieldName] = "Cannot be negative";
        }
        break;
      }
    }
    return Object.keys(errors).length > 0 ? errors : null;
  };

  const handleFieldBlur = (fieldName) => {
    const error = validateField(fieldName, form[fieldName]);
    const fieldError = error ? error[fieldName] : null;
    setFieldErrors((prev) => ({
      ...prev,
      [fieldName]: fieldError,
    }));
    setFieldStates((prev) => ({
      ...prev,
      [fieldName]: fieldError ? "error" : form[fieldName] ? "valid" : "idle",
    }));
    if (fieldError) {
      setShakeKey((k) => k + 1);
      hapticError();
    }
  };

  const isFormValid = useMemo(() => {
    if (!form.shift_date) return false;
    if (form.pay_type !== "tips_only" && !form.hours) return false;
    const hours = parseFloat(form.hours);
    if (form.hours && (isNaN(hours) || hours <= 0 || hours > 24)) return false;
    if (form.start_time && form.end_time) {
      const start = parseTimeToMinutes(form.start_time);
      const end = parseTimeToMinutes(form.end_time);
      if (start != null && end != null && end <= start) return false;
    }
    const tips = parseFloat(form.tips);
    if (form.tips && (isNaN(tips) || tips < 0)) return false;
    return true;
  }, [form]);

  const openDeleteModal = (shift) => {
    setDeleteTarget(shift);
    deleteModal.openModal();
  };

  const closeDeleteModal = () => {
    deleteModal.closeModal();
    // Clear delete target after animation completes
    setTimeout(() => {
      setDeleteTarget(null);
    }, MODAL_EXIT_MS);
  };

  // Thin wrappers that pass local PLACES map to the shared utility functions
  async function _removeShiftGeneratedCalendarEvents(
    supabase,
    dateKey,
    linkedShiftId = null,
  ) {
    return removeGeneratedCalendarEvents(
      supabase,
      dateKey,
      userId,
      linkedShiftId,
    );
  }

  const notifyCalendarRefresh = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("calendar:refresh"));
    }
  };

  async function syncShiftToCalendar(shiftRecord) {
    if (!shiftRecord) return;
    try {
      const supabase = getSupabaseClient();
      await syncShiftToCalendarUtil(supabase, shiftRecord, userId, PLACES);
    } catch {
      try {
        toastError?.("Failed to sync shift to calendar.");
      } catch {
        // ignore
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const shiftDate = sanitizeDate(
      form.shift_date,
      new Date().toISOString().slice(0, 10),
    );
    const hours = sanitizeNumber(form.hours, 0.01, 24);
    const tips = sanitizeNumber(form.tips, 0, 10000) ?? 0;
    const notes = form.notes.trim() ? sanitizeText(form.notes, 500) : null;

    // Validate all fields
    const errors = {};
    if (!shiftDate) errors.shift_date = "Pick a date";
    if (!hours || hours <= 0) errors.hours = "Enter hours worked";
    if (form.pay_type !== "tips_only" && hours > 24)
      errors.hours = "Max 24 hours";

    if (form.start_time && form.end_time) {
      const start = parseTimeToMinutes(form.start_time);
      const end = parseTimeToMinutes(form.end_time);
      if (start != null && end != null && end <= start) {
        errors.end_time = "Must be after start time";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Set error states for all errored fields
      const newStates = {};
      Object.keys(errors).forEach((k) => {
        newStates[k] = "error";
      });
      setFieldStates((prev) => ({ ...prev, ...newStates }));
      setShakeKey((k) => k + 1);
      return;
    }

    setFieldErrors({});
    setFieldStates({});

    setSaving(true);
    setError(null);

    const payload = {
      place: form.place,
      pay_type: form.pay_type === "tips_only" ? "tips_only" : "hourly",
      shift_date: shiftDate,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      hours: Number(hours.toFixed(2)),
      tips: Number(tips.toFixed(2)),
      notes,
      color: PLACES[form.place]?.color || null,
      ...(userId && { user_id: userId }),
    };

    try {
      const supabase = getSupabaseClient();
      let dbError;
      let savedShift = null;
      if (editingShift) {
        const res = await supabase
          .from("shifts")
          .update(payload)
          .eq("id", editingShift.id)
          .select()
          .single();
        dbError = res.error;
        savedShift = res.data;
      } else {
        const res = await supabase
          .from("shifts")
          .insert(payload)
          .select()
          .single();
        dbError = res.error;
        savedShift = res.data;
      }

      setSaving(false);

      if (dbError) {
        const message = getUserFacingError(dbError.message);
        setError(message);
        toastError(
          editingShift ? "Couldn't edit shift." : "Couldn't save shift.",
        );
        return;
      }

      // Sync to calendar (best-effort)
      try {
        await syncShiftToCalendar(savedShift);
        notifyCalendarRefresh();
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("calendar:refresh", {
              detail: { date: savedShift?.shift_date ?? shiftDate },
            }),
          );
        }
      } catch {
        // ignore sync errors
      }

      closeFormModal();
      toastSuccess(editingShift ? "Shift updated." : "Shift saved.");
      fetchShifts();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError(
        editingShift ? "Couldn't edit shift." : "Couldn't save shift.",
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: dbError } = await supabase
        .from("shifts")
        .delete()
        .eq("id", deleteTarget.id);

      setDeleting(false);

      if (dbError) {
        setError(getUserFacingError(dbError.message));
        toastError("Failed to delete shift.");
        return;
      }

      const removedId = deleteTarget.id;
      const shiftDate = deleteTarget.shift_date;

      try {
        const { data: remainingShifts = [] } = await supabase
          .from("shifts")
          .select("*")
          .eq("user_id", userId)
          .eq("shift_date", shiftDate);

        if ((remainingShifts || []).length > 0) {
          await _removeShiftGeneratedCalendarEvents(
            supabase,
            shiftDate,
            removedId,
          );
          await Promise.all(
            remainingShifts.map((shift) => syncShiftToCalendar(shift)),
          );
        } else {
          await _removeShiftGeneratedCalendarEvents(supabase, shiftDate);
        }
      } catch {
        // ignore cleanup errors
      }

      closeDeleteModal();
      notifyCalendarRefresh();
      toastSuccess("Shift deleted successfully.");
      setRemovingId(removedId);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("calendar:refresh", { detail: { date: shiftDate } }),
        );
      }

      setTimeout(() => {
        setShifts((prev) => prev.filter((s) => s.id !== removedId));
        setRemovingId(null);
      }, 380);
    } catch (err) {
      setDeleting(false);
      setError(getUserFacingError(err.message));
      toastError("Failed to delete shift.");
    }
  };

  const handleQuickAddPreset = useCallback(
    (preset) => {
      setEditingShift(null);
      setForm({
        place: preset.place,
        pay_type: preset.pay_type,
        shift_date: new Date().toISOString().slice(0, 10),
        start_time: preset.start_time,
        end_time: preset.end_time,
        hours: preset.hours,
        tips: "",
        notes: "",
      });
      formModal.openModal();
    },
    [formModal],
  );

  const handleCopyShift = useCallback(
    (shift) => {
      setEditingShift(null);
      setForm({
        place: shift.place,
        pay_type: shift.pay_type === "tips_only" ? "tips_only" : "hourly",
        shift_date: new Date().toISOString().slice(0, 10),
        start_time: shift.start_time ?? "",
        end_time: shift.end_time ?? "",
        hours: String(shift.hours),
        tips: "",
        notes: shift.notes ?? "",
      });
      formModal.openModal();
    },
    [formModal],
  );

  const handleToggleNote = useCallback(
    (id) => {
      setExpandedNoteId(expandedNoteId === id ? null : id);
    },
    [expandedNoteId],
  );

  return (
    <section className="shifts page">
      <PageHeader
        eyebrow={
          householdName ? `Earnings · ${householdName}` : "Earnings tracker"
        }
        title="Shifts"
        className="shifts__header animate-in"
      />

      {/* Weekly date navigation */}
      <div className="shifts__date-nav animate-in animate-in--1">
        <div className="shifts__date-top">
          <button
            type="button"
            className="shifts__date-btn"
            onClick={() =>
              setSelectedDate((d) => addDays(d, viewMode === "week" ? -7 : -30))
            }
            aria-label="Previous day"
          >
            ‹
          </button>
          <span className="shifts__date-label">{dayTitle}</span>
          <button
            type="button"
            className="shifts__date-btn"
            onClick={() =>
              setSelectedDate((d) => addDays(d, viewMode === "week" ? 7 : 30))
            }
            aria-label="Next day"
          >
            ›
          </button>
        </div>
        {!isToday && (
          <button
            type="button"
            className="shifts__date-today"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </button>
        )}
      </div>

      {/* Week day selector */}
      <div
        className={`shifts__week-days animate-in animate-in--1${viewMode === "month" ? " shifts__week-days--month" : ""}`}
        role="group"
        aria-label={viewMode === "week" ? "Week days" : "Month days"}
      >
        {visibleDays.map((day) => {
          const key = toDateKey(day);
          const isSelected = key === selectedKey;
          const isDayToday = key === toDateKey(now);
          const hasShift = shifts.some((s) => s.shift_date === key);
          const isInCurrentMonth =
            viewMode === "month"
              ? day.getMonth() === selectedDate.getMonth()
              : true;

          return (
            <button
              key={key}
              type="button"
              className={`shifts__week-day${isSelected ? " shifts__week-day--active" : ""}${isDayToday ? " shifts__week-day--today" : ""}${hasShift ? " shifts__week-day--busy" : ""}${!isInCurrentMonth ? " shifts__week-day--muted" : ""}`}
              onClick={() => setSelectedDate(day)}
              aria-pressed={isSelected}
            >
              <span className="shifts__week-day-label">
                {WEEKDAYS[day.getDay()]}
              </span>
              <span className="shifts__week-day-num">{day.getDate()}</span>
              {hasShift && (
                <span className="shifts__week-day-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* View toggle */}
      <div
        className="shifts__view-toggle animate-in animate-in--2"
        role="tablist"
        aria-label="Shifts view"
      >
        <button
          type="button"
          className={`shifts__view-btn${viewMode === "week" ? " shifts__view-btn--active" : ""}`}
          onClick={() => setViewMode("week")}
          aria-pressed={viewMode === "week"}
        >
          1 week
        </button>
        <button
          type="button"
          className={`shifts__view-btn${viewMode === "month" ? " shifts__view-btn--active" : ""}`}
          onClick={() => setViewMode("month")}
          aria-pressed={viewMode === "month"}
        >
          1 month
        </button>
      </div>

      {/* No workplaces CTA */}
      {!loading && effectiveWorkplaces.length === 0 && onNavigate && (
        <div className="shifts__no-workplaces animate-in animate-in--1">
          <div className="shifts__no-workplaces-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <path d="M9 22V12h6v10" />
            </svg>
          </div>
          <p className="shifts__no-workplaces-title">No workplaces yet</p>
          <p className="shifts__no-workplaces-text">
            Add a workplace first to start tracking your shifts.
          </p>
          <button
            type="button"
            className="shifts__no-workplaces-btn"
            onClick={() => onNavigate("Workplaces")}
          >
            + Add workplace
          </button>
        </div>
      )}

      {/* Place filter */}
      <PlacePicker
        places={PLACES}
        placeFilters={PLACE_FILTERS}
        selectedPlaceId={placeFilter}
        onSelect={selectPlaceFilter}
        isMobile={isMobile}
        pickerOpen={placePicker.open}
        pickerClosing={placePicker.closing}
        onOpenPicker={openPlacePicker}
        onClosePicker={closePlacePicker}
        indicator={placeIndicator}
        containerRef={placeFilterRef}
      />

      <div
        className="shifts__summary animate-in animate-in--3"
        key={`${selectedKey}-${placeFilter}`}
      >
        <GlassCard
          value={`${totals.hours.toFixed(1)}h`}
          label="Hours"
          className="shifts__stat"
        />
        <GlassCard
          value={formatMoney(totals.pay)}
          label="Pay"
          className="shifts__stat"
        />
        <GlassCard
          value={formatMoney(totals.tips)}
          label="Tips"
          className="shifts__stat"
        />
        <GlassCard
          value={formatMoney(totals.total)}
          label="Total"
          className="shifts__stat shifts__stat--total"
        />
      </div>

      {error && (
        <p className="shifts__error shifts__error--shake" role="alert">
          {error}
        </p>
      )}

      {/* Presets */}
      <ShiftPresets
        presets={presets}
        placeFilter={placeFilter}
        onQuickAdd={handleQuickAddPreset}
        onEditPreset={openPresetModal}
        onAddPreset={() => openPresetModal()}
        presetModalOpen={presetModal.open}
        presetModalClosing={presetModal.closing}
        onClosePresetModal={closePresetModal}
        editingPreset={editingPreset}
        presetForm={presetForm}
        setPresetForm={setPresetForm}
        places={PLACES}
        deactivatedSlugs={deactivatedSlugs}
        onSavePreset={savePreset}
        onDeletePreset={deletePreset}
      />

      <div className="shifts__list-header animate-in animate-in--4">
        <h2 className="shifts__list-title">
          {dayTitle}
          {placeFilter !== "all" && (
            <span className="shifts__list-subtitle">
              {" "}
              · {PLACES[placeFilter]?.label}
            </span>
          )}
        </h2>
        <div className="shifts__header-actions">
          {onNavigate && (
            <button
              type="button"
              className="shifts__manage-link"
              onClick={() => onNavigate("Workplaces")}
              title="Manage workplaces"
            >
              ⚙ Workplaces
            </button>
          )}
          <button
            type="button"
            className="shifts__add-btn"
            onClick={openAddModal}
            ref={addBtnRef}
            disabled={effectiveWorkplaces.length === 0}
            title={
              effectiveWorkplaces.length === 0
                ? "Add a workplace first"
                : "Add a new shift"
            }
          >
            + Add shift
          </button>
        </div>
      </div>

      {loading ? (
        <div className="shifts__list">
          <LoadingSkeleton count={3} height="5.5rem" />
        </div>
      ) : filteredShifts.length === 0 ? (
        <EmptyState
          className="shifts__empty shifts__empty--fade shifts__empty-card"
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
          }
          title={
            effectiveWorkplaces.length === 0
              ? "No workplaces yet"
              : placeFilter === "all"
                ? "No shifts this week"
                : `No ${PLACES[placeFilter]?.label} shifts`
          }
          text={
            effectiveWorkplaces.length === 0
              ? "Add a workplace to start tracking shifts."
              : placeFilter === "all"
                ? 'Tap "+ Add shift" to log your first one.'
                : `No shifts logged for ${PLACES[placeFilter]?.label} this week.`
          }
          action={
            effectiveWorkplaces.length === 0 && onNavigate ? (
              <button
                type="button"
                className="shifts__no-workplaces-btn"
                onClick={() => onNavigate("Workplaces")}
              >
                + Add workplace
              </button>
            ) : null
          }
        />
      ) : (
        <ul className="shifts__list" key={`list-${placeFilter}`}>
          {filteredShifts.map((shift, index) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              places={PLACES}
              deactivatedSlugs={deactivatedSlugs}
              onEdit={openEditModal}
              onCopy={handleCopyShift}
              onDelete={openDeleteModal}
              onToggleNote={handleToggleNote}
              expandedNoteId={expandedNoteId}
              isRemoving={removingId === shift.id}
              animDelay={`${index * 0.06}s`}
            />
          ))}
        </ul>
      )}

      {/* Shift form modal */}
      <ShiftForm
        open={formModal.open}
        closing={formModal.closing}
        onClose={closeFormModal}
        form={form}
        setForm={setForm}
        editingShift={editingShift}
        saving={saving}
        fieldErrors={fieldErrors}
        fieldStates={fieldStates}
        shakeKey={shakeKey}
        onFieldBlur={handleFieldBlur}
        onTimeChange={handleTimeChange}
        onHoursChange={handleHoursChange}
        onSubmit={handleSubmit}
        onSaveAsPreset={saveCurrentAsPreset}
        places={PLACES}
        deactivatedSlugs={deactivatedSlugs}
        isFormValid={isFormValid}
      />

      {/* Delete confirmation */}
      <ShiftDeleteConfirm
        deleteTarget={deleteTarget}
        closing={deleteModal.closing}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        deleting={deleting}
        places={PLACES}
      />

      <FAB
        visible={showFloatingActions}
        onScrollTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        onAdd={openAddModal}
        addLabel="Add shift"
      />
    </section>
  );
}

export default Shifts;
