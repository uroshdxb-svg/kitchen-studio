(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CATS=["Combi ovens","Cooking","Fryers","High-speed ovens","Refrigeration","Blast chilling","Ice","Warewashing","Prep","Bakery","Holding","Service","Display","Beverage","Countertop","Storage"];
const BASE=CATALOGUE_ROWS.map(r=>({brand:r[0],model:r[1],cat:r[2],name:r[3],w:r[4],d:r[5],h:r[6],mount:r[7],power:r[8],kw:r[9],elec:r[10],water:!!r[11],drain:!!r[12],src:r[13],conf:"verified"}));

const SS={
  table:{n:"Work table",w:1500,d:700,h:900,mount:"floor",opts:["Undershelf","Upstand 100 mm","Drawer","Castors"],desc:"Open-leg table, 40 mm top with sound-deadening, adjustable feet."},
  cab:{n:"Cabinet table, sliding doors",w:1500,d:700,h:900,mount:"floor",opts:["Upstand 100 mm","Mid shelf","Heated"],desc:"Closed base cabinet with sliding doors and intermediate shelf."},
  sink1:{n:"Sink unit, 1 bowl",w:1200,d:700,h:900,mount:"floor",bowls:1,water:true,drain:true,opts:["Upstand 100 mm","Undershelf","Left drainer","Right drainer"],desc:"Single bowl 500 × 500 × 300, mixer tap hole, waste and overflow."},
  sink2:{n:"Sink unit, 2 bowls",w:1500,d:700,h:900,mount:"floor",bowls:2,water:true,drain:true,opts:["Upstand 100 mm","Undershelf","Left drainer","Right drainer"],desc:"Double bowl, mixer tap holes, waste and overflow."},
  sink3:{n:"Pot wash sink, 3 bowls",w:2100,d:700,h:900,mount:"floor",bowls:3,water:true,drain:true,opts:["Upstand 100 mm","Undershelf"],desc:"Three-compartment wash / rinse / sanitise sink."},
  hand:{n:"Hand wash basin, knee operated",w:400,d:350,h:850,mount:"floor",water:true,drain:true,opts:["Soap dispenser","Splash guard"],desc:"Wall-hung basin shown at rim height; knee valve and spout."},
  landing:{n:"Dishwasher landing table",w:1200,d:750,h:900,mount:"floor",opts:["Pre-rinse sink","Upstand 100 mm","Rack slide","Undershelf"],desc:"Inlet or outlet table matched to a hood-type dishwasher."},
  rack:{n:"Storage rack, 4 tier",w:1200,d:500,h:1800,mount:"floor",opts:["Perforated shelves","Castors"],desc:"Four-tier shelving, adjustable shelf heights."},
  trolley:{n:"GN tray trolley",w:460,d:620,h:1700,mount:"floor",opts:["Castors"],desc:"GN1/1 runner trolley."},
  wshelf:{n:"Wall shelf",w:1200,d:300,h:40,mount:"over",z:1500,opts:["Double tier","Pot rail"],desc:"Wall shelf on brackets. Shown dashed on plan; does not block floor units."},
  wcab:{n:"Wall cabinet",w:1200,d:400,h:600,mount:"over",z:1400,opts:["Sliding doors","Hinged doors"],desc:"Wall-hung cabinet with one intermediate shelf."},
  hood:{n:"Exhaust hood, wall type",w:2000,d:1200,h:500,mount:"over",z:2000,opts:["Baffle filters","Lights","Fresh-air plenum"],desc:"Box hood. Size it to overhang the cooking line by 150-300 mm each side."},
  gantry:{n:"Pass shelf / gantry",w:1800,d:350,h:400,mount:"top",opts:["Heat lamps","Ticket rail","Double tier"],desc:"Sits on a counter or pass. Add heat lamps as an option."}
};
const STD_W=[600,900,1200,1500,1800,2100,2400], STD_D=[300,400,600,700,800];

let state={room:{w:9000,d:6000,h:3000},items:[]};
let custom=[]; let sel=null; let view="plan"; let wall="N"; let zoom=1; let dirty=false; let isExample=true;
let db=null, sampleFn=null, downloads=null; let cat="All"; let ssOptsSel=new Set();
let be=null,curId=null,projName="",sharedFrom=null,projList=[];/* cloud backend (website build) */
const remoteEq={set:e=>{const j=JSON.parse(JSON.stringify(e));if(be&&be.user())be.saveEquipment(j).catch(()=>{});else if(db)db.doc("equipment/"+e.cid).set(j).catch(()=>{});},
  del:cid=>{if(be&&be.user())be.deleteEquipment(cid).catch(()=>{});else if(db)db.doc("equipment/"+cid).delete().catch(()=>{});}};
let uid=1; const newId=()=>"i"+Date.now().toString(36)+(uid++);

/* ---------- geometry ---------- */
const fw=i=>i.rot%180?i.d:i.w, fd=i=>i.rot%180?i.w:i.d;
const hit=(a,b)=>a.x<b.x+fw(b)-1&&a.x+fw(a)>b.x+1&&a.y<b.y+fd(b)-1&&a.y+fd(a)>b.y+1;
function collides(it){if(it.mount==="over"||it.mount==="arch"||it.ssType==="gantry")return false;return state.items.some(o=>o!==it&&o.mount===it.mount&&o.ssType!=="gantry"&&hit(it,o))||(it.kind!=="arch"&&!insideRoom(it))||blocksDoor(it);}
function baseUnder(it){const cx=it.x+fw(it)/2,cy=it.y+fd(it)/2;let best=null;
  for(const o of state.items){if(o.mount!=="floor"||o===it)continue;if(cx>=o.x&&cx<=o.x+fw(o)&&cy>=o.y&&cy<=o.y+fd(o)&&(!best||o.h>best.h))best=o;}return best;}
function zOf(it){if(it.mount==="floor"||it.mount==="arch")return 0;if(it.mount==="over")return it.z||1500;const b=baseUnder(it);return b?b.h:900;}
function clamp(it){const m=it.mount==="arch"?WALL_T+40:0;it.x=Math.max(-m,Math.min(state.room.w+m-fw(it),it.x));it.y=Math.max(-m,Math.min(state.room.d+m-fd(it),it.y));}
function findSpot(it){
  const R=state.room,W=fw(it),D=fd(it);
  const free=(x,y)=>{it.x=x;it.y=y;return !collides(it);};
  if(it.mount==="top"){
    for(const b of state.items){if(b.mount!=="floor"||b.h>1000||b.h<600)continue;
      for(let x=b.x;x+W<=b.x+fw(b)+1;x+=50){const y=b.y+Math.max(0,(fd(b)-D)/2);if(y+D<=R.d&&free(x,y))return true;}}
  }
  for(let y=0;y+D<=R.d;y+=250)for(let x=0;x+W<=R.w;x+=50)if(free(x,y))return true;
  it.x=Math.max(0,(R.w-W)/2);it.y=Math.max(0,(R.d-D)/2);return false;
}

/* ---------- colours (literal, so exports keep them) ---------- */
let C={};
function readColours(){const cs=getComputedStyle(document.documentElement);
  for(const k of ["ground","surface","sunk","ink","muted","line","steel","steel-fill","accent","accent-soft","dim","bad","top-fill","grid"])C[k]=cs.getPropertyValue("--"+k).trim();}

/* ---------- drawing ---------- */
let FS="Barlow,Arial,sans-serif", FM="'IBM Plex Mono',Menlo,monospace";
const eqList=()=>state.items.filter(i=>i.kind!=="arch");
function tagOf(it){return eqList().indexOf(it)+1;}
const tfOf=it=>{const W=fw(it),D=fd(it);return ["",`translate(${W} 0) rotate(90)`,`translate(${W} ${D}) rotate(180)`,`translate(0 ${D}) rotate(270)`][(it.rot/90)%4];};
function itemLabel(it){return it.kind==="ss"?it.name:(it.brand+" "+it.model);}

function planBounds(){const R=state.room,m=700;let x0=-m,y0=-m,x1=R.w+m,y1=R.d+m;if(under&&under.show){x0=Math.min(x0,under.x-200);y0=Math.min(y0,under.y-200);x1=Math.max(x1,under.x+under.pw*under.mmpp+200);y1=Math.max(y1,under.y+under.ph*under.mmpp+200);}return [x0,y0,x1-x0,y1-y0];}
function planSVG(upp,forExport,faint){
  const R=state.room,m=700,pdf=forExport==="pdf",VB=pdf?[-m,-m,R.w+2*m,R.d+2*m]:planBounds(); const f=11*upp,f2=9*upp,sw=1.2*upp;
  let s=`<defs><pattern id="g" width="500" height="500" patternUnits="userSpaceOnUse"><path d="M500 0H0V500" fill="none" stroke="${C.grid}" stroke-width="${upp*.8}"/></pattern></defs>`;
  if(pdf)s="";else s+=`<rect x="${VB[0]}" y="${VB[1]}" width="${VB[2]}" height="${VB[3]}" fill="${C.surface}"/>`;
  const RP=roomPoly(),pd="M"+RP.map(p=>p.join(" ")).join("L")+"Z",big=1e5;
  if(pdf){s+=`<path d="${pd}" fill="none" stroke="${C.ink}" stroke-width="${WALL_T*2}" stroke-linejoin="miter"/><path d="${pd}" fill="#FFFFFF" stroke="none"/>`;}
  else{
  s+=`<defs><clipPath id="outside"><path clip-rule="evenodd" d="M${-big} ${-big}H${big}V${big}H${-big}Z ${pd}"/></clipPath></defs>`;
  if(under&&under.show)s+=`<image href="${forExport?under.src:(under.url||under.src)}" x="${under.x}" y="${under.y}" width="${under.pw*under.mmpp}" height="${under.ph*under.mmpp}" opacity="${under.op}" preserveAspectRatio="none" style="pointer-events:none"/>`;
  s+=`<path d="${pd}" fill="url(#g)"/>`;
  s+=`<path d="${pd}" fill="none" stroke="${C.ink}" stroke-width="${WALL_T*2}" stroke-linejoin="miter" clip-path="url(#outside)" ${under&&under.show?`stroke-opacity=".8"`:""}/>`;
  }
  if(state.room.poly)for(let i=0;i<RP.length;i++){const p=RP[i],q=RP[(i+1)%RP.length],L=Math.hypot(q[0]-p[0],q[1]-p[1]);if(L<300)continue;const mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2,nx=-(q[1]-p[1])/L,ny=(q[0]-p[0])/L,sg=inPoly(mx+nx*60,my+ny*60,RP)?1:-1;
    let ang=Math.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI;if(ang>90||ang<=-90)ang+=180;s+=`<text transform="translate(${mx-nx*sg*250} ${my-ny*sg*250}) rotate(${ang})" text-anchor="middle" dominant-baseline="middle" font-family="${FM}" font-size="${f2}" fill="${C.dim}">${Math.round(L)}</text>`;}
  // room dimensions
  const dy=-380,dx=-380,t=90;
  s+=`<g stroke="${C.dim}" stroke-width="${sw}" fill="none"><path d="M0 ${dy}H${R.w}M0 ${dy-t}V${dy+t}M${R.w} ${dy-t}V${dy+t}M${dx} 0V${R.d}M${dx-t} 0H${dx+t}M${dx-t} ${R.d}H${dx+t}"/></g>`;
  s+=`<text x="${R.w/2}" y="${dy-70}" text-anchor="middle" font-family="${FM}" font-size="${f}" fill="${C.dim}">NORTH WALL  ${R.w}</text>`;
  s+=`<text transform="translate(${dx-70} ${R.d/2}) rotate(-90)" text-anchor="middle" font-family="${FM}" font-size="${f}" fill="${C.dim}">WEST WALL  ${R.d}</text>`;
  s+=`<text x="${R.w/2}" y="${R.d+m-220}" text-anchor="middle" font-family="${FM}" font-size="${f2}" fill="${C.muted}">SOUTH WALL</text>`;
  s+=`<text transform="translate(${R.w+m-220} ${R.d/2}) rotate(90)" text-anchor="middle" font-family="${FM}" font-size="${f2}" fill="${C.muted}">EAST WALL</text>`;
  const order={arch:-1,floor:0,top:1,over:2};
  const list=[...state.items].sort((a,b)=>(a.kind==="arch"?-1:order[a.mount])-(b.kind==="arch"?-1:order[b.mount]));
  for(const it of list){
    const W=fw(it),D=fd(it),bad=collides(it),on=!forExport&&sel===it.id,over=it.mount==="over";
    const fill=over?C.muted:it.mount==="top"?C["top-fill"]:it.kind==="ss"?C["steel-fill"]:C.surface;
    const stroke=faint?C.steel:bad&&!pdf?C.bad:on?C.accent:over?C.muted:C.ink;
    const tf=tfOf(it);
    s+=`<g class="it" data-id="${it.id}" transform="translate(${it.x} ${it.y})"><g transform="${tf}">`;
    if(it.kind==="arch"){const col=it.archType==="column";s+=`<rect width="${it.w}" height="${it.d}" fill="${col?C.muted:C.surface}" fill-opacity="${col?.55:.01}" stroke="${on?C.accent:col?C.ink:"none"}" stroke-width="${(on?2.6:1.5)*upp}"/>`+KS_planSym(it,upp,C,on?C.accent:C.ink)+`</g></g>`;continue;}
    s+=`<rect width="${it.w}" height="${it.d}" fill="${fill}" fill-opacity="${over?.06:1}" stroke="${stroke}" stroke-width="${(on||bad?2.6:1.5)*upp}" ${over?`stroke-dasharray="${6*upp} ${4*upp}"`:""}/>`;
    s+=(faint?"":KS_planSym(it,upp,C,over?C.muted:C.ink))+`</g>`;
    const tg=String(tagOf(it)),r=Math.min(8.5*upp,Math.max(5.5*upp,Math.min(W,D)*.3)),bx=over?W-r*1.3:(it.mount==="top"&&baseUnder(it)&&W>r*4.5)?W-r*1.5:W/2,by=over?r*1.3:D/2;
    s+=`<circle cx="${bx}" cy="${by}" r="${r}" fill="${on?C.accent:C.surface}" stroke="${stroke}" stroke-width="${upp}"/>`;
    s+=`<text x="${bx}" y="${by+r*.38}" text-anchor="middle" font-family="${FM}" font-size="${r*1.05}" font-weight="500" fill="${on?C.surface:C.ink}">${tg}</text>`;
    s+=`</g>`;
  }
  if(!forExport)s+=overlaySVG(upp);
  return {vb:VB,body:s};
}

function elevSVG(upp){
  const R=state.room,horiz=(wall==="N"||wall==="S"),L=horiz?R.w:R.d,H=R.h,m=600,f=11*upp,f2=9*upp;
  const near=it=>({N:it.y,S:R.d-it.y-fd(it),W:it.x,E:R.w-it.x-fw(it)})[wall]<=1200;
  const pos=it=>({N:it.x,S:R.w-it.x-fw(it),E:it.y,W:R.d-it.y-fd(it)})[wall];
  const wid=it=>horiz?fw(it):fd(it);
  let s=`<rect x="${-m}" y="${-H-500}" width="${L+2*m}" height="${H+500+800}" fill="${C.surface}"/>`;
  s+=`<rect x="0" y="${-H}" width="${L}" height="${H}" fill="${C.sunk}" fill-opacity=".45"/>`;
  s+=`<path d="M${-m/2} 0H${L+m/2}" stroke="${C.ink}" stroke-width="${2.5*upp}"/>`;
  s+=`<path d="M0 ${-H}H${L}" stroke="${C.ink}" stroke-width="${upp}" stroke-dasharray="${8*upp} ${5*upp}"/>`;
  s+=`<path d="M0 -900H${L}" stroke="${C.dim}" stroke-width="${upp*.8}" stroke-dasharray="${2*upp} ${5*upp}"/>`;
  s+=`<text x="${L+40}" y="${-900+f*.35}" font-family="${FM}" font-size="${f2}" fill="${C.dim}">900</text>`;
  s+=`<text x="${L+40}" y="${-H+f*.35}" font-family="${FM}" font-size="${f2}" fill="${C.muted}">${H}</text>`;
  s+=`<text x="0" y="${-H-180}" font-family="${FM}" font-size="${f}" fill="${C.dim}">${({N:"NORTH",S:"SOUTH",E:"EAST",W:"WEST"})[wall]} WALL ELEVATION  ${L}  ·  items within 1200 of the wall</text>`;
  const order={floor:0,top:1,over:2};
  const list=state.items.filter(i=>i.kind!=="arch"&&near(i)).sort((a,b)=>order[a.mount]-order[b.mount]);
  const facing={N:0,S:180,E:90,W:270}[wall];
  for(const it of list){
    const x=pos(it),W=wid(it),z=zOf(it),on=sel===it.id,stroke=on?C.accent:C.ink,swd=(on?2.6:1.5)*upp,front=it.rot===facing;
    const side=!front&&it.rot!==(facing+180)%360;
    s+=`<g class="it" data-id="${it.id}" transform="translate(${x} ${-z-it.h})">`+KS_elevSym(it,W,front||(it.kind==="ss"&&!side&&!["cab","wcab"].includes(it.ssType)),upp,C,stroke,swd);
    const r=7.5*upp,ty=it.h>r*2.6?Math.min(it.h/2,it.h-r*1.2):-r*1.3;
    s+=`<circle cx="${W/2}" cy="${ty}" r="${r}" fill="${on?C.accent:C.surface}" stroke="${stroke}" stroke-width="${upp}"/><text x="${W/2}" y="${ty+r*.38}" text-anchor="middle" font-family="${FM}" font-size="${r*1.05}" font-weight="500" fill="${on?C.surface:C.ink}">${tagOf(it)}</text></g>`;
    if(it.mount==="floor"&&W>f2*3)s+=`<text x="${x+W/2}" y="${f2*1.6}" text-anchor="middle" font-family="${FM}" font-size="${f2}" fill="${C.dim}">${W}</text>`;
    if(it.mount==="floor")s+=`<path d="M${x} ${20}v${f2*.9}M${x+W} ${20}v${f2*.9}" stroke="${C.dim}" stroke-width="${upp*.8}"/>`;
  }
  if(!list.length)s+=`<text x="${L/2}" y="${-H/2}" text-anchor="middle" font-family="${FS}" font-size="${f*1.2}" fill="${C.muted}">Nothing within 1200 mm of this wall yet</text>`;
  return {vb:[-m,-H-500,L+2*m,H+500+800],body:s};
}

function render(){
  readColours();
  const sheet=$("sheet"),svg=$("svg");
  svg.style.display=view==="3d"?"none":"block";if(view!=="3d")$("bar3d").hidden=true;$("v3d").hidden=view!=="3d";
  if(view==="3d"){
    if(!threeReady){threeReady=KS3D.init($("v3d"),$("cv3d"),id=>{sel=id;render();});if(threeReady){KS3D.bindJoy($("joy"),$("joyNub"));}}
    $("no3d").hidden=!!threeReady;$("cv3d").hidden=!threeReady;$("bar3d").hidden=!threeReady;
    if(threeReady){KS3D.rebuild(state,sel,C,zOf,KS_symOf,fw,fd);if(!orbitSet){KS3D.resetOrbit();orbitSet=true;KS3D.draw();}}
    renderStatus();renderSel();if(!$("p-sch").hidden)renderSchedule();return;
  }
  const R=state.room;
  const VB0=view==="plan"?planBounds():null,vbW=view==="plan"?VB0[2]:((wall==="N"||wall==="S")?R.w:R.d)+1200,vbH=view==="plan"?VB0[3]:R.h+1800;
  const pad=phone()?hudPad():0,sw=Math.max(240,(sheet.clientWidth||600)-16),sh=Math.max(200,(sheet.clientHeight||500)-16-pad);
  const px=Math.max(240,Math.min(sw,sh*vbW/vbH))*zoom, upp=vbW/px;
  const out=view==="plan"?planSVG(upp):elevSVG(upp);
  svg.setAttribute("viewBox",out.vb.join(" "));
  svg.setAttribute("width",px); svg.setAttribute("height",px*out.vb[3]/out.vb[2]);
  svg.innerHTML=out.body;
  renderStatus(); renderSel();
  if(!$("p-sch").hidden)renderSchedule();
}
function renderStatus(){
  const n=eqList().length,c=state.items.filter(collides).length;
  const fp=eqList().filter(i=>i.mount==="floor").reduce((a,i)=>a+i.w*i.d,0)/1e6, area=state.room.w*state.room.d/1e6;
  $("status").innerHTML=`<span><b>${n}</b> items</span><span><b>${area.toFixed(area<100?1:0)} m²</b>, ${area?Math.round(fp/area*100):0}% covered</span>`+
    (c?`<span class="bad">${c} clash${c>1?"es":""}</span>`:`<span>No clashes</span>`);
}
function renderSel(){
  const bar=$("selbar"),it=state.items.find(i=>i.id===sel);
  if(!it){bar.hidden=true;bar.innerHTML="";return;}
  bar.hidden=false;
  const ut=[it.power&&it.power!=="none"?it.power+(it.kw?` ${it.kw} kW`:""):null,it.elec,it.water?"water":null,it.drain?"drain":null].filter(Boolean).join(" · ");
  if(it.kind==="arch"){const wallish=/door|window/.test(it.archType);
    bar.innerHTML=`<div><span class="ttl">${esc(it.name)}</span></div><div class="meta">${wallish?"Snaps to the nearest wall as you drag it.":"Drag it into place."}</div>
    <div class="grid2"><div class="fld"><label for="selW">${it.archType==="column"?"Width":"Opening width"}</label><input id="selW" type="number" step="50" value="${it.w}" inputmode="numeric"></div>${it.archType==="column"?`<div class="fld"><label for="selD">Depth</label><input id="selD" type="number" step="50" value="${it.d}" inputmode="numeric"></div>`:""}</div>
    <div class="bar">${it.archType==="door"?`<button class="btn sm" data-act="flip">Flip swing</button>`:""}${wallish?"":`<button class="btn sm" data-act="rot">Rotate 90°</button>`}<button class="btn sm" data-act="dup">Duplicate</button><button class="btn sm danger" data-act="del">Remove</button></div>`;return;}
  let h=`<div><span class="tag">${tagOf(it)}</span><span class="ttl">${esc(itemLabel(it))}</span></div>`;
  h+=`<div class="meta">${it.w} × ${it.d} × ${it.h} H${it.mount!=="floor"?` · underside at ${zOf(it)}`:""} · ${it.x} from west wall, ${it.y} from north wall${ut?"<br>"+esc(ut):""}${collides(it)?`<br><span style="color:${C.bad}">${!insideRoom(it)?"Outside the room outline":blocksDoor(it)?"Blocks a door swing":`Overlaps another ${it.mount==="top"?"countertop":"floor"} item`}</span>`:""}</div>`;
  if(it.kind==="ss"){
    h+=`<div class="grid2"><div class="fld"><label for="selW">Width</label><input id="selW" type="number" step="50" value="${it.w}" inputmode="numeric"></div>
    <div class="fld"><label for="selD">Depth</label><input id="selD" type="number" step="50" value="${it.d}" inputmode="numeric"></div>
    <div class="fld"><label for="selH">Height</label><input id="selH" type="number" step="10" value="${it.h}" inputmode="numeric"></div>
    ${it.mount==="over"?`<div class="fld"><label for="selZ">Mounted at</label><input id="selZ" type="number" step="50" value="${it.z}" inputmode="numeric"></div>`:""}</div>`;
    if(it.opts?.length||it.mat)h+=`<div class="meta">${esc([it.mat,...(it.opts||[])].filter(Boolean).join(" · "))}</div>`;
  }else if(it.conf==="ai")h+=`<div class="meta" style="color:${C.dim}">AI-estimated dimensions. Check against the spec sheet.</div>`;
  h+=`<div class="bar"><button class="btn sm" data-act="rot">Rotate 90°</button><button class="btn sm" data-act="dup">Duplicate</button><button class="btn sm danger" data-act="del">Remove</button></div>`;
  bar.innerHTML=h;
}
$("selbar").addEventListener("click",e=>{
  const a=e.target.closest("[data-act]")?.dataset.act;if(!a)return;const it=state.items.find(i=>i.id===sel);if(!it)return;
  if(a==="flip"){it.flip=!it.flip;}
  if(a==="rot"){const cx=it.x+fw(it)/2,cy=it.y+fd(it)/2;it.rot=(it.rot+90)%360;it.x=Math.round((cx-fw(it)/2)/50)*50;it.y=Math.round((cy-fd(it)/2)/50)*50;clamp(it);}
  if(a==="dup"){const c=JSON.parse(JSON.stringify(it));c.id=newId();state.items.push(c);findSpot(c);sel=c.id;}
  if(a==="del"){state.items=state.items.filter(i=>i!==it);sel=null;}
  changed();
});
$("selbar").addEventListener("change",e=>{
  const it=state.items.find(i=>i.id===sel);if(!it||(it.kind!=="ss"&&it.kind!=="arch"))return;
  const v=Math.round(+e.target.value);if(!(v>0))return;
  if(e.target.id==="selW")it.w=Math.min(6000,Math.max(200,v));
  if(e.target.id==="selD")it.d=Math.min(3000,Math.max(150,v));
  if(e.target.id==="selH")it.h=Math.min(3000,Math.max(20,v));
  if(e.target.id==="selZ")it.z=Math.min(state.room.h,Math.max(0,v));
  if(it.kind==="arch"){it.w=Math.min(4000,Math.max(150,it.w));snapArch(it);}
  clamp(it);changed();
});

/* ---------- drag ---------- */
let drag=null,threeReady=false,orbitSet=false;
const svg=$("svg");
function toWorld(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
let tapStart=null;
svg.addEventListener("pointerdown",e=>{
  if(view==="plan"&&mode){const p=toWorld(e);
    if(mode==="moveplan"&&under){drag={plan:true,ox:p.x-under.x,oy:p.y-under.y,pid:e.pointerId,moved:false};try{svg.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();}
    else tapStart={x:e.clientX,y:e.clientY,pid:e.pointerId};return;}
  const g=e.target.closest(".it");
  if(!g){if(sel){sel=null;render();}return;}
  const it=state.items.find(i=>i.id===g.dataset.id);if(!it)return;
  if(view!=="plan"){if(sel!==it.id){sel=it.id;render();}return;}
  // keep the touched element in the page while the finger is down, or the browser drops the gesture
  const was=sel;sel=it.id;if(was!==sel){renderSel();const r=g.querySelector("rect");if(r){r.setAttribute("stroke",C.accent);r.setAttribute("stroke-width",r.getAttribute("stroke-width")*1.8);}}
  const p=toWorld(e);drag={it,ox:p.x-it.x,oy:p.y-it.y,moved:false,pid:e.pointerId};
  try{g.setPointerCapture(e.pointerId);}catch(_){}
  e.preventDefault();
});
// stop the page or the drawing from scrolling while an item is under the finger
svg.addEventListener("touchstart",e=>{if(view==="plan"&&e.target.closest&&e.target.closest(".it"))e.preventDefault();},{passive:false});
svg.addEventListener("touchmove",e=>{if(drag)e.preventDefault();},{passive:false});
svg.addEventListener("pointermove",e=>{
  if(!drag||e.pointerId!==drag.pid)return;
  if(drag.plan){const q=toWorld(e);under.x=Math.round(q.x-drag.ox);under.y=Math.round(q.y-drag.oy);drag.moved=true;const im=svg.querySelector("image");if(im){im.setAttribute("x",under.x);im.setAttribute("y",under.y);}return;}
  const it=drag.it,p=toWorld(e);
  let x=Math.round((p.x-drag.ox)/50)*50,y=Math.round((p.y-drag.oy)/50)*50;
  const W=fw(it),D=fd(it),T=70;
  for(const o of state.items){if(o===it||o.mount!==it.mount)continue;
    const oy0=o.y,oy1=o.y+fd(o),ox0=o.x,ox1=o.x+fw(o);
    if(y<oy1+T&&y+D>oy0-T){if(Math.abs(x-ox1)<T)x=ox1;else if(Math.abs(x+W-ox0)<T)x=ox0-W;}
    if(x<ox1+T&&x+W>ox0-T){if(Math.abs(y-oy1)<T)y=oy1;else if(Math.abs(y+D-oy0)<T)y=oy0-D;else if(Math.abs(y-oy0)<T)y=oy0;}
  }
  [x,y]=snapToWalls(it,x,y);it.x=x;it.y=y;if(it.kind==="arch")snapArch(it);clamp(it);drag.moved=true;
  const g=svg.querySelector(`.it[data-id="${it.id}"]`);if(g){g.setAttribute("transform",`translate(${it.x} ${it.y})`);if(g.firstElementChild)g.firstElementChild.setAttribute("transform",tfOf(it));}
});
function endDrag(e){if(!drag||(e&&e.pointerId!==drag.pid))return;const m=drag.moved;drag=null;if(m)changed();else render();}
svg.addEventListener("pointerup",e=>{if(tapStart&&tapStart.pid===e.pointerId){const t=tapStart;tapStart=null;if(Math.hypot(e.clientX-t.x,e.clientY-t.y)<12)planTap(toWorld(e));return;}endDrag(e);});svg.addEventListener("pointercancel",endDrag);

/* ---------- add ---------- */
function place(spec){
  const it=Object.assign({id:newId(),x:0,y:0,rot:0,kind:"eq"},JSON.parse(JSON.stringify(spec)));
  if(isExample&&!dirty){/* keep example; user is building on it */}
  state.items.push(it);const ok=findSpot(it);sel=it.id;
  if(view==="elev")setView("plan");
  changed();
  toast(ok?`Added ${itemLabel(it)}. Drag it into place.`:`Added ${itemLabel(it)}, but the room is full. It overlaps for now.`);
  revealCanvas();
}

/* ---------- catalogue ---------- */
function all(){return [...custom,...BASE];}
function renderChips(){
  $("catChips").innerHTML=["All",...CATS,"My models"].map(c=>`<button class="chip-t" aria-pressed="${c===cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}
$("catChips").addEventListener("click",e=>{const c=e.target.closest("[data-cat]");if(!c)return;cat=c.dataset.cat;renderChips();renderResults();});
function matches(){
  const toks=$("q").value.toLowerCase().split(/\s+/).filter(Boolean);
  return all().filter(e=>{
    if(cat==="My models"?e.conf==="verified":(cat!=="All"&&e.cat!==cat))return false;
    if($("hideUS").checked&&/US spec|115V|120V|208/i.test((e.name||"")+" "+(e.elec||"")))return false;
    const hay=(e.brand+" "+e.model+" "+e.cat+" "+e.name).toLowerCase();return toks.every(t=>hay.includes(t));});
}
let shown=[];
function renderResults(){
  shown=matches();const q=$("q").value.trim();
  if(!shown.length){$("results").innerHTML=`<div class="empty"><div>No model matches${q?` “${esc(q)}”`:""}.</div><button class="btn" id="goNew">Add ${q?`“${esc(q)}”`:"it"} as a new model</button></div>`;return;}
  const total=shown.length;shown=shown.slice(0,60);
  $("results").innerHTML=`<div class="ut" style="padding:6px 2px">${total} model${total===1?"":"s"}${total>60?", showing the first 60. Type to narrow it down.":""}</div>`+shown.map((e,k)=>{
    const pill=e.conf==="verified"?`<a class="pill ok" href="${esc(e.src)}" target="_blank" rel="noopener">spec source ↗</a>`:e.conf==="ai"?`<span class="pill warn">AI estimate</span>`:`<span class="pill me">your entry</span>`;
    const ut=[e.power&&e.power!=="none"?e.power+(e.kw?` ${e.kw} kW`:""):null,e.water?"water":null,e.drain?"drain":null,e.mount==="top"?"countertop":null].filter(Boolean).join(" · ");
    return `<div class="row"><div><div class="bm"><span>${esc(e.brand)}</span>${esc(e.model)}</div><div class="nm">${esc(e.name)}</div>
      <div class="dm"><span>${e.w} × ${e.d} × ${e.h}</span>${pill}<span class="ut">${esc(ut)}</span></div></div>
      <div class="acts"><button class="addbtn" data-add="${k}" aria-label="Add ${esc(e.brand)} ${esc(e.model)}">+</button>${e.conf!=="verified"?`<button class="btn sm danger" data-rm="${k}">Delete</button>`:""}</div></div>`;}).join("");
}
$("q").addEventListener("input",renderResults);$("hideUS").addEventListener("change",renderResults);
$("results").addEventListener("click",e=>{
  if(e.target.id==="goNew"){const q=$("q").value.trim().split(/\s+/);$("nBrand").value=q[0]||"";$("nModel").value=q.slice(1).join(" ");setTab("new");return;}
  const a=e.target.closest("[data-add]"),r=e.target.closest("[data-rm]");
  if(a)place(shown[+a.dataset.add]);
  if(r){const c=shown[+r.dataset.rm];custom=custom.filter(x=>x!==c);saveCustomLocal();if(c.cid)remoteEq.del(c.cid);renderResults();toast("Removed from your catalogue.");}
});

/* ---------- stainless ---------- */
function ssInit(){
  $("ssType").innerHTML=Object.entries(SS).map(([k,v])=>`<option value="${k}">${esc(v.n)}</option>`).join("");
  $("ssWChips").innerHTML=STD_W.map(v=>`<button class="chip-t" data-v="${v}">${v}</button>`).join("");
  $("ssDChips").innerHTML=STD_D.map(v=>`<button class="chip-t" data-v="${v}">${v}</button>`).join("");
  ssLoad();
}
function ssLoad(){const t=SS[$("ssType").value];$("ssW").value=t.w;$("ssD").value=t.d;$("ssH").value=t.h;$("ssZ").value=t.z||"";$("ssZf").hidden=t.mount!=="over";
  ssOptsSel=new Set();$("ssOpts").innerHTML=t.opts.map((o,k)=>`<label><input type="checkbox" id="ssOpt${k}" data-o="${esc(o)}"> ${esc(o)}</label>`).join("");$("ssDesc").textContent=t.desc;}
$("ssType").addEventListener("change",ssLoad);
$("ssWChips").addEventListener("click",e=>{const v=e.target.dataset.v;if(v)$("ssW").value=v;});
$("ssDChips").addEventListener("click",e=>{const v=e.target.dataset.v;if(v)$("ssD").value=v;});
$("ssAdd").addEventListener("click",()=>{
  const k=$("ssType").value,t=SS[k];const w=Math.round(+$("ssW").value),d=Math.round(+$("ssD").value),h=Math.round(+$("ssH").value);
  if(!(w>=200&&w<=6000&&d>=150&&d<=3000&&h>=20&&h<=3000)){toast("Check the sizes: width 200-6000, depth 150-3000, height 20-3000.");return;}
  const opts=[...$("ssOpts").querySelectorAll("input:checked")].map(i=>i.dataset.o);
  place({kind:"ss",ssType:k,brand:"Fabricated",model:t.n,name:t.n,cat:"Stainless",w,d,h,mount:t.mount,z:t.mount==="over"?Math.round(+$("ssZ").value)||t.z:undefined,
    power:"none",kw:null,elec:null,water:!!t.water||opts.includes("Pre-rinse sink"),drain:!!t.drain||opts.includes("Pre-rinse sink"),opts,mat:$("ssMat").value,conf:"user"});
});

/* ---------- new model ---------- */
$("nCat").innerHTML=CATS.map(c=>`<option>${esc(c)}</option>`).join("");
let lastConf="user";
$("nLookup").addEventListener("click",async()=>{
  const brand=$("nBrand").value.trim(),model=$("nModel").value.trim(),msg=$("nMsg");
  if(!brand||!model){msg.textContent="Enter both a brand and a model first.";return;}
  if(be&&!be.user()){openSignIn("Sign in to look up a model with AI.");return;}
  if(!sampleFn){msg.textContent="Claude lookup isn't available in this view. Type the dimensions from the spec sheet instead.";return;}
  const btn=$("nLookup");btn.disabled=true;msg.className="note";msg.textContent="Asking Claude about "+brand+" "+model+"…";
  const prompt=`You are helping a commercial kitchen designer. Give the external dimensions and utility connections of this commercial kitchen equipment model from the manufacturer's published specification, as best you recall it.
Brand: ${brand}
Model: ${model}
Reply with ONLY a JSON object with these keys:
{"found": boolean, "brand": string, "model": string, "name": short description under 70 chars, "category": one of ${JSON.stringify(CATS)}, "w": external width mm integer, "d": external depth mm integer, "h": external height mm integer, "mount": "floor" or "top" (top = sits on a counter or stand), "power": "electric"|"gas"|"charcoal"|"none", "kw": connected load in kW or null, "electrical": e.g. "400V 3N 50Hz" or null, "water": boolean, "drain": boolean, "confidence": "high"|"medium"|"low", "note": one short sentence on what to double-check}
Rules: if you do not recognise this exact model or cannot recall its dimensions with reasonable confidence, set "found": false and explain in "note". Never invent dimensions. Use millimetres.`;
  try{
    const r=await sampleFn.json(prompt,{modelTier:"default"});
    const okNum=v=>Number.isFinite(+v)&&+v>=20&&+v<=8000;
    if(!r||!r.found||!okNum(r.w)||!okNum(r.d)||!okNum(r.h)){msg.className="note warnbox";msg.textContent="Claude couldn't recall reliable dimensions for this model"+(r&&r.note?": "+r.note:".")+" Enter them from the spec sheet below.";lastConf="user";}
    else{$("nName").value=r.name||"";$("nW").value=Math.round(r.w);$("nD").value=Math.round(r.d);$("nH").value=Math.round(r.h);$("nKw").value=r.kw??"";
      if(CATS.includes(r.category))$("nCat").value=r.category;$("nMount").value=r.mount==="top"?"top":"floor";
      if(["electric","gas","charcoal","none"].includes(r.power))$("nPower").value=r.power;$("nElec").value=r.electrical||"";$("nWater").checked=!!r.water;$("nDrain").checked=!!r.drain;
      if(r.brand)$("nBrand").value=r.brand;if(r.model)$("nModel").value=r.model;
      lastConf="ai";msg.className="note warnbox";msg.textContent=`Filled from Claude's memory (${r.confidence||"unknown"} confidence), not from a live spec sheet. ${r.note||""} Check the numbers, correct anything, then save.`;}
  }catch(err){msg.className="note warnbox";msg.textContent=err&&err.code==="rate_limited"?"Claude is rate limited right now. Try again in a minute, or enter the dimensions yourself.":err&&err.code==="not_granted"?"Claude lookup wasn't allowed. Enter the dimensions yourself.":"The lookup didn't work. Enter the dimensions from the spec sheet.";}
  btn.disabled=false;
});
["nW","nD","nH"].forEach(id=>$(id).addEventListener("input",()=>{if(lastConf==="ai")lastConf="user-edited";}));
function readNew(){
  const brand=$("nBrand").value.trim(),model=$("nModel").value.trim(),w=Math.round(+$("nW").value),d=Math.round(+$("nD").value),h=Math.round(+$("nH").value);
  if(!brand||!model){toast("Brand and model are required.");return null;}
  if(!(w>=50&&d>=50&&h>=20)){toast("Enter width, depth and height in millimetres.");return null;}
  return {brand,model,cat:$("nCat").value,name:$("nName").value.trim()||"Custom model",w,d,h,mount:$("nMount").value,power:$("nPower").value,kw:$("nKw").value===""?null:+$("nKw").value,
    elec:$("nElec").value.trim()||null,water:$("nWater").checked,drain:$("nDrain").checked,src:null,conf:lastConf==="ai"?"ai":"user",cid:"c"+Date.now().toString(36)};
}
function saveNew(add){
  const e=readNew();if(!e)return;
  custom=custom.filter(c=>!(c.brand.toLowerCase()===e.brand.toLowerCase()&&c.model.toLowerCase()===e.model.toLowerCase()));
  custom.unshift(e);saveCustomLocal();
  remoteEq.set(e);
  ["nBrand","nModel","nName","nW","nD","nH","nKw","nElec"].forEach(id=>$(id).value="");$("nWater").checked=$("nDrain").checked=false;$("nMsg").textContent="";lastConf="user";
  if(add)place(e);else{toast("Saved. Find it under Equipment → My models.");}
  cat="My models";renderChips();renderResults();
}
$("nSave").addEventListener("click",()=>saveNew(true));
$("nSaveOnly").addEventListener("click",()=>saveNew(false));

/* ---------- schedule ---------- */
function groups(kind){
  const m=new Map();
  eqList().forEach((it,k)=>{if((it.kind==="ss")!==(kind==="ss"))return;
    const key=[it.brand,it.model,it.w,it.d,it.h,(it.opts||[]).join("|"),it.mat||""].join("~");
    if(!m.has(key))m.set(key,{it,tags:[]});m.get(key).tags.push(k+1);});
  return [...m.values()];
}
function renderSchedule(){
  const eq=groups("eq"),ss=groups("ss");
  let el=0,gas=0,wat=0,dr=0,unk=0;
  eqList().forEach(i=>{if(i.power==="electric"){if(i.kw)el+=i.kw;else unk++;}if(i.power==="gas"&&i.kw)gas+=i.kw;if(i.water)wat++;if(i.drain)dr++;});
  $("totals").innerHTML=`<div><span class="lbl">Electrical load</span><b>${el.toFixed(1)} kW</b>${unk?`<span class="ut">${unk} item${unk>1?"s":""} without a listed load</span>`:""}</div><div><span class="lbl">Gas load</span><b>${gas.toFixed(1)} kW</b></div><div><span class="lbl">Water points</span><b>${wat}</b></div><div><span class="lbl">Drain points</span><b>${dr}</b></div>`;
  $("schEq").innerHTML=eq.length?`<table><thead><tr><th>No.</th><th>Qty</th><th>Brand / model</th><th>W × D × H</th><th>Energy</th><th>Electrical</th><th>W / D</th><th>Data</th></tr></thead><tbody>${eq.map(g=>{const i=g.it;return `<tr><td class="n">${g.tags.join(", ")}</td><td class="n">${g.tags.length}</td><td class="w"><b>${esc(i.brand)}</b> ${esc(i.model)}<br><span class="ut">${esc(i.name)}</span></td><td class="n">${i.w} × ${i.d} × ${i.h}</td><td>${esc(i.power||"")}${i.kw?" "+i.kw+" kW":""}</td><td>${esc(i.elec||"–")}</td><td>${i.water?"W":"–"} / ${i.drain?"D":"–"}</td><td>${i.conf==="verified"?`<a class="pill ok" href="${esc(i.src)}" target="_blank" rel="noopener">source ↗</a>`:i.conf==="ai"?`<span class="pill warn">AI estimate</span>`:`<span class="pill me">your entry</span>`}</td></tr>`;}).join("")}</tbody></table>`:`<div class="empty">No equipment placed yet.</div>`;
  $("schSs").innerHTML=ss.length?`<table><thead><tr><th>No.</th><th>Qty</th><th>Module</th><th>W × D × H</th><th>Material</th><th>Options</th></tr></thead><tbody>${ss.map(g=>{const i=g.it;return `<tr><td class="n">${g.tags.join(", ")}</td><td class="n">${g.tags.length}</td><td class="w"><b>${esc(i.name)}</b>${i.mount==="over"?`<br><span class="ut">underside at ${i.z}</span>`:""}</td><td class="n">${i.w} × ${i.d} × ${i.h}</td><td>${esc(i.mat||"")}</td><td class="w">${esc((i.opts||[]).join(", ")||"–")}</td></tr>`;}).join("")}</tbody></table>`:`<div class="empty">No stainless modules placed yet.</div>`;
}
function csv(){
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const rows=[["Type","Item no.","Qty","Brand","Model / module","Description","Width mm","Depth mm","Height mm","Energy","kW","Electrical","Water","Drain","Material","Options","Data source"]];
  for(const k of ["eq","ss"])for(const g of groups(k)){const i=g.it;rows.push([k==="eq"?"Equipment":"Stainless",g.tags.join(" "),g.tags.length,i.brand,i.model,i.name,i.w,i.d,i.h,i.power,i.kw??"",i.elec??"",i.water?"yes":"",i.drain?"yes":"",i.mat??"",(i.opts||[]).join("; "),i.conf==="verified"?i.src:i.conf==="ai"?"AI estimate - verify":"User entry"]);}
  return "﻿"+rows.map(r=>r.map(q).join(",")).join("\r\n");
}
async function save(filename,data){
  if(downloads){try{await downloads.save({filename,data});toast("Exported "+filename);}catch(e){if(e&&e.code!=="declined")toast("Export didn't go through. Try again.");}return;}
  try{const url=URL.createObjectURL(new Blob([data],{type:"application/octet-stream"}));const l=document.createElement("a");l.href=url;l.download=filename;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast("Downloaded "+filename);}
  catch(_){toast("This browser blocked the download.");}
}
$("projSave").addEventListener("click",()=>save("kitchen-project.json",JSON.stringify({v:1,room:state.room,items:state.items,under:underData(),custom,at:Date.now()},null,1)));
$("projOpen").addEventListener("click",()=>$("projFile").click());
$("projFile").addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
  try{const p=JSON.parse(await f.text());if(!adopt(p)){toast("That file isn't a Kitchen Studio project.");return;}
    if(Array.isArray(p.custom)){const seen=new Set(custom.map(c=>c.cid));for(const c of p.custom)if(c&&c.brand&&c.w>0&&!seen.has(c.cid))custom.push(c);saveCustomLocal();renderResults();}
    changed();toast("Project opened.");}catch(_){toast("Couldn't read that file.");}});
$("expCsv").addEventListener("click",()=>save("kitchen-schedule.csv",csv()));
$("expSvg").addEventListener("click",()=>{readColours();const o=planSVG(planBounds()[2]/1400,true);
  save("kitchen-plan.svg",`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${o.vb.join(" ")}" width="1400" height="${Math.round(1400*o.vb[3]/o.vb[2])}">${o.body}</svg>`);});

/* ---------- floor plan: underlay image, scale, traced walls, openings ---------- */
let under=null;          /* {src,pw,ph,mmpp,x,y,op,show} : pw/ph in pixels, x/y top-left in mm */
let mode=null;           /* null | "cal" | "trace" | "moveplan" */
let calPts=[],tracePts=[],hover=null;
const WALL_T=120;
const ARCH={door:{n:"Door, single",w:900,d:WALL_T},door2:{n:"Door, double",w:1600,d:WALL_T},window:{n:"Window",w:1500,d:WALL_T},column:{n:"Column",w:400,d:400},drain:{n:"Floor drain",w:250,d:250},gas:{n:"Gas point",w:220,d:220},water:{n:"Water point",w:220,d:220},power:{n:"Electrical panel",w:220,d:220}};
function inPoly(x,y,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function roomPoly(){const R=state.room;return R.poly&&R.poly.length>2?R.poly:[[0,0],[R.w,0],[R.w,R.d],[0,R.d]];}
function insideRoom(it){const P=state.room.poly;if(!P||P.length<3)return true;const e=8,x0=it.x+e,y0=it.y+e,x1=it.x+fw(it)-e,y1=it.y+fd(it)-e;
  return inPoly(x0,y0,P)&&inPoly(x1,y0,P)&&inPoly(x0,y1,P)&&inPoly(x1,y1,P)&&inPoly((x0+x1)/2,(y0+y1)/2,P);}
function roomBudget(){const P=roomPoly(),segs=wallSegs();let area=0;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];area+=a[0]*b[1]-b[0]*a[1];}area=Math.abs(area)/2e6;
  const doors=state.items.filter(i=>i.kind==="arch"&&/^door/.test(i.archType));
  let wall=segs.reduce((s,g)=>s+(g.b-g.a),0)-doors.reduce((s,d)=>s+d.w+600,0)-P.length*700;wall=Math.max(2000,Math.round(wall*.9/100)*100);
  const foot=Math.round(area*.38*10)/10,poly=state.room.poly&&state.room.poly.length>4;
  return {area:Math.round(area*10)/10,wall,foot,doors:doors.length,shape:poly?`traced ${P.length}-sided room (not a plain rectangle, so some wall run is in corners you can't use)`:"rectangular room",
    size:area<20?"tiny: a handful of items only":area<35?"small: one short cooking line, one prep table, one sink, one fridge":area<60?"medium":"large"};}
function doorZone(a){const W=fw(a),D=fd(a),l=a.archType==="door2"?a.w/2:a.w;return a.rot===0?[a.x,a.y+D,a.x+W,a.y+D+l]:a.rot===180?[a.x,a.y-l,a.x+W,a.y]:a.rot===270?[a.x+W,a.y,a.x+W+l,a.y+D]:[a.x-l,a.y,a.x,a.y+D];}
function blocksDoor(it){if(it.kind==="arch"||it.mount!=="floor")return false;const r=[it.x,it.y,it.x+fw(it),it.y+fd(it)];
  return state.items.some(a=>a.kind==="arch"&&/^door/.test(a.archType)&&(z=>r[0]<z[2]-1&&r[2]>z[0]+1&&r[1]<z[3]-1&&r[3]>z[1]+1)(doorZone(a)));}
function wallSegs(){const P=roomPoly(),out=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];if(Math.abs(a[1]-b[1])<1)out.push({h:1,c:a[1],a:Math.min(a[0],b[0]),b:Math.max(a[0],b[0])});else if(Math.abs(a[0]-b[0])<1)out.push({h:0,c:a[0],a:Math.min(a[1],b[1]),b:Math.max(a[1],b[1])});}return out;}
function snapArch(it){
  if(!/^(door|door2|window)$/.test(it.archType))return;const P=roomPoly(),cx=it.x+fw(it)/2,cy=it.y+fd(it)/2;let best=null;
  for(const s of wallSegs()){const along=s.h?cx:cy,dist=Math.abs((s.h?cy:cx)-s.c);if(along<s.a-200||along>s.b+200||dist>900)continue;if(!best||dist<best.dist)best={s,dist};}
  if(!best)return;const s=best.s,half=it.w/2;
  if(s.h){const c=Math.max(s.a+half,Math.min(s.b-half,cx)),inward=inPoly(c,s.c+60,P);it.rot=inward?0:180;it.x=Math.round((c-half)/10)*10;it.y=inward?s.c-it.d:s.c;}
  else{const c=Math.max(s.a+half,Math.min(s.b-half,cy)),inward=inPoly(s.c+60,c,P);it.rot=inward?270:90;it.y=Math.round((c-half)/10)*10;it.x=inward?s.c-it.d:s.c;}
}
function snapToWalls(it,x,y){const P=state.room.poly;if(!P||it.kind==="arch")return [x,y];const W=fw(it),D=fd(it),T=90;
  for(const s of wallSegs()){if(s.h){if(x<s.b&&x+W>s.a){if(Math.abs(y-s.c)<T)y=s.c;else if(Math.abs(y+D-s.c)<T)y=s.c-D;}}else if(y<s.b&&y+D>s.a){if(Math.abs(x-s.c)<T)x=s.c;else if(Math.abs(x+W-s.c)<T)x=s.c-W;}}
  return [x,y];}

/* drawing layers used by planSVG */
function underSVG(){if(!under||!under.show)return "";return `<image href="${under.src}" x="${under.x}" y="${under.y}" width="${under.pw*under.mmpp}" height="${under.ph*under.mmpp}" opacity="${under.op}" preserveAspectRatio="none" style="pointer-events:none"/>`;}
function overlaySVG(upp){let s="";const r=5*upp,f=11*upp;
  if(mode==="cal"){calPts.forEach((p,i)=>{s+=`<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="${C.dim}"/><text x="${p[0]+r*1.6}" y="${p[1]-r}" font-family="${FM}" font-size="${f}" fill="${C.dim}">${i?"B":"A"}</text>`;});
    if(calPts.length===2)s+=`<path d="M${calPts[0][0]} ${calPts[0][1]}L${calPts[1][0]} ${calPts[1][1]}" stroke="${C.dim}" stroke-width="${1.6*upp}" stroke-dasharray="${6*upp} ${4*upp}"/>`;}
  if(mode==="trace"&&tracePts.length){const pts=tracePts.map(p=>p.join(" ")).join("L");s+=`<path d="M${pts}${hover?`L${hover[0]} ${hover[1]}`:""}" fill="none" stroke="${C.accent}" stroke-width="${2.4*upp}"/>`;
    tracePts.forEach((p,i)=>{s+=`<circle cx="${p[0]}" cy="${p[1]}" r="${i?r:r*1.7}" fill="${i?C.accent:C.surface}" stroke="${C.accent}" stroke-width="${2*upp}"/>`;});
    for(let i=1;i<tracePts.length;i++){const a=tracePts[i-1],b=tracePts[i];s+=`<text x="${(a[0]+b[0])/2}" y="${(a[1]+b[1])/2-r*1.4}" text-anchor="middle" font-family="${FM}" font-size="${f}" fill="${C.accent}">${Math.round(Math.hypot(b[0]-a[0],b[1]-a[1]))}</text>`;}}
  return s;}

/* upload */
function loadScript(id,url){if(window.KS_LIBS&&window.KS_LIBS[id])url=window.KS_LIBS[id];return new Promise((res,rej)=>{const inl=document.getElementById(id);const s=document.createElement("script");if(inl){s.textContent=inl.textContent;document.head.appendChild(s);res();}else{s.src=url;s.onload=res;s.onerror=()=>rej(new Error("load"));document.head.appendChild(s);}});}
async function pdfToCanvas(file){
  if(typeof pdfjsLib==="undefined"){await loadScript("pdfjs-src","https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js");await loadScript("pdfjs-worker-src","https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js");}
  const doc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,page=await doc.getPage(1);let vp=page.getViewport({scale:1});vp=page.getViewport({scale:Math.min(3,1800/Math.max(vp.width,vp.height))});
  const cv=document.createElement("canvas");cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);await page.render({canvasContext:cx,viewport:vp}).promise;return cv;}
function imgToCanvas(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{const k=Math.min(1,1800/Math.max(im.naturalWidth,im.naturalHeight)),cv=document.createElement("canvas");cv.width=Math.round(im.naturalWidth*k);cv.height=Math.round(im.naturalHeight*k);const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(im,0,0,cv.width,cv.height);URL.revokeObjectURL(u);res(cv);};im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error("img"));};im.src=u;});}
$("fpFile").addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;$("fpMsg").textContent="Reading "+f.name+"…";
  try{const pdf=/pdf$/i.test(f.type)||/\.pdf$/i.test(f.name),cv=pdf?await pdfToCanvas(f):await imgToCanvas(f);
    const src=cv.toDataURL("image/jpeg",.72),mmpp=state.room.w/cv.width;under={src,pw:cv.width,ph:cv.height,mmpp,x:0,y:0,op:.55,show:true};blobUrl(under);calPts=[];
    $("fpMsg").textContent=`Loaded ${f.name}${pdf?" (page 1)":""}. Next: set the scale.`;if(view!=="plan")setView("plan");fpUI();changed();}
  catch(err){$("fpMsg").textContent="That file couldn't be read. Use a JPG, PNG or PDF"+(/load/.test(String(err&&err.message))?" (PDF needs an internet connection the first time).":".");}});
$("fpPick").addEventListener("click",()=>$("fpFile").click());
$("fpOp").addEventListener("input",e=>{if(under){under.op=+e.target.value;render();}});
$("fpOp").addEventListener("change",()=>{if(under)changed();});
$("fpShow").addEventListener("change",e=>{if(under){under.show=e.target.checked;changed();}});
$("fpRemove").addEventListener("click",()=>{under=null;setMode(null);fpUI();changed();});
function setMode(m){mode=m;calPts=[];tracePts=[];hover=null;svg.style.touchAction=m==="moveplan"?"none":"";svg.style.cursor=m==="cal"||m==="trace"?"crosshair":m==="moveplan"?"move":"";fpUI();render();}
function fpUI(){
  const has=!!under;$("fpTools").hidden=!has;$("fpShow").checked=!!(under&&under.show);if(under)$("fpOp").value=under.op;
  $("fpScaleNow").textContent=has?`Plan image is ${Math.round(under.pw*under.mmpp)} × ${Math.round(under.ph*under.mmpp)} mm at the current scale.`:"";
  $("calBtn").textContent=mode==="cal"?"Cancel":"Set scale";$("calBox").hidden=!(mode==="cal"&&calPts.length===2);
  $("calHint").textContent=mode==="cal"?(calPts.length<2?`Tap point ${calPts.length?"B":"A"} on the drawing: the two ends of a wall or dimension you know.`:"Enter the real distance between A and B."):"";
  $("moveBtn").setAttribute("aria-pressed",mode==="moveplan");$("moveBtn").textContent=mode==="moveplan"?"Done moving":"Move plan image";
  $("traceBtn").textContent=mode==="trace"?"Cancel":"Trace the walls";$("traceUndo").hidden=$("traceDone").hidden=mode!=="trace";$("traceDone").disabled=tracePts.length<3;
  $("traceHint").textContent=mode==="trace"?(tracePts.length?`${tracePts.length} corner${tracePts.length>1?"s":""}. Tap the next inside corner, or Finish to close the room.`:"Tap each inside corner of the room in order, going around the walls."):"";
  const traced=!!(state.room.poly&&state.room.poly.length>2);$("rectBtn").hidden=!traced;$("roomW").disabled=$("roomD").disabled=traced;
}
$("calBtn").addEventListener("click",()=>{if(view!=="plan")setView("plan");setMode(mode==="cal"?null:"cal");});
$("moveBtn").addEventListener("click",()=>{if(view!=="plan")setView("plan");setMode(mode==="moveplan"?null:"moveplan");});
$("calApply").addEventListener("click",()=>{const real=+$("calDist").value,a=calPts[0],b=calPts[1],cur=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!(real>=100)||cur<1){toast("Enter the real distance in millimetres (at least 100).");return;}
  const k=real/cur;under.x=a[0]-(a[0]-under.x)*k;under.y=a[1]-(a[1]-under.y)*k;under.mmpp*=k;$("calDist").value="";setMode(null);changed();toast("Scale set. Now trace the walls.");});
$("traceBtn").addEventListener("click",()=>{if(view!=="plan")setView("plan");setMode(mode==="trace"?null:"trace");});
$("traceUndo").addEventListener("click",()=>{tracePts.pop();fpUI();render();});
$("traceDone").addEventListener("click",finishTrace);
$("rectBtn").addEventListener("click",()=>{delete state.room.poly;fpUI();changed();});
function finishTrace(){
  if(tracePts.length<3)return;let P=tracePts.map(p=>[p[0],p[1]]);
  if($("traceOrtho").checked){const f=P[0],l=P[P.length-1];if(Math.abs(l[0]-f[0])<Math.abs(l[1]-f[1])){if(Math.abs(l[0]-f[0])<400)l[0]=f[0];}else if(Math.abs(l[1]-f[1])<400)l[1]=f[1];}
  const minX=Math.min(...P.map(p=>p[0])),minY=Math.min(...P.map(p=>p[1]));P=P.map(p=>[Math.round(p[0]-minX),Math.round(p[1]-minY)]);
  const w=Math.max(...P.map(p=>p[0])),d=Math.max(...P.map(p=>p[1]));if(w<1500||d<1500){toast("That room is under 1.5 m across. Check the scale first.");return;}
  state.room.w=w;state.room.d=d;state.room.poly=P;if(under){under.x-=minX;under.y-=minY;}for(const it of state.items){it.x-=minX;it.y-=minY;clamp(it);}
  roomInputs();setMode(null);changed();toast(`Room traced: ${w} × ${d} mm overall.`);
}
function planTap(p){
  if(mode==="cal"){if(calPts.length>=2)calPts=[];calPts.push([Math.round(p.x),Math.round(p.y)]);fpUI();render();return true;}
  if(mode==="trace"){let x=Math.round(p.x/10)*10,y=Math.round(p.y/10)*10;const n=tracePts.length;
    if(n>=3&&Math.hypot(x-tracePts[0][0],y-tracePts[0][1])<Math.max(250,state.room.w/40)){finishTrace();return true;}
    if(n&&$("traceOrtho").checked){const q=tracePts[n-1],dx=Math.abs(x-q[0]),dy=Math.abs(y-q[1]);if(dx<dy*.25)x=q[0];else if(dy<dx*.25)y=q[1];}
    tracePts.push([x,y]);fpUI();render();return true;}
  return false;
}
/* openings */
$("archType").innerHTML=Object.entries(ARCH).map(([k,v])=>`<option value="${k}">${esc(v.n)}</option>`).join("");
$("archType").addEventListener("change",()=>{$("archW").value=ARCH[$("archType").value].w;});
$("archAdd").addEventListener("click",()=>{const k=$("archType").value,t=ARCH[k],w=Math.min(4000,Math.max(150,Math.round(+$("archW").value)||t.w)),wallish=/door|window/.test(k);
  const it={id:newId(),kind:"arch",archType:k,brand:"Building",model:t.n,name:t.n,cat:"Building",w,d:k==="column"?w:t.d,h:k==="column"?state.room.h:2100,mount:k==="column"?"floor":"arch",power:"none",kw:null,elec:null,water:false,drain:false,conf:"user",x:Math.round(state.room.w/2-w/2),y:wallish?-t.d:Math.round(state.room.d/2),rot:0};
  state.items.push(it);if(wallish)snapArch(it);sel=it.id;if(view==="elev")setView("plan");changed();toast(wallish?`Added ${t.n}. Drag it along any wall; it snaps to the nearest one.`:`Added ${t.n}. Drag it into place.`);
  revealCanvas();});

/* ---------- auto layout (rule-based) + AI brief ---------- */
const COOK=["fryer","range","chargrill","griddle","induction","pasta","tiltpan","oven","salamander","hsoven"];
function zoneOf(it){
  const k=KS_symOf(it);
  if(it.kind==="ss"){const t=it.ssType;if(["hood","wshelf","wcab"].includes(t))return "over";if(t==="gantry")return "pass";if(t==="hand")return "hand";if(["rack","trolley"].includes(t))return "storage";if(t==="landing"||t==="sink3")return "wash";return "prep";}
  if(COOK.includes(k))return "cook";if(k==="fridge"||k==="ice")return "storage";if(k.startsWith("dish"))return "wash";return "prep";
}
let undoSnap=null,lastUnfit=[];
/* how expendable an item is when the room is full: higher goes first */
function trimPrio(it){const s=it.ssType||"",z=zoneOf(it);
  if(s==="hand")return 0;if(/^sink/.test(s))return 1;if(z==="storage")return 2;if(z==="cook"||it.mount==="top"&&COOK.includes(KS_symOf(it)))return 3;if(z==="wash")return 4;
  if(it.mount==="over")return 8;if(["rack","trolley","wshelf"].includes(s))return 7;if(["table","cab","landing"].includes(s))return 6;return 5;}
/* remove the most expendable items one at a time until everything the planner keeps fits */
function fitToRoom(aisle,max){const removed=[];let notes=autoLayout(aisle);
  const byExp=(a,b)=>trimPrio(b)-trimPrio(a)||b.w*b.d-a.w*a.d;/* most expendable, then biggest, first */
  for(let k=0;k<(max||40)&&lastUnfit.length;k++){
    const real=state.items.filter(i=>i.kind!=="arch"&&i.mount!=="over"),unfit=real.filter(i=>lastUnfit.includes(i.id)).sort(byExp),placed=real.filter(i=>!lastUnfit.includes(i.id)).sort(byExp);
    let victim=unfit[0];const pv=trimPrio(victim);
    const essential=pv===0||pv===1&&!placed.some(o=>trimPrio(o)===1)||pv===2&&!placed.some(o=>trimPrio(o)===2);
    if(essential){/* the only hand basin, sink or cold store didn't fit: give up a table, rack or shelf that did */
      const twin=unfit.find(i=>placed.some(o=>o.brand===i.brand&&o.model===i.model&&o.w===i.w));
      const swap=placed.find(o=>trimPrio(o)>=5);victim=twin||swap||victim;}
    state.items=state.items.filter(i=>i!==victim);removed.push(victim);notes=autoLayout(aisle);}
  return {notes,removed};}
function showTrim(){const n=lastUnfit.length;$("aiTrimBar").hidden=!n;if(n)$("aiTrimTxt").textContent=`${n} item${n>1?"s":""} in free space`;}
$("aiTrim").addEventListener("click",()=>{if(!lastUnfit.length)return;undoSnap=undoSnap||JSON.stringify(state);const a=Math.min(2000,Math.max(900,Math.round(+$("aiAisle").value)||1200));
  const gone=state.items.filter(i=>lastUnfit.includes(i.id));state.items=state.items.filter(i=>!lastUnfit.includes(i.id));const notes=autoLayout(a);sel=null;$("aiUndo").hidden=false;changed();
  showNotes([`Removed: ${gone.map(i=>i.name||i.model).join(", ")}.`,...notes],"What the layout did");showTrim();revealCanvas();});
function autoLayout(aisle){
  const notes=[],R=state.room,flip=R.d>R.w,Wc=flip?R.d:R.w,Dc=flip?R.w:R.d;
  const items=state.items.filter(i=>i.kind!=="arch"),placed=[],pos=new Map();/* pos: id -> {x,y,rot} in the virtual room (cooking wall = north) */
  const foot=(it,rot)=>rot%180?[it.d,it.w]:[it.w,it.d];
  const inter=(a,b)=>a[0]<b[2]-1&&a[2]>b[0]+1&&a[1]<b[3]-1&&a[3]>b[1]+1;
  const frontOf=(r,rot,dep)=>rot===0?[r[0],r[3],r[2],r[3]+dep]:rot===180?[r[0],r[1]-dep,r[2],r[1]]:rot===270?[r[2],r[1],r[2]+dep,r[3]]:[r[0]-dep,r[1],r[0],r[3]];
  function fits(r,rot,clear){if(r[0]<0||r[1]<0||r[2]>Wc||r[3]>Dc)return false;const f=frontOf(r,rot,clear);
    for(const p of placed){if(inter(r,p.r)||inter(f,p.r)||inter(r,p.f))return false;}return true;}
  function commit(it,x,y,rot,clear){const [w,d]=foot(it,rot),r=[x,y,x+w,y+d];placed.push({it,r,f:frontOf(r,rot,clear),rot});pos.set(it.id,{x,y,rot});}
  function wallRect(it,wall,p){const rot={N:0,S:180,W:270,E:90}[wall],[w,d]=foot(it,rot);
    return {rot,x:wall==="E"?Wc-w:wall==="N"||wall==="S"?p:0,y:wall==="S"?Dc-d:wall==="N"?0:p,len:wall==="N"||wall==="S"?w:d};}
  function tryWall(it,wall,from,dir){const L=wall==="N"||wall==="S"?Wc:Dc,rot={N:0,S:180,W:270,E:90}[wall],[w,d]=foot(it,rot),len=wall==="N"||wall==="S"?w:d;
    let p=dir>0?Math.ceil(Math.max(0,from)/50)*50:Math.floor(Math.min(L-len,from-len)/50)*50;
    for(;p>=0&&p+len<=L;p+=50*dir){const q=wallRect(it,wall,p),r=[q.x,q.y,q.x+w,q.y+d];if(fits(r,rot,900)){commit(it,q.x,q.y,rot,900);return dir>0?p+len:p;}}
    return null;}
  function anyWall(it,order){for(const wl of order){const r=tryWall(it,wl,0,1);if(r!==null)return true;}return false;}
  const toV=r=>flip?[R.d-r[3],r[0],R.d-r[1],r[2]]:r,block=r=>{const v=toV(r);placed.push({it:null,r:v,f:v,rot:0});};
  for(const a of state.items){if(a.kind!=="arch")continue;if(/^door/.test(a.archType)){const z=doorZone(a),g=300;block([z[0]-g,z[1]-g,z[2]+g,z[3]+g]);}else if(a.archType==="column")block([a.x,a.y,a.x+fw(a),a.y+fd(a)]);}
  if(R.poly){const st=200,P=R.poly,e=6,inCell=(x,y)=>inPoly(x+e,y+e,P)&&inPoly(x+st-e,y+e,P)&&inPoly(x+e,y+st-e,P)&&inPoly(x+st-e,y+st-e,P)&&inPoly(x+st/2,y+st/2,P);
    for(let y=0;y<R.d;y+=st){let run=null;for(let x=0;x<=R.w;x+=st){const out=x<R.w&&!inCell(x,y);if(out&&run===null)run=x;if(!out&&run!==null){block([run,y,x,y+st]);run=null;}}}
    notes.push("Traced room: equipment is placed along the outer walls. Check inner corners by hand.");}
  const Z={cook:[],storage:[],wash:[],prep:[],hand:[],pass:[],over:[]},tops=[];
  for(const it of items){const z=zoneOf(it);if(z==="over")Z.over.push(it);else if(it.mount==="top")tops.push(it);else Z[z].push(it);}
  const cookTops=tops.filter(t=>COOK.includes(KS_symOf(t))),otherTops=tops.filter(t=>!cookTops.includes(t)&&zoneOf(t)!=="pass"),gantries=tops.filter(t=>zoneOf(t)==="pass");
  const tables=()=>Z.prep.filter(i=>i.kind==="ss"&&["table","cab"].includes(i.ssType));
  // 1. borrow tables as stands for countertop cooking units
  let need=cookTops.reduce((a,t)=>a+t.w+50,0);const stands=[];
  const wantIsland=(Z.cook.length||cookTops.length)&&tables().length&&(gantries.length||tables().length>=2);
  const islandPick=wantIsland?tables().sort((a,b)=>b.w-a.w)[0]:null;
  const pool=tables().filter(t=>t!==islandPick).sort((a,b)=>a.w-b.w),single=pool.find(t=>t.w>=need);
  if(need>0){if(single)stands.push(single);else for(const t of pool.reverse()){if(need<=0)break;stands.push(t);need-=t.w;}}
  Z.prep=Z.prep.filter(i=>!stands.includes(i));
  // 2. cooking line, centred on the north wall
  Z.cook.sort((a,b)=>COOK.indexOf(KS_symOf(a))-COOK.indexOf(KS_symOf(b)));
  const line=[...Z.cook.filter(i=>KS_symOf(i)!=="oven"),...stands,...Z.cook.filter(i=>KS_symOf(i)==="oven")];
  const lineLen=line.reduce((a,i)=>a+i.w,0);let cur=Math.max(0,Math.round((Wc-lineLen)/2/50)*50);const unplaced=[];
  {const runFits=x0=>{let x=x0;for(const it of line){const r=[x,0,x+it.w,it.d];if(!fits(r,0,900))return false;x+=it.w;}return true;},c0=cur;let best=null;
    for(let x=0;x+lineLen<=Wc;x+=50)if((best===null||Math.abs(x-c0)<Math.abs(best-c0))&&runFits(x))best=x;if(best!==null)cur=best;}
  for(const it of line){const r=tryWall(it,"N",cur,1);if(r===null)unplaced.push(it);else cur=r;}
  const cookDepth=line.reduce((a,i)=>Math.max(a,i.d),0);
  // 3. island / pass parallel to the line
  let island=[];const tb=tables().sort((a,b)=>b.w-a.w);
  if(line.length&&islandPick){const t=islandPick,y=cookDepth+aisle;
    if(Dc-(y+t.d)>=aisle+750&&t.w<=Wc-2*(aisle+700)){let x=Math.round((Wc-t.w)/2/50)*50;const r=[x,y,x+t.w,y+t.d];
      if(fits(r,180,0)){const pad=[r[0]-aisle+50,r[1]-aisle+50,r[2]+aisle-50,r[3]+aisle-50];placed.push({it:t,r,f:pad,rot:180});pos.set(t.id,{x,y,rot:180});island=[t];Z.prep=Z.prep.filter(i=>i!==t);}}}
  // 4. storage on the west wall from the south end, wash on the east wall from the south end
  let c=Dc;for(const it of Z.storage.sort((a,b)=>b.h-a.h)){const r=tryWall(it,"W",c,-1);if(r===null)unplaced.push(it);else c=r;}
  const wash=[...Z.wash.filter(i=>i.ssType==="landing").slice(0,1),...Z.wash.filter(i=>i.kind!=="ss"),...Z.wash.filter(i=>i.ssType==="landing").slice(1),...Z.wash.filter(i=>i.ssType==="sink3")];
  c=Dc;for(const it of wash){const r=tryWall(it,"E",c,-1);if(r===null)unplaced.push(it);else c=r;}
  // 5. prep: south wall, sinks first, then whatever wall has room
  const prep=[...Z.prep.filter(i=>/^sink/.test(i.ssType||"")),...Z.prep.filter(i=>!/^sink/.test(i.ssType||""))];
  c=0;for(const it of prep){const r=tryWall(it,"S",c,1);if(r===null){if(!anyWall(it,["N","W","E"]))unplaced.push(it);}else c=r;}
  for(const it of Z.hand)if(!anyWall(it,["E","S","W","N"]))unplaced.push(it);
  function tryFloor(it){const w=it.w,d=it.d,g=aisle-100;for(let y=Math.ceil((cookDepth+aisle)/100)*100;y+d<=Dc-g;y+=100)for(let x=Math.ceil((g+700)/100)*100;x+w<=Wc-g-700;x+=100){const r=[x,y,x+w,y+d],pad=[x-g,y-g,x+w+g,y+d+g];
      if(placed.every(p=>!inter(pad,p.r)&&!inter(r,p.f))){placed.push({it,r,f:r,rot:180});pos.set(it.id,{x,y,rot:180});return true;}}return false;}
  for(const it of unplaced.splice(0))if(!anyWall(it,["S","W","E","N"])&&!tryFloor(it))unplaced.push(it);
  // 6. countertop items onto bases
  const used=new Map();
  function onBase(top,bases){for(const b of bases){const p=pos.get(b.id);if(!p||b.h<600||b.h>1000)continue;const u=used.get(b.id)||50;if(u+top.w>b.w-20&&!(u===50&&top.w<=b.w+10))continue;
      const off=Math.min(u,Math.max(0,b.w-top.w)),cz=top.d<=b.d?(b.d-top.d)/2:0;let x,y;
      if(p.rot===0){x=p.x+off;y=p.y+cz;}else if(p.rot===180){x=p.x+b.w-off-top.w;y=p.y+b.d-cz-top.d;}else if(p.rot===270){x=p.x+cz;y=p.y+b.w-off-top.w;}else{x=p.x+b.d-cz-top.d;y=p.y+off;}
      pos.set(top.id,{x,y,rot:p.rot});used.set(b.id,off+top.w+60);return true;}return false;}
  const surf=i=>i.kind==="ss"?["table","cab","landing"].includes(i.ssType):KS_symOf(i)==="counter";
  const allBases=items.filter(i=>i.mount==="floor"&&surf(i)&&pos.has(i.id));let noBase=0;
  for(const g of gantries){const cand=[...island,...allBases.filter(b=>!stands.includes(b)&&!island.includes(b)).sort((a,b)=>b.w-a.w)];if(!onBase(g,cand)){noBase++;if(!anyWall(g,["S","N","W","E"]))unplaced.push(g);}else{const p=pos.get(g.id),b=cand.find(c=>{const q=pos.get(c.id);return q&&q.rot===p.rot&&Math.abs(q.x-p.x)<c.w&&Math.abs(q.y-p.y)<c.w;});if(b)used.set(b.id,50);}}
  for(const t of cookTops.sort((a,b)=>b.w-a.w)){if(!onBase(t,[...stands,...allBases.filter(b=>!stands.includes(b)&&!island.includes(b))])){noBase++;if(!anyWall(t,["N","W","E","S"]))unplaced.push(t);}}
  for(const t of otherTops.sort((a,b)=>b.w-a.w)){if(!onBase(t,allBases.filter(b=>!stands.includes(b)))){noBase++;if(!anyWall(t,["S","W","E","N"]))unplaced.push(t);}}
  // 7. overhead: hood over the line, shelves over wall tables
  const cookSet=new Set([...Z.cook,...cookTops].map(i=>i.id));let x0=1e9,x1=-1,dep=0;
  for(const [id,p] of pos){if(!cookSet.has(id)||p.rot!==0||p.y>50)continue;const it=items.find(i=>i.id===id);if(zoneOf(it)==="cook"&&KS_symOf(it)!=="oven"||it.mount==="top"){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x+it.w);dep=Math.max(dep,it.d);}}
  let hoods=Z.over.filter(i=>i.ssType==="hood");
  if(x1>x0){let hd=hoods[0];if(!hd){const t=SS.hood;hd={id:newId(),kind:"ss",ssType:"hood",brand:"Fabricated",model:t.n,name:t.n,cat:"Stainless",w:2000,d:1200,h:500,mount:"over",z:2000,power:"none",kw:null,elec:null,water:false,drain:false,opts:["Baffle filters","Lights"],mat:"AISI 304, 1.2 mm",conf:"user",x:0,y:0,rot:0};items.push(hd);state.items.push(hd);notes.push("Added an exhaust hood over the cooking line.");}
    const hx=Math.max(0,x0-150),hw=Math.min(Wc-hx,Math.ceil((x1+150-hx)/100)*100);hd.w=hw;hd.d=Math.max(1000,Math.ceil((dep+250)/100)*100);pos.set(hd.id,{x:hx,y:0,rot:0});notes.push(`Hood sized to ${hd.w} × ${hd.d} to overhang the line by 150 mm.`);}
  const shelfBases=placed.filter(p=>p.it&&p.it.kind==="ss"&&p.it.mount==="floor"&&p.it.h<=1000&&!island.includes(p.it)&&(p.r[0]<1||p.r[1]<1||p.r[2]>Wc-1||p.r[3]>Dc-1));
  for(const sh of Z.over.filter(i=>i.ssType!=="hood")){const b=shelfBases.shift();if(!b)continue;const [w,d]=foot(sh,b.rot);let x=b.r[0],y=b.r[1];if(b.rot===180)y=Dc-d;if(b.rot===90)x=Wc-w;pos.set(sh.id,{x,y,rot:b.rot});}
  // 8. write back (rotate the whole plan if the room is deeper than it is wide)
  for(const it of items){const p=pos.get(it.id);if(!p)continue;
    if(!flip){it.x=p.x;it.y=p.y;it.rot=p.rot;}else{const [w,d]=foot(it,p.rot);it.rot=(p.rot+270)%360;it.x=p.y;it.y=R.d-(p.x+w);}
    clamp(it);}
  for(const it of unplaced){findSpot(it);}
  lastUnfit=unplaced.map(i=>i.id);
  const wallName=flip?"west":"north";
  if(line.length)notes.unshift(`Cooking line on the ${wallName} wall${island.length?`, pass table ${aisle} mm in front of it`:""}; cold storage, prep and warewashing on the other walls.`);
  if(stands.length)notes.push(`${stands.length} table${stands.length>1?"s":""} used as a stand for countertop cooking units.`);
  if(noBase)notes.push(`${noBase} countertop item${noBase>1?"s have":" has"} no table to sit on. Add a table or stand.`);
  if(unplaced.length)notes.push(`Didn't fit in the ${(R.w/1000).toFixed(1)} × ${(R.d/1000).toFixed(1)} m room: ${unplaced.map(i=>i.name||i.model).join(", ")}. They were dropped in free space; remove them, make the room bigger or narrow the aisle and arrange again.`);
  const ov=state.items.filter(collides).length;if(ov)notes.push(`${ov} items still overlap. Move them by hand.`);
  return notes;
}
function showNotes(list,head){$("aiNotes").innerHTML=(head?`<div class="lbl">${esc(head)}</div>`:"")+`<ul>${list.map(n=>`<li>${esc(n)}</li>`).join("")}</ul>`;}
function runAuto(){
  if(!state.items.length){toast("Add some equipment first, then arrange it.");return;}
  undoSnap=JSON.stringify(state);const a=Math.min(2000,Math.max(900,Math.round(+$("aiAisle").value)||1200));
  const notes=autoLayout(a);sel=null;$("aiUndo").hidden=false;if(view==="elev")setView("plan");changed();showNotes(notes,"What the layout did");showTrim();
  if(lastUnfit.length)toast(`${lastUnfit.length} item${lastUnfit.length>1?"s":""} didn't fit the room. Remove them in AI design or make the room bigger.`);
  revealCanvas();
}
$("aiArrange").addEventListener("click",runAuto);
$("aiUndo").addEventListener("click",()=>{if(!undoSnap)return;adopt(JSON.parse(undoSnap));undoSnap=null;$("aiUndo").hidden=true;changed();toast("Back to your previous layout.");});
$("aiBrief").addEventListener("click",async()=>{
  const brief=$("aiText").value.trim();if(brief.length<8){toast("Describe the kitchen first: concept, menu, covers or orders per day.");return;}
  if(be&&!be.user()){openSignIn("Sign in to use the AI brief. It is free during early access.");return;}
  if(!sampleFn){toast("The AI brief only works on the published page inside Claude.");return;}
  const cat=all(),btn=$("aiBrief");btn.disabled=true;$("aiNotes").textContent="Claude is choosing equipment for your brief…";
  const lines=cat.map((e,i)=>`${i}|${e.brand} ${e.model}|${e.name}|${e.w}x${e.d}x${e.h}|${e.mount==="top"?"countertop":"floor"}`).join("\n");
  const ssl=Object.entries(SS).map(([k,v])=>`${k}: ${v.n}, default ${v.w}x${v.d}x${v.h}, options ${v.opts.join("/")}`).join("\n");
  const B=roomBudget();
  const prompt=`You are an experienced commercial kitchen designer. Choose the equipment for this kitchen. A separate program will position it, so do not give coordinates.
ROOM: ${B.shape}, ${state.room.w} x ${state.room.d} mm overall, ${B.area} m² floor, ceiling ${state.room.h} mm, ${B.doors} door${B.doors===1?"":"s"}.
HARD BUDGET: usable wall run is ${B.wall} mm after doors and corners. The summed width of all floor-standing items (equipment plus stainless tables, sinks, racks) must stay under ${B.wall} mm, and their summed footprint under ${B.foot} m². Count it before you answer and drop items until it fits. A ${B.area} m² room is ${B.size}.
BRIEF: ${brief}
EQUIPMENT CATALOGUE (index|brand model|description|WxDxH mm|mount). Choose only from these indexes:
${lines}
STAINLESS MODULES you can specify (type: description). Width is free between 400 and 3000 in steps of 100:
${ssl}
Rules: countertop equipment needs a table or refrigerated counter wide enough to sit on. Always include one hand wash basin ("hand"), at least one sink, cold storage, and warewashing if the brief implies dishes or pots. Do not include a hood; it is added automatically. Prefer 220-240V / 380-415V 50Hz models over US-spec 115V ones unless the brief says otherwise. Fit the list to the room; a small room gets a short list.
Reply with ONLY JSON: {"equipment":[{"i":catalogue index,"qty":1}],"stainless":[{"type":"table","w":1500,"qty":1,"opts":["Undershelf"]}],"notes":["up to 5 short sentences explaining the main choices and anything the owner should double-check"]}`;
  try{
    const r=await sampleFn.json(prompt,{modelTier:"default",cache:false});
    const eq=Array.isArray(r&&r.equipment)?r.equipment:[],ss=Array.isArray(r&&r.stainless)?r.stainless:[];
    const next=[];
    for(const e of eq){const spec=cat[+e.i];if(!spec)continue;for(let k=0;k<Math.min(6,Math.max(1,+e.qty||1));k++)next.push(Object.assign({id:newId(),x:0,y:0,rot:0,kind:"eq"},JSON.parse(JSON.stringify(spec))));}
    for(const m of ss){const t=SS[m.type];if(!t||m.type==="hood")continue;const w=Math.min(3000,Math.max(300,Math.round((+m.w||t.w)/50)*50)),opts=(Array.isArray(m.opts)?m.opts:[]).filter(o=>t.opts.includes(o));
      for(let k=0;k<Math.min(8,Math.max(1,+m.qty||1));k++)next.push({id:newId(),x:0,y:0,rot:0,kind:"ss",ssType:m.type,brand:"Fabricated",model:t.n,name:t.n,cat:"Stainless",w,d:t.d,h:t.h,mount:t.mount,z:t.z,power:"none",kw:null,elec:null,water:!!t.water,drain:!!t.drain,opts,mat:"AISI 304, 1.2 mm",conf:"user"});}
    if(next.length<3){$("aiNotes").textContent="Claude didn't return a usable equipment list. Try a more specific brief.";btn.disabled=false;return;}
    undoSnap=JSON.stringify(state);state.items=[...state.items.filter(i=>i.kind==="arch"),...next];const a=Math.min(2000,Math.max(900,Math.round(+$("aiAisle").value)||1200));
    const fit=fitToRoom(a),ln=fit.notes;if(fit.removed.length)ln.unshift(`Trimmed to the room: left out ${fit.removed.map(i=>i.name||i.model).join(", ")} because they didn't fit in ${(state.room.w/1000).toFixed(1)} × ${(state.room.d/1000).toFixed(1)} m.`);
    sel=null;$("aiUndo").hidden=false;if(view==="elev")setView("plan");changed();showTrim();
    showNotes([...(Array.isArray(r.notes)?r.notes.slice(0,5).map(String):[]),...ln],"Claude's equipment choices, then the layout rules");
    revealCanvas();
  }catch(err){$("aiNotes").textContent=err&&err.code==="rate_limited"?"Claude is rate limited right now. Try again in a minute.":err&&err.code==="not_granted"?"The AI brief wasn't allowed for this page.":"The AI brief didn't work this time. You can still add equipment yourself and use Arrange.";}
  btn.disabled=false;
});

/* ---------- starter templates ---------- */
const TEMPLATES={
  cloud:{n:"Cloud kitchen, burgers and fried chicken (7 × 5 m)",room:[7000,5000,3000],eq:[["Foster","EcoPro G3 EP1440H",1],["Foster","EcoPro G3 EP700L",1],["Foster","EcoPro G3 EP1/3H",1],["Electrolux Professional","700XP 371002 (E7GCGH4CG0)",1],["Electrolux Professional","700XP 371071 (E7FRGH2GF0)",1],["Electrolux Professional","700XP 371238 (E7GRGHGCFU)",1],["Merrychef","conneX 12 High Power",1],["Hatco","Glo-Ray GRFHS-21",1],["Winterhalter","UC-L",1],["Hoshizaki","IM-45CNE-HC",1]],
    ss:[["table",1800,1,["Undershelf"]],["table",1500,1,["Undershelf"]],["table",1200,1,["Undershelf"]],["sink2",1500,1,["Upstand 100 mm"]],["hand",400,1,[]],["rack",1200,2,[]],["gantry",1500,1,["Heat lamps"]],["wshelf",1200,2,[]]]},
  cafe:{n:"Café with espresso bar (7 × 4 m)",room:[7000,4000,3000],eq:[["La Marzocco","Linea PB 2-group",1],["Mahlkonig","E65S",2],["Mahlkonig","EK43",1],["Vitamix","The Quiet One",1],["Merrychef","conneX 12 High Power",1],["Foster","HR150",2],["Williams","Jade HJC2 (JC2)",1],["Polar","U-Series UA061",1],["Gamko","Maxiglass Noverta MG3/250G",1],["Hoshizaki","IM-21CNE-HC",1],["Winterhalter","UC-S",1]],
    ss:[["cab",1800,2,["Upstand 100 mm"]],["table",1200,1,["Undershelf"]],["sink1",1200,1,["Upstand 100 mm"]],["hand",400,1,[]],["rack",900,1,[]],["wshelf",1200,2,[]]]},
  qsr:{n:"QSR line with holding and pass (10 × 7 m)",room:[10000,7000,3000],eq:[["Foster","EcoPro G3 EP1440H",1],["Foster","EcoPro G3 EP1440L",1],["Foster","Advantage+ ADV+1515HT",1],["Infrico","BMGN 1960 II",2],["Electrolux Professional","900XP 391006",1],["Electrolux Professional","900XP 391267",1],["Electrolux Professional","900XP 391080 (E9FRGH2JF0)",2],["Rational","iCombi Pro 10-1/1 E",1],["Henny Penny","HHC-990",1],["Hatco","Glo-Ray GRFHS-PT26",1],["Antunes","VCT-2000",1],["Prince Castle","DHB2PT-20",1],["Winterhalter","PT-M",1],["Hoshizaki","IM-130NE-HC",1]],
    ss:[["table",2400,1,["Undershelf"]],["table",1800,2,["Undershelf"]],["table",1200,1,["Undershelf"]],["sink2",1500,1,["Upstand 100 mm"]],["sink3",2100,1,["Upstand 100 mm"]],["landing",1200,2,["Pre-rinse sink"]],["hand",400,2,[]],["rack",1200,3,[]],["gantry",1800,1,["Heat lamps","Ticket rail"]],["wshelf",1500,2,[]]]},
  bakery:{n:"Bakery production (9 × 6.5 m)",room:[9000,6500,3200],eq:[["Sveba Dahlen","C100 (C-Series)",1],["Unox","XEBC-10EU-EPRM",1],["Sigma","Tauro 40",1],["Hobart","HSM30",1],["Sinmag","SM-520F",1],["Foster","EcoPro G3 EP1440H",1],["Foster","EcoPro G3 EP700L",1],["Williams","WBC20",1],["Williams","Jade HJC3",1],["Winterhalter","UF-M",1]],
    ss:[["table",2400,2,["Undershelf"]],["table",1800,1,["Undershelf"]],["table",1200,1,["Undershelf"]],["sink2",1500,1,["Upstand 100 mm"]],["sink3",2100,1,[]],["hand",400,1,[]],["rack",1200,3,[]],["trolley",460,4,["Castors"]],["wshelf",1500,2,[]]]}
};
function ssItem(type,w,opts){const t=SS[type];return {id:newId(),x:0,y:0,rot:0,kind:"ss",ssType:type,brand:"Fabricated",model:t.n,name:t.n,cat:"Stainless",w:type==="trolley"||type==="hand"?t.w:w,d:t.d,h:t.h,mount:t.mount,z:t.z,power:"none",kw:null,elec:null,water:!!t.water||opts.includes("Pre-rinse sink"),drain:!!t.drain||opts.includes("Pre-rinse sink"),opts:opts.filter(o=>t.opts.includes(o)),mat:"AISI 304, 1.2 mm",conf:"user"};}
$("tplSel").innerHTML=Object.entries(TEMPLATES).map(([k,v])=>`<option value="${k}">${esc(v.n)}</option>`).join("");
$("tplLoad").addEventListener("click",()=>{const T=TEMPLATES[$("tplSel").value],next=[],missing=[];
  for(const [b,m,q] of T.eq){const spec=BASE.find(e=>e.brand===b&&e.model===m);if(!spec){missing.push(b+" "+m);continue;}for(let i=0;i<q;i++)next.push(Object.assign({id:newId(),x:0,y:0,rot:0,kind:"eq"},JSON.parse(JSON.stringify(spec))));}
  for(const [type,w,q,opts] of T.ss)for(let i=0;i<q;i++)next.push(ssItem(type,w,opts));
  undoSnap=JSON.stringify(state);state.room={w:T.room[0],d:T.room[1],h:T.room[2]};state.items=next;roomInputs();fpUI();
  const notes=autoLayout(Math.min(2000,Math.max(900,Math.round(+$("aiAisle").value)||1200)));sel=null;$("aiUndo").hidden=false;if(view==="elev")setView("plan");changed();
  showNotes([`Loaded ${next.length} items into a ${T.room[0]} × ${T.room[1]} mm room. Change the room size or upload your own plan, then press Arrange again.`,...notes,...(missing.length?["Not found in catalogue: "+missing.join(", ")]:[])],T.n);
  revealCanvas();});
/* ---------- PDF drawing set: to-scale sheets with title block ---------- */
const LIGHT={ground:"#E9EDF0",surface:"#FFFFFF",sunk:"#DDE3E8",ink:"#15222B",muted:"#5B6B77",line:"#C3CDD5",steel:"#AEBBC5","steel-fill":"#D6DEE4",accent:"#2347C5","accent-soft":"#E3E9FB",dim:"#C8451B",bad:"#C42B2B","top-fill":"#F3E7C9",grid:"#D3DAE0"};
const SCALES=[20,25,50,75,100,125,150,200,250,300,400,500];
const UT={E:["#C8451B","E"],G:["#C8900A","G"],W:["#1F7FC2","W"],D:["#3C7A4B","D"]};
function pickScale(wmm,hmm,availW,availH){return SCALES.find(s=>wmm/s<=availW&&hmm/s<=availH)||SCALES[SCALES.length-1];}
function utilPoints(it){const out=[],add=(k,fx,note)=>out.push({k,fx,note});
  if(it.power==="electric")add("E",.22,[it.kw?it.kw+" kW":"",it.elec||""].filter(Boolean).join(" "));
  if(it.power==="gas")add("G",.22,it.kw?it.kw+" kW":"");
  if(it.water)add("W",.6,"");if(it.drain)add("D",.82,"");
  return out.map(p=>{const lx=it.w*p.fx,ly=Math.min(90,it.d*.2),W=fw(it),D=fd(it);const q=[[lx,ly],[W-ly,lx],[W-lx,D-ly],[ly,D-lx]][(it.rot/90)%4];return Object.assign(p,{x:it.x+q[0],y:it.y+q[1]});});}
function sheetSVG(PW,PH,meta,inner,side){
  const M=10,TB=PW>400?96:74,x0=PW-M-TB,F="helvetica",MF="courier",ink=LIGHT.ink,t=s=>esc(s);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}mm" height="${PH}mm" viewBox="0 0 ${PW} ${PH}"><rect width="${PW}" height="${PH}" fill="#FFFFFF"/>`;
  s+=inner;
  s+=`<rect x="${M}" y="${M}" width="${PW-2*M}" height="${PH-2*M}" fill="none" stroke="${ink}" stroke-width=".5"/><path d="M${x0} ${M}V${PH-M}" stroke="${ink}" stroke-width=".5"/>`;
  s+=`<rect x="${x0}" y="${M}" width="${TB}" height="13" fill="${ink}"/><text x="${x0+4}" y="${M+8.8}" font-family="${F}" font-weight="bold" font-size="5" fill="#FFFFFF">KITCHEN STUDIO</text>`;
  s+=`<text x="${x0+4}" y="${M+20}" font-family="${F}" font-size="2.4" fill="${LIGHT.muted}">PROJECT</text><text x="${x0+4}" y="${M+25.5}" font-family="${F}" font-weight="bold" font-size="4" fill="${ink}">${t(meta.project)}</text>`;
  s+=`<text x="${x0+4}" y="${M+32}" font-family="${F}" font-size="2.4" fill="${LIGHT.muted}">DRAWING</text><text x="${x0+4}" y="${M+37.5}" font-family="${F}" font-weight="bold" font-size="4" fill="${LIGHT.dim}">${t(meta.title)}</text><path d="M${x0} ${M+41}H${PW-M}" stroke="${ink}" stroke-width=".35"/>`;
  s+=side(x0+4,M+47,TB-8,PH-M-47-58,F,MF);
  const by=PH-M-52,cell=(x,y,w,h,l,v)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${ink}" stroke-width=".35"/><text x="${x+1.6}" y="${y+3.2}" font-family="${F}" font-size="2" fill="${LIGHT.muted}">${l}</text><text x="${x+1.6}" y="${y+8.2}" font-family="${MF}" font-size="3.2" fill="${ink}">${t(v)}</text>`;
  s+=cell(x0,by,TB/2,10,"SCALE",meta.scale)+cell(x0+TB/2,by,TB/2,10,"SHEET",meta.sheet)+cell(x0,by+10,TB/2,10,"DATE",meta.date)+cell(x0+TB/2,by+10,TB/2,10,"PAPER",meta.paper)+cell(x0,by+20,TB,10,"DRAWN BY",meta.by||"-");
  const note=["Concept layout. All dimensions in millimetres.","Verify equipment against current manufacturer","spec sheets and site dimensions before ordering","or fabrication. Not for construction."];
  note.forEach((l,i)=>s+=`<text x="${x0+2}" y="${by+35+i*3.4}" font-family="${F}" font-size="2.3" fill="${LIGHT.muted}">${l}</text>`);
  return s+`</svg>`;
}
function scaleBar(x,y,S){const seg=1000/S,n=S<=50?3:S<=100?5:S<=200?10:20,step=S<=100?1:S<=200?2:5;let s="";
  for(let i=0;i<n/step;i++)s+=`<rect x="${x+i*seg*step}" y="${y}" width="${seg*step}" height="1.6" fill="${i%2?"#FFFFFF":LIGHT.ink}" stroke="${LIGHT.ink}" stroke-width=".2"/><text x="${x+i*seg*step}" y="${y+5}" font-family="courier" font-size="2.4" text-anchor="middle" fill="${LIGHT.ink}">${i*step}</text>`;
  return s+`<text x="${x+n*seg}" y="${y+5}" font-family="courier" font-size="2.4" text-anchor="middle" fill="${LIGHT.ink}">${n} m</text>`;}
function listSide(rows,head){return (x,y,w,h,F,MF)=>{let s=`<text x="${x}" y="${y}" font-family="${F}" font-weight="bold" font-size="2.8" fill="${LIGHT.ink}">${esc(head)}</text>`;const lh=3.6,max=Math.floor((h-6)/lh);
  rows.slice(0,max).forEach((r,i)=>{const yy=y+6+i*lh,cut=Math.floor(w/1.45);s+=`<text x="${x}" y="${yy}" font-family="${MF}" font-size="2.3" fill="${r.col||LIGHT.ink}">${esc(r.a)}</text><text x="${x+9}" y="${yy}" font-family="${F}" font-size="2.3" fill="${LIGHT.ink}">${esc(r.b.length>cut?r.b.slice(0,cut-1)+"…":r.b)}</text>`;});
  if(rows.length>max)s+=`<text x="${x}" y="${y+6+max*lh}" font-family="${F}" font-size="2.3" fill="${LIGHT.muted}">+ ${rows.length-max} more on the schedule sheet</text>`;return s;};}
function buildSheets(PW,PH,meta){
  const M=10,TB=PW>400?96:74,aw=PW-2*M-TB-16,ah=PH-2*M-26,R=state.room,sheets=[],m=700;
  const S=pickScale(R.w+2*m,R.d+2*m,aw,ah),upp=S*.25,ox=M+8+(aw-(R.w+2*m)/S)/2+m/S,oy=M+8+(ah-(R.d+2*m)/S)/2+m/S;
  const place=body=>`<g transform="translate(${ox} ${oy}) scale(${1/S})">${body}</g>`+scaleBar(M+8,PH-M-10,S);
  const eq=eqList();
  // 1 equipment plan
  sheets.push({title:"Equipment plan",scale:"1:"+S,inner:place(planSVG(upp,"pdf").body),side:listSide(eq.map((it,i)=>({a:String(i+1),b:(it.kind==="ss"?it.name:it.brand+" "+it.model)+"  "+it.w+"×"+it.d+"×"+it.h})),"EQUIPMENT KEY")});
  // 2 utilities plan
  let marks="";const rows=[];const r=2.1*S;
  eq.forEach((it,i)=>{const pts=utilPoints(it);if(!pts.length)return;pts.forEach(p=>{const u=UT[p.k];marks+=`<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${u[0]}" stroke="#FFFFFF" stroke-width="${.25*S}"/><text x="${p.x}" y="${p.y+r*.42}" text-anchor="middle" font-family="helvetica" font-weight="bold" font-size="${r*1.15}" fill="#FFFFFF">${u[1]}</text>`;});
    rows.push({a:String(i+1),b:pts.map(p=>p.k+(p.note?" "+p.note:"")).join(" · ")});});
  const tot={E:0,G:0,W:0,D:0};eq.forEach(i=>{if(i.power==="electric"&&i.kw)tot.E+=i.kw;if(i.power==="gas"&&i.kw)tot.G+=i.kw;if(i.water)tot.W++;if(i.drain)tot.D++;});
  rows.unshift({a:"",b:""});rows.unshift({a:"D",b:`Drain points: ${tot.D}`,col:UT.D[0]});rows.unshift({a:"W",b:`Water points: ${tot.W}`,col:UT.W[0]});rows.unshift({a:"G",b:`Gas, total ${tot.G.toFixed(1)} kW`,col:UT.G[0]});rows.unshift({a:"E",b:`Electrical, total ${tot.E.toFixed(1)} kW connected`,col:UT.E[0]});
  sheets.push({title:"Utilities plan",scale:"1:"+S,inner:place(planSVG(upp,"pdf",true).body+marks),side:listSide(rows,"CONNECTION POINTS")});
  // 3 elevations, 2 x 2
  const keepWall=wall;let ev="";const cw=aw/2,ch=(ah-6)/2,Lmax=Math.max(R.w,R.d)+1200,Hm=R.h+1300,Se=pickScale(Lmax,Hm,cw-6,ch-6);
  ["N","E","S","W"].forEach((wl,i)=>{wall=wl;const o=elevSVG(Se*.25),cx=M+8+(i%2)*cw,cy=M+8+Math.floor(i/2)*ch;ev+=`<g transform="translate(${cx-o.vb[0]/Se+(cw-o.vb[2]/Se)/2} ${cy-o.vb[1]/Se+(ch-o.vb[3]/Se)/2}) scale(${1/Se})">${o.body}</g>`;});wall=keepWall;
  sheets.push({title:"Wall elevations",scale:"1:"+Se,inner:ev+scaleBar(M+8,PH-M-10,Se),side:listSide(eq.map((it,i)=>({a:String(i+1),b:it.kind==="ss"?it.name:it.brand+" "+it.model})),"EQUIPMENT KEY")});
  // 4+ schedules
  const lines=[];lines.push({h:"EQUIPMENT SCHEDULE"});lines.push({c:["No.","Qty","Brand / model","Description","W × D × H","Energy","Electrical","W","D"],b:1});
  for(const g of groups("eq")){const i=g.it;lines.push({c:[g.tags.join(","),g.tags.length,i.brand+" "+i.model,i.name,`${i.w} × ${i.d} × ${i.h}`,(i.power||"")+(i.kw?" "+i.kw+" kW":""),i.elec||"-",i.water?"Y":"-",i.drain?"Y":"-"]});}
  lines.push({h:""});lines.push({h:"STAINLESS FABRICATION SCHEDULE"});lines.push({c:["No.","Qty","Module","Options","W × D × H","Material","","",""],b:1});
  for(const g of groups("ss")){const i=g.it;lines.push({c:[g.tags.join(","),g.tags.length,i.name+(i.mount==="over"?` (underside ${i.z})`:""),(i.opts||[]).join(", ")||"-",`${i.w} × ${i.d} × ${i.h}`,i.mat||"","","",""]});}
  const colX=[0,16,26,92,168,206,238,278,286].map(v=>v*(aw+16)/296),per=Math.floor((ah+6)/4.6);
  for(let p=0;p<lines.length;p+=per){let body="";lines.slice(p,p+per).forEach((ln,k)=>{const y=M+12+k*4.6;
      if(ln.h!==undefined)body+=`<text x="${M+6}" y="${y}" font-family="helvetica" font-weight="bold" font-size="3.4" fill="${LIGHT.dim}">${esc(ln.h)}</text>`;
      else{ln.c.forEach((v,ci)=>{const mx=Math.floor(((colX[ci+1]||aw+16)-colX[ci])/1.5),sv=String(v);body+=`<text x="${M+6+colX[ci]}" y="${y}" font-family="${ci===4||ci===0?"courier":"helvetica"}" ${ln.b?'font-weight="bold"':""} font-size="2.5" fill="${LIGHT.ink}">${esc(sv.length>mx?sv.slice(0,mx-1)+"…":sv)}</text>`;});
        body+=`<path d="M${M+5} ${y+1.4}H${M+aw+12}" stroke="${ln.b?LIGHT.ink:LIGHT.line}" stroke-width="${ln.b?.35:.15}"/>`;}});
    sheets.push({title:"Schedules",scale:"NTS",inner:body,side:listSide([{a:"E",b:`Electrical ${tot.E.toFixed(1)} kW`,col:UT.E[0]},{a:"G",b:`Gas ${tot.G.toFixed(1)} kW`,col:UT.G[0]},{a:"W",b:`Water points ${tot.W}`,col:UT.W[0]},{a:"D",b:`Drain points ${tot.D}`,col:UT.D[0]},{a:"",b:`Room ${R.w} × ${R.d}, ceiling ${R.h}`},{a:"",b:`Floor area ${(R.w*R.d/1e6).toFixed(1)} m² (overall)`}],"TOTALS")});}
  return sheets.map((sh,i)=>sheetSVG(PW,PH,Object.assign({},meta,{title:sh.title,scale:sh.scale,sheet:`${i+1} / ${sheets.length}`}),sh.inner,sh.side));
}
async function exportPDF(){
  const btn=$("expPdf");btn.disabled=true;const old=btn.textContent;btn.textContent="Building PDF…";
  try{
    if(!window.jspdf){await loadScript("jspdf-src","https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");await loadScript("svg2pdf-src","https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.4/dist/svg2pdf.umd.min.js");}
    const fmt=$("pdfPaper").value,PW=fmt==="a4"?297:420,PH=fmt==="a4"?210:297;
    const keepSel=sel,kFS=FS,kFM=FM;sel=null;C=Object.assign({},LIGHT);FS="helvetica";FM="courier";let svgs;
    try{svgs=buildSheets(PW,PH,{project:$("pdfProject").value.trim()||"Kitchen layout",by:$("pdfBy").value.trim(),date:new Date().toISOString().slice(0,10),paper:fmt.toUpperCase()+" landscape"});}
    finally{sel=keepSel;FS=kFS;FM=kFM;readColours();}
    const doc=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:fmt,compress:true});
    const holder=document.createElement("div");holder.style.cssText="position:fixed;left:-99999px;top:0;width:10px;height:10px;overflow:hidden";document.body.appendChild(holder);
    for(let i=0;i<svgs.length;i++){holder.innerHTML=svgs[i];if(i)doc.addPage(fmt,"landscape");await doc.svg(holder.firstElementChild,{x:0,y:0,width:PW,height:PH});}
    holder.remove();try{localStorage.setItem("ks.pdfmeta",JSON.stringify({p:$("pdfProject").value,b:$("pdfBy").value,f:fmt}));}catch(_){}
    await save("kitchen-drawings.pdf",doc.output("arraybuffer"));
  }catch(e){console.error(e);toast(/load/.test(String(e&&e.message))?"The PDF tools couldn't load. Check your connection and try again.":"The PDF couldn't be built. Try the SVG export instead.");}
  btn.disabled=false;btn.textContent=old;
}
$("expPdf").addEventListener("click",exportPDF);
try{const pm=JSON.parse(localStorage.getItem("ks.pdfmeta")||"null");if(pm){$("pdfProject").value=pm.p||"";$("pdfBy").value=pm.b||"";if(pm.f)$("pdfPaper").value=pm.f;}}catch(_){}

/* ---------- tabs, view, room ---------- */
/* ---------- panel / bottom sheet ---------- */
const phone=()=>window.innerWidth<1000||document.documentElement.dataset.layout==="phone";
const hudPad=()=>{const v=getComputedStyle($("stage")).getPropertyValue("--hudpad");const n=parseFloat(v);return isNaN(n)?0:n;};
let panelState="peek";
let padT=null;
function setPanel(s){panelState=s;const p=$("panel");p.classList.toggle("half",s==="half");p.classList.toggle("full",s==="full");
  const st=$("stage");if(phone()){const base=64+(parseFloat(getComputedStyle(st).getPropertyValue("--sab"))||0);const pad=s==="half"?Math.round(p.offsetHeight*.54):s==="full"?Math.round(p.offsetHeight):base;st.style.setProperty("--hudpad",pad+"px");}else st.style.removeProperty("--hudpad");
  clearTimeout(padT);padT=setTimeout(()=>{if(view!=="3d")render();else if(threeReady)KS3D.resize();},300);}
function revealCanvas(){if(phone())setPanel("peek");}
let curTab="eq";
function setTab(t,opts){for(const k of ["room","eq","ss","new","ai","sch"]){$("p-"+k).hidden=k!==t;$("t-"+k).setAttribute("aria-selected",k===t||(t==="new"&&k==="eq"));}
  if(t==="sch")renderSchedule();curTab=t;$("pbody").scrollTop=0;try{localStorage.setItem("ks.tab",t==="new"?"eq":t);}catch(_){}
  if(phone()&&!(opts&&opts.quiet)&&panelState==="peek")setPanel("half");}
document.querySelector(".tabs").addEventListener("click",e=>{const t=e.target.closest("[data-tab]");if(!t)return;const k=t.dataset.tab;
  if(phone()&&k===curTab&&panelState!=="peek"){setPanel("peek");return;}setTab(k);});
$("goNewBtn").addEventListener("click",()=>{setTab("new");});
window.KS_ui={setPanel,setTab,setView,setTheme,fitToRoom:a=>{const r=fitToRoom(a||1200);changed();showTrim();return r;},deselect:()=>{sel=null;render();}};
$("backToEq").addEventListener("click",()=>setTab("eq"));
$("fabAdd").addEventListener("click",()=>{setTab("eq");if(phone())setPanel("half");setTimeout(()=>$("q").focus({preventScroll:true}),350);});
(function(){const g=$("grab");let y0=null,s0=null;
  g.addEventListener("pointerdown",e=>{y0=e.clientY;s0=panelState;try{g.setPointerCapture(e.pointerId);}catch(_){}});
  g.addEventListener("pointerup",e=>{if(y0===null)return;const dy=e.clientY-y0;y0=null;
    if(Math.abs(dy)<8){setPanel(s0==="full"?"half":s0==="half"?"full":"half");return;}
    if(dy>40)setPanel(s0==="full"?"half":"peek");else if(dy<-40)setPanel(s0==="peek"?"half":"full");});
  g.addEventListener("pointercancel",()=>{y0=null;});
  const body=$("pbody");let ty=null;
  body.addEventListener("touchstart",e=>{ty=body.scrollTop<=0?e.touches[0].clientY:null;},{passive:true});
  body.addEventListener("touchmove",e=>{if(ty===null||!phone())return;if(e.touches[0].clientY-ty>70&&body.scrollTop<=0){ty=null;setPanel(panelState==="full"?"half":"peek");}},{passive:true});
})();
function setTheme(t){t=t==="light"||t==="dark"?t:"system";const de=document.documentElement;if(t==="system")de.removeAttribute("data-theme");else de.setAttribute("data-theme",t);
  try{if(t==="system")localStorage.removeItem("ks.theme");else localStorage.setItem("ks.theme",t);}catch(_){}
  $("themeSeg").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.theme===t)));}
$("themeSeg").addEventListener("click",e=>{const b=e.target.closest("button[data-theme]");if(!b)return;setTheme(b.dataset.theme);e.stopPropagation();});
setTheme(document.documentElement.getAttribute("data-theme")||"system");
$("menuBtn").addEventListener("click",e=>{const m=$("menu");m.hidden=!m.hidden;$("menuBtn").setAttribute("aria-expanded",!m.hidden);e.stopPropagation();});
document.addEventListener("click",e=>{if(!e.target.closest("#menu")&&!e.target.closest("#menuBtn")){$("menu").hidden=true;$("menuBtn").setAttribute("aria-expanded","false");}});
$("menu").addEventListener("click",e=>{if(e.target.closest("button")&&e.target.id!=="clearAll")$("menu").hidden=true;});
function setView(v){view=v;$("vPlan").setAttribute("aria-pressed",v==="plan");$("vElev").setAttribute("aria-pressed",v==="elev");$("v3dBtn").setAttribute("aria-pressed",v==="3d");$("wallFld").hidden=v!=="elev";
  if(v!=="3d"&&threeReady)setWalk(false);render();}
function setWalk(on){KS3D.setMode(on?"walk":"orbit");$("walkBtn").setAttribute("aria-pressed",on);$("walkBtn").textContent=on?"Exit walkthrough":"Walk through";$("joy").hidden=!on;
  $("hint3d").textContent=on?"Left stick (or W A S D) to walk, drag the view to look around. Eye height 1.62 m; floor units block your way.":"Drag to orbit, pinch or scroll to zoom, two fingers (or Shift-drag) to pan. Tap an item to select it.";}
$("v3dBtn").addEventListener("click",()=>setView("3d"));
$("walkBtn").addEventListener("click",()=>setWalk(KS3D.mode!=="walk"));
$("reset3d").addEventListener("click",()=>{setWalk(false);KS3D.resetOrbit();KS3D.draw();});
$("vPlan").addEventListener("click",()=>setView("plan"));$("vElev").addEventListener("click",()=>setView("elev"));
$("wallSel").addEventListener("change",e=>{wall=e.target.value;render();});
$("zIn").addEventListener("click",()=>{if(view==="3d"){KS3D.zoom(.8);return;}zoom=Math.min(4,zoom*1.4);render();});
$("zOut").addEventListener("click",()=>{if(view==="3d"){KS3D.zoom(1.25);return;}zoom=Math.max(1,zoom/1.4);render();});
function roomInputs(){$("roomW").value=state.room.w;$("roomD").value=state.room.d;$("roomH").value=state.room.h;}
for(const [id,k,lo,hi] of [["roomW","w",2000,40000],["roomD","d",2000,40000],["roomH","h",2200,6000]])
  $(id).addEventListener("change",e=>{const v=Math.round(+e.target.value);if(!(v>=lo&&v<=hi)){toast(`Enter a value between ${lo} and ${hi} mm.`);roomInputs();return;}state.room[k]=v;state.items.forEach(i=>{if(i.archType==="column")i.h=state.room.h;clamp(i);});changed();});
let clearArmed=0;
$("clearAll").addEventListener("click",()=>{const b=$("clearAll");
  if(Date.now()-clearArmed<4000){state.items=state.items.filter(i=>i.kind==="arch");sel=null;b.textContent="Clear layout";clearArmed=0;changed();toast("Layout cleared.");}
  else{clearArmed=Date.now();b.textContent="Tap again to clear";setTimeout(()=>{if(clearArmed&&Date.now()-clearArmed>=3900){b.textContent="Clear layout";clearArmed=0;}},4000);}});
let toastT;function toast(m){const t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3200);}

/* ---------- persistence ---------- */
let saveT=null,saving=false,again=false;
function changed(){dirty=true;isExample=false;render();$("saveState").textContent="Saving…";clearTimeout(saveT);saveT=setTimeout(persist,1200);}
function currentPayload(){return JSON.parse(JSON.stringify({v:1,name:projName||undefined,room:state.room,items:state.items,under:underData(),at:Date.now()}));}
const projTitle=()=>projName||"Untitled kitchen";
function saveLabel(where){$("saveState").textContent=be&&(curId||sharedFrom||!isExample)?`${projTitle()} · ${where}`:where;}
async function persist(){
  if(saving){again=true;return;}saving=true;
  const payload=currentPayload();
  let where="";
  try{localStorage.setItem("ks.project",JSON.stringify(payload));localStorage.setItem("ks.curId",curId||"");where="Saved on this device";}catch(_){}
  if(db){try{let cloud=payload;if(JSON.stringify(payload).length>230000){cloud=JSON.parse(JSON.stringify(payload));if(cloud.under)cloud.under.src=null;}await db.doc("projects/main").set(cloud);where=cloud===payload?"Saved":"Saved (plan image kept on this device only)";}catch(_){}}
  if(be&&be.user()&&curId){try{const r=await be.saveProject(curId,payload,projName||undefined);where=r.stripped?"Saved online (plan image kept on this device only)":"Saved online";}catch(_){where="Saved on this device, not online";}}
  else if(be&&be.user()&&!curId)where="Saved on this device · not yet in My kitchens";
  else if(be&&!be.user())where="Saved on this device · sign in to save online";
  saveLabel(where||"Not saved (storage unavailable)");
  saving=false;if(again){again=false;persist();}
}
function saveCustomLocal(){try{localStorage.setItem("ks.custom",JSON.stringify(custom));}catch(_){}}
function underData(){return under?{src:under.src,pw:under.pw,ph:under.ph,mmpp:under.mmpp,x:under.x,y:under.y,op:under.op,show:under.show}:null;}
function blobUrl(u){try{const b=atob(u.src.split(",")[1]),arr=new Uint8Array(b.length);for(let i=0;i<b.length;i++)arr[i]=b.charCodeAt(i);const url=URL.createObjectURL(new Blob([arr],{type:"image/jpeg"})),im=new Image();im.onload=()=>{if(under===u){u.url=url;render();}};im.src=url;}catch(_){}}
function adopt(p){if(!p||!p.room||!Array.isArray(p.items))return false;state={room:{w:+p.room.w||9000,d:+p.room.d||6000,h:+p.room.h||3000},items:p.items.filter(i=>i&&i.w>0&&i.d>0)};
  if(typeof p.name==="string")projName=p.name.slice(0,80);
  if(Array.isArray(p.room.poly)&&p.room.poly.length>2)state.room.poly=p.room.poly.map(q=>[+q[0],+q[1]]);
  if(p.under&&p.under.src){under=Object.assign({},p.under);blobUrl(under);}else if(!p.under)under=null;mode=null;fpUI();isExample=false;sel=null;roomInputs();render();return true;}

function example(){
  const find=(b,m)=>BASE.find(e=>e.brand===b&&e.model===m);
  const put=(spec,x,y,rot=0)=>state.items.push(Object.assign({id:newId(),kind:"eq",rot},JSON.parse(JSON.stringify(spec)),{x,y}));
  const ss=(k,w,x,y,opts=[],extra={})=>{const t=SS[k];state.items.push(Object.assign({id:newId(),kind:"ss",ssType:k,brand:"Fabricated",model:t.n,name:t.n,cat:"Stainless",w,d:t.d,h:t.h,mount:t.mount,z:t.z,power:"none",kw:null,elec:null,water:!!t.water,drain:!!t.drain,opts,mat:"AISI 304, 1.2 mm",conf:"user",x,y,rot:0},extra));};
  put(find("Foster","EcoPro G3 EP1440H"),0,0);
  ss("table",1200,1450,0,["Undershelf","Upstand 100 mm"]);
  put(find("Rational","iCombi Pro 10-1/1 E"),1600,0);
  put(find("Electrolux Professional","900XP 391006"),2700,0);
  put(find("Electrolux Professional","900XP 391267"),3500,0);
  put(find("Electrolux Professional","900XP 391079"),4300,0);
  put(find("Electrolux Professional","900XP 391079"),4700,0);
  ss("hood",2800,2550,0,["Baffle filters","Lights"],{d:1200});
  put(find("Foster","EcoPro G3 EP1/3H"),5150,0);
  put(find("Robot Coupe","R 301 Ultra"),5300,150);
  ss("sink2",1500,7000,0,["Upstand 100 mm"]);
  ss("hand",400,8600,0);
  ss("table",2400,2700,2300,["Undershelf"]);
  ss("gantry",1800,3000,2300,["Heat lamps"]);
  ss("landing",1200,7800,4000,["Pre-rinse sink"],{rot:90});
  put(find("Winterhalter","PT-M"),8250,3350,270);
  ss("rack",1200,0,5500);
  put(find("Hoshizaki","IM-45CNE-HC"),1300,5450,180);
  state.items.forEach(clamp);
}

/* ---------- accounts, my kitchens, share links (website build; needs window.KS_backend) ---------- */
const dlg=$("dlg");
function openDlg(title,html){$("dlgTitle").textContent=title;$("dlgBody").innerHTML=html;if(!dlg.open){try{dlg.showModal();}catch(_){dlg.setAttribute("open","");}}}
function closeDlg(){if(dlg.open)dlg.close();else dlg.removeAttribute("open");}
$("dlgClose").addEventListener("click",closeDlg);dlg.addEventListener("click",e=>{if(e.target===dlg)closeDlg();});
function askText(title,value,label){return new Promise(res=>{openDlg(title,`<div class="fld"><label for="askIn">${esc(label||"Name")}</label><input id="askIn" type="text" maxlength="80" autocomplete="off"></div><div class="bar"><button class="btn pri" id="askOk">Save</button><button class="btn" id="askNo">Cancel</button></div>`);
  const inp=$("askIn");inp.value=value||"";setTimeout(()=>{inp.focus();inp.select();},50);
  const done=v=>{closeDlg();res(v);};$("askOk").onclick=()=>done(inp.value.trim());$("askNo").onclick=()=>done(null);inp.onkeydown=e=>{if(e.key==="Enter")done(inp.value.trim());};});}
function fmtWhen(iso){try{const d=new Date(iso),diff=(Date.now()-d)/864e5;return diff<1?d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}):diff<7?d.toLocaleDateString(undefined,{weekday:"short"}):d.toLocaleDateString(undefined,{day:"numeric",month:"short"});}catch(_){return "";}}
function acctUI(){const u=be&&be.user();$("kitchensBtn").hidden=!be;$("mKitchens").hidden=!be;$("mShare").hidden=!u;$("mSignIn").hidden=!be||!!u;$("acctSep").hidden=!be;
  const row=$("acctRow");row.hidden=!u;if(u){row.innerHTML=`<span>${esc(u.email||"Signed in")}</span> · <button id="mSignOut" style="font:inherit;color:var(--accent)">Sign out</button>`;$("mSignOut").onclick=async e=>{e.stopPropagation();await be.signOut();};}}
function openSignIn(note){openDlg("Sign in",`<p>${esc(note||"Save your kitchens online, open them on any device and share a link with your contractor.")}</p>
  <div class="fld"><label for="siEmail">Email</label><input id="siEmail" type="email" autocomplete="email" inputmode="email" placeholder="you@restaurant.com"></div>
  <div class="bar"><button class="btn pri" id="siSend">Email me a sign-in link</button><button class="btn" id="siGoogle">Continue with Google</button></div><p class="note" id="siMsg">No password. The link signs you in on this device.</p>`);
  $("siSend").onclick=async()=>{const em=$("siEmail").value.trim();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){$("siMsg").textContent="Enter a valid email address.";return;}$("siSend").disabled=true;
    try{await be.signInEmail(em);$("siMsg").textContent=`Link sent to ${em}. Open it on this device; this page will sign in by itself.`;}catch(e){$("siMsg").textContent="Couldn't send the link: "+(e.message||"try again.");$("siSend").disabled=false;}};
  $("siGoogle").onclick=async()=>{try{await be.signInGoogle();}catch(e){$("siMsg").textContent="Google sign-in didn't start: "+(e.message||"try again.");}};
  if(be.providers)be.providers().then(list=>{if(!list.includes("google")&&$("siGoogle"))$("siGoogle").hidden=true;});
  setTimeout(()=>$("siEmail").focus(),50);}
$("mSignIn").addEventListener("click",()=>openSignIn());
$("kitchensBtn").addEventListener("click",()=>{if(!be.user())openSignIn();else openKitchens();});
$("mKitchens").addEventListener("click",()=>{if(!be.user())openSignIn();else openKitchens();});
$("mShare").addEventListener("click",()=>shareCurrent());
async function openKitchens(){
  openDlg("My kitchens",`<p>Loading…</p>`);
  try{projList=await be.listProjects();}catch(e){$("dlgBody").innerHTML=`<p>Couldn't load your kitchens: ${esc(e.message||"try again")}.</p>`;return;}
  const ic={pen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/></svg>',
    link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    bin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>'};
  const rows=projList.map(p=>`<div class="krow" data-id="${esc(p.id)}" aria-current="${p.id===curId}"><div style="flex:1;min-width:0"><div class="kname">${esc(p.name||"Untitled kitchen")}</div><div class="kmeta">${esc(p.summary||"")}${p.is_public?" · shared":""} · ${esc(fmtWhen(p.updated_at))}</div></div>
    <div class="kacts"><button data-act="rename" title="Rename">${ic.pen}</button><button data-act="share" title="Share">${ic.link}</button><button data-act="del" title="Delete">${ic.bin}</button></div></div>`).join("");
  $("dlgBody").innerHTML=`<div class="bar"><button class="btn pri" id="kNew">New kitchen</button>${!curId?`<button class="btn" id="kSaveCopy">Save this kitchen to my list</button>`:""}</div><div class="klist">${rows||'<p>No saved kitchens yet.</p>'}</div>`;
  $("kNew").onclick=()=>newKitchen();if($("kSaveCopy"))$("kSaveCopy").onclick=()=>saveAsNew();
  $("dlgBody").querySelector(".klist").addEventListener("click",async e=>{const row=e.target.closest(".krow");if(!row)return;const id=row.dataset.id,p=projList.find(x=>x.id===id),act=(e.target.closest("[data-act]")||{}).dataset;
    if(act&&act.act==="rename"){e.stopPropagation();const n=await askText("Rename kitchen",p.name,"Kitchen name");if(n){await be.renameProject(id,n).catch(()=>toast("Rename didn't save."));if(id===curId){projName=n;syncPdfName();saveLabel("Saved online");}openKitchens();}return;}
    if(act&&act.act==="share"){e.stopPropagation();shareDialog(id,p.name);return;}
    if(act&&act.act==="del"){e.stopPropagation();const b=e.target.closest("button");if(b.dataset.armed){await be.deleteProject(id).catch(()=>toast("Delete didn't go through."));if(id===curId){curId=null;localStorage.setItem("ks.curId","");}openKitchens();}else{b.dataset.armed="1";b.style.color="var(--bad)";b.title="Tap again to delete";toast(`Tap the bin again to delete “${p.name}”.`);setTimeout(()=>{delete b.dataset.armed;b.style.color="";},4000);}return;}
    openProject(id);});
}
function syncPdfName(){const f=$("pdfProject");if(f&&projName&&!f.value)f.value=projName;}
async function openProject(id){if(id===curId){closeDlg();return;}
  if(curId&&dirty)await persist();
  try{const row=await be.loadProject(id);if(!row||!adopt(row.data))throw new Error("empty");curId=id;projName=row.name||projName;sharedFrom=null;$("banner").hidden=true;localStorage.setItem("ks.curId",curId);persist();closeDlg();toast(`Opened “${projTitle()}”.`);syncPdfName();revealCanvas();}
  catch(e){toast("Couldn't open that kitchen.");}}
async function newKitchen(){if(curId&&dirty)await persist();
  const n=await askText("New kitchen","","Kitchen name");if(n===null)return;
  state={room:{w:9000,d:6000,h:3000},items:[]};under=null;mode=null;fpUI();sel=null;projName=n||"Untitled kitchen";sharedFrom=null;$("banner").hidden=true;roomInputs();render();
  try{const r=await be.createProject(projName,currentPayload());curId=r.id;localStorage.setItem("ks.curId",curId);saveLabel("Saved online");closeDlg();toast(`“${projTitle()}” created. Set the room size, then add equipment.`);setTab("room");}
  catch(e){curId=null;toast("Couldn't create it online; it's saved on this device.");closeDlg();}}
async function saveAsNew(){const n=await askText("Save to my kitchens",projName||"","Kitchen name");if(n===null)return;projName=n||"Untitled kitchen";
  try{const r=await be.createProject(projName,currentPayload());curId=r.id;sharedFrom=null;$("banner").hidden=true;localStorage.setItem("ks.curId",curId);saveLabel("Saved online");closeDlg();toast(`Saved “${projTitle()}” to your kitchens.`);}catch(e){toast("Couldn't save online. It stays on this device.");}}
async function shareCurrent(){if(!be.user()){openSignIn("Sign in to share a link to this kitchen.");return;}if(!curId){openDlg("Share link",`<p>Save this kitchen to your list first, then share it.</p><div class="bar"><button class="btn pri" id="shSave">Save to my kitchens</button></div>`);$("shSave").onclick=()=>saveAsNew();return;}shareDialog(curId,projName);}
async function shareDialog(id,name){openDlg("Share link",`<p>Turning on the link…</p>`);
  try{const pid=await be.setPublic(id,true),url=be.shareUrl(pid);
    $("dlgBody").innerHTML=`<p>Anyone with this link can open a read-only copy of “${esc(name||"this kitchen")}”: plan, elevations, 3D and the schedule. They can't change your version.</p>
      <div class="share-url"><input id="shUrl" type="text" readonly value="${esc(url)}"><button class="btn pri" id="shCopy">Copy</button></div>
      <div class="bar"><button class="btn" id="shOpen">Open</button><button class="btn danger" id="shOff">Stop sharing</button></div><p class="note" id="shMsg"></p>`;
    $("shCopy").onclick=async()=>{try{await navigator.clipboard.writeText(url);$("shMsg").textContent="Copied.";}catch(_){$("shUrl").select();$("shMsg").textContent="Select the link and copy it.";}};
    $("shOpen").onclick=()=>window.open(url,"_blank");
    $("shOff").onclick=async()=>{await be.setPublic(id,false).catch(()=>{});$("shMsg").textContent="Link turned off. Anyone opening it now sees nothing.";$("shOff").disabled=true;};
  }catch(e){$("dlgBody").innerHTML=`<p>Couldn't create the link: ${esc(e.message||"try again")}.</p>`;}}
function showBanner(html){const b=$("banner");b.innerHTML=html;b.hidden=false;}
async function loadSharedFromUrl(){const m=location.pathname.match(/\/k\/([A-Za-z0-9_-]{6,40})/)||[],pid=m[1]||new URLSearchParams(location.search).get("k");if(!pid)return false;
  try{const row=await be.loadShared(pid);if(!row||!adopt(row.data)){toast("That shared kitchen isn't available any more.");return false;}
    curId=null;sharedFrom=pid;projName=(row.name||"Shared kitchen");history.replaceState(null,"","/app/");
    showBanner(`<span>Shared kitchen <b>${esc(row.name||"")}</b>. You're looking at a copy; changes stay on this device.</span><button class="btn sm pri" id="bnSave">Save to my kitchens</button>`);
    $("bnSave").onclick=()=>{if(!be.user())openSignIn("Sign in to keep a copy of this kitchen in your account.");else saveAsNew();};
    saveLabel("Shared copy");return true;}
  catch(e){toast("Couldn't open the shared kitchen.");return false;}}
async function cloudSync(){acctUI();if(!be||!be.user())return;
  try{const remote=await be.listEquipment();const seen=new Set(remote.map(e=>e.cid));for(const c of custom)if(!seen.has(c.cid)){remote.push(c);be.saveEquipment(c).catch(()=>{});}
    custom=remote.filter(e=>e&&e.brand&&e.w>0).sort((a,b)=>(b.cid||"").localeCompare(a.cid||""));saveCustomLocal();renderResults();}catch(_){}
  if(sharedFrom)return;/* a shared copy is saved only when the user asks */
  try{const list=await be.listProjects();projList=list;let local=null;try{local=JSON.parse(localStorage.getItem("ks.project")||"null");}catch(_){}
    const localId=localStorage.getItem("ks.curId")||"";
    if(curId&&list.some(p=>p.id===curId)){const row=await be.loadProject(curId);
      if(row&&row.data&&!(local&&localId===curId&&(local.at||0)>(row.data.at||0))){adopt(row.data);projName=row.name||projName;}else persist();}
    else if(!list.length){const r=await be.createProject(projName||"My first kitchen",currentPayload());curId=r.id;projName=projName||"My first kitchen";}
    else if(!isExample&&local&&(local.items||[]).length){const r=await be.createProject(projName||"Untitled kitchen",currentPayload());curId=r.id;projName=projName||"Untitled kitchen";}
    else{const row=await be.loadProject(list[0].id);if(row&&adopt(row.data)){curId=row.id;projName=row.name||projName;}}
    localStorage.setItem("ks.curId",curId||"");saveLabel("Saved online");syncPdfName();}
  catch(e){saveLabel("Saved on this device, not online");}}

async function boot(){
  ssInit();renderChips();renderResults();
  let local=null;try{local=JSON.parse(localStorage.getItem("ks.project")||"null");custom=JSON.parse(localStorage.getItem("ks.custom")||"[]")||[];}catch(_){custom=[];}
  if(!adopt(local)){example();roomInputs();render();}else $("saveState").textContent="Saved on this device";
  renderResults();
  try{const t=localStorage.getItem("ks.tab");if(t&&$("p-"+t)&&t!=="new")setTab(t,{quiet:true});}catch(_){}
  let rt;window.addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(render,120);});
  try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",render);}catch(_){}
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(render);
  be=window.KS_backend||null;
  if(be){curId=localStorage.getItem("ks.curId")||null;if(curId==="")curId=null;
    sampleFn={json:(prompt,opts)=>be.ai(prompt,opts)};$("aiBriefBox").hidden=false;$("aiNoBrief").hidden=true;
    await be.ready;acctUI();
    const shared=await loadSharedFromUrl();
    if(!shared)await cloudSync();else if(be.user())cloudSync();
    if(!be.user()&&!shared)saveLabel(isExample?"Example layout · sign in to save online":"Saved on this device · sign in to save online");
    be.onAuth(async u=>{acctUI();if(u){closeDlg();toast(`Signed in as ${u.email||"you"}.`);await cloudSync();}else{curId=null;localStorage.setItem("ks.curId","");saveLabel("Saved on this device · sign in to save online");toast("Signed out. Your kitchen stays on this device.");}});
    return;}
  const use=window.claude&&window.claude.use?n=>window.claude.use(n).catch(()=>null):()=>Promise.resolve(null);
  use("sample").then(s=>{sampleFn=s;$("aiBriefBox").hidden=!s;$("aiNoBrief").hidden=!!s;if(!s){$("nLookup").hidden=true;}});
  use("downloads").then(d=>{downloads=d;});
  use("db").then(async d=>{
    if(!d)return;db=d;
    try{const snap=await db.doc("projects/main").get();
      if(snap.exists&&!dirty){const p=snap.data();if(!local||(p.at||0)>=(local.at||0)){if(adopt(p))$("saveState").textContent="Saved";}}
      else if(!snap.exists&&local&&!dirty){persist();}}catch(_){}
    try{const qs=await db.collection("equipment").get();const remote=qs.docs.map(x=>x.data()).filter(e=>e&&e.brand&&e.w>0);
      const seen=new Set(remote.map(e=>e.cid));for(const c of custom)if(!seen.has(c.cid)){remote.push(c);db.doc("equipment/"+c.cid).set(JSON.parse(JSON.stringify(c))).catch(()=>{});}
      custom=remote.sort((a,b)=>(b.cid||"").localeCompare(a.cid||""));saveCustomLocal();renderResults();}catch(_){}
  });
}
boot();
})();
