import { Glass_card } from "../../../Components";
import {
  To_display_kg,
  Format_weight_both,
  Format_signed_delta,
} from "../../../Lib/Weight";

export default function Profile_stats({ analytics, unit, unitLabel }) {
  return (
    <div className="profile__summary">
      <Glass_card
        className="profile__stat"
        value={Format_weight_both(analytics.currentKg)}
        label="Current weight"
      />
      <Glass_card
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
      <Glass_card
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
      <Glass_card
        className="profile__stat"
        value={analytics.bmi != null ? analytics.bmi.toFixed(1) : "—"}
        label={`BMI${analytics.bmiCategory ? ` · ${analytics.bmiCategory}` : ""}`}
      />
    </div>
  );
}
