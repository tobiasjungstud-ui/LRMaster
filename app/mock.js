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
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./photo.js'));
  else { root.LR = root.LR || {}; root.LR.mock = factory(root.LR.core, root.LR.photo); }
})(typeof self !== 'undefined' ? self : this, function (core, photo) {
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
      print: { kind: 'press', label: 'Magazinseite', columns: 2, paper: '#FBF8F1', dropCap: true, photo: true, pressAccent: '#7C2D12', pressWarm: '#B45309' } },
    news: { kind: 'page', label: 'News site', accent: '#B91C1C', title: DISPLAY, body: SERIF, ui: SANS, sidebar: true, actions: true, kicker: true, breaking: true,
      print: { kind: 'press', label: 'Zeitungsseite', columns: 3, paper: '#F7F4EC', masthead: true, photo: true, rules: true, pressAccent: '#1B4E8F', pressWarm: '#C2410C' } },
    opinion: { kind: 'page', label: 'Opinion piece', accent: '#0F766E', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: true, kicker: true,
      print: { kind: 'press', label: 'Kommentarseite', columns: 2, paper: '#F7F4EC', rules: true, photo: false, pressAccent: '#0F766E', pressWarm: '#B45309' } },
    informational: { kind: 'page', label: 'Information page', accent: '#1D4ED8', title: SANS, body: SANS, ui: SANS, sidebar: true, actions: false,
      print: { kind: 'sheet', label: 'Infoblatt', paper: '#FFFDF8' } },
    report: { kind: 'page', label: 'Report', accent: '#334155', title: SANS, body: SANS, ui: SANS, sidebar: false, actions: false,
      print: { kind: 'sheet', label: 'Ausgedruckter Bericht', paper: '#FFFFFF', header: true } },
    review: { kind: 'page', label: 'Review', accent: '#C2410C', title: DISPLAY, body: SERIF, ui: SANS, sidebar: false, actions: true, stars: true, kicker: true,
      print: { kind: 'press', label: 'Kritik im Blatt', columns: 2, paper: '#FBF8F1', stars: true, pressAccent: '#9A3412', pressWarm: '#C2410C' } },
    interview: { kind: 'page', label: 'Interview', accent: '#7E22CE', title: SERIF, body: SERIF, ui: SANS, sidebar: false, actions: true, kicker: true, qa: true,
      print: { kind: 'press', label: 'Interview im Blatt', columns: 2, paper: '#FBF8F1', photo: true, pressAccent: '#5B21B6', pressWarm: '#B45309' } },
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
        ['tagline', 'the motto under the name of the site, three or four words'],
        ['categoryLabel', 'the section label in the coloured pill above the headline, one word'],
        ['photoCaption', 'the caption under the picture at the top — describe what the photo shows, one sentence, nothing from the text'],
        ['captionCredit', 'the small credit beside the caption, e.g. a photographer or agency name'],
        ['footerLinks', 'an array of 3–5 very short link labels in the footer'],
        ['photoSubject', 'what the picture at the top shows — one key from the list of picture subjects'],
        ['photoPrompts', 'how the teacher gets each photo of the page — an array with one object per photo, at most 3, in this order: the lead picture, the second picture in the text, the picture of the other story or module. Each object: {"google": three short Google image searches in English, 2–5 words each, generic enough to have many real results (the kind of place, the scene, the everyday subject — never an invented name, business or event), "chatgpt": one prompt for an image generator for a photorealistic photo as if taken with a real camera: what it shows as this text describes it, the setting, time of day and light, camera and lens (e.g. 35 mm, eye level), depth of field, the photo style of this medium; landscape 3:2; no text, no logos, no watermarks, no recognisable real people}'],
        ['photoReality', 'may a REAL photograph stand beside this text? "real-subject" when the text is about a real, general subject a photo can truly show (a city, a landscape, an animal, a sport, a technology, everyday life); "fictional-event" when the text reports an invented specific event, person, business or incident (a fire at a named hotel, a local council vote, a named pupil) — then only a general scene that cannot be mistaken for evidence of it; "none" when no real photo fits without seeming to document the story; if unsure, "none"'],
        ['photoQuery', 'a search for a REAL photograph that would accompany this text in this medium, in English, 4–8 words, built from what THIS text is about: the real place, the scene, the people and the action it describes (e.g. "Zurich school street pedestrians bicycles"); name the kind of photo the medium prints — documentary news photo for a paper, location photo for travel, editorial photo for a magazine feature, portrait in its setting for a profile, the lab or landscape for science. For "fictional-event": only the general setting, never the invented event itself (for an invented hotel fire: "Bristol historic street facade", not "hotel fire"); no invented names; empty if the page has no lead picture or photoReality is "none"'],
        ['sidebarSubjects', 'an array with one picture subject per headline in the box beside the text'],
        ['modules', 'everything else that stands on this page — see "The rest of the page"'],
        ['composition', 'your plan for the page itself — see "Composition"'],
      ],
      required: ['url', 'siteName', 'navItems', 'actions', 'photoSubject'],
    },
    mail: {
      fields: [
        ['appName', 'name shown in the title bar of the mail program'],
        ['mailboxItems', 'an array of 3–4 folder names in the sidebar'],
        ['authorInitials', 'one or two letters for the round avatar of the sender'],
        ['metaLine', 'the small line under the sender, e.g. "to me · 14 March, 09:12"'],
        ['actions', 'an array of 2–4 buttons as {"label": "…", "count": ""}'],
        ['labelChips', 'an array of 1–3 very short labels this mail is filed under'],
        ['attachmentName', 'the file name of the attachment if the mail mentions one, otherwise an empty string'],
        ['attachmentMeta', 'the small line under it, e.g. "PDF · 240 KB"'],
        ['attachmentSubject', 'if the attachment is a picture, what it shows — one key from the picture subjects, otherwise empty'],
        ['signatureLines', 'an array of 2–3 short lines of the sender signature, e.g. a role and a phone number'],
        ['modules', 'everything else that stands in this message — see "The rest of the page"'],
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
        ['boardInfo', 'two short lines about the board for the box on the right, separated by " · "'],
        ['boardStats', 'an array of 2–3 very short figures for that box, e.g. "14.2k members"'],
        ['voteCounts', 'an array with one vote number per paragraph, e.g. "128"'],
        ['userBadges', 'an array with one very short badge per paragraph, e.g. "OP" — an empty string where there is none'],
        ['photoSubject', 'the picture subject of the image the first post shares, empty if it shares none'],
        ['modules', 'everything else that stands on this page — see "The rest of the page"'],
      ],
      required: ['url', 'siteName', 'postMeta'],
    },
    print: {
      fields: [
        ['publication', 'name of the paper, magazine, book or notebook as it is printed at the top'],
        ['standingHead', 'the standing head above the headline, as papers print it, e.g. "The Guardian editorial" or "Culture · Film"'],
        ['publicationLine', 'the small line beside it: place, weekday and date, edition or price'],
        ['tagline', 'the motto a newspaper prints under its name on the front page, e.g. "Small stories. Bigger questions." — empty for other print media'],
        ['editionLine', 'the edition a front page names on the right of the date line, e.g. "Weekend edition \u00B7 No. 014"'],
        ['sectionLabel', 'the section this page belongs to, e.g. "Culture" or "Chapter 4"'],
        ['photoCaption', 'the caption under the picture on the page — describe what the photo shows, one sentence, nothing from the text'],
        ['captionCredit', 'the small credit under the caption, e.g. a photographer or agency name'],
        ['pageLabel', 'what stands in the page footer, e.g. "Page 7" or the date'],
        ['footerNote', 'one short line at the very bottom, e.g. a website or a continuation note'],
        ['photoSubject', 'what the picture on the page shows — one key from the list of picture subjects'],
        ['photoPrompts', 'how the teacher gets each photo of the page — an array with one object per photo, at most 3, in this order: the lead picture, the second picture in the text, the picture of the other story or module. Each object: {"google": three short Google image searches in English, 2–5 words each, generic enough to have many real results (the kind of place, the scene, the everyday subject — never an invented name, business or event), "chatgpt": one prompt for an image generator for a photorealistic photo as if taken with a real camera: what it shows as this text describes it, the setting, time of day and light, camera and lens (e.g. 35 mm, eye level), depth of field, the photo style of this medium; landscape 3:2; no text, no logos, no watermarks, no recognisable real people}'],
        ['photoReality', 'may a REAL photograph stand beside this text? "real-subject" when the text is about a real, general subject a photo can truly show (a city, a landscape, an animal, a sport, a technology, everyday life); "fictional-event" when the text reports an invented specific event, person, business or incident (a fire at a named hotel, a local council vote, a named pupil) — then only a general scene that cannot be mistaken for evidence of it; "none" when no real photo fits without seeming to document the story; if unsure, "none"'],
        ['photoQuery', 'a search for a REAL photograph that would accompany this text in this medium, in English, 4–8 words, built from what THIS text is about: the real place, the scene, the people and the action it describes (e.g. "Zurich school street pedestrians bicycles"); name the kind of photo the medium prints — documentary news photo for a paper, location photo for travel, editorial photo for a magazine feature, portrait in its setting for a profile, the lab or landscape for science. For "fictional-event": only the general setting, never the invented event itself (for an invented hotel fire: "Bristol historic street facade", not "hotel fire"); no invented names; empty if the page has no lead picture or photoReality is "none"'],
        ['weatherNote', 'the weather line the paper prints in its running head, e.g. "Cloudy, 14°C"'],
        ['indexItems', 'an array of 2–4 pointers to other pages in the running head, e.g. "Sport 12"'],
        ['portraitName', 'the name under the small portrait beside the article, empty if the text has no author'],
        ['modules', 'everything else that stands on this page — see "The rest of the page"'],
        ['composition', 'your plan for the page itself — see "Composition"'],
      ],
      required: ['publication', 'publicationLine', 'photoCaption', 'photoSubject'],
    },
    chat: {
      fields: [
        ['appName', 'name of the messenger'],
        ['deviceTime', 'the clock in the status bar, e.g. "14:32"'],
        ['contactName', 'the name at the top of the chat'],
        ['authorInitials', 'one or two letters for the contact avatar'],
        ['bubbleTimes', 'an array with one short time per message, e.g. "14:28"'],
        ['statusLine', 'the small line under the contact name, e.g. "online"'],
        ['dateLabel', 'the grey date pill above the first message, e.g. "Today" or "Friday"'],
        ['photoSubject', 'the picture subject of a photo one of them sends in the chat, empty if nobody sends one'],
        ['photoAfter', 'after which message the photo is sent, as a number (1 = after the first message)'],
        ['modules', 'a link somebody shares in the chat — see "The rest of the page"'],
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
    return Object.assign({ kind: key, label: d.label, medium: d.medium, subjects: photo.subjectHints(), modules: moduleHints(key), shapes: SHAPE_KEYS, slots: MEDIUM_SLOTS[key] || ['below'] }, CHROME_SPECS[key]);
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
      tagline: '', categoryLabel: meta.section || '', footerLinks: [],
      appName: site, mailboxItems: [], labelChips: [], attachmentName: '', attachmentMeta: '', postMeta: (meta.authors || []).map(() => ''),
      voteCounts: (meta.authors || []).map(() => ''), userBadges: (meta.authors || []).map(() => ''),
      boardInfo: '', boardStats: [], dateLabel: '',
      deviceTime: '', contactName: meta.byline || '', bubbleTimes: list(material.content.paragraphs).map(() => ''), statusLine: '',
      publication: site, publicationLine: [meta.dateline, meta.location].filter(Boolean).join(' · '),
      sectionLabel: meta.section || '', photoCaption: '', captionCredit: '', pageLabel: meta.dateline || '',
      // A picture always exists, even without Claude: the subject is read out
      // of the text itself. A subject is not a text — nothing is invented here.
      photoSubject: photo.subjectFor(title + ' ' + list(material.content && material.content.paragraphs).join(' ').slice(0, 1200), 'city'),
      sidebarSubjects: [], weatherNote: '', indexItems: [], portraitName: meta.byline || '',
      attachmentSubject: '', signatureLines: [], photoAfter: '', modules: [],
    };
  }

  /* ------------------------------------------------------------------ */
  /* The other things on the page (concept §37)                           */
  /* ------------------------------------------------------------------ */

  /*
   * A real page is never one text alone. Around it stands whatever that
   * medium lives on: advertisements, a poll, the most-read list, a sign-up
   * box, the small ads, the weather, a promoted post, a cookie banner. Which
   * of them a page shows is not something this file can know — it depends on
   * the medium and on the publication. So the app keeps a catalogue of the
   * things that CAN stand there, and Claude picks the ones that really would.
   *
   * Every module takes the same shape of data, so a new one costs one entry:
   *   { type, slot, label, heading, lines: [], items: [], cta, meta, subject }
   * and draws itself into a column of width `w`, returning its height.
   *
   * `slots` are the places a medium offers:
   *   top     — above the article (banner, breaking bar, consent)
   *   inline  — between the paragraphs of the text
   *   rail    — the column beside the text
   *   column  — the foot of the last column of a printed page
   *   below   — under the article, before the footer
   */
  const MODULES = {
    ad_banner: {
      hint: 'a wide banner advertisement — brand, a line of copy, a button',
      slots: ['top', 'inline', 'below'], media: ['page', 'thread', 'mail'],
      draw(b, x, y, w, mod, S) {
        const h = Math.max(96, Math.min(140, w * 0.14));
        b.rect(x, y, w, h, { fill: '#EEF1F5', radius: 6, stroke: LINE });
        b.text(x + 10, y + 16, 'ADVERTISEMENT', S.ui(8.5, 700), { color: '#94A3B8', letterSpacing: 1.2 });
        b.rect(x + 18, y + 26, h - 44, h - 44, { fill: S.accent, radius: 8 });
        b.text(x + 18 + (h - 44) / 2, y + 26 + (h - 44) / 2 + 7, initial(mod.label || mod.heading), S.title(20, 800), { color: '#FFFFFF', align: 'center' });
        b.text(x + h - 8, y + 48, clipText(mod.heading || '', 52), S.title(17, 700), { color: INK });
        b.text(x + h - 8, y + 70, clipText(mod.lines[0] || '', 66), S.ui(12.5), { color: '#475569' });
        if (mod.cta) {
          const f = S.ui(12, 700);
          const cw = (b.measure || approxMeasure)(mod.cta, f) + 34;
          b.rect(x + w - cw - 20, y + h / 2 - 17, cw, 34, { fill: S.accent, radius: 17 });
          b.text(x + w - cw / 2 - 20, y + h / 2 + 5, mod.cta, f, { color: '#FFFFFF', align: 'center' });
        }
        return h;
      },
    },
    ad_box: {
      hint: 'a square advertisement with a picture — the box in a column or between two sections',
      slots: ['rail', 'inline', 'below'], media: ['page', 'thread'],
      draw(b, x, y, w, mod, S) {
        const picH = Math.round(w * 0.62);
        const h = picH + 96;
        b.rect(x, y, w, h, { fill: '#F8FAFC', radius: 8, stroke: LINE });
        b.text(x + 12, y + 18, 'ADVERTISEMENT', S.ui(8.5, 700), { color: '#94A3B8', letterSpacing: 1.2 });
        b.photo(x + 10, y + 26, w - 20, picH, { seed: photo.hashOf(mod.heading || 'ad'), subject: mod.subject, colour: true, frame: false });
        b.text(x + 12, y + picH + 50, clipText(mod.heading || '', 34), S.title(14, 700), { color: INK });
        b.text(x + 12, y + picH + 68, clipText(mod.lines[0] || mod.label || '', 40), S.ui(11.5), { color: MUTED });
        if (mod.cta) {
          const f = S.ui(11, 700);
          const cw = (b.measure || approxMeasure)(mod.cta, f) + 26;
          b.rect(x + 12, y + picH + 78, cw, 26, { fill: S.accent, radius: 13 });
          b.text(x + 12 + cw / 2, y + picH + 95, mod.cta, f, { color: '#FFFFFF', align: 'center' });
        }
        return h + 12;
      },
    },
    ad_skyscraper: {
      hint: 'the tall advertisement a site keeps in the column beside the text',
      slots: ['rail'], media: ['page', 'thread'],
      draw(b, x, y, w, mod, S) {
        const h = Math.max(420, Math.min(620, w * 2.2));
        b.rect(x, y, w, h, { fill: '#F8FAFC', radius: 8, stroke: LINE });
        b.photo(x + 10, y + 24, w - 20, h * 0.5, { seed: photo.hashOf(mod.heading || 'sky'), subject: mod.subject, colour: true, frame: false });
        b.text(x + 12, y + 16, 'ADVERTISEMENT', S.ui(8.5, 700), { color: '#94A3B8', letterSpacing: 1.2 });
        const end = b.para(x + 12, y + h * 0.5 + 48, clipText(mod.heading || '', 52), S.title(15, 700), w - 24, { color: INK, lineHeight: 20 });
        b.para(x + 12, end + 8, clipText(mod.lines[0] || '', 70), S.ui(11.5), w - 24, { color: MUTED, lineHeight: 16 });
        if (mod.cta) {
          const f = S.ui(11.5, 700);
          const cw = (b.measure || approxMeasure)(mod.cta, f) + 30;
          b.rect(x + 12, y + h - 52, cw, 30, { fill: S.accent, radius: 15 });
          b.text(x + 12 + cw / 2, y + h - 32, mod.cta, f, { color: '#FFFFFF', align: 'center' });
        }
        b.text(x + w / 2, y + h - 10, clipText(mod.label || '', 30), S.ui(9), { color: '#94A3B8', align: 'center' });
        return h + 12;
      },
    },
    sponsored: {
      hint: 'a promoted post that looks like an article but is paid for — "Sponsored by …"',
      slots: ['inline', 'below', 'rail'], media: ['page', 'thread'],
      draw(b, x, y, w, mod, S) {
        const picW = Math.min(180, w * 0.34), h = Math.max(120, picW * 0.72);
        b.rect(x, y, w, h, { fill: '#FFFDF5', radius: 8, stroke: '#EADFC0' });
        b.photo(x + 1, y + 1, picW, h - 2, { seed: photo.hashOf(mod.heading || 'sp'), subject: mod.subject, colour: true, frame: false });
        const tx = x + picW + 18, tw = w - picW - 36;
        b.text(tx, y + 24, upper('Sponsored' + (mod.label ? ' · ' + mod.label : '')), S.ui(9.5, 800), { color: '#A16207', letterSpacing: 1 });
        const end = b.para(tx, y + 48, clipText(mod.heading || '', 90), S.title(16, 700), tw, { color: INK, lineHeight: 21 });
        b.para(tx, end + 6, clipText(mod.lines[0] || '', 110), S.ui(12), tw, { color: '#57534E', lineHeight: 17 });
        return h + 12;
      },
    },
    teaser: {
      hint: 'another article of the same publication — a different story, with its own headline, picture and author',
      slots: ['below', 'rail', 'column'], media: ['page', 'print', 'thread'],
      draw(b, x, y, w, mod, S) {
        if (S.print) {
          // a paper sets its second story in its own type, between rules
          b.line(x, y + 6, x + w, y + 6, { color: '#78716C', width: 2 });
          let iy = y + 18;
          if (mod.label) { b.text(x, iy + 12, upper(mod.label), { family: SANS, size: 9.5, weight: 700 }, { color: S.accent, letterSpacing: 1.2 }); iy += 18; }
          iy = b.para(x, iy + 22, clipText(mod.heading || '', 90), { family: SERIF, size: 21, weight: 700 }, w, { color: INK, lineHeight: 25 }) + 4;
          if (mod.subject) {
            const ph = Math.round(w * 0.42);
            b.photo(x, iy + 8, w, ph, { seed: photo.hashOf(mod.heading || 't'), subject: mod.subject, colour: true, print: true });
            iy += ph + 16;
          }
          if (mod.lines[0]) iy = b.para(x, iy + 16, clipText(mod.lines[0], 160), { family: SERIF, size: 12.5 }, w, { color: '#44403C', lineHeight: 17 });
          if (mod.meta) { b.text(x, iy + 18, upper(mod.meta), { family: SANS, size: 9, weight: 700 }, { color: '#78716C', letterSpacing: 1 }); iy += 16; }
          return iy - y + 14;
        }
        const picW = Math.min(180, w * 0.36), h = Math.max(128, picW * 0.78);
        b.rect(x, y, w, h, { fill: '#FFFFFF', radius: 10, stroke: LINE });
        b.photo(x + 1, y + 1, picW, h - 2, { seed: photo.hashOf(mod.heading || 't'), subject: mod.subject, colour: true, frame: false });
        const tx = x + picW + 18, tw = w - picW - 36;
        if (mod.label) b.text(tx, y + 24, upper(mod.label), S.ui(10, 800), { color: S.accent, letterSpacing: 1 });
        const end = b.para(tx, y + 48, clipText(mod.heading || '', 90), S.title(18, 700), tw, { color: INK, lineHeight: 23 });
        if (mod.lines[0]) b.para(tx, end + 6, clipText(mod.lines[0], 120), S.ui(12.5), tw, { color: '#475569', lineHeight: 18 });
        b.text(tx, y + h - 16, [mod.meta, mod.cta].filter(Boolean).join('  ·  '), S.ui(11), { color: MUTED });
        return h + 14;
      },
    },
    list: {
      hint: 'a list of other headlines — "Most read", "More from this site", "Related threads"',
      slots: ['rail', 'below'], media: ['page', 'print', 'thread', 'mail'],
      draw(b, x, y, w, mod, S) {
        const items = mod.items.slice(0, 5);
        b.rect(x, y, w, 4, { fill: S.accent });
        b.text(x, y + 30, upper(mod.heading || mod.label || ''), S.ui(11.5, 800), { color: INK, letterSpacing: 1 });
        let iy = y + 48;
        items.forEach((it, i) => {
          b.text(x, iy + 14, String(i + 1), S.title(15, 800), { color: S.accent });
          const end = b.para(x + 26, iy + 12, clipText(String(it), 70), S.ui(12.5, 600), w - 30, { color: INK, lineHeight: 17 });
          iy = end + 14;
          if (i < items.length - 1) { b.line(x, iy - 4, x + w, iy - 4, { color: LINE }); iy += 8; }
        });
        if (mod.meta) { b.text(x, iy + 14, mod.meta, S.ui(11), { color: MUTED }); iy += 20; }
        return iy - y + 14;
      },
    },
    poll: {
      hint: 'a reader poll — a question, two to four answers with bars, a number of votes',
      slots: ['rail', 'inline', 'below'], media: ['page', 'thread'],
      draw(b, x, y, w, mod, S) {
        const mark = b.blocks.length;
        const items = mod.items.slice(0, 4);
        b.text(x + 16, y + 26, upper(mod.label || 'Reader poll'), S.ui(10, 800), { color: S.accent, letterSpacing: 1 });
        let iy = b.para(x + 16, y + 48, mod.heading || '', S.title(15, 700), w - 32, { color: INK, lineHeight: 20 }) + 8;
        // a poll adds up to 100 %: the first answer leads, the others follow,
        // and the rounding error goes to the leader
        const weights = items.map((_, i) => [52, 29, 13, 6][i] || 4);
        const total = weights.reduce((a, v) => a + v, 0) || 1;
        const pcts = weights.map(v => Math.round(v / total * 100));
        if (pcts.length) pcts[0] += 100 - pcts.reduce((a, v) => a + v, 0);
        const shares = pcts.map(v => v / 100);
        items.forEach((it, i) => {
          b.rect(x + 16, iy, w - 32, 26, { fill: '#EEF2F6', radius: 13 });
          b.rect(x + 16, iy, Math.max(30, (w - 32) * Math.min(0.78, Math.max(0.08, shares[i]))), 26, { fill: i === 0 ? S.accent : '#CBD5E1', radius: 13, meter: true });
          b.text(x + 28, iy + 18, clipText(String(it), 34), S.ui(12, 600), { color: i === 0 ? '#FFFFFF' : '#334155' });
          b.text(x + w - 26, iy + 18, pcts[i] + '%', S.ui(11, 700), { color: '#475569', align: 'right' });
          iy += 34;
        });
        b.text(x + 16, iy + 14, mod.meta || '', S.ui(11), { color: MUTED });
        const h = iy + 26 - y;
        b.blocks.splice(mark, 0, { type: 'rect', x, y, w, h, fill: '#FFFFFF', radius: 10, stroke: LINE });
        return h + 12;
      },
    },
    newsletter: {
      hint: 'a sign-up box for the newsletter of this publication',
      slots: ['rail', 'inline', 'below'], media: ['page', 'thread', 'mail'],
      draw(b, x, y, w, mod, S) {
        const mark = b.blocks.length;
        b.rect(x + 18, y + 20, 24, 24, { fill: S.accent, radius: 6 });
        let iy = b.para(x + 18, y + 64, mod.heading || '', S.title(15, 700), w - 36, { color: INK, lineHeight: 20 });
        if (mod.lines[0]) iy = b.para(x + 18, iy + 8, clipText(mod.lines[0], 70), S.ui(11.5), w - 36, { color: MUTED, lineHeight: 16 });
        b.rect(x + 18, iy + 12, w - 36, 30, { fill: '#FFFFFF', radius: 6, stroke: LINE });
        b.text(x + 28, iy + 32, clipText(mod.meta || 'your@email', 26), S.ui(11.5), { color: '#94A3B8' });
        const f = S.ui(11.5, 700);
        const cw = (b.measure || approxMeasure)(mod.cta || 'Sign up', f) + 26;
        b.rect(x + w - cw - 24, iy + 16, cw, 22, { fill: S.accent, radius: 11 });
        b.text(x + w - cw / 2 - 24, iy + 32, mod.cta || 'Sign up', f, { color: '#FFFFFF', align: 'center' });
        const h = iy + 56 - y;
        b.blocks.splice(mark, 0, { type: 'rect', x, y, w, h, fill: SOFT, radius: 10, stroke: LINE });
        return h + 12;
      },
    },
    comments: {
      hint: 'what readers wrote under the article — two or three short reactions with names',
      slots: ['below'], media: ['page', 'thread'],
      draw(b, x, y, w, mod, S) {
        b.text(x, y + 14, mod.heading || 'Comments', S.title(15, 800), { color: INK });
        b.rect(x + w - 128, y - 6, 128, 30, { fill: SOFT, radius: 15, stroke: LINE });
        b.text(x + w - 64, y + 14, mod.cta || 'Add a comment', S.ui(11.5, 600), { color: '#475569', align: 'center' });
        let iy = y + 40;
        mod.items.slice(0, 3).forEach((it, i) => {
          const parts = String(it).split('|');
          const who = (parts.length > 1 ? parts[0] : 'reader_' + (i + 1)).trim();
          const said = (parts.length > 1 ? parts.slice(1).join('|') : parts[0]).trim();
          avatar(b, x + 16, iy + 12, 16, upper(who.slice(0, 2)), S.accent, who);
          b.text(x + 44, iy + 10, who, S.ui(12.5, 700), { color: INK });
          b.text(x + 44 + (b.measure || approxMeasure)(who, S.ui(12.5, 700)) + 12, iy + 10, String(2 + i * 3) + 'h', S.ui(11), { color: MUTED });
          const end = b.para(x + 44, iy + 30, said, S.ui(13), w - 70, { color: '#334155', lineHeight: 19 });
          b.icon('heart', x + 44, end + 4, 15, { color: MUTED, weight: 1.6 });
          b.text(x + 66, end + 16, String(3 + i * 7), S.ui(11), { color: MUTED });
          b.text(x + 96, end + 16, 'Reply', S.ui(11, 600), { color: MUTED });
          iy = end + 42;
        });
        return iy - y + 10;
      },
    },
    fact_box: {
      hint: 'a box with the facts at a glance — three or four short points',
      slots: ['rail', 'inline', 'column', 'below'], media: ['page', 'print', 'mail'],
      draw(b, x, y, w, mod, S) {
        const mark = b.blocks.length;
        b.text(x + 18, y + 30, upper(mod.heading || mod.label || 'At a glance'), S.ui(11, 800), { color: INK, letterSpacing: 1 });
        let iy = y + 46;
        mod.items.slice(0, 5).forEach((it) => {
          b.circle(x + 24, iy + 8, 3, { fill: S.accent });
          iy = b.para(x + 36, iy + 12, clipText(String(it), 90), S.ui(12), w - 54, { color: '#334155', lineHeight: 17 }) + 8;
        });
        const h = iy - y + 8;
        b.blocks.splice(mark, 0,
          { type: 'rect', x, y, w, h, fill: '#F4F6F8', radius: 8, stroke: LINE },
          { type: 'rect', x, y, w: 4, h, fill: S.accent, radius: 2 });
        return h + 12;
      },
    },
    results: {
      hint: 'a small table of results or figures — scores, prices, a league table',
      slots: ['rail', 'column', 'below'], media: ['page', 'print'],
      draw(b, x, y, w, mod, S) {
        const rows = mod.items.slice(0, 5);
        const h = 46 + rows.length * 24 + 12;
        b.rect(x, y, w, h, { fill: '#FFFFFF', radius: 6, stroke: LINE });
        b.rect(x, y, w, 26, { fill: S.accent, radius: 6 });
        b.text(x + 12, y + 18, upper(mod.heading || mod.label || ''), S.ui(10.5, 800), { color: '#FFFFFF', letterSpacing: 1 });
        rows.forEach((row, i) => {
          const parts = String(row).split('|');
          const left = (parts[0] || '').trim(), right = (parts[1] || '').trim();
          b.text(x + 12, y + 46 + i * 24, clipText(left, 28), S.ui(12), { color: INK });
          b.text(x + w - 12, y + 46 + i * 24, right, S.ui(12, 700), { color: INK, align: 'right' });
          if (i < rows.length - 1) b.line(x + 10, y + 52 + i * 24, x + w - 10, y + 52 + i * 24, { color: LINE });
        });
        return h + 12;
      },
    },
    weather: {
      hint: 'the weather — today and the next days, with temperatures',
      slots: ['rail', 'top', 'column', 'head'], media: ['page', 'print'],
      draw(b, x, y, w, mod, S) {
        const days = mod.items.slice(0, 4);
        const h = 104;
        b.rect(x, y, w, h, { fill: '#EAF1F7', radius: 8, stroke: '#CBDCE8' });
        b.text(x + 14, y + 24, upper(mod.heading || 'Weather'), S.ui(10.5, 800), { color: '#3B6E96', letterSpacing: 1 });
        b.text(x + 14, y + 56, clipText(mod.meta || '', 18), S.title(22, 800), { color: '#1E4E79' });
        const cw = (w - 28) / Math.max(1, days.length);
        days.forEach((dd, i) => {
          const parts = String(dd).split('|');
          b.text(x + 14 + i * cw + cw / 2, y + 78, clipText((parts[0] || '').trim(), 8), S.ui(10.5, 700), { color: '#3B6E96', align: 'center' });
          b.circle(x + 14 + i * cw + cw / 2, y + 90, 5, { fill: i === 0 ? '#F5B942' : '#B9CBD8' });
          b.text(x + 14 + i * cw + cw / 2, y + 100, clipText((parts[1] || '').trim(), 8), S.ui(10), { color: MUTED, align: 'center' });
        });
        return h + 12;
      },
    },
    classifieds: {
      hint: 'the small ads a paper prints — short lines, one after another',
      slots: ['column', 'below'], media: ['print'],
      draw(b, x, y, w, mod, S) {
        let iy = y + 34;
        b.text(x, y + 16, upper(mod.heading || 'Classified'), S.ui(10, 800), { color: INK, letterSpacing: 1.4 });
        b.line(x, y + 22, x + w, y + 22, { color: '#78716C', width: 1 });
        mod.items.slice(0, 6).forEach((it) => {
          const end = b.para(x, iy + 12, clipText(String(it), 80), { family: SERIF, size: 10.5 }, w, { color: '#44403C', lineHeight: 14 });
          iy = end + 8;
          b.line(x, iy - 2, x + w, iy - 2, { color: '#D6D3D1' });
        });
        return iy - y + 8;
      },
    },
    letters: {
      hint: 'letters to the editor — a short opinion with a name and a place',
      slots: ['column', 'below'], media: ['print'],
      draw(b, x, y, w, mod, S) {
        b.text(x, y + 16, upper(mod.heading || 'Letters'), { family: SERIF, size: 12, weight: 700 }, { color: INK, letterSpacing: 1.2 });
        b.line(x, y + 24, x + w, y + 24, { color: '#78716C', width: 2 });
        let iy = y + 34;
        mod.items.slice(0, 3).forEach((it) => {
          const parts = String(it).split('|');
          const end = b.para(x, iy + 14, clipText((parts[0] || '').trim(), 160), { family: SERIF, size: 11 }, w, { color: '#44403C', lineHeight: 15 });
          b.text(x, end + 16, clipText((parts[1] || '').trim(), 40), { family: SANS, size: 9.5, weight: 700 }, { color: '#78716C', letterSpacing: 0.6 });
          iy = end + 28;
        });
        return iy - y + 8;
      },
    },
    listings: {
      hint: 'a programme or a list of events with times',
      slots: ['rail', 'column', 'below'], media: ['page', 'print'],
      draw(b, x, y, w, mod, S) {
        b.text(x, y + 18, upper(mod.heading || 'Today'), S.ui(10.5, 800), { color: INK, letterSpacing: 1 });
        let iy = y + 30;
        mod.items.slice(0, 5).forEach((it) => {
          const parts = String(it).split('|');
          b.text(x, iy + 16, clipText((parts[0] || '').trim(), 8), S.ui(11, 700), { color: S.accent });
          const end = b.para(x + 44, iy + 16, clipText((parts[1] || '').trim(), 60), S.ui(11.5), w - 48, { color: '#334155', lineHeight: 15 });
          iy = Math.max(iy + 26, end + 8);
          b.line(x, iy - 4, x + w, iy - 4, { color: LINE });
        });
        return iy - y + 10;
      },
    },
    paywall: {
      hint: 'the strip that says the rest costs money — subscribe to read on',
      slots: ['inline', 'below'], media: ['page'],
      draw(b, x, y, w, mod, S) {
        const h = 116;
        b.rect(x, y, w, h, { fill: '#FFF7ED', radius: 10, stroke: '#FED7AA' });
        b.text(x + 20, y + 34, clipText(mod.heading || '', 60), S.title(17, 700), { color: '#7C2D12' });
        b.text(x + 20, y + 58, clipText(mod.lines[0] || '', 90), S.ui(12.5), { color: '#9A3412' });
        const f = S.ui(12, 700);
        const cw = (b.measure || approxMeasure)(mod.cta || 'Subscribe', f) + 36;
        b.rect(x + 20, y + 74, cw, 30, { fill: '#C2410C', radius: 15 });
        b.text(x + 20 + cw / 2, y + 94, mod.cta || 'Subscribe', f, { color: '#FFFFFF', align: 'center' });
        b.text(x + cw + 36, y + 94, mod.meta || '', S.ui(11.5), { color: '#9A3412' });
        return h + 12;
      },
    },
    app_promo: {
      hint: 'the bar that asks the reader to install the app',
      slots: ['top', 'below'], media: ['page', 'thread'],
      draw(b, x, y, w, mod, S) {
        const h = 62;
        b.rect(x, y, w, h, { fill: '#0F172A', radius: 8 });
        b.rect(x + 14, y + 13, 36, 36, { fill: S.accent, radius: 9 });
        b.text(x + 32, y + 38, initial(mod.label || mod.heading), S.title(17, 800), { color: '#FFFFFF', align: 'center' });
        b.text(x + 62, y + 28, clipText(mod.heading || '', 46), S.ui(13, 700), { color: '#FFFFFF' });
        b.text(x + 62, y + 46, clipText(mod.lines[0] || '', 54), S.ui(11), { color: '#94A3B8' });
        const f = S.ui(11.5, 700);
        const cw = (b.measure || approxMeasure)(mod.cta || 'Open', f) + 28;
        b.rect(x + w - cw - 16, y + 16, cw, 30, { fill: '#FFFFFF', radius: 15 });
        b.text(x + w - cw / 2 - 16, y + 36, mod.cta || 'Open', f, { color: '#0F172A', align: 'center' });
        return h + 12;
      },
    },
    cookie: {
      hint: 'the consent banner about cookies, with accept and settings',
      slots: ['top', 'below'], media: ['page', 'thread'],
      draw(b, x, y, w, mod, S) {
        const h = 74;
        b.rect(x, y, w, h, { fill: '#F1F5F9', radius: 8, stroke: '#CBD5E1' });
        const end = b.para(x + 18, y + 28, clipText(mod.heading || mod.lines[0] || '', 150), S.ui(11.5), w - 260, { color: '#334155', lineHeight: 16 });
        const f = S.ui(11.5, 700);
        const cw = (b.measure || approxMeasure)(mod.cta || 'Accept all', f) + 30;
        b.rect(x + w - cw - 18, y + h / 2 - 15, cw, 30, { fill: S.accent, radius: 6 });
        b.text(x + w - cw / 2 - 18, y + h / 2 + 5, mod.cta || 'Accept all', f, { color: '#FFFFFF', align: 'center' });
        b.rect(x + w - cw - 132, y + h / 2 - 15, 104, 30, { fill: '#FFFFFF', radius: 6, stroke: '#CBD5E1' });
        b.text(x + w - cw - 80, y + h / 2 + 5, clipText(mod.meta || 'Settings', 12), f, { color: '#475569', align: 'center' });
        return Math.max(h, end - y + 20) + 12;
      },
    },
    breaking: {
      hint: 'the red strip with the latest line — breaking news, live',
      slots: ['top'], media: ['page'],
      draw(b, x, y, w, mod, S) {
        const h = 40;
        b.rect(x, y, w, h, { fill: '#B91C1C', radius: 4 });
        const f = S.ui(11, 800);
        const lw = (b.measure || approxMeasure)(upper(mod.label || 'Live'), f) + 22;
        b.rect(x + 10, y + 9, lw, 22, { fill: '#FFFFFF', radius: 3 });
        b.text(x + 10 + lw / 2, y + 24, upper(mod.label || 'Live'), f, { color: '#B91C1C', align: 'center' });
        b.text(x + lw + 26, y + 25, clipText(mod.heading || '', 96), S.ui(12.5, 600), { color: '#FFFFFF' });
        b.text(x + w - 14, y + 25, mod.meta || '', S.ui(11), { color: '#FECACA', align: 'right' });
        return h + 12;
      },
    },
    link_preview: {
      hint: 'a link somebody shared, shown as a card with a picture and the address',
      slots: ['inline', 'below'], media: ['chat', 'mail', 'thread'],
      draw(b, x, y, w, mod, S) {
        const picH = Math.round(w * 0.42);
        const h = picH + 74;
        b.rect(x, y, w, h, { fill: '#FFFFFF', radius: 8, stroke: LINE });
        b.photo(x + 1, y + 1, w - 2, picH, { seed: photo.hashOf(mod.heading || 'link'), subject: mod.subject, colour: true, frame: false });
        b.text(x + 12, y + picH + 24, clipText(mod.heading || '', 40), S.ui(12.5, 700), { color: INK });
        b.text(x + 12, y + picH + 42, clipText(mod.lines[0] || '', 46), S.ui(11), { color: MUTED });
        b.text(x + 12, y + picH + 60, clipText(upper(mod.meta || ''), 34), S.ui(9.5, 700), { color: '#94A3B8', letterSpacing: 0.8 });
        return h + 12;
      },
    },
    profile: {
      hint: 'the box about the author — portrait, name, one line about them',
      slots: ['rail', 'below'], media: ['page', 'print', 'thread'],
      draw(b, x, y, w, mod, S) {
        const h = 104;
        b.rect(x, y, w, h, { fill: SOFT, radius: 10, stroke: LINE });
        avatar(b, x + 48, y + 52, 28, upper(String(mod.heading || '').slice(0, 2)), S.accent, mod.heading);
        b.text(x + 88, y + 44, clipText(mod.heading || '', 28), S.ui(14, 700), { color: INK });
        b.para(x + 88, y + 64, clipText(mod.lines[0] || '', 90), S.ui(11.5), w - 104, { color: MUTED, lineHeight: 16 });
        if (mod.cta) {
          const f = S.ui(11, 700);
          const cw = (b.measure || approxMeasure)(mod.cta, f) + 24;
          b.rect(x + w - cw - 16, y + 16, cw, 24, { fill: S.accent, radius: 12 });
          b.text(x + w - cw / 2 - 16, y + 32, mod.cta, f, { color: '#FFFFFF', align: 'center' });
        }
        return h + 12;
      },
    },
    tags: {
      hint: 'the tags or topics this text is filed under',
      slots: ['rail', 'below'], media: ['page', 'thread'],
      draw(b, x, y, w, mod, S) {
        b.text(x, y + 16, upper(mod.heading || 'Topics'), S.ui(10.5, 800), { color: MUTED, letterSpacing: 1 });
        let tx = x, ty = y + 40;
        mod.items.slice(0, 8).forEach((t) => {
          const f = S.ui(12);
          const tw = (b.measure || approxMeasure)('#' + t, f) + 24;
          if (tx + tw > x + w) { tx = x; ty += 34; }
          b.pill(tx, ty, tw, 26, '#' + t, f, { fill: '#F1F5F9', color: S.accent, stroke: LINE });
          tx += tw + 8;
        });
        return ty + 26 - y + 14;
      },
    },
    quote_box: {
      hint: 'a sentence from the piece, set large in a box — the pull quote',
      slots: ['column', 'inline', 'rail'], media: ['print', 'page'],
      draw(b, x, y, w, mod, S) {
        const qf = { family: SERIF, size: 17, style: 'italic' };
        b.line(x, y + 6, x + w, y + 6, { color: S.accent, width: 3 });
        const end = b.para(x + 16, y + 48, clipText(mod.heading || mod.lines[0] || '', 160), qf, w - 32, { color: S.accent, lineHeight: 24, role: 'quote' });
        b.text(x + 16, end + 18, upper(mod.meta || mod.label || ''), { family: SANS, size: 9, weight: 700 }, { color: '#B45309', letterSpacing: 1.2 });
        b.line(x, end + 30, x + w, end + 30, { color: '#C7C2B5' });
        return end + 40 - y;
      },
    },
    event: {
      hint: 'an event with a date — a concert, a match, a meeting',
      slots: ['rail', 'column', 'below'], media: ['page', 'print'],
      draw(b, x, y, w, mod, S) {
        const h = 96;
        b.rect(x, y, w, h, { fill: '#FFFFFF', radius: 8, stroke: LINE });
        b.rect(x + 14, y + 16, 62, 64, { fill: S.accent, radius: 6 });
        const parts = String(mod.meta || '').split('|');
        b.text(x + 45, y + 44, clipText((parts[0] || '').trim(), 3), S.title(22, 800), { color: '#FFFFFF', align: 'center' });
        b.text(x + 45, y + 66, upper(clipText((parts[1] || '').trim(), 4)), S.ui(11, 700), { color: '#FFFFFF', align: 'center' });
        const end = b.para(x + 90, y + 40, clipText(mod.heading || '', 60), S.title(15, 700), w - 110, { color: INK, lineHeight: 20 });
        b.text(x + 90, end + 16, clipText(mod.lines[0] || '', 52), S.ui(11.5), { color: MUTED });
        return h + 12;
      },
    },
  };

  /*
   * The catalogue above is a starting point, not a fence. A page can show
   * something nobody thought of here — a horoscope, a live table, a box of
   * small ads, a picture gallery, a warning strip. So a module whose type the
   * app does not know is not thrown away: it is drawn in the shape that fits
   * what it carries. Claude may name the shape; otherwise it is read off the
   * fields (two-part items become a table, a picture and a headline become a
   * card, a lonely sentence becomes a note).
   */
  const SHAPES = {
    card(b, x, y, w, mod, S) {
      const picW = Math.min(180, w * 0.36), h = Math.max(120, picW * 0.78);
      b.rect(x, y, w, h, { fill: '#FFFFFF', radius: 10, stroke: LINE });
      if (mod.subject) b.photo(x + 1, y + 1, picW, h - 2, { seed: photo.hashOf(mod.heading || 'c'), subject: mod.subject, colour: true, frame: false });
      const tx = x + (mod.subject ? picW + 18 : 18), tw = w - (mod.subject ? picW : 0) - 36;
      if (mod.label) b.text(tx, y + 24, upper(mod.label), S.ui(10, 800), { color: S.accent, letterSpacing: 1 });
      const end = b.para(tx, y + 48, clipText(mod.heading || '', 90), S.title(17, 700), tw, { color: INK, lineHeight: 22 });
      if (mod.lines[0]) b.para(tx, end + 6, clipText(mod.lines[0], 120), S.ui(12.5), tw, { color: '#475569', lineHeight: 18 });
      if (mod.meta) b.text(tx, y + h - 16, mod.meta, S.ui(11), { color: MUTED });
      return h + 14;
    },
    list(b, x, y, w, mod, S) { return MODULES.list.draw(b, x, y, w, mod, S); },
    table(b, x, y, w, mod, S) { return MODULES.results.draw(b, x, y, w, mod, S); },
    box(b, x, y, w, mod, S) { return MODULES.fact_box.draw(b, x, y, w, mod, S); },
    banner(b, x, y, w, mod, S) { return MODULES.ad_banner.draw(b, x, y, w, mod, S); },
    quote(b, x, y, w, mod, S) { return MODULES.quote_box.draw(b, x, y, w, mod, S); },
    strip(b, x, y, w, mod, S) {
      const h = 44;
      b.rect(x, y, w, h, { fill: SOFT, radius: 6, stroke: LINE });
      if (mod.label) {
        const f = S.ui(10, 800);
        const lw = (b.measure || approxMeasure)(upper(mod.label), f) + 20;
        b.rect(x + 10, y + 11, lw, 22, { fill: S.accent, radius: 3 });
        b.text(x + 10 + lw / 2, y + 26, upper(mod.label), f, { color: '#FFFFFF', align: 'center' });
      }
      b.text(x + (mod.label ? (b.measure || approxMeasure)(upper(mod.label), S.ui(10, 800)) + 42 : 16), y + 27, clipText(mod.heading || mod.lines[0] || '', 96), S.ui(12.5, 600), { color: INK });
      if (mod.meta) b.text(x + w - 14, y + 27, mod.meta, S.ui(11), { color: MUTED, align: 'right' });
      return h + 12;
    },
    picture(b, x, y, w, mod, S) {
      const ph = Math.round(w * 0.6);
      b.photo(x, y, w, ph, { seed: photo.hashOf(mod.heading || 'pic'), subject: mod.subject, colour: true, frame: false });
      let iy = ph + y + 8;
      if (mod.heading) iy = b.para(x, iy + 12, clipText(mod.heading, 90), S.ui(12), w, { color: MUTED, lineHeight: 16 });
      if (mod.meta) { b.text(x + w, iy + 14, mod.meta, S.ui(10.5), { color: '#94A3B8', align: 'right' }); iy += 14; }
      return iy - y + 12;
    },
    note(b, x, y, w, mod, S) {
      const mark = b.blocks.length;
      if (mod.label) b.text(x + 18, y + 26, upper(mod.label), S.ui(10, 800), { color: S.accent, letterSpacing: 1 });
      let iy = mod.heading ? b.para(x + 18, y + (mod.label ? 52 : 34), clipText(mod.heading, 120), S.title(15, 700), w - 36, { color: INK, lineHeight: 20 }) : y + 20;
      for (const line of mod.lines.slice(0, 2)) iy = b.para(x + 18, iy + 10, clipText(line, 200), S.ui(12), w - 36, { color: '#475569', lineHeight: 17 });
      for (const item of mod.items.slice(0, 4)) {
        b.circle(x + 24, iy + 12, 3, { fill: S.accent });
        iy = b.para(x + 36, iy + 16, clipText(String(item).replace('|', ' — '), 90), S.ui(12), w - 54, { color: '#334155', lineHeight: 17 });
      }
      if (mod.cta) {
        const f = S.ui(11.5, 700);
        const cw = (b.measure || approxMeasure)(mod.cta, f) + 28;
        b.rect(x + 18, iy + 14, cw, 28, { fill: S.accent, radius: 14 });
        b.text(x + 18 + cw / 2, iy + 33, mod.cta, f, { color: '#FFFFFF', align: 'center' });
        iy += 34;
      }
      if (mod.meta) { b.text(x + 18, iy + 20, mod.meta, S.ui(11), { color: MUTED }); iy += 16; }
      const h = iy - y + 20;
      b.blocks.splice(mark, 0, { type: 'rect', x, y, w, h, fill: '#FFFFFF', radius: 10, stroke: LINE });
      return h + 12;
    },
  };

  const SHAPE_KEYS = Object.keys(SHAPES);

  /** The shape a module the app does not know is drawn in. */
  function shapeOf(mod) {
    if (SHAPES[mod.shape]) return mod.shape;
    if (mod.items && mod.items.length) return mod.items.some(i => String(i).includes('|')) ? 'table' : 'list';
    if (mod.subject && mod.heading) return 'card';
    if (mod.subject) return 'picture';
    if (mod.cta && !(mod.items || []).length && (mod.lines || []).length <= 1) return 'banner';
    return 'note';
  }

  /** How one module is drawn: its own hand if the app knows it, else its shape. */
  function moduleRenderer(mod) {
    const def = MODULES[mod && mod.type];
    if (def) return def.draw;
    return SHAPES[shapeOf(mod || {})];
  }

  const MODULE_KEYS = Object.keys(MODULES);

  /** The catalogue for the prompt: what can stand around a text of this medium. */
  function moduleHints(mediumKey) {
    return MODULE_KEYS.filter(k => MODULES[k].media.includes(mediumKey))
      .map(k => `${k} [${MODULES[k].slots.join('/')}] — ${MODULES[k].hint}`);
  }

  /** The places a medium offers, in the order a page is built. */
  const MEDIUM_SLOTS = {
    page: ['top', 'inline', 'rail', 'below'],
    print: ['head', 'column', 'below'],
    thread: ['top', 'inline', 'rail', 'below'],
    mail: ['inline', 'below'],
    chat: ['inline'],
  };

  /**
   * Which modules belong in this slot of this medium. A kind the app knows
   * brings its own places; a kind Claude invented goes where Claude put it,
   * and otherwise where that medium keeps the things that are not the text.
   */
  function modulesFor(chrome, mediumKey, slot) {
    const offered = MEDIUM_SLOTS[mediumKey] || ['below'];
    return list(chrome.modules).filter((mod) => {
      if (!mod || typeof mod !== 'object') return false;
      const def = MODULES[mod.type];
      const wanted = String(mod.slot || '').trim();
      if (def) {
        if (!def.media.includes(mediumKey)) return false;
        const places = def.slots.filter(sl => offered.includes(sl));
        if (!places.length) return false;
        return places.includes(wanted) ? wanted === slot : places[0] === slot;
      }
      return offered.includes(wanted) ? wanted === slot : slot === (offered.includes('below') ? 'below' : offered[0]);
    });
  }

  /**
   * Draw the modules of one slot, one under the other, and return the y below
   * them. `limit` caps how much room they may take, so furniture never pushes
   * the text off the page.
   */
  function placeModules(b, mods, x, y, w, S, opts) {
    const o = opts || {};
    let cy = y;
    let n = 0;
    for (const mod of mods) {
      const render = moduleRenderer(mod);
      // what does not fit here is not lost: the caller can put it elsewhere
      if (!render || n >= (o.max || 4) || (o.until && cy > o.until)) { if (o.leftovers) o.leftovers.push(mod); continue; }
      const before = b.blocks.length;
      const h = render(b, x, cy, w, mod, S) || 0;
      if (o.until && cy + h > o.until + (o.slack || 0)) {
        b.blocks.length = before;
        if (o.leftovers) o.leftovers.push(mod);
        continue;
      }
      cy += h;
      n += 1;
    }
    return cy;
  }

  /** The style a module is drawn in, taken from the design of the medium. */
  function moduleStyle(d) {
    return {
      accent: d.accent || '#2563EB',
      ui: (size, weight) => ({ family: d.ui || SANS, size, weight: weight || 400 }),
      title: (size, weight) => ({ family: d.title || SANS, size, weight: weight || 700 }),
      body: (size, weight) => ({ family: d.body || SERIF, size, weight: weight || 400 }),
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

  /** Like `wrap`, but the first line is shortened by an indent. */
  function wrapIndent(text, font, width, measure, indent) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '', max = width - (indent || 0);
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (line && measure(next, font) > max) { lines.push(line); line = w; max = width; } else line = next;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /**
   * One line set to the full measure, the way print sets it: the words keep
   * their order, only the spaces between them grow.
   */
  function justifyLine(b, x, y, text, font, width, measure, o) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    // a line that ends in a divided word: the hyphen is printed, but it is
    // not part of the text (a soft hyphen), or the word was divided at its
    // own hyphen and goes on without a space on the next line
    const ends = lineEnd(words.length ? words[words.length - 1] : '');
    if (words.length) words[words.length - 1] = ends.text;
    const lastOpts = Object.assign({}, o, ends.flag);
    if (words.length < 2) { if (words.length) b.text(x, y, words[0], font, lastOpts); return; }
    const total = words.reduce((sum, w) => sum + measure(w, font), 0);
    const gap = (width - total) / (words.length - 1);
    if (!(gap > 0) || gap > font.size * 1.1) {
      const head = words.slice(0, -1).join(' ');
      b.text(x, y, head, font, o);
      b.text(x + measure(head + ' ', font), y, words[words.length - 1], font, lastOpts);
      return;
    }
    let cx = x;
    words.forEach((w, i) => { b.text(cx, y, w, font, i === words.length - 1 ? lastOpts : o); cx += measure(w, font) + gap; });
  }

  /** What a wrapped line ends with: a soft hyphen, a divided compound, or nothing. */
  function lineEnd(word) {
    const w = String(word || '');
    if (w.endsWith('\u00AD')) return { text: w.slice(0, -1) + '-', flag: { hyph: true } };
    if (w.endsWith('\u200B')) return { text: w.slice(0, -1), flag: { glue: true } };
    return { text: w, flag: {} };
  }

  /*
   * Where an English word may be divided at the end of a line. Narrow
   * justified columns without hyphenation get loose lines and rivers of
   * white; papers divide words. The rules are cautious: only words of seven
   * letters or more, never a proper noun, at least three letters on either
   * side, at common suffixes and prefixes, between double consonants, and
   * between two consonants that do not belong together (win-ter, traf-fic;
   * but pro-gram, not prog-ram).
   */
  const HY_SUFFIX = ['tion', 'tions', 'sion', 'sions', 'ment', 'ments', 'ness', 'less', 'ful', 'ings', 'ing', 'able', 'ible'];
  const HY_PREFIX = ['under', 'over', 'trans', 'counter', 'with'];
  const HY_BLEND = /^(bl|br|cl|cr|dr|fl|fr|gl|gr|pl|pr|tr|wr|sc|sk|sp|sq)$/;
  const HY_DIGRAPH = /^(ch|sh|th|ph|wh|ck|ng|gh|qu)$/;
  const HY_BAD_TAIL = /^[^aeiouy]?(ed|es|er|en|est|ly|le)$/;
  function hyphenPoints(word) {
    const mt = /^([^A-Za-z]*)([a-z][a-z]*)([^A-Za-z]*)$/.exec(String(word || ''));
    if (!mt) return [];
    const lead = mt[1].length, w = mt[2];
    if (w.length < 7) return [];
    const V = (c) => /[aeiouy]/.test(c);
    const pts = new Set();
    const sufAt = [];
    for (const suf of HY_SUFFIX) {
      if (!w.endsWith(suf) || w.length - suf.length < 3) continue;
      let at = w.length - suf.length;
      // every-thing is not everyth-ing: a suffix never follows a digraph
      if (HY_DIGRAPH.test(w.slice(at - 2, at))) continue;
      // run-ning, not runn-ing
      if (suf.startsWith('ing') && at >= 4 && w[at - 1] === w[at - 2] && !V(w[at - 1])) at -= 1;
      pts.add(at);
      sufAt.push(at);
    }
    for (const pre of HY_PREFIX) if (w.startsWith(pre) && w.length - pre.length >= 4) pts.add(pre.length);
    for (let i = 1; i < w.length - 2; i++) {
      const a = w[i], c = w[i + 1];
      if (!V(w[i - 1]) || V(a) || V(c) || !V(w[i + 2])) continue;
      const pair = a + c;
      if (HY_DIGRAPH.test(pair)) continue;
      const at = HY_BLEND.test(pair) ? i : i + 1;
      // morn-ings, interest-ing: the suffix wins over a split just before it
      if (sufAt.some(sa => at < sa && at >= sa - 2)) continue;
      pts.add(at);
    }
    return [...pts].filter(p => p >= 3 && w.length - p >= 3 && !HY_BAD_TAIL.test(w.slice(p))).map(p => p + lead).sort((x, y) => y - x);
  }

  /**
   * Wrap for a justified column: like `wrap`, but a line that would come out
   * loose takes the first part of the next word, divided with a hyphen.
   * `widthAt(i)` is the width of line i (a first-line indent, a drop cap).
   */
  function wrapJustified(text, font, widthAt, measure) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (let k = 0; k < words.length; k++) {
      const w = words[k];
      const max = widthAt(lines.length);
      const next = line ? line + ' ' + w : w;
      if (!line || measure(next, font) <= max) { line = next; continue; }
      // loose? then divide the word that does not fit
      let split = null;
      if (measure(line, font) < max * 0.93) {
        const room = (part) => measure(line + ' ' + part, font) <= max;
        const own = w.indexOf('-');
        if (own >= 2 && own < w.length - 2 && room(w.slice(0, own + 1))) split = { head: w.slice(0, own + 1) + '\u200B', tail: w.slice(own + 1) };
        else {
          for (const p of hyphenPoints(w)) if (room(w.slice(0, p) + '-')) { split = { head: w.slice(0, p) + '\u00AD', tail: w.slice(p) }; break; }
        }
      }
      if (split) { lines.push(line + ' ' + split.head); line = split.tail; }
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /* ------------------------------------------------------------------ */
  /* Model builder                                                        */
  /* ------------------------------------------------------------------ */

  /** At most this many photos per article (lead, second picture, one more). */
  const PHOTO_BUDGET = 3;

  function builder(width, measure) {
    const blocks = [];
    const api = {
      y: 0,
      blocks,
      measure,           // the real text measure of this picture (modules size their buttons with it)
      photoSlots: new Map(),   // the photo places drawn so far, with their role (lead, second, extra)
      photoReserved: 0,        // lead and second picture still to come
      /** The page will draw `n` essential photos (lead, second picture): keep their places. */
      reservePhotos(n) { api.photoReserved = Math.max(0, n | 0); return api; },
      subject: 'city',   // what a picture shows when nothing else says
      images: null,      // the teacher's own pictures, by place
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
        wrap(str, font, maxWidth, measure).forEach((l, i) => api.text(x, y + i * lh, l, font, Object.assign({ wrapped: true }, o || {})));
        return y + wrap(str, font, maxWidth, measure).length * lh;
      },
      icon(name, x, y, size, o) { blocks.push(Object.assign({ type: 'icon', name, x, y, size }, o || {})); return api; },
      wall(x, y, w, h, o) { blocks.push(Object.assign({ type: 'wallpaper', x, y, w, h }, o || {})); return api; },
      grad(x, y, w, h, stops, o) { blocks.push(Object.assign({ type: 'gradient', x, y, w, h, stops }, o || {})); return api; },
      /**
       * A picture. Its subject must be one the engine can draw; where a call
       * names none (or names one Claude invented), the subject the material
       * itself suggests is used, so a picture is never an empty box.
       */
      photo(x, y, w, h, o) {
        const spec = Object.assign({ type: 'photo', x, y, w, h, seed: 7 }, o || {});
        if (!photo.isSubject(spec.subject)) spec.subject = photo.isSubject(api.subject) ? api.subject : 'city';
        // The place of the picture, stable across drawings: what it shows and
        // what it is seeded from (a name, a headline). The same person's face
        // in the byline and in the author box is one place — replaced once,
        // replaced everywhere.
        spec.slot = spec.slot || spec.subject + ':' + spec.seed;
        // At most PHOTO_BUDGET photos per article, so a teacher has at most
        // three to find: the lead picture and the second picture in the text
        // always (their places are reserved when the page starts), then the
        // most prominent picture of the page. Beyond that a module shows a
        // quiet colour field, as ads and teasers often do. Small round faces
        // (bylines, comments) are not photos to find and do not count.
        const face = !!spec.round;
        if (!face) {
          spec.picRole = spec.picRole || 'extra';
          if (!api.photoSlots.has(spec.slot)) {
            const extras = [...api.photoSlots.values()].filter(r => r === 'extra').length;
            if (spec.picRole === 'extra' && extras >= Math.max(0, PHOTO_BUDGET - api.photoReserved)) {
              // a graphic, not an empty frame: a colour field with two diagonal bands
              const palettes = [['#DCE6F2', '#C5D6EA', '#AFC5E0'], ['#F1E4D3', '#E6CFB2', '#D9B98F'], ['#DDEBDD', '#C4DCC5', '#A9CBAB'], ['#E9DDEE', '#D8C4E0', '#C3A6D0']];
              const pal = palettes[photo.hashOf(spec.slot) % palettes.length];
              blocks.push({ type: 'rect', x, y, w, h, fill: pal[0], field: true });
              blocks.push({ type: 'poly', points: [[x, y + h * 0.62], [x + w, y + h * 0.18], [x + w, y + h * 0.46], [x, y + h * 0.9]], fill: pal[1] });
              blocks.push({ type: 'poly', points: [[x, y + h * 0.9], [x + w, y + h * 0.46], [x + w, y + h], [x, y + h]], fill: pal[2] });
              api.last = { field: true };
              return api;
            }
            api.photoSlots.set(spec.slot, spec.picRole);
          }
        }
        // 1. a picture the teacher put in herself
        const own = ownPicture(api.images, spec.slot);
        if (own) {
          spec.own = own.src;
          spec.credit = own.credit;
          if (own.caption) spec.caption = own.caption;
          if (own.focus) spec.focus = own.focus;
        } else {
          // 2. a real photograph the app ships with; its credit travels with
          // the block, because an invented credit under a real photo would
          // be a false attribution. 3. otherwise the drawn scene.
          const hit = photo.pick(spec.subject, spec.seed, { persona: spec.subject === 'portrait' });
          if (hit) { spec.photoId = hit.id; spec.credit = hit.credit; }
        }
        blocks.push(spec);
        api.last = spec;
        return api;
      },
      /** A filled polygon, e.g. the tail of a chat bubble or a vote arrow. */
      poly(points, o) { blocks.push(Object.assign({ type: 'poly', points, fill: '#FFFFFF' }, o || {})); return api; },
      pill(x, y, w, h, str, font, o) {
        api.rect(x, y, w, h, { fill: (o && o.fill) || '#F1F5F9', radius: h / 2, stroke: (o && o.stroke) || null });
        api.text(x + 12, y + h / 2 + font.size * 0.36, str, font, { color: (o && o.color) || '#475569' });
        return api;
      },
    };
    return api;
  }

  const INK = '#0F172A', MUTED = '#64748B', LINE = '#E2E8F0', SOFT = '#F8FAFC';

  /* ------------------------------------------------------------------ */
  /* Interface furniture                                                  */
  /* ------------------------------------------------------------------ */

  /** Interface data from outside: only a real list is a list. */
  function list(v) { return Array.isArray(v) ? v : []; }

  /** Shorten where an interface would truncate itself, e.g. in a browser tab. */
  function clipText(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function upper(s) { return String(s == null ? '' : s).toUpperCase(); }
  function initial(s) { return String(s || '').trim().charAt(0).toUpperCase(); }

  /**
   * A browser window: tab strip with a favicon, toolbar with arrows, a padlock
   * and the address, and the page area underneath. Returns the y where the
   * page itself starts.
   */
  function browserFrame(b, W, url, accent, opts) {
    const o = opts || {};
    b.rect(0, 0, W, 4000, { fill: '#FFFFFF' });
    b.rect(0, 0, W, 42, { fill: '#DCE2E9' });
    ['#F87171', '#FBBF24', '#34D399'].forEach((c, i) => b.circle(24 + i * 18, 21, 5.5, { fill: c }));
    const tabX = 84, tabW = 250;
    b.rect(tabX, 7, tabW, 30, { fill: '#F7F9FB', radius: 9 });
    avatar(b, tabX + 20, 22, 7, initial(o.tabTitle), accent);
    b.text(tabX + 36, 26, clipText(o.tabTitle, 30), { family: SANS, size: 11.5 }, { color: '#334155' });
    b.text(tabX + tabW - 18, 26, '×', { family: SANS, size: 14 }, { color: '#94A3B8' });
    b.rect(tabX + tabW + 8, 9, 150, 28, { fill: '#E3E8EE', radius: 9 });
    b.circle(tabX + tabW + 28, 23, 6, { fill: '#B8C2CD' });
    b.rect(tabX + tabW + 42, 19, 82, 8, { fill: '#C8D1DB', radius: 4 });
    b.icon('plus', tabX + tabW + 174, 14, 17, { color: '#64748B', weight: 1.7 });
    b.rect(0, 42, W, 46, { fill: '#F1F4F8' });
    b.icon('back', 20, 55, 20, { color: '#475569', weight: 2 });
    b.icon('chevron', 50, 55, 20, { color: '#A3AFBC', weight: 2 });
    b.rect(88, 52, W - 196, 26, { fill: '#FFFFFF', radius: 13, stroke: '#CBD5E1' });
    b.icon('lock', 96, 58, 15, { color: '#15803D', weight: 1.6 });
    b.text(118, 69, url, { family: MONO, size: 12 }, { color: '#475569' });
    b.icon('bookmark', W - 126, 57, 16, { color: '#A3AFBC', weight: 1.7 });
    b.icon('dots', W - 42, 55, 19, { color: '#475569', weight: 1.7 });
    b.line(0, 88, W, 88, { color: '#C7D0DA' });
    return 88;
  }

  /**
   * The round picture next to a name. A real profile shows a face, not two
   * letters — so a portrait is drawn, seeded by the name, and the initials
   * only stand in when there is no name to seed one with.
   */
  function avatar(b, x, y, r, initials, accent, name) {
    const who = String(name || '').trim();
    if (who) {
      b.photo(x - r, y - r, r * 2, r * 2, { subject: 'portrait', seed: photo.hashOf(who), round: true, frame: false });
      b.circle(x, y, r, { fill: 'none', stroke: 'rgba(255,255,255,.7)' });
      return;
    }
    b.circle(x, y, r, { fill: accent });
    b.text(x, y + r * 0.35, initials, { family: SANS, size: r, weight: 700 }, { color: '#FFFFFF', align: 'center' });
  }

  function actionRow(b, x, y, actions, font) {
    let cx = x;
    for (const a of list(actions)) {
      const label = (a.label || '') + (a.count ? '  ' + a.count : '');
      const w = Math.max(70, approxMeasure(label, font) + 30);
      b.pill(cx, y, w, 30, label, font, {});
      cx += w + 10;
    }
    return y + 30;
  }

  /** The button bar every social page has: an icon, a word, a count. */
  const ACTION_ICONS = ['heart', 'comment', 'share', 'bookmark'];
  function iconActions(b, x, y, actions, font, accent) {
    let cx = x;
    list(actions).slice(0, 4).forEach((a, i) => {
      const label = (a.label || '') + (a.count ? '  ' + a.count : '');
      const w = approxMeasure(label, font) + 52;
      b.rect(cx, y, w, 34, { fill: '#FFFFFF', radius: 17, stroke: '#CBD5E1' });
      b.icon(ACTION_ICONS[i % 4], cx + 13, y + 8, 18, { color: i === 0 ? accent : '#64748B', weight: 1.7 });
      b.text(cx + 38, y + 22, label, font, { color: '#475569' });
      cx += w + 10;
    });
    return y + 34;
  }

  /**
   * The opening paragraph with an initial, as printed pages and magazine sites
   * set it. The capital is part of the text, so it is marked as body and glued
   * to the line that continues it.
   */
  function dropCapPara(b, x, y, str, font, colW, titleFamily, measure, capColor, opts) {
    const o = opts || {};
    const text = String(str || '');
    const cap = text.charAt(0);
    const rest = text.slice(1).replace(/^\s+/, '');
    const lh = o.lineHeight || Math.round(font.size * 1.6);
    const capFont = { family: titleFamily, size: Math.round(font.size * 2.7), weight: 700 };
    const capW = measure(cap, capFont) + 9;
    const words = rest.split(/\s+/).filter(Boolean);
    const all = wrap(rest, font, colW - capW, measure);
    const beside = all.slice(0, 2);
    const used = beside.join(' ').split(' ').filter(Boolean).length;
    // glue only where the initial really opens the word: "T|he", not "A| text"
    b.text(x, y + font.size + lh, cap, capFont, { color: capColor, role: 'body', glue: !/\s/.test(text.charAt(1)) });
    const put = (lx, ly, line, width, last) => {
      if (o.justify && !last) justifyLine(b, lx, ly, line, font, width, measure, { color: INK, role: 'body' });
      else b.text(lx, ly, line, font, { color: INK, role: 'body' });
    };
    beside.forEach((l, i) => put(x + capW, y + font.size + i * lh, l, colW - capW, false));
    let yy = y + font.size + beside.length * lh;
    const remainder = words.slice(used).join(' ');
    if (remainder) {
      const rl = wrap(remainder, font, colW, measure);
      rl.forEach((l, i) => put(x, yy + i * lh, l, colW, i === rl.length - 1));
      yy += rl.length * lh;
    }
    return yy - font.size + 6;
  }

  /* --- page: blog, news site, magazine, review, story … ---------------- */

  /** What the material itself is about — the subject a picture falls back to. */
  function autoSubject(m) {
    const c = (m && m.content) || {};
    const text = [c.title || '', (c.paragraphs || []).join(' '), (c.lines || []).map(l => l.text).join(' ')].join(' ').slice(0, 1500);
    return photo.subjectFor(text, 'city');
  }

  function pageModel(m, chrome, d, measure) {
    const W = 1040;
    const b = builder(W, measure);
    {
      // the lead picture and the second picture keep their places among the three photos
      const plan = composition(chrome, m.content.paragraphs || [], 'page');
      b.reservePhotos(((d.kicker || d.sidebar) && plan.lead !== 'none' ? 1 : 0) + (plan.figure ? 1 : 0));
    }
    b.subject = autoSubject(m);
    b.images = (m.layout && m.layout.images) || null;
    const meta = m.content.meta || {};
    const hasSide = d.sidebar && list(chrome.sidebarItems).length;
    const PAD = 56;
    const colW = hasSide ? 604 : Math.min(720, W - 2 * PAD);
    const site = chrome.siteName || meta.publication || meta.blogName || '';
    const ui = (size, weight) => ({ family: d.ui, size, weight: weight || 400 });
    let y = browserFrame(b, W, chrome.url, d.accent, { tabTitle: site || m.content.title });

    // a news site wears a dark utility strip above its masthead
    if (d.breaking) {
      b.rect(0, y, W, 30, { fill: '#111827' });
      b.text(PAD, y + 20, upper(chrome.metaLine || meta.dateline || ''), ui(10.5, 600), { color: '#CBD5E1', letterSpacing: 0.8 });
      b.icon('search', W - PAD - 54, y + 7, 16, { color: '#94A3B8', weight: 1.7 });
      b.icon('menu', W - PAD - 24, y + 7, 16, { color: '#94A3B8', weight: 1.7 });
      y += 30;
    }

    // masthead: a logo mark, the name of the site, the search glass
    b.rect(0, y, W, 78, { fill: '#FFFFFF' });
    b.rect(PAD, y + 20, 38, 38, { fill: d.accent, radius: d.title === SERIF ? 4 : 11 });
    b.text(PAD + 19, y + 46, initial(site), { family: d.title, size: 21, weight: 800 }, { color: '#FFFFFF', align: 'center' });
    b.text(PAD + 52, y + 47, site, { family: d.title, size: 27, weight: 800 }, { color: INK, letterSpacing: d.title === SERIF ? 0.4 : -0.5 });
    if (chrome.tagline) b.text(PAD + 52, y + 64, chrome.tagline, ui(11.5), { color: MUTED });
    b.icon('search', W - PAD - 28, y + 28, 20, { color: MUTED, weight: 1.8 });
    y += 78;

    // the navigation strip, first item marked as the open section
    b.rect(0, y, W, 40, { fill: '#FFFFFF' });
    b.line(0, y, W, y, { color: LINE });
    let nx = PAD;
    list(chrome.navItems).slice(0, 6).forEach((item, i) => {
      const f = ui(12.5, i === 0 ? 700 : 500);
      const label = upper(item);
      b.text(nx, y + 26, label, f, { color: i === 0 ? d.accent : '#475569', letterSpacing: 0.6 });
      const w = approxMeasure(label, f) + 6;
      if (i === 0) b.rect(nx, y + 34, w, 3, { fill: d.accent });
      nx += w + 26;
    });
    y += 40;
    b.line(0, y, W, y, { color: '#CBD5E1' });
    const S = moduleStyle(d);
    // what the site puts above everything: a consent banner, a live strip,
    // the app nag, the leaderboard advertisement
    const topMods = modulesFor(chrome, 'page', 'top');
    if (topMods.length) y = placeModules(b, topMods, PAD, y + 20, W - 2 * PAD, S, { max: 2 }) + 4;
    const articleTop = y;
    y += 34;

    // section pill, headline, stand-first
    const cat = chrome.categoryLabel || meta.section || '';
    if (cat) {
      const f = ui(11, 700);
      b.pill(PAD, y, approxMeasure(upper(cat), f) + 26, 24, upper(cat), f, { fill: d.accent, color: '#FFFFFF' });
      if (d.breaking) b.text(PAD + approxMeasure(upper(cat), f) + 40, y + 17, upper(chrome.metaLine || ''), ui(11, 600), { color: MUTED, letterSpacing: 0.5 });
      y += 40;
    }
    const titleSize = d.title === SERIF ? 43 : 40;
    y = b.para(PAD, y + titleSize, m.content.title, { family: d.title, size: titleSize, weight: 800 }, colW,
      { lineHeight: titleSize + 9, color: INK, letterSpacing: d.title === DISPLAY ? -0.8 : 0 }) - titleSize + 12;
    if (d.stars) {
      for (let i = 0; i < 5; i++) b.icon('star', PAD + i * 26, y + 4, 22, { fill: i < 4 ? d.accent : '#E2E8F0', stroke: false });
      y += 34;
    }
    if (meta.standfirst) y = b.para(PAD, y + 24, meta.standfirst, { family: d.body, size: 19, style: 'italic' }, colW, { color: '#475569', lineHeight: 28 });

    // byline with avatar, and the small save/share icons on the right
    y += 30;
    avatar(b, PAD + 19, y + 4, 19, chrome.authorInitials || initial(meta.byline), d.accent, meta.byline);
    b.text(PAD + 50, y, meta.byline || '', ui(14, 700), { color: INK });
    b.text(PAD + 50, y + 19, chrome.metaLine || meta.dateline || '', ui(12), { color: MUTED });
    b.icon('share', PAD + colW - 30, y - 8, 20, { color: MUTED, weight: 1.7 });
    b.icon('bookmark', PAD + colW - 68, y - 8, 20, { color: MUTED, weight: 1.7 });
    y += 36;
    b.line(PAD, y, PAD + colW, y, { color: LINE });
    y += 28;

    // the lead picture with its caption — across the column, or set into the
    // first paragraphs with the text running around it, or none: the plan
    const comp = composition(chrome, m.content.paragraphs || [], 'page');
    let inset = null;
    if ((d.kicker || d.sidebar) && comp.lead === 'inset') {
      const iw = Math.round(colW * 0.46), ih = Math.round(iw * 0.72);
      const ix = PAD + colW - iw;
      b.photo(ix, y + 6, iw, ih, { seed: photo.hashOf(m.content.title || 'lead'), subject: chrome.photoSubject, colour: true, picRole: 'lead' });
      const leadCredit = (b.last && b.last.credit) || chrome.captionCredit;
      const leadCaption = (b.last && b.last.caption) || chrome.photoCaption;
      let cy = y + 6 + ih + 14;
      if (leadCaption) cy = b.para(ix, cy, leadCaption, ui(11.5), iw, { color: MUTED, lineHeight: 16 });
      if (leadCredit) { b.text(ix + iw, cy + 2, leadCredit, ui(10), { color: '#94A3B8', align: 'right' }); cy += 14; }
      inset = { top: y, bottom: cy + 6, w: iw };
    } else if ((d.kicker || d.sidebar) && comp.lead !== 'none') {
      const ph = Math.round(colW * 0.46);
      b.photo(PAD, y, colW, ph, { seed: photo.hashOf(m.content.title || 'lead'), subject: chrome.photoSubject, colour: true, picRole: 'lead' });
      const leadCredit = (b.last && b.last.credit) || chrome.captionCredit;
      const leadCaption = (b.last && b.last.caption) || chrome.photoCaption;
      y += ph + 18;
      if (leadCaption || leadCredit) {
        y = b.para(PAD, y, leadCaption || '', ui(12), colW - 170, { color: MUTED, lineHeight: 17 });
        if (leadCredit) b.text(PAD + colW, y - 12, leadCredit, ui(10.5), { color: '#94A3B8', align: 'right' });
        y += 16;
      }
    }

    // the text itself, with whatever the site pushes between the paragraphs
    const bodyFont = { family: d.body, size: 17 };
    const paragraphs = m.content.paragraphs || [];
    const inlineMods = modulesFor(chrome, 'page', 'inline').slice(0, 2);
    // between the paragraphs when there is room, otherwise straight after the
    // text — an advertisement the page carries never simply disappears
    const breakAt = paragraphs.length >= 4
      ? inlineMods.map((_, i) => Math.round((paragraphs.length * (i + 1)) / (inlineMods.length + 1)))
      : inlineMods.map(() => paragraphs.length);
    const lineH = comp.density === 'dense' ? 25 : comp.density === 'airy' ? 30 : 27;
    const paraGap = comp.density === 'dense' ? 14 : comp.density === 'airy' ? 22 : 18;
    const pull = comp.pullQuote || meta.pullQuote || '';
    // the pull quote stands in the middle of the piece, where an editor puts it
    const pullAt = pull && paragraphs.length >= 3 ? Math.floor(paragraphs.length / 2) : -1;
    const drawPull = () => {
      b.text(PAD, y + 48, '\u201c', { family: d.title, size: 64, weight: 700 }, { color: d.accent + '55', deco: true });
      y = b.para(PAD + 46, y + 34, pull, { family: d.body, size: 21, style: 'italic', weight: 600 }, colW - 60, { color: d.accent, lineHeight: 30, role: 'quote' });
      b.line(PAD, y + 16, PAD + 70, y + 16, { color: d.accent, width: 3 });
      y += 40;
    };
    let cut = inset; // a picture the text runs around
    let pullDue = false; // the pull quote waits until the text has passed an inset picture
    paragraphs.forEach((p, i) => {
      if (comp.heads[i]) y = b.para(PAD, y + 10, comp.heads[i], { family: d.title, size: 21, weight: 700 }, colW, { color: INK, lineHeight: 27 }) + 6;
      const heading = p.length < 60 && !/[.!?]$/.test(p.trim());
      if (heading) {
        y = b.para(PAD, y + 8, p, { family: d.title, size: 21, weight: 700 }, colW, { color: INK, role: 'body' }) + 8;
      } else if (cut && y < cut.bottom) {
        y = paraAround(b, PAD, y + bodyFont.size, p, bodyFont, colW, cut, { color: INK, role: 'body', lineHeight: lineH, measure }) - bodyFont.size + paraGap;
      } else if (i === 0 && d.body === SERIF && p.length > 140) {
        y = dropCapPara(b, PAD, y, p, bodyFont, colW, d.title, measure, d.accent) + paraGap;
      } else {
        y = b.para(PAD, y, p, bodyFont, colW, { color: INK, role: 'body', lineHeight: lineH }) + paraGap;
      }
      if (cut && y >= cut.bottom) { y = Math.max(y, cut.bottom + 6); cut = null; }
      // the second picture: across the column with its caption, or set in at
      // the right with the following paragraphs running around it
      if (comp.figure && comp.figure.after === i + 1) {
        if (comp.figure.size === 'wide') {
          const fh = Math.round(colW * 0.52);
          b.photo(PAD, y + 4, colW, fh, { seed: photo.hashOf(comp.figure.subject + i), subject: comp.figure.subject, colour: true, picRole: 'second' });
          y += fh + 18;
          if (comp.figure.caption) y = b.para(PAD, y, comp.figure.caption, ui(12), colW - 40, { color: MUTED, lineHeight: 17 }) + 10;
        } else {
          const fw = Math.round(colW * 0.44), fh = Math.round(fw * 0.7);
          b.photo(PAD + colW - fw, y + 4, fw, fh, { seed: photo.hashOf(comp.figure.subject + i), subject: comp.figure.subject, colour: true, picRole: 'second' });
          let cy = y + 4 + fh + 12;
          if (comp.figure.caption) cy = b.para(PAD + colW - fw, cy, comp.figure.caption, ui(11.5), fw, { color: MUTED, lineHeight: 16 });
          cut = { top: y, bottom: cy + 8, w: fw };
        }
      }
      if (i === pullAt) pullDue = true;
      // the quote is set only when no picture is beside the text — a quote
      // squeezed next to an inset picture leaves the page half empty
      if (pullDue && !cut) { drawPull(); pullDue = false; }
      const here = inlineMods.filter((_, k) => breakAt[k] === i + 1);
      if (here.length) { if (cut) { y = Math.max(y, cut.bottom + 6); cut = null; } y = placeModules(b, here, PAD, y + 10, colW, S, { max: 2 }) + 14; }
    });
    if (cut) y = Math.max(y, cut.bottom + 6);
    if (pull && (pullAt < 0 || pullDue)) drawPull();

    if (list(meta.tags).length) {
      let tx = PAD;
      for (const t of list(meta.tags).slice(0, 5)) {
        const font = ui(12, 600);
        const w = approxMeasure('#' + t, font) + 26;
        b.pill(tx, y, w, 27, '#' + t, font, { fill: '#F1F5F9', color: d.accent, stroke: '#E2E8F0' });
        tx += w + 8;
      }
      y += 44;
    }
    if (d.actions && list(chrome.actions).length) y = iconActions(b, PAD, y, chrome.actions, ui(13, 600), d.accent) + 26;

    // the author box under the text
    if (meta.byline) {
      b.rect(PAD, y, colW, 92, { fill: SOFT, radius: 12, stroke: LINE });
      avatar(b, PAD + 46, y + 46, 24, chrome.authorInitials || initial(meta.byline), d.accent, meta.byline);
      b.text(PAD + 84, y + 40, meta.byline || '', ui(14, 700), { color: INK });
      b.text(PAD + 84, y + 60, chrome.metaLine || meta.dateline || '', ui(12), { color: MUTED });
      y += 112;
    }

    // everything the site stacks under the article: other stories, the
    // comments, a promoted post, the advertisement before the footer — which
    // of them, and in which order, is what the page itself says (concept §37)
    const belowMods = modulesFor(chrome, 'page', 'below');
    if (belowMods.length) y = placeModules(b, belowMods, PAD, y + 20, colW, S, { max: 4 }) + 10;

    // the column beside the text: most-read list with thumbnails, then the
    // modules a site stacks under it. It is built down to the foot of the
    // article, so the page never shows a long empty strip next to the text.
    let sideBottom = articleTop;
    const sideX = PAD + colW + 44, sideW = W - (PAD + colW + 44) - PAD;
    if (hasSide) {
      const sx = sideX, sw = sideW;
      const target = y - 24;
      let sy = articleTop + 34;
      b.rect(sx, sy, sw, 4, { fill: d.accent });
      b.text(sx, sy + 30, upper(chrome.sidebarTitle || ''), ui(12, 800), { color: INK, letterSpacing: 1 });
      sy += 46;
      list(chrome.sidebarItems).slice(0, 6).forEach((it, i) => {
        if (i >= 4 && sy + 80 > target) return;
        b.photo(sx, sy, 74, 56, { seed: photo.hashOf(String(it)), subject: list(chrome.sidebarSubjects)[i] || photo.subjectFor(String(it), 'city'), colour: true });
        b.text(sx + 86, sy + 2, String(i + 1), { family: d.title, size: 15, weight: 800 }, { color: d.accent });
        const end = b.para(sx + 86, sy + 20, it, ui(13, 600), sw - 86, { color: INK, lineHeight: 18 });
        sy = Math.max(sy + 70, end + 18);
        b.line(sx, sy - 10, sx + sw, sy - 10, { color: LINE });
      });
      sy += 14;
      // What a site stacks beside the article: first what this page says it
      // stacks (poll, sign-up, the tall advertisement, another story …), then
      // — if the text runs longer than all of it — the slots a rail keeps
      // filled, down to the foot of the text. A rail never ends in a hole.
      sy = placeModules(b, modulesFor(chrome, 'page', 'rail'), sx, sy, sw, S, { max: 6, until: target, slack: 90 });
      // a display advertisement is a picture with a label, not a grey box
      const AD_SUBJECTS = ['sea', 'mountain', 'food', 'transport', 'market', 'still', 'city', 'park', 'desk', 'sport'];
      let adNo = 0;
      const adBox = (yy, hh) => {
        const pick = AD_SUBJECTS[(photo.hashOf(String(chrome.siteName || 'ad')) + adNo++) % AD_SUBJECTS.length];
        b.rect(sx, yy, sw, hh, { fill: '#F8FAFC', radius: 10, stroke: LINE });
        b.photo(sx + 10, yy + 10, sw - 20, Math.max(24, hh - 52), { seed: photo.hashOf(pick + adNo), subject: pick, colour: true, frame: false });
        b.text(sx + sw / 2, yy + hh - 16, 'ADVERTISEMENT', ui(9.5, 700), { color: '#94A3B8', align: 'center', letterSpacing: 1.4 });
      };
      for (let i = 0; i < 24 && target - sy > 140; i++) {
        const hh = target - sy >= 620 ? 600 : 200;
        if (sy + hh > target + 40) break;
        adBox(sy, hh); sy += hh + 20;
      }
      const rest = target - sy;
      if (rest > 80) { adBox(sy, rest); sy += rest; }
      sideBottom = sy - 20;
    }

    y = Math.max(y, sideBottom) + 24;
    // the footer of the site
    b.rect(0, y, W, 120, { fill: '#0F172A' });
    b.rect(PAD, y + 28, 30, 30, { fill: d.accent, radius: d.title === SERIF ? 3 : 9 });
    b.text(PAD + 15, y + 49, initial(site), { family: d.title, size: 17, weight: 800 }, { color: '#FFFFFF', align: 'center' });
    b.text(PAD + 44, y + 50, site, { family: d.title, size: 18, weight: 800 }, { color: '#FFFFFF' });
    let fx = PAD;
    (list(chrome.footerLinks).length ? list(chrome.footerLinks) : list(chrome.navItems)).slice(0, 5).forEach(l => {
      const f = ui(11.5);
      b.text(fx, y + 86, upper(l), f, { color: '#94A3B8', letterSpacing: 0.5 });
      fx += approxMeasure(upper(l), f) + 24;
    });
    b.text(W - PAD, y + 50, chrome.footerNote || '', ui(11.5), { color: '#64748B', align: 'right' });
    const model = finish(b, W, y + 120);
    // the grid of the page, so the proportions can be measured (§29)
    model.columns = [{ x: PAD, w: colW, top: articleTop, bottom: y - 24 }];
    if (hasSide) model.columns.push({ x: sideX, w: sideW, top: articleTop, bottom: y - 24 });
    return model;
  }

  /* --- mail client ---------------------------------------------------- */
  function mailModel(m, chrome, d, measure) {
    const W = 1040;
    const b = builder(W, measure);
    // the one picture of this medium keeps its place among the three photos
    if (photo.isSubject(chrome.photoSubject) || photo.isSubject(chrome.attachmentSubject)) b.reservePhotos(1);
    b.subject = autoSubject(m);
    b.images = (m.layout && m.layout.images) || null;
    const meta = m.content.meta || {};
    const SIDE = 220, PAD = 34;
    const ui = (size, weight) => ({ family: d.ui, size, weight: weight || 400 });
    b.rect(0, 0, W, 4000, { fill: '#FFFFFF' });

    // window bar with the name of the program and the search field
    b.rect(0, 0, W, 52, { fill: '#F1F4F8' });
    ['#F87171', '#FBBF24', '#34D399'].forEach((c, i) => b.circle(24 + i * 18, 26, 5.5, { fill: c }));
    b.text(96, 31, chrome.appName, ui(14, 700), { color: INK });
    b.rect(W / 2 - 170, 13, 340, 26, { fill: '#E7EBF0', radius: 13 });
    b.icon('search', W / 2 - 160, 19, 15, { color: '#94A3B8', weight: 1.7 });
    b.icon('dots', W - 42, 17, 18, { color: '#64748B', weight: 1.7 });
    b.line(0, 52, W, 52, { color: '#CBD5E1' });
    let y = 52;

    // the folder rail, with a round compose button
    b.rect(0, y, SIDE, 3000, { fill: '#F7F9FB' });
    b.line(SIDE, y, SIDE, 3000, { color: LINE });
    b.rect(20, y + 20, 120, 42, { fill: d.accent, radius: 21 });
    b.icon('plus', 34, y + 31, 20, { color: '#FFFFFF', weight: 2 });
    b.icon('clip', 104, y + 31, 19, { color: '#FFFFFF', weight: 1.8 });
    let sy = y + 92;
    list(chrome.mailboxItems).slice(0, 5).forEach((it, i) => {
      if (i === 0) b.rect(10, sy - 20, SIDE - 26, 34, { fill: '#DCE7FB', radius: 17 });
      b.icon(i === 0 ? 'inbox' : i === 1 ? 'star' : i === 2 ? 'reply' : 'bookmark', 24, sy - 13, 18,
        { color: i === 0 ? d.accent : '#64748B', weight: 1.7 });
      b.text(52, sy, it, ui(13, i === 0 ? 700 : 500), { color: i === 0 ? d.accent : '#334155' });
      sy += 38;
    });

    // the toolbar over the open message
    const x = SIDE + PAD, colW = W - SIDE - 2 * PAD;
    b.rect(SIDE + 1, y, W - SIDE, 46, { fill: '#FFFFFF' });
    ['back', 'inbox', 'trash', 'reply', 'share', 'dots'].forEach((n, i) => b.icon(n, x + i * 38, y + 14, 19, { color: '#475569', weight: 1.7 }));
    b.line(SIDE, y + 46, W, y + 46, { color: LINE });
    y += 46 + 30;

    // subject, labels, sender
    let sx2 = x;
    y = b.para(x, y + 24, meta.subject || m.content.title, { family: d.title, size: 25, weight: 700 }, colW - 60, { color: INK, lineHeight: 32 }) - 24 + 12;
    b.icon('star', x + colW - 26, y - 34, 21, { fill: '#F59E0B', stroke: false });
    list(chrome.labelChips).slice(0, 3).forEach(l => {
      const f = ui(11, 600);
      const w = approxMeasure(l, f) + 22;
      b.pill(sx2, y, w, 22, l, f, { fill: '#E7F0FE', color: d.accent });
      sx2 += w + 8;
    });
    if (list(chrome.labelChips).length) y += 34;
    y += 14;
    avatar(b, x + 21, y + 4, 21, chrome.authorInitials || initial(meta.from), d.accent, meta.from);
    b.text(x + 54, y, meta.from || '', ui(14, 700), { color: INK });
    b.text(x + 54, y + 20, chrome.metaLine || meta.sent || '', ui(12), { color: MUTED });
    b.icon('reply', x + colW - 30, y - 8, 19, { color: MUTED, weight: 1.7 });
    b.icon('dots', x + colW - 66, y - 8, 19, { color: MUTED, weight: 1.7 });
    y += 40;
    b.line(x, y, x + colW, y, { color: LINE });
    y += 28;

    for (const p of m.content.paragraphs || []) y = b.para(x, y, p, { family: d.body, size: 15 }, colW, { color: '#1E293B', role: 'body', lineHeight: 25 }) + 18;
    if (meta.signature) {
      b.line(x, y + 4, x + 200, y + 4, { color: LINE });
      y += 26;
      for (const l of String(meta.signature).split('\n')) { b.text(x, y, l, ui(13), { color: MUTED }); y += 20; }
      y += 10;
    }
    if (list(chrome.signatureLines).length && !meta.signature) {
      b.line(x, y + 4, x + 200, y + 4, { color: LINE });
      y += 26;
      for (const l of list(chrome.signatureLines).slice(0, 3)) { b.text(x, y, l, ui(13), { color: MUTED }); y += 20; }
      y += 10;
    }
    if (chrome.attachmentName) {
      // a picture attachment is shown as a picture, the way a mail client does
      const isPicture = photo.isSubject(chrome.attachmentSubject);
      if (isPicture) {
        b.text(x, y + 2, '1 attachment', ui(11.5, 700), { color: MUTED, letterSpacing: 0.6 });
        y += 18;
        b.rect(x, y, 320, 232, { fill: '#FFFFFF', radius: 12, stroke: '#CBD5E1' });
        b.photo(x + 8, y + 8, 304, 176, { seed: photo.hashOf(chrome.attachmentName), subject: chrome.attachmentSubject, colour: true, frame: false, picRole: 'lead' });
        b.text(x + 14, y + 208, clipText(chrome.attachmentName, 28), ui(12.5, 600), { color: INK });
        b.text(x + 14, y + 224, chrome.attachmentMeta || '', ui(11), { color: MUTED });
        b.icon('down', x + 290, y + 200, 18, { color: MUTED, weight: 1.7 });
        y += 254;
      } else {
        b.rect(x, y, 300, 64, { fill: '#FFFFFF', radius: 10, stroke: '#CBD5E1' });
        b.rect(x + 12, y + 12, 40, 40, { fill: '#E7F0FE', radius: 8 });
        b.icon('clip', x + 22, y + 22, 20, { color: d.accent, weight: 1.8 });
        b.text(x + 64, y + 28, clipText(chrome.attachmentName, 26), ui(13, 600), { color: INK });
        b.text(x + 64, y + 46, chrome.attachmentMeta || '', ui(11.5), { color: MUTED });
        y += 84;
      }
    }
    // what else a message carries: a banner of the sender, a link card, a box
    const S = moduleStyle(d);
    const mailMods = modulesFor(chrome, 'mail', 'inline').concat(modulesFor(chrome, 'mail', 'below'));
    if (mailMods.length) y = placeModules(b, mailMods, x, y + 8, Math.min(colW, 520), S, { max: 3 }) + 6;
    // the quoted message underneath, as mail programs fold it away
    b.rect(x, y + 6, 34, 20, { fill: '#E7EBF0', radius: 10 });
    b.icon('dots', x + 7, y + 8, 17, { color: '#64748B', weight: 1.7 });
    y += 44;
    if (list(chrome.actions).length) {
      let cx = x;
      list(chrome.actions).slice(0, 3).forEach((a, i) => {
        const f = ui(13, 600);
        const w = measure(a.label || '', f) + 58;
        b.rect(cx, y, w, 36, { fill: i === 0 ? d.accent : '#FFFFFF', radius: 18, stroke: i === 0 ? null : '#CBD5E1' });
        b.icon(i === 0 ? 'reply' : i === 1 ? 'share' : 'clip', cx + 16, y + 9, 18, { color: i === 0 ? '#FFFFFF' : '#475569', weight: 1.8 });
        b.text(cx + 42, y + 23, a.label || '', f, { color: i === 0 ? '#FFFFFF' : '#475569' });
        cx += w + 12;
      });
      y += 36;
    }
    return finish(b, W, y + 40);
  }

  /* --- forum thread ---------------------------------------------------- */
  function threadModel(m, chrome, d, measure) {
    const W = 1040;
    const b = builder(W, measure);
    // the one picture of this medium keeps its place among the three photos
    if (photo.isSubject(chrome.photoSubject) || photo.isSubject(chrome.attachmentSubject)) b.reservePhotos(1);
    b.subject = autoSubject(m);
    b.images = (m.layout && m.layout.images) || null;
    const meta = m.content.meta || {};
    const PAD = 48;
    const ui = (size, weight) => ({ family: d.ui, size, weight: weight || 400 });
    let y = browserFrame(b, W, chrome.url, d.accent, { tabTitle: chrome.siteName });

    // board header with the round logo and a search field
    b.rect(0, y, W, 58, { fill: '#FFFFFF' });
    b.circle(PAD + 16, y + 29, 16, { fill: d.accent });
    b.text(PAD + 16, y + 35, initial(chrome.siteName), { family: d.title, size: 17, weight: 800 }, { color: '#FFFFFF', align: 'center' });
    b.text(PAD + 42, y + 36, chrome.siteName, { family: d.title, size: 19, weight: 800 }, { color: INK });
    b.rect(W / 2 - 60, y + 14, 330, 30, { fill: '#F1F5F9', radius: 15, stroke: LINE });
    b.icon('search', W / 2 - 50, y + 21, 16, { color: '#94A3B8', weight: 1.7 });
    b.circle(W - PAD - 16, y + 29, 16, { fill: '#E2E8F0' });
    b.icon('menu', W - PAD - 62, y + 21, 17, { color: '#64748B', weight: 1.7 });
    y += 58;
    b.rect(0, y, W, 3000, { fill: '#EEF1F5' });
    b.line(0, y, W, y, { color: '#CBD5E1' });
    y += 26;
    const S = moduleStyle(d);
    const topMods = modulesFor(chrome, 'thread', 'top');
    if (topMods.length) y = placeModules(b, topMods, PAD, y, W - 2 * PAD, S, { max: 1 }) + 6;

    // the thread column, with the board box beside it
    const SIDE = 286;
    const MAIN = W - 2 * PAD - SIDE - 28;
    const boxTop = y;
    y = b.para(PAD, y + 26, meta.threadTitle || m.content.title, { family: d.title, size: 26, weight: 800 }, MAIN, { color: INK, lineHeight: 33 }) - 26 + 14;
    let nx = PAD;
    list(chrome.navItems).slice(0, 5).forEach((item, i) => {
      const f = ui(12, i === 0 ? 700 : 500);
      const w = approxMeasure(item, f) + 26;
      b.pill(nx, y, w, 26, item, f, { fill: i === 0 ? d.accent : '#FFFFFF', color: i === 0 ? '#FFFFFF' : '#64748B', stroke: i === 0 ? null : LINE });
      nx += w + 8;
    });
    y += 42;

    const authors = list(meta.authors);
    const stamps = list(meta.timestamps);
    const postMeta = list(chrome.postMeta);
    const votes = list(chrome.voteCounts);
    const badges = list(chrome.userBadges);
    const AV = ['#F97316', '#2563EB', '#16A34A', '#DB2777', '#7C3AED', '#0891B2'];
    list(m.content.paragraphs).forEach((p, i) => {
      const nest = i === 0 ? 0 : Math.min(2, i === 1 ? 1 : (i % 2 ? 1 : 2));
      const left = PAD + nest * 34;
      const cardTop = y;
      const mark = b.blocks.length; // the card is put in here once its height is known
      const rail = 46;
      const inner = PAD + MAIN - left - rail - 50;
      // the vote rail on the left
      b.icon('up', left + 14, cardTop + 18, 18, { fill: i === 0 ? d.accent : '#CBD5E1', stroke: false });
      b.text(left + 23, cardTop + 54, String(votes[i] || ''), ui(12, 700), { color: i === 0 ? d.accent : '#475569', align: 'center' });
      b.icon('down', left + 14, cardTop + 62, 18, { fill: '#CBD5E1', stroke: false });
      const tx = left + rail;
      avatar(b, tx + 14, cardTop + 26, 14, String(authors[i] || '').slice(0, 2).toUpperCase(), AV[i % AV.length], authors[i]);
      const nameF = ui(13, 700);
      b.text(tx + 36, cardTop + 31, authors[i] || '', nameF, { color: INK });
      let mx = tx + 36 + approxMeasure(authors[i] || '', nameF) + 10;
      if (badges[i]) {
        const f = ui(10, 700);
        const w = approxMeasure(badges[i], f) + 16;
        b.pill(mx, cardTop + 19, w, 17, badges[i], f, { fill: i === 0 ? '#FEF3C7' : '#E2E8F0', color: i === 0 ? '#B45309' : '#475569' });
        mx += w + 10;
      }
      b.text(mx, cardTop + 31, stamps[i] || '', ui(11.5), { color: MUTED });
      let end = b.para(tx + 36, cardTop + 56, p, { family: d.body, size: 15 }, inner, { color: '#1E293B', role: 'body', lineHeight: 24 });
      // the picture the first post shares, as a forum shows it under the text
      if (i === 0 && photo.isSubject(chrome.photoSubject)) {
        const pw = Math.min(inner, 420), ph = Math.round(pw * 0.58);
        b.photo(tx + 36, end + 10, pw, ph, { picRole: 'lead', seed: photo.hashOf(String(chrome.siteName || '') + p.slice(0, 20)), subject: chrome.photoSubject, colour: true, frame: false });
        b.rect(tx + 36, end + 10, pw, ph, { fill: 'none', radius: 8, stroke: LINE });
        end += ph + 16;
      }
      b.icon('comment', tx + 36, end + 12, 17, { color: '#94A3B8', weight: 1.7 });
      b.text(tx + 60, end + 25, postMeta[i] || '', ui(11.5), { color: MUTED });
      b.icon('share', tx + 60 + approxMeasure(postMeta[i] || '', ui(11.5)) + 22, end + 12, 17, { color: '#94A3B8', weight: 1.7 });
      const h = end + 44 - cardTop;
      const under = [{ type: 'rect', x: left, y: cardTop, w: PAD + MAIN - left, h, fill: '#FFFFFF', radius: 10, stroke: LINE }];
      if (nest) under.push({ type: 'line', x1: left - 16, y1: cardTop + 6, x2: left - 16, y2: cardTop + h - 6, color: '#CBD5E1', width: 2 });
      b.blocks.splice(mark, 0, ...under);
      y = cardTop + h + 14;
    });
    // a promoted post between the replies, the way a board shows one
    const inlineMods = modulesFor(chrome, 'thread', 'inline');
    if (inlineMods.length) y = placeModules(b, inlineMods, PAD, y + 4, MAIN, S, { max: 1 }) + 6;
    // the reply box at the end of the thread
    b.rect(PAD, y + 6, MAIN, 54, { fill: '#FFFFFF', radius: 10, stroke: LINE });
    b.circle(PAD + 30, y + 33, 14, { fill: '#CBD5E1' });
    b.rect(PAD + 56, y + 22, MAIN - 150, 22, { fill: '#F1F5F9', radius: 11 });
    b.rect(PAD + MAIN - 82, y + 20, 62, 26, { fill: d.accent, radius: 13 });
    b.icon('reply', PAD + MAIN - 60, y + 24, 18, { color: '#FFFFFF', weight: 1.8 });
    y += 76;

    // the box about the board, as every forum has on the right
    const bx = PAD + MAIN + 28;
    b.rect(bx, boxTop, SIDE, 4, { fill: d.accent, radius: 2 });
    const by = boxTop + 4;
    const box = { type: 'rect', x: bx, y: by, w: SIDE, h: 150, fill: '#FFFFFF', radius: 10, stroke: LINE };
    b.blocks.push(box);
    b.circle(bx + 34, by + 34, 18, { fill: d.accent });
    b.text(bx + 34, by + 40, initial(chrome.siteName), { family: d.title, size: 19, weight: 800 }, { color: '#FFFFFF', align: 'center' });
    b.text(bx + 62, by + 40, chrome.siteName, ui(14, 700), { color: INK });
    let iy = b.para(bx + 18, by + 74, chrome.boardInfo || '', ui(12), SIDE - 36, { color: MUTED, lineHeight: 18 });
    iy = Math.max(iy, by + 96);
    b.line(bx + 18, iy + 4, bx + SIDE - 18, iy + 4, { color: LINE });
    list(chrome.boardStats).slice(0, 3).forEach((st, i) => b.text(bx + 18 + i * 92, iy + 28, st, ui(12, 700), { color: INK }));
    box.h = Math.max(150, iy + 44 - by);
    // whatever else the board keeps in its column: other threads, the rules,
    // the advertisement — down to the foot of the thread
    const railEnd = placeModules(b, modulesFor(chrome, 'thread', 'rail'), bx, by + box.h + 18, SIDE, S, { max: 4, until: y - 40, slack: 120 });
    y = Math.max(y, railEnd + 10, by + box.h + 20);
    const belowThread = modulesFor(chrome, 'thread', 'below');
    if (belowThread.length) y = placeModules(b, belowThread, PAD, y + 10, MAIN, S, { max: 3 }) + 6;
    b.text(PAD, y + 12, chrome.footerNote || '', ui(11.5), { color: MUTED });
    return finish(b, W, y + 36);
  }

  /* --- messenger chat --------------------------------------------------- */
  function chatModel(m, chrome, d, measure) {
    const W = 560;
    const b = builder(W, measure);
    // the one picture of this medium keeps its place among the three photos
    if (photo.isSubject(chrome.photoSubject) || photo.isSubject(chrome.attachmentSubject)) b.reservePhotos(1);
    b.subject = autoSubject(m);
    b.images = (m.layout && m.layout.images) || null;
    const ui = (size, weight) => ({ family: d.ui, size, weight: weight || 400 });
    const HEAD = '#075E54', BAR = '#054A42', MINE = '#DCF8C6', THEIRS = '#FFFFFF', TICK = '#34B7F1';
    b.rect(0, 0, W, 4000, { fill: '#ECE5DD' });

    // status bar of the phone
    b.rect(0, 0, W, 32, { fill: BAR });
    b.text(20, 21, chrome.deviceTime || '', ui(12, 700), { color: '#FFFFFF' });
    for (let i = 0; i < 4; i++) b.rect(W - 78 + i * 6, 18 - i * 3, 4, 8 + i * 3, { fill: '#FFFFFF', radius: 1 });
    b.rect(W - 46, 12, 22, 11, { fill: '#FFFFFF', radius: 2 });
    b.rect(W - 22, 15, 3, 5, { fill: '#FFFFFF', radius: 1 });
    let y = 32;

    // chat header: back arrow, contact, call icons
    b.rect(0, y, W, 60, { fill: HEAD });
    b.icon('back', 12, y + 20, 21, { color: '#FFFFFF', weight: 2.1 });
    avatar(b, 52, y + 30, 18, chrome.authorInitials || initial(chrome.contactName), '#B7C4C0', chrome.contactName);
    b.text(80, y + 27, chrome.contactName || '', ui(15.5, 700), { color: '#FFFFFF' });
    b.text(80, y + 45, chrome.statusLine || '', ui(11.5), { color: '#BFD8D2' });
    b.icon('video', W - 112, y + 20, 21, { color: '#FFFFFF', weight: 1.8 });
    b.icon('phone', W - 72, y + 20, 19, { color: '#FFFFFF', weight: 1.8 });
    b.icon('dots', W - 32, y + 20, 20, { color: '#FFFFFF', weight: 1.8 });
    y += 60;
    const wall = { type: 'wallpaper', x: 0, y, w: W, h: 0, fill: '#ECE5DD', doodle: 'rgba(186,175,158,.55)', seed: 5 };
    b.blocks.push(wall);
    const wallTop = y;
    y += 16;

    // the grey date pill above the first message
    if (chrome.dateLabel) {
      const f = ui(11, 600);
      const w = approxMeasure(upper(chrome.dateLabel), f) + 30;
      b.rect(W / 2 - w / 2, y, w, 24, { fill: '#DDEAD3', radius: 12 });
      b.text(W / 2, y + 16, upper(chrome.dateLabel), f, { color: '#64748B', align: 'center' });
      y += 38;
    }

    const times = list(chrome.bubbleTimes);
    list(m.content.paragraphs).forEach((p, i) => {
      const mine = i % 2 === 1;
      const font = { family: d.body, size: 14.5 };
      const maxW = W - 150;
      const lines = wrap(p, font, maxW, measure);
      const timeW = 52;
      const textW = Math.max(120, Math.min(maxW, Math.max(...lines.map(l => measure(l, font)))));
      const lastW = measure(lines[lines.length - 1], font);
      const bw = Math.min(maxW + 28, Math.max(textW, lastW + timeW) + 28);
      const bh = lines.length * 22 + 30;
      const bx = mine ? W - 18 - bw : 18;
      b.rect(bx, y, bw, bh, { fill: mine ? MINE : THEIRS, radius: 9, shadow: 'soft' });
      // the little tail that points at the speaker
      b.poly(mine
        ? [[bx + bw - 1, y + 2], [bx + bw + 9, y + 2], [bx + bw - 1, y + 16]]
        : [[bx + 1, y + 2], [bx - 9, y + 2], [bx + 1, y + 16]], { fill: mine ? MINE : THEIRS });
      lines.forEach((l, k) => b.text(bx + 14, y + 24 + k * 22, l, font, { color: '#111B21', role: 'body' }));
      b.text(bx + bw - (mine ? 26 : 12), y + bh - 10, times[i] || '', ui(10.5), { color: '#8696A0', align: 'right' });
      if (mine) b.icon('ticks', bx + bw - 24, y + bh - 20, 15, { color: TICK, weight: 1.5 });
      y += bh + 10;
      // a picture somebody sends in the middle of the conversation
      if (photo.isSubject(chrome.photoSubject) && i + 1 === Math.max(1, Math.min(list(m.content.paragraphs).length, Number(chrome.photoAfter) || 1))) {
        const pw = 236, ph = 186, px = mine ? 18 : W - 18 - pw, myPic = !mine;
        b.rect(px, y, pw, ph + 22, { fill: myPic ? MINE : THEIRS, radius: 9, shadow: 'soft' });
        b.photo(px + 5, y + 5, pw - 10, ph - 4, { picRole: 'lead', seed: photo.hashOf(String(chrome.contactName || '') + i), subject: chrome.photoSubject, colour: true, frame: false });
        b.text(px + pw - (myPic ? 26 : 12), y + ph + 12, times[i] || '', ui(10.5), { color: '#8696A0', align: 'right' });
        if (myPic) b.icon('ticks', px + pw - 24, y + ph + 2, 15, { color: TICK, weight: 1.5 });
        y += ph + 32;
      }
    });
    // a link somebody drops into the conversation, as a card with a preview
    const chatMods = modulesFor(chrome, 'chat', 'inline');
    if (chatMods.length) {
      const S = moduleStyle(d);
      const cw = 262;
      const before = y;
      y = placeModules(b, chatMods, W - 18 - cw, y + 2, cw, S, { max: 1 });
      if (y > before) y += 6;
    }
    y += 12;
    wall.h = y - wallTop;

    // the writing bar at the bottom
    b.rect(0, y, W, 62, { fill: '#F0F2F5' });
    b.rect(12, y + 11, W - 88, 40, { fill: '#FFFFFF', radius: 20 });
    b.icon('clip', 34, y + 22, 20, { color: '#64748B', weight: 1.8 });
    b.rect(66, y + 27, W - 190, 8, { fill: '#E2E8F0', radius: 4 });
    b.icon('camera', W - 118, y + 22, 20, { color: '#64748B', weight: 1.8 });
    b.circle(W - 38, y + 31, 22, { fill: '#00A884' });
    b.icon('mic', W - 48, y + 21, 20, { color: '#FFFFFF', weight: 1.9 });
    return finish(b, W, y + 62);
  }


  /* ------------------------------------------------------------------ */
  /* Printed media: a photographed page instead of a screenshot           */
  /* ------------------------------------------------------------------ */

  const PAGE_PAD = 46; // the surface the page lies on

  /** Wrapped body lines, poured into `cols` columns of equal height. */
  function flowColumns(paragraphs, font, colW, cols, measure, lineHeight, opts) {
    const o = opts || {};
    const items = [];
    paragraphs.forEach((p, pi) => {
      const lines = wrap(p, font, colW - (o.indent && pi >= 0 ? o.indent : 0), measure);
      lines.forEach((l, i) => items.push({ text: l, first: i === 0, pi }));
      items.push({ gap: true });
    });
    while (items.length && items[items.length - 1].gap) items.pop();
    const perCol = Math.ceil(items.length / cols);
    const out = [];
    let col = 0, y = 0;
    for (let i = 0; i < items.length; i++) {
      if (i > 0 && i % perCol === 0 && col < cols - 1) { col += 1; y = 0; }
      const it = items[i];
      if (!it.gap) out.push({ text: it.text, col, y, first: it.first, pi: it.pi });
      y += it.gap ? lineHeight * 0.55 : lineHeight;
    }
    return { placed: out, height: perCol * lineHeight };
  }

  /** Is `quote` a piece of `text`, word for word (quotes, dashes and spacing aside)? */
  function verbatim(text, quote) {
    const norm = (t) => String(t || '').toLowerCase().replace(/[\u2018\u2019\u201c\u201d]/g, "'").replace(/[\u2013\u2014]/g, '-').replace(/[^a-z0-9' -]+/g, ' ').replace(/\s+/g, ' ').trim();
    const q = norm(quote);
    return q.length >= 12 && norm(text).includes(q);
  }

  /**
   * The editor's plan for the page (chrome.composition), checked against the
   * text it is for: a pull quote only when it is a sentence of the text, a
   * crosshead only before a paragraph that exists, a figure only after one.
   * Everything else is left as the medium's default.
   */
  function composition(chrome, paragraphs, kind) {
    const raw = chrome && chrome.composition && typeof chrome.composition === 'object' ? chrome.composition : {};
    const n = list(paragraphs).length;
    const text = list(paragraphs).join(' ');
    const leads = kind === 'print' ? ['wide', 'column', 'none'] : ['wide', 'inset', 'none'];
    const heads = {};
    for (const h of list(raw.crossheads).slice(0, 3)) {
      const before = Number(h && h.before);
      const t = String((h && h.text) || '').replace(/\s+/g, ' ').trim();
      if (before >= 1 && before < n && t && t.length <= 40 && t.split(' ').length <= 5) heads[before] = t;
    }
    const f = raw.figure && typeof raw.figure === 'object' ? raw.figure : null;
    const figure = f && Number(f.after) >= 1 && Number(f.after) < n && photo.isSubject(String(f.subject || '').toLowerCase())
      ? { after: Number(f.after), subject: String(f.subject).toLowerCase(), caption: String(f.caption || '').replace(/\s+/g, ' ').trim().slice(0, 140), size: f.size === 'wide' ? 'wide' : 'column' }
      : null;
    return {
      lead: leads.includes(raw.lead) ? raw.lead : 'wide',
      columns: Math.max(2, Math.min(4, Math.round(Number(raw.columns)) || 0)) || 0,
      pullQuote: verbatim(text, raw.pullQuote) ? String(raw.pullQuote).trim() : '',
      heads, figure,
      density: ['dense', 'normal', 'airy'].includes(raw.density) ? raw.density : 'normal',
    };
  }

  /**
   * A paragraph that runs around a picture: the lines beside it are set
   * narrower, the lines below it take the full measure again — what makes an
   * inset picture look placed rather than dropped in.
   */
  function paraAround(b, x, y, text, font, colW, cut, o) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lh = (o && o.lineHeight) || font.size * 1.45;
    const measure = (o && o.measure) || approxMeasure;
    let line = '';
    const widthAt = (yy) => (cut && yy - lh < cut.bottom && yy > cut.top - lh ? colW - cut.w - 22 : colW);
    const flush = () => { if (line) { b.text(x, y, line, font, o); y += lh; line = ''; } };
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (line && measure(next, font) > widthAt(y)) { flush(); line = w; } else line = next;
    }
    flush();
    return y;
  }

  /** Newspaper or magazine page, in the density of a real paper. */
  /* ------------------------------------------------------------------ */
  /* The printed page: A4, one page after the other                       */
  /* ------------------------------------------------------------------ */

  const A4_RATIO = 297 / 210;
  const PAGE_GAP = 36;       // between two pages in the picture
  const PRESS_FOOT = 44;     // the footer band at the foot of every page

  /**
   * The press page is a real page: A4, filled from top to foot. A story that
   * is longer than the page runs on onto a second page with a continuation
   * head, as papers print it — the type is never made smaller to squeeze it
   * in, and nothing is cut. The lead picture is fitted to the story: a short
   * story gets a bigger picture, a story that spills a few lines over gets a
   * smaller one, the way a make-up editor fits a story to its page instead of
   * leaving a hole or a lonely page.
   */
  function pressModel(m, chrome, d, measure) {
    const base = pressLayout(m, chrome, d, measure, 0);
    let best = base;
    const p = base.photo;
    if (p) {
      if (base.pages === 1 && base.gap > 90) {
        let lo = p.h, hi = p.max;
        for (let i = 0; i < 7 && hi - lo > 6; i++) {
          const mid = Math.round((lo + hi) / 2);
          const r = pressLayout(m, chrome, d, measure, mid);
          // a bigger picture may take the hole, never the quote box or the modules
          if (r.pages === 1 && r.gap >= 0 && [...base.placed].every(x => r.placed.has(x)) && r.quote >= base.quote) { lo = mid; best = r; } else hi = mid;
        }
      } else if (base.pages > 1 && base.lastFill < 0.3) {
        const small = pressLayout(m, chrome, d, measure, p.min);
        if (small.pages < base.pages) {
          best = small;
          let lo = p.min, hi = p.h;
          for (let i = 0; i < 7 && hi - lo > 6; i++) {
            const mid = Math.round((lo + hi) / 2);
            const r = pressLayout(m, chrome, d, measure, mid);
            if (r.pages < base.pages) { lo = mid; best = r; } else hi = mid;
          }
        }
      }
    }
    return best.model;
  }

  /** A colour a little darker than the paper, for boxes printed on it. */
  function shade(hex, k) {
    const h = /^#([0-9a-f]{6})$/i.exec(String(hex || '')) ? String(hex).slice(1) : 'FFFFFF';
    const ch = (i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - k))));
    return '#' + [0, 2, 4].map(i => ch(i).toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  /** The words of the first paragraph beside a drop cap: the first `n` lines are narrower. */
  function wrapCap(text, font, width, measure, capW, n) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const max = lines.length < n ? width - capW : width;
      const next = line ? line + ' ' + w : w;
      if (line && measure(next, font) > max) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /** The first letter of a paragraph as a drop cap — with an opening quote mark if there is one. */
  function capOf(text) {
    const mt = /^([\u201C\u2018"'(]*[A-Za-z0-9\u00C0-\u024F])/.exec(String(text || ''));
    if (!mt) return null;
    const cap = mt[1];
    const rest = String(text).slice(cap.length);
    return { cap, rest: rest.replace(/^\s+/, ''), glue: !/^\s/.test(rest) };
  }

  /**
   * Everything the columns carry, in reading order: the lines of every
   * paragraph, a crosshead before a paragraph, a figure after it.
   */
  function flowItems(paragraphs, font, colW, measure, lh, indent, ex) {
    // (every line but a paragraph's first runs the full width of the column)
    const items = [];
    const gap = ex.gap || 0;
    paragraphs.forEach((p, pi) => {
      if (ex.heads && ex.heads[pi]) items.push({ kind: 'head', text: ex.heads[pi], h: lh * 2.1, pi });
      let ls;
      if (pi === 0 && ex.cap) ls = wrapJustified(ex.cap.rest, font, (i) => (i < ex.cap.lines ? colW - ex.cap.w : colW), measure);
      else if (pi === 0 && ex.firstIndent) ls = wrapJustified(p, font, (i) => (i === 0 ? colW - ex.firstIndent : colW), measure);
      else ls = wrapJustified(p, font, (i) => (i === 0 && pi > 0 ? colW - indent : colW), measure);
      ls.forEach((l, i) => items.push({ kind: 'line', text: l, first: i === 0, last: i === ls.length - 1, pi, li: i,
        // the lines beside a drop cap stay together in one column
        keepH: pi === 0 && ex.cap && i === 0 ? (ex.cap.lines - 1) * lh : 0 }));
      if (ex.figures && ex.figures[pi]) items.push({ kind: 'figure', fig: ex.figures[pi], h: ex.figures[pi].h, pi });
      if (gap) items.push({ gap: true });
    });
    while (items.length && items[items.length - 1].gap) items.pop();
    return items;
  }

  /**
   * Pour items into columns from `from` on, down to `bottom`; stop when the
   * last column is full and say where the rest begins.
   */
  function fillColumns(items, from, cols, tops, bottom, kept, lh, gap) {
    const placed = [];
    let col = 0, y = tops[0], i = from;
    // A picture that does not fit at the foot of a column floats: the text
    // fills the column first and the picture opens the next one — a column is
    // never left short because a picture was waiting.
    let pending = null;
    const place = (it, h, ix) => {
      placed.push({ kind: it.kind, text: it.text, fig: it.fig, h, col, y, first: it.first, last: it.last, pi: it.pi, li: it.li, ix });
      y += h;
    };
    const nextCol = () => {
      col += 1;
      if (col >= cols) return false;
      y = tops[col];
      if (pending) { place(pending.it, pending.h, pending.i); pending = null; }
      return true;
    };
    for (; i < items.length; i++) {
      const it = items[i];
      if (it.gap) { if (y > tops[col]) y += gap; continue; }
      const h = it.h || lh;
      // a crosshead keeps two lines of its paragraph with it: it never
      // stands alone at the foot of a column
      const keep = it.kind === 'head' ? lh * 2 : (it.keepH || 0);
      if (y + h + keep > bottom - kept(col)) {
        if (it.kind === 'figure' && !pending && col < cols - 1 && bottom - kept(col) - y >= lh * 2) { pending = { it, h, i }; continue; }
        if (!nextCol()) break;
        // what does not fit into an empty column never will: a picture is
        // set anyway, a line ends the page
        if (y + h + keep > bottom - kept(col) && it.kind !== 'figure') break;
      }
      place(it, h, i);
    }
    if (pending) {
      const done = i >= items.length;
      if (done && y + pending.h <= bottom - kept(col)) { place(pending.it, pending.h, pending.i); pending = null; }
      else if (done && nextCol()) { /* placed at the top of the next column */ }
      else {
        // the page ends while the picture waits: it goes over, with what follows it
        const at = pending.i;
        for (let k = placed.length - 1; k >= 0; k--) if (placed[k].ix > at) placed.splice(k, 1);
        i = at;
      }
    }
    return { placed, next: i };
  }

  /** The rest of the items, balanced over the columns: all end at the same height. */
  function balanceColumns(items, from, cols, tops, kept, lh, gap, limit) {
    let need = 0;
    for (let i = from; i < items.length; i++) need += items[i].gap ? gap : (items[i].h || lh);
    for (let c = 0; c < cols; c++) need += kept(c);
    const even = (need + tops.reduce((a, t) => a + t, 0)) / cols;
    let bottom = Math.max(Math.max(...tops) + lh, even);
    for (let guard = 0; guard < 1200; guard++) {
      const r = fillColumns(items, from, cols, tops, bottom, kept, lh, gap);
      if (r.next >= items.length) return { placed: r.placed, bottom };
      if (limit && bottom > limit) return null;
      bottom += lh / 2;
    }
    return null;
  }

  /**
   * Pour the body into columns that may start at different heights (the first
   * ones under the photo, the last one at the top), filling each to the same
   * baseline — the way a page is actually made up.
   */
  function flowUneven(paragraphs, font, colW, cols, measure, lh, tops, indent, reserve, extras) {
    const ex = extras || {};
    const items = flowItems(paragraphs, font, colW, measure, lh, indent, ex);
    const r = balanceColumns(items, 0, cols, tops, (c) => (reserve && reserve[c]) || 0, lh, ex.gap || 0, 0);
    return r || { placed: [], bottom: Math.max(...tops) };
  }

  function pressLayout(m, chrome, d, measure, photoWish) {
    const W = 1080;
    const b = builder(W, measure);
    b.subject = autoSubject(m);
    b.images = (m.layout && m.layout.images) || null;
    const meta = m.content.meta || {};
    const P = PAGE_PAD, M = 48;
    const pageW = W - 2 * P, pageH = Math.round(pageW * A4_RATIO);
    const inner = pageW - 2 * M;
    const gutter = 24;
    const paras = m.content.paragraphs || [];
    // the editor's plan for this page, checked against the text (crossheads,
    // a second picture, the pull quote, the number of columns)
    const comp = composition(chrome, paras, 'print');
    // Printed at A4 the body is set at about 10 pt — what a paper uses, and
    // what a class can read. It is never made smaller to make a story fit.
    const font = { family: SERIF, size: 16.5 };
    const lh = comp.density === 'dense' ? 21 : comp.density === 'airy' ? 23.5 : 22;
    const indent = 14;
    // a brief of a few lines stands in one column; anything longer in two or more
    const wordsN = paras.join(' ').split(/\s+/).filter(Boolean).length;
    const cols = columnsForText(paras, font, inner, gutter, measure, comp.columns || d.columns || 3, wordsN < 60 ? 1 : 2);
    const colW = (inner - gutter * (cols - 1)) / cols;
    // the lead picture and the second picture keep their places among the three photos
    b.reservePhotos((d.photo !== false && comp.lead !== 'none' ? 1 : 0) + (comp.figure && cols >= 2 ? 1 : 0));
    const accent = d.pressAccent || '#1B4E8F';
    const warm = d.pressWarm || '#C2410C';
    const look = d.look || paperLook({}, d);
    const tint = shade(look.fill, 0.06), tint2 = shade(look.fill, 0.15);
    const adUse = { n: 0 };   // the house ad appears once; after that the puzzles fill
    const L = P + M, R = W - P - M;
    const pageTop = (i) => P + i * (pageH + PAGE_GAP);
    const bodyLimit = (i) => pageTop(i) + pageH - PRESS_FOOT - 14;
    const pub = String(chrome.publication || '');
    let y = pageTop(0) + 34;

    if (d.masthead) {
      // The nameplate, as a front page carries it: the name of the paper
      // large and centred between rules, the motto under it, then the
      // edition line with the date, the weather and the pointers inside.
      b.line(L, y, R, y, { color: INK, width: 2 });
      const nf = (s) => ({ family: SERIF, size: s, weight: 900 });
      let ns = 62;
      while (ns > 30 && measure(pub, nf(ns)) - pub.length * 1.5 > inner) ns -= 2;
      b.text(W / 2, y + ns + 6, pub, nf(ns), { color: INK, align: 'center', letterSpacing: -1.5 });
      y += ns + 24;
      if (chrome.tagline) {
        b.text(W / 2, y + 8, upper(chrome.tagline), { family: SANS, size: 10 }, { color: '#3F3F46', align: 'center', letterSpacing: 2.4 });
        y += 20;
      }
      y += 6;
      b.line(L, y, R, y, { color: INK, width: 3 });
      b.line(L, y + 5, R, y + 5, { color: INK, width: 1 });
      y += 5;
      const ef = { family: SANS, size: 10.5 };
      const left = upper(chrome.publicationLine || '');
      const right = upper([chrome.editionLine].concat(list(chrome.indexItems).slice(0, 3)).filter(Boolean).map(String).join('  ·  '));
      if (left) b.text(L, y + 19, left, ef, { color: INK, letterSpacing: 1 });
      if (right) b.text(R, y + 19, right, ef, { color: INK, letterSpacing: 1, align: 'right' });
      if (chrome.weatherNote) {
        const wt = String(chrome.weatherNote);
        const ww = measure(wt, ef) + 20;
        const lw = measure(left, ef) + left.length, rw = measure(right, ef) + right.length;
        if (W / 2 - ww / 2 > L + lw + 24 && W / 2 + ww / 2 < R - rw - 24) {
          b.icon('star', W / 2 - ww / 2, y + 8, 12, { fill: warm, stroke: false });
          b.text(W / 2 - ww / 2 + 18, y + 19, wt, ef, { color: INK });
        }
      }
      y += 29;
      b.line(L, y, R, y, { color: INK, width: 1 });
      y += 36;
      if (chrome.sectionLabel) {
        b.text(L, y, upper(chrome.sectionLabel), { family: SANS, size: 11, weight: 700 }, { color: warm, letterSpacing: 2 });
        y += 14;
      }
    } else {
      // running head: page number and section left, date and paper right
      b.text(L, y, String(chrome.pageLabel || '').replace(/^page\s*/i, '') || '2', { family: SERIF, size: 15, weight: 700 }, { color: INK });
      b.text(L + 26, y, upper(chrome.sectionLabel || ''), { family: SANS, size: 11, weight: 700 }, { color: '#57534E', letterSpacing: 1.4 });
      b.text(R, y, String(chrome.publicationLine || ''), { family: SERIF, size: 11.5 }, { color: '#57534E', align: 'right' });
      y += 10;
      b.line(L, y, R, y, { color: '#78716C', width: 1 });
      if (chrome.weatherNote || list(chrome.indexItems).length) {
        const f = { family: SANS, size: 10.5 };
        if (chrome.weatherNote) {
          b.icon('star', L, y + 6, 12, { fill: '#B45309', stroke: false });
          b.text(L + 18, y + 16, String(chrome.weatherNote), f, { color: '#57534E' });
        }
        let ix = R;
        list(chrome.indexItems).slice(0, 4).reverse().forEach((it) => {
          const w = measure(String(it), f) + 8;
          b.text(ix, y + 16, String(it), f, { color: '#78716C', align: 'right' });
          ix -= w + 14;
          b.text(ix + 6, y + 16, '·', f, { color: '#A8A29E', align: 'right' });
        });
        y += 24;
        b.line(L, y, R, y, { color: '#D6D3D1', width: 1 });
      }
      y += 30;
      // the editorial line: small caps between rules, as papers set their standing heads
      const kicker = upper(chrome.standingHead || chrome.publication || '');
      const band = cols >= 3 ? colW * 2 + gutter : inner;
      if (kicker) {
        const kf = { family: SERIF, size: 12, weight: 700 };
        const kw = measure(kicker, kf) + kicker.length * 1.6;
        const kx = L + band / 2 - kw / 2;
        b.line(L, y - 4, kx - 14, y - 4, { color: INK, width: 1 });
        b.text(kx, y, kicker, kf, { color: INK, letterSpacing: 1.6 });
        b.line(kx + kw + 14, y - 4, L + band, y - 4, { color: INK, width: 1 });
        y += 16;
      }
    }

    // Headline: black, heavy, set tight — a paper's headline is ink, not a
    // colour. On a front page it runs across the page; inside, over the first
    // columns. It gets bigger when it is short, the way a sub-editor sizes it.
    const headW = d.masthead ? inner : cols >= 3 ? colW * 2 + gutter : inner;
    const titleFont = (size) => ({ family: SERIF, size, weight: 700 });
    let hSize = d.masthead ? 50 : cols >= 3 ? 44 : 40;
    const titleLines = (size) => wrap(m.content.title, titleFont(size), headW, measure).length;
    if (titleLines(hSize) === 1 && titleLines(hSize + 10) === 1) hSize += 10;
    while (hSize > 30 && titleLines(hSize) > 3) hSize -= 2;
    const hLh = Math.round(hSize * 1.02);
    y = b.para(L, y + hSize * 0.8, m.content.title, titleFont(hSize), headW, { lineHeight: hLh, color: INK, letterSpacing: -0.6 }) - hLh + hSize * 0.3;

    // the deck under it: plain serif, no label in front
    if (meta.standfirst) {
      const deckW = d.masthead ? Math.min(inner, Math.round(inner * 0.82)) : headW;
      y = b.para(L, y + 24, meta.standfirst, { family: SERIF, size: 18.5 }, deckW, { color: '#3F3A34', lineHeight: 25 }) - 8;
    }
    // Drop cap or dateline: a front page opens its story with a large
    // initial and names the place in the byline; inside, the place opens the
    // first paragraph in bold capitals.
    const capInfo = (d.masthead || d.dropCap) && paras.length ? capOf(paras[0]) : null;
    const location = String(meta.location || '').trim();
    // the byline between hairlines, and the writer's face on a comment page
    const byline = [meta.byline ? 'By ' + meta.byline : '', capInfo && location ? location : ''].filter(Boolean).join('  ·  ');
    const who = String(chrome.portraitName || meta.byline || '').trim();
    const bf = { family: SANS, size: 11, weight: 700 };
    if (byline || who) {
      y += 12;
      b.line(L, y, L + headW, y, { color: '#A8A29E', width: 0.8 });
      if (who && d.photo === false) {
        b.photo(L, y + 8, 42, 42, { subject: 'portrait', seed: photo.hashOf(who), round: true, frame: false, print: true });
        b.text(L + 54, y + 25, upper(byline), bf, { color: INK, letterSpacing: 1 });
        b.text(L + 54, y + 42, upper(chrome.sectionLabel || pub), { family: SANS, size: 9.5 }, { color: '#78716C', letterSpacing: 1 });
        y += 58;
      } else {
        b.text(L, y + 19, upper(byline), bf, { color: INK, letterSpacing: 1 });
        const role = upper(chrome.sectionLabel ? chrome.sectionLabel + ' correspondent' : pub);
        if (role && !d.masthead) b.text(L + headW, y + 19, role, { family: SANS, size: 9.5 }, { color: '#78716C', letterSpacing: 1, align: 'right' });
        y += 28;
      }
      b.line(L, y, L + headW, y, { color: '#A8A29E', width: 0.8 });
    }
    y += 16;

    // The feature row: the lead picture over the first columns and, on a
    // front page, the column beside it for the quote and the facts at a
    // glance — not a narrow run of text squeezed against the picture.
    const quote = comp.pullQuote || String(meta.pullQuote || '');
    const S = moduleStyle(Object.assign({}, d, { accent: accent, ui: SANS, title: SERIF, body: SERIF }));
    S.print = true;
    const factMod = ['column', 'below'].map(sl => modulesFor(chrome, 'print', sl)).reduce((a, x) => a.concat(x), []).find(x => x.type === 'fact_box') || null;
    const wideLead = d.photo !== false && comp.lead !== 'none' && comp.lead !== 'column' && cols >= 3;
    const useSide = wideLead && d.masthead && !!(quote || factMod);
    const featureTop = y;
    let photoBottom = y, photoInfo = null;
    if (d.photo !== false && comp.lead !== 'none') {
      const photoW = comp.lead === 'column' ? colW : cols >= 3 ? colW * 2 + gutter : inner;
      const ratio = comp.lead === 'column' ? 0.75 : 0.5;
      const minH = Math.round(photoW * (comp.lead === 'column' ? 0.6 : 0.34));
      const maxH = Math.round(photoW * (comp.lead === 'column' ? 1.25 : 0.72));
      const photoH = Math.max(minH, Math.min(maxH, photoWish || Math.round(photoW * ratio)));
      b.photo(L, y, photoW, photoH, { picRole: 'lead', seed: photo.hashOf(m.content.title || 'lead'), subject: chrome.photoSubject, colour: d.photoColour !== false, print: true, halftone: true });
      const leadCredit = (b.last && b.last.credit) || chrome.captionCredit;
      const cy = y + photoH + 14;
      const capFont = { family: SANS, size: 12.5 };
      // the credit keeps at most half the width; the caption wraps in what is left
      const creditFont = { family: SANS, size: 10.5, style: 'italic' };
      const creditW = leadCredit ? Math.min(measure(String(leadCredit), creditFont), photoW * 0.45) + 16 : 0;
      const capLines = wrap((b.last && b.last.caption) || chrome.photoCaption || '', capFont, photoW - Math.max(creditW, 40), measure);
      capLines.forEach((l, i) => b.text(L, cy + i * 16, l, capFont, { color: '#3F3F46' }));
      if (leadCredit) b.text(L + photoW, cy, leadCredit, { family: SANS, size: 10.5, style: 'italic' }, { color: '#78716C', align: 'right' });
      photoBottom = cy + Math.max(capLines.length * 16, 16) + 12;
      photoInfo = { w: photoW, h: photoH, min: minH, max: maxH };
    }
    let sideBottom = y;
    const sideTaken = new Set();
    const qFont = { family: SERIF, size: 20, style: 'italic' };
    if (useSide) {
      const sx = L + (cols - 1) * (colW + gutter);
      let sy = y;
      if (quote) {
        b.line(sx, sy, sx + colW, sy, { color: accent, width: 3 });
        b.text(sx - 2, sy + 52, '\u201C', { family: SERIF, size: 60, weight: 700 }, { color: accent, deco: true });
        const ql = wrap(quote, qFont, colW - 8, measure);
        ql.forEach((l, i) => b.text(sx, sy + 66 + i * 27, l, qFont, { color: INK, role: 'quote' }));
        sy += 66 + (ql.length - 1) * 27 + 26;
        b.text(sx, sy, upper(pub), { family: SANS, size: 9.5, weight: 700 }, { color: warm, letterSpacing: 1.2 });
        sy += 16;
      }
      if (factMod) {
        sy += quote ? 16 : 0;
        b.line(sx, sy, sx + colW, sy, { color: '#77776F', width: 1 });
        b.text(sx, sy + 24, upper(factMod.heading || factMod.label || 'At a glance'), { family: SANS, size: 10.5, weight: 700 }, { color: INK, letterSpacing: 1.4 });
        let iy = sy + 34;
        list(factMod.items).slice(0, 5).forEach((it) => {
          b.rect(sx, iy + 10, 6, 6, { fill: accent });
          iy = b.para(sx + 16, iy + 16, clipText(String(it), 110), { family: SERIF, size: 14 }, colW - 16, { color: INK, lineHeight: 19 }) + 6;
        });
        sy = iy + 4;
      }
      // A bigger picture leaves room under the quote: the column beside it
      // takes a module of the page, the pointers inside the paper, or the
      // paper's own advertisement — never a white hole.
      let room = photoBottom - sy - 18;
      if (room > 110) {
        const probe = builder(W, measure);
        probe.subject = b.subject; probe.images = b.images;
        for (const mod of modulesFor(chrome, 'print', 'column').concat(modulesFor(chrome, 'print', 'below')).filter(x => x !== factMod)) {
          const r = moduleRenderer(mod);
          const h = r ? (r(probe, 0, 0, colW, mod, S) || 0) : 0;
          if (!h || h > room) continue;
          b.line(sx, sy + 14, sx + colW, sy + 14, { color: '#77776F', width: 1 });
          r(b, sx, sy + 26, colW, mod, S);
          sideTaken.add(mod);
          sy += 26 + h;
          room = photoBottom - sy - 18;
          if (room < 110) break;
        }
      }
      const inside = list(chrome.indexItems).map(String).filter(Boolean).slice(0, 5);
      if (room > 60 + inside.length * 30 && inside.length >= 2) {
        sy += 14;
        b.line(sx, sy, sx + colW, sy, { color: INK, width: 2 });
        b.text(sx, sy + 24, 'INSIDE', { family: SANS, size: 11, weight: 700 }, { color: INK, letterSpacing: 2 });
        let iy = sy + 34;
        inside.forEach((it) => {
          const mt = /^(.*?)[\s,:\u00B7-]+(\d{1,3})$/.exec(it);
          const name = mt ? mt[1] : it, page = mt ? mt[2] : '';
          b.text(sx, iy + 20, clipText(name, 28), { family: SERIF, size: 16, weight: 700 }, { color: INK });
          if (page) b.text(sx + colW, iy + 20, page, { family: SANS, size: 13, weight: 700 }, { color: warm, align: 'right' });
          b.line(sx, iy + 30, sx + colW, iy + 30, { color: tint2 });
          iy += 30;
        });
        sy = iy + 6;
        room = photoBottom - sy - 18;
      }
      if (room > 80) { houseAd(b, sx, sy + 14, colW, Math.min(room, 200), { accent, tint, tint2, pub, chrome, measure, used: adUse }); sy += 14 + Math.min(room, 200); }
      sideBottom = sy;
      b.line(sx - gutter / 2, featureTop, sx - gutter / 2, Math.max(photoBottom, sideBottom) - 12, { color: '#C9C9C3' });
    }

    // where the columns start on page 1
    const tops0 = [];
    let leadCols = cols;
    if (useSide) {
      let top = Math.max(photoBottom, sideBottom) + 4;
      b.line(L, top, R, top, { color: '#77776F', width: 1 });
      top += 16;
      for (let c = 0; c < cols; c++) tops0.push(top);
    } else {
      leadCols = comp.lead === 'column' ? 1 : cols >= 3 ? cols - 1 : cols;
      for (let c = 0; c < cols; c++) tops0.push(c >= leadCols ? y : photoBottom);
    }

    // The pull quote (when it does not stand beside the picture) and the
    // modules of the column are kept free at the foot of the last column on
    // the last page before the text is poured, so the columns stay even.
    const qLines = !useSide && quote ? wrap(quote, qFont, colW - 36, measure) : [];
    let bodyLines = 0;
    for (const p of paras) bodyLines += wrap(p, font, colW - indent, measure).length;
    const quoteH = qLines.length ? 44 + qLines.length * 26 + 46 : 0;
    let useQuote = quoteH > 0 && bodyLines >= cols * MIN_COL_LINES;
    const colMods = modulesFor(chrome, 'print', 'column').filter(x => x !== factMod && !sideTaken.has(x));
    const colRoom = Math.max(0, bodyLines - cols * MIN_COL_LINES) * lh;
    let colH = 0;
    if (colMods.length) {
      const probe = builder(W, measure);
      probe.subject = b.subject; probe.images = b.images;
      const used = placeModules(probe, colMods, 0, 0, colW, S, { max: 2 });
      colH = Math.min(colRoom, used + 22);
      if (colH < 60) colH = 0;
    }

    // the second picture and the crossheads go into the flow of the columns
    const capFont2 = { family: SANS, size: 11.5 };
    let figures = {};
    // a brief in one column carries one picture, not two
    if (comp.figure && cols >= 2) {
      const capLines = comp.figure.caption ? wrap(comp.figure.caption, capFont2, colW, measure) : [];
      figures[comp.figure.after] = { subject: comp.figure.subject, capLines, h: Math.round(colW * 0.62) + capLines.length * 15 + 28 };
    }
    // the drop cap spans three lines; the dateline stands in the first line
    let cap = null;
    // (three lines deep; a first paragraph of two lines gets a two-line
    // initial; a brief of a few lines gets none)
    for (const capLinesN of capInfo && bodyLines >= cols * 4 ? [3, 2] : []) {
      const capSize = Math.round(((capLinesN - 1) * lh + font.size * 0.7) / 0.7);
      const capFont = { family: SERIF, size: capSize, weight: 700 };
      const w = measure(capInfo.cap, capFont) + 8;
      const lines = wrapJustified(capInfo.rest, font, (i) => (i < capLinesN ? colW - w : colW), measure);
      if (lines.length >= capLinesN) { cap = { cap: capInfo.cap, rest: capInfo.rest, glue: capInfo.glue, w, lines: capLinesN, font: capFont }; break; }
    }
    const dateline = !cap && location ? upper(location) : '';
    const dlFont = { family: SANS, size: 12, weight: 700 };
    const dlW = dateline ? measure(dateline + ' —', dlFont) + dateline.length * 0.6 + 8 : 0;

    // continuation pages: a short head, then the columns from the top
    const contTop = (i) => pageTop(i) + 34 + 10 + 46 + 18 + 16;
    const lastCol = cols - 1;
    const jumpH = lh * 1.3;   // "Continued on page 2" at the foot of the last column
    const pour = (figs) => {
      const items = flowItems(paras, font, colW, measure, lh, indent, { heads: comp.heads, figures: figs, firstIndent: dlW, cap });
      const out = [];
      let from = 0, pi = 0, tops = tops0, reserveUsed = true;
      for (; pi < 30; pi++) {
        const limit = bodyLimit(pi);
        const reserveOf = (c) => (c === lastCol ? (useQuote ? quoteH : 0) + colH : 0);
        let bal = balanceColumns(items, from, cols, tops, reserveOf, lh, 0, limit);
        if (bal && bal.bottom > limit) bal = null;
        if (!bal && (useQuote || colH)) {
          // the story fits on this page only without the quote box and the
          // modules of the column: they give way, the text does not
          const bare = balanceColumns(items, from, cols, tops, () => 0, lh, 0, limit);
          if (bare && bare.bottom <= limit) { bal = bare; reserveUsed = false; }
        }
        if (bal) { out.push({ page: pi, placed: bal.placed, bottom: bal.bottom, tops, last: true }); break; }
        const fill = fillColumns(items, from, cols, tops, limit, (c) => (c === lastCol ? jumpH : 0), lh, 0);
        if (fill.next === from) { out.push({ page: pi, placed: [], bottom: limit, tops, last: true, stuck: true }); break; }
        out.push({ page: pi, placed: fill.placed, bottom: limit, tops, last: false });
        from = fill.next;
        tops = [];
        for (let c = 0; c < cols; c++) tops.push(contTop(pi + 1));
      }
      return { flows: out, reserveUsed };
    };
    // A second picture set beside the lead picture, at the top of the last
    // column, reads as one wide picture with a hole in it. When the editor's
    // place for it lands there, the figure moves up to the last paragraph
    // that ends in a column under the lead picture — where a make-up editor
    // would put it — until it stands clear.
    let poured = pour(figures);
    for (let guard = 0; guard < 6 && !useSide; guard++) {
      const first = poured.flows[0];
      const fig = first.placed.find(l => l.kind === 'figure');
      if (!fig || tops0[fig.col] >= photoBottom - 1 || fig.y >= photoBottom) break;
      const earlier = first.placed.filter(l => l.kind === 'line' && l.last && l.col < fig.col && tops0[l.col] >= photoBottom - 1 && l.pi < fig.pi);
      // no paragraph under the lead picture to take it: the picture stays
      // where the editor put it — a picture is never dropped
      if (!earlier.length) break;
      const moved = {};
      moved[earlier[earlier.length - 1].pi] = figures[fig.pi];
      figures = moved;
      poured = pour(figures);
    }
    if (!poured.reserveUsed) { useQuote = false; colH = 0; }
    const flows = poured.flows;
    const N = flows.length;

    // draw the pages: continuation heads, the text, the rules between columns
    const pages = [];
    for (const f of flows) {
      const pt = pageTop(f.page);
      pages.push({ x: P, y: pt, w: pageW, h: pageH });
      if (f.page > 0) {
        let cy = pt + 34;
        b.text(L, cy, pub, { family: SERIF, size: 15, weight: 700 }, { color: INK });
        b.text(R, cy, upper(chrome.publicationLine || ''), { family: SANS, size: 10 }, { color: '#57534E', align: 'right', letterSpacing: 1 });
        cy += 10;
        b.line(L, cy, R, cy, { color: INK, width: 1 });
        cy += 46;
        const cf = { family: SERIF, size: 22, style: 'italic' };
        const title = wrap(m.content.title + ' · Continued', cf, inner, measure)[0];
        b.text(L, cy, title, cf, { color: INK });
        cy += 18;
        b.line(L, cy, R, cy, { color: '#77776F', width: 1 });
      }
      for (const l of f.placed) {
        const x = L + l.col * (colW + gutter);
        const yy = l.y + lh;
        if (l.kind === 'head') {
          b.text(x, l.y + lh * 1.5, upper(l.text), { family: SANS, size: 12, weight: 700 }, { color: INK, letterSpacing: 1 });
          continue;
        }
        if (l.kind === 'figure') {
          const ph = Math.round(colW * 0.62);
          b.photo(x, l.y + 8, colW, ph, { picRole: 'second', seed: photo.hashOf(String(l.fig.subject) + l.pi), subject: l.fig.subject, colour: d.photoColour !== false, print: true, halftone: true });
          l.fig.capLines.forEach((cl, i) => b.text(x, l.y + 8 + ph + 17 + i * 15, cl, capFont2, { color: '#3F3F46' }));
          continue;
        }
        // a paper indents every paragraph but the first — and numbers none of
        // them; the numbers for the answer key stand in the teacher's copy
        let dent = l.first && l.pi > 0 ? indent : 0;
        if (l.pi === 0 && cap && l.li < cap.lines) {
          if (l.li === 0) b.text(x, yy + (cap.lines - 1) * lh, cap.cap, cap.font, { color: INK, role: 'body', glue: cap.glue });
          dent = cap.w;
        } else if (l.first && l.pi === 0 && dateline) {
          b.text(x, yy, dateline + ' —', dlFont, { color: INK, letterSpacing: 0.6 });
          dent = dlW;
        }
        const lx = x + dent, lw = colW - dent;
        if (l.last) b.text(lx, yy, l.text, font, { color: INK, role: 'body' });
        else justifyLine(b, lx, yy, l.text, font, lw, measure, { color: INK, role: 'body' });
      }
      if (!f.last) {
        const jx = L + lastCol * (colW + gutter) + colW;
        b.text(jx, f.bottom - 6, 'Continued on page ' + (f.page + 2) + ' ▸', { family: SERIF, size: 13, style: 'italic' }, { color: INK, align: 'right' });
      }
      const bottom = f.last ? f.bottom + 6 : f.bottom;
      for (let c = 1; c < cols; c++) {
        const x = L + c * (colW + gutter) - gutter / 2;
        b.line(x, f.tops[c] + 2, x, bottom - 8, { color: '#D4D4CF' });
      }
    }

    // the foot of the last column: the boxed quote, the modules of the column
    const lastFlow = flows[N - 1];
    const lastPage = lastFlow.page;
    const bodyBottom = lastFlow.bottom + 6;
    const lastLines = lastFlow.placed.filter(l => l.col === lastCol);
    const lastY = lastLines.length ? Math.max(...lastLines.map(l => l.y + l.h)) : lastFlow.tops[lastCol];
    const colLeft = [];
    const gx = L + lastCol * (colW + gutter);
    const stackH = (useQuote ? quoteH : 0) + colH;
    const footY = bodyBottom - stackH;
    let gy = footY - lastY > lh * 1.5 ? lastY + 14 : footY;
    const drawQuote = (qy, lines) => {
      b.line(gx, qy, gx + colW, qy, { color: accent, width: 3 });
      lines.forEach((l, i) => b.text(gx + 18, qy + 44 + i * 26, l, qFont, { color: accent, role: 'quote' }));
      b.text(gx + 18, qy + 44 + lines.length * 26 + 16, upper(pub), { family: SANS, size: 9.5, weight: 700 }, { color: warm, letterSpacing: 1.2 });
      b.line(gx, qy + 44 + lines.length * 26 + 30, gx + colW, qy + 44 + lines.length * 26 + 30, { color: tint2 });
      return qy + 44 + lines.length * 26 + 46;
    };
    if (useQuote) gy = drawQuote(gy + 16, qLines);
    if (colH > 0) {
      b.line(gx, gy + 4, gx + colW, gy + 4, { color: '#78716C', width: 2 });
      gy = placeModules(b, colMods, gx, gy + 16, colW, S, { max: 2, until: bodyBottom - 10, slack: 20, leftovers: colLeft });
    } else colLeft.push(...colMods);
    const rest = bodyBottom - gy;
    if (rest > 70 && lastLines.length) houseAd(b, gx, gy + 22, colW, rest - 34, { accent, tint, tint2, pub, chrome, measure, used: adUse });

    // under the story on the last page: the other story, the listings, the
    // small ads — as many as the page holds
    y = Math.max(bodyBottom, gy) + 16;
    let modsPlaced = colH > 0 ? colMods.length - colLeft.length : 0;
    const placedMods = new Set([...sideTaken].concat(colH > 0 ? colMods.filter(x => !colLeft.includes(x)) : []));
    const footTop = pageTop(lastPage) + pageH - PRESS_FOOT;
    const belowMods = modulesFor(chrome, 'print', 'below').filter(x => x !== factMod && !sideTaken.has(x)).concat(colLeft);
    if (belowMods.length && footTop - y > 110) {
      const half = (inner - gutter) / 2;
      const room = footTop - y - 30;
      const probe = builder(W, measure);
      probe.subject = b.subject; probe.images = b.images;
      const heights = belowMods.slice(0, 4).map(mod => { const r = moduleRenderer(mod); return r ? (r(probe, 0, 0, half, mod, S) || 0) : 0; });
      const colTops = [0, 0];
      const take = [];
      belowMods.slice(0, 4).forEach((mod, i) => {
        const side = colTops[0] <= colTops[1] ? 0 : 1;
        if (!heights[i] || colTops[side] + heights[i] > room - 18) return;
        take.push({ mod, side, at: colTops[side] });
        colTops[side] += heights[i];
      });
      if (take.length) {
        b.line(L, y, R, y, { color: '#78716C', width: 2 });
        for (const t of take) { moduleRenderer(t.mod)(b, L + t.side * (half + gutter), y + 18 + t.at, half, t.mod, S); placedMods.add(t.mod); }
        modsPlaced += take.length;
        // the shorter half of the strip is squared off with the house ad
        const hi = Math.max(colTops[0], colTops[1]);
        [0, 1].forEach((side) => {
          if (hi - colTops[side] >= 70) houseAd(b, L + side * (half + gutter), y + 18 + colTops[side] + (colTops[side] ? 8 : 0), half, hi - colTops[side] - (colTops[side] ? 20 : 12), { accent, tint, tint2, pub, chrome, measure, used: adUse });
        });
        y += 18 + hi + 6;
      }
    }
    // What is left of the page is filled the way a paper fills it: the
    // puzzle and the paper's own advertisement — never a white hole.
    const gap = footTop - 14 - y;
    const lastFill = (lastFlow.bottom - Math.min(...lastFlow.tops)) / Math.max(1, bodyLimit(lastPage) - Math.min(...lastFlow.tops));
    let endY = y;
    if (gap >= 250) {
      const s = Math.min(gap - 40, 300, (inner - gutter) / 2);
      b.line(L, y + 6, R, y + 6, { color: '#78716C', width: 2 });
      const seed = photo.hashOf(m.content.title || pub);
      sudoku(b, L, y + 24, s, { seed, accent, tint });
      if (adUse.n) crossword(b, L + s + gutter, y + 24, inner - s - gutter, s, { seed, accent });
      else houseAd(b, L + s + gutter, y + 24, inner - s - gutter, s, { accent, tint, tint2, pub, chrome, measure, used: adUse });
      endY = y + 24 + s;
    } else if (gap >= 56) {
      const h = Math.min(gap - 20, 200);
      houseAd(b, L, y + 12, inner, h, { accent, tint, tint2, pub, chrome, measure, used: adUse });
      endY = y + 12 + h;
    }
    // What is still empty after that is not printed: the last page ends
    // under its content, like a page cut from the paper, and the worksheet
    // goes on below it. A full page stays a full A4 page.
    const lastH = Math.min(pageH, Math.max(Math.round(pageH * 0.3), Math.round(endY + 26 + PRESS_FOOT - pageTop(lastPage))));
    pages[pages.length - 1].h = lastH;
    const heightOf = (pg) => (pg === lastPage ? lastH : pageH);
    // the footer of every page: the note, the name of the paper, the page
    for (const f of flows) {
      const fy = pageTop(f.page) + heightOf(f.page) - PRESS_FOOT + 6;
      b.line(L, fy, R, fy, { color: '#A8A29E' });
      b.text(L, fy + 20, String(chrome.footerNote || ''), { family: SERIF, size: 11, style: 'italic' }, { color: '#57534E' });
      b.text(R, fy + 20, upper(pub) + '  ·  ' + (f.page + 1) + ' / ' + N, { family: SANS, size: 10, weight: 700 }, { color: '#57534E', align: 'right', letterSpacing: 1 });
    }
    const model = paperFinish(b, W, pageTop(N - 1) + lastH + P, d, pages);
    // the grid the pages were set on, so the proportions can be measured (§29)
    model.columns = [];
    for (const f of flows) {
      for (let c = 0; c < cols; c++) model.columns.push({ x: L + c * (colW + gutter), w: colW, top: f.tops[c], bottom: f.last ? bodyBottom : f.bottom, page: f.page });
    }
    return { model, pages: N, gap, lastFill, photo: photoInfo, placed: placedMods, mods: modsPlaced + sideTaken.size + (useSide && factMod ? 1 : 0), quote: (useQuote || (useSide && quote)) ? 1 : 0 };
  }

  /** The paper's own advertisement, sized to the space it fills. */
  function houseAd(b, x, y, w, h, o) {
    if (h < 40 || w < 120) return;
    if (o.used) o.used.n += 1;
    b.rect(x, y, w, h, { fill: o.tint, radius: 2 });
    const k = Math.min(1, h / 120);
    const box = Math.round(34 * Math.max(0.7, k));
    const cx = x + 18, cy = y + h / 2 - box / 2;
    b.rect(cx, cy, box, box, { fill: o.accent, radius: 3 });
    b.text(cx + box / 2, cy + box * 0.72, initial(o.pub), { family: SERIF, size: Math.round(box * 0.6), weight: 700 }, { color: '#FFFFFF', align: 'center' });
    const tx = cx + box + 16;
    const room = x + w - tx - 18;
    const tf = { family: SERIF, size: h >= 90 ? 22 : 17, weight: 700 };
    const line2 = String((o.chrome && (o.chrome.tagline || o.chrome.publicationLine)) || '');
    const cta = 'SUBSCRIBE';
    const ctaW = o.measure(cta, { family: SANS, size: 11, weight: 700 }) + cta.length * 1.2;
    const showCta = room > 380;
    const textRoom = room - (showCta ? ctaW + 40 : 0);
    b.text(tx, y + h / 2 - (line2 && h >= 70 ? 4 : -6), clipText(o.pub, Math.floor(textRoom / (tf.size * 0.5))), tf, { color: INK });
    if (line2 && h >= 70) b.text(tx, y + h / 2 + 18, clipText(line2, Math.floor(textRoom / 6.5)), { family: SERIF, size: 13, style: 'italic' }, { color: '#57534E' });
    if (showCta) {
      const bx = x + w - 18 - ctaW - 28, by = y + h / 2 - 15;
      b.rect(bx, by, ctaW + 28, 30, { fill: o.accent, radius: 15 });
      b.text(bx + (ctaW + 28) / 2, by + 20, cta, { family: SANS, size: 11, weight: 700 }, { color: '#FFFFFF', align: 'center', letterSpacing: 1.2 });
    }
    if (h > 150) {
      // a house ad on a large space shows the paper itself
      for (let i = 0; i < 3; i++) b.rect(tx, y + h / 2 + 40 + i * 14, Math.min(room, 260) * (i === 2 ? 0.55 : 1), 6, { fill: o.tint2, radius: 3 });
    }
  }

  /** A sudoku, the filler of every paper: a valid grid, some numbers given. */
  function sudoku(b, x, y, s, o) {
    const r = rng(o.seed || 7);
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => r() - 0.5);
    b.text(x, y + 14, 'SUDOKU', { family: SANS, size: 12, weight: 700 }, { color: INK, letterSpacing: 1.6 });
    for (let i = 0; i < 3; i++) b.circle(x + 90 + i * 12, y + 10, 4, { fill: i < 2 ? o.accent : 'none', stroke: o.accent, width: 1.2 });
    const top = y + 28, size = s - 28, cell = size / 9;
    const gx = x + (s - size) / 2;
    b.rect(gx, top, size, size, { fill: '#FFFFFF', stroke: INK });
    for (let i = 1; i < 9; i++) {
      const thick = i % 3 === 0;
      b.line(gx + i * cell, top, gx + i * cell, top + size, { color: thick ? INK : '#A8A29E', width: thick ? 2 : 0.8 });
      b.line(gx, top + i * cell, gx + size, top + i * cell, { color: thick ? INK : '#A8A29E', width: thick ? 2 : 0.8 });
    }
    const f = { family: SANS, size: Math.round(cell * 0.55), weight: 600 };
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (r() > 0.36) continue;
        const v = digits[(row * 3 + Math.floor(row / 3) + col) % 9];
        b.text(gx + col * cell + cell / 2, top + row * cell + cell * 0.7, String(v), f, { color: INK, align: 'center' });
      }
    }
  }

  /** A crossword grid, the other filler of every paper: black squares in rotation symmetry, numbered starts. */
  function crossword(b, x, y, w, h, o) {
    const r = rng((o.seed || 7) + 11);
    const n = 11;
    const size0 = Math.min(w, h - 28);
    b.text(x + w - size0, y + 14, 'CROSSWORD', { family: SANS, size: 12, weight: 700 }, { color: INK, letterSpacing: 1.6 });
    const size = Math.min(w, h - 28), cell = size / n;
    const gx = x + w - size, top = y + 28;
    const black = [];
    for (let i = 0; i < n; i++) black.push(new Array(n).fill(false));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (black[i][j]) continue;
        const on = (i % 2 === 1 && j % 2 === 1) || r() < 0.08;
        if (on) { black[i][j] = true; black[n - 1 - i][n - 1 - j] = true; }
      }
    }
    b.rect(gx, top, size, size, { fill: '#FFFFFF', stroke: INK });
    let num = 1;
    const nf = { family: SANS, size: Math.max(7, Math.round(cell * 0.26)) };
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cx = gx + j * cell, cy = top + i * cell;
        if (black[i][j]) { b.rect(cx, cy, cell, cell, { fill: INK }); continue; }
        const across = (j === 0 || black[i][j - 1]) && j + 1 < n && !black[i][j + 1];
        const down = (i === 0 || black[i - 1][j]) && i + 1 < n && !black[i + 1][j];
        if (across || down) { b.text(cx + 2, cy + nf.size + 1, String(num), nf, { color: INK }); num += 1; }
      }
    }
    for (let k = 1; k < n; k++) {
      b.line(gx + k * cell, top, gx + k * cell, top + size, { color: '#57534E', width: 0.8 });
      b.line(gx, top + k * cell, gx + size, top + k * cell, { color: '#57534E', width: 0.8 });
    }
  }

  /** At least this many lines before another column is opened. */
  const MIN_COL_LINES = 10;


  /**
   * How many columns this much text really carries. Starts at the number the
   * design wants and takes one away as long as the columns would stay thin.
   */
  function columnsForText(paragraphs, font, inner, gutter, measure, maxCols, minCols) {
    const floor = Math.max(1, minCols || 1);
    for (let c = maxCols; c > floor; c--) {
      const colW = (inner - gutter * (c - 1)) / c;
      let lines = 0;
      for (const p of paragraphs) lines += wrap(p, font, colW - 16, measure).length;
      if (lines / c >= MIN_COL_LINES) return c;
    }
    return floor;
  }

  /** A page out of a book. */
  /** A page out of a book: a narrow, justified measure with a drop cap. */
  function bookModel(m, chrome, d, measure) {
    const W = 720;
    const b = builder(W, measure);
    b.subject = autoSubject(m);
    b.images = (m.layout && m.layout.images) || null;
    const P = PAGE_PAD, M = 92, GUT = 116;
    const L = P + GUT, R = W - P - M;
    const inner = R - L;
    let y = P + 52;

    // running head, chapter line, ornament, title
    b.text(W / 2, y, upper(chrome.publication || ''), { family: SERIF, size: 9.5 }, { color: '#8A8578', align: 'center', letterSpacing: 2.6 });
    y += 54;
    if (chrome.sectionLabel) {
      b.text(W / 2, y, upper(chrome.sectionLabel), { family: SERIF, size: 11, weight: 700 }, { color: '#57534E', align: 'center', letterSpacing: 2.4 });
      y += 22;
      [-1, 0, 1].forEach(i => b.circle(W / 2 + i * 11, y + 2, 1.7, { fill: '#A8A29E' }));
      y += 30;
    }
    y = b.para(W / 2, y + 18, m.content.title, { family: SERIF, size: 24, weight: 700 }, inner, { color: INK, align: 'center', lineHeight: 31 }) + 12;
    b.line(W / 2 - 34, y, W / 2 + 34, y, { color: '#C7C2B5' });
    y += 38;

    // the text: first paragraph with an initial, the others indented
    const font = { family: SERIF, size: 15 };
    const lh = 25;
    list(m.content.paragraphs).forEach((p, i) => {
      if (i === 0 && p.length > 60) {
        y = dropCapPara(b, L, y, p, font, inner, SERIF, measure, INK, { lineHeight: lh, justify: true }) + lh - 6;
        return;
      }
      const indent = i > 0 ? 24 : 0;
      const lines = wrapIndent(p, font, inner, measure, indent);
      lines.forEach((l, k) => {
        const x = L + (k === 0 ? indent : 0);
        const width = inner - (k === 0 ? indent : 0);
        if (k === lines.length - 1) b.text(x, y + k * lh, l, font, { color: INK, role: 'body' });
        else justifyLine(b, x, y + k * lh, l, font, width, measure, { color: INK, role: 'body' });
      });
      y += lines.length * lh;
    });
    b.text(W / 2, y + 46, String(chrome.pageLabel || ''), { family: SERIF, size: 11 }, { color: '#78716C', align: 'center' });
    const model = paperFinish(b, W, y + 76 + P, d);
    // the shadow of the binding along the inner edge of the page
    model.finish.gutter = { x: P, w: 58 };
    return model;
  }

  /** A hand-written page in a ruled notebook, the writing sitting on the rules. */
  function notebookModel(m, chrome, d, measure) {
    const W = 780;
    const b = builder(W, measure);
    // the one picture of this medium keeps its place among the three photos
    if (photo.isSubject(chrome.photoSubject) || photo.isSubject(chrome.attachmentSubject)) b.reservePhotos(1);
    b.subject = autoSubject(m);
    b.images = (m.layout && m.layout.images) || null;
    const P = PAGE_PAD, M = 86;
    const L = P + M, R = W - P - 42;
    const inner = R - L;
    const lh = 31;
    const top = P + 34;              // the first rule
    const rule = (n) => top + n * lh; // every line of writing sits on rule n

    const ink = '#1F3A93', dark = '#16306F';
    let n = 1;
    b.text(R, rule(n) - 7, String(chrome.publicationLine || chrome.pageLabel || ''), { family: HAND, size: 19 }, { color: '#475569', align: 'right' });
    n += 2;
    const titleLines = wrap(m.content.title, { family: HAND, size: 29, weight: 600 }, inner, measure);
    titleLines.forEach((l, i) => b.text(L, rule(n + i) - 7, l, { family: HAND, size: 29, weight: 600 }, { color: dark }));
    n += titleLines.length;
    b.line(L, rule(n - 1) + 2, L + Math.min(inner, measure(titleLines[0], { family: HAND, size: 29, weight: 600 }) + 12), rule(n - 1) + 3, { color: '#93C5FD', width: 2 });
    n += 1;

    // the writing: every line on its rule, with the small unevenness of a hand
    list(m.content.paragraphs).forEach((para, pi) => {
      const font = { family: HAND, size: 21 };
      wrapIndent(para, font, inner, measure, pi ? 16 : 0).forEach((l, k) => {
        const jitter = ((pi * 7 + k * 13) % 5) - 2;
        b.text(L + (k === 0 && pi ? 16 : 0) + jitter, rule(n) - 7, l, { family: HAND, size: 21 + (jitter % 2) * 0.3 }, { color: ink, role: 'body' });
        n += 1;
      });
      n += 1;
    });
    // a picture stuck into the diary, slightly askew, with tape over the corners
    let bottom = rule(n + 1) + 10;
    if (photo.isSubject(chrome.photoSubject)) {
      const pw = Math.min(260, inner * 0.6), ph = Math.round(pw * 0.78);
      const px = L + (inner - pw) / 2, py = bottom + 12;
      b.rect(px - 10, py - 10, pw + 20, ph + 44, { fill: '#FFFDF8', shadow: 'soft' });
      b.photo(px, py, pw, ph, { subject: chrome.photoSubject, seed: photo.hashOf(m.content.title || 'diary'), colour: true, frame: false, picRole: 'lead' });
      if (chrome.photoCaption) b.text(px + pw / 2, py + ph + 26, clipText(chrome.photoCaption, 34), { family: HAND, size: 17 }, { color: '#475569', align: 'center' });
      // two strips of tape, across the corners of the print
      b.poly([[px - 26, py + 2], [px + 6, py - 26], [px + 26, py - 8], [px - 8, py + 22]], { fill: 'rgba(214,222,232,.7)' });
      b.poly([[px + pw - 22, py + ph + 36], [px + pw + 10, py + ph + 8], [px + pw + 28, py + ph + 26], [px + pw - 4, py + ph + 54]], { fill: 'rgba(214,222,232,.7)' });
      bottom = py + ph + 56;
    }

    // the ruling, the red margin and the punched holes go under the writing
    const under = [];
    for (let ry = top; ry < bottom; ry += lh) under.push({ type: 'line', x1: P + 16, y1: ry, x2: W - P - 16, y2: ry, color: '#CBDDF6', width: 1 });
    under.push({ type: 'line', x1: L - 22, y1: P + 6, x2: L - 22, y2: bottom, color: '#F4A6A6', width: 1.5 });
    b.blocks.unshift(...under);
    const holes = [0.22, 0.5, 0.78].map(f => ({ type: 'circle', x: P + 24, y: P + (bottom - P) * f, r: 9, fill: '#D8D2C6' }));
    b.blocks.push(...holes);
    return paperFinish(b, W, bottom + P, d);
  }

  /** A printed sheet: report, info sheet, or any screen text forced onto paper. */
  function sheetModel(m, chrome, d, measure) {
    const W = 840;
    const b = builder(W, measure);
    // the one picture of this medium keeps its place among the three photos
    if (photo.isSubject(chrome.photoSubject) || photo.isSubject(chrome.attachmentSubject)) b.reservePhotos(1);
    b.subject = autoSubject(m);
    b.images = (m.layout && m.layout.images) || null;
    const meta = m.content.meta || {};
    const P = PAGE_PAD, M = 64;
    const L = P + M, R = W - P - M;
    const inner = R - L;
    const accent = d.accent || '#334155';
    let y = P + 46;

    // letterhead: a logo mark, the name, the date on the right, an accent rule
    const name = chrome.publication || chrome.siteName || '';
    b.rect(L, y - 18, 30, 30, { fill: accent, radius: 5 });
    b.text(L + 15, y + 3, initial(name), { family: SANS, size: 17, weight: 800 }, { color: '#FFFFFF', align: 'center' });
    b.text(L + 42, y - 2, name, { family: SANS, size: 15, weight: 800 }, { color: '#1C1917' });
    if (chrome.sectionLabel) b.text(L + 42, y + 14, upper(chrome.sectionLabel), { family: SANS, size: 9.5, weight: 700 }, { color: '#78716C', letterSpacing: 1.2 });
    b.text(R, y - 2, String(chrome.publicationLine || chrome.metaLine || ''), { family: SANS, size: 10 }, { color: '#78716C', align: 'right' });
    y += 28;
    b.rect(L, y, inner, 3, { fill: accent });
    y += 40;

    y = b.para(L, y, meta.subject || m.content.title, { family: SANS, size: 24, weight: 800 }, inner, { color: '#1C1917', lineHeight: 31 });
    const byline = [meta.byline, meta.from, meta.dateline].filter(Boolean).join('  ·  ');
    if (byline) { y += 22; b.text(L, y, byline, { family: SANS, size: 11 }, { color: '#57534E' }); }
    if (meta.standfirst) y = b.para(L, y + 26, meta.standfirst, { family: SANS, size: 13, style: 'italic' }, inner, { color: '#57534E', lineHeight: 20 }) - 4;
    y += 28;
    const font = { family: SANS, size: 14 };
    // a report or an information sheet carries a figure: the picture with a
    // numbered caption, set beside the text the way a handout prints one
    const paras = m.content.paragraphs || [];
    const figureAt = photo.isSubject(chrome.photoSubject) && paras.length >= 3 ? 1 : -1;
    paras.forEach((p, i) => {
      y = b.para(L, y, p, font, inner, { color: '#1C1917', role: 'body', lineHeight: 22 }) + 16;
      if (i === figureAt) {
        const fw = Math.min(inner, 460), fh = Math.round(fw * 0.5);
        const fx = L + (inner - fw) / 2;
        b.rect(fx - 8, y - 2, fw + 16, fh + 46, { fill: '#F5F3EE', radius: 4 });
        b.photo(fx, y + 6, fw, fh, { subject: chrome.photoSubject, seed: photo.hashOf(m.content.title || 'fig'), colour: true, print: true, picRole: 'lead' });
        b.text(fx, y + fh + 26, 'Fig. 1  ' + clipText(chrome.photoCaption || '', 70), { family: SANS, size: 10.5, weight: 600 }, { color: '#57534E' });
        if (chrome.captionCredit) b.text(fx + fw, y + fh + 26, chrome.captionCredit, { family: SANS, size: 9.5, style: 'italic' }, { color: '#A8A29E', align: 'right' });
        y += fh + 58;
      }
    });
    y += 8;
    // what else the sheet carries: a box of facts, a note, a figure table
    const S = moduleStyle({ accent, ui: SANS, title: SANS, body: SANS });
    const sheetMods = modulesFor(chrome, 'print', 'column').concat(modulesFor(chrome, 'print', 'below'));
    if (sheetMods.length) y = placeModules(b, sheetMods, L, y + 6, inner, S, { max: 2 }) + 6;
    b.line(L, y, R, y, { color: '#D6D3D1' });
    b.text(L, y + 22, String(chrome.footerNote || ''), { family: SANS, size: 10 }, { color: '#78716C' });
    if (chrome.pageLabel) {
      const f = { family: SANS, size: 10, weight: 700 };
      const w = approxMeasure(chrome.pageLabel, f) + 20;
      b.pill(R - w, y + 8, w, 20, chrome.pageLabel, f, { fill: '#EDEAE3', color: '#78716C' });
    }
    const model = paperFinish(b, W, y + 52 + P, d);
    // a staple in the top corner, as a handout from the copier has
    model.blocks.push({ type: 'line', x1: P + 20, y1: P + 34, x2: P + 46, y2: P + 20, color: '#A8A29E', width: 3 });
    model.blocks.push({ type: 'line', x1: P + 22, y1: P + 37, x2: P + 48, y2: P + 23, color: '#E7E2D6', width: 1.4 });
    return model;
  }

  /** Put the page on a surface: paper colour, shadow, a slight tilt and a vignette. */
  /*
   * The paper the page is printed on. White by default — a worksheet is
   * white, and a page photographed on a table looks grey and dull on it. The
   * teacher can choose another paper, or the photographed page as before.
   */
  const PAPERS = { white: '#FFFFFF', ivory: '#FBF8F1', newsprint: '#F2EFE7', grey: '#ECECEA' };
  function paperLook(settings, d) {
    const s = settings || {};
    const key = s.paperColor || 'white';
    const design = (d && d.print && d.print.paper) || '#F7F4EC';
    if (key === 'photo') return { key, fill: design, surface: '#DED8CC', rotate: -0.5, vignette: true, grain: true, shadow: true };
    let fill = PAPERS[key];
    if (key === 'custom') fill = /^#[0-9a-f]{6}$/i.test(String(s.paperColorCustom || '')) ? String(s.paperColorCustom).toUpperCase() : '#FFFFFF';
    return { key: fill ? key : 'white', fill: fill || '#FFFFFF', surface: '#FFFFFF', rotate: 0, vignette: false, grain: key === 'newsprint', shadow: false, border: '#D6D6D3' };
  }

  function paperFinish(b, W, height, d, pages) {
    const h = Math.ceil(height);
    const look = d.look || paperLook({}, d);
    const sheets = pages && pages.length ? pages : [{ x: PAGE_PAD, y: PAGE_PAD, w: W - 2 * PAGE_PAD, h: h - 2 * PAGE_PAD }];
    const rects = sheets.map(p => Object.assign({ type: 'rect', x: p.x, y: p.y, w: p.w, h: p.h, fill: look.fill, shadow: !!look.shadow, page: true }, look.border ? { stroke: look.border } : {}));
    const model = { width: W, height: h, blocks: rects.concat(b.blocks.map(x => (x.type === 'rect' && x.h > h ? Object.assign({}, x, { h }) : x))) };
    const last = sheets[sheets.length - 1];
    model.pages = sheets.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h }));
    model.finish = { surface: look.surface, rotate: look.rotate, vignette: look.vignette, grain: look.grain, paper: look.key, fill: look.fill, page: { x: last.x, y: last.y, w: last.w, h: last.h } };
    return model;
  }

  function finish(b, width, height) {
    const h = Math.ceil(height);
    // background blocks were drawn tall on purpose; clip them to the real height
    const blocks = b.blocks.map(x => (x.type === 'rect' && x.h > h ? Object.assign({}, x, { h }) : x));
    return { width, height: h, blocks };
  }

  /* ------------------------------------------------------------------ */
  /* The same model as a document: SVG with real text                    */
  /* ------------------------------------------------------------------ */

  /*
   * The picture is drawn on a canvas for the PNG. For the worksheet, the
   * viewer and the HTML export the same model is written as SVG: every
   * word stays text (selectable, searchable, printed as vector), every
   * position is the one the canvas uses, and the fonts are the fonts of the
   * page. A picture inside it is given by `opts.photo(block)` as a data URL
   * (drawn on a canvas where there is one); without one it is an obvious
   * placeholder that says what the picture would show — never a blank box.
   */
  function xmlEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  const fmt = (n) => (Math.round(Number(n) * 100) / 100).toString();

  /** An icon's canvas path, recorded as SVG path data. */
  function iconPath(name) {
    const f = ICONS[name];
    if (!f) return '';
    const d = [];
    const rec = {
      moveTo: (x, y) => d.push(`M${fmt(x)} ${fmt(y)}`),
      lineTo: (x, y) => d.push(`L${fmt(x)} ${fmt(y)}`),
      closePath: () => d.push('Z'),
      quadraticCurveTo: (cx, cy, x, y) => d.push(`Q${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)}`),
      rect: (x, y, w, h) => d.push(`M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}Z`),
      arc: (cx, cy, r, a0, a1) => {
        const sx = cx + r * Math.cos(a0), sy = cy + r * Math.sin(a0);
        const full = Math.abs(a1 - a0) >= Math.PI * 2 - 1e-6;
        if (full) {
          d.push(`M${fmt(sx)} ${fmt(sy)}A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx - r * Math.cos(a0))} ${fmt(cy - r * Math.sin(a0))}A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(sx)} ${fmt(sy)}`);
        } else {
          const ex = cx + r * Math.cos(a1), ey = cy + r * Math.sin(a1);
          d.push(`L${fmt(sx)} ${fmt(sy)}A${fmt(r)} ${fmt(r)} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} 1 ${fmt(ex)} ${fmt(ey)}`);
        }
      },
    };
    f(rec);
    return d.join('');
  }

  function fontAttrs(f) {
    return `font-family="${xmlEsc(String(f.family || SANS).replace(/"/g, "'"))}" font-size="${fmt(f.size)}"`
      + (f.weight && f.weight !== 400 ? ` font-weight="${f.weight}"` : '') + (f.style && f.style !== 'normal' ? ` font-style="${f.style}"` : '');
  }

  /**
   * The pages of a printed medium as boxes in the picture: exactly the sheet
   * for a flat page, the sheet with the table around it for a photographed
   * one. A picture without pages is one box, the whole picture.
   */
  function pageBoxes(model) {
    const pages = (model && Array.isArray(model.pages) && model.pages.length) ? model.pages : null;
    if (!pages) return [{ x: 0, y: 0, w: model.width, h: model.height }];
    const photographed = model.finish && model.finish.rotate;
    const m = photographed ? PAGE_PAD * (model.scaledBy || 1) : 1;
    return pages.map(p => {
      const x = Math.max(0, p.x - m), y = Math.max(0, p.y - m);
      return { x, y, w: Math.min(model.width - x, p.w + 2 * m), h: Math.min(model.height - y, p.h + 2 * m) };
    });
  }
  /** On which page a block stands (by its top). */
  function blockPage(b, boxes) {
    const top = b.type === 'line' ? Math.min(b.y1, b.y2) : b.type === 'text' ? b.y - (b.font ? b.font.size * 0.8 : 0) : b.type === 'circle' ? b.y - b.r : b.y;
    for (let i = boxes.length - 1; i >= 0; i--) if (top >= boxes[i].y - PAGE_GAP / 2) return i;
    return 0;
  }

  function toSVG(model, opts) {
    const o = opts || {};
    // one page of a printed medium: the same drawing, cropped to that page
    const boxes = o.page != null ? pageBoxes(model) : null;
    const box = boxes ? boxes[Math.max(0, Math.min(boxes.length - 1, o.page))] : null;
    const onPage = box ? (b) => blockPage(b, boxes) === boxes.indexOf(box) : () => true;
    const W = model.width, H = model.height;
    const uid = 'lr' + (o.uid || photo.hashOf(String(model.blocks.length) + W + H));
    const defs = [];
    const out = [];
    let n = 0;
    const id = (p) => `${uid}-${p}${n++}`;
    const fin = model.finish;
    const photoOf = typeof o.photo === 'function' ? o.photo : () => null;

    defs.push(`<filter id="${uid}-soft" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#0F172A" flood-opacity=".12"/></filter>`);
    defs.push(`<filter id="${uid}-page" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="10" stdDeviation="13" flood-color="#000" flood-opacity=".35"/></filter>`);
    if (fin && fin.grain) defs.push(`<filter id="${uid}-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".06"/></feComponentTransfer></filter>`);
    if (fin && fin.vignette) defs.push(`<radialGradient id="${uid}-vig" cx="50%" cy="50%" r="72%"><stop offset="45%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".22"/></radialGradient>`);
    defs.push(`<pattern id="${uid}-ph" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#E2E8F0"/><rect width="7" height="14" fill="#D5DBE3"/></pattern>`);

    if (fin) {
      out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${xmlEsc(fin.surface || '#DED8CC')}"/>`);
      out.push(`<g transform="rotate(${fmt(fin.rotate || 0)} ${fmt(W / 2)} ${fmt(H / 2)})">`);
    } else {
      out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`);
      out.push('<g>');
    }

    for (const b of model.blocks) {
      if (!onPage(b)) continue;
      if (b.type === 'rect') {
        const filter = b.shadow === 'soft' ? ` filter="url(#${uid}-soft)"` : b.shadow ? ` filter="url(#${uid}-page)"` : '';
        const fill = b.fill === 'none' ? 'none' : (b.fill || '#FFFFFF');
        out.push(`<rect x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}"${b.radius ? ` rx="${fmt(Math.min(b.radius, b.w / 2, b.h / 2))}"` : ''} fill="${xmlEsc(fill)}"${b.stroke ? ` stroke="${xmlEsc(b.stroke)}" stroke-width="1"` : ''}${filter}/>`);
      } else if (b.type === 'line') {
        out.push(`<line x1="${fmt(b.x1)}" y1="${fmt(b.y1)}" x2="${fmt(b.x2)}" y2="${fmt(b.y2)}" stroke="${xmlEsc(b.color || '#E2E8F0')}" stroke-width="${fmt(b.width || 1)}"/>`);
      } else if (b.type === 'circle') {
        const fill = b.fill && b.fill !== 'none' ? b.fill : 'none';
        out.push(`<circle cx="${fmt(b.x)}" cy="${fmt(b.y)}" r="${fmt(b.r)}" fill="${xmlEsc(fill)}"${b.stroke ? ` stroke="${xmlEsc(b.stroke)}" stroke-width="${fmt(b.width || 1.5)}"` : ''}/>`);
      } else if (b.type === 'poly') {
        out.push(`<polygon points="${(b.points || []).map(p => fmt(p[0]) + ',' + fmt(p[1])).join(' ')}" fill="${xmlEsc(b.fill || '#FFFFFF')}"/>`);
      } else if (b.type === 'photo') {
        const src = photoOf(b);
        let clip = '';
        if (b.round) {
          const cid = id('clip');
          defs.push(`<clipPath id="${cid}"><ellipse cx="${fmt(b.x + b.w / 2)}" cy="${fmt(b.y + b.h / 2)}" rx="${fmt(b.w / 2)}" ry="${fmt(b.h / 2)}"/></clipPath>`);
          clip = ` clip-path="url(#${cid})"`;
        }
        if (src) {
          out.push(`<image x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}" preserveAspectRatio="none" href="${xmlEsc(src)}"${clip}/>`);
        } else {
          // no canvas here: an obvious placeholder that says what the picture shows
          const hint = (photo.SCENES[b.subject] || {}).hint || b.subject || '';
          out.push(`<rect x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}" fill="url(#${uid}-ph)"${clip}/>`);
          if (b.w >= 90 && b.h >= 40) {
            const fs = Math.max(9, Math.min(13, b.w / 24));
            out.push(`<text x="${fmt(b.x + b.w / 2)}" y="${fmt(b.y + b.h / 2 - 2)}" text-anchor="middle" font-family="${xmlEsc(SANS.replace(/"/g, "'"))}" font-size="${fmt(fs)}" font-weight="700" fill="#475569" letter-spacing="1">[PHOTO \u2014 ${xmlEsc(String(b.subject || '').toUpperCase())}]</text>`);
            out.push(`<text x="${fmt(b.x + b.w / 2)}" y="${fmt(b.y + b.h / 2 + fs + 2)}" text-anchor="middle" font-family="${xmlEsc(SANS.replace(/"/g, "'"))}" font-size="${fmt(fs * 0.85)}" fill="#64748B">${xmlEsc(clipText(hint, Math.floor(b.w / (fs * 0.5))))}</text>`);
          }
        }
        if (!b.round && b.frame !== false) out.push(`<rect x="${fmt(b.x + 0.5)}" y="${fmt(b.y + 0.5)}" width="${fmt(b.w - 1)}" height="${fmt(b.h - 1)}" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="1"/>`);
        // the place of the picture, for the hand that wants to replace it
        if (b.slot) out.push(`<rect class="photo-slot" data-slot="${xmlEsc(b.slot)}" data-subject="${xmlEsc(String(b.subject || ''))}"${b.picRole ? ` data-role="${xmlEsc(b.picRole)}"` : ''}${b.own ? ' data-own="1"' : ''}${b.round ? ' data-round="1"' : ''} x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}" fill="none" pointer-events="none"/>`);
      } else if (b.type === 'icon') {
        const d = iconPath(b.name);
        if (!d) continue;
        const stroke = b.stroke === false ? 'none' : (b.color || b.fill || '#334155');
        out.push(`<path d="${d}" transform="translate(${fmt(b.x)} ${fmt(b.y)}) scale(${fmt(b.size / 24)})" fill="${xmlEsc(b.fill || 'none')}" stroke="${xmlEsc(stroke)}" stroke-width="${fmt((b.weight || 1.8) * 24 / b.size)}" stroke-linejoin="round" stroke-linecap="round"/>`);
      } else if (b.type === 'wallpaper') {
        out.push(`<rect x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}" fill="${xmlEsc(b.fill || '#ECE5DD')}"/>`);
        const r = rng(b.seed || 3);
        const col = b.doodle || 'rgba(190,180,165,.55)';
        const parts = [];
        for (let y = b.y; y < b.y + b.h; y += 54) {
          for (let x = b.x; x < b.x + b.w; x += 54) {
            const pick = Math.floor(r() * 4);
            const cx = x + 10 + r() * 24, cy = y + 10 + r() * 24, sz = 7 + r() * 5;
            if (pick === 0) parts.push(`<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(sz * 0.6)}"/>`);
            else if (pick === 1) parts.push(`<path d="M${fmt(cx - sz / 2)} ${fmt(cy - sz / 2)}L${fmt(cx + sz / 2)} ${fmt(cy + sz / 2)}M${fmt(cx + sz / 2)} ${fmt(cy - sz / 2)}L${fmt(cx - sz / 2)} ${fmt(cy + sz / 2)}"/>`);
            else if (pick === 2) parts.push(`<rect x="${fmt(cx - sz / 2)}" y="${fmt(cy - sz / 2)}" width="${fmt(sz)}" height="${fmt(sz * 0.8)}"/>`);
            else parts.push(`<path d="M${fmt(cx)} ${fmt(cy + sz / 2)}Q${fmt(cx - sz)} ${fmt(cy - sz / 2)} ${fmt(cx)} ${fmt(cy - sz)}Q${fmt(cx + sz)} ${fmt(cy - sz / 2)} ${fmt(cx)} ${fmt(cy + sz / 2)}"/>`);
          }
        }
        const cid = id('wall');
        defs.push(`<clipPath id="${cid}"><rect x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}"/></clipPath>`);
        out.push(`<g clip-path="url(#${cid})" fill="none" stroke="${xmlEsc(col)}" stroke-width="1.4" opacity=".5">${parts.join('')}</g>`);
      } else if (b.type === 'gradient') {
        const gid = id('g');
        const vertical = b.vertical !== false;
        defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${(b.stops || []).map(([off, c]) => `<stop offset="${fmt(off * 100)}%" stop-color="${xmlEsc(c)}"/>`).join('')}</linearGradient>`);
        out.push(`<rect x="${fmt(b.x)}" y="${fmt(b.y)}" width="${fmt(b.w)}" height="${fmt(b.h)}"${b.radius ? ` rx="${fmt(b.radius)}"` : ''} fill="url(#${gid})"/>`);
      } else if (b.type === 'text') {
        if (!b.text) continue;
        const anchor = b.align === 'center' ? 'middle' : b.align === 'right' ? 'end' : 'start';
        out.push(`<text x="${fmt(b.x)}" y="${fmt(b.y)}" ${fontAttrs(b.font)} fill="${xmlEsc(b.color || INK)}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${b.letterSpacing ? ` letter-spacing="${fmt(b.letterSpacing)}"` : ''}${b.role === 'body' ? ' class="body"' + (b.glue ? ' data-glue="1"' : '') + (b.hyph ? ' data-hyph="1"' : '') : ''} xml:space="preserve">${xmlEsc(b.text)}</text>`);
      }
    }
    out.push('</g>');
    if (fin && fin.gutter) {
      const gid = id('gut');
      defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgb(60,50,35)" stop-opacity=".3"/><stop offset=".55" stop-color="rgb(60,50,35)" stop-opacity=".08"/><stop offset="1" stop-color="rgb(60,50,35)" stop-opacity="0"/></linearGradient>`);
      out.push(`<rect x="${fmt(fin.gutter.x)}" y="${fmt(fin.page ? fin.page.y : 0)}" width="${fmt(fin.gutter.w)}" height="${fmt(fin.page ? fin.page.h : H)}" fill="url(#${gid})"/>`);
    }
    if (fin && fin.grain) {
      // the grain of the paper lies on the paper, not on the table around a flat page
      const areas = fin.rotate || !Array.isArray(model.pages) ? [{ x: 0, y: 0, w: W, h: H }] : model.pages;
      for (const a of areas) out.push(`<rect x="${fmt(a.x)}" y="${fmt(a.y)}" width="${fmt(a.w)}" height="${fmt(a.h)}" filter="url(#${uid}-grain)" fill="#888"/>`);
    }
    if (fin && fin.vignette) out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#${uid}-vig)"/>`);
    const vb = box || { x: 0, y: 0, w: W, h: H };
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(vb.x)} ${fmt(vb.y)} ${fmt(vb.w)} ${fmt(vb.h)}" width="${fmt(vb.w)}" height="${fmt(vb.h)}" class="lr-medium"${box ? ` data-page="${boxes.indexOf(box) + 1}" data-pages="${boxes.length}"` : ''} role="img" aria-label="${xmlEsc((o.label || model.label || 'The text as it appears in its medium') + (box && boxes.length > 1 ? ` \u2014 page ${boxes.indexOf(box) + 1} of ${boxes.length}` : ''))}"><defs>${defs.join('')}</defs>${out.join('')}</svg>`;
  }

  /* ------------------------------------------------------------------ */
  /* Public                                                               */
  /* ------------------------------------------------------------------ */

  /*
   * How large a picture may become. Browsers refuse a canvas whose side is
   * over 16384 px or whose area is very large, and they do it silently: the
   * picture would simply stay empty. A very long text (many short chat
   * messages, a thread with a hundred posts) reaches that size, so the model
   * is scaled down to fit instead of failing.
   */
  const MAX_SIDE = 15800;
  const MAX_AREA = 2.4e8;

  /** Scale every coordinate of the model, so it keeps its proportions. */
  function scaleModel(model, k) {
    const num = (v) => (typeof v === 'number' ? v * k : v);
    model.blocks = (model.blocks || []).map(b => {
      const o = Object.assign({}, b);
      for (const key of ['x', 'y', 'w', 'h', 'r', 'x1', 'y1', 'x2', 'y2', 'size', 'width', 'letterSpacing', 'lineHeight']) {
        if (typeof o[key] === 'number') o[key] = num(o[key]);
      }
      if (o.radius) o.radius = num(o.radius);
      if (o.font) o.font = Object.assign({}, o.font, { size: o.font.size * k });
      if (Array.isArray(o.points)) o.points = o.points.map(([px, py]) => [px * k, py * k]);
      return o;
    });
    if (model.finish) {
      model.finish = Object.assign({}, model.finish);
      if (model.finish.page) {
        const p = model.finish.page;
        model.finish.page = { x: p.x * k, y: p.y * k, w: p.w * k, h: p.h * k };
      }
      if (model.finish.gutter) model.finish.gutter = { x: model.finish.gutter.x * k, w: model.finish.gutter.w * k };
    }
    if (Array.isArray(model.pages)) model.pages = model.pages.map(p => ({ x: p.x * k, y: p.y * k, w: p.w * k, h: p.h * k }));
    model.width = Math.round(model.width * k);
    model.height = Math.round(model.height * k);
    model.scaledBy = Math.round(k * 1000) / 1000;
    return model;
  }

  /** Bring a picture into a size that can really be drawn. */
  function fitModel(model) {
    const w = model.width, h = model.height;
    const k = Math.min(1, MAX_SIDE / w, MAX_SIDE / h, Math.sqrt(MAX_AREA / (w * h)));
    return k < 1 ? scaleModel(model, k) : model;
  }

  /**
   * How finely the picture may be drawn onto a canvas: the wish (the device
   * pixel ratio) capped so that the canvas itself stays within what browsers
   * accept. Never smaller than 1, because the model already fits.
   */
  function canvasScale(model, wish) {
    const w = Math.max(1, model.width), h = Math.max(1, model.height);
    const k = Math.min(wish || 1, 16384 / w, 16384 / h, Math.sqrt(2.6e8 / (w * h)));
    return Math.max(0.5, Math.min(wish || 1, k));
  }

  /** The drawing model of the screenshot; `opts.measure` defaults to the metric estimate. */
  /**
   * The teacher's own picture for one place, if there is a usable one: an
   * uploaded file ("/_blob/<id>") or, where uploads cannot be stored, the
   * downscaled image itself. Anything else is ignored — a stored source is
   * outside data and is never drawn blindly.
   */
  function ownPicture(images, slot) {
    const e = images && typeof images === 'object' && !Array.isArray(images) ? images[slot] : null;
    if (!e || typeof e !== 'object') return null;
    const src = e.asset && /^[A-Za-z0-9_-]{8,64}$/.test(String(e.asset)) ? '/_blob/' + e.asset : e.src;
    if (!photo.isOwnSource(src)) return null;
    const credit = String(e.credit == null ? '' : e.credit).replace(/\s+/g, ' ').trim().slice(0, 120);
    const focus = Array.isArray(e.focus) && e.focus.length === 2 ? e.focus.map(v => Math.max(0, Math.min(1, Number(v) || 0.5))) : null;
    // a photo found on the web carries its own caption: what its source says it
    // shows, never Claude's words about the story (which it does not show)
    const caption = String(e.caption == null ? '' : e.caption).replace(/\s+/g, ' ').trim().slice(0, 120);
    return { src, credit, focus, caption, name: String(e.name || '').slice(0, 80) };
  }

  /*
   * The last step of every picture: no interface text runs into another text
   * or over the edge of its page or box. Claude writes the interface (a
   * dateline, a credit, a navigation entry) and cannot know how wide the
   * space for it is; a long entry would run into its neighbour. So every
   * single line of the interface is fitted here: where two collide on one
   * line, the less important one is shortened with "…" (a fragment too
   * short to read is left out), and none crosses its page or the box it
   * starts in. The text of the material and a verbatim quote are never
   * touched — only the interface around them.
   */
  const FIT_GAP = 10;
  function fitChromeText(model, measure) {
    const blocks = model.blocks || [];
    const widthOf = (b) => measure(b.text, b.font) + (b.letterSpacing || 0) * b.text.length;
    const boxOf = (b) => {
      const w = widthOf(b);
      const x0 = b.align === 'center' ? b.x - w / 2 : b.align === 'right' ? b.x - w : b.x;
      return { x0, x1: x0 + w, y0: b.y - b.font.size * 0.72, y1: b.y + b.font.size * 0.2 };
    };
    // a decorative glyph (a large quote mark) fills little of its box: it neither moves nor blocks
    const texts = blocks.filter(b => b.type === 'text' && !b.deco && b.text && String(b.text).trim() && b.font && b.font.size);
    const movable = (b) => b.role !== 'body' && b.role !== 'quote';
    const pages = Array.isArray(model.pages) && model.pages.length ? model.pages : [{ x: 0, y: 0, w: model.width, h: model.height }];
    const pageOf = (y) => pages.find(p => y >= p.y - 30 && y <= p.y + p.h + 30) || pages[0];
    // the boxes a text may start in: cards, pills, bars — not the page itself
    // (a meter — the filled part of a poll bar — shows an amount, it holds no text)
    const rects = blocks.filter(b => b.type === 'rect' && !b.page && !b.meter && b.w > 24 && b.h > 10 && b.w < model.width * 0.98 && b.fill !== 'none');
    /** Shorten a text to at most `max` px, with an ellipsis; '' when nothing sensible is left. */
    const clipTo = (b, max) => {
      if (widthOf(b) <= max) return;
      const full = String(b.text);
      let lo = 0, hi = full.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const t = full.slice(0, mid).replace(/[\s\u00B7,;:\u2013\u2014-]+$/, '') + '\u2026';
        if (measure(t, b.font) + (b.letterSpacing || 0) * t.length <= max) lo = mid; else hi = mid - 1;
      }
      const kept = full.slice(0, lo).replace(/[\s\u00B7,;:\u2013\u2014-]+$/, '');
      if (b.full == null) b.full = full;
      b.text = kept.length >= 3 ? kept + '\u2026' : '';
      b.fitted = true;
    };
    /** Fit a text into [left, right] horizontally, keeping its anchor side. */
    const fitInto = (b, left, right) => {
      const room = right - left;
      if (room < 24) { b.text = ''; b.fitted = true; return; }
      if (b.align === 'right') { if (b.x > right) b.x = right; clipTo(b, b.x - left); }
      else if (b.align === 'center') { const half = Math.min(b.x - left, right - b.x); clipTo(b, Math.max(0, half * 2)); }
      else { if (b.x < left) b.x = left; clipTo(b, right - b.x); }
    };
    // 1. inside its page and inside the box it starts in
    for (const b of texts) {
      if (!movable(b)) continue;
      const pg = pageOf(b.y);
      let left = pg.x + 2, right = pg.x + pg.w - 2;
      const bx = boxOf(b);
      const ax = b.align === 'right' ? bx.x1 - 1 : b.align === 'center' ? b.x : bx.x0 + 1;
      const home = rects.filter(r => ax >= r.x && ax <= r.x + r.w && b.y - b.font.size * 0.4 >= r.y && b.y <= r.y + r.h)
        .sort((r1, r2) => r1.w * r1.h - r2.w * r2.h)[0];
      if (home) { left = Math.max(left, home.x + 2); right = Math.min(right, home.x + home.w - 2); }
      if (bx.x0 < left - 0.5 || bx.x1 > right + 0.5) fitInto(b, left, right);
    }
    // 2. no two texts on one line run into each other
    const rank = (b) => (b.align === 'center' ? 0 : 1) + (b.font.weight >= 700 ? 1 : 0) + (b.font.size >= 16 ? 2 : 0);
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      const live = texts.filter(b => b.text && String(b.text).trim()).map(b => ({ b, box: boxOf(b) })).sort((p, q) => p.box.y0 - q.box.y0);
      for (let i = 0; i < live.length; i++) {
        const A = live[i];
        for (let j = i + 1; j < live.length && live[j].box.y0 < A.box.y1; j++) {
          const B = live[j];
          if (!A.b.text || !B.b.text) continue;
          const ox = Math.min(A.box.x1, B.box.x1) - Math.max(A.box.x0, B.box.x0);
          const oy = Math.min(A.box.y1, B.box.y1) - Math.max(A.box.y0, B.box.y0);
          // touching descenders and capitals of stacked lines are not a collision
          const hA = A.box.y1 - A.box.y0, hB = B.box.y1 - B.box.y0;
          if (ox <= 2 || oy <= Math.max(2, 0.25 * Math.min(hA, hB))) continue;
          if (A.b.glue || B.b.glue) continue;
          // which one gives way: never the text, never a quote, never a line of a
          // wrapped paragraph (it would lose words); else the less important one
          let give, keep;
          const firm = (b) => !movable(b) || b.wrapped;
          if (firm(A.b) && firm(B.b)) { if (!movable(A.b) && !movable(B.b)) continue; if (!movable(A.b)) { give = B; keep = A; } else if (!movable(B.b)) { give = A; keep = B; } else { give = rank(A.b) <= rank(B.b) ? A : B; keep = give === A ? B : A; } }
          else if (firm(A.b)) { give = B; keep = A; }
          else if (firm(B.b)) { give = A; keep = B; }
          else if (rank(A.b) !== rank(B.b)) { give = rank(A.b) < rank(B.b) ? A : B; keep = give === A ? B : A; }
          else { give = widthOf(A.b) >= widthOf(B.b) ? A : B; keep = give === A ? B : A; }
          const g = give.b, k = keep.box;
          const gb = boxOf(g);
          const pg = pageOf(g.y);
          // the side of the kept text the other one stands on
          if ((gb.x0 + gb.x1) / 2 <= (k.x0 + k.x1) / 2) fitInto(g, Math.max(pg.x + 2, g.align === 'right' ? pg.x + 2 : gb.x0), k.x0 - FIT_GAP);
          else fitInto(g, k.x1 + FIT_GAP, Math.min(pg.x + pg.w - 2, g.align === 'left' || !g.align ? pg.x + pg.w - 2 : gb.x1));
          give.box = boxOf(g);
          changed = true;
        }
      }
      if (!changed) break;
    }
    model.blocks = blocks.filter(b => !(b.type === 'text' && b.fitted && !String(b.text).trim()));
    return model;
  }

  function buildModel(material, chrome, opts) {
    opts = opts || {};
    const measure = opts.measure || approxMeasure;
    const d = layoutFor(material);
    if (d.kind === 'print') d.look = paperLook(material.settings, d);
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
    fitChromeText(model, measure);
    return fitModel(model);
  }

  /**
   * The photographs a picture uses, once each, with author, source and
   * licence — what the teacher version lists as picture credits.
   */
  function credits(model) {
    const out = [];
    const seen = new Set();
    for (const x of (model && model.blocks) || []) {
      if (x.type !== 'photo') continue;
      if (x.own) {
        if (seen.has('own:' + x.slot)) continue;
        seen.add('own:' + x.slot);
        out.push({ id: x.slot, subject: x.subject, credit: x.credit || 'Eigenes Bild der Lehrperson', author: '', source: '', license: '', url: '', own: true });
        continue;
      }
      if (!x.photoId || seen.has(x.photoId)) continue;
      seen.add(x.photoId);
      const e = photo.byId(x.photoId);
      if (e) out.push({ id: e.id, subject: e.subject, credit: e.credit, author: e.author, source: e.source, license: e.license, url: e.url });
    }
    return out;
  }

  /** Everything the picture shows of the generated text itself. */
  function bodyText(model) {
    return joinBody((model.blocks || []).filter(x => x.type === 'text' && x.role === 'body'));
  }
  /**
   * The words of the text from the pieces it is set in: a piece glued to the
   * next one (a drop cap, a compound divided at its hyphen) takes no space,
   * a piece that ends in a soft hyphen loses the hyphen.
   */
  function joinBody(parts) {
    let out = '';
    parts.forEach((x, i) => {
      const prev = i ? parts[i - 1] : null;
      if (prev && prev.hyph) out = out.replace(/-$/, '');
      out += (!prev ? '' : (prev.glue || prev.hyph ? '' : ' ')) + x.text;
    });
    return out;
  }
  /** The same, read back from the SVG the sheet shows. */
  function svgBodyText(svg) {
    const parts = [];
    const unesc = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    for (const mt of String(svg || '').matchAll(/<text ([^>]*class="body"[^>]*)>([^<]*)<\/text>/g)) {
      parts.push({ text: unesc(mt[2]), glue: /data-glue="1"/.test(mt[1]), hyph: /data-hyph="1"/.test(mt[1]) });
    }
    return joinBody(parts);
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
    if (model.height > MAX_SIDE + 2 || model.width > MAX_SIDE + 2) problems.push('image too large: ' + model.width + '×' + model.height);
    for (const x of model.blocks) {
      if (x.type === 'text') {
        if (typeof x.text !== 'string') problems.push('text block without text');
        if (!x.font || !x.font.size || !x.font.family) problems.push('text block without font');
        if (x.y > model.height + 2 || x.y < 0) problems.push('text outside the picture at y=' + Math.round(x.y));
      } else if (x.type === 'rect' || x.type === 'photo' || x.type === 'wallpaper' || x.type === 'gradient') {
        if (!(x.w > 0) || !(x.h > 0)) problems.push('block without size');
        if (x.type === 'photo' && !photo.isSubject(x.subject)) problems.push('picture without a subject that can be drawn: ' + x.subject);
        if (x.type === 'photo' && x.own && !photo.isOwnSource(x.own)) problems.push('a picture of the teacher from a source that is not allowed');
      } else if (x.type === 'icon') {
        if (!ICONS[x.name]) problems.push('unknown icon: ' + x.name);
        if (!(x.size > 0)) problems.push('icon without size: ' + x.name);
      } else if (x.type === 'poly') {
        if (!Array.isArray(x.points) || x.points.length < 3) problems.push('polygon with too few points');
      }
    }
    return [...new Set(problems)];
  }

  /* ------------------------------------------------------------------ */
  /* Proportions: is the page visually in balance?                        */
  /* ------------------------------------------------------------------ */

  /** The lowest point a drawing block reaches. */
  function blockBottom(b) {
    if (b.type === 'text') return b.y;
    if (b.type === 'line') return Math.max(b.y1, b.y2);
    if (b.type === 'circle') return b.y + b.r;
    if (b.type === 'poly') return Math.max.apply(null, b.points.map(p => p[1]));
    return (b.y || 0) + (b.h || 0);
  }

  /** Where a drawing block starts horizontally. */
  function blockLeft(b) {
    if (b.type === 'line') return Math.min(b.x1, b.x2);
    if (b.type === 'circle') return b.x - b.r;
    if (b.type === 'poly') return Math.min.apply(null, b.points.map(p => p[0]));
    return b.x || 0;
  }

  /**
   * How the finished picture is proportioned — the check the eye would make:
   * does every column carry its share, and does the page end shortly after the
   * text? `columns` is what each column really holds, `balance` is the thinnest
   * column against the fullest (1 = even), `tail` the empty strip under the
   * last thing on the page as a share of its height.
   */
  function proportions(model) {
    const blocks = (model && model.blocks) || [];
    const page = (model && model.finish && model.finish.page) || { x: 0, y: 0, w: (model && model.width) || 0, h: (model && model.height) || 0 };
    const cols = (model && model.columns) || [];
    const columns = cols.map((c, i) => {
      const inside = blocks.filter(b => {
        const x = blockLeft(b);
        if (!(x >= c.x - 6 && x < c.x + c.w + 12)) return false;
        const bot = blockBottom(b);
        return bot >= c.top - 4 && bot <= c.bottom + 60;
      });
      const bottom = inside.length ? Math.max.apply(null, inside.map(blockBottom)) : c.top;
      const height = Math.max(1, c.bottom - c.top);
      return { index: i, lines: inside.filter(b => b.type === 'text' && b.role === 'body').length,
        top: Math.round(c.top), bottom: Math.round(bottom), height: Math.round(height),
        filled: Math.max(0, Math.min(1, (bottom - c.top) / height)) };
    });
    const fills = columns.map(c => c.filled);
    const fullest = fills.length ? Math.max.apply(null, fills) : 1;
    const balance = fills.length ? (fullest > 0 ? Math.min.apply(null, fills) / fullest : 1) : 1;
    const lowest = blocks.length ? Math.max.apply(null, blocks.filter(b => b.type !== 'wallpaper' && !(b.type === 'rect' && b.shadow)).map(blockBottom)) : 0;
    const tail = page.h > 0 ? Math.max(0, (page.y + page.h - lowest) / page.h) : 0;
    return { columns, balance, tail, lowest: Math.round(lowest), pages: (model && Array.isArray(model.pages) && model.pages.length) || 1, page: { width: model ? model.width : 0, height: model ? model.height : 0 } };
  }

  /* ------------------------------------------------------------------ */
  /* Drawing (browser)                                                    */
  /* ------------------------------------------------------------------ */

  function fontString(f) {
    return `${f.style || 'normal'} ${f.weight || 400} ${f.size}px ${f.family}`;
  }

  /*
   * A small vector icon set, drawn in a 24×24 box and scaled. Real interfaces
   * are full of these; without them a picture never looks like the thing it
   * is imitating.
   */
  const ICONS = {
    back: (c) => { c.moveTo(15, 5); c.lineTo(8, 12); c.lineTo(15, 19); },
    chevron: (c) => { c.moveTo(9, 5); c.lineTo(16, 12); c.lineTo(9, 19); },
    phone: (c) => { c.moveTo(6, 4); c.quadraticCurveTo(4, 4, 4, 7); c.quadraticCurveTo(4, 17, 14, 20); c.quadraticCurveTo(18, 21, 19, 17); c.lineTo(15, 15); c.lineTo(13, 17); c.quadraticCurveTo(8, 14, 7, 10); c.lineTo(9, 8); c.closePath(); },
    video: (c) => { c.rect(3, 7, 12, 10); c.moveTo(16, 11); c.lineTo(21, 8); c.lineTo(21, 16); c.lineTo(16, 13); c.closePath(); },
    dots: (c) => { [6, 12, 18].forEach(y => { c.moveTo(14, y); c.arc(12, y, 1.6, 0, Math.PI * 2); }); },
    search: (c) => { c.arc(11, 11, 6, 0, Math.PI * 2); c.moveTo(15.5, 15.5); c.lineTo(20, 20); },
    menu: (c) => { [7, 12, 17].forEach(y => { c.moveTo(4, y); c.lineTo(20, y); }); },
    heart: (c) => { c.moveTo(12, 20); c.quadraticCurveTo(3, 13, 3, 8.5); c.quadraticCurveTo(3, 4, 7.5, 4); c.quadraticCurveTo(12, 4, 12, 8); c.quadraticCurveTo(12, 4, 16.5, 4); c.quadraticCurveTo(21, 4, 21, 8.5); c.quadraticCurveTo(21, 13, 12, 20); },
    comment: (c) => { c.moveTo(4, 5); c.lineTo(20, 5); c.lineTo(20, 16); c.lineTo(11, 16); c.lineTo(7, 20); c.lineTo(7, 16); c.lineTo(4, 16); c.closePath(); },
    share: (c) => { c.arc(18, 6, 2.6, 0, Math.PI * 2); c.moveTo(8.6, 12); c.arc(6, 12, 2.6, 0, Math.PI * 2); c.moveTo(20.6, 18); c.arc(18, 18, 2.6, 0, Math.PI * 2); c.moveTo(8.4, 10.8); c.lineTo(15.6, 7.2); c.moveTo(8.4, 13.2); c.lineTo(15.6, 16.8); },
    bookmark: (c) => { c.moveTo(6, 4); c.lineTo(18, 4); c.lineTo(18, 20); c.lineTo(12, 15.5); c.lineTo(6, 20); c.closePath(); },
    mic: (c) => { c.moveTo(9, 6); c.quadraticCurveTo(9, 3, 12, 3); c.quadraticCurveTo(15, 3, 15, 6); c.lineTo(15, 11); c.quadraticCurveTo(15, 14, 12, 14); c.quadraticCurveTo(9, 14, 9, 11); c.closePath(); c.moveTo(6, 11); c.quadraticCurveTo(6, 18, 12, 18); c.quadraticCurveTo(18, 18, 18, 11); c.moveTo(12, 18); c.lineTo(12, 21); },
    clip: (c) => { c.moveTo(16, 7); c.lineTo(9, 14); c.quadraticCurveTo(7, 16, 9, 18); c.quadraticCurveTo(11, 20, 13, 18); c.lineTo(19, 12); c.quadraticCurveTo(22, 9, 19, 6); c.quadraticCurveTo(16, 3, 13, 6); c.lineTo(6, 13); },
    camera: (c) => { c.rect(3, 7, 18, 12); c.moveTo(9, 7); c.lineTo(10.5, 4.5); c.lineTo(13.5, 4.5); c.lineTo(15, 7); c.moveTo(15, 13); c.arc(12, 13, 3.4, 0, Math.PI * 2); },
    ticks: (c) => { c.moveTo(2, 12); c.lineTo(7, 17); c.lineTo(15, 7); c.moveTo(9, 12); c.lineTo(13, 16); c.lineTo(21, 6); },
    star: (c) => { for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.2 : 9.5, a = -Math.PI / 2 + i * Math.PI / 5; const x = 12 + r * Math.cos(a), y = 12 + r * Math.sin(a); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); },
    plus: (c) => { c.moveTo(12, 5); c.lineTo(12, 19); c.moveTo(5, 12); c.lineTo(19, 12); },
    up: (c) => { c.moveTo(4, 14); c.lineTo(12, 5); c.lineTo(20, 14); c.closePath(); },
    down: (c) => { c.moveTo(4, 10); c.lineTo(12, 19); c.lineTo(20, 10); c.closePath(); },
    reply: (c) => { c.moveTo(10, 6); c.lineTo(4, 11); c.lineTo(10, 16); c.moveTo(4, 11); c.lineTo(15, 11); c.quadraticCurveTo(20, 11, 20, 17); c.lineTo(20, 19); },
    inbox: (c) => { c.moveTo(4, 5); c.lineTo(20, 5); c.lineTo(20, 19); c.lineTo(4, 19); c.closePath(); c.moveTo(4, 13); c.lineTo(9, 13); c.lineTo(10.5, 15.5); c.lineTo(13.5, 15.5); c.lineTo(15, 13); c.lineTo(20, 13); },
    trash: (c) => { c.moveTo(5, 7); c.lineTo(19, 7); c.moveTo(7, 7); c.lineTo(8.5, 20); c.lineTo(15.5, 20); c.lineTo(17, 7); c.moveTo(9.5, 7); c.lineTo(9.5, 4.5); c.lineTo(14.5, 4.5); c.lineTo(14.5, 7); },
    lock: (c) => { c.rect(6, 11, 12, 9); c.moveTo(9, 11); c.lineTo(9, 8); c.quadraticCurveTo(9, 4.5, 12, 4.5); c.quadraticCurveTo(15, 4.5, 15, 8); c.lineTo(15, 11); },
  };

  /** Deterministic pseudo random, so the same picture is drawn every time. */
  function rng(seed) {
    let x = (seed || 1) * 1103515245 + 12345;
    return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; };
  }

  /** The colour a picture is held in — press photos are never all the same. */
  const TINTS = {
    cool: ['#9DB7CE', '#C3C7BE', '#8A8F84'],
    warm: ['#E3C39A', '#C9A98C', '#8C7663'],
    dusk: ['#8E87B5', '#C49AA6', '#6B6076'],
    green: ['#A9C0A2', '#C6CBAA', '#6F7C62'],
  };

  /**
   * A photograph. The picture itself is drawn by the picture engine
   * (`photo.js`) from its subject — a portrait, a street, a classroom — so a
   * screenshot shows what a screenshot shows: a picture, not a grey box.
   */
  function drawPhoto(ctx, b) {
    photo.draw(ctx, Object.assign({}, b, {
      subject: photo.isSubject(b.subject) ? b.subject : photo.subjectFor('', 'city'),
      halftone: b.halftone !== false && b.print === true,
    }));
  }

  /** One icon, filled or stroked, in the given box. */
  function drawIcon(ctx, b) {
    const f = ICONS[b.name];
    if (!f) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(b.size / 24, b.size / 24);
    ctx.beginPath();
    f(ctx);
    if (b.fill) { ctx.fillStyle = b.fill; ctx.fill(); }
    if (b.stroke !== false) {
      ctx.strokeStyle = b.color || b.fill || '#334155';
      ctx.lineWidth = (b.weight || 1.8) * 24 / b.size * (b.size / 24);
      ctx.lineWidth = b.weight || 1.8;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Messenger wallpaper: a warm tint with faint doodles, as the apps have. */
  function drawWallpaper(ctx, b) {
    ctx.save();
    ctx.beginPath(); ctx.rect(b.x, b.y, b.w, b.h); ctx.clip();
    ctx.fillStyle = b.fill || '#ECE5DD';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const r = rng(b.seed || 3);
    ctx.globalAlpha = 0.5;
    for (let y = b.y; y < b.y + b.h; y += 54) {
      for (let x = b.x; x < b.x + b.w; x += 54) {
        const pick = Math.floor(r() * 4);
        const cx = x + 10 + r() * 24, cy = y + 10 + r() * 24, sz = 7 + r() * 5;
        ctx.strokeStyle = b.doodle || 'rgba(190,180,165,.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        if (pick === 0) ctx.arc(cx, cy, sz * 0.6, 0, Math.PI * 2);
        else if (pick === 1) { ctx.moveTo(cx - sz / 2, cy - sz / 2); ctx.lineTo(cx + sz / 2, cy + sz / 2); ctx.moveTo(cx + sz / 2, cy - sz / 2); ctx.lineTo(cx - sz / 2, cy + sz / 2); }
        else if (pick === 2) { ctx.rect(cx - sz / 2, cy - sz / 2, sz, sz * 0.8); }
        else { ctx.moveTo(cx, cy + sz / 2); ctx.quadraticCurveTo(cx - sz, cy - sz / 2, cx, cy - sz); ctx.quadraticCurveTo(cx + sz, cy - sz / 2, cx, cy + sz / 2); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** A colour band, e.g. an app header or a hero area. */
  function drawGradient(ctx, b) {
    const g = ctx.createLinearGradient(b.x, b.y, b.vertical === false ? b.x + b.w : b.x, b.vertical === false ? b.y : b.y + b.h);
    (b.stops || []).forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.beginPath();
    roundRect(ctx, b.x, b.y, b.w, b.h, b.radius || 0);
    ctx.fill();
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
        if (b.shadow === 'soft') { ctx.shadowColor = 'rgba(15,23,42,.12)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; }
        else if (b.shadow) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10; }
        // "none" is a frame without a filling — drawn over a picture, a fill
        // would paint the picture out with whatever colour came last
        if (b.fill !== 'none') { ctx.fillStyle = b.fill || '#FFFFFF'; ctx.fill(); }
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        if (b.stroke) { ctx.strokeStyle = b.stroke; ctx.lineWidth = 1; ctx.stroke(); }
      } else if (b.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2);
        ctx.strokeStyle = b.color; ctx.lineWidth = b.width || 1; ctx.stroke();
      } else if (b.type === 'circle') {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        if (b.fill && b.fill !== 'none') { ctx.fillStyle = b.fill; ctx.fill(); }
        if (b.stroke) { ctx.strokeStyle = b.stroke; ctx.lineWidth = b.width || 1.5; ctx.stroke(); }
      } else if (b.type === 'poly') {
        ctx.beginPath();
        (b.points || []).forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.closePath();
        ctx.fillStyle = b.fill || '#FFFFFF'; ctx.fill();
      } else if (b.type === 'photo') {
        drawPhoto(ctx, b);
      } else if (b.type === 'icon') {
        drawIcon(ctx, b);
      } else if (b.type === 'wallpaper') {
        drawWallpaper(ctx, b);
      } else if (b.type === 'gradient') {
        drawGradient(ctx, b);
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
      const areas = fin.rotate || !Array.isArray(model.pages) ? [{ x: 0, y: 0, w: W, h: H }] : model.pages;
      for (const a of areas) {
        for (let i = 0; i < Math.round(a.w * a.h / 900); i++) {
          ctx.fillStyle = r() > 0.5 ? '#000000' : '#FFFFFF';
          ctx.fillRect(a.x + r() * a.w, a.y + r() * a.h, 1.2, 1.2);
        }
      }
      ctx.restore();
    }
    if (fin.gutter) {
      const g = ctx.createLinearGradient(fin.gutter.x, 0, fin.gutter.x + fin.gutter.w, 0);
      g.addColorStop(0, 'rgba(60,50,35,.30)');
      g.addColorStop(0.55, 'rgba(60,50,35,.08)');
      g.addColorStop(1, 'rgba(60,50,35,0)');
      ctx.fillStyle = g;
      ctx.fillRect(fin.gutter.x, fin.page ? fin.page.y : 0, fin.gutter.w, fin.page ? fin.page.h : H);
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

  return { LAYOUTS, CHROME_SPECS, ICONS, MAX_SIDE, PAPERS, A4_RATIO, paperLook, shade, hyphenPoints, wrapJustified, joinBody, svgBodyText, pageBoxes, fitChromeText,
    credits, ownPicture, composition, verbatim, SUBJECTS: photo.SUBJECTS, isSubject: photo.isSubject, subjectFor: photo.subjectFor, subjectHints: photo.subjectHints, hashOf: photo.hashOf, layoutFor, chromeSpec, fallbackChrome, buildModel, fitModel, canvasScale, drawPhoto, drawIcon, bodyText, chromeText, validate, proportions, draw, toSVG, iconPath,
    MODULES, MODULE_KEYS, SHAPES, SHAPE_KEYS, MEDIUM_SLOTS, shapeOf, moduleRenderer, moduleHints, modulesFor, placeModules, moduleStyle, canvasMeasure, approxMeasure, wrap, fontString };
});
