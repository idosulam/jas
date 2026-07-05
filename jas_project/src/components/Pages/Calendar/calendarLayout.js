export const HOUR_HEIGHT = 56;
export const DAY_START_HOUR = 0;
export const DAY_END_HOUR = 23;
export const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR + 1;

export const EVENT_COLORS = {
  indigo: {
    label: "Indigo",
    accent: "#818cf8",
    bg: "rgba(99, 102, 241, 0.28)",
  },
  pink: { label: "Pink", accent: "#f472b6", bg: "rgba(236, 72, 153, 0.28)" },
  orange: {
    label: "Orange",
    accent: "#fb923c",
    bg: "rgba(251, 146, 60, 0.28)",
  },
  green: { label: "Green", accent: "#4ade80", bg: "rgba(34, 197, 94, 0.28)" },
  cyan: { label: "Cyan", accent: "#22d3ee", bg: "rgba(6, 182, 212, 0.28)" },
};

export function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function formatTime12(timeStr) {
  const [h, m] = timeStr.slice(0, 5).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function eventsOverlap(a, b) {
  return a.start < b.end && a.end > b.start;
}

function mergeClusters(clusters) {
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const shouldMerge = clusters[i].some((a) =>
          clusters[j].some((b) => eventsOverlap(a, b)),
        );
        if (shouldMerge) {
          clusters[i] = [...clusters[i], ...clusters[j]];
          clusters.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }
  return clusters;
}

function layoutCluster(cluster) {
  const sorted = [...cluster].sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start),
  );

  const columnEnds = [];
  const laid = sorted.map((event) => {
    let column = columnEnds.findIndex((end) => end <= event.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(0);
    }
    columnEnds[column] = event.end;
    return { ...event, column };
  });

  const totalColumns = columnEnds.length;
  return laid.map((event) => ({ ...event, totalColumns }));
}

export function layoutOverlappingEvents(events) {
  const parsed = events.map((event) => ({
    ...event,
    start: parseTimeToMinutes(event.start_time),
    end: parseTimeToMinutes(event.end_time),
  }));

  const sorted = [...parsed].sort((a, b) => a.start - b.start);
  const clusters = [];

  for (const event of sorted) {
    let placed = false;
    for (const cluster of clusters) {
      if (cluster.some((item) => eventsOverlap(item, event))) {
        cluster.push(event);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([event]);
  }

  return mergeClusters(clusters).flatMap(layoutCluster);
}

export function eventStyle(layoutEvent) {
  const dayStartMin = DAY_START_HOUR * 60;
  const dayEndMin = (DAY_END_HOUR + 1) * 60;
  const clampedStart = Math.max(layoutEvent.start, dayStartMin);
  const clampedEnd = Math.min(layoutEvent.end, dayEndMin);

  if (clampedEnd <= clampedStart) return null;

  const top = ((clampedStart - dayStartMin) / 60) * HOUR_HEIGHT;
  const height = Math.max(
    ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 2,
    28,
  );
  const widthPct = 100 / layoutEvent.totalColumns;
  const leftPct = layoutEvent.column * widthPct;

  return {
    top: `${top}px`,
    height: `${height}px`,
    width: `calc(${widthPct}% - 4px)`,
    left: `calc(${leftPct}% + 2px)`,
  };
}
