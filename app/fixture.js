/*
 * LRMaster fixture — example textbook data (plainly marked as example) and a
 * small, hand-written test material used ONLY by the concept checks and the
 * renderer tests. Nothing in here is ever shown as generated output.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else { root.LR = root.LR || {}; root.LR.fixture = factory(root.LR.core); }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  function textbooks() {
    return [
      {
        id: 'tb_example_ep4', name: 'English Plus 4 (example data)', example: true,
        units: [
          { id: 'u_ep4_1', name: 'Unit 1', topic: 'Friends and communication', words: [
            { word: 'get on with', translation: 'sich verstehen mit', note: '' },
            { word: 'fall out', translation: 'sich zerstreiten', note: '' },
            { word: 'make up', translation: 'sich versöhnen', note: '' },
            { word: 'keep in touch', translation: 'in Kontakt bleiben', note: '' },
            { word: 'rely on', translation: 'sich verlassen auf', note: '' },
            { word: 'hang out', translation: 'abhängen, Zeit verbringen', note: '' },
            { word: 'argue', translation: 'streiten', note: '' },
            { word: 'apologise', translation: 'sich entschuldigen', note: '' },
            { word: 'trust', translation: 'vertrauen', note: '' },
            { word: 'honest', translation: 'ehrlich', note: '' },
            { word: 'loyal', translation: 'loyal, treu', note: '' },
            { word: 'gossip', translation: 'Klatsch; tratschen', note: '' },
            { word: 'let somebody down', translation: 'jemanden im Stich lassen', note: '' },
            { word: 'stick up for', translation: 'sich einsetzen für', note: '' },
          ] },
          { id: 'u_ep4_8', name: 'Unit 8', topic: 'Movies', words: [
            { word: 'box office', translation: 'Kinokasse', note: '' },
            { word: 'cast', translation: 'Besetzung', note: '' },
            { word: 'plot', translation: 'Handlung', note: '' },
            { word: 'sequel', translation: 'Fortsetzung', note: '' },
            { word: 'soundtrack', translation: 'Filmmusik', note: '' },
            { word: 'special effects', translation: 'Spezialeffekte', note: '' },
            { word: 'director', translation: 'Regisseur/in', note: '' },
            { word: 'screenplay', translation: 'Drehbuch', note: '' },
            { word: 'blockbuster', translation: 'Kassenschlager', note: '' },
            { word: 'review', translation: 'Kritik, Rezension', note: '' },
            { word: 'trailer', translation: 'Trailer', note: '' },
            { word: 'scene', translation: 'Szene', note: '' },
            { word: 'audience', translation: 'Publikum', note: '' },
            { word: 'setting', translation: 'Schauplatz', note: '' },
          ] },
        ],
      },
      {
        id: 'tb_example_other', name: 'Second textbook (example data)', example: true,
        units: [
          { id: 'u_other_1', name: 'Unit 1', topic: 'Travel', words: [
            { word: 'backpack', translation: 'Rucksack', note: '' }, { word: 'destination', translation: 'Reiseziel', note: '' },
            { word: 'book a ticket', translation: 'ein Ticket buchen', note: '' }, { word: 'delay', translation: 'Verspätung', note: '' },
            { word: 'sightseeing', translation: 'Besichtigung', note: '' }, { word: 'accommodation', translation: 'Unterkunft', note: '' },
            { word: 'journey', translation: 'Reise', note: '' }, { word: 'abroad', translation: 'im Ausland', note: '' },
          ] },
        ],
      },
    ];
  }

  /* Document details as Claude returns them, one sample per design. */
  const META = {
    story: { byline: 'Fixture Author' },
    article: { publication: 'Fixture Weekly', byline: 'Fixture Reporter', dateline: '14 March 2026', standfirst: 'Fixture stand-first sentence.', pullQuote: 'found it under a bench' },
    news: { publication: 'Fixture Post', byline: 'Fixture Reporter', dateline: '14 March 2026', location: 'FIXTURETOWN', standfirst: 'Fixture summary sentence.' },
    blog: { blogName: 'Fixture Blog', byline: 'fixture_user', dateline: '14 March 2026', readingTime: '4 min read', tags: ['fixture', 'friends'] },
    email: { from: 'Sam Fixture <sam@example.org>', to: 'Priya Fixture <priya@example.org>', subject: 'Fixture subject line', sent: 'Monday, 09:12', signature: 'Sam\nFixture club' },
    forum: { forumName: 'Fixture Board', threadTitle: 'Fixture thread title', authors: ['fixture_mia', 'fixture_leo', 'fixture_sam'], timestamps: ['2 h ago', '1 h ago', '20 min ago'] },
    interview: { publication: 'Fixture Voices', byline: 'Fixture Interviewer', standfirst: 'Fixture introduction.', speakers: ['Fixture Interviewer', 'Fixture Guest', 'Fixture Interviewer'] },
    review: { subject: 'Fixture film', category: 'Film', rating: 4, byline: 'Fixture Critic', verdict: 'Fixture verdict sentence.' },
    report: { subtitle: 'Fixture subtitle', author: 'Fixture Class', dateline: '14 March 2026', recipient: 'Fixture Head teacher', summary: 'Fixture executive summary.' },
    diary: { dateline: 'Tuesday, 14 March', place: 'Fixture town' },
    informational: { subtitle: 'Fixture subtitle', source: 'Fixture source', factBox: ['Fixture fact one', 'Fixture fact two'] },
    opinion: { publication: 'Fixture Voice', byline: 'Fixture Columnist', dateline: '14 March 2026', pullQuote: 'found it under a bench' },
    dialogue: { setting: 'Fixture bus stop', speakers: ['Fixture Sam', 'Fixture Priya', 'Fixture Sam'] },
    custom: { byline: 'Fixture Author', standfirst: 'Fixture introduction.' },
    script: { setting: 'Fixture school corridor', programme: 'Fixture Talk' },
  };
  function meta(designId) { return JSON.parse(JSON.stringify(META[designId] || META.custom)); }

  function content(kind) {
    if (kind === 'reading') {
      return {
        title: 'Test text', summary: 'fixture', vocabularyUsed: ['argue', 'trust'],
        paragraphs: [
          'Sam and Priya used to argue about everything, from music to homework.',
          'One rainy Tuesday, Priya lost her phone and Sam found it under a bench in the park.',
          'She said she would trust him with anything after that day.',
        ],
      };
    }
    return {
      title: 'Test script', summary: 'fixture', vocabularyUsed: ['argue', 'trust', 'apologise'],
      lines: [
        { speaker: 'Speaker A', emotion: null, text: 'So, did you and Jonas argue again yesterday?' },
        { speaker: 'Speaker B', emotion: 'hesitant', text: 'Well, sort of. He forgot to bring the tickets and we missed the first ten minutes.' },
        { speaker: 'Speaker A', emotion: null, text: 'Really? That is the third time this month.' },
        { speaker: 'Speaker B', emotion: null, text: 'I know. I trust him, but he has to apologise properly this time.' },
        { speaker: 'Speaker A', emotion: 'laughing', text: 'You said exactly the same thing last week!' },
        { speaker: 'Speaker B', emotion: null, text: 'Fine. I will talk to him at the bus stop tomorrow morning at eight.' },
      ],
    };
  }

  function worksheet(kind) {
    const quotes = kind === 'reading'
      ? ['argue about everything', 'found it under a bench in the park', 'trust him with anything after that day']
      : ['did you and Jonas argue again yesterday', 'he forgot to bring the tickets and we missed the first ten minutes', 'You said exactly the same thing last week'];
    const refs = kind === 'reading' ? ['[¶1]', '[¶2]', '[¶3]'] : ['[1]', '[2]', '[5]'];
    return {
      title: 'Fixture worksheet title', instructions: 'Fixture instruction sentence.',
      preTasks: [{ type: 'prediction', title: 'Guess', prompt: 'Fixture prediction prompt', items: [], teacherNote: '' }],
      questions: [
        { n: 1, skill: 'gist', format: 'multiple_choice', difficulty: 'B1.1', prompt: 'What is the conversation mainly about?', options: ['Fixture option one', 'Fixture option two', 'Fixture option three'], answer: 'B', evidenceQuote: quotes[0], evidenceRef: refs[0], rationale: '' },
        { n: 2, skill: 'specific', format: 'short_answer', difficulty: 'B1.1', prompt: 'Fixture specific question?', answer: 'Fixture specific answer', evidenceQuote: quotes[0], evidenceRef: refs[0], rationale: '' },
        { n: 3, skill: 'detail', format: 'true_false', difficulty: 'B1.1', prompt: 'Fixture detail statement.', answer: 'True', evidenceQuote: quotes[1], evidenceRef: refs[1], rationale: '' },
        { n: 4, skill: 'inference', format: 'short_answer', difficulty: 'B1.2', prompt: 'Fixture inference question?', answer: 'Fixture inference answer', evidenceQuote: quotes[2], evidenceRef: refs[2], rationale: 'Fixture inference rationale sentence.' },
      ],
      higherOrder: [],
    };
  }

  /** A complete material object as the pipeline would assemble it. */
  function material(overrides, kind, ctx) {
    kind = kind || 'listening';
    const settings = core.normalizeState(Object.assign(core.defaults(kind), { questionCount: 'custom', questionCountCustom: 4, targetVocabMin: 2, targetVocabMax: 3, skillMixMode: 'custom', customSkillMix: { gist: 1, specific: 1, detail: 1, connecting: 0, inference: 1, attitude: 0, purpose: 0, context: 0 }, questionFormats: ['multiple_choice', 'short_answer', 'true_false'], autoFormatMix: false }, overrides || {}));
    const c = content(kind);
    c.meta = meta(core.designIdFor(settings));
    const ws = worksheet(kind);
    if (settings.higherOrder) ws.higherOrder = [{ n: 1, type: 'evaluation', prompt: 'Fixture higher-order prompt', answer: 'Fixture model answer', rationale: '' }];
    if (!settings.preTask) ws.preTasks = [];
    const plan = core.buildPlan(settings, ctx || { textbook: textbooks()[0], unit: textbooks()[0].units[0] });
    return {
      id: 'fixture', kind, createdAt: 0, settings, plan, content: c, worksheet: settings.createWorksheet ? ws : null,
      vocabFound: ['argue', 'trust'], vocabMissing: ['gossip'],
      quality: { findings: [] },
    };
  }

  return { textbooks, content, worksheet, material, meta, META };
});
