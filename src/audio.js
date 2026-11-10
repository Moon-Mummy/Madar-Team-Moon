// Tiny synthesised sound effects. No audio files, no network, and everything is off by one toggle.
let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSound(on) {
  enabled = !!on;
  if (!on && ctx) { try { ctx.suspend(); } catch (e) { /* ignore */ } }
}

export function soundOn() { return enabled; }

function tone(freq, dur, type = 'sine', gain = 0.05, delay = 0, glide = 0) {
  if (!enabled) return;
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + glide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

export function sfx(name) {
  if (!enabled) return;
  switch (name) {
    case 'tap': tone(520, 0.06, 'triangle', 0.03); break;
    case 'open': tone(330, 0.1, 'sine', 0.035); tone(495, 0.12, 'sine', 0.03, 0.06); break;
    case 'close': tone(300, 0.1, 'sine', 0.03); tone(220, 0.1, 'sine', 0.025, 0.05); break;
    case 'good': tone(523, 0.12, 'triangle', 0.04); tone(659, 0.12, 'triangle', 0.035, 0.09); break;
    case 'soft': tone(300, 0.16, 'sine', 0.035, 0, -60); break;
    case 'chime': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'sine', 0.032, i * 0.1)); break;
    case 'foot': tone(120 + Math.random() * 20, 0.05, 'sine', 0.012); break;
    case 'rover': tone(70, 0.25, 'sawtooth', 0.012, 0, 10); break;
    case 'hop': tone(240, 0.12, 'sine', 0.03, 0, 140); break;
    default: tone(440, 0.08, 'sine', 0.03);
  }
}

export function resumeAudio() { ac(); }
