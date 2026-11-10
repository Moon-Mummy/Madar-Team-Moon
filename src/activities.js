// The six kinds of situation, plus the shared reflection step.
// Everything is plain DOM so it works with keyboard, touch and a screen reader.
import { t } from './i18n.js';
import { SCEN, HINTS } from './scenarios.js';
import { incidentById, CREW } from './data.js';

const E = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const btn = (cls, label, onClick) => {
  const b = E('button', cls, label);
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  return b;
};
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export function openSituation(sim, ui, id) {
  const inc = incidentById(id);
  if (!inc) return null;
  sim.startIncident(id);
  return new Activity(sim, ui, inc).open();
}

class Activity {
  constructor(sim, ui, inc) {
    this.sim = sim; this.ui = ui; this.inc = inc;
    this.id = inc.id;
    this.spec = SCEN[inc.id] || { kind: 'mcq', steps: 1, correct: [0] };
    this.crew = CREW.find(c => c.id === inc.npc) || CREW[0];
    this.phase = 'work';
    this.hintLevel = 0;
    this.errors = 0;
    this.step = 0;
    this.state = {};
    this.startedAt = performance.now();
  }

  tt(key, vars) { return this.ui.t(key, vars); }

  // ------------------------------------------------------------------ sheet chrome
  open() {
    this.root = E('div');
    const head = E('div', 'sh');
    const crewName = this.tt(`crew.${this.crew.id}.name`);
    const av = E('div', 'av', crewName.slice(0, 1));
    av.style.background = this.crew.color;
    const ht = E('div');
    const h3 = E('h3', null, this.tt(`inc.${this.id}.title`));
    const p = E('p', null, `${crewName} · ${this.tt(`crew.${this.crew.id}.role`)}`);
    ht.append(h3, p);
    const sp = E('div', 'sp');
    const close = btn('ib', '×', () => this.leave());
    close.setAttribute('aria-label', this.tt('ui.close'));
    sp.append(close);
    head.append(av, ht, sp);

    this.bodyEl = E('div', 'sb');
    this.footEl = E('div', 'sf');
    this.root.append(head, this.bodyEl, this.footEl);
    this.ui.openSheet(this.root, true, () => this.leave());
    this.render();
    // A little artwork at the top of the sheet, when there is a picture for this task.
    // The situation opens with the crew member speaking, not with a wall of text.
    this.ui.sayLine?.(this.crew.id, this.tt(`inc.${this.id}.npc`));
    return this;
  }

  rerender() {
    const top = this.bodyEl.scrollTop;
    this.bodyEl.replaceChildren();
    this.footEl.replaceChildren();
    this.render();
    this.bodyEl.scrollTop = top;
  }

  report() {
    const box = E('div');
    const spoken = this.tt(`inc.${this.id}.npc`);
    const line = E('div', 'line');
    const p = E('p', null, spoken);
    line.append(p, this.ui.sayAgain?.(spoken, this.crew.id) || E('span'));
    box.append(line);
    // One short subtitle of context, then the measured source of the numbers in the task.
    box.append(E('p', 'subtle', this.tt(`inc.${this.id}.report`)));
    const src = this.tt(`inc.${this.id}.src`);
    if (src) box.append(E('div', 'src', `◦ ${src}`));
    return box;
  }

  goalLine(key = 'goal') {
    const g = E('div', 'note', this.tt(`inc.${this.id}.${key}`));
    return g;
  }

  hintButtons() {
    const wrap = E('div', 'row');
    if (this.hintLevel < 2) {
      const b = btn('btn ghost', this.hintLevel === 0 ? this.tt('ui.hint') : this.tt('ui.hint2'), () => {
        const keys = HINTS[this.id] || [];
        const k = keys[this.hintLevel];
        this.hintLevel++;
        if (k) {
          const fb = E('div', 'fb hint');
          fb.textContent = this.tt(k);
          this.bodyEl.append(fb);
          fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        this.renderFoot();
      });
      wrap.append(b);
    } else {
      wrap.append(E('span', null, ''));
    }
    return wrap;
  }

  leave() {
    if (this.phase !== 'done') this.sim.snoozeIncident(this.id);
    this.ui.closeSheet();
    this.ui.toast(this.tt('ui.leftForLater'));
  }

  finish() {
    this.phase = 'done';
    const first = this.sim.resolveIncident(this.id);
    this.ui.closeSheet();
    if (first) this.ui.celebrate(this.inc);
  }

  successes(msg) {
    this.ui.sfx('good');
    const fb = E('div', 'fb');
    fb.textContent = msg;
    return fb;
  }

  misses(msg) {
    this.ui.sfx('soft');
    this.errors++;
    const fb = E('div', 'fb warn');
    fb.textContent = msg || this.tt('ui.gentle');
    return fb;
  }

  // ------------------------------------------------------------------ render dispatch
  render() {
    if (this.phase === 'reflect') return this.renderReflect();
    this.bodyEl.append(this.report(), this.goalLine());
    const artKey = { solar: 'hero.jpg', rover: 'rover.jpg', sample: 'ice.jpg', green: 'greenhouse.jpg', water: 'greenhouse.jpg' }[this.id];
    if (artKey && this.ui.art) {
      const fig = this.ui.art(artKey, this.tt(`inc.${this.id}.title`), 'art-banner');
      if (fig) this.bodyEl.prepend(fig);
    }
    const kind = this.spec.kind;
    if (kind === 'order') this.renderOrder();
    else if (kind === 'oddone') this.renderOddOne();
    else if (kind === 'budget') this.renderBudget();
    else if (kind === 'match') this.renderMatch();
    else if (kind === 'schedule') this.renderSchedule();
    else this.renderMcq();
  }

  renderFoot(extra) {
    this.footEl.replaceChildren();
    const hint = this.hintLevel < 2 ? btn('btn ghost', this.hintLevel === 0 ? this.tt('ui.hint') : this.tt('ui.hint2'), () => this.showHint()) : E('span', null, '');
    this.footEl.append(hint);
    const leave = btn('btn ghost', this.tt('ui.leave'), () => this.leave());
    this.footEl.append(leave);
    if (extra) this.footEl.append(extra);
  }

  showHint() {
    const keys = HINTS[this.id] || [];
    const k = keys[this.hintLevel];
    this.hintLevel = Math.min(2, this.hintLevel + 1);
    if (k) {
      const fb = E('div', 'fb hint');
      fb.textContent = this.tt(k);
      this.bodyEl.append(fb);
      this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
    }
    this.renderFoot();
  }

  // ------------------------------------------------------------------ ORDER
  renderOrder() {
    const s = this.spec;
    if (!this.state.remaining) {
      this.state.remaining = shuffle(Array.from({ length: s.n }, (_, i) => i));
      this.state.placed = [];
      this.state.nudge = null;
    }
    const seq = E('div', 'seq');
    if (this.state.placed.length === 0) seq.dataset.empty = this.tt('ui.orderEmpty');
    for (const i of this.state.placed) {
      const row = E('div', 'opt good');
      row.append(E('span', 'n', String(this.state.placed.indexOf(i) + 1)));
      row.append(E('span', null, this.tt(`inc.${this.id}.steps.${i}`)));
      seq.append(row);
    }
    this.bodyEl.append(seq);
    if (this.state.nudge) this.bodyEl.append(this.state.nudge);
    const list = E('div');
    for (const i of this.state.remaining) {
      const b = btn('opt', '');
      b.append(E('span', null, this.tt(`inc.${this.id}.steps.${i}`)));
      b.addEventListener('click', () => this.placeStep(i, b));
      list.append(b);
    }
    this.bodyEl.append(list);
    this.renderFoot();
  }

  placeStep(i, node) {
    const placed = this.state.placed;
    const expected = placed.length === 0 ? 0 : Math.max(...placed) + 1;
    // Steps must be placed in their real order, which is the order the locale lists them in.
    const firstRemaining = this.state.remaining.slice().sort((a, b) => a - b)[0];
    if (i === firstRemaining) {
      placed.push(i);
      this.state.remaining = this.state.remaining.filter(x => x !== i);
      const fb = this.successes(this.tt(`inc.${this.id}.stepFb.${i}`));
      this.rerender();
      this.bodyEl.prepend(fb);
      if (this.state.remaining.length === 0) this.complete();
    } else {
      node.classList.add('bad');
      this.state.nudge = this.misses(this.tt(`inc.${this.id}.stepWrong.${i}`) || this.tt('ui.orderWrong'));
      this.rerender();
    }
  }

  // ------------------------------------------------------------------ ODD ONE OUT + LOAD BUDGET
  renderOddOne() {
    const s = this.spec;
    if (!this.state.phase) { this.state.phase = 1; this.state.off = new Set(); }
    if (this.state.phase === 1) {
      this.bodyEl.append(E('h4', null, this.tt('inc.solar.panelNote')));
      const wrap = E('div', 'grid2');
      const maxKw = Math.max(...s.panelKw);
      s.panelKw.forEach((kw, i) => {
        const b = btn('opt', '');
        const sw = E('div', 'sw2');
        sw.append(E('span', null, this.tt(`inc.solar.panels.${i}`)));
        const tg = E('span', 'tg', `${kw} kW`);
        sw.append(tg);
        b.append(sw);
        const bar = E('div', 'cap');
        const fill = E('i');
        fill.style.width = `${Math.min(100, (kw / maxKw) * 100)}%`;
        if (kw < maxKw * 0.6) fill.style.background = 'var(--gold)';
        bar.append(fill);
        b.append(bar);
        b.addEventListener('click', () => {
          if (i === s.odd) {
            this.state.phase = 2;
            this.rerender();
          } else {
            this.bodyEl.append(this.misses(this.tt('inc.solar.wrongOdd')));
            this.renderFoot();
          }
        });
        wrap.append(b);
      });
      this.bodyEl.append(wrap);
      this.renderFoot();
      return;
    }
    // Phase 2: load shedding
    this.bodyEl.append(this.successes(this.tt('inc.solar.pickedOdd')));
    this.bodyEl.append(E('h4', null, this.tt('inc.solar.loadsTitle')));
    const total = Math.round(s.loads.reduce((sum, l, i) => sum + (l.crit || !this.state.off.has(i) ? l.kw : 0), 0) * 10) / 10;
    this.bodyEl.append(E('p', null, this.tt('inc.solar.loadsNote', { kw: s.target, target: s.target })));
    const gauge = E('div', 'cap' + (total > s.target ? ' over' : ''));
    const fill = E('i');
    fill.style.width = `${Math.min(100, Math.max(0, (total / s.target) * 100))}%`;
    gauge.append(fill);
    this.bodyEl.append(gauge);
    this.bodyEl.append(E('p', null, `${total.toFixed(1)} kW / ${s.target.toFixed(1)} kW`));
    const list = E('div');
    s.loads.forEach((l, i) => {
      const on = l.crit || !this.state.off.has(i);
      const b = btn('opt' + (on ? ' on' : ''), '');
      const sw = E('div', 'sw2');
      sw.append(E('span', null, this.tt(`inc.solar.loads.${i}`)));
      if (l.crit) sw.append(E('span', 'badge ok', this.tt('ui.alwaysOn')));
      sw.append(E('span', 'tg', on ? `${l.kw} kW` : this.tt('ui.off')));
      b.append(sw);
      if (!l.crit) b.addEventListener('click', () => {
        if (this.state.off.has(i)) this.state.off.delete(i); else this.state.off.add(i);
        this.ui.sfx('tap');
        this.rerender();
      });
      else b.disabled = true;
      list.append(b);
    });
    this.bodyEl.append(list);
    const critOff = s.loads.some((l, i) => l.crit && this.state.off.has(i));
    if (total <= s.target && !critOff) {
      this.bodyEl.append(this.successes(this.tt('inc.solar.loadsOk')));
      const c = btn('btn primary', this.tt('ui.finish'), () => this.complete());
      this.renderFoot(c);
    } else {
      this.renderFoot();
      if (total > s.target) this.bodyEl.append(this.misses(this.tt('inc.solar.loadsOver', { over: (total - s.target).toFixed(1) })));
      if (critOff) this.bodyEl.append(this.misses(this.tt('inc.solar.loadsMissing')));
    }
  }

  // ------------------------------------------------------------------ MCQ (fair test, route, fatigue, comms)
  renderMcq() {
    const s = this.spec;
    if (this.state.chosen == null) this.state.chosen = null;
    if (this.state.wrong == null) this.state.wrong = new Set();
    const k = this.step;
    const stepsEarly = E('div', 'steps');
    for (let i = 0; i < s.steps; i++) stepsEarly.append(E('i', i < k ? 'done' : i === k ? 'on' : ''));
    this.bodyEl.append(stepsEarly);
    if (s.table && k === 0) this.renderRouteTable();
    if (s.chart && k === 0) this.renderChart();
    if (s.svg && k === 0) this.renderCommsDiagram();
    if (s.kind === 'mcq' && this.id === 'green' && k === 0) this.renderTrays();

    this.bodyEl.append(E('p', 'q', this.tt(`inc.${this.id}.q.${k}`)));
    const opts = this.tt(`inc.${this.id}.o.${k}`);
    const fbs = this.tt(`inc.${this.id}.fb.${k}`);
    const correct = s.correct[k];
    const wrap = E('div');
    (Array.isArray(opts) ? opts : []).forEach((label, i) => {
      const b = btn('opt' + (this.state.chosen === i ? (i === correct ? ' good' : ' bad') : '') + (this.state.wrong.has(i) ? ' dim' : ''), '');
      b.append(E('span', 'n', String.fromCharCode(65 + i)));
      b.append(E('span', null, label));
      b.disabled = this.state.chosen != null;
      b.addEventListener('click', () => {
        if (this.state.chosen != null) return;
        this.state.chosen = i;
        if (i === correct) {
          this.ui.sfx('good');
          this.feedback = { text: fbs[i], ok: true };
        } else {
          this.ui.sfx('soft');
          this.errors++;
          this.state.wrong.add(i);
          this.feedback = { text: fbs[i], ok: false };
        }
        this.rerender();
      });
      wrap.append(b);
    });
    this.bodyEl.append(wrap);
    if (this.feedback) {
      const fb = E('div', 'fb' + (this.feedback.ok ? '' : ' warn'), this.feedback.text);
      this.bodyEl.append(fb);
    }
    // Footer: next once the correct answer has been chosen.
    let extra = null;
    if (this.state.chosen === correct) {
      const last = k + 1 >= s.steps;
      extra = btn('btn primary', last ? this.tt('ui.finish') : this.tt('ui.next'), () => {
        if (last) this.complete();
        else { this.step++; this.state.chosen = null; this.state.wrong = new Set(); this.feedback = null; this.rerender(); }
      });
    }
    this.renderFoot(extra);
  }

  renderRouteTable() {
    const s = this.spec;
    const cols = this.tt('inc.rover.cols');
    const tbl = E('table', 'tbl');
    const thead = E('thead');
    const tr = E('tr');
    (Array.isArray(cols) ? cols : []).forEach(c => tr.append(E('th', null, c)));
    thead.append(tr);
    const tbody = E('tbody');
    s.rows.forEach((r, i) => {
      const row = E('tr');
      row.append(E('td', null, String.fromCharCode(65 + i)));
      row.append(E('td', null, `${r.km} km`));
      row.append(E('td', null, `${r.slope}\u00b0`));
      row.append(E('td', null, `${r.reserve}%`));
      if (r.slope > s.limits.slope || r.reserve < s.limits.reserve) row.style.color = 'var(--rose)';
      tbody.append(row);
    });
    tbl.append(thead, tbody);
    this.bodyEl.append(tbl);
    this.bodyEl.append(E('div', 'note', this.tt('inc.rover.limits')));
  }

  renderChart() {
    const s = this.spec;
    this.bodyEl.append(E('h4', null, this.tt('inc.fatigue.chartTitle')));
    const names = this.tt('inc.fatigue.chartNames');
    s.chart.forEach(([work, sleep], i) => {
      const row = E('div', 'sw2');
      const nm = E('span', null, (Array.isArray(names) ? names[i] : '') || '');
      nm.style.minWidth = '4.5rem'; nm.style.fontSize = '.84rem';
      row.append(nm);
      const bars = E('div');
      bars.style.flex = '1';
      const mk = (v, color) => {
        const c = E('div', 'cap');
        const f = E('i'); f.style.width = `${(v / 14) * 100}%`; f.style.background = color;
        c.append(f); bars.append(c);
      };
      mk(work, 'var(--gold)');
      mk(sleep, 'var(--mint)');
      row.append(bars);
      this.bodyEl.append(row);
    });
    this.bodyEl.append(E('p', null, this.tt('inc.fatigue.chartNote')));
  }

  renderCommsDiagram() {
    const wrap = E('div');
    wrap.innerHTML = `<svg class="dia" viewBox="0 0 400 180" role="img" aria-label="Side view of a ridge between the base and the rover">
      <defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1b2e"/><stop offset="1" stop-color="#16283d"/></linearGradient></defs>
      <rect width="400" height="180" fill="url(#skyg)"/>
      <path d="M0 150 L90 150 L150 150 L175 96 L205 76 L235 100 L255 150 L400 150 L400 180 L0 180 Z" fill="#2a3542" stroke="#46586a"/>
      <circle cx="60" cy="140" r="9" fill="#69d4e7"/><text x="42" y="168" fill="#cfe3ee" font-size="11">base</text>
      <circle cx="340" cy="140" r="9" fill="#f1c36d"/><text x="316" y="168" fill="#cfe3ee" font-size="11">rover</text>
      <path d="M60 132 Q200 118 340 132" stroke="#ff8f86" stroke-dasharray="5 5" fill="none" stroke-width="2"/>
      <text x="150" y="118" fill="#ff8f86" font-size="11">signal blocked by the ridge</text>
      <circle cx="205" cy="66" r="6" fill="#85e0b0"/><text x="216" y="60" fill="#85e0b0" font-size="11">? relay here</text>
    </svg>`;
    this.bodyEl.append(wrap);
  }

  renderTrays() {
    const trays = E('div', 'trays');
    const info = [
      { n: 'A', light: '100%', water: '100%', nut: '100%', pale: false },
      { n: 'B', light: '50%', water: '50%', nut: '100%', pale: true },
      { n: 'C', light: '100%', water: '50%', nut: '100%', pale: true },
    ];
    for (const tr of info) {
      const d = E('div', 'tray' + (tr.pale ? ' pale' : ''));
      d.append(E('div', 'pl', '🥬'));
      d.append(E('div', null, `Tray ${tr.n}`));
      d.append(E('small', null, `${this.tt('ui.light')} ${tr.light} · ${this.tt('ui.waterWord')} ${tr.water} · ${this.tt('ui.nutrients')} ${tr.nut}`));
      if (tr.pale) d.append(E('small', null, this.tt('ui.paleLeaves')));
      trays.append(d);
    }
    this.bodyEl.append(trays);
  }

  // ------------------------------------------------------------------ BUDGET
  renderBudget() {
    const s = this.spec;
    if (!this.state.on) this.state.on = new Set();
    const spending = [...this.state.on].reduce((a, i) => a + s.items[i].cost, 0);
    const left = s.budget - spending;
    this.bodyEl.append(E('p', null, this.tt('inc.budget.needsNote')));
    const list = E('div');
    s.items.forEach((item, i) => {
      const on = this.state.on.has(i);
      const b = btn('opt' + (on ? ' on' : ''), '');
      const sw = E('div', 'sw2');
      sw.append(E('span', null, this.tt(`inc.budget.items.${i}`)));
      sw.append(E('span', 'tg', on ? `−${item.cost}` : `${item.cost}`));
      b.append(sw);
      b.addEventListener('click', () => {
        if (this.state.on.has(i)) this.state.on.delete(i); else this.state.on.add(i);
        this.ui.sfx('tap');
        this.rerender();
      });
      list.append(b);
    });
    this.bodyEl.append(list);
    this.bodyEl.append(E('h4', null, left >= 0 ? this.tt('inc.budget.budgetLeft', { n: left }) : this.tt('inc.budget.budgetOver', { n: -left })));
    const missing = s.items.map((it, i) => ({ it, i })).filter(o => o.it.need && !this.state.on.has(o.i)).map(o => this.tt(`inc.budget.items.${o.i}`));
    if (spending <= s.budget && missing.length === 0) {
      this.bodyEl.append(this.successes(this.tt('inc.budget.budgetDone', { n: left })));
      this.renderFoot(btn('btn primary', this.tt('ui.finish'), () => this.complete()));
    } else {
      if (spending > s.budget) this.bodyEl.append(this.misses(this.tt('inc.budget.budgetOver', { n: spending - s.budget })));
      else if (missing.length) this.bodyEl.append(this.misses(this.tt('inc.budget.budgetMissing', { list: missing.join(' · ') })));
      this.renderFoot();
    }
  }

  // ------------------------------------------------------------------ MATCH
  renderMatch() {
    const s = this.spec;
    if (!this.state.matched) { this.state.matched = new Set(); this.state.sel = null; this.state.wrongPair = null; }
    const cols = E('div', 'grid2');
    const left = E('div'), right = E('div');
    left.append(E('h4', null, this.tt('ui.samples')));
    right.append(E('h4', null, this.tt('ui.rockCards')));
    const samples = this.tt('inc.sample.samples');
    const cards = this.tt('inc.sample.cards');
    (Array.isArray(samples) ? samples : []).forEach((sm, i) => {
      const done = this.state.matched.has(i);
      const b = btn('opt' + (done ? ' good' : this.state.sel === i ? ' on' : ''), '');
      b.append(E('b', null, sm.t));
      b.append(E('small', null, sm.d));
      b.disabled = done;
      b.addEventListener('click', () => { this.state.sel = i; this.state.wrongPair = null; this.rerender(); });
      left.append(b);
    });
    const usedCards = new Set([...this.state.matched].map(si => s.pairs.find(p => p[0] === si)?.[1]));
    (Array.isArray(cards) ? cards : []).forEach((c, ci) => {
      const b = btn('opt' + (usedCards.has(ci) ? ' good' : ''), '');
      b.append(E('b', null, c.t));
      b.append(E('small', null, c.d));
      b.disabled = usedCards.has(ci);
      b.addEventListener('click', () => {
        if (this.state.sel == null) { this.ui.toast(this.tt('inc.sample.pickSample')); return; }
        const si = this.state.sel;
        const expected = s.pairs.find(p => p[0] === si)?.[1];
        if (expected === ci) {
          this.state.matched.add(si);
          this.state.sel = null;
          this.ui.sfx('good');
          this.matchedMsg = this.tt('inc.sample.matched');
          this.rerender();
          if (this.state.matched.size === s.pairs.length) this.complete();
        } else {
          this.state.wrongPair = { si, ci };
          this.matchedMsg = this.tt('inc.sample.mismatch');
          this.ui.sfx('soft');
          this.errors++;
          this.rerender();
        }
      });
      right.append(b);
    });
    cols.append(left, right);
    this.bodyEl.append(E('p', null, this.tt('inc.sample.samplePrompt')));
    if (this.matchedMsg) this.bodyEl.append(E('div', 'fb' + (this.state.wrongPair ? ' warn' : ''), this.matchedMsg));
    this.bodyEl.append(cols);
    this.renderFoot();
  }

  // ------------------------------------------------------------------ SCHEDULE
  renderSchedule() {
    const s = this.spec;
    if (!this.state.vals) this.state.vals = s.blocks.map(b => b.start);
    const vals = this.state.vals;
    const total = vals.reduce((a, b) => a + b, 0);
    const names = this.tt('inc.schedule.blocks');
    this.bodyEl.append(E('p', null, this.tt('inc.schedule.rules')));
    const day = E('div', 'day');
    const colors = ['#6ea8ff', '#f1c36d', '#85e0b0', '#ff9d93', '#b9a6ff'];
    vals.forEach((v, i) => {
      const seg = E('i');
      seg.style.width = `${(v / 24) * 100}%`;
      seg.style.background = colors[i % colors.length];
      seg.title = `${(Array.isArray(names) ? names[i] : '')} ${v}`;
      day.append(seg);
    });
    this.bodyEl.append(day);
    this.bodyEl.append(E('p', null, this.tt('inc.schedule.total', { n: total })));
    s.blocks.forEach((b, i) => {
      const row = E('div', 'stepper');
      const sq = E('div', 'sq'); sq.style.background = colors[i % colors.length];
      const nm = E('div', 'nm', (Array.isArray(names) ? names[i] : '') || '');
      const minus = btn('', '−', () => { if (vals[i] > 0) { vals[i]--; this.rerender(); } });
      const val = E('b', null, `${vals[i]} h`);
      const plus = btn('', '+', () => { if (vals[i] < 14) { vals[i]++; this.rerender(); } });
      row.append(sq, nm, minus, val, plus);
      this.bodyEl.append(row);
    });
    const issues = [];
    if (total !== s.total) issues.push(this.tt('inc.schedule.sumBad', { n: total }));
    if (vals[0] < s.blocks[0].min) issues.push(this.tt('inc.schedule.sleepLow'));
    if (vals[1] > s.blocks[1].max) issues.push(this.tt('inc.schedule.workHigh'));
    if (vals[1] < s.blocks[1].min) issues.push(this.tt('inc.schedule.workLow'));
    if (vals[2] < s.blocks[2].min) issues.push(this.tt('inc.schedule.exLow'));
    if (vals[3] < s.blocks[3].min) issues.push(this.tt('inc.schedule.mealLow'));
    if (vals[4] < s.blocks[4].min) issues.push(this.tt('inc.schedule.freeLow'));
    if (issues.length === 0) {
      this.bodyEl.append(this.successes(this.tt('inc.schedule.rulesOk')));
      this.renderFoot(btn('btn primary', this.tt('ui.finish'), () => this.complete()));
    } else {
      this.bodyEl.append(E('div', 'fb warn', issues[0]));
      this.renderFoot();
    }
  }

  // ------------------------------------------------------------------ REFLECTION
  complete() {
    this.phase = 'reflect';
    this.ui.sfx('chime');
    this.bodyEl.scrollTop = 0;
    this.rerender();
  }

  renderReflect() {
    const badge = E('div', 'tag', this.tt('ui.situationDone'));
    badge.style.marginBottom = '.7rem';
    this.bodyEl.append(badge);
    this.bodyEl.append(E('p', null, this.tt(`inc.${this.id}.done`)));
    this.bodyEl.append(E('div', 'fb', this.tt(`inc.${this.id}.why`)));
    const tags = E('div', 'tags');
    tags.append(E('span', null, `${this.tt('ui.skill')}: ${this.tt(`inc.${this.id}.skill`)}`));
    this.bodyEl.append(tags);
    this.bodyEl.append(E('h4', null, this.tt('ui.earth')));
    this.bodyEl.append(E('p', null, this.tt(`inc.${this.id}.earth`)));
    const answerBox = E('div');
    const reveal = btn('btn ghost', this.tt('ui.answer'), () => {
      const fb = E('div', 'fb', this.tt(`inc.${this.id}.answer`));
      answerBox.replaceChildren(fb);
      reveal.remove();
    });
    answerBox.append(reveal);
    this.bodyEl.append(answerBox);
    const deep = E('details', 'deep');
    const sum = E('summary', null, this.tt('ui.deeper'));
    const dp = E('p', null, this.tt(`inc.${this.id}.deep`));
    deep.append(sum, dp);
    this.bodyEl.append(deep);
    this.footEl.replaceChildren();
    this.footEl.append(btn('btn ghost', this.tt('ui.journal'), () => this.ui.openJournal()));
    this.footEl.append(btn('btn primary', this.tt('ui.finish'), () => this.finish()));
  }
}
