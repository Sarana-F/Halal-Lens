/* Halal Lens — outside services.
   Claude is reached two ways: inside a claude.ai artifact (the viewer's own Claude account), or through
   this site's /api/ask function when it is hosted on Vercel with an Anthropic API key. Without either,
   the app falls back to Open Food Facts and on-device OCR. */
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

  function timeout(ms) { try { return AbortSignal.timeout(ms); } catch (e) { return undefined; } }
  // Does this site have the AI function (Vercel + ANTHROPIC_API_KEY, or a free GEMINI_API_KEY)?
  HL.serverReady = HL.inArtifact || location.protocol === 'file:' ? Promise.resolve(false)
    : fetch('api/ask', { signal: timeout(6000) }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!(j && j.ai)) return false;
        HL.CAP.provider = j.provider === 'gemini' ? 'gemini' : 'claude';
        return true;
      }, function () { return false; });
  HL.aiReady = Promise.all([HL.sampleReady, HL.serverReady]).then(function (v) {
    HL.CAP.mode = v[0] ? 'claude' : v[1] ? 'server' : null;
    if (v[0]) HL.CAP.provider = 'claude';
    if (v[1]) HL.CAP.images = true;
    return HL.CAP.mode;
  });
  /* The name of the AI answering, for on-screen text. */
  HL.aiName = function () { return HL.CAP.provider === 'gemini' ? 'Gemini' : 'Claude'; };

  function blobToBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1]); };
      r.onerror = function () { rej(new Error('The photo could not be read.')); };
      r.readAsDataURL(blob);
    });
  }
  // Downscale to at most 1600 px on the long side so uploads stay small and fast.
  HL.shrink = function (file) {
    if (!window.createImageBitmap) return Promise.resolve(file);
    return createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bmp) {
      var k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      var c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b || file); }, 'image/jpeg', 0.85); });
    }, function () { return file; });
  };

  /* Ask Claude. task: 'scan' | 'product' | 'restaurant'. Resolves with the parsed JSON answer. */
  HL.ai = function (task, args, image) {
    return HL.aiReady.then(function (mode) {
      if (mode === 'claude') {
        return HL.sampleReady.then(function (s) {
          var opt = { modelTier: 'default' };
          if (image) opt.images = [image];
          return s.json(HL.PROMPTS[task](args), opt);
        });
      }
      if (mode === 'server') {
        return (image ? blobToBase64(image) : Promise.resolve(null)).then(function (b64) {
          return fetch('api/ask', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: task, args: args, image: b64 ? { media_type: image.type || 'image/jpeg', data: b64 } : undefined })
          });
        }).then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            if (!r.ok) throw { code: j.code || 'upstream_error', message: j.error || ('HTTP ' + r.status) };
            return j.result;
          });
        }, function () { throw { code: 'upstream_error', message: 'network' }; });
      }
      throw { code: 'no_ai', message: 'No AI available' };
    });
  };

  HL.aiError = function (e) {
    return ({
      not_granted: 'Claude access was not allowed for this page. You can still type or paste ingredients.',
      sampling_disabled: 'Claude is not available on this account.',
      rate_limited: 'Too many requests right now, or today’s free AI allowance is used up. Wait a while and try again.',
      session_expired: 'Sign in to Claude again, then try again.',
      refused: 'The AI could not answer this request.',
      invalid_json: 'The answer came back in an unexpected shape. Try again.',
      image_rejected: 'That image could not be used. Try a JPG or PNG photo.',
      images_unavailable: 'Photos cannot be sent to Claude in this view.',
      too_large: 'The photo is too large. Try again; the app shrinks it automatically.',
      server_off: 'AI reading is not switched on for this website yet.',
      no_credit: 'AI reading is paused because this website’s AI credit has run out.',
      empty_completion: 'The AI returned nothing. Try again.',
      cancelled: 'Stopped.'
    })[e && e.code] || 'The AI service could not be reached. Check your connection and try again.';
  };

  // ---------- Open Food Facts / Open Beauty Facts (blocked inside artifacts, works when hosted) ----------
  var FIELDS = 'code,product_name,brands,countries,ingredients_text,ingredients_text_en,labels_tags,image_front_small_url';
  function base(ctx) { return ctx === 'cosmetic' ? 'https://world.openbeautyfacts.org' : 'https://world.openfoodfacts.org'; }
  function getJSON(url) {
    if (HL.inArtifact) return Promise.reject(new Error('offline'));
    return fetch(url, { signal: timeout(10000) }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
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

  // ---------- AI product lookup ----------
  HL.aiProductCard = function (q, box, auto) {
    HL.aiReady.then(function (mode) {
      if (!mode) return;
      var card = el('div', { class: 'card ai' });
      box.appendChild(card);
      function idle() {
        card.textContent = '';
        card.appendChild(el('h2', { text: 'Ask ' + HL.aiName() + ' about “' + q + '”' }));
        card.appendChild(el('p', { class: 'hint', text: HL.aiName() + ' can list this product’s typical ingredients and where it is halal-certified. Halal Lens then checks each ingredient.' }));
        card.appendChild(el('button', { type: 'button', class: 'btn ghost', text: 'Look up with ' + HL.aiName(), onclick: go }));
      }
      function go() {
        card.textContent = '';
        card.appendChild(el('h2', { text: HL.aiName() + '’s product lookup' }));
        var st = el('p', { class: 'status', text: mode === 'claude' ? 'Thinking… (the first time, Claude asks your permission)' : 'Thinking…' });
        card.appendChild(st);
        HL.ai('product', { q: q, ctx: HL.S.ctx }).then(function (j) {
          card.textContent = '';
          if (!j || !j.known || !j.ingredients) {
            card.appendChild(el('h2', { text: HL.aiName() + ' doesn’t know this product' }));
            card.appendChild(el('p', { class: 'hint', text: 'Photograph the pack or its ingredient list instead.' }));
            card.appendChild(el('button', { type: 'button', class: 'btn ghost', text: 'Open the scanner', onclick: function () { HL.show('scan'); } }));
            return;
          }
          var r = HL.analyze(String(j.ingredients), HL.opts());
          card.appendChild(el('h2', { text: 'Typical recipe: ' + j.product + (j.brand ? ' · ' + j.brand : '') }));
          card.appendChild(el('p', { class: 'hint', text: 'From ' + HL.aiName() + '’s knowledge (confidence: ' + (j.confidence || 'unknown') + '). Recipes change and differ by country, so confirm with the ingredients on your pack.' }));
          card.appendChild(HL.report(r, { title: j.product, source: HL.aiName() + ', typical recipe' }));
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
  // Barcodes: the browser's own detector (Android Chrome), else the ZXing library (iPhone Safari, desktop).
  var ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/umd/index.min.js';
  function zxingRead(file) {
    return (window.ZXing ? Promise.resolve() : loadScript(ZXING_URL)).then(function () {
      var url = URL.createObjectURL(file);
      var done = function (v) { URL.revokeObjectURL(url); return v; };
      return new window.ZXing.BrowserMultiFormatReader().decodeFromImageUrl(url)
        .then(function (r) { return done(r && r.getText ? r.getText() : null); }, function () { return done(null); });
    }).catch(function () { return null; });
  }
  function tryBarcode(file) {
    if (HL.inArtifact) return Promise.resolve(null);
    var native = ('BarcodeDetector' in window) && window.BarcodeDetector && window.createImageBitmap
      ? createImageBitmap(file).then(function (bmp) { return new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(bmp); })
        .then(function (c) { return c && c[0] ? c[0].rawValue : null; })
      : Promise.reject(new Error('no native detector'));
    return native.catch(function () { return zxingRead(file); })
      .then(function (code) { return code && /^\d{8,14}$/.test(code) ? code : null; });
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = src; sc.onload = res;
      sc.onerror = function () { rej(new Error('A reading tool could not load. Check your connection, or type the ingredients in the Check tab.')); };
      document.head.appendChild(sc);
    });
  }
  function ocrRead(file, onStatus, lang) {
    var langs = lang && lang !== 'eng' ? 'eng+' + lang : 'eng';
    onStatus('Loading the on-device text reader (the first time for each language takes a moment)…');
    return (window.Tesseract ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js')).then(function () {
      return window.Tesseract.recognize(file, langs, { logger: function (m) { if (m.status === 'recognizing text') onStatus('Reading text… ' + Math.round(m.progress * 100) + '%'); } });
    }).then(function (r) {
      var text = ((r && r.data && r.data.text) || '').replace(/\s*\n\s*/g, ' ').trim();
      var m = text.match(/ingredients?\s*[:\-]?\s*(.*)/i);
      if (m) text = m[1];
      if (!text) throw new Error('No text found. Try a sharper photo with the ingredients filling the frame.');
      return { mode: 'ocr', text: text, note: 'Read on your device. OCR makes mistakes and cannot translate, so correct the text below if needed.' };
    }, function (e) { throw new Error((e && e.message) || 'The photo could not be read. Type the ingredients in the Check tab instead.'); });
  }
  function visionRead(file, onStatus) {
    onStatus(HL.CAP.mode === 'claude' ? 'Looking at your photo… (the first time, Claude asks your permission)' : 'Looking at your photo…');
    return HL.shrink(file).then(function (img) { return HL.ai('scan', { ctx: HL.S.ctx }, img); }).then(function (j) {
      var products = (j && Array.isArray(j.products) ? j.products : []).filter(function (p) { return p && (p.labelIngredients || p.typicalIngredients || p.name); });
      if (!j || j.readable === false || !products.length) throw new Error((j && j.summary ? j.summary + ' ' : '') + 'Nothing to check could be recognised. Try a closer photo of the pack or its ingredient list.');
      j.products = products;
      return { mode: 'vision', data: j };
    }, function (e) {
      var err = new Error(e && e.code ? HL.aiError(e) : (e && e.message) || HL.aiError(e));
      err.code = e && e.code;
      throw err;
    });
  }
  /* Returns {mode:'vision', data} | {mode:'ocr', text, note} | {product, note}. */
  HL.readLabel = function (file, onStatus, lang) {
    return tryBarcode(file).then(function (code) {
      if (!code) return null;
      onStatus('Barcode ' + code + ' found. Looking it up…');
      return HL.offBarcode(code, HL.S.ctx).then(function (p) { return p ? { product: p, note: 'Barcode ' + code + ' found in Open Food Facts.' } : null; }, function () { return null; });
    }).then(function (res) {
      if (res) return res;
      return HL.aiReady.then(function (mode) {
        if (!(mode && HL.CAP.images)) return ocrRead(file, onStatus, lang);
        // If the site's AI is switched off or out of credit, read the label on the device instead.
        return visionRead(file, onStatus).catch(function (e) {
          if (mode === 'server' && e && (e.code === 'server_off' || e.code === 'no_credit')) return ocrRead(file, onStatus, lang);
          throw e;
        });
      });
    });
  };

  /* Turn one recognised product into text for the engine. */
  HL.productText = function (p) {
    var extra = [];
    if (p.halalMark) extra.push('halal certified (' + p.halalMark + ')');
    if (p.vegMark === 'green') extra.push('suitable for vegetarians');
    (Array.isArray(p.claims) ? p.claims : []).forEach(function (c) { extra.push(String(c)); });
    var ing = String(p.labelIngredients || p.typicalIngredients || p.type || p.name || '');
    return { ingredients: ing, extra: extra.join('; '), fromLabel: !!p.labelIngredients };
  };
})();
