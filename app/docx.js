/*
 * LRMaster docx — a minimal, dependency-free .docx writer.
 * Produces real WordprocessingML (paragraphs, runs, tables, sections,
 * columns, drop caps, page-number fields) and packs it into a ZIP with
 * stored entries. Pure functions: runs in the browser and in Node, so the
 * export is covered by the test suite.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LR = root.LR || {}; root.LR.docx = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* ZIP (stored, no compression — Word reads these natively)             */
  /* ------------------------------------------------------------------ */

  const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; }
    return t;
  })();
  function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  }
  const encoder = new TextEncoder();
  function toBytes(v) { return v instanceof Uint8Array ? v : encoder.encode(String(v)); }

  /* Fixed timestamp so the same material always produces the same file. */
  const DOS_TIME = 0;
  const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

  /** files: [{name, data}] — returns a Uint8Array holding the ZIP. */
  function zipStore(files) {
    const entries = files.map(f => {
      const name = encoder.encode(f.name);
      const data = toBytes(f.data);
      return { name, data, crc: crc32(data) };
    });
    let total = 0;
    for (const e of entries) total += 30 + e.name.length + e.data.length + 46 + e.name.length;
    total += 22;
    const out = new Uint8Array(total);
    const view = new DataView(out.buffer);
    let off = 0;
    const offsets = [];
    for (const e of entries) {
      offsets.push(off);
      view.setUint32(off, 0x04034b50, true);
      view.setUint16(off + 4, 20, true);        // version needed
      view.setUint16(off + 6, 0x0800, true);    // UTF-8 names
      view.setUint16(off + 8, 0, true);         // method: stored
      view.setUint16(off + 10, DOS_TIME, true);
      view.setUint16(off + 12, DOS_DATE, true);
      view.setUint32(off + 14, e.crc, true);
      view.setUint32(off + 18, e.data.length, true);
      view.setUint32(off + 22, e.data.length, true);
      view.setUint16(off + 26, e.name.length, true);
      view.setUint16(off + 28, 0, true);
      off += 30;
      out.set(e.name, off); off += e.name.length;
      out.set(e.data, off); off += e.data.length;
    }
    const cdStart = off;
    entries.forEach((e, i) => {
      view.setUint32(off, 0x02014b50, true);
      view.setUint16(off + 4, 20, true);
      view.setUint16(off + 6, 20, true);
      view.setUint16(off + 8, 0x0800, true);
      view.setUint16(off + 10, 0, true);
      view.setUint16(off + 12, DOS_TIME, true);
      view.setUint16(off + 14, DOS_DATE, true);
      view.setUint32(off + 16, e.crc, true);
      view.setUint32(off + 20, e.data.length, true);
      view.setUint32(off + 24, e.data.length, true);
      view.setUint16(off + 28, e.name.length, true);
      view.setUint16(off + 30, 0, true);
      view.setUint16(off + 32, 0, true);
      view.setUint16(off + 34, 0, true);
      view.setUint16(off + 36, 0, true);
      view.setUint32(off + 38, 0, true);
      view.setUint32(off + 42, offsets[i], true);
      off += 46;
      out.set(e.name, off); off += e.name.length;
    });
    view.setUint32(off, 0x06054b50, true);
    view.setUint16(off + 4, 0, true);
    view.setUint16(off + 6, 0, true);
    view.setUint16(off + 8, entries.length, true);
    view.setUint16(off + 10, entries.length, true);
    view.setUint32(off + 12, off - cdStart, true);
    view.setUint32(off + 16, cdStart, true);
    view.setUint16(off + 20, 0, true);
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Units & escaping                                                     */
  /* ------------------------------------------------------------------ */

  const pt = v => Math.round(Number(v) * 20);          // points → twips
  const cm = v => Math.round(Number(v) * 567);         // centimetres → twips
  const halfPt = v => Math.round(Number(v) * 2);       // points → half-points

  /* Characters XML forbids, built without literal control bytes in the source. */
  const CONTROL_CHARS = new RegExp('[' + '\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F' + ']', 'g');

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(CONTROL_CHARS, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  /* ------------------------------------------------------------------ */
  /* Runs                                                                 */
  /* ------------------------------------------------------------------ */

  /** Character formatting, emitted in schema order. */
  function rPr(p) {
    if (!p) return '';
    const x = [];
    if (p.font) x.push(`<w:rFonts w:ascii="${esc(p.font)}" w:hAnsi="${esc(p.font)}" w:cs="${esc(p.font)}"/>`);
    if (p.bold) x.push('<w:b/><w:bCs/>');
    if (p.italic) x.push('<w:i/><w:iCs/>');
    if (p.caps) x.push('<w:caps/>');
    if (p.smallCaps) x.push('<w:smallCaps/>');
    if (p.strike) x.push('<w:strike/>');
    if (p.color) x.push(`<w:color w:val="${esc(p.color)}"/>`);
    if (p.letterSpacing) x.push(`<w:spacing w:val="${pt(p.letterSpacing)}"/>`);
    if (p.position) x.push(`<w:position w:val="${Math.round(p.position * 2)}"/>`);
    if (p.size) x.push(`<w:sz w:val="${halfPt(p.size)}"/><w:szCs w:val="${halfPt(p.size)}"/>`);
    if (p.underline) x.push(`<w:u w:val="${p.underline === true ? 'single' : esc(p.underline)}"/>`);
    if (p.shd) x.push(`<w:shd w:val="clear" w:color="auto" w:fill="${esc(p.shd)}"/>`);
    if (p.vertAlign) x.push(`<w:vertAlign w:val="${esc(p.vertAlign)}"/>`);
    return x.length ? `<w:rPr>${x.join('')}</w:rPr>` : '';
  }

  /** One run. Newlines in `text` become line breaks; tabs become tab stops. */
  function run(text, props) {
    const pr = rPr(props);
    const body = String(text === undefined || text === null ? '' : text)
      .split('\n').map((line, i) => (i ? '<w:br/>' : '') +
        line.split('\t').map((part, j) => (j ? '<w:tab/>' : '') + (part ? `<w:t xml:space="preserve">${esc(part)}</w:t>` : '')).join(''))
      .join('');
    return `<w:r>${pr}${body}</w:r>`;
  }

  /** A field such as PAGE or NUMPAGES. */
  function field(instr, props) {
    const pr = rPr(props);
    return `<w:r>${pr}<w:fldChar w:fldCharType="begin"/></w:r>`
      + `<w:r>${pr}<w:instrText xml:space="preserve"> ${esc(instr)} </w:instrText></w:r>`
      + `<w:r>${pr}<w:fldChar w:fldCharType="separate"/></w:r>`
      + `<w:r>${pr}<w:t>1</w:t></w:r>`
      + `<w:r>${pr}<w:fldChar w:fldCharType="end"/></w:r>`;
  }

  /* ------------------------------------------------------------------ */
  /* Paragraphs                                                           */
  /* ------------------------------------------------------------------ */

  const BORDER_SIDES = ['top', 'left', 'bottom', 'right', 'between', 'bar'];
  function borders(tag, spec) {
    const x = BORDER_SIDES.filter(s => spec[s]).map(s => {
      const b = spec[s];
      return `<w:${s} w:val="${esc(b.style || 'single')}" w:sz="${b.sz === undefined ? 6 : b.sz}" w:space="${b.space === undefined ? 1 : b.space}" w:color="${esc(b.color || 'auto')}"/>`;
    });
    return x.length ? `<${tag}>${x.join('')}</${tag}>` : '';
  }

  /** Paragraph formatting, emitted in schema order. */
  function pPr(p) {
    if (!p) return '';
    const x = [];
    if (p.style) x.push(`<w:pStyle w:val="${esc(p.style)}"/>`);
    if (p.keepNext) x.push('<w:keepNext/>');
    if (p.keepLines) x.push('<w:keepLines/>');
    if (p.pageBreakBefore) x.push('<w:pageBreakBefore/>');
    if (p.dropCap) x.push(`<w:framePr w:dropCap="drop" w:lines="${p.dropCap.lines || 3}" w:hSpace="${p.dropCap.hSpace === undefined ? 57 : p.dropCap.hSpace}" w:wrap="around" w:vAnchor="text" w:hAnchor="text"/>`);
    if (p.border) x.push(borders('w:pBdr', p.border));
    if (p.shd) x.push(`<w:shd w:val="clear" w:color="auto" w:fill="${esc(p.shd)}"/>`);
    if (p.tabs) x.push(`<w:tabs>${p.tabs.map(t => `<w:tab w:val="${esc(t.type || 'left')}" w:pos="${t.pos}"${t.leader ? ` w:leader="${esc(t.leader)}"` : ''}/>`).join('')}</w:tabs>`);
    const sp = [];
    if (p.before !== undefined) sp.push(`w:before="${pt(p.before)}"`);
    if (p.after !== undefined) sp.push(`w:after="${pt(p.after)}"`);
    if (p.line !== undefined) sp.push(`w:line="${Math.round(p.line * 240)}" w:lineRule="auto"`);
    if (sp.length) x.push(`<w:spacing ${sp.join(' ')}/>`);
    const ind = [];
    if (p.left !== undefined) ind.push(`w:left="${cm(p.left)}"`);
    if (p.right !== undefined) ind.push(`w:right="${cm(p.right)}"`);
    if (p.hanging !== undefined) ind.push(`w:hanging="${cm(p.hanging)}"`);
    else if (p.firstLine !== undefined) ind.push(`w:firstLine="${cm(p.firstLine)}"`);
    if (ind.length) x.push(`<w:ind ${ind.join(' ')}/>`);
    if (p.contextualSpacing) x.push('<w:contextualSpacing/>');
    if (p.align) x.push(`<w:jc w:val="${esc(p.align)}"/>`);
    if (p.outline !== undefined) x.push(`<w:outlineLvl w:val="${p.outline}"/>`);
    if (p.mark) x.push(rPr(p.mark));
    return x.length ? `<w:pPr>${x.join('')}</w:pPr>` : '';
  }

  /**
   * A paragraph. `content` is a string, a run-props/text pair list, or raw
   * run XML produced by `run()` / `field()`.
   */
  function para(content, props) {
    props = props || {};
    let runs = '';
    if (Array.isArray(content)) runs = content.join('');
    else if (typeof content === 'string') runs = content.startsWith('<w:r') ? content : (content ? run(content, props.run) : '');
    return `<w:p>${pPr(props)}${runs}</w:p>`;
  }

  /** An empty paragraph of a given point height (spacer). */
  function spacer(size) { return para('', { after: 0, mark: { size: size || 6 } }); }

  /* ------------------------------------------------------------------ */
  /* Tables                                                               */
  /* ------------------------------------------------------------------ */

  function tcPr(c) {
    const x = [];
    if (c.width) x.push(`<w:tcW w:w="${c.width}" w:type="${c.widthType || 'dxa'}"/>`);
    else x.push('<w:tcW w:w="0" w:type="auto"/>');
    if (c.gridSpan) x.push(`<w:gridSpan w:val="${c.gridSpan}"/>`);
    if (c.borders) x.push(borders('w:tcBorders', c.borders));
    if (c.shd) x.push(`<w:shd w:val="clear" w:color="auto" w:fill="${esc(c.shd)}"/>`);
    if (c.margins) x.push(`<w:tcMar>${['top', 'left', 'bottom', 'right'].filter(s => c.margins[s] !== undefined).map(s => `<w:${s} w:w="${cm(c.margins[s])}" w:type="dxa"/>`).join('')}</w:tcMar>`);
    if (c.valign) x.push(`<w:vAlign w:val="${esc(c.valign)}"/>`);
    return `<w:tcPr>${x.join('')}</w:tcPr>`;
  }

  /**
   * table({ cols: [twips…], rows: [{cells: [{blocks|text, …}], header, height}],
   *         borders, shd, cellMargin, indent, align })
   */
  function table(spec) {
    const x = [];
    x.push(`<w:tblW w:w="${spec.width === undefined ? 5000 : spec.width}" w:type="${spec.widthType || 'pct'}"/>`);
    if (spec.align) x.push(`<w:jc w:val="${esc(spec.align)}"/>`);
    if (spec.indent) x.push(`<w:tblInd w:w="${cm(spec.indent)}" w:type="dxa"/>`);
    x.push(borders('w:tblBorders', spec.borders || { top: { style: 'none', sz: 0 }, left: { style: 'none', sz: 0 }, bottom: { style: 'none', sz: 0 }, right: { style: 'none', sz: 0 }, insideH: { style: 'none', sz: 0 } }));
    if (spec.shd) x.push(`<w:shd w:val="clear" w:color="auto" w:fill="${esc(spec.shd)}"/>`);
    x.push('<w:tblLayout w:type="fixed"/>');
    const m = spec.cellMargin || { top: 0.1, left: 0.15, bottom: 0.1, right: 0.15 };
    x.push(`<w:tblCellMar>${['top', 'left', 'bottom', 'right'].map(s => `<w:${s} w:w="${cm(m[s] === undefined ? 0 : m[s])}" w:type="dxa"/>`).join('')}</w:tblCellMar>`);
    const grid = (spec.cols || []).map(w => `<w:gridCol w:w="${w}"/>`).join('');
    const rows = (spec.rows || []).map(r => {
      const trPr = [];
      if (r.cantSplit !== false) trPr.push('<w:cantSplit/>');
      if (r.height) trPr.push(`<w:trHeight w:val="${cm(r.height)}" w:hRule="atLeast"/>`);
      if (r.header) trPr.push('<w:tblHeader/>');
      const cells = (r.cells || []).map((c, i) => {
        const cell = Object.assign({ width: (spec.cols || [])[i] }, c);
        const blocks = c.blocks && c.blocks.length ? c.blocks.join('') : para(c.text === undefined ? '' : c.text, c.props || {});
        return `<w:tc>${tcPr(cell)}${blocks}</w:tc>`;
      }).join('');
      return `<w:tr>${trPr.length ? `<w:trPr>${trPr.join('')}</w:trPr>` : ''}${cells}</w:tr>`;
    }).join('');
    return `<w:tbl><w:tblPr>${x.join('')}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
  }

  /* insideH / insideV need to be part of the border serialisation. */
  BORDER_SIDES.push('insideH', 'insideV');

  /* ------------------------------------------------------------------ */
  /* Sections                                                             */
  /* ------------------------------------------------------------------ */

  const A4 = { w: 11906, h: 16838 };

  function sectPr(s, opts) {
    s = s || {};
    const x = [];
    if (opts && opts.footer) x.push('<w:footerReference w:type="default" r:id="rId7"/>');
    if (s.type) x.push(`<w:type w:val="${esc(s.type)}"/>`);
    const page = s.landscape ? `<w:pgSz w:w="${A4.h}" w:h="${A4.w}" w:orient="landscape"/>` : `<w:pgSz w:w="${A4.w}" w:h="${A4.h}"/>`;
    x.push(page);
    const m = s.margins || { top: 2.2, right: 2.2, bottom: 2.2, left: 2.2 };
    x.push(`<w:pgMar w:top="${cm(m.top)}" w:right="${cm(m.right)}" w:bottom="${cm(m.bottom)}" w:left="${cm(m.left)}" w:header="${cm(1.2)}" w:footer="${cm(1.2)}" w:gutter="0"/>`);
    if (s.cols && s.cols > 1) x.push(`<w:cols w:num="${s.cols}" w:space="${cm(s.colSpace || 0.7)}" w:equalWidth="1"${s.colSep ? ' w:sep="1"' : ''}/>`);
    else x.push('<w:cols w:space="708"/>');
    x.push('<w:docGrid w:linePitch="360"/>');
    return `<w:sectPr>${x.join('')}</w:sectPr>`;
  }

  /* ------------------------------------------------------------------ */
  /* Package                                                              */
  /* ------------------------------------------------------------------ */

  const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  function stylesXml(def) {
    const font = esc(def.font || 'Calibri');
    const size = halfPt(def.size || 11);
    const heading = (id, name, lvl, sz, color, f) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${pt(10)}" w:after="${pt(4)}"/><w:outlineLvl w:val="${lvl}"/></w:pPr><w:rPr><w:rFonts w:ascii="${esc(f)}" w:hAnsi="${esc(f)}"/><w:b/><w:color w:val="${esc(color)}"/><w:sz w:val="${halfPt(sz)}"/></w:rPr></w:style>`;
    return XML_DECL + `<w:styles ${NS}>`
      + `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:color w:val="${esc(def.color || '1A1A1A')}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="en-GB"/></w:rPr></w:rPrDefault>`
      + `<w:pPrDefault><w:pPr><w:spacing w:after="${pt(6)}" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
      + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
      + heading('Heading1', 'heading 1', 0, (def.size || 11) + 5, def.accent || '1A1A1A', def.display || def.font || 'Calibri')
      + heading('Heading2', 'heading 2', 1, (def.size || 11) + 2, def.accent || '1A1A1A', def.display || def.font || 'Calibri')
      + heading('Heading3', 'heading 3', 2, (def.size || 11) + 1, def.accent || '1A1A1A', def.display || def.font || 'Calibri')
      + '</w:styles>';
  }

  function coreXml(meta) {
    return XML_DECL + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + `<dc:title>${esc(meta.title || '')}</dc:title>`
      + `<dc:creator>${esc(meta.creator || 'LRMaster')}</dc:creator>`
      + `<cp:lastModifiedBy>${esc(meta.creator || 'LRMaster')}</cp:lastModifiedBy>`
      + `<dc:description>${esc(meta.description || '')}</dc:description>`
      + '<dcterms:created xsi:type="dcterms:W3CDTF">2020-01-01T00:00:00Z</dcterms:created>'
      + '<dcterms:modified xsi:type="dcterms:W3CDTF">2020-01-01T00:00:00Z</dcterms:modified>'
      + '</cp:coreProperties>';
  }

  /**
   * buildParts({ sections: [{blocks, props}], defaults, footer, title, description })
   * Returns the package parts as [{name, data}]; `build` zips them.
   * Each section but the last ends with a section-break paragraph.
   */
  function buildParts(spec) {
    const defaults = spec.defaults || {};
    const sections = spec.sections && spec.sections.length ? spec.sections : [{ blocks: spec.blocks || [], props: {} }];
    const hasFooter = !!(spec.footer && spec.footer.length);
    const parts = [];
    sections.forEach((s, i) => {
      parts.push((s.blocks || []).join(''));
      if (i < sections.length - 1) parts.push(`<w:p><w:pPr>${sectPr(s.props, { footer: hasFooter })}</w:pPr></w:p>`);
    });
    const last = sections[sections.length - 1];
    const document = XML_DECL + `<w:document ${NS}><w:body>${parts.join('')}${sectPr(last.props, { footer: hasFooter })}</w:body></w:document>`;

    const rels = [
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    ];
    if (hasFooter) rels.push('<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>');

    const files = [
      { name: '[Content_Types].xml', data: XML_DECL + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        + (hasFooter ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '')
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        + '</Types>' },
      { name: '_rels/.rels', data: XML_DECL + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        + '</Relationships>' },
      { name: 'docProps/core.xml', data: coreXml({ title: spec.title, description: spec.description, creator: spec.creator }) },
      { name: 'word/document.xml', data: document },
      { name: 'word/styles.xml', data: stylesXml(defaults) },
      { name: 'word/_rels/document.xml.rels', data: XML_DECL + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>` },
    ];
    if (hasFooter) files.push({ name: 'word/footer1.xml', data: XML_DECL + `<w:ftr ${NS}>${spec.footer.join('')}</w:ftr>` });
    return files;
  }

  /** The finished .docx as bytes. */
  function build(spec) { return zipStore(buildParts(spec)); }

  return { zipStore, crc32, esc, pt, cm, halfPt, run, field, para, spacer, table, sectPr, build, buildParts, rPr, pPr, borders, A4 };
});
