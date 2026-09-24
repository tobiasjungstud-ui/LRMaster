#!/usr/bin/env node
/*
 * Fetch the photographs that ship with the app (app/photos/ + app/photolib.js).
 *
 *   node scripts/fetch-photos.js                 # Pexels if PEXELS_API_KEY is set, else Openverse
 *   node scripts/fetch-photos.js --source openverse --per 4
 *   node scripts/fetch-photos.js --subjects market,school --refresh
 *
 * Why the pictures are fetched once and shipped, not loaded at run time: the
 * published page may not load images from foreign servers, and a foreign
 * image on the canvas would make the PNG download fail. So the photographs
 * travel with the app, each with its author, source and licence.
 *
 * What is taken, and what is not:
 * - Licences that allow printing and handing out in one's own lessons: the
 *   Pexels licence, CC0, public domain, CC BY / CC BY-SA and — because the
 *   material is used in class, not sold — CC BY-NC / CC BY-NC-SA, always with
 *   the credit kept. `--strict` leaves the non-commercial ones out, for the
 *   day material is sold or published by a publisher.
 * - Never "no derivatives" (ND): a worksheet crops and screens the picture,
 *   and that is an adaptation. Non-commercial use does not change that.
 * - Portraits only from stock sources (Pexels), where the people are models
 *   who posed for such use. A photograph of a real, identifiable person from
 *   an archive never stands in for an invented author or character.
 * - A file is only kept if it really is a JPEG and not larger than 1.5 MB.
 *
 * Downloads go through curl, so the proxy and certificates of the machine
 * are used as they are.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DEFAULTS = {
  out: path.join(ROOT, 'app', 'photos'),
  lib: path.join(ROOT, 'app', 'photolib.js'),
  pexels: 'https://api.pexels.com',
  openverse: 'https://api.openverse.org',
};

/* What to search for, per subject of the picture engine. Several queries per
   subject, so the pictures of one subject do not all look alike. */
const SUBJECT_QUERIES = {
  portrait: ['portrait smiling person', 'headshot young adult', 'portrait teacher', 'portrait teenager outdoors'],
  people: ['two friends talking', 'people conversation cafe', 'interview two people'],
  crowd: ['crowd city square', 'audience hall', 'demonstration street crowd'],
  classroom: ['classroom students desks', 'school class lesson', 'students in classroom'],
  school: ['school building', 'schoolyard', 'high school exterior'],
  city: ['city skyline', 'city street aerial', 'european town centre'],
  street: ['street shops pedestrians', 'shopping street', 'high street'],
  home: ['living room', 'family kitchen home', 'cosy room sofa'],
  office: ['office workers desks', 'newsroom', 'open plan office'],
  desk: ['laptop desk notebook', 'homework desk', 'writing at desk'],
  phone: ['hand holding smartphone', 'teenager phone', 'phone chat screen'],
  sport: ['football match', 'basketball game', 'running track athletes'],
  park: ['city park path', 'park bench trees', 'meadow picnic'],
  mountain: ['alps mountains lake', 'mountain hiking trail', 'swiss mountains'],
  sea: ['beach sea', 'harbour boats', 'coast waves'],
  food: ['plate of food table', 'school canteen food', 'family dinner table'],
  market: ['farmers market stalls', 'market square', 'street market'],
  animal: ['dog in park', 'cat at home', 'horse field'],
  transport: ['city bus stop', 'train station platform', 'bicycles street'],
  concert: ['concert stage lights', 'music festival crowd', 'band on stage'],
  lab: ['science laboratory', 'scientist microscope', 'school science lab'],
  building: ['library building', 'museum facade', 'town hall'],
  still: ['old book on table', 'letter envelope table', 'objects on wooden table'],
  sky: ['cloudy sky', 'storm clouds', 'sunset sky'],
};

/**
 * Licences a worksheet may use (printed, cropped, handed out in class).
 * Non-commercial ones are fine for one's own teaching; `strict` is for
 * material that is sold. "No derivatives" never is: cropping is adapting.
 */
function acceptLicense(license, opts) {
  const strict = !!(opts && opts.strict);
  const l = String(license || '').toLowerCase().replace(/^cc[\s-]?/, '');
  if (['0', 'cc0', 'pdm', 'publicdomain', 'public domain', 'pexels', 'unsplash'].includes(l)) return true;
  if (/nd/.test(l)) return false;
  if (/nc/.test(l)) return !strict && (l === 'by-nc' || l === 'by-nc-sa');
  return l === 'by' || l === 'by-sa';
}

/** "cc0" → "CC0", "by" + "4.0" → "CC BY 4.0" — the licence as it is printed. */
function licenseLabel(license, version) {
  const l = String(license || '').toLowerCase();
  if (l === 'pexels') return 'Pexels License';
  if (l === 'cc0') return 'CC0 1.0';
  if (l === 'pdm') return 'Public Domain';
  return 'CC ' + l.toUpperCase() + (version ? ' ' + version : '');
}

/** A Pexels search result → library entries (without the file yet). */
function fromPexels(json, subject) {
  const photos = (json && Array.isArray(json.photos)) ? json.photos : [];
  return photos.filter(p => p && p.id && p.src && (p.src.large || p.src.medium)).map(p => ({
    id: 'pexels-' + p.id,
    subject,
    download: p.src.large || p.src.medium,
    author: String(p.photographer || '').trim(),
    source: 'Pexels',
    url: String(p.url || ''),
    license: 'Pexels License',
    credit: 'Foto: ' + (String(p.photographer || '').trim() || 'unbekannt') + ' / Pexels',
    persona: subject === 'portrait',
    w: Number(p.width) || 0, h: Number(p.height) || 0,
    alt: String(p.alt || ''),
  }));
}

/** An Openverse search result → library entries (without the file yet). */
function fromOpenverse(json, subject, opts) {
  const results = (json && Array.isArray(json.results)) ? json.results : [];
  return results.filter(r => r && r.id && acceptLicense(r.license, opts) && (r.url || r.thumbnail)).map(r => {
    const creator = String(r.creator || '').trim() || 'unbekannt';
    const source = String(r.source || r.provider || 'Openverse').replace(/^\w/, c => c.toUpperCase());
    const label = licenseLabel(r.license, r.license_version);
    const big = (Number(r.width) || 0) > 1800;
    return {
      id: 'ov-' + String(r.id).slice(0, 36),
      subject,
      download: big && r.thumbnail ? r.thumbnail : (r.url || r.thumbnail),
      author: creator,
      source,
      url: String(r.foreign_landing_url || r.url || ''),
      license: label,
      credit: 'Foto: ' + creator + ' / ' + source + ' (' + label + ')',
      // an archive photo of a real person never stands in for an invented one
      persona: false,
      w: Number(r.width) || 0, h: Number(r.height) || 0,
      alt: String(r.title || ''),
    };
  });
}

function curl(args) {
  return execFileSync('curl', ['-sS', '--fail', '--max-time', '40', '-L'].concat(args), { maxBuffer: 32 * 1024 * 1024 });
}

function search(source, base, subject, query, key, opts) {
  if (source === 'pexels') {
    const u = `${base}/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=15`;
    return fromPexels(JSON.parse(curl(['-H', 'Authorization: ' + key, u]).toString('utf8')), subject);
  }
  const licences = (opts && opts.strict) ? 'cc0,pdm,by,by-sa' : 'cc0,pdm,by,by-sa,by-nc,by-nc-sa';
  const u = `${base}/v1/images/?q=${encodeURIComponent(query)}&license=${licences}&category=photograph&mature=false&page_size=20`
    + (subject === 'portrait' ? '' : '&aspect_ratio=wide');
  return fromOpenverse(JSON.parse(curl([u]).toString('utf8')), subject, opts);
}

/** Is this buffer a JPEG of a sensible size? */
function isJpeg(buf) {
  return buf && buf.length > 100 && buf.length <= 1.5 * 1024 * 1024 && buf[0] === 0xFF && buf[1] === 0xD8;
}

/** Write the manifest that the app loads (app/photolib.js). */
function writeLibrary(file, photos, fetched) {
  const clean = photos.map(p => ({
    id: p.id, subject: p.subject, file: p.file, author: p.author, source: p.source, url: p.url,
    license: p.license, credit: p.credit, persona: !!p.persona, w: p.w, h: p.h, focus: p.focus || [0.5, 0.4],
  }));
  const body = JSON.stringify({ version: 1, fetched, photos: clean }, null, 2);
  const src = fs.readFileSync(DEFAULTS.lib, 'utf8');
  const header = src.slice(0, src.indexOf('(function (root, factory)'));
  const out = header + `(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LR = root.LR || {}; root.LR.photolib = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return ${body.replace(/\n/g, '\n  ')};
});
`;
  fs.writeFileSync(file, out);
}

function readLibrary(file) {
  try {
    delete require.cache[require.resolve(file)];
    const lib = require(file);
    return Array.isArray(lib.photos) ? lib.photos : [];
  } catch (e) { return []; }
}

function parseArgs(argv) {
  const o = { per: 4, refresh: false, strict: false, subjects: null, source: null, base: null, out: DEFAULTS.out, lib: DEFAULTS.lib, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--per') o.per = Math.max(1, Math.min(10, Number(argv[++i]) || 4));
    else if (a === '--refresh') o.refresh = true;
    else if (a === '--strict') o.strict = true;
    else if (a === '--subjects') o.subjects = String(argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--source') o.source = argv[++i];
    else if (a === '--base') o.base = argv[++i];
    else if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--lib') o.lib = path.resolve(argv[++i]);
    else if (a === '--quiet') o.quiet = true;
  }
  return o;
}

function main(argv) {
  const o = parseArgs(argv);
  const key = process.env.PEXELS_API_KEY || '';
  const source = o.source || (key ? 'pexels' : 'openverse');
  if (source === 'pexels' && !key) throw new Error('Pexels needs PEXELS_API_KEY (free at pexels.com/api).');
  const base = o.base || DEFAULTS[source];
  const log = o.quiet ? () => {} : (...x) => console.log(...x);
  fs.mkdirSync(o.out, { recursive: true });
  const existing = o.refresh ? [] : readLibrary(o.lib);
  const subjects = o.subjects || Object.keys(SUBJECT_QUERIES);
  const keep = existing.filter(p => !subjects.includes(p.subject) || !o.refresh);
  const photos = keep.slice();
  const relFolder = path.relative(path.dirname(o.lib), o.out).split(path.sep).join('/') || 'photos';
  for (const subject of subjects) {
    const queries = SUBJECT_QUERIES[subject];
    if (!queries) { log('  ? unknown subject ' + subject); continue; }
    // Openverse is an archive: its portraits are real, identifiable people
    if (subject === 'portrait' && source !== 'pexels') { log('  - portrait: only from a stock source (Pexels), skipped'); continue; }
    const have = photos.filter(p => p.subject === subject);
    const want = (subject === 'portrait' ? o.per * 2 : o.per) - have.length;
    if (want <= 0) { log(`  = ${subject}: ${have.length} already there`); continue; }
    const seen = new Set(photos.map(p => p.id));
    let got = 0;
    for (const query of queries) {
      if (got >= want) break;
      let hits = [];
      try { hits = search(source, base, subject, query, key, o); } catch (e) { log(`  ! ${subject} / "${query}": ${String(e.message || e).split('\n')[0]}`); continue; }
      for (const hit of hits) {
        if (got >= want) break;
        if (seen.has(hit.id)) continue;
        let buf = null;
        try { buf = curl([hit.download]); } catch (e) { continue; }
        if (!isJpeg(buf)) continue;
        const name = `${subject}-${hit.id.replace(/[^a-z0-9-]/gi, '').slice(0, 40)}.jpg`;
        fs.writeFileSync(path.join(o.out, name), buf);
        photos.push(Object.assign({}, hit, { file: relFolder + '/' + name }));
        seen.add(hit.id);
        got += 1;
      }
    }
    log(`  + ${subject}: ${got} new`);
  }
  writeLibrary(o.lib, photos, new Date().toISOString().slice(0, 10) + ' · ' + source);
  log(`\n${photos.length} photographs in ${path.relative(ROOT, o.lib)}`);
  return photos;
}

module.exports = { SUBJECT_QUERIES, acceptLicense, licenseLabel, fromPexels, fromOpenverse, isJpeg, writeLibrary, parseArgs, main };

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (e) { console.error(String(e.message || e)); process.exit(1); }
}
