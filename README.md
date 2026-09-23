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
| `index.html` | Page structure and the inline SVG illustrations |
| `styles.css` | Design tokens, layout, responsive rules |
| `ui.js` | Course renderer |
| `courses.json` | Coursework data |

## Design system

An editorial sheet with a quiet surreal streak: cream stock, navy ink, one brick-red
accent, and dusty-blue illustrations of concrete architecture, sea and sky. Hairline
rules, no radius, no drop shadows. The one offset is the brick plate behind a
button, and it only appears as hover and press feedback.

### Colour

| Token | Hex | Contrast on paper | Use |
|-------|-----|------------------|-----|
| `--paper` | `#F1ECE2` | — | The stock |
| `--ink` | `#1B2130` | 13.65:1 | Type, rules, borders |
| `--ink-soft` | `#4A5262` | 6.67:1 | Meta rows, labels |
| `--brick` | `#A9412A` | 5.13:1 | Links, code tags, focus ring, the full stops |
| `--sky` | `#9DB4C9` | — | Behind the art while it loads; illustration only |

Brick is the only colour that marks a link. Rules come in three weights: `--line`
(section and header rules), `--line-card` (card frames) and `--line-soft` (list rows).

### Type

| Family | Role |
|--------|------|
| Anton | Display: the hero statement, card titles, "Let's connect" |
| Oswald | Wide-tracked labels: nav, section heads, buttons, links, course names |
| IBM Plex Mono | Body copy and marginalia |

The hero statement is sized in container units (`cqi`) against its own column, so its
longest word always fits. Headlines end in a round brick dot (`.dot`) instead of a
typed full stop; `.nowrap` keeps it on the same line as the last word.

### Illustrations

Inline SVG, `aria-hidden`, and original to this site: an aqueduct whose walkway is the
tape pulled out of a floating cassette (hero); a corridor of doorways with a red line
running through them to the horizon (Wikinaut, one link after another); a window onto
vineyard rows, drawn as dotted lines of vines (Napa Valley Vineyard); a staircase that climbs into a cloud with no
building at the top (Serverless Meme Generator). A halftone eye tile and a cassette
side-label (`.deck`) sit in the margins of the work grid at wide widths.

Every `.art` container gets a stronger grain tile laid over it (`--grain-art`,
`mix-blend-mode: multiply`) so the flat fills read as print. The page itself carries a
faint grain baked into `--stock`. Both come off under `prefers-contrast: more`.

Card art uses `preserveAspectRatio="xMidYMid slice"`, so each scene keeps its subject
in the middle of the frame: at wide widths the art sits beside the copy and gets
cropped at the sides; below 1180px it sits above the copy at 4:3.

### Marginalia

`.note` sets small stacked words with a short rule, like notes on a proof: in the
hero's left margin, over the art, under the halftone tile. They are decoration and are
hidden from assistive tech, except for the Duke / Durham note, which is real
information.

### Motion

| Motion | Trigger | Timing |
|--------|---------|--------|
| The hero scene develops in (opacity + slight scale) | Once, on load (CSS) | 500ms |
| Project cards and the resume card rise in (opacity + 14px) | Once each, as they scroll into view (`ui.js` adds `.reveal`, then `.is-in`) | 450ms |
| Button face fills navy; its brick plate slips 4px out of register | Hover, pointer devices only | 180ms |
| Button sinks 3px onto its plate; links press down 1px | `:active` | 150ms |
| Card frame darkens and its art settles in 2% | Card hover (pointer) or a focused link inside it | 250ms |
| Arrows nudge right; links turn navy | Hover, pointer devices only | 180ms |

Only `transform` and `opacity` move. Nothing loops and nothing is tied to scroll
position. The reveal hides only panels still below the fold at load, so nothing on
screen blinks out, and with no script every panel is simply there. Under
`prefers-reduced-motion: reduce` there is no develop, no reveal and no press travel;
colour changes stay.
