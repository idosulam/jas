import { useCallback, useRef, useState } from "react";

/**
 * Reusable modal open/close state with animated exit.
 * Returns { open, closing, openModal, closeModal, setClosing }
 *
 * @param {number} exitMs - Duration of the closing animation in ms (default 260)
 */
export function useModal(exitMs = 260) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);

  const openModal = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setClosing(false);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setClosing(true);
    timerRef.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
      timerRef.current = null;
    }, exitMs);
  }, [exitMs]);

  return { open, closing, openModal, closeModal };
}
