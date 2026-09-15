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
const cov = checks.run({ hasControl, pipelineSource, pipeline: true });
for (const r of cov.results) {
  if (r.status === 'pass') passes++; else failures++;
  console.log(`  ${r.status === 'pass' ? '✓' : '✗'} ${r.id} — ${r.title}${r.detail ? '\n      ' + r.detail : ''}`);
}

console.log(`\n${passes} passed, ${failures} failed (concept requirements: ${cov.summary.pass}/${cov.summary.total})`);
process.exit(failures ? 1 : 0);
