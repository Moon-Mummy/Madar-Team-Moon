# Madar-Team-Moon · مَدَار — فريق القمر

A single-player, open-ended **lunar colony** you can walk around, in the browser. You are the new cadet at *Madar Outpost* on **Connecting Ridge**, a real candidate region near the Moon's south pole, within sight of Shackleton. Five crew NPCs walk the ridge and **talk to you out loud**; twelve stations are open to inspect; a four-wheel rover takes you to Cabeus crater; and eleven optional situations are built from **measured mission data** rather than invented numbers. Nothing is timed, nothing can fail, and there is no score.

Version 2.2 — the Moon itself, speaking characters, real physics, real tasks, artwork, recorded voices, and a suit and rover that look the part.

> **Godot build:** `Luna-Quest-V1/` is the same idea rebuilt in Godot 4.3 as a walkable 3D game you can step inside the habitat in, with a daily task board that spends *your* energy instead of the base's electricity. Open `Luna-Quest-V1/project.godot`. See its own README.

---

## Run it

Node.js 18+ only. No install, no build step, no dependencies.

```bash
node server.mjs          # http://localhost:8000
PORT=3000 node server.mjs
```

Any static file server works (`python3 -m http.server`, GitHub Pages, Netlify). Opening `index.html` from disk will **not** work: the game uses ES modules, which browsers block on `file://`. Everything it needs is in the repository — no CDN, no tracking, no network call at runtime.

## What changed in 2.2

- **The crew now have real recorded voices.** Every greeting, bark, spoken answer, incident brief and
  the cadet's own callouts are 55 audio clips in `assets/voice/`, generated once and shipped with the
  game. Browser speech synthesis is no longer required: on systems with no installed voice engine
  (many Linux installs report zero voices) the recorded pack plays instead.
- **Voice check** in Settings plays a sample and reports how many recorded lines and browser voices
  the device has, so a silent machine is diagnosable in one tap.
- Audio is primed on the first tap or key, so the browser's autoplay policy cannot swallow the first
  line, and lines still fall back to the speech engine when a recording does not exist.

## What changed in 2.1

- **Suit and helmet reworked.** The crew and the player now wear an Apollo/Artemis-style EVA suit:
  gold sun visor over a white helmet shell, hard upper torso, chest control module, life-support
  backpack, bearing rings at every joint, grey gloves and big regolith boots. Each NPC has a painted
  helmet crown and a shoulder flash in their own colour.
- **Rover controls fixed.** The rover used to stall dead on any bank steeper than 16°: pressing
  forward did nothing, which is exactly what "the stick is jammed" feels like. Slope is now a speed
  penalty (38 % on steep ground) plus a warning, never a lock, and the wheels keep turning.
- **Rover model rebuilt** on the LRV layout — open chassis, two seats, T-handle, cargo rack, folded
  solar wing, four big wheels — and it now faces the way it drives (the old mesh was mounted sideways).
- **A clear parking apron** and a driving camera that stays out of buildings.
- **Touch controls actually work end to end**: joystick, entering and leaving the rover, taking a
  sample, and every on-screen prompt is tappable with a "Tap" label instead of a keyboard key.

## What changed in 2.0

**The world is the Moon.** The map is a 520 m walkable slice of the south pole with the real
features that matter to a base there: **Shackleton** (21 km across, 4.2 km deep, sunlit rim),
**Cabeus** (LCROSS's ice crater), **Malapert Massif**, and **Connecting Ridge** itself, where the
outpost stands. Permanent shadows are dark and blue, ejecta rays are bright, and a coarse ring of
terrain out to 900 m hides the edge of the world behind real ridges.

**The characters speak.** Each of the five NPCs has their own voice (pitch, rate and a preferred
system voice), speaks their greeting when you walk up, answers with one short spoken line, and
barks at you as you pass. Text on screen is a subtitle with a replay button, not a wall of prose.
Where a device has no speech engine the game says so and shows the same short lines.

**They are people, not robots.** The hovering bots were replaced with suited astronauts built on
the same rig as the player, with coloured shoulder flashes and visors. They walk with a gait driven
by distance travelled, turn to face you, gesture while speaking, and stand still when standing.

**Physics from measurements.** `src/physics.js` drives every number the player feels:

| Quantity | Value used | Source |
| --- | --- | --- |
| Surface gravity | 1.62 m/s² | Apollo / standard lunar constant |
| Hop apex | 1.45 m (`v = √(2gh)`) | suited astronaut on the Moon |
| Walking / loping speed | 3.0 / 5.4 m/s | Apollo surface traverse rates |
| Rover top speed | 5.0 m/s (18 km/h) | Apollo LRV |
| Rover battery | 2 × 36 V × 121 Ah = 8.7 kWh | LRV silver-zinc packs |
| Rover range | 0.24 Wh/m → 36 km | LRV working range |
| Slope limit / slip | 16° / 20° | regolith angle of repose |
| Dust arcs | parabolic under 1.62 m/s², no drag | vacuum |
| Solar constant | 1361 W/m² | measured at 1 AU |
| Light delay | 1.28 s each way | 384,400 km at c |
| Surface dose | 0.5 mSv/day, 600 mSv career | NASA STD-3001 |

The HUD prints the gravity, hop height and rover speed it is actually using, so the numbers can be
checked against the motion.

**Tasks are arithmetic on real data.** Eleven situations, each with a source line under it:

| Situation | The real data behind it |
| --- | --- |
| Solar budget | ISS-class life support draws 9.6 kW; four 3.3 kW arrays; a dusty array reads 0.9 kW |
| Water loop | ISS ECLSS: 98% recovery since 2023 (93% before), 3.2 kg water per person per day |
| Fair test | Hydroponics under red/blue LEDs, one variable at a time |
| Rover route | LRV limits: 210 kg, 490 kg payload, 18 km/h, 36 km range, 16° slope, 25% reserve |
| Tired shift | 14 h on / 5 h asleep vs the 8.5 h sleep the plan allows |
| Dusty airlock | Regolith grains 20–100 µm, sharp and glassy |
| Radio shadow | 384,400 km → 1.28 s each way; line of sight, not more power |
| 40 kg spare manifest | Mass budget: filter, seal, bearing, nutrient before wants |
| Four samples | Anorthosite 4.4 Ga, mare basalt, impact breccia, glass beads |
| A day that adds up | 24 h: sleep ≥8, work 6–8, exercise ≥2, meals ≥2, free ≥2 |
| Solar storm drill | 1972 event between Apollo 16 and 17; 2–3 m of regolith for shelter |

**Graphics.** Prefiltered sky reflections (PMREM) for every metal and visor, a two-octave procedural
regolith shader with normal perturbation, long-shadow sun with a core/halo/streak glare, a
higher-resolution Earth with an atmosphere rim, a far-field terrain ring, ballistic dust kicked by
boots and wheels, ice glints inside Cabeus, a grain-and-vignette pass, and six AI-generated
illustrations wired into the start screen, the field guide and four situations.

**Bilingual.** English and Arabic, right-to-left, every string, with automatic detection on a first
run and live switching. Font shaping, logical CSS properties and mirrored layout all work.

## Play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Walk | `W A S D` / arrows | left joystick |
| Look | drag with the mouse | drag anywhere |
| Zoom | wheel | — |
| Interact / take a sample | `E` | **E** button |
| Hop | `Space` | round arrow button |
| Drive / leave the rover | `R` | **E** near the rover, or tap the prompt |
| Get out while driving | `R` | tap the **Get out** chip |
| Board · Journal · Guide | `B` · `M` · `G` | corner buttons |
| Pause, settings, help | `P` / `Esc` | gear |

Progress saves to `localStorage` every twelve seconds and on leaving. Settings can reset it.

## Project layout

```
index.html              shell, HUD markup, inline SVG icons
css/style.css           interface styles (logical properties, so RTL mirrors for free)
assets/                 optional artwork (see assets/README.md — drop-in replaceable)
src/main.js             renderer, environment map, camera, controls, dust, barks, loop
src/world.js            analytic south-pole terrain, all buildings, sky, Earth, dust system
src/lunar.js            real lunar constants, named features and their sources
src/physics.js          gravity, hop, rover battery/range, traction, slope limits
src/speech.js           per-character voices on the Web Speech API
src/entities.js         astronaut rigs, NPC walking/gait, rover, collision
src/sim.js              clock, meters, situation director, journal, saving
src/activities.js       the six task types, hint ladder, reflection step
src/ui.js               HUD, world labels and speech bubbles, sheets, guide, Moon map
src/data.js             stations, crew, navigation graph, cards, incidents
src/scenarios.js        numbers and correct answers for every situation
src/lang/en.js, ar.js   all prose (identical key sets)
vendor/three.module.min.js   Three.js r160 (MIT)
tests/check-content.mjs locale parity + puzzle solvability + physical-constant checks
server.mjs              zero-dependency static server
```

### Changing content

Edit only `src/lang/*.js` for text, `src/scenarios.js` for numbers, `src/lunar.js` for measured
constants, `src/data.js` for stations and crew. Then:

```bash
npm test
```

The test checks both locales have every key, that each array of steps/options matches its
specification, that the solar puzzle is solvable with life support on, that the manifest has a real
choice in it, that the schedule can reach 24 hours inside its limits, and that gravity, the solar
constant, the light delay and the rover's battery still agree with the measurements.

## Sources and honesty notes

* The design brief came from a shared Drive folder: the **Luna Academy System Design and Learning
  Blueprint**, **GDD v0.2**, **Moon Colony Field Guide**, **Crew Bot Specification**, **Simulation
  and Incident Rules**, curriculum matrix, incident catalogue, and two older prototypes. That
  material is the intellectual basis for the crew, tone and learning loop; it is not redistributed.
* Drive was unreachable from the sandbox used to build this, so documents were read as text through
  two public read-only proxies. Measurements were re-checked against NASA, JAXA and Apollo sources.
  Unverifiable late-2026 programme claims were left out; the Artemis II crew names and the 1972
  solar storm are the newest things included.
* Artwork in `assets/` was generated for this project with an image model. You can replace any file
  with your own picture of the same name; see `assets/README.md`.
* This is a fan-made educational game. It is not a NASA product and not a training tool.

## Licence

Code **MIT** (see `LICENSE`); written content and artwork **CC BY 4.0**. Three.js is MIT; its notice
is in `vendor/THREE-LICENSE.txt`.

---

## بالعربية

**مَدَار — فريق القمر** نسخة 2.0: محطة قمرية يمكنك المشي فيها على «الحافة الرابطة» قرب القطب الجنوبي،
بين شاكلتون وكابيوس، مع خمس شخصيات تمشي وتتحدث إليك بصوتها، واثنتي عشرة محطة، وعربة بست عجلات،
وأحد عشر موقفًا مبنيًا على بيانات بعثات حقيقية.

الفيزياء مقيسة: جاذبية 1.62 م/ث²، قفزة 1.45 م، عربة 18 كم/س و36 كم مدى، ميل أقصى 16°، وحدود إشعاع
من معيار ناسا. النصوص مكتوبة لتُسمع: سطر قصير لكل شخصية، والنص على الشاشة ترجمة مع زر إعادة.

**التشغيل:** `node server.mjs` ثم `http://localhost:8000`.

**التحكم:** `W A S D` للمشي، سحب الماوس للنظر، `E` للتفاعل، `R` للعربة، مسافة للقفز، `B` للوحة،
`M` للدفتر، `G` للدليل، `Esc` للقائمة. اللعبة كاملة بالعربية مع دعم كامل للكتابة من اليمين إلى
اليسار والحفظ المحلي.
