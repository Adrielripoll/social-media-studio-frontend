import { test, expect } from "@playwright/test";
import { login, mockAuth } from "./helpers/auth";
import { client, mockWorkspace } from "./helpers/workspace";
import { dashboard, mockDashboards } from "./helpers/dashboards";

test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});

test("troca só o conteúdo da página e mantém navegação estável", async ({
  page,
}) => {
  await mockWorkspace(page, [client("Cliente de teste")]);
  await login(page);
  const nav = page.getByRole("navigation", {
    name: "Navegação do espaço de trabalho",
  });
  await expect(nav).toBeVisible();
  await nav.evaluate((element) => element.setAttribute("data-stable", "yes"));
  await page
    .locator(".workspace-view")
    .evaluate((element) => element.setAttribute("data-view-before", "yes"));
  await nav
    .locator(".workspace-primary-nav")
    .getByRole("button", { name: "Feeds", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seus feeds", exact: true }),
  ).toBeVisible();
  await expect(nav).toHaveAttribute("data-stable", "yes");
  await expect(page.locator(".workspace-view")).not.toHaveAttribute(
    "data-view-before",
    "yes",
  );
  expect(
    await page
      .locator(".workspace-view")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("workspace-view-enter");
});

test("modal fecha por Escape, devolve foco e não repete a gravação durante a saída", async ({
  page,
}) => {
  const { requests } = await mockWorkspace(page);
  await login(page);
  const trigger = page.getByRole("button", {
    name: "Novo cliente",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Novo cliente",
    exact: true,
  });
  await expect(
    dialog.getByLabel("Nome do cliente", { exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog
    .getByLabel("Nome do cliente", { exact: true })
    .fill("Cliente animado");
  await dialog
    .getByRole("button", { name: "Criar cliente", exact: true })
    .click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(requests.filter((request) => request.method === "POST")).toHaveLength(
    1,
  );
});

test("movimento reduzido desativa transições de página e da lista mobile", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkspace(page, [client("Cliente mobile")]);
  await login(page);
  const nav = page.getByRole("navigation", {
    name: "Navegação do espaço de trabalho",
  });
  const toggle = nav.getByRole("button", {
    name: "Seus clientes",
    exact: true,
  });
  const list = page.locator("#workspace-clients-list");
  await expect(toggle).toBeVisible();
  await nav.getByRole("button", { name: "Novo cliente", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Novo cliente", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  expect(
    await page
      .locator(".workspace-view")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  expect(await list.evaluate((element) => element.inert)).toBe(true);
  await toggle.click();
  await expect(
    nav.getByRole("button", { name: "Cliente mobile", exact: true }),
  ).toBeVisible();
  expect(
    await list.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe("0s");
  await toggle.click();
  expect(await list.evaluate((element) => element.inert)).toBe(true);
  await expect(
    nav.getByRole("button", { name: "Cliente mobile", exact: true }),
  ).toBeHidden();
});

test("configurações do dashboard expandem sem perder o rascunho nem reiniciar a página", async ({
  page,
}) => {
  const value = dashboard();
  await mockWorkspace(page);
  await mockDashboards(page, [value]);
  await login(page);
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.goto("/?view=dashboards&dashboard=" + value.id);
  const toggle = page.getByRole("button", {
    name: "Editar informações do dashboard",
    exact: true,
  });
  await toggle.click();
  await page
    .getByLabel("Nome do dashboard", { exact: true })
    .fill("Rascunho preservado");
  await page
    .locator(".workspace-view")
    .evaluate((element) => element.setAttribute("data-stable", "yes"));
  await toggle.click();
  await expect(
    page.getByLabel("Nome do dashboard", { exact: true }),
  ).toBeHidden();
  await toggle.click();
  await expect(
    page.getByLabel("Nome do dashboard", { exact: true }),
  ).toHaveValue("Rascunho preservado");
  await expect(page.locator(".workspace-view")).toHaveAttribute(
    "data-stable",
    "yes",
  );
});
