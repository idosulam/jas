import "./Shifts.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get_supabase_client } from "../../../Lib/Superbase";
import { use_household } from "../../../Lib/Household_context.jsx";
import { use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  get_user_facing_error,
  sanitize_date,
  sanitize_number,
  sanitize_text,
  format_date_friendly,
  haptic_error,
} from "../../../Lib/Security";
import {
  parse_time_to_minutes,
  minutes_to_time,
  remove_generated_calendar_events,
  sync_shift_to_calendar as sync_shift_to_calendarUtil,
} from "../../../Lib/Calendar_sync";
import { use_body_scroll_lock, use_modal } from "../../../Hooks";
import { use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";

import ConfirmModal from "../../../Components/UI/Modals/Confirm_modal";
import Badge from "../../../Components/UI/badge";
import EmptyState from "../../../Components/UI/Empty_state";
import LoadingSkeleton from "../../../Components/UI/Loading_skeleton";
import PageHeader from "../../../Components/UI/Page_header";
import GlassCard from "../../../Components/UI/Glass_card";
import FAB from "../../../Components/UI/fab";

import {
  PAY_TYPES,
  FILTER_PICKER_BREAKPOINT,
  WEEKDAYS,
  MODAL_EXIT_MS,
  getCurrentLocalTime,
  calculateHoursFromTimes,
  calcPay,
  empty_form,
  format_money,
} from "./Shift_utils";
import ShiftForm from "./Shift_form";
import ShiftDeleteConfirm from "./Shift_delete_confirm";
import PlacePicker from "./Place_picker";
import ShiftPresets from "./Shift_presets";
import ShiftCard from "./Shift_card";

function Shifts({ onNavigate }) {
  const user_id = use_user_id();
  const now = new Date();
  const [selected_date, set_selected_date] = useState(now);
  const [view_mode, set_view_mode] = useState("week");
  const [place_filter, set_place_filter] = useState("all");
  const [shifts, set_shifts] = useState([]);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState(null);
  const [delete_target, set_delete_target] = useState(null);
  const [removing_id, set_removing_id] = useState(null);
  const [editing_shift, set_editing_shift] = useState(null);
  const [form, set_form] = useState(empty_form);
  const [saving, set_saving] = useState(false);
  const [deleting, set_deleting] = useState(false);
  const [expanded_note_id, set_expanded_note_id] = useState(null);
  const [show_floating_actions, set_show_floating_actions] = useState(false);
  const [field_errors, set_field_errors] = useState({});
  const [field_states, set_field_states] = useState({});
  const { household_name } = use_household();
  const [shake_key, set_shake_key] = useState(0);
  const [workplaces, set_workplaces] = useState([]);

  const [presets, set_presets] = useState([]);
  const [editing_preset, set_editing_preset] = useState(null);
  const [preset_form, set_preset_form] = useState({
    label: "",
    place: "",
    start_time: "09:00",
    end_time: "17:00",
    hours: "8",
    pay_type: "hourly",
  });
  const add_btn_ref = useRef(null);
  const place_filter_ref = useRef(null);
  const [place_indicator, set_place_indicator] = useState({ left: 0, width: 0 });
  const [is_mobile, set_is_mobile] = useState(
    () => window.innerWidth < FILTER_PICKER_BREAKPOINT,
  );
  const { success: toast_success, error: toast_error } = use_glass_toast();

  // Modal hooks for each modal
  const form_modal = use_modal(MODAL_EXIT_MS);
  const delete_modal = use_modal(MODAL_EXIT_MS);
  const preset_modal = use_modal(MODAL_EXIT_MS);
  const place_picker = use_modal(MODAL_EXIT_MS);

  // Track viewport width for responsive filter layout
  useEffect(() => {
    const mql = window.matchMedia(
      `(max-width: ${FILTER_PICKER_BREAKPOINT - 1}px)`,
    );
    const handler = (e) => set_is_mobile(e.matches);
    mql.addEventListener("change", handler);
    set_is_mobile(mql.matches);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // All workplaces come from the DB — no hardcoded fallback
  const effective_workplaces = workplaces;

  // Track which workplace slugs are deactivated for faded display
  const deactivated_slugs = useMemo(() => {
    const set = new Set();
    workplaces.forEach((wp) => {
      if (!wp.active) set.add(wp.slug);
    });
    return set;
  }, [workplaces]);

  // Build PLACES map from workplaces for backward compatibility
  const PLACES = useMemo(() => {
    const map = {};
    effective_workplaces.forEach((wp) => {
      map[wp.slug] = {
        label: wp.label,
        rate: Number(wp.rate),
        color: wp.color,
      };
    });
    return map;
  }, [effective_workplaces]);

  const PLACE_FILTERS = useMemo(
    () => [
      { id: "all", label: "All" },
      ...effective_workplaces.map((wp) => ({
        id: wp.slug,
        label: wp.label,
        active: wp.active,
      })),
    ],
    [effective_workplaces],
  );

  const fetch_workplaces = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("workplaces")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: true });
      if (!fetch_error && data && data.length > 0) set_workplaces(data);
    } catch {
      // silent — will use defaults
    }
  }, [user_id]);

  useEffect(() => {
    fetch_workplaces();
  }, [fetch_workplaces]);

  const use_inline_filters = !is_mobile;

  // Sliding indicator for place filter (only when inline pills are shown)
  const update_place_indicator = useCallback(() => {
    if (!use_inline_filters) return;
    const container = place_filter_ref.current;
    if (!container) return;
    const active = container.querySelector(".shifts__place-btn--active");
    if (!active) return;
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    set_place_indicator({
      left: aRect.left - cRect.left - container.scrollLeft,
      width: aRect.width,
    });
  }, [place_filter, use_inline_filters]);
  useEffect(() => {
    // Wait a tick so the DOM has the up-to-date set of pills
    // (e.g. after effective_workplaces loads asynchronously) before measuring.
    const id = requestAnimationFrame(update_place_indicator);
    window.addEventListener("resize", update_place_indicator);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", update_place_indicator);
    };
  }, [update_place_indicator, effective_workplaces]);

  const open_place_picker = useCallback(() => {
    place_picker.open_modal();
  }, [place_picker]);

  const close_place_picker = useCallback(() => {
    place_picker.close_modal();
  }, [place_picker]);

  const select_place_filter = useCallback(
    (id) => {
      set_place_filter(id);
      close_place_picker();
    },
    [close_place_picker],
  );

  const fetch_presets = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("shift_presets")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: true });
      if (!fetch_error) set_presets(data ?? []);
    } catch {
      // silent — presets are non-critical
    }
  }, [user_id]);

  useEffect(() => {
    fetch_presets();
  }, [fetch_presets]);

  const save_preset = useCallback(async () => {
    const label = preset_form.label.trim();
    if (!label) return;
    const payload = {
      label,
      place: preset_form.place,
      start_time: preset_form.start_time,
      end_time: preset_form.end_time,
      hours: Number(Number(preset_form.hours).toFixed(2)),
      pay_type: preset_form.pay_type,
      ...(user_id && { user_id: user_id }),
    };
    try {
      const supabase = get_supabase_client();
      let dbError;
      if (editing_preset) {
        ({ error: dbError } = await supabase
          .from("shift_presets")
          .update(payload)
          .eq("id", editing_preset.id));
      } else {
        ({ error: dbError } = await supabase
          .from("shift_presets")
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
  }, [preset_form, editing_preset, fetch_presets, toast_success, toast_error]);

  const delete_preset = useCallback(
    async (id) => {
      try {
        const supabase = get_supabase_client();
        const { error: dbError } = await supabase
          .from("shift_presets")
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

  const open_preset_modal = useCallback(
    (preset = null) => {
      if (preset) {
        set_editing_preset(preset);
        set_preset_form({
          label: preset.label,
          place: preset.place,
          start_time: preset.start_time,
          end_time: preset.end_time,
          hours: preset.hours,
          pay_type: preset.pay_type,
        });
      } else {
        set_editing_preset(null);
        set_preset_form({
          label: "",
          place: form.place || effective_workplaces[0]?.slug || "pasta",
          start_time: "09:00",
          end_time: "17:00",
          hours: "8",
          pay_type: "hourly",
        });
      }
      preset_modal.open_modal();
    },
    [form.place, effective_workplaces, preset_modal],
  );

  const close_preset_modal = useCallback(() => {
    preset_modal.close_modal();
    // Clear editing preset after animation completes
    setTimeout(() => {
      set_editing_preset(null);
    }, MODAL_EXIT_MS);
  }, [preset_modal]);

  const save_current_as_preset = useCallback(() => {
    const placeLabel = PLACES[form.place]?.label ?? form.place;
    const timeLabel =
      form.start_time && form.end_time
        ? ` ${form.start_time}–${form.end_time}`
        : "";
    set_editing_preset(null);
    set_preset_form({
      label: `${placeLabel}${timeLabel}`,
      place: form.place,
      start_time: form.start_time || "09:00",
      end_time: form.end_time || "17:00",
      hours: form.hours || "8",
      pay_type: form.pay_type,
    });
    preset_modal.open_modal();
  }, [form, PLACES, preset_modal]);

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
    const d = selected_date; // already a Date object
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

  const fetch_shifts = useCallback(async () => {
    if (!user_id) return;
    set_loading(true);
    set_error(null);

    const d = selected_date; // already a Date object
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
        .from("shifts")
        .select("*")
        .eq("user_id", user_id)
        .gte("shift_date", startDate)
        .lte("shift_date", endDate)
        .order("shift_date", { ascending: true });

      if (fetch_error) {
        set_error(get_user_facing_error(fetch_error.message));
        set_shifts([]);
      } else {
        set_shifts(data ?? []);
      }
    } catch (err) {
      set_error(get_user_facing_error(err.message));
      set_shifts([]);
    }
    set_loading(false);
  }, [selected_date, view_mode, user_id]);

  useEffect(() => {
    fetch_shifts();
  }, [fetch_shifts]);

  useEffect(() => {
    const handleShiftsRefresh = () => {
      fetch_shifts();
    };

    window.addEventListener("shifts:refresh", handleShiftsRefresh);
    return () => {
      window.removeEventListener("shifts:refresh", handleShiftsRefresh);
    };
  }, [fetch_shifts]);

  use_body_scroll_lock(
    form_modal.open,
    delete_modal.open,
    preset_modal.open,
    place_picker.open,
  );

  useEffect(() => {
    const target = add_btn_ref.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only show floating actions once the button has scrolled
        // above the viewport (i.e. we're below it), not when it's
        // simply below the viewport because we haven't reached it yet.
        const scrolledPastIt =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        set_show_floating_actions(scrolledPastIt);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const filtered_shifts = useMemo(() => {
    if (place_filter === "all") return shifts;
    return shifts.filter((shift) => shift.place === place_filter);
  }, [shifts, place_filter]);

  const totals = useMemo(() => {
    return filtered_shifts.reduce(
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
  }, [filtered_shifts]);

  const open_add_modal = () => {
    set_editing_shift(null);
    const f = empty_form(effective_workplaces[0]?.slug);
    f.shift_date = selected_key;
    set_form(f);
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  const open_edit_modal = (shift) => {
    set_editing_shift(shift);
    set_form({
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
    set_field_errors({});
    set_field_states({});
    form_modal.open_modal();
  };

  const close_form_modal = () => {
    form_modal.close_modal();
    // Clear editing state after animation completes
    setTimeout(() => {
      set_editing_shift(null);
      set_form(empty_form(effective_workplaces[0]?.slug));
      set_field_states({});
    }, MODAL_EXIT_MS);
  };

  const handle_time_change = (field, value) => {
    const nextForm = { ...form, [field]: value };
    const computedHours = calculateHoursFromTimes(
      nextForm.start_time,
      nextForm.end_time,
    );
    if (computedHours != null) {
      nextForm.hours = String(computedHours);
    }
    set_form(nextForm);
    set_field_errors((prev) => ({ ...prev, [field]: null, hours: null }));
  };

  const handle_hours_change = (value) => {
    const nextForm = { ...form, hours: value };
    // Reverse-calculate end_time from start_time + hours
    if (nextForm.start_time && value) {
      const startMin = parse_time_to_minutes(nextForm.start_time);
      const hoursNum = parseFloat(value);
      if (
        startMin != null &&
        !isNaN(hoursNum) &&
        hoursNum > 0 &&
        hoursNum <= 24
      ) {
        const endMin = startMin + Math.round(hoursNum * 60);
        nextForm.end_time = minutes_to_time(endMin);
      }
    }
    set_form(nextForm);
    set_field_errors((prev) => ({ ...prev, hours: null, end_time: null }));
  };

  const validate_field = (field_name, value) => {
    const errors = {};
    switch (field_name) {
      case "shift_date": {
        if (!value) {
          errors[field_name] = "Pick a date";
        }
        break;
      }
      case "start_time": {
        if (!value) {
          errors[field_name] = "Required";
        } else if (form.end_time) {
          const start = parse_time_to_minutes(value);
          const end = parse_time_to_minutes(form.end_time);
          if (start != null && end != null && start >= end) {
            errors[field_name] = "Must be before end time";
          }
        }
        break;
      }
      case "end_time": {
        if (!value) {
          errors[field_name] = "Required";
        } else if (form.start_time) {
          const start = parse_time_to_minutes(form.start_time);
          const end = parse_time_to_minutes(value);
          if (start != null && end != null && end <= start) {
            errors[field_name] = "Must be after start time";
          }
        }
        break;
      }
      case "hours": {
        const hours = parseFloat(value);
        if (!value || isNaN(hours) || hours <= 0) {
          errors[field_name] = "Enter hours worked";
        } else if (hours > 24) {
          errors[field_name] = "Max 24 hours";
        } else if (hours > 0 && hours < 0.01) {
          errors[field_name] = "Minimum 0.01 hours";
        }
        break;
      }
      case "tips": {
        const tips = parseFloat(value);
        if (value && (isNaN(tips) || tips < 0)) {
          errors[field_name] = "Cannot be negative";
        }
        break;
      }
    }
    return Object.keys(errors).length > 0 ? errors : null;
  };

  const handle_field_blur = (field_name) => {
    const error = validate_field(field_name, form[field_name]);
    const fieldError = error ? error[field_name] : null;
    set_field_errors((prev) => ({
      ...prev,
      [field_name]: fieldError,
    }));
    set_field_states((prev) => ({
      ...prev,
      [field_name]: fieldError ? "error" : form[field_name] ? "valid" : "idle",
    }));
    if (fieldError) {
      set_shake_key((k) => k + 1);
      haptic_error();
    }
  };

  const is_form_valid = useMemo(() => {
    if (!form.shift_date) return false;
    if (form.pay_type !== "tips_only" && !form.hours) return false;
    const hours = parseFloat(form.hours);
    if (form.hours && (isNaN(hours) || hours <= 0 || hours > 24)) return false;
    if (form.start_time && form.end_time) {
      const start = parse_time_to_minutes(form.start_time);
      const end = parse_time_to_minutes(form.end_time);
      if (start != null && end != null && end <= start) return false;
    }
    const tips = parseFloat(form.tips);
    if (form.tips && (isNaN(tips) || tips < 0)) return false;
    return true;
  }, [form]);

  const openDeleteModal = (shift) => {
    set_delete_target(shift);
    delete_modal.open_modal();
  };

  const close_delete_modal = () => {
    delete_modal.close_modal();
    // Clear delete target after animation completes
    setTimeout(() => {
      set_delete_target(null);
    }, MODAL_EXIT_MS);
  };

  // Thin wrappers that pass local PLACES map to the shared utility functions
  async function _removeShiftGeneratedCalendarEvents(
    supabase,
    date_key,
    linked_shift_id = null,
  ) {
    return remove_generated_calendar_events(
      supabase,
      date_key,
      user_id,
      linked_shift_id,
    );
  }

  const notify_calendar_refresh = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("calendar:refresh"));
    }
  };

  async function sync_shift_to_calendar(shiftRecord) {
    if (!shiftRecord) return;
    try {
      const supabase = get_supabase_client();
      await sync_shift_to_calendarUtil(supabase, shiftRecord, user_id, PLACES);
    } catch {
      try {
        toast_error?.("Failed to sync shift to calendar.");
      } catch {
        // ignore
      }
    }
  }

  const handle_submit = async (e) => {
    e.preventDefault();

    const shift_date = sanitize_date(
      form.shift_date,
      new Date().toISOString().slice(0, 10),
    );
    const hours = sanitize_number(form.hours, 0.01, 24);
    const tips = sanitize_number(form.tips, 0, 10000) ?? 0;
    const notes = form.notes.trim() ? sanitize_text(form.notes, 500) : null;

    // Validate all fields
    const errors = {};
    if (!shift_date) errors.shift_date = "Pick a date";
    if (!hours || hours <= 0) errors.hours = "Enter hours worked";
    if (form.pay_type !== "tips_only" && hours > 24)
      errors.hours = "Max 24 hours";

    if (form.start_time && form.end_time) {
      const start = parse_time_to_minutes(form.start_time);
      const end = parse_time_to_minutes(form.end_time);
      if (start != null && end != null && end <= start) {
        errors.end_time = "Must be after start time";
      }
    }

    if (Object.keys(errors).length > 0) {
      set_field_errors(errors);
      // Set error states for all errored fields
      const newStates = {};
      Object.keys(errors).forEach((k) => {
        newStates[k] = "error";
      });
      set_field_states((prev) => ({ ...prev, ...newStates }));
      set_shake_key((k) => k + 1);
      return;
    }

    set_field_errors({});
    set_field_states({});

    set_saving(true);
    set_error(null);

    const payload = {
      place: form.place,
      pay_type: form.pay_type === "tips_only" ? "tips_only" : "hourly",
      shift_date: shift_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      hours: Number(hours.toFixed(2)),
      tips: Number(tips.toFixed(2)),
      notes,
      color: PLACES[form.place]?.color || null,
      ...(user_id && { user_id: user_id }),
    };

    try {
      const supabase = get_supabase_client();
      let dbError;
      let savedShift = null;
      if (editing_shift) {
        const res = await supabase
          .from("shifts")
          .update(payload)
          .eq("id", editing_shift.id)
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

      set_saving(false);

      if (dbError) {
        const message = get_user_facing_error(dbError.message);
        set_error(message);
        toast_error(
          editing_shift ? "Couldn't edit shift." : "Couldn't save shift.",
        );
        return;
      }

      // Sync to calendar (best-effort)
      try {
        await sync_shift_to_calendar(savedShift);
        notify_calendar_refresh();
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("calendar:refresh", {
              detail: { date: savedShift?.shift_date ?? shift_date },
            }),
          );
        }
      } catch {
        // ignore sync errors
      }

      close_form_modal();
      toast_success(editing_shift ? "Shift updated." : "Shift saved.");
      fetch_shifts();
    } catch (err) {
      set_saving(false);
      set_error(get_user_facing_error(err.message));
      toast_error(
        editing_shift ? "Couldn't edit shift." : "Couldn't save shift.",
      );
    }
  };

  const confirm_delete = async () => {
    if (!delete_target) return;

    set_deleting(true);
    set_error(null);

    try {
      const supabase = get_supabase_client();
      const { error: dbError } = await supabase
        .from("shifts")
        .delete()
        .eq("id", delete_target.id);

      set_deleting(false);

      if (dbError) {
        set_error(get_user_facing_error(dbError.message));
        toast_error("Failed to delete shift.");
        return;
      }

      const removedId = delete_target.id;
      const shift_date = delete_target.shift_date;

      try {
        const { data: remainingShifts = [] } = await supabase
          .from("shifts")
          .select("*")
          .eq("user_id", user_id)
          .eq("shift_date", shift_date);

        if ((remainingShifts || []).length > 0) {
          await _removeShiftGeneratedCalendarEvents(
            supabase,
            shift_date,
            removedId,
          );
          await Promise.all(
            remainingShifts.map((shift) => sync_shift_to_calendar(shift)),
          );
        } else {
          await _removeShiftGeneratedCalendarEvents(supabase, shift_date);
        }
      } catch {
        // ignore cleanup errors
      }

      close_delete_modal();
      notify_calendar_refresh();
      toast_success("Shift deleted successfully.");
      set_removing_id(removedId);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("calendar:refresh", { detail: { date: shift_date } }),
        );
      }

      setTimeout(() => {
        set_shifts((prev) => prev.filter((s) => s.id !== removedId));
        set_removing_id(null);
      }, 380);
    } catch (err) {
      set_deleting(false);
      set_error(get_user_facing_error(err.message));
      toast_error("Failed to delete shift.");
    }
  };

  const handle_quick_add_preset = useCallback(
    (preset) => {
      set_editing_shift(null);
      set_form({
        place: preset.place,
        pay_type: preset.pay_type,
        shift_date: new Date().toISOString().slice(0, 10),
        start_time: preset.start_time,
        end_time: preset.end_time,
        hours: preset.hours,
        tips: "",
        notes: "",
      });
      form_modal.open_modal();
    },
    [form_modal],
  );

  const handle_copy_shift = useCallback(
    (shift) => {
      set_editing_shift(null);
      set_form({
        place: shift.place,
        pay_type: shift.pay_type === "tips_only" ? "tips_only" : "hourly",
        shift_date: new Date().toISOString().slice(0, 10),
        start_time: shift.start_time ?? "",
        end_time: shift.end_time ?? "",
        hours: String(shift.hours),
        tips: "",
        notes: shift.notes ?? "",
      });
      form_modal.open_modal();
    },
    [form_modal],
  );

  const handle_toggle_note = useCallback(
    (id) => {
      set_expanded_note_id(expanded_note_id === id ? null : id);
    },
    [expanded_note_id],
  );

  return (
    <section className="shifts page">
      <PageHeader
        eyebrow={
          household_name ? `Earnings · ${household_name}` : "Earnings tracker"
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
              set_selected_date((d) => add_days(d, view_mode === "week" ? -7 : -30))
            }
            aria-label="Previous day"
          >
            ‹
          </button>
          <span className="shifts__date-label">{day_title}</span>
          <button
            type="button"
            className="shifts__date-btn"
            onClick={() =>
              set_selected_date((d) => add_days(d, view_mode === "week" ? 7 : 30))
            }
            aria-label="Next day"
          >
            ›
          </button>
        </div>
        {!is_today && (
          <button
            type="button"
            className="shifts__date-today"
            onClick={() => set_selected_date(new Date())}
          >
            Today
          </button>
        )}
      </div>

      {/* Week day selector */}
      <div
        className={`shifts__week-days animate-in animate-in--1${view_mode === "month" ? " shifts__week-days--month" : ""}`}
        role="group"
        aria-label={view_mode === "week" ? "Week days" : "Month days"}
      >
        {visible_days.map((day) => {
          const key = to_date_key(day);
          const isSelected = key === selected_key;
          const isDayToday = key === to_date_key(now);
          const hasShift = shifts.some((s) => s.shift_date === key);
          const isInCurrentMonth =
            view_mode === "month"
              ? day.getMonth() === selected_date.getMonth()
              : true;

          return (
            <button
              key={key}
              type="button"
              className={`shifts__week-day${isSelected ? " shifts__week-day--active" : ""}${isDayToday ? " shifts__week-day--today" : ""}${hasShift ? " shifts__week-day--busy" : ""}${!isInCurrentMonth ? " shifts__week-day--muted" : ""}`}
              onClick={() => set_selected_date(day)}
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
          className={`shifts__view-btn${view_mode === "week" ? " shifts__view-btn--active" : ""}`}
          onClick={() => set_view_mode("week")}
          aria-pressed={view_mode === "week"}
        >
          1 week
        </button>
        <button
          type="button"
          className={`shifts__view-btn${view_mode === "month" ? " shifts__view-btn--active" : ""}`}
          onClick={() => set_view_mode("month")}
          aria-pressed={view_mode === "month"}
        >
          1 month
        </button>
      </div>

      {/* No workplaces CTA */}
      {!loading && effective_workplaces.length === 0 && onNavigate && (
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
        selectedPlaceId={place_filter}
        onSelect={select_place_filter}
        is_mobile={is_mobile}
        picker_open={place_picker.open}
        picker_closing={place_picker.closing}
        onOpenPicker={open_place_picker}
        onClosePicker={close_place_picker}
        indicator={place_indicator}
        containerRef={place_filter_ref}
      />

      <div
        className="shifts__summary animate-in animate-in--3"
        key={`${selected_key}-${place_filter}`}
      >
        <GlassCard
          value={`${totals.hours.toFixed(1)}h`}
          label="Hours"
          className="shifts__stat"
        />
        <GlassCard
          value={format_money(totals.pay)}
          label="Pay"
          className="shifts__stat"
        />
        <GlassCard
          value={format_money(totals.tips)}
          label="Tips"
          className="shifts__stat"
        />
        <GlassCard
          value={format_money(totals.total)}
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
        place_filter={place_filter}
        onQuickAdd={handle_quick_add_preset}
        onEditPreset={open_preset_modal}
        on_add_preset={() => open_preset_modal()}
        presetModalOpen={preset_modal.open}
        presetModalClosing={preset_modal.closing}
        onClosePresetModal={close_preset_modal}
        editing_preset={editing_preset}
        preset_form={preset_form}
        set_preset_form={set_preset_form}
        places={PLACES}
        deactivated_slugs={deactivated_slugs}
        onSavePreset={save_preset}
        onDeletePreset={delete_preset}
      />

      <div className="shifts__list-header animate-in animate-in--4">
        <h2 className="shifts__list-title">
          {day_title}
          {place_filter !== "all" && (
            <span className="shifts__list-subtitle">
              {" "}
              · {PLACES[place_filter]?.label}
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
            onClick={open_add_modal}
            ref={add_btn_ref}
            disabled={effective_workplaces.length === 0}
            title={
              effective_workplaces.length === 0
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
      ) : filtered_shifts.length === 0 ? (
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
            effective_workplaces.length === 0
              ? "No workplaces yet"
              : place_filter === "all"
                ? "No shifts this week"
                : `No ${PLACES[place_filter]?.label} shifts`
          }
          text={
            effective_workplaces.length === 0
              ? "Add a workplace to start tracking shifts."
              : place_filter === "all"
                ? 'Tap "+ Add shift" to log your first one.'
                : `No shifts logged for ${PLACES[place_filter]?.label} this week.`
          }
          action={
            effective_workplaces.length === 0 && onNavigate ? (
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
        <ul className="shifts__list" key={`list-${place_filter}`}>
          {filtered_shifts.map((shift, index) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              places={PLACES}
              deactivated_slugs={deactivated_slugs}
              onEdit={open_edit_modal}
              onCopy={handle_copy_shift}
              onDelete={openDeleteModal}
              onToggleNote={handle_toggle_note}
              expanded_note_id={expanded_note_id}
              isRemoving={removing_id === shift.id}
              animDelay={`${index * 0.06}s`}
            />
          ))}
        </ul>
      )}

      {/* Shift form modal */}
      <ShiftForm
        open={form_modal.open}
        closing={form_modal.closing}
        onClose={close_form_modal}
        form={form}
        set_form={set_form}
        editing_shift={editing_shift}
        saving={saving}
        field_errors={field_errors}
        field_states={field_states}
        shake_key={shake_key}
        onFieldBlur={handle_field_blur}
        onTimeChange={handle_time_change}
        onHoursChange={handle_hours_change}
        onSubmit={handle_submit}
        onSaveAsPreset={save_current_as_preset}
        places={PLACES}
        deactivated_slugs={deactivated_slugs}
        is_form_valid={is_form_valid}
      />

      {/* Delete confirmation */}
      <ShiftDeleteConfirm
        delete_target={delete_target}
        closing={delete_modal.closing}
        onClose={close_delete_modal}
        onConfirm={confirm_delete}
        deleting={deleting}
        places={PLACES}
      />

      <FAB
        visible={show_floating_actions}
        on_scroll_top={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        on_add={open_add_modal}
        add_label="Add shift"
      />
    </section>
  );
}

export default Shifts;
