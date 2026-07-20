/**
 * LoadingSkeleton — Skeleton placeholder for loading states.
 */
export default function LoadingSkeleton({
  count = 3,
  height = "5rem",
  variant = "card",
  className = "",
  contents = false,
}) {
  const style = contents
    ? { display: "contents" }
    : { display: "flex", flexDirection: "column", gap: "0.65rem" };
  return (
    <div style={style}>
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
