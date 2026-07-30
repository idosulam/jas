/**
 * weight.js — Weight, height, and BMI utilities
 */

/**
 * Load the user's preferred unit.
 * Unit is now stored in DB (profile.Weight_unit).
 * This function returns the default; the profile component
 * manages the actual state.
 * @returns {"kg"|"lbs"}
 */
export function Load_unit() {
  return "kg";
}

/**
 * Convert kg to display value in the given unit.
 */
export function To_display_kg(kg, unit) {
  return unit === "lbs" ? kg * 2.20462 : kg;
}

/**
 * Format a weight value with unit label.
 */
export function Format_weight(value, unit, digits = 1) {
  if (value == null || isNaN(value)) return "—";
  return `${Number(value).toFixed(digits)} ${unit}`;
}

export function Format_weight_both(kg, digits = 1) {
  if (kg == null || isNaN(kg)) return "—";
  const lbs = kg * 2.20462;
  return `${Number(kg).toFixed(digits)} kg / ${Number(lbs).toFixed(digits)} lbs`;
}

export function Kg_to_lbs(kg) {
  if (!kg && kg !== 0) return "";
  return kg * 2.20462;
}

export function Lbs_to_kg(lbs) {
  if (!lbs && lbs !== 0) return "";
  return lbs / 2.20462;
}

/**
 * Format a signed weight delta (e.g. "+2.1 kg" or "-0.5 lbs").
 */
export function Format_signed_delta(delta, unit) {
  if (delta == null || isNaN(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${Number(delta).toFixed(1)} ${unit}`;
}

export function Cm_to_feet_and_inches(Height_cm) {
  if (Height_cm == null || Number.isNaN(Height_cm))
    return { feet: "", inches: "" };
  const total_inches = Height_cm / 2.54;
  const feet = Math.floor(total_inches / 12);
  const inches = Math.round(total_inches % 12);
  return { feet: String(feet), inches: String(inches) };
}

export function Feet_and_inches_to_cm(feet, inches) {
  const f = Number(feet) || 0;
  const i = Number(inches) || 0;
  return Math.round((f * 12 + i) * 2.54);
}

export function Format_height(Height_cm) {
  if (Height_cm == null) return "—";
  const { feet, inches } = Cm_to_feet_and_inches(Height_cm);
  return `${Math.round(Height_cm)} cm · ${feet}'${inches}"`;
}

export function Calc_bmi(Weight_kg, Height_cm) {
  if (!Weight_kg || !Height_cm) return null;
  const h = Height_cm / 100;
  return Weight_kg / (h * h);
}

export function Bmi_label(bmi) {
  if (bmi == null) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function Healthy_weight_range_kg(Height_cm) {
  if (!Height_cm) return null;
  const h = Height_cm / 100;
  return { min: 18.5 * h * h, max: 24.9 * h * h };
}
