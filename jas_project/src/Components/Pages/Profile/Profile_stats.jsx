import { GlassCard } from "../../../components";
import {
  To_display_kg,
  Format_weight_both,
  Format_signed_delta,
} from "../../../Lib/weight";

export default function ProfileStats({ analytics, unit, unitLabel }) {
  return (
    <div className="profile__summary">
      <GlassCard
        className="profile__stat"
        value={Format_weight_both(analytics.currentKg)}
        label="Current weight"
      />
      <GlassCard
        className="profile__stat"
        value_class_name={
          analytics.totalChangeKg != null && analytics.totalChangeKg < 0
            ? "profile__stat-value--good"
            : ""
        }
        value={
          analytics.totalChangeKg != null
            ? Format_signed_delta(
                To_display_kg(analytics.totalChangeKg, unit),
                unitLabel,
              )
            : "—"
        }
        label="Total change"
      />
      <GlassCard
        className="profile__stat"
        value={
          analytics.weeklyChangeKg != null
            ? Format_signed_delta(
                To_display_kg(analytics.weeklyChangeKg, unit),
                `${unitLabel}/wk`,
              )
            : "—"
        }
        label="Weekly pace"
      />
      <GlassCard
        className="profile__stat"
        value={analytics.bmi != null ? analytics.bmi.toFixed(1) : "—"}
        label={`BMI${analytics.bmiCategory ? ` · ${analytics.bmiCategory}` : ""}`}
      />
    </div>
  );
}
