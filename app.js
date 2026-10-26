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
  function onPhoto(file) {
    if (!file) return;
    $('preview').src = URL.createObjectURL(file); $('preview').hidden = false;
    $('scanOut').textContent = ''; $('scanTextWrap').hidden = true;
    var status = $('scanStatus');
    HL.readLabel(file, function (msg) { status.textContent = msg; }).then(function (res) {
      status.textContent = res.note || '';
      if (res.product) { $('scanOut').appendChild(HL.report(HL.analyze(HL.offText(res.product), HL.opts()), { title: res.product.product_name || 'Scanned barcode', source: 'Barcode · Open Food Facts' })); return; }
      $('scanText').value = res.text || '';
      $('scanTextWrap').hidden = false;
      scanCheck(res.extra || '');
    }).catch(function (e) {
      status.textContent = e && e.message ? e.message : 'Could not read the photo. Type the ingredients in the Check tab instead.';
      $('scanText').value = ''; $('scanTextWrap').hidden = false;
    });
  }
  var scanExtra = '';
  function scanCheck(extra) {
    if (extra != null) scanExtra = extra;
    var txt = $('scanText').value.trim();
    var out = $('scanOut'); out.textContent = '';
    if (!txt) return;
    lastRun = function () { scanCheck(); };
    out.appendChild(HL.report(HL.analyze(txt + (scanExtra ? '; ' + scanExtra : ''), HL.opts()), { title: 'From your photo', source: 'Photo' }));
  }
  ['cam', 'pick'].forEach(function (id) { $(id).addEventListener('change', function () { onPhoto(this.files && this.files[0]); this.value = ''; }); });
  $('recheck').addEventListener('click', function () { scanCheck(); });
  document.addEventListener('paste', function (e) {
    if ($('scan').hidden) return;
    var f = [].slice.call((e.clipboardData && e.clipboardData.files) || []).find(function (x) { return /^image\//.test(x.type); });
    if (f) onPhoto(f);
  });
  HL.updateScanEngine = function () {
    $('scanEngine').textContent = CAP.images ? 'Claude reads the label, then Halal Lens checks every ingredient against its library.'
      : CAP.sample === null ? 'Getting ready…'
      : 'The label is read on your device (works best on clear, well-lit English text). You can correct the text before checking.';
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
  HL.sampleReady.then(HL.updateScanEngine);
  if (!HL.inArtifact) {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      try { navigator.serviceWorker.register('sw.js').catch(function () {}); } catch (e) {}
    }
  }

  // ---------- opening state: a worked example ----------
  $('checkOut').appendChild(HL.report(HL.analyze(EXAMPLES[0][1], HL.opts()), { title: 'Gummy bears', example: true }));
  HL.show = show;
})();
