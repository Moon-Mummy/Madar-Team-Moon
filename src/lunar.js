// Real lunar reference data. Every number in the game's challenges comes from here or from
// src/scenarios.js (which cites its own source strings). Keeping the measurements in one module
// means the fiction can be checked against measurements instead of guessed.
//
// Sources are listed per entry; the `src` label is shown in the interface so a young player can
// see that a number came from a mission and not from the game's imagination.

export const MOON = {
  gravity: 1.62,            // m/s^2, surface gravity (1/6 of Earth)
  radiusKm: 1737.4,         // mean radius
  distanceKm: 384400,       // mean Earth-Moon distance
  lightDelay: 1.28,         // seconds, one way at the speed of light
  solarConstant: 1361,      // W/m^2 at the Moon's distance from the Sun
  synodicDayDays: 29.5306,  // one lunar day, sunrise to sunrise
  siderealMonthDays: 27.3217,
  dayTempC: 120,            // equator, in sunlight
  nightTempC: -130,         // equator, after dark
  psrTempC: -233,           // permanently shadowed crater floor (about 40 K)
  regolithDepthM: 5,        // typical thickness of the broken top layer
  regolithGrainUm: [20, 100],
  angleOfReposeDeg: 30,     // how steep loose regolith can pile before it slides
  surfaceDosePerDay: 0.5,   // mSv/day, galactic cosmic rays at the surface
  careerDoseLimit: 600,     // mSv, NASA career limit for astronauts
  shieldDepthM: 2.5,        // regolith needed over a storm shelter
  waterIceMassPercent: 5.6, // LCROSS, Cabeus crater ejecta
  recoveryWater: 0.98,      // ISS water recovery since 2023
  recoveryOxygen: 0.75,     // target oxygen recovery for exploration life support
  eclssPowerKw: 9.6,        // average power of an ISS-class life support system
  crewO2KgDay: 0.9,
  crewWaterKgDay: 3.2,
  crewFoodKgDay: 1.56,
  suitedMassKg: 80,         // suit + backpack carried by a walking astronaut
  lrvMassKg: 210,
  lrvPayloadKg: 490,
  lrvTopSpeedMs: 5.0,       // 18 km/h
  lrvBatteryKwh: 2 * 36 * 121 / 1000, // two 36 V, 121 Ah silver-zinc packs
  lrvRangeKm: 36,           // planned working range (battery allowed more)
  lrvBatteryVoltage: 36,
};

// ---------------------------------------------------------------------------------------------
// Named real places used in the world. The outpost itself stands on Connecting Ridge, one of the
// regions studied as a possible south-pole landing site, within sight of Shackleton's rim.
// `at`/`r`/`depth` are game metres; `real` keeps the true measurement for labels and the guide.
// ---------------------------------------------------------------------------------------------
export const FEATURES = [
  {
    id: 'shackleton',
    at: [-236, 96], r: 118, depth: 30, rim: 7,
    name: 'Shackleton',
    real: { diameterKm: 21, depthKm: 4.2, floorK: 90, litPercent: 85 },
    fact: 'Shackleton is 21 km across and 4.2 km deep. Its rim sees the Sun about 85% of the time; its floor never does and stays near 90 K.',
    src: 'NASA / JAXA Kaguya',
  },
  {
    id: 'cabeus',
    at: [78, -74], r: 26, depth: 6.5, rim: 2.2, psr: true,
    name: 'Cabeus',
    real: { diameterKm: 100, icePercent: 5.6, impactYear: 2009 },
    fact: 'LCROSS hit Cabeus in 2009 and found about 5.6% water ice by mass in the ejecta — the first measured number for polar ice.',
    src: 'NASA LCROSS, Science 2010',
  },
  {
    id: 'malapert',
    at: [152, 118], r: 70, depth: 0, rim: 34,
    name: 'Malapert',
    real: { heightKm: 5, earthView: true },
    fact: 'Malapert Massif rises about 5 km and keeps Earth in view, which makes it a natural place for a radio relay.',
    src: 'NASA lunar reconnaissance',
  },
  {
    id: 'connecting-ridge',
    at: [-4, 8], r: 46, depth: 0, rim: 0,
    name: 'Connecting Ridge',
    real: { slopeDeg: 6, litPercent: 80 },
    fact: 'The outpost stands on Connecting Ridge, a broad ridge near Shackleton that gets sunlight most of the lunar day and is close to ice.',
    src: 'NASA south-pole site studies',
  },
];

export const featureById = id => FEATURES.find(f => f.id === id);

// Short source labels reused by the situations. Shown as a small line under every task.
export const SOURCES = {
  eclss: 'NASA ECLSS / ISS, 2023',
  lcross: 'NASA LCROSS, Science 2010',
  lrv: 'NASA Apollo LRV handbook',
  rad: 'NASA STD-3001, 2022',
  lro: 'NASA LRO / Diviner',
  kaguya: 'JAXA Kaguya terrain camera',
  apollo: 'Apollo lunar sample catalogue',
  veggie: 'NASA Veggie / ISS plant growth',
  dsn: 'NASA Deep Space Network',
};
