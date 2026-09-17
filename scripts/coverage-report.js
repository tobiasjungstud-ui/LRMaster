#!/usr/bin/env node
/* Writes CONCEPT_COVERAGE.md: every concept requirement with its implementation binding and check result. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const APP = path.join(__dirname, '..', 'app');
const core = require(path.join(APP, 'core.js'));
const controls = require(path.join(APP, 'controls.js'));
const checks = require(path.join(APP, 'checks.js'));
const manifest = require(path.join(APP, 'manifest.js'));
const quality = require(path.join(APP, 'quality.js'));

const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const uiSource = fs.readFileSync(path.join(APP, 'ui.js'), 'utf8');
const src = controls.renderForm() + '\n' + html;
const hasControl = (selector) => {
  let m;
  if ((m = /^\[([\w-]+)="([^"]+)"\]$/.exec(selector))) return src.includes(`${m[1]}="${m[2]}"`);
  if ((m = /^#([\w-]+)(\[([\w-]+)="([^"]+)"\])?$/.exec(selector))) {
    if (!src.includes(`id="${m[1]}"`)) return false;
    if (m[2]) return new RegExp(`id="${m[1]}"[^>]*${m[3]}="${m[4]}"|${m[3]}="${m[4]}"[^>]*id="${m[1]}"`).test(src);
    return true;
  }
  return src.includes(selector);
};
const pipelineSource = uiSource.slice(uiSource.indexOf('async function generate('), uiSource.indexOf('/* end generate */'));
const cov = checks.run({ hasControl, pipelineSource, uiSource, pipeline: true });

const SECTION_NAMES = { 0: 'Vollständigkeit', 1: 'Ziel der Anwendung', 2: 'Hauptnavigation', 3: 'Grundaufbau des Creators', 4: 'Source & Unit', 5: 'Content', 6: 'Language Level', 7: 'Vocabulary Settings', 8: 'Listening – Audio Structure', 9: 'Listening Presets', 10: 'Speaker Distribution', 11: 'Turn Length', 12: 'Audio Length', 13: 'Speaker Profiles', 14: 'Emotion & Delivery Tags', 15: 'Natural Speech Settings', 16: 'Information Explicitness', 17: 'Reading – Text Structure', 18: 'Worksheet', 19: 'Number of Questions', 20: 'Listening / Reading Skills', 21: 'Higher-Order Thinking', 22: 'Question Difficulty', 23: 'Automatic Skill Mix', 24: 'Manual Skill Mix', 25: 'Question Formats', 26: 'Question Order', 27: 'Pre-Listening / Pre-Reading', 28: 'Output', 29: 'Quality Check', 30: 'Advanced Settings', 31: 'Simple vs. Advanced Mode', 32: 'Beispielkonfiguration', 33: 'Word-Export (formatiert, typgerecht)', 34: 'Schwierigkeitsmesser & Niveau der Fragen', 35: 'Pre-Task: Typen, Sozialformen, Anforderungsniveau', 36: 'Post-Task: Typen, Sozialformen, Anforderungsniveau' };

const byId = Object.fromEntries(manifest.REQUIREMENTS.map(r => [r.id, r]));
function binding(r) {
  const req = byId[r.id];
  if (!req) return r.key ? '`' + r.key + '`' : '';
  switch (req.kind) {
    case 'setting': return `Setting \`${req.key}\` (core.SCHEMA → Control \`[data-setting="${req.key}"]\` → prompts.js)`;
    case 'rule': { const rule = quality.RULES.find(x => x.id === req.ruleId); return `Quality rule \`${req.ruleId}\` (${rule ? (rule.kind === 'deterministic' ? 'gemessen in quality.js' : 'Claude-Review über buildReviewPrompt') : 'fehlt'})`; }
    case 'render': return 'render.js (renderStudentHTML / renderTeacherHTML)';
    case 'ui': return `Element \`${req.selector}\``;
    case 'function': return 'Funktion (siehe Check im Manifest)';
    default: return '';
  }
}

const lines = [];
lines.push('# Konzept-Abdeckung (generiert)', '');
lines.push(`Erzeugt von \`npm run coverage\`. Jede Zeile ist eine Anforderung aus \`docs/Konzept_Listening_Reading_Creator.md\`, gebunden an die Stelle im Code, die sie umsetzt, und das Ergebnis der automatischen Prüfung (\`npm test\`).`, '');
lines.push(`**Ergebnis: ${cov.summary.pass} von ${cov.summary.total} Anforderungen bestanden.**`, '');
lines.push('Prüfarten: **setting** – Steuerelement vorhanden und Änderung des Werts verändert nachweislich den Prompt an Claude · **function** – Verhalten wird mit echten Eingaben ausgeführt und verglichen · **rule** – Qualitätsregel existiert als Messung oder Claude-Review-Kriterium · **render** – Ausgabe wird auf einer Fixture gerendert und inhaltlich geprüft · **ui** – Navigations-/Strukturelement existiert.', '');
const sections = [...new Set(cov.results.map(r => r.section))].sort((a, b) => a - b);
for (const sec of sections) {
  const rows = cov.results.filter(r => r.section === sec);
  lines.push(`## §${sec} ${SECTION_NAMES[sec] || ''} (${rows.filter(r => r.status === 'pass').length}/${rows.length})`, '');
  lines.push('| Status | ID | Anforderung | Art | Umsetzung |', '|---|---|---|---|---|');
  for (const r of rows) lines.push(`| ${r.status === 'pass' ? '✅' : '❌'} | \`${r.id}\` | ${r.title.replace(/\|/g, '\\|')} | ${r.kind} | ${binding(r).replace(/\|/g, '\\|')}${r.detail ? ' — ' + r.detail.replace(/\|/g, '\\|') : ''} |`);
  lines.push('');
}
lines.push('## Einstellungen (core.SCHEMA)', '', '| Key | Typ | Bereich | Modus | Simple Mode | Default |', '|---|---|---|---|---|---|');
for (const d of core.SCHEMA) lines.push(`| \`${d.key}\` | ${d.type} | ${d.section} | ${d.mode} | ${d.simple ? 'ja' : 'nein'} | \`${JSON.stringify(d.default)}\` |`);
lines.push('', '## Qualitätsregeln (quality.RULES)', '', '| ID | Gruppe | Art | Blockierend | Titel |', '|---|---|---|---|---|');
for (const r of quality.RULES) lines.push(`| \`${r.id}\` | ${r.group} | ${r.kind} | ${r.blocking ? 'ja' : 'nein'} | ${r.title} |`);
fs.writeFileSync(path.join(__dirname, '..', 'CONCEPT_COVERAGE.md'), lines.join('\n') + '\n');
console.log(`CONCEPT_COVERAGE.md written: ${cov.summary.pass}/${cov.summary.total} passed`);
process.exit(cov.summary.fail ? 1 : 0);
