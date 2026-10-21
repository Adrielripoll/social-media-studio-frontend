import type { Period } from "./api";
export function formatCount(value: number | null | undefined) {
  return value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
        value,
      );
}
export function periodLabel(period: Pick<Period, "startDate" | "endDate">) {
  const date = (value: string) => value.split("-").reverse().join("/");
  return date(period.startDate) + " a " + date(period.endDate);
}
export function interactions(period: Period) {
  if (period.interactions !== undefined) {
    return period.interactions;
  }
  const values = [period.likes, period.comments, period.shares, period.saves];
  return values.some((value) => value === null || value === undefined)
    ? null
    : values.reduce<number>((sum, value) => sum + value!, 0);
}
export function engagementRate(period: Period) {
  if (period.reachBasis === "daily-average") {
    return null;
  }
  const total = interactions(period);
  return total === null || !period.reach ? null : (total / period.reach) * 100;
}
export function formatRate(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(
        value,
      ) + "%";
}
export function variation(current: number | null, previous: number | null) {
  if (current === null || previous === null)
    return { label: "Sem dados para comparar", direction: "neutral" };
  if (previous === 0)
    return {
      label: current === 0 ? "Sem variação" : "Sem base de comparação",
      direction: "neutral",
    };
  const change = ((current - previous) / previous) * 100;
  return {
    label:
      (change > 0 ? "+" : "") +
      new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
        change,
      ) +
      "%",
    direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
  };
}
