// Import new rows from the catalogue research queue into cat.js.
// Usage: node import-queue.mjs <queue.csv> [--dry]
// Queue header: brand,model,cat,name,w,d,h,mount,power,kw,elec,water,drain,src,region,note,added_on
// Only rows that are valid and not already in cat.js (brand + model, case/space/hyphen-insensitive) are appended.
// Prints a JSON summary on stdout; exits 0 even when nothing was added.
import fs from "node:fs";

const [, , queuePath, flag] = process.argv;
if (!queuePath) { console.error("usage: node import-queue.mjs <queue.csv> [--dry]"); process.exit(2); }
const DRY = flag === "--dry";
const CAT_FILE = new URL("./cat.js", import.meta.url);

// --- read current catalogue and allowed categories
const catSrc = fs.readFileSync(CAT_FILE, "utf8");
const m = {}; new Function("m", catSrc + ";m.rows=CATALOGUE_ROWS;")(m);
const existing = m.rows;
const appSrc = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8");
const CATS = JSON.parse(appSrc.match(/const CATS=(\[[^\]]*\])/)[1]);

const key = (b, mo) => (String(b) + "|" + String(mo)).toLowerCase().replace(/[\s\-]+/g, "");
const seen = new Set(existing.map(r => key(r[0], r[1])));

// --- minimal RFC 4180 CSV parser
function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); f = ""; if (row.some(x => x !== "")) rows.push(row); row = [];
    } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); if (row.some(x => x !== "")) rows.push(row); }
  return rows;
}

const csv = parseCSV(fs.readFileSync(queuePath, "utf8").replace(/^﻿/, ""));
const header = csv.shift().map(h => h.trim());
const need = ["brand","model","cat","name","w","d","h","mount","power","kw","elec","water","drain","src"];
for (const h of need) if (!header.includes(h)) { console.error("queue is missing column " + h); process.exit(3); }
const col = Object.fromEntries(header.map((h, i) => [h, i]));

const added = [], skipped = [];
let duplicates = 0;
for (const r of csv) {
  const g = h => (r[col[h]] ?? "").trim();
  const brand = g("brand"), model = g("model"), label = brand + " " + model;
  const k = key(brand, model);
  if (seen.has(k)) { duplicates++; continue; }
  const w = Number(g("w")), d = Number(g("d")), h = Number(g("h"));
  const why = [];
  if (!brand || !model) why.push("brand/model empty");
  if (!CATS.includes(g("cat"))) why.push("category '" + g("cat") + "' not in app");
  if (![w, d, h].every(n => Number.isFinite(n) && n > 0 && n < 10000)) why.push("bad dimensions");
  if (!["floor", "top"].includes(g("mount"))) why.push("mount '" + g("mount") + "'");
  if (!["electric", "gas", "charcoal", "none"].includes(g("power"))) why.push("power '" + g("power") + "'");
  if (!/^https?:\/\//.test(g("src"))) why.push("no source URL");
  const kwRaw = g("kw"), kw = kwRaw === "" ? null : Number(kwRaw);
  if (kw !== null && !(Number.isFinite(kw) && kw >= 0 && kw < 200)) why.push("bad kW");
  if (why.length) { skipped.push({ model: label, why: why.join("; ") }); continue; }
  const row = [brand, model, g("cat"), g("name") || label, Math.round(w), Math.round(d), Math.round(h),
    g("mount"), g("power"), kw, g("elec") || null, g("water") === "1" ? 1 : 0, g("drain") === "1" ? 1 : 0, g("src")];
  seen.add(k); added.push(row);
}

if (added.length && !DRY) {
  const end = catSrc.lastIndexOf("]");
  const before = catSrc.slice(0, end).replace(/\s*$/, "");
  const lines = added.map(r => JSON.stringify(r)).join(",\n");
  fs.writeFileSync(CAT_FILE, before + ",\n" + lines + "\n" + catSrc.slice(end));
  // sanity: file still parses and grew by exactly added.length
  const m2 = {}; new Function("m", fs.readFileSync(CAT_FILE, "utf8") + ";m.rows=CATALOGUE_ROWS;")(m2);
  if (m2.rows.length !== existing.length + added.length) { fs.writeFileSync(CAT_FILE, catSrc); console.error("row count check failed, cat.js restored"); process.exit(4); }
}

const byCat = {};
for (const r of added) byCat[r[2]] = (byCat[r[2]] || 0) + 1;
console.log(JSON.stringify({ dry: DRY, before: existing.length, added: added.length, after: existing.length + added.length, duplicates, byCat, skipped }, null, 1));
