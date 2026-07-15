import "./Profile.css";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { getSupabaseClient } from "../../../lib/superbase";
import { useUserId } from "../../../lib/AuthContext.jsx";
import {
  getUserFacingError,
  sanitizeDate,
  sanitizeNumber,
  sanitizeText,
} from "../../../lib/security";

import { useGlassToast } from "../../../lib/glass_toast_provider.jsx";

const UNIT_STORAGE_KEY = "profile_weight_unit";
const KG_TO_LBS = 2.20462;
const MODAL_EXIT_MS = 260;
const SWIPE_CLOSE_THRESHOLD = 110;

const emptyProfileForm = () => ({
  display_name: "Jas",
  age: "",
  height_cm: "",
  height_ft: "",
  height_in: "",
  goal_weight_kg: "",
  goal_weight_lbs: "",
  gender: "female",
});

const emptyWeightForm = () => ({
  entry_date: new Date().toISOString().slice(0, 10),
  weight_kg: "",
  weight_lbs: "",
  notes: "",
});

function loadUnit() {
  try {
    const stored = window.localStorage.getItem(UNIT_STORAGE_KEY);
    return stored === "lbs" ? "lbs" : "kg";
  } catch {
    return "kg";
  }
}

function toDisplayKg(kg, unit) {
  return unit === "lbs" ? kg * KG_TO_LBS : kg;
}

function fromDisplayToKg(value, unit) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return null;
  return unit === "lbs" ? n / KG_TO_LBS : n;
}

function formatWeight(value, unit, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)} ${unit}`;
}

function kgToLbs(kg) {
  const parsed = sanitizeNumber(kg, 1, 1000);
  return parsed != null ? Number((parsed * KG_TO_LBS).toFixed(1)) : null;
}

function lbsToKg(lbs) {
  const parsed = sanitizeNumber(lbs, 1, 2200);
  return parsed != null ? Number((parsed / KG_TO_LBS).toFixed(2)) : null;
}

function formatSignedDelta(delta, unit) {
  if (delta == null || Number.isNaN(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} ${unit}`;
}

function cmToFeetAndInches(heightCm) {
  if (heightCm == null || Number.isNaN(heightCm))
    return { feet: "", inches: "" };
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Number((totalInches % 12).toFixed(1));
  return { feet: String(feet), inches: String(inches) };
}

function feetAndInchesToCm(feet, inches) {
  const parsedFeet = sanitizeNumber(feet, 0, 9);
  const parsedInches = sanitizeNumber(inches, 0, 11.9);
  if (parsedFeet == null && parsedInches == null) return null;
  const totalInches = (parsedFeet ?? 0) * 12 + (parsedInches ?? 0);
  return Number((totalInches * 2.54).toFixed(2));
}
function useSwipeDownToClose(isOpen, isClosing, onClose) {
  const startYRef = useRef(0);
  const dragYRef = useRef(0);
  const draggingRef = useRef(false);
  const [dragY, setDragY] = useState(0);

  const resetDrag = useCallback(() => {
    dragYRef.current = 0;
    draggingRef.current = false;
    setDragY(0);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetDrag();
    }
  }, [isOpen, resetDrag]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerMove = (e) => {
      if (!draggingRef.current) return;

      const nextDrag = Math.max(0, e.clientY - startYRef.current);
      dragYRef.current = nextDrag;
      setDragY(nextDrag);
    };

    const handlePointerEnd = () => {
      if (!draggingRef.current) return;

      const shouldClose = dragYRef.current >= SWIPE_CLOSE_THRESHOLD;
      resetDrag();

      if (shouldClose) {
        onClose();
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [isOpen, onClose, resetDrag]);
  const bind = {
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      // Don't hijack interactive elements — capturing the pointer here
      // can swallow their click events (this is why Cancel/Save stopped working).
      if (e.target.closest("button, input, select, textarea, a, label")) {
        return;
      }

      startYRef.current = e.clientY;
      dragYRef.current = 0;
      draggingRef.current = true;

      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
  };
  return {
    bind,
    dragY,
    dragging: dragY > 0,
    style:
      dragY > 0 && !isClosing
        ? {
            transform: `translateY(${dragY}px)`,
            transition: "none",
          }
        : undefined,
  };
}

function formatHeight(heightCm) {
  if (heightCm == null || Number.isNaN(heightCm)) return null;
  const { feet, inches } = cmToFeetAndInches(heightCm);
  return `${Number(heightCm).toFixed(0)} cm · ${feet}'${inches}"`;
}

function calcBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function bmiLabel(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

function healthyWeightRangeKg(heightCm) {
  if (!heightCm) return null;
  const heightM = heightCm / 100;
  return {
    min: 18.5 * heightM * heightM,
    max: 24.9 * heightM * heightM,
  };
}

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysBetween(a, b) {
  const ms = new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`);
  return Math.max(1, Math.round(ms / 86400000));
}

function buildInsight({ age, weeklyChangeKg, bmi, goalProgress, isLosing }) {
  const parts = [];

  if (age) {
    parts.push(
      age < 30
        ? `At ${age}, your body typically recovers well from training — pair steady nutrition with rest days.`
        : age < 45
          ? `At ${age}, strength training helps preserve muscle while you cut — aim for protein at every meal.`
          : `At ${age}, slower, consistent progress protects joints and muscle — prioritize recovery alongside cardio.`,
    );
  }

  if (weeklyChangeKg != null && isLosing) {
    const abs = Math.abs(weeklyChangeKg);
    if (abs > 1) {
      parts.push(
        "Your weekly pace is aggressive — watch energy levels and consider a refeed day if workouts feel flat.",
      );
    } else if (abs >= 0.3) {
      parts.push(
        "You are losing at a sustainable rate for someone who trains — keep protein high to protect lean mass.",
      );
    } else if (abs > 0) {
      parts.push(
        "Progress is gradual, which is ideal for long-term results and performance in the gym.",
      );
    }
  }

  if (bmi != null) {
    const label = bmiLabel(bmi);
    if (label === "Healthy") {
      parts.push(
        "Your BMI sits in the healthy range — focus on body composition and strength, not just the scale.",
      );
    } else if (
      label === "Overweight" &&
      goalProgress != null &&
      goalProgress > 0
    ) {
      parts.push(
        "You are moving toward your goal — consistency beats perfection on rest days.",
      );
    }
  }

  return parts.length
    ? parts.join(" ")
    : "Log weigh-ins and set your profile to unlock personalized insights.";
}

function WeightChart({ entries, unit, goalKg }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date)),
    [entries],
  );

  const chart = useMemo(() => {
    if (sorted.length === 0) return null;

    const width = 320;
    const height = 160;
    const pad = { top: 16, right: 12, bottom: 28, left: 36 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const values = sorted.map((e) => toDisplayKg(Number(e.weight_kg), unit));
    const goalDisplay = goalKg != null ? toDisplayKg(goalKg, unit) : null;

    let minY = Math.min(...values);
    let maxY = Math.max(...values);
    if (goalDisplay != null) {
      minY = Math.min(minY, goalDisplay);
      maxY = Math.max(maxY, goalDisplay);
    }
    const padding = Math.max(1, (maxY - minY) * 0.15 || 2);
    minY -= padding;
    maxY += padding;

    const xScale = (i) =>
      pad.left +
      (sorted.length === 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW);
    const yScale = (v) =>
      pad.top + innerH - ((v - minY) / (maxY - minY)) * innerH;

    const points = sorted.map((entry, i) => ({
      x: xScale(i),
      y: yScale(toDisplayKg(Number(entry.weight_kg), unit)),
      date: entry.entry_date,
      value: toDisplayKg(Number(entry.weight_kg), unit),
    }));

    const linePath = points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      )
      .join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`;

    const yTicks = [minY, (minY + maxY) / 2, maxY];
    const xLabels =
      sorted.length <= 4
        ? sorted.map((e, i) => ({
            x: xScale(i),
            label: formatDateLabel(e.entry_date),
          }))
        : [0, Math.floor(sorted.length / 2), sorted.length - 1].map((i) => ({
            x: xScale(i),
            label: formatDateLabel(sorted[i].entry_date),
          }));

    const goalY = goalDisplay != null ? yScale(goalDisplay) : null;

    return {
      width,
      height,
      pad,
      innerH,
      points,
      linePath,
      areaPath,
      yTicks,
      xLabels,
      goalY,
      goalDisplay,
      minY,
      maxY,
    };
  }, [sorted, unit, goalKg]);

  if (!chart) {
    return (
      <div className="profile__chart-empty">
        <p>No weigh-ins yet</p>
        <span>Log your first entry to see your trend line.</span>
      </div>
    );
  }

  const hovered = hoverIndex != null ? chart.points[hoverIndex] : null;
  const tooltipLeftPct = hovered ? (hovered.x / chart.width) * 100 : 0;
  const tooltipTopPct = hovered ? (hovered.y / chart.height) * 100 : 0;
  // Flip tooltip below the dot if it's too close to the top edge
  const flipDown = hovered ? hovered.y < 34 : false;

  return (
    <div className="profile__chart-wrap">
      <svg
        className="profile__chart"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label={`Weight trend chart in ${unit}`}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="profileChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(16, 185, 129, 0.45)" />
            <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
          </linearGradient>
        </defs>

        {chart.yTicks.map((tick) => {
          const y =
            chart.pad.top +
            chart.innerH -
            ((tick - chart.minY) / (chart.maxY - chart.minY)) * chart.innerH;
          return (
            <g key={tick}>
              <line
                x1={chart.pad.left}
                y1={y}
                x2={chart.width - chart.pad.right}
                y2={y}
                className="profile__chart-grid"
              />
              <text
                x={chart.pad.left - 6}
                y={y + 4}
                className="profile__chart-axis"
                textAnchor="end"
              >
                {tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {chart.goalY != null && (
          <>
            <line
              x1={chart.pad.left}
              y1={chart.goalY}
              x2={chart.width - chart.pad.right}
              y2={chart.goalY}
              className="profile__chart-goal-line"
            />
            <text
              x={chart.width - chart.pad.right}
              y={chart.goalY - 6}
              className="profile__chart-goal-label"
              textAnchor="end"
            >
              Goal {chart.goalDisplay?.toFixed(1)}
            </text>
          </>
        )}

        <path d={chart.areaPath} fill="url(#profileChartFill)" />
        <path d={chart.linePath} className="profile__chart-line" fill="none" />

        {/* Vertical guide line for the hovered point */}
        {hovered && (
          <line
            x1={hovered.x}
            y1={chart.pad.top}
            x2={hovered.x}
            y2={chart.pad.top + chart.innerH}
            className="profile__chart-hover-guide"
          />
        )}

        {chart.points.map((p, i) => (
          <g key={p.date}>
            {/* Visible dot — animates on hover */}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 6.5 : 4.5}
              className={`profile__chart-dot${hoverIndex === i ? " profile__chart-dot--active" : ""}`}
            />
            {/* Larger invisible hit target so hovering feels forgiving */}
            <circle
              cx={p.x}
              cy={p.y}
              r="12"
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onFocus={() => setHoverIndex(i)}
              onBlur={() => setHoverIndex(null)}
              tabIndex={0}
              style={{ cursor: "pointer", outline: "none" }}
            />
          </g>
        ))}

        {chart.xLabels.map(({ x, label }) => (
          <text
            key={label + x}
            x={x}
            y={chart.height - 6}
            className="profile__chart-axis"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
      </svg>

      {hovered && (
        <div
          className={`profile__chart-tooltip${flipDown ? " profile__chart-tooltip--down" : ""}`}
          style={{
            left: `${tooltipLeftPct}%`,
            top: `${tooltipTopPct}%`,
          }}
        >
          <span className="profile__chart-tooltip-value">
            {hovered.value.toFixed(1)} {unit}
          </span>
          <span className="profile__chart-tooltip-date">
            {formatDateLabel(hovered.date)}
          </span>
        </div>
      )}
    </div>
  );
}

function Profile({ onNavigate }) {
  const userId = useUserId();
  const [removingId, setRemovingId] = useState(null);
  const [unit, setUnit] = useState(loadUnit);
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [weightModalClosing, setWeightModalClosing] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalClosing, setProfileModalClosing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteModalClosing, setDeleteModalClosing] = useState(false);

  const [weightForm, setWeightForm] = useState(emptyWeightForm);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [editingEntry, setEditingEntry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicateDateConfirm, setDuplicateDateConfirm] = useState(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState({});
  const [weightFieldErrors, setWeightFieldErrors] = useState({});
  const hasLoadedOnce = useRef(false);
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const logWeightBtnRef = useRef(null);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const fetchData = useCallback(async () => {
    if (!userId) return;

    // only show the full-page loading state the first time
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [profileRes, entriesRes] = await Promise.all([
        supabase.from("profile").select("*").eq("user_id", userId).limit(1).maybeSingle(),
        supabase.from("weight_entries").select("*").eq("user_id", userId).order("entry_date", { ascending: true }),
      ]);

      if (profileRes.error) {
        setError(getUserFacingError(profileRes.error.message));
        setProfile(null);
      } else {
        setProfile(profileRes.data);
      }

      if (entriesRes.error) {
        setError(getUserFacingError(entriesRes.error.message));
        setEntries([]);
      } else {
        setEntries(entriesRes.data ?? []);
      }
    } catch (err) {
      setError(getUserFacingError(err.message));
      setProfile(null);
      setEntries([]);
    }

    hasLoadedOnce.current = true;
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (weightModalOpen || profileModalOpen || deleteTarget) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [weightModalOpen, profileModalOpen, deleteTarget]);

  useEffect(() => {
    const target = logWeightBtnRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowFloatingActions(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const handleUnitChange = (nextUnit) => {
    setUnit(nextUnit);
    try {
      window.localStorage.setItem(UNIT_STORAGE_KEY, nextUnit);
    } catch {
      // Ignore storage access errors and keep the UI state intact.
    }
  };

  const closeWeightModal = () => {
    setWeightModalClosing(true);
    setTimeout(() => {
      setWeightModalOpen(false);
      setWeightModalClosing(false);
      setEditingEntry(null);
      setWeightForm(emptyWeightForm());
      setWeightFieldErrors({});
    }, MODAL_EXIT_MS);
  };

  const closeProfileModal = () => {
    setProfileModalClosing(true);
    setTimeout(() => {
      setProfileModalOpen(false);
      setProfileModalClosing(false);
      setProfileFieldErrors({});
    }, MODAL_EXIT_MS);
  };

  const closeDeleteModal = () => {
    setDeleteModalClosing(true);
    setTimeout(() => {
      setDeleteTarget(null);
      setDeleteModalClosing(false);
    }, MODAL_EXIT_MS);
  };

  const openAddWeight = () => {
    setEditingEntry(null);
    setWeightForm(emptyWeightForm());
    setWeightModalClosing(false);
    setWeightModalOpen(true);
  };

  const openEditWeight = (entry) => {
    const weightKg = Number(entry.weight_kg);
    setEditingEntry(entry);
    setWeightForm({
      entry_date: entry.entry_date,
      weight_kg: String(weightKg.toFixed(1)),
      weight_lbs: String(kgToLbs(weightKg)?.toFixed(1) ?? ""),
      notes: entry.notes ?? "",
    });
    setWeightModalClosing(false);
    setWeightModalOpen(true);
  };

  const openProfileEdit = () => {
    if (profile) {
      const heightCm =
        profile.height_cm != null ? Number(profile.height_cm) : null;
      const { feet, inches } = cmToFeetAndInches(heightCm);
      const goalKg =
        profile.goal_weight_kg != null ? Number(profile.goal_weight_kg) : null;
      setProfileForm({
        display_name: profile.display_name ?? "Jas",
        age: profile.age != null ? String(profile.age) : "",
        height_cm: heightCm != null ? String(heightCm) : "",
        height_ft: feet,
        height_in: inches,
        goal_weight_kg: goalKg != null ? String(goalKg.toFixed(1)) : "",
        goal_weight_lbs:
          goalKg != null ? String(kgToLbs(goalKg)?.toFixed(1) ?? "") : "",
        gender: profile.gender ?? "female",
      });
    } else {
      setProfileForm(emptyProfileForm());
    }
    setProfileModalClosing(false);
    setProfileModalOpen(true);
  };

  const handleHeightCmChange = (value) => {
    const cmValue = sanitizeNumber(value, 1, 300);
    const { feet, inches } = cmToFeetAndInches(cmValue);
    setProfileForm((current) => ({
      ...current,
      height_cm: value,
      height_ft: cmValue != null ? feet : "",
      height_in: cmValue != null ? inches : "",
    }));
  };

  const handleGoalWeightKgChange = (value) => {
    const kgValue = sanitizeNumber(value, 1, 1000);
    setProfileForm((current) => ({
      ...current,
      goal_weight_kg: value,
      goal_weight_lbs:
        kgValue != null ? String(kgToLbs(kgValue)?.toFixed(1) ?? "") : "",
    }));
  };

  const handleGoalWeightLbsChange = (value) => {
    const lbsValue = sanitizeNumber(value, 1, 2200);
    setProfileForm((current) => ({
      ...current,
      goal_weight_kg:
        lbsValue != null ? String(lbsToKg(lbsValue)?.toFixed(2) ?? "") : "",
      goal_weight_lbs: value,
    }));
  };

  const handleWeightKgChange = (value) => {
    const kgValue = sanitizeNumber(value, 1, 1000);
    setWeightForm((current) => ({
      ...current,
      weight_kg: value,
      weight_lbs:
        kgValue != null ? String(kgToLbs(kgValue)?.toFixed(1) ?? "") : "",
    }));
  };

  const handleWeightLbsChange = (value) => {
    const lbsValue = sanitizeNumber(value, 1, 2200);
    setWeightForm((current) => ({
      ...current,
      weight_kg:
        lbsValue != null ? String(lbsToKg(lbsValue)?.toFixed(2) ?? "") : "",
      weight_lbs: value,
    }));
  };

  const handleHeightImperialChange = (field, value) => {
    const nextState = {
      ...profileForm,
      [field]: value,
    };
    const convertedCm = feetAndInchesToCm(
      nextState.height_ft,
      nextState.height_in,
    );
    setProfileForm({
      ...nextState,
      height_cm: convertedCm != null ? String(convertedCm) : "",
    });
  };

  const performSaveWeight = async () => {
    const weightKg =
      sanitizeNumber(weightForm.weight_kg, 1, 1000) ??
      lbsToKg(weightForm.weight_lbs);
    const entryDate = sanitizeDate(
      weightForm.entry_date,
      emptyWeightForm().entry_date,
    );
    const notes = sanitizeText(weightForm.notes, 240);
    if (!weightKg || weightKg <= 0 || !entryDate) return;

    setSaving(true);
    setError(null);
    setDuplicateDateConfirm(null);

    const payload = {
      entry_date: entryDate,
      weight_kg: Number(weightKg.toFixed(2)),
      notes: notes || null,
      ...(userId && { user_id: userId }),
    };

    try {
      const supabase = getSupabaseClient();
      const query = editingEntry
        ? supabase
            .from("weight_entries")
            .update(payload)
            .eq("id", editingEntry.id)
        : supabase
            .from("weight_entries")
            .upsert(payload, { onConflict: "user_id,entry_date" });

      const { error: saveError } = await query;
      setSaving(false);

      if (saveError) {
        const rawMsg = saveError.message || "";
        // Supabase returns this when the unique constraint is missing
        if (/on conflict|no unique/i.test(rawMsg)) {
          const existing = entries.find((e) => e.entry_date === entryDate);
          if (existing) {
            setDuplicateDateConfirm({
              existingEntry: existing,
              newWeight: weightKg,
              newNotes: notes,
            });
            return;
          }
        }
        const friendly = /permission|duplicate|conflict/i.test(rawMsg)
          ? `Could not save — there's already an entry for ${formatDateLabel(entryDate)}. Edit the existing one instead.`
          : getUserFacingError(rawMsg);
        setError(friendly);
        toastError(friendly);
        return;
      }

      const isUpdate = !!editingEntry || !!duplicateDateConfirm;
      closeWeightModal();
      toastSuccess(
        isUpdate
          ? `Weight updated for ${formatDateLabel(entryDate)}.`
          : `Weight logged for ${formatDateLabel(entryDate)}.`,
      );
      fetchData();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError("Something went wrong. Please try again.");
    }
  };

  const isWeightFormValid = useMemo(() => {
    if (!weightForm.entry_date) return false;
    const weightKg =
      sanitizeNumber(weightForm.weight_kg, 1, 1000) ??
      lbsToKg(weightForm.weight_lbs);
    if (!weightKg || weightKg <= 0) return false;
    return true;
  }, [weightForm]);

  const isProfileFormValid = useMemo(() => {
    if (!profileForm.display_name || !profileForm.display_name.trim())
      return false;
    const age = sanitizeNumber(profileForm.age, 13, 120);
    if (profileForm.age && age == null) return false;
    return true;
  }, [profileForm]);

  const validateProfileField = (fieldName) => {
    switch (fieldName) {
      case "display_name": {
        if (!profileForm.display_name || !profileForm.display_name.trim())
          return "Name is required";
        if (profileForm.display_name.trim().length > 40)
          return "Max 40 characters";
        return null;
      }
      case "age": {
        if (!profileForm.age) return null; // age is optional
        const age = sanitizeNumber(profileForm.age, 13, 120);
        if (age == null) return "Enter a valid age (13–120)";
        return null;
      }
      case "height_cm": {
        if (!profileForm.height_cm) return null; // optional
        const cm = sanitizeNumber(profileForm.height_cm, 1, 300);
        if (cm == null) return "Enter a valid height";
        return null;
      }
      case "goal_weight_kg": {
        if (!profileForm.goal_weight_kg) return null; // optional
        const kg = sanitizeNumber(profileForm.goal_weight_kg, 1, 1000);
        if (kg == null) return "Enter a valid weight";
        return null;
      }
      default:
        return null;
    }
  };

  const handleProfileFieldBlur = (fieldName) => {
    const error = validateProfileField(fieldName);
    setProfileFieldErrors((prev) => ({ ...prev, [fieldName]: error }));
  };

  const validateWeightField = (fieldName) => {
    switch (fieldName) {
      case "entry_date": {
        if (!weightForm.entry_date) return "Pick a date";
        return null;
      }
      case "weight_kg": {
        if (!weightForm.weight_kg && !weightForm.weight_lbs)
          return "Enter your weight";
        const kg = sanitizeNumber(weightForm.weight_kg, 1, 1000);
        if (weightForm.weight_kg && kg == null)
          return "Must be between 1 and 1000";
        return null;
      }
      case "weight_lbs": {
        if (!weightForm.weight_lbs && !weightForm.weight_kg)
          return "Enter your weight";
        const lbs = sanitizeNumber(weightForm.weight_lbs, 1, 2200);
        if (weightForm.weight_lbs && lbs == null)
          return "Must be between 1 and 2200";
        return null;
      }
      default:
        return null;
    }
  };

  const handleWeightFieldBlur = (fieldName) => {
    const error = validateWeightField(fieldName);
    setWeightFieldErrors((prev) => ({ ...prev, [fieldName]: error }));
  };

  const saveWeight = async (e) => {
    e.preventDefault();
    const weightKg =
      sanitizeNumber(weightForm.weight_kg, 1, 1000) ??
      lbsToKg(weightForm.weight_lbs);
    const entryDate = sanitizeDate(
      weightForm.entry_date,
      emptyWeightForm().entry_date,
    );
    if (!weightKg || weightKg <= 0 || !entryDate) return;

    // If adding (not editing), check for an existing entry on the same date
    if (!editingEntry) {
      const existing = entries.find((e) => e.entry_date === entryDate);
      if (existing) {
        setDuplicateDateConfirm({
          existingEntry: existing,
          newWeight: weightKg,
          newNotes: sanitizeText(weightForm.notes, 240),
        });
        return;
      }
    }

    performSaveWeight();
  };

  const confirmDuplicateSave = () => {
    // User confirmed — switch to edit mode on the existing entry
    if (duplicateDateConfirm?.existingEntry) {
      setEditingEntry(duplicateDateConfirm.existingEntry);
    }
    performSaveWeight();
  };

  const closeDuplicateConfirm = () => {
    setDuplicateDateConfirm(null);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const goalKg =
      sanitizeNumber(profileForm.goal_weight_kg, 1, 1000) ??
      lbsToKg(profileForm.goal_weight_lbs);
    const displayName = sanitizeText(profileForm.display_name, 40) || "Jas";
    const age = sanitizeNumber(profileForm.age, 13, 120);
    const heightCmFromCm = sanitizeNumber(profileForm.height_cm, 1, 300);
    const heightCmFromImperial = feetAndInchesToCm(
      profileForm.height_ft,
      profileForm.height_in,
    );
    const heightCm = heightCmFromCm ?? heightCmFromImperial;
    const gender = ["female", "male", "other"].includes(profileForm.gender)
      ? profileForm.gender
      : null;

    const payload = {
      display_name: displayName,
      age,
      height_cm: heightCm ?? null,
      goal_weight_kg: goalKg ? Number(goalKg.toFixed(2)) : null,
      gender,
      updated_at: new Date().toISOString(),
    };

    try {
      const supabase = getSupabaseClient();
      const { error: saveError } = profile
        ? await supabase.from("profile").update(payload).eq("id", profile.id)
        : await supabase.from("profile").insert({ ...payload, ...(userId && { user_id: userId }) });

      setSaving(false);

      if (saveError) {
        setError(getUserFacingError(saveError.message));
        toastError("Couldn't save profile.");
        return;
      }

      closeProfileModal();
      toastSuccess("Profile saved.");
      fetchData();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError("Couldn't save profile.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;

    setDeleting(true);
    setRemovingId(targetId);
    closeDeleteModal();

    // wait for the exit animation, then optimistically remove it
    await new Promise((resolve) => setTimeout(resolve, 240));
    setEntries((prev) => prev.filter((e) => e.id !== targetId));
    setRemovingId(null);

    try {
      const supabase = getSupabaseClient();
      const { error: deleteError } = await supabase
        .from("weight_entries")
        .delete()
        .eq("id", targetId);

      setDeleting(false);

      if (deleteError) {
        setError(getUserFacingError(deleteError.message));
        toastError("Failed to delete weight entry.");
        fetchData(); // resync in case the optimistic update was wrong
        return;
      }

      toastSuccess("Entry deleted.");
      fetchData(); // quiet background resync, no loading flash now
    } catch (err) {
      setDeleting(false);
      setError(getUserFacingError(err.message));
      toastError("Couldn't delete entry.");
      fetchData();
    }
  };

  const analytics = useMemo(() => {
    const sorted = [...entries].sort((a, b) =>
      a.entry_date.localeCompare(b.entry_date),
    );
    const latest = sorted[sorted.length - 1];
    const first = sorted[0];
    const heightCm = profile?.height_cm ? Number(profile.height_cm) : null;
    const goalKg = profile?.goal_weight_kg
      ? Number(profile.goal_weight_kg)
      : null;
    const age = profile?.age ? Number(profile.age) : null;

    const currentKg = latest ? Number(latest.weight_kg) : null;
    const startKg = first ? Number(first.weight_kg) : null;
    const totalChangeKg =
      currentKg != null && startKg != null && sorted.length > 1
        ? currentKg - startKg
        : null;

    let weeklyChangeKg = null;
    if (sorted.length >= 2 && totalChangeKg != null) {
      const spanDays = daysBetween(first.entry_date, latest.entry_date);
      weeklyChangeKg = (totalChangeKg / spanDays) * 7;
    }

    const bmi = calcBmi(currentKg, heightCm);
    const range = healthyWeightRangeKg(heightCm);

    let goalProgress = null;
    let remainingKg = null;
    if (
      currentKg != null &&
      goalKg != null &&
      startKg != null &&
      startKg !== goalKg
    ) {
      const totalNeeded = startKg - goalKg;
      const done = startKg - currentKg;
      goalProgress = Math.min(100, Math.max(0, (done / totalNeeded) * 100));
      remainingKg = currentKg - goalKg;
    }

    const insight = buildInsight({
      age,
      weeklyChangeKg,
      bmi,
      goalProgress,
      isLosing: totalChangeKg != null && totalChangeKg < 0,
    });

    return {
      currentKg,
      startKg,
      totalChangeKg,
      weeklyChangeKg,
      bmi,
      bmiCategory: bmiLabel(bmi),
      range,
      goalProgress,
      remainingKg,
      goalKg,
      heightCm,
      age,
      insight,
      sorted,
    };
  }, [entries, profile]);

  const displayName = profile?.display_name ?? "Jas";
  const unitLabel = unit === "kg" ? "kg" : "lbs";

  const weightSwipe = useSwipeDownToClose(
    weightModalOpen,
    weightModalClosing,
    closeWeightModal,
  );

  const profileSwipe = useSwipeDownToClose(
    profileModalOpen,
    profileModalClosing,
    closeProfileModal,
  );

  const deleteSwipe = useSwipeDownToClose(
    Boolean(deleteTarget),
    deleteModalClosing,
    closeDeleteModal,
  );
  return (
    <section>
      <header className="profile__header">
        <div className="profile__avatar" aria-hidden="true">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <p className="page__eyebrow">Your progress</p>
        <h1 className="page__title">{displayName}</h1>
        <p className="page__subtitle">
          Weight loss analytics tuned for your training.
        </p>

        <div
          className="profile__unit-toggle"
          role="group"
          aria-label="Weight unit"
        >
          <span
            className={`profile__unit-indicator profile__unit-indicator--${unit}`}
            aria-hidden="true"
          />
          <button
            type="button"
            className={`profile__unit-btn${unit === "kg" ? " profile__unit-btn--active" : ""}`}
            onClick={() => handleUnitChange("kg")}
            aria-pressed={unit === "kg"}
          >
            kg
          </button>
          <button
            type="button"
            className={`profile__unit-btn${unit === "lbs" ? " profile__unit-btn--active" : ""}`}
            onClick={() => handleUnitChange("lbs")}
            aria-pressed={unit === "lbs"}
          >
            lbs
          </button>
        </div>
      </header>

      {error && (
        <p className="profile__error profile__error--glass" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="profile__summary">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton--stat" />
          ))}
          <div style={{ gridColumn: "span 2" }}>
            <div
              className="skeleton skeleton--card"
              style={{ height: "10rem", marginTop: "1rem" }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="profile__summary">
            <article className="glass-card profile__stat">
              <span className="glass-card__value">
                {formatWeight(
                  analytics.currentKg != null
                    ? toDisplayKg(analytics.currentKg, unit)
                    : null,
                  unitLabel,
                )}
              </span>
              <span className="glass-card__label">Current weight</span>
            </article>
            <article className="glass-card profile__stat">
              <span
                className={`glass-card__value${analytics.totalChangeKg != null && analytics.totalChangeKg < 0 ? " profile__stat-value--good" : ""}`}
              >
                {analytics.totalChangeKg != null
                  ? formatSignedDelta(
                      toDisplayKg(analytics.totalChangeKg, unit),
                      unitLabel,
                    )
                  : "—"}
              </span>
              <span className="glass-card__label">Total change</span>
            </article>
            <article className="glass-card profile__stat">
              <span className="glass-card__value">
                {analytics.weeklyChangeKg != null
                  ? formatSignedDelta(
                      toDisplayKg(analytics.weeklyChangeKg, unit),
                      `${unitLabel}/wk`,
                    )
                  : "—"}
              </span>
              <span className="glass-card__label">Weekly pace</span>
            </article>
            <article className="glass-card profile__stat">
              <span className="glass-card__value">
                {analytics.bmi != null ? analytics.bmi.toFixed(1) : "—"}
              </span>
              <span className="glass-card__label">
                BMI{analytics.bmiCategory ? ` · ${analytics.bmiCategory}` : ""}
              </span>
            </article>
          </div>

          <section
            className="profile__panel"
            aria-labelledby="profile-chart-title"
          >
            <div className="profile__panel-head">
              <h2 id="profile-chart-title" className="profile__panel-title">
                Weight trend
              </h2>
              <button
                type="button"
                className="profile__text-btn"
                onClick={openAddWeight}
                ref={logWeightBtnRef}
              >
                + Log weight
              </button>
            </div>
            <WeightChart
              entries={entries}
              unit={unit}
              goalKg={analytics.goalKg}
            />
          </section>

          {analytics.goalKg != null && analytics.currentKg != null && (
            <section
              className="profile__panel"
              aria-labelledby="profile-goal-title"
            >
              <h2 id="profile-goal-title" className="profile__panel-title">
                Goal progress
              </h2>
              <div
                className={`profile__goal-bar-wrap${analytics.remainingKg != null && analytics.remainingKg <= 0 ? " profile__goal-reached" : ""}`}
              >
                <div
                  className="profile__goal-bar"
                  role="progressbar"
                  aria-valuenow={Math.round(analytics.goalProgress ?? 0)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progress toward goal weight"
                >
                  <div
                    className="profile__goal-bar-fill"
                    style={{
                      width: `${Math.min(analytics.goalProgress ?? 0, 100)}%`,
                    }}
                  />
                </div>
                <div className="profile__goal-meta">
                  <span>
                    Target{" "}
                    <strong>
                      {formatWeight(
                        toDisplayKg(analytics.goalKg, unit),
                        unitLabel,
                      )}
                    </strong>
                  </span>
                  {analytics.remainingKg != null && (
                    <span>
                      {analytics.remainingKg > 0
                        ? `${formatWeight(toDisplayKg(analytics.remainingKg, unit), unitLabel)} to go`
                        : "🎉 Goal reached!"}
                    </span>
                  )}
                </div>
                {analytics.remainingKg != null &&
                  analytics.remainingKg <= 0 && (
                    <div className="profile__celebration" aria-hidden="true">
                      {[...Array(12)].map((_, i) => (
                        <span
                          key={i}
                          className={`profile__confetti profile__confetti--${i % 6}`}
                          style={{ animationDelay: `${i * 0.1}s` }}
                        />
                      ))}
                    </div>
                  )}
              </div>
            </section>
          )}

          <section
            className="profile__panel profile__insight"
            aria-labelledby="profile-insight-title"
          >
            <h2 id="profile-insight-title" className="profile__panel-title">
              Training insight
            </h2>
            <p className="profile__insight-text">{analytics.insight}</p>
            {analytics.range && analytics.heightCm && (
              <p className="profile__insight-meta">
                Healthy weight for your height:{" "}
                <strong>
                  {formatWeight(
                    toDisplayKg(analytics.range.min, unit),
                    unitLabel,
                    0,
                  )}
                  {" – "}
                  {formatWeight(
                    toDisplayKg(analytics.range.max, unit),
                    unitLabel,
                    0,
                  )}
                </strong>
                {analytics.age ? ` · Age ${analytics.age}` : ""}
              </p>
            )}
            {analytics.heightCm && (
              <p className="profile__insight-meta">
                Height: {formatHeight(analytics.heightCm)}
              </p>
            )}
            {!analytics.heightCm && (
              <button
                type="button"
                className="profile__link-btn"
                onClick={openProfileEdit}
              >
                Add height & goal for BMI and range
              </button>
            )}
          </section>

          <section
            className="profile__panel"
            aria-labelledby="profile-history-title"
          >
            <div className="profile__panel-head">
              <h2 id="profile-history-title" className="profile__panel-title">
                Weight history
              </h2>
              <button
                type="button"
                className="profile__text-btn"
                onClick={openProfileEdit}
              >
                Edit profile
              </button>
              {onNavigate && (
                <button
                  type="button"
                  className="profile__text-btn"
                  onClick={() => onNavigate("Workplaces")}
                >
                  ⚙ Workplaces
                </button>
              )}
            </div>
            {analytics.sorted.length === 0 ? (
              <p className="profile__empty">
                No entries yet — log your first weigh-in above.
              </p>
            ) : (
              <ul className="profile__history">
                {[...analytics.sorted].map((entry) => (
                  <li
                    key={entry.id}
                    className={`profile__history-item${
                      removingId === entry.id
                        ? " profile__history-item--removing"
                        : ""
                    }`}
                  >
                    {" "}
                    <div>
                      <span className="profile__history-date">
                        {formatDateLabel(entry.entry_date)}
                      </span>
                      {entry.notes && (
                        <span className="profile__history-note">
                          {entry.notes}
                        </span>
                      )}
                    </div>
                    <div className="profile__history-actions">
                      <span className="profile__history-weight">
                        {formatWeight(
                          toDisplayKg(Number(entry.weight_kg), unit),
                          unitLabel,
                        )}
                      </span>
                      <button
                        type="button"
                        className="profile__icon-btn"
                        onClick={() => openEditWeight(entry)}
                        aria-label="Edit weigh-in"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="profile__icon-btn profile__icon-btn--danger"
                        onClick={() => {
                          setDeleteTarget(entry);
                          setDeleteModalClosing(false);
                        }}
                        aria-label="Delete weigh-in"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {weightModalOpen &&
        createPortal(
          <div
            className={`profile__overlay${weightModalClosing ? " profile__overlay--closing" : ""}`}
            onClick={closeWeightModal}
            role="presentation"
          >
            <div
              className={`profile__modal${weightModalClosing ? " profile__modal--closing" : ""}${weightSwipe.dragging ? " profile__modal--dragging" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="weight-modal-title"
              {...weightSwipe.bind}
              style={weightSwipe.style}
            >
              <h2 id="weight-modal-title" className="profile__modal-title">
                {editingEntry ? "Edit weigh-in" : "Log weigh-in"}
              </h2>
              <form className="profile__form" onSubmit={saveWeight}>
                <label className="profile__field">
                  Date{" "}
                  {weightFieldErrors.entry_date && (
                    <span className="profile__field-error-text">
                      —{weightFieldErrors.entry_date}
                    </span>
                  )}
                  <input
                    type="date"
                    value={weightForm.entry_date}
                    onChange={(e) => {
                      setWeightForm((f) => ({
                        ...f,
                        entry_date: e.target.value,
                      }));
                      setWeightFieldErrors((prev) => ({
                        ...prev,
                        entry_date: null,
                      }));
                    }}
                    onBlur={() => handleWeightFieldBlur("entry_date")}
                    className={
                      weightFieldErrors.entry_date ? "profile__field-error" : ""
                    }
                    required
                  />
                </label>
                <div className="profile__weight-row">
                  <label className="profile__field">
                    Weight (kg){" "}
                    {weightFieldErrors.weight_kg && (
                      <span className="profile__field-error-text">
                        —{weightFieldErrors.weight_kg}
                      </span>
                    )}
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="62.5"
                      value={weightForm.weight_kg}
                      onChange={(e) => {
                        handleWeightKgChange(e.target.value);
                        setWeightFieldErrors((prev) => ({
                          ...prev,
                          weight_kg: null,
                          weight_lbs: null,
                        }));
                      }}
                      onBlur={() => handleWeightFieldBlur("weight_kg")}
                      className={
                        weightFieldErrors.weight_kg
                          ? "profile__field-error"
                          : ""
                      }
                      required
                    />
                  </label>
                  <label className="profile__field">
                    Weight (lbs){" "}
                    {weightFieldErrors.weight_lbs && (
                      <span className="profile__field-error-text">
                        —{weightFieldErrors.weight_lbs}
                      </span>
                    )}
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="137.8"
                      value={weightForm.weight_lbs}
                      onChange={(e) => {
                        handleWeightLbsChange(e.target.value);
                        setWeightFieldErrors((prev) => ({
                          ...prev,
                          weight_lbs: null,
                          weight_kg: null,
                        }));
                      }}
                      onBlur={() => handleWeightFieldBlur("weight_lbs")}
                      className={
                        weightFieldErrors.weight_lbs
                          ? "profile__field-error"
                          : ""
                      }
                      required
                    />
                  </label>
                </div>
                <label className="profile__field">
                  Notes <span className="profile__optional">(optional)</span>
                  <input
                    type="text"
                    placeholder="Post-leg day, morning fasted…"
                    value={weightForm.notes}
                    onChange={(e) =>
                      setWeightForm((f) => ({ ...f, notes: e.target.value }))
                    }
                  />
                </label>
                <div className="profile__modal-actions">
                  <button
                    type="button"
                    className="profile__btn profile__btn--ghost"
                    onClick={closeWeightModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="profile__btn profile__btn--primary"
                    disabled={saving || !isWeightFormValid}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {profileModalOpen &&
        createPortal(
          <div
            className={`profile__overlay${profileModalClosing ? " profile__overlay--closing" : ""}`}
            onClick={closeProfileModal}
            role="presentation"
          >
            <div
              className={`profile__modal${profileModalClosing ? " profile__modal--closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-modal-title"
            >
              <h2 id="profile-modal-title" className="profile__modal-title">
                Edit profile
              </h2>
              <form className="profile__form" onSubmit={saveProfile}>
                <label className="profile__field">
                  Name{" "}
                  {profileFieldErrors.display_name && (
                    <span className="profile__field-error-text">
                      —{profileFieldErrors.display_name}
                    </span>
                  )}
                  <input
                    type="text"
                    value={profileForm.display_name}
                    onChange={(e) => {
                      setProfileForm((f) => ({
                        ...f,
                        display_name: e.target.value,
                      }));
                      setProfileFieldErrors((prev) => ({
                        ...prev,
                        display_name: null,
                      }));
                    }}
                    onBlur={() => handleProfileFieldBlur("display_name")}
                    className={
                      profileFieldErrors.display_name
                        ? "profile__field-error"
                        : ""
                    }
                  />
                </label>
                <label className="profile__field">
                  Age{" "}
                  {profileFieldErrors.age && (
                    <span className="profile__field-error-text">
                      —{profileFieldErrors.age}
                    </span>
                  )}
                  <input
                    type="number"
                    min="13"
                    max="120"
                    placeholder="26"
                    value={profileForm.age}
                    onChange={(e) => {
                      setProfileForm((f) => ({ ...f, age: e.target.value }));
                      setProfileFieldErrors((prev) => ({ ...prev, age: null }));
                    }}
                    onBlur={() => handleProfileFieldBlur("age")}
                    className={
                      profileFieldErrors.age ? "profile__field-error" : ""
                    }
                  />
                </label>
                <label className="profile__field">
                  Height (cm){" "}
                  {profileFieldErrors.height_cm && (
                    <span className="profile__field-error-text">
                      —{profileFieldErrors.height_cm}
                    </span>
                  )}
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    placeholder="165"
                    value={profileForm.height_cm}
                    onChange={(e) => {
                      handleHeightCmChange(e.target.value);
                      setProfileFieldErrors((prev) => ({
                        ...prev,
                        height_cm: null,
                      }));
                    }}
                    onBlur={() => handleProfileFieldBlur("height_cm")}
                    className={
                      profileFieldErrors.height_cm ? "profile__field-error" : ""
                    }
                  />
                </label>
                <div className="profile__height-row">
                  <label className="profile__field">
                    Feet
                    <input
                      type="number"
                      min="0"
                      max="9"
                      placeholder="5"
                      value={profileForm.height_ft}
                      onChange={(e) =>
                        handleHeightImperialChange("height_ft", e.target.value)
                      }
                    />
                  </label>
                  <label className="profile__field">
                    Inches
                    <input
                      type="number"
                      min="0"
                      max="11"
                      step="0.1"
                      placeholder="5"
                      value={profileForm.height_in}
                      onChange={(e) =>
                        handleHeightImperialChange("height_in", e.target.value)
                      }
                    />
                  </label>
                </div>
                <div className="profile__weight-row">
                  <label className="profile__field">
                    Goal weight (kg){" "}
                    {profileFieldErrors.goal_weight_kg && (
                      <span className="profile__field-error-text">
                        —{profileFieldErrors.goal_weight_kg}
                      </span>
                    )}
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="58"
                      value={profileForm.goal_weight_kg}
                      onChange={(e) => {
                        handleGoalWeightKgChange(e.target.value);
                        setProfileFieldErrors((prev) => ({
                          ...prev,
                          goal_weight_kg: null,
                        }));
                      }}
                      onBlur={() => handleProfileFieldBlur("goal_weight_kg")}
                      className={
                        profileFieldErrors.goal_weight_kg
                          ? "profile__field-error"
                          : ""
                      }
                    />
                  </label>
                  <label className="profile__field">
                    Goal weight (lbs)
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="128"
                      value={profileForm.goal_weight_lbs}
                      onChange={(e) =>
                        handleGoalWeightLbsChange(e.target.value)
                      }
                    />
                  </label>
                </div>
                <label className="profile__field">
                  Gender
                  <select
                    value={profileForm.gender}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, gender: e.target.value }))
                    }
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <p className="profile__form-hint">
                  Enter height in centimeters or feet and inches. Weight fields
                  follow your {unitLabel} toggle.
                </p>
                <div className="profile__modal-actions">
                  <button
                    type="button"
                    className="profile__btn profile__btn--ghost"
                    onClick={closeProfileModal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="profile__btn profile__btn--primary"
                    disabled={saving || !isProfileFormValid}
                  >
                    {saving ? "Saving…" : "Save profile"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {deleteTarget &&
        createPortal(
          <div
            className={`profile__overlay${deleteModalClosing ? " profile__overlay--closing" : ""}`}
            onClick={closeDeleteModal}
            role="presentation"
          >
            <div
              className={`profile__modal profile__modal--compact${deleteModalClosing ? " profile__modal--closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
            >
              <h2 id="delete-modal-title" className="profile__modal-title">
                Delete weigh-in?
              </h2>
              <p className="profile__delete-text">
                Remove {formatDateLabel(deleteTarget.entry_date)} (
                {formatWeight(
                  toDisplayKg(Number(deleteTarget.weight_kg), unit),
                  unitLabel,
                )}
                )?
              </p>
              <div className="profile__modal-actions">
                <button
                  type="button"
                  className="profile__btn profile__btn--ghost"
                  onClick={closeDeleteModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="profile__btn profile__btn--danger"
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {duplicateDateConfirm &&
        createPortal(
          <div
            className="profile__overlay"
            onClick={closeDuplicateConfirm}
            role="presentation"
          >
            <div
              className="profile__modal profile__modal--compact"
              onClick={(e) => e.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="dup-date-title"
            >
              <div className="profile__dup-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              </div>
              <h2 id="dup-date-title" className="profile__modal-title">
                Already logged for{" "}
                {formatDateLabel(duplicateDateConfirm.existingEntry.entry_date)}
              </h2>
              <p className="profile__dup-desc">
                You have{" "}
                <strong>
                  {formatWeight(
                    toDisplayKg(
                      Number(duplicateDateConfirm.existingEntry.weight_kg),
                      unit,
                    ),
                    unitLabel,
                  )}
                </strong>{" "}
                recorded for this day.
              </p>
              <p className="profile__dup-desc">
                Updating to{" "}
                <strong>
                  {formatWeight(
                    toDisplayKg(duplicateDateConfirm.newWeight, unit),
                    unitLabel,
                  )}
                </strong>
                ?
              </p>
              <div className="profile__modal-actions">
                <button
                  type="button"
                  className="profile__btn profile__btn--ghost"
                  onClick={closeDuplicateConfirm}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="profile__btn profile__btn--primary"
                  onClick={confirmDuplicateSave}
                  disabled={saving}
                >
                  {saving ? "Updating…" : "Update entry"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showFloatingActions &&
        createPortal(
          <div className="profile__fab-stack">
            <button
              type="button"
              className="profile__fab profile__fab--up"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Scroll to top"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  d="M12 19V5M5 12l7-7 7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="profile__fab profile__fab--add"
              onClick={openAddWeight}
              aria-label="Log weight"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  d="M12 5v14M5 12h14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>,
          document.body,
        )}
    </section>
  );
}

export default Profile;
