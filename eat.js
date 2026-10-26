/* Halal Lens — restaurant check: quick hints, Claude's knowledge, a live web search
   (Claude desktop app only), map/search links and a ready message to send the restaurant. */
(function () {
  var el = HL.el, $ = function (id) { return document.getElementById(id); }, enc = encodeURIComponent;
  var ASK = [
    'Is all your meat and chicken halal? Which halal certifier, and can I see the certificate?',
    'Do you serve pork or alcohol? If so, are separate grills, fryers, utensils and storage used?',
    'Is alcohol (wine, beer, mirin, rum) used in any sauces, marinades or desserts?',
    'Are cheese, gelatin desserts and bakery items from halal sources?',
    'Is the halal meat hand-slaughtered, and is stunning used? (if this matters to you)'
  ];
  var STATUS = {
    certified: ['h', 'Halal certified'], claims_halal: ['n', 'Says it is halal'], partly: ['m', 'Some branches or items'],
    not_halal: ['x', 'Not halal'], unknown: ['u', 'Unknown']
  };

  function message(name) {
    return 'Assalamu alaikum. I would like to eat at ' + name + '. Could you please tell me:\n' +
      ASK.slice(0, 3).map(function (q, i) { return (i + 1) + '. ' + q; }).join('\n') + '\nThank you, jazakum Allahu khairan.';
  }
  function links(name, city) {
    var nc = (name + ' ' + city).trim();
    return [
      ['Google Maps: phone, hours, reviews', 'https://www.google.com/maps/search/?api=1&query=' + enc(nc)],
      ['Search “halal” on Google', 'https://www.google.com/search?q=' + enc('"' + name + '" ' + city + ' halal')],
      ['Zabihah listings', 'https://www.google.com/search?q=' + enc('site:zabihah.com ' + nc)],
      ['Halal certificate', 'https://www.google.com/search?q=' + enc('"' + name + '" ' + city + ' halal certificate')],
      ['Phone & contact', 'https://www.google.com/search?q=' + enc('"' + name + '" ' + city + ' phone number contact')],
      ['Apple Maps', 'https://maps.apple.com/?q=' + enc(nc)]
    ];
  }
  function hints(name) {
    var n = name.toLowerCase(), out = [];
    if (/\b(halal|zabiha|zabihah|dhabiha)\b/.test(n)) out.push(['n', 'The name says halal. Still ask which body certified it.']);
    if (/\b(bar|pub|brewery|brewpub|taproom|tavern|wine|winery|izakaya|beer|cantina|saloon)\b/.test(n)) out.push(['d', 'The name suggests alcohol is a main part of the business.']);
    if (/\b(pork|ham|bacon|char siu|lechon|carnitas|tonkatsu|ramen|dim sum|bbq)\b/.test(n)) out.push(['d', 'The name suggests pork may be on the menu. Ramen and dim sum often use pork stock or fillings.']);
    if (/\bkosher\b/.test(n)) out.push(['n', 'Many scholars accept kosher meat under 5:5. Kosher kitchens never serve pork, but wine may be used.']);
    if (/\b(vegan|vegetarian|pure veg|plant based)\b/.test(n)) out.push(['n', 'No meat, so slaughter is not an issue. Ask about alcohol in dishes.']);
    return out;
  }
  function copy(text, btn, area) {
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1800); };
    var fall = function () { area.focus(); area.select(); btn.textContent = 'Selected — copy it'; };
    try { navigator.clipboard.writeText(text).then(done, fall); } catch (e) { fall(); }
  }
  function card(title, kids) { return el('div', { class: 'card' }, [el('h2', { text: title })].concat(kids)); }

  function run() {
    var name = $('rName').value.trim(), city = $('rCity').value.trim();
    if (!name) { $('rName').focus(); return; }
    var out = $('eatOut'); out.textContent = '';
    var aiBox = el('div', { class: 'panel' }), liveBox = el('div', { class: 'panel' });
    var hs = hints(name);
    if (hs.length) out.appendChild(card('First impressions', hs.map(function (x) { return el('p', { class: 'row' }, [HL.pill(x[0]), el('span', { text: x[1] })]); })));
    out.appendChild(aiBox);
    out.appendChild(liveBox);
    out.appendChild(card('Find it and contact them', [
      el('p', { class: 'hint', text: 'The Google Maps listing usually shows the phone number, website and photos of the certificate in reviews.' }),
      el('div', { class: 'links' }, links(name, city).map(function (l) { return el('a', { class: 'btn ghost small', href: l[1], target: '_blank', rel: 'noopener', text: l[0] }); }))
    ]));
    var msg = message(name), area = el('textarea', { id: 'rMsg', readonly: true, rows: '6' });
    area.value = msg;
    var copyBtn = el('button', { type: 'button', class: 'btn small', text: 'Copy' });
    copyBtn.addEventListener('click', function () { copy(msg, copyBtn, area); });
    out.appendChild(card('What to ask them', [
      el('ol', { class: 'checklist' }, ASK.map(function (q) { return el('li', { text: q }); })),
      el('label', { class: 'lbl', for: 'rMsg', text: 'Message you can send' }), area,
      el('div', { class: 'row' }, [copyBtn, el('a', { class: 'btn ghost small', href: 'https://wa.me/?text=' + enc(msg), target: '_blank', rel: 'noopener', text: 'Open in WhatsApp' })])
    ]));
    HL.aiReady.then(function (mode) { if (mode) aiCard(name, city, aiBox); });
    HL.mcpReady.then(function (m) {
      if (!m) return;
      // The app's browser is listed only when this page is open in the Claude desktop app.
      m.listTools().then(function (r) {
        if ((r.servers || []).some(function (s) { return s.server === 'host:claude_browser'; })) liveCard(m, name, city, liveBox);
      }, function () {});
    });
  }
  $('eatForm').addEventListener('submit', function (e) { e.preventDefault(); run(); });

  function aiCard(name, city, box) {
    var c = el('div', { class: 'card ai' }, [el('h2', { text: 'What Claude knows' }), el('p', { class: 'status', text: HL.CAP.mode === 'claude' ? 'Thinking… (the first time, Claude asks your permission)' : 'Thinking…' })]);
    box.appendChild(c);
    HL.ai('restaurant', { name: name, city: city }).then(function (j) {
      c.textContent = '';
      var st = STATUS[j && j.status] || STATUS.unknown;
      c.appendChild(el('div', { class: 'row' }, [el('h2', { text: 'What Claude knows' }), el('span', { style: 'flex:0 0 auto' }, [el('span', { class: 'pill p-' + st[0], text: st[1] })])]));
      if (!j || !j.known) {
        c.appendChild(el('p', { text: 'Claude has no reliable information about this restaurant. Use the links below to find their listing and contact them.' }));
        return;
      }
      c.appendChild(el('p', { text: String(j.summary || '') }));
      var dl = el('dl', { class: 'kv' });
      dl.appendChild(el('dt', { text: 'Pork or alcohol' })); dl.appendChild(el('dd', { text: { yes: 'Served', no: 'Not served', unknown: 'Unknown' }[j.porkOrAlcohol] || 'Unknown' }));
      var site = j.officialWebsite && String(j.officialWebsite).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (site && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(site)) { dl.appendChild(el('dt', { text: 'Website' })); dl.appendChild(el('dd', null, [el('a', { href: 'https://' + site, target: '_blank', rel: 'noopener', text: site })])); }
      if (j.howToVerify) { dl.appendChild(el('dt', { text: 'Verify with' })); dl.appendChild(el('dd', { text: String(j.howToVerify) })); }
      c.appendChild(dl);
      c.appendChild(el('p', { class: 'hint', text: 'From Claude’s general knowledge, not a live search. Branches and certificates change.' }));
    }, function (e) {
      c.lastChild.textContent = HL.aiError(e);
    });
  }

  function textOf(r) {
    if (r && typeof r.payload === 'string') return r.payload;
    var t = ((r && r.content) || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('\n');
    return t || (r && r.payload ? JSON.stringify(r.payload) : '');
  }
  function mcpError(e) {
    return ({
      server_not_connected: 'Live web search works only when this page is open in the Claude desktop app.',
      not_in_manifest: 'Browser access was not allowed for this page.',
      approval_required: 'Browser access needs your approval. Try again and choose Allow.',
      cancelled: 'Cancelled.'
    })[e && e.code] || 'The web search did not finish. Use the links below instead.';
  }
  function liveCard(m, name, city, box) {
    var c = el('div', { class: 'card' }, [
      el('h2', { text: 'Live web check' }),
      el('p', { class: 'hint', text: 'Searches the web in the Claude app’s browser for halal mentions and the restaurant’s own contact details.' })
    ]);
    var btn = el('button', { type: 'button', class: 'btn ghost', text: 'Search the web now' });
    c.appendChild(btn);
    box.appendChild(c);
    btn.addEventListener('click', function () {
      btn.disabled = true;
      var st = el('p', { class: 'status', text: 'Searching…' });
      c.appendChild(st);
      var queries = ['"' + name + '" ' + city + ' halal', '"' + name + '" ' + city + ' phone number contact'];
      var texts = [];
      queries.reduce(function (p, q, i) {
        return p.then(function () {
          st.textContent = 'Searching (' + (i + 1) + ' of ' + queries.length + ')…';
          return m.callTool('host:claude_browser', 'navigate', { url: 'https://html.duckduckgo.com/html/?q=' + enc(q) })
            .then(function () { return m.callTool('host:claude_browser', 'get_page_text', { max_chars: 7000 }); })
            .then(function (r) { texts.push(textOf(r).slice(0, 7000)); });
        });
      }, Promise.resolve()).then(function () {
        st.textContent = 'Reading the results…';
        return HL.sampleReady.then(function (s) { return s ? extract(s, name, city, texts) : regexExtract(texts); });
      }).then(function (j) { st.remove(); showLive(c, j); }, function (e) {
        st.textContent = e && e.code ? (e.code in { invalid_json: 1, rate_limited: 1, not_granted: 1 } ? HL.aiError(e) : mcpError(e)) : 'The web search did not finish. Use the links below instead.';
      }).then(function () { btn.disabled = false; });
    });
  }
  function extract(s, name, city, texts) {
    var prompt = 'Below is text from web search results about the restaurant "' + name + '" in "' + (city || 'unknown location') + '".\n' +
      'Using ONLY this text, reply with only JSON:\n' +
      '{"status": "certified"|"claims_halal"|"partly"|"not_halal"|"unknown", "evidence": [{"quote": string, "source": string}], "phone": string|null, "website": string|null, "email": string|null, "address": string|null, "social": string|null, "note": string}\n' +
      '- Quote the exact words that mention halal, pork or alcohol, with the site they came from.\n' +
      '- Copy contact details exactly as written. Use null for anything not in the text. Never invent details.\n' +
      '- Results may be about a different place with a similar name; say so in "note".\n\n' +
      texts.map(function (t, i) { return '--- RESULTS ' + (i + 1) + ' ---\n' + t; }).join('\n\n');
    return s.json(prompt, { modelTier: 'quick' });
  }
  function regexExtract(texts) {
    var all = texts.join('\n');
    var phone = (all.match(/\+?\d[\d\s().-]{7,}\d/) || [null])[0];
    var site = (all.match(/https?:\/\/[^\s"'<>]+/) || [null])[0];
    var halal = all.split(/\n+/).filter(function (l) { return /halal/i.test(l); }).slice(0, 3);
    return { status: halal.length ? 'claims_halal' : 'unknown', evidence: halal.map(function (q) { return { quote: q.slice(0, 220), source: 'search results' }; }), phone: phone, website: site, note: 'Picked out automatically; check each detail.' };
  }
  function showLive(c, j) {
    j = j || {};
    var st = STATUS[j.status] || STATUS.unknown;
    c.appendChild(el('div', { class: 'row' }, [el('b', { text: 'Result' }), el('span', { style: 'flex:0 0 auto' }, [el('span', { class: 'pill p-' + st[0], text: st[1] })])]));
    (Array.isArray(j.evidence) ? j.evidence : []).slice(0, 4).forEach(function (ev) {
      c.appendChild(el('div', { class: 'ev' }, [el('div', { class: 'src', text: String(ev.source || 'web') }), el('q', { text: String(ev.quote || '') })]));
    });
    var dl = el('dl', { class: 'kv' });
    [['Phone', j.phone], ['Website', j.website], ['Email', j.email], ['Address', j.address], ['Social', j.social]].forEach(function (kv) {
      if (!kv[1]) return;
      var v = String(kv[1]);
      dl.appendChild(el('dt', { text: kv[0] }));
      dl.appendChild(el('dd', null, [/^https?:\/\//.test(v) ? el('a', { href: v, target: '_blank', rel: 'noopener', text: v }) : el('span', { text: v })]));
    });
    if (dl.childElementCount) c.appendChild(dl);
    else c.appendChild(el('p', { class: 'hint', text: 'No contact details turned up in the search results. Try the Google Maps link below.' }));
    if (j.note) c.appendChild(el('p', { class: 'hint', text: String(j.note) }));
  }
})();
