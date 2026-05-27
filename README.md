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

Cards render automatically on page load — no HTML changes needed.

## File layout

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `styles.css` | Design tokens and layout |
| `ui.js` | Nav, scroll reveal, course renderer |
| `cube-floor.js` | Canvas background animation |
| `courses.json` | Coursework data |
