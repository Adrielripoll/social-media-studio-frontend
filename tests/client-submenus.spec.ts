import { test, expect } from "@playwright/test";
import { login, mockAuth } from "./helpers/auth";
import { client, mockWorkspace } from "./helpers/workspace";
import { feed, mockFeeds } from "./helpers/feeds";
import { dashboard, mockDashboards } from "./helpers/dashboards";

test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});

test("seta expande e recolhe ferramentas por cliente sem navegar; aceita teclado", async ({
  page,
}) => {
  const first = client("Café Aurora");
  const second = client("Outro cliente");
  await mockWorkspace(page, [first, second]);
  await login(page);
  const nav = page.getByRole("navigation", {
    name: "Navegação do espaço de trabalho",
  });
  const toggle = nav.getByRole("button", {
    name: "Ferramentas de " + first.name,
    exact: true,
  });
  await expect(toggle).toBeVisible();
  const originalUrl = page.url();
  const tools = page.locator("#workspace-client-tools-" + first.id);
  await expect(tools).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    tools.getByRole("button", { name: "Feeds", exact: true }),
  ).toBeVisible();
  await expect(
    tools.getByRole("button", { name: "Dashboards", exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe(originalUrl);
  await expect(
    page.locator("#workspace-client-tools-" + second.id),
  ).toBeHidden();
  await nav
    .getByRole("button", { name: "Ferramentas de " + second.name, exact: true })
    .click();
  await expect(tools).toBeVisible();
  await toggle.focus();
  await toggle.press("Enter");
  await expect(tools).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.locator("#workspace-client-tools-" + second.id),
  ).toBeVisible();
});

test("atalhos mostram somente recursos do cliente e mantêm contexto ao recarregar", async ({
  page,
}) => {
  const parent = client("Café Aurora");
  const other = client("Outro cliente");
  await mockWorkspace(page, [parent, other]);
  await mockFeeds(page, [
    feed("Feed Aurora", parent.id),
    feed("Feed alheio", other.id),
    feed("Feed independente"),
  ]);
  await mockDashboards(page, [
    dashboard("Relatório Aurora", parent.id),
    dashboard("Relatório alheio", other.id),
    dashboard("Relatório independente"),
  ]);
  await login(page);
  const nav = page.getByRole("navigation", {
    name: "Navegação do espaço de trabalho",
  });
  await nav
    .getByRole("button", { name: "Ferramentas de " + parent.name, exact: true })
    .click();
  const tools = page.locator("#workspace-client-tools-" + parent.id);
  await tools.getByRole("button", { name: "Feeds", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Feeds deste cliente", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Feed Feed Aurora", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Feed Feed alheio", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "Feed Feed independente", exact: true }),
  ).toHaveCount(0);
  const editorLink = page.getByRole("link", {
    name: "Abrir feed",
    exact: true,
  });
  const returnTo = new URL(
    (await editorLink.getAttribute("href")) ?? "",
    page.url(),
  ).searchParams.get("returnTo");
  expect(returnTo).toBe("/?view=feeds&client=" + parent.id);
  await expect(
    tools.getByRole("button", { name: "Feeds", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(
    tools.getByRole("button", { name: "Feeds", exact: true }),
  ).toBeVisible();
  await tools.getByRole("button", { name: "Dashboards", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Dashboards deste cliente",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", {
      name: "Dashboard Relatório Aurora",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", {
      name: "Dashboard Relatório alheio",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("article", {
      name: "Dashboard Relatório independente",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    tools.getByRole("button", { name: "Dashboards", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await nav.getByRole("button", { name: parent.name, exact: true }).click();
  await expect(
    page.getByRole("article", { name: "Cliente " + parent.name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Feeds deste cliente", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Dashboards deste cliente",
      exact: true,
    }),
  ).toBeVisible();
});

test("submenu do cliente funciona dentro da lista recolhível no celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const parent = client("Cliente com nome comprido");
  await mockWorkspace(page, [parent]);
  await login(page);
  const nav = page.getByRole("navigation", {
    name: "Navegação do espaço de trabalho",
  });
  await nav.getByRole("button", { name: "Seus clientes", exact: true }).click();
  await nav
    .getByRole("button", { name: "Ferramentas de " + parent.name, exact: true })
    .click();
  const tools = page.locator("#workspace-client-tools-" + parent.id);
  await expect(
    tools.getByRole("button", { name: "Feeds", exact: true }),
  ).toBeVisible();
  await tools.getByRole("button", { name: "Feeds", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Feeds deste cliente", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("button", { name: parent.name, exact: true }),
  ).toBeVisible();
});
