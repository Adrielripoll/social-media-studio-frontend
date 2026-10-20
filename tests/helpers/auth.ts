import type { Page } from "@playwright/test";

export const user = {
  id: "fde72b50-36a3-4a2a-9b85-d4c12c96c321",
  email: "maria@example.com",
};
export const platformUser = {
  id: user.id,
  email: user.email,
  name: "Maria Silva",
  phone: "+5511999999999",
  createdAt: "2026-10-13T12:00:00.000Z",
  updatedAt: "2026-10-13T12:00:00.000Z",
};
export const apiUrl =
  process.env.STUDIO_TEST_API_URL ?? "http://127.0.0.1:43001";
export const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.STUDIO_TEST_ORIGIN ?? "http://127.0.0.1:3103",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type,X-CSRF-Token",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Expose-Headers": "X-CSRF-Token",
};
export interface CapturedRequest {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
  authorization?: string;
  cookie?: string;
  csrf?: string;
}
export async function mockAuth(
  page: Page,
  options: {
    invalidPassword?: boolean;
    unavailableBackend?: boolean;
    rejectToken?: boolean;
    csrfFailures?: number;
  } = {},
) {
  const captured: CapturedRequest[] = [];
  let currentUser = { ...platformUser };
  let csrfFailures = options.csrfFailures ?? 0;
  async function cookie(name: string, value: string) {
    await page.context().addCookies([
      {
        name,
        value,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 3600,
      },
    ]);
  }
  async function authenticate() {
    await cookie("studio_access", "test-only-access-cookie");
    await cookie("studio_refresh", "test-only-refresh-cookie");
    await cookie("studio_csrf", "test-csrf-token");
  }
  await page.route(apiUrl + "/**", async (route) => {
    const request = route.request();
    const headers = await request.allHeaders();
    const path = new URL(request.url()).pathname;
    const body = request.postData()
      ? (request.postDataJSON() as Record<string, unknown>)
      : null;
    captured.push({
      path,
      method: request.method(),
      body,
      authorization: headers.authorization,
      cookie: headers.cookie,
      csrf: headers["x-csrf-token"],
    });
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    let status = 200;
    let value: unknown = {};
    const saved = await page.context().cookies(apiUrl);
    const access = saved.some((item) => item.name === "studio_access");
    const refresh = saved.some((item) => item.name === "studio_refresh");
    if (path === "/account/storage") {
      value = { resources: [] };
    } else if (path === "/account") {
      value = {
        retention: {
          status: "protected",
          months: 1,
          projectedPurgeAt: null,
          automaticPurgeEnabled: false,
          acceptedAt: "2026-10-15T12:00:00Z",
        },
        plan: {
          code: "basic",
          name: "Plano Básico",
          storageLimitBytes: 2500000000,
          features: { images: true, videos: false },
        },
        access: {
          status: "trialing",
          allowed: true,
          trialStartedAt: "2026-10-15T12:00:00Z",
          trialEndsAt: "2099-10-22T12:00:00Z",
        },
        storage: {
          usedBytes: 0,
          reservedBytes: 0,
          pendingDeletionBytes: 0,
          limitBytes: 2500000000,
          availableBytes: 2500000000,
          percentUsed: 0,
        },
      };
    } else if (path === "/billing") {
      value = {
        available: false,
        priceCents: null,
        subscription: null,
        payments: [],
      };
    } else if (path === "/dashboards") {
      value = { dashboards: [] };
    } else if (path === "/auth/csrf") {
      await cookie("studio_csrf", "test-csrf-token");
      value = { csrfToken: "test-csrf-token" };
    } else if (path === "/auth/login") {
      if (csrfFailures-- > 0) {
        status = 403;
        value = { code: "csrf_invalid", message: "Atualize a página." };
      } else if (options.invalidPassword) {
        status = 401;
        value = {
          code: "invalid_credentials",
          message: "Email ou senha incorretos.",
        };
      } else {
        await authenticate();
        value = { authenticated: true };
      }
    } else if (path === "/auth/session") {
      if (!access && refresh) await authenticate();
      value = { authenticated: access || refresh };
    } else if (path === "/auth/signup") {
      await cookie("studio_pending", "email");
      value = { requiresEmailConfirmation: true };
    } else if (path === "/auth/resend") {
      await cookie("studio_pending", "email");
      value = { sent: true };
    } else if (path === "/auth/recover") {
      await cookie("studio_pending", "recovery");
      value = { sent: true };
    } else if (path === "/auth/confirm") {
      const url = new URL(request.url());
      const type = url.searchParams.get("type");
      const valid = saved.some(
        (item) => item.name === "studio_pending" && item.value === type,
      );
      if (valid) await authenticate();
      const destination =
        corsHeaders["Access-Control-Allow-Origin"] +
        (type === "recovery" ? "/redefinir-senha" : "/auth/callback") +
        "?status=" +
        (valid ? "success" : "invalid");
      await route.fulfill({
        status: 302,
        headers: { ...corsHeaders, location: destination },
      });
      return;
    } else if (path === "/users/me") {
      status = options.unavailableBackend
        ? 503
        : options.rejectToken || !access
          ? 401
          : 200;
      if (status === 200 && request.method() === "PATCH")
        currentUser = {
          ...currentUser,
          ...(typeof body?.name === "string"
            ? { name: body.name.trim().replace(/\s+/g, " ") }
            : {}),
          ...(typeof body?.phone === "string" ? { phone: body.phone } : {}),
        };
      value = status === 200 ? currentUser : { message: "Falha temporária." };
      if (status === 401) await page.context().clearCookies();
    } else if (path === "/clients") {
      value = { clients: [] };
    } else if (/^\/clients\/[^/]+\/logo$/.test(path)) {
      value = { url: null };
    } else if (path === "/feeds") {
      value = { feeds: [] };
    } else if (path === "/projects") {
      value = { projects: [] };
    } else if (path === "/tasks" || path === "/tasks/today") {
      value = {
        today: new Intl.DateTimeFormat("sv-SE", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
        timeZone: "America/Sao_Paulo",
        tasks: [],
      };
    } else if (path === "/auth/logout" || path === "/auth/password") {
      await page.context().clearCookies();
      value =
        path === "/auth/logout" ? { authenticated: false } : { updated: true };
    }
    await route.fulfill({
      status,
      headers: { ...corsHeaders, "Cache-Control": "no-store" },
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  });
  return captured;
}
export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
