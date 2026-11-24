#!/usr/bin/env python3
"""Build the Listening Station as plain static files.

Reads content/*.json and writes:
  assets/content.js                  all content, for the app
  index.html                         the room: four tapes in their cases, the deck empty
  <tape>/index.html                  that tape playing, track 1 on the display
  <tape>/<chapter>/index.html        that tape playing at that track
  text/index.html                    the whole site as one accessible plain document
  404.html                           unknown paths fall back to the station

Every generated page carries its own title, description, canonical URL, social
tags and a <noscript> copy of its content, so direct links work on any static
host (GitHub Pages, Cloudflare Pages, Netlify) and stay readable without JS.
Run:  python3 tools/build.py
"""
import html
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
TAPE_FILES = ["about", "projects", "resume", "contact"]
BLOCK_TYPES = {"kicker", "h", "p", "list", "steps", "meta", "diagram", "plate", "actions", "entries",
               "courses", "placeholder", "email", "links", "note", "credit", "lies", "log"}
SAFE_HREF = re.compile(r"^(https://|mailto:|@pdf|@text)")


def load():
    site = json.loads((CONTENT / "site.json").read_text())
    tapes = json.loads((CONTENT / "tapes.json").read_text())
    sections = {t: json.loads((CONTENT / f"{t}.json").read_text()) for t in TAPE_FILES}
    validate(site, tapes, sections)
    return site, tapes, sections


def validate(site, tapes, sections):
    errors = []
    ids = [t["id"] for t in tapes]
    if ids != TAPE_FILES:
        errors.append(f"tapes.json order/ids must be {TAPE_FILES}, got {ids}")
    for link in site["links"]:
        if not link["url"].startswith("https://"):
            errors.append(f"site link must be https: {link['url']}")
    for tid, sec in sections.items():
        slugs = [c["slug"] for c in sec["chapters"]]
        if len(slugs) != len(set(slugs)):
            errors.append(f"{tid}: duplicate chapter slugs")
        for c in sec["chapters"]:
            if not re.fullmatch(r"[a-z0-9-]+", c["slug"]):
                errors.append(f"{tid}/{c['slug']}: bad slug")
            if not c.get("pages"):
                errors.append(f"{tid}/{c['slug']}: no pages")
            for p in c.get("pages", []):
                for b in p["blocks"]:
                    if b["t"] not in BLOCK_TYPES:
                        errors.append(f"{tid}/{c['slug']}: unknown block {b['t']}")
                    for a in b.get("items", []) if b["t"] == "actions" else []:
                        if not SAFE_HREF.match(a["href"]):
                            errors.append(f"{tid}/{c['slug']}: unsafe href {a['href']}")
    if errors:
        sys.exit("Content errors:\n  " + "\n  ".join(errors))


def e(s):
    return html.escape(str(s), quote=True)


def resolve(href, site):
    base = site["base"]
    if href == "@pdf":
        return base + site["resumePdf"]
    if href.startswith("@text"):
        return base + "text/" + href[len("@text"):]
    return href


def ext(href):
    return ' target="_blank" rel="noopener"' if href.startswith("https://") else ""


def render_block(b, site, level=3):
    t = b["t"]
    if t == "kicker":
        return f'<p class="kicker">{e(b["text"])}</p>'
    if t == "h":
        return f"<h{level}>{e(b['text'])}</h{level}>"
    if t in ("p", "note", "credit"):
        return f'<p class="{t}">{e(b["text"])}</p>'
    if t == "placeholder":
        return f'<p class="placeholder">[Placeholder] {e(b["text"])}</p>'
    if t == "list":
        return "<ul>" + "".join(f"<li>{e(i)}</li>" for i in b["items"]) + "</ul>"
    if t == "steps":
        return "<ol>" + "".join(f"<li><strong>{e(i['title'])}.</strong> {e(i['text'])}</li>" for i in b["items"]) + "</ol>"
    if t == "lies":
        return "<ol>" + "".join(f"<li><del>{e(i['text'])}</del> {e(i['fix'])}</li>" for i in b["items"]) + "</ol>"
    if t == "meta":
        return "<dl>" + "".join(f"<dt>{e(k)}</dt><dd>{e(v)}</dd>" for k, v in b["rows"]) + "</dl>"
    if t == "diagram":
        return "<ol class=\"flow\">" + "".join(f"<li>{e(n['label'])}: {e(n['sub'])}</li>" for n in b["nodes"]) + f"</ol><p>{e(b.get('caption', ''))}</p>"
    if t == "plate":
        return f'<p class="note">{e(b.get("caption", ""))}</p>'
    if t == "actions":
        return "<p>" + " · ".join(f'<a href="{e(resolve(a["href"], site))}"{ext(resolve(a["href"], site))}>{e(a["label"])}</a>' for a in b["items"]) + "</p>"
    if t == "entries":
        out = ""
        for i in b["items"]:
            out += f"<h{level + 1}>{e(i['title'])}, {e(i['org'])}</h{level + 1}><p>{e(i['where'])} · {e(i['when'])}</p><ul>" + "".join(f"<li>{e(x)}</li>" for x in i["bullets"]) + "</ul>"
        return out
    if t == "courses":
        return "<ul>" + "".join(f"<li>{e(c[0])}: {e(c[1])} ({e(c[2])})</li>" for c in b["items"]) + "</ul>"
    if t == "log":
        return "<ul>" + "".join(f'<li><a href="{e(site["base"] + i["track"] + "/")}">{e(i["title"])}</a>: {e(i["text"])}</li>' for i in b["items"]) + "</ul>"
    if t == "email":
        m = site["email"]
        return f'<p><a href="mailto:{e(m)}">{e(m)}</a></p>'
    if t == "links":
        return "<ul>" + "".join(f'<li><a href="{e(l["url"])}" target="_blank" rel="noopener">{e(l["label"])}: {e(l["handle"])}</a></li>' for l in site["links"]) + "</ul>"
    return ""


def render_chapter(ch, site, level=3):
    body = "".join(render_block(b, site, level + 1) for p in ch["pages"] for b in p["blocks"])
    return f"<h{level}>{e(ch['title'])}</h{level}>{body}"


def chapter_summary(ch):
    for p in ch["pages"]:
        for b in p["blocks"]:
            if b["t"] in ("p", "placeholder"):
                return b["text"]
    return ""


SHELL = (ROOT / "tools" / "shell.html").read_text()


def page(site, *, path, title, description, noscript, route_note=""):
    url = site["siteUrl"].rstrip("/") + site["base"] + path
    out = SHELL
    for k, v in {
        "TITLE": e(title), "DESCRIPTION": e(description), "CANONICAL": e(url), "BASE": e(site["base"]),
        "OG_IMAGE": e(site["siteUrl"].rstrip("/") + site["base"] + "assets/og.jpg"),
        "NOSCRIPT": noscript, "OWNER": e(site["owner"]), "ROUTE_NOTE": route_note,
    }.items():
        out = out.replace("{{" + k + "}}", v)
    return out


def write(rel, text):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def text_document(site, tapes, sections):
    parts = []
    for t in tapes:
        sec = sections[t["id"]]
        chs = "".join(f'<section id="{t["id"]}-{c["slug"]}">{render_chapter(c, site, 3)}</section>' for c in sec.get("textEdition", sec["chapters"]))
        parts.append(f'<section id="{t["id"]}"><h2>{e(t["title"])}</h2>{chs}</section>')
    nav = "".join(f'<li><a href="#{t["id"]}">{e(t["title"])}</a></li>' for t in tapes)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(site['owner'])}: plain text</title><meta name="description" content="{e(site['description'])}">
<link rel="canonical" href="{e(site['siteUrl'].rstrip('/') + site['base'] + 'text/')}"><link rel="icon" href="{e(site['base'])}assets/favicon.svg" type="image/svg+xml">
<style>:root{{color-scheme:light dark;--bg:#f3ede1;--ink:#231e1a;--soft:#5d5044;--link:#8f3a22}}
@media (prefers-color-scheme:dark){{:root{{--bg:#1d1814;--ink:#efe6d6;--soft:#bfae98;--link:#f0a77f}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 Georgia,'Times New Roman',serif}}main{{max-width:46rem;margin:0 auto;padding:2rem 1rem 4rem}}
a{{color:var(--link)}}h1{{font-size:2rem;margin:0 0 .25rem}}h2{{margin-top:3rem;border-top:1px solid var(--soft);padding-top:1rem}}.kicker,.note,.credit{{color:var(--soft);font-size:.9rem}}
.placeholder{{font-style:italic;color:var(--soft)}}dt{{font-weight:700}}dd{{margin:0 0 .5rem}}</style></head>
<body><main><h1>{e(site['owner'])}</h1><p>The plain-text edition of the <a href="{e(site['base'])}">listening station</a>. <a href="{e(site['base'] + site['resumePdf'])}">Download the résumé (PDF)</a>.</p>
<nav aria-label="Sections"><ul>{nav}</ul></nav>{''.join(parts)}</main></body></html>"""


def strip_notes(v):
    """Drop editorial keys (those starting with "_", such as _review) from what ships to visitors."""
    if isinstance(v, dict):
        return {k: strip_notes(x) for k, x in v.items() if not k.startswith("_")}
    if isinstance(v, list):
        return [strip_notes(x) for x in v]
    return v


def main():
    site, tapes, sections = load()
    bundle = strip_notes({"site": site, "tapes": tapes, "sections": sections})
    write("assets/content.js", "/* Generated by tools/build.py from content/*.json. Do not edit. */\nwindow.STATION = " + json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + ";\n")

    def nos(inner):
        return f'<div class="noscript-doc">{inner}<p><a href="{e(site["base"])}text/">Read the whole site as plain text</a></p></div>'

    # Remove previously generated tape folders so cut chapters never linger as stale pages.
    for t in tapes:
        shutil.rmtree(ROOT / t["id"], ignore_errors=True)
    count = 0
    write("index.html", page(site, path="", title=site["title"], description=site["description"],
                             noscript=nos(f"<h2>{e(site['owner'])}</h2><p>{e(site['description'])}</p>")))
    count += 1
    for t in tapes:
        chs = sections[t["id"]]["chapters"]
        first = chs[0]
        write(f"{t['id']}/index.html", page(site, path=f"{t['id']}/", title=f"{t['title']} · {site['owner']}",
                                            description=chapter_summary(first) or site["description"],
                                            noscript=nos(f"<h2>{e(t['title'])}</h2>" + render_chapter(first, site, 3))))
        count += 1
        for c in chs:
            write(f"{t['id']}/{c['slug']}/index.html", page(site, path=f"{t['id']}/{c['slug']}/",
                                                             title=f"{c['title']} · {t['title']} · {site['owner']}",
                                                             description=chapter_summary(c) or site["description"],
                                                             noscript=nos(f"<h2>{e(t['title'])}</h2>" + render_chapter(c, site, 3))))
            count += 1
    write("404.html", page(site, path="404.html", title=f"Not on any tape · {site['owner']}", description=site["description"],
                           noscript=nos("<h2>That page is not on any tape.</h2>"), route_note='<meta name="robots" content="noindex">'))
    write("text/index.html", text_document(site, tapes, sections))
    if not (ROOT / site["resumePdf"]).exists():
        sys.exit(f"missing {site['resumePdf']} at the site root")
    print(f"built {count} station pages + text/ + 404.html")


if __name__ == "__main__":
    main()
