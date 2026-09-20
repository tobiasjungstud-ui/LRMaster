/*
 * LRMaster quality — normalises Claude's JSON output and runs the quality
 * check from concept §29. Rules are either `deterministic` (measured here in
 * code) or `llm` (judged by Claude with the review prompt). Every rule has a
 * stable id that the concept manifest references.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./level.js'), require('./mock.js'));
  else { root.LR = root.LR || {}; root.LR.quality = factory(root.LR.core, root.LR.level, root.LR.mock); }
})(typeof self !== 'undefined' ? self : this, function (core, level, mock) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Text utilities                                                       */
  /* ------------------------------------------------------------------ */

  // one counter for the whole app (see level.countWords), so that the length
  // rule, the difficulty meter and the teacher version never disagree
  function words(text) { return level.countWords(text); }
  function wordCount(text) { return words(text).length; }

  function normalizeForSearch(s) {
    return String(s || '').toLowerCase().replace(/[\u2019\u2018`\u00B4]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Full plain text of the material and the character offset where each line/paragraph starts. */
  function materialText(content, kind) {
    const parts = kind === 'listening'
      ? (content.lines || []).map(l => `${l.speaker}: ${l.text}`)
      : (content.paragraphs || []);
    const offsets = [];
    let text = '';
    for (const p of parts) { offsets.push(text.length); text += p + '\n'; }
    return { text, offsets, parts };
  }

  /**
   * Locate a quote in the material. Tries the whole quote, then progressively
   * shorter word windows. Returns a character position or -1.
   */
  function findQuotePosition(text, quote) {
    const hay = normalizeForSearch(text);
    const q = normalizeForSearch(quote);
    if (!q) return -1;
    let pos = hay.indexOf(q);
    if (pos >= 0) return pos;
    const w = q.split(' ');
    for (let len = Math.min(8, w.length - 1); len >= 4; len--) {
      for (let start = 0; start + len <= w.length; start++) {
        pos = hay.indexOf(w.slice(start, start + len).join(' '));
        if (pos >= 0) return pos;
      }
    }
    return -1;
  }

  /** Simple stem: lets "argue" match "argued/argues/arguing", "friend" match "friends". */
  function stem(word) {
    let w = word.toLowerCase();
    w = w.replace(/(ing|ed|es|s|ies|ly)$/, '');
    if (w.length > 4 && /e$/.test(w)) w = w.slice(0, -1);
    return w.length >= 3 ? w : word.toLowerCase();
  }

  /* Irregular past forms of verbs that are frequent in textbook vocabulary. */
  const IRREGULAR = { make: ['made'], take: ['took', 'taken'], get: ['got', 'gotten'], give: ['gave', 'given'], go: ['went', 'gone'], come: ['came'], fall: ['fell', 'fallen'], keep: ['kept'], stick: ['stuck'], feel: ['felt'], tell: ['told'], buy: ['bought'], bring: ['brought'], think: ['thought'], know: ['knew', 'known'], see: ['saw', 'seen'], say: ['said'], run: ['ran'], meet: ['met'], find: ['found'], lose: ['lost'], leave: ['left'], break: ['broke', 'broken'], speak: ['spoke', 'spoken'], write: ['wrote', 'written'], forget: ['forgot', 'forgotten'], catch: ['caught'], teach: ['taught'], stand: ['stood'], sit: ['sat'], win: ['won'], hold: ['held'], grow: ['grew', 'grown'], become: ['became'], begin: ['began', 'begun'], choose: ['chose', 'chosen'], drive: ['drove', 'driven'], eat: ['ate', 'eaten'], fly: ['flew', 'flown'], hide: ['hid', 'hidden'], lead: ['led'], lend: ['lent'], mean: ['meant'], pay: ['paid'], ride: ['rode', 'ridden'], ring: ['rang', 'rung'], rise: ['rose', 'risen'], sell: ['sold'], send: ['sent'], shake: ['shook', 'shaken'], sing: ['sang', 'sung'], sleep: ['slept'], spend: ['spent'], swim: ['swam', 'swum'], throw: ['threw', 'thrown'], understand: ['understood'], wake: ['woke', 'woken'], wear: ['wore', 'worn'], do: ['did', 'done'], have: ['had', 'has'], be: ['was', 'were', 'been', 'is', 'are'], deal: ['dealt'], fight: ['fought'], hang: ['hung'], let: ['let'], put: ['put'], cut: ['cut'], hit: ['hit'], hurt: ['hurt'], read: ['read'], build: ['built'], feed: ['fed'], light: ['lit'], shoot: ['shot'], steal: ['stole', 'stolen'], tear: ['tore', 'torn'], bite: ['bit', 'bitten'], blow: ['blew', 'blown'], draw: ['drew', 'drawn'], drink: ['drank', 'drunk'], freeze: ['froze', 'frozen'], lie: ['lay', 'lain'], sweep: ['swept'], wind: ['wound'], seek: ['sought'], strike: ['struck'] };

  /** All spellings a word may take in the text (stem, y→i stem, irregular forms). */
  function wordVariants(k) {
    const v = new Set([k, stem(k)]);
    if (/y$/.test(k)) v.add(k.slice(0, -1) + 'i');
    if (/ie$/.test(k)) v.add(k.slice(0, -2) + 'y');
    for (const f of IRREGULAR[k] || []) v.add(f);
    return [...v].filter(Boolean);
  }

  /** Which target vocabulary items occur in the text (inflection-tolerant, multi-word aware). */
  function vocabMatches(text, items) {
    const hay = ' ' + normalizeForSearch(text) + ' ';
    const found = [], missing = [];
    for (const item of items) {
      const raw = typeof item === 'string' ? item : item.word;
      const keys = vocabKeys(raw);
      if (!keys.length) continue;
      const ok = keys.every(k => new RegExp('\\b(?:' + wordVariants(k).map(escapeRe).join('|') + ')[a-z]{0,4}\\b').test(hay));
      (ok ? found : missing).push(raw);
    }
    return { found, missing };
  }

  /** All words of a vocabulary entry, placeholders removed (particles kept). */
  function vocabParts(raw) {
    const base = normalizeForSearch(raw).replace(/^to /, '').replace(/^(sb|sth|somebody|something) /, '').replace(/\((.*?)\)/g, '').trim();
    if (!base) return [];
    return base.split(' ').filter(p => p && !/^(sb|sth|somebody|something|s\.o\.|s\.th\.|one's|sb's)$/.test(p));
  }

  /** The words of a vocabulary entry that must actually appear in the text. */
  function vocabKeys(raw) {
    const base = normalizeForSearch(raw).replace(/^to /, '').replace(/^(sb|sth|somebody|something) /, '').replace(/\((.*?)\)/g, '').trim();
    if (!base) return [];
    const parts = base.split(' ').filter(p => !/^(sb|sth|somebody|something|s\.o\.|s\.th\.|one's|sb's)$/.test(p));
    const content = parts.filter(p => p.length > 2 && !/^(a|an|the|to|of|in|on|at|for|with|and|or)$/.test(p));
    return content.length ? content : parts;
  }

  /** Character ranges in `text` covered by a target vocabulary item. */
  function highlightRanges(text, items) {
    const src = String(text || '');
    const hits = [];
    const search = (keys) => {
      if (!keys.length) return [];
      const pattern = keys.map(k => '(?:' + wordVariants(k).map(escapeRe).join('|') + ')[a-z]{0,4}').join("[\\s'\u2019-]+(?:\\w+[\\s'\u2019-]+)?");
      let re;
      try { re = new RegExp('\\b(?:' + pattern + ')\\b', 'gi'); } catch (e) { return []; }
      const found = [];
      let m;
      while ((m = re.exec(src))) {
        if (m[0]) found.push({ start: m.index, end: m.index + m[0].length });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      return found;
    };
    for (const item of items || []) {
      const raw = typeof item === 'string' ? item : item.word;
      // Prefer the full phrase; fall back to the content words alone.
      const full = search(vocabParts(raw));
      hits.push(...(full.length ? full : search(vocabKeys(raw))));
    }
    hits.sort((a, b) => a.start - b.start || b.end - a.end);
    const merged = [];
    for (const h of hits) {
      const last = merged[merged.length - 1];
      if (last && h.start <= last.end) last.end = Math.max(last.end, h.end);
      else merged.push({ start: h.start, end: h.end });
    }
    return merged;
  }

  /** `text` split into segments, each marked as target vocabulary or not. */
  function highlightSegments(text, items) {
    const src = String(text || '');
    const out = [];
    let pos = 0;
    for (const r of highlightRanges(src, items)) {
      if (r.start > pos) out.push({ text: src.slice(pos, r.start), hit: false });
      out.push({ text: src.slice(r.start, r.end), hit: true });
      pos = r.end;
    }
    if (pos < src.length) out.push({ text: src.slice(pos), hit: false });
    return out.length ? out : [{ text: src, hit: false }];
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /** Word share, turn count, mean turn length and variability per speaker. */
  function speakerStats(lines) {
    const bySpeaker = {};
    let total = 0;
    const turnLengths = [];
    for (const l of lines || []) {
      const n = wordCount(l.text);
      total += n;
      turnLengths.push(n);
      const s = bySpeaker[l.speaker] || (bySpeaker[l.speaker] = { words: 0, turns: 0 });
      s.words += n; s.turns += 1;
    }
    const shares = {};
    for (const k of Object.keys(bySpeaker)) shares[k] = total ? Math.round(bySpeaker[k].words / total * 100) : 0;
    const mean = turnLengths.length ? turnLengths.reduce((a, b) => a + b, 0) / turnLengths.length : 0;
    const variance = turnLengths.length ? turnLengths.reduce((a, b) => a + (b - mean) * (b - mean), 0) / turnLengths.length : 0;
    const cv = mean ? Math.sqrt(variance) / mean : 0;
    return { total, bySpeaker, shares, meanTurn: mean, turnCV: cv, turns: turnLengths.length };
  }

  function tagStats(lines) {
    const tagged = (lines || []).filter(l => l.emotion);
    const invalid = tagged.filter(l => !core.EMOTION_TAGS.includes(String(l.emotion).toLowerCase()));
    return { total: (lines || []).length, tagged: tagged.length, ratio: lines && lines.length ? tagged.length / lines.length : 0, invalid: invalid.map(l => l.emotion) };
  }

  /* ------------------------------------------------------------------ */
  /* Normalisation of Claude output                                       */
  /* ------------------------------------------------------------------ */

  const ARRAY_META = ['tags', 'authors', 'timestamps', 'speakers', 'factBox'];

  /** Keep only the document details this text type asks for, as clean values. */
  function normalizeMeta(raw, state) {
    const spec = core.META_SPECS[core.designIdFor(state)] || core.META_SPECS.custom;
    const src = (raw && typeof raw === 'object') ? raw : {};
    const out = {};
    for (const [key] of spec.fields) {
      const v = src[key];
      if (v === undefined || v === null) continue;
      if (ARRAY_META.includes(key)) {
        if (Array.isArray(v)) { const arr = v.map(x => String(x).trim()).filter(Boolean); if (arr.length) out[key] = arr; }
        else if (String(v).trim()) out[key] = String(v).split(/[;,]\s*/).map(x => x.trim()).filter(Boolean);
      } else if (key === 'rating') {
        const n = Number(v);
        if (Number.isFinite(n)) out.rating = Math.max(0, Math.min(5, Math.round(n)));
      } else {
        const t = String(v).replace(/\r/g, '').trim();
        if (t) out[key] = t;
      }
    }
    return out;
  }

  function normalizeContent(raw, state, plan) {
    if (!raw || typeof raw !== 'object') throw new Error('Content: no JSON object returned.');
    const out = { title: String(raw.title || '').trim(), summary: String(raw.summary || '').trim(), meta: normalizeMeta(raw.meta, state), vocabularyUsed: Array.isArray(raw.vocabularyUsed) ? raw.vocabularyUsed.map(String) : [] };
    if (state.kind === 'listening') {
      const src = Array.isArray(raw.lines) ? raw.lines : Array.isArray(raw.script) ? raw.script : null;
      if (!src) throw new Error('Content: "lines" missing.');
      out.lines = [];
      for (const l of src) {
        if (!l || typeof l !== 'object') continue;
        let text = String(l.text || l.line || '').trim();
        let emotion = l.emotion ? String(l.emotion).toLowerCase().replace(/[\[\]]/g, '').trim() : null;
        const inline = /^\[([a-z]+)\]\s*/i.exec(text);
        if (inline) { emotion = emotion || inline[1].toLowerCase(); text = text.slice(inline[0].length); }
        if (!text) continue;
        out.lines.push({ speaker: String(l.speaker || '').trim(), emotion: emotion && emotion !== 'null' && emotion !== 'none' ? emotion : null, text });
      }
      if (out.lines.length === 0) throw new Error('Content: script is empty.');
      // Map slightly different speaker spellings back to the planned labels.
      const labels = plan.speakerLabels;
      for (const l of out.lines) {
        const hit = labels.find(lab => normalizeForSearch(lab) === normalizeForSearch(l.speaker))
          || labels.find(lab => normalizeForSearch(l.speaker).startsWith(normalizeForSearch(lab)) || normalizeForSearch(lab).startsWith(normalizeForSearch(l.speaker)));
        if (hit) l.speaker = hit;
      }
    } else {
      let paras = Array.isArray(raw.paragraphs) ? raw.paragraphs : (typeof raw.text === 'string' ? raw.text.split(/\n\s*\n/) : null);
      if (!paras) throw new Error('Content: "paragraphs" missing.');
      out.paragraphs = paras.map(p => String(p || '').trim()).filter(Boolean);
      if (out.paragraphs.length === 0) throw new Error('Content: text is empty.');
    }
    return out;
  }

  /** One pre-task as the pipeline stores it (concept §27 and the task forms). */
  function normalizePreTask(p, i) {
    const pick = (v, list, fallback) => (list.includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : fallback);
    return {
      n: Number(p.n) || (typeof i === 'number' ? i + 1 : 1),
      type: String(p.type || '').toLowerCase(),
      title: String(p.title || ''),
      prompt: String(p.prompt || ''),
      items: Array.isArray(p.items) ? p.items.map(String) : [],
      socialForm: pick(p.socialForm, core.SOCIAL_FORM_KEYS, 'single'),
      mode: pick(p.mode, ['written', 'oral'], 'written'),
      minutes: Math.max(0, Math.round(Number(p.minutes) || 0)),
      criteria: Array.isArray(p.criteria) ? p.criteria.map(String).filter(Boolean) : [],
      vocabUsed: Array.isArray(p.vocabUsed) ? p.vocabUsed.map(String) : [],
      materials: String(p.materials || ''),
      teacherNote: String(p.teacherNote || ''),
      // post-task only: where the task starts from and what the students hand in
      reference: String(p.reference || ''),
      product: String(p.product || ''),
    };
  }

  /** Replace the tasks of one phase, keeping the planned order and numbering. */
  function applyTaskPatch(worksheet, patch, phaseKey) {
    const field = phaseKey === 'post' ? 'postTasks' : 'preTasks';
    const list = Array.isArray(patch) ? patch : (patch && (patch[field] || patch.tasks)) || [];
    if (!list.length) return worksheet;
    return Object.assign({}, worksheet, { [field]: list.map((p, i) => normalizePreTask(p, i)) });
  }
  function applyPreTaskPatch(worksheet, patch) { return applyTaskPatch(worksheet, patch, 'pre'); }
  function applyPostTaskPatch(worksheet, patch) { return applyTaskPatch(worksheet, patch, 'post'); }

  function normalizeQuestion(q, i) {
    const n = Number(q.n) || i + 1;
    const out = Object.assign({}, q, {
      n,
      skill: String(q.skill || '').toLowerCase().trim(),
      format: String(q.format || '').toLowerCase().trim(),
      difficulty: String(q.difficulty || '').trim(),
      prompt: String(q.prompt || q.question || '').trim(),
      evidenceQuote: String(q.evidenceQuote || q.evidence || '').trim(),
      evidenceRef: String(q.evidenceRef || '').trim(),
      rationale: q.rationale ? String(q.rationale).trim() : '',
    });
    if (q.statement && !out.prompt) out.prompt = String(q.statement).trim();
    if (q.statement) out.statement = String(q.statement).trim();
    if (Array.isArray(q.options)) out.options = q.options.map(String);
    if (Array.isArray(q.items)) out.items = q.items;
    if (Array.isArray(q.acceptable)) out.acceptable = q.acceptable.map(String);
    return out;
  }

  function normalizeWorksheet(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('Worksheet: no JSON object returned.');
    const ws = {
      title: String(raw.title || '').trim(),
      instructions: String(raw.instructions || '').trim(),
      preTasks: Array.isArray(raw.preTasks) ? raw.preTasks.filter(p => p && typeof p === 'object').map(normalizePreTask) : [],
      postTasks: Array.isArray(raw.postTasks) ? raw.postTasks.filter(p => p && typeof p === 'object').map(normalizePreTask) : [],
      questions: Array.isArray(raw.questions) ? raw.questions.filter(q => q && typeof q === 'object').map(normalizeQuestion) : [],
      higherOrder: Array.isArray(raw.higherOrder) ? raw.higherOrder.filter(q => q && typeof q === 'object').map((q, i) => ({
        n: Number(q.n) || i + 1, type: String(q.type || '').toLowerCase(), prompt: String(q.prompt || ''), answer: q.answer, rationale: String(q.rationale || ''),
      })) : [],
    };
    return ws;
  }

  /* ------------------------------------------------------------------ */
  /* Rule registry (concept §29)                                          */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Timeline (concept §26): questions always follow the material         */
  /* ------------------------------------------------------------------ */

  /** Where each question points in the material, and every way the order can be wrong. */
  function chronologyReport(worksheet, content, kind) {
    const mat = materialText(content, kind);
    const qs = worksheet.questions || [];
    const positions = [];
    const unresolved = [];
    const gistMisplaced = [];
    qs.forEach((q, i) => {
      const p = findQuotePosition(mat.text, q.evidenceQuote);
      if (q.skill === 'gist') { if (i !== 0 && i !== qs.length - 1) gistMisplaced.push(q.n); return; }
      if (p < 0) { unresolved.push(q.n); return; }
      positions.push({ n: q.n, p, ref: q.evidenceRef || '' });
    });
    const violations = [];
    for (let i = 1; i < positions.length; i++) if (positions[i].p + 40 < positions[i - 1].p) violations.push({ n: positions[i].n, prev: positions[i - 1].n, ref: positions[i].ref });
    return { positions, unresolved, gistMisplaced, violations };
  }

  /**
   * Put the questions into the order of the material and renumber them:
   * non-gist questions by the position of their evidence, a gist question at
   * the end it already occupies (first stays first, otherwise last), a
   * question whose evidence cannot be located keeps its place relative to
   * its predecessor. Returns the same worksheet object when nothing moves.
   */
  function enforceChronology(worksheet, content, kind) {
    const qs = worksheet.questions || [];
    if (qs.length < 2) return { worksheet, moved: [], changed: false };
    const mat = materialText(content, kind);
    const gistFirst = qs[0].skill === 'gist' ? [qs[0]] : [];
    const gistLast = qs.filter((q, i) => q.skill === 'gist' && i > 0);
    const body = qs.filter(q => q.skill !== 'gist');
    let last = -1;
    const keyed = body.map((q, i) => {
      const p = findQuotePosition(mat.text, q.evidenceQuote);
      const pos = p >= 0 ? p : last;
      if (p >= 0) last = p;
      return { q, pos, i };
    });
    keyed.sort((a, b) => a.pos - b.pos || a.i - b.i);
    const ordered = gistFirst.concat(keyed.map(k => k.q), gistLast);
    const moved = [];
    const renumbered = ordered.map((q, i) => {
      if (qs[i] !== q) moved.push(i + 1);
      return Number(q.n) === i + 1 ? q : Object.assign({}, q, { n: i + 1 });
    });
    if (!moved.length) return { worksheet, moved, changed: false };
    return { worksheet: Object.assign({}, worksheet, { questions: renumbered }), moved, changed: true };
  }

  /** Claude's glossary answer → [{word, form, explanation, german}]. */
  function normalizeGlossary(raw) {
    const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.glossary)) ? raw.glossary : [];
    return list.map(g => ({
      word: String((g && (g.word || g.form)) || '').trim(), form: String((g && (g.form || g.word)) || '').trim(),
      explanation: String((g && g.explanation) || '').trim(), german: String((g && g.german) || '').trim(),
    })).filter(g => g.word && g.explanation);
  }

  /** The part of a measurement that is worth storing with the material. */
  function slimMeasurement(m) {
    return { band: m.band, index: m.index, score: m.score, confidence: m.confidence, kind: m.kind, stats: m.stats,
      dimensions: m.dimensions.map(d => ({ key: d.key, label: d.label, unit: d.unit, value: d.value, band: d.band, score: Math.round(d.score * 100) / 100, explain: d.explain })),
      structures: m.structures.map(x => ({ key: x.key, label: x.label, count: x.count, examples: x.examples })),
      hardWords: m.hardWords.slice(0, 40) };
  }

  /*
   * The checks of one task phase. Pre- and post-task are measured the same
   * way — number and type per position, social forms, oral/written, focus,
   * success criteria, time budget and the language of the instructions —
   * and differ only in what the tasks must do with the material.
   */
  function taskRules(phaseKey) {
    const isPre = phaseKey !== 'post';
    const phase = isPre ? 'pre' : 'post';
    const group = isPre ? 'pretask' : 'posttask';
    const name = isPre ? 'pre-task' : 'post-task';
    const Name = isPre ? 'Pre-task' : 'Post-task';
    const field = isPre ? 'preTasks' : 'postTasks';
    const planKey = isPre ? 'preTask' : 'postTask';
    const P = isPre ? 'P' : 'T';
    const numbers = (list) => list.map(x => Number(/(\d+)/.exec(String(x))[1]));
    const mark = (list) => ({ [field]: numbers(list), tasks: numbers(list) });
    const rule = (id, extra) => Object.assign({ id: group + '.' + id, group, phase, kind: 'deterministic', needsWorksheet: true }, extra);
    return [
      rule('present', { title: `Number and types of the ${name}s match the plan`, blocking: true,
        check(ctx) {
          const plan = ctx.plan[planKey];
          const got = ctx.worksheet[field] || [];
          if (!plan) return finding(this, got.length ? 'fail' : 'pass', got.length ? `${got.length} ${name}(s) although none was requested.` : `No ${name} requested.`);
          const wrong = plan.tasks.filter((t, i) => !got[i] || got[i].type !== t.type).map(t => `${P}${t.n} (${(got[t.n - 1] || {}).type || 'missing'} instead of ${t.type})`);
          const status = got.length !== plan.count || wrong.length ? 'fail' : 'pass';
          return finding(this, status, status === 'pass' ? `${plan.count} ${name}(s) of the planned types.` : `${got.length} of ${plan.count} ${name}(s)` + (wrong.length ? '; wrong type at ' + wrong.join(', ') : '') + '.', mark(wrong));
        } }),
      rule('social_forms', { title: 'Social forms match the settings (individual, partner, group, plenary)', needsPhase: true, blocking: true,
        check(ctx) {
          const plan = ctx.plan[planKey];
          const got = ctx.worksheet[field] || [];
          const wrong = plan.tasks.filter((t, i) => got[i] && got[i].socialForm !== t.socialForm).map(t => `${P}${t.n} (${got[t.n - 1].socialForm} instead of ${t.socialForm})`);
          const counts = {};
          for (const p of got) counts[p.socialForm] = (counts[p.socialForm] || 0) + 1;
          const diffs = core.SOCIAL_FORM_KEYS.filter(k => (counts[k] || 0) !== (plan.socialMix[k] || 0)).map(k => `${k} ${counts[k] || 0}/${plan.socialMix[k] || 0}`);
          const status = wrong.length || diffs.length ? 'fail' : 'pass';
          return finding(this, status, status === 'pass'
            ? core.SOCIAL_FORM_KEYS.filter(k => plan.socialMix[k]).map(k => `${plan.socialMix[k]}× ${socialLabel(k)}`).join(', ') + '.'
            : (wrong.length ? 'Wrong social form at ' + wrong.join(', ') + '. ' : '') + (diffs.length ? 'Counts (got/planned): ' + diffs.join(', ') : ''), mark(wrong));
        } }),
      rule('modes', { title: 'Oral and written tasks as configured', needsPhase: true, blocking: true,
        check(ctx) {
          const plan = ctx.plan[planKey];
          const got = ctx.worksheet[field] || [];
          const wrong = plan.tasks.filter((t, i) => got[i] && got[i].mode !== t.mode).map(t => `${P}${t.n} (${got[t.n - 1].mode} instead of ${t.mode})`);
          const oral = got.filter(p => p.mode === 'oral');
          const lonely = oral.filter(p => p.socialForm === 'single').map(p => P + p.n);
          const status = wrong.length || oral.length !== plan.oralCount ? 'fail' : lonely.length ? 'warn' : 'pass';
          return finding(this, status, status === 'pass' ? `${plan.oralCount} of ${plan.count} task(s) oral.`
            : (wrong.length ? 'Wrong mode at ' + wrong.join(', ') + '. ' : '') + (oral.length !== plan.oralCount ? `${oral.length} oral task(s), ${plan.oralCount} planned. ` : '') + (lonely.length ? 'Oral task in individual work: ' + lonely.join(', ') : ''),
          mark(wrong.concat(lonely)));
        } }),
      rule('focus', { title: isPre ? 'Pre-task prepares topic and target vocabulary as configured' : 'Post-task takes the content further and uses the target vocabulary as configured', needsPhase: true, blocking: false,
        check(ctx) {
          const plan = ctx.plan[planKey];
          const got = ctx.worksheet[field] || [];
          const vocabTasks = got.filter(p => p.type === 'vocabulary');
          const problems = [];
          for (const p of vocabTasks) {
            const used = vocabMatches(preTaskText(p), ctx.plan.vocabulary).found;
            if (used.length < 2) problems.push(`${P}${p.n} uses ${used.length} target word(s)`);
          }
          const wantsVocab = plan.focus !== (isPre ? 'topic' : 'content');
          if (wantsVocab && !vocabTasks.length) {
            const anyVocab = got.some(p => vocabMatches(preTaskText(p), ctx.plan.vocabulary).found.length >= 2);
            if (!anyVocab) problems.push('no task works with the target vocabulary');
          }
          if (plan.focus !== 'vocabulary') {
            const topic = String(ctx.plan.topic || ctx.plan.unitTopic || '').toLowerCase().split(/[^a-z\u00E4\u00F6\u00FC]+/).filter(w => w.length > 3);
            const all = got.map(preTaskText).join(' ').toLowerCase();
            if (topic.length && !topic.some(w => all.includes(w.slice(0, Math.max(4, w.length - 2))))) problems.push('no task mentions the topic');
          }
          return finding(this, problems.length ? 'warn' : 'pass', problems.length ? problems.join('; ') + '.' : `Focus "${plan.focus}" covered.`, mark(problems.filter(x => new RegExp('^' + P + '\\d').test(x))));
        } }),
      rule('criteria', { title: `Every ${name} carries observable success criteria`, needsPhase: true, blocking: false,
        check(ctx) {
          const plan = ctx.plan[planKey];
          if (!plan.criteria) return finding(this, 'pass', 'Success criteria not requested.');
          const got = ctx.worksheet[field] || [];
          const bad = got.filter(p => p.criteria.length < 1).map(p => P + p.n);
          const wordy = got.filter(p => p.criteria.some(c => wordCount(c) > 20)).map(p => P + p.n);
          const status = bad.length ? 'fail' : wordy.length ? 'warn' : 'pass';
          return finding(this, status, bad.length ? 'No success criteria at ' + bad.join(', ') + '.' : wordy.length ? 'Criteria too long at ' + wordy.join(', ') + '.' : `All ${name}s carry success criteria.`, mark(bad.concat(wordy)));
        } }),
      rule('time', { title: `Time budget of the ${name} is kept`, needsPhase: true, blocking: false,
        check(ctx) {
          const plan = ctx.plan[planKey];
          const got = ctx.worksheet[field] || [];
          const missing = got.filter(p => !p.minutes).map(p => P + p.n);
          const total = got.reduce((a, p) => a + p.minutes, 0);
          const off = Math.abs(total - plan.minutes) > Math.max(2, plan.minutes * 0.25);
          const status = missing.length || off ? 'warn' : 'pass';
          return finding(this, status, (missing.length ? 'No time given at ' + missing.join(', ') + '. ' : '') + `${total} min planned, budget ${plan.minutes} min.`, mark(missing));
        } }),
      rule('language', { title: `${Name} instructions stay at the configured level`, needsPhase: true, blocking: false,
        check(ctx) {
          const plan = ctx.plan[planKey];
          const exclude = (ctx.plan.vocabulary || []).map(w => w.word);
          const problems = [];
          for (const p of ctx.worksheet[field] || []) {
            const hard = level.hardWordsFor(p.prompt + ' ' + (p.title || ''), plan.band, exclude);
            if (hard.length > 1) problems.push(`${P}${p.n}: ${hard.slice(0, 5).map(h => h.word).join(', ')}`);
          }
          return finding(this, problems.length ? 'warn' : 'pass', problems.length ? `Words above ${plan.band} in the instructions — ` + problems.join('; ') + '.' : `Instructions stay within ${plan.band}.`, mark(problems));
        } }),
    ].concat(isPre ? [
      { id: 'pretask.no_spoilers', group: 'pretask', phase: 'pre', kind: 'llm', title: 'Pre-task does not give away answers', needsWorksheet: true, needsPhase: true, criterion: 'no pre-task anticipates any answer of the comprehension questions or states information that the material is supposed to deliver', failsWhen: 'a pre-task states, names or strongly implies something a comprehension question asks for', evidence: 'tasks', whenUnsure: 'fail', notMine: 'the number, social form, mode and time of the tasks — already measured', blocking: true },
      { id: 'pretask.solvable_before', group: 'pretask', phase: 'pre', kind: 'llm', title: 'Pre-task is solvable without the material', needsWorksheet: true, needsPhase: true, criterion: 'every pre-task can be carried out before the audio/text is known, from the students\' own knowledge, opinions and the words given in the task', failsWhen: 'a pre-task cannot be carried out without already knowing the material', evidence: 'tasks', whenUnsure: 'fail', notMine: 'whether the task uses the target vocabulary — already measured', blocking: true },
      { id: 'pretask.social_fits', group: 'pretask', phase: 'pre', kind: 'llm', title: 'Social form and working mode fit the task', needsWorksheet: true, needsPhase: true, criterion: 'each pre-task really needs its social form (partner/group/plenary tasks give every person something to do and a reason to exchange) and oral tasks ask for speaking rather than writing', failsWhen: 'a partner, group or plenary task gives only one person something to do, or an oral task really asks for writing', evidence: 'tasks', whenUnsure: 'pass', notMine: 'which social form was planned — already measured', blocking: false },
      { id: 'pretask.confrontation', group: 'pretask', phase: 'pre', kind: 'llm', title: 'Confrontation task really confronts', needsWorksheet: true, needsType: 'confrontation', criterion: 'the confrontation task states a claim, dilemma or contradiction that can honestly be argued both ways, makes students take a position and creates curiosity about the material without answering itself', failsWhen: 'the claim has an obvious right answer, cannot be argued without the material, or asks for knowledge instead of a position', evidence: 'tasks', whenUnsure: 'pass', notMine: 'whether a confrontation task exists at all — already measured', blocking: false },
    ] : [
      { id: 'posttask.product', group: 'posttask', phase: 'post', kind: 'deterministic', title: 'Every post-task names what it starts from and what is produced', needsWorksheet: true, needsPhase: true, blocking: false,
        check(ctx) {
          const got = ctx.worksheet.postTasks || [];
          const noProduct = got.filter(p => !p.product).map(p => 'T' + p.n);
          const noRef = got.filter(p => !p.reference).map(p => 'T' + p.n);
          const status = noProduct.length ? 'fail' : noRef.length ? 'warn' : 'pass';
          return finding(this, status, (noProduct.length ? 'No product named at ' + noProduct.join(', ') + '. ' : '') + (noRef.length ? 'No reference to the material at ' + noRef.join(', ') + '.' : '') || 'Every task names its starting point and its product.',
            { postTasks: noProduct.concat(noRef).map(x => Number(/(\d+)/.exec(x)[1])), tasks: noProduct.concat(noRef).map(x => Number(/(\d+)/.exec(x)[1])) });
        } },
      { id: 'posttask.uses_material', group: 'posttask', phase: 'post', kind: 'llm', title: 'Post-task builds on the material', needsWorksheet: true, needsPhase: true, criterion: 'every post-task starts from something concrete in the audio/text (a statement, a decision, an attitude, a number) and could not be given in the same form without that material', failsWhen: 'the task would work word for word with any other text on the topic', evidence: 'tasks', whenUnsure: 'fail', notMine: 'whether a reference and a product are named — already measured', blocking: true },
      { id: 'posttask.beyond_questions', group: 'posttask', phase: 'post', kind: 'llm', title: 'Post-task goes beyond the comprehension questions', needsWorksheet: true, needsPhase: true, criterion: 'no post-task can be solved by repeating an answer of the comprehension questions or a higher-order task; each one asks the students to produce something of their own (a position, a product, a transfer, a mediation)', failsWhen: 'the task is done by repeating an answer of the comprehension questions or of a higher-order task', evidence: 'tasks', whenUnsure: 'fail', notMine: 'the type of the task — already measured', blocking: true },
      { id: 'posttask.social_fits', group: 'posttask', phase: 'post', kind: 'llm', title: 'Social form and working mode fit the task', needsWorksheet: true, needsPhase: true, criterion: 'each post-task really needs its social form (partner/group/plenary tasks give every person something to do and a reason to exchange) and oral tasks ask for speaking rather than writing', failsWhen: 'a partner, group or plenary task gives only one person something to do, or an oral task really asks for writing', evidence: 'tasks', whenUnsure: 'pass', notMine: 'which social form was planned — already measured', blocking: false },
      { id: 'posttask.mediation', group: 'posttask', phase: 'post', kind: 'llm', title: 'Mediation task names addressee and purpose', needsWorksheet: true, needsType: 'mediation', criterion: 'the mediation task names who the information is for and what that person needs it for, and asks the students to select rather than to translate everything', failsWhen: 'the mediation task names no addressee or no purpose, or asks the students to translate everything instead of selecting', evidence: 'tasks', whenUnsure: 'pass', notMine: 'whether a mediation task exists at all — already measured', blocking: false },
    ]);
  }

  function socialLabel(key) { const f = core.SOCIAL_FORMS.find(x => x.key === key); return f ? f.label : key; }
  /** Everything a pre-task shows the students, as one string. */
  function preTaskText(p) { return [p.title, p.prompt, (p.items || []).join(' '), (p.vocabUsed || []).join(' ')].filter(Boolean).join(' '); }

  /* How even a picture has to be: a column filled less than this share of the
     fullest one is a fault, not a style. */
  const PROPORTION_FAIL = 0.6, PROPORTION_WARN = 0.8, PROPORTION_TAIL = 0.25;

  function finding(rule, status, detail, extra) {
    const base = { id: rule.id, group: rule.group, title: rule.title, kind: rule.kind, blocking: !!rule.blocking, status, detail: detail || '' };
    // a rule Claude judges carries its standard, so a repair prompt can quote it
    if (rule.failsWhen) base.failsWhen = rule.failsWhen;
    return Object.assign(base, extra || {});
  }

  const RULES = [
    // Content
    { id: 'content.topic_unit', group: 'content', kind: 'llm', title: 'Topic fits the unit', criterion: 'the theme of the material fits the textbook unit and the intended topic', failsWhen: 'the material could be about any topic and never touches the unit\'s theme, or it contradicts the intended topic', evidence: 'quote', whenUnsure: 'pass', notMine: 'whether the target words appear at all and how long the text is — both are already measured', blocking: false },
    { id: 'content.vocab_used', group: 'content', kind: 'deterministic', title: 'Target vocabulary used sensibly', blocking: true,
      check(ctx) {
        const { plan, state, content } = ctx;
        const m = vocabMatches(materialText(content, state.kind).text, plan.vocabulary);
        const [min] = plan.vocabRange;
        const manual = state.vocabSelectionMode === 'manual';
        const required = manual ? plan.vocabulary.length : Math.min(min, plan.vocabulary.length);
        const ok = m.found.length >= required;
        return finding(this, ok ? 'pass' : 'fail', `${m.found.length} of ${plan.vocabulary.length} target items found (required: ${required}).` + (m.missing.length && (manual || !ok) ? ' Missing: ' + m.missing.slice(0, 12).join(', ') : ''), { found: m.found, missing: m.missing });
      } },
    { id: 'content.vocab_natural', group: 'content', kind: 'llm', title: 'Vocabulary integrated naturally', criterion: 'target words are integrated naturally and not forced into the text', failsWhen: 'a target word sits in a sentence that exists only to place it, in a collocation nobody uses, or is explained like a glossary entry', evidence: 'quote', whenUnsure: 'pass', notMine: 'whether the words appear at all — that is already measured', blocking: false },
    { id: 'content.coherent', group: 'content', kind: 'llm', title: 'Text is coherent', criterion: 'the text/conversation is coherent and logically consistent', failsWhen: 'facts, names, numbers or the order of events contradict each other, somebody knows something they cannot know, or a pronoun has no antecedent', evidence: 'quote', whenUnsure: 'fail', notMine: 'language level and naturalness — those are their own rules', blocking: true },
    { id: 'content.natural', group: 'content', kind: 'llm', title: 'Conversation/text sounds natural', criterion: 'the language sounds natural for the format and the naturalness setting', failsWhen: 'the text reads like an exercise instead of the real format: a dialogue without reactions, a blog post without a voice, no discourse markers although naturalness is set high', evidence: 'quote', whenUnsure: 'pass', notMine: 'the CEFR level and the coherence of the content', blocking: false },
    { id: 'content.level', group: 'content', kind: 'llm', title: 'Language matches the CEFR level', criterion: 'the language stays at the configured CEFR level (not clearly above or below)', failsWhen: 'single structures or words would stop a learner at this level even though the measured average fits, or the text stays far below the level in every sentence', evidence: 'quote', whenUnsure: 'pass', notMine: 'the measured band, sentence length and word frequencies — the meter reports those, judge only what it cannot see', blocking: true },
    { id: 'content.level_measured', group: 'content', kind: 'deterministic', title: 'Measured difficulty matches the CEFR level', blocking: false,
      check(ctx) {
        if (ctx.plan.levelMeter === false) return finding(this, 'pass', 'Level meter switched off.');
        const measured = level.measure(ctx.content, ctx.state.kind, { seconds: ctx.plan.seconds, exclude: (ctx.plan.vocabulary || []).map(w => w.word) });
        const cmp = level.compare(measured, ctx.plan.cefr);
        const dims = measured.dimensions.map(d => `${d.label} ${d.value} ${d.unit} → ${d.band}`).join('; ');
        const advice = cmp.deviations.filter(d => Math.abs(d.steps) >= 1).map(d => d.suggestion).join(' ');
        const detail = `Measured ${measured.band} (score ${measured.score}, confidence ${measured.confidence}), target ${ctx.plan.cefr}. ${dims}.` + (advice && cmp.status !== 'pass' ? ' To fix: ' + advice : '');
        return finding(this, cmp.status, detail, { measured: slimMeasurement(measured), comparison: { delta: cmp.delta, deviations: cmp.deviations } });
      } },
    { id: 'content.word_count', group: 'content', kind: 'deterministic', title: 'Length matches the target', blocking: true,
      check(ctx) {
        const n = wordCount(materialText(ctx.content, ctx.state.kind).text.replace(/^[^:\n]+: /gm, ''));
        const t = ctx.plan.targetWords;
        const dev = t ? Math.abs(n - t) / t : 0;
        return finding(this, dev <= 0.2 ? 'pass' : dev <= 0.35 ? 'warn' : 'fail', `${n} words, target ${t} (deviation ${Math.round(dev * 100)} %).`, { measured: n, target: t });
      } },
    { id: 'content.meta_fields', group: 'content', kind: 'deterministic', title: 'Document details for the text type are complete', blocking: false,
      check(ctx) {
        const spec = core.META_SPECS[core.designIdFor(ctx.state)] || core.META_SPECS.custom;
        const meta = ctx.content.meta || {};
        const missing = (spec.required || []).filter(k => meta[k] === undefined || meta[k] === '' || (Array.isArray(meta[k]) && !meta[k].length));
        const perPara = ['authors', 'speakers', 'timestamps'].filter(k => Array.isArray(meta[k]));
        const n = ctx.state.kind === 'reading' ? (ctx.content.paragraphs || []).length : 0;
        const misaligned = perPara.filter(k => meta[k].length !== n);
        const status = missing.length ? 'warn' : misaligned.length ? 'warn' : 'pass';
        return finding(this, status,
          (missing.length ? 'Missing: ' + missing.join(', ') + '. ' : '')
          + (misaligned.length ? misaligned.map(k => `${k} has ${meta[k].length} entries for ${n} paragraphs`).join('; ') + '.' : '')
          || `${spec.label}: all details present.`);
      } },
    // Listening
    { id: 'listening.shares', group: 'listening', kind: 'deterministic', title: 'Speaking shares match the settings', only: 'listening', blocking: true,
      check(ctx) {
        const stats = speakerStats(ctx.content.lines);
        const target = ctx.plan.speakers;
        if (target.length < 2) return finding(this, 'pass', 'Single speaker.');
        let maxDev = 0; const parts = [];
        for (const sp of target) {
          const got = stats.shares[sp.label] || 0;
          maxDev = Math.max(maxDev, Math.abs(got - sp.share));
          parts.push(`${sp.label} ${got} % (target ${sp.share} %)`);
        }
        return finding(this, maxDev <= 10 ? 'pass' : maxDev <= 18 ? 'warn' : 'fail', parts.join(', ') + `; largest deviation ${maxDev} pp.`, { shares: stats.shares });
      } },
    { id: 'listening.speakers_present', group: 'listening', kind: 'deterministic', title: 'All speakers present with the planned labels', only: 'listening', blocking: true,
      check(ctx) {
        const used = new Set((ctx.content.lines || []).map(l => l.speaker));
        const missing = ctx.plan.speakerLabels.filter(l => !used.has(l));
        const unknown = [...used].filter(u => !ctx.plan.speakerLabels.includes(u));
        const ok = missing.length === 0 && unknown.length === 0;
        return finding(this, ok ? 'pass' : 'fail', (missing.length ? 'Missing: ' + missing.join(', ') + '. ' : '') + (unknown.length ? 'Unexpected labels: ' + unknown.join(', ') : '') || 'All labels used.');
      } },
    { id: 'listening.distinguishable', group: 'listening', kind: 'llm', title: 'Speakers are clearly distinguishable', only: 'listening', criterion: 'the speakers are clearly distinguishable by what they say, their role and their manner of speaking', failsWhen: 'swapping the speaker labels would change nothing: same register, same role, same knowledge', evidence: 'quote', whenUnsure: 'pass', notMine: 'the speaking shares and the number of turns — already measured', blocking: false },
    { id: 'listening.emotion_tags', group: 'listening', kind: 'deterministic', title: 'Emotion tags are distributed sensibly', only: 'listening', blocking: false,
      check(ctx) {
        const st = tagStats(ctx.content.lines);
        const target = ctx.plan.emotionTarget;
        if (st.invalid.length) return finding(this, 'fail', 'Tags outside the allowed list: ' + st.invalid.join(', '));
        if (target === 0) return finding(this, st.tagged === 0 ? 'pass' : 'fail', `${st.tagged} tags although tags are OFF.`);
        if (st.total > 1 && st.tagged === st.total) return finding(this, 'fail', 'Every turn carries a tag; tags must be selective.');
        const dev = Math.abs(st.ratio - target);
        return finding(this, dev <= 0.15 ? 'pass' : dev <= 0.25 ? 'warn' : 'fail', `${st.tagged} of ${st.total} turns tagged (${Math.round(st.ratio * 100)} %, target ≈ ${Math.round(target * 100)} %).`);
      } },
    { id: 'listening.turns', group: 'listening', kind: 'deterministic', title: 'Turn length and variability match the settings', only: 'listening', blocking: false,
      check(ctx) {
        const st = speakerStats(ctx.content.lines);
        if (ctx.plan.speakerCount < 2) return finding(this, 'pass', 'Monologue.');
        const target = ctx.plan.turnWords;
        const dev = target ? Math.abs(st.meanTurn - target) / target : 0;
        const wantCV = 0.25 + (Number(ctx.state.turnVariability) || 0) / 100 * 0.75; // 0.25 … 1.0
        const cvDev = Math.abs(st.turnCV - wantCV);
        const status = dev <= 0.35 && cvDev <= 0.35 ? 'pass' : dev <= 0.6 && cvDev <= 0.5 ? 'warn' : 'fail';
        return finding(this, status, `Mean ${st.meanTurn.toFixed(1)} words/turn (target ≈ ${target}); variability ${st.turnCV.toFixed(2)} (target ≈ ${wantCV.toFixed(2)}); ${st.turns} turns.`);
      } },
    { id: 'listening.no_artificial_switches', group: 'listening', kind: 'llm', title: 'No unnecessarily artificial speaker changes', only: 'listening', criterion: 'speaker changes are motivated by the conversation; there are no artificial switches', failsWhen: 'a speaker change has no reason in the conversation, e.g. one thought is cut in two or somebody answers a question nobody asked', evidence: 'quote', whenUnsure: 'pass', notMine: 'turn length and variability — already measured', blocking: false },
    // Questions
    { id: 'questions.count', group: 'questions', kind: 'deterministic', title: 'Number of questions matches', needsWorksheet: true, blocking: true,
      check(ctx) {
        const n = ctx.worksheet.questions.length;
        return finding(this, n === ctx.plan.questionCount ? 'pass' : 'fail', `${n} questions, ${ctx.plan.questionCount} planned.`);
      } },
    { id: 'questions.answerable', group: 'questions', kind: 'llm', title: 'Every question is answerable unambiguously', needsWorksheet: true, criterion: 'every question has exactly one defensible answer', failsWhen: 'a question has more than one defensible answer, or none at all, for a student who has understood the material', evidence: 'questions', whenUnsure: 'fail', notMine: 'whether the evidence quote exists in the material (measured) and whether the answer follows from it (questions.derivable)', blocking: true },
    { id: 'questions.derivable', group: 'questions', kind: 'llm', title: 'Correct answer follows from the material', needsWorksheet: true, criterion: 'each key answer can actually be derived from the material (and from the evidence quote given)', failsWhen: 'the key answer needs knowledge from outside the material, or the evidence quote given does not support it', evidence: 'questions', whenUnsure: 'fail', notMine: 'ambiguity of the question itself — that is questions.answerable', blocking: true },
    { id: 'questions.distractors', group: 'questions', kind: 'llm', title: 'Distractors are plausible', needsWorksheet: true, criterion: 'distractors in closed formats are plausible but clearly wrong', failsWhen: 'a distractor is also correct, or so absurd that it can be ruled out without reading the material', evidence: 'questions', whenUnsure: 'pass', notMine: 'the number of options and whether the answer is one of them — already measured', blocking: false },
    { id: 'questions.complete', group: 'questions', kind: 'deterministic', title: 'Every question can be used as it stands', needsWorksheet: true, blocking: true,
      check(ctx) {
        const bad = [], soft = [];
        const answerOf = (q) => (Array.isArray(q.answer) ? q.answer.join(', ') : String(q.answer == null ? '' : q.answer)).trim();
        const optionsOf = (q) => (Array.isArray(q.options) ? q.options : []).map(o => String(o).trim()).filter(Boolean);
        const itemsOf = (q) => (Array.isArray(q.items) ? q.items : []);
        const letterIndex = (a) => (/^[A-Za-z]$/.test(a) ? a.toUpperCase().charCodeAt(0) - 65 : -1);
        for (const q of ctx.worksheet.questions || []) {
          const answer = answerOf(q), opts = optionsOf(q), items = itemsOf(q);
          const text = String(q.prompt || q.statement || '').trim();
          const say = (why) => bad.push(`Q${q.n}: ${why}`);
          if (!text) say('no question text');
          if (!answer && !items.length) say('no answer');
          switch (q.format) {
            case 'multiple_choice': case 'best_summary': {
              if (opts.length < 3) say(`only ${opts.length} option(s)`);
              else {
                const i = letterIndex(answer);
                const hit = i >= 0 ? i < opts.length : opts.some(o => normalizeForSearch(o) === normalizeForSearch(answer));
                if (!hit) say(`the answer “${answer}” is not one of the options`);
              }
              break;
            }
            case 'select_all': {
              if (opts.length < 3) say(`only ${opts.length} option(s)`);
              const letters = (Array.isArray(q.answer) ? q.answer : String(q.answer || '').split(/[,\s]+/)).map(x => letterIndex(String(x).trim()));
              if (!letters.length || letters.some(i => i < 0 || i >= opts.length)) say('the answer does not name options that exist');
              break;
            }
            case 'true_false': case 'true_false_correction': {
              if (!/^(true|false)$/i.test(answer)) say(`the answer “${answer}” is not True or False`);
              if (q.format === 'true_false_correction' && /^false$/i.test(answer) && !String(q.correction || '').trim()) soft.push(`Q${q.n}: no correction for a false statement`);
              break;
            }
            case 'matching': {
              const pairs = items.filter(it => it && String(it.left || '').trim() && String(it.right || '').trim());
              if (pairs.length < 3) say(`only ${pairs.length} complete pair(s)`);
              break;
            }
            case 'ordering': { if (items.length < 3) say(`only ${items.length} item(s) to order`); break; }
            case 'who_said_it': {
              if (opts.length < 2) say('fewer than two speakers to choose from');
              else if (!opts.some(o => normalizeForSearch(o) === normalizeForSearch(answer)) && letterIndex(answer) < 0) say(`the answer “${answer}” is not one of the speakers`);
              break;
            }
            case 'table_completion': {
              const t = q.table || {};
              if (!Array.isArray(t.rows) || !t.rows.length) say('no table');
              if (!Array.isArray(q.answer) || !q.answer.length) say('no entries for the blanks');
              break;
            }
            case 'gap_fill': case 'note_taking': {
              if (!Array.isArray(q.answer) || !q.answer.length) say('no list of answers for the gaps');
              break;
            }
            case 'sentence_completion': { if (!/_{2,}|\.\.\./.test(text)) soft.push(`Q${q.n}: no gap marked in the sentence`); break; }
            default: break;
          }
        }
        const numbers = (list) => [...new Set(list.map(x => Number(/(\d+)/.exec(x)[1])))].sort((a, b) => a - b);
        const status = bad.length ? 'fail' : soft.length ? 'warn' : 'pass';
        return finding(this, status, bad.concat(soft).join('; ') + (bad.length || soft.length ? '.' : '')
          || `All ${(ctx.worksheet.questions || []).length} question(s) complete.`, { questions: numbers(bad.concat(soft)) });
      } },
    { id: 'questions.chronology', group: 'questions', kind: 'deterministic', title: 'Questions follow the timeline of the audio/text', needsWorksheet: true, blocking: true,
      check(ctx) {
        const r = chronologyReport(ctx.worksheet, ctx.content, ctx.state.kind);
        const problems = [];
        if (r.violations.length) problems.push('Out of order: ' + r.violations.map(v => `Q${v.n} (${v.ref}) before Q${v.prev}`).join('; ') + '.');
        if (r.gistMisplaced.length) problems.push('Gist question not at the beginning or end: Q' + r.gistMisplaced.join(', Q') + '.');
        if (r.unresolved.length) problems.push('Position unknown, evidence quote not found verbatim: Q' + r.unresolved.join(', Q') + '.');
        const status = problems.length ? 'fail' : 'pass';
        return finding(this, status, problems.length ? problems.join(' ') : `Timeline verified for ${r.positions.length} question(s).`,
          { questions: [...new Set(r.violations.map(v => v.n).concat(r.gistMisplaced, r.unresolved))].sort((a, b) => a - b) });
      } },
    { id: 'questions.no_duplicates', group: 'questions', kind: 'deterministic', title: 'No two questions test the same information', needsWorksheet: true, blocking: false,
      check(ctx) {
        const mat = materialText(ctx.content, ctx.state.kind);
        const seen = [];
        const dupes = [];
        for (const q of ctx.worksheet.questions) {
          const p = findQuotePosition(mat.text, q.evidenceQuote);
          const ans = normalizeForSearch(typeof q.answer === 'string' ? q.answer : JSON.stringify(q.answer || ''));
          for (const s of seen) {
            const sameSpot = p >= 0 && s.p >= 0 && Math.abs(p - s.p) < 25;
            const sameAns = ans && ans.length > 3 && ans === s.ans && q.skill === s.skill;
            if (sameSpot && (q.skill === s.skill || sameAns)) dupes.push(`Q${s.n}/Q${q.n}`);
          }
          seen.push({ n: q.n, p, ans, skill: q.skill });
        }
        return finding(this, dupes.length ? 'warn' : 'pass', dupes.length ? 'Possible duplicates: ' + dupes.join(', ') : 'No duplicated evidence.', { questions: dupes.flatMap(d => d.replace(/Q/g, '').split('/').map(Number)) });
      } },
    { id: 'questions.duplicates_llm', group: 'questions', kind: 'llm', title: 'No two questions test exactly the same information (review)', needsWorksheet: true, criterion: 'no two questions test exactly the same piece of information', failsWhen: 'two questions are answered by the same information, even when they quote different places', evidence: 'questions', whenUnsure: 'pass', notMine: 'questions that point at the same spot with the same skill — already measured', blocking: false },
    { id: 'questions.skill_distribution', group: 'questions', kind: 'deterministic', title: 'Skill distribution matches the settings', needsWorksheet: true, blocking: true,
      check(ctx) {
        const counts = {};
        for (const q of ctx.worksheet.questions) counts[q.skill] = (counts[q.skill] || 0) + 1;
        const diffs = core.SKILL_KEYS.filter(k => (counts[k] || 0) !== (ctx.plan.skillMix[k] || 0)).map(k => `${k} ${counts[k] || 0}/${ctx.plan.skillMix[k] || 0}`);
        const unknown = ctx.worksheet.questions.filter(q => !core.SKILL_KEYS.includes(q.skill)).map(q => q.n);
        const status = diffs.length === 0 && unknown.length === 0 ? 'pass' : 'fail';
        return finding(this, status, status === 'pass' ? 'Every skill has the planned number of questions.' : 'Questions per skill differ from the plan (got/planned): ' + diffs.join(', ') + (unknown.length ? '; unknown skill at Q' + unknown.join(', Q') : '') + '.', { questions: unknown });
      } },
    { id: 'questions.formats', group: 'questions', kind: 'deterministic', title: 'Only enabled response formats are used', needsWorksheet: true, blocking: true,
      check(ctx) {
        const bad = ctx.worksheet.questions.filter(q => !ctx.plan.formats.includes(q.format)).map(q => `Q${q.n} (${q.format || 'none'})`);
        let mixDiff = [];
        if (ctx.plan.formatSequence) {
          const want = {}, got = {};
          for (const f of ctx.plan.formatSequence) want[f] = (want[f] || 0) + 1;
          for (const q of ctx.worksheet.questions) got[q.format] = (got[q.format] || 0) + 1;
          mixDiff = Object.keys(want).filter(f => (got[f] || 0) !== want[f]).map(f => `${f} ${got[f] || 0}/${want[f]}`);
        }
        const status = bad.length ? 'fail' : mixDiff.length ? 'warn' : 'pass';
        return finding(this, status, bad.length ? 'Disabled formats: ' + bad.join(', ') : mixDiff.length ? 'Balanced mix not followed (got/planned): ' + mixDiff.join(', ') : 'Formats as planned.', { questions: bad.map(s => Number(/\d+/.exec(s)[0])) });
      } },
    { id: 'questions.level_band', group: 'questions', kind: 'deterministic', title: 'Question bands stay within the question level', needsWorksheet: true, blocking: false,
      check(ctx) {
        const allowed = ctx.plan.questionBands || [ctx.plan.questionBand];
        const off = ctx.worksheet.questions.filter(q => q.difficulty && !allowed.includes(q.difficulty)).map(q => q.n);
        const missing = ctx.worksheet.questions.filter(q => !q.difficulty).map(q => q.n);
        const status = off.length ? 'warn' : 'pass';
        return finding(this, status, (off.length ? `Outside ${allowed.join('/')}: Q${off.join(', Q')}. ` : `All questions labelled ${allowed.join('/')}` + (ctx.plan.questionLevelLabel ? ` (${ctx.plan.questionLevelLabel})` : '') + '.') + (missing.length ? ` No band given for Q${missing.join(', Q')}.` : ''), { questions: off });
      } },
    { id: 'questions.difficulty', group: 'questions', kind: 'llm', title: 'Difficulty matches the requested level', needsWorksheet: true, criterion: 'the questions, their options and the expected answers match the allowed question band(s) and the difficulty setting (not clearly easier or harder)', failsWhen: 'the expected answer, the options or the question itself need language clearly above or below the allowed band', evidence: 'questions', whenUnsure: 'pass', notMine: 'the difficulty label on the question — already checked against the band', blocking: false },
    { id: 'questions.inference_genuine', group: 'questions', kind: 'llm', title: 'Inference questions are genuinely inferential', needsWorksheet: true, criterion: 'questions labelled inference require reasoning beyond explicitly stated information and are not hidden detail questions', failsWhen: 'a question labelled inference can be answered by copying one sentence of the material', evidence: 'questions', whenUnsure: 'fail', notMine: 'the skill distribution over the whole worksheet — already measured', blocking: true },
    { id: 'questions.evidence', group: 'questions', kind: 'deterministic', title: 'Every question has verifiable evidence', needsWorksheet: true, blocking: false,
      check(ctx) {
        const mat = materialText(ctx.content, ctx.state.kind);
        const missing = ctx.worksheet.questions.filter(q => !q.evidenceQuote || findQuotePosition(mat.text, q.evidenceQuote) < 0).map(q => q.n);
        return finding(this, missing.length === 0 ? 'pass' : missing.length <= 2 ? 'warn' : 'fail', missing.length ? 'Evidence not found verbatim for Q' + missing.join(', Q') : 'All evidence quotes located in the material.', { questions: missing });
      } },
    { id: 'questions.higher_order_separate', group: 'questions', kind: 'deterministic', title: 'Higher-order tasks are separate and complete', needsWorksheet: true, blocking: false,
      check(ctx) {
        const ho = ctx.worksheet.higherOrder;
        const want = ctx.plan.higherOrderCount;
        const mixedIn = ctx.worksheet.questions.filter(q => ['interpretation', 'transfer', 'evaluation'].includes(q.skill)).length;
        const badType = ho.filter(h => !ctx.plan.higherOrderTypes.includes(h.type)).length;
        const ok = ho.length === want && mixedIn === 0 && badType === 0;
        return finding(this, ok ? 'pass' : 'fail', `${ho.length} higher-order task(s), ${want} planned` + (mixedIn ? `; ${mixedIn} mixed into the comprehension questions` : '') + (badType ? `; ${badType} with a type that is not enabled` : '') + '.');
      } },
    ...taskRules('pre'),
    ...taskRules('post'),
    // Authentic layout (concept §37): the picture of the text in its real medium
    { id: 'layout.fields', group: 'layout', kind: 'deterministic', title: 'Interface of the medium is complete', needsLayout: true, blocking: true,
      check(ctx) {
        const spec = mock.chromeSpec({ settings: ctx.state, content: ctx.content });
        const c = (ctx.layout && ctx.layout.chrome) || {};
        const missing = spec.required.filter(k => {
          const v = c[k];
          return Array.isArray(v) ? v.length === 0 : !String(v || '').trim();
        });
        const longOnes = Object.keys(c).filter(k => typeof c[k] === 'string' && c[k].length > 120);
        const status = missing.length ? 'fail' : longOnes.length ? 'warn' : 'pass';
        return finding(this, status, missing.length ? `Missing for ${spec.label}: ${missing.join(', ')}.`
          : longOnes.length ? 'Too long for an interface: ' + longOnes.join(', ') + '.' : `${spec.label}: all parts present.`);
      } },
    { id: 'layout.text_identical', group: 'layout', kind: 'deterministic', title: 'The picture shows exactly the generated text', needsLayout: true, blocking: true,
      check(ctx) {
        const model = layoutModel({ settings: ctx.state, content: ctx.content, layout: ctx.layout });
        const shown = normalizeForSearch(mock.bodyText(model));
        const source = normalizeForSearch((ctx.content.paragraphs || []).join(' '));
        if (shown === source) return finding(this, 'pass', `${(ctx.content.paragraphs || []).length} paragraph(s), word for word the same as in the text.`);
        const missing = (ctx.content.paragraphs || []).filter(p => !shown.includes(normalizeForSearch(p).slice(0, 60))).length;
        const extra = Math.max(0, shown.split(' ').length - source.split(' ').length);
        return finding(this, 'fail', `The picture does not show the text unchanged: ${missing} paragraph(s) missing` + (extra ? `, ${extra} word(s) too many` : '') + '.');
      } },
    { id: 'layout.no_invented_text', group: 'layout', kind: 'deterministic', title: 'The interface does not retell the text', needsLayout: true, blocking: false,
      check(ctx) {
        const model = layoutModel({ settings: ctx.state, content: ctx.content, layout: ctx.layout });
        const source = (ctx.content.paragraphs || []).join(' ');
        const copies = (model.blocks || []).filter(b => b.type === 'text' && b.role !== 'body' && b.text.split(/\s+/).length >= 5 && sharedRun(b.text, source) >= 6).map(b => b.text);
        return finding(this, copies.length ? 'warn' : 'pass', copies.length ? 'Interface repeats the text: “' + copies[0].slice(0, 60) + '”.' : 'The interface adds no sentences from the text.');
      } },
    { id: 'layout.image_valid', group: 'layout', kind: 'deterministic', title: 'The picture can be drawn and handed out', needsLayout: true, blocking: true,
      check(ctx) {
        const model = layoutModel({ settings: ctx.state, content: ctx.content, layout: ctx.layout });
        const problems = mock.validate(model);
        return finding(this, problems.length ? 'fail' : 'pass', problems.length ? problems.join('; ') : `${model.label}: ${model.width} × ${model.height} px, ${model.blocks.length} elements.`);
      } },
    { id: 'layout.proportions', group: 'layout', kind: 'deterministic', title: 'The picture is in proportion', needsLayout: true, blocking: false,
      check(ctx) {
        const model = layoutModel({ settings: ctx.state, content: ctx.content, layout: ctx.layout });
        const p = mock.proportions(model);
        const pct = (x) => Math.round(x * 100) + ' %';
        const cols = p.columns;
        const problems = [];
        if (cols.length > 1) {
          const worst = cols.reduce((a, c) => (c.filled < a.filled ? c : a), cols[0]);
          if (p.balance < PROPORTION_FAIL) problems.push(`Column ${worst.index + 1} of ${cols.length} is only filled to ${pct(worst.filled)} while another one is full.`);
          else if (p.balance < PROPORTION_WARN) problems.push(`The columns are uneven: ${cols.map(c => pct(c.filled)).join(' / ')}.`);
        }
        if (p.tail > PROPORTION_TAIL) problems.push(`The page ends ${pct(p.tail)} of its height below the last element.`);
        const status = problems.length ? (p.balance < PROPORTION_FAIL ? 'fail' : 'warn') : 'pass';
        const detail = problems.length ? problems.join(' ')
          : (cols.length > 1 ? `${cols.length} columns, evenly filled (${cols.map(c => pct(c.filled)).join(' / ')}).` : `One column, the page ends ${pct(p.tail)} below the text.`);
        return finding(this, status, detail, { measured: { balance: Math.round(p.balance * 100) / 100, tail: Math.round(p.tail * 100) / 100, columns: cols.map(c => Math.round(c.filled * 100) / 100) } });
      } },
    { id: 'layout.authentic', group: 'layout', kind: 'llm', title: 'The medium looks real and fits the text', needsLayout: true,
      criterion: 'the interface around the text (address, site or app name, navigation, buttons, counts, times) is what that medium really looks like and fits this text: same world, names, places and dates agree, nothing contradicts the text', failsWhen: 'the interface contradicts the text (other names, places, dates) or shows something this medium does not have', evidence: 'chrome', whenUnsure: 'pass', notMine: 'completeness of the interface fields and whether the picture shows the text unchanged — both are measured', blocking: false },
  ];

  /** Claude's interface data → the shape the picture is built from. */
  function normalizeChrome(raw, spec) {
    const out = {};
    const src = raw && typeof raw === 'object' ? raw : {};
    for (const [key] of spec.fields) {
      const v = src[key];
      if (Array.isArray(v)) {
        out[key] = v.map(x => (x && typeof x === 'object')
          ? { label: String(x.label || x.title || '').trim(), count: String(x.count === undefined || x.count === null ? '' : x.count).trim() }
          : String(x).trim()).filter(x => (typeof x === 'string' ? x : x.label));
      } else if (v !== undefined && v !== null && typeof v !== 'object') {
        out[key] = String(v).trim();
      } else if (v && typeof v === 'object') {
        out[key] = String(v.label || '').trim();
      } else out[key] = '';
    }
    return out;
  }

  /** Claude's interface data over what the material itself already tells us. */
  function mergeChrome(fallback, fromClaude) {
    const out = Object.assign({}, fallback || {});
    for (const [k, v] of Object.entries(fromClaude || {})) {
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
      if (!empty) out[k] = v;
    }
    return out;
  }

  /** The picture as it will be drawn, from the stored interface data. */
  function layoutModel(material, opts) {
    const chrome = (material.layout && material.layout.chrome) || {};
    return mock.buildModel(material, chrome, opts);
  }

  /** Longest run of words that a string shares with the material. */
  function sharedRun(text, source) {
    const a = normalizeForSearch(text).split(' ').filter(Boolean);
    const hay = ' ' + normalizeForSearch(source) + ' ';
    let best = 0;
    for (let i = 0; i < a.length; i++) {
      for (let len = Math.min(12, a.length - i); len > best; len--) {
        if (hay.includes(' ' + a.slice(i, i + len).join(' ') + ' ')) { best = len; break; }
      }
    }
    return best;
  }

  function applicableRules(state, plan, worksheet) {
    return RULES.filter(r => {
      if (r.only && r.only !== state.kind) return false;
      if (r.needsWorksheet && !worksheet) return false;
      if (r.needsLayout && !plan.authenticLayout) return false;
      if (r.phase) {
        const p = plan[r.phase === 'post' ? 'postTask' : 'preTask'];
        if (r.needsPhase && !(p && p.count)) return false;
        if (r.needsType && !(p && p.types.includes(r.needsType))) return false;
      }
      return true;
    });
  }

  /** Run all deterministic rules. */
  /** `extras` carries what is not part of the material itself yet, e.g. {layout}. */
  function runDeterministic(state, plan, content, worksheet, extras) {
    const ctx = Object.assign({ state, plan, content, worksheet }, extras || {});
    return applicableRules(state, plan, worksheet).filter(r => r.kind === 'deterministic' && (!r.needsLayout || ctx.layout)).map(r => r.check(ctx));
  }

  /** Deterministic rules that judge content only (used before the questions are written). */
  function runContentChecks(state, plan, content, extras) {
    return runDeterministic(state, plan, content, null, extras);
  }

  /** `extras` may carry {layout}: rules that judge it are only asked when it exists. */
  function llmRules(state, plan, worksheet, extras) {
    const has = extras || {};
    return applicableRules(state, plan, worksheet).filter(r => r.kind === 'llm' && (!r.needsLayout || has.layout));
  }

  const EMPTY_NOTE = /^(ok(ay)?|fine|good|great|pass(ed)?|yes|no|none|n\/a|alles ok|passt|gut|in ordnung|no issues?|looks good|seems fine)[.!]?$/i;

  /**
   * Is the verdict carried by something? A rule asks for question or task
   * numbers, or for a quote; a verdict that names neither is an opinion, and
   * an opinion is not a check. Used to keep an unsupported "pass" on a
   * blocking rule out of the report as a pass.
   */
  function verdictSupported(rule, note, evidence, questions) {
    const text = (evidence + ' ' + note).trim();
    if (!text || EMPTY_NOTE.test(note.trim())) return !!questions.length;
    if (rule.evidence === 'questions' || rule.evidence === 'tasks') return questions.length > 0 || /\d/.test(text);
    return text.split(/\s+/).filter(Boolean).length >= 4;
  }

  /**
   * Merge Claude's review into findings. What comes back is an opinion, so it
   * is taken only as far as it is usable: verdicts for rules that were never
   * asked are dropped, a missing verdict stays "unverified", and a "pass" on
   * a blocking rule without any basis is counted as unverified rather than as
   * a check that was carried out.
   *
   * `opts.unavailable` lists rules whose data never reached the review prompt.
   * They are reported as unverified and never as a fail: a rule that was not
   * shown its data has judged nothing, so it must not block the material.
   */
  function mergeReview(rules, review, opts) {
    const results = (review && Array.isArray(review.results)) ? review.results : [];
    const unavailable = (opts && opts.unavailable) || [];
    return rules.map(r => {
      if (unavailable.indexOf(r.id) >= 0) {
        return finding(r, 'unverified', 'Die Daten zu dieser Regel standen nicht im Pr\u00fcf-Prompt \u2013 nicht gepr\u00fcft.', { missingData: true });
      }
      const hit = results.find(x => x && typeof x === 'object' && String(x.rule) === r.id);
      if (!hit) return finding(r, 'unverified', 'No verdict returned.');
      const note = String(hit.note == null ? '' : hit.note).slice(0, 400).trim();
      const evidence = String(hit.evidence == null ? '' : hit.evidence).slice(0, 300).trim();
      const questions = (Array.isArray(hit.questions) ? hit.questions : []).map(Number).filter(n => Number.isFinite(n) && n > 0 && n < 1000);
      const supported = verdictSupported(r, note, evidence, questions);
      const detail = [note, evidence && !note.includes(evidence) ? '„' + evidence + '“' : ''].filter(Boolean).join(' ');
      if (hit.pass && !supported && r.blocking) {
        return finding(r, 'unverified', (detail ? detail + ' — ' : '') + 'Zusage ohne Beleg: nicht als geprüft gewertet.', { questions, unsupported: true });
      }
      return finding(r, hit.pass ? 'pass' : 'fail', detail, { questions, unsupported: !supported });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Repair: which findings can be fixed, and how to apply a fix          */
  /* ------------------------------------------------------------------ */

  /** Findings the app should act on at a given level ('off' | 'fail' | 'all'). */
  function repairable(findings, level) {
    if (!level || level === 'off') return [];
    return (findings || []).filter(f => f.status === 'fail' || (level === 'all' && f.status === 'warn'));
  }

  /**
   * Split the findings into the questions that must be rewritten and the
   * problems that need the whole text or worksheet redone.
   */
  function repairPlan(findings, level) {
    const items = repairable(findings, level);
    const questions = new Set();
    const global = [];
    for (const f of items) {
      const qs = (f.questions || []).map(Number).filter(n => Number.isFinite(n) && n > 0);
      if (f.group === 'questions' && qs.length && !STRUCTURAL.includes(f.id)) qs.forEach(n => questions.add(n));
      else global.push(f);
    }
    return {
      items, questions: [...questions].sort((a, b) => a - b), global,
      content: global.filter(f => !['questions', 'pretask', 'posttask'].includes(f.group)),
      worksheet: global.filter(f => f.group === 'questions'),
      preTasks: global.filter(f => f.group === 'pretask'),
      postTasks: global.filter(f => f.group === 'posttask'),
    };
  }

  /* Problems that a single replaced question cannot fix. */
  const STRUCTURAL = ['questions.count', 'questions.skill_distribution', 'questions.higher_order_separate', 'pretask.present', 'posttask.present'];

  /** Which task numbers of one phase changed between two worksheets. */
  function changedTasks(before, after, phaseKey) {
    const field = phaseKey === 'post' ? 'postTasks' : 'preTasks';
    const out = [];
    const byN = new Map((after[field] || []).map(p => [Number(p.n), p]));
    for (const p of before[field] || []) {
      const b = byN.get(Number(p.n));
      if (!b || JSON.stringify(b) !== JSON.stringify(p)) out.push(Number(p.n));
    }
    return out;
  }
  function changedPreTasks(before, after) { return changedTasks(before, after, 'pre'); }
  function changedPostTasks(before, after) { return changedTasks(before, after, 'post'); }

  /** Lower is better: failures weigh ten times a warning. */
  function problemScore(findings) {
    const s = summarize(findings);
    return s.fail * 10 + s.warn + s.unverified * 0.1;
  }

  /** Replace individual questions by number, keeping plan and numbering intact. */
  function applyQuestionPatch(worksheet, patch) {
    const byN = new Map();
    for (const q of patch || []) {
      const n = Number(q && q.n);
      if (Number.isFinite(n)) byN.set(n, normalizeQuestion(q, n - 1));
    }
    if (!byN.size) return worksheet;
    const questions = worksheet.questions.map(q => {
      const rep = byN.get(Number(q.n));
      if (!rep) return q;
      return Object.assign({}, rep, { n: q.n, skill: rep.skill || q.skill, format: rep.format || q.format });
    });
    return Object.assign({}, worksheet, { questions });
  }

  /** Which question numbers actually changed between two worksheets. */
  function changedQuestions(before, after) {
    const out = [];
    const byN = new Map((after.questions || []).map(q => [Number(q.n), q]));
    for (const q of before.questions || []) {
      const b = byN.get(Number(q.n));
      if (b && JSON.stringify(b) !== JSON.stringify(q)) out.push(Number(q.n));
    }
    return out;
  }

  /**
   * The failures that mean the material must not be handed out as it is.
   * A finding carries the flag itself; for older stored materials the rule
   * list is asked instead.
   */
  function blockingFailures(findings) {
    const byId = Object.fromEntries(RULES.map(r => [r.id, r]));
    return (findings || []).filter(f => f.status === 'fail' && (f.blocking !== undefined ? f.blocking : !!(byId[f.id] && byId[f.id].blocking)));
  }

  function summarize(findings) {
    const s = { pass: 0, warn: 0, fail: 0, unverified: 0 };
    for (const f of findings) s[f.status] = (s[f.status] || 0) + 1;
    return s;
  }

  return {
    RULES, words, wordCount, normalizeForSearch, materialText, findQuotePosition, stem, wordVariants, vocabKeys, vocabParts,
    vocabMatches, highlightRanges, highlightSegments,
    speakerStats, tagStats, normalizeContent, normalizeMeta, normalizeWorksheet, normalizeQuestion,
    repairable, repairPlan, problemScore, applyQuestionPatch, applyTaskPatch, applyPreTaskPatch, applyPostTaskPatch,
    changedQuestions, changedTasks, changedPreTasks, changedPostTasks, STRUCTURAL, applicableRules, runDeterministic,
    normalizePreTask, preTaskText, socialLabel, taskRules, normalizeChrome, mergeChrome, layoutModel, sharedRun,
    runContentChecks, llmRules, mergeReview, verdictSupported, blockingFailures, summarize,
    chronologyReport, enforceChronology, normalizeGlossary, slimMeasurement,
  };
});
