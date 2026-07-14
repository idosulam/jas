/**
 * Color palette manager — stores custom colors in Supabase.
 * Shared across Calendar and Shifts.
 * Only shows colors the user explicitly saved.
 */

import { getSupabaseClient } from "./superbase";

export async function fetchPalette() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("color_palettes")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data) return data;
    return [];
  } catch {
    return [];
  }
}

export async function addPaletteColor(hex, label) {
  try {
    const supabase = getSupabaseClient();
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

export async function clearPalette() {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("color_palettes")
      .delete()
      .neq("id", ""); // delete all rows

    return !error;
  } catch {
    return false;
  }
}
