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
    blog: { kind: 'page', label: 'Blog post', accent: '#7C3AED', title: DISPLAY, body: SERIF, ui: SANS, sidebar: true, actions: true, kicker: true,
      print: { kind: 'sheet', label: 'Ausgedruckte Seite', paper: '#FFFFFF', auto: false } },
    article: { kind: 'page', label: 'Magazine article', accent: '#B45309', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: true, kicker: true,
      print: { kind: 'press', label: 'Magazine page', columns: 2, paper: '#FBF8F1', dropCap: true, photo: true } },
    news: { kind: 'page', label: 'News site', accent: '#B91C1C', title: DISPLAY, body: SERIF, ui: SANS, sidebar: true, actions: true, kicker: true, breaking: true,
      print: { kind: 'press', label: 'Zeitungsseite', columns: 3, paper: '#F7F4EC', masthead: true, photo: true, rules: true } },
    opinion: { kind: 'page', label: 'Opinion piece', accent: '#0F766E', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: true, kicker: true,
      print: { kind: 'press', label: 'Kommentarseite', columns: 2, paper: '#F7F4EC', rules: true } },
    informational: { kind: 'page', label: 'Information page', accent: '#1D4ED8', title: SANS, body: SANS, ui: SANS, sidebar: true, actions: false,
      print: { kind: 'sheet', label: 'Infoblatt', paper: '#FFFDF8' } },
    report: { kind: 'page', label: 'Report', accent: '#334155', title: SANS, body: SANS, ui: SANS, sidebar: false, actions: false,
      print: { kind: 'sheet', label: 'Ausgedruckter Bericht', paper: '#FFFFFF', header: true } },
    review: { kind: 'page', label: 'Review', accent: '#C2410C', title: DISPLAY, body: SERIF, ui: SANS, sidebar: false, actions: true, stars: true, kicker: true,
      print: { kind: 'press', label: 'Kritik im Blatt', columns: 2, paper: '#FBF8F1', stars: true } },
    interview: { kind: 'page', label: 'Interview', accent: '#7E22CE', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: true, kicker: true, qa: true,
      print: { kind: 'press', label: 'Interview im Blatt', columns: 2, paper: '#FBF8F1', photo: true } },
    story: { kind: 'page', label: 'Story', accent: '#475569', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: false, reader: true,
      print: { kind: 'book', label: 'Buchseite', paper: '#FAF6EC' } },
    diary: { kind: 'page', label: 'Diary', accent: '#9D174D', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: false,
      print: { kind: 'notebook', label: 'Tagebuchseite', paper: '#FFFDF5', hand: true } },
    email: { print: { kind: 'sheet', label: 'Ausgedruckte Mail', paper: '#FFFFFF', auto: false }, kind: 'mail', label: 'Mail client', accent: '#1D4ED8', title: SANS, body: SANS, ui: SANS },
    forum: { print: { kind: 'sheet', label: 'Ausgedruckter Thread', paper: '#FFFFFF', auto: false }, kind: 'thread', label: 'Forum thread', accent: '#EA580C', title: SANS, body: SANS, ui: SANS },
    dialogue: { print: { kind: 'sheet', label: 'Ausgedruckter Chat', paper: '#FFFFFF', auto: false }, kind: 'chat', label: 'Messenger', accent: '#16A34A', title: SANS, body: SANS, ui: SANS },
    custom: { print: { kind: 'sheet', label: 'Ausgedruckte Seite', paper: '#FFFFFF', auto: false }, kind: 'page', label: 'Web page', accent: '#0F766E', title: SANS, body: SERIF, ui: SANS, actions: true },
  };
  const HAND = '"Caveat", "Bradley Hand", "Segoe Script", "Comic Sans MS", cursive';

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
    print: {
      fields: [
        ['publication', 'name of the paper, magazine, book or notebook as it is printed at the top'],
        ['publicationLine', 'the small line beside it: place, weekday and date, edition or price'],
        ['sectionLabel', 'the section this page belongs to, e.g. "Culture" or "Chapter 4"'],
        ['photoCaption', 'the caption under the picture on the page — describe what the photo shows, one sentence, nothing from the text'],
        ['captionCredit', 'the small credit under the caption, e.g. a photographer or agency name'],
        ['pageLabel', 'what stands in the page footer, e.g. "Page 7" or the date'],
        ['footerNote', 'one short line at the very bottom, e.g. a website or a continuation note'],
      ],
      required: ['publication', 'publicationLine', 'photoCaption'],
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

  /*
   * Which medium the text is shown in. Print media (newspaper, magazine,
   * book, notebook) are photographed pages, everything else is a screenshot;
   * the teacher can force either with the setting "layoutMedium".
   */
  function layoutFor(material) {
    const s = material.settings || {};
    const d = LAYOUTS[core.designIdFor(s)] || LAYOUTS.custom;
    const wish = s.layoutMedium || 'auto';
    const onPaper = d.print && (wish === 'paper' || (wish === 'auto' && d.print.auto !== false));
    if (!onPaper) return Object.assign({}, d, { medium: 'screen' });
    return Object.assign({}, d, d.print, { kind: 'print', medium: 'paper', label: d.print.label, print: d.print });
  }
  function chromeSpec(material) {
    const d = layoutFor(material);
    const key = d.kind === 'print' ? 'print' : d.kind;
    return Object.assign({ kind: key, label: d.label, medium: d.medium }, CHROME_SPECS[key]);
  }

  /**
   * What can be told about the medium from the material itself — used as the
   * starting point so that a picture always exists, even when the interface
   * data from Claude is missing. Everything here comes from the generated
   * meta block; nothing is invented in this file.
   */
  function fallbackChrome(material) {
    const meta = (material.content && material.content.meta) || {};
    const title = (material.content && material.content.title) || '';
    const site = meta.publication || meta.blogName || meta.forumName || '';
    const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
    const host = String(site).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const initials = String(meta.byline || meta.from || '').trim().split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
    return {
      url: host ? `www.${host}.com/${slug}` : '',
      siteName: site,
      navItems: [],
      authorInitials: initials,
      metaLine: [meta.dateline, meta.readingTime].filter(Boolean).join(' · '),
      actions: [],
      sidebarTitle: '', sidebarItems: [], footerNote: '',
      appName: site, mailboxItems: [], postMeta: (meta.authors || []).map(() => ''),
      deviceTime: '', contactName: meta.byline || '', bubbleTimes: (material.content.paragraphs || []).map(() => ''), statusLine: '',
      publication: site, publicationLine: [meta.dateline, meta.location].filter(Boolean).join(' · '),
      sectionLabel: meta.section || '', photoCaption: '', captionCredit: '', pageLabel: meta.dateline || '',
    };
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

  /* ------------------------------------------------------------------ */
  /* Printed media: a photographed page instead of a screenshot           */
  /* ------------------------------------------------------------------ */

  const PAGE_PAD = 46; // the surface the page lies on

  /** Wrapped body lines, poured into `cols` columns of equal height. */
  function flowColumns(paragraphs, font, colW, cols, measure, lineHeight) {
    const items = [];
    for (const p of paragraphs) {
      const lines = wrap(p, font, colW, measure);
      lines.forEach((l, i) => items.push({ text: l, first: i === 0, last: i === lines.length - 1 }));
      items.push({ gap: true });
    }
    while (items.length && items[items.length - 1].gap) items.pop();
    const perCol = Math.ceil(items.length / cols);
    const out = [];
    let col = 0, y = 0;
    for (let i = 0; i < items.length; i++) {
      if (i > 0 && i % perCol === 0 && col < cols - 1) { col += 1; y = 0; }
      const it = items[i];
      if (!it.gap) out.push({ text: it.text, col, y });
      y += it.gap ? lineHeight * 0.55 : lineHeight;
    }
    return { placed: out, height: perCol * lineHeight };
  }

  /** Newspaper or magazine page. */
  function pressModel(m, chrome, d, measure) {
    const W = 1060;
    const b = builder(W, measure);
    const meta = m.content.meta || {};
    const P = PAGE_PAD, M = 56;
    const pageW = W - 2 * P, inner = pageW - 2 * M;
    const cols = d.columns || 3;
    const gutter = 26;
    const colW = (inner - gutter * (cols - 1)) / cols;
    let y = P + 40;
    // masthead
    b.text(W / 2, y, String(chrome.publication || '').toUpperCase(), { family: SERIF, size: d.masthead ? 44 : 34, weight: 700 }, { color: INK, align: 'center', letterSpacing: 2 });
    y += 16;
    b.line(P + M, y, W - P - M, y, { color: INK, width: 2 });
    y += 8;
    b.text(P + M, y + 12, String(chrome.publicationLine || ''), { family: SANS, size: 11 }, { color: '#44403C' });
    b.text(W - P - M, y + 12, String(chrome.sectionLabel || '').toUpperCase(), { family: SANS, size: 11, weight: 700 }, { color: '#44403C', align: 'right' });
    y += 20;
    b.line(P + M, y, W - P - M, y, { color: INK, width: 1 });
    y += 34;
    // headline
    y = b.para(P + M, y, m.content.title, { family: SERIF, size: cols >= 3 ? 42 : 38, weight: 700 }, inner, { lineHeight: 46, color: INK });
    if (meta.standfirst) y = b.para(P + M, y + 22, meta.standfirst, { family: SERIF, size: 17, style: 'italic' }, inner * 0.8, { color: '#44403C', lineHeight: 24 });
    y += 24;
    const byline = [meta.byline ? 'By ' + meta.byline : '', meta.location, meta.dateline].filter(Boolean).join('  ·  ');
    if (byline) { b.text(P + M, y, byline.toUpperCase(), { family: SANS, size: 10, weight: 700 }, { color: '#57534E', letterSpacing: 1 }); y += 14; }
    b.line(P + M, y, W - P - M, y, { color: '#A8A29E' });
    y += 22;
    // photo across the first columns
    if (d.photo !== false) {
      const photoW = cols >= 3 ? colW * 2 + gutter : inner;
      const photoH = Math.round(photoW * 0.42);
      b.blocks.push({ type: 'photo', x: P + M, y, w: photoW, h: photoH, seed: (m.content.title || '').length });
      let cy = y + photoH + 14;
      cy = b.para(P + M, cy, chrome.photoCaption || '', { family: SANS, size: 11.5, style: 'italic' }, photoW, { color: '#44403C', lineHeight: 16 });
      if (chrome.captionCredit) { b.text(P + M, cy + 4, String(chrome.captionCredit).toUpperCase(), { family: SANS, size: 9 }, { color: '#78716C', letterSpacing: 0.6 }); cy += 14; }
      y = cy + 16;
    }
    // body in columns
    const font = { family: SERIF, size: 14.5 };
    const lh = 21;
    const flow = flowColumns(m.content.paragraphs || [], font, colW, cols, measure, lh);
    for (const l of flow.placed) b.text(P + M + l.col * (colW + gutter), y + l.y + lh, l.text, font, { color: INK, role: 'body' });
    for (let c = 1; c < cols; c++) {
      const x = P + M + c * (colW + gutter) - gutter / 2;
      b.line(x, y, x, y + flow.height, { color: '#D6D3D1' });
    }
    y += flow.height + 26;
    b.line(P + M, y, W - P - M, y, { color: '#A8A29E' });
    b.text(P + M, y + 18, String(chrome.footerNote || ''), { family: SANS, size: 10 }, { color: '#78716C' });
    b.text(W - P - M, y + 18, String(chrome.pageLabel || ''), { family: SANS, size: 10, weight: 700 }, { color: '#78716C', align: 'right' });
    return paperFinish(b, W, y + 40 + P, d);
  }

  /** A page out of a book. */
  function bookModel(m, chrome, d, measure) {
    const W = 780;
    const b = builder(W, measure);
    const P = PAGE_PAD, M = 92;
    const inner = W - 2 * P - 2 * M;
    let y = P + 56;
    b.text(W / 2, y, String(chrome.publication || '').toUpperCase(), { family: SERIF, size: 10 }, { color: '#78716C', align: 'center', letterSpacing: 2 });
    y += 40;
    if (chrome.sectionLabel) { b.text(W / 2, y, String(chrome.sectionLabel).toUpperCase(), { family: SERIF, size: 11, weight: 700 }, { color: '#57534E', align: 'center', letterSpacing: 2 }); y += 28; }
    y = b.para(W / 2, y + 10, m.content.title, { family: SERIF, size: 26, weight: 700 }, inner, { color: INK, align: 'center', lineHeight: 32 }) + 28;
    const font = { family: SERIF, size: 15 };
    (m.content.paragraphs || []).forEach((p, i) => {
      const lines = wrap(p, font, inner, measure);
      lines.forEach((l, k) => b.text(P + M + (k === 0 && i > 0 ? 22 : 0), y + k * 24, l, font, { color: INK, role: 'body' }));
      y += lines.length * 24 + 6;
    });
    b.text(W / 2, y + 40, String(chrome.pageLabel || ''), { family: SERIF, size: 11 }, { color: '#78716C', align: 'center' });
    return paperFinish(b, W, y + 70 + P, d);
  }

  /** A hand-written page in a notebook. */
  function notebookModel(m, chrome, d, measure) {
    const W = 800;
    const b = builder(W, measure);
    const P = PAGE_PAD, M = 70;
    const inner = W - 2 * P - M - 40;
    let y = P + 54;
    b.text(W - P - 40, y, String(chrome.publicationLine || ''), { family: HAND, size: 20 }, { color: '#3F3F46', align: 'right' });
    y += 34;
    y = b.para(P + M, y, m.content.title, { family: HAND, size: 30, weight: 600 }, inner, { color: '#1E3A8A', lineHeight: 34 }) + 16;
    const font = { family: HAND, size: 21 };
    const lh = 30;
    const lines = [];
    for (const p of m.content.paragraphs || []) { wrap(p, font, inner, measure).forEach(l => lines.push(l)); lines.push(''); }
    lines.forEach((l, i) => { if (l) b.text(P + M, y + i * lh, l, font, { color: '#1F2937', role: 'body' }); });
    const bottom = y + lines.length * lh + 20;
    // the ruling is drawn under everything
    const rules = [];
    for (let ry = P + 40; ry < bottom; ry += lh) rules.push({ type: 'line', x1: P + 18, y1: ry + 6, x2: W - P - 18, y2: ry + 6, color: '#DBEAFE', width: 1 });
    rules.push({ type: 'line', x1: P + M - 18, y1: P + 10, x2: P + M - 18, y2: bottom, color: '#FCA5A5', width: 1.5 });
    b.blocks.unshift(...rules);
    return paperFinish(b, W, bottom + P, d);
  }

  /** A printed sheet: report, info sheet, or any screen text forced onto paper. */
  function sheetModel(m, chrome, d, measure) {
    const W = 840;
    const b = builder(W, measure);
    const meta = m.content.meta || {};
    const P = PAGE_PAD, M = 64;
    const inner = W - 2 * P - 2 * M;
    let y = P + 52;
    const head = [chrome.publication || chrome.siteName, chrome.sectionLabel].filter(Boolean).join('  ·  ');
    if (head) { b.text(P + M, y, head.toUpperCase(), { family: SANS, size: 10, weight: 700 }, { color: '#57534E', letterSpacing: 1 }); }
    b.text(W - P - M, y, String(chrome.publicationLine || chrome.metaLine || ''), { family: SANS, size: 10 }, { color: '#78716C', align: 'right' });
    y += 10;
    b.line(P + M, y, W - P - M, y, { color: '#A8A29E' });
    y += 34;
    y = b.para(P + M, y, meta.subject || m.content.title, { family: SANS, size: 24, weight: 700 }, inner, { color: INK, lineHeight: 30 });
    const byline = [meta.byline, meta.from, meta.dateline].filter(Boolean).join('  ·  ');
    if (byline) { y += 22; b.text(P + M, y, byline, { family: SANS, size: 11 }, { color: '#57534E' }); }
    y += 26;
    const font = { family: SANS, size: 14 };
    for (const p of m.content.paragraphs || []) y = b.para(P + M, y, p, font, inner, { color: INK, role: 'body', lineHeight: 22 }) + 14;
    b.line(P + M, y + 10, W - P - M, y + 10, { color: '#D6D3D1' });
    b.text(P + M, y + 30, String(chrome.footerNote || ''), { family: SANS, size: 10 }, { color: '#78716C' });
    b.text(W - P - M, y + 30, String(chrome.pageLabel || ''), { family: SANS, size: 10 }, { color: '#78716C', align: 'right' });
    return paperFinish(b, W, y + 52 + P, d);
  }

  /** Put the page on a surface: paper colour, shadow, a slight tilt and a vignette. */
  function paperFinish(b, W, height, d) {
    const h = Math.ceil(height);
    const page = { type: 'rect', x: PAGE_PAD, y: PAGE_PAD, w: W - 2 * PAGE_PAD, h: h - 2 * PAGE_PAD, fill: (d.print && d.print.paper) || '#FFFFFF', shadow: true };
    const model = { width: W, height: h, blocks: [page].concat(b.blocks.map(x => (x.type === 'rect' && x.h > h ? Object.assign({}, x, { h }) : x))) };
    model.finish = { surface: '#DED8CC', rotate: -0.5, vignette: true, grain: true, page: { x: page.x, y: page.y, w: page.w, h: page.h } };
    return model;
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
    const model = d.kind === 'print' ? (d.print.kind === 'press' ? pressModel(material, c, d, measure)
        : d.print.kind === 'book' ? bookModel(material, c, d, measure)
        : d.print.kind === 'notebook' ? notebookModel(material, c, d, measure)
        : sheetModel(material, c, d, measure))
      : d.kind === 'mail' ? mailModel(material, c, d, measure)
      : d.kind === 'thread' ? threadModel(material, c, d, measure)
      : d.kind === 'chat' ? chatModel(material, c, d, measure)
      : pageModel(material, c, d, measure);
    model.kind = d.kind;
    model.medium = d.medium || 'screen';
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
      } else if (x.type === 'rect' || x.type === 'photo') {
        if (!(x.w > 0) || !(x.h > 0)) problems.push('block without size');
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

  /** Deterministic pseudo random, so the same picture is drawn every time. */
  function rng(seed) {
    let x = (seed || 1) * 1103515245 + 12345;
    return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  }

  /** A printed photograph: muted tones, a horizon, silhouettes, halftone dots. */
  function drawPhoto(ctx, b) {
    const r = rng(b.seed || 7);
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, '#C8CBD0'); g.addColorStop(0.62, '#9AA0A8'); g.addColorStop(1, '#6F757D');
    ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
    const horizon = b.y + b.h * (0.66 + r() * 0.08);
    // a soft light behind the skyline
    ctx.fillStyle = '#C3C7CC';
    ctx.beginPath(); ctx.arc(b.x + b.w * (0.2 + r() * 0.55), horizon - b.h * 0.42, b.h * 0.13, 0, Math.PI * 2); ctx.fill();
    // skyline: blocks of different heights, some with lit windows
    let bx = b.x - b.w * 0.02;
    while (bx < b.x + b.w) {
      const bw = b.w * (0.05 + r() * 0.09);
      const bh = b.h * (0.12 + r() * 0.42);
      ctx.fillStyle = r() > 0.5 ? '#5A6069' : '#4A5058';
      ctx.fillRect(bx, horizon - bh, bw, bh);
      ctx.fillStyle = 'rgba(220,225,230,.25)';
      for (let wy = horizon - bh + 6; wy < horizon - 6; wy += 10) for (let wx = bx + 4; wx < bx + bw - 5; wx += 9) if (r() > 0.55) ctx.fillRect(wx, wy, 4, 5);
      bx += bw + b.w * 0.012;
    }
    // ground with a lighter path
    ctx.fillStyle = '#6E747C'; ctx.fillRect(b.x, horizon, b.w, b.y + b.h - horizon);
    ctx.fillStyle = 'rgba(200,205,212,.28)';
    ctx.beginPath();
    ctx.moveTo(b.x + b.w * 0.3, b.y + b.h); ctx.lineTo(b.x + b.w * 0.46, horizon);
    ctx.lineTo(b.x + b.w * 0.56, horizon); ctx.lineTo(b.x + b.w * 0.8, b.y + b.h);
    ctx.closePath(); ctx.fill();
    // halftone
    ctx.save();
    ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
    ctx.fillStyle = 'rgba(30,30,30,.12)';
    for (let yy = b.y; yy < b.y + b.h; yy += 3) for (let xx = b.x + (yy % 6 === 0 ? 0 : 1.5); xx < b.x + b.w; xx += 3) {
      ctx.beginPath(); ctx.arc(xx, yy, 0.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.strokeRect(b.x + .5, b.y + .5, b.w - 1, b.h - 1);
  }

  /** Draw the model onto a canvas 2D context, ready to be exported as PNG. */
  function draw(ctx, model) {
    const fin = model.finish;
    ctx.save();
    if (fin) {
      ctx.fillStyle = fin.surface || '#DED8CC';
      ctx.fillRect(0, 0, model.width, model.height);
      ctx.translate(model.width / 2, model.height / 2);
      ctx.rotate((fin.rotate || 0) * Math.PI / 180);
      ctx.translate(-model.width / 2, -model.height / 2);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, model.width, model.height);
    }
    for (const b of model.blocks) {
      if (b.type === 'rect') {
        ctx.beginPath();
        roundRect(ctx, b.x, b.y, b.w, b.h, b.radius || 0);
        if (b.shadow) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; }
        ctx.fillStyle = b.fill || '#FFFFFF';
        ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        if (b.stroke) { ctx.strokeStyle = b.stroke; ctx.lineWidth = 1; ctx.stroke(); }
      } else if (b.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2);
        ctx.strokeStyle = b.color; ctx.lineWidth = b.width || 1; ctx.stroke();
      } else if (b.type === 'circle') {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.fill; ctx.fill();
      } else if (b.type === 'photo') {
        drawPhoto(ctx, b);
      } else if (b.type === 'text') {
        ctx.font = fontString(b.font);
        ctx.fillStyle = b.color || INK;
        ctx.textAlign = b.align || 'left';
        if ('letterSpacing' in ctx) ctx.letterSpacing = (b.letterSpacing || 0) + 'px';
        ctx.fillText(b.text, b.x, b.y);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      }
    }
    ctx.restore();
    if (fin) finishPage(ctx, model, fin);
  }

  /** Paper grain, a soft shadow along the page edge and a light vignette. */
  function finishPage(ctx, model, fin) {
    const { width: W, height: H } = model;
    if (fin.grain) {
      const r = rng(W + H);
      ctx.save();
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < Math.round(W * H / 900); i++) {
        ctx.fillStyle = r() > 0.5 ? '#000000' : '#FFFFFF';
        ctx.fillRect(r() * W, r() * H, 1.2, 1.2);
      }
      ctx.restore();
    }
    if (fin.vignette) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.22)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
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

  return { LAYOUTS, CHROME_SPECS, layoutFor, chromeSpec, fallbackChrome, buildModel, drawPhoto, bodyText, chromeText, validate, draw, canvasMeasure, approxMeasure, wrap, fontString };
});
