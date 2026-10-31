import { test, expect } from '@playwright/test';

test('catalog, filters, title search and empty state use live server data', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'Биты', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Драмкиты', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Все', exact: true }).click();
  await page.getByRole('searchbox').fill('NIGHT');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.locator('.product-card h3')).toHaveText('Night Drive');
  await page.getByRole('searchbox').fill('no-such-song');
  await expect(page.getByText('Пока ничего не нашлось')).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить поиск' }).click();
  await expect(page.locator('.product-card')).toHaveCount(5);
});

test('product card works by direct URL and shows correct bundles', async ({ page }) => {
  await page.goto('/products/night-drive');
  await expect(page.getByRole('heading', { name: 'Night Drive', exact: true })).toBeVisible();
  await expect(page.locator('.variant')).toHaveCount(4);
  await expect(page.getByText('WAV-файл', { exact: true })).toBeVisible();
  await expect(page.getByText('ZIP с WAV-дорожками', { exact: true })).toBeVisible();
  await expect(page.getByText('ZIP проекта', { exact: true })).toBeVisible();
  await expect(page.locator('.availability')).toContainText('покупки и лицензии появятся позже');
  await page.goto('/products/neon-drums');
  await expect(page.locator('.variant')).toHaveCount(1);
  await expect(page.getByText('ZIP с ударными звуками')).toBeVisible();
});

test('demo actually decodes, plays, pauses and seeks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Слушать демо Night Drive', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Аудиоплеер' })).toBeVisible();
  await expect.poll(() => page.locator('audio').evaluate(a => (a as HTMLAudioElement).currentTime)).toBeGreaterThan(0.15);
  await expect.poll(() => page.locator('audio').evaluate(a => (a as HTMLAudioElement).duration)).toBeGreaterThan(5);
  await page.locator('.player').getByRole('button', { name: 'Приостановить Night Drive' }).click();
  expect(await page.locator('audio').evaluate(a => (a as HTMLAudioElement).paused)).toBe(true);
  const seek = page.getByRole('slider', { name: 'Позиция воспроизведения' });
  const bounds = await seek.boundingBox();
  expect(bounds).not.toBeNull();
  await seek.click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  await expect.poll(() => page.locator('audio').evaluate(a => (a as HTMLAudioElement).currentTime)).toBeGreaterThan(2.5);
  expect(await page.locator('audio').evaluate(a => (a as HTMLAudioElement).currentTime)).toBeLessThan(3.5);
  await seek.focus();
  await seek.press('End');
  await expect.poll(() => page.locator('audio').evaluate(a => (a as HTMLAudioElement).currentTime)).toBeGreaterThan(5.8);
  await seek.press('Home');
  await expect.poll(() => page.locator('audio').evaluate(a => (a as HTMLAudioElement).currentTime)).toBeLessThan(0.1);
  await page.locator('.player').getByRole('button', { name: 'Слушать демо Night Drive' }).click();
  await expect.poll(() => page.locator('audio').evaluate(a => (a as HTMLAudioElement).paused)).toBe(false);
  await page.getByRole('button', { name: 'Слушать демо Neon Drums', exact: true }).click();
  await expect(page.locator('.player-name strong')).toHaveText('Neon Drums');
  await expect.poll(() => page.locator('audio').evaluate(a => (a as HTMLAudioElement).paused)).toBe(false);
  await expect(page.locator('audio')).toHaveCount(1);
  await expect(page.locator('.audio-error')).toHaveCount(0);
});

test('failed catalog request shows retry and recovers', async ({ page }) => {
  await page.route('**/api/products?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Не получилось загрузить');
  await page.unroute('**/api/products?*');
  await page.getByRole('button', { name: 'Попробовать снова' }).click();
  await expect(page.locator('.product-card')).toHaveCount(5);
});

test('loading state and missing product are visible', async ({ page }) => {
  await page.route('**/api/products?*', async route => {
    await new Promise(resolve => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Загружаем звук');
  await expect(page.locator('.product-card')).toHaveCount(5);
  await page.goto('/products/absent');
  await expect(page.getByRole('alert')).toContainText('Товар не найден');
});

test('layout fits viewport, links open real cards, no browser errors', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Scroll as a visitor would so the full-page snapshot includes lazy-loaded covers.
  await page.locator('.product-card').last().scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('img.cover').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `output/verification/catalog-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: 'Night Drive', exact: true }).click();
  await expect(page.locator('.variant')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `output/verification/card-${testInfo.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});
