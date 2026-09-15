/*
 * LRMaster ui — DOM, storage, Claude calls and the generation pipeline.
 * Everything didactic lives in the pure modules (core, prompts, quality,
 * render, vocab); this file wires them to the page and to the claude.ai
 * runtime capabilities (sample = Claude, db = storage, downloads = export).
 */
(function () {
  'use strict';
  const { core, prompts, quality, render, vocab, controls, checks, fixture } = window.LR;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = render.esc;

  /* ------------------------------------------------------------------ */
  /* Capabilities                                                         */
  /* ------------------------------------------------------------------ */

  const caps = { sample: null, db: null, downloads: null, ready: false };
  async function loadCapabilities() {
    const use = async (name) => { try { return window.claude && window.claude.use ? await window.claude.use(name) : null; } catch (e) { return null; } };
    const [sample, db, downloads] = await Promise.all([use('sample'), use('db'), use('downloads')]);
    caps.sample = sample; caps.db = db; caps.downloads = downloads; caps.ready = true;
    updateClaudeStatus();
    await store.init();
    await refreshTextbooks();
    if (window.claude && !sample) console.warn('LRMaster: sample capability not available in this view');
  }

  function updateClaudeStatus() {
    const el = $('#claude-status');
    if (!el) return;
    if (!caps.ready) { el.textContent = 'Verbindung zu Claude wird geprüft …'; el.dataset.state = 'pending'; return; }
    if (caps.sample) { el.textContent = 'Claude verbunden – Generierung möglich'; el.dataset.state = 'ok'; }
    else { el.textContent = 'Claude ist in dieser Ansicht nicht verfügbar. Öffne das Artifact in Claude.ai, um Material zu generieren.'; el.dataset.state = 'off'; }
    $$('#btn-generate, #btn-suggest-topics, #btn-parse-claude').forEach(b => { b.disabled = !caps.sample; });
  }

  const ERROR_COPY = {
    not_granted: 'Du hast der Seite die Nutzung von Claude nicht erlaubt. Generierung ist damit nicht möglich.',
    sampling_disabled: 'Claude ist für dieses Konto nicht verfügbar.',
    rate_limited: 'Zu viele Anfragen oder Nutzungslimit erreicht. Bitte später erneut versuchen.',
    session_expired: 'Sitzung abgelaufen – bitte neu anmelden.',
    refused: 'Claude hat diese Anfrage abgelehnt. Ändere Thema oder Einstellungen.',
    empty_completion: 'Claude hat keinen Text geliefert. Bitte mit weniger Umfang erneut versuchen.',
    invalid_json: 'Die Antwort war kein gültiges JSON. Bitte erneut versuchen.',
    prompt_too_large: 'Die Anfrage ist zu groß (zu viele Vokabeln oder zu langer Text).',
    cancelled: 'Abgebrochen.',
    upstream_error: 'Vorübergehender Fehler bei Claude. Bitte erneut versuchen.',
  };
  function errorCopy(e) {
    if (!e) return 'Unbekannter Fehler.';
    if (e.code && ERROR_COPY[e.code]) return ERROR_COPY[e.code];
    return e.message || String(e);
  }

  /** One Claude call returning JSON. */
  async function askJSON(prompt, opts) {
    opts = opts || {};
    if (!caps.sample) throw { code: 'not_granted', message: 'sample unavailable' };
    return caps.sample.json(prompt, { modelTier: opts.tier || 'default', cache: false, signal: opts.signal, onText: opts.onText });
  }

  /* ------------------------------------------------------------------ */
  /* Storage: db capability with localStorage fallback                     */
  /* ------------------------------------------------------------------ */

  const store = {
    backend: 'local',
    async init() { this.backend = caps.db ? 'db' : 'local'; },
    async list(coll) {
      if (this.backend === 'db') {
        try { const snap = await caps.db.collection(coll).get(); return snap.docs.filter(d => d.exists).map(d => Object.assign({ id: d.id }, d.data())); }
        catch (e) { console.warn('db list failed, using local', e); this.backend = 'local'; }
      }
      try { return JSON.parse(localStorage.getItem('lr:' + coll) || '[]'); } catch (e) { return []; }
    },
    async put(coll, obj) {
      if (this.backend === 'db') {
        try { await caps.db.doc(coll + '/' + obj.id).set(stripId(obj)); return; }
        catch (e) { console.warn('db write failed, using local', e); this.backend = 'local'; }
      }
      const all = await this.list(coll);
      const i = all.findIndex(x => x.id === obj.id);
      if (i >= 0) all[i] = obj; else all.push(obj);
      try { localStorage.setItem('lr:' + coll, JSON.stringify(all)); } catch (e) { toast('Speichern lokal nicht möglich: ' + e.message); }
    },
    async remove(coll, id) {
      if (this.backend === 'db') {
        try { await caps.db.doc(coll + '/' + id).delete(); return; } catch (e) { this.backend = 'local'; }
      }
      const all = (await this.list(coll)).filter(x => x.id !== id);
      try { localStorage.setItem('lr:' + coll, JSON.stringify(all)); } catch (e) { /* ignore */ }
    },
  };
  function stripId(o) { const c = Object.assign({}, o); delete c.id; return c; }

  /* ------------------------------------------------------------------ */
  /* App state                                                            */
  /* ------------------------------------------------------------------ */

  const app = {
    view: 'home',
    kind: 'listening',
    uiMode: 'simple',
    state: core.defaults('listening'),
    textbooks: [],
    materials: [],
    material: null,
    running: null, // AbortController while generating
  };

  function ctx() {
    const textbook = app.textbooks.find(t => t.id === app.state.textbookId) || null;
    const unit = textbook ? (textbook.units || []).find(u => u.id === app.state.unitId) || null : null;
    return { textbook, unit };
  }

  function loadDraft(kind) {
    try { const raw = localStorage.getItem('lr:draft:' + kind); if (raw) return core.normalizeState(Object.assign(JSON.parse(raw), { kind })); } catch (e) { /* ignore */ }
    return core.defaults(kind);
  }
  function saveDraft() { try { localStorage.setItem('lr:draft:' + app.kind, JSON.stringify(app.state)); } catch (e) { /* ignore */ } }

  /* ------------------------------------------------------------------ */
  /* Navigation                                                           */
  /* ------------------------------------------------------------------ */

  function showView(name) {
    app.view = name;
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + name; });
    $$('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
    $('#mode-toggle').hidden = name !== 'creator';
    window.scrollTo({ top: 0 });
    if (name === 'vocab') renderVocabManager();
    if (name === 'materials') renderMaterials();
    if (name === 'check') runConceptCheck();
  }

  function openCreator(kind) {
    app.kind = kind;
    app.state = loadDraft(kind);
    if (!app.state.textbookId && app.textbooks[0]) { app.state.textbookId = app.textbooks[0].id; app.state.unitId = app.textbooks[0].units[0] ? app.textbooks[0].units[0].id : ''; }
    $('#creator-kind').textContent = kind === 'listening' ? 'Listening erstellen' : 'Reading erstellen';
    document.body.dataset.kind = kind;
    fillForm();
    showView('creator');
    $('#output').hidden = !app.material || app.material.kind !== kind;
  }

  /* ------------------------------------------------------------------ */
  /* Form                                                                  */
  /* ------------------------------------------------------------------ */

  function buildForm() {
    $('#creator-form').innerHTML = controls.renderForm();
    // Generic bindings
    $$('#creator-form [data-setting]').forEach(el => {
      const key = el.dataset.setting;
      const def = core.SCHEMA_BY_KEY[key];
      if (!def) return;
      if (def.type === 'multiselect') {
        $$('input[data-multi]', el).forEach(cb => cb.addEventListener('change', () => {
          app.state[key] = $$('input[data-multi]', el).filter(c => c.checked).map(c => c.value);
          onStateChange(key);
        }));
      } else if (def.type === 'list' || def.type === 'map') {
        // custom controls rendered by renderCustomControl
      } else {
        const ev = def.type === 'text' || def.type === 'number' ? 'input' : 'change';
        el.addEventListener(ev, () => {
          let v = def.type === 'toggle' ? el.checked : el.value;
          if (def.type === 'range' || def.type === 'number') v = Number(v);
          if (def.type === 'select' && def.options && typeof def.options[0] === 'number') v = Number(v);
          app.state[key] = v;
          if (key === 'preset') { app.state = core.applyPreset(app.state, v); fillForm(); }
          if (key === 'textbookId') { const tb = app.textbooks.find(t => t.id === v); app.state.unitId = tb && tb.units[0] ? tb.units[0].id : ''; fillUnitSelect(); }
          onStateChange(key);
        });
      }
    });
    $$('[data-toggle-step]').forEach(b => b.addEventListener('click', () => {
      const body = b.closest('.step').querySelector('.step-body');
      const open = body.hidden; body.hidden = !open; b.setAttribute('aria-expanded', String(open));
    }));
    $$('[data-turn-preset]').forEach(b => b.addEventListener('click', () => { app.state = core.applyTurnPreset(app.state, b.dataset.turnPreset); fillForm(); onStateChange('turnLength'); }));
    $$('[data-jump]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); jumpTo(a.dataset.jump); }));
    $('#btn-generate').addEventListener('click', () => generate());
    $('#btn-stop').addEventListener('click', () => { if (app.running) app.running.abort(); });
    $('#btn-suggest-topics').addEventListener('click', suggestTopics);
  }

  function jumpTo(key) {
    const el = $(`[data-key="${key}"]`);
    if (!el) return;
    if (app.uiMode === 'simple' && el.dataset.simple === '0') setMode('advanced');
    const step = el.closest('.step'); if (step) { step.querySelector('.step-body').hidden = false; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500);
  }

  function fillTextbookSelect() {
    const sel = $('#set-textbookId');
    sel.innerHTML = app.textbooks.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('') || '<option value="">– kein Lehrmittel –</option>';
    sel.value = app.state.textbookId;
    if (sel.value !== app.state.textbookId) { app.state.textbookId = sel.value; const tb = app.textbooks.find(t => t.id === sel.value); app.state.unitId = tb && tb.units[0] ? tb.units[0].id : ''; }
    fillUnitSelect();
  }
  function fillUnitSelect() {
    const tb = app.textbooks.find(t => t.id === app.state.textbookId);
    const sel = $('#set-unitId');
    sel.innerHTML = (tb ? tb.units : []).map(u => `<option value="${esc(u.id)}">${esc(u.name)}${u.topic ? ' – ' + esc(u.topic) : ''} (${u.words.length})</option>`).join('') || '<option value="">– keine Unit –</option>';
    sel.value = app.state.unitId;
    if (sel.value !== app.state.unitId) app.state.unitId = sel.value;
  }

  /** Write app.state into every control. */
  function fillForm() {
    fillTextbookSelect();
    for (const def of core.SCHEMA) {
      const el = $(`#creator-form [data-setting="${def.key}"]`);
      if (!el) continue;
      const v = app.state[def.key];
      switch (def.type) {
        case 'toggle': el.checked = !!v; break;
        case 'multiselect': $$('input[data-multi]', el).forEach(cb => { cb.checked = (v || []).includes(cb.value); }); break;
        case 'list': case 'map': renderCustomControl(def.key, el); break;
        case 'select': if (def.key !== 'textbookId' && def.key !== 'unitId') el.value = String(v); break;
        default: el.value = v;
      }
      if (def.type === 'range') { const out = el.closest('.field').querySelector('output'); if (out) out.value = v; }
    }
    refreshDerived();
  }

  function onStateChange(key) {
    if (['format', 'speakerCount', 'speakerBalance'].includes(key)) { renderCustomControl('customShares'); renderCustomControl('speakerProfiles'); }
    if (key === 'unitId' || key === 'textbookId') renderCustomControl('selectedVocab');
    if (key === 'questionCount' || key === 'questionCountCustom') renderCustomControl('customSkillMix');
    const def = core.SCHEMA_BY_KEY[key];
    if (def && def.type === 'range') { const el = $(`#set-${key}`); const out = el && el.closest('.field').querySelector('output'); if (out) out.value = app.state[key]; }
    refreshDerived();
    saveDraft();
  }

  function renderCustomControl(key, el) {
    el = el || $(`#creator-form [data-setting="${key}"]`);
    if (!el) return;
    const body = $('.custom-body', el);
    const s = app.state;
    switch (key) {
      case 'customShares': {
        const n = core.effectiveSpeakerCount(s);
        const labels = core.speakerLabels(s);
        const shares = core.normalizeShares(s.customShares, n);
        if (!Array.isArray(s.customShares) || s.customShares.length !== n) s.customShares = shares.slice();
        body.innerHTML = labels.map((l, i) => `<label class="share-row"><span>${esc(l)}</span><input type="number" min="0" max="100" data-share="${i}" value="${Number(s.customShares[i]) || 0}"><span>%</span></label>`).join('') + `<div class="share-sum"><span id="share-sum"></span><button type="button" class="btn tiny" id="btn-normalize-shares">Auf 100 % normalisieren</button></div>`;
        const upd = () => { const sum = s.customShares.slice(0, n).reduce((a, b) => a + (Number(b) || 0), 0); const e = $('#share-sum'); e.textContent = `Summe: ${sum} %`; e.classList.toggle('bad', sum !== 100); };
        $$('input[data-share]', body).forEach(inp => inp.addEventListener('input', () => { s.customShares[Number(inp.dataset.share)] = Number(inp.value); upd(); onStateChange('customShares'); }));
        $('#btn-normalize-shares').addEventListener('click', () => { s.customShares = core.normalizeShares(s.customShares, n); renderCustomControl('customShares'); onStateChange('customShares'); });
        upd();
        break;
      }
      case 'speakerProfiles': {
        const n = core.effectiveSpeakerCount(s);
        while (s.speakerProfiles.length < n) s.speakerProfiles.push({ name: '', age: '', role: '', personality: '' });
        body.innerHTML = Array.from({ length: n }, (_, i) => `<div class="profile"><div class="profile-title">Speaker ${String.fromCharCode(65 + i)}</div>` + ['name', 'age', 'role', 'personality'].map(f => `<label><span>${f.charAt(0).toUpperCase() + f.slice(1)}</span><input type="text" data-profile="${i}" data-pf="${f}" value="${esc(s.speakerProfiles[i][f] || '')}" placeholder="${f === 'name' ? 'e.g. Maya' : f === 'age' ? '16' : f === 'role' ? 'Student' : 'confident, humorous'}"></label>`).join('') + '</div>').join('');
        $$('input[data-profile]', body).forEach(inp => inp.addEventListener('input', () => { s.speakerProfiles[Number(inp.dataset.profile)][inp.dataset.pf] = inp.value; onStateChange('speakerProfiles'); }));
        break;
      }
      case 'selectedVocab': {
        const { unit } = ctx();
        const words = unit ? unit.words : [];
        const chosen = new Set(s.selectedVocab || []);
        body.innerHTML = `<div class="vocab-actions"><button type="button" class="btn tiny" data-vsel="all">Alle</button><button type="button" class="btn tiny" data-vsel="none">Keine</button><span class="muted" id="vocab-count"></span></div><div class="vocab-grid">` + words.map(w => `<label class="chip"><input type="checkbox" value="${esc(w.word)}" data-vocab ${chosen.has(w.word) ? 'checked' : ''}><span>${esc(w.word)}${w.translation ? ` <em>${esc(w.translation)}</em>` : ''}</span></label>`).join('') + '</div>';
        const upd = () => { s.selectedVocab = $$('input[data-vocab]', body).filter(c => c.checked).map(c => c.value); $('#vocab-count').textContent = `${s.selectedVocab.length} von ${words.length} ausgewählt`; onStateChange('selectedVocab'); };
        $$('input[data-vocab]', body).forEach(c => c.addEventListener('change', upd));
        $$('[data-vsel]', body).forEach(b => b.addEventListener('click', () => { $$('input[data-vocab]', body).forEach(c => { c.checked = b.dataset.vsel === 'all'; }); upd(); }));
        $('#vocab-count').textContent = `${chosen.size} von ${words.length} ausgewählt`;
        break;
      }
      case 'customSkillMix': {
        body.innerHTML = '<div class="mix-grid">' + core.SKILLS.map(sk => `<label><span>${esc(sk.label)}</span><input type="number" min="0" max="30" data-mix="${sk.key}" value="${Number(s.customSkillMix[sk.key]) || 0}"></label>`).join('') + '</div><div class="share-sum"><span id="mix-sum"></span></div>';
        const upd = () => { const sum = core.SKILL_KEYS.reduce((a, k) => a + (Number(s.customSkillMix[k]) || 0), 0); const n = core.questionCount(s); const e = $('#mix-sum'); e.textContent = `Summe: ${sum} von ${n} Fragen`; e.classList.toggle('bad', sum !== n); };
        $$('input[data-mix]', body).forEach(inp => inp.addEventListener('input', () => { s.customSkillMix[inp.dataset.mix] = Number(inp.value); upd(); onStateChange('customSkillMix'); }));
        upd();
        break;
      }
    }
  }

  /** Visibility rules, derived previews and validation. */
  function refreshDerived() {
    const s = app.state;
    const show = (key, cond) => { const el = $(`[data-key="${key}"]`); if (el) el.classList.toggle('cond-hidden', !cond); };
    show('speakerCount', s.format === 'conversation');
    show('customShares', s.speakerBalance === 'custom' && core.effectiveSpeakerCount(s) > 1);
    show('speakerBalance', core.effectiveSpeakerCount(s) > 1);
    show('turnLength', core.effectiveSpeakerCount(s) > 1);
    show('turnVariability', core.effectiveSpeakerCount(s) > 1);
    show('audioLengthCustom', s.audioLength === 'custom');
    show('customTopic', s.topicMode === 'custom' || !s.useUnitTopic);
    show('customTextType', s.textType === 'Custom');
    show('wordCount', s.lengthMode === 'words');
    show('a4Pages', s.lengthMode === 'a4');
    show('selectedVocab', s.vocabSelectionMode === 'manual');
    for (const k of ['questionCount', 'questionCountCustom', 'questionDifficulty', 'skillMixMode', 'customSkillMix', 'questionFormats', 'autoFormatMix', 'followChronology', 'higherOrder', 'higherOrderCount', 'higherOrderTypes', 'preTask', 'preTaskTypes', 'distractorDifficulty', 'inferenceLevel']) show(k, s.createWorksheet);
    if (s.createWorksheet) {
      show('questionCountCustom', s.questionCount === 'custom');
      show('customSkillMix', s.skillMixMode === 'custom');
      show('higherOrderCount', s.higherOrder); show('higherOrderTypes', s.higherOrder);
      show('preTaskTypes', s.preTask);
    }
    // topicMode select is only meaningful when the unit topic is ON
    const tm = $('#set-topicMode'); if (tm) { tm.disabled = !s.useUnitTopic; if (!s.useUnitTopic) { s.topicMode = 'custom'; tm.value = 'custom'; } }
    // who_said_it only for multi-speaker listening
    const who = $('input[data-multi="questionFormats"][value="who_said_it"]'); if (who) who.closest('.chip').classList.toggle('disabled', !(s.kind === 'listening' && core.effectiveSpeakerCount(s) >= 2));
    // labels
    const fc = $('[data-key="followChronology"] .lbl'); if (fc) fc.textContent = s.kind === 'listening' ? 'Follow audio chronology' : 'Follow text order';
    const est = $('#audio-estimate');
    if (est && s.kind === 'listening') est.textContent = `≈ ${core.targetWordCount(s)} Wörter bei ${core.wordsPerMinute(s.speakingSpeed)} Wörtern/Minute für ${Math.round(core.audioSeconds(s) / 60 * 10) / 10} min`;
    renderPlanPreview();
  }

  function renderPlanPreview() {
    const c = ctx();
    const errors = core.validateState(app.state, c);
    const v = $('#validation');
    v.hidden = errors.length === 0;
    v.innerHTML = errors.map(e => `<p><a href="#" data-jump="${e.key}">${esc(e.message)}</a></p>`).join('');
    $$('[data-jump]', v).forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); jumpTo(a.dataset.jump); }));
    $('#btn-generate').disabled = errors.length > 0 || !caps.sample || !!app.running;
    const plan = core.buildPlan(app.state, c);
    const p = $('#plan-preview');
    const rows = [
      ['Topic', plan.topic || '–', plan.topicSource === 'unit' ? '(Unit-Thema)' : '(eigenes Thema)'],
      ['Sprache', plan.cefr, `Complexity ${app.state.languageComplexity}/100`],
      app.state.kind === 'listening' ? ['Audio', `${Math.round(plan.seconds / 60 * 10) / 10} min → ≈ ${plan.targetWords} Wörter`, plan.preset.label] : ['Text', `≈ ${plan.targetWords} Wörter`, app.state.textType],
      app.state.kind === 'listening' ? ['Sprecher', plan.speakers.map(sp => `${sp.label} ${sp.share} %`).join(' · '), ''] : null,
      ['Vokabular', app.state.vocabSelectionMode === 'manual' ? `${plan.vocabulary.length} manuell gewählt` : `${plan.vocabRange[0]}–${plan.vocabRange[1]} aus ${plan.vocabulary.length} Unit-Einträgen`, ''],
      plan.questionCount ? ['Fragen', `${plan.questionCount} · Niveau ${plan.questionBand} · ` + core.SKILLS.filter(sk => plan.skillMix[sk.key]).map(sk => `${plan.skillMix[sk.key]} × ${sk.short}`).join(', '), ''] : ['Worksheet', 'aus – nur Skript/Text', ''],
      plan.questionCount ? ['Formate', (plan.formatSequence ? 'Balanced mix: ' : 'frei aus: ') + plan.formats.map(f => core.QUESTION_FORMATS.find(x => x.key === f).label).join(', '), ''] : null,
      plan.higherOrderCount ? ['Higher-Order', `${plan.higherOrderCount} × ${plan.higherOrderTypes.join('/')}`, ''] : null,
      plan.preTaskTypes.length ? ['Pre-Task', plan.preTaskTypes.join(', '), ''] : null,
    ].filter(Boolean);
    p.innerHTML = '<h3>Plan</h3><dl>' + rows.map(r => `<div><dt>${esc(r[0])}</dt><dd>${esc(r[1])} <span class="muted">${esc(r[2])}</span></dd></div>`).join('') + '</dl>';
  }

  function setMode(mode) {
    app.uiMode = mode;
    document.body.dataset.uimode = mode;
    $$('#mode-toggle button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    try { localStorage.setItem('lr:uimode', mode); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ */
  /* Topic suggestions (concept §5)                                        */
  /* ------------------------------------------------------------------ */

  async function suggestTopics() {
    const box = $('#topic-suggestions');
    const btn = $('#btn-suggest-topics');
    const c = ctx();
    if (!c.unit) { toast('Bitte zuerst eine Unit wählen.'); return; }
    btn.disabled = true; box.hidden = false; box.innerHTML = '<p class="muted">Claude denkt nach …</p>';
    try {
      const plan = core.buildPlan(app.state, c);
      const list = await askJSON(prompts.buildTopicPrompt(app.state, plan), { tier: 'quick' });
      const items = Array.isArray(list) ? list : (list && Array.isArray(list.scenarios) ? list.scenarios : []);
      box.innerHTML = items.length ? items.map((t, i) => `<button type="button" class="suggestion" data-idx="${i}"><strong>${esc(t.title)}</strong><span>${esc(t.description)}</span></button>`).join('') : '<p class="muted">Keine Vorschläge erhalten.</p>';
      $$('.suggestion', box).forEach(b => b.addEventListener('click', () => {
        const t = items[Number(b.dataset.idx)];
        app.state.useUnitTopic = true; app.state.topicMode = 'custom'; app.state.customTopic = `${t.title}: ${t.description}`;
        fillForm(); onStateChange('customTopic'); box.hidden = true;
      }));
    } catch (e) { box.innerHTML = `<p class="error">${esc(errorCopy(e))}</p>`; }
    finally { btn.disabled = !caps.sample; }
  }

  /* ------------------------------------------------------------------ */
  /* Generation pipeline                                                   */
  /* ------------------------------------------------------------------ */

  const STEPS = [
    ['plan', 'Plan & Validierung'], ['content', 'Skript / Text schreiben'], ['content-check', 'Content prüfen'], ['content-fix', 'Content überarbeiten'],
    ['questions', 'Aufgaben erstellen'], ['question-check', 'Aufgaben prüfen'], ['review', 'Claude-Review'], ['question-fix', 'Aufgaben überarbeiten'], ['done', 'Ausgabe'],
  ];
  function progress(step, status, note) {
    const el = $('#progress');
    el.hidden = false;
    if (!el.dataset.built) {
      el.innerHTML = '<ol class="steps">' + STEPS.map(s => `<li data-step="${s[0]}"><span class="dot"></span><span class="name">${s[1]}</span><span class="note"></span></li>`).join('') + '</ol><pre id="stream" class="stream" hidden></pre>';
      el.dataset.built = '1';
    }
    if (step === 'reset') { $$('li', el).forEach(li => { li.dataset.status = ''; $('.note', li).textContent = ''; }); $('#stream').hidden = true; $('#stream').textContent = ''; return; }
    const li = $(`li[data-step="${step}"]`, el);
    if (li) { li.dataset.status = status; $('.note', li).textContent = note || ''; }
  }
  function streamPreview(text) {
    const pre = $('#stream'); pre.hidden = false; pre.textContent = text.slice(-1200);
  }

  async function generate() {
    const c = ctx();
    const state = core.clone(app.state);
    const errors = core.validateState(state, c);
    if (errors.length) { renderPlanPreview(); return; }
    if (!caps.sample) { toast(ERROR_COPY.not_granted); return; }
    const ctl = new AbortController();
    app.running = ctl;
    $('#btn-generate').disabled = true; $('#btn-stop').hidden = false;
    progress('reset');
    $('#output').hidden = true;
    const t0 = Date.now();
    const log = [];
    const usedPrompts = {};
    try {
      // 1. Plan
      progress('plan', 'running');
      const plan = core.buildPlan(state, c);
      progress('plan', 'done', `${plan.targetWords} Wörter · ${plan.questionCount} Fragen`);

      // 2. Content
      progress('content', 'running', 'Claude schreibt …');
      usedPrompts.content = prompts.buildContentPrompt(state, plan);
      let rawContent = await askJSON(usedPrompts.content, { signal: ctl.signal, onText: ({ text }) => streamPreview(text) });
      let content = quality.normalizeContent(rawContent, state, plan);
      progress('content', 'done', `„${content.title}“`);

      // 3. Deterministic content checks, one revision if blocking rules fail
      progress('content-check', 'running');
      let contentFindings = quality.runContentChecks(state, plan, content);
      let blocking = quality.blockingFailures(contentFindings);
      progress('content-check', blocking.length ? 'warn' : 'done', summaryText(contentFindings));
      if (blocking.length) {
        progress('content-fix', 'running', blocking.map(f => f.title).join(', '));
        usedPrompts.contentRevision = prompts.buildContentRevisionPrompt(state, plan, content, blocking);
        try {
          const revised = quality.normalizeContent(await askJSON(usedPrompts.contentRevision, { signal: ctl.signal, onText: ({ text }) => streamPreview(text) }), state, plan);
          const revisedFindings = quality.runContentChecks(state, plan, revised);
          const better = quality.blockingFailures(revisedFindings).length <= blocking.length;
          if (better) { content = revised; contentFindings = revisedFindings; }
          log.push({ step: 'content-fix', accepted: better });
          progress('content-fix', 'done', better ? summaryText(revisedFindings) : 'Erste Fassung beibehalten');
        } catch (e) { if (e.code === 'cancelled') throw e; progress('content-fix', 'warn', errorCopy(e)); }
      } else progress('content-fix', 'skip', 'nicht nötig');

      // 4. Worksheet
      let worksheet = null, questionFindings = [], reviewFindings = [], review = null;
      if (state.createWorksheet) {
        progress('questions', 'running', 'Claude schreibt Aufgaben …');
        usedPrompts.questions = prompts.buildQuestionPrompt(state, plan, content);
        worksheet = quality.normalizeWorksheet(await askJSON(usedPrompts.questions, { signal: ctl.signal, onText: ({ text }) => streamPreview(text) }));
        progress('questions', 'done', `${worksheet.questions.length} Fragen`);

        progress('question-check', 'running');
        questionFindings = quality.runDeterministic(state, plan, content, worksheet).filter(f => f.group === 'questions');
        progress('question-check', quality.blockingFailures(questionFindings).length ? 'warn' : 'done', summaryText(questionFindings));

        // 5. Claude review of the rules that need reading
        progress('review', 'running', 'Claude prüft …');
        const rules = quality.llmRules(state, plan, worksheet);
        usedPrompts.review = prompts.buildReviewPrompt(state, plan, content, worksheet, rules, contentFindings.concat(questionFindings));
        try {
          review = await askJSON(usedPrompts.review, { signal: ctl.signal });
          reviewFindings = quality.mergeReview(rules, review);
          progress('review', quality.blockingFailures(reviewFindings).length ? 'warn' : 'done', summaryText(reviewFindings));
        } catch (e) { if (e.code === 'cancelled') throw e; reviewFindings = quality.mergeReview(rules, null); progress('review', 'warn', errorCopy(e)); }

        // 6. One revision of the worksheet if blocking findings remain
        const qBlocking = quality.blockingFailures(questionFindings.concat(reviewFindings.filter(f => f.group === 'questions')));
        if (qBlocking.length) {
          progress('question-fix', 'running', qBlocking.map(f => f.title).join(', '));
          usedPrompts.questionRevision = prompts.buildQuestionRevisionPrompt(state, plan, content, worksheet, qBlocking, review && review.fixInstructions);
          try {
            const revised = quality.normalizeWorksheet(await askJSON(usedPrompts.questionRevision, { signal: ctl.signal, onText: ({ text }) => streamPreview(text) }));
            const revisedFindings = quality.runDeterministic(state, plan, content, revised).filter(f => f.group === 'questions');
            if (quality.blockingFailures(revisedFindings).length <= quality.blockingFailures(questionFindings).length) {
              worksheet = revised; questionFindings = revisedFindings;
              // Re-run the review so the final state is verified, not assumed.
              try {
                usedPrompts.review2 = prompts.buildReviewPrompt(state, plan, content, worksheet, rules, contentFindings.concat(questionFindings));
                review = await askJSON(usedPrompts.review2, { signal: ctl.signal });
                reviewFindings = quality.mergeReview(rules, review);
              } catch (e) { if (e.code === 'cancelled') throw e; }
              log.push({ step: 'question-fix', accepted: true });
              progress('question-fix', 'done', summaryText(revisedFindings.concat(reviewFindings)));
            } else { log.push({ step: 'question-fix', accepted: false }); progress('question-fix', 'warn', 'Überarbeitung nicht besser – erste Fassung behalten'); }
          } catch (e) { if (e.code === 'cancelled') throw e; progress('question-fix', 'warn', errorCopy(e)); }
        } else progress('question-fix', 'skip', 'nicht nötig');
      } else { for (const s of ['questions', 'question-check', 'review', 'question-fix']) progress(s, 'skip', 'kein Worksheet'); }

      // 7. Assemble
      progress('done', 'running');
      const contentOnlyReview = !state.createWorksheet ? await reviewContentOnly(state, plan, content, contentFindings, ctl).catch(() => []) : [];
      const findings = contentFindings.concat(questionFindings, reviewFindings, contentOnlyReview);
      const vm = quality.vocabMatches(quality.materialText(content, state.kind).text, plan.vocabulary);
      const material = {
        id: vocab.makeId('mat'), createdAt: Date.now(), kind: state.kind, title: (worksheet && worksheet.title) || content.title,
        settings: state, plan, content, worksheet, vocabFound: vm.found, vocabMissing: vm.missing,
        quality: { findings, review, log, durationMs: Date.now() - t0 }, prompts: usedPrompts,
      };
      app.material = material;
      await store.put('materials', material);
      renderOutput(material);
      progress('done', 'done', `${Math.round((Date.now() - t0) / 1000)} s`);
      toast('Material erstellt und gespeichert.');
    } catch (e) {
      if (e && e.code === 'cancelled') { toast('Generierung abgebrochen.'); progress('done', 'warn', 'abgebrochen'); }
      else { console.error(e); toast('Fehler: ' + errorCopy(e)); progress('done', 'fail', errorCopy(e)); }
    } finally {
      app.running = null; $('#btn-stop').hidden = true; renderPlanPreview();
    }
  }
  /* end generate */

  async function reviewContentOnly(state, plan, content, contentFindings, ctl) {
    const rules = quality.llmRules(state, plan, null);
    const review = await askJSON(prompts.buildReviewPrompt(state, plan, content, null, rules, contentFindings), { signal: ctl.signal });
    return quality.mergeReview(rules, review);
  }

  function summaryText(findings) {
    const s = quality.summarize(findings);
    return `${s.pass} ok · ${s.warn} Warnungen · ${s.fail} Fehler`;
  }

  /* ------------------------------------------------------------------ */
  /* Output                                                                */
  /* ------------------------------------------------------------------ */

  function renderOutput(m) {
    const out = $('#output');
    out.hidden = false;
    $('#out-title').textContent = m.title;
    $('#out-student').innerHTML = render.renderStudentHTML(m);
    $('#out-teacher').innerHTML = render.renderTeacherHTML(m);
    $('#out-quality').innerHTML = renderQualityPanel(m);
    $('#out-prompts').innerHTML = Object.entries(m.prompts || {}).map(([k, v]) => `<details><summary>${esc(k)} (${v.length} Zeichen)</summary><pre>${esc(v)}</pre></details>`).join('') || '<p class="muted">–</p>';
    $('#out-json').textContent = JSON.stringify({ content: m.content, worksheet: m.worksheet, plan: m.plan }, null, 2);
    showTab('student');
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderQualityPanel(m) {
    const f = m.quality.findings || [];
    const groups = [['content', 'Content'], ['listening', 'Listening'], ['questions', 'Questions']];
    const s = quality.summarize(f);
    let html = `<p class="stats">${s.pass} bestanden · ${s.warn} Warnungen · ${s.fail} nicht bestanden · ${s.unverified} nicht geprüft · ${Math.round((m.quality.durationMs || 0) / 1000)} s</p>`;
    for (const [g, title] of groups) {
      const list = f.filter(x => x.group === g);
      if (!list.length) continue;
      html += `<h3>${title}</h3><div class="table-wrap"><table class="qc-table"><tbody>` + list.map(x => `<tr class="qc-${x.status}"><td class="qc-status">${x.status}</td><td>${esc(x.title)}<div class="muted small">${x.kind === 'llm' ? 'Claude-Review' : 'gemessen'}${x.questions && x.questions.length ? ' · Q' + x.questions.join(', Q') : ''}</div></td><td class="muted">${esc(x.detail)}</td></tr>`).join('') + '</tbody></table></div>';
    }
    if (m.quality.review && m.quality.review.fixInstructions) html += `<p class="muted"><strong>Reviewer:</strong> ${esc(m.quality.review.fixInstructions)}</p>`;
    return html;
  }

  function showTab(name) {
    $$('#output .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('#output .pane').forEach(p => { p.hidden = p.dataset.pane !== name; });
    document.body.dataset.printpane = name;
  }

  function fullDocument(title, bodyHtml) {
    const css = $('#print-css') ? $('#print-css').textContent : '';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${bodyHtml}</body></html>`;
  }

  async function download(kind) {
    const m = app.material; if (!m) return;
    const slug = (m.title || 'material').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'material';
    let filename, data;
    if (kind === 'md') { filename = slug + '.md'; data = render.renderMarkdown(m); }
    else if (kind === 'student') { filename = slug + '-student.html'; data = fullDocument(m.title, render.renderStudentHTML(m)); }
    else if (kind === 'teacher') { filename = slug + '-teacher.html'; data = fullDocument(m.title + ' (teacher)', render.renderTeacherHTML(m)); }
    else { filename = slug + '.json'; data = JSON.stringify(m, null, 2); }
    if (caps.downloads) {
      try { await caps.downloads.save({ filename, data }); toast('Gespeichert: ' + filename); }
      catch (e) { if (e.code !== 'declined') toast('Download nicht möglich: ' + (e.message || e.code)); }
    } else {
      // Outside the Claude viewer: copy to clipboard as fallback.
      try { await navigator.clipboard.writeText(data); toast('Download hier nicht verfügbar – Inhalt in die Zwischenablage kopiert.'); } catch (e) { toast('Download hier nicht verfügbar.'); }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Vocabulary / textbook manager (concept §2)                            */
  /* ------------------------------------------------------------------ */

  async function refreshTextbooks() {
    const stored = await store.list('textbooks');
    app.textbooks = stored.length ? stored : fixture.textbooks();
    app.materials = await store.list('materials');
    if ($('#set-textbookId')) fillTextbookSelect();
    renderHomeCounts();
    if (app.view === 'vocab') renderVocabManager();
  }

  function renderHomeCounts() {
    const el = $('#home-stats');
    if (!el) return;
    const units = app.textbooks.reduce((a, t) => a + (t.units || []).length, 0);
    const words = app.textbooks.reduce((a, t) => a + (t.units || []).reduce((b, u) => b + u.words.length, 0), 0);
    el.textContent = `${app.textbooks.length} Lehrmittel · ${units} Units · ${words} Vokabeln · ${app.materials.length} gespeicherte Materialien` + (app.textbooks.some(t => t.example) && !app.textbooks.some(t => !t.example) ? ' · Beispieldaten aktiv' : '');
  }

  const importState = { units: null, warnings: [], sourceName: '' };

  function renderVocabManager() {
    const list = $('#textbook-list');
    list.innerHTML = app.textbooks.map(t => `<div class="textbook" data-tb="${esc(t.id)}"><div class="tb-head"><h3>${esc(t.name)}${t.example ? ' <span class="badge">Beispiel</span>' : ''}</h3><div class="tb-actions"><button type="button" class="btn tiny" data-tb-rename="${esc(t.id)}">Umbenennen</button><button type="button" class="btn tiny danger" data-tb-delete="${esc(t.id)}">Löschen</button></div></div><ul class="units">` + (t.units || []).map(u => `<li><span class="unit-name">${esc(u.name)}</span><input type="text" class="unit-topic" data-topic="${esc(t.id)}:${esc(u.id)}" value="${esc(u.topic || '')}" placeholder="Thema der Unit"><span class="muted">${u.words.length} Wörter</span><button type="button" class="btn tiny" data-unit-show="${esc(t.id)}:${esc(u.id)}">Anzeigen</button><button type="button" class="btn tiny danger" data-unit-delete="${esc(t.id)}:${esc(u.id)}">Löschen</button></li>`).join('') + '</ul><div class="unit-words" hidden></div></div>').join('') || '<p class="muted">Noch kein Lehrmittel angelegt.</p>';
    const tbSel = $('#import-textbook');
    tbSel.innerHTML = app.textbooks.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
    $$('[data-tb-rename]', list).forEach(b => b.addEventListener('click', async () => {
      const tb = app.textbooks.find(t => t.id === b.dataset.tbRename); const name = prompt('Neuer Name des Lehrmittels', tb.name); if (!name) return;
      tb.name = name.trim(); await persistTextbook(tb);
    }));
    $$('[data-tb-delete]', list).forEach(b => b.addEventListener('click', async () => {
      const tb = app.textbooks.find(t => t.id === b.dataset.tbDelete); if (!confirm(`Lehrmittel „${tb.name}“ mit allen Units löschen?`)) return;
      if (!tb.example) await store.remove('textbooks', tb.id); else app.textbooks = app.textbooks.filter(t => t.id !== tb.id);
      await refreshTextbooks(); renderVocabManager();
    }));
    $$('[data-unit-delete]', list).forEach(b => b.addEventListener('click', async () => {
      const [tid, uid] = b.dataset.unitDelete.split(':'); const tb = app.textbooks.find(t => t.id === tid); const u = tb.units.find(x => x.id === uid);
      if (!confirm(`Unit „${u.name}“ löschen?`)) return; tb.units = tb.units.filter(x => x.id !== uid); await persistTextbook(tb);
    }));
    $$('[data-unit-show]', list).forEach(b => b.addEventListener('click', () => {
      const [tid, uid] = b.dataset.unitShow.split(':'); const tb = app.textbooks.find(t => t.id === tid); const u = tb.units.find(x => x.id === uid);
      const box = b.closest('.textbook').querySelector('.unit-words'); box.hidden = false;
      box.innerHTML = `<h4>${esc(u.name)}</h4><table class="words"><tbody>` + u.words.map(w => `<tr><td>${esc(w.word)}</td><td>${esc(w.translation)}</td><td class="muted">${esc(w.note)}</td></tr>`).join('') + '</tbody></table>';
    }));
    $$('input[data-topic]', list).forEach(inp => inp.addEventListener('change', async () => {
      const [tid, uid] = inp.dataset.topic.split(':'); const tb = app.textbooks.find(t => t.id === tid); const u = tb.units.find(x => x.id === uid); u.topic = inp.value.trim(); await persistTextbook(tb, true);
    }));
    renderImportPreview();
  }

  async function persistTextbook(tb, quiet) {
    if (tb.example) { tb.example = false; if (!tb.id.startsWith('tb_') || tb.id.includes('example')) tb.id = vocab.makeId('tb'); }
    await store.put('textbooks', tb);
    await refreshTextbooks();
    if (app.view === 'vocab') renderVocabManager();
    if (!quiet) toast('Lehrmittel gespeichert.');
  }

  async function newTextbook() {
    const name = prompt('Name des Lehrmittels (z. B. English Plus 4)');
    if (!name || !name.trim()) return;
    const tb = { id: vocab.makeId('tb'), name: name.trim(), units: [] };
    await store.put('textbooks', tb);
    await refreshTextbooks(); renderVocabManager();
    $('#import-textbook').value = tb.id;
  }

  async function readImportFile(file) {
    importState.sourceName = file.name;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const opts = { defaultUnit: $('#import-unit').value.trim() || undefined };
    if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
      if (!window.XLSX) { toast('Tabellenkalkulations-Import nicht geladen – bitte als CSV exportieren.'); return; }
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: 'array' });
      const rows = [];
      for (const name of wb.SheetNames) {
        const sheetRows = window.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' });
        if (wb.SheetNames.length > 1 && /unit|einheit|lektion/i.test(name)) rows.push([name]);
        rows.push(...sheetRows);
      }
      const r = vocab.parseRows(rows, opts);
      importState.units = r.units; importState.warnings = r.warnings;
    } else {
      const text = await file.text();
      $('#import-text').value = text;
      const r = vocab.parseText(text, opts);
      importState.units = r.units; importState.warnings = r.warnings;
    }
    renderImportPreview();
  }

  function parsePasted() {
    const text = $('#import-text').value;
    if (!text.trim()) { toast('Bitte Text einfügen oder Datei wählen.'); return; }
    const r = vocab.parseText(text, { defaultUnit: $('#import-unit').value.trim() || undefined });
    importState.units = r.units; importState.warnings = r.warnings; importState.sourceName = 'Eingefügter Text';
    renderImportPreview();
  }

  async function parseWithClaude() {
    const text = $('#import-text').value;
    if (!text.trim()) { toast('Bitte Text einfügen.'); return; }
    const btn = $('#btn-parse-claude'); btn.disabled = true;
    $('#import-preview').innerHTML = '<p class="muted">Claude strukturiert die Liste …</p>';
    try {
      const rows = await askJSON(prompts.buildVocabParsePrompt(text, $('#import-unit').value.trim()), { tier: 'quick' });
      const r = vocab.fromParsedRows(Array.isArray(rows) ? rows : [], { defaultUnit: $('#import-unit').value.trim() || undefined });
      importState.units = r.units; importState.warnings = r.warnings; importState.sourceName = 'Claude-Import';
      renderImportPreview();
    } catch (e) { $('#import-preview').innerHTML = `<p class="error">${esc(errorCopy(e))}</p>`; }
    finally { btn.disabled = !caps.sample; }
  }

  function renderImportPreview() {
    const box = $('#import-preview');
    if (!importState.units) { box.innerHTML = '<p class="muted">Noch nichts importiert. Unterstützt: CSV, TSV, TXT (Wort – Übersetzung), XLSX; Unit-Überschriften wie „Unit 3: Movies“ oder eine Unit-Spalte werden erkannt.</p>'; $('#btn-import-confirm').disabled = true; return; }
    const total = importState.units.reduce((a, u) => a + u.words.length, 0);
    box.innerHTML = `<p><strong>${esc(importState.sourceName)}</strong>: ${importState.units.length} Unit(s), ${total} Einträge.</p>` + (importState.warnings.length ? `<p class="muted">${importState.warnings.length} Zeile(n) übersprungen.</p>` : '') + '<ul class="import-units">' + importState.units.map((u, i) => `<li><input type="text" data-imp-name="${i}" value="${esc(u.name)}"> <input type="text" data-imp-topic="${i}" value="${esc(u.topic || '')}" placeholder="Thema"> <span class="muted">${u.words.length} Wörter: ${esc(u.words.slice(0, 6).map(w => w.word).join(', '))}${u.words.length > 6 ? ' …' : ''}</span></li>`).join('') + '</ul>';
    $$('input[data-imp-name]', box).forEach(inp => inp.addEventListener('input', () => { importState.units[Number(inp.dataset.impName)].name = inp.value; }));
    $$('input[data-imp-topic]', box).forEach(inp => inp.addEventListener('input', () => { importState.units[Number(inp.dataset.impTopic)].topic = inp.value; }));
    $('#btn-import-confirm').disabled = total === 0;
  }

  async function confirmImport() {
    const tid = $('#import-textbook').value;
    let tb = app.textbooks.find(t => t.id === tid);
    if (!tb) { toast('Bitte ein Lehrmittel wählen oder anlegen.'); return; }
    const mode = $('#import-mode').value;
    const units = importState.units.map(u => ({ name: (u.name || 'Unit 1').trim(), topic: (u.topic || '').trim(), words: u.words.map(w => ({ word: String(w.word).trim(), translation: String(w.translation || '').trim(), note: String(w.note || '').trim() })) }));
    tb = vocab.mergeUnits(tb, units, mode);
    for (const u of tb.units) if (!u.id) u.id = vocab.makeId('unit');
    await persistTextbook(tb);
    importState.units = null; $('#import-text').value = ''; $('#import-file').value = '';
    renderVocabManager();
    toast(`Import abgeschlossen (${mode === 'replace' ? 'ersetzt' : mode === 'update' ? 'aktualisiert' : 'hinzugefügt'}).`);
  }

  /* ------------------------------------------------------------------ */
  /* Materials library                                                     */
  /* ------------------------------------------------------------------ */

  function renderMaterials() {
    const el = $('#materials-list');
    const list = app.materials.slice().sort((a, b) => b.createdAt - a.createdAt);
    el.innerHTML = list.length ? list.map(m => { const s = quality.summarize((m.quality && m.quality.findings) || []); return `<div class="material-row"><div><strong>${esc(m.title)}</strong><div class="muted small">${m.kind === 'listening' ? 'Listening' : 'Reading'} · ${esc(m.plan.unitName)} · ${esc(m.plan.cefr)} · ${new Date(m.createdAt).toLocaleString()} · QC ${s.pass}/${s.pass + s.warn + s.fail + s.unverified}</div></div><div class="tb-actions"><button type="button" class="btn tiny" data-open="${esc(m.id)}">Öffnen</button><button type="button" class="btn tiny danger" data-del="${esc(m.id)}">Löschen</button></div></div>`; }).join('') : '<p class="muted">Noch keine Materialien gespeichert.</p>';
    $$('[data-open]', el).forEach(b => b.addEventListener('click', () => { const m = app.materials.find(x => x.id === b.dataset.open); app.material = m; openCreator(m.kind); renderOutput(m); }));
    $$('[data-del]', el).forEach(b => b.addEventListener('click', async () => { if (!confirm('Material löschen?')) return; await store.remove('materials', b.dataset.del); app.materials = await store.list('materials'); renderMaterials(); }));
  }

  /* ------------------------------------------------------------------ */
  /* Concept check page                                                    */
  /* ------------------------------------------------------------------ */

  function runConceptCheck() {
    const el = $('#check-results');
    const res = checks.run({ hasControl: sel => { try { return !!document.querySelector(sel); } catch (e) { return false; } }, pipelineSource: generate.toString(), pipeline: generate });
    const bySection = {};
    for (const r of res.results) (bySection[r.section] = bySection[r.section] || []).push(r);
    const SECTION_NAMES = { 0: 'Vollständigkeit', 1: 'Ziel der Anwendung', 2: 'Hauptnavigation', 3: 'Grundaufbau des Creators', 4: 'Source & Unit', 5: 'Content', 6: 'Language Level', 7: 'Vocabulary Settings', 8: 'Listening – Audio Structure', 9: 'Listening Presets', 10: 'Speaker Distribution', 11: 'Turn Length', 12: 'Audio Length', 13: 'Speaker Profiles', 14: 'Emotion & Delivery Tags', 15: 'Natural Speech Settings', 16: 'Information Explicitness', 17: 'Reading – Text Structure', 18: 'Worksheet', 19: 'Number of Questions', 20: 'Listening / Reading Skills', 21: 'Higher-Order Thinking', 22: 'Question Difficulty', 23: 'Automatic Skill Mix', 24: 'Manual Skill Mix', 25: 'Question Formats', 26: 'Question Order', 27: 'Pre-Listening / Pre-Reading', 28: 'Output', 29: 'Quality Check', 30: 'Advanced Settings', 31: 'Simple vs. Advanced Mode', 32: 'Beispielkonfiguration' };
    $('#check-summary').innerHTML = `<span class="big">${res.summary.pass} / ${res.summary.total}</span> Anforderungen bestanden` + (res.summary.fail ? ` · <span class="bad">${res.summary.fail} nicht bestanden</span>` : ' · alle Konzeptpunkte mit echten Funktionen belegt');
    el.innerHTML = Object.keys(bySection).sort((a, b) => Number(a) - Number(b)).map(sec => `<section class="check-section"><h3>§${sec} ${esc(SECTION_NAMES[sec] || '')} <span class="muted">${bySection[sec].filter(r => r.status === 'pass').length}/${bySection[sec].length}</span></h3><div class="table-wrap"><table class="check-table"><tbody>` + bySection[sec].map(r => `<tr class="qc-${r.status}"><td class="qc-status">${r.status}</td><td><code>${esc(r.id)}</code></td><td>${esc(r.title)}<div class="muted small">${esc(r.kind)}${r.key ? ' · ' + esc(r.key) : ''}</div></td><td class="muted">${esc(r.detail)}</td></tr>`).join('') + '</tbody></table></div></section>').join('');
  }

  /* ------------------------------------------------------------------ */
  /* Misc                                                                  */
  /* ------------------------------------------------------------------ */

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
  }

  function init() {
    buildForm();
    $$('[data-nav]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.nav;
      if (v === 'listening' || v === 'reading') openCreator(v); else showView(v);
    }));
    $$('#mode-toggle button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    $$('#output .tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $$('[data-download]').forEach(b => b.addEventListener('click', () => download(b.dataset.download)));
    $('#btn-print').addEventListener('click', () => window.print());
    $('#btn-load-example').addEventListener('click', () => { app.state = core.applyExampleConfig(app.state, app.textbooks); if (app.kind !== 'listening') { app.kind = 'listening'; document.body.dataset.kind = 'listening'; $('#creator-kind').textContent = 'Listening erstellen'; } fillForm(); onStateChange('preset'); setMode('advanced'); toast('Beispielkonfiguration aus dem Konzept (§32) geladen.'); });
    $('#btn-reset').addEventListener('click', () => { if (!confirm('Alle Einstellungen dieses Creators zurücksetzen?')) return; app.state = core.defaults(app.kind); if (app.textbooks[0]) { app.state.textbookId = app.textbooks[0].id; app.state.unitId = app.textbooks[0].units[0] ? app.textbooks[0].units[0].id : ''; } fillForm(); saveDraft(); });
    $('#btn-new-textbook').addEventListener('click', newTextbook);
    $('#import-file').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) readImportFile(f).catch(err => toast('Datei konnte nicht gelesen werden: ' + err.message)); });
    $('#btn-parse-text').addEventListener('click', parsePasted);
    $('#btn-parse-claude').addEventListener('click', parseWithClaude);
    $('#btn-import-confirm').addEventListener('click', confirmImport);
    $('#btn-run-check').addEventListener('click', runConceptCheck);
    let mode = 'simple'; try { mode = localStorage.getItem('lr:uimode') || 'simple'; } catch (e) { /* ignore */ }
    setMode(mode);
    app.textbooks = fixture.textbooks();
    fillTextbookSelect();
    updateClaudeStatus();
    showView('home');
    loadCapabilities();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.LR.ui = { app, generate, store, caps, showView, openCreator };
})();
