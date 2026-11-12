# Luna-Quest-V1

A walkable Moon base built in **Godot 4.3** (GDScript only, no addons, no imported models).
You land on the **Shackleton rim**, walk out to the airlock, **step inside the habitat**, read the
**daily task board**, and then go do the work — on the surface or at a bench — while spending
**your own energy**. The base has its own electricity, and it is deliberately **not** the same number.

> This folder is a complete, self-contained Godot project. It sits next to the browser build
> (the repository root) and shares its recorded crew voices.

---

## Open it

1. Install **Godot 4.3 or newer** (standard build, not the .NET one — there is no C# here).
2. Launch Godot, choose **Import**, and pick `Luna-Quest-V1/project.godot`.
3. Press **F5** (Run Project).

Nothing else is required: every mesh is generated in code at startup, the voice clips and fonts are
in the project, and the only scene file is `scenes/main.tscn`, which is just an empty `Node3D` with
`src/main.gd` attached to it. If the project was zipped through a service that drops `.gd` or `.tscn`
files, make sure those two survive the trip.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | walk (camera-relative) |
| `Shift` | run — costs more suit energy |
| `Space` | hop (1.6 m·s⁻² gravity, so you hang for a while) |
| `E` | use what the prompt is offering |
| `V` | first / third person |
| `L` | English ⇄ العربية |
| `Tab` | free the mouse (click to capture it again) |
| `1`–`4` | accept a task while the board is open |
| `Esc` | close the board |
| `Q` / `R` | turn without the mouse |
| `W` / `S` | throttle, **in the rover**; `A` / `D` steer, `E` get out |

## Two energies — this is the design

| | **Your energy** | **Base power** |
| --- | --- | --- |
| What it is | your body and suit | the habitat's electricity |
| Units | 0–100 stamina | kW and kWh |
| Goes down when | you accept and do a task, walk, run, hop | the sun goes down, loads draw more than the arrays make |
| Comes back from | food in the galley (+22, three meals a sol), sleeping (+100), one shared meal task (+14) | sunlight on the 30 kW array, 120 kWh battery |
| What it gates | which tasks you can physically finish today | the lab and the greenhouse, when the battery falls under 5 % |
| Shown as | green bar, top left, "YOUR ENERGY" | blue bar under it, "BASE POWER" |

A task **never** costs base electricity and base electricity **never** refills you. They meet in one
place only: when the battery is low the habitat **sheds** the lab and greenhouse loads, so a lab task
is refused until the sun returns — an *operational limit*, not a currency. The power panel on the
habitat wall says so in as many words.

## A sol

1. Wake up at 06:00 with 100 energy and three meals.
2. Read the board in HAB-1 (or press `E` at it). Four tasks a sol, drawn from fourteen.
3. Accept what you can actually finish: every task lists its **energy cost**, **minutes**, **data**
   reward and **where** it happens.
4. Go there — a beacon marks the spot — and press `E`. The work is done, the energy comes out of you,
   and the clock moves.
5. Eat in the galley if you are running dry. `E` at a sleep pod ends the sol, restores you and shows
   a short report.
6. The base keeps its own books meanwhile: the sun climbs to 52°, the array output rises and falls,
   the battery charges and drains. Sleep is safe; the loads are already handled.

A sol is compressed: **two game minutes per real second**, so a full day is about 12 real minutes.

## The fourteen tasks

| Task | Where | Energy | Minutes | Data | Skill |
| --- | --- | ---: | ---: | ---: | --- |
| Torque the antenna mast | comms mast | 14 | 25 | 8 | engineering |
| Bring in a soil sample | scoop site, 50 m | 18 | 30 | 12 | geology |
| Survey the crater transect | crater rim, 55 m | 32 | 45 | 18 | geology |
| Brush the dust off the arrays | solar field | 12 | 20 | 4 | maintenance |
| Place the survey stakes | stake lane | 22 | 35 | 10 | navigation |
| Sieve and log the grains | lab bench | 9 | 35 | 14 | analysis |
| Bake the sample dry | lab bench | 8 | 40 | 22 | chemistry |
| Run three spectra | lab bench | 10 | 30 | 20 | analysis |
| Download the rover log | lab bench | 7 | 25 | 12 | engineering |
| Water the greenhouse trays | greenhouse | 10 | 25 | 9 | botany |
| Radio check with Earth | comms desk | 5 | 15 | 7 | comms |
| Count the spares bin | spares bin | 8 | 30 | 11 | logistics |
| Teach the drill sequence | lab bench | 6 | 20 | 6 | crew |
| Cook and eat with the crew | galley table | 4 | 20 | 5 | crew (+14 back) |

Long EVA tasks cost the most; bench work costs little but needs the lab powered. A full board is
usually 40–60 energy, so the question every morning is *which* four, not *whether*.

## What is where

**Outside:** HAB-1 with a lit airlock porch and regolith berms, a six-panel solar field, the
power/ECLSS module with radiators, a glass greenhouse dome with pink grow light, the workshop, a
9 m comms mast, landing pad A with a flag, the rover, and a 400 m graded regolith sheet with craters
and rubble. Five NPCs: Maya at the door, Amina at the greenhouse, Leo at the rover bay.

**Inside HAB-1:** a task board that tracks the sol, a base power panel, the galley (table, counter,
food locker), the lab bench (microscope, 120 °C sample oven, monitor), two sleep pods, the comms desk,
the spares stack — and Sofia and Omar, who turn to look at you when you come close.

**Crew speak.** Every NPC carries a recorded line, reusing the 55 clips in `audio/voice/` from the
browser build — `crew.<name>.greet`, `talk.<name>.*`, `bark.*` — played with a subtitle and a short
delay so the room does not talk over itself. Recorded lines are English; the interface is bilingual.

## Arabic and fonts

Press `L`. All interface strings live in `src/i18n.gd` with `en` and `ar` columns, and the Arabic face
is bundled (`fonts/noto-sans-arabic.woff`, with the latin subset and the engine font as fallbacks) so
the text is shaped properly instead of showing boxes. Crew names and recorded lines stay in English.

## Files

```
Luna-Quest-V1/
  project.godot        input map, 1280x720, 1.62 m/s^2 gravity, Forward+
  scenes/main.tscn     a Node3D with src/main.gd — everything else is built at runtime
  src/main.gd          game root: clock, both energy budgets, interactions, language
  src/player.gd        CharacterBody3D, low-g walk, stamina drain, camera, spot focus
  src/world.gd         terrain, outpost, craters, rover bay, interaction beacons
  src/interior.gd      the walkable habitat: board, galley, lab, pods, airlock
  src/build.gd         mesh factory (terrain surface tool, primitives, astronaut)
  src/tasks.gd         the fourteen tasks, the daily offer, costs and locations
  src/hud.gd           both energy bars, prompts, subtitles, task board, day report
  src/npc.gd           crew bodies, idle motion, turning to face you
  src/rover.gd         kinematic LRV: terrain-following, 18 km/h, steep-grade warning
  src/voice.gd         recorded-clip player + captions from audio/voice/pack.json
  src/i18n.gd          English/Arabic strings
  fonts/               Noto Sans Arabic + latin subset (SIL OFL)
  audio/voice/         55 MP3 clips + pack.json (same pack as the browser build)
```

## Numbers that are real

Surface gravity 1.62 m·s⁻²; rover top speed 5 m/s (18 km/h) with 81.8 cm wheels, the Apollo LRV
figures; airlock pressure 101.3 kPa with 21 % oxygen; one-way light time to Earth ~1.3 s; Shackleton's
21 km diameter and sunlit rim; array sized so a 12 h lunar night is exactly covered by the battery.
Where a real design would not fit a 12-minute sol, the game says so in the comment next to the number.

## Honest note

This project was authored and statically checked here (`gdlint` and `gdparse` are clean on all eleven
scripts), but **Godot cannot be launched in this environment**, so the first real run happens on your
machine. If the console prints an error on startup, the line number points at a script that is small
and readable on purpose — send it over and it is a one-line fix. Gameplay numbers live at the top of
`src/main.gd` (energy, power, clock) and in `src/tasks.gd` (the board), so they can be tuned without
touching anything else.
