// Live AI tests (TEST-PLAN.md section 5). These make REAL Claude calls through api/ask.js
// and are billed to the API key: about $0.30 per run. They never run unless ANTHROPIC_API_KEY is set.
// Run: ANTHROPIC_API_KEY=sk-ant-... npm run test:live
global.window = global;
const path = require('path');
const root = path.join(__dirname, '..', '..');
for (const f of ['evidence.js', 'ing-core.js', 'ing-additives.js', 'ing-plant-cosmetic.js', 'engine.js']) require(path.join(root, f));

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('SKIP live AI tests: set ANTHROPIC_API_KEY to run them (they are billed, about $0.30 per run).');
  process.exit(0);
}
const handler = require(path.join(root, 'api', 'ask.js'));

function call(body) {
  return new Promise((resolve) => {
    const res = { setHeader() {}, end(s) { resolve({ status: this.statusCode, body: JSON.parse(s) }); } };
    handler({ method: 'POST', body, headers: { host: 'localhost' }, socket: { remoteAddress: 'live-test' } }, res);
  });
}

// Render a label as a JPEG photo with the test browser.
async function photo(html) {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await page.setContent('<body style="margin:0;font:28px/1.5 Arial, sans-serif;background:#fff;color:#111">' + html + '</body>');
  const buf = await page.screenshot({ type: 'jpeg', quality: 85 });
  await browser.close();
  return { media_type: 'image/jpeg', data: buf.toString('base64') };
}
const verdictOf = (text) => HL.analyze(text, { ctx: 'food' }).verdict;
const productText = (p) => [p.labelIngredients || p.typicalIngredients || p.type || '', p.halalMark ? 'halal certified' : ''].join('; ');

let fail = 0, total = 0;
function check(id, ok, msg, detail) {
  total++; if (!ok) fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + id + '  ' + msg + (ok ? '' : '\n       ' + JSON.stringify(detail).slice(0, 600)));
}

(async () => {
  let r = await call({ task: 'product', args: { q: 'Nutella', ctx: 'food' } });
  check('LIVE-01', r.status === 200 && r.body.result.known === true && /hazelnut/i.test(r.body.result.ingredients) && ['h', 'n', 'd', 'm', 'hc'].includes(verdictOf(r.body.result.ingredients)),
    'Nutella is known and its ingredients are checked', r.body);

  r = await call({ task: 'restaurant', args: { name: 'KFC', city: 'Kuala Lumpur' } });
  const rest = r.body.result || {};
  check('LIVE-02', r.status === 200 && rest.known === true && typeof rest.status === 'string' && !/\+?\d[\d\s-]{7,}/.test(JSON.stringify(rest)),
    'KFC Kuala Lumpur is known, has a status, and no phone number is invented', r.body);

  r = await call({ task: 'scan', args: { ctx: 'food' }, image: await photo('<div style="padding:40px"><b>Gomitas de fruta</b><br>Ingredientes: azúcar, jarabe de glucosa, grenetina, ácido cítrico, colorante carmín (E120).</div>') });
  let p = ((r.body.result || {}).products || [])[0] || {};
  check('LIVE-03', r.status === 200 && /span/i.test(r.body.result.language || '') && /gelatin/i.test(p.labelIngredients || '') && ['d', 'm', 'x'].includes(verdictOf(productText(p))),
    'a Spanish label is read, translated, and gelatin is flagged', r.body);

  r = await call({ task: 'scan', args: { ctx: 'food' }, image: await photo('<div dir="rtl" style="padding:40px;font-size:34px">المكونات: سكر، جيلاتين بقري، حمض الستريك</div>') });
  p = ((r.body.result || {}).products || [])[0] || {};
  check('LIVE-04', r.status === 200 && /arab/i.test(r.body.result.language || '') && /gelatin/i.test(p.labelIngredients || '') && verdictOf(productText(p)) === 'd',
    'an Arabic label is read, translated, and beef gelatin is doubtful', r.body);

  r = await call({ task: 'scan', args: { ctx: 'food' }, image: await photo('<div style="padding:40px;text-align:center;background:#222;color:#f5d27a;height:520px"><div style="font-size:54px;margin-top:80px">LIQUEUR PRALINES</div><div>Dark chocolate bottles filled with whisky liqueur</div><div style="margin-top:30px">15% vol &middot; 250 g</div></div>') });
  const products = (r.body.result || {}).products || [];
  check('LIVE-05', r.status === 200 && products.length > 0 && products.some((x) => verdictOf(productText(x)) === 'x'),
    'a pack front with no ingredient list is recognised and found haram', r.body);

  r = await call({ task: 'product', args: { q: 'Zqvorbix Crunch Lumps 9000', ctx: 'food' } });
  check('LIVE-06', r.status === 200 && r.body.result.known === false && !r.body.result.ingredients,
    'a made-up product is not invented', r.body);

  console.log((total - fail) + '/' + total + ' live AI checks passed');
  process.exit(fail ? 1 : 0);
})();
