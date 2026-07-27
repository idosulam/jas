/**
 * GlassCard — Stat card with value and label.
 * Used in summary rows across all pages.
 */
export default function GlassCard({
  value,
  label,
  className = "",
  valueClassName = "",
  ...rest
}) {
  return (
    <div className={`glass-card ${className}`} {...rest}>
      <span
        className={`glass-card__value${valueClassName ? ` ${valueClassName}` : ""}`}
      >
        {value}
      </span>
      {label && <span className="glass-card__label">{label}</span>}
    </div>
  );
}
