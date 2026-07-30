import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { haptic_error } from "./security";
import {
  fetch_palette,
  add_palette_color,
  update_palette_color,
  delete_palette_color,
  clear_palette,
} from "./color_palette";
import FormField from "../components/UI/form/form_field.jsx";
import "./color_palette_picker.css";

const MODAL_EXIT_MS = 260;

function is_valid_hex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export default function ColorPalettePicker({ value, onChange }) {
  const [palette, set_palette] = useState([]);
  const [picker_open, set_picker_open] = useState(false);
  const [picker_closing, set_picker_closing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [hex, setHex] = useState("");
  const [label, setLabel] = useState("");
  const [saving, set_saving] = useState(false);
  const [hex_touched, set_hex_touched] = useState(false);
  const [hex_state, set_hex_state] = useState("idle");
  const [hex_error, set_hex_error] = useState(null);

  useEffect(() => {
    fetch_palette().then(set_palette);
  }, []);

  const open_add = useCallback(() => {
    setEditing(null);
    setHex("");
    setLabel("");
    set_hex_touched(false);
    set_hex_state("valid");
    set_hex_error(null);
    set_picker_closing(false);
    set_picker_open(true);
  }, []);

  const open_edit = useCallback((entry) => {
    setEditing(entry);
    setHex(entry.hex);
    setLabel(entry.label);
    set_hex_touched(false);
    set_hex_state("valid");
    set_hex_error(null);
    set_picker_closing(false);
    set_picker_open(true);
  }, []);

  const close_picker = useCallback(() => {
    set_picker_closing(true);
    setTimeout(() => {
      set_picker_open(false);
      set_picker_closing(false);
      setEditing(null);
    }, MODAL_EXIT_MS);
  }, []);

  const validate_hex = (value, is_blur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (is_blur) {
        set_hex_state("error");
        set_hex_error("Hex color is required");
      } else {
        set_hex_state("idle");
        set_hex_error(null);
      }
      return;
    }
    if (is_valid_hex(trimmed)) {
      set_hex_state("valid");
      set_hex_error(null);
    } else {
      set_hex_state("error");
      set_hex_error("Enter a valid hex (e.g. #818cf8)");
    }
  };

  const handle_hex_blur = () => {
    set_hex_touched(true);
    validate_hex(hex, true);
    if (!hex.trim() || !is_valid_hex(hex.trim())) {
      haptic_error();
    }
  };

  const handle_hex_change = (value) => {
    setHex(value);
    if (hex_touched) validate_hex(value);
  };

  const handle_save = useCallback(async () => {
    const clean_hex = hex.trim();
    if (!clean_hex || !is_valid_hex(clean_hex)) return;

    set_saving(true);

    if (editing) {
      await update_palette_color(editing.id, clean_hex, label.trim() || clean_hex);
    } else {
      await add_palette_color(clean_hex, label.trim() || clean_hex);
    }

    const updated = await fetch_palette();
    set_palette(updated);
    set_saving(false);
    close_picker();
  }, [hex, label, editing, onChange, close_picker]);

  const handle_delete = useCallback(
    async (id) => {
      await delete_palette_color(id);
      const updated = await fetch_palette();
      set_palette(updated);
      if (
        value &&
        !updated.some((c) => c.hex === value) &&
        updated.length > 0
      ) {
        onChange(updated[0].hex);
      }
      close_picker();
    },
    [value, onChange, close_picker],
  );

  const handle_clear_all = useCallback(async () => {
    await clear_palette();
    set_palette([]);
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
              onClick={() => open_edit(entry)}
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
          onClick={open_add}
          aria-label="Add color"
          title="Add color"
        >
          +
        </button>
        {palette.length > 0 && (
          <button
            type="button"
            className="cpp__clear-btn"
            onClick={handle_clear_all}
            aria-label="Clear all colors"
            title="Clear all colors"
          >
            ✕
          </button>
        )}
      </div>

      {picker_open &&
        createPortal(
          <div
            className={`cpp__overlay${picker_closing ? " cpp__overlay--closing" : ""}`}
            onClick={close_picker}
          >
            <div
              className={`cpp__modal${picker_closing ? " cpp__modal--closing" : ""}`}
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
                    set_hex_state("valid");
                    set_hex_error(null);
                  }}
                  className="cpp__native-picker"
                  aria-label="Pick a color"
                />
              </div>

              <FormField
                label="Hex color"
                error={hex_error}
                state={hex_state}
                show_indicator
                shake={hex_error ? 1 : 0}
              >
                <input
                  type="text"
                  value={hex}
                  onChange={(e) => handle_hex_change(e.target.value)}
                  onBlur={handle_hex_blur}
                  placeholder="#818cf8"
                  maxLength={7}
                  className="cpp__hex-input"
                />
              </FormField>

              <FormField label="Name" optional>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Brand blue"
                  maxLength={24}
                />
              </FormField>

              <div className="cpp__form-actions">
                {editing && (
                  <button
                    type="button"
                    className="cpp__btn cpp__btn--danger"
                    onClick={() => handle_delete(editing.id)}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="cpp__btn cpp__btn--ghost"
                  onClick={close_picker}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cpp__btn cpp__btn--primary"
                  onClick={handle_save}
                  disabled={
                    saving || !is_valid_hex(hex)
                  }
                >
                  {saving ? "Saving…" : editing ? "Save" : "Add"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
