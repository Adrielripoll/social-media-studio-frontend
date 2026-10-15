import { test, expect } from "@playwright/test";
import { login, mockAuth } from "./helpers/auth";
import { client, mockWorkspace } from "./helpers/workspace";
import {
  dashboard,
  importedPeriods,
  mockDashboards,
} from "./helpers/dashboards";
test.beforeEach(async ({ page }) => {
  await mockAuth(page);
});
const csv = {
  name: "resultados.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(
    "inicio_periodo;fim_periodo;alcance\n2026-08-01;2026-08-31;12000",
  ),
};
test("cria dashboard independente, associa cliente, salva análise e persiste ao recarregar", async ({
  page,
}) => {
  const parent = client("Café Aurora");
  await mockWorkspace(page, [parent]);
  const { state, captured } = await mockDashboards(page);
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Dashboards", exact: true })
    .click();
  await expect(page.getByText("Seus resultados começam aqui.")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/dashboard-experience/);
  await page.screenshot({
    path: "test-results/dashboard-library-new.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Criar dashboard", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Nome do dashboard", { exact: true })
    .fill("Resultados do cliente");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Criar dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Resultados do cliente", exact: true }),
  ).toBeVisible();
  expect(state.items[0].clientId).toBeNull();
  await page
    .getByText("Editar informações do dashboard", { exact: true })
    .click();
  await page
    .getByLabel("Cliente associado", { exact: true })
    .selectOption(parent.id);
  await page
    .getByLabel("Análise do profissional", { exact: true })
    .fill("Mais conversas e visitas ao perfil.");
  await page.getByRole("button", { name: "Salvar informações" }).click();
  await expect(
    page.getByText("Informações salvas.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByText("Editar informações do dashboard", { exact: true })
    .click();
  await expect(
    page.getByLabel("Cliente associado", { exact: true }),
  ).toHaveValue(parent.id);
  await expect(
    page.getByLabel("Análise do profissional", { exact: true }),
  ).toHaveValue("Mais conversas e visitas ao perfil.");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Início", exact: true })
    .click();
  await expect(page.locator("body")).not.toHaveClass(/dashboard-experience/);
  for (const item of captured.filter(
    (item) => ["POST", "PATCH", "PUT"].includes(item.method) && !item.multipart,
  )) {
    expect(item.body).not.toHaveProperty("userId");
    expect(item.csrf).toBe("test-csrf-token");
    expect(item.cookie).toContain("studio_access=");
  }
});
test("importação mostra modelo e prévia, grava só após confirmação e exibe comparações", async ({
  page,
}) => {
  const value = dashboard();
  const { state, captured } = await mockDashboards(page, [value]);
  await login(page);
  await page.goto("/?view=dashboards&dashboard=" + value.id);
  await page
    .getByRole("button", { name: "Importar dados", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("inicio_periodo", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Selecionar planilha de resultados")
    .setInputFiles(csv);
  await expect(
    dialog.getByRole("heading", { name: "Prévia dos resultados" }),
  ).toBeVisible();
  expect(state.items[0].periods).toEqual([]);
  await dialog
    .getByRole("button", { name: "Confirmar importação", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("article", { name: "Alcance", exact: true }),
  ).toContainText("15.000");
  await expect(
    page.getByRole("article", { name: "Alcance", exact: true }),
  ).toContainText("+25%");
  await expect(
    page.getByRole("article", { name: "Cliques no link", exact: true }),
  ).toContainText("Sem base de comparação");
  expect(state.items[0].periods).toHaveLength(2);
  expect(
    captured.some((item) => item.multipart?.includes("resultados.csv")),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Alcance", exact: true }),
  ).toContainText("15.000");
  await page
    .getByRole("button", { name: "Importar dados", exact: true })
    .click();
  await page.getByLabel("Selecionar planilha de resultados").setInputFiles(csv);
  await expect(page.getByRole("dialog")).toContainText(
    "períodos atuais serão substituídos",
  );
  await page
    .getByRole("button", { name: "Confirmar e substituir períodos" })
    .click();
  expect(state.items[0].periods).toHaveLength(2);
});
test("erros de linha bloqueiam confirmação; permite escolher uma aba XLSX diferente", async ({
  page,
}) => {
  const value = dashboard();
  const { state } = await mockDashboards(page, [value]);
  state.multipleSheets = true;
  await login(page);
  await page.goto("/?view=dashboards&dashboard=" + value.id);
  await page
    .getByRole("button", { name: "Importar dados", exact: true })
    .click();
  await page.getByLabel("Selecionar planilha de resultados").setInputFiles({
    ...csv,
    name: "resultados.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Linha 2",
  );
  await expect(
    page.getByRole("button", { name: "Confirmar importação" }),
  ).toBeDisabled();
  await page
    .getByLabel("Aba da planilha", { exact: true })
    .selectOption("Resultados");
  await expect(
    page.getByRole("button", { name: "Confirmar importação" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(state.items[0].periods).toEqual([]);
});
test("mantém rascunho após falha e conflito sem sobrescrever o dashboard", async ({
  page,
}) => {
  const value = dashboard();
  const { state } = await mockDashboards(page, [value]);
  await login(page);
  await page.goto("/?view=dashboards&dashboard=" + value.id);
  await page
    .getByText("Editar informações do dashboard", { exact: true })
    .click();
  await page
    .getByLabel("Nome do dashboard", { exact: true })
    .fill("Meu rascunho");
  state.failSave = true;
  await page.getByRole("button", { name: "Salvar informações" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível salvar",
  );
  await expect(
    page.getByLabel("Nome do dashboard", { exact: true }),
  ).toHaveValue("Meu rascunho");
  expect(state.items[0].name).toBe("Resultados");
  state.failSave = false;
  state.conflict = true;
  await page.getByRole("button", { name: "Salvar informações" }).click();
  await expect(page.getByRole("alert")).toContainText("outra aba");
  state.conflict = false;
  await page.getByRole("button", { name: "Salvar informações" }).click();
  await expect(
    page.getByRole("heading", { name: "Meu rascunho", exact: true }),
  ).toBeVisible();
});
test("mostra ausência como traço, zero como zero e taxa indisponível se faltam componentes", async ({
  page,
}) => {
  const value = dashboard();
  value.periods = importedPeriods();
  value.periods[1].likes = null;
  value.periods[1].reach = 0;
  await mockDashboards(page, [value]);
  await login(page);
  await page.goto("/?view=dashboards&dashboard=" + value.id);
  await expect(
    page
      .getByRole("article", { name: "Alcance", exact: true })
      .locator("strong"),
  ).toHaveText("0");
  await expect(
    page
      .getByRole("article", { name: "Interações", exact: true })
      .locator("strong"),
  ).toHaveText("—");
  await expect(
    page.getByText("Taxa de engajamento por alcance:", { exact: false }),
  ).toContainText("—");
});
test("resultados se adaptam de 320 a 1440 px; apresentação oculta edição e sai com Escape", async ({
  page,
}) => {
  const value = dashboard();
  value.periods = importedPeriods();
  value.notes = "Análise para o cliente.";
  await mockDashboards(page, [value]);
  await login(page);
  await page.goto("/?view=dashboards&dashboard=" + value.id);
  await expect(
    page
      .getByRole("region", { name: "Gráficos dos resultados", exact: true })
      .getByRole("figure"),
  ).toHaveCount(7);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: "test-results/dashboard-" + width + ".png",
        fullPage: true,
      });
    await expect(
      page.getByRole("article", { name: "Alcance", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Apresentar", exact: true }).click();
  await expect(page.getByRole("navigation")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Importar dados", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("region", { name: "Análise do profissional", exact: true }),
  ).toContainText("Análise para o cliente.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apresentar", exact: true }),
  ).toBeFocused();
});
test("dashboard aparece no cliente, nasce associado e pode ser excluído com confirmação", async ({
  page,
}) => {
  const parent = client("Meu cliente");
  await mockWorkspace(page, [parent]);
  const { state } = await mockDashboards(page, [
    dashboard("Independente"),
    dashboard("Resultados do cliente", parent.id),
  ]);
  await login(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: parent.name, exact: true })
    .click();
  const library = page.getByRole("region", {
    name: "Dashboards deste cliente",
    exact: true,
  });
  await expect(library).toContainText("Resultados do cliente");
  await expect(library).not.toContainText("Independente");
  await library
    .getByRole("button", { name: "Criar dashboard", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Nome do dashboard", { exact: true })
    .fill("Novo relatório");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Criar dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Novo relatório", exact: true }),
  ).toBeVisible();
  expect(state.items.at(-1)?.clientId).toBe(parent.id);
  await page
    .getByText("Editar informações do dashboard", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Excluir dashboard", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar exclusão" })
    .click();
  await expect(
    page.getByRole("heading", { name: parent.name, exact: true }),
  ).toBeVisible();
  expect(state.items).toHaveLength(2);
});

test("importação mobile permite recuperar falha de leitura sem gravar antes de confirmar", async ({
  page,
}) => {
  const value = dashboard();
  const { state } = await mockDashboards(page, [value]);
  state.failPreview = true;
  await login(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/?view=dashboards&dashboard=" + value.id);
  await page
    .getByRole("button", { name: "Importar dados", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Selecionar planilha de resultados")
    .setInputFiles(csv);
  await expect(dialog.getByRole("alert")).toContainText("Falha ao ler");
  state.failPreview = false;
  await dialog
    .getByLabel("Selecionar planilha de resultados")
    .setInputFiles(csv);
  await expect(
    dialog.getByRole("button", { name: "Confirmar importação" }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-import-320.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(state.items[0].periods).toEqual([]);
});

test("gráficos exploram histórico, composição e comparação sem erros de renderização", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const value = dashboard();
  value.periods = importedPeriods().reverse();
  await mockDashboards(page, [value]);
  await login(page);
  await page.goto("/?view=dashboards&dashboard=" + value.id);
  const report = page.getByRole("region", {
    name: "Gráficos dos resultados",
    exact: true,
  });
  await expect(report.getByRole("figure")).toHaveCount(7);
  await expect(report.locator("canvas")).toHaveCount(7);
  const evolution = report.getByRole("figure", {
    name: "Evolução dos resultados",
    exact: true,
  });
  await evolution
    .getByRole("button", { name: "Visualizações", exact: true })
    .click();
  await expect(
    evolution.getByRole("button", { name: "Visualizações", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    evolution.locator(".dashboard-chart-highlight strong"),
  ).toHaveText("22.000");
  await evolution
    .locator("summary")
    .filter({ hasText: "Ver dados do gráfico" })
    .click();
  const data = evolution.getByRole("region", {
    name: "Dados: Evolução dos resultados",
    exact: true,
  });
  await expect(
    data.getByRole("columnheader", { name: "Visualizações", exact: true }),
  ).toBeVisible();
  await expect(data.locator("tbody tr").first()).toContainText(
    "01/08/2026 a 31/08/2026",
  );
  await evolution
    .getByRole("button", { name: "Interações", exact: true })
    .click();
  await expect(
    evolution.locator(".dashboard-chart-highlight strong"),
  ).toHaveText("615");
  await expect(
    data.getByRole("columnheader", { name: "Interações", exact: true }),
  ).toBeVisible();
  const composition = report.getByRole("figure", {
    name: "Distribuição das interações",
    exact: true,
  });
  await expect(
    composition.locator(".dashboard-donut-center strong"),
  ).toHaveText("615");
  await page
    .getByLabel("Período do relatório", { exact: true })
    .selectOption("2026-08-01/2026-08-31");
  await expect(
    composition.locator(".dashboard-donut-center strong"),
  ).toHaveText("450");
  await expect(
    evolution.locator(".dashboard-chart-highlight strong"),
  ).toHaveText("450");
  await expect(data.locator("tbody tr")).toHaveCount(2);
  await expect(
    report.getByRole("figure", { name: "Ações no perfil", exact: true }),
  ).toContainText("Selecione um período de comparação");
  expect(errors).toEqual([]);
});

test("gráficos distinguem lacunas, composição incompleta, zero e período único", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const value = dashboard();
  value.periods = [importedPeriods()[1]];
  value.periods[0].likes = null;
  await mockDashboards(page, [value]);
  await login(page);
  await page.goto("/?view=dashboards&dashboard=" + value.id);
  let composition = page.getByRole("figure", {
    name: "Distribuição das interações",
    exact: true,
  });
  await expect(composition).toContainText("Composição indisponível");
  await expect(composition.locator("canvas")).toHaveCount(0);
  const evolution = page.getByRole("figure", {
    name: "Evolução dos resultados",
    exact: true,
  });
  await expect(evolution).toContainText("Importe outro período");
  const engagement = page.getByRole("figure", {
    name: "Taxa de engajamento",
    exact: true,
  });
  await expect(
    engagement.locator(".dashboard-chart-highlight strong"),
  ).toHaveText("—");
  await composition
    .locator("summary")
    .filter({ hasText: "Ver dados do gráfico" })
    .click();
  await expect(composition.locator("tbody tr").first()).toContainText("—");
  for (const key of ["likes", "comments", "shares", "saves"] as const)
    value.periods[0][key] = 0;
  await mockDashboards(page, [value]);
  await page.reload();
  composition = page.getByRole("figure", {
    name: "Distribuição das interações",
    exact: true,
  });
  await expect(composition).toContainText("Nenhuma interação registrada");
  await expect(
    composition.locator(".dashboard-donut-center strong"),
  ).toHaveText("0");
  await expect(
    page
      .getByRole("figure", { name: "Taxa de engajamento", exact: true })
      .locator(".dashboard-chart-highlight strong"),
  ).toHaveText("0%");
  expect(errors).toEqual([]);
});
