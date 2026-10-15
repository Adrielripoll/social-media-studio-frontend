import { test, expect } from "@playwright/test";
import { login, mockAuth } from "./helpers/auth";
import { client, mockWorkspace } from "./helpers/workspace";
test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});
const nav = (page: Parameters<typeof login>[0]) =>
  page.getByRole("navigation", { name: "Navegação do espaço de trabalho" });
test("mantém calendário e clientes ativos sem controles nem chamadas de projetos", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname),
  );
  await mockWorkspace(page, [client("Meu cliente")]);
  await login(page);
  await expect(
    page.getByRole("region", { name: "Suas tarefas de hoje", exact: true }),
  ).toBeVisible();
  await expect(nav(page).getByRole("button", { name: /projeto/i })).toHaveCount(
    0,
  );
  await nav(page)
    .getByRole("button", { name: "Meu cliente", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Cliente Meu cliente" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /projeto/i })).toHaveCount(0);
  await nav(page).getByRole("button", { name: "Início", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Calendário", exact: true }),
  ).toBeVisible();
  expect(requests.some((path) => path.startsWith("/projects"))).toBe(false);
});
test("cadastra e renomeia cliente, com persistência após recarregar", async ({
  page,
}) => {
  const { state, requests } = await mockWorkspace(page);
  await login(page);
  await nav(page)
    .getByRole("button", { name: "Clientes", exact: true })
    .click();
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Nome do cliente")
    .fill("Café da Praça");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Criar cliente" })
    .click();
  await expect(
    page.getByRole("article", { name: "Cliente Café da Praça" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Editar cliente Café da Praça" })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Nome do cliente")
    .fill("Café Aurora");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar alterações" })
    .click();
  await expect(
    nav(page).getByRole("button", { name: "Café Aurora", exact: true }),
  ).toBeVisible();
  expect(state.clients).toHaveLength(1);
  expect(requests.find((item) => item.method === "POST")?.body).toEqual({
    name: "Café da Praça",
  });
  expect(requests.find((item) => item.method === "POST")?.csrf).toBe(
    "test-csrf-token",
  );
  expect(requests.find((item) => item.method === "POST")?.cookie).toContain(
    "studio_access=",
  );
  await page.reload();
  await nav(page)
    .getByRole("button", { name: "Café Aurora", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Cliente Café Aurora" }),
  ).toBeVisible();
});
test("exclui cliente com confirmação e preserva os outros", async ({
  page,
}) => {
  const { state } = await mockWorkspace(page, [
    client("Excluir"),
    client("Preservar"),
  ]);
  await login(page);
  await nav(page)
    .getByRole("button", { name: "Clientes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Excluir cliente Excluir", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  expect(state.clients).toHaveLength(2);
  await page
    .getByRole("button", { name: "Excluir cliente Excluir", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar exclusão" })
    .click();
  await expect(
    page.getByRole("article", { name: "Cliente Excluir", exact: true }),
  ).toHaveCount(0);
  expect(state.clients.map((item) => item.name)).toEqual(["Preservar"]);
});
test("permite repetir carregamento e salvamento mantendo o texto", async ({
  page,
}) => {
  const { state } = await mockWorkspace(page, [], true);
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Falha ao carregar seu espaço.",
  );
  state.failLoad = false;
  await page.getByRole("button", { name: "Recarregar espaço" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await nav(page)
    .getByRole("button", { name: "Novo cliente", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do cliente").fill("Manter meu texto");
  state.failSave = true;
  await dialog.getByRole("button", { name: "Criar cliente" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Falha ao salvar.");
  await expect(dialog.getByLabel("Nome do cliente")).toHaveValue(
    "Manter meu texto",
  );
  await dialog.getByRole("button", { name: "Criar cliente" }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.clients).toHaveLength(1);
});
test("funciona no mobile sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const parent = client("Nome muito comprido para conferir a quebra de linha");
  await mockWorkspace(page, [parent]);
  await login(page);
  await nav(page).getByRole("button", { name: "Seus clientes", exact: true }).click();
  await nav(page)
    .getByRole("button", { name: parent.name, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Editar cliente " + parent.name })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Nome do cliente"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("apresenta conflito da API sem remover o cliente", async ({ page }) => {
  const { state } = await mockWorkspace(page, [client("Cliente em uso")]);
  await login(page);
  await nav(page)
    .getByRole("button", { name: "Clientes", exact: true })
    .click();
  state.deleteConflict = true;
  await page
    .getByRole("button", { name: "Excluir cliente Cliente em uso" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar exclusão" })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "projetos vinculados",
  );
  expect(state.clients).toHaveLength(1);
});
