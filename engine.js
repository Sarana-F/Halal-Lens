/* Halal Lens — analysis engine. Pure functions, no DOM.
   HL.analyze(text, {ctx: 'food'|'cosmetic', school: ''|'hn'|'sh'|'mk'|'hb'}) → report */
window.HL = window.HL || {};
(function () {
  var RANK = { h: 0, n: 1, m: 2, d: 3, x: 4 };
  HL.SCHOOLS = { hn: 'Hanafi', sh: 'Shafi’i', mk: 'Maliki', hb: 'Hanbali' };
  HL.STATUS = {
    h:  { label: 'Halal', short: 'Halal' },
    hc: { label: 'Halal certified', short: 'Certified' },
    n:  { label: 'Halal, with a note', short: 'Halal*' },
    m:  { label: 'Scholars differ', short: 'Differs' },
    d:  { label: 'Doubtful (mushbooh)', short: 'Doubtful' },
    x:  { label: 'Haram', short: 'Haram' },
    u:  { label: 'Not enough information', short: 'Unknown' }
  };

  var PLANT = /\b(vegetable|vegetal|vegetales?|plant|plants|plant based|plant origin|vegetable origin|veg|soy|soya|palm|sunflower|rapeseed|canola|coconut|vegan|non animal|microbial|synthetic|de origen vegetal)\b/;
  var NEG = 'alcohol|alcool|alkohol|ethanol|pork|pig|porcine|gelatin|gelatine|lard|animal products?|animal ingredients?|animal derivatives?|animal fats?|animal rennet|meat|e120|carmine|insects?';
  var NEG_BEFORE = new RegExp('\\b(?:no|without|free from|free of|sin|sans|ohne|contains no|does not contain|not contain|nor)\\s+(?:added\\s+)?(?:any\\s+)?(?:' + NEG + ')\\b', 'g');
  var NEG_AFTER = new RegExp('\\b(?:' + NEG + ')\\s*free\\b', 'g');
  var CERT = /\b(halal|halaal|zabiha|zabihah|dhabiha|jakim|muis|ifanca|sanha|esma|hfce|halal india|jamiat ulama|halal certified|certified halal|halal certification|halal trust|mui halal)\b|حلال/;
  var NOT_HALAL = /\bnon\s*halal\b|\bnot\s+halal\b(?!\s+certified)/;
  var NOT_CERT = /\b(?:not|no)\s+(?:halal\s+)?certifi(?:ed|cation)\b|\bnot\s+halal\s+certified\b/g;
  var FILLER = /^(ingredients?|ingredientes|ingredients list|contains|may contain|allergy advice|allergens?|for allergens|see ingredients in bold|and|or|with|of|traces?|natural|organic|emulsifiers?|stabili[sz]ers?|thickeners?|colou?rs?|preservatives?|antioxidants?|acidity regulators?|raising agents?|sweeteners?|humectants?|thickening agents?|flavour enhancers?|flavor enhancers?|\d+([.,]\d+)?\s*%?)$/;

  function light(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function norm(t) {
    t = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    t = t.replace(/[’'`´]/g, ' ').replace(/&/g, ' and ').replace(/\s*[–—-]\s*/g, ' ');
    t = t.replace(/(\d{3,4}[a-f]?)\s*\(\s*[ivx]+\s*\)/g, '$1');                     // 450(i) -> 450
    t = t.replace(/\(([^()]{1,120})\)/g, function (m, inner) {                         // (471, 322) -> (e471, e322)
      var toks = inner.split(/[,;\/]|\band\b/).map(function (s) { return s.trim(); }).filter(Boolean);
      var ok = toks.length && toks.every(function (s) { return /^(?:e|ins)?\s*\d{3,4}[a-f]?$/.test(s); });
      return ok ? '(' + toks.map(function (s) { return 'e' + s.match(/\d{3,4}[a-f]?/)[0]; }).join(', ') + ')' : m;
    });
    t = t.replace(/\b(?:e|ins)\s*\.?\s*(\d{3,4})\s?([a-f])?(?![\d\p{L}])/gu, function (m, d, l) { return ' e' + d + (l || '') + ' '; });
    t = t.replace(/[^\p{L}\p{N},;:()%.\s]/gu, ' ');
    t = t.replace(/\b(non alcoholic|alcohol free|alcoholfree|0[.,]0\s*%?|zero alcohol|dealcoholi[sz]ed|alcohol removed)\s+(beer|wine|lager|cider|sparkling wine|champagne|malt beverage|malt drink|ale)\b/g, ' naw_drink ');
    return t.replace(/[ \t]+/g, ' ');
  }

  var INDEX = null;
  function buildIndex() {
    INDEX = [];
    (HL.ING || []).forEach(function (e, i) {
      e.id = e.id || 'i' + i;
      e.a.split('|').forEach(function (raw) {
        var a = raw === 'naw_drink' ? raw : light(raw);
        if (!a) return;
        var body = esc(a).replace(/ /g, '\\s+');
        INDEX.push({ e: e, a: a, re: new RegExp('(?<![\\p{L}\\p{N}_])' + body + '(?:s|es)?(?![\\p{L}\\p{N}_])', 'gu') });
      });
    });
    INDEX.sort(function (x, y) { return y.a.length - x.a.length; });
  }

  // Text of the ingredient that contains [s, e), plus the class word before an enclosing "(".
  function windowAround(t, s, e) {
    var i = s - 1, depth = 0, head = '';
    for (; i >= 0; i--) {
      var c = t[i];
      if (c === ')') depth++;
      else if (c === '(') { if (depth) depth--; else { head = headBefore(t, i); break; } }
      else if (depth === 0 && (c === ',' || c === ';')) break;
    }
    var a = i + 1, j = e; depth = 0;
    for (; j < t.length; j++) {
      var d = t[j];
      if (d === '(') depth++;
      else if (d === ')') { if (depth) depth--; else break; }
      else if (depth === 0 && (d === ',' || d === ';' || (d === '.' && !/\d/.test(t[j + 1] || '')))) break;
    }
    return head + ' ' + t.slice(a, j);
  }
  function headBefore(t, p) {
    var k = p - 1;
    while (k >= 0 && t[k] !== ',' && t[k] !== ';' && t[k] !== '(') k--;
    return t.slice(k + 1, p);
  }

  function topItems(t) {
    var out = [], depth = 0, start = 0;
    for (var i = 0; i <= t.length; i++) {
      var c = t[i];
      if (c === '(') depth++;
      else if (c === ')') depth = Math.max(0, depth - 1);
      if (i === t.length || (depth === 0 && (c === ',' || c === ';' || c === '\n'))) {
        out.push({ s: start, e: i, txt: t.slice(start, i) });
        start = i + 1;
      }
    }
    return out;
  }

  function resolve(entry, win, ctx, school, claims) {
    var cos = ctx === 'cosmetic' && entry.cs;
    var s = cos ? entry.cs : entry.s;
    var m = cos ? (entry.cm || null) : (entry.m || null);
    var why = cos ? (entry.cw || entry.w) : entry.w;
    var note = null;
    if (entry.q) {
      for (var k = 0; k < entry.q.length; k++) {
        if (new RegExp('\\b(?:' + entry.q[k][0] + ')').test(win)) { s = entry.q[k][1]; note = entry.q[k][2]; m = null; break; }
      }
    }
    if (!note && entry.v && PLANT.test(win)) { s = 'h'; note = 'Marked as plant or vegetable origin.'; m = null; }
    if (!note && claims.alcoholFree && entry.g === 'alcohol' && (s === 'n' || s === 'd') && entry.a.indexOf('naw_drink') < 0) {
      s = 'h'; note = 'The product is labelled alcohol-free.'; m = null;
    }
    if (s !== 'h' && s !== 'x') {
      var animalDoubt = entry.v || /^(meat|animal)$/.test(entry.g) || /rennet|enzyme|cheese|collagen|gelatin/i.test(entry.n);
      if (claims.vegan && animalDoubt) { s = 'h'; note = 'The product is labelled vegan, so this is not from an animal.'; m = null; }
      else if (claims.vegetarian && animalDoubt && entry.g !== 'meat') { s = 'h'; note = 'The product is labelled vegetarian, so this is not from slaughtered animals.'; m = null; }
    }
    var eff = s;
    if (s === 'm') eff = (school && m && m[school]) ? m[school] : 'm';
    return { s: eff, base: s, m: m, note: note, why: why };
  }

  HL.analyze = function (text, opts) {
    opts = opts || {};
    if (!INDEX) buildIndex();
    var ctx = opts.ctx || 'food', school = opts.school || '';
    var t = norm(text);
    // "not halal certified" is no claim either way; "non-halal" / "not halal" is the maker saying it is not halal.
    var claimText = t.replace(NOT_CERT, ' ');
    var notHalal = NOT_HALAL.test(claimText);
    t = t.replace(NOT_CERT, function (m) { return ' '.repeat(m.length); });
    t = t.replace(/\bnon\s*halal\b|\bnot\s+halal\b/g, function (m) { return ' '.repeat(m.length); });
    var claims = {
      halal: CERT.test(t) && !notHalal,
      notHalal: notHalal,
      vegan: /\b(vegan|suitable for vegans|100 ?% plant|plant based)\b/.test(t),
      vegetarian: /\b(vegetarian|suitable for vegetarians|vegetariano|vegetarien)\b/.test(t),
      alcoholFree: /\b(alcohol free|non alcoholic|sin alcohol|sans alcool|alkoholfrei|no alcohol)\b/.test(t),
      kosher: /\bkosher\b/.test(t)
    };
    t = t.replace(NEG_BEFORE, function (m) { return ' '.repeat(m.length); })
         .replace(NEG_AFTER, function (m) { return ' '.repeat(m.length); })
         .replace(/\bnon\s+alcoholic\b/g, function (m) { return ' '.repeat(m.length); });

    var masked = t, raw = [];
    INDEX.forEach(function (it) {
      it.re.lastIndex = 0;
      var mm;
      while ((mm = it.re.exec(masked))) {
        var s = mm.index, e = s + mm[0].length;
        raw.push({ e: it.e, s: s, end: e, text: mm[0].trim() });
        masked = masked.slice(0, s) + ' '.repeat(e - s) + masked.slice(e);
        it.re.lastIndex = e;
      }
    });
    raw.sort(function (a, b) { return a.s - b.s; });

    var byId = {}, hits = [];
    raw.forEach(function (r) {
      var res = resolve(r.e, windowAround(t, r.s, r.end), ctx, school, claims);
      var key = r.e.id + '|' + res.s + '|' + (res.note || '');
      if (byId[key]) { if (byId[key].found.indexOf(r.text) < 0) byId[key].found.push(r.text); return; }
      var h = { entry: r.e, found: [r.text], s: res.s, base: res.base, m: res.m, note: res.note, why: res.why };
      byId[key] = h; hits.push(h);
    });

    var unknown = [];
    topItems(t).forEach(function (it) {
      var txt = it.txt.replace(/[().:%]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!txt || txt.length < 3 || FILLER.test(txt) || !/\p{L}{3}/u.test(txt)) return;
      var covered = raw.some(function (r) { return r.s < it.e && r.end > it.s; });
      if (!covered && unknown.length < 15) unknown.push(txt);
    });

    hits.sort(function (a, b) { return RANK[b.s] - RANK[a.s]; });
    var worst = hits.reduce(function (w, h) { return RANK[h.s] > RANK[w] ? h.s : w; }, 'h');
    var verdict = hits.length ? worst : 'u';
    if (claims.halal && /^[hnmd]$/.test(verdict)) verdict = 'hc';
    if (!hits.length && claims.halal) verdict = 'hc';
    if (claims.notHalal) verdict = 'x';

    return {
      verdict: verdict, hits: hits, unknown: unknown, claims: claims, ctx: ctx, school: school,
      flagged: hits.filter(function (h) { return h.s !== 'h'; }),
      clean: hits.filter(function (h) { return h.s === 'h'; }),
      contradiction: claims.halal && worst === 'x'
    };
  };

  HL.summary = function (r) {
    var names = function (list) {
      return list.slice(0, 3).map(function (h) { return h.entry.n.replace(/\s*\(.*\)$/, ''); }).join(', ') + (list.length > 3 ? ' and ' + (list.length - 3) + ' more' : '');
    };
    var of = function (s) { return r.hits.filter(function (h) { return h.s === s; }); };
    if (r.claims.notHalal) return 'The label itself says this product is not halal. Avoid it.';
    switch (r.verdict) {
      case 'x': return 'Contains ' + names(of('x')) + '. Avoid this product.';
      case 'd': return names(of('d')) + ' may come from a haram source and the label does not say which. Avoid it unless the source is confirmed or the product is halal-certified.';
      case 'm': return 'The schools of law differ on ' + names(of('m')) + '. Choose your school in Settings for a specific answer.';
      case 'n': return 'Halal according to most scholars. ' + names(of('n')) + ' carries a small caution; read the note.';
      case 'h': return 'No haram or doubtful ingredients found in what you entered.';
      case 'hc': return 'The product carries a halal claim or certifier mark, so the certifier has checked the source of each ingredient. Confirm the logo is from a body you trust.';
      default: return 'No known ingredients were recognised. Paste the full ingredient list or take a photo of it.';
    }
  };

  HL.lookup = function (q) {
    if (!INDEX) buildIndex();
    var n = light(q);
    if (!n) return HL.ING.slice();
    return HL.ING.filter(function (e) { return light(e.n).indexOf(n) >= 0 || e.a.indexOf(n) >= 0; });
  };
  HL._norm = norm;
})();
