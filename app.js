/* Halal Lens — app wiring: tabs, settings, Check, Scan, Learn.
   Works three ways: inside a Claude artifact (Claude reads photos and unknown products),
   as a hosted PWA (Open Food Facts + on-device OCR), and fully offline (ingredient engine only). */
(function () {
  var el = HL.el, $ = function (id) { return document.getElementById(id); };
  var CAP = HL.CAP;

  // ---------- per-viewer settings ----------
  function load(k, d) { try { var v = localStorage.getItem('hl.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('hl.' + k, JSON.stringify(v)); } catch (e) {} }
  var S = { ctx: load('ctx', 'food'), school: load('school', ''), recent: load('recent', []) };
  HL.S = S;
  HL.opts = function () { return { ctx: S.ctx, school: S.school }; };

  // ---------- tabs ----------
  var TABS = ['check', 'scan', 'eat', 'learn'];
  function show(id) {
    TABS.forEach(function (t) { $(t).hidden = t !== id; $('t-' + t).setAttribute('aria-selected', String(t === id)); });
    if (id === 'learn' && !$('libList').childElementCount) renderLibrary();
    window.scrollTo(0, 0);
  }
  TABS.forEach(function (t) { $('t-' + t).addEventListener('click', function () { show(t); }); });
  var h = (location.hash || '').slice(1);
  if (TABS.indexOf(h) >= 0) show(h);

  // ---------- settings controls ----------
  document.querySelectorAll('[data-ctx]').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.ctx === S.ctx));
    b.addEventListener('click', function () {
      S.ctx = b.dataset.ctx; save('ctx', S.ctx);
      document.querySelectorAll('[data-ctx]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      if (lastRun) lastRun();
    });
  });
  $('school').value = S.school;
  $('school').addEventListener('change', function () { S.school = this.value; save('school', S.school); if (lastRun) lastRun(); });
  var lastRun = null;

  // ---------- Check tab ----------
  var EXAMPLES = [
    ['Gummy bears', 'Glucose syrup, sugar, gelatine, dextrose, citric acid, fruit and plant concentrates, flavouring, glazing agent (beeswax, carnauba wax), colour (E120)'],
    ['Milk chocolate', 'Sugar, cocoa butter, whole milk powder, cocoa mass, emulsifier (soy lecithin), vanilla extract'],
    ['Biscuits (India)', 'Refined wheat flour (maida), sugar, edible vegetable oil (palm), invert syrup, raising agents (503(ii), 500(ii)), emulsifiers (471, 322), salt'],
    ['Perfume', 'Alcohol denat., parfum, aqua, benzyl salicylate, limonene'],
    ['Lipstick', 'Castor oil, beeswax, carmine, lanolin, candelilla wax, tocopherol'],
    ['Shrimp tempura', 'shrimp, wheat flour, corn starch, egg, salt, mirin']
  ];
  EXAMPLES.forEach(function (x) {
    $('examples').appendChild(el('button', { type: 'button', class: 'chip', text: x[0], onclick: function () { $('q').value = x[1]; runCheck(); } }));
  });
  function renderRecent() {
    var box = $('recent'); box.textContent = '';
    if (!S.recent.length) return;
    box.appendChild(el('span', { class: 'hint', text: 'Recent:' }));
    S.recent.forEach(function (r) { box.appendChild(el('button', { type: 'button', class: 'chip', text: r.length > 32 ? r.slice(0, 30) + '…' : r, onclick: function () { $('q').value = r; runCheck(); } })); });
  }
  renderRecent();

  function cleanQuery(q) {
    return q.replace(/\?/g, ' ').replace(/\b(is|are|can i (eat|use|drink|wear)|halal or haram|haram or halal|or not|halal|haram)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  }
  function isList(q) { return /[,;\n]/.test(q) || q.split(/\s+/).length > 7; }

  function runCheck() {
    var raw = $('q').value.trim();
    if (!raw) { $('q').focus(); return; }
    var q = isList(raw) ? raw : cleanQuery(raw) || raw;
    S.recent = [raw].concat(S.recent.filter(function (r) { return r !== raw; })).slice(0, 6); save('recent', S.recent); renderRecent();
    lastRun = runCheck;
    var r = HL.analyze(q, HL.opts());
    var out = $('checkOut'); out.textContent = '';
    if (/^\d{8,14}$/.test(q.replace(/\s/g, ''))) out.appendChild(el('div', { class: 'card' }, [el('h2', { text: 'Barcode ' + q }), el('p', { class: 'hint', text: HL.inArtifact ? 'Barcode lookup works in the installed app. Here, photograph the ingredient list in the Scan tab instead.' : 'Looking up this barcode in Open Food Facts.' })]));
    else out.appendChild(HL.report(r, { title: isList(raw) ? 'Ingredient list' : q, source: isList(raw) ? null : 'From the name only' }));
    if (!isList(raw)) productLookup(q, r, out);
  }
  $('checkForm').addEventListener('submit', function (e) { e.preventDefault(); runCheck(); });
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !isList($('q').value)) { e.preventDefault(); runCheck(); } });

  // ---------- product lookup: Open Food Facts first, then Claude ----------
  function productLookup(q, local, out) {
    var box = el('div', { class: 'panel' });
    out.appendChild(box);
    var offCard = el('div', { class: 'card' }, [el('h2', { text: 'Matching products' }), el('p', { class: 'hint', text: 'Searching the Open Food Facts database…' })]);
    box.appendChild(offCard);
    var aiBox = el('div', { class: 'panel' });
    box.appendChild(aiBox);
    var digits = /^\d{8,14}$/.test(q.replace(/\s/g, ''));
    var search = digits ? HL.offBarcode(q.replace(/\s/g, ''), S.ctx).then(function (p) { return p ? [p] : []; }) : HL.offSearch(q, S.ctx);
    search.then(function (list) {
      offCard.textContent = '';
      offCard.appendChild(el('h2', { text: 'Matching products' }));
      if (!list.length) { offCard.appendChild(el('p', { class: 'hint', text: 'No product with an ingredient list was found for “' + q + '”.' })); return list; }
      offCard.appendChild(el('p', { class: 'hint', text: 'Recipes differ by country. Pick the one that matches your pack.' }));
      list.forEach(function (p) { offCard.appendChild(productRow(p, out)); });
      return list;
    }).catch(function () {
      if (HL.inArtifact) offCard.remove();
      else {
        offCard.textContent = '';
        offCard.appendChild(el('h2', { text: 'Matching products' }));
        offCard.appendChild(el('p', { class: 'hint', text: 'The product database is busy or unreachable right now. Type the barcode number (the digits under the bars), or photograph the ingredient list in the Scan tab.' }));
      }
      return [];
    }).then(function (list) {
      var needAI = !list.length && (local.verdict === 'u' || local.flagged.every(function (h) { return h.entry.g === 'product'; }));
      HL.aiProductCard(q, aiBox, needAI);
    });
  }

  function productRow(p, out) {
    var r = HL.analyze(HL.offText(p), HL.opts());
    return el('button', { type: 'button', class: 'prod', onclick: function () {
      out.textContent = '';
      out.appendChild(HL.report(r, { title: (p.product_name || 'Product') + (p.brands ? ' · ' + p.brands : ''), source: 'Open Food Facts' }));
      out.appendChild(el('p', { class: 'hint' }, ['Ingredients as listed: ' + (p.ingredients_text_en || p.ingredients_text || '')]));
      window.scrollTo(0, 0);
    } }, [
      p.image_front_small_url ? el('img', { src: p.image_front_small_url, alt: '' }) : el('span', { class: 'ph' }),
      el('span', null, [el('b', { text: p.product_name || 'Unnamed product' }), el('br'), el('span', { class: 'hint', text: [p.brands, p.countries].filter(Boolean).join(' · ') })]),
      HL.pill(r.verdict)
    ]);
  }

  // ---------- Scan tab ----------
  // The current scanned item: what the report box shows and what "Check again" re-checks.
  var cur = { title: 'From your photo', source: 'Photo', extra: '', notes: '', fromLabel: true };
  var VRANK = { x: 6, d: 5, m: 4, n: 3, hc: 2, h: 1, u: 0 };

  function onPhoto(file) {
    if (!file) return;
    $('preview').src = URL.createObjectURL(file); $('preview').hidden = false;
    $('scanOut').textContent = ''; $('scanTextWrap').hidden = true;
    var status = $('scanStatus');
    status.textContent = 'Working…';
    HL.readLabel(file, function (msg) { status.textContent = msg; }, $('ocrLang').value).then(function (res) {
      status.textContent = res.note || '';
      if (res.product) {
        $('scanOut').appendChild(HL.report(HL.analyze(HL.offText(res.product), HL.opts()), { title: res.product.product_name || 'Scanned barcode', source: 'Barcode · Open Food Facts' }));
        return;
      }
      if (res.mode === 'vision') { status.textContent = ''; showVision(res.data); return; }
      cur = { title: 'From your photo', source: 'Photo, read on your device', extra: '', notes: '', fromLabel: true };
      $('scanText').value = res.text || '';
      $('scanTextWrap').hidden = false;
      $('scanOut').appendChild(el('div', { class: 'panel', id: 'scanReport' }));
      scanCheck();
    }).catch(function (e) {
      status.textContent = e && e.message ? e.message : 'Could not read the photo. Type the ingredients in the Check tab instead.';
      $('scanText').value = ''; $('scanTextWrap').hidden = false;
    });
  }

  function showVision(j) {
    var out = $('scanOut'); out.textContent = '';
    out.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'What the camera sees' }),
      j.summary ? el('p', { text: String(j.summary) }) : null,
      j.textSeen ? el('p', { class: 'hint', text: 'Text read: ' + j.textSeen }) : null,
      j.language ? el('div', { class: 'meta' }, [el('span', { class: 'tag', text: 'Language: ' + j.language })]) : null
    ]));
    var items = j.products.map(function (p) {
      var t = HL.productText(p);
      return { p: p, t: t, r: HL.analyze(t.ingredients + (t.extra ? '; ' + t.extra : ''), HL.opts()) };
    });
    var list = el('div', { class: 'list-gap' });
    if (items.length > 1) out.appendChild(el('div', { class: 'card' }, [el('h2', { text: items.length + ' products found' }), el('p', { class: 'hint', text: 'Tap one to see its details.' }), list]));
    out.appendChild(el('div', { class: 'panel', id: 'scanReport' }));
    function pick(i) {
      var a = items[i];
      [].forEach.call(list.children, function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
      cur = {
        title: [a.p.name, a.p.brand].filter(Boolean).join(' · ') || a.p.type || 'From your photo',
        source: a.t.fromLabel ? 'Read from the label' : 'Typical recipe',
        extra: a.t.extra, notes: a.p.notes || '', fromLabel: a.t.fromLabel, type: a.p.type || ''
      };
      $('scanText').value = a.t.ingredients;
      $('scanTextWrap').hidden = false;
      scanCheck();
    }
    items.forEach(function (a, i) {
      list.appendChild(el('button', { type: 'button', class: 'prod', onclick: function () { pick(i); $('scanReport').scrollIntoView({ block: 'start' }); } }, [
        el('span', { class: 'ph' }),
        el('span', null, [el('b', { text: a.p.name || a.p.type || 'Product ' + (i + 1) }), el('br'), el('span', { class: 'hint', text: [a.p.brand, a.p.type].filter(Boolean).join(' · ') })]),
        HL.pill(a.r.verdict)
      ]));
    });
    var worst = 0;
    items.forEach(function (a, i) { if (VRANK[a.r.verdict] > VRANK[items[worst].r.verdict]) worst = i; });
    pick(worst);
  }

  function scanCheck() {
    var txt = $('scanText').value.trim();
    var box = $('scanReport');
    if (!box) { box = el('div', { class: 'panel', id: 'scanReport' }); $('scanOut').appendChild(box); }
    box.textContent = '';
    if (!txt) return;
    lastRun = scanCheck;
    if (!cur.fromLabel) box.appendChild(el('p', { class: 'note', text: 'No ingredient list was visible, so these are the usual ingredients of ' + (cur.type || 'this product') + ' from Claude’s knowledge. Photograph the ingredient list to be sure.' }));
    if (cur.notes) box.appendChild(el('p', { class: 'note', text: cur.notes }));
    box.appendChild(HL.report(HL.analyze(txt + (cur.extra ? '; ' + cur.extra : ''), HL.opts()), { title: cur.title, source: cur.source }));
  }
  ['cam', 'pick'].forEach(function (id) { $(id).addEventListener('change', function () { onPhoto(this.files && this.files[0]); this.value = ''; }); });
  $('recheck').addEventListener('click', function () { cur.source = 'Edited text'; scanCheck(); });
  document.addEventListener('paste', function (e) {
    if ($('scan').hidden) return;
    var f = [].slice.call((e.clipboardData && e.clipboardData.files) || []).find(function (x) { return /^image\//.test(x.type); });
    if (f) onPhoto(f);
  });
  HL.updateScanEngine = function () {
    var ai = CAP.mode && CAP.images;
    $('scanEngine').textContent = ai ? 'Works like Google Lens: photograph a pack, an ingredient list, a dish or a menu in any language. Claude recognises it, then Halal Lens checks every ingredient.'
      : CAP.mode === undefined ? 'Getting ready…'
      : 'The label is read on your device. Pick the label’s language below; you can correct the text before checking.';
    $('ocrLangWrap').hidden = !!ai || CAP.mode === undefined;
  };
  HL.updateScanEngine();

  // ---------- Learn tab ----------
  var libFilter = '';
  function renderLibrary() {
    var f = $('libFilter');
    if (!f.childElementCount) {
      [['', 'All'], ['x', 'Haram'], ['d', 'Doubtful'], ['m', 'Differs'], ['n', 'Halal*'], ['h', 'Halal']].forEach(function (p) {
        f.appendChild(el('button', { type: 'button', class: 'chip', 'aria-pressed': String(p[0] === libFilter), text: p[1], onclick: function () {
          libFilter = p[0];
          f.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === this)); }, this);
          renderLibrary();
        } }));
      });
    }
    var list = $('libList'); list.textContent = '';
    var items = HL.lookup($('libQ').value).filter(function (e) { return !libFilter || e.s === libFilter; });
    items.slice(0, 60).forEach(function (e) {
      var st = S.school && e.s === 'm' && e.m ? e.m[S.school] : e.s;
      list.appendChild(HL.ingCard({ entry: e, s: st, base: e.s, m: e.m, why: e.w, found: null }, S.school));
    });
    if (!items.length) list.appendChild(el('p', { class: 'hint', text: 'Nothing matches. Try another spelling or an E-number like E471.' }));
  }
  $('libQ').addEventListener('input', renderLibrary);
  HL.renderLearn();

  // ---------- capabilities (Claude artifact) ----------
  HL.aiReady.then(HL.updateScanEngine);
  if (!HL.inArtifact) {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
    }
  }

  // ---------- opening state: a worked example ----------
  $('checkOut').appendChild(HL.report(HL.analyze(EXAMPLES[0][1], HL.opts()), { title: 'Gummy bears', example: true }));
  HL.show = show;
})();
