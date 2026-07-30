/**
 * FAB — Floating action button stack (scroll-to-top + add).
 */
import { createPortal } from "react-dom";
import "../../styles/fab.css";

export default function FAB({ visible, on_scroll_top, on_add, add_label = "Add" }) {
  if (!visible) return null;

  return createPortal(
    <div className="fab-stack">
      {on_scroll_top && (
        <button
          type="button"
          className="fab fab--up"
          onClick={on_scroll_top}
          aria-label="Scroll to top"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      )}
      {on_add && (
        <button
          type="button"
          className="fab fab--add"
          onClick={on_add}
          aria-label={add_label}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>,
    document.body,
  );
}
