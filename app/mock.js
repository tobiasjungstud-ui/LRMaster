/*
 * LRMaster mock — builds a screenshot-like picture of a reading text: the
 * medium it would really appear in (browser window with a blog post, a mail
 * client, a forum thread, a chat). The layout is computed here as a list of
 * drawing blocks, so the same model can be drawn onto a canvas (the image the
 * teacher downloads) and checked in the tests without a browser. Text runs
 * carry a role: "body" is the generated text itself and must come through
 * unchanged, "chrome" is the interface around it (URL, site name, likes …)
 * which Claude writes. No content strings live in this file.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else { root.LR = root.LR || {}; root.LR.mock = factory(root.LR.core); }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  const SANS = '"Source Sans 3", "Helvetica Neue", Arial, sans-serif';
  const SERIF = '"Source Serif 4", Georgia, "Times New Roman", serif';
  const DISPLAY = '"Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif';
  const MONO = '"IBM Plex Mono", "Courier New", monospace';

  /*
   * Which medium a text type is shown in and how that medium looks. `kind`
   * picks the frame, the rest is the visual signature of the platform.
   */
  const LAYOUTS = {
    blog: { kind: 'page', label: 'Blog post', accent: '#7C3AED', title: DISPLAY, body: SERIF, ui: SANS, sidebar: true, actions: true, kicker: true },
    article: { kind: 'page', label: 'Magazine article', accent: '#B45309', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: true, kicker: true, columns: 1 },
    news: { kind: 'page', label: 'News site', accent: '#B91C1C', title: DISPLAY, body: SERIF, ui: SANS, sidebar: true, actions: true, kicker: true, breaking: true },
    opinion: { kind: 'page', label: 'Opinion piece', accent: '#0F766E', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: true, kicker: true },
    informational: { kind: 'page', label: 'Information page', accent: '#1D4ED8', title: SANS, body: SANS, ui: SANS, sidebar: true, actions: false },
    report: { kind: 'page', label: 'Report', accent: '#334155', title: SANS, body: SANS, ui: SANS, sidebar: false, actions: false },
    review: { kind: 'page', label: 'Review', accent: '#C2410C', title: DISPLAY, body: SERIF, ui: SANS, sidebar: false, actions: true, stars: true, kicker: true },
    interview: { kind: 'page', label: 'Interview', accent: '#7E22CE', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: true, kicker: true, qa: true },
    story: { kind: 'page', label: 'Story', accent: '#475569', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: false, reader: true },
    diary: { kind: 'page', label: 'Diary', accent: '#9D174D', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: false, paper: true },
    email: { kind: 'mail', label: 'Mail client', accent: '#1D4ED8', title: SANS, body: SANS, ui: SANS },
    forum: { kind: 'thread', label: 'Forum thread', accent: '#EA580C', title: SANS, body: SANS, ui: SANS },
    dialogue: { kind: 'chat', label: 'Messenger', accent: '#16A34A', title: SANS, body: SANS, ui: SANS },
    custom: { kind: 'page', label: 'Web page', accent: '#0F766E', title: SANS, body: SERIF, ui: SANS, actions: true },
  };

  /*
   * What the interface around the text shows. Claude fills these in per text
   * type; `required` is what the check insists on.
   */
  const CHROME_SPECS = {
    page: {
      fields: [
        ['url', 'the address bar content, e.g. "www.thecitypost.co.uk/culture/why-we-still-queue"'],
        ['siteName', 'the name of the site as it stands in the header'],
        ['navItems', 'an array of 3–5 very short navigation labels of that site'],
        ['authorInitials', 'one or two letters for the round avatar next to the author name'],
        ['metaLine', 'the small line next to the author, e.g. "14 March · 4 min read"'],
        ['actions', 'an array of 2–4 interface buttons as {"label": "…", "count": "…"} — count may be an empty string'],
        ['sidebarTitle', 'heading of the box beside the text, e.g. "Most read"'],
        ['sidebarItems', 'an array of 3–4 short headlines in that box — invented, about the same world, never sentences from the text'],
        ['footerNote', 'one short line at the bottom of the page, e.g. a copyright line'],
      ],
      required: ['url', 'siteName', 'navItems', 'actions'],
    },
    mail: {
      fields: [
        ['appName', 'name shown in the title bar of the mail program'],
        ['mailboxItems', 'an array of 3–4 folder names in the sidebar'],
        ['authorInitials', 'one or two letters for the round avatar of the sender'],
        ['metaLine', 'the small line under the sender, e.g. "to me · 14 March, 09:12"'],
        ['actions', 'an array of 2–4 buttons as {"label": "…", "count": ""}'],
      ],
      required: ['appName', 'mailboxItems', 'actions'],
    },
    thread: {
      fields: [
        ['url', 'the address bar content'],
        ['siteName', 'name of the board'],
        ['navItems', 'an array of 3–5 short board navigation labels'],
        ['actions', 'an array of 2–4 buttons as {"label": "…", "count": "…"}'],
        ['postMeta', 'an array with one short line per paragraph, e.g. "12 upvotes · 3 replies"'],
        ['footerNote', 'one short line at the bottom'],
      ],
      required: ['url', 'siteName', 'postMeta'],
    },
    chat: {
      fields: [
        ['appName', 'name of the messenger'],
        ['deviceTime', 'the clock in the status bar, e.g. "14:32"'],
        ['contactName', 'the name at the top of the chat'],
        ['authorInitials', 'one or two letters for the contact avatar'],
        ['bubbleTimes', 'an array with one short time per message, e.g. "14:28"'],
        ['statusLine', 'the small line under the contact name, e.g. "online"'],
      ],
      required: ['appName', 'contactName', 'bubbleTimes'],
    },
  };

  function layoutFor(material) {
    const id = core.designIdFor(material.settings || {});
    return LAYOUTS[id] || LAYOUTS.custom;
  }
  function chromeSpec(material) {
    const d = layoutFor(material);
    return Object.assign({ kind: d.kind, label: d.label }, CHROME_SPECS[d.kind]);
  }

  /* ------------------------------------------------------------------ */
  /* Measuring and wrapping                                               */
  /* ------------------------------------------------------------------ */

  /** Rough width per character, by font family class — used where no canvas is available. */
  function approxMeasure(text, font) {
    const f = font.family || SANS;
    const cls = /Mono|Courier/.test(f) ? 0.6 : /Serif|Georgia|Times/.test(f) ? 0.5 : 0.52;
    const bold = (font.weight || 400) >= 600 ? 1.04 : 1;
    return String(text).length * font.size * cls * bold;
  }

  /** Greedy word wrap; `measure(text, font)` returns a pixel width. */
  function wrap(text, font, maxWidth, measure) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (line && measure(next, font) > maxWidth) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /* ------------------------------------------------------------------ */
  /* Model builder                                                        */
  /* ------------------------------------------------------------------ */

  function builder(width, measure) {
    const blocks = [];
    const api = {
      y: 0,
      blocks,
      rect(x, y, w, h, o) { blocks.push(Object.assign({ type: 'rect', x, y, w, h, fill: '#FFFFFF' }, o || {})); return api; },
      line(x1, y1, x2, y2, o) { blocks.push(Object.assign({ type: 'line', x1, y1, x2, y2, color: '#E2E8F0', width: 1 }, o || {})); return api; },
      circle(x, y, r, o) { blocks.push(Object.assign({ type: 'circle', x, y, r, fill: '#CBD5E1' }, o || {})); return api; },
      /** One line of text, no wrapping. */
      text(x, y, str, font, o) {
        blocks.push(Object.assign({ type: 'text', x, y, text: String(str == null ? '' : str), font, color: '#0F172A', role: 'chrome', align: 'left' }, o || {}));
        return api;
      },
      /** Wrapped paragraph; returns the y below it. */
      para(x, y, str, font, maxWidth, o) {
        const lh = (o && o.lineHeight) || font.size * 1.45;
        wrap(str, font, maxWidth, measure).forEach((l, i) => api.text(x, y + i * lh, l, font, o));
        return y + wrap(str, font, maxWidth, measure).length * lh;
      },
      pill(x, y, w, h, str, font, o) {
        api.rect(x, y, w, h, { fill: (o && o.fill) || '#F1F5F9', radius: h / 2, stroke: (o && o.stroke) || null });
        api.text(x + 12, y + h / 2 + font.size * 0.36, str, font, { color: (o && o.color) || '#475569' });
        return api;
      },
    };
    return api;
  }

  const INK = '#0F172A', MUTED = '#64748B', LINE = '#E2E8F0', SOFT = '#F8FAFC';

  /** Browser window frame; returns the y where the page content starts. */
  function browserFrame(b, W, url, accent) {
    b.rect(0, 0, W, 2000, { fill: '#E2E8F0' });
    b.rect(0, 0, W, 52, { fill: '#F1F5F9' });
    ['#F87171', '#FBBF24', '#34D399'].forEach((c, i) => b.circle(26 + i * 20, 26, 6, { fill: c }));
    b.rect(96, 13, W - 140, 26, { fill: '#FFFFFF', radius: 13, stroke: '#CBD5E1' });
    b.circle(112, 26, 5, { fill: accent });
    b.text(126, 31, url, { family: MONO, size: 12 }, { color: MUTED });
    b.line(0, 52, W, 52, { color: '#CBD5E1' });
    return 52;
  }

  function avatar(b, x, y, r, initials, accent) {
    b.circle(x, y, r, { fill: accent });
    b.text(x, y + r * 0.35, initials, { family: SANS, size: r, weight: 700 }, { color: '#FFFFFF', align: 'center' });
  }

  function actionRow(b, x, y, actions, font) {
    let cx = x;
    for (const a of actions) {
      const label = (a.label || '') + (a.count ? '  ' + a.count : '');
      const w = Math.max(70, approxMeasure(label, font) + 30);
      b.pill(cx, y, w, 30, label, font, {});
      cx += w + 10;
    }
    return y + 30;
  }

  /* --- page: blog, article, news, review, story … --------------------- */
  function pageModel(m, chrome, d, measure) {
    const W = 1000;
    const b = builder(W, measure);
    const meta = m.content.meta || {};
    const hasSide = d.sidebar && (chrome.sidebarItems || []).length;
    const PAD = 56;
    const colW = hasSide ? 600 : W - 2 * PAD;
    let y = browserFrame(b, W, chrome.url, d.accent);

    // site header
    b.rect(0, y, W, 64, { fill: '#FFFFFF' });
    b.text(PAD, y + 40, chrome.siteName, { family: d.title, size: 22, weight: 700 }, { color: d.accent });
    let nx = PAD + approxMeasure(chrome.siteName, { family: d.title, size: 22, weight: 700 }) + 40;
    for (const item of (chrome.navItems || []).slice(0, 5)) {
      b.text(nx, y + 40, item, { family: d.ui, size: 13 }, { color: MUTED });
      nx += approxMeasure(item, { family: d.ui, size: 13 }) + 26;
    }
    y += 64;
    b.line(0, y, W, y, { color: LINE });
    b.rect(0, y, W, 1400, { fill: d.paper ? '#FFFBF5' : '#FFFFFF' });
    y += 36;

    // kicker, headline, stand-first
    if (d.kicker) {
      const kicker = meta.section || meta.publication || meta.blogName || d.label;
      b.text(PAD, y, String(kicker).toUpperCase(), { family: d.ui, size: 11, weight: 700 }, { color: d.accent });
      y += 22;
    }
    y = b.para(PAD, y + 12, m.content.title, { family: d.title, size: d.title === SERIF ? 40 : 36, weight: 700 }, colW, { lineHeight: 46, color: INK });
    if (d.stars && chrome.rating) {
      b.text(PAD, y + 22, chrome.rating, { family: d.ui, size: 18 }, { color: d.accent });
      y += 26;
    }
    if (meta.standfirst) y = b.para(PAD, y + 20, meta.standfirst, { family: d.body, size: 18, style: 'italic' }, colW, { color: MUTED });

    // byline
    y += 26;
    avatar(b, PAD + 18, y + 4, 18, chrome.authorInitials || '', d.accent);
    b.text(PAD + 48, y, meta.byline || '', { family: d.ui, size: 14, weight: 600 }, { color: INK });
    b.text(PAD + 48, y + 18, chrome.metaLine || meta.dateline || '', { family: d.ui, size: 12 }, { color: MUTED });
    y += 36;
    b.line(PAD, y, PAD + colW, y, { color: LINE });
    y += 26;

    // body
    const bodyFont = { family: d.body, size: 17 };
    for (const p of m.content.paragraphs || []) {
      const heading = p.length < 60 && !/[.!?]$/.test(p.trim());
      if (heading) {
        y = b.para(PAD, y, p, { family: d.title, size: 20, weight: 700 }, colW, { color: INK, role: 'body' }) + 8;
      } else {
        y = b.para(PAD, y, p, bodyFont, colW, { color: INK, role: 'body', lineHeight: 27 }) + 16;
      }
    }
    if (meta.pullQuote) {
      b.line(PAD, y + 6, PAD + colW, y + 6, { color: d.accent, width: 3 });
      y = b.para(PAD, y + 34, meta.pullQuote, { family: d.body, size: 20, style: 'italic' }, colW, { color: d.accent });
      b.line(PAD, y + 12, PAD + colW, y + 12, { color: d.accent, width: 3 });
      y += 26;
    }
    if ((meta.tags || []).length) {
      let tx = PAD;
      for (const t of meta.tags.slice(0, 5)) {
        const font = { family: d.ui, size: 12 };
        const w = approxMeasure('#' + t, font) + 24;
        b.pill(tx, y + 8, w, 26, '#' + t, font, { fill: '#EEF2FF', color: d.accent });
        tx += w + 8;
      }
      y += 42;
    }
    if (d.actions && (chrome.actions || []).length) y = actionRow(b, PAD, y + 10, chrome.actions, { family: d.ui, size: 13 }) + 18;

    // sidebar
    if (hasSide) {
      const sx = PAD + colW + 40;
      let sy = 200;
      b.rect(sx - 16, sy - 28, W - sx - PAD + 32, 40 + (chrome.sidebarItems.length) * 52, { fill: SOFT, radius: 10, stroke: LINE });
      b.text(sx, sy, String(chrome.sidebarTitle || '').toUpperCase(), { family: d.ui, size: 11, weight: 700 }, { color: d.accent });
      sy += 24;
      chrome.sidebarItems.slice(0, 4).forEach((it, i) => {
        b.text(sx - 14, sy + 14, String(i + 1), { family: d.title, size: 20, weight: 700 }, { color: '#CBD5E1' });
        sy = b.para(sx + 14, sy, it, { family: d.ui, size: 13, weight: 600 }, W - sx - PAD - 20, { color: INK, lineHeight: 18 }) + 16;
      });
    }

    y += 20;
    b.line(0, y, W, y, { color: LINE });
    b.text(PAD, y + 26, chrome.footerNote || '', { family: d.ui, size: 12 }, { color: MUTED });
    return finish(b, W, y + 52);
  }

  /* --- mail client ---------------------------------------------------- */
  function mailModel(m, chrome, d, measure) {
    const W = 1000;
    const b = builder(W, measure);
    const meta = m.content.meta || {};
    const SIDE = 200, PAD = 32;
    let y = 0;
    b.rect(0, 0, W, 2000, { fill: '#FFFFFF' });
    b.rect(0, 0, W, 48, { fill: d.accent });
    b.text(PAD, 31, chrome.appName, { family: d.ui, size: 15, weight: 700 }, { color: '#FFFFFF' });
    y = 48;
    b.rect(0, y, SIDE, 1400, { fill: SOFT });
    b.line(SIDE, y, SIDE, 1400, { color: LINE });
    let sy = y + 34;
    (chrome.mailboxItems || []).slice(0, 4).forEach((it, i) => {
      if (i === 0) b.rect(12, sy - 18, SIDE - 24, 30, { fill: '#E2E8F0', radius: 8 });
      b.text(24, sy, it, { family: d.ui, size: 13, weight: i === 0 ? 700 : 400 }, { color: i === 0 ? INK : MUTED });
      sy += 34;
    });

    const x = SIDE + PAD, colW = W - SIDE - 2 * PAD;
    y += 30;
    y = b.para(x, y, meta.subject || m.content.title, { family: d.title, size: 24, weight: 700 }, colW, { color: INK, lineHeight: 30 }) + 18;
    avatar(b, x + 20, y + 2, 20, chrome.authorInitials || '', d.accent);
    b.text(x + 52, y - 2, meta.from || '', { family: d.ui, size: 14, weight: 600 }, { color: INK });
    b.text(x + 52, y + 18, chrome.metaLine || meta.sent || '', { family: d.ui, size: 12 }, { color: MUTED });
    y += 42;
    b.line(x, y, x + colW, y, { color: LINE });
    y += 26;
    for (const p of m.content.paragraphs || []) y = b.para(x, y, p, { family: d.body, size: 15 }, colW, { color: INK, role: 'body', lineHeight: 24 }) + 16;
    if (meta.signature) {
      b.line(x, y + 6, x + 180, y + 6, { color: LINE });
      for (const l of String(meta.signature).split('\n')) { b.text(x, y + 30, l, { family: d.ui, size: 13 }, { color: MUTED }); y += 20; }
      y += 16;
    }
    if ((chrome.actions || []).length) y = actionRow(b, x, y + 10, chrome.actions, { family: d.ui, size: 13 }) + 16;
    return finish(b, W, y + 40);
  }

  /* --- forum thread ---------------------------------------------------- */
  function threadModel(m, chrome, d, measure) {
    const W = 1000;
    const b = builder(W, measure);
    const meta = m.content.meta || {};
    const PAD = 48;
    let y = browserFrame(b, W, chrome.url, d.accent);
    b.rect(0, y, W, 56, { fill: '#FFFFFF' });
    b.text(PAD, y + 36, chrome.siteName, { family: d.title, size: 20, weight: 700 }, { color: d.accent });
    let nx = PAD + approxMeasure(chrome.siteName, { family: d.title, size: 20, weight: 700 }) + 32;
    for (const item of (chrome.navItems || []).slice(0, 5)) {
      b.text(nx, y + 36, item, { family: d.ui, size: 13 }, { color: MUTED });
      nx += approxMeasure(item, { family: d.ui, size: 13 }) + 24;
    }
    y += 56;
    b.rect(0, y, W, 1600, { fill: '#F1F5F9' });
    y += 28;
    y = b.para(PAD, y, meta.threadTitle || m.content.title, { family: d.title, size: 26, weight: 700 }, W - 2 * PAD, { color: INK, lineHeight: 32 }) + 18;

    const authors = meta.authors || [];
    const stamps = meta.timestamps || [];
    const postMeta = chrome.postMeta || [];
    (m.content.paragraphs || []).forEach((p, i) => {
      const cardTop = y;
      const inner = W - 2 * PAD - 110;
      avatar(b, PAD + 38, cardTop + 40, 18, String(authors[i] || '').slice(0, 2).toUpperCase(), d.accent);
      b.text(PAD + 70, cardTop + 32, authors[i] || '', { family: d.ui, size: 13, weight: 700 }, { color: INK });
      b.text(PAD + 70 + approxMeasure(authors[i] || '', { family: d.ui, size: 13, weight: 700 }) + 14, cardTop + 32, stamps[i] || '', { family: d.ui, size: 12 }, { color: MUTED });
      const end = b.para(PAD + 70, cardTop + 58, p, { family: d.body, size: 15 }, inner, { color: INK, role: 'body', lineHeight: 24 });
      b.text(PAD + 70, end + 22, postMeta[i] || '', { family: d.ui, size: 12 }, { color: MUTED });
      const h = end + 40 - cardTop;
      b.blocks.unshift({ type: 'rect', x: PAD, y: cardTop, w: W - 2 * PAD, h, fill: '#FFFFFF', radius: 10, stroke: LINE });
      y = cardTop + h + 16;
    });
    b.text(PAD, y + 22, chrome.footerNote || '', { family: d.ui, size: 12 }, { color: MUTED });
    return finish(b, W, y + 48);
  }

  /* --- messenger chat --------------------------------------------------- */
  function chatModel(m, chrome, d, measure) {
    const W = 520;
    const b = builder(W, measure);
    let y = 0;
    b.rect(0, 0, W, 1600, { fill: '#ECE5DD' });
    b.rect(0, 0, W, 34, { fill: '#0B3D2E' });
    b.text(20, 22, chrome.deviceTime || '', { family: d.ui, size: 12, weight: 600 }, { color: '#FFFFFF' });
    b.text(W - 96, 22, chrome.appName, { family: d.ui, size: 11 }, { color: '#CBD5E1' });
    for (let i = 0; i < 4; i++) b.rect(W - 40 + i * 5, 14 - i, 3, 8 + i * 2, { fill: '#FFFFFF' });
    y = 34;
    b.rect(0, y, W, 58, { fill: d.accent });
    avatar(b, 36, y + 29, 17, chrome.authorInitials || '', '#0B3D2E');
    b.text(66, y + 26, chrome.contactName || '', { family: d.ui, size: 15, weight: 700 }, { color: '#FFFFFF' });
    b.text(66, y + 44, chrome.statusLine || '', { family: d.ui, size: 11 }, { color: '#E2E8F0' });
    y += 58 + 18;

    const times = chrome.bubbleTimes || [];
    (m.content.paragraphs || []).forEach((p, i) => {
      const mine = i % 2 === 1;
      const maxW = W - 150;
      const font = { family: d.body, size: 14 };
      const lines = wrap(p, font, maxW, measure);
      const textW = Math.min(maxW, Math.max(...lines.map(l => measure(l, font))));
      const bw = textW + 28, bh = lines.length * 21 + 34;
      const bx = mine ? W - 20 - bw : 20;
      b.rect(bx, y, bw, bh, { fill: mine ? '#DCF8C6' : '#FFFFFF', radius: 12 });
      lines.forEach((l, k) => b.text(bx + 14, y + 24 + k * 21, l, font, { color: INK, role: 'body' }));
      b.text(bx + bw - 44, y + bh - 10, times[i] || '', { family: d.ui, size: 10 }, { color: MUTED });
      y += bh + 10;
    });
    y += 8;
    b.rect(0, y, W, 52, { fill: '#F1F5F9' });
    b.rect(16, y + 10, W - 80, 32, { fill: '#FFFFFF', radius: 16, stroke: LINE });
    b.circle(W - 34, y + 26, 16, { fill: d.accent });
    return finish(b, W, y + 52);
  }

  function finish(b, width, height) {
    const h = Math.ceil(height);
    // background blocks were drawn tall on purpose; clip them to the real height
    const blocks = b.blocks.map(x => (x.type === 'rect' && x.h > h ? Object.assign({}, x, { h }) : x));
    return { width, height: h, blocks };
  }

  /* ------------------------------------------------------------------ */
  /* Public                                                               */
  /* ------------------------------------------------------------------ */

  /** The drawing model of the screenshot; `opts.measure` defaults to the metric estimate. */
  function buildModel(material, chrome, opts) {
    opts = opts || {};
    const measure = opts.measure || approxMeasure;
    const d = layoutFor(material);
    const c = chrome || {};
    const model = d.kind === 'mail' ? mailModel(material, c, d, measure)
      : d.kind === 'thread' ? threadModel(material, c, d, measure)
      : d.kind === 'chat' ? chatModel(material, c, d, measure)
      : pageModel(material, c, d, measure);
    model.kind = d.kind;
    model.label = d.label;
    model.designId = core.designIdFor(material.settings || {});
    return model;
  }

  /** Everything the picture shows of the generated text itself. */
  function bodyText(model) {
    return (model.blocks || []).filter(x => x.type === 'text' && x.role === 'body').map(x => x.text).join(' ');
  }
  /** Everything the interface around it shows. */
  function chromeText(model) {
    return (model.blocks || []).filter(x => x.type === 'text' && x.role !== 'body').map(x => x.text).join(' ');
  }

  /** Structural check of the picture itself, before it is handed out. */
  function validate(model) {
    const problems = [];
    if (!model || !Array.isArray(model.blocks) || !model.blocks.length) return ['no drawing blocks'];
    if (!(model.width > 200) || !(model.height > 200)) problems.push('implausible image size');
    if (model.height > 12000) problems.push('image too high: ' + model.height);
    for (const x of model.blocks) {
      if (x.type === 'text') {
        if (typeof x.text !== 'string') problems.push('text block without text');
        if (!x.font || !x.font.size || !x.font.family) problems.push('text block without font');
        if (x.y > model.height + 2 || x.y < 0) problems.push('text outside the picture at y=' + Math.round(x.y));
      } else if (x.type === 'rect') {
        if (!(x.w > 0) || !(x.h > 0)) problems.push('rectangle without size');
      }
    }
    return [...new Set(problems)];
  }

  /* ------------------------------------------------------------------ */
  /* Drawing (browser)                                                    */
  /* ------------------------------------------------------------------ */

  function fontString(f) {
    return `${f.style || 'normal'} ${f.weight || 400} ${f.size}px ${f.family}`;
  }

  /** Draw the model onto a canvas 2D context, ready to be exported as PNG. */
  function draw(ctx, model) {
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, model.width, model.height);
    for (const b of model.blocks) {
      if (b.type === 'rect') {
        ctx.beginPath();
        roundRect(ctx, b.x, b.y, b.w, b.h, b.radius || 0);
        ctx.fillStyle = b.fill || '#FFFFFF';
        ctx.fill();
        if (b.stroke) { ctx.strokeStyle = b.stroke; ctx.lineWidth = 1; ctx.stroke(); }
      } else if (b.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2);
        ctx.strokeStyle = b.color; ctx.lineWidth = b.width || 1; ctx.stroke();
      } else if (b.type === 'circle') {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.fill; ctx.fill();
      } else if (b.type === 'text') {
        ctx.font = fontString(b.font);
        ctx.fillStyle = b.color || INK;
        ctx.textAlign = b.align || 'left';
        ctx.fillText(b.text, b.x, b.y);
      }
    }
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /** Measure through a canvas, so the picture uses the real font metrics. */
  function canvasMeasure(canvas) {
    const ctx = canvas.getContext('2d');
    const cache = new Map();
    return (text, font) => {
      const key = fontString(font) + '|' + text;
      if (cache.has(key)) return cache.get(key);
      ctx.font = fontString(font);
      const w = ctx.measureText(text).width;
      cache.set(key, w);
      return w;
    };
  }

  return { LAYOUTS, CHROME_SPECS, layoutFor, chromeSpec, buildModel, bodyText, chromeText, validate, draw, canvasMeasure, approxMeasure, wrap, fontString };
});
