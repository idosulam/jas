/**
 * Stat_grid — Shared summary stat cards grid
 *
 * Renders a responsive grid of Glass_card stat items.
 * Used by: Shifts, Calendar, Household, Fitness, Profile, Recurring
 *
 * Props:
 *   stats       – array of { value, label, className?, valueClassName? }
 *   className   – extra class on the grid wrapper
 *   columns     – grid columns override (default: "repeat(2, minmax(0, 1fr))")
 */
import Glass_card from "./Glass_card";

export default function Stat_grid({
  stats = [],
  className = "",
  columns,
  ...rest
}) {
  const gridStyle = columns ? { gridTemplateColumns: columns } : undefined;

  return (
    <div className={`stat-grid ${className}`} style={gridStyle} {...rest}>
      {stats.map((stat, i) => (
        <Glass_card
          key={i}
          value={stat.value}
          label={stat.label}
          className={stat.className || ""}
          value_class_name={stat.valueClassName || ""}
        />
      ))}
    </div>
  );
}
