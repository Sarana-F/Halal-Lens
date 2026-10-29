# How Halal Lens was built

This document records the development process: what was asked for, the decisions taken, how each part works, how it was tested, and what is still open.

## 1. The brief

The request was a phone app or website that:

- takes the **name** of a food, chocolate, cosmetic or daily-use product, or a **photo of its ingredients**, and says whether it is halal;
- explains **why** it is halal (its benefits) or haram (the evidence, and **who said it**);
- checks **restaurants** and, when nothing is known, finds the restaurant's own **contact details** so you can ask them;
- is ready for real use on phones.

## 2. Key decisions

| Decision | Reason |
|---|---|
| The verdict comes from a **curated rules engine**, not from an AI guess. | A ruling must be repeatable and traceable to evidence. The same label always gives the same answer, and every answer shows its source. |
| AI is used only to **read** (a label photo, or the typical recipe of a product name), and its output then goes through the same engine. | AI is good at reading text, but can be wrong about rulings. Keeping the verdict in the engine keeps it auditable. |
| Five rulings: **halal**, **halal with a caution**, **doubtful (mushbooh)**, **schools differ**, **haram**, plus **halal certified** and **not enough information**. | "Halal or haram" alone hides real scholarly difference and genuine doubt about an ingredient's source. |
| The user can pick a **school of law** (Hanafi, Shafi'i, Maliki, Hanbali). | Prawns, crab, carmine, horse meat, cheese rennet and alcohol in perfume get different answers in different schools. |
| **Evidence policy**: only well-known verses and hadith with their standard numbering; translations are written as meanings, not copied from one published translation; every reference links to quran.com or a sunnah.com search so it can be checked. | Accuracy matters more than volume. Readers can verify every citation themselves. |
| No Arabic Qur'an text is typed into the app. | A transcription error in the Qur'an's text would be serious; linking to quran.com shows the authentic Arabic. |
| Clear statement that the app **is not a fatwa**. | Recipes change by country, and personal rulings belong to qualified scholars. |
| Plain HTML, CSS and JavaScript, no framework or build tool. | Loads fast on cheap phones, runs offline, hosts anywhere for free, and is easy for anyone to read and edit. |

## 3. Architecture

```
halal-lens.html   page layout + styles (the source; index.html is generated from it by build.js)
evidence.js       Qur'an, hadith and scholarly-position library        HL.EV
ing-core.js       pork, alcohol, meat, blood, seafood, insects, gelatin, dairy
ing-additives.js  E-numbers / INS numbers, emulsifiers, colours, sweeteners
ing-plant-cosmetic.js  plant foods with Sunnah benefits, staples, fermented foods, cosmetics
engine.js         HL.analyze(text, {ctx, school}) -> verdict, hits, unknown items, claims
render.js         builds the verdict card, ingredient cards, evidence, Learn tab
prompts.js        the instructions sent to Claude, shared by the browser and api/ask.js
services.js       Claude (claude.ai or api/ask.js), Open Food Facts, on-device OCR, barcodes
api/ask.js        Vercel function: calls Claude Opus 5.5 with the server's ANTHROPIC_API_KEY
app.js            tabs, settings, Check and Scan flows, library
eat.js            restaurant check
sw.js + manifest.webmanifest + icon.svg   installable, offline-capable PWA
tests/engine.test.js   regression tests for the engine
```

Scripts load in that order and share one global object, `HL`.

### The same code runs in three places

| Where | Photo reading | Unknown product names | Restaurants |
|---|---|---|---|
| **claude.ai artifact** (signed-in Claude users) | Claude reads the label | Claude gives the typical recipe, the engine checks it | Claude's knowledge; live web search in the Claude desktop app |
| **Hosted site** (GitHub Pages, Vercel, Netlify; anyone, no login) | Tesseract.js OCR on the phone; barcode detection where the browser supports it | Open Food Facts / Open Beauty Facts database | Name hints, map and search links, message to send |
| **Offline** (installed PWA, no signal) | Type the ingredients instead | Not available | Name hints and saved message |

The app detects where it is running (`window.claude` exists only inside claude.ai) and switches features on or off. Nothing breaks when a feature is missing.

## 4. The ingredient data

Each entry is one ingredient group:

```js
{ g: 'additive',                        // group, used by the library filter
  n: 'Mono- and diglycerides (E471)',   // display name
  s: 'd',                               // ruling: h, n, d, m, x
  v: 1,                                 // the only doubt is plant vs animal origin
  a: 'e471|mono and diglycerides|...',  // every name, spelling and code that should match
  w: 'Why it has this ruling.',
  e: 'h_b52 s_doubt s_cert',            // evidence ids from evidence.js
  c: 'What to check on the pack.',
  b: 'Benefit (for praised foods).',
  m: { hn: 'd', sh: 'h', mk: 'h', hb: 'h' },   // per school, when s is 'm'
  q: [['fish|marine', 'h', 'Fish gelatin.']],  // qualifiers: nearby words that change the ruling
  cs: 'h', cw: '...' }                  // different ruling when checking cosmetics
```

Coverage today: about 110 groups and 1,800 names, including E and INS numbers and common Spanish, French, German, Hindi/Urdu and Arabic label words.

## 5. How the engine reads a label

1. **Normalise**: lower-case, strip accents and punctuation, join hyphenated words.
2. **Additive codes**: `E 471`, `e-471`, `INS 471`, and bare numbers in brackets such as `emulsifiers (471, 322)` all become `e471`, `e322`. Roman-numeral suffixes like `500(ii)` are dropped.
3. **Special phrases**: "alcohol-free beer" and similar are turned into one token so they are not read as "beer".
4. **Label claims** are noted: halal mark or certifier name, vegan, vegetarian, alcohol-free, kosher.
5. **Negations** are removed: "no pork", "gelatin-free", "without alcohol" no longer match.
6. **Matching**: every name in the library is tried, **longest first**. Each match is blanked out so that "cetyl alcohol" is not matched again as "alcohol", or "red wine vinegar" as "wine".
7. **Context**: for each match the engine reads the words of that ingredient and the heading it sits under, so "gelatin (pork)", "fish gelatin", "beef salami" and "vegetable emulsifier (471)" each get the right ruling.
8. **Claims settle doubt**: a vegan label settles every animal-or-plant doubt; a vegetarian label settles gelatin, rennet and enzyme doubts.
9. **School**: "schools differ" entries are resolved to the chosen school's ruling.
10. **Verdict**: the most serious ruling wins (haram > doubtful > differs > caution > halal). A halal mark turns doubtful or differing items into "halal certified", unless something haram is listed, which is flagged as a contradiction.
11. **Unrecognised items** are listed so the user knows what was not checked.

## 6. Product lookup

- **By barcode**: `world.openfoodfacts.org/api/v2/product/<code>.json`, which allows browser requests (CORS).
- **By name**: Open Food Facts' `cgi/search.pl` full-text search. During development it often answered "503 temporarily unavailable" because of rate limits, so the app tells the user and suggests the barcode or a photo instead. The newer `search.openfoodfacts.org` endpoint does not allow browser requests from other sites.
- **Cosmetics** use the same calls on Open Beauty Facts.
- Halal, vegan and vegetarian labels recorded in the database are passed to the engine.
- Inside claude.ai the database cannot be reached (the page's network is locked), so Claude supplies the typical recipe instead and the result says so.

## 7. Photo reading

**Version 1.0** only looked for a printed ingredient list. First user test: a photo of foil-wrapped liqueur chocolate bottles (no ingredient list visible) returned "No ingredient list could be read", with no details. The scanner was redesigned to behave like Google Lens:

- Claude is asked to **recognise** what the photo shows: an ingredient list, the front of a pack, several products, a dish or a menu, in any language or script, translated into English (`prompts.js`, task `scan`).
- For **each product** it returns the printed ingredients if visible; otherwise the product's **usual recipe** from its knowledge (naming any alcohol, pork, gelatin or carmine), plus halal logos, the Indian veg mark, label claims and notes.
- The app shows "What the camera sees", a list of products each with its own verdict, and opens the most serious one. When the ingredients came from Claude's knowledge rather than the label, a note says so and suggests photographing the ingredient list.
- Claude is reached through the viewer's own account inside claude.ai, or through `api/ask.js` on Vercel when an `ANTHROPIC_API_KEY` is set. The server builds the prompt itself, accepts only the three fixed tasks, refuses other websites, rate-limits each visitor, rejects photos over 4 MB (the browser downsizes them to 1600 px first), and uses server-side refusal fallbacks.
- **Without AI**, Tesseract.js 5.1.1 reads the label on the phone in a language the user picks (21 languages, each added to English). OCR cannot recognise products or translate, so the text is shown for correction. If the browser supports `BarcodeDetector` and a barcode is in the photo, the barcode lookup is tried first.

### Free alternative to a paid key (version 1.3)

The hosted site can now use **Google Gemini's free tier** instead of Claude. Set `GEMINI_API_KEY` in Vercel (created free at aistudio.google.com, no card). `api/ask.js` picks the provider from the keys present, calls Gemini's REST API with the key in a header, asks for a JSON answer, and on a 429 (that model's free daily allowance used up) or 404 it tries a second free model before telling the visitor to come back later. Screens name whichever AI answered. Trade-offs: lower daily limits, and Google may use free-tier requests to improve its products. Models were checked against Google's pricing and model pages on 29 October 2026: `gemini-3.8-flash` (default) and `gemini-3.5-flash-lite` are free; `gemini-2.5-flash` is closed to new users.

**Free mode without any key** also improved: barcode photos are now read on iPhones and desktops too (ZXing library, loaded only when the browser has no barcode reader), so a photo of the barcode finds the product's real ingredient list in Open Food Facts.

## 8. Restaurants

1. **Name hints**: words like "halal", "bar", "brewery", "ramen" or "kosher" give a first impression.
2. **Claude's knowledge** (claude.ai only): it is told never to invent phone numbers, addresses or certificates, and to say when it does not know a restaurant.
3. **Live web check** (Claude desktop app only): the app's own browser searches DuckDuckGo for halal mentions and contact details, and Claude extracts quotes and contacts only from those results.
4. **Always available**: links to Google Maps (phone, hours, reviews), Google, Zabihah and Apple Maps, a checklist of questions, and a ready message to copy or open in WhatsApp.

## 9. Design

- Phone-first single column, sticky header with four tabs: Check, Scan, Restaurants, Learn.
- The verdict sits inside an **eight-point star** (rub el hizb), a motif from Islamic geometry, with a different glyph per ruling. Colour is never the only signal.
- Lapis blue as the brand colour and a gold accent, echoing illuminated manuscripts; separate semantic colours for each ruling; full light and dark themes.
- Fonts: Reem Kufi (Kufic-inspired) for headings, Figtree for reading.
- The page opens with a worked example so the first screen already shows what the app does.

## 10. Testing

**Version 1.2 added a full testing agent.** `TEST-PLAN.md` catalogues about 230 scenarios with IDs, and every automated test carries its ID:

- **Engine** (`tests/engine.test.js`): 195 checks across pork, alcohol, meat, seafood, gelatin, insects, dairy, additives, negations and claims, cosmetics, other languages and edge cases, each school where it matters, plus a speed check.
- **Data integrity** (`tests/data.test.js`): 12 checks over all 108 ingredient groups, 1,787 names and 81 evidence items.
- **Server API** (`tests/api.test.js`): 23 checks with Claude faked, including every error path, the request sent to Claude, and the per-visitor limit.
- **Browser** (`tests/e2e/`, Playwright): 58 scenarios, each run on a phone, a tablet and a desktop size, with Claude, Open Food Facts and OCR faked; includes offline use, dark mode, keyboard use and an automated accessibility scan (axe).
- **Live AI** (`tests/live/live-ai.test.js`): 6 real Claude calls, run only by hand.
- **QA agent** (`.claude/agents/halal-lens-qa.md`): runs everything, investigates failures, explores the manual scenarios and writes a report.
- **GitHub Actions** (`.github/workflows/tests.yml`): free tests on every push; live AI on request.

The first full run found real bugs, all now fixed: a "not halal" label was read as halal; two rules disagreed on "chicken flavour"; "vanilla extract (alcohol free)" still carried a caution; a `#learn` link did nothing on an open page; a long unknown word made the page scroll sideways on 320 px phones; the "Example" tag had too little contrast; a label was attached to an element that cannot carry one; and an out-of-credit API key showed a confusing image error instead of falling back to on-device reading.

The earlier version-1.0 checks are summarised below.

**Engine tests** (first version: 26 cases) cover gummies with gelatin and E120, chocolate with vanilla extract, Indian biscuits with INS numbers, Nutella, prawns and crab under different schools, perfume alcohol under Hanafi and Shafi'i views, fatty alcohols, carmine lipstick, alcohol-free beer, negations, halal-certified products, pork vs fish gelatin, wine vinegar and mirin. The test also checks that every evidence id exists.

**Browser tests** on the hosted build: tab switching, example chips, ingredient check with a chosen school, barcode lookup (Nutella 3017624010701 returned its real ingredient list), restaurant hints and links, library search, and no sideways scrolling at phone width.

**Problems found and fixed during testing**

| Problem | Fix |
|---|---|
| "fat-reduced cocoa" in Nutella matched "fat" and made it doubtful | Removed the bare word "fat" from the shortening entry |
| "vegetable emulsifier" showed "vegetable" as a separate food | Removed the bare word "vegetable" from the fruit and vegetable list |
| Brand names such as Lion bar, Tiger biscuits and Turtles chocolates would match predator animals | Animal names now need a food word ("turtle meat", "bear bile") |
| "Best before date" matched "dates" | The single word "date" was removed |
| Open Food Facts name search returned 503 errors | The app explains the problem and offers barcode or photo instead |
| A barcode typed into the search box showed "not enough information" | Barcodes now skip the name analysis and go straight to lookup |
| A photo of products without a visible ingredient list gave no answer, and only English labels worked | Lens-style recognition in any language, per-product verdicts, and multi-language on-device OCR (section 7) |

**Not yet tested**: the Claude features on the live claude.ai page, OCR accuracy on real phone photos, and installation on iPhone and Android home screens.

## 11. Deployment

- Source on GitHub: https://github.com/Sarana-F/Halal-Lens
- Any static host works. `vercel.json` sets caching for the service worker. No build step is needed on the host; `index.html` is committed.
- After editing `halal-lens.html`, run `node build.js` to regenerate `index.html`, then commit both.
- The service worker uses network-first caching, so updates appear on the next visit and the app still opens offline.

## 12. Known limitations

- The library cannot know how a specific factory sources E471, gelatin or enzymes; that is why "doubtful" exists and why certificates matter.
- Name search depends on Open Food Facts coverage, which is strongest for Europe and weaker for India and Mexico.
- OCR struggles with curved packs, small print and non-Latin scripts.
- Restaurant status on the hosted site comes from the links and the restaurant itself; there is no live halal database behind it.

## 13. Ideas for next versions

- A list of trusted certifiers per country, with links to their public registers.
- Hindi, Urdu, Arabic and Spanish interface translations.
- Community reports of verified products, with moderation.
- A small server so the hosted site can use AI photo reading without exposing any API key.
