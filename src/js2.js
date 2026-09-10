<script>
/* ── 01 the count, and five ways to check it ─────────────────────────────
   Six series over the same years, ordered by how hard the thing they count is
   to leave unreported. Two controls are at work and they are deliberately not
   merged: a *severity threshold* (did it damage / substantially damage the
   aircraft, did it change what the flight did) and an *exposure* denominator
   (per million air-carrier departures). The per-departure pair are drawn
   dashed in their numerator's own colour, because they are the same count
   divided by something, not a different count.                            */
const SER = [
  { k: "all",     c: "--c-all", dash: 0, t: "Every report",
    d: "any wildlife strike filed" },
  { k: "allRate", c: "--c-all", dash: 1, t: "Every report ÷ departures",
    d: "air-carrier reports per million US air-carrier departures" },
  { k: "effect",  c: "--c-eff", dash: 0, t: "Changed the flight",
    d: "aborted take-off, precautionary landing, engine shutdown, diversion" },
  { k: "dmg",     c: "--c-dmg", dash: 0, t: "Damaged the aircraft",
    d: "damage indicated on the report" },
  { k: "dmgRate", c: "--c-dmg", dash: 1, t: "Damaged ÷ departures",
    d: "damaging air-carrier strikes per million departures" },
  { k: "sub",     c: "--c-sub", dash: 0, t: "Substantial or destroyed",
    d: "FAA damage level S or D" },
];
const ON = Object.fromEntries(SER.map(s => [s.k, true]));
let AXMODE = "index";

/* The two rate series exist only for years ICAO has published departures for,
   so they are shorter than the rest and carry nulls at the end. */
const RATE_NUM = { allRate: "carrier", dmgRate: "carrierDmg" };
function values(k){
  if (!RATE_NUM[k]) return D.series[k].slice();
  return YEARS.map((y, i) => {
    const t = D.traffic[String(y)];
    return t ? D.series[RATE_NUM[k]][i] / t * 1e6 : null;
  });
}
const VALS = Object.fromEntries(SER.map(s => [s.k, values(s.k)]));

/* Baseline: the mean of the first five years on record, per series. */
const BASE = {};
SER.forEach(s => {
  const v = VALS[s.k].slice(0, 5).filter(x => x != null);
  BASE[s.k] = v.reduce((a, b) => a + b, 0) / v.length;
});
const shown = k => AXMODE === "index"
  ? VALS[k].map(v => v == null ? null : v / BASE[k] * 100)
  : VALS[k];

/* ── lens buttons ─────────────────────────────────────────────────────── */
const lensBox = document.getElementById("lenses");
SER.forEach(s => {
  const b = document.createElement("button");
  b.className = "lens"; b.style.setProperty("--lc", `var(${s.c})`);
  b.setAttribute("aria-pressed", "true");
  b.innerHTML = `<span class="sw${s.dash ? " dashed" : ""}"></span>${s.t}`;
  b.onclick = () => {
    ON[s.k] = !ON[s.k];
    b.setAttribute("aria-pressed", String(ON[s.k]));
    drawMain();
  };
  lensBox.appendChild(b);
});
document.querySelectorAll("#axseg button").forEach(b => {
  b.onclick = () => {
    AXMODE = b.dataset.m;
    document.querySelectorAll("#axseg button")
      .forEach(o => o.setAttribute("aria-pressed", String(o === b)));
    drawMain();
  };
});

/* ── main chart ───────────────────────────────────────────────────────── */
const mainCv = document.getElementById("main"), tip = document.getElementById("tip");
let HOVER = -1, GEOM = null;

function drawMain(){
  const H = Math.max(300, Math.min(400, mainCv.parentNode.clientWidth * 0.46));
  const { g, w, h } = hidpi(mainCv, H);
  const L = 46, R = 8, T = 14, B = 26;
  const x0 = L, x1 = w - R, y0 = T, y1 = h - B;
  const ink = cv("--ink"), faint = cv("--faint"), lineC = cv("--line");

  const live = SER.filter(s => ON[s.k]);
  const all = live.flatMap(s => shown(s.k)).filter(v => v != null && v > 0);
  if (!all.length){ GEOM = null; return; }
  /* Log scale in both modes: the series differ by three orders of magnitude
     in counts, and in index mode a ratio up and a ratio down should read the
     same size. */
  let lo = Math.min(...all), hi = Math.max(...all);
  lo = Math.log10(lo); hi = Math.log10(hi);
  const padY = (hi - lo) * 0.10 || 0.3;
  lo -= padY; hi += padY;
  const Y = v => y1 - (Math.log10(v) - lo) / (hi - lo) * (y1 - y0);
  const X = i => x0 + (x1 - x0) * i / (YEARS.length - 1);

  /* gridlines on decade-friendly ticks */
  const ticks = [];
  for (let e = -3; e <= 6; e++)
    for (const m of [1, 2, 5]){
      const v = m * Math.pow(10, e);
      if (Math.log10(v) > lo && Math.log10(v) < hi) ticks.push(v);
    }
  g.font = '10px "IBM Plex Mono", monospace'; g.textAlign = "right";
  ticks.forEach(v => {
    const y = Y(v);
    g.strokeStyle = (AXMODE === "index" && v === 100) ? cv("--line-2") : lineC;
    g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    g.fillStyle = faint;
    g.fillText(v >= 1000 ? (v / 1000) + "k" : String(v), x0 - 7, y + 3.5);
  });
  xLabels(g, x0, x1, h - 8, YEARS, faint);

  /* the partial final year, marked off */
  const xp = X(YEARS.length - 1.5);
  g.save(); g.fillStyle = cv("--sunk"); g.globalAlpha = .55;
  g.fillRect(xp, y0, x1 - xp, y1 - y0); g.restore();
  g.fillStyle = faint; g.textAlign = "right"; g.font = '9px "IBM Plex Mono", monospace';
  g.fillText("part year", x1 - 3, y0 + 10);

  live.forEach(s => {
    const vs = shown(s.k), col = cv(s.c);
    const pts = [];
    vs.forEach((v, i) => { if (v != null && v > 0) pts.push([X(i), Y(v)]); });
    if (s.k === "all"){
      g.save(); g.globalAlpha = .10; g.fillStyle = col;
      g.beginPath(); g.moveTo(pts[0][0], y1);
      pts.forEach(p => g.lineTo(p[0], p[1]));
      g.lineTo(pts[pts.length - 1][0], y1); g.closePath(); g.fill(); g.restore();
    }
    line(g, pts, col, s.dash ? 1.8 : 2, s.dash ? [5, 4] : null);
    if (HOVER >= 0 && vs[HOVER] != null && vs[HOVER] > 0){
      g.fillStyle = col; g.beginPath(); g.arc(X(HOVER), Y(vs[HOVER]), 3.4, 0, 7); g.fill();
      g.strokeStyle = cv("--surface"); g.lineWidth = 1.4; g.stroke();
    }
  });

  if (HOVER >= 0){
    g.strokeStyle = cv("--line-2"); g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(X(HOVER), y0); g.lineTo(X(HOVER), y1); g.stroke(); g.setLineDash([]);
  }
  GEOM = { X, Y, x0, x1, y0, y1, w };
}
DRAWERS.push(drawMain);

mainCv.onpointermove = e => {
  if (!GEOM) return;
  const r = mainCv.getBoundingClientRect();
  const f = (e.clientX - r.left - GEOM.x0) / (GEOM.x1 - GEOM.x0);
  const i = Math.max(0, Math.min(YEARS.length - 1, Math.round(f * (YEARS.length - 1))));
  if (i === HOVER) return;
  HOVER = i; drawMain(); showTip(e);
};
mainCv.onpointerleave = () => { HOVER = -1; tip.style.opacity = 0; drawMain(); };

function showTip(){
  if (HOVER < 0 || !GEOM) return;
  const rows = SER.filter(s => ON[s.k]).map(s => {
    const raw = VALS[s.k][HOVER];
    if (raw == null) return "";
    const v = RATE_NUM[s.k] ? fmtR(raw) : fmt(raw);
    const ix = Math.round(raw / BASE[s.k] * 100);
    return `<div class="row"><span class="nm"><span class="sw" style="background:var(${s.c})"></span>${s.t}</span>
      <span class="vv">${AXMODE === "index" ? ix : v}</span></div>`;
  }).join("");
  tip.innerHTML = `<div class="yr">${YEARS[HOVER]}${YEARS[HOVER] > LAST_FULL ? " · partial" : ""}</div>${rows}`;
  tip.style.opacity = 1;
  const x = GEOM.X(HOVER);
  tip.style.left = Math.min(GEOM.w - 190, Math.max(0, x + 14)) + "px";
  tip.style.top = "18px";
}

/* ── 02 the ladder ────────────────────────────────────────────────────── */
const firstYear = YEARS[0];
const FIRST5 = [0, 5];
const LAST5 = [IDX_LAST_FULL - 4, IDX_LAST_FULL + 1];
function meanOf(k, span){
  const v = VALS[k].slice(span[0], span[1]).filter(x => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
/* The rate series stops where ICAO's departures do, so its "last five years"
   is not everyone else's. Each row states the window it actually used. */
function windowOf(k, span){
  const ys = [];
  for (let i = span[0]; i < span[1]; i++) if (VALS[k][i] != null) ys.push(YEARS[i]);
  return ys.length ? ys[0] + "–" + String(ys[ys.length - 1]).slice(2) : "";
}
const ladder = document.getElementById("ladder");
ladder.innerHTML = `<div class="lrow head"><span>Counted as a strike when it…</span>
  <span>${firstYear}–${LAST_FULL}</span>
  <span style="text-align:right">annual mean,<br>first 5 yrs → last 5</span></div>`;
const LROWS = [];
SER.forEach(s => {
  const a = meanOf(s.k, FIRST5), b = meanOf(s.k, LAST5);
  const chg = (b / a - 1) * 100;
  const el = document.createElement("div");
  el.className = "lrow"; el.style.setProperty("--lc", `var(${s.c})`);
  el.innerHTML = `<span class="nm"><span class="sw${s.dash ? " dashed" : ""}"></span>
      <span><span class="t">${s.t}</span> <span class="d">${s.d}</span></span></span>
    <span class="spark"><canvas></canvas></span>
    <span class="chg ${chg >= 0 ? "up" : "dn"}">${chg >= 0 ? "+" : "−"}${fmt(Math.round(Math.abs(chg)))}%
      <small>${RATE_NUM[s.k] ? fmtR(a) + " → " + fmtR(b) : fmt(Math.round(a)) + " → " + fmt(Math.round(b))}</small>
      <small>${windowOf(s.k, FIRST5)} to ${windowOf(s.k, LAST5)}</small></span>`;
  ladder.appendChild(el);
  LROWS.push({ s, cv: el.querySelector("canvas") });
});
function drawSparks(){
  LROWS.forEach(({ s, cv: c }) => {
    const { g, w, h } = hidpi(c, 30);
    const vs = VALS[s.k].slice(0, IDX_LAST_FULL + 1).filter(v => v != null);
    const lo = Math.min(...vs), hi = Math.max(...vs);
    const pts = vs.map((v, i) => [w * i / (vs.length - 1), h - 3 - (v - lo) / (hi - lo || 1) * (h - 6)]);
    line(g, pts, cv(s.c), 1.5);
  });
}
DRAWERS.push(drawSparks);

/* ── 02b the page auditing its own strictest series ──────────────────────
   Damaging strikes only, split by the grade the FAA gave them. Drawn as
   shares, because the point is the mix: S does not shrink into nothing, it is
   replaced by M? from about 2016. Whatever the bottom row of the ladder
   measures, part of it is this.                                            */
const DLC = D.damageLevels.codes;
const DLCOL = { "S": "--c-sub", "D": "--c-dmg", "M": "--c-eff", "M?": "--c-all", "other": "--faint" };
const DLNAME = { "S": "substantial", "D": "destroyed", "M": "minor", "M?": "minor, uncertain", "other": "ungraded" };
const dlCv = document.getElementById("dl");

function drawDl(){
  const H = Math.max(190, Math.min(250, dlCv.parentNode.clientWidth * 0.30));
  const { g, w, h } = hidpi(dlCv, H);
  const L = 40, R = 132, T = 12, B = 26;
  const x0 = L, x1 = w - R, y0 = T, y1 = h - B;
  const X = i => x0 + (x1 - x0) * i / (YEARS.length - 1);
  const Y = f => y1 - f * (y1 - y0);

  const shares = D.damageLevels.byYear.map(row => {
    const t = row.reduce((a, b) => a + b, 0) || 1;
    return row.map(v => v / t);
  });
  let base = new Array(YEARS.length).fill(0);
  DLC.forEach((code, ci) => {
    g.fillStyle = cv(DLCOL[code]); g.globalAlpha = .84;
    g.beginPath();
    for (let i = 0; i < YEARS.length; i++) g[i ? "lineTo" : "moveTo"](X(i), Y(base[i]));
    for (let i = YEARS.length - 1; i >= 0; i--) g.lineTo(X(i), Y(base[i] + shares[i][ci]));
    g.closePath(); g.fill(); g.globalAlpha = 1;
    base = base.map((b, i) => b + shares[i][ci]);
  });

  g.font = '10.5px "IBM Plex Mono", monospace'; g.textAlign = "left";
  let acc = 0;
  const li = YEARS.length - 2;
  DLC.forEach((code, ci) => {
    const s = shares[li][ci], mid = acc + s / 2; acc += s;
    if (s < 0.05) return;
    g.fillStyle = cv(DLCOL[code]); g.fillRect(x1 + 6, Y(mid) - 4, 8, 8);
    g.fillStyle = cv("--muted"); g.fillText(DLNAME[code], x1 + 19, Y(mid) + 3.5);
  });
  g.textAlign = "right"; g.fillStyle = cv("--faint"); g.font = '10px "IBM Plex Mono", monospace';
  [0, .5, 1].forEach(f => g.fillText(Math.round(f * 100) + "%", x0 - 7, Y(f) + 3.5));
  xLabels(g, x0, x1, h - 8, YEARS, cv("--faint"));
}
DRAWERS.push(drawDl);
</script>
