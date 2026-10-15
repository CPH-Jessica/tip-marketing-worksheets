(() => {
  'use strict';
  const D = window.DESK_DATA;
  const KEY_WB = 'tip-holiday-novella-student-2026-v1';      // shared with student-workbook.html
  const WB_NAME = 'tip-holiday-novella-student-2026';
  const KEY_DET = 'tip-holiday-prompt-pack-details';          // shared with holiday-novella-prompts.html
  const KEY_DESK = 'tip-holiday-work-desk-v1';                // desk-only
  const DESK_APP = 'tip-holiday-work-desk';
  const LIMIT = 4 * 1024 * 1024;
  const DETAIL_KEYS = ['PEN NAME', 'WORKING TITLE', 'HEAT', 'POV', 'TARGET LENGTH', 'STOP WORD', 'GENRE SHELF', 'HEAT BAND', 'SEASON DOES'];
  const STACK_FALLBACK = {
    'GENRE SHELF': '[genre shelf: choose one in the trope stack on the Class 1 page]',
    'HEAT BAND': '[heat band: clean 1–2 / warm 3 / spicy 4–5 / no romance thread]',
    'WRAPPER': '[wrapper: pick one in the trope stack on the Class 1 page]',
    'WRAPPER SEARCH': '[its search phrase]',
    'CORE TROPES': '[core tropes: pick up to three in the trope stack on the Class 1 page]',
    'SEASON DOES': '[one line, or "not sure yet"]',
    'COSTUME SCORE': '[not scored yet]'
  };
  const AGENDA = [
    ['Check-in and goal', 10], ['Mini-lesson', 10], ['Block 1 · quiet writing', 25], ['Break', 5],
    ['Optional coaching', 15], ['Block 2 · quiet writing', 20], ['Save and commit', 5]
  ];
  const CLASS_DATES = [null, '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29', '2026-11-05'];
  const CONTROLS = D.controls;
  const CTRL = new Map(CONTROLS.map(c => [c.id, c]));
  const $ = id => document.getElementById(id);

  // ---------- small DOM helper ----------
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return n;
  }

  // ---------- storage ----------
  let storageOK = true;
  function getRaw(key) { try { return localStorage.getItem(key); } catch (_) { storageOK = false; return null; } }
  function setRaw(key, raw) { try { localStorage.setItem(key, raw); return true; } catch (_) { storageOK = false; return false; } }
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

  function blankWB() { return { workbook: WB_NAME, schemaVersion: 1, savedAt: new Date().toISOString(), answers: Object.fromEntries(CONTROLS.map(c => [c.id, c.cb ? false : ''])) }; }
  function validateWB(v) {
    if (!isObj(v) || Object.keys(v).sort().join('|') !== 'answers|savedAt|schemaVersion|workbook') throw Error('This is not a complete student workbook save.');
    if (v.workbook !== WB_NAME || v.schemaVersion !== 1) throw Error('This belongs to another workbook or an unsupported version.');
    if (typeof v.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.savedAt)) throw Error('The saved date is invalid.');
    if (!isObj(v.answers) || Object.keys(v.answers).length !== CONTROLS.length) throw Error('Worksheet answers are missing or unexpected.');
    for (const c of CONTROLS) {
      if (!Object.prototype.hasOwnProperty.call(v.answers, c.id)) throw Error('A worksheet field is missing.');
      const a = v.answers[c.id];
      if (c.cb ? typeof a !== 'boolean' : (typeof a !== 'string' || a.length > c.max)) throw Error('A worksheet answer is invalid or too long.');
    }
    return v;
  }
  function validateDET(v) {
    if (!isObj(v)) throw Error('Book details are not readable.');
    const out = {};
    for (const k of DETAIL_KEYS) if (k in v) { if (typeof v[k] !== 'string' || v[k].length > 400) throw Error('A book detail is invalid.'); if (v[k]) out[k] = v[k]; }
    const s = isObj(v.STACK) ? v.STACK : {};
    out.STACK = {
      wrapper: typeof s.wrapper === 'string' ? s.wrapper.slice(0, 80) : '',
      wrapperSearch: typeof s.wrapperSearch === 'string' ? s.wrapperSearch.slice(0, 80) : '',
      tropes: Array.isArray(s.tropes) ? s.tropes.filter(t => typeof t === 'string').slice(0, 3) : [],
      costume: Array.isArray(s.costume) ? s.costume.filter(x => Number.isInteger(x) && x >= 0 && x < 4) : []
    };
    return out;
  }
  const DESK_DEFAULT = { app: DESK_APP, version: 1, start: '', chapter: '', banned: '', limits: '', bookFile: '', noProject: false, logRow: 0, page: '' };
  function validateDESK(v) {
    if (!isObj(v) || v.app !== DESK_APP || v.version !== 1) throw Error('Desk notes are not readable.');
    const out = { ...DESK_DEFAULT };
    const lim = { start: 40, chapter: 4, banned: 600, limits: 600, bookFile: 100000, page: 40 };
    for (const [k, n] of Object.entries(lim)) if (k in v) { if (typeof v[k] !== 'string' || v[k].length > n) throw Error('A desk note is invalid.'); out[k] = v[k]; }
    if ('noProject' in v) { if (typeof v.noProject !== 'boolean') throw Error('A desk setting is invalid.'); out.noProject = v.noProject; }
    if ('logRow' in v) { if (!Number.isInteger(v.logRow) || v.logRow < 0 || v.logRow > 8) throw Error('A desk setting is invalid.'); out.logRow = v.logRow; }
    return out;
  }

  let wb = blankWB(), wbRaw = null, wbBad = false;
  let det = { STACK: { wrapper: '', wrapperSearch: '', tropes: [], costume: [] } };
  let desk = { ...DESK_DEFAULT };

  function loadAll() {
    wbRaw = getRaw(KEY_WB); wbBad = false;
    if (wbRaw === null) wb = blankWB();
    else { try { wb = validateWB(JSON.parse(wbRaw)); } catch (_) { wbBad = true; wb = blankWB(); } }
    try { const r = getRaw(KEY_DET); det = r ? validateDET(JSON.parse(r)) : validateDET({}); } catch (_) { det = validateDET({}); }
    try { const r = getRaw(KEY_DESK); desk = r ? validateDESK(JSON.parse(r)) : { ...DESK_DEFAULT }; } catch (_) { desk = { ...DESK_DEFAULT }; }
  }
  function saveWBField(id, value) {
    if (wbBad) return false;
    const now = getRaw(KEY_WB);
    if (now !== wbRaw) {           // changed in another tab since we read it: take theirs, then apply this one field
      if (now === null) wb = blankWB();
      else { try { wb = validateWB(JSON.parse(now)); } catch (_) { wbBad = true; showBad(); return false; } }
      fillFields(id);
    }
    wb.answers[id] = value;
    wb.savedAt = new Date().toISOString();
    const raw = JSON.stringify(wb);
    if (setRaw(KEY_WB, raw)) { wbRaw = raw; return true; }
    return false;
  }
  function saveDET() {
    const out = {};
    for (const k of DETAIL_KEYS) if (det[k]) out[k] = det[k];
    out.STACK = det.STACK;
    return setRaw(KEY_DET, JSON.stringify(out));
  }
  function saveDESK() { return setRaw(KEY_DESK, JSON.stringify(desk)); }

  // ---------- values for prompts ----------
  const ans = id => { const v = wb.answers[id]; return typeof v === 'string' ? v.trim() : ''; };
  const stackTouched = () => !!(det.STACK.wrapper || det.STACK.tropes.length || det.STACK.costume.length || (det['SEASON DOES'] || '').trim());
  function costumeScore() { let n = det.STACK.costume.length; if ((det['SEASON DOES'] || '').trim().length > 25) n += 1; return Math.min(n, 5); }
  function verdict(n) { return n <= 1 ? 'right now this is a costume' : n <= 3 ? 'halfway, the season is doing some work' : 'a real holiday book, not a wreath on a cover'; }
  function heatBand() {
    if (det['HEAT BAND']) return det['HEAT BAND'];
    const h = parseInt(det.HEAT, 10); if (!h) return '';
    return h <= 2 ? 'clean or closed door (1–2)' : h === 3 ? 'warm, on the page but soft (3)' : 'spicy, open door (4–5)';
  }
  function detailValues() {
    const d = {};
    for (const k of ['PEN NAME', 'WORKING TITLE', 'HEAT', 'POV', 'TARGET LENGTH', 'STOP WORD', 'GENRE SHELF', 'SEASON DOES']) if ((det[k] || '').trim()) d[k] = det[k].trim();
    if (!d['WORKING TITLE'] && ans('p1-f2')) d['WORKING TITLE'] = ans('p1-f2');
    const hb = heatBand(); if (hb) d['HEAT BAND'] = hb;
    if (det.STACK.wrapper) { d.WRAPPER = det.STACK.wrapper; d['WRAPPER SEARCH'] = det.STACK.wrapperSearch || det.STACK.wrapper.toLowerCase(); }
    if (det.STACK.tropes.length) d['CORE TROPES'] = det.STACK.tropes.join(' + ');
    if (stackTouched()) { const s = costumeScore(); d['COSTUME SCORE'] = s + ' of 5, ' + verdict(s); }
    const ch = (desk.chapter || '').trim();
    if (ch) { d.N = ch; d.NN = /^\d+$/.test(ch) ? ch.padStart(2, '0') : ch; }
    return d;
  }
  function logRow() {
    if (desk.logRow) return desk.logRow;
    let last = 1;
    for (let r = 1; r <= 8; r++) if (['c1', 'c2', 'c3', 'c4'].some(c => ans(`p14-t1-r${r}-${c}`))) last = r;
    return last;
  }
  function tokenValue(key, ctx) {
    if (CTRL.has(key)) return { v: ans(key), src: 'Worksheet ' + key.match(/^p(\d+)/)[1].padStart(2, '0') + ': ' + CTRL.get(key).label };
    if (key.startsWith('d:')) { const v = (desk[key.slice(2)] || '').trim(); return { v, src: 'Your book' }; }
    if (key.startsWith('c:')) { const v = ctx && ctx[key.slice(2)] ? String(ctx[key.slice(2)]) : ''; return { v, src: 'This class' }; }
    if (key.startsWith('log:')) { const id = `p14-t1-r${logRow()}-${key.slice(4)}`; return { v: ans(id), src: 'Worksheet 14: ' + CTRL.get(id).label }; }
    if (key === 'x:ws34') {
      const lines = [];
      for (const id of ['p3-f1', 'p3-f2', 'p3-f3', 'p3-f4', 'p3-f5', 'p4-f1', 'p4-f2', 'p4-f3', 'p4-f4', 'p4-f5', 'p4-f6']) if (ans(id)) lines.push('- ' + CTRL.get(id).label + ': ' + ans(id));
      return { v: lines.length ? '\n' + lines.join('\n') + '\n' : '', src: 'Worksheets 03 and 04' };
    }
    if (key === 'x:tropes') {
      if (ans('p4-f4')) return { v: ans('p4-f4'), src: 'Worksheet 04: ' + CTRL.get('p4-f4').label };
      const parts = [];
      if (det.STACK.wrapper) parts.push(det.STACK.wrapper + ' (wrapper)');
      if (det.STACK.tropes.length) parts.push(det.STACK.tropes.join(' + '));
      return { v: parts.join(' + '), src: 'Your trope stack' };
    }
    return { v: '', src: '' };
  }

  // Build a prompt as segments: {t:text, k:'lit'|'f'|'d'|'slot', src}
  function segments(pid, ctx) {
    const P = D.prompts[pid];
    const dv = detailValues();
    const claude = new Set(P.claude);
    const out = [];
    const literal = text => {
      let last = 0;
      text.replace(/\[([^\[\]\n]{1,160})\]/g, (m, inner, at) => {
        if (at > last) out.push({ t: text.slice(last, at), k: 'lit' });
        if (inner in dv) out.push({ t: dv[inner], k: 'd', src: 'Your book: ' + inner.toLowerCase() });
        else if (inner in STACK_FALLBACK) out.push({ t: STACK_FALLBACK[inner], k: 'slot' });
        else if (claude.has(m)) out.push({ t: m, k: 'lit' });
        else out.push({ t: m, k: 'slot' });
        last = at + m.length; return m;
      });
      if (last < text.length) out.push({ t: text.slice(last), k: 'lit' });
    };
    let last = 0;
    const re = /\{\{([^|}]+)\|([\s\S]*?)\}\}/g; let m;
    while ((m = re.exec(P.text))) {
      if (m.index > last) literal(P.text.slice(last, m.index));
      const { v, src } = tokenValue(m[1], ctx);
      if (v) out.push({ t: v, k: 'f', src }); else literal(m[2]);
      last = m.index + m[0].length;
    }
    if (last < P.text.length) literal(P.text.slice(last));
    return out;
  }
  const plain = (pid, ctx) => segments(pid, ctx).map(s => s.t).join('');
  function copyText(pid, ctx) {
    let text = plain(pid, ctx);
    if (desk.noProject && pid !== 'house-rules-block') {
      const book = (desk.bookFile || '').trim();
      text = plain('house-rules-block') + '\n\n' + (book ? 'MY BOOK FILE (Brief, Codex, Outline or beat sheet so far):\n' + book + '\n\n' : '') + '---\n\n' + text;
    }
    return text;
  }

  // ---------- prompt cards ----------
  const promptCards = []; // {pid, ctx, pre, fill}
  function promptCard(pid, ctx) {
    const P = D.prompts[pid];
    const pre = el('pre', { class: 'prompt', tabindex: '0', 'aria-label': P.label });
    const fill = el('p', { class: 'fill-line' });
    const copyBtn = el('button', { type: 'button', text: 'Copy prompt', 'aria-label': 'Copy: ' + P.label });
    copyBtn.addEventListener('click', () => doCopy(copyText(pid, ctx), copyBtn, pre));
    const moreBtn = el('button', { type: 'button', class: 'secondary', text: 'Show all', 'aria-expanded': 'false' });
    moreBtn.addEventListener('click', () => { const on = pre.classList.toggle('expanded'); moreBtn.textContent = on ? 'Show less' : 'Show all'; moreBtn.setAttribute('aria-expanded', on ? 'true' : 'false'); });
    const card = el('div', { class: 'prompt-card' },
      el('div', { class: 'prompt-top' },
        el('div', null, el('div', { class: 'prompt-name', text: P.label }),
          el('div', { class: 'badges' }, el('span', { class: 'badge stage', text: P.stage }), el('span', { class: 'badge', text: P.skill })))),
      fill, pre, el('div', { class: 'prompt-actions' }, copyBtn, moreBtn));
    promptCards.push({ pid, ctx, pre, fill });
    return card;
  }
  function paintPrompt(c) {
    const segs = segments(c.pid, c.ctx);
    const frag = document.createDocumentFragment();
    let f = 0, d = 0, open = 0;
    for (const s of segs) {
      if (s.k === 'lit') frag.append(s.t);
      else if (s.k === 'f') { f++; frag.append(el('mark', { class: 'f', title: s.src, text: s.t })); }
      else if (s.k === 'd') { d++; frag.append(el('mark', { class: 'd', title: s.src, text: s.t })); }
      else { open++; frag.append(el('span', { class: 'slot', text: s.t })); }
    }
    c.pre.replaceChildren(frag);
    const bits = [];
    if (f) bits.push(el('b', { text: f + ' filled from your worksheet' }));
    if (open) bits.push(el('i', { text: open + (open === 1 ? ' blank' : ' blanks') + ' left to fill in the chat' }));
    if (!f && !open) bits.push('Ready to copy');
    const parts = []; bits.forEach((b, i) => { if (i) parts.push(' · '); parts.push(b); });
    c.fill.replaceChildren(...parts);
  }
  const paintAll = () => promptCards.forEach(paintPrompt);

  // ---------- copy ----------
  let toastTimer;
  function toast(msg) { const t = $('copy-toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }
  function doCopy(text, btn, pre) {
    const orig = 'Copy prompt';
    const done = () => { btn.textContent = 'Copied'; toast(desk.noProject ? 'Copied with your house rules and book file on top. Paste it into Claude.' : 'Copied. Paste it into your book Project in Claude.'); setTimeout(() => { btn.textContent = orig; }, 1800); };
    const fail = () => {
      try { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); pre.focus(); } catch (_) {}
      btn.textContent = 'Selected: press Ctrl+C or Cmd+C'; setTimeout(() => { btn.textContent = orig; }, 3200);
    };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fail); else fail(); } catch (_) { fail(); }
  }

  // ---------- worksheet fields ----------
  const fieldEls = new Map(); // cid -> element
  function fieldControl(cid) {
    const c = CTRL.get(cid);
    if (c.cb) {
      const box = el('input', { type: 'checkbox', id: 'w-' + cid });
      box.addEventListener('change', () => { if (saveWBField(cid, box.checked)) status(); paintAll(); });
      fieldEls.set(cid, box);
      return el('label', { class: 'check' }, box, el('span', { text: c.label }));
    }
    const ta = el('textarea', { id: 'w-' + cid, rows: c.max > 2000 ? '3' : '2', maxlength: String(c.max), spellcheck: 'true' });
    ta.addEventListener('input', () => { if (saveWBField(cid, ta.value)) status(); paintAll(); });
    fieldEls.set(cid, ta);
    const label = /-t1-/.test(cid) ? c.label.split(' · ')[1] : c.label;
    return el('div', { class: 'answer' }, el('label', { for: 'w-' + cid, text: label }), ta);
  }
  function fillFields(except) {
    for (const [cid, n] of fieldEls) {
      if (cid === except) continue;
      const v = wb.answers[cid];
      if (n.type === 'checkbox') n.checked = !!v; else if (n.value !== v) n.value = v || '';
      n.disabled = wbBad;
    }
  }
  function worksheetPane(st) {
    const pane = el('div', { class: 'pane pane-ws' }, el('div', { class: 'pane-title' }, el('span', { text: 'Your worksheet' }), el('a', { href: '../student-workbook.html#page-' + st.ws, text: 'Open in workbook ↗' })));
    if (st.ws < 7 || st.ws > 11) for (const n of st.notes.slice(0, 2)) if (!/^Block |^Break /.test(n)) pane.append(el('p', { class: 'ws-note', text: n }));
    if (st.ws === 14) {
      const sel = el('select', { id: 'log-row' }, el('option', { value: '0', text: 'Latest block I filled in' }), ...[1, 2, 3, 4, 5, 6, 7, 8].map(r => el('option', { value: String(r), text: 'Work block ' + r })));
      sel.value = String(desk.logRow);
      const holder = el('div');
      const showRow = () => {
        const r = logRow();
        holder.replaceChildren(el('fieldset', { class: 'entry' }, el('legend', { text: 'Work block ' + r }), ...['c1', 'c2', 'c3', 'c4'].map(c => fieldControl(`p14-t1-r${r}-${c}`))));
        fillFields();
      };
      sel.addEventListener('change', () => { desk.logRow = parseInt(sel.value, 10) || 0; saveDESK(); showRow(); paintAll(); });
      pane.append(el('div', { class: 'log-pick' }, el('label', { for: 'log-row', text: 'Show and log:' }), sel), holder, fieldControl('p14-f1'));
      showRow();
      return pane;
    }
    if (st.ws === 16 || st.ws === 17) {
      const rows = new Map();
      for (const cid of st.fields) {
        const m = cid.match(/-t1-r(\d)-c(\d)$/);
        if (!m) { pane.append(fieldControl(cid)); continue; }
        if (!rows.has(m[1])) { const fs = el('fieldset', { class: 'entry' }, el('legend', { text: CTRL.get(cid).label.split(' · ')[0] })); rows.set(m[1], fs); pane.append(fs); }
        const c = CTRL.get(cid);
        const ta = el('textarea', { id: 'w-' + cid, rows: '2', maxlength: String(c.max) });
        ta.addEventListener('input', () => { if (saveWBField(cid, ta.value)) status(); paintAll(); });
        fieldEls.set(cid, ta);
        rows.get(m[1]).append(el('div', { class: 'answer' }, el('label', { for: 'w-' + cid, text: c.label.split(' · ')[1] }), ta));
      }
      return pane;
    }
    for (const cid of st.fields) pane.append(fieldControl(cid));
    return pane;
  }

  // ---------- trope stack widget ----------
  function tropeWidget() {
    const wrap = el('div', { class: 'stack' });
    const genre = el('select', { id: 's-genre' }, ...D.genres.map(o => el('option', { value: o.v, text: o.t })));
    const band = el('select', { id: 's-heatband' }, ...D.heatbands.map(o => el('option', { value: o.v, text: o.t })));
    genre.value = det['GENRE SHELF'] || ''; band.value = det['HEAT BAND'] || '';
    genre.addEventListener('change', () => { det['GENRE SHELF'] = genre.value; saveDET(); refreshStack(); });
    band.addEventListener('change', () => { det['HEAT BAND'] = band.value; saveDET(); refreshStack(); });
    const wrapStatus = el('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
    const tropeStatus = el('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
    const wChips = D.wrappers.map(w => el('button', { type: 'button', class: 'chip', 'data-v': w.v, 'aria-pressed': 'false' }, w.v, el('small', { text: w.s })));
    wChips.forEach((b, i) => b.addEventListener('click', () => {
      const w = D.wrappers[i];
      if (det.STACK.wrapper === w.v) { det.STACK.wrapper = ''; det.STACK.wrapperSearch = ''; } else { det.STACK.wrapper = w.v; det.STACK.wrapperSearch = w.s; }
      saveDET(); refreshStack();
    }));
    const tChips = D.tropes.map(t => el('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', text: t }));
    let hold = 0;
    tChips.forEach((b, i) => b.addEventListener('click', () => {
      const t = D.tropes[i], at = det.STACK.tropes.indexOf(t);
      if (at >= 0) det.STACK.tropes.splice(at, 1);
      else if (det.STACK.tropes.length >= 3) { tropeStatus.textContent = 'Three at most. Unselect one before adding ' + t + '.'; hold = Date.now(); return; }
      else det.STACK.tropes.push(t);
      saveDET(); refreshStack();
    }));
    const checks = D.costume.map((txt, i) => {
      const box = el('input', { type: 'checkbox', 'data-costume': String(i) });
      box.addEventListener('change', () => {
        const at = det.STACK.costume.indexOf(i);
        if (box.checked && at < 0) det.STACK.costume.push(i);
        if (!box.checked && at >= 0) det.STACK.costume.splice(at, 1);
        saveDET(); refreshStack();
      });
      return el('label', { class: 'check' }, box, el('span', { text: txt }));
    });
    const seasonDoes = el('input', { type: 'text', id: 's-seasondoes', maxlength: '300', autocomplete: 'off', placeholder: 'e.g. The blizzard strands them at the inn, and the thing she has avoided saying for years has nowhere to go but out.' });
    seasonDoes.value = det['SEASON DOES'] || '';
    seasonDoes.addEventListener('input', () => { det['SEASON DOES'] = seasonDoes.value; saveDET(); refreshStack(); });
    const verdictEl = el('p', { class: 'verdict', role: 'status', 'aria-live': 'polite' });
    const clear = el('button', { type: 'button', class: 'secondary', text: 'Clear my trope stack' });
    clear.addEventListener('click', () => {
      det.STACK = { wrapper: '', wrapperSearch: '', tropes: [], costume: [] }; det['SEASON DOES'] = ''; det['GENRE SHELF'] = ''; det['HEAT BAND'] = '';
      genre.value = ''; band.value = ''; seasonDoes.value = ''; saveDET(); refreshStack();
    });
    function refreshStack() {
      wChips.forEach(b => b.setAttribute('aria-pressed', b.dataset.v === det.STACK.wrapper ? 'true' : 'false'));
      tChips.forEach(b => b.setAttribute('aria-pressed', det.STACK.tropes.includes(b.textContent) ? 'true' : 'false'));
      checks.forEach((lab, i) => { lab.querySelector('input').checked = det.STACK.costume.includes(i); });
      wrapStatus.textContent = det.STACK.wrapper ? 'Wrapper: ' + det.STACK.wrapper + ' (search phrase: ' + det.STACK.wrapperSearch + ')' : 'No wrapper chosen yet. Pick exactly one.';
      if (Date.now() - hold > 2500) tropeStatus.textContent = det.STACK.tropes.length + ' of 3 selected' + (det.STACK.tropes.length ? ': ' + det.STACK.tropes.join(' + ') : '');
      if (stackTouched()) { const s = costumeScore(), v = verdict(s); verdictEl.textContent = 'Costume Test: ' + s + ' of 5. ' + v.charAt(0).toUpperCase() + v.slice(1) + '.'; }
      else verdictEl.textContent = 'Tick the points that are true for your book. The score fills [COSTUME SCORE] in the prompts.';
      summary(); paintAll();
    }
    wrap.append(
      el('div', { class: 'form-grid' }, el('div', { class: 'answer' }, el('label', { for: 's-genre', text: 'Step 1 · Genre shelf' }), genre), el('div', { class: 'answer' }, el('label', { for: 's-heatband', text: 'Heat band' }), band)),
      el('h3', { text: 'Step 2 · Pick exactly one seasonal wrapper' }), el('div', { class: 'chips', role: 'group', 'aria-label': 'Seasonal wrapper' }, wChips), wrapStatus,
      el('h3', { text: 'Step 3 · Stack up to three core tropes' }), el('div', { class: 'chips', role: 'group', 'aria-label': 'Core tropes' }, tChips), tropeStatus,
      el('h3', { text: 'Step 4 · The Costume Test' }), el('div', { class: 'costume' }, checks,
        el('div', { class: 'answer' }, el('label', { for: 's-seasondoes', text: 'Point 5. In one line, what does the season make happen that could not happen in June?' }), seasonDoes)),
      verdictEl, el('div', { class: 'toolbar' }, clear));
    wrap.refresh = refreshStack;
    return wrap;
  }

  // ---------- stations & pages ----------
  function station(st) {
    const EYEBROW = { 'the-house-rules': 'Set up once · Paste into your book Project', 'the-holiday-trope-stack': 'Class 1 · Before Worksheet 04', 'the-fast-lane': 'Class 1 · Short on time? Three prompts' };
    const head = el('div', { class: 'station-head' }, el('div', { class: 'eyebrow', text: EYEBROW[st.id] || st.eyebrow }), el('h2', { id: 'h-' + st.id, text: st.title }), st.meta ? el('p', { class: 'station-meta', text: st.meta }) : null);
    const bring = st.paras.find(p => p.startsWith('Bring from the worksheet'));
    const why = st.paras.filter(p => p !== bring && !p.startsWith('On this page'));
    const promptPane = el('div', { class: 'pane' }, el('div', { class: 'pane-title' }, el('span', { text: st.id === 'the-holiday-trope-stack' ? 'Pick your stack, then copy' : st.prompts.length > 1 ? 'Your prompts' : 'Your prompt' })));
    if (bring) promptPane.append(el('p', { class: 'bring', text: bring }));
    if (why.length && st.id !== 'the-holiday-trope-stack') promptPane.append(el('details', { class: 'why' }, el('summary', { text: 'How this follows the pipeline' }), ...why.map(t => el('p', { text: t }))));
    let widget = null;
    if (st.id === 'the-holiday-trope-stack') {
      widget = tropeWidget();
      promptPane.append(el('details', { class: 'why' }, el('summary', { text: 'Why holiday books need a stack' }), ...why.slice(0, 2).map(t => el('p', { text: t }))), widget);
    }
    if (st.prompts.length) promptPane.append(el('div', { class: 'legend' }, el('span', null, el('mark', { class: 'f', text: 'green' }), ' from your worksheet'), el('span', null, el('mark', { class: 'd', text: 'gold' }), ' from your book details'), el('span', null, el('span', { class: 'slot', text: 'amber' }), ' fill in the chat')));
    for (const pid of st.prompts) promptPane.append(promptCard(pid, null));
    const body = el('div', { class: 'station-body' + (st.fields.length ? '' : ' single') });
    if (st.fields.length) body.append(worksheetPane(st));
    body.append(promptPane);
    const sec = el('section', { class: 'card station', id: st.id, 'aria-labelledby': 'h-' + st.id }, head, body);
    if (widget) sec.refresh = widget.refresh;
    return sec;
  }

  const timer = { seg: 2, running: false, endAt: 0, remaining: AGENDA[2][1] * 60000, views: [], tick: null };
  const fmt = ms => { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  function timerLeft() { return timer.running ? Math.max(0, timer.endAt - Date.now()) : timer.remaining; }
  function paintTimer(note) {
    for (const v of timer.views) {
      v.read.textContent = fmt(timerLeft());
      v.sel.value = String(timer.seg);
      v.go.textContent = timer.running ? 'Pause' : (timer.remaining < AGENDA[timer.seg][1] * 60000 && timer.remaining > 0 ? 'Resume' : 'Start');
      if (note !== undefined) v.note.textContent = note;
    }
  }
  function timerView() {
    const sel = el('select', null, ...AGENDA.map(([n, m], i) => el('option', { value: String(i), text: n + ' · ' + m + ' min' })));
    const read = el('div', { class: 'timer-read', 'aria-hidden': 'true' });
    const note = el('p', { class: 'timer-note', role: 'status', 'aria-live': 'polite' });
    const go = el('button', { type: 'button' }), reset = el('button', { type: 'button', class: 'secondary', text: 'Reset' }), next = el('button', { type: 'button', class: 'secondary', text: 'Next segment' });
    const id = 'timer-' + timer.views.length;
    sel.id = id;
    sel.addEventListener('change', () => { timer.seg = parseInt(sel.value, 10); timer.running = false; timer.remaining = AGENDA[timer.seg][1] * 60000; paintTimer(''); });
    go.addEventListener('click', () => {
      if (timer.running) { timer.remaining = timerLeft(); timer.running = false; paintTimer('Paused.'); return; }
      if (timer.remaining <= 0) timer.remaining = AGENDA[timer.seg][1] * 60000;
      timer.endAt = Date.now() + timer.remaining; timer.running = true; paintTimer(AGENDA[timer.seg][0] + ' started.');
      clearInterval(timer.tick);
      timer.tick = setInterval(() => {
        if (!timer.running) { clearInterval(timer.tick); return; }
        if (timerLeft() <= 0) { timer.running = false; timer.remaining = 0; clearInterval(timer.tick); paintTimer('Time. Save your work.'); toast(AGENDA[timer.seg][0] + ' is done. Save your work.'); return; }
        paintTimer();
      }, 500);
    });
    reset.addEventListener('click', () => { timer.running = false; timer.remaining = AGENDA[timer.seg][1] * 60000; paintTimer(''); });
    next.addEventListener('click', () => { timer.seg = (timer.seg + 1) % AGENDA.length; timer.running = false; timer.remaining = AGENDA[timer.seg][1] * 60000; paintTimer(''); });
    const v = { sel, read, note, go };
    timer.views.push(v);
    return el('div', { class: 'timer' }, el('label', { for: id, text: 'CLASS TIMER' }), sel, read, note, el('div', { class: 'toolbar' }, go, reset, next));
  }

  function pageHead(pg) {
    const card = el('section', { class: 'card class-head', 'aria-labelledby': 'ph-' + pg.id });
    const paras = pg.paras.filter(p => !/^(Leave with:|On this page)/.test(p));
    const left = el('div', null, el('div', { class: 'eyebrow', text: pg.eyebrow }), el('h2', { id: 'ph-' + pg.id, text: pg.title }));
    if (pg.goal) left.append(el('p', { class: 'lead', text: pg.goal }));
    if (pg.leave) left.append(el('p', { class: 'leave' }, el('strong', { text: 'Leave with: ' }), pg.leave));
    for (const p of paras) left.append(el('p', { class: p.startsWith('Between classes') ? 'between' : '', text: p }));
    if (pg.class) {
      card.append(el('div', { class: 'head-grid' }, left, timerView()));
      const ctx = { n: pg.class, goal: pg.goal, leave: pg.leave };
      card.append(el('h3', { text: 'Open class with the check-in' }), promptCard('p02-a', ctx));
    } else card.append(left);
    return card;
  }

  const pageEls = new Map();
  function build() {
    const tabs = $('tabs'), host = $('page-host');
    for (const pg of D.pages) {
      const a = el('a', { class: 'tab', href: '#' + pg.id }, pg.tab, pg.date ? el('small', { text: pg.date }) : pg.id === 'start-here' ? el('small', { text: 'Set up once' }) : el('small', { text: 'Toolkit' }));
      tabs.append(a);
      const page = el('div', { class: 'page', id: 'pg-' + pg.id, hidden: true }, pageHead(pg));
      for (const st of D.stations.filter(s => s.page === pg.id)) page.append(station(st));
      host.append(page);
      pageEls.set(pg.id, { page, tab: a });
    }
  }
  function defaultPage() {
    const today = new Date(); const iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    let best = 'start-here';
    for (let i = 1; i <= 5; i++) if (iso >= CLASS_DATES[i]) best = 'class-' + i;
    return best;
  }
  function show(pid, focus) {
    if (!pageEls.has(pid)) pid = defaultPage();
    for (const [id, { page, tab }] of pageEls) {
      page.hidden = id !== pid;
      if (id === pid) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
    }
    { const t = pageEls.get(pid).tab; t.parentElement.scrollLeft = Math.max(0, t.offsetLeft - 16); }
    if (desk.page !== pid) { desk.page = pid; saveDESK(); }
    if (focus) { const h = pageEls.get(pid).page.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); window.scrollTo({ top: document.querySelector('.tabs').offsetTop, behavior: 'instant' in window ? 'instant' : 'auto' }); } }
  }
  function route(focus) {
    const h = location.hash.replace(/^#/, '');
    if (pageEls.has(h)) return show(h, focus);
    const t = h && document.getElementById(h);
    if (t) { const pg = t.closest('.page'); if (pg) show(pg.id.slice(3), false); t.scrollIntoView(); return; }
    show(desk.page && pageEls.has(desk.page) ? desk.page : defaultPage(), false);
  }

  // ---------- book details panel ----------
  function bindBook() {
    $('d-heat').append(...D.heats.map(o => el('option', { value: o.v, text: o.t })));
    $('d-pov').append(...D.povs.map(o => el('option', { value: o.v, text: o.t })));
    document.querySelectorAll('[data-detail]').forEach(n => {
      const k = n.dataset.detail; n.value = det[k] || '';
      const h = () => { det[k] = n.value; saveDET(); summary(); paintAll(); };
      n.addEventListener('input', h); n.addEventListener('change', h);
    });
    document.querySelectorAll('[data-desk]').forEach(n => {
      const k = n.dataset.desk;
      if (n.type === 'checkbox') n.checked = !!desk[k]; else n.value = desk[k] || '';
      const h = () => { desk[k] = n.type === 'checkbox' ? n.checked : n.value; saveDESK(); summary(); paintAll(); $('bookfile-wrap').hidden = !desk.noProject; };
      n.addEventListener('input', h); n.addEventListener('change', h);
    });
    $('bookfile-wrap').hidden = !desk.noProject;
    if (['PEN NAME', 'WORKING TITLE', 'HEAT', 'POV'].some(k => det[k])) $('book').open = false;
  }
  function refreshBook() {
    document.querySelectorAll('[data-detail]').forEach(n => { if (document.activeElement !== n) n.value = det[n.dataset.detail] || ''; });
    document.querySelectorAll('[data-desk]').forEach(n => { if (document.activeElement !== n) { if (n.type === 'checkbox') n.checked = !!desk[n.dataset.desk]; else n.value = desk[n.dataset.desk] || ''; } });
    $('bookfile-wrap').hidden = !desk.noProject;
  }
  function summary() {
    const dv = detailValues(), a = [];
    if (dv['PEN NAME']) a.push(dv['PEN NAME']);
    if (dv['WORKING TITLE']) a.push(dv['WORKING TITLE']);
    if (dv.HEAT) a.push('heat ' + dv.HEAT + '/5');
    if (dv.POV) a.push(dv.POV);
    if (dv['TARGET LENGTH']) a.push(dv['TARGET LENGTH'] + ' words');
    if (dv.N) a.push('Chapter ' + dv.N);
    if (det.STACK.wrapper || det.STACK.tropes.length) a.push([det.STACK.wrapper, det.STACK.tropes.join(' + ')].filter(Boolean).join(' · '));
    $('book-summary').textContent = a.length ? a.join(' · ') : 'Not filled in yet. Open to fill it in once.';
  }
  function status(msg) {
    const n = CONTROLS.filter(c => c.cb ? wb.answers[c.id] : ans(c.id)).length;
    $('save-status').textContent = msg || (!storageOK ? 'Browser storage is unavailable. Answers will NOT survive leaving this page. Download a backup before you leave.'
      : wbBad ? 'Worksheet fields are locked to protect your saved workbook (see below). Book details and prompts still work.'
      : (n ? 'Saved on this device · ' + n + ' worksheet ' + (n === 1 ? 'answer' : 'answers') + ' so far.' : 'Ready. Answers save on this device as you type.'));
  }
  function showBad() {
    $('storage-warning').hidden = false;
    $('storage-message').textContent = 'Your saved workbook could not be read, so the desk will not write to it. It has been kept unchanged. Download the stored data, then import a good backup from the workbook or this desk to unlock the fields.';
    fillFields(); status();
  }

  // ---------- backup / import ----------
  function download(text, name) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
  function exportBackup() {
    const detOut = {}; for (const k of DETAIL_KEYS) if (det[k]) detOut[k] = det[k]; detOut.STACK = det.STACK;
    download(JSON.stringify({ app: DESK_APP, kind: 'backup', version: 1, savedAt: new Date().toISOString(), workbook: wbBad ? null : wb, details: detOut, desk }, null, 2), 'holiday-novella-work-desk-' + stamp() + '.json');
    $('action-status').textContent = 'Backup download started. Keep the file somewhere safe; it holds your answers and book file.';
  }
  let pending = null;
  function readImport(raw) {
    if (typeof raw !== 'string' || new Blob([raw]).size > LIMIT) throw Error('That file is too large to be a backup.');
    const v = JSON.parse(raw);
    if (isObj(v) && v.workbook === WB_NAME) return { workbook: validateWB(v), kind: 'workbook' };
    if (!isObj(v) || v.app !== DESK_APP || v.kind !== 'backup' || v.version !== 1) throw Error('This is not a work desk or student workbook backup.');
    return { kind: 'desk', workbook: v.workbook === null ? null : validateWB(v.workbook), details: validateDET(v.details), desk: validateDESK(v.desk) };
  }
  function openImport(data) {
    pending = data;
    const n = data.workbook ? CONTROLS.filter(c => c.cb ? data.workbook.answers[c.id] : String(data.workbook.answers[c.id]).trim()).length : 0;
    $('import-summary').textContent = data.kind === 'workbook'
      ? 'Student workbook backup from ' + new Date(data.workbook.savedAt).toLocaleString() + ' with ' + n + ' worksheet answers. Your book details and desk notes stay as they are.'
      : 'Work desk backup with ' + n + ' worksheet answers' + (data.details['WORKING TITLE'] ? ' for ' + data.details['WORKING TITLE'] : '') + ', plus book details, trope stack, and desk notes.';
    $('confirm-replace').checked = false; $('apply-import').disabled = true;
    const dlg = $('import-dialog'); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function applyImport() {
    if (!pending) return;
    let ok = true;
    if (pending.workbook) { const raw = JSON.stringify(pending.workbook); ok = setRaw(KEY_WB, raw) && ok; }
    if (pending.kind === 'desk') { det = pending.details; desk = pending.desk; ok = saveDET() && ok; ok = saveDESK() && ok; }
    pending = null; $('import-dialog').close ? $('import-dialog').close() : $('import-dialog').removeAttribute('open');
    loadAll(); $('storage-warning').hidden = !wbBad; refreshAllViews();
    $('action-status').textContent = ok ? 'Backup imported. Your desk now shows it.' : 'The import could not be saved in this browser. Your answers are visible but may not survive a reload.';
  }

  function refreshAllViews() {
    fillFields(document.activeElement && document.activeElement.id ? document.activeElement.id.replace(/^w-/, '') : null);
    refreshBook(); summary(); status();
    document.querySelectorAll('section.station').forEach(s => { if (s.refresh) s.refresh(); });
    paintAll();
  }

  // ---------- go ----------
  function init() {
    if (!D) { $('save-status').textContent = 'The desk data did not load. Reload the page.'; return; }
    loadAll();
    build();
    bindBook();
    fillFields();
    if (wbBad) showBad();
    summary(); status();
    document.querySelectorAll('section.station').forEach(s => { if (s.refresh) s.refresh(); });
    paintAll(); paintTimer('');
    route(false);
    window.addEventListener('hashchange', () => route(true));
    window.addEventListener('storage', e => {
      if (e.key === null || [KEY_WB, KEY_DET, KEY_DESK].includes(e.key)) {
        const active = document.activeElement && document.activeElement.id;
        loadAll(); $('storage-warning').hidden = !wbBad; refreshAllViews();
        if (active && $(active)) $(active).focus({ preventScroll: true });
        $('action-status').textContent = 'Updated with changes from your other tab.';
      }
    });
    $('export').addEventListener('click', exportBackup);
    $('backup-first').addEventListener('click', exportBackup);
    $('import').addEventListener('click', () => { $('import-file').value = ''; $('import-file').click(); });
    $('import-file').addEventListener('change', async () => {
      const f = $('import-file').files[0]; if (!f) return;
      try { openImport(readImport(await f.text())); } catch (err) { $('action-status').textContent = 'Not imported: ' + err.message + ' Nothing on this desk changed.'; }
    });
    $('confirm-replace').addEventListener('change', () => { $('apply-import').disabled = !$('confirm-replace').checked; });
    $('apply-import').addEventListener('click', applyImport);
    $('cancel-import').addEventListener('click', () => { pending = null; $('import-dialog').close ? $('import-dialog').close() : $('import-dialog').removeAttribute('open'); $('action-status').textContent = 'Import cancelled. Nothing changed.'; });
    $('download-stored').addEventListener('click', () => { const raw = getRaw(KEY_WB); if (raw === null) { $('action-status').textContent = 'Nothing is stored yet.'; return; } download(raw, 'holiday-novella-stored-workbook-' + stamp() + '.json'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
