import { useEffect } from "react";

/**
 * Locks body scroll when any of the given conditions are true.
 * Cleans up automatically when all conditions become false.
 *
 * @param  {...boolean} conditions - Any truthy condition locks scroll
 */
export function useBodyScrollLock(...conditions) {
  const shouldLock = conditions.some(Boolean);

  useEffect(() => {
    if (!shouldLock) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [shouldLock]);
}
