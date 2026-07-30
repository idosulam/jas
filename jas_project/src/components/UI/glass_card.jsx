/**
 * GlassCard — Stat card with value and label.
 * Used in summary rows across all pages.
 */
export default function GlassCard({
  value,
  label,
  className = "",
  value_class_name = "",
  ...rest
}) {
  return (
    <div className={`glass-card noise-overlay ${className}`} {...rest}>
      <div className="glass-card__glow" aria-hidden="true" />
      <span
        className={`glass-card__value${value_class_name ? ` ${value_class_name}` : ""}`}
      >
        {value}
      </span>
      {label && <span className="glass-card__label">{label}</span>}
    </div>
  );
}
