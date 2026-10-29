// Smoke, Check tab and security scenarios (SMK, CHK, SEC).
const { test, expect, withoutAI, withProducts, openTab } = require('./helpers');

const verdict = (page) => page.locator('#checkOut .verdict h2').first();
async function check(page, text) {
  await page.locator('#q').fill(text);
  await page.locator('#checkBtn').click();
}

test.beforeEach(async ({ page }) => {
  await withoutAI(page);
  await withProducts(page, 'busy');
  await page.goto('/index.html');
});

test('SMK-01 app opens with a worked example and no errors', async ({ page }) => {
  await expect(page).toHaveTitle('Halal Lens');
  await expect(verdict(page)).toHaveText('Doubtful (mushbooh)');
  await expect(page.locator('#checkOut .example-tag')).toBeVisible();
  expect(page.errors).toEqual([]);
});

test('SMK-02 tabs switch, and #learn opens Learn directly', async ({ page }) => {
  for (const [tab, id] of [['Scan', 'scan'], ['Restaurants', 'eat'], ['Learn', 'learn'], ['Check', 'check']]) {
    await openTab(page, tab);
    await expect(page.locator('#' + id)).toBeVisible();
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
  }
  await page.goto('/index.html#learn');
  await expect(page.locator('#learn')).toBeVisible();
  await expect(page.locator('#check')).toBeHidden();
});

test('SMK-03 no sideways scrolling at 320, 375, 768 and 1280 px', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'sets its own sizes');
  await check(page, 'Supercalifragilisticexpialidociousingredientwithnospaces, sugar, gelatine, E120, shrimp');
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const tab of ['Check', 'Scan', 'Restaurants', 'Learn']) {
      await openTab(page, tab);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, tab + ' at ' + width + ' px').toBeLessThanOrEqual(0);
    }
  }
});

test('CHK-01 an ingredient list gets a verdict and reasons', async ({ page }) => {
  await check(page, 'sugar, gelatine, colour (E120)');
  await expect(verdict(page)).toHaveText('Doubtful (mushbooh)');
  const why = page.locator('#checkOut .card', { has: page.getByRole('heading', { name: 'Why' }) });
  await expect(why.locator('.ing-name')).toContainText(['Gelatin', 'Carmine / cochineal (E120)']);
});

test('CHK-02 the school of law changes the shrimp verdict', async ({ page }) => {
  await check(page, 'shrimp, salt');
  await expect(verdict(page)).toHaveText('Scholars differ');
  await page.locator('#school').selectOption('hn');
  await expect(verdict(page)).toHaveText('Doubtful (mushbooh)');
  await page.locator('#school').selectOption('sh');
  await expect(verdict(page)).toHaveText('Halal');
});

test('CHK-03 perfume alcohol: haram as food, halal as cosmetics for Hanafi', async ({ page }) => {
  await page.locator('#school').selectOption('hn');
  await check(page, 'Alcohol denat., aqua, parfum');
  await expect(verdict(page)).toHaveText('Haram');
  await page.locator('[data-ctx="cosmetic"]').click();
  await expect(verdict(page)).toHaveText('Halal');
});

test('CHK-04 example chips run a check', async ({ page }) => {
  await page.locator('#examples').getByRole('button', { name: 'Lipstick' }).click();
  await expect(page.locator('#q')).toHaveValue(/carmine/i);
  await expect(page.locator('#checkOut .verdict .lbl').first()).toHaveText('Ingredient list');
});

test('CHK-05 recent searches survive a reload', async ({ page }) => {
  await check(page, 'KitKat');
  await page.reload();
  await expect(page.locator('#recent').getByRole('button', { name: 'KitKat' })).toBeVisible();
});

test('CHK-06 Enter checks a short name; Shift+Enter adds a line', async ({ page }) => {
  await page.locator('#q').fill('nutella');
  await page.locator('#q').press('Enter');
  await expect(page.locator('#checkOut .verdict .lbl').first()).toHaveText('nutella');
  await page.locator('#q').fill('sugar');
  await page.locator('#q').press('Shift+Enter');
  await expect(page.locator('#q')).toHaveValue('sugar\n');
});

test('CHK-07 a flagged ingredient shows each school and linked evidence', async ({ page }) => {
  await check(page, 'shrimp');
  const card = page.locator('#checkOut details.ing[open]').first();
  await expect(card.locator('.school')).toHaveCount(4);
  await expect(card.locator('.school')).toContainText(['Hanafi', 'Shafi’i', 'Maliki', 'Hanbali']);
  expect(await card.locator('a[href^="https://quran.com/"]').count()).toBeGreaterThan(0);
  expect(await card.locator('a[href^="https://sunnah.com/search?q="]').count()).toBeGreaterThan(0);
  await expect(card.locator('a').first()).toHaveAttribute('target', '_blank');
});

test('CHK-08 unknown words are listed as not recognised', async ({ page }) => {
  await check(page, 'sugar, xanthomonas extract');
  const card = page.locator('#checkOut .card', { has: page.getByRole('heading', { name: 'Not recognised' }) });
  await expect(card).toContainText('xanthomonas extract');
});

test('CHK-09 an empty check focuses the box and does not break', async ({ page }) => {
  await page.locator('#q').fill('');
  await page.locator('#checkBtn').click();
  await expect(page.locator('#q')).toBeFocused();
  expect(page.errors).toEqual([]);
});

test('CHK-10 type and school are remembered after a reload', async ({ page }) => {
  await page.locator('[data-ctx="cosmetic"]').click();
  await page.locator('#school').selectOption('mk');
  await page.reload();
  await expect(page.locator('[data-ctx="cosmetic"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#school')).toHaveValue('mk');
});

test('CHK-11 a halal mark gives a certified verdict', async ({ page }) => {
  await check(page, 'halal certified: sugar, gelatin');
  await expect(verdict(page)).toHaveText('Halal certified');
  await expect(page.locator('#checkOut .tag', { hasText: 'Halal mark found' })).toBeVisible();
});

test('CHK-12 praised foods show their blessings and evidence', async ({ page }) => {
  await check(page, 'dates, honey');
  const card = page.locator('#checkOut .card', { has: page.getByRole('heading', { name: /Blessings/ }) });
  await expect(card).toContainText('Dates');
  await expect(card).toContainText('Honey');
  expect(await card.locator('a[href^="https://quran.com/16/69"]').count()).toBeGreaterThan(0);
});

test('SEC-01 typed HTML is shown as text and never runs', async ({ page }) => {
  await check(page, '<img src=x onerror="window.__xss=1">, sugar');
  await expect(verdict(page)).toBeVisible();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('#checkOut img[src="x"]').count()).toBe(0);
});

test.describe('speed', () => {
  // Timing is sensitive to other browsers running in parallel, so measure on desktop only, with one retry.
  test.describe.configure({ retries: 1 });
  test('PERF-01 the app is ready in under 3 seconds', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'timed on desktop only');
    const ms = await page.evaluate(() => performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd);
    expect(ms).toBeLessThan(3000);
  });
});
