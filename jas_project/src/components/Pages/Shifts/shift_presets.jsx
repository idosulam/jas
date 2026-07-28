import SheetModal from "../../../components/ui/modals/sheet_modal";
import FormField from "../../ui/form/form_field.jsx";
import { PAY_TYPES } from "./shift_utils";

/**
 * Quick-add preset chips + the preset edit/create form modal.
 *
 * Props:
 *   presets               – array of preset objects
 *   placeFilter           – current place filter id
 *   onQuickAdd(preset)    – populate form from preset and open add modal
 *   onEditPreset(preset)  – open preset editor for existing preset
 *   onAddPreset()         – open preset editor for new preset
 *   // Preset modal state:
 *   presetModalOpen       – boolean
 *   presetModalClosing    – boolean
 *   onClosePresetModal()  – close preset modal
 *   editingPreset         – preset being edited (null = new)
 *   presetForm            – preset form state
 *   setPresetForm         – setter (updater function)
 *   places                – PLACES map
 *   deactivatedSlugs      – Set of deactivated slugs
 *   onSavePreset()        – save preset handler
 *   onDeletePreset(id)    – delete preset handler
 */
export default function ShiftPresets({
  presets,
  placeFilter,
  onQuickAdd,
  onEditPreset,
  onAddPreset,
  presetModalOpen,
  presetModalClosing,
  onClosePresetModal,
  editingPreset,
  presetForm,
  setPresetForm,
  places,
  deactivatedSlugs,
  onSavePreset,
  onDeletePreset,
}) {
  return (
    <>
      <div className="shifts__templates animate-in animate-in--3">
        {presets
          .filter((p) => placeFilter === "all" || p.place === placeFilter)
          .map((preset) => (
            <div key={preset.id} className="shifts__preset">
              <button
                type="button"
                className="shifts__template-chip"
                onClick={() => onQuickAdd(preset)}
              >
                {preset.label}
                <span className="shifts__template-time">
                  {preset.start_time}–{preset.end_time}
                </span>
              </button>
              <button
                type="button"
                className="shifts__preset-edit"
                onClick={() => onEditPreset(preset)}
                aria-label={`Edit ${preset.label} preset`}
              >
                ✎
              </button>
            </div>
          ))}
        <button
          type="button"
          className="shifts__template-chip shifts__template-chip--add"
          onClick={onAddPreset}
        >
          + New preset
        </button>
      </div>

      <SheetModal
        open={presetModalOpen}
        closing={presetModalClosing}
        onClose={onClosePresetModal}
        title={editingPreset ? "Edit preset" : "Create preset"}
      >
        <p className="shifts__preset-hint">
          Presets let you quick-add common shifts with one tap.
        </p>
        <div className="shifts__form">
          <FormField label="Preset name">
            <input
              type="text"
              value={presetForm.label}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, label: e.target.value }))
              }
              placeholder="e.g. Morning shift"
              maxLength={40}
              autoFocus
            />
          </FormField>
          <FormField label="Place">
            <select
              value={presetForm.place}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, place: e.target.value }))
              }
            >
              {Object.entries(places).map(([key, { label, rate }]) => (
                <option key={key} value={key}>
                  {label} — ₪{rate}/hr
                  {deactivatedSlugs.has(key) ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </FormField>
          <div
            className="shifts__pay-toggle"
            role="group"
            aria-label="Pay type"
          >
            {PAY_TYPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`shifts__pay-toggle-btn${presetForm.pay_type === id ? " shifts__pay-toggle-btn--active" : ""}`}
                onClick={() =>
                  setPresetForm((f) => ({ ...f, pay_type: id }))
                }
                aria-pressed={presetForm.pay_type === id}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="form-time-row">
            <FormField label="Start time">
              <input
                type="time"
                value={presetForm.start_time}
                onChange={(e) =>
                  setPresetForm((f) => ({
                    ...f,
                    start_time: e.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="End time">
              <input
                type="time"
                value={presetForm.end_time}
                onChange={(e) =>
                  setPresetForm((f) => ({
                    ...f,
                    end_time: e.target.value,
                  }))
                }
              />
            </FormField>
          </div>
          <FormField label="Hours">
            <input
              type="number"
              min="0.01"
              step="any"
              value={presetForm.hours}
              onChange={(e) =>
                setPresetForm((f) => ({ ...f, hours: e.target.value }))
              }
              placeholder="8"
            />
          </FormField>
          <div className="btn-row">
            {editingPreset && (
              <button
                type="button"
                className="btn btn--danger-outline"
                onClick={() => {
                  onDeletePreset(editingPreset.id);
                  onClosePresetModal();
                }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClosePresetModal}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={onSavePreset}
              disabled={!presetForm.label.trim()}
            >
              {editingPreset ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </SheetModal>
    </>
  );
}
