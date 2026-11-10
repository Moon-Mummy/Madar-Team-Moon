// Structure of every situation: numbers, correct answers, limits. No prose lives here.
// All text is addressed from src/lang/<locale>.js using arrays aligned by index.
// tests/check-content.mjs verifies that every array here has a matching array of strings.

export const SCEN = {
  // ------------------------------------------------------------------ power
  solar: {
    kind: 'oddone',
    panelKw: [21, 20, 22, 9],
    odd: 3,
    loads: [
      { kw: 28, crit: true }, { kw: 14, crit: true }, { kw: 8, crit: true }, { kw: 6, crit: true },
      { kw: 12 }, { kw: 10 }, { kw: 8 }, { kw: 8 }, { kw: 6 },
    ],
    target: 72,
  },

  // ------------------------------------------------------------------ water
  water: { kind: 'order', n: 5 },

  // ------------------------------------------------------------------ greenhouse
  green: {
    kind: 'mcq', correct: [1, 0, 2],
    steps: 3,
  },

  // ------------------------------------------------------------------ rover route
  rover: {
    kind: 'mcq', correct: [1, 2], steps: 2,
    table: true,
    rows: [
      { km: 2.1, slope: 24, reserve: 42, ok: false },
      { km: 2.9, slope: 12, reserve: 42, ok: true },
      { km: 4.8, slope: 6, reserve: 14, ok: false },
    ],
    limits: { slope: 15, reserve: 25 },
  },

  // ------------------------------------------------------------------ fatigue
  fatigue: {
    kind: 'mcq', correct: [2, 1], steps: 2,
    chart: [[13, 5], [7, 8], [8, 8], [6, 8], [9, 7]],
  },

  // ------------------------------------------------------------------ dust
  dust: { kind: 'order', n: 5 },

  // ------------------------------------------------------------------ comms
  comms: { kind: 'mcq', correct: [1, 2], steps: 2, svg: true },

  // ------------------------------------------------------------------ budget
  budget: {
    kind: 'budget', budget: 100,
    items: [
      { cost: 35, need: true }, { cost: 25, need: true }, { cost: 20, need: true }, { cost: 15, need: true },
      { cost: 15, need: false }, { cost: 30, need: false }, { cost: 10, need: false },
    ],
  },

  // ------------------------------------------------------------------ samples
  sample: {
    kind: 'match',
    pairs: [[0, 1], [1, 2], [2, 0], [3, 3]],
    // sample clue → rock card
  },

  // ------------------------------------------------------------------ schedule
  schedule: {
    kind: 'schedule', total: 24,
    blocks: [
      { start: 6, min: 8, max: 10 }, // sleep
      { start: 13, min: 7, max: 10 }, // work
      { start: 1, min: 2, max: 3 }, // exercise
      { start: 3, min: 2, max: 3 }, // meals
      { start: 1, min: 2, max: 6 }, // free time
    ],
  },

  // ------------------------------------------------------------------ storm
  storm: { kind: 'order', n: 4 },
};

// Hint ladder: the first hint points at the idea, the second narrows it down.
export const HINTS = {
  solar: ['hint.solar.1', 'hint.solar.2'],
  water: ['hint.water.1', 'hint.water.2'],
  green: ['hint.green.1', 'hint.green.2'],
  rover: ['hint.rover.1', 'hint.rover.2'],
  fatigue: ['hint.fatigue.1', 'hint.fatigue.2'],
  dust: ['hint.dust.1', 'hint.dust.2'],
  comms: ['hint.comms.1', 'hint.comms.2'],
  budget: ['hint.budget.1', 'hint.budget.2'],
  sample: ['hint.sample.1', 'hint.sample.2'],
  schedule: ['hint.schedule.1', 'hint.schedule.2'],
  storm: ['hint.storm.1', 'hint.storm.2'],
};
