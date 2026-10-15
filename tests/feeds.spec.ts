import { test, expect } from "@playwright/test";
import { login, mockAuth } from "./helpers/auth";
import { client, mockWorkspace } from "./helpers/workspace";
import { feed, mockFeeds, png } from "./helpers/feeds";
test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});
test("simulador da conta exige login e não importa os dados antigos do navegador", async ({
  page,
}) => {
  await mockFeeds(page);
  await page.goto("/simulador");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("Account must not use IndexedDB");
      },
    });
  });
  await login(page);
  await page.getByRole("link", { name: "Abrir meus feeds" }).click();
  await expect(
    page.getByRole("heading", { name: "Seu primeiro feed começa aqui." }),
  ).toBeVisible();
  await page
    .getByLabel("Nome do feed", { exact: true })
    .fill("Meu primeiro feed");
  await page.getByRole("button", { name: "Criar feed", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Meu primeiro feed", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".grid-post")).toHaveCount(0);
  await expect(
    page.getByText("Salvo na sua conta", { exact: true }),
  ).toBeVisible();
});
test("persiste perfil e vínculo opcional com cliente através da API", async ({
  page,
}) => {
  const parent = client("Café Aurora");
  await mockWorkspace(page, [parent]);
  const { state, requests } = await mockFeeds(page, [feed("Feed de teste")]);
  await login(page);
  await page.goto("/simulador");
  await page.getByLabel("Nome do perfil", { exact: true }).fill("Minha marca");
  await page.getByLabel("Cliente associado").selectOption(parent.id);
  await expect(
    page.getByText("Salvo na sua conta", { exact: true }),
  ).toBeVisible();
  expect(state.feeds[0].clientId).toBe(parent.id);
  await page.reload();
  await expect(page.getByLabel("Nome do perfil", { exact: true })).toHaveValue(
    "Minha marca",
  );
  await expect(page.getByLabel("Cliente associado")).toHaveValue(parent.id);
  await page.getByLabel("Cliente associado").selectOption("");
  await expect(
    page.getByText("Salvo na sua conta", { exact: true }),
  ).toBeVisible();
  expect(state.feeds[0].clientId).toBeNull();
  for (const request of requests.filter((item) => item.method === "PUT")) {
    expect(request.csrf).toBe("test-csrf-token");
    expect(request.cookie).toContain("studio_access=");
    expect(request.body).not.toHaveProperty("userId");
    expect(request.body).not.toHaveProperty("user_id");
  }
});
test("envia fotos otimizadas, preserva ordem do carrossel e recarrega imagens da conta", async ({
  page,
}) => {
  const { state, requests } = await mockFeeds(page, [feed()]);
  await login(page);
  await page.goto("/simulador");
  await page
    .getByLabel("Selecionar foto do perfil")
    .setInputFiles(await png(page));
  await expect(page.locator(".profile-avatar img")).toHaveAttribute(
    "src",
    new RegExp("^https:"),
  );
  await expect(
    page.getByText("Salvo na sua conta", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nova publicação", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Selecionar imagens da publicação")
    .setInputFiles([await png(page), await png(page, "#667744")]);
  await expect(dialog.locator(".image-thumb")).toHaveCount(2);
  await dialog
    .getByRole("button", { name: "Mover imagem 2 para a esquerda" })
    .click();
  const cover = await dialog
    .locator(".image-thumb img")
    .first()
    .getAttribute("src");
  await dialog.getByLabel(/^Legenda/).fill("Nossa campanha");
  await dialog
    .getByRole("button", { name: "Adicionar ao feed", exact: true })
    .click();
  await expect(
    page.getByText("Salvo na sua conta", { exact: true }),
  ).toBeVisible();
  expect(state.feeds[0].posts[0].mediaIds).toEqual([
    state.feeds[0].media[2].id,
    state.feeds[0].media[1].id,
  ]);
  expect(
    requests
      .filter((item) => item.method === "POST" && item.path.endsWith("/media"))
      .every((item) => item.contentType?.startsWith("multipart/form-data")),
  ).toBe(true);
  expect(
    JSON.stringify(requests.filter((item) => item.method === "PUT")),
  ).not.toContain("data:image/");
  await page.reload();
  await expect(page.locator(".grid-post img")).toHaveAttribute("src", cover!);
  await page
    .getByRole("button", { name: "Abrir publicação 1", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Nossa campanha");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  await expect(page.locator(".phone-frame")).toBeVisible();
  await page.screenshot({
    path: "test-results/feed-account-mobile.png",
    fullPage: true,
  });
});
test("serializa salvamentos e mantém a edição feita enquanto uma chamada está pendente", async ({
  page,
}) => {
  const { state, requests } = await mockFeeds(page, [feed()]);
  await login(page);
  await page.goto("/simulador");
  state.holdSave = true;
  await page
    .getByLabel("Nome do perfil", { exact: true })
    .fill("Primeira edição");
  await expect
    .poll(() => requests.filter((item) => item.method === "PUT").length)
    .toBe(1);
  await page
    .getByLabel("Nome do perfil", { exact: true })
    .fill("Última edição");
  await expect(page.getByLabel("Feed atual")).toBeDisabled();
  expect(requests.filter((item) => item.method === "PUT")).toHaveLength(1);
  state.releaseSave!();
  await expect(
    page.getByText("Salvo na sua conta", { exact: true }),
  ).toBeVisible();
  expect(state.feeds[0].profile.name).toBe("Última edição");
  expect(state.feeds[0].revision).toBe(2);
});
test("falha de upload ou salvamento preserva o rascunho e permite repetir; conflito não sobrescreve", async ({
  page,
}) => {
  const { state } = await mockFeeds(page, [feed()]);
  await login(page);
  await page.goto("/simulador");
  state.failUpload = true;
  await page
    .getByRole("button", { name: "Nova publicação", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Selecionar imagens da publicação")
    .setInputFiles(await png(page));
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Falha ao enviar",
  );
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Adicionar ao feed", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  state.failSave = true;
  await page
    .getByLabel("Nome do perfil", { exact: true })
    .fill("Rascunho preservado");
  await expect(page.getByRole("alert")).toContainText("Falha ao salvar");
  await expect(page.getByLabel("Nome do perfil", { exact: true })).toHaveValue(
    "Rascunho preservado",
  );
  await page
    .getByRole("button", { name: "Tentar salvar", exact: true })
    .click();
  await expect(
    page.getByText("Salvo na sua conta", { exact: true }),
  ).toBeVisible();
  state.conflict = true;
  await page
    .getByLabel("Nome do perfil", { exact: true })
    .fill("Não sobrescrever");
  await expect(page.getByRole("alert")).toContainText("outra aba");
  expect(state.feeds[0].profile.name).toBe("Rascunho preservado");
});
test("cancelar publicação descarta uploads não usados e excluir último feed mostra estado vazio", async ({
  page,
}) => {
  const { state, requests } = await mockFeeds(page, [feed()]);
  await login(page);
  await page.goto("/simulador");
  await page
    .getByRole("button", { name: "Nova publicação", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Selecionar imagens da publicação")
    .setInputFiles(await png(page));
  await expect(page.getByRole("dialog").locator(".image-thumb")).toHaveCount(1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await expect
    .poll(
      () =>
        requests.filter(
          (item) => item.method === "DELETE" && item.path.includes("/media/"),
        ).length,
    )
    .toBe(1);
  expect(state.feeds[0].media).toHaveLength(0);
  await page.getByRole("button", { name: "Excluir feed", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir feed", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seu primeiro feed começa aqui." }),
  ).toBeVisible();
  expect(state.feeds).toHaveLength(0);
});
test("biblioteca lista feeds independentes e os do cliente; cria já associado no contexto do cliente", async ({
  page,
}) => {
  const parent = client("Cliente da marca");
  await mockWorkspace(page, [parent]);
  const { state } = await mockFeeds(page, [
    feed("Independente"),
    feed("Feed do cliente", parent.id),
  ]);
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Feeds", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Independente", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Feed do cliente", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: parent.name, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Feed do cliente", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Independente", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cadastrar cliente", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Nome do novo feed")).toHaveCount(0);
  await expect(
    page.getByText("Associado a um cliente", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Criar feed", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Novo feed", exact: true }),
  ).toBeVisible();
  expect(state.feeds.find((feed) => feed.name === "Novo feed")?.clientId).toBe(
    parent.id,
  );
});

test("mantém seleção do feed ao recarregar e permite concluir uma exclusão pendente", async ({
  page,
}) => {
  const first = feed("Primeiro"),
    second = feed("Segundo"),
    pending = { ...feed("Exclusão pendente"), pendingDeletion: true };
  const { state } = await mockFeeds(page, [first, second, pending]);
  await login(page);
  await page.goto("/simulador?feed=" + first.id);
  await page.getByLabel("Feed atual").selectOption(second.id);
  await expect(
    page.getByRole("heading", { name: "Segundo", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Segundo", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao início" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Feeds", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Concluir exclusão", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Exclusão pendente", exact: true }),
  ).not.toBeVisible();
  expect(state.feeds.map((feed) => feed.id)).toEqual([first.id, second.id]);
});
