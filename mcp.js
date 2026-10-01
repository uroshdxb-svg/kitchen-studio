// Kitchen Studio MCP server (remote, Streamable HTTP, JSON responses).
// Lets a person's own Claude work on the kitchens saved in their Kitchen Studio account:
// search the catalogue, list/open/create kitchens, add/move/change/remove items, check the layout, read the schedule.
// Exporting drawings is deliberately NOT here: exports stay inside the app (paid later).
//
// Auth: OAuth 2.1 via Supabase Auth's OAuth server. The worker only checks the bearer token with Supabase and then talks
// to the database AS THAT USER, so row-level security keeps every call inside the user's own kitchens.
import cfg from "./site.config.json" with { type: "json" };

const SUPABASE = cfg.supabaseUrl.replace(/\/$/, "");
const ANON = cfg.supabaseAnonKey;
const SITE = (cfg.siteUrl || "https://kitchenstudio.design").replace(/\/$/, "");
const RESOURCE = SITE + "/mcp";
const PRM_PATH = "/.well-known/oauth-protected-resource";
const SERVER = { name: "kitchen-studio", title: "Kitchen Studio", version: "1.0.0" };
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_BODY = 300000, MAX_ITEMS_PER_CALL = 40, MAX_ITEMS = 400, MAX_DATA = 1400000;

/* ---------- fabricated types: keep in step with SS / SSR / ARCH in app.js (mcp.test.mjs checks this) ---------- */
export const SS = {
  table: { n: "Work table", w: 1500, d: 700, h: 900, mount: "floor", opts: ["Undershelf", "Upstand 100 mm", "Drawer", "Castors"] },
  cab: { n: "Cabinet table, sliding doors", w: 1500, d: 700, h: 900, mount: "floor", opts: ["Upstand 100 mm", "Mid shelf", "Heated"] },
  sink1: { n: "Sink unit, 1 bowl", w: 1200, d: 700, h: 900, mount: "floor", water: true, drain: true, opts: ["Upstand 100 mm", "Undershelf", "Left drainer", "Right drainer"] },
  sink2: { n: "Sink unit, 2 bowls", w: 1500, d: 700, h: 900, mount: "floor", water: true, drain: true, opts: ["Upstand 100 mm", "Undershelf", "Left drainer", "Right drainer"] },
  sink3: { n: "Pot wash sink, 3 bowls", w: 2100, d: 700, h: 900, mount: "floor", water: true, drain: true, opts: ["Upstand 100 mm", "Undershelf"] },
  hand: { n: "Hand wash basin, knee operated", w: 400, d: 350, h: 850, mount: "floor", water: true, drain: true, opts: ["Soap dispenser", "Splash guard"] },
  landing: { n: "Dishwasher landing table", w: 1200, d: 750, h: 900, mount: "floor", opts: ["Pre-rinse sink", "Upstand 100 mm", "Rack slide", "Undershelf"] },
  rack: { n: "Storage rack, 4 tier", w: 1200, d: 500, h: 1800, mount: "floor", opts: ["Perforated shelves", "Castors"] },
  trolley: { n: "GN tray trolley", w: 460, d: 620, h: 1700, mount: "floor", opts: ["Castors"] },
  wshelf: { n: "Wall shelf", w: 1200, d: 300, h: 40, mount: "over", z: 1500, opts: ["Double tier", "Pot rail"] },
  wcab: { n: "Wall cabinet", w: 1200, d: 400, h: 600, mount: "over", z: 1400, opts: ["Sliding doors", "Hinged doors"] },
  hood: { n: "Exhaust hood, wall type", w: 2000, d: 1200, h: 500, mount: "over", z: 2000, opts: ["Baffle filters", "Lights", "Fresh-air plenum"] },
  gantry: { n: "Pass shelf / gantry", w: 1800, d: 350, h: 400, mount: "top", opts: ["Heat lamps", "Ticket rail", "Double tier"] },
};
export const SSR = {
  rcounter: { n: "Counter chiller", w: 1300, d: 700, h: 865, kw: 0.25, opts: ["Freezer", "Upstand 100 mm"],
    name: (w, o) => `Counter ${o.includes("Freezer") ? "freezer" : "chiller"}, ${Math.max(1, Math.round((w - 340) / 460))} doors, ${w} mm` },
  rlowboy: { n: "Lowboy chiller, drawers", w: 1700, d: 900, h: 600, kw: 0.3, opts: ["2 drawers", "4 drawers", "6 drawers", "Freezer"],
    name: (w, o) => `Lowboy ${o.includes("Freezer") ? "freezer" : "chiller"}, ${(o.find(x => /drawers/.test(x)) || "4 drawers")}, ${w} mm` },
  rsaladf: { n: "Saladette, flush GN top", w: 1800, d: 700, h: 865, kw: 0.35, opts: [], name: w => `Saladette prep fridge, flush GN top with sliding lid, ${w} mm` },
  rsaladr: { n: "Saladette, raised GN rail", w: 1800, d: 700, h: 865, kw: 0.35, opts: [], name: w => `Saladette prep fridge, raised GN rail with lid, ${w} mm` },
};
const WALL_T = 120;
export const ARCH = { door: { n: "Door, single", w: 900, d: WALL_T }, door2: { n: "Door, double", w: 1600, d: WALL_T }, window: { n: "Window", w: 1500, d: WALL_T },
  column: { n: "Column", w: 400, d: 400 }, drain: { n: "Floor drain", w: 250, d: 250 }, gas: { n: "Gas point", w: 220, d: 220 },
  water: { n: "Water point", w: 220, d: 220 }, power: { n: "Electrical panel", w: 220, d: 220 } };
const MATS = ["AISI 304, 1.2 mm", "AISI 304, 1.5 mm", "AISI 316, 1.5 mm", "AISI 430, 1.0 mm"];

/* ---------- geometry (same conventions as the app) ---------- */
// Room origin = inside north-west corner. x runs east, y runs south, mm.
// rot 0 = back against the NORTH wall facing south; 90 = back to EAST wall; 180 = back to SOUTH wall; 270 = back to WEST wall.
export const fw = i => (i.rot % 180 ? i.d : i.w), fd = i => (i.rot % 180 ? i.w : i.d);
const hit = (a, b) => a.x < b.x + fw(b) - 1 && a.x + fw(a) > b.x + 1 && a.y < b.y + fd(b) - 1 && a.y + fd(a) > b.y + 1;
function inPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function insideRoom(it, R) { const e = 8, x0 = it.x + e, y0 = it.y + e, x1 = it.x + fw(it) - e, y1 = it.y + fd(it) - e;
  if (R.poly && R.poly.length > 2) return [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, (y0 + y1) / 2]].every(p => inPoly(p[0], p[1], R.poly));
  return x0 >= 0 && y0 >= 0 && x1 <= R.w && y1 <= R.d; }
function doorZone(a) { const W = fw(a), D = fd(a), l = a.archType === "door2" ? a.w / 2 : a.w;
  return a.rot === 0 ? [a.x, a.y + D, a.x + W, a.y + D + l] : a.rot === 180 ? [a.x, a.y - l, a.x + W, a.y] : a.rot === 270 ? [a.x + W, a.y, a.x + W + l, a.y + D] : [a.x - l, a.y, a.x, a.y + D]; }
function blocksDoor(it, items) { if (it.kind === "arch" || it.mount !== "floor") return false; const r = [it.x, it.y, it.x + fw(it), it.y + fd(it)];
  return items.some(a => a.kind === "arch" && /^door/.test(a.archType) && (z => r[0] < z[2] - 1 && r[2] > z[0] + 1 && r[1] < z[3] - 1 && r[3] > z[1] + 1)(doorZone(a))); }
function baseUnder(it, items) { const cx = it.x + fw(it) / 2, cy = it.y + fd(it) / 2; let best = null;
  for (const o of items) { if (o.mount !== "floor" || o === it || o.kind === "arch") continue; if (cx >= o.x && cx <= o.x + fw(o) && cy >= o.y && cy <= o.y + fd(o) && (!best || o.h > best.h)) best = o; } return best; }
const zOf = (it, items) => it.mount === "floor" || it.mount === "arch" ? 0 : it.mount === "over" ? (it.z || 1500) : (baseUnder(it, items)?.h ?? 900);
function collides(it, items) { if (it.mount === "over" || it.mount === "arch" || it.ssType === "gantry") return false;
  return items.some(o => o !== it && o.mount === it.mount && o.ssType !== "gantry" && hit(it, o)); }
const needsHood = it => it.kind === "eq" && it.power !== "none" && it.power !== undefined && /^(Combi ovens|Cooking|Fryers)$/.test(it.cat || "") && !/ventless|oven stand/i.test((it.name || "") + " " + (it.model || ""));
function underHood(it, items) { const hoods = items.filter(h => h.ssType === "hood");
  const pts = [[it.x + 20, it.y + 20], [it.x + fw(it) - 20, it.y + 20], [it.x + 20, it.y + fd(it) - 20], [it.x + fw(it) - 20, it.y + fd(it) - 20]];
  return pts.every(([x, y]) => hoods.some(h => x >= h.x && x <= h.x + fw(h) && y >= h.y && y <= h.y + fd(h))); }
const label = it => it.kind === "arch" ? it.name : it.kind === "ss" ? it.name : `${it.brand} ${it.model}`;
const eqList = items => items.filter(i => i.kind !== "arch");
const wallOf = it => ({ 0: "north", 90: "east", 180: "south", 270: "west" })[it.rot];
const r0 = n => Math.round(n);

/* ---------- catalogue (built into dist/app/catalogue.json by build.mjs) ---------- */
let CAT = null;
async function catalogue(env, origin) {
  if (CAT) return CAT;
  const r = await env.ASSETS.fetch(new Request(origin + "/app/catalogue.json"));
  const rows = await r.json();
  CAT = rows.map(r => ({ key: `${r[0]}|${r[1]}`, brand: r[0], model: r[1], cat: r[2], name: r[3], w: r[4], d: r[5], h: r[6], mount: r[7], power: r[8], kw: r[9], elec: r[10], water: !!r[11], drain: !!r[12], src: r[13] }));
  return CAT;
}

/* ---------- Supabase as the user ---------- */
async function userFromToken(token) {
  const r = await fetch(SUPABASE + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const u = await r.json(); return u && u.id ? { id: u.id, email: u.email || null } : null;
}
function db(token) {
  const H = { apikey: ANON, Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const call = async (path, init = {}) => {
    const r = await fetch(SUPABASE + "/rest/v1/" + path, { ...init, headers: { ...H, ...(init.headers || {}) } });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) { j = t; }
    if (!r.ok) throw new ToolError(r.status === 401 || r.status === 403 ? "Not allowed. Reconnect Kitchen Studio in Claude." : `Database error (${r.status}): ${(j && j.message) || t}`.slice(0, 300));
    return j;
  };
  return {
    list: () => call("projects?select=id,name,summary,updated_at,is_public&order=updated_at.desc&limit=200"),
    get: async id => { const rows = await call(`projects?select=id,name,data,version,updated_at&id=eq.${encodeURIComponent(id)}`); if (!rows || !rows.length) throw new ToolError("No kitchen with that id in your account. Use list_kitchens."); return rows[0]; },
    create: (owner, name, data) => call("projects?select=id,name,version", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner, name, data, summary: summary(data) }) }).then(r => r[0]),
    save: (id, version, data, name) => { const row = { data, summary: summary(data), updated_at: new Date().toISOString() }; if (name) row.name = name;
      return call(`projects?id=eq.${encodeURIComponent(id)}&version=eq.${version}&select=version,updated_at`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) }).then(r => (r && r[0]) || null); },
  };
}
const summary = p => { try { const R = p.room, n = (p.items || []).filter(i => i.kind !== "arch").length; return `${(R.w / 1000).toFixed(1)} × ${(R.d / 1000).toFixed(1)} m · ${n} item${n === 1 ? "" : "s"}`; } catch (_) { return ""; } };
class ToolError extends Error {}

// read, change, write back with the row version; one retry if the app saved in between
async function editKitchen(D, id, fn) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await D.get(id); const p = row.data || {}; p.items = p.items || []; p.room = p.room || { w: 4000, d: 3000, h: 3000 };
    const out = await fn(p, row);
    p.at = Date.now();
    if (JSON.stringify(p).length > MAX_DATA) throw new ToolError("The kitchen would be too large to save.");
    const saved = await D.save(id, row.version, p, out && out.rename);
    if (saved) return { p, out, version: saved.version };
  }
  throw new ToolError("The kitchen was changed somewhere else at the same moment. Call get_kitchen and try again.");
}

/* ---------- describing a kitchen ---------- */
function describe(p, opts = {}) {
  const items = p.items || [], R = p.room || {};
  const eq = eqList(items);
  const out = {
    name: p.name || null,
    room: { width_mm: R.w, depth_mm: R.d, ceiling_mm: R.h, traced_outline: R.poly && R.poly.length > 2 ? R.poly : undefined },
    coordinates: "x east from the inside north-west corner, y south, mm. rot 0 = back to north wall, 90 = east, 180 = south, 270 = west.",
    items: eq.map((it, i) => { const base = it.mount === "top" ? baseUnder(it, items) : null;
      return { no: i + 1, id: it.id, label: label(it), kind: it.kind === "ss" ? `fabricated:${it.ssType}` : it.conf === "verified" ? "catalogue" : "custom", category: it.cat,
        x_mm: it.x, y_mm: it.y, rot: it.rot, against_wall: wallOf(it), width_mm: it.w, depth_mm: it.d, height_mm: it.h, mount: it.mount,
        bottom_at_mm: zOf(it, items), sits_on: base ? base.id : undefined, power: it.power, kw: it.kw ?? null, water: !!it.water, drain: !!it.drain,
        options: it.opts && it.opts.length ? it.opts : undefined, size_editable: it.kind === "ss" || it.conf !== "verified" }; }),
    openings: items.filter(i => i.kind === "arch").map(a => ({ id: a.id, type: a.archType, wall: a.mount === "arch" ? (a.rot === 0 ? "north" : a.rot === 180 ? "south" : a.rot === 270 ? "west" : "east") : undefined, x_mm: a.x, y_mm: a.y, width_mm: a.w })),
  };
  if (opts.checks !== false) out.checks = checks(p);
  return out;
}
function checks(p) {
  const items = p.items || [], R = p.room || {}, eq = eqList(items), no = it => eq.indexOf(it) + 1, issues = [];
  for (const it of eq) {
    if (collides(it, items)) issues.push({ no: no(it), id: it.id, problem: `overlaps another ${it.mount === "top" ? "countertop" : "floor"} item` });
    if (!insideRoom(it, R)) issues.push({ no: no(it), id: it.id, problem: "outside the room" });
    if (blocksDoor(it, items)) issues.push({ no: no(it), id: it.id, problem: "blocks a door swing" });
    if (it.mount === "top" && !baseUnder(it, items)) issues.push({ no: no(it), id: it.id, problem: "countertop item with nothing under it (shown at 900 mm)" });
    if (needsHood(it) && !underHood(it, items)) issues.push({ no: no(it), id: it.id, problem: "cooking equipment not fully under a hood" });
  }
  return { ok: issues.length === 0, issues };
}
function schedule(p) {
  const eq = eqList(p.items || []), tot = { electrical_kw: 0, gas_kw: 0, water_points: 0, drain_points: 0 }, missing = [];
  const rows = eq.map((it, i) => { if (it.power === "electric" && it.kw) tot.electrical_kw += it.kw; if (it.power === "gas" && it.kw) tot.gas_kw += it.kw;
    if (it.water) tot.water_points++; if (it.drain) tot.drain_points++; if ((it.power === "electric" || it.power === "gas") && !it.kw) missing.push(i + 1);
    return { no: i + 1, item: label(it), size_mm: `${it.w} × ${it.d} × ${it.h}`, power: it.power, kw: it.kw ?? null, electrical: it.elec || null, water: !!it.water, drain: !!it.drain, source: it.src || null }; });
  tot.electrical_kw = Math.round(tot.electrical_kw * 100) / 100; tot.gas_kw = Math.round(tot.gas_kw * 100) / 100;
  return { totals: tot, items_without_load: missing, items: rows, note: "Drawing exports (PDF set) are made in the Kitchen Studio app." };
}

/* ---------- building items ---------- */
const newId = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = (v, lo, hi, name) => { const n = Number(v); if (!Number.isFinite(n) || n < lo || n > hi) throw new ToolError(`${name} must be a number between ${lo} and ${hi}.`); return Math.round(n); };
async function makeItem(spec, env, origin) {
  if (spec.catalogue) {
    const cat = await catalogue(env, origin); const k = String(spec.catalogue).toLowerCase();
    const row = cat.find(r => r.key.toLowerCase() === k) || cat.find(r => r.model.toLowerCase() === k);
    if (!row) throw new ToolError(`"${spec.catalogue}" is not in the catalogue. Use search_equipment, or add it as custom equipment.`);
    const { key, ...r } = row; return { kind: "eq", ...r, conf: "verified" };
  }
  if (spec.fabricated) {
    const t = String(spec.fabricated), opts = Array.isArray(spec.options) ? spec.options.map(String) : [], mat = MATS.includes(spec.material) ? spec.material : MATS[0];
    if (SS[t]) { const s = SS[t], bad = opts.filter(o => !s.opts.includes(o)); if (bad.length) throw new ToolError(`Options not available for ${s.n}: ${bad.join(", ")}. Available: ${s.opts.join(", ")}.`);
      const w = num(spec.width_mm ?? s.w, 200, 6000, "width_mm"), d = num(spec.depth_mm ?? s.d, 150, 3000, "depth_mm"), h = num(spec.height_mm ?? s.h, 20, 3000, "height_mm");
      const it = { kind: "ss", ssType: t, brand: "Fabricated", model: s.n, name: s.n, cat: "Stainless", w, d, h, mount: s.mount, power: "none", kw: null, elec: null,
        water: !!s.water || opts.includes("Pre-rinse sink"), drain: !!s.drain || opts.includes("Pre-rinse sink"), opts, mat, conf: "user" };
      if (s.mount === "over") it.z = num(spec.z_mm ?? s.z, 0, 4000, "z_mm"); return it; }
    if (SSR[t]) { const s = SSR[t], bad = opts.filter(o => !s.opts.includes(o)); if (bad.length) throw new ToolError(`Options not available for ${s.n}: ${bad.join(", ")}. Available: ${s.opts.join(", ") || "none"}.`);
      if (spec.kw === undefined || spec.kw === null || !(Number(spec.kw) > 0)) throw new ToolError(`${s.n} needs its electrical load: pass kw (typical ${s.kw} kW; use the fabricator's compressor rating when known).`);
      const w = num(spec.width_mm ?? s.w, 200, 6000, "width_mm"), d = num(spec.depth_mm ?? s.d, 150, 3000, "depth_mm"), h = num(spec.height_mm ?? s.h, 20, 3000, "height_mm"), nm = s.name(w, opts);
      return { kind: "eq", brand: "Fabricated", model: nm, name: `${nm}, ${mat}`, cat: "Refrigeration", w, d, h, mount: "floor", power: "electric", kw: Math.min(20, Number(spec.kw)), elec: "230V 1N 50Hz",
        water: false, drain: false, opts: opts.filter(o => !/drawers/.test(o)), mat, conf: "user" }; }
    throw new ToolError(`Unknown fabricated type "${t}". Use list_fabricated_types.`);
  }
  if (spec.custom) {
    const c = spec.custom, power = ["electric", "gas", "charcoal", "none"].includes(c.power) ? c.power : "none";
    if (!c.brand || !c.model) throw new ToolError("Custom equipment needs brand and model.");
    if ((power === "electric" || power === "gas") && !(Number(c.kw) > 0)) throw new ToolError(`Custom ${power} equipment needs its load in kW (spec sheet, or rating plate V × A ÷ 1000).`);
    return { kind: "eq", brand: String(c.brand).slice(0, 60), model: String(c.model).slice(0, 80), cat: String(c.category || "Prep").slice(0, 40), name: String(c.description || "Custom model").slice(0, 120),
      w: num(c.width_mm, 50, 6000, "width_mm"), d: num(c.depth_mm, 50, 3000, "depth_mm"), h: num(c.height_mm, 20, 4000, "height_mm"), mount: c.mount === "top" ? "top" : "floor",
      power, kw: power === "none" ? null : Number(c.kw) || null, elec: c.electrical ? String(c.electrical).slice(0, 80) : null, water: !!c.water, drain: !!c.drain, src: c.spec_url ? String(c.spec_url).slice(0, 400) : null, conf: "user" };
  }
  if (spec.opening) {
    const k = String(spec.opening), t = ARCH[k]; if (!t) throw new ToolError(`Unknown opening "${k}". Use one of: ${Object.keys(ARCH).join(", ")}.`);
    const w = num(spec.width_mm ?? t.w, 150, 4000, "width_mm");
    return { kind: "arch", archType: k, brand: "Building", model: t.n, name: t.n, cat: "Building", w, d: k === "column" ? w : t.d, h: k === "column" ? null : 2100, mount: k === "column" ? "floor" : "arch",
      power: "none", kw: null, elec: null, water: false, drain: false, conf: "user" };
  }
  throw new ToolError("Each item needs one of: catalogue, fabricated, custom or opening.");
}
// place an item using wall + offset, explicit x/y/rot, or on top of another item
function place(it, spec, p) {
  const R = p.room, items = p.items, wall = spec.wall ? String(spec.wall).toLowerCase() : null;
  if (it.kind === "arch") {
    if (it.archType === "column") { it.rot = 0; if (spec.x_mm !== undefined) { it.x = num(spec.x_mm, -500, R.w + 500, "x_mm"); it.y = num(spec.y_mm ?? 0, -500, R.d + 500, "y_mm"); } else placeOnWall(it, wall || "north", spec.offset_mm, R, items); if (it.h == null) it.h = R.h; return; }
    if (/^(door|door2|window)$/.test(it.archType)) { const w = wall || "north", off = spec.offset_mm !== undefined ? num(spec.offset_mm, 0, 20000, "offset_mm") : 0;
      if (w === "north") { it.rot = 0; it.x = off; it.y = -it.d; } else if (w === "south") { it.rot = 180; it.x = off; it.y = R.d; }
      else if (w === "west") { it.rot = 270; it.y = off; it.x = -it.d; } else if (w === "east") { it.rot = 90; it.y = off; it.x = R.w; } else throw new ToolError("wall must be north, south, east or west."); return; }
    it.rot = 0; it.x = num(spec.x_mm ?? 0, -500, R.w + 500, "x_mm"); it.y = num(spec.y_mm ?? 0, -500, R.d + 500, "y_mm"); return;
  }
  if (spec.on_top_of) {
    const base = items.find(o => o.id === spec.on_top_of); if (!base) throw new ToolError(`on_top_of: no item with id ${spec.on_top_of}.`);
    if (base.mount !== "floor") throw new ToolError("on_top_of must be a floor item (a table, base, counter fridge or stand).");
    it.mount = "top"; it.rot = base.rot; const off = spec.offset_mm !== undefined ? num(spec.offset_mm, 0, 20000, "offset_mm") : 0;
    // back edges flush; offset runs along the base from its start (west end for north/south bases, north end for east/west bases)
    if (base.rot === 0) { it.x = base.x + off; it.y = base.y; } else if (base.rot === 180) { it.x = base.x + off; it.y = base.y + fd(base) - fd(it); }
    else if (base.rot === 90) { it.x = base.x + fd(base) - fd(it); it.y = base.y + off; } else { it.x = base.x; it.y = base.y + off; }
    return;
  }
  if (wall) return placeOnWall(it, wall, spec.offset_mm, R, items);
  if (spec.x_mm !== undefined && spec.y_mm !== undefined) {
    it.rot = [0, 90, 180, 270].includes(Number(spec.rot)) ? Number(spec.rot) : 0;
    it.x = num(spec.x_mm, -2000, R.w + 2000, "x_mm"); it.y = num(spec.y_mm, -2000, R.d + 2000, "y_mm"); return;
  }
  throw new ToolError("Say where it goes: wall (+ offset_mm), x_mm/y_mm (+ rot), or on_top_of.");
}
function placeOnWall(it, wall, offset, R, items) {
  const rot = { north: 0, east: 90, south: 180, west: 270 }[wall]; if (rot === undefined) throw new ToolError("wall must be north, south, east or west.");
  it.rot = rot; const len = wall === "north" || wall === "south" ? R.w : R.d, along = it.w;
  const put = off => { if (wall === "north") { it.x = off; it.y = 0; } else if (wall === "south") { it.x = off; it.y = R.d - it.d; } else if (wall === "east") { it.x = R.w - it.d; it.y = off; } else { it.x = 0; it.y = off; } };
  if (offset !== undefined && offset !== null) { put(num(offset, 0, 20000, "offset_mm")); return; }
  for (let off = 0; off + along <= len; off += 50) { put(off); if (it.mount === "over" || !items.some(o => o !== it && o.mount === it.mount && o.kind !== "arch" && hit(it, o))) return; }
  put(0);
}

/* ---------- tools ---------- */
const S = (props, req = []) => ({ type: "object", properties: props, required: req, additionalProperties: false });
const PLACE = { wall: { type: "string", enum: ["north", "south", "east", "west"], description: "Put the item's back against this wall." },
  offset_mm: { type: "number", description: "With wall: distance from the wall's start (north/south walls measure from the west end, east/west walls from the north end). With on_top_of: distance from the base's start. Omit with wall to take the first free spot." },
  x_mm: { type: "number" }, y_mm: { type: "number" }, rot: { type: "number", enum: [0, 90, 180, 270] },
  on_top_of: { type: "string", description: "Id of a floor item (table, chef base, counter fridge, oven stand) to sit this countertop item on." } };
const ITEM_SPEC = { type: "object", description: "Exactly one of catalogue / fabricated / custom / opening, plus where it goes.",
  properties: { catalogue: { type: "string", description: "Catalogue key 'Brand|Model' from search_equipment." },
    fabricated: { type: "string", description: "Fabricated type key from list_fabricated_types (stainless or refrigerated)." },
    width_mm: { type: "number" }, depth_mm: { type: "number" }, height_mm: { type: "number" }, z_mm: { type: "number", description: "Wall-hung items: underside height." },
    options: { type: "array", items: { type: "string" } }, material: { type: "string", enum: MATS }, kw: { type: "number", description: "Required for refrigerated fabricated types and custom electric/gas equipment." },
    custom: { type: "object", description: "Equipment not in the catalogue: brand, model, description, category, width_mm, depth_mm, height_mm, mount (floor|top), power (electric|gas|charcoal|none), kw, electrical, water, drain, spec_url." },
    opening: { type: "string", enum: Object.keys(ARCH), description: "Doors and windows go on a wall; columns and service points by x/y or wall." },
    ...PLACE } };
export const TOOLS = [
  { name: "search_equipment", title: "Search the equipment catalogue", annotations: { readOnlyHint: true },
    description: "Search Kitchen Studio's catalogue of real commercial kitchen equipment (published dimensions, power, kW, water/drain). Returns catalogue keys to use with add_items.",
    inputSchema: S({ query: { type: "string", description: "Words to match, e.g. 'rational 6-1/1', 'undercounter dishwasher', 'oven stand'." }, category: { type: "string" }, limit: { type: "number" } }, ["query"]) },
  { name: "list_fabricated_types", title: "List fabricated (stainless and refrigerated) types", annotations: { readOnlyHint: true },
    description: "Stainless items made to size (tables, sinks, shelves, hoods, pass shelves) and fabricated refrigeration (counter chillers, lowboys, saladettes), with default sizes and options.",
    inputSchema: S({}) },
  { name: "list_kitchens", title: "List my kitchens", annotations: { readOnlyHint: true }, description: "Kitchens saved in the user's Kitchen Studio account.", inputSchema: S({}) },
  { name: "get_kitchen", title: "Open a kitchen", annotations: { readOnlyHint: true },
    description: "Room size, every item with its number (as in the app), id, position, size, what it sits on, loads, openings, and layout checks.",
    inputSchema: S({ kitchen_id: { type: "string" } }, ["kitchen_id"]) },
  { name: "create_kitchen", title: "Create a kitchen", description: "New empty kitchen in the user's account (rectangular room).",
    inputSchema: S({ name: { type: "string" }, width_mm: { type: "number", description: "West to east, inside." }, depth_mm: { type: "number", description: "North to south, inside." }, ceiling_mm: { type: "number" } }, ["name", "width_mm", "depth_mm"]) },
  { name: "update_kitchen", title: "Rename or resize a kitchen", description: "Change the name or the room size.",
    inputSchema: S({ kitchen_id: { type: "string" }, name: { type: "string" }, width_mm: { type: "number" }, depth_mm: { type: "number" }, ceiling_mm: { type: "number" } }, ["kitchen_id"]) },
  { name: "add_items", title: "Add equipment", description: "Add catalogue equipment, fabricated stainless/refrigeration, custom equipment, or doors/columns/service points. Returns the new ids and the layout checks.",
    inputSchema: S({ kitchen_id: { type: "string" }, items: { type: "array", items: ITEM_SPEC, maxItems: MAX_ITEMS_PER_CALL } }, ["kitchen_id", "items"]) },
  { name: "update_items", title: "Move or change equipment",
    description: "Move items (wall/offset, x/y/rot, on_top_of), change size/height/z/kw/options of fabricated and custom items, or rename them. Catalogue models keep their spec-sheet size.",
    inputSchema: S({ kitchen_id: { type: "string" }, changes: { type: "array", maxItems: MAX_ITEMS_PER_CALL, items: { type: "object", properties: { id: { type: "string" }, ...PLACE, width_mm: { type: "number" }, depth_mm: { type: "number" }, height_mm: { type: "number" }, z_mm: { type: "number" }, kw: { type: "number" }, options: { type: "array", items: { type: "string" } }, name: { type: "string" } }, required: ["id"] } } }, ["kitchen_id", "changes"]) },
  { name: "remove_items", title: "Remove equipment", annotations: { destructiveHint: true }, description: "Remove items from a kitchen by id.",
    inputSchema: S({ kitchen_id: { type: "string" }, item_ids: { type: "array", items: { type: "string" }, maxItems: MAX_ITEMS_PER_CALL } }, ["kitchen_id", "item_ids"]) },
  { name: "check_layout", title: "Check the layout", annotations: { readOnlyHint: true },
    description: "Overlaps, items outside the room, blocked door swings, countertop items with no base, cooking equipment not under a hood.", inputSchema: S({ kitchen_id: { type: "string" } }, ["kitchen_id"]) },
  { name: "get_schedule", title: "Equipment schedule and loads", annotations: { readOnlyHint: true },
    description: "Equipment list with power, kW, water and drain, and the electrical/gas/water/drain totals. (Drawing exports are made in the app.)", inputSchema: S({ kitchen_id: { type: "string" } }, ["kitchen_id"]) },
];
const INSTRUCTIONS = "Kitchen Studio: commercial kitchen layouts with real equipment at real sizes. Work in millimetres. The room origin is the inside north-west corner, x runs east and y runs south. " +
  "Typical flow: list_kitchens or create_kitchen, search_equipment, add_items (back against a wall, countertop units on_top_of a base), then check_layout and fix every issue. " +
  "Cooking equipment must sit under a hood (add a fabricated 'hood' over the cook line). Keep aisles at least 1000 mm, 1200+ where people pass back to back. " +
  "Item numbers match the app. Drawing exports are made in the app at kitchenstudio.design, not here.";

async function runTool(name, a, ctx) {
  const { D, user, env, origin } = ctx; a = a || {};
  const KID = () => { if (!a.kitchen_id) throw new ToolError("kitchen_id is required."); return String(a.kitchen_id); };
  switch (name) {
    case "search_equipment": {
      const cat = await catalogue(env, origin), words = String(a.query || "").toLowerCase().split(/\s+/).filter(Boolean), c = a.category ? String(a.category).toLowerCase() : null;
      const lim = Math.min(40, Math.max(1, Number(a.limit) || 15));
      const hits = cat.filter(r => { const t = `${r.brand} ${r.model} ${r.name} ${r.cat}`.toLowerCase(); return (!c || r.cat.toLowerCase() === c) && words.every(w => t.includes(w)); });
      return { total: hits.length, results: hits.slice(0, lim).map(r => ({ key: r.key, description: r.name, category: r.cat, size_mm: `${r.w} × ${r.d} × ${r.h}`, mount: r.mount, power: r.power, kw: r.kw, water: r.water, drain: r.drain, source: r.src })),
        categories: c || hits.length ? undefined : [...new Set(cat.map(r => r.cat))] };
    }
    case "list_fabricated_types":
      return { stainless: Object.entries(SS).map(([k, s]) => ({ type: k, name: s.n, default_mm: `${s.w} × ${s.d} × ${s.h}`, mount: s.mount, underside_mm: s.z, water: !!s.water, drain: !!s.drain, options: s.opts })),
        refrigerated: Object.entries(SSR).map(([k, s]) => ({ type: k, name: s.n, default_mm: `${s.w} × ${s.d} × ${s.h}`, typical_kw: s.kw, kw_required: true, options: s.opts })), materials: MATS };
    case "list_kitchens": return { kitchens: (await D.list()).map(k => ({ kitchen_id: k.id, name: k.name, summary: k.summary, updated_at: k.updated_at, shared: !!k.is_public })) };
    case "get_kitchen": { const row = await D.get(KID()); return { kitchen_id: row.id, updated_at: row.updated_at, ...describe(row.data || {}) }; }
    case "check_layout": { const row = await D.get(KID()); return checks(row.data || {}); }
    case "get_schedule": { const row = await D.get(KID()); return schedule(row.data || {}); }
    case "create_kitchen": {
      const name = String(a.name || "Untitled kitchen").slice(0, 80), w = num(a.width_mm, 1000, 60000, "width_mm"), d = num(a.depth_mm, 1000, 60000, "depth_mm"), h = num(a.ceiling_mm ?? 3000, 2000, 10000, "ceiling_mm");
      const data = { v: 1, name, room: { w, d, h }, items: [], under: null, at: Date.now() };
      const row = await D.create(user.id, name, data); return { kitchen_id: row.id, name: row.name, room: data.room, open_in_app: SITE + "/app/" };
    }
    case "update_kitchen": {
      const r = await editKitchen(D, KID(), p => { if (a.name) p.name = String(a.name).slice(0, 80);
        if (a.width_mm !== undefined) p.room.w = num(a.width_mm, 1000, 60000, "width_mm"); if (a.depth_mm !== undefined) p.room.d = num(a.depth_mm, 1000, 60000, "depth_mm"); if (a.ceiling_mm !== undefined) p.room.h = num(a.ceiling_mm, 2000, 10000, "ceiling_mm");
        if (a.width_mm !== undefined || a.depth_mm !== undefined) p.room.poly = undefined; return { rename: a.name ? String(a.name).slice(0, 80) : null }; });
      return { room: r.p.room, name: r.p.name || null, checks: checks(r.p) };
    }
    case "add_items": {
      if (!Array.isArray(a.items) || !a.items.length) throw new ToolError("items must be a non-empty list.");
      if (a.items.length > MAX_ITEMS_PER_CALL) throw new ToolError(`At most ${MAX_ITEMS_PER_CALL} items per call.`);
      const built = []; for (const s of a.items) built.push({ s, it: await makeItem(s, env, origin) });
      const r = await editKitchen(D, KID(), p => { if (p.items.length + built.length > MAX_ITEMS) throw new ToolError(`A kitchen can hold at most ${MAX_ITEMS} items.`);
        const added = []; for (const { s, it } of built) { it.id = newId(); it.x = 0; it.y = 0; it.rot = 0; place(it, s, p); p.items.push(it); added.push(it); }
        return { added }; });
      const eq = eqList(r.p.items);
      return { added: r.out.added.map(it => ({ id: it.id, no: it.kind === "arch" ? undefined : eq.findIndex(e => e.id === it.id) + 1, label: label(it), x_mm: it.x, y_mm: it.y, rot: it.rot, size_mm: `${it.w} × ${it.d} × ${it.h ?? ""}`.trim() })), checks: checks(r.p) };
    }
    case "update_items": {
      if (!Array.isArray(a.changes) || !a.changes.length) throw new ToolError("changes must be a non-empty list.");
      const r = await editKitchen(D, KID(), p => { const done = [];
        for (const c of a.changes) { const it = p.items.find(i => i.id === c.id); if (!it) throw new ToolError(`No item with id ${c.id}. Use get_kitchen.`);
          const editable = it.kind === "ss" || it.conf !== "verified";
          if ((c.width_mm !== undefined || c.depth_mm !== undefined || c.height_mm !== undefined) && !editable && it.kind !== "arch") throw new ToolError(`${label(it)} is a catalogue model: its size comes from the spec sheet and can't be changed. Use a custom or fabricated item instead.`);
          if (c.width_mm !== undefined) it.w = num(c.width_mm, 50, 6000, "width_mm"); if (c.depth_mm !== undefined) it.d = num(c.depth_mm, 50, 3000, "depth_mm"); if (c.height_mm !== undefined) it.h = num(c.height_mm, 20, 4000, "height_mm");
          if (c.z_mm !== undefined) { if (it.mount !== "over") throw new ToolError("z_mm only applies to wall-hung items (shelves, cabinets, hoods)."); it.z = num(c.z_mm, 0, 4000, "z_mm"); }
          if (c.kw !== undefined) { if (it.conf === "verified") throw new ToolError(`${label(it)} is a catalogue model: its load comes from the spec sheet.`); it.kw = Number(c.kw) > 0 ? Math.min(500, Number(c.kw)) : null; }
          if (c.options !== undefined) { if (it.kind !== "ss") throw new ToolError("options only apply to fabricated stainless items."); const allowed = (SS[it.ssType] || {}).opts || []; const bad = c.options.filter(o => !allowed.includes(o)); if (bad.length) throw new ToolError(`Options not available: ${bad.join(", ")}. Available: ${allowed.join(", ")}.`); it.opts = c.options.map(String); }
          if (c.name !== undefined && it.kind !== "arch") it.name = String(c.name).slice(0, 120);
          if (c.wall || c.on_top_of || (c.x_mm !== undefined && c.y_mm !== undefined)) place(it, c, p);
          else if (c.rot !== undefined) { const cx = it.x + fw(it) / 2, cy = it.y + fd(it) / 2; it.rot = [0, 90, 180, 270].includes(Number(c.rot)) ? Number(c.rot) : it.rot; it.x = r0(cx - fw(it) / 2); it.y = r0(cy - fd(it) / 2); }
          else if (c.offset_mm !== undefined && it.kind !== "arch") placeOnWall(it, wallOf(it), c.offset_mm, p.room, p.items);
          done.push(it); }
        return { done }; });
      const eq = eqList(r.p.items);
      return { updated: r.out.done.map(it => ({ id: it.id, no: eq.findIndex(e => e.id === it.id) + 1 || undefined, label: label(it), x_mm: it.x, y_mm: it.y, rot: it.rot, size_mm: `${it.w} × ${it.d} × ${it.h ?? ""}`.trim(), bottom_at_mm: zOf(it, r.p.items) })), checks: checks(r.p) };
    }
    case "remove_items": {
      const ids = new Set((a.item_ids || []).map(String)); if (!ids.size) throw new ToolError("item_ids must list at least one id.");
      const r = await editKitchen(D, KID(), p => { const before = p.items.length, gone = p.items.filter(i => ids.has(i.id)).map(label); p.items = p.items.filter(i => !ids.has(i.id)); if (p.items.length === before) throw new ToolError("None of those ids are in this kitchen."); return { gone }; });
      return { removed: r.out.gone, checks: checks(r.p) };
    }
  }
  throw new ToolError(`Unknown tool ${name}.`);
}

/* ---------- HTTP + JSON-RPC ---------- */
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version", "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS" };
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors, ...extra } });
const rpcErr = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
export const isMcpPath = p => p === "/mcp" || p === "/mcp/" || p.startsWith(PRM_PATH);

export async function handleMcp(request, env) {
  const url = new URL(request.url), origin = url.origin;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (url.pathname.startsWith(PRM_PATH)) {
    return json({ resource: RESOURCE, authorization_servers: [SUPABASE + "/auth/v1"], bearer_methods_supported: ["header"], resource_name: "Kitchen Studio", resource_documentation: SITE });
  }
  const challenge = { "WWW-Authenticate": `Bearer resource_metadata="${SITE}${PRM_PATH}/mcp"` };
  const auth = request.headers.get("Authorization") || "", token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return json(rpcErr(null, -32001, "Sign in to Kitchen Studio to use this connector."), 401, challenge);
  const user = await userFromToken(token);
  if (!user) return json(rpcErr(null, -32001, "Your Kitchen Studio sign-in has expired. Reconnect."), 401, { "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${SITE}${PRM_PATH}/mcp"` });
  if (request.method === "GET") return new Response("This MCP endpoint answers POST requests.", { status: 405, headers: { Allow: "POST", ...cors } });
  if (request.method === "DELETE") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return new Response(null, { status: 405, headers: cors });
  const text = await request.text(); if (text.length > MAX_BODY) return json(rpcErr(null, -32600, "Request too large."), 413);
  let msg; try { msg = JSON.parse(text); } catch (_) { return json(rpcErr(null, -32700, "Parse error"), 400); }
  if (Array.isArray(msg)) return json(rpcErr(null, -32600, "Batching is not supported."), 400);
  if (msg.id === undefined || msg.id === null) return new Response(null, { status: 202, headers: cors }); // notification
  const ctx = { D: db(token), user, env, origin }, id = msg.id;
  try {
    switch (msg.method) {
      case "initialize": { const want = msg.params && msg.params.protocolVersion;
        return json({ jsonrpc: "2.0", id, result: { protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: INSTRUCTIONS } }); }
      case "ping": return json({ jsonrpc: "2.0", id, result: {} });
      case "tools/list": return json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
      case "tools/call": {
        const name = msg.params && msg.params.name; if (!TOOLS.some(t => t.name === name)) return json(rpcErr(id, -32602, `Unknown tool: ${name}`));
        try { const out = await runTool(name, msg.params.arguments, ctx); return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out, isError: false } }); }
        catch (e) { if (e instanceof ToolError) return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: e.message }], isError: true } }); throw e; }
      }
      case "resources/list": return json({ jsonrpc: "2.0", id, result: { resources: [] } });
      case "prompts/list": return json({ jsonrpc: "2.0", id, result: { prompts: [] } });
      default: return json(rpcErr(id, -32601, `Method not found: ${msg.method}`));
    }
  } catch (e) { console.error("mcp", e); return json(rpcErr(id, -32603, "Internal error")); }
}
export const _test = { describe, checks, schedule, makeItem, place, placeOnWall, needsHood, underHood, runTool, editKitchen, setCatalogue: c => { CAT = c; } };
