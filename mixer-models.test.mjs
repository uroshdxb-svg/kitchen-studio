import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
import {visualCoverage} from './equipment-visual-coverage.mjs';

const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const models=new Function(read('view3d-equipment.js')+';return KS3DEquipment')();
const rows=new Function(read('cat.js')+';return CATALOGUE_ROWS')();
const mixers=rows.map(r=>({kind:'eq',brand:r[0],model:r[1],name:r[3],w:r[4],d:r[5],h:r[6],mount:r[7]})).filter(models.mixerFamily);
assert.equal(mixers.length,21);
assert.equal(models.mixerFamily({name:'Spiral dough mixer'}),'spiral');
assert.equal(models.mixerFamily({name:'20 L planetary mixer'}),'planetary');
for(const name of ['Blender-mixer 8 L','Cutter mixer','Spiral slicer','Spiral freezer','Planetary attachment'])assert.equal(models.mixerFamily({name}),null,name);
assert.equal(models.mixerFamily({kind:'ss',name:'Stand mixer'}),null);
assert.equal(models.identify({kind:'eq',brand:'Other',model:'HSM20',name:'Planetary mixer'}),null);
const symbolOf=new Function(read('symbols.js')+';return KS_symOf')();
const coverage=visualCoverage(rows,models,symbolOf,JSON.parse(read('equipment-model-references.json')));
for(const it of mixers){const row=coverage.items.find(r=>r.brand===it.brand&&r.model===it.model);assert.equal(row.status,models.identify(it)?'model-specific':'category-detailed');}
assert.equal(coverage.counts['model-specific'],27);

const server=await serve(5185),browser=await chromium.launch({executablePath:process.env.KS_TEST_EXECUTABLE,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
fs.mkdirSync('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/.test(m.text()))errors.push(m.text());});
 await page.goto('http://localhost:5185/equipment/#hobart-hsm20');
 await page.waitForFunction(()=>document.getElementById('status').textContent==='');
 const geometry=await page.evaluate(mixers=>{
  const M={};for(const key of ['steel','steel2','dark','rubber','white'])M[key]=new THREE.MeshStandardMaterial();
  return mixers.map(it=>{
   const g=KS3DEquipment.build(it,{M}),box=new THREE.Box3().setFromObject(g),parts=[];
   let finite=true,triangles=0;
   g.traverse(o=>{if(!o.isMesh)return;parts.push(o.geometry.type);finite&&=[...o.geometry.attributes.position.array,...o.geometry.attributes.normal.array].every(Number.isFinite);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;o.geometry.dispose();});
   return {name:it.brand+' '+it.model,family:g.userData.modelFamily,exact:g.userData.equipmentModel,expected:KS3DEquipment.identify(it)?.id||null,min:box.min.toArray(),max:box.max.toArray(),size:box.getSize(new THREE.Vector3()).toArray(),limits:[it.w,it.h,it.d],finite,triangles,parts};
  });
 },mixers);
 for(const m of geometry){
  assert.ok(m.finite,m.name);assert.ok(m.parts.includes('LatheGeometry'),m.name+': hollow bowl');assert.ok(m.parts.includes('TubeGeometry'),m.name+': mixing tool');
  assert.ok(m.triangles<50000,m.name+': mesh budget');
  for(let i=0;i<3;i++){assert.ok(m.min[i]>=-.01,m.name);assert.ok(m.max[i]<=m.limits[i]+.02,m.name);assert.ok(m.size[i]>m.limits[i]*(m.exact?.45:.75),m.name+': recognisable full-size silhouette');}
  assert.equal(m.exact,m.expected,'Family models must not claim an exact reference match');
 }
 const planetary=mixers.find(i=>i.brand==='Hobart'&&i.model==='HSM40');
 for(const view of ['perspective','front','side','rear','top']){await page.evaluate(({it,view})=>KS3D.inspect(it,view),{it:planetary,view});await page.locator('#stage').screenshot({path:`test-results/mixer-hsm40-${view}.png`,timeout:90000});}
 const spiral=mixers.find(i=>i.brand==='Sigma'&&i.model==='Tauro 22');
 for(const view of ['perspective','top','rear']){await page.evaluate(({it,view})=>KS3D.inspect(it,view),{it:spiral,view});await page.locator('#stage').screenshot({path:`test-results/mixer-spiral-${view}.png`,timeout:90000});}
 const counts=[];for(let i=0;i<3;i++)for(const it of mixers){await page.evaluate(it=>KS3D.inspect(it),it);counts.push(await page.evaluate(()=>KS3D.stats()));}
 assert.ok(counts.at(-1).geometries<=counts[mixers.length-1].geometries+1);
 assert.ok(counts.at(-1).textures<=counts[mixers.length-1].textures+1);
 assert.deepEqual(errors,[]);
 fs.writeFileSync('test-results/mixer-checks.json',JSON.stringify({models:geometry.map(({parts,...m})=>m),resources:counts.at(-1),errors},null,2));
 console.log(`${mixers.length} mixer envelopes, finite geometry, family mapping, multi-angle renders and repeated GPU rebuilds passed.`);
}finally{await browser.close();server.close();}
