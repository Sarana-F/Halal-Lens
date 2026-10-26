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

**Turn on Lens-style scanning (Vercel only).** Without this, photos are read on the phone (OCR), which needs a clear ingredient list and cannot translate. With it, Claude recognises packs, dishes and menus in any language, like Google Lens, and also looks up unknown product names and restaurants.
1. Create an API key at https://console.anthropic.com → Settings → API keys. Set a monthly spend limit there.
2. In Vercel: your project → Settings → Environment Variables → add `ANTHROPIC_API_KEY` with the key.
3. Deployments → the latest one → ⋯ → Redeploy.

The key stays on the server (`api/ask.js`); the browser never sees it. The function only accepts this site's three fixed tasks, refuses other websites, and limits each visitor to 30 requests per 10 minutes. It uses Claude Opus 5.5, roughly 3 to 5 US cents per photo. Optional settings: `HL_MODEL`, `HL_EFFORT` (`low`, `medium`, `high`), `HL_RATE_LIMIT`.

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
| `api/ask.js` | Vercel function that calls Claude with the server's API key |
| `manifest.webmanifest`, `sw.js`, `icon.svg` | Make the site installable and usable offline |
| `tests/` | Engine and API tests: `npm test` |
| `DEVELOPMENT.md` | How the app was designed, built and tested |

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
