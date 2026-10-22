import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/demonstracao");
  await page
    .getByRole("button", { name: "Abrir publicação 2", exact: true })
    .click();
});

test("carrossel mantém a imagem correta ao alternar setas, teclado e indicadores", async ({
  page,
}) => {
  const dialog = page.getByRole("dialog", { name: "Publicação", exact: true });
  const image = dialog.locator(".viewer-media img");
  const caption = await dialog.locator(".viewer-caption").textContent();

  await dialog.getByRole("button", { name: "Próxima mídia" }).click();
  await expect(image).toHaveAttribute("src", "/demo/07.svg");
  await page.keyboard.press("ArrowLeft");
  await expect(image).toHaveAttribute("src", "/demo/02.svg");
  await dialog
    .getByRole("button", { name: "Ver mídia 2", exact: true })
    .click();
  await page.keyboard.press("ArrowRight");
  await expect(image).toHaveAttribute("src", "/demo/07.svg");
  await expect(
    dialog.getByRole("button", { name: "Ver mídia 2", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await dialog.getByRole("button", { name: "Mídia anterior" }).click();
  await expect(image).toHaveAttribute("src", "/demo/02.svg");
  await expect(dialog.locator(".viewer-slide-previous")).toHaveCount(0);
  await expect(dialog.locator(".viewer-caption")).toHaveText(caption ?? "");
  await page.screenshot({
    path: test.info().outputPath("carousel-viewer.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: test.info().outputPath("feed-studio-desktop.png"),
    animations: "disabled",
    fullPage: true,
  });
});

test("gesto horizontal troca fotos e gesto vertical preserva a imagem atual", async ({
  page,
}) => {
  const media = page.getByRole("region", { name: "Mídias da publicação" });
  const image = media.locator("img");

  await media.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 240,
    clientY: 100,
  });
  await media.dispatchEvent("pointerup", {
    pointerType: "touch",
    clientX: 60,
    clientY: 110,
  });
  await expect(image).toHaveAttribute("src", "/demo/07.svg");

  await media.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 60,
    clientY: 100,
  });
  await media.dispatchEvent("pointerup", {
    pointerType: "touch",
    clientX: 70,
    clientY: 250,
  });
  await expect(image).toHaveAttribute("src", "/demo/07.svg");

  await media.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 60,
    clientY: 100,
  });
  await media.dispatchEvent("pointerup", {
    pointerType: "touch",
    clientX: 240,
    clientY: 110,
  });
  await expect(image).toHaveAttribute("src", "/demo/02.svg");
});

test("preferência por movimento reduzido mantém navegação sem acumular a foto anterior", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const dialog = page.getByRole("dialog", { name: "Publicação", exact: true });

  await dialog.getByRole("button", { name: "Próxima mídia" }).click();
  await expect(dialog.locator(".viewer-media img")).toHaveAttribute(
    "src",
    "/demo/07.svg",
  );
  await expect(dialog.locator(".viewer-slide-previous")).toHaveCount(0);
  await expect(dialog.locator(".viewer-slide")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.locator(".viewer-media img")).toHaveAttribute(
    "src",
    "/demo/02.svg",
  );
});
