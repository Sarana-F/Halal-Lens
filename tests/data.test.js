// Data integrity (TEST-PLAN.md section 2). Run: node tests/data.test.js
global.window = global;
const path = require('path');
for (const f of ['evidence.js', 'ing-core.js', 'ing-additives.js', 'ing-plant-cosmetic.js', 'engine.js']) require(path.join(__dirname, '..', f));
const PROMPTS = require(path.join(__dirname, '..', 'prompts.js'));

const RULINGS = ['h', 'n', 'd', 'm', 'x'];
const SCHOOLS = ['hn', 'sh', 'mk', 'hb'];
const problems = {};
function bad(id, msg) { (problems[id] = problems[id] || []).push(msg); }
function light(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }

const aliasOwner = new Map();
for (const e of HL.ING) {
  const who = e.n || '(no name)';
  // DAT-01 required fields
  for (const k of ['g', 'n', 's', 'a', 'w', 'e']) if (!e[k] || typeof e[k] !== 'string') bad('DAT-01', who + ' is missing "' + k + '"');
  // DAT-02 ruling values
  if (!RULINGS.includes(e.s)) bad('DAT-02', who + ' has ruling "' + e.s + '"');
  // DAT-03 school maps
  if (e.s === 'm') {
    if (!e.m) bad('DAT-03', who + ' differs by school but has no school map');
    else for (const k of SCHOOLS) if (!RULINGS.includes(e.m[k]) || e.m[k] === 'm') bad('DAT-03', who + ' has no clear ruling for ' + k);
  } else if (e.m) bad('DAT-03', who + ' has a school map but is not marked "m"');
  // DAT-04 cosmetic overrides
  if (e.cs !== undefined) {
    if (!RULINGS.includes(e.cs)) bad('DAT-04', who + ' has cosmetic ruling "' + e.cs + '"');
    if (e.cs === 'm' && (!e.cm || SCHOOLS.some((k) => !RULINGS.includes(e.cm[k])))) bad('DAT-04', who + ' cosmetic school map incomplete');
    if (!e.cw) bad('DAT-04', who + ' has a cosmetic ruling but no cosmetic explanation');
  }
  // DAT-05 qualifiers
  for (const q of e.q || []) {
    try { new RegExp('\\b(?:' + q[0] + ')'); } catch (err) { bad('DAT-05', who + ' qualifier "' + q[0] + '" is not a valid pattern'); }
    if (!RULINGS.includes(q[1]) || q[1] === 'm') bad('DAT-05', who + ' qualifier "' + q[0] + '" has ruling "' + q[1] + '"');
    if (!q[2]) bad('DAT-05', who + ' qualifier "' + q[0] + '" has no note');
  }
  // DAT-06 evidence ids
  for (const id of String(e.e).split(' ')) if (!HL.EV[id]) bad('DAT-06', who + ' cites unknown evidence "' + id + '"');
  // DAT-08 / DAT-09 aliases
  for (const raw of String(e.a).split('|')) {
    if (!raw.trim()) { bad('DAT-08', who + ' has an empty alias'); continue; }
    if (raw !== 'naw_drink' && light(raw) !== raw.replace(/\s+/g, ' ').trim() && light(raw) !== light(raw.toLowerCase())) bad('DAT-08', who + ' alias "' + raw + '" is not normalised');
    if (raw !== raw.toLowerCase()) bad('DAT-08', who + ' alias "' + raw + '" is not lower-case');
    const key = raw === 'naw_drink' ? raw : light(raw);
    const prev = aliasOwner.get(key);
    if (prev && prev.s !== e.s && prev !== e) bad('DAT-09', '"' + key + '" is in "' + prev.n + '" (' + prev.s + ') and "' + who + '" (' + e.s + ')');
    if (!prev) aliasOwner.set(key, e);
  }
}

// DAT-07 / DAT-12 evidence library
for (const [id, ev] of Object.entries(HL.EV)) {
  if (!['q', 'h', 's'].includes(ev[0])) bad('DAT-07', id + ' has type "' + ev[0] + '"');
  if (!ev[2] || ev[2].length < 10) bad('DAT-07', id + ' has no text');
  if (ev[0] === 'q') {
    const m = /^(\d{1,3}):(\d{1,3})$/.exec(ev[1]);
    if (!m || +m[1] < 1 || +m[1] > 114 || +m[2] < 1) bad('DAT-07', id + ' has an invalid Qur\'an reference "' + ev[1] + '"');
    if (!/^https:\/\/quran\.com\/\d+\/\d+$/.test(HL.evLink(id) || '')) bad('DAT-12', id + ' link is wrong: ' + HL.evLink(id));
  }
  if (ev[0] === 'h') {
    if (!ev[3]) bad('DAT-07', id + ' has no sunnah.com search phrase');
    if (!/^https:\/\/sunnah\.com\/search\?q=/.test(HL.evLink(id) || '')) bad('DAT-12', id + ' link is wrong');
  }
  if (ev[0] === 's' && HL.evLink(id) !== null) bad('DAT-12', id + ' scholarly note should have no link');
}

// DAT-10 labels
for (const s of ['h', 'hc', 'n', 'm', 'd', 'x', 'u']) if (!HL.STATUS[s] || !HL.STATUS[s].label || !HL.STATUS[s].short) bad('DAT-10', 'no label for ' + s);
for (const k of SCHOOLS) if (!HL.SCHOOLS[k]) bad('DAT-10', 'no name for school ' + k);

// DAT-11 prompts
const longName = 'x'.repeat(1000);
const pr = [PROMPTS.scan({ ctx: 'food' }), PROMPTS.product({ q: longName, ctx: 'cosmetic' }), PROMPTS.restaurant({ name: longName, city: '' })];
pr.forEach((p, i) => { if (typeof p !== 'string' || !/JSON/.test(p)) bad('DAT-11', 'prompt ' + i + ' does not ask for JSON'); });
if (pr[1].includes('x'.repeat(201))) bad('DAT-11', 'product prompt does not trim the name');
if (pr[2].includes('x'.repeat(121))) bad('DAT-11', 'restaurant prompt does not trim the name');
if (!/cosmetics/.test(pr[1])) bad('DAT-11', 'product prompt ignores the cosmetics category');
if (!/any language/i.test(pr[0])) bad('DAT-11', 'scan prompt must ask for any language');

const IDS = ['DAT-01', 'DAT-02', 'DAT-03', 'DAT-04', 'DAT-05', 'DAT-06', 'DAT-07', 'DAT-08', 'DAT-09', 'DAT-10', 'DAT-11', 'DAT-12'];
let fail = 0;
for (const id of IDS) {
  const list = problems[id] || [];
  if (list.length) { fail++; console.log('FAIL ' + id + ' (' + list.length + ')\n  - ' + list.slice(0, 12).join('\n  - ')); }
  else console.log('PASS ' + id);
}
console.log((IDS.length - fail) + '/' + IDS.length + ' data checks passed (' + HL.ING.length + ' ingredient groups, ' + aliasOwner.size + ' unique names, ' + Object.keys(HL.EV).length + ' evidence items)');
process.exit(fail ? 1 : 0);
