// Madar-Team-Moon — entry point: renderer, camera, controls, interactions and the loop.
import * as THREE from '../vendor/three.module.min.js';
import { buildWorld, heightAt } from './world.js';
import { Sim } from './sim.js';
import { UI } from './ui.js';
import { setSuit, insideBlock } from './entities.js';
import { STATIONS, CREW, SAMPLE_SITES, SUITS, stationById } from './data.js';
import { t, setLang } from './i18n.js';
import { sfx, resumeAudio } from './audio.js';

const canvas = document.getElementById('game');
const loading = document.getElementById('loading');

function fail(msg) {
  loading.classList.remove('off');
  loading.style.letterSpacing = '0';
  loading.style.padding = '2rem';
  loading.style.textAlign = 'center';
  loading.style.lineHeight = '1.6';
  loading.textContent = msg;
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  fail(t('ui.gpuError'));
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 9, 24);
camera.lookAt(0, 2, -8);

const world = buildWorld(scene);

// ---------------------------------------------------------------------------------------------
// Controls: orbit camera, keyboard input, touch.
// ---------------------------------------------------------------------------------------------
class Controls {
  constructor() {
    this.yaw = 0.15; this.pitch = 0.34; this.dist = 12.5;
    this.targetDist = 12.5;
    this.input = { forward: false, back: false, left: false, right: false, run: false, jump: false };
    this.dragging = false; this.lastX = 0; this.lastY = 0;
    this.touchLook = null;
    this.bind();
  }
  hop() { this.input.jump = true; setTimeout(() => { this.input.jump = false; }, 140); }
  bind() {
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') { this.touchLook = { id: e.pointerId, x: e.clientX, y: e.clientY }; }
      else { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; canvas.setPointerCapture(e.pointerId); }
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') {
        if (!this.touchLook || this.touchLook.id !== e.pointerId) return;
        const dx = e.clientX - this.touchLook.x, dy = e.clientY - this.touchLook.y;
        this.touchLook.x = e.clientX; this.touchLook.y = e.clientY;
        this.orbit(dx, dy);
        return;
      }
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.orbit(dx, dy);
    });
    const end = e => {
      if (e.pointerType === 'touch') this.touchLook = null;
      else this.dragging = false;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.targetDist = Math.max(4.5, Math.min(30, this.targetDist + Math.sign(e.deltaY) * 1.4));
    }, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  orbit(dx, dy) {
    this.yaw -= dx * 0.006;
    this.pitch = Math.max(0.03, Math.min(1.15, this.pitch + dy * 0.004));
  }
}

const controls = new Controls();
const ui = new UI();
ui.controls = controls;
controls.input = ui._rawInput;
controls.hop = () => { controls.input.jump = true; setTimeout(() => { controls.input.jump = false; }, 140); };

// ---------------------------------------------------------------------------------------------
// Game session
// ---------------------------------------------------------------------------------------------
const SAVE = Sim.readSave();
const NAV_LANG = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
const INITIAL_LANG = SAVE?.settings?.lang || (NAV_LANG.startsWith('ar') ? 'ar' : 'en');
const suitColor = SAVE?.suitColor || SUITS[0];
let sim = null;
let started = false;

function createSim(fresh) {
  sim = new Sim({ world, ui, suitColor, lang: INITIAL_LANG });
  if (!fresh && SAVE) sim.load(SAVE);
  sim.suitColor = sim.suitColor || suitColor;
  setSuit(sim.player);
  sim.player.mesh.userData.suit.color.set(sim.suitColor);
  ui.attach({ sim, world, camera, controls, onBegin: (f, color) => beginSession(f, color) });
  ui.onAct = act;
  ui.onRover = toggleRover;
  bindWorldInteractions();
}

function beginSession(fresh, color) {
  if (fresh) {
    try { localStorage.removeItem('madar-team-moon.save.v1'); } catch (e) { /* ignore */ }
    sim.reset();
    sim.suitColor = color;
    sim.player.suitColor = color;
  }
  sim.suitColor = color || sim.suitColor;
  sim.player.suitColor = sim.suitColor;
  setSuit(sim.player);
  sim.settings.sound = sim.settings.sound !== false;
  sim.started = true;
  started = true;
  controls.yaw = 0.15; controls.pitch = 0.32; controls.dist = 12.5; controls.targetDist = 12.5;
  resumeAudio();
  sfx('chime');
  sim.save();
  if (!sim.introSeen) {
    sim.introSeen = true;
    setTimeout(() => ui.toast(t('onboarding.move'), 'quiet'), 900);
    setTimeout(() => ui.toast(t('onboarding.interact'), 'quiet'), 6200);
    setTimeout(() => ui.toast(t('onboarding.board'), 'quiet'), 12000);
  }
}

// ---------------------------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------------------------
let focus = null;

function nearestBot() {
  let best = null, bd = 3.4;
  for (const b of sim.crew.bots) {
    const d = Math.hypot(b.pos.x - sim.player.pos.x, b.pos.z - sim.player.pos.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function updateFocus() {
  if (!started || ui.modalOpen) { focus = null; ui.hidePrompt(); ui.hideCaption(); return; }
  const p = sim.player.pos;
  if (sim.driving) {
    const site = sim.rover.nearestSite();
    const slow = Math.abs(sim.rover.speed) < 2.2;
    if (site) {
      const name = t(`sampleSite.${site.id}`);
      ui.caption(name, '#85e0b0', t(`sampleSiteText.${site.id}`));
      if (slow) {
        focus = { type: 'sample', id: site.id };
        ui.prompt('E', sim.samples.has(site.id) ? t('ui.sampleLogged') : t('ui.promptSite'));
      } else { focus = null; ui.prompt('', t('rover.sampleHere')); }
    } else {
      focus = null; ui.hideCaption();
      ui.prompt('R', t('ui.promptExit'));
    }
    return;
  }
  let best = null, bd = Infinity;
  for (const st of STATIONS) {
    const d = Math.hypot(st.door[0] - p.x, st.door[1] - p.z);
    if (d < 4.6 && d < bd) { bd = d; best = { type: 'station', id: st.id }; }
  }
  const bot = nearestBot();
  if (bot) {
    const d = Math.hypot(bot.pos.x - p.x, bot.pos.z - p.z);
    if (d < bd) { bd = d; best = { type: 'bot', id: bot.id }; }
  }
  const rd = Math.hypot(sim.rover.pos.x - p.x, sim.rover.pos.z - p.z);
  if (rd < 4.8 && rd < bd) { best = { type: 'rover' }; }
  focus = best;
  if (!focus) { ui.hidePrompt(); }
  else if (focus.type === 'station') ui.prompt('E', t('ui.promptStation', { t: t(`station.${focus.id}.name`) }));
  else if (focus.type === 'bot') ui.prompt('E', t('ui.promptBot', { n: t(`crew.${focus.id}.name`) }));
  else ui.prompt('R', t('ui.promptRover'));
}

function act() {
  if (!started || ui.modalOpen) return;
  if (sim.driving) {
    const site = sim.rover.nearestSite();
    if (site && Math.abs(sim.rover.speed) < 2.2) logSample(site);
    return;
  }
  if (!focus) return;
  if (focus.type === 'station') ui.openStation(focus.id);
  else if (focus.type === 'bot') ui.openTalk(focus.id);
  else if (focus.type === 'rover') toggleRover();
}

function logSample(site) {
  if (sim.samples.has(site.id)) { ui.toast(t('ui.sampleLogged')); return; }
  if (sim.logSample(site.id)) {
    sfx('good');
    ui.toast(t('ui.sampleLogged') + ' · ' + t(`sampleSite.${site.id}`));
    if (sim.samples.size >= SAMPLE_SITES.length) ui.toast(t('rover.logAll'));
  }
}

function toggleRover() {
  if (!started) return;
  if (sim.driving) {
    sim.driving = false;
    sim.rover.exit();
    // step out beside the rover
    const side = sim.rover.pos.clone();
    side.x += Math.cos(sim.rover.heading) * 3.1;
    side.z -= Math.sin(sim.rover.heading) * 3.1;
    sim.player.teleport(side.x, side.z, sim.rover.heading + Math.PI / 2);
    sim.player.mesh.visible = true;
    controls.dist = 12.5; controls.targetDist = 12.5;
    sfx('close');
    return;
  }
  const d = Math.hypot(sim.rover.pos.x - sim.player.pos.x, sim.rover.pos.z - sim.player.pos.z);
  if (d > 5.2) return;
  sim.driving = true;
  sim.rover.enter();
  sim.player.mesh.visible = false;
  controls.yaw = sim.rover.heading;
  controls.pitch = 0.3;
  controls.dist = 13; controls.targetDist = 13;
  ui.toast(t('rover.hint'));
  sfx('open');
}

function bindWorldInteractions() { /* interactions are handled in updateFocus/act */ }

// ---------------------------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------------------------
const camTarget = new THREE.Vector3();
const desired = new THREE.Vector3();

function updateCamera(dt) {
  if (window.__cam) {
    const c = window.__cam;
    camera.position.set(c[0], c[1], c[2]);
    camera.lookAt(c[3], c[4], c[5]);
    return;
  }
  controls.dist += (controls.targetDist - controls.dist) * Math.min(1, dt * 6);
  if (started) {
    if (sim.driving) {
      // ease the camera behind the rover
      let target = sim.rover.heading;
      let diff = ((target - controls.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (diff < -Math.PI) diff += Math.PI * 2;
      controls.yaw += diff * Math.min(1, dt * 2.6);
      camTarget.copy(sim.rover.pos).add(new THREE.Vector3(0, 2.2, 0));
    } else {
      camTarget.copy(sim.player.pos).add(new THREE.Vector3(0, 1.35, 0));
    }
  } else {
    // slow orbit over the outpost for the title screen
    const a = performance.now() * 0.00006;
    camTarget.set(0, 3, -4);
    controls.yaw = a;
    controls.pitch = 0.3;
    controls.dist += (32 - controls.dist) * Math.min(1, dt);
  }
  const cp = Math.cos(controls.pitch), sp = Math.sin(controls.pitch);
  desired.set(
    camTarget.x - Math.sin(controls.yaw) * cp * controls.dist,
    camTarget.y + sp * controls.dist,
    camTarget.z + Math.cos(controls.yaw) * cp * controls.dist
  );
  const ground = heightAt(desired.x, desired.z) + 1.4;
  if (desired.y < ground) desired.y = ground;
  // Keep the camera out of walls: walk back along the view ray until it is clear.
  let sx = desired.x, sy = desired.y, sz = desired.z;
  const STEPS = 12;
  for (let i = 1; i <= STEPS; i++) {
    const k = i / STEPS;
    const px = camTarget.x + (desired.x - camTarget.x) * k;
    const py = camTarget.y + (desired.y - camTarget.y) * k;
    const pz = camTarget.z + (desired.z - camTarget.z) * k;
    if (py < 6.8 && insideBlock(px, pz, 0.45)) {
      const kk = Math.max(0.16, (i - 1) / STEPS);
      sx = camTarget.x + (desired.x - camTarget.x) * kk;
      sy = camTarget.y + (desired.y - camTarget.y) * kk;
      sz = camTarget.z + (desired.z - camTarget.z) * kk;
      break;
    }
  }
  desired.set(sx, Math.max(sy, heightAt(sx, sz) + 1.2), sz);
  camera.position.lerp(desired, started ? Math.min(1, dt * 9) : Math.min(1, dt * 3));
  camera.lookAt(camTarget);
}

// ---------------------------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------------------------
const clock = new THREE.Clock();
let firstFrame = true;

function loop() {
  const dt = Math.min(0.08, clock.getDelta());
  const tNow = performance.now() / 1000;
  world.update(dt, tNow);
  if (started && sim && !ui.modalOpen) {
    sim.update(dt);
    // the sun follows the player so shadows stay sharp around them
    const p = sim.driving ? sim.rover.pos : sim.player.pos;
    world.sun.position.set(p.x - 92, 46, p.z + 74);
    world.sun.target.position.set(p.x, 0, p.z);
    world.sun.target.updateMatrixWorld();
    // a soft fill carried by the camera keeps shadowed faces readable
    world.fill.position.set(camera.position.x, camera.position.y + 6, camera.position.z);
    world.fill.target.position.set(p.x, 1, p.z);
    world.fill.target.updateMatrixWorld();
    if (sim.rover.stuckWarn) { sim.rover.stuckWarn = false; ui.toast(t('ui.roverStuck')); }
    // rover recharges slowly at the garage
    if (!sim.driving) {
      const dg = Math.hypot(sim.rover.pos.x - 8, sim.rover.pos.z - 16);
      if (dg < 16) sim.rover.reserve = Math.min(1, sim.rover.reserve + dt * 0.012);
    }
  }
  updateFocus();
  updateCamera(dt);
  if (started && sim) ui.drawLabels(camera, sim);
  else document.getElementById('labels').replaceChildren();
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    loading.classList.add('off');
    setTimeout(() => loading.remove(), 700);
  }
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});

createSim(false);

// hide the start-screen buttons until 3D is ready
requestAnimationFrame(() => { document.getElementById('bEnter').disabled = false; });

// A tiny API for smoke tests and for curious players.
window.MADAR = {
  get sim() { return sim; },
  get world() { return world; },
  get ui() { return ui; },
  get started() { return started; },
  begin: (fresh = false) => ui.begin(fresh),
  teleport: (x, z) => sim.player.teleport(x, z),
  openSituation: id => import('./activities.js').then(m => m.openSituation(sim, ui, id)),
  openBoard: () => ui.openBoard(),
  openStation: id => ui.openStation(id),
  openJournal: () => ui.openJournal(),
  openGuide: () => ui.openGuide(),
  get camera() { return camera; },
  get controls() { return controls; },
  get ui() { return ui; },
  version: '1.0.0',
};

loop();
