// Physics, using measured lunar values rather than tuned "game feel" numbers.
// Everything the player feels — a hop, a fall, the rover's top speed, how far dust flies —
// is derived here from MOON.gravity and published vehicle masses.
import { MOON } from './lunar.js';

export const G = MOON.gravity;            // 1.62 m/s^2

// A suited astronaut on the Moon. Apollo crews could clear roughly a metre in the one-sixth
// gravity, so the hop is built from a target apex height rather than an arbitrary impulse.
export const SUIT = { astronautKg: 75, suitKg: MOON.suitedMassKg, totalKg: 155 };
export const HOP_APEX_M = 1.45;
export const HOP_SPEED = Math.sqrt(2 * G * HOP_APEX_M); // v = sqrt(2 g h) -> ~2.17 m/s

// Walking in a pressurised suit is slow and deliberate; a loping run is the fastest a person
// moves on foot in one (Apollo crews averaged about 1 m/s on traverses, and loped faster).
export const WALK_MS = 3.0;
export const RUN_MS = 5.4;

// Fall from height h: v = sqrt(2gh). Moon falls are slow, and dust hangs in the same arcs.
export const fallSpeed = h => Math.sqrt(2 * G * Math.max(0, h));
export const hopHeight = v => (v * v) / (2 * G);

// Ballistic range of dust kicked at speed v and angle a, in vacuum (no air drag).
export const ballisticRange = (v, aDeg) => (v * v * Math.sin(2 * aDeg * Math.PI / 180)) / G;

// Regolith is loose and angular; slopes steeper than its angle of repose slide.
export const SLOPE_LIMIT_DEG = 16;         // safe driving limit for the outpost rover
export const SLOPE_SLIP_DEG = 20;          // above this the wheels start to slip
export const SLOPE_HARD_DEG = MOON.angleOfReposeDeg;

// Rover: 210 kg empty, up to 490 kg payload, 36 V silver-zinc packs, 18 km/h top speed.
export const ROVER_PHYS = {
  massKg: MOON.lrvMassKg,
  payloadKg: MOON.lrvPayloadKg,
  topSpeed: MOON.lrvTopSpeedMs,
  batteryKwh: MOON.lrvBatteryKwh,
  rangeKm: MOON.lrvRangeKm,
  voltage: MOON.lrvBatteryVoltage,
  // Rolling resistance in loose regolith plus drivetrain losses: 8712 Wh over 36 km works out at
  // 0.24 Wh per metre, which is the LRV's own published working range.
  whPerMetre: 0.24,
  whPerMetreSlope: 0.06, // extra Wh/m per degree of climb (m*g*sin(slope) for 370 kg)
};

/** Energy left after driving `metres` on `slopeDeg`, as a fraction of the pack. */
export function roverReserveAfter(metres, slopeDeg = 0, reserve = 1) {
  const wh = metres * (ROVER_PHYS.whPerMetre + slopeDeg * ROVER_PHYS.whPerMetreSlope);
  return Math.max(0, reserve - wh / (ROVER_PHYS.batteryKwh * 1000));
}

/** How far the rover can still go with a given reserve fraction. */
export function roverRangeMetres(reserve, slopeDeg = 0) {
  const wh = reserve * ROVER_PHYS.batteryKwh * 1000;
  return wh / (ROVER_PHYS.whPerMetre + slopeDeg * ROVER_PHYS.whPerMetreSlope);
}

// Traction falls off as the surface tips past the angle of repose.
export function traction(slope) {
  if (slope <= SLOPE_LIMIT_DEG) return 1;
  if (slope >= SLOPE_SLIP_DEG) return 0.45;
  return 1 - ((slope - SLOPE_LIMIT_DEG) / (SLOPE_SLIP_DEG - SLOPE_LIMIT_DEG)) * 0.55;
}

// A suited walker covers ground at about a third of an Earth walk; these speeds feed the HUD
// readout so the numbers on screen match the motion the player feels.
export const HUD_PHYSICS = `g ${G.toFixed(2)} m/s² · hop ${HOP_APEX_M.toFixed(1)} m · rover ${(ROVER_PHYS.topSpeed * 3.6).toFixed(0)} km/h`;
