import { randomUUID } from "node:crypto";
import { feed, mockFeeds } from "./helpers/feeds";
import { test, expect } from "@playwright/test";
import { mockAuth, login, apiUrl, corsHeaders } from "./helpers/auth";
function retention(acceptedAt: string | null = null) {
  return {
    status: "retained",
    months: 1,
    projectedPurgeAt: "2099-11-22T12:00:00Z",
    automaticPurgeEnabled: false,
    acceptedAt,
    policy: {
      version: "2026-10-16.v1",
      title: "Política de retenção de arquivos",
      paragraphs: [
        "Os arquivos são excluídos definitivamente 1 mês após o teste ou 6 meses após o último acesso pago.",
        "Entrar na conta não reinicia o prazo. Avisos serão enviados antes da exclusão.",
      ],
    },
  };
}
const summary = (acceptedAt: string | null = null) => ({
  plan: {
    code: "basic",
    name: "Plano Básico",
    storageLimitBytes: 2.5e9,
    features: { images: true, videos: false },
  },
  access: {
    status: "trial_expired",
    allowed: false,
    trialStartedAt: "2099-10-15T12:00:00Z",
    trialEndsAt: "2099-10-22T12:00:00Z",
  },
  storage: {
    usedBytes: 1e6,
    reservedBytes: 0,
    pendingDeletionBytes: 0,
    limitBytes: 2.5e9,
    availableBytes: 2.499e9,
    percentUsed: 0.04,
  },
  retention: retention(acceptedAt),
});
test("mostra política, exige aceite explícito e só então permite contratar", async ({
  page,
}) => {
  await mockAuth(page);
  let acceptedAt: string | null = null;
  let acceptedBody: unknown;
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: summary(acceptedAt), headers: corsHeaders }),
  );
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: {
        available: true,
        priceCents: 9900,
        subscription: null,
        payments: [],
      },
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/account/retention/accept", (route) => {
    acceptedBody = route.request().postDataJSON();
    acceptedAt = "2026-10-16T12:00:00Z";
    return route.fulfill({ json: retention(acceptedAt), headers: corsHeaders });
  });
  await login(page);
  const contract = page.getByRole("button", { name: "Contratar Plano Básico" });
  await expect(contract).toBeDisabled();
  await page.getByText("Ler política de retenção", { exact: false }).click();
  await expect(
    page.getByText(
      "Entrar na conta não reinicia o prazo. Avisos serão enviados antes da exclusão.",
      { exact: true },
    ),
  ).toBeVisible();
  const accept = page.getByRole("button", {
    name: "Aceitar política de retenção",
  });
  await expect(accept).toBeDisabled();
  await page.getByRole("checkbox", { name: /Li e aceito a política/ }).check();
  await accept.click();
  await expect(contract).toBeEnabled();
  expect(acceptedBody).toEqual({ version: "2026-10-16.v1", accepted: true });
  await page.reload();
  await expect(
    page.getByText("Política de retenção aceita", { exact: false }),
  ).toBeVisible();
  await expect(contract).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("falha no aceite mantém contratação bloqueada e permite nova tentativa", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: summary(), headers: corsHeaders }),
  );
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: {
        available: true,
        priceCents: 9900,
        subscription: null,
        payments: [],
      },
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/account/retention/accept", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "Não foi possível registrar o aceite." },
      headers: corsHeaders,
    }),
  );
  await login(page);
  await page.getByRole("checkbox", { name: /Li e aceito a política/ }).check();
  await page
    .getByRole("button", { name: "Aceitar política de retenção" })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível registrar",
  );
  await expect(
    page.getByRole("button", { name: "Contratar Plano Básico" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Aceitar política de retenção" }),
  ).toBeEnabled();
});
test("informa expurgo ativo e arquivos removidos sem esconder dados da conta", async ({
  page,
}) => {
  await mockAuth(page);
  const account = summary("2026-10-16T12:00:00Z");
  Object.assign(account.retention, {
    automaticPurgeEnabled: true,
    purgedAt: "2026-11-22T12:00:00Z",
  });
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: account, headers: corsHeaders }),
  );
  await login(page);
  await expect(
    page.getByText("A exclusão automática está ativa", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Os arquivos desta conta foram excluídos pela política de retenção.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: /Perfil e segurança/ }).click();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
});

test("publicação sem mídia continua mostrando a legenda após o expurgo", async ({
  page,
}) => {
  await mockAuth(page);
  const value = feed("Feed após expurgo");
  value.posts = [
    {
      id: randomUUID(),
      caption: "Texto preservado após o expurgo",
      location: "",
      likes: 10,
      mediaIds: [],
    },
  ];
  await mockFeeds(page, [value]);
  await login(page);
  await page.goto("/simulador");
  await page
    .getByRole("button", { name: "Abrir publicação 1", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Texto preservado após o expurgo", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      "Arquivos removidos. O texto desta publicação foi preservado.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    dialog.getByText(
      "Arquivos removidos. O texto desta publicação foi preservado.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("o editor orienta o aceite antes do primeiro upload do teste", async ({
  page,
}) => {
  await mockAuth(page);
  const value = summary();
  value.access.allowed = true;
  value.access.status = "trialing";
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: value, headers: corsHeaders }),
  );
  await mockFeeds(page, [feed()]);
  await login(page);
  await page.goto("/simulador");
  await expect(
    page.getByText(
      "Antes de enviar arquivos, leia a política de retenção do armazenamento.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ler e aceitar política" }).click();
  await expect(
    page.getByRole("checkbox", { name: /Li e aceito a política/ }),
  ).toBeVisible();
});
