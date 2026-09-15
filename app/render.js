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

  /** Wrap occurrences of target vocabulary in <mark>. */
  function highlight(text, items) {
    let html = esc(text);
    const keys = [];
    for (const it of items || []) {
      const raw = typeof it === 'string' ? it : it.word;
      const base = String(raw || '').replace(/^to /i, '').replace(/\(.*?\)/g, '').trim();
      const parts = base.split(/\s+/).filter(p => p && !/^(sb|sth|somebody|something)$/i.test(p));
      if (parts.length) keys.push(parts);
    }
    for (const parts of keys) {
      const re = new RegExp('\\b(' + parts.map(p => quality.stem(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[a-z]{0,3}').join('\\s+(?:\\w+\\s+)?') + ')\\b', 'gi');
      html = html.replace(re, '<mark class="vocab">$1</mark>');
    }
    return html;
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

  function preTaskHtml(p, teacher) {
    let html = `<section class="pretask"><h3>${esc(preLabel(p.type))}${p.title ? ': ' + esc(p.title) : ''}</h3><p>${esc(p.prompt)}</p>`;
    if (p.items && p.items.length) html += '<ul>' + p.items.map(i => `<li>${esc(i)}</li>`).join('') + '</ul>';
    if (teacher && p.teacherNote) html += `<p class="teacher-note">Teacher note: ${esc(p.teacherNote)}</p>`;
    html += '</section>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /* Student version (concept §28)                                        */
  /* ------------------------------------------------------------------ */

  function renderStudentHTML(m) {
    const ws = m.worksheet;
    const isL = m.kind === 'listening';
    let html = `<article class="sheet student"><header><h1>${esc((ws && ws.title) || m.content.title)}</h1>`;
    html += `<p class="meta">${esc(m.plan.textbookName)} · ${esc(m.plan.unitName)} · ${esc(m.plan.cefr)}</p>`;
    if (ws && ws.instructions) html += `<p class="instructions">${esc(ws.instructions)}</p>`;
    html += '</header>';
    if (ws && ws.preTasks && ws.preTasks.length) html += `<section class="block"><h2>Before you ${isL ? 'listen' : 'read'}</h2>` + ws.preTasks.map(p => preTaskHtml(p, false)).join('') + '</section>';
    if (!isL) {
      html += `<section class="block text"><h2>${esc(m.content.title)}</h2>` + (m.content.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join('') + '</section>';
    }
    if (ws && ws.questions.length) {
      html += '<section class="block questions"><h2>Questions</h2><ol class="qlist">' + ws.questions.map(q => `<li class="q" value="${q.n}"><span class="q-format">${esc(formatLabel(q.format))}</span>${questionBody(q, { seed: m.id })}</li>`).join('') + '</ol></section>';
    }
    if (ws && ws.higherOrder && ws.higherOrder.length) {
      html += '<section class="block higher-order"><h2>Beyond the text</h2><ol class="qlist">' + ws.higherOrder.map(h => `<li class="q"><span class="q-format">${esc(hoLabel(h.type))}</span><p class="q-prompt">${esc(h.prompt)}</p><p class="answer-line">_________________________________________________</p><p class="answer-line">_________________________________________________</p></li>`).join('') + '</ol></section>';
    }
    html += '</article>';
    return html;
  }

  /* ------------------------------------------------------------------ */
  /* Teacher version (concept §28)                                        */
  /* ------------------------------------------------------------------ */

  function renderTeacherHTML(m) {
    const ws = m.worksheet;
    const isL = m.kind === 'listening';
    const vocabItems = m.plan.vocabulary.filter(v => (m.content.vocabularyUsed || []).map(x => x.toLowerCase()).includes(v.word.toLowerCase()) || (m.vocabFound || []).includes(v.word));
    const hl = m.settings && m.settings.highlightVocab;
    let html = `<article class="sheet teacher"><header><h1>${esc((ws && ws.title) || m.content.title)} <span class="badge">Teacher version</span></h1>`;
    html += `<p class="meta">${esc(m.plan.textbookName)} · ${esc(m.plan.unitName)} · Language ${esc(m.plan.cefr)}` + (ws ? ` · Questions ${esc(m.plan.questionBand)}` : '') + (isL ? ` · ≈ ${Math.round(m.plan.seconds / 60 * 10) / 10} min · ${esc(m.plan.preset.label)}` : ` · ${esc(m.settings.textType)}`) + '</p>';
    if (m.content.summary) html += `<p class="summary">${esc(m.content.summary)}</p>`;
    html += '</header>';

    html += `<section class="block script"><h2>${isL ? 'Script' : 'Text'}</h2>`;
    if (isL) {
      html += '<div class="script-lines">' + (m.content.lines || []).map((l, i) => `<p class="line"><span class="line-no">${i + 1}</span><span class="speaker">${esc(l.speaker)}:</span> ${l.emotion ? `<span class="tag">[${esc(l.emotion)}]</span> ` : ''}${hl ? highlight(l.text, vocabItems) : esc(l.text)}</p>`).join('') + '</div>';
      const st = quality.speakerStats(m.content.lines);
      html += '<p class="stats">' + Object.keys(st.shares).map(k => `${esc(k)} ${st.shares[k]} %`).join(' · ') + ` · ${st.total} words</p>`;
    } else {
      html += (m.content.paragraphs || []).map((p, i) => `<p class="para"><span class="line-no">¶${i + 1}</span>${hl ? highlight(p, vocabItems) : esc(p)}</p>`).join('');
      html += `<p class="stats">${quality.wordCount((m.content.paragraphs || []).join(' '))} words</p>`;
    }
    html += '</section>';

    html += '<section class="block vocab"><h2>Target vocabulary used</h2>';
    html += vocabItems.length ? '<ul class="vocab-list">' + vocabItems.map(v => `<li><strong>${esc(v.word)}</strong>${v.translation ? ' — ' + esc(v.translation) : ''}</li>`).join('') + '</ul>' : '<p class="muted">No target item detected.</p>';
    if (m.vocabMissing && m.vocabMissing.length) html += `<p class="muted">Not used: ${m.vocabMissing.map(esc).join(', ')}</p>`;
    html += '</section>';

    if (ws) {
      if (ws.preTasks.length) html += '<section class="block"><h2>Pre-task</h2>' + ws.preTasks.map(p => preTaskHtml(p, true)).join('') + '</section>';
      html += '<section class="block key"><h2>Answer key</h2><div class="table-wrap"><table class="keytable"><thead><tr><th>Q</th><th>Skill</th><th>Format</th><th>Difficulty</th><th>Correct answer</th><th>Evidence</th></tr></thead><tbody>';
      for (const q of ws.questions) {
        html += `<tr><td>${q.n}</td><td>${esc(skillLabel(q.skill))}</td><td>${esc(formatLabel(q.format))}</td><td>${esc(q.difficulty)}</td><td>${answerText(q)}</td><td>${q.evidenceRef ? `<span class="ref">${esc(q.evidenceRef)}</span> ` : ''}“${esc(q.evidenceQuote)}”${q.rationale ? `<div class="rationale">${esc(q.rationale)}</div>` : ''}</td></tr>`;
      }
      html += '</tbody></table></div></section>';
      if (ws.higherOrder.length) {
        html += '<section class="block"><h2>Higher-order tasks — model answers</h2><ol>' + ws.higherOrder.map(h => `<li><strong>${esc(hoLabel(h.type))}:</strong> ${esc(h.prompt)}<div class="rationale">Model answer: ${esc(typeof h.answer === 'string' ? h.answer : JSON.stringify(h.answer))}${h.rationale ? ' — ' + esc(h.rationale) : ''}</div></li>`).join('') + '</ol></section>';
      }
    }

    if (m.quality && m.quality.findings) {
      const s = quality.summarize(m.quality.findings);
      html += `<section class="block qc"><h2>Quality check</h2><p class="stats">${s.pass} passed · ${s.warn} warnings · ${s.fail} failed · ${s.unverified} unverified</p><ul class="qc-list">` + m.quality.findings.map(f => `<li class="qc-${f.status}"><span class="qc-status">${f.status}</span> ${esc(f.title)}${f.detail ? ` — <span class="muted">${esc(f.detail)}</span>` : ''}</li>`).join('') + '</ul></section>';
    }
    html += '</article>';
    return html;
  }

  /** Plain-text/markdown export of both versions. */
  function renderMarkdown(m) {
    const ws = m.worksheet;
    const isL = m.kind === 'listening';
    const out = [];
    out.push(`# ${(ws && ws.title) || m.content.title}`);
    out.push(`${m.plan.textbookName} · ${m.plan.unitName} · ${m.plan.cefr}`);
    out.push('');
    out.push('## Student version');
    if (ws && ws.instructions) out.push(ws.instructions, '');
    for (const p of (ws && ws.preTasks) || []) out.push(`### ${preLabel(p.type)}${p.title ? ': ' + p.title : ''}`, p.prompt, ...(p.items || []).map(i => `- ${i}`), '');
    if (!isL) out.push(...(m.content.paragraphs || []), '');
    for (const q of (ws && ws.questions) || []) {
      out.push(`${q.n}. ${q.prompt || q.statement || ''} (${formatLabel(q.format)})`);
      if (q.options) out.push(...q.options.map(o => `   - ${o}`));
      if (q.items && q.format === 'matching') out.push(...q.items.map((it, i) => `   ${i + 1}. ${it.left}`), ...seededShuffle(q.items.map(i => i.right), m.id).map((r, i) => `   ${String.fromCharCode(97 + i)}) ${r}`));
      if (q.items && q.format === 'ordering') out.push(...seededShuffle(q.items, m.id).map(it => `   ___ ${it}`));
    }
    for (const h of (ws && ws.higherOrder) || []) out.push(`- [${hoLabel(h.type)}] ${h.prompt}`);
    out.push('', '## Teacher version', '', `### ${isL ? 'Script' : 'Text'}`);
    if (isL) out.push(...(m.content.lines || []).map(l => `${l.speaker}: ${l.emotion ? '[' + l.emotion + '] ' : ''}${l.text}`));
    else out.push(...(m.content.paragraphs || []));
    out.push('', '### Target vocabulary used', ...(m.vocabFound || []).map(w => `- ${w}`));
    if (ws) {
      out.push('', '### Answer key');
      for (const q of ws.questions) out.push(`Q${q.n} · Skill: ${skillLabel(q.skill)} · Difficulty: ${q.difficulty} · Answer: ${answerText(q).replace(/<[^>]+>/g, '')} · Evidence ${q.evidenceRef}: "${q.evidenceQuote}"${q.rationale ? ' · ' + q.rationale : ''}`);
      for (const h of ws.higherOrder) out.push(`HOT ${h.n} · ${hoLabel(h.type)} · Model answer: ${typeof h.answer === 'string' ? h.answer : JSON.stringify(h.answer)}`);
    }
    if (m.quality && m.quality.findings) {
      out.push('', '### Quality check');
      for (const f of m.quality.findings) out.push(`- [${f.status}] ${f.title}${f.detail ? ' — ' + f.detail : ''}`);
    }
    return out.join('\n');
  }

  return { esc, seededShuffle, highlight, renderStudentHTML, renderTeacherHTML, renderMarkdown, questionBody, answerText };
});
