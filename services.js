/* Halal Lens — outside services: Claude (inside an artifact), Open Food Facts, on-device OCR, barcodes. */
window.HL = window.HL || {};
(function () {
  var el = HL.el;
  HL.CAP = HL.CAP || { sample: null, images: false, mcp: null };
  HL.inArtifact = !!(window.claude && typeof window.claude.use === 'function');
  HL.sampleReady = HL.inArtifact ? window.claude.use('sample').then(function (s) {
    HL.CAP.sample = s || false;
    if (!s) return null;
    return s.limits().then(function (l) { HL.CAP.images = !!(l && l.images); return s; }, function () { return s; });
  }, function () { HL.CAP.sample = false; return null; }) : Promise.resolve((HL.CAP.sample = false, null));
  HL.mcpReady = HL.inArtifact ? window.claude.use('mcp').then(function (m) { HL.CAP.mcp = m || false; return m || null; }, function () { return null; })
    : Promise.resolve(null);

  HL.aiError = function (e) {
    return ({
      not_granted: 'Claude access was not allowed for this page. You can still type or paste ingredients.',
      sampling_disabled: 'Claude is not available on this account.',
      rate_limited: 'Too many requests right now. Wait a minute and try again.',
      session_expired: 'Sign in to Claude again, then try again.',
      refused: 'Claude could not answer this request.',
      invalid_json: 'The answer came back in an unexpected shape. Try again.',
      image_rejected: 'That image could not be used. Try a JPG or PNG photo.',
      images_unavailable: 'Photos cannot be sent to Claude in this view.',
      empty_completion: 'Claude returned nothing. Try again.',
      cancelled: 'Stopped.'
    })[e && e.code] || 'Claude could not be reached. Check your connection and try again.';
  };

  // ---------- Open Food Facts / Open Beauty Facts (blocked inside artifacts, works when hosted) ----------
  var FIELDS = 'code,product_name,brands,countries,ingredients_text,ingredients_text_en,labels_tags,image_front_small_url';
  function base(ctx) { return ctx === 'cosmetic' ? 'https://world.openbeautyfacts.org' : 'https://world.openfoodfacts.org'; }
  function getJSON(url) {
    if (HL.inArtifact) return Promise.reject(new Error('offline'));
    var opt = {};
    try { opt.signal = AbortSignal.timeout(10000); } catch (e) {}
    return fetch(url, opt).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  HL.offSearch = function (q, ctx) {
    return getJSON(base(ctx) + '/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=10&fields=' + FIELDS)
      .then(function (j) { return (j.products || []).filter(function (p) { return p.ingredients_text_en || p.ingredients_text; }).slice(0, 5); });
  };
  HL.offBarcode = function (code, ctx) {
    return getJSON(base(ctx) + '/api/v2/product/' + encodeURIComponent(code) + '.json?fields=' + FIELDS)
      .then(function (j) { return j && j.status === 1 && j.product ? j.product : null; });
  };
  HL.offText = function (p) {
    var tags = (p.labels_tags || []).join(' '), extra = [];
    if (/en:halal/.test(tags)) extra.push('halal certified');
    if (/en:vegan/.test(tags)) extra.push('vegan');
    else if (/en:vegetarian/.test(tags)) extra.push('suitable for vegetarians');
    return (p.ingredients_text_en || p.ingredients_text || '') + (extra.length ? '; ' + extra.join('; ') : '');
  };

  // ---------- Claude product lookup ----------
  HL.aiProductCard = function (q, box, auto) {
    HL.sampleReady.then(function (s) {
      if (!s) return;
      var card = el('div', { class: 'card ai' });
      box.appendChild(card);
      function idle() {
        card.textContent = '';
        card.appendChild(el('h2', { text: 'Ask Claude about “' + q + '”' }));
        card.appendChild(el('p', { class: 'hint', text: 'Claude can list this product’s typical ingredients and where it is halal-certified. Halal Lens then checks each ingredient.' }));
        card.appendChild(el('button', { type: 'button', class: 'btn ghost', text: 'Look up with Claude', onclick: go }));
      }
      function go() {
        card.textContent = '';
        card.appendChild(el('h2', { text: 'Claude’s product lookup' }));
        var st = el('p', { class: 'status', text: 'Thinking… (the first time, Claude asks your permission)' });
        card.appendChild(st);
        var prompt = 'You help Muslims check whether products are halal.\nProduct the user typed: "' + q + '"\nCategory: ' + (HL.S.ctx === 'cosmetic' ? 'cosmetics / personal care' : 'food and drink') +
          '\n\nReply with only JSON in this shape:\n{"product": string, "brand": string|null, "known": boolean, "ingredients": string, "variesByCountry": string, "halalCertification": string, "concerns": [string], "confidence": "high"|"medium"|"low"}\n\nRules:\n' +
          '- "ingredients": the typical ingredient list as printed on the pack, comma-separated, with E-numbers. Use "" if you do not know this product.\n' +
          '- "variesByCountry": how the recipe or halal status differs between countries (for example halal-certified production in Malaysia or the Gulf versus Europe). "" if unknown.\n' +
          '- "halalCertification": only certification you are confident exists, naming country and certifier. Otherwise "".\n' +
          '- "concerns": short notes on gelatin source, alcohol, carmine, E471 origin, animal rennet or shared production lines that apply.\n' +
          '- If you do not recognise the product, set known=false. Never guess or invent ingredients or certificates.';
        s.json(prompt, { modelTier: 'default' }).then(function (j) {
          card.textContent = '';
          if (!j || !j.known || !j.ingredients) {
            card.appendChild(el('h2', { text: 'Claude doesn’t know this product' }));
            card.appendChild(el('p', { class: 'hint', text: 'Photograph the ingredient list instead; that is the most reliable check.' }));
            card.appendChild(el('button', { type: 'button', class: 'btn ghost', text: 'Open the scanner', onclick: function () { HL.show('scan'); } }));
            return;
          }
          var r = HL.analyze(String(j.ingredients), HL.opts());
          card.appendChild(el('h2', { text: 'Typical recipe: ' + j.product + (j.brand ? ' · ' + j.brand : '') }));
          card.appendChild(el('p', { class: 'hint', text: 'From Claude’s knowledge (confidence: ' + (j.confidence || 'unknown') + '). Recipes change and differ by country, so confirm with the ingredients on your pack.' }));
          card.appendChild(HL.report(r, { title: j.product, source: 'Claude, typical recipe' }));
          var dl = el('dl', { class: 'kv' });
          if (j.halalCertification) { dl.appendChild(el('dt', { text: 'Certification' })); dl.appendChild(el('dd', { text: String(j.halalCertification) })); }
          if (j.variesByCountry) { dl.appendChild(el('dt', { text: 'By country' })); dl.appendChild(el('dd', { text: String(j.variesByCountry) })); }
          if (Array.isArray(j.concerns) && j.concerns.length) { dl.appendChild(el('dt', { text: 'Watch for' })); dl.appendChild(el('dd', { text: j.concerns.map(String).join(' · ') })); }
          if (dl.childElementCount) card.appendChild(dl);
          card.appendChild(el('p', { class: 'hint', text: 'Typical ingredients used: ' + j.ingredients }));
        }, function (e) {
          st.textContent = HL.aiError(e);
          if (e && e.code !== 'not_granted' && e.code !== 'sampling_disabled') card.appendChild(el('button', { type: 'button', class: 'btn ghost small', text: 'Try again', onclick: go }));
        });
      }
      auto ? go() : idle();
    });
  };

  // ---------- Reading a photo ----------
  function tryBarcode(file) {
    if (HL.inArtifact || !('BarcodeDetector' in window) || !window.createImageBitmap) return Promise.resolve(null);
    return createImageBitmap(file).then(function (bmp) {
      return new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(bmp);
    }).then(function (c) { return c && c[0] ? c[0].rawValue : null; }, function () { return null; });
  }
  function claudeRead(s, file, onStatus) {
    onStatus('Claude is reading the label… (the first time, Claude asks your permission)');
    var prompt = 'This photo shows a product package or label. Read it and reply with only JSON:\n' +
      '{"readable": boolean, "product": string|null, "ingredients": string, "halalMark": string|null, "vegMark": "green"|"brown"|null, "claims": [string]}\n\n' +
      '- "ingredients": the full ingredient list exactly as printed, translated into English if it is in another language. Keep E-numbers, INS numbers and anything in brackets. "" if no ingredient list is visible.\n' +
      '- "halalMark": the text or certifier name of a halal logo you can actually see, otherwise null.\n' +
      '- "vegMark": the Indian green (vegetarian) or brown (non-vegetarian) dot symbol, if visible.\n' +
      '- "claims": label claims such as "vegan", "suitable for vegetarians", "alcohol free", "no pork".\n' +
      '- Set readable=false if the text is too blurry to read. Do not guess ingredients you cannot see.';
    return s.json(prompt, { images: [file] }).then(function (j) {
      if (!j || !j.readable || !j.ingredients) throw new Error('No ingredient list could be read. Try a sharper, closer photo of the ingredients.');
      var extra = [];
      if (j.halalMark) extra.push('halal certified (' + j.halalMark + ')');
      if (j.vegMark === 'green') extra.push('suitable for vegetarians');
      (Array.isArray(j.claims) ? j.claims : []).forEach(function (c) { extra.push(String(c)); });
      var note = (j.product ? j.product + '. ' : '') + (j.halalMark ? 'Halal mark seen: ' + j.halalMark + '. ' : '') +
        (j.vegMark === 'brown' ? 'Brown (non-vegetarian) mark seen. ' : '') + 'Read by Claude; compare the text below with your pack.';
      return { text: String(j.ingredients), extra: extra.join('; '), note: note };
    }, function (e) { throw new Error(e && e.code ? HL.aiError(e) : (e && e.message) || HL.aiError(e)); });
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = src; sc.onload = res;
      sc.onerror = function () { rej(new Error('The on-device text reader could not load. Check your connection, or type the ingredients in the Check tab.')); };
      document.head.appendChild(sc);
    });
  }
  function ocrRead(file, onStatus) {
    onStatus('Loading the on-device text reader (the first time takes a moment)…');
    return (window.Tesseract ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js')).then(function () {
      return window.Tesseract.recognize(file, 'eng', { logger: function (m) { if (m.status === 'recognizing text') onStatus('Reading text… ' + Math.round(m.progress * 100) + '%'); } });
    }).then(function (r) {
      var text = ((r && r.data && r.data.text) || '').replace(/\s*\n\s*/g, ' ').trim();
      var m = text.match(/ingredients?\s*[:\-]?\s*(.*)/i);
      if (m) text = m[1];
      if (!text) throw new Error('No text found. Try a sharper photo with the ingredients filling the frame.');
      return { text: text, note: 'Read on your device. OCR makes mistakes, so correct the text below if needed.' };
    }, function (e) { throw new Error((e && e.message) || 'The photo could not be read. Type the ingredients in the Check tab instead.'); });
  }
  HL.readLabel = function (file, onStatus) {
    return tryBarcode(file).then(function (code) {
      if (!code) return null;
      onStatus('Barcode ' + code + ' found. Looking it up…');
      return HL.offBarcode(code, HL.S.ctx).then(function (p) { return p ? { product: p, note: 'Barcode ' + code + ' found in Open Food Facts.' } : null; }, function () { return null; });
    }).then(function (res) {
      if (res) return res;
      return HL.sampleReady.then(function (s) { return s && HL.CAP.images ? claudeRead(s, file, onStatus) : ocrRead(file, onStatus); });
    });
  };
})();
