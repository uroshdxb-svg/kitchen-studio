// Account/trial integration against the real built planner with a local auth fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';

const server=await serve(5196),base='http://localhost:5196';
const browser=await chromium.launch({executablePath:process.env.KS_TEST_EXECUTABLE,...(process.env.KS_TEST_BROWSER?{channel:process.env.KS_TEST_BROWSER}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const mock=fs.readFileSync('mock-backend.js','utf8'),errors=[],contexts=[];
const DAY=86400000,NOW=Date.UTC(2026,10,4,12),profile={country_code:'AE',professional_role:'chef',use_case:'new_opening'};
const sample={v:1,name:'Draft before signup',room:{w:7200,d:5400,h:3000},items:[],at:NOW};
async function open(seed={}){
  const ctx=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});contexts.push(ctx);
  await ctx.route('**/*',r=>r.request().url().startsWith(base)||/^(blob|data):/.test(r.request().url())?r.continue():r.abort());
  const initialize=({seed,now})=>{
    window.__clock=now;Date.now=()=>window.__clock;
    if(!sessionStorage.getItem('ks.test.seeded')){for(const [k,v]of Object.entries(seed))localStorage.setItem(k,JSON.stringify(v));sessionStorage.setItem('ks.test.seeded','1');}
    window.__metrics=[];window.__identities=[];window.__resets=0;
    window.KS_analytics={track:(name,details)=>window.__metrics.push({name,details}),identify:(id,p)=>window.__identities.push({id,profile:p}),reset:()=>window.__resets++};
  };
  await ctx.addInitScript({content:'('+initialize.toString()+')('+JSON.stringify({seed,now:NOW})+');\n'+mock});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/app/');await page.waitForFunction(()=>!!window.KS_access);
  await page.waitForFunction(()=>document.getElementById('ksTrialNotice'));
  return page;
}
const dialogOpen=page=>page.locator('#ksAccessDialog').evaluate(d=>d.open);
const dismiss=async page=>{if(await page.locator('#ksAccessDialog').count()&&await dialogOpen(page))await page.click('#ksAccessLater');};
const fillProfile=async(page,values=profile)=>{await page.selectOption('#ksCountry',values.country_code);await page.selectOption('#ksRole',values.professional_role);await page.selectOption('#ksUseCase',values.use_case);};
const editWidth=async(page,value)=>{await page.click('#t-room');await page.fill('#roomW',String(value));await page.dispatchEvent('#roomW','change');};
const changeTime=(page,time)=>page.evaluate(t=>window.__clock=t,time);
fs.mkdirSync('test-results',{recursive:true});

try{
  const untouched=await open();await untouched.evaluate(()=>KS_backend.signInGoogle());await untouched.waitForFunction(()=>KS_access.isReady());await untouched.waitForTimeout(200);
  assert.equal(await untouched.evaluate(()=>JSON.parse(localStorage.getItem('ks.mock')).projects.length),0,'signing in alone does not count the untouched example as a saved kitchen');
  const page=await open();let downloads=0;page.on('download',()=>downloads++);
  assert.equal(await page.locator('#ksAccessDialog').count(),0,'opening a builder does not interrupt with signup');
  await editWidth(page,8000);await editWidth(page,7800);await page.waitForTimeout(500);
  assert.equal(await page.locator('#ksAccessDialog').count(),0,'two edits do not prompt');
  await editWidth(page,7600);await page.waitForFunction(()=>document.getElementById('ksAccessDialog')?.open);
  assert.match(await page.textContent('#ksAccessTitle'),/Keep building/);
  assert.equal(await page.locator('#ksEmail').getAttribute('type'),'email');
  assert.equal(await page.locator('#ksCountry option').count(),250,'country selector covers ISO countries plus placeholder');
  assert.deepEqual(await page.locator('#ksRole option').evaluateAll(es=>es.map(e=>e.value).filter(Boolean)),['operator','chef','restaurant_manager','general_manager','owner','supplier','other']);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('#ksAccessDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'signup fits a phone');
  await page.screenshot({path:'test-results/signup-phone.png'});await page.setViewportSize({width:1280,height:900});
  await dismiss(page);await editWidth(page,7500);await page.waitForTimeout(600);
  assert.equal(await dialogOpen(page),false,'dismissed nudge does not immediately reappear');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('ks.project')||'null')?.room.w===7500);

  await page.click('#t-sch');
  for(const id of ['expCsv','expSvg','expPdf']){
    await page.click('#'+id);await page.waitForFunction(()=>document.getElementById('ksAccessDialog').open);
    assert.match(await page.textContent('#ksAccessDialog'),/export/i);await dismiss(page);
  }
  await page.click('#menuBtn');await page.click('#projSave');await page.waitForFunction(()=>document.getElementById('ksAccessDialog').open);await dismiss(page);
  await page.waitForTimeout(200);
  assert.equal(downloads,0,'guest CSV, SVG, PDF and JSON attempts do not download');
  assert.equal(await page.evaluate(()=>__metrics.filter(e=>e.name==='Export Generated').length),0,'blocked exports never count as exports');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ks.project')).room.w),7500,'gates preserve the draft');

  // Complete the real form; the mock returns a verified auth session asynchronously.
  await page.click('#expCsv');await page.fill('#ksEmail','chef@example.com');await fillProfile(page);await page.click('#ksAccessSubmit');
  await page.waitForFunction(()=>window.KS_access.isReady());
  await page.waitForFunction(()=>/Saved online/.test(document.getElementById('saveState').textContent));
  assert.equal(await dialogOpen(page),false,'successful signup closes the prompt');
  const account=await page.evaluate(()=>JSON.parse(localStorage.getItem('ks.mock')));
  assert.deepEqual(Object.fromEntries(Object.keys(profile).map(k=>[k,account.profile[k]])),profile,'profile dimensions are stored');
  assert.equal(account.projects[0].data.room.w,7500,'signup saves the existing draft without resetting it');
  const pending=page.waitForEvent('download');await page.click('#expCsv');await pending;
  assert.equal(downloads,1,'verified account with completed profile can export');
  assert.equal(await page.evaluate(()=>__metrics.filter(e=>e.name==='Export Generated').length),1,'successful export counts once');
  assert.equal(await page.evaluate(()=>JSON.stringify({events:__metrics,identities:__identities}).includes('chef@example.com')),false,'analytics excludes account email');
  await page.evaluate(()=>KS_backend.signOut());await page.waitForFunction(()=>!KS_access.isReady());
  assert.ok(await page.evaluate(()=>__resets>0),'signout resets analytics identity');
  await page.click('#expCsv');await page.waitForFunction(()=>document.getElementById('ksAccessDialog').open);assert.equal(downloads,1,'signout restores export restriction');

  // Existing accounts must fill the profile, without entering an email again.
  const previousKitchen={id:'old-kitchen',name:'Previous online kitchen',data:{...sample,room:{w:6000,d:4000,h:3000}},version:1,updated_at:new Date(NOW-DAY).toISOString(),public_id:'old-share',is_public:false};
  const existing=await open({'ks.mock':{user:{id:'u1',email:'returning@example.com',email_confirmed_at:new Date(NOW).toISOString(),is_anonymous:false},projects:[previousKitchen],equipment:[],waitlist:[]},'ks.project':sample});
  await existing.waitForFunction(()=>document.getElementById('ksAccessDialog')?.open);
  assert.match(await existing.textContent('#ksAccessTitle'),/Finish your profile/);assert.equal(await existing.locator('#ksEmail').count(),0);
  await fillProfile(existing,{country_code:'RS',professional_role:'supplier',use_case:'equipment_sales'});await existing.click('#ksAccessSubmit');
  await existing.waitForFunction(()=>KS_access.isReady());
  assert.equal(await existing.evaluate(()=>JSON.parse(localStorage.getItem('ks.mock')).profile.professional_role),'supplier');
  assert.equal(await existing.inputValue('#roomW'),'7200','profile completion preserves existing local layout');
  await existing.waitForFunction(()=>JSON.parse(localStorage.getItem('ks.mock')).projects.length===2);
  assert.equal(await existing.evaluate(()=>JSON.parse(localStorage.getItem('ks.mock')).projects[0].data.room.w),6000,'previous online kitchen is not overwritten by guest draft');

  const before=await open({'ks.guest.v1':{startedAt:NOW-3*DAY+1,lastSeenAt:NOW,actions:0,promptAt:NOW,expiredReported:false},'ks.project':sample});
  await before.click('#t-eq');await before.click('#goNewBtn');
  assert.equal(await before.locator('#p-new').isHidden(),false,'custom equipment remains available one millisecond before expiry');
  await before.fill('#nBrand','Example');await before.fill('#nModel','BEFORE-DEADLINE');await before.fill('#nW','600');await before.fill('#nD','600');await before.fill('#nH','800');await before.selectOption('#nPower','none');
  await changeTime(before,NOW+1);await before.click('#nSaveOnly');await before.waitForFunction(()=>document.getElementById('ksAccessDialog')?.open);
  assert.equal(await before.evaluate(()=>JSON.parse(localStorage.getItem('ks.custom')||'[]').length),0,'save rechecks the 72-hour limit after the form was opened');
  await dismiss(before);await before.click('#backToEq');await before.click('#intakeOpen');await before.waitForFunction(()=>document.getElementById('ksAccessDialog')?.open);
  assert.equal(await before.locator('#intakeDlg').evaluate(d=>d.open),false,'expired trial cannot open equipment intake');await dismiss(before);
  await editWidth(before,7100);await before.waitForFunction(()=>JSON.parse(localStorage.getItem('ks.project')).room.w===7100);
  assert.equal(await before.inputValue('#roomW'),'7100','basic planning and draft saving remain available after expiry');
  assert.ok(await before.evaluate(()=>__metrics.some(e=>e.name==='Guest Trial Expired')),'expiry is measured');

  // A quotation opened during the trial cannot be committed after its deadline.
  const intake=await open({'ks.guest.v1':{startedAt:NOW-3*DAY+1000,lastSeenAt:NOW,actions:0,promptAt:NOW,expiredReported:false}});
  await intake.click('#t-eq');await intake.click('#intakeOpen');
  await intake.locator('#intakeFile').setInputFiles({name:'supplier.csv',mimeType:'text/csv',buffer:Buffer.from('brand,model,w,d,h,mount\nExample,EXPIRED-ROW,600,700,850,floor\n')});
  await intake.click('#intakeRead');await intake.locator('[data-row]').first().waitFor();await intake.locator('[data-confirm]').check();
  await changeTime(intake,NOW+1000);await intake.click('#intakeSave');await intake.waitForFunction(()=>document.getElementById('ksAccessDialog')?.open);
  assert.equal(await intake.evaluate(()=>JSON.parse(localStorage.getItem('ks.intake.models.v1.device')||'[]').length),0,'intake apply rechecks expiry');
  assert.ok(await intake.evaluate(()=>localStorage.getItem('ks.intake.v1.device')),'blocked intake retains the review draft');
  assert.deepEqual(errors,[],'no app errors during access flows');
  console.log('PASS: signup prompt, profile capture, all guest exports blocked, verified export, draft retention, existing accounts, signout and exact 72-hour manual/intake cutoff');
}finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();await new Promise(r=>server.close(r));}
