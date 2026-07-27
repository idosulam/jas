/**
 * weight.js — Weight, height, and BMI utilities
 */

const STORAGE_KEY = "jas_weight_unit";

/**
 * Load the user's preferred unit from localStorage.
 * @returns {"kg"|"lbs"}
 */
export function loadUnit() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "lbs" ? "lbs" : "kg";
  } catch {
    return "kg";
  }
}

/**
 * Convert kg to display value in the given unit.
 */
export function toDisplayKg(kg, unit) {
  return unit === "lbs" ? kg * 2.20462 : kg;
}

/**
 * Format a weight value with unit label.
 */
export function formatWeight(value, unit, digits = 1) {
  if (value == null || isNaN(value)) return "—";
  return `${Number(value).toFixed(digits)} ${unit}`;
}

export function formatWeightBoth(kg, digits = 1) {
  if (kg == null || isNaN(kg)) return "—";
  const lbs = kg * 2.20462;
  return `${Number(kg).toFixed(digits)} kg / ${Number(lbs).toFixed(digits)} lbs`;
}

export function kgToLbs(kg) {
  return kg * 2.20462;
}

export function lbsToKg(lbs) {
  return lbs / 2.20462;
}

/**
 * Format a signed weight delta (e.g. "+2.1 kg" or "-0.5 lbs").
 */
export function formatSignedDelta(delta, unit) {
  if (delta == null || isNaN(delta)) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${Number(delta).toFixed(1)} ${unit}`;
}

export function cmToFeetAndInches(heightCm) {
  if (heightCm == null || Number.isNaN(heightCm))
    return { feet: "", inches: "" };
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet: String(feet), inches: String(inches) };
}

export function feetAndInchesToCm(feet, inches) {
  const f = Number(feet) || 0;
  const i = Number(inches) || 0;
  return Math.round((f * 12 + i) * 2.54);
}

export function formatHeight(heightCm) {
  if (heightCm == null) return "—";
  const { feet, inches } = cmToFeetAndInches(heightCm);
  return `${Math.round(heightCm)} cm · ${feet}'${inches}"`;
}

export function calcBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const h = heightCm / 100;
  return weightKg / (h * h);
}

export function bmiLabel(bmi) {
  if (bmi == null) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function healthyWeightRangeKg(heightCm) {
  if (!heightCm) return null;
  const h = heightCm / 100;
  return { min: 18.5 * h * h, max: 24.9 * h * h };
}
