"use strict";

/* ====================== geometri ====================== */

const ZONE_W = { z0: 1080, z1: 1170, z2: 930, z3: 990, z4: 1170, z5: 960, z6: 990 };
const PAD_L = 230;          // plass til linjenavn til venstre
const PAD_R = 260;          // plass til endestasjonstekst
const LANE_TOP = 158;
const ROW = 96;
const PAD_B = 96;
const LABEL_ANGLE = 24;     // grader, etikettene stiger mot høyre
const CHAR_W = 5.5;         // omtrentlig tegnbredde ved 11.5px
const COS = Math.cos(LABEL_ANGLE * Math.PI / 180);

const lineById = new Map(LINES.map(l => [l.id, l]));
const stationById = new Map(STATIONS.map(s => [s.id, s]));

const zoneLayout = [];
{
  let x = PAD_L;
  for (const z of ZONES) {
    const w = ZONE_W[z.id];
    zoneLayout.push({ ...z, x0: x, x1: x + w, w });
    x += w;
  }
}

function yearX(year) {
  const first = zoneLayout[0], last = zoneLayout[zoneLayout.length - 1];
  if (year <= first.from) return first.x0;
  if (year >= last.to) return last.x1;
  for (const z of zoneLayout) {
    if (year >= z.from && year <= z.to) return z.x0 + ((year - z.from) / (z.to - z.from)) * z.w;
  }
  return last.x1;
}

/* Stasjoner plasseres etter årstall, men dyttes mot høyre når etiketten
   til forrige stasjon ellers ville dekket dem. Kartet er skjematisk:
   rekkefølgen er alltid riktig, den eksakte avstanden er det ikke. */
const posX = new Map();
const lineStops = new Map();
for (const line of LINES) {
  const stops = STATIONS.filter(s => s.line === line.id).sort((a, b) => a.year - b.year);
  lineStops.set(line.id, stops);
  let prev = null, need = 0;
  for (const s of stops) {
    let x = yearX(s.year);
    if (prev !== null) x = Math.max(x, prev + need);
    posX.set(s.id, x);
    prev = x;
    need = COS * s.name.length * CHAR_W + 13;
  }
}

const MAP_W = Math.max(...posX.values()) + PAD_R;
const MAP_H = LANE_TOP + (LINES.length - 1) * ROW + PAD_B;

function xOf(id) { return posX.get(id); }
function yOf(lineId) { return LANE_TOP + lineById.get(lineId).lane * ROW; }

const SVGNS = "http://www.w3.org/2000/svg";
function el(name, attrs = {}, text) {
  const n = document.createElementNS(SVGNS, name);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
  if (text !== undefined) n.textContent = text;
  return n;
}

/* ====================== tegning ====================== */

const svg = document.getElementById("map");
svg.setAttribute("viewBox", `0 0 ${MAP_W} ${MAP_H}`);

const gZoom = el("g");
svg.appendChild(gZoom);
const gBands = el("g"), gAxis = el("g"), gLinks = el("g"), gSpines = el("g"), gStops = el("g");
gZoom.append(gBands, gAxis, gLinks, gSpines, gStops);

zoneLayout.forEach((z, i) => {
  gBands.appendChild(el("rect", {
    class: "band" + (i % 2 ? " alt" : ""), x: z.x0, y: 60, width: z.w, height: MAP_H - 60
  }));
  gBands.appendChild(el("line", { class: "band-rule", x1: z.x0, y1: 60, x2: z.x0, y2: MAP_H - 34 }));

  const lab = el("text", { class: "zone-label", x: z.x0 + 16, y: 38 }, z.name);
  lab.addEventListener("click", () => showZone(z.id));
  gBands.appendChild(lab);
  gBands.appendChild(el("text", { class: "zone-years", x: z.x0 + 16, y: 55 },
    z.id === "z0" ? "før 1900" : (z.to === 2026 ? z.from + " \u2013 i dag" : z.from + "\u2013" + z.to)));
});

const TICKS = [1550, 1650, 1750, 1850, 1900, 1920, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
for (const t of TICKS) {
  const x = yearX(t);
  gAxis.appendChild(el("line", { class: "tick", x1: x, y1: MAP_H - 50, x2: x, y2: MAP_H - 42 }));
  gAxis.appendChild(el("text", { class: "tick-label", x, y: MAP_H - 27 }, String(t)));
}

const linkNodes = [];
for (const lk of LINKS) {
  const a = stationById.get(lk.from), b = stationById.get(lk.to);
  if (!a || !b) continue;
  const x1 = xOf(a.id), y1 = yOf(a.line), x2 = xOf(b.id), y2 = yOf(b.line);
  const dx = Math.max(40, Math.min(170, Math.abs(x2 - x1) * 0.45));
  const p = el("path", {
    class: "link " + lk.kind,
    d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  });
  gLinks.appendChild(p);
  linkNodes.push({ node: p, from: lk.from, to: lk.to, kind: lk.kind });
}

const lineGroups = new Map();
const stopGroups = new Map();
const stopNodes = new Map();
const KIND_TEXT = { bygger: "bygger på", strid: "i strid med", avlegger: "avlegger" };

for (const line of LINES) {
  const stops = lineStops.get(line.id);
  if (!stops.length) continue;
  const y = yOf(line.id);
  const xa = xOf(stops[0].id), xb = xOf(stops[stops.length - 1].id);

  const g = el("g");
  lineGroups.set(line.id, g);
  gSpines.appendChild(g);

  g.appendChild(el("path", {
    class: "spine", d: `M ${xa} ${y} L ${xb} ${y}`,
    stroke: line.color, "stroke-dasharray": line.dash ? "17 10" : null
  }));

  const hit = el("path", { class: "lane-hit", d: `M ${xa} ${y} L ${xb} ${y}` });
  hit.addEventListener("click", () => showLine(line.id));
  g.appendChild(hit);

  const nameNode = el("text", { class: "line-name", x: xa - 18, y, fill: line.color }, line.name);
  nameNode.style.cursor = "pointer";
  nameNode.addEventListener("click", () => showLine(line.id));
  g.appendChild(nameNode);

  const last = stops[stops.length - 1];
  if (last.kind === "end") {
    g.appendChild(el("line", {
      class: "terminus-bar", x1: xb + 12, y1: y - 11, x2: xb + 12, y2: y + 11, stroke: line.color
    }));
  }

  const sg = el("g");
  stopGroups.set(line.id, sg);
  gStops.appendChild(sg);

  for (const s of stops) {
    const x = xOf(s.id);
    const node = el("g", {
      class: "stop" + (s.kind === "major" ? " major" : ""),
      tabindex: "0", role: "button",
      "aria-label": `${s.name}, ${s.year}, ${line.name}`
    });
    node.appendChild(el("circle", { class: "halo", cx: x, cy: y, r: 14 }));
    node.appendChild(el("circle", {
      class: "dot", cx: x, cy: y, r: s.kind === "major" ? 7 : 5, stroke: line.color
    }));
    const tx = x + 9, ty = y - 14;
    node.appendChild(el("text", {
      class: "label", x: tx, y: ty, transform: `rotate(-${LABEL_ANGLE} ${tx} ${ty})`
    }, s.name));
    if (s.kind === "major") node.appendChild(el("text", { class: "yr", x, y: y + 21 }, String(s.year)));

    node.addEventListener("click", () => select(s.id));
    node.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(s.id); }
    });
    sg.appendChild(node);
    stopNodes.set(s.id, node);
  }
}

/* ====================== tilstand ====================== */

const hiddenLines = new Set();

function applyVisibility() {
  for (const line of LINES) {
    const on = !hiddenLines.has(line.id);
    lineGroups.get(line.id)?.classList.toggle("hidden", !on);
    stopGroups.get(line.id)?.classList.toggle("hidden", !on);
  }
  for (const l of linkNodes) {
    const a = stationById.get(l.from), b = stationById.get(l.to);
    l.node.classList.toggle("hidden", hiddenLines.has(a.line) || hiddenLines.has(b.line));
  }
}

function clearEmphasis() {
  for (const n of stopNodes.values()) n.classList.remove("sel", "dim");
  for (const g of lineGroups.values()) g.classList.remove("dim");
  for (const l of linkNodes) l.node.classList.remove("on");
}

function select(id) {
  const s = stationById.get(id);
  if (!s) return;
  clearEmphasis();
  const related = new Set([id]);
  for (const l of linkNodes) {
    if (l.from === id || l.to === id) { l.node.classList.add("on"); related.add(l.from); related.add(l.to); }
  }
  for (const [sid, node] of stopNodes) {
    if (sid === id) node.classList.add("sel");
    else if (!related.has(sid)) node.classList.add("dim");
  }
  for (const [lid, g] of lineGroups) if (lid !== s.line) g.classList.add("dim");
  showStation(s);
  panTo(xOf(s.id), yOf(s.line));
}

/* ====================== panel ====================== */

const panel = document.getElementById("panel");
const panelBody = document.getElementById("panel-body");

function openPanel(html) {
  panelBody.innerHTML = html;
  panel.classList.add("open");
  panelBody.querySelectorAll("[data-goto]").forEach(b =>
    b.addEventListener("click", () => select(b.dataset.goto)));
  const iso = panelBody.querySelector("[data-isolate]");
  if (iso) iso.addEventListener("click", () => isolate(iso.dataset.isolate));
}
function closePanel() { panel.classList.remove("open"); clearEmphasis(); }
document.getElementById("panel-close").addEventListener("click", closePanel);
document.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });

function esc(t) { return String(t).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

function showStation(s) {
  const line = lineById.get(s.line);
  const zone = zoneLayout.find(z => s.year >= z.from && s.year <= z.to) || zoneLayout[0];
  const inn = [], ut = [];
  for (const l of LINKS) {
    if (l.to === s.id && stationById.has(l.from)) inn.push([stationById.get(l.from), l.kind]);
    if (l.from === s.id && stationById.has(l.to)) ut.push([stationById.get(l.to), l.kind]);
  }
  const rel = arr => arr.map(([t, k]) => {
    const c = lineById.get(t.line).color;
    return `<li><button data-goto="${t.id}"><span style="color:${c}">\u25CF</span><span>${esc(t.name)}</span><span class="tag">${t.year} \u00b7 ${KIND_TEXT[k]}</span></button></li>`;
  }).join("");
  const kindNote = s.kind === "end" ? " \u00b7 endestasjon" : s.kind === "start" ? " \u00b7 utgangspunkt" : "";
  openPanel(`
    <p class="kicker"><i style="background:${line.color}"></i>${esc(line.name)}</p>
    <h2>${esc(s.name)}</h2>
    <p class="meta">${s.year} \u00b7 ${esc(zone.name)}${s.ch ? " \u00b7 kapittel " + s.ch : ""}${kindNote}</p>
    <p class="body">${esc(s.desc)}</p>
    ${inn.length ? `<h3>Bygger på</h3><ul class="rel">${rel(inn)}</ul>` : ""}
    ${ut.length ? `<h3>Fører videre til</h3><ul class="rel">${rel(ut)}</ul>` : ""}
    <button class="isolate" data-isolate="${line.id}">Vis bare denne linjen</button>
  `);
}

function showLine(id) {
  const line = lineById.get(id);
  const stops = lineStops.get(id);
  const last = stops[stops.length - 1];
  const list = stops.map(s =>
    `<li><button data-goto="${s.id}"><span class="tag">${s.year}</span><span>${esc(s.name)}</span></button></li>`).join("");
  openPanel(`
    <p class="kicker"><i style="background:${line.color}"></i>Linje</p>
    <h2>${esc(line.name)}</h2>
    <p class="meta">${stops[0].year}\u2013${last.year} \u00b7 ${stops.length} stasjoner${last.kind === "end" ? " \u00b7 opphører" : ""}</p>
    <p class="body">${esc(line.blurb)}</p>
    <h3>Stasjoner</h3><ul class="rel">${list}</ul>
    <button class="isolate" data-isolate="${line.id}">Vis bare denne linjen</button>
  `);
}

function showZone(id) {
  const z = zoneLayout.find(z => z.id === id);
  const stops = STATIONS.filter(s => s.year >= z.from && s.year <= z.to);
  const lines = new Set(stops.map(s => s.line));
  const list = stops.filter(s => s.kind === "major").sort((a, b) => a.year - b.year).map(s => {
    const c = lineById.get(s.line).color;
    return `<li><button data-goto="${s.id}"><span style="color:${c}">\u25CF</span><span>${esc(s.name)}</span><span class="tag">${s.year}</span></button></li>`;
  }).join("");
  openPanel(`
    <p class="kicker">Sone</p>
    <h2>${esc(z.name)}</h2>
    <p class="meta">${z.id === "z0" ? "før 1900" : z.from + "\u2013" + (z.to === 2026 ? "i dag" : z.to)} \u00b7 ${stops.length} stasjoner på ${lines.size} linjer</p>
    <p class="body">${esc(z.note)}</p>
    ${list ? `<h3>Hovedstasjoner</h3><ul class="rel">${list}</ul>` : ""}
  `);
  panTo(z.x0 + z.w / 2, MAP_H / 2);
}

function isolate(id) {
  const alreadyOnly = hiddenLines.size === LINES.length - 1 && !hiddenLines.has(id);
  hiddenLines.clear();
  if (!alreadyOnly) for (const l of LINES) if (l.id !== id) hiddenLines.add(l.id);
  syncLegend();
  applyVisibility();
}

/* ====================== tegnforklaring ====================== */

const legend = document.getElementById("legend");
for (const line of LINES) {
  const li = document.createElement("li");
  const b = document.createElement("button");
  b.setAttribute("aria-pressed", "true");
  b.dataset.line = line.id;
  b.innerHTML = `<span class="swatch" style="background:${line.color}"></span><span>${esc(line.name)}</span>`;
  b.addEventListener("click", e => {
    if (e.shiftKey) { isolate(line.id); return; }
    hiddenLines.has(line.id) ? hiddenLines.delete(line.id) : hiddenLines.add(line.id);
    syncLegend(); applyVisibility();
  });
  li.appendChild(b);
  legend.appendChild(li);
}
function syncLegend() {
  legend.querySelectorAll("button").forEach(b =>
    b.setAttribute("aria-pressed", hiddenLines.has(b.dataset.line) ? "false" : "true"));
}
document.getElementById("show-all").addEventListener("click", () => {
  hiddenLines.clear(); syncLegend(); applyVisibility();
});

/* ====================== søk ====================== */

const search = document.getElementById("search");
const results = document.getElementById("results");
const norm = t => t.toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a");

search.addEventListener("input", () => {
  const q = norm(search.value.trim());
  results.innerHTML = "";
  if (q.length < 2) return;
  for (const s of STATIONS.filter(s => norm(s.name).includes(q) || norm(s.desc).includes(q)).slice(0, 30)) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.innerHTML = `<span style="color:${lineById.get(s.line).color}">\u25CF</span> ${esc(s.name)} <span class="yr">${s.year}</span>`;
    b.addEventListener("click", () => select(s.id));
    li.appendChild(b);
    results.appendChild(li);
  }
});

/* ====================== zoom og panorering ====================== */

const scroller = document.getElementById("scroller");
let k = 1;
function setZoom(next, anchor) {
  const old = k;
  k = Math.max(0.2, Math.min(2.6, next));
  const cx = anchor ? anchor.x : scroller.clientWidth / 2;
  const cy = anchor ? anchor.y : scroller.clientHeight / 2;
  const fx = (scroller.scrollLeft + cx) / old;
  const fy = (scroller.scrollTop + cy) / old;
  svg.setAttribute("width", MAP_W * k);
  svg.setAttribute("height", MAP_H * k);
  scroller.scrollLeft = fx * k - cx;
  scroller.scrollTop = fy * k - cy;
}
function panTo(x, y) {
  scroller.scrollTo({
    left: x * k - scroller.clientWidth / 2,
    top: y * k - scroller.clientHeight / 2,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
  });
}
document.getElementById("zoom-in").addEventListener("click", () => setZoom(k * 1.25));
document.getElementById("zoom-out").addEventListener("click", () => setZoom(k / 1.25));
document.getElementById("zoom-fit").addEventListener("click", () => {
  setZoom((scroller.clientHeight - 24) / MAP_H);
  scroller.scrollTo({ left: 0, top: 0 });
});

scroller.addEventListener("wheel", e => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const r = scroller.getBoundingClientRect();
  setZoom(k * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX - r.left, y: e.clientY - r.top });
}, { passive: false });

let drag = null;
scroller.addEventListener("pointerdown", e => {
  if (e.target.closest(".stop, .zone-label, .lane-hit, .line-name")) return;
  drag = { x: e.clientX, y: e.clientY, l: scroller.scrollLeft, t: scroller.scrollTop };
  scroller.classList.add("dragging");
  scroller.setPointerCapture(e.pointerId);
});
scroller.addEventListener("pointermove", e => {
  if (!drag) return;
  scroller.scrollLeft = drag.l - (e.clientX - drag.x);
  scroller.scrollTop = drag.t - (e.clientY - drag.y);
});
["pointerup", "pointercancel"].forEach(t =>
  scroller.addEventListener(t, () => { drag = null; scroller.classList.remove("dragging"); }));

/* ====================== tema ====================== */

const themeBtn = document.getElementById("theme");
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  themeBtn.textContent = t === "light" ? "Mørkt" : "Lyst";
  try { localStorage.setItem("teorikart-tema", t); } catch (_) {}
}
let startTheme = "dark";
try { startTheme = localStorage.getItem("teorikart-tema") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); } catch (_) {}
setTheme(startTheme);
themeBtn.addEventListener("click", () =>
  setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));

/* ====================== oppstart ====================== */

applyVisibility();
setZoom(Math.max(0.42, Math.min(0.85, (scroller.clientHeight - 24) / MAP_H)));
scroller.scrollLeft = Math.max(0, (zoneLayout[1].x0 - PAD_L - 20) * k);
scroller.scrollTop = 0;
