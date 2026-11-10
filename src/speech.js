// Character voices. The crew speak out loud instead of printing paragraphs: each NPC has a
// stable voice profile (pitch, rate, preferred system voice) so they sound like different people
// even on a device with a single installed voice. Text on screen becomes a short subtitle.

const PERSONA = {
  maya: { pitch: 1.0, rate: 1.02, prefer: ['female', 'samantha', 'aria', 'zira', 'google uk english female'] },
  omar: { pitch: 0.72, rate: 0.94, prefer: ['male', 'daniel', 'david', 'google uk english male', 'guy'] },
  amina: { pitch: 1.28, rate: 1.06, prefer: ['female', 'karen', 'victoria', 'google us english'] },
  leo: { pitch: 0.6, rate: 1.08, prefer: ['male', 'alex', 'fred', 'google uk english male'] },
  sofia: { pitch: 1.34, rate: 0.98, prefer: ['female', 'moira', 'tessa', 'google uk english female'] },
  narrator: { pitch: 0.95, rate: 0.97, prefer: [] },
};

const listeners = new Set();
let voices = [];
let ready = false;
let current = null;
let enabled = true;

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';

function loadVoices() {
  if (!canSpeak()) return;
  try {
    voices = window.speechSynthesis.getVoices() || [];
    if (voices.length) ready = true;
  } catch (e) { /* ignore */ }
}

if (typeof window !== 'undefined' && canSpeak()) {
  loadVoices();
  try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { /* older browsers */ }
  // Some engines only populate the list after the first call.
  setTimeout(loadVoices, 400);
  setTimeout(loadVoices, 1800);
}

export const speechAvailable = () => canSpeak();
export const speechReady = () => ready;
export const setSpeechEnabled = on => { enabled = !!on; if (!enabled) stopSpeaking(); };
export const speechEnabled = () => enabled;

export function onSpeech(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = (speaking, who, text) => { for (const fn of listeners) { try { fn({ speaking, who, text }); } catch (e) { /* ignore */ } } };

const langBase = l => String(l || 'en').slice(0, 2).toLowerCase();

function pickVoice(lang, prefer = []) {
  if (!voices.length) loadVoices();
  const want = langBase(lang);
  const same = voices.filter(v => langBase(v.lang) === want);
  const pool = same.length ? same : voices;
  if (!pool.length) return null;
  for (const key of prefer) {
    const hit = pool.find(v => String(v.name).toLowerCase().includes(key));
    if (hit) return hit;
  }
  // Prefer local voices: they usually sound better and speak offline.
  const local = pool.filter(v => v.localService);
  return (local[0] || pool[0]) || null;
}

/** Speak a line as a character. Returns false when the device has no speech engine. */
export function say(who, text, { lang = 'en', interrupt = true, volume = 1 } = {}) {
  if (!enabled || !canSpeak() || !text) return false;
  const clean = String(text).replace(/[•●—–]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return false;
  const profile = PERSONA[who] || PERSONA.narrator;
  try {
    if (interrupt) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const voice = pickVoice(lang, profile.prefer);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = langBase(lang) === 'ar' ? 'ar-SA' : 'en-US'; }
    u.pitch = profile.pitch;
    u.rate = profile.rate;
    u.volume = Math.max(0, Math.min(1, volume));
    u.onstart = () => { current = who; emit(true, who, clean); };
    u.onend = () => { current = null; emit(false, who, clean); };
    u.onerror = () => { current = null; emit(false, who, clean); };
    window.speechSynthesis.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}

/** Speak anything that is not a character (the narrator for a task's explanation). */
export const narrate = (text, opts = {}) => say('narrator', text, opts);

export function stopSpeaking() {
  if (!canSpeak()) return;
  try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  current = null;
}

export const speakingWho = () => current;
export const PERSONAS = PERSONA;
