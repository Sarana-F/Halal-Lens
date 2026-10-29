# Halal Lens

Check foods, cosmetics and restaurants for halal status. Every verdict shows the Qur'an verses, hadith and the positions of the Hanafi, Shafi'i, Maliki and Hanbali schools behind it.

Plain HTML, CSS and JavaScript. No build step, no server, no login. Works offline once opened.

## How to check whether something is halal

**By ingredient list (most reliable)**
1. Open the **Check** tab.
2. Choose **Food & drink** or **Cosmetics**, and your **school of law** (or leave "All schools" to see where they differ).
3. Type or paste the ingredients from the pack, for example `sugar, gelatine, colour (E120)`, and tap **Check halal status**.
4. Read the verdict, then open each flagged ingredient to see why, the evidence, and what each school says.

**By product name or barcode**
Type the name (`Haribo Goldbears`) or the digits under the barcode (`3017624010701`). The app searches Open Food Facts; pick the product that matches your country's pack.

**By photo**
Open **Scan** and tap **Take photo**. With AI switched on, photograph anything: the front of a pack, the ingredient list, several products at once, a dish or a menu, in any language. The app shows what it recognised, a verdict for each product, and whether the ingredients were read from the label or are the product's usual recipe. Without AI, photograph the ingredient list flat and well lit, pick the label's language, and correct any misread words before tapping **Check again**.

**Restaurants**
Open **Restaurants**, enter the name and city. You get first impressions from the name, links to Google Maps (phone number, hours, reviews) and halal searches, and a ready message to send them on WhatsApp.

## What each result means

| Result | Meaning |
|---|---|
| Halal | No haram or doubtful ingredient found |
| Halal certified | The pack carries a halal mark; the certifier has checked the sources |
| Halal, with a note | Accepted by most scholars, with a small caution (for example vanilla extract) |
| Scholars differ | The schools disagree (for example prawns, carmine); pick your school for one answer |
| Doubtful (mushbooh) | Could come from a haram source and the label doesn't say (for example E471, gelatin) |
| Haram | Contains pork, alcohol, blood or another forbidden ingredient |

## Hosting

The site is static: any host that serves files works.

**Vercel**: import this GitHub repository at https://vercel.com/new, keep Framework Preset "Other", leave the build command empty, and deploy. Every push to `main` redeploys.

**Turn on Lens-style scanning (Vercel only).** Without an AI key the site runs in free mode: barcode photos are looked up in Open Food Facts and ingredient lists are read on the phone (OCR, no translation). With a key, the AI recognises packs, dishes and menus in any language, like Google Lens, and also looks up unknown product names and restaurants. Pick one:

*Free: Google Gemini (no card needed)*
1. Go to https://aistudio.google.com, sign in with a Google account, and choose **Get API key** → **Create API key**.
2. In Vercel: your project → Settings → Environment Variables → add `GEMINI_API_KEY` with the key.
3. Deployments → the latest one → ⋯ → Redeploy.

The free tier has daily limits per model (low hundreds of requests a day); when one model's allowance runs out the site tries a second model, then tells visitors to come back later. Google may use free-tier requests to improve its products, so don't photograph anything private. Optional: `GEMINI_MODEL` to choose a different free model (default `gemini-3.8-flash`, then `gemini-3.5-flash-lite`).

*Paid: Claude (most accurate)*
1. Create an API key at https://console.anthropic.com → Settings → API keys, buy credit and set a monthly spend limit.
2. In Vercel add `ANTHROPIC_API_KEY`, then redeploy. If both keys are set, Claude is used unless `HL_PROVIDER=gemini`.

It uses Claude Opus 5.5, roughly 3 to 5 US cents per photo. Optional: `HL_MODEL`, `HL_EFFORT` (`low`, `medium`, `high`).

Either way the key stays on the server (`api/ask.js`); the browser never sees it. The function only accepts this site's three fixed tasks, refuses other websites, and limits each visitor to 30 requests per 10 minutes (`HL_RATE_LIMIT`).

**GitHub Pages**: repository Settings → Pages → Deploy from branch `main`, folder `/ (root)`.

**Install on a phone**: open the site, then Android (Chrome) menu → *Add to Home screen*, or iPhone (Safari) Share → *Add to Home Screen*.

There is also a claude.ai version for signed-in Claude users, where Claude reads label photos and looks up unknown products: https://claude.ai/artifact/9NzALVedSkzZH8Y6vM5ZEB

## Files

| File | What it holds |
|---|---|
| `halal-lens.html` | The page (layout and styles). Edit this one. |
| `index.html` | Generated from `halal-lens.html`. Run `node build.js` after editing. |
| `evidence.js` | Qur'an verses, hadith and scholarly positions, with links to quran.com and sunnah.com |
| `ing-core.js`, `ing-additives.js`, `ing-plant-cosmetic.js` | The ingredient rules (about 110 groups, 1,800 names and E/INS numbers) |
| `engine.js` | Reads an ingredient list and works out the verdict |
| `render.js`, `app.js`, `services.js`, `eat.js` | Screens, photo reading, product lookup, restaurant check |
| `prompts.js` | The instructions sent to Claude (shared by the browser and the server) |
| `api/ask.js` | Vercel function that calls Gemini (free) or Claude with the server's API key |
| `manifest.webmanifest`, `sw.js`, `icon.svg` | Make the site installable and usable offline |
| `tests/`, `playwright.config.js` | Engine, data, API, browser and live AI tests |
| `TEST-PLAN.md` | Every test scenario with its ID |
| `.claude/agents/halal-lens-qa.md` | The QA agent for Claude Code |
| `.github/workflows/tests.yml` | Runs the tests on GitHub |
| `DEVELOPMENT.md` | How the app was designed, built and tested |

## Testing

`TEST-PLAN.md` lists about 230 scenarios with IDs. Automated tests use the same IDs.

| Command | What it runs | Cost |
|---|---|---|
| `npm test` | Engine rulings (195 checks), data integrity, server API with Claude faked | Free |
| `npm run test:e2e` | Browser tests on phone, tablet and desktop sizes (first time: `npx playwright install chromium`) | Free |
| `npm run test:all` | Both of the above | Free |
| `npm run test:live` | Real AI calls: product, restaurant, Spanish and Arabic labels, a pack front | Free with `GEMINI_API_KEY`; about $0.30 with `ANTHROPIC_API_KEY` |

**QA agent.** Open this folder in Claude Code and say "use the halal-lens-qa agent to test the app". It runs every free test, investigates failures, explores the manual scenarios (odd inputs, evidence links, a rulings review, phone width, dark mode), asks before any paid test, and writes `test-results/QA-REPORT.md`.

**On GitHub.** Every push runs the free tests (Actions tab, report kept for 14 days). To run the live AI tests there, add `GEMINI_API_KEY` (free) or `ANTHROPIC_API_KEY` under Settings → Secrets and variables → Actions, then Actions → Tests → Run workflow → tick "live AI".

## Adding an ingredient

Add an object to one of the `ing-*.js` files, then run the tests:

```js
{ g: 'additive', n: 'Display name', s: 'd', v: 1,
  a: 'name one|name two|e123',
  w: 'Why it has this ruling.', e: 'q2_173 h_b52', c: 'What to check on the pack.' }
```

`s` is the ruling: `h` halal, `n` halal with a caution, `d` doubtful, `m` schools differ (add `m: {hn, sh, mk, hb}`), `x` haram. `e` lists evidence ids from `evidence.js`.

## Important

Halal Lens explains evidence and scholarly positions. It is not a fatwa. Recipes change by country and over time, so a trusted halal certificate on the pack is always the final word. For personal rulings, ask a qualified scholar.
