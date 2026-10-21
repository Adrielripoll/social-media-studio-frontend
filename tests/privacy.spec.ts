import { test, expect } from "@playwright/test";
import { mockAuth, login, apiUrl, corsHeaders } from "./helpers/auth";
import { join } from "node:path";

const billing = {
  available: true,
  priceCents: 9900,
  subscription: {
    status: "active",
    anchorDate: "2026-10-15",
    priceCents: 9900,
    canceledAt: null,
    checkoutUrl: null,
  },
  payments: [],
};

test("perfil exibe verificação e privacidade pública, inclusive no mobile", async ({
  page,
}) => {
  await mockAuth(page);
  await login(page);
  await page.goto("/minha-conta");
  const verified = page.getByRole("status", {
    name: "Email verificado",
    exact: true,
  });
  await expect(verified).toBeVisible();
  await verified.hover();
  await expect(
    page.getByRole("tooltip", { name: "Email verificado" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tooltip", { name: "Email verificado" }),
  ).toHaveCSS("opacity", "1");
  if (process.env.LGPD_SCREENSHOT_DIRECTORY) {
    await page
      .getByRole("region", { name: "Seu perfil" })
      .screenshot({
        path: join(
          process.env.LGPD_SCREENSHOT_DIRECTORY,
          "email-verificado-tooltip-desktop.png",
        ),
      });
  }
  await verified.focus();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("tooltip", { name: "Email verificado" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Privacidade e seus dados" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/privacidade");
  await expect(
    page.getByRole("heading", { name: "Política de privacidade", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("51.067.758/0001-88", { exact: false }),
  ).toBeVisible();
});

test("cancelamento permite continuar sem motivos e informa processamento real", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({ json: billing, headers: corsHeaders }),
  );
  await page.route(apiUrl + "/account/exit-reasons?*", (route) =>
    route.fulfill({ status: 503, json: {}, headers: corsHeaders }),
  );
  let sent: unknown = null;
  await page.route(apiUrl + "/billing/cancel", (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({
      json: { canceled: false, processing: true },
      headers: corsHeaders,
    });
  });
  await login(page);
  await page.goto("/minha-conta?secao=assinatura");
  await page
    .getByRole("button", { name: "Cancelar assinatura", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Quer continuar com a gente?",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Você pode continuar sem escolher um.", { exact: false }),
  ).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  if (process.env.LGPD_SCREENSHOT_DIRECTORY) {
    await page.screenshot({
      path: join(
        process.env.LGPD_SCREENSHOT_DIRECTORY,
        "cancelamento-desktop.png",
      ),
    });
  }
  await dialog.getByRole("button", { name: "Confirmar cancelamento" }).click();
  expect(sent).toEqual({});
  await expect(
    page.getByText(
      "Recebemos seu pedido. O cancelamento ainda está em processamento",
      { exact: false },
    ),
  ).toBeVisible();
});

test("exclusão usa senha atual e exibe recibo sem afirmar conclusão", async ({
  page,
}) => {
  await mockAuth(page);
  let sent = false;
  await page.route(apiUrl + "/account/deletion", (route) => {
    const body = route.request().postDataJSON();
    sent = Boolean(body.currentPassword) && !("userId" in body);
    return route.fulfill({
      json: {
        accepted: true,
        protocol: "30000000-0000-4000-8000-000000000001",
      },
      headers: corsHeaders,
    });
  });
  await login(page);
  await page.goto("/minha-conta");
  await page
    .getByRole("button", { name: "Excluir minha conta", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Excluir sua conta definitivamente?",
  });
  await expect(dialog.getByLabel("Senha atual")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(dialog).toHaveCSS("opacity", "1");
  if (process.env.LGPD_SCREENSHOT_DIRECTORY) {
    await page.screenshot({
      path: join(
        process.env.LGPD_SCREENSHOT_DIRECTORY,
        "exclusao-mobile-antes-da-senha.png",
      ),
    });
  }
  await dialog.getByLabel("Senha atual").fill("fixture-only");
  await dialog
    .getByRole("button", { name: "Excluir minha conta", exact: true })
    .click();
  await expect(page).toHaveURL(/conta-excluida/);
  expect(sent).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Recebemos seu pedido de exclusão" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Este recibo não significa que todas as etapas já foram concluídas.",
      { exact: false },
    ),
  ).toBeVisible();
});

test("email não confirmado abre modal antes de qualquer checkout", async ({
  page,
}) => {
  await mockAuth(page);
  await page.route(apiUrl + "/account/email-verification", (route) =>
    route.fulfill({ json: { verified: false }, headers: corsHeaders }),
  );
  await page.route(apiUrl + "/billing", (route) =>
    route.fulfill({
      json: { ...billing, subscription: null },
      headers: corsHeaders,
    }),
  );
  let checkout = 0;
  await page.route(apiUrl + "/billing/checkout", (route) => {
    checkout++;
    return route.fulfill({ status: 500, json: {}, headers: corsHeaders });
  });
  await login(page);
  await page.goto("/minha-conta?secao=assinatura");
  await page.getByRole("button", { name: "Contratar Plano Básico" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Verifique seu email antes de assinar",
  });
  await expect(
    dialog.getByRole("button", { name: "Verificar email", exact: true }),
  ).toBeVisible();
  expect(checkout).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
