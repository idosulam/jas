import ConfirmModal from "../../../components/UI/modals/confirm_modal";
import Badge from "../../../components/UI/badge";
import { format_date_friendly } from "../../../lib/security";
import { format_money } from "../../../lib/format";
import { calcPay } from "./shift_utils";

/**
 * Delete-confirmation modal for a single shift.
 *
 * Props:
 *   delete_target  – the shift object to delete (null = hidden)
 *   closing       – animation closing flag
 *   onClose()     – close handler
 *   onConfirm()   – confirm-delete handler
 *   deleting      – delete-in-progress flag
 *   places        – PLACES map
 */
export default function ShiftDeleteConfirm({
  delete_target,
  closing,
  onClose,
  onConfirm,
  deleting,
  places,
}) {
  if (!delete_target) return null;

  const placeInfo = places[delete_target.place];
  const pay = calcPay(
    places,
    delete_target.place,
    delete_target.hours,
    delete_target.pay_type,
  );
  const tips = parseFloat(delete_target.tips) || 0;

  return (
    <ConfirmModal
      open={!!delete_target}
      closing={closing}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={deleting}
      title="Delete this shift?"
      description="This action cannot be undone."
      confirm_label="Delete shift"
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      }
      preview={
        <>
          <Badge
            className="shifts__badge"
            color={
              delete_target.color ||
              places[delete_target.place]?.color ||
              "#818cf8"
            }
          >
            {placeInfo?.label}
          </Badge>
          <span className="shifts__delete-date">
            {format_date_friendly(delete_target.shift_date)}
          </span>
          <span className="shifts__delete-amount">
            {format_money(pay + tips)}
          </span>
        </>
      }
    />
  );
}
