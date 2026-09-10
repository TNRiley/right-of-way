#!/usr/bin/env python
"""
Harvest the FAA Wildlife Strike Database, month by month, from the same public
export endpoint the FAA's own search page uses.

    https://wildlife.faa.gov/search  ->  POST /WildlifeAdmin/api/Service/exportPublicDatabase/

The endpoint takes the search form's query object and returns every matching
published record as JSON. There is no key and no login; role "PUBLIC" is what an
anonymous visitor's browser sends, and it is what limits the window to 1990
onward and to processing status 3 (published).

Measured limits (2026-09-10): a one-week query returned 143 records / 325 KB, so
a peak month is ~1,700 records / ~4 MB. Whole-year queries were not attempted --
month is small enough to retry cheaply and gives a natural checkpoint. Requests
are paced 1.5-3.5 s apart; nothing here needs to be fast.

Writes one slim JSON file per month into ../.cache/ (which the generated
.gitignore already excludes -- it is ~380 MB of refetchable JSON). Re-running skips months already
on disk, so an interrupted harvest resumes. Delete a month file to refetch it.
"""
import json, os, random, sys, time, urllib.request, urllib.error
from datetime import date

API = "https://wildlife.faa.gov/WildlifeAdmin/api/Service/exportPublicDatabase/"
RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".cache")

# The 102-column export is mostly per-part strike/damage flags. These are the
# columns the page actually uses; the rest are dropped here rather than stored.
KEEP = [
    "INDX_NR", "INCIDENT_DATE ", "INCIDENT_YEAR", "INCIDENT_MONTH", "TIME_OF_DAY",
    "AIRPORT_ID", "AIRPORT", "STATE", "AIRPORT_LATITUDE", "AIRPORT_LONGITUDE",
    "OPERATOR", "AIRCRAFT", "AC_CLASS", "AC_MASS", "TYPE_ENG", "NUM_ENGS",
    "PHASE_OF_FLIGHT", "HEIGHT", "SPEED", "DISTANCE",
    "INDICATED_DAMAGE", "DAMAGE_LEVEL", "EFFECT", "AOS", "COST_REPAIRS_INFL_ADJ",
    "STR_WINDSHLD", "STR_ENG1", "STR_ENG2", "STR_ENG3", "STR_ENG4",
    "ING_ENG1", "ING_ENG2", "ING_ENG3", "ING_ENG4",
    "SPECIES_ID", "SPECIES", "SIZE", "NUM_STRUCK", "NR_INJURIES", "NR_FATALITIES",
    "REMAINS_COLLECTED", "REMAINS_SENT", "SOURCE", "REMARKS",
]


def query(d0, d1):
    """The search form's query object, as role PUBLIC sends it."""
    return {
        "fromDate": "", "toDate": "",
        "IncidentDateFrom": d0 + "T00:00:00", "IncidentDateTo": d1 + "T00:00:00",
        "LupdateDateFrom": "1990-01-01T00:00:00", "LupdateDateTo": "2030-01-01T00:00:00",
        "airCraftTypeId": "0", "damageLevelId": "0", "engineTypeId": 0,
        "wildLifeId": "0", "airportId": "", "processingStatusId": "3",
        "strikeReportTypeId": 1, "siIdentifiedTypeId": "", "nonIndigenous": False,
        "role": "PUBLIC",
    }


def post(payload, timeout=180):
    req = urllib.request.Request(
        API, data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Origin": "https://wildlife.faa.gov",
            "Referer": "https://wildlife.faa.gov/search",
            "User-Agent": "Mozilla/5.0 (compatible; quick-projects/right-of-way; +https://github.com/TNRiley/right-of-way)",
        })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def months(y0, m0, y1, m1):
    y, m = y0, m0
    while (y, m) <= (y1, m1):
        n_y, n_m = (y + 1, 1) if m == 12 else (y, m + 1)
        yield y, m, "%04d-%02d-01" % (y, m), "%04d-%02d-01" % (n_y, n_m)
        y, m = n_y, n_m


def main():
    os.makedirs(RAW, exist_ok=True)
    today = date.today()
    todo = list(months(1990, 1, today.year, today.month))
    kept = 0
    for i, (y, m, d0, nxt) in enumerate(todo, 1):
        # IncidentDateTo appears to be inclusive, so step back a day from the 1st
        # of the following month rather than risk double-counting a boundary day.
        d1 = (date.fromisoformat(nxt) - __import__("datetime").timedelta(days=1)).isoformat()
        path = os.path.join(RAW, "%04d-%02d.json" % (y, m))
        if os.path.exists(path):
            continue
        for attempt in range(5):
            try:
                r = post(query(d0, d1))
                break
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as e:
                wait = 10 * (attempt + 1)
                print("  %04d-%02d attempt %d failed (%s); sleeping %ds" % (y, m, attempt + 1, e, wait))
                time.sleep(wait)
        else:
            print("GIVING UP on %04d-%02d" % (y, m)); sys.exit(1)

        rows = r.get("Result") or []
        # "no DataRows" is how the service says zero matches; treat it as empty.
        if not r.get("Success") and "no DataRows" not in (r.get("ErrorMessage") or ""):
            print("ERROR %04d-%02d: %s" % (y, m, r.get("ErrorMessage"))); sys.exit(1)
        slim = [{k: row.get(k) for k in KEEP} for row in rows]
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(slim, f, ensure_ascii=False)
        kept += len(slim)
        print("%04d-%02d  %5d records   (%d/%d)" % (y, m, len(slim), i, len(todo)), flush=True)
        time.sleep(random.uniform(1.5, 3.5))
    print("done; %d new records" % kept)


if __name__ == "__main__":
    main()
