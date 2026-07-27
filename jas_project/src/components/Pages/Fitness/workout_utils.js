export const MODAL_EXIT_MS = 320;

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const KG_TO_LBS = 2.20462;

export function emptyExercise() {
  return { name: "", weight: "", weight_lbs: "", sets: "", reps: "" };
}

export function emptyForm() {
  return {
    workout_date: new Date().toISOString().slice(0, 10),
    preset_name: "",
    exercises: [emptyExercise()],
    notes: "",
    duration_minutes: "",
    calories_burned: "",
  };
}

export function calcVolume(exercises) {
  return exercises.reduce((sum, ex) => {
    const w = parseFloat(ex.weight) || 0;
    const s = parseInt(ex.sets, 10) || 0;
    const r = parseInt(ex.reps, 10) || 0;
    return sum + w * s * r;
  }, 0);
}

export function formatVolume(vol) {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return String(Math.round(vol));
}
