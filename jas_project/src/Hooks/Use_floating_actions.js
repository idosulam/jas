import { useEffect, useRef, useState } from "react";

/**
 * Tracks whether a trigger element has scrolled out of view,
 * used to show/hide floating action buttons.
 *
 * @param {object} options
 * @param {boolean} options.require_scrolled_past - Only show when element scrolled above viewport (default true)
 * @returns {{ ref, visible }}
 */
export function use_floating_actions({ require_scrolled_past = true } = {}) {
  const ref = useRef(null);
  const [visible, set_visible] = useState(false);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (require_scrolled_past) {
          const scrolled_past =
            !entry.isIntersecting && entry.boundingClientRect.top < 0;
          set_visible(scrolled_past);
        } else {
          set_visible(!entry.isIntersecting);
        }
      },
      { threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [require_scrolled_past]);

  return { ref, visible };
}
