/*
 * LRMaster concept manifest — one entry per requirement of the concept
 * document (docs/Konzept_Listening_Reading_Creator.md), each bound to the
 * function, setting, rule or rendered output that implements it, together
 * with a machine check. `app/checks.js` runs these in Node (npm test) and in
 * the app (page "Konzept-Check").
 *
 * Kinds:
 *   setting  – key in core.SCHEMA; must have a control and must change a prompt
 *   function – a runtime behaviour proven by `check(env)`
 *   rule     – a quality rule id in quality.RULES (deterministic or Claude-judged)
 *   render   – a property of the Student/Teacher output proven on a fixture
 *   ui       – a navigation/structure element that must exist (selector)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LR = root.LR || {}; root.LR.manifest = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ok = (cond, msg) => (cond ? true : (msg || 'check failed'));
  const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const M = [];
  const add = (e) => { M.push(e); };

  /* §1 Ziel */
  add({ id: 'S01.pipeline', section: 1, title: 'Listening/Reading inkl. Aufgaben aus Lehrmittel + Vocabulary-Datenbank erzeugen', kind: 'function',
    check(env) { return ok(typeof env.pipeline === 'function' || env.pipelineSource, 'generate pipeline missing'); } });
  add({ id: 'S01.unit_selection', section: 1, title: 'Beim Erstellen wird eine Unit gewählt; Thema, Sprache und Zielvokabeln orientieren sich daran', kind: 'function',
    check(env) {
      const p = env.prompts.buildContentPrompt(env.state(), env.core.buildPlan(env.state(), env.ctx));
      const w = env.ctx.unit.words[0].word;
      return ok(p.includes(env.ctx.unit.name) && p.includes(w), 'unit name/vocabulary not in prompt');
    } });
  add({ id: 'S01.independent_difficulty', section: 1, title: 'Textschwierigkeit und Frageschwierigkeit unabhängig steuerbar', kind: 'function',
    check(env) {
      const a = env.core.buildPlan(env.state({ cefr: 'B1.2', questionDifficulty: 10 }), env.ctx);
      const b = env.core.buildPlan(env.state({ cefr: 'B1.2', questionDifficulty: 90 }), env.ctx);
      const c = env.core.buildPlan(env.state({ cefr: 'A2.1', questionDifficulty: 50 }), env.ctx);
      return ok(a.cefr === b.cefr && a.questionBand !== b.questionBand && c.cefr !== a.cefr && c.questionBand === 'A2.1', `bands ${a.questionBand}/${b.questionBand}/${c.questionBand}`);
    } });

  /* §2 Hauptnavigation */
  add({ id: 'S02.nav_listening', section: 2, title: 'Startseite: „Listening erstellen“', kind: 'ui', selector: '#nav-listening' });
  add({ id: 'S02.nav_reading', section: 2, title: 'Startseite: „Reading erstellen“', kind: 'ui', selector: '#nav-reading' });
  add({ id: 'S02.nav_vocab', section: 2, title: 'Startseite: „Vocabulary / Lehrmittel verwalten“', kind: 'ui', selector: '#nav-vocab' });
  add({ id: 'S02.textbook_create', section: 2, title: 'Lehrmittel anlegen', kind: 'ui', selector: '#btn-new-textbook' });
  add({ id: 'S02.vocab_import', section: 2, title: 'Vocabulary-Dateien importieren (CSV/TSV/XLSX/Text)', kind: 'function',
    check(env) {
      const r = env.vocab.parseText('Unit 1: Friends\nget on with\tsich verstehen mit\nfall out\tsich zerstreiten\nUnit 2 – Travel\nbackpack\tRucksack');
      const c = env.vocab.parseText('unit,word,translation\n1,cast,Besetzung\n1,plot,Handlung');
      const x = env.vocab.parseRows([['Word', 'German'], ['sequel', 'Fortsetzung']], { defaultUnit: 'Unit 8' });
      return ok(r.units.length === 2 && r.units[0].words.length === 2 && r.units[0].topic === 'Friends' && r.units[1].words[0].translation === 'Rucksack' && c.units[0].words.length === 2 && x.units[0].name === 'Unit 8', JSON.stringify(r.units));
    } });
  add({ id: 'S02.vocab_update_replace', section: 2, title: 'Vocabulary aktualisieren oder ersetzen', kind: 'function',
    check(env) {
      const tb = { id: 't', name: 'X', units: [{ id: 'u', name: 'Unit 1', topic: '', words: [{ word: 'old', translation: 'alt' }] }] };
      const upd = env.vocab.mergeUnits(tb, [{ name: 'Unit 1', words: [{ word: 'new', translation: 'neu' }] }], 'update');
      const rep = env.vocab.mergeUnits(tb, [{ name: 'Unit 1', words: [{ word: 'new', translation: 'neu' }] }], 'replace');
      return ok(upd.units[0].words.length === 2 && rep.units[0].words.length === 1 && rep.units[0].words[0].word === 'new');
    } });
  add({ id: 'S02.new_list_button', section: 2, title: 'Neues Lehrmittel (neue Vokabelliste) anlegen – ohne vorhandene Liste', kind: 'ui', selector: '#btn-new-textbook' });
  add({ id: 'S02.new_list_in_import', section: 2, title: 'Import kann direkt in ein NEU anzulegendes Lehrmittel gehen', kind: 'function',
    check(env) {
      const hasOption = env.hasControl('[value="__new__"]') && env.hasControl('#import-new-textbook') && env.hasControl('#import-textbook');
      // Building a list from scratch: merging into an empty textbook creates it.
      const fresh = { id: 'tb_new', name: 'Brand new book', units: [] };
      const built = env.vocab.mergeUnits(fresh, [{ name: 'Unit 1', topic: 'Movies', words: [{ word: 'cast', translation: 'Besetzung' }, { word: 'plot', translation: 'Handlung' }] }], 'add');
      const ok2 = built.units.length === 1 && built.units[0].words.length === 2 && built.units[0].topic === 'Movies' && !!built.units[0].id;
      return ok(hasOption && ok2, hasOption ? 'merging into an empty textbook failed' : 'no "new textbook" option in the import form');
    } });
  add({ id: 'S02.unit_modes', section: 2, title: 'Unit-Zuordnung wählbar: aus der Liste erkennen / alles in eine neue Unit / von Claude erkennen lassen', kind: 'function',
    check(env) {
      const hasSelect = env.hasControl('#import-unit-mode') && env.hasControl('[value="single"]') && env.hasControl('[value="claude"]') && env.hasControl('[value="auto"]');
      const parsed = env.vocab.parseText('Unit 1: A\nalpha - eins\nbeta - zwei\nUnit 2: B\ngamma - drei').units;
      const flat = env.vocab.flattenUnits(parsed, 'Unit 9');
      const ok2 = parsed.length === 2 && flat.length === 1 && flat[0].name === 'Unit 9' && flat[0].words.length === 3;
      return ok(hasSelect && ok2, hasSelect ? 'flattening into one unit failed' : 'unit mode select missing');
    } });
  add({ id: 'S02.claude_detects_units', section: 2, title: 'Fehlen Unit-Titel, erkennt Claude die Units aus dem Inhalt der Liste', kind: 'function',
    check(env) {
      const words = [{ word: 'cast', translation: 'Besetzung' }, { word: 'plot', translation: 'Handlung' }, { word: 'backpack', translation: 'Rucksack' }, { word: 'delay', translation: 'Verspätung' }];
      const prompt = env.prompts.buildUnitDetectPrompt(words, 'Unit 8');
      const asksGroups = /"from"/.test(prompt) && /"to"/.test(prompt) && /"name"/.test(prompt) && /"topic"/.test(prompt)
        && /without gaps or overlaps/.test(prompt) && words.every(w => prompt.includes(w.word)) && /JSON object/.test(prompt);
      // The returned groups regroup the list without losing or reordering a word.
      const single = [{ name: 'Unit 1', topic: '', words }];
      const grouped = env.vocab.applyGroups(single, [{ name: 'Unit 8', topic: 'Films', from: 1, to: 2 }, { name: 'Unit 9', topic: 'Travel', from: 3, to: 4 }]);
      const flat = grouped.units.flatMap(u => u.words.map(w => w.word));
      const ok2 = grouped.units.length === 2 && grouped.units[0].topic === 'Films' && grouped.units[1].name === 'Unit 9'
        && JSON.stringify(flat) === JSON.stringify(words.map(w => w.word));
      return ok(asksGroups && ok2 && env.hasControl('#btn-detect-units'), asksGroups ? (ok2 ? 'button missing' : 'regrouping lost entries') : 'detection prompt incomplete');
    } });
  add({ id: 'S02.claude_no_word_lost', section: 2, title: 'Unit-Erkennung verliert keine Vokabel (Lücken und Überlappungen werden geschlossen)', kind: 'function',
    check(env) {
      const words = Array.from({ length: 12 }, (_, i) => ({ word: 'w' + (i + 1), translation: '' }));
      const src = [{ name: 'Unit 1', topic: '', words }];
      const cases = [
        [{ name: 'A', from: 1, to: 3 }, { name: 'B', from: 7, to: 9 }],            // gap in the middle and at the end
        [{ name: 'A', from: 1, to: 8 }, { name: 'B', from: 4, to: 12 }],           // overlap
        [{ name: 'A', from: 5, to: 12 }],                                          // starts late
        [],                                                                        // nothing recognised
      ];
      for (const groups of cases) {
        const r = env.vocab.applyGroups(src, groups);
        const flat = r.units.flatMap(u => u.words.map(w => w.word));
        if (JSON.stringify(flat) !== JSON.stringify(words.map(w => w.word))) return 'words lost or reordered for ' + JSON.stringify(groups);
      }
      return true;
    } });
  add({ id: 'S02.claude_derives_topics', section: 2, title: 'Themen der Units werden von Claude aus dem Wortschatz abgeleitet', kind: 'function',
    check(env) {
      const units = [{ name: 'Unit 3', topic: '', words: [{ word: 'box office' }, { word: 'sequel' }] }];
      const prompt = env.prompts.buildUnitTopicPrompt(units);
      return ok(/Unit 3/.test(prompt) && /box office/.test(prompt) && /2–5 words/.test(prompt) && /JSON array/.test(prompt) && /"topic"/.test(prompt), 'topic prompt incomplete');
    } });
  add({ id: 'S02.frozen_store_edit', section: 2, title: 'Gespeicherte (schreibgeschützte) Lehrmittel lassen sich bearbeiten: Themen, Umbenennen, Löschen ändern Kopien statt Originale', kind: 'function',
    check(env) {
      const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
      const units = deepFreeze([{ id: 'u1', name: 'Unit 1', topic: '', words: [{ word: 'cast' }] }, { id: 'u2', name: 'Unit 2', topic: 'Kept', words: [{ word: 'delay' }] }]);
      let withTopics, patched;
      try {
        withTopics = env.vocab.withTopics(units, [{ unit: 'Unit 1', topic: 'Films' }, { unit: 'Unit 2', topic: 'Ignored' }], true);
        patched = env.vocab.withUnitPatch(units, 'u1', { topic: 'Typed' });
      } catch (e) { return 'editing a frozen unit threw: ' + e.message; }
      const src = env.uiSource || '';
      const mutates = /\.topic\s*=\s*[^=]/.test(src) || /\bu\.name\s*=\s*[^=]/.test(src);
      return ok(withTopics[0].topic === 'Films' && withTopics[1].topic === 'Kept' && units[0].topic === '' && patched[0].topic === 'Typed' && !mutates,
        mutates ? 'the interface still assigns to a stored unit directly' : 'immutable update did not produce the expected result');
    } });
  add({ id: 'S02.dialogs_in_page', section: 2, title: 'Anlegen, Umbenennen und Löschen laufen über seiteneigene Dialoge (im Artifact-Frame sind window.prompt/confirm nicht verlässlich)', kind: 'function',
    check(env) {
      const hasDialog = env.hasControl('#dlg') && env.hasControl('#dlg-ok') && env.hasControl('#dlg-cancel');
      const src = env.uiSource || '';
      const usesOwn = /askText/.test(src) && /askConfirm/.test(src);
      const native = /(^|[^\w.$])(window\.)?(prompt|confirm|alert)\s*\(/m.test(src);
      return ok(hasDialog && usesOwn && !native, !hasDialog ? 'dialog element missing' : native ? 'a native prompt/confirm/alert is still used' : 'own dialog helpers missing');
    } });
  add({ id: 'S02.unit_listing', section: 2, title: 'Lehrmittel zeigt Units (Unit 1, Unit 2, …)', kind: 'ui', selector: '#textbook-list' });

  /* §3 Grundaufbau */
  for (const s of [[1, 'source', 'Source & Unit'], [2, 'content', 'Content'], [3, 'level', 'Language Level'], [4, 'structure', 'Text / Audio Structure'], [5, 'vocab', 'Vocabulary'], [6, 'worksheet', 'Worksheet & Questions'], [7, 'advanced', 'Advanced Settings'], [8, 'generate', 'Generate']]) {
    add({ id: `S03.section_${s[0]}`, section: 3, title: `Creator-Bereich ${s[0]}: ${s[2]}`, kind: 'ui', selector: `#sec-${s[1]}[data-step="${s[0]}"]` });
  }
  add({ id: 'S03.collapsible', section: 3, title: 'Bereiche einzeln auf-/zuklappbar', kind: 'ui', selector: '[data-toggle-step="4"]' });

  /* §4 Source & Unit */
  add({ id: 'S04.textbook', section: 4, title: 'Dropdown Lehrmittel', kind: 'setting', key: 'textbookId', altCtx: 'textbook2' });
  add({ id: 'S04.unit', section: 4, title: 'Dropdown Unit', kind: 'setting', key: 'unitId', altCtx: 'unit2' });
  add({ id: 'S04.use_unit_topic', section: 4, title: 'Use unit topic ON/OFF', kind: 'setting', key: 'useUnitTopic', alt: false, given: { topicMode: 'custom', customTopic: 'A trip' } });

  /* §5 Content */
  add({ id: 'S05.topic_mode', section: 5, title: 'Topic: Use Unit Topic / Custom Topic', kind: 'setting', key: 'topicMode', alt: 'custom', given: { customTopic: 'Teenagers discussing social media' } });
  add({ id: 'S05.custom_topic', section: 5, title: 'Freies Eingabefeld Custom Topic', kind: 'setting', key: 'customTopic', alt: 'Whether social media makes friendships better or worse', given: { topicMode: 'custom' } });
  add({ id: 'S05.generate_topic', section: 5, title: 'Generate topic for me: Szenario-Vorschläge auf Basis der Unit (via Claude)', kind: 'function',
    check(env) {
      const p = env.prompts.buildTopicPrompt(env.state(), env.core.buildPlan(env.state(), env.ctx));
      return ok(/5 concrete/.test(p) && p.includes(env.ctx.unit.name) && p.includes('JSON array') && env.hasControl('#btn-suggest-topics'), 'topic prompt or button missing');
    } });

  /* §6 Language Level */
  add({ id: 'S06.cefr', section: 6, title: 'CEFR-Auswahl A2.1–B2.2', kind: 'setting', key: 'cefr', alt: 'B2.2',
    extra(env) { return ok(deepEq(env.core.CEFR_BANDS, ['A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2'])); } });
  add({ id: 'S06.complexity', section: 6, title: 'Regler Language Complexity (Satzlänge, Grammatik, Idiomatik, Synonyme, Gesprächssprache, Explizitheit)', kind: 'setting', key: 'languageComplexity', alt: 95,
    extra(env) { const p = env.prompts.buildContentPrompt(env.state(), env.core.buildPlan(env.state(), env.ctx)); return ok(/sentence length/.test(p) && /grammatical complexity/.test(p) && /idiomatic/.test(p) && /synonyms/.test(p) && /conversational/.test(p) && /explicitly/.test(p)); } });
  add({ id: 'S06.independence', section: 6, title: 'Language difficulty und Question difficulty unabhängig', kind: 'function',
    check(env) {
      const ps = env.prompts.buildAllPrompts(env.state({ cefr: 'B1.2', questionDifficulty: 20 }), env.ctx);
      const ps2 = env.prompts.buildAllPrompts(env.state({ cefr: 'B1.2', questionDifficulty: 90 }), env.ctx);
      return ok(ps.content === ps2.content && ps.questions !== ps2.questions, 'question difficulty leaked into the content prompt or did not change the question prompt');
    } });

  /* §7 Vocabulary */
  add({ id: 'S07.usage', section: 7, title: 'Regler Vocabulary Usage Low–High', kind: 'setting', key: 'vocabUsage', alt: 95 });
  add({ id: 'S07.target_count_min', section: 7, title: 'Target vocabulary count (min)', kind: 'setting', key: 'targetVocabMin', alt: 3 });
  add({ id: 'S07.target_count_max', section: 7, title: 'Target vocabulary count (max)', kind: 'setting', key: 'targetVocabMax', alt: 20 });
  add({ id: 'S07.manual_mode', section: 7, title: 'Select vocabulary manually', kind: 'setting', key: 'vocabSelectionMode', alt: 'manual', given: { selectedVocab: ['__W0__'] } });
  add({ id: 'S07.manual_list', section: 7, title: 'Alle Vocabulary-Einträge der Unit auswählbar', kind: 'setting', key: 'selectedVocab', alt: ['__W1__'], given: { vocabSelectionMode: 'manual', selectedVocab: ['__W0__'] } });
  add({ id: 'S07.natural', section: 7, title: 'Vocabulary natürlich integrieren, nicht erzwingen', kind: 'function',
    check(env) { const p = env.prompts.buildContentPrompt(env.state(), env.core.buildPlan(env.state(), env.ctx)); return ok(/Never force a word/.test(p) && /naturally/.test(p)); } });
  add({ id: 'S07.highlight', section: 7, title: 'Highlight used target vocabulary in teacher version', kind: 'setting', key: 'highlightVocab', alt: false, promptSensitive: false,
    extra(env) {
      const on = env.render.renderTeacherHTML(env.fixture.material({ highlightVocab: true }));
      const off = env.render.renderTeacherHTML(env.fixture.material({ highlightVocab: false }));
      return ok(/<mark class="vocab">/.test(on) && !/<mark class="vocab">/.test(off), 'highlight toggle has no effect on the teacher version');
    } });

  /* §8 Listening – Audio Structure */
  add({ id: 'S08.format', section: 8, title: 'Format Monologue / Dialogue – 2 speakers / Conversation – X speakers', kind: 'setting', key: 'format', alt: 'monologue', mode: 'listening',
    extra(env) { return ok(env.core.effectiveSpeakerCount(env.state({ format: 'monologue' })) === 1 && env.core.effectiveSpeakerCount(env.state({ format: 'dialogue' })) === 2 && env.core.effectiveSpeakerCount(env.state({ format: 'conversation', speakerCount: 5 })) === 5); } });
  add({ id: 'S08.speaker_count', section: 8, title: 'Conversation: 3 / 4 / 5 / 6 speakers', kind: 'setting', key: 'speakerCount', alt: 6, given: { format: 'conversation' }, mode: 'listening',
    extra(env) { return ok(deepEq(env.core.SCHEMA_BY_KEY.speakerCount.options, [3, 4, 5, 6])); } });
  add({ id: 'S08.listening_only', section: 8, title: 'Bereich erscheint nur bei einem Listening', kind: 'function',
    check(env) { return ok(env.core.SCHEMA.filter(s => ['format', 'preset', 'speakerBalance', 'turnLength', 'audioLength', 'emotionTags', 'naturalness'].includes(s.key)).every(s => s.mode === 'listening')); } });

  /* §9 Presets */
  const PRESET_EXPECT = { natural: null, interview: [25, 75], podcast: [30, 70], discussion: null, debate: null, expert: [75, 25], presentation: [92, 8], storytelling: [100], news: [35, 65], casual: null, phone: null };
  for (const key of Object.keys(PRESET_EXPECT)) {
    add({ id: `S09.preset_${key}`, section: 9, title: `Preset „${key}“ verändert Gesprächsstruktur und Sprechanteile`, kind: 'function',
      check(env) {
        const s = env.core.applyPreset(env.state({ preset: 'none', speakerBalance: 'balanced', format: 'dialogue' }), key);
        const plan = env.core.buildPlan(s, env.ctx);
        const p = env.prompts.buildContentPrompt(s, plan);
        const pre = env.core.presetByKey(key);
        const exp = PRESET_EXPECT[key];
        if (exp && !deepEq(plan.shares, exp)) return `shares ${JSON.stringify(plan.shares)} ≠ ${JSON.stringify(exp)}`;
        return ok(pre.structure && p.includes(pre.structure) && s.preset === key, 'preset structure not in prompt');
      } });
  }
  add({ id: 'S09.preset_setting', section: 9, title: 'Preset-Auswahl im Creator', kind: 'setting', key: 'preset', alt: 'interview', mode: 'listening' });

  /* §10 Speaker Distribution */
  add({ id: 'S10.balance', section: 10, title: 'Speaker Balance: Balanced / Natural Variation / Main Speaker / Custom', kind: 'setting', key: 'speakerBalance', alt: 'main', mode: 'listening',
    extra(env) {
      const c = env.core;
      const st = (b, n) => c.effectiveShares(env.state({ format: 'conversation', speakerCount: n, speakerBalance: b, preset: 'none' }));
      const bal = st('balanced', 4), nat = st('natural', 3), main = st('main', 3);
      const sum = a => a.reduce((x, y) => x + y, 0);
      return ok(deepEq(bal, [25, 25, 25, 25]) && sum(nat) === 100 && Math.max(...nat) < 50 && Math.max(...nat) > Math.min(...nat) && main[0] > 50 && sum(main) === 100, `bal ${bal} nat ${nat} main ${main}`);
    } });
  add({ id: 'S10.custom', section: 10, title: 'Custom: manuelle Anteile, Summe 100 %', kind: 'setting', key: 'customShares', alt: [20, 80], given: { speakerBalance: 'custom' }, mode: 'listening',
    extra(env) {
      const s = env.state({ format: 'conversation', speakerCount: 3, speakerBalance: 'custom', customShares: [20, 65, 15], preset: 'none' });
      const bad = env.state({ format: 'conversation', speakerCount: 3, speakerBalance: 'custom', customShares: [20, 65, 25], preset: 'none' });
      return ok(deepEq(env.core.effectiveShares(s), [20, 65, 15]) && env.core.validateState(bad, env.ctx).some(e => e.key === 'customShares'), 'custom shares / validation');
    } });

  /* §11 Turn Length */
  add({ id: 'S11.turn_length', section: 11, title: 'Speaking Turn Length Short–Long', kind: 'setting', key: 'turnLength', alt: 95, mode: 'listening' });
  add({ id: 'S11.turn_presets', section: 11, title: 'Presets Quick exchange / Natural / Extended', kind: 'function',
    check(env) {
      const q = env.core.applyTurnPreset(env.state(), 'quick'), n = env.core.applyTurnPreset(env.state(), 'natural'), e = env.core.applyTurnPreset(env.state(), 'extended');
      return ok(q.turnLength < n.turnLength && n.turnLength < e.turnLength && env.hasControl('[data-turn-preset="quick"]'), 'turn presets');
    } });
  add({ id: 'S11.variability', section: 11, title: 'Turn Length Variability Low–High, Default hoch für Dialoge', kind: 'setting', key: 'turnVariability', alt: 5, mode: 'listening',
    extra(env) { return ok(env.core.defaults('listening').turnVariability >= 60, 'default variability too low'); } });

  /* §12 Audio Length */
  add({ id: 'S12.length', section: 12, title: 'Audio Length 1:00 … 5:00 / Custom', kind: 'setting', key: 'audioLength', alt: '300', mode: 'listening',
    extra(env) { return ok(deepEq(env.core.AUDIO_LENGTHS.map(a => a.label), ['1:00', '1:30', '2:00', '2:30', '3:00', '4:00', '5:00', 'Custom'])); } });
  add({ id: 'S12.custom_length', section: 12, title: 'Custom-Länge in Sekunden', kind: 'setting', key: 'audioLengthCustom', alt: 400, given: { audioLength: 'custom' }, mode: 'listening' });
  add({ id: 'S12.word_estimate', section: 12, title: 'Automatische Wortzahl aus Zeit und Sprechtempo', kind: 'function',
    check(env) {
      const c = env.core;
      const w2 = c.targetWordCount(env.state({ audioLength: '120', speakingSpeed: 50 }));
      const w4 = c.targetWordCount(env.state({ audioLength: '240', speakingSpeed: 50 }));
      const fast = c.targetWordCount(env.state({ audioLength: '120', speakingSpeed: 100 }));
      return ok(w2 === 280 && w4 === 560 && fast > w2, `words ${w2}/${w4}/${fast}`);
    } });
  add({ id: 'S12.speed', section: 12, title: 'Speaking Speed Slow–Natural–Fast', kind: 'setting', key: 'speakingSpeed', alt: 100, mode: 'listening' });

  /* §13 Speaker Profiles */
  add({ id: 'S13.profiles', section: 13, title: 'Speaker Profiles: Name, Age, Role, Personality beeinflussen das Gespräch', kind: 'setting', key: 'speakerProfiles', alt: [{ name: 'Maya', age: '16', role: 'Student', personality: 'confident, humorous' }, { name: 'Leo', age: '17', role: 'Student', personality: 'slightly nervous, thoughtful' }], mode: 'listening',
    extra(env) {
      const s = env.state({ speakerProfiles: [{ name: 'Maya', age: '16', role: 'Student', personality: 'confident, humorous' }, { name: 'Leo', age: '17', role: 'Student', personality: 'thoughtful' }] });
      const p = env.prompts.buildContentPrompt(s, env.core.buildPlan(s, env.ctx));
      return ok(deepEq(env.core.speakerLabels(s), ['Maya', 'Leo']) && /age 16/.test(p) && /personality: confident, humorous/.test(p) && /need not be stated/.test(p));
    } });

  /* §14 Emotion tags */
  add({ id: 'S14.tags', section: 14, title: 'Emotion & Delivery Tags im Skript ([excited] … [serious])', kind: 'function',
    check(env) {
      const want = ['excited', 'nervous', 'laughing', 'sarcastic', 'hesitant', 'surprised', 'annoyed', 'quietly', 'confused', 'relieved', 'thoughtful', 'serious'];
      const html = env.render.renderTeacherHTML(env.fixture.material());
      return ok(deepEq(env.core.EMOTION_TAGS, want) && /\[hesitant\]/.test(html), 'tag list or rendering');
    } });
  add({ id: 'S14.level', section: 14, title: 'Use emotion tags OFF / Low / Medium / High', kind: 'setting', key: 'emotionTags', alt: 'off', mode: 'listening',
    extra(env) { const c = env.core; return ok(c.emotionTagTarget('off') === 0 && c.emotionTagTarget('low') < c.emotionTagTarget('medium') && c.emotionTagTarget('medium') < c.emotionTagTarget('high')); } });
  add({ id: 'S14.functional', section: 14, title: 'Tags gezielt/funktional, nicht vor jedem Beitrag', kind: 'rule', ruleId: 'listening.emotion_tags',
    extra(env) {
      const st = env.state({ emotionTags: 'medium' });
      const plan = env.core.buildPlan(st, env.ctx);
      const all = { lines: [{ speaker: 'Speaker A', emotion: 'excited', text: 'a b c' }, { speaker: 'Speaker B', emotion: 'nervous', text: 'd e f' }] };
      const f = env.quality.runContentChecks(st, plan, all).find(x => x.id === 'listening.emotion_tags');
      return ok(f && f.status === 'fail', 'all-tagged script should fail');
    } });

  /* §15 Natural speech */
  add({ id: 'S15.naturalness', section: 15, title: 'Naturalness Clean/Educational–Authentic (contractions, fillers, hesitation, reactions, unfinished thoughts, reformulations, interruptions, discourse markers)', kind: 'setting', key: 'naturalness', alt: 100, mode: 'listening',
    extra(env) { const s = env.state({ naturalness: 100 }); const p = env.prompts.buildContentPrompt(s, env.core.buildPlan(s, env.ctx)); return ok(/contractions/.test(p) && /fillers/.test(p) && /hesitation/.test(p) && /interruptions/.test(p) && /discourse markers/.test(p) && /CEFR level/.test(p)); } });

  /* §16 Explicitness */
  add({ id: 'S16.explicitness', section: 16, title: 'Information Explicitness Very Explicit–Highly Implicit', kind: 'setting', key: 'explicitness', alt: 100,
    extra(env) { const s = env.state(); const p = env.prompts.buildContentPrompt(s, env.core.buildPlan(s, env.ctx)); return ok(/because I was sick/.test(p) && /fever/.test(p), 'explicitness examples missing'); } });

  /* §17 Reading */
  add({ id: 'S17.text_type', section: 17, title: 'Text Type (Story … Dialogue, Custom)', kind: 'setting', key: 'textType', alt: 'Diary Entry', mode: 'reading',
    extra(env) { return ok(deepEq(env.core.TEXT_TYPES, ['Story', 'Article', 'Blog Post', 'Interview', 'Email', 'Forum Discussion', 'Review', 'News Article', 'Report', 'Diary Entry', 'Informational Text', 'Opinion Text', 'Dialogue', 'Custom'])); } });
  add({ id: 'S17.custom_type', section: 17, title: 'Custom text type', kind: 'setting', key: 'customTextType', alt: 'Podcast show notes', given: { textType: 'Custom' }, mode: 'reading' });
  add({ id: 'S17.length_mode', section: 17, title: 'Length: word count oder approximate A4 length', kind: 'setting', key: 'lengthMode', alt: 'a4', mode: 'reading' });
  add({ id: 'S17.word_count', section: 17, title: 'Word count (z. B. 450 words)', kind: 'setting', key: 'wordCount', alt: 900, mode: 'reading',
    extra(env) { return ok(env.core.targetWordCount(env.state({ kind: 'reading', lengthMode: 'words', wordCount: 450 })) === 450); } });
  add({ id: 'S17.a4', section: 17, title: 'A4-Länge wird in Wortzahl umgerechnet', kind: 'setting', key: 'a4Pages', alt: '2', given: { lengthMode: 'a4' }, mode: 'reading',
    extra(env) { return ok(env.core.targetWordCount(env.state({ kind: 'reading', lengthMode: 'a4', a4Pages: '2' })) === 900); } });

  /* §18 Worksheet */
  add({ id: 'S18.toggle', section: 18, title: 'Create Worksheet ON/OFF; OFF → nur Skript/Text', kind: 'setting', key: 'createWorksheet', alt: false,
    extra(env) {
      const off = env.prompts.buildAllPrompts(env.state({ createWorksheet: false }), env.ctx);
      const plan = env.core.buildPlan(env.state({ createWorksheet: false }), env.ctx);
      return ok(off.questions === '' && plan.questionCount === 0, 'worksheet OFF still plans questions');
    } });

  /* §19 Number of questions */
  add({ id: 'S19.count', section: 19, title: 'Number of Questions 5 / 8 / 10 / 12 / 15 / Custom', kind: 'setting', key: 'questionCount', alt: '15',
    extra(env) { return ok(deepEq(env.core.QUESTION_COUNTS, ['5', '8', '10', '12', '15', 'custom'])); } });
  add({ id: 'S19.custom', section: 19, title: 'Custom number of questions', kind: 'setting', key: 'questionCountCustom', alt: 21, given: { questionCount: 'custom' } });

  /* §20 Skills */
  const SKILL_LIST = ['gist', 'specific', 'detail', 'connecting', 'inference', 'attitude', 'purpose', 'context'];
  for (const sk of SKILL_LIST) {
    add({ id: `S20.skill_${sk}`, section: 20, title: `Listening/Reading Skill „${sk}“ definiert und je Frage zugeordnet`, kind: 'function',
      check(env) {
        const s = env.state({ skillMixMode: 'custom', customSkillMix: Object.fromEntries(SKILL_LIST.map(k => [k, k === sk ? 5 : 0])), questionCount: '5' });
        const plan = env.core.buildPlan(s, env.ctx);
        const p = env.prompts.buildQuestionPrompt(s, plan, env.fixture.content());
        return ok(env.core.SKILL_KEYS.includes(sk) && env.prompts.SKILL_DEFINITIONS[sk] && plan.skillSequence.every(x => x === sk) && p.includes(env.prompts.SKILL_DEFINITIONS[sk]), 'skill not planned/described');
      } });
  }

  /* §21 Higher-order */
  add({ id: 'S21.toggle', section: 21, title: 'Higher-Order Questions OFF/ON', kind: 'setting', key: 'higherOrder', alt: true });
  add({ id: 'S21.count', section: 21, title: 'Anzahl Higher-Order-Aufgaben', kind: 'setting', key: 'higherOrderCount', alt: 4, given: { higherOrder: true } });
  add({ id: 'S21.types', section: 21, title: 'Typen Interpretation / Transfer / Evaluation', kind: 'setting', key: 'higherOrderTypes', alt: ['evaluation'], given: { higherOrder: true },
    extra(env) { return ok(deepEq(env.core.HIGHER_ORDER_TYPES.map(t => t.key), ['interpretation', 'transfer', 'evaluation'])); } });
  add({ id: 'S21.separate', section: 21, title: 'Nicht mit Comprehension-Fragen vermischt (separate Sektion + Prüfung)', kind: 'rule', ruleId: 'questions.higher_order_separate',
    extra(env) { const html = env.render.renderStudentHTML(env.fixture.material({ higherOrder: true })); return ok(/class="block higher-order"/.test(html), 'no separate higher-order block'); } });

  /* §22 Question difficulty */
  add({ id: 'S22.slider', section: 22, title: 'Question Difficulty Easy–Challenging', kind: 'setting', key: 'questionDifficulty', alt: 95 });
  add({ id: 'S22.factors', section: 22, title: 'Schwierigkeit über Explizitheit, Abstand, Synonyme, Verknüpfung, Distraktoren, Inference-Anteil, Fragesprache', kind: 'function',
    check(env) { const s = env.state(); const p = env.prompts.buildQuestionPrompt(s, env.core.buildPlan(s, env.ctx), env.fixture.content()); return ok(/explicitly/.test(p) && /distance/.test(p) && /synonyms/.test(p) && /combined/.test(p) && /distractors/.test(p) && /inference/.test(p) && /linguistic complexity/.test(p) && /not come from the question type alone/.test(p)); } });

  /* §23 Automatic skill mix */
  add({ id: 'S23.auto_mix', section: 23, title: 'Balanced Question Mix: automatische Verteilung (Summe = Anzahl, Gist enthalten)', kind: 'function',
    check(env) {
      const mix = env.core.autoSkillMix(10, 50);
      const sum = Object.values(mix).reduce((a, b) => a + b, 0);
      return ok(sum === 10 && mix.gist >= 1 && mix.specific >= 2 && mix.detail >= 1, JSON.stringify(mix));
    } });
  add({ id: 'S23.shift', section: 23, title: 'Bei steigender Schwierigkeit verschiebt sich die Gewichtung zu Connecting/Inference/Attitude/Purpose', kind: 'function',
    check(env) {
      const e = env.core.autoSkillMix(12, 5), h = env.core.autoSkillMix(12, 95);
      const hi = m => m.connecting + m.inference + m.attitude + m.purpose;
      return ok(e.specific > h.specific && hi(h) > hi(e), `easy ${JSON.stringify(e)} hard ${JSON.stringify(h)}`);
    } });
  add({ id: 'S23.mode', section: 23, title: 'Skill mix automatic/custom umschaltbar', kind: 'setting', key: 'skillMixMode', alt: 'custom', given: { questionCount: '10', customSkillMix: { gist: 1, specific: 2, detail: 2, connecting: 2, inference: 2, attitude: 1, purpose: 0, context: 0 } } });

  /* §24 Manual skill mix */
  add({ id: 'S24.custom_mix', section: 24, title: 'Custom Question Mix mit Zahlen je Skill', kind: 'setting', key: 'customSkillMix', alt: { gist: 2, specific: 2, detail: 2, connecting: 1, inference: 1, attitude: 1, purpose: 1, context: 0 }, given: { skillMixMode: 'custom', questionCount: '10' },
    extra(env) {
      const s = env.state({ skillMixMode: 'custom', questionCount: '10', customSkillMix: { gist: 1, specific: 2, detail: 2, connecting: 2, inference: 2, attitude: 1, purpose: 0, context: 0 } });
      const bad = env.state({ skillMixMode: 'custom', questionCount: '10', customSkillMix: { gist: 1, specific: 2, detail: 2, connecting: 2, inference: 2, attitude: 1, purpose: 1, context: 0 } });
      return ok(deepEq(env.core.buildPlan(s, env.ctx).skillMix, s.customSkillMix) && env.core.validateState(bad, env.ctx).some(e => e.key === 'customSkillMix'), 'manual mix / validation');
    } });

  /* §25 Question formats */
  add({ id: 'S25.formats', section: 25, title: '14 Frageformate, mehrere gleichzeitig aktivierbar', kind: 'setting', key: 'questionFormats', alt: ['matching', 'ordering', 'table_completion'],
    extra(env) { return ok(env.core.QUESTION_FORMATS.length === 14 && env.core.FORMAT_KEYS.includes('who_said_it') && env.core.FORMAT_KEYS.includes('note_taking') && Object.keys(env.prompts.FORMAT_SHAPES).length === 14); } });
  add({ id: 'S25.auto_mix', section: 25, title: 'Automatic balanced mix sorgt für Variation', kind: 'setting', key: 'autoFormatMix', alt: false,
    extra(env) {
      const seq = env.core.assignFormats(['gist', 'specific', 'detail', 'inference', 'specific', 'detail'], ['multiple_choice', 'short_answer', 'best_summary']);
      const counts = {};
      for (const f of seq) counts[f] = (counts[f] || 0) + 1;
      return ok(seq[0] === 'best_summary' && Math.abs(counts.multiple_choice - counts.short_answer) <= 1, JSON.stringify(seq));
    } });

  /* §26 Question order */
  add({ id: 'S26.chronology', section: 26, title: 'Fragen folgen immer der Reihenfolge des Materials (Listening und Reading, Gist-Ausnahme) – kein Schalter, immer Pflicht', kind: 'function',
    check(env) {
      const s = env.state();
      const p = env.prompts.buildQuestionPrompt(s, env.core.buildPlan(s, env.ctx), env.fixture.content());
      const r = env.state({ kind: 'reading' });
      const pr = env.prompts.buildQuestionPrompt(r, env.core.buildPlan(r, env.ctx), env.fixture.content('reading'));
      const m = env.fixture.material();
      const rep = env.prompts.buildQuestionRepairPrompt(m.settings, m.plan, m.content, m.worksheet, [], [2], '');
      const rule = env.quality.RULES.find(x => x.id === 'questions.chronology');
      return ok(!env.core.SCHEMA_BY_KEY.followChronology && /MUST appear in the order/.test(p) && /timeline/.test(p) && /Gist/.test(p) && /in the audio/.test(p) && /in the text/.test(pr)
        && /timeline/.test(rep) && rule && rule.blocking === true, 'chronology must be demanded in every question prompt and be a blocking rule');
    } });
  add({ id: 'S26.enforce', section: 26, title: 'Eingehende Fragebögen werden deterministisch in die Reihenfolge des Materials gebracht und neu nummeriert (jede Runde)', kind: 'function',
    check(env) {
      const m = env.fixture.material();
      const ws = JSON.parse(JSON.stringify(m.worksheet));
      const shuffled = [ws.questions[0], ws.questions[3], ws.questions[2], ws.questions[1]].map((q, i) => Object.assign({}, q, { n: i + 1 }));
      const r = env.quality.enforceChronology(Object.assign({}, ws, { questions: shuffled }), m.content, 'listening');
      const order = r.worksheet.questions.map(q => q.skill).join(',');
      const same = env.quality.enforceChronology(m.worksheet, m.content, 'listening');
      const src = env.pipelineSource || '';
      const wired = env.pipelineSource ? /enforceChronology/.test(src) && /target: 'order'/.test(src) : true;
      return ok(r.changed && order === 'gist,specific,detail,inference' && r.worksheet.questions.every((q, i) => q.n === i + 1) && same.changed === false && wired, `order=${order} changed=${r.changed} wired=${wired}`);
    } });
  add({ id: 'S26.check', section: 26, title: 'Reihenfolge wird anhand der Evidenzstellen geprüft', kind: 'rule', ruleId: 'questions.chronology',
    extra(env) {
      const m = env.fixture.material();
      const ws = JSON.parse(JSON.stringify(m.worksheet));
      ws.questions.reverse().forEach((q, i) => { q.n = i + 1; });
      const plan = env.core.buildPlan(m.settings, env.ctx);
      const f = env.quality.runDeterministic(m.settings, plan, m.content, ws).find(x => x.id === 'questions.chronology');
      const good = env.quality.runDeterministic(m.settings, plan, m.content, m.worksheet).find(x => x.id === 'questions.chronology');
      const lost = JSON.parse(JSON.stringify(m.worksheet));
      lost.questions[2].evidenceQuote = 'this sentence is not in the material at all';
      const fl = env.quality.runDeterministic(m.settings, plan, m.content, lost).find(x => x.id === 'questions.chronology');
      return ok(f && f.status === 'fail' && good && good.status === 'pass' && fl && fl.status === 'fail' && fl.questions.includes(3), `reversed=${f && f.status} normal=${good && good.status} unresolved=${fl && fl.status}`);
    } });

  /* §27 Pre-task */
  add({ id: 'S27.toggle', section: 27, title: 'Create Pre-Task', kind: 'setting', key: 'preTask', alt: true });
  add({ id: 'S27.types', section: 27, title: 'Formen Prediction / Vocabulary Activation / Speaking Prompt', kind: 'setting', key: 'preTaskTypes', alt: ['speaking'], given: { preTask: true },
    extra(env) { return ok(deepEq(env.core.PRE_TASK_TYPES.map(t => t.key), ['prediction', 'vocabulary', 'speaking'])); } });
  add({ id: 'S27.no_spoilers', section: 27, title: 'Pre-Task nimmt keine Antworten vorweg', kind: 'rule', ruleId: 'pretask.no_spoilers',
    extra(env) { const s = env.state({ preTask: true }); const p = env.prompts.buildQuestionPrompt(s, env.core.buildPlan(s, env.ctx), env.fixture.content()); return ok(/must NOT give away/.test(p)); } });

  /* §28 Output */
  add({ id: 'S28.student_title', section: 28, title: 'Student Version: Titel', kind: 'render', check(env) { const m = env.fixture.material(); return ok(env.render.renderStudentHTML(m).includes(env.render.esc(m.worksheet.title))); } });
  add({ id: 'S28.student_instruction', section: 28, title: 'Student Version: kurze Instruktion', kind: 'render', check(env) { const m = env.fixture.material(); return ok(env.render.renderStudentHTML(m).includes(env.render.esc(m.worksheet.instructions))); } });
  add({ id: 'S28.student_pretask', section: 28, title: 'Student Version: Pre-Task, falls gewählt', kind: 'render', check(env) { const m = env.fixture.material({ preTask: true }); return ok(env.render.renderStudentHTML(m).includes(env.render.esc(m.worksheet.preTasks[0].prompt))); } });
  add({ id: 'S28.student_questions', section: 28, title: 'Student Version: Fragen/Aufgaben', kind: 'render', check(env) { const m = env.fixture.material(); return ok(m.worksheet.questions.every(q => env.render.renderStudentHTML(m).includes(env.render.esc(q.prompt)))); } });
  add({ id: 'S28.student_reading_text', section: 28, title: 'Student Version: Reading-Text enthalten', kind: 'render', check(env) { const m = env.fixture.material({}, 'reading'); return ok(env.render.renderStudentHTML(m).includes(env.render.esc(m.content.paragraphs[0]))); } });
  add({ id: 'S28.student_no_script', section: 28, title: 'Student Version: beim Listening NICHT das Skript', kind: 'render', check(env) { const m = env.fixture.material(); const html = env.render.renderStudentHTML(m); return ok(!m.content.lines.some(l => html.includes(env.render.esc(l.text))), 'script leaked into student version'); } });
  add({ id: 'S28.student_no_answers', section: 28, title: 'Student Version: keine Lösungen', kind: 'render', check(env) { const m = env.fixture.material(); const html = env.render.renderStudentHTML(m); return ok(!html.includes(env.render.esc(m.worksheet.questions[0].evidenceQuote)) && !html.includes('Answer key')); } });
  add({ id: 'S28.teacher_script', section: 28, title: 'Teacher Version: vollständiges Skript/Text', kind: 'render', check(env) { const m = env.fixture.material(); const plain = env.render.renderTeacherHTML(m).replace(/<[^>]+>/g, ''); const r = env.fixture.material({}, 'reading'); const plainR = env.render.renderTeacherHTML(r).replace(/<[^>]+>/g, ''); return ok(m.content.lines.every(l => plain.includes(env.render.esc(l.text))) && r.content.paragraphs.every(p => plainR.includes(env.render.esc(p)))); } });
  add({ id: 'S28.teacher_vocab', section: 28, title: 'Teacher Version: verwendete Vocabulary Items', kind: 'render', check(env) { const m = env.fixture.material(); return ok(/Target vocabulary used/.test(env.render.renderTeacherHTML(m)) && env.render.renderTeacherHTML(m).includes('<strong>' + env.render.esc(m.vocabFound[0]) + '</strong>')); } });
  add({ id: 'S28.teacher_key', section: 28, title: 'Teacher Version: Lösungsschlüssel', kind: 'render', check(env) { const m = env.fixture.material(); const html = env.render.renderTeacherHTML(m); return ok(/Answer key/.test(html) && html.includes(env.render.esc(m.worksheet.questions[0].answer))); } });
  add({ id: 'S28.teacher_skill', section: 28, title: 'Teacher Version: Zuordnung jeder Frage zum Skill', kind: 'render', check(env) { const m = env.fixture.material(); const html = env.render.renderTeacherHTML(m); return ok(m.worksheet.questions.every(q => html.includes(env.core.SKILLS.find(s => s.key === q.skill).label))); } });
  add({ id: 'S28.teacher_difficulty', section: 28, title: 'Teacher Version: Difficulty je Frage', kind: 'render', check(env) { const m = env.fixture.material(); const html = env.render.renderTeacherHTML(m); return ok(html.includes('<td>' + env.render.esc(m.worksheet.questions[0].difficulty) + '</td>')); } });
  add({ id: 'S28.teacher_evidence', section: 28, title: 'Teacher Version: relevante Text-/Audio-Stelle', kind: 'render', check(env) { const m = env.fixture.material(); const html = env.render.renderTeacherHTML(m); return ok(html.includes(env.render.esc(m.worksheet.questions[0].evidenceQuote)) && html.includes(env.render.esc(m.worksheet.questions[0].evidenceRef))); } });
  add({ id: 'S28.teacher_rationale', section: 28, title: 'Teacher Version: Begründung für Inference-Fragen', kind: 'render', check(env) { const m = env.fixture.material(); const q = m.worksheet.questions.find(x => x.skill === 'inference'); return ok(q && q.rationale && env.render.renderTeacherHTML(m).includes(env.render.esc(q.rationale))); } });

  /* §29 Quality check rules */
  const RULE_REQS = [
    ['content.topic_unit', 'Content: Thema passt zur Unit'], ['content.vocab_used', 'Content: Zielvokabular sinnvoll verwendet'], ['content.coherent', 'Content: Text kohärent'], ['content.natural', 'Content: Gespräch wirkt natürlich'],
    ['listening.shares', 'Listening: Sprechanteile entsprechen den Einstellungen'], ['listening.distinguishable', 'Listening: Sprecher eindeutig unterscheidbar'], ['listening.emotion_tags', 'Listening: Emotion-Tags sinnvoll verteilt'], ['listening.no_artificial_switches', 'Listening: keine künstlichen Sprecherwechsel'],
    ['questions.answerable', 'Questions: jede Frage eindeutig beantwortbar'], ['questions.derivable', 'Questions: Antwort aus dem Material ableitbar'], ['questions.distractors', 'Questions: Distraktoren plausibel'], ['questions.chronology', 'Questions: Audio-/Textreihenfolge'],
    ['questions.no_duplicates', 'Questions: keine zwei Fragen prüfen dieselbe Information'], ['questions.skill_distribution', 'Questions: Skill-Verteilung entspricht Einstellungen'], ['questions.difficulty', 'Questions: Difficulty entspricht Stufe'], ['questions.inference_genuine', 'Questions: Inference-Fragen wirklich inferentiell'],
  ];
  for (const [rid, title] of RULE_REQS) add({ id: 'S29.' + rid, section: 29, title: 'Quality Check – ' + title, kind: 'rule', ruleId: rid });
  add({ id: 'S29.before_output', section: 29, title: 'Qualitätskontrolle läuft automatisch vor der Ausgabe (deterministisch + Claude-Review, Revision bei Fehlern)', kind: 'function',
    check(env) {
      const m = env.fixture.material();
      const plan = env.core.buildPlan(m.settings, env.ctx);
      const det = env.quality.runDeterministic(m.settings, plan, m.content, m.worksheet);
      const llm = env.quality.llmRules(m.settings, plan, m.worksheet);
      const merged = env.quality.mergeReview(llm, { results: llm.map(r => ({ rule: r.id, pass: r.id !== 'questions.answerable', note: 'x', questions: [2] })) });
      const blocking = env.quality.blockingFailures(merged);
      const rp = env.prompts.buildReviewPrompt(m.settings, plan, m.content, m.worksheet, llm, det);
      const src = env.pipelineSource || '';
      const pipelineOk = !src || (/runContentChecks/.test(src) && /runDeterministic/.test(src) && /buildReviewPrompt/.test(src) && /(buildQuestionRepairPrompt|RevisionPrompt)/.test(src));
      return ok(det.length >= 8 && llm.length >= 8 && blocking.length === 1 && blocking[0].id === 'questions.answerable' && llm.every(r => rp.includes('"' + r.id + '"')) && pipelineOk, 'quality pipeline incomplete');
    } });

  /* §29 (Erweiterung): Befunde werden behoben, nicht nur gemeldet */
  add({ id: 'S29.auto_repair', section: 29, title: 'Gefundene Probleme werden automatisch behoben (Aus / nur Fehler / Fehler und Warnungen)', kind: 'setting', key: 'autoFix', alt: 'off', promptSensitive: false,
    extra(env) {
      const findings = [
        { id: 'questions.duplicates_llm', group: 'questions', status: 'fail', title: 'dup', questions: [6, 7] },
        { id: 'questions.chronology', group: 'questions', status: 'warn', title: 'order', questions: [4] },
        { id: 'content.word_count', group: 'content', status: 'pass', title: 'len' },
      ];
      const off = env.quality.repairable(findings, 'off');
      const fail = env.quality.repairable(findings, 'fail');
      const all = env.quality.repairable(findings, 'all');
      const src = env.pipelineSource || '';
      const usesSetting = !src || /state\.autoFix/.test(src);
      return ok(off.length === 0 && fail.length === 1 && all.length === 2 && usesSetting,
        usesSetting ? `repairable(): ${off.length}/${fail.length}/${all.length}` : 'the pipeline ignores the autoFix setting');
    } });
  add({ id: 'S29.auto_repair_rounds', section: 29, title: 'Mehrere Korrekturrunden, bis die Prüfung sauber ist (max. einstellbar)', kind: 'setting', key: 'autoFixRounds', alt: 4, promptSensitive: false,
    extra(env) {
      const src = env.pipelineSource || '';
      if (!src) return true;
      const loops = /for \(let round = 1; round <= maxRounds; round\+\+\)/.test(src);
      const capped = /autoFixRounds/.test(src) && /Math\.min\(4/.test(src);
      return ok(loops && capped, loops ? 'the round limit is not read from the setting' : 'no repair loop in the pipeline');
    } });
  add({ id: 'S29.targeted_repair', section: 29, title: 'Beanstandete Fragen werden gezielt ersetzt, der Rest des Arbeitsblatts bleibt unverändert', kind: 'function',
    check(env) {
      const m = env.fixture.material({}, 'listening');
      const plan = env.core.buildPlan(m.settings, env.ctx);
      const findings = [{ id: 'questions.duplicates_llm', group: 'questions', status: 'fail', title: 'No two questions test exactly the same information', detail: 'Q3 and Q4 use the same evidence', questions: [3, 4] }];
      const rp = env.quality.repairPlan(findings, 'all');
      if (JSON.stringify(rp.questions) !== '[3,4]') return 'affected questions not derived: ' + JSON.stringify(rp.questions);
      if (rp.worksheet.length) return 'a per-question problem was treated as a full rewrite';
      const prompt = env.prompts.buildQuestionRepairPrompt(m.settings, plan, m.content, m.worksheet, findings, rp.questions, 'fix it');
      const asks = /Replace ONLY the questions/.test(prompt)
        && /Q3/.test(prompt) && /Q4/.test(prompt)
        && prompt.includes('Q3 and Q4 use the same evidence')
        && /do not repeat what they already test/.test(prompt)
        && /"questions"/.test(prompt)
        && prompt.includes(m.worksheet.questions[0].prompt);
      if (!asks) return 'the repair prompt does not carry the problem, the other questions or the output shape';
      // the patch replaces only the named questions and keeps number, skill and format
      const patched = env.quality.applyQuestionPatch(m.worksheet, [{ n: 4, prompt: 'A completely different question?', answer: 'new', skill: 'inference', format: 'short_answer', difficulty: 'B1.2', evidenceQuote: 'bus stop tomorrow morning', evidenceRef: '[6]', rationale: 'because' }]);
      const untouched = patched.questions.filter((q, i) => q === m.worksheet.questions[i]).length;
      const q4 = patched.questions.find(q => q.n === 4);
      return ok(untouched === m.worksheet.questions.length - 1 && q4.prompt === 'A completely different question?' && q4.skill === 'inference' && q4.n === 4,
        'the patch did not replace exactly one question');
    } });
  add({ id: 'S29.repair_never_worse', section: 29, title: 'Eine Korrektur wird nur übernommen, wenn die Prüfung danach besser ausfällt', kind: 'function',
    check(env) {
      const worse = [{ status: 'fail' }, { status: 'warn' }];
      const better = [{ status: 'warn' }];
      const clean = [{ status: 'pass' }];
      const src = env.pipelineSource || '';
      const compares = !src || /problemScore\(candFindings\) < quality\.problemScore\(findings\)/.test(src);
      return ok(env.quality.problemScore(clean) < env.quality.problemScore(better)
        && env.quality.problemScore(better) < env.quality.problemScore(worse) && compares,
        compares ? 'problemScore does not rank failures above warnings' : 'the pipeline applies a repair without comparing');
    } });
  add({ id: 'S29.repair_reported', section: 29, title: 'Jede angewendete Korrektur wird im Qualitätsbericht ausgewiesen', kind: 'function',
    check(env) {
      const src = env.uiSource || '';
      const shows = !src || (/Automatische Korrektur/.test(src) && /repairs/.test(src));
      const m = env.fixture.material();
      m.quality = { findings: [], repairs: [{ round: 1, target: 'questions', questions: [6, 7], fixed: ['dup'], accepted: true }] };
      const html = env.render.renderTeacherHTML(m);
      return ok(shows && /Korrektur/.test(html) && /Q6, Q7/.test(html), shows ? 'the teacher version does not list the repairs' : 'the quality panel does not show the repairs');
    } });

  /* §30 Advanced settings */
  const ADV = { 'number of speakers': 'speakerCount', 'individual speaker share': 'customShares', 'average turn length': 'turnLength', 'turn variability': 'turnVariability', 'speaking speed': 'speakingSpeed', 'natural speech': 'naturalness', 'emotion frequency': 'emotionTags', 'information explicitness': 'explicitness',
    'word count': 'wordCount', 'paragraph length': 'paragraphLength', 'dialogue proportion': 'dialogueProportion', 'narrative vs. informational style': 'styleBalance',
    'CEFR': 'cefr', 'grammar complexity': 'grammarComplexity', 'vocabulary difficulty': 'vocabularyDifficulty', 'target vocabulary density': 'vocabUsage', 'idiomatic language': 'idiomaticLanguage',
    'number (questions)': 'questionCount', 'difficulty (questions)': 'questionDifficulty', 'skill distribution': 'skillMixMode', 'response formats': 'questionFormats', 'distractor difficulty': 'distractorDifficulty', 'inference level': 'inferenceLevel' };
  add({ id: 'S30.chronology', section: 30, title: 'Advanced: chronology – immer aktiv, kein Schalter (siehe §26)', kind: 'function', check(env) { return ok(typeof env.prompts.chronologyRule === 'function' && typeof env.quality.enforceChronology === 'function'); } });
  const ADV_ALT = { grammarComplexity: 95, vocabularyDifficulty: 95, idiomaticLanguage: 95, paragraphLength: 'long', dialogueProportion: 90, styleBalance: 95, distractorDifficulty: 95, inferenceLevel: 95 };
  for (const [label, key] of Object.entries(ADV)) {
    if (key in ADV_ALT) {
      const def = { paragraphLength: 'reading', dialogueProportion: 'reading', styleBalance: 'reading' };
      add({ id: 'S30.' + key, section: 30, title: `Advanced: ${label}`, kind: 'setting', key, alt: ADV_ALT[key], mode: def[key] || 'both' });
    } else {
      add({ id: 'S30.' + key, section: 30, title: `Advanced: ${label} (= Einstellung „${key}“)`, kind: 'function', check(env) { return ok(!!env.core.SCHEMA_BY_KEY[key] && env.hasControl(`[data-setting="${key}"]`) && env.hasControl(`[data-jump="${key}"]`), 'missing control or advanced index entry'); } });
    }
  }

  /* §31 Simple / Advanced mode */
  add({ id: 'S31.toggle', section: 31, title: 'Simple Mode / Advanced Mode umschaltbar', kind: 'ui', selector: '#mode-toggle' });
  add({ id: 'S31.simple_keys', section: 31, title: 'Simple Mode zeigt nur Unit, Topic, Level, Length, Format, Question Difficulty, Number of Questions, Generate', kind: 'function',
    check(env) {
      const keys = env.core.SIMPLE_MODE_KEYS;
      const must = ['unitId', 'topicMode', 'cefr', 'audioLength', 'wordCount', 'format', 'questionDifficulty', 'questionCount'];
      const mustNot = ['naturalness', 'emotionTags', 'questionFormats', 'skillMixMode', 'explicitness', 'vocabUsage', 'higherOrder', 'preTask'];
      return ok(must.every(k => keys.includes(k)) && mustNot.every(k => !keys.includes(k)) && env.hasControl('[data-simple="0"]'), 'simple-mode key set wrong');
    } });

  /* §32 Example configuration */
  add({ id: 'S32.example', section: 32, title: 'Beispielkonfiguration (Podcast Interview, B1.2, 3 min, 30/70, 10 Fragen, Skill-Mix, MC/Short Answer/Matching) ladbar', kind: 'function',
    check(env) {
      const s = env.core.applyExampleConfig(env.state(), env.textbooks);
      const plan = env.core.buildPlan(s, { textbook: env.textbooks[0], unit: env.textbooks[0].units.find(u => u.id === s.unitId) });
      return ok(s.cefr === 'B1.2' && s.preset === 'podcast' && plan.seconds === 180 && deepEq(plan.shares, [30, 70]) && plan.questionCount === 10 && deepEq(plan.skillMix, { gist: 1, specific: 3, detail: 2, connecting: 1, inference: 1, attitude: 1, purpose: 1, context: 0 }) && deepEq(s.questionFormats, ['multiple_choice', 'short_answer', 'matching']) && s.turnVariability >= 75 && s.emotionTags === 'medium' && env.hasControl('#btn-load-example'), 'example config does not reproduce §32');
    } });

  /* §33 Word-Export (Auftragserweiterung): herunterladbar, formatiert, typgerecht) */
  const docParts = (env, m, which) => env.word.partsFor(m, which);
  const docXml = (env, m, which) => String(docParts(env, m, which).find(p => p.name === 'word/document.xml').data);
  const docText = (env, m, which) => env.ooxml.textOf(docParts(env, m, which)).replace(/\s+/g, ' ');
  const squash = (x) => String(x).replace(/\s+/g, '');

  add({ id: 'S33.button_student', section: 33, title: 'Download „Word: Schülerversion“', kind: 'ui', selector: '[data-download="docx-student"]' });
  add({ id: 'S33.button_teacher', section: 33, title: 'Download „Word: Lehrerversion“', kind: 'ui', selector: '[data-download="docx-teacher"]' });
  add({ id: 'S33.filename', section: 33, title: 'Datei wird als .docx mit sprechendem Namen ausgeliefert', kind: 'function',
    check(env) {
      const m = env.fixture.material();
      const f = env.word.filename(m, 'student'), t = env.word.filename(m, 'teacher');
      return ok(/\.docx$/.test(f) && /\.docx$/.test(t) && f !== t && /[a-z]/.test(f), f + ' / ' + t);
    } });
  add({ id: 'S33.valid_package', section: 33, title: 'Erzeugte Word-Datei ist ein gültiges OOXML-Paket (Teile, Content-Types, Beziehungen, Elementreihenfolge)', kind: 'function',
    check(env) {
      const problems = [];
      for (const type of env.core.TEXT_TYPES) {
        const m = env.fixture.material({ textType: type, customTextType: 'Show notes', higherOrder: true, preTask: true }, 'reading');
        for (const which of ['student', 'teacher']) problems.push(...env.ooxml.validate(docParts(env, m, which)).map(x => type + '/' + which + ': ' + x));
      }
      const l = env.fixture.material({ higherOrder: true, preTask: true }, 'listening');
      for (const which of ['student', 'teacher']) problems.push(...env.ooxml.validate(docParts(env, l, which)).map(x => 'listening/' + which + ': ' + x));
      return ok(problems.length === 0, problems.slice(0, 3).join(' | '));
    } });
  add({ id: 'S33.design_per_type', section: 33, title: 'Jeder Texttyp hat ein eigenes Dokument-Design (Schrift, Akzentfarbe, Satzspiegel)', kind: 'function',
    check(env) {
      const seen = new Set();
      for (const type of env.core.TEXT_TYPES) {
        const id = env.core.TEXT_TYPE_DESIGN[type];
        const d = env.word.DESIGNS[id];
        if (!d) return 'no design for ' + type;
        const m = env.fixture.material({ textType: type }, 'reading');
        const xml = docXml(env, m, 'student');
        if (!xml.includes('w:ascii="' + d.fonts.body + '"')) return type + ': body font ' + d.fonts.body + ' not used';
        if (!xml.includes('w:val="' + d.accent + '"') && !xml.includes('w:fill="' + d.accent + '"')) return type + ': accent ' + d.accent + ' not used';
        seen.add(d.fonts.body + '/' + d.accent + '/' + JSON.stringify(d.page));
      }
      return ok(seen.size >= 10, 'only ' + seen.size + ' distinct designs');
    } });

  const DESIGN_MARKERS = {
    story: { type: 'Story', text: ['Fixture Author'], xml: ['w:ascii="Garamond"', 'w:smallCaps', 'w:dropCap="drop"'] },
    article: { type: 'Article', text: ['Fixture Weekly', 'Fixture stand-first sentence.', 'found it under a bench'], xml: ['w:ascii="Cambria"'] },
    news: { type: 'News Article', text: ['Fixture Post', 'FIXTURETOWN'], xml: ['w:num="2"', 'w:val="double"', 'w:ascii="Georgia"'] },
    blog: { type: 'Blog Post', text: ['Fixture Blog', '4 min read', '#fixture'], xml: ['w:ascii="Segoe UI"'] },
    email: { type: 'Email', text: ['From', 'To', 'Subject', 'Fixture subject line', 'Fixture club'], xml: [] },
    forum: { type: 'Forum Discussion', text: ['Fixture thread title', 'fixture_mia', '2 h ago'], xml: [] },
    interview: { type: 'Interview', text: ['Fixture Guest', 'Fixture Voices'], xml: ['w:hanging'] },
    review: { type: 'Review', text: ['★★★★☆', 'Fixture verdict sentence.'], xml: [] },
    report: { type: 'Report', text: ['Fixture Head teacher', 'Fixture executive summary.'], xml: ['w:fill="274060"'] },
    diary: { type: 'Diary Entry', text: ['Tuesday, 14 March'], xml: ['w:ascii="Segoe Script"', 'w:val="dotted"'] },
    informational: { type: 'Informational Text', text: ['Fixture fact one', 'Fixture source'], xml: [] },
    opinion: { type: 'Opinion Text', text: ['Opinion', 'Fixture Columnist'], xml: ['w:dropCap="drop"'] },
    dialogue: { type: 'Dialogue', text: ['Fixture Sam', 'Fixture bus stop'], xml: [] },
    custom: { type: 'Custom', text: ['Fixture Author', 'Fixture introduction.'], xml: [] },
  };
  for (const [id, spec] of Object.entries(DESIGN_MARKERS)) {
    add({ id: 'S33.design_' + id, section: 33, title: `Design „${id}“ (${spec.type}) enthält die typischen Elemente`, kind: 'function',
      check(env) {
        const m = env.fixture.material({ textType: spec.type, customTextType: 'Show notes' }, 'reading');
        const text = docText(env, m, 'student');
        const xml = docXml(env, m, 'student');
        const missingText = spec.text.filter(t => !squash(text).includes(squash(t)));
        const missingXml = spec.xml.filter(x => !xml.includes(x));
        return ok(!missingText.length && !missingXml.length, 'missing ' + missingText.concat(missingXml).join(', '));
      } });
  }
  add({ id: 'S33.design_script', section: 33, title: 'Listening-Skript wird als Aufnahme-Skript gesetzt (Zeilennummern, Sprecher, Emotion-Tags, Setting)', kind: 'function',
    check(env) {
      const m = env.fixture.material({}, 'listening');
      const text = squash(docText(env, m, 'teacher'));
      const need = ['Audio script', 'Fixture school corridor', 'Fixture Talk', '[hesitant]', 'Speaker A'];
      const missing = need.filter(n => !text.includes(squash(n)));
      return ok(!missing.length, 'missing ' + missing.join(', '));
    } });
  add({ id: 'S33.student_no_script', section: 33, title: 'Word-Schülerversion enthält beim Listening kein Skript (ausser die Option „Skript auf der letzten Seite“ ist gewählt)', kind: 'function',
    check(env) {
      const m = env.fixture.material({}, 'listening');
      const text = squash(docText(env, m, 'student'));
      const leaked = m.content.lines.filter(l => text.includes(squash(l.text)));
      const withScript = squash(docText(env, env.fixture.material({ appendScript: true }, 'listening'), 'student'));
      const present = m.content.lines.every(l => withScript.includes(squash(l.text)));
      return ok(leaked.length === 0 && present, leaked.length + ' script line(s) leaked; with option present=' + present);
    } });
  add({ id: 'S33.student_worksheet', section: 33, title: 'Word-Schülerversion ist ein echtes Arbeitsblatt (Name/Klasse/Datum, Ankreuzkästchen, Schreiblinien, Seitenzahl)', kind: 'function',
    check(env) {
      const m = env.fixture.material({ preTask: true, higherOrder: true }, 'listening');
      const text = docText(env, m, 'student');
      const xml = docXml(env, m, 'student');
      const parts = docParts(env, m, 'student');
      const footer = String((parts.find(p => p.name === 'word/footer1.xml') || {}).data || '');
      const hasLines = /<w:pBdr><w:bottom [^>]*w:color="C9CDD3"/.test(xml);
      const missing = [];
      for (const t of ['Name:', 'Class:', 'Date:', '☐']) if (!text.includes(t)) missing.push(t);
      if (!hasLines) missing.push('Schreiblinien');
      if (!/PAGE/.test(footer) || !/NUMPAGES/.test(footer)) missing.push('Seitenzahl');
      if (!m.worksheet.questions.every(q => squash(text).includes(squash(q.prompt)))) missing.push('Fragen');
      return ok(!missing.length, 'missing ' + missing.join(', '));
    } });
  add({ id: 'S33.teacher_key', section: 33, title: 'Word-Lehrerversion enthält Skript/Text, Vokabeln, Lösungsschlüssel mit Skill, Difficulty, Evidenz und Qualitätsbericht', kind: 'function',
    check(env) {
      const m = env.fixture.material({ higherOrder: true }, 'listening');
      m.quality = { findings: [{ id: 'x', group: 'content', title: 'Fixture finding', kind: 'deterministic', status: 'pass', detail: 'Fixture detail' }] };
      const text = squash(docText(env, m, 'teacher'));
      const q = m.worksheet.questions[3];
      const missing = [];
      for (const t of ['Teacher version', 'Answer key', 'Target vocabulary used', 'Quality check', 'Fixture finding', q.evidenceQuote, q.rationale, String(q.answer), 'Inference', q.difficulty]) {
        if (!text.includes(squash(t))) missing.push(t);
      }
      if (!m.content.lines.every(l => text.includes(squash(l.text)))) missing.push('Skript');
      return ok(!missing.length, 'missing ' + missing.join(' | '));
    } });
  add({ id: 'S33.teacher_highlight', section: 33, title: 'Zielvokabular wird in der Word-Lehrerversion hervorgehoben (Schalter wirkt)', kind: 'function',
    check(env) {
      const on = docXml(env, env.fixture.material({ highlightVocab: true }, 'listening'), 'teacher');
      const off = docXml(env, env.fixture.material({ highlightVocab: false }, 'listening'), 'teacher');
      return ok(on.includes('w:fill="FDE68A"') && !off.includes('w:fill="FDE68A"'), 'highlight switch has no effect');
    } });
  add({ id: 'S33.meta_from_claude', section: 33, title: 'Dokument-Angaben (Byline, From/To/Subject, Usernames, Rating …) stammen von Claude, nicht aus dem Code', kind: 'function',
    check(env) {
      const spec = env.core.META_SPECS.email;
      const st = env.state({ kind: 'reading', textType: 'Email' });
      const prompt = env.prompts.buildContentPrompt(st, env.core.buildPlan(st, env.ctx));
      const asked = spec.fields.every(([k]) => prompt.includes('"' + k + '"'));
      const a = env.fixture.material({ textType: 'Email' }, 'reading');
      const b = env.fixture.material({ textType: 'Email' }, 'reading');
      b.content.meta = Object.assign({}, b.content.meta, { subject: 'Completely different subject' });
      const xa = docXml(env, a, 'student'), xb = docXml(env, b, 'student');
      const emptyMeta = env.fixture.material({ textType: 'Email' }, 'reading');
      emptyMeta.content.meta = {};
      const xEmpty = docXml(env, emptyMeta, 'student');
      return ok(asked && xa !== xb && xb.includes('Completely different subject') && !xEmpty.includes('Fixture subject line'),
        'meta not requested from Claude or not used verbatim');
    } });
  add({ id: 'S33.reading_text_in_student', section: 33, title: 'Word-Schülerversion enthält beim Reading den Text im Layout des Texttyps und danach das Arbeitsblatt', kind: 'function',
    check(env) {
      const m = env.fixture.material({ textType: 'Article' }, 'reading');
      const text = squash(docText(env, m, 'student'));
      const xml = docXml(env, m, 'student');
      const hasText = m.content.paragraphs.every(p => text.includes(squash(p)));
      const hasQuestions = m.worksheet.questions.every(q => text.includes(squash(q.prompt)));
      const pageBreak = /w:type w:val="nextPage"|<w:type w:val="nextPage"\/>/.test(xml);
      return ok(hasText && hasQuestions && pageBreak, `text ${hasText}, questions ${hasQuestions}, section break ${pageBreak}`);
    } });
  add({ id: 'S33.html_matches', section: 33, title: 'Die Bildschirmvorschau zeigt denselben Texttyp-Aufbau wie das Word-Dokument', kind: 'function',
    check(env) {
      const m = env.fixture.material({ textType: 'Forum Discussion' }, 'reading');
      const html = env.render.renderTextHTML(m, {});
      return ok(/data-design="forum"/.test(html) && html.includes('fixture_mia') && html.includes(env.render.esc(m.content.meta.threadTitle)), 'html preview does not follow the design');
    } });

  /* No hard-coded content */
  add({ id: 'X.no_hardcoded_content', section: 28, title: 'Kontrolle: keine hartkodierten Textbausteine für Titel, Instruktion, Fragen, Pre-Tasks oder Themen', kind: 'function',
    check(env) {
      const p = env.prompts;
      const q = p.buildQuestionPrompt(env.state({ preTask: true }), env.core.buildPlan(env.state({ preTask: true }), env.ctx), env.fixture.content());
      const generated = /"instructions"/.test(q) && /"title"/.test(q) && /"preTasks"/.test(q) && /"questions"/.test(q);
      const topicGenerated = /JSON array/.test(p.buildTopicPrompt(env.state(), env.core.buildPlan(env.state(), env.ctx)));
      const src = env.pipelineSource || '';
      const leak = env.pipelineSource ? /instructions\s*[:=]\s*['"][A-Z][^'"]{20,}['"]/.test(src) : false;
      return ok(generated && topicGenerated && !leak, 'content is not requested from Claude or a literal instruction text exists in the pipeline');
    } });

  /* §34 Schwierigkeitsmesser & Niveau (Auftragserweiterung) */
  add({ id: 'S34.meter_setting', section: 34, title: 'Schalter „Schwierigkeit messen und nachsteuern“ (Ziel-Niveau = CEFR-Auswahl; Messwerte als Vorgaben im Prompt)', kind: 'setting', key: 'levelMeter', alt: false,
    extra(env) {
      const s = env.state({ cefr: 'B1.2' });
      const p = env.prompts.buildContentPrompt(s, env.core.buildPlan(s, env.ctx));
      return ok(/Measurable level targets/.test(p) && /average sentence length/.test(p) && /most frequent English words/.test(p) && /subordinate or relative clauses/.test(p) && /speaker turns/.test(p), 'content prompt lacks numeric level targets');
    } });
  add({ id: 'S34.dimensions', section: 34, title: 'Messer bewertet Satzlänge, Wortschatz (>2000 / >3500 Häufigkeitsrang), Nebensätze, anspruchsvolle Grammatik, Idiomatik und Beitragslänge', kind: 'function',
    check(env) {
      const keys = env.level.DIMENSIONS.map(d => d.key);
      const m = env.level.measure(env.fixture.content(), 'listening', {});
      const r = env.level.measure(env.fixture.content('reading'), 'reading', {});
      return ok(deepEq(keys, ['sentence', 'lexB2', 'lexC', 'subordination', 'grammar', 'idiom', 'turn']) && m.dimensions.length === 7 && r.dimensions.length === 6 && env.level.BANDS.length === 6 && m.hardWords && m.structures.length >= 10, 'dimensions incomplete');
    } });
  add({ id: 'S34.anchor', section: 34, title: 'Kalibrierung: das Podcast-Skript „Screen Time“ misst B1.2 (Ankerpunkt), A2- und B2-Beispiele ordnen sich monoton ein', kind: 'function',
    check(env) {
      const a = env.level.measure(env.fixture.levelSample('anchor'), 'listening', { seconds: 180 });
      const easy = env.level.measure(env.fixture.levelSample('a2'), 'listening', {});
      const hard = env.level.measure(env.fixture.levelSample('b2'), 'listening', {});
      const hardR = env.level.measure(env.fixture.levelSample('b2reading'), 'reading', {});
      return ok(a.band === 'B1.2' && easy.index <= 1 && hard.index >= 4 && hardR.index >= 4 && easy.score < a.score && a.score < hard.score, `anchor=${a.band} (${a.score}) a2=${easy.band} b2=${hard.band} b2reading=${hardR.band}`);
    } });
  add({ id: 'S34.descriptors', section: 34, title: 'Jede Stufe A2.1–B2.2 ist mit Hör-/Lese-Deskriptor (GER-Begleitband) und sprachlichen Merkmalen hinterlegt', kind: 'function',
    check(env) { return ok(env.level.BANDS.every(b => env.level.DESCRIPTORS[b] && env.level.DESCRIPTORS[b].listening && env.level.DESCRIPTORS[b].reading && env.level.DESCRIPTORS[b].language)); } });
  add({ id: 'S34.rule', section: 34, title: 'Quality Check – gemessene Schwierigkeit gegen das Ziel-Niveau (Warnung bei 1 Stufe, Fehler ab 2 Stufen, mit konkreten Korrekturhinweisen)', kind: 'rule', ruleId: 'content.level_measured',
    extra(env) {
      const m = env.fixture.material({ cefr: 'B2.2' }, 'listening');
      const f = env.quality.runContentChecks(m.settings, m.plan, m.content).find(x => x.id === 'content.level_measured');
      const ok1 = f && f.status === 'fail' && f.measured && f.measured.band && /To fix/.test(f.detail);
      const near = env.fixture.material({ cefr: 'A2.2' }, 'listening');
      const g = env.quality.runContentChecks(near.settings, near.plan, near.content).find(x => x.id === 'content.level_measured');
      const off = env.fixture.material({ levelMeter: false }, 'listening');
      const h = env.quality.runContentChecks(off.settings, off.plan, off.content).find(x => x.id === 'content.level_measured');
      return ok(ok1 && g && g.status !== 'fail' && h && h.status === 'pass', `far=${f && f.status} near=${g && g.status} off=${h && h.status}`);
    } });
  add({ id: 'S34.repair', section: 34, title: 'Abweichungen des Messers fliessen als Korrekturauftrag in die Textüberarbeitung ein (automatische Korrektur)', kind: 'function',
    check(env) {
      const m = env.fixture.material({ cefr: 'B2.2' }, 'listening');
      const f = env.quality.runContentChecks(m.settings, m.plan, m.content).filter(x => x.id === 'content.level_measured');
      const p = env.prompts.buildContentRevisionPrompt(m.settings, m.plan, m.content, f);
      const rp = env.quality.repairPlan(f, 'all');
      return ok(rp.content.length === 1 && /Measured difficulty/.test(p) && /To fix/.test(p), 'level finding is not repaired through the content revision');
    } });
  add({ id: 'S34.output', section: 34, title: 'Messung wird im Quality-Tab, in der Lehrerversion (HTML, Markdown, Word) ausgewiesen', kind: 'render',
    check(env) {
      const m = env.fixture.material({}, 'listening');
      m.level = env.quality.slimMeasurement(env.level.measure(m.content, 'listening', {}));
      const t = env.render.renderTeacherHTML(m);
      const md = env.render.renderMarkdown(m);
      const doc = docText(env, m, 'teacher');
      const gauge = env.render.levelMeterHTML(m.level, 'B1.1');
      const src = env.uiSource || '';
      return ok(/Difficulty meter/.test(t) && /gauge/.test(t) && /### Difficulty meter/.test(md) && /Difficulty meter/.test(doc) && /gauge-marker/.test(gauge) && (!env.uiSource || /levelMeterHTML/.test(src)), 'meter missing in an output');
    } });
  add({ id: 'S34.page', section: 34, title: 'Seite „Niveau messen“: Skript/Text einfügen, messen, Zweitmeinung von Claude', kind: 'ui', selector: '#nav-level',
    extra(env) {
      const p = env.prompts.buildLevelOpinionPrompt('Speaker A: hello', 'listening', env.level.measure(env.fixture.content(), 'listening', {}));
      return ok(env.hasControl('#btn-lv-measure') && env.hasControl('#btn-lv-opinion') && env.hasControl('#lv-text') && /"band"/.test(p) && /A2.1/.test(p) && /B2.2/.test(p));
    } });
  add({ id: 'S34.question_level', section: 34, title: 'Meta-Einstellung Niveau der Fragen: Niveau B = B1.1, Niveau A = B1.2–B2.1, „Beide“ erzeugt zwei Fragebögen', kind: 'setting', key: 'questionLevel', alt: 'B',
    extra(env) {
      const c = env.core;
      const A = c.QUESTION_LEVELS.A, B = c.QUESTION_LEVELS.B;
      const sA = env.state({ questionLevel: 'A' }), sB = env.state({ questionLevel: 'B' }), sBoth = env.state({ questionLevel: 'both' });
      const pA = c.buildPlan(sA, env.ctx), pB = c.buildPlan(sB, env.ctx), pBoth = c.buildPlan(sBoth, env.ctx);
      const qA = env.prompts.buildQuestionPrompt(sA, pA, env.fixture.content());
      const qB = env.prompts.buildQuestionPrompt(sB, pB, env.fixture.content());
      return ok(deepEq(A.bands, ['B1.2', 'B2.1']) && deepEq(B.bands, ['B1.1']) && deepEq(pA.questionBands, ['B1.2', 'B2.1']) && deepEq(pB.questionBands, ['B1.1'])
        && deepEq(pBoth.variants, ['A', 'B']) && c.questionVariants(sBoth).length === 2 && /Niveau A/.test(qA) && /B1.2 to B2.1/.test(qA) && /Niveau B/.test(qB) && /CEFR B1.1/.test(qB)
        && pA.questionDifficulty > pB.questionDifficulty && (pA.skillMix.inference + pA.skillMix.connecting) >= (pB.skillMix.inference + pB.skillMix.connecting), 'question level plan wrong');
    } });
  add({ id: 'S34.variants_output', section: 34, title: '„Beide“: je eine Schülerversion pro Niveau (Bildschirm, HTML, Word A/B), Lehrerversion mit beiden Lösungen, Prüfung je Fragebogen', kind: 'render',
    check(env) {
      const m = env.fixture.material({}, 'listening');
      const wsB = JSON.parse(JSON.stringify(m.worksheet)); wsB.title = 'Fixture B title'; wsB.questions[1].prompt = 'Fixture B question?'; wsB.questions[1].answer = 'Fixture B answer';
      m.variants = [{ key: 'A', label: 'Niveau A', plan: m.plan, worksheet: m.worksheet }, { key: 'B', label: 'Niveau B', plan: m.plan, worksheet: wsB }];
      const sA = env.render.renderStudentHTML(m, 'A'), sB = env.render.renderStudentHTML(m, 'B');
      const t = env.render.renderTeacherHTML(m);
      const dA = docText(env, m, 'student'), dB = String(env.ooxml.textOf(env.word.partsFor(m, 'student', 'B'))).replace(/\s+/g, ' ');
      const dT = docText(env, m, 'teacher');
      const src = env.uiSource || '';
      return ok(!/Fixture B question/.test(sA) && /Fixture B question/.test(sB) && /Answer key — Niveau A/.test(t) && /Answer key — Niveau B/.test(t) && /Fixture B answer/.test(t)
        && !/Fixture B question/.test(dA) && /Fixture B question/.test(dB) && /Niveau A/.test(dT) && /Niveau B/.test(dT) && /Fixture B answer/.test(dT) && env.word.filename(m, 'student', 'B').endsWith('-niveau-b.docx')
        && (!env.uiSource || (/produceWorksheet\(run, core\.variantState/.test(src) && /data-variant/.test(src))), 'variant output incomplete');
    } });
  add({ id: 'S34.band_rule', section: 34, title: 'Quality Check – jede Frage trägt eine Stufe innerhalb des erlaubten Fragen-Niveaus', kind: 'rule', ruleId: 'questions.level_band',
    extra(env) {
      const m = env.fixture.material({ questionLevel: 'B' }, 'listening');
      const f = env.quality.runDeterministic(m.settings, m.plan, m.content, m.worksheet).find(x => x.id === 'questions.level_band');
      const okM = env.fixture.material({ questionLevel: 'A' }, 'listening');
      okM.worksheet.questions.forEach(q => { q.difficulty = 'B1.2'; });
      const g = env.quality.runDeterministic(okM.settings, okM.plan, okM.content, okM.worksheet).find(x => x.id === 'questions.level_band');
      return ok(f && f.status === 'pass' && g && g.status === 'pass', `B=${f && f.status} A=${g && g.status}`);
    } });
  add({ id: 'S34.glossary', section: 34, title: 'Option „Fremdwörter auf der 1. Seite erklärt“: Messer wählt die Wörter über dem Niveau (ohne Zielvokabular), Claude erklärt sie; Ausgabe auf Seite 1 (HTML, Word)', kind: 'setting', key: 'glossary', alt: true,
    extra(env) {
      const m = env.fixture.material({ glossary: true }, 'listening');
      const measured = env.level.measure(m.content, 'listening', { exclude: m.plan.vocabulary.map(w => w.word) });
      const cands = env.level.glossaryCandidates(measured, 'A2.1', 12);
      const noTarget = cands.every(c => !m.plan.vocabulary.some(v => v.word.toLowerCase() === c.lemma));
      const p = env.prompts.buildGlossaryPrompt(m.settings, m.plan, m.content, cands.length ? cands : [{ word: 'x', count: 1 }]);
      m.glossary = env.quality.normalizeGlossary({ glossary: [{ word: 'ticket', form: 'tickets', explanation: 'Fixture explanation', german: 'Fixture DE' }] });
      const st = env.render.renderStudentHTML(m);
      const doc = docText(env, m, 'student');
      const src = env.uiSource || '';
      const firstPage = doc.indexOf('Fixture explanation') < doc.indexOf(m.worksheet.questions[0].prompt);
      return ok(noTarget && /"glossary"/.test(p) && /German equivalent/.test(p) && st.indexOf('Words to know') < st.indexOf('Questions') && /Fixture explanation/.test(st) && firstPage && (!env.uiSource || /buildGlossaryPrompt/.test(src)), 'glossary pipeline incomplete');
    } });
  add({ id: 'S34.append_script', section: 34, title: 'Option „Skript auf der letzten Seite abgebildet“ (Listening): Schülerversion endet mit dem Skript (HTML, Word, Markdown)', kind: 'setting', key: 'appendScript', alt: true, promptSensitive: false,
    extra(env) {
      const m = env.fixture.material({ appendScript: true }, 'listening');
      const st = env.render.renderStudentHTML(m);
      const last = m.content.lines[m.content.lines.length - 1].text;
      const doc = docText(env, m, 'student');
      const md = env.render.renderMarkdown(m);
      const off = env.render.renderStudentHTML(env.fixture.material({ appendScript: false }, 'listening'));
      return ok(st.indexOf('Questions') < st.indexOf('class="block script appendix') && st.includes(env.render.esc(last)) && !off.includes(env.render.esc(last)) && doc.indexOf(m.worksheet.questions[0].prompt) < doc.indexOf(last) && md.indexOf('### Script') < md.indexOf('## Teacher version'), 'script appendix incomplete');
    } });

  return { REQUIREMENTS: M };
});
