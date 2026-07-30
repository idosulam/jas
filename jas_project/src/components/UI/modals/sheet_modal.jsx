/**
 * SheetModal — Bottom-sheet modal with overlay and closing animation.
 * Replaces the repeated createPortal + overlay + modal pattern.
 */
import { createPortal } from "react-dom";
import "../../../styles/sheet_modal.css";

export default function SheetModal({
  open,
  closing,
  onClose,
  children,
  title,
  compact = false,
  variant = "default", // "default" | "danger" | "warning"
  className = "",
  overlay_class_name = "",
  swipe_bind,
  swipe_style,
}) {
  if (!open && !closing) return null;

  const modal_classes = [
    "sheet-modal",
    compact && "sheet-modal--compact",
    variant !== "default" && `sheet-modal--${variant}`,
    closing && "sheet-modal--closing",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const overlay_classes = [
    "sheet-overlay",
    closing && "sheet-overlay--closing",
    overlay_class_name,
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div className={overlay_classes} onClick={onClose}>
      <div
        className={modal_classes}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        {...swipe_bind}
        style={swipe_style}
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
