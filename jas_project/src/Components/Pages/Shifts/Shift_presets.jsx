import SheetModal from "../../../Components/UI/Modals/Sheet_modal";
import FormField from "../../UI/Form/Form_field.jsx";
import { PAY_TYPES } from "./Shift_utils";

/**
 * Quick-add preset chips + the preset edit/create form modal.
 *
 * Props:
 *   presets               – array of preset objects
 *   place_filter           – current place filter id
 *   onQuickAdd(preset)    – populate form from preset and open add modal
 *   onEditPreset(preset)  – open preset editor for existing preset
 *   on_add_preset()         – open preset editor for new preset
 *   // Preset modal state:
 *   presetModalOpen       – boolean
 *   presetModalClosing    – boolean
 *   onClosePresetModal()  – close preset modal
 *   editing_preset         – preset being edited (null = new)
 *   preset_form            – preset form state
 *   set_preset_form         – setter (updater function)
 *   places                – PLACES map
 *   deactivated_slugs      – Set of deactivated slugs
 *   onSavePreset()        – save preset handler
 *   onDeletePreset(id)    – delete preset handler
 */
export default function ShiftPresets({
  presets,
  place_filter,
  onQuickAdd,
  onEditPreset,
  on_add_preset,
  presetModalOpen,
  presetModalClosing,
  onClosePresetModal,
  editing_preset,
  preset_form,
  set_preset_form,
  places,
  deactivated_slugs,
  onSavePreset,
  onDeletePreset,
}) {
  return (
    <>
      <div className="shifts__templates animate-in animate-in--3">
        {presets
          .filter((p) => place_filter === "all" || p.place === place_filter)
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
          onClick={on_add_preset}
        >
          + New preset
        </button>
      </div>

      <SheetModal
        open={presetModalOpen}
        closing={presetModalClosing}
        onClose={onClosePresetModal}
        title={editing_preset ? "Edit preset" : "Create preset"}
      >
        <p className="shifts__preset-hint">
          Presets let you quick-add common shifts with one tap.
        </p>
        <div className="shifts__form">
          <FormField label="Preset name">
            <input
              type="text"
              value={preset_form.label}
              onChange={(e) =>
                set_preset_form((f) => ({ ...f, label: e.target.value }))
              }
              placeholder="e.g. Morning shift"
              maxLength={40}
              autoFocus
            />
          </FormField>
          <FormField label="Place">
            <select
              value={preset_form.place}
              onChange={(e) =>
                set_preset_form((f) => ({ ...f, place: e.target.value }))
              }
            >
              {Object.entries(places).map(([key, { label, rate }]) => (
                <option key={key} value={key}>
                  {label} — ₪{rate}/hr
                  {deactivated_slugs.has(key) ? " (inactive)" : ""}
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
                className={`shifts__pay-toggle-btn${preset_form.pay_type === id ? " shifts__pay-toggle-btn--active" : ""}`}
                onClick={() =>
                  set_preset_form((f) => ({ ...f, pay_type: id }))
                }
                aria-pressed={preset_form.pay_type === id}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="form-time-row">
            <FormField label="Start time">
              <input
                type="time"
                value={preset_form.start_time}
                onChange={(e) =>
                  set_preset_form((f) => ({
                    ...f,
                    start_time: e.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="End time">
              <input
                type="time"
                value={preset_form.end_time}
                onChange={(e) =>
                  set_preset_form((f) => ({
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
              value={preset_form.hours}
              onChange={(e) =>
                set_preset_form((f) => ({ ...f, hours: e.target.value }))
              }
              placeholder="8"
            />
          </FormField>
          <div className="btn-row">
            {editing_preset && (
              <button
                type="button"
                className="btn btn--danger-outline"
                onClick={() => {
                  onDeletePreset(editing_preset.id);
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
              disabled={!preset_form.label.trim()}
            >
              {editing_preset ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </SheetModal>
    </>
  );
}
