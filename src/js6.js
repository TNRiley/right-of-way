<script>
/* ── 06 your airport ─────────────────────────────────────────────────────
   Straight lookup over the 900 airports with the most reports. Matching is on
   code and name, code first, so typing DEN lands on Denver rather than on the
   first name containing "den".                                             */
const AP = D.airports;
const apq = document.getElementById("apq"), apout = document.getElementById("apout");

/* Airport codes in this file are ICAO, not IATA -- Dallas/Fort Worth is KDFW
   and Anchorage is PANC -- but nobody types the prefix. Try the code as given,
   then as a suffix, before falling back to the name. */
function findAp(q){
  q = q.trim().toLowerCase();
  if (!q) return null;
  return AP.find(a => a.id.toLowerCase() === q)
      || AP.find(a => a.id.length === 4 && a.id.toLowerCase().slice(1) === q)
      || AP.find(a => a.id.toLowerCase().startsWith(q))
      || AP.find(a => a.name.toLowerCase().startsWith(q))
      || AP.find(a => a.name.toLowerCase().includes(q));
}

function renderAp(a){
  if (!a){
    apout.innerHTML = `<p class="caption" style="margin:0">No airport in the top ${fmt(AP.length)} by
      report count matches that. Smaller fields are in the database but are not carried on this page.</p>`;
    return;
  }
  const rank = AP.indexOf(a) + 1;
  const topMax = a.top.length ? a.top[0][1] : 1;
  apout.innerHTML = `
    <div class="apcard">
      <div>
        <div style="font-family:'Fraunces',serif;font-size:22px;font-weight:600;line-height:1.15">${esc(a.name)}</div>
        <div class="mono" style="font-size:11.5px;color:var(--faint);letter-spacing:.08em;margin:3px 0 12px">
          ${esc(a.id)}${a.st ? " · " + esc(a.st) : ""} · reports from ${a.y0} to ${a.y1} · ${rank}${ordinal(rank)} most-reported</div>
        <div class="apstat">
          <div><div class="v">${fmt(a.n)}</div><div class="k">strikes reported</div></div>
          <div><div class="v">${fmt1(pct(a.dmg, a.n))}%</div><div class="k">did damage</div></div>
          <div><div class="v">${fmt(a.sub)}</div><div class="k">substantial</div></div>
        </div>
      </div>
      <div>
        <div class="mono" style="font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint)">
          most-struck identified taxa</div>
        <div class="splist">${a.top.map(([nm, c]) => `<div class="r">
          <span class="t"><i style="width:${(c / topMax * 100).toFixed(1)}%"></i><span>${esc(nm)}</span></span>
          <span class="c">${fmt(c)}</span></div>`).join("") || `<div class="caption">Nothing identified below family level here.</div>`}</div>
      </div>
    </div>`;
}
const ordinal = n => (n % 100 >= 11 && n % 100 <= 13) ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";

apq.oninput = () => renderAp(findAp(apq.value));
/* Chips are resolved through the same lookup, so one that no longer matches
   anything is dropped rather than rendered as a dead button. */
const CHIPS = ["DFW", "DEN", "ORD", "JFK", "SEA", "MCO", "SLC", "ANC"]
  .filter(c => findAp(c));
document.getElementById("apchips").innerHTML =
  CHIPS.map(c => `<button class="chip" data-c="${c}">${c}</button>`).join("");
document.querySelectorAll("#apchips .chip").forEach(b => b.onclick = () => {
  apq.value = b.dataset.c; renderAp(findAp(b.dataset.c));
});
renderAp(AP[0]);
</script>
