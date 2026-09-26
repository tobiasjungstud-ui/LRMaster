#!/usr/bin/env node
/*
 * How many words fit on 1–4 A4 pages of every medium (concept §37).
 *
 * The page capacity table in app/core.js (PAGE_CAPACITY_MEDIA) is not
 * guessed: this script lays out a neutral text of growing length in every
 * medium, with the interface the fixture carries (a picture, crossheads, a
 * pull quote and eight things around the text), and finds the longest text
 * that still fits on n pages
 *   - as the page is made up normally ("natural"), and
 *   - when the page may give way (smaller picture, fewer things beside it).
 * The table weighs the two 3 : 7 — the things around the text give way
 * before the text does, but a page that needs none of the make-up steps
 * still counts for something.
 *
 *   node tests/calibrate.js           in Chromium with the real fonts of the app
 *   node tests/calibrate.js --node    with the metric estimate (no browser)
 *
 * It prints the table as JavaScript, ready to paste into app/core.js.
 */
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const APP = path.join(__dirname, '..', 'app');

/** Runs in Node and in the page: the capacity table for one measure. */
function calibrate(LR, measure) {
  const { core, mock, fixture } = LR;
  const SENTENCES = [
    'The town council met on Tuesday evening to talk about the plan for a new sports centre near the river.',
    'Many families came to the meeting because they wanted to hear what would happen to the old park.',
    'Some people were worried about the traffic, while others were excited about the swimming pool and the climbing wall.',
    'A student from the local school asked if young people could help to choose the activities.',
    'The mayor promised that a group of teenagers would join the planning team next month.',
    'Nobody knows yet how much the project will cost, but the council hopes to start building in spring.',
  ];
  // Paragraphs of about 36 words — three sentences of a B1 text, the short
  // end of "medium" — so the table holds for the paragraph lengths a teacher
  // usually sets: every paragraph costs room (a gap, an indent, in a forum a
  // whole post), so a text in many short paragraphs fills a page sooner. For
  // the setting "short" (two or three sentences) a factor per medium is
  // measured with paragraphs of about 24 words.
  const text = (words, per) => {
    const paras = []; let cur = [], n = 0, i = 0;
    while (n < words) {
      const s = SENTENCES[i++ % SENTENCES.length];
      cur.push(s); n += s.split(' ').length;
      if (cur.join(' ').split(' ').length >= per) { paras.push(cur.join(' ')); cur = []; }
    }
    if (cur.length) paras.push(cur.join(' '));
    return paras;
  };
  const types = Object.keys(core.TEXT_TYPE_DESIGN);
  const table = {}, short = {};
  for (const t of types) {
    const id = core.TEXT_TYPE_DESIGN[t];
    table[id] = {}; short[id] = {};
    for (const medium of ['screen', 'paper']) {
      const rowFor = (per) => {
        const pagesFor = (words, limit) => {
          const m = fixture.material({ textType: t, authenticLayout: true, layoutMedium: medium }, 'reading');
          m.content.paragraphs = text(words, per);
          return mock.buildModel(m, m.layout.chrome, { measure, pageLimit: limit }).pageFit.pages;
        };
        const longest = (n, limit) => {
          let a = 20, z = 4200;
          while (z - a > 10) { const mid = Math.round((a + z) / 2); if (pagesFor(mid, limit) <= n) a = mid; else z = mid; }
          return a;
        };
        const row = [];
        for (let n = 1; n <= 4; n++) {
          const natural = longest(n, 0), fitted = longest(n, n);
          row.push(Math.max(60, Math.round((0.3 * natural + 0.7 * fitted) / 10) * 10));
        }
        // more pages never hold fewer words
        for (let i = 1; i < row.length; i++) row[i] = Math.max(row[i], row[i - 1] + 60);
        return row;
      };
      const row = rowFor(36), rowShort = rowFor(24);
      table[id][medium] = row;
      // the worst page count decides: short paragraphs never get more room
      short[id][medium] = Math.min(1, Math.floor(Math.min.apply(null, row.map((v, i) => rowShort[i] / v)) * 100) / 100);
    }
  }
  return { table, short };
}

function print(result, how) {
  const { table, short } = result;
  const lines = Object.keys(table).map(id => `    ${id}: { screen: [${table[id].screen.join(', ')}], paper: [${table[id].paper.join(', ')}] },`);
  const shortLines = Object.keys(short).map(id => `    ${id}: { screen: ${short[id].screen}, paper: ${short[id].paper} },`);
  console.log(`  // measured by tests/calibrate.js (${how})\n  const PAGE_CAPACITY_MEDIA = {\n${lines.join('\n')}\n  };\n  const PAGE_SHORT_PARAGRAPHS = {\n${shortLines.join('\n')}\n  };`);
}

async function main() {
  if (process.argv.includes('--node')) {
    const LR = { core: require(path.join(APP, 'core.js')), mock: require(path.join(APP, 'mock.js')), fixture: require(path.join(APP, 'fixture.js')) };
    print(calibrate(LR, undefined), 'metric estimate');
    return;
  }
  let playwright = null;
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { playwright = require(p); break; } catch (e) { /* next */ } }
  const root = '/opt/pw-browsers';
  const exe = fs.existsSync(root) ? fs.readdirSync(root).map(d => path.join(root, d, 'chrome-linux', 'chrome')).find(f => fs.existsSync(f)) : null;
  if (!playwright || !exe) { console.error('No Playwright/Chromium: run with --node.'); process.exit(1); }
  const PORT = Number(process.env.LR_PORT || 8797);
  const server = http.createServer((req, res) => {
    const file = path.join(APP, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
    if (!file.startsWith(APP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'text/javascript' });
    res.end(fs.readFileSync(file));
  }).listen(PORT);
  const browser = await playwright.chromium.launch({ executablePath: exe });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // every face the pages use, loaded before the first measurement
    await page.evaluate(() => Promise.all(['400 16px "Source Serif 4"', '700 16px "Source Serif 4"', 'italic 400 16px "Source Serif 4"', '400 16px "Source Sans 3"', '700 16px "Source Sans 3"', '800 16px "Bricolage Grotesque"', '400 16px Caveat', '600 16px Caveat', '400 16px "IBM Plex Mono"'].map(f => document.fonts.load(f))));
    const loaded = await page.evaluate(() => document.fonts.check('16px "Source Serif 4"') && document.fonts.check('16px Caveat'));
    const result = await page.evaluate(`(${calibrate.toString()})(window.LR, window.LR.mock.canvasMeasure(document.createElement('canvas')))`);
    print(result, loaded ? 'Chromium, fonts of the app' : 'Chromium, FALLBACK fonts — the web fonts did not load');
  } finally {
    await browser.close();
    server.close();
  }
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { calibrate };
