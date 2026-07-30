/**
 * macro_calculator.js — BMR / TDEE / Macro target utilities.
 * Uses Mifflin-St Jeor equation for BMR.
 */

export const GENDER_OPTIONS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
];

export const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Sedentary", multiplier: 1.2, desc: "Little or no exercise" },
  { id: "light", label: "Light", multiplier: 1.375, desc: "1–3 days/week" },
  { id: "moderate", label: "Moderate", multiplier: 1.55, desc: "3–5 days/week" },
  { id: "active", label: "Active", multiplier: 1.725, desc: "6–7 days/week" },
  { id: "very_active", label: "Very Active", multiplier: 1.9, desc: "Athlete / physical job" },
];

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor.
 * @param {number} weight_kg - Body weight in kg
 * @param {number} height_cm - Height in cm
 * @param {number} age - Age in years
 * @param {string} gender - "male" or "female"
 * @returns {number|null} BMR in kcal/day, or null if inputs are missing
 */
export function calcBMR(weight_kg, height_cm, age, gender) {
  if (!weight_kg || !height_cm || !age) return null;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  return gender === "female" ? base - 161 : base + 5;
}

/**
 * Calculate Total Daily Energy Expenditure.
 * @param {number} bmr - Basal Metabolic Rate
 * @param {string} activityLevel - Activity level id
 * @returns {number|null} TDEE in kcal/day
 */
export function calcTDEE(bmr, activityLevel) {
  if (!bmr) return null;
  const level = ACTIVITY_LEVELS.find((l) => l.id === activityLevel);
  if (!level) return Math.round(bmr * 1.55); // fallback to moderate
  return Math.round(bmr * level.multiplier);
}

/**
 * Calculate macro targets based on bodyweight and TDEE.
 * Protein: 2g per kg bodyweight
 * Fats: 0.8g per kg bodyweight
 * Carbs: remaining calories / 4
 * Fiber: 25g target
 *
 * @param {number} weight_kg - Body weight in kg
 * @param {number} tdee - Total Daily Energy Expenditure
 * @returns {{ protein: number, carbs: number, fats: number, fiber: number, calories: number } | null}
 */
export function calcMacroTargets(weight_kg, tdee) {
  if (!weight_kg || !tdee) return null;

  const protein = Math.round(weight_kg * 2);
  const fats = Math.round(weight_kg * 0.8);
  const proteinCals = protein * 4;
  const fatsCals = fats * 9;
  const remainingCals = tdee - proteinCals - fatsCals;
  const carbs = Math.max(0, Math.round(remainingCals / 4));

  return {
    protein,
    fats,
    carbs,
    fiber: 25,
    calories: tdee,
  };
}
