import { GlassCard } from "../../../components";
import {
  toDisplayKg,
  formatWeight,
  formatSignedDelta,
} from "../../../lib/weight";

export default function ProfileStats({ analytics, unit, unitLabel }) {
  return (
    <div className="profile__summary">
      <GlassCard
        className="profile__stat"
        value={formatWeight(
          analytics.currentKg != null
            ? toDisplayKg(analytics.currentKg, unit)
            : null,
          unitLabel,
        )}
        label="Current weight"
      />
      <GlassCard
        className="profile__stat"
        valueClassName={
          analytics.totalChangeKg != null && analytics.totalChangeKg < 0
            ? "profile__stat-value--good"
            : ""
        }
        value={
          analytics.totalChangeKg != null
            ? formatSignedDelta(
                toDisplayKg(analytics.totalChangeKg, unit),
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
            ? formatSignedDelta(
                toDisplayKg(analytics.weeklyChangeKg, unit),
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
