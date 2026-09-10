<script>
/* ── 05 twelve of them, in full ──────────────────────────────────────────
   The costliest strikes plus every fatal one, with the filer's own remarks.
   Remarks are operational free text trimmed at build time; no reporter name
   is carried in the payload at all. */
const DLEVEL = { N: "no damage", M: "minor", "M?": "minor, uncertain", S: "substantial", D: "destroyed" };
document.getElementById("logcount").textContent = D.notable.length;
document.getElementById("log").innerHTML = D.notable.map(e => {
  const tags = [];
  if (e.fat) tags.push(`<span class="tag bad">${e.fat} killed</span>`);
  if (e.inj) tags.push(`<span class="tag bad">${e.inj} injured</span>`);
  if (DLEVEL[e.dl]) tags.push(`<span class="tag${"SD".includes(e.dl) ? " bad" : ""}">${DLEVEL[e.dl]}</span>`);
  if (e.cost) tags.push(`<span class="tag">${money(e.cost)}</span>`);
  const eff = e.eff && e.eff !== "None" ? " · " + e.eff : "";
  return `<div class="ev">
    <div class="top">
      <span class="dt">${e.date}</span>
      <span class="wh">${esc(e.sp || "Unidentified")}</span>
      ${tags.join("")}
    </div>
    <div class="meta">${[e.ap, e.st, e.op, e.ac].filter(Boolean).map(esc).join(" · ")}${esc(eff)}</div>
    <p class="rem">${esc(e.rem)}</p>
  </div>`;
}).join("");

/* ── 06 where in the flight ──────────────────────────────────────────────
   Two DOM bar lists rather than canvases: both are short, categorical, and
   want selectable text beside them. The blue bar is the share of strikes in
   that band; the red overlay is the share of *that band* that did damage, so
   the two are deliberately on different scales and the caption says so.   */
const HB = D.meta.hbins;
function hlabel(i){
  const a = HB[i], b = HB[i + 1];
  const f = n => n >= 1000 ? (n / 1000) + "k" : String(n);
  return i === HB.length - 2 ? f(a) + "+ ft" : f(a) + "–" + f(b);
}

function barList(el, rows, totalN){
  const maxShare = Math.max(...rows.map(r => r.n)) / totalN;
  el.innerHTML = rows.map(r => {
    const share = r.n / totalN, dr = pct(r.dmg, r.n);
    return `<div class="alt">
      <span class="lab">${esc(r.label)}</span>
      <span class="tr"><span class="fl" style="width:${(share / maxShare * 100).toFixed(1)}%"></span>
        <span class="fd" style="width:${(share / maxShare * dr).toFixed(1)}%"></span></span>
      <span class="pc">${fmt1(share * 100)}%</span>
    </div>`;
  }).join("");
}

const hTot = D.heights.all.reduce((a, b) => a + b, 0);
barList(document.getElementById("altchart"),
  D.heights.all.map((n, i) => ({ label: hlabel(i), n, dmg: D.heights.dmg[i] })).filter(r => r.n),
  hTot);

const pTot = D.phases.reduce((a, b) => a + b.n, 0);
barList(document.getElementById("phasechart"),
  D.phases.filter(p => p.n / pTot > 0.002).map(p => ({ label: p.name, n: p.n, dmg: p.dmg })),
  pTot);
</script>
