# Halal Lens test plan

Every scenario has an ID. Automated tests use the same ID in their name, so a failing test points straight back to this list.

| How | Command | Cost |
|---|---|---|
| **Unit**: engine rulings, data integrity, server API | `npm test` | Free |
| **Browser (E2E)**: every screen on phone, tablet and desktop sizes, AI and product database faked | `npm run test:e2e` | Free |
| **Everything above** | `npm run test:all` | Free |
| **Live AI**: real AI calls through `api/ask.js` | `npm run test:live` (needs `GEMINI_API_KEY` or `ANTHROPIC_API_KEY`) | Free with Gemini; about $0.30 per run with Claude |
| **QA agent**: runs all free tests, then explores the manual scenarios and writes a report | In Claude Code: "use the halal-lens-qa agent to test the app" | Your Claude plan |
| **On GitHub**: unit + browser tests on every push; live AI only when started by hand | Actions tab | Free (public repo) |

## 1. Engine rulings (ENG) — `tests/engine.test.js`

About 130 table-driven cases. Groups:

| Group | What it proves |
|---|---|
| ENG-PRK | Pork, ham, bacon, lard and pork derivatives are haram, in English, Spanish, French, Hindi/Urdu and Arabic; turkey "ham" or beef salami is only doubtful; halal-labelled versions pass |
| ENG-ALC | Wine, beer, spirits and mirin are haram; alcohol-free beer is doubtful; vinegar, malt extract and ginger ale are halal; vanilla extract carries a caution unless alcohol-free; soy sauce and kombucha get the right caution |
| ENG-MEAT | Unlabelled meat is doubtful (slaughter unknown); halal/zabiha labels settle it; kosher gets a note; horse, frog and predators follow the schools and the hadith |
| ENG-SEA | Fish halal for all; prawns and shellfish follow each school (Hanafi vs others) |
| ENG-GEL | Gelatin and collagen: pork = haram, fish = halal, beef = doubtful, plant gelling agents = halal; gummies and marshmallows doubtful unless vegan or halal |
| ENG-INS | Carmine/E120 per school and in cosmetics; shellac, honey and beeswax halal; edible insects Maliki-only |
| ENG-DAI | Milk halal; cheese/whey per school; microbial rennet halal; enzymes doubtful unless microbial |
| ENG-ADD | Every way of writing an additive (E471, e-471, E 471, INS 471, "(471)", "(471, 322)", "500(ii)"); plant-origin notes; bone char, L-cysteine sources, flavourings |
| ENG-NEG | "No pork", "gelatin-free", "contains no alcohol" are not flagged; vegan, vegetarian and halal claims settle doubts; "not halal" is not read as halal; a halal claim with a haram ingredient is flagged as a contradiction |
| ENG-COS | Cosmetics context: perfume alcohol per school, fatty alcohols halal, carmine and chitosan on skin, placenta, keratin, snail mucin, nail polish and wudu |
| ENG-LANG | Spanish, French, Arabic and Hindi/Urdu label words; accents and capitals ignored |
| ENG-EDGE | Empty input, unknown brands, brand names that look like animals (Lion bar), "best before date", very long lists |

## 2. Data integrity (DAT) — `tests/data.test.js`

| ID | Check |
|---|---|
| DAT-01 | Every ingredient has a group, name, ruling, aliases, explanation and evidence |
| DAT-02 | Every ruling is one of h, n, d, m, x |
| DAT-03 | Every "schools differ" entry gives a ruling for all four schools |
| DAT-04 | Cosmetic overrides are valid and complete |
| DAT-05 | Every qualifier is a valid pattern with a valid ruling and a note |
| DAT-06 | Every evidence id used exists |
| DAT-07 | Qur'an references are real sura numbers (1–114) with a verse; hadith have a search phrase |
| DAT-08 | Aliases are lower-case, normalised and not empty |
| DAT-09 | No alias appears in two entries with different rulings |
| DAT-10 | Every ruling and verdict has a label |
| DAT-11 | Prompts ask for JSON and include the user's input safely trimmed |
| DAT-12 | Evidence links point to quran.com or sunnah.com |

## 3. Server API (API) — `tests/api.test.js` (Claude is faked; nothing is billed)

| ID | Check |
|---|---|
| API-01 | GET says whether AI is on |
| API-02 | POST without a key returns `server_off` |
| API-03 | Other websites are refused (403) |
| API-04 | Unknown tasks are refused |
| API-05 | Non-image uploads are refused |
| API-06 | Photos over 4 MB are refused with `too_large` |
| API-07 | Missing product or restaurant name is refused |
| API-08 | Methods other than GET/POST get 405 |
| API-09 | Inputs are trimmed (200 / 120 characters) |
| API-10 | A JSON body sent as text is still read |
| API-11 | The request to Claude uses the configured model, effort, refusal fallbacks, and puts the photo before the instructions |
| API-12 | A good answer is returned as `result` |
| API-13 | A refusal returns `refused` (422) |
| API-14 | A non-JSON answer returns `invalid_json` |
| API-15 | A rejected key returns `server_off` |
| API-16 | Out of credit (402) returns `no_credit` |
| API-17 | Claude rate limit returns `rate_limited` |
| API-18 | A rejected image returns `image_rejected` |
| API-19 | Other Claude errors and network failures return `upstream_error` |
| API-20 | More than 30 requests in 10 minutes from one visitor are refused |
| API-21 | JSON parsing accepts bare, fenced and embedded JSON |
| API-22 | With only `GEMINI_API_KEY`, GET reports the free Gemini provider |
| API-23 | Gemini request: model, key sent in a header (never the URL), photo before instructions, JSON answer requested |
| API-24 | When one Gemini model's free allowance is used up (429), the next model answers |
| API-25 | When every free allowance is used up, visitors get `rate_limited` with a clear message |
| API-26 | A Gemini model not offered to the key (404) is skipped |
| API-27 | An invalid or blocked Gemini key returns `server_off` |
| API-28 | Blocked prompts and safety stops return `refused` |
| API-29 | A photo Gemini cannot use returns `image_rejected` |
| API-30 | Network failures and Gemini server errors return `upstream_error` |
| API-31 | A non-JSON Gemini answer returns `invalid_json` |
| API-32 | `GEMINI_MODEL` goes first; with both keys Claude is used unless `HL_PROVIDER=gemini` |

## 4. Browser tests (E2E) — `tests/e2e/*.spec.js`

Run on a phone (Pixel 7 size), a tablet and a desktop browser. Open Food Facts, Claude and on-device OCR are faked so results are repeatable.

| ID | Scenario | Expected |
|---|---|---|
| SMK-01 | Open the app | Title "Halal Lens", worked example verdict shown, no console errors |
| SMK-02 | Switch tabs; open `#learn` directly | Each tab shows its panel; the link opens Learn |
| SMK-03 | Widths 320, 375, 768, 1280 | No sideways scrolling on any tab |
| CHK-01 | Paste an ingredient list | Verdict card, "Why" list with the flagged items |
| CHK-02 | Shrimp under All schools, Hanafi, Shafi'i | Differs, Doubtful, Halal |
| CHK-03 | "Alcohol denat." as food vs cosmetics (Hanafi) | Haram vs Halal |
| CHK-04 | Tap an example chip | The example is checked |
| CHK-05 | Search, reload | The search appears under Recent |
| CHK-06 | Enter on a short name; Shift+Enter | Enter checks; Shift+Enter adds a line |
| CHK-07 | Open a flagged ingredient | Position of each school, evidence with quran.com / sunnah.com links |
| CHK-08 | Unknown words in a list | Shown under "Not recognised" |
| CHK-09 | Press Check with an empty box | Nothing breaks, the box is focused |
| CHK-10 | Change type and school, reload | Both are remembered |
| CHK-11 | List with a halal mark | "Halal certified", "Halal mark found" tag |
| CHK-12 | Dates and honey | "Blessings" section with the benefit and evidence |
| PRD-01 | Type a barcode | Product found, tap it, full report |
| PRD-02 | Type a product name | Matching products with country, each with a verdict |
| PRD-03 | Product database busy | Message suggests barcode or photo |
| PRD-04 | AI on, unknown product | Claude card runs by itself and shows a typical-recipe report |
| PRD-05 | AI does not know the product | Message and a button that opens the scanner |
| PRD-06 | AI rate-limited | Message and a working "Try again" |
| PRD-07 | "is kitkat halal?" | Treated as the product name "kitkat" |
| PRD-08 | Free Gemini option on | The lookup names Gemini, never Claude |
| SCN-01 | No AI available | Language picker shown; on-device reading explained |
| SCN-02 | Photo, on-device reading | Text read, verdict shown, OCR note |
| SCN-03 | Edit the text, Check again | Verdict updates |
| SCN-04 | Pick Arabic | OCR runs with "eng+ara" |
| SCN-05 | AI: photo of an ingredient list | One product, "Read from the label" |
| SCN-06 | AI: several products | List of products, the most serious opened first, tapping another switches |
| SCN-07 | AI: product without an ingredient list | "Usual ingredients" note and Claude's notes |
| SCN-08 | AI: blurry photo | Friendly message, text box available |
| SCN-09 | AI: halal logo visible | "Halal certified" |
| SCN-10 | AI switched off or out of credit | Falls back to on-device reading |
| SCN-11 | Photo upload size | Sent as a JPEG of at most 1600 px |
| SCN-12 | Paste an image in the Scan tab | It is scanned |
| SCN-13 | Free mode: photo of a barcode, on a browser with no built-in barcode reader (iPhone) | Barcode read, product found in Open Food Facts, full report |
| SCN-14 | Free Gemini option on | The scanner names Gemini |
| RST-01 | Names with bar, ramen, halal, kosher, vegan | Matching first impressions |
| RST-02 | Links | Google Maps, Google, Zabihah, certificate, contact, Apple Maps; correct encoded addresses; open in a new tab |
| RST-03 | Message and Copy | Message names the restaurant; button says "Copied" |
| RST-04 | WhatsApp | Link carries the encoded message |
| RST-05 | AI on, known chain | Status pill, summary, official website link |
| RST-06 | AI on, unknown restaurant | "No reliable information" message |
| RST-07 | Empty name | Field focused, nothing shown |
| RST-08 | Outside the Claude desktop app | No live web check card |
| RST-09 | Free Gemini option on | The card is titled "What Gemini knows" |
| LRN-01 | Principles | Nine principles, each with evidence |
| LRN-02 | Library search "E471", "carmine" | Matching entries |
| LRN-03 | Filter Haram | Only haram entries |
| LRN-04 | School Hanafi, search shrimp | Shown as Doubtful |
| LRN-05 | Search nonsense | "Nothing matches" |
| PWA-01 | Manifest | Valid, with name, icons and start page |
| PWA-02 | Offline | After one visit the app reloads with no connection |
| PWA-03 | Icon | Served as SVG |
| UI-01 | Dark mode | Dark colours |
| UI-02 | Light mode | Light colours |
| UI-03 | Verdict colours | Haram and Halal look different |
| A11Y-01 | Automated accessibility scan of every tab | No serious or critical problems |
| A11Y-02 | Form controls | Every control has a label |
| A11Y-03 | Keyboard only | Reach and press Check; focus is visible |
| SEC-01 | Type `<img src=x onerror=alert(1)>` | Shown as text, never run |
| PERF-01 | Load and check speed | Ready in under 3 s locally; a 300-item list checks in under 200 ms |

## 5. Live AI (LIVE) — `tests/live/live-ai.test.js`, started by hand (free with a Gemini key)

| ID | Scenario | Expected |
|---|---|---|
| LIVE-01 | Product "Nutella" | Known, ingredient list returned, engine verdict produced |
| LIVE-02 | Restaurant "KFC", "Kuala Lumpur" | Known chain, a status, no invented phone number |
| LIVE-03 | Photo of a Spanish label with "grenetina" | Read, translated, gelatin flagged |
| LIVE-04 | Photo of an Arabic label with beef gelatin | Read, translated, gelatin flagged |
| LIVE-05 | Photo of a pack front with no ingredient list (liqueur chocolates) | Product recognised, typical recipe contains alcohol, verdict Haram |
| LIVE-06 | Made-up product | `known: false`, nothing invented |

## 6. Manual and exploratory (MAN) — done by the QA agent or a person

| ID | Scenario |
|---|---|
| MAN-01 | Install on a real Android phone and iPhone (Add to Home Screen); open offline |
| MAN-02 | Real camera photos: curved bottles, glare, small print, multilingual packs |
| MAN-03 | claude.ai version: permission dialog for Claude and for photos, decline and allow |
| MAN-04 | Live web check in the Claude desktop app finds halal mentions and contact details |
| MAN-05 | A knowledgeable person reviews 20 random rulings and their evidence |
| MAN-06 | Vercel: add `ANTHROPIC_API_KEY`, redeploy, AI scanning switches on; remove it, app falls back |
| MAN-07 | Slow 3G and flaky network: clear messages, nothing hangs |
| MAN-08 | Very long or odd input: emoji, numbers only, 5,000-word paste |
| MAN-09 | Evidence links open the right verse or hadith search |
| MAN-10 | Share the artifact link with a colleague who has Claude |

## Reporting a bug

Give the scenario ID, what you did, what you expected, what happened, the device and browser, and a screenshot. The QA agent writes its findings to `test-results/QA-REPORT.md` in this format.
