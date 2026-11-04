import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import path from 'node:path';

const base='http://localhost:5197',errors=[];
const browser=await chromium.launch({executablePath:process.env.KS_TEST_EXECUTABLE,...(process.env.KS_TEST_BROWSER?{channel:process.env.KS_TEST_BROWSER}:{})});
const context=await browser.newContext({viewport:{width:390,height:844}});
try{
  await context.route('**/*',async r=>{
    const url=new URL(r.request().url());if(url.origin!==base)return /^(blob|data):/.test(url.protocol)?r.continue():r.abort();
    let name=url.pathname;if(name==='/app/')name='/app/index.html';
    const file=path.join(process.cwd(),'dist',name),ext=path.extname(file);
    if(!fs.existsSync(file)||fs.statSync(file).isDirectory())return r.fulfill({status:404,body:'not found'});
    return r.fulfill({status:200,contentType:({'.html':'text/html','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'})[ext]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await context.addInitScript({content:fs.readFileSync('mock-backend.js','utf8')+'\nwindow.__events=[];window.KS_analytics={track:(name,details)=>__events.push({name,details}),identify:()=>{},reset:()=>{}};'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/app/');await page.waitForFunction(()=>window.KS_access);
  assert.equal(await page.locator('#ksUpdatesBadge').isVisible(),true);
  await page.click('#updatesBtn');await page.waitForSelector('#ksUpdateFeedback');
  assert.equal(await page.locator('#ksUpdatesBadge').isVisible(),false);
  assert.ok(await page.locator('#dlg').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.click('#ksUpdateFeedback');
  assert.equal(await page.locator('#ksResearchContact').isChecked(),false);
  assert.equal(await page.locator('#ksResearchUpdates').isChecked(),false);
  await page.fill('#ksResearchGoal','Plan a new cafe');await page.fill('#ksResearchBlocker','Need better extraction planning');
  await page.check('#ksResearchContact');await page.click('#ksResearchSend');
  assert.match(await page.textContent('#ksResearchMessage'),/Add an email/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ks.mock')||'{}').reports?.length||0),0);
  await page.fill('#ksResearchEmail','tester@example.com');
  await page.selectOption('#ksResearchSource','ai');await page.selectOption('#ksResearchPayment','per_project');
  await page.fill('#ksResearchBudget','200 AED per kitchen');
  // The failed request must keep the complete form, with a usable retry.
  await page.evaluate(()=>{window.__report=KS_backend.report;KS_backend.report=async()=>{throw new Error('network unavailable');};});
  await page.click('#ksResearchSend');await page.waitForFunction(()=>document.getElementById('ksResearchMessage').textContent.includes('network unavailable'));
  assert.equal(await page.inputValue('#ksResearchGoal'),'Plan a new cafe');
  assert.equal(await page.locator('#ksResearchSend').isEnabled(),true);
  await page.evaluate(()=>KS_backend.report=__report);await page.click('#ksResearchSend');await page.waitForSelector('#ksResearchDone');
  const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('ks.mock')).reports[0]);
  assert.equal(report.context.discovery_source,'ai');assert.equal(report.context.payment_preference,'per_project');
  assert.equal(report.context.research_contact_consent,true);assert.equal(report.context.product_updates_consent,false);
  assert.equal(report.project,null);assert.equal(report.email,'tester@example.com');
  assert.equal(await page.evaluate(()=>JSON.stringify(__events).includes('tester@example.com')),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(__events).includes('extraction')),false);
  await page.click('#ksResearchDone');await page.reload();await page.waitForSelector('#updatesBtn');
  assert.equal(await page.locator('#ksUpdatesBadge').isVisible(),false,'read updates stay read');
  // Optional signup attribution survives passwordless signup without becoming an access condition.
  await page.setViewportSize({width:1280,height:900});await page.click('#t-sch');await page.click('#expCsv');await page.fill('#ksEmail','signup@example.com');
  assert.equal(await page.locator('#ksDiscovery').getAttribute('required'),null);
  await page.selectOption('#ksCountry','AE');await page.selectOption('#ksRole','chef');await page.selectOption('#ksUseCase','new_opening');await page.selectOption('#ksDiscovery','recommendation');
  await page.click('#ksAccessSubmit');await page.waitForFunction(()=>KS_access.isReady());
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ks.mock')).profile.discovery_source),'recommendation');
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile updates, read persistence, optional source, research validation, consent, private answers, failed-send recovery, signup attribution');
}finally{await context.close();await browser.close();}
