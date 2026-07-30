import { useCallback, useRef, useState } from "react";

/**
 * Reusable modal open/close state with animated exit.
 * Returns { open, closing, open_modal, close_modal, Set_closing }
 *
 * @param {number} exit_ms - Duration of the closing animation in ms (default 260)
 */
export function Use_modal(exit_ms = 260) {
  const [open, Set_open] = useState(false);
  const [closing, Set_closing] = useState(false);
  const Timer_ref = useRef(null);

  const open_modal = useCallback(() => {
    if (Timer_ref.current) {
      clearTimeout(Timer_ref.current);
      Timer_ref.current = null;
    }
    Set_closing(false);
    Set_open(true);
  }, []);

  const close_modal = useCallback(() => {
    Set_closing(true);
    Timer_ref.current = setTimeout(() => {
      Set_open(false);
      Set_closing(false);
      Timer_ref.current = null;
    }, exit_ms);
  }, [exit_ms]);

  return { open, closing, open_modal, close_modal };
}
