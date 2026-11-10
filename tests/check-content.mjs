// Content check: keeps the two locales and the scenario structure in sync.
// Run with: npm test
import en from '../src/lang/en.js';
import { SCEN, HINTS } from '../src/scenarios.js';
import { INCIDENTS, STATIONS, CREW, CARDS, GUIDE, JOBS, PLACES, GLOSSARY, TALK, SAMPLE_SITES } from '../src/data.js';

let ar = null;
try { ar = (await import('../src/lang/ar.js')).default; } catch (e) { /* reported below */ }

const errors = [];
const warn = [];
const fail = msg => errors.push(msg);
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

function leaves(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...leaves(v, p));
    else out.push(p);
  }
  return out;
}
const placeholders = s => (String(s).match(/\{[a-z0-9]+\}/gi) || []).sort().join(',');

// ---------------------------------------------------------------- locale parity
if (!ar) fail('src/lang/ar.js is missing.');
else {
  const enKeys = leaves(en), arKeys = leaves(ar);
  const arSet = new Set(arKeys), enSet = new Set(enKeys);
  for (const k of enKeys) if (!arSet.has(k)) fail(`Arabic is missing: ${k}`);
  for (const k of arKeys) if (!enSet.has(k)) warn.push(`Arabic has an extra key: ${k}`);
  for (const k of enKeys) {
    const a = get(ar, k), e = get(en, k);
    if (typeof a === 'string' && typeof e === 'string' && placeholders(a) !== placeholders(e)) {
      warn.push(`Placeholder mismatch at ${k}: EN {${placeholders(e)}} AR {${placeholders(a)}}`);
    }
  }
  const enLeaves = enKeys.filter(k => typeof get(en, k) === 'string');
  const untranslated = enLeaves.filter(k => get(en, k) === get(ar, k) && get(en, k).length > 12);
  if (untranslated.length) warn.push(`${untranslated.length} Arabic strings are identical to English, e.g. ${untranslated.slice(0, 6).join(', ')}`);
}

// ---------------------------------------------------------------- required text
const need = [
  ...STATIONS.map(s => [`station.${s.id}.name`, `station.${s.id}.desc`]).flat(),
  ...CREW.map(c => [`crew.${c.id}.name`, `crew.${c.id}.role`, `crew.${c.id}.bio`]).flat(),
  ...Object.values(CARDS).flat().map(c => [`card.${c}.t`, `card.${c}.d`]).flat(),
  ...SAMPLE_SITES.map(s => [`sampleSite.${s.id}`, `sampleSiteText.${s.id}`]).flat(),
  ...GUIDE.map(g => [`guide.${g}.t`]).flat(),
  ...JOBS.map(j => [`guide.jobs.rows.${j}.t`, `guide.jobs.rows.${j}.d`]).flat(),
  ...PLACES.map(p => [`place.${p}.t`, `place.${p}.d`]).flat(),
  ...GLOSSARY.map(g => [`glossary.${g}.t`, `glossary.${g}.d`]).flat(),
  ...Object.entries(TALK).flatMap(([bot, topics]) => topics.map(tp => `talk.${bot}.${tp}`)),
  'ui.enter', 'ui.intro', 'ui.foot', 'ui.board', 'ui.guide', 'ui.journal', 'ui.help',
  'obj.reports.t', 'obj.reports.d', 'obj.explore.t', 'obj.explore.d', 'obj.samples.t',
];
for (const key of need) if (typeof get(en, key) !== 'string') fail(`English is missing: ${key}`);

// ---------------------------------------------------------------- incidents
function arr(v, len, label) {
  if (!Array.isArray(v)) return fail(`${label} must be an array`);
  if (len !== undefined && v.length !== len) fail(`${label} has ${v.length} entries, expected ${len}`);
}
for (const inc of INCIDENTS) {
  const id = inc.id;
  for (const f of ['title', 'report', 'bot', 'goal', 'why', 'skill', 'earth', 'answer', 'deep', 'done']) {
    if (typeof get(en, `inc.${id}.${f}`) !== 'string') fail(`inc.${id}.${f} is missing`);
  }
  const spec = SCEN[id];
  if (!spec) { fail(`No scenario for ${id}`); continue; }
  const n = spec.kind === 'order' ? spec.n : spec.steps;
  const enInc = get(en, `inc.${id}`);
  if (spec.kind === 'order') {
    arr(enInc.steps, n, `inc.${id}.steps`);
    arr(enInc.stepFb, n, `inc.${id}.stepFb`);
    arr(enInc.stepWrong, n, `inc.${id}.stepWrong`);
  } else if (spec.kind === 'oddone') {
    arr(enInc.panels, spec.panelKw.length, `inc.${id}.panels`);
    arr(enInc.loads, spec.loads.length, `inc.${id}.loads`);
    const crit = spec.loads.filter(l => l.crit).length;
    if (crit === 0) fail(`${id} has no critical loads`);
    const mustShed = spec.loads.reduce((a, l) => a + l.kw, 0) - spec.target;
    if (mustShed <= 0) fail(`${id} starts inside its budget; nothing to decide`);
    const optional = spec.loads.filter(l => !l.crit).reduce((a, l) => a + l.kw, 0);
    if (optional < mustShed) fail(`${id} cannot reach its budget by shedding optional loads`);
    if (spec.odd >= spec.panelKw.length) fail(`${id}: odd index out of range`);
  } else if (spec.kind === 'mcq') {
    arr(enInc.q, n, `inc.${id}.q`);
    arr(enInc.fb, n, `inc.${id}.fb`);
    arr(enInc.o, n, `inc.${id}.o`);
    for (let k = 0; k < n; k++) {
      const opts = get(enInc, `o.${k}`);
      if (!Array.isArray(opts)) { fail(`inc.${id}.o.${k} must be an array`); continue; }
      if (opts.length < 2) fail(`inc.${id}.o.${k} needs at least 2 options`);
      if (!Array.isArray(get(enInc, `fb.${k}`)) || get(enInc, `fb.${k}`).length !== opts.length) fail(`inc.${id}.fb.${k} must match the option count`);
      if (spec.correct[k] == null || spec.correct[k] >= opts.length) fail(`inc.${id}.correct.${k} is out of range`);
    }
    if (spec.table && (!Array.isArray(enInc.cols) || enInc.cols.length !== 4)) fail(`inc.${id}.cols must have 4 columns`);
  } else if (spec.kind === 'budget') {
    arr(enInc.items, spec.items.length, `inc.${id}.items`);
    const needs = spec.items.filter(i => i.need).reduce((a, i) => a + i.cost, 0);
    if (needs > spec.budget) fail(`${id}: the needs cost more than the budget`);
    if (needs === spec.budget) warn.push(`${id}: needs use the whole budget, no room for a choice`);
  } else if (spec.kind === 'match') {
    arr(enInc.samples, spec.pairs.length, `inc.${id}.samples`);
    arr(enInc.cards, spec.pairs.length, `inc.${id}.cards`);
    const seen = new Set();
    for (const [s, c] of spec.pairs) {
      if (s >= spec.pairs.length || c >= spec.pairs.length) fail(`${id}: pair out of range`);
      if (seen.has(c)) fail(`${id}: duplicate card in pairs`);
      seen.add(c);
    }
  } else if (spec.kind === 'schedule') {
    arr(enInc.blocks, spec.blocks.length, `inc.${id}.blocks`);
    const startSum = spec.blocks.reduce((a, b) => a + b.start, 0);
    if (startSum !== spec.total) fail(`${id}: starting values total ${startSum}, not ${spec.total}`);
    for (const b of spec.blocks) if (b.start < b.min) warn.push(`${id}: a block starts under its own minimum, which is fine as a puzzle`);
  }
  const hints = HINTS[id];
  if (!Array.isArray(hints) || hints.length !== 2) fail(`HINTS.${id} needs two hints`);
  else for (const h of hints) if (typeof get(en, h) !== 'string') fail(`Hint missing: ${h}`);
}

// ---------------------------------------------------------------- misc
if (!en.guide.loop.steps || en.guide.loop.steps.length !== 5) fail('guide.loop.steps must have 5 steps');
if (en.SCEN) fail('unexpected SCEN in locale');

console.log(`Checked ${INCIDENTS.length} situations, ${STATIONS.length} stations, ${Object.values(CARDS).flat().length} journal cards.`);
for (const w of warn) console.log(`  note: ${w}`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('All content checks passed.');
