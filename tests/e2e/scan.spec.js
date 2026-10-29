// Photo scanning scenarios (SCN): on-device OCR, Lens-style AI recognition, fallbacks, uploads.
const { test, expect, PNG, withAI, withoutAI, stubOCR, openTab } = require('./helpers');

const report = (page) => page.locator('#scanReport .verdict h2');
async function upload(page) {
  await page.locator('#pick').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
}
function product(p) {
  return Object.assign({ name: 'Product', brand: null, type: 'snack', labelIngredients: '', typicalIngredients: '', halalMark: null, vegMark: null, claims: [], notes: '' }, p);
}
function scanReply(products, extra) {
  return Object.assign({ readable: true, kind: 'product', language: 'English', summary: 'A product photo.', textSeen: '', products }, extra);
}

test.describe('without AI (on-device reading)', () => {
  test.beforeEach(async ({ page }) => {
    await withoutAI(page);
    await stubOCR(page);
    await page.goto('/index.html');
    await openTab(page, 'Scan');
  });

  test('SCN-01 the language picker and on-device message are shown', async ({ page }) => {
    await expect(page.locator('#ocrLangWrap')).toBeVisible();
    await expect(page.locator('#scanEngine')).toContainText('read on your device');
  });

  test('SCN-02 the photo is read on the device and checked', async ({ page }) => {
    await upload(page);
    await expect(page.locator('#scanText')).toHaveValue(/gelatine/);
    await expect(report(page)).toHaveText('Doubtful (mushbooh)');
    await expect(page.locator('#scanStatus')).toContainText('Read on your device');
    await expect(page.locator('#preview')).toBeVisible();
  });

  test('SCN-03 editing the text and checking again updates the verdict', async ({ page }) => {
    await upload(page);
    await expect(report(page)).toBeVisible();
    await page.locator('#scanText').fill('sugar, pork gelatin');
    await page.locator('#recheck').click();
    await expect(report(page)).toHaveText('Haram');
  });

  test('SCN-04 the chosen label language is used for reading', async ({ page }) => {
    await page.locator('#ocrLang').selectOption('ara');
    await upload(page);
    await expect(page.locator('#scanText')).not.toHaveValue('');
    expect(await page.evaluate(() => window.__ocrLangs)).toBe('eng+ara');
  });

  test('SCN-12 pasting an image in the Scan tab scans it', async ({ page }) => {
    await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }));
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt }));
    }, PNG.toString('base64'));
    await expect(page.locator('#scanText')).toHaveValue(/gelatine/);
  });
});

test.describe('with AI (Lens-style recognition)', () => {
  test('SCN-05 a photo of an ingredient list in Spanish is read from the label', async ({ page }) => {
    await withAI(page, () => scanReply([product({ name: 'Gomitas', brand: 'Acme', type: 'gummy sweets', labelIngredients: 'sugar, gelatin, citric acid' })],
      { kind: 'ingredient_list', language: 'Spanish', summary: 'An ingredient list in Spanish.', textSeen: 'Ingredientes: azúcar, grenetina' }));
    await page.goto('/index.html'); await openTab(page, 'Scan');
    await expect(page.locator('#scanEngine')).toContainText('Google Lens');
    await expect(page.locator('#ocrLangWrap')).toBeHidden();
    await upload(page);
    await expect(page.getByRole('heading', { name: 'What the camera sees' })).toBeVisible();
    await expect(page.locator('#scanOut .tag', { hasText: 'Language: Spanish' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /products found/ })).toHaveCount(0);
    await expect(report(page)).toHaveText('Doubtful (mushbooh)');
    await expect(page.locator('#scanReport .tag', { hasText: 'Read from the label' })).toBeVisible();
    expect(page.aiCalls[0].task).toBe('scan');
  });

  test('SCN-06 several products are listed, the most serious opens first, and tapping switches', async ({ page }) => {
    await withAI(page, () => scanReply([
      product({ name: 'Milk chocolate bar', type: 'chocolate', labelIngredients: 'sugar, cocoa butter, milk powder, soy lecithin' }),
      product({ name: 'Jim Beam chocolate bottle', brand: 'Jim Beam', type: 'liqueur-filled chocolate', typicalIngredients: 'dark chocolate, sugar syrup, bourbon whiskey (15%)', notes: 'Branded with an alcoholic drink.' })
    ], { summary: 'Chocolate bottles shaped like liquor bottles.' }));
    await page.goto('/index.html'); await openTab(page, 'Scan');
    await upload(page);
    await expect(page.getByRole('heading', { name: '2 products found' })).toBeVisible();
    await expect(report(page)).toHaveText('Haram');
    const rows = page.locator('#scanOut .prod');
    await expect(rows.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await rows.nth(0).click();
    await expect(report(page)).toHaveText('Halal');
    await expect(rows.nth(0)).toHaveAttribute('aria-pressed', 'true');
  });

  test('SCN-07 a product without an ingredient list uses its usual recipe and says so', async ({ page }) => {
    await withAI(page, () => scanReply([product({ name: 'Baileys chocolate bottle', type: 'liqueur-filled chocolate', typicalIngredients: 'milk chocolate, Irish cream liqueur (17%)', notes: 'These chocolates contain real liqueur.' })]));
    await page.goto('/index.html'); await openTab(page, 'Scan');
    await upload(page);
    await expect(page.locator('#scanReport .note').first()).toContainText('No ingredient list was visible');
    await expect(page.locator('#scanReport')).toContainText('These chocolates contain real liqueur.');
    await expect(report(page)).toHaveText('Haram');
    await expect(page.locator('#scanReport .tag', { hasText: 'Typical recipe' })).toBeVisible();
  });

  test('SCN-08 a blurry photo gives a friendly message', async ({ page }) => {
    await withAI(page, () => ({ readable: false, summary: 'The photo is too blurry to read.', products: [] }));
    await page.goto('/index.html'); await openTab(page, 'Scan');
    await upload(page);
    await expect(page.locator('#scanStatus')).toContainText('too blurry');
    await expect(page.locator('#scanStatus')).toContainText('closer photo');
    await expect(page.locator('#scanTextWrap')).toBeVisible();
  });

  test('SCN-09 a visible halal logo gives a certified verdict', async ({ page }) => {
    await withAI(page, () => scanReply([product({ name: 'Jelly', labelIngredients: 'sugar, gelatin, citric acid', halalMark: 'JAKIM' })]));
    await page.goto('/index.html'); await openTab(page, 'Scan');
    await upload(page);
    await expect(report(page)).toHaveText('Halal certified');
  });

  test('SCN-10 if the site’s AI is out of credit, the photo is read on the device', async ({ page }) => {
    await withAI(page, () => ({ httpError: 402, code: 'no_credit' }));
    await stubOCR(page, 'Ingredients: sugar, salt');
    await page.goto('/index.html'); await openTab(page, 'Scan');
    await upload(page);
    await expect(page.locator('#scanText')).toHaveValue('sugar, salt');
    await expect(page.locator('#scanStatus')).toContainText('Read on your device');
    await expect(report(page)).toHaveText('Halal');
  });

  test('SCN-11 photos are sent as a JPEG of at most 1600 px', async ({ page }) => {
    await withAI(page, () => scanReply([product({ labelIngredients: 'sugar' })]));
    await page.goto('/index.html'); await openTab(page, 'Scan');
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
      const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 3000, 2000);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const dt = new DataTransfer(); dt.items.add(new File([blob], 'big.png', { type: 'image/png' }));
      const input = document.getElementById('pick'); input.files = dt.files; input.dispatchEvent(new Event('change'));
    });
    await expect(report(page)).toBeVisible();
    const img = page.aiCalls[0].image;
    expect(img.media_type).toBe('image/jpeg');
    const size = await page.evaluate((src) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.src = src; }), 'data:image/jpeg;base64,' + img.data);
    expect(Math.max(size[0], size[1])).toBeLessThanOrEqual(1600);
    expect(img.data.length).toBeLessThan(4 * 1024 * 1024);
  });
});
