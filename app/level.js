/*
 * LRMaster level — the difficulty meter.
 * Measures a listening script or reading text on the dimensions that make a
 * text easier or harder, places each dimension on the six-band scale used by
 * the app (A2.1 … B2.2) and combines them into an overall estimate. The
 * thresholds are calibrated on a podcast interview independently rated B1.2
 * (see tests) and on the Oxford CEFR word tags cross-tabulated with NGSL
 * frequency ranks. Pure functions; no network, no DOM.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./wordlist.js'));
  else { root.LR = root.LR || {}; root.LR.level = factory(root.LR.wordlist); }
})(typeof self !== 'undefined' ? self : this, function (wordlist) {
  'use strict';

  const BANDS = ['A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2'];

  /*
   * What the bands mean. The comprehension statements paraphrase the Council
   * of Europe's CEFR Companion Volume (2020) scales "Overall oral
   * comprehension" and "Overall reading comprehension" (A2 / A2+ / B1 / B1+ /
   * B2 / B2+ mapped to .1 / .2). The language features are the app's
   * operationalisation of those levels — what a text must look like so that a
   * learner at the level can do what the descriptor says.
   */
  const DESCRIPTORS = {
    'A2.1': {
      listening: 'Versteht Wendungen und Ausdrücke zu Bereichen von unmittelbarer Bedeutung (Person, Familie, Einkaufen, Schule), wenn langsam und deutlich gesprochen wird.',
      reading: 'Versteht kurze, einfache Texte zu vertrauten, konkreten Themen, die aus hochfrequenter Alltagssprache bestehen.',
      language: 'Sehr kurze, einfache Sätze (bis ≈ 7 Wörter), Präsens und einfaches Präteritum, Verknüpfung mit and/but, fast nur Grundwortschatz (≤ 4 % der Inhaltswörter jenseits der 2000 häufigsten), keine Nebensätze, kurze Beiträge (bis ≈ 13 Wörter), alles wird direkt gesagt.',
    },
    'A2.2': {
      listening: 'Versteht genug, um Bedürfnisse konkreter Art zu befriedigen, sofern deutlich und langsam gesprochen wird; folgt kurzen, klar gegliederten Gesprächen.',
      reading: 'Versteht kurze, einfache Texte mit dem häufigsten Wortschatz, einschliesslich international bekannter Wörter.',
      language: 'Kurze Sätze (≈ 7–9 Wörter) mit einfacher Koordination, going to/will, einfache Vergleiche, vereinzelte Nebensätze mit because/when, Wortschatz überwiegend aus den 2000 häufigsten Wörtern (≤ 7 % darüber), Beiträge von ≈ 13–20 Wörtern.',
    },
    'B1.1': {
      listening: 'Versteht die Hauptpunkte klarer Standardsprache über vertraute Dinge aus Schule, Freizeit und Alltag, einschliesslich kurzer Erzählungen.',
      reading: 'Liest unkomplizierte Sachtexte zu Themen aus dem eigenen Interessengebiet mit befriedigendem Verständnis.',
      language: 'Sätze von ≈ 9–10 Wörtern, regelmässig erste Nebensätze (when, if, because, that), Present Perfect, erster Konditional, ≤ 10 % der Inhaltswörter jenseits der 2000 häufigsten und nur einzelne seltene Wörter, Beiträge von ≈ 20–30 Wörtern.',
    },
    'B1.2': {
      listening: 'Versteht unkomplizierte Sachinformationen zu Alltags- und Schulthemen und erkennt dabei sowohl die Hauptaussage als auch Einzelheiten, wenn deutlich in vertrautem Akzent gesprochen wird.',
      reading: 'Versteht Texte mit klarer Argumentation, erkennt Hauptschlussfolgerungen und die Haltung des Autors zu vertrauten Themen.',
      language: 'Sätze von ≈ 10–12.5 Wörtern, Nebensätze und Relativsätze in jedem fünften Satz, hypothetisches would (zweiter Konditional), einige Phrasal Verbs und idiomatische Wendungen, ≈ 10–14 % der Inhaltswörter jenseits der 2000 häufigsten mit einzelnen B2-Wörtern, begründete Meinungen, Beiträge von ≈ 30–38 Wörtern.',
    },
    'B2.1': {
      listening: 'Versteht die Hauptaussagen inhaltlich und sprachlich komplexer Redebeiträge zu konkreten und abstrakten Themen in Standardsprache.',
      reading: 'Liest weitgehend selbstständig, passt Lesestil und -tempo an; breiter Lesewortschatz, Schwierigkeiten nur bei seltenen Idiomen.',
      language: 'Sätze von ≈ 12.5–17 Wörtern, eingebettete Nebensätze in jedem dritten Satz, Passiv, Spaltsätze (What makes it … is …), gemischte Konditionale, ≈ 14–20 % der Inhaltswörter jenseits der 2000 häufigsten und 3–6 % seltene Wörter, abstraktere Themen, Beiträge von ≈ 38–50 Wörtern.',
    },
    'B2.2': {
      listening: 'Versteht Standardsprache live oder in Aufnahmen zu vertrauten und unvertrauten Themen; nur starke Nebengeräusche, schlechte Gliederung oder viel Idiomatik behindern das Verständnis.',
      reading: 'Versteht lange, komplexe Texte auch mit impliziter Bedeutung, erkennt Standpunkte, Ironie und Nuancen.',
      language: 'Sätze über ≈ 17 Wörter, mehrfach eingebettete Strukturen in mehr als jedem zweiten Satz, Inversion, nuanciertes Abschwächen, breiter niederfrequenter Wortschatz (über 20 % jenseits der 2000 häufigsten), implizite Bedeutung, Beiträge über ≈ 50 Wörter.',
    },
  };

  /* ------------------------------------------------------------------ */
  /* Tokenisation and lemmatisation                                       */
  /* ------------------------------------------------------------------ */

  const NEGATIVE = { don: 'do', won: 'will', can: 'can', shan: 'shall', ain: 'be' };
  const CLITICS = new Set(['s', 't', 've', 'll', 'd', 're', 'm']);
  const FUNCTION_WORDS = new Set(('a an the this that these those my your his her its our their some any no every each ' +
    'i you he she it we they me him us them myself yourself himself herself itself ourselves themselves ' +
    'am is are was were be been being have has had having do does did doing ' +
    'will would shall should can could may might must ought ' +
    'and or but so nor yet because although though if unless when whenever while until since as than that which who whom whose where why how what ' +
    'of to in on at by for with from about into onto over under up down off out through between among around before after during without within ' +
    'not never always often sometimes usually really very too also just only even still already yet again ' +
    'there here then now here yes no oh ok okay well').split(/\s+/));

  const IRREGULAR = { made: 'make', took: 'take', taken: 'take', got: 'get', gotten: 'get', gave: 'give', given: 'give', went: 'go', gone: 'go', came: 'come', fell: 'fall', fallen: 'fall', kept: 'keep', stuck: 'stick', felt: 'feel', told: 'tell', bought: 'buy', brought: 'bring', thought: 'think', knew: 'know', known: 'know', saw: 'see', seen: 'see', said: 'say', ran: 'run', met: 'meet', found: 'find', lost: 'lose', left: 'leave', broke: 'break', broken: 'break', spoke: 'speak', spoken: 'speak', wrote: 'write', written: 'write', forgot: 'forget', forgotten: 'forget', caught: 'catch', taught: 'teach', stood: 'stand', sat: 'sit', won: 'win', held: 'hold', grew: 'grow', grown: 'grow', became: 'become', began: 'begin', begun: 'begin', chose: 'choose', chosen: 'choose', drove: 'drive', driven: 'drive', ate: 'eat', eaten: 'eat', flew: 'fly', flown: 'fly', hid: 'hide', hidden: 'hide', led: 'lead', lent: 'lend', meant: 'mean', paid: 'pay', rode: 'ride', ridden: 'ride', rang: 'ring', rung: 'ring', rose: 'rise', risen: 'rise', sold: 'sell', sent: 'send', shook: 'shake', shaken: 'shake', shown: 'show', sang: 'sing', sung: 'sing', slept: 'sleep', spent: 'spend', swam: 'swim', swum: 'swim', threw: 'throw', thrown: 'throw', understood: 'understand', woke: 'wake', woken: 'wake', wore: 'wear', worn: 'wear', did: 'do', done: 'do', had: 'have', has: 'have', was: 'be', were: 'be', been: 'be', is: 'be', are: 'be', am: 'be', dealt: 'deal', fought: 'fight', hung: 'hang', built: 'build', fed: 'feed', lit: 'light', shot: 'shoot', stole: 'steal', stolen: 'steal', tore: 'tear', torn: 'tear', bit: 'bite', bitten: 'bite', blew: 'blow', blown: 'blow', drew: 'draw', drawn: 'draw', drank: 'drink', drunk: 'drink', froze: 'freeze', frozen: 'freeze', lay: 'lie', lain: 'lie', swept: 'sweep', wound: 'wind', sought: 'seek', struck: 'strike', children: 'child', people: 'person', men: 'man', women: 'woman', feet: 'foot', teeth: 'tooth', mice: 'mouse', better: 'good', best: 'good', worse: 'bad', worst: 'bad', more: 'more', most: 'most', lives: 'life', leaves: 'leaf', wives: 'wife', knives: 'knife', halves: 'half', shelves: 'shelf' };
  const PAST_PARTICIPLES = new Set(Object.keys(IRREGULAR).filter(k => /(en|n|ne|ken|ten|wn|ught|ilt|ung|ung|unk|ong)$/.test(k) || ['made', 'got', 'gotten', 'kept', 'stuck', 'felt', 'told', 'bought', 'brought', 'thought', 'said', 'met', 'found', 'lost', 'left', 'held', 'led', 'lent', 'meant', 'paid', 'sold', 'sent', 'slept', 'spent', 'done', 'had', 'been', 'dealt', 'fought', 'hung', 'built', 'fed', 'lit', 'shot', 'swept', 'wound', 'sought', 'struck', 'put', 'cut', 'set', 'let', 'hit', 'hurt', 'read', 'become', 'come', 'run'].includes(k)));
  ['put', 'cut', 'set', 'let', 'hit', 'hurt', 'read', 'become', 'come', 'run'].forEach(w => PAST_PARTICIPLES.add(w));

  /** British spelling → the American lemma the word list uses. */
  const BRITISH = { colour: 'color', colours: 'color', favourite: 'favorite', favourites: 'favorite', humour: 'humor', behaviour: 'behavior', neighbour: 'neighbor', neighbours: 'neighbor', labour: 'labor', flavour: 'flavor', honour: 'honor', harbour: 'harbor', rumour: 'rumor', centre: 'center', theatre: 'theater', metre: 'meter', litre: 'liter', kilometre: 'kilometer', programme: 'program', programmes: 'program', catalogue: 'catalog', dialogue: 'dialog', grey: 'gray', tyre: 'tire', cheque: 'check', kerb: 'curb', storey: 'story', pyjamas: 'pajamas', jewellery: 'jewelry', aluminium: 'aluminum', mum: 'mom', mums: 'mom', practise: 'practice', practised: 'practice', practising: 'practice', licence: 'license', defence: 'defense', offence: 'offense', pretence: 'pretense', travelling: 'traveling', travelled: 'traveled', traveller: 'traveler', cancelled: 'canceled', modelling: 'modeling', counsellor: 'counselor', enrol: 'enroll', fulfil: 'fulfill', skilful: 'skillful', plough: 'plow', mould: 'mold', whilst: 'while', amongst: 'among', learnt: 'learn', dreamt: 'dream', spelt: 'spell', burnt: 'burn' };
  function americanize(w) {
    if (BRITISH[w]) return BRITISH[w];
    let x = w;
    x = x.replace(/iser$/, 'izer').replace(/isers$/, 'izers').replace(/isation$/, 'ization').replace(/isations$/, 'izations').replace(/ise$/, 'ize').replace(/ised$/, 'ized').replace(/ises$/, 'izes').replace(/ising$/, 'izing').replace(/yse$/, 'yze').replace(/ysed$/, 'yzed');
    x = x.replace(/our$/, 'or').replace(/ours$/, 'ors').replace(/oured$/, 'ored').replace(/ourite$/, 'orite');
    x = x.replace(/tre$/, 'ter').replace(/tres$/, 'ters');
    return x;
  }

  function derive(w, out) {
    const push = (x) => { if (x && x.length >= 2 && !out.includes(x)) out.push(x); };
    if (/ies$/.test(w)) push(w.replace(/ies$/, 'y'));
    if (/ied$/.test(w)) push(w.replace(/ied$/, 'y'));
    if (/(sh|ch|x|s|z|o)es$/.test(w)) push(w.replace(/es$/, ''));
    if (/es$/.test(w)) push(w.replace(/es$/, 'e'));
    if (/s$/.test(w) && !/ss$/.test(w)) push(w.replace(/s$/, ''));
    if (/ing$/.test(w)) { push(w.replace(/ing$/, '')); push(w.replace(/ing$/, 'e')); push(w.replace(/(\w)\1ing$/, '$1')); }
    if (/ed$/.test(w)) { push(w.replace(/ed$/, '')); push(w.replace(/d$/, '')); push(w.replace(/(\w)\1ed$/, '$1')); }
    if (/er$/.test(w)) { push(w.replace(/er$/, '')); push(w.replace(/r$/, '')); push(w.replace(/(\w)\1er$/, '$1')); push(w.replace(/ier$/, 'y')); }
    if (/est$/.test(w)) { push(w.replace(/est$/, '')); push(w.replace(/st$/, '')); push(w.replace(/(\w)\1est$/, '$1')); push(w.replace(/iest$/, 'y')); }
    if (/ly$/.test(w)) { push(w.replace(/ly$/, '')); push(w.replace(/ily$/, 'y')); push(w.replace(/ally$/, 'al')); }
    if (/ying$/.test(w)) push(w.replace(/ying$/, 'ie'));
    if (/ness$/.test(w)) { push(w.replace(/ness$/, '')); push(w.replace(/iness$/, 'y')); }
    return out;
  }
  function candidates(word) {
    const w = String(word).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const out = [w, americanize(w)];
    if (IRREGULAR[w]) out.push(IRREGULAR[w]);
    derive(w, out);
    // a second pass catches stacked suffixes such as "failings" → "failing" → "fail"
    for (const x of out.slice()) if (x !== w) derive(x, out);
    return out.map(americanize).concat(out);
  }

  /** Rank of a word in the frequency list (best rank over its candidate lemmas), or null. */
  function rankOf(word) {
    const ranks = wordlist.ranks();
    let best = null;
    for (const c of candidates(word)) {
      const r = ranks.get(c);
      if (r && (best === null || r < best)) best = r;
    }
    if (best === null) {
      // derived forms such as "unmotivated", "rewatch": the base word's rank, but never easier than the B2 band
      const m = word.toLowerCase().match(/^(un|re|dis|mis|over|non|pre)(\p{L}{4,})$/u);
      if (m) { const r = rankOf(m[2]); if (r !== null) best = Math.max(r, 2001); }
    }
    if (best === null && word.includes('-')) {
      // compound such as "seventeen-year-old": as hard as its hardest part
      const parts = word.split('-').filter(Boolean).map(rankOf);
      if (parts.length && parts.every(r => r !== null)) best = Math.max(...parts);
    }
    return best;
  }

  /** Frequency band of a rank: core (≤1000), b1 (≤2000), b2 (≤3500), c (beyond). */
  function rankBand(rank) {
    if (rank === null || rank === undefined) return 'c';
    if (rank <= 1000) return 'core';
    if (rank <= 2000) return 'b1';
    if (rank <= 3500) return 'b2';
    return 'c';
  }

  /**
   * Words as a teacher counts them — numbers included, stage directions not.
   * The whole app counts with this one function, so the difficulty meter and
   * the length rule never show two different numbers for the same text.
   */
  function countWords(text) {
    return String(text || '').replace(/\[[a-z]+\]/gi, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019-]*/gu) || [];
  }

  function tokenize(text) {
    const out = [];
    const re = /[\p{L}][\p{L}'\u2019-]*[\p{L}]|[\p{L}]/gu;
    let m;
    while ((m = re.exec(text))) {
      const raw = m[0].replace(/[\u2019]/g, "'");
      const parts = raw.split("'");
      let base = parts[0];
      if (!base) continue;
      if (parts[1] && parts[1].toLowerCase() === 't' && /n$/i.test(base)) base = NEGATIVE[base.toLowerCase()] || base.slice(0, -1);
      out.push({ word: base, index: m.index, raw });
      for (const clitic of parts.slice(1)) if (clitic && !CLITICS.has(clitic.toLowerCase())) out.push({ word: clitic, index: m.index, raw });
    }
    return out;
  }

  function sentences(text) {
    return String(text || '').replace(/\b(Mr|Mrs|Ms|Dr|St|e\.g|i\.e)\./g, '$1')
      .split(/(?<=[.!?\u2026])\s+(?=["\u201C'(]?[A-Z0-9])|\n+/)
      .map(s => s.trim()).filter(s => tokenize(s).length > 0);
  }

  /* ------------------------------------------------------------------ */
  /* Structures                                                           */
  /* ------------------------------------------------------------------ */

  const SUBORDINATORS = /\b(because|although|though|even though|whereas|while|whilst|if|unless|whenever|until|till|since|as soon as|so that|in order to|in case|wherever|which|who|whom|whose|as long as|provided that|despite|in spite of)\b/gi;
  const THAT_COMPLEMENT = /\b(think|thinks|thought|say|says|said|know|knows|knew|believe|believes|hope|hopes|feel|feels|felt|mean|means|meant|sure|clear|glad|obvious|realise|realize|realised|realized|notice|noticed|guess|imagine|suppose|suggest|suggests|show|shows|showed|explain|explained|remember|forget|agree|agreed|decided|decide|worried|afraid|true|possible|likely)\s+that\b/gi;
  const RELATIVE_WHERE = /\b(place|room|town|city|school|house|series|country|world|somewhere|anywhere|situation|point|moment|day|time)\s+where\b/gi;
  const PASSIVE = /\b(am|is|are|was|were|be|been|being|get|got|gets)\s+(\w+ly\s+)?(?:not\s+)?(?!used\s+to)(\w+ed|\w+en|\w+own|\w+ught|\w+ilt|\w+elt|made|put|set|left|held|told|sold|sent|paid|found|lost|kept|built|cut|hit|hurt|read|meant|shown|done|gone|seen|known|taken|given)\b/gi;
  const PERFECT = /\b(have|has|had|'ve|'d)\s+(?:not\s+|never\s+|already\s+|just\s+|always\s+|recently\s+|ever\s+)?(\w+ed|\w+en|\w+own|\w+ught|\w+ilt|\w+elt|made|put|set|left|held|told|sold|sent|paid|found|lost|kept|built|cut|hit|hurt|read|meant|shown|done|gone|seen|known|taken|given|been|had|got|gotten|met|run|come|become|begun|written|spoken|broken|chosen|driven|eaten|fallen|forgotten|grown|hidden|ridden|risen|shaken|sung|slept|spent|swum|thrown|understood|woken|worn)\b/gi;
  const MODAL_HYPOTHETICAL = /\b(would|could|might|should)\b/gi;
  const CONDITIONAL_IF = /\bif\b/gi;
  const CLEFT = /\b(what|all)\s+(i|we|you|they|he|she|it|makes|made|matters|mattered|happened|happens|counts|surprised|surprises|worries|worried)\b[^.!?]{0,40}\b(is|was|are|were)\b|\bit\s+(is|was|'s)\s+[^.!?]{1,40}\b(that|who|which)\b/gi;
  const COMPARATIVE = /\b(more|less)\s+\w+(\s+\w+)?\s+than\b|\b\w+er\s+than\b|\bas\s+\w+\s+as\b|\b(compared|comparison)\s+(with|to)\b|\bthe\s+(more|less|\w+er)\b[^.!?]{2,40},\s*the\s+(more|less|\w+er)\b/gi;
  const INVERSION = /\b(not only|rarely|seldom|hardly|no sooner|never before|little did|only then|only when)\b/gi;
  const PHRASAL_VERBS = /\b(get|gets|got|getting|take|takes|took|taking|put|puts|putting|come|comes|came|coming|go|goes|went|going|look|looks|looked|looking|give|gives|gave|giving|make|makes|made|making|bring|brings|brought|turn|turns|turned|pick|picks|picked|set|sets|run|runs|ran|keep|keeps|kept|hold|holds|held|break|breaks|broke|carry|carries|carried|work|works|worked|end|ends|ended|hang|hangs|hung|show|shows|showed|throw|throws|threw|let|lets|cut|cuts|fall|falls|fell|find|finds|found|pass|passes|passed|sort|sorts|sorted|stick|sticks|stuck|figure|figured|catch|caught|hand|hands|handed|log|logged|sign|signed|calm|calmed|wake|woke|grow|grew|check|checked)\s+(\w+\s+)?(up|out|on|off|in|into|over|back|away|down|through|along|around|about|forward|after|across|ahead|apart|aside|behind|by|together)\b/gi;
  const IDIOMS = /\b(part of the fun|easy to get into|just one more|two in the morning|at the end of the day|a piece of cake|keep an eye on|in the long run|on the same page|hit the road|under the weather|out of the blue|over the moon|the last straw|a big deal|no big deal|the thing is|in a nutshell|to be honest|to be fair|as a matter of fact|make up your mind|change your mind|on second thoughts|for a change|in the end|so far so good|it turns out|as far as i know|at first glance|by the way|in other words|once in a while|from time to time|the point is|give it a try|get the hang of|make sense|take it easy|sooner or later|on the one hand|on the other hand|in the meantime|lost track of|can't help)\b/gi;
  const FILLERS = /\b(well|actually|you know|i mean|sort of|kind of|like|basically|honestly|anyway|right|so|um|uh|er|hmm)\b(?=[,.\u2026!?]|\s)/gi;

  function count(re, text) { const m = String(text).match(re); return m ? m.length : 0; }
  function examples(re, text, n) { const m = String(text).match(re); return m ? [...new Set(m.map(x => x.trim()))].slice(0, n || 3) : []; }

  /* ------------------------------------------------------------------ */
  /* Thresholds: value ≤ thresholds[i] → band i (A2.1 … B2.1), else B2.2   */
  /* ------------------------------------------------------------------ */

  const DIMENSIONS = [
    { key: 'sentence', label: 'Satzlänge', unit: 'Wörter/Satz', weight: 0.2, thresholds: [7, 9, 10, 12.5, 17],
      explain: 'Mittlere Satzlänge; längere Sätze verlangen mehr Verarbeitung im Arbeitsgedächtnis.' },
    { key: 'lexB2', label: 'Wortschatz jenseits 2000', unit: '% der Inhaltswörter', weight: 0.2, thresholds: [4, 7, 10, 14, 20],
      explain: 'Anteil der Inhaltswörter ausserhalb der 2000 häufigsten Lemmata (NGSL-Rang); entspricht ungefähr B2- und C-Wortschatz.' },
    { key: 'lexC', label: 'Seltener Wortschatz', unit: '% der Inhaltswörter', weight: 0.1, thresholds: [0.6, 1.2, 1.8, 3, 6],
      explain: 'Anteil der Inhaltswörter ausserhalb der 3500 häufigsten Lemmata oder ganz ausserhalb der Liste.' },
    { key: 'subordination', label: 'Nebensätze', unit: 'pro Satz', weight: 0.15, thresholds: [0.05, 0.12, 0.18, 0.32, 0.55],
      explain: 'Subordinatoren, Relativpronomen und that-Komplementsätze pro Satz.' },
    { key: 'grammar', label: 'Anspruchsvolle Grammatik', unit: 'pro 100 Wörter', weight: 0.15, thresholds: [0.5, 1.2, 2.1, 3.2, 4.5],
      explain: 'Passiv, Perfekt, hypothetisches would/could/might, Konditionale, Spaltsätze, Vergleichskonstruktionen, Inversion.' },
    { key: 'idiom', label: 'Phrasal Verbs & Idiome', unit: 'pro 100 Wörter', weight: 0.05, thresholds: [0.2, 0.5, 0.9, 1.9, 3],
      explain: 'Verb-Partikel-Verbindungen und feste idiomatische Wendungen (eher Register als Niveau, deshalb gering gewichtet).' },
    { key: 'turn', label: 'Beitragslänge', unit: 'Wörter/Beitrag', weight: 0.15, listeningOnly: true, thresholds: [13, 20, 30, 38, 50],
      explain: 'Mittlere Länge der Sprecherbeiträge; lange Beiträge ohne Wechsel sind beim Hören schwerer zu halten.' },
  ];

  function bandIndex(value, thresholds) {
    for (let i = 0; i < thresholds.length; i++) if (value <= thresholds[i]) return i;
    return thresholds.length;
  }
  /** Fractional position on the 0–5 scale (interpolated between thresholds). */
  function bandScore(value, thresholds) {
    const t = thresholds;
    if (value <= t[0]) return Math.max(0, 0.5 * value / t[0]);
    for (let i = 1; i < t.length; i++) {
      if (value <= t[i]) return i - 0.5 + (value - t[i - 1]) / (t[i] - t[i - 1]);
    }
    const last = t[t.length - 1], prev = t[t.length - 2];
    return Math.min(5.5, t.length - 0.5 + (value - last) / (last - prev));
  }

  /* ------------------------------------------------------------------ */
  /* Measurement                                                          */
  /* ------------------------------------------------------------------ */

  /** Stage directions such as "[laughs]" or "(pause)" are not spoken and never count. */
  function stripDirections(text) {
    return String(text || '').replace(/\[[^\]\n]{1,40}\]/g, ' ').replace(/\((?:laughs?|laughing|pause|pauses|sighs?|chuckles?|coughs?|silence|beat)[^)\n]{0,30}\)/gi, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  }
  function plainText(content, kind) {
    if (kind === 'listening') return (content.lines || []).map(l => stripDirections(l.text)).join('\n');
    return (content.paragraphs || []).map(stripDirections).join('\n');
  }

  /**
   * Measure a material. `content` is {lines:[{speaker,text}]} for listening or
   * {paragraphs:[…]} for reading; `opts.seconds` (audio length) enables the
   * words-per-minute figure, `opts.exclude` lists target vocabulary that must
   * not count as hard words.
   */
  function measure(content, kind, opts) {
    opts = opts || {};
    kind = kind === 'listening' ? 'listening' : 'reading';
    const text = plainText(content, kind);
    const sents = sentences(text);
    const toks = tokenize(text);
    const totalWords = countWords(text).length;
    const sentLengths = sents.map(s => tokenize(s).length);
    const msl = sentLengths.length ? sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length : 0;

    // Lexical profile over content words (function words, clitics, numbers and proper nouns excluded).
    const sentenceStarts = new Set();
    let pos = 0;
    for (const s of sents) { const i = text.indexOf(s, pos); if (i >= 0) { sentenceStarts.add(i); pos = i + s.length; } }
    const exclude = new Set((opts.exclude || []).flatMap(w => String(typeof w === 'string' ? w : w.word).toLowerCase().split(/\s+/)));
    // Proper nouns: capitalised words that are not sentence-initial and unknown or rare in the list,
    // plus speaker names; a name that also opens a sentence is then recognised there too.
    const proper = new Set();
    for (const l of (content.lines || [])) String(l.speaker || '').split(/\s+/).forEach(w => { if (w) proper.add(w.toLowerCase()); });
    for (const t of toks) {
      const midSentence = /^\p{Lu}/u.test(t.word) && !sentenceStarts.has(t.index) && !/^i$/i.test(t.word) && text[t.index - 1] !== '"' && text[t.index - 1] !== '“';
      if (midSentence) { const r = rankOf(t.word); if (r === null || r > 3000) proper.add(t.word.toLowerCase()); }
    }
    const lexical = [];
    const hardMap = new Map();
    for (const t of toks) {
      const lower = t.word.toLowerCase();
      if (lower.length < 2 && lower !== 'a' && lower !== 'i') continue;
      if (FUNCTION_WORDS.has(lower)) continue;
      if (proper.has(lower) && /^\p{Lu}/u.test(t.word)) continue;
      const rank = rankOf(t.word);
      const band = rankBand(rank);
      lexical.push({ word: lower, rank, band });
      if ((band === 'b2' || band === 'c') && !exclude.has(lower) && !exclude.has(lemmaOf(t.word))) {
        const key = lemmaOf(t.word);
        const e = hardMap.get(key) || { lemma: key, word: t.word, rank, band, count: 0 };
        e.count += 1;
        hardMap.set(key, e);
      }
    }
    const lexN = Math.max(1, lexical.length);
    const beyond2000 = lexical.filter(x => x.band === 'b2' || x.band === 'c').length / lexN * 100;
    const beyond3500 = lexical.filter(x => x.band === 'c').length / lexN * 100;
    const hardWords = [...hardMap.values()].sort((a, b) => (b.rank || 99999) - (a.rank || 99999));

    const per100 = (n) => totalWords ? n / totalWords * 100 : 0;
    const structures = [
      { key: 'subordinators', label: 'Nebensatz-Einleitungen', count: count(SUBORDINATORS, text) + count(THAT_COMPLEMENT, text) + count(RELATIVE_WHERE, text), examples: examples(SUBORDINATORS, text) },
      { key: 'passive', label: 'Passiv', count: count(PASSIVE, text), examples: examples(PASSIVE, text) },
      { key: 'perfect', label: 'Perfekt', count: count(PERFECT, text), examples: examples(PERFECT, text) },
      { key: 'hypothetical', label: 'would / could / might / should', count: count(MODAL_HYPOTHETICAL, text), examples: examples(MODAL_HYPOTHETICAL, text) },
      { key: 'conditional', label: 'if-Sätze', count: count(CONDITIONAL_IF, text), examples: examples(/\bif\b[^.!?]{0,50}/gi, text) },
      { key: 'cleft', label: 'Spaltsätze', count: count(CLEFT, text), examples: examples(CLEFT, text) },
      { key: 'comparative', label: 'Vergleichskonstruktionen', count: count(COMPARATIVE, text), examples: examples(COMPARATIVE, text) },
      { key: 'inversion', label: 'Inversion / Emphase', count: count(INVERSION, text), examples: examples(INVERSION, text) },
      { key: 'phrasal', label: 'Phrasal Verbs', count: count(PHRASAL_VERBS, text), examples: examples(PHRASAL_VERBS, text) },
      { key: 'idioms', label: 'Idiome', count: count(IDIOMS, text), examples: examples(IDIOMS, text) },
      { key: 'fillers', label: 'Füllwörter / Diskursmarker', count: count(FILLERS, text), examples: examples(FILLERS, text) },
    ];
    const S = Object.fromEntries(structures.map(s => [s.key, s.count]));
    const subordination = sents.length ? S.subordinators / sents.length : 0;
    const grammar = per100(S.passive + S.perfect + S.conditional + S.cleft * 2 + S.comparative + S.inversion * 2 + Math.round(S.hypothetical / 2));
    const idiom = per100(S.phrasal + S.idioms * 1.5);

    let turns = 0, meanTurn = 0;
    if (kind === 'listening') {
      const lens = (content.lines || []).map(l => tokenize(stripDirections(l.text)).length);
      turns = lens.length;
      meanTurn = turns ? lens.reduce((a, b) => a + b, 0) / turns : 0;
    }
    const values = { sentence: msl, lexB2: beyond2000, lexC: beyond3500, subordination, grammar, idiom, turn: meanTurn };

    const dims = DIMENSIONS.filter(d => !d.listeningOnly || kind === 'listening').map(d => {
      const value = values[d.key];
      return { key: d.key, label: d.label, unit: d.unit, explain: d.explain, weight: d.weight, value: Math.round(value * 100) / 100,
        index: bandIndex(value, d.thresholds), score: bandScore(value, d.thresholds), band: BANDS[bandIndex(value, d.thresholds)], thresholds: d.thresholds };
    });
    const wsum = dims.reduce((a, d) => a + d.weight, 0);
    const score = dims.reduce((a, d) => a + d.weight * d.score, 0) / wsum;
    const index = Math.max(0, Math.min(5, Math.round(score)));
    const spread = Math.sqrt(dims.reduce((a, d) => a + d.weight * Math.pow(d.score - score, 2), 0) / wsum);
    const confidence = totalWords < 80 ? 'low' : spread > 1.6 ? 'low' : spread > 1.0 ? 'medium' : 'high';

    return {
      band: BANDS[index], index, score: Math.round(score * 100) / 100, confidence, kind,
      dimensions: dims, structures, hardWords,
      stats: { words: totalWords, lexicalWords: lexical.length, sentences: sents.length, msl: Math.round(msl * 10) / 10, longest: Math.max(0, ...sentLengths), turns, meanTurn: Math.round(meanTurn * 10) / 10,
        wpm: opts.seconds ? Math.round(totalWords / (opts.seconds / 60)) : null },
    };
  }

  function lemmaOf(word) {
    const ranks = wordlist.ranks();
    let best = null, bestRank = Infinity;
    for (const c of candidates(word)) { const r = ranks.get(c); if (r && r < bestRank) { best = c; bestRank = r; } }
    return best || word.toLowerCase();
  }

  /* ------------------------------------------------------------------ */
  /* Targets and comparison                                               */
  /* ------------------------------------------------------------------ */

  /** Numeric targets for a band, phrased for the writer and used by the checks. */
  function targetsFor(band) {
    const i = Math.max(0, BANDS.indexOf(band));
    const range = (d) => {
      const t = d.thresholds;
      const lo = i === 0 ? 0 : t[i - 1];
      const hi = i < t.length ? t[i] : t[t.length - 1] * 1.3;
      return [Math.round(lo * 10) / 10, Math.round(hi * 10) / 10];
    };
    const out = {};
    for (const d of DIMENSIONS) out[d.key] = range(d);
    return out;
  }

  /** Compare a measurement with the target band; returns status and concrete deviations. */
  function compare(measured, targetBand) {
    const target = BANDS.indexOf(targetBand);
    const delta = measured.index - target;
    const deviations = [];
    for (const d of measured.dimensions) {
      const diff = d.index - target;
      if (Math.abs(diff) >= 1) {
        deviations.push({
          key: d.key, label: d.label, value: d.value, unit: d.unit, band: d.band, direction: diff > 0 ? 'above' : 'below', steps: diff,
          suggestion: suggestionFor(d.key, diff, measured, targetBand),
        });
      }
    }
    const status = Math.abs(delta) >= 2 ? 'fail' : Math.abs(delta) === 1 ? 'warn' : 'pass';
    return { target: targetBand, measured: measured.band, delta, status, deviations, score: measured.score, targetIndex: target };
  }

  function suggestionFor(key, diff, measured, targetBand) {
    const t = targetsFor(targetBand);
    const up = diff > 0;
    switch (key) {
      case 'sentence': return up ? `Sätze kürzen: Ziel ${t.sentence[0]}–${t.sentence[1]} Wörter pro Satz, lange Sätze in zwei teilen.` : `Sätze verbinden: Ziel ${t.sentence[0]}–${t.sentence[1]} Wörter pro Satz, Nebensätze statt Aneinanderreihung.`;
      case 'lexB2': return up ? `Schwere Wörter ersetzen (${measured.hardWords.slice(0, 8).map(h => h.word).join(', ')}): höchstens ${t.lexB2[1]} % der Inhaltswörter jenseits der 2000 häufigsten.` : `Anspruchsvolleren Wortschatz einstreuen: ${t.lexB2[0]}–${t.lexB2[1]} % der Inhaltswörter dürfen jenseits der 2000 häufigsten liegen.`;
      case 'lexC': return up ? `Seltene Wörter vermeiden (${measured.hardWords.filter(h => h.band === 'c').slice(0, 6).map(h => h.word).join(', ')}): höchstens ${t.lexC[1]} %.` : 'Einzelne seltenere, aber erschliessbare Wörter sind erlaubt.';
      case 'subordination': return up ? `Weniger Nebensätze: höchstens ${t.subordination[1]} pro Satz.` : `Mehr Nebensätze (because, when, which, if, although): ${t.subordination[0]}–${t.subordination[1]} pro Satz.`;
      case 'grammar': return up ? 'Passiv, Perfekt, Konditionale und Spaltsätze reduzieren; direkte Aussagesätze.' : 'Anspruchsvollere Strukturen einbauen: Present Perfect, Konditionale, Passiv, Vergleiche, Spaltsätze.';
      case 'idiom': return up ? 'Phrasal Verbs und Idiome durch wörtliche Ausdrücke ersetzen.' : 'Einige Phrasal Verbs und idiomatische Wendungen einstreuen.';
      case 'turn': return up ? `Beiträge kürzen: im Mittel ${t.turn[0]}–${t.turn[1]} Wörter, häufigere Sprecherwechsel.` : `Beiträge verlängern: im Mittel ${t.turn[0]}–${t.turn[1]} Wörter.`;
      default: return '';
    }
  }

  /** Hard words above the target band, for a glossary; target vocabulary is excluded by measure(). */
  function glossaryCandidates(measured, targetBand, max) {
    const target = BANDS.indexOf(targetBand);
    const wanted = target >= 4 ? ['c'] : ['b2', 'c'];
    return measured.hardWords.filter(h => wanted.includes(h.band)).slice(0, max || 12);
  }

  /**
   * The highest frequency rank a word may have so that a learner at the band
   * can be expected to know it (derived from the lexB2/lexC thresholds).
   */
  function maxRankFor(band) {
    return { 'A2.1': 1200, 'A2.2': 1600, 'B1.1': 2000, 'B1.2': 2800, 'B2.1': 3500, 'B2.2': 5000 }[band] || 2800;
  }

  /** Words of a text that are above what the band can be expected to know. */
  function hardWordsFor(text, band, exclude) {
    const limit = maxRankFor(band);
    const skip = new Set((exclude || []).flatMap(w => String(typeof w === 'string' ? w : w.word).toLowerCase().split(/\s+/)));
    const out = new Map();
    const stripped = stripDirections(text);
    for (const t of tokenize(stripped)) {
      const lower = t.word.toLowerCase();
      if (FUNCTION_WORDS.has(lower) || skip.has(lower)) continue;
      if (/^\p{Lu}/u.test(t.word) && t.index > 0) continue; // names and sentence starts are not the point here
      const rank = rankOf(t.word);
      const lemma = lemmaOf(t.word);
      if (skip.has(lemma)) continue;
      if (rank === null || rank > limit) out.set(lemma, { lemma, word: t.word, rank, count: (out.get(lemma) || { count: 0 }).count + 1 });
    }
    return [...out.values()].sort((a, b) => (b.rank || 99999) - (a.rank || 99999));
  }

  /** Text lines for a prompt: numeric targets of a band. */
  function targetLines(band, kind) {
    const t = targetsFor(band);
    const lines = [
      `average sentence length ${t.sentence[0]}–${t.sentence[1]} words`,
      `at most ${t.lexB2[1]} % of the content words outside the 2000 most frequent English words, and at most ${t.lexC[1]} % rare words (outside the 3500 most frequent)`,
      `${t.subordination[0]}–${t.subordination[1]} subordinate or relative clauses per sentence`,
      `advanced structures (passive, perfect, conditionals, cleft sentences, comparisons) about ${t.grammar[0]}–${t.grammar[1]} per 100 words`,
      `phrasal verbs and idioms about ${t.idiom[0]}–${t.idiom[1]} per 100 words`,
    ];
    if (kind === 'listening') lines.push(`speaker turns of ${t.turn[0]}–${t.turn[1]} words on average`);
    return lines;
  }

  /* ------------------------------------------------------------------ */
  /* The dials: where inside the level a text should sit                  */
  /* ------------------------------------------------------------------ */

  /*
   * The CEFR level fixes the range a text may use. The dials (vocabulary,
   * grammar, language complexity, idioms) do not move that range — they
   * choose a place INSIDE it: 0 the easiest end of the level, 100 the most
   * demanding end, never above it. Which words or structures the text uses
   * is free; the dials only say how common or how complex they are.
   * Each dial is tied to what the meter measures, so the place is a number.
   */
  const DIALS = {
    vocabularyDifficulty: { dims: ['lexB2', 'lexC'], label: 'Wortschatz', en: 'vocabulary' },
    grammarComplexity: { dims: ['subordination', 'grammar'], label: 'Grammatik', en: 'grammar' },
    languageComplexity: { dims: ['sentence'], label: 'Sprachliche Komplexität', en: 'sentence length' },
    idiomaticLanguage: { dims: ['idiom'], label: 'Idiomatik', en: 'idioms and phrasal verbs' },
  };
  const DIAL_KEYS = Object.keys(DIALS);
  const WHERE = ['the easiest end', 'the easier half', 'the middle', 'the more demanding half', 'the most demanding end'];
  const WHERE_DE = ['am leichten Ende', 'in der leichteren Hälfte', 'in der Mitte', 'in der anspruchsvolleren Hälfte', 'am anspruchsvollen Ende'];

  /** Rounded to what the scale can tell apart: 0.12 stays 0.12, 9.34 becomes 9.3. */
  const roundFor = (span) => (v) => { const k = span < 0.1 ? 1000 : span < 1 ? 100 : 10; return Math.round(v * k) / k; };

  /** The level's own range of one measure, unrounded. */
  function rawRange(dimKey, band) {
    const d = DIMENSIONS.find(x => x.key === dimKey);
    const i = Math.max(0, BANDS.indexOf(band));
    const t = d.thresholds;
    // the lowest level has no lower threshold; a real A2.1 text still has
    // sentences of five words, not of none
    return [i === 0 ? t[0] * 0.55 : t[i - 1], i < t.length ? t[i] : t[t.length - 1] * 1.3];
  }

  /** The part of the level's range one dial position aims at (always inside it). */
  function dialAim(range, dial) {
    const [lo, hi] = range;
    const span = Math.max(0, hi - lo);
    const r = roundFor(span);
    const d = Math.max(0, Math.min(100, Number(dial)));
    const centre = lo + span * (0.15 + 0.7 * (Number.isFinite(d) ? d : 50) / 100);
    const half = span * 0.18;
    return [r(Math.max(lo, centre - half)), r(Math.min(hi, centre + half))];
  }

  function whereIndex(dial) { return Math.min(4, Math.floor(Math.max(0, Math.min(100, Number(dial) || 0)) / 20)); }

  /**
   * For every dial: where inside the level it points, and the measured
   * values that correspond to it — what the prompt asks for and what the
   * check compares with.
   */
  function dialTargets(band, state, kind) {
    const out = [];
    for (const key of DIAL_KEYS) {
      const value = state && Number.isFinite(Number(state[key])) ? Number(state[key]) : 50;
      const dims = DIALS[key].dims.map(k => {
        const def = DIMENSIONS.find(d => d.key === k);
        const range = rawRange(k, band);
        const r = roundFor(range[1] - range[0]);
        return { key: k, label: def.label, unit: def.unit, range: range.map(r), aim: dialAim(range, value) };
      }).filter(d => kind === 'listening' || !(DIMENSIONS.find(x => x.key === d.key) || {}).listeningOnly);
      out.push({ key, value, label: DIALS[key].label, en: DIALS[key].en, where: WHERE[whereIndex(value)], whereDe: WHERE_DE[whereIndex(value)], dims });
    }
    return out;
  }

  /**
   * How a measured text sits against the dials. A value counts as on target
   * when it lies in the aim or within one aim-width of it — short texts are
   * noisy, a miss by a hair is not a miss. Rare words and idioms are only
   * judged in texts long enough to count them.
   */
  function dialCheck(measured, band, state, kind) {
    const words = (measured && measured.stats && measured.stats.words) || 0;
    const res = [];
    for (const dial of dialTargets(band, state, kind)) {
      for (const d of dial.dims) {
        const m = (measured.dimensions || []).find(x => x.key === d.key);
        if (!m) continue;
        if ((d.key === 'lexC' || d.key === 'idiom') && words < 250) continue;
        const width = Math.max((d.range[1] - d.range[0]) * 0.1, d.aim[1] - d.aim[0]);
        const off = m.value < d.aim[0] - width ? 'below' : m.value > d.aim[1] + width ? 'above' : '';
        res.push({ dial: dial.key, dialLabel: dial.label, dialValue: dial.value, key: d.key, label: d.label, unit: d.unit, value: m.value, aim: d.aim, range: d.range, off });
      }
    }
    return res;
  }

  return { DIALS, DIAL_KEYS, dialAim, dialTargets, dialCheck,
    BANDS, DESCRIPTORS, DIMENSIONS, measure, compare, targetsFor, targetLines, glossaryCandidates, rankOf, rankBand, lemmaOf, tokenize, sentences, candidates, americanize, maxRankFor, hardWordsFor, stripDirections, countWords };
});
