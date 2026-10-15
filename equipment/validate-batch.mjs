// Structural evidence checks do not replace manufacturer research or release review.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const batchId=process.argv[2];
const ledger=JSON.parse(fs.readFileSync('equipment/batch-ledger.json','utf8'));
const batch=ledger.batches.find(b=>b.id===batchId);
assert(batch,'Supply an existing batch ID');
const parse=s=>new Function(s+';return CATALOGUE_ROWS')();
const rows=parse(fs.readFileSync('cat.js','utf8'));
const before=parse(execFileSync('git',['show',ledger.baseline.main_sha+':cat.js'],{encoding:'utf8'}));
assert.deepEqual(rows.slice(0,before.length),before,'Existing catalogue rows changed');
const key=r=>(r[0]+'|'+r[1]).toLowerCase().replace(/[\s-]+/g,'');
assert.equal(new Set(rows.map(key)).size,rows.length,'Duplicate normalized brand/model');
const evidence=JSON.parse(fs.readFileSync('catalogue-evidence.json','utf8')).records;
for(const model of batch.models){
 const matches=rows.filter(r=>r[0]===batch.manufacturer && new RegExp('(^|[^0-9])'+model+'([^0-9]|$)').test(r[1]));
 assert.equal(matches.length,1,'Duplicate or missing exact SKU '+model);
 const row=matches[0],e=evidence[key(row)];
 assert(e?.ready_to_import && e.status==='exact-variant-checked',model+' not ready');
 assert.deepEqual(e.blockers,[]);
 assert.deepEqual(row,e.candidate_runtime_row);
 for(const field of ['brand','model','w','d','h','mount','power','kw','elec','water','drain']){
  const f=e.field_evidence[field];
  assert(f && ['checked','not-applicable'].includes(f.status) && f.reason && f.locator,model+' missing '+field);
  assert(f.source_ids.every(id=>e.sources.some(s=>s.id===id)),model+' unknown source');
 }
 for(const check of ['identity','dimensions','mounting','power_input','electrical_supply','water_drain','gas','installation','source_freshness','app_compatibility'])assert.equal(e.required_checks[check]?.status,'checked',model+' missing '+check);
 assert(e.sources.some(s=>s.kind==='manufacturer-product-page'));
 assert(e.sources.some(s=>s.kind==='manufacturer-specification'));
}
console.log(JSON.stringify({batch:batchId,count:rows.length,original_rows_preserved:before.length,checked_models:batch.models,duplicates:0}));
