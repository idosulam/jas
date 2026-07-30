import GlassCard from "../../UI/Glass_card";
import { format_money } from "../../../Lib/Format.js";

function HouseholdStats({
  tx_summary,
  budget_overview,
  combined_stats,
  members,
}) {
  return (
    <>
      {/* Quick Transaction Summary */}
      {tx_summary && (
        <div className="household__tx-summary">
          <GlassCard
            value={format_money(tx_summary.totalIncome)}
            label="Income"
            value_class_name="glass-card__value--green"
          />
          <GlassCard
            value={format_money(tx_summary.totalExpense)}
            label="Expenses"
            value_class_name="glass-card__value--orange"
          />
          <GlassCard
            value={format_money(tx_summary.balance)}
            label="Balance"
            value_class_name={
              tx_summary.balance >= 0
                ? "glass-card__value--green"
                : "glass-card__value--orange"
            }
          />
        </div>
      )}

      {/* Budget Quick Status */}
      {budget_overview && (
        <div className="household__budget-overview">
          <div
            className="household__budget-bar"
            style={{
              background:
                budget_overview.progress >= 100
                  ? "var(--color-danger, #f87171)"
                  : budget_overview.progress >= 85
                    ? "var(--color-warning, #fbbf24)"
                    : "var(--color-success, #34d399)",
              width: `${budget_overview.progress}%`,
            }}
          />
          <div className="household__budget-info">
            <span className="household__budget-label">
              💰 Budget: {format_money(budget_overview.totalSpent)} /{" "}
              {format_money(budget_overview.totalBudget)}
            </span>
            <span
              className={`household__budget-remaining ${budget_overview.remaining >= 0 ? "" : "household__budget-remaining--over"}`}
            >
              {budget_overview.remaining >= 0
                ? `${format_money(budget_overview.remaining)} left`
                : `${format_money(Math.abs(budget_overview.remaining))} over!`}
            </span>
          </div>
          {budget_overview.alerts.length > 0 && (
            <div className="household__budget-alerts">
              {budget_overview.alerts.map((a) => (
                <span
                  key={a.name}
                  className={`household__budget-alert ${a.over ? "household__budget-alert--over" : "household__budget-alert--warn"}`}
                >
                  {a.icon} {a.name} ({Math.round(a.pct)}%)
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Combined Earnings Stats */}
      <h3 className="household__section-title">Shift Earnings</h3>
      <div className="household__stats">
        <GlassCard
          className="household__stat"
          value={`${combined_stats.combined.hours.toFixed(1)}h`}
          label="Combined Hours"
        />
        <GlassCard
          className="household__stat"
          value={format_money(combined_stats.combined.pay)}
          label="Combined Pay"
        />
        <GlassCard
          className="household__stat"
          value={format_money(combined_stats.combined.tips)}
          label="Combined Tips"
        />
        <GlassCard
          className="household__stat household__stat--total"
          value={format_money(combined_stats.combined.total)}
          label="Combined Total"
        />
      </div>

      {/* Per-Member Breakdown */}
      {members.length > 1 && (
        <div className="household__breakdown">
          <h3 className="household__section-title">Per Member</h3>
          <div className="household__member-cards">
            {members.map((member) => {
              const s = combined_stats.byMember[member.user_id];
              if (!s) return null;
              return (
                <div
                  key={member.user_id}
                  className="household__member-card"
                >
                  <div className="household__member-header">
                    <span className="household__member-avatar">
                      {s.display_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="household__member-name">
                      {s.is_me ? "You" : s.display_name}
                    </span>
                    <span className="household__member-shifts">
                      {s.shiftCount} shifts
                    </span>
                  </div>
                  <div className="household__member-stats">
                    <div className="household__member-stat">
                      <span className="household__member-stat-value">
                        {s.hours.toFixed(1)}h
                      </span>
                      <span className="household__member-stat-label">
                        Hours
                      </span>
                    </div>
                    <div className="household__member-stat">
                      <span className="household__member-stat-value">
                        {format_money(s.pay)}
                      </span>
                      <span className="household__member-stat-label">
                        Pay
                      </span>
                    </div>
                    <div className="household__member-stat">
                      <span className="household__member-stat-value">
                        {format_money(s.tips)}
                      </span>
                      <span className="household__member-stat-label">
                        Tips
                      </span>
                    </div>
                    <div className="household__member-stat">
                      <span
                        className="household__member-stat-value"
                        style={{ color: "var(--color-primary, #818cf8)" }}
                      >
                        {format_money(s.total)}
                      </span>
                      <span className="household__member-stat-label">
                        Total
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default HouseholdStats;
