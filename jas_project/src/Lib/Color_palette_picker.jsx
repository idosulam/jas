import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Haptic_error } from "./Security";
import {
  Fetch_palette,
  Add_palette_color,
  Update_palette_color,
  Delete_palette_color,
  Clear_palette,
} from "./Color_palette";
import Form_field from "../Components/UI/Form/Form_field.jsx";
import "./Color_palette_picker.css";

const MODAL_EXIT_MS = 260;

function Is_valid_hex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export default function Color_palette_picker({ value, onChange }) {
  const [palette, Set_palette] = useState([]);
  const [Picker_open, Set_picker_open] = useState(false);
  const [Picker_closing, Set_picker_closing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [hex, setHex] = useState("");
  const [label, setLabel] = useState("");
  const [Saving, Set_saving] = useState(false);
  const [Hex_touched, Set_hex_touched] = useState(false);
  const [Hex_state, Set_hex_state] = useState("idle");
  const [Hex_error, Set_hex_error] = useState(null);

  useEffect(() => {
    Fetch_palette().then(Set_palette);
  }, []);

  const Open_add = useCallback(() => {
    setEditing(null);
    setHex("");
    setLabel("");
    Set_hex_touched(false);
    Set_hex_state("valid");
    Set_hex_error(null);
    Set_picker_closing(false);
    Set_picker_open(true);
  }, []);

  const Open_edit = useCallback((entry) => {
    setEditing(entry);
    setHex(entry.hex);
    setLabel(entry.label);
    Set_hex_touched(false);
    Set_hex_state("valid");
    Set_hex_error(null);
    Set_picker_closing(false);
    Set_picker_open(true);
  }, []);

  const Close_picker = useCallback(() => {
    Set_picker_closing(true);
    setTimeout(() => {
      Set_picker_open(false);
      Set_picker_closing(false);
      setEditing(null);
    }, MODAL_EXIT_MS);
  }, []);

  const Validate_hex = (value, is_blur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (is_blur) {
        Set_hex_state("error");
        Set_hex_error("Hex color is required");
      } else {
        Set_hex_state("idle");
        Set_hex_error(null);
      }
      return;
    }
    if (Is_valid_hex(trimmed)) {
      Set_hex_state("valid");
      Set_hex_error(null);
    } else {
      Set_hex_state("error");
      Set_hex_error("Enter a valid hex (e.g. #818cf8)");
    }
  };

  const Handle_hex_blur = () => {
    Set_hex_touched(true);
    Validate_hex(hex, true);
    if (!hex.trim() || !Is_valid_hex(hex.trim())) {
      Haptic_error();
    }
  };

  const Handle_hex_change = (value) => {
    setHex(value);
    if (Hex_touched) Validate_hex(value);
  };

  const Handle_save = useCallback(async () => {
    const clean_hex = hex.trim();
    if (!clean_hex || !Is_valid_hex(clean_hex)) return;

    Set_saving(true);

    if (editing) {
      await Update_palette_color(editing.id, clean_hex, label.trim() || clean_hex);
    } else {
      await Add_palette_color(clean_hex, label.trim() || clean_hex);
    }

    const updated = await Fetch_palette();
    Set_palette(updated);
    Set_saving(false);
    Close_picker();
  }, [hex, label, editing, onChange, Close_picker]);

  const Handle_delete = useCallback(
    async (id) => {
      await Delete_palette_color(id);
      const updated = await Fetch_palette();
      Set_palette(updated);
      if (
        value &&
        !updated.some((c) => c.hex === value) &&
        updated.length > 0
      ) {
        onChange(updated[0].hex);
      }
      Close_picker();
    },
    [value, onChange, Close_picker],
  );

  const Handle_clear_all = useCallback(async () => {
    await Clear_palette();
    Set_palette([]);
    onChange("");
  }, [onChange]);

  return (
    <div className="cpp__container">
      <div
        className="cpp__swatches"
        role="radiogroup"
        aria-label="Color palette"
      >
        {palette.map((entry) => (
          <div key={entry.id} className="cpp__swatch-wrap">
            <button
              type="button"
              className={`cpp__swatch${value === entry.hex ? " cpp__swatch--active" : ""}`}
              style={{ "--swatch": entry.hex }}
              onClick={() => onChange(entry.hex)}
              aria-label={entry.label}
              aria-pressed={value === entry.hex}
            />
            <button
              type="button"
              className="cpp__edit-btn"
              onClick={() => Open_edit(entry)}
              aria-label={`Edit ${entry.label}`}
              title={`Edit ${entry.label}`}
            >
              ✎
            </button>
          </div>
        ))}
        <button
          type="button"
          className="cpp__add-btn"
          onClick={Open_add}
          aria-label="Add color"
          title="Add color"
        >
          +
        </button>
        {palette.length > 0 && (
          <button
            type="button"
            className="cpp__clear-btn"
            onClick={Handle_clear_all}
            aria-label="Clear all colors"
            title="Clear all colors"
          >
            ✕
          </button>
        )}
      </div>

      {Picker_open &&
        createPortal(
          <div
            className={`cpp__overlay${Picker_closing ? " cpp__overlay--closing" : ""}`}
            onClick={Close_picker}
          >
            <div
              className={`cpp__modal${Picker_closing ? " cpp__modal--closing" : ""}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cpp-modal-title"
            >
              <h2 id="cpp-modal-title" className="cpp__modal-title">
                {editing ? "Edit color" : "Add color"}
              </h2>

              <div className="cpp__preview-row">
                <div
                  className="cpp__preview-swatch"
                  style={{ background: hex }}
                  aria-hidden="true"
                />
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => {
                    setHex(e.target.value);
                    Set_hex_state("valid");
                    Set_hex_error(null);
                  }}
                  className="cpp__native-picker"
                  aria-label="Pick a color"
                />
              </div>

              <Form_field
                label="Hex color"
                error={Hex_error}
                state={Hex_state}
                show_indicator
                shake={Hex_error ? 1 : 0}
              >
                <input
                  type="text"
                  value={hex}
                  onChange={(e) => Handle_hex_change(e.target.value)}
                  onBlur={Handle_hex_blur}
                  placeholder="#818cf8"
                  maxLength={7}
                  className="cpp__hex-input"
                />
              </Form_field>

              <Form_field label="Name" optional>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Brand blue"
                  maxLength={24}
                />
              </Form_field>

              <div className="cpp__form-actions">
                {editing && (
                  <button
                    type="button"
                    className="cpp__btn cpp__btn--danger"
                    onClick={() => Handle_delete(editing.id)}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="cpp__btn cpp__btn--ghost"
                  onClick={Close_picker}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cpp__btn cpp__btn--primary"
                  onClick={Handle_save}
                  disabled={
                    Saving || !Is_valid_hex(hex)
                  }
                >
                  {Saving ? "Saving…" : editing ? "Save" : "Add"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
