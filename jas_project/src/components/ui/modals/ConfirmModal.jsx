/**
 * ConfirmModal — Confirmation dialog for delete/deactivate actions.
 * Built on top of SheetModal for consistent styling.
 */
import SheetModal from "./SheetModal";
import "../styles/Buttons.css";

const TrashIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

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
  icon,
  variant = "danger",
  children,
}) {
  return (
    <SheetModal
      open={open}
      closing={closing}
      onClose={onClose}
      compact
      variant={variant}
    >
      {icon && <div className="sheet-modal__icon">{icon}</div>}
      {title && <h2 className="sheet-modal__title sheet-modal__title--compact">{title}</h2>}
      {description && <p className="sheet-modal__desc">{description}</p>}
      {preview && <div className="sheet-modal__preview">{preview}</div>}
      {children}
      <div className="btn-row">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`btn btn--${variant}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="btn__spinner" aria-hidden="true" />
              {confirmLabel}…
            </>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </SheetModal>
  );
}

export { TrashIcon };
