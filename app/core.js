/*
 * LRMaster core — settings schema, defaults, derived values and planning.
 * Pure functions only: no DOM, no network. Works in the browser (window.LR.core)
 * and in Node (module.exports) so the same code is tested and shipped.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LR = root.LR || {}; root.LR.core = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Reference lists (structural data from the concept document)          */
  /* ------------------------------------------------------------------ */

  const CEFR_BANDS = ['A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2'];

  const SKILLS = [
    { key: 'gist',       label: 'Gist / Global Understanding',   short: 'Gist' },
    { key: 'specific',   label: 'Specific Information',          short: 'Specific' },
    { key: 'detail',     label: 'Detailed Understanding',        short: 'Detail' },
    { key: 'connecting', label: 'Connecting Information',        short: 'Connecting' },
    { key: 'inference',  label: 'Inference / Implicit Meaning',  short: 'Inference' },
    { key: 'attitude',   label: 'Attitude, Emotion & Opinion',   short: 'Attitude' },
    { key: 'purpose',    label: 'Purpose & Intention',           short: 'Purpose' },
    { key: 'context',    label: 'Context',                       short: 'Context' },
  ];
  const SKILL_KEYS = SKILLS.map(s => s.key);

  const HIGHER_ORDER_TYPES = [
    { key: 'interpretation', label: 'Interpretation' },
    { key: 'transfer',       label: 'Transfer' },
    { key: 'evaluation',     label: 'Evaluation' },
  ];

  const QUESTION_FORMATS = [
    { key: 'multiple_choice',       label: 'Multiple Choice' },
    { key: 'true_false',            label: 'True / False' },
    { key: 'true_false_correction', label: 'True / False + Correction' },
    { key: 'short_answer',          label: 'Short Answer' },
    { key: 'wh_question',           label: 'Wh-Questions' },
    { key: 'sentence_completion',   label: 'Sentence Completion' },
    { key: 'gap_fill',              label: 'Gap Fill' },
    { key: 'matching',              label: 'Matching' },
    { key: 'who_said_it',           label: 'Who said it?', listeningOnly: true, needsSpeakers: 2 },
    { key: 'ordering',              label: 'Ordering' },
    { key: 'table_completion',      label: 'Table Completion' },
    { key: 'select_all',            label: 'Select all that apply' },
    { key: 'best_summary',          label: 'Best Summary', skill: 'gist' },
    { key: 'note_taking',           label: 'Note Taking' },
  ];
  const FORMAT_KEYS = QUESTION_FORMATS.map(f => f.key);

  const TEXT_TYPES = [
    'Story', 'Article', 'Blog Post', 'Interview', 'Email', 'Forum Discussion', 'Review',
    'News Article', 'Report', 'Diary Entry', 'Informational Text', 'Opinion Text', 'Dialogue', 'Custom',
  ];

  /*
   * Document designs (§17 text types). Each text type maps to a visual design
   * used by the Word export, and to the extra metadata Claude is asked for so
   * the document can look like the real thing (byline, From/To/Subject, usernames,
   * star rating, …). `fields` drives the prompt; `required` drives a quality warning.
   */
  const META_SPECS = {
    story: { label: 'Story', fields: [
      ['byline', 'the author name printed under the title'],
    ], required: [] },
    article: { label: 'Magazine article', headings: true, fields: [
      ['publication', 'name of the magazine or website it appears in'],
      ['byline', 'author name'],
      ['dateline', 'publication date, e.g. 14 March 2026'],
      ['standfirst', 'one-sentence stand-first printed under the headline'],
      ['pullQuote', 'one short sentence copied verbatim from the text, to be printed as a pull quote'],
    ], required: ['byline', 'standfirst'] },
    news: { label: 'News article', fields: [
      ['publication', 'name of the newspaper or news site'],
      ['byline', 'reporter name'],
      ['dateline', 'publication date'],
      ['location', 'the place the report is filed from, in capitals, e.g. MANCHESTER'],
      ['standfirst', 'one-sentence summary printed under the headline'],
    ], required: ['byline', 'location'] },
    blog: { label: 'Blog post', headings: true, fields: [
      ['blogName', 'name of the blog'],
      ['byline', 'the blogger\'s name or handle'],
      ['dateline', 'posting date'],
      ['readingTime', 'estimated reading time, e.g. "4 min read"'],
      ['tags', 'an array of 3–5 short topic tags'],
    ], required: ['byline', 'tags'] },
    email: { label: 'Email', fields: [
      ['from', 'sender as "Name <address>"'],
      ['to', 'recipient as "Name <address>"'],
      ['subject', 'the subject line'],
      ['sent', 'date and time the mail was sent'],
      ['signature', 'the sign-off block; use line breaks between name, role and contact'],
    ], required: ['from', 'to', 'subject'] },
    forum: { label: 'Forum discussion', fields: [
      ['forumName', 'name of the forum or board'],
      ['threadTitle', 'the thread title'],
      ['authors', 'an array with one username per paragraph, same order and length as "paragraphs"'],
      ['timestamps', 'an array with one short timestamp per paragraph, e.g. "2 h ago"'],
    ], required: ['authors'] },
    interview: { label: 'Interview', fields: [
      ['publication', 'where the interview appears'],
      ['byline', 'the interviewer\'s name'],
      ['standfirst', 'one-sentence introduction to the interview'],
      ['speakers', 'an array with one speaker name per paragraph, same order and length as "paragraphs" (questions come from the interviewer, answers from the guest)'],
    ], required: ['speakers'] },
    review: { label: 'Review', fields: [
      ['subject', 'what is being reviewed'],
      ['category', 'the kind of review, e.g. Film, Restaurant, Game'],
      ['rating', 'the rating as an integer from 1 to 5'],
      ['byline', 'reviewer name'],
      ['verdict', 'one-sentence verdict printed in a box at the end'],
    ], required: ['rating', 'verdict'] },
    report: { label: 'Report', headings: true, fields: [
      ['subtitle', 'the subtitle of the report'],
      ['author', 'who wrote the report'],
      ['dateline', 'the date of the report'],
      ['recipient', 'who the report is addressed to'],
      ['summary', 'a two- to three-sentence executive summary'],
    ], required: ['summary'] },
    diary: { label: 'Diary entry', fields: [
      ['dateline', 'the diary date, e.g. Tuesday, 14 March'],
      ['place', 'where the entry is written'],
    ], required: ['dateline'] },
    informational: { label: 'Informational text', headings: true, fields: [
      ['subtitle', 'a subtitle for the text'],
      ['source', 'where the information comes from'],
      ['factBox', 'an array of 3–5 short facts for a fact box'],
    ], required: ['factBox'] },
    opinion: { label: 'Opinion piece', fields: [
      ['publication', 'where the piece appears'],
      ['byline', 'the columnist\'s name'],
      ['dateline', 'publication date'],
      ['pullQuote', 'one short sentence copied verbatim from the text, to be printed as a pull quote'],
    ], required: ['byline', 'pullQuote'] },
    dialogue: { label: 'Dialogue', fields: [
      ['setting', 'one line describing where the conversation takes place'],
      ['speakers', 'an array with one speaker name per paragraph, same order and length as "paragraphs"'],
    ], required: ['speakers'] },
    custom: { label: 'Text', fields: [
      ['byline', 'author name, or an empty string if the text type has no author'],
      ['standfirst', 'one-sentence introduction, or an empty string'],
    ], required: [] },
    script: { label: 'Audio script', fields: [
      ['setting', 'one line: where and when the recording takes place'],
      ['programme', 'the name of the podcast, programme or show, or an empty string if there is none'],
    ], required: ['setting'] },
  };

  /** Text type (§17) → document design id. */
  const TEXT_TYPE_DESIGN = {
    'Story': 'story', 'Article': 'article', 'Blog Post': 'blog', 'Interview': 'interview',
    'Email': 'email', 'Forum Discussion': 'forum', 'Review': 'review', 'News Article': 'news',
    'Report': 'report', 'Diary Entry': 'diary', 'Informational Text': 'informational',
    'Opinion Text': 'opinion', 'Dialogue': 'dialogue', 'Custom': 'custom',
  };

  /** The design a material uses: listening always uses the audio-script design. */
  function designIdFor(state) {
    if (!state || state.kind !== 'reading') return 'script';
    return TEXT_TYPE_DESIGN[state.textType] || 'custom';
  }

  const EMOTION_TAGS = [
    'excited', 'nervous', 'laughing', 'sarcastic', 'hesitant', 'surprised',
    'annoyed', 'quietly', 'confused', 'relieved', 'thoughtful', 'serious',
  ];

  const PRE_TASK_TYPES = [
    { key: 'prediction', label: 'Prediction' },
    { key: 'vocabulary', label: 'Vocabulary Activation' },
    { key: 'speaking',   label: 'Speaking Prompt' },
  ];

  const AUDIO_LENGTHS = [
    { key: '60', label: '1:00' }, { key: '90', label: '1:30' }, { key: '120', label: '2:00' },
    { key: '150', label: '2:30' }, { key: '180', label: '3:00' }, { key: '240', label: '4:00' },
    { key: '300', label: '5:00' }, { key: 'custom', label: 'Custom' },
  ];

  const QUESTION_COUNTS = ['5', '8', '10', '12', '15', 'custom'];

  /*
   * Conversation presets (concept §9). Each preset is structural data:
   * it rewrites format, speaker count, balance, turn length and variability
   * when applied, and its `structure` line is passed to Claude as the
   * required conversation architecture.
   */
  const PRESETS = [
    { key: 'none', label: 'No preset (manual)', structure: null },
    { key: 'natural', label: 'Natural Conversation', format: 'dialogue', balance: 'natural', turnLength: 45, variability: 70,
      structure: 'a relatively balanced dialogue with natural turn-taking and reactions' },
    { key: 'interview', label: 'Interview', format: 'dialogue', balance: 'custom', shares: [25, 75], turnLength: 55, variability: 80,
      roles: ['Interviewer', 'Guest'],
      structure: 'an interview: the first speaker mostly asks short questions, the second speaker gives longer answers' },
    { key: 'podcast', label: 'Podcast Interview', format: 'dialogue', balance: 'custom', shares: [30, 70], turnLength: 55, variability: 75,
      roles: ['Host', 'Guest'],
      structure: 'a podcast interview: the host guides the conversation and reacts, follow-up questions and reactions are more natural than in a formal interview, the guest has the largest share of the talk' },
    { key: 'discussion', label: 'Discussion', format: 'conversation', speakerCount: 3, balance: 'balanced', turnLength: 45, variability: 65,
      structure: 'a discussion in which several people hold different opinions with relatively balanced speaking shares' },
    { key: 'debate', label: 'Debate', format: 'conversation', speakerCount: 3, balance: 'natural', turnLength: 55, variability: 55,
      structure: 'a debate with clear positions, arguments and counter-arguments' },
    { key: 'expert', label: 'Teacher / Expert Explanation', format: 'dialogue', balance: 'custom', shares: [75, 25], turnLength: 70, variability: 70,
      roles: ['Expert', 'Learner'],
      structure: 'an explanation: one person mainly explains, the second person occasionally asks questions' },
    { key: 'presentation', label: 'TED-Talk / Presentation', format: 'dialogue', balance: 'custom', shares: [92, 8], turnLength: 95, variability: 30,
      roles: ['Speaker', 'Moderator'],
      structure: 'a talk given almost exclusively by one speaker, with an optional short introduction by a moderator' },
    { key: 'storytelling', label: 'Storytelling', format: 'monologue', balance: 'balanced', turnLength: 95, variability: 20,
      structure: 'storytelling by one narrator with a focus on plot and narrative structure' },
    { key: 'news', label: 'News Report', format: 'dialogue', balance: 'custom', shares: [35, 65], turnLength: 65, variability: 50,
      roles: ['News anchor', 'Reporter'],
      structure: 'a news report: an anchor introduces and hands over to a reporter or interview partner' },
    { key: 'casual', label: 'Casual Conversation', format: 'dialogue', balance: 'natural', turnLength: 30, variability: 90,
      structure: 'a casual conversation with short speaker changes, reactions, interruptions and contributions of very different length' },
    { key: 'phone', label: 'Phone Call', format: 'dialogue', balance: 'balanced', turnLength: 20, variability: 45,
      structure: 'a phone call with strongly alternating, usually short turns' },
  ];

  /* ------------------------------------------------------------------ */
  /* Settings schema                                                      */
  /* ------------------------------------------------------------------ */

  /*
   * Every generation setting the concept describes. `mode` says which creator
   * shows it, `simple` whether it is part of Simple Mode, `section` the step
   * (1 Source & Unit … 7 Advanced). The UI renders controls from this table
   * and the concept checks verify that each key has a control and changes the
   * prompt.
   */
  const SCHEMA = [
    // 1 Source & Unit
    { key: 'textbookId', type: 'select', default: '', section: 1, mode: 'both', simple: true, label: 'Lehrmittel' },
    { key: 'unitId', type: 'select', default: '', section: 1, mode: 'both', simple: true, label: 'Unit' },
    { key: 'useUnitTopic', type: 'toggle', default: true, section: 1, mode: 'both', simple: false, label: 'Use unit topic' },
    // 2 Content
    { key: 'topicMode', type: 'select', default: 'unit', options: ['unit', 'custom'], section: 2, mode: 'both', simple: true, label: 'Topic' },
    { key: 'customTopic', type: 'text', default: '', section: 2, mode: 'both', simple: true, label: 'Custom Topic' },
    // 3 Language Level
    { key: 'cefr', type: 'select', default: 'B1.1', options: CEFR_BANDS, section: 3, mode: 'both', simple: true, label: 'CEFR level' },
    { key: 'levelMeter', type: 'toggle', default: true, section: 3, mode: 'both', simple: true, label: 'Schwierigkeit messen und nachsteuern' },
    { key: 'languageComplexity', type: 'range', default: 50, min: 0, max: 100, section: 3, mode: 'both', simple: false, label: 'Language Complexity' },
    { key: 'grammarComplexity', type: 'range', default: 50, min: 0, max: 100, section: 7, mode: 'both', simple: false, label: 'Grammar complexity' },
    { key: 'vocabularyDifficulty', type: 'range', default: 50, min: 0, max: 100, section: 7, mode: 'both', simple: false, label: 'Vocabulary difficulty' },
    { key: 'idiomaticLanguage', type: 'range', default: 40, min: 0, max: 100, section: 7, mode: 'both', simple: false, label: 'Idiomatic language' },
    // 4 Structure — listening
    { key: 'format', type: 'select', default: 'dialogue', options: ['monologue', 'dialogue', 'conversation'], section: 4, mode: 'listening', simple: true, label: 'Format' },
    { key: 'speakerCount', type: 'select', default: 3, options: [3, 4, 5, 6], section: 4, mode: 'listening', simple: true, label: 'Number of speakers' },
    { key: 'preset', type: 'select', default: 'natural', options: PRESETS.map(p => p.key), section: 4, mode: 'listening', simple: true, label: 'Conversation Preset' },
    { key: 'speakerBalance', type: 'select', default: 'natural', options: ['balanced', 'natural', 'main', 'custom'], section: 4, mode: 'listening', simple: false, label: 'Speaker Balance' },
    { key: 'customShares', type: 'list', default: [50, 50], section: 4, mode: 'listening', simple: false, label: 'Custom speaker shares (%)' },
    { key: 'turnLength', type: 'range', default: 45, min: 0, max: 100, section: 4, mode: 'listening', simple: false, label: 'Speaking Turn Length' },
    { key: 'turnVariability', type: 'range', default: 70, min: 0, max: 100, section: 4, mode: 'listening', simple: false, label: 'Turn Length Variability' },
    { key: 'audioLength', type: 'select', default: '120', options: AUDIO_LENGTHS.map(a => a.key), section: 4, mode: 'listening', simple: true, label: 'Audio Length' },
    { key: 'audioLengthCustom', type: 'number', default: 200, min: 20, max: 1200, section: 4, mode: 'listening', simple: true, label: 'Custom length (seconds)' },
    { key: 'speakingSpeed', type: 'range', default: 50, min: 0, max: 100, section: 4, mode: 'listening', simple: false, label: 'Speaking Speed' },
    { key: 'speakerProfiles', type: 'list', default: [], section: 4, mode: 'listening', simple: false, label: 'Speaker Profiles' },
    { key: 'emotionTags', type: 'select', default: 'medium', options: ['off', 'low', 'medium', 'high'], section: 4, mode: 'listening', simple: false, label: 'Use emotion tags' },
    { key: 'naturalness', type: 'range', default: 50, min: 0, max: 100, section: 4, mode: 'listening', simple: false, label: 'Naturalness' },
    { key: 'explicitness', type: 'range', default: 40, min: 0, max: 100, section: 4, mode: 'both', simple: false, label: 'Information Explicitness' },
    // 4 Structure — reading
    { key: 'textType', type: 'select', default: 'Article', options: TEXT_TYPES, section: 4, mode: 'reading', simple: true, label: 'Text Type' },
    { key: 'customTextType', type: 'text', default: '', section: 4, mode: 'reading', simple: true, label: 'Custom text type' },
    { key: 'lengthMode', type: 'select', default: 'words', options: ['words', 'a4'], section: 4, mode: 'reading', simple: true, label: 'Length' },
    { key: 'wordCount', type: 'number', default: 450, min: 80, max: 2000, section: 4, mode: 'reading', simple: true, label: 'Word count' },
    { key: 'a4Pages', type: 'select', default: '1', options: ['0.5', '1', '1.5', '2'], section: 4, mode: 'reading', simple: true, label: 'Approximate A4 length' },
    { key: 'paragraphLength', type: 'select', default: 'medium', options: ['short', 'medium', 'long'], section: 7, mode: 'reading', simple: false, label: 'Paragraph length' },
    { key: 'dialogueProportion', type: 'range', default: 20, min: 0, max: 100, section: 7, mode: 'reading', simple: false, label: 'Dialogue proportion' },
    { key: 'styleBalance', type: 'range', default: 50, min: 0, max: 100, section: 7, mode: 'reading', simple: false, label: 'Narrative vs. informational style' },
    // 5 Vocabulary
    { key: 'vocabUsage', type: 'range', default: 50, min: 0, max: 100, section: 5, mode: 'both', simple: false, label: 'Vocabulary Usage' },
    { key: 'targetVocabMin', type: 'number', default: 8, min: 0, max: 40, section: 5, mode: 'both', simple: false, label: 'Target vocabulary (min)' },
    { key: 'targetVocabMax', type: 'number', default: 12, min: 1, max: 60, section: 5, mode: 'both', simple: false, label: 'Target vocabulary (max)' },
    { key: 'vocabSelectionMode', type: 'select', default: 'auto', options: ['auto', 'manual'], section: 5, mode: 'both', simple: false, label: 'Select vocabulary manually' },
    { key: 'selectedVocab', type: 'list', default: [], section: 5, mode: 'both', simple: false, label: 'Selected vocabulary' },
    { key: 'highlightVocab', type: 'toggle', default: true, section: 5, mode: 'both', simple: false, label: 'Highlight used target vocabulary in teacher version' },
    // 6 Worksheet & Questions
    { key: 'createWorksheet', type: 'toggle', default: true, section: 6, mode: 'both', simple: true, label: 'Create Worksheet' },
    { key: 'questionCount', type: 'select', default: '10', options: QUESTION_COUNTS, section: 6, mode: 'both', simple: true, label: 'Number of Questions' },
    { key: 'questionCountCustom', type: 'number', default: 7, min: 1, max: 30, section: 6, mode: 'both', simple: true, label: 'Custom number of questions' },
    { key: 'questionDifficulty', type: 'range', default: 50, min: 0, max: 100, section: 6, mode: 'both', simple: true, label: 'Question Difficulty' },
    { key: 'skillMixMode', type: 'select', default: 'auto', options: ['auto', 'custom'], section: 6, mode: 'both', simple: false, label: 'Skill mix' },
    { key: 'customSkillMix', type: 'map', default: { gist: 1, specific: 2, detail: 2, connecting: 2, inference: 2, attitude: 1, purpose: 0, context: 0 }, section: 6, mode: 'both', simple: false, label: 'Custom Question Mix' },
    { key: 'questionFormats', type: 'multiselect', default: ['multiple_choice', 'true_false', 'short_answer', 'wh_question', 'sentence_completion'], options: FORMAT_KEYS, section: 6, mode: 'both', simple: false, label: 'Question Formats' },
    { key: 'autoFormatMix', type: 'toggle', default: true, section: 6, mode: 'both', simple: false, label: 'Automatic balanced mix' },
    { key: 'questionLevel', type: 'select', default: 'auto', options: ['auto', 'A', 'B', 'both'], section: 6, mode: 'both', simple: true, label: 'Niveau der Fragen (Meta-Einstellung)' },
    { key: 'glossary', type: 'toggle', default: false, section: 6, mode: 'both', simple: true, label: 'Fremdwörter auf der 1. Seite erklärt' },
    { key: 'appendScript', type: 'toggle', default: false, section: 6, mode: 'listening', simple: true, label: 'Skript auf der letzten Seite abgebildet' },
    { key: 'higherOrder', type: 'toggle', default: false, section: 6, mode: 'both', simple: false, label: 'Higher-Order Questions' },
    { key: 'higherOrderCount', type: 'number', default: 2, min: 1, max: 5, section: 6, mode: 'both', simple: false, label: 'Number of higher-order questions' },
    { key: 'higherOrderTypes', type: 'multiselect', default: ['interpretation', 'transfer', 'evaluation'], options: HIGHER_ORDER_TYPES.map(t => t.key), section: 6, mode: 'both', simple: false, label: 'Higher-order types' },
    { key: 'distractorDifficulty', type: 'range', default: 50, min: 0, max: 100, section: 7, mode: 'both', simple: false, label: 'Distractor difficulty' },
    { key: 'inferenceLevel', type: 'range', default: 50, min: 0, max: 100, section: 7, mode: 'both', simple: false, label: 'Inference level' },
    { key: 'autoFix', type: 'select', default: 'all', options: ['off', 'fail', 'all'], section: 7, mode: 'both', simple: false, label: 'Automatische Korrektur' },
    { key: 'autoFixRounds', type: 'number', default: 2, min: 1, max: 4, section: 7, mode: 'both', simple: false, label: 'Korrekturrunden (max.)' },
    { key: 'preTask', type: 'toggle', default: false, section: 6, mode: 'both', simple: false, label: 'Create Pre-Task' },
    { key: 'preTaskTypes', type: 'multiselect', default: ['prediction', 'vocabulary'], options: PRE_TASK_TYPES.map(t => t.key), section: 6, mode: 'both', simple: false, label: 'Pre-task types' },
  ];
  const SCHEMA_BY_KEY = Object.fromEntries(SCHEMA.map(s => [s.key, s]));

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function defaults(kind) {
    const s = {};
    for (const def of SCHEMA) s[def.key] = clone(def.default);
    s.kind = kind === 'reading' ? 'reading' : 'listening';
    return s;
  }

  /** Coerce a partial state into a valid, fully populated one. */
  function normalizeState(partial) {
    const kind = partial && partial.kind === 'reading' ? 'reading' : 'listening';
    const s = defaults(kind);
    if (!partial) return s;
    for (const def of SCHEMA) {
      if (!(def.key in partial) || partial[def.key] === undefined) continue;
      const v = partial[def.key];
      switch (def.type) {
        case 'toggle': s[def.key] = !!v; break;
        case 'range':
        case 'number': {
          const n = Number(v);
          if (Number.isFinite(n)) s[def.key] = Math.min(def.max, Math.max(def.min, Math.round(n)));
          break;
        }
        case 'select': {
          if (!def.options || def.options.some(o => String(o) === String(v))) {
            const opt = def.options ? def.options.find(o => String(o) === String(v)) : v;
            s[def.key] = opt === undefined ? v : opt;
          }
          break;
        }
        case 'multiselect': {
          if (Array.isArray(v)) s[def.key] = v.filter(x => def.options.includes(x));
          break;
        }
        case 'list': if (Array.isArray(v)) s[def.key] = clone(v); break;
        case 'map': if (v && typeof v === 'object') s[def.key] = Object.assign({}, s[def.key], clone(v)); break;
        default: s[def.key] = String(v);
      }
    }
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Derived values                                                       */
  /* ------------------------------------------------------------------ */

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /** Words per minute for the speaking-speed slider (0 slow … 100 fast). */
  function wordsPerMinute(speakingSpeed) {
    return Math.round(lerp(105, 175, clamp(Number(speakingSpeed) || 0, 0, 100) / 100));
  }

  function audioSeconds(state) {
    if (state.audioLength === 'custom') return clamp(Number(state.audioLengthCustom) || 0, 20, 1200);
    return Number(state.audioLength);
  }

  const WORDS_PER_A4 = 450;

  /** Approximate word target for the text/script (concept §12 and §17). */
  function targetWordCount(state) {
    if (state.kind === 'listening') {
      return Math.round(audioSeconds(state) / 60 * wordsPerMinute(state.speakingSpeed));
    }
    if (state.lengthMode === 'a4') return Math.round(Number(state.a4Pages) * WORDS_PER_A4);
    return clamp(Number(state.wordCount) || WORDS_PER_A4, 80, 2000);
  }

  function effectiveSpeakerCount(state) {
    if (state.kind !== 'listening') return 0;
    if (state.format === 'monologue') return 1;
    if (state.format === 'dialogue') return 2;
    return clamp(Number(state.speakerCount) || 3, 3, 6);
  }

  function presetByKey(key) { return PRESETS.find(p => p.key === key) || PRESETS[0]; }

  /** Speaker labels used in the script: profile names or Speaker A, B, … */
  function speakerLabels(state) {
    const n = effectiveSpeakerCount(state);
    const preset = presetByKey(state.preset);
    const labels = [];
    for (let i = 0; i < n; i++) {
      const p = (state.speakerProfiles || [])[i];
      const name = p && p.name && String(p.name).trim();
      if (name) labels.push(name);
      else if (preset.roles && preset.roles[i] && n === preset.roles.length) labels.push(preset.roles[i]);
      else labels.push('Speaker ' + String.fromCharCode(65 + i));
    }
    return labels;
  }

  function normalizeShares(arr, n) {
    const raw = [];
    for (let i = 0; i < n; i++) raw.push(Math.max(0, Number((arr || [])[i]) || 0));
    const sum = raw.reduce((a, b) => a + b, 0);
    if (sum <= 0) return Array(n).fill(Math.round(100 / n));
    const scaled = raw.map(v => v / sum * 100);
    return roundToHundred(scaled);
  }

  /** Round percentages so they sum to exactly 100 (largest remainder). */
  function roundToHundred(values) {
    const floors = values.map(v => Math.floor(v));
    let rest = 100 - floors.reduce((a, b) => a + b, 0);
    const order = values.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < order.length && rest > 0; k++, rest--) floors[order[k].i] += 1;
    return floors;
  }

  /** Target speaking share per speaker in percent (concept §10). */
  function effectiveShares(state) {
    const n = effectiveSpeakerCount(state);
    if (n === 0) return [];
    if (n === 1) return [100];
    switch (state.speakerBalance) {
      case 'balanced': return roundToHundred(Array(n).fill(100 / n));
      case 'main': {
        const main = n === 2 ? 70 : 55;
        const rest = (100 - main) / (n - 1);
        return roundToHundred([main].concat(Array(n - 1).fill(rest)));
      }
      case 'custom': return normalizeShares(state.customShares, n);
      case 'natural':
      default: {
        // Decreasing weights without a dominant speaker: no one above ~50 %.
        const weights = [];
        for (let i = 0; i < n; i++) weights.push(1 + (n - 1 - i) * 0.35);
        const sum = weights.reduce((a, b) => a + b, 0);
        return roundToHundred(weights.map(w => w / sum * 100));
      }
    }
  }

  /** Apply a conversation preset: rewrites the structural settings (concept §9). */
  function applyPreset(state, presetKey) {
    const p = presetByKey(presetKey);
    const s = Object.assign({}, state, { preset: p.key });
    if (p.key === 'none') return s;
    if (p.format) s.format = p.format;
    if (p.speakerCount) s.speakerCount = p.speakerCount;
    if (p.balance) s.speakerBalance = p.balance;
    if (p.shares) s.customShares = p.shares.slice();
    if (typeof p.turnLength === 'number') s.turnLength = p.turnLength;
    if (typeof p.variability === 'number') s.turnVariability = p.variability;
    return s;
  }

  const TURN_PRESETS = {
    quick: { turnLength: 15, turnVariability: 40, label: 'Quick exchange', hint: 'mostly 1–2 sentences' },
    natural: { turnLength: 45, turnVariability: 70, label: 'Natural', hint: 'mix of short and medium turns' },
    extended: { turnLength: 80, turnVariability: 45, label: 'Extended', hint: 'several longer statements' },
  };
  function applyTurnPreset(state, key) {
    const p = TURN_PRESETS[key];
    if (!p) return state;
    return Object.assign({}, state, { turnLength: p.turnLength, turnVariability: p.turnVariability });
  }

  /** Average words per turn implied by the turn-length slider. */
  function turnWordTarget(turnLength) {
    return Math.round(lerp(9, 60, clamp(Number(turnLength) || 0, 0, 100) / 100));
  }

  /** Fraction of turns that should carry an emotion tag (concept §14). */
  function emotionTagTarget(level) {
    return { off: 0, low: 0.12, medium: 0.25, high: 0.4 }[level] || 0;
  }

  function questionCount(state) {
    if (state.questionCount === 'custom') return clamp(Number(state.questionCountCustom) || 1, 1, 30);
    return Number(state.questionCount);
  }

  /** CEFR band for questions: text level shifted by the question-difficulty slider (concept §6, §22). */
  function questionBand(cefr, difficulty) {
    const i = Math.max(0, CEFR_BANDS.indexOf(cefr));
    const d = Number(difficulty) || 0;
    const shift = d < 30 ? -1 : d > 70 ? 1 : 0;
    return CEFR_BANDS[clamp(i + shift, 0, CEFR_BANDS.length - 1)];
  }

  /*
   * Question levels as a meta-setting. "Niveau B" learners can handle B1.1
   * questions, "Niveau A" learners B1.2 up to B2.1. A level fixes the CEFR
   * band(s) of the questions and the effective question difficulty (which
   * drives the automatic skill mix); "both" produces one worksheet per level.
   */
  const QUESTION_LEVELS = {
    A: { key: 'A', label: 'Niveau A', bands: ['B1.2', 'B2.1'], difficulty: 65, describe: 'B1.2 bis B2.1: Details und Einzelinformationen sicher, dazu Verknüpfen, Schlussfolgern und Haltung/Absicht erkennen' },
    B: { key: 'B', label: 'Niveau B', bands: ['B1.1'], difficulty: 30, describe: 'B1.1: Hauptpunkte und klar gesagte Einzelinformationen, wenig Schlussfolgern, Fragen in einfacher Sprache' },
  };
  const QUESTION_LEVEL_KEYS = Object.keys(QUESTION_LEVELS);

  /** The worksheet variants a state asks for: one per question level, or a single unnamed one. */
  function questionVariants(state) {
    const lv = state.questionLevel;
    if (lv === 'both') return QUESTION_LEVEL_KEYS.map(k => QUESTION_LEVELS[k]);
    if (QUESTION_LEVELS[lv]) return [QUESTION_LEVELS[lv]];
    return [null];
  }
  /** The state for one variant: the level's difficulty replaces the slider. */
  function variantState(state, variant) {
    const s = clone(state);
    if (variant) { s.questionLevel = variant.key; s.questionDifficulty = variant.difficulty; }
    return s;
  }
  /** Effective question difficulty (0–100): the level's value when a level is set, else the slider. */
  function effectiveQuestionDifficulty(state) {
    const lv = QUESTION_LEVELS[state.questionLevel];
    return lv ? lv.difficulty : clamp(Number(state.questionDifficulty) || 0, 0, 100);
  }
  /** CEFR bands the questions may carry: the level's bands, or the band derived from text level and slider. */
  function questionBands(state) {
    const lv = QUESTION_LEVELS[state.questionLevel];
    return lv ? lv.bands.slice() : [questionBand(state.cefr, state.questionDifficulty)];
  }

  /*
   * Automatic skill mix (concept §23). Weights at "easy" favour direct
   * information retrieval; at "challenging" they shift towards connecting,
   * inference, attitude and purpose. Largest-remainder rounding keeps the sum
   * equal to the question count.
   */
  const SKILL_WEIGHTS_EASY = { gist: 1.0, specific: 3.6, detail: 2.2, connecting: 0.7, inference: 0.5, attitude: 0.6, purpose: 0.4, context: 0.8 };
  const SKILL_WEIGHTS_MID = { gist: 1.0, specific: 3.0, detail: 2.0, connecting: 1.0, inference: 1.0, attitude: 0.6, purpose: 0.5, context: 0.9 };
  const SKILL_WEIGHTS_HARD = { gist: 0.8, specific: 1.2, detail: 1.6, connecting: 2.0, inference: 2.4, attitude: 1.5, purpose: 1.3, context: 0.7 };

  function autoSkillMix(n, difficulty) {
    const d = clamp(Number(difficulty) || 0, 0, 100) / 100;
    const weights = {};
    for (const k of SKILL_KEYS) {
      weights[k] = d < 0.5
        ? lerp(SKILL_WEIGHTS_EASY[k], SKILL_WEIGHTS_MID[k], d / 0.5)
        : lerp(SKILL_WEIGHTS_MID[k], SKILL_WEIGHTS_HARD[k], (d - 0.5) / 0.5);
    }
    const total = SKILL_KEYS.reduce((a, k) => a + weights[k], 0);
    const exact = SKILL_KEYS.map(k => weights[k] / total * n);
    const counts = exact.map(v => Math.floor(v));
    let rest = n - counts.reduce((a, b) => a + b, 0);
    const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < order.length && rest > 0; k++, rest--) counts[order[k].i] += 1;
    const mix = {};
    SKILL_KEYS.forEach((k, i) => { mix[k] = counts[i]; });
    // Every worksheet with at least 5 questions has one gist question.
    if (n >= 5 && mix.gist === 0) {
      const donor = SKILL_KEYS.reduce((best, k) => (mix[k] > mix[best] ? k : best), 'specific');
      mix[donor] -= 1; mix.gist = 1;
    }
    return mix;
  }

  /** The skill mix that will be used: automatic or the user's custom counts. */
  function effectiveSkillMix(state) {
    const n = questionCount(state);
    if (state.skillMixMode === 'custom') {
      const mix = {};
      for (const k of SKILL_KEYS) mix[k] = Math.max(0, Math.round(Number((state.customSkillMix || {})[k]) || 0));
      return mix;
    }
    return autoSkillMix(n, effectiveQuestionDifficulty(state));
  }

  /** Ordered list of skills, one per question, for the planned worksheet. */
  function skillSequence(mix) {
    const seq = [];
    for (const k of SKILL_KEYS) for (let i = 0; i < (mix[k] || 0); i++) seq.push(k);
    return seq;
  }

  function availableFormats(state) {
    const n = effectiveSpeakerCount(state);
    return (state.questionFormats || []).filter(k => {
      const f = QUESTION_FORMATS.find(x => x.key === k);
      if (!f) return false;
      if (f.listeningOnly && state.kind !== 'listening') return false;
      if (f.needsSpeakers && n < f.needsSpeakers) return false;
      return true;
    });
  }

  /**
   * Assign a response format to each planned question so the enabled formats
   * are spread evenly (concept §25 "Automatic balanced mix"). Gist questions
   * take "Best Summary" when it is enabled.
   */
  function assignFormats(skills, formats) {
    const pool = formats.filter(f => f !== 'best_summary');
    const result = [];
    let i = 0;
    for (const skill of skills) {
      if (skill === 'gist' && formats.includes('best_summary')) { result.push('best_summary'); continue; }
      if (pool.length === 0) { result.push(formats[0] || 'short_answer'); continue; }
      result.push(pool[i % pool.length]);
      i += 1;
    }
    return result;
  }

  /** Words the generator must integrate (manual selection or an automatic pick from the unit). */
  function targetVocabulary(state, unit) {
    const words = (unit && unit.words) || [];
    const min = clamp(Number(state.targetVocabMin) || 0, 0, 60);
    const max = clamp(Math.max(Number(state.targetVocabMax) || min, min), 0, 60);
    if (state.vocabSelectionMode === 'manual') {
      const chosen = new Set(state.selectedVocab || []);
      return words.filter(w => chosen.has(w.word));
    }
    // Automatic: hand Claude the whole unit list and the target range; it picks
    // the words that fit the scenario naturally. The plan carries the range.
    return words.slice(0, Math.max(max, Math.min(words.length, 40)));
  }

  /* ------------------------------------------------------------------ */
  /* Validation                                                           */
  /* ------------------------------------------------------------------ */

  function validateState(state, ctx) {
    const errors = [];
    const unit = ctx && ctx.unit;
    if (!state.textbookId) errors.push({ key: 'textbookId', message: 'Bitte ein Lehrmittel auswählen.' });
    if (!state.unitId || !unit) errors.push({ key: 'unitId', message: 'Bitte eine Unit auswählen.' });
    else if (!unit.words || unit.words.length === 0) errors.push({ key: 'unitId', message: 'Die gewählte Unit enthält keine Vokabeln.' });
    const needsCustomTopic = state.topicMode === 'custom' || !state.useUnitTopic;
    if (needsCustomTopic && !String(state.customTopic || '').trim()) {
      errors.push({ key: 'customTopic', message: 'Bitte ein Thema eingeben oder Vorschläge generieren lassen.' });
    }
    if (state.kind === 'listening') {
      const n = effectiveSpeakerCount(state);
      if (state.speakerBalance === 'custom' && n > 1) {
        const sum = (state.customShares || []).slice(0, n).reduce((a, b) => a + (Number(b) || 0), 0);
        if (Math.round(sum) !== 100) errors.push({ key: 'customShares', message: `Die Sprechanteile müssen zusammen 100 % ergeben (aktuell ${Math.round(sum)} %).` });
      }
      if (state.audioLength === 'custom' && !(Number(state.audioLengthCustom) >= 20)) {
        errors.push({ key: 'audioLengthCustom', message: 'Custom-Länge: mindestens 20 Sekunden.' });
      }
    } else {
      if (state.textType === 'Custom' && !String(state.customTextType || '').trim()) {
        errors.push({ key: 'customTextType', message: 'Bitte den eigenen Texttyp benennen.' });
      }
    }
    if (Number(state.targetVocabMin) > Number(state.targetVocabMax)) {
      errors.push({ key: 'targetVocabMax', message: 'Target vocabulary: Minimum darf nicht größer als Maximum sein.' });
    }
    if (state.vocabSelectionMode === 'manual' && (!state.selectedVocab || state.selectedVocab.length === 0)) {
      errors.push({ key: 'selectedVocab', message: 'Bitte mindestens ein Vokabel manuell auswählen.' });
    }
    if (state.createWorksheet) {
      const n = questionCount(state);
      if (state.skillMixMode === 'custom') {
        const sum = SKILL_KEYS.reduce((a, k) => a + (Number((state.customSkillMix || {})[k]) || 0), 0);
        if (sum !== n) errors.push({ key: 'customSkillMix', message: `Custom Question Mix ergibt ${sum}, es sind aber ${n} Fragen eingestellt.` });
      }
      if (availableFormats(state).length === 0) errors.push({ key: 'questionFormats', message: 'Bitte mindestens ein Frageformat aktivieren.' });
      if (state.higherOrder && (!state.higherOrderTypes || state.higherOrderTypes.length === 0)) {
        errors.push({ key: 'higherOrderTypes', message: 'Bitte mindestens einen Higher-Order-Typ auswählen.' });
      }
      if (state.preTask && (!state.preTaskTypes || state.preTaskTypes.length === 0)) {
        errors.push({ key: 'preTaskTypes', message: 'Bitte mindestens eine Pre-Task-Form auswählen.' });
      }
    }
    return errors;
  }

  /* ------------------------------------------------------------------ */
  /* Plan: everything the prompts and the quality checks share            */
  /* ------------------------------------------------------------------ */

  function buildPlan(state, ctx) {
    const unit = ctx.unit || { name: '', topic: '', words: [] };
    const textbook = ctx.textbook || { name: '' };
    const n = effectiveSpeakerCount(state);
    const labels = speakerLabels(state);
    const shares = effectiveShares(state);
    const qn = state.createWorksheet ? questionCount(state) : 0;
    const mix = state.createWorksheet ? effectiveSkillMix(state) : {};
    const skills = skillSequence(mix);
    const formats = availableFormats(state);
    const plan = {
      kind: state.kind,
      textbookName: textbook.name,
      unitName: unit.name,
      unitTopic: unit.topic || '',
      topic: (state.useUnitTopic && state.topicMode === 'unit') ? (unit.topic || unit.name) : String(state.customTopic || '').trim(),
      topicSource: (state.useUnitTopic && state.topicMode === 'unit') ? 'unit' : 'custom',
      cefr: state.cefr,
      questionBand: questionBands(state)[0],
      questionBands: questionBands(state),
      questionLevel: QUESTION_LEVELS[state.questionLevel] ? state.questionLevel : null,
      questionLevelLabel: QUESTION_LEVELS[state.questionLevel] ? QUESTION_LEVELS[state.questionLevel].label : '',
      questionDifficulty: state.createWorksheet ? effectiveQuestionDifficulty(state) : null,
      variants: state.createWorksheet ? questionVariants(state).map(v => v ? v.key : null) : [],
      glossary: !!(state.createWorksheet && state.glossary),
      appendScript: !!(state.createWorksheet && state.appendScript && state.kind === 'listening'),
      levelMeter: state.levelMeter !== false,
      targetWords: targetWordCount(state),
      wpm: state.kind === 'listening' ? wordsPerMinute(state.speakingSpeed) : null,
      seconds: state.kind === 'listening' ? audioSeconds(state) : null,
      speakerCount: n,
      speakerLabels: labels,
      shares,
      speakers: labels.map((label, i) => ({
        label, share: shares[i] || 0,
        profile: (state.speakerProfiles || [])[i] || null,
      })),
      preset: presetByKey(state.preset),
      turnWords: turnWordTarget(state.turnLength),
      emotionTarget: emotionTagTarget(state.emotionTags),
      vocabulary: targetVocabulary(state, unit),
      vocabRange: [Number(state.targetVocabMin) || 0, Number(state.targetVocabMax) || 0],
      questionCount: qn,
      skillMix: mix,
      skillSequence: skills,
      formats,
      formatSequence: state.autoFormatMix ? assignFormats(skills, formats) : null,
      higherOrderCount: state.createWorksheet && state.higherOrder ? clamp(Number(state.higherOrderCount) || 1, 1, 5) : 0,
      higherOrderTypes: state.higherOrder ? (state.higherOrderTypes || []) : [],
      preTaskTypes: state.createWorksheet && state.preTask ? (state.preTaskTypes || []) : [],
    };
    return plan;
  }

  /* ------------------------------------------------------------------ */
  /* Example configuration (concept §32)                                  */
  /* ------------------------------------------------------------------ */

  const EXAMPLE_CONFIG = {
    kind: 'listening',
    cefr: 'B1.2',
    preset: 'podcast',
    format: 'dialogue',
    speakerBalance: 'custom',
    customShares: [30, 70],
    audioLength: '180',
    turnVariability: 85,
    naturalness: 50,
    emotionTags: 'medium',
    vocabSelectionMode: 'auto',
    targetVocabMin: 10,
    targetVocabMax: 10,
    createWorksheet: true,
    questionCount: '10',
    questionDifficulty: 65,
    skillMixMode: 'custom',
    customSkillMix: { gist: 1, specific: 3, detail: 2, connecting: 1, inference: 1, attitude: 1, purpose: 1, context: 0 },
    questionFormats: ['multiple_choice', 'short_answer', 'matching'],
    autoFormatMix: true,
    speakerProfiles: [{ name: 'Host', age: '', role: 'Podcast host', personality: '' }, { name: 'Guest', age: '', role: 'Film critic', personality: '' }],
  };

  /** Load the example from the concept: textbook/unit are matched by name when present. */
  function applyExampleConfig(state, textbooks) {
    const s = normalizeState(Object.assign({}, state, EXAMPLE_CONFIG));
    const tb = (textbooks || []).find(t => /english plus 4/i.test(t.name)) || (textbooks || [])[0];
    if (tb) {
      s.textbookId = tb.id;
      const unit = (tb.units || []).find(u => /unit\s*8/i.test(u.name) || /movies/i.test(u.name || '') || /movies/i.test(u.topic || '')) || (tb.units || [])[0];
      if (unit) s.unitId = unit.id;
    }
    return s;
  }

  const SIMPLE_MODE_KEYS = SCHEMA.filter(s => s.simple).map(s => s.key);

  return {
    CEFR_BANDS, SKILLS, SKILL_KEYS, HIGHER_ORDER_TYPES, QUESTION_FORMATS, FORMAT_KEYS, TEXT_TYPES,
    EMOTION_TAGS, PRE_TASK_TYPES, AUDIO_LENGTHS, QUESTION_COUNTS, PRESETS, TURN_PRESETS,
    META_SPECS, TEXT_TYPE_DESIGN, designIdFor,
    SCHEMA, SCHEMA_BY_KEY, SIMPLE_MODE_KEYS, EXAMPLE_CONFIG, WORDS_PER_A4,
    defaults, normalizeState, clone,
    wordsPerMinute, audioSeconds, targetWordCount, effectiveSpeakerCount, speakerLabels,
    effectiveShares, roundToHundred, normalizeShares, applyPreset, presetByKey, applyTurnPreset,
    turnWordTarget, emotionTagTarget, questionCount, questionBand, autoSkillMix, effectiveSkillMix,
    QUESTION_LEVELS, QUESTION_LEVEL_KEYS, questionVariants, variantState, effectiveQuestionDifficulty, questionBands,
    skillSequence, availableFormats, assignFormats, targetVocabulary, validateState, buildPlan,
    applyExampleConfig,
  };
});
