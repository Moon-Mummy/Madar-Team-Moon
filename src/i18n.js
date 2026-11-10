// Small locale loader. English is always the fallback, so a missing Arabic string never breaks the game.
import en from './lang/en.js';

const cache = { en };
let current = 'en';
let dict = en;
const listeners = [];

const resolve = (d, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), d);

export function t(key, vars) {
  let v = resolve(dict, key);
  if (v === undefined) v = resolve(en, key);
  if (v === undefined) return key;
  if (typeof v === 'string' && vars) {
    for (const [k, val] of Object.entries(vars)) v = v.split(`{${k}}`).join(String(val));
  }
  return v;
}

export function raw(key) {
  const v = resolve(dict, key);
  return v === undefined ? resolve(en, key) : v;
}

export function lang() { return current; }
export function dir() { return (dict.meta && dict.meta.dir) || 'ltr'; }
export function langName() { return (dict.meta && dict.meta.name) || 'English'; }

export async function setLang(code) {
  if (code !== 'en' && !cache[code]) {
    try {
      const mod = await import(`./lang/${code}.js`);
      cache[code] = mod.default;
    } catch (e) {
      console.warn('Locale not available yet:', code);
      return false;
    }
  }
  current = code;
  dict = cache[code] || en;
  document.documentElement.lang = current;
  document.documentElement.dir = dir();
  for (const fn of listeners) fn(current);
  return true;
}

export function onLangChange(fn) { listeners.push(fn); }
export { en };
