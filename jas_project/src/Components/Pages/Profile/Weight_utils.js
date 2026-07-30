import { Bmi_label } from "../../../Lib/weight";

export function daysBetween(a, b) {
  const ms = new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`);
  return Math.max(1, Math.round(ms / 86400000));
}

export function buildInsight({ age, weeklyChangeKg, bmi, goalProgress, isLosing }) {
  const parts = [];

  if (age) {
    parts.push(
      age < 30
        ? `At ${age}, your body typically recovers well from training — pair steady nutrition with rest days.`
        : age < 45
          ? `At ${age}, strength training helps preserve muscle while you cut — aim for protein at every meal.`
          : `At ${age}, slower, consistent progress protects joints and muscle — prioritize recovery alongside cardio.`,
    );
  }

  if (weeklyChangeKg != null && isLosing) {
    const abs = Math.abs(weeklyChangeKg);
    if (abs > 1) {
      parts.push(
        "Your weekly pace is aggressive — watch energy levels and consider a refeed day if workouts feel flat.",
      );
    } else if (abs >= 0.3) {
      parts.push(
        "You are losing at a sustainable rate for someone who trains — keep protein high to protect lean mass.",
      );
    } else if (abs > 0) {
      parts.push(
        "Progress is gradual, which is ideal for long-term results and performance in the gym.",
      );
    }
  }

  if (bmi != null) {
    const label = Bmi_label(bmi);
    if (label === "Healthy") {
      parts.push(
        "Your BMI sits in the healthy range — focus on body composition and strength, not just the scale.",
      );
    } else if (
      label === "Overweight" &&
      goalProgress != null &&
      goalProgress > 0
    ) {
      parts.push(
        "You are moving toward your goal — consistency beats perfection on rest days.",
      );
    }
  }

  return parts.length
    ? parts.join(" ")
    : "Log weigh-ins and set your profile to unlock personalized insights.";
}
