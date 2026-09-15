/*
 * LRMaster prompts — turns a settings state plus its plan into the
 * instructions Claude receives. Every generation setting in core.SCHEMA is
 * read here; the concept checks verify that changing any of them changes the
 * resulting prompt text. No generated content lives in this file: titles,
 * texts, questions, instructions and topic ideas all come from Claude.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else { root.LR = root.LR || {}; root.LR.prompts = factory(root.LR.core); }
})(typeof self !== 'undefined' ? self : this, function (core) {
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
    multiple_choice: '"options": ["A …","B …","C …","D …"], "answer": "letter"',
    true_false: '"statement": "…", "answer": "True" | "False"',
    true_false_correction: '"statement": "…", "answer": "True" | "False", "correction": "corrected statement if false, otherwise empty"',
    short_answer: '"answer": "model answer (a few words)", "acceptable": ["variant", …]',
    wh_question: '"answer": "model answer", "acceptable": ["variant", …]',
    sentence_completion: '"prompt" contains a sentence with ____ to complete, "answer": "the missing words"',
    gap_fill: '"prompt" contains a short passage with numbered gaps (1)…, "answer": ["gap 1", "gap 2", …]',
    matching: '"items": [{"left": "…", "right": "…"}, …] (3–6 pairs, correct pairing; the student version shuffles the right column), "answer": "see items"',
    who_said_it: '"statement": "paraphrased statement", "options": [speaker names], "answer": "speaker name"',
    ordering: '"items": ["event 1", "event 2", …] in the CORRECT order (the student version shuffles them), "answer": "see items"',
    table_completion: '"table": {"headers": ["…"], "rows": [["…", "___", "…"], …]}, "answer": ["cell 1", "cell 2", …] in reading order of the blanks',
    select_all: '"options": ["A …","B …","C …","D …","E …"], "answer": ["A","C"]',
    best_summary: '"options": ["A summary …","B summary …","C summary …"], "answer": "letter"',
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

  function languageBlock(state, plan) {
    return [
      `CEFR level of the language: ${plan.cefr}. Stay inside this level even where the settings ask for natural or idiomatic speech.`,
      `Language complexity: ${scale(state.languageComplexity, ['very simple', 'simple', 'medium', 'complex', 'very complex'])} — this governs sentence length, grammatical complexity, idiomatic expressions, use of synonyms, natural conversational language and how explicitly information is stated.`,
      `Grammar complexity: ${scale(state.grammarComplexity, ['elementary structures only', 'mostly simple structures', 'level-typical mix', 'richer structures', 'full range of the level'])}.`,
      `Vocabulary difficulty (beyond the target words): ${scale(state.vocabularyDifficulty, ['very frequent words only', 'frequent words', 'level-typical', 'some less frequent words', 'demanding'])}.`,
      `Idiomatic language: ${scale(state.idiomaticLanguage, ['none', 'rare', 'occasional', 'frequent', 'very frequent'])}.`,
      `Information explicitness: ${scale(state.explicitness, ['very explicit — facts are stated directly', 'mostly explicit', 'mixed', 'often implicit — facts must be pieced together', 'highly implicit'])}. Example of explicit: "I didn't go to the party because I was sick." Less explicit: "Everyone was posting pictures from the party. I spent the evening on the sofa with a fever."`,
    ].join('\n');
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
    if (state.kind === 'listening') {
      return '{"title": "…", "summary": "one-sentence summary for the teacher", "vocabularyUsed": ["…"], "lines": [{"speaker": "label from the list", "emotion": "tag or null", "text": "what is said"}]}';
    }
    return '{"title": "…", "summary": "one-sentence summary for the teacher", "vocabularyUsed": ["…"], "paragraphs": ["paragraph 1", "paragraph 2", …]}';
  }

  function buildContentPrompt(state, plan) {
    const parts = [
      `You are an experienced EFL materials writer. Write a ${state.kind === 'listening' ? 'listening script for an audio recording' : 'reading text'} for a class of teenagers, based on the settings below. The material must be didactically controllable: language level and structure follow the settings exactly.`,
      '## Source & topic\n' + sourceBlock(state, plan),
      '## Language level\n' + languageBlock(state, plan),
      '## Target vocabulary\n' + vocabularyBlock(state, plan),
      (state.kind === 'listening' ? '## Audio structure\n' + listeningStructureBlock(state, plan) : '## Text structure\n' + readingStructureBlock(state, plan)),
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

  function buildQuestionPrompt(state, plan, content) {
    const isL = state.kind === 'listening';
    const lines = [];
    lines.push(`You are an experienced EFL test writer. Create a worksheet for the ${isL ? 'listening script' : 'reading text'} below. Students will ${isL ? 'hear the audio (they do not see the script)' : 'read the text'}.`);
    lines.push('## Material\nTitle: ' + content.title + '\n' + contentAsText(content, state));
    lines.push('## Language\n' + `Language level of the material: ${plan.cefr}. Questions are written at CEFR ${plan.questionBand}; question difficulty is set INDEPENDENTLY of the text difficulty: ${scale(state.questionDifficulty, ['easy', 'fairly easy', 'medium', 'challenging', 'very challenging'])}.`);
    lines.push('## Difficulty control\nDifficulty must not come from the question type alone. Adjust it through: how explicitly the information is given, the distance between information and question, the use of synonyms/paraphrase instead of the words of the text, how many pieces of information must be combined, the plausibility of distractors, the share of inference and the linguistic complexity of the question.'
      + `\nDistractor difficulty: ${scale(state.distractorDifficulty, ['obviously wrong distractors', 'easy distractors', 'plausible distractors', 'demanding distractors that echo the text', 'very demanding distractors'])}.`
      + `\nInference level: ${scale(state.inferenceLevel, ['inference questions stay very close to the text', 'light inference', 'medium inference', 'inference questions require genuine reasoning', 'deep inference'])}.`);

    lines.push('## Comprehension questions\n' + `Write exactly ${plan.questionCount} questions. Each question tests ONE of these skills; the required skill for each question number is fixed:\n`
      + plan.skillSequence.map((s, i) => `Q${i + 1}: ${skillLabel(s)} — ${SKILL_DEFINITIONS[s]}`).join('\n'));
    if (plan.formatSequence) {
      lines.push('## Response formats (automatic balanced mix)\nThe response format for each question is fixed:\n' + plan.formatSequence.map((f, i) => `Q${i + 1}: ${formatLabel(f)} ("format": "${f}")`).join('\n'));
    } else {
      lines.push('## Response formats\nChoose for each question one of these enabled formats and vary them sensibly: ' + plan.formats.map(f => `${formatLabel(f)} ("${f}")`).join(', ') + '.');
    }
    lines.push('## Format shapes\n' + plan.formats.map(f => `- ${f}: ${FORMAT_SHAPES[f]}`).join('\n'));
    lines.push('## Order\n' + (state.followChronology
      ? `Follow ${isL ? 'audio' : 'text'} chronology: questions appear in the same order as the information in the ${isL ? 'audio' : 'text'}. Only Gist / global-understanding questions may stand at the beginning or the end.`
      : 'The order of the questions is free; group them sensibly.'));
    lines.push('## Evidence\nFor every question give "evidenceQuote": a VERBATIM excerpt (5–20 words, copied exactly) from the material that contains or implies the answer, and "evidenceRef": the line number ' + (isL ? '[n]' : '[¶n]') + ' where it is found. For Inference, Connecting, Attitude and Purpose questions add "rationale": one sentence explaining why the answer follows from the material (for Connecting questions name both places).');
    lines.push('## Quality rules\n- Every question is answerable unambiguously and only from the material.\n- No two questions test the same piece of information.\n- Inference questions are genuinely inferential, not disguised detail questions.\n- Distractors are plausible but clearly wrong given the material.\n- Give each question "difficulty": its CEFR band (e.g. "' + plan.questionBand + '").');

    if (plan.higherOrderCount > 0) {
      lines.push('## Higher-order thinking\n' + `Additionally write ${plan.higherOrderCount} higher-order task(s) in a SEPARATE array "higherOrder" (do not mix them with the comprehension questions). Types to use: ${plan.higherOrderTypes.join(', ')} — Interpretation: interpret meaning more deeply; Transfer: apply information to a new situation; Evaluation: judge a decision or position on the basis of the material. Use "type" for the type and a short-answer shape with "answer" as a model answer and "rationale".`);
    } else {
      lines.push('## Higher-order thinking\nNone: "higherOrder" is an empty array.');
    }

    if (plan.preTaskTypes.length > 0) {
      const desc = { prediction: 'Prediction — e.g. from the title: what will the speakers/text probably discuss?', vocabulary: 'Vocabulary Activation — pre-teach 2–4 relevant target words with a short activity', speaking: 'Speaking Prompt — a short partner question on the topic' };
      lines.push('## Pre-task\n' + `Create one pre-${isL ? 'listening' : 'reading'} task per type: ${plan.preTaskTypes.map(t => desc[t]).join('; ')}. Pre-tasks must NOT give away any answer to the questions. Shape: {"type": "prediction|vocabulary|speaking", "title": "…", "prompt": "…", "items": ["…"] (optional), "teacherNote": "…"}.`);
    } else {
      lines.push('## Pre-task\nNone: "preTasks" is an empty array.');
    }

    lines.push('## Student instruction\nWrite "instructions": a short instruction for students (1–2 sentences) at their level, and "title": the worksheet title.');
    lines.push('Reply with only a JSON object: {"title": "…", "instructions": "…", "preTasks": [...], "questions": [{"n": 1, "skill": "gist|specific|detail|connecting|inference|attitude|purpose|context", "format": "…", "difficulty": "CEFR band", "prompt": "…", …format fields…, "answer": …, "evidenceQuote": "…", "evidenceRef": "…", "rationale": "…"}], "higherOrder": [{"n": 1, "type": "…", "prompt": "…", "answer": "…", "rationale": "…"}]}');
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
      `Language level: ${plan.cefr}; question level: ${plan.questionBand}; question difficulty: ${state.questionDifficulty}/100`,
      `Target vocabulary that should appear: ${plan.vocabulary.map(w => w.word).join(', ')}`,
      state.kind === 'listening' ? `Speakers and target shares: ${plan.speakers.map(s => `${s.label} ${s.share} %`).join(', ')}; emotion tags: ${state.emotionTags}; naturalness ${state.naturalness}/100` : `Text type: ${state.textType}`,
      worksheet ? `Planned skills: ${plan.skillSequence.map((s, i) => `Q${i + 1}=${s}`).join(', ')}` : 'No worksheet.',
      state.createWorksheet && state.followChronology ? 'Questions must follow the order of the material (gist may be first/last).' : '',
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
      '### Findings\n' + findings.map(f => `- ${f.title}: ${f.detail || f.status}`).join('\n'),
      '### Previous draft\n' + JSON.stringify(content).slice(0, 30000),
    ].join('\n\n');
  }

  function buildQuestionRevisionPrompt(state, plan, content, worksheet, findings, fixInstructions) {
    return [
      buildQuestionPrompt(state, plan, content),
      '## Revision\nA previous worksheet draft failed the quality check. Fix every finding below, keep the questions that were fine, and return the complete worksheet in the same JSON shape (same number of questions, same skill per question number).',
      '### Findings\n' + findings.map(f => `- ${f.title}: ${f.detail || f.status}` + (f.questions && f.questions.length ? ` (Q${f.questions.join(', Q')})` : '')).join('\n') + (fixInstructions ? '\n\nReviewer instructions: ' + fixInstructions : ''),
      '### Previous worksheet\n' + JSON.stringify(worksheet).slice(0, 30000),
    ].join('\n\n');
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
    };
  }

  return {
    scale, SKILL_DEFINITIONS, FORMAT_SHAPES, contentAsText,
    buildTopicPrompt, buildContentPrompt, buildQuestionPrompt, buildReviewPrompt,
    buildContentRevisionPrompt, buildQuestionRevisionPrompt, buildVocabParsePrompt, buildAllPrompts,
  };
});
