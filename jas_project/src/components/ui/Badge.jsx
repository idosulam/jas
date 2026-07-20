/**
 * Badge — Colored tag for workplace/place display.
 */
import "../../styles/Badge.css";

export default function Badge({
  children,
  color,
  deactivated = false,
  className = "",
}) {
  return (
    <span
      className={`badge ${className}`}
      style={{
        background: `${color}15`,
        color: color,
        border: `1px solid ${color}26`,
      }}
    >
      {children}
      {deactivated && <span className="badge__dot" aria-label="Deactivated" />}
    </span>
  );
}
