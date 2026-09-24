// End-to-end smoke test of the built site with a mock backend. Run: npm run build && npm test
import {chromium} from "playwright";import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";import {serve} from "./serve.mjs";
const HERE=path.dirname(fileURLToPath(import.meta.url)),SHOTS=path.join(HERE,"..","public","shots");fs.mkdirSync(SHOTS,{recursive:true});
const PORT=5177,BASE=`http://localhost:${PORT}`;const server=await serve(PORT);
const browser=await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]});
const mock=fs.readFileSync(path.join(HERE,"mock-backend.js"),"utf8");
const errors=[];let fails=0;const check=(ok,msg)=>{console.log((ok?"  ok   ":"  FAIL ")+msg);if(!ok)fails++;};
const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:"light"});
await ctx.addInitScript(mock);
const page=await ctx.newPage();page.on("pageerror",e=>errors.push("app: "+e.message));page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});

console.log("1. landing page");
await page.goto(BASE+"/");await page.waitForTimeout(600);
check(await page.title().then(t=>/Kitchen Studio/.test(t)),"title");
check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"no horizontal scroll on phone");
check(!(await page.locator("#wlForm").isHidden()),"waitlist form shown with backend");
await page.fill("#wlEmail","chef@example.com");await page.click("#wlBtn");await page.waitForTimeout(300);
check(/on the list/.test(await page.textContent("#wlMsg")),"waitlist submit");

console.log("2. app, signed out");
await page.goto(BASE+"/app/");await page.waitForTimeout(1200);
check(!(await page.locator("#kitchensBtn").isHidden()),"kitchens button visible");
check(/sign in/.test(await page.textContent("#saveState")),"save label asks to sign in: "+await page.textContent("#saveState"));
await page.click("#kitchensBtn");await page.waitForTimeout(300);
check(await page.locator("#dlg").evaluate(d=>d.open),"sign-in dialog opens");
check(/Sign in/.test(await page.textContent("#dlgTitle")),"dialog is sign-in");
await page.fill("#siEmail","chef@example.com");await page.click("#siSend");await page.waitForTimeout(900);
check(!(await page.locator("#dlg").evaluate(d=>d.open)),"dialog closed after sign-in");
check(/Saved online/.test(await page.textContent("#saveState")),"first kitchen created online: "+await page.textContent("#saveState"));
const list1=await page.evaluate(()=>JSON.parse(localStorage.getItem("ks.mock")).projects);check(list1.length===1,"one project in backend");

console.log("3. edit, my kitchens, rename, new kitchen");
await page.click("#t-room");await page.fill("#roomW","7000");await page.dispatchEvent("#roomW","change");await page.waitForTimeout(1600);
const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("ks.mock")).projects[0].data.room.w);check(saved===7000,"edit persisted to backend (room w=7000)");
await page.click("#kitchensBtn");await page.waitForTimeout(400);
check(/My kitchens/.test(await page.textContent("#dlgTitle")),"my kitchens dialog");
check((await page.locator(".krow").count())===1,"one row listed");
await page.click('.krow [data-act="rename"]');await page.waitForTimeout(200);await page.fill("#askIn","Burger cloud kitchen");await page.click("#askOk");await page.waitForTimeout(500);
check(/Burger cloud kitchen/.test(await page.textContent(".klist")),"renamed in list");
await page.screenshot({path:path.join(SHOTS,"test-kitchens.png")});
await page.click("#kNew");await page.waitForTimeout(200);await page.fill("#askIn","Café Riyadh");await page.click("#askOk");await page.waitForTimeout(700);
const list2=await page.evaluate(()=>JSON.parse(localStorage.getItem("ks.mock")).projects);check(list2.length===2,"second project created");
check(/Café Riyadh/.test(await page.textContent("#saveState")),"header shows new kitchen name");
check((await page.evaluate(()=>document.querySelectorAll(".it").length))===0,"new kitchen is empty");

console.log("4. share link");
await page.click("#menuBtn");await page.click("#mShare");await page.waitForTimeout(400);
const url=await page.inputValue("#shUrl");check(/\/k\/[A-Za-z0-9]{8,}/.test(url),"share url: "+url);
await page.click("#dlgClose");
// open in a fresh context (another person, signed out)
const ctx2=await browser.newContext({viewport:{width:1280,height:900}});await ctx2.addInitScript(mock);
const p2=await ctx2.newPage();p2.on("pageerror",e=>errors.push("shared: "+e.message));
// share state lives in the first context's localStorage; copy it across
const st=await page.evaluate(()=>localStorage.getItem("ks.mock"));await p2.addInitScript(s=>{const j=JSON.parse(s);j.user=null;localStorage.setItem("ks.mock",JSON.stringify(j));},st);
await p2.goto(url);await p2.waitForTimeout(1200);
check(!(await p2.locator("#banner").isHidden()),"shared banner shown");
check(/Café Riyadh/.test(await p2.textContent("#banner")),"banner names the kitchen");
check(p2.url().endsWith("/app/"),"url rewritten to /app/ after loading the share");
await p2.click("#bnSave");await p2.waitForTimeout(300);check(/Sign in/.test(await p2.textContent("#dlgTitle")),"save-copy asks to sign in when signed out");
await ctx2.close();

console.log("5. sign out keeps local copy");
await page.click("#menuBtn");await page.click("#mSignOut");await page.waitForTimeout(500);
check(/sign in to save online/.test(await page.textContent("#saveState")),"signed-out label");
check(/Café Riyadh/.test(await page.textContent("#saveState")),"kitchen name kept locally");

console.log("6. screenshots for the landing page (desktop plan, phone plan, 3D)");
const d=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,colorScheme:"light"});const dp=await d.newPage();dp.on("pageerror",e=>errors.push("desk: "+e.message));
await dp.goto(BASE+"/app/");await dp.waitForTimeout(1500);await dp.click("#t-eq");await dp.waitForTimeout(400);await dp.screenshot({path:path.join(SHOTS,"plan-desktop.png")});
await dp.click("#v3dBtn");await dp.waitForTimeout(2500);await dp.screenshot({path:path.join(SHOTS,"3d.png"),clip:{x:400,y:0,width:800,height:900}});
await d.close();
const ph=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,colorScheme:"light"});const pp=await ph.newPage();
await pp.goto(BASE+"/app/");await pp.waitForTimeout(1500);await pp.click("#zIn");await pp.waitForTimeout(400);await pp.screenshot({path:path.join(SHOTS,"plan-phone.png")});await ph.close();
check(errors.length===0,"no page errors"+(errors.length?": "+errors.join(" | "):""));
await browser.close();server.close();
console.log(fails?`\n${fails} check(s) failed`:"\nall checks passed");process.exit(fails?1:0);
