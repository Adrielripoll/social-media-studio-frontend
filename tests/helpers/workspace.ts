import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import type { Client } from "../../src/workspace/api";
import { apiUrl, corsHeaders, user } from "./auth";
export function client(name: string): Client {
  return {
    id: randomUUID(),
    userId: user.id,
    name,
    createdAt: "2026-10-13T12:00:00.000Z",
    updatedAt: "2026-10-13T12:00:00.000Z",
  };
}
export async function mockWorkspace(
  page: Page,
  initial: Client[] = [],
  failLoad = false,
) {
  const state = {
    clients: [...initial],
    failLoad,
    failSave: false,
    deleteConflict: false,
  };
  const requests: {
    method: string;
    path: string;
    body: Record<string, unknown> | null;
    csrf?: string;
    cookie?: string;
  }[] = [];
  await page.route(apiUrl + "/clients**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname,
      headers = await request.allHeaders();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const body = request.postData()
      ? (request.postDataJSON() as Record<string, unknown>)
      : null;
    requests.push({
      method: request.method(),
      path,
      body,
      csrf: headers["x-csrf-token"],
      cookie: headers.cookie,
    });
    const id = path.split("/")[2];
    let status = 200,
      value: unknown = {};
    if (request.method() === "GET") {
      if (state.failLoad) {
        status = 503;
        value = { message: "Falha ao carregar seu espaço." };
      } else value = { clients: state.clients };
    } else if (state.failSave) {
      state.failSave = false;
      status = 503;
      value = { message: "Falha ao salvar. Tente novamente." };
    } else if (request.method() === "POST") {
      const next = client(String(body?.name).trim());
      state.clients.push(next);
      status = 201;
      value = next;
    } else if (request.method() === "DELETE") {
      if (state.deleteConflict) {
        status = 409;
        value = {
          message: "Não é possível excluir um cliente com projetos vinculados.",
        };
      } else {
        state.clients = state.clients.filter((item) => item.id !== id);
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
    } else {
      const item = state.clients.find((item) => item.id === id)!;
      item.name = String(body?.name).trim();
      value = item;
    }
    await route.fulfill({
      status,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  });
  return { state, requests };
}
