/*
 * LRMaster checks — runs the concept manifest against the real modules.
 * Used by `npm test` (Node) and by the in-app page "Konzept-Check".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'), require('./prompts.js'), require('./quality.js'), require('./render.js'), require('./vocab.js'), require('./manifest.js'), require('./fixture.js'), require('./word.js'), require('./ooxml.js'), require('./level.js'), require('./controls.js'), require('./mock.js'), require('./photo.js'));
  } else {
    root.LR = root.LR || {};
    root.LR.checks = factory(root.LR.core, root.LR.prompts, root.LR.quality, root.LR.render, root.LR.vocab, root.LR.manifest, root.LR.fixture, root.LR.word, root.LR.ooxml, root.LR.level, root.LR.controls, root.LR.mock, root.LR.photo);
  }
})(typeof self !== 'undefined' ? self : this, function (core, prompts, quality, render, vocab, manifest, fixture, word, ooxml, level, controls, mock, photo) {
  'use strict';

  function makeEnv(opts) {
    opts = opts || {};
    const textbooks = fixture.textbooks();
    const tb = textbooks[0];
    const unit = tb.units[0];
    const ctx = { textbook: tb, unit };
    const env = {
      core, prompts, quality, render, vocab, word, ooxml, level, controls, mock, photo, textbooks, ctx,
      hasControl: opts.hasControl || (() => false),
      pipelineSource: opts.pipelineSource || '',
      uiSource: opts.uiSource || '',
      pipeline: opts.pipeline,
      state(overrides) {
        const kind = overrides && overrides.kind === 'reading' ? 'reading' : 'listening';
        const base = core.defaults(kind);
        base.textbookId = tb.id; base.unitId = unit.id;
        const s = core.normalizeState(Object.assign(base, overrides || {}));
        // Placeholders for real vocabulary of the fixture unit.
        if (Array.isArray(s.selectedVocab)) s.selectedVocab = s.selectedVocab.map(w => /^__W(\d+)__$/.test(w) ? unit.words[Number(/\d+/.exec(w)[0])].word : w);
        return s;
      },
      fixture: {
        content: (kind) => fixture.content(kind || 'listening'),
        material: (overrides, kind) => fixture.material(Object.assign({ textbookId: tb.id, unitId: unit.id }, overrides || {}), kind || 'listening', ctx),
        levelSample: (name) => fixture.levelSample(name),
      },
    };
    return env;
  }

  function substitute(v, unit) {
    if (Array.isArray(v)) return v.map(x => (typeof x === 'string' && /^__W(\d+)__$/.test(x)) ? unit.words[Number(/\d+/.exec(x)[0])].word : x);
    return v;
  }

  function checkSetting(req, env) {
    const def = core.SCHEMA_BY_KEY[req.key];
    if (!def) return 'not in SCHEMA';
    if (!env.hasControl(`[data-setting="${req.key}"]`)) return 'no control with data-setting="' + req.key + '"';
    if (req.promptSensitive === false) return true;
    const kind = req.mode === 'reading' ? 'reading' : 'listening';
    const given = Object.assign({ kind }, req.given || {});
    const base = env.state(given);
    let ctxA = env.ctx, ctxB = env.ctx;
    let altState;
    if (req.altCtx === 'textbook2') {
      const tb2 = env.textbooks[1];
      altState = Object.assign({}, base, { textbookId: tb2.id, unitId: tb2.units[0].id });
      ctxB = { textbook: tb2, unit: tb2.units[0] };
    } else if (req.altCtx === 'unit2') {
      const u2 = env.textbooks[0].units[1];
      altState = Object.assign({}, base, { unitId: u2.id });
      ctxB = { textbook: env.textbooks[0], unit: u2 };
    } else {
      altState = core.normalizeState(Object.assign({}, base, { [req.key]: substitute(req.alt, env.ctx.unit) }));
      if (JSON.stringify(altState[req.key]) === JSON.stringify(base[req.key])) return `alt value ${JSON.stringify(req.alt)} equals the default; test is void`;
    }
    const a = prompts.buildAllPrompts(base, ctxA);
    const b = prompts.buildAllPrompts(altState, ctxB);
    if (JSON.stringify(a) === JSON.stringify(b)) return 'changing the setting does not change any prompt';
    return true;
  }

  function runOne(req, env) {
    try {
      let r;
      switch (req.kind) {
        case 'setting': r = checkSetting(req, env); break;
        case 'function': r = req.check(env); break;
        case 'render': r = req.check(env); break;
        case 'ui': r = env.hasControl(req.selector) ? true : `element ${req.selector} not found`; break;
        case 'rule': {
          const rule = quality.RULES.find(x => x.id === req.ruleId);
          r = rule ? (rule.kind === 'deterministic' ? (typeof rule.check === 'function' || 'rule has no check()') : (rule.criterion ? true : 'llm rule has no criterion')) : `rule ${req.ruleId} missing`;
          break;
        }
        default: r = 'unknown kind ' + req.kind;
      }
      if (r === true && typeof req.extra === 'function') r = req.extra(env);
      return { id: req.id, section: req.section, title: req.title, kind: req.kind, key: req.key || req.ruleId || req.selector || '', status: r === true ? 'pass' : 'fail', detail: r === true ? '' : String(r) };
    } catch (e) {
      return { id: req.id, section: req.section, title: req.title, kind: req.kind, key: req.key || req.ruleId || req.selector || '', status: 'fail', detail: 'exception: ' + (e && e.message || e) };
    }
  }

  function run(opts) {
    const env = makeEnv(opts);
    const results = manifest.REQUIREMENTS.map(r => runOne(r, env));
    // Completeness: every generation setting in SCHEMA must be claimed by some requirement.
    const claimed = new Set(manifest.REQUIREMENTS.filter(r => r.kind === 'setting').map(r => r.key));
    for (const def of core.SCHEMA) {
      if (!claimed.has(def.key)) results.push({ id: 'X.unclaimed_' + def.key, section: 0, title: `Setting „${def.key}“ ist keiner Konzept-Anforderung zugeordnet`, kind: 'meta', key: def.key, status: 'fail', detail: 'add a manifest entry' });
    }
    // Completeness: every quality rule must be claimed.
    const claimedRules = new Set(manifest.REQUIREMENTS.filter(r => r.kind === 'rule').map(r => r.ruleId));
    for (const rule of quality.RULES) {
      if (!claimedRules.has(rule.id)) results.push({ id: 'X.rule_' + rule.id, section: 29, title: `Quality rule „${rule.id}“ (${rule.title}) – zusätzliche Regel über das Konzept hinaus`, kind: 'meta', key: rule.id, status: 'pass', detail: 'extra rule' });
    }
    const summary = { total: results.length, pass: results.filter(r => r.status === 'pass').length, fail: results.filter(r => r.status === 'fail').length };
    return { results, summary };
  }

  return { run, makeEnv, runOne };
});
