import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

let browserErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) browserErrors.push(response.status() + ' ' + response.url());
  });
  await page.goto('/simulador');
  await expect(page.getByRole('heading', { name: 'Ideias que ganham um feed.' })).toBeVisible();
  await expect(page.getByText('Salvo neste navegador', { exact: true })).toBeVisible();
});
test.afterEach(async () => { expect(browserErrors).toEqual([]); });

async function png(page: Page, color = '#ec6d56') {
  const url = await page.evaluate(color => {
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color; ctx.fillRect(0, 0, 300, 400);
    return canvas.toDataURL('image/png');
  }, color);
  return { name: 'imagem.png', mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64') };
}

async function createProject(page: Page, name = 'Studio Flora') {
  await page.getByRole('button', { name: 'Criar feed', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do feed', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Criar feed', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test('demonstração, imagens locais e navegação no carrossel', async ({ page }) => {
  await expect(page.locator('.grid-post')).toHaveCount(6);
  const imagesReady = await page.locator('.post-grid img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0));
  expect(imagesReady).toBe(true);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Abrir publicação 2', exact: true }).click();
  const viewer = page.getByRole('dialog', { name: 'Publicação', exact: true });
  await expect(viewer.locator('.viewer-media img')).toHaveAttribute('src', '/demo/02.svg');
  await viewer.getByRole('button', { name: 'Próxima imagem' }).click();
  await expect(viewer.locator('.viewer-media img')).toHaveAttribute('src', '/demo/07.svg');
  await viewer.getByRole('button', { name: 'Curtir publicação fictícia', exact: true }).click();
  await expect(viewer.getByText('247 curtidas', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(viewer.locator('.viewer-media img')).toHaveAttribute('src', '/demo/02.svg');
  await page.keyboard.press('Escape');
  await expect(viewer).not.toBeVisible();
});

test('feeds separados, edição ao vivo e persistência após recarregar', async ({ page }) => {
  await createProject(page);
  await page.getByLabel('Nome de usuário', { exact: true }).fill('studio.flora');
  await page.getByLabel('Nome do perfil', { exact: true }).fill('Flora · design');
  await page.getByLabel(/^Bio/).fill('Identidade visual para marcas que florescem. 🌷');
  await expect(page.locator('.profile-bio')).toContainText('Identidade visual');
  await expect(page.getByText('Salvo neste navegador', { exact: true })).toBeVisible();
  const selectedId = await page.getByLabel('Feed atual').inputValue();
  await page.reload();
  await expect(page.getByLabel('Nome do perfil', { exact: true })).toHaveValue('Flora · design');
  await expect(page.locator('.grid-post')).toHaveCount(0);
  await page.getByLabel('Feed atual').selectOption({ label: 'Café Aurora' });
  await expect(page.locator('.grid-post')).toHaveCount(6);
  await page.getByLabel('Feed atual').selectOption(selectedId);
  await expect(page.getByLabel('Nome de usuário', { exact: true })).toHaveValue('studio.flora');
  await expect(page.locator('.grid-post')).toHaveCount(0);
});

test('upload, capa do carrossel, legenda, edição e persistência das imagens', async ({ page }) => {
  await createProject(page);
  const firstImage = await png(page);
  const secondImage = await png(page, '#7c8069');
  await page.getByRole('button', { name: 'Nova publicação', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Selecionar imagens da publicação').setInputFiles([firstImage, secondImage]);
  await expect(dialog.locator('.image-thumb')).toHaveCount(2);
  await dialog.getByLabel(/^Legenda/).fill('Campanha de primavera 🌷\nUm novo começo.');
  await dialog.getByLabel('Localização').fill('Curitiba');
  await dialog.getByRole('button', { name: 'Mover imagem 2 para a esquerda' }).click();
  const cover = await dialog.locator('.image-thumb img').first().getAttribute('src');
  await dialog.getByRole('button', { name: 'Adicionar ao feed', exact: true }).click();
  await expect(page.locator('.grid-post')).toHaveCount(1);
  await expect(page.locator('.grid-post img')).toHaveAttribute('src', cover!);
  await expect(page.getByText('Salvo neste navegador', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.grid-post img')).toHaveAttribute('src', cover!);
  await page.getByRole('button', { name: 'Abrir publicação 1', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Campanha de primavera');
  await expect(dialog).toContainText('Curitiba');
  await dialog.getByRole('button', { name: 'Editar', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Legenda/).fill('Legenda atualizada');
  await dialog.getByRole('button', { name: 'Salvar publicação', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir publicação 1', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Legenda atualizada');
});

test('ordem por arraste e setas, exclusão com confirmação', async ({ page }) => {
  const originalIds = await page.locator('.grid-post').evaluateAll(posts => posts.map(post => post.getAttribute('data-post-id')));
  await page.locator('.grid-post').first().dragTo(page.locator('.grid-post').nth(2));
  await expect(page.locator('.grid-post').nth(2)).toHaveAttribute('data-post-id', originalIds[0]!);
  await page.getByRole('tab', { name: /^Conteúdo/ }).click();
  await page.getByRole('button', { name: 'Mover publicação 3 para cima', exact: true }).click();
  await expect(page.locator('.grid-post').nth(1)).toHaveAttribute('data-post-id', originalIds[0]!);
  await page.getByRole('button', { name: 'Excluir publicação 1', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('.grid-post')).toHaveCount(6);
  await page.getByRole('button', { name: 'Excluir publicação 1', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir publicação', exact: true }).click();
  await expect(page.locator('.grid-post')).toHaveCount(5);
  await expect(page.getByText('Salvo neste navegador', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.grid-post')).toHaveCount(5);
});

test('visualização mobile e apresentação com saída por Escape', async ({ page }) => {
  const sources = await page.locator('.grid-post img').evaluateAll(images => images.map(image => image.getAttribute('src')));
  await page.getByRole('button', { name: 'Mobile', exact: true }).click();
  await expect(page.locator('.phone-frame')).toBeVisible();
  expect(await page.locator('.grid-post img').evaluateAll(images => images.map(image => image.getAttribute('src')))).toEqual(sources);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Apresentar', exact: true }).click();
  await expect(page.locator('.editor-panel')).not.toBeVisible();
  await page.getByRole('button', { name: 'Abrir publicação 2', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Editar', exact: true })).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.editor-panel')).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.editor-panel')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/responsive.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('valida tipo de arquivo, quantidade de imagens e foto do perfil', async ({ page }) => {
  const avatar = await png(page, '#869b70');
  await page.getByLabel('Selecionar foto do perfil').setInputFiles(avatar);
  await expect(page.locator('.profile-avatar img')).toHaveAttribute('src', /^data:image\/webp/);
  await expect(page.getByText('Salvo neste navegador', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.profile-avatar img')).toHaveAttribute('src', /^data:image\/webp/);
  await page.getByRole('button', { name: 'Nova publicação', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Selecionar imagens da publicação').setInputFiles({ name: 'texto.txt', mimeType: 'text/plain', buffer: Buffer.from('arquivo inválido') });
  await expect(dialog.getByRole('alert')).toContainText('JPG, PNG ou WebP');
  await expect(dialog.getByRole('button', { name: 'Adicionar ao feed', exact: true })).toBeDisabled();
  await dialog.getByLabel('Selecionar imagens da publicação').setInputFiles(Array.from({ length: 11 }, () => avatar));
  await expect(dialog.getByRole('alert')).toContainText('até 10 imagens');
});

test('falha de salvamento mantém alterações e permite tentar novamente', async ({ page }) => {
  await page.evaluate(() => {
    (window as unknown as { originalPut: typeof IDBObjectStore.prototype.put }).originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = () => { throw new DOMException('Quota cheia', 'QuotaExceededError'); };
  });
  await page.getByLabel('Nome do perfil', { exact: true }).fill('Alteração preservada');
  await expect(page.getByRole('alert')).toContainText('O espaço deste navegador acabou');
  await expect(page.locator('.profile-bio')).toContainText('Alteração preservada');
  await page.evaluate(() => { IDBObjectStore.prototype.put = (window as unknown as { originalPut: typeof IDBObjectStore.prototype.put }).originalPut; });
  await page.getByRole('button', { name: 'Tentar salvar', exact: true }).click();
  await expect(page.getByText('Salvo neste navegador', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Nome do perfil', { exact: true })).toHaveValue('Alteração preservada');
});

test('excluir último feed mantém a aplicação utilizável', async ({ page }) => {
  await page.getByRole('button', { name: 'Excluir feed', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir feed', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Novo feed', exact: true })).toBeVisible();
  await expect(page.locator('.grid-post')).toHaveCount(0);
  await expect(page.getByText('Salvo neste navegador', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Novo feed', exact: true })).toBeVisible();
});
