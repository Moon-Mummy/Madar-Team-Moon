// Language-neutral data for Madar-Team-Moon.
// Every human-readable string lives in src/lang/*.js and is addressed by the keys used here.
// Nothing in this file is generated at runtime: it is the single source of truth for the world.

export const GAME = 'madar-team-moon';
export const SAVE_KEY = 'madar-team-moon.save.v1';

// ---------------------------------------------------------------------------------------------
// Crew. The five canonical bots of the Luna Academy blueprint. They are authored characters,
// never generative AI, and they speak in suggestions ("the sensor suggests…") rather than orders.
// ---------------------------------------------------------------------------------------------
export const CREW = [
  { id: 'maya', role: 'commander', color: '#69d4e7', hue: 0x69d4e7, home: 'control', shift: 'day' },
  { id: 'omar', role: 'engineer', color: '#f1c36d', hue: 0xf1c36d, home: 'life', shift: 'day' },
  { id: 'amina', role: 'scientist', color: '#85e0b0', hue: 0x85e0b0, home: 'green', shift: 'day' },
  { id: 'leo', role: 'robotics', color: '#b9a6ff', hue: 0xb9a6ff, home: 'garage', shift: 'day' },
  { id: 'sofia', role: 'medic', color: '#ff9d93', hue: 0xff9d93, home: 'medical', shift: 'day' },
];

export const BOT_STATES = ['idle', 'working', 'investigating', 'repairing', 'reporting', 'interacting', 'resting', 'returning'];

// ---------------------------------------------------------------------------------------------
// Stations. x/z is the footprint centre, door is where the player stands to interact,
// rot is the Y rotation of the building (radians). Stations are always inspectable:
// there is no locked area and no required order.
// ---------------------------------------------------------------------------------------------
export const STATIONS = [
  { id: 'hab', name: 'hab', x: -3, z: -16.6, door: [-3, -10.6], rot: 0, kind: 'habitat', crew: ['maya'], radius: 8, topics: ['crew', 'day'], cards: 3, incident: 'storm' },
  { id: 'airlock', name: 'airlock', x: 6, z: -12.4, door: [7.4, -10.9], rot: 0.75, kind: 'airlock', crew: [], radius: 3, topics: ['suit', 'dust'], cards: 2, incident: 'dust' },
  { id: 'control', name: 'control', x: -12, z: -9, door: [-6.7, -6.35], rot: 1.107, kind: 'dome', crew: ['maya'], radius: 4.4, topics: ['crew', 'day', 'storm'], cards: 3, incident: 'schedule' },
  { id: 'lab', name: 'lab', x: 12, z: -9, door: [7.1, -6.35], rot: -1.077, kind: 'dome', crew: ['amina'], radius: 4.2, topics: ['rock', 'science'], cards: 3, incident: 'sample' },
  { id: 'medical', name: 'medical', x: -17, z: -1.5, door: [-12.7, -1.5], rot: 1.571, kind: 'pod', crew: ['sofia'], radius: 3.8, topics: ['health', 'day'], cards: 2, incident: 'fatigue' },
  { id: 'life', name: 'life', x: -16, z: 10, door: [-11.4, 9.5], rot: 1.673, kind: 'pod', crew: ['omar'], radius: 4.2, topics: ['water', 'air'], cards: 3, incident: 'water' },
  { id: 'green', name: 'green', x: 18, z: 5, door: [11.05, 4.13], rot: -1.695, kind: 'greenhouse', crew: ['amina'], radius: 5.6, topics: ['plants', 'water'], cards: 3, incident: 'green' },
  { id: 'workshop', name: 'workshop', x: -5, z: 16, door: [-2.55, 12.2], rot: 2.57, kind: 'shed', crew: ['maya'], radius: 4.2, topics: ['repair', 'budget'], cards: 2, incident: 'budget' },
  { id: 'garage', name: 'garage', x: 8, z: 16, door: [5.2, 11.65], rot: -2.57, kind: 'garage', crew: ['leo'], radius: 4.6, topics: ['rover', 'robot'], cards: 3, incident: 'rover' },
  { id: 'power', name: 'power', x: 31, z: -12, door: [27.85, -10.2], rot: -1.05, kind: 'power', crew: ['leo'], radius: 4.6, topics: ['power', 'night'], cards: 3, incident: 'solar' },
  { id: 'relay', name: 'relay', x: -30, z: -14, door: [-27.4, -11], rot: 0.6, kind: 'mast', crew: ['leo'], radius: 3.4, topics: ['comms', 'earth'], cards: 2, incident: 'comms' },
  { id: 'pad', name: 'pad', x: -46, z: 22, door: [-39, 17], rot: 0, kind: 'pad', crew: [], radius: 7.5, topics: ['lander', 'dust'], cards: 2, incident: null },
];

export const stationById = id => STATIONS.find(s => s.id === id);

// ---------------------------------------------------------------------------------------------
// Bot navigation graph. Bots walk on the ground between nodes; they never fly or clip.
// ---------------------------------------------------------------------------------------------
export const NAV_NODES = {
  hub: [0, -2],
  N1: [0, -8], E1: [9, 2], P1: [22, -4], S1: [0, 9], W1: [-9, 2], W2: [-24, 3],
  habDoor: [-4.6, -10.4], airlockDoor: [8.8, -11.2], controlDoor: [-6.0, -5.6], labDoor: [7.6, -5.8],
  medDoor: [-13.4, -0.3], lifeDoor: [-11.0, 10.2], greenDoor: [11.5, 3.0], workDoor: [-2.0, 12.9],
  garageDoor: [5.0, 12.6], powerDoor: [28.0, -11.0], relayDoor: [-27.0, -11.4], padDoor: [-38.5, 16.6],
  padWalk: [-34, 12], relayWalk: [-22, -2], powerWalk: [24, -6],
};

export const NAV_EDGES = [
  ['hub', 'N1'], ['hub', 'E1'], ['hub', 'S1'], ['hub', 'W1'],
  ['N1', 'E1'], ['E1', 'S1'], ['S1', 'W1'], ['W1', 'N1'],
  ['N1', 'habDoor'], ['N1', 'airlockDoor'], ['N1', 'controlDoor'], ['N1', 'labDoor'],
  ['controlDoor', 'W1'], ['E1', 'greenDoor'], ['E1', 'P1'], ['P1', 'powerDoor'], ['P1', 'powerWalk'],
  ['S1', 'workDoor'], ['S1', 'garageDoor'], ['W1', 'medDoor'], ['W1', 'lifeDoor'],
  ['W1', 'W2'], ['W2', 'relayWalk'], ['relayWalk', 'relayDoor'], ['W2', 'padWalk'], ['padWalk', 'padDoor'],
];

export const SAMPLE_SITES = [
  { id: 'siteA', x: 44, z: 6, radius: 6 },
  { id: 'siteB', x: 30, z: 40, radius: 7 },
  { id: 'siteC', x: 56, z: 48, radius: 8 },
];

export const ROVER = { park: [2.6, 9.2], heading: -2.14, spawnRadius: 90, maxSpeed: 11, slopeLimit: 16 };

export const PLAYER = { spawn: [0, 0, 2], eye: 1.55, walk: 5.2, run: 8.6, hop: 2.7, gravity: 1.62, bound: 108 };

export const CRATERS = [
  { x: 62, z: 30, r: 16, d: 3.6 }, { x: 44, z: 6, r: 5.5, d: 1.4 }, { x: 30, z: 40, r: 6.5, d: 1.5 },
  { x: 56, z: 48, r: 8, d: 1.9 }, { x: -62, z: -38, r: 11, d: 2.4 }, { x: 74, z: -46, r: 13, d: 2.8 },
  { x: -68, z: 62, r: 9, d: 2.1 }, { x: 12, z: 78, r: 8.5, d: 2 }, { x: 82, z: 8, r: 9, d: 2.2 },
  { x: -20, z: 44, r: 6, d: 1.3 }, { x: 36, z: -40, r: 7, d: 1.6 }, { x: -44, z: -30, r: 5, d: 1.1 },
];

// ---------------------------------------------------------------------------------------------
// Incidents. Optional, never farmable, never a fail state. Each one is a small investigation:
// report → act → reflect. `kind` selects the interaction in activities.js.
// ---------------------------------------------------------------------------------------------
export const INCIDENTS = [
  { id: 'solar', station: 'power', bot: 'leo', kind: 'oddone', skills: ['sys', 'energy'], gravity: 3 },
  { id: 'water', station: 'life', bot: 'omar', kind: 'order', skills: ['reason', 'water'], gravity: 3 },
  { id: 'green', station: 'green', bot: 'amina', kind: 'experiment', skills: ['design', 'bio'], gravity: 2 },
  { id: 'rover', station: 'garage', bot: 'leo', kind: 'route', skills: ['nav', 'plan'], gravity: 2 },
  { id: 'fatigue', station: 'medical', bot: 'sofia', kind: 'choice', skills: ['empathy', 'health'], gravity: 3 },
  { id: 'dust', station: 'airlock', bot: 'maya', kind: 'order', skills: ['risk', 'maintain'], gravity: 2 },
  { id: 'comms', station: 'relay', bot: 'leo', kind: 'diagram', skills: ['sys', 'comms'], gravity: 2 },
  { id: 'budget', station: 'workshop', bot: 'maya', kind: 'budget', skills: ['plan', 'budget'], gravity: 1 },
  { id: 'sample', station: 'lab', bot: 'amina', kind: 'match', skills: ['observe', 'science'], gravity: 2 },
  { id: 'schedule', station: 'control', bot: 'maya', kind: 'schedule', skills: ['plan', 'fair'], gravity: 2 },
  { id: 'storm', station: 'hab', bot: 'maya', kind: 'order', skills: ['risk', 'safety'], gravity: 3 },
];

export const incidentById = id => INCIDENTS.find(i => i.id === id);

// Reflection cards shown after every situation: "think about it", "go deeper".
export const EARTH_LINK = {
  solar: 'earthlink.solar', water: 'earthlink.water', green: 'earthlink.green', rover: 'earthlink.rover',
  fatigue: 'earthlink.fatigue', dust: 'earthlink.dust', comms: 'earthlink.comms', budget: 'earthlink.budget',
  sample: 'earthlink.sample', schedule: 'earthlink.schedule', storm: 'earthlink.storm',
};

// Three "interesting" cards per station: examining the station reveals them into the journal.
export const CARDS = {
  hab: ['hab1', 'hab2', 'hab3'], airlock: ['air1', 'air2'], control: ['con1', 'con2', 'con3'],
  lab: ['lab1', 'lab2', 'lab3'], medical: ['med1', 'med2'], life: ['life1', 'life2', 'life3'],
  green: ['gre1', 'gre2', 'gre3'], workshop: ['wor1', 'wor2'], garage: ['gar1', 'gar2', 'gar3'],
  power: ['pow1', 'pow2', 'pow3'], relay: ['rel1', 'rel2'], pad: ['pad1', 'pad2'],
};

// Bot small-talk menus. Keys resolve to l.talk.<bot>.<topic>.
export const TALK = {
  maya: ['plan', 'day', 'storm', 'help'],
  omar: ['water', 'air', 'fix', 'help'],
  amina: ['plants', 'ice', 'science', 'help'],
  leo: ['rover', 'power', 'comms', 'help'],
  sofia: ['health', 'sleep', 'dust', 'help'],
};

// Field guide structure. Each chapter is a list of {h, p} resolved from the locale.
export const GUIDE = ['day', 'challenges', 'jobs', 'loop', 'places', 'glossary', 'real', 'safety'];

// English letter keys used by the glossary and jobs tables.
export const JOBS = ['commander', 'medic', 'life', 'geologist', 'power', 'robotics', 'comms', 'agronomist', 'builder', 'pilot'];
export const PLACES = ['hab', 'airlock', 'control', 'lab', 'medical', 'life', 'green', 'workshop', 'garage', 'power', 'relay', 'pad'];
export const GLOSSARY = ['eclss', 'eva', 'isru', 'ltv', 'regolith', 'psr', 'sublimation', 'hydroponics', 'dust', 'airlock', 'relay', 'shackleton'];

// Suit colours offered at the start screen (no personal data is ever requested).
export const SUITS = ['#f3f6f8', '#69d4e7', '#f1c36d', '#ff9d93', '#b9a6ff', '#85e0b0'];
