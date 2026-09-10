#!/usr/bin/env python
"""
Fetch the denominator: US air carrier departures per year.

Strike counts on their own measure reporting as much as they measure strikes, so
the page needs something to divide by. This uses World Bank indicator
IS.AIR.DPRT (source: ICAO, Civil Aviation Statistics of the World) for the United
States -- "registered carrier departures worldwide" for carriers registered in
the country. One request, no key, 1970 onward.

What it is NOT: it excludes general aviation and military, which are a large
share of US airport movements and of strike reports. The page therefore
normalises only the air-carrier slice of the strike data against it, and says so.
FAA OPSNET/ATADS would give true towered movements including GA, but it is a
legacy ASP form (aspm.faa.gov/opsnet/sys/Airport.asp posting to
opsnet-server-x.asp) with a dozen coupled hidden fields and no documented
machine route; it was probed and deliberately not scraped.

Coverage ends at the last year ICAO has reported, currently 2023, so the
normalised panel stops there while the raw counts run to the present.
"""
import json, os, urllib.request

URL = ("https://api.worldbank.org/v2/country/USA/indicator/IS.AIR.DPRT"
       "?format=json&per_page=200")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".cache", "traffic.json")


def main():
    with urllib.request.urlopen(URL, timeout=60) as r:
        payload = json.loads(r.read().decode("utf-8"))
    rows = {int(d["date"]): d["value"] for d in payload[1] if d["value"] is not None}
    rows = {y: v for y, v in sorted(rows.items()) if y >= 1990}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(rows, f, indent=1)
    ys = sorted(rows)
    print("%d years, %d-%d" % (len(rows), ys[0], ys[-1]))
    for y in ys:
        print("  %d  %12s" % (y, format(int(rows[y]), ",")))


if __name__ == "__main__":
    main()
