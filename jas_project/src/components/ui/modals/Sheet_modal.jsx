/**
 * SheetModal — Bottom-sheet modal with overlay and closing animation.
 * Replaces the repeated createPortal + overlay + modal pattern.
 */
import { createPortal } from "react-dom";
import "../../../styles/Sheet_modal.css";

export default function SheetModal({
  open,
  closing,
  onClose,
  children,
  title,
  compact = false,
  variant = "default", // "default" | "danger" | "warning"
  className = "",
  overlayClassName = "",
  swipeBind,
  swipeStyle,
}) {
  if (!open && !closing) return null;

  const modalClasses = [
    "sheet-modal",
    compact && "sheet-modal--compact",
    variant !== "default" && `sheet-modal--${variant}`,
    closing && "sheet-modal--closing",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const overlayClasses = [
    "sheet-overlay",
    closing && "sheet-overlay--closing",
    overlayClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div className={overlayClasses} onClick={onClose}>
      <div
        className={modalClasses}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        {...swipeBind}
        style={swipeStyle}
      >
        {title && (
          <h2
            className={`sheet-modal__title${compact ? " sheet-modal__title--compact" : ""}`}
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
