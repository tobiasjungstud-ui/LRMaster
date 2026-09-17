/*
 * LRMaster prompts — turns a settings state plus its plan into the
 * instructions Claude receives. Every generation setting in core.SCHEMA is
 * read here; the concept checks verify that changing any of them changes the
 * resulting prompt text. No generated content lives in this file: titles,
 * texts, questions, instructions and topic ideas all come from Claude.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'), require('./level.js'));
  else { root.LR = root.LR || {}; root.LR.prompts = factory(root.LR.core, root.LR.level); }
})(typeof self !== 'undefined' ? self : this, function (core, level) {
  'use strict';

  function scale(v, labels) {
    const n = Math.max(0, Math.min(100, Number(v) || 0));
    const idx = Math.min(labels.length - 1, Math.floor(n / (100 / labels.length)));
    return `${labels[idx]} (${n}/100)`;
  }

  const SKILL_DEFINITIONS = {
    gist: 'understanding the overall topic, main idea or central message',
    specific: 'locating single pieces of information (people, places, times, numbers, concrete actions, individual facts)',
    detail: 'understanding content precisely: reasons, consequences, conditions, sequences, comparisons, problem and solution',
    connecting: 'combining information from several places: comparing statements, linking cause and effect, noticing changes, combining what different speakers say, spotting contradictions',
    inference: 'working out information that is never stated explicitly',
    attitude: 'recognising emotion, attitude, agreement, rejection, certainty, enthusiasm, frustration, irony or scepticism (tone and emotion tags count for listening)',
    purpose: 'understanding why someone says something: persuade, complain, apologise, reassure, warn, suggest, refuse, justify, criticise, explain',
    context: 'deducing the situation: where the speakers are, their relationship, who is being addressed',
  };

  const FORMAT_SHAPES = {
    multiple_choice: '"options": ["first option", "second option", "third option", "fourth option"] — WITHOUT letters, the worksheet adds A, B, C itself; "answer": the letter of the correct option, e.g. "B"',
    true_false: '"statement": "…", "answer": "True" | "False"',
    true_false_correction: '"statement": "…", "answer": "True" | "False", "correction": "corrected statement if false, otherwise empty"',
    short_answer: '"answer": "model answer (a few words)", "acceptable": ["variant", …]',
    wh_question: '"answer": "model answer", "acceptable": ["variant", …]',
    sentence_completion: '"prompt" contains a sentence with ____ to complete, "answer": "the missing words"',
    gap_fill: '"prompt" contains a short passage with numbered gaps (1)…, "answer": ["gap 1", "gap 2", …]',
    matching: '"items": [{"left": "…", "right": "…"}, …] (3–6 pairs, correct pairing; the student version shuffles the right column), "answer": "see items"',
    who_said_it: '"statement": "paraphrased statement", "options": [speaker names, without letters], "answer": "speaker name"',
    ordering: '"items": ["event 1", "event 2", …] in the CORRECT order (the student version shuffles them), "answer": "see items"',
    table_completion: '"table": {"headers": ["…"], "rows": [["…", "___", "…"], …]}, "answer": ["cell 1", "cell 2", …] in reading order of the blanks',
    select_all: '"options": [five options, WITHOUT letters], "answer": ["A","C"] (the letters of every correct option)',
    best_summary: '"options": [three candidate summaries, WITHOUT letters], "answer": the letter of the best one',
    note_taking: '"prompt" gives a notes template with numbered gaps, "answer": ["note 1", "note 2", …]',
  };

  function formatLabel(key) {
    const f = core.QUESTION_FORMATS.find(x => x.key === key);
    return f ? f.label : key;
  }
  function skillLabel(key) {
    const s = core.SKILLS.find(x => x.key === key);
    return s ? s.label : key;
  }

  function vocabList(words) {
    return words.map(w => {
      let line = `- ${w.word}`;
      if (w.translation) line += ` — ${w.translation}`;
      if (w.note) line += ` (${w.note})`;
      return line;
    }).join('\n');
  }

  /* ------------------------------------------------------------------ */
  /* Shared blocks                                                        */
  /* ------------------------------------------------------------------ */

  function sourceBlock(state, plan) {
    const lines = [
      `Textbook: ${plan.textbookName || 'n/a'}; unit: ${plan.unitName || 'n/a'}` + (plan.unitTopic ? ` (unit topic: ${plan.unitTopic})` : ''),
    ];
    if (plan.topicSource === 'unit') {
      lines.push(`Topic: use the unit topic "${plan.topic}". The content must clearly follow the unit's theme.`);
    } else {
      lines.push(`Topic (custom): ${plan.topic}`);
      lines.push(state.useUnitTopic
        ? 'Keep the scenario connected to the unit\'s theme while following this custom topic.'
        : 'The unit topic is switched OFF: the theme is free, but the unit vocabulary below is the anchor of the text.');
    }
    return lines.join('\n');
  }

  function levelTargetBlock(state, plan) {
    if (plan.levelMeter === false) return '';
    const d = level.DESCRIPTORS[plan.cefr] || {};
    return '## Measurable level targets (the text is measured against these after writing)\n'
      + `What ${plan.cefr} means here: ${d.language || ''}\n`
      + level.targetLines(plan.cefr, state.kind).map(l => '- ' + l).join('\n');
  }

  function languageBlock(state, plan) {
    return [
      `CEFR level of the language: ${plan.cefr}. Stay inside this level even where the settings ask for natural or idiomatic speech.`,
      `Language complexity: ${scale(state.languageComplexity, ['very simple', 'simple', 'medium', 'complex', 'very complex'])} — this governs sentence length, grammatical complexity, idiomatic expressions, use of synonyms, natural conversational language and how explicitly information is stated.`,
      `Grammar complexity: ${scale(state.grammarComplexity, ['elementary structures only', 'mostly simple structures', 'level-typical mix', 'richer structures', 'full range of the level'])}.`,
      `Vocabulary difficulty (beyond the target words): ${scale(state.vocabularyDifficulty, ['very frequent words only', 'frequent words', 'level-typical', 'some less frequent words', 'demanding'])}.`,
      `Idiomatic language: ${scale(state.idiomaticLanguage, ['none', 'rare', 'occasional', 'frequent', 'very frequent'])}.`,
      `Information explicitness: ${scale(state.explicitness, ['very explicit — facts are stated directly', 'mostly explicit', 'mixed', 'often implicit — facts must be pieced together', 'highly implicit'])}. Example of explicit: "I didn't go to the party because I was sick." Less explicit: "Everyone was posting pictures from the party. I spent the evening on the sofa with a fever."`,
      levelTargetBlock(state, plan),
    ].filter(Boolean).join('\n');
  }

  function vocabularyBlock(state, plan) {
    const [min, max] = plan.vocabRange;
    const lines = [];
    if (state.vocabSelectionMode === 'manual') {
      lines.push(`Target vocabulary (manually selected, integrate ALL ${plan.vocabulary.length} items):`);
    } else {
      lines.push(`Unit vocabulary. Choose between ${min} and ${max} of these items as target vocabulary and integrate them; prefer the items that fit the scenario:`);
    }
    lines.push(vocabList(plan.vocabulary));
    lines.push(`Vocabulary usage intensity: ${scale(state.vocabUsage, ['low — each target word once, unobtrusively', 'moderate', 'medium — target words recur where natural', 'high — target words are recycled and prominent', 'very high — the text is built around the target words'])}.`);
    lines.push('Integrate the vocabulary naturally. Never force a word into the text; if an item does not fit, leave it out and choose another.');
    lines.push('Report every target item you actually used in "vocabularyUsed" (exact spelling from the list).');
    return lines.join('\n');
  }

  function listeningStructureBlock(state, plan) {
    const lines = [];
    const fmt = { monologue: 'Monologue (one speaker)', dialogue: 'Dialogue (2 speakers)', conversation: `Conversation (${plan.speakerCount} speakers)` }[state.format];
    lines.push(`Format: ${fmt}.`);
    if (plan.preset && plan.preset.structure) lines.push(`Conversation preset "${plan.preset.label}": build ${plan.preset.structure}.`);
    lines.push(`Target length: about ${plan.seconds} seconds of audio at ${plan.wpm} words per minute (speaking speed ${scale(state.speakingSpeed, ['slow', 'slow-natural', 'natural', 'natural-fast', 'fast'])}), i.e. approximately ${plan.targetWords} words in total (±10 %).`);
    lines.push('Speakers (use EXACTLY these labels in the "speaker" field) and their share of the total words:');
    for (const sp of plan.speakers) {
      let l = `- ${sp.label}: ${sp.share} % of the words`;
      if (sp.profile) {
        const p = sp.profile;
        const bits = [];
        if (p.age) bits.push(`age ${p.age}`);
        if (p.role) bits.push(`role: ${p.role}`);
        if (p.personality) bits.push(`personality: ${p.personality}`);
        if (bits.length) l += ` (${bits.join(', ')} — let this shape how they speak; it need not be stated in the text)`;
      }
      lines.push(l);
    }
    const balance = { balanced: 'all speakers talk roughly the same amount', natural: 'shares vary naturally without a clear main speaker', main: 'one person clearly speaks the most', custom: 'the shares above are set manually and must be met' }[state.speakerBalance];
    lines.push(`Speaker balance: ${balance}.`);
    lines.push(`Speaking turn length: ${scale(state.turnLength, ['very short turns', 'short turns (mostly 1–2 sentences)', 'natural mix of short and medium turns', 'longer turns', 'extended turns (several statements in a row)'])}, about ${plan.turnWords} words per turn on average.`);
    lines.push(`Turn length variability: ${scale(state.turnVariability, ['low — all turns similar in length', 'fairly uniform', 'medium', 'high — some turns are only a word or two ("Really?", "Why?", "I don\'t agree.") while others run for several sentences', 'very high'])}.`);
    if (plan.emotionTarget > 0) {
      lines.push(`Emotion & delivery tags: use the "emotion" field on roughly ${Math.round(plan.emotionTarget * 100)} % of the turns (level: ${state.emotionTags}), never on every turn; only where the emotion is functional for the conversation. Allowed tags: ${core.EMOTION_TAGS.join(', ')}. Leave "emotion" null elsewhere. These tags will drive a TTS system.`);
    } else {
      lines.push('Emotion & delivery tags are OFF: set "emotion" to null on every line.');
    }
    lines.push(`Naturalness: ${scale(state.naturalness, ['clean / educational', 'mostly clean', 'medium', 'authentic', 'fully authentic speech'])}. The higher the value, the more the script uses contractions, fillers, hesitation, short reactions, unfinished thoughts, reformulations, interruptions and natural discourse markers (e.g. "Well...", "Actually,", "I mean,", "You know,", "Wait, what?"); at the low end use complete sentences without fillers. Whatever the value, natural features must remain appropriate for the CEFR level.`);
    lines.push('Avoid artificial speaker changes: every turn must have a conversational reason.');
    return lines.join('\n');
  }

  function readingStructureBlock(state, plan) {
    const type = state.textType === 'Custom' ? String(state.customTextType || '').trim() : state.textType;
    return [
      `Text type: ${type}.`,
      `Length: approximately ${plan.targetWords} words (±10 %)` + (state.lengthMode === 'a4' ? ` (about ${state.a4Pages} A4 page(s))` : '') + '.',
      `Paragraph length: ${state.paragraphLength}.`,
      `Dialogue proportion: ${scale(state.dialogueProportion, ['none — no direct speech', 'a little direct speech', 'some dialogue passages', 'dialogue-heavy', 'almost entirely dialogue'])}.`,
      `Style: ${scale(state.styleBalance, ['strongly narrative', 'mostly narrative', 'balanced narrative/informational', 'mostly informational', 'strongly informational'])}.`,
    ].join('\n');
  }

  /* ------------------------------------------------------------------ */
  /* 1. Topic suggestions (concept §5 "Generate topic for me")            */
  /* ------------------------------------------------------------------ */

  function buildTopicPrompt(state, plan) {
    return [
      'You are an experienced EFL materials writer. Suggest scenarios for a classroom ' + (state.kind === 'listening' ? 'listening' : 'reading') + ' text.',
      sourceBlock(state, Object.assign({}, plan, { topicSource: 'unit', topic: plan.unitTopic || plan.unitName })),
      `CEFR level: ${plan.cefr}.` + (state.kind === 'listening' ? ` Format: ${state.format}` + (plan.preset && plan.preset.structure ? ` (${plan.preset.label})` : '') + '.' : ` Text type: ${state.textType}.`),
      'Unit vocabulary the scenario should make room for:\n' + vocabList(plan.vocabulary),
      'Propose 5 concrete, age-appropriate scenarios for teenagers (13–17). Each must be specific enough to write from (who, what, where, what is at stake).',
      'Reply with only a JSON array of 5 objects: [{"title": "short title", "description": "one or two sentences describing the scenario"}].',
    ].join('\n\n');
  }

  /* ------------------------------------------------------------------ */
  /* 2. Content: listening script or reading text                          */
  /* ------------------------------------------------------------------ */

  function contentSchema(state) {
    const meta = metaSchema(state);
    if (state.kind === 'listening') {
      return `{"title": "…", "summary": "one-sentence summary for the teacher", "meta": ${meta}, "vocabularyUsed": ["…"], "lines": [{"speaker": "label from the list", "emotion": "tag or null", "text": "what is said"}]}`;
    }
    return `{"title": "…", "summary": "one-sentence summary for the teacher", "meta": ${meta}, "vocabularyUsed": ["…"], "paragraphs": ["paragraph 1", "paragraph 2", …]}`;
  }

  function metaSpec(state) { return core.META_SPECS[core.designIdFor(state)] || core.META_SPECS.custom; }

  function metaSchema(state) {
    return '{' + metaSpec(state).fields.map(([k]) => `"${k}": …`).join(', ') + '}';
  }

  /**
   * The document details the material is laid out with (byline, From/To/Subject,
   * usernames, star rating …). They make the printed document look like the real
   * text type, so they are written by Claude, never filled in by the app.
   */
  function documentBlock(state) {
    const spec = metaSpec(state);
    const lines = [`The material is published as: ${spec.label}. Return a "meta" object with exactly these fields, written in the language of the text and consistent with its content:`];
    for (const [key, desc] of spec.fields) lines.push(`- "${key}": ${desc}`);
    lines.push('Invent plausible names, dates and publications; never use real people\'s names. Leave a field as an empty string only if it genuinely does not apply.');
    if (spec.headings) lines.push('You may structure the text with short subheadings: a subheading is its own entry in "paragraphs", at most 8 words long and without a full stop at the end.');
    return lines.join('\n');
  }

  function buildContentPrompt(state, plan) {
    const parts = [
      `You are an experienced EFL materials writer. Write a ${state.kind === 'listening' ? 'listening script for an audio recording' : 'reading text'} for a class of teenagers, based on the settings below. The material must be didactically controllable: language level and structure follow the settings exactly.`,
      '## Source & topic\n' + sourceBlock(state, plan),
      '## Language level\n' + languageBlock(state, plan),
      '## Target vocabulary\n' + vocabularyBlock(state, plan),
      (state.kind === 'listening' ? '## Audio structure\n' + listeningStructureBlock(state, plan) : '## Text structure\n' + readingStructureBlock(state, plan)),
      '## Document details\n' + documentBlock(state),
      '## Quality requirements\n- The text is coherent and reads naturally.\n- The topic fits the unit.\n- Speakers are clearly distinguishable by what they say and how they say it.' + (state.kind === 'listening' ? '\n- Do not put the emotion tag inside "text"; use the "emotion" field only.\n- One turn per line object; do not merge two speakers into one line.' : ''),
      'Reply with only a JSON object of this shape:\n' + contentSchema(state),
    ];
    return parts.join('\n\n');
  }

  /* ------------------------------------------------------------------ */
  /* 3. Worksheet: questions, higher-order tasks, pre-task                */
  /* ------------------------------------------------------------------ */

  function contentAsText(content, state) {
    if (state.kind === 'listening') {
      return (content.lines || []).map((l, i) => `[${i + 1}] ${l.speaker}: ${l.emotion ? '[' + l.emotion + '] ' : ''}${l.text}`).join('\n');
    }
    return (content.paragraphs || []).map((p, i) => `[¶${i + 1}] ${p}`).join('\n\n');
  }

  function preTaskTypeDef(key) { const t = core.PRE_TASK_TYPES.find(x => x.key === key); return t ? t.definition : key; }
  function preTaskTypeLabel(key) { const t = core.PRE_TASK_TYPES.find(x => x.key === key); return t ? t.label : key; }
  function socialFormLabel(key) { const f = core.SOCIAL_FORMS.find(x => x.key === key); return f ? f.label : key; }
  function socialFormEn(key) { const f = core.SOCIAL_FORMS.find(x => x.key === key); return f ? f.en : key; }
  function modeEn(key) { const m = core.PRE_TASK_MODES.find(x => x.key === key); return m ? m.en : key; }

  /**
   * The task block of one phase (concept §27 pre-task and §36 post-task).
   * Type, social form, working mode and time are fixed per position so that
   * the checks can verify them; everything else is Claude's.
   */
  function taskBlock(state, plan, phaseKey) {
    const isL = state.kind === 'listening';
    const isPre = phaseKey !== 'post';
    const ph = core.TASK_PHASES[isPre ? 'pre' : 'post'];
    const pt = isPre ? plan.preTask : plan.postTask;
    const heading = isPre ? `## Pre-task (before ${isL ? 'listening' : 'reading'})` : `## Post-task (after ${isL ? 'listening' : 'reading'})`;
    if (!pt || !pt.count) return heading + `\nNone: "${ph.prefix}s" is an empty array.`;
    const typeDef = (k) => { const t = ph.types.find(x => x.key === k); return t ? t.definition : k; };
    const typeLabel = (k) => { const t = ph.types.find(x => x.key === k); return t ? t.label : k; };
    const vocab = plan.vocabulary.map(w => w.word);
    const focus = isPre
      ? (pt.focus === 'vocabulary' ? 'the TARGET VOCABULARY of the unit — every task works with those words'
        : pt.focus === 'topic' ? 'the TOPIC — prior knowledge, attitudes and expectations, not single words'
        : 'the TOPIC and the TARGET VOCABULARY — at least one task activates prior knowledge about the topic and at least one works with the target words')
      : (pt.focus === 'vocabulary' ? 'the TARGET VOCABULARY — every task makes the students use those words productively'
        : pt.focus === 'content' ? `what the ${isL ? 'audio' : 'text'} says — the content is taken further, not repeated`
        : `the CONTENT and the TARGET VOCABULARY — the tasks take the content further and at least one of them makes the students use the target words productively`);
    const lines = [
      heading,
      `Write exactly ${pt.count} ${isPre ? 'pre' : 'post'}-task(s) in the array "${ph.prefix}s", in the given order. Type, social form, working mode and time are FIXED for every position:`,
      pt.tasks.map(t => `${isPre ? 'P' : 'T'}${t.n}: ${typeLabel(t.type)} ("type": "${t.type}") · "socialForm": "${t.socialForm}" (${socialFormEn(t.socialForm)}) · "mode": "${t.mode}" (${modeEn(t.mode)}) · "minutes": ${t.minutes}\n    ${typeDef(t.type)}`).join('\n'),
      `What the tasks work on: ${focus}. Target vocabulary of the unit: ${vocab.join(', ') || '–'}.`,
      `Language of the instructions, options and examples: CEFR ${pt.band}` + (pt.level ? ` (${core.QUESTION_LEVELS[pt.level].label})` : '') + '.'
        + (isPre ? ' Students read them before they know the material, so keep them short and unambiguous.' : ' Students read them after they have worked through the material.'),
      `Cognitive demand: ${scale(pt.difficulty, isPre ? [
        'reproductive — collect, name, tick, match; everything is given',
        'mostly reproductive with one small step of own thinking',
        'apply and connect — compare, sort, give a reason for a choice',
        'reason and judge — weigh arguments, justify a position, formulate a hypothesis',
        'evaluate and decide — argue a dilemma from both sides and commit to a position',
      ] : [
        'reproduce and organise — retell, list, sort what the material said',
        'apply closely — use single points of the material in a given frame',
        'apply and connect — transfer the content to a new situation and explain the link',
        'reason and create — build an own product or position on the material and justify it',
        'evaluate and create freely — judge the material, argue against it, design something own that goes clearly beyond it',
      ])}.`,
      `Support (scaffolding): ${scale(pt.scaffolding, [
        'none — the bare task',
        'a short example',
        'a word bank or sentence starters where they help',
        'word bank AND sentence starters, plus a worked example',
        'full support: word bank, sentence starters, a model answer and a structure to fill in',
      ])}. Put such support into "items".`,
    ];
    if (pt.criteria) {
      lines.push('Success criteria: give every task 2–3 short "criteria" — observable statements in student language and in English that say when the task is done well ("I can name three reasons why …", "We have agreed on an order and can justify it"). They describe what the students produce, not what they understand.');
    } else {
      lines.push('Success criteria: not required, "criteria" is an empty array.');
    }
    const common = '- A written task says exactly what is written down and where (list, table, sentences).\n'
      + '- An oral task gives a real reason to speak (a question to the partner, a position to defend, information the other side does not have) and asks for nothing in writing.\n'
      + '- Partner, group and plenary tasks say what each person does, so that nobody can sit back.\n'
      + `- The time in "minutes" must be realistic for the task in a class of 20 students (total ${pt.minutes} minutes).\n`
      + '- "materials": what the teacher has to prepare (empty string if nothing).';
    if (isPre) {
      lines.push('Rules for every pre-task:\n'
        + `- It must be solvable WITHOUT the ${isL ? 'audio' : 'text'} and must NOT give away any answer of the comprehension questions.\n`
        + '- A vocabulary task uses only words from the target vocabulary above and lists them in "vocabUsed".\n'
        + '- A confrontation task states the claim or dilemma itself; it is honestly arguable both ways and is not answered by the material alone.\n'
        + common);
    } else {
      lines.push('Rules for every post-task:\n'
        + `- It BUILDS ON the material: name in "reference" the concrete place it starts from (a statement, a decision, a number, a speaker's attitude) and make that visible in the task itself.\n`
        + '- It must NOT be answerable by repeating a comprehension question or a higher-order task of this worksheet; it asks the students to produce something of their own.\n'
        + '- "product" says in a few words what the students hand in or show at the end (three sentences, a short mail, a spoken position, a poster, a filled-in table).\n'
        + '- A vocabulary task makes the students USE the target words in own sentences or a short text, and lists them in "vocabUsed".\n'
        + '- A mediation task names the addressee and the purpose; a debate names the two sides; a role play names the roles.\n'
        + common);
    }
    lines.push(`Shape: {"n": 1, "type": "…", "title": "…", "prompt": "the instruction as the students read it", "items": ["word bank / statements / sentence starters"], "socialForm": "single|pair|group|plenary", "mode": "written|oral", "minutes": 3, "criteria": ["…"], "vocabUsed": ["…"], ${isPre ? '' : '"reference": "the place in the material the task starts from", "product": "what the students hand in", '}"materials": "…", "teacherNote": "what the teacher should watch for and how the task is picked up afterwards"}`);
    return lines.join('\n');
  }
  function preTaskBlock(state, plan) { return taskBlock(state, plan, 'pre'); }
  function postTaskBlock(state, plan) { return taskBlock(state, plan, 'post'); }

  /** Questions follow the timeline of the material — always, checked automatically. */
  function chronologyRule(isL) {
    const medium = isL ? 'audio' : 'text';
    return `The questions MUST appear in the order in which the information occurs in the ${medium} (the timeline). Number them in that order: Q1 refers to the earliest place, the last question to the latest. Only Gist / global-understanding questions may stand at the very beginning or the very end. The order is verified automatically against the position of each "evidenceQuote" in the ${medium}; a worksheet that breaks the timeline is rejected.`;
  }
  function skillCountLines(mix) {
    return core.SKILL_KEYS.filter(k => mix[k]).map(k => `- ${mix[k]}× ${skillLabel(k)} ("skill": "${k}") — ${SKILL_DEFINITIONS[k]}`).join('\n');
  }
  function formatCountLines(seq) {
    const counts = {};
    for (const f of seq) counts[f] = (counts[f] || 0) + 1;
    return Object.keys(counts).map(f => `- ${counts[f]}× ${formatLabel(f)} ("format": "${f}")`).join('\n');
  }
  function questionLevelLines(state, plan) {
    const lv = core.QUESTION_LEVELS[plan.questionLevel];
    const diff = plan.questionDifficulty == null ? state.questionDifficulty : plan.questionDifficulty;
    const out = [`Language level of the material: ${plan.cefr}.`];
    if (lv) {
      out.push(`Question level (meta-setting): ${lv.label} — ${lv.describe}. Every question, its options and its expected answer are written at CEFR ${lv.bands.join(' to ')}; give each question "difficulty" from ${lv.bands.map(b => '"' + b + '"').join(' / ')}.`);
      if (lv.bands.length > 1) out.push(`Use the lower band (${lv.bands[0]}) for Gist, Specific information and Detail questions and the higher band (${lv.bands[lv.bands.length - 1]}) only for Connecting, Inference, Attitude and Purpose questions.`);
    } else {
      out.push(`Questions are written at CEFR ${plan.questionBand}.`);
    }
    out.push(`Question difficulty is set INDEPENDENTLY of the text difficulty: ${scale(diff, ['easy', 'fairly easy', 'medium', 'challenging', 'very challenging'])}.`);
    return out.join('\n');
  }

  function buildQuestionPrompt(state, plan, content) {
    const isL = state.kind === 'listening';
    const lines = [];
    lines.push(`You are an experienced EFL test writer. Create a worksheet for the ${isL ? 'listening script' : 'reading text'} below. Students will ${isL ? 'hear the audio (they do not see the script)' : 'read the text'}.`);
    lines.push('## Material\nTitle: ' + content.title + '\n' + contentAsText(content, state));
    lines.push('## Language\n' + questionLevelLines(state, plan));
    lines.push('## Difficulty control\nDifficulty must not come from the question type alone. Adjust it through: how explicitly the information is given, the distance between information and question, the use of synonyms/paraphrase instead of the words of the text, how many pieces of information must be combined, the plausibility of distractors, the share of inference and the linguistic complexity of the question.'
      + `\nDistractor difficulty: ${scale(state.distractorDifficulty, ['obviously wrong distractors', 'easy distractors', 'plausible distractors', 'demanding distractors that echo the text', 'very demanding distractors'])}.`
      + `\nInference level: ${scale(state.inferenceLevel, ['inference questions stay very close to the text', 'light inference', 'medium inference', 'inference questions require genuine reasoning', 'deep inference'])}.`);

    lines.push('## Comprehension questions\n' + `Write exactly ${plan.questionCount} questions. Each question tests ONE skill; the number of questions per skill is fixed:\n`
      + skillCountLines(plan.skillMix));
    if (plan.formatSequence) {
      lines.push('## Response formats (automatic balanced mix)\nUse the enabled formats this many times (the spread is fixed; which question gets which format is your choice, but Gist questions take "best_summary" when it is listed):\n' + formatCountLines(plan.formatSequence));
    } else {
      lines.push('## Response formats\nChoose for each question one of these enabled formats and vary them sensibly: ' + plan.formats.map(f => `${formatLabel(f)} ("${f}")`).join(', ') + '.');
    }
    lines.push('## Format shapes\n' + plan.formats.map(f => `- ${f}: ${FORMAT_SHAPES[f]}`).join('\n'));
    lines.push('## Order (mandatory)\n' + chronologyRule(isL));
    lines.push('## Evidence\nFor every question give "evidenceQuote": a VERBATIM excerpt (5–20 words, copied exactly) from the material that contains or implies the answer, and "evidenceRef": the line number ' + (isL ? '[n]' : '[¶n]') + ' where it is found. For Inference, Connecting, Attitude and Purpose questions add "rationale": one sentence explaining why the answer follows from the material (for Connecting questions name both places).');
    lines.push('## Quality rules\n- Every question is answerable unambiguously and only from the material.\n- No two questions test the same piece of information.\n- Inference questions are genuinely inferential, not disguised detail questions.\n- Distractors are plausible but clearly wrong given the material.\n- Give each question "difficulty": its CEFR band, one of ' + plan.questionBands.map(b => '"' + b + '"').join(', ') + '.');

    if (plan.higherOrderCount > 0) {
      lines.push('## Higher-order thinking\n' + `Additionally write ${plan.higherOrderCount} higher-order task(s) in a SEPARATE array "higherOrder" (do not mix them with the comprehension questions). Types to use: ${plan.higherOrderTypes.join(', ')} — Interpretation: interpret meaning more deeply; Transfer: apply information to a new situation; Evaluation: judge a decision or position on the basis of the material. Use "type" for the type and a short-answer shape with "answer" as a model answer and "rationale".`);
    } else {
      lines.push('## Higher-order thinking\nNone: "higherOrder" is an empty array.');
    }

    lines.push(preTaskBlock(state, plan));
    lines.push(postTaskBlock(state, plan));

    lines.push('## Student instruction\nWrite "instructions": a short instruction for students (1–2 sentences) at their level, and "title": the worksheet title.');
    lines.push('Reply with only a JSON object: {"title": "…", "instructions": "…", "preTasks": [...], "postTasks": [...], "questions": [{"n": 1, "skill": "gist|specific|detail|connecting|inference|attitude|purpose|context", "format": "…", "difficulty": "CEFR band", "prompt": "…", …format fields…, "answer": …, "evidenceQuote": "…", "evidenceRef": "…", "rationale": "…"}], "higherOrder": [{"n": 1, "type": "…", "prompt": "…", "answer": "…", "rationale": "…"}]}');
    return lines.join('\n\n');
  }

  /* ------------------------------------------------------------------ */
  /* 4. Quality review (concept §29, the judgements that need reading)     */
  /* ------------------------------------------------------------------ */

  function buildReviewPrompt(state, plan, content, worksheet, llmRules, deterministicFindings) {
    const lines = [];
    lines.push('You are a strict reviewer of EFL classroom material. Check the material and worksheet below against each rule and answer with pass/fail per rule. Be concrete: name question numbers or lines.');
    lines.push('## Settings\n' + [
      `Kind: ${state.kind}; textbook unit: ${plan.unitName}` + (plan.unitTopic ? ` (${plan.unitTopic})` : '') + `; intended topic: ${plan.topic}`,
      `Language level: ${plan.cefr}; question level: ${plan.questionBand}; question difficulty: ${plan.questionDifficulty == null ? state.questionDifficulty : plan.questionDifficulty}/100`,
      `Target vocabulary that should appear: ${plan.vocabulary.map(w => w.word).join(', ')}`,
      state.kind === 'listening' ? `Speakers and target shares: ${plan.speakers.map(s => `${s.label} ${s.share} %`).join(', ')}; emotion tags: ${state.emotionTags}; naturalness ${state.naturalness}/100` : `Text type: ${state.textType}`,
      worksheet ? `Planned skills: ${core.SKILL_KEYS.filter(k => plan.skillMix[k]).map(k => `${plan.skillMix[k]}× ${k}`).join(', ')}; allowed question bands: ${plan.questionBands.join(', ')}` + (plan.questionLevel ? ` (${plan.questionLevelLabel})` : '') : 'No worksheet.',
      worksheet ? 'Questions must follow the order of the material — the timeline (gist may be first/last).' : '',
      worksheet && plan.preTask ? `Pre-task plan: ${plan.preTask.tasks.map(t => `P${t.n} ${t.type}/${t.socialForm}/${t.mode}/${t.minutes}min`).join(', ')}; focus ${plan.preTask.focus}; language ${plan.preTask.band}; demand ${plan.preTask.difficulty}/100; success criteria ${plan.preTask.criteria ? 'required' : 'not required'}` : '',
      worksheet && plan.postTask ? `Post-task plan: ${plan.postTask.tasks.map(t => `T${t.n} ${t.type}/${t.socialForm}/${t.mode}/${t.minutes}min`).join(', ')}; focus ${plan.postTask.focus}; language ${plan.postTask.band}; demand ${plan.postTask.difficulty}/100; success criteria ${plan.postTask.criteria ? 'required' : 'not required'}` : '',
    ].filter(Boolean).join('\n'));
    lines.push('## Material\n' + contentAsText(content, state));
    if (worksheet) lines.push('## Worksheet (JSON)\n' + JSON.stringify({ preTasks: worksheet.preTasks, questions: worksheet.questions, higherOrder: worksheet.higherOrder }, null, 0).slice(0, 30000));
    if (deterministicFindings && deterministicFindings.length) {
      lines.push('## Automatic measurements already taken (for context)\n' + deterministicFindings.map(f => `- ${f.title}: ${f.status}${f.detail ? ' — ' + f.detail : ''}`).join('\n'));
    }
    lines.push('## Rules to judge\n' + llmRules.map(r => `- "${r.id}": ${r.title} — ${r.criterion}`).join('\n'));
    lines.push('Reply with only a JSON object: {"results": [{"rule": "rule id", "pass": true|false, "note": "short justification, name question numbers/lines", "questions": [numbers of affected questions]}], "fixInstructions": "what exactly the writer must change to fix every failed rule (empty string if all pass)"}');
    return lines.join('\n\n');
  }

  /* ------------------------------------------------------------------ */
  /* 5. Revision prompts                                                   */
  /* ------------------------------------------------------------------ */

  function buildContentRevisionPrompt(state, plan, content, findings) {
    return [
      buildContentPrompt(state, plan),
      '## Revision\nA previous draft did not meet the requirements. Revise it so that every finding below is fixed while keeping what already works. Return the complete revised material in the same JSON shape.',
      '### Findings\n' + findingsBlock(findings),
      '### Previous draft\n' + JSON.stringify(content).slice(0, 30000),
    ].join('\n\n');
  }

  function buildQuestionRevisionPrompt(state, plan, content, worksheet, findings, fixInstructions) {
    return [
      buildQuestionPrompt(state, plan, content),
      '## Revision\nA previous worksheet draft failed the quality check. Fix every finding below, keep the questions that were fine, and return the complete worksheet in the same JSON shape (same number of questions, same number of questions per skill, timeline order).',
      '### Findings\n' + findingsBlock(findings) + (fixInstructions ? '\n\nReviewer instructions: ' + fixInstructions : ''),
      '### Previous worksheet\n' + JSON.stringify(worksheet).slice(0, 30000),
    ].join('\n\n');
  }

  /**
   * Targeted repair: rewrite only the questions a check complained about.
   * Claude sees the whole worksheet (so the replacements test something new)
   * but returns only the numbered questions it was asked to replace.
   */
  function buildQuestionRepairPrompt(state, plan, content, worksheet, findings, numbers, fixInstructions) {
    const isL = state.kind === 'listening';
    const targets = (numbers || []).slice().sort((a, b) => a - b);
    const byNumber = new Map((worksheet.questions || []).map(q => [Number(q.n), q]));
    const problemsFor = (n) => (findings || [])
      .filter(f => (f.questions || []).map(Number).includes(Number(n)))
      .map(f => `${f.title}: ${f.detail || ''}`.trim());
    const otherLines = (worksheet.questions || [])
      .filter(q => !targets.includes(Number(q.n)))
      .map(q => `Q${q.n} (${skillLabel(q.skill)}): ${q.prompt || q.statement || ''} → ${Array.isArray(q.answer) ? q.answer.join(' / ') : q.answer}`);
    const formats = [...new Set(targets.map(n => (byNumber.get(n) || {}).format).filter(Boolean))];

    const lines = [];
    lines.push(`You are revising a worksheet for the ${isL ? 'listening script' : 'reading text'} below. Replace ONLY the questions listed as "to replace"; every other question stays exactly as it is.`);
    lines.push('## Material\nTitle: ' + content.title + '\n' + contentAsText(content, state));
    lines.push('## Questions that stay (do not repeat what they already test)\n' + (otherLines.length ? otherLines.join('\n') : '– none –'));
    lines.push('## To replace\n' + targets.map(n => {
      const q = byNumber.get(n) || {};
      const problems = problemsFor(n);
      return [
        `### Q${n}`,
        `Required skill: ${skillLabel(q.skill)} — ${SKILL_DEFINITIONS[q.skill] || ''}`,
        `Required response format: ${formatLabel(q.format)} ("format": "${q.format}")`,
        `Required level: ${plan.questionBands.includes(q.difficulty) ? q.difficulty : plan.questionBand}`,
        'Current version: ' + JSON.stringify(q),
        'What is wrong: ' + (problems.length ? problems.join(' | ') : 'it must be replaced by a question that tests something different'),
      ].join('\n');
    }).join('\n\n'));
    if (fixInstructions) lines.push('## Reviewer instructions\n' + String(fixInstructions));
    lines.push('## Rules for the replacements\n'
      + `- Keep the question number, the skill and the response format exactly as required above.\n`
      + `- Each replacement must test a piece of information that NO other question on the sheet tests — a different fact, a different place in the ${isL ? 'audio' : 'text'}, a different reasoning step.\n`
      + '- It must be answerable unambiguously and only from the material.\n'
      + `- Give "evidenceQuote": a VERBATIM excerpt (5–20 words) from the material, and "evidenceRef": the line number ${isL ? '[n]' : '[¶n]'} where it stands. Use a different place in the material than the questions that stay, wherever the skill allows it.\n`
      + '- For Inference, Connecting, Attitude and Purpose questions add "rationale": one sentence saying why the answer follows.\n'
      + '- Inference questions must require reasoning beyond what is stated; do not restate another question as a generalisation.\n'
      + `- Question difficulty: ${scale(plan.questionDifficulty == null ? state.questionDifficulty : plan.questionDifficulty, ['easy', 'fairly easy', 'medium', 'challenging', 'very challenging'])}; distractors: ${scale(state.distractorDifficulty, ['obviously wrong', 'easy', 'plausible', 'demanding', 'very demanding'])}; "difficulty" is one of ${plan.questionBands.join(' / ')}.`
      + `\n- Keep the ${isL ? 'audio' : 'text'} timeline: a replacement should point at roughly the same place in the material as the question it replaces (between the places of its neighbours), unless the problem was exactly that. The order is verified automatically.`);
    if (formats.length) lines.push('## Format shapes\n' + formats.map(f => `- ${f}: ${FORMAT_SHAPES[f]}`).join('\n'));
    lines.push('Reply with only a JSON object holding the replacements: {"questions": [' + targets.map(n => `{"n": ${n}, "skill": "…", "format": "…", "difficulty": "…", "prompt": "…", …format fields…, "answer": …, "evidenceQuote": "…", "evidenceRef": "…", "rationale": "…"}`).join(', ') + ']}');
    return lines.join('\n\n');
  }

  /**
   * Targeted repair of one task phase: the questions stay untouched, only the
   * pre- or post-tasks are written again with the findings in front of them.
   */
  function buildTaskRepairPrompt(state, plan, content, worksheet, findings, fixInstructions, phaseKey) {
    const isL = state.kind === 'listening';
    const isPre = phaseKey !== 'post';
    const field = isPre ? 'preTasks' : 'postTasks';
    const questions = (worksheet.questions || []).map(q => `Q${q.n} (${skillLabel(q.skill)}): ${q.prompt || q.statement || ''} → ${Array.isArray(q.answer) ? q.answer.join(' / ') : q.answer}`).join('\n');
    return [
      `You are revising the ${isPre ? 'pre' : 'post'}-${isL ? 'listening' : 'reading'} tasks of a worksheet. The comprehension questions stay exactly as they are; write the ${isPre ? 'pre' : 'post'}-tasks again so that every problem below is gone.`,
      '## Material\n' + contentAsText(content, state),
      (isPre ? '## Comprehension questions that follow (do not anticipate any of these answers)\n' : '## Comprehension questions of this worksheet (a post-task must not simply repeat them)\n') + questions,
      (worksheet.higherOrder || []).length && !isPre ? '## Higher-order tasks of this worksheet (do not repeat these either)\n' + worksheet.higherOrder.map(h => `- ${h.prompt}`).join('\n') : '',
      `## Current ${isPre ? 'pre' : 'post'}-tasks\n` + JSON.stringify(worksheet[field] || [], null, 0).slice(0, 12000),
      '## What is wrong\n' + findingsBlock(findings) + (fixInstructions ? '\n\nReviewer instructions: ' + fixInstructions : ''),
      taskBlock(state, plan, isPre ? 'pre' : 'post'),
      `Reply with only a JSON object: {"${field}": [ … the complete new list in the fixed order … ]}`,
    ].filter(Boolean).join('\n\n');
  }
  function buildPreTaskRepairPrompt(state, plan, content, worksheet, findings, fixInstructions) {
    return buildTaskRepairPrompt(state, plan, content, worksheet, findings, fixInstructions, 'pre');
  }
  function buildPostTaskRepairPrompt(state, plan, content, worksheet, findings, fixInstructions) {
    return buildTaskRepairPrompt(state, plan, content, worksheet, findings, fixInstructions, 'post');
  }

  /* ------------------------------------------------------------------ */
  /* 5b. Glossary of hard words (worksheet option, concept §28)            */
  /* ------------------------------------------------------------------ */

  /**
   * The words come from the level meter (rare words above the level minus the
   * target vocabulary); Claude writes the learner-facing explanations.
   */
  function buildGlossaryPrompt(state, plan, content, candidates) {
    const isL = state.kind === 'listening';
    const band = plan.questionBands ? plan.questionBands[0] : plan.cefr;
    return [
      `You are an EFL teacher preparing a worksheet for CEFR ${plan.cefr} learners. Explain the difficult words below as they are used in the ${isL ? 'listening script' : 'text'}, for a glossary on the first page of the worksheet.`,
      '## Material\n' + contentAsText(content, state),
      '## Words to explain\n' + candidates.map(c => `- ${c.word}` + (c.count > 1 ? ` (${c.count}×)` : '')).join('\n'),
      '## Rules\n- Explain the meaning the word has HERE, in simple English at CEFR ' + band + ' (max. 12 words), and add the German equivalent.\n- Give the word as it appears in the material (the "form") and its base form (the "word").\n- Keep the order in which the words first occur in the material.\n- Do not explain the target vocabulary of the unit: ' + plan.vocabulary.map(w => w.word).join(', ') + '.\n- Skip a word only if it is a name or truly not explainable; do not add words.',
      'Reply with only a JSON object: {"glossary": [{"word": "…", "form": "…", "explanation": "…", "german": "…"}]}',
    ].join('\n\n');
  }

  /* ------------------------------------------------------------------ */
  /* 5c. Second opinion on the measured level (Niveau messen page)        */
  /* ------------------------------------------------------------------ */

  function buildLevelOpinionPrompt(text, kind, measured) {
    const isL = kind === 'listening';
    const dims = (measured.dimensions || []).map(d => `- ${d.label}: ${d.value} ${d.unit} → ${d.band}`).join('\n');
    const bands = level.BANDS.map(b => `- ${b}: ${(level.DESCRIPTORS[b] || {})[isL ? 'listening' : 'reading']} Sprachlich: ${(level.DESCRIPTORS[b] || {}).language}`).join('\n');
    return [
      `You are an experienced CEFR rater for English ${isL ? 'listening' : 'reading'} material for Swiss secondary school students. Rate the ${isL ? 'script' : 'text'} below on the six-band scale used by this tool and compare your judgement with the automatic measurement.`,
      '## Scale\n' + bands,
      '## Material\n' + text,
      `## Automatic measurement\nOverall: ${measured.band} (score ${measured.score} on a 0–5 scale, confidence ${measured.confidence})\n${dims}\nHard words: ${(measured.hardWords || []).slice(0, 15).map(h => h.word).join(', ')}`,
      'Reply with only a JSON object: {"band": "one of ' + level.BANDS.join('|') + '", "agree": true|false, "justification": "3–5 sentences in German naming concrete features of the text", "hardest": ["up to 5 concrete words or structures that push the level up"], "toReach": {"easier": "one German sentence: what to change for one band lower", "harder": "one German sentence: what to change for one band higher"}}',
    ].join('\n\n');
  }

  /** What the repair round tells the reviewer/writer about the findings. */
  function findingsBlock(findings) {
    return (findings || []).map(f => `- [${f.status}] ${f.title}: ${f.detail || ''}`
      + (f.questions && f.questions.length ? ` (Q${f.questions.join(', Q')})` : '')).join('\n');
  }

  /* ------------------------------------------------------------------ */
  /* 6. Vocabulary import from unstructured text                          */
  /* ------------------------------------------------------------------ */

  function buildVocabParsePrompt(rawText, hint) {
    return [
      'Extract the vocabulary list from the following textbook material. It may contain unit headings, page numbers, example sentences and translations in any layout.',
      hint ? 'Hint from the teacher: ' + hint : '',
      'Text:\n"""\n' + rawText.slice(0, 40000) + '\n"""',
      'Reply with only a JSON array: [{"unit": "unit name as written, or empty", "word": "English item", "translation": "translation if present, else empty", "note": "example/collocation/part of speech if present, else empty"}]. Keep the order of the source. Do not invent items.',
    ].filter(Boolean).join('\n\n');
  }

  /**
   * Split an unstructured vocabulary list into units. Claude sees the list in
   * its original order and returns groups covering it completely, each with a
   * unit name and a topic — the names and topics are Claude's, not the app's.
   */
  function buildUnitDetectPrompt(entries, hint) {
    const withTranslation = entries.length <= 250;
    const list = entries.map((w, i) => `${i + 1}. ${w.word}${withTranslation && w.translation ? ' — ' + w.translation : ''}`).join('\n');
    return [
      'You are a language teacher sorting a textbook vocabulary list into units.',
      hint ? 'Note from the teacher: ' + hint : '',
      `The list has ${entries.length} entries, in their original order:\n${list}`,
      'Decide whether the list contains several thematic blocks (units or lessons) or is one single list. Group only where the vocabulary really changes theme; a list about one theme stays a single group. Aim for groups of at least 6 entries.',
      'For every group give:\n- "name": the unit name a teacher would write, continuing any numbering that is visible in the list; if there is none, number the groups from 1 ("Unit 1", "Unit 2", …).\n- "topic": 2–5 words naming what the vocabulary of that group is about, in English.\n- "from" and "to": the 1-based line numbers of the first and last entry of the group, inclusive.',
      'The groups must be in order and cover every line from 1 to ' + entries.length + ' without gaps or overlaps.',
      'Reply with only a JSON object: {"units": [{"name": "…", "topic": "…", "from": 1, "to": 12}]}',
    ].filter(Boolean).join('\n\n');
  }

  /** Derive a topic for units that have none, from the words they contain. */
  function buildUnitTopicPrompt(units) {
    const list = units.map((u, i) => `${i + 1}. "${u.name}": ${u.words.slice(0, 40).map(w => w.word).join(', ')}`).join('\n');
    return [
      'You are a language teacher describing the units of a textbook.',
      'Each line is one unit with its vocabulary:\n' + list,
      'For every unit give a topic of 2–5 words in English that names what its vocabulary is about (for example "Friends and communication" or "Films and cinema"). Keep the unit name exactly as given.',
      'Reply with only a JSON array: [{"unit": "unit name as given", "topic": "…"}]',
    ].join('\n\n');
  }

  /* ------------------------------------------------------------------ */
  /* All prompts at once — used by the concept checks                     */
  /* ------------------------------------------------------------------ */

  function buildAllPrompts(state, ctx, fixture) {
    const plan = core.buildPlan(state, ctx);
    const content = fixture && fixture.content ? fixture.content : (state.kind === 'listening'
      ? { title: 'T', summary: '', vocabularyUsed: [], lines: [{ speaker: plan.speakerLabels[0] || 'Speaker A', emotion: null, text: 'x' }] }
      : { title: 'T', summary: '', vocabularyUsed: [], paragraphs: ['x'] });
    const worksheet = fixture && fixture.worksheet ? fixture.worksheet : { preTasks: [], questions: [], higherOrder: [] };
    return {
      topic: buildTopicPrompt(state, plan),
      content: buildContentPrompt(state, plan),
      questions: state.createWorksheet ? buildQuestionPrompt(state, plan, content) : '',
      review: buildReviewPrompt(state, plan, content, state.createWorksheet ? worksheet : null, [], []),
      glossary: state.createWorksheet && state.glossary ? buildGlossaryPrompt(state, plan, content, [{ word: 'x', count: 1 }]) : '',
    };
  }

  return {
    scale, SKILL_DEFINITIONS, FORMAT_SHAPES, contentAsText, documentBlock, metaSpec, contentSchema,
    buildTopicPrompt, buildContentPrompt, buildQuestionPrompt, buildReviewPrompt,
    buildContentRevisionPrompt, buildQuestionRevisionPrompt, buildQuestionRepairPrompt, findingsBlock, buildVocabParsePrompt,
    buildUnitDetectPrompt, buildUnitTopicPrompt, buildAllPrompts, buildGlossaryPrompt, buildLevelOpinionPrompt,
    chronologyRule, levelTargetBlock, questionLevelLines, taskBlock, preTaskBlock, postTaskBlock,
    buildTaskRepairPrompt, buildPreTaskRepairPrompt, buildPostTaskRepairPrompt,
  };
});
