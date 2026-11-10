// Player, crew bots and the rover. All movement is done on the analytic terrain from world.js,
// with simple circle/rectangle collision so nothing walks through a wall.
import * as THREE from '../vendor/three.module.min.js';
import { STATIONS, CREW, SAMPLE_SITES, ROVER, NAV_NODES, NAV_EDGES, PLAYER } from './data.js';
import { heightAt, slopeDeg } from './world.js';

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
function astronaut(suitHex = 0xf3f6f8) {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: new THREE.Color(suitHex), roughness: 0.65, metalness: 0.08, flatShading: true });
  const trim = new THREE.MeshStandardMaterial({ color: 0x39424d, roughness: 0.7, flatShading: true });
  const pack = new THREE.MeshStandardMaterial({ color: 0xb7c2cb, roughness: 0.55, metalness: 0.3, flatShading: true });
  const visor = new THREE.MeshStandardMaterial({ color: 0x1b2c3b, roughness: 0.12, metalness: 0.9, emissive: 0x0a2b3a, emissiveIntensity: 0.6 });
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const add = (geo, mat, p, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.castShadow = true; parent.add(m); return m; };

  const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips);
  add(box(0.52, 0.24, 0.34), trim, [0, 0, 0], hips);
  // torso
  add(box(0.62, 0.6, 0.4), suit, [0, 0.36, 0], hips);
  add(box(0.66, 0.16, 0.44), trim, [0, 0.12, 0], hips); // belt
  // life-support backpack
  add(box(0.56, 0.62, 0.28), pack, [0, 0.38, -0.33], hips);
  add(box(0.4, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0x8fe6ff }), [0, 0.52, -0.49], hips);
  // shoulders + arms
  const armL = new THREE.Group(); armL.position.set(-0.38, 0.6, 0); hips.add(armL);
  const armR = new THREE.Group(); armR.position.set(0.38, 0.6, 0); hips.add(armR);
  for (const a of [armL, armR]) {
    add(box(0.18, 0.5, 0.2), suit, [0, -0.22, 0], a);
    add(box(0.2, 0.16, 0.22), trim, [0, -0.48, 0], a);
  }
  // helmet
  const head = new THREE.Group(); head.position.y = 0.95; hips.add(head);
  const helmet = add(new THREE.SphereGeometry(0.3, 16, 12), suit, [0, 0, 0], head);
  helmet.scale.set(1, 1.05, 1);
  const v = add(new THREE.SphereGeometry(0.235, 16, 12), visor, [0, 0.01, 0.13], head);
  v.scale.set(1, 0.86, 0.7);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), pack, [0.26, -0.05, 0.06], head).rotation.z = Math.PI / 2;
  add(box(0.16, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x9fe6ff }), [-0.16, 0.1, 0.26], head);
  // legs
  const legL = new THREE.Group(); legL.position.set(-0.16, -0.05, 0); hips.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.16, -0.05, 0); hips.add(legR);
  for (const l of [legL, legR]) {
    add(box(0.22, 0.55, 0.24), suit, [0, -0.3, 0], l);
    add(box(0.24, 0.18, 0.32), trim, [0, -0.6, 0.04], l);
  }
  g.userData = { hips, armL, armR, legL, legR, head, suit };
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
    u.hips.position.y = 0.92 + Math.abs(Math.sin(this.walkPhase * 2.4)) * 0.05 * s + Math.sin(this.walkPhase * 0.9) * 0.008;
    u.head.rotation.y = Math.sin(this.walkPhase * 0.6) * 0.08;
    if (!this.onGround) { u.legL.rotation.x = 0.5; u.legR.rotation.x = -0.3; }
  }
}

// ---------------------------------------------------------------------------------------------
// Crew bots: hovering, friendly, and they walk the nav graph rather than drifting in circles.
// ---------------------------------------------------------------------------------------------
function botBody(hex) {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.5, metalness: 0.25, flatShading: true });
  const accent = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.45, metalness: 0.2, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b3540, roughness: 0.7, flatShading: true });
  const glowM = new THREE.MeshBasicMaterial({ color: hex });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.36, 6, 12), shell);
  body.position.y = 1.15; body.castShadow = true; g.add(body);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.19, 0.1), new THREE.MeshStandardMaterial({ color: 0x0d2233, roughness: 0.1, metalness: 0.8, emissive: hex, emissiveIntensity: 0.28 }));
  visor.position.set(0, 1.25, 0.3); g.add(visor);
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.04), glowM);
  eyes.position.set(0, 1.27, 0.36); g.add(eyes);
  // shoulder ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.05, 6, 16), accent);
  ring.position.y = 0.98; ring.rotation.x = Math.PI / 2; g.add(ring);
  // arms
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), shell);
  armL.position.set(-0.4, 1.1, 0); armL.rotation.z = 0.35; g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.4; armR.rotation.z = -0.35; g.add(armR);
  // hover base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.24, 12), dark);
  base.position.y = 0.74; g.add(base);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 5, 14), glowM);
  halo.position.y = 0.62; halo.rotation.x = Math.PI / 2; g.add(halo);
  const thr = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.3, 8, 1, true), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
  thr.position.y = 0.45; thr.rotation.x = Math.PI; g.add(thr);
  // antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 5), dark);
  ant.position.set(0.12, 1.65, -0.04); g.add(ant);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glowM);
  tip.position.set(0.12, 1.79, -0.04); g.add(tip);
  g.userData = { body, visor, eyes, armL, armR, halo, thr, tip, base, accent };
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
    this.bots = CREW.map(c => {
      const mesh = botBody(c.hue);
      const st = STATIONS.find(s => s.id === c.home) || STATIONS[2];
      const homeNode = `${st.id}Door`;
      const p = NAV_NODES[homeNode] || NAV_NODES.hub;
      const bot = {
        ...c, mesh, state: 'idle', node: homeNode, path: [], speed: 2.1,
        pos: new THREE.Vector3(p[0], 0, p[1]), target: null, facing: 0, bobSeed: Math.random() * 10,
        talkUntil: 0, taskStation: null, timer: 2 + Math.random() * 4, patrol: null,
      };
      bot.pos.y = heightAt(p[0], p[1]);
      mesh.position.copy(bot.pos);
      scene.add(mesh);
      return bot;
    });
    this.byId = Object.fromEntries(this.bots.map(b => [b.id, b]));
  }

  bot(id) { return this.byId[id]; }

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
    for (const b of this.bots) {
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
        if (b.state !== 'interacting') b.facing += Math.sin(t * 0.4 + b.bobSeed) * dt * 0.3;
      }

      // If the player is standing close, turn to face them.
      const pp = sim.player.pos;
      if (dist2(b.pos.x, b.pos.z, pp.x, pp.z) < 4) {
        b.facing = lerpAngle(b.facing, Math.atan2(pp.x - b.pos.x, pp.z - b.pos.z), dt * 3);
      }
      b.pos.y = heightAt(b.pos.x, b.pos.z);
      const bob = Math.sin(t * 1.6 + b.bobSeed) * 0.05;
      b.mesh.position.set(b.pos.x, b.pos.y + 0.12 + bob, b.pos.z);
      b.mesh.rotation.y = b.facing;
      // tiny animation: eyes blink, arms sway
      const u = b.mesh.userData;
      u.armL.rotation.x = Math.sin(t * 1.2 + b.bobSeed) * 0.16;
      u.armR.rotation.x = -Math.sin(t * 1.2 + b.bobSeed) * 0.16;
      u.halo.rotation.z = t * 0.8;
      u.thr.material.opacity = 0.2 + Math.sin(t * 6 + b.bobSeed) * 0.08;
      const blink = (Math.sin(t * 0.9 + b.bobSeed * 3) > 0.985) ? 0.02 : 1;
      u.eyes.scale.y = blink;
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
    const maxSpeed = ROVER.maxSpeed;
    if (!this.occupied) {
      this.speed *= Math.max(0, 1 - dt * 4);
      this.mesh.position.copy(this.pos);
      return;
    }
    const throttle = driving ? (input.forward ? 1 : input.back ? -1 : 0) : 0;
    const steerIn = driving ? ((input.left ? 1 : 0) + (input.right ? -1 : 0)) : 0;
    const target = throttle * maxSpeed;
    this.speed += clamp(target - this.speed, -dt * 9, dt * 9);
    if (Math.abs(this.speed) < 0.05) this.speed = 0;
    this.steer += (steerIn - this.steer) * Math.min(1, dt * 5);
    const turn = this.steer * (0.7 + Math.abs(this.speed) * 0.1) * dt * Math.min(1, Math.abs(this.speed) / 4);
    this.heading += turn * Math.sign(this.speed || 1) * 1.4;

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const step = this.speed * dt;
    const fromX = this.pos.x, fromZ = this.pos.z;
    const nx = this.pos.x + fx * step, nz = this.pos.z + fz * step;
    // slope check ahead
    const ahead = 1.9;
    const slope = slopeDeg(nx + fx * ahead, nz + fz * ahead);
    this.tooSteep = slope > ROVER.slopeLimit && Math.abs(this.speed) > 0.6;
    if (this.tooSteep) {
      this.speed *= Math.max(0, 1 - dt * 6);
    } else {
      this.pos.x = nx; this.pos.z = nz;
      collide(this.pos, 1.6);
      const d = Math.hypot(this.pos.x, this.pos.z);
      if (d > ROVER.spawnRadius) { this.pos.x *= ROVER.spawnRadius / d; this.pos.z *= ROVER.spawnRadius / d; this.speed *= 0.4; }
    }
    // If the rover is pinned against something while the driver pushes on, reverse gently.
    const moved = Math.hypot(this.pos.x - fromX, this.pos.z - fromZ);
    if (throttle > 0 && Math.abs(this.speed) > 1.4 && moved < Math.abs(this.speed) * dt * 0.3) this.stuck = (this.stuck || 0) + dt;
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
    for (const w of this.mesh.userData.wheels) w.rotation.y += this.speed * dt * 1.4;
    // battery
    const drain = (Math.abs(this.speed) / maxSpeed) * 0.0022 + 0.00008;
    this.reserve = clamp(this.reserve - drain * dt, 0.02, 1);
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
