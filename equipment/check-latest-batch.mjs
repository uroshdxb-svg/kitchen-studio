// Exact latest-batch browser/readback checks. Public production uses a fresh disposable context;
// the existing backend stand-in and network guard prevent account/customer writes.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {serve} from '../serve.mjs';
const ledger=JSON.parse(fs.readFileSync('equipment/batch-ledger.json','utf8')),batch=process.env.KS_EQUIPMENT_BATCH?ledger.batches.find(b=>b.id===process.env.KS_EQUIPMENT_BATCH):ledger.batches.at(-1),records=JSON.parse(fs.readFileSync('catalogue-evidence.json','utf8')).records;
const expected=batch.models.map(model=>{const k=(batch.manufacturer+'|'+model).toLowerCase().replace(/[\s-]+/g,'');assert(records[k]?.ready_to_import);return records[k];});
const dir=path.resolve('test-results');fs.mkdirSync(dir,{recursive:true});const report={batch:batch.id,checks:[],local:null,production:{status:'not_run_on_pull_request'}};
const mock=fs.readFileSync('mock-backend.js','utf8');let browser,server;
async function verify(base,label){
 const context=await browser.newContext({viewport:{width:1280,height:900}}),writes=[],errors=[];await context.addInitScript(mock);
 await context.route('**/rest/v1/**',route=>{if(!['GET','HEAD'].includes(route.request().method()))writes.push(route.request().method());return route.abort();});await context.route('**/auth/v1/**',route=>route.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  const response=await context.request.get(base+'catalogue.json?batch='+encodeURIComponent(batch.id),{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status(),200);const rows=await response.json();
  for(const e of expected){const matches=rows.filter(r=>r[0]===e.brand&&r[1]===e.model);assert.equal(matches.length,1);assert.deepEqual(matches[0],e.candidate_runtime_row);}
  await page.goto(base);await page.waitForFunction(()=>window.KS_ui&&document.querySelector('#q'),null,{timeout:20000});await page.locator('#t-eq').click();const start=await page.evaluate(()=>window.KS_ui.items().length);
  for(let i=0;i<expected.length;i++){
   const e=expected[i];await page.fill('#q',e.brand+' '+e.manufacturer_sku);
   // Related suffix variants can legitimately share a search prefix (ALL-72/ALL-72A).
   // Require one exact selectable model, then verify the selected item's full data.
   const add=page.getByRole('button',{name:'Add '+e.brand+' '+e.model,exact:true});assert.equal(await add.count(),1);await add.click();
   const items=await page.evaluate(()=>window.KS_ui.items());assert.equal(items.length,start+i+1);const item=items.at(-1);for(const k of ['brand','model','w','d','h','mount','power','kw','elec'])assert.equal(item[k],({brand:e.brand,model:e.model,w:e.candidate_runtime_row[4],d:e.candidate_runtime_row[5],h:e.candidate_runtime_row[6],mount:e.candidate_runtime_row[7],power:e.candidate_runtime_row[8],kw:e.candidate_runtime_row[9],elec:e.candidate_runtime_row[10]})[k]);assert.equal(item.water,!!e.candidate_runtime_row[11]);assert.equal(item.drain,!!e.candidate_runtime_row[12]);
   await page.locator('#t-eq').click();report.checks.push(label+': exactSKU '+e.manufacturer_sku+' has one exact selectable result and adds exact dimensions/utilities');
  }
  await page.screenshot({path:path.join(dir,'equipment-'+label+'-search-add.png'),fullPage:true});assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);return {status:'pass',catalogueRows:rows.length,models:expected.map(e=>e.manufacturer_sku),customerWrites:0};
 }finally{await context.close();}
}
try{
 browser=await chromium.launch({...(process.env.KS_TEST_EXECUTABLE?{executablePath:process.env.KS_TEST_EXECUTABLE}:{}),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});server=await serve(5189);report.local=await verify('http://127.0.0.1:5189/app/','local');
 if(process.env.GITHUB_REF==='refs/heads/main'||process.env.KS_VERIFY_PRODUCTION==='1'){
  // Existing Cloudflare Git deployment runs alongside CI; allow bounded propagation before testing.
  let available=false;for(let attempt=0;attempt<12;attempt++){try{const r=await fetch('https://kitchenstudio.design/app/catalogue.json?batch='+encodeURIComponent(batch.id)+'&read='+Date.now(),{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(8000)});const rows=await r.json();available=expected.every(e=>rows.some(row=>JSON.stringify(row)===JSON.stringify(e.candidate_runtime_row)));}catch{}if(available)break;await new Promise(r=>setTimeout(r,5000));}assert(available,'Production has not delivered the exact latest batch');report.production=await verify('https://kitchenstudio.design/app/','production');
 }
 console.log(JSON.stringify(report,null,2));
}finally{fs.writeFileSync(path.join(dir,'equipment-latest-batch-report.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());}
