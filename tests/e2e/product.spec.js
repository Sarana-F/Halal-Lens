// Product lookup scenarios (PRD): barcode, name search, database busy, Claude lookups.
const { test, expect, withAI, withoutAI, withProducts } = require('./helpers');

async function check(page, text) {
  await page.locator('#q').fill(text);
  await page.locator('#checkBtn').click();
}
const MYSTERY = { known: true, product: 'Mystery Bar', brand: 'Acme', ingredients: 'sugar, cocoa butter, gelatin', confidence: 'medium',
  variesByCountry: 'Made with halal gelatin in Malaysia', halalCertification: '', concerns: ['gelatin source'] };

test('PRD-01 a barcode finds the product and its full report', async ({ page }) => {
  await withoutAI(page); await withProducts(page, 'ok');
  await page.goto('/index.html');
  await check(page, '3017624010701');
  await expect(page.getByRole('heading', { name: 'Barcode 3017624010701' })).toBeVisible();
  const row = page.locator('#checkOut .prod', { hasText: 'Nutella' });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.locator('#checkOut .verdict h2').first()).toHaveText('Halal');
  await expect(page.locator('#checkOut .verdict .lbl').first()).toHaveText('Nutella · Ferrero');
});

test('PRD-02 a name search lists matching products with their own verdicts', async ({ page }) => {
  await withoutAI(page); await withProducts(page, 'ok');
  await page.goto('/index.html');
  await check(page, 'haribo goldbears');
  const rows = page.locator('#checkOut .prod');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Germany');
  await expect(rows.nth(0).locator('.pill')).toHaveText('Doubtful');
  await expect(rows.nth(1).locator('.pill')).toHaveText('Certified');
});

test('PRD-03 a busy product database suggests barcode or photo', async ({ page }) => {
  await withoutAI(page); await withProducts(page, 'busy');
  await page.goto('/index.html');
  await check(page, 'haribo');
  await expect(page.locator('#checkOut')).toContainText('busy or unreachable');
  await expect(page.locator('#checkOut')).toContainText('barcode');
});

test('PRD-04 with AI on, an unknown product gets a typical-recipe report', async ({ page }) => {
  await withAI(page, () => MYSTERY); await withProducts(page, 'busy');
  await page.goto('/index.html');
  await check(page, 'mystery bar');
  const ai = page.locator('#checkOut .card.ai');
  await expect(ai.getByRole('heading', { name: 'Typical recipe: Mystery Bar · Acme' })).toBeVisible();
  await expect(ai.locator('.verdict h2')).toHaveText('Doubtful (mushbooh)');
  await expect(ai).toContainText('Made with halal gelatin in Malaysia');
  expect(page.aiCalls[0]).toMatchObject({ task: 'product', args: { q: 'mystery bar', ctx: 'food' } });
});

test('PRD-05 when Claude does not know a product, it offers the scanner', async ({ page }) => {
  await withAI(page, () => ({ known: false })); await withProducts(page, 'busy');
  await page.goto('/index.html');
  await check(page, 'zzqx unknown snack');
  await expect(page.getByRole('heading', { name: 'Claude doesn’t know this product' })).toBeVisible();
  await page.getByRole('button', { name: 'Open the scanner' }).click();
  await expect(page.locator('#scan')).toBeVisible();
});

test('PRD-06 an AI error shows a message and Try again works', async ({ page }) => {
  let fail = true;
  await withAI(page, () => (fail ? { httpError: 429, code: 'rate_limited' } : MYSTERY)); await withProducts(page, 'busy');
  await page.goto('/index.html');
  await check(page, 'mystery bar');
  await expect(page.locator('#checkOut .card.ai')).toContainText('Too many requests');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: /Typical recipe: Mystery Bar/ })).toBeVisible();
});

test('PRD-07 "is kitkat halal?" is treated as the product name', async ({ page }) => {
  await withAI(page, () => ({ known: false })); await withProducts(page, 'busy');
  await page.goto('/index.html');
  await check(page, 'is kitkat halal?');
  await expect(page.locator('#checkOut .verdict .lbl').first()).toHaveText('kitkat');
  await expect.poll(() => page.aiCalls.length).toBeGreaterThan(0);
  expect(page.aiCalls[0].args.q).toBe('kitkat');
});
