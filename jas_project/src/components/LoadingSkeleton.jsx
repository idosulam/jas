/**
 * LoadingSkeleton — Skeleton placeholder for loading states.
 */
export default function LoadingSkeleton({ count = 3, height = "5rem", variant = "card", className = "" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`skeleton skeleton--${variant} ${className}`}
          style={{ height }}
        />
      ))}
    </div>
  );
}
