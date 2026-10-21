import { useState } from "react";
import { DAILY_METRICS, type DailyMetric, type Period } from "./api";
import ChartPanel, { ChartCanvas } from "./ChartPanel";
import {
  areaFill,
  chartOptions,
  palette,
  type ChartConfig,
} from "./chart-runtime";
import { formatCount, periodLabel } from "./metrics";

function DailyChart({
  periods,
  metric,
  title,
  bars = false,
  wide = false,
}: {
  periods: Period[];
  metric: DailyMetric;
  title: string;
  bars?: boolean;
  wide?: boolean;
}) {
  const color =
    metric === "newFollowers"
      ? palette.teal
      : metric === "interactions"
        ? palette.amber
        : palette.primary;
  const config: ChartConfig = {
    type: bars ? "bar" : "line",
    data: {
      labels: periods.map((period) =>
        period.startDate.split("-").reverse().join("/"),
      ),
      datasets: [
        {
          label: title,
          data: periods.map((period) => period[metric] ?? null),
          borderColor: color,
          backgroundColor: bars ? color : areaFill(color),
          fill: !bars,
          tension: 0.18,
          borderWidth: 2,
          pointRadius: periods.length > 40 ? 0 : 2,
          spanGaps: false,
        },
      ],
    },
    options: chartOptions(),
  };
  return (
    <ChartPanel
      title={title}
      description="Resultados por dia no intervalo selecionado."
      wide={wide}
      badge={bars ? "Barras diárias" : "Evolução diária"}
      headers={["Data", title]}
      rows={periods.map((period) => [
        period.startDate.split("-").reverse().join("/"),
        formatCount(period[metric]),
      ])}
      footnote={
        metric === "reach"
          ? "O alcance é diário: uma pessoa pode aparecer em vários dias. A média diária não representa pessoas únicas no período."
          : "Lacunas indicam dados não informados; zero é um resultado medido. Nos seguidores, os dias ausentes dentro do intervalo do arquivo valem zero."
      }
    >
      <ChartCanvas config={config} label={title + " por dia"} />
    </ChartPanel>
  );
}

export default function MetaDashboardCharts({
  periods,
}: {
  periods: Period[];
}) {
  const [metric, setMetric] = useState<DailyMetric>("views");
  const totals = periods.map((period) => period[metric]);
  let accumulated = 0;
  let complete = true;
  const cumulative = totals.map((value) => {
    if (value === null || value === undefined) {
      complete = false;
    }
    if (!complete) {
      return null;
    }
    accumulated += value ?? 0;
    return accumulated;
  });
  const selected = DAILY_METRICS.find((item) => item.key === metric)!;
  const config: ChartConfig = {
    type: "line",
    data: {
      labels: periods.map((period) =>
        period.startDate.split("-").reverse().join("/"),
      ),
      datasets: [
        {
          label: selected.label,
          data: cumulative,
          fill: true,
          borderColor: palette.teal,
          backgroundColor: areaFill(palette.teal),
          pointRadius: periods.length > 40 ? 0 : 2,
          spanGaps: false,
        },
      ],
    },
    options: chartOptions(),
  };
  return (
    <section
      className="dashboard-visual-report"
      aria-label="Gráficos dos resultados"
    >
      <div className="dashboard-section-heading">
        <div>
          <span className="eyebrow">Além dos números</span>
          <h2>Resultados dia a dia</h2>
        </div>
        <p>Acompanhe tendências nas métricas exportadas pela Meta.</p>
      </div>
      <div className="dashboard-charts">
        <DailyChart
          periods={periods}
          metric="reach"
          title="Alcance diário"
          wide
        />
        <DailyChart periods={periods} metric="views" title="Visualizações" />
        <DailyChart
          periods={periods}
          metric="interactions"
          title="Interações com o conteúdo"
          bars
        />
        <DailyChart
          periods={periods}
          metric="newFollowers"
          title="Novos seguidores"
          bars
        />
        <DailyChart
          periods={periods}
          metric="profileVisits"
          title="Visitas ao perfil"
        />
        <DailyChart
          periods={periods}
          metric="linkClicks"
          title="Cliques no link"
          bars
        />
        <ChartPanel
          title="Resultados acumulados"
          description="Acúmulo desde o primeiro dia selecionado. O alcance não é somado."
          headers={["Data", selected.label]}
          rows={periods.map((period, index) => [
            periodLabel(period),
            formatCount(cumulative[index]),
          ])}
          controls={
            <label>
              Métrica acumulada
              <select
                aria-label="Métrica acumulada"
                value={metric}
                onChange={(event) =>
                  setMetric(event.target.value as DailyMetric)
                }
              >
                {DAILY_METRICS.filter((item) => item.key !== "reach").map(
                  (item) => (
                    <option value={item.key} key={item.key}>
                      {item.label}
                    </option>
                  ),
                )}
              </select>
            </label>
          }
          footnote="Uma lacuna interrompe o acumulado para evitar um total incompleto."
        >
          <ChartCanvas
            config={config}
            label={"Acumulado de " + selected.label}
          />
        </ChartPanel>
      </div>
    </section>
  );
}
