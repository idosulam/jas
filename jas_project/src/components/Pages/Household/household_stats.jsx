import GlassCard from "../../ui/glass_card";
import { formatMoney } from "../../../lib/format.js";

function HouseholdStats({
  txSummary,
  budgetOverview,
  combinedStats,
  members,
}) {
  return (
    <>
      {/* Quick Transaction Summary */}
      {txSummary && (
        <div className="household__tx-summary">
          <GlassCard
            value={formatMoney(txSummary.totalIncome)}
            label="Income"
            valueClassName="glass-card__value--green"
          />
          <GlassCard
            value={formatMoney(txSummary.totalExpense)}
            label="Expenses"
            valueClassName="glass-card__value--orange"
          />
          <GlassCard
            value={formatMoney(txSummary.balance)}
            label="Balance"
            valueClassName={
              txSummary.balance >= 0
                ? "glass-card__value--green"
                : "glass-card__value--orange"
            }
          />
        </div>
      )}

      {/* Budget Quick Status */}
      {budgetOverview && (
        <div className="household__budget-overview">
          <div
            className="household__budget-bar"
            style={{
              background:
                budgetOverview.progress >= 100
                  ? "var(--color-danger, #f87171)"
                  : budgetOverview.progress >= 85
                    ? "var(--color-warning, #fbbf24)"
                    : "var(--color-success, #34d399)",
              width: `${budgetOverview.progress}%`,
            }}
          />
          <div className="household__budget-info">
            <span className="household__budget-label">
              💰 Budget: {formatMoney(budgetOverview.totalSpent)} /{" "}
              {formatMoney(budgetOverview.totalBudget)}
            </span>
            <span
              className={`household__budget-remaining ${budgetOverview.remaining >= 0 ? "" : "household__budget-remaining--over"}`}
            >
              {budgetOverview.remaining >= 0
                ? `${formatMoney(budgetOverview.remaining)} left`
                : `${formatMoney(Math.abs(budgetOverview.remaining))} over!`}
            </span>
          </div>
          {budgetOverview.alerts.length > 0 && (
            <div className="household__budget-alerts">
              {budgetOverview.alerts.map((a) => (
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
          value={`${combinedStats.combined.hours.toFixed(1)}h`}
          label="Combined Hours"
        />
        <GlassCard
          className="household__stat"
          value={formatMoney(combinedStats.combined.pay)}
          label="Combined Pay"
        />
        <GlassCard
          className="household__stat"
          value={formatMoney(combinedStats.combined.tips)}
          label="Combined Tips"
        />
        <GlassCard
          className="household__stat household__stat--total"
          value={formatMoney(combinedStats.combined.total)}
          label="Combined Total"
        />
      </div>

      {/* Per-Member Breakdown */}
      {members.length > 1 && (
        <div className="household__breakdown">
          <h3 className="household__section-title">Per Member</h3>
          <div className="household__member-cards">
            {members.map((member) => {
              const s = combinedStats.byMember[member.user_id];
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
                        {formatMoney(s.pay)}
                      </span>
                      <span className="household__member-stat-label">
                        Pay
                      </span>
                    </div>
                    <div className="household__member-stat">
                      <span className="household__member-stat-value">
                        {formatMoney(s.tips)}
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
                        {formatMoney(s.total)}
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
