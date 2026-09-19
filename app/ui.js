/*
 * LRMaster ui — DOM, storage, Claude calls and the generation pipeline.
 * Everything didactic lives in the pure modules (core, prompts, quality,
 * render, vocab); this file wires them to the page and to the claude.ai
 * runtime capabilities (sample = Claude, db = storage, downloads = export).
 */
(function () {
  'use strict';
  const { core, prompts, quality, render, vocab, controls, checks, fixture, word, ooxml, level, mock } = window.LR;
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
    const detect = $('#btn-detect-units');
    if (detect) detect.disabled = !caps.sample || !importState.units;
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
        try {
          const snap = await caps.db.collection(coll).get();
          // Snapshots are frozen; hand out mutable copies so the app can edit them.
          return snap.docs.filter(d => d.exists).map(d => Object.assign(clone(d.data()), { id: d.id }));
        }
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
  function stripId(o) { const c = clone(o); delete c.id; return c; }
  function clone(v) { try { return JSON.parse(JSON.stringify(v === undefined ? null : v)); } catch (e) { return Object.assign({}, v); } }

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
    templateVariants: {}, // freshly drawn variants of the template cards, per session
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
    if (name === 'level') initLevelPage();
  }

  /**
   * The template gallery. A card is a complete configuration of every area,
   * written out in words underneath it. As long as a template is chosen, the
   * single settings stay folded away; "Vorlage anpassen" opens them with the
   * template's values, "Alles selbst einstellen" opens them from scratch.
   */
  function renderSetupBar() {
    const s = app.state;
    const box = $('#setup-presets');
    if (!box) return;
    const custom = s.setupMode === 'custom';
    const active = custom ? null : core.activeSetupPreset(s);
    document.body.dataset.setup = custom ? 'custom' : 'preset';

    box.hidden = custom;
    box.innerHTML = custom ? '' : core.setupPresets(s.kind).map(p => {
      const cardState = templateState(p.key);
      const v = app.templateVariants[p.key];
      return `<div class="setup-card${p.key === active ? ' active' : ''}" data-card="${esc(p.key)}">
        <button type="button" class="sc-pick" data-setup-preset="${esc(p.key)}">
          <span class="sc-title">${esc(v && v.label ? v.label : p.label)}</span>
          <span class="sc-tags">${core.tagsFor(cardState, ctx()).map(t => `<span class="sc-tag">${esc(t)}</span>`).join('')}</span>
          <span class="sc-blurb">${esc(v && v.blurb ? v.blurb : p.blurb)}</span>
          <ul class="sc-list">${core.describeSetup(cardState, ctx()).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
        </button>
        <button type="button" class="sc-redo" data-redo="${esc(p.key)}" title="Neue Variante dieser Vorlage von Claude vorschlagen lassen" aria-label="Vorlage neu laden"${caps.sample ? '' : ' disabled'}>↻</button>
      </div>`;
    }).join('');
    $$('#setup-presets [data-setup-preset]').forEach(b => b.addEventListener('click', () => {
      app.state = applyTemplate(b.dataset.setupPreset);
      fillForm();
      onStateChange('setupMode');
    }));
    $$('#setup-presets [data-redo]').forEach(b => b.addEventListener('click', () => redrawTemplate(b.dataset.redo, b)));

    $('#setup-title').textContent = custom ? 'Eigene Einstellungen' : 'Vorlage wählen';
    $('#setup-hint').textContent = custom
      ? 'Alle Bereiche sind unten geöffnet.'
      : active ? (core.setupPresets(s.kind).find(p => p.key === active) || {}).blurb
        : 'Noch keine Vorlage gewählt – wähle eine Karte oder stelle alles selbst ein.';
    $('#btn-setup-adapt').hidden = custom || !active;
    $('#btn-setup-custom').hidden = custom;
    $('#btn-setup-back').hidden = !custom;

    const bullets = core.describeSetup(s, ctx());
    $('#setup-summary').innerHTML = `<div class="ss-head">Das wird erzeugt</div><ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
  }

  /** The settings a template card stands for, including a drawn variant. */
  function templateState(key) {
    const base = core.applySetupPreset(app.state, key);
    const v = app.templateVariants[key];
    return v ? core.applyTemplateVariant(base, v.settings) : base;
  }
  /** Put a template (with its variant, if one was drawn) into the form. */
  function applyTemplate(key) {
    const next = templateState(key);
    next.setupMode = 'preset';
    return core.normalizeState(next);
  }

  /**
   * Let Claude draw a fresh variant of one card: another content idea in the
   * same spirit. Only the allowed dials are taken over, and only if the
   * result is a valid configuration — otherwise the card stays as it was.
   */
  async function redrawTemplate(key, button) {
    if (!caps.sample) { toast(ERROR_COPY.not_granted); return; }
    const preset = core.setupPresets(app.state.kind).find(p => p.key === key);
    if (!preset) return;
    const card = button.closest('.setup-card');
    card.classList.add('loading');
    button.disabled = true;
    try {
      const base = core.applySetupPreset(app.state, key);
      const prompt = prompts.buildTemplateVariantPrompt(preset, base, ctx());
      const raw = await askJSON(prompt, {});
      const candidate = core.applyTemplateVariant(base, raw);
      const errors = core.validateState(candidate, ctx());
      if (errors.length) { toast('Vorschlag passte nicht: ' + errors[0].message); return; }
      app.templateVariants[key] = {
        label: String((raw && raw.label) || '').trim().slice(0, 40) || preset.label,
        blurb: String((raw && raw.blurb) || '').trim().slice(0, 140) || preset.blurb,
        settings: raw,
      };
      if (core.activeSetupPreset(app.state) === key || app.state.setupMode === 'preset') {
        // the card the teacher is on follows the new draw straight away
        if (core.activeSetupPreset(app.state) === key) { app.state = applyTemplate(key); fillForm(); }
      }
      onStateChange('setupMode');
      toast('Neue Variante: ' + app.templateVariants[key].label);
    } catch (e) {
      if (e.code !== 'cancelled') toast('Variante nicht möglich: ' + errorCopy(e));
    } finally {
      card.classList.remove('loading');
      button.disabled = !caps.sample;
    }
  }

  /** Fold the single settings away again; the chosen values stay. */
  function backToTemplates() {
    app.state.setupMode = 'preset';
    fillForm();
    onStateChange('setupMode');
    const bar = $('#setup-bar');
    if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Open every setting; `fresh` starts from the defaults instead of the template. */
  function openCustomSetup(fresh) {
    if (fresh) {
      const kind = app.state.kind;
      const keep = { textbookId: app.state.textbookId, unitId: app.state.unitId };
      app.state = core.normalizeState(Object.assign(core.defaults(kind), keep, { setupMode: 'custom' }));
    } else {
      app.state.setupMode = 'custom';
    }
    setMode('advanced');
    fillForm();
    onStateChange('setupMode');
    const first = $('#sec-content');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    // Lehrmittel and unit come first — the template gallery sits right below them.
    const form = $('#creator-form'), bar = $('#setup-bar'), afterSource = $('#sec-content');
    if (form && bar && afterSource) form.insertBefore(bar, afterSource);
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
    $('#btn-setup-adapt').addEventListener('click', () => openCustomSetup(false));
    $('#btn-setup-custom').addEventListener('click', () => openCustomSetup(true));
    $('#btn-setup-back').addEventListener('click', backToTemplates);
    $$('[data-task-preset]').forEach(b => b.addEventListener('click', () => {
      const phase = b.dataset.taskPhase;
      app.state = core.applyTaskPreset(app.state, phase, b.dataset.taskPreset);
      fillForm();
      onStateChange(phase + 'Task');
    }));
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
      case 'customPreTaskSocial':
      case 'customPostTaskSocial': {
        const phase = key === 'customPostTaskSocial' ? 'post' : 'pre';
        const sumId = 'social-sum-' + phase;
        body.innerHTML = '<div class="mix-grid">' + core.SOCIAL_FORMS.map(fm => `<label><span>${esc(fm.label)}</span><input type="number" min="0" max="6" data-social="${fm.key}" value="${Number((s[key] || {})[fm.key]) || 0}"></label>`).join('') + `</div><div class="share-sum"><span id="${sumId}"></span></div>`;
        const upd = () => {
          const sum = core.SOCIAL_FORM_KEYS.reduce((a, k) => a + (Number(s[key][k]) || 0), 0);
          const n = core.taskCount(s, phase);
          const inter = ['pair', 'group', 'plenary'].reduce((a, k) => a + (Number(s[key][k]) || 0), 0);
          const oral = Number(phase === 'post' ? s.postTaskOralCount : s.preTaskOralCount) || 0;
          const e = $('#' + sumId);
          e.textContent = `Summe: ${sum} von ${n} Aufgaben · ${inter} interaktiv (mündlich möglich: ${inter})`;
          e.classList.toggle('bad', sum !== n || oral > inter);
        };
        $$('input[data-social]', body).forEach(inp => inp.addEventListener('input', () => { s[key][inp.dataset.social] = Number(inp.value); upd(); onStateChange(key); }));
        upd();
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
    const PRE_KEYS = ['preTaskFocus', 'preTaskCount', 'preTaskTypes', 'preTaskSocialMode', 'customPreTaskSocial', 'preTaskOralCount', 'preTaskDifficulty', 'preTaskLevel', 'preTaskScaffolding', 'preTaskCriteria', 'preTaskMinutes'];
    const POST_KEYS = PRE_KEYS.map(k => k.replace(/^preTask/, 'postTask').replace(/^customPreTaskSocial$/, 'customPostTaskSocial'));
    for (const k of ['questionCount', 'questionCountCustom', 'questionDifficulty', 'questionLevel', 'glossary', 'appendScript', 'skillMixMode', 'customSkillMix', 'questionFormats', 'autoFormatMix', 'higherOrder', 'higherOrderCount', 'higherOrderTypes', 'preTask', 'postTask', 'distractorDifficulty', 'inferenceLevel'].concat(PRE_KEYS, POST_KEYS)) show(k, s.createWorksheet);
    if (s.createWorksheet) {
      show('questionCountCustom', s.questionCount === 'custom');
      // a question level fixes the difficulty; the slider only applies without one
      show('questionDifficulty', !core.QUESTION_LEVELS[s.questionLevel] && s.questionLevel !== 'both');
      show('customSkillMix', s.skillMixMode === 'custom');
      show('higherOrderCount', s.higherOrder); show('higherOrderTypes', s.higherOrder);
      for (const k of PRE_KEYS) show(k, s.preTask);
      for (const k of POST_KEYS) show(k, s.postTask);
      show('customPreTaskSocial', s.preTask && s.preTaskSocialMode === 'custom');
      show('customPostTaskSocial', s.postTask && s.postTaskSocialMode === 'custom');
      for (const phase of ['pre', 'post']) {
        const ph = core.TASK_PHASES[phase];
        if (!s[ph.prefix]) continue;
        const n = core.taskCount(s, phase);
        const oralEl = $('#set-' + ph.prefix + 'OralCount');
        if (oralEl) oralEl.max = n;
        // more oral tasks than tasks cannot be meant: cap it silently
        if ((Number(s[ph.prefix + 'OralCount']) || 0) > n) {
          s[ph.prefix + 'OralCount'] = n;
          if (oralEl) oralEl.value = n;
        }
      }
    }
    // topicMode select is only meaningful when the unit topic is ON
    const tm = $('#set-topicMode'); if (tm) { tm.disabled = !s.useUnitTopic; if (!s.useUnitTopic) { s.topicMode = 'custom'; tm.value = 'custom'; } }
    // who_said_it only for multi-speaker listening
    const who = $('input[data-multi="questionFormats"][value="who_said_it"]'); if (who) who.closest('.chip').classList.toggle('disabled', !(s.kind === 'listening' && core.effectiveSpeakerCount(s) >= 2));
    // labels
    for (const phase of ['pre', 'post']) renderTaskPreview(phase);
    renderSetupBar();
    const est = $('#audio-estimate');
    if (est && s.kind === 'listening') est.textContent = `≈ ${core.targetWordCount(s)} Wörter bei ${core.wordsPerMinute(s.speakingSpeed)} Wörtern/Minute für ${Math.round(core.audioSeconds(s) / 60 * 10) / 10} min`;
    renderPlanPreview();
  }

  /**
   * What the chosen settings will produce in one task phase: the sequence
   * with social form, working mode and minutes, plus the problems a teacher
   * should see before generating rather than after.
   */
  function renderTaskPreview(phase) {
    const box = $('#' + phase + '-task-preview');
    if (!box) return;
    const s = app.state;
    const ph = core.TASK_PHASES[phase];
    const label = phase === 'post' ? 'Post-Task' : 'Pre-Task';
    $$(`[data-task-preset][data-task-phase="${phase}"]`).forEach(b => b.classList.toggle('active', b.dataset.taskPreset === core.activeTaskPreset(s, phase)));
    if (!s.createWorksheet) { box.innerHTML = `<p class="muted">Kein Arbeitsblatt gewählt – ${label} entfällt.</p>`; return; }
    if (!s[ph.prefix]) { box.innerHTML = `<p class="muted">${label} ist aus. Wähle oben eine Schnellwahl – oder schalte sie im Advanced Mode ein und stelle alles einzeln ein.</p>`; return; }
    const plan = core.buildTaskPlan(s, phase);
    if (!plan || !plan.count) { box.innerHTML = '<p class="bad">Bitte mindestens einen Aufgabentyp wählen.</p>'; return; }
    const types = phase === 'post' ? core.POST_TASK_TYPES : core.PRE_TASK_TYPES;
    const typeLabel = (k) => { const t = types.find(x => x.key === k); return t ? t.label : k; };
    const rows = plan.tasks.map(t => `<li><span class="tp-n">${t.n}</span><span class="tp-type">${esc(typeLabel(t.type))}</span>`
      + `<span class="tp-social">${esc(core.SOCIAL_FORMS.find(f => f.key === t.socialForm).label)}</span>`
      + `<span class="tp-mode ${t.mode}">${t.mode === 'oral' ? 'mündlich' : 'schriftlich'}</span>`
      + `<span class="tp-min">${t.minutes} min</span></li>`).join('');
    const problems = core.validateState(s, ctx()).filter(e => e.key.toLowerCase().includes(phase + 'task'));
    box.innerHTML = `<div class="tp-head">So wird die ${label} geplant <span class="muted">· ${plan.count} Aufgabe(n) · ${plan.minutes} min · Sprache ${esc(plan.band)} · Anforderung ${plan.difficulty}/100${plan.criteria ? ' · mit Gelingenskriterien' : ''}</span></div>`
      + `<ol class="tp-list">${rows}</ol>`
      + problems.map(e => `<p class="bad small">${esc(e.message)}</p>`).join('');
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
      plan.questionCount ? ['Fragen', `${plan.questionCount} · ${plan.questionLevelLabel ? plan.questionLevelLabel + ' (' + plan.questionBands.join('–') + ')' : 'Niveau ' + plan.questionBand} · ` + core.SKILLS.filter(sk => plan.skillMix[sk.key]).map(sk => `${plan.skillMix[sk.key]} × ${sk.short}`).join(', '), ''] : ['Worksheet', 'aus – nur Skript/Text', ''],
      plan.questionCount ? ['Formate', (plan.formatSequence ? 'Balanced mix: ' : 'frei aus: ') + plan.formats.map(f => core.QUESTION_FORMATS.find(x => x.key === f).label).join(', '), ''] : null,
      plan.higherOrderCount ? ['Higher-Order', `${plan.higherOrderCount} × ${plan.higherOrderTypes.join('/')}`, ''] : null,
      plan.preTask ? ['Pre-Task', `${plan.preTask.count} Aufgabe(n) · ${plan.preTask.minutes} min · ${plan.preTask.oralCount} mündlich`, plan.preTask.types.join(', ')] : null,
      plan.postTask ? ['Post-Task', `${plan.postTask.count} Aufgabe(n) · ${plan.postTask.minutes} min · ${plan.postTask.oralCount} mündlich`, plan.postTask.types.join(', ')] : null,
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
    ['plan', 'Plan & Validierung'], ['content', 'Skript / Text schreiben'], ['content-check', 'Content prüfen'], ['content-fix', 'Content korrigieren'],
    ['questions', 'Aufgaben erstellen'], ['question-check', 'Aufgaben prüfen'], ['review', 'Claude-Review'], ['question-fix', 'Aufgaben korrigieren'], ['pretask-fix', 'Pre-Task korrigieren'], ['posttask-fix', 'Post-Task korrigieren'], ['glossary', 'Fremdwörter erklären'], ['layout', 'Layout des Mediums'], ['done', 'Ausgabe'],
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

  function summaryText(findings) {
    const s = quality.summarize(findings);
    return `${s.pass} ok · ${s.warn} Warnungen · ${s.fail} Fehler`;
  }
  function findingsLabel(items) {
    return items.slice(0, 2).map(f => f.title).join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '');
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
    const repairs = [];
    const usedPrompts = {};
    const maxRounds = state.autoFix === 'off' ? 0 : Math.max(1, Math.min(4, Number(state.autoFixRounds) || 2));
    const stream = { onText: ({ text }) => streamPreview(text) };
    const run = { state, c, ctl, stream, maxRounds, usedPrompts, repairs };

    try {
      /* 1. Plan — one worksheet plan per question level (Niveau A / B / both) */
      progress('plan', 'running');
      const variants = core.questionVariants(state);
      const plans = variants.map(v => core.buildPlan(core.variantState(state, v), c));
      const plan = plans[0];
      progress('plan', 'done', `${plan.targetWords} Wörter · ${plan.questionCount} Fragen` + (variants.length > 1 ? ' · Niveau A und B' : plan.questionLevel ? ' · ' + plan.questionLevelLabel : ''));

      /* 2. Content */
      progress('content', 'running', 'Claude schreibt …');
      usedPrompts.content = prompts.buildContentPrompt(state, plan);
      let content = quality.normalizeContent(await askJSON(usedPrompts.content, Object.assign({ signal: ctl.signal }, stream)), state, plan);
      progress('content', 'done', `„${content.title}“`);

      /* 3. Measure the content (length, shares, vocabulary, difficulty meter) and repair it until it stops improving */
      progress('content-check', 'running');
      let contentFindings = quality.runContentChecks(state, plan, content);
      progress('content-check', quality.repairable(contentFindings, state.autoFix).length ? 'warn' : 'done', summaryText(contentFindings) + levelNote(contentFindings));
      for (let round = 1; round <= maxRounds; round++) {
        const rp = quality.repairPlan(contentFindings, state.autoFix);
        if (!rp.items.length) break;
        progress('content-fix', 'running', `Runde ${round}: ${findingsLabel(rp.items)}`);
        usedPrompts['contentRepair' + round] = prompts.buildContentRevisionPrompt(state, plan, content, rp.items);
        let candidate;
        try { candidate = quality.normalizeContent(await askJSON(usedPrompts['contentRepair' + round], Object.assign({ signal: ctl.signal }, stream)), state, plan); }
        catch (e) { if (e.code === 'cancelled') throw e; progress('content-fix', 'warn', errorCopy(e)); break; }
        const candFindings = quality.runContentChecks(state, plan, candidate);
        const better = quality.problemScore(candFindings) < quality.problemScore(contentFindings);
        repairs.push({ round, target: 'content', fixed: rp.items.map(f => f.title), accepted: better });
        if (!better) { progress('content-fix', 'done', `Runde ${round}: keine Verbesserung, erste Fassung behalten`); break; }
        content = candidate; contentFindings = candFindings;
        progress('content-fix', 'done', `Runde ${round}: ${summaryText(contentFindings)}${levelNote(contentFindings)}`);
      }
      if (!repairs.some(r => r.target === 'content')) progress('content-fix', 'skip', maxRounds ? 'nicht nötig' : 'automatische Korrektur aus');

      /* 3b. The medium the text really comes from (reading): Claude designs the
         interface, the app draws the picture and checks that it shows the text. */
      let layout = null, layoutFindings = [];
      if (plan.authenticLayout) {
        const spec = mock.chromeSpec({ settings: state, content });
        progress('layout', 'running', `Claude gestaltet ${spec.label} …`);
        try {
          usedPrompts.layout = prompts.buildLayoutPrompt(state, plan, content, spec);
          let chrome = quality.normalizeChrome(await askJSON(usedPrompts.layout, { signal: ctl.signal }), spec);
          const check = (c) => quality.runContentChecks(state, plan, content, { layout: { chrome: c } }).filter(f => f.group === 'layout');
          layoutFindings = check(chrome);
          for (let round = 1; round <= maxRounds; round++) {
            const items = quality.repairable(layoutFindings, state.autoFix);
            if (!items.length) break;
            progress('layout', 'running', `Runde ${round}: ${findingsLabel(items)}`);
            usedPrompts['layoutRepair' + round] = prompts.buildLayoutRepairPrompt(state, plan, content, chrome, items, spec);
            const cand = quality.normalizeChrome(await askJSON(usedPrompts['layoutRepair' + round], { signal: ctl.signal }), spec);
            const candFindings = check(cand);
            const better = quality.problemScore(candFindings) < quality.problemScore(layoutFindings);
            repairs.push({ round, target: 'layout', fixed: items.map(f => f.title), accepted: better });
            if (!better) break;
            chrome = cand; layoutFindings = candFindings;
          }
          layout = { chrome, kind: spec.kind, label: spec.label };
          progress('layout', quality.repairable(layoutFindings, state.autoFix).length ? 'warn' : 'done', `${spec.label} · ${summaryText(layoutFindings)}`);
        } catch (e) {
          if (e.code === 'cancelled') throw e;
          progress('layout', 'warn', errorCopy(e));
        }
      } else progress('layout', 'skip', state.kind === 'reading' ? 'nicht gewählt' : 'nur für Reading');

      /* 4. Worksheet(s): one per question level */
      const results = [];
      let glossary = null;
      run.layout = layout;
      if (state.createWorksheet) {
        for (let vi = 0; vi < plans.length; vi++) {
          const variant = variants[vi];
          const r = await produceWorksheet(run, core.variantState(state, variant), plans[vi], content, contentFindings, {
            tag: variant ? variant.key : '', allowContentRedo: vi === 0,
          });
          if (r.content !== content) { content = r.content; contentFindings = r.contentFindings; }
          results.push(r);
        }
        /* 4b. Glossary: the meter picks the hard words, Claude explains them */
        if (plan.glossary) {
          progress('glossary', 'running', 'Claude erklärt Fremdwörter …');
          try {
            const measured = level.measure(content, state.kind, { seconds: plan.seconds, exclude: plan.vocabulary.map(w => w.word) });
            const candidates = level.glossaryCandidates(measured, plan.cefr, 12);
            if (candidates.length) {
              usedPrompts.glossary = prompts.buildGlossaryPrompt(state, plan, content, candidates);
              glossary = quality.normalizeGlossary(await askJSON(usedPrompts.glossary, { signal: ctl.signal }));
              progress('glossary', 'done', `${glossary.length} Wörter erklärt`);
            } else { glossary = []; progress('glossary', 'done', 'keine schweren Wörter über dem Niveau'); }
          } catch (e) { if (e.code === 'cancelled') throw e; glossary = []; progress('glossary', 'warn', errorCopy(e)); }
        } else progress('glossary', 'skip', 'nicht gewählt');
      } else {
        for (const st of ['questions', 'question-check', 'review', 'question-fix', 'pretask-fix', 'posttask-fix', 'glossary']) progress(st, 'skip', 'kein Worksheet');
      }

      /* 5. Assemble */
      progress('done', 'running');
      const contentOnlyReview = !state.createWorksheet ? await reviewContentOnly(state, plan, content, contentFindings, ctl, layout).catch(() => []) : [];
      const variantsOut = results.map((r, i) => ({
        key: variants[i] ? variants[i].key : null, label: variants[i] ? variants[i].label : '',
        plan: plans[i], worksheet: r.worksheet,
        quality: { findings: r.questionFindings.concat(r.reviewFindings), review: r.review },
      }));
      const findingsAll = contentFindings.concat(
        variantsOut.flatMap(v => v.quality.findings.map(f => v.key ? Object.assign({}, f, { variant: v.key }) : f)),
        layoutFindings, contentOnlyReview);
      const levelFinding = contentFindings.find(f => f.id === 'content.level_measured' && f.measured);
      const vm = quality.vocabMatches(quality.materialText(content, state.kind).text, plan.vocabulary);
      const material = {
        id: vocab.makeId('mat'), createdAt: Date.now(), kind: state.kind, title: (results[0] && results[0].worksheet && results[0].worksheet.title) || content.title,
        settings: state, plan, content, worksheet: results[0] ? results[0].worksheet : null,
        variants: variantsOut, glossary, layout, level: levelFinding ? levelFinding.measured : null,
        vocabFound: vm.found, vocabMissing: vm.missing,
        quality: { findings: findingsAll, review: results[0] ? results[0].review : null, repairs, durationMs: Date.now() - t0 }, prompts: usedPrompts,
      };
      app.material = material;
      await store.put('materials', material);
      renderOutput(material);
      const open = quality.repairable(findingsAll, state.autoFix === 'off' ? 'all' : state.autoFix).length;
      progress('done', open ? 'warn' : 'done', `${Math.round((Date.now() - t0) / 1000)} s · ${summaryText(findingsAll)}`);
      const fixedCount = repairs.filter(r => r.accepted).length;
      toast(fixedCount ? `Material erstellt · ${fixedCount} Korrekturrunde(n) angewendet.` : 'Material erstellt und gespeichert.');
    } catch (e) {
      if (e && e.code === 'cancelled') { toast('Generierung abgebrochen.'); progress('done', 'warn', 'abgebrochen'); }
      else { console.error(e); toast('Fehler: ' + errorCopy(e)); progress('done', 'fail', errorCopy(e)); }
    } finally {
      app.running = null; $('#btn-stop').hidden = true; renderPlanPreview();
    }
  }

  /** Everything the worksheet stage owns: the questions and the pre-task. */
  function isWorksheetGroup(f) { return f.group === 'questions' || f.group === 'pretask' || f.group === 'posttask'; }

  /** The measured band, for the progress line. */
  function levelNote(findings) {
    const f = (findings || []).find(x => x.id === 'content.level_measured' && x.measured);
    return f ? ` · gemessen ${f.measured.band}` : '';
  }

  /**
   * Questions for one worksheet variant: write, put into timeline order,
   * measure, let Claude review, and repair until the check stops improving.
   * Returns the worksheet with its findings; `content` comes back replaced
   * when a failed content rule forced a rewrite of text and worksheet.
   */
  async function produceWorksheet(run, state, plan, content, contentFindings, opts) {
    const { ctl, stream, maxRounds, usedPrompts, repairs } = run;
    const tag = opts.tag || '';
    const pfx = tag ? `Niveau ${tag}: ` : '';
    const key = (name) => name + (tag || '');
    const reviewNow = async (ws, det, suffix) => {
      const rules = quality.llmRules(state, plan, ws, { layout: run.layout });
      usedPrompts[key('review' + suffix)] = prompts.buildReviewPrompt(state, plan, content, ws, rules, det, run.layout);
      const res = await askJSON(usedPrompts[key('review' + suffix)], { signal: ctl.signal });
      return { review: res, findings: quality.mergeReview(rules, res) };
    };
    // Every worksheet that arrives is put into the timeline of the material first (concept §26 — always).
    const inOrder = (ws, round, cont) => {
      const r = quality.enforceChronology(ws, cont || content, state.kind);
      if (r.changed) repairs.push({ round, target: 'order', questions: r.moved, fixed: ['Questions follow the timeline of the audio/text'], accepted: true, variant: tag || undefined });
      return r.worksheet;
    };

    progress('questions', 'running', pfx + 'Claude schreibt Aufgaben …');
    usedPrompts[key('questions')] = prompts.buildQuestionPrompt(state, plan, content);
    let worksheet = inOrder(quality.normalizeWorksheet(await askJSON(usedPrompts[key('questions')], Object.assign({ signal: ctl.signal }, stream))), 0);
    progress('questions', 'done', `${pfx}${worksheet.questions.length} Fragen`);

    progress('question-check', 'running');
    let questionFindings = quality.runDeterministic(state, plan, content, worksheet).filter(f => isWorksheetGroup(f));
    progress('question-check', quality.repairable(questionFindings, state.autoFix).length ? 'warn' : 'done', pfx + summaryText(questionFindings));

    let review = null, reviewFindings = [];
    progress('review', 'running', pfx + 'Claude prüft …');
    try {
      const r = await reviewNow(worksheet, contentFindings.concat(questionFindings), '1');
      review = r.review; reviewFindings = r.findings;
      progress('review', quality.repairable(reviewFindings, state.autoFix).length ? 'warn' : 'done', pfx + summaryText(reviewFindings));
    } catch (e) {
      if (e.code === 'cancelled') throw e;
      reviewFindings = quality.mergeReview(quality.llmRules(state, plan, worksheet), null);
      progress('review', 'warn', pfx + errorCopy(e));
    }

    /* Repair loop: replace the questions a check complained about. */
    let findings = questionFindings.concat(reviewFindings);
    let contentRedone = !opts.allowContentRedo;
    const givenUp = { pre: false, post: false };
    for (let round = 1; round <= maxRounds; round++) {
      const rp = quality.repairPlan(findings, state.autoFix);
      if (!rp.items.length) break;

      // A failed content rule cannot be fixed by rewriting a question: redo
      // the text and the whole worksheet once, then carry on.
      const contentFails = rp.content.filter(f => f.status === 'fail');
      if (contentFails.length && !contentRedone) {
        contentRedone = true;
        progress('content-fix', 'running', `Runde ${round}: ${findingsLabel(contentFails)} → Text und Aufgaben neu`);
        try {
          usedPrompts[key('contentRedo')] = prompts.buildContentRevisionPrompt(state, plan, content, contentFails);
          const newContent = quality.normalizeContent(await askJSON(usedPrompts[key('contentRedo')], Object.assign({ signal: ctl.signal }, stream)), state, plan);
          const newContentFindings = quality.runContentChecks(state, plan, newContent);
          usedPrompts[key('questionsRedo')] = prompts.buildQuestionPrompt(state, plan, newContent);
          const newWorksheet = inOrder(quality.normalizeWorksheet(await askJSON(usedPrompts[key('questionsRedo')], Object.assign({ signal: ctl.signal }, stream))), round, newContent);
          const newDet = quality.runDeterministic(state, plan, newContent, newWorksheet).filter(f => isWorksheetGroup(f));
          const r = await reviewNow(newWorksheet, newContentFindings.concat(newDet), 'Redo');
          const candAll = newContentFindings.concat(newDet, r.findings);
          const better = quality.problemScore(candAll) < quality.problemScore(contentFindings.concat(findings));
          repairs.push({ round, target: 'content+worksheet', fixed: contentFails.map(f => f.title), accepted: better, variant: tag || undefined });
          if (better) {
            content = newContent; contentFindings = newContentFindings; worksheet = newWorksheet;
            questionFindings = newDet; reviewFindings = r.findings; review = r.review;
            findings = newDet.concat(r.findings);
            progress('content-fix', 'done', `Runde ${round}: Text und Aufgaben ersetzt`);
            continue;
          }
          progress('content-fix', 'done', `Runde ${round}: keine Verbesserung, erste Fassung behalten`);
        } catch (e) { if (e.code === 'cancelled') throw e; progress('content-fix', 'warn', errorCopy(e)); }
      }

      // Pre- and post-task are repaired on their own: the questions stay untouched.
      for (const phase of ['pre', 'post']) {
        const items = phase === 'pre' ? rp.preTasks : rp.postTasks;
        if (!items.length || givenUp[phase]) continue;
        const step = phase + 'task-fix';
        const L = phase === 'pre' ? 'Pre-Task' : 'Post-Task';
        const mark = phase === 'pre' ? 'P' : 'T';
        progress(step, 'running', `${pfx}Runde ${round}: ${findingsLabel(items)}`);
        try {
          const promptKey = key(phase + 'TaskRepair' + round);
          usedPrompts[promptKey] = prompts.buildTaskRepairPrompt(state, plan, content, worksheet, items, review && review.fixInstructions, phase);
          const patch = await askJSON(usedPrompts[promptKey], Object.assign({ signal: ctl.signal }, stream));
          const candidate = quality.applyTaskPatch(worksheet, patch, phase);
          const changedTasks = candidate === worksheet ? [] : quality.changedTasks(worksheet, candidate, phase);
          if (!changedTasks.length) { givenUp[phase] = true; progress(step, 'warn', `${pfx}Runde ${round}: keine neuen ${L}-Aufgaben erhalten`); continue; }
          const candDet = quality.runDeterministic(state, plan, content, candidate).filter(f => isWorksheetGroup(f));
          let candReview = review, candLlm = reviewFindings;
          try { const r = await reviewNow(candidate, contentFindings.concat(candDet), (phase === 'pre' ? 'P' : 'T') + round); candReview = r.review; candLlm = r.findings; }
          catch (e) { if (e.code === 'cancelled') throw e; }
          const candFindings = candDet.concat(candLlm);
          const better = quality.problemScore(candFindings) < quality.problemScore(findings);
          repairs.push(Object.assign({ round, target: phase + 'task', fixed: items.map(f => f.title), accepted: better, variant: tag || undefined },
            phase === 'pre' ? { preTasks: changedTasks } : { postTasks: changedTasks }));
          if (better) {
            worksheet = candidate; questionFindings = candDet; reviewFindings = candLlm; review = candReview; findings = candFindings;
            progress(step, 'done', `${pfx}Runde ${round}: ${mark}${changedTasks.join(', ' + mark)} ersetzt · ${summaryText(findings)}`);
          } else { givenUp[phase] = true; progress(step, 'done', `${pfx}Runde ${round}: keine Verbesserung, vorige Fassung behalten`); }
        } catch (e) { if (e.code === 'cancelled') throw e; givenUp[phase] = true; progress(step, 'warn', pfx + errorCopy(e)); }
      }

      if (!rp.questions.length && !rp.worksheet.length) {
        if ((rp.preTasks.length && !givenUp.pre) || (rp.postTasks.length && !givenUp.post)) continue;
        break;
      }
      const targeted = rp.questions.length > 0 && rp.worksheet.length === 0;
      progress('question-fix', 'running', `${pfx}Runde ${round}: ${findingsLabel(rp.items)}` + (targeted ? ` · Q${rp.questions.join(', Q')}` : ' · Aufgaben neu'));
      let candidate;
      try {
        if (targeted) {
          usedPrompts[key('questionRepair' + round)] = prompts.buildQuestionRepairPrompt(state, plan, content, worksheet, rp.items, rp.questions, review && review.fixInstructions);
          const patch = await askJSON(usedPrompts[key('questionRepair' + round)], Object.assign({ signal: ctl.signal }, stream));
          const list = Array.isArray(patch) ? patch : (patch && patch.questions) || [];
          candidate = quality.applyQuestionPatch(worksheet, list);
          if (candidate === worksheet) { progress('question-fix', 'warn', `${pfx}Runde ${round}: keine Ersatzfragen erhalten`); break; }
        } else {
          usedPrompts[key('questionRevision' + round)] = prompts.buildQuestionRevisionPrompt(state, plan, content, worksheet, rp.items, review && review.fixInstructions);
          candidate = quality.normalizeWorksheet(await askJSON(usedPrompts[key('questionRevision' + round)], Object.assign({ signal: ctl.signal }, stream)));
        }
      } catch (e) { if (e.code === 'cancelled') throw e; progress('question-fix', 'warn', pfx + errorCopy(e)); break; }
      candidate = inOrder(candidate, round);

      const candDet = quality.runDeterministic(state, plan, content, candidate).filter(f => isWorksheetGroup(f));
      let candReview = review, candLlm = reviewFindings;
      try {
        const r = await reviewNow(candidate, contentFindings.concat(candDet), 'R' + round);
        candReview = r.review; candLlm = r.findings;
      } catch (e) { if (e.code === 'cancelled') throw e; }
      const candFindings = candDet.concat(candLlm);
      const changed = quality.changedQuestions(worksheet, candidate);
      const better = quality.problemScore(candFindings) < quality.problemScore(findings);
      repairs.push({ round, target: targeted ? 'questions' : 'worksheet', questions: changed, fixed: rp.items.map(f => f.title), accepted: better, variant: tag || undefined });
      if (!better) { progress('question-fix', 'done', `${pfx}Runde ${round}: keine Verbesserung, vorige Fassung behalten`); break; }
      worksheet = candidate; questionFindings = candDet; reviewFindings = candLlm; review = candReview; findings = candFindings;
      progress('question-check', quality.repairable(questionFindings, state.autoFix).length ? 'warn' : 'done', pfx + summaryText(questionFindings));
      progress('review', quality.repairable(reviewFindings, state.autoFix).length ? 'warn' : 'done', pfx + summaryText(reviewFindings));
      progress('question-fix', 'done', `${pfx}Runde ${round}: ${changed.length ? 'Q' + changed.join(', Q') + ' ersetzt · ' : ''}${summaryText(findings)}`);
    }
    if (!repairs.some(r => r.variant === (tag || undefined) && (r.target === 'questions' || r.target === 'worksheet'))) {
      progress('question-fix', 'skip', maxRounds ? pfx + 'nicht nötig' : 'automatische Korrektur aus');
    }
    for (const phase of ['pre', 'post']) {
      if (repairs.some(r => r.variant === (tag || undefined) && r.target === phase + 'task')) continue;
      const planned = phase === 'pre' ? plan.preTask : plan.postTask;
      progress(phase + 'task-fix', 'skip', !planned ? (phase === 'pre' ? 'keine Pre-Task' : 'keine Post-Task') : maxRounds ? pfx + 'nicht nötig' : 'automatische Korrektur aus');
    }
    return { worksheet, questionFindings, reviewFindings, review, content, contentFindings };
  }
  /* end generate */

  async function reviewContentOnly(state, plan, content, contentFindings, ctl, layout) {
    const rules = quality.llmRules(state, plan, null, { layout });
    const review = await askJSON(prompts.buildReviewPrompt(state, plan, content, null, rules, contentFindings, layout), { signal: ctl.signal });
    return quality.mergeReview(rules, review);
  }

  /* ------------------------------------------------------------------ */
  /* Output                                                                */
  /* ------------------------------------------------------------------ */

  function renderOutput(m) {
    const out = $('#output');
    out.hidden = false;
    $('#out-title').textContent = m.title;
    const variants = render.variantsOf(m).filter(v => v.worksheet);
    const multi = variants.length > 1;
    // Student version: one sheet per question level, switchable
    $('#out-student').innerHTML = (multi ? '<div class="variant-switch" role="tablist">' + variants.map((v, i) => `<button type="button" class="chip-btn${i ? '' : ' active'}" data-variant="${esc(v.key)}">${esc(v.label)} · ${esc((v.plan || m.plan).questionBands ? (v.plan || m.plan).questionBands.join('–') : (v.plan || m.plan).questionBand)}</button>`).join('') + '</div>' : '')
      + variants.map((v, i) => `<div class="variant-sheet" data-variant="${esc(v.key || '')}"${i ? ' hidden' : ''}>${render.renderStudentHTML(m, v.key)}</div>`).join('')
      + (!variants.length ? render.renderStudentHTML(m) : '');
    $$('#out-student [data-variant].chip-btn').forEach(b => b.addEventListener('click', () => {
      $$('#out-student .chip-btn').forEach(x => x.classList.toggle('active', x === b));
      $$('#out-student .variant-sheet').forEach(x => { x.hidden = x.dataset.variant !== b.dataset.variant; });
    }));
    // Word download: one student file per level
    const dl = $('#dl-variants');
    dl.innerHTML = multi ? variants.map(v => `<button type="button" class="btn tiny primary" data-download="docx-student" data-variant="${esc(v.key)}">Word: Schülerversion ${esc(v.label.replace('Niveau ', ''))}</button>`).join('') : '';
    $$('#dl-variants [data-download]').forEach(b => b.addEventListener('click', () => download(b.dataset.download, b.dataset.variant)));
    $('[data-download="docx-student"]:not([data-variant])').hidden = multi;
    $('#out-teacher').innerHTML = render.renderTeacherHTML(m);
    renderLayout(m);
    $('#out-quality').innerHTML = renderQualityPanel(m);
    $('#out-prompts').innerHTML = Object.entries(m.prompts || {}).map(([k, v]) => `<details><summary>${esc(k)} (${v.length} Zeichen)</summary><pre>${esc(v)}</pre></details>`).join('') || '<p class="muted">–</p>';
    $('#out-json').textContent = JSON.stringify({ content: m.content, worksheet: m.worksheet, plan: m.plan }, null, 2);
    showTab('student');
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Draw the screenshot of the text into the Layout tab; returns the canvas. */
  function renderLayout(m) {
    const pane = $('#out-layout');
    const tab = $('#tab-layout');
    if (!m.layout || !m.layout.chrome) { pane.innerHTML = ''; tab.hidden = true; return null; }
    tab.hidden = false;
    pane.innerHTML = `<p class="layout-note">So sähe der Text aus, wenn er aus diesem Medium käme (${esc(m.layout.label || '')}). Das Bild enthält den generierten Text unverändert – das wird vor der Ausgabe geprüft.</p>`
      + '<div class="layout-actions"><button type="button" class="btn tiny primary" data-download="png">Bild (PNG) herunterladen</button></div>'
      + '<div class="layout-shot"><canvas id="layout-canvas"></canvas></div>';
    const canvas = $('#layout-canvas');
    const model = mock.buildModel(m, m.layout.chrome, { measure: mock.canvasMeasure(canvas) });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = model.width * dpr; canvas.height = model.height * dpr;
    canvas.style.width = model.width + 'px'; canvas.style.height = model.height + 'px';
    const ctx2 = canvas.getContext('2d');
    ctx2.scale(dpr, dpr);
    mock.draw(ctx2, model);
    $$('#out-layout [data-download]').forEach(b => b.addEventListener('click', () => download('png')));
    return canvas;
  }

  function renderQualityPanel(m) {
    const f = m.quality.findings || [];
    const s = quality.summarize(f);
    let html = `<p class="stats">${s.pass} bestanden · ${s.warn} Warnungen · ${s.fail} nicht bestanden · ${s.unverified} nicht geprüft · ${Math.round((m.quality.durationMs || 0) / 1000)} s</p>`;
    if (m.level) html += `<h3>Schwierigkeitsmesser · Ziel ${esc(m.plan.cefr)}</h3>` + render.levelMeterHTML(m.level, m.plan.cefr);
    const table = (list) => `<div class="table-wrap"><table class="qc-table"><tbody>` + list.map(x => `<tr class="qc-${x.status}"><td class="qc-status">${x.status}</td><td>${esc(x.title)}<div class="muted small">${x.kind === 'llm' ? 'Claude-Review' : 'gemessen'}${x.questions && x.questions.length ? ' · Q' + x.questions.join(', Q') : ''}</div></td><td class="muted">${esc(x.detail)}</td></tr>`).join('') + '</tbody></table></div>';
    for (const [g, title] of [['content', 'Content'], ['listening', 'Listening']]) {
      const list = f.filter(x => x.group === g);
      if (list.length) html += `<h3>${title}</h3>` + table(list);
    }
    const variants = render.variantsOf(m).filter(v => v.worksheet);
    for (const v of variants) {
      const list = f.filter(x => x.group === 'questions' && (v.key ? x.variant === v.key : !x.variant));
      if (list.length) html += `<h3>Questions${v.label ? ' — ' + esc(v.label) : ''}</h3>` + table(list);
      for (const [g, title] of [['pretask', 'Pre-Task'], ['posttask', 'Post-Task']]) {
        const list2 = f.filter(x => x.group === g && (v.key ? x.variant === v.key : !x.variant));
        if (list2.length) html += `<h3>${title}${v.label ? ' — ' + esc(v.label) : ''}</h3>` + table(list2);
      }
    }
    const repairs = (m.quality.repairs || []).filter(r => r.accepted);
    if (repairs.length) {
      html += '<h3>Automatische Korrektur</h3><ul class="qc-list">' + repairs.map(r =>
        `<li class="qc-pass"><span class="qc-status">Runde ${r.round}</span> ${esc(render.repairLabel(r))} <span class="muted">— Auslöser: ${esc((r.fixed || []).join(', '))}</span></li>`).join('') + '</ul>';
    } else if (m.settings && m.settings.autoFix === 'off') {
      html += '<p class="muted">Automatische Korrektur war ausgeschaltet.</p>';
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

  async function download(kind, variant) {
    const m = app.material; if (!m) return;
    const slug = word.slug(m.title);
    let filename, data;
    if (kind === 'docx-student' || kind === 'docx-teacher') {
      const which = kind === 'docx-student' ? 'student' : 'teacher';
      // Never hand out a document that would open as damaged.
      const problems = ooxml.validate(word.partsFor(m, which, variant));
      if (problems.length) {
        console.error('LRMaster: invalid Word package', problems);
        toast('Word-Datei konnte nicht erzeugt werden: ' + problems[0]);
        return;
      }
      filename = word.filename(m, which, variant);
      data = new Blob([which === 'teacher' ? word.buildTeacher(m) : word.buildStudent(m, variant)],
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    } else if (kind === 'png') {
      const canvas = $('#layout-canvas') || renderLayout(m);
      if (!canvas) { toast('Für dieses Material gibt es kein Layout-Bild.'); return; }
      const model = mock.buildModel(m, m.layout.chrome, { measure: mock.canvasMeasure(canvas) });
      const problems = mock.validate(model);
      if (problems.length) { console.error('LRMaster: invalid layout', problems); toast('Bild konnte nicht erzeugt werden: ' + problems[0]); return; }
      filename = word.slug(m.title) + '-layout.png';
      data = await new Promise(res => canvas.toBlob(res, 'image/png'));
      if (!data) { toast('Bild konnte nicht erzeugt werden.'); return; }
    } else if (kind === 'md') { filename = slug + '.md'; data = render.renderMarkdown(m); }
    else if (kind === 'student') {
      const vs = render.variantsOf(m).filter(v => v.worksheet);
      filename = slug + '-student.html';
      data = fullDocument(m.title, vs.length > 1 ? vs.map(v => render.renderStudentHTML(m, v.key)).join('<div class="page-break"></div>') : render.renderStudentHTML(m));
    }
    else if (kind === 'teacher') { filename = slug + '-teacher.html'; data = fullDocument(m.title + ' (teacher)', render.renderTeacherHTML(m)); }
    else { filename = slug + '.json'; data = JSON.stringify(m, null, 2); }

    if (caps.downloads) {
      try { await caps.downloads.save({ filename, data }); toast('Gespeichert: ' + filename); }
      catch (e) { if (e.code !== 'declined') toast('Download nicht möglich: ' + (e.message || e.code)); }
      return;
    }
    // Outside the Claude viewer (local preview): save through the browser.
    try {
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
      toast('Gespeichert: ' + filename);
    } catch (e) {
      toast('Download in dieser Ansicht nicht verfügbar.');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Dialogs (the page runs framed, so no window.prompt/confirm)          */
  /* ------------------------------------------------------------------ */

  function openDialog(opts) {
    return new Promise(resolve => {
      const dlg = $('#dlg'), form = $('#dlg-form'), cancel = $('#dlg-cancel'), okBtn = $('#dlg-ok');
      $('#dlg-title').textContent = opts.title || '';
      $('#dlg-body').innerHTML = opts.bodyHTML || '';
      okBtn.textContent = opts.okLabel || 'OK';
      okBtn.classList.toggle('danger', !!opts.danger);
      cancel.textContent = opts.cancelLabel || 'Abbrechen';
      let done = false;
      const collect = () => {
        const values = {};
        $$('#dlg-body [name]').forEach(el => { values[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
        return values;
      };
      const cleanup = () => {
        form.removeEventListener('submit', onSubmit);
        cancel.removeEventListener('click', onCancel);
        dlg.removeEventListener('cancel', onEsc);
        dlg.removeEventListener('close', onCancel);
      };
      const finish = (v) => { if (done) return; done = true; cleanup(); try { dlg.close(); } catch (e) { dlg.removeAttribute('open'); } resolve(v); };
      const onSubmit = (e) => { e.preventDefault(); finish(collect()); };
      const onCancel = () => finish(null);
      const onEsc = (e) => { e.preventDefault(); finish(null); };
      form.addEventListener('submit', onSubmit);
      cancel.addEventListener('click', onCancel);
      dlg.addEventListener('cancel', onEsc);
      dlg.addEventListener('close', onCancel);
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      const first = $('#dlg-body input, #dlg-body textarea, #dlg-body select');
      if (first) { first.focus(); if (first.select) first.select(); }
    });
  }

  async function askText(o) {
    const r = await openDialog({
      title: o.title, okLabel: o.okLabel || 'Speichern', danger: o.danger,
      bodyHTML: (o.note ? `<p class="help">${esc(o.note)}</p>` : '')
        + `<label class="dlg-field"><span>${esc(o.label || '')}</span><input type="text" name="value" value="${esc(o.value || '')}" placeholder="${esc(o.placeholder || '')}" required></label>`,
    });
    const v = r ? String(r.value || '').trim() : '';
    return v || null;
  }

  async function askConfirm(o) {
    const r = await openDialog({ title: o.title, okLabel: o.okLabel || 'Ja', danger: o.danger, bodyHTML: `<p>${esc(o.text || '')}</p>` });
    return !!r;
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
    const onlyExamples = app.textbooks.every(t => t.example);
    el.textContent = `${app.textbooks.length} Lehrmittel · ${units} Units · ${words} Vokabeln · ${app.materials.length} gespeicherte Materialien`
      + (onlyExamples ? ' · nur Beispieldaten – lege unter „Vocabulary / Lehrmittel verwalten“ dein eigenes Lehrmittel an' : '');
  }

  const importState = { units: null, warnings: [], sourceName: '', source: 'none' };

  function renderVocabManager() {
    const list = $('#textbook-list');
    const empty = $('#textbook-empty');
    const onlyExamples = app.textbooks.every(t => t.example);
    empty.hidden = !onlyExamples;
    if (onlyExamples) {
      empty.innerHTML = '<h3>Noch kein eigenes Lehrmittel</h3><p>Die unten gezeigten Lehrmittel sind Beispieldaten. Lege rechts ein neues Lehrmittel an oder importiere direkt eine Vokabelliste in ein neues Lehrmittel – die Beispiele verschwinden, sobald du ein eigenes gespeichert hast.</p><button type="button" class="btn primary" id="btn-empty-new">Neues Lehrmittel anlegen</button>';
      const b = $('#btn-empty-new');
      if (b) b.addEventListener('click', newTextbook);
    }
    list.innerHTML = app.textbooks.map(t => {
      const units = t.units || [];
      const missing = units.filter(u => !u.topic).length;
      return `<div class="textbook" data-tb="${esc(t.id)}"><div class="tb-head"><h3>${esc(t.name)}${t.example ? ' <span class="badge">Beispiel</span>' : ''}</h3>`
        + `<div class="tb-actions">`
        + `<button type="button" class="btn tiny" data-tb-import="${esc(t.id)}">Hierhin importieren</button>`
        + (units.length ? `<button type="button" class="btn tiny" data-tb-topics="${esc(t.id)}"${missing ? '' : ' disabled'} title="Claude leitet die Themen der Units aus deren Wortschatz ab">Themen von Claude${missing ? ` (${missing})` : ''}</button>` : '')
        + `<button type="button" class="btn tiny" data-tb-rename="${esc(t.id)}">Umbenennen</button>`
        + `<button type="button" class="btn tiny danger" data-tb-delete="${esc(t.id)}">Löschen</button></div></div>`
        + (units.length ? '<ul class="units">' + units.map(u => `<li><span class="unit-name">${esc(u.name)}</span><input type="text" class="unit-topic" data-topic="${esc(t.id)}:${esc(u.id)}" value="${esc(u.topic || '')}" placeholder="Thema der Unit"><span class="muted">${u.words.length} Wörter</span><button type="button" class="btn tiny" data-unit-show="${esc(t.id)}:${esc(u.id)}">Anzeigen</button><button type="button" class="btn tiny danger" data-unit-delete="${esc(t.id)}:${esc(u.id)}">Löschen</button></li>`).join('') + '</ul>'
          : '<p class="muted">Noch keine Unit – importiere rechts eine Vokabelliste.</p>')
        + '<div class="unit-words" hidden></div></div>';
    }).join('') || '<p class="muted">Noch kein Lehrmittel angelegt.</p>';

    $$('[data-tb-import]', list).forEach(b => b.addEventListener('click', () => {
      $('#import-textbook').value = b.dataset.tbImport;
      onImportTargetChange();
      $('#import-file').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    $$('[data-tb-topics]', list).forEach(b => b.addEventListener('click', async () => {
      const tb = app.textbooks.find(t => t.id === b.dataset.tbTopics);
      b.disabled = true;
      b.textContent = 'Claude liest den Wortschatz …';
      const missing = tb.units.filter(u => !u.topic);
      try {
        const rows = await fetchTopics(missing);
        const units = vocab.withTopics(tb.units, rows, true);
        const added = units.filter((u, i) => u.topic && !tb.units[i].topic).length;
        if (!added) { toast('Claude hat kein Thema geliefert.'); renderVocabManager(); return; }
        await persistTextbook(Object.assign({}, tb, { units }), true);
        toast(`${added} Thema/Themen von Claude ergänzt.`);
      } catch (e) { toast(errorCopy(e)); renderVocabManager(); }
    }));
    $$('[data-tb-rename]', list).forEach(b => b.addEventListener('click', async () => {
      const tb = app.textbooks.find(t => t.id === b.dataset.tbRename);
      const name = await askText({ title: 'Lehrmittel umbenennen', label: 'Name', value: tb.name });
      if (!name) return;
      await persistTextbook(Object.assign({}, tb, { name }));
    }));
    $$('[data-tb-delete]', list).forEach(b => b.addEventListener('click', async () => {
      const tb = app.textbooks.find(t => t.id === b.dataset.tbDelete);
      if (!await askConfirm({ title: 'Lehrmittel löschen', text: `„${tb.name}“ mit allen Units und Vokabeln löschen? Das lässt sich nicht rückgängig machen.`, okLabel: 'Löschen', danger: true })) return;
      if (!tb.example) await store.remove('textbooks', tb.id); else app.textbooks = app.textbooks.filter(t => t.id !== tb.id);
      await refreshTextbooks(); renderVocabManager();
    }));
    $$('[data-unit-delete]', list).forEach(b => b.addEventListener('click', async () => {
      const [tid, uid] = b.dataset.unitDelete.split(':');
      const tb = app.textbooks.find(t => t.id === tid); const u = tb.units.find(x => x.id === uid);
      if (!await askConfirm({ title: 'Unit löschen', text: `Unit „${u.name}“ mit ${u.words.length} Vokabeln löschen?`, okLabel: 'Löschen', danger: true })) return;
      await persistTextbook(Object.assign({}, tb, { units: tb.units.filter(x => x.id !== uid) }));
    }));
    $$('[data-unit-show]', list).forEach(b => b.addEventListener('click', () => {
      const [tid, uid] = b.dataset.unitShow.split(':');
      const tb = app.textbooks.find(t => t.id === tid); const u = tb.units.find(x => x.id === uid);
      const box = b.closest('.textbook').querySelector('.unit-words'); box.hidden = false;
      box.innerHTML = `<h4>${esc(u.name)}</h4><div class="table-wrap"><table class="words"><tbody>` + u.words.map(w => `<tr><td>${esc(w.word)}</td><td>${esc(w.translation)}</td><td class="muted">${esc(w.note)}</td></tr>`).join('') + '</tbody></table></div>';
    }));
    $$('input[data-topic]', list).forEach(inp => inp.addEventListener('change', async () => {
      const [tid, uid] = inp.dataset.topic.split(':');
      const tb = app.textbooks.find(t => t.id === tid); const u = tb.units.find(x => x.id === uid);
      await persistTextbook(Object.assign({}, tb, { units: vocab.withUnitPatch(tb.units, u.id, { topic: inp.value.trim() }) }), true);
    }));

    fillImportTargets();
    renderImportPreview();
  }

  /** The import target list: every textbook plus "create a new one". */
  function fillImportTargets() {
    const sel = $('#import-textbook');
    const keep = sel.value;
    sel.innerHTML = app.textbooks.map(t => `<option value="${esc(t.id)}">${esc(t.name)}${t.example ? ' (Beispiel)' : ''}</option>`).join('')
      + '<option value="__new__">➕ Neues Lehrmittel anlegen …</option>';
    const onlyExamples = app.textbooks.every(t => t.example);
    sel.value = (keep && Array.from(sel.options).some(o => o.value === keep)) ? keep : (onlyExamples ? '__new__' : app.textbooks[0].id);
    onImportTargetChange();
  }

  function onImportTargetChange() {
    const isNew = $('#import-textbook').value === '__new__';
    $('#field-new-textbook').hidden = !isNew;
    $('#import-mode').closest('.field').hidden = isNew;
  }

  function onUnitModeChange() {
    const mode = $('#import-unit-mode').value;
    $('#field-import-unit').hidden = mode === 'claude';
    $('#import-unit').placeholder = mode === 'single' ? 'z. B. Unit 3' : 'Fallback, z. B. Unit 3';
    if (importState.units) applyUnitMode();
  }

  async function persistTextbook(input, quiet) {
    const tb = clone(input);
    if (tb.example) { delete tb.example; if (!tb.id.startsWith('tb_') || tb.id.includes('example')) tb.id = vocab.makeId('tb'); }
    await store.put('textbooks', tb);
    await refreshTextbooks();
    if (app.view === 'vocab') renderVocabManager();
    if (!quiet) toast('Lehrmittel gespeichert.');
    return tb;
  }

  /** Create an empty textbook (no import needed). */
  async function newTextbook() {
    const name = await askText({
      title: 'Neues Lehrmittel', label: 'Name des Lehrmittels', placeholder: 'z. B. English Plus 4',
      note: 'Leeres Lehrmittel anlegen. Die Units entstehen beim Import der Vokabelliste.', okLabel: 'Anlegen',
    });
    if (!name) return null;
    const tb = { id: vocab.makeId('tb'), name, units: [] };
    await store.put('textbooks', tb);
    await refreshTextbooks(); renderVocabManager();
    $('#import-textbook').value = tb.id;
    onImportTargetChange();
    toast(`Lehrmittel „${tb.name}“ angelegt.`);
    return tb;
  }

  /* ---------------- import ---------------- */

  function unitNameField() { return $('#import-unit').value.trim(); }

  /** Apply the chosen unit handling to the freshly parsed list. */
  function applyUnitMode() {
    const mode = $('#import-unit-mode').value;
    if (mode === 'single') {
      importState.units = vocab.flattenUnits(importState.parsed, unitNameField() || 'Unit 1');
    } else {
      importState.units = JSON.parse(JSON.stringify(importState.parsed));
    }
    renderImportPreview();
    if (mode === 'claude') detectUnits();
  }

  function afterParse(r, sourceName) {
    importState.parsed = r.units;
    importState.warnings = r.warnings || [];
    importState.sourceName = sourceName;
    applyUnitMode();
  }

  async function readImportFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const opts = { defaultUnit: unitNameField() || undefined };
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
      afterParse(vocab.parseRows(rows, opts), file.name);
    } else {
      const text = await file.text();
      $('#import-text').value = text;
      afterParse(vocab.parseText(text, opts), file.name);
    }
  }

  function parsePasted() {
    const text = $('#import-text').value;
    if (!text.trim()) { toast('Bitte Text einfügen oder eine Datei wählen.'); return; }
    afterParse(vocab.parseText(text, { defaultUnit: unitNameField() || undefined }), 'Eingefügter Text');
  }

  async function parseWithClaude() {
    const text = $('#import-text').value;
    if (!text.trim()) { toast('Bitte Text einfügen.'); return; }
    const btn = $('#btn-parse-claude'); btn.disabled = true;
    $('#import-preview').innerHTML = '<p class="muted">Claude zerlegt die Liste in Wort und Übersetzung …</p>';
    try {
      const rows = await askJSON(prompts.buildVocabParsePrompt(text, unitNameField()), { tier: 'quick' });
      afterParse(vocab.fromParsedRows(Array.isArray(rows) ? rows : [], { defaultUnit: unitNameField() || undefined }), 'Claude-Import');
    } catch (e) { $('#import-preview').innerHTML = `<p class="error">${esc(errorCopy(e))}</p>`; }
    finally { btn.disabled = !caps.sample; }
  }

  /** Let Claude find the unit boundaries of an unstructured list and name them. */
  async function detectUnits() {
    if (!importState.units || !importState.units.length) { toast('Bitte zuerst eine Liste einlesen.'); return; }
    if (!caps.sample) { toast(ERROR_COPY.not_granted); return; }
    const words = vocab.allWords(importState.units);
    if (words.length < 4) { toast('Zu wenige Einträge für eine Unit-Erkennung.'); return; }
    if (words.length > 800) { toast('Die Liste ist zu lang für die automatische Unit-Erkennung (max. 800 Einträge).'); return; }
    const btn = $('#btn-detect-units');
    btn.disabled = true;
    const status = $('#import-detect-status');
    if (status) status.textContent = 'Claude liest die Liste …';
    try {
      const single = importState.units.length <= 1;
      if (single) {
        const res = await askJSON(prompts.buildUnitDetectPrompt(words, unitNameField()), {});
        const groups = Array.isArray(res) ? res : (res && res.units) || [];
        const r = vocab.applyGroups(importState.units, groups);
        importState.units = r.units;
        importState.warnings = importState.warnings.concat(r.warnings);
        toast(`${r.units.length} Unit(s) von Claude erkannt.`);
      } else {
        const missing = importState.units.filter(u => !u.topic);
        const rows = await fetchTopics(missing.length ? missing : importState.units);
        importState.units = vocab.withTopics(importState.units, rows, missing.length > 0);
        toast('Themen von Claude ergänzt.');
      }
      renderImportPreview();
    } catch (e) {
      toast(errorCopy(e));
      renderImportPreview();
    }
  }

  /** Ask Claude for a topic per unit. Returns [{unit, topic}] and changes nothing. */
  async function fetchTopics(units) {
    if (!units || !units.length) return [];
    if (!caps.sample) throw { code: 'not_granted', message: 'sample unavailable' };
    const res = await askJSON(prompts.buildUnitTopicPrompt(units), { tier: 'quick' });
    const rows = Array.isArray(res) ? res : (res && (res.topics || res.units)) || [];
    return rows.filter(r => r && (r.topic !== undefined));
  }

  function renderImportPreview() {
    const box = $('#import-preview');
    const detectBtn = $('#btn-detect-units');
    if (!importState.units) {
      box.innerHTML = '<p class="muted">Noch nichts eingelesen. Unterstützt: CSV, TSV, TXT („Wort – Übersetzung“), XLSX. Unit-Überschriften wie „Unit 3: Movies“ oder eine Unit-Spalte werden automatisch erkannt; fehlen sie, kann Claude die Units aus dem Inhalt ableiten.</p>';
      $('#btn-import-confirm').disabled = true;
      detectBtn.disabled = true;
      return;
    }
    const total = importState.units.reduce((a, u) => a + u.words.length, 0);
    const single = importState.units.length <= 1;
    detectBtn.textContent = single ? 'Units & Themen von Claude erkennen' : 'Fehlende Themen von Claude ergänzen';
    detectBtn.disabled = !caps.sample || total < 4;
    box.innerHTML = `<p><strong>${esc(importState.sourceName)}</strong>: ${importState.units.length} Unit(s), ${total} Einträge.</p>`
      + (importState.warnings.length ? `<p class="muted">${importState.warnings.length} Hinweis(e) beim Einlesen: ${esc(importState.warnings.slice(0, 2).join(' · '))}</p>` : '')
      + '<p class="muted" id="import-detect-status"></p>'
      + '<ul class="import-units">' + importState.units.map((u, i) => `<li>`
        + `<input type="text" data-imp-name="${i}" value="${esc(u.name)}" aria-label="Unit-Name">`
        + `<input type="text" data-imp-topic="${i}" value="${esc(u.topic || '')}" placeholder="Thema (optional)" aria-label="Thema">`
        + `<button type="button" class="btn tiny danger" data-imp-remove="${i}" title="Diese Unit nicht importieren">✕</button>`
        + `<span class="muted">${u.words.length} Wörter: ${esc(u.words.slice(0, 6).map(w => w.word).join(', '))}${u.words.length > 6 ? ' …' : ''}</span></li>`).join('')
      + '</ul>';
    const patchUnit = (i, patch) => { importState.units = importState.units.map((u, x) => (x === i ? Object.assign({}, u, patch) : u)); };
    $$('input[data-imp-name]', box).forEach(inp => inp.addEventListener('input', () => patchUnit(Number(inp.dataset.impName), { name: inp.value })));
    $$('input[data-imp-topic]', box).forEach(inp => inp.addEventListener('input', () => patchUnit(Number(inp.dataset.impTopic), { topic: inp.value })));
    $$('[data-imp-remove]', box).forEach(b => b.addEventListener('click', () => {
      importState.units.splice(Number(b.dataset.impRemove), 1);
      renderImportPreview();
    }));
    $('#btn-import-confirm').disabled = total === 0;
  }

  async function confirmImport() {
    if (!importState.units || !importState.units.length) { toast('Bitte zuerst eine Liste einlesen.'); return; }
    const targetId = $('#import-textbook').value;
    const isNew = targetId === '__new__';
    let tb;
    if (isNew) {
      const name = $('#import-new-textbook').value.trim();
      if (!name) { toast('Bitte einen Namen für das neue Lehrmittel eingeben.'); $('#import-new-textbook').focus(); return; }
      if (app.textbooks.some(t => !t.example && t.name.toLowerCase() === name.toLowerCase())
        && !await askConfirm({ title: 'Name schon vergeben', text: `Es gibt bereits ein Lehrmittel „${name}“. Trotzdem ein zweites anlegen?`, okLabel: 'Anlegen' })) return;
      tb = { id: vocab.makeId('tb'), name, units: [] };
    } else {
      tb = app.textbooks.find(t => t.id === targetId);
      if (!tb) { toast('Bitte ein Ziel-Lehrmittel wählen.'); return; }
    }
    const mode = isNew ? 'add' : $('#import-mode').value;
    const units = importState.units.map(u => ({
      name: (u.name || 'Unit 1').trim(),
      topic: (u.topic || '').trim(),
      words: u.words.map(w => ({ word: String(w.word).trim(), translation: String(w.translation || '').trim(), note: String(w.note || '').trim() })),
    })).filter(u => u.words.length);
    const merged = vocab.mergeUnits(tb, units, mode);
    merged.units = merged.units.map(u => (u.id ? u : Object.assign({}, u, { id: vocab.makeId('unit') })));
    const saved = await persistTextbook(merged, true);

    // A new textbook becomes the creator's selection if that still points at example data.
    const current = app.textbooks.find(t => t.id === app.state.textbookId);
    if (isNew || !current || current.example) {
      const fresh = app.textbooks.find(t => t.id === saved.id) || app.textbooks[0];
      if (fresh) {
        app.state.textbookId = fresh.id;
        app.state.unitId = fresh.units[0] ? fresh.units[0].id : '';
        if ($('#set-textbookId')) fillTextbookSelect();
        saveDraft();
      }
    }
    importState.units = null; importState.parsed = null; importState.warnings = [];
    $('#import-text').value = ''; $('#import-file').value = ''; $('#import-new-textbook').value = '';
    renderVocabManager();
    const wordCount = units.reduce((a, u) => a + u.words.length, 0);
    toast(`${wordCount} Vokabeln in ${units.length} Unit(s) ${isNew ? 'als neues Lehrmittel „' + saved.name + '“ angelegt' : mode === 'replace' ? 'ersetzt' : mode === 'update' ? 'aktualisiert' : 'hinzugefügt'}.`);
  }

  /* ------------------------------------------------------------------ */
  /* Materials library                                                     */
  /* ------------------------------------------------------------------ */

  function renderMaterials() {
    const el = $('#materials-list');
    const list = app.materials.slice().sort((a, b) => b.createdAt - a.createdAt);
    el.innerHTML = list.length ? list.map(m => { const s = quality.summarize((m.quality && m.quality.findings) || []); return `<div class="material-row"><div><strong>${esc(m.title)}</strong><div class="muted small">${m.kind === 'listening' ? 'Listening' : 'Reading'} · ${esc(m.plan.unitName)} · ${esc(m.plan.cefr)} · ${new Date(m.createdAt).toLocaleString()} · QC ${s.pass}/${s.pass + s.warn + s.fail + s.unverified}</div></div><div class="tb-actions"><button type="button" class="btn tiny" data-open="${esc(m.id)}">Öffnen</button><button type="button" class="btn tiny danger" data-del="${esc(m.id)}">Löschen</button></div></div>`; }).join('') : '<p class="muted">Noch keine Materialien gespeichert.</p>';
    $$('[data-open]', el).forEach(b => b.addEventListener('click', () => { const m = app.materials.find(x => x.id === b.dataset.open); app.material = m; openCreator(m.kind); renderOutput(m); }));
    $$('[data-del]', el).forEach(b => b.addEventListener('click', async () => {
      const m = app.materials.find(x => x.id === b.dataset.del);
      if (!await askConfirm({ title: 'Material löschen', text: `„${m ? m.title : ''}“ endgültig löschen?`, okLabel: 'Löschen', danger: true })) return;
      await store.remove('materials', b.dataset.del); app.materials = await store.list('materials'); renderMaterials();
    }));
  }

  /* ------------------------------------------------------------------ */
  /* Concept check page                                                    */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Niveau messen: paste any script or text, measure, ask Claude          */
  /* ------------------------------------------------------------------ */

  /** Pasted text → content object. "Speaker 1: [tag] …" lines become a script, anything else paragraphs. */
  function parsePasted(text, kind) {
    const raw = String(text || '').replace(/\r/g, '');
    if (kind === 'listening') {
      const lines = [];
      for (const l of raw.split('\n')) {
        const t = l.trim(); if (!t) continue;
        const m = /^([^:\n]{1,40}):\s*(.*)$/.exec(t);
        if (m && !/^https?$/i.test(m[1])) lines.push({ speaker: m[1].trim(), emotion: null, text: m[2] });
        else if (lines.length) lines[lines.length - 1].text += ' ' + t;
        else lines.push({ speaker: 'Speaker', emotion: null, text: t });
      }
      return { title: '', lines };
    }
    const paragraphs = raw.split(/\n\s*\n/).map(x => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    return { title: '', paragraphs };
  }

  function initLevelPage() {
    const el = $('#view-level');
    if (el.dataset.built) return;
    el.dataset.built = '1';
    const kindOf = () => $('input[name="lv-kind"]:checked').value;
    const measureNow = () => {
      const text = $('#lv-text').value;
      const kind = kindOf();
      const content = parsePasted(text, kind);
      const words = level.tokenize(kind === 'listening' ? content.lines.map(l => l.text).join(' ') : content.paragraphs.join(' ')).length;
      if (words < 20) { $('#lv-result').innerHTML = '<p class="muted">Bitte mindestens 20 Wörter einfügen.</p>'; app.levelMeasured = null; return null; }
      const target = $('#lv-target').value || null;
      const seconds = Number($('#lv-seconds').value) || null;
      const measured = level.measure(content, kind, { seconds });
      app.levelMeasured = { measured, content, kind, target };
      let html = render.levelMeterHTML(measured, target);
      if (target) {
        const cmp = level.compare(measured, target);
        html += `<p class="lv-verdict qc-${cmp.status}"><span class="qc-status">${cmp.status}</span> ${cmp.status === 'pass' ? `Der Text passt zu ${esc(target)}.` : `${Math.abs(cmp.delta)} Stufe${Math.abs(cmp.delta) > 1 ? 'n' : ''} ${cmp.delta > 0 ? 'über' : 'unter'} ${esc(target)}.`}</p>`;
        if (cmp.deviations.length) html += '<ul class="qc-list">' + cmp.deviations.map(d => `<li class="qc-${Math.abs(d.steps) >= 2 ? 'fail' : 'warn'}"><span class="qc-status">${esc(d.label)}</span> ${esc(d.suggestion)}</li>`).join('') + '</ul>';
      }
      html += `<details class="lv-desc"><summary>Was ${esc(measured.band)} bedeutet</summary><p><strong>${kind === 'listening' ? 'Hören' : 'Lesen'}:</strong> ${esc(level.DESCRIPTORS[measured.band][kind])}</p><p><strong>Sprache:</strong> ${esc(level.DESCRIPTORS[measured.band].language)}</p></details>`;
      $('#lv-result').innerHTML = html;
      $('#lv-opinion').innerHTML = '';
      $('#btn-lv-opinion').disabled = !caps.sample;
      return measured;
    };
    $('#btn-lv-measure').addEventListener('click', measureNow);
    $('#lv-text').addEventListener('input', () => { $('#lv-count').textContent = level.tokenize($('#lv-text').value).length + ' Wörter'; });
    $('#btn-lv-opinion').addEventListener('click', async () => {
      const cur = app.levelMeasured || measureNow();
      if (!cur || !caps.sample) return;
      const btn = $('#btn-lv-opinion'); btn.disabled = true;
      $('#lv-opinion').innerHTML = '<p class="muted">Claude beurteilt den Text …</p>';
      try {
        const text = cur.kind === 'listening' ? cur.content.lines.map((l, i) => `[${i + 1}] ${l.speaker}: ${l.text}`).join('\n') : cur.content.paragraphs.map((p, i) => `[¶${i + 1}] ${p}`).join('\n\n');
        const prompt = prompts.buildLevelOpinionPrompt(text, cur.kind, cur.measured);
        const r = await askJSON(prompt, {});
        const agree = r && r.band === cur.measured.band;
        $('#lv-opinion').innerHTML = `<h3>Zweitmeinung von Claude: ${esc(r.band || '–')} <span class="muted small">(${agree ? 'stimmt mit der Messung überein' : 'weicht von der Messung ' + esc(cur.measured.band) + ' ab'})</span></h3>`
          + `<p>${esc(r.justification || '')}</p>`
          + (Array.isArray(r.hardest) && r.hardest.length ? `<p><strong>Treibt das Niveau:</strong> ${r.hardest.map(esc).join(', ')}</p>` : '')
          + (r.toReach ? `<p class="small"><strong>Leichter:</strong> ${esc(r.toReach.easier || '')}<br><strong>Schwerer:</strong> ${esc(r.toReach.harder || '')}</p>` : '')
          + `<details><summary class="muted small">Prompt</summary><pre>${esc(prompt)}</pre></details>`;
      } catch (e) { $('#lv-opinion').innerHTML = `<p class="muted">Zweitmeinung nicht möglich: ${esc(errorCopy(e))}</p>`; }
      finally { btn.disabled = !caps.sample; }
    });
    $('#btn-lv-example').addEventListener('click', () => {
      const c = fixture.content('listening');
      $('input[name="lv-kind"][value="listening"]').checked = true;
      $('#lv-text').value = c.lines.map(l => `${l.speaker}: ${l.emotion ? '[' + l.emotion + '] ' : ''}${l.text}`).join('\n');
      $('#lv-count').textContent = level.tokenize($('#lv-text').value).length + ' Wörter';
      measureNow();
    });
    $('#lv-target').innerHTML = '<option value="">– kein Ziel –</option>' + core.CEFR_BANDS.map(b => `<option value="${b}">${b}</option>`).join('');
    $('#lv-attribution').textContent = 'Wortfrequenzen: ' + window.LR.wordlist.ATTRIBUTION + '.';
  }

  function runConceptCheck() {
    const el = $('#check-results');
    const res = checks.run({
      hasControl: sel => { try { return !!document.querySelector(sel); } catch (e) { return false; } },
      // The pipeline is generate() plus the per-worksheet stage it delegates to.
      pipelineSource: generate.toString() + '\n' + produceWorksheet.toString(),
      uiSource: Object.values(window.LR.ui).map(v => typeof v === 'function' ? v.toString() : '').join('\n'),
      pipeline: generate,
    });
    const bySection = {};
    for (const r of res.results) (bySection[r.section] = bySection[r.section] || []).push(r);
    const SECTION_NAMES = { 0: 'Vollständigkeit', 1: 'Ziel der Anwendung', 2: 'Hauptnavigation', 3: 'Grundaufbau des Creators', 4: 'Source & Unit', 5: 'Content', 6: 'Language Level', 7: 'Vocabulary Settings', 8: 'Listening – Audio Structure', 9: 'Listening Presets', 10: 'Speaker Distribution', 11: 'Turn Length', 12: 'Audio Length', 13: 'Speaker Profiles', 14: 'Emotion & Delivery Tags', 15: 'Natural Speech Settings', 16: 'Information Explicitness', 17: 'Reading – Text Structure', 18: 'Worksheet', 19: 'Number of Questions', 20: 'Listening / Reading Skills', 21: 'Higher-Order Thinking', 22: 'Question Difficulty', 23: 'Automatic Skill Mix', 24: 'Manual Skill Mix', 25: 'Question Formats', 26: 'Question Order', 27: 'Pre-Listening / Pre-Reading', 28: 'Output', 29: 'Quality Check', 30: 'Advanced Settings', 31: 'Simple vs. Advanced Mode', 32: 'Beispielkonfiguration', 33: 'Word-Export (formatiert, typgerecht)', 34: 'Schwierigkeitsmesser & Niveau der Fragen', 35: 'Pre-Task: Typen, Sozialformen, Anforderungsniveau', 36: 'Post-Task: Typen, Sozialformen, Anforderungsniveau', 37: 'Authentisches Layout (Screenshot des Mediums)', 38: 'Vorlagen & Custom-Modus' };
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
    $$('[data-download]:not([data-variant])').forEach(b => b.addEventListener('click', () => download(b.dataset.download)));
    $('#btn-print').addEventListener('click', () => window.print());
    $('#btn-load-example').addEventListener('click', () => { app.state = core.applyExampleConfig(app.state, app.textbooks); app.state.setupMode = 'custom'; if (app.kind !== 'listening') { app.kind = 'listening'; document.body.dataset.kind = 'listening'; $('#creator-kind').textContent = 'Listening erstellen'; } fillForm(); onStateChange('preset'); setMode('advanced'); toast('Beispielkonfiguration aus dem Konzept (§32) geladen.'); });
    $('#btn-reset').addEventListener('click', async () => {
      if (!await askConfirm({ title: 'Zurücksetzen', text: 'Alle Einstellungen dieses Creators auf die Standardwerte zurücksetzen?', okLabel: 'Zurücksetzen', danger: true })) return;
      app.state = core.defaults(app.kind);
      if (app.textbooks[0]) { app.state.textbookId = app.textbooks[0].id; app.state.unitId = app.textbooks[0].units[0] ? app.textbooks[0].units[0].id : ''; }
      fillForm(); saveDraft();
    });
    $('#btn-new-textbook').addEventListener('click', newTextbook);
    $('#import-file').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) readImportFile(f).catch(err => toast('Datei konnte nicht gelesen werden: ' + err.message)); });
    $('#import-textbook').addEventListener('change', onImportTargetChange);
    $('#import-unit-mode').addEventListener('change', onUnitModeChange);
    $('#import-unit').addEventListener('input', () => { if ($('#import-unit-mode').value === 'single' && importState.parsed) applyUnitMode(); });
    $('#btn-detect-units').addEventListener('click', detectUnits);
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

  window.LR.ui = { app, generate, produceWorksheet, store, caps, showView, openCreator, importState, detectUnits, fetchTopics, confirmImport, newTextbook, askText, askConfirm, clone, parsePasted, initLevelPage, download, renderOutput, renderQualityPanel, renderTaskPreview, refreshDerived, renderLayout, renderSetupBar, openCustomSetup, backToTemplates, redrawTemplate, templateState };
})();
