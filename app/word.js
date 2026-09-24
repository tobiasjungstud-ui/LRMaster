/*
 * LRMaster word — Word (.docx) export with a document design per text type.
 * A magazine article is laid out as a magazine article, an email as an email,
 * a forum thread as a thread, a diary entry on ruled paper. All wording comes
 * from the material (Claude); this module only decides the typography.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./quality.js'), require('./render.js'), require('./docx.js'));
  else { root.LR = root.LR || {}; root.LR.word = factory(root.LR.core, root.LR.quality, root.LR.render, root.LR.docx); }
})(typeof self !== 'undefined' ? self : this, function (core, quality, render, docx) {
  'use strict';

  const T = docx.run, P = docx.para, F = docx.field, TBL = docx.table, SP = docx.spacer;
  const GREY = '6B7280', SOFT = 'A6ADB6', LINE = 'D4D9DF', INK = '1A1D21', MARK = 'FDE68A';
  const PAGE_W = docx.A4.w;

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                        */
  /* ------------------------------------------------------------------ */

  function usableWidth(margins) { return PAGE_W - docx.cm(margins.left) - docx.cm(margins.right); }
  /** Split a width into columns by fraction; the last column absorbs the rest. */
  function cols(W, fractions) {
    const out = fractions.map(f => Math.round(W * f));
    out[out.length - 1] = W - out.slice(0, -1).reduce((a, b) => a + b, 0);
    return out;
  }
  function hairline(color, sz) { return { style: 'single', sz: sz || 4, space: 2, color: color || LINE }; }
  function ruleP(props) {
    const p = props || {};
    return P('', { border: { bottom: hairline(p.color, p.sz) }, after: p.after === undefined ? 8 : p.after, before: p.before || 0, mark: { size: 2 } });
  }
  function box(blocks, o) {
    o = o || {};
    return TBL({
      width: o.W, widthType: 'dxa', cols: [o.W],
      cellMargin: { top: o.pad || 0.25, left: o.pad || 0.3, bottom: o.pad || 0.25, right: o.pad || 0.3 },
      rows: [{ cells: [{ shd: o.shd, borders: o.borders || (o.shd ? undefined : { top: hairline(o.line), left: hairline(o.line), bottom: hairline(o.line), right: hairline(o.line) }), blocks }] }],
    });
  }
  function checkbox(size) { return T('☐ ', { font: 'Segoe UI Symbol', size: size || 12 }); }
  function stars(n, max, props) {
    const full = Math.max(0, Math.min(max, Math.round(Number(n) || 0)));
    return T('★'.repeat(full) + '☆'.repeat(Math.max(0, max - full)), props);
  }
  function isHeadingLike(text) {
    const t = String(text || '').trim();
    return t.length > 0 && t.length <= 70 && t.split(/\s+/).length <= 9 && !/[.!?\u2026:;,]$/.test(t) && !/^["\u201C'(]/.test(t);
  }
  function label(k) { const s = core.SKILLS.find(x => x.key === k); return s ? s.label : k; }
  function formatLabel(k) { const f = core.QUESTION_FORMATS.find(x => x.key === k); return f ? f.label : k; }
  function hoLabel(k) { const t = core.HIGHER_ORDER_TYPES.find(x => x.key === k); return t ? t.label : k; }
  function preLabel(k) { const t = core.PRE_TASK_TYPES.find(x => x.key === k); return t ? t.label : k; }
  function joinMeta(parts) { return parts.filter(Boolean).join('  ·  '); }

  /* ------------------------------------------------------------------ */
  /* Designs — one per text type (§17), plus the audio script             */
  /* ------------------------------------------------------------------ */

  const M_BOOK = { top: 2.6, right: 3.4, bottom: 2.6, left: 3.4 };
  const M_DOC = { top: 2.2, right: 2.2, bottom: 2.2, left: 2.2 };
  const M_WIDE = { top: 1.9, right: 1.8, bottom: 1.9, left: 1.8 };

  const DESIGNS = {
    story: {
      id: 'story', label: 'Story', accent: '6B4A2F',
      fonts: { display: 'Garamond', body: 'Garamond', meta: 'Garamond' },
      sizes: { display: 21, body: 12.5, meta: 10 },
      page: { margins: M_BOOK }, body: 'literary', dropCap: true,
      head(ctx) {
        const { c, d, meta } = ctx;
        return [
          SP(30),
          P(c.title, { align: 'center', after: 6, line: 1, run: { font: d.fonts.display, size: d.sizes.display, smallCaps: true, letterSpacing: 1.6, color: INK } }),
          meta.byline ? P(meta.byline, { align: 'center', after: 4, run: { font: d.fonts.meta, size: d.sizes.meta, italic: true, color: GREY } }) : '',
          P('· · ·', { align: 'center', after: 16, run: { color: d.accent, size: 11 } }),
        ].filter(Boolean);
      },
    },
    article: {
      id: 'article', label: 'Magazine article', accent: '1F4E5F',
      fonts: { display: 'Cambria', body: 'Cambria', meta: 'Calibri' },
      sizes: { display: 25, body: 11.5, meta: 9.5 },
      page: { margins: M_DOC }, body: 'magazine', headings: true, pullQuote: true,
      head(ctx) {
        const { c, d, meta, W } = ctx;
        return [
          meta.publication ? P(meta.publication, { after: 2, run: { font: d.fonts.meta, size: 8.5, bold: true, caps: true, letterSpacing: 1.4, color: d.accent } }) : '',
          P(c.title, { after: 6, line: 1, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: INK } }),
          meta.standfirst ? P(meta.standfirst, { after: 8, line: 1.2, run: { font: d.fonts.display, size: 13, italic: true, color: GREY } }) : '',
          P([T(meta.byline ? 'By ' + meta.byline : '', { font: d.fonts.meta, size: d.sizes.meta, color: GREY }), T('\t', {}), T(meta.dateline || '', { font: d.fonts.meta, size: d.sizes.meta, color: GREY })],
            { tabs: [{ type: 'right', pos: W }], border: { top: hairline(d.accent, 8), bottom: hairline(LINE) }, before: 2, after: 14 }),
        ].filter(Boolean);
      },
    },
    news: {
      id: 'news', label: 'News article', accent: '1A1A1A',
      fonts: { display: 'Georgia', body: 'Georgia', meta: 'Arial Narrow' },
      sizes: { display: 22, body: 10.5, meta: 8.5 },
      page: { margins: M_WIDE, cols: 2, colSep: true, colSpace: 0.8 }, body: 'news', headings: false,
      head(ctx) {
        const { c, d, meta, W } = ctx;
        return [
          P(meta.publication || '', { align: 'center', after: 2, run: { font: d.fonts.display, size: 17, bold: true, caps: true, letterSpacing: 3.5, color: INK } }),
          P([T(meta.dateline || '', { font: d.fonts.meta, size: d.sizes.meta, caps: true, color: GREY }), T('\t'), T('News', { font: d.fonts.meta, size: d.sizes.meta, caps: true, letterSpacing: 1, color: GREY })],
            { tabs: [{ type: 'right', pos: W }], border: { top: { style: 'double', sz: 6, space: 2, color: INK }, bottom: hairline(INK, 4) }, after: 12 }),
          P(c.title, { after: 4, line: 1, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: INK } }),
          meta.standfirst ? P(meta.standfirst, { after: 6, run: { font: d.fonts.display, size: 12, italic: true, color: GREY } }) : '',
          meta.byline ? P('By ' + meta.byline, { after: 10, run: { font: d.fonts.meta, size: 9, caps: true, letterSpacing: 0.8, color: d.accent } }) : '',
        ].filter(Boolean);
      },
    },
    blog: {
      id: 'blog', label: 'Blog post', accent: '2D6A4F',
      fonts: { display: 'Segoe UI', body: 'Segoe UI', meta: 'Segoe UI' },
      sizes: { display: 23, body: 11, meta: 9.5 },
      page: { margins: M_DOC }, body: 'spaced', headings: true,
      head(ctx) {
        const { c, d, meta } = ctx;
        return [
          meta.blogName ? P(meta.blogName, { after: 3, run: { size: 9, bold: true, caps: true, letterSpacing: 1.2, color: d.accent } }) : '',
          P(c.title, { after: 5, line: 1.05, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: INK } }),
          P(joinMeta([meta.byline, meta.dateline, meta.readingTime]), { after: 10, run: { font: d.fonts.meta, size: d.sizes.meta, color: GREY } }),
          ruleP({ after: 12 }),
        ].filter(Boolean);
      },
      foot(ctx) {
        const { d, meta } = ctx;
        if (!meta.tags || !meta.tags.length) return [];
        return [SP(8), P(meta.tags.map(t => T('  #' + t + '  ', { size: 9, color: d.accent, shd: 'E7F1EB' })), { before: 8, border: { top: hairline(LINE) } })];
      },
    },
    email: {
      id: 'email', label: 'Email', accent: '2B579A',
      fonts: { display: 'Calibri', body: 'Calibri', meta: 'Calibri' },
      sizes: { display: 15, body: 11, meta: 9.5 },
      page: { margins: M_DOC }, body: 'spaced',
      head(ctx) {
        const { d, meta, W } = ctx;
        const c2 = cols(W, [0.16, 0.84]);
        const row = (k, v, bold) => ({ cells: [
          { text: k, shd: 'F1F3F7', props: { after: 0, run: { font: d.fonts.meta, size: 9, bold: true, caps: true, letterSpacing: 0.6, color: GREY } } },
          { text: v || '', props: { after: 0, run: { font: d.fonts.body, size: 10.5, bold: !!bold, color: INK } } },
        ] });
        return [
          TBL({ width: W, widthType: 'dxa', cols: c2, cellMargin: { top: 0.12, left: 0.2, bottom: 0.12, right: 0.2 },
            borders: { top: hairline(LINE), bottom: hairline(LINE), insideH: hairline('E8EBEF') },
            rows: [row('From', meta.from), row('To', meta.to), row('Subject', meta.subject, true), row('Sent', meta.sent)].filter(r => r.cells[1].text !== '') }),
          SP(14),
        ];
      },
      foot(ctx) {
        const { d, meta } = ctx;
        if (!meta.signature) return [];
        return [P('--', { before: 10, after: 2, run: { size: 10, color: SOFT } }),
          P(meta.signature, { after: 0, line: 1.15, run: { font: d.fonts.body, size: 10, color: GREY } })];
      },
    },
    forum: {
      id: 'forum', label: 'Forum thread', accent: '3C4A63',
      fonts: { display: 'Segoe UI', body: 'Segoe UI', meta: 'Segoe UI' },
      sizes: { display: 14, body: 10.5, meta: 8.5 },
      page: { margins: M_DOC }, body: 'forum',
      head(ctx) {
        const { c, d, meta, W } = ctx;
        return [
          box([
            P(meta.threadTitle || c.title, { after: 2, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: 'FFFFFF' } }),
            P(joinMeta([meta.forumName, (ctx.c.paragraphs || []).length + ' posts']), { after: 0, run: { size: 8.5, color: 'D6DCE8' } }),
          ], { W, shd: d.accent, pad: 0.25, borders: {} }),
          SP(10),
        ];
      },
    },
    interview: {
      id: 'interview', label: 'Interview', accent: '7A2E3B',
      fonts: { display: 'Cambria', body: 'Cambria', meta: 'Calibri' },
      sizes: { display: 23, body: 11.5, meta: 9.5 },
      page: { margins: M_DOC }, body: 'interview',
      head(ctx) {
        const { c, d, meta } = ctx;
        return [
          P(joinMeta([meta.publication, 'Interview']), { after: 3, run: { font: d.fonts.meta, size: 8.5, bold: true, caps: true, letterSpacing: 1.4, color: d.accent } }),
          P(c.title, { after: 6, line: 1.05, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: INK } }),
          meta.standfirst ? P(meta.standfirst, { after: 6, line: 1.2, run: { font: d.fonts.display, size: 12, italic: true, color: GREY } }) : '',
          meta.byline ? P('Interview: ' + meta.byline, { after: 10, run: { font: d.fonts.meta, size: 9.5, color: GREY } }) : '',
          ruleP({ color: d.accent, sz: 6, after: 12 }),
        ].filter(Boolean);
      },
    },
    review: {
      id: 'review', label: 'Review', accent: 'A35A00',
      fonts: { display: 'Constantia', body: 'Constantia', meta: 'Calibri' },
      sizes: { display: 23, body: 11.5, meta: 9.5 },
      page: { margins: M_DOC }, body: 'spaced',
      head(ctx) {
        const { c, d, meta } = ctx;
        return [
          P(joinMeta([meta.category, 'Review']), { after: 3, run: { font: d.fonts.meta, size: 8.5, bold: true, caps: true, letterSpacing: 1.4, color: d.accent } }),
          P(c.title, { after: 4, line: 1.05, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: INK } }),
          meta.subject ? P(meta.subject, { after: 4, run: { font: d.fonts.display, size: 12, italic: true, color: GREY } }) : '',
          meta.rating !== undefined ? P([stars(meta.rating, 5, { font: 'Segoe UI Symbol', size: 14, color: d.accent }), T('   ' + meta.rating + '/5', { font: d.fonts.meta, size: 10, color: GREY })], { after: 6 }) : '',
          meta.byline ? P('Reviewed by ' + meta.byline, { after: 10, run: { font: d.fonts.meta, size: 9.5, color: GREY } }) : '',
          ruleP({ after: 12 }),
        ].filter(Boolean);
      },
      foot(ctx) {
        const { d, meta, W } = ctx;
        if (!meta.verdict) return [];
        return [SP(10), box([
          P('Verdict', { after: 2, run: { font: d.fonts.meta, size: 8.5, bold: true, caps: true, letterSpacing: 1.2, color: d.accent } }),
          P(meta.verdict, { after: 0, run: { font: d.fonts.display, size: 12, italic: true, color: INK } }),
        ], { W, shd: 'FBF3E8', pad: 0.3, borders: { left: { style: 'single', sz: 18, space: 4, color: d.accent } } })];
      },
    },
    report: {
      id: 'report', label: 'Report', accent: '274060',
      fonts: { display: 'Calibri', body: 'Calibri', meta: 'Calibri' },
      sizes: { display: 20, body: 11, meta: 9.5 },
      page: { margins: M_DOC }, body: 'spaced', headings: true,
      head(ctx) {
        const { c, d, meta, W } = ctx;
        const c2 = cols(W, [0.22, 0.78]);
        const rows = [['Prepared for', meta.recipient], ['Author', meta.author], ['Date', meta.dateline]]
          .filter(r => r[1])
          .map(r => ({ cells: [
            { text: r[0], props: { after: 0, run: { size: 9, bold: true, caps: true, letterSpacing: 0.6, color: GREY } } },
            { text: r[1], props: { after: 0, run: { size: 10, color: INK } } },
          ] }));
        return [
          box([
            P(c.title, { after: meta.subtitle ? 2 : 0, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: 'FFFFFF' } }),
            meta.subtitle ? P(meta.subtitle, { after: 0, run: { size: 11, color: 'C9D6E5' } }) : '',
          ].filter(Boolean), { W, shd: d.accent, pad: 0.3, borders: {} }),
          rows.length ? TBL({ width: W, widthType: 'dxa', cols: c2, cellMargin: { top: 0.08, left: 0, bottom: 0.08, right: 0.15 }, rows }) : '',
          meta.summary ? SP(10) : '',
          meta.summary ? box([
            P('Summary', { after: 2, run: { size: 8.5, bold: true, caps: true, letterSpacing: 1.2, color: d.accent } }),
            P(meta.summary, { after: 0, line: 1.2, run: { size: 10.5, color: INK } }),
          ], { W, shd: 'EEF2F7', pad: 0.28, borders: {} }) : '',
          SP(12),
        ].filter(Boolean);
      },
    },
    diary: {
      id: 'diary', label: 'Diary entry', accent: '5B4B8A',
      fonts: { display: 'Segoe Script', body: 'Segoe Script', meta: 'Segoe Script' },
      sizes: { display: 16, body: 12, meta: 10 },
      page: { margins: { top: 2.4, right: 2.4, bottom: 2.4, left: 3.2 } }, body: 'lined',
      head(ctx) {
        const { c, d, meta, W } = ctx;
        return [
          P(joinMeta([meta.place, meta.dateline]), { align: 'right', after: 10, run: { font: d.fonts.meta, size: d.sizes.meta, italic: true, color: d.accent } }),
          c.title ? P(c.title, { after: 8, run: { font: d.fonts.display, size: d.sizes.display, color: INK } }) : '',
        ].filter(Boolean);
      },
    },
    informational: {
      id: 'informational', label: 'Informational text', accent: '00695C',
      fonts: { display: 'Calibri', body: 'Cambria', meta: 'Calibri' },
      sizes: { display: 21, body: 11.5, meta: 9.5 },
      page: { margins: M_DOC }, body: 'spaced', headings: true,
      head(ctx) {
        const { c, d, meta } = ctx;
        return [
          P(c.title, { after: 3, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: INK } }),
          meta.subtitle ? P(meta.subtitle, { after: 6, run: { font: d.fonts.display, size: 12, color: GREY } }) : '',
          ruleP({ color: d.accent, sz: 12, after: 12 }),
        ].filter(Boolean);
      },
      foot(ctx) {
        const { d, meta, W } = ctx;
        const out = [];
        if (meta.factBox && meta.factBox.length) {
          out.push(SP(10), box([
            P('Did you know?', { after: 3, run: { font: d.fonts.meta, size: 8.5, bold: true, caps: true, letterSpacing: 1.2, color: d.accent } }),
          ].concat(meta.factBox.map(f => P([T('• ', { color: d.accent }), T(f, { font: d.fonts.meta, size: 10, color: INK })], { after: 2, left: 0.3, hanging: 0.3 }))),
          { W, shd: 'E9F3F1', pad: 0.28, borders: {} }));
        }
        if (meta.source) out.push(P('Source: ' + meta.source, { before: 8, after: 0, run: { font: d.fonts.meta, size: 8.5, italic: true, color: SOFT } }));
        return out;
      },
    },
    opinion: {
      id: 'opinion', label: 'Opinion piece', accent: 'A3282B',
      fonts: { display: 'Georgia', body: 'Georgia', meta: 'Calibri' },
      sizes: { display: 26, body: 11.5, meta: 9.5 },
      page: { margins: M_DOC }, body: 'magazine', dropCap: true, pullQuote: true,
      head(ctx) {
        const { c, d, meta, W } = ctx;
        return [
          P('Opinion', { after: 4, run: { font: d.fonts.meta, size: 9, bold: true, caps: true, letterSpacing: 2.4, color: d.accent } }),
          P(c.title, { after: 8, line: 1, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: INK } }),
          P([T(meta.byline || '', { font: d.fonts.meta, size: 10, bold: true, color: INK }), T('\t'), T(meta.dateline || '', { font: d.fonts.meta, size: 9.5, color: GREY })],
            { tabs: [{ type: 'right', pos: W }], border: { top: hairline(d.accent, 12), bottom: hairline(LINE) }, after: 14 }),
        ];
      },
    },
    dialogue: {
      id: 'dialogue', label: 'Dialogue', accent: '30506B',
      fonts: { display: 'Calibri', body: 'Calibri', meta: 'Calibri' },
      sizes: { display: 19, body: 11, meta: 9.5 },
      page: { margins: M_DOC }, body: 'dialogue',
      head(ctx) {
        const { c, d, meta } = ctx;
        return [
          P(c.title, { after: 3, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: INK } }),
          meta.setting ? P(meta.setting, { after: 10, run: { size: 10, italic: true, color: GREY } }) : '',
          ruleP({ after: 10 }),
        ].filter(Boolean);
      },
    },
    custom: {
      id: 'custom', label: 'Text', accent: '33475B',
      fonts: { display: 'Cambria', body: 'Cambria', meta: 'Calibri' },
      sizes: { display: 21, body: 11.5, meta: 9.5 },
      page: { margins: M_DOC }, body: 'spaced', headings: true,
      head(ctx) {
        const { c, d, meta } = ctx;
        return [
          P(c.title, { after: 4, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: INK } }),
          meta.standfirst ? P(meta.standfirst, { after: 4, run: { font: d.fonts.display, size: 12, italic: true, color: GREY } }) : '',
          meta.byline ? P(meta.byline, { after: 8, run: { font: d.fonts.meta, size: 9.5, color: GREY } }) : '',
          ruleP({ after: 12 }),
        ].filter(Boolean);
      },
    },
    script: {
      id: 'script', label: 'Audio script', accent: '0E7490',
      fonts: { display: 'Segoe UI', body: 'Calibri', meta: 'Consolas' },
      sizes: { display: 19, body: 11, meta: 8.5 },
      page: { margins: M_DOC }, body: 'script',
    },
  };

  /** The design of a material (listening always uses the audio-script design). */
  function designFor(material) {
    const id = core.designIdFor(material.settings || { kind: material.kind, textType: (material.settings || {}).textType });
    return DESIGNS[id] || DESIGNS.custom;
  }

  function context(material, opts) {
    const d = designFor(material);
    const margins = (d.page && d.page.margins) || M_DOC;
    return Object.assign({
      m: material, s: material.settings, c: material.content, meta: material.content.meta || {},
      plan: material.plan, d, W: usableWidth(margins), margins,
      highlight: null, numbered: false,
    }, opts || {});
  }

  /* ------------------------------------------------------------------ */
  /* Text body                                                            */
  /* ------------------------------------------------------------------ */

  function textRuns(text, ctx, props) {
    if (!ctx.highlight || !ctx.highlight.length) return [T(text, props)];
    return quality.highlightSegments(text, ctx.highlight)
      .map(seg => T(seg.text, seg.hit ? Object.assign({}, props, { bold: true, shd: MARK }) : props));
  }

  function paraNumber(i, ctx) {
    return ctx.numbered ? [T('¶' + (i + 1) + ' ', { font: 'Consolas', size: 7.5, color: SOFT, vertAlign: 'superscript' })] : [];
  }

  function headingBlock(text, ctx) {
    const d = ctx.d;
    return P(text, { style: 'Heading2', keepNext: true, before: 12, after: 4, run: { font: d.fonts.display, size: d.sizes.body + 2, bold: true, color: d.accent } });
  }

  function pullQuoteBlock(text, ctx) {
    const d = ctx.d;
    return box([P('“' + text + '”', { after: 0, align: 'center', line: 1.15, run: { font: d.fonts.display, size: d.sizes.body + 5, italic: true, color: d.accent } })],
      { W: ctx.W, pad: 0.3, borders: { top: hairline(d.accent, 8), bottom: hairline(d.accent, 8) } });
  }

  /** The reading text, laid out in the design of its text type. */
  function textBlocks(ctx) {
    const { c, d } = ctx;
    const paragraphs = c.paragraphs || [];
    const out = [];
    if (d.head) out.push(...d.head(ctx));
    const bodyRun = { font: d.fonts.body, size: d.sizes.body, color: INK };

    if (d.body === 'email' || d.body === 'spaced' || d.body === 'magazine' || d.body === 'news' || d.body === 'literary' || d.body === 'lined') {
      let first = true;
      const pullAt = d.pullQuote && ctx.meta.pullQuote ? Math.min(2, Math.max(1, Math.floor(paragraphs.length / 2))) : -1;
      paragraphs.forEach((text, i) => {
        if (i === pullAt) out.push(SP(6), pullQuoteBlock(ctx.meta.pullQuote, ctx), SP(6));
        if (d.headings && isHeadingLike(text)) { out.push(headingBlock(text, ctx)); return; }
        let body = text;
        if (d.body === 'news' && first && ctx.meta.location) body = ctx.meta.location + ' — ' + text;
        const props = { run: bodyRun };
        if (d.body === 'literary' || d.body === 'magazine' || d.body === 'news') {
          Object.assign(props, { align: 'both', after: 0, line: 1.12, firstLine: first ? undefined : 0.55 });
        } else if (d.body === 'lined') {
          Object.assign(props, { after: 0, line: 1.9, firstLine: 0.6, border: { bottom: { style: 'dotted', sz: 4, space: 4, color: 'C6C2DA' } } });
        } else {
          Object.assign(props, { after: 9, line: 1.25 });
        }
        if (first && d.dropCap && body.length > 60) {
          const letter = body.charAt(0);
          out.push(P(letter, { dropCap: { lines: 3 }, after: 0, line: 1, run: { font: d.fonts.display, size: d.sizes.body * 3.2, color: d.accent } }));
          body = body.slice(1);
        }
        out.push(P(paraNumber(i, ctx).concat(textRuns(body, ctx, bodyRun)), props));
        first = false;
      });
    } else if (d.body === 'forum') {
      const authors = ctx.meta.authors || [];
      const times = ctx.meta.timestamps || [];
      const c2 = cols(ctx.W, [0.24, 0.76]);
      paragraphs.forEach((text, i) => {
        const author = authors[i] || 'user_' + (i + 1);
        out.push(TBL({
          width: ctx.W, widthType: 'dxa', cols: c2,
          cellMargin: { top: 0.15, left: 0.2, bottom: 0.15, right: 0.2 },
          borders: { top: hairline(LINE), bottom: hairline(LINE), insideV: hairline('E8EBEF') },
          rows: [{ cells: [
            { shd: i % 2 ? 'F7F8FA' : 'EFF2F6', blocks: [
              P(author, { after: 1, run: { font: d.fonts.display, size: 10, bold: true, color: d.accent } }),
              P(times[i] || '', { after: 0, run: { font: d.fonts.meta, size: 8, color: SOFT } }),
            ] },
            { blocks: [P(paraNumber(i, ctx).concat(textRuns(text, ctx, { font: d.fonts.body, size: d.sizes.body, color: INK })), { after: 0, line: 1.2 })] },
          ] }],
        }), SP(4));
      });
    } else if (d.body === 'interview') {
      const speakers = ctx.meta.speakers || [];
      paragraphs.forEach((text, i) => {
        const who = speakers[i] || (i % 2 === 0 ? 'Interviewer' : 'Guest');
        const isQuestion = /\?\s*$/.test(text) || (i % 2 === 0 && !speakers.length);
        out.push(P(paraNumber(i, ctx)
          .concat([T(who + ': ', { font: d.fonts.meta, size: d.sizes.body - 0.5, bold: true, caps: true, letterSpacing: 0.6, color: isQuestion ? d.accent : GREY })])
          .concat(textRuns(text, ctx, { font: d.fonts.body, size: d.sizes.body, bold: isQuestion, color: INK })),
        { after: 8, left: 1.6, hanging: 1.6, line: 1.2 }));
      });
    } else if (d.body === 'dialogue') {
      const speakers = ctx.meta.speakers || [];
      const c2 = cols(ctx.W, [0.2, 0.8]);
      out.push(TBL({
        width: ctx.W, widthType: 'dxa', cols: c2, cellMargin: { top: 0.08, left: 0, bottom: 0.08, right: 0.2 },
        rows: paragraphs.map((text, i) => ({ cells: [
          { text: (speakers[i] || 'Speaker ' + String.fromCharCode(65 + (i % 2))), props: { after: 0, run: { font: d.fonts.meta, size: d.sizes.body, bold: true, color: d.accent } } },
          { blocks: [P(paraNumber(i, ctx).concat(textRuns(text, ctx, { font: d.fonts.body, size: d.sizes.body, color: INK })), { after: 0, line: 1.2 })] },
        ] })),
      }));
    }
    if (d.foot) out.push(...d.foot(ctx));
    return out.filter(Boolean);
  }

  /** The listening script, laid out as a recording script. */
  function scriptBlocks(ctx) {
    const { c, d, plan, m } = ctx;
    const out = [];
    const st = quality.speakerStats(c.lines);
    out.push(
      P('Audio script', { after: 3, run: { font: d.fonts.display, size: 9, bold: true, caps: true, letterSpacing: 2, color: d.accent } }),
      P(c.title, { after: 4, run: { font: d.fonts.display, size: d.sizes.display, bold: true, color: INK } }),
      P(joinMeta([ctx.meta.programme, plan.preset && plan.preset.label, Math.round(plan.seconds / 60 * 10) / 10 + ' min', st.total + ' words', plan.speakers.map(s => s.label + ' ' + (st.shares[s.label] || 0) + ' %').join(' / ')]),
        { after: ctx.meta.setting ? 2 : 10, run: { font: d.fonts.meta, size: d.sizes.meta, color: GREY } }),
    );
    if (ctx.meta.setting) out.push(P('Setting: ' + ctx.meta.setting, { after: 10, run: { size: 10, italic: true, color: GREY } }));
    out.push(ruleP({ color: d.accent, sz: 8, after: 10 }));
    const c3 = cols(ctx.W, [0.06, 0.16, 0.78]);
    out.push(TBL({
      width: ctx.W, widthType: 'dxa', cols: c3, cellMargin: { top: 0.07, left: 0, bottom: 0.07, right: 0.18 },
      rows: (c.lines || []).map((l, i) => ({ cells: [
        { text: String(i + 1), props: { after: 0, run: { font: 'Consolas', size: 8, color: SOFT } } },
        { text: l.speaker, props: { after: 0, run: { font: d.fonts.display, size: 10, bold: true, color: d.accent } } },
        { blocks: [P((l.emotion ? [T('[' + l.emotion + '] ', { font: d.fonts.meta, size: 9, bold: true, color: 'B45309' })] : [])
            .concat(textRuns(l.text, ctx, { font: d.fonts.body, size: d.sizes.body, color: INK })), { after: 0, line: 1.18 })] },
      ] })),
    }));
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Worksheet (student version)                                          */
  /* ------------------------------------------------------------------ */

  const WS = { display: 'Calibri', body: 'Calibri' };

  function answerLine(ctx, indent, count) {
    const out = [];
    for (let i = 0; i < (count || 1); i++) {
      out.push(P('', { left: indent === undefined ? 0.8 : indent, border: { bottom: { style: 'single', sz: 4, space: 2, color: 'C9CDD3' } }, after: 10, mark: { size: 11 } }));
    }
    return out;
  }

  function nameRow(ctx) {
    const c3 = cols(ctx.W, [0.46, 0.2, 0.34]);
    const cell = (t) => ({ borders: { bottom: hairline(SOFT) }, props: { after: 0, run: { font: WS.body, size: 9.5, color: GREY } }, text: t });
    return TBL({ width: ctx.W, widthType: 'dxa', cols: c3, cellMargin: { top: 0.1, left: 0, bottom: 0.05, right: 0.25 },
      rows: [{ cells: [cell('Name:'), cell('Class:'), cell('Date:')] }] });
  }

  function socialLabel(k) { const f = core.SOCIAL_FORMS.find(x => x.key === k); return f ? f.label : k; }
  function socialEn(k) { const f = core.SOCIAL_FORMS.find(x => x.key === k); return f ? f.en : k; }
  function modeLabel(k) { const m = core.PRE_TASK_MODES.find(x => x.key === k); return m ? m.label : k; }

  function postLabel(k) { const t = core.POST_TASK_TYPES.find(x => x.key === k); return t ? t.label : k; }

  function preTaskBlocks(p, ctx, i, phase) {
    const d = ctx.d;
    const meta = [p.socialForm ? socialLabel(p.socialForm) + ' (' + socialEn(p.socialForm) + ')' : '', p.mode ? modeLabel(p.mode) : '', p.minutes ? p.minutes + ' min' : ''].filter(Boolean);
    const blocks = [
      P((p.n ? p.n + '. ' : '') + (phase === 'post' ? postLabel(p.type) : preLabel(p.type)) + (p.title ? ': ' + p.title : ''), { after: 2, run: { font: WS.display, size: 9, bold: true, caps: true, letterSpacing: 1, color: d.accent } }),
    ];
    if (meta.length) blocks.push(P(joinMeta(meta), { after: 4, run: { font: WS.body, size: 8.5, italic: true, color: GREY } }));
    blocks.push(P(p.prompt, { after: p.items && p.items.length ? 4 : 0, run: { font: WS.body, size: 10.5, color: INK } }));
    if (p.items && p.items.length) {
      blocks.push(P(p.items.map(it => T('  ' + it + '  ', { font: WS.body, size: 10, color: INK, shd: 'FFFFFF' })).reduce((a, r) => a.concat([r, T('  ')]), []), { after: 0 }));
    }
    if (p.mode !== 'oral') blocks.push(...answerLine(ctx, 0, p.type === 'vocabulary' || p.type === 'brainstorm' ? 2 : 1));
    if (p.product) blocks.push(P([T('Result: ', { font: WS.display, size: 9, bold: true, color: GREY }), T(p.product, { font: WS.body, size: 9.5, color: INK })], { before: 4, after: 0 }));
    if (p.criteria && p.criteria.length) {
      blocks.push(P('Success criteria', { before: 6, after: 2, run: { font: WS.display, size: 8, bold: true, caps: true, letterSpacing: 0.8, color: GREY } }));
      p.criteria.forEach(c => blocks.push(P([checkbox(10), T(c, { font: WS.body, size: 9.5, color: INK })], { after: 1, left: 0.4, hanging: 0.4 })));
    }
    return [box(blocks, { W: ctx.W, shd: 'F4F6F8', pad: 0.28, borders: {} }), SP(8)];
  }

  /** Teacher overview of one task phase: form, mode, time, material and note. */
  function preTaskTableBlocks(ctx, phase) {
    const { m } = ctx;
    const list = (m.worksheet && (phase === 'post' ? m.worksheet.postTasks : m.worksheet.preTasks)) || [];
    if (!list.length) return [];
    const accent = '274060';
    const c5 = cols(ctx.W, [0.05, 0.19, 0.16, 0.12, 0.48]);
    const head = (t) => ({ shd: accent, text: t, props: { after: 0, run: { font: WS.display, size: 8.5, bold: true, caps: true, letterSpacing: 0.6, color: 'FFFFFF' } } });
    const rows = [{ header: true, cells: [head('P'), head('Form'), head('Sozialform'), head('Zeit'), head('Hinweis / Material')] }];
    for (const p of list) {
      rows.push({ cells: [
        { text: String(p.n || ''), props: { after: 0, run: { font: WS.body, size: 9, bold: true, color: GREY } } },
        { text: phase === 'post' ? postLabel(p.type) : preLabel(p.type), props: { after: 0, run: { font: WS.body, size: 9, color: INK } } },
        { text: socialLabel(p.socialForm) + ' · ' + modeLabel(p.mode), props: { after: 0, run: { font: WS.body, size: 9, color: GREY } } },
        { text: (p.minutes || 0) + ' min', props: { after: 0, run: { font: WS.body, size: 9, color: GREY } } },
        { text: [p.reference ? 'Ansatz: ' + p.reference : '', p.product ? 'Produkt: ' + p.product : '', p.materials ? 'Material: ' + p.materials : '', p.teacherNote, (p.vocabUsed || []).length ? 'Wörter: ' + p.vocabUsed.join(', ') : '', (p.criteria || []).length ? 'Success criteria: ' + p.criteria.join(' / ') : ''].filter(Boolean).join(' — '), props: { after: 0, run: { font: WS.body, size: 8.5, color: GREY } } },
      ] });
    }
    return [
      P(phase === 'post' ? 'Post-Task' : 'Pre-Task', { after: 6, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } }),
      TBL({ width: ctx.W, widthType: 'dxa', cols: c5, cellMargin: { top: 0.06, left: 0.1, bottom: 0.06, right: 0.1 },
        borders: { top: hairline(SOFT), bottom: hairline(SOFT), insideH: hairline(LINE), insideV: hairline('EDF0F3') }, rows }),
      SP(10),
    ];
  }

  function questionBlocks(q, ctx) {
    const d = ctx.d, out = [];
    const seed = ctx.m.id;
    const numRun = T(q.n + '. ', { font: WS.display, size: 11, bold: true, color: d.accent });
    const promptText = q.prompt || q.statement || '';
    out.push(P([numRun].concat(textRuns(promptText, { highlight: null }, { font: WS.body, size: 11, color: INK })),
      { left: 0.8, hanging: 0.8, after: 4, keepNext: true }));
    const optionList = (items, marker) => items.forEach((o, i) => {
      out.push(P([checkbox(11), T(marker ? marker(i) + ') ' : '', { font: WS.body, size: 11, bold: true, color: GREY }), T(String(o).replace(/^[A-E][).:]\s*/, ''), { font: WS.body, size: 11, color: INK })],
        { left: 1.5, hanging: 0.7, after: 2 }));
    });
    switch (q.format) {
      case 'multiple_choice':
      case 'best_summary':
      case 'select_all':
        optionList(q.options || [], i => String.fromCharCode(65 + i));
        out.push(SP(6));
        break;
      case 'true_false':
        out.push(P([checkbox(11), T('True   ', { font: WS.body, size: 11 }), checkbox(11), T('False', { font: WS.body, size: 11 })], { left: 0.8, after: 8 }));
        break;
      case 'true_false_correction':
        out.push(P([checkbox(11), T('True   ', { font: WS.body, size: 11 }), checkbox(11), T('False', { font: WS.body, size: 11 })], { left: 0.8, after: 4 }));
        out.push(P('Correction:', { left: 0.8, after: 2, run: { font: WS.body, size: 9.5, italic: true, color: GREY } }));
        out.push(...answerLine(ctx, 0.8, 1));
        break;
      case 'who_said_it':
        optionList(q.options || [], null);
        out.push(SP(6));
        break;
      case 'matching': {
        const items = q.items || [];
        const right = render.seededShuffle(items.map(it => it.right), seed + ':' + q.n);
        const c3 = cols(ctx.W - docx.cm(0.8), [0.44, 0.1, 0.46]);
        out.push(TBL({ width: ctx.W - docx.cm(0.8), widthType: 'dxa', cols: c3, indent: 0.8,
          cellMargin: { top: 0.08, left: 0.05, bottom: 0.08, right: 0.15 },
          rows: items.map((it, i) => ({ cells: [
            { text: (i + 1) + '. ' + it.left, props: { after: 0, run: { font: WS.body, size: 10.5, color: INK } } },
            { borders: { bottom: hairline(SOFT) }, text: '', props: { after: 0 } },
            { text: String.fromCharCode(97 + i) + ') ' + right[i], props: { after: 0, run: { font: WS.body, size: 10.5, color: INK } } },
          ] })) }), SP(8));
        break;
      }
      case 'ordering': {
        const items = render.seededShuffle((q.items || []).map(x => typeof x === 'string' ? x : JSON.stringify(x)), seed + ':' + q.n);
        items.forEach(it => out.push(P([T('____ ', { font: WS.body, size: 11, color: SOFT }), T(it, { font: WS.body, size: 10.5, color: INK })], { left: 1.6, hanging: 0.8, after: 3 })));
        out.push(SP(6));
        break;
      }
      case 'table_completion': {
        const t = q.table || {};
        const headers = t.headers || [];
        const width = ctx.W - docx.cm(0.8);
        const cw = cols(width, headers.map(() => 1 / Math.max(1, headers.length)));
        out.push(TBL({ width, widthType: 'dxa', cols: cw, indent: 0.8,
          borders: { top: hairline(SOFT), left: hairline(SOFT), bottom: hairline(SOFT), right: hairline(SOFT), insideH: hairline(LINE), insideV: hairline(LINE) },
          cellMargin: { top: 0.1, left: 0.12, bottom: 0.1, right: 0.12 },
          rows: [{ header: true, cells: headers.map(h => ({ shd: 'EFF2F6', text: h, props: { after: 0, run: { font: WS.display, size: 10, bold: true, color: INK } } })) }]
            .concat((t.rows || []).map(r => ({ height: 0.6, cells: (r || []).map(cell => ({ text: cell, props: { after: 0, run: { font: WS.body, size: 10.5, color: INK } } })) }))) }), SP(8));
        break;
      }
      case 'gap_fill':
      case 'note_taking':
        out.push(...answerLine(ctx, 0.8, Array.isArray(q.answer) ? q.answer.length : 2));
        break;
      case 'sentence_completion':
        out.push(...answerLine(ctx, 0.8, 1));
        break;
      default:
        out.push(...answerLine(ctx, 0.8, 2));
    }
    return out;
  }

  /**
   * `part` follows the lesson: "before" is the head, the pre-task and the words
   * the text needs; "after" is everything the students do once they have read
   * or heard it. Without a part the whole worksheet comes back, in that order.
   */
  function worksheetBlocks(ctx, part) {
    const { m, d } = ctx;
    const ws = m.worksheet;
    const accent = d.accent;
    const out = [];
    if (part !== 'after') {
      out.push(nameRow(ctx), SP(14));
      out.push(P((m.kind === 'listening' ? 'Listening' : 'Reading') + '  ·  ' + joinMeta([m.plan.unitName, m.plan.cefr, m.variantLabel]),
        { after: 3, run: { font: WS.display, size: 9, bold: true, caps: true, letterSpacing: 1.4, color: accent } }));
      out.push(P(ws.title || m.content.title, { after: 4, run: { font: WS.display, size: 18, bold: true, color: INK } }));
      if (ws.instructions) out.push(P(ws.instructions, { after: 10, run: { font: WS.body, size: 10.5, italic: true, color: GREY } }));
      out.push(ruleP({ color: accent, sz: 8, after: 12 }));

      if (ws.preTasks && ws.preTasks.length) {
        out.push(P('Before you ' + (m.kind === 'listening' ? 'listen' : 'read'), { after: 6, run: { font: WS.display, size: 12, bold: true, color: INK } }));
        ws.preTasks.forEach((p, i) => out.push(...preTaskBlocks(p, ctx, i)));
        out.push(SP(6));
      }
      if (m.glossary && m.glossary.length) out.push(...glossaryBlocks(ctx));
      if (part === 'before') return out;
    }

    if (ws.questions.length) {
      out.push(P(m.kind === 'listening' ? 'While you listen' : 'Comprehension', { after: 8, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } }));
      let lastFormat = null;
      for (const q of ws.questions) {
        if (q.format !== lastFormat) {
          out.push(P(formatLabel(q.format), { before: 6, after: 4, keepNext: true, run: { font: WS.display, size: 8.5, bold: true, caps: true, letterSpacing: 1.1, color: accent } }));
          lastFormat = q.format;
        }
        out.push(...questionBlocks(q, ctx));
      }
    }
    if ((ws.postTasks || []).length) {
      out.push(SP(10), P(m.kind === 'listening' ? 'After you listen' : 'After you read', { after: 8, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } }));
      ws.postTasks.forEach((p, i) => out.push(...preTaskBlocks(p, ctx, i, 'post')));
    }
    if (ws.higherOrder && ws.higherOrder.length) {
      out.push(SP(10), P('Beyond the text', { after: 6, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } }));
      ws.higherOrder.forEach((h, i) => {
        out.push(P([T((i + 1) + '. ', { font: WS.display, size: 11, bold: true, color: accent }), T(h.prompt, { font: WS.body, size: 11, color: INK }),
          T('  [' + hoLabel(h.type) + ']', { font: WS.body, size: 8.5, color: SOFT })], { left: 0.8, hanging: 0.8, after: 4, keepNext: true }));
        out.push(...answerLine(ctx, 0.8, 3));
      });
    }
    return out;
  }

  /** "Words to know": the hard words the meter found, explained by Claude (worksheet option). */
  function glossaryBlocks(ctx) {
    const { m, d } = ctx;
    const g = m.glossary || [];
    const c3 = cols(ctx.W, [0.22, 0.5, 0.28]);
    return [
      P('Words to know', { after: 4, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } }),
      TBL({ width: ctx.W, widthType: 'dxa', cols: c3, cellMargin: { top: 0.05, left: 0, bottom: 0.05, right: 0.15 }, borders: { insideH: hairline('EDF0F3') },
        rows: g.map(x => ({ cells: [
          { text: x.form || x.word, props: { after: 0, run: { font: WS.body, size: 10, bold: true, color: d.accent } } },
          { text: x.explanation, props: { after: 0, run: { font: WS.body, size: 10, color: INK } } },
          { text: x.german || '', props: { after: 0, run: { font: WS.body, size: 10, italic: true, color: GREY } } },
        ] })) }),
      SP(10),
    ];
  }

  /** Difficulty meter (teacher version): band, score and the measured dimensions. */
  function levelBlocks(ctx) {
    const { m } = ctx;
    const lv = m.level;
    if (!lv) return [];
    const bands = core.CEFR_BANDS;
    const target = m.plan.cefr;
    const tIdx = bands.indexOf(target);
    const c3 = cols(ctx.W, [0.1, 0.5, 0.4]);
    const COLORS = { 0: '1B5E20', 1: '8A5A00', 2: 'A3282B' };
    const out = [
      SP(12),
      P('Difficulty meter', { after: 3, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } }),
      P(`Measured ${lv.band} · score ${lv.score} / 5 · confidence ${lv.confidence} · target ${target}` + (lv.stats ? ` · ${lv.stats.words} words, ${lv.stats.sentences} sentences, ${lv.stats.msl} words/sentence` : ''), { after: 6, run: { font: WS.body, size: 9, color: GREY } }),
      TBL({ width: ctx.W, widthType: 'dxa', cols: c3, cellMargin: { top: 0.05, left: 0, bottom: 0.05, right: 0.15 }, borders: { insideH: hairline('EDF0F3') },
        rows: (lv.dimensions || []).map(dm => {
          const diff = Math.min(2, Math.abs(bands.indexOf(dm.band) - tIdx));
          return { cells: [
            { text: dm.band, props: { after: 0, run: { font: WS.body, size: 8.5, bold: true, color: COLORS[diff] } } },
            { text: dm.label, props: { after: 0, run: { font: WS.body, size: 9, color: INK } } },
            { text: dm.value + ' ' + dm.unit, props: { after: 0, run: { font: WS.body, size: 8.5, color: GREY } } },
          ] };
        }) }),
    ];
    if (lv.hardWords && lv.hardWords.length) out.push(P('Hard words: ' + lv.hardWords.slice(0, 25).map(h => h.word).join(', '), { before: 4, run: { font: WS.body, size: 8.5, color: GREY } }));
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Teacher version                                                      */
  /* ------------------------------------------------------------------ */

  function lvLine(lv, target) { return `${lv.band} (score ${lv.score}, confidence ${lv.confidence}; target ${target})`; }

  function teacherHeadBlocks(ctx) {
    const { m, d } = ctx;
    const plan = m.plan;
    const c2 = cols(ctx.W, [0.24, 0.76]);
    const rows = [
      ['Source', joinMeta([plan.textbookName, plan.unitName, plan.unitTopic])],
      ['Topic', plan.topic],
      ['Language', plan.cefr + ' · complexity ' + m.settings.languageComplexity + '/100 · explicitness ' + m.settings.explicitness + '/100'],
      m.kind === 'listening'
        ? ['Audio', joinMeta([plan.preset.label, Math.round(plan.seconds / 60 * 10) / 10 + ' min ≈ ' + plan.targetWords + ' words', plan.speakers.map(s => s.label + ' ' + s.share + ' %').join(' / '), 'emotion tags: ' + m.settings.emotionTags])]
        : ['Text', joinMeta([m.settings.textType === 'Custom' ? m.settings.customTextType : m.settings.textType, '≈ ' + plan.targetWords + ' words', DESIGNS[core.designIdFor(m.settings)].label])],
      m.worksheet ? ['Questions', render.variantsOf(m).filter(v => v.worksheet).map(v => { const p = v.plan || plan; return joinMeta([v.label, p.questionCount + ' · level ' + (p.questionBands ? p.questionBands.join('–') : p.questionBand) + ' · difficulty ' + (p.questionDifficulty == null ? m.settings.questionDifficulty : p.questionDifficulty) + '/100 · ' + core.SKILLS.filter(s => p.skillMix[s.key]).map(s => p.skillMix[s.key] + '× ' + s.short).join(', ')]); }).join('  |  ')] : ['Worksheet', 'not created'],
      m.level ? ['Measured', lvLine(m.level, plan.cefr)] : null,
      m.worksheet && (m.settings.glossary || m.settings.appendScript) ? ['Options', joinMeta([m.settings.glossary ? 'glossary on page 1' : '', m.settings.appendScript && m.kind === 'listening' ? 'script on the last page' : ''])] : null,
      ['Created', new Date(m.createdAt || Date.now()).toLocaleString('de-CH')],
    ].filter(r => r && r[1]);
    return [
      P('Teacher version', { after: 3, run: { font: WS.display, size: 9, bold: true, caps: true, letterSpacing: 2, color: 'A3282B' } }),
      P(m.title, { after: 8, run: { font: WS.display, size: 19, bold: true, color: INK } }),
      TBL({ width: ctx.W, widthType: 'dxa', cols: c2, cellMargin: { top: 0.08, left: 0, bottom: 0.08, right: 0.2 },
        borders: { insideH: hairline('EDF0F3') },
        rows: rows.map(r => ({ cells: [
          { text: r[0], props: { after: 0, run: { font: WS.display, size: 8.5, bold: true, caps: true, letterSpacing: 0.8, color: GREY } } },
          { text: r[1], props: { after: 0, run: { font: WS.body, size: 10, color: INK } } },
        ] })) }),
      SP(14),
    ];
  }

  function vocabBlocks(ctx) {
    const { m, d } = ctx;
    const items = (m.plan.vocabulary || []).filter(v => (m.vocabFound || []).includes(v.word));
    const out = [P('Target vocabulary used', { after: 6, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } })];
    if (!items.length) { out.push(P('No target item detected.', { run: { font: WS.body, size: 10, italic: true, color: GREY } })); return out; }
    const half = Math.ceil(items.length / 2);
    const c4 = cols(ctx.W, [0.25, 0.25, 0.25, 0.25]);
    const rows = [];
    for (let i = 0; i < half; i++) {
      const a = items[i], b = items[i + half];
      rows.push({ cells: [
        { text: a ? a.word : '', props: { after: 0, run: { font: WS.body, size: 10, bold: true, color: INK } } },
        { text: a ? a.translation || '' : '', props: { after: 0, run: { font: WS.body, size: 10, color: GREY } } },
        { text: b ? b.word : '', props: { after: 0, run: { font: WS.body, size: 10, bold: true, color: INK } } },
        { text: b ? b.translation || '' : '', props: { after: 0, run: { font: WS.body, size: 10, color: GREY } } },
      ] });
    }
    out.push(TBL({ width: ctx.W, widthType: 'dxa', cols: c4, cellMargin: { top: 0.06, left: 0, bottom: 0.06, right: 0.15 }, borders: { insideH: hairline('EDF0F3') }, rows }));
    if (m.vocabMissing && m.vocabMissing.length) out.push(P('Not used: ' + m.vocabMissing.join(', '), { before: 6, run: { font: WS.body, size: 9, italic: true, color: SOFT } }));
    return out;
  }

  function answerText(q) {
    if (q.format === 'matching') return (q.items || []).map(it => it.left + ' → ' + it.right).join('; ');
    if (q.format === 'ordering') return (q.items || []).map((it, i) => (i + 1) + '. ' + (typeof it === 'string' ? it : JSON.stringify(it))).join('  ');
    if (Array.isArray(q.answer)) return q.answer.join(' · ');
    if (q.answer && typeof q.answer === 'object') return JSON.stringify(q.answer);
    let a = String(q.answer === undefined ? '' : q.answer);
    if (q.format === 'true_false_correction' && q.correction) a += ' — ' + q.correction;
    if (q.acceptable && q.acceptable.length) a += ' (also: ' + q.acceptable.join('; ') + ')';
    return a;
  }

  function keyBlocks(ctx) {
    const { m } = ctx;
    const variants = render.variantsOf(m).filter(v => v.worksheet);
    return variants.flatMap((v, i) => (i ? [SP(14)] : []).concat(keyBlocksFor(Object.assign({}, ctx, { m: render.forVariant(m, v.key) }), v.label)));
  }
  function keyBlocksFor(ctx, variantLabel) {
    const { m, d } = ctx;
    const ws = m.worksheet;
    const accent = '274060';
    const c6 = cols(ctx.W, [0.05, 0.15, 0.13, 0.09, 0.26, 0.32]);
    const head = (t) => ({ shd: accent, text: t, props: { after: 0, run: { font: WS.display, size: 8.5, bold: true, caps: true, letterSpacing: 0.6, color: 'FFFFFF' } } });
    const rows = [{ header: true, cells: [head('Q'), head('Skill'), head('Format'), head('Level'), head('Correct answer'), head('Evidence')] }];
    for (const q of ws.questions) {
      rows.push({ cells: [
        { text: String(q.n), props: { after: 0, run: { font: WS.body, size: 9, bold: true, color: GREY } } },
        { text: label(q.skill), props: { after: 0, run: { font: WS.body, size: 9, color: INK } } },
        { text: formatLabel(q.format), props: { after: 0, run: { font: WS.body, size: 9, color: GREY } } },
        { text: q.difficulty, props: { after: 0, run: { font: WS.body, size: 9, color: GREY } } },
        { text: answerText(q), props: { after: 0, run: { font: WS.body, size: 9.5, bold: true, color: '1B5E20' } } },
        { blocks: [
          P((q.evidenceRef ? q.evidenceRef + ' ' : '') + '“' + q.evidenceQuote + '”', { after: q.rationale ? 2 : 0, line: 1.1, run: { font: WS.body, size: 8.5, italic: true, color: GREY } }),
          q.rationale ? P(q.rationale, { after: 0, line: 1.1, run: { font: WS.body, size: 8.5, color: '8A5A00' } }) : '',
        ].filter(Boolean) },
      ] });
    }
    const out = [P('Answer key' + (variantLabel ? ' — ' + variantLabel + ' (' + (m.plan.questionBands ? m.plan.questionBands.join('–') : m.plan.questionBand) + ')' : ''), { after: 6, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } }),
      TBL({ width: ctx.W, widthType: 'dxa', cols: c6, cellMargin: { top: 0.08, left: 0.1, bottom: 0.08, right: 0.1 },
        borders: { top: hairline(SOFT), bottom: hairline(SOFT), insideH: hairline(LINE), insideV: hairline('EDF0F3') }, rows })];
    if (ws.higherOrder && ws.higherOrder.length) {
      out.push(SP(12), P('Higher-order tasks — model answers', { after: 6, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } }));
      ws.higherOrder.forEach((h, i) => {
        out.push(P([T((i + 1) + '. ', { font: WS.display, size: 10, bold: true, color: GREY }), T(hoLabel(h.type) + ': ', { font: WS.body, size: 10, bold: true, color: INK }), T(h.prompt, { font: WS.body, size: 10, color: INK })], { after: 2, left: 0.6, hanging: 0.6 }));
        out.push(P(String(typeof h.answer === 'string' ? h.answer : JSON.stringify(h.answer || '')) + (h.rationale ? ' — ' + h.rationale : ''), { left: 0.6, after: 6, run: { font: WS.body, size: 9.5, color: '1B5E20' } }));
      });
    }
    return out;
  }

  /** Who took the photographs in the picture of the medium (licences ask for it). */
  function creditBlocks(ctx) {
    const list = quality.photoCredits(ctx.m);
    if (!list.length) return [];
    return [
      SP(12),
      P('Picture credits', { after: 3, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } }),
    ].concat(list.map(c => P(c.credit + (c.license ? ' · ' + c.license : '') + (c.url ? ' · ' + c.url : ''),
      { after: 2, run: { font: WS.body, size: 8.5, color: GREY } })));
  }

  function qualityBlocks(ctx) {
    const { m } = ctx;
    const findings = (m.quality && m.quality.findings) || [];
    const repairs = ((m.quality && m.quality.repairs) || []).filter(r => r.accepted);
    if (!findings.length && !repairs.length) return [];
    const s = quality.summarize(findings);
    const COLORS = { pass: '1B5E20', warn: '8A5A00', fail: 'A3282B', unverified: GREY };
    const c3 = cols(ctx.W, [0.11, 0.37, 0.52]);
    const blocked = quality.blockingFailures(findings);
    return [
      SP(12),
      P('Quality check', { after: 3, keepNext: true, run: { font: WS.display, size: 12, bold: true, color: INK } }),
      P(`${s.pass} passed · ${s.warn} warnings · ${s.fail} failed · ${s.unverified} unverified`, { after: 6, run: { font: WS.body, size: 9, color: GREY } }),
    ].concat(blocked.length ? [
      P(`${blocked.length} blocking check(s) failed — do not hand this material out unchanged: ` + blocked.map(f => f.title).join('; ') + '.',
        { after: 8, run: { font: WS.body, size: 9, bold: true, color: 'A3282B' } }),
    ] : []).concat([
      TBL({ width: ctx.W, widthType: 'dxa', cols: c3, cellMargin: { top: 0.06, left: 0, bottom: 0.06, right: 0.15 }, borders: { insideH: hairline('EDF0F3') },
        rows: findings.map(f => ({ cells: [
          { text: f.status, props: { after: 0, run: { font: WS.body, size: 8.5, bold: true, caps: true, letterSpacing: 0.5, color: COLORS[f.status] || GREY } } },
          { text: f.title, props: { after: 0, run: { font: WS.body, size: 9, color: INK } } },
          { text: f.detail || '', props: { after: 0, run: { font: WS.body, size: 8.5, color: GREY } } },
        ] })) }),
    ]).concat(repairs.length ? [
      P('Automatische Korrektur', { before: 10, after: 4, keepNext: true, run: { font: WS.display, size: 10, bold: true, color: INK } }),
      TBL({ width: ctx.W, widthType: 'dxa', cols: c3, cellMargin: { top: 0.06, left: 0, bottom: 0.06, right: 0.15 }, borders: { insideH: hairline('EDF0F3') },
        rows: repairs.map(r => ({ cells: [
          { text: 'Runde ' + r.round, props: { after: 0, run: { font: WS.body, size: 8.5, bold: true, color: GREY } } },
          { text: render.repairLabel(r), props: { after: 0, run: { font: WS.body, size: 9, color: INK } } },
          { text: 'Auslöser: ' + ((r.fixed || []).join(', ')), props: { after: 0, run: { font: WS.body, size: 8.5, color: GREY } } },
        ] })) }),
    ] : []);
  }

  /* ------------------------------------------------------------------ */
  /* Documents                                                            */
  /* ------------------------------------------------------------------ */

  function footerBlocks(m, which, W) {
    return [P([
      T(m.title + (which === 'teacher' ? '  ·  Teacher version' : m.variantLabel ? '  ·  ' + m.variantLabel : ''), { font: WS.body, size: 8, color: SOFT }),
      T('\t'),
      T('Page ', { font: WS.body, size: 8, color: SOFT }),
      F('PAGE', { font: WS.body, size: 8, color: SOFT }),
      T(' / ', { font: WS.body, size: 8, color: SOFT }),
      F('NUMPAGES', { font: WS.body, size: 8, color: SOFT }),
    ], { tabs: [{ type: 'right', pos: W }], border: { top: hairline('E4E8EC') }, before: 2, after: 0 })];
  }

  /** Student version: reading text in its own design, then the worksheet. */
  function studentSpec(material, variantKey) {
    material = render.forVariant(material, variantKey);
    const ctx = context(material);
    const d = ctx.d;
    const sections = [];
    const wsCtx = Object.assign({}, ctx, { W: usableWidth(M_DOC), margins: M_DOC });
    // the sheet follows the lesson: pre-task and the words first, then the
    // text in its own design, then everything that is done afterwards
    if (material.worksheet) sections.push({ blocks: worksheetBlocks(wsCtx, 'before'), props: { margins: M_DOC, type: 'nextPage' } });
    if (material.kind === 'reading') {
      sections.push({ blocks: textBlocks(ctx), props: { margins: ctx.margins, cols: d.page.cols, colSep: d.page.colSep, colSpace: d.page.colSpace, type: 'nextPage' } });
    }
    if (material.worksheet) {
      sections.push({ blocks: worksheetBlocks(wsCtx, 'after'), props: { margins: M_DOC } });
      // Listening option: the script on the last page, after the questions.
      if (material.kind === 'listening' && material.settings.appendScript) {
        sections[sections.length - 1].props = Object.assign({}, sections[sections.length - 1].props, { type: 'nextPage' });
        sections.push({ blocks: scriptBlocks(wsCtx), props: { margins: M_DOC } });
      }
    } else if (!sections.length) {
      sections.push({ blocks: [P('')], props: { margins: M_DOC } });
    }
    if (sections.length === 1) sections[0].props = Object.assign({}, sections[0].props, { type: undefined });
    return {
      sections,
      defaults: { font: d.fonts.body, size: d.sizes.body, display: d.fonts.display, accent: d.accent, color: INK },
      footer: footerBlocks(material, 'student', usableWidth(M_DOC)),
      title: material.title + (material.variantLabel ? ' — ' + material.variantLabel : ''), description: 'Student version — ' + d.label + (material.variantLabel ? ' — ' + material.variantLabel : ''), creator: 'LRMaster',
    };
  }
  function buildStudent(material, variantKey) { return docx.build(studentSpec(material, variantKey)); }

  /** Teacher version: metadata, full script/text, vocabulary, key, quality report. */
  function teacherSpec(material) {
    const ctx = context(material, { highlight: material.settings.highlightVocab ? (material.plan.vocabulary || []).filter(v => (material.vocabFound || []).includes(v.word)) : null, numbered: material.kind === 'reading' });
    const d = ctx.d;
    const wsCtx = Object.assign({}, ctx, { W: usableWidth(M_DOC), margins: M_DOC });
    // same order as the lesson: what happens before the text stands before it
    const head = teacherHeadBlocks(wsCtx)
      .concat(material.worksheet && (material.worksheet.preTasks || []).length ? [SP(14)].concat(preTaskTableBlocks(wsCtx, 'pre')) : [])
      .concat([SP(14)]).concat(vocabBlocks(wsCtx))
      .concat(material.glossary && material.glossary.length ? [SP(14)].concat(glossaryBlocks(wsCtx)) : []);
    const body = material.kind === 'listening' ? scriptBlocks(wsCtx) : textBlocks(ctx);
    const rest = (material.worksheet ? keyBlocks(wsCtx) : [])
      .concat(material.worksheet && (material.worksheet.postTasks || []).length ? [SP(14)].concat(preTaskTableBlocks(wsCtx, 'post')) : [])
      .concat(levelBlocks(wsCtx))
      .concat(creditBlocks(wsCtx))
      .concat(qualityBlocks(wsCtx));
    const sections = [
      { blocks: head, props: { margins: M_DOC, type: 'nextPage' } },
      { blocks: body, props: { margins: material.kind === 'reading' ? ctx.margins : M_DOC, cols: material.kind === 'reading' ? d.page.cols : 1, colSep: d.page.colSep, type: 'nextPage' } },
      { blocks: rest, props: { margins: M_DOC } },
    ];
    return {
      sections,
      defaults: { font: d.fonts.body, size: d.sizes.body, display: d.fonts.display, accent: d.accent, color: INK },
      footer: footerBlocks(material, 'teacher', usableWidth(M_DOC)),
      title: material.title + ' (teacher version)', description: 'Teacher version — ' + d.label, creator: 'LRMaster',
    };
  }
  function buildTeacher(material) { return docx.build(teacherSpec(material)); }

  function slug(s) {
    return String(s || 'material').toLowerCase()
      .replace(/[\u00E4\u00E0\u00E2]/g, 'a').replace(/[\u00F6\u00F4]/g, 'o').replace(/[\u00FC\u00FB]/g, 'u').replace(/\u00DF/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'material';
  }
  function filename(material, which, variantKey) { return slug(material.title) + '-' + which + (variantKey ? '-niveau-' + String(variantKey).toLowerCase() : '') + '.docx'; }

  /** The same documents as package parts — used by the Word-export checks. */
  function partsFor(material, which, variantKey) {
    const spec = which === 'teacher' ? teacherSpec(material) : studentSpec(material, variantKey);
    return docx.buildParts(spec);
  }

  return {
    DESIGNS, designFor, context, textBlocks, scriptBlocks, worksheetBlocks, keyBlocks,
    buildStudent, buildTeacher, partsFor, filename, slug, isHeadingLike, answerText,
  };
});
