import type { Period } from "./api";

export default function MetricSparkline({
  periods,
  value,
}: {
  periods: Period[];
  value: (period: Period) => number | null;
}) {
  const values = [...periods]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(-12)
    .map(value);
  const known = values.filter((item): item is number => item !== null);
  if (known.length < 2) return null;
  const min = Math.min(...known),
    range = Math.max(...known) - min || 1;
  let gap = true;
  const path = values
    .map((item, index) => {
      if (item === null) {
        gap = true;
        return "";
      }
      const point =
        (gap ? "M" : "L") +
        ((index / Math.max(values.length - 1, 1)) * 94 + 3).toFixed(1) +
        "," +
        (29 - ((item - min) / range) * 22).toFixed(1);
      gap = false;
      return point;
    })
    .join(" ");
  return (
    <svg
      className="dashboard-kpi-sparkline"
      viewBox="0 0 100 36"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
