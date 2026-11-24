# Listening Station

Jack Carey's personal site: a late-1970s silver cassette deck on a walnut desk at dusk. It is a static site with no server and no framework.

The scene is a real-time 3D room (three.js, vendored in `assets/vendor/three`), composed and lit to match the owner's dusk reference. It includes a desk lamp, rain on the window, a mug and four cassettes in their cases. Units are centimetres, and the deck is built at real scale (a cassette is 10.2 × 6.4 cm).

## How it works

1. **Pick a cassette.** Its case slides out of the stack onto the desk and opens. The tape rises out of it and drops into the deck, and the door shuts. On tall screens the four cases lie in a row in front of the deck and open where they lie.
2. **Press Play.** The Play key breathes amber while a tape waits; on touch screens a big Play button also appears.
   - The key latches and the pinch roller engages.
   - The motor comes up to speed, the reels turn and the counter rolls.
   - The tape's music starts, rising from a slow speed.
   - The amber **display** powers on over the room with that tape's content.
3. **On the display:**
   - TRK tabs, ◀◀ ▶▶, the arrow keys or a swipe change track. The deck winds, the music warbles and the display searches, then the new track types on.
   - ✕, Escape or Stop stops the tape: the pitch sinks, the reels coast and the display powers down. The tape stays in the deck; Play resumes.
   - Pause holds everything. Eject stops, returns the tape to its case, closes the case and puts it away.

The other keys and knobs are there for the feel of it:
- REC, the BIAS/EQ/NR/LIMITER knobs and the counter reset click, move and sound, but change nothing.
- The record-level knobs set the volume.
- The phones jack turns sound on and off; so does the **Sound** plate at the top left.
- The lamp switches.

Other details:
- **Look:** the key legends are printed on the key faces. The engraving is printed into the faceplate's own textures, so the metal lights it.
- **Cassettes:** the four are classic shells, each with a printed label and its title written by hand:
  - About: smoked translucent, Type I.
  - Projects: black chrome, Type II.
  - Experience: metal, Type IV.
  - Contact: white ferric with rainbow stripes.
  - Each case carries a matching printed insert; inside the lid it lists the tracks.
- **Hover:** whatever you can use glows warm under the pointer or keyboard focus.
- **Light per tape:** About is golden lamplight, Projects is blue hour, Experience is clear daylight and Contact is rose dusk.
- **Lens:** nothing on the desk is blurred. There is bloom, a colour grade, a trace of lateral colour in the far corners, a vignette and grain. Only the rain-covered window is soft, refracting the dusk view (`assets/scene/backdrop.webp`) through live drops, with lightning now and then.
- **Lo-fi preview:** add `?look=lofi` to any URL for a low-resolution, outlined, dithered look. It is a preview, not the default.

**Status: live** at https://jackcareynapa.github.io since 2026-11-24; every section was approved by the owner for launch.

## Sound

Nothing plays until the visitor's first click or key press. Sound is on by default and is remembered as `jc-station:sound3`.

- **Music** (`assets/music.js`): each tape has its own short lo-fi piece, composed in code.
  - About: warm Rhodes at 76 bpm.
  - Projects: cooler plucks at 82 bpm.
  - Experience: brighter and brushed at 88 bpm.
  - Contact: slow, with rimshots, at 70 bpm.
  - How it's made: a piece is rendered once with an `OfflineAudioContext` when its tape goes into the deck: 16 bars, a seamless loop, with tape saturation, wow and flutter and hiss. Playback is a looping buffer, so spin-up, fast-wind warble and tape-stop are its playback rate.
  - The meters on the deck and the display's level bars read the real signal.
- **Foley** (`assets/audio/foley.m4a` + `foley.json`, about 250 KB): a sprite of real recordings, all CC0 (credits in `assets/audio/CREDITS.md`).
  - Covers: keys, the play latch, the stop, the door, the case, the lift, the insert, knob ticks, the switch, the motor bed and the fast-wind whir.
  - A calibration click at 0.1 s keeps cues aligned whatever the decoder does.
  - Each hit varies a little in pitch and level.
  - Anything missing falls back to a synthesized stand-in in `app.js`.
- **Rain and the room's own music:** a quiet rain bed with a few drips, plus a slow ambient piece that plays with it whenever no tape is running (`ambient` in `music.js`). The piece is a 62 s loop: pads drifting through F maj9, A m11, D m9 and B♭ maj7♯11, a low drone and a few felt-piano notes, about 12 dB under the tapes. It fades out as a tape engages and returns a moment after Stop. The meters never move for it, and the rain steps back while a tape plays.
- **Rebuilding the foley sprite:** `tools/make_foley.py`; the steps are in `assets/audio/CREDITS.md`.

## Build

```bash
python3 tools/build.py
```

The build reads `content/*.json` and writes:

| Output | Purpose |
|---|---|
| `assets/content.js` | All content for the app (generated; do not edit) |
| `index.html` | The room: four tapes in their cases, the deck empty |
| `<tape>/<chapter>/index.html` | One page per chapter. Each has its own title, description, canonical URL, social tags and a `<noscript>` copy of the chapter |
| `<tape>/index.html` | That tape playing, track 1 |
| `text/index.html` | The whole site as one plain, accessible document (also the résumé's "conventional view") |
| `404.html` | Unknown paths fall back to the station |

The build validates the content as it runs: unique slugs, known block types, and links that must be https or mailto.

## Edit content

Each tape is one JSON file: `about.json`, `projects.json`, `resume.json`, `contact.json`. A tape holds chapters (its tracks), each chapter holds pages, and each page holds blocks. All of a chapter's pages show together on the display, one after another. Block types:

`kicker` `h` `p` `note` `credit` `placeholder` `list` `steps` `lies` `meta` `diagram` `plate` `actions` `entries` `courses` `log` `email` `links`

Links and the email address live in `site.json`. A chapter's `short` name is used on the TRK tabs and inside the case lid.

## URLs

| URL | State |
|---|---|
| `/` | No tape in the deck |
| `/?tape=projects` | That tape in the deck, stopped |
| `/projects/wikinaut/` | That tape playing at that track, the display open |

A deep link opens the display at once. The music waits for the visitor's first click or key press, as browsers require. Changes of tape, track and transport push history entries, so Back and Forward retrace them.

## Files

| File | Role |
|---|---|
| `assets/deck3d.js` | The 3D room: modelling, materials, lighting, rain and lens shaders, picking, the case/cassette flights and the spring animations. It exposes `window.STATION_VIEW` |
| `assets/app.js` | State (`S`), the interruptible mechanism (`M`), routing, the transport (cue, stop, pause, track search), the display, the foley engine, and a hidden keyboard layer that mirrors the working controls (focus outlines the real 3D part) |
| `assets/music.js` | The tapes' music |
| `assets/audio/` | The foley sprite, its offsets and its credits |
| `assets/art.js` | Project plate illustrations shown on the display |
| `assets/station.css` | The stage, the keyboard layer, and the display |
| `assets/vendor/three/` | three.js 0.170.0 (MIT) and the addons it uses: bloom, output and shader passes, rounded boxes, and the desk mirror (`Reflector`) |
| `assets/scene/backdrop.webp` | The view through the window, made from the reference by `tools/make_backdrop.py` |
| `tools/shell.html` | Page template used by the build |
| `tools/make_foley.py` | Builds the foley sprite from the source recordings |

**Performance:**
- **Resolution:** it has a pixel budget (about 2.3 MP). A governor compares the median frame time with the screen's own measured refresh rate.
  - It needs two slow seconds in a row before it lowers the resolution, and raises it at most twice.
  - It only resizes while nothing is moving, because a resize reallocates every render target.
- **Animation timing:** the springs that drive the keys and knobs run in fixed 1/240 s steps, so they stay steady through a slow frame. Tweens advance by real time, so a hitch never stretches an animation.
- **Shadows and reflection:** shadows refresh every other frame while something moves. The desk reflection refreshes every other frame when moving and every fourth when still.
- **Behind the display:** the room renders at half rate.
- **Music:** each piece is built a bar at a time as it renders, so it never blocks the page. Rendering starts when a case is picked, and the other tapes render in idle time after the first one plays. Playback costs nothing, because it is a buffer.
- **First frame:** it is drawn before the room is revealed, and rendering pauses off-screen.

**Without WebGL 2**, the page shows a still of the room with the four tapes as plain buttons. Picking one plays it straight onto the display.

## Deploy

GitHub Pages serves the repository root of `main` (`.nojekyll` turns off Jekyll). To publish a change: edit, run `python3 tools/build.py`, commit the generated files with the sources, and push `main`. The build checks that `Jack_Carey_Resume.pdf` is at the root; replace that file to update the résumé.

Any static host works the same way. The `base` field in `site.json` sets the URL prefix (`/` by default). Editorial notes in the content files (keys starting with `_`, such as `_review`) are dropped from the published bundle.
