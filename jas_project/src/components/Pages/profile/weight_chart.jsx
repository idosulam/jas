import { useState, useMemo } from "react";
import { toDisplayKg } from "../../../lib/weight";
import { formatDateLabel } from "../../../lib/format";

export default function WeightChart({ entries, unit, goalKg }) {
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
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 6.5 : 4.5}
              className={`profile__chart-dot${hoverIndex === i ? " profile__chart-dot--active" : ""}`}
            />
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
