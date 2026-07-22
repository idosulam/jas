import { useMemo, useState } from "react";

function formatMoney(amount) {
  return `₪${Number(amount || 0).toFixed(2)}`;
}

function Analytics({ transactions, members, month, year }) {
  const [activeTab, setActiveTab] = useState("expense"); // expense | income
  const [hoveredCategory, setHoveredCategory] = useState(null);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Filter by type
  const filtered = useMemo(() => {
    return transactions.filter((t) => t.type === activeTab);
  }, [transactions, activeTab]);

  // Category breakdown
  const categories = useMemo(() => {
    const map = {};
    filtered.forEach((t) => {
      const key = t.category_id || t.category_name;
      if (!map[key]) {
        map[key] = {
          id: key,
          name: t.category_name,
          icon: t.category_icon,
          color: t.category_color,
          total: 0,
          count: 0,
          transactions: [],
        };
      }
      map[key].total += Number(t.amount);
      map[key].count += 1;
      map[key].transactions.push(t);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const grandTotal = categories.reduce((sum, c) => sum + c.total, 0);

  // Donut chart data
  const donutData = useMemo(() => {
    if (grandTotal === 0) return [];
    const size = 160;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = 65;
    const innerR = 42;
    const gap = 0.02; // gap between segments in radians

    let currentAngle = -Math.PI / 2; // start from top
    const segments = [];

    categories.forEach((cat) => {
      const fraction = cat.total / grandTotal;
      const sweepAngle = fraction * 2 * Math.PI - gap;
      if (sweepAngle <= 0) return;

      const startAngle = currentAngle + gap / 2;
      const endAngle = startAngle + sweepAngle;

      const x1Outer = cx + outerR * Math.cos(startAngle);
      const y1Outer = cy + outerR * Math.sin(startAngle);
      const x2Outer = cx + outerR * Math.cos(endAngle);
      const y2Outer = cy + outerR * Math.sin(endAngle);
      const x1Inner = cx + innerR * Math.cos(endAngle);
      const y1Inner = cy + innerR * Math.sin(endAngle);
      const x2Inner = cx + innerR * Math.cos(startAngle);
      const y2Inner = cy + innerR * Math.sin(startAngle);

      const largeArc = sweepAngle > Math.PI ? 1 : 0;

      const path = [
        `M ${x1Outer} ${y1Outer}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
        `L ${x1Inner} ${y1Inner}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
        "Z",
      ].join(" ");

      segments.push({
        path,
        color: cat.color,
        name: cat.name,
        percentage: (fraction * 100).toFixed(1),
      });

      currentAngle += fraction * 2 * Math.PI;
    });

    return segments;
  }, [categories, grandTotal]);

  // Per-member breakdown
  const memberBreakdown = useMemo(() => {
    return members.map((member) => {
      const memberTx = filtered.filter((t) => t.user_id === member.user_id);
      const total = memberTx.reduce((sum, t) => sum + Number(t.amount), 0);
      return {
        ...member,
        total,
        count: memberTx.length,
      };
    }).filter((m) => m.total > 0).sort((a, b) => b.total - a.total);
  }, [filtered, members]);

  const maxMemberTotal = memberBreakdown.length > 0
    ? Math.max(...memberBreakdown.map((m) => m.total))
    : 0;

  // Daily trend
  const dailyTrend = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const data = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayTotal = filtered
        .filter((t) => t.transaction_date === dateStr)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      data.push({ day: d, date: dateStr, total: dayTotal });
    }
    return data;
  }, [filtered, month, year]);

  const maxDaily = Math.max(...dailyTrend.map((d) => d.total), 1);

  return (
    <div className="analytics">
      {/* Type Toggle */}
      <div className="analytics__tabs">
        <button
          className={`analytics__tab ${activeTab === "expense" ? "active" : ""}`}
          onClick={() => setActiveTab("expense")}
        >
          Expenses
        </button>
        <button
          className={`analytics__tab ${activeTab === "income" ? "active" : ""}`}
          onClick={() => setActiveTab("income")}
        >
          Income
        </button>
      </div>

      {/* Donut Chart + Total */}
      <div className="analytics__donut-section">
        {grandTotal > 0 ? (
          <div className="analytics__donut-wrap">
            <svg viewBox="0 0 160 160" className="analytics__donut">
              {donutData.map((seg, i) => (
                <path
                  key={i}
                  d={seg.path}
                  fill={seg.color}
                  opacity={hoveredCategory && hoveredCategory !== seg.name ? 0.3 : 1}
                  onMouseEnter={() => setHoveredCategory(seg.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  style={{ transition: "opacity 0.2s", cursor: "pointer" }}
                />
              ))}
            </svg>
            <div className="analytics__donut-center">
              <span className="analytics__donut-total">{formatMoney(grandTotal)}</span>
              <span className="analytics__donut-label">
                {activeTab === "expense" ? "Total Spent" : "Total Earned"}
              </span>
            </div>
          </div>
        ) : (
          <div className="analytics__donut-empty">
            <span className="analytics__donut-empty-icon">📊</span>
            <span>No {activeTab} data yet</span>
          </div>
        )}
      </div>

      {/* Category List */}
      {categories.length > 0 && (
        <div className="analytics__categories">
          <h3 className="analytics__section-title">Categories</h3>
          <div className="analytics__category-list">
            {categories.map((cat) => {
              const pct = grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0;
              return (
                <div
                  key={cat.id}
                  className="analytics__category-item"
                  onMouseEnter={() => setHoveredCategory(cat.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  <div className="analytics__category-left">
                    <span
                      className="analytics__category-dot"
                      style={{ background: cat.color }}
                    />
                    <span className="analytics__category-icon">{cat.icon}</span>
                    <div className="analytics__category-info">
                      <span className="analytics__category-name">{cat.name}</span>
                      <span className="analytics__category-count">
                        {cat.count} transaction{cat.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="analytics__category-right">
                    <span className="analytics__category-amount">{formatMoney(cat.total)}</span>
                    <span className="analytics__category-pct">{pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Member Breakdown */}
      {memberBreakdown.length > 1 && (
        <div className="analytics__members">
          <h3 className="analytics__section-title">By Member</h3>
          <div className="analytics__member-list">
            {memberBreakdown.map((member) => {
              const pct = grandTotal > 0 ? (member.total / grandTotal) * 100 : 0;
              return (
                <div key={member.user_id} className="analytics__member-item">
                  <div className="analytics__member-left">
                    <span className="analytics__member-avatar">
                      {member.display_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="analytics__member-name">
                      {member.is_me ? "You" : member.display_name}
                    </span>
                  </div>
                  <div className="analytics__member-right">
                    <div className="analytics__member-bar-wrap">
                      <div
                        className="analytics__member-bar"
                        style={{
                          width: `${maxMemberTotal > 0 ? (member.total / maxMemberTotal) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="analytics__member-amount">{formatMoney(member.total)}</span>
                    <span className="analytics__member-pct">{pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Trend Mini Chart */}
      {dailyTrend.some((d) => d.total > 0) && (
        <div className="analytics__trend">
          <h3 className="analytics__section-title">Daily Trend</h3>
          <div className="analytics__trend-chart">
            {dailyTrend.map((d) => {
              const height = maxDaily > 0 ? (d.total / maxDaily) * 100 : 0;
              return (
                <div key={d.day} className="analytics__trend-bar-wrap" title={`${d.date}: ${formatMoney(d.total)}`}>
                  <div
                    className="analytics__trend-bar"
                    style={{
                      height: `${Math.max(height, 2)}%`,
                      background: activeTab === "expense" ? "#f97316" : "#22c55e",
                      opacity: d.total > 0 ? 1 : 0.15,
                    }}
                  />
                  {d.day % 5 === 1 && (
                    <span className="analytics__trend-label">{d.day}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;
