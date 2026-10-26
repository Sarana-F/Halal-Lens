/* Halal Lens — rendering helpers (DOM only, no network). */
window.HL = window.HL || {};
(function () {
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  HL.el = el;

  HL.pill = function (s) { return el('span', { class: 'pill p-' + s, text: (HL.STATUS[s] || HL.STATUS.u).short }); };

  // Eight-point star frame with a status glyph inside.
  HL.badge = function (s) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 72 72'); svg.setAttribute('width', '72'); svg.setAttribute('height', '72'); svg.setAttribute('aria-hidden', 'true');
    var glyph = {
      h: 'M24 37l8 8 16-18', hc: 'M24 37l8 8 16-18', n: 'M24 37l8 8 16-18',
      x: 'M26 26l20 20M46 26L26 46',
      d: 'M30 29a6 6 0 1 1 9 5c-2 1-3 2-3 5M36 46v1',
      m: 'M36 22v28M24 30h-2M50 30h-2M22 30l-4 10h12zM50 30l-4 10h12z',
      u: 'M28 36h16'
    }[s] || 'M28 36h16';
    svg.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">' +
      '<rect x="14" y="14" width="44" height="44" rx="3"/><rect x="14" y="14" width="44" height="44" rx="3" transform="rotate(45 36 36)"/>' +
      '<path d="' + glyph + '"/></g>';
    return svg;
  };

  function evidenceList(ids) {
    return el('div', { class: 'evs' }, ids.split(' ').filter(Boolean).map(function (id) {
      var e = HL.EV[id]; if (!e) return null;
      var kind = e[0] === 'q' ? 'Qur’an ' + e[1] : e[0] === 'h' ? e[1] : e[1];
      var link = HL.evLink(id);
      var head = link ? el('a', { href: link, target: '_blank', rel: 'noopener', text: kind + ' ↗' }) : kind;
      return el('div', { class: 'ev' }, [
        el('div', { class: 'src' }, [e[0] === 'q' ? '' : e[0] === 'h' ? 'Hadith · ' : 'Scholars · ', head]),
        el('q', { text: e[2] })
      ]);
    }));
  }
  HL.evidenceList = evidenceList;

  function schoolsGrid(m, mine) {
    return el('div', { class: 'schools' }, Object.keys(HL.SCHOOLS).map(function (k) {
      return el('div', { class: 'school' + (k === mine ? ' mine' : '') }, [HL.SCHOOLS[k], HL.pill(m[k] || 'u')]);
    }));
  }

  HL.ingCard = function (h, school, open) {
    var e = h.entry;
    var body = [
      h.note ? el('p', { class: 'note', text: h.note }) : null,
      el('p', { text: h.why }),
      h.m && h.base === 'm' ? el('div', { class: 'field' }, [el('span', { class: 'lbl', text: 'Position of each school' }), schoolsGrid(h.m, school)]) : null,
      e.c && h.s !== 'h' ? el('p', null, [el('b', { text: 'What to check: ' }), e.c]) : null,
      e.b ? el('p', { class: 'benefit' }, [el('b', { text: 'Benefit' }), e.b]) : null,
      el('div', { class: 'field' }, [el('span', { class: 'lbl', text: 'Evidence' }), evidenceList(e.e)])
    ];
    return el('details', { class: 'ing', open: open || null }, [
      el('summary', null, [
        el('span', { class: 'ing-name', text: e.n }), HL.pill(h.s),
        h.found ? el('span', { class: 'ing-found', text: 'Found: ' + h.found.join(', ') }) : null
      ]),
      el('div', { class: 'ing-body' }, body)
    ]);
  };

  /* Full report. opts: {title, example, source, school} */
  HL.report = function (r, opts) {
    opts = opts || {};
    var school = r.school;
    var tags = [
      opts.example ? el('span', { class: 'tag example-tag', text: 'Example' }) : null,
      el('span', { class: 'tag', text: r.ctx === 'cosmetic' ? 'Cosmetics' : 'Food & drink' }),
      el('span', { class: 'tag', text: school ? HL.SCHOOLS[school] + ' view' : 'All schools' }),
      opts.source ? el('span', { class: 'tag', text: opts.source }) : null,
      r.claims.halal ? el('span', { class: 'tag', text: 'Halal mark found' }) : null,
      r.claims.vegan ? el('span', { class: 'tag', text: 'Vegan' }) : r.claims.vegetarian ? el('span', { class: 'tag', text: 'Vegetarian' }) : null
    ];
    var out = [
      el('div', { class: 'verdict fade v-' + r.verdict }, [
        HL.badge(r.verdict),
        el('div', null, [
          opts.title ? el('div', { class: 'lbl', text: opts.title }) : null,
          el('h2', { text: HL.STATUS[r.verdict].label }),
          el('p', { text: HL.summary(r) }),
          el('div', { class: 'meta' }, tags)
        ])
      ])
    ];
    if (r.contradiction) out.push(el('p', { class: 'note', text: 'This pack claims to be halal but lists a haram ingredient. Check the exact wording, or contact the certifier.' }));
    if (r.flagged.length) {
      out.push(el('div', { class: 'card' }, [el('h2', { text: 'Why' }), el('div', { class: 'list-gap' }, r.flagged.map(function (h, i) { return HL.ingCard(h, school, i === 0); }))]));
    }
    var withBenefit = r.clean.filter(function (h) { return h.entry.b; });
    if (withBenefit.length) {
      out.push(el('div', { class: 'card' }, [el('h2', { text: 'Blessings in what you’re eating' }),
        el('div', { class: 'list-gap' }, withBenefit.map(function (h) {
          return el('div', { class: 'benefit' }, [el('b', { text: h.entry.n }), h.entry.b, ' ', el('span', { class: 'hint' }, [evidenceList(h.entry.e)])]);
        }))]));
    }
    if (r.clean.length) {
      out.push(el('details', { class: 'ing' }, [
        el('summary', null, [el('span', { class: 'ing-name', text: 'Halal ingredients (' + r.clean.length + ')' }), HL.pill('h')]),
        el('div', { class: 'ing-body' }, [el('div', { class: 'list-gap' }, r.clean.map(function (h) { return HL.ingCard(h, school); }))])
      ]));
    }
    if (r.unknown.length) {
      out.push(el('div', { class: 'card' }, [
        el('h2', { text: 'Not recognised' }),
        el('div', { class: 'chips' }, r.unknown.map(function (u) { return el('span', { class: 'chip static', text: u }); })),
        el('p', { class: 'hint', text: 'These are not in the library. Most unlisted items are plant or mineral; if one sounds animal-derived, ask the maker or look for a halal mark.' })
      ]));
    }
    return el('div', { class: 'panel' }, out);
  };

  /* ---- Learn tab ---- */
  HL.renderLearn = function () {
    var P = [
      ['Everything is halal unless proven otherwise', 'The default for food and things of daily use is permission. Allah has detailed what is forbidden, and the list is short.', 'q2_168 q6_119 q7_32'],
      ['What the Qur’an forbids', 'Carrion (animals not slaughtered properly), poured-out blood, pork, and anything dedicated to other than Allah. Intoxicants are forbidden in any amount.', 'q2_173 q5_3 q5_90 h_m2003'],
      ['What the Sunnah adds', 'Predators with fangs, birds with talons and domestic donkeys. Seafood and locusts are lawful without slaughter.', 'h_m1934 h_b4219 h_ad83 h_im3314'],
      ['Doubtful things (mushbooh)', 'When an ingredient could be lawful or unlawful and you cannot tell which, the Prophet taught to leave it. It is not declared haram for others.', 'h_b52 h_t2518 s_doubt'],
      ['Where the schools differ', 'Seafood other than fish, insects such as carmine, horse meat, cheese rennet and alcohol on the body. Pick your school in the Check tab to get a specific answer.', 's_seafood s_insects s_horse s_rennet s_alcext'],
      ['Transformation (istihala)', 'A substance that changes completely into something else takes a new ruling, as wine becomes lawful vinegar. Scholars differ on how far this applies to gelatin.', 'h_m2051 s_istihala'],
      ['Necessity and medicine', 'Whoever is forced by real necessity may take what is otherwise forbidden, only as much as needed. Medicine with haram ingredients is allowed only when no lawful alternative exists.', 'q2_173 q6_119 h_ad3874'],
      ['Why eat halal and tayyib', 'Halal is about obedience and purity: Allah accepts only what is good, and lawful food is tied to accepted supplication. Tayyib means wholesome, so avoid harm and excess too.', 'q2_172 h_m1015 q7_31 h_ibm2341'],
      ['Reading a label quickly', 'Look first for a trusted halal logo. Then scan for: pork, lard, gelatin, alcohol, wine, E120, E441, E471, E542, E904, E920, "enzymes", "animal fat", cheese/whey. In India, a green dot means vegetarian.', 's_cert']
    ];
    var box = document.getElementById('principles');
    box.textContent = '';
    box.appendChild(el('h2', { text: 'Principles of halal and haram' }));
    P.forEach(function (p) {
      box.appendChild(el('details', { class: 'ing principle' }, [
        el('summary', null, [el('span', { class: 'ing-name', text: p[0] })]),
        el('div', { class: 'ing-body' }, [el('p', { text: p[1] }), evidenceList(p[2])])
      ]));
    });
  };
})();
