# Madar-Team-Moon · مَدَار — فريق القمر

A single-player, open-ended **Moon-colony learning sandbox** that runs in the browser. You are the new cadet at *Madar Outpost*, a small fictional base near the lunar south pole. Walk anywhere, talk to the five crew bots, inspect twelve stations, take the rover out to the craters, and help with eleven optional situations. Nothing is timed, nothing can fail, and there is no score.

Built from the **Luna Academy GDD / Blueprint** (v0.2 / v1.0) and the older *Moon Base Academy* / *moon-colony-project* prototypes, and rebuilt as a daytime-friendly, single-page 3D game.

---

## Run it

Requires only Node.js 18+ (no install, no build step, no dependencies).

```bash
node server.mjs          # http://localhost:8000
PORT=3000 node server.mjs
```

Or serve the folder with any static file server (`python3 -m http.server`, GitHub Pages, Netlify, an S3 bucket…). Opening `index.html` directly from the filesystem will **not** work: the game uses ES modules, which browsers block on `file://`. Everything it needs is in this repository — there is no CDN, no tracking, no network call at runtime.

## Play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Walk | `W A S D` / arrow keys | left joystick |
| Look around | drag with the mouse | drag anywhere |
| Zoom | mouse wheel | — |
| Interact / take a sample | `E` | **E** button |
| Hop (lunar gravity, 1.62 m/s²) | `Space` | **⤒** button |
| Drive / leave the rover | `R` | **E** near the rover |
| Situation board | `B` | board button |
| Journal | `M` | journal button |
| Field guide | `G` | guide button |
| Pause, settings, help | `P` / `Esc` | gear button |

Progress is saved locally in `localStorage` about every twelve seconds and on leaving the page. Settings can reset it completely.

## What is in it

* **A walkable outpost** — habitat, suit airlock, mission control, science lab, medical bay, life support, greenhouse, workshop, rover garage, solar power station, comms relay, landing pad. Every building is inspectable; none is locked, and there is no required order.
* **Five authored crew bots** — Maya (commander), Omar (life support), Amina (botanist), Leo (robotics and power), Sofia (medic). They walk a real navigation graph, go to work on the situation they are handling, and answer questions in authored dialogue — never generative AI.
* **Eleven optional situations**, each with a hint ladder, calm feedback and a reflection step (plain explanation, skill label, an "on Earth" question with a reveal, and an optional *go deeper*):
  1. Power budget — spot a dusty solar array, then shed loads without switching off life support.
  2. Water loop — order the steps that make recycled water safe again.
  3. Greenhouse — design a fair test, read it, and test a second factor.
  4. Rover routing — choose a route from distance, slope and battery reserve.
  5. Crew fatigue — a plan that protects a tired engineer *and* finishes the job.
  6. Dusty airlock — brush, vacuum, inspect the seal, check the filter, log it.
  7. Comms dropouts — fix line of sight with a ridge relay instead of more power.
  8. Spare-parts budget — needs before wants, with 100 credits.
  9. Rock identification — match four lunar samples to basalt, anorthosite, breccia and glassy regolith.
  10. A fair 24-hour day — sleep, work, exercise, meals and free time.
  11. Solar-storm drill — in, seal, count, monitor, all-clear.
* **A rover** with six wheels, real terrain pitch and roll, slope limits, a battery reserve and three sample sites to log.
* **31 journal cards**, a **field guide** (a day in the colony, the Moon's challenges, colony jobs, the water-and-crops loop, places, glossary, the real Moon, and how the game stays kind) and a **sample record**.
* **Two full languages** — English and Arabic, right-to-left, with every string translated. The language is chosen by the start screen, in settings, or automatically from the browser on a fresh save.
* **Accessibility** — adjustable text size, reduced motion, read-aloud (SpeechSynthesis), full keyboard play, no time pressure, no flashing.

## Design rules it follows

* One player, one Moon, one fictional outpost. No age gate, no account, no name, no chat, no ads, no analytics, no network dependency.
* No countdowns, no fail state, no score, no leaderboard. Meters are bounded and labelled as simulated.
* Situations are optional; they can be left, snoozed, or handed to the crew, who will solve them with a partial fix if ignored for about three colony hours. Rewards are applied once, so they cannot be farmed.
* Wrong choices get an explanation and a retry — the bot says *"the sensor suggests…"*, never *"you failed"*.
* Real-world science is presented carefully: regolith is sharp and abrasive, temperatures vary by place, ice mining is a developing technology, and Artemis plans change — the guide says to check nasa.gov.

## Project layout

```
index.html              page shell, HUD markup, inline SVG icons
css/style.css           interface styles (logical properties, so RTL mirrors for free)
src/main.js             renderer, camera, controls, interactions, game loop
src/world.js            analytic lunar terrain, terrain mesh, every building and prop
src/entities.js         astronaut, crew bots + A* -free BFS navigation, rover physics, collision
src/sim.js              clock, meters, situation director, journal, saving
src/activities.js       the six interaction types and the reflection step
src/ui.js               HUD, world labels, dialogs, journal, guide, settings, minimap, input
src/data.js             language-neutral world data: stations, crew, graph, cards, situations
src/scenarios.js        numbers and correct answers for every situation
src/i18n.js             tiny locale loader with English fallback
src/lang/en.js          English strings
src/lang/ar.js          Arabic strings (identical key set)
src/audio.js            synthesised sound effects (WebAudio, no files)
vendor/three.module.min.js   Three.js r160 (MIT, licence included)
tests/check-content.mjs content test: locale parity + scenario/structure consistency
server.mjs              zero-dependency static server
```

### Changing content

* Text lives only in `src/lang/*.js`; the same keys must exist in both files.
* Numbers, correct answers and limits live in `src/scenarios.js`.
* Stations, crew, the navigation graph, journal cards and timeline values live in `src/data.js`.

Run the check after editing:

```bash
npm test
```

It verifies that every locale key exists in both languages, that every situation has its strings, that option counts and correct-answer indices line up, that the solar puzzle is solvable, that the budget has room to choose, and that the schedule puzzle starts from a real puzzle.

## Sources and honesty notes

* The design brief came from a shared Drive folder containing the **Luna Academy System Design and Learning Blueprint**, the **Luna Academy GDD v0.2**, **Moon Colony Field Guide**, **Crew Bot Specification**, **Simulation and Incident Rules**, **Learning Curriculum Matrix**, **Optional Incident Catalogue**, and two older prototypes (`moon-colony-project` and a three.js *Moon Base Academy* quiz game). That material is the intellectual basis for the crew, tone, meters, incidents and learning loop. It is not redistributed here.
* Drive was unreachable from the sandbox used to build this, so the documents and the prototypes' source were read through two public read-only proxies (`allorigins.hexlet.app`, `wsrv.nl`); four concept images were seen only as 200-pixel thumbnails. Where the older quiz conflicted with the GDD (fail screen, score ranks, age bands), the GDD won.
* Unverifiable late-2026 programme claims in the Field Guide (for example an Artemis II already flown, an Artemis III crew, a “PROMISE” rover) were deliberately left out. Only well-established facts are used: Apollo 17 in 1972, the Artemis II crew names, and the south-pole sunlight-and-ice rationale.
* This is a fan-made educational game. It is not a NASA product, not a training tool, and not a simulation of real mission procedure.

## Licence

* Code: **MIT** (see `LICENSE`). Do what you like, keep the notice.
* Written content (the colony, the crew, the situations and the guide): **CC BY 4.0** — reuse and adapt with credit.
* Three.js is MIT-licensed; its notice is in `vendor/THREE-LICENSE.txt`.

---

## بالعربية

**مَدَار — فريق القمر** لعبة تعليمية ثلاثية الأبعاد تعمل في المتصفح، للاعب واحد. أنت المتدرّب الجديد في محطة مَدَار قرب القطب الجنوبي للقمر: تمشَّ في القاعدة، تحدّث مع رفاق الطاقم الخمسة، تعرّف على اثنتي عشرة محطة، واخرج بالعربة إلى الصدع. لا وقت محدّد، ولا خسارة، ولا نقاط — أحد عشر موقفًا اختياريًا مع تلميحات وتفسير هادئ وسؤال للتفكير.

**التشغيل:** `node server.mjs` ثم افتح `http://localhost:8000` (أو استخدم أي خادم ملفات ثابت؛ فتح `index.html` مباشرة لا يعمل لأن اللعبة تستخدم وحدات ES).

**التحكم:** `W A S D` أو الأسهم للمشي، سحب الماوس للنظر، `E` للتفاعل، `R` للعربة، مسافة للقفز، `B` للوحة المواقف، `M` للدفتر، `G` للدليل، `Esc` للقائمة.

اللعبة كاملة بالعربية والإنجليزية، مع دعم كامل للكتابة من اليمين إلى اليسار، وحفظ محلي للتقدّم على هذا الجهاز فقط.
