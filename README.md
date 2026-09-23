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
| `index.html` | Page structure and the two inline SVG plates |
| `styles.css` | Design tokens, layout, illustration inks |
| `ui.js` | Scroll spy, course renderer, the one-shot halftone resolve |
| `courses.json` | Coursework data |

## The print system

The page is set as an illustrated field manual: black ink and putty hardware on warm
stock, with one phosphor ink and one signal ink. The comic foundation — halftone
screens, misregistered display type, hard shadows, the speech bubble — carries over.

### Inks

| Token | Hex | Contrast on paper | Use |
|-------|-----|------------------|-----|
| `--paper` | `#E5DECD` | — | The stock |
| `--ink` | `#1B1A17` | 12.98:1 | Body copy, rules, borders |
| `--ink-soft` | `#57534A` | 5.71:1 | Secondary copy — **paper only** (3.76:1 on putty) |
| `--putty` | `#BDB5A2` | — | Hardware bodies; takes `--ink` text at 8.53:1 |
| `--signal` | `#A8321B` | 4.99:1 | Links, labels, focus rings, lamps |
| `--phosphor` | `#E09A2B` | **1.77:1** | Screen light and every dot — **never** carries a word |

`--signal` carries words, `--phosphor` carries light and dots, and neither does both.

### Paper grain

The grain is part of the stock, not an overlay: `--stock` is a faint
`feTurbulence` tile (alpha baked in) layered over `--paper`. Every opaque surface —
body, header, panels, caption, bubble, footer — sets `background: var(--stock)`, so
nothing punches a flat hole in the sheet and nothing sits between the reader and the
type. Under `prefers-contrast: more` the stock goes flat.

### Type scale

| Token | Size | Carries |
|-------|------|---------|
| `--fs-label` | 0.72rem | All mono furniture: labels, meta, credits, nav, buttons, footer |
| `--fs-small` | 0.86rem | Course descriptions |
| `--fs-body` | 0.95rem | Body copy |
| `--fs-lead` | 1rem | The splash description, course names |

0.72rem is a floor: below it IBM Plex Mono's strokes thin out enough that `--ink-soft`
renders well under its specified contrast.

### Halftone screens

Three screens, three jobs:

| Screen | Where |
|--------|-------|
| Fine dots | Paper tone — the caption's head band, the index margin |
| Coarse dots | Behind a focal visual only — the sun outside the CRT, the Wikinaut planet |
| Line screen (ink) | Shadows cast by hardware — under the CRT, behind the cartridges, the resume band |

A CSS screen is a **standalone empty element**, never a wrapper around copy:

```html
<div class="screen screen-dots index-screen" aria-hidden="true"></div>
```

`.screen` sets position, blend and density; `.screen-dots` or `.screen-lines` sets the
pattern; `.screen-ink` switches it to the black pass. Geometry comes from `--p`
(pitch), `--r` (dot radius), `--d` (density) and `--sc` (ink). Dots are two offset
`radial-gradient` layers so the lattice is staggered like a real screen. Every host
needs `position: relative; z-index: 0`.

**The hard rule: a screen never sits behind running text.** Below 560px every CSS
screen steps down to fine dots at the softest density.

### Plates

The illustrations are inline SVG, `aria-hidden`, coloured by classes (`.i-ink`,
`.i-putty`, `.i-phosphor`, …) so the palette has one source. Only two places get an
idea of their own:

- **Cover** — the CRT is a window, not a display: the sun and horizon on its screen
  carry on outside the housing, solid light behind the glass, printed dots on paper.
- **Wikinaut** — one link underline leaves the article and becomes the flight path.

The secondary projects are **cartridges**: putty shell, notched corner, grip spine,
paper label, line-screen shadow. No illustration. Dot-filled SVG parts carry
`.art-screen` and are removed under `prefers-contrast: more`.

### Misregistration

`.reg` prints display type three times — phosphor plate, signal plate, black pass —
offset by `--reg`, which is in `em` so the slip scales with the type.

```html
<span class="reg" data-text="Jack">Jack</span>
```

The `data-text` value **must** match the element's text. The plates use
`content: attr(data-text) / ""` so the accessibility tree gets an empty string; drop
the `/ ""` and the cover announces as "Jack Jack Jack Carey Carey Carey". A line break
needs its own `.reg` span per line.

### Motion

Everything is one-time and local, and only `transform` / `opacity` move:

| Motion | Trigger |
|--------|---------|
| CRT power-on — the picture opens out of a scan line | Once, on load (CSS) |
| Wikinaut planet resolves from a rough screen to its finished one | Once, first time in view (`ui.js`) |
| Key press — buttons close over their 2px shadow | `:active` |
| Colour changes on links, nav and buttons | Hover |

Nothing loops, nothing moves on scroll, and content is never hidden waiting for a
reveal. Under `prefers-reduced-motion: reduce` everything prints in its final state.
