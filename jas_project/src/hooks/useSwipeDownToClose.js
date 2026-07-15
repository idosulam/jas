import { useCallback, useEffect, useRef, useState } from "react";

const SWIPE_CLOSE_THRESHOLD = 110;

/**
 * Swipe-down-to-close gesture for bottom sheet modals.
 * Returns { bind, dragY, dragging, style } to spread onto the modal element.
 *
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {boolean} isClosing - Whether the modal is in its closing animation
 * @param {function} onClose - Called when swipe exceeds threshold
 */
export function useSwipeDownToClose(isOpen, isClosing, onClose) {
  const startYRef = useRef(0);
  const dragYRef = useRef(0);
  const draggingRef = useRef(false);
  const [dragY, setDragY] = useState(0);

  const resetDrag = useCallback(() => {
    dragYRef.current = 0;
    draggingRef.current = false;
    setDragY(0);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      // Reset drag state when modal closes
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetDrag();
    }
  }, [isOpen, resetDrag]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerMove = (e) => {
      if (!draggingRef.current) return;
      const nextDrag = Math.max(0, e.clientY - startYRef.current);
      dragYRef.current = nextDrag;
      setDragY(nextDrag);
    };

    const handlePointerEnd = () => {
      if (!draggingRef.current) return;
      const shouldClose = dragYRef.current >= SWIPE_CLOSE_THRESHOLD;
      resetDrag();
      if (shouldClose) onClose();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [isOpen, onClose, resetDrag]);

  const bind = {
    onPointerDown: (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Don't hijack interactive elements
      if (e.target.closest("button, input, select, textarea, a, label")) return;

      startYRef.current = e.clientY;
      dragYRef.current = 0;
      draggingRef.current = true;

      if (e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    },
  };

  return {
    bind,
    dragY,
    dragging: dragY > 0,
    style:
      dragY > 0 && !isClosing
        ? { transform: `translateY(${dragY}px)`, transition: "none" }
        : undefined,
  };
}
