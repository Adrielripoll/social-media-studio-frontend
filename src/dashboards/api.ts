import { apiRequest, ApiError } from "../auth/api";
export const METRICS = [
  { key: "reach", label: "Alcance" },
  { key: "views", label: "Visualizações" },
  { key: "likes", label: "Curtidas" },
  { key: "comments", label: "Comentários" },
  { key: "shares", label: "Compartilhamentos" },
  { key: "saves", label: "Salvamentos" },
  { key: "newFollowers", label: "Novos seguidores" },
  { key: "profileVisits", label: "Visitas ao perfil" },
  { key: "linkClicks", label: "Cliques no link" },
] as const;
export type Metric = (typeof METRICS)[number]["key"];
export type Period = {
  startDate: string;
  endDate: string;
  interactions?: number | null;
  reachBasis?: "daily-average";
} & Record<Metric, number | null>;
export interface Dashboard {
  id: string;
  name: string;
  clientId: string | null;
  platform: string;
  accountName: string;
  notes: string;
  periods: Period[];
  dailyMetrics?: DailyPoint[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export type DashboardSummary = Omit<
  Dashboard,
  "periods" | "notes" | "dailyMetrics"
>;
export { DAILY_METRICS } from "./daily-metrics";
import { DAILY_METRICS } from "./daily-metrics";
import type { DailyMetric, DailyPoint } from "./daily-metrics";
export type { DailyMetric, DailyPoint } from "./daily-metrics";
export interface ImportSchema {
  metrics: typeof DAILY_METRICS;
  maxFiles: number;
  maxRows: number;
  maxBytes: number;
}
export interface ImportPreview {
  valid: boolean;
  revision: number;
  changes: { created: number; updated: number; unchanged: number };
  files: {
    filename: string;
    metric: DailyMetric | null;
    sheetNames: string[];
    selectedSheet: string;
    rowCount: number;
    startDate: string | null;
    endDate: string | null;
    filledZeros: number;
  }[];
  points: DailyPoint[];
  issues: { filename: string; row: number; column: string; message: string }[];
  issueCount: number;
  warnings: string[];
}
export async function listDashboards(signal?: AbortSignal) {
  const value = await apiRequest<{ dashboards: DashboardSummary[] }>(
    "/dashboards",
    {
      signal,
    },
  );
  if (!Array.isArray(value?.dashboards)) throw new ApiError(502);
  return value.dashboards;
}
export function getDashboard(id: string, signal?: AbortSignal) {
  return apiRequest<Dashboard>("/dashboards/" + id, { signal });
}
export function createDashboard(name: string, clientId: string | null) {
  return apiRequest<Dashboard>("/dashboards", {
    method: "POST",
    body: { name, clientId },
  });
}
export function updateDashboard(
  id: string,
  body: Pick<
    Dashboard,
    "name" | "clientId" | "accountName" | "notes" | "revision"
  >,
) {
  return apiRequest<Dashboard>("/dashboards/" + id, { method: "PATCH", body });
}
export function deleteDashboard(id: string) {
  return apiRequest<void>("/dashboards/" + id, { method: "DELETE" });
}
export function getImportSchema(signal?: AbortSignal) {
  return apiRequest<ImportSchema>("/dashboards/schema", { signal });
}
export function previewImport(
  id: string,
  files: File[],
  sheets: string[],
  signal?: AbortSignal,
) {
  const body = new FormData();
  for (const file of files) {
    body.append("files", file);
  }
  body.append("sheets", JSON.stringify(sheets));
  return apiRequest<ImportPreview>("/dashboards/" + id + "/import-preview", {
    method: "POST",
    body,
    signal,
    timeoutMs: 30_000,
  });
}
export function confirmImport(
  id: string,
  revision: number,
  points: DailyPoint[],
) {
  return apiRequest<Dashboard>("/dashboards/" + id + "/metrics", {
    method: "PUT",
    body: { revision, points },
  });
}
export const errorMessage = (reason: unknown) =>
  reason instanceof Error
    ? reason.message
    : "Não foi possível concluir. Tente novamente.";
