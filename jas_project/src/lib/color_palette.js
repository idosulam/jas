/**
 * Color palette manager — stores custom colors in Supabase.
 * Shared across Calendar and Shifts.
 * Only shows colors the user explicitly saved.
 */

import { getSupabaseClient, getCurrentUserId } from "./superbase";

export async function fetchPalette() {
  try {
    const supabase = getSupabaseClient();
    const userId = await getCurrentUserId();
    let query = supabase.from("color_palettes").select("*");
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.order("sort_order", { ascending: true });
    if (!error && data) return data;
    return [];
  } catch {
    return [];
  }
}

export async function addPaletteColor(hex, label) {
  try {
    const supabase = getSupabaseClient();
    const userId = await getCurrentUserId();
    let query = supabase.from("color_palettes").select("sort_order");
    if (userId) query = query.eq("user_id", userId);
    const { data: existing } = await query
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

    const payload = { hex, label: label || hex, sort_order: nextOrder };
    if (userId) payload.user_id = userId;

    const { data, error } = await supabase
      .from("color_palettes")
      .insert(payload)
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
