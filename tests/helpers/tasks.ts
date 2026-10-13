import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import type { Task } from "../../src/tasks/api";
import { apiUrl, corsHeaders, user } from "./auth";

export function task(
  title: string,
  scheduledDate = "2026-10-13",
  completed = false,
): Task {
  return {
    id: randomUUID(),
    userId: user.id,
    title,
    scheduledDate,
    completedAt: completed ? "2026-10-13T15:00:00.000Z" : null,
    createdAt: "2026-10-13T12:00:00.000Z",
    updatedAt: "2026-10-13T12:00:00.000Z",
  };
}
export async function mockTasks(
  page: Page,
  initial: Task[] = [],
  failLoad = false,
) {
  const state = {
    tasks: [...initial],
    today: "2026-10-13",
    failLoad,
    failMutation: false,
  };
  const requests: {
    method: string;
    body: Record<string, unknown> | null;
    csrf?: string;
    cookie?: string;
    from?: string;
    to?: string;
  }[] = [];
  await page.route(apiUrl + "/tasks**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
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
      body,
      csrf: headers["x-csrf-token"],
      cookie: headers.cookie,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    let status = 200,
      value: unknown = {};
    if (request.method() === "GET") {
      if (state.failLoad) {
        status = 503;
        value = { message: "Falha temporária ao carregar tarefas." };
      } else {
        const from = url.searchParams.get("from")!,
          to = url.searchParams.get("to")!;
        value = {
          today: state.today,
          timeZone: "America/Sao_Paulo",
          tasks: state.tasks.filter(
            (item) => item.scheduledDate >= from && item.scheduledDate <= to,
          ),
        };
      }
    } else if (state.failMutation) {
      state.failMutation = false;
      status = 503;
      value = { message: "Falha temporária ao salvar tarefa." };
    } else if (request.method() === "POST") {
      const next = task(
        String(body?.title).trim(),
        String(body?.scheduledDate),
      );
      state.tasks.push(next);
      status = 201;
      value = next;
    } else {
      const id = url.pathname.split("/")[2],
        found = state.tasks.find((item) => item.id === id);
      if (!found) {
        status = 404;
        value = { message: "Tarefa não encontrada." };
      } else if (request.method() === "DELETE") {
        state.tasks = state.tasks.filter((item) => item.id !== id);
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      } else {
        if (url.pathname.endsWith("/completion"))
          found.completedAt = body?.completed
            ? "2026-10-13T15:00:00.000Z"
            : null;
        else {
          found.title = String(body?.title);
        }
        found.updatedAt = "2026-10-13T15:01:00.000Z";
        value = found;
      }
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
