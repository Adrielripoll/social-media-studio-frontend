import { memo } from "react";
import type { Period } from "./api";
import {
  EngagementHistory,
  FollowersHistory,
  InteractionHistory,
  ResultsEvolution,
} from "./DashboardHistoryCharts";
import {
  InteractionComparison,
  InteractionComposition,
  ProfileActions,
} from "./DashboardPeriodCharts";

export default memo(function DashboardCharts({
  current,
  previous,
  periods,
}: {
  current: Period;
  previous?: Period;
  periods: Period[];
}) {
  const history = [...periods].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  return (
    <section
      className="dashboard-visual-report"
      aria-label="Gráficos dos resultados"
    >
      <div className="dashboard-section-heading">
        <div>
          <span className="eyebrow">Além dos números</span>
          <h2>Resultados em perspectiva</h2>
        </div>
        <p>
          Explore a evolução do perfil e entenda o que está por trás de cada
          resultado.
        </p>
      </div>
      <div className="dashboard-charts">
        <ResultsEvolution periods={history} current={current} />
        <InteractionComposition current={current} />
        <InteractionComparison current={current} previous={previous} />
        <InteractionHistory periods={history} current={current} />
        <FollowersHistory periods={history} current={current} />
        <EngagementHistory periods={history} current={current} />
        <ProfileActions current={current} previous={previous} />
      </div>
    </section>
  );
});
