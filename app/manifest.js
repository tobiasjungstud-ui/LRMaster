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
  add({ id: 'S26.chronology', section: 26, title: 'Follow audio chronology / Follow text order (Default ON, Gist-Ausnahme)', kind: 'setting', key: 'followChronology', alt: false,
    extra(env) {
      const s = env.state({ followChronology: true });
      const p = env.prompts.buildQuestionPrompt(s, env.core.buildPlan(s, env.ctx), env.fixture.content());
      const r = env.state({ kind: 'reading', followChronology: true });
      const pr = env.prompts.buildQuestionPrompt(r, env.core.buildPlan(r, env.ctx), env.fixture.content('reading'));
      return ok(env.core.defaults('listening').followChronology === true && /audio chronology/.test(p) && /Gist/.test(p) && /text chronology/.test(pr));
    } });
  add({ id: 'S26.check', section: 26, title: 'Reihenfolge wird anhand der Evidenzstellen geprüft', kind: 'rule', ruleId: 'questions.chronology',
    extra(env) {
      const m = env.fixture.material();
      const ws = JSON.parse(JSON.stringify(m.worksheet));
      ws.questions.reverse().forEach((q, i) => { q.n = i + 1; });
      const plan = env.core.buildPlan(m.settings, env.ctx);
      const f = env.quality.runDeterministic(m.settings, plan, m.content, ws).find(x => x.id === 'questions.chronology');
      const good = env.quality.runDeterministic(m.settings, plan, m.content, m.worksheet).find(x => x.id === 'questions.chronology');
      return ok(f && f.status !== 'pass' && good && good.status === 'pass', `reversed=${f && f.status} normal=${good && good.status}`);
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
      return ok(det.length >= 8 && llm.length >= 8 && blocking.length === 1 && blocking[0].id === 'questions.answerable' && llm.every(r => rp.includes('"' + r.id + '"')) && (env.pipelineSource ? /runDeterministic[\s\S]*buildReviewPrompt[\s\S]*RevisionPrompt/.test(env.pipelineSource) : true), 'quality pipeline incomplete');
    } });

  /* §30 Advanced settings */
  const ADV = { 'number of speakers': 'speakerCount', 'individual speaker share': 'customShares', 'average turn length': 'turnLength', 'turn variability': 'turnVariability', 'speaking speed': 'speakingSpeed', 'natural speech': 'naturalness', 'emotion frequency': 'emotionTags', 'information explicitness': 'explicitness',
    'word count': 'wordCount', 'paragraph length': 'paragraphLength', 'dialogue proportion': 'dialogueProportion', 'narrative vs. informational style': 'styleBalance',
    'CEFR': 'cefr', 'grammar complexity': 'grammarComplexity', 'vocabulary difficulty': 'vocabularyDifficulty', 'target vocabulary density': 'vocabUsage', 'idiomatic language': 'idiomaticLanguage',
    'number (questions)': 'questionCount', 'difficulty (questions)': 'questionDifficulty', 'skill distribution': 'skillMixMode', 'response formats': 'questionFormats', 'distractor difficulty': 'distractorDifficulty', 'inference level': 'inferenceLevel', 'chronology': 'followChronology' };
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
      return ok(s.cefr === 'B1.2' && s.preset === 'podcast' && plan.seconds === 180 && deepEq(plan.shares, [30, 70]) && plan.questionCount === 10 && deepEq(plan.skillMix, { gist: 1, specific: 3, detail: 2, connecting: 1, inference: 1, attitude: 1, purpose: 1, context: 0 }) && deepEq(s.questionFormats, ['multiple_choice', 'short_answer', 'matching']) && s.followChronology && s.turnVariability >= 75 && s.emotionTags === 'medium' && env.hasControl('#btn-load-example'), 'example config does not reproduce §32');
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

  return { REQUIREMENTS: M };
});
