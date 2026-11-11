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
const clips = new Map();          // key -> { file, text }, from assets/voice/pack.json
let clipsReady = false;
let currentAudio = null;
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

// A recorded pack ships with the game: browser speech engines are missing on plenty of systems
// (Linux without speech-dispatcher reports zero voices), so the crew's key lines are real audio
// files that always play. Anything without a recording still goes through the engine when there is
// one, and the subtitle carries the words when there is not.
const VOICE_BASE = new URL('../assets/voice/', import.meta.url);

export async function loadVoicePack() {
  try {
    const res = await fetch(new URL('pack.json', VOICE_BASE));
    if (!res.ok) return 0;
    const data = await res.json();
    for (const [key, val] of Object.entries(data)) clips.set(key, val);
    clipsReady = true;
    return clips.size;
  } catch (e) { return 0; }
}
loadVoicePack();

export const voicePackSize = () => clips.size;
export const hasClip = key => clips.has(key);
export const speechStatus = () => ({ tts: canSpeak(), voices: voices.length, clips: clips.size });

function stopClip() {
  if (!currentAudio) return;
  try { currentAudio.pause(); currentAudio.currentTime = 0; } catch (e) { /* ignore */ }
  currentAudio = null;
}

/** Play a recorded line. Returns false if the key has no recording or playback is blocked. */
export function playClip(key, who = 'narrator', text = '') {
  const rec = clips.get(key);
  if (!rec) return false;
  try {
    stopClip();
    const a = new Audio(new URL(rec.file, VOICE_BASE).href);
    a.preload = 'auto';
    a.volume = 1;
    currentAudio = a;
    const done = () => { if (currentAudio === a) currentAudio = null; emit(false, who, text || rec.text || ''); };
    a.onended = done;
    a.onerror = done;
    emit(true, who, text || rec.text || '');
    const pr = a.play();
    if (pr && pr.catch) pr.catch(() => { /* autoplay blocked: the subtitle still reads it */ });
    return true;
  } catch (e) { return false; }
}

export const speechAvailable = () => canSpeak() || clips.size > 0;
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

/** Speak a line as a character: a recorded clip when we have one, otherwise the speech engine. */
export function say(who, text, { lang = 'en', interrupt = true, volume = 1, key = null } = {}) {
  if (!enabled) return false;
  const english = String(lang || 'en').slice(0, 2).toLowerCase() === 'en';
  if (key && english && clips.has(key)) {
    if (interrupt) stopSpeaking();
    if (playClip(key, who, text)) return true;
  }
  if (!canSpeak() || !text) return false;
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
  stopClip();
  if (!canSpeak()) return;
  try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  current = null;
}

/** Called on the first real tap or key: browsers only allow audio after a gesture. */
let primed = false;
export function primeAudio() {
  if (primed) return;
  primed = true;
  try {
    const a = new Audio();
    a.volume = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignore */ }
}

export const speakingWho = () => current;
export const PERSONAS = PERSONA;
