#!/usr/bin/env node
/*
 * LRMaster test runner (no dependencies).
 *  1. Unit tests of the pure modules.
 *  2. Concept coverage: every requirement in app/manifest.js is verified
 *     against the real code, the rendered form and the UI source.
 * Exit code 1 on any failure.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP = path.join(__dirname, '..', 'app');
const core = require(path.join(APP, 'core.js'));
const prompts = require(path.join(APP, 'prompts.js'));
const quality = require(path.join(APP, 'quality.js'));
const render = require(path.join(APP, 'render.js'));
const vocab = require(path.join(APP, 'vocab.js'));
const controls = require(path.join(APP, 'controls.js'));
const word = require(path.join(APP, 'word.js'));
const ooxml = require(path.join(APP, 'ooxml.js'));
const docx = require(path.join(APP, 'docx.js'));
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const checks = require(path.join(APP, 'checks.js'));
const fixture = require(path.join(APP, 'fixture.js'));

const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const uiSource = fs.readFileSync(path.join(APP, 'ui.js'), 'utf8');
const formHtml = controls.renderForm();

let failures = 0, passes = 0;
function test(name, fn) {
  try { fn(); passes++; console.log('  ✓ ' + name); }
  catch (e) { failures++; console.log('  ✗ ' + name + '\n      ' + (e && e.message || e).split('\n').join('\n      ')); }
}

/* ---------------- unit tests ---------------- */
console.log('\nUnit tests');
const level = require(path.join(APP, 'level.js'));
test('level meter: anchor script measures B1.2, samples order monotonically', () => {
  const a = level.measure(fixture.levelSample('anchor'), 'listening', { seconds: 180 });
  assert.equal(a.band, 'B1.2');
  assert.equal(a.stats.words, 356); assert.equal(a.stats.turns, 10);
  const scores = ['a2', 'b1', 'anchor', 'b2'].map(n => level.measure(fixture.levelSample(n), 'listening', {}).score);
  for (let i = 1; i < scores.length; i++) assert.ok(scores[i] > scores[i - 1], scores.join(' < '));
  assert.equal(level.measure(fixture.levelSample('b2reading'), 'reading', {}).band, 'B2.2');
});
test('level meter: stage directions, names and contractions do not count as hard words', () => {
  const m = level.measure({ lines: [{ speaker: 'Speaker 1', text: "[chuckles] Maya, you don't have to." }, { speaker: 'Speaker 2', text: '[thoughtful] I know Maya.' }] }, 'listening', {});
  assert.deepEqual(m.hardWords.map(h => h.lemma), []);
  assert.equal(m.stats.words, 8);
});
test('level meter: lemmatiser, British spelling, compounds, overrides', () => {
  assert.equal(level.lemmaOf('argued'), 'argue'); assert.equal(level.lemmaOf('humour'), 'humor'); assert.equal(level.lemmaOf('organisers'), 'organize');
  assert.equal(level.americanize('favourite'), 'favorite');
  assert.ok(level.rankOf('café') <= 1200 && level.rankOf('castle') <= 1200, 'Oxford A1/A2 overrides');
  assert.ok(level.rankOf('seventeen-year-old') > 0 && level.rankOf('unmotivated') > 2000);
  assert.equal(level.rankBand(500), 'core'); assert.equal(level.rankBand(2500), 'b2'); assert.equal(level.rankBand(null), 'c');
});
test('level meter: compare and glossary candidates', () => {
  const m = level.measure(fixture.levelSample('b2'), 'listening', {});
  const c = level.compare(m, 'A2.2');
  assert.equal(c.status, 'fail'); assert.ok(c.deviations.length >= 3 && c.deviations.every(d => d.suggestion));
  assert.equal(level.compare(m, m.band).status, 'pass');
  const g = level.glossaryCandidates(m, 'B1.1', 5);
  assert.ok(g.length === 5 && g.every(x => x.band === 'b2' || x.band === 'c'));
  assert.ok(level.targetLines('B1.2', 'listening').length === 6 && level.targetLines('B1.2', 'reading').length === 5);
});
test('chronology is enforced and blocking; skills and formats are checked by totals', () => {
  const m = fixture.material({}, 'listening');
  const ws = JSON.parse(JSON.stringify(m.worksheet));
  ws.questions = [ws.questions[0], ws.questions[3], ws.questions[1], ws.questions[2]].map((q, i) => Object.assign(q, { n: i + 1 }));
  const before = quality.runDeterministic(m.settings, m.plan, m.content, ws).find(f => f.id === 'questions.chronology');
  assert.equal(before.status, 'fail');
  const r = quality.enforceChronology(ws, m.content, 'listening');
  assert.deepEqual(r.worksheet.questions.map(q => q.skill), ['gist', 'specific', 'detail', 'inference']);
  assert.equal(quality.runDeterministic(m.settings, m.plan, m.content, r.worksheet).find(f => f.id === 'questions.chronology').status, 'pass');
  const swapped = JSON.parse(JSON.stringify(m.worksheet)); swapped.questions[1].skill = 'detail';
  assert.equal(quality.runDeterministic(m.settings, m.plan, m.content, swapped).find(f => f.id === 'questions.skill_distribution').status, 'fail');
  assert.equal(quality.runDeterministic(m.settings, m.plan, m.content, r.worksheet).find(f => f.id === 'questions.skill_distribution').status, 'pass');
});
test('pre-task plan: types, social forms, oral tasks and time are fixed per position', () => {
  const s = core.normalizeState({ kind: 'listening', createWorksheet: true, preTask: true, preTaskCount: 4,
    preTaskTypes: ['confrontation', 'vocabulary', 'speaking', 'prediction'], preTaskOralCount: 2, preTaskMinutes: 10 });
  const tasks = core.preTaskSequence(s);
  assert.equal(tasks.length, 4);
  assert.deepEqual(tasks.map(t => t.n), [1, 2, 3, 4]);
  assert.equal(tasks.filter(t => t.mode === 'oral').length, 2);
  assert.ok(tasks.filter(t => t.mode === 'oral').every(t => t.socialForm !== 'single'), 'oral task in individual work');
  assert.equal(tasks.reduce((a, t) => a + t.minutes, 0), 10);
  // the didactic order puts the confrontation task first
  assert.equal(tasks[0].type, 'confrontation');
});
test('automatic social forms always fit the number of oral tasks', () => {
  for (let n = 1; n <= 6; n++) for (let oral = 0; oral <= n; oral++) {
    const mix = core.autoPreTaskSocial(n, oral);
    assert.equal(core.SOCIAL_FORM_KEYS.reduce((a, k) => a + mix[k], 0), n, `n=${n}`);
    assert.ok(mix.pair + mix.group + mix.plenary >= oral, `n=${n} oral=${oral}: ${JSON.stringify(mix)}`);
  }
});
test('pre-task validation guards impossible combinations', () => {
  const ctx = { textbook: { id: 't' }, unit: { id: 'u', words: [{ word: 'argue' }, { word: 'trust' }] } };
  const base = { kind: 'listening', textbookId: 't', unitId: 'u', createWorksheet: true, preTask: true, targetVocabMin: 1, targetVocabMax: 2 };
  const errs = (over) => core.validateState(core.normalizeState(Object.assign({}, base, over)), ctx).map(e => e.key);
  assert.ok(errs({ preTaskCount: 2, preTaskOralCount: 4 }).includes('preTaskOralCount'));
  assert.ok(errs({ preTaskCount: 3, preTaskSocialMode: 'custom', customPreTaskSocial: { single: 1, pair: 1, group: 0, plenary: 0 } }).includes('customPreTaskSocial'));
  assert.ok(errs({ preTaskCount: 2, preTaskOralCount: 2, preTaskSocialMode: 'custom', customPreTaskSocial: { single: 2, pair: 0, group: 0, plenary: 0 } }).includes('preTaskOralCount'));
  assert.deepEqual(errs({ preTaskCount: 2, preTaskOralCount: 1 }), []);
});
test('pre-task normalisation and targeted patch keep the questions', () => {
  const p = quality.normalizePreTask({ type: 'Confrontation', prompt: 'x', socialForm: 'PAIR', mode: 'nonsense', minutes: '3.6', criteria: ['a', ''] }, 0);
  assert.equal(p.n, 1); assert.equal(p.socialForm, 'pair'); assert.equal(p.mode, 'written');
  assert.equal(p.minutes, 4); assert.deepEqual(p.criteria, ['a']);
  const ws = fixture.worksheet('listening');
  const patched = quality.applyPreTaskPatch(ws, { preTasks: [Object.assign({}, ws.preTasks[0], { prompt: 'new' }), ws.preTasks[1]] });
  assert.equal(patched.questions, ws.questions);
  assert.equal(patched.preTasks[0].prompt, 'new');
  assert.deepEqual(quality.changedPreTasks(ws, patched), [1]);
  assert.equal(quality.applyPreTaskPatch(ws, {}), ws);
});
test('pre-task findings get their own repair bucket', () => {
  const findings = [{ id: 'pretask.criteria', group: 'pretask', status: 'fail', title: 'c' },
    { id: 'questions.evidence', group: 'questions', status: 'fail', title: 'e', questions: [2] },
    { id: 'content.word_count', group: 'content', status: 'fail', title: 'w' }];
  const rp = quality.repairPlan(findings, 'fail');
  assert.equal(rp.preTasks.length, 1);
  assert.deepEqual(rp.questions, [2]);
  assert.equal(rp.content.length, 1);
  assert.equal(rp.worksheet.length, 0);
});
test('a picture exists for every text type, on screen and on paper, without Claude', () => {
  const mock = require(path.join(APP, 'mock.js'));
  for (const type of core.TEXT_TYPES) {
    for (const medium of ['auto', 'screen', 'paper']) {
      const m = fixture.material({ textType: type, authenticLayout: true, layoutMedium: medium }, 'reading');
      // only what the material itself knows — no interface data from Claude
      const chrome = mock.fallbackChrome(m);
      const model = mock.buildModel(m, chrome);
      assert.deepEqual(mock.validate(model), [], type + '/' + medium);
      assert.equal(quality.normalizeForSearch(mock.bodyText(model)), quality.normalizeForSearch(m.content.paragraphs.join(' ')), type + '/' + medium);
      if (medium === 'paper') assert.equal(model.medium, 'paper', type);
      if (medium === 'screen') assert.equal(model.medium, 'screen', type);
      if (medium === 'paper') assert.ok(model.finish && model.finish.page, type + ': no photographed page');
    }
  }
  // print media are on paper by default, online formats on screen
  const paper = ['News Article', 'Article', 'Story', 'Diary Entry', 'Report', 'Opinion Text', 'Review'];
  for (const t of paper) assert.equal(mock.layoutFor(fixture.material({ textType: t }, 'reading')).medium, 'paper', t);
  for (const t of ['Blog Post', 'Email', 'Forum Discussion', 'Dialogue']) {
    assert.equal(mock.layoutFor(fixture.material({ textType: t }, 'reading')).medium, 'screen', t);
  }
  // Claude's data enriches, it never deletes what the material knows
  const merged = quality.mergeChrome({ siteName: 'from meta', url: 'u', actions: [] }, { siteName: '', actions: [{ label: 'Like', count: '3' }] });
  assert.equal(merged.siteName, 'from meta');
  assert.equal(merged.actions.length, 1);
});
test('every medium is built like the real thing, on screen and on paper', () => {
  const mock = require(path.join(APP, 'mock.js'));
  const model = (type, medium) => quality.layoutModel(fixture.material({ textType: type, authenticLayout: true, layoutMedium: medium || 'screen' }, 'reading'));
  const icons = (m) => new Set(m.blocks.filter(b => b.type === 'icon').map(b => b.name));
  const blog = model('Blog Post');
  for (const n of ['lock', 'plus', 'search', 'heart', 'comment', 'share', 'bookmark']) assert.ok(icons(blog).has(n), 'blog icon ' + n);
  assert.ok(blog.blocks.some(b => b.type === 'photo'), 'the blog post has no picture');
  for (const n of ['inbox', 'trash', 'reply', 'star']) assert.ok(icons(model('Email')).has(n), 'mail icon ' + n);
  const forum = model('Forum Discussion');
  assert.ok(icons(forum).has('up') && icons(forum).has('down'), 'the forum has no vote arrows');
  const chat = model('Dialogue');
  assert.ok(chat.blocks.some(b => b.type === 'wallpaper'), 'the messenger has no wallpaper');
  assert.ok(chat.blocks.some(b => b.type === 'poly'), 'the bubbles have no tails');
  for (const n of ['phone', 'video', 'mic', 'camera', 'clip', 'ticks']) assert.ok(icons(chat).has(n), 'chat icon ' + n);
  // printed media: justified columns, a binding shadow, ruling and holes, a staple
  const press = model('News Article', 'paper'), book = model('Story', 'paper'), note = model('Diary Entry', 'paper');
  const words = (m) => m.blocks.filter(b => b.type === 'text' && b.role === 'body' && !/\s/.test(b.text)).length;
  assert.ok(words(press) >= 20 && words(book) >= 20, 'the columns are not justified');
  assert.ok(book.finish.gutter, 'the book page has no binding shadow');
  assert.ok(note.blocks.filter(b => b.type === 'line').length >= 10, 'the notebook has no ruling');
  assert.ok(note.blocks.filter(b => b.type === 'circle').length >= 3, 'the notebook has no punched holes');
  assert.ok(model('Report', 'paper').blocks.some(b => b.type === 'line' && b.width === 3), 'the printed sheet has no staple');
  // the drop cap is part of the text, so the initial is glued to the line it opens
  const cap = book.blocks.filter(b => b.role === 'body').find(b => b.glue);
  assert.ok(cap && cap.text.length === 1, 'the book page has no initial');
  // every icon the models ask for really exists, and nothing is drawn without a size
  for (const type of core.TEXT_TYPES) for (const medium of ['screen', 'paper']) {
    assert.deepEqual(mock.validate(model(type, medium)), [], type + '/' + medium);
  }
});
test('the screenshot shows exactly the generated text, for every text type', () => {
  const mock = require(path.join(APP, 'mock.js'));
  for (const type of core.TEXT_TYPES) {
    const m = fixture.material({ textType: type, authenticLayout: true }, 'reading');
    const model = quality.layoutModel(m);
    assert.deepEqual(mock.validate(model), [], type);
    assert.equal(quality.normalizeForSearch(mock.bodyText(model)), quality.normalizeForSearch(m.content.paragraphs.join(' ')), type);
    assert.ok(model.width >= 400 && model.height >= 300, type + ': ' + model.width + 'x' + model.height);
  }
  // a picture that drops a paragraph is caught
  const m = fixture.material({ textType: 'Blog Post', authenticLayout: true }, 'reading');
  const short = JSON.parse(JSON.stringify(m));
  short.content.paragraphs = short.content.paragraphs.slice(0, 1);
  const shown = quality.normalizeForSearch(mock.bodyText(quality.layoutModel(short)));
  assert.notEqual(shown, quality.normalizeForSearch(m.content.paragraphs.join(' ')));
  const found = quality.runContentChecks(m.settings, m.plan, m.content, { layout: m.layout });
  assert.equal(found.find(f => f.id === 'layout.text_identical').status, 'pass');
  assert.equal(found.find(f => f.id === 'layout.image_valid').status, 'pass');
  // no layout data, no layout findings
  assert.equal(quality.runContentChecks(m.settings, m.plan, m.content).filter(f => f.group === 'layout').length, 0);
});
test('template cards carry short tags and a checked redo', () => {
  const tb = fixture.textbooks()[0];
  const ctx = { textbook: tb, unit: tb.units[0] };
  for (const kind of ['listening', 'reading']) {
    for (const preset of core.setupPresets(kind)) {
      const base = core.normalizeState(Object.assign(core.defaults(kind), { textbookId: tb.id, unitId: tb.units[0].id }));
      const s = core.applySetupPreset(base, preset.key);
      const tags = core.tagsFor(s, ctx);
      assert.ok(tags.length >= 5 && tags.length <= 8, preset.key + ': ' + tags.length + ' tags');
      assert.equal(tags[0], s.cefr, preset.key);
      assert.ok(tags.every(t => t.length <= 24), preset.key + ': ' + tags.join('|'));
      // a drawn variant may change the idea, never the frame
      const applied = core.applyTemplateVariant(s, { customTopic: 'a new idea', languageComplexity: 70, cefr: 'A1.1', questionLevel: 'B', wordCount: 5000, junk: true });
      assert.equal(applied.customTopic, 'a new idea', preset.key);
      assert.equal(applied.cefr, s.cefr, preset.key);
      assert.equal(applied.questionLevel, s.questionLevel, preset.key);
      assert.equal(applied.junk, undefined);
      assert.ok(applied.wordCount <= 1200);
      assert.deepEqual(core.validateState(applied, ctx), [], preset.key + ' variant invalid');
    }
  }
  assert.equal(core.applyTemplateVariant(core.defaults('reading'), {}).customTopic, core.defaults('reading').customTopic);
});
test('with a template the single settings stay folded away', () => {
  const css = fs.readFileSync(path.join(APP, 'styles.css'), 'utf8');
  const folded = css.split('\n').filter(l => l.includes('body[data-setup="preset"]')).join(' ');
  for (const id of ['sec-content', 'sec-level', 'sec-structure', 'sec-vocab', 'sec-worksheet', 'sec-pretask', 'sec-posttask', 'sec-advanced']) {
    assert.ok(folded.includes('#' + id), 'not folded away with a template: ' + id);
  }
  for (const id of ['sec-source', 'sec-generate']) assert.ok(!folded.includes('#' + id), id + ' must stay visible');
  assert.ok(!folded.includes('setup-bar'), 'the gallery must stay visible');
});
test('whole-setup templates configure a complete, valid material', () => {
  for (const kind of ['listening', 'reading']) {
    for (const preset of core.setupPresets(kind)) {
      const tb = fixture.textbooks()[0];
      const base = core.normalizeState(Object.assign(core.defaults(kind), { textbookId: tb.id, unitId: tb.units[0].id }));
      const s = core.applySetupPreset(base, preset.key);
      assert.equal(s.kind, kind);
      assert.equal(core.activeSetupPreset(s), preset.key, preset.key);
      const bullets = core.describeSetup(s, { textbook: tb, unit: tb.units[0] });
      assert.ok(bullets.length >= 7, preset.key + ': summary too short');
      assert.ok(bullets.join(' ').includes(s.cefr), preset.key + ': summary without level');
      assert.deepEqual(core.validateState(s, { textbook: tb, unit: tb.units[0] }), [], preset.key);
      const plan = core.buildPlan(s, { textbook: tb, unit: tb.units[0] });
      assert.ok(plan.preTask && plan.postTask, preset.key + ': task phases missing');
      assert.ok(plan.questionCount > 0 && plan.targetWords > 0, preset.key);
      if (kind === 'reading') assert.equal(plan.authenticLayout, true, preset.key);
    }
  }
});
test('ready-made task sequences produce complete, valid plans', () => {
  const ctx = { textbook: { id: 't' }, unit: { id: 'u', topic: 'Friends', words: [{ word: 'argue' }, { word: 'trust' }] } };
  const base = core.normalizeState({ kind: 'listening', textbookId: 't', unitId: 'u', createWorksheet: true, targetVocabMin: 1, targetVocabMax: 2 });
  for (const phase of ['pre', 'post']) {
    for (const preset of core.TASK_PRESETS[phase]) {
      const s = core.applyTaskPreset(base, phase, preset.key);
      assert.equal(core.activeTaskPreset(s, phase), preset.key, phase + '/' + preset.key);
      const errs = core.validateState(s, ctx).filter(e => e.key.toLowerCase().includes(phase + 'task'));
      assert.deepEqual(errs, [], phase + '/' + preset.key + ': ' + errs.map(e => e.message));
      const plan = core.buildTaskPlan(s, phase);
      if (preset.key === 'off') { assert.equal(plan, null); continue; }
      assert.ok(plan.count >= 1 && plan.minutes >= plan.count, phase + '/' + preset.key);
      assert.ok(plan.tasks.every(t => t.type && t.socialForm && t.mode && t.minutes >= 1));
      assert.ok(plan.tasks.filter(t => t.mode === 'oral').every(t => t.socialForm !== 'single'), phase + '/' + preset.key + ': oral task alone');
    }
  }
  // a hand-made mix is not reported as one of the ready-made sequences
  const own = core.normalizeState(Object.assign(core.applyTaskPreset(base, 'pre', 'confrontation'), { preTaskCount: 5 }));
  assert.equal(core.activeTaskPreset(own, 'pre'), null);
});
test('the task sections stay usable in Simple Mode', () => {
  const css = fs.readFileSync(path.join(APP, 'styles.css'), 'utf8');
  const simpleRule = css.split('\n').find(l => l.includes('body[data-uimode="simple"]') && l.includes('display: none'));
  assert.ok(simpleRule, 'simple-mode rule not found');
  for (const hidden of ['task-head', 'TaskPresets', 'task-preview', 'sec-pretask', 'sec-posttask']) {
    assert.ok(!simpleRule.includes(hidden), 'Simple Mode hides ' + hidden);
  }
  for (const phase of ['pre', 'post']) {
    const head = controls.taskExtras(phase);
    assert.ok(!head.includes('class="ctl"'), phase + ': quick choice sits inside an advanced control');
    assert.ok(head.includes('data-task-preset="off"'), phase + ': no way to switch the phase off');
  }
});
test('post-task: same planner, own types, product and reference', () => {
  const s = core.normalizeState({ kind: 'reading', createWorksheet: true, postTask: true, postTaskCount: 4,
    postTaskTypes: ['debate', 'mediation', 'creative', 'peerfeedback'], postTaskOralCount: 2, postTaskMinutes: 24 });
  const tasks = core.postTaskSequence(s);
  assert.equal(tasks.length, 4);
  assert.equal(tasks.filter(t => t.mode === 'oral').length, 2);
  assert.ok(tasks.filter(t => t.mode === 'oral').every(t => t.socialForm !== 'single'));
  assert.equal(tasks.reduce((a, t) => a + t.minutes, 0), 24);
  assert.equal(tasks[0].type, 'debate');
  // the generic planner is what both phases use
  assert.deepEqual(core.buildTaskPlan(s, 'post'), core.buildPostTaskPlan(s));
  const p = quality.normalizePreTask({ type: 'mediation', prompt: 'x', reference: 'line 3', product: 'a short mail' }, 0);
  assert.equal(p.reference, 'line 3'); assert.equal(p.product, 'a short mail');
});
test('post-task checks mirror the pre-task checks and add product/reference', () => {
  const ids = quality.RULES.map(r => r.id);
  for (const id of ['present', 'social_forms', 'modes', 'focus', 'criteria', 'time', 'language']) {
    assert.ok(ids.includes('pretask.' + id), 'pretask.' + id);
    assert.ok(ids.includes('posttask.' + id), 'posttask.' + id);
  }
  for (const id of ['posttask.product', 'posttask.uses_material', 'posttask.beyond_questions', 'posttask.mediation']) assert.ok(ids.includes(id), id);
  const m = fixture.material({ preTask: true, postTask: true }, 'listening');
  const bad = JSON.parse(JSON.stringify(m.worksheet));
  bad.postTasks[0].socialForm = 'plenary';
  bad.postTasks[1].product = '';
  const found = quality.runDeterministic(m.settings, m.plan, m.content, bad);
  assert.equal(found.find(f => f.id === 'posttask.social_forms').status, 'fail');
  assert.equal(found.find(f => f.id === 'posttask.product').status, 'fail');
  assert.equal(found.find(f => f.id === 'pretask.social_forms').status, 'pass', 'the pre-task must not be affected');
  const rp = quality.repairPlan(found.filter(f => f.status === 'fail'), 'fail');
  assert.equal(rp.postTasks.length, 2);
  assert.equal(rp.preTasks.length, 0);
  const patched = quality.applyPostTaskPatch(m.worksheet, { postTasks: m.worksheet.postTasks.map((p, i) => (i ? p : Object.assign({}, p, { prompt: 'new' }))) });
  assert.equal(patched.preTasks, m.worksheet.preTasks);
  assert.equal(patched.questions, m.worksheet.questions);
  assert.deepEqual(quality.changedPostTasks(m.worksheet, patched), [1]);
});
test('question levels: A/B bands, variants and prompts', () => {
  const s = core.normalizeState({ kind: 'reading', questionLevel: 'both', cefr: 'B1.2' });
  assert.deepEqual(core.questionVariants(s).map(v => v.key), ['A', 'B']);
  assert.deepEqual(core.questionBands(core.variantState(s, core.QUESTION_LEVELS.B)), ['B1.1']);
  assert.deepEqual(core.questionBands(core.variantState(s, core.QUESTION_LEVELS.A)), ['B1.2', 'B2.1']);
  assert.deepEqual(core.questionVariants(core.normalizeState({ kind: 'reading' })), [null]);
});

test('defaults normalise and round-trip', () => {
  const s = core.normalizeState({ kind: 'reading', cefr: 'B2.1', wordCount: '600', questionFormats: ['matching', 'bogus'] });
  assert.equal(s.kind, 'reading'); assert.equal(s.cefr, 'B2.1'); assert.equal(s.wordCount, 600); assert.deepEqual(s.questionFormats, ['matching']);
});
test('word count from audio length and speed', () => {
  assert.equal(core.wordsPerMinute(50), 140);
  assert.equal(core.targetWordCount(core.normalizeState({ kind: 'listening', audioLength: '180', speakingSpeed: 50 })), 420);
  assert.equal(core.targetWordCount(core.normalizeState({ kind: 'listening', audioLength: 'custom', audioLengthCustom: 60, speakingSpeed: 0 })), 105);
});
test('shares always sum to 100', () => {
  for (const b of ['balanced', 'natural', 'main', 'custom']) for (let n = 3; n <= 6; n++) {
    const s = core.normalizeState({ kind: 'listening', format: 'conversation', speakerCount: n, speakerBalance: b, customShares: [3, 5, 7, 11, 13, 17] });
    assert.equal(core.effectiveShares(s).reduce((a, x) => a + x, 0), 100, b + n);
  }
});
test('auto skill mix sums to n for every n and difficulty', () => {
  for (let n = 1; n <= 30; n++) for (const d of [0, 25, 50, 75, 100]) {
    const m = core.autoSkillMix(n, d);
    assert.equal(Object.values(m).reduce((a, b) => a + b, 0), n, `n=${n} d=${d}`);
  }
});
test('example mix for 10 questions at medium difficulty resembles the concept example', () => {
  const m = core.autoSkillMix(10, 50);
  assert.equal(m.gist, 1); assert.ok(m.specific >= 3); assert.ok(m.detail >= 2);
});
test('question band shifts with difficulty', () => {
  assert.equal(core.questionBand('B1.2', 10), 'B1.1'); assert.equal(core.questionBand('B1.2', 50), 'B1.2'); assert.equal(core.questionBand('B1.2', 90), 'B2.1'); assert.equal(core.questionBand('B2.2', 99), 'B2.2');
});
test('vocabulary matching tolerates inflection and multi-word items', () => {
  const r = quality.vocabMatches('They argued loudly, then he apologised and they made up. She relies on him.', ['argue', 'apologise', 'make up', 'rely on', 'gossip']);
  assert.deepEqual(r.found, ['argue', 'apologise', 'make up', 'rely on']); assert.deepEqual(r.missing, ['gossip']);
});
test('quote positions are found with fuzzy windows', () => {
  const t = 'Speaker A: Well, I think we should go to the cinema on Friday evening.\n';
  assert.ok(quality.findQuotePosition(t, 'go to the cinema on Friday') >= 0);
  assert.ok(quality.findQuotePosition(t, "we should go to the cinema on friday evening, really") >= 0);
  assert.equal(quality.findQuotePosition(t, 'completely different words here now'), -1);
});
test('speaker statistics', () => {
  const st = quality.speakerStats([{ speaker: 'A', text: 'one two three' }, { speaker: 'B', text: 'four' }]);
  assert.equal(st.total, 4); assert.equal(st.shares.A, 75); assert.equal(st.shares.B, 25);
});
test('content normalisation maps inline tags and speaker spellings', () => {
  const st = core.normalizeState({ kind: 'listening', speakerProfiles: [{ name: 'Maya' }, { name: 'Leo' }] });
  const plan = core.buildPlan(st, { textbook: fixture.textbooks()[0], unit: fixture.textbooks()[0].units[0] });
  const c = quality.normalizeContent({ title: 't', lines: [{ speaker: 'MAYA', text: '[hesitant] Hi there.' }, { speaker: 'Leo:', emotion: 'null', text: 'Hello.' }] }, st, plan);
  assert.equal(c.lines[0].speaker, 'Maya'); assert.equal(c.lines[0].emotion, 'hesitant'); assert.equal(c.lines[0].text, 'Hi there.'); assert.equal(c.lines[1].emotion, null); assert.equal(c.lines[1].speaker, 'Leo');
});
test('deterministic checks on the fixture pass', () => {
  const m = fixture.material();
  const f = quality.runDeterministic(m.settings, m.plan, m.content, m.worksheet);
  const bad = f.filter(x => x.status === 'fail');
  assert.deepEqual(bad.map(x => x.id + ': ' + x.detail).filter(id => !/word_count|listening.turns|listening.shares/.test(id)), []);
});
test('vocabulary import: CSV with header and unit column', () => {
  const r = vocab.parseText('Unit;Word;Translation\n1;backpack;Rucksack\n1;delay;Verspätung\n2;plot;Handlung');
  assert.equal(r.units.length, 2); assert.equal(r.units[0].name, 'Unit 1'); assert.equal(r.units[0].words.length, 2); assert.equal(r.units[1].words[0].translation, 'Handlung');
});
test('vocabulary import: dash separated list with headings', () => {
  const r = vocab.parseText('Unit 3: School life\nhomework - Hausaufgaben\nbreak – Pause\n\nUnit 4\ntimetable - Stundenplan');
  assert.equal(r.units[0].topic, 'School life'); assert.equal(r.units[0].words.length, 2); assert.equal(r.units[1].name, 'Unit 4');
});
test('vocabulary import: spreadsheet rows', () => {
  const r = vocab.parseRows([['word', 'german', 'unit'], ['cast', 'Besetzung', 'Unit 8'], ['plot', 'Handlung', '8']]);
  assert.equal(r.units.length, 1); assert.equal(r.units[0].words.length, 2);
});
test('validation catches inconsistent settings', () => {
  const ctx = { textbook: fixture.textbooks()[0], unit: fixture.textbooks()[0].units[0] };
  const s = core.normalizeState({ kind: 'listening', textbookId: 'x', unitId: 'y', topicMode: 'custom', customTopic: '', questionFormats: [] });
  const keys = core.validateState(s, ctx).map(e => e.key);
  assert.ok(keys.includes('customTopic')); assert.ok(keys.includes('questionFormats'));
});
test('renderer escapes HTML', () => {
  const m = fixture.material();
  m.worksheet.questions[0].prompt = '<script>alert(1)</script>';
  assert.ok(!render.renderStudentHTML(m).includes('<script>'));
});
test('every schema key renders a control', () => {
  for (const def of core.SCHEMA) assert.ok(formHtml.includes(`data-setting="${def.key}"`), def.key);
});
test('every prompt stays well under the 64 KiB limit with a large unit', () => {
  const tb = fixture.textbooks()[0]; const unit = JSON.parse(JSON.stringify(tb.units[0]));
  for (let i = 0; i < 120; i++) unit.words.push({ word: 'word' + i, translation: 'Wort ' + i, note: 'example sentence number ' + i });
  const s = core.normalizeState({ kind: 'listening', textbookId: tb.id, unitId: unit.id, preTask: true, higherOrder: true, questionCount: '15', questionFormats: core.FORMAT_KEYS.slice() });
  const p = prompts.buildAllPrompts(s, { textbook: tb, unit });
  for (const k of Object.keys(p)) assert.ok(Buffer.byteLength(p[k], 'utf8') < 40000, k + ' ' + Buffer.byteLength(p[k], 'utf8'));
});

/* ---------------- vocabulary lists ---------------- */
console.log('\nVocabulary lists');

test('a vocabulary list can be built from scratch in a new textbook', () => {
  const parsed = vocab.parseText('box office\tKinokasse\ncast\tBesetzung\nplot\tHandlung');
  const fresh = { id: vocab.makeId('tb'), name: 'English Plus 4', units: [] };
  const built = vocab.mergeUnits(fresh, parsed.units.map(u => ({ name: 'Unit 8', topic: 'Movies', words: u.words })), 'add');
  assert.equal(built.units.length, 1);
  assert.equal(built.units[0].name, 'Unit 8');
  assert.equal(built.units[0].topic, 'Movies');
  assert.equal(built.units[0].words.length, 3);
  assert.ok(built.units[0].id, 'unit id assigned');
});

test('everything can go into one single new unit', () => {
  const parsed = vocab.parseText('Unit 1: A\nalpha - eins\nUnit 2: B\nbeta - zwei\ngamma - drei');
  assert.equal(parsed.units.length, 2);
  const flat = vocab.flattenUnits(parsed.units, 'Unit 12', 'Everything');
  assert.equal(flat.length, 1);
  assert.equal(flat[0].name, 'Unit 12');
  assert.equal(flat[0].topic, 'Everything');
  assert.deepEqual(flat[0].words.map(w => w.word), ['alpha', 'beta', 'gamma']);
});

test('regrouping by detected units never loses or reorders a word', () => {
  const words = Array.from({ length: 20 }, (_, i) => ({ word: 'w' + (i + 1), translation: '' }));
  const src = [{ name: 'Unit 1', topic: '', words }];
  const cases = [
    [{ name: 'A', topic: 't', from: 1, to: 5 }, { name: 'B', topic: 'u', from: 6, to: 20 }],
    [{ name: 'A', from: 1, to: 4 }, { name: 'B', from: 9, to: 12 }],
    [{ name: 'A', from: 3, to: 30 }],
    [{ name: 'A', from: 10, to: 2 }],
    [{ from: 1, to: 20 }],
    [],
  ];
  for (const groups of cases) {
    const r = vocab.applyGroups(src, groups);
    assert.deepEqual(r.units.flatMap(u => u.words.map(w => w.word)), words.map(w => w.word), JSON.stringify(groups));
    assert.ok(r.units.every(u => u.name), 'every unit is named: ' + JSON.stringify(groups));
  }
});

test('topics can be applied to read-only (frozen) units from the store', () => {
  const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  const stored = deepFreeze([
    { id: 'u1', name: 'Unit 1', topic: '', words: [{ word: 'cast' }] },
    { id: 'u2', name: 'Unit 2', topic: 'Kept', words: [{ word: 'delay' }] },
    { id: 'u3', name: 'Unit 3', topic: '', words: [{ word: 'plot' }] },
  ]);
  const rows = [{ unit: 'Unit 1', topic: 'Films and cinema' }, { unit: 'Unit 2', topic: 'Overwritten' }, { unit: 'Unit 3', topic: 'Travel' }];
  const updated = vocab.withTopics(stored, rows, true);
  assert.equal(updated[0].topic, 'Films and cinema');
  assert.equal(updated[1].topic, 'Kept', 'an existing topic is not overwritten');
  assert.equal(updated[2].topic, 'Travel');
  assert.equal(stored[0].topic, '', 'the frozen original is untouched');
  assert.notEqual(updated[0], stored[0]);
  assert.equal(updated[1], stored[1], 'unchanged units are reused');
  // positional fallback when Claude echoes the names differently
  const byIndex = vocab.withTopics(stored, [{ unit: 'A', topic: 'One' }, { unit: 'B', topic: 'Two' }, { unit: 'C', topic: 'Three' }], true);
  assert.equal(byIndex[0].topic, 'One');
  assert.equal(byIndex[2].topic, 'Three');
  // editing a single unit of a frozen list
  const patched = vocab.withUnitPatch(stored, 'u3', { topic: 'Manually typed' });
  assert.equal(patched[2].topic, 'Manually typed');
  assert.equal(stored[2].topic, '');
});

test('applying topics never throws on frozen input, whatever Claude returns', () => {
  const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  const units = deepFreeze([{ id: 'u1', name: 'Unit 1', topic: '', words: [] }]);
  for (const rows of [null, undefined, [], [null], [{}], [{ topic: '' }], [{ unit: 'Unit 1' }], [{ unit: 'Unit 1', topic: 'X' }], 'nonsense']) {
    const r = vocab.withTopics(units, Array.isArray(rows) ? rows : [], true);
    assert.equal(r.length, 1, JSON.stringify(rows));
  }
});

test('unit detection prompt carries the list and asks for complete coverage', () => {
  const words = [{ word: 'cast', translation: 'Besetzung' }, { word: 'sequel', translation: 'Fortsetzung' }];
  const p = prompts.buildUnitDetectPrompt(words, 'aus Unit 8');
  assert.ok(p.includes('1. cast — Besetzung'));
  assert.ok(p.includes('aus Unit 8'));
  assert.ok(/without gaps or overlaps/.test(p));
  const many = prompts.buildUnitDetectPrompt(Array.from({ length: 400 }, (_, i) => ({ word: 'w' + i, translation: 'lange Übersetzung ' + i })), '');
  assert.ok(Buffer.byteLength(many, 'utf8') < 40000, 'prompt for a long list stays small: ' + Buffer.byteLength(many, 'utf8'));
  assert.ok(!many.includes('lange Übersetzung'), 'translations are dropped for long lists');
});

test('the interface uses its own dialogs, never window.prompt/confirm/alert', () => {
  assert.ok(!/(^|[^\w.$])(window\.)?(prompt|confirm|alert)\s*\(/m.test(uiSource), 'native dialog call found in ui.js');
  assert.ok(/function askText/.test(uiSource) && /function askConfirm/.test(uiSource));
  assert.ok(html.includes('id="dlg"') && html.includes('id="dlg-ok"'));
});

test('the import form offers a brand-new textbook as target', () => {
  assert.ok(html.includes('value="__new__"'), 'no new-textbook option');
  assert.ok(html.includes('id="import-new-textbook"'), 'no name field for the new textbook');
  assert.ok(html.includes('id="import-unit-mode"'), 'no unit mode select');
});

/* ---------------- Word export ---------------- */
console.log('\nWord export');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrmaster-docx-'));

test('generated package is a ZIP that an independent reader accepts', () => {
  const m = fixture.material({ preTask: true, higherOrder: true }, 'listening');
  const files = { student: word.buildStudent(m), teacher: word.buildTeacher(m) };
  for (const [which, bytes] of Object.entries(files)) fs.writeFileSync(path.join(tmp, which + '.docx'), Buffer.from(bytes));
  const script = [
    'import sys, zipfile, xml.etree.ElementTree as ET, json',
    'out = []',
    'for p in sys.argv[1:]:',
    '    z = zipfile.ZipFile(p)',
    '    assert z.testzip() is None, p',
    '    names = z.namelist()',
    '    assert names[0] == "[Content_Types].xml", names[0]',
    '    for n in names:',
    '        if n.endswith(".xml") or n.endswith(".rels"): ET.fromstring(z.read(n))',
    '    out.append(len(names))',
    'print(json.dumps(out))',
  ].join('\n');
  const res = execFileSync('python3', ['-c', script, path.join(tmp, 'student.docx'), path.join(tmp, 'teacher.docx')], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(res), [7, 7]);
});

test('every text type produces a valid package for both versions', () => {
  for (const type of core.TEXT_TYPES) {
    const m = fixture.material({ textType: type, customTextType: 'Show notes', preTask: true, higherOrder: true }, 'reading');
    for (const which of ['student', 'teacher']) {
      const problems = ooxml.validate(word.partsFor(m, which));
      assert.deepEqual(problems, [], type + '/' + which + ': ' + problems.join(' | '));
    }
  }
});

test('the validator rejects a document with elements out of schema order', () => {
  const bad = [
    { name: '[Content_Types].xml', data: '<?xml version="1.0"?><Types xmlns="x"><Default Extension="xml" ContentType="a"/><Default Extension="rels" ContentType="b"/><Override PartName="/word/document.xml" ContentType="c"/><Override PartName="/word/styles.xml" ContentType="d"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0"?><Relationships xmlns="x"><Relationship Id="rId1" Type="t" Target="word/document.xml"/></Relationships>' },
    { name: 'word/styles.xml', data: '<?xml version="1.0"?><w:styles xmlns:w="w"/>' },
    { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0"?><Relationships xmlns="x"/>' },
    { name: 'word/document.xml', data: '<?xml version="1.0"?><w:document xmlns:w="w"><w:body><w:p><w:pPr><w:jc w:val="both"/><w:spacing w:after="20"/></w:pPr><w:r><w:t>x</w:t><w:rPr><w:b/></w:rPr></w:r></w:p><w:sectPr/></w:body></w:document>' },
  ];
  const problems = ooxml.validate(bad);
  assert.ok(problems.some(p => /<w:spacing> must come before <w:jc>/.test(p)), problems.join(' | '));
  assert.ok(problems.some(p => /<w:rPr> must be the first child/.test(p)), problems.join(' | '));
});

test('the validator rejects a dangling relationship and an empty table cell', () => {
  const parts = word.partsFor(fixture.material(), 'student').map(p => Object.assign({}, p));
  const doc = parts.find(p => p.name === 'word/document.xml');
  doc.data = String(doc.data).replace('<w:body>', '<w:body><w:p><w:r><w:drawing r:id="rIdNope"/></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="100" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="100"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="100" w:type="dxa"/></w:tcPr></w:tc></w:tr></w:tbl>');
  const problems = ooxml.validate(parts);
  assert.ok(problems.some(p => /rIdNope/.test(p)), problems.join(' | '));
  assert.ok(problems.some(p => /empty <w:tc>/.test(p)), problems.join(' | '));
});

test('the same material always produces the same bytes', () => {
  const m = fixture.material({}, 'reading');
  assert.deepEqual(Array.from(word.buildStudent(m)), Array.from(word.buildStudent(m)));
});

test('documents stay small enough to send', () => {
  const m = fixture.material({ preTask: true, higherOrder: true }, 'listening');
  assert.ok(word.buildTeacher(m).length < 400000, 'teacher document too large');
});

test('the student document never contains answers, model answers or an answer key', () => {
  for (const kind of ['listening', 'reading']) {
    const m = fixture.material({ higherOrder: true }, kind);
    const text = ooxml.textOf(word.partsFor(m, 'student')).replace(/\s+/g, '');
    assert.ok(!text.includes('Answerkey'), kind);
    assert.ok(!text.includes(m.worksheet.higherOrder[0].answer.replace(/\s+/g, '')), kind + ': higher-order model answer leaked');
    assert.ok(!text.includes('Fixturespecificanswer'), kind + ': short answer leaked');
    assert.ok(!text.includes(m.worksheet.questions[3].rationale.replace(/\s+/g, '')), kind + ': rationale leaked');
    if (kind === 'listening') {
      for (const q of m.worksheet.questions) assert.ok(!text.includes(q.evidenceQuote.replace(/\s+/g, '')), 'evidence leaked for Q' + q.n);
    }
  }
});

test('a listening worksheet with every response format stays valid', () => {
  const m = fixture.material({}, 'listening');
  m.worksheet.questions = core.FORMAT_KEYS.map((f, i) => ({
    n: i + 1, skill: 'detail', format: f, difficulty: 'B1.1', prompt: 'Prompt ' + (i + 1),
    options: ['one', 'two', 'three'], items: f === 'matching' ? [{ left: 'a', right: 'b' }, { left: 'c', right: 'd' }] : ['first', 'second'],
    table: { headers: ['A', 'B'], rows: [['x', ''], ['', 'y']] },
    answer: f === 'gap_fill' || f === 'note_taking' || f === 'select_all' ? ['one', 'two'] : 'one',
    evidenceQuote: 'trust him', evidenceRef: '[4]', rationale: '',
  }));
  assert.deepEqual(ooxml.validate(word.partsFor(m, 'student')), []);
  assert.deepEqual(ooxml.validate(word.partsFor(m, 'teacher')), []);
});

test('documents survive hostile text (XML metacharacters, control characters, emoji)', () => {
  const m = fixture.material({}, 'reading');
  m.content.title = 'A & B <tag> "quoted" \u0007bell';
  m.content.paragraphs = ['Text with <w:p> and & and ]]> and emoji 🎧', 'Second & paragraph'];
  m.worksheet.questions[0].prompt = '</w:t></w:r><w:r><w:t>injected';
  const parts = word.partsFor(m, 'student');
  assert.deepEqual(ooxml.validate(parts), []);
  const xml = String(parts.find(p => p.name === 'word/document.xml').data);
  assert.ok(!xml.includes('<w:t>injected'), 'injection not escaped');
  assert.ok(xml.includes('&amp;'), 'ampersand not escaped');
});

/* ---------------- concept coverage ---------------- */
console.log('\nConcept coverage (app/manifest.js)');
const hasControl = (selector) => {
  // Static check: data-setting / id / data-* attribute selectors against the rendered form and index.html.
  const src = formHtml + '\n' + html;
  let m;
  if ((m = /^\[([\w-]+)="([^"]+)"\]$/.exec(selector))) return src.includes(`${m[1]}="${m[2]}"`);
  if ((m = /^#([\w-]+)(\[([\w-]+)="([^"]+)"\])?$/.exec(selector))) {
    if (!src.includes(`id="${m[1]}"`)) return false;
    if (m[2]) { const re = new RegExp(`id="${m[1]}"[^>]*${m[3]}="${m[4]}"|${m[3]}="${m[4]}"[^>]*id="${m[1]}"`); return re.test(src); }
    return true;
  }
  return src.includes(selector);
};
const pipelineSource = uiSource.slice(uiSource.indexOf('async function generate('), uiSource.indexOf('/* end generate */'));
assert.ok(pipelineSource.length > 500, 'generate() pipeline not found in ui.js');
const cov = checks.run({ hasControl, pipelineSource, uiSource, pipeline: true });
for (const r of cov.results) {
  if (r.status === 'pass') passes++; else failures++;
  console.log(`  ${r.status === 'pass' ? '✓' : '✗'} ${r.id} — ${r.title}${r.detail ? '\n      ' + r.detail : ''}`);
}

console.log(`\n${passes} passed, ${failures} failed (concept requirements: ${cov.summary.pass}/${cov.summary.total})`);
process.exit(failures ? 1 : 0);
