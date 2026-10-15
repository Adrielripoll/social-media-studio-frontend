import { useState } from "react";
import type { Period } from "./api";
import ChartPanel, { ChartCanvas, ChartLegend } from "./ChartPanel";
import {
  chartOptions,
  areaFill,
  interactionMetrics,
  palette,
  type ChartConfig,
} from "./chart-runtime";
import {
  engagementRate,
  formatCount,
  formatRate,
  interactions,
  periodLabel,
} from "./metrics";

type Props = { periods: Period[]; current: Period };
const label = (period: Period) =>
  period.startDate.slice(8) +
  "/" +
  period.startDate.slice(5, 7) +
  "/" +
  period.startDate.slice(2, 4);
const isSelected = (period: Period, current: Period) =>
  period.startDate === current.startDate;
const missingNote =
  "Dados ausentes aparecem como lacunas; zero é um resultado informado.";

function historyOptions(periods: Period[], rate = false, dark = false) {
  const options = chartOptions(rate, dark);
  options.plugins!.tooltip!.callbacks!.title = (items) =>
    items.length ? periodLabel(periods[items[0].dataIndex]) : "";
  return options;
}
function pointStyle(periods: Period[], current: Period, color: string) {
  return {
    pointRadius: periods.map((period) =>
      isSelected(period, current) ? 5 : periods.length > 40 ? 0 : 3,
    ),
    pointBackgroundColor: periods.map((period) =>
      isSelected(period, current) ? color : "#fff",
    ),
    pointBorderColor: color,
    pointBorderWidth: 2,
    pointHoverRadius: 6,
    pointHitRadius: 12,
  };
}
function historyNote(periods: Period[]) {
  return periods.length < 2
    ? "Importe outro período para visualizar a evolução. " + missingNote
    : "Todos os períodos importados, em ordem cronológica. O ponto destacado indica o período selecionado. " +
        missingNote;
}

export function ResultsEvolution({ periods, current }: Props) {
  const [metric, setMetric] = useState<"reach" | "views" | "interactions">(
    "reach",
  );
  const choices = [
    { key: "reach", label: "Alcance" },
    { key: "views", label: "Visualizações" },
    { key: "interactions", label: "Interações" },
  ] as const;
  const selected = choices.find((item) => item.key === metric)!;
  const value = (period: Period) =>
    metric === "interactions" ? interactions(period) : period[metric];
  const config: ChartConfig = {
    type: "line",
    data: {
      labels: periods.map(label),
      datasets: [
        {
          label: selected.label,
          data: periods.map(value),
          borderColor: palette.hero,
          backgroundColor: areaFill(palette.hero),
          fill: true,
          tension: 0.18,
          borderWidth: 2.5,
          spanGaps: false,
          ...pointStyle(periods, current, palette.hero),
        },
      ],
    },
    options: historyOptions(periods, false, true),
  };
  return (
    <ChartPanel
      title="Evolução dos resultados"
      wide
      className="dashboard-chart-hero"
      badge={periods.length + " períodos"}
      description="A trajetória do perfil, com os resultados de cada período importado."
      controls={
        <div
          className="dashboard-chart-switch"
          role="group"
          aria-label="Métrica da evolução"
        >
          {choices.map((choice) => (
            <button
              type="button"
              key={choice.key}
              aria-pressed={metric === choice.key}
              onClick={() => setMetric(choice.key)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      }
      headers={["Período", selected.label]}
      rows={periods.map((period) => [
        periodLabel(period),
        formatCount(value(period)),
      ])}
      footnote={historyNote(periods)}
    >
      <div className="dashboard-chart-highlight">
        <strong>{formatCount(value(current))}</strong>
        <span>
          {selected.label.toLocaleLowerCase("pt-BR")} no período selecionado
          <br />
          <small>{periodLabel(current)}</small>
        </span>
      </div>
      <ChartCanvas
        config={config}
        label={"Evolução de " + selected.label.toLocaleLowerCase("pt-BR")}
        className="dashboard-canvas-hero"
      />
    </ChartPanel>
  );
}

export function InteractionHistory({ periods }: Props) {
  const options = historyOptions(periods);
  options.scales!.x!.stacked = true;
  options.scales!.y!.stacked = true;
  const config: ChartConfig = {
    type: "bar",
    data: {
      labels: periods.map(label),
      datasets: interactionMetrics.map((metric) => ({
        label: metric.label,
        data: periods.map((period) =>
          interactions(period) === null ? null : period[metric.key],
        ),
        backgroundColor: metric.color,
        borderRadius: 3,
        maxBarThickness: 44,
      })),
    },
    options,
  };
  return (
    <ChartPanel
      title="Interações ao longo do tempo"
      badge="Barras empilhadas"
      description="Veja como cada tipo de interação contribuiu em cada período."
      headers={[
        "Período",
        ...interactionMetrics.map((item) => item.label),
        "Total",
      ]}
      rows={periods.map((period) => [
        periodLabel(period),
        ...interactionMetrics.map((item) => formatCount(period[item.key])),
        formatCount(interactions(period)),
      ])}
      footnote="Uma barra só é exibida quando os quatro tipos de interação estão informados."
    >
      <ChartLegend
        items={interactionMetrics.map((item) => ({
          label: item.label,
          color: item.color,
        }))}
      />
      <ChartCanvas config={config} label="Histórico de interações por tipo" />
    </ChartPanel>
  );
}

export function FollowersHistory({ periods, current }: Props) {
  const config: ChartConfig = {
    type: "bar",
    data: {
      labels: periods.map(label),
      datasets: [
        {
          label: "Novos seguidores",
          data: periods.map((period) => period.newFollowers),
          backgroundColor: periods.map((period) =>
            isSelected(period, current) ? palette.teal : "#b6e4d8",
          ),
          borderRadius: 5,
          maxBarThickness: 44,
        },
      ],
    },
    options: historyOptions(periods),
  };
  return (
    <ChartPanel
      title="Novos seguidores"
      className="dashboard-chart-followers"
      badge="Aquisição"
      description="Quantas pessoas começaram a seguir o perfil em cada período."
      headers={["Período", "Novos seguidores"]}
      rows={periods.map((period) => [
        periodLabel(period),
        formatCount(period.newFollowers),
      ])}
      footnote="Novos seguidores por período; não representa o total de seguidores nem o saldo líquido."
    >
      <div className="dashboard-chart-highlight compact">
        <strong>{formatCount(current.newFollowers)}</strong>
        <span>no período selecionado</span>
      </div>
      <ChartCanvas config={config} label="Histórico de novos seguidores" />
    </ChartPanel>
  );
}

export function EngagementHistory({ periods, current }: Props) {
  const config: ChartConfig = {
    type: "line",
    data: {
      labels: periods.map(label),
      datasets: [
        {
          label: "Engajamento por alcance",
          data: periods.map(engagementRate),
          borderColor: palette.primary,
          backgroundColor: areaFill(palette.primary),
          borderWidth: 2.5,
          tension: 0.18,
          spanGaps: false,
          fill: true,
          ...pointStyle(periods, current, palette.primary),
        },
      ],
    },
    options: historyOptions(periods, true),
  };
  return (
    <ChartPanel
      title="Taxa de engajamento"
      className="dashboard-chart-engagement"
      badge="Qualidade da interação"
      description="A relação entre as interações e o alcance de cada período."
      headers={["Período", "Engajamento por alcance"]}
      rows={periods.map((period) => [
        periodLabel(period),
        formatRate(engagementRate(period)),
      ])}
      footnote="Interações ÷ alcance × 100. Requer os quatro tipos de interação e alcance maior que zero."
    >
      <div className="dashboard-chart-highlight compact">
        <strong>{formatRate(engagementRate(current))}</strong>
        <span>no período selecionado</span>
      </div>
      <ChartCanvas
        config={config}
        label="Evolução da taxa de engajamento por alcance"
      />
    </ChartPanel>
  );
}
