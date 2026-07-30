import { useCallback, useEffect, useRef, useState } from "react";

const SWIPE_CLOSE_THRESHOLD = 110;

/**
 * Swipe-down-to-close gesture for bottom sheet modals.
 * Returns { bind, Drag_y, dragging, style } to spread onto the modal element.
 *
 * @param {boolean} is_open - Whether the modal is currently open
 * @param {boolean} is_closing - Whether the modal is in its closing animation
 * @param {function} on_close - Called when swipe exceeds threshold
 */
export function Use_swipe_down_to_close(is_open, is_closing, on_close) {
  const Start_y_ref = useRef(0);
  const Drag_y_ref = useRef(0);
  const Dragging_ref = useRef(false);
  const [Drag_y, Set_drag_y] = useState(0);

  const Reset_drag = useCallback(() => {
    Drag_y_ref.current = 0;
    Dragging_ref.current = false;
    Set_drag_y(0);
  }, []);

  useEffect(() => {
    if (!is_open) {
      // Reset drag state when modal closes
      // eslint-disable-next-line react-hooks/set-state-in-effect
      Reset_drag();
    }
  }, [is_open, Reset_drag]);

  useEffect(() => {
    if (!is_open) return;

    const Handle_pointer_move = (e) => {
      if (!Dragging_ref.current) return;
      const next_drag = Math.max(0, e.clientY - Start_y_ref.current);
      Drag_y_ref.current = next_drag;
      Set_drag_y(next_drag);
    };

    const Handle_pointer_end = () => {
      if (!Dragging_ref.current) return;
      const should_close = Drag_y_ref.current >= SWIPE_CLOSE_THRESHOLD;
      Reset_drag();
      if (should_close) on_close();
    };

    window.addEventListener("pointermove", Handle_pointer_move);
    window.addEventListener("pointerup", Handle_pointer_end);
    window.addEventListener("pointercancel", Handle_pointer_end);

    return () => {
      window.removeEventListener("pointermove", Handle_pointer_move);
      window.removeEventListener("pointerup", Handle_pointer_end);
      window.removeEventListener("pointercancel", Handle_pointer_end);
    };
  }, [is_open, on_close, Reset_drag]);

  const bind = {
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Don't hijack interactive elements
      if (e.target.closest("button, input, select, textarea, a, label")) return;

      Start_y_ref.current = e.clientY;
      Drag_y_ref.current = 0;
      Dragging_ref.current = true;

      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
  };

  return {
    bind,
    Drag_y,
    dragging: Drag_y > 0,
    style:
      Drag_y > 0 && !is_closing
        ? { transform: `translateY(${Drag_y}px)`, transition: "none" }
        : undefined,
  };
}
