import { useCallback, useRef, useState } from "react";

/**
 * Reusable modal open/close state with animated exit.
 * Returns { open, closing, open_modal, close_modal, set_closing }
 *
 * @param {number} exit_ms - Duration of the closing animation in ms (default 260)
 */
export function use_modal(exit_ms = 260) {
  const [open, set_open] = useState(false);
  const [closing, set_closing] = useState(false);
  const timer_ref = useRef(null);

  const open_modal = useCallback(() => {
    if (timer_ref.current) {
      clearTimeout(timer_ref.current);
      timer_ref.current = null;
    }
    set_closing(false);
    set_open(true);
  }, []);

  const close_modal = useCallback(() => {
    set_closing(true);
    timer_ref.current = setTimeout(() => {
      set_open(false);
      set_closing(false);
      timer_ref.current = null;
    }, exit_ms);
  }, [exit_ms]);

  return { open, closing, open_modal, close_modal };
}
