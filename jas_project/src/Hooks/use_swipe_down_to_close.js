import { useCallback, useEffect, useRef, useState } from "react";

const SWIPE_CLOSE_THRESHOLD = 110;

/**
 * Swipe-down-to-close gesture for bottom sheet modals.
 * Returns { bind, drag_y, dragging, style } to spread onto the modal element.
 *
 * @param {boolean} is_open - Whether the modal is currently open
 * @param {boolean} is_closing - Whether the modal is in its closing animation
 * @param {function} on_close - Called when swipe exceeds threshold
 */
export function use_swipe_down_to_close(is_open, is_closing, on_close) {
  const start_y_ref = useRef(0);
  const drag_y_ref = useRef(0);
  const dragging_ref = useRef(false);
  const [drag_y, set_drag_y] = useState(0);

  const reset_drag = useCallback(() => {
    drag_y_ref.current = 0;
    dragging_ref.current = false;
    set_drag_y(0);
  }, []);

  useEffect(() => {
    if (!is_open) {
      // Reset drag state when modal closes
      // eslint-disable-next-line react-hooks/set-state-in-effect
      reset_drag();
    }
  }, [is_open, reset_drag]);

  useEffect(() => {
    if (!is_open) return;

    const handle_pointer_move = (e) => {
      if (!dragging_ref.current) return;
      const next_drag = Math.max(0, e.clientY - start_y_ref.current);
      drag_y_ref.current = next_drag;
      set_drag_y(next_drag);
    };

    const handle_pointer_end = () => {
      if (!dragging_ref.current) return;
      const should_close = drag_y_ref.current >= SWIPE_CLOSE_THRESHOLD;
      reset_drag();
      if (should_close) on_close();
    };

    window.addEventListener("pointermove", handle_pointer_move);
    window.addEventListener("pointerup", handle_pointer_end);
    window.addEventListener("pointercancel", handle_pointer_end);

    return () => {
      window.removeEventListener("pointermove", handle_pointer_move);
      window.removeEventListener("pointerup", handle_pointer_end);
      window.removeEventListener("pointercancel", handle_pointer_end);
    };
  }, [is_open, on_close, reset_drag]);

  const bind = {
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Don't hijack interactive elements
      if (e.target.closest("button, input, select, textarea, a, label")) return;

      start_y_ref.current = e.clientY;
      drag_y_ref.current = 0;
      dragging_ref.current = true;

      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
  };

  return {
    bind,
    drag_y,
    dragging: drag_y > 0,
    style:
      drag_y > 0 && !is_closing
        ? { transform: `translateY(${drag_y}px)`, transition: "none" }
        : undefined,
  };
}
