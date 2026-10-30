import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
const live=process.env.KS_READER_TEST_URL,server=live?null:await serve(5194),base=live||'http://localhost:5194';
const browser=await chromium.launch({...process.env.KS_TEST_BROWSER?{channel:process.env.KS_TEST_BROWSER}:{},args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await browser.newContext({viewport:{width:1280,height:1000}}),page=await ctx.newPage(),errors=[],posts=[];
await ctx.route('**/*',r=>{const q=r.request();if(q.method()==='POST')posts.push(q.url());return q.url().startsWith(new URL(base).origin+'/')||/^(blob|data):/.test(q.url())?r.continue():r.abort();});
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(base+'/app/');await page.click('#t-eq');await page.click('#intakeOpen');
  const fixture=await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=1800;c.height=900;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,1800,900);x.fillStyle='black';x.font='30px Arial';x.fillText('Example supplier quotation',40,60);x.fillText('Customer: PRIVATE CUSTOMER',40,110);
    const edges=[30,150,900,1170,1390,1600,1770],ys=[180,235,470,705];x.lineWidth=2;
    for(const y of ys){x.beginPath();x.moveTo(30,y);x.lineTo(1770,y);x.stroke();}for(const a of edges){x.beginPath();x.moveTo(a,180);x.lineTo(a,705);x.stroke();}
    x.font='24px Arial';['QTY','DESCRIPTION','DIMENSION','BRAND','MODEL','PRICE'].forEach((s,i)=>x.fillText(s,edges[i]+12,216));
    for(const [i,top] of [235,470].entries()){
      x.fillText(String(i+1),65,top+110);x.fillText('Counter grill',165,top+40);x.fillText('POWER: 2000W+2000W',165,top+82);x.fillText('VOLTAGE: 230V 50Hz',165,top+124);x.fillText('Placement: countertop',165,top+166);
      x.fillText('800x700x400',920,top+110);x.fillText('EXAMPLE',1185,top+110);x.fillText('TEST-'+(i+1),1405,top+110);x.fillText('1200',1620,top+110);
    }
    x.fillText('TOTAL WITH TAX: 3780',40,760);x.fillText('Terms: delivery and installation excluded',40,820);
    return c.toDataURL('image/png');
  });
  const file=process.env.KS_QUOTE_TEST_FILE;
  await page.locator('#intakeFile').setInputFiles(file||{name:'table.png',mimeType:'image/png',buffer:Buffer.from(fixture.split(',')[1],'base64')});await page.click('#intakeRead');
  await page.locator('[data-row]').first().waitFor({timeout:100000});
  assert.equal(await page.locator('#intakeRecognized').count(),0,'structured table goes directly to equipment fields');
  const card=page.locator('[data-row]').first();
  const values=await card.locator('[data-field]').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.dataset.field,e.value])));
  if(file){
    const expected=JSON.parse(process.env.KS_QUOTE_EXPECT||'{}');for(const [k,v]of Object.entries(expected))assert.equal(values[k],v,k);
    assert.equal(await page.locator('[data-row]').count(),1);
  }else{
    assert.equal(await page.locator('[data-row]').count(),2);assert.equal(values.brand,'EXAMPLE');assert.equal(values.model,'TEST-1');assert.equal(values.kw,'4');assert.equal(values.qty,'1');assert.equal(values.mount,'top');
    assert.equal(await page.locator('[data-row]').nth(1).locator('[data-field=qty]').inputValue(),'2');
    assert.doesNotMatch(await page.textContent('#intakeRows'),/PRIVATE CUSTOMER|3780|1200|delivery and installation/);
  }
  assert.equal(values.w,'');assert.equal(values.water,'');assert.equal(values.drain,'');
  await card.locator('[data-use-size]').click();assert.ok(Number(await page.locator('[data-row]').first().locator('[data-field=w]').inputValue())>0);
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/table-review.png'});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#intakeBody').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  assert.deepEqual(posts,[]);assert.deepEqual(errors,[]);
  console.log('PASS: actual ruled table OCR, direct equipment review, quantity, load, privacy, unknowns, size confirmation, mobile and zero POSTs');
}finally{await ctx.close();await browser.close();if(server)await new Promise(r=>server.close(r));}
