/**
 * FAB — Floating action button stack (scroll-to-top + add).
 */
import { createPortal } from "react-dom";
import "../../styles/FAB.css";

export default function FAB({ visible, onScrollTop, onAdd, addLabel = "Add" }) {
  if (!visible) return null;

  return createPortal(
    <div className="fab-stack">
      {onScrollTop && (
        <button
          type="button"
          className="fab fab--up"
          onClick={onScrollTop}
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
      {onAdd && (
        <button
          type="button"
          className="fab fab--add"
          onClick={onAdd}
          aria-label={addLabel}
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
