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

/**
 * Resolve a color key (named or hex) to accent/bg values.
 * Named keys look up EVENT_COLORS; hex values generate accent + bg directly.
 */
export function Resolve_color(color_key) {
  if (EVENT_COLORS[color_key]) return EVENT_COLORS[color_key];
  // Treat as hex color
  const hex = color_key && color_key.startsWith("#") ? color_key : "#818cf8";
  return {
    label: "Custom",
    accent: hex,
    bg: hex + "44", // hex with ~27% alpha
  };
}

export function Parse_time_to_minutes(time_str) {
  const [h, m] = time_str.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function Format_time_12(time_str) {
  const [h, m] = time_str.slice(0, 5).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export { To_date_key, Add_days, Start_of_week } from "../../../Lib/Date_utils";

function Events_overlap(a, b) {
  return a.start < b.end && a.end > b.start;
}

function Merge_clusters(clusters) {
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const shouldMerge = clusters[i].some((a) =>
          clusters[j].some((b) => Events_overlap(a, b)),
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

function Layout_cluster(cluster) {
  const sorted = [...cluster].sort(
    (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start),
  );

  const column_ends = [];
  const laid = sorted.map((event) => {
    let column = column_ends.findIndex((end) => end <= event.start);
    if (column === -1) {
      column = column_ends.length;
      column_ends.push(0);
    }
    column_ends[column] = event.end;
    return { ...event, column };
  });

  const total_columns = column_ends.length;
  return laid.map((event) => ({ ...event, total_columns }));
}

export function Layout_overlapping_events(events) {
  const parsed = events.map((event) => ({
    ...event,
    start: Parse_time_to_minutes(event.start_time),
    end: Parse_time_to_minutes(event.end_time),
  }));

  const sorted = [...parsed].sort((a, b) => a.start - b.start);
  const clusters = [];

  for (const event of sorted) {
    let placed = false;
    for (const cluster of clusters) {
      if (cluster.some((item) => Events_overlap(item, event))) {
        cluster.push(event);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([event]);
  }

  return Merge_clusters(clusters).flatMap(Layout_cluster);
}

export function Event_style(layout_event) {
  const day_start_min = DAY_START_HOUR * 60;
  const day_end_min = (DAY_END_HOUR + 1) * 60;
  const clamped_start = Math.max(layout_event.start, day_start_min);
  const clamped_end = Math.min(layout_event.end, day_end_min);

  if (clamped_end <= clamped_start) return null;

  const top = ((clamped_start - day_start_min) / 60) * HOUR_HEIGHT;
  const height = Math.max(
    ((clamped_end - clamped_start) / 60) * HOUR_HEIGHT - 4,
    28,
  );
  const width_pct = 100 / layout_event.total_columns;
  const left_pct = layout_event.column * width_pct;

  return {
    top: `${top}px`,
    height: `${height}px`,
    width: `calc(${width_pct}% - 4px)`,
    left: `calc(${left_pct}% + 2px)`,
  };
}
