/**
 * Inline color palette picker — used inside form modals.
 * Shows palette swatches + "+" to add. Hover ✎ to edit.
 * Manages its own add/edit modal internally.
 * Colors stored in Supabase color_palettes table.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchPalette,
  addPaletteColor,
  updatePaletteColor,
  deletePaletteColor,
} from "./color_palette";
import "./Color_palette_picker.css";

const MODAL_EXIT_MS = 260;

export default function ColorPalettePicker({ value, onChange }) {
  const [palette, setPalette] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerClosing, setPickerClosing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [hex, setHex] = useState("#818cf8");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPalette().then(setPalette);
  }, []);

  const openAdd = useCallback(() => {
    setEditing(null);
    setHex("#818cf8");
    setLabel("");
    setPickerClosing(false);
    setPickerOpen(true);
  }, []);

  const openEdit = useCallback((entry) => {
    setEditing(entry);
    setHex(entry.hex);
    setLabel(entry.label);
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

  const handleSave = useCallback(async () => {
    const cleanHex = hex.trim();
    if (!cleanHex || !cleanHex.startsWith("#")) return;

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

              <label className="cpp__field">
                <span>Hex color</span>
                <input
                  type="text"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  placeholder="#818cf8"
                  maxLength={7}
                  className="cpp__hex-input"
                />
              </label>

              <label className="cpp__field">
                <span>Name (optional)</span>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Brand blue"
                  maxLength={24}
                />
              </label>

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
                    saving || !hex || !hex.startsWith("#") || hex.length < 4
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
