import "./Profile.css";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../../../lib/superbase";

const UNIT_STORAGE_KEY = "profile_weight_unit";
const KG_TO_LBS = 2.20462;
const MODAL_EXIT_MS = 260;

const emptyProfileForm = () => ({
  display_name: "Jas",
  age: "",
  height_cm: "",
  goal_weight_kg: "",
  gender: "female",
});

const emptyWeightForm = () => ({
  entry_date: new Date().toISOString().slice(0, 10),
  weight: "",
  notes: "",
});

function loadUnit() {
  const stored = localStorage.getItem(UNIT_STORAGE_KEY);
  return stored === "lbs" ? "lbs" : "kg";
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

function formatSignedDelta(delta, unit) {
  if (delta == null || Number.isNaN(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} ${unit}`;
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

  const fetchData = useCallback(async () => {
    // only show the full-page loading state the first time
    if (!hasLoadedOnce.current) {
      setLoading(true);
    }
    setError(null);

    const [profileRes, entriesRes] = await Promise.all([
      supabase.from("profile").select("*").limit(1).maybeSingle(),
      supabase
        .from("weight_entries")
        .select("*")
        .order("entry_date", { ascending: true }),
    ]);

    if (profileRes.error) {
      setError(profileRes.error.message);
      setProfile(null);
    } else {
      setProfile(profileRes.data);
    }

    if (entriesRes.error) {
      setError(entriesRes.error.message);
      setEntries([]);
    } else {
      setEntries(entriesRes.data ?? []);
    }

    hasLoadedOnce.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUnitChange = (nextUnit) => {
    setUnit(nextUnit);
    localStorage.setItem(UNIT_STORAGE_KEY, nextUnit);
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
    setEditingEntry(entry);
    setWeightForm({
      entry_date: entry.entry_date,
      weight: String(toDisplayKg(Number(entry.weight_kg), unit).toFixed(1)),
      notes: entry.notes ?? "",
    });
    setWeightModalClosing(false);
    setWeightModalOpen(true);
  };

  const openProfileEdit = () => {
    if (profile) {
      setProfileForm({
        display_name: profile.display_name ?? "Jas",
        age: profile.age != null ? String(profile.age) : "",
        height_cm: profile.height_cm != null ? String(profile.height_cm) : "",
        goal_weight_kg:
          profile.goal_weight_kg != null
            ? String(
                toDisplayKg(Number(profile.goal_weight_kg), unit).toFixed(1),
              )
            : "",
        gender: profile.gender ?? "female",
      });
    } else {
      setProfileForm(emptyProfileForm());
    }
    setProfileModalClosing(false);
    setProfileModalOpen(true);
  };

  const saveWeight = async (e) => {
    e.preventDefault();
    const weightKg = fromDisplayToKg(weightForm.weight, unit);
    if (!weightKg || weightKg <= 0) return;

    setSaving(true);
    setError(null);

    const payload = {
      entry_date: weightForm.entry_date,
      weight_kg: Number(weightKg.toFixed(2)),
      notes: weightForm.notes.trim() || null,
    };

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
      setError(saveError.message);
      return;
    }

    closeWeightModal();
    fetchData();
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const goalKg = profileForm.goal_weight_kg
      ? fromDisplayToKg(profileForm.goal_weight_kg, unit)
      : null;

    const payload = {
      display_name: profileForm.display_name.trim() || "Jas",
      age: profileForm.age ? parseInt(profileForm.age, 10) : null,
      height_cm: profileForm.height_cm
        ? parseFloat(profileForm.height_cm)
        : null,
      goal_weight_kg: goalKg ? Number(goalKg.toFixed(2)) : null,
      gender: profileForm.gender || null,
      updated_at: new Date().toISOString(),
    };

    const { error: saveError } = profile
      ? await supabase.from("profile").update(payload).eq("id", profile.id)
      : await supabase.from("profile").insert(payload);

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    closeProfileModal();
    fetchData();
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

    const { error: deleteError } = await supabase
      .from("weight_entries")
      .delete()
      .eq("id", targetId);

    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      fetchData(); // resync in case the optimistic update was wrong
      return;
    }

    fetchData(); // quiet background resync, no loading flash now
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
    <section className="page profile">
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
        <p className="profile__error" role="alert">
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
                Weigh-in history
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

      {weightModalOpen && (
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
                    setWeightForm((f) => ({ ...f, entry_date: e.target.value }))
                  }
                  required
                />
              </label>
              <label className="profile__field">
                Weight ({unitLabel})
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  placeholder={unit === "kg" ? "e.g. 62.5" : "e.g. 137.8"}
                  value={weightForm.weight}
                  onChange={(e) =>
                    setWeightForm((f) => ({ ...f, weight: e.target.value }))
                  }
                  required
                />
              </label>
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
        </div>
      )}

      {profileModalOpen && (
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
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, height_cm: e.target.value }))
                  }
                />
              </label>
              <label className="profile__field">
                Goal weight ({unitLabel})
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  placeholder={unit === "kg" ? "58" : "128"}
                  value={profileForm.goal_weight_kg}
                  onChange={(e) =>
                    setProfileForm((f) => ({
                      ...f,
                      goal_weight_kg: e.target.value,
                    }))
                  }
                />
              </label>
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
                Height is always in cm; weight fields follow your {unitLabel}{" "}
                toggle.
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
        </div>
      )}

      {deleteTarget && (
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
        </div>
      )}
    </section>
  );
}

export default Profile;
