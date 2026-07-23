import { useMemo, useState } from "react";

const MEMBER_COLORS = ["#818cf8", "#f472b6", "#34d399", "#fbbf24"];

function EarningsChart({ data, members, month, year }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const chart = useMemo(() => {
    if (!data || data.length === 0) return null;

    const width = 340;
    const height = 180;
    const pad = { top: 16, right: 12, bottom: 28, left: 44 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const maxTotal = Math.max(...data.map((d) => d.total), 1);
    const padding = maxTotal * 0.15;
    const maxY = maxTotal + padding;

    const barWidth = Math.max(4, (innerW / data.length) * 0.7);
    const barGap = innerW / data.length;

    const xScale = (i) => pad.left + i * barGap + barGap / 2;
    const yScale = (v) => pad.top + innerH - (v / maxY) * innerH;

    const yTicks = [0, maxY / 2, maxY];

    // X labels: show day numbers, label every 5th day
    const xLabels = data.map((d, i) => ({
      x: xScale(i),
      label: d.day % 5 === 1 || d.day === 1 ? String(d.day) : "",
    }));

    // Build stacked bars per member
    const bars = data.map((d, i) => {
      const segments = [];
      let yOffset = 0;

      members.forEach((member, mi) => {
        const value = d[member.user_id] || 0;
        if (value > 0) {
          const barH = (value / maxY) * innerH;
          segments.push({
            y: yScale(yOffset + value),
            height: barH,
            color: MEMBER_COLORS[mi % MEMBER_COLORS.length],
            value,
            member: member.display_name,
          });
          yOffset += value;
        }
      });

      return {
        x: xScale(i),
        segments,
        total: d.total,
        date: d.date,
        day: d.day,
      };
    });

    return { width, height, pad, innerH, bars, yTicks, xLabels, maxY, barWidth };
  }, [data, members]);

  if (!chart || data.every((d) => d.total === 0)) {
    return (
      <div className="earnings-chart__empty-wrap">
        <div className="earnings-chart__empty">
          <span className="earnings-chart__empty-icon">📊</span>
          <p>No earnings this month</p>
          <span>Log shifts to see the chart.</span>
        </div>
      </div>
    );
  }

  const hovered = hoverIndex != null ? chart.bars[hoverIndex] : null;

  return (
    <div className="earnings-chart__wrap">
      <svg
        className="earnings-chart"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        role="img"
        aria-label="Daily earnings chart"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          {members.map((member, mi) => (
            <linearGradient key={member.user_id} id={`barGrad${mi}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MEMBER_COLORS[mi % MEMBER_COLORS.length]} stopOpacity="0.9" />
              <stop offset="100%" stopColor={MEMBER_COLORS[mi % MEMBER_COLORS.length]} stopOpacity="0.5" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        {chart.yTicks.map((tick) => {
          const y = chart.pad.top + chart.innerH - (tick / chart.maxY) * chart.innerH;
          return (
            <g key={tick}>
              <line
                x1={chart.pad.left}
                y1={y}
                x2={chart.width - chart.pad.right}
                y2={y}
                className="earnings-chart__grid"
              />
              <text
                x={chart.pad.left - 6}
                y={y + 4}
                className="earnings-chart__axis"
                textAnchor="end"
              >
                {tick > 0 ? `₪${tick.toFixed(0)}` : "0"}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {chart.bars.map((bar, i) => (
          <g key={bar.date}>
            {/* Invisible hit area */}
            <rect
              x={bar.x - chart.barWidth / 2 - 2}
              y={chart.pad.top}
              width={chart.barWidth + 4}
              height={chart.innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              style={{ cursor: "pointer" }}
            />
            {/* Stacked segments */}
            {bar.segments.map((seg, si) => (
              <rect
                key={si}
                x={bar.x - chart.barWidth / 2}
                y={seg.y}
                width={chart.barWidth}
                height={Math.max(0, seg.height)}
                rx={2}
                fill={`url(#barGrad${members.findIndex((m) => m.display_name === seg.member) % members.length})`}
                className={`earnings-chart__bar${hoverIndex === i ? " earnings-chart__bar--active" : ""}`}
              />
            ))}
          </g>
        ))}

        {/* X labels */}
        {chart.xLabels.map(({ x, label }) =>
          label ? (
            <text
              key={label + x}
              x={x}
              y={chart.height - 6}
              className="earnings-chart__axis"
              textAnchor="middle"
            >
              {label}
            </text>
          ) : null
        )}
      </svg>

      {/* Hover tooltip */}
      {hovered && hovered.total > 0 && (
        <div
          className="earnings-chart__tooltip"
          style={{
            left: `${(hovered.x / chart.width) * 100}%`,
          }}
        >
          <span className="earnings-chart__tooltip-date">
            {new Date(`${hovered.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          {hovered.segments.map((seg, si) => (
            <span key={si} className="earnings-chart__tooltip-item">
              <span
                className="earnings-chart__tooltip-dot"
                style={{ background: seg.color }}
              />
              {seg.member}: ₪{seg.value.toFixed(0)}
            </span>
          ))}
          <span className="earnings-chart__tooltip-total">
            Total: ₪{hovered.total.toFixed(0)}
          </span>
        </div>
      )}

      {/* Legend */}
      {members.length > 1 && (
        <div className="earnings-chart__legend">
          {members.map((member, mi) => (
            <span key={member.user_id} className="earnings-chart__legend-item">
              <span
                className="earnings-chart__legend-dot"
                style={{ background: MEMBER_COLORS[mi % MEMBER_COLORS.length] }}
              />
              {member.is_me ? "You" : member.display_name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default EarningsChart;
