import { SheetModal, FormField } from "../../../components";
import { Use_swipe_down_to_close } from "../../../Hooks";

export default function WeightForm({
  weightModal,
  weightForm,
  setWeightForm,
  editingEntry,
  Saving,
  weightFieldErrors,
  setWeightFieldErrors,
  weightFieldStates,
  weightShakeKey,
  onSubmit,
  onClose,
  onKgChange,
  onLbsChange,
  onFieldBlur,
  isValid,
}) {
  const weightSwipe = Use_swipe_down_to_close(
    weightModal.open,
    weightModal.closing,
    onClose,
  );

  return (
    <SheetModal
      open={weightModal.open}
      closing={weightModal.closing}
      onClose={onClose}
      title={editingEntry ? "Edit weigh-in" : "Log weigh-in"}
      className={weightSwipe.dragging ? "sheet-modal--dragging" : ""}
      swipe_bind={weightSwipe.bind}
      swipe_style={weightSwipe.style}
    >
      <form className="profile__form" onSubmit={onSubmit}>
        <FormField
          label="Date"
          error={weightFieldErrors.Entry_date}
          state={weightFieldStates.Entry_date}
          show_indicator
          shake={weightFieldErrors.Entry_date ? weightShakeKey : 0}
        >
          <input
            type="date"
            value={weightForm.Entry_date}
            onChange={(e) => {
              setWeightForm((f) => ({
                ...f,
                Entry_date: e.target.value,
              }));
              setWeightFieldErrors((prev) => ({
                ...prev,
                Entry_date: null,
              }));
            }}
            onBlur={() => onFieldBlur("Entry_date")}
            required
          />
        </FormField>
        <div className="profile__weight-row">
          <FormField
            label="Weight (kg)"
            error={weightFieldErrors.Weight_kg}
            state={weightFieldStates.Weight_kg}
            show_indicator
            shake={weightFieldErrors.Weight_kg ? weightShakeKey : 0}
          >
            <input
              type="number"
              step="0.1"
              min="1"
              placeholder="62.5"
              value={weightForm.Weight_kg}
              onChange={(e) => {
                onKgChange(e.target.value);
                setWeightFieldErrors((prev) => ({
                  ...prev,
                  Weight_kg: null,
                  weight_lbs: null,
                }));
              }}
              onBlur={() => onFieldBlur("Weight_kg")}
            />
          </FormField>
          <FormField
            label="Weight (lbs)"
            error={weightFieldErrors.weight_lbs}
            state={weightFieldStates.weight_lbs}
            show_indicator
            shake={weightFieldErrors.weight_lbs ? weightShakeKey : 0}
          >
            <input
              type="number"
              step="0.1"
              min="1"
              placeholder="137.8"
              value={weightForm.weight_lbs}
              onChange={(e) => {
                onLbsChange(e.target.value);
                setWeightFieldErrors((prev) => ({
                  ...prev,
                  weight_lbs: null,
                  Weight_kg: null,
                }));
              }}
              onBlur={() => onFieldBlur("weight_lbs")}
            />
          </FormField>
        </div>
        <FormField label="Notes" optional>
          <input
            type="text"
            placeholder="Post-leg day, morning fasted…"
            value={weightForm.notes}
            onChange={(e) =>
              setWeightForm((f) => ({ ...f, notes: e.target.value }))
            }
          />
        </FormField>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={Saving || !isValid}
          >
            {Saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </SheetModal>
  );
}
