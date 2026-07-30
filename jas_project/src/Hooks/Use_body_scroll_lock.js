import { useEffect } from "react";

/**
 * Locks body scroll when any of the given conditions are true.
 * Cleans up automatically when all conditions become false.
 *
 * @param  {...boolean} conditions - Any truthy condition locks scroll
 */
export function Use_body_scroll_lock(...conditions) {
  const Should_lock = conditions.some(Boolean);

  useEffect(() => {
    if (!Should_lock) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [Should_lock]);
}
