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
  for (const s of [[1, 'source', 'Source & Unit'], [2, 'content', 'Content'], [3, 'level', 'Language Level'], [4, 'structure', 'Text / Audio Structure'], [5, 'vocab', 'Vocabulary'], [6, 'worksheet', 'Worksheet & Questions'], [7, 'pretask', 'Pre-Task'], [8, 'posttask', 'Post-Task'], [9, 'advanced', 'Advanced Settings'], [10, 'generate', 'Generate']]) {
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
  add({ id: 'S27.types', section: 27, title: 'Formen Prediction / Vocabulary Activation / Speaking Prompt (plus weitere Aufgabentypen, §35)', kind: 'setting', key: 'preTaskTypes', alt: ['speaking'], given: { preTask: true },
    extra(env) { return ok(['prediction', 'vocabulary', 'speaking'].every(k => env.core.PRE_TASK_TYPE_KEYS.includes(k))); } });
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

  add({ id: 'S28.viewer', section: 28, title: 'Viewer: das fertige Material als Dokument – Blatt in A4-Breite mit Druckumbruch, Inhaltsverzeichnis, Schüler-/Lehrerfassung, Niveaus, Zoom, Bild des Mediums, Qualität und allen Downloads an einem Ort', kind: 'ui', selector: '#view-viewer',
    extra(env) {
      // what the viewer shows is one model, so it can be checked without a browser
      const reading = env.fixture.material({ createWorksheet: true, preTask: true, postTask: true, authenticLayout: true, questionLevel: 'both' }, 'reading');
      const listening = env.fixture.material({ createWorksheet: false }, 'listening');
      for (const [name, m] of [['reading', reading], ['listening', listening]]) {
        for (const version of ['student', 'teacher']) {
          const v = env.render.viewerModel(m, { version });
          if (!v.title) return name + '/' + version + ': no title';
          if (v.meta.length < 5) return name + '/' + version + ': the material is not described';
          if (!v.sections.length) return name + '/' + version + ': no table of contents';
          if (!v.html || v.html.length < 200) return name + '/' + version + ': no sheet';
          if (v.html !== (v.version === 'teacher' ? env.render.renderTeacherHTML(m) : env.render.renderStudentHTML(m, v.multi ? v.variant : undefined))) {
            return name + '/' + version + ': the viewer shows something else than the export';
          }
          // a version that has nothing to show is named, not served empty
          const student = v.versions.find(x => x.key === 'student');
          if (!student.available && !v.note) return name + ': an empty student version without a word of explanation';
          if (!student.available && v.version !== 'teacher') return name + ': an empty student version is shown anyway';
          const kinds = v.downloads.map(d => d.kind);
          for (const need of ['docx-student', 'docx-teacher', 'student', 'teacher', 'md', 'json']) {
            if (!kinds.includes(need)) return name + ': download missing — ' + need;
          }
          if (v.hasMedium !== !!(m.layout && m.layout.chrome)) return name + ': the picture of the medium is not offered correctly';
          if (v.hasMedium && !kinds.includes('png')) return name + ': no picture to download';
          if (typeof v.quality.blocking !== 'number') return name + ': the quality is not summarised';
        }
      }
      // both question levels are offered and really differ
      const both = env.render.viewerModel(reading, { version: 'student' });
      if (both.multi && both.variants.length < 2) return 'the levels are not offered';
      const src = env.uiSource || '';
      const wired = !src || (/function openViewer/.test(src) && /function markPageBreaks/.test(src) && /render\.viewerModel/.test(src) && /vw-toc/.test(src));
      return ok(wired && env.hasControl('#vw-title') && env.hasControl('#vw-rail') && env.hasControl('#vw-paper') && env.hasControl('#vw-version'),
        'the viewer is missing parts of its frame');
    } });

  /* §29 Quality check rules */
  const RULE_REQS = [
    ['content.topic_unit', 'Content: Thema passt zur Unit'], ['content.vocab_used', 'Content: Zielvokabular sinnvoll verwendet'], ['content.coherent', 'Content: Text kohärent'], ['content.natural', 'Content: Gespräch wirkt natürlich'],
    ['listening.shares', 'Listening: Sprechanteile entsprechen den Einstellungen'], ['listening.distinguishable', 'Listening: Sprecher eindeutig unterscheidbar'], ['listening.emotion_tags', 'Listening: Emotion-Tags sinnvoll verteilt'], ['listening.no_artificial_switches', 'Listening: keine künstlichen Sprecherwechsel'],
    ['questions.answerable', 'Questions: jede Frage eindeutig beantwortbar'], ['questions.derivable', 'Questions: Antwort aus dem Material ableitbar'], ['questions.distractors', 'Questions: Distraktoren plausibel'], ['questions.chronology', 'Questions: Audio-/Textreihenfolge'],
    ['questions.complete', 'Questions: jede Frage ist so einsetzbar (Text, Antwort, Optionen, Paare passen zum Format)'],
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

  add({ id: 'S29.blocking_visible', section: 29, title: 'Nicht bestandene blockierende Prüfungen werden ausgewiesen – im Lauf, im Quality-Check, in der Lehrerversion und im Word-Export', kind: 'function',
    check(env) {
      const m = env.fixture.material({ createWorksheet: true }, 'reading');
      m.content.paragraphs = ['much too short'];
      m.quality = { findings: env.quality.runContentChecks(m.settings, m.plan, m.content) };
      const blocked = env.quality.blockingFailures(m.quality.findings);
      if (!blocked.length) return 'a far too short text produces no blocking failure';
      if (!m.quality.findings.every(f => typeof f.blocking === 'boolean')) return 'findings do not carry the blocking flag';
      const html = env.render.renderTeacherHTML(m);
      if (!/blocking check\(s\) failed/.test(html) || !/qc-blocking/.test(html)) return 'the teacher version does not show the blocking failures';
      // an older stored material without the flag must still be judged
      const older = m.quality.findings.map(f => { const c = Object.assign({}, f); delete c.blocking; return c; });
      if (env.quality.blockingFailures(older).length !== blocked.length) return 'older findings are no longer recognised';
      const src = env.pipelineSource || '';
      const shown = !src || (/blockingFailures\(findingsAll\)/.test(src) && /blockierend/.test(src));
      return ok(shown, 'the run does not report the blocking failures');
    } });

  add({ id: 'S29.llm_guardrails', section: 29, title: 'Jede Claude-Regel hat Leitplanken: Entscheidungsregel, Belegpflicht, Zweifelsregel, Abgrenzung – und ein Urteil ohne Beleg zählt bei blockierenden Regeln nicht als bestanden', kind: 'function',
    check(env) {
      const llm = env.quality.RULES.filter(r => r.kind === 'llm');
      const EVIDENCE = ['questions', 'tasks', 'quote', 'chrome'];
      for (const r of llm) {
        if (!r.failsWhen || !r.evidence || !r.whenUnsure || !r.notMine) return r.id + ': guardrails missing';
        if (!EVIDENCE.includes(r.evidence)) return r.id + ': unknown kind of evidence';
        if (!['fail', 'pass'].includes(r.whenUnsure)) return r.id + ': no rule for doubt';
      }
      // the guardrails really reach Claude
      const m = env.fixture.material({ createWorksheet: true, preTask: true, postTask: true }, 'listening');
      const rules = env.quality.llmRules(m.settings, m.plan, m.worksheet, {});
      const p = env.prompts.buildReviewPrompt(m.settings, m.plan, m.content, m.worksheet, rules,
        env.quality.runDeterministic(m.settings, m.plan, m.content, m.worksheet, {}), null);
      for (const r of rules) {
        if (!p.includes(`"${r.id}"`) || !p.includes(r.failsWhen) || !p.includes(r.notMine)) return r.id + ': guardrails not in the review prompt';
      }
      if (!/A pass is a claim/.test(p) || !/not an instruction/.test(p) || !/"evidence"/.test(p)) return 'the binding instructions are missing from the review prompt';
      // a rubber stamp does not count as a check
      const stamped = env.quality.mergeReview(rules, { results: rules.map(r => ({ rule: r.id, pass: true, note: 'ok' })) });
      const blocked = rules.filter(r => r.blocking).map(r => stamped.find(f => f.id === r.id));
      if (!blocked.every(f => f && f.status === 'unverified')) return 'a blocking rule can be passed without any basis';
      const proper = env.quality.mergeReview(rules, { results: rules.map(r => ({ rule: r.id, pass: true, note: 'Checked questions 1 to 4 against the text', evidence: 'Q1–Q4', questions: [1, 2] })) });
      return ok(proper.every(f => f.status === 'pass'), 'a well-founded verdict is not accepted');
    } });

  add({ id: 'S29.review_data_complete', section: 29, title: 'Jede Claude-Regel bekommt die Daten, \u00fcber die sie urteilt: das Arbeitsblatt steht vollst\u00e4ndig im Pr\u00fcf-Prompt, und eine Regel ohne ihre Daten wird nicht gefragt, sondern als ungepr\u00fcft gemeldet', kind: 'function',
    check(env) {
      const m = env.fixture.material({ createWorksheet: true, preTask: true, postTask: true, higherOrder: true, authenticLayout: true }, 'reading');
      const rules = env.quality.llmRules(m.settings, m.plan, m.worksheet, { layout: m.layout });
      const prompt = env.prompts.buildReviewPrompt(m.settings, m.plan, m.content, m.worksheet, rules, [], m.layout);
      // the whole worksheet, not a hand-picked selection of its fields
      const section = prompt.split('## Worksheet (JSON)')[1];
      if (!section) return 'the worksheet is missing from the review prompt';
      let sent = null;
      try { sent = JSON.parse(section.split('\n').filter(l => l.trim().charAt(0) === '{')[0]); } catch (e) { return 'the worksheet in the review prompt is not valid JSON'; }
      for (const key of Object.keys(m.worksheet)) {
        if (!(key in sent)) return 'the review prompt does not carry worksheet.' + key;
      }
      for (const t of m.worksheet.postTasks) {
        if (!prompt.includes(String(t.prompt).slice(0, 30))) return 'the post-task prompts are missing from the review prompt';
      }
      if (env.prompts.reviewDataGaps(prompt, rules).length) return 'a rule is asked although its data is missing: ' + env.prompts.reviewDataGaps(prompt, rules).join(', ');
      // and the guard itself: without the data, the rule is not judged but reported as unverified
      const without = Object.assign({}, m.worksheet, { postTasks: [] });
      const blind = env.prompts.buildReviewPrompt(m.settings, m.plan, m.content, without, rules, [], m.layout);
      const gaps = env.prompts.reviewDataGaps(blind, rules);
      if (!gaps.length || !gaps.every(id => id.indexOf('posttask.') === 0)) return 'a missing worksheet part is not noticed';
      const merged = env.quality.mergeReview(rules, { results: gaps.map(id => ({ rule: id, pass: false, note: 'no data given', evidence: 'T1' })) }, { unavailable: gaps });
      const bad = merged.filter(f => gaps.indexOf(f.id) >= 0 && f.status !== 'unverified');
      if (bad.length) return 'a rule without its data still produces a verdict: ' + bad.map(f => f.id).join(', ');
      return ok(!env.quality.blockingFailures(merged).length, 'a rule without its data still blocks the material');
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
  add({ id: 'S33.lesson_order', section: 33, title: 'Reihenfolge der Stunde in jeder Ausgabe: Pre-Task und Vokabular stehen vor dem Text, Fragen und Post-Task danach (Bildschirm, Markdown, Word)', kind: 'function',
    check(env) {
      const problems = [];
      const plain = (html) => squash(String(html).replace(/<[^>]*>/g, ' '));
      // every output has to read like the lesson runs: warm up, words, text, questions, transfer
      const order = (hay, marks, where) => {
        let last = -1, lastName = '';
        for (const mark of marks) {
          const at = hay.indexOf(squash(mark));
          if (at < 0) { problems.push(where + ': "' + mark + '" is missing'); return; }
          if (at < last) problems.push(where + ': "' + mark + '" stands before "' + lastName + '"');
          last = at; lastName = mark;
        }
      };
      for (const kind of ['reading', 'listening']) {
        const m = env.fixture.material({ preTask: true, postTask: true, glossary: true, higherOrder: true }, kind);
        const body = kind === 'reading' ? m.content.paragraphs[0].slice(0, 40) : m.content.lines[0].text.slice(0, 40);
        const read = kind === 'listening' ? 'listen' : 'read';
        const studentBody = kind === 'reading' ? [body] : [];
        order(plain(env.render.renderStudentHTML(m, {})), ['Before you ' + read, 'Words to know'].concat(studentBody, [m.worksheet.questions[0].prompt.slice(0, 30), 'After you ' + read]), kind + ' student HTML');
        order(plain(env.render.renderTeacherHTML(m, {})), ['Pre-task', 'Target vocabulary used', 'Words to know', body, 'Answer key', 'Post-task'], kind + ' teacher HTML');
        const md = squash(env.render.renderMarkdown(m, {}));
        order(md, ['Before you ' + read, 'Words to know'].concat(studentBody, ['After you ' + read, 'Teacher version', 'Pre-task', 'Target vocabulary used', kind === 'reading' ? '### Text' : '### Script', 'Answer key']), kind + ' Markdown');
        order(squash(docText(env, m, 'student')), ['Before you ' + read, 'Words to know'].concat(studentBody, ['After you ' + read]), kind + ' Word student');
        order(squash(docText(env, m, 'teacher')), ['Pre-Task', 'Target vocabulary used', 'Words to know', body, 'Answer key', 'Post-Task'], kind + ' Word teacher');
      }
      return ok(!problems.length, problems.slice(0, 4).join(' | '));
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


  /* §35 Pre-Task: Aufgabentypen, Sozialformen, Anforderungsniveau (Auftragserweiterung) */
  const preState = (env, over) => env.state(Object.assign({ createWorksheet: true, preTask: true }, over || {}));
  const prePlan = (env, over) => env.core.buildPlan(preState(env, over), env.ctx);
  const prePrompt = (env, over) => { const s = preState(env, over); return env.prompts.buildQuestionPrompt(s, env.core.buildPlan(s, env.ctx), env.fixture.content()); };
  const preFind = (env, id, over, mutate) => {
    const m = env.fixture.material(Object.assign({ preTask: true }, over || {}), 'listening');
    if (mutate) mutate(m.worksheet.preTasks, m);
    return env.quality.runDeterministic(m.settings, m.plan, m.content, m.worksheet).find(f => f.id === id);
  };

  add({ id: 'S35.section', section: 35, title: 'Eigener Creator-Bereich „Pre-Task“', kind: 'ui', selector: '#sec-pretask[data-step="7"]' });
  add({ id: 'S35.focus', section: 35, title: 'Pre-Task ums Thema, ums Vokabular oder um beides', kind: 'setting', key: 'preTaskFocus', alt: 'vocabulary', given: { preTask: true },
    extra(env) {
      const t = prePrompt(env, { preTaskFocus: 'topic' }), v = prePrompt(env, { preTaskFocus: 'vocabulary' });
      return ok(/prior knowledge, attitudes and expectations/.test(t) && /every task works with those words/.test(v) && /Target vocabulary of the unit/.test(v));
    } });
  add({ id: 'S35.count', section: 35, title: 'Anzahl der Pre-Task-Aufgaben einstellbar', kind: 'setting', key: 'preTaskCount', alt: 5, given: { preTask: true },
    extra(env) {
      const p = prePlan(env, { preTaskCount: 5 });
      return ok(p.preTask.count === 5 && p.preTask.tasks.length === 5 && p.preTask.tasks.every((t, i) => t.n === i + 1) && /exactly 5 pre-task/.test(prePrompt(env, { preTaskCount: 5 })));
    } });
  add({ id: 'S35.types', section: 35, title: 'Aufgabentypen wählbar: Konfrontation, Vorwissen, Wortfeld, Ranking, Umfrage, Sprechimpuls, Wortschatz, Hypothesen, Prediction', kind: 'setting', key: 'preTaskTypes', alt: ['confrontation'], given: { preTask: true },
    extra(env) {
      const keys = env.core.PRE_TASK_TYPE_KEYS;
      const complete = ['confrontation', 'activation', 'brainstorm', 'ranking', 'survey', 'speaking', 'vocabulary', 'hypothesis', 'prediction'].every(k => keys.includes(k));
      const defined = env.core.PRE_TASK_TYPES.every(t => t.definition && t.definition.length > 40);
      const p = prePlan(env, { preTaskCount: 4, preTaskTypes: ['confrontation', 'ranking'] });
      const mix = p.preTask.typeMix;
      return ok(complete && defined && mix.confrontation === 2 && mix.ranking === 2, 'types incomplete or not distributed');
    } });
  add({ id: 'S35.confrontation', section: 35, title: 'Konfrontationsaufgabe: zugespitzte These/Dilemma, beidseitig vertretbar, ohne das Material lösbar', kind: 'function',
    check(env) {
      const p = prePrompt(env, { preTaskTypes: ['confrontation'], preTaskCount: 1 });
      const rule = env.quality.RULES.find(r => r.id === 'pretask.confrontation');
      const planned = env.core.buildPlan(preState(env, { preTaskTypes: ['confrontation'] }), env.ctx);
      const other = env.core.buildPlan(preState(env, { preTaskTypes: ['prediction'] }), env.ctx);
      const onA = env.quality.applicableRules(preState(env, { preTaskTypes: ['confrontation'] }), planned, env.fixture.material({ preTask: true }).worksheet).some(r => r.id === 'pretask.confrontation');
      const onB = env.quality.applicableRules(preState(env, { preTaskTypes: ['prediction'] }), other, env.fixture.material({ preTask: true }).worksheet).some(r => r.id === 'pretask.confrontation');
      return ok(/take a position on BEFORE/.test(p) && /argued both ways/.test(p) && rule && onA && !onB, 'confrontation task not demanded or not checked');
    } });
  add({ id: 'S35.social_mode', section: 35, title: 'Sozialformen automatisch verteilen oder selbst festlegen', kind: 'setting', key: 'preTaskSocialMode', alt: 'custom',
    given: { preTask: true, customPreTaskSocial: { single: 0, pair: 0, group: 1, plenary: 1 } },
    extra(env) {
      const auto = prePlan(env, {}).preTask.socialMix;
      const own = prePlan(env, { preTaskSocialMode: 'custom', customPreTaskSocial: { single: 0, pair: 0, group: 1, plenary: 1 } }).preTask.socialMix;
      return ok(!deepEq(auto, own) && (own.group || 0) === 1 && (own.plenary || 0) === 1, 'the own mix does not reach the plan');
    } });
  add({ id: 'S35.social_custom', section: 35, title: 'Wie viele Einzel-, Partner-, Gruppen- und Plenumsarbeiten', kind: 'setting', key: 'customPreTaskSocial', alt: { single: 0, pair: 0, group: 1, plenary: 1 }, given: { preTask: true, preTaskSocialMode: 'custom' },
    extra(env) {
      const p = prePlan(env, { preTaskSocialMode: 'custom', customPreTaskSocial: { single: 0, pair: 2, group: 0, plenary: 0 } });
      const forms = p.preTask.tasks.map(t => t.socialForm);
      const labels = env.core.SOCIAL_FORMS.map(f => f.key);
      return ok(deepEq(labels, ['single', 'pair', 'group', 'plenary']) && forms.every(f => f === 'pair') && /with your partner/.test(prePrompt(env, { preTaskSocialMode: 'custom', customPreTaskSocial: { single: 0, pair: 2, group: 0, plenary: 0 } })), forms.join(','));
    } });
  add({ id: 'S35.oral', section: 35, title: 'Wie viele Aufgaben mündlich gelöst werden (nur mit interaktiver Sozialform)', kind: 'setting', key: 'preTaskOralCount', alt: 2, given: { preTask: true },
    extra(env) {
      const p = prePlan(env, { preTaskCount: 3, preTaskOralCount: 2 });
      const oral = p.preTask.tasks.filter(t => t.mode === 'oral');
      const lonely = oral.filter(t => t.socialForm === 'single');
      const errs = env.core.validateState(preState(env, { preTaskCount: 2, preTaskOralCount: 2, preTaskSocialMode: 'custom', customPreTaskSocial: { single: 2, pair: 0, group: 0, plenary: 0 } }), env.ctx).map(e => e.key);
      return ok(oral.length === 2 && lonely.length === 0 && errs.includes('preTaskOralCount') && /nothing has to be written down/.test(prePrompt(env, { preTaskOralCount: 1 })), 'oral tasks not planned or not guarded');
    } });
  add({ id: 'S35.social_auto', section: 35, title: 'Automatische Sozialformen: genug interaktive Formen für die mündlichen Aufgaben, feste Zuordnung pro Aufgabe', kind: 'function',
    check(env) {
      for (let n = 1; n <= 6; n++) for (let oral = 0; oral <= n; oral++) {
        const mix = env.core.autoPreTaskSocial(n, oral);
        const sum = env.core.SOCIAL_FORM_KEYS.reduce((a, k) => a + mix[k], 0);
        const inter = mix.pair + mix.group + mix.plenary;
        if (sum !== n || inter < oral) return `n=${n} oral=${oral} → ${JSON.stringify(mix)}`;
      }
      const p = prePlan(env, { preTaskCount: 3, preTaskTypes: ['speaking', 'vocabulary', 'prediction'], preTaskOralCount: 1 });
      const prompt = prePrompt(env, { preTaskCount: 3, preTaskTypes: ['speaking', 'vocabulary', 'prediction'], preTaskOralCount: 1 });
      const fixed = p.preTask.tasks.every(t => prompt.includes(`"socialForm": "${t.socialForm}"`) && prompt.includes(`"mode": "${t.mode}"`));
      return ok(fixed, 'the plan is not handed to Claude per task');
    } });
  add({ id: 'S35.difficulty', section: 35, title: 'Kriterienorientiertes Anforderungsniveau der Pre-Task (reproduktiv bis Position beziehen)', kind: 'setting', key: 'preTaskDifficulty', alt: 95, given: { preTask: true },
    extra(env) { return ok(/reproductive — collect, name, tick/.test(prePrompt(env, { preTaskDifficulty: 0 })) && /argue a dilemma from both sides/.test(prePrompt(env, { preTaskDifficulty: 100 }))); } });
  add({ id: 'S35.scaffolding', section: 35, title: 'Hilfestellungen (Beispiel, Wortspeicher, Satzanfänge, Musterlösung)', kind: 'setting', key: 'preTaskScaffolding', alt: 95, given: { preTask: true },
    extra(env) { return ok(/none — the bare task/.test(prePrompt(env, { preTaskScaffolding: 0 })) && /word bank, sentence starters, a model answer/.test(prePrompt(env, { preTaskScaffolding: 100 }))); } });
  add({ id: 'S35.level', section: 35, title: 'Sprachniveau der Aufgabenstellung (wie die Fragen, Niveau A oder B)', kind: 'setting', key: 'preTaskLevel', alt: 'A', given: { preTask: true },
    extra(env) {
      const a = prePlan(env, { preTaskLevel: 'A' }).preTask.band, b = prePlan(env, { preTaskLevel: 'B' }).preTask.band;
      return ok(a === 'B1.2' && b === 'B1.1' && /Language of the instructions/.test(prePrompt(env, {})));
    } });
  add({ id: 'S35.criteria', section: 35, title: 'Gelingenskriterien pro Aufgabe (kriterienorientiert), auf dem Arbeitsblatt ausgewiesen', kind: 'setting', key: 'preTaskCriteria', alt: false, given: { preTask: true },
    extra(env) {
      const m = env.fixture.material({ preTask: true }, 'listening');
      const st = env.render.renderStudentHTML(m);
      const doc = docText(env, m, 'student');
      const crit = m.worksheet.preTasks[0].criteria[0];
      return ok(/observable statements in student language/.test(prePrompt(env, {})) && /"criteria" is an empty array/.test(prePrompt(env, { preTaskCriteria: false }))
        && st.includes('Success criteria') && st.includes(env.render.esc(crit)) && doc.includes(crit), 'success criteria missing in prompt or output');
    } });
  add({ id: 'S35.minutes', section: 35, title: 'Zeitbudget der Pre-Task, auf die Aufgaben verteilt', kind: 'setting', key: 'preTaskMinutes', alt: 20, given: { preTask: true },
    extra(env) {
      const p = prePlan(env, { preTaskCount: 3, preTaskMinutes: 9 });
      return ok(p.preTask.tasks.reduce((a, t) => a + t.minutes, 0) === 9 && p.preTask.tasks.every(t => t.minutes >= 1) && /total 9 minutes/.test(prePrompt(env, { preTaskCount: 3, preTaskMinutes: 9 })));
    } });

  /* Kontrollen */
  add({ id: 'S35.rule_present', section: 35, title: 'Kontrolle: Anzahl und Typen der Pre-Task-Aufgaben stimmen', kind: 'rule', ruleId: 'pretask.present',
    extra(env) {
      const good = preFind(env, 'pretask.present');
      const bad = preFind(env, 'pretask.present', {}, (pre) => pre.pop());
      const wrongType = preFind(env, 'pretask.present', {}, (pre) => { pre[0].type = 'ranking'; });
      return ok(good.status === 'pass' && bad.status === 'fail' && wrongType.status === 'fail', `${good.status}/${bad.status}/${wrongType.status}`);
    } });
  add({ id: 'S35.rule_social', section: 35, title: 'Kontrolle: Sozialformen entsprechen den Einstellungen', kind: 'rule', ruleId: 'pretask.social_forms',
    extra(env) {
      const good = preFind(env, 'pretask.social_forms');
      const bad = preFind(env, 'pretask.social_forms', {}, (pre) => { pre[0].socialForm = 'group'; });
      return ok(good.status === 'pass' && bad.status === 'fail' && bad.preTasks.includes(1), `${good.status}/${bad.status}`);
    } });
  add({ id: 'S35.rule_modes', section: 35, title: 'Kontrolle: mündliche und schriftliche Aufgaben wie eingestellt, mündlich nie in Einzelarbeit', kind: 'rule', ruleId: 'pretask.modes',
    extra(env) {
      const good = preFind(env, 'pretask.modes');
      const bad = preFind(env, 'pretask.modes', {}, (pre) => { pre[0].mode = 'written'; });
      const lonely = preFind(env, 'pretask.modes', {}, (pre) => { pre[1].mode = 'oral'; pre[0].mode = 'written'; });
      return ok(good.status === 'pass' && bad.status === 'fail' && lonely.status !== 'pass', `${good.status}/${bad.status}/${lonely.status}`);
    } });
  add({ id: 'S35.rule_focus', section: 35, title: 'Kontrolle: Wortschatzaufgaben arbeiten mit dem Zielvokabular, Themenaufgaben mit dem Thema', kind: 'rule', ruleId: 'pretask.focus',
    extra(env) {
      const good = preFind(env, 'pretask.focus');
      const bad = preFind(env, 'pretask.focus', {}, (pre) => { pre[0].prompt = 'Talk about anything you like.'; pre[0].items = []; pre[0].vocabUsed = []; });
      return ok(good.status === 'pass' && bad.status === 'warn', `${good.status}/${bad.status}`);
    } });
  add({ id: 'S35.rule_criteria', section: 35, title: 'Kontrolle: Gelingenskriterien vorhanden und kurz', kind: 'rule', ruleId: 'pretask.criteria',
    extra(env) {
      const good = preFind(env, 'pretask.criteria');
      const bad = preFind(env, 'pretask.criteria', {}, (pre) => { pre[0].criteria = []; });
      const off = preFind(env, 'pretask.criteria', { preTaskCriteria: false }, (pre) => { pre[0].criteria = []; });
      return ok(good.status === 'pass' && bad.status === 'fail' && off.status === 'pass', `${good.status}/${bad.status}/${off.status}`);
    } });
  add({ id: 'S35.rule_time', section: 35, title: 'Kontrolle: Zeitangaben vorhanden und im Budget', kind: 'rule', ruleId: 'pretask.time',
    extra(env) {
      const good = preFind(env, 'pretask.time');
      const bad = preFind(env, 'pretask.time', {}, (pre) => { pre[0].minutes = 40; });
      return ok(good.status === 'pass' && bad.status === 'warn', `${good.status}/${bad.status}`);
    } });
  add({ id: 'S35.rule_language', section: 35, title: 'Kontrolle: Aufgabenstellung bleibt auf dem eingestellten Sprachniveau', kind: 'rule', ruleId: 'pretask.language',
    extra(env) {
      const good = preFind(env, 'pretask.language');
      const bad = preFind(env, 'pretask.language', {}, (pre) => { pre[0].prompt = 'Scrutinise the ostensibly innocuous ramifications and corroborate your conjecture.'; });
      return ok(good.status === 'pass' && bad.status === 'warn' && /ostensibly|scrutinise|ramification|corroborate|conjecture/i.test(bad.detail), `${good.status}/${bad.status}: ${bad.detail}`);
    } });
  add({ id: 'S35.rule_spoilers', section: 35, title: 'Kontrolle (Claude): Pre-Task nimmt keine Antwort vorweg', kind: 'rule', ruleId: 'pretask.no_spoilers' });
  add({ id: 'S35.rule_solvable', section: 35, title: 'Kontrolle (Claude): Pre-Task ist ohne das Material lösbar', kind: 'rule', ruleId: 'pretask.solvable_before' });
  add({ id: 'S35.rule_social_fits', section: 35, title: 'Kontrolle (Claude): Sozialform und Arbeitsweise passen zur Aufgabe', kind: 'rule', ruleId: 'pretask.social_fits' });
  add({ id: 'S35.rule_confrontation', section: 35, title: 'Kontrolle (Claude): Konfrontationsaufgabe konfrontiert wirklich', kind: 'rule', ruleId: 'pretask.confrontation' });

  add({ id: 'S35.presets', section: 35, title: 'Schnellwahl: typische Pre-Task-Folgen mit einem Klick (Aufgabentypen, Sozialformen, Zeit, Anforderungsniveau)', kind: 'ui', selector: '#pre-task-presets',
    extra(env) {
      const list = env.core.TASK_PRESETS['pre'] || [];
      if (list.length < 4) return 'too few ready-made sequences';
      for (const preset of list) {
        if (!env.hasControl(`[data-task-preset="${preset.key}"]`)) return 'no chip for ' + preset.key;
        if (!preset.label || !preset.hint) return preset.key + ' has no label or hint';
        const s = env.core.applyTaskPreset(preState(env, {}), 'pre', preset.key);
        if (preset.key === 'off') {
          if (s.preTask || env.core.activeTaskPreset(s, 'pre') !== 'off') return 'the off chip does not switch the phase off';
          continue;
        }
        const plan = env.core.buildPlan(s, env.ctx).preTask;
        const errs = env.core.validateState(s, env.ctx).filter(e => e.key.toLowerCase().includes('pretask'));
        if (!plan || !plan.count || !plan.minutes) return preset.key + ' does not produce a complete plan';
        if (errs.length) return preset.key + ' produces an invalid state: ' + errs[0].message;
        if (plan.tasks.some(t => t.mode === 'oral' && t.socialForm === 'single')) return preset.key + ' puts an oral task into individual work';
        if (env.core.activeTaskPreset(s, 'pre') !== preset.key) return preset.key + ' is not recognised as the active sequence';
      }
      return ok(true);
    } });
  add({ id: 'S35.preview', section: 35, title: 'Vorschau im Creator: geplante Abfolge mit Sozialform, Arbeitsweise und Minuten, Probleme schon vor dem Generieren', kind: 'ui', selector: '#pre-task-preview',
    extra(env) {
      const src = env.uiSource || '';
      const wired = !src || (/function renderTaskPreview/.test(src) && /core\.buildTaskPlan\(s, phase\)/.test(src)
        && /for \(const phase of \['pre', 'post'\]\) renderTaskPreview\(phase\)/.test(src) && /activeTaskPreset/.test(src));
      const s = env.core.applyTaskPreset(preState(env, {}), 'pre', (env.core.TASK_PRESETS['pre'].find(x => x.key !== 'off') || {}).key);
      const plan = env.core.buildTaskPlan(s, 'pre');
      return ok(wired && plan && plan.tasks.every(t => t.socialForm && t.mode && t.minutes), 'the section does not show what will be produced');
    } });
  add({ id: 'S35.simple_access', section: 35, title: 'Auch im Simple Mode bedienbar: Schnellwahl und Vorschau stehen ausserhalb der Advanced-Steuerelemente', kind: 'function',
    check(env) {
      const head = env.controls.taskExtras('pre');
      const fromSection = env.controls.headExtras(7);
      const form = env.controls.renderForm();
      const section = form.slice(form.indexOf('id="sec-pretask"'), form.indexOf('id="sec-pretask"') + 4000);
      const beforeControls = section.indexOf('task-head') < section.indexOf('class="ctl"');
      return ok(head === fromSection && !/class="ctl"/.test(head) && /data-task-preset/.test(head) && /task-preview/.test(head) && beforeControls,
        'the quick choice is inside the advanced controls or does not open the section');
    } });
  add({ id: 'S35.repair', section: 35, title: 'Beanstandete Pre-Task wird gezielt neu erstellt, die Fragen bleiben unverändert', kind: 'function',
    check(env) {
      const m = env.fixture.material({ preTask: true }, 'listening');
      const f = preFind(env, 'pretask.criteria', {}, (pre) => { pre[0].criteria = []; });
      const rp = env.quality.repairPlan([f], 'all');
      const prompt = env.prompts.buildPreTaskRepairPrompt(m.settings, m.plan, m.content, m.worksheet, [f], '');
      const patched = env.quality.applyPreTaskPatch(m.worksheet, { preTasks: [Object.assign({}, m.worksheet.preTasks[0], { prompt: 'Replaced pre-task prompt.' }), m.worksheet.preTasks[1]] });
      const src = env.pipelineSource || '';
      const wired = !src || (/buildTaskRepairPrompt/.test(src) && /applyTaskPatch/.test(src) && /target: phase \+ 'task'/.test(src));
      return ok(rp.preTasks.length === 1 && rp.questions.length === 0 && rp.worksheet.length === 0
        && /The comprehension questions stay exactly as they are/.test(prompt) && /Pre-task \(before listening\)/.test(prompt)
        && patched.questions === m.worksheet.questions && patched.preTasks[0].prompt === 'Replaced pre-task prompt.'
        && deepEq(env.quality.changedPreTasks(m.worksheet, patched), [1]) && wired, 'targeted pre-task repair incomplete');
    } });
  add({ id: 'S35.output', section: 35, title: 'Sozialform, Arbeitsweise, Zeit und Kriterien stehen auf dem Arbeitsblatt (Bildschirm, Word, Markdown); Lehrerversion mit Pre-Task-Übersicht', kind: 'render',
    check(env) {
      const m = env.fixture.material({ preTask: true }, 'listening');
      const st = env.render.renderStudentHTML(m);
      const t = env.render.renderTeacherHTML(m);
      const md = env.render.renderMarkdown(m);
      const ds = docText(env, m, 'student');
      const dt = docText(env, m, 'teacher');
      const note = m.worksheet.preTasks[0].teacherNote;
      return ok(/Partnerarbeit/.test(st) && /mündlich/.test(st) && /4 min/.test(st) && /Success criteria/.test(st)
        && /Partnerarbeit/.test(md) && /Partnerarbeit/.test(ds) && /Success criteria/.test(ds)
        && t.includes(env.render.esc(note)) && /Sozialform/.test(dt) && dt.includes(note), 'pre-task details missing in an output');
    } });


  /* §36 Post-Task: dieselbe Mechanik nach dem Hören/Lesen (Auftragserweiterung) */
  const postState = (env, over) => env.state(Object.assign({ createWorksheet: true, postTask: true }, over || {}));
  const postPlan = (env, over) => env.core.buildPlan(postState(env, over), env.ctx);
  const postPrompt = (env, over) => { const s = postState(env, over); return env.prompts.buildQuestionPrompt(s, env.core.buildPlan(s, env.ctx), env.fixture.content()); };
  const postFind = (env, id, over, mutate) => {
    const m = env.fixture.material(Object.assign({ postTask: true }, over || {}), 'listening');
    if (mutate) mutate(m.worksheet.postTasks, m);
    return env.quality.runDeterministic(m.settings, m.plan, m.content, m.worksheet).find(f => f.id === id);
  };

  add({ id: 'S36.section', section: 36, title: 'Eigener Creator-Bereich „Post-Task“', kind: 'ui', selector: '#sec-posttask[data-step="8"]' });
  add({ id: 'S36.toggle', section: 36, title: 'Post-Task erstellen (Aufgaben nach dem Hören/Lesen)', kind: 'setting', key: 'postTask', alt: true,
    extra(env) {
      const on = postPrompt(env, {}), off = env.prompts.buildQuestionPrompt(env.state({}), env.core.buildPlan(env.state({}), env.ctx), env.fixture.content());
      return ok(/## Post-task \(after listening\)/.test(on) && /"postTasks" is an empty array/.test(off) && /"postTasks": \[\.\.\.\]/.test(on), 'post-task block missing in the question prompt');
    } });
  add({ id: 'S36.focus', section: 36, title: 'Post-Task um den Inhalt, ums Vokabular oder um beides', kind: 'setting', key: 'postTaskFocus', alt: 'vocabulary', given: { postTask: true },
    extra(env) {
      const c = postPrompt(env, { postTaskFocus: 'content' }), v = postPrompt(env, { postTaskFocus: 'vocabulary' });
      return ok(/the content is taken further, not repeated/.test(c) && /use those words productively/.test(v));
    } });
  add({ id: 'S36.count', section: 36, title: 'Anzahl der Post-Task-Aufgaben einstellbar', kind: 'setting', key: 'postTaskCount', alt: 5, given: { postTask: true },
    extra(env) {
      const p = postPlan(env, { postTaskCount: 5 });
      return ok(p.postTask.count === 5 && p.postTask.tasks.every((t, i) => t.n === i + 1) && /exactly 5 post-task/.test(postPrompt(env, { postTaskCount: 5 })));
    } });
  add({ id: 'S36.types', section: 36, title: 'Aufgabentypen: Diskussion, Debatte, Rollenspiel, Transfer, Sprachmittlung, Stellungnahme, kreatives Produkt, Wortschatz, Recherche, Partnerfeedback', kind: 'setting', key: 'postTaskTypes', alt: ['debate'], given: { postTask: true },
    extra(env) {
      const keys = env.core.POST_TASK_TYPE_KEYS;
      const complete = ['discussion', 'debate', 'roleplay', 'transfer', 'mediation', 'opinion', 'creative', 'vocabulary', 'research', 'peerfeedback'].every(k => keys.includes(k));
      const defined = env.core.POST_TASK_TYPES.every(t => t.definition && t.definition.length > 40);
      const mix = postPlan(env, { postTaskCount: 4, postTaskTypes: ['debate', 'creative'] }).postTask.typeMix;
      return ok(complete && defined && mix.debate === 2 && mix.creative === 2, 'types incomplete or not distributed');
    } });
  add({ id: 'S36.social_mode', section: 36, title: 'Sozialformen automatisch verteilen oder selbst festlegen', kind: 'setting', key: 'postTaskSocialMode', alt: 'custom',
    given: { postTask: true, customPostTaskSocial: { single: 0, pair: 0, group: 1, plenary: 1 } },
    extra(env) {
      const auto = postPlan(env, {}).postTask.socialMix;
      const own = postPlan(env, { postTaskSocialMode: 'custom', customPostTaskSocial: { single: 0, pair: 0, group: 1, plenary: 1 } }).postTask.socialMix;
      return ok(!deepEq(auto, own) && (own.group || 0) === 1 && (own.plenary || 0) === 1, 'the own mix does not reach the plan');
    } });
  add({ id: 'S36.social_custom', section: 36, title: 'Wie viele Einzel-, Partner-, Gruppen- und Plenumsarbeiten', kind: 'setting', key: 'customPostTaskSocial', alt: { single: 0, pair: 0, group: 1, plenary: 1 }, given: { postTask: true, postTaskSocialMode: 'custom' },
    extra(env) {
      const forms = postPlan(env, { postTaskSocialMode: 'custom', customPostTaskSocial: { single: 0, pair: 2, group: 0, plenary: 0 } }).postTask.tasks.map(t => t.socialForm);
      return ok(forms.every(f => f === 'pair'), forms.join(','));
    } });
  add({ id: 'S36.oral', section: 36, title: 'Wie viele Aufgaben mündlich gelöst werden (nur mit interaktiver Sozialform)', kind: 'setting', key: 'postTaskOralCount', alt: 2, given: { postTask: true },
    extra(env) {
      const tasks = postPlan(env, { postTaskCount: 3, postTaskOralCount: 2 }).postTask.tasks;
      const oral = tasks.filter(t => t.mode === 'oral');
      const errs = env.core.validateState(postState(env, { postTaskCount: 2, postTaskOralCount: 2, postTaskSocialMode: 'custom', customPostTaskSocial: { single: 2, pair: 0, group: 0, plenary: 0 } }), env.ctx).map(e => e.key);
      return ok(oral.length === 2 && oral.every(t => t.socialForm !== 'single') && errs.includes('postTaskOralCount'), 'oral tasks not planned or not guarded');
    } });
  add({ id: 'S36.difficulty', section: 36, title: 'Kriterienorientiertes Anforderungsniveau (wiedergeben bis eigenes Produkt und Kritik)', kind: 'setting', key: 'postTaskDifficulty', alt: 95, given: { postTask: true },
    extra(env) { return ok(/reproduce and organise/.test(postPrompt(env, { postTaskDifficulty: 0 })) && /evaluate and create freely/.test(postPrompt(env, { postTaskDifficulty: 100 }))); } });
  add({ id: 'S36.scaffolding', section: 36, title: 'Hilfestellungen (Beispiel, Wortspeicher, Satzanfänge, Musterlösung)', kind: 'setting', key: 'postTaskScaffolding', alt: 95, given: { postTask: true },
    extra(env) { return ok(/none — the bare task/.test(postPrompt(env, { postTaskScaffolding: 0 })) && /word bank, sentence starters, a model answer/.test(postPrompt(env, { postTaskScaffolding: 100 }))); } });
  add({ id: 'S36.level', section: 36, title: 'Sprachniveau der Aufgabenstellung (wie die Fragen, Niveau A oder B)', kind: 'setting', key: 'postTaskLevel', alt: 'A', given: { postTask: true },
    extra(env) { return ok(postPlan(env, { postTaskLevel: 'A' }).postTask.band === 'B1.2' && postPlan(env, { postTaskLevel: 'B' }).postTask.band === 'B1.1'); } });
  add({ id: 'S36.criteria', section: 36, title: 'Gelingenskriterien pro Aufgabe, auf dem Arbeitsblatt ausgewiesen', kind: 'setting', key: 'postTaskCriteria', alt: false, given: { postTask: true },
    extra(env) {
      const m = env.fixture.material({ postTask: true }, 'listening');
      const st = env.render.renderStudentHTML(m);
      const crit = m.worksheet.postTasks[0].criteria[0];
      return ok(/"criteria" is an empty array/.test(postPrompt(env, { postTaskCriteria: false })) && st.includes(env.render.esc(crit)) && docText(env, m, 'student').includes(crit), 'success criteria missing in prompt or output');
    } });
  add({ id: 'S36.minutes', section: 36, title: 'Zeitbudget der Post-Task, auf die Aufgaben verteilt', kind: 'setting', key: 'postTaskMinutes', alt: 40, given: { postTask: true },
    extra(env) {
      const tasks = postPlan(env, { postTaskCount: 3, postTaskMinutes: 21 }).postTask.tasks;
      return ok(tasks.reduce((a, t) => a + t.minutes, 0) === 21 && /total 21 minutes/.test(postPrompt(env, { postTaskCount: 3, postTaskMinutes: 21 })));
    } });
  add({ id: 'S36.shared_planner', section: 36, title: 'Pre- und Post-Task werden von derselben geprüften Mechanik geplant (Typ, Sozialform, Arbeitsweise, Zeit pro Position)', kind: 'function',
    check(env) {
      const s = postState(env, { preTask: true, preTaskCount: 3, postTaskCount: 3, postTaskOralCount: 2, preTaskOralCount: 2 });
      const plan = env.core.buildPlan(s, env.ctx);
      const both = [plan.preTask, plan.postTask];
      const shaped = both.every(p => p && p.tasks.length === 3 && p.tasks.every(t => t.n && t.type && t.socialForm && t.mode && t.minutes)
        && p.tasks.filter(t => t.mode === 'oral').length === 2 && p.tasks.filter(t => t.mode === 'oral').every(t => t.socialForm !== 'single'));
      const generic = typeof env.core.buildTaskPlan === 'function' && typeof env.core.taskSequence === 'function'
        && deepEq(env.core.buildTaskPlan(s, 'post'), plan.postTask) && deepEq(env.core.buildTaskPlan(s, 'pre'), plan.preTask);
      const rules = ['present', 'social_forms', 'modes', 'focus', 'criteria', 'time', 'language'].every(id => env.quality.RULES.some(r => r.id === 'posttask.' + id) && env.quality.RULES.some(r => r.id === 'pretask.' + id));
      return ok(shaped && generic && rules, 'the two phases are not planned and checked by the same code');
    } });

  /* Kontrollen */
  add({ id: 'S36.rule_present', section: 36, title: 'Kontrolle: Anzahl und Typen der Post-Task-Aufgaben stimmen', kind: 'rule', ruleId: 'posttask.present',
    extra(env) {
      const good = postFind(env, 'posttask.present');
      const bad = postFind(env, 'posttask.present', {}, (t) => t.pop());
      const wrongType = postFind(env, 'posttask.present', {}, (t) => { t[0].type = 'debate'; });
      return ok(good.status === 'pass' && bad.status === 'fail' && wrongType.status === 'fail', `${good.status}/${bad.status}/${wrongType.status}`);
    } });
  add({ id: 'S36.rule_social', section: 36, title: 'Kontrolle: Sozialformen entsprechen den Einstellungen', kind: 'rule', ruleId: 'posttask.social_forms',
    extra(env) {
      const good = postFind(env, 'posttask.social_forms');
      const bad = postFind(env, 'posttask.social_forms', {}, (t) => { t[0].socialForm = 'group'; });
      return ok(good.status === 'pass' && bad.status === 'fail' && bad.postTasks.includes(1), `${good.status}/${bad.status}`);
    } });
  add({ id: 'S36.rule_modes', section: 36, title: 'Kontrolle: mündliche und schriftliche Aufgaben wie eingestellt, mündlich nie in Einzelarbeit', kind: 'rule', ruleId: 'posttask.modes',
    extra(env) {
      const good = postFind(env, 'posttask.modes');
      const bad = postFind(env, 'posttask.modes', {}, (t) => { t[0].mode = 'written'; });
      const lonely = postFind(env, 'posttask.modes', {}, (t) => { t[0].mode = 'written'; t[1].mode = 'oral'; });
      return ok(good.status === 'pass' && bad.status === 'fail' && lonely.status !== 'pass', `${good.status}/${bad.status}/${lonely.status}`);
    } });
  add({ id: 'S36.rule_focus', section: 36, title: 'Kontrolle: Inhalt weitergedacht, Zielvokabular produktiv verwendet', kind: 'rule', ruleId: 'posttask.focus',
    extra(env) {
      const good = postFind(env, 'posttask.focus');
      const bad = postFind(env, 'posttask.focus', {}, (t) => { t.forEach(x => { x.prompt = 'Do something.'; x.items = []; x.vocabUsed = []; x.type = 'creative'; }); });
      return ok(good.status === 'pass' && bad.status === 'warn', `${good.status}/${bad.status}`);
    } });
  add({ id: 'S36.rule_criteria', section: 36, title: 'Kontrolle: Gelingenskriterien vorhanden und kurz', kind: 'rule', ruleId: 'posttask.criteria',
    extra(env) {
      const good = postFind(env, 'posttask.criteria');
      const bad = postFind(env, 'posttask.criteria', {}, (t) => { t[0].criteria = []; });
      const off = postFind(env, 'posttask.criteria', { postTaskCriteria: false }, (t) => { t[0].criteria = []; });
      return ok(good.status === 'pass' && bad.status === 'fail' && off.status === 'pass', `${good.status}/${bad.status}/${off.status}`);
    } });
  add({ id: 'S36.rule_time', section: 36, title: 'Kontrolle: Zeitangaben vorhanden und im Budget', kind: 'rule', ruleId: 'posttask.time',
    extra(env) {
      const good = postFind(env, 'posttask.time');
      const bad = postFind(env, 'posttask.time', {}, (t) => { t[0].minutes = 60; });
      return ok(good.status === 'pass' && bad.status === 'warn', `${good.status}/${bad.status}`);
    } });
  add({ id: 'S36.rule_language', section: 36, title: 'Kontrolle: Aufgabenstellung bleibt auf dem eingestellten Sprachniveau', kind: 'rule', ruleId: 'posttask.language',
    extra(env) {
      const good = postFind(env, 'posttask.language');
      const bad = postFind(env, 'posttask.language', {}, (t) => { t[0].prompt = 'Scrutinise the ostensibly innocuous ramifications and corroborate your conjecture.'; });
      return ok(good.status === 'pass' && bad.status === 'warn', `${good.status}/${bad.status}`);
    } });
  add({ id: 'S36.rule_product', section: 36, title: 'Kontrolle: jede Aufgabe nennt ihren Ansatzpunkt im Material und ihr Produkt', kind: 'rule', ruleId: 'posttask.product',
    extra(env) {
      const good = postFind(env, 'posttask.product');
      const noProduct = postFind(env, 'posttask.product', {}, (t) => { t[0].product = ''; });
      const noRef = postFind(env, 'posttask.product', {}, (t) => { t[0].reference = ''; });
      return ok(good.status === 'pass' && noProduct.status === 'fail' && noRef.status === 'warn', `${good.status}/${noProduct.status}/${noRef.status}`);
    } });
  add({ id: 'S36.rule_uses_material', section: 36, title: 'Kontrolle (Claude): Post-Task setzt am Material an', kind: 'rule', ruleId: 'posttask.uses_material' });
  add({ id: 'S36.rule_beyond', section: 36, title: 'Kontrolle (Claude): Post-Task geht über die Verständnisfragen hinaus', kind: 'rule', ruleId: 'posttask.beyond_questions' });
  add({ id: 'S36.rule_social_fits', section: 36, title: 'Kontrolle (Claude): Sozialform und Arbeitsweise passen zur Aufgabe', kind: 'rule', ruleId: 'posttask.social_fits' });
  add({ id: 'S36.rule_mediation', section: 36, title: 'Kontrolle (Claude): Sprachmittlung nennt Adressat und Zweck', kind: 'rule', ruleId: 'posttask.mediation',
    extra(env) {
      const withMed = env.core.buildPlan(postState(env, { postTaskTypes: ['mediation'] }), env.ctx);
      const without = env.core.buildPlan(postState(env, { postTaskTypes: ['discussion'] }), env.ctx);
      const ws = env.fixture.material({ postTask: true }).worksheet;
      const on = env.quality.applicableRules(postState(env, { postTaskTypes: ['mediation'] }), withMed, ws).some(r => r.id === 'posttask.mediation');
      const off = env.quality.applicableRules(postState(env, { postTaskTypes: ['discussion'] }), without, ws).some(r => r.id === 'posttask.mediation');
      return ok(on && !off, 'the mediation check does not follow the chosen types');
    } });

  add({ id: 'S36.presets', section: 36, title: 'Schnellwahl: typische Post-Task-Folgen mit einem Klick (Aufgabentypen, Sozialformen, Zeit, Anforderungsniveau)', kind: 'ui', selector: '#post-task-presets',
    extra(env) {
      const list = env.core.TASK_PRESETS['post'] || [];
      if (list.length < 4) return 'too few ready-made sequences';
      for (const preset of list) {
        if (!env.hasControl(`[data-task-preset="${preset.key}"]`)) return 'no chip for ' + preset.key;
        if (!preset.label || !preset.hint) return preset.key + ' has no label or hint';
        const s = env.core.applyTaskPreset(postState(env, {}), 'post', preset.key);
        if (preset.key === 'off') {
          if (s.postTask || env.core.activeTaskPreset(s, 'post') !== 'off') return 'the off chip does not switch the phase off';
          continue;
        }
        const plan = env.core.buildPlan(s, env.ctx).postTask;
        const errs = env.core.validateState(s, env.ctx).filter(e => e.key.toLowerCase().includes('posttask'));
        if (!plan || !plan.count || !plan.minutes) return preset.key + ' does not produce a complete plan';
        if (errs.length) return preset.key + ' produces an invalid state: ' + errs[0].message;
        if (plan.tasks.some(t => t.mode === 'oral' && t.socialForm === 'single')) return preset.key + ' puts an oral task into individual work';
        if (env.core.activeTaskPreset(s, 'post') !== preset.key) return preset.key + ' is not recognised as the active sequence';
      }
      return ok(true);
    } });
  add({ id: 'S36.preview', section: 36, title: 'Vorschau im Creator: geplante Abfolge mit Sozialform, Arbeitsweise und Minuten, Probleme schon vor dem Generieren', kind: 'ui', selector: '#post-task-preview',
    extra(env) {
      const src = env.uiSource || '';
      const wired = !src || (/function renderTaskPreview/.test(src) && /core\.buildTaskPlan\(s, phase\)/.test(src)
        && /for \(const phase of \['pre', 'post'\]\) renderTaskPreview\(phase\)/.test(src) && /activeTaskPreset/.test(src));
      const s = env.core.applyTaskPreset(postState(env, {}), 'post', (env.core.TASK_PRESETS['post'].find(x => x.key !== 'off') || {}).key);
      const plan = env.core.buildTaskPlan(s, 'post');
      return ok(wired && plan && plan.tasks.every(t => t.socialForm && t.mode && t.minutes), 'the section does not show what will be produced');
    } });
  add({ id: 'S36.simple_access', section: 36, title: 'Auch im Simple Mode bedienbar: Schnellwahl und Vorschau stehen ausserhalb der Advanced-Steuerelemente', kind: 'function',
    check(env) {
      const head = env.controls.taskExtras('post');
      const fromSection = env.controls.headExtras(8);
      const form = env.controls.renderForm();
      const section = form.slice(form.indexOf('id="sec-posttask"'), form.indexOf('id="sec-posttask"') + 4000);
      const beforeControls = section.indexOf('task-head') < section.indexOf('class="ctl"');
      return ok(head === fromSection && !/class="ctl"/.test(head) && /data-task-preset/.test(head) && /task-preview/.test(head) && beforeControls,
        'the quick choice is inside the advanced controls or does not open the section');
    } });
  add({ id: 'S36.repair', section: 36, title: 'Beanstandete Post-Task wird gezielt neu erstellt, Fragen und Pre-Task bleiben unverändert', kind: 'function',
    check(env) {
      const m = env.fixture.material({ preTask: true, postTask: true }, 'listening');
      const f = postFind(env, 'posttask.criteria', {}, (t) => { t[0].criteria = []; });
      const rp = env.quality.repairPlan([f], 'all');
      const prompt = env.prompts.buildPostTaskRepairPrompt(m.settings, m.plan, m.content, m.worksheet, [f], '');
      const patched = env.quality.applyPostTaskPatch(m.worksheet, { postTasks: [Object.assign({}, m.worksheet.postTasks[0], { prompt: 'Replaced post-task prompt.' }), m.worksheet.postTasks[1]] });
      const src = env.pipelineSource || '';
      const wired = !src || (/buildTaskRepairPrompt/.test(src) && /applyTaskPatch/.test(src) && /target: phase \+ 'task'/.test(src) && /'pre', 'post'/.test(src));
      return ok(rp.postTasks.length === 1 && rp.questions.length === 0 && rp.worksheet.length === 0 && rp.preTasks.length === 0
        && /must not simply repeat them/.test(prompt) && /## Post-task \(after listening\)/.test(prompt)
        && patched.questions === m.worksheet.questions && patched.preTasks === m.worksheet.preTasks
        && patched.postTasks[0].prompt === 'Replaced post-task prompt.' && deepEq(env.quality.changedPostTasks(m.worksheet, patched), [1]) && wired, 'targeted post-task repair incomplete');
    } });
  add({ id: 'S36.output', section: 36, title: 'Post-Task steht nach den Fragen auf dem Arbeitsblatt (Bildschirm, Word, Markdown) mit Sozialform, Arbeitsweise, Zeit, Produkt und Kriterien; Lehrerversion mit Übersicht', kind: 'render',
    check(env) {
      const m = env.fixture.material({ postTask: true }, 'listening');
      const st = env.render.renderStudentHTML(m);
      const t = env.render.renderTeacherHTML(m);
      const md = env.render.renderMarkdown(m);
      const ds = docText(env, m, 'student');
      const dt = docText(env, m, 'teacher');
      const post = m.worksheet.postTasks[0];
      return ok(st.indexOf('Questions') < st.indexOf('After you listen') && /Diskussion/.test(st) && /Partnerarbeit/.test(st) && /Result:/.test(st) && st.includes(env.render.esc(post.criteria[0]))
        && /## After you listen/.test(md) && /After you listen/.test(ds) && ds.includes(post.product)
        && /Post-Task/.test(dt) && dt.includes(post.reference) && t.includes(env.render.esc(post.reference)), 'post-task details missing in an output');
    } });


  /* §37 Authentisches Layout: der Text als Screenshot seines Mediums (Auftragserweiterung) */
  const layoutState = (env, over) => env.state(Object.assign({ kind: 'reading', authenticLayout: true }, over || {}));
  const layoutMaterial = (env, over) => env.fixture.material(Object.assign({ authenticLayout: true }, over || {}), 'reading');
  const layoutFind = (env, id, over, mutate) => {
    const m = layoutMaterial(env, over);
    if (mutate) mutate(m.layout.chrome, m);
    return env.quality.runContentChecks(m.settings, m.plan, m.content, { layout: m.layout }).find(f => f.id === id);
  };

  add({ id: 'S37.toggle', section: 37, title: 'Schalter „Text im echten Layout zeigen“ – standardmässig an, nur für Reading', kind: 'setting', key: 'authenticLayout', alt: false, mode: 'reading',
    extra(env) {
      const on = env.core.buildPlan(layoutState(env, {}), env.ctx).authenticLayout;
      const listening = env.core.buildPlan(env.state({ kind: 'listening' }), env.ctx).authenticLayout;
      return ok(env.core.SCHEMA_BY_KEY.authenticLayout.default === true && on === true && listening === false, 'the switch is not on by default or applies to listening');
    } });
  add({ id: 'S37.medium', section: 37, title: 'Medium wählbar: Screenshot oder abfotografierte Seite (automatisch passend zur Textsorte)', kind: 'setting', key: 'layoutMedium', alt: 'paper', mode: 'reading', promptSensitive: false,
    extra(env) {
      const paperTypes = ['News Article', 'Article', 'Story', 'Diary Entry', 'Report'];
      for (const type of paperTypes) {
        const d = env.mock.layoutFor(env.fixture.material({ textType: type, authenticLayout: true }, 'reading'));
        if (d.medium !== 'paper') return type + ' is not shown on paper by default';
      }
      const screen = env.mock.layoutFor(env.fixture.material({ textType: 'Blog Post', authenticLayout: true }, 'reading'));
      const forcedPaper = env.mock.layoutFor(env.fixture.material({ textType: 'Blog Post', layoutMedium: 'paper' }, 'reading'));
      const forcedScreen = env.mock.layoutFor(env.fixture.material({ textType: 'News Article', layoutMedium: 'screen' }, 'reading'));
      const kinds = new Set(env.core.TEXT_TYPES.map(t => env.mock.layoutFor(env.fixture.material({ textType: t, layoutMedium: 'paper' }, 'reading')).print.kind));
      const src = env.uiSource || '';
      const switchable = !src || /data-layout-medium/.test(src);
      return ok(screen.medium === 'screen' && forcedPaper.medium === 'paper' && forcedScreen.medium === 'screen'
        && kinds.has('press') && kinds.has('book') && kinds.has('notebook') && kinds.has('sheet') && switchable,
        'the medium cannot be chosen or printed media are missing');
    } });
  add({ id: 'S37.always', section: 37, title: 'Es entsteht immer ein Bild: die Angaben des Materials tragen es, Claude reichert nur an', kind: 'function',
    check(env) {
      for (const type of env.core.TEXT_TYPES) {
        const m = env.fixture.material({ textType: type, authenticLayout: true }, 'reading');
        const bare = { chrome: env.mock.fallbackChrome(m) };
        const model = env.mock.buildModel(m, bare.chrome);
        const problems = env.mock.validate(model);
        if (problems.length) return type + ' without interface data: ' + problems[0];
        if (env.quality.normalizeForSearch(env.mock.bodyText(model)) !== env.quality.normalizeForSearch(m.content.paragraphs.join(' '))) return type + ': text not shown unchanged';
      }
      const merged = env.quality.mergeChrome({ siteName: 'from the material', url: 'u' }, { siteName: '', navItems: ['a'] });
      const src = env.pipelineSource || '';
      const wired = !src || (/mock\.fallbackChrome/.test(src) && /quality\.mergeChrome/.test(src) && /layout = \{ chrome: fallback/.test(src));
      return ok(merged.siteName === 'from the material' && merged.navItems.length === 1 && wired,
        'the picture depends on the Claude call or the merge drops what the material knows');
    } });
  add({ id: 'S37.media', section: 37, title: 'Jeder Texttyp hat ein echtes Medium (Browserfenster, Mailprogramm, Forum, Messenger) mit eigener Oberfläche', kind: 'function',
    check(env) {
      const kinds = new Set();
      for (const type of env.core.TEXT_TYPES) {
        const m = env.fixture.material({ textType: type, authenticLayout: true }, 'reading');
        const d = env.mock.layoutFor(m);
        const spec = env.mock.chromeSpec(m);
        if (!d || !d.kind || !d.accent) return 'no medium for ' + type;
        if (!spec || !spec.fields.length || !spec.required.length) return 'no interface description for ' + type;
        kinds.add(d.kind);
      }
      return ok(kinds.has('page') && kinds.has('mail') && kinds.has('thread') && kinds.has('chat') && Object.keys(env.mock.LAYOUTS).length >= 14, [...kinds].join(','));
    } });
  add({ id: 'S37.medium_detail', section: 37, title: 'Jedes Medium ist im Detail gebaut wie das echte: Browserfenster mit Tableiste und Schloss, Blog/News mit Logo, Bild, Tags und Aktionsleiste, Mail mit Werkzeugleiste und Ordnern, Forum mit Stimmpfeilen und Antwortstufen, Messenger mit Hintergrundmuster, Sprechblasenspitzen und Häkchen', kind: 'function',
    check(env) {
      const model = (type) => env.quality.layoutModel(env.fixture.material({ textType: type, authenticLayout: true, layoutMedium: 'screen' }, 'reading'));
      const icons = (m) => new Set((m.blocks || []).filter(b => b.type === 'icon').map(b => b.name));
      const has = (m, t) => (m.blocks || []).some(b => b.type === t);
      const blog = model('Blog Post'), bi = icons(blog);
      if (!bi.has('lock') || !bi.has('plus') || !bi.has('search')) return 'the browser window has no tab strip with a padlock';
      if (!has(blog, 'photo')) return 'the blog post has no picture';
      if (!['heart', 'comment', 'share', 'bookmark'].every(n => bi.has(n))) return 'the action bar has no icons';
      const mail = icons(model('Email'));
      if (!['inbox', 'trash', 'reply', 'star'].every(n => mail.has(n))) return 'the mail program has no toolbar and no folder icons';
      const forum = model('Forum Discussion'), fi = icons(forum);
      if (!fi.has('up') || !fi.has('down')) return 'the forum has no vote arrows';
      if (!(forum.blocks || []).some(b => b.type === 'line' && b.x1 === b.x2)) return 'the forum shows no reply levels';
      const chat = model('Dialogue'), ci = icons(chat);
      if (!has(chat, 'wallpaper')) return 'the messenger has no wallpaper';
      if (!has(chat, 'poly')) return 'the bubbles have no tails';
      if (!['phone', 'video', 'dots', 'mic', 'camera', 'clip', 'ticks'].every(n => ci.has(n))) return 'the messenger has no app icons';
      return ok(Object.keys(env.mock.ICONS).length >= 20, 'too few interface icons');
    } });
  add({ id: 'S37.print_detail', section: 37, title: 'Gedruckte Medien sehen fotografiert aus: Zeitungsseite im Blocksatz mit Spalten, Bild und Legende, Buchseite mit Initial und Bundschatten, Heftseite mit Lineatur, Randlinie und Lochung, Blatt mit Briefkopf', kind: 'function',
    check(env) {
      const model = (type) => env.quality.layoutModel(env.fixture.material({ textType: type, authenticLayout: true, layoutMedium: 'paper' }, 'reading'));
      const words = (m) => (m.blocks || []).filter(b => b.type === 'text' && b.role === 'body' && !/\s/.test(b.text)).length;
      const press = model('News Article');
      if (!press.finish || !press.finish.grain || !press.finish.page) return 'the newspaper page is not photographed';
      if (!(press.blocks || []).some(b => b.type === 'photo')) return 'the newspaper has no press photo';
      if (words(press) < 20) return 'the newspaper columns are not justified';
      const book = model('Story');
      if (!book.finish || !book.finish.gutter) return 'the book page has no binding shadow';
      if (words(book) < 20) return 'the book page is not justified';
      const note = model('Diary Entry');
      if ((note.blocks || []).filter(b => b.type === 'line').length < 10) return 'the notebook has no ruling';
      if ((note.blocks || []).filter(b => b.type === 'circle').length < 3) return 'the notebook has no punched holes';
      const sheet = model('Report');
      if (!(sheet.blocks || []).some(b => b.type === 'line' && b.width === 3)) return 'the printed sheet has no staple';
      return ok(true);
    } });
  add({ id: 'S37.prompt', section: 37, title: 'Claude gestaltet die Oberfläche (Adresse, Seitenname, Navigation, Buttons, Zahlen) – ohne den Text zu verändern', kind: 'function',
    check(env) {
      const s = layoutState(env, { textType: 'Blog Post' });
      const m = env.fixture.material({ textType: 'Blog Post', authenticLayout: true }, 'reading');
      const spec = env.mock.chromeSpec(m);
      const p = env.prompts.buildLayoutPrompt(s, env.core.buildPlan(s, env.ctx), m.content, spec);
      const mail = env.state({ kind: 'reading', textType: 'Email', authenticLayout: true });
      const pm = env.prompts.buildLayoutPrompt(mail, env.core.buildPlan(mail, env.ctx), env.fixture.content('reading'), env.mock.chromeSpec({ settings: mail, content: env.fixture.content('reading') }));
      const rep = env.prompts.buildLayoutRepairPrompt(s, env.core.buildPlan(s, env.ctx), m.content, m.layout.chrome, [{ status: 'fail', title: 'x', detail: 'y' }], spec);
      return ok(/Do NOT repeat, summarise or continue the text/.test(p) && /"url"/.test(p) && /"actions"/.test(p) && /Blog post/.test(p)
        && /"appName"/.test(pm) && /Mail client/.test(pm) && !/"url"/.test(pm)
        && /What is wrong with it/.test(rep) && /Your previous version/.test(rep), 'the layout prompt is not type-specific or allows rewriting');
    } });
  add({ id: 'S37.image', section: 37, title: 'Die App zeichnet daraus ein echtes Bild – für jeden Texttyp gültig und mit dem Text Wort für Wort', kind: 'function',
    check(env) {
      for (const type of env.core.TEXT_TYPES) {
        const m = env.fixture.material({ textType: type, authenticLayout: true }, 'reading');
        const model = env.quality.layoutModel(m);
        const problems = env.mock.validate(model);
        if (problems.length) return type + ': ' + problems[0];
        const shown = env.quality.normalizeForSearch(env.mock.bodyText(model));
        const source = env.quality.normalizeForSearch(m.content.paragraphs.join(' '));
        if (shown !== source) return type + ': the picture does not show the text unchanged';
        if (!(model.width > 400) || !(model.height > 300)) return type + ': implausible size';
      }
      return ok(true);
    } });
  add({ id: 'S37.download', section: 37, title: 'Eigener Tab „Layout“ mit Bild und PNG-Download, der vor der Ausgabe geprüft wird', kind: 'ui', selector: '#tab-layout',
    extra(env) {
      const src = env.uiSource || '';
      const wired = !src || (/function renderLayout/.test(src) && /mock\.draw\(/.test(src) && /canvas\.toBlob/.test(src) && /kind === 'png'/.test(src) && /mock\.validate\(model\)/.test(src));
      return ok(wired && env.hasControl('#out-layout'), 'the layout tab or the checked PNG download is missing');
    } });
  add({ id: 'S37.pipeline', section: 37, title: 'Das Layout entsteht im Durchlauf: Claude gestaltet, die App prüft und lässt nachbessern', kind: 'function',
    check(env) {
      const src = env.pipelineSource || '';
      const wired = !src || (/buildLayoutPrompt/.test(src) && /normalizeChrome/.test(src) && /buildLayoutRepairPrompt/.test(src) && /target: 'layout'/.test(src));
      return ok(wired, 'the layout is not generated, checked and repaired in the pipeline');
    } });
  add({ id: 'S37.rule_fields', section: 37, title: 'Kontrolle: die Oberfläche des Mediums ist vollständig', kind: 'rule', ruleId: 'layout.fields',
    extra(env) {
      const good = layoutFind(env, 'layout.fields');
      const screen = layoutFind(env, 'layout.fields', { textType: 'Blog Post' }, (c) => { c.url = ''; c.actions = []; });
      const paper = layoutFind(env, 'layout.fields', { textType: 'News Article' }, (c) => { c.publication = ''; c.photoCaption = ''; });
      return ok(good.status === 'pass' && screen.status === 'fail' && /url/.test(screen.detail)
        && paper.status === 'fail' && /publication/.test(paper.detail), `${good.status}/${screen.status}/${paper.status}`);
    } });
  add({ id: 'S37.rule_text', section: 37, title: 'Kontrolle: das Bild zeigt genau den generierten Text (Wort für Wort, nichts fehlt, nichts dazu)', kind: 'rule', ruleId: 'layout.text_identical',
    extra(env) {
      const good = layoutFind(env, 'layout.text_identical');
      const m = layoutMaterial(env, {});
      const shortened = JSON.parse(JSON.stringify(m));
      shortened.content.paragraphs = shortened.content.paragraphs.slice(0, 1);
      const model = env.quality.layoutModel(shortened);
      const full = env.quality.normalizeForSearch(m.content.paragraphs.join(' '));
      const cut = env.quality.normalizeForSearch(env.mock.bodyText(model));
      return ok(good.status === 'pass' && cut !== full && cut.length < full.length, `${good.status}; a shortened text would be noticed: ${cut !== full}`);
    } });
  add({ id: 'S37.rule_invented', section: 37, title: 'Kontrolle: die Oberfläche erzählt den Text nicht nach', kind: 'rule', ruleId: 'layout.no_invented_text',
    extra(env) {
      // the box beside the text only exists on a page layout, so check it there
      const good = layoutFind(env, 'layout.no_invented_text', { textType: 'Blog Post' });
      const m = layoutMaterial(env, { textType: 'Blog Post' });
      const bad = layoutFind(env, 'layout.no_invented_text', { textType: 'Blog Post' }, (c) => { c.sidebarItems = [m.content.paragraphs[0]]; });
      return ok(good.status === 'pass' && bad.status === 'warn', `${good.status}/${bad.status}`);
    } });
  add({ id: 'S37.rule_image', section: 37, title: 'Kontrolle: das Bild ist zeichenbar und wird nur dann ausgeliefert', kind: 'rule', ruleId: 'layout.image_valid',
    extra(env) {
      const good = layoutFind(env, 'layout.image_valid');
      const broken = env.mock.validate({ width: 10, height: 10, blocks: [{ type: 'text', x: 0, y: 900, text: 'x' }] });
      return ok(good.status === 'pass' && broken.length >= 2, `${good.status}; broken model reports ${broken.length} problems`);
    } });
  add({ id: 'S37.pictures', section: 37, title: 'Das Medium zeigt echte Bilder: Aufmacher, Porträts statt Initialen, Vorschaubilder – gezeichnet aus einem Motiv, das Claude wählt und die App prüft', kind: 'function',
    check(env) {
      const problems = [];
      const photo = env.mock;
      if (!(photo.SUBJECTS || []).length) return 'the picture engine knows no subjects';
      // the catalogue of motifs reaches Claude, and only a motif from it counts
      const m = layoutMaterial(env, { textType: 'Blog Post', layoutMedium: 'screen' });
      const spec = env.mock.chromeSpec(m);
      const prompt = env.prompts.buildLayoutPrompt(m.settings, m.plan, m.content, spec);
      for (const key of ['portrait', 'classroom', 'city']) if (!prompt.includes(key + ' —')) problems.push('the subject "' + key + '" is not offered to Claude');
      const cleaned = env.quality.normalizeChrome({ photoSubject: 'a photo of a dog', sidebarSubjects: ['sport', 'invented'] }, spec);
      if (cleaned.photoSubject) problems.push('an invented subject is passed on to the drawing');
      if (cleaned.sidebarSubjects.join() !== 'sport') problems.push('invented subjects are not filtered out of a list');
      // a picture exists even without Claude, and it fits the text
      const fallback = env.mock.fallbackChrome(m);
      if (!env.mock.isSubject(fallback.photoSubject)) problems.push('without Claude the picture has no subject');
      const school = env.mock.subjectFor('The teacher gave the class homework about the lesson at school.', 'city');
      const sport = env.mock.subjectFor('The team lost the match after a late goal in training.', 'city');
      if (school === sport) problems.push('the subject does not follow the text');
      // every medium that shows pictures really has them, and every picture can be drawn
      const counts = {};
      for (const textType of env.core.TEXT_TYPES) {
        for (const layoutMedium of ['screen', 'paper']) {
          const mm = layoutMaterial(env, { textType, layoutMedium });
          const model = env.quality.layoutModel(mm);
          const pics = model.blocks.filter(x => x.type === 'photo');
          counts[textType + '/' + layoutMedium] = pics.length;
          for (const pic of pics) if (!env.mock.isSubject(pic.subject)) problems.push(textType + '/' + layoutMedium + ': a picture without a subject');
        }
      }
      const withPictures = Object.values(counts).filter(n => n > 0).length;
      if (withPictures < 14) problems.push('only ' + withPictures + ' of ' + Object.keys(counts).length + ' pictures of a medium show anything');
      // a name gets a face, not two letters
      const blog = env.quality.layoutModel(layoutMaterial(env, { textType: 'Blog Post', layoutMedium: 'screen' }));
      if (!blog.blocks.some(x => x.type === 'photo' && x.subject === 'portrait' && x.round)) problems.push('the author has no portrait next to their name');
      return ok(!problems.length, problems.slice(0, 3).join(' | '));
    } });

  add({ id: 'S37.photo_library', section: 37, title: 'Echte Fotos, wo die App welche mitbringt: frei lizenziert, mit Bildnachweis unter dem Bild und in der Lehrerversion; Porträts erfundener Personen nur aus Stockfotos; sonst gezeichnete Szene', kind: 'function',
    check(env) {
      const photo = env.photo;
      if (!photo || !photo.useLibrary) return 'the photo library is not wired into the picture engine';
      const before = photo.library();
      const problems = [];
      try {
        // what the fetcher writes is checked again when the app loads it
        const bad = photo.useLibrary({ photos: [
          { id: 'a', subject: 'market', file: '../secret.jpg', credit: 'x', license: 'CC0' },
          { id: 'b', subject: 'invented', file: 'photos/b.jpg', credit: 'x', license: 'CC0' },
          { id: 'c', subject: 'market', file: 'photos/c.jpg', credit: '', license: 'CC0' },
          { id: 'd', subject: 'market', file: 'photos/d.jpg', credit: 'Foto: D', license: '' },
        ] });
        if (bad !== 0) problems.push('an entry without a safe file, a known subject, a credit and a licence is taken');
        photo.useLibrary({ photos: [
          { id: 'm1', subject: 'market', file: 'photos/m1.jpg', credit: 'Foto: Real Person / Pexels', license: 'Pexels License', persona: false },
          { id: 'p1', subject: 'portrait', file: 'photos/p1.jpg', credit: 'Foto: Archive / Wikimedia (CC BY 4.0)', license: 'CC BY 4.0', persona: false },
          { id: 'p2', subject: 'portrait', file: 'photos/p2.jpg', credit: 'Foto: Model / Pexels', license: 'Pexels License', persona: true },
        ] });
        const m = layoutMaterial(env, { textType: 'News Article', layoutMedium: 'paper' });
        m.layout.chrome = Object.assign({}, m.layout.chrome, { photoSubject: 'market', captionCredit: 'Invented Photographer' });
        const model = env.quality.layoutModel(m);
        const lead = model.blocks.find(x => x.type === 'photo' && x.subject === 'market');
        if (!lead || lead.photoId !== 'm1') problems.push('the lead picture does not use the photograph the app has');
        const texts = model.blocks.filter(x => x.type === 'text').map(x => x.text).join(' | ');
        if (!texts.includes('Foto: Real Person / Pexels')) problems.push('the real photograph is not credited under the picture');
        if (texts.includes('Invented Photographer')) problems.push('an invented credit stands under a real photograph');
        if (!env.render.renderTeacherHTML(m, {}).includes('Foto: Real Person / Pexels')) problems.push('the teacher version does not list the picture credits');
        // an invented person never gets the face of a real one from an archive
        const blog = env.quality.layoutModel(layoutMaterial(env, { textType: 'Blog Post', layoutMedium: 'screen' }));
        const faces = blog.blocks.filter(x => x.type === 'photo' && x.subject === 'portrait');
        if (faces.some(x => x.photoId === 'p1')) problems.push('an archive portrait of a real person stands in for an invented one');
        if (!faces.some(x => x.photoId === 'p2')) problems.push('a stock portrait is not used for an invented person');
        // without a photograph of that subject: the drawn scene, nothing breaks
        const sea = env.quality.layoutModel(layoutMaterial(env, { textType: 'Blog Post', layoutMedium: 'screen' }));
        if (env.mock.validate(sea).length) problems.push('a picture with the library in place cannot be drawn');
      } finally { photo.useLibrary({ photos: before }); }
      const src = env.uiSource || '';
      if (src && !/photo\.preload\(\)/.test(src)) problems.push('the photographs are not loaded before the picture is drawn');
      return ok(!problems.length, problems.slice(0, 3).join(' | '));
    } });

  add({ id: 'S37.modules', section: 37, title: 'Um den Text steht, was auf so einer Seite wirklich steht: Werbung, Umfrage, Meistgelesen, Anmeldekasten, Kleinanzeigen – Claude wählt aus dem Katalog und darf Eigenes ergänzen', kind: 'function',
    check(env) {
      const problems = [];
      const kinds = env.mock.MODULE_KEYS || [];
      if (kinds.length < 12) problems.push('the catalogue of things beside the text is too thin: ' + kinds.length);
      if (!kinds.includes('ad_banner') || !kinds.includes('poll') || !kinds.includes('teaser')) problems.push('the catalogue misses the obvious kinds');
      const m = layoutMaterial(env, { textType: 'Blog Post', layoutMedium: 'screen' });
      const spec = env.mock.chromeSpec(m);
      const prompt = env.prompts.buildLayoutPrompt(m.settings, m.plan, m.content, spec);
      for (const k of ['ad_banner', 'poll', 'teaser']) if (!prompt.includes(k + ' [')) problems.push('the kind "' + k + '" is not offered to Claude');
      if (!/not a fence/.test(prompt) || !/"shape"/.test(prompt)) problems.push('Claude is not told it may add kinds of its own');
      // what Claude sends comes back in one shape, and an invented kind survives
      const cleaned = env.quality.normalizeChrome({ modules: [
        { type: 'ad_banner', heading: 'x'.repeat(400), lines: 'one line', items: [{ bad: 1 }], cta: 'Go', slot: 'nowhere' },
        { type: 'Horoscope', slot: 'rail', shape: 'note', heading: 'Stars today', lines: ['Leo: say sorry.'] },
        { type: 'league table', slot: 'below', items: ['City 2 | 1 Rovers'] },
        'junk', null, 42,
      ] }, spec);
      if (cleaned.modules.length !== 3) return 'the module list is not cleaned up: ' + JSON.stringify(cleaned.modules.map(x => x.type));
      const [banner, horoscope, table] = cleaned.modules;
      if (banner.heading.length > 200 || banner.items.length) problems.push('a module is not clamped to its shape');
      if (banner.slot !== 'top') problems.push('an impossible place is not corrected');
      if (horoscope.type !== 'horoscope' || horoscope.shape !== 'note') problems.push('a kind of Claude\'s own is thrown away');
      if (env.mock.shapeOf(table) !== 'table') problems.push('the shape of an invented kind is not read off its content');
      // and they really stand in the picture, in their places, as chrome not as text
      const withMods = layoutMaterial(env, { textType: 'Blog Post', layoutMedium: 'screen' });
      withMods.layout.chrome = Object.assign({}, withMods.layout.chrome, { modules: cleaned.modules.concat([
        { type: 'sponsored', slot: 'below', heading: 'A promoted headline', lines: ['A line.'], items: [], cta: '', meta: '', subject: 'city', label: 'Brand', shape: '' },
      ]) });
      const model = env.quality.layoutModel(withMods);
      const problemsDraw = env.mock.validate(model);
      if (problemsDraw.length) problems.push('a picture with modules cannot be drawn: ' + problemsDraw[0]);
      const text = model.blocks.filter(x => x.type === 'text');
      if (!text.some(x => x.text.indexOf('Stars today') === 0)) problems.push('an invented module is not drawn');
      if (text.some(x => x.role === 'body' && /Stars today|promoted headline/.test(x.text))) problems.push('a module is drawn as if it were the text of the material');
      // the rule that watches it
      const f = layoutFind(env, 'layout.furniture', { textType: 'Blog Post', layoutMedium: 'screen' });
      const bare = layoutFind(env, 'layout.furniture', { textType: 'Blog Post', layoutMedium: 'screen' }, (c) => { c.modules = []; });
      if (!f || f.status !== 'pass') problems.push('a page full of modules does not pass the check');
      if (!bare || bare.status !== 'warn') problems.push('a page with nothing beside the text is not noticed');
      return ok(!problems.length, problems.slice(0, 3).join(' | '));
    } });

  add({ id: 'S37.rule_proportions', section: 37, title: 'Kontrolle: das Bild ist proportioniert – die Spalten tragen gleich viel, keine bleibt fast leer, und die Seite endet kurz nach dem Text', kind: 'rule', ruleId: 'layout.proportions',
    extra(env) {
      const problems = [];
      // every medium, on screen and on paper, comes out in proportion
      for (const textType of env.core.TEXT_TYPES) {
        for (const layoutMedium of ['screen', 'paper']) {
          const f = layoutFind(env, 'layout.proportions', { textType, layoutMedium });
          if (!f) { problems.push(textType + '/' + layoutMedium + ': not checked'); continue; }
          if (f.status !== 'pass') problems.push(textType + '/' + layoutMedium + ': ' + f.status + ' — ' + f.detail);
        }
      }
      // and the check really has teeth: a column left nearly empty is a fault
      const lame = { width: 1000, height: 1000, blocks: [
        { type: 'text', x: 60, y: 900, text: 'full column', font: { family: 'serif', size: 14 }, role: 'body' },
        { type: 'text', x: 560, y: 220, text: 'almost empty', font: { family: 'serif', size: 14 }, role: 'body' },
      ], columns: [{ x: 60, w: 400, top: 200, bottom: 900 }, { x: 560, w: 400, top: 200, bottom: 900 }] };
      const measured = env.mock.proportions(lame);
      if (!(measured.balance < 0.6)) problems.push('an empty column is not noticed (balance ' + measured.balance.toFixed(2) + ')');
      // a long text still fills both columns of the page
      const long = layoutMaterial(env, { textType: 'Blog Post', layoutMedium: 'screen' });
      long.content.paragraphs = new Array(24).fill(long.content.paragraphs[0]);
      const grid = env.mock.proportions(env.quality.layoutModel(long));
      if (grid.columns.length < 2) problems.push('the page beside the text is not measured');
      else if (grid.balance < 0.8) problems.push('a long text leaves the column beside it empty (balance ' + grid.balance.toFixed(2) + ')');
      // and the teacher sees the measurement next to the picture
      const src = env.uiSource || '';
      if (src && !(/function proportionNote/.test(src) && /mock\.proportions/.test(src) && /layout-proportions/.test(src))) problems.push('the layout tab does not show the proportion check');
      return ok(!problems.length, problems.slice(0, 3).join(' | '));
    } });
  add({ id: 'S37.rule_authentic', section: 37, title: 'Kontrolle (Claude): das Medium wirkt echt und passt zum Text', kind: 'rule', ruleId: 'layout.authentic' });


  /* §38 Vorlagen: ganze Konfigurationen auf Klick, in Worten zusammengefasst (Auftragserweiterung) */
  add({ id: 'S38.gallery', section: 38, title: 'Vorlagen-Galerie über dem Formular: Karten mit Titel, Kurzbeschreibung und der Konfiguration in Worten', kind: 'ui', selector: '#setup-bar',
    extra(env) {
      const src = env.uiSource || '';
      const wired = !src || (/function renderSetupBar/.test(src) && /setup-card/.test(src) && /describeSetup/.test(src) && /applySetupPreset/.test(src));
      // Lehrmittel/Unit first, the gallery directly below it
      const placed = !src || /form\.insertBefore\(bar, afterSource\)/.test(src);
      return ok(wired && placed && env.hasControl('#setup-presets') && env.hasControl('#setup-summary'), 'the template gallery is missing, not wired or not placed under Source & Unit');
    } });
  add({ id: 'S38.presets', section: 38, title: 'Je sechs Vorlagen für Listening und Reading, die alle Bereiche individuell setzen (Thema, Sprache, Aufbau, Vokabular, Fragen, Aufgabenphasen)', kind: 'function',
    check(env) {
      const areas = {
        language: ['cefr', 'languageComplexity', 'grammarComplexity', 'vocabularyDifficulty', 'idiomaticLanguage', 'explicitness'],
        shape: ['format', 'preset', 'audioLength', 'speakingSpeed', 'naturalness', 'emotionTags', 'textType', 'wordCount', 'paragraphLength', 'styleBalance'],
        vocab: ['vocabUsage', 'targetVocabMin', 'targetVocabMax'],
        questions: ['questionCount', 'questionLevel', 'inferenceLevel', 'distractorDifficulty', 'questionFormats'],
      };
      for (const kind of ['listening', 'reading']) {
        const list = env.core.setupPresets(kind);
        if (list.length < 6) return kind + ': fewer than six templates';
        const seen = new Set();
        for (const preset of list) {
          if (!preset.label || !preset.blurb) return preset.key + ' has no label or short description';
          for (const [area, keys] of Object.entries(areas)) {
            if (!keys.some(k => k in preset.settings)) return `${preset.key} sets nothing in the area "${area}"`;
          }
          if (!preset.tasks || !preset.tasks.pre || !preset.tasks.post) return preset.key + ' does not set both task phases';
          const base = env.state({ kind });
          const s = env.core.applySetupPreset(base, preset.key);
          const errs = env.core.validateState(s, env.ctx);
          if (errs.length) return preset.key + ' is invalid: ' + errs[0].message;
          if (env.core.activeSetupPreset(s) !== preset.key) return preset.key + ' is not recognised as active';
          const plan = env.core.buildPlan(s, env.ctx);
          if (!plan.questionCount || !plan.targetWords || !plan.preTask || !plan.postTask) return preset.key + ' does not produce a complete plan';
          if (kind === 'reading' && !plan.authenticLayout) return preset.key + ' does not show the text in its real layout';
          const sig = [s.cefr, s.languageComplexity, s.textType || s.preset, s.questionLevel].join('|');
          if (seen.has(sig)) return 'two templates of ' + kind + ' are configured alike: ' + sig;
          seen.add(sig);
        }
      }
      return ok(true);
    } });
  add({ id: 'S38.summary', section: 38, title: 'Jede Vorlage wird in Worten zusammengefasst – ergänzend zu den Tags, ohne eine Angabe doppelt zu nennen, mit Sozialform und Modus je Aufgabe', kind: 'function',
    check(env) {
      for (const kind of ['listening', 'reading']) {
        for (const preset of env.core.setupPresets(kind)) {
          const s = env.core.applySetupPreset(env.state({ kind }), preset.key);
          const bullets = env.core.describeSetup(s, env.ctx);
          if (bullets.length < 7) return preset.key + ': the summary has only ' + bullets.length + ' lines';
          const text = bullets.join(' | ');
          // nothing that already stands in a tag above may be repeated here
          for (const part of env.core.tagsFor(s, env.ctx).flatMap(t => t.split(' · ')).map(t => t.replace(/^(Pre|Post) /, ''))) {
            if (text.includes(part)) return `${preset.key}: „${part}“ steht im Tag und noch einmal in der Zusammenfassung`;
          }
          if (!/Thema/.test(text) || !/Zielvokabular/.test(text)) return preset.key + ': topic or vocabulary missing';
          const plan = env.core.buildPlan(s, env.ctx);
          for (const [label, phase] of [['Pre-Task', plan.preTask], ['Post-Task', plan.postTask]]) {
            const line = bullets.find(b => b.indexOf(label + ':') === 0);
            if (!line) return preset.key + ': no line for ' + label;
            for (const t of phase.tasks) {
              const short = (env.core.SOCIAL_FORMS.find(f => f.key === t.socialForm) || {}).short;
              if (!line.includes(short)) return `${preset.key}/${label}: the social form of task ${t.n} is missing`;
            }
            if (!/mündlich|schriftlich/.test(line)) return `${preset.key}/${label}: oral or written is missing`;
            if (/Aufgabe\(n\)|\d+ min/.test(line)) return `${preset.key}/${label}: repeats the count or the minutes`;
          }
        }
      }
      // it follows the settings, it is not a stored sentence
      const s = env.core.applySetupPreset(env.state({ kind: 'reading' }), 'horrorblog');
      const before = env.core.describeSetup(s, env.ctx).join(' | ');
      const changed = env.core.normalizeState(Object.assign(env.core.clone(s), { cefr: 'A2.1', wordCount: 150, glossary: false, grammarComplexity: 5, postTask: false }));
      const after = env.core.describeSetup(changed, env.ctx).join(' | ');
      return ok(after !== before && /einfachste Strukturen/.test(after) && !after.includes('Fremdwörter erklärt') && /Post-Task: aus/.test(after),
        'the summary does not follow the settings');
    } });
  add({ id: 'S38.tags', section: 38, title: 'Jede Vorlagenkarte zeigt die wichtigsten Angaben oben als kurze Tags (Niveau, Länge, Textsorte, Fragen, Aufgabenzeiten)', kind: 'function',
    check(env) {
      const src = env.uiSource || '';
      const wired = !src || (/sc-tags/.test(src) && /core\.tagsFor\(/.test(src));
      for (const kind of ['listening', 'reading']) {
        for (const preset of env.core.setupPresets(kind)) {
          const s = env.core.applySetupPreset(env.state({ kind }), preset.key);
          const tags = env.core.tagsFor(s, env.ctx);
          if (tags.length < 5 || tags.length > 8) return preset.key + ': ' + tags.length + ' tags';
          if (tags.some(t => t.length > 24)) return preset.key + ': a tag is not short';
          if (tags[0] !== s.cefr) return preset.key + ': the level is not the first tag';
          const plan = env.core.buildPlan(s, env.ctx);
          if (!tags.some(t => t.includes(String(plan.targetWords)))) return preset.key + ': no length tag';
          if (!tags.some(t => t.includes(String(plan.questionCount) + ' Fragen'))) return preset.key + ': no question tag';
          if (!tags.some(t => t.includes('Pre ')) || !tags.some(t => t.includes('Post '))) return preset.key + ': no task tags';
        }
      }
      // the tags follow the settings
      const s = env.core.applySetupPreset(env.state({ kind: 'reading' }), 'hostemail');
      const changed = env.core.normalizeState(Object.assign(env.core.clone(s), { cefr: 'B2.2', wordCount: 420 }));
      const after = env.core.tagsFor(changed, env.ctx);
      return ok(wired && after[0] === 'B2.2' && after.some(t => t.includes('420')), 'the tags do not follow the settings');
    } });
  add({ id: 'S38.redo', section: 38, title: 'Jede Karte hat einen Redo-Knopf: Claude schlägt eine neue Variante derselben Vorlage vor, geprüft übernommen', kind: 'function',
    check(env) {
      const src = env.uiSource || '';
      const wired = !src || (/data-redo=/.test(src) && /function redrawTemplate/.test(src) && /buildTemplateVariantPrompt/.test(src)
        && /applyTemplateVariant/.test(src) && /validateState\(candidate/.test(src));
      const preset = env.core.setupPresets('reading').find(p => p.key === 'horrorblog');
      const base = env.core.applySetupPreset(env.state({ kind: 'reading' }), 'horrorblog');
      const p = env.prompts.buildTemplateVariantPrompt(preset, base, env.ctx);
      const demands = /Propose ONE fresh variant/.test(p) && /do not change/.test(p) && new RegExp('CEFR level: ' + base.cefr).test(p) && /"customTopic"/.test(p);
      // only the allowed dials are taken over, and they stay inside their range
      const applied = env.core.applyTemplateVariant(base, { customTopic: 'another idea', languageComplexity: 70, cefr: 'A1.1', questionCount: '30', wordCount: 99999, nonsense: 1 });
      const safe = applied.customTopic === 'another idea' && applied.languageComplexity === 70 && applied.cefr === base.cefr
        && applied.questionCount === base.questionCount && applied.wordCount <= 1200 && applied.nonsense === undefined;
      const empty = env.core.applyTemplateVariant(base, { customTopic: '   ' });
      return ok(wired && demands && safe && empty.customTopic === base.customTopic && env.core.validateState(applied, env.ctx).length === 0,
        'the redo does not ask for a checked variant of the same template');
    } });
  add({ id: 'S38.folding', section: 38, title: 'Mit Vorlage bleiben die Einzeleinstellungen zugeklappt; „Vorlage anpassen“ und „Alles selbst einstellen“ öffnen sie', kind: 'ui', selector: '#btn-setup-adapt',
    extra(env) {
      const src = env.uiSource || '';
      const wired = !src || (/document\.body\.dataset\.setup = custom \? 'custom' : 'preset'/.test(src)
        && /function openCustomSetup/.test(src) && /setMode\('advanced'\)/.test(src) && /setupMode = 'preset'/.test(src));
      return ok(wired && env.hasControl('#btn-setup-custom') && env.hasControl('#btn-setup-back') && env.core.SCHEMA_BY_KEY.setupMode.default === 'preset',
        'the settings do not fold away with a template, or there is no way back');
    } });
  add({ id: 'S38.adjustable', section: 38, title: 'Eine Vorlage lässt sich weiter anpassen; danach gilt sie als „angepasst“', kind: 'setting', key: 'setupMode', alt: 'custom', promptSensitive: false,
    extra(env) {
      const s = env.core.applySetupPreset(env.state({ kind: 'reading' }), 'horrorblog');
      const changed = env.core.normalizeState(Object.assign(env.core.clone(s), { wordCount: 500 }));
      const taskChanged = env.core.applyTaskPreset(s, 'post', 'mediation');
      return ok(env.core.activeSetupPreset(s) === 'horrorblog' && env.core.activeSetupPreset(changed) === null && env.core.activeSetupPreset(taskChanged) === null,
        'changing a setting does not mark the template as adjusted');
    } });

  return { REQUIREMENTS: M };
});
