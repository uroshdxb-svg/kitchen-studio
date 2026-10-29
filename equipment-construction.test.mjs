import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Three from 'three';
import {catalogueProfiles,constructionProfile} from './equipment-profiles.mjs';

const read=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
const rows=new Function(read('cat.js')+';return CATALOGUE_ROWS')();
const exact=new Function(read('view3d-equipment.js')+';return KS3DEquipment')();
const profiles=catalogueProfiles(rows,exact);
const THREE={...Three};
new Function('THREE',read('node_modules/three/examples/js/utils/BufferGeometryUtils.js'))(THREE);
// Geometry-only validation: no canvas or GPU rendering claims are made here.
const document={createElement:()=>({getContext:()=>({fillText(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}})})};
const {families,assets}=new Function('THREE','document','KS3DProfiles',read('view3d-assets.js')+read('view3d-equipment.js')+read('view3d-families.js')+';return {families:KS3DFamilies,assets:KS3DAssets};')(THREE,document,profiles);
const M=Object.fromEntries(['steel','steel2','dark','rubber','white','screen','iron','water','oil','lamp'].map(k=>[k,new THREE.MeshStandardMaterial()]));
const evidence=[];
for(const r of rows){
 const it={kind:'eq',brand:r[0],model:r[1],cat:r[2],name:r[3],w:r[4],d:r[5],h:r[6],mount:r[7]},p=families.identify(it);
 if(!p){assert.ok(exact.identify(it),`${r[0]} ${r[1]} has no detailed model`);continue;}
 assert.equal(exact.identify(it),null,'Individually reviewed model must keep priority');
 assert.equal(families.identify({...it,kind:'ss'}),null,'Custom fabrication must not acquire catalogue geometry');
 const g=assets.compact(families.build(it,{M}));g.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(g),size=bounds.getSize(new THREE.Vector3()).toArray(),limits=[it.w,it.h,it.d];
 for(let i=0;i<3;i++){
  assert.ok(bounds.min.getComponent(i)>=-.02,`${p.id} below catalogue envelope`);
  assert.ok(bounds.max.getComponent(i)<=limits[i]+.03,`${p.id} exceeds catalogue envelope`);
  assert.ok(size[i]>limits[i]*.45,`${p.id} unexpectedly small on axis ${i}: ${size[i]}/${limits[i]}`);
 }
 let triangles=0;g.traverse(o=>{if(o.isMesh){for(const name of ['position','normal','uv'])assert.ok([...o.geometry.attributes[name].array].every(Number.isFinite),`${p.id}: non-finite ${name}`);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;o.geometry.dispose();}});
 assert.ok(triangles>100&&triangles<65000,`${p.id}: ${triangles} triangles`);
 assert.ok(g.children.length<25,`${p.id}: ${g.children.length} material batches`);
 evidence.push({id:p.id,family:p.family,triangles,batches:g.children.length});
}
const profile=(brand,model)=>constructionProfile(rows.find(r=>r[0]===brand&&r[1]===model));
assert.equal(profile('Potis','GD4/S').family,'doner');
assert.equal(profile('Electrolux Professional','371178').family,'range');
assert.equal(profile('Electrolux Professional','371178').open,true);
assert.equal(profile('Electrolux Professional','391041').zones,4);
assert.equal(profile('Electrolux Professional','371112').family,'cabinet');
assert.equal(profile('Electrolux Professional','254106 (FPG1D)').stockpot,true);
assert.equal(profile('Hoshizaki','IM-240DNE-HC-32').headOnly,true);
assert.equal(profile('Hoshizaki','Premier KL 3 A 2D 2D 2D L E').drawers,6);
assert.equal(profile('Hoshizaki','Premier KL 3 A 2D 2D 2D L E').family,'counter');
assert.equal(constructionProfile(['Unknown','Future','Other','Unidentified equipment',100,100,100,'top']),null);
assert.equal(new Set(profiles.map(p=>p.id)).size,profiles.length,'Collection IDs must be unique');
fs.mkdirSync('test-results',{recursive:true});
fs.writeFileSync('test-results/construction-geometry.json',JSON.stringify(evidence,null,2));
console.log(`${evidence.length} catalogue construction models in ${new Set(evidence.map(e=>e.family)).size} families: finite geometry, complete envelope, batching and classification checks pass.`);
console.log('Largest geometry:',evidence.toSorted((a,b)=>b.triangles-a.triangles).slice(0,3));
