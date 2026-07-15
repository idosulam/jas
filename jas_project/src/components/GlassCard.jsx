/**
 * GlassCard — Stat card with value and label.
 * Used in summary rows across all pages.
 */
export default function GlassCard({ value, label, className = "", ...rest }) {
  return (
    <div className={`glass-card ${className}`} {...rest}>
      <span className="glass-card__value">{value}</span>
      {label && <span className="glass-card__label">{label}</span>}
    </div>
  );
}
