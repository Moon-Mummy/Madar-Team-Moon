// World building for Madar-Team-Moon: analytic lunar terrain plus a stylised south-pole outpost.
// Everything here is deterministic (a fixed seed), so the map looks identical on every device.
import * as THREE from '../vendor/three.module.min.js';
import { STATIONS, CRATERS, SAMPLE_SITES, ROVER, NAV_NODES } from './data.js';

const rand = (() => { let s = 20261110; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------------------------
// Terrain: flat where the outpost lives, then gentle regolith swells, bowl craters with raised rims,
// and one hill for the relay mast. y is in metres.
// ---------------------------------------------------------------------------------------------
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  let h = 0;
  // Base undulation, faded out near the outpost so buildings sit on level ground.
  const amp = smooth(44, 68, d) + 0.22;
  h += amp * (1.5 * Math.sin(x * 0.052) * Math.cos(z * 0.061) + 0.9 * Math.sin((x + z) * 0.031 + 1.7) + 0.55 * Math.cos(z * 0.083 - 0.4));
  // Relay hill (south-west), soft gaussian so the mast has height.
  h += 9.0 * Math.exp(-(((x + 30) ** 2 + (CRATERS.length ? 0 : 0) + (z + 14) ** 2) / (2 * 15 * 15)));
  // Craters: shallow bowl plus a rim that rises above the surroundings.
  for (const c of CRATERS) {
    const dd = Math.hypot(x - c.x, z - c.z) / c.r;
    if (dd < 2.6) {
      const bowl = -c.d * (1 - smooth(0, 1.05, dd));
      const rim = c.d * 0.42 * Math.exp(-(((dd - 1.08) / 0.34) ** 2));
      h += bowl + rim;
    }
  }
  // Landing-pad shelf is dead flat.
  const pd = Math.hypot(x + 46, z - 22);
  h *= smooth(8, 15, pd);
  return h;
}

export function slopeDeg(x, z) {
  const e = 0.7;
  const dx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
  const dz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
}

// ---------------------------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------------------------
const C = { hull: 0xdfe4e8, hull2: 0xb9c2c9, dark: 0x39424d, metal: 0x8d99a4, glass: 0x8fd7ec, warm: 0xffcf8a, accent: 0x69d4e7, crop: 0x5fbf6a, panel: 0x2b3f7a, gold: 0xf1c36d, rust: 0xb0603f };
const M = {};
function mkMat(key, color, opts = {}) {
  if (!M[key]) M[key] = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0.1, ...opts.extra });
  return M[key].clone ? M[key] : M[key];
}
function lam(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: opts.flat !== false, roughness: opts.rough ?? 0.72, metalness: opts.metal ?? 0.12, ...opts.extra });
}
const hullMat = () => lam(C.hull, { rough: 0.55, metal: 0.25 });
const hull2Mat = () => lam(C.hull2, { rough: 0.6, metal: 0.2 });
const darkMat = () => lam(C.dark, { rough: 0.8 });
const metalMat = () => lam(C.metal, { rough: 0.4, metal: 0.6 });

const glassMat = () => new THREE.MeshPhysicalMaterial({ color: 0xbfeef7, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
const glow = (hex) => new THREE.MeshBasicMaterial({ color: hex });

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  dome4: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  dome6: new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  cyl16: new THREE.CylinderGeometry(1, 1, 1, 16),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 8),
  sph: new THREE.SphereGeometry(1, 16, 12),
  ring: new THREE.RingGeometry(0.86, 1, 26),
  plane: new THREE.PlaneGeometry(1, 1),
};

// Add a mesh with position/scale/rotation helpers.
function add(parent, geo, mat, pos, scale, rot) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (scale) typeof scale === 'number' ? m.scale.setScalar(scale) : m.scale.set(scale[0], scale[1], scale[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------------------------------------
// Building parts
// ---------------------------------------------------------------------------------------------
function windowStrip(parent, radius, y, count, hex = 0x9fe6ff, h = 0.5) {
  const g = new THREE.BoxGeometry(radius * 0.4, h, 0.12);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const w = new THREE.Mesh(g, glow(hex));
    w.position.set(Math.sin(a) * radius, y, Math.cos(a) * radius);
    w.rotation.y = a;
    parent.add(w);
  }
}


// ---------------------------------------------------------------------------------------------
// Painted plates: the outpost needs a name on it.
// ---------------------------------------------------------------------------------------------
function plateTexture(lines, accent = '#7fe3ee') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#0c1724'; x.fillRect(0, 0, 512, 160);
  x.strokeStyle = 'rgba(120,200,220,.45)'; x.lineWidth = 5; x.strokeRect(6, 6, 500, 148);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = accent;
  x.font = 'bold 62px "Segoe UI", system-ui, sans-serif';
  x.fillText(lines[0], 256, lines[1] ? 62 : 82);
  if (lines[1]) {
    x.fillStyle = '#b9d7e2';
    x.font = 'bold 26px "Segoe UI", system-ui, sans-serif';
    x.fillText(lines[1], 256, 116);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function signPlate(parent, lines, pos, size, rotY = 0, accent) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    new THREE.MeshBasicMaterial({ map: plateTexture(lines, accent) })
  );
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.y = rotY;
  parent.add(m);
  return m;
}

function wallSeams(parent, w, h, d, y0, mat) {
  // vertical panel seams on the four walls
  for (const s of [-1, 1]) {
    for (let i = -3; i <= 3; i++) {
      add(parent, G.box, mat, [i * (w / 7), y0 + h / 2, s * (d / 2 + 0.015)], [0.055, h * 0.92, 0.02]);
      add(parent, G.box, mat, [s * (w / 2 + 0.015), y0 + h / 2, i * (d / 6)], [0.02, h * 0.92, 0.055]);
    }
  }
  // horizontal ribs
  for (const yy of [y0 + h * 0.12, y0 + h * 0.88]) {
    add(parent, G.box, mat, [0, yy, d / 2 + 0.02], [w, 0.06, 0.02]);
    add(parent, G.box, mat, [0, yy, -d / 2 - 0.02], [w, 0.06, 0.02]);
    add(parent, G.box, mat, [w / 2 + 0.02, yy, 0], [0.02, 0.06, d]);
    add(parent, G.box, mat, [-w / 2 - 0.02, yy, 0], [0.02, 0.06, d]);
  }
}

function roofGear(parent, w, d, y) {
  add(parent, G.cyl8, metalMat(), [-w * 0.26, y + 0.42, -d * 0.2], [0.34, 0.55, 0.34]);
  add(parent, G.box, lam(0xa8b3bb), [-w * 0.26, y + 0.28, -d * 0.2], [0.9, 0.12, 0.9]);
  const ductMat = lam(0xb9c2c8, { rough: 0.55, metal: 0.3 });
  const duct = add(parent, G.cyl8, ductMat, [w * 0.14, y + 0.34, 0], [0.28, w * 0.62, 0.28]);
  duct.rotation.z = Math.PI / 2;
  for (let i = -1; i <= 1; i++) add(parent, G.cyl8, ductMat, [w * 0.14 + i * w * 0.2, y + 0.34, 0], [0.34, 0.1, 0.34]).rotation.z = Math.PI / 2;
  add(parent, G.box, lam(0x5b6873), [w * 0.3, y + 0.22, d * 0.24], [1.2, 0.4, 0.8]);
  add(parent, G.cyl6, metalMat(), [-w * 0.36, y + 0.9, d * 0.26], [0.05, 1.8, 0.05]);
  const b = add(parent, G.sph, glow(0xff8f86), [-w * 0.36, y + 1.82, d * 0.26], 0.11);
  b.userData.beacon = true;
}

function wallLamps(parent, w, d, y) {
  for (const s of [-1, 1]) {
    for (const x of [-w * 0.33, w * 0.33]) {
      add(parent, G.box, glow(0xffd9a0), [x, y, s * (d / 2 + 0.06)], [0.34, 0.14, 0.06]);
    }
  }
}

function habitat(parent, st) {
  const g = new THREE.Group();
  g.position.set(st.x, 0, st.z);
  const body = hullMat(), trim = hull2Mat();
  const r = 3.35, len = 8.4, y = 1.15;
  const cyl = new THREE.CylinderGeometry(r, r, len, 22, 1, false);
  const xs = [-8.6, 0, 8.6];
  xs.forEach(dx => {
    add(g, cyl, body, [dx, y, 0], 1, [0, 0, Math.PI / 2]);
    // rings at both ends and one in the middle give the barrel its shape
    for (const off of [-len / 2 + 0.12, 0, len / 2 - 0.12]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.11, 6, 24, Math.PI), trim);
      ring.position.set(dx + off, y, 0);
      ring.rotation.set(0, Math.PI / 2, 0);
      ring.castShadow = true;
      g.add(ring);
    }
    // end caps
    if (dx !== 0) {
      const sgn = dx < 0 ? -1 : 1;
      const cap = new THREE.Mesh(new THREE.CircleGeometry(r, 22), trim);
      cap.position.set(dx + sgn * (len / 2 + 0.01), y, 0);
      cap.rotation.y = sgn * Math.PI / 2;
      g.add(cap);
      // a little airlock hatch on the end
      add(g, G.cyl16, hull2Mat(), [dx + sgn * (len / 2 + 0.22), y, 0], [1.05, 0.4, 1.05], [0, 0, Math.PI / 2]);
    }
    // windows along the sunlit face
    for (let k = -2; k <= 2; k++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.5, 0.09), glow(0xbde9ff));
      w.position.set(dx + k * 1.5, y + 0.75, r * 0.985);
      g.add(w);
      add(g, G.box, trim, [dx + k * 1.5, y + 0.4, r * 0.99], [0.86, 0.09, 0.06]);
    }
  });
  // connector tunnels between the barrels
  for (const dx of [-4.3, 4.3]) {
    add(g, G.cyl16, hull2Mat(), [dx, y, 0], [1.5, 1.5, 1.5], [0, 0, Math.PI / 2]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.09, 5, 18), metalMat());
    ring.position.set(dx, y, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
  }
  // entrance module on the middle barrel, facing the door point
  add(g, G.cyl16, hullMat(), [0.4, 1.25, 4.35], [1.55, 2.6, 1.55]);
  add(g, G.cyl16, hull2Mat(), [0.4, 2.6, 4.35], [1.75, 0.34, 1.75]);
  add(g, G.box, darkMat(), [0.4, 1.1, 5.55], [1.55, 2.15, 0.15]);
  add(g, G.box, glow(0x6fd4e7), [0.4, 1.2, 5.64], [1.15, 1.7, 0.06]);
  add(g, G.box, metalMat(), [0.4, 2.32, 5.6], [1.7, 0.16, 0.22]);
  add(g, G.box, darkMat(), [0.4, 3.12, 5.32], [2.7, 0.95, 0.14]);
  signPlate(g, ['MADAR', 'OUTPOST · SOUTH POLE'], [0.4, 3.12, 5.4], [2.5, 0.78], 0, '#8fe8f2');
  // rooftop kit
  add(g, G.box, darkMat(), [-8.6, y + r + 0.1, 0], [2.4, 0.28, 1.5]);
  add(g, G.cyl8, metalMat(), [-8.6, y + r + 0.45, 0], [0.36, 0.7, 0.36]);
  add(g, G.box, lam(0xb9c2c8, { metal: 0.3 }), [0, y + r + 0.08, -0.3], [3.6, 0.22, 1.8]);
  add(g, G.cyl6, metalMat(), [8.6, y + r + 0.6, 1.1], [0.06, 1.4, 0.06]);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xd7dee3, { extra: { side: THREE.DoubleSide } }));
  dish.position.set(8.6, y + r + 0.55, -1.0); dish.rotation.x = -0.9; dish.castShadow = true; g.add(dish);
  const b = add(g, G.sph, glow(0xff8f86), [8.6, y + r + 1.35, 1.1], 0.1);
  b.userData.beacon = true;
  parent.add(g);
  return g;
}

function domeBuilding(parent, st, r, opts = {}) {
  const g = new THREE.Group();
  g.position.set(st.x, 0, st.z);
  g.rotation.y = st.rot;
  const base = add(g, G.cyl16, hull2Mat(), [0, 0.5, 0], [r, 1.0, r]);
  const dome = add(g, G.dome4, hullMat(), [0, 1.0, 0], [r, r * 0.92, r]);
  if (opts.windows !== false) windowStrip(g, r * 0.94, r * 0.55, 7, opts.winColor || 0xa8e9ff, 0.55);
  // entrance tunnel facing +z (rotated)
  add(g, G.box, hullMat(), [0, 1.0, r * 0.8], [2.2, 2.1, 1.8]);
  add(g, G.box, darkMat(), [0, 1.05, r * 0.8 + 0.93], [1.6, 1.9, 0.14]);
  add(g, G.box, glow(0x79dbe9), [0, 1.2, r * 0.8 + 1.0], [1.1, 1.5, 0.06]);
  add(g, G.box, metalMat(), [0, 2.15, r * 0.8 + 0.95], [1.9, 0.16, 0.22]);
  add(g, G.cyl8, metalMat(), [0, r * 0.95 + 0.7, 0], [0.16, 1.6, 0.16]);
  const beacon = add(g, G.sph, glow(opts.beacon || 0xf1c36d), [0, r * 0.95 + 1.6, 0], 0.17);
  beacon.userData.beacon = true;
  parent.add(g);
  return g;
}

function pod(parent, st, opts = {}) {
  const g = new THREE.Group();
  g.position.set(st.x, 0, st.z);
  g.rotation.y = st.rot;
  const r = opts.r || 2.6, len = opts.len || 6;
  add(g, G.cyl16, hullMat(), [0, r * 0.82, 0], [r, len, r], [opts.tilt || 0, 0, Math.PI / 2]);
  add(g, G.sph, hull2Mat(), [-len / 2, r * 0.82, 0], [r, r, r]);
  add(g, G.sph, hull2Mat(), [len / 2, r * 0.82, 0], [r, r, r]);
  windowStrip(g, r * 0.96, r * 0.95, 5, opts.winColor || 0xa8e9ff, 0.45);
  add(g, G.box, hull2Mat(), [0, 1.1, r * 1.2], [1.8, 2.1, 1.7]);
  add(g, G.box, darkMat(), [0, 1.05, r * 1.2 + 0.85], [1.3, 1.9, 0.12]);
  add(g, G.box, glow(opts.door || 0x79dbe9), [0, 1.15, r * 1.2 + 0.92], [0.9, 1.5, 0.05]);
  // rooftop tanks / vents
  for (let i = -1; i <= 1; i++) add(g, G.cyl8, metalMat(), [i * 1.5, r * 1.62, -0.4], [0.32, 0.55, 0.32]);
  if (opts.tanks) opts.tanks.forEach(t => add(g, G.cyl8, lam(t.c, { metal: 0.3 }), t.p, [0.7, 1.5, 0.7]));
  if (opts.cross) {
    const c = new THREE.Group();
    c.position.set(0, 2.6, r * 0.9);
    add(c, G.box, glow(0xff8f86), [0, 0, 0], [0.9, 0.28, 0.08]);
    add(c, G.box, glow(0xff8f86), [0, 0, 0], [0.28, 0.9, 0.08]);
    g.add(c);
  }
  parent.add(g);
  return g;
}

function greenhouse(parent, st) {
  const g = new THREE.Group();
  g.position.set(st.x, 0, st.z);
  const r = 5.4;
  add(g, G.cyl16, lam(0xc9d3d8, { rough: 0.7 }), [0, 0.42, 0], [r + 0.3, 0.85, r + 0.3]);
  const glass = add(g, G.dome4, glassMat(), [0, 0.84, 0], [r, r, r]);
  glass.castShadow = false;
  // frame ribs
  const rib = new THREE.TorusGeometry(1, 0.035, 4, 20, Math.PI);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(rib, metalMat());
    m.scale.setScalar(r * 0.998); m.position.y = 0.84; m.rotation.y = (i / 8) * Math.PI; m.rotation.x = 0;
    g.add(m);
  }
  for (const y of [0.45, 0.72]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * Math.sqrt(1 - y * y), 0.035, 4, 30, Math.PI * 2), metalMat());
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.84 + y * r; g.add(ring);
  }
  // crop beds inside, arranged in a ring
  const bedMat = lam(0x3a4a3c), cropMat = lam(C.crop, { rough: 0.9 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const bx = Math.sin(a) * 2.6, bz = Math.cos(a) * 2.6;
    add(g, G.box, bedMat, [bx, 1.0, bz], [1.3, 0.35, 3.0], [0, -a, 0]);
    for (let k = 0; k < 4; k++) {
      const p = add(g, G.sph, cropMat, [bx + Math.sin(a) * 0.3 - Math.cos(a) * (k - 1.5) * 0.7 * Math.cos(a), 1.3, bz + Math.cos(a) * 0.3 + Math.sin(a) * (k - 1.5) * 0.7], [0.42, 0.36, 0.42]);
      p.castShadow = false;
    }
  }
  // grow lights
  const lampMat = glow(0xffb4d0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.3), lampMat);
    l.position.set(Math.sin(a) * 2.7, 3.3, Math.cos(a) * 2.7); l.rotation.y = a; g.add(l);
  }
  const pl = new THREE.PointLight(0xffc0d8, 14, 16, 2);
  pl.position.set(0, 3.0, 0); g.add(pl);
  // entrance
  add(g, G.box, hullMat(), [0, 1.0, r * 0.92], [2.4, 2.1, 2.2]);
  add(g, G.box, darkMat(), [0, 1.05, r * 0.92 + 1.1], [1.6, 1.9, 0.12]);
  add(g, G.box, glow(0xa9ecc4), [0, 1.15, r * 0.92 + 1.16], [1.1, 1.5, 0.05]);
  parent.add(g);
  return g;
}

function workshop(parent, st) {
  const g = new THREE.Group();
  g.position.set(st.x, 0, st.z);
  g.rotation.y = st.rot;
  const w = 11, d = 7, h = 3.9;
  add(g, G.box, lam(0x77828c, { rough: 0.85 }), [0, 0.16, 0], [w + 0.7, 0.32, d + 0.7]);
  add(g, G.box, lam(0xd0d7db, { rough: 0.7 }), [0, 0.32 + h / 2, 0], [w, h, d]);
  wallSeams(g, w, h, d, 0.32, lam(0xa7b2ba, { rough: 0.8 }));
  add(g, G.box, lam(0x8d99a3), [0, 0.32 + h + 0.12, 0], [w + 0.9, 0.24, d + 0.9]);
  roofGear(g, w, d, 0.32 + h + 0.24);
  // open bay door: the workshop is where repairs happen
  add(g, G.box, lam(0x5c6975), [0, 1.9, d / 2 + 0.06], [7.4, 3.0, 0.18]);
  add(g, G.box, glow(0xffd9a0), [0, 1.55, d / 2 + 0.14], [6.7, 2.2, 0.06]);
  add(g, G.box, lam(0x8d99a3), [0, 3.5, d / 2 + 0.2], [8.0, 0.22, 0.5]);
  // side window + lamp
  add(g, G.box, glow(0xa9e8ff), [-w / 2 - 0.06, 2.5, 1.1], [0.06, 0.8, 2.2]);
  wallLamps(g, w, d, 3.1);
  signPlate(g, ['WORKSHOP', 'REPAIR · REUSE'], [0, 4.55, d / 2 + 0.46], [3.4, 1.05], 0, '#ffd9a0');
  // crates and a trolley outside
  for (let i = 0; i < 4; i++) add(g, G.box, lam(i % 2 ? 0x87864d : 0x6f7d8c), [-4.6 + i * 1.15, 0.55, d / 2 + 1.3], [0.9, 0.9, 0.9], [0, i * 0.2, 0]);
  add(g, G.cyl8, metalMat(), [4.3, 0.6, d / 2 + 1.2], [0.5, 0.25, 0.5], [Math.PI / 2, 0, 0]);
  // hologram table outside the bay
  const table = new THREE.Group(); table.position.set(3.6, 0, d / 2 + 1.3);
  add(table, G.cyl8, metalMat(), [0, 0.5, 0], [0.9, 0.9, 0.9]);
  add(table, G.cyl8, darkMat(), [0, 1.0, 0], [1.05, 0.12, 1.05]);
  const holo = new THREE.Group(); holo.position.y = 1.5;
  const hmat = new THREE.MeshBasicMaterial({ color: 0x7fe8f2, transparent: true, opacity: 0.6, wireframe: true });
  add(holo, new THREE.IcosahedronGeometry(0.72, 0), hmat, [0, 0, 0]);
  add(holo, new THREE.TorusGeometry(0.95, 0.012, 3, 24), hmat, [0, -0.25, 0], 1, [Math.PI / 2, 0, 0]);
  table.add(holo);
  const light = new THREE.PointLight(0x7fe8f2, 7, 7, 2); light.position.y = 1.6; table.add(light);
  table.userData.holo = holo;
  g.add(table);
  parent.add(g);
  return g;
}

function garage(parent, st) {
  const g = new THREE.Group();
  g.position.set(st.x, 0, st.z);
  g.rotation.y = st.rot;
  const w = 12, d = 8, h = 4.5;
  add(g, G.box, lam(0x77828c, { rough: 0.85 }), [0, 0.16, 0], [w + 0.7, 0.32, d + 0.7]);
  add(g, G.box, lam(0xcbd3d8, { rough: 0.72 }), [0, 0.32 + h / 2, 0], [w, h, d]);
  wallSeams(g, w, d, h, 0.32, lam(0xa2adb5, { rough: 0.8 }));
  add(g, G.box, lam(0x707b85, { rough: 0.8 }), [0, 0.32 + h + 0.12, 0], [w + 0.9, 0.24, d + 0.9]);
  for (const s2 of [-1, 1]) add(g, G.box, lam(0xb08a4a, { rough: 0.7 }), [0, 0.32 + h + 0.27, s2 * (d / 2 + 0.4)], [w + 0.9, 0.1, 0.12]);
  roofGear(g, w, d, 0.32 + h + 0.24);
  // roller door, open: dark inside, bright strip at the bottom
  add(g, G.box, lam(0x59656f), [0, 0.32 + h / 2, d / 2 + 0.05], [9.6, h - 0.8, 0.16]);
  add(g, G.box, lam(0x333d47), [0, 1.55, d / 2 + 0.12], [9.2, 2.5, 0.12]);
  add(g, G.box, glow(0x9fe0ff), [0, 1.2, d / 2 + 0.2], [9.0, 0.9, 0.06]);
  add(g, G.box, lam(0x87939d), [0, 3.72, d / 2 + 0.2], [10.0, 0.3, 0.6]);
  // hazard stripes beside the door
  for (let i = 0; i < 5; i++) add(g, G.box, glow(0xf1c36d), [-4.75 + i * 0.28, 2.4, d / 2 + 0.14], [0.16, 3.0, 0.04]).rotation.z = 0.5;
  for (let i = 0; i < 5; i++) add(g, G.box, glow(0xf1c36d), [4.75 - i * 0.28, 2.4, d / 2 + 0.14], [0.16, 3.0, 0.04]).rotation.z = -0.5;
  signPlate(g, ['ROVER BAY', 'SAT 03 · CHARGING'], [0, 5.1, d / 2 + 0.46], [3.8, 1.15], 0, '#9fe0ff');
  wallLamps(g, w, d, 3.5);
  // charging post
  add(g, G.cyl8, metalMat(), [5.1, 1.9, d / 2 + 1.6], [0.2, 3.8, 0.2]);
  add(g, G.box, glow(0x7cf0a8), [5.1, 3.4, d / 2 + 1.6], [0.44, 0.9, 0.2]);
  add(g, G.box, lam(0x5c6975), [5.1, 0.1, d / 2 + 1.6], [0.9, 0.2, 0.9]);
  parent.add(g);
  return g;
}

function powerStation(parent, st) {
  const g = new THREE.Group();
  g.position.set(st.x, 0, st.z);
  g.rotation.y = st.rot;
  const w = 7.6, d = 5.4, h = 3.0;
  add(g, G.box, lam(0x77828c, { rough: 0.85 }), [0, 0.16, 0], [w + 0.6, 0.32, d + 0.6]);
  add(g, G.box, lam(0xc9d0d5, { rough: 0.7 }), [0, 0.32 + h / 2, 0], [w, h, d]);
  wallSeams(g, w, d, h, 0.32, lam(0x9fabb3, { rough: 0.8 }));
  add(g, G.box, lam(0x6f7a84, { rough: 0.8 }), [0, 0.32 + h + 0.12, 0], [w + 0.7, 0.22, d + 0.7]);
  // door + status board facing the approach
  add(g, G.box, darkMat(), [0, 1.35, d / 2 + 0.06], [1.7, 2.1, 0.14]);
  add(g, G.box, glow(0xffd27f), [0, 1.5, d / 2 + 0.14], [1.3, 0.55, 0.05]);
  add(g, G.box, glow(0x9fe6ff), [1.65, 2.1, d / 2 + 0.1], [1.0, 1.0, 0.05]);
  // hazard band
  add(g, G.box, lam(0xf1c36d, { rough: 0.7 }), [0, 0.62, d / 2 + 0.06], [w, 0.18, 0.03]);
  wallLamps(g, w, d, 2.7);
  signPlate(g, ['POWER', '84 kW · SOLAR FIELD'], [0, 3.85, d / 2 + 0.4], [2.8, 0.85], 0, '#ffd27f');
  // cooling radiators mounted on the shaded wall, with visible pipes
  const radMat = lam(0x2b333d, { rough: 0.95 });
  for (let i = -1; i <= 1; i++) {
    const x = i * 2.4;
    const rad = add(g, G.box, radMat, [x, 2.2, -d / 2 - 0.55], [1.9, 2.1, 0.1], [0.18, 0, 0]);
    rad.castShadow = true;
    // fins
    for (let k = 0; k < 5; k++) add(g, G.box, lam(0x39434f, { rough: 0.9 }), [x, 1.35 + k * 0.36, -d / 2 - 0.62], [1.86, 0.05, 0.06], [0.18, 0, 0]);
    // support arms back into the wall
    for (const s2 of [-0.6, 0.6]) add(g, G.box, metalMat(), [x + s2, 1.9, -d / 2 - 0.25], [0.08, 0.08, 0.6], [0.2, 0, 0]);
  }
  add(g, G.cyl8, metalMat(), [0, 3.4, -d / 2 - 0.3], [0.12, w * 0.72, 0.12]).rotation.z = Math.PI / 2;
  // transformer box and a beacon mast
  add(g, G.box, lam(0x6c7883), [w * 0.42, 0.85, -1.2], [1.1, 1.1, 1.6]);
  add(g, G.box, glow(0xf1c36d), [w * 0.42, 1.45, -1.2], [0.4, 0.08, 0.6]);
  add(g, G.cyl6, metalMat(), [-w * 0.42, 3.1, 0.4], [0.06, 2.6, 0.06]);
  const beacon = add(g, G.sph, glow(0xff8f86), [-w * 0.42, 4.5, 0.4], 0.14); beacon.userData.beacon = true;
  parent.add(g);

  // Solar field: rows of tilted panels on posts, all facing the low polar Sun.
  const panelMat = lam(0x1e3768, { rough: 0.28, metal: 0.55 });
  const panelTop = new THREE.MeshStandardMaterial({ color: 0x2d4f9a, roughness: 0.16, metalness: 0.72 });
  const field = new THREE.Group();
  field.position.set(st.x, 0, st.z);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 4 + col * 3.4, z = 2 + row * 3.6;
      const rig = new THREE.Group();
      rig.position.set(x, 0, z);
      rig.rotation.y = 0.32;
      add(rig, G.cyl8, metalMat(), [0, 0.55, 0], [0.09, 1.1, 0.09]);
      add(rig, G.box, metalMat(), [0, 1.12, 0], [2.9, 0.07, 1.8], [-0.52, 0, 0]);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.76, 1.66), panelTop);
      face.position.set(0, 1.17, 0.02);
      face.rotation.x = -Math.PI / 2 - 0.52;
      rig.add(face);
      for (let k = -1; k <= 1; k++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 1.62), metalMat());
        line.position.set(k * 0.9, 1.2, 0.03); line.rotation.x = -0.52; rig.add(line);
      }
      add(rig, G.box, lam(0x3d4854), [0, 1.12, 0.92], [2.9, 0.06, 0.1], [-0.52, 0, 0]);
      field.add(rig);
    }
  }
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 14), lam(0x2c333b));
  cable.position.set(2.0, 0.06, 5); field.add(cable);
  parent.add(field);
  return g;
}

function relayMast(parent, st) {
  const g = new THREE.Group();
  const y0 = heightAt(st.x, st.z);
  g.position.set(st.x, y0, st.z);
  // lattice tower
  const tower = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = add(tower, G.box, metalMat(), [Math.sin(a) * 1.1, 3.6, Math.cos(a) * 1.1], [0.14, 7.2, 0.14]);
    leg.rotation.set(Math.cos(a) * 0.07, 0, -Math.sin(a) * 0.07);
  }
  for (let h = 0.8; h < 7.2; h += 1.05) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.035, 4, 4), metalMat());
    ring.rotation.x = Math.PI / 2; ring.position.y = h; tower.add(ring);
  }
  // big dish
  const dish = new THREE.Group(); dish.position.set(0, 7.4, 0); dish.rotation.set(-0.75, 0.6, 0);
  const d = new THREE.Mesh(new THREE.SphereGeometry(1.9, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), lam(0xe7ecef, { rough: 0.5, extra: { side: THREE.DoubleSide } }));
  d.position.y = 0.3; dish.add(d);
  add(dish, G.cyl8, metalMat(), [0, 0.45, 0], [0.07, 1.3, 0.07]);
  add(dish, G.sph, glow(0x9ff0ff), [0, 1.1, 0], 0.11);
  tower.add(dish);
  const beacon = add(tower, G.sph, glow(0xff8f86), [0, 7.5, 0], 0.18); beacon.userData.beacon = true;
  g.add(tower);
  // small equipment hut
  add(g, G.box, hullMat(), [2.6, 0.9, 1.2], [2.4, 1.8, 2.0]);
  add(g, G.box, darkMat(), [2.6, 0.9, 2.25], [1.2, 1.6, 0.1]);
  // cables
  const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(1.6, 0.05, 0.9), new THREE.Vector3(2.6, 0.05, 1.4)]);
  add(g, new THREE.TubeGeometry(cable, 12, 0.06, 5, false), darkMat(), [0, 0, 0]);
  g.userData.dish = dish; g.userData.beaconMesh = beacon;
  parent.add(g);
  return g;
}

function landingPad(parent, st) {
  const g = new THREE.Group();
  g.position.set(st.x, 0.03, st.z);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(7.4, 40), lam(0x6d777f, { rough: 0.95 }));
  disc.rotation.x = -Math.PI / 2; disc.receiveShadow = true; g.add(disc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(6.6, 7.1, 44), lam(0xc7d0d6, { rough: 0.9 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; g.add(ring);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 0.34), lam(0xdfe6ea));
    bar.position.set(Math.sin(a) * 5.1, 0.014, Math.cos(a) * 5.1); bar.rotation.y = a; g.add(bar);
  }
  const hex = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.4, 6), lam(0xf1c36d, { rough: 0.7 }));
  hex.rotation.x = -Math.PI / 2; hex.position.y = 0.015; g.add(hex);
  // beacon masts around the pad
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const bx = Math.sin(a) * 7.9, bz = Math.cos(a) * 7.9;
    add(g, G.cyl8, metalMat(), [bx, 1.0, bz], [0.09, 2.0, 0.09]);
    const b = add(g, G.sph, glow(0x8fe6ff), [bx, 2.1, bz], 0.14); b.userData.beacon = true;
  }
  // cargo containers + blast-scoured ground marks
  for (let i = 0; i < 3; i++) add(g, G.box, lam([0x8a7a4e, 0x5d7484, 0x9b6a52][i]), [-9.4 + i * 2.0, 0.8, -2.5], [1.8, 1.6, 2.4], [0, i * 0.25, 0]);
  parent.add(g);
  return g;
}

function airlockModule(parent, st) {
  const g = new THREE.Group();
  g.position.set(st.x, 0, st.z);
  add(g, G.cyl16, hull2Mat(), [0, 1.2, 0], [1.9, 2.6, 1.9]);
  add(g, G.dome4, hullMat(), [0, 2.5, 0], [1.9, 1.3, 1.9]);
  add(g, G.box, darkMat(), [0, 1.15, 1.75], [1.5, 2.0, 0.14]);
  add(g, G.box, glow(0x8fe6ff), [0, 1.25, 1.83], [1.05, 1.5, 0.05]);
  add(g, G.cyl8, metalMat(), [1.5, 2.4, 1.0], [0.18, 0.9, 0.18]);
  // suit locker rack outside, plus a boot brush station
  add(g, G.box, lam(0x6c7a86), [-2.6, 0.85, 1.4], [1.3, 1.7, 1.0]);
  add(g, G.cyl8, metalMat(), [-2.6, 1.9, 1.4], [0.45, 0.35, 0.45]);
  parent.add(g);
  return g;
}

function label(_x, _g, _st) { /* labels are drawn by the DOM overlay in main.js */ }

// ---------------------------------------------------------------------------------------------
// The four-legged cargo robot Rafiq and a small scout drone.
// ---------------------------------------------------------------------------------------------
function makeRobot(color = 0xd8b25a) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  add(body, G.box, lam(color, { rough: 0.6, metal: 0.2 }), [0, 0.75, 0], [1.5, 0.55, 0.9]);
  add(body, G.box, darkMat(), [0, 0.86, 0], [1.0, 0.28, 0.92]);
  // solar back
  add(body, G.box, lam(0x2b3f7a, { metal: 0.6, rough: 0.3 }), [-0.1, 1.06, 0], [1.3, 0.05, 0.8]);
  // head with sensor bar
  const head = new THREE.Group(); head.position.set(0.86, 0.82, 0);
  add(head, G.box, lam(0xe6c06a), [0, 0, 0], [0.42, 0.4, 0.66]);
  add(head, G.box, glow(0x8fe6ff), [0.24, 0.04, 0], [0.06, 0.12, 0.5]);
  body.add(head);
  // cargo basket
  add(body, G.box, lam(0x8a7a4e), [-0.85, 0.95, 0], [0.55, 0.42, 1.0]);
  g.add(body);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const sx = i < 2 ? 0.6 : -0.6, sz = i % 2 === 0 ? 0.62 : -0.62;
    const hip = new THREE.Group(); hip.position.set(sx, 0.78, sz);
    add(hip, G.box, darkMat(), [0, -0.22, 0], [0.14, 0.5, 0.14]);
    const knee = new THREE.Group(); knee.position.set(0, -0.44, 0);
    add(knee, G.box, metalMat(), [0, -0.24, 0], [0.1, 0.5, 0.1]);
    add(knee, G.sph, darkMat(), [0, -0.5, 0], 0.09);
    hip.add(knee);
    g.add(hip);
    legs.push({ hip, knee, phase: (i / 4) * Math.PI * 2, sz });
  }
  g.userData.legs = legs;
  g.userData.head = head;
  return g;
}

// ---------------------------------------------------------------------------------------------
// The rover the player can drive.
// ---------------------------------------------------------------------------------------------
export function makeRover() {
  const g = new THREE.Group();
  add(g, G.box, lam(0xe4e8ea, { rough: 0.55, metal: 0.2 }), [0, 1.05, 0], [4.6, 0.9, 2.5]);
  add(g, G.box, lam(0xc56b3e, { rough: 0.6 }), [0, 1.55, 0], [2.2, 0.15, 1.9]);
  // cabin with big windows
  const cab = new THREE.Group(); cab.position.set(1.05, 1.5, 0);
  add(cab, G.box, lam(0xd9dee1), [0, 0.35, 0], [1.9, 1.0, 2.1]);
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ea, transparent: true, opacity: 0.55, roughness: 0.08, metalness: 0.3 });
  add(cab, G.box, glass, [0.02, 0.45, 1.06], [1.6, 0.62, 0.06]);
  add(cab, G.box, glass, [0.02, 0.45, -1.06], [1.6, 0.62, 0.06]);
  add(cab, G.box, glass, [0.96, 0.45, 0], [0.06, 0.62, 1.7]);
  add(cab, G.box, glow(0xffe6b0), [0.98, 0.2, 0], [0.05, 0.16, 1.2]);
  g.add(cab);
  // solar wing
  add(g, G.box, lam(0x22335e, { metal: 0.7, rough: 0.25 }), [0, 1.62, 0], [4.2, 0.05, 2.3]);
  add(g, G.box, lam(0x2d4478, { metal: 0.7, rough: 0.2 }), [-2.9, 1.62, 0], [1.4, 0.04, 1.6]);
  // sample rack at the back
  add(g, G.box, lam(0x7d6a3d), [-2.0, 1.35, 0], [0.9, 0.5, 1.6]);
  // six wheels
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.42, 14);
  const wheelMat = lam(0x2f343a, { rough: 1 });
  for (const x of [1.55, 0, -1.55]) for (const z of [1.3, -1.3]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.62, z);
    w.castShadow = true; g.add(w); wheels.push(w);
    add(g, G.box, metalMat(), [x, 0.95, z * 0.82], [0.22, 0.5, 0.22]);
  }
  g.userData.wheels = wheels;
  add(g, G.cyl8, metalMat(), [-1.7, 1.85, 0.7], [0.06, 1.4, 0.06]);
  add(g, G.sph, glow(0xffca7a), [-1.7, 2.55, 0.7], 0.09);
  return g;
}

// ---------------------------------------------------------------------------------------------
// Sky: gradient dome, stars, Earth, sun glare.
// ---------------------------------------------------------------------------------------------
function sky(scene) {
  const geo = new THREE.SphereGeometry(400, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {},
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; void main(){
      float h = normalize(vP).y * 0.5 + 0.5;
      vec3 low = vec3(0.055,0.085,0.14);
      vec3 high = vec3(0.005,0.008,0.02);
      vec3 c = mix(low, high, smoothstep(0.35, 0.95, h));
      c += vec3(0.05,0.03,0.02) * pow(clamp(1.0-h,0.0,1.0), 4.0);
      gl_FragColor = vec4(c, 1.0); }`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  // stars
  const n = 2600, pos = new Float32Array(n * 3), sizes = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1);
    const r = 360;
    pos[i * 3] = Math.sin(v) * Math.cos(u) * r;
    pos[i * 3 + 1] = Math.cos(v) * r;
    pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * r;
    sizes[i] = 0.4 + rand() * 1.4;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const sm = new THREE.PointsMaterial({ color: 0xdfeaff, size: 1.9, sizeAttenuation: true, transparent: true, opacity: 0.9 });
  scene.add(new THREE.Points(sg, sm));
  // Earth: fixed in the sky above the outpost. Blue oceans, white cloud swirls, green-brown land.
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1e5fa8'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 260; i++) {
    x.fillStyle = `rgba(${30 + rand() * 50|0},${90 + rand() * 60|0},${50 + rand() * 40|0},${0.25 + rand() * 0.5})`;
    const cx = rand() * 512, cy = 40 + rand() * 176, r = 6 + rand() * 34;
    x.beginPath(); x.ellipse(cx, cy, r, r * (0.4 + rand() * 0.8), rand() * 3, 0, 7); x.fill();
  }
  for (let i = 0; i < 220; i++) {
    x.fillStyle = `rgba(255,255,255,${0.1 + rand() * 0.35})`;
    const cx = rand() * 512, cy = rand() * 256, r = 8 + rand() * 40;
    x.beginPath(); x.ellipse(cx, cy, r, r * 0.35, rand() * 3, 0, 7); x.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(21, 32, 24), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0, emissive: 0x14304f, emissiveMap: tex, emissiveIntensity: 0.55 }));
  earth.position.set(-120, 190, -300);
  earth.rotation.z = 0.4;
  scene.add(earth);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(22.6, 24, 18), new THREE.MeshBasicMaterial({ color: 0x6fb4ff, transparent: true, opacity: 0.13, side: THREE.BackSide }));
  halo.position.copy(earth.position); scene.add(halo);
  return earth;
}

// ---------------------------------------------------------------------------------------------
// Build everything
// ---------------------------------------------------------------------------------------------
function terrainMesh(scene) {
  const SIZE = 280, N = 200;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(0xa5a29b), dark = new THREE.Color(0x6d6a65), light = new THREE.Color(0xc8c4ba);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const c = base.clone();
    const n = 0.5 + 0.5 * Math.sin(x * 0.71 + z * 1.13) * Math.cos(z * 0.53 - x * 0.31);
    c.lerp(light, n * 0.32).lerp(dark, clamp(-h * 0.3, 0, 0.6));
    if (Math.hypot(x, z) < 60) c.lerp(new THREE.Color(0xb2aea6), 0.22);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0.02, flatShading: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function rubble(scene) {
  const count = 900;
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9d9a93, roughness: 0.95, flatShading: true });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let placed = 0, guard = 0;
  while (placed < count && guard++ < 6000) {
    const a = rand() * Math.PI * 2, r = 12 + Math.pow(rand(), 0.6) * 105;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x > -16.5 && x < 12.5 && z > -23 && z < -9) continue;
    if (STATIONS.some(st => Math.hypot(x - st.x, z - st.z) < (st.radius || 4) + 4.6)) continue;
    if (Math.hypot(x - ROVER.park[0], z - ROVER.park[1]) < 7) continue;
    if (SAMPLE_SITES.some(sd => Math.hypot(x - sd.x, z - sd.z) < 2.2)) continue;
    const sc = 0.12 + Math.pow(rand(), 3) * 1.5;
    p.set(x, heightAt(x, z) + sc * 0.28, z);
    e.set(rand() * 3, rand() * 3, rand() * 3); q.setFromEuler(e);
    s.set(sc, sc * (0.55 + rand() * 0.5), sc);
    m.compose(p, q, s);
    inst.setMatrixAt(placed++, m);
  }
  inst.count = placed;
  inst.castShadow = true; inst.receiveShadow = true;
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
  return inst;
}

function paths(scene) {
  // Faint wheel tracks connecting the outpost buildings: pure decoration, drawn as flat ribbons.
  const segs = [
    [[0, 0], [9, 2], [12, 4.3]], [[0, 0], [-9, 2], [-13.6, -1.5]], [[0, 0], [0, 9], [-3, 12.9]],
    [[0, 0], [0, 9], [6, 12.9]], [[9, 2], [22, -4], [28.2, -10.4]], [[0, 0], [0, -8], [-3, -11.6]],
    [[0, -8], [7.4, -10.9]], [[0, -8], [-9.2, -7.6]], [[0, -8], [9.4, -7.6]], [[-9, 2], [-12.1, 9.6]],
    [[-9, 2], [-24, 3], [-39, 17]], [[-24, 3], [-27.4, -11]],
  ];
  const mat = new THREE.MeshBasicMaterial({ color: 0x86837c, transparent: true, opacity: 0.28, depthWrite: false });
  for (const pts of segs) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const g = new THREE.PlaneGeometry(len, 0.42); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.set((x1 + x2) / 2, heightAt((x1 + x2) / 2, (z1 + z2) / 2) + 0.03, (z1 + z2) / 2);
      m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      scene.add(m);
    }
  }
}

function doorMarkers(scene) {
  const accent = { habitat: 0x9fe6ff, airlock: 0x9fe6ff, dome: 0x7fe3ee, pod: 0x9fe6ff, greenhouse: 0x85e0b0, shed: 0xf1c36d, garage: 0x8fc0e8, power: 0xf1c36d, mast: 0x69d4e7, pad: 0x69d4e7 };
  for (const st of STATIONS) {
    if (st.kind === 'pad') continue;
    const [dx, dz] = st.door;
    const y = heightAt(dx, dz);
    const g = new THREE.Group();
    g.position.set(dx, y, dz);
    g.rotation.y = Math.atan2(st.x - dx, st.z - dz);
    const hex = accent[st.kind] || 0x9fe6ff;
    const bar = new THREE.MeshStandardMaterial({ color: 0x25333f, emissive: hex, emissiveIntensity: 0.5, roughness: 0.5 });
    for (const sx of [-1.2, 1.2]) add(g, G.cyl8, metalMat(), [sx, 0.85, 0], [0.05, 1.7, 0.05]);
    add(g, G.box, bar, [0, 1.72, 0], [2.5, 0.09, 0.07]);
    add(g, G.box, bar, [0, 1.62, 0], [0.06, 0.14, 0.06]);
    // a soft floor strip so the doorway reads even at a distance
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.16, depthWrite: false }));
    strip.rotation.x = -Math.PI / 2; strip.position.y = 0.03; g.add(strip);
    scene.add(g);
  }
}

function props(scene) {
  // A flag at the hub, a tool cart, hoses and crates: small things that make it a place.
  const flag = new THREE.Group();
  flag.position.set(2.5, heightAt(2.5, -2), -2);
  add(flag, G.cyl8, metalMat(), [0, 1.6, 0], [0.05, 3.2, 0.05]);
  add(flag, G.box, lam(0xd9e2e7), [0.5, 2.95, 0], [0.95, 0.6, 0.03]);
  add(flag, G.box, lam(0x69d4e7), [0.5, 2.95, 0.02], [0.3, 0.6, 0.02]);
  add(flag, G.sph, glow(0xf1c36d), [0, 3.25, 0], 0.07);
  scene.add(flag);

  const cart = new THREE.Group();
  cart.position.set(-7.6, heightAt(-7.6, 12.2), 12.2);
  add(cart, G.box, lam(0x8d99a3, { metal: 0.4 }), [0, 0.75, 0], [1.6, 0.9, 0.9]);
  add(cart, G.box, darkMat(), [0, 1.25, 0.2], [1.1, 0.1, 0.5]);
  for (const sx of [-0.55, 0.55]) for (const sz of [-0.32, 0.32]) {
    const w = add(cart, G.cyl8, lam(0x2f343a), [sx, 0.22, sz], [0.2, 0.1, 0.2]);
    w.rotation.z = Math.PI / 2;
  }
  add(cart, G.box, glow(0xffd9a0), [-0.6, 1.0, 0.46], [0.2, 0.2, 0.04]);
  scene.add(cart);

  // hose bundle from life support towards the habitat
  const hose = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-13.4, 0.2, 8.2), new THREE.Vector3(-11, 0.12, 5.5),
    new THREE.Vector3(-8, 0.12, 2.4), new THREE.Vector3(-6.5, 0.15, -1.2),
  ]);
  add(scene, new THREE.TubeGeometry(hose, 24, 0.09, 6, false), lam(0x3f4a55), [0, 0, 0]);

  // crates and a spare tank by the airlock
  add(scene, G.box, lam(0x8a7a4e), [3.2, 0.5, -9.6], [1.0, 1.0, 1.0], [0, 0.3, 0]);
  add(scene, G.box, lam(0x6f7d8c), [2.0, 0.42, -9.2], [0.8, 0.8, 0.8], [0, -0.2, 0]);
  const tank = add(scene, G.cyl8, lam(0x8fb6d6, { metal: 0.4 }), [4.6, 0.75, -6.6], [0.42, 1.5, 0.42]);
  tank.rotation.z = 0.18;

  // a small dish aimed at Earth near the control dome
  const dish = new THREE.Group();
  dish.position.set(-7.4, heightAt(-7.4, -3.6), -3.6);
  add(dish, G.cyl8, metalMat(), [0, 0.6, 0], [0.09, 1.2, 0.09]);
  const d = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xe2e8ec, { extra: { side: THREE.DoubleSide } }));
  d.position.y = 1.35; d.rotation.set(-1.1, 0.6, 0); d.castShadow = true; dish.add(d);
  scene.add(dish);
}

export function buildWorld(scene) {
  scene.fog = new THREE.FogExp2(0x0d1930, 0.0026);
  sky(scene);
  // Lights: a low warm sun for long shadows, cool sky bounce, and a soft fill from the camera side.
  const sun = new THREE.DirectionalLight(0xfff4e4, 3.4);
  sun.position.set(-92, 46, 74);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.05;
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xb9cfee, 0x6b665c, 1.35));
  scene.add(new THREE.AmbientLight(0x35435c, 0.62));
  const fill = new THREE.DirectionalLight(0xb4ccff, 0.55); fill.position.set(60, 30, -80); scene.add(fill, fill.target);
  // sun glare
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffe6bd, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  flare.scale.setScalar(26); flare.position.copy(sun.position).normalize().multiplyScalar(330); scene.add(flare);

  const terrain = terrainMesh(scene);
  rubble(scene);
  paths(scene);
  doorMarkers(scene);
  props(scene);

  const buildings = {};
  const beacons = [];
  for (const st of STATIONS) {
    let g = null;
    if (st.kind === 'habitat') g = habitat(scene, st);
    else if (st.kind === 'airlock') g = airlockModule(scene, st);
    else if (st.kind === 'dome') g = domeBuilding(scene, st, st.id === 'control' ? 4.2 : 3.9, { beacon: st.id === 'control' ? 0x69d4e7 : 0x85e0b0 });
    else if (st.kind === 'pod') g = pod(scene, st, st.id === 'medical' ? { cross: true, len: 6.2, r: 2.5, tanks: [{ c: 0xd36a63, p: [2.2, 1.7, 0] }] } : { len: 7, r: 2.7, tanks: [{ c: 0x6f9fd0, p: [2.4, 1.8, 0] }, { c: 0x8fd0b0, p: [-2.4, 1.8, 0] }] });
    else if (st.kind === 'greenhouse') g = greenhouse(scene, st);
    else if (st.kind === 'shed') g = workshop(scene, st);
    else if (st.kind === 'garage') g = garage(scene, st);
    else if (st.kind === 'power') g = powerStation(scene, st);
    else if (st.kind === 'mast') g = relayMast(scene, st);
    else if (st.kind === 'pad') g = landingPad(scene, st);
    if (g) {
      buildings[st.id] = g;
      g.traverse(o => { if (o.material && o.material.isMeshBasicMaterial) { o.castShadow = false; } });
    }
  }
  scene.traverse(o => { if (o.userData.beacon && o.material && !Array.isArray(o.material)) beacons.push(o); });

  // Cargo robot Rafiq, wandering slowly between the garage and the greenhouse (scripted, never in the way).
  const rafiq = makeRobot(0xe0b45c);
  rafiq.position.set(11, 0, 12);
  scene.add(rafiq);
  const drone = makeDrone();
  drone.position.set(4, 8, 6);
  scene.add(drone);

  // The rover, parked by the garage.
  const rover = makeRover();
  const [rx, rz] = ROVER.park;
  rover.position.set(rx, heightAt(rx, rz), rz);
  rover.rotation.y = ROVER.heading;
  scene.add(rover);

  // Sample site markers: small beacons so sites are findable but not glowing billboards.
  const sites = [];
  for (const sd of SAMPLE_SITES) {
    const g = new THREE.Group();
    const y = heightAt(sd.x, sd.z);
    g.position.set(sd.x, y, sd.z);
    add(g, G.cyl8, metalMat(), [0, 0.6, 0], [0.05, 1.2, 0.05]);
    const flag = add(g, G.box, glow(0x86e6c0), [0.25, 1.15, 0], [0.5, 0.32, 0.03]);
    flag.userData.flag = true;
    for (let i = 0; i < 3; i++) {
      const rock = add(g, new THREE.IcosahedronGeometry(0.3 + rand() * 0.35, 0), lam(i === 0 ? 0x4a4741 : 0x8f8b83), [Math.sin(i * 2.1) * 1.1, 0.15, Math.cos(i * 2.1) * 1.1]);
      rock.rotation.set(rand(), rand(), rand());
    }
    scene.add(g);
    sites.push(g);
  }

  const state = { t: 0 };
  function update(dt, _t) {
    state.t += dt;
    const t = state.t;
    // beacons blink gently
    for (let i = 0; i < beacons.length; i++) {
      const b = beacons[i];
      const on = Math.sin(t * 1.6 + i) > 0.2;
      b.material.color.setHex(on ? (b.userData.baseColor || (b.userData.baseColor = b.material.color.getHex())) : 0x2a3138);
    }
    // relay dish turns slowly
    if (buildings.relay?.userData.dish) buildings.relay.userData.dish.rotation.y = Math.sin(t * 0.12) * 0.35 + 0.6;
    // hologram spinner
    buildings.workshop?.traverse(o => { if (o.userData.holo) { o.userData.holo.rotation.y = t * 0.5; o.userData.holo.rotation.x = Math.sin(t * 0.3) * 0.2; } });
    // Rafiq patrols a short loop, legs stepping
    const loopX = 11 + Math.sin(t * 0.12) * 5.2, loopZ = 12.5 + Math.cos(t * 0.12) * 3.4;
    const dx = loopX - rafiq.position.x, dz = loopZ - rafiq.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.02) {
      rafiq.position.x += dx * Math.min(1, dt * 1.2);
      rafiq.position.z += dz * Math.min(1, dt * 1.2);
      rafiq.rotation.y = Math.atan2(dx, dz);
    }
    rafiq.position.y = heightAt(rafiq.position.x, rafiq.position.z) + Math.abs(Math.sin(t * 2)) * 0.015;
    for (const L of rafiq.userData.legs) {
      L.hip.rotation.x = Math.sin(t * 3.2 + L.phase) * 0.5;
      L.knee.rotation.x = Math.max(0, Math.cos(t * 3.2 + L.phase)) * 0.7;
    }
    rafiq.userData.head.rotation.y = Math.sin(t * 0.7) * 0.4;
    // drone circles the outpost
    drone.position.set(Math.cos(t * 0.16) * 22, 9 + Math.sin(t * 0.5) * 0.8, Math.sin(t * 0.16) * 22);
    drone.rotation.y = -t * 0.16;
    drone.userData.rotors.forEach(r => { r.rotation.y = t * 40; });
    // sample flags sway (in a vacuum they would not, but they are lit beacons, not cloth)
    for (const s of sites) s.children.forEach(c => { if (c.userData.flag) c.material.color.setHex(Math.sin(t * 2.2) > -0.4 ? 0x86e6c0 : 0x2f6b58); });
  }

  return {
    scene, terrain, buildings, rover, rafiq, drone, sites, sun, fill,
    update,
    stationPoint: id => {
      const st = STATIONS.find(s => s.id === id);
      return new THREE.Vector3(st.door[0], heightAt(st.door[0], st.door[1]), st.door[1]);
    },
    labelPoint: id => {
      const st = STATIONS.find(s => s.id === id);
      const h = st.kind === 'habitat' ? 6.2 : st.kind === 'greenhouse' ? 7.4 : st.kind === 'mast' ? 11.5 : st.kind === 'power' ? 5.4 : 5.2;
      return new THREE.Vector3(st.x, heightAt(st.x, st.z) + h, st.z);
    },
  };
}

function makeDrone() {
  const g = new THREE.Group();
  add(g, G.box, lam(0xdfe4e8, { metal: 0.3 }), [0, 0, 0], [0.5, 0.14, 0.5]);
  add(g, G.sph, glow(0x8fe6ff), [0, -0.1, 0.2], 0.07);
  const rotors = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const arm = add(g, G.box, metalMat(), [Math.sin(a) * 0.42, 0, Math.cos(a) * 0.42], [0.06, 0.04, 0.42]);
    arm.rotation.y = a;
    const r = add(g, G.box, lam(0x2f343a, { rough: 0.5 }), [Math.sin(a) * 0.62, 0.06, Math.cos(a) * 0.62], [0.62, 0.015, 0.06]);
    rotors.push(r);
  }
  g.userData.rotors = rotors;
  return g;
}

export { NAV_NODES };
