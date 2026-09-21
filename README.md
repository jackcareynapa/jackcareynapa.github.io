# jackcareynapa.github.io

Personal portfolio site for [jackcareynapa.github.io](https://jackcareynapa.github.io).

## Local preview

Coursework is loaded via `fetch`, so open the site through a local server (not `file://`):

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Adding courses

Edit [`courses.json`](courses.json). Each entry needs:

| Field | Description |
|-------|-------------|
| `id` | Course code (e.g. `COMPSCI 201`) |
| `name` | Course title |
| `institution` | School name |
| `description` | Short summary |
| `status` | `"done"` or `"wip"` |
| `url` | Syllabus link (must start with `https://`) |

Rows render into the coursework index automatically on page load — no HTML changes needed.
Running numbers are generated from array position, so reordering the file reorders the index.

## File layout

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `styles.css` | Design tokens and layout |
| `ui.js` | Nav, scroll reveal, course renderer |
| `courses.json` | Coursework data |

## The print system

The page is set as a two-ink job on toned stock. Three things carry that: the
palette, the halftone screens, and the misregistration plates.

### Inks

Measured against the *rendered* sheet (nominal `--paper` darkened by the grain layer):

| Token | Hex | Contrast on sheet | Use |
|-------|-----|------------------|-----|
| `--ink` | `#181A17` | 11.92:1 | Body copy, rules, panel borders |
| `--spot` | `#2440C4` | 5.48:1 | Links, labels, focus rings |
| `--ink-soft` | `#5A594F` | 4.80:1 | Secondary copy, meta rows |
| `--graphic` | `#FF4FA3` | **2.18:1** | Screens only — **never** carries a word |

`--ink-soft` clears AA with about 0.3 of headroom. It is the tightest token on the
page, so darkening the stock or the grain any further will break it.

### Halftone screens

A screen is a **standalone empty element**, never a wrapper around copy:

```html
<div class="screen screen-dots splash-screen" aria-hidden="true"></div>
```

`.screen` sets position, blend and density; `.screen-dots` or `.screen-lines` sets the
pattern. Geometry comes from four custom properties — `--p` (pitch), `--r` (dot radius),
`--d` (density), `--sc` (ink) — so a new screen is a placement, not a new gradient.

Dots are **two** `radial-gradient` layers offset by half a pitch. That staggered lattice
is what makes them read as Ben-Day rather than as a square grid of circles; a single
`repeating-radial-gradient` was what the previous version used and it rendered as a flat
pink wash.

Every host element needs `position: relative; z-index: 0` — the screen sits at
`z-index: -1`, which lands it above the host's background and below its content, and
confines the `multiply` blend to that host.

**The hard rule: a screen never sits behind running text.** It backs display type, ghost
numerals, empty fields and panel edges. Where a control or a strip has to cross a screen,
it is given an opaque background so the dots stop at its edge — see `.btn-outline` and
`.splash-stack`. Below 560px every screen steps down to fine dots at the softest density,
because a pitch that reads as tone on a desk reads as interference in the hand.

Both `prefers-reduced-motion: reduce` and `prefers-contrast: more` are handled: the first
prints the screens immediately at their density instead of fading them in, the second
removes every screen and plate and leaves flat black on stock.

### Misregistration

`.reg` prints display type three times — pink plate, blue plate, black pass — offset by
`--reg`, which is in `em` so the slip scales with the type.

```html
<span class="reg" data-text="Jack">Jack</span>
```

The `data-text` value **must** match the element's text. The plates are pseudo-elements
so they stay out of copy and paste, but generated content is still announced, so the rule
uses `content: attr(data-text) / ""` to hand the accessibility tree an empty string. Drop
the `/ ""` and the cover announces as "Jack Jack Jack Carey Carey Carey". A line break
needs its own `.reg` span per line, or the plates wrap differently from the ink pass.
