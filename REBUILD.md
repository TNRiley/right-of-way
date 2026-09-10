# Rebuilding *Right of Way*

Enough to reproduce this page from an empty directory, a shell and no other context.

---

## 1. What is being built, and why

One self-contained HTML document about the **FAA Wildlife Strike Database** — every civil aircraft/wildlife
collision reported in the United States since 1990.

The count of reported strikes has risen roughly eightfold over that period. The page exists to show that
this is mostly an artefact of reporting, and to show it the honest way: not by adjusting the count, but by
**re-counting the same database under definitions that reporting effort cannot easily manufacture**, and
letting the reader watch the growth drain out of the series as the definition gets stricter.

Two independent controls are at work and the page deliberately does not merge them — an **exposure**
denominator and a **severity threshold**. The finding is that exposure barely helps and severity does
almost all the work. Six series, ordered by how hard each is to leave unfiled:

| series | definition | source | change, first 5 yrs → last 5 |
|---|---|---|---|
| Every report | any strike report | all rows | +687% |
| Every report ÷ departures | air-carrier reports ÷ US air-carrier departures | `AC_CLASS == A`, `AC_MASS ∈ {3,4,5}`, over World Bank `IS.AIR.DPRT` | +355% |
| Changed the flight | aborted take-off, precautionary landing, engine shutdown, diversion | `EFFECT` non-empty and ≠ `None` | +236% |
| Damaged the aircraft | damage indicated | `INDICATED_DAMAGE == "TRUE"` | +92% |
| Damaged ÷ departures | the row above, over the same denominator | as above | +49% |
| Substantial or destroyed | FAA damage level S or D | `DAMAGE_LEVEL ∈ {S, D}` | −64% **(contaminated, see §3)** |

**If the rebuild reproduces only one thing, it must be that ordering — monotone, from +687% to negative.**
The claim the page actually makes rests on the fourth row and on its corollary: damage was indicated on
**15.8%** of reports in the first five years and **3.8%** in the last five. Both come from a plain boolean
recorded the same way throughout, which is what makes them safe to lean on.

---

## 2. Data sources, with exact routes

### 2a. The strike database

The public site at `https://wildlife.faa.gov/search` is an Angular SPA. Its search form posts to a JSON
API which needs **no key and no login**:

```
POST https://wildlife.faa.gov/WildlifeAdmin/api/Service/exportPublicDatabase/
Content-Type: application/json
```

The body is the search form's own query object. Role `PUBLIC` is what an anonymous visitor's browser
sends, and it is what limits the window to 1990 onward and to processing status `3` (published):

```json
{"fromDate":"","toDate":"",
 "IncidentDateFrom":"2024-01-01T00:00:00","IncidentDateTo":"2024-01-31T00:00:00",
 "LupdateDateFrom":"1990-01-01T00:00:00","LupdateDateTo":"2030-01-01T00:00:00",
 "airCraftTypeId":"0","damageLevelId":"0","engineTypeId":0,"wildLifeId":"0",
 "airportId":"","processingStatusId":"3","strikeReportTypeId":1,
 "siIdentifiedTypeId":"","nonIndigenous":false,"role":"PUBLIC"}
```

The response is `{"Success":true,"Result":[…],"Total":n}` with **102 columns per record**. Zero matches
come back as `Success:false` with `ErrorMessage` containing `"The source contains no DataRows."` — that
is not an error, treat it as an empty month.

Quirks that will bite:

* The date column is named **`"INCIDENT_DATE "`** — with a trailing space. It is not a typo you should fix
  on read; match it exactly.
* `IncidentDateTo` is inclusive. Query month boundaries as first-of-month to last-of-month, not
  first-to-first, or boundary days are counted twice.
* Several string fields carry leading spaces (`" None"`, `" 1"`, `"A  "`). Strip before comparing.
* `INDICATED_DAMAGE` is the **string** `"TRUE"`/`"FALSE"`, not a boolean. The `STR_*`/`DAM_*`/`ING_*`
  per-part fields *are* real booleans.
* `AIRPORT_ID == "ZZZZ"` means unknown airport, and it is the single most common value. Exclude it from
  any per-airport ranking or it wins.
* `SPECIES_ID` beginning `UNK` (`UNKB`, `UNKBS`, `UNKBM`, `UNKBL`) is an unknown-bird bucket, not a taxon.
* Taxa are a mix of levels: `Gulls` (`NE1`) and `Herring gull` (`NE101`) are separate rows and are **not**
  nested. Do not sum them and do not present them as a taxonomy.
* Performance is not the constraint: a peak month (~2,200 records, ~5 MB) answers in about a second.
  Pace anyway — `harvest_strikes.py` sleeps 1.5–3.5 s between months and writes one checkpoint file per
  month so an interrupted run resumes.

There is also a downloadable Access `.mdb` (see
`GET /WildlifeAdmin/api/Service/GetSearchDatabaseFileInformation`, ~70 MB). It was deliberately not used:
parsing Access on Windows needs an ODBC driver that may not be installed, while the JSON route needs
nothing but stdlib.

**Licence:** work of the United States government, public domain.

### 2b. The denominator

```
GET https://api.worldbank.org/v2/country/USA/indicator/IS.AIR.DPRT?format=json&per_page=200
```

Registered air carrier departures for US-registered carriers, sourced from ICAO. One request, no key,
1970 onward, licensed CC-BY-4.0.

It covers scheduled carriers only — **not general aviation, not military** — so the numerator must be
restricted to match (`AC_CLASS A`, mass code 3+). The series ends at the last year ICAO has published,
which is behind the strike file; the rate line simply stops there and the ladder row states its own
window.

FAA OPSNET/ATADS (`aspm.faa.gov/opsnet/sys/Airport.asp` → `opsnet-server-x.asp`) would give true towered
movements including GA and was probed, but it is a legacy ASP form with a dozen coupled hidden fields and
no documented machine route. Not scraped, on purpose.

---

## 3. Processing decisions worth knowing

* **Two damage fields disagree; both are used.** `INDICATED_DAMAGE` is a clean boolean and drives the
  damage series. `DAMAGE_LEVEL` is graded but blank on a large share of older records, so only its `S`/`D`
  values are used, and it is **never** used as a denominator. Using `DAMAGE_LEVEL != "N"` as "damaged"
  instead would silently fold every blank into "not damaged" and bias the early years.
* **The severity grading itself drifts, and this is the trap of the build.** It is very tempting to make
  `DAMAGE_LEVEL ∈ {S,D}` the punchline, because it is the one series that falls. Do not. Among *damaging*
  strikes, `S` runs 141 in 2015 → 74 in 2016 → 46 in 2017 while `M?` (minor, uncertain) runs 199 → 344 →
  503. Blank `DAMAGE_LEVEL` is essentially absent among damaging strikes (0.0–0.1%), so this is not a
  recording gap: it is the grade being assigned differently from about 2016. A large part of the −64% is
  that. The page ships the breakdown as its own chart (section 02) and says the series cannot carry the
  argument alone.
* **Two apparently recoding-proof severity measures were tested and rejected.** Engine ingestion
  (`ING_ENG1`–`4`) looks like a physical fact no one can regrade, but it is recorded on 4–19 strikes a year
  until 2020 and then 557 in 2022 and 923 in 2024 — the field started being populated, not the birds
  started being ingested. `AOS` (hours out of service) grows ×13.8, faster than the damage series and
  almost as fast as the report count. Neither belongs in the ladder; the ingestion column was pulled from
  the species table for the same reason. If you rebuild and find a "clean" severity field, check its
  year-by-year fill rate before believing it.
* **Baselines are five-year means, not single years.** Annual counts in the early 1990s are small enough
  that one year makes a 20% difference to any ratio.
* **The final year is always partial** and is excluded from every comparison (`LAST_FULL = max(year) - 1`)
  and shaded on the main chart. Records also keep arriving for recent months, so a rebuild a month later
  will not reproduce the last year exactly. That is expected.
* **Both axes on the main chart are logarithmic**, in both index and count mode. Six series spanning
  three orders of magnitude do not share a linear axis, and on a log axis a rise and a fall of the same
  ratio are the same distance.
* **The species scatter is cut at 30+ strikes.** Below that a damage rate is one or two events.
* The payload ships **aggregates only** — year series, species, top-900 airports, altitude bins, source
  composition, damage-grade composition, plus a dozen-odd individual reports. Inlined uncompressed:
  GitHub Pages
  gzips the document anyway, so hand-compressing to base64 would buy nothing and cost a
  `DecompressionStream` dependency.

---

## 4. The page

Editorial data-essay layout, 900px column, warm paper palette (`--paper #EDE9E1`), Fraunces display with
an italic accent word in the title, Archivo body, IBM Plex Mono for every figure and for the letterspaced
section rules. Full light/dark with an explicit toggle; **all canvas colours are read from CSS custom
properties at draw time**, and the theme toggle re-runs every registered drawer — do not hard-code a
colour into a canvas call.

Eight sections: the six-series chart with lens toggles and an index/count switch; the threshold ladder
with sparklines, followed immediately by the damage-grade audit that discredits its bottom row;
reporting-source composition and identification rate; the species hazard scatter plus a sortable table;
the costliest and every fatal strike in full, with the filer's remarks; altitude and phase-of-flight bars;
airport lookup; methods.

The two per-departure series are drawn **dashed in their numerator's own colour** — they are the same
count divided by something, not a different count — and `--c-sub` is a violet rather than a third red so
the strictest series is unmistakable. Airport codes in the file are ICAO (`KDFW`, `PANC`) but people type
IATA, so the lookup tries the code as given, then as a 3-letter suffix, before falling back to the name.

Every number that appears in prose is computed from the payload at runtime, not typed. A rebuild on newer
data cannot leave a stale figure in a caption.

---

## 5. Verification

Run `src/harvest_strikes.py`, then `src/fetch_traffic.py`, then `src/build_payload.py`, then
`src/inject.py`. The harvest lands in `.cache/`, one file per month, and is not committed. Check against these. Figures move slightly as the FAA publishes more back-filed records;
anything off by more than a percent or two means a parsing error, not a data update.

<!-- VERIFY -->

| check | expected |
|---|---|
| records in file | `354,874` |
| years covered | `1990-2026 (2026 partial)` |
| reports, first full year | `2,122 in 1990` |
| reports, 2025 | `24,459` |
| every report, 5-yr mean, first -> last | `2,524 -> 19,863` |
| damaged, 5-yr mean, first -> last | `399 -> 764` |
| substantial or destroyed, 5-yr mean, first -> last | `127 -> 46` |
| per million departures, first -> last available | `258.3 -> 1175.6` |
| strikes that damaged the aircraft, all years | `22,224 (6.3%)` |
| human fatalities in file | `52` |
| reported repairs, inflation-adjusted | `$1,171M` |
| distinct taxa named | `967` |
| airports with at least one report | `2,796` |
| records coded as outside the US | `5,383` |
| Mourning dove: strikes / % damaging / substantial | `18,546 / 1.8% / 61` |
| Gulls: strikes / % damaging / substantial | `7,717 / 15.2% / 281` |
| Canada goose: strikes / % damaging / substantial | `2,334 / 45.8% / 284` |
| White-tailed deer: strikes / % damaging / substantial | `1,402 / 81.7% / 433` |
| Bald eagle: strikes / % damaging / substantial | `624 / 34.8% / 39` |
| share of height-reporting strikes below 500 ft | `67.4%` |
| most-reported airport | `KDEN DENVER INTL AIRPORT, 11,912 reports` |
| costliest strike in file | `2026-01-28 CINCINNATI/NORTHERN KENTUCKY INTL ARPT, Canada goose, level S, $60.0M` |

The best single checkpoint is the incident log, which is built by cost and by fatalities and so should
contain **15 January 2009, La Guardia, Canada goose, damage level D (destroyed)** — US Airways 1549, the
Hudson River ditching. It is the second-costliest strike in the file at about $54M and it must be there.
If it is missing or misdated, the date field or the cost field is being parsed wrong.

The other cheap check is the shape of the ladder: the six changes must come out **monotone decreasing**
(+687%, +355%, +236%, +92%, +49%, −64%). A row out of order means a definition has been mis-implemented,
most likely `INDICATED_DAMAGE` compared as a boolean rather than the string `"TRUE"`.

---

## 6. What the page must say about itself

It must state, in the methods panel and not only in a footnote:

* that a strike count is a count of *forms*, and reporting is voluntary for civil operators;
* that it cannot say whether collisions rose, only that severe ones did not rise anything like as fast;
* that species cannot be compared across decades, because identification improved mid-period;
* that airports **cannot** be ranked by risk from this file — a high count usually means an attentive
  wildlife programme, and per-airport exposure is not in the data;
* that military aviation reports separately and is absent;
* that a small share of records are coded as having happened outside the United States and are left in.

The trap to write down for anyone rebuilding: **it is tempting to "correct" the count for reporting
effort.** There is no defensible correction factor here — reporting effort is not measured, only its
consequences are. Re-counting under a harder threshold is weaker as a statistic and much stronger as an
argument, because it needs no model of the thing it is controlling for.
