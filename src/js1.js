<script>
/* ── bootstrap ───────────────────────────────────────────────────────────
   One JSON blob, inlined uncompressed. It is ~1 MB of very repetitive JSON
   and GitHub Pages serves the document gzipped, so compressing it by hand
   into base64 would have cost a DecompressionStream dependency to save
   nothing on the wire.                                                    */
const D = JSON.parse(document.getElementById("payload").textContent);
const YEARS = D.meta.years;

/* Theme. Stored per viewer; the canvases read their colours from CSS custom
   properties, so every redraw has to happen after the attribute flips.     */
const root = document.documentElement;
let stored = null;
try { stored = localStorage.getItem("row-theme"); } catch (e) {}
if (stored) root.setAttribute("data-theme", stored);
document.getElementById("themebtn").onclick = () => {
  const dark = getComputedStyle(root).getPropertyValue("--paper").trim().toLowerCase().startsWith("#15");
  const next = dark ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try { localStorage.setItem("row-theme", next); } catch (e) {}
  redrawAll();
};

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const cv = n => getComputedStyle(root).getPropertyValue(n).trim();
const fmt = n => n.toLocaleString("en-US");
const fmt1 = n => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
const pct = (a, b) => b ? (100 * a / b) : 0;
/* Rates always carry one decimal, so a row reading 35 does not sit next to
   one reading 52.2 and look like a different kind of number. */
const fmtR = n => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = n => n >= 1e9 ? "$" + (n / 1e9).toFixed(1) + "B"
                 : n >= 1e6 ? "$" + (n / 1e6).toFixed(0) + "M"
                 : "$" + fmt(Math.round(n));

/* Every canvas registers a draw function here so a theme flip or a resize
   repaints all of them from the new custom-property values. */
const DRAWERS = [];
function redrawAll(){ DRAWERS.forEach(f => f()); }
let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(redrawAll, 120); });

/* High-DPI canvas: size the backing store to devicePixelRatio and hand back
   a context already scaled to CSS pixels. */
function hidpi(c, cssH){
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = c.clientWidth || c.parentNode.clientWidth;
  c.width = Math.round(w * dpr); c.height = Math.round(cssH * dpr);
  c.style.height = cssH + "px";
  const g = c.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, cssH);
  return { g, w, h: cssH };
}

function line(g, pts, col, wdt, dash){
  g.strokeStyle = col; g.lineWidth = wdt; g.lineJoin = "round"; g.lineCap = "round";
  if (dash) g.setLineDash(dash);
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  if (dash) g.setLineDash([]);
}

function xLabels(g, x0, x1, y, years, col){
  g.fillStyle = col; g.font = '10px "IBM Plex Mono", monospace'; g.textAlign = "center";
  const step = (x1 - x0) / (years.length - 1);
  years.forEach((yr, i) => {
    if (yr % 5) return;
    const x = x0 + step * i;
    g.fillText(String(yr), x, y);
  });
}

/* The last year in the database is partial -- it is whatever has been filed
   and published so far this year -- so nothing that compares years is allowed
   to include it. */
const LAST_FULL = YEARS[YEARS.length - 1] - 1;
const IDX_LAST_FULL = YEARS.indexOf(LAST_FULL);
</script>
