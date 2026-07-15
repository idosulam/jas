import { createPortal } from "react-dom";

const MODAL_EXIT_MS = 260;

/**
 * Reusable confirmation modal for delete/deactivate actions.
 * Rendered via portal to document.body.
 *
 * @param {object} props
 * @param {boolean} props.open - Whether the modal is visible
 * @param {boolean} props.closing - Whether the closing animation is active
 * @param {function} props.onClose - Called when backdrop or Cancel is clicked
 * @param {function} props.onConfirm - Called when the action button is clicked
 * @param {boolean} props.loading - Whether the action is in progress
 * @param {string} props.title - Modal title
 * @param {React.ReactNode} props.description - Description text/content
 * @param {React.ReactNode} props.preview - Optional preview content (badge, date, amount, etc.)
 * @param {string} props.confirmLabel - Label for the confirm button (default "Confirm")
 * @param {string} props.confirmClassName - CSS class for the confirm button
 * @param {React.ReactNode} props.icon - Optional icon SVG
 * @param {string} props.variant - "danger" | "warning" (default "danger")
 */
export default function ConfirmModal({
  open,
  closing,
  onClose,
  onConfirm,
  loading = false,
  title,
  description,
  preview,
  confirmLabel = "Confirm",
  confirmClassName = "",
  icon,
  variant = "danger",
}) {
  if (!open && !closing) return null;

  return createPortal(
    <div
      className={`confirm-overlay${closing ? " confirm-overlay--closing" : ""}`}
      onClick={onClose}
    >
      <div
        className={`confirm-modal confirm-modal--${variant}${closing ? " confirm-modal--closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        {icon && (
          <div className="confirm-modal__icon" aria-hidden="true">
            {icon}
          </div>
        )}

        <h2 id="confirm-modal-title" className="confirm-modal__title">
          {title}
        </h2>

        {description && (
          <p className="confirm-modal__desc">{description}</p>
        )}

        {preview && (
          <div className="confirm-modal__preview">{preview}</div>
        )}

        <div className="confirm-modal__actions">
          <button
            type="button"
            className="confirm-modal__btn confirm-modal__btn--ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`confirm-modal__btn confirm-modal__btn--${variant} ${confirmClassName}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="confirm-modal__spinner" aria-hidden="true" />
                {confirmLabel}…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
