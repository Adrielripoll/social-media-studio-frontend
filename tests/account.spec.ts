import { test, expect } from "@playwright/test";
import { mockAuth, login, apiUrl, corsHeaders } from "./helpers/auth";
import { feed, mockFeeds, png } from "./helpers/feeds";
function account(used = 0, reserved = 0, pending = 0) {
  return {
    plan: {
      code: "basic",
      name: "Essentials",
      storageLimitBytes: 2.5e9,
      features: { images: true, videos: false },
    },
    access: {
      status: "trialing",
      allowed: true,
      trialStartedAt: "2026-10-15T12:00:00Z",
      trialEndsAt: "2099-10-22T12:00:00Z",
    },
    storage: {
      limitBytes: 2.5e9,
      usedBytes: used,
      reservedBytes: reserved,
      pendingDeletionBytes: pending,
      availableBytes: Math.max(0, 2.5e9 - used - reserved),
      percentUsed: ((used + reserved) / 2.5e9) * 100,
    },
  };
}
test("exibe plano, teste e espaço compartilhado no desktop e mobile", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: account(2e9), headers: corsHeaders }),
  );
  await login(page);
  await expect(
    page.getByRole("region", { name: "Armazenamento da conta" }),
  ).toHaveCount(0);
  await page.goto("/minha-conta?secao=armazenamento");
  const summary = page.getByRole("region", { name: "Armazenamento da conta" });
  await expect(summary).toContainText("Essentials");
  await expect(summary).toContainText("2 GB de 2,5 GB");
  await expect(summary).toContainText("500 MB disponíveis");
  await expect(summary).toContainText("80% ocupado");
  await expect(summary.getByRole("meter")).toHaveAttribute(
    "value",
    "2000000000",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(summary).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/account-mobile.png",
    fullPage: true,
  });
});
test("informa cota esgotada e exclusões pendentes sem ocultar a navegação", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: account(2.5e9, 0, 1e9), headers: corsHeaders }),
  );
  await login(page);
  await expect(
    page.getByRole("link", { name: "Abrir meus feeds" }),
  ).toBeVisible();
  await page.goto("/minha-conta?secao=armazenamento");
  const summary = page.getByRole("region", { name: "Armazenamento da conta" });
  await expect(summary).toContainText("Cota esgotada");
  await expect(summary).toContainText("1 GB em exclusão");
});
test("reconsulta o consumo após upload e após a confirmação de exclusão", async ({
  page,
}) => {
  await mockAuth(page);
  const { state } = await mockFeeds(page, [feed()]);
  let reads = 0;
  let usedBytes = 0;
  await page.route(apiUrl + "/account", (route) => {
    reads++;
    usedBytes = state.feeds.reduce(
      (sum, item) => sum + item.media.length * 1e6,
      0,
    );
    return route.fulfill({
      json: account(
        state.feeds.reduce((sum, item) => sum + item.media.length * 1e6, 0),
      ),
      headers: corsHeaders,
    });
  });
  await login(page);
  await page.goto("/simulador");
  const summary = page.getByRole("region", { name: "Armazenamento da conta" });
  await expect(summary).toHaveCount(0);
  const before = reads;
  await page
    .getByRole("button", { name: "Nova publicação", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Selecionar arquivos da publicação")
    .setInputFiles(await png(page));
  await expect.poll(() => usedBytes).toBe(1e6);
  expect(reads).toBeGreaterThan(before);
  await page.keyboard.press("Escape");
  await expect.poll(() => usedBytes).toBe(0);
  await page.goto("/minha-conta?secao=armazenamento");
  await expect(summary).toContainText("0 B de 2,5 GB");
});
test("erro de consulta permite tentar novamente sem informar consumo zero", async ({
  page,
}) => {
  await mockAuth(page);
  let fail = true;
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({
      status: fail ? 503 : 200,
      json: fail ? { message: "Falha temporária" } : account(),
      headers: corsHeaders,
    }),
  );
  await login(page);
  const region = page.getByRole("region", {
    name: "Armazenamento",
    exact: true,
  });
  await expect(region.getByRole("alert")).toContainText("Não foi possível");
  await expect(region).not.toContainText("0 B");
  fail = false;
  await region.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("link", { name: "Abrir meus feeds" }),
  ).toBeVisible();
  await page.goto("/minha-conta?secao=armazenamento");
  await expect(
    page.getByRole("region", { name: "Armazenamento da conta" }),
  ).toContainText("0 B de 2,5 GB");
});
test("período encerrado e reservas ficam claros em tablet", async ({
  page,
}) => {
  await mockAuth(page);
  const value = account(1e9, 1e6);
  value.access.allowed = false;
  value.access.status = "trial_expired";
  await page.route(apiUrl + "/account", (route) =>
    route.fulfill({ json: value, headers: corsHeaders }),
  );
  await page.setViewportSize({ width: 768, height: 1024 });
  await login(page);
  const summary = page.getByRole("region", { name: "Armazenamento da conta" });
  await expect(summary).toContainText("Novos uploads estão bloqueados");
  await expect(summary).toContainText("1 MB reservados");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
