/**
 * MacroProgressBar — Animated progress bar for macro nutrient tracking.
 */
export default function MacroProgressBar({ label, current, target, unit, color }) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const over = current > target;

  return (
    <div className="fitness__macro-bar">
      <div className="fitness__macro-bar-header">
        <span className="fitness__macro-bar-label">{label}</span>
        <span className="fitness__macro-bar-values">
          <span className={`fitness__macro-bar-current${over ? " fitness__macro-bar-current--over" : ""}`}>
            {Math.round(current)}
          </span>
          <span className="fitness__macro-bar-sep">/</span>
          <span className="fitness__macro-bar-target">{target}{unit}</span>
        </span>
      </div>
      <div className="fitness__macro-bar-track">
        <div
          className={`fitness__macro-bar-fill${over ? " fitness__macro-bar-fill--over" : ""}`}
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: over ? "#f87171" : color,
          }}
        />
      </div>
    </div>
  );
}
