import {
  DAILY_METRICS,
  type DailyPoint,
  type DailyMetric,
} from "./daily-metrics";
import type { Period } from "./api";

export function calendarDates(start: string, end: string): string[] {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
  if (
    !valid(start) ||
    !valid(end) ||
    start > end ||
    (Date.parse(end) - Date.parse(start)) / 86400000 >= 1096
  ) {
    return [];
  }
  const dates: string[] = [];
  const date = new Date(start + "T12:00:00Z");
  while (date.toISOString().slice(0, 10) <= end) {
    dates.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return dates;
}

export function dailyHistory(
  points: DailyPoint[],
  start: string,
  end: string,
): Period[] {
  const byDate = new Map<string, Partial<Record<DailyMetric, number>>>();
  for (const point of points) {
    const values = byDate.get(point.date) ?? {};
    values[point.metric] = point.value;
    byDate.set(point.date, values);
  }
  return calendarDates(start, end).map((date) => {
    const values = byDate.get(date) ?? {};
    return {
      startDate: date,
      endDate: date,
      reach: values.reach ?? null,
      views: values.views ?? null,
      interactions: values.interactions ?? null,
      newFollowers: values.newFollowers ?? null,
      profileVisits: values.profileVisits ?? null,
      linkClicks: values.linkClicks ?? null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
    };
  });
}

export function summarizeDaily(history: Period[]): Period | undefined {
  if (!history.length) {
    return undefined;
  }
  const result: Period = {
    startDate: history[0].startDate,
    endDate: history[history.length - 1].endDate,
    reachBasis: "daily-average",
    reach: null,
    views: null,
    interactions: null,
    newFollowers: null,
    profileVisits: null,
    linkClicks: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
  };
  for (const { key } of DAILY_METRICS) {
    const values = history
      .map((period) => period[key])
      .filter((value): value is number => typeof value === "number");
    if (key === "reach") {
      result.reach = values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;
    } else {
      // A partial series cannot be presented as a total for the entire interval.
      result[key] =
        values.length === history.length
          ? values.reduce((sum, value) => sum + value, 0)
          : null;
    }
  }
  return result;
}

export function defaultDailyRange(points: DailyPoint[]): {
  start: string;
  end: string;
} {
  const dates = points.map((point) => point.date).sort();
  const end = dates.at(-1) ?? "";
  if (!end) {
    return { start: "", end: "" };
  }
  const oldest = new Date(end + "T12:00:00Z");
  oldest.setUTCDate(oldest.getUTCDate() - 1095);
  return {
    start:
      dates[0] > oldest.toISOString().slice(0, 10)
        ? dates[0]
        : oldest.toISOString().slice(0, 10),
    end,
  };
}
