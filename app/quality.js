/*
 * LRMaster quality — normalises Claude's JSON output and runs the quality
 * check from concept §29. Rules are either `deterministic` (measured here in
 * code) or `llm` (judged by Claude with the review prompt). Every rule has a
 * stable id that the concept manifest references.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else { root.LR = root.LR || {}; root.LR.quality = factory(root.LR.core); }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Text utilities                                                       */
  /* ------------------------------------------------------------------ */

  function words(text) {
    return String(text || '').replace(/\[[a-z]+\]/gi, ' ').match(/[A-Za-zÀ-ÿ0-9'’-]+/g) || [];
  }
  function wordCount(text) { return words(text).length; }

  function normalizeForSearch(s) {
    return String(s || '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
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
      const base = normalizeForSearch(raw).replace(/^to /, '').replace(/^(sb|sth|somebody|something) /, '').replace(/\((.*?)\)/g, '').trim();
      if (!base) continue;
      const parts = base.split(' ').filter(p => !/^(sb|sth|somebody|something|s\.o\.|s\.th\.|one's|sb's)$/.test(p));
      const content = parts.filter(p => p.length > 2 && !/^(a|an|the|to|of|in|on|at|for|with|and|or)$/.test(p));
      const keys = content.length ? content : parts;
      const ok = keys.every(k => new RegExp('\\b(?:' + wordVariants(k).map(escapeRe).join('|') + ')[a-z]{0,4}\\b').test(hay));
      (ok ? found : missing).push(raw);
    }
    return { found, missing };
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

  function normalizeContent(raw, state, plan) {
    if (!raw || typeof raw !== 'object') throw new Error('Content: no JSON object returned.');
    const out = { title: String(raw.title || '').trim(), summary: String(raw.summary || '').trim(), vocabularyUsed: Array.isArray(raw.vocabularyUsed) ? raw.vocabularyUsed.map(String) : [] };
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
      preTasks: Array.isArray(raw.preTasks) ? raw.preTasks.filter(p => p && typeof p === 'object').map(p => ({
        type: String(p.type || '').toLowerCase(), title: String(p.title || ''), prompt: String(p.prompt || ''),
        items: Array.isArray(p.items) ? p.items.map(String) : [], teacherNote: String(p.teacherNote || ''),
      })) : [],
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

  function finding(rule, status, detail, extra) {
    return Object.assign({ id: rule.id, group: rule.group, title: rule.title, kind: rule.kind, status, detail: detail || '' }, extra || {});
  }

  const RULES = [
    // Content
    { id: 'content.topic_unit', group: 'content', kind: 'llm', title: 'Topic fits the unit', criterion: 'the theme of the material fits the textbook unit and the intended topic', blocking: false },
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
    { id: 'content.vocab_natural', group: 'content', kind: 'llm', title: 'Vocabulary integrated naturally', criterion: 'target words are integrated naturally and not forced into the text', blocking: false },
    { id: 'content.coherent', group: 'content', kind: 'llm', title: 'Text is coherent', criterion: 'the text/conversation is coherent and logically consistent', blocking: true },
    { id: 'content.natural', group: 'content', kind: 'llm', title: 'Conversation/text sounds natural', criterion: 'the language sounds natural for the format and the naturalness setting', blocking: false },
    { id: 'content.level', group: 'content', kind: 'llm', title: 'Language matches the CEFR level', criterion: 'the language stays at the configured CEFR level (not clearly above or below)', blocking: true },
    { id: 'content.word_count', group: 'content', kind: 'deterministic', title: 'Length matches the target', blocking: true,
      check(ctx) {
        const n = wordCount(materialText(ctx.content, ctx.state.kind).text.replace(/^[^:\n]+: /gm, ''));
        const t = ctx.plan.targetWords;
        const dev = t ? Math.abs(n - t) / t : 0;
        return finding(this, dev <= 0.2 ? 'pass' : dev <= 0.35 ? 'warn' : 'fail', `${n} words, target ${t} (deviation ${Math.round(dev * 100)} %).`, { measured: n, target: t });
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
    { id: 'listening.distinguishable', group: 'listening', kind: 'llm', title: 'Speakers are clearly distinguishable', only: 'listening', criterion: 'the speakers are clearly distinguishable by what they say, their role and their manner of speaking', blocking: false },
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
    { id: 'listening.no_artificial_switches', group: 'listening', kind: 'llm', title: 'No unnecessarily artificial speaker changes', only: 'listening', criterion: 'speaker changes are motivated by the conversation; there are no artificial switches', blocking: false },
    // Questions
    { id: 'questions.count', group: 'questions', kind: 'deterministic', title: 'Number of questions matches', needsWorksheet: true, blocking: true,
      check(ctx) {
        const n = ctx.worksheet.questions.length;
        return finding(this, n === ctx.plan.questionCount ? 'pass' : 'fail', `${n} questions, ${ctx.plan.questionCount} planned.`);
      } },
    { id: 'questions.answerable', group: 'questions', kind: 'llm', title: 'Every question is answerable unambiguously', needsWorksheet: true, criterion: 'every question has exactly one defensible answer', blocking: true },
    { id: 'questions.derivable', group: 'questions', kind: 'llm', title: 'Correct answer follows from the material', needsWorksheet: true, criterion: 'each key answer can actually be derived from the material (and from the evidence quote given)', blocking: true },
    { id: 'questions.distractors', group: 'questions', kind: 'llm', title: 'Distractors are plausible', needsWorksheet: true, criterion: 'distractors in closed formats are plausible but clearly wrong', blocking: false },
    { id: 'questions.chronology', group: 'questions', kind: 'deterministic', title: 'Questions follow audio/text order', needsWorksheet: true, blocking: false,
      check(ctx) {
        if (!ctx.state.followChronology) return finding(this, 'pass', 'Chronology not required.');
        const mat = materialText(ctx.content, ctx.state.kind);
        const positions = [];
        let unresolved = 0;
        for (const q of ctx.worksheet.questions) {
          if (q.skill === 'gist') continue;
          const p = findQuotePosition(mat.text, q.evidenceQuote);
          if (p < 0) { unresolved++; continue; }
          positions.push({ n: q.n, p });
        }
        const violations = [];
        for (let i = 1; i < positions.length; i++) if (positions[i].p + 40 < positions[i - 1].p) violations.push(`Q${positions[i].n} before Q${positions[i - 1].n}`);
        const status = violations.length === 0 ? (unresolved ? 'warn' : 'pass') : violations.length <= 1 ? 'warn' : 'fail';
        return finding(this, status, (violations.length ? 'Out of order: ' + violations.join('; ') + '. ' : 'Order verified. ') + (unresolved ? `${unresolved} evidence quote(s) not found verbatim.` : ''), { questions: violations.map(v => Number(/Q(\d+) before/.exec(v)[1])) });
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
    { id: 'questions.duplicates_llm', group: 'questions', kind: 'llm', title: 'No two questions test exactly the same information (review)', needsWorksheet: true, criterion: 'no two questions test exactly the same piece of information', blocking: false },
    { id: 'questions.skill_distribution', group: 'questions', kind: 'deterministic', title: 'Skill distribution matches the settings', needsWorksheet: true, blocking: true,
      check(ctx) {
        const want = ctx.plan.skillSequence;
        const got = ctx.worksheet.questions.map(q => q.skill);
        const mismatches = [];
        for (let i = 0; i < Math.max(want.length, got.length); i++) if (want[i] !== got[i]) mismatches.push(i + 1);
        const counts = {};
        for (const s of got) counts[s] = (counts[s] || 0) + 1;
        const sameTotals = core.SKILL_KEYS.every(k => (counts[k] || 0) === (ctx.plan.skillMix[k] || 0));
        const status = mismatches.length === 0 ? 'pass' : sameTotals ? 'warn' : 'fail';
        return finding(this, status, mismatches.length ? `Skill differs from plan at Q${mismatches.join(', Q')}` + (sameTotals ? ' (totals per skill are correct).' : '.') : 'Every question carries the planned skill.', { questions: mismatches });
      } },
    { id: 'questions.formats', group: 'questions', kind: 'deterministic', title: 'Only enabled response formats are used', needsWorksheet: true, blocking: true,
      check(ctx) {
        const bad = ctx.worksheet.questions.filter(q => !ctx.plan.formats.includes(q.format)).map(q => `Q${q.n} (${q.format || 'none'})`);
        const seqBad = ctx.plan.formatSequence ? ctx.worksheet.questions.filter((q, i) => ctx.plan.formatSequence[i] && q.format !== ctx.plan.formatSequence[i]).map(q => `Q${q.n}`) : [];
        const status = bad.length ? 'fail' : seqBad.length ? 'warn' : 'pass';
        return finding(this, status, bad.length ? 'Disabled formats: ' + bad.join(', ') : seqBad.length ? 'Balanced mix not followed at ' + seqBad.join(', ') : 'Formats as planned.', { questions: bad.concat(seqBad).map(s => Number(/\d+/.exec(s)[0])) });
      } },
    { id: 'questions.difficulty', group: 'questions', kind: 'llm', title: 'Difficulty matches the requested level', needsWorksheet: true, criterion: 'the questions match the requested question level and difficulty setting (not clearly easier or harder)', blocking: false },
    { id: 'questions.inference_genuine', group: 'questions', kind: 'llm', title: 'Inference questions are genuinely inferential', needsWorksheet: true, criterion: 'questions labelled inference require reasoning beyond explicitly stated information and are not hidden detail questions', blocking: true },
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
    { id: 'pretask.present', group: 'questions', kind: 'deterministic', title: 'Pre-task types as configured', needsWorksheet: true, blocking: false,
      check(ctx) {
        const want = ctx.plan.preTaskTypes;
        const got = ctx.worksheet.preTasks.map(p => p.type);
        const missing = want.filter(t => !got.includes(t));
        const extra = got.filter(t => !want.includes(t));
        return finding(this, missing.length === 0 && extra.length === 0 ? 'pass' : 'fail', (missing.length ? 'Missing: ' + missing.join(', ') + '. ' : '') + (extra.length ? 'Unexpected: ' + extra.join(', ') : '') || (want.length ? 'All pre-tasks present.' : 'No pre-task requested.'));
      } },
    { id: 'pretask.no_spoilers', group: 'questions', kind: 'llm', title: 'Pre-task does not give away answers', needsWorksheet: true, needsPreTask: true, criterion: 'the pre-task does not anticipate any answer of the comprehension questions', blocking: true },
  ];

  function applicableRules(state, plan, worksheet) {
    return RULES.filter(r => {
      if (r.only && r.only !== state.kind) return false;
      if (r.needsWorksheet && !worksheet) return false;
      if (r.needsPreTask && (!worksheet || worksheet.preTasks.length === 0)) return false;
      return true;
    });
  }

  /** Run all deterministic rules. */
  function runDeterministic(state, plan, content, worksheet) {
    const ctx = { state, plan, content, worksheet };
    return applicableRules(state, plan, worksheet).filter(r => r.kind === 'deterministic').map(r => r.check(ctx));
  }

  /** Deterministic rules that judge content only (used before the questions are written). */
  function runContentChecks(state, plan, content) {
    return runDeterministic(state, plan, content, null);
  }

  function llmRules(state, plan, worksheet) {
    return applicableRules(state, plan, worksheet).filter(r => r.kind === 'llm');
  }

  /** Merge Claude's review into findings. */
  function mergeReview(rules, review) {
    const results = (review && Array.isArray(review.results)) ? review.results : [];
    return rules.map(r => {
      const hit = results.find(x => x && String(x.rule) === r.id);
      if (!hit) return finding(r, 'unverified', 'No verdict returned.');
      return finding(r, hit.pass ? 'pass' : 'fail', String(hit.note || ''), { questions: Array.isArray(hit.questions) ? hit.questions.map(Number) : [] });
    });
  }

  function blockingFailures(findings) {
    const byId = Object.fromEntries(RULES.map(r => [r.id, r]));
    return findings.filter(f => f.status === 'fail' && byId[f.id] && byId[f.id].blocking);
  }

  function summarize(findings) {
    const s = { pass: 0, warn: 0, fail: 0, unverified: 0 };
    for (const f of findings) s[f.status] = (s[f.status] || 0) + 1;
    return s;
  }

  return {
    RULES, words, wordCount, normalizeForSearch, materialText, findQuotePosition, stem, wordVariants, vocabMatches,
    speakerStats, tagStats, normalizeContent, normalizeWorksheet, applicableRules, runDeterministic,
    runContentChecks, llmRules, mergeReview, blockingFailures, summarize,
  };
});
