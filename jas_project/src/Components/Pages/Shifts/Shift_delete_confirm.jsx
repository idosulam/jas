import ConfirmModal from "../../../Components/UI/Modals/Confirm_modal";
import Badge from "../../../Components/UI/badge";
import { Format_date_friendly } from "../../../Lib/Security";
import { Format_money } from "../../../Lib/format";
import { calcPay } from "./Shift_utils";

/**
 * Delete-confirmation modal for a single shift.
 *
 * Props:
 *   Delete_target  – the shift object to delete (null = hidden)
 *   closing       – animation closing flag
 *   onClose()     – close handler
 *   onConfirm()   – confirm-delete handler
 *   Deleting      – delete-in-progress flag
 *   places        – PLACES map
 */
export default function ShiftDeleteConfirm({
  Delete_target,
  closing,
  onClose,
  onConfirm,
  Deleting,
  places,
}) {
  if (!Delete_target) return null;

  const placeInfo = places[Delete_target.place];
  const pay = calcPay(
    places,
    Delete_target.place,
    Delete_target.hours,
    Delete_target.pay_type,
  );
  const tips = parseFloat(Delete_target.tips) || 0;

  return (
    <ConfirmModal
      open={!!Delete_target}
      closing={closing}
      onClose={onClose}
      onConfirm={onConfirm}
      Loading={Deleting}
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
              Delete_target.color ||
              places[Delete_target.place]?.color ||
              "#818cf8"
            }
          >
            {placeInfo?.label}
          </Badge>
          <span className="shifts__delete-date">
            {Format_date_friendly(Delete_target.shift_date)}
          </span>
          <span className="shifts__delete-amount">
            {Format_money(pay + tips)}
          </span>
        </>
      }
    />
  );
}
