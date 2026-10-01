// Tests for the Kitchen Studio MCP server (mcp.js). Run: npm run build && node mcp.test.mjs
// Uses a fake Supabase (auth + PostgREST) and the built catalogue, so it runs offline.
import fs from "node:fs";
import { handleMcp, TOOLS, SS, SSR, ARCH } from "./mcp.js";

let fails = 0; const check = (ok, what) => { console.log((ok ? "  ok   " : "  FAIL ") + what); if (!ok) fails++; };

/* 1. fabricated types match the app */
console.log("1. fabricated types match app.js");
{
  const app = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8");
  const grab = name => { const i = app.indexOf(`const ${name}={`), j = app.indexOf("\n};", i); return new Function(`const WALL_T=120;return (${app.slice(i + name.length + 7, j + 2)});`)(); };
  const aSS = grab("SS"), aSSR = grab("SSR");
  const aARCH = new Function(`const WALL_T=120;return ${app.slice(app.indexOf("const ARCH=") + 11, app.indexOf("};", app.indexOf("const ARCH=")) + 1)};`)();
  check(JSON.stringify(Object.keys(aSS)) === JSON.stringify(Object.keys(SS)), "same stainless types");
  check(Object.keys(SS).every(k => ["n", "w", "d", "h", "mount", "z"].every(f => aSS[k][f] === SS[k][f]) && JSON.stringify(aSS[k].opts) === JSON.stringify(SS[k].opts)), "same stainless defaults and options");
  check(JSON.stringify(Object.keys(aSSR)) === JSON.stringify(Object.keys(SSR)), "same refrigerated types");
  check(Object.keys(SSR).every(k => ["n", "w", "d", "h", "kw"].every(f => aSSR[k][f] === SSR[k][f]) && aSSR[k].name(1700, ["4 drawers"]) === SSR[k].name(1700, ["4 drawers"])), "same refrigerated defaults and names");
  check(JSON.stringify(aARCH) === JSON.stringify(ARCH), "same openings");
}

/* fake backend */
const USERS = { "tok-uros": { id: "u-uros", email: "uros@example.com" }, "tok-other": { id: "u-other", email: "x@example.com" } };
let rows = []; let versionBump = 0;
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  url = String(url); const tok = ((init.headers || {}).Authorization || "").replace("Bearer ", ""), me = USERS[tok];
  const res = (status, body) => new Response(body === undefined ? "" : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (url.endsWith("/auth/v1/user")) return me ? res(200, me) : res(401, { msg: "bad jwt" });
  const m = url.match(/\/rest\/v1\/projects(\?.*)?$/); if (!m) return res(404, {});
  if (!me) return res(401, { message: "JWT" });
  const q = new URLSearchParams((m[1] || "").slice(1)), mine = rows.filter(r => r.owner === me.id);
  const pick = r => ({ id: r.id, name: r.name, summary: r.summary, updated_at: r.updated_at, is_public: false, data: r.data, version: r.version });
  if (!init.method || init.method === "GET") { const id = (q.get("id") || "").replace("eq.", ""); return res(200, (id ? mine.filter(r => r.id === id) : mine).map(pick)); }
  if (init.method === "POST") { const b = JSON.parse(init.body); if (b.owner !== me.id) return res(403, { message: "rls" }); const r = { id: "k" + (rows.length + 1), owner: b.owner, name: b.name, data: b.data, summary: b.summary, version: 1, updated_at: new Date().toISOString() }; rows.push(r); return res(201, [pick(r)]); }
  if (init.method === "PATCH") { const id = q.get("id").replace("eq.", ""), v = Number(q.get("version").replace("eq.", "")), r = mine.find(x => x.id === id);
    if (versionBump) { versionBump--; if (r) r.version++; }
    if (!r || r.version !== v) return res(200, []); const b = JSON.parse(init.body); Object.assign(r, b); r.version++; return res(200, [{ version: r.version, updated_at: r.updated_at }]); }
  return res(405, {});
};
const catJson = fs.readFileSync(new URL("./dist/app/catalogue.json", import.meta.url), "utf8");
const env = { ASSETS: { fetch: async () => new Response(catJson, { headers: { "Content-Type": "application/json" } }) } };
let n = 0;
const rpc = async (method, params, tok = "tok-uros") => {
  const r = await handleMcp(new Request("https://kitchenstudio.design/mcp", { method: "POST", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }) }), env);
  return { status: r.status, headers: r.headers, body: r.status === 202 ? null : await r.json() };
};
const call = async (name, args, tok) => { const r = await rpc("tools/call", { name, arguments: args }, tok); const res = r.body.result; return { err: res && res.isError ? res.content[0].text : null, out: res && res.structuredContent, raw: r }; };

/* 2. protocol and auth */
console.log("2. protocol and auth");
{
  const noTok = await rpc("initialize", { protocolVersion: "2025-06-18" }, null);
  check(noTok.status === 401 && /resource_metadata=".*\/\.well-known\/oauth-protected-resource\/mcp"/.test(noTok.headers.get("WWW-Authenticate")), "no token: 401 with resource metadata challenge");
  const badTok = await rpc("initialize", {}, "nope"); check(badTok.status === 401 && /invalid_token/.test(badTok.headers.get("WWW-Authenticate")), "bad token: 401 invalid_token");
  const prm = await handleMcp(new Request("https://kitchenstudio.design/.well-known/oauth-protected-resource/mcp"), env); const pj = await prm.json();
  check(pj.resource === "https://kitchenstudio.design/mcp" && /\/auth\/v1$/.test(pj.authorization_servers[0]), "protected resource metadata points at Supabase auth");
  check(Array.isArray(pj.scopes_supported) && pj.scopes_supported.includes("offline_access"), "metadata lists scopes (ChatGPT requires it; offline_access gives refresh tokens)");
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  check(init.body.result.protocolVersion === "2025-06-18" && init.body.result.capabilities.tools && /kitchen/i.test(init.body.result.instructions), "initialize");
  const note = await rpc("notifications/initialized"); check(true, "notification accepted");
  const tl = await rpc("tools/list", {}); check(tl.body.result.tools.length === TOOLS.length && !tl.body.result.tools.some(t => /export|pdf/i.test(t.name)), "tools/list, and no export tool");
}

/* 3. build K-14 through the tools */
console.log("3. build K-14 (3000 × 6090) through the tools");
let K, ids = {};
{
  const s = await call("search_equipment", { query: "rational stand ii 1/1 feet" }); check(!s.err && s.out.results.some(r => r.key === "Rational|Stand II 1/1 60.31.086"), "search finds Rational Stand II");
  const s2 = await call("search_equipment", { query: "icombi pro 6-1/1" }); check(s2.out.results.length >= 1, "search finds iCombi Pro 6-1/1");
  const f = await call("list_fabricated_types", {}); check(f.out.refrigerated.some(t => t.type === "rlowboy" && t.kw_required), "fabricated types list lowboy with required kW");
  const c = await call("create_kitchen", { name: "K-14 test", width_mm: 3000, depth_mm: 6090, ceiling_mm: 3000 }); K = c.out.kitchen_id; check(!!K, "create_kitchen");
  const lk = await call("list_kitchens", {}); check(lk.out.kitchens.some(k => k.kitchen_id === K), "list_kitchens shows it");
  const noKw = await call("add_items", { kitchen_id: K, items: [{ fabricated: "rlowboy", wall: "west" }] }); check(/needs its electrical load/.test(noKw.err || ""), "refrigerated item without kW is refused");
  const a = await call("add_items", { kitchen_id: K, items: [
    { opening: "door", wall: "north", offset_mm: 1050, width_mm: 1100 },
    { fabricated: "hood", wall: "west", offset_mm: 200, width_mm: 1800, depth_mm: 1200, options: ["Baffle filters", "Lights"] },
    { fabricated: "hood", wall: "west", offset_mm: 2000, width_mm: 2700, depth_mm: 1200 },
    { fabricated: "rcounter", wall: "west", offset_mm: 0, width_mm: 1300, kw: 0.25 },
    { catalogue: "Rational|Stand II 1/1 60.31.086", wall: "west", offset_mm: 1300 },
    { fabricated: "rlowboy", wall: "west", offset_mm: 2160, depth_mm: 900, options: ["4 drawers"], kw: 0.3 },
  ] });
  check(!a.err && a.out.added.length === 6, "add door, hoods, counter chiller, stand, lowboy");
  for (const x of a.out.added) ids[x.label] = x.id;
  const stand = a.out.added.find(x => /Stand II/.test(x.label)), lowboy = a.out.added.find(x => /Lowboy/.test(x.label));
  check(stand.x_mm === 0 && stand.y_mm === 1300 && stand.rot === 270, "stand against west wall at 1300");
  const oven = s2.out.results[0].key;
  const b = await call("add_items", { kitchen_id: K, items: [
    { catalogue: oven, on_top_of: stand.id },
    { custom: { brand: "Cook Rite (Atosa)", model: "ATHP-24-4", description: "Countertop gas hot plate", category: "Cooking", width_mm: 610, depth_mm: 701, height_mm: 333, mount: "top", power: "gas", kw: 29.3 }, on_top_of: lowboy.id, offset_mm: 50 },
    { custom: { brand: "Lotus", model: "FTLT-98G", description: "Table-top gas fry top", category: "Cooking", width_mm: 800, depth_mm: 900, height_mm: 280, mount: "top", power: "gas", kw: 18 }, on_top_of: lowboy.id, offset_mm: 750 },
  ] });
  check(!b.err, "add oven on stand, hot plate and griddle on lowboy");
  const k = await call("get_kitchen", { kitchen_id: K });
  const ov = k.out.items.find(i => i.category === "Combi ovens" && i.power !== "none"), gr = k.out.items.find(i => /FTLT/.test(i.label));
  check(ov && ov.sits_on === stand.id && ov.bottom_at_mm === 699, "oven sits on the stand at 699");
  check(gr && gr.bottom_at_mm === 600 && gr.y_mm === 2160 + 750 && gr.x_mm === 0, "griddle on the lowboy at 600, flush to the wall");
  check(k.out.checks.ok, "layout checks pass: " + JSON.stringify(k.out.checks.issues));
  check(k.out.openings.length === 1 && k.out.openings[0].wall === "north", "door listed on the north wall");
}

/* 4. checks catch problems; edits; catalogue sizes locked */
console.log("4. checks, edits, locks");
{
  const k = await call("get_kitchen", { kitchen_id: K }); const gr = k.out.items.find(i => /FTLT/.test(i.label)), ov = k.out.items.find(i => i.category === "Combi ovens" && i.power !== "none");
  const mv = await call("update_items", { kitchen_id: K, changes: [{ id: gr.id, x_mm: 1200, y_mm: 5000, rot: 270 }] });
  check(mv.out.checks.issues.some(x => x.id === gr.id && /hood/.test(x.problem)) && mv.out.checks.issues.some(x => x.id === gr.id && /nothing under it/.test(x.problem)), "moving the griddle off the line flags no hood and no base");
  const back = await call("update_items", { kitchen_id: K, changes: [{ id: gr.id, on_top_of: k.out.items.find(i => /Lowboy/.test(i.label)).id, offset_mm: 750 }] }); check(back.out.checks.ok, "putting it back clears the issues");
  const lock = await call("update_items", { kitchen_id: K, changes: [{ id: ov.id, width_mm: 900 }] }); check(/catalogue model/.test(lock.err || ""), "catalogue model size is locked");
  const lb = k.out.items.find(i => /Lowboy/.test(i.label));
  const rs = await call("update_items", { kitchen_id: K, changes: [{ id: lb.id, kw: 0.42 }] }); check(!rs.err, "kW change on a fabricated item");
  const sch = await call("get_schedule", { kitchen_id: K }); check(sch.out.totals.gas_kw > 47 && sch.out.totals.electrical_kw > 0.6 && sch.out.items_without_load.length === 0, "schedule totals (gas " + sch.out.totals.gas_kw + " kW, electric " + sch.out.totals.electrical_kw + " kW)");
  const tbl = await call("add_items", { kitchen_id: K, items: [{ fabricated: "table", wall: "west", offset_mm: 3700, width_mm: 1000, options: ["Undershelf", "Glitter"] }] }); check(/not available/.test(tbl.err || ""), "unknown option refused");
  const ok = await call("add_items", { kitchen_id: K, items: [{ fabricated: "table", wall: "east", options: ["Undershelf"] }] });
  check(!ok.err && ok.out.added[0].x_mm === 2300, "first free spot on the east wall");
  const over = await call("add_items", { kitchen_id: K, items: [{ fabricated: "table", wall: "east", offset_mm: 0 }] }); check(over.out.checks.issues.some(x => /overlaps/.test(x.problem)), "overlap is reported");
  const rm = await call("remove_items", { kitchen_id: K, item_ids: [over.out.added[0].id] }); check(!rm.err && rm.out.checks.ok, "remove fixes it");
}

/* 5. isolation and conflicts */
console.log("5. isolation and conflicts");
{
  const other = await call("get_kitchen", { kitchen_id: K }, "tok-other"); check(/No kitchen with that id/.test(other.err || ""), "another user can't open it");
  const lk = await call("list_kitchens", {}, "tok-other"); check(lk.out.kitchens.length === 0, "another user's list is empty");
  versionBump = 1; const rn = await call("update_kitchen", { kitchen_id: K, name: "K-14 Control Tower (test)" }); check(!rn.err && rn.out.name === "K-14 Control Tower (test)", "a save that races the app retries and succeeds");
  versionBump = 5; const lost = await call("update_kitchen", { kitchen_id: K, name: "x" }); versionBump = 0; check(/changed somewhere else/.test(lost.err || ""), "repeated conflicts give a clear error");
  const unk = await rpc("tools/call", { name: "export_pdf", arguments: {} }); check(unk.body.error && /Unknown tool/.test(unk.body.error.message), "no export tool can be called");
}

globalThis.fetch = origFetch;
console.log(fails ? `\n${fails} check(s) failed` : "\nall MCP checks passed"); process.exit(fails ? 1 : 0);
