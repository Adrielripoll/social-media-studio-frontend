import { useEffect, useRef, useState, type ReactNode } from "react";
import { Chart, type ChartConfig, type ChartKind } from "./chart-runtime";

export function ChartCanvas({
  config,
  label,
  className = "",
}: {
  config: ChartConfig;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart<ChartKind, (number | null)[], string>(ref.current, {
      ...config,
      options: {
        ...config.options,
        font: { family: getComputedStyle(ref.current).fontFamily },
      },
    });
    return () => chart.destroy();
  }, [config]);
  return (
    <div className={"dashboard-canvas " + className}>
      <canvas ref={ref} role="img" aria-label={label}>
        Os valores estão disponíveis em “Ver dados do gráfico”.
      </canvas>
    </div>
  );
}

export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <ul className="dashboard-visual-legend" aria-label="Legenda">
      {items.map((item) => (
        <li key={item.label}>
          <i style={{ background: item.color }} aria-hidden="true" />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ChartPanel({
  title,
  description,
  badge,
  controls,
  wide = false,
  className = "",
  headers,
  rows,
  children,
  footnote,
}: {
  title: string;
  description: string;
  badge?: string;
  controls?: ReactNode;
  wide?: boolean;
  className?: string;
  headers: string[];
  rows: (string | number)[][];
  children: ReactNode;
  footnote?: string;
}) {
  const [showData, setShowData] = useState(false);
  return (
    <figure
      className={
        "dashboard-chart " + className + (wide ? " dashboard-chart-wide" : "")
      }
      aria-label={title}
    >
      <figcaption className="dashboard-chart-caption">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {badge && <span className="dashboard-chart-badge">{badge}</span>}
      </figcaption>
      {controls && <div className="dashboard-chart-controls">{controls}</div>}
      {children}
      {footnote && <p className="dashboard-chart-footnote">{footnote}</p>}
      <details
        className="dashboard-chart-data"
        onToggle={(event) => setShowData(event.currentTarget.open)}
      >
        <summary>
          Ver dados do gráfico
          <span className="dashboard-sr-only">: {title}</span>
        </summary>
        {showData && (
          <div
            className="dashboard-table-scroll"
            tabIndex={0}
            role="region"
            aria-label={"Dados: " + title}
          >
            <table>
              <caption>{title}</caption>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header} scope="col">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, col) =>
                      col === 0 ? (
                        <th key={col} scope="row">
                          {cell}
                        </th>
                      ) : (
                        <td key={col}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </figure>
  );
}
