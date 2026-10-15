import type { Metric, Period } from "./api";
import ChartPanel, { ChartCanvas, ChartLegend } from "./ChartPanel";
import {
  chartOptions,
  interactionMetrics,
  palette,
  type ChartConfig,
} from "./chart-runtime";
import { formatCount, formatRate, interactions, periodLabel } from "./metrics";

type Props = { current: Period; previous?: Period };

export function InteractionComposition({ current }: Props) {
  const total = interactions(current);
  const config: ChartConfig = {
    type: "doughnut",
    data: {
      labels: interactionMetrics.map((metric) => metric.label),
      datasets: [
        {
          label: "Interações",
          data: interactionMetrics.map((metric) => current[metric.key]),
          backgroundColor: interactionMetrics.map((metric) => metric.color),
          borderWidth: 3,
          borderColor: "#fff",
          hoverOffset: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      cutout: "78%",
      layout: { padding: 8 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#202641",
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (item) => {
              const value = typeof item.raw === "number" ? item.raw : 0;
              return (
                item.label +
                ": " +
                formatCount(value) +
                " (" +
                formatRate(total ? (value / total) * 100 : 0) +
                ")"
              );
            },
          },
        },
      },
    },
  };
  return (
    <ChartPanel
      title="Distribuição das interações"
      className="dashboard-chart-composition"
      badge="Composição"
      description="O peso de cada interação no resultado do período selecionado."
      headers={["Interação", "Quantidade", "Participação"]}
      rows={interactionMetrics.map((metric) => [
        metric.label,
        formatCount(current[metric.key]),
        formatRate(
          total && current[metric.key] !== null
            ? (current[metric.key]! / total) * 100
            : total === 0
              ? 0
              : null,
        ),
      ])}
      footnote={
        total === null
          ? "Informe os quatro tipos de interação para calcular a composição."
          : periodLabel(current)
      }
    >
      {total === null ? (
        <div className="dashboard-chart-unavailable">
          <span className="dashboard-empty-ring" aria-hidden="true" />
          <strong>Composição indisponível</strong>
          <p>
            Faltam dados de curtidas, comentários, compartilhamentos ou
            salvamentos.
          </p>
        </div>
      ) : (
        <div className="dashboard-donut-layout">
          <div className="dashboard-donut">
            {total > 0 ? (
              <ChartCanvas
                config={config}
                label="Participação de cada tipo de interação"
              />
            ) : (
              <span className="dashboard-zero-ring" aria-hidden="true" />
            )}
            <div className="dashboard-donut-center" aria-hidden="true">
              <strong>{formatCount(total)}</strong>
              <span>interações</span>
            </div>
          </div>
          <ul className="dashboard-composition-list">
            {interactionMetrics.map((metric) => (
              <li key={metric.key}>
                <i style={{ background: metric.color }} aria-hidden="true" />
                <div>
                  <span>{metric.label}</span>
                  <strong>{formatCount(current[metric.key])}</strong>
                </div>
                <small>
                  {formatRate(total ? (current[metric.key]! / total) * 100 : 0)}
                </small>
              </li>
            ))}
          </ul>
          {total === 0 && (
            <p className="dashboard-zero-note">
              Nenhuma interação registrada neste período.
            </p>
          )}
        </div>
      )}
    </ChartPanel>
  );
}

function PeriodComparison({
  current,
  previous,
  title,
  description,
  rows,
  horizontal = false,
}: Props & {
  title: string;
  description: string;
  rows: { key: Metric; label: string; axisLabel?: string }[];
  horizontal?: boolean;
}) {
  const series = [
    { label: "Selecionado", period: current, color: palette.primary },
    ...(previous
      ? [{ label: "Comparação", period: previous, color: palette.comparison }]
      : []),
  ];
  const options = chartOptions();
  if (horizontal) {
    options.indexAxis = "y";
    options.scales = {
      x: {
        beginAtZero: true,
        grid: { color: palette.grid },
        border: { display: false },
        ticks: {
          color: palette.text,
          font: { size: 11 },
          maxTicksLimit: 4,
          callback: (value) =>
            new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(
              Number(value),
            ),
        },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: palette.text, font: { size: 11 } },
      },
    };
    options.interaction = { mode: "index", intersect: false, axis: "y" };
  } else {
    options.scales!.x!.ticks = {
      color: palette.text,
      font: { size: 10 },
      maxRotation: 0,
      autoSkip: false,
    };
  }
  options.plugins!.tooltip!.callbacks!.title = (items) =>
    items.length ? rows[items[0].dataIndex].label : "";
  const config: ChartConfig = {
    type: "bar",
    data: {
      labels: rows.map((row) => row.axisLabel ?? row.label),
      datasets: series.map((item) => ({
        label: item.label,
        data: rows.map((row) => item.period[row.key]),
        backgroundColor: item.color,
        borderRadius: 6,
        maxBarThickness: horizontal ? 25 : 32,
        categoryPercentage: 0.65,
        barPercentage: 0.8,
      })),
    },
    options,
  };
  return (
    <ChartPanel
      title={title}
      className={horizontal ? "dashboard-chart-actions" : ""}
      description={description}
      badge={previous ? "Período × comparação" : "Período selecionado"}
      headers={[
        "Métrica",
        ...series.map((item) => item.label + ": " + periodLabel(item.period)),
      ]}
      rows={rows.map((row) => [
        row.label,
        ...series.map((item) => formatCount(item.period[row.key])),
      ])}
      footnote={
        previous
          ? "As mesmas métricas, lado a lado. Passe o mouse ou toque para ver os valores."
          : "Selecione um período de comparação para colocar os resultados lado a lado."
      }
    >
      <ChartLegend
        items={series.map((item) => ({
          label: item.label + ": " + periodLabel(item.period),
          color: item.color,
        }))}
      />
      <ChartCanvas config={config} label={title + " por período"} />
    </ChartPanel>
  );
}
export function InteractionComparison(props: Props) {
  return (
    <PeriodComparison
      {...props}
      title="Como o público interagiu"
      description="Curtidas, comentários, compartilhamentos e salvamentos em comparação."
      rows={interactionMetrics.map((item) => ({
        key: item.key,
        label: item.label,
        axisLabel: item.key === "shares" ? "Compart." : item.label,
      }))}
    />
  );
}
export function ProfileActions(props: Props) {
  return (
    <PeriodComparison
      {...props}
      horizontal
      title="Ações no perfil"
      description="Visitas ao perfil e cliques no link do período selecionado."
      rows={[
        { key: "profileVisits", label: "Visitas ao perfil" },
        { key: "linkClicks", label: "Cliques no link" },
      ]}
    />
  );
}
