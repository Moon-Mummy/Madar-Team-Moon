# Artwork

Everything here is optional. If a file is missing the interface falls back to a flat panel, so the
game never shows a broken image.

| File | Used on |
| --- | --- |
| `hero.jpg` | Start screen background, the power situation banner, and the "real Moon" guide chapter |
| `moon.jpg` | The "Moon" chapter of the field guide |
| `crew.jpg` | The "Your day" guide chapter |
| `greenhouse.jpg` | The water and greenhouse situations, and the "water and food" chapter |
| `rover.jpg` | The rover situation, and the "places" chapter |
| `ice.jpg` | The sample situation, and the "what makes the Moon hard" chapter |

## Using your own images

Drop a replacement in this folder with the same file name and reload — no code change needed.
16:9 landscape JPGs work best (`hero.jpg` is 1672×941; the rest are 1536×1024). `moon.jpg` looks
best square.

The current set was generated for this project with an image model: a south-pole outpost at low sun,
a full-Moon disc, a six-wheel rover, a hydroponic greenhouse, a shadowed icy crater, and the crew.
They are released with the game under CC BY 4.0 (see `../LICENSE`).

## voice/ — the recorded voice pack

`voice/pack.json` maps a line key to a file, and 55 short mp3s sit beside it:

| Key pattern | Who speaks |
| --- | --- |
| `crew.<id>.greet` | that crew member's first line when you talk to them |
| `bark.<id>.0..2` | the small talk they say as you walk past |
| `talk.<id>.<topic>` | their answers in the talk sheet |
| `inc.<id>.npc` | the short brief at the start of each situation |
| `player.*` | the cadet's own callouts ("Sample loaded", "Let's go") |

Everything is English. In Arabic the game uses the browser's speech engine, and the subtitles always
carry the words, so nothing is lost when a device has no voice at all.

To replace a line, drop an mp3 with the same filename next to `pack.json`. To add a line, add it to
`pack.json` with `{ "file": "your-file.mp3", "text": "what it says" }` and pass the same key to
`say(who, text, { key })`.
