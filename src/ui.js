// Interface: HUD, world labels, dialogs, journal, field guide, settings, minimap and input.
import * as THREE from '../vendor/three.module.min.js';
import { t, setLang, lang, dir, onLangChange } from './i18n.js';
import { STATIONS, CREW, INCIDENTS, CARDS, SAMPLE_SITES, GUIDE, JOBS, PLACES, GLOSSARY, SUITS, SAVE_KEY, stationById, incidentById, ROVER } from './data.js';
import { sfx, setSound } from './audio.js';
import { openSituation } from './activities.js';

const $ = id => document.getElementById(id);
const E = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const btn = (cls, label, fn) => { const b = E('button', cls, label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };
const pct = v => `${Math.max(0, Math.min(100, v))}%`;

export class UI {
  constructor() {
    this.sim = null; this.world = null; this.controls = null; this.camera = null;
    this.modal = $('modal'); this.sheet = $('sheet');
    this.onSheetClose = null;
    this.toastCount = 0;
    this.lastHud = 0; this.lastMap = 0;
    this.labelEls = new Map();
    this.focus = null;
    this.onAct = null; this.onRover = null;
    this.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (this.reducedMotion) document.body.classList.add('calm');
    this.readSaveInfo = this.readSave();
    this.suitColor = this.readSaveInfo?.suitColor || SUITS[0];
    this.buildStart();
    this.bindInput();
    this.buildMeters();
    onLangChange(() => this.applyText());
    this.applyText();
  }

  readSave() {
    try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  attach({ sim, world, camera, controls, onBegin }) {
    this.sim = sim; this.world = world; this.camera = camera; this.controls = controls;
    this.onBegin = onBegin;
    if (sim.settings.lang && sim.settings.lang !== 'en') setLang(sim.settings.lang).then(() => this.applyText());
    if (typeof sim.settings.textSize === 'number') this.applyTextSize(sim.settings.textSize);
    setSound(sim.settings.sound !== false);
    if (sim.settings.reduceMotion) document.body.classList.add('calm');
    this.syncSoundButton();
    this.syncStartFromSave();
  }

  get input() { return this.controls ? this.controls.input : {}; }
  get camYaw() { return this.controls ? this.controls.yaw : Math.PI; }
  get modalOpen() { return !this.modal.hidden; }
  get canDrive() { return !!this.sim && this.sim.driving && !this.modalOpen; }

  t(key, vars) { return t(key, vars); }
  sfx(name) { sfx(name); }

  // ------------------------------------------------------------------ text
  applyText() {
    for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
    const enterKey = this.readSaveInfo?.started ? 'ui.resume' : 'ui.enter';
    $('bEnter').textContent = t(enterKey);
    $('bLang').textContent = lang() === 'ar' ? 'English' : 'العربية';
    $('bNew').hidden = !this.readSaveInfo?.started;
    document.title = 'Madar-Team-Moon';
    if (this.meterEls) for (const [k, el] of Object.entries(this.meterEls)) { el.lab.textContent = t(`meter.${k}`); el.m.title = t(`meter.${k}`); }
    if (this.sim) { this.meters(); this.applyTextSize(this.sim.settings.textSize); }
  }

  applyTextSize(v) {
    const size = Math.max(0.85, Math.min(1.25, Number(v) || 1));
    document.documentElement.style.setProperty('--fs', String(size));
  }

  toggleLang() {
    const next = lang() === 'ar' ? 'en' : 'ar';
    setLang(next).then(ok => {
      if (!ok) { this.toast('العربية غير متوفرة بعد — English only for now'); return; }
      if (this.sim) { this.sim.settings.lang = next; this.sim.save(); }
      this.applyText();
      this.closeSheet();
      this.toast(next === 'ar' ? 'تم تغيير اللغة' : 'Language switched to English');
    });
  }

  // ------------------------------------------------------------------ start screen
  buildStart() {
    const wrap = $('swatches');
    wrap.replaceChildren();
    this.swatches = SUITS.map((hex, i) => {
      const b = btn('sw' + (hex === this.suitColor ? ' on' : ''), '');
      b.style.background = hex;
      b.setAttribute('aria-label', `Suit colour ${i + 1}`);
      b.addEventListener('click', () => {
        this.suitColor = hex;
        for (const s of this.swatches) s.classList.remove('on');
        b.classList.add('on');
        sfx('tap');
      });
      wrap.append(b);
      return b;
    });
    $('bEnter').addEventListener('click', () => this.begin(false));
    $('bNew').addEventListener('click', () => {
      if (confirm(t('ui.resetAsk'))) this.begin(true);
    });
    $('bLang').addEventListener('click', () => this.toggleLang());
  }

  syncStartFromSave() {
    const s = this.readSaveInfo;
    if (s?.started) { $('bNew').hidden = false; $('bEnter').textContent = t('ui.resume'); }
  }

  begin(fresh) {
    $('start').hidden = true;
    $('hud').hidden = false;
    sfx('chime');
    if (this.onBegin) this.onBegin(fresh, this.suitColor);
  }

  showStart() { $('start').hidden = false; $('hud').hidden = true; }

  syncSoundButton() {
    const on = this.sim ? this.sim.settings.sound !== false : true;
    const b = $('bSound');
    b.classList.toggle('muted', !on);
    b.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  }

  // ------------------------------------------------------------------ meters + hud
  buildMeters() {
    const wrap = $('meters');
    wrap.replaceChildren();
    this.meterEls = {};
    for (const key of ['power', 'water', 'air', 'food', 'mood']) {
      const m = E('div', 'meter');
      const h = E('div', 'mh');
      const lab = E('span', null, t(`meter.${key}`));
      const val = E('b', null, '0');
      h.append(lab, val);
      const bar = E('div', 'bar');
      const fill = E('i');
      bar.append(fill);
      m.append(h, bar);
      m.title = t(`meter.${key}`);
      wrap.append(m);
      this.meterEls[key] = { m, val, fill, lab };
    }
  }

  meters() {
    if (!this.sim) return;
    for (const [key, el] of Object.entries(this.meterEls)) {
      const v = this.sim.meters[key] ?? 60;
      el.val.textContent = `${Math.round(v)}%`;
      el.fill.style.width = pct(v);
      const color = v < 35 ? 'var(--rose)' : v < 55 ? 'var(--gold)' : key === 'mood' ? 'var(--gold)' : 'var(--mint)';
      el.fill.style.background = color;
      el.m.classList.toggle('low', v < 40);
    }
  }

  updateHUD(sim) {
    const now = performance.now();
    if (now - this.lastHud < 140) return;
    this.lastHud = now;
    const c = sim.clock();
    const chip = $('clock');
    const hh = String(c.h).padStart(2, '0'), mm = String(c.m).padStart(2, '0');
    chip.textContent = c.sleeping ? `☾ ${t('ui.clockSleep')} ${hh}:${mm}` : `☀ ${t('ui.clockDay', { d: c.day, t: `${hh}:${mm}` })}`;
    // objective
    const o = sim.objectiveSummary();
    $('objT').textContent = t(`${o.key}.t`, { n: o.n ?? '', s: o.s ? t(o.s) : '' });
    $('objD').textContent = t(`${o.key}.d`);
    // crew
    if (now - (this.lastCrew || 0) > 500) {
      this.lastCrew = now;
      const wrap = $('crew');
      wrap.replaceChildren();
      for (const b of sim.crew.bots) {
        const row = E('div', 'cr');
        const dot = E('div', 'dot', t(`crew.${b.id}.name`).slice(0, 1));
        dot.style.background = CREW.find(c2 => c2.id === b.id).color;
        const info = E('div');
        const nm = E('b', null, t(`crew.${b.id}.name`));
        const st = E('span', null, t(`state.${b.state}`) || '');
        info.append(nm, st);
        row.append(dot, info);
        wrap.append(row);
      }
    }
    this.meters();
    const openCount = sim.openIncidents().length;
    const badge = $('badge');
    badge.hidden = openCount === 0;
    badge.textContent = String(openCount);
    if (now - this.lastMap > 250) { this.lastMap = now; this.drawMinimap(sim); }
  }

  // ------------------------------------------------------------------ world labels
  drawLabels(camera, sim) {
    const w = window.innerWidth, h = window.innerHeight;
    const v = this._v || (this._v = new THREE.Vector3());
    const origin = camera.position;
    const add = (key, text, pos, cls) => {
      let el = this.labelEls.get(key);
      if (!el) { el = E('div', 'wl ' + (cls || '')); $('labels').append(el); this.labelEls.set(key, el); }
      if (!el._t || el._t !== text) { el.textContent = text; el._t = text; }
      const dx = pos.x - origin.x, dy = pos.y - origin.y, dz = pos.z - origin.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 78) { el.style.display = 'none'; return; }
      v.set(pos.x, pos.y, pos.z).project(camera);
      if (v.z > 1 || v.z < -1) { el.style.display = 'none'; return; }
      const p = { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
      if (p.x < -80 || p.x > w + 80 || p.y < 118 || p.y > h + 40) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      el.style.transform = `translate(-50%,-100%) translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
      el.style.opacity = String(Math.max(0.25, 1 - d / 90));
    };
    // Only the nearest few station labels are shown, so the sky stays readable.
    const px = camera.position.x, pz = camera.position.z;
    const list = STATIONS.map(st => ({ st, d: Math.hypot(st.x - px, st.z - pz) }))
      .filter(o => o.d < 52)
      .sort((a, b) => a.d - b.d);
    const shown = new Set(list.slice(0, 3).map(o => o.st.id));
    for (const st of STATIONS) {
      const active = sim.activeIncidentFor(st.id);
      if (active) shown.add(st.id);
    }
    for (const st of STATIONS) {
      const key = `st.${st.id}`;
      if (!shown.has(st.id)) { this.labelEls.get(key)?.style.setProperty('display', 'none'); continue; }
      add(key, t(`station.${st.id}.name`), this.world.labelPoint(st.id), sim.activeIncidentFor(st.id) ? 'sel' : '');
    }
    for (const b of sim.crew.bots) {
      const d = Math.hypot(b.pos.x - px, b.pos.z - pz);
      const key = `bot.${b.id}`;
      if (d > 30) { this.labelEls.get(key)?.style.setProperty('display', 'none'); continue; }
      add(key, t(`crew.${b.id}.name`), { x: b.pos.x, y: b.pos.y + 2.15, z: b.pos.z }, 'bot');
    }
    if (!sim.driving) add('rover', `🛻 ${t('ui.drive')}`, { x: sim.rover.pos.x, y: sim.rover.pos.y + 2.3, z: sim.rover.pos.z }, 'bot');
    else this.labelEls.get('rover')?.style.setProperty('display', 'none');
  }

  // ------------------------------------------------------------------ minimap
  drawMinimap(sim) {
    const cv = $('map'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
    const scale = (W / 2 - 6) / 110;
    const mp = (x, z) => [cx + x * scale, cy + z * scale];
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, W / 2 - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(14,26,42,.92)'; ctx.fillRect(0, 0, W, H);
    // rings
    ctx.strokeStyle = 'rgba(120,170,200,.16)';
    for (const r of [30, 60, 90]) { ctx.beginPath(); ctx.arc(cx, cy, r * scale, 0, Math.PI * 2); ctx.stroke(); }
    // sample sites
    for (const s of SAMPLE_SITES) {
      const [x, y] = mp(s.x, s.z);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = sim.samples.has(s.id) ? '#85e0b0' : '#7f95a8';
      ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore();
    }
    // stations
    for (const st of STATIONS) {
      const [x, y] = mp(st.x, st.z);
      const active = sim.activeIncidentFor(st.id);
      const resolved = INCIDENTS.some(i => i.station === st.id && sim.isResolved(i.id));
      ctx.fillStyle = active ? '#f1c36d' : resolved ? '#85e0b0' : sim.visited.has(st.id) ? '#69d4e7' : '#586c7e';
      const s = st.kind === 'pad' ? 3 : 2.4;
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
    }
    // rover
    const [rx, ry] = mp(sim.rover.pos.x, sim.rover.pos.z);
    ctx.fillStyle = '#ff9d93';
    ctx.beginPath(); ctx.arc(rx, ry, 2.6, 0, Math.PI * 2); ctx.fill();
    // player arrow
    const [px, py] = mp(sim.player.pos.x, sim.player.pos.z);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-sim.player.facing + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.4); ctx.lineTo(-4.5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // bots
    for (const b of sim.crew.bots) {
      const [x, y] = mp(b.pos.x, b.pos.z);
      ctx.fillStyle = CREW.find(c => c.id === b.id).color;
      ctx.beginPath(); ctx.arc(x, y, 1.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(190,220,235,.8)';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, 11);
  }

  // ------------------------------------------------------------------ toasts + prompt
  toast(text, kind = 'info') {
    if (!text) return;
    const wrap = $('toasts');
    const el = E('div', 'toast', text);
    if (kind === 'incident') { el.style.borderColor = 'var(--gold)'; }
    if (kind === 'quiet') { el.style.background = 'rgba(16,28,44,.9)'; }
    wrap.append(el);
    this.toastCount++;
    setTimeout(() => { el.remove(); this.toastCount--; }, kind === 'quiet' ? 3400 : 4600);
    while (wrap.children.length > 4) wrap.firstChild.remove();
  }

  savedPulse() { /* autosave is deliberately quiet */ }

  prompt(key, text) {
    const el = $('prompt');
    el.replaceChildren();
    if (key) el.append(E('span', 'key', key));
    el.append(E('span', null, text));
    el.hidden = false;
  }
  hidePrompt() { $('prompt').hidden = true; }

  caption(name, color, text) {
    const el = $('caption');
    el.replaceChildren();
    const dot = E('div', 'dot', (name || '?').slice(0, 1));
    dot.style.background = color || 'var(--cyan)';
    const body = E('div');
    body.append(E('b', null, name + ': '), document.createTextNode(text));
    el.append(dot, body);
    el.hidden = false;
  }
  hideCaption() { $('caption').hidden = true; }

  celebrate(inc) {
    sfx('chime');
    this.toast(t('ui.toastSolved', { t: t(`inc.${inc.id}.title`) }));
    this.meters();
  }

  badge() { /* the badge is refreshed inside updateHUD */ }

  // ------------------------------------------------------------------ sheets
  openSheet(node, wide = false, onClose = null) {
    this.sheet.classList.toggle('wide', wide);
    this.sheet.replaceChildren(node);
    this.modal.hidden = false;
    this.onSheetClose = onClose;
    try { this.sheet.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    sfx('open');
  }
  closeSheet() {
    this.modal.hidden = true;
    this.sheet.replaceChildren();
    this.onSheetClose = null;
    this.hideCaption();
    sfx('close');
  }
  requestClose() { if (this.onSheetClose) this.onSheetClose(); else this.closeSheet(); }

  sheetShell({ title, sub, avatar, color, body, foot, wide }) {
    const root = E('div');
    const head = E('div', 'sh');
    if (avatar) {
      const av = E('div', 'av', avatar);
      if (color) av.style.background = color;
      head.append(av);
    }
    const ht = E('div');
    ht.append(E('h3', null, title));
    if (sub) ht.append(E('p', null, sub));
    const sp = E('div', 'sp');
    const close = btn('ib', '×', () => this.requestClose());
    close.setAttribute('aria-label', t('ui.close'));
    sp.append(close);
    head.append(ht, sp);
    const sb = E('div', 'sb');
    if (body) sb.append(body);
    const sf = E('div', 'sf');
    if (foot) sf.append(foot);
    root.append(head, sb, sf);
    this.openSheet(root, wide, null);
    return { root, body: sb, foot: sf };
  }

  // ------------------------------------------------------------------ situation board
  openBoard() {
    const sim = this.sim;
    const body = E('div');
    body.append(E('p', null, t('ui.boardNote')));
    const open = sim.openIncidents();
    if (!open.length) body.append(E('div', 'note', t('ui.boardEmpty')));
    for (const inc of open) {
      const st = sim.incidents[inc.id];
      const card = E('div', 'card2');
      const head = E('div', 'row');
      const title = E('h5', null, t(`inc.${inc.id}.title`));
      head.append(title);
      const badge = E('span', 'badge ' + (st.state === 'new' ? 'new' : ''), st.state === 'new' ? t('ui.boardNew') : st.state === 'snoozed' ? t('ui.boardLeave') : t('ui.boardMine'));
      head.append(badge);
      card.append(head);
      card.append(E('div', 'r', `${t(`station.${inc.station}.name`)} · ${t(`crew.${inc.bot}.name`)}`));
      card.append(E('p', null, t(`inc.${inc.id}.report`)));
      const bar = E('div', 'sev');
      const fill = E('i'); fill.style.width = `${(inc.gravity / 3) * 100}%`; bar.append(fill);
      card.append(bar);
      const row = E('div', 'row');
      row.style.marginTop = '.55rem';
      row.append(btn('btn primary', st.state === 'new' ? t('ui.boardOpen') : t('ui.boardResume'), () => {
        sfx('tap');
        openSituation(sim, this, inc.id);
      }));
      if (st.state !== 'snoozed') row.append(btn('btn ghost', t('ui.boardLeave'), () => { sim.snoozeIncident(inc.id); this.openBoard(); }));
      card.append(row);
      body.append(card);
    }
    const handled = INCIDENTS.filter(i => sim.isResolved(i.id));
    if (handled.length) {
      body.append(E('h4', null, t('ui.boardDone')));
      const wrap = E('div', 'tags');
      for (const inc of handled) wrap.append(E('span', 'got', t(`inc.${inc.id}.title`)));
      body.append(wrap);
    }
    const crewed = INCIDENTS.filter(i => sim.incidents[i.id].state === 'crew');
    if (crewed.length) {
      body.append(E('h4', null, t('ui.boardCrew')));
      body.append(E('p', null, t('ui.boardCrewNote')));
    }
    this.sheetShell({
      title: t('ui.boardTitle'), sub: `${sim.resolvedCount()} / ${INCIDENTS.length}`, avatar: 'B',
      body, wide: true, foot: btn('btn', t('ui.close'), () => this.closeSheet()),
    });
  }

  // ------------------------------------------------------------------ station panel
  openStation(id) {
    const sim = this.sim;
    const st = stationById(id);
    if (!st) return;
    sim.visit(id);
    const body = E('div');
    body.append(E('p', null, t(`station.${id}.desc`)));
    const cards = sim.cardsFor(id);
    const found = sim.cardsFound(id);
    body.append(E('h4', null, `${t('ui.journalCards')} · ${found}/${cards.length}`));
    const grid = E('div', 'grid2');
    for (const cid of cards) {
      if (sim.hasCard(cid)) {
        const c = E('div', 'card2');
        c.append(E('h5', null, t(`card.${cid}.t`)));
        c.append(E('p', null, t(`card.${cid}.d`)));
        grid.append(c);
      } else {
        const c = E('div', 'card2');
        c.style.opacity = '.45';
        c.append(E('h5', null, '? ? ?'));
        c.append(E('p', null, t('ui.look')));
        grid.append(c);
      }
    }
    body.append(grid);
    const active = sim.activeIncidentFor(id);
    if (active) {
      const inc = E('div', 'card2');
      inc.style.borderColor = 'var(--gold)';
      inc.append(E('h5', null, t(`inc.${active.id}.title`)));
      inc.append(E('p', null, t(`inc.${active.id}.report`)));
      grid.after(inc);
    }
    const foot = E('div');
    foot.style.display = 'flex'; foot.style.gap = '.5rem'; foot.style.flexWrap = 'wrap';
    if (found < cards.length) {
      foot.append(btn('btn primary', t('ui.look'), () => {
        const cid = sim.lookCloser(id);
        if (cid) {
          this.toast(t('ui.toastCard', { t: t(`card.${cid}.t`) }));
          this.speak(t(`card.${cid}.t`) + '. ' + t(`card.${cid}.d`));
          this.sfx('good');
          this.openStation(id);
        }
      }));
    }
    if (active) foot.append(btn('btn', t('ui.openSituation'), () => openSituation(sim, this, active.id)));
    const bot = CREW.find(c => c.id === st.crew[0]);
    if (bot) foot.append(btn('btn ghost', `${t('ui.talk')} · ${t(`crew.${bot.id}.name`)}`, () => this.openTalk(bot.id)));
    foot.append(btn('btn ghost', t('ui.close'), () => this.closeSheet()));
    this.sheetShell({
      title: t(`station.${id}.name`),
      sub: t('ui.inspect'),
      avatar: t(`station.${id}.name`).slice(0, 1), body, wide: false, foot,
    });
  }

  // ------------------------------------------------------------------ bot conversation
  openTalk(id) {
    const sim = this.sim;
    const bot = sim.crew.bot(id);
    if (bot) sim.crew.talkTo(id, performance.now() / 1000 + 90);
    const topics = { maya: ['plan', 'day', 'storm', 'help'], omar: ['water', 'air', 'fix', 'help'], amina: ['plants', 'ice', 'science', 'help'], leo: ['rover', 'power', 'comms', 'help'], sofia: ['health', 'sleep', 'dust', 'help'] }[id] || ['help'];
    const body = E('div');
    const greet = E('div', 'say');
    const dot = E('div', 'dot', t(`crew.${id}.name`).slice(0, 1));
    dot.style.background = CREW.find(c => c.id === id).color;
    const bubble = E('div');
    bubble.append(E('p', null, t(`crew.${id}.bio`)));
    greet.append(dot, bubble);
    body.append(greet);
    body.append(E('h4', null, t('ui.ask')));
    for (const topic of topics) {
      const b = btn('opt', t(`talk.${id}.${topic}`));
      b.addEventListener('click', () => {
        this.speak(t(`talk.${id}.${topic}`));
        const say = E('div', 'say');
        const d2 = E('div', 'dot', t(`crew.${id}.name`).slice(0, 1));
        d2.style.background = CREW.find(c => c.id === id).color;
        const bb = E('div');
        bb.append(E('p', null, t(`talk.${id}.${topic}`)));
        say.append(d2, bb);
        body.append(say);
        body.scrollTop = body.scrollHeight;
        b.classList.add('on');
      });
      body.append(b);
    }
    this.sheetShell({
      title: t(`crew.${id}.name`), sub: t(`crew.${id}.role`),
      avatar: t(`crew.${id}.name`).slice(0, 1), color: CREW.find(c => c.id === id).color,
      body, foot: btn('btn', t('ui.close'), () => this.closeSheet()),
    });
  }

  // ------------------------------------------------------------------ journal
  openJournal(tab = 'cards') {
    const sim = this.sim;
    const body = E('div');
    const tabs = E('div', 'tabs');
    const defs = [['cards', t('ui.journalCards')], ['situations', t('ui.journalSolved')], ['skills', t('ui.journalBadges')], ['samples', t('ui.journalSites')]];
    const pane = E('div');
    const render = which => {
      for (const b of tabs.children) b.classList.toggle('on', b.dataset.tab === which);
      pane.replaceChildren();
      if (which === 'cards') {
        if (sim.cards.size === 0) pane.append(E('div', 'note', t('ui.journalEmpty')));
        for (const st of STATIONS) {
          const ids = sim.cardsFor(st.id);
          if (!ids.some(c => sim.hasCard(c))) continue;
          pane.append(E('h4', null, t(`station.${st.id}.name`)));
          for (const cid of ids.filter(c => sim.hasCard(c))) {
            const c = E('div', 'card2');
            c.append(E('h5', null, t(`card.${cid}.t`)));
            c.append(E('p', null, t(`card.${cid}.d`)));
            pane.append(c);
          }
        }
        pane.append(E('p', null, t('journal.tip')));
      } else if (which === 'situations') {
        if (!sim.solved.length) pane.append(E('div', 'note', t('ui.journalNone')));
        for (const id of sim.solved) {
          const c = E('div', 'card2');
          c.append(E('h5', null, t(`inc.${id}.title`)));
          c.append(E('p', null, t(`inc.${id}.why`)));
          pane.append(c);
        }
      } else if (which === 'skills') {
        const skills = [...new Set(sim.solved.map(id => t(`inc.${id}.skill`)))];
        if (!skills.length) pane.append(E('div', 'note', t('ui.journalNone')));
        const tags = E('div', 'tags');
        for (const s of skills) tags.append(E('span', 'got', s));
        pane.append(tags);
        pane.append(E('p', null, t('guide.safety.p.1')));
      } else {
        if (!sim.samples.size) pane.append(E('div', 'note', t('ui.journalNone')));
        for (const s of SAMPLE_SITES) {
          if (!sim.samples.has(s.id)) continue;
          const c = E('div', 'card2');
          c.append(E('h5', null, t(`sampleSite.${s.id}`)));
          c.append(E('p', null, t(`sampleSiteText.${s.id}`)));
          pane.append(c);
        }
      }
    };
    for (const [key, label] of defs) {
      const b = btn('tab', label, () => render(key));
      b.dataset.tab = key;
      tabs.append(b);
    }
    body.append(tabs, pane);
    render(tab);
    this.sheetShell({
      title: t('ui.journalTitle'), sub: `${sim.cards.size} ${t('ui.journalCards').toLowerCase()} · ${sim.solved.length} ${t('ui.journalSolved').toLowerCase()}`,
      avatar: 'J', body, wide: true, foot: btn('btn', t('ui.close'), () => this.closeSheet()),
    });
  }

  // ------------------------------------------------------------------ field guide
  openGuide(chapter = 'day') {
    const body = E('div');
    const tabs = E('div', 'tabs');
    const pane = E('div');
    const render = which => {
      for (const b of tabs.children) b.classList.toggle('on', b.dataset.tab === which);
      pane.replaceChildren();
      const ch = t(`guide.${which}`);
      pane.append(E('h4', null, ch.t));
      for (const p of ch.p || []) pane.append(E('p', null, p));
      if (which === 'jobs') {
        for (const id of JOBS) {
          const c = E('div', 'card2');
          c.append(E('h5', null, t(`guide.jobs.rows.${id}.t`)));
          c.append(E('p', null, t(`guide.jobs.rows.${id}.d`)));
          pane.append(c);
        }
      }
      if (which === 'loop') {
        (t('guide.loop.steps') || []).forEach((s, i) => {
          const c = E('div', 'card2');
          c.append(E('div', 'r', `${i + 1}. ${s[0]}`));
          c.append(E('p', null, s[1]));
          pane.append(c);
        });
      }
      if (which === 'places') {
        for (const id of PLACES) {
          const c = E('div', 'card2');
          c.append(E('h5', null, t(`place.${id}.t`)));
          c.append(E('p', null, t(`place.${id}.d`)));
          pane.append(c);
        }
      }
      if (which === 'glossary') {
        for (const id of GLOSSARY) {
          const c = E('div', 'card2');
          c.append(E('h5', null, t(`glossary.${id}.t`)));
          c.append(E('p', null, t(`glossary.${id}.d`)));
          pane.append(c);
        }
      }
      pane.scrollTop = 0;
    };
    for (const key of GUIDE) {
      const b = btn('tab', t(`guide.${key}.t`), () => render(key));
      b.dataset.tab = key;
      tabs.append(b);
    }
    body.append(tabs, pane);
    render(chapter);
    this.sheetShell({
      title: t('guide.title'), sub: t('ui.tag'), avatar: 'G', body, wide: true,
      foot: btn('btn', t('ui.close'), () => this.closeSheet()),
    });
  }

  // ------------------------------------------------------------------ settings
  openSettings() {
    const sim = this.sim;
    const body = E('div');
    const row = (label) => { const r = E('div', 'setrow'); r.append(E('div', null, label)); body.append(r); return r; };
    // language
    const lr = row(t('ui.language'));
    const seg = E('div', 'seg');
    for (const [code, name] of [['en', 'English'], ['ar', 'العربية']]) {
      const b = btn('btn' + (lang() === code ? ' on' : ''), name, () => {
        setLang(code).then(ok => {
          if (!ok) { this.toast('العربية غير متوفرة بعد'); return; }
          sim.settings.lang = code; sim.save();
          this.applyText(); this.closeSheet(); this.toast(code === 'ar' ? 'تم تغيير اللغة' : 'Language switched to English');
        });
      });
      seg.append(b);
    }
    lr.append(seg);
    // text size
    const tr = row(t('ui.textSize'));
    const tseg = E('div', 'seg');
    [[0.9, 'A'], [1, 'A'], [1.15, 'A']].forEach(([v], i) => {
      const b = btn('btn' + ((sim.settings.textSize || 1) === v ? ' on' : ''), 'A', () => {
        sim.settings.textSize = v; sim.save(); this.applyTextSize(v); this.closeSheet(); this.openSettings();
      });
      b.style.fontSize = `${0.8 + i * 0.18}rem`;
      tseg.append(b);
    });
    tr.append(tseg);
    // sound
    const sr = row(t('ui.sound'));
    const sseg = E('div', 'seg');
    for (const on of [true, false]) {
      const b = btn('btn' + ((sim.settings.sound !== false) === on ? ' on' : ''), on ? t('ui.soundOn') : t('ui.soundOff'), () => {
        sim.settings.sound = on; sim.save(); setSound(on);
        this.syncSoundButton();
        this.closeSheet(); this.openSettings();
      });
      sseg.append(b);
    }
    sr.append(sseg);
    // read aloud
    const rr = row(t('ui.readAloud'));
    const rseg = E('div', 'seg');
    for (const on of [true, false]) {
      const b = btn('btn' + (!!sim.settings.readAloud === on ? ' on' : ''), on ? t('ui.soundOn') : t('ui.soundOff'), () => {
        sim.settings.readAloud = on; sim.save();
        if (on) this.speak(t('ui.readAloud'));
        this.closeSheet(); this.openSettings();
      });
      rseg.append(b);
    }
    rr.append(rseg);
    // reduce motion
    const mr = row(t('ui.motion'));
    const mseg = E('div', 'seg');
    for (const on of [true, false]) {
      const b = btn('btn' + (!!sim.settings.reduceMotion === on ? ' on' : ''), on ? t('ui.soundOn') : t('ui.soundOff'), () => {
        sim.settings.reduceMotion = on; sim.save();
        document.body.classList.toggle('calm', on);
        this.closeSheet(); this.openSettings();
      });
      mseg.append(b);
    }
    mr.append(mseg);
    // reset
    const reset = row(t('ui.reset'));
    const rb = btn('btn warn', t('ui.reset'), () => {
      const confirmBox = E('div');
      confirmBox.append(E('p', null, t('ui.resetAsk')));
      const row2 = E('div', 'row');
      row2.append(btn('btn warn', t('ui.resetYes'), () => {
        localStorage.removeItem(SAVE_KEY);
        location.reload();
      }));
      row2.append(btn('btn ghost', t('ui.cancel'), () => confirmBox.remove()));
      confirmBox.append(row2);
      body.append(confirmBox);
    });
    reset.append(rb);
    body.append(E('p', null, t('ui.aboutText')));
    body.append(E('div', 'note', t('ui.foot')));
    this.sheetShell({
      title: t('ui.settings'), sub: 'Madar-Team-Moon 1.0', avatar: 'S', body, wide: false,
      foot: btn('btn', t('ui.close'), () => this.closeSheet()),
    });
  }

  // ------------------------------------------------------------------ pause
  openPause() {
    const body = E('div');
    body.append(E('p', null, t('ui.pauseNote')));
    const row = E('div', 'row');
    row.append(btn('btn primary', t('ui.resumeGame'), () => this.closeSheet()));
    row.append(btn('btn ghost', t('ui.guide'), () => this.openGuide()));
    row.append(btn('btn ghost', t('ui.settings'), () => this.openSettings()));
    body.append(row);
    this.sheetShell({ title: t('ui.pause'), sub: t('ui.team'), avatar: 'II', body, foot: btn('btn', t('ui.close'), () => this.closeSheet()) });
  }

  // ------------------------------------------------------------------ speech
  speak(text) {
    if (!this.sim?.settings.readAloud || !text) return;
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[•●]/g, ' '));
      u.lang = lang() === 'ar' ? 'ar-SA' : 'en-US';
      u.rate = 0.98;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------------ input
  bindInput() {
    const input = { forward: false, back: false, left: false, right: false, run: false, jump: false, up: false, down: false };
    this._rawInput = input;
    const keyMap = {
      KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump',
    };
    window.addEventListener('keydown', e => {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      const k = keyMap[e.code];
      if (k) { input[k] = true; if (!this.modalOpen) e.preventDefault(); }
      if (e.code === 'Escape') { if (this.modalOpen) this.requestClose(); else this.openPause(); }
      if (e.code === 'KeyE' && !this.modalOpen) { this.onAct?.(); }
      if (e.code === 'KeyR' && !this.modalOpen) { this.onRover?.(); }
      if (e.code === 'KeyM' && !this.modalOpen) { this.openJournal(); }
      if (e.code === 'KeyG' && !this.modalOpen) { this.openGuide(); }
      if (e.code === 'KeyB' && !this.modalOpen) { this.openBoard(); }
      if (e.code === 'KeyP' && !this.modalOpen) { this.openPause(); }
    });
    window.addEventListener('keyup', e => {
      const k = keyMap[e.code];
      if (k) input[k] = false;
    });
    window.addEventListener('blur', () => { for (const k of Object.keys(input)) input[k] = false; });

    $('bSound').addEventListener('click', () => {
      if (!this.sim) return;
      const on = this.sim.settings.sound === false;
      this.sim.settings.sound = on; this.sim.save(); setSound(on);
      this.syncSoundButton();
      if (on) sfx('good');
    });
    $('bSet').addEventListener('click', () => this.openSettings());
    $('bBoard').addEventListener('click', () => { sfx('tap'); this.openBoard(); });
    $('bJournal').addEventListener('click', () => { sfx('tap'); this.openJournal(); });
    $('bGuide').addEventListener('click', () => { sfx('tap'); this.openGuide(); });
    this.modal.addEventListener('click', e => { if (e.target === this.modal) this.requestClose(); });

    // touch joystick
    const stick = $('stick');
    const knob = stick.querySelector('i');
    let stickId = null, origin = null;
    const moveStick = e => {
      const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
      const max = stick.clientWidth * 0.34;
      const d = Math.hypot(dx, dy) || 1;
      const f = Math.min(1, max / d);
      knob.style.transform = `translate(${dx * f}px,${dy * f}px)`;
      input.left = dx < -max * 0.28 && Math.abs(dx) > Math.abs(dy) * 0.5;
      input.right = dx > max * 0.28 && Math.abs(dx) > Math.abs(dy) * 0.5;
      input.forward = dy < -max * 0.28;
      input.back = dy > max * 0.28;
      input.run = d > max * 1.4;
    };
    stick.addEventListener('pointerdown', e => {
      stickId = e.pointerId; origin = { x: e.clientX, y: e.clientY };
      stick.setPointerCapture(e.pointerId); e.preventDefault();
    });
    stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) moveStick(e); });
    const endStick = e => {
      if (e.pointerId !== stickId) return;
      stickId = null; knob.style.transform = '';
      input.left = input.right = input.forward = input.back = input.run = false;
    };
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    $('bAct').addEventListener('click', () => this.onAct?.());
    $('bJump').addEventListener('click', () => { this.controls?.hop(); });
  }

  // The real input object used by the simulation (touch or keyboard).
  get inputState() { return this._rawInput; }
}
