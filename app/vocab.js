/*
 * LRMaster vocabulary import — parses CSV/TSV/plain-text vocabulary files and
 * spreadsheet rows into textbook units. Pure functions.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LR = root.LR || {}; root.LR.vocab = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const UNIT_HEADING = /^\s*(unit|einheit|lektion|lesson|chapter|kapitel|module|topic)\s*([0-9]+[a-z]?)?\s*[:\-–—.]?\s*(.*)$/i;
  /** A line or cell only counts as vocabulary if it carries a letter or digit. */
  const HAS_WORD = /[0-9A-Za-z\u00C0-\u00FF\u0100-\u024F\u0370-\uFFFF]/;

  function detectDelimiter(lines) {
    const candidates = ['\t', ';', ',', '|'];
    let best = null, bestScore = 0;
    for (const d of candidates) {
      const counts = lines.filter(l => HAS_WORD.test(l) && !UNIT_HEADING.test(l.trim())).map(l => l.split(d).length - 1);
      const withDelim = counts.filter(c => c > 0).length;
      const score = withDelim / Math.max(1, counts.length);
      if (score > bestScore) { bestScore = score; best = d; }
    }
    if (bestScore < 0.5) {
      // Fall back to " - " / " – " separators typical for word lists.
      const dashRows = lines.filter(l => / [-–—] /.test(l)).length;
      if (dashRows / Math.max(1, lines.filter(l => HAS_WORD.test(l) && !UNIT_HEADING.test(l.trim())).length) >= 0.5) return 'dash';
      return null;
    }
    return best;
  }

  function splitRow(line, delimiter) {
    if (delimiter === 'dash') {
      const m = line.split(/ [-–—] /);
      return m.map(s => s.trim());
    }
    if (delimiter === ',' || delimiter === ';') {
      // Minimal CSV: respect double quotes.
      const out = []; let cur = ''; let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === delimiter && !q) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map(s => s.trim());
    }
    return line.split(delimiter).map(s => s.trim());
  }

  const HEADER_WORDS = {
    word: ['word', 'wort', 'vocabulary', 'vokabel', 'item', 'english', 'englisch', 'term', 'phrase', 'expression'],
    translation: ['translation', 'übersetzung', 'uebersetzung', 'german', 'deutsch', 'meaning', 'bedeutung', 'de'],
    unit: ['unit', 'einheit', 'lektion', 'lesson', 'chapter', 'kapitel', 'module'],
    note: ['note', 'notes', 'example', 'beispiel', 'sentence', 'satz', 'context', 'kontext', 'pos', 'part of speech', 'wortart', 'collocation', 'hinweis'],
    topic: ['topic', 'thema', 'theme'],
  };

  function detectHeader(cells) {
    const map = {};
    let hits = 0;
    cells.forEach((c, i) => {
      const k = String(c || '').trim().toLowerCase();
      for (const field of Object.keys(HEADER_WORDS)) {
        if (HEADER_WORDS[field].includes(k) && !(field in map)) { map[field] = i; hits++; return; }
      }
    });
    return hits >= 1 && ('word' in map || 'translation' in map) ? map : null;
  }

  /**
   * Parse rows (array of arrays) into units. Supports a column layout with a
   * header row, rows that are unit headings ("Unit 3: Movies"), and 2-column
   * word/translation lists.
   */
  function parseRows(rows, opts) {
    opts = opts || {};
    const warnings = [];
    const units = [];
    let current = null;
    const ensureUnit = (name, topic) => {
      const key = (name || opts.defaultUnit || 'Unit 1').trim();
      let u = units.find(x => x.name === key);
      if (!u) { u = { name: key, topic: topic || '', words: [] }; units.push(u); }
      if (topic && !u.topic) u.topic = topic;
      return u;
    };
    let colMap = null;
    let seenData = false;
    for (const raw of rows) {
      const cells = (raw || []).map(c => (c === null || c === undefined) ? '' : String(c).trim());
      if (cells.every(c => !c)) continue;
      // only the very first row can be the header: otherwise a line like
      // "a word,Wort" in the middle of the list would be swallowed as one
      if (!colMap && !seenData) {
        const hdr = detectHeader(cells);
        if (hdr) { colMap = hdr; seenData = true; continue; }
      }
      seenData = true;
      const nonEmpty = cells.filter(Boolean);
      // A unit heading row: a single cell (or first cell with rest empty) matching "Unit n …".
      if (nonEmpty.length === 1 || (cells[0] && cells.slice(1).every(c => !c))) {
        const m = UNIT_HEADING.exec(nonEmpty[0]);
        if (m) {
          const num = m[2] ? ' ' + m[2] : '';
          const label = (m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()) + num;
          current = ensureUnit(label + (m[3] && !num ? ' ' + m[3] : ''), m[3] ? m[3].trim() : '');
          if (num && m[3]) current.topic = current.topic || m[3].trim();
          continue;
        }
        if (nonEmpty.length === 1 && !colMap) {
          // Bare word without translation — but not a row of separators.
          if (!HAS_WORD.test(nonEmpty[0])) { warnings.push('Zeile ohne Wort übersprungen: ' + nonEmpty[0]); continue; }
          (current || (current = ensureUnit())).words.push({ word: nonEmpty[0], translation: '', note: '' });
          continue;
        }
      }
      let entry;
      if (colMap) {
        entry = {
          word: colMap.word !== undefined ? cells[colMap.word] : cells[0],
          translation: colMap.translation !== undefined ? cells[colMap.translation] : '',
          note: colMap.note !== undefined ? cells[colMap.note] : '',
        };
        const unitName = colMap.unit !== undefined ? cells[colMap.unit] : '';
        const topic = colMap.topic !== undefined ? cells[colMap.topic] : '';
        if (unitName) {
          const m = UNIT_HEADING.exec(unitName);
          const name = m && m[2] ? `Unit ${m[2]}` : (/^\d+[a-z]?$/.test(unitName) ? `Unit ${unitName}` : unitName);
          current = ensureUnit(name, topic || (m && m[3] ? m[3].trim() : ''));
        } else if (!current) current = ensureUnit(undefined, topic);
        else if (topic && !current.topic) current.topic = topic;
      } else {
        entry = { word: cells[0], translation: cells[1] || '', note: cells.slice(2).filter(Boolean).join(' · ') };
        if (!current) current = ensureUnit();
      }
      if (!entry.word) { warnings.push('Zeile ohne Vokabel übersprungen: ' + cells.join(' | ')); continue; }
      // separator leftovers like "---" or ";;;" are not vocabulary
      if (!HAS_WORD.test(entry.word)) { warnings.push('Zeile ohne Wort übersprungen: ' + cells.join(' | ')); continue; }
      current.words.push(entry);
    }
    // Deduplicate within a unit.
    for (const u of units) {
      const seen = new Set();
      u.words = u.words.filter(w => { const k = w.word.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    }
    return { units, warnings };
  }

  /** Parse pasted or uploaded text (CSV, TSV, "word - translation" lists, headed lists). */
  function parseText(text, opts) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const delimiter = detectDelimiter(lines);
    const rows = lines.map(l => (delimiter ? splitRow(l, delimiter) : [l.trim()]));
    const result = parseRows(rows, opts);
    result.delimiter = delimiter;
    return result;
  }

  /** Convert Claude's parsed rows ({unit, word, translation, note}) into units. */
  function fromParsedRows(rows, opts) {
    const table = [['unit', 'word', 'translation', 'note']];
    for (const r of rows || []) table.push([r.unit || '', r.word || '', r.translation || '', r.note || '']);
    return parseRows(table, opts);
  }

  /** All words of the parsed units, in order. */
  function allWords(units) {
    const out = [];
    for (const u of units || []) for (const w of u.words) out.push(w);
    return out;
  }

  /** Put every word into one unit (used for "everything in a single new unit"). */
  function flattenUnits(units, name, topic) {
    return [{ name: (name || 'Unit 1').trim(), topic: (topic || '').trim(), words: allWords(units) }];
  }

  /**
   * Regroup the words by the ranges Claude returned. Ranges are sorted, clamped
   * and closed so that no word is lost: a gap extends the previous group, and
   * anything after the last group is appended to it.
   */
  function applyGroups(units, groups) {
    const words = allWords(units);
    if (!words.length) return { units: [], warnings: ['Keine Einträge zum Gruppieren.'] };
    const warnings = [];
    const ranges = (groups || [])
      .map((g, i) => ({
        name: String(g.name || '').trim(),
        topic: String(g.topic || '').trim(),
        from: Math.max(1, Math.round(Number(g.from) || 0) || 1),
        to: Math.round(Number(g.to) || 0) || words.length,
        i,
      }))
      .filter(g => g.to >= g.from && g.from <= words.length)
      .sort((a, b) => a.from - b.from || a.i - b.i);
    if (!ranges.length) return { units: flattenUnits(units, (units[0] && units[0].name) || 'Unit 1'), warnings: ['Keine Gruppen erkannt.'] };
    const out = [];
    let cursor = 1;
    ranges.forEach((g, idx) => {
      const from = cursor;
      const next = ranges[idx + 1];
      const to = next ? Math.max(from, Math.min(words.length, next.from - 1)) : words.length;
      if (g.from > from) warnings.push(`Lücke vor „${g.name}“ aufgefüllt.`);
      const slice = words.slice(from - 1, to);
      if (!slice.length) return;
      out.push({ name: g.name || 'Unit ' + (out.length + 1), topic: g.topic, words: slice });
      cursor = to + 1;
    });
    return { units: out, warnings };
  }

  /**
   * Apply detected topics to units WITHOUT mutating the given objects: stored
   * documents can be read-only (the db capability hands out frozen snapshots),
   * so every edit returns fresh objects.
   * `rows` are Claude's [{unit, topic}] pairs; with `onlyEmpty` a unit that
   * already has a topic keeps it.
   */
  function withTopics(units, rows, onlyEmpty) {
    const list = units || [];
    const byName = new Map();
    (rows || []).forEach(r => {
      if (!r) return;
      const name = String(r.unit || r.name || '').trim().toLowerCase();
      const topic = String(r.topic || '').trim();
      if (name && topic) byName.set(name, topic);
    });
    const sameLength = Array.isArray(rows) && rows.length === list.length;
    return list.map((u, i) => {
      if (onlyEmpty && u.topic) return u;
      const fallback = sameLength && rows[i] && rows[i].topic ? String(rows[i].topic).trim() : '';
      const topic = byName.get(String(u.name || '').trim().toLowerCase()) || fallback;
      return topic ? Object.assign({}, u, { topic }) : u;
    });
  }

  /** Replace one unit by id, returning a new units array (never mutates). */
  function withUnitPatch(units, id, patch) {
    return (units || []).map(u => (u.id === id ? Object.assign({}, u, patch) : u));
  }

  function makeId(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /** Merge imported units into a textbook: replace, update (merge words) or add. */
  function mergeUnits(textbook, units, mode) {
    const tb = JSON.parse(JSON.stringify(textbook));
    tb.units = tb.units || [];
    for (const u of units) {
      const existing = tb.units.find(x => x.name.toLowerCase() === u.name.toLowerCase());
      if (!existing) { tb.units.push({ id: makeId('unit'), name: u.name, topic: u.topic || '', words: u.words }); continue; }
      if (mode === 'replace') { existing.words = u.words; if (u.topic) existing.topic = u.topic; continue; }
      // update: add new words, refresh translations of existing ones
      for (const w of u.words) {
        const e = existing.words.find(x => x.word.toLowerCase() === w.word.toLowerCase());
        if (e) { if (w.translation) e.translation = w.translation; if (w.note) e.note = w.note; }
        else existing.words.push(w);
      }
      if (u.topic && !existing.topic) existing.topic = u.topic;
    }
    tb.units.sort((a, b) => unitSortKey(a.name) - unitSortKey(b.name) || a.name.localeCompare(b.name));
    return tb;
  }

  function unitSortKey(name) {
    const m = /(\d+)/.exec(name || '');
    return m ? Number(m[1]) : 9999;
  }

  return { parseText, parseRows, fromParsedRows, mergeUnits, makeId, detectDelimiter, splitRow, allWords, flattenUnits, applyGroups, withTopics, withUnitPatch, UNIT_HEADING };
});
