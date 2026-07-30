import Badge from "../../../Components/UI/Badge";
import { Format_date_friendly } from "../../../Lib/Security";
import { Format_money } from "../../../Lib/Format";
import { calc_pay } from "./Shift_utils";

/**
 * A single shift list item card.
 *
 * Props:
 *   shift           – shift object
 *   places          – PLACES map
 *   Deactivated_slugs– Set of deactivated slugs
 *   onEdit(shift)   – open edit modal
 *   onCopy(shift)   – copy shift to today (opens add modal prefilled)
 *   onDelete(shift) – open delete confirmation
 *   onToggleNote(id)– toggle expanded note panel
 *   Expanded_note_id  – id of the currently-expanded note (or null)
 *   isRemoving      – card is animating out
 *   animDelay       – CSS delay string for stagger animation
 */
export default function Shift_card({
  shift,
  places,
  Deactivated_slugs,
  onEdit,
  onCopy,
  onDelete,
  onToggleNote,
  Expanded_note_id,
  isRemoving,
  animDelay,
}) {
  const pay = calc_pay(places, shift.place, shift.hours, shift.pay_type);
  const tips = parseFloat(shift.tips) || 0;
  const placeInfo = places[shift.place];
  const isTipsOnly = shift.pay_type === "tips_only";
  const isDeactivated = Deactivated_slugs.has(shift.place);

  return (
    <li
      className={`shifts__card${isRemoving ? " shifts__card--removing" : ""}${isDeactivated ? " shifts__card--deactivated" : ""}`}
      style={{ "--card-delay": animDelay }}
    >
      <div className="shifts__card-main">
        <div className="shifts__card-top">
          <Badge
            className="shifts__badge"
            color={
              shift.color || places[shift.place]?.color || "#818cf8"
            }
            deactivated={isDeactivated}
          >
            {placeInfo?.label ?? shift.place}
          </Badge>
          <div className="shifts__card-top-right">
            <span className="shifts__date">
              {Format_date_friendly(shift.shift_date)}
            </span>
            {shift.notes && (
              <button
                type="button"
                className={`shifts__note-toggle${Expanded_note_id === shift.id ? " shifts__note-toggle--active" : ""}`}
                onClick={() => onToggleNote(shift.id)}
                aria-expanded={Expanded_note_id === shift.id}
                aria-label={
                  Expanded_note_id === shift.id
                    ? "Hide note"
                    : "View note"
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  aria-hidden="true"
                >
                  <path
                    d="M21 12c0 4.418-4.03 8-9 8-1.06 0-2.07-.16-3-.46L3 21l1.5-4.5C3.55 15.13 3 13.62 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="shifts__card-details">
          {isTipsOnly ? (
            <span className="shifts__tips-only-tag">Tips only</span>
          ) : (
            <span>
              {shift.hours}h × ₪{placeInfo?.rate}
            </span>
          )}
          {tips > 0 && <span>Tips {Format_money(tips)}</span>}
          <span className="shifts__card-total">
            {Format_money(pay + tips)}
          </span>
        </div>
        {shift.notes && Expanded_note_id === shift.id && (
          <p className="shifts__note-panel">{shift.notes}</p>
        )}
      </div>
      <div className="shifts__card-actions">
        <button
          type="button"
          className="shifts__action shifts__action--copy"
          onClick={() => onCopy(shift)}
          aria-label="Copy shift to today"
        >
          Copy
        </button>
        <button
          type="button"
          className="shifts__action shifts__action--edit"
          onClick={() => onEdit(shift)}
          aria-label="Edit shift"
        >
          Edit
        </button>
        <button
          type="button"
          className="shifts__action shifts__action--deactivate"
          onClick={() => onDelete(shift)}
          aria-label="Delete shift"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
