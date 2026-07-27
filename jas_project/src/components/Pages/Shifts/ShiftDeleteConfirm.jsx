import ConfirmModal from "../../../components/ui/modals/Confirm_modal";
import Badge from "../../../components/ui/Badge";
import { formatDateFriendly } from "../../../lib/security";
import { formatMoney } from "../../../lib/format";
import { calcPay } from "./shift_utils";

/**
 * Delete-confirmation modal for a single shift.
 *
 * Props:
 *   deleteTarget  – the shift object to delete (null = hidden)
 *   closing       – animation closing flag
 *   onClose()     – close handler
 *   onConfirm()   – confirm-delete handler
 *   deleting      – delete-in-progress flag
 *   places        – PLACES map
 */
export default function ShiftDeleteConfirm({
  deleteTarget,
  closing,
  onClose,
  onConfirm,
  deleting,
  places,
}) {
  if (!deleteTarget) return null;

  const placeInfo = places[deleteTarget.place];
  const pay = calcPay(
    places,
    deleteTarget.place,
    deleteTarget.hours,
    deleteTarget.pay_type,
  );
  const tips = parseFloat(deleteTarget.tips) || 0;

  return (
    <ConfirmModal
      open={!!deleteTarget}
      closing={closing}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={deleting}
      title="Delete this shift?"
      description="This action cannot be undone."
      confirmLabel="Delete shift"
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
              deleteTarget.color ||
              places[deleteTarget.place]?.color ||
              "#818cf8"
            }
          >
            {placeInfo?.label}
          </Badge>
          <span className="shifts__delete-date">
            {formatDateFriendly(deleteTarget.shift_date)}
          </span>
          <span className="shifts__delete-amount">
            {formatMoney(pay + tips)}
          </span>
        </>
      }
    />
  );
}
