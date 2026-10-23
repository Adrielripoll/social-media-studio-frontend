import { test, expect } from "@playwright/test";
import { mockAuth, login, apiUrl, corsHeaders } from "./helpers/auth";
function account(allowed = true, used = 0, pending = 0) {
  return {
    plan: {
      code: "basic",
      name: "Essentials",
      storageLimitBytes: 2.5e9,
      features: { images: true, videos: false },
    },
    access: {
      status: allowed ? "trialing" : "trial_expired",
      allowed,
      trialStartedAt: "2026-10-15T12:00:00Z",
      trialEndsAt: allowed ? "2099-10-22T12:00:00Z" : "2026-10-22T12:00:00Z",
      paidUntil: null,
    },
    storage: {
      limitBytes: 2.5e9,
      usedBytes: used,
      reservedBytes: 0,
      pendingDeletionBytes: pending,
      availableBytes: Math.max(0, 2.5e9 - used),
      percentUsed: (used / 2.5e9) * 100,
    },
    retention: {
      status: allowed ? "protected" : "retained",
      months: 1,
      projectedPurgeAt: allowed ? null : "2026-11-22T12:00:00Z",
      automaticPurgeEnabled: false,
    },
  };
}
async function openProfile(page: Parameters<typeof login>[0]) {
  await login(page);
  await page.getByRole("link", { name: "Minha conta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Minha conta", exact: true }),
  ).toBeVisible();
}
test("edita perfil, normaliza celular e preserva as alterações após recarregar", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await openProfile(page);
  await expect(page.getByLabel("Email de acesso")).toHaveAttribute(
    "readonly",
    "",
  );
  await page.getByLabel("Nome completo").fill("  Maria   Oliveira  ");
  await page.getByLabel("Celular (com DDD)").fill("(51) 98888-7777");
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.locator(".account-feedback.success")).toHaveText(
    "Perfil atualizado com sucesso.",
  );
  expect(
    requests.find((r) => r.path === "/users/me" && r.method === "PATCH")?.body,
  ).toEqual({ name: "Maria   Oliveira", phone: "+5551988887777" });
  await page.reload();
  await expect(page.getByLabel("Nome completo")).toHaveValue("Maria Oliveira");
  await expect(page.getByLabel("Celular (com DDD)")).toHaveValue(
    "(51) 98888-7777",
  );
  expect(
    requests
      .filter((r) => r.path === "/users/me" && r.method === "PATCH")
      .every((r) => !r.body?.userId && !r.body?.email),
  ).toBe(true);
});
test("conflito de celular mantém os dados digitados e direciona o foco ao campo", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/users/me", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 409,
          json: {
            code: "phone_already_in_use",
            message: "Este celular já está vinculado a uma conta.",
          },
          headers: corsHeaders,
        })
      : route.fallback(),
  );
  await openProfile(page);
  await page.getByLabel("Nome completo").fill("Nome em edição");
  const phone = page.getByLabel("Celular (com DDD)");
  await phone.fill("(51) 98888-7777");
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByRole("alert")).toContainText("Este celular");
  await expect(phone).toBeFocused();
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Nome completo")).toHaveValue("Nome em edição");
});
test("falha ao salvar perfil preserva o rascunho e permite nova tentativa", async ({
  page,
}) => {
  await mockAuth(page);
  let fail = true;
  await page.route(apiUrl + "/users/me", (route) =>
    route.request().method() === "PATCH" && fail
      ? route.fulfill({
          status: 503,
          json: { message: "Falha temporária ao salvar." },
          headers: corsHeaders,
        })
      : route.fallback(),
  );
  await openProfile(page);
  await page.getByLabel("Nome completo").fill("Maria Atualizada");
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByRole("alert")).toContainText("Falha temporária");
  await expect(page.getByLabel("Nome completo")).toHaveValue(
    "Maria Atualizada",
  );
  fail = false;
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByText("Perfil atualizado com sucesso.")).toBeVisible();
});
test("valida confirmação de senha e usa o fluxo existente que encerra a sessão", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await openProfile(page);
  await page
    .getByLabel("Senha atual", { exact: true })
    .fill("senha-segura-123");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("Nova-senha-segura-123");
  const confirmation = page.getByLabel("Confirme a nova senha");
  await confirmation.fill("senha-diferente");
  await page
    .getByRole("button", { name: "Alterar senha", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "As senhas precisam ser iguais",
  );
  await expect(confirmation).toBeFocused();
  expect(requests.some((r) => r.path === "/auth/password")).toBe(false);
  await confirmation.fill("Nova-senha-segura-123");
  await page
    .getByRole("button", { name: "Alterar senha", exact: true })
    .click();
  await expect(
    page.getByText("Senha alterada. Entre novamente com a nova senha."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
  expect(requests.find((r) => r.path === "/auth/password")?.body).toEqual({
    password: "Nova-senha-segura-123",
    currentPassword: "senha-segura-123",
  });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "Nova-senha-segura-123",
  );
});
test("navegação entre seções acompanha o histórico e funciona de 320 a 1440 px", async ({
  page,
}) => {
  await mockAuth(page);
  await openProfile(page);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(page.getByLabel("Nome completo")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: "test-results/my-account-profile-" + width + ".png",
        fullPage: true,
      });
  }
  const nav = page.getByRole("navigation", { name: "Configurações da conta" });
  await nav.getByRole("link", { name: "Armazenamento" }).click();
  await expect(
    page.getByRole("heading", { name: "Onde seu espaço está sendo usado" }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Assinatura" }).click();
  await expect(
    page.getByRole("region", { name: "Assinatura do Essentials" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Onde seu espaço está sendo usado" }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Armazenamento" }),
  ).toHaveAttribute("aria-current", "page");
});
test("conta bloqueada mantém perfil e consulta de armazenamento com previsão de retenção", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: account(false, 1e9), headers: corsHeaders }),
  );
  await page.route(apiUrl + "/account/storage", (route) =>
    route.fulfill({
      json: {
        resources: [
          {
            resourceType: "feed",
            resourceId: "feed-1",
            name: "Campanha verão",
            fileCount: 3,
            usedBytes: 1e9,
            reservedBytes: 0,
            pendingDeletionBytes: 0,
          },
        ],
      },
      headers: corsHeaders,
    }),
  );
  await login(page);
  const nav = page.getByRole("navigation", { name: "Configurações da conta" });
  await nav.getByRole("link", { name: "Perfil e segurança" }).click();
  await expect(page.getByLabel("Nome completo")).toBeEditable();
  await nav.getByRole("link", { name: "Armazenamento" }).click();
  await expect(page.getByText("22/11/2026", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Excluir feed Campanha verão" }),
  ).toBeDisabled();
  await expect(
    page.getByText("A exclusão automática ainda não está ativa.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(requests.some((r) => r.path === "/feeds")).toBe(false);
});
test("gerencia o consumo e só exibe espaço liberado após exclusão confirmada", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  let removed = false;
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({
      json: account(true, removed ? 0 : 2.5e9),
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/account/storage", (route) =>
    route.fulfill({
      json: {
        resources: removed
          ? []
          : [
              {
                resourceType: "feed",
                resourceId: "feed-1",
                name: "Campanha verão",
                fileCount: 3,
                usedBytes: 2.5e9,
                reservedBytes: 0,
                pendingDeletionBytes: 0,
              },
            ],
      },
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/feeds/feed-1", (route) => {
    removed = true;
    return route.fulfill({ status: 204, headers: corsHeaders });
  });
  await openProfile(page);
  await page
    .getByRole("navigation", { name: "Configurações da conta" })
    .getByRole("link", { name: "Armazenamento" })
    .click();
  await expect(
    page.getByText("Cota esgotada.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir feed Campanha verão" })
    .click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Essa ação não pode ser desfeita");
  await dialog.getByRole("button", { name: "Manter feed" }).click();
  expect(requests.some((r) => r.method === "DELETE")).toBe(false);
  await page
    .getByRole("button", { name: "Excluir feed Campanha verão" })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(
    page.getByText("Os arquivos das suas ferramentas aparecerão aqui."),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Armazenamento da conta" }),
  ).toContainText("0 B de 2,5 GB");
});
test("mostra dados de renovação, ciclo e histórico na seção de assinatura", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: {
        available: true,
        priceCents: 9900,
        subscription: {
          status: "active",
          anchorDate: "2026-10-15",
          priceCents: 9900,
          nextRenewalDate: "2026-11-15",
          paymentMethod: "CREDIT_CARD",
          checkoutUrl: null,
          canceledAt: null,
        },
        currentPeriod: {
          start: "2026-10-15T03:00:00Z",
          end: "2026-11-15T03:00:00Z",
        },
        payments: [
          {
            status: "RECEIVED",
            dueDate: "2026-10-15",
            valueCents: 9900,
            invoiceUrl: "https://sandbox.asaas.com/i/test",
          },
        ],
      },
      headers: corsHeaders,
    }),
  );
  await openProfile(page);
  await page
    .getByRole("navigation", { name: "Configurações da conta" })
    .getByRole("link", { name: "Assinatura" })
    .click();
  const region = page.getByRole("region", {
    name: "Assinatura do Essentials",
  });
  await expect(region).toContainText("15/11/2026");
  await expect(region).toContainText("15/10/2026 a 14/11/2026");
  await expect(page.getByRole("region", { name: "Cobranças" })).toContainText(
    "Pagamento confirmado",
  );
  await page.screenshot({
    path: "test-results/my-account-subscription-desktop.png",
    fullPage: true,
  });
});
test("falhas de consulta de assinatura e armazenamento permitem repetir sem mostrar falso estado vazio", async ({
  page,
}) => {
  await mockAuth(page);
  let fail = true;
  await page.route(apiUrl + "/billing", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { message: "Falha" },
          headers: corsHeaders,
        })
      : route.fallback(),
  );
  await page.route(apiUrl + "/account/storage", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { message: "Falha" },
          headers: corsHeaders,
        })
      : route.fallback(),
  );
  await openProfile(page);
  const nav = page.getByRole("navigation", { name: "Configurações da conta" });
  await nav.getByRole("link", { name: "Assinatura" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível consultar sua assinatura",
  );
  await nav.getByRole("link", { name: "Armazenamento" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível consultar seus arquivos",
  );
  await expect(
    page.getByText("Os arquivos das suas ferramentas aparecerão aqui."),
  ).not.toBeVisible();
  fail = false;
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByText("Os arquivos das suas ferramentas aparecerão aqui."),
  ).toBeVisible();
});

test("exclusão lógica mantém cota até a limpeza automática e não oferece nova exclusão", async ({
  page,
}) => {
  await mockAuth(page);
  let pending = false,
    removed = false;
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({
      json: account(true, removed ? 0 : 1e9, pending && !removed ? 1e9 : 0),
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/account/storage", (route) =>
    route.fulfill({
      json: {
        resources: removed
          ? []
          : [
              {
                resourceType: "feed",
                resourceId: "feed-1",
                name: "Campanha verão",
                fileCount: 3,
                usedBytes: 1e9,
                reservedBytes: 0,
                pendingDeletionBytes: pending ? 1e9 : 0,
                pendingDeletion: pending,
              },
            ],
      },
      headers: corsHeaders,
    }),
  );
  await page.route(apiUrl + "/feeds/feed-1", (route) => {
    pending = true;
    return route.fulfill({ status: 204, headers: corsHeaders });
  });
  await openProfile(page);
  await page
    .getByRole("navigation", { name: "Configurações da conta" })
    .getByRole("link", { name: "Armazenamento" })
    .click();
  await page
    .getByRole("button", { name: "Excluir feed Campanha verão" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar exclusão" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Armazenamento da conta" }),
  ).toContainText("1 GB de 2,5 GB");
  await expect(
    page.getByRole("button", { name: "Excluir feed Campanha verão" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Exclusão em andamento. Os arquivos serão removidos automaticamente.",
    ),
  ).toBeVisible();
  removed = true;
  await page.getByRole("button", { name: "Atualizar arquivos" }).click();
  await expect(
    page.getByText("Os arquivos das suas ferramentas aparecerão aqui."),
  ).toBeVisible();
});

test("limita nome a 60, mascara telefone e valida complexidade da nova senha", async ({
  page,
}) => {
  const requests = await mockAuth(page);
  await openProfile(page);
  await expect(page.getByLabel("Nome completo")).toHaveAttribute(
    "maxlength",
    "60",
  );
  await expect(page.getByLabel("Celular (com DDD)")).toHaveValue(
    "(11) 99999-9999",
  );
  await page.getByLabel("Senha atual", { exact: true }).fill("senha-anterior");
  await page.getByLabel("Nova senha", { exact: true }).fill("sem-maiuscula!");
  await page.getByLabel("Confirme a nova senha").fill("sem-maiuscula!");
  await page
    .getByRole("button", { name: "Alterar senha", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("maiúscula");
  expect(requests.some((r) => r.path === "/auth/password")).toBe(false);
});
test("senha atual incorreta mantém sessão e foca o campo para correção", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/auth/password", (route) =>
    route.fulfill({
      status: 400,
      json: {
        code: "current_password_invalid",
        message: "A senha atual está incorreta.",
      },
      headers: corsHeaders,
    }),
  );
  await openProfile(page);
  await page.getByLabel("Senha atual", { exact: true }).fill("senha-incorreta");
  await page.getByLabel("Nova senha", { exact: true }).fill("Nova-senha!");
  await page.getByLabel("Confirme a nova senha").fill("Nova-senha!");
  await page
    .getByRole("button", { name: "Alterar senha", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "senha atual está incorreta",
  );
  await expect(page.getByLabel("Senha atual", { exact: true })).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Minha conta", exact: true }),
  ).toBeVisible();
});

test("rate limit no perfil informa espera, preserva sessão e não repete a escrita", async ({
  page,
}) => {
  await mockAuth(page);
  let attempts = 0;
  await page.route(apiUrl + "/users/me", (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    attempts++;
    return route.fulfill({
      status: 429,
      headers: {
        ...corsHeaders,
        "Retry-After": "60",
        "Access-Control-Expose-Headers": "Retry-After",
      },
      json: {
        code: "rate_limit_exceeded",
        message: "Muitas solicitações. Aguarde 60 segundos e tente novamente.",
        retryAfterSeconds: 60,
      },
    });
  });
  await openProfile(page);
  await page.getByLabel("Nome completo").fill("Nome em edição");
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByRole("alert")).toContainText("Aguarde 60 segundos");
  await expect(page.getByLabel("Nome completo")).toHaveValue("Nome em edição");
  await expect(
    page.getByRole("heading", { name: "Minha conta", exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(1);
  await page.screenshot({
    path: test.info().outputPath("rate-limit-profile.png"),
  });
});
