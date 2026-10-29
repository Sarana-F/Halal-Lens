// Engine rulings (TEST-PLAN.md section 1). Run: node tests/engine.test.js
// Each case: [id, label text, context, school ('' = all schools), expected verdict]
// Verdicts: h halal · hc halal certified · n halal with a note · m schools differ · d doubtful · x haram · u not enough information
global.window = global;
const path = require('path');
for (const f of ['evidence.js', 'ing-core.js', 'ing-additives.js', 'ing-plant-cosmetic.js', 'engine.js']) require(path.join(__dirname, '..', f));

const F = 'food', C = 'cosmetic';
const CASES = [
  // Pork
  ['ENG-PRK-01', 'pork, salt', F, '', 'x'],
  ['ENG-PRK-02', 'bacon bits', F, '', 'x'],
  ['ENG-PRK-03', 'turkey bacon', F, '', 'd'],
  ['ENG-PRK-04', 'lard', F, '', 'x'],
  ['ENG-PRK-05', 'sodium lardate, aqua', C, '', 'x'],
  ['ENG-PRK-06', 'pepperoni', F, '', 'd'],
  ['ENG-PRK-07', 'halal pepperoni', F, '', 'hc'],
  ['ENG-PRK-08', 'chicken sausage', F, '', 'd'],
  ['ENG-PRK-09', 'vegetarian sausage (soy protein)', F, '', 'h'],
  ['ENG-PRK-10', 'manteca de cerdo, harina', F, '', 'x'],
  ['ENG-PRK-11', 'gelatina de cerdo', F, '', 'x'],
  ['ENG-PRK-12', 'porcine collagen', C, '', 'x'],
  ['ENG-PRK-13', 'pepsin', F, '', 'd'],
  ['ENG-PRK-14', 'jamón serrano', F, '', 'x'],
  ['ENG-PRK-15', 'خنزير', F, '', 'x'],
  ['ENG-PRK-16', 'PORK GELATIN', F, '', 'x'],
  ['ENG-PRK-17', 'suar ki charbi', F, '', 'x'],
  // Alcohol
  ['ENG-ALC-01', 'red wine', F, '', 'x'],
  ['ENG-ALC-02', 'beer battered fish', F, '', 'x'],
  ['ENG-ALC-03', 'rum raisin ice cream', F, '', 'd'],
  ['ENG-ALC-04', 'alcohol-free beer', F, '', 'd'],
  ['ENG-ALC-05', 'non-alcoholic wine', F, '', 'd'],
  ['ENG-ALC-06', 'vanilla extract', F, '', 'n'],
  ['ENG-ALC-07', 'sugar, vanilla extract (alcohol free)', F, '', 'h'],
  ['ENG-ALC-08', 'ethanol', F, '', 'x'],
  ['ENG-ALC-09', 'alcohol denat., aqua', C, '', 'm'],
  ['ENG-ALC-10', 'alcohol denat., aqua', C, 'hn', 'h'],
  ['ENG-ALC-11', 'alcohol denat., aqua', C, 'sh', 'd'],
  ['ENG-ALC-12', 'alcohol denat., aqua', C, 'mk', 'd'],
  ['ENG-ALC-13', 'alcohol denat., aqua', C, 'hb', 'd'],
  ['ENG-ALC-14', 'wine vinegar, balsamic vinegar', F, '', 'h'],
  ['ENG-ALC-15', 'soy sauce', F, '', 'n'],
  ['ENG-ALC-16', 'soy sauce (water, soybeans, wheat, salt, alcohol)', F, '', 'x'],
  ['ENG-ALC-17', 'kombucha', F, '', 'n'],
  ['ENG-ALC-18', 'hard kombucha', F, '', 'x'],
  ['ENG-ALC-19', 'mirin', F, '', 'x'],
  ['ENG-ALC-20', 'mirin style seasoning', F, '', 'd'],
  ['ENG-ALC-21', 'ginger beer', F, '', 'h'],
  ['ENG-ALC-22', 'alcoholic ginger beer', F, '', 'x'],
  ['ENG-ALC-23', 'apple cider vinegar', F, '', 'h'],
  ['ENG-ALC-24', 'cider', F, '', 'd'],
  ['ENG-ALC-25', "brewer's yeast", F, '', 'd'],
  ['ENG-ALC-26', 'malt extract', F, '', 'h'],
  ['ENG-ALC-27', 'liqueur-filled chocolate bottles', F, '', 'x'],
  ['ENG-ALC-28', 'chocolate liqueur', F, '', 'x'],
  ['ENG-ALC-29', 'cocoa liquor, sugar', F, '', 'h'],
  ['ENG-ALC-30', 'rice wine vinegar', F, '', 'h'],
  ['ENG-ALC-31', 'milk chocolate (sugar, cocoa butter, milk powder), bourbon whiskey 15%, sugar syrup', F, '', 'x'],
  // Meat
  ['ENG-MEAT-01', 'chicken', F, '', 'd'],
  ['ENG-MEAT-02', 'halal chicken', F, '', 'hc'],
  ['ENG-MEAT-03', 'zabiha beef', F, '', 'hc'],
  ['ENG-MEAT-04', 'kosher beef', F, '', 'n'],
  ['ENG-MEAT-05', 'chicken flavour seasoning', F, '', 'd'],
  ['ENG-MEAT-06', 'beef tallow', F, '', 'd'],
  ['ENG-MEAT-07', 'vegetable shortening', F, '', 'h'],
  ['ENG-MEAT-08', 'shortening', F, '', 'd'],
  ['ENG-MEAT-09', 'horse meat', F, '', 'm'],
  ['ENG-MEAT-10', 'horse meat', F, 'hn', 'd'],
  ['ENG-MEAT-11', 'horse meat', F, 'sh', 'h'],
  ['ENG-MEAT-12', 'rabbit', F, '', 'd'],
  ['ENG-MEAT-13', 'donkey meat', F, '', 'x'],
  ['ENG-MEAT-14', 'black pudding', F, '', 'x'],
  ['ENG-MEAT-15', 'frog legs', F, '', 'm'],
  ['ENG-MEAT-16', 'frog legs', F, 'mk', 'd'],
  ['ENG-MEAT-17', 'frog legs', F, 'hn', 'x'],
  ['ENG-MEAT-18', 'chicken liver', F, '', 'd'],
  ['ENG-MEAT-19', 'beef mince', F, '', 'd'],
  // Seafood
  ['ENG-SEA-01', 'tuna, fish oil, anchovies', F, '', 'h'],
  ['ENG-SEA-02', 'shrimp', F, '', 'm'],
  ['ENG-SEA-03', 'shrimp', F, 'hn', 'd'],
  ['ENG-SEA-04', 'shrimp', F, 'sh', 'h'],
  ['ENG-SEA-05', 'shrimp', F, 'mk', 'h'],
  ['ENG-SEA-06', 'shrimp', F, 'hb', 'h'],
  ['ENG-SEA-07', 'crab', F, '', 'm'],
  ['ENG-SEA-08', 'crab', F, 'hn', 'x'],
  ['ENG-SEA-09', 'crab', F, 'sh', 'h'],
  ['ENG-SEA-10', 'oyster sauce', F, 'hn', 'x'],
  ['ENG-SEA-11', 'chitosan', C, '', 'h'],
  ['ENG-SEA-12', 'fish gelatin, isinglass', F, '', 'h'],
  // Gelatin, collagen and gelled sweets
  ['ENG-GEL-01', 'gelatin', F, '', 'd'],
  ['ENG-GEL-02', 'beef gelatin', F, '', 'd'],
  ['ENG-GEL-03', 'bovine gelatine', F, '', 'd'],
  ['ENG-GEL-04', 'halal gelatin', F, '', 'hc'],
  ['ENG-GEL-05', 'pork gelatin', F, '', 'x'],
  ['ENG-GEL-06', 'gelatin (pork), sugar', F, '', 'x'],
  ['ENG-GEL-07', 'agar, pectin', F, '', 'h'],
  ['ENG-GEL-08', 'grenetina', F, '', 'd'],
  ['ENG-GEL-09', 'collagen peptides', F, '', 'd'],
  ['ENG-GEL-10', 'marine collagen', F, '', 'h'],
  ['ENG-GEL-11', 'gummy bears', F, '', 'd'],
  ['ENG-GEL-12', 'vegan gummy bears', F, '', 'h'],
  ['ENG-GEL-13', 'marshmallows', F, '', 'd'],
  ['ENG-GEL-14', 'tiramisu', F, '', 'd'],
  ['ENG-GEL-15', 'fish sauce, gelatin', F, '', 'd'],
  ['ENG-GEL-16', 'pork-free gelatin', F, '', 'd'],
  // Insects and bee products
  ['ENG-INS-01', 'carmine', F, '', 'm'],
  ['ENG-INS-02', 'carmine', F, 'mk', 'h'],
  ['ENG-INS-03', 'E120', F, 'hn', 'x'],
  ['ENG-INS-04', 'cochineal', C, '', 'h'],
  ['ENG-INS-05', 'shellac, E904', F, '', 'h'],
  ['ENG-INS-06', 'cricket flour', F, '', 'm'],
  ['ENG-INS-07', 'cricket flour', F, 'mk', 'h'],
  ['ENG-INS-08', 'honey, beeswax', F, '', 'h'],
  ['ENG-INS-09', 'locust', F, '', 'h'],
  // Dairy and eggs
  ['ENG-DAI-01', 'milk, sugar', F, '', 'h'],
  ['ENG-DAI-02', 'cheese', F, '', 'm'],
  ['ENG-DAI-03', 'cheese', F, 'hn', 'h'],
  ['ENG-DAI-04', 'cheese', F, 'sh', 'd'],
  ['ENG-DAI-05', 'cheese (microbial rennet)', F, '', 'h'],
  ['ENG-DAI-06', 'whey powder', F, '', 'm'],
  ['ENG-DAI-07', 'enzymes', F, '', 'd'],
  ['ENG-DAI-08', 'microbial enzymes', F, '', 'h'],
  ['ENG-DAI-09', 'lactose', F, '', 'n'],
  ['ENG-DAI-10', 'egg', F, '', 'h'],
  // Additives written every way
  ['ENG-ADD-01', 'E471', F, '', 'd'],
  ['ENG-ADD-02', 'e-471', F, '', 'd'],
  ['ENG-ADD-03', 'E 471', F, '', 'd'],
  ['ENG-ADD-04', 'INS 471', F, '', 'd'],
  ['ENG-ADD-05', 'emulsifier (471)', F, '', 'd'],
  ['ENG-ADD-06', 'emulsifiers (471, 322)', F, '', 'd'],
  ['ENG-ADD-07', 'vegetable mono- and diglycerides', F, '', 'h'],
  ['ENG-ADD-08', 'mono and diglycerides of fatty acids (plant origin)', F, '', 'h'],
  ['ENG-ADD-09', 'glycerin', F, '', 'd'],
  ['ENG-ADD-10', 'vegetable glycerin', F, '', 'h'],
  ['ENG-ADD-11', 'magnesium stearate', F, '', 'd'],
  ['ENG-ADD-12', 'polysorbate 80', F, '', 'd'],
  ['ENG-ADD-13', 'E542', F, '', 'd'],
  ['ENG-ADD-14', 'sugar (bone char filtered)', F, '', 'n'],
  ['ENG-ADD-15', 'L-cysteine', F, '', 'd'],
  ['ENG-ADD-16', 'L-cysteine (human hair)', F, '', 'x'],
  ['ENG-ADD-17', 'E920 (synthetic)', F, '', 'h'],
  ['ENG-ADD-18', 'E631, disodium inosinate', F, '', 'n'],
  ['ENG-ADD-19', 'E1000', F, '', 'd'],
  ['ENG-ADD-20', 'E322, E476, E330, E621, E150d, E100, E171', F, '', 'h'],
  ['ENG-ADD-21', 'raising agents (500(ii), 450(i))', F, '', 'h'],
  ['ENG-ADD-22', 'natural flavouring', F, '', 'n'],
  ['ENG-ADD-23', 'natural beef flavour', F, '', 'd'],
  ['ENG-ADD-24', 'E160a', F, '', 'n'],
  ['ENG-ADD-25', 'vitamin d3', F, '', 'n'],
  ['ENG-ADD-26', 'vitamin d3 (lichen)', F, '', 'h'],
  ['ENG-ADD-27', 'Refined wheat flour (maida), sugar, edible vegetable oil (palm), raising agents (503(ii), 500(ii)), emulsifiers (471, 322), salt', F, '', 'd'],
  ['ENG-ADD-28', 'Wheat flour, sugar, vegetable emulsifier (471), salt', F, '', 'h'],
  ['ENG-ADD-29', 'E 471, INS 920', F, '', 'd'],
  // Negations and label claims
  ['ENG-NEG-01', 'no pork, no lard', F, '', 'u'],
  ['ENG-NEG-02', 'gelatin-free', F, '', 'u'],
  ['ENG-NEG-03', 'contains no alcohol, sugar', F, '', 'h'],
  ['ENG-NEG-04', 'suitable for vegetarians: sugar, whey', F, '', 'h'],
  ['ENG-NEG-05', 'vegan: sugar, E471', F, '', 'h'],
  ['ENG-NEG-06', 'halal certified: sugar, gelatin', F, '', 'hc'],
  ['ENG-NEG-07', 'halal certified: pork', F, '', 'x'],
  ['ENG-NEG-08', 'not halal: chicken', F, '', 'x'],
  ['ENG-NEG-14', 'not halal certified: chicken', F, '', 'd'],
  ['ENG-NEG-15', 'Non-halal: sugar', F, '', 'x'],
  ['ENG-NEG-09', 'kosher: sugar, beef gelatin', F, '', 'd'],
  ['ENG-NEG-10', 'pork free, gelatin free, sugar, pectin', F, '', 'h'],
  ['ENG-NEG-11', 'Halal certified chicken nuggets: chicken, wheat flour, salt', F, '', 'hc'],
  ['ENG-NEG-12', 'sugar, glucose syrup, gelatine, citric acid; halal certified (JAKIM)', F, '', 'hc'],
  // Cosmetics context
  ['ENG-COS-01', 'carmine', C, '', 'h'],
  ['ENG-COS-02', 'olive oil, shea butter', C, '', 'h'],
  ['ENG-COS-03', 'snail mucin', C, '', 'n'],
  ['ENG-COS-04', 'placenta extract', C, '', 'd'],
  ['ENG-COS-05', 'human placenta', C, '', 'x'],
  ['ENG-COS-06', 'plant placenta', C, '', 'h'],
  ['ENG-COS-07', 'keratin', C, '', 'd'],
  ['ENG-COS-08', 'hydrolyzed keratin (wool)', C, '', 'h'],
  ['ENG-COS-09', 'nail polish', C, '', 'n'],
  ['ENG-COS-10', 'henna, kohl, musk, miswak', C, '', 'h'],
  ['ENG-COS-11', 'mink oil', C, '', 'x'],
  ['ENG-COS-12', 'aqua, cetyl alcohol, benzyl alcohol, olive oil', C, '', 'h'],
  ['ENG-COS-13', 'glycerin', C, '', 'd'],
  ['ENG-COS-14', 'Castor oil, carmine, beeswax, lanolin', C, '', 'h'],
  // Other languages
  ['ENG-LANG-01', 'azúcar, cacao, leche', F, '', 'h'],
  ['ENG-LANG-02', 'sucre, lait', F, '', 'h'],
  ['ENG-LANG-03', 'عسل', F, '', 'h'],
  ['ENG-LANG-04', 'حلال', F, '', 'hc'],
  ['ENG-LANG-05', 'grenetina, azúcar', F, '', 'd'],
  ['ENG-LANG-06', 'schweinefleisch', F, '', 'x'],
  ['ENG-LANG-07', 'cerveza', F, '', 'x'],
  // Edge cases
  ['ENG-EDGE-01', '', F, '', 'u'],
  ['ENG-EDGE-02', 'Haribo Goldbears', F, '', 'u'],
  ['ENG-EDGE-03', 'KitKat', F, '', 'u'],
  ['ENG-EDGE-04', 'Lion bar', F, '', 'u'],
  ['ENG-EDGE-05', 'Tiger biscuits', F, '', 'u'],
  ['ENG-EDGE-06', 'Turtles chocolate', F, '', 'h'],
  ['ENG-EDGE-07', 'best before date', F, '', 'u'],
  ['ENG-EDGE-08', 'Ingredients: sugar, cocoa butter. May contain traces of milk.', F, '', 'h'],
  ['ENG-EDGE-09', 'tobacco', F, '', 'x'],
  ['ENG-EDGE-10', 'energy drink', F, '', 'n'],
  ['ENG-EDGE-11', 'water', F, '', 'h'],
  ['ENG-EDGE-12', 'peanut butter', F, '', 'h'],
  ['ENG-EDGE-13', 'dates, honey', F, '', 'h'],
  ['ENG-EDGE-14', 'Sugar, palm oil, hazelnuts (13%), skimmed milk powder (8.7%), fat-reduced cocoa (7.4%), emulsifier: lecithins (soya), vanillin', F, '', 'h']
];

let fail = 0;
const seen = new Set();
for (const [id, text, ctx, school, want] of CASES) {
  if (seen.has(id)) { fail++; console.log('FAIL duplicate id ' + id); }
  seen.add(id);
  const r = HL.analyze(text, { ctx, school });
  const ok = r.verdict === want;
  if (!ok) {
    fail++;
    console.log('FAIL ' + id + '  want ' + want + ' got ' + r.verdict + '  "' + text + '"' + (school ? ' [' + school + ']' : '') + (ctx === C ? ' [cosmetic]' : ''));
    console.log('       hits: ' + r.hits.map((h) => h.s + ':' + h.entry.n + (h.note ? ' (' + h.note + ')' : '')).join(' | '));
  }
}

// Extra behaviour checks
function check(id, ok, msg) { if (!ok) { fail++; console.log('FAIL ' + id + '  ' + msg); } }
check('ENG-NEG-13', HL.analyze('halal certified: pork', { ctx: F }).contradiction === true, 'halal claim with pork should be flagged as a contradiction');
check('ENG-EDGE-15', HL.analyze('sugar, wheat flour, xanthomonas extract', { ctx: F }).unknown.includes('xanthomonas extract'), 'unknown items should be listed');
const big = Array.from({ length: 300 }, (_, i) => ['sugar', 'salt', 'e471', 'gelatin', 'cocoa butter', 'xyz' + i][i % 6]).join(', ');
const t0 = Date.now(); HL.analyze(big, { ctx: F }); HL.analyze(big, { ctx: F }); const ms = (Date.now() - t0) / 2;
check('PERF-01', ms < 200, '300-item list took ' + ms + ' ms (limit 200)');

const total = CASES.length + 3;
console.log((total - fail) + '/' + total + ' engine checks passed');
process.exit(fail ? 1 : 0);
