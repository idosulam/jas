import "./Profile.css";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { getSupabaseClient } from "../../../lib/superbase";
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
            <stop offset="0%" stopColor="rgba(99, 102, 241, 0.45)" />
            <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
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

function Profile() {
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
  const hasLoadedOnce = useRef(false);
  const [showFloatingActions, setShowFloatingActions] = useState(false);
  const logWeightBtnRef = useRef(null);
  const { success: toastSuccess, error: toastError } = useGlassToast();

  const fetchData = useCallback(async () => {
    // only show the full-page loading state the first time
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const [profileRes, entriesRes] = await Promise.all([
        supabase.from("profile").select("*").limit(1).maybeSingle(),
        supabase
          .from("weight_entries")
          .select("*")
          .order("entry_date", { ascending: true }),
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
  }, []);

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
    }, MODAL_EXIT_MS);
  };

  const closeProfileModal = () => {
    setProfileModalClosing(true);
    setTimeout(() => {
      setProfileModalOpen(false);
      setProfileModalClosing(false);
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

  const saveWeight = async (e) => {
    e.preventDefault();
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

    const payload = {
      entry_date: entryDate,
      weight_kg: Number(weightKg.toFixed(2)),
      notes: notes || null,
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
            .upsert(payload, { onConflict: "entry_date" });

      const { error: saveError } = await query;
      setSaving(false);

      if (saveError) {
        setError(getUserFacingError(saveError.message));
        toastError(
          editingEntry ? "Edit didn’t work." : "Upload event didn’t work.",
        );
        return;
      }

      closeWeightModal();
      toastSuccess(editingEntry ? "Edit was ok." : "Upload event was ok.");
      fetchData();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError(
        editingEntry ? "Edit didn’t work." : "Upload event didn’t work.",
      );
    }
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
        : await supabase.from("profile").insert(payload);

      setSaving(false);

      if (saveError) {
        setError(getUserFacingError(saveError.message));
        toastError("Save profile didn’t work.");
        return;
      }

      closeProfileModal();
      toastSuccess("Save profile was ok.");
      fetchData();
    } catch (err) {
      setSaving(false);
      setError(getUserFacingError(err.message));
      toastError("Save profile didn’t work.");
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
        toastError("Delete didn’t work.");
        fetchData(); // resync in case the optimistic update was wrong
        return;
      }

      toastSuccess("Delete was ok.");
      fetchData(); // quiet background resync, no loading flash now
    } catch (err) {
      setDeleting(false);
      setError(getUserFacingError(err.message));
      toastError("Delete didn’t work.");
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

  return (
    <section className="page ">
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
        <p className="profile__loading">Loading your stats…</p>
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
              <div className="profile__goal-bar-wrap">
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
                    style={{ width: `${analytics.goalProgress ?? 0}%` }}
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
                        ✎
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
                        ×
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
              className={`profile__modal${weightModalClosing ? " profile__modal--closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="weight-modal-title"
            >
              <h2 id="weight-modal-title" className="profile__modal-title">
                {editingEntry ? "Edit weigh-in" : "Log weigh-in"}
              </h2>
              <form className="profile__form" onSubmit={saveWeight}>
                <label className="profile__field">
                  Date
                  <input
                    type="date"
                    value={weightForm.entry_date}
                    onChange={(e) =>
                      setWeightForm((f) => ({
                        ...f,
                        entry_date: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <div className="profile__weight-row">
                  <label className="profile__field">
                    Weight (kg)
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="62.5"
                      value={weightForm.weight_kg}
                      onChange={(e) => handleWeightKgChange(e.target.value)}
                      required
                    />
                  </label>
                  <label className="profile__field">
                    Weight (lbs)
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="137.8"
                      value={weightForm.weight_lbs}
                      onChange={(e) => handleWeightLbsChange(e.target.value)}
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
                    disabled={saving}
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
                  Name
                  <input
                    type="text"
                    value={profileForm.display_name}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        display_name: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="profile__field">
                  Age
                  <input
                    type="number"
                    min="13"
                    max="120"
                    placeholder="26"
                    value={profileForm.age}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, age: e.target.value }))
                    }
                  />
                </label>
                <label className="profile__field">
                  Height (cm)
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    placeholder="165"
                    value={profileForm.height_cm}
                    onChange={(e) => handleHeightCmChange(e.target.value)}
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
                    Goal weight (kg)
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="58"
                      value={profileForm.goal_weight_kg}
                      onChange={(e) => handleGoalWeightKgChange(e.target.value)}
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
                    disabled={saving}
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
