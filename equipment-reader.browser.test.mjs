import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {jsPDF} from 'jspdf';
import {serve} from './serve.mjs';
const live=process.env.KS_READER_TEST_URL;
const server=live?null:await serve(5191),base=live||'http://localhost:5191';
const browser=await chromium.launch({executablePath:process.env.KS_TEST_EXECUTABLE,...(process.env.KS_TEST_BROWSER?{channel:process.env.KS_TEST_BROWSER}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await browser.newContext({viewport:{width:1280,height:900}}),page=await ctx.newPage(),errors=[],aiCalls=[],externalPosts=[];
const origin=new URL(base).origin;
await ctx.route('**/*',route=>{
  const req=route.request(),url=req.url();
  if(url.includes('/functions/'))aiCalls.push(url);
  if(req.method()==='POST'&&!url.startsWith(origin+'/'))externalPosts.push(url);
  return url.startsWith(origin+'/')||url.startsWith('blob:')||url.startsWith('data:')?route.continue():route.abort();
});
page.on('pageerror',e=>errors.push(e.message));fs.mkdirSync('test-results',{recursive:true});
const lines=['Brand: Example','Model: TEST-123','Description: Counter refrigerator','Quantity: 2','Width: 600 mm','Depth: 700 mm','Height: 850 mm','Placement: floor'];
const reset=async()=>{page.once('dialog',d=>d.accept());await page.click('#intakeReset');};
const review=async()=>{await page.locator('#intakeRecognized').waitFor({timeout:100000});assert.match(await page.inputValue('#intakeRecognized'),/TEST-123/i);await page.click('#intakeBuild');await page.locator('[data-row]').first().waitFor();};
try{
  await page.goto(base+'/app/');await page.click('#t-eq');await page.click('#intakeOpen');
  assert.equal(await page.locator('#intakeConsent').count(),0,'no AI consent or account required');
  const image=await page.evaluate(lines=>{const c=document.createElement('canvas');c.width=1200;c.height=650;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.font='30px Arial';x.fillStyle='black';lines.forEach((s,i)=>x.fillText(s,50,60+i*65));return c.toDataURL('image/png');},lines);
  const bytes=Buffer.from(image.split(',')[1],'base64');
  await page.locator('#intakeFile').setInputFiles({name:'equipment.png',mimeType:'image/png',buffer:bytes});await page.click('#intakeRead');
  await page.locator('#intakeRecognized').waitFor({timeout:100000});
  const recognized=await page.inputValue('#intakeRecognized');assert.match(recognized,/Width:\s*600\s*mm/i);assert.match(recognized,/Example/);
  await page.click('#intakeBack');assert.equal(await page.locator('#intakeFile').evaluate(e=>e.files[0].name),'equipment.png');
  await page.click('#intakeRead');await review();
  const card=page.locator('[data-row]').first();assert.equal(await card.locator('[data-field=w]').inputValue(),'600');assert.equal(await card.locator('[data-field=model]').inputValue(),'TEST-123');
  assert.equal(await card.locator('[data-field=water]').inputValue(),'');
  await card.locator('[data-confirm]').check();await page.click('#intakeAdd');await page.waitForFunction(()=>!document.getElementById('intakeClose').disabled);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ks.project')).items.filter(i=>i.model==='TEST-123').length),2);
  assert.doesNotMatch(await page.evaluate(()=>localStorage.getItem('ks.intake.v1.device')),/data:image|Customer|recognizedText/);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/reader-phone-review.png'});
  assert.ok(await page.locator('#intakeBody').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.setViewportSize({width:1280,height:900});await reset();
  // Actual embedded PDF text extraction, including multiple items.
  const pdf=new jsPDF();pdf.text(lines,20,20);pdf.addPage();pdf.text(lines.map(s=>s.replace('TEST-123','TEST-456')),20,20);
  await page.locator('#intakeFile').setInputFiles({name:'quotation.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf.output('arraybuffer'))});await page.click('#intakeRead');await review();
  assert.equal(await page.locator('[data-row]').count(),2);await reset();
  // Actual scanned PDF rendering and OCR, no mocked extraction.
  const scan=new jsPDF();scan.addImage(image,'PNG',10,10,190,103);
  await page.locator('#intakeFile').setInputFiles({name:'scanned.pdf',mimeType:'application/pdf',buffer:Buffer.from(scan.output('arraybuffer'))});await page.click('#intakeRead');await review();await reset();
  // Cancellation must return controls promptly and preserve the file.
  await page.locator('#intakeFile').setInputFiles({name:'cancel.png',mimeType:'image/png',buffer:bytes});await page.click('#intakeRead');await page.click('#intakeCancel');
  await page.waitForFunction(()=>!document.getElementById('intakeClose').disabled);
  assert.match(await page.textContent('#intakeMessage'),/cancelled/);assert.equal(await page.locator('#intakeFile').evaluate(e=>e.files[0].name),'cancel.png');
  // Missing worker assets give a recoverable failure instead of a stalled form.
  await ctx.route('**/app/ocr-worker.js',r=>r.abort());await page.click('#intakeRead');await page.waitForFunction(()=>!document.getElementById('intakeClose').disabled);
  assert.match(await page.textContent('#intakeMessage'),/could not start/);await ctx.unroute('**/app/ocr-worker.js');
  const large=new jsPDF();for(let i=0;i<4;i++)large.addPage();
  await page.locator('#intakeFile').setInputFiles({name:'large.pdf',mimeType:'application/pdf',buffer:Buffer.from(large.output('arraybuffer'))});await page.click('#intakeRead');await page.waitForFunction(()=>!document.getElementById('intakeClose').disabled);
  assert.match(await page.textContent('#intakeMessage'),/5 pages/);
  await page.locator('#intakeFile').setInputFiles([]);
  await page.fill('#intakeText','Brand: Example\nModel: SAFE-1\nDescription: <img src=x onerror=alert(1)>');await page.click('#intakeRead');await page.click('#intakeBuild');
  assert.equal(await page.locator('#intakeRows img').count(),0,'recognized text is escaped');await reset();
  const catalogue=await (await ctx.request.get(base+'/app/catalogue.json')).json(),row=catalogue.find(r=>r[7]==='floor'&&r[4]>100);
  await page.fill('#intakeText',`Brand: ${row[0]}\nModel: ${row[1]}\nWidth: ${row[4]+50} mm\nDepth: ${row[5]} mm\nHeight: ${row[6]} mm\nPlacement: floor`);
  await page.click('#intakeRead');await page.click('#intakeBuild');assert.match(await page.locator('[data-row]').first().textContent(),/Check differences: w/);
  await page.locator('[data-match]').selectOption(String(catalogue.indexOf(row)));await page.locator('[data-confirm]').check();await page.click('#intakeAdd');
  await page.waitForFunction(()=>!document.getElementById('intakeClose').disabled);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ks.project')).items.at(-1).w),row[4]);
  assert.deepEqual(aiCalls,[]);assert.deepEqual(externalPosts,[]);assert.deepEqual(errors,[]);
  console.log('PASS: real screenshot OCR, scanned and text PDFs, local-only signed-out placement, mobile, cancellation, asset failure, and zero AI requests');
}finally{await ctx.close();await browser.close();if(server)await new Promise(r=>server.close(r));}
