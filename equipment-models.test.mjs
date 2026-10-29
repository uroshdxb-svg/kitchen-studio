import assert from 'node:assert/strict';
import fs from 'node:fs';
import {visualCoverage} from './equipment-visual-coverage.mjs';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';

const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const families=new Function(read('view3d-families.js')+';return KS3DFamilies')();
const rows=new Function(read('cat.js')+';return CATALOGUE_ROWS')();
const symbols=new Function(read('symbols.js')+';return {sym:KS_symOf,plan:KS_planSym,elev:KS_elevSym}')();
const models=new Function(read('view3d-equipment.js')+';return KS3DEquipment')();
const items=rows.map(r=>({kind:'eq',brand:r[0],model:r[1],cat:r[2],name:r[3],w:r[4],d:r[5],h:r[6],mount:r[7]}));
const r301=items.find(i=>i.model==='R 301 Ultra');
assert.equal(symbols.sym(r301),'bowl','Combination food processor must never enter cooking/oven layout logic');
for(const i of items.filter(i=>/dough sheeter/.test(i.name)))assert.equal(symbols.sym(i),'sheeter');
for(const name of ['Combi oven','Combi-steamer','Combination oven'])assert.equal(symbols.sym({name}),'oven');
assert.equal(models.identify({...r301,brand:'Another manufacturer'}),null);
assert.equal(models.identify({...r301,model:'R 301 Ultra Plus'}),null);
assert.equal(models.identify({...r301,kind:'ss'}),null);
assert.equal(models.identify({...r301,brand:'Robot-Coupe',model:'R301 ULTRA'}).id,'rc-r301');
for(const e of models.entries)assert.equal(items.filter(i=>models.identify(i)?.id===e.id).length,1,e.id);
const coverage=visualCoverage(rows,models,symbols.sym,JSON.parse(read('equipment-model-references.json')),families);assert.equal(coverage.total,rows.length);assert.equal(coverage.counts['model-specific'],models.entries.length);assert.equal(Object.values(coverage.counts).reduce((a,b)=>a+b,0),rows.length);assert.equal(visualCoverage([...rows,['Unknown','Future model','Other','unidentified machine',100,100,100,'top']],models,symbols.sym,JSON.parse(read('equipment-model-references.json')),families).counts.generic,coverage.counts.generic+1);
console.log('Exact model mapping, unknown-model fallback and oven/sheeter classification pass.');

const server=await serve(5184),browser=await chromium.launch({executablePath:process.env.KS_TEST_EXECUTABLE,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))errors.push(m.text());});};
fs.mkdirSync(new URL('test-results/',import.meta.url),{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1080}});watch(page);await page.goto('http://localhost:5184/equipment/');await page.waitForFunction(n=>collection.length===n&&document.getElementById('status').textContent==='',models.entries.length);
 // Build every exact model and check the full envelope, including every control
 // and attachment, for non-finite vertices or protrusion into the next item.
 const bounds=await page.evaluate(()=>{
  const M={};for(const k of ['steel','steel2','dark','rubber','white'])M[k]=new THREE.MeshStandardMaterial();
  const results=collection.map(it=>{const g=KS3DEquipment.build(it,{M});g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g),size=b.getSize(new THREE.Vector3());let finite=true;g.traverse(o=>{if(o.isMesh){finite=finite&&[...o.geometry.attributes.position.array].every(Number.isFinite);o.geometry.dispose();}});return {id:g.userData.equipmentModel,size:size.toArray(),min:b.min.toArray(),limits:[it.w,it.h,it.d],finite};});Object.values(M).forEach(m=>m.dispose());return results;
 });for(const b of bounds){assert.ok(b.finite,b.id);for(let i=0;i<3;i++){assert.ok(b.min[i]>=-.01,b.id+': below envelope');assert.ok(b.size[i]+b.min[i]<=b.limits[i]+.02,b.id+': outside envelope');assert.ok(b.size[i]>b.limits[i]*.45,b.id+': unexpectedly tiny');}}
 for(const e of models.entries){await page.selectOption('#model',e.id);await page.waitForFunction(()=>document.getElementById('reference').complete&&document.getElementById('reference').naturalWidth>0);const s=await page.evaluate(()=>KS3D.stats());assert.ok(s.calls<45,JSON.stringify(s));assert.ok(s.triangles<65000&&s.triangles>3000,e.id+JSON.stringify(s));}
 await page.click('summary');await page.fill('#catalogueSearch','Vitamix');assert.equal(await page.locator('#coverageRows tr').count(),2);await page.selectOption('#coverageFilter','generic');assert.equal(await page.locator('#coverageRows tr').count(),0);await page.fill('#catalogueSearch','');assert.equal(await page.locator('#coverageRows tr').count(),coverage.counts.generic);await page.selectOption('#coverageFilter','model-specific');assert.equal(await page.locator('#coverageRows tr').count(),models.entries.length);await page.locator('#coverageRows a').filter({hasText:'The Quiet One'}).click();assert.equal(await page.inputValue('#model'),'vitamix-quietone');await page.click('summary');
 await page.selectOption('#model',models.entries.at(-1).id);const warm=await page.evaluate(()=>KS3D.stats());for(let i=0;i<2;i++)for(const e of models.entries)await page.selectOption('#model',e.id);const end=await page.evaluate(()=>KS3D.stats());assert.ok(end.geometries<=warm.geometries+1,JSON.stringify({warm,end}));assert.ok(end.textures<=warm.textures+1,JSON.stringify({warm,end}));
 console.log('All '+models.entries.length+' models render inside their catalogue envelopes; repeated collection changes retain stable GPU resources.',end);
 for(const id of ['rc-r301','rondo-stm5303','hobart-hsm20','sammic-bp20','sammic-gsm300','vitamix-vitaprep3','vitamix-quietone','mahlkonig-ek43','mahlkonig-e65s','rc-j80','lm-pb3','henkelman-boxer52']){await page.selectOption('#model',id);for(const view of ['front','side','rear','top','perspective'])await page.click(`[data-view="${view}"]`);await page.screenshot({path:`test-results/equipment-${id}.png`,timeout:90000});}
 await page.selectOption('#model','rc-blixer4');await page.click('#zoom');await page.click('#zoomOut');const canvas=await page.locator('#scene').boundingBox();await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width/2+70,canvas.y+canvas.height/2+20,{steps:3});await page.mouse.up();await page.close();
 const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});watch(phone);await phone.goto('http://localhost:5184/equipment/#sinmag-sm520f');await phone.waitForFunction(n=>collection.length===n&&document.getElementById('status').textContent==='',models.entries.length);assert.equal(await phone.inputValue('#model'),'sinmag-sm520f');assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await phone.locator('#stage').scrollIntoViewIfNeeded();await phone.screenshot({path:'test-results/equipment-phone.png',timeout:90000});await phone.selectOption('#model','rc-r2');await phone.click('[data-view="side"]');assert.equal(await phone.getAttribute('[data-view="side"]','aria-pressed'),'true');await phone.close();
 // Exercise the actual planner path with a mock backend, not just the gallery.
 const app=await browser.newPage();watch(app);await app.addInitScript({content:read('mock-backend.js')});await app.route('**/rest/v1/**',r=>r.abort());await app.route('**/auth/v1/**',r=>r.abort());await app.goto('http://localhost:5184/app/');await app.click('#v3dBtn');
 const integration=await app.evaluate(async items=>{const inputs=items.filter(i=>KS3DEquipment.identify(i));const example={room:{w:9000,d:Math.ceil(inputs.length/4)*2200+1400,h:3000},items:inputs.map((it,n)=>({...it,id:'model-'+n,x:300+(n%4)*2100,y:300+Math.floor(n/4)*2200,rot:0,opts:[]}))};KS3D.rebuild(example,null,{sunk:'#111820'},i=>i.mount==='top'?900:0,KS_symOf,i=>i.w,i=>i.d);KS3D.resetOrbit();await KS3D.ready();KS3D.draw();return {count:inputs.length,stats:KS3D.stats(),symbols:inputs.map(KS_symOf)};},items);assert.equal(integration.count,models.entries.length);assert.ok(integration.stats.triangles>200000);assert.equal(integration.symbols.filter(s=>s==='oven').length,0);await app.screenshot({path:'test-results/equipment-planner.png',timeout:90000});await app.close();
 assert.deepEqual(errors,[]);console.log('Desktop views, phone layout, orbit controls and full-planner integration pass without JavaScript/shader errors.');
}finally{await browser.close();server.close();}
