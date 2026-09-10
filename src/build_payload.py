#!/usr/bin/env python
"""
Turn ../.cache/*.json (from harvest_strikes.py) into the aggregates the page ships.

The page never carries the 300k individual reports. Everything it draws is a
count, so this collapses the records into a handful of cubes -- year series,
species, airports, altitude bins, reporting source -- which come to a few hundred
kilobytes of JSON and gzip to a fraction of that.

The one decision worth knowing about is what counts as damage. Two fields say so
and they disagree: INDICATED_DAMAGE is a clean boolean, while DAMAGE_LEVEL is
graded N / M / M? / S / D (none, minor, minor-uncertain, substantial, destroyed)
and is blank on a large share of older records. The page uses INDICATED_DAMAGE
for the damage series and DAMAGE_LEVEL in {S, D} for the substantial series --
never the blank-prone field alone as a denominator.
"""
import json, glob, os, collections, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", ".cache")
OUT = os.path.join(HERE, "payload.json")

# AC_MASS is the FAA five-way aircraft weight code, in kg.
MASS_LABEL = {"1": "<2,250", "2": "2,251-5,700", "3": "5,701-27,000",
              "4": "27,001-272,000", "5": ">272,000"}
# Altitude bins in feet AGL. Fine near the ground because that is where almost
# everything happens, then coarse -- the tail runs past 25,000 ft.
HBINS = [0, 50, 100, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 9000, 14000, 30000]
DEC = [(1990, 2000), (2000, 2010), (2010, 2020), (2020, 2100)]


def load():
    rows = []
    for f in sorted(glob.glob(os.path.join(RAW, "????-??.json"))):
        with open(f, encoding="utf-8") as fh:
            rows += json.load(fh)
    return rows


def is_dmg(r):
    return r.get("INDICATED_DAMAGE") == "TRUE"


def is_sub(r):
    return (r.get("DAMAGE_LEVEL") or "").strip() in ("S", "D")


def had_effect(r):
    e = (r.get("EFFECT") or "").strip()
    return bool(e) and e != "None"


def is_carrier(r):
    """Air carrier: FAA aircraft class A at mass code 3 or above. That is the
    slice the ICAO departures denominator actually covers."""
    return (r.get("AC_CLASS") or "").strip() == "A" and (r.get("AC_MASS") or "") in ("3", "4", "5")


def identified(r):
    """SPECIES_ID codes beginning UNK are the unknown-bird buckets. Anything
    else is an identification, even a coarse one such as Gulls."""
    return not (r.get("SPECIES_ID") or "UNK").startswith("UNK")


def ingested(r):
    return any(r.get("ING_ENG%d" % i) for i in (1, 2, 3, 4))


def hbin(ft):
    for i in range(len(HBINS) - 1):
        if HBINS[i] <= ft < HBINS[i + 1]:
            return i
    return len(HBINS) - 2


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def main():
    rows = load()
    years = sorted({r["INCIDENT_YEAR"] for r in rows if r.get("INCIDENT_YEAR")})
    yi = {y: i for i, y in enumerate(years)}
    n = len(years)

    keys = ("all", "dmg", "sub", "effect", "carrier", "carrierDmg", "ident", "remains")
    series = {k: [0] * n for k in keys}
    cost = [0.0] * n
    aos = [0.0] * n

    for r in rows:
        y = r.get("INCIDENT_YEAR")
        if y not in yi:
            continue
        i = yi[y]
        series["all"][i] += 1
        if is_dmg(r):
            series["dmg"][i] += 1
        if is_sub(r):
            series["sub"][i] += 1
        if had_effect(r):
            series["effect"][i] += 1
        if identified(r):
            series["ident"][i] += 1
        if r.get("REMAINS_SENT"):
            series["remains"][i] += 1
        if is_carrier(r):
            series["carrier"][i] += 1
            if is_dmg(r):
                series["carrierDmg"][i] += 1
        cost[i] += num(r.get("COST_REPAIRS_INFL_ADJ"))
        aos[i] += num(r.get("AOS"))

    # ---- how damaging strikes were graded, year by year --------------------
    # This is the page's own audit of its strictest series. Among strikes that
    # indicated damage, the FAA's grade moves sharply from S (substantial) to
    # M? (minor, uncertain) around 2016-17 -- S falls from 141 in 2015 to 46 in
    # 2017 while M? rises from 199 to 503. Blank DAMAGE_LEVEL is essentially
    # absent among damaging strikes (0.0-0.1%), so this is a change in how the
    # grade is assigned, not a change in how often it is recorded. The page
    # shows it rather than quietly resting the argument on the S/D series.
    DL_CODES = ["S", "D", "M", "M?", "other"]
    dl_by_year = [[0] * len(DL_CODES) for _ in range(n)]
    for r in rows:
        y = r.get("INCIDENT_YEAR")
        if y not in yi or not is_dmg(r):
            continue
        v = (r.get("DAMAGE_LEVEL") or "").strip()
        dl_by_year[yi[y]][DL_CODES.index(v) if v in DL_CODES else len(DL_CODES) - 1] += 1

    # ---- reporting source composition --------------------------------------
    src_tot = collections.Counter((r.get("SOURCE") or "Unknown").strip() or "Unknown" for r in rows)
    src_names = [s for s, _ in src_tot.most_common(7)]
    src_idx = {s: i for i, s in enumerate(src_names)}
    src_by_year = [[0] * (len(src_names) + 1) for _ in range(n)]      # last column = Other
    for r in rows:
        y = r.get("INCIDENT_YEAR")
        if y not in yi:
            continue
        s = (r.get("SOURCE") or "Unknown").strip() or "Unknown"
        src_by_year[yi[y]][src_idx.get(s, len(src_names))] += 1

    # ---- species -----------------------------------------------------------
    sp = {}
    for r in rows:
        sid = (r.get("SPECIES_ID") or "").strip()
        name = (r.get("SPECIES") or "").strip()
        if not sid or not name:
            continue
        s = sp.get(sid)
        if s is None:
            s = sp[sid] = {"id": sid, "name": name, "size": (r.get("SIZE") or "").strip(),
                           "n": 0, "dmg": 0, "sub": 0, "ing": 0, "cost": 0.0, "aos": 0.0,
                           "dec": [0] * len(DEC), "decDmg": [0] * len(DEC),
                           "unk": 1 if not identified(r) else 0}
        s["n"] += 1
        if is_dmg(r):
            s["dmg"] += 1
        if is_sub(r):
            s["sub"] += 1
        if ingested(r):
            s["ing"] += 1
        s["cost"] += num(r.get("COST_REPAIRS_INFL_ADJ"))
        s["aos"] += num(r.get("AOS"))
        y = r.get("INCIDENT_YEAR") or 0
        for di, (a, b) in enumerate(DEC):
            if a <= y < b:
                s["dec"][di] += 1
                if is_dmg(r):
                    s["decDmg"][di] += 1
    species = sorted(sp.values(), key=lambda s: -s["n"])
    for s in species:
        s["cost"] = round(s["cost"])
        s["aos"] = round(s["aos"])

    # ---- airports ----------------------------------------------------------
    ap = {}
    for r in rows:
        code = (r.get("AIRPORT_ID") or "").strip()
        if not code or code == "ZZZZ":            # ZZZZ is the FAA unknown-airport code
            continue
        a = ap.get(code)
        if a is None:
            a = ap[code] = {"id": code, "name": (r.get("AIRPORT") or "").strip(),
                            "st": (r.get("STATE") or "").strip(),
                            "lat": r.get("AIRPORT_LATITUDE"), "lon": r.get("AIRPORT_LONGITUDE"),
                            "n": 0, "dmg": 0, "sub": 0, "sp": collections.Counter(),
                            "y0": 9999, "y1": 0}
        a["n"] += 1
        if is_dmg(r):
            a["dmg"] += 1
        if is_sub(r):
            a["sub"] += 1
        if identified(r):
            a["sp"][(r.get("SPECIES") or "").strip()] += 1
        y = r.get("INCIDENT_YEAR") or 0
        if y:
            a["y0"] = min(a["y0"], y)
            a["y1"] = max(a["y1"], y)
    airports = sorted(ap.values(), key=lambda a: -a["n"])[:900]
    for a in airports:
        a["top"] = [[k, v] for k, v in a["sp"].most_common(5)]
        del a["sp"]
        if a["lat"] is not None:
            a["lat"] = round(float(a["lat"]), 3)
        if a["lon"] is not None:
            a["lon"] = round(float(a["lon"]), 3)

    # ---- altitude & phase --------------------------------------------------
    h_all = [0] * (len(HBINS) - 1)
    h_dmg = [0] * (len(HBINS) - 1)
    for r in rows:
        ft = r.get("HEIGHT")
        if ft is None:
            continue
        b = hbin(float(ft))
        h_all[b] += 1
        if is_dmg(r):
            h_dmg[b] += 1

    ph = {}
    for r in rows:
        p = (r.get("PHASE_OF_FLIGHT") or "").strip()
        if not p:
            continue
        d = ph.get(p)
        if d is None:
            d = ph[p] = {"name": p, "n": 0, "dmg": 0}
        d["n"] += 1
        if is_dmg(r):
            d["dmg"] += 1
    phases = sorted(ph.values(), key=lambda d: -d["n"])

    tod = collections.Counter((r.get("TIME_OF_DAY") or "").strip() or "Unknown" for r in rows)

    # ---- a few individual reports -----------------------------------------
    # Everything else on the page is a count, which makes it easy to forget
    # these are events. The costliest strikes plus every strike that killed
    # somebody, with the filer's own remarks. REPORTER_NAME is not harvested
    # and REMARKS is trimmed, so nothing here identifies a person.
    def notable_row(r):
        rem = " ".join((r.get("REMARKS") or "").split())
        return {"date": (r.get("INCIDENT_DATE ") or "").strip(),
                "ap": (r.get("AIRPORT") or "").strip(),
                "st": (r.get("STATE") or "").strip(),
                "op": (r.get("OPERATOR") or "").strip(),
                "ac": (r.get("AIRCRAFT") or "").strip(),
                "sp": (r.get("SPECIES") or "").strip(),
                "dl": (r.get("DAMAGE_LEVEL") or "").strip(),
                "eff": (r.get("EFFECT") or "").strip(),
                "cost": round(num(r.get("COST_REPAIRS_INFL_ADJ"))),
                "fat": int(num(r.get("NR_FATALITIES"))),
                "inj": int(num(r.get("NR_INJURIES"))),
                "rem": rem[:260] + ("…" if len(rem) > 260 else "")}

    by_cost = sorted(rows, key=lambda r: -num(r.get("COST_REPAIRS_INFL_ADJ")))[:8]
    fatal = [r for r in rows if num(r.get("NR_FATALITIES")) > 0]
    fatal.sort(key=lambda r: -num(r.get("NR_FATALITIES")))
    seen, notable = set(), []
    for r in by_cost + fatal[:6]:
        if r["INDX_NR"] in seen:
            continue
        seen.add(r["INDX_NR"])
        notable.append(notable_row(r))

    # ---- headline totals ---------------------------------------------------
    totals = {
        "records": len(rows),
        "dmg": sum(series["dmg"]),
        "sub": sum(series["sub"]),
        "cost": round(sum(cost)),
        "aos": round(sum(aos)),
        "injuries": int(sum(num(r.get("NR_INJURIES")) for r in rows)),
        "fatalities": int(sum(num(r.get("NR_FATALITIES")) for r in rows)),
        "species": sum(1 for s in species if not s["unk"]),
        "airports": len(ap),
        # STATE is coded FN for a strike that happened outside the United
        # States -- a US operator abroad, almost always. Small, but the page
        # should not claim to be purely domestic.
        "foreign": sum(1 for r in rows if (r.get("STATE") or "").strip() == "FN"),
    }

    with open(os.path.join(RAW, "traffic.json"), encoding="utf-8") as fh:
        traffic = json.load(fh)

    payload = {
        "meta": {"generated": datetime.date.today().isoformat(),
                 "years": years, "hbins": HBINS, "massLabel": MASS_LABEL,
                 "decades": [d[0] for d in DEC]},
        "totals": totals,
        "series": series,
        "cost": [round(c) for c in cost],
        "aos": [round(a) for a in aos],
        "traffic": {str(k): v for k, v in traffic.items()},
        "sources": {"names": src_names + ["Other"], "byYear": src_by_year},
        "damageLevels": {"codes": DL_CODES, "byYear": dl_by_year},
        "species": species,
        "airports": airports,
        "heights": {"all": h_all, "dmg": h_dmg},
        "phases": phases,
        "tod": dict(tod),
        "notable": notable,
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)
    print("wrote %s  %.1f KB" % (OUT, os.path.getsize(OUT) / 1024))
    print("records %(records)d  damaging %(dmg)d  substantial %(sub)d  "
          "fatalities %(fatalities)d  species %(species)d" % totals)


if __name__ == "__main__":
    main()
