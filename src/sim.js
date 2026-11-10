// The colony simulation: the clock, the meters, the situation director, journal and saving.
// Design rule: nothing here can fail. Meters are clamped, situations are optional and the crew
// will quietly take over anything the player leaves alone.
import { CREW, STATIONS, INCIDENTS, CARDS, SAMPLE_SITES, SAVE_KEY, ROVER, stationById, incidentById } from './data.js';
import { Player, Crew, RoverCar, collide } from './entities.js';
import { heightAt } from './world.js';

const HOUR_SECONDS = 25;          // one colony hour of 25 real seconds at normal speed
const NIGHT_SCALE = 6;            // the night passes faster so nobody waits
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const INCIDENT_EFFECT = {
  solar: { power: 18 }, water: { water: 16, air: 4 }, green: { food: 14, air: 4 },
  rover: { mood: 6 }, fatigue: { mood: 14 }, dust: { air: 8, mood: 4 },
  comms: { mood: 6 }, budget: { mood: 10 }, sample: { mood: 8 },
  schedule: { mood: 12 }, storm: { mood: 10 },
};
const INCIDENT_DIP = {
  solar: { power: -12 }, water: { water: -9 }, green: { food: -7 }, dust: { air: -5 },
  fatigue: { mood: -8 }, comms: { mood: -3 }, storm: { mood: -6 }, rover: { mood: -2 },
  samples: {},
};

export class Sim {
  constructor({ world, ui, suitColor = '#f3f6f8', lang = 'en' }) {
    this.world = world;
    this.ui = ui;
    this.player = new Player(world.scene, suitColor);
    this.crew = new Crew(world.scene, this);
    this.rover = new RoverCar(world.rover, this);
    this.lang = lang;
    this.suitColor = suitColor;
    this.settings = { sound: true, readAloud: false, textSize: 1, reduceMotion: false, lang };
    this.reset();
    this.bindAutosave();
  }

  // ------------------------------------------------------------------ state
  reset() {
    this.day = 1;
    this.minutes = 7 * 60 + 30;          // the day starts at 07:30, just before the briefing
    this.meters = { power: 86, water: 78, air: 88, food: 74, mood: 82 };
    this.drivers = { panelDust: 0.18, filterHealth: 0.9, plantHealth: 0.92 };
    this.cards = new Set();
    this.samples = new Set();
    this.incidents = {};
    for (const inc of INCIDENTS) this.incidents[inc.id] = { id: inc.id, state: 'available', created: 0, resolvedDay: null };
    this.directorClock = 0;
    this.toastCooldown = {};
    this.visited = new Set();
    this.solved = [];
    this.helpCount = 0;
    this.started = false;
    this.driving = false;
    this.introSeen = false;
    this.player.teleport(0, 2, Math.PI);
    this.rover.pos.set(...this.roverParkY());
    this.rover.reserve = 0.74;
    if (this.crew) this.crew.npcs.forEach(b => { b.path = []; b.state = 'idle'; });
    this.dirty = true;
  }

  roverParkY() { const [x, z] = ROVER.park; return [x, heightAt(x, z), z]; }

  get hourFloat() { return this.minutes / 60; }
  get sleeping() { return this.minutes >= 22 * 60 || this.minutes < 7 * 60; }
  get watch() { return CREW[(this.day - 1) % CREW.length].id; }
  isWatch(id) { return this.watch === id; }

  clock() {
    const h = Math.floor(this.minutes / 60) % 24, m = Math.floor(this.minutes % 60);
    return { day: this.day, h, m, sleeping: this.sleeping };
  }

  // ------------------------------------------------------------------ save / load
  bindAutosave() {
    this._autosaveT = 0;
    window.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  save() {
    try {
      const data = {
        v: 1, day: this.day, minutes: this.minutes, meters: this.meters, drivers: this.drivers,
        cards: [...this.cards], samples: [...this.samples], incidents: this.incidents,
        visited: [...this.visited], solved: this.solved, helpCount: this.helpCount,
        suitColor: this.suitColor, settings: this.settings, introSeen: this.introSeen,
        player: [this.player.pos.x, this.player.pos.z, this.player.facing],
        rover: [this.rover.pos.x, this.rover.pos.z, this.rover.heading, this.rover.reserve],
        started: this.started,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  static readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  load(data) {
    if (!data || data.v !== 1) return false;
    this.day = data.day ?? 1;
    this.minutes = data.minutes ?? 450;
    this.meters = { ...this.meters, ...(data.meters || {}) };
    this.drivers = { ...this.drivers, ...(data.drivers || {}) };
    this.cards = new Set(data.cards || []);
    this.samples = new Set(data.samples || []);
    for (const inc of INCIDENTS) this.incidents[inc.id] = data.incidents?.[inc.id] || { id: inc.id, state: 'available', created: 0, resolvedDay: null };
    this.visited = new Set(data.visited || []);
    this.solved = data.solved || [];
    this.helpCount = data.helpCount || 0;
    this.suitColor = data.suitColor || this.suitColor;
    this.settings = { ...this.settings, ...(data.settings || {}) };
    this.introSeen = !!data.introSeen;
    if (data.player) this.player.teleport(data.player[0], data.player[1], data.player[2]);
    if (data.rover) {
      this.rover.pos.set(data.rover[0], heightAt(data.rover[0], data.rover[1]), data.rover[1]);
      this.rover.heading = data.rover[2]; this.rover.reserve = data.rover[3] ?? 0.74;
    }
    this.started = !!data.started;
    return true;
  }

  // ------------------------------------------------------------------ journal
  cardsFor(stationId) { return CARDS[stationId] || []; }
  hasCard(id) { return this.cards.has(id); }
  cardsFound(stationId) { return this.cardsFor(stationId).filter(c => this.cards.has(c)).length; }

  lookCloser(stationId) {
    const next = this.cardsFor(stationId).find(c => !this.cards.has(c));
    if (!next) return null;
    this.cards.add(next);
    this.visited.add(stationId);
    this.save();
    return next;
  }

  visit(stationId) {
    if (!this.visited.has(stationId)) {
      this.visited.add(stationId);
      this.save();
    }
  }

  logSample(siteId) {
    if (this.samples.has(siteId)) return false;
    this.samples.add(siteId);
    this.save();
    return true;
  }

  // ------------------------------------------------------------------ incidents
  openIncidents() { return INCIDENTS.filter(i => { const s = this.incidents[i.id].state; return s === 'new' || s === 'selected' || s === 'snoozed'; }); }
  activeIncidentFor(stationId) {
    const inc = INCIDENTS.find(i => i.station === stationId);
    if (!inc) return null;
    const st = this.incidents[inc.id].state;
    return (st === 'new' || st === 'selected' || st === 'snoozed') ? inc : null;
  }
  isResolved(id) { return this.incidents[id]?.state === 'resolved'; }
  resolvedCount() { return INCIDENTS.filter(i => this.incidents[i.id].state === 'resolved').length; }

  spawnIncident(id) {
    const inc = incidentById(id);
    if (!inc || this.incidents[id].state !== 'available') return false;
    this.incidents[id] = { id, state: 'new', created: this.minutes + this.day * 1440, resolvedDay: null };
    this.nudge(INCIDENT_DIP[id] || {});
    const door = `${inc.station}Door`;
    this.crew.sendTo(inc.npc, door, inc.kind === 'order' ? 'repairing' : 'investigating');
    this.ui.toast(this.ui.t('ui.toastIncident', { t: this.ui.t(`inc.${id}.title`) }), 'incident');
    this.ui.badge();
    this.save();
    return true;
  }

  startIncident(id) {
    const inc = incidentById(id);
    if (!inc) return false;
    const st = this.incidents[id];
    if (st.state === 'resolved' || st.state === 'crew') return false;
    st.state = 'selected';
    this.crew.sendTo(inc.npc, `${inc.station}Door`, inc.kind === 'order' ? 'repairing' : 'investigating');
    this.ui.badge();
    this.save();
    return true;
  }

  snoozeIncident(id) {
    const st = this.incidents[id];
    if (!st || st.state === 'resolved') return;
    st.state = 'snoozed';
    this.ui.badge();
    this.save();
  }

  /** Called by activities.js when the player finishes a situation. Idempotent: no farming. */
  resolveIncident(id, { crew = false } = {}) {
    const st = this.incidents[id];
    if (!st || st.state === 'resolved' || st.state === 'crew') return false;
    const inc = incidentById(id);
    st.state = crew ? 'crew' : 'resolved';
    st.resolvedDay = this.day;
    const eff = INCIDENT_EFFECT[id] || {};
    for (const [k, v] of Object.entries(eff)) this.bump(k, crew ? Math.round(v * 0.55) : v);
    if (!crew) {
      this.solved.push(id);
      this.helpCount++;
      this.bump('mood', 2);
    }
    if (inc) this.crew.sendTo(inc.npc, `${STATIONS.find(s => s.id === inc.npc.home)?.id || inc.station}Door`, 'returning');
    this.ui.badge();
    this.save();
    return true;
  }

  bump(key, amount) {
    this.meters[key] = clamp((this.meters[key] ?? 60) + amount, 15, 100);
    this.ui.meters();
  }

  nudge(effects) {
    for (const [k, v] of Object.entries(effects)) this.meters[k] = clamp((this.meters[k] ?? 60) + v, 15, 100);
    this.ui.meters();
  }

  // ------------------------------------------------------------------ the director
  updateDirector(dt) {
    // Rooms fill with reports slowly, at most two at a time, and never while the crew sleeps.
    this.directorClock += dt;
    const open = this.openIncidents();
    if (this.sleeping) return;
    const gap = this.helpCount === 0 ? 24 : 90;   // real seconds between reports (first one comes quickly)
    if (this.directorClock < gap) return;
    if (open.length >= 2) return;
    const candidates = INCIDENTS.filter(i => this.incidents[i.id].state === 'available');
    if (!candidates.length) return;
    // Prefer a station the player has already seen, so the report makes sense.
    const seen = candidates.filter(i => this.visited.has(i.station));
    const pool = seen.length ? seen : candidates;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (this.spawnIncident(pick.id)) {
      this.directorClock = 0;
      // If the player is far away, let them know where to go.
      const station = stationById(pick.station);
      this.ui.toast(this.ui.t('ui.toastIncidentWhere', { t: this.ui.t(`inc.${pick.id}.title`), s: this.ui.t(`station.${station.id}.name`) }), 'incident');
    }
  }

  // ------------------------------------------------------------------ main update
  update(dt) {
    // Clock: sleep hours pass faster.
    const scale = this.sleeping ? NIGHT_SCALE : 1;
    const before = this.minutes;
    this.minutes += (dt / HOUR_SECONDS) * 60 * scale;
    if (this.minutes >= 1440) {
      this.minutes -= 1440; this.day++;
      this.onNewDay();
    }
    if (before < 22 * 60 && this.minutes >= 22 * 60) this.ui.toast(this.ui.t('ui.slowDown'), 'quiet');
    if (before < 7 * 60 && this.minutes >= 7 * 60) this.ui.toast(this.ui.t('ui.goodMorning'), 'quiet');

    // Meters drift slowly; nothing is allowed to run away.
    const hours = (dt / HOUR_SECONDS) * scale;
    this.drivers.panelDust = clamp(this.drivers.panelDust + hours * 0.008, 0, 0.85);
    this.drivers.filterHealth = clamp(this.drivers.filterHealth - hours * 0.004, 0.25, 1);
    this.drivers.plantHealth = clamp(this.drivers.plantHealth - hours * 0.003, 0.3, 1);
    const sun = (this.minutes > 6 * 60 && this.minutes < 20 * 60) ? 1 : 0.25;
    const rates = {
      power: (sun * 1.5 - this.drivers.panelDust * 2.6 - 1.0) * 0.6,
      water: -0.9 - (1 - this.drivers.filterHealth) * 1.2,
      air: -0.55 - (1 - this.drivers.filterHealth) * 0.7,
      food: -0.7 - (1 - this.drivers.plantHealth) * 0.8,
      mood: -0.4 + (this.meters.food > 60 ? 0.12 : -0.2),
    };
    for (const [k, rate] of Object.entries(rates)) {
      let v = this.meters[k] + rate * hours;
      // Gentle recovery when things get low, so the colony always feels salvageable.
      if (v < 34) v += (34 - v) * hours * 0.09;
      this.meters[k] = clamp(v, 15, 100);
    }
    if (Math.floor(this.minutes) % 7 === 0) this.ui.meters();

    // Autosave
    this._autosaveT += dt;
    if (this._autosaveT > 12) { this._autosaveT = 0; this.save(); this.ui.savedPulse(); }

    // Director: new reports, and the crew handling anything left too long.
    this.updateDirector(dt);
    for (const inc of INCIDENTS) {
      const st = this.incidents[inc.id];
      if (st.state === 'available' || st.state === 'resolved' || st.state === 'crew') continue;
      const ageHours = (this.minutes + this.day * 1440 - st.created) / 60;
      const limit = st.state === 'snoozed' ? 1.5 : 3;
      if (ageHours > limit) {
        this.resolveIncident(inc.id, { crew: true });
        this.ui.toast(this.ui.t('ui.crewTookOver', { t: this.ui.t(`inc.${inc.id}.title`) }));
      }
    }

    // Entities
    this.player.update(dt, this.ui.input, this.ui.camYaw, this.ui.modalOpen || this.driving);
    this.crew.update(dt, performance.now() / 1000, this);
    this.rover.update(dt, this.ui.input, this.ui.canDrive);
    if (this.driving) {
      // The camera sits behind the rover; the player rides along.
      this.player.pos.copy(this.rover.pos);
      this.player.pos.y += 0.2;
    }

    this.ui.updateHUD(this);
  }

  onNewDay() {
    this.ui.toast(this.ui.t('ui.newDay', { d: this.day }), 'quiet');
    // Night watch rotates automatically; nothing to do but let the crew know.
    this.save();
  }

  // ------------------------------------------------------------------ helpers used by activities
  objectiveSummary() {
    const open = this.openIncidents();
    if (open.length) return { key: 'obj.reports', n: open.length };
    const unseen = STATIONS.filter(s => !this.visited.has(s.id));
    if (unseen.length) return { key: 'obj.explore', s: `station.${unseen[0].id}.name` };
    if (this.solved.length === 0) return { key: 'obj.boardFirst' };
    if (this.samples.size < SAMPLE_SITES.length) return { key: 'obj.samples', n: this.samples.size };
    return { key: 'obj.allDone' };
  }
}

export { HOUR_SECONDS, INCIDENT_EFFECT };
