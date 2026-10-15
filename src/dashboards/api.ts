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
export type Period = { startDate: string; endDate: string } & Record<
  Metric,
  number | null
>;
export interface Dashboard {
  id: string;
  name: string;
  clientId: string | null;
  platform: string;
  accountName: string;
  notes: string;
  periods: Period[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export type DashboardSummary = Omit<Dashboard, "periods" | "notes">;
export interface ImportSchema {
  columns: { column: string; label: string; required: boolean; example: string }[];
  maxRows: number;
  maxBytes: number;
  exampleCsv: string;
}
export interface ImportPreview {
  valid: boolean;
  sheetNames: string[];
  selectedSheet: string;
  rowCount: number;
  periods: Period[];
  issues: { row: number; column: string; message: string }[];
  issueCount: number;
  warnings: string[];
}
export async function listDashboards(signal?: AbortSignal) {
  const value = await apiRequest<{ dashboards: DashboardSummary[] }>("/dashboards", {
    signal,
  });
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
  body: Pick<Dashboard, "name" | "clientId" | "accountName" | "notes" | "revision">,
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
  file: File,
  sheet: string | undefined,
  signal?: AbortSignal,
) {
  const body = new FormData();
  body.append("file", file);
  if (sheet) body.append("sheet", sheet);
  return apiRequest<ImportPreview>("/dashboards/" + id + "/import-preview", {
    method: "POST",
    body,
    signal,
    timeoutMs: 30_000,
  });
}
export function confirmImport(id: string, revision: number, periods: Period[]) {
  return apiRequest<Dashboard>("/dashboards/" + id + "/periods", {
    method: "PUT",
    body: { revision, periods },
  });
}
export const errorMessage = (reason: unknown) =>
  reason instanceof Error
    ? reason.message
    : "Não foi possível concluir. Tente novamente.";
