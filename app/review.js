/*
 * LRMaster review — change the rendered students' sheet in place, with Claude
 * or by hand.
 *
 * The sheet is rendered from the worksheet (JSON). In the review mode every
 * block (a question, a pre-/post-task, a task beyond the text) carries its
 * path (data-unit="questions.3") and every text a teacher can change carries
 * its own (data-edit="questions.3.options.1"). Everything here works on that
 * model: a change is made on a copy, checked, and only then written back —
 * so it reaches every export, and an Undo restores the copy taken before.
 * All the tools are laid over the sheet after it is rendered; none of them is
 * ever printed or exported.
 *
 * The first half is the model (pure, tested in Node); the second half the
 * interface in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./quality.js'), require('./prompts.js'), require('./render.js'));
  else { root.LR = root.LR || {}; root.LR.review = factory(root.LR.core, root.LR.quality, root.LR.prompts, root.LR.render); }
})(typeof self !== 'undefined' ? self : this, function (core, quality, prompts, render) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* The model                                                            */
  /* ------------------------------------------------------------------ */

  const LISTS = ['preTasks', 'questions', 'higherOrder', 'postTasks'];
  const WS_GROUPS = ['questions', 'pretask', 'posttask'];
  /** What a question change may carry along: the answer key follows the question. */
  const KEY_FIELDS = ['answer', 'acceptable', 'correction', 'evidenceQuote', 'evidenceRef', 'rationale', 'difficulty'];
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

  function split(path) { return String(path || '').split('.').filter(Boolean).map(x => (/^\d+$/.test(x) ? Number(x) : x)); }
  function getAt(obj, path) { return split(path).reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setAt(obj, path, value) {
    const keys = split(path);
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) o[keys[i]] = typeof keys[i + 1] === 'number' ? [] : {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
    return obj;
  }
  /** "questions.3.options.1" → "questions.3"; texts of the sheet itself have no unit. */
  function unitOf(path) {
    const k = split(path);
    return LISTS.includes(k[0]) && typeof k[1] === 'number' ? k[0] + '.' + k[1] : null;
  }
  function parseUnit(unit) { const k = split(unit); return { list: k[0], index: k[1] }; }
  /** The part of a path inside its block: "questions.3.options.1" → "options.1". */
  function inner(path) { const u = unitOf(path); return u ? String(path).slice(u.length + 1) : String(path); }

  const LIST_LABEL = { questions: 'Frage', preTasks: 'Pre-Task', postTasks: 'Post-Task', higherOrder: 'Beyond-Aufgabe' };
  const LIST_NEW = { questions: 'Neue Frage', preTasks: 'Neue Pre-Task', postTasks: 'Neue Post-Task', higherOrder: 'Neue Beyond-Aufgabe' };
  /** The number a block shows on the sheet. */
  function shownNumber(ws, list, index) {
    const b = ((ws && ws[list]) || [])[index];
    return list === 'questions' ? index + 1 : (b && Number(b.n)) || index + 1;
  }
  function unitLabel(ws, unit) {
    const { list, index } = parseUnit(unit);
    return LIST_LABEL[list] + ' ' + shownNumber(ws, list, index);
  }
  function elementLabel(ws, path) {
    const rest = inner(path);
    const k = split(rest);
    if (!unitOf(path)) return { title: 'Titel', instructions: 'Arbeitsanweisung' }[rest] || rest;
    const isQ = String(path).startsWith('questions.');
    switch (k[0]) {
      case 'prompt': return isQ ? 'Fragetext' : 'Anweisung';
      case 'statement': return 'Aussage';
      case 'options': return 'Option ' + String.fromCharCode(65 + k[1]);
      case 'items': return (isQ ? 'Item ' : 'Punkt ') + (k[1] + 1) + (k[2] === 'left' ? ' (links)' : k[2] === 'right' ? ' (rechts)' : '');
      case 'criteria': return 'Erfolgskriterium ' + (k[1] + 1);
      case 'title': return 'Titel';
      case 'product': return 'Ergebnis';
      case 'table': return k[1] === 'headers' ? 'Spaltenkopf ' + (k[2] + 1) : 'Zelle ' + (k[2] + 1) + '/' + (k[3] + 1);
      default: return rest;
    }
  }
  /** Items (one answer, one entry of a list) or explanations (instructions, texts). */
  function elementKind(path) {
    return ['options', 'items', 'statement', 'table', 'criteria'].includes(split(inner(path))[0]) ? 'item' : 'explanation';
  }
  /** An entry of a list that can be removed on its own: options.2, items.1, criteria.0. */
  function listEntry(path) {
    const rest = split(inner(path));
    if (!unitOf(path) || rest.length !== 2 || typeof rest[1] !== 'number' || !['options', 'items', 'criteria'].includes(rest[0])) return null;
    return { field: rest[0], index: rest[1] };
  }

  /** The worksheet a view shows: one variant's, or the only one. */
  function variantOf(m, key) {
    const vs = render.variantsOf(m);
    return (key ? vs.find(v => v.key === key) : null) || vs[0];
  }
  function worksheetOf(m, key) { const v = variantOf(m, key); return v && v.worksheet; }
  function planOf(m, key) { const v = variantOf(m, key); return (v && v.plan) || m.plan; }
  function stateOf(m, key) {
    const v = variantOf(m, key);
    const def = v && v.key ? (core.questionVariants(m.settings || {}).find(x => x && x.key === v.key) || null) : null;
    return core.variantState(m.settings || {}, def);
  }
  /** Write a worksheet (and its plan) back: the variant, and the first one also as the material's own. */
  function commitWorksheet(m, key, ws, plan) {
    if (Array.isArray(m.variants) && m.variants.length) {
      const v = variantOf(m, key);
      const i = Math.max(0, m.variants.indexOf(v));
      m.variants[i] = Object.assign({}, m.variants[i], { worksheet: ws, plan: plan || m.variants[i].plan });
      if (i === 0) { m.worksheet = ws; if (plan) m.plan = Object.assign({}, m.plan, pick(plan, PLAN_SYNC_KEYS)); }
    } else {
      m.worksheet = ws;
      if (plan) m.plan = plan;
    }
  }
  const PLAN_SYNC_KEYS = ['questionCount', 'skillMix', 'formats', 'formatSequence', 'higherOrderCount', 'higherOrderTypes', 'preTask', 'postTask'];
  function pick(o, keys) { const out = {}; for (const k of keys) if (o[k] !== undefined) out[k] = o[k]; return out; }

  /** Numbers follow the order: questions from 1, tasks from the number their list started with. */
  function firstNumber(ws, list) { const a = ws[list] || []; return list === 'questions' ? 1 : (a.length && Number(a[0].n)) || 1; }
  function renumber(ws, list, base) {
    (ws[list] || []).forEach((b, i) => { b.n = (base || 1) + i; });
    return ws;
  }
  function insertBlock(ws, list, index, block) {
    const base = firstNumber(ws, list);
    ws[list] = (ws[list] || []).slice();
    ws[list].splice(Math.max(0, Math.min(index, ws[list].length)), 0, block);
    return renumber(ws, list, base);
  }
  function removeBlock(ws, list, index) {
    const base = firstNumber(ws, list);
    ws[list] = (ws[list] || []).slice();
    ws[list].splice(index, 1);
    return renumber(ws, list, base);
  }
  const letterIndex = (a) => (/^[A-Za-z]$/.test(String(a || '').trim()) ? String(a).trim().toUpperCase().charCodeAt(0) - 65 : -1);
  const letter = (i) => String.fromCharCode(65 + i);
  /**
   * Remove one entry of a list (an option, an item, a criterion). The answer
   * key follows: a later correct option moves up one letter; the correct
   * option itself cannot be removed.
   */
  function removeEntry(ws, path) {
    const e = listEntry(path);
    if (!e) return { ok: false, error: 'Das lässt sich nicht einzeln entfernen.' };
    const unit = unitOf(path);
    const b = getAt(ws, unit);
    const arr = Array.isArray(b[e.field]) ? b[e.field].slice() : [];
    if (e.index >= arr.length) return { ok: false, error: 'Nicht gefunden.' };
    if (e.field === 'options' && ['multiple_choice', 'best_summary'].includes(b.format)) {
      const ci = letterIndex(b.answer);
      if (ci === e.index) return { ok: false, error: 'Das ist die richtige Antwort – sie bleibt.' };
      if (arr.length <= 3) return { ok: false, error: 'Eine Auswahlfrage braucht mindestens drei Optionen.' };
      if (ci > e.index) b.answer = letter(ci - 1);
    }
    if (e.field === 'options' && b.format === 'select_all') {
      const letters = (Array.isArray(b.answer) ? b.answer : String(b.answer || '').split(/[,\s]+/)).map(letterIndex).filter(i => i >= 0);
      if (letters.includes(e.index) && letters.length === 1) return { ok: false, error: 'Das ist die einzige richtige Antwort – sie bleibt.' };
      if (arr.length <= 3) return { ok: false, error: 'Diese Frage braucht mindestens drei Optionen.' };
      b.answer = letters.filter(i => i !== e.index).map(i => letter(i > e.index ? i - 1 : i));
    }
    if (e.field === 'items' && ['matching', 'ordering'].includes(b.format) && arr.length <= 3) return { ok: false, error: 'Diese Frage braucht mindestens drei Einträge.' };
    arr.splice(e.index, 1);
    b[e.field] = arr;
    return { ok: true };
  }

  /** A block as the app keeps it. */
  function normalizeBlock(list, raw, index, old) {
    if (!raw || typeof raw !== 'object') return null;
    if (list === 'questions') {
      const q = quality.normalizeQuestion(raw, index);
      return q;
    }
    if (list === 'higherOrder') {
      return { n: index + 1, type: String(raw.type || (old && old.type) || '').toLowerCase(), prompt: String(raw.prompt || '').trim(), answer: raw.answer, rationale: String(raw.rationale || '') };
    }
    const t = quality.normalizePreTask(raw, index);
    if (!t.minutes && old && old.minutes) t.minutes = old.minutes;
    if (!t.minutes) t.minutes = 5;
    return t;
  }
  /** What is wrong with a block Claude wrote — empty when it can go on the sheet. */
  function blockProblems(list, b, material) {
    const out = [];
    if (!b) return ['no block came back'];
    if (list === 'questions') {
      const { bad } = quality.questionProblems({ questions: [Object.assign({}, b, { n: 1 })] });
      bad.forEach(x => out.push(x.replace(/^Q\d+: /, '')));
      if (!core.FORMAT_KEYS.includes(b.format)) out.push(`unknown format "${b.format}"`);
      if (!core.SKILL_KEYS.includes(b.skill)) out.push(`unknown skill "${b.skill}"`);
      const text = quality.materialText(material.content, material.kind).text;
      if (!b.evidenceQuote || quality.findQuotePosition(text, b.evidenceQuote) < 0) out.push('the evidenceQuote is not a verbatim excerpt of the material');
    } else if (list === 'higherOrder') {
      if (quality.wordCount(b.prompt) < 4) out.push('no task text');
      if (!core.HIGHER_ORDER_TYPES.some(h => h.key === b.type)) out.push(`unknown type "${b.type}"`);
    } else {
      const types = (list === 'postTasks' ? core.POST_TASK_TYPES : core.PRE_TASK_TYPES).map(t => t.key);
      if (quality.wordCount(b.prompt) < 3) out.push('no instruction for the students');
      if (!types.includes(b.type)) out.push(`unknown type "${b.type}"`);
    }
    return out;
  }
  /**
   * A block Claude returned for a change of some of its parts: every other
   * part must come back exactly as it was (in a list: every other entry).
   */
  function verifyFields(list, oldB, newB, fields) {
    const norm = (b) => (list === 'questions' ? quality.normalizeQuestion(b, 0) : b);
    const a = norm(clone(oldB)), b = norm(clone(newB));
    const allowed = new Map();
    for (const f of fields) {
      const k = split(f);
      if (k.length >= 2 && typeof k[1] === 'number' && allowed.get(k[0]) !== true) {
        const set = allowed.get(k[0]) instanceof Set ? allowed.get(k[0]) : new Set();
        set.add(k[1]); allowed.set(k[0], set);
      } else allowed.set(k[0], true);
    }
    if (list === 'questions') KEY_FIELDS.forEach(k => allowed.set(k, true));
    allowed.set('n', true); allowed.set('reviewNote', true);
    const changed = [];
    for (const key of new Set(Object.keys(a).concat(Object.keys(b)))) {
      const rule = allowed.get(key);
      if (rule === true) continue;
      if (rule instanceof Set) {
        const x = Array.isArray(a[key]) ? a[key] : [], y = Array.isArray(b[key]) ? b[key] : [];
        if (x.length !== y.length) { changed.push(key + ' (number of entries)'); continue; }
        x.forEach((v, i) => { if (!rule.has(i) && !same(v, y[i])) changed.push(key + '.' + i); });
        continue;
      }
      if (!same(a[key], b[key])) changed.push(key);
    }
    return changed;
  }
  /**
   * In a closed question whose format stayed the same, the correct option
   * keeps its letter: if Claude moved it, the options are swapped back.
   */
  function keepCorrectOption(oldQ, newQ) {
    if (!oldQ || !newQ || oldQ.format !== newQ.format || !['multiple_choice', 'best_summary'].includes(newQ.format)) return newQ;
    const was = letterIndex(oldQ.answer), opts = Array.isArray(newQ.options) ? newQ.options.slice() : [];
    let now = letterIndex(newQ.answer);
    if (now < 0) now = opts.findIndex(o => String(o).trim().toLowerCase() === String(newQ.answer || '').trim().toLowerCase());
    if (was < 0 || now < 0 || was === now || was >= opts.length || now >= opts.length) return newQ;
    [opts[was], opts[now]] = [opts[now], opts[was]];
    return Object.assign({}, newQ, { options: opts, answer: letter(was) });
  }
  /** Replace the part [start, end) of a text: everything else stays, character for character. */
  function spliceText(text, start, end, replacement) {
    const t = String(text || '');
    return t.slice(0, start) + String(replacement) + t.slice(end);
  }
  /** The sentences of a text as [start, end) spans. */
  function sentences(text) {
    const t = String(text || ''), out = [];
    const re = /[^.!?]+(?:[.!?]+["\u201D\u2019')\]]*)?\s*/g;
    let m;
    while ((m = re.exec(t)) && m[0]) out.push({ start: m.index, end: m.index + m[0].replace(/\s+$/, '').length });
    return out.filter(s => s.end > s.start);
  }
  /** Tolerant reading of Claude's answer: the block, or the new text. */
  function unwrap(raw, mode) {
    let r = raw;
    if (typeof r === 'string') {
      const t = r.trim();
      if (mode === 'text' || mode === 'span') { try { r = JSON.parse(t); } catch (e) { return t.replace(/^["\u201C]|["\u201D]$/g, ''); } }
      else { const a = t.indexOf('{'), b = t.lastIndexOf('}'); try { r = JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; } }
    }
    if (!r || typeof r !== 'object') return null;
    if (mode === 'text' || mode === 'span') {
      const v = r.text != null ? r.text : r.value != null ? r.value : r.replacement;
      return typeof v === 'string' ? v : null;
    }
    const b = r.block || r.question || r.task || (Array.isArray(r.questions) && r.questions[0]) || (Array.isArray(r.preTasks) && r.preTasks[0]) || (Array.isArray(r.postTasks) && r.postTasks[0]) || r;
    return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
  }

  /** The plan follows the teacher: what the sheet now holds is what was meant. */
  function syncPlan(plan, ws) {
    const p = Object.assign({}, plan);
    const qs = ws.questions || [];
    p.questionCount = qs.length;
    p.skillMix = Object.fromEntries(core.SKILL_KEYS.map(k => [k, qs.filter(q => q.skill === k).length]));
    p.formats = [...new Set((p.formats || []).concat(qs.map(q => q.format).filter(Boolean)))];
    if (Array.isArray(p.formatSequence)) p.formatSequence = qs.map(q => q.format);
    const ho = ws.higherOrder || [];
    if (p.higherOrderCount !== undefined || ho.length) {
      p.higherOrderCount = ho.length;
      p.higherOrderTypes = [...new Set((p.higherOrderTypes || []).concat(ho.map(h => h.type).filter(Boolean)))];
    }
    for (const [key, field] of [['preTask', 'preTasks'], ['postTask', 'postTasks']]) {
      const got = ws[field] || [];
      if (!p[key] && !got.length) continue;
      const base = p[key] || { focus: key === 'preTask' ? 'topic' : 'content', criteria: got.some(t => (t.criteria || []).length), band: p.cefr, minutes: got.reduce((a, t) => a + (t.minutes || 0), 0) };
      if (!got.length) { p[key] = null; continue; }
      p[key] = Object.assign({}, base, {
        count: got.length,
        tasks: got.map(t => ({ n: t.n, type: t.type, socialForm: t.socialForm, mode: t.mode, minutes: t.minutes })),
        socialMix: Object.fromEntries(core.SOCIAL_FORM_KEYS.map(k => [k, got.filter(t => t.socialForm === k).length])),
        oralCount: got.filter(t => t.mode === 'oral').length,
      });
    }
    return p;
  }
  /**
   * After a change the checks of the sheet are out of date: the measured ones
   * run again at once, Claude's review of them is marked as not checked.
   */
  function refreshChecks(m, key) {
    const v = variantOf(m, key);
    if (!v || !v.worksheet) return;
    const det = quality.runDeterministic(stateOf(m, key), v.plan || m.plan, m.content, v.worksheet).filter(f => WS_GROUPS.includes(f.group));
    const ids = new Set(det.map(f => f.id));
    const stale = (f) => Object.assign({}, f, { status: 'unverified', stale: true, questions: [], detail: 'Nach einer Änderung im Viewer nicht erneut von Claude geprüft.' });
    const tag = (f) => (v.key ? Object.assign({}, f, { variant: v.key }) : f);
    const vs = Array.isArray(m.variants) ? m.variants : [];
    const vi = vs.indexOf(v);
    if (vi >= 0 && vs[vi].quality) {
      const old = vs[vi].quality.findings || [];
      vs[vi] = Object.assign({}, vs[vi], { quality: Object.assign({}, vs[vi].quality, { findings: det.concat(old.filter(f => !ids.has(f.id) && WS_GROUPS.includes(f.group) && f.kind === 'llm').map(stale), old.filter(f => !WS_GROUPS.includes(f.group))) }) });
    }
    if (m.quality) {
      const mine = (f) => WS_GROUPS.includes(f.group) && (v.key ? f.variant === v.key : !f.variant);
      const all = m.quality.findings || [];
      const edited = m.quality.edited || { count: 0 };
      m.quality = Object.assign({}, m.quality, {
        findings: all.filter(f => !mine(f)).concat(det.map(tag), all.filter(f => mine(f) && f.kind === 'llm' && !ids.has(f.id)).map(stale)),
        edited: { at: Date.now(), count: (edited.count || 0) + 1 },
      });
    }
  }
  /** The teacher's notes on the blocks of a worksheet. */
  function notesOf(ws) {
    const out = [];
    for (const list of LISTS) ((ws && ws[list]) || []).forEach((b, i) => { if (b && b.reviewNote) out.push({ unit: list + '.' + i, note: b.reviewNote }); });
    return out;
  }
  /** A copy of the material without the teacher's notes — what an export hands out. */
  function stripNotes(m) {
    const c = clone(m);
    const strip = (ws) => { if (ws) for (const list of LISTS) (ws[list] || []).forEach(b => { if (b) delete b.reviewNote; }); };
    strip(c.worksheet);
    (c.variants || []).forEach(v => strip(v.worksheet));
    return c;
  }
  const nextBand = (b, d) => { const i = core.CEFR_BANDS.indexOf(b); return i < 0 ? null : core.CEFR_BANDS[i + d] || null; };

  /* ------------------------------------------------------------------ */
  /* Presets: what a teacher can ask for with one click                   */
  /* ------------------------------------------------------------------ */

  const BLOCK_CHIPS = [
    ['simpler', 'Einfacher formulieren', 'Use simpler wording (the same task, plainer words and shorter sentences).'],
    ['layout', 'Übersichtlicher', 'Make the layout clearer: one step per line, items where a list helps.'],
    ['context', 'Mehr Kontext', 'Give more context so the students know what the task is about.'],
    ['fewer', 'Weniger Items', 'Use fewer items or options.'],
    ['more', 'Mehr Items', 'Use more items or options.'],
    ['format', 'Anderes Format', 'Use a different response format that fits the same skill.'],
    ['easier', 'Leichter', 'Make it easier.'],
    ['harder', 'Anspruchsvoller', 'Make it more challenging.'],
    ['everyday', 'Näher am Alltag', "Bring it closer to the students' everyday life."],
  ];
  const ITEM_CHIPS = [
    ['easier', 'Leichter', 'Make it easier.'],
    ['harder', 'Schwieriger', 'Make it harder.'],
    ['other', 'Anderer Inhalt', 'Use other content.'],
    ['clearer', 'Klarer', 'Make it clearer.'],
    ['one', 'Nur eine richtige Antwort', 'Make sure exactly one answer is correct.'],
  ];
  const TEXT_CHIPS = [
    ['simpler', 'Einfacher', 'Simpler.'],
    ['shorter', 'Kürzer', 'Shorter.'],
    ['clearer', 'Klarer', 'Clearer.'],
    ['examples', 'Bessere Beispiele', 'Better examples.'],
    ['steps', 'Schritt für Schritt', 'Step by step.'],
  ];
  /** Ideas for a new block, by the list it goes into. */
  function insertIdeas(list) {
    if (list === 'questions') return core.SKILLS.map(s => [s.key, s.label, `Skill: ${s.key} (${s.label})`]).concat([
      ['harder', 'Anspruchsvoller als die Nachbarn', 'More demanding than the questions around it.'],
      ['easier', 'Leichter als die Nachbarn', 'Easier than the questions around it.'],
    ]);
    if (list === 'higherOrder') return core.HIGHER_ORDER_TYPES.map(h => [h.key, h.label, `Type: ${h.key}`]);
    const types = list === 'postTasks' ? core.POST_TASK_TYPES : core.PRE_TASK_TYPES;
    return types.map(t => [t.key, t.label, `Type: ${t.key} — ${t.definition}`]);
  }
  function insertFormats(list, kind) {
    if (list === 'questions') return core.QUESTION_FORMATS.filter(f => kind === 'listening' || !f.listeningOnly).map(f => [f.key, f.label, f.key]);
    if (list === 'preTasks' || list === 'postTasks') return core.SOCIAL_FORMS.map(f => [f.key, f.label, `socialForm: ${f.key}`]).concat([['oral', 'mündlich', 'mode: oral'], ['written', 'schriftlich', 'mode: written']]);
    return [];
  }
  function requestFrom(chipDefs, picked, words) {
    return chipDefs.filter(c => picked.includes(c[0])).map(c => c[2]).concat(String(words || '').trim() ? [String(words).trim()] : []).join(' ');
  }

  /* ------------------------------------------------------------------ */
  /* Changes: build the request, check the answer, apply it to a copy     */
  /* ------------------------------------------------------------------ */

  /**
   * One change as data: what is asked, and how Claude's answer becomes a new
   * worksheet. `t`: { unit|path, mode, fields, span, request, band }.
   * Returns { prompt(problems), accept(raw) → { ws, problems, flash, note } }.
   */
  function editJob(m, key, t) {
    const ws0 = worksheetOf(m, key);
    const plan = planOf(m, key);
    const st = stateOf(m, key);
    const unit = t.unit || unitOf(t.path);
    const { list, index } = unit ? parseUnit(unit) : { list: null, index: -1 };
    const block = unit ? getAt(ws0, unit) : null;
    const field = t.path ? (unit ? inner(t.path) : t.path) : null;
    const value = t.path ? String(getAt(ws0, t.path) == null ? '' : getAt(ws0, t.path)) : '';
    const spec = {
      list, index, mode: t.mode, fields: (t.fields || []).map(f => (unitOf(f) ? inner(f) : f)), field, value, request: t.request, label: t.label,
      span: t.mode === 'span' ? { before: value.slice(0, t.span.start), marked: value.slice(t.span.start, t.span.end), after: value.slice(t.span.end) } : null,
    };
    return {
      prompt(problems) {
        const base = prompts.buildEditPrompt(st, plan, m.content, ws0, spec);
        return problems && problems.length ? base + '\n\n## Your previous answer was not taken\n' + problems.map(p => '- ' + p).join('\n') + '\nAnswer again, fixing exactly this.' : base;
      },
      accept(raw) {
        const ws = clone(ws0);
        if (t.mode === 'text' || t.mode === 'span') {
          const text = unwrap(raw, t.mode);
          if (text == null || !String(text).trim()) return { problems: ['no text came back'] };
          if (/\n/.test(text) && !/\n/.test(value)) return { problems: ['the text must stay on one line'] };
          if (String(text).length > Math.max(400, (t.mode === 'span' ? spec.span.marked.length : value.length) * 4)) return { problems: ['the text is far longer than what it replaces'] };
          const next = t.mode === 'span' ? spliceText(value, t.span.start, t.span.end, String(text).trim()) : String(text).trim();
          setAt(ws, t.path, next);
          if (list === 'questions') {
            const bad = quality.questionProblems({ questions: [Object.assign({}, getAt(ws, unit), { n: 1 })] }).bad;
            if (bad.length) return { problems: bad.map(x => x.replace(/^Q\d+: /, '')) };
          }
          return { ws, flash: t.path };
        }
        let nb = normalizeBlock(list, unwrap(raw, 'block'), index, block);
        if (!nb) return { problems: ['no block came back'] };
        if (list === 'questions') {
          nb = keepCorrectOption(block, nb);
          if (t.band) nb.difficulty = t.band;
        }
        if (t.mode === 'fields') {
          const changed = verifyFields(list, block, nb, spec.fields);
          if (changed.length) return { problems: ['only ' + spec.fields.join(', ') + ' may change, but these changed too: ' + changed.join(', ')] };
        }
        const problems = blockProblems(list, nb, m);
        if (problems.length) return { problems };
        if (block && block.reviewNote && !t.dropNote) nb.reviewNote = block.reviewNote;
        ws[list][index] = nb;
        renumber(ws, list, firstNumber(ws0, list));
        return { ws, flash: t.mode === 'fields' && spec.fields.length === 1 ? unit + '.' + spec.fields[0] : unit };
      },
    };
  }
  /** A new block at a position: `ins` = { list, index, ideas, formats, request, position }. */
  function insertJob(m, key, ins) {
    const ws0 = worksheetOf(m, key);
    const plan = planOf(m, key);
    const st = stateOf(m, key);
    return {
      prompt(problems) {
        const base = prompts.buildInsertPrompt(st, plan, m.content, ws0, ins);
        return problems && problems.length ? base + '\n\n## Your previous answer was not taken\n' + problems.map(p => '- ' + p).join('\n') + '\nAnswer again, fixing exactly this.' : base;
      },
      accept(raw) {
        const nb = normalizeBlock(ins.list, unwrap(raw, 'block'), ins.index, null);
        const problems = blockProblems(ins.list, nb, m);
        if (problems.length) return { problems };
        const ws = insertBlock(clone(ws0), ins.list, ins.index, nb);
        let note = '';
        if (ins.list === 'questions') {
          const r = quality.chronologyReport(ws, m.content, m.kind);
          if (r.violations.some(v => v.n === ins.index + 1 || v.n === ins.index + 2)) note = 'Die Textstelle der neuen Frage liegt nicht zwischen denen ihrer Nachbarn.';
        }
        return { ws, flash: ins.list + '.' + ins.index, note };
      },
    };
  }
  /** Write a new worksheet into the material: plan and checks follow. */
  function applyWorksheet(m, key, ws) {
    const plan = syncPlan(planOf(m, key), ws);
    commitWorksheet(m, key, ws, plan);
    refreshChecks(m, key);
  }
  /** Write one text a teacher typed straight into the sheet. */
  function writeText(m, key, path, text) {
    const ws = worksheetOf(m, key);
    setAt(ws, path, text);
    // the first variant is also the material's own worksheet
    if (Array.isArray(m.variants) && m.variants.length && variantOf(m, key) === m.variants[0] && m.worksheet && m.worksheet !== ws) setAt(m.worksheet, path, text);
  }

  const model = {
    LISTS, KEY_FIELDS, split, getAt, setAt, unitOf, parseUnit, inner, unitLabel, elementLabel, elementKind, listEntry, shownNumber,
    variantOf, worksheetOf, planOf, stateOf, commitWorksheet, renumber, insertBlock, removeBlock, removeEntry,
    normalizeBlock, blockProblems, verifyFields, keepCorrectOption, spliceText, sentences, unwrap, syncPlan, refreshChecks,
    notesOf, stripNotes, nextBand, editJob, insertJob, applyWorksheet, writeText, requestFrom, insertIdeas, insertFormats,
    BLOCK_CHIPS, ITEM_CHIPS, TEXT_CHIPS, LIST_LABEL, LIST_NEW,
  };

  /* ------------------------------------------------------------------ */
  /* The interface (browser only)                                         */
  /* ------------------------------------------------------------------ */

  if (typeof document === 'undefined') return model;
  return Object.assign(model, makeUI(model, render));

  function makeUI(M, render) {
    const doc = document;
    const esc = render.esc;
    const STORE_KEY = 'lr.review.v1';
    const state = { review: false, edit: false };
    try { const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); state.review = !!saved.review; state.edit = !!saved.edit; } catch (e) { /* defaults */ }
    const saveState = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify({ review: state.review, edit: state.edit })); } catch (e) { /* not kept */ } };
    let busy = false;
    let current = null;            // the one open panel or bubble: { el, close }
    let swallow = false, swallowTimer = null;
    let pendingFlash = null;
    const revealed = new Set();    // answer / evidence shown under a question
    const hlOK = () => typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';

    function h(tag, attrs, html) {
      const el = doc.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
      if (html != null) el.innerHTML = html;
      return el;
    }
    function close() { if (current) { const c = current; current = null; try { c.close(); } catch (e) { /* gone */ } } }
    // one panel at a time: Esc or a click outside closes it
    // captured before anything else: an open panel takes Esc, the viewer behind it stays open
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) { e.preventDefault(); e.stopImmediatePropagation(); close(); } }, true);
    doc.addEventListener('mousedown', (e) => { if (current && !current.el.contains(e.target)) close(); }, true);

    const say = (el, text, kind) => { if (!el) return; el.className = 'rv-status' + (kind ? ' rv-' + kind : ''); el.textContent = text; };
    const spin = (el, text) => { if (!el) return; el.className = 'rv-status rv-busy'; el.innerHTML = '<span class="rv-spin" aria-hidden="true"></span>' + esc(text); };
    const setDisabled = (list, on) => Array.from(list || []).forEach(x => { x.disabled = on; });
    const head = (title) => `<div class="rv-head"><strong>${esc(title)}</strong><button type="button" class="rv-x" data-a="close" aria-label="Schliessen">×</button></div>`;
    const chipsHtml = (defs, group) => `<div class="rv-chips" data-group="${group || 'chips'}">` + defs.map(c => `<button type="button" class="rv-chip" data-chip="${esc(c[0])}" aria-pressed="false">${esc(c[1])}</button>`).join('') + '</div>';
    const picked = (box, group) => Array.from(box.querySelectorAll(`.rv-chips[data-group="${group || 'chips'}"] .rv-chip[aria-pressed="true"]`)).map(c => c.dataset.chip);
    const wireChips = (box) => box.addEventListener('click', (e) => { const c = e.target.closest('.rv-chip'); if (c) c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); });
    function offsetIn(el, node, offset) {
      try { const r = doc.createRange(); r.selectNodeContents(el); if (!el.contains(node)) return node.compareDocumentPosition && (el.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) ? el.textContent.length : 0; r.setEnd(node, offset); return r.toString().length; } catch (e) { return 0; }
    }
    function caretOffset(el, e) {
      if (!e) return null;
      let node = null, off = 0;
      if (doc.caretRangeFromPoint) { const r = doc.caretRangeFromPoint(e.clientX, e.clientY); if (r) { node = r.startContainer; off = r.startOffset; } }
      else if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(e.clientX, e.clientY); if (p) { node = p.offsetNode; off = p.offset; } }
      return node && el.contains(node) ? offsetIn(el, node, off) : null;
    }

    // the undo notice: the change is made, one click brings the copy back
    let toastEl = null, toastTimer = null;
    function undoToast(msg, undo) {
      if (!toastEl) { toastEl = h('div', { class: 'rv-toast rv-ui', role: 'status' }); doc.body.appendChild(toastEl); }
      toastEl.innerHTML = `<span>${esc(msg)}</span><button type="button" class="btn tiny" data-a="undo">Rückgängig</button>`;
      toastEl.hidden = false;
      toastEl.querySelector('[data-a="undo"]').onclick = async () => { toastEl.hidden = true; clearTimeout(toastTimer); await undo(); };
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.hidden = true; }, 10000);
    }

    /** The two switches: Überarbeiten (the tools with Claude) and Bearbeiten (type into the sheet). */
    function toolbar(onChange) {
      const bar = h('div', { class: 'rv-toolbar rv-ui', role: 'group', 'aria-label': 'Arbeitsblatt überarbeiten' },
        '<button type="button" class="rv-toggle" data-rv-toggle="review" aria-pressed="false" title="Mit der Maus über Aufgaben fahren, klicken, markieren oder zwischen zwei Aufgaben auf + klicken">Überarbeiten</button>'
        + '<button type="button" class="rv-toggle" data-rv-toggle="edit" aria-pressed="false" title="Jeden Text direkt im Blatt ändern">Bearbeiten</button>'
        + '<span class="rv-notes-count" hidden></span>');
      const sync = () => bar.querySelectorAll('[data-rv-toggle]').forEach(b => { const on = !!state[b.dataset.rvToggle]; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
      bar.querySelectorAll('[data-rv-toggle]').forEach(b => b.addEventListener('click', () => {
        state[b.dataset.rvToggle] = !state[b.dataset.rvToggle];
        saveState(); sync(); close();
        if (onChange) onChange();
      }));
      sync();
      bar.setNotes = (n) => { const c = bar.querySelector('.rv-notes-count'); c.hidden = !n; c.textContent = n + (n === 1 ? ' Notiz' : ' Notizen'); };
      return bar;
    }

    /**
     * Lay the tools over one rendered sheet. `o`: { root (the sheet), host
     * (where the tools are placed), material, variantKey, api: { ask, canAI,
     * save, rerender, isRunning }, toolbar }. Called again after every render.
     */
    function attach(o) {
      const root = o.root;
      if (!root) return;
      if (root.__rvDetach) root.__rvDetach();
      const m = o.material, key = o.variantKey || null, api = o.api;
      const ws = () => M.worksheetOf(m, key);
      if (!ws()) return;
      root.classList.toggle('rv-on', !!state.review);
      root.classList.toggle('rv-edit', !!state.edit);
      if (o.toolbar && o.toolbar.setNotes) o.toolbar.setNotes(M.notesOf(ws()).length);
      const off = [];
      const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); off.push(() => el.removeEventListener(ev, fn, opt)); };
      const host = o.host || root.parentElement;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      const layer = h('div', { class: 'rv-layer rv-ui' });
      host.appendChild(layer);
      const rk = (unit, what) => [m.id, key, unit, what].join('|');
      root.__rvDetach = () => {
        off.forEach(f => f()); layer.remove(); close();
        if (hlOK()) { CSS.highlights.delete('rv-sentence'); CSS.highlights.delete('rv-evidence'); }
        root.querySelectorAll('.rv-ui').forEach(x => x.remove());
        delete root.__rvDetach;
      };

      /* --- the result of the last change lights up briefly --- */
      if (pendingFlash) {
        const f = pendingFlash; pendingFlash = null;
        const el = root.querySelector(`[data-edit="${f}"]`) || root.querySelector(`[data-unit="${f}"]`) || root.querySelector(`[data-unit="${M.unitOf(f) || '-'}"]`);
        if (el) { el.classList.add('rv-flash'); setTimeout(() => el.classList.remove('rv-flash'), 1800); if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      }

      /* --- notes and the shown answers stay on their blocks --- */
      const anchorOf = (u) => u.querySelector(':scope > h3, :scope > .q-format') || u.firstChild;
      function decorate() {
        if (hlOK()) CSS.highlights.delete('rv-evidence');
        root.querySelectorAll('[data-unit]').forEach(u => {
          const b = M.getAt(ws(), u.dataset.unit);
          if (!b) return;
          if (b.reviewNote && state.review) u.insertBefore(noteBar(u, b), (anchorOf(u) || u.firstChild).nextSibling);
          if (u.dataset.unit.startsWith('questions.')) revealBox(u);
        });
      }
      function noteBar(u, b) {
        const unit = u.dataset.unit;
        const bar = h('div', { class: 'rv-note rv-ui' }, `<span class="rv-note-text"><strong>Notiz:</strong> ${esc(b.reviewNote)}</span><button type="button" class="btn tiny" data-a="apply">Damit umschreiben</button><button type="button" class="btn tiny ghost" data-a="clear">Löschen</button><span class="rv-status" role="status"></span>`);
        bar.addEventListener('click', async (e) => {
          const a = e.target.closest('[data-a]'); if (!a) return;
          e.stopPropagation();
          if (a.dataset.a === 'clear') {
            const W = clone(ws()); delete M.getAt(W, unit).reviewNote;
            await commit(W, unit, 'Notiz gelöscht', '', { quiet: true });
          } else {
            run(M.editJob(m, key, { unit, mode: 'block', request: b.reviewNote, label: M.unitLabel(ws(), unit), dropNote: true }),
              { status: bar.querySelector('.rv-status'), controls: bar.querySelectorAll('button'), label: M.unitLabel(ws(), unit) + ' wird umgeschrieben', done: M.unitLabel(ws(), unit) + ' umgeschrieben' });
          }
        });
        return bar;
      }
      function markEvidence(quote) {
        if (!hlOK() || !quote) return false;
        const scope = root.querySelector('.block.text') || root.querySelector('.script-appendix') || null;
        if (!scope) return false;
        const nodes = [];
        const walk = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        let n, all = '';
        while ((n = walk.nextNode())) { nodes.push({ n, start: all.length }); all += n.nodeValue; }
        const norm = (t) => t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').toLowerCase();
        const at = norm(all).indexOf(norm(String(quote)).replace(/\s+/g, ' ').trim());
        if (at < 0) return false;
        const end = at + String(quote).replace(/\s+/g, ' ').trim().length;
        const find = (pos) => { for (let i = nodes.length - 1; i >= 0; i--) if (nodes[i].start <= pos) return { node: nodes[i].n, off: Math.min(pos - nodes[i].start, nodes[i].n.nodeValue.length) }; return null; };
        const a = find(at), b = find(end);
        if (!a || !b) return false;
        const r = doc.createRange(); r.setStart(a.node, a.off); r.setEnd(b.node, b.off);
        const prev = CSS.highlights.get('rv-evidence');
        const hlt = prev || new Highlight();
        hlt.add(r);
        CSS.highlights.set('rv-evidence', hlt);
        return true;
      }
      function revealBox(u) {
        const unit = u.dataset.unit;
        const q = M.getAt(ws(), unit);
        u.querySelectorAll(':scope > .rv-reveal').forEach(x => x.remove());
        const showA = revealed.has(rk(unit, 'answer')), showE = revealed.has(rk(unit, 'evidence'));
        if (!q || (!showA && !showE)) return;
        const marked = showE ? markEvidence(q.evidenceQuote) : false;
        const box = h('div', { class: 'rv-reveal rv-ui' },
          (showA ? `<p><strong>Lösung:</strong> ${render.answerText(q)}</p>` : '')
          + (showE ? `<p><strong>Textstelle${q.evidenceRef ? ' ' + esc(q.evidenceRef) : ''}:</strong> “${esc(q.evidenceQuote || '–')}”${marked ? ' <span class="rv-muted">– im Text markiert</span>' : ''}</p>` : '')
          + (q.rationale && showA ? `<p class="rv-muted">${esc(q.rationale)}</p>` : ''));
        u.appendChild(box);
      }
      decorate();

      /* --- Bearbeiten: every text can be typed into; each input goes into the model --- */
      if (state.edit) {
        let saveTimer = null;
        const plain = (() => { try { const t = doc.createElement('span'); t.contentEditable = 'plaintext-only'; return t.contentEditable === 'plaintext-only'; } catch (e) { return false; } })();
        root.querySelectorAll('[data-edit]').forEach(el => {
          el.setAttribute('contenteditable', plain ? 'plaintext-only' : 'true');
          el.setAttribute('spellcheck', 'true');
          on(el, 'input', () => {
            M.writeText(m, key, el.dataset.edit, el.textContent.replace(/\s+/g, ' '));
            clearTimeout(saveTimer); saveTimer = setTimeout(() => api.save(m), 700);
          });
          on(el, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
          on(el, 'paste', (e) => { e.preventDefault(); const t = ((e.clipboardData || window.clipboardData).getData('text/plain') || '').replace(/\s+/g, ' '); doc.execCommand('insertText', false, t); });
          on(el, 'blur', () => { clearTimeout(saveTimer); M.refreshChecks(m, key); api.save(m); });
        });
      }
      if (!state.review) return;

      /* --- 1. Hover: outline, a tag that says what a click changes, the element that lights up --- */
      let hoverUnit = null, hoverEl = null, tag = null, raf = 0, lastEvt = null;
      function tagText(unit, el) {
        const W = ws();
        if (!unit) return el ? M.elementLabel(W, el.dataset.edit) + ' · Klick: ändern' : '';
        const L = M.unitLabel(W, unit.dataset.unit);
        if (state.edit) return L + ' · direkt tippen';
        return el ? L + ' · ' + M.elementLabel(W, el.dataset.edit) + ' · Klick: ändern' : L + ' · Klick: ganze Aufgabe ändern';
      }
      function makeTag(u) {
        const unit = u.dataset.unit;
        const t = h('div', { class: 'rv-tag rv-ui' });
        let html = '<span class="rv-tag-label"></span>';
        if (unit.startsWith('questions.')) {
          const q = M.getAt(ws(), unit) || {};
          const up = M.nextBand(q.difficulty, 1), down = M.nextBand(q.difficulty, -1);
          html += `<span class="rv-diff" title="Schwierigkeit dieser Frage (CEFR)">${esc(q.difficulty || '–')}</span>`
            + `<button type="button" data-rv="harder" title="${up ? 'Schwieriger machen: ' + esc(q.difficulty) + ' → ' + up : 'Schon die höchste Stufe'}"${up ? '' : ' disabled'} aria-label="Schwieriger machen">▲</button>`
            + `<button type="button" data-rv="easier" title="${down ? 'Leichter machen: ' + esc(q.difficulty) + ' → ' + down : 'Schon die tiefste Stufe'}"${down ? '' : ' disabled'} aria-label="Leichter machen">▼</button>`
            + `<button type="button" data-rv="answer" aria-pressed="${revealed.has(rk(unit, 'answer'))}">Lösung</button>`
            + `<button type="button" data-rv="evidence" aria-pressed="${revealed.has(rk(unit, 'evidence'))}">Textstelle</button>`;
        }
        t.innerHTML = html;
        t.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-rv]'); if (!b) return;
          e.preventDefault(); e.stopPropagation();
          tagAction(u, b.dataset.rv, b, t);
        });
        return t;
      }
      function tagAction(u, what, btn, t) {
        const unit = u.dataset.unit;
        if (what === 'answer' || what === 'evidence') {
          const k = rk(unit, what);
          if (revealed.has(k)) revealed.delete(k); else revealed.add(k);
          btn.setAttribute('aria-pressed', String(revealed.has(k)));
          // the marks in the text follow every shown evidence
          if (hlOK()) CSS.highlights.delete('rv-evidence');
          root.querySelectorAll('[data-unit^="questions."]').forEach(revealBox);
          layoutGaps(); placeTag();
          return;
        }
        const q = M.getAt(ws(), unit) || {};
        const band = M.nextBand(q.difficulty, what === 'harder' ? 1 : -1);
        if (!band) return;
        const L = M.unitLabel(ws(), unit);
        let status = u.querySelector(':scope > .rv-inline-status');
        if (!status) { status = h('p', { class: 'rv-status rv-inline-status rv-ui', role: 'status' }); u.appendChild(status); }
        const request = what === 'harder'
          ? `Make this question harder: it should now demand ${band} instead of ${q.difficulty} — more demanding thinking (inferring, combining places, a subtler distractor), not rarer words. Keep the skill, the format and the place in the material; the answer key follows.`
          : `Make this question easier: it should now demand ${band} instead of ${q.difficulty} — a more direct question about a clearer place in the material. Keep the skill, the format and the place in the material; the answer key follows.`;
        run(M.editJob(m, key, { unit, mode: 'block', request, band, label: L }),
          { status, controls: t.querySelectorAll('button'), label: `${L} wird ${what === 'harder' ? 'schwieriger' : 'leichter'} (${q.difficulty} → ${band})`, done: `${L}: ${q.difficulty} → ${band}` });
      }
      function highlightSentence(el, e) {
        if (!hlOK()) return false;
        CSS.highlights.delete('rv-sentence');
        if (!el || !e || el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) return false;
        const ss = M.sentences(el.textContent);
        if (ss.length < 2) return false;
        const at = caretOffset(el, e);
        const s = at == null ? null : ss.find(x => at >= x.start && at <= x.end);
        if (!s) return false;
        const r = doc.createRange(); r.setStart(el.firstChild, s.start); r.setEnd(el.firstChild, s.end);
        CSS.highlights.set('rv-sentence', new Highlight(r));
        return true;
      }
      // the tag sits above everything (also above the "+" between blocks), at the block's corner
      function placeTag() {
        if (!tag || !hoverUnit) return;
        const hr = host.getBoundingClientRect(), r = hoverUnit.getBoundingClientRect();
        tag.style.top = Math.round(r.top - hr.top - 13) + 'px';
        tag.style.right = Math.round(Math.max(4, hr.right - r.right - 2)) + 'px';
      }
      function setHover(u, el, e) {
        if (hoverEl && hoverEl !== el) hoverEl.classList.remove('rv-hot');
        if (hoverUnit !== u) {
          if (hoverUnit) hoverUnit.classList.remove('rv-hover');
          if (tag) { tag.remove(); tag = null; }
          hoverUnit = u;
          if (u) {
            u.classList.add('rv-hover');
            tag = makeTag(u);
            // leaving the block for its own tag keeps both
            tag.addEventListener('mouseleave', (ev) => { if (!(ev.relatedTarget && hoverUnit && hoverUnit.contains(ev.relatedTarget))) setHover(null, null, null); });
            layer.appendChild(tag);
            placeTag();
          }
        }
        hoverEl = el;
        const sentence = !state.edit && highlightSentence(el, e);
        if (el) el.classList.toggle('rv-hot', !sentence);
        if (tag) tag.querySelector('.rv-tag-label').textContent = tagText(u, el);
      }
      on(root, 'mousemove', (e) => {
        lastEvt = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const t = lastEvt.target;
          if (!t.closest || t.closest('.rv-ui')) return;   // over our own tools: keep what is shown
          const u = t.closest('[data-unit]'), el = t.closest('[data-edit]');
          setHover(u && root.contains(u) ? u : null, el && root.contains(el) ? el : null, lastEvt);
        });
      });
      on(root, 'mouseleave', (e) => {
        if (tag && e.relatedTarget && tag.contains(e.relatedTarget)) return;
        setHover(null, null, null);
        if (hlOK()) CSS.highlights.delete('rv-sentence');
      });

      /* --- 2./3. A click: the whole block, or one element --- */
      on(root, 'click', (e) => {
        if (swallow) { swallow = false; clearTimeout(swallowTimer); e.preventDefault(); e.stopPropagation(); return; }
        const t = e.target;
        if (!t.closest || t.closest('.rv-ui') || state.edit) return;
        const el = t.closest('[data-edit]'), u = t.closest('[data-unit]');
        if (el && root.contains(el)) { e.preventDefault(); openBubble({ paths: [el.dataset.edit], el, at: caretOffset(el, e) }); return; }
        if (u && root.contains(u)) { e.preventDefault(); openPanel(u); }
      });
      // marking text is never a click: the bubble opens for what is marked
      on(root, 'mouseup', (e) => {
        if (state.edit || (e.target.closest && e.target.closest('.rv-ui'))) return;
        const sel = doc.getSelection && doc.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) return;
        swallow = true; clearTimeout(swallowTimer); swallowTimer = setTimeout(() => { swallow = false; }, 400);
        handleSelection(range);
      });
      function handleSelection(range) {
        const els = Array.from(root.querySelectorAll('[data-edit]')).filter(el => range.intersectsNode(el));
        const within = els.find(el => el.contains(range.startContainer) && el.contains(range.endContainer));
        if (within) {
          const start = offsetIn(within, range.startContainer, range.startOffset), end = offsetIn(within, range.endContainer, range.endOffset);
          if (end <= start) return;
          if (end - start >= within.textContent.trim().length - 1) return openBubble({ paths: [within.dataset.edit], el: within });
          return openBubble({ paths: [within.dataset.edit], el: within, span: { start, end } });
        }
        if (!els.length) return;
        const units = new Set(els.map(el => M.unitOf(el.dataset.edit)));
        const entries = els.map(el => M.listEntry(el.dataset.edit));
        if (els.length > 1 && units.size === 1 && !units.has(null) && entries.every(Boolean) && new Set(entries.map(x => x.field)).size === 1) return openBubble({ paths: els.map(el => el.dataset.edit), el: els[0], multi: true });
        if (els.length === 1) return openBubble({ paths: [els[0].dataset.edit], el: els[0] });
        openChooser(els);
      }

      function place(box, el) {
        layer.appendChild(box);
        const hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
        const w = Math.min(box.offsetWidth || 340, hr.width - 16);
        box.style.top = Math.round(r.bottom - hr.top + 6) + 'px';
        box.style.left = Math.round(Math.max(8, Math.min(r.left - hr.left, hr.width - w - 8))) + 'px';
      }
      function rangeLabel(paths) {
        const es = paths.map(M.listEntry);
        const idx = es.map(x => x.index).sort((a, b) => a - b);
        const f = es[0].field;
        if (f === 'options') return 'Optionen ' + String.fromCharCode(65 + idx[0]) + '–' + String.fromCharCode(65 + idx[idx.length - 1]);
        return (f === 'criteria' ? 'Kriterien ' : 'Items ') + (idx[0] + 1) + '–' + (idx[idx.length - 1] + 1);
      }
      function openChooser(els) {
        close();
        const box = h('div', { class: 'rv-bubble rv-ui', role: 'dialog', 'aria-label': 'Welcher Teil ist gemeint?' },
          head('Welcher Teil ist gemeint?') + '<div class="rv-choose">' + els.slice(0, 8).map((el, i) => {
            const u = M.unitOf(el.dataset.edit);
            return `<button type="button" class="rv-chip" data-i="${i}">${esc((u ? M.unitLabel(ws(), u) + ' · ' : '') + M.elementLabel(ws(), el.dataset.edit))}</button>`;
          }).join('') + '</div>');
        box.addEventListener('click', (e) => {
          if (e.target.closest('[data-a="close"]')) return close();
          const b = e.target.closest('[data-i]'); if (!b) return;
          const el = els[Number(b.dataset.i)];
          openBubble({ paths: [el.dataset.edit], el });
        });
        place(box, els[0]);
        current = { el: box, close: () => box.remove() };
      }

      /* --- 3. One element: a bubble next to it --- */
      function openBubble(o2) {
        close();
        const W = ws();
        const paths = o2.paths, path = paths[0], unit = M.unitOf(path);
        const multi = paths.length > 1;
        const value = String(M.getAt(W, path) == null ? '' : M.getAt(W, path));
        const ss = M.sentences(value);
        const sentence = !multi && !o2.span && o2.at != null && ss.length > 1 ? ss.find(s => o2.at >= s.start && o2.at <= s.end) : null;
        const kind = M.elementKind(path);
        const chips = kind === 'item' ? M.ITEM_CHIPS : M.TEXT_CHIPS;
        const title = multi ? M.unitLabel(W, unit) + ' · ' + rangeLabel(paths)
          : (unit ? M.unitLabel(W, unit) + ' · ' : '') + M.elementLabel(W, path) + (o2.span ? ' · Auswahl' : '');
        const scopes = multi ? [] : [
          o2.span ? ['selection', 'Auswahl'] : null,
          sentence ? ['sentence', 'Satz'] : null,
          ['element', kind === 'item' ? 'Eintrag' : 'Absatz'],
          unit ? ['block', 'Aufgabe'] : null,
        ].filter(Boolean);
        let scope = scopes.length ? scopes[0][0] : 'fields';
        const box = h('div', { class: 'rv-bubble rv-ui', role: 'dialog', 'aria-label': title },
          head(title)
          + (scopes.length > 1 ? '<div class="rv-scope" role="radiogroup" aria-label="Wo gilt die Änderung?">' + scopes.map(s => `<button type="button" role="radio" data-scope="${s[0]}" aria-checked="${s[0] === scope}">${s[1]}</button>`).join('') + '</div>' : '')
          + (o2.span ? `<p class="rv-sub">„${esc(value.slice(o2.span.start, o2.span.end).slice(0, 80))}“</p>` : '')
          + chipsHtml(chips)
          + '<input type="text" class="rv-words" placeholder="Eigene Worte, z. B. „mit einem Beispiel aus dem Text“" aria-label="Eigene Worte">'
          + '<div class="rv-actions"><button type="button" class="btn tiny primary" data-a="apply">Anwenden</button>'
          + (multi ? '' : '<button type="button" class="btn tiny" data-a="self">Selbst bearbeiten</button>')
          + (!multi && M.listEntry(path) ? '<button type="button" class="btn tiny" data-a="remove">Entfernen</button>' : '')
          + (unit ? '<button type="button" class="btn tiny ghost" data-a="whole">Ganze Aufgabe …</button>' : '')
          + '</div><p class="rv-status" role="status"></p>');
        wireChips(box);
        const status = box.querySelector('.rv-status');
        if (!api.canAI()) say(status, 'Ohne Claude-Zugang: „Selbst bearbeiten“ geht.', 'hint');
        box.addEventListener('click', (e) => {
          const s = e.target.closest('[data-scope]');
          if (s) { scope = s.dataset.scope; box.querySelectorAll('[data-scope]').forEach(b => b.setAttribute('aria-checked', String(b === s))); return; }
          const a = e.target.closest('[data-a]'); if (!a) return;
          if (a.dataset.a === 'close') return close();
          if (a.dataset.a === 'whole') { const u = root.querySelector(`[data-unit="${unit}"]`); return u ? openPanel(u) : null; }
          if (a.dataset.a === 'self') { close(); return editInPlace(o2.el, path); }
          if (a.dataset.a === 'remove') {
            const W2 = clone(ws());
            const r = M.removeEntry(W2, path);
            if (!r.ok) return say(status, r.error, 'error');
            return commit(W2, unit, M.elementLabel(W, path) + ' entfernt');
          }
          const request = M.requestFrom(chips, picked(box), box.querySelector('.rv-words').value);
          if (!request) return say(status, 'Bitte einen Vorschlag wählen oder eigene Worte eingeben.', 'error');
          let t;
          if (multi) t = { unit, mode: 'fields', fields: paths };
          else if (scope === 'block') t = { unit, mode: 'block' };
          else if (scope === 'selection') t = { path, mode: 'span', span: o2.span };
          else if (scope === 'sentence') t = { path, mode: 'span', span: sentence };
          else if (unit && unit.startsWith('questions.')) t = { unit, mode: 'fields', fields: [path] };
          else t = { path, mode: 'text' };
          run(M.editJob(m, key, Object.assign(t, { request, label: title })),
            { status, controls: box.querySelectorAll('button, input'), label: 'Ändere ' + title, done: title + ' geändert' });
        });
        box.querySelector('.rv-words').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); box.querySelector('[data-a="apply"]').click(); } });
        place(box, o2.el);
        current = { el: box, close: () => box.remove() };
      }
      /** "Selbst bearbeiten": type into the element right there. */
      function editInPlace(el, path) {
        if (!el) return;
        const before = el.textContent;
        el.setAttribute('contenteditable', 'true');
        el.classList.add('rv-typing');
        el.focus();
        try { const r = doc.createRange(); r.selectNodeContents(el); const s = doc.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* caret stays */ }
        let done = false;
        const finish = (keep) => {
          if (done) return; done = true;
          el.removeAttribute('contenteditable'); el.classList.remove('rv-typing');
          const text = el.textContent.replace(/\s+/g, ' ').trim();
          if (!keep || !text || text === before.trim()) { el.textContent = before; return; }
          const W2 = clone(ws()); M.setAt(W2, path, text);
          commit(W2, path, M.elementLabel(ws(), path) + ' geändert');
        };
        el.addEventListener('keydown', function k(e) {
          if (e.key === 'Enter') { e.preventDefault(); el.removeEventListener('keydown', k); finish(true); }
          if (e.key === 'Escape') { e.preventDefault(); el.removeEventListener('keydown', k); finish(false); }
        });
        el.addEventListener('blur', () => finish(true), { once: true });
      }

      /* --- 2. The whole block: a panel under its heading --- */
      function openPanel(u) {
        close();
        const unit = u.dataset.unit;
        const W = ws(), b = M.getAt(W, unit);
        const L = M.unitLabel(W, unit);
        const box = h('div', { class: 'rv-panel rv-ui', role: 'dialog', 'aria-label': L + ' ändern' },
          head(L + ' ändern')
          + chipsHtml(M.BLOCK_CHIPS)
          + '<textarea class="rv-words" rows="2" placeholder="Eigene Anweisung, z. B. „mit einer Frage zum dritten Absatz“" aria-label="Eigene Anweisung"></textarea>'
          + '<div class="rv-actions"><button type="button" class="btn tiny primary" data-a="rewrite">Jetzt umschreiben</button>'
          + '<button type="button" class="btn tiny" data-a="note">Als Notiz behalten</button>'
          + '<button type="button" class="btn tiny danger" data-a="remove">Entfernen</button>'
          + '<button type="button" class="btn tiny ghost" data-a="close">Schliessen</button></div>'
          + '<p class="rv-status" role="status"></p>');
        wireChips(box);
        const status = box.querySelector('.rv-status');
        if (!api.canAI()) say(status, 'Ohne Claude-Zugang: Notiz und Entfernen gehen, Umschreiben nicht.', 'hint');
        let armed = false;
        box.addEventListener('click', (e) => {
          const a = e.target.closest('[data-a]'); if (!a) return;
          e.stopPropagation();
          if (a.dataset.a === 'close') return close();
          if (a.dataset.a === 'remove') {
            if (!armed) { armed = true; a.textContent = 'Wirklich entfernen?'; a.classList.add('armed'); return; }
            const { list, index } = M.parseUnit(unit);
            return commit(M.removeBlock(clone(W), list, index), null, L + ' entfernt', '', { shift: true });
          }
          const chosen = picked(box), words = box.querySelector('.rv-words').value;
          if (a.dataset.a === 'note') {
            const text = M.BLOCK_CHIPS.filter(c => chosen.includes(c[0])).map(c => c[1]).concat(words.trim() ? [words.trim()] : []).join(' · ');
            if (!text) return say(status, 'Bitte einen Vorschlag wählen oder eine Anweisung schreiben.', 'error');
            const W2 = clone(W); M.getAt(W2, unit).reviewNote = text;
            return commit(W2, unit, 'Notiz behalten', '', { quiet: true });
          }
          const request = M.requestFrom(M.BLOCK_CHIPS, chosen, words);
          if (!request) return say(status, 'Bitte einen Vorschlag wählen oder eine Anweisung schreiben.', 'error');
          run(M.editJob(m, key, { unit, mode: 'block', request, label: L }),
            { status, controls: box.querySelectorAll('button, textarea'), label: L + ' wird umgeschrieben', done: L + ' umgeschrieben' });
        });
        const anchor = anchorOf(u);
        u.insertBefore(box, anchor ? anchor.nextSibling : u.firstChild);
        current = { el: box, close: () => { box.remove(); layoutGaps(); } };
        layoutGaps();
        const ta = box.querySelector('textarea'); if (ta) ta.focus();
      }

      /* --- 4. "+" between blocks: a new block at exactly that place --- */
      const gaps = new Map();
      function unitsOf(listEl, list) { return Array.from(listEl.querySelectorAll('[data-unit]')).filter(u => new RegExp('^' + list + '\\.\\d+$').test(u.dataset.unit)); }
      function layoutGaps() {
        const hr = host.getBoundingClientRect(), sr = root.getBoundingClientRect();
        const seen = new Set();
        const narrow = sr.left - hr.left < 40;
        root.querySelectorAll('[data-list]').forEach(listEl => {
          const list = listEl.dataset.list;
          const units = unitsOf(listEl, list);
          for (let i = 0; i <= units.length; i++) {
            const prev = units[i - 1], next = units[i];
            if (!prev && !next) continue;
            // the zone is the room between two blocks, never a block itself
            const top = !prev ? next.getBoundingClientRect().top - 12 : prev.getBoundingClientRect().bottom;
            const bottom = !next ? prev.getBoundingClientRect().bottom + 12 : next.getBoundingClientRect().top;
            const height = Math.max(6, Math.min(28, bottom - top));
            const y = (top + bottom) / 2;
            const id = list + ':' + i;
            seen.add(id);
            let g = gaps.get(id);
            if (!g) {
              g = h('div', { class: 'rv-gap', role: 'button', tabindex: '0', 'data-list': list, 'data-index': String(i), 'aria-label': M.LIST_NEW[list] + ' hier einfügen' }, '<span class="rv-gap-line"></span><span class="rv-plus" aria-hidden="true">+</span>');
              const openIt = (e) => { e.preventDefault(); e.stopPropagation(); openInsert(list, i, listEl); };
              g.addEventListener('click', openIt);
              g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openIt(e); });
              layer.appendChild(g);
              gaps.set(id, g);
            }
            g.classList.toggle('rv-gap-inside', narrow);
            g.style.top = Math.round(y - hr.top - height / 2) + 'px';
            g.style.height = Math.round(height) + 'px';
            g.style.left = Math.round(sr.left - hr.left) + 'px';
            g.style.width = Math.round(sr.width) + 'px';
          }
        });
        for (const [id, g] of gaps) if (!seen.has(id)) { g.remove(); gaps.delete(id); }
      }
      function openInsert(list, index, listEl) {
        close();
        const W = ws();
        const n = (W[list] || []).length;
        const L = M.LIST_LABEL[list];
        const num = (i) => M.shownNumber(W, list, i);
        const position = n === 0 ? 'als erste' : index === 0 ? `vor ${L} ${num(0)}` : index >= n ? `nach ${L} ${num(n - 1)}` : `zwischen ${L} ${num(index - 1)} und ${L} ${num(index)}`;
        const en = { questions: 'Q', preTasks: 'pre-task ', postTasks: 'post-task ', higherOrder: 'task ' }[list];
        const positionEn = n === 0 ? 'as the first one' : index === 0 ? `before ${en}${index + 1}` : index >= n ? `after ${en}${n}` : `between ${en}${index} and ${en}${index + 1}`;
        const ideas = M.insertIdeas(list), formats = M.insertFormats(list, m.kind);
        const box = h(listEl.tagName === 'OL' ? 'li' : 'div', { class: 'rv-insert rv-ui', role: 'dialog', 'aria-label': M.LIST_NEW[list] },
          head(M.LIST_NEW[list]) + `<p class="rv-pos">${esc(position)}</p>`
          + '<p class="rv-sub">Idee (auch mehrere)</p>' + chipsHtml(ideas, 'idea')
          + (formats.length ? '<p class="rv-sub">' + (list === 'questions' ? 'Format (optional)' : 'Sozialform und Arbeitsweise (optional)') + '</p>' + chipsHtml(formats, 'format') : '')
          + '<input type="text" class="rv-words" placeholder="Eigene Worte, z. B. „zum zweiten Absatz“" aria-label="Eigene Worte">'
          + '<div class="rv-actions"><button type="button" class="btn tiny primary" data-a="add">Hinzufügen</button><button type="button" class="btn tiny ghost" data-a="close">Abbrechen</button></div>'
          + '<p class="rv-status" role="status"></p>');
        wireChips(box);
        const status = box.querySelector('.rv-status');
        if (!api.canAI()) say(status, 'Ohne Claude-Zugang lässt sich hier nichts schreiben lassen.', 'hint');
        box.addEventListener('click', (e) => {
          const a = e.target.closest('[data-a]'); if (!a) return;
          e.stopPropagation();
          if (a.dataset.a === 'close') return close();
          const pickedIdeas = picked(box, 'idea'), pickedFormats = picked(box, 'format');
          const words = box.querySelector('.rv-words').value;
          const ins = {
            list, index, position: positionEn,
            ideas: ideas.filter(c => pickedIdeas.includes(c[0])).map(c => c[2]),
            formats: list === 'questions' ? pickedFormats : [],
            request: (list === 'questions' ? [] : formats.filter(c => pickedFormats.includes(c[0])).map(c => c[2])).concat(words.trim() ? [words.trim()] : []).join('; '),
          };
          run(M.insertJob(m, key, ins), { status, controls: box.querySelectorAll('button, input'), label: M.LIST_NEW[list] + ' wird geschrieben', done: M.LIST_NEW[list] + ' eingefügt (' + position + ')', shift: true });
        });
        const units = unitsOf(listEl, list);
        if (units[index]) units[index].parentNode.insertBefore(box, units[index]); else if (units.length) units[units.length - 1].parentNode.insertBefore(box, units[units.length - 1].nextSibling); else listEl.appendChild(box);
        current = { el: box, close: () => { box.remove(); layoutGaps(); } };
        layoutGaps();
      }
      layoutGaps();
      let resizeTimer = null;
      on(window, 'resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layoutGaps, 120); });
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { if (root.isConnected) layoutGaps(); }).catch(() => {});

      /* --- 5. Every change with Claude: one target, checked, undoable --- */
      async function run(job, ui) {
        if (busy) return say(ui.status, 'Es läuft schon eine Änderung – bitte warten.', 'error');
        if (api.isRunning && api.isRunning()) return say(ui.status, 'Gerade wird ein Material erstellt – bitte warten.', 'error');
        if (!api.canAI()) return say(ui.status, 'Ohne Claude-Zugang geht hier nur „Selbst bearbeiten“ oder der Modus „Bearbeiten“.', 'error');
        busy = true;
        setDisabled(ui.controls, true);
        spin(ui.status, ui.label + ' …');
        let problems = [];
        try {
          for (let attempt = 1; attempt <= 2; attempt++) {
            const raw = await api.ask(job.prompt(problems));
            const res = job.accept(raw);
            if (res && res.ws) { busy = false; await commit(res.ws, res.flash, ui.done || 'Geändert', res.note, { shift: ui.shift }); return; }
            problems = (res && res.problems) || ['the answer could not be read'];
          }
          say(ui.status, 'Nicht übernommen – das Blatt bleibt, wie es war. Grund: ' + problems.join('; '), 'error');
        } catch (e) {
          say(ui.status, 'Fehler – das Blatt bleibt, wie es war: ' + ((e && (e.message || e.code)) || String(e)), 'error');
        } finally {
          busy = false;
          setDisabled(ui.controls, false);
        }
      }
      async function commit(newWs, flash, message, note, opt) {
        const snap = clone({ worksheet: m.worksheet, variants: m.variants, plan: m.plan, quality: m.quality });
        M.applyWorksheet(m, key, newWs);
        if (opt && opt.shift) Array.from(revealed).filter(k => k.startsWith(m.id + '|')).forEach(k => revealed.delete(k));
        pendingFlash = flash || null;
        close();
        try { await api.save(m); } catch (e) { /* stays on screen */ }
        api.rerender();
        if (opt && opt.quiet) return;
        undoToast(message + (note ? ' – ' + note : ''), async () => {
          Object.assign(m, clone(snap));
          try { await api.save(m); } catch (e) { /* stays on screen */ }
          api.rerender();
        });
      }
    }

    return { toolbar, attach, state, close, isBusy: () => busy };
  }
});
