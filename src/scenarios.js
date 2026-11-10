// Structure of every situation: numbers, correct answers, limits. No prose lives here.
// Every number is taken from a measured mission value (see the `src` string in src/lang/*.js and
// the constants in src/lunar.js), so the tasks are arithmetic on real data rather than invented
// puzzles. tests/check-content.mjs verifies each puzzle is solvable and internally consistent.

export const SCEN = {
  // ------------------------------------------------------------------ power
  // Four 3.3 kW arrays (vertical panels catching the low polar sun). One is dust-covered at
  // 0.9 kW. After brushing, the field supplies 13.2 kW. An ISS-class life support system alone
  // draws 9.6 kW, so the survival load is 11.5 kW and only 1.7 kW of extras can stay on.
  solar: {
    kind: 'oddone',
    panelKw: [3.3, 3.3, 3.3, 0.9],
    odd: 3,
    loads: [
      { kw: 9.6, crit: true },  // life support (NASA ECLSS average)
      { kw: 1.2, crit: true },  // thermal control
      { kw: 0.4, crit: true },  // comms
      { kw: 0.3, crit: true },  // medical bay
      { kw: 1.5 },              // greenhouse LEDs
      { kw: 1.2 },              // rover charging
      { kw: 0.9 },              // science lab
      { kw: 0.8 },              // workshop
      { kw: 0.6 },              // screens and extra lights
    ],
    target: 13.2,
  },

  // ------------------------------------------------------------------ water
  // The real ISS chain: stop the suspect line, use the reserve, prove the fault, treat, retest.
  water: { kind: 'order', n: 5 },

  // ------------------------------------------------------------------ greenhouse
  // A fair test changes one thing. Trays 1 and 3 share everything except nutrient strength.
  green: {
    kind: 'mcq', correct: [1, 0, 2],
    steps: 3,
  },

  // ------------------------------------------------------------------ rover route
  // Real LRV limits: 210 kg empty, 490 kg payload, 18 km/h, 36 km working range. Slopes over
  // 16° are past the safe limit on loose regolith, and crews keep a quarter of the pack in hand.
  rover: {
    kind: 'mcq', correct: [1, 2], steps: 2,
    table: true,
    rows: [
      { km: 4.2, slope: 24, reserve: 42, ok: false },  // shortest, but far too steep
      { km: 6.1, slope: 8, reserve: 30, ok: true },    // longer, gentle, reserve kept
      { km: 9.6, slope: 3, reserve: 12, ok: false },   // gentle, but the pack runs out
    ],
    limits: { slope: 16, reserve: 25 },
  },

  // ------------------------------------------------------------------ fatigue
  // Hours worked vs hours slept, in the style of a real crew timeline: 8.5 h sleep and about
  // 2.5 h of exercise a day are the plan, not a luxury.
  fatigue: {
    kind: 'mcq', correct: [2, 1], steps: 2,
    chart: [[14, 5], [7, 8], [8, 8], [6, 8], [10, 7]],
  },

  // ------------------------------------------------------------------ dust
  dust: { kind: 'order', n: 5 },

  // ------------------------------------------------------------------ comms
  // 384,400 km at the speed of light is 1.28 s each way: a relay on high ground beats more power.
  comms: { kind: 'mcq', correct: [1, 2], steps: 2, svg: true },

  // ------------------------------------------------------------------ budget
  // A 40 kg spare-parts allowance, the way a resupply manifest really works: needs first.
  budget: {
    kind: 'budget', budget: 40,
    items: [
      { cost: 12, need: true },  // water filter cartridge
      { cost: 6, need: true },   // airlock door seal
      { cost: 9, need: true },   // rover wheel bearing
      { cost: 5, need: true },   // nutrient concentrate
      { cost: 4, need: false },  // spare gloves
      { cost: 3, need: false },  // extra lamp
      { cost: 2, need: false },  // paint
    ],
  },

  // ------------------------------------------------------------------ samples
  // Four real Apollo-era sample types, oldest to youngest: ferroan anorthosite (4.4 Ga),
  // mare basalt (3.1–3.9 Ga), impact breccia (mixed), and orange glass beads (volcanic fire
  // fountains, ~3.6 Ga). Clue order matches the rock cards below.
  sample: {
    kind: 'match',
    pairs: [[0, 1], [1, 2], [2, 0], [3, 3]],
  },

  // ------------------------------------------------------------------ schedule
  // A 24-hour colony day built from the ISS planning rules: 8+ h sleep, 6–8 h work, 2+ h
  // exercise, meals and free time. The day starts badly and has to add up to 24 exactly.
  schedule: {
    kind: 'schedule', total: 24,
    blocks: [
      { start: 5, min: 8, max: 10 },  // sleep
      { start: 11, min: 6, max: 8 },  // work
      { start: 1, min: 2, max: 3 },   // exercise
      { start: 1, min: 2, max: 3 },   // meals
      { start: 6, min: 2, max: 6 },   // free time
    ],
  },

  // ------------------------------------------------------------------ storm
  // The August 1972 solar storm happened between Apollo 16 and 17. A crew on the surface would
  // have needed the regolith-shielded shelter, not a warning and a hope.
  storm: { kind: 'order', n: 4 },
};

// Hint ladder: the first hint points at the idea, the second narrows it down.
export const HINTS = {
  solar: ['hint.solar.0', 'hint.solar.1'],
  water: ['hint.water.0', 'hint.water.1'],
  green: ['hint.green.0', 'hint.green.1'],
  rover: ['hint.rover.0', 'hint.rover.1'],
  fatigue: ['hint.fatigue.0', 'hint.fatigue.1'],
  dust: ['hint.dust.0', 'hint.dust.1'],
  comms: ['hint.comms.0', 'hint.comms.1'],
  budget: ['hint.budget.0', 'hint.budget.1'],
  sample: ['hint.sample.0', 'hint.sample.1'],
  schedule: ['hint.schedule.0', 'hint.schedule.1'],
  storm: ['hint.storm.0', 'hint.storm.1'],
};
