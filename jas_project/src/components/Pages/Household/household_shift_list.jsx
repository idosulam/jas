import EarningsChart from "./earnings_chart";
import { formatMoney } from "../../../lib/format.js";

function HouseholdShiftList({
  todayShifts,
  workplaces,
  chartData,
  members,
  month,
  year,
}) {
  return (
    <>
      {/* Today's Shifts */}
      {todayShifts.length > 0 && (
        <div className="household__today">
          <h3 className="household__section-title">Today</h3>
          <div className="household__today-cards">
            {todayShifts.map((shift) => {
              const wp = workplaces[shift.user_id]?.[shift.place];
              return (
                <div key={shift.id} className="household__today-card">
                  <span
                    className="household__today-dot"
                    style={{ background: wp?.color || "#818cf8" }}
                  />
                  <div className="household__today-info">
                    <span className="household__today-name">
                      {shift.display_name} — {wp?.label || shift.place}
                    </span>
                    <span className="household__today-detail">
                      {shift.hours}h · {formatMoney(shift.tips)} tips
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Earnings Chart */}
      <div className="household__chart-section">
        <h3 className="household__section-title">Daily Earnings</h3>
        <EarningsChart
          data={chartData}
          members={members}
          month={month}
          year={year}
        />
      </div>
    </>
  );
}

export default HouseholdShiftList;
