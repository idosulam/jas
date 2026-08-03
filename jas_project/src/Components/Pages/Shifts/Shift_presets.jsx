import Sheet_modal from "../../../Components/UI/Modals/Sheet_modal";
import Form_field from "../../UI/Form/Form_field.jsx";
import { PAY_TYPES } from "./Shift_utils";

/**
 * Quick-add preset chips + the preset edit/create form modal.
 *
 * Props:
 *   Presets               – array of preset objects
 *   Place_filter           – current place filter id
 *   onQuickAdd(preset)    – populate form from preset and open add modal
 *   onEditPreset(preset)  – open preset editor for existing preset
 *   on_add_preset()         – open preset editor for new preset
 *   // Preset modal state:
 *   presetModalOpen       – boolean
 *   presetModalClosing    – boolean
 *   onClosePresetModal()  – close preset modal
 *   Editing_preset         – preset being edited (null = new)
 *   Preset_form            – preset form state
 *   Set_preset_form         – setter (updater function)
 *   places                – PLACES map
 *   Deactivated_slugs      – Set of deactivated slugs
 *   onSavePreset()        – save preset handler
 *   onDeletePreset(id)    – delete preset handler
 */
export default function Shift_presets({
  Presets,
  Place_filter,
  onQuickAdd,
  onEditPreset,
  on_add_preset,
  presetModalOpen,
  presetModalClosing,
  onClosePresetModal,
  Editing_preset,
  Preset_form,
  Set_preset_form,
  places,
  Deactivated_slugs,
  onSavePreset,
  onDeletePreset,
}) {
  return (
    <>
      <div className="template-chips animate-in animate-in--3">
        {Presets
          .filter((p) => Place_filter === "all" || p.place === Place_filter)
          .map((preset) => (
            <div key={preset.id} className="preset">
              <button
                type="button"
                className="template-chip"
                onClick={() => onQuickAdd(preset)}
              >
                {preset.label}
                <span className="template-chip__meta">
                  {preset.start_time}–{preset.end_time}
                </span>
              </button>
              <button
                type="button"
                className="preset__edit"
                onClick={() => onEditPreset(preset)}
                aria-label={`Edit ${preset.label} preset`}
              >
                ✎
              </button>
            </div>
          ))}
        <button
          type="button"
          className="template-chip template-chip--add"
          onClick={on_add_preset}
        >
          + New preset
        </button>
      </div>

      <Sheet_modal
        open={presetModalOpen}
        closing={presetModalClosing}
        onClose={onClosePresetModal}
        title={Editing_preset ? "Edit preset" : "Create preset"}
      >
        <p className="shifts__preset-hint">
          Presets let you quick-add common shifts with one tap.
        </p>
        <div className="shifts__form">
          <Form_field label="Preset name">
            <input
              type="text"
              value={Preset_form.label}
              onChange={(e) =>
                Set_preset_form((f) => ({ ...f, label: e.target.value }))
              }
              placeholder="e.g. Morning shift"
              maxLength={40}
              autoFocus
            />
          </Form_field>
          <Form_field label="Place">
            <select
              value={Preset_form.place}
              onChange={(e) =>
                Set_preset_form((f) => ({ ...f, place: e.target.value }))
              }
            >
              {Object.entries(places).map(([key, { label, rate }]) => (
                <option key={key} value={key}>
                  {label} — ₪{rate}/hr
                  {Deactivated_slugs.has(key) ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </Form_field>
          <div
            className="shifts__pay-toggle"
            role="group"
            aria-label="Pay type"
          >
            {PAY_TYPES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`shifts__pay-toggle-btn${Preset_form.pay_type === id ? " shifts__pay-toggle-btn--active" : ""}`}
                onClick={() =>
                  Set_preset_form((f) => ({ ...f, pay_type: id }))
                }
                aria-pressed={Preset_form.pay_type === id}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="form-time-row">
            <Form_field label="Start time">
              <input
                type="time"
                value={Preset_form.start_time}
                onChange={(e) =>
                  Set_preset_form((f) => ({
                    ...f,
                    start_time: e.target.value,
                  }))
                }
              />
            </Form_field>
            <Form_field label="End time">
              <input
                type="time"
                value={Preset_form.end_time}
                onChange={(e) =>
                  Set_preset_form((f) => ({
                    ...f,
                    end_time: e.target.value,
                  }))
                }
              />
            </Form_field>
          </div>
          <Form_field label="Hours">
            <input
              type="number"
              min="0.01"
              step="any"
              value={Preset_form.hours}
              onChange={(e) =>
                Set_preset_form((f) => ({ ...f, hours: e.target.value }))
              }
              placeholder="8"
            />
          </Form_field>
          <div className="btn-row">
            {Editing_preset && (
              <button
                type="button"
                className="btn btn--danger-outline"
                onClick={() => {
                  onDeletePreset(Editing_preset.id);
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
              disabled={!Preset_form.label.trim()}
            >
              {Editing_preset ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Sheet_modal>
    </>
  );
}
