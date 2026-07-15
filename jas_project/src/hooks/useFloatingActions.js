import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether a trigger element has scrolled out of view,
 * used to show/hide floating action buttons.
 *
 * @param {object} options
 * @param {boolean} options.requireScrolledPast - Only show when element scrolled above viewport (default true)
 * @returns {{ ref, visible }}
 */
export function useFloatingActions({ requireScrolledPast = true } = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (requireScrolledPast) {
          const scrolledPast =
            !entry.isIntersecting && entry.boundingClientRect.top < 0;
          setVisible(scrolledPast);
        } else {
          setVisible(!entry.isIntersecting);
        }
      },
      { threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [requireScrolledPast]);

  return { ref, visible };
}
