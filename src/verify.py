#!/usr/bin/env python
"""
Print the checkpoint table for REBUILD.md straight out of payload.json.

Run it after build_payload.py and paste the block it prints under the
<!-- VERIFY --> marker in REBUILD.md. Recognisable values catch a parse error
instantly -- a wrong date field or a mis-stripped damage flag moves several of
these rows at once.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "payload.json"), encoding="utf-8") as f:
    D = json.load(f)

Y = D["meta"]["years"]
S = D["series"]
T = D["totals"]
last_full = Y[-1] - 1
i_last = Y.index(last_full)


def mean(seq):
    seq = [v for v in seq if v is not None]
    return sum(seq) / len(seq) if seq else float("nan")


rate = [S["carrier"][i] / D["traffic"][str(y)] * 1e6 if str(y) in D["traffic"] else None
        for i, y in enumerate(Y)]

rows = [
    ("records in file", f"{T['records']:,}"),
    ("years covered", f"{Y[0]}-{Y[-1]} ({Y[-1]} partial)"),
    ("reports, first full year", f"{S['all'][0]:,} in {Y[0]}"),
    (f"reports, {last_full}", f"{S['all'][i_last]:,}"),
    ("every report, 5-yr mean, first -> last",
     f"{mean(S['all'][:5]):,.0f} -> {mean(S['all'][i_last-4:i_last+1]):,.0f}"),
    ("damaged, 5-yr mean, first -> last",
     f"{mean(S['dmg'][:5]):,.0f} -> {mean(S['dmg'][i_last-4:i_last+1]):,.0f}"),
    ("substantial or destroyed, 5-yr mean, first -> last",
     f"{mean(S['sub'][:5]):,.0f} -> {mean(S['sub'][i_last-4:i_last+1]):,.0f}"),
    ("per million departures, first -> last available",
     f"{mean(rate[:5]):.1f} -> {mean([v for v in rate[i_last-4:i_last+1] if v is not None]):.1f}"),
    ("strikes that damaged the aircraft, all years",
     f"{T['dmg']:,} ({100*T['dmg']/T['records']:.1f}%)"),
    ("human fatalities in file", f"{T['fatalities']:,}"),
    ("reported repairs, inflation-adjusted", f"${T['cost']/1e6:,.0f}M"),
    ("distinct taxa named", f"{T['species']:,}"),
    ("airports with at least one report", f"{T['airports']:,}"),
    ("records coded as outside the US", f"{T['foreign']:,}"),
]

sp = {s["name"]: s for s in D["species"]}
for name in ("Mourning dove", "Gulls", "Canada goose", "White-tailed deer", "Bald eagle"):
    s = sp.get(name)
    if s:
        rows.append((f"{name}: strikes / % damaging / substantial",
                     f"{s['n']:,} / {100*s['dmg']/s['n']:.1f}% / {s['sub']:,}"))

h = D["heights"]
tot_h = sum(h["all"])
under500 = sum(n for n, hi in zip(h["all"], D["meta"]["hbins"][1:]) if hi <= 500)
rows.append(("share of height-reporting strikes below 500 ft", f"{100*under500/tot_h:.1f}%"))

top_ap = D["airports"][0]
rows.append(("most-reported airport", f"{top_ap['id']} {top_ap['name']}, {top_ap['n']:,} reports"))

e = D["notable"][0]
rows.append(("costliest strike in file",
             f"{e['date']} {e['ap']}, {e['sp']}, level {e['dl']}, ${e['cost']/1e6:,.1f}M"))

w = max(len(a) for a, _ in rows)
print("| check | expected |")
print("|---|---|")
for a, b in rows:
    print(f"| {a} | `{b}` |")
