<script>
/* ── 03a who files ───────────────────────────────────────────────────────
   Share of each year's reports by the channel they arrived through. Drawn as
   shares rather than counts: the point is the change in composition, and the
   counts are already the thing under suspicion.                            */
const SRC = D.sources.names;
/* Warm-to-cool ramp mixed from the two ends of the page's own palette rather
   than a categorical set -- these are channels of one process, not rivals. */
const SRCCOL = ["--c-dmg", "--c-eff", "--c-rate", "--c-all", "--c-sub", "--gold", "--accent", "--faint"];
const srcCv = document.getElementById("src");
let SHOVER = -1;

function drawSrc(){
  const H = Math.max(220, Math.min(300, srcCv.parentNode.clientWidth * 0.36));
  const { g, w, h } = hidpi(srcCv, H);
  const narrow = w < 560;
  const L = 40, R = narrow ? 78 : 122, T = 12, B = 26;
  const x0 = L, x1 = w - R, y0 = T, y1 = h - B;
  const X = i => x0 + (x1 - x0) * i / (YEARS.length - 1);
  const Y = f => y1 - f * (y1 - y0);

  const shares = D.sources.byYear.map(row => {
    const tot = row.reduce((a, b) => a + b, 0) || 1;
    return row.map(v => v / tot);
  });

  let base = new Array(YEARS.length).fill(0);
  SRC.forEach((name, si) => {
    const col = cv(SRCCOL[si % SRCCOL.length]);
    g.fillStyle = col; g.globalAlpha = .82;
    g.beginPath();
    for (let i = 0; i < YEARS.length; i++) g[i ? "lineTo" : "moveTo"](X(i), Y(base[i]));
    for (let i = YEARS.length - 1; i >= 0; i--) g.lineTo(X(i), Y(base[i] + shares[i][si]));
    g.closePath(); g.fill(); g.globalAlpha = 1;
    base = base.map((b, i) => b + shares[i][si]);
  });

  /* labels on the right, at each band's final thickness, skipping slivers */
  g.font = '10.5px "IBM Plex Mono", monospace'; g.textAlign = "left";
  let acc = 0;
  const li = YEARS.length - 2;                       // last full-ish year
  SRC.forEach((name, si) => {
    const s = shares[li][si], mid = acc + s / 2; acc += s;
    if (s < 0.045) return;
    g.fillStyle = cv(SRCCOL[si % SRCCOL.length]);
    g.fillRect(x1 + 6, Y(mid) - 4, 8, 8);
    g.fillStyle = cv("--muted");
    const label = name.replace("FAA Form ", "");
    g.fillText(narrow ? label.slice(0, 9) : label, x1 + 19, Y(mid) + 3.5);
  });

  g.textAlign = "right"; g.fillStyle = cv("--faint");
  [0, .25, .5, .75, 1].forEach(f => g.fillText(Math.round(f * 100) + "%", x0 - 7, Y(f) + 3.5));
  xLabels(g, x0, x1, h - 8, YEARS, cv("--faint"));
}
DRAWERS.push(drawSrc);

/* ── 03b who identifies ─────────────────────────────────────────────────
   Share of each year's strikes pinned to a named taxon, and the much smaller
   share whose remains were sent away for identification. */
const idCv = document.getElementById("ident");
function drawIdent(){
  const H = Math.max(180, Math.min(230, idCv.parentNode.clientWidth * 0.28));
  const { g, w, h } = hidpi(idCv, H);
  const narrow = w < 560;
  const L = 40, R = narrow ? 86 : 152, T = 12, B = 26;
  const x0 = L, x1 = w - R, y0 = T, y1 = h - B;
  const X = i => x0 + (x1 - x0) * i / (YEARS.length - 1);
  const Y = f => y1 - f * (y1 - y0);

  g.strokeStyle = cv("--line"); g.lineWidth = 1;
  [0, .25, .5, .75, 1].forEach(f => {
    g.beginPath(); g.moveTo(x0, Y(f)); g.lineTo(x1, Y(f)); g.stroke();
  });
  g.font = '10px "IBM Plex Mono", monospace'; g.textAlign = "right"; g.fillStyle = cv("--faint");
  [0, .25, .5, .75, 1].forEach(f => g.fillText(Math.round(f * 100) + "%", x0 - 7, Y(f) + 3.5));
  xLabels(g, x0, x1, h - 8, YEARS, cv("--faint"));

  const rows = narrow ? [
    ["ident", "--c-rate", "identified"],
    ["remains", "--gold", "remains sent"],
  ] : [
    ["ident", "--c-rate", "identified to a taxon"],
    ["remains", "--gold", "remains sent for ID"],
  ];
  g.textAlign = "left"; g.font = '10.5px "IBM Plex Mono", monospace';
  rows.forEach(([k, col, label]) => {
    const pts = YEARS.map((y, i) => [X(i), Y(D.series[k][i] / D.series.all[i])]);
    line(g, pts, cv(col), 2);
    const last = pts[pts.length - 1];
    g.fillStyle = cv(col); g.fillRect(x1 + 6, last[1] - 4, 8, 8);
    g.fillStyle = cv("--muted"); g.fillText(label, x1 + 19, last[1] + 3.5);
  });
}
DRAWERS.push(drawIdent);
</script>
