/**
 * Color palette manager — stores custom colors in localStorage.
 * Shared across Calendar and Shifts.
 */

const STORAGE_KEY = "jas:color_palette";

const DEFAULT_PALETTE = [
  { id: "c1", hex: "#818cf8", label: "Indigo" },
  { id: "c2", hex: "#f472b6", label: "Pink" },
  { id: "c3", hex: "#fb923c", label: "Orange" },
  { id: "c4", hex: "#4ade80", label: "Green" },
  { id: "c5", hex: "#22d3ee", label: "Cyan" },
];

function generateId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function loadPalette() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  // First load — seed with defaults
  savePalette(DEFAULT_PALETTE);
  return [...DEFAULT_PALETTE];
}

export function savePalette(palette) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
  } catch {
    // ignore
  }
}

export function addColor(hex, label) {
  const palette = loadPalette();
  const entry = { id: generateId(), hex, label: label || hex };
  palette.push(entry);
  savePalette(palette);
  return entry;
}

export function updateColor(id, hex, label) {
  const palette = loadPalette();
  const idx = palette.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  if (hex) palette[idx].hex = hex;
  if (label !== undefined) palette[idx].label = label;
  savePalette(palette);
  return palette[idx];
}

export function deleteColor(id) {
  const palette = loadPalette().filter((c) => c.id !== id);
  savePalette(palette);
  return palette;
}
