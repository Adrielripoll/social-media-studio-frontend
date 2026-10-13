import { test, expect } from "@playwright/test";
import { login, mockAuth, platformUser, session, user } from "./helpers/auth";

test("cadastro envia dados ao Supabase e solicita confirmação por email", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await page.goto("/cadastro");
  await page.screenshot({ path: "test-results/cadastro.png", fullPage: true });
  await page.getByLabel("Seu nome", { exact: true }).fill("Maria Silva");
  await page.getByLabel("Celular (com DDD)").fill("(11) 99999-9999");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura-123");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Confira seu email." }),
  ).toBeVisible();
  const signup = requests.find((request) => request.path.endsWith("/signup"));
  expect(signup?.body).toMatchObject({
    email: user.email,
    data: { name: "Maria Silva", phone: "+5511999999999" },
  });
  expect(
    new URL(new URL(signup!.url!).searchParams.get("redirect_to")!).pathname,
  ).toBe("/auth/callback");
  expect(requests.some((request) => request.path === "/users/me")).toBe(false);
  await page
    .getByRole("button", { name: "Reenviar email de confirmação" })
    .click();
  await expect(
    page.getByRole("button", { name: "Instruções reenviadas" }),
  ).toBeVisible();
});

test("cadastro exige um celular, recusa telefone fixo e aceita +55 no mobile", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome", { exact: true }).fill("Maria Silva");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura-123");
  const phone = page.getByLabel("Celular (com DDD)");
  await expect(phone).toHaveAttribute("required", "");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  expect(requests.some((request) => request.path.endsWith("/signup"))).toBe(
    false,
  );
  await phone.fill("(11) 3333-4444");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "celular brasileiro com DDD",
  );
  expect(requests.some((request) => request.path.endsWith("/signup"))).toBe(
    false,
  );
  await phone.fill("+55 (11) 99999-9999");
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Confira seu email." }),
  ).toBeVisible();
  expect(
    requests.find((request) => request.path.endsWith("/signup"))?.body,
  ).toMatchObject({
    email: user.email,
    data: { name: "Maria Silva", phone: "+5511999999999" },
  });
});

test("login envia o access token ao backend, restaura a sessão e permite logout", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
  expect(
    requests.find((request) => request.path === "/users/me")?.authorization,
  ).toMatch(/^Bearer [^.]+\.[^.]+\.[^.]+$/);
  const bootstrap = requests.find((request) => request.path === "/users/me");
  expect(bootstrap?.method).toBe("POST");
  expect(bootstrap?.body).toBeNull();
  await page.screenshot({ path: "test-results/home.png", fullPage: true });
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

test("credenciais inválidas não dão acesso à página inicial", async ({
  page,
}) => {
  const requests = await mockAuth(page, { invalidPassword: true });
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Email ou senha incorretos",
  );
  expect(requests.some((request) => request.path === "/users/me")).toBe(false);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).not.toBeVisible();
});

test("rejeição do JWT pelo backend encerra o acesso", async ({ page }) => {
  await mockAuth(page, { rejectToken: true });
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Sua sessão não foi aceita",
  );
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).not.toBeVisible();
});

test("falha temporária do backend preserva a sessão e oferece nova tentativa", async ({
  page,
}) => {
  await mockAuth(page, { unavailableBackend: true });
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível conectar",
  );
  const saved = await page.evaluate(() =>
    localStorage.getItem("social-media-studio-auth"),
  );
  expect(saved).not.toBeNull();
  await page.route("http://127.0.0.1:43001/users/me", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      contentType: "application/json",
      body: JSON.stringify(platformUser),
    }),
  );
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
});

test("recuperação solicita email e permite atualizar a senha com uma sessão válida", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await page.goto("/recuperar-senha");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(page.getByRole("status")).toContainText("Se existir uma conta");
  expect(requests.some((request) => request.path.endsWith("/recover"))).toBe(
    true,
  );

  const recovery = requests.find((request) =>
    request.path.endsWith("/recover"),
  )!;
  const redirect = new URL(
    new URL(recovery.url!).searchParams.get("redirect_to")!,
  );
  redirect.searchParams.set("code", "test-recovery-code");
  await page.goto(redirect.href);
  await page.getByLabel("Senha", { exact: true }).fill("nova-senha-segura");
  await page
    .getByLabel("Confirme a nova senha", { exact: true })
    .fill("nova-senha-segura");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByRole("heading", { name: "Senha atualizada." }),
  ).toBeVisible();
  expect(
    requests.some(
      (request) =>
        request.path.endsWith("/user") &&
        request.method === "PUT" &&
        request.body?.password === "nova-senha-segura",
    ),
  ).toBe(true);
});

test("callback PKCE troca o código por sessão e valida o acesso no backend", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome", { exact: true }).fill("Maria Silva");
  await page.getByLabel("Celular (com DDD)").fill("11999999999");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura-123");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(
    page.getByRole("heading", { name: "Confira seu email." }),
  ).toBeVisible();
  const signup = requests.find((request) => request.path.endsWith("/signup"))!;
  const callback = new URL(
    new URL(signup.url!).searchParams.get("redirect_to")!,
  );
  callback.searchParams.set("code", "test-confirmation-code");
  await page.goto(callback.href);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
  expect(
    requests.some(
      (request) =>
        request.path.endsWith("/token") &&
        request.body?.auth_code === "test-confirmation-code",
    ),
  ).toBe(true);
});

test("link de recuperação sem sessão não permite definir senha", async ({
  page,
}) => {
  await mockAuth(page);
  await page.goto("/redefinir-senha");
  await expect(
    page.getByText("Abra o link enviado ao seu email", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salvar nova senha" }),
  ).not.toBeVisible();
});

test("login funciona em uma tela de celular sem transbordamento horizontal", async ({
  page,
}) => {
  await mockAuth(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura-123");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
});

test("sessão expirada é renovada pelo SDK antes de acessar o backend", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await page.goto("/login");
  const expired = {
    ...session(),
    expires_at: Math.floor(Date.now() / 1000) - 60,
    expires_in: 0,
  };
  await page.evaluate(
    (value) =>
      localStorage.setItem("social-media-studio-auth", JSON.stringify(value)),
    expired,
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Maria." }),
  ).toBeVisible();
  expect(
    requests.some(
      (request) =>
        request.path.endsWith("/token") &&
        request.body?.refresh_token === "test-refresh-token",
    ),
  ).toBe(true);
});

test("a página inicial usa o perfil persistido devolvido pelo backend", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route("http://127.0.0.1:43001/users/me", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      contentType: "application/json",
      body: JSON.stringify({ ...platformUser, name: "Lia Souza" }),
    }),
  );
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Bem-vindo, Lia." }),
  ).toBeVisible();
});

test("dados de perfil inválidos exibem a mensagem da API sem encerrar a sessão", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route("http://127.0.0.1:43001/users/me", (route) =>
    route.fulfill({
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
      contentType: "application/json",
      body: JSON.stringify({
        message: "Informe um nome válido para concluir seu cadastro.",
      }),
    }),
  );
  await login(page);
  await expect(page.getByRole("alert")).toContainText("Informe um nome válido");
  expect(
    await page.evaluate(() => localStorage.getItem("social-media-studio-auth")),
  ).not.toBeNull();
});
