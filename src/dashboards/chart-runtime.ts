import {
  Chart,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import type { ChartConfiguration, ChartOptions } from "chart.js";
import { formatCount, formatRate } from "./metrics";

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

export type ChartKind = "line" | "bar" | "doughnut";
export type ChartConfig = ChartConfiguration<
  ChartKind,
  (number | null)[],
  string
>;
export const palette = {
  primary: "#7b5322",
  hero: "#ecc38a",
  comparison: "#c7b8a6",
  teal: "#4c3923",
  amber: "#ac6a1b",
  blue: "#1c1815",
  grid: "#e8e0d5",
  text: "#6e6052",
};
export const interactionMetrics = [
  { key: "likes", label: "Curtidas", color: palette.primary },
  { key: "comments", label: "Comentários", color: palette.amber },
  { key: "shares", label: "Compartilhamentos", color: palette.teal },
  { key: "saves", label: "Salvamentos", color: palette.blue },
] as const;

const compact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export function chartOptions(
  rate = false,
  dark = false,
): ChartOptions<ChartKind> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    locale: "pt-BR",
    interaction: { mode: "index", intersect: false },
    layout: { padding: { top: 8, right: 8 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1c1815",
        titleColor: "#fff",
        bodyColor: "#fff",
        padding: 12,
        cornerRadius: 8,
        boxPadding: 5,
        usePointStyle: true,
        callbacks: {
          label: (item) => {
            const value = typeof item.raw === "number" ? item.raw : null;
            return (
              item.dataset.label +
              ": " +
              (rate ? formatRate(value) : formatCount(value))
            );
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: dark ? "#d6c6b3" : palette.text,
          font: { size: 11 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
        },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: dark ? "#ffffff12" : palette.grid },
        ticks: {
          color: dark ? "#d6c6b3" : palette.text,
          font: { size: 11 },
          maxTicksLimit: 5,
          ...(rate
            ? { callback: (value) => formatRate(Number(value)) }
            : {
                precision: 0,
                callback: (value) => compact.format(Number(value)),
              }),
        },
      },
    },
  };
}
export { Chart };

export function areaFill(color: string) {
  return (context: { chart: Pick<Chart, "ctx" | "chartArea"> }) => {
    const { ctx, chartArea } = context.chart;
    if (!chartArea) return color + "20";
    const gradient = ctx.createLinearGradient(
      0,
      chartArea.top,
      0,
      chartArea.bottom,
    );
    gradient.addColorStop(0, color + "65");
    gradient.addColorStop(1, color + "00");
    return gradient;
  };
}
