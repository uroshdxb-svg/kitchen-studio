import test from 'node:test';
import assert from 'node:assert/strict';
import './equipment-intake.js';
import {_test as mcp} from './mcp.js';
const I=globalThis.KS_intake;
const raw={brand:'Example',model:'X-10',name:'Counter fridge',w:600,d:700,h:850,mount:'floor',qty:2};
test('unknown utilities survive normalization, storage and contribution',()=>{
  const r=I.normalize(raw),e=I.privateEquipment(r,'private-1');
  assert.equal(e.water,null);assert.equal(e.drain,null);assert.equal(e.power,null);assert.equal(e.kw,null);
  assert.equal(e.conf,'user');assert.equal(e.verification,'unverified');
  assert.equal(I.connection(e.water),'Unknown');assert.match(I.uncertainty([e]),/energy type/);
  assert.equal(I.contribution(e,'r1').context.product.water,null);
});
test('untrusted extraction cannot inject verification, HTML URLs, IDs or private fields',()=>{
  const r=I.normalize({...raw,conf:'verified',owner:'other',cid:'remote',src:'javascript:alert(1)',price:999,email:'private@example.test',excerpt:'private quote'});
  const e=I.privateEquipment(r,'new');const request=I.contribution({...e,price:999,excerpt:'secret'},'request-1');
  assert.equal(e.src,null);assert.equal(e.conf,'user');assert.equal(e.cid,'new');
  assert.equal(e.excerpt,undefined);assert.equal(e.owner,undefined);
  assert.doesNotMatch(JSON.stringify(request),/private quote|secret|999|private@example/);
  assert.equal(request.context.verification,'pending');
});
test('quantity is never clamped or silently rounded; invalid dimensions cannot be placed',()=>{
  for(const qty of [-1,0,1.4,101,'bad',true])assert.equal(I.normalize({...raw,qty}).qty,null);
  assert.throws(()=>I.privateEquipment(I.normalize({...raw,w:Infinity}),'x'),/width/);
  assert.throws(()=>I.privateEquipment(I.normalize({...raw,mount:null}),'x'),/placement/);
  assert.equal(I.normalize({...raw,w:24,units:'in'}).w,610);
  assert.equal(I.normalize({...raw,units:'feet'}).w,null);
});
test('CSV quoted cells, newlines, BOM, explicit no and unknown remain distinct',()=>{
  const rows=I.parseDelimited('\uFEFFBrand,Model,Description,Quantity,Width mm,Depth mm,Height mm,mount,water,drain\r\nExample,X-10,"A, fridge\nwith door",2,600,700,850,floor,no,\r\n');
  assert.equal(rows.length,1);assert.equal(rows[0].name,'A, fridge\nwith door');
  assert.equal(rows[0].water,false);assert.equal(rows[0].drain,null);assert.equal(rows[0].qty,2);
  assert.throws(()=>I.parseDelimited('brand,model\na,b,c'),/columns/);
  assert.throws(()=>I.parseDelimited('brand,model\n"a,b'),/unfinished/);
  assert.throws(()=>I.parseDelimited('brand,model,brand\na,b,c'),/duplicate/);
  assert.throws(()=>I.parseDelimited('brand,model\n'+Array(51).fill('a,b').join('\n')),/50/);
});
test('matching retains suffixes and punctuation, flags dimensions and variant conflicts',()=>{
  const base={...I.normalize(raw),elec:'230V 1N 50Hz',water:false};
  const r=I.normalize({...raw,brand:' EXAMPLE ',model:'x-10',w:650,elec:'400V 3N 50Hz',variant:'US'});
  const matches=I.matches(r,[base,{...base,model:'X-10A'},{...base,model:'X10'}]);
  assert.equal(matches.length,1);assert.deepEqual(matches[0].conflicts,['w','electrical supply','market / configuration needs confirmation']);
  assert.equal(I.matches(I.normalize({...raw,model:'X-1'}),[base]).length,0);
});
test('AI truncation and malformed envelopes fail closed',()=>{
  assert.throws(()=>I.extracted({items:[raw],truncated:true}),/smaller batches/);
  assert.throws(()=>I.extracted({items:[]}),/No equipment/);
  const r=I.extracted({items:[{...raw,water:'unknown',kw:'not stated'}]})[0];
  assert.equal(r.water,null);assert.equal(r.kw,null);
});
test('connector schedule preserves unknown utilities and marks partial totals',()=>{
  const item={...I.privateEquipment(I.normalize(raw),'x'),kind:'eq',id:'one'};
  const result=mcp.schedule({items:[item]});
  assert.equal(result.items[0].water,null);assert.equal(result.items[0].drain,null);
  assert.equal(result.items[0].verification,'unverified');assert.equal(result.totals_partial,true);
  assert.deepEqual(result.unknown_utilities,[{no:1,fields:['power','water','drain']}]);
  assert.notEqual(I.catalogueKey({...item,w:650}),I.catalogueKey(item));
});
