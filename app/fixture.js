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
        { n: 4, skill: 'inference', format: 'short_answer', difficulty: 'B1.1', prompt: 'Fixture inference question?', answer: 'Fixture inference answer', evidenceQuote: quotes[2], evidenceRef: refs[2], rationale: 'Fixture inference rationale sentence.' },
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

  /*
   * Calibration samples for the difficulty meter (app/level.js). "anchor" is
   * the podcast interview the teacher rated B1.2; the others are reference
   * texts written for the surrounding bands. Test data only — nothing here
   * reaches generated material.
   */
  const LEVEL_SAMPLES = {
  "anchor": {
    "title": "Screen Time",
    "lines": [
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "[warmly] Welcome back to Screen Time. My guest today is Maya Carter, a seventeen-year-old student from Manchester who loves watching series with friends. Maya, you've recently watched Outer Banks, The Gentlemen and Beauty in Black. If someone only had time for one, where would you tell them to start?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "[thoughtful] I'd probably start with Outer Banks because it's the easiest one to get into. It has adventure, mystery, friendship and romance, so there's always something happening. [amused] The characters also make some really questionable decisions. You're watching and thinking, \"Please don't do that,\" and then of course they do it anyway. But that's part of the fun. The beaches, boats and treasure hunts also give the series a really strong atmosphere."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "[interested] The Gentlemen feels completely different. What was your impression of that one?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "[confidently] I really liked it. It's a crime drama with dark humour, but it never feels too serious. The main character comes from a wealthy British family and suddenly gets involved with dangerous people. What makes it entertaining is the contrast. Something crazy can be happening, but the characters stay calm and polite. [chuckles] The humour is also quite subtle, so you have to listen carefully."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "[curious] And what makes Beauty in Black different?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "[serious] Definitely the drama. It focuses much more on relationships, money, power and secrets. The characters want different things and they're not always honest with each other. Compared with Outer Banks, it feels less like an adventure and more like a complicated family drama. [laughing softly] It's not a series where you can look at your phone for ten minutes. If you do, you'll probably be lost."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "[playfully] Final question. You have an entire weekend and no plans. In what order are you watching them?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "[thinking aloud] I'd start with Outer Banks on Friday because it's fun and easy to watch. Then The Gentlemen on Saturday because I'd want to pay more attention to the dialogue and humour. I'd leave Beauty in Black for Sunday. But The Gentlemen is probably the one I'd watch for the longest. [laughs] It has that \"just one more episode\" feeling, and suddenly it's two in the morning."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "[laughing] Maya, thanks for joining us."
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "[warmly] Thanks for having me"
      }
    ]
  },
  "a2": {
    "title": "Weekend plans",
    "lines": [
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "Hi Tom. What are you doing this weekend?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "Hi Anna. On Saturday I'm going to the sports centre. I play football with my friends every week."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "That sounds fun. What time does it start?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "It starts at ten o'clock. After that we eat pizza in the café. The pizza there is very good."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "And on Sunday?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "On Sunday I'm visiting my grandmother. She lives in a small village near the lake. We often go for a walk and then we have cake and tea."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "Nice. My weekend is different. I have to study for a maths test on Monday."
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "Oh no. Is the test difficult?"
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "Yes, a bit. But my brother is helping me. He is good at maths."
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "That's great. Do you want to come to the football game? You can study in the evening."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "Maybe. I'll ask my mum. Can I text you later?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "Sure. See you on Saturday, I hope!"
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "See you, Tom. Bye!"
      }
    ]
  },
  "b1": {
    "title": "Language exchange",
    "lines": [
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "Welcome to the school podcast. Today I'm talking to Lena, who has just come back from a language exchange in Ireland. Lena, how long were you there?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "I was there for three weeks in July. I stayed with a host family in a small town near Dublin. They had two children, so the house was always busy."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "What was the biggest difference compared with home?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "The food, definitely. We had a hot breakfast every morning, which I wasn't used to. And dinner was really early, at about six. At first I was hungry again by nine o'clock, but after a few days I got used to it."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "Did you understand people easily?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "Not at the beginning. The Irish accent was quite strong and people spoke fast. But my host mother was very patient. If I didn't understand something, she explained it again with simpler words. After the first week it became much easier."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "What did you do in your free time?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "We went to the coast twice, and once we visited a castle. My favourite day was when we went to a music festival in the town. There were bands playing on the street and everybody was dancing, even the older people."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "Would you recommend an exchange to other students?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "Yes, absolutely. You learn more in three weeks than in a whole year at school, because you have to speak English all the time. I think everybody should try it once."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "Thanks, Lena, and welcome back."
      }
    ]
  },
  "b2": {
    "title": "Age verification",
    "lines": [
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "Tonight's discussion concerns the growing pressure on social media platforms to verify the age of their users, a measure that has been debated in several European parliaments over the past year. With me is Professor Daniel Okafor, whose research examines the unintended consequences of digital regulation. Professor, critics maintain that age verification is a blunt instrument which punishes the many for the failings of a few. Is that assessment fair?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "It's not entirely unreasonable, though I'd argue it overlooks the scale of the problem. Whatever one thinks of the current proposals, the fact remains that platforms have been permitted to operate for years without any meaningful obligation to establish who is actually using their services. Not only has this exposed younger users to content that was never intended for them, but it has also allowed the platforms themselves to claim ignorance whenever the issue was raised. Verification, however imperfect, at least shifts some of that responsibility back onto the companies."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "Yet privacy advocates warn that any system capable of confirming a user's age is, by definition, a system that collects sensitive personal data."
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "That tension is genuine, and it would be dishonest to pretend otherwise. Were governments to insist on identity documents being uploaded to every platform, they would effectively be creating a vast, centralised archive of precisely the kind that authoritarian regimes have historically exploited. The more sophisticated proposals, by contrast, rely on third-party attestation, whereby a trusted intermediary confirms that a user meets the threshold without disclosing who they are. Whether the industry adopts such an approach voluntarily, or has to be compelled to, remains to be seen."
      },
      {
        "speaker": "Speaker 1",
        "emotion": null,
        "text": "And if it isn't compelled?"
      },
      {
        "speaker": "Speaker 2",
        "emotion": null,
        "text": "Then we should expect a decade of incremental, largely cosmetic changes, accompanied by increasingly elaborate assurances that the underlying problem has been resolved. Frankly, had the platforms acted on the evidence that was available to them a decade ago, this conversation would be unnecessary."
      }
    ]
  },
  "b2reading": {
    "title": "Four-day week",
    "paragraphs": [
      "Why the four-day week may not be the revolution it appears to be",
      "When a Manchester-based marketing firm announced last spring that it had permanently adopted a four-day working week, the reaction was almost universally enthusiastic. Employees reported lower stress, productivity had apparently risen, and the company's founder became a regular fixture on morning television. What was rarely mentioned, however, was the fine print: the shorter week applied only to office staff, while the warehouse team continued to work five days on unchanged pay.",
      "This is not an isolated case. Of the sixty-one British companies that took part in a widely publicised trial in 2022, a considerable proportion have since quietly reintroduced longer hours, either for particular departments or during busy periods. The trial's organisers, who had presented the results as conclusive, have been reluctant to acknowledge these retreats, and the media, having already told the story once, have shown little interest in revisiting it.",
      "None of this means that the underlying idea is flawed. There is genuine evidence that compressed schedules can reduce absenteeism and improve retention, provided that workloads are adjusted rather than merely squeezed into fewer days. Had the early adopters been more candid about the conditions under which the model works, the debate would now be considerably more useful than it is."
    ]
  }
};
  function levelSample(name) { return JSON.parse(JSON.stringify(LEVEL_SAMPLES[name] || LEVEL_SAMPLES.anchor)); }

  return { textbooks, content, worksheet, material, meta, META, levelSample, LEVEL_SAMPLES };
});
