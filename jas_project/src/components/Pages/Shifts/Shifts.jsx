import "./Shifts.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "../../../lib/superbase";
import { useUserId } from "../../../lib/AuthContext.jsx";
import {
  getUserFacingError,
  sanitizeDate,
  sanitizeNumber,
  sanitizeText,
  formatDateFriendly,
} from "../../../lib/security";
import {
  parseTimeToMinutes,
  minutesToTime,
  getShiftEventTitle,
  removeGeneratedCalendarEvents,
  syncShiftToCalendar as syncShiftToCalendarUtil,
} from "../../../lib/calendarSync";
import { useBodyScrollLock, useModal } from "../../../hooks";
import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";
import ColorPalettePicker from "../../../lib/ColorPalettePicker.jsx";
import { fetchPalette } from "../../../lib/color_palette.js";
import SheetModal from "../../../components/SheetModal";
import ConfirmModal from "../../../components/ConfirmModal";
import FormField from "../../../components/FormField";
import Badge from "../../../components/Badge";
import EmptyState from "../../../components/EmptyState";
import LoadingSkeleton from "../../../components/LoadingSkeleton";
import PageHeader from "../../../components/PageHeader";
import GlassCard from "../../../components/GlassCard";
import FAB from "../../../components/FAB";



const PAY_TYPES = [
  { id: "hourly", label: "Hourly + tips" },
  { id: "tips_only", label: "Tips only" },
];

// Breakpoint for pills (desktop) vs picker sheet (mobile).
const FILTER_PICKER_BREAKPOINT = 768;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getCurrentLocalTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

const MODAL_EXIT_MS = 320;

const emptyForm = (firstPlace) => ({
  place: firstPlace || "",
  pay_type: "hourly",
  shift_date: new Date().toISOString().slice(0, 10),
  start_time: getCurrentLocalTime(),
  end_time: "",
  hours: "",
  tips: "",
  notes: "",
});

function calculateHoursFromTimes(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) return null;
  const diffMinutes = end >= start ? end - start : 24 * 60 - start + end;
  return Number((diffMinutes / 60).toFixed(2));
}

function calcPay(places, place, hours, payType = "hourly") {
  if (payType === "tips_only") return 0;
  return (places[place]?.rate ?? 0) * (parseFloat(hours) || 0);
}

function formatMoney(amount) {
  return `₪${amount.toFixed(2)}`;
}

function Shifts({ onNavigate }) {
  const userId = useUserId();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
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
  const [shakeKey, setShakeKey] = useState(0);
  const [workplaces, setWorkplaces] = useState([]);
  const [palette, setPalette] = useState([]);
  const [presets, setPresets] = useState([]);
  const [editingPreset, setEditingPreset] = useState(null);
  const [presetForm, setPresetForm] = useState({
    label: "",
    place: "",
    start_time: "09:00",
    end_time: "17:00",
    hours: "8",
    pay_type: "hourly",
    color: "#818cf8",
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
      ...effectiveWorkplaces.map((wp) => ({ id: wp.slug, label: wp.label, active: wp.active })),
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

  // Load color palette from DB
  useEffect(() => {
    fetchPalette().then(setPalette);
  }, []);

  const firstColor = palette[0]?.hex || "#818cf8";

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
      color: presetForm.color || null,
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
          color: preset.color || "#818cf8",
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
          color: firstColor,
        });
      }
      presetModal.openModal();
    },
    [form.place, effectiveWorkplaces, firstColor, presetModal],
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
      color: form.color || "#818cf8",
    });
    presetModal.openModal();
  }, [form, PLACES, presetModal]);

  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 11 }, (_, i) => current - 5 + i);
  }, []);

  const fetchShifts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
    const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

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
  }, [month, year, userId]);

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

  useBodyScrollLock(formModal.open, deleteModal.open, presetModal.open, placePicker.open);

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
    setForm(emptyForm(effectiveWorkplaces[0]?.slug));
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
      [fieldName]: fieldError ? "error" : (form[fieldName] ? "valid" : "idle"),
    }));
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
  const _getShiftEventTitle = (shiftRecord) => getShiftEventTitle(shiftRecord, PLACES);

  async function _removeShiftGeneratedCalendarEvents(supabase, dateKey, linkedShiftId = null) {
    return removeGeneratedCalendarEvents(supabase, dateKey, userId, linkedShiftId);
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
      Object.keys(errors).forEach((k) => { newStates[k] = "error"; });
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

  const previewPay = calcPay(PLACES, form.place, form.hours, form.pay_type);

  const deletePay = deleteTarget
    ? calcPay(
        PLACES,
        deleteTarget.place,
        deleteTarget.hours,
        deleteTarget.pay_type,
      )
    : 0;
  const deleteTips = deleteTarget ? parseFloat(deleteTarget.tips) || 0 : 0;
  const deletePlaceInfo = deleteTarget ? PLACES[deleteTarget.place] : null;

  return (
    <section className="shifts page">
      <PageHeader eyebrow="Earnings tracker" title="Shifts" className="shifts__header animate-in" />

      <div className="shifts__filters animate-in animate-in--1">
        <label className="shifts__filter">
          <span>Month</span>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="shifts__filter">
          <span>Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* No workplaces CTA */}
      {!loading && effectiveWorkplaces.length === 0 && onNavigate && (
        <div className="shifts__no-workplaces animate-in animate-in--1">
          <div className="shifts__no-workplaces-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <path d="M9 22V12h6v10" />
            </svg>
          </div>
          <p className="shifts__no-workplaces-title">No workplaces yet</p>
          <p className="shifts__no-workplaces-text">Add a workplace first to start tracking your shifts.</p>
          <button
            type="button"
            className="shifts__no-workplaces-btn"
            onClick={() => onNavigate("Workplaces")}
          >
            + Add workplace
          </button>
        </div>
      )}

      {useInlineFilters && effectiveWorkplaces.length > 0 ? (
        <div
          className="shifts__place-filter animate-in animate-in--2"
          role="group"
          aria-label="Filter by place"
          ref={placeFilterRef}
        >
          {PLACE_FILTERS.map(({ id, label, active }) => (
            <button
              key={id}
              type="button"
              data-place={id}
              className={`shifts__place-btn${placeFilter === id ? " shifts__place-btn--active" : ""}${id !== "all" ? ` shifts__place-btn--${id}` : ""}${active === false ? " shifts__place-btn--deactivated" : ""}`}
              onClick={() => setPlaceFilter(id)}
              aria-pressed={placeFilter === id}
            >
              {label}
              {active === false && <span className="shifts__place-deactivated-dot" aria-label="Deactivated" />}
            </button>
          ))}
          <span
            className="shifts__place-indicator"
            style={{
              transform: `translateX(${placeIndicator.left}px)`,
              width: placeIndicator.width,
            }}
            aria-hidden="true"
          />
        </div>
      ) : effectiveWorkplaces.length > 0 ? (
        <button
          type="button"
          className="shifts__place-trigger animate-in animate-in--2"
          onClick={openPlacePicker}
          aria-haspopup="listbox"
          aria-expanded={placePicker.open}
        >
          <span
            className="shifts__place-trigger-dot"
            style={{
              background:
                placeFilter === "all"
                  ? "var(--color-primary, #818cf8)"
                  : PLACES[placeFilter]?.color || "var(--color-primary, #818cf8)",
            }}
          />
          {PLACE_FILTERS.find((f) => f.id === placeFilter)?.label || "All"}
          <span className="shifts__place-trigger-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
      ) : null}

      <div
        className="shifts__summary animate-in animate-in--3"
        key={`${month}-${year}-${placeFilter}`}
      >
        <GlassCard value={`${totals.hours.toFixed(1)}h`} label="Hours" className="shifts__stat" />
        <GlassCard value={formatMoney(totals.pay)} label="Pay" className="shifts__stat" />
        <GlassCard value={formatMoney(totals.tips)} label="Tips" className="shifts__stat" />
        <GlassCard value={formatMoney(totals.total)} label="Total" className="shifts__stat shifts__stat--total" />
      </div>

      {error && (
        <p className="shifts__error shifts__error--shake" role="alert">
          {error}
        </p>
      )}

      <div className="shifts__templates animate-in animate-in--3">
        {presets
          .filter((p) => placeFilter === "all" || p.place === placeFilter)
          .map((preset) => (
            <div key={preset.id} className="shifts__preset">
              <button
                type="button"
                className="shifts__template-chip"
                onClick={() => {
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
                    color: preset.color || "#818cf8",
                  });
                  formModal.openModal();
                }}
              >
                <span
                  className="shifts__template-dot"
                  style={{
                    background:
                      preset.color || PLACES[preset.place]?.color || "#818cf8",
                  }}
                />
                {preset.label}
                <span className="shifts__template-time">
                  {preset.start_time}–{preset.end_time}
                </span>
              </button>
              <button
                type="button"
                className="shifts__preset-edit"
                onClick={() => openPresetModal(preset)}
                aria-label={`Edit ${preset.label} preset`}
              >
                ✎
              </button>
            </div>
          ))}
        <button
          type="button"
          className="shifts__template-chip shifts__template-chip--add"
          onClick={() => openPresetModal()}
        >
          + New preset
        </button>
      </div>

      <div className="shifts__list-header animate-in animate-in--4">
        <h2 className="shifts__list-title">
          {MONTHS[month]} {year}
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
            title={effectiveWorkplaces.length === 0 ? "Add a workplace first" : "Add a new shift"}
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
                ? "No shifts this month"
                : `No ${PLACES[placeFilter]?.label} shifts`
          }
          text={
            effectiveWorkplaces.length === 0
              ? "Add a workplace to start tracking shifts."
              : placeFilter === "all"
                ? "Tap \"+ Add shift\" to log your first one."
                : `No shifts logged for ${PLACES[placeFilter]?.label} this month.`
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
          {filteredShifts.map((shift, index) => {
            const pay = calcPay(
              PLACES,
              shift.place,
              shift.hours,
              shift.pay_type,
            );
            const tips = parseFloat(shift.tips) || 0;
            const placeInfo = PLACES[shift.place];
            const isRemoving = removingId === shift.id;
            const isTipsOnly = shift.pay_type === "tips_only";

            const isDeactivated = deactivatedSlugs.has(shift.place);

            return (
              <li
                key={shift.id}
                className={`shifts__card${isRemoving ? " shifts__card--removing" : ""}${isDeactivated ? " shifts__card--deactivated" : ""}`}
                style={{ "--card-delay": `${index * 0.06}s` }}
              >
                <div className="shifts__card-main">
                  <div className="shifts__card-top">
                    <Badge
                      className="shifts__badge"
                      color={shift.color || PLACES[shift.place]?.color || "#818cf8"}
                      deactivated={isDeactivated}
                    >
                      {placeInfo?.label ?? shift.place}
                    </Badge>
                    <div className="shifts__card-top-right">
                      <span className="shifts__date">
                        {formatDateFriendly(shift.shift_date)}
                      </span>
                      {shift.notes && (
                        <button
                          type="button"
                          className={`shifts__note-toggle${expandedNoteId === shift.id ? " shifts__note-toggle--active" : ""}`}
                          onClick={() =>
                            setExpandedNoteId(
                              expandedNoteId === shift.id ? null : shift.id,
                            )
                          }
                          aria-expanded={expandedNoteId === shift.id}
                          aria-label={
                            expandedNoteId === shift.id
                              ? "Hide note"
                              : "View note"
                          }
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            aria-hidden="true"
                          >
                            <path
                              d="M21 12c0 4.418-4.03 8-9 8-1.06 0-2.07-.16-3-.46L3 21l1.5-4.5C3.55 15.13 3 13.62 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="shifts__card-details">
                    {isTipsOnly ? (
                      <span className="shifts__tips-only-tag">Tips only</span>
                    ) : (
                      <>
                        <span>
                          {shift.hours}h × ₪{placeInfo?.rate}
                        </span>
                      </>
                    )}
                    {tips > 0 && <span>Tips {formatMoney(tips)}</span>}
                    <span className="shifts__card-total">
                      {formatMoney(pay + tips)}
                    </span>
                  </div>
                  {shift.notes && expandedNoteId === shift.id && (
                    <p className="shifts__note-panel">{shift.notes}</p>
                  )}
                </div>
                <div className="shifts__card-actions">
                  <button
                    type="button"
                    className="shifts__action shifts__action--copy"
                    onClick={() => {
                      setEditingShift(null);
                      setForm({
                        place: shift.place,
                        pay_type:
                          shift.pay_type === "tips_only"
                            ? "tips_only"
                            : "hourly",
                        shift_date: new Date().toISOString().slice(0, 10),
                        start_time: shift.start_time ?? "",
                        end_time: shift.end_time ?? "",
                        hours: String(shift.hours),
                        tips: "",
                        notes: shift.notes ?? "",
                      });
                      formModal.openModal();
                    }}
                    aria-label="Copy shift to today"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    className="shifts__action shifts__action--edit"
                    onClick={() => openEditModal(shift)}
                    aria-label="Edit shift"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="shifts__action shifts__action--deactivate"
                    onClick={() => openDeleteModal(shift)}
                    aria-label="Delete shift"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SheetModal
        open={formModal.open}
        closing={formModal.closing}
        onClose={closeFormModal}
        title={editingShift ? "Edit shift" : "Add shift"}
      >
        <form className="shifts__form" onSubmit={handleSubmit}>
          <FormField label="Place" error={fieldErrors.place} state={fieldStates.place} showIndicator>
            <select
              value={form.place}
              onChange={(e) => {
                setForm({ ...form, place: e.target.value });
                setFieldErrors((prev) => ({ ...prev, place: null }));
              }}
            >
              {Object.entries(PLACES).map(([key, { label, rate }]) => (
                <option key={key} value={key}>
                  {label} — ₪{rate}/hr{deactivatedSlugs.has(key) ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </FormField>

          <div
            className="shifts__pay-toggle"
            role="group"
            aria-label="Pay type"
          >
            {PAY_TYPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`shifts__pay-toggle-btn${form.pay_type === id ? " shifts__pay-toggle-btn--active" : ""}`}
                onClick={() => setForm({ ...form, pay_type: id })}
                aria-pressed={form.pay_type === id}
              >
                {label}
              </button>
            ))}
          </div>

          <FormField label="Date" error={fieldErrors.shift_date} state={fieldStates.shift_date} showIndicator shake={fieldErrors.shift_date ? shakeKey : 0}>
            <input
              type="date"
              value={form.shift_date}
              onChange={(e) => {
                setForm({ ...form, shift_date: e.target.value });
                setFieldErrors((prev) => ({ ...prev, shift_date: null }));
              }}
              onBlur={() => handleFieldBlur("shift_date")}
              required
            />
          </FormField>

          <div className="form-time-row">
            <FormField label="Start time" error={fieldErrors.start_time} state={fieldStates.start_time} showIndicator shake={fieldErrors.start_time ? shakeKey : 0}>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) =>
                  handleTimeChange("start_time", e.target.value)
                }
                onBlur={() => handleFieldBlur("start_time")}
              />
            </FormField>
            <FormField label="End time" error={fieldErrors.end_time} state={fieldStates.end_time} showIndicator shake={fieldErrors.end_time ? shakeKey : 0}>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) =>
                  handleTimeChange("end_time", e.target.value)
                }
                onBlur={() => handleFieldBlur("end_time")}
              />
            </FormField>
          </div>

          {form.start_time && form.hours && !form.end_time && (
            <p className="form-field__hint">
              End time will be{" "}
              {(() => {
                const startMin = parseTimeToMinutes(form.start_time);
                const h = parseFloat(form.hours);
                if (startMin != null && !isNaN(h) && h > 0) {
                  const endMin = startMin + Math.round(h * 60);
                  return minutesToTime(endMin);
                }
                return "—";
              })()}
            </p>
          )}

          <FormField label="Hours" error={fieldErrors.hours} state={fieldStates.hours} showIndicator shake={fieldErrors.hours ? shakeKey : 0}>
            <input
              type="number"
              min="0.01"
              step="any"
              placeholder="e.g. 6.5"
              value={form.hours}
              onChange={(e) => handleHoursChange(e.target.value)}
              onBlur={() => handleFieldBlur("hours")}
              required
            />
          </FormField>

          <FormField label="Tips" error={fieldErrors.tips} state={fieldStates.tips} showIndicator shake={fieldErrors.tips ? shakeKey : 0} optional={form.pay_type !== "tips_only"}>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={form.tips}
              onChange={(e) => setForm({ ...form, tips: e.target.value })}
              onBlur={() => handleFieldBlur("tips")}
            />
          </FormField>

          <FormField label="Notes" optional charCount={form.notes.length} maxChars={500}>
            <textarea
              placeholder="e.g. Covered for Dana, closed the register"
              value={form.notes}
              maxLength={500}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
            />
          </FormField>

          {form.hours && (
            <p className="shifts__preview shifts__preview--pop">
              {form.pay_type === "tips_only" ? (
                <>
                  Tips only shift — total{" "}
                  <strong>
                    {formatMoney(parseFloat(form.tips) || 0)}
                  </strong>
                </>
              ) : (
                <>
                  Estimated pay:{" "}
                  <strong>{formatMoney(previewPay)}</strong>
                  {form.tips && (
                    <>
                      {" "}
                      + tips {formatMoney(
                        parseFloat(form.tips) || 0,
                      )} ={" "}
                      <strong>
                        {formatMoney(
                          previewPay + (parseFloat(form.tips) || 0),
                        )}
                      </strong>
                    </>
                  )}
                </>
              )}
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
              type="button"
              className="btn btn--outline"
              onClick={saveCurrentAsPreset}
              disabled={!isFormValid}
              title="Save current form as a reusable preset"
            >
              Save as preset
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !isFormValid}
            >
              {saving ? (
                <>
                  <span
                    className="btn__spinner"
                    aria-hidden="true"
                  />
                  Saving…
                </>
              ) : editingShift ? (
                "Save changes"
              ) : (
                "Add shift"
              )}
            </button>
          </div>
        </form>
      </SheetModal>

      <SheetModal
        open={placePicker.open}
        closing={placePicker.closing}
        onClose={closePlacePicker}
        title="Filter by workplace"
        compact
      >
        <ul className="shifts__picker-list">
          {PLACE_FILTERS.map(({ id, label, active }) => {
            const isActive = placeFilter === id;
            const color =
              id === "all"
                ? "var(--color-primary, #818cf8)"
                : PLACES[id]?.color || "var(--color-primary, #818cf8)";
            return (
              <li key={id}>
                <button
                  type="button"
                  className={`shifts__picker-item${isActive ? " shifts__picker-item--active" : ""}${active === false ? " shifts__picker-item--deactivated" : ""}`}
                  onClick={() => selectPlaceFilter(id)}
                  role="option"
                  aria-selected={isActive}
                >
                  <span
                    className="shifts__picker-dot"
                    style={{ background: color }}
                  />
                  <span className="shifts__picker-label">{label}</span>
                  {active === false && <span className="shifts__picker-deactivated-tag">inactive</span>}
                  {isActive && (
                    <span className="shifts__picker-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetModal>

      <ConfirmModal
        open={!!deleteTarget}
        closing={deleteModal.closing}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete this shift?"
        description="This action cannot be undone."
        confirmLabel="Delete shift"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        }
        preview={
          deleteTarget && (
            <>
              <Badge
                className="shifts__badge"
                color={deleteTarget.color || PLACES[deleteTarget.place]?.color || "#818cf8"}
              >
                {deletePlaceInfo?.label}
              </Badge>
              <span className="shifts__delete-date">
                {formatDateFriendly(deleteTarget.shift_date)}
              </span>
              <span className="shifts__delete-amount">
                {formatMoney(deletePay + deleteTips)}
              </span>
            </>
          )
        }
      />

      <SheetModal
        open={presetModal.open}
        closing={presetModal.closing}
        onClose={closePresetModal}
        title={editingPreset ? "Edit preset" : "Create preset"}
      >
        <p className="shifts__preset-hint">
          Presets let you quick-add common shifts with one tap.
        </p>
        <div className="shifts__form">
          <FormField label="Preset name">
            <input
              type="text"
              value={presetForm.label}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, label: e.target.value }))
              }
              placeholder="e.g. Morning shift"
              maxLength={40}
              autoFocus
            />
          </FormField>
          <FormField label="Place">
            <select
              value={presetForm.place}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, place: e.target.value }))
              }
            >
              {Object.entries(PLACES).map(([key, { label, rate }]) => (
                <option key={key} value={key}>
                  {label} — ₪{rate}/hr{deactivatedSlugs.has(key) ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </FormField>
          <div
            className="shifts__pay-toggle"
            role="group"
            aria-label="Pay type"
          >
            {PAY_TYPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`shifts__pay-toggle-btn${presetForm.pay_type === id ? " shifts__pay-toggle-btn--active" : ""}`}
                onClick={() =>
                  setPresetForm((f) => ({ ...f, pay_type: id }))
                }
                aria-pressed={presetForm.pay_type === id}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="form-time-row">
            <FormField label="Start time">
              <input
                type="time"
                value={presetForm.start_time}
                onChange={(e) =>
                  setPresetForm((f) => ({
                    ...f,
                    start_time: e.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="End time">
              <input
                type="time"
                value={presetForm.end_time}
                onChange={(e) =>
                  setPresetForm((f) => ({
                    ...f,
                    end_time: e.target.value,
                  }))
                }
              />
            </FormField>
          </div>
          <FormField label="Hours">
            <input
              type="number"
              min="0.01"
              step="any"
              value={presetForm.hours}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, hours: e.target.value }))
              }
              placeholder="8"
            />
          </FormField>
          <FormField label="Color">
            <ColorPalettePicker
              value={presetForm.color}
              onChange={(hex) =>
                setPresetForm((f) => ({ ...f, color: hex }))
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
              disabled={!presetForm.label.trim()}
            >
              {editingPreset ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </SheetModal>

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
