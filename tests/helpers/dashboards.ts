import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import type { Dashboard, ImportPreview } from "../../src/dashboards/api";
import { apiUrl, corsHeaders } from "./auth";
export function dashboard(
  name = "Resultados",
  clientId: string | null = null,
): Dashboard {
  return {
    id: randomUUID(),
    name,
    clientId,
    platform: "instagram",
    accountName: "@cafeaurora",
    notes: "",
    periods: [],
    revision: 0,
    createdAt: "2026-10-15T12:00:00Z",
    updatedAt: "2026-10-15T12:00:00Z",
  };
}
const emptyMetrics = {
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  reach: null,
  views: null,
  newFollowers: null,
  profileVisits: null,
  linkClicks: null,
};
export function importedPeriods() {
  return [
    {
      ...emptyMetrics,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      reach: 12000,
      views: 18000,
      likes: 320,
      comments: 30,
      shares: 45,
      saves: 55,
      newFollowers: 80,
      profileVisits: 400,
      linkClicks: 0,
    },
    {
      ...emptyMetrics,
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      reach: 15000,
      views: 22000,
      likes: 420,
      comments: 45,
      shares: 70,
      saves: 80,
      newFollowers: 120,
      profileVisits: 600,
      linkClicks: 95,
    },
  ];
}
export async function mockDashboards(page: Page, initial: Dashboard[] = []) {
  const state = {
    items: structuredClone(initial),
    failList: false,
    failSave: false,
    conflict: false,
    failPreview: false,
    invalidPreview: false,
    multipleSheets: false,
  };
  const captured: {
    path: string;
    method: string;
    body: unknown;
    csrf?: string;
    cookie?: string;
    multipart?: string;
  }[] = [];
  await page.route(apiUrl + "/dashboards**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const headers = await request.allHeaders(),
      multipart = headers["content-type"]?.startsWith("multipart/");
    const body = request.postData() && !multipart ? request.postDataJSON() : null;
    captured.push({
      path,
      method: request.method(),
      body,
      csrf: headers["x-csrf-token"],
      cookie: headers.cookie,
      multipart: multipart ? (request.postData() ?? "") : undefined,
    });
    let value: unknown = {},
      status = 200;
    if (path === "/dashboards/schema")
      value = {
        maxRows: 500,
        maxBytes: 5 * 1024 * 1024,
        columns: [
          {
            column: "inicio_periodo",
            label: "Início do período",
            required: true,
            example: "2026-08-01",
          },
          {
            column: "fim_periodo",
            label: "Fim do período",
            required: true,
            example: "2026-08-31",
          },
          { column: "alcance", label: "Alcance", required: false, example: "12000" },
        ],
        exampleCsv: "inicio_periodo;fim_periodo;alcance\n2026-08-01;2026-08-31;12000",
      };
    else if (path === "/dashboards" && request.method() === "GET") {
      status = state.failList ? 503 : 200;
      value = state.failList
        ? { message: "Falha temporária nos dashboards." }
        : {
            dashboards: state.items.map(
              ({ periods: _periods, notes: _notes, ...item }) => item,
            ),
          };
    } else if (path === "/dashboards" && request.method() === "POST") {
      const item = dashboard(body.name.trim(), body.clientId);
      state.items.push(item);
      value = item;
      status = 201;
    } else {
      const id = path.split("/")[2],
        item = state.items.find((value) => value.id === id);
      if (!item) {
        status = 404;
        value = { message: "Dashboard não encontrado." };
      } else if (path.endsWith("/import-preview")) {
        const selected = /name="sheet"\r\n\r\n([^\r\n]+)/.exec(
          request.postData() ?? "",
        )?.[1];
        const invalid =
          state.invalidPreview || (state.multipleSheets && selected !== "Resultados");
        const preview: ImportPreview = {
          valid: !invalid,
          rowCount: invalid ? 0 : 2,
          periods: invalid ? [] : importedPeriods(),
          sheetNames: state.multipleSheets ? ["Notas", "Resultados"] : ["Dados"],
          selectedSheet: state.multipleSheets ? (selected ?? "Notas") : "Dados",
          warnings: [],
          issues: invalid
            ? [{ row: 2, column: "alcance", message: "Informe um número inteiro." }]
            : [],
          issueCount: invalid ? 1 : 0,
        };
        status = state.failPreview ? 503 : 200;
        value = state.failPreview ? { message: "Falha ao ler a planilha." } : preview;
      } else if (request.method() === "GET") value = item;
      else if (request.method() === "DELETE") {
        state.items = state.items.filter((value) => value.id !== id);
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      } else if (state.conflict || body.revision !== item.revision) {
        status = 409;
        value = { message: "Este dashboard foi atualizado em outra aba." };
      } else if (state.failSave) {
        status = 503;
        value = { message: "Não foi possível salvar o dashboard." };
      } else {
        if (path.endsWith("/periods")) item.periods = body.periods;
        else Object.assign(item, body);
        item.revision++;
        value = item;
      }
    }
    await route.fulfill({
      status,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  });
  return { state, captured };
}
