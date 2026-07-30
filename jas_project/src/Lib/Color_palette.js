/**
 * Color palette manager — stores custom colors in Supabase.
 * Shared across Calendar and Shifts.
 * Only shows colors the user explicitly saved.
 */

import { Get_supabase_client, Get_current_user_id } from "./Superbase";

export async function Fetch_palette() {
  try {
    const supabase = Get_supabase_client();
    const user_id = await Get_current_user_id();
    let query = supabase.from("color_palettes").select("*");
    if (user_id) query = query.eq("user_id", user_id);
    const { data, error } = await query.order("sort_order", {
      ascending: true,
    });
    if (!error && data) return data;
    return [];
  } catch {
    return [];
  }
}

export async function Add_palette_color(hex, label) {
  try {
    const supabase = Get_supabase_client();
    const user_id = await Get_current_user_id();
    let query = supabase.from("color_palettes").select("sort_order");
    if (user_id) query = query.eq("user_id", user_id);
    const { data: existing } = await query
      .order("sort_order", { ascending: false })
      .limit(1);

    const next_order = (existing?.[0]?.sort_order ?? 0) + 1;

    const payload = { hex, label: label || hex, sort_order: next_order };
    if (user_id) payload.user_id = user_id;

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

export async function Update_palette_color(id, hex, label) {
  try {
    const supabase = Get_supabase_client();
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

export async function Delete_palette_color(id) {
  try {
    const supabase = Get_supabase_client();
    const { error } = await supabase
      .from("color_palettes")
      .delete()
      .eq("id", id);

    return !error;
  } catch {
    return false;
  }
}

export async function Clear_palette() {
  try {
    const supabase = Get_supabase_client();
    const user_id = await Get_current_user_id();
    let query = supabase.from("color_palettes").delete();
    if (user_id) query = query.eq("user_id", user_id);
    const { error } = await query;
    return !error;
  } catch {
    return false;
  }
}
