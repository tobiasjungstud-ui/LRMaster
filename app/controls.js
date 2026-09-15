/*
 * LRMaster controls — renders the creator form from core.SCHEMA as HTML.
 * Pure string output so the concept checks can prove that every setting has
 * a control (data-setting="<key>") without a browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else { root.LR = root.LR || {}; root.LR.controls = factory(root.LR.core); }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  const OPTION_LABELS = {
    topicMode: { unit: 'Use Unit Topic', custom: 'Custom Topic' },
    format: { monologue: 'Monologue', dialogue: 'Dialogue – 2 speakers', conversation: 'Conversation – X speakers' },
    speakerBalance: { balanced: 'Balanced', natural: 'Natural Variation', main: 'Main Speaker', custom: 'Custom' },
    emotionTags: { off: 'OFF', low: 'Low', medium: 'Medium', high: 'High' },
    lengthMode: { words: 'Word count', a4: 'Approximate A4 length' },
    a4Pages: { '0.5': '½ page', '1': '1 page', '1.5': '1½ pages', '2': '2 pages' },
    paragraphLength: { short: 'Short', medium: 'Medium', long: 'Long' },
    vocabSelectionMode: { auto: 'Automatic (Claude picks from the unit)', manual: 'Select vocabulary manually' },
    questionCount: { custom: 'Custom' },
    skillMixMode: { auto: 'Balanced Question Mix (automatic)', custom: 'Custom Question Mix' },
    audioLength: Object.fromEntries(core.AUDIO_LENGTHS.map(a => [a.key, a.label])),
    preset: Object.fromEntries(core.PRESETS.map(p => [p.key, p.label])),
    cefr: {},
    textType: {},
    speakerCount: {},
  };

  const RANGE_ENDS = {
    languageComplexity: ['Simple', 'Complex'],
    grammarComplexity: ['Elementary', 'Full range'],
    vocabularyDifficulty: ['Frequent words', 'Demanding'],
    idiomaticLanguage: ['None', 'Very frequent'],
    turnLength: ['Short', 'Long'],
    turnVariability: ['Low', 'High'],
    speakingSpeed: ['Slow', 'Fast'],
    naturalness: ['Clean / Educational', 'Authentic'],
    explicitness: ['Very Explicit', 'Highly Implicit'],
    dialogueProportion: ['No dialogue', 'All dialogue'],
    styleBalance: ['Narrative', 'Informational'],
    vocabUsage: ['Low', 'High'],
    questionDifficulty: ['Easy', 'Challenging'],
    distractorDifficulty: ['Obvious', 'Demanding'],
    inferenceLevel: ['Close to text', 'Deep'],
  };

  const HELP = {
    useUnitTopic: 'ON: content clearly follows the unit topic. OFF: mainly the vocabulary is used and the topic is free.',
    languageComplexity: 'Sentence length, grammar, idioms, synonyms, conversational language, explicitness.',
    explicitness: 'How easily information can be taken from the material. Implicit material enables inference questions.',
    turnVariability: 'High: some speakers only say “Really?” while others speak several sentences.',
    emotionTags: 'Tags such as [hesitant] or [laughing] are used selectively and can later drive a TTS system.',
    naturalness: 'Higher values add contractions, fillers, hesitation, reactions, reformulations and interruptions – always within the CEFR level.',
    vocabUsage: 'How prominently the target vocabulary is used. Words are never forced into the text.',
    questionDifficulty: 'Independent of the text level. Affects explicitness, distance, synonyms, combinations, distractors, inference share and question language.',
    followChronology: 'Questions appear in the order of the information. Gist questions may stand first or last.',
    higherOrder: 'Interpretation, transfer and evaluation tasks are kept separate from the comprehension questions.',
    preTask: 'Prediction, vocabulary activation or a speaking prompt. Never gives away answers.',
    autoFormatMix: 'ON: the app assigns the enabled formats evenly to the questions. OFF: Claude chooses freely among the enabled formats.',
    speakingSpeed: 'Determines the words per minute used to convert the audio length into a word count.',
  };

  function optionLabel(key, value) {
    const m = OPTION_LABELS[key] || {};
    if (m[value] !== undefined) return m[value];
    return String(value);
  }

  function control(def) {
    const id = 'set-' + def.key;
    const help = HELP[def.key] ? `<p class="help">${esc(HELP[def.key])}</p>` : '';
    const attrs = `id="${id}" data-setting="${def.key}" name="${def.key}"`;
    switch (def.type) {
      case 'toggle':
        return `<div class="field field-toggle" data-field="${def.key}"><label class="switch"><input type="checkbox" ${attrs}><span class="track"></span><span class="lbl">${esc(def.label)}</span></label>${help}</div>`;
      case 'range': {
        const ends = RANGE_ENDS[def.key] || ['Low', 'High'];
        return `<div class="field field-range" data-field="${def.key}"><label for="${id}">${esc(def.label)} <output for="${id}" class="val"></output></label><div class="range-row"><span class="end">${esc(ends[0])}</span><input type="range" min="${def.min}" max="${def.max}" step="1" ${attrs}><span class="end">${esc(ends[1])}</span></div>${help}</div>`;
      }
      case 'number':
        return `<div class="field field-number" data-field="${def.key}"><label for="${id}">${esc(def.label)}</label><input type="number" min="${def.min}" max="${def.max}" step="1" ${attrs}>${help}</div>`;
      case 'select':
        return `<div class="field field-select" data-field="${def.key}"><label for="${id}">${esc(def.label)}</label><select ${attrs}>${(def.options || []).map(o => `<option value="${esc(o)}">${esc(optionLabel(def.key, o))}</option>`).join('')}</select>${help}</div>`;
      case 'multiselect': {
        const labels = def.key === 'questionFormats' ? Object.fromEntries(core.QUESTION_FORMATS.map(f => [f.key, f.label]))
          : def.key === 'higherOrderTypes' ? Object.fromEntries(core.HIGHER_ORDER_TYPES.map(t => [t.key, t.label]))
          : def.key === 'preTaskTypes' ? Object.fromEntries(core.PRE_TASK_TYPES.map(t => [t.key, t.label])) : {};
        return `<fieldset class="field field-multi" data-field="${def.key}" data-setting="${def.key}" id="${id}"><legend>${esc(def.label)}</legend><div class="chips">${def.options.map(o => `<label class="chip"><input type="checkbox" value="${esc(o)}" data-multi="${def.key}"><span>${esc(labels[o] || o)}</span></label>`).join('')}</div>${help}</fieldset>`;
      }
      case 'text':
        return `<div class="field field-text" data-field="${def.key}"><label for="${id}">${esc(def.label)}</label><input type="text" ${attrs}>${help}</div>`;
      case 'list':
      case 'map':
        return `<div class="field field-custom" data-field="${def.key}" data-setting="${def.key}" id="${id}"><div class="field-label">${esc(def.label)}</div><div class="custom-body"></div>${help}</div>`;
      default:
        return '';
    }
  }

  const SECTIONS = [
    { n: 1, id: 'source', title: 'Source & Unit' },
    { n: 2, id: 'content', title: 'Content' },
    { n: 3, id: 'level', title: 'Language Level' },
    { n: 4, id: 'structure', title: 'Text / Audio Structure' },
    { n: 5, id: 'vocab', title: 'Vocabulary' },
    { n: 6, id: 'worksheet', title: 'Worksheet & Questions' },
    { n: 7, id: 'advanced', title: 'Advanced Settings' },
    { n: 8, id: 'generate', title: 'Generate' },
  ];

  // Ordering inside sections follows the concept.
  const ORDER = {
    1: ['textbookId', 'unitId', 'useUnitTopic'],
    2: ['topicMode', 'customTopic'],
    3: ['cefr', 'languageComplexity'],
    4: ['format', 'speakerCount', 'preset', 'speakerBalance', 'customShares', 'turnLength', 'turnVariability', 'audioLength', 'audioLengthCustom', 'speakingSpeed', 'speakerProfiles', 'emotionTags', 'naturalness', 'explicitness',
        'textType', 'customTextType', 'lengthMode', 'wordCount', 'a4Pages'],
    5: ['vocabUsage', 'targetVocabMin', 'targetVocabMax', 'vocabSelectionMode', 'selectedVocab', 'highlightVocab'],
    6: ['createWorksheet', 'questionCount', 'questionCountCustom', 'questionDifficulty', 'skillMixMode', 'customSkillMix', 'questionFormats', 'autoFormatMix', 'followChronology', 'higherOrder', 'higherOrderCount', 'higherOrderTypes', 'preTask', 'preTaskTypes'],
    7: ['grammarComplexity', 'vocabularyDifficulty', 'idiomaticLanguage', 'paragraphLength', 'dialogueProportion', 'styleBalance', 'distractorDifficulty', 'inferenceLevel'],
  };

  const ADVANCED_GROUPS = [
    { title: 'Audio', keys: ['speakerCount', 'customShares', 'turnLength', 'turnVariability', 'speakingSpeed', 'naturalness', 'emotionTags', 'explicitness'] },
    { title: 'Text', keys: ['wordCount', 'paragraphLength', 'dialogueProportion', 'styleBalance'] },
    { title: 'Language', keys: ['cefr', 'grammarComplexity', 'vocabularyDifficulty', 'vocabUsage', 'idiomaticLanguage'] },
    { title: 'Questions', keys: ['questionCount', 'questionDifficulty', 'skillMixMode', 'questionFormats', 'distractorDifficulty', 'inferenceLevel', 'followChronology'] },
  ];

  function extras(sectionN) {
    switch (sectionN) {
      case 2: return '<div class="field field-actions" data-field="topicSuggest"><button type="button" class="btn secondary" id="btn-suggest-topics">Generate topic for me</button><div id="topic-suggestions" class="suggestions" hidden></div></div>';
      case 4: return '<div class="field field-actions" data-mode="listening" data-field="turnPresets"><div class="field-label">Turn length presets</div><div class="chips" id="turn-presets">' + Object.keys(core.TURN_PRESETS).map(k => `<button type="button" class="chip-btn" data-turn-preset="${k}" title="${esc(core.TURN_PRESETS[k].hint)}">${esc(core.TURN_PRESETS[k].label)}</button>`).join('') + '</div><p class="help" id="audio-estimate"></p></div>';
      case 7: return '<div class="advanced-index"><p class="help">All fine-grained controls at a glance. Values shown here are the same settings as in the sections above.</p>' + ADVANCED_GROUPS.map(g => `<div class="adv-group"><h4>${g.title}</h4><ul>${g.keys.map(k => `<li><a href="#" data-jump="${k}">${esc(core.SCHEMA_BY_KEY[k] ? core.SCHEMA_BY_KEY[k].label : k)}</a></li>`).join('')}</ul></div>`).join('') + '</div>';
      case 8: return '<div id="validation" class="validation" hidden></div><div id="plan-preview" class="plan-preview"></div><div class="generate-row"><button type="button" class="btn primary" id="btn-generate">Generate</button><button type="button" class="btn danger" id="btn-stop" hidden>Stop</button><span id="claude-status" class="status"></span></div><div id="progress" class="progress" hidden></div>';
      default: return '';
    }
  }

  function renderForm() {
    let html = '';
    for (const sec of SECTIONS) {
      const keys = ORDER[sec.n] || [];
      html += `<section class="step" id="sec-${sec.id}" data-step="${sec.n}"><h2 class="step-title"><button type="button" class="step-toggle" aria-expanded="true" data-toggle-step="${sec.n}"><span class="step-no">${sec.n}</span>${esc(sec.title)}</button></h2><div class="step-body">`;
      for (const k of keys) {
        const def = core.SCHEMA_BY_KEY[k];
        if (!def) continue;
        html += `<div class="ctl" data-mode="${def.mode}" data-simple="${def.simple ? '1' : '0'}" data-key="${def.key}">${control(def)}</div>`;
      }
      html += extras(sec.n);
      html += '</div></section>';
    }
    return html;
  }

  return { control, renderForm, SECTIONS, ORDER, ADVANCED_GROUPS, optionLabel, OPTION_LABELS, RANGE_ENDS, HELP };
});
