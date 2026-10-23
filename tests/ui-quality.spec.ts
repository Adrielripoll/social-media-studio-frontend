import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { apiUrl, corsHeaders, login, mockAuth } from "./helpers/auth";
import { feed, mockFeeds, png } from "./helpers/feeds";
import { mockTasks, task } from "./helpers/tasks";
import { mockWorkspace } from "./helpers/workspace";
import { dashboard, mockDashboards } from "./helpers/dashboards";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:3003"
      ? route.continue()
      : route.abort(),
  );
  await mockAuth(page);
  await mockWorkspace(page);
});
async function capture(page: Page, info: TestInfo, name: string) {
  for (const field of await page.locator('input[type="password"]').all())
    expect(await field.inputValue()).toBe("");
  const path = info.outputPath("evidencias", "screenshots", name + ".png");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await page.screenshot({
    path,
    fullPage: (await page.locator("dialog[open]").count()) === 0,
  });
  await info.attach(name, { path, contentType: "image/png" });
}
async function openComposer(page: Page) {
  await mockFeeds(page, [feed("Feed de teste")]);
  await login(page);
  await page.goto("/simulador");
  await page
    .getByRole("button", { name: "Nova publicação", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Nova publicação", exact: true });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  for (const dialog of await page.locator("dialog[open]").all())
    expect(
      await dialog.evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
}
test("protege rascunho no Escape, backdrop e atualização", async ({
  page,
}, info) => {
  const dialog = await openComposer(page);
  await dialog.getByLabel("Legenda").fill("Campanha de novembro");
  await page.keyboard.press("Escape");
  const confirm = page.getByRole("dialog", {
    name: "Descartar alterações?",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  await expect(
    confirm.getByRole("button", { name: "Continuar editando" }),
  ).toBeFocused();
  await capture(page, info, "confirmacao-descarte-desktop");
  await confirm.getByRole("button", { name: "Continuar editando" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(dialog.getByLabel("Legenda")).toHaveValue(
    "Campanha de novembro",
  );
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.mouse.click(5, 5);
  await expect(confirm).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  let warned = false;
  page.once("dialog", async (prompt) => {
    warned = prompt.type() === "beforeunload";
    await prompt.dismiss();
  });
  await page.reload({ timeout: 3000 }).catch(() => undefined);
  expect(warned).toBe(true);
  await expect(dialog.getByLabel("Legenda")).toHaveValue(
    "Campanha de novembro",
  );
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await confirm
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("descarte remove somente mídia nova e não salva publicação", async ({
  page,
}) => {
  const { requests } = await mockFeeds(page, [feed()]);
  await login(page);
  await page.goto("/simulador");
  await page
    .getByRole("button", { name: "Nova publicação", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Nova publicação",
    exact: true,
  });
  await dialog
    .getByLabel("Selecionar arquivos da publicação")
    .setInputFiles(await png(page));
  await expect(dialog.locator(".image-thumb")).toHaveCount(1);
  const saves = requests.filter((r) => r.method === "PUT").length;
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Descartar alterações", exact: true })
    .click();
  await expect
    .poll(() => requests.filter((r) => r.method === "DELETE").length)
    .toBe(1);
  expect(requests.filter((r) => r.method === "PUT").length).toBe(saves);
});
test("erro 413 explica limite sem expor assinatura", async ({ page }, info) => {
  const dialog = await openComposer(page);
  await page.route(apiUrl + "/feeds/*/videos", (route) =>
    route.request().method() === "OPTIONS"
      ? route.fulfill({ status: 204, headers: corsHeaders })
      : route.fulfill({
          json: {
            id: "video-test",
            endpoint: "https://uploads.test/resumable",
            token: "test-only-signature",
            bucket: "temporary",
            path: "fixture.mp4",
          },
          headers: corsHeaders,
        }),
  );
  await page.route("https://uploads.test/**", (route) =>
    route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 413,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
    }),
  );
  await dialog.getByLabel("Selecionar arquivos da publicação").setInputFiles({
    name: "teste.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.alloc(1000),
  });
  await expect(dialog.getByRole("alert")).toContainText(
    "Reduza o arquivo antes de enviar novamente",
  );
  await expect(dialog.getByRole("alert")).not.toContainText(
    "test-only-signature",
  );
  await capture(page, info, "video-limite-desktop");
});
test("armazenamento distingue limpeza de arquivo de exclusão do feed", async ({
  page,
}, info) => {
  await page.route(apiUrl + "/account/storage", (route) =>
    route.fulfill({
      headers: corsHeaders,
      json: {
        resources: [
          {
            resourceType: "feed",
            resourceId: "active-feed",
            name: "Feed ativo",
            fileCount: 3,
            usedBytes: 2000,
            reservedBytes: 0,
            pendingDeletionBytes: 500,
            pendingDeletion: false,
          },
          {
            resourceType: "feed",
            resourceId: "deleted-feed",
            name: "Feed excluído",
            fileCount: 1,
            usedBytes: 500,
            reservedBytes: 0,
            pendingDeletionBytes: 500,
            pendingDeletion: true,
          },
        ],
      },
    }),
  );
  await login(page);
  await page.goto("/minha-conta?secao=armazenamento");
  await expect(
    page.getByRole("button", { name: "Excluir feed Feed ativo", exact: true }),
  ).toBeVisible();
  const pending = page
    .locator(".account-resources li")
    .filter({ hasText: "Feed excluído" });
  await expect(pending.getByRole("status")).toContainText("automaticamente");
  await expect(pending.getByRole("button")).toHaveCount(0);
  await expect(pending.getByRole("link")).toHaveCount(0);
  await expect(
    page.getByText("Concluir exclusão", { exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await capture(page, info, "armazenamento-mobile");
});
test("erro de retenção permite consultar novamente", async ({ page }, info) => {
  let failed = true;
  await page.route(apiUrl + "/account/privacy", (route) =>
    route.fulfill({
      status: failed ? 503 : 200,
      headers: corsHeaders,
      json: failed
        ? { message: "Falha temporária" }
        : { workRetention: { status: "protected", months: 12, purgeAt: null } },
    }),
  );
  await login(page);
  await page.goto("/minha-conta?secao=perfil");
  await expect(page.getByRole("alert")).toContainText("prazos de retenção");
  await capture(page, info, "retencao-erro-desktop");
  failed = false;
  await page
    .getByRole("button", { name: "Consultar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Consultar novamente", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Consultando os prazos dos seus dados…", { exact: true }),
  ).toHaveCount(0);
});
test("tarefas mostram seis itens antes da expansão", async ({ page }, info) => {
  await page.clock.setFixedTime(new Date("2026-10-13T15:00:00Z"));
  await mockTasks(
    page,
    Array.from({ length: 7 }, (_, i) => task("Tarefa " + (i + 1))),
  );
  await login(page);
  const today = page.getByRole("region", {
    name: "Suas tarefas de hoje",
    exact: true,
  });
  await expect(today.locator(".task-list > li")).toHaveCount(6);
  await today
    .getByRole("button", { name: "Mostrar mais", exact: true })
    .click();
  await expect(today.locator(".task-list > li")).toHaveCount(7);
  await today
    .getByRole("button", { name: "Mostrar menos", exact: true })
    .click();
  await expect(today.locator(".task-list > li")).toHaveCount(6);
  await page.setViewportSize({ width: 768, height: 1024 });
  await noOverflow(page);
  await capture(page, info, "tarefas-tablet");
});
test("layouts adaptam em quatro tamanhos e com movimento reduzido", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Entrar no Serga Studio", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await capture(page, info, "login-mobile");
  const current = feed("Campanha de verão");
  await mockFeeds(page, [current]);
  const report = dashboard("Resultados de outubro");
  await mockDashboards(page, [report]);
  await login(page);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/?view=feeds");
    await expect(
      page.getByRole("heading", { name: "Seus feeds", exact: true }),
    ).toBeVisible();
    await noOverflow(page);
  }
  await page.goto("/simulador?feed=" + current.id);
  await page
    .getByRole("button", { name: "Nova publicação", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = page.getByRole("dialog", {
    name: "Nova publicação",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await noOverflow(page);
  await capture(page, info, "publicacao-mobile");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.goto("/?view=dashboards&dashboard=" + report.id);
  await expect(
    page.getByRole("heading", { name: "Resultados de outubro", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await capture(page, info, "dashboard-mobile");
  await page.goto("/minha-conta?secao=perfil");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("vídeo distingue fila, compressão, preparação e falha", async ({
  page,
}, info) => {
  const current = feed("Feed com vídeo");
  current.posts = [
    {
      id: "post-video",
      caption: "Vídeo de teste",
      location: "",
      likes: 0,
      mediaIds: ["video-1"],
    },
  ];
  current.media = [
    {
      id: "video-1",
      url: "",
      purpose: "post",
      mediaType: "video",
      status: "queued",
    },
  ];
  const { state } = await mockFeeds(page, [current]);
  await login(page);
  for (const [status, text] of [
    ["queued", "Vídeo na fila de processamento"],
    ["processing", "Comprimindo vídeo…"],
    ["processed", "Salvando vídeo no feed…"],
    ["failed", "Falha no processamento. Remova e envie novamente."],
  ] as const) {
    state.feeds[0].media[0].status = status;
    await page.goto("/simulador?feed=" + current.id);
    await page
      .getByRole("button", { name: "Abrir publicação 1", exact: true })
      .click();
    const viewer = page.getByRole("dialog");
    await expect(viewer.getByText(text, { exact: true })).toBeVisible();
    if (status === "processing")
      await capture(page, info, "video-processamento-desktop");
  }
});
test("foco de teclado destaca o campo sem recriar borda de seleção", async ({
  page,
}, info) => {
  await page.goto("/login");
  const email = page.getByLabel("Email", { exact: true });
  await email.focus();
  await page.keyboard.press("Tab");
  const password = page.getByLabel("Senha", { exact: true });
  await password.focus();
  const result = await password.evaluate((field) => {
    const style = getComputedStyle(field);
    const label = field.closest("label")?.querySelector("span");
    return {
      focusVisible: field.matches(":focus-visible"),
      background: style.backgroundColor,
      outline: style.outlineStyle,
      labelDecoration: label && getComputedStyle(label).textDecorationLine,
      expected: getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-soft")
        .trim(),
    };
  });
  expect(result.focusVisible).toBe(true);
  expect(result.outline).toBe("none");
  expect(result.labelDecoration).toContain("underline");
  expect(result.background).not.toBe("rgba(0, 0, 0, 0)");
  await capture(page, info, "login-foco-teclado-desktop");
});

test("lote misto mostra a posição de cada vídeo e reinicia o contador na seleção seguinte", async ({
  page,
}, info) => {
  const dialog = await openComposer(page);
  const authorizations: import("@playwright/test").Route[] = [];
  const requestHeaders = {
    ...corsHeaders,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "Location,Upload-Offset,Tus-Resumable",
  };
  await page.route(apiUrl + "/feeds/*/videos", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
    } else {
      authorizations.push(route);
    }
  });
  await page.route(apiUrl + "/feeds/*/videos/*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await route.fulfill({
      headers: corsHeaders,
      json: {
        id: new URL(route.request().url()).pathname.split("/")[4],
        url: "",
        mediaType: "video",
        status: "queued",
      },
    });
  });
  await page.route(apiUrl + "/feeds/*/videos/*/complete", async (route) => {
    await route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 202,
      headers: corsHeaders,
      json: {
        id: new URL(route.request().url()).pathname.split("/")[4],
        url: "",
        mediaType: "video",
        status: "queued",
      },
    });
  });
  await page.route("https://uploads.test/**", async (route) => {
    await route.fulfill({
      status: route.request().method() === "OPTIONS" ? 204 : 201,
      headers: {
        ...requestHeaders,
        Location: "https://uploads.test/file",
        "Upload-Offset": "1000",
        "Tus-Resumable": "1.0.0",
      },
    });
  });
  function video(index: number) {
    return {
      name: "video-" + index + ".mp4",
      mimeType: "video/mp4",
      buffer: Buffer.alloc(1000),
    };
  }
  await dialog
    .getByLabel("Selecionar arquivos da publicação")
    .setInputFiles([video(1), await png(page), video(2), video(3)]);
  for (let index = 0; index < 3; index += 1) {
    await expect.poll(() => authorizations.length).toBe(index + 1);
    await expect(
      dialog.getByRole("status").filter({ hasText: "Enviando vídeo:" }),
    ).toHaveText("Enviando vídeo: 0% · " + (index + 1) + "/3 vídeos");
    await expect(
      dialog.getByRole("button", { name: "Adicionar ao feed", exact: true }),
    ).toBeDisabled();
    if (index === 1) {
      await page.setViewportSize({ width: 390, height: 844 });
      await noOverflow(page);
      await capture(page, info, "upload-video-contador-mobile");
    }
    await authorizations[index].fulfill({
      headers: corsHeaders,
      json: {
        id: "video-" + (index + 1),
        endpoint: "https://uploads.test/resumable",
        token: "test-only-signature",
        bucket: "temporary",
        path: "fixture-" + index,
      },
    });
  }
  await expect(dialog.locator(".image-thumb")).toHaveCount(4);
  await expect(
    dialog.getByRole("button", { name: "Adicionar ao feed", exact: true }),
  ).toBeEnabled();

  await dialog
    .getByLabel("Selecionar arquivos da publicação")
    .setInputFiles(video(4));
  await expect.poll(() => authorizations.length).toBe(4);
  await expect(
    dialog.getByRole("status").filter({ hasText: "Enviando vídeo:" }),
  ).toHaveText("Enviando vídeo: 0% · 1/1 vídeo");
  await authorizations[3].fulfill({
    headers: corsHeaders,
    json: {
      id: "video-4",
      endpoint: "https://uploads.test/resumable",
      token: "test-only-signature",
      bucket: "temporary",
      path: "fixture-4",
    },
  });
  await expect(dialog.locator(".image-thumb")).toHaveCount(5);
});
