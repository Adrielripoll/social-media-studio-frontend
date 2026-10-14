import { test, expect } from "@playwright/test";
import { login, mockAuth } from "./helpers/auth";
import { mockTasks, task } from "./helpers/tasks";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T15:00:00Z"));
  await mockAuth(page);
});
const today = (page: Parameters<typeof login>[0]) =>
  page.getByRole("region", { name: "Suas tarefas de hoje", exact: true });
const calendar = (page: Parameters<typeof login>[0]) =>
  page.getByRole("region", { name: "Calendário", exact: true });
async function openDate(
  page: Parameters<typeof login>[0],
  date = "13 de outubro de 2026",
) {
  await calendar(page).getByRole("button", { name: date, exact: true }).click();
  return calendar(page).getByRole("dialog");
}
async function add(page: Parameters<typeof login>[0], title: string) {
  const menu = calendar(page).getByRole("dialog");
  await menu
    .getByRole("button", { name: "Adicionar tarefa", exact: true })
    .click();
  await menu.getByLabel("Nova tarefa", { exact: true }).fill(title);
  await menu.getByRole("button", { name: "Criar tarefa", exact: true }).click();
  await expect(menu.getByText(title, { exact: true })).toBeVisible();
}

test("a lista principal mostra hoje e as concluídas; data futura abre dentro do calendário", async ({
  page,
}) => {
  await mockTasks(page, [
    task("Preparar briefing"),
    task("Publicação finalizada", "2026-10-13", true),
    task("Conteúdo de amanhã", "2026-10-14"),
  ]);
  await login(page);
  await expect(
    today(page).getByText("Preparar briefing", { exact: true }),
  ).toBeVisible();
  await expect(
    today(page).getByRole("checkbox", {
      name: "Reabrir Publicação finalizada",
    }),
  ).toBeChecked();
  await expect(
    today(page).getByText("Publicação finalizada", { exact: true }),
  ).toHaveCSS("text-decoration-line", "line-through");
  await expect(
    today(page).getByRole("button", { name: "Adicionar tarefa" }),
  ).toBeVisible();
  const menu = await openDate(page, "14 de outubro de 2026");
  await expect(
    menu.getByText("Conteúdo de amanhã", { exact: true }),
  ).toBeVisible();
  await expect(
    today(page).getByText("Conteúdo de amanhã", { exact: true }),
  ).toHaveCount(0);
  await expect(
    today(page).getByText("Preparar briefing", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
});

test("cria tarefas futuras persistentes e uma tarefa de hoje atualiza a lista principal", async ({
  page,
}) => {
  const { state, requests } = await mockTasks(page);
  await login(page);
  await openDate(page, "14 de outubro de 2026");
  await add(page, "Planejar amanhã");
  await expect(
    today(page).getByText("Planejar amanhã", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await openDate(page, "14 de outubro de 2026");
  await expect(
    calendar(page)
      .getByRole("dialog")
      .getByText("Planejar amanhã", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await calendar(page).getByRole("button", { name: "Próximo mês" }).click();
  await today(page).getByRole("button", { name: "Adicionar tarefa" }).click();
  await today(page)
    .getByLabel("Nova tarefa", { exact: true })
    .fill("Revisar hoje");
  await today(page)
    .getByRole("button", { name: "Criar tarefa", exact: true })
    .click();
  await expect(
    today(page).getByText("Revisar hoje", { exact: true }),
  ).toBeVisible();
  expect(state.tasks).toHaveLength(2);
  expect(requests.filter((item) => item.method === "POST")[1]?.body).toEqual({
    title: "Revisar hoje",
    scheduledDate: "2026-10-13",
  });
  const saved = requests.find((item) => item.method === "POST");
  expect(saved?.body).toEqual({
    title: "Planejar amanhã",
    scheduledDate: "2026-10-14",
  });
  expect(saved?.csrf).toBe("test-csrf-token");
  expect(saved?.cookie).toContain("studio_access=");
});

test("conclui e reabre mantendo a tarefa visível nas duas listas", async ({
  page,
}) => {
  await mockTasks(page, [task("Tarefa de hoje")]);
  await login(page);
  await openDate(page);
  await today(page)
    .getByRole("checkbox", { name: "Concluir Tarefa de hoje" })
    .click();
  await expect(
    today(page).getByRole("checkbox", { name: "Reabrir Tarefa de hoje" }),
  ).toBeChecked();
  await openDate(page);
  await expect(
    calendar(page)
      .getByRole("dialog")
      .getByRole("checkbox", { name: "Reabrir Tarefa de hoje" }),
  ).toBeChecked();
  await calendar(page)
    .getByRole("dialog")
    .getByRole("checkbox", { name: "Reabrir Tarefa de hoje" })
    .click();
  await expect(
    today(page).getByRole("checkbox", { name: "Concluir Tarefa de hoje" }),
  ).not.toBeChecked();
});

test("edita apenas o título sem alterar a data da tarefa", async ({ page }) => {
  const { state, requests } = await mockTasks(page, [task("Título anterior")]);
  await login(page);
  await today(page)
    .getByRole("button", { name: "Editar Título anterior" })
    .click();
  await expect(today(page).getByLabel("Data da tarefa")).toHaveCount(0);
  await today(page).getByLabel("Título da tarefa").fill("Título atualizado");
  await today(page).getByRole("button", { name: "Salvar tarefa" }).click();
  await expect(
    today(page).getByText("Título atualizado", { exact: true }),
  ).toBeVisible();
  expect(state.tasks[0].scheduledDate).toBe("2026-10-13");
  expect(requests.find((item) => item.method === "PATCH")?.body).toEqual({
    title: "Título atualizado",
  });
});

test("exclui com confirmação e mantém as outras tarefas", async ({ page }) => {
  const { state } = await mockTasks(page, [
    task("Excluir amanhã", "2026-10-14"),
    task("Preservar hoje"),
  ]);
  await login(page);
  const menu = await openDate(page, "14 de outubro de 2026");
  await menu.getByRole("button", { name: "Excluir Excluir amanhã" }).click();
  await menu.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(menu.getByText("Nenhuma tarefa para este dia.")).toBeVisible();
  await expect(
    today(page).getByText("Preservar hoje", { exact: true }),
  ).toBeVisible();
  expect(state.tasks.map((item) => item.title)).toEqual(["Preservar hoje"]);
});

test("navega entre meses e anos mantendo as tarefas de hoje", async ({
  page,
}) => {
  const { requests } = await mockTasks(page, [
    task("Hoje sempre visível"),
    task("Janeiro", "2027-01-15"),
  ]);
  await login(page);
  for (let index = 0; index < 3; index++)
    await calendar(page).getByRole("button", { name: "Próximo mês" }).click();
  await expect(
    calendar(page).getByRole("heading", { name: "janeiro de 2027" }),
  ).toBeVisible();
  await expect(
    today(page).getByText("Hoje sempre visível", { exact: true }),
  ).toBeVisible();
  const menu = await openDate(page, "15 de janeiro de 2027");
  await expect(menu.getByText("Janeiro", { exact: true })).toBeVisible();
  await menu.getByRole("button", { name: "Fechar tarefas do dia" }).click();
  await calendar(page)
    .getByRole("button", { name: "Hoje", exact: true })
    .click();
  await expect(
    calendar(page).getByRole("heading", { name: "outubro de 2026" }),
  ).toBeVisible();
  expect(requests.some((item) => item.path === "/tasks/today")).toBe(true);
});

test("datas passadas permitem consultar tarefas e bloqueiam novas criações", async ({
  page,
}) => {
  await mockTasks(page, [task("Tarefa antiga", "2026-10-12")]);
  await login(page);
  const menu = await openDate(page, "12 de outubro de 2026");
  await expect(menu.getByText("Tarefa antiga", { exact: true })).toBeVisible();
  await expect(
    menu.getByRole("button", { name: "Adicionar tarefa", exact: true }),
  ).toBeDisabled();
  await expect(
    menu.getByText(
      "Novas tarefas podem ser criadas para hoje ou dias futuros.",
    ),
  ).toBeVisible();
});

test("falhas permitem recarregar e preservam o texto antes de tentar salvar novamente", async ({
  page,
}) => {
  const { state } = await mockTasks(page, [], true);
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Falha temporária ao carregar tarefas.",
  );
  state.failLoad = false;
  await page.getByRole("button", { name: "Recarregar tarefas" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const menu = await openDate(page);
  await menu
    .getByRole("button", { name: "Adicionar tarefa", exact: true })
    .click();
  await menu.getByLabel("Nova tarefa").fill("Preservar meu texto");
  state.failMutation = true;
  await menu.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Falha temporária ao salvar tarefa.",
  );
  await expect(menu.getByLabel("Nova tarefa")).toHaveValue(
    "Preservar meu texto",
  );
  await menu.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(
    today(page).getByText("Preservar meu texto", { exact: true }),
  ).toBeVisible();
  expect(state.tasks).toHaveLength(1);
});

test("calendário e menu funcionam no mobile sem rolagem horizontal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockTasks(page);
  await login(page);
  await openDate(page, "14 de outubro de 2026");
  await add(page, "Tarefa mobile");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await expect(
    calendar(page)
      .getByRole("dialog")
      .getByText("Tarefa mobile", { exact: true }),
  ).toBeVisible();
});

test("herda pendências de meses anteriores e exibe a data de criação no fuso de São Paulo", async ({
  page,
}) => {
  const previous = task("Pendência antiga", "2026-09-12");
  previous.createdAt = "2026-09-12T02:30:00.000Z";
  const finished = task("Concluída anteriormente", "2026-09-12", true);
  finished.completedAt = "2026-09-13T15:00:00.000Z";
  await mockTasks(page, [
    previous,
    finished,
    task("De hoje"),
    task("Futura", "2026-10-14"),
  ]);
  await login(page);
  await expect(today(page).getByText("Pendência antiga")).toBeVisible();
  await expect(
    today(page).getByText("(Adicionado em: 11/09/2026)", { exact: true }),
  ).toBeVisible();
  await expect(today(page).getByText("Concluída anteriormente")).toHaveCount(0);
  await expect(today(page).getByText("Futura", { exact: true })).toHaveCount(0);
  await calendar(page).getByRole("button", { name: "Próximo mês" }).click();
  await expect(today(page).getByText("Pendência antiga")).toBeVisible();
});

test("mantém herdada concluída em hoje, atualiza o calendário original e deixa de herdá-la no próximo dia", async ({
  page,
}) => {
  const previous = task("Pendência herdada", "2026-10-12");
  previous.createdAt = "2026-10-12T12:00:00.000Z";
  const { state } = await mockTasks(page, [previous]);
  await login(page);
  await today(page)
    .getByRole("checkbox", { name: "Concluir Pendência herdada" })
    .click();
  await expect(
    today(page).getByRole("checkbox", { name: "Reabrir Pendência herdada" }),
  ).toBeChecked();
  await expect(
    today(page).getByText("(Adicionado em: 12/10/2026)", { exact: true }),
  ).toBeVisible();
  const menu = await openDate(page, "12 de outubro de 2026");
  await expect(
    menu.getByRole("checkbox", { name: "Reabrir Pendência herdada" }),
  ).toBeChecked();
  expect(state.tasks[0].scheduledDate).toBe("2026-10-12");
  expect(state.tasks).toHaveLength(1);
  await page.reload();
  await expect(
    today(page).getByRole("checkbox", { name: "Reabrir Pendência herdada" }),
  ).toBeChecked();
  await today(page)
    .getByRole("checkbox", { name: "Reabrir Pendência herdada" })
    .click();
  await expect(
    today(page).getByRole("checkbox", { name: "Concluir Pendência herdada" }),
  ).not.toBeChecked();
  await today(page)
    .getByRole("checkbox", { name: "Concluir Pendência herdada" })
    .click();
  await expect(
    today(page).getByRole("checkbox", { name: "Reabrir Pendência herdada" }),
  ).toBeChecked();
  state.today = "2026-10-14";
  await page.clock.setFixedTime(new Date("2026-10-14T15:00:00Z"));
  await page.reload();
  await expect(
    today(page).getByText(
      "Seu dia está livre. Adicione uma tarefa para começar.",
    ),
  ).toBeVisible();
  await expect(today(page).getByText("Pendência herdada")).toHaveCount(0);
});
