// Shared set-up for the browser tests: blocks web fonts, records page errors, and fakes
// the outside services (Claude via /api/ask, Open Food Facts, on-device OCR) so results are repeatable.
const base = require('@playwright/test');

const test = base.test.extend({
  page: async ({ page }, use) => {
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) page.errors.push(m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await use(page);
  }
});
const expect = base.expect;

// A valid 1x1 PNG, enough for photo uploads.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

/* Turn the site's AI on. reply(body) returns either a result object, or {httpError, code} for an error. */
async function withAI(page, reply) {
  page.aiCalls = [];
  await page.route('**/api/ask', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { ai: true } });
    const body = req.postDataJSON();
    page.aiCalls.push(body);
    const out = await reply(body);
    if (out && out.httpError) return route.fulfill({ status: out.httpError, json: { error: out.code, code: out.code } });
    return route.fulfill({ json: { result: out } });
  });
}
async function withoutAI(page) {
  await page.route('**/api/ask', (r) => r.fulfill({ status: 404, body: 'not found' }));
}

const NUTELLA = {
  code: '3017624010701', product_name: 'Nutella', brands: 'Ferrero', countries: 'France, United Kingdom',
  ingredients_text_en: 'Sugar, palm oil, hazelnuts 13%, skimmed milk powder 8.7%, fat-reduced cocoa 7.4%, emulsifier: lecithins (soya), vanillin', labels_tags: []
};
const GUMMIES = {
  code: '4001686301265', product_name: 'Goldbears', brands: 'Haribo', countries: 'Germany',
  ingredients_text_en: 'Glucose syrup, sugar, gelatine, dextrose, citric acid, fruit and plant concentrates, glazing agent: beeswax', labels_tags: []
};
const GUMMIES_HALAL = Object.assign({}, GUMMIES, { code: '8691216020146', countries: 'Turkey', labels_tags: ['en:halal'] });

/* Fake Open Food Facts. mode: 'ok' | 'busy' */
async function withProducts(page, mode) {
  await page.route(/open(food|beauty)facts\.org/, (route) => {
    const url = route.request().url();
    if (mode === 'busy') return route.fulfill({ status: 503, body: 'busy' });
    if (/\/api\/v2\/product\//.test(url)) {
      const p = /3017624010701/.test(url) ? NUTELLA : null;
      return route.fulfill({ json: p ? { status: 1, product: p } : { status: 0 } });
    }
    return route.fulfill({ json: { products: [GUMMIES, GUMMIES_HALAL] } });
  });
}

/* Replace on-device OCR with a stub that returns fixed text and records the language. */
async function stubOCR(page, text) {
  await page.addInitScript((t) => {
    window.Tesseract = { recognize: async (file, langs) => { window.__ocrLangs = langs; return { data: { text: t } }; } };
  }, text || 'Ingredients: sugar, glucose syrup, gelatine, citric acid');
}

async function openTab(page, name) {
  await page.getByRole('tab', { name }).click();
}

module.exports = { test, expect, PNG, withAI, withoutAI, withProducts, stubOCR, openTab };
