import { test, expect } from "@playwright/test";
import {
  apiUrl,
  corsHeaders,
  login,
  mockAuth,
  platformUser,
  user,
} from "./helpers/auth";

async function signup(page: Parameters<typeof login>[0]) {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome", { exact: true }).fill("Maria Silva");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Celular (com DDD)").fill("(11) 99999-9999");
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura-123");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
}

test("cadastro e reenvio passam pela API sem armazenar tokens", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await signup(page);
  await expect(
    page.getByRole("heading", { name: "Confira seu email." }),
  ).toBeVisible();
  expect(
    requests.find((item) => item.path === "/auth/signup")?.body,
  ).toMatchObject({
    email: user.email,
    name: "Maria Silva",
    phone: "+5511999999999",
  });
  await page
    .getByRole("button", { name: "Reenviar email de confirmação" })
    .click();
  await expect(
    page.getByRole("button", { name: "Instruções reenviadas" }),
  ).toBeVisible();
  expect(requests.some((item) => item.path === "/auth/resend")).toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem("social-media-studio-auth")),
  ).toBeNull();
});

test("login usa cookies HttpOnly e CSRF, restaura o perfil e permite logout", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
  const bootstrap = requests.find((item) => item.path === "/users/me");
  expect(bootstrap?.method).toBe("POST");
  expect(bootstrap?.body).toBeNull();
  expect(bootstrap?.authorization).toBeUndefined();
  expect(bootstrap?.csrf).toBe("test-csrf-token");
  expect(bootstrap?.cookie).toContain("studio_access=");
  const cookies = await page.context().cookies(apiUrl);
  expect(
    cookies
      .filter((item) => ["studio_access", "studio_refresh"].includes(item.name))
      .every((item) => item.httpOnly),
  ).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "studio_access",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("social-media-studio-auth")),
  ).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Entre no seu espaço." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Entre no seu espaço." }),
  ).toBeVisible();
});

test("cadastro exige celular e aceita +55 no mobile", async ({ page }) => {
  const requests = await mockAuth(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome", { exact: true }).fill("Maria Silva");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura-123");
  const phone = page.getByLabel("Celular (com DDD)");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  expect(requests.some((item) => item.path === "/auth/signup")).toBe(false);
  await phone.fill("(11) 3333-4444");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "celular brasileiro com DDD",
  );
  await phone.fill("+55 (11) 99999-9999");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Confira seu email." }),
  ).toBeVisible();
});

test("credenciais inválidas não dão acesso ao perfil", async ({ page }) => {
  const requests = await mockAuth(page, { invalidPassword: true });
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Email ou senha incorretos",
  );
  expect(requests.some((item) => item.path === "/users/me")).toBe(false);
});

test("rejeição da sessão pela API encerra o acesso", async ({ page }) => {
  await mockAuth(page, { rejectToken: true });
  await login(page);
  await expect(page.getByRole("alert")).toContainText("Sua sessão expirou");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).not.toBeVisible();
});

test("falha temporária preserva cookies e permite tentar novamente", async ({
  page,
}) => {
  await mockAuth(page, { unavailableBackend: true });
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível conectar",
  );
  expect(
    (await page.context().cookies(apiUrl)).some(
      (item) => item.name === "studio_refresh",
    ),
  ).toBe(true);
  await page.route(apiUrl + "/users/me", (route) =>
    route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify(platformUser),
    }),
  );
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
});

test("recuperação retorna pelo backend e permite redefinir a senha", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await page.goto("/recuperar-senha");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(page.getByRole("status")).toContainText("Se existir uma conta");
  await page.goto(apiUrl + "/auth/confirm?token_hash=test&type=recovery");
  await page.getByLabel("Senha", { exact: true }).fill("nova-senha-segura");
  await page
    .getByLabel("Confirme a nova senha", { exact: true })
    .fill("nova-senha-segura");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByRole("heading", { name: "Senha atualizada." }),
  ).toBeVisible();
  expect(requests.find((item) => item.path === "/auth/password")?.body).toEqual(
    { password: "nova-senha-segura" },
  );
  expect(
    (await page.context().cookies(apiUrl)).some(
      (item) => item.name === "studio_refresh",
    ),
  ).toBe(false);
});

test("confirmação retorna sem JWT ou refresh token na URL", async ({
  page,
}) => {
  await mockAuth(page);
  await signup(page);
  await expect(
    page.getByRole("heading", { name: "Confira seu email." }),
  ).toBeVisible();
  await page.goto(apiUrl + "/auth/confirm?token_hash=test&type=email");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
  expect(page.url()).not.toMatch(/token_hash|access_token|refresh_token/);
});

test("redefinição sem sessão orienta solicitar novo link", async ({ page }) => {
  await mockAuth(page);
  await page.goto("/redefinir-senha");
  await expect(
    page.getByText("Abra o link enviado ao seu email", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salvar nova senha" }),
  ).not.toBeVisible();
});

test("login funciona em tela de celular", async ({ page }) => {
  await mockAuth(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("sessão pode ser restaurada somente com cookie de renovação", async ({
  page,
}) => {
  await mockAuth(page);
  await page.context().addCookies([
    {
      name: "studio_refresh",
      value: "test-only-refresh-cookie",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
  expect(
    (await page.context().cookies(apiUrl)).some(
      (item) => item.name === "studio_access",
    ),
  ).toBe(true);
});

test("a página inicial usa o perfil persistido", async ({ page }) => {
  await mockAuth(page);
  await page.route(apiUrl + "/users/me", (route) =>
    route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify({ ...platformUser, name: "Lia Souza" }),
    }),
  );
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Lia." }),
  ).toBeVisible();
});

test("perfil inválido mostra a mensagem da API e preserva a sessão", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/users/me", (route) =>
    route.fulfill({
      status: 400,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Informe um nome válido para concluir seu cadastro.",
      }),
    }),
  );
  await login(page);
  await expect(page.getByRole("alert")).toContainText("Informe um nome válido");
  expect(
    (await page.context().cookies(apiUrl)).some(
      (item) => item.name === "studio_refresh",
    ),
  ).toBe(true);
});

test("token CSRF inválido é renovado e a operação é repetida uma única vez", async ({
  page,
}) => {
  const requests = await mockAuth(page, { csrfFailures: 1 });
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
  expect(requests.filter((item) => item.path === "/auth/login")).toHaveLength(
    2,
  );
  expect(requests.filter((item) => item.path === "/auth/csrf")).toHaveLength(2);
});

test("tokens legados são removidos do armazenamento JavaScript", async ({
  page,
}) => {
  await mockAuth(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "social-media-studio-auth",
      '{"access_token":"old-test-token"}',
    );
    sessionStorage.setItem(
      "social-media-studio-auth-code-verifier",
      "old-test-verifier",
    );
    localStorage.setItem("preferencia-do-usuario", "manter");
  });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Entre no seu espaço." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("social-media-studio-auth")),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("social-media-studio-auth-code-verifier"),
    ),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("preferencia-do-usuario")),
  ).toBe("manter");
});

test("localhost redireciona para o hostname local da API antes de autenticar", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await page.goto("http://localhost:3103/login?origem=teste");
  await expect(page).toHaveURL("http://127.0.0.1:3103/login?origem=teste");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
  const loginRequest = requests.find((item) => item.path === "/auth/login");
  expect(loginRequest?.csrf).toBe("test-csrf-token");
  expect(loginRequest?.cookie).toContain("studio_csrf=");
});

test("cadastro informa quando o celular já pertence a uma conta", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/auth/signup", (route) =>
    route.fulfill({
      status: 409,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify({
        code: "phone_already_in_use",
        message:
          "Este celular já está vinculado a uma conta. Use outro número ou entre na sua conta.",
      }),
    }),
  );
  await signup(page);
  await expect(page.getByRole("alert")).toContainText(
    "Este celular já está vinculado a uma conta.",
  );
  await expect(
    page.getByRole("heading", { name: "Vamos criar sua conta?" }),
  ).toBeVisible();
});
