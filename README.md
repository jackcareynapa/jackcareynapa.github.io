# jackcareynapa.github.io

Personal site for [jackcareynapa.github.io](https://jackcareynapa.github.io) — set
as a two-colour halftone print.

## The design system

Five colours, no gradients. Tokens live at the top of `styles.css`.

| Token | Value | Role |
|-------|-------|------|
| `--stock` | `#DEDAD0` | the paper |
| `--ink` | `#181A17` | black pass — body copy, rules |
| `--blue` | `#2440C4` | spot ink 1 — links, the press floor, focus rings |
| `--pink` | `#FF4FA3` | spot ink 2 — **graphic only** |
| `--fade` | `#5A594F` | secondary copy, meta rows |

**`--pink` must never carry a word.** It is 2.8:1 against the stock. Its only jobs
are the offset impression behind type (where the legible ink pass sits on top of
it), dots on the press floor, and acting as a *background* for ink-coloured type,
which measures 5.8:1 the other way round.

Type is set in Bricolage Grotesque (display), Newsreader (body), and DM Mono
(codes, meta rows, navigation).

### Tonal ramps

Section rules are halftone ramps, not hairlines. `.ramp` layers two diamond
patterns: large diamonds hold the left end and die out by 40%, small ones fade in
where the large ones stop, sit in the gaps between them, and carry the ramp out to
nothing. Each layer is a background image with its own mask gradient, which is why
they need separate pseudo-elements rather than one multi-layer background.

`.ramp-thin` is the same device at a smaller scale, used between list items. Both
are `aria-hidden` — they are rules, not content.

### Misregistration

Headlines print more than once. `.reg` renders a pink plate as a `::before`, and
`.billing .reg` adds a blue plate as an `::after`; the real text prints on top.
The offset lives in `--rx` / `--ry` **in `em`**, so a 2px slip on a project title
is a 6px slip on the cover. The plates are pseudo-elements fed by `data-text`, so
they stay out of the accessibility tree and out of copy-paste.

`ui.js` drives `--rx` / `--ry` from the pointer in the hero; everything else
registers on `:hover` in CSS. Both are frozen under `prefers-reduced-motion`.

Body copy takes the same impression on hover via `text-shadow`, which wraps with
the text and needs no extra markup.

### The halftone name

`.billing .reg-ink` fills the letterforms with the same diamond screen as the
floor — solid at the top of each line, breaking into dots towards the baseline.
The screen is sized in `em` so it stays proportional to the type; a fixed pixel
screen is far too coarse once the name shrinks on a phone.

The ink pass **must** be an inline child (`.reg-ink`), not the element's own
background. An element's background paints *below* its negative-z-index
pseudo-elements, so putting the screen there renders both spot plates on top of
the ink and the name comes out blue. A descendant's background paints after them.

The whole block is wrapped in `@supports (background-clip: text)`; without it the
name falls back to solid ink rather than disappearing.

### The press floor

`cube-floor.js` paints an isometric field of ink dots on a canvas behind the page.
`elevation` does not mean height — it means **ink coverage**, expressed as dot
size, so pushing the pointer across the sheet makes the screen gain. Coverage is
capped below the point where neighbouring dots touch; a halftone that floods to
solid stops being a halftone.

Each pass is a single path and a single `fill()`.

## Ink under type: the `.occludes` class

The ink runs *underneath* body copy rather than being knocked out of it. Elements
tagged `.occludes` hold the ink back to `UNDER_TEXT` of its normal coverage,
feathered out over `FEATHER` pixels so there is no rectangle to see. The wave
still animates under them.

Footprints are measured in **document** coordinates and cached. A scroll costs one
subtraction per rectangle and a repaint — no `getBoundingClientRect`, no layout
flush. Re-measure only when layout actually changes: resize, web fonts landing,
and after the course index renders.

The hold-back is composed on its own scratch buffer before being drawn. Painted
directly onto the sheet, two nearby text blocks would each apply their own alpha
and the overlap would wash out to bare stock; opaque rects on a scratch buffer
union instead of compounding.

## Why the resting screen is cached

`buildField()` rasterises the resting screen to an offscreen canvas once per
resize; `render()` blits it and path-draws only the disturbed tiles.

Building the full path every frame was the entire cost of the animation —
~3,600 visible diamonds is ~18,000 canvas calls, measured at 41ms per frame.
Blitting the still and drawing only what moved is 0.3ms. If you add anything to
the resting screen, put it in `buildField()`, not `render()`.

## Local preview

Coursework is loaded via `fetch`, so open the site through a local server
(not `file://`):

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Adding courses

Edit [`courses.json`](courses.json). Rows are grouped by `institution` and render
automatically — no HTML changes needed.

| Field | Description |
|-------|-------------|
| `id` | Course code (e.g. `COMPSCI 201`) |
| `name` | Course title — becomes the syllabus link when `url` is present |
| `institution` | School name; also the group heading |
| `description` | Short summary |
| `status` | `"done"` or `"wip"`. Only `"wip"` renders a marker — a badge on every finished course is noise |
| `url` | Syllabus link (must start with `https://`) |

## File layout

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `styles.css` | Tokens, type scale, misregistration, layout |
| `ui.js` | Navigation, registration drift, the course index |
| `cube-floor.js` | The press floor |
| `courses.json` | Coursework data |
| `favicon.svg` | Misregistered `JC` |
