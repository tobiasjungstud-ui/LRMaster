/*
 * LRMaster ooxml — a validator for the Word packages this app writes.
 * Word rejects a document whose elements are out of schema order or whose
 * package references do not resolve, so the export is checked here instead of
 * being taken on trust: the same validator runs in `npm test` and on the
 * Konzept-Check page.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LR = root.LR || {}; root.LR.ooxml = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Tiny XML parser (no DOM needed, works in Node and the browser)       */
  /* ------------------------------------------------------------------ */

  const TAG = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*(\/?)>|<\/([A-Za-z_][\w.:-]*)\s*>/g;
  const ATTR = /([\w.:-]+)\s*=\s*"([^"]*)"/g;

  function parse(xml) {
    const src = String(xml);
    const root = { name: '#root', attrs: {}, children: [], text: '' };
    const stack = [root];
    let last = 0, m;
    TAG.lastIndex = 0;
    while ((m = TAG.exec(src))) {
      const between = src.slice(last, m.index);
      if (between.trim()) stack[stack.length - 1].text += between;
      last = TAG.lastIndex;
      if (m[0][1] === '?' || m[0][1] === '!') continue;
      if (m[1]) {
        const node = { name: m[1], attrs: {}, children: [], text: '' };
        let a;
        ATTR.lastIndex = 0;
        while ((a = ATTR.exec(m[2] || ''))) node.attrs[a[1]] = a[2];
        stack[stack.length - 1].children.push(node);
        if (!m[3]) stack.push(node);
      } else if (m[4]) {
        const open = stack.pop();
        if (!open || open.name !== m[4]) throw new Error(`closing </${m[4]}> does not match <${open ? open.name : 'nothing'}>`);
        if (stack.length === 0) throw new Error('unbalanced document');
      }
    }
    if (stack.length !== 1) throw new Error('unclosed element <' + stack[stack.length - 1].name + '>');
    if (root.children.length !== 1) throw new Error('expected exactly one root element, found ' + root.children.length);
    return root.children[0];
  }

  function walk(node, fn) {
    fn(node);
    for (const c of node.children) walk(c, fn);
  }

  /* ------------------------------------------------------------------ */
  /* Schema child order (ECMA-376, the parts this writer emits)           */
  /* ------------------------------------------------------------------ */

  const ORDER = {
    'w:pPr': ['w:pStyle', 'w:keepNext', 'w:keepLines', 'w:pageBreakBefore', 'w:framePr', 'w:widowControl', 'w:numPr', 'w:suppressLineNumbers', 'w:pBdr', 'w:shd', 'w:tabs', 'w:spacing', 'w:ind', 'w:contextualSpacing', 'w:jc', 'w:outlineLvl', 'w:rPr', 'w:sectPr'],
    'w:rPr': ['w:rStyle', 'w:rFonts', 'w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:caps', 'w:smallCaps', 'w:strike', 'w:color', 'w:spacing', 'w:w', 'w:kern', 'w:position', 'w:sz', 'w:szCs', 'w:highlight', 'w:u', 'w:shd', 'w:vertAlign', 'w:lang'],
    'w:tblPr': ['w:tblStyle', 'w:tblpPr', 'w:tblOverlap', 'w:bidiVisual', 'w:tblW', 'w:jc', 'w:tblCellSpacing', 'w:tblInd', 'w:tblBorders', 'w:shd', 'w:tblLayout', 'w:tblCellMar', 'w:tblLook'],
    'w:tcPr': ['w:cnfStyle', 'w:tcW', 'w:gridSpan', 'w:hMerge', 'w:vMerge', 'w:tcBorders', 'w:shd', 'w:noWrap', 'w:tcMar', 'w:textDirection', 'w:tcFitText', 'w:vAlign', 'w:hideMark'],
    'w:trPr': ['w:cnfStyle', 'w:divId', 'w:gridBefore', 'w:gridAfter', 'w:wBefore', 'w:wAfter', 'w:cantSplit', 'w:trHeight', 'w:tblHeader', 'w:tblCellSpacing', 'w:jc', 'w:hidden'],
    'w:sectPr': ['w:headerReference', 'w:footerReference', 'w:footnotePr', 'w:endnotePr', 'w:type', 'w:pgSz', 'w:pgMar', 'w:paperSrc', 'w:pgBorders', 'w:lnNumType', 'w:pgNumType', 'w:cols', 'w:formProt', 'w:vAlign', 'w:noEndnote', 'w:titlePg', 'w:textDirection', 'w:bidi', 'w:rtlGutter', 'w:docGrid'],
    'w:pBdr': ['w:top', 'w:left', 'w:bottom', 'w:right', 'w:between', 'w:bar'],
    'w:tblBorders': ['w:top', 'w:left', 'w:bottom', 'w:right', 'w:insideH', 'w:insideV'],
    'w:tcBorders': ['w:top', 'w:left', 'w:bottom', 'w:right', 'w:insideH', 'w:insideV', 'w:tl2br', 'w:tr2bl'],
    'w:tblCellMar': ['w:top', 'w:left', 'w:bottom', 'w:right'],
    'w:tcMar': ['w:top', 'w:left', 'w:bottom', 'w:right'],
    'w:styles': ['w:docDefaults', 'w:latentStyles', 'w:style'],
    'w:docDefaults': ['w:rPrDefault', 'w:pPrDefault'],
    'w:style': ['w:name', 'w:aliases', 'w:basedOn', 'w:next', 'w:link', 'w:autoRedefine', 'w:hidden', 'w:uiPriority', 'w:semiHidden', 'w:unhideWhenUsed', 'w:qFormat', 'w:locked', 'w:personal', 'w:rsid', 'w:pPr', 'w:rPr', 'w:tblPr'],
    'w:tbl': ['w:tblPr', 'w:tblGrid', 'w:tr'],
    'w:tr': ['w:trPr', 'w:tc'],
  };

  /** Elements whose children must follow ORDER; unknown children are reported. */
  function checkOrder(node, problems, where) {
    const allowed = ORDER[node.name];
    if (!allowed) return;
    let lastIdx = -1, lastName = '';
    for (const child of node.children) {
      const idx = allowed.indexOf(child.name);
      if (idx === -1) { problems.push(`${where}: <${child.name}> is not allowed inside <${node.name}>`); continue; }
      if (idx < lastIdx) problems.push(`${where}: <${child.name}> must come before <${lastName}> inside <${node.name}>`);
      else { lastIdx = idx; lastName = child.name; }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Package checks                                                       */
  /* ------------------------------------------------------------------ */

  const REQUIRED = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels'];

  function dirname(path) { const i = path.lastIndexOf('/'); return i < 0 ? '' : path.slice(0, i); }
  function resolve(base, target) {
    if (target.startsWith('/')) return target.slice(1);
    const parts = (base ? base.split('/') : []).concat(target.split('/'));
    const out = [];
    for (const p of parts) { if (p === '.' || p === '') continue; if (p === '..') out.pop(); else out.push(p); }
    return out.join('/');
  }

  /**
   * Validate a package given as [{name, data}]. Returns a list of problems;
   * an empty list means the document is structurally sound for Word.
   */
  function validate(parts) {
    const problems = [];
    const byName = {};
    for (const p of parts) byName[p.name] = String(p.data);
    for (const req of REQUIRED) if (!byName[req]) problems.push(`missing part ${req}`);

    const trees = {};
    for (const name of Object.keys(byName)) {
      if (!/\.(xml|rels)$/.test(name)) continue;
      try { trees[name] = parse(byName[name]); }
      catch (e) { problems.push(`${name}: malformed XML — ${e.message}`); }
    }

    // Content types cover every part.
    const ct = trees['[Content_Types].xml'];
    if (ct) {
      const defaults = {}, overrides = {};
      for (const c of ct.children) {
        if (c.name === 'Default') defaults[String(c.attrs.Extension || '').toLowerCase()] = true;
        if (c.name === 'Override') overrides[c.attrs.PartName] = true;
      }
      for (const name of Object.keys(byName)) {
        if (name === '[Content_Types].xml') continue;
        const ext = (name.split('.').pop() || '').toLowerCase();
        if (!overrides['/' + name] && !defaults[ext]) problems.push(`${name}: no content type declared`);
      }
      for (const partName of Object.keys(overrides)) {
        if (!byName[partName.replace(/^\//, '')]) problems.push(`content types declare ${partName}, which is not in the package`);
      }
    }

    // Relationship targets resolve, and every r:id used is declared.
    for (const name of Object.keys(trees)) {
      if (!name.endsWith('.rels')) continue;
      const base = dirname(dirname(name));
      const ids = {};
      for (const rel of trees[name].children) {
        if (rel.name !== 'Relationship') continue;
        ids[rel.attrs.Id] = true;
        if ((rel.attrs.TargetMode || '') === 'External') continue;
        const target = resolve(base, rel.attrs.Target || '');
        if (!byName[target]) problems.push(`${name}: relationship ${rel.attrs.Id} points to missing part ${target}`);
      }
      const owner = name.replace(/_rels\/(.*)\.rels$/, '$1');
      const tree = trees[owner];
      if (tree) {
        walk(tree, node => {
          for (const key of Object.keys(node.attrs)) {
            if (!/^r:(id|embed|link)$/.test(key)) continue;
            if (!ids[node.attrs[key]]) problems.push(`${owner}: <${node.name}> uses ${key}="${node.attrs[key]}", which is not declared in ${name}`);
          }
        });
      }
    }

    // WordprocessingML structure.
    for (const name of ['word/document.xml', 'word/styles.xml', 'word/footer1.xml', 'word/header1.xml']) {
      const tree = trees[name];
      if (!tree) continue;
      walk(tree, node => {
        checkOrder(node, problems, name);
        if (node.name === 'w:tbl') {
          const grid = node.children.find(c => c.name === 'w:tblGrid');
          const rows = node.children.filter(c => c.name === 'w:tr');
          if (!node.children.some(c => c.name === 'w:tblPr')) problems.push(`${name}: <w:tbl> without <w:tblPr>`);
          if (!grid) problems.push(`${name}: <w:tbl> without <w:tblGrid>`);
          if (!rows.length) problems.push(`${name}: <w:tbl> without rows`);
          const gridCols = grid ? grid.children.filter(c => c.name === 'w:gridCol').length : 0;
          for (const tr of rows) {
            const cells = tr.children.filter(c => c.name === 'w:tc');
            if (!cells.length) problems.push(`${name}: <w:tr> without cells`);
            const span = cells.reduce((a, c) => {
              const pr = c.children.find(x => x.name === 'w:tcPr');
              const gs = pr && pr.children.find(x => x.name === 'w:gridSpan');
              return a + (gs ? Number(gs.attrs['w:val']) || 1 : 1);
            }, 0);
            if (gridCols && span > gridCols) problems.push(`${name}: row has ${span} cells but the grid declares ${gridCols} columns`);
            for (const tc of cells) {
              const content = tc.children.filter(c => c.name !== 'w:tcPr');
              if (!content.length) problems.push(`${name}: empty <w:tc> (a cell needs at least one paragraph)`);
              else if (content[content.length - 1].name !== 'w:p') problems.push(`${name}: <w:tc> must end with a <w:p>, found <${content[content.length - 1].name}>`);
            }
          }
        }
        if (node.name === 'w:p') {
          node.children.forEach((c, i) => {
            if (c.name === 'w:pPr' && i !== 0) problems.push(`${name}: <w:pPr> must be the first child of <w:p>`);
          });
        }
        if (node.name === 'w:r') {
          node.children.forEach((c, i) => {
            if (c.name === 'w:rPr' && i !== 0) problems.push(`${name}: <w:rPr> must be the first child of <w:r>`);
          });
        }
      });
      if (name === 'word/document.xml') {
        if (tree.name !== 'w:document') problems.push('word/document.xml: root element is not <w:document>');
        const body = tree.children.find(c => c.name === 'w:body');
        if (!body) problems.push('word/document.xml: no <w:body>');
        else {
          const last = body.children[body.children.length - 1];
          if (!last || last.name !== 'w:sectPr') problems.push('word/document.xml: <w:body> must end with <w:sectPr>');
          if (!body.children.some(c => c.name === 'w:p' || c.name === 'w:tbl')) problems.push('word/document.xml: document has no content');
        }
      }
    }
    return problems;
  }

  /** All text of a package part, tags removed — used to assert what a document contains. */
  function textOf(parts, partName) {
    const part = parts.find(p => p.name === (partName || 'word/document.xml'));
    if (!part) return '';
    const out = [];
    walk(parse(String(part.data)), n => { if (n.text) out.push(n.text); });
    return out.join(' ')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }

  return { parse, walk, validate, textOf, ORDER, REQUIRED };
});
