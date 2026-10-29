// Installable app, offline use, themes and accessibility (PWA, UI, A11Y).
const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect, withoutAI, openTab } = require('./helpers');

test('PWA-01 the manifest is valid', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.name).toBe('Halal Lens');
  expect(m.start_url).toBeTruthy();
  expect(m.display).toBe('standalone');
  expect(m.icons.length).toBeGreaterThan(0);
});

test('PWA-03 the icon is served as SVG', async ({ request }) => {
  const res = await request.get('/icon.svg');
  expect(res.headers()['content-type']).toContain('image/svg+xml');
  expect(await res.text()).toContain('<svg');
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });
  test('PWA-02 after one visit the app opens with no connection', async ({ page, context }, info) => {
    test.skip(info.project.name !== 'desktop', 'one browser is enough');
    await withoutAI(page);
    await page.goto('/index.html');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page).toHaveTitle('Halal Lens');
    await page.locator('#q').fill('pork, sugar');
    await page.locator('#checkBtn').click();
    await expect(page.locator('#checkOut .verdict h2').first()).toHaveText('Haram');
    await context.setOffline(false);
  });
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });
  test('UI-01 dark colours are used', async ({ page }) => {
    await withoutAI(page); await page.goto('/index.html');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(14, 19, 32)');
  });
});

test.describe('light mode', () => {
  test.use({ colorScheme: 'light' });
  test('UI-02 light colours are used', async ({ page }) => {
    await withoutAI(page); await page.goto('/index.html');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(242, 244, 247)');
  });
});

test('UI-03 haram and halal verdicts look different', async ({ page }) => {
  await withoutAI(page); await page.goto('/index.html');
  const bg = async (text) => {
    await page.locator('#q').fill(text);
    await page.locator('#checkBtn').click();
    const v = page.locator('#checkOut .verdict').first();
    return [await v.getAttribute('class'), await v.evaluate((n) => getComputedStyle(n).backgroundColor)];
  };
  const haram = await bg('pork, sugar');
  const halal = await bg('water, sugar');
  expect(haram[0]).toContain('v-x');
  expect(halal[0]).toContain('v-h');
  expect(haram[1]).not.toBe(halal[1]);
});

test('A11Y-01 no serious or critical accessibility problems on any tab', async ({ page }) => {
  await withoutAI(page); await page.goto('/index.html');
  for (const tab of ['Check', 'Scan', 'Restaurants', 'Learn']) {
    await openTab(page, tab);
    if (tab === 'Restaurants') { await page.locator('#rName').fill('KFC'); await page.locator('#eatBtn').click(); }
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => v.id + ': ' + v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', '));
    expect(serious, tab + ' tab').toEqual([]);
  }
});

test('A11Y-02 every form control has a label', async ({ page }) => {
  await withoutAI(page); await page.goto('/index.html');
  const unlabelled = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')].filter((c) => {
    if (c.getAttribute('aria-label')) return false;
    return !(c.id && document.querySelector('label[for="' + c.id + '"]')) && !c.closest('label');
  }).map((c) => c.id || c.name || c.outerHTML.slice(0, 60)));
  expect(unlabelled).toEqual([]);
});

test('A11Y-03 the check works by keyboard alone, with a visible focus ring', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard test runs on desktop');
  await withoutAI(page); await page.goto('/index.html');
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => document.activeElement && document.activeElement.id === 'q');
  }
  expect(found).toBe(true);
  await page.keyboard.type('pork, sugar');
  found = false;
  for (let i = 0; i < 10 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => document.activeElement && document.activeElement.id === 'checkBtn');
  }
  expect(found).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.locator('#checkOut .verdict h2').first()).toHaveText('Haram');
});
