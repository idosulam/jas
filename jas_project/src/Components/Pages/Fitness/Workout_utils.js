export const MODAL_EXIT_MS = 320;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const KG_TO_LBS = 2.20462;

export function Empty_exercise() {
  return { name: "", weight: "", weight_lbs: "", sets: "", reps: "" };
}

export function Empty_form() {
  return {
    workout_date: new Date().toISOString().slice(0, 10),
    preset_name: "",
    exercises: [Empty_exercise()],
    notes: "",
    duration_minutes: "",
    Calories_burned: "",
  };
}

export function Calc_volume(exercises) {
  return exercises.reduce((sum, ex) => {
    const w = parseFloat(ex.weight) || 0;
    const s = parseInt(ex.sets, 10) || 0;
    const r = parseInt(ex.reps, 10) || 0;
    return sum + w * s * r;
  }, 0);
}

export function Format_volume(vol) {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return String(Math.round(vol));
}
