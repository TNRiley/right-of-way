<script>
/* ── 04 the hazard board ─────────────────────────────────────────────────
   Every identified taxon with enough strikes for a damage rate to mean
   anything, placed by how often it is hit against how often being hit costs
   the aircraft something. Area is proportional to substantial-or-destroyed
   strikes, so the marks that matter are large without needing a third axis. */
const MIN_N = 30;
const SP = D.species.filter(s => !s.unk && s.n >= MIN_N);
const SIZECOL = { Small: "--c-all", Medium: "--c-eff", Large: "--c-dmg" };

const hzCv = document.getElementById("hz"), hzTip = document.getElementById("hztip");
let HZPTS = [], HZHOVER = null;

function drawHz(){
  const H = Math.max(340, Math.min(440, hzCv.parentNode.clientWidth * 0.56));
  const { g, w, h } = hidpi(hzCv, H);
  const L = 44, R = 14, T = 16, B = 34;
  const x0 = L, x1 = w - R, y0 = T, y1 = h - B;
  const nMax = Math.max(...SP.map(s => s.n));
  const yMax = Math.min(100, Math.ceil(Math.max(...SP.map(s => pct(s.dmg, s.n))) / 10) * 10);
  const X = n => x0 + (Math.log10(n) - Math.log10(MIN_N)) / (Math.log10(nMax) - Math.log10(MIN_N)) * (x1 - x0);
  const Y = p => y1 - p / yMax * (y1 - y0);

  /* grid */
  g.strokeStyle = cv("--line"); g.lineWidth = 1;
  g.font = '10px "IBM Plex Mono", monospace'; g.fillStyle = cv("--faint");
  for (let p = 0; p <= yMax; p += yMax > 40 ? 20 : 10){
    g.beginPath(); g.moveTo(x0, Y(p)); g.lineTo(x1, Y(p)); g.stroke();
    g.textAlign = "right"; g.fillText(p + "%", x0 - 7, Y(p) + 3.5);
  }
  g.textAlign = "center";
  [30, 100, 300, 1000, 3000, 10000, 30000].forEach(n => {
    if (n < MIN_N || n > nMax) return;
    g.strokeStyle = cv("--line");
    g.beginPath(); g.moveTo(X(n), y0); g.lineTo(X(n), y1); g.stroke();
    g.fillStyle = cv("--faint");
    g.fillText(n >= 1000 ? (n / 1000) + "k" : String(n), X(n), h - 20);
  });
  g.fillStyle = cv("--faint"); g.font = '9.5px "IBM Plex Mono", monospace';
  g.textAlign = "center"; g.fillText("STRIKES ON RECORD  (log)", (x0 + x1) / 2, h - 6);
  g.save(); g.translate(11, (y0 + y1) / 2); g.rotate(-Math.PI / 2);
  g.fillText("SHARE THAT DAMAGED THE AIRCRAFT", 0, 0); g.restore();

  /* corpus-wide damage rate, as the line everything is judged against */
  const corpusRate = pct(D.totals.dmg, D.totals.records);
  g.strokeStyle = cv("--line-2"); g.setLineDash([4, 3]); g.lineWidth = 1;
  g.beginPath(); g.moveTo(x0, Y(corpusRate)); g.lineTo(x1, Y(corpusRate)); g.stroke(); g.setLineDash([]);
  g.textAlign = "left"; g.fillStyle = cv("--muted"); g.font = '9.5px "IBM Plex Mono", monospace';
  g.fillText("all strikes: " + fmt1(corpusRate) + "%", x0 + 5, Y(corpusRate) - 5);

  /* marks, biggest first so small ones stay clickable on top */
  const rMax = Math.sqrt(Math.max(...SP.map(s => s.sub)) || 1);
  HZPTS = SP.map(s => ({
    s, x: X(s.n), y: Y(pct(s.dmg, s.n)),
    r: 2.6 + 11 * Math.sqrt(s.sub) / rMax,
  })).sort((a, b) => b.r - a.r);
  HZPTS.forEach(p => {
    const col = cv(SIZECOL[p.s.size] || "--faint");
    g.globalAlpha = p === HZHOVER ? .95 : .58;
    g.fillStyle = col; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = col; g.lineWidth = p === HZHOVER ? 2 : 1; g.stroke();
  });

  /* labels: greedy, most-substantial first, skipped where they would collide */
  const placed = [];
  g.font = '11px "Archivo", sans-serif'; g.textAlign = "left";
  [...HZPTS].sort((a, b) => b.s.sub - a.s.sub).slice(0, 26).forEach(p => {
    const tw = g.measureText(p.s.name).width;
    const box = [p.x + p.r + 4, p.y - 6, tw, 12];
    if (box[0] + tw > x1) { box[0] = p.x - p.r - 4 - tw; }
    if (box[0] < x0) return;
    if (placed.some(q => !(box[0] > q[0] + q[2] + 3 || box[0] + box[2] + 3 < q[0]
                          || box[1] > q[1] + q[3] + 2 || box[1] + box[3] + 2 < q[1]))) return;
    placed.push(box);
    g.fillStyle = cv("--ink");
    g.fillText(p.s.name, box[0], p.y + 3.5);
  });
}
DRAWERS.push(drawHz);

hzCv.onpointermove = e => {
  const r = hzCv.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  let best = null, bd = 14 * 14;
  HZPTS.forEach(p => {
    const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
    if (d < Math.max(bd, p.r * p.r)) { bd = d; best = p; }
  });
  if (best === HZHOVER) return;
  HZHOVER = best; drawHz();
  if (!best) { hzTip.style.opacity = 0; return; }
  const s = best.s;
  hzTip.innerHTML = `<div class="yr">${esc(s.size || "size unrecorded")}</div>
    <div style="font-weight:700;margin-bottom:5px">${esc(s.name)}</div>
    <div class="row"><span class="nm">strikes</span><span class="vv">${fmt(s.n)}</span></div>
    <div class="row"><span class="nm">damaged</span><span class="vv">${fmt1(pct(s.dmg, s.n))}%</span></div>
    <div class="row"><span class="nm">substantial</span><span class="vv">${fmt(s.sub)}</span></div>
    ${s.cost ? `<div class="row"><span class="nm">repairs</span><span class="vv">${money(s.cost)}</span></div>` : ""}`;
  hzTip.style.opacity = 1;
  hzTip.style.left = Math.min(hzCv.clientWidth - 180, best.x + 14) + "px";
  hzTip.style.top = Math.max(4, best.y - 40) + "px";
};
hzCv.onpointerleave = () => { HZHOVER = null; hzTip.style.opacity = 0; drawHz(); };

document.getElementById("hzlegend").innerHTML =
  ["Small", "Medium", "Large"].map(s =>
    `<span><span class="dot" style="width:9px;height:9px;background:var(${SIZECOL[s]})"></span>${s} bodied</span>`).join("")
  + `<span class="quadnote">area ∝ substantial or destroyed</span>`
  + `<span class="quadnote">${SP.length} taxa with ${MIN_N}+ strikes</span>`;

/* ── the same thing as a sortable table ─────────────────────────────────── */
const COLS = [
  { k: "name", t: "Taxon", num: false },
  { k: "n", t: "Strikes", f: v => fmt(v) },
  { k: "dmgR", t: "% damaging", f: v => fmt1(v) + "%", bar: true },
  { k: "sub", t: "Substantial", f: v => fmt(v) },
  { k: "cost", t: "Repair cost", f: v => v ? money(v) : "—" },
  { k: "aos", t: "Hours out of service", f: v => v ? fmt(v) : "—" },
];
const TROWS = SP.map(s => ({ ...s, dmgR: pct(s.dmg, s.n) }));
let SORT = { k: "sub", asc: false };
const tab = document.getElementById("sptab");

function drawTab(){
  const rows = [...TROWS].sort((a, b) => {
    const d = SORT.k === "name" ? String(a.name).localeCompare(b.name) : a[SORT.k] - b[SORT.k];
    return SORT.asc ? d : -d;
  }).slice(0, 40);
  const maxBar = Math.max(...rows.map(r => r.dmgR));
  tab.querySelector("thead").innerHTML = "<tr>" + COLS.map(c =>
    `<th data-k="${c.k}"${SORT.k === c.k ? ` aria-sort="${SORT.asc ? "ascending" : "descending"}"` : ""}>${c.t}</th>`
  ).join("") + "</tr>";
  tab.querySelector("tbody").innerHTML = rows.map(r => "<tr>" + COLS.map(c => {
    if (c.k === "name")
      return `<td><span class="nm"><span class="sz" style="color:var(${SIZECOL[r.size] || "--faint"})">${(r.size || "?")[0]}</span>${esc(r.name)}</span></td>`;
    const v = c.f(r[c.k]);
    if (c.bar)
      return `<td class="mono bar"><i style="width:${(r.dmgR / maxBar * 100).toFixed(1)}%"></i><span>${v}</span></td>`;
    return `<td class="mono">${v}</td>`;
  }).join("") + "</tr>").join("");
  tab.querySelectorAll("thead th").forEach(th => th.onclick = () => {
    const k = th.dataset.k;
    SORT = { k, asc: SORT.k === k ? !SORT.asc : k === "name" };
    drawTab();
  });
}
drawTab();
</script>
