// Exercise the real GPU pipeline, asset failure, resource ownership and offline build.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';
import worker from './worker.js';
const ROOT=path.dirname(fileURLToPath(import.meta.url)),OUT=path.join(ROOT,'test-results');fs.mkdirSync(OUT,{recursive:true});
const server=await serve(5183),base='http://localhost:5183';
const browser=await chromium.launch({executablePath:process.env.KS_TEST_EXECUTABLE,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
// Shared CI runners render WebGL in software; screenshot capture can exceed
// Playwright's 30-second default even when interaction and asset checks pass.
const SCREENSHOT_TIMEOUT=90_000;
function watch(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))errors.push(m.text());});}
const rebuild=()=>KS3D.rebuild(example,null,{sunk:'#111820'},i=>i.z||0,i=>i.sym,i=>i.rot%180?i.d:i.w,i=>i.rot%180?i.w:i.d);
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});watch(page);
 await page.goto(base+'/showcase/');await page.evaluate(()=>KS3D.ready());await page.evaluate(()=>KS3D.draw());
 const first=await page.evaluate(()=>KS3D.stats());assert.equal(first.chef,'ready');assert.ok(first.triangles>48000);assert.ok(first.calls<150,JSON.stringify(first));console.log('Loaded real chef, PBR textures, HDR reflections and contact shading:',first);
 await page.screenshot({timeout:SCREENSHOT_TIMEOUT,path:path.join(OUT,'realism-overview.png')});
 await page.click('#cooking');await page.screenshot({timeout:SCREENSHOT_TIMEOUT,path:path.join(OUT,'realism-cooking.png')});
 const jpeg=await page.evaluate(()=>KS3D.snapshot([{th:.55,ph:.95}],1200,900,'#ffffff')[0]);assert.ok(jpeg.startsWith('data:image/jpeg;base64,'));fs.writeFileSync(path.join(OUT,'realism-export.jpg'),Buffer.from(jpeg.split(',')[1],'base64'));
 await page.evaluate(()=>KS3D.draw());await page.screenshot({timeout:SCREENSHOT_TIMEOUT,path:path.join(OUT,'realism-after-export.png')});
 await page.click('#walk');assert.equal(await page.evaluate(()=>KS3D.mode),'walk');await page.screenshot({timeout:SCREENSHOT_TIMEOUT,path:path.join(OUT,'realism-walk.png')});
 await page.keyboard.down('w');await page.waitForTimeout(180);await page.keyboard.up('w');await page.click('#overview');
 const counts=[];for(let i=0;i<8;i++){await page.evaluate(rebuild);counts.push(await page.evaluate(()=>KS3D.stats()));}
 assert.ok(counts.at(-1).geometries<=counts[1].geometries+1,JSON.stringify(counts));assert.ok(counts.at(-1).textures<=counts[1].textures+1,JSON.stringify(counts));console.log('Eight rebuilds retain stable GPU resources:',counts.at(-1));
 await page.evaluate(()=>example.room.poly=[[0,0],[6200,0],[6200,3500],[4000,3500],[4000,4800],[0,4800]]);await page.evaluate(rebuild);await page.screenshot({timeout:SCREENSHOT_TIMEOUT,path:path.join(OUT,'realism-polygon.png')});
 // A short rack must not create an unbounded shelf loop.
 await page.evaluate(()=>{example.items.find(i=>i.id==='rack').h=205;});await page.evaluate(rebuild);
 await page.close();
 const phone=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});watch(phone);await phone.goto(base+'/showcase/');await phone.evaluate(()=>KS3D.ready());await phone.screenshot({timeout:SCREENSHOT_TIMEOUT,path:path.join(OUT,'realism-phone.png')});assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await phone.click('#walk');assert.equal(await phone.getAttribute('#walk','aria-pressed'),'true');assert.ok(await phone.locator('#joy').isVisible());await phone.close();console.log('Phone layout and walkthrough controls pass.');
 const failed=await browser.newPage();watch(failed);await failed.route('**/chef-*.glb',r=>r.abort());await failed.goto(base+'/showcase/');await failed.evaluate(()=>KS3D.ready());assert.equal(await failed.evaluate(()=>KS3D.assetStatus),'unavailable');await failed.click('#cooking');assert.ok(await failed.evaluate(()=>KS3D.stats().triangles>10000));await failed.close();console.log('Failed model download leaves an interactive kitchen and clear loading message.');
 const offline=await browser.newPage();watch(offline);const requests=[];await offline.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});await offline.goto(pathToFileURL(path.join(ROOT,'dist-standalone/Kitchen_Studio.html')).href);await offline.click('#v3dBtn');await offline.click('#personBtn');await offline.evaluate(()=>KS3D.ready());assert.equal(await offline.evaluate(()=>KS3D.assetStatus),'ready');assert.equal(requests.length,0);await offline.screenshot({timeout:SCREENSHOT_TIMEOUT,path:path.join(OUT,'realism-offline.png')});await offline.close();console.log('Standalone file works offline with the real chef, textures and lighting.');
 for(const host of ['www.kitchenstudio.design','kitchen-studio.urosh-dxb.workers.dev']){const res=await worker.fetch(new Request('https://'+host+'/app/?x=1'),{});assert.equal(res.status,301);assert.equal(res.headers.get('Location'),'https://kitchenstudio.design/app/?x=1');}
 for(const host of ['kitchenstudio.design','codex-3d-materials-preview-kitchen-studio.urosh-dxb.workers.dev']){const res=await worker.fetch(new Request('https://'+host+'/showcase/'),{ASSETS:{fetch:()=>new Response('preview')}});assert.equal(res.status,200);assert.equal(await res.text(),'preview');}console.log('Production aliases redirect; branch preview serves its own assets.');
 assert.deepEqual(errors,[]);console.log('All 3D checks passed without JavaScript or shader errors.');
}finally{await browser.close();server.close();}
