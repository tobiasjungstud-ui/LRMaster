/*
 * LRMaster render — builds the Student Version and the Teacher Version
 * (concept §28) as HTML strings from a material object. Pure functions so the
 * concept checks can render a fixture and verify what each version contains.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./quality.js'));
  else { root.LR = root.LR || {}; root.LR.render = factory(root.LR.core, root.LR.quality); }
})(typeof self !== 'undefined' ? self : this, function (core, quality) {
  'use strict';

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /** Deterministic shuffle (seeded by the material id) so reprints stay stable. */
  function seededShuffle(arr, seed) {
    let h = 2166136261;
    for (const ch of String(seed || 'lr')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      const j = h % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function skillLabel(k) { const s = core.SKILLS.find(x => x.key === k); return s ? s.label : k; }
  function formatLabel(k) { const f = core.QUESTION_FORMATS.find(x => x.key === k); return f ? f.label : k; }
  function hoLabel(k) { const t = core.HIGHER_ORDER_TYPES.find(x => x.key === k); return t ? t.label : k; }
  function preLabel(k) { const t = core.PRE_TASK_TYPES.find(x => x.key === k); return t ? t.label : k; }
  function postLabel(k) { const t = core.POST_TASK_TYPES.find(x => x.key === k); return t ? t.label : k; }

  /** Wrap occurrences of target vocabulary in <mark>. */
  function highlight(text, items) {
    return quality.highlightSegments(text, items)
      .map(seg => seg.hit ? `<mark class="vocab">${esc(seg.text)}</mark>` : esc(seg.text))
      .join('');
  }

  /* ------------------------------------------------------------------ */
  /* The reading text, in the layout of its text type                     */
  /* ------------------------------------------------------------------ */

  function isHeadingLike(t) {
    const x = String(t || '').trim();
    return x.length > 0 && x.length <= 70 && x.split(/\s+/).length <= 9 && !/[.!?…:;,]$/.test(x) && !/^["“'(]/.test(x);
  }

  function metaLine(parts) {
    const line = parts.filter(Boolean).map(esc).join(' <span class="dot">·</span> ');
    return line ? `<p class="doc-meta">${line}</p>` : '';
  }

  /** Student/teacher rendering of the reading text with its document details. */
  function renderTextHTML(m, opts) {
    opts = opts || {};
    const design = core.designIdFor(m.settings);
    const meta = (m.content && m.content.meta) || {};
    const paragraphs = (m.content && m.content.paragraphs) || [];
    const items = opts.highlight || null;
    const body = (t) => (items ? highlight(t, items) : esc(t));
    const num = (i) => (opts.numbered ? `<span class="para-no">¶${i + 1}</span>` : '');
    const headings = ['article', 'blog', 'report', 'informational', 'custom'].includes(design);
    let html = `<div class="doc" data-design="${esc(design)}">`;

    if (design === 'email') {
      html += '<table class="mail-head"><tbody>'
        + [['From', meta.from], ['To', meta.to], ['Subject', meta.subject], ['Sent', meta.sent]]
          .filter(r => r[1]).map(r => `<tr><th>${r[0]}</th><td${r[0] === 'Subject' ? ' class="subject"' : ''}>${esc(r[1])}</td></tr>`).join('')
        + '</tbody></table>';
      html += paragraphs.map((p, i) => `<p>${num(i)}${body(p)}</p>`).join('');
      if (meta.signature) html += `<p class="signature">${esc(meta.signature).replace(/\n/g, '<br>')}</p>`;
    } else if (design === 'forum') {
      html += `<div class="thread-bar"><strong>${esc(meta.threadTitle || m.content.title)}</strong><span>${esc(meta.forumName || '')}</span></div>`;
      html += paragraphs.map((p, i) => `<article class="post"><header><span class="user">${esc((meta.authors || [])[i] || 'user_' + (i + 1))}</span><span class="time">${esc((meta.timestamps || [])[i] || '')}</span></header><p>${num(i)}${body(p)}</p></article>`).join('');
    } else if (design === 'interview' || design === 'dialogue') {
      if (design === 'interview') {
        html += `<h3 class="doc-title">${esc(m.content.title)}</h3>`;
        if (meta.standfirst) html += `<p class="standfirst">${esc(meta.standfirst)}</p>`;
        html += metaLine([meta.publication, meta.byline ? 'Interview: ' + meta.byline : '']);
      } else {
        html += `<h3 class="doc-title">${esc(m.content.title)}</h3>`;
        if (meta.setting) html += `<p class="standfirst">${esc(meta.setting)}</p>`;
      }
      html += paragraphs.map((p, i) => {
        const who = (meta.speakers || [])[i] || (design === 'interview' ? (i % 2 ? 'Guest' : 'Interviewer') : 'Speaker ' + String.fromCharCode(65 + (i % 2)));
        return `<p class="turn">${num(i)}<span class="who">${esc(who)}</span>${body(p)}</p>`;
      }).join('');
    } else {
      const kicker = meta.publication || meta.blogName || meta.category || (design === 'opinion' ? 'Opinion' : '');
      if (kicker) html += `<p class="kicker">${esc(kicker)}</p>`;
      html += `<h3 class="doc-title">${esc(m.content.title)}</h3>`;
      if (meta.subtitle) html += `<p class="standfirst">${esc(meta.subtitle)}</p>`;
      if (meta.standfirst) html += `<p class="standfirst">${esc(meta.standfirst)}</p>`;
      if (meta.rating !== undefined) html += `<p class="rating" aria-label="${esc(meta.rating)} of 5">${'★'.repeat(Math.max(0, Math.min(5, meta.rating)))}<span class="dim">${'★'.repeat(Math.max(0, 5 - meta.rating))}</span></p>`;
      html += metaLine([meta.byline ? (design === 'review' ? 'Reviewed by ' + meta.byline : 'By ' + meta.byline) : '', meta.author, meta.recipient ? 'For: ' + meta.recipient : '', meta.dateline, meta.place, meta.readingTime]);
      if (meta.summary) html += `<div class="callout"><h4>Summary</h4><p>${esc(meta.summary)}</p></div>`;
      const pullAt = meta.pullQuote ? Math.min(2, Math.max(1, Math.floor(paragraphs.length / 2))) : -1;
      paragraphs.forEach((p, i) => {
        if (i === pullAt) html += `<blockquote class="pull">${esc(meta.pullQuote)}</blockquote>`;
        if (headings && isHeadingLike(p)) { html += `<h4 class="doc-h">${num(i)}${esc(p)}</h4>`; return; }
        const lead = design === 'news' && i === 0 && meta.location ? `<span class="location">${esc(meta.location)} — </span>` : '';
        html += `<p class="doc-p">${num(i)}${lead}${body(p)}</p>`;
      });
      if (meta.factBox && meta.factBox.length) html += `<div class="callout"><h4>Did you know?</h4><ul>${meta.factBox.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
      if (meta.verdict) html += `<div class="callout verdict"><h4>Verdict</h4><p>${esc(meta.verdict)}</p></div>`;
      if (meta.tags && meta.tags.length) html += `<p class="tags">${meta.tags.map(t => `<span>#${esc(t)}</span>`).join('')}</p>`;
      if (meta.source) html += `<p class="source">Source: ${esc(meta.source)}</p>`;
    }
    return html + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Question bodies                                                      */
  /* ------------------------------------------------------------------ */

  function questionBody(q, opts) {
    const seed = (opts.seed || '') + ':' + q.n;
    let html = '';
    const promptText = q.prompt || q.statement || '';
    if (promptText) html += `<p class="q-prompt">${esc(promptText)}</p>`;
    if (q.statement && q.prompt && q.statement !== q.prompt) html += `<p class="q-statement">“${esc(q.statement)}”</p>`;
    switch (q.format) {
      case 'multiple_choice':
      case 'best_summary':
      case 'select_all':
        html += '<ol class="options" type="A">' + (q.options || []).map(o => `<li>${esc(String(o).replace(/^[A-E][).:]\s*/, ''))}</li>`).join('') + '</ol>';
        break;
      case 'true_false':
        html += '<p class="tf">☐ True &nbsp; ☐ False</p>';
        break;
      case 'true_false_correction':
        html += '<p class="tf">☐ True &nbsp; ☐ False &nbsp; Correction: ______________________________</p>';
        break;
      case 'who_said_it':
        html += '<p class="options-inline">' + (q.options || []).map(o => `☐ ${esc(o)}`).join(' &nbsp; ') + '</p>';
        break;
      case 'matching': {
        const items = q.items || [];
        const rights = seededShuffle(items.map(i => i.right), seed);
        html += '<div class="table-wrap"><table class="matching"><tbody>' + items.map((it, i) => `<tr><td>${i + 1}. ${esc(it.left)}</td><td class="blank">___</td><td>${String.fromCharCode(97 + i)}) ${esc(rights[i])}</td></tr>`).join('') + '</tbody></table></div>';
        break;
      }
      case 'ordering': {
        const items = seededShuffle(q.items || [], seed);
        html += '<ol class="ordering">' + items.map(it => `<li>___ ${esc(typeof it === 'string' ? it : JSON.stringify(it))}</li>`).join('') + '</ol>';
        break;
      }
      case 'table_completion': {
        const t = q.table || {};
        html += '<div class="table-wrap"><table class="completion"><thead><tr>' + (t.headers || []).map(h => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>' + (t.rows || []).map(r => '<tr>' + (r || []).map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
        break;
      }
      case 'gap_fill':
      case 'note_taking':
        html += '<div class="answer-lines">' + (Array.isArray(q.answer) ? q.answer.map((_, i) => `<p>${i + 1}. ______________________</p>`).join('') : '<p>______________________</p>') + '</div>';
        break;
      default:
        html += '<p class="answer-line">_________________________________________________</p>';
    }
    return html;
  }

  function answerText(q) {
    if (q.format === 'matching') return (q.items || []).map(it => `${esc(it.left)} → ${esc(it.right)}`).join('; ');
    if (q.format === 'ordering') return (q.items || []).map((it, i) => `${i + 1}. ${esc(typeof it === 'string' ? it : JSON.stringify(it))}`).join(' ');
    if (Array.isArray(q.answer)) return q.answer.map(esc).join(', ');
    if (q.answer && typeof q.answer === 'object') return esc(JSON.stringify(q.answer));
    let a = esc(q.answer);
    if (q.format === 'true_false_correction' && q.correction) a += ` — ${esc(q.correction)}`;
    if (q.acceptable && q.acceptable.length) a += ` <span class="muted">(also: ${q.acceptable.map(esc).join('; ')})</span>`;
    return a;
  }

  function socialLabel(k) { const f = core.SOCIAL_FORMS.find(x => x.key === k); return f ? f.label : k; }
  function socialEn(k) { const f = core.SOCIAL_FORMS.find(x => x.key === k); return f ? f.en : k; }
  function modeLabel(k) { const m = core.PRE_TASK_MODES.find(x => x.key === k); return m ? m.label : k; }

  function preTaskHtml(p, teacher, phase) {
    const badges = [
      p.socialForm ? `<span class="badge social ${esc(p.socialForm)}">${esc(socialLabel(p.socialForm))} · ${esc(socialEn(p.socialForm))}</span>` : '',
      p.mode ? `<span class="badge mode ${esc(p.mode)}">${p.mode === 'oral' ? '🗣 ' : '✎ '}${esc(modeLabel(p.mode))}</span>` : '',
      p.minutes ? `<span class="badge time">${p.minutes} min</span>` : '',
    ].filter(Boolean).join('');
    const isPost = phase === 'post';
    let html = `<section class="pretask${isPost ? ' posttask' : ''}" data-mode="${esc(p.mode || 'written')}"><h3>${p.n ? esc(String(p.n)) + '. ' : ''}${esc(isPost ? postLabel(p.type) : preLabel(p.type))}${p.title ? ': ' + esc(p.title) : ''}</h3>`;
    if (badges) html += `<p class="pretask-meta">${badges}</p>`;
    html += `<p>${esc(p.prompt)}</p>`;
    if (p.items && p.items.length) html += '<ul class="pretask-items">' + p.items.map(i => `<li>${esc(i)}</li>`).join('') + '</ul>';
    if (p.mode !== 'oral') html += '<p class="answer-line">_________________________________________________</p><p class="answer-line">_________________________________________________</p>';
    if (p.product) html += `<p class="product"><strong>Result:</strong> ${esc(p.product)}</p>`;
    if (p.criteria && p.criteria.length) html += '<div class="criteria"><h4>Success criteria</h4><ul>' + p.criteria.map(c => `<li>${esc(c)}</li>`).join('') + '</ul></div>';
    if (teacher) {
      if (p.reference) html += `<p class="teacher-note">Starts from: “${esc(p.reference)}”</p>`;
      if (p.vocabUsed && p.vocabUsed.length) html += `<p class="teacher-note">Target words used: ${p.vocabUsed.map(esc).join(', ')}</p>`;
      if (p.materials) html += `<p class="teacher-note">Material: ${esc(p.materials)}</p>`;
      if (p.teacherNote) html += `<p class="teacher-note">Teacher note: ${esc(p.teacherNote)}</p>`;
    }
    html += '</section>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /* Student version (concept §28)                                        */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Worksheet variants (Niveau A / B), glossary, script appendix, meter  */
  /* ------------------------------------------------------------------ */

  /** The worksheet variants of a material: the named ones, or the single unnamed worksheet. */
  function variantsOf(m) {
    if (Array.isArray(m.variants) && m.variants.length) return m.variants;
    return [{ key: null, label: '', plan: m.plan, worksheet: m.worksheet, quality: m.quality }];
  }
  /** A view of the material with one variant's worksheet and plan in place. */
  function forVariant(m, key) {
    const vs = variantsOf(m);
    const v = (key ? vs.find(x => x.key === key) : null) || vs[0];
    if (!v || v.worksheet === m.worksheet) return Object.assign({}, m, { variant: v ? v.key : null, variantLabel: v ? v.label : '' });
    return Object.assign({}, m, { worksheet: v.worksheet, plan: v.plan || m.plan, variant: v.key, variantLabel: v.label });
  }

  function glossaryHTML(m, teacher) {
    const g = m.glossary || [];
    if (!g.length) return '';
    return `<section class="block glossary"><h2>Words to know</h2><dl class="glossary-list">` + g.map(x =>
      `<div class="gl"><dt>${esc(x.form || x.word)}${x.form && x.word && x.form.toLowerCase() !== x.word.toLowerCase() ? ` <span class="muted">(${esc(x.word)})</span>` : ''}</dt><dd>${esc(x.explanation)}${x.german ? ` <span class="german">– ${esc(x.german)}</span>` : ''}</dd></div>`).join('') + '</dl></section>';
  }

  function scriptAppendixHTML(m) {
    if (m.kind !== 'listening' || !(m.settings && m.settings.appendScript)) return '';
    return '<section class="block script appendix page-break"><h2>Script</h2><div class="script-lines">' + (m.content.lines || []).map((l, i) =>
      `<p class="line"><span class="line-no">${i + 1}</span><span class="speaker">${esc(l.speaker)}:</span> ${l.emotion ? `<span class="tag">[${esc(l.emotion)}]</span> ` : ''}${esc(l.text)}</p>`).join('') + '</div></section>';
  }

  /** Gauge, dimensions, structures and hard words of a measurement (app/level.js). */
  function levelMeterHTML(measured, target, opts) {
    if (!measured) return '';
    opts = opts || {};
    const bands = core.CEFR_BANDS;
    const pct = Math.max(0, Math.min(100, (measured.score + 0.5) / 6 * 100));
    const tIdx = target ? bands.indexOf(target) : -1;
    const delta = tIdx >= 0 ? measured.index - tIdx : 0;
    const verdict = tIdx < 0 ? '' : delta === 0 ? 'im Ziel' : `${Math.abs(delta)} Stufe${Math.abs(delta) > 1 ? 'n' : ''} ${delta > 0 ? 'über' : 'unter'} dem Ziel`;
    let html = `<div class="meter"><div class="meter-head"><span class="meter-band">${esc(measured.band)}</span><span class="muted">Score ${measured.score} / 5 · Sicherheit ${esc(measured.confidence)}${target ? ` · Ziel ${esc(target)} (${verdict})` : ''}</span></div>`;
    html += `<div class="gauge"><div class="gauge-scale">${bands.map((b, i) => `<span class="${i === tIdx ? 'target' : ''}${i === measured.index ? ' hit' : ''}">${b}</span>`).join('')}</div><div class="gauge-bar"><span class="gauge-marker" style="left:${pct.toFixed(1)}%"></span>${tIdx >= 0 ? `<span class="gauge-target" style="left:${((tIdx + 0.5) / 6 * 100).toFixed(1)}%"></span>` : ''}</div></div>`;
    html += '<table class="qc-table meter-table"><tbody>' + (measured.dimensions || []).map(d => `<tr class="${tIdx >= 0 && bands.indexOf(d.band) !== tIdx ? (Math.abs(bands.indexOf(d.band) - tIdx) >= 2 ? 'qc-fail' : 'qc-warn') : 'qc-pass'}"><td class="qc-status">${esc(d.band)}</td><td>${esc(d.label)}<div class="muted small">${esc(d.explain || '')}</div></td><td class="muted">${d.value} ${esc(d.unit)}</td></tr>`).join('') + '</tbody></table>';
    if (!opts.compact) {
      const st = (measured.structures || []).filter(x => x.count > 0);
      if (st.length) html += '<p class="small"><strong>Strukturen:</strong> ' + st.map(x => `${esc(x.label)} ${x.count}${x.examples && x.examples.length ? ` <span class="muted">(${esc(x.examples.slice(0, 3).join(', '))})</span>` : ''}`).join(' · ') + '</p>';
      const hw = measured.hardWords || [];
      if (hw.length) html += '<p class="small"><strong>Schwere Wörter:</strong> ' + hw.slice(0, 25).map(h => `<span class="hard-${esc(h.band)}">${esc(h.word)}${h.count > 1 ? ` ×${h.count}` : ''}</span>`).join(', ') + '</p>';
      const s = measured.stats || {};
      html += `<p class="muted small">${s.words} Wörter · ${s.sentences} Sätze · Ø ${s.msl} Wörter/Satz · längster Satz ${s.longest}${s.turns ? ` · ${s.turns} Beiträge · Ø ${s.meanTurn} Wörter/Beitrag` : ''}${s.wpm ? ` · ${s.wpm} Wörter/Minute` : ''}</p>`;
    }
    return html + '</div>';
  }

  function renderStudentHTML(m, variantKey) {
    m = forVariant(m, variantKey);
    const ws = m.worksheet;
    const isL = m.kind === 'listening';
    let html = `<article class="sheet student"><header><h1>${esc((ws && ws.title) || m.content.title)}</h1>`;
    html += `<p class="meta">${esc(m.plan.textbookName)} · ${esc(m.plan.unitName)} · ${esc(m.plan.cefr)}${m.variantLabel ? ` · ${esc(m.variantLabel)}` : ''}</p>`;
    if (ws && ws.instructions) html += `<p class="instructions">${esc(ws.instructions)}</p>`;
    html += '</header>';
    html += glossaryHTML(m, false);
    if (ws && ws.preTasks && ws.preTasks.length) html += `<section class="block"><h2>Before you ${isL ? 'listen' : 'read'}</h2>` + ws.preTasks.map(p => preTaskHtml(p, false)).join('') + '</section>';
    if (!isL) {
      html += '<section class="block text">' + renderTextHTML(m, {}) + '</section>';
    }
    if (ws && ws.questions.length) {
      html += '<section class="block questions"><h2>Questions</h2><ol class="qlist">' + ws.questions.map(q => `<li class="q" value="${q.n}"><span class="q-format">${esc(formatLabel(q.format))}</span>${questionBody(q, { seed: m.id })}</li>`).join('') + '</ol></section>';
    }
    if (ws && ws.higherOrder && ws.higherOrder.length) {
      html += '<section class="block higher-order"><h2>Beyond the text</h2><ol class="qlist">' + ws.higherOrder.map(h => `<li class="q"><span class="q-format">${esc(hoLabel(h.type))}</span><p class="q-prompt">${esc(h.prompt)}</p><p class="answer-line">_________________________________________________</p><p class="answer-line">_________________________________________________</p></li>`).join('') + '</ol></section>';
    }
    if (ws && ws.postTasks && ws.postTasks.length) {
      html += `<section class="block post-tasks"><h2>After you ${isL ? 'listen' : 'read'}</h2>` + ws.postTasks.map(p => preTaskHtml(p, false, 'post')).join('') + '</section>';
    }
    html += scriptAppendixHTML(m);
    html += '</article>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /* Teacher version (concept §28)                                        */
  /* ------------------------------------------------------------------ */

  function renderTeacherHTML(m) {
    const ws = m.worksheet;
    const isL = m.kind === 'listening';
    const variants = variantsOf(m).filter(v => v.worksheet);
    const vocabItems = m.plan.vocabulary.filter(v => (m.content.vocabularyUsed || []).map(x => x.toLowerCase()).includes(v.word.toLowerCase()) || (m.vocabFound || []).includes(v.word));
    const hl = m.settings && m.settings.highlightVocab;
    let html = `<article class="sheet teacher"><header><h1>${esc((ws && ws.title) || m.content.title)} <span class="badge">Teacher version</span></h1>`;
    html += `<p class="meta">${esc(m.plan.textbookName)} · ${esc(m.plan.unitName)} · Language ${esc(m.plan.cefr)}` + (m.level ? ` (measured ${esc(m.level.band)})` : '') + (ws ? ' · Questions ' + variants.map(v => (v.label ? esc(v.label) + ' ' : '') + esc((v.plan || m.plan).questionBands ? (v.plan || m.plan).questionBands.join('–') : (v.plan || m.plan).questionBand)).join(' / ') : '') + (isL ? ` · ≈ ${Math.round(m.plan.seconds / 60 * 10) / 10} min · ${esc(m.plan.preset.label)}` : ` · ${esc(m.settings.textType)}`) + '</p>';
    if (m.content.summary) html += `<p class="summary">${esc(m.content.summary)}</p>`;
    html += '</header>';

    html += `<section class="block script"><h2>${isL ? 'Script' : 'Text'}</h2>`;
    if (isL) {
      html += '<div class="script-lines">' + (m.content.lines || []).map((l, i) => `<p class="line"><span class="line-no">${i + 1}</span><span class="speaker">${esc(l.speaker)}:</span> ${l.emotion ? `<span class="tag">[${esc(l.emotion)}]</span> ` : ''}${hl ? highlight(l.text, vocabItems) : esc(l.text)}</p>`).join('') + '</div>';
      const st = quality.speakerStats(m.content.lines);
      html += '<p class="stats">' + Object.keys(st.shares).map(k => `${esc(k)} ${st.shares[k]} %`).join(' · ') + ` · ${st.total} words</p>`;
    } else {
      html += renderTextHTML(m, { numbered: true, highlight: hl ? vocabItems : null });
      html += `<p class="stats">${quality.wordCount((m.content.paragraphs || []).join(' '))} words</p>`;
    }
    html += '</section>';

    html += '<section class="block vocab"><h2>Target vocabulary used</h2>';
    html += vocabItems.length ? '<ul class="vocab-list">' + vocabItems.map(v => `<li><strong>${esc(v.word)}</strong>${v.translation ? ' — ' + esc(v.translation) : ''}</li>`).join('') + '</ul>' : '<p class="muted">No target item detected.</p>';
    if (m.vocabMissing && m.vocabMissing.length) html += `<p class="muted">Not used: ${m.vocabMissing.map(esc).join(', ')}</p>`;
    html += '</section>';

    if (m.glossary && m.glossary.length) html += glossaryHTML(m, true);
    if (m.level) html += '<section class="block level"><h2>Difficulty meter</h2>' + levelMeterHTML(m.level, m.plan.cefr, { compact: true }) + '</section>';
    for (const v of variants) {
      const vws = v.worksheet;
      const suffix = v.label ? ` — ${esc(v.label)} (${esc((v.plan || m.plan).questionBands ? (v.plan || m.plan).questionBands.join('–') : (v.plan || m.plan).questionBand)})` : '';
      if (vws.preTasks.length) html += `<section class="block"><h2>Pre-task${suffix}</h2>` + vws.preTasks.map(p => preTaskHtml(p, true)).join('') + '</section>';
      if ((vws.postTasks || []).length) html += `<section class="block"><h2>Post-task${suffix}</h2>` + vws.postTasks.map(p => preTaskHtml(p, true, 'post')).join('') + '</section>';
      html += `<section class="block key"><h2>Answer key${suffix}</h2><div class="table-wrap"><table class="keytable"><thead><tr><th>Q</th><th>Skill</th><th>Format</th><th>Difficulty</th><th>Correct answer</th><th>Evidence</th></tr></thead><tbody>`;
      for (const q of vws.questions) {
        html += `<tr><td>${q.n}</td><td>${esc(skillLabel(q.skill))}</td><td>${esc(formatLabel(q.format))}</td><td>${esc(q.difficulty)}</td><td>${answerText(q)}</td><td>${q.evidenceRef ? `<span class="ref">${esc(q.evidenceRef)}</span> ` : ''}“${esc(q.evidenceQuote)}”${q.rationale ? `<div class="rationale">${esc(q.rationale)}</div>` : ''}</td></tr>`;
      }
      html += '</tbody></table></div></section>';
      if (vws.higherOrder.length) {
        html += `<section class="block"><h2>Higher-order tasks — model answers${suffix}</h2><ol>` + vws.higherOrder.map(h => `<li><strong>${esc(hoLabel(h.type))}:</strong> ${esc(h.prompt)}<div class="rationale">Model answer: ${esc(typeof h.answer === 'string' ? h.answer : JSON.stringify(h.answer))}${h.rationale ? ' — ' + esc(h.rationale) : ''}</div></li>`).join('') + '</ol></section>';
      }
    }

    if (m.quality && (m.quality.findings || m.quality.repairs)) {
      const s = quality.summarize(m.quality.findings || []);
      html += `<section class="block qc"><h2>Quality check</h2><p class="stats">${s.pass} passed · ${s.warn} warnings · ${s.fail} failed · ${s.unverified} unverified</p>`;
      html += '<ul class="qc-list">' + (m.quality.findings || []).map(f => `<li class="qc-${f.status}"><span class="qc-status">${f.status}</span> ${f.variant ? `<span class="badge">Niveau ${esc(f.variant)}</span> ` : ''}${esc(f.title)}${f.detail ? ` — <span class="muted">${esc(f.detail)}</span>` : ''}</li>`).join('') + '</ul>';
      html += repairListHTML(m.quality.repairs);
      html += '</section>';
    }
    html += '</article>';
    return html;
  }

  /** What the automatic correction changed, for the teacher version. */
  function repairLabel(r) {
    const v = r.variant ? `Niveau ${r.variant}: ` : '';
    if (r.target === 'order') return v + 'Fragen in die Reihenfolge des Materials gebracht: Q' + (r.questions || []).join(', Q');
    if (r.target === 'pretask') return v + 'Pre-Task neu erstellt' + ((r.preTasks || []).length ? ': P' + r.preTasks.join(', P') : '');
    if (r.target === 'content') return 'Text überarbeitet';
    if (r.target === 'content+worksheet') return v + 'Text und Aufgaben neu erstellt';
    if (r.questions && r.questions.length) return v + 'Fragen ersetzt: Q' + r.questions.join(', Q');
    return v + 'Aufgaben überarbeitet';
  }
  function repairListHTML(repairs) {
    const applied = (repairs || []).filter(r => r.accepted);
    if (!applied.length) return '';
    return '<h3 class="qc-sub">Automatische Korrektur</h3><ul class="qc-list">' + applied.map(r =>
      `<li class="qc-pass"><span class="qc-status">Runde ${r.round}</span> ${esc(repairLabel(r))}${(r.fixed || []).length ? ` — <span class="muted">Auslöser: ${esc((r.fixed || []).join(', '))}</span>` : ''}</li>`).join('') + '</ul>';
  }

  /** Plain-text/markdown export of both versions. */
  function renderMarkdown(m) {
    const ws = m.worksheet;
    const isL = m.kind === 'listening';
    const out = [];
    out.push(`# ${(ws && ws.title) || m.content.title}`);
    out.push(`${m.plan.textbookName} · ${m.plan.unitName} · ${m.plan.cefr}`);
    out.push('');
    out.push('## Student version' + (variantsOf(m).length > 1 ? ' — ' + variantsOf(m).map(v => v.label).join(' / ') : ''));
    if (ws && ws.instructions) out.push(ws.instructions, '');
    if (m.glossary && m.glossary.length) out.push('### Words to know', ...m.glossary.map(g => `- **${g.form || g.word}** — ${g.explanation}${g.german ? ' (' + g.german + ')' : ''}`), '');
    const taskLines = (list, phase) => list.flatMap(p => [
      `### ${p.n ? p.n + '. ' : ''}${phase === 'post' ? postLabel(p.type) : preLabel(p.type)}${p.title ? ': ' + p.title : ''}`,
      [socialLabel(p.socialForm), modeLabel(p.mode), p.minutes ? p.minutes + ' min' : ''].filter(Boolean).join(' · '),
      '', p.prompt, ...(p.items || []).map(i => `- ${i}`),
      ...(p.product ? ['', `Result: ${p.product}`] : []),
      ...((p.criteria || []).length ? ['', 'Success criteria:', ...p.criteria.map(c => `- ${c}`)] : []), '']);
    for (const p of (ws && ws.preTasks) || []) out.push(
      `### ${p.n ? p.n + '. ' : ''}${preLabel(p.type)}${p.title ? ': ' + p.title : ''}`,
      [socialLabel(p.socialForm), modeLabel(p.mode), p.minutes ? p.minutes + ' min' : ''].filter(Boolean).join(' · '),
      '', p.prompt, ...(p.items || []).map(i => `- ${i}`),
      ...((p.criteria || []).length ? ['', 'Success criteria:', ...p.criteria.map(c => `- ${c}`)] : []), '');
    if (!isL) out.push(...(m.content.paragraphs || []), '');
    for (const v of variantsOf(m).filter(x => x.worksheet)) {
    if (v.label) out.push(`### ${v.label}`);
    for (const q of v.worksheet.questions) {
      out.push(`${q.n}. ${q.prompt || q.statement || ''} (${formatLabel(q.format)})`);
      if (q.options) out.push(...q.options.map(o => `   - ${o}`));
      if (q.items && q.format === 'matching') out.push(...q.items.map((it, i) => `   ${i + 1}. ${it.left}`), ...seededShuffle(q.items.map(i => i.right), m.id).map((r, i) => `   ${String.fromCharCode(97 + i)}) ${r}`));
      if (q.items && q.format === 'ordering') out.push(...seededShuffle(q.items, m.id).map(it => `   ___ ${it}`));
    }
    for (const h of v.worksheet.higherOrder || []) out.push(`- [${hoLabel(h.type)}] ${h.prompt}`);
    }
    if (ws && (ws.postTasks || []).length) out.push('', `## After you ${isL ? 'listen' : 'read'}`, '', ...taskLines(ws.postTasks, 'post'));
    if (isL && m.settings && m.settings.appendScript) out.push('', '### Script', ...(m.content.lines || []).map(l => `${l.speaker}: ${l.emotion ? '[' + l.emotion + '] ' : ''}${l.text}`));
    out.push('', '## Teacher version', '', `### ${isL ? 'Script' : 'Text'}`);
    if (isL) out.push(...(m.content.lines || []).map(l => `${l.speaker}: ${l.emotion ? '[' + l.emotion + '] ' : ''}${l.text}`));
    else out.push(...(m.content.paragraphs || []));
    out.push('', '### Target vocabulary used', ...(m.vocabFound || []).map(w => `- ${w}`));
    if (m.level) out.push('', '### Difficulty meter', `Measured ${m.level.band} (score ${m.level.score}, confidence ${m.level.confidence}), target ${m.plan.cefr}`, ...(m.level.dimensions || []).map(d => `- ${d.label}: ${d.value} ${d.unit} → ${d.band}`));
    for (const v of variantsOf(m).filter(x => x.worksheet)) {
      out.push('', '### Answer key' + (v.label ? ' — ' + v.label : ''));
      for (const q of v.worksheet.questions) out.push(`Q${q.n} · Skill: ${skillLabel(q.skill)} · Difficulty: ${q.difficulty} · Answer: ${answerText(q).replace(/<[^>]+>/g, '')} · Evidence ${q.evidenceRef}: "${q.evidenceQuote}"${q.rationale ? ' · ' + q.rationale : ''}`);
      for (const h of v.worksheet.higherOrder) out.push(`HOT ${h.n} · ${hoLabel(h.type)} · Model answer: ${typeof h.answer === 'string' ? h.answer : JSON.stringify(h.answer)}`);
    }
    if (m.quality && m.quality.findings) {
      out.push('', '### Quality check');
      for (const f of m.quality.findings) out.push(`- [${f.status}] ${f.title}${f.detail ? ' — ' + f.detail : ''}`);
      const applied = (m.quality.repairs || []).filter(r => r.accepted);
      if (applied.length) { out.push('', '### Automatische Korrektur'); for (const r of applied) out.push(`- Runde ${r.round}: ${repairLabel(r)}${(r.fixed || []).length ? ' (Auslöser: ' + r.fixed.join(', ') + ')' : ''}`); }
    }
    return out.join('\n');
  }

  return { esc, seededShuffle, highlight, renderTextHTML, isHeadingLike, repairLabel, repairListHTML, renderStudentHTML, renderTeacherHTML, renderMarkdown, questionBody, answerText, preTaskHtml, socialLabel, modeLabel, preLabel, postLabel,
    variantsOf, forVariant, glossaryHTML, scriptAppendixHTML, levelMeterHTML };
});
