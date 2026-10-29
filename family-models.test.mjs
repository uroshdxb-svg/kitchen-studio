import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
import {visualCoverage} from './equipment-visual-coverage.mjs';

const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const families=new Function('THREE','KS3DAssets',read('view3d-families.js')+';return KS3DFamilies')(THREE,{linear:c=>new THREE.Color(c).convertSRGBToLinear()});
const registry=new Function(read('view3d-equipment.js')+';return KS3DEquipment')();
const rows=new Function(read('cat.js')+';return CATALOGUE_ROWS')();
const symbols=new Function(read('symbols.js')+';return KS_symOf')();
const coverage=visualCoverage(rows,registry,symbols,JSON.parse(read('equipment-model-references.json')),families);
assert.equal(coverage.total,807);assert.equal(coverage.counts['model-specific'],27);
assert.equal(coverage.counts.generic,0);assert.equal(coverage.counts['category-basic'],0);
const cases={'Pizza prep fridge':'prep-counter','Rice cooker':'rice-soup','Heated carving station':'holding-station','Hood dishwasher':'hood-washer','2 Drawer Ref-freezer Base':'refrigerated-counter','Fridge counter':'refrigerated-counter','Conveyor pizza oven':'conveyor-oven','2 zone induction top':'hob'};
Object.assign(cases,{'Self-contained ice cuber 53kg/24h, 23kg bin':'ice-machine','Infrared strip heater 48in':'heated-shelf','Three Tier Service Trolley':'utility-cart','Gas doner/shawarma grill':'spit-grill','Chest freezer':'chest-freezer','Heated banquet cart':'hot-cabinet','Hot Square Plates Electric Boiling Top':'hob'});
for(const [name,family] of Object.entries(cases))assert.equal(families.identify({kind:'eq',name}),family,name);
for(const name of ['Unknown machine','Standard combi oven','Fryer','Upright fridge'])assert.equal(families.identify({name,cat:'Coffee blender refrigeration'}),null);
assert.equal(families.identify({kind:'ss',name:'Work table'}),null);
const M=Object.fromEntries(['steel','steel2','dark','rubber','white','glass','iron','water','lamp'].map(k=>[k,new THREE.MeshStandardMaterial()]));
const inputs=coverage.items.filter(i=>families.identify(i)&&!registry.identify(i)&&!registry.mixerFamily(i)),geometry=[];
for(const it of inputs){
 const g=families.build(it,{M}),b=new THREE.Box3().setFromObject(g),size=b.getSize(new THREE.Vector3()).toArray();let triangles=0,meshes=0;
 assert.equal(g.userData.equipmentModel,null);assert.equal(g.userData.modelFamily,it.family);
 g.traverse(o=>{if(!o.isMesh)return;meshes++;for(const key of ['position','normal'])assert.ok(o.geometry.attributes[key].array.every(Number.isFinite),`${it.brand} ${it.model}: ${key}`);assert.ok(o.material);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;o.geometry.dispose();});
 const limits=[it.w,it.h,it.d];for(let j=0;j<3;j++){assert.ok(b.min.toArray()[j]>=-.02,it.name);assert.ok(b.max.toArray()[j]<=limits[j]+.02,it.name);assert.ok(size[j]>limits[j]*.45,it.name+': silhouette');}
 assert.ok(triangles<85000,it.name+': triangle budget');assert.ok(meshes>=4,it.name+': model has parts');
 geometry.push({brand:it.brand,model:it.model,family:it.family,triangles,size,limits});
}
console.log(`${inputs.length} family items: finite geometry/normals, bounded envelopes and no manufacturer model claims.`);
const samples=[...new Map(inputs.map(i=>[i.family,i])).values()];
fs.mkdirSync('test-results/families',{recursive:true});
const server=await serve(5186),browser=await chromium.launch({executablePath:process.env.KS_TEST_EXECUTABLE,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1200,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/.test(m.text()))errors.push(m.text());});
 await page.goto('http://localhost:5186/equipment/');await page.waitForFunction(()=>coverage&&document.getElementById('status').textContent==='');
 const renders=[];
 for(const it of samples){
  await page.evaluate(it=>showFamily(it),it);const stats=await page.evaluate(()=>KS3D.stats());
  assert.ok(stats.calls<45,it.family+JSON.stringify(stats));assert.ok(stats.triangles<100000,it.family+JSON.stringify(stats));
  await page.locator('#stage').screenshot({path:`test-results/families/${it.family}.png`,timeout:90000});renders.push({family:it.family,...stats});
 }
 const warm=await page.evaluate(()=>KS3D.stats());for(const it of samples)await page.evaluate(it=>showFamily(it),it);const end=await page.evaluate(()=>KS3D.stats());
 assert.ok(end.geometries<=warm.geometries+1,JSON.stringify({warm,end}));assert.ok(end.textures<=warm.textures+1);
 console.log(`${samples.length} family renders and repeated GPU rebuilds passed.`);
 // Begin the interaction checks with a fresh document after the GPU stress run.
 await page.goto('http://localhost:5186/equipment/');await page.waitForFunction(()=>coverage&&document.getElementById('status').textContent==='');
 // Search -> family -> alternate view -> reload deep link -> exact model.
 const pizza=inputs.find(i=>i.family==='prep-counter');await page.click('summary');await page.fill('#catalogueSearch',pizza.model);await page.locator('#coverageRows a').filter({hasText:pizza.brand+' '+pizza.model}).click();
 assert.equal(await page.inputValue('#model'),'family');await page.click('[data-view="rear"]');assert.equal(await page.getAttribute('[data-view="rear"]','aria-pressed'),'true');
 await page.reload();await page.waitForFunction(()=>coverage&&selectedItem?.family==='prep-counter');assert.equal(await page.locator('#source').isVisible(),false);assert.equal(await page.locator('#reference').isVisible(),false);
 await page.click('#next');assert.equal(await page.evaluate(()=>cataloguePosition),pizza.index+1);await page.click('#previous');assert.equal(await page.evaluate(()=>cataloguePosition),pizza.index);
 await page.selectOption('#model','rc-r301');assert.equal(await page.locator('#reference').isVisible(),true);assert.equal(await page.locator('#source').isVisible(),true);
 await page.setViewportSize({width:390,height:844});await page.evaluate(it=>showFamily(it),pizza);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#stage').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/families/phone.png',timeout:90000});
 assert.deepEqual(errors,[]);fs.writeFileSync('test-results/family-checks.json',JSON.stringify({coverage:coverage.counts,geometry,renders,warm,end,errors},null,2));
 console.log(`${samples.length} distinct family renders, searchable inspection, deep links, mobile layout and stable GPU resources passed.`,end);
}finally{await browser.close();server.close();}

