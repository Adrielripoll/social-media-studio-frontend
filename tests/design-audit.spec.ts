import { test, expect } from "@playwright/test";
import { apiUrl, login, mockAuth } from "./helpers/auth";
import { client, mockWorkspace } from "./helpers/workspace";
import { feed, mockFeeds } from "./helpers/feeds";
import { mockTasks } from "./helpers/tasks";
import { randomUUID } from "node:crypto";

test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});

test("falha ao consultar tarefas não informa dia livre e bloqueia criação até recarregar", async ({
  page,
}) => {
  const { state } = await mockTasks(page, [], true);
  await login(page);
  const today = page.getByRole("region", {
    name: "Suas tarefas de hoje",
    exact: true,
  });
  await expect(page.getByRole("alert")).toContainText("Falha temporária");
  await expect(today).not.toContainText("Seu dia está livre");
  await expect(
    today.getByRole("button", { name: "Adicionar tarefa", exact: true }),
  ).toBeDisabled();
  state.failLoad = false;
  await page.getByRole("button", { name: "Recarregar tarefas" }).click();
  await expect(today).toContainText("Seu dia está livre");
  await expect(
    today.getByRole("button", { name: "Adicionar tarefa", exact: true }),
  ).toBeEnabled();
});

test("erro de celular está associado ao campo e recebe foco", async ({
  page,
}) => {
  await page.goto("/cadastro");
  await page.getByLabel("Seu nome", { exact: true }).fill("Marina Teste");
  await page.getByLabel("Email", { exact: true }).fill("teste@example.com");
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura");
  const phone = page.getByLabel("Celular (com DDD)", { exact: true });
  await phone.fill("(11) 3333-4444");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(phone).toBeFocused();
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await expect(phone).toHaveAccessibleDescription(/celular brasileiro/);
  await phone.fill("(11) 99999-9999");
  await expect(phone).not.toHaveAttribute("aria-invalid", "true");
});

test("mobile recolhe clientes, preserva contexto e acompanha o histórico do navegador", async ({
  page,
}) => {
  const customer = client("Café Aurora");
  await mockWorkspace(page, [customer]);
  await mockFeeds(page, [feed("Campanha", customer.id)]);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const nav = page.getByRole("navigation", {
    name: "Navegação do espaço de trabalho",
  });
  const customerButton = nav.getByRole("button", {
    name: customer.name,
    exact: true,
  });
  await expect(customerButton).not.toBeVisible();
  const height = await page
    .locator(".workspace-sidebar")
    .evaluate((e) => e.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(160);
  await nav.getByRole("button", { name: "Seus clientes", exact: true }).click();
  await customerButton.click();
  await expect(page).toHaveURL(new RegExp("client=" + customer.id));
  await expect(
    page.getByRole("heading", { name: customer.name, exact: true }),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "Abrir feed", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Campanha", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Voltar ao espaço de trabalho" })
    .click();
  await expect(
    page.getByRole("heading", { name: customer.name, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: customer.name, exact: true }),
  ).toBeVisible();
  await nav.getByRole("button", { name: "Início", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: customer.name, exact: true }),
  ).toBeVisible();
});

test("abas do editor respondem a setas, Home e End", async ({ page }) => {
  await mockFeeds(page, [feed("Campanha")]);
  await login(page);
  await page.goto("/simulador");
  const profile = page.getByRole("tab", { name: "Perfil", exact: true });
  const content = page.getByRole("tab", { name: /Conteúdo/ });
  await profile.focus();
  await page.keyboard.press("ArrowRight");
  await expect(content).toBeFocused();
  await expect(content).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(profile).toBeFocused();
  await page.keyboard.press("End");
  await expect(content).toBeFocused();
});

test("editor é utilizável de 320 a 1440 px, com status visível e botões acessíveis", async ({
  page,
}) => {
  await mockFeeds(page, [
    feed("Uma campanha com um nome longo para testar o cabeçalho"),
  ]);
  await login(page);
  await page.goto("/simulador");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByText("Salvo na sua conta", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    const create = page.getByRole("button", {
      name: "Criar feed",
      exact: true,
    });
    const rect = await create.boundingBox();
    expect(rect!.width).toBeGreaterThanOrEqual(44);
    expect(rect!.height).toBeGreaterThanOrEqual(44);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
    if (width <= 740) {
      await page
        .getByRole("button", { name: "Ver prévia", exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "Prévia do Instagram" }),
      ).toBeVisible();
      await expect(page.locator(".editor-panel")).not.toBeVisible();
      await page
        .getByRole("button", { name: "Editar feed", exact: true })
        .click();
      await expect(page.locator(".editor-panel")).toBeVisible();
    }
  }
  const contrast = await page
    .getByRole("button", { name: "Nova publicação", exact: true })
    .evaluate((e) => {
      function luminance(color: string) {
        const rgb = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => v / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
        return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
      }
      const s = getComputedStyle(e),
        a = luminance(s.color),
        b = luminance(s.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test("prévia reserva espaço durante carregamento e oferece fallback para imagem indisponível", async ({
  page,
}) => {
  const customer = client("Café Aurora"),
    campaign = feed("Campanha", customer.id);
  const mediaId = randomUUID();
  campaign.media = [
    { id: mediaId, url: "https://assets.test/unavailable.png" },
  ];
  campaign.posts = [
    {
      id: randomUUID(),
      caption: "Publicação de teste",
      location: "",
      likes: 0,
      mediaIds: [mediaId],
    },
  ];
  await mockWorkspace(page, [customer]);
  await mockFeeds(page, [campaign]);
  await page.route("https://assets.test/unavailable.png", (route) =>
    route.fulfill({ status: 404 }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(apiUrl + "/feeds/" + campaign.id, async (route) => {
    await gate;
    await route.fallback();
  });
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: customer.name, exact: true })
    .click();
  const preview = page.getByRole("region", {
    name: "Prévia do feed Campanha",
    exact: true,
  });
  await expect(preview.getByRole("status")).toBeVisible();
  const before = await preview.boundingBox();
  release();
  await expect(preview.getByRole("status")).toHaveCount(0);
  await expect(
    preview.getByRole("img", { name: /imagem indisponível/ }),
  ).toBeVisible();
  const after = await preview.boundingBox();
  expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(1);
});

test("excluir cliente selecionado volta à lista de clientes", async ({
  page,
}) => {
  const customer = client("Excluir");
  const { state } = await mockWorkspace(page, [customer]);
  await mockFeeds(page);
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: customer.name, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Excluir cliente Excluir", exact: true })
    .click();
  const confirm = page.getByRole("button", {
    name: "Confirmar exclusão",
    exact: true,
  });
  await expect(confirm).toHaveClass(/danger-button/);
  await confirm.click();
  await expect(page).toHaveURL(/view=clients/);
  await expect(
    page.getByRole("heading", { name: "Clientes", exact: true }),
  ).toBeVisible();
  expect(state.clients).toHaveLength(0);
});
