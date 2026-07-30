/**
 * weight.js — Weight, height, and BMI utilities
 */

/**
 * Load the user's preferred unit.
 * Unit is now stored in DB (profile.weight_unit).
 * This function returns the default; the profile component
 * manages the actual state.
 * @returns {"kg"|"lbs"}
 */
export function load_unit() {
  return "kg";
}

/**
 * Convert kg to display value in the given unit.
 */
export function to_display_kg(kg, unit) {
  return unit === "lbs" ? kg * 2.20462 : kg;
}

/**
 * Format a weight value with unit label.
 */
export function format_weight(value, unit, digits = 1) {
  if (value == null || isNaN(value)) return "—";
  return `${Number(value).toFixed(digits)} ${unit}`;
}

export function format_weight_both(kg, digits = 1) {
  if (kg == null || isNaN(kg)) return "—";
  const lbs = kg * 2.20462;
  return `${Number(kg).toFixed(digits)} kg / ${Number(lbs).toFixed(digits)} lbs`;
}

export function kg_to_lbs(kg) {
  if (!kg && kg !== 0) return "";
  return kg * 2.20462;
}

export function lbs_to_kg(lbs) {
  if (!lbs && lbs !== 0) return "";
  return lbs / 2.20462;
}

/**
 * Format a signed weight delta (e.g. "+2.1 kg" or "-0.5 lbs").
 */
export function format_signed_delta(delta, unit) {
  if (delta == null || isNaN(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${Number(delta).toFixed(1)} ${unit}`;
}

export function cm_to_feet_and_inches(height_cm) {
  if (height_cm == null || Number.isNaN(height_cm))
    return { feet: "", inches: "" };
  const total_inches = height_cm / 2.54;
  const feet = Math.floor(total_inches / 12);
  const inches = Math.round(total_inches % 12);
  return { feet: String(feet), inches: String(inches) };
}

export function feet_and_inches_to_cm(feet, inches) {
  const f = Number(feet) || 0;
  const i = Number(inches) || 0;
  return Math.round((f * 12 + i) * 2.54);
}

export function format_height(height_cm) {
  if (height_cm == null) return "—";
  const { feet, inches } = cm_to_feet_and_inches(height_cm);
  return `${Math.round(height_cm)} cm · ${feet}'${inches}"`;
}

export function calc_bmi(weight_kg, height_cm) {
  if (!weight_kg || !height_cm) return null;
  const h = height_cm / 100;
  return weight_kg / (h * h);
}

export function bmi_label(bmi) {
  if (bmi == null) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function healthy_weight_range_kg(height_cm) {
  if (!height_cm) return null;
  const h = height_cm / 100;
  return { min: 18.5 * h * h, max: 24.9 * h * h };
}
