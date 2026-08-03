import { Glass_card } from "../../../Components";
import Stat_grid from "../../UI/Stat_grid";
import {
  To_display_kg,
  Format_weight_both,
  Format_signed_delta,
} from "../../../Lib/Weight";

export default function Profile_stats({ analytics, unit, unitLabel }) {
  return (
    <Stat_grid
      className="profile__summary"
      stats={[
        { value: Format_weight_both(analytics.currentKg), label: "Current weight", className: "profile__stat" },
        {
          value: analytics.totalChangeKg != null
            ? Format_signed_delta(To_display_kg(analytics.totalChangeKg, unit), unitLabel)
            : "—",
          label: "Total change",
          className: "profile__stat",
          valueClassName: analytics.totalChangeKg != null && analytics.totalChangeKg < 0 ? "profile__stat-value--good" : "",
        },
        {
          value: analytics.weeklyChangeKg != null
            ? Format_signed_delta(To_display_kg(analytics.weeklyChangeKg, unit), `${unitLabel}/wk`)
            : "—",
          label: "Weekly pace",
          className: "profile__stat",
        },
        { value: analytics.bmi != null ? analytics.bmi.toFixed(1) : "—", label: `BMI${analytics.bmiCategory ? ` · ${analytics.bmiCategory}` : ""}`, className: "profile__stat" },
      ]}
    />
  );
}
