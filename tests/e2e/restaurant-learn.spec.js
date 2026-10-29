// Restaurant (RST) and Learn (LRN) scenarios.
const { test, expect, withAI, withoutAI, openTab } = require('./helpers');

async function ask(page, name, city) {
  await page.locator('#rName').fill(name);
  await page.locator('#rCity').fill(city || '');
  await page.locator('#eatBtn').click();
}

test.describe('restaurants without AI', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });
  test.beforeEach(async ({ page }) => {
    await withoutAI(page);
    await page.goto('/index.html');
    await openTab(page, 'Restaurants');
  });

  test('RST-01 the name gives first impressions', async ({ page }) => {
    const cases = [['The Ramen Bar', ['alcohol is a main part', 'pork may be on the menu']], ['Halal Grill House', ['The name says halal']],
      ['Kosher Deli', ['kosher meat']], ['Pure Veg Cafe', ['No meat']]];
    for (const [name, texts] of cases) {
      await ask(page, name, 'London');
      const card = page.locator('#eatOut .card', { has: page.getByRole('heading', { name: 'First impressions' }) });
      for (const t of texts) await expect(card).toContainText(t);
    }
  });

  test('RST-02 the six links have the right encoded addresses and open in a new tab', async ({ page }) => {
    await ask(page, "Nando's", 'London');
    const links = page.locator('#eatOut .links a');
    await expect(links).toHaveCount(6);
    await expect(links.nth(0)).toHaveAttribute('href', "https://www.google.com/maps/search/?api=1&query=Nando's%20London");
    await expect(links.nth(1)).toHaveAttribute('href', 'https://www.google.com/search?q=' + encodeURIComponent('"Nando\'s" London halal'));
    await expect(links.nth(2)).toHaveAttribute('href', /site%3Azabihah\.com/);
    await expect(links.nth(5)).toHaveAttribute('href', /^https:\/\/maps\.apple\.com\/\?q=/);
    for (let i = 0; i < 6; i++) await expect(links.nth(i)).toHaveAttribute('target', '_blank');
  });

  test('RST-03 the message names the restaurant and Copy copies it', async ({ page }) => {
    await ask(page, "Nando's", 'London');
    await expect(page.locator('#rMsg')).toHaveValue(/Nando's/);
    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Nando's");
  });

  test('RST-04 the WhatsApp link carries the message', async ({ page }) => {
    await ask(page, 'Burger Palace', 'Chennai');
    const href = await page.getByRole('link', { name: 'Open in WhatsApp' }).getAttribute('href');
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(href.split('text=')[1])).toContain('Burger Palace');
  });

  test('RST-07 an empty name focuses the field and shows nothing', async ({ page }) => {
    await ask(page, '', '');
    await expect(page.locator('#rName')).toBeFocused();
    await expect(page.locator('#eatOut')).toBeEmpty();
  });

  test('RST-08 the live web check is hidden outside the Claude desktop app', async ({ page }) => {
    await ask(page, 'KFC', 'London');
    await expect(page.locator('#eatOut')).not.toContainText('Live web check');
  });
});

test.describe('restaurants with AI', () => {
  test('RST-05 a known chain shows status, summary and website', async ({ page }) => {
    await withAI(page, () => ({ known: true, isChain: true, status: 'certified', summary: 'KFC in Malaysia is halal-certified by JAKIM.', porkOrAlcohol: 'no', officialWebsite: 'kfc.com.my', howToVerify: 'Check the JAKIM register.' }));
    await page.goto('/index.html'); await openTab(page, 'Restaurants');
    await ask(page, 'KFC', 'Kuala Lumpur');
    const card = page.locator('#eatOut .card.ai');
    await expect(card.locator('.pill')).toHaveText('Halal certified');
    await expect(card).toContainText('JAKIM');
    await expect(card.getByRole('link', { name: 'kfc.com.my' })).toHaveAttribute('href', 'https://kfc.com.my');
    expect(page.aiCalls[0]).toMatchObject({ task: 'restaurant', args: { name: 'KFC', city: 'Kuala Lumpur' } });
  });

  test('RST-06 an unknown restaurant says Claude has no reliable information', async ({ page }) => {
    await withAI(page, () => ({ known: false, status: 'unknown' }));
    await page.goto('/index.html'); await openTab(page, 'Restaurants');
    await ask(page, 'Tiny Corner Cafe', 'Madurai');
    await expect(page.locator('#eatOut .card.ai')).toContainText('no reliable information');
  });
});

test.describe('learn', () => {
  test.beforeEach(async ({ page }) => {
    await withoutAI(page);
    await page.goto('/index.html');
  });

  test('LRN-01 nine principles, each with evidence', async ({ page }) => {
    await openTab(page, 'Learn');
    const items = page.locator('#principles details');
    await expect(items).toHaveCount(9);
    for (let i = 0; i < 9; i++) {
      await items.nth(i).locator('summary').click();
      expect(await items.nth(i).locator('.ev').count()).toBeGreaterThan(0);
    }
  });

  test('LRN-02 the library finds E-numbers and names', async ({ page }) => {
    await openTab(page, 'Learn');
    await page.locator('#libQ').fill('E471');
    await expect(page.locator('#libList .ing-name')).toContainText(['Mono- and diglycerides (E471)']);
    await page.locator('#libQ').fill('carmine');
    await expect(page.locator('#libList .ing-name').first()).toHaveText('Carmine / cochineal (E120)');
  });

  test('LRN-03 the Haram filter shows only haram entries', async ({ page }) => {
    await openTab(page, 'Learn');
    await page.locator('#libFilter').getByRole('button', { name: 'Haram' }).click();
    const pills = page.locator('#libList summary .pill');
    expect(await pills.count()).toBeGreaterThan(3);
    for (const t of await pills.allTextContents()) expect(t).toBe('Haram');
  });

  test('LRN-04 the chosen school changes library rulings', async ({ page }) => {
    await page.locator('#school').selectOption('hn');
    await openTab(page, 'Learn');
    await page.locator('#libQ').fill('shrimp');
    await expect(page.locator('#libList summary .pill').first()).toHaveText('Doubtful');
  });

  test('LRN-05 a search with no match says so', async ({ page }) => {
    await openTab(page, 'Learn');
    await page.locator('#libQ').fill('qwertyzzz');
    await expect(page.locator('#libList')).toContainText('Nothing matches');
  });
});
