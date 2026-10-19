import { test, expect } from "@playwright/test";
import { mockAuth, login, apiUrl, corsHeaders } from "./helpers/auth";
function summary(status = "trial_expired", allowed = false) {
  return {
    retention: {
      status: allowed ? "protected" : "retained",
      months: 1,
      projectedPurgeAt: null,
      automaticPurgeEnabled: false,
      acceptedAt: "2026-10-15T12:00:00Z",
    },
    plan: {
      code: "basic",
      name: "Plano Básico",
      storageLimitBytes: 2.5e9,
      features: { images: true, videos: false },
    },
    access: {
      status,
      allowed,
      trialStartedAt: "2026-10-01T12:00:00Z",
      trialEndsAt: "2026-10-08T12:00:00Z",
      paidUntil:
        status === "active" || status === "canceled"
          ? "2099-11-15T03:00:00Z"
          : null,
    },
    storage: {
      limitBytes: 2.5e9,
      usedBytes: 1e9,
      reservedBytes: 0,
      pendingDeletionBytes: 0,
      availableBytes: 1.5e9,
      percentUsed: 40,
    },
  };
}
test("teste expirado bloqueia ferramentas sem consultar seus dados e mantém saída e cobrança", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: summary(), headers: corsHeaders }),
  );
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Vamos regularizar seu acesso." }),
  ).toBeVisible();
  await expect(
    page.getByText("A contratação estará disponível em breve."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Contratar Plano Básico" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible();
  expect(
    requests.some((r) =>
      ["/tasks/today", "/clients", "/feeds", "/dashboards"].includes(r.path),
    ),
  ).toBe(false);
  await page.goto("/simulador");
  await expect(
    page.getByRole("heading", { name: "Vamos regularizar seu acesso." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/billing-blocked-mobile.png",
    fullPage: true,
  });
});
test("o retorno de sucesso do checkout não libera a conta sem confirmação", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: summary(), headers: corsHeaders }),
  );
  await login(page);
  await page.goto("/assinatura?retorno=sucesso");
  await expect(
    page.getByRole("heading", { name: "Vamos regularizar seu acesso." }),
  ).toBeVisible();
  await expect(
    page.getByText("O retorno do checkout não confirma o pagamento.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("exibe cobrança pendente e atualiza acesso após confirmação verificada", async ({
  page,
}) => {
  await mockAuth(page);
  let confirmed = false;
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({
      json: summary(confirmed ? "active" : "overdue", confirmed),
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/billing/**", (route) =>
    route.fulfill({ json: { accepted: true }, headers: corsHeaders }),
  );
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: {
        available: true,
        priceCents: 9900,
        subscription: {
          status: "active",
          anchorDate: "2026-10-15",
          priceCents: 9900,
          canceledAt: null,
          checkoutUrl: null,
        },
        payments: [
          {
            status: confirmed ? "CONFIRMED" : "OVERDUE",
            dueDate: "2026-10-15",
            valueCents: 9900,
            invoiceUrl: "https://sandbox.asaas.com/i/test",
          },
        ],
      },
      headers: corsHeaders,
    }),
  );
  await login(page);
  await expect(
    page.getByText("Pagamento atrasado", { exact: true }),
  ).toBeVisible();
  const link = page.getByRole("link", { name: "Ver cobrança" });
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  confirmed = true;
  await page.getByRole("button", { name: "Verificar pagamento" }).click();
  await expect(page.getByRole("heading", { name: /Bem-vindo/ })).toBeVisible();
});
test("mostra o período pago e confirma cancelamento sem remover o acesso", async ({
  page,
}) => {
  await mockAuth(page);
  let canceled = false;
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({
      json: summary(canceled ? "canceled" : "active", true),
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: {
        available: true,
        priceCents: 9900,
        subscription: {
          status: canceled ? "canceled" : "active",
          anchorDate: "2026-10-15",
          priceCents: 9900,
          canceledAt: canceled ? "2026-10-15T12:00:00Z" : null,
          checkoutUrl: null,
        },
        payments: [],
      },
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/billing/cancel", (route) => {
    canceled = true;
    return route.fulfill({ json: { canceled: true }, headers: corsHeaders });
  });
  await login(page);
  await page.goto("/assinatura");
  await expect(
    page.getByText("Acesso pago até 14/11/2099.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancelar assinatura", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("14/11/2099");
  await dialog.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Sua assinatura não será renovada.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Voltar às ferramentas" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/billing-canceled-desktop.png",
    fullPage: true,
  });
});

test("preço indefinido no catálogo bloqueia contratação mesmo com gateway configurado", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: {
        available: true,
        priceCents: null,
        subscription: null,
        payments: [],
      },
      headers: corsHeaders,
    }),
  );
  await login(page);
  await page.goto("/assinatura");
  await expect(
    page.getByText("Preço em definição", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Contratar Plano Básico" }),
  ).toBeDisabled();
});
test("recontratação exibe o preço atual do catálogo em vez do valor do contrato cancelado", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({
      json: summary("subscription_expired", false),
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: {
        available: true,
        priceCents: 14990,
        subscription: {
          status: "canceled",
          priceCents: 9900,
          anchorDate: "2026-09-15",
          canceledAt: "2026-10-15T12:00:00Z",
          checkoutUrl: null,
        },
        resumption: {
          mode: "checkout",
          nextChargeDate: "2026-10-16",
          priceCents: 14990,
        },
        payments: [],
      },
      headers: corsHeaders,
    }),
  );
  await login(page);
  await expect(page.locator(".billing-price")).toContainText("149,90 / mês");
  await expect(
    page.getByRole("button", { name: "Retomar assinatura" }),
  ).toBeEnabled();
});

test("retomada de ciclo pago destaca ausência de cobrança e agenda a próxima renovação", async ({
  page,
}) => {
  await mockAuth(page);
  let resumed = false;
  let resumeRequests = 0;
  let checkoutRequests = 0;
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({
      json: summary(resumed ? "active" : "canceled", true),
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: {
        available: true,
        priceCents: 14990,
        subscription: {
          status: resumed ? "active" : "canceled",
          priceCents: 9900,
          anchorDate: "2099-10-15",
          canceledAt: resumed ? null : "2099-10-20T12:00:00Z",
          checkoutUrl: null,
          nextRenewalDate: resumed ? "2099-11-15" : null,
        },
        currentPeriod: {
          start: "2099-10-15T03:00:00Z",
          end: "2099-11-15T03:00:00Z",
        },
        resumption: resumed
          ? null
          : { mode: "renewal", nextChargeDate: "2099-11-15", priceCents: 9900 },
        payments: [],
      },
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/billing/checkout", (route) => {
    if (route.request().method() !== "OPTIONS") checkoutRequests++;
    return route.fulfill({ status: 500, headers: corsHeaders });
  });
  await page.route(apiUrl + "/billing/resume", (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    expect(route.request().postDataJSON()).toEqual({ mode: "renewal" });
    resumeRequests++;
    resumed = true;
    return route.fulfill({
      json: { kind: "resumed", nextChargeDate: "2099-11-15" },
      headers: corsHeaders,
    });
  });
  await login(page);
  await page.goto("/assinatura");
  await page.getByRole("button", { name: "Retomar assinatura" }).click();
  const dialog = page.getByRole("dialog", { name: "Retomar assinatura?" });
  await expect(dialog).toContainText("Nenhuma cobrança será feita agora.");
  await expect(dialog).toContainText("99,00");
  await expect(dialog).toContainText("15/11/2099");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "Confirmar retomada" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("Assinatura retomada. Nenhuma cobrança foi feita agora.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancelar assinatura", exact: true }),
  ).toBeVisible();
  expect(resumeRequests).toBe(1);
  expect(checkoutRequests).toBe(0);
});

test("retomada com ciclo encerrado exige confirmação de pagamento antes de abrir o Asaas", async ({
  page,
}) => {
  await mockAuth(page);
  let resumeRequests = 0;
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({
      json: summary("subscription_expired", false),
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: {
        available: true,
        priceCents: 14990,
        subscription: {
          status: "canceled",
          priceCents: 9900,
          anchorDate: "2026-09-15",
          canceledAt: "2026-09-20T12:00:00Z",
          checkoutUrl: null,
        },
        currentPeriod: null,
        resumption: {
          mode: "checkout",
          nextChargeDate: "2026-10-16",
          priceCents: 14990,
        },
        payments: [],
      },
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/billing/resume", (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: corsHeaders });
    expect(route.request().postDataJSON()).toEqual({ mode: "checkout" });
    resumeRequests++;
    return route.fulfill({
      json: {
        kind: "checkout",
        url: "https://sandbox.asaas.com/checkoutSession/show?id=resume_test",
      },
      headers: corsHeaders,
    });
  });
  await page.route("https://sandbox.asaas.com/checkoutSession/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "Checkout de teste" }),
  );
  await login(page);
  await page.getByRole("button", { name: "Retomar assinatura" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("149,90 agora");
  await expect(dialog).toContainText(
    "O acesso será liberado após a confirmação do pagamento",
  );
  expect(resumeRequests).toBe(0);
  await dialog
    .getByRole("button", { name: "Continuar para pagamento" })
    .click();
  await expect(page).toHaveURL(/sandbox.asaas.com\/checkoutSession\/show/);
  expect(resumeRequests).toBe(1);
});

test("ciclo encerrado durante a confirmação não vira um novo checkout silencioso", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: summary("canceled", true), headers: corsHeaders }),
  );
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: {
        available: true,
        priceCents: 9900,
        subscription: {
          status: "canceled",
          priceCents: 9900,
          anchorDate: "2099-10-15",
          canceledAt: "2099-10-20T12:00:00Z",
          checkoutUrl: null,
        },
        resumption: {
          mode: "renewal",
          nextChargeDate: "2099-11-15",
          priceCents: 9900,
        },
        payments: [],
      },
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/billing/resume", (route) =>
    route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 409,
      json: {
        code: "paid_cycle_ended",
        message:
          "Seu ciclo pago terminou. Atualize a página e confirme um novo pagamento para iniciar outro ciclo.",
      },
      headers: corsHeaders,
    }),
  );
  await login(page);
  await page.goto("/assinatura");
  await page.getByRole("button", { name: "Retomar assinatura" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar retomada" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "Seu ciclo pago terminou" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/minha-conta|assinatura/);
});
