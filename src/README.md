# Build pipeline

Four steps, in order. Python 3 standard library only — no third-party packages, no virtualenv.
On Windows the interpreter is `python`, not `python3`.

```bash
python src/harvest_strikes.py     # ~440 monthly requests -> .cache/YYYY-MM.json (~25-60 min, resumable)
python src/fetch_traffic.py       # one request           -> .cache/traffic.json
python src/build_payload.py       # .cache/ -> src/payload.json
python src/inject.py              # payload + template + js*.js -> ../index.html
python src/verify.py              # prints the checkpoint table for REBUILD.md
```

`inject.py` finishes by running `catalog/tools/wrap_for_pages.py` and `add_catalog_link.py` on the
output. Do not skip it and splice by hand — that is how a rebuild silently drops the doctype and the
breadcrumb back to the catalog.

## What is where

| file | what it does |
|---|---|
| `harvest_strikes.py` | pulls the FAA public strike export a month at a time; one checkpoint file per month, so an interrupted run resumes and re-running is free |
| `fetch_traffic.py` | World Bank / ICAO US air-carrier departures, the denominator for the rate series |
| `build_payload.py` | collapses ~300k records into the aggregates the page draws; this is where every definition of "damage", "identified" and "air carrier" lives |
| `template.html` | page structure and all CSS, with `__PAYLOAD__` as the only placeholder |
| `js1.js` … `js7.js` | one file per section, concatenated in numeric order by `inject.py` |
| `verify.py` | prints the REBUILD.md checkpoint table from the built payload |

`.cache/` holds the harvest — about 380 MB of refetchable JSON. The generated `.gitignore` already
excludes it, which is why the harvest lives there and not in a `raw/` directory of its own.

## Editing the page

`js*.js` are separate `<script>` blocks but share one global lexical scope, so a `const` declared in
`js2.js` collides with the same name in `js4.js`. Keep names distinct.

Canvas colours are read from CSS custom properties at draw time (`cv("--c-dmg")`), and every drawing
function registers itself in `DRAWERS` so the theme toggle and the resize handler can repaint. A canvas
that hard-codes a colour will look wrong in one of the two themes and nothing will warn you.

Anything from the FAA that reaches `innerHTML` goes through `esc()` — species names and filers' remarks
are free text.
