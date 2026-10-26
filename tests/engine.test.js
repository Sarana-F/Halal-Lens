// Engine regression tests. Run from the project folder: node tests/engine.test.js
global.window = global;
const path = require('path');
for (const f of ['evidence.js', 'ing-core.js', 'ing-additives.js', 'ing-plant-cosmetic.js', 'engine.js']) require(path.join(__dirname, '..', f));

// [label text, context, school ('' = all schools), expected verdict]
const CASES = [
  ['Glucose syrup, sugar, gelatine, dextrose, citric acid, flavouring, colour (E120)', 'food', '', 'd'],
  ['Sugar, cocoa butter, whole milk powder, cocoa mass, emulsifier (soy lecithin), vanilla extract', 'food', '', 'n'],
  ['Refined wheat flour (maida), sugar, edible vegetable oil (palm), raising agents (503(ii), 500(ii)), emulsifiers (471, 322), salt', 'food', '', 'd'],
  ['Wheat flour, sugar, vegetable emulsifier (471), salt', 'food', '', 'h'],
  ['Sugar, palm oil, hazelnuts (13%), skimmed milk powder (8.7%), fat-reduced cocoa (7.4%), emulsifier: lecithins (soya), vanillin', 'food', '', 'h'],
  ['shrimp, wheat flour, salt', 'food', '', 'm'],
  ['shrimp, wheat flour, salt', 'food', 'hn', 'd'],
  ['shrimp, wheat flour, salt', 'food', 'sh', 'h'],
  ['crab sticks', 'food', 'hn', 'x'],
  ['Alcohol denat., aqua, parfum', 'cosmetic', 'hn', 'h'],
  ['Alcohol denat., aqua, parfum', 'cosmetic', 'sh', 'd'],
  ['Castor oil, carmine, beeswax, lanolin', 'cosmetic', '', 'h'],
  ['Aqua, cetearyl alcohol, olive oil', 'cosmetic', '', 'h'],
  ['alcohol-free beer', 'food', '', 'd'],
  ['red wine', 'food', '', 'x'],
  ['pork free, gelatin free, sugar, pectin', 'food', '', 'h'],
  ['Halal certified chicken nuggets: chicken, wheat flour, salt', 'food', '', 'hc'],
  ['gelatin (pork), sugar', 'food', '', 'x'],
  ['fish sauce, gelatin', 'food', '', 'd'],
  ['fish gelatin, sugar', 'food', '', 'h'],
  ['red wine vinegar, olive oil', 'food', '', 'h'],
  ['E 471, INS 920', 'food', '', 'd'],
  ['beef salami', 'food', '', 'd'],
  ['ginger ale', 'food', '', 'h'],
  ['Lion bar', 'food', '', 'u'],
  ['soy lecithin, mirin', 'food', '', 'x'],
  // What the photo scanner passes on when it recognises a product but sees no ingredient list
  ['liqueur-filled chocolate bottles', 'food', '', 'x'],
  ['milk chocolate (sugar, cocoa butter, milk powder), bourbon whiskey 15%, sugar syrup', 'food', '', 'x'],
  ['sugar, glucose syrup, gelatine, citric acid; halal certified (JAKIM)', 'food', '', 'hc']
];

let fail = 0;
for (const [text, ctx, school, want] of CASES) {
  const r = HL.analyze(text, { ctx, school });
  const ok = r.verdict === want;
  if (!ok) fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + want.padEnd(2) + ' got ' + r.verdict.padEnd(2) + '  ' + text.slice(0, 70) + (school ? '  [' + school + ']' : ''));
}
// Every evidence id used by an ingredient must exist.
for (const e of HL.ING) for (const id of e.e.split(' ')) if (!HL.EV[id]) { fail++; console.log('FAIL missing evidence ' + id + ' in ' + e.n); }

console.log('\n' + (CASES.length - (fail > CASES.length ? CASES.length : fail)) + '/' + CASES.length + ' cases passed');
process.exit(fail ? 1 : 0);
