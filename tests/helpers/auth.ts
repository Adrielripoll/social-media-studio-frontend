import type { Page } from "@playwright/test";

export const user = {
  id: "fde72b50-36a3-4a2a-9b85-d4c12c96c321",
  aud: "authenticated",
  role: "authenticated",
  email: "maria@example.com",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { name: "Maria Silva" },
  identities: [],
  created_at: "2026-10-13T12:00:00Z",
};

export function session() {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "ES256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      aud: user.aud,
      role: user.role,
      email: user.email,
      iss: "http://127.0.0.1:54321/auth/v1",
      iat: now,
      exp: now + 3600,
      user_metadata: user.user_metadata,
    }),
  ).toString("base64url");
  return {
    access_token:
      header +
      "." +
      payload +
      "." +
      Buffer.from("test-only-signature").toString("base64url"),
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user,
  };
}

export interface CapturedRequest {
  url?: string;
  path: string;
  method: string;
  body: Record<string, unknown> | null;
  authorization?: string;
}

export async function mockAuth(
  page: Page,
  options: {
    invalidPassword?: boolean;
    unavailableBackend?: boolean;
    rejectToken?: boolean;
  } = {},
) {
  const captured: CapturedRequest[] = [];
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "X-Supabase-Api-Version": "2024-01-01",
    "Access-Control-Expose-Headers": "X-Supabase-Api-Version",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  };
  await page.route("http://127.0.0.1:54321/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    captured.push({
      url: request.url(),
      path,
      method,
      body: request.postData() ? request.postDataJSON() : null,
      authorization: request.headers().authorization,
    });
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let body: unknown = {};
    let status = 200;
    if (path.endsWith("/signup")) body = { user, session: null };
    else if (path.endsWith("/token")) {
      if (options.invalidPassword) {
        status = 400;
        body = { code: "invalid_credentials", msg: "Invalid credentials" };
      } else body = session();
    } else if (path.endsWith("/user")) body = user;
    await route.fulfill({
      status,
      headers,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("http://127.0.0.1:43001/me", async (route) => {
    captured.push({
      path: "/me",
      method: route.request().method(),
      body: null,
      authorization: route.request().headers().authorization,
    });
    await route.fulfill({
      status: options.unavailableBackend
        ? 503
        : options.rejectToken
          ? 401
          : 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.user_metadata.name,
      }),
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
