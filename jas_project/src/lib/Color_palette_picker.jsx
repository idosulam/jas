import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchPalette,
  addPaletteColor,
  updatePaletteColor,
  deletePaletteColor,
  clearPalette,
} from "./color_palette";
import FormField from "../components/ui/form/Form_field.jsx";
import "./Color_palette_picker.css";

const MODAL_EXIT_MS = 260;

function isValidHex(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export default function ColorPalettePicker({ value, onChange }) {
  const [palette, setPalette] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerClosing, setPickerClosing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [hex, setHex] = useState("#818cf8");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [hexTouched, setHexTouched] = useState(false);
  const [hexState, setHexState] = useState("idle");
  const [hexError, setHexError] = useState(null);

  useEffect(() => {
    fetchPalette().then(setPalette);
  }, []);

  const openAdd = useCallback(() => {
    setEditing(null);
    setHex("#818cf8");
    setLabel("");
    setHexTouched(false);
    setHexState("idle");
    setHexError(null);
    setPickerClosing(false);
    setPickerOpen(true);
  }, []);

  const openEdit = useCallback((entry) => {
    setEditing(entry);
    setHex(entry.hex);
    setLabel(entry.label);
    setHexTouched(false);
    setHexState("idle");
    setHexError(null);
    setPickerClosing(false);
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerClosing(true);
    setTimeout(() => {
      setPickerOpen(false);
      setPickerClosing(false);
      setEditing(null);
    }, MODAL_EXIT_MS);
  }, []);

  const validateHex = (value, isBlur = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (isBlur) {
        setHexState("error");
        setHexError("Hex color is required");
      } else {
        setHexState("idle");
        setHexError(null);
      }
      return;
    }
    if (isValidHex(trimmed)) {
      setHexState("valid");
      setHexError(null);
    } else {
      setHexState("error");
      setHexError("Enter a valid hex (e.g. #818cf8)");
    }
  };

  const handleHexBlur = () => {
    setHexTouched(true);
    validateHex(hex, true);
  };

  const handleHexChange = (value) => {
    setHex(value);
    if (hexTouched) validateHex(value);
  };

  const handleSave = useCallback(async () => {
    const cleanHex = hex.trim();
    if (!cleanHex || !isValidHex(cleanHex)) return;

    setSaving(true);

    if (editing) {
      await updatePaletteColor(editing.id, cleanHex, label.trim() || cleanHex);
    } else {
      const entry = await addPaletteColor(cleanHex, label.trim() || cleanHex);
      if (entry) onChange(entry.hex);
    }

    const updated = await fetchPalette();
    setPalette(updated);
    setSaving(false);
    closePicker();
  }, [hex, label, editing, onChange, closePicker]);

  const handleDelete = useCallback(
    async (id) => {
      await deletePaletteColor(id);
      const updated = await fetchPalette();
      setPalette(updated);
      if (
        value &&
        !updated.some((c) => c.hex === value) &&
        updated.length > 0
      ) {
        onChange(updated[0].hex);
      }
      closePicker();
    },
    [value, onChange, closePicker],
  );

  const handleClearAll = useCallback(async () => {
    await clearPalette();
    setPalette([]);
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
              onClick={() => openEdit(entry)}
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
          onClick={openAdd}
          aria-label="Add color"
          title="Add color"
        >
          +
        </button>
        {palette.length > 0 && (
          <button
            type="button"
            className="cpp__clear-btn"
            onClick={handleClearAll}
            aria-label="Clear all colors"
            title="Clear all colors"
          >
            ✕
          </button>
        )}
      </div>

      {pickerOpen &&
        createPortal(
          <div
            className={`cpp__overlay${pickerClosing ? " cpp__overlay--closing" : ""}`}
            onClick={closePicker}
          >
            <div
              className={`cpp__modal${pickerClosing ? " cpp__modal--closing" : ""}`}
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
                  onChange={(e) => setHex(e.target.value)}
                  className="cpp__native-picker"
                  aria-label="Pick a color"
                />
              </div>

              <FormField
                label="Hex color"
                error={hexError}
                state={hexState}
                showIndicator
                shake={hexError ? 1 : 0}
              >
                <input
                  type="text"
                  value={hex}
                  onChange={(e) => handleHexChange(e.target.value)}
                  onBlur={handleHexBlur}
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
                    onClick={() => handleDelete(editing.id)}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="cpp__btn cpp__btn--ghost"
                  onClick={closePicker}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cpp__btn cpp__btn--primary"
                  onClick={handleSave}
                  disabled={
                    saving || !isValidHex(hex)
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
