export const DAILY_METRICS = [
  { key: "reach", label: "Alcance" },
  { key: "views", label: "Visualizações" },
  { key: "interactions", label: "Interações" },
  { key: "newFollowers", label: "Novos seguidores" },
  { key: "profileVisits", label: "Visitas ao perfil" },
  { key: "linkClicks", label: "Cliques no link" },
] as const;
export type DailyMetric = (typeof DAILY_METRICS)[number]["key"];
export interface DailyPoint {
  date: string;
  metric: DailyMetric;
  value: number;
}
