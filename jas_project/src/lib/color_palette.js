/**
 * Color palette manager — stores custom colors in Supabase.
 * Shared across Calendar and Shifts.
 */

import { getSupabaseClient } from "./superbase";

const DEFAULT_COLORS = [
  { hex: "#818cf8", label: "Indigo", sort_order: 1 },
  { hex: "#f472b6", label: "Pink", sort_order: 2 },
  { hex: "#fb923c", label: "Orange", sort_order: 3 },
  { hex: "#4ade80", label: "Green", sort_order: 4 },
  { hex: "#22d3ee", label: "Cyan", sort_order: 5 },
];

export async function fetchPalette() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("color_palettes")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data && data.length > 0) return data;

    // Table empty or missing — seed defaults
    return await seedDefaults();
  } catch {
    // Supabase not configured — return defaults in-memory
    return DEFAULT_COLORS.map((c, i) => ({ id: `default-${i}`, ...c }));
  }
}

async function seedDefaults() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("color_palettes")
      .insert(DEFAULT_COLORS)
      .select();

    if (!error && data) return data;
  } catch {
    // ignore
  }
  return DEFAULT_COLORS.map((c, i) => ({ id: `default-${i}`, ...c }));
}

export async function addPaletteColor(hex, label) {
  try {
    const supabase = getSupabaseClient();
    // Get max sort_order
    const { data: existing } = await supabase
      .from("color_palettes")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

    const { data, error } = await supabase
      .from("color_palettes")
      .insert({ hex, label: label || hex, sort_order: nextOrder })
      .select()
      .single();

    if (!error && data) return data;
  } catch {
    // ignore
  }
  return null;
}

export async function updatePaletteColor(id, hex, label) {
  try {
    const supabase = getSupabaseClient();
    const updates = {};
    if (hex) updates.hex = hex;
    if (label !== undefined) updates.label = label;

    const { data, error } = await supabase
      .from("color_palettes")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) return data;
  } catch {
    // ignore
  }
  return null;
}

export async function deletePaletteColor(id) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("color_palettes")
      .delete()
      .eq("id", id);

    return !error;
  } catch {
    return false;
  }
}
