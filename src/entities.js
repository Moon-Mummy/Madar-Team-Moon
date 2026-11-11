// Player, crew bots and the rover. All movement is done on the analytic terrain from world.js,
// with simple circle/rectangle collision so nothing walks through a wall.
import * as THREE from '../vendor/three.module.min.js';
import { STATIONS, CREW, SAMPLE_SITES, ROVER, NAV_NODES, NAV_EDGES, PLAYER } from './data.js';
import { heightAt, slopeDeg } from './world.js';
import { ROVER_PHYS, traction, SLOPE_SLIP_DEG } from './physics.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * clamp(t, 0, 1);
};

// ---------------------------------------------------------------------------------------------
// Collision volumes (circles and rectangles in XZ)
// ---------------------------------------------------------------------------------------------
export const BLOCKS = [];
function circle(x, z, r) { BLOCKS.push({ kind: 'circle', x, z, r }); }
function rect(x, z, hx, hz, rot = 0) { BLOCKS.push({ kind: 'rect', x, z, hx, hz, rot, cos: Math.cos(-rot), sin: Math.sin(-rot) }); }

rect(-2.5, -16.6, 11.3, 4.1);          // habitat cylinders
circle(6, -12.3, 2.1);                 // airlock module
circle(-12, -9, 4.25);                 // mission control
circle(12, -9, 3.95);                  // science lab
circle(-17, -1.5, 3.2);                // medical
circle(-16, 10, 3.2);                  // life support
circle(18, 5, 5.3);                    // greenhouse
rect(-5, 16, 5.55, 3.55, 2.57);        // workshop
rect(8, 16, 6.05, 4.05, -2.57);        // garage
circle(31, -12, 3.6);                  // power station
circle(-30, -14, 1.5);                 // relay tower
rect(-27.4, -12.8, 1.3, 1.1, 0.6);     // relay hut
for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
  circle(31 + 4 + col * 3.4, -12 + 2 + row * 3.6, 1.55); // solar panel rows
}

export function insideBlock(x, z, pad = 0.3) {
  for (const b of BLOCKS) {
    if (b.kind === 'circle') {
      if (Math.hypot(x - b.x, z - b.z) < b.r + pad) return true;
    } else {
      const dx = x - b.x, dz = z - b.z;
      const lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
      if (Math.abs(lx) < b.hx + pad && Math.abs(lz) < b.hz + pad) return true;
    }
  }
  return false;
}

export function collide(pos, radius = 0.55) {
  let hit = false;
  for (const b of BLOCKS) {
    if (b.kind === 'circle') {
      const dx = pos.x - b.x, dz = pos.z - b.z, d = Math.hypot(dx, dz), min = b.r + radius;
      if (d < min) {
        const p = min - d;
        if (d > 1e-5) { pos.x += (dx / d) * p; pos.z += (dz / d) * p; }
        else { pos.x += min; }
        hit = true;
      }
    } else {
      // Work in the rectangle's own frame so rotated buildings are accurate.
      const dx0 = pos.x - b.x, dz0 = pos.z - b.z;
      const lx = dx0 * b.cos - dz0 * b.sin;
      const lz = dx0 * b.sin + dz0 * b.cos;
      const nx = clamp(lx, -b.hx, b.hx), nz = clamp(lz, -b.hz, b.hz);
      const dx = lx - nx, dz = lz - nz, d = Math.hypot(dx, dz);
      if (d >= radius) continue;
      let px = lx, pz = lz;
      if (d > 1e-5) { px = lx + (dx / d) * (radius - d); pz = lz + (dz / d) * (radius - d); }
      else {
        const dl = lx + b.hx, dr = b.hx - lx, db = lz + b.hz, dt = b.hz - lz;
        const m = Math.min(dl, dr, db, dt);
        if (m === dl) px = -b.hx - radius;
        else if (m === dr) px = b.hx + radius;
        else if (m === db) pz = -b.hz - radius;
        else pz = b.hz + radius;
      }
      const c = Math.cos(b.rot), s2 = Math.sin(b.rot);
      pos.x = b.x + px * c - pz * s2;
      pos.z = b.z + px * s2 + pz * c;
      hit = true;
    }
  }
  return hit;
}

// ---------------------------------------------------------------------------------------------
// Astronaut model
// ---------------------------------------------------------------------------------------------
export const HIP_Y = 0.83;

// An Apollo/Artemis-style EVA suit: hard upper torso, chest control box, life-support backpack,
// gold sun visor over a clear bubble, bearing rings at every joint and boots made for regolith.
function astronaut(suitHex = 0xf3f6f8) {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: new THREE.Color(suitHex), roughness: 0.62, metalness: 0.04 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0xe9eef2, roughness: 0.8, metalness: 0.02 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8b959e, roughness: 0.45, metalness: 0.35 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xcdd6dd, roughness: 0.3, metalness: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc760, roughness: 0.06, metalness: 0.45, emissive: 0x7a4f0c, emissiveIntensity: 0.55 });
  const glove = new THREE.MeshStandardMaterial({ color: 0xd7dde2, roughness: 0.78, metalness: 0.04 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x3a4149, roughness: 0.9 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x9fe6ff });

  const sph = r => new THREE.SphereGeometry(r, 16, 12);
  const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 5, 14);
  const cyl = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const tor = (r, t) => new THREE.TorusGeometry(r, t, 8, 22);
  const put = (geo, mat, p = [0, 0, 0], parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p); m.castShadow = true; parent.add(m); return m;
  };

  const hips = new THREE.Group(); hips.position.y = HIP_Y; g.add(hips);

  // --- soft lower torso + waist bearing ------------------------------------------------
  put(box(0.42, 0.2, 0.3), fabric, [0, -0.1, 0], hips);
  put(cyl(0.23, 0.245, 0.07), trim, [0, 0.0, 0], hips);

  // --- hard upper torso -----------------------------------------------------------------
  const torso = put(cap(0.255, 0.24), suit, [0, 0.3, 0], hips);
  torso.scale.set(1, 1, 0.8);
  const collar = put(tor(0.23, 0.028), metal, [0, 0.5, 0], hips);
  collar.rotation.x = Math.PI / 2;
  // chest control module with its three switches
  put(box(0.3, 0.2, 0.05), suit, [0, 0.38, 0.19], hips);
  put(box(0.185, 0.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a323b, roughness: 0.5 }), [0, 0.39, 0.235], hips);
  const switchMats = [new THREE.MeshBasicMaterial({ color: 0x9fe6ff }), new THREE.MeshBasicMaterial({ color: 0xffb066 }), new THREE.MeshBasicMaterial({ color: 0x9df0b5 })];
  for (let i = -1; i <= 1; i++) put(box(0.03, 0.03, 0.02), switchMats[i + 1], [i * 0.055, 0.405, 0.268], hips);
  // shoulder patch (crew recolour this)
  put(box(0.11, 0.07, 0.02), trim, [-0.17, 0.46, 0.2], hips);
  // two hoses looping to the pack
  for (const side of [-1, 1]) {
    const hose = put(tor(0.075, 0.018), rubber, [side * 0.24, 0.3, 0.05], hips);
    hose.rotation.y = Math.PI / 2;
  }
  // life-support backpack: a squared shell with a vent block, ribs, status lights and struts
  put(box(0.46, 0.5, 0.22), fabric, [0, 0.32, -0.34], hips);
  put(box(0.48, 0.07, 0.24), metal, [0, 0.585, -0.34], hips);          // top vent block
  put(box(0.4, 0.03, 0.18), new THREE.MeshStandardMaterial({ color: 0x39424c, roughness: 0.7 }), [0, 0.625, -0.34], hips);
  for (const side of [-1, 1]) {
    put(box(0.03, 0.42, 0.02), trim, [side * 0.1, 0.32, -0.455], hips); // ribs
    put(box(0.06, 0.06, 0.02), side < 0 ? glow : new THREE.MeshBasicMaterial({ color: 0xffb066 }), [side * 0.16, 0.44, -0.455], hips);
    const hose = put(cyl(0.022, 0.022, 0.16), rubber, [side * 0.21, 0.42, -0.28], hips);
    hose.rotation.x = 1.1;
    const strut = put(cyl(0.02, 0.02, 0.2), metal, [side * 0.19, 0.5, -0.22], hips);
    strut.rotation.x = 0.95;
  }
  put(box(0.26, 0.05, 0.02), trim, [0, 0.15, -0.455], hips);           // lower panel seam
  put(cyl(0.009, 0.009, 0.3), metal, [0.18, 0.75, -0.34], hips);       // antenna

  // --- shoulders and arms ---------------------------------------------------------------
  const armL = new THREE.Group(); armL.position.set(-0.30, 0.46, 0); hips.add(armL);
  const armR = new THREE.Group(); armR.position.set(0.30, 0.46, 0); hips.add(armR);
  for (const a of [armL, armR]) {
    put(sph(0.125), suit, [0, 0.02, 0], a);
    put(cap(0.078, 0.13), suit, [0, -0.12, 0], a);
    put(sph(0.086), metal, [0, -0.245, 0], a);
    put(cap(0.072, 0.11), suit, [0, -0.35, 0], a);
    const cuff = put(tor(0.082, 0.017), metal, [0, -0.44, 0], a);
    cuff.rotation.x = Math.PI / 2;
    const hand = put(cap(0.068, 0.07), glove, [0, -0.505, 0.01], a);
    hand.rotation.x = Math.PI / 2;
    const thumb = put(cap(0.032, 0.04), glove, [0.045, -0.5, 0.055], a);
    thumb.rotation.z = Math.PI / 2.4;
  }

  // --- helmet ----------------------------------------------------------------------------
  const head = new THREE.Group(); head.position.y = 0.72; hips.add(head);
  put(cyl(0.155, 0.175, 0.08), metal, [0, -0.16, 0], head);           // neck ring
  const shell = put(sph(0.263), suit, [0, 0, 0], head);
  shell.scale.set(1.0, 1.02, 1.0);
  // The gold sun visor is a spherical cap sitting proud of the white helmet shell, the way the
  // real one wraps the front of the bubble. A full sphere here reads as a golden ball.
  const visorGeo = new THREE.SphereGeometry(0.272, 28, 20, Math.PI * 0.19, Math.PI * 0.62, Math.PI * 0.22, Math.PI * 0.36);
  const visor = new THREE.Mesh(visorGeo, gold);
  visor.castShadow = false;
  head.add(visor);
  // a thin metal lip around the bottom of the visor
  const lipGeo = new THREE.SphereGeometry(0.273, 28, 4, Math.PI * 0.19, Math.PI * 0.62, Math.PI * 0.585, Math.PI * 0.022);
  head.add(new THREE.Mesh(lipGeo, metal));
  const glint = put(sph(0.026), new THREE.MeshBasicMaterial({ color: 0xfff3d6 }), [-0.085, 0.09, 0.253], head);
  glint.scale.set(2.1, 0.5, 0.35);
  put(box(0.17, 0.045, 0.05), glow, [-0.02, 0.175, 0.19], head);       // brow lamp
  for (const side of [-1, 1]) {
    const lamp = put(cyl(0.032, 0.032, 0.05), metal, [side * 0.25, 0.0, 0.03], head);
    lamp.rotation.z = Math.PI / 2;
  }
  put(cyl(0.007, 0.007, 0.16), metal, [0.11, 0.24, -0.04], head);      // antenna

  // --- legs -------------------------------------------------------------------------------
  const legL = new THREE.Group(); legL.position.set(-0.14, -0.04, 0); hips.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.14, -0.04, 0); hips.add(legR);
  for (const l of [legL, legR]) {
    put(cap(0.112, 0.14), suit, [0, -0.16, 0], l);
    put(sph(0.112), metal, [0, -0.30, 0], l);
    put(cap(0.096, 0.12), fabric, [0, -0.44, 0], l);
    put(box(0.2, 0.17, 0.3), suit, [0, -0.66, 0.05], l);
    put(box(0.19, 0.11, 0.1), trim, [0, -0.655, 0.2], l);
    put(box(0.21, 0.045, 0.32), rubber, [0, -0.755, 0.055], l);
  }
  const stripe = new THREE.MeshStandardMaterial({ color: 0xd8564a, roughness: 0.6, metalness: 0.05 });
  put(box(0.045, 0.19, 0.02), stripe, [0.0, -0.16, 0.112], legL);
  put(box(0.04, 0.17, 0.02), stripe, [0.0, -0.44, 0.098], legL);

  g.userData = { hips, armL, armR, legL, legR, head, suit, visor };
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function setSuit(player) {
  const c = new THREE.Color(player.suitColor);
  player.mesh.userData.suit.color.copy(c);
  player.mesh.userData.suit.needsUpdate = true;
}

// ---------------------------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------------------------
export class Player {
  constructor(scene, suitColor = '#f3f6f8') {
    this.mesh = astronaut(suitColor);
    this.suitColor = suitColor;
    this.pos = new THREE.Vector3(PLAYER.spawn[0], 0, PLAYER.spawn[2]);
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.vy = 0; this.onGround = true;
    this.facing = Math.PI; this.speed = 0; this.walkPhase = 0;
    this.radius = 0.5;
    this.driving = false;
    this.mesh.position.copy(this.pos);
    scene.add(this.mesh);
  }

  teleport(x, z, facing = Math.PI) {
    this.pos.set(x, heightAt(x, z), z);
    this.facing = facing;
    this.mesh.position.copy(this.pos);
    this.vy = 0;
  }

  update(dt, input, camYaw, frozen = false) {
    if (this.driving) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    let ix = 0, iz = 0;
    if (!frozen) {
      if (input.forward) iz -= 1;
      if (input.back) iz += 1;
      if (input.left) ix -= 1;
      if (input.right) ix += 1;
    }
    const len = Math.hypot(ix, iz);
    const running = input.run;
    const targetSpeed = len > 0 ? (running ? PLAYER.run : PLAYER.walk) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 9);
    if (len > 0) {
      const nx = ix / len, nz = iz / len;
      // camera-relative movement
      const cos = Math.cos(camYaw), sin = Math.sin(camYaw);
      const dx = nx * cos - nz * sin;
      const dz = nx * sin + nz * cos;
      const step = this.speed * dt;
      const before = this.pos.clone();
      this.pos.x += dx * step; this.pos.z += dz * step;
      collide(this.pos, this.radius);
      const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
      this.walkPhase += moved * 2.2;
      this.facing = lerpAngle(this.facing, Math.atan2(dx, dz), dt * 12);
    } else {
      this.walkPhase += dt * 0.9;
    }
    // clamp to the surveyed area
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > PLAYER.bound) { this.pos.x *= PLAYER.bound / d; this.pos.z *= PLAYER.bound / d; }
    // vertical: true lunar gravity for hops
    const ground = heightAt(this.pos.x, this.pos.z);
    if (input.jump && this.onGround && !frozen) { this.vy = PLAYER.hop; this.onGround = false; }
    this.vy -= PLAYER.gravity * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= ground) { this.pos.y = ground; this.vy = 0; this.onGround = true; }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.facing;
    // walk cycle
    const s = clamp(this.speed / PLAYER.walk, 0, 1.4);
    const k = Math.sin(this.walkPhase * 2.4) * 0.55 * s;
    const u = this.mesh.userData;
    u.legL.rotation.x = k; u.legR.rotation.x = -k;
    u.armL.rotation.x = -k * 0.7; u.armR.rotation.x = k * 0.7;
    u.hips.position.y = HIP_Y + Math.abs(Math.sin(this.walkPhase * 2.4)) * 0.05 * s + Math.sin(this.walkPhase * 0.9) * 0.008;
    u.head.rotation.y = Math.sin(this.walkPhase * 0.6) * 0.08;
    if (!this.onGround) { u.legL.rotation.x = 0.5; u.legR.rotation.x = -0.3; }
  }
}

// ---------------------------------------------------------------------------------------------
// Crew NPCs: people in suits, not robots. Each one is the same astronaut rig as the player, with a
// personal suit colour, a shoulder flash and a tinted visor, so you can tell who is who from far
// away. They walk with a real gait and turn to face you when you get close.
// ---------------------------------------------------------------------------------------------
function npcBody(hex, skin = 0xe8eef2) {
  const g = astronaut(skin);
  const u = g.userData;
  const accent = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0.15, emissive: hex, emissiveIntensity: 0.08 });
  // chest patch
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.03), accent);
  patch.position.set(-0.17, 0.46, 0.212); u.hips.add(patch);
  // shoulder flashes on the upper arms so they read from the side
  for (const side of [-1, 1]) {
    const flash = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.16), accent);
    flash.position.set(side * 0.115, -0.02, 0);
    (side < 0 ? u.armL : u.armR).add(flash);
  }
  // painted crown on the helmet: readable from a distance, and it never crosses the visor
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.2655, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.34),
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0.15, side: THREE.DoubleSide })
  );
  crown.scale.set(1.0, 1.02, 1.0);
  u.head.add(crown);
  // a hint of colour in the visor reflection keeps the five of them distinct up close
  if (u.visor) { u.visor.material = u.visor.material.clone(); u.visor.material.emissive = new THREE.Color(hex); u.visor.material.emissiveIntensity = 0.16; }
  // name light on the backpack
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.03), new THREE.MeshBasicMaterial({ color: hex }));
  lamp.position.set(0, 0.55, -0.455); u.hips.add(lamp);
  g.userData.accent = accent;
  g.userData.flash = lamp;
  return g;
}

const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
function nearestNode(x, z) {
  let best = null, bd = 1e9;
  for (const [id, p] of Object.entries(NAV_NODES)) {
    const d = dist2(x, z, p[0], p[1]);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}
const ADJ = (() => {
  const m = {};
  for (const [a, b] of NAV_EDGES) { (m[a] ||= []).push(b); (m[b] ||= []).push(a); }
  return m;
})();
export function findPath(fromX, fromZ, toNode) {
  const start = nearestNode(fromX, fromZ);
  if (!start || !NAV_NODES[toNode]) return [];
  const prev = { [start]: null }, q = [start];
  while (q.length) {
    const n = q.shift();
    if (n === toNode) break;
    for (const nb of ADJ[n] || []) if (!(nb in prev)) { prev[nb] = n; q.push(nb); }
  }
  if (!(toNode in prev)) return [];
  const path = [];
  let cur = toNode;
  while (cur && cur !== start) { path.unshift(NAV_NODES[cur]); cur = prev[cur]; }
  return path;
}

export class Crew {
  constructor(scene, sim) {
    this.scene = scene; this.sim = sim;
    this.npcs = CREW.map(c => {
      const mesh = npcBody(c.hue);
      const st = STATIONS.find(s => s.id === c.home) || STATIONS[2];
      const homeNode = `${st.id}Door`;
      const p = NAV_NODES[homeNode] || NAV_NODES.hub;
      const npc = {
        ...c, mesh, state: 'idle', node: homeNode, path: [], speed: 1.25,
        pos: new THREE.Vector3(p[0], 0, p[1]), target: null, facing: 0, seed: Math.random() * 10,
        talkUntil: 0, taskStation: null, timer: 2 + Math.random() * 4, patrol: null,
        step: 0, moving: 0, speaking: false, barkAt: 0,
      };
      npc.pos.y = heightAt(p[0], p[1]);
      mesh.position.copy(npc.pos);
      scene.add(mesh);
      return npc;
    });
    this.byId = Object.fromEntries(this.npcs.map(b => [b.id, b]));
  }

  npc(id) { return this.byId[id]; }

  /** Send a bot to a station door node and mark what it is doing. */
  sendTo(id, nodeId, state) {
    const b = this.byId[id];
    if (!b) return;
    if (b.node === nodeId && b.path.length === 0) { b.state = state; return; }
    b.path = findPath(b.pos.x, b.pos.z, nodeId);
    b.node = nodeId;
    b.state = state;
    if (b.path.length === 0) b.state = 'idle';
  }

  /** Bring a bot to a point (used when the player talks to it: it stops and turns). */
  talkTo(id, until) { const b = this.byId[id]; if (b) { b.talkUntil = until; b.state = 'interacting'; } }

  update(dt, t, sim) {
    for (const b of this.npcs) {
      const night = sim.sleeping;
      // finish short-lived states
      if (b.state === 'interacting' && t > b.talkUntil) b.state = 'idle';
      if ((b.state === 'returning' || b.state === 'investigating' || b.state === 'repairing') && b.path.length === 0 && !b.taskHeld) {
        if (b.state === 'returning') b.state = 'idle';
      }
      // Night: everyone except the watch walks to the habitat.
      let desiredNode = b.node;
      if (night && !sim.isWatch(b.id) && b.state !== 'investigating' && b.state !== 'repairing') desiredNode = 'habDoor';
      if (!night && b.state === 'resting') b.state = 'idle';

      const moving = b.path.length > 0;
      if (moving) {
        const [tx, tz] = b.path[0];
        const dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz);
        if (d < 0.35) { b.path.shift(); }
        else {
          const step = Math.min(d, b.speed * dt);
          const before = { x: b.pos.x, z: b.pos.z };
          b.pos.x += (dx / d) * step; b.pos.z += (dz / d) * step;
          collide(b.pos, 0.45);
          b.facing = lerpAngle(b.facing, Math.atan2(dx, dz), dt * 6);
          if (Math.hypot(b.pos.x - before.x, b.pos.z - before.z) < step * 0.2) b.path = []; // stuck
        }
      } else {
        // Small idle patrol so the base feels alive.
        b.timer -= dt;
        if (b.timer <= 0 && b.state !== 'interacting') {
          b.timer = 9 + Math.random() * 12;
          if (night) { b.state = 'resting'; }
          else if (b.state === 'idle') {
            const base = NAV_NODES[desiredNode] || NAV_NODES.hub;
            const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * 2.4;
            b.path = [[base[0] + Math.cos(a) * r, base[1] + Math.sin(a) * r]];
            b.facing = Math.atan2(Math.cos(a), Math.sin(a));
          }
        }
        if (b.state !== 'interacting') b.facing += Math.sin(t * 0.4 + b.seed) * dt * 0.12;
      }

      // If the player is standing close, turn to face them.
      const pp = sim.player.pos;
      if (dist2(b.pos.x, b.pos.z, pp.x, pp.z) < 4) {
        b.facing = lerpAngle(b.facing, Math.atan2(pp.x - b.pos.x, pp.z - b.pos.z), dt * 3);
      }
      b.pos.y = heightAt(b.pos.x, b.pos.z);
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.y = b.facing;
      // A real gait: legs and arms swing with the distance walked, not with a clock, so a person
      // standing still stands still. Suited walking on the Moon is a slow, slightly bouncing lope.
      const moved = Math.hypot(b.pos.x - (b.prevX ?? b.pos.x), b.pos.z - (b.prevZ ?? b.pos.z));
      b.prevX = b.pos.x; b.prevZ = b.pos.z;
      b.moving += ((moved > 0.002 ? 1 : 0) - b.moving) * Math.min(1, dt * 6);
      b.step += moved * 3.4;
      const u = b.mesh.userData;
      const swing = Math.sin(b.step) * 0.55 * b.moving;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.65;
      u.armR.rotation.x = swing * 0.65;
      u.hips.position.y = HIP_Y + Math.abs(Math.sin(b.step)) * 0.05 * b.moving;
      // idle sway and looking around
      u.hips.rotation.z = Math.sin(t * 0.9 + b.seed) * 0.015;
      u.head.rotation.y = Math.sin(t * 0.5 + b.seed) * 0.22 * (1 - b.moving);
      if (b.speaking) {
        u.armR.rotation.x = -0.7 + Math.sin(t * 6.5) * 0.22;
        u.head.rotation.y = Math.sin(t * 1.4) * 0.12;
      }
      if (u.flash) u.flash.material.color.setHex(b.speaking ? 0xffffff : b.hue);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Rover driving
// ---------------------------------------------------------------------------------------------
export class RoverCar {
  constructor(mesh, sim) {
    this.mesh = mesh; this.sim = sim;
    const [x, z] = ROVER.park;
    this.pos = new THREE.Vector3(x, heightAt(x, z), z);
    this.heading = ROVER.heading; this.speed = 0; this.steer = 0;
    this.reserve = 0.74; // battery reserve, 0..1
    this.occupied = false;
    this.mesh.position.copy(this.pos);
  }

  enter() { this.occupied = true; }
  exit() { this.occupied = false; this.speed = 0; }

  update(dt, input, driving) {
    if (!this.occupied) {
      this.speed *= Math.max(0, 1 - dt * 4);
      this.mesh.position.copy(this.pos);
      return;
    }
    const throttle = driving ? (input.forward ? 1 : input.back ? -1 : 0) : 0;
    const steerIn = driving ? ((input.left ? 1 : 0) + (input.right ? -1 : 0)) : 0;

    // Look at the ground in the direction the wheels are turning before deciding how fast to go.
    // Slope is only ever a speed penalty: the LRV was cleared for 16 deg, but a rover that refuses
    // to move is not a rover.
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const travel = this.speed >= 0 ? 1 : -1;
    const ahead = 1.9;
    const slope = slopeDeg(this.pos.x + fx * ahead * travel, this.pos.z + fz * ahead * travel);
    const overGrade = slope > ROVER.slopeLimit;
    const grip = traction(slope);
    this.slipping = slope > SLOPE_SLIP_DEG * 0.75;
    this.tooSteep = overGrade;
    if (overGrade) {
      if (!this.gradeWarned) { this.steepWarn = true; this.gradeWarned = true; }
    } else this.gradeWarned = false;

    const target = throttle * ROVER.maxSpeed * (overGrade ? 0.38 : 1);
    this.speed += clamp(target - this.speed, -dt * 9, dt * 9);
    if (Math.abs(this.speed) < 0.05) this.speed = 0;
    this.steer += (steerIn - this.steer) * Math.min(1, dt * 5);
    const turn = this.steer * (0.7 + Math.abs(this.speed) * 0.1) * dt * Math.min(1, Math.abs(this.speed) / 4);
    this.heading += turn * Math.sign(this.speed || 1) * 1.4;

    const step = this.speed * dt;
    const fromX = this.pos.x, fromZ = this.pos.z;
    const nx = this.pos.x + fx * step, nz = this.pos.z + fz * step;
    // Loose regolith on a bank means less of the commanded step actually happens.
    this.pos.x = nx * (1 - (1 - grip) * 0.35) + this.pos.x * ((1 - grip) * 0.35);
    this.pos.z = nz * (1 - (1 - grip) * 0.35) + this.pos.z * ((1 - grip) * 0.35);
    collide(this.pos, 1.6);
    const distFromBase = Math.hypot(this.pos.x, this.pos.z);
    if (distFromBase > ROVER.spawnRadius) {
      this.pos.x *= ROVER.spawnRadius / distFromBase;
      this.pos.z *= ROVER.spawnRadius / distFromBase;
      this.speed *= 0.4;
    }
    // If the rover is pinned against something while the driver pushes on, reverse gently.
    const moved = Math.hypot(this.pos.x - fromX, this.pos.z - fromZ);
    if (Math.abs(throttle) > 0 && Math.abs(this.speed) > 1.0 && moved < Math.abs(this.speed) * dt * 0.3) this.stuck = (this.stuck || 0) + dt;
    else this.stuck = 0;
    if (this.stuck > 1.1) {
      this.speed = -4;
      this.stuck = 0;
      this.stuckWarn = true;
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    // pitch and roll follow the ground
    const e = 1.4;
    const hF = heightAt(this.pos.x + fx * e, this.pos.z + fz * e), hB = heightAt(this.pos.x - fx * e, this.pos.z - fz * e);
    const hL = heightAt(this.pos.x - fz * e, this.pos.z + fx * e), hR = heightAt(this.pos.x + fz * e, this.pos.z - fx * e);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(Math.atan2(hB - hF, 2 * e), this.heading, Math.atan2(hR - hL, 2 * e), 'YXZ');
    for (const w of this.mesh.userData.wheels) w.rotation.x += (this.speed / 0.42) * dt;
    // Battery: 8.7 kWh of silver-zinc packs, 0.24 Wh per metre on the flat, a little more
    // climbing. That works out at the LRV's published 36 km working range.
    const metres = Math.abs(this.speed) * dt;
    const wh = metres * (ROVER_PHYS.whPerMetre + slope * ROVER_PHYS.whPerMetreSlope);
    this.reserve = clamp(this.reserve - wh / (ROVER_PHYS.batteryKwh * 1000) - dt * 0.00002, 0, 1);
    if (Math.floor(this.reserve * 1000) % 97 === 0 && this.sim.charging) this.reserve = clamp(this.reserve + dt * 0.004, 0, 1);
  }

  nearestSite() {
    let best = null, bd = 1e9;
    for (const s of SAMPLE_SITES) {
      const d = dist2(this.pos.x, this.pos.z, s.x, s.z);
      if (d < bd) { bd = d; best = s; }
    }
    return bd < 8 ? best : null;
  }
}
