import "./Shifts.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Get_supabase_client } from "../../../Lib/Superbase";
import { Use_household } from "../../../Lib/Household_context.jsx";
import { Use_user_id } from "../../../Lib/Auth_context.jsx";
import {
  Get_user_facing_error,
  Sanitize_date,
  Sanitize_number,
  Sanitize_text,
  Format_date_friendly,
  Haptic_error,
} from "../../../Lib/Security";
import {
  Parse_time_to_minutes,
  Minutes_to_time,
  Remove_generated_calendar_events,
  Sync_shift_to_calendar as sync_shift_to_calendarUtil,
} from "../../../Lib/Calendar_sync";
import { Use_body_scroll_lock, Use_modal } from "../../../Hooks";
import { Use_glass_toast } from "../../../Lib/Glass_toast_provider.jsx";

import Confirm_modal from "../../../Components/UI/Modals/Confirm_modal";
import Badge from "../../../Components/UI/Badge";
import Empty_state from "../../../Components/UI/Empty_state";
import Loading_skeleton from "../../../Components/UI/Loading_skeleton";
import Page_header from "../../../Components/UI/Page_header";
import Glass_card from "../../../Components/UI/Glass_card";
import FAB from "../../../Components/UI/Fab";

import {
  PAY_TYPES,
  FILTER_PICKER_BREAKPOINT,
  WEEKDAYS,
  MODAL_EXIT_MS,
  get_current_local_time,
  calculate_hours_from_times,
  calc_pay,
  Empty_form,
  Format_money,
} from "./Shift_utils";
import Shift_form from "./Shift_form";
import Shift_delete_confirm from "./Shift_delete_confirm";
import Place_picker from "./Place_picker";
import Shift_presets from "./Shift_presets";
import Shift_card from "./Shift_card";

function Shifts({ onNavigate }) {
  const user_id = Use_user_id();
  const now = new Date();
  const [Selected_date, Set_selected_date] = useState(now);
  const [View_mode, Set_view_mode] = useState("week");
  const [Place_filter, Set_place_filter] = useState("all");
  const [shifts, Set_shifts] = useState([]);
  const [Loading, Set_loading] = useState(true);
  const [error, Set_error] = useState(null);
  const [Delete_target, Set_delete_target] = useState(null);
  const [Removing_id, Set_removing_id] = useState(null);
  const [Editing_shift, Set_editing_shift] = useState(null);
  const [form, Set_form] = useState(Empty_form);
  const [Saving, Set_saving] = useState(false);
  const [Deleting, Set_deleting] = useState(false);
  const [Expanded_note_id, Set_expanded_note_id] = useState(null);
  const [Show_floating_actions, Set_show_floating_actions] = useState(false);
  const [Field_errors, Set_field_errors] = useState({});
  const [Field_states, Set_field_states] = useState({});
  const { Household_name } = Use_household();
  const [Shake_key, Set_shake_key] = useState(0);
  const [Workplaces, Set_workplaces] = useState([]);

  const [Presets, Set_presets] = useState([]);
  const [Editing_preset, Set_editing_preset] = useState(null);
  const [Preset_form, Set_preset_form] = useState({
    label: "",
    place: "",
    start_time: "09:00",
    end_time: "17:00",
    hours: "8",
    pay_type: "hourly",
  });
  const Add_btn_ref = useRef(null);
  const Place_filter_ref = useRef(null);
  const [Place_indicator, set_place_indicator] = useState({ left: 0, width: 0 });
  const [Is_mobile, set_is_mobile] = useState(
    () => window.innerWidth < FILTER_PICKER_BREAKPOINT,
  );
  const { success: Toast_success, error: Toast_error } = Use_glass_toast();

  // Modal hooks for each modal
  const Form_modal = Use_modal(MODAL_EXIT_MS);
  const Delete_modal = Use_modal(MODAL_EXIT_MS);
  const Preset_modal = Use_modal(MODAL_EXIT_MS);
  const Place_picker_modal = Use_modal(MODAL_EXIT_MS);

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

  // All Workplaces come from the DB — no hardcoded fallback
  const Effective_workplaces = Workplaces;

  // Track which workplace slugs are deactivated for faded display
  const Deactivated_slugs = useMemo(() => {
    const set = new Set();
    Workplaces.forEach((wp) => {
      if (!wp.active) set.add(wp.slug);
    });
    return set;
  }, [Workplaces]);

  // Build PLACES map from Workplaces for backward compatibility
  const PLACES = useMemo(() => {
    const map = {};
    Effective_workplaces.forEach((wp) => {
      map[wp.slug] = {
        label: wp.label,
        rate: Number(wp.rate),
        color: wp.color,
      };
    });
    return map;
  }, [Effective_workplaces]);

  const PLACE_FILTERS = useMemo(
    () => [
      { id: "all", label: "All" },
      ...Effective_workplaces.map((wp) => ({
        id: wp.slug,
        label: wp.label,
        active: wp.active,
      })),
    ],
    [Effective_workplaces],
  );

  const Fetch_workplaces = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = Get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("workplaces")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: true });
      if (!fetch_error && data && data.length > 0) Set_workplaces(data);
    } catch {
      // silent — will use defaults
    }
  }, [user_id]);

  useEffect(() => {
    Fetch_workplaces();
  }, [Fetch_workplaces]);

  const Use_inline_filters = !Is_mobile;

  // Sliding indicator for place filter (only when inline pills are shown)
  const Update_place_indicator = useCallback(() => {
    if (!Use_inline_filters) return;
    const container = Place_filter_ref.current;
    if (!container) return;
    const active = container.querySelector(".tab-toggle__btn--active");
    if (!active) return;
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    set_place_indicator({
      left: aRect.left - cRect.left - container.scrollLeft,
      width: aRect.width,
    });
  }, [Place_filter, Use_inline_filters]);
  useEffect(() => {
    // Wait a tick so the DOM has the up-to-date set of pills
    // (e.g. after Effective_workplaces loads asynchronously) before measuring.
    const id = requestAnimationFrame(Update_place_indicator);
    window.addEventListener("resize", Update_place_indicator);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", Update_place_indicator);
    };
  }, [Update_place_indicator, Effective_workplaces]);

  const Open_place_picker = useCallback(() => {
    Place_picker_modal.open_modal();
  }, [Place_picker_modal]);

  const Close_place_picker = useCallback(() => {
    Place_picker_modal.close_modal();
  }, [Place_picker_modal]);

  const Select_place_filter = useCallback(
    (id) => {
      Set_place_filter(id);
      Close_place_picker();
    },
    [Close_place_picker],
  );

  const Fetch_presets = useCallback(async () => {
    if (!user_id) return;
    try {
      const supabase = Get_supabase_client();
      const { data, error: fetch_error } = await supabase
        .from("shift_presets")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", { ascending: true });
      if (!fetch_error) Set_presets(data ?? []);
    } catch {
      // silent — Presets are non-critical
    }
  }, [user_id]);

  useEffect(() => {
    Fetch_presets();
  }, [Fetch_presets]);

  const Save_preset = useCallback(async () => {
    const label = Preset_form.label.trim();
    if (!label) return;
    const payload = {
      label,
      place: Preset_form.place,
      start_time: Preset_form.start_time,
      end_time: Preset_form.end_time,
      hours: Number(Number(Preset_form.hours).toFixed(2)),
      pay_type: Preset_form.pay_type,
      ...(user_id && { user_id: user_id }),
    };
    try {
      const supabase = Get_supabase_client();
      let dbError;
      if (Editing_preset) {
        ({ error: dbError } = await supabase
          .from("shift_presets")
          .update(payload)
          .eq("id", Editing_preset.id));
      } else {
        ({ error: dbError } = await supabase
          .from("shift_presets")
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
  }, [Preset_form, Editing_preset, Fetch_presets, Toast_success, Toast_error]);

  const Delete_preset = useCallback(
    async (id) => {
      try {
        const supabase = Get_supabase_client();
        const { error: dbError } = await supabase
          .from("shift_presets")
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

  const Open_preset_modal = useCallback(
    (preset = null) => {
      if (preset) {
        Set_editing_preset(preset);
        Set_preset_form({
          label: preset.label,
          place: preset.place,
          start_time: preset.start_time,
          end_time: preset.end_time,
          hours: preset.hours,
          pay_type: preset.pay_type,
        });
      } else {
        Set_editing_preset(null);
        Set_preset_form({
          label: "",
          place: form.place || Effective_workplaces[0]?.slug || "pasta",
          start_time: "09:00",
          end_time: "17:00",
          hours: "8",
          pay_type: "hourly",
        });
      }
      Preset_modal.open_modal();
    },
    [form.place, Effective_workplaces, Preset_modal],
  );

  const Close_preset_modal = useCallback(() => {
    Preset_modal.close_modal();
    // Clear editing preset after animation completes
    setTimeout(() => {
      Set_editing_preset(null);
    }, MODAL_EXIT_MS);
  }, [Preset_modal]);

  const Save_current_as_preset = useCallback(() => {
    const placeLabel = PLACES[form.place]?.label ?? form.place;
    const timeLabel =
      form.start_time && form.end_time
        ? ` ${form.start_time}–${form.end_time}`
        : "";
    Set_editing_preset(null);
    Set_preset_form({
      label: `${placeLabel}${timeLabel}`,
      place: form.place,
      start_time: form.start_time || "09:00",
      end_time: form.end_time || "17:00",
      hours: form.hours || "8",
      pay_type: form.pay_type,
    });
    Preset_modal.open_modal();
  }, [form, PLACES, Preset_modal]);

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
    const d = Selected_date; // already a Date object
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

  const Fetch_shifts = useCallback(async () => {
    if (!user_id) return;
    Set_loading(true);
    Set_error(null);

    const d = Selected_date; // already a Date object
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
        .from("shifts")
        .select("*")
        .eq("user_id", user_id)
        .gte("shift_date", startDate)
        .lte("shift_date", endDate)
        .order("shift_date", { ascending: true });

      if (fetch_error) {
        Set_error(Get_user_facing_error(fetch_error.message));
        Set_shifts([]);
      } else {
        Set_shifts(data ?? []);
      }
    } catch (err) {
      Set_error(Get_user_facing_error(err.message));
      Set_shifts([]);
    }
    Set_loading(false);
  }, [Selected_date, View_mode, user_id]);

  useEffect(() => {
    Fetch_shifts();
  }, [Fetch_shifts]);

  useEffect(() => {
    const handleShiftsRefresh = () => {
      Fetch_shifts();
    };

    window.addEventListener("shifts:refresh", handleShiftsRefresh);
    return () => {
      window.removeEventListener("shifts:refresh", handleShiftsRefresh);
    };
  }, [Fetch_shifts]);

  Use_body_scroll_lock(
    Form_modal.open,
    Delete_modal.open,
    Preset_modal.open,
    Place_picker_modal.open,
  );

  useEffect(() => {
    const target = Add_btn_ref.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only show floating actions once the button has scrolled
        // above the viewport (i.e. we're below it), not when it's
        // simply below the viewport because we haven't reached it yet.
        const scrolledPastIt =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        Set_show_floating_actions(scrolledPastIt);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const Filtered_shifts = useMemo(() => {
    if (Place_filter === "all") return shifts;
    return shifts.filter((shift) => shift.place === Place_filter);
  }, [shifts, Place_filter]);

  const totals = useMemo(() => {
    return Filtered_shifts.reduce(
      (acc, shift) => {
        const pay = calc_pay(PLACES, shift.place, shift.hours, shift.pay_type);
        const tips = parseFloat(shift.tips) || 0;
        acc.hours += parseFloat(shift.hours) || 0;
        acc.pay += pay;
        acc.tips += tips;
        acc.total += pay + tips;
        return acc;
      },
      { hours: 0, pay: 0, tips: 0, total: 0 },
    );
  }, [Filtered_shifts]);

  const Open_add_modal = () => {
    Set_editing_shift(null);
    const f = Empty_form(Effective_workplaces[0]?.slug);
    f.shift_date = Selected_key;
    Set_form(f);
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  const Open_edit_modal = (shift) => {
    Set_editing_shift(shift);
    Set_form({
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
    Set_field_errors({});
    Set_field_states({});
    Form_modal.open_modal();
  };

  const Close_form_modal = () => {
    Form_modal.close_modal();
    // Clear editing state after animation completes
    setTimeout(() => {
      Set_editing_shift(null);
      Set_form(Empty_form(Effective_workplaces[0]?.slug));
      Set_field_states({});
    }, MODAL_EXIT_MS);
  };

  const Handle_time_change = (field, value) => {
    const nextForm = { ...form, [field]: value };
    const computedHours = calculate_hours_from_times(
      nextForm.start_time,
      nextForm.end_time,
    );
    if (computedHours != null) {
      nextForm.hours = String(computedHours);
    }
    Set_form(nextForm);
    Set_field_errors((prev) => ({ ...prev, [field]: null, hours: null }));
  };

  const Handle_hours_change = (value) => {
    const nextForm = { ...form, hours: value };
    // Reverse-calculate end_time from start_time + hours
    if (nextForm.start_time && value) {
      const startMin = Parse_time_to_minutes(nextForm.start_time);
      const hoursNum = parseFloat(value);
      if (
        startMin != null &&
        !isNaN(hoursNum) &&
        hoursNum > 0 &&
        hoursNum <= 24
      ) {
        const endMin = startMin + Math.round(hoursNum * 60);
        nextForm.end_time = Minutes_to_time(endMin);
      }
    }
    Set_form(nextForm);
    Set_field_errors((prev) => ({ ...prev, hours: null, end_time: null }));
  };

  const Validate_field = (field_name, value) => {
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
          const start = Parse_time_to_minutes(value);
          const end = Parse_time_to_minutes(form.end_time);
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
          const start = Parse_time_to_minutes(form.start_time);
          const end = Parse_time_to_minutes(value);
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

  const Handle_field_blur = (field_name) => {
    const error = Validate_field(field_name, form[field_name]);
    const fieldError = error ? error[field_name] : null;
    Set_field_errors((prev) => ({
      ...prev,
      [field_name]: fieldError,
    }));
    Set_field_states((prev) => ({
      ...prev,
      [field_name]: fieldError ? "error" : form[field_name] ? "valid" : "idle",
    }));
    if (fieldError) {
      Set_shake_key((k) => k + 1);
      Haptic_error();
    }
  };

  const Is_form_valid = useMemo(() => {
    if (!form.shift_date) return false;
    if (form.pay_type !== "tips_only" && !form.hours) return false;
    const hours = parseFloat(form.hours);
    if (form.hours && (isNaN(hours) || hours <= 0 || hours > 24)) return false;
    if (form.start_time && form.end_time) {
      const start = Parse_time_to_minutes(form.start_time);
      const end = Parse_time_to_minutes(form.end_time);
      if (start != null && end != null && end <= start) return false;
    }
    const tips = parseFloat(form.tips);
    if (form.tips && (isNaN(tips) || tips < 0)) return false;
    return true;
  }, [form]);

  const openDeleteModal = (shift) => {
    Set_delete_target(shift);
    Delete_modal.open_modal();
  };

  const Close_delete_modal = () => {
    Delete_modal.close_modal();
    // Clear delete target after animation completes
    setTimeout(() => {
      Set_delete_target(null);
    }, MODAL_EXIT_MS);
  };

  // Thin wrappers that pass local PLACES map to the shared utility functions
  async function _removeShiftGeneratedCalendarEvents(
    supabase,
    date_key,
    linked_shift_id = null,
  ) {
    return Remove_generated_calendar_events(
      supabase,
      date_key,
      user_id,
      linked_shift_id,
    );
  }

  const Notify_calendar_refresh = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("calendar:refresh"));
    }
  };

  async function Sync_shift_to_calendar(shiftRecord) {
    if (!shiftRecord) return;
    try {
      const supabase = Get_supabase_client();
      await sync_shift_to_calendarUtil(supabase, shiftRecord, user_id, PLACES);
    } catch {
      try {
        Toast_error?.("Failed to sync shift to calendar.");
      } catch {
        // ignore
      }
    }
  }

  const Handle_submit = async (e) => {
    e.preventDefault();

    const shift_date = Sanitize_date(
      form.shift_date,
      new Date().toISOString().slice(0, 10),
    );
    const hours = Sanitize_number(form.hours, 0.01, 24);
    const tips = Sanitize_number(form.tips, 0, 10000) ?? 0;
    const notes = form.notes.trim() ? Sanitize_text(form.notes, 500) : null;

    // Validate all fields
    const errors = {};
    if (!shift_date) errors.shift_date = "Pick a date";
    if (!hours || hours <= 0) errors.hours = "Enter hours worked";
    if (form.pay_type !== "tips_only" && hours > 24)
      errors.hours = "Max 24 hours";

    if (form.start_time && form.end_time) {
      const start = Parse_time_to_minutes(form.start_time);
      const end = Parse_time_to_minutes(form.end_time);
      if (start != null && end != null && end <= start) {
        errors.end_time = "Must be after start time";
      }
    }

    if (Object.keys(errors).length > 0) {
      Set_field_errors(errors);
      // Set error states for all errored fields
      const newStates = {};
      Object.keys(errors).forEach((k) => {
        newStates[k] = "error";
      });
      Set_field_states((prev) => ({ ...prev, ...newStates }));
      Set_shake_key((k) => k + 1);
      return;
    }

    Set_field_errors({});
    Set_field_states({});

    Set_saving(true);
    Set_error(null);

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
      const supabase = Get_supabase_client();
      let dbError;
      let savedShift = null;
      if (Editing_shift) {
        const res = await supabase
          .from("shifts")
          .update(payload)
          .eq("id", Editing_shift.id)
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

      Set_saving(false);

      if (dbError) {
        const message = Get_user_facing_error(dbError.message);
        Set_error(message);
        Toast_error(
          Editing_shift ? "Couldn't edit shift." : "Couldn't save shift.",
        );
        return;
      }

      // Sync to calendar (best-effort)
      try {
        await Sync_shift_to_calendar(savedShift);
        Notify_calendar_refresh();
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

      Close_form_modal();
      Toast_success(Editing_shift ? "Shift updated." : "Shift saved.");
      Fetch_shifts();
    } catch (err) {
      Set_saving(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error(
        Editing_shift ? "Couldn't edit shift." : "Couldn't save shift.",
      );
    }
  };

  const Confirm_delete = async () => {
    if (!Delete_target) return;

    Set_deleting(true);
    Set_error(null);

    try {
      const supabase = Get_supabase_client();
      const { error: dbError } = await supabase
        .from("shifts")
        .delete()
        .eq("id", Delete_target.id);

      Set_deleting(false);

      if (dbError) {
        Set_error(Get_user_facing_error(dbError.message));
        Toast_error("Failed to delete shift.");
        return;
      }

      const removedId = Delete_target.id;
      const shift_date = Delete_target.shift_date;

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
            remainingShifts.map((shift) => Sync_shift_to_calendar(shift)),
          );
        } else {
          await _removeShiftGeneratedCalendarEvents(supabase, shift_date);
        }
      } catch {
        // ignore cleanup errors
      }

      Close_delete_modal();
      Notify_calendar_refresh();
      Toast_success("Shift deleted successfully.");
      Set_removing_id(removedId);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("calendar:refresh", { detail: { date: shift_date } }),
        );
      }

      setTimeout(() => {
        Set_shifts((prev) => prev.filter((s) => s.id !== removedId));
        Set_removing_id(null);
      }, 380);
    } catch (err) {
      Set_deleting(false);
      Set_error(Get_user_facing_error(err.message));
      Toast_error("Failed to delete shift.");
    }
  };

  const Handle_quick_add_preset = useCallback(
    (preset) => {
      Set_editing_shift(null);
      Set_form({
        place: preset.place,
        pay_type: preset.pay_type,
        shift_date: new Date().toISOString().slice(0, 10),
        start_time: preset.start_time,
        end_time: preset.end_time,
        hours: preset.hours,
        tips: "",
        notes: "",
      });
      Form_modal.open_modal();
    },
    [Form_modal],
  );

  const Handle_copy_shift = useCallback(
    (shift) => {
      Set_editing_shift(null);
      Set_form({
        place: shift.place,
        pay_type: shift.pay_type === "tips_only" ? "tips_only" : "hourly",
        shift_date: new Date().toISOString().slice(0, 10),
        start_time: shift.start_time ?? "",
        end_time: shift.end_time ?? "",
        hours: String(shift.hours),
        tips: "",
        notes: shift.notes ?? "",
      });
      Form_modal.open_modal();
    },
    [Form_modal],
  );

  const Handle_toggle_note = useCallback(
    (id) => {
      Set_expanded_note_id(Expanded_note_id === id ? null : id);
    },
    [Expanded_note_id],
  );

  return (
    <section className="shifts page">
      <Page_header
        eyebrow={
          Household_name ? `Earnings · ${Household_name}` : "Earnings tracker"
        }
        title="Shifts"
        className="shifts__header animate-in"
      />

      {/* Date navigation — matches Calendar style */}
      <div className="date-nav animate-in animate-in--1">
        <button
          type="button"
          className="date-nav__btn"
          onClick={() =>
            Set_selected_date((d) => Add_days(d, View_mode === "week" ? -7 : -30))
          }
          aria-label="Previous"
        >
          ‹
        </button>
        <div className="date-nav__center">
          <span className="date-nav__label">{Day_title}</span>
          {!Is_today && (
            <button
              type="button"
              className="date-nav__today"
              onClick={() => Set_selected_date(new Date())}
            >
              Today
            </button>
          )}
        </div>
        <button
          type="button"
          className="date-nav__btn"
          onClick={() =>
            Set_selected_date((d) => Add_days(d, View_mode === "week" ? 7 : 30))
          }
          aria-label="Next"
        >
          ›
        </button>
      </div>

      {/* Week day selector */}
      <div
        className={`week-days animate-in animate-in--1${View_mode === "month" ? " week-days--month" : ""}`}
        role="group"
        aria-label={View_mode === "week" ? "Week days" : "Month days"}
      >
        {Visible_days.map((day) => {
          const key = To_date_key(day);
          const isSelected = key === Selected_key;
          const isDayToday = key === To_date_key(now);
          const hasShift = shifts.some((s) => s.shift_date === key);
          const isInCurrentMonth =
            View_mode === "month"
              ? day.getMonth() === Selected_date.getMonth()
              : true;

          return (
            <button
              key={key}
              type="button"
              className={`week-day${isSelected ? " week-day--active" : ""}${isDayToday ? " week-day--today" : ""}${hasShift ? " week-day--busy" : ""}${!isInCurrentMonth ? " week-day--muted" : ""}`}
              onClick={() => Set_selected_date(day)}
              aria-pressed={isSelected}
            >
              <span className="week-day__label">
                {WEEKDAYS[day.getDay()]}
              </span>
              <span className="week-day__num">{day.getDate()}</span>
              {hasShift && (
                <span className="shifts__week-day-dot" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* View toggle */}
      <div
        className="view-toggle animate-in animate-in--2"
        role="tablist"
        aria-label="Shifts view"
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

      {/* No Workplaces CTA */}
      {!Loading && Effective_workplaces.length === 0 && onNavigate && (
        <Empty_state
          className="animate-in animate-in--1"
          icon={(
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
          )}
          title="No Workplaces yet"
          text="Add a workplace first to start tracking your shifts."
          action={(
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onNavigate("Workplaces")}
            >
              + Add workplace
            </button>
          )}
        />
      )}

      {/* Place filter */}
      <Place_picker
        places={PLACES}
        placeFilters={PLACE_FILTERS}
        selectedPlaceId={Place_filter}
        onSelect={Select_place_filter}
        Is_mobile={Is_mobile}
        Picker_open={Place_picker_modal.open}
        Picker_closing={Place_picker_modal.closing}
        onOpenPicker={Open_place_picker}
        onClosePicker={Close_place_picker}
        indicator={Place_indicator}
        containerRef={Place_filter_ref}
      />

      <div
        className="shifts__summary animate-in animate-in--3"
        key={`${Selected_key}-${Place_filter}`}
      >
        <Glass_card
          value={`${totals.hours.toFixed(1)}h`}
          label="Hours"
          className="shifts__stat glass-stat"
        />
        <Glass_card
          value={Format_money(totals.pay)}
          label="Pay"
          className="shifts__stat glass-stat"
        />
        <Glass_card
          value={Format_money(totals.tips)}
          label="Tips"
          className="shifts__stat glass-stat"
        />
        <Glass_card
          value={Format_money(totals.total)}
          label="Total"
          className="shifts__stat glass-stat shifts__stat--total"
        />
      </div>

      {error && (
        <p className="error-box error-box--shake" role="alert">
          {error}
        </p>
      )}

      {/* Presets */}
      <Shift_presets
        Presets={Presets}
        Place_filter={Place_filter}
        onQuickAdd={Handle_quick_add_preset}
        onEditPreset={Open_preset_modal}
        on_add_preset={() => Open_preset_modal()}
        presetModalOpen={Preset_modal.open}
        presetModalClosing={Preset_modal.closing}
        onClosePresetModal={Close_preset_modal}
        Editing_preset={Editing_preset}
        Preset_form={Preset_form}
        Set_preset_form={Set_preset_form}
        places={PLACES}
        Deactivated_slugs={Deactivated_slugs}
        onSavePreset={Save_preset}
        onDeletePreset={Delete_preset}
      />

      <div className="list-header animate-in animate-in--4">
        <h2 className="list-header__title">
          {Day_title}
          {Place_filter !== "all" && (
            <span className="shifts__list-subtitle">
              {" "}
              · {PLACES[Place_filter]?.label}
            </span>
          )}
        </h2>
        <div className="shifts__header-actions">
          {onNavigate && (
            <button
              type="button"
              className="shifts__manage-link"
              onClick={() => onNavigate("Workplaces")}
              title="Manage Workplaces"
            >
              ⚙ Workplaces
            </button>
          )}
          <button
            type="button"
            className="list-header__add"
            onClick={Open_add_modal}
            ref={Add_btn_ref}
            disabled={Effective_workplaces.length === 0}
            title={
              Effective_workplaces.length === 0
                ? "Add a workplace first"
                : "Add a new shift"
            }
          >
            + Add shift
          </button>
        </div>
      </div>

      {Loading ? (
        <div className="shifts__list">
          <Loading_skeleton count={3} height="5.5rem" />
        </div>
      ) : Filtered_shifts.length === 0 ? (
        <Empty_state
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
            Effective_workplaces.length === 0
              ? "No Workplaces yet"
              : Place_filter === "all"
                ? "No shifts this week"
                : `No ${PLACES[Place_filter]?.label} shifts`
          }
          text={
            Effective_workplaces.length === 0
              ? "Add a workplace to start tracking shifts."
              : Place_filter === "all"
                ? 'Tap "+ Add shift" to log your first one.'
                : `No shifts logged for ${PLACES[Place_filter]?.label} this week.`
          }
          action={
            Effective_workplaces.length === 0 && onNavigate ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onNavigate("Workplaces")}
              >
                + Add workplace
              </button>
            ) : null
          }
        />
      ) : (
        <ul className="shifts__list" key={`list-${Place_filter}`}>
          {Filtered_shifts.map((shift, index) => (
            <Shift_card
              key={shift.id}
              shift={shift}
              places={PLACES}
              Deactivated_slugs={Deactivated_slugs}
              onEdit={Open_edit_modal}
              onCopy={Handle_copy_shift}
              onDelete={openDeleteModal}
              onToggleNote={Handle_toggle_note}
              Expanded_note_id={Expanded_note_id}
              isRemoving={Removing_id === shift.id}
              animDelay={`${index * 0.06}s`}
            />
          ))}
        </ul>
      )}

      {/* Shift form modal */}
      <Shift_form
        open={Form_modal.open}
        closing={Form_modal.closing}
        onClose={Close_form_modal}
        form={form}
        Set_form={Set_form}
        Editing_shift={Editing_shift}
        Saving={Saving}
        Field_errors={Field_errors}
        Field_states={Field_states}
        Shake_key={Shake_key}
        onFieldBlur={Handle_field_blur}
        onTimeChange={Handle_time_change}
        onHoursChange={Handle_hours_change}
        onSubmit={Handle_submit}
        onSaveAsPreset={Save_current_as_preset}
        places={PLACES}
        Deactivated_slugs={Deactivated_slugs}
        Is_form_valid={Is_form_valid}
      />

      {/* Delete confirmation */}
      <Shift_delete_confirm
        Delete_target={Delete_target}
        closing={Delete_modal.closing}
        onClose={Close_delete_modal}
        onConfirm={Confirm_delete}
        Deleting={Deleting}
        places={PLACES}
      />

      <FAB
        visible={Show_floating_actions}
        on_scroll_top={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        on_add={Open_add_modal}
        add_label="Add shift"
      />
    </section>
  );
}

export default Shifts;
