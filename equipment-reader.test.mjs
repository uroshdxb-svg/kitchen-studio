import test from 'node:test';
import assert from 'node:assert/strict';
import './equipment-intake.js';
import './equipment-reader.js';
const parse=globalThis.KS_reader.parseText;
test('local labels preserve exact model, units, quantity and explicit utility states',()=>{
  const [r]=parse('Brand: Example\nModel: X-10/UK\nQuantity: 2\nWidth: 60 cm\nDepth (mm): 700\nHeight: 850 mm\nPlacement: countertop\nPower: electric\nElectrical load: 0.5 kW\nWater: no');
  assert.equal(r.brand,'Example');assert.equal(r.model,'X-10/UK');assert.equal(r.qty,2);assert.equal(r.w,600);assert.equal(r.d,700);assert.equal(r.h,850);assert.equal(r.mount,'top');assert.equal(r.kw,.5);assert.equal(r.water,false);assert.equal(r.drain,null);
});
test('axes must be explicit; shipping dimensions and unlabeled numbers are not specifications',()=>{
  const [r]=parse('Brand: Example\nModel: X1\nShipping dimensions (W x D x H): 900 x 800 x 1000 mm\n600 x 700 x 850 mm\nPrice: 1400\nWidth: 600\nVoltage: 230\nPower: 230V');
  for(const f of ['w','d','h','kw','power','water','drain','mount'])assert.equal(r[f],null,f);
  const [s]=parse('Dimensions (D x W x H): 70 x 60 x 85 cm');assert.equal(s.w,600);assert.equal(s.d,700);assert.equal(s.h,850);
});
test('blank blocks and repeated labelled identities preserve multiple equipment items',()=>{
  assert.equal(parse('Brand: One\n\nModel: A1\n\nWidth: 600 mm\n\nDepth: 700 mm').length,1,'OCR spacing does not split labelled fields');
  assert.equal(parse('Brand: One\nModel: A1\nBrand: Two\nModel: B2').length,2);
  assert.equal(parse('Brand: One\nModel: A1\n\nBrand: Two\nModel: B2').length,2);
  assert.throws(()=>parse('x\n\n'.repeat(51)),/50 equipment/);
  assert.throws(()=>parse(''),/No readable text/);
});
test('catalogue identity requires an exact suffix and never supplies dimensions or utilities',()=>{
  const catalogue=[{brand:'Example',model:'X-10',name:'Chiller',w:600,water:false}];
  const [r]=parse('Example X-10',catalogue);assert.equal(r.model,'X-10');assert.equal(r.w,null);assert.equal(r.water,null);
  assert.equal(parse('Example X-10/UK',catalogue)[0].model,'');
  assert.equal(parse('Example X-10-P',catalogue)[0].model,'');
});
test('raw document material and prices are not retained in rows',()=>{
  const [r]=parse('Brand: Example\nModel: X1\nCustomer: Person\nEmail: secret@example.test\nPrice: 999\nDescription: <img src=x>');
  assert.equal(r.excerpt,'');assert.doesNotMatch(JSON.stringify(r),/Person|secret|999/);
  assert.equal(r.name,'<img src=x>'); // the existing review UI escapes this value
});
