<script>
/* ── headline stripe and every caption that quotes a number ──────────────
   All of these are computed from the payload rather than typed, so a rebuild
   on newer data cannot leave a stale figure in the prose. */
const T = D.totals;
const firstY = YEARS[0], lastY = YEARS[YEARS.length - 1];

document.getElementById("stripe").innerHTML = [
  [fmt(T.records), `strike reports, ${firstY}–${lastY}`],
  [fmt(T.dmg), "that damaged the aircraft"],
  [money(T.cost), "in reported repairs, inflation-adjusted"],
  [fmt(T.species), "distinct taxa named"],
].map(([v, k]) => `<div><div class="v">${v}</div><div class="k">${k}</div></div>`).join("");

document.getElementById("stripecap").innerHTML =
  `Everything on this page comes out of one file: the FAA's public wildlife strike database, which
   holds every civil strike report filed in the United States since 1990 that has cleared processing.
   Reporting is voluntary for operators and always has been. Human injuries in the file total
   <b>${fmt(T.injuries)}</b> and fatalities <b>${fmt(T.fatalities)}</b>.`;

/* 01 */
{
  const a = D.series.all[0], b = D.series.all[IDX_LAST_FULL];
  const lastRateIdx = VALS.dmgRate.reduce((acc, v, i) => v == null ? acc : i, -1);
  document.getElementById("maincap").innerHTML =
    `Both axes are logarithmic, so equal vertical distances are equal ratios — the only way six series
     spanning three orders of magnitude fit on one panel, and the only way a rise and a fall can be
     compared by eye. Reports went from <b>${fmt(a)}</b> in ${firstY} to <b>${fmt(b)}</b> in
     ${LAST_FULL}, while the ones that damaged the aircraft went from <b>${fmt(D.series.dmg[0])}</b> to
     <b>${fmt(D.series.dmg[IDX_LAST_FULL])}</b>. The bottom series is the one to distrust, and section 02
     shows why. The two dashed
     lines are their own solid line divided by air-carrier departures; they stop in
     <b>${YEARS[lastRateIdx]}</b>, the last year ICAO has published. ${lastY} is shaded because it is
     still filling.`;
}

/* 02 */
{
  const g = meanOf("all", LAST5) / meanOf("all", FIRST5);
  const ex = meanOf("allRate", LAST5) / meanOf("allRate", FIRST5);
  const dg = meanOf("dmg", LAST5) / meanOf("dmg", FIRST5);
  const share0 = 100 * meanOf("dmg", FIRST5) / meanOf("all", FIRST5);
  const share1 = 100 * meanOf("dmg", LAST5) / meanOf("all", LAST5);
  document.getElementById("laddercap").innerHTML =
    `The growth drains away as you go down: <b>×${fmt1(g)}</b> on every report filed, still
     <b>×${fmt1(ex)}</b> once you divide by departures, <b>×${fmt1(dg)}</b> on the ones that damaged the
     aircraft. Note where the exposure control lands — dividing by how much anyone flew removes only a
     small part of the rise, because flying did not grow anything like eightfold. It is the severity
     thresholds that do the work. Put the same thing the other way round: damage was indicated on
     <b>${fmt1(share0)}%</b> of reports in the first five years and <b>${fmt1(share1)}%</b> in the last
     five. Almost every one of the extra reports is a report of nothing happening.`;
}

/* 02b */
{
  const codes = D.damageLevels.codes;
  const sIdx = codes.indexOf("S"), mqIdx = codes.indexOf("M?");
  const at = y => D.damageLevels.byYear[YEARS.indexOf(y)];
  const y0 = 2015, y1 = 2019;
  const shareAt = (y, i) => {
    const row = at(y), t = row.reduce((a, b) => a + b, 0) || 1;
    return 100 * row[i] / t;
  };
  document.getElementById("dlcap").innerHTML =
    `Damaging strikes only, so the base is the same population throughout. In ${y0},
     <b>${fmt1(shareAt(y0, sIdx))}%</b> of them were graded substantial and
     <b>${fmt1(shareAt(y0, mqIdx))}%</b> minor-uncertain; by ${y1} that had become
     <b>${fmt1(shareAt(y1, sIdx))}%</b> and <b>${fmt1(shareAt(y1, mqIdx))}%</b>. Nothing about aircraft
     changed that fast. This is a grading practice moving, and it means the bottom row of the ladder
     <b>cannot be used as evidence on its own</b> — which is why the argument above is built on the damage
     share instead, a plain boolean that has been recorded the same way since ${firstY}. The series is left
     on the chart because hiding it would be worse.`;
}

/* 03 */
{
  const sh = (yi, name) => {
    const row = D.sources.byYear[yi], i = D.sources.names.indexOf(name);
    const tot = row.reduce((a, b) => a + b, 0) || 1;
    return i < 0 ? 0 : 100 * row[i] / tot;
  };
  const eName = D.sources.names.find(n => n.includes("-E")) || "";
  const pName = D.sources.names.find(n => n.endsWith("5200-7")) || "";
  document.getElementById("srccap").innerHTML =
    `In ${firstY} the paper FAA Form 5200-7 carried <b>${fmt1(sh(0, pName))}%</b> of the year's reports,
     with most of the rest coming from airports and from engine manufacturers finding damage at overhaul.
     By ${LAST_FULL} the electronic form${eName ? ` (${eName})` : ""} carries
     <b>${fmt1(sh(IDX_LAST_FULL, eName))}%</b> and the paper form <b>${fmt1(sh(IDX_LAST_FULL, pName))}%</b>.
     The other channels did not grow — they were absorbed. This is one process being re-plumbed, not four
     processes each finding more birds, and re-plumbing a reporting channel is the cheapest way there is
     to raise a count.`;

  const i0 = 100 * D.series.ident[0] / D.series.all[0];
  const i1 = 100 * D.series.ident[IDX_LAST_FULL] / D.series.all[IDX_LAST_FULL];
  const r1 = 100 * D.series.remains[IDX_LAST_FULL] / D.series.all[IDX_LAST_FULL];
  document.getElementById("identcap").innerHTML =
    `The share of strikes pinned to a named taxon went from <b>${fmt1(i0)}%</b> in ${firstY} to
     <b>${fmt1(i1)}%</b> in ${LAST_FULL}, and <b>${fmt1(r1)}%</b> of last year's strikes had remains
     posted somewhere for identification — the Smithsonian's feather-identification lab will work from a
     smear. A better-identified database is a better database, but it is also a database whose species
     counts cannot be compared across decades: an increase in a species' strikes may be an increase in
     someone bothering to find out which species it was.`;
}

/* 04 */
{
  const byN = [...SP].sort((a, b) => b.n - a.n)[0];
  const bySub = [...SP].sort((a, b) => b.sub - a.sub)[0];
  const big = SP.filter(s => s.size === "Large");
  const bigN = big.reduce((a, s) => a + s.n, 0), bigSub = big.reduce((a, s) => a + s.sub, 0);
  const allN = SP.reduce((a, s) => a + s.n, 0), allSub = SP.reduce((a, s) => a + s.sub, 0);
  document.getElementById("hzcap").innerHTML =
    `<b>${byN.name}</b> is the most-struck taxon on the board — ${fmt(byN.n)} strikes — and damages the
     aircraft <b>${fmt1(pct(byN.dmg, byN.n))}%</b> of the time. <b>${bySub.name}</b> is struck
     ${fmt1(byN.n / bySub.n)} times less often and accounts for ${fmt(bySub.sub)} substantial or destroyed
     aircraft, <b>${fmt1(pct(bySub.dmg, bySub.n))}%</b> of its strikes doing damage. Large-bodied taxa are
     <b>${fmt1(pct(bigN, allN))}%</b> of identified strikes here and <b>${fmt1(pct(bigSub, allSub))}%</b>
     of the substantial ones. Mass is most of the story, which is what a kinetic-energy argument predicts.`;
  document.getElementById("sptabcap").innerHTML =
    `Top 40 by the selected column; click any heading to re-sort. Repair cost is the reported figure
     adjusted for inflation and is missing far more often than it is present, so treat it as a floor.
     Rows are taxa as the FAA codes them, which mixes species with genus- and family-level buckets —
     "Gulls" and "Herring gull" are both in the file and are not nested.`;
}

/* 05 */
{
  const HB2 = D.meta.hbins;
  const under = (lim) => D.heights.all.reduce((a, n, i) => a + (HB2[i + 1] <= lim ? n : 0), 0);
  const tot = D.heights.all.reduce((a, b) => a + b, 0);
  const dmgIn = (lo, hi) => {
    let n = 0, d = 0;
    D.heights.all.forEach((v, i) => {
      if (HB2[i] >= lo && HB2[i + 1] <= hi) { n += v; d += D.heights.dmg[i]; }
    });
    return pct(d, n);
  };
  document.getElementById("altcap").innerHTML =
    `Blue is the share of all height-reporting strikes in that band; the red overlay is the share of
     <i>that band</i> that damaged the aircraft, drawn on the same bar so the two can be read together —
     it is not a subset of the blue length. <b>${fmt1(pct(under(500), tot))}%</b> of strikes happen below
     500 feet. Damage runs at <b>${fmt1(dmgIn(0, 500))}%</b> down there and <b>${fmt1(dmgIn(3000, 30000))}%</b>
     above 3,000 feet, where the aircraft is faster, the animal is usually bigger, and nobody files a
     report for a smear they cannot see. Height is blank on
     <b>${fmt1(100 - pct(tot, T.records))}%</b> of reports.`;
  document.getElementById("phasecap").innerHTML =
    `The same reports by phase of flight. Approach and take-off run dominate for the same reason the
     first 500 feet do. The overlay is again that phase's own damage rate.`;
}

/* ── 07 methods ─────────────────────────────────────────────────────────── */
document.getElementById("methods").innerHTML = `
  <h3>Where the data comes from</h3>
  <p>The <b>FAA Wildlife Strike Database</b>, pulled ${D.meta.generated} from the public export the
     agency's own search page uses (<code>wildlife.faa.gov/search</code>). It is harvested a month at a
     time, ${firstY} to ${lastY}, and only records that have cleared FAA processing are published, so
     recent months are still filling in and the final year on every chart is partial. As a work of the
     United States government the data is in the public domain.</p>
  <p>The denominator is <b>World Bank indicator IS.AIR.DPRT</b> for the United States — registered air
     carrier departures, sourced from ICAO. It covers scheduled carriers, not general aviation or
     military, so the two dashed series divide only the air-carrier slice of the strike file (FAA aircraft
     class A, mass code 3 and above) by it. ICAO's series currently ends before the strike file does, and
     the dashed lines stop where it does rather than being extrapolated.</p>

  <h3>What counts as damage</h3>
  <p>Two fields disagree and both are used deliberately. <code>INDICATED_DAMAGE</code> is a clean
     boolean and drives the damage series. <code>DAMAGE_LEVEL</code> is graded N / M / M? / S / D and is
     blank on a large share of older records; only its S and D values are used, for the substantial
     series, and it is never used as a denominator. "Changed the flight" is a non-empty
     <code>EFFECT</code> other than <i>None</i> — and that is the weakest of the six series, because
     <code>EFFECT</code> is left blank on between a quarter and three quarters of reports depending on the
     year, with no trend to correct for. A blank is counted as no effect, so that series is a lower bound
     resting on a base whose completeness wanders. It is included for shape, not for its level.</p>
  <p>The substantial-or-destroyed series has a worse problem, documented in section 02: the FAA's grading
     of damaging strikes shifts from <code>S</code> to <code>M?</code> around 2016-17, which pushes that
     series down independently of anything happening to aircraft. It is drawn, and it is flagged, and the
     argument does not rest on it. Two other fields that looked like recoding-proof severity measures were
     tested and rejected for the same reason: engine ingestion (<code>ING_ENG1-4</code>) is recorded on
     four to nineteen strikes a year until 2020 and then on hundreds, and <code>AOS</code>, hours out of
     service, grows faster than the report count itself. Neither is a measure of birds.</p>

  <h3>The trap this page is built around</h3>
  <p>A strike count is a count of forms. Reporting is voluntary for civil operators, the FAA and USDA
     have spent three decades actively soliciting more of it, and the channels the reports arrive
     through changed completely over the period — all of which raises the count without a single extra
     bird. The defence is not to correct for it but to re-count under thresholds that reporting effort
     cannot easily manufacture, and to say plainly that <b>the flat series are the trustworthy ones and
     the steep one is not</b>. This is the same shape as an epidemiological ascertainment problem, and
     it has the same answer: find the outcome nobody can miss.</p>

  <h3>What this cannot tell you</h3>
  <p>It cannot tell you whether the number of collisions rose, only that the number of severe ones did
     not rise anything like as fast. It cannot compare species across decades, because identification
     improved sharply mid-period. It cannot rank airports by risk — a high count usually means an
     attentive wildlife programme, and the exposure at each field is not in the file. It says nothing
     about military aviation, which reports separately. It is not quite purely domestic either —
     <b>${fmt(T.foreign)}</b> reports (${fmt1(pct(T.foreign, T.records))}% of the file) are coded as
     having happened outside the United States, almost all of them US operators struck abroad, and they
     are left in. And the damage rates on individual taxa are conditional on being struck and being
     identified, which the largest and most conspicuous animals will always survive better as data
     than a small bird that leaves nothing behind.</p>`;

document.getElementById("foot").innerHTML =
  `Built ${D.meta.generated}. Data: FAA Wildlife Strike Database (US government, public domain);
   World Bank / ICAO indicator IS.AIR.DPRT (CC-BY-4.0). One self-contained HTML file — no build step,
   no server, no runtime network. Source and rebuild instructions:
   <a href="https://github.com/TNRiley/right-of-way">github.com/TNRiley/right-of-way</a>.`;

/* first paint */
drawMain(); drawSparks(); drawDl(); drawSrc(); drawIdent(); drawHz();
</script>
