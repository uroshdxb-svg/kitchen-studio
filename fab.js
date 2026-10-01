/* Stainless fabrication: what a fabricator needs to build each item.
   KS_fab.typeOf(it)      fabrication type key (SS / SSR type) or null for branded equipment
   KS_fab.migrate(it)     older kitchens: "Fabricated" chillers placed as equipment get their type
   KS_fab.fields(it)      editable details for the item panel
   KS_fab.spec(it)        resolved details (defaults + the user's edits) and the spec rows for the drawing set
   KS_fab.card(it,s,P)    dimensioned plan / front / side views at paper scale s (paper mm per mm)
   Plain functions, no DOM: shared by the app, the drawing export and the tests. */
(function(root){
"use strict";
const REFR=["rcounter","rlowboy","rsaladf","rsaladr"];
const SS_TYPES=["table","cab","sink1","sink2","sink3","hand","landing","rack","trolley","wshelf","wcab","hood","gantry"];

function typeOf(it){
  if(!it)return null;
  if(it.kind==="ss")return it.ssType||null;
  if(it.ssType&&REFR.includes(it.ssType))return it.ssType;
  if(it.brand==="Fabricated"&&it.kind==="eq")return inferRefr(it);
  return null;
}
function inferRefr(it){const t=((it.name||"")+" "+(it.model||"")).toLowerCase();
  if(/saladette|salad/.test(t))return /raised|rail/.test(t)&&!/flush/.test(t)?"rsaladr":"rsaladf";
  if(/lowboy|low boy|chef base|drawer/.test(t))return "rlowboy";
  if(/counter|chiller|freezer|fridge/.test(t))return "rcounter";
  return null;}
function migrate(it){if(it&&it.kind==="eq"&&it.brand==="Fabricated"&&!it.ssType){const t=inferRefr(it);if(t)it.ssType=t;}return it;}
const isRefr=t=>REFR.includes(t);
const freezer=it=>/freezer/i.test((it.name||"")+" "+(it.model||"")+" "+(it.opts||[]).join(" "));
const has=(it,o)=>(it.opts||[]).includes(o);
const countIn=(it,re,def)=>{const m=((it.name||"")+" "+(it.model||"")).match(re);return m?+m[1]:def;};
const matOf=it=>it.mat||"AISI 304, 1.2 mm";
const gauge=it=>{const m=/(\d\.\d)\s*mm/.exec(matOf(it));return m?+m[1]:1.2;};
const grade=it=>(/AISI\s*\d+/.exec(matOf(it))||["AISI 304"])[0];

/* ---------- editable fields per type: [key,label,kind,options|unit] ---------- */
const F={
  upstand:["upstand","Back upstand","sel",["None","50 mm","100 mm","150 mm","300 mm splashback"]],
  edge:["edge","Front edge","sel",["Bullnose 40 mm","Square 40 mm","Marine (raised lip)"]],
  base:["base","Base","sel",["Open legs + undershelf","Open legs","Sliding doors","Hinged doors","Drawers"]],
  shelfH:["shelfH","Undershelf height","num","mm"],
  feet:["feet","Feet","sel",["Adjustable bullet feet","Castors, 2 braked","Plinth / kick"]],
  sides:["sides","Side upstands","sel",["None","Left","Right","Both"]],
  bowl:["bowl","Bowl W × D × depth","txt","mm"],
  drainer:["drainer","Drainer","sel",["None","Left","Right","Both"]],
  taps:["taps","Tap holes","sel",["1 per bowl","1 shared","None (wall tap)"]],
  temp:["temp","Temperature","txt","°C"],
  comp:["comp","Compressor","sel",["Left end","Right end","Remote"]],
  doors:["doors","Doors","num",""],
  drawers:["drawers","Drawers","num",""],
  gn:["gn","GN openings","txt",""],
  filters:["filters","Filters","txt",""],
  spigot:["spigot","Duct spigot","txt","mm"],
  tiers:["tiers","Tiers","num",""],
  lamps:["lamps","Heat lamps","num",""],
  brackets:["brackets","Brackets","txt",""],
  notes:["notes","Notes for the fabricator","area",""]
};
const FIELDS={
  table:["upstand","edge","base","shelfH","feet","sides"],cab:["upstand","edge","base","feet"],
  sink1:["bowl","drainer","taps","upstand","base","shelfH","feet"],sink2:["bowl","drainer","taps","upstand","base","shelfH","feet"],sink3:["bowl","drainer","taps","upstand","base","shelfH","feet"],
  hand:["bowl","upstand"],landing:["upstand","edge","base","shelfH","feet","sides"],
  rack:["tiers","feet"],trolley:["tiers"],wshelf:["tiers","brackets"],wcab:["doors"],
  hood:["filters","spigot"],gantry:["tiers","lamps"],
  rcounter:["temp","doors","comp","upstand","edge","feet"],rlowboy:["temp","drawers","comp","edge","feet"],
  rsaladf:["temp","gn","doors","comp","upstand","feet"],rsaladr:["temp","gn","doors","comp","upstand","feet"]
};
function fields(it){const t=typeOf(it);if(!t)return [];const d=defaults(it),v=Object.assign({},d,it.fab||{});
  return [...(FIELDS[t]||[]),"notes"].map(k=>{const [key,label,kind,o]=F[k];return {key,label,kind,options:Array.isArray(o)?o:null,unit:Array.isArray(o)?"":o,value:v[key]??""};});}

/* ---------- defaults from the type, size and options ---------- */
function bowlsOf(t){return t==="sink1"?1:t==="sink2"?2:t==="sink3"?3:t==="hand"?1:0;}
function defaults(it){
  const t=typeOf(it),w=it.w,d=it.d,o={};
  o.upstand=has(it,"Upstand 100 mm")?"100 mm":["sink1","sink2","sink3"].includes(t)?"100 mm":t==="hand"?"300 mm splashback":"None";
  o.edge=isRefr(t)&&t!=="rlowboy"?"Bullnose 40 mm":t==="rlowboy"?"Marine (raised lip)":"Bullnose 40 mm";
  o.base=t==="cab"?(has(it,"Hinged doors")?"Hinged doors":"Sliding doors"):has(it,"Drawer")?"Drawers":has(it,"Undershelf")||["sink1","sink2","sink3","landing"].includes(t)?"Open legs + undershelf":"Open legs";
  o.shelfH=200;o.feet=has(it,"Castors")?"Castors, 2 braked":"Adjustable bullet feet";o.sides="None";
  const nb=bowlsOf(t);
  if(t==="hand")o.bowl="300 × 250 × 150";
  else if(nb){const dr=has(it,"Left drainer")||has(it,"Right drainer")?450:0,bw=Math.max(300,Math.min(600,Math.floor(((w-dr-100-(nb-1)*60))/nb/10)*10)),bd=Math.max(300,Math.min(500,Math.floor((d-200)/10)*10));o.bowl=`${bw} × ${bd} × ${t==="sink3"?350:300}`;}
  o.drainer=has(it,"Left drainer")&&has(it,"Right drainer")?"Both":has(it,"Left drainer")?"Left":has(it,"Right drainer")?"Right":"None";
  o.taps=t==="sink3"?"1 shared":"1 per bowl";
  o.temp=freezer(it)?"-18 to -22":"+1 to +4";o.comp="Left end";
  o.doors=t==="rcounter"?countIn(it,/(\d+)\s*doors?/i,Math.max(1,Math.round((w-450)/600))):t==="wcab"?(w>900?2:1):Math.max(1,Math.round((w-450)/600));
  o.drawers=countIn(it,/(\d+)\s*drawers?/i,4);
  const gnN=Math.max(2,Math.floor((w-120)/176*(d>=700?1:1))),rows=d>=800?2:1;o.gn=`${gnN*rows} × GN1/3, 150 deep`;
  o.filters=`${Math.max(1,Math.floor((w-100)/500))} × baffle 500 × 500`;o.spigot=w>2400?"2 × 400 × 300":"400 × 300";
  o.tiers=t==="rack"?4:t==="trolley"?Math.max(5,Math.floor((it.h-250)/80)):has(it,"Double tier")?2:1;o.lamps=has(it,"Heat lamps")?Math.max(1,Math.round(w/600)):0;
  o.brackets=`every ${w>1800?"900":"max. 1000"} mm, 1.5 mm`;o.notes="";
  return o;}
function resolved(it){return Object.assign(defaults(it),it.fab||{});}
const mmOf=s=>{const m=/(\d+)/.exec(String(s||""));return m?+m[1]:0;};
const triple=s=>{const m=String(s||"").match(/\d+/g)||[];return m.map(Number);};

/* ---------- spec rows for the drawing set ---------- */
const LABEL={table:"Work table",cab:"Cabinet table",sink1:"Sink unit",sink2:"Sink unit",sink3:"Pot wash sink",hand:"Hand wash basin",landing:"Dishwasher landing table",rack:"Storage rack",trolley:"GN trolley",wshelf:"Wall shelf",wcab:"Wall cabinet",hood:"Exhaust hood",gantry:"Pass shelf / gantry",rcounter:"Refrigerated counter",rlowboy:"Refrigerated lowboy",rsaladf:"Saladette, flush GN top",rsaladr:"Saladette, raised GN rail"};
function spec(it){
  const t=typeOf(it),v=resolved(it),g=gauge(it),rows=[];if(!t)return {type:null,rows};
  const R=(a,b)=>rows.push([a,b]);
  R("Overall",`${it.w} W × ${it.d} D × ${it.h} H mm`+(it.mount==="over"?`, underside at ${it.z??""} mm AFF`:""));
  R("Material",`${grade(it)} stainless, ${g} mm${t==="rack"||t==="trolley"?" frame":" top"}${["table","landing","sink1","sink2","sink3","cab","gantry"].includes(t)||isRefr(t)?", 1.0 mm panels":""}`);
  R("Finish","Satin No. 4 brushed, grain along the length, protective film on");
  const topped=["table","cab","sink1","sink2","sink3","landing"].includes(t)||isRefr(t);
  if(topped){
    R("Top",`${g} mm, ${v.edge.toLowerCase()} front and sides, sound-deadened, reinforced underneath with 30 × 30 channel every 600 mm, worktop at ${it.h} mm`);
    R("Upstand",v.upstand==="None"?"None":`${v.upstand} at back, coved 12 mm radius into the top${v.sides&&v.sides!=="None"?`; side upstand ${v.sides.toLowerCase()}`:""}`);}
  if(["table","landing","sink1","sink2","sink3"].includes(t)){
    R("Base",v.base==="Open legs + undershelf"?`41 mm Ø × 1.5 mm tube legs, cross-braced, undershelf ${g} mm with 40 mm turned-down edge at ${mmOf(v.shelfH)} mm AFF`:v.base==="Drawers"?"41 mm Ø tube legs; drawer 500 W on telescopic runners under the top":v.base);
    R("Feet",v.feet==="Adjustable bullet feet"?"Stainless bullet feet, ±25 mm adjustment":v.feet);}
  if(t==="cab"){R("Base",`Closed cabinet, ${v.base.toLowerCase()} (double-skinned), removable mid shelf, 1.0 mm body`);R("Feet",v.feet==="Adjustable bullet feet"?"150 mm stainless legs, ±25 mm adjustment":v.feet);}
  if(["sink1","sink2","sink3","hand"].includes(t)){const [bw,bd,bh]=triple(v.bowl);const nb=bowlsOf(t);
    R("Bowls",`${nb} × ${bw} × ${bd} × ${bh} deep, pressed/welded 1.2 mm, 20 mm radius corners, falls to waste`);
    if(t!=="hand"){R("Drainer",v.drainer==="None"?"None":`${v.drainer}, ribbed, falling to bowl`);R("Waste",`${nb} × 1½ in basket waste with overflow, P-trap by plumber`);R("Tap holes",v.taps);}
    else R("Valve","Knee-operated valve with spout, hot and cold, 1¼ in waste; wall-fixing bracket");}
  if(t==="landing")R("Landing",`${has(it,"Pre-rinse sink")?"Pre-rinse bowl 400 × 400 × 250 with spray arm; ":""}${has(it,"Rack slide")?"Rack slide 500 wide; ":""}raised edges 40 mm, falls to the machine`);
  if(isRefr(t)){
    R("Refrigeration",`${v.temp} °C, R290 monoblock, ${v.comp.toLowerCase()} compressor housing with louvred removable panel, fan-assisted, auto defrost, digital controller`);
    R("Insulation","60 mm CFC-free polyurethane, magnetic gaskets, ABS inner liner or 304 interior");
    if(t==="rlowboy")R("Drawers",`${mmOf(v.drawers)} drawers (sections of 2), each taking GN1/1 × 150, telescopic runners; top rated for countertop cooking equipment, 1.5 mm, insulated from heat`);
    else R("Doors",`${mmOf(v.doors)} hinged door${mmOf(v.doors)>1?"s":""}, self-closing, recessed handles, 1 GN2/1 shelf each`);
    if(t==="rsaladf")R("GN top",`${v.gn} pans set flush in the worktop, sliding stainless lid in the same plane, pan supports included`);
    if(t==="rsaladr")R("GN rail",`${v.gn} pans in a refrigerated rail at the back, hinged lid; cutting board 25 mm in front`);
    R("Feet",v.feet==="Adjustable bullet feet"?"150 mm stainless legs, ±25 mm adjustment":v.feet);
    R("Electrical",`${it.elec||"230V 1N 50Hz"}${it.kw?`, ${it.kw} kW`:""}, plug or fused spur by electrician`);}
  if(t==="rack")R("Shelves",`${mmOf(v.tiers)} tiers, ${has(it,"Perforated shelves")?"perforated":"solid"} 1.0 mm shelves on 30 × 30 posts, adjustable pitch 50 mm`);
  if(t==="trolley")R("Runners",`${mmOf(v.tiers)} pairs of GN1/1 runners at 80 mm pitch, 4 × 100 mm castors, 2 braked`);
  if(t==="wshelf")R("Shelf",`${mmOf(v.tiers)} tier${mmOf(v.tiers)>1?"s":""}, 40 mm turned-down front edge, back upturn 40 mm; brackets ${v.brackets}, fixed to masonry`);
  if(t==="wcab")R("Cabinet",`${mmOf(v.doors)} ${has(it,"Hinged doors")?"hinged":"sliding"} door${mmOf(v.doors)>1?"s":""}, one mid shelf, sloped top 15°, wall-fixing rail`);
  if(t==="hood"){R("Hood",`Box canopy, ${g} mm, welded seams, perimeter grease gutter with drain tap`);R("Filters",`${v.filters}, stainless, removable`);R("Duct",`Spigot ${v.spigot} on top, position to suit duct route`);R("Extras",[has(it,"Lights")&&"sealed LED lights",has(it,"Fresh-air plenum")&&"front fresh-air plenum","overhang 150-300 mm past the cooking line"].filter(Boolean).join(", "));}
  if(t==="gantry")R("Gantry",`${mmOf(v.tiers)} tier${mmOf(v.tiers)>1?"s":""} on 41 mm posts fixed through the counter top${mmOf(v.lamps)?`, ${mmOf(v.lamps)} heat lamps with switch`:""}${has(it,"Ticket rail")?", ticket rail":""}`);
  R("Welding","TIG welded, ground and polished, no exposed screws on food surfaces");
  if(v.notes)R("Notes",v.notes);
  return {type:t,label:LABEL[t]||it.name,rows,v};}

/* ---------- drawing: plan, front and side views with dimensions ---------- */
/* returns {w,h,body} in paper mm; s = paper mm per real mm; P = colours */
function card(it,s,P,opts={}){
  const t=typeOf(it),v=resolved(it),W=it.w,D=it.d,H=it.h,over=it.mount==="over",g=12;
  const up=t==="hand"?0:Math.min(300,mmOf(v.upstand)),dm=8,fs=2.2;  /* dimension gap and text size, paper mm */
  const topped=["table","cab","sink1","sink2","sink3","landing"].includes(t)||isRefr(t);
  const tiers=Math.max(1,mmOf(v.tiers)),viewH=t==="wshelf"?H+250+350*(tiers-1):t==="hand"?H+300:t==="hood"?H+150:t==="rsaladr"?H+220+up:over?H:(H+up);
  const ox=dm+4,oy=4+dm;                   /* plan origin */
  const fy=oy+D*s+g+ (up?0:0);              /* front view top */
  const sx=ox+W*s+g+dm;                     /* side view left */
  let b="";const ln=(x1,y1,x2,y2,w=.25,dash)=>`<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${P.ink}" stroke-width="${w}"${dash?` stroke-dasharray="${dash}"`:""} fill="none"/>`;
  const rc=(x,y,w,h,sw=.3,fill="none",dash,rx=0)=>`<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="${Math.max(0,h)}" rx="${rx}" fill="${fill}" stroke="${P.ink}" stroke-width="${sw}"${dash?` stroke-dasharray="${dash}"`:""}/>`;
  const tx=(x,y,str,a="middle",col=P.dim,sz=fs,rot)=>`<text x="${x}" y="${y}" text-anchor="${a}" font-family="helvetica" font-size="${sz}" fill="${col}"${rot?` transform="rotate(${rot} ${x} ${y})"`:""}>${str}</text>`;
  /* dimension: horizontal (y fixed) or vertical (x fixed) */
  const dimH=(x1,x2,y,val,off=0)=>{const yy=y+off;return `<g stroke="${P.dim}" stroke-width=".18"><path d="M${x1} ${yy}H${x2}"/><path d="M${x1} ${yy-1.2}V${yy+1.2}M${x2} ${yy-1.2}V${yy+1.2}"/><path d="M${x1-.8} ${yy+.8}L${x1+.8} ${yy-.8}M${x2-.8} ${yy+.8}L${x2+.8} ${yy-.8}"/></g>`+tx((x1+x2)/2,yy-.9,val);};
  const dimV=(y1,y2,x,val)=>`<g stroke="${P.dim}" stroke-width=".18"><path d="M${x} ${y1}V${y2}"/><path d="M${x-1.2} ${y1}H${x+1.2}M${x-1.2} ${y2}H${x+1.2}"/><path d="M${x-.8} ${y1+.8}L${x+.8} ${y1-.8}M${x-.8} ${y2+.8}L${x+.8} ${y2-.8}"/></g>`+tx(x-1,(y1+y2)/2,val,"middle",P.dim,fs,-90);
  const fill=P.steel;

  /* ---- PLAN (back at top) ---- */
  const px=ox,py=oy;
  b+=tx(px,py-dm+1.5,"PLAN","start",P.ink,2.4);
  b+=rc(px,py,W*s,D*s,.35,over?"none":fill,over?"1.5 .8":null);
  if(up&&topped)b+=ln(px,py+Math.max(20,12)*s+.4,px+W*s,py+Math.max(20,12)*s+.4,.18);
  const nb=bowlsOf(t);let bowlXs=[];
  if(nb){const [bw,bd]=triple(v.bowl);const gap=60,tot=nb*bw+(nb-1)*gap,dr=t==="hand"?0:(v.drainer==="Left"||v.drainer==="Right"?Math.min(500,W-tot-100):v.drainer==="Both"?Math.min(450,(W-tot-100)/2):0);
    let x0=v.drainer==="Left"?W-50-tot:v.drainer==="Right"?50:(W-tot)/2;if(v.drainer==="Both")x0=(W-tot)/2;
    const by=t==="hand"?Math.max(40,(D-bd)/2):Math.max(80,Math.min(D-bd-60,D-bd-90));
    for(let i=0;i<nb;i++){const bx=x0+i*(bw+gap);bowlXs.push([bx,bw,by,bd]);b+=rc(px+bx*s,py+by*s,bw*s,bd*s,.25,"#FFFFFF",null,20*s);b+=`<circle cx="${px+(bx+bw/2)*s}" cy="${py+(by+bd/2)*s}" r="${Math.max(.8,45*s)}" fill="none" stroke="${P.ink}" stroke-width=".18"/>`;
      if(t!=="hand"&&(v.taps==="1 per bowl"||(v.taps==="1 shared"&&i===Math.floor(nb/2))))b+=`<circle cx="${px+(bx+bw/2)*s}" cy="${py+Math.max(35,by/2)*s}" r="${Math.max(.6,17*s)}" fill="none" stroke="${P.ink}" stroke-width=".18"/>`;}
    const drn=(x1,x2)=>{let o="";for(let x=x1+40;x<x2-30;x+=60)o+=ln(px+x*s,py+(by+30)*s,px+x*s,py+(by+bd-30)*s,.12);return o;};
    if(v.drainer==="Left"||v.drainer==="Both")b+=drn(40,x0-30);if(v.drainer==="Right"||v.drainer==="Both")b+=drn(x0+tot+30,W-40);
    if(nb&&t!=="hand"){const [bx,bw2]=bowlXs[0];b+=dimH(px+bx*s,px+(bx+bw2)*s,py+D*s,`${bw2}`,3.2);}
  }
  if(t==="rsaladf"||t==="rsaladr"){const n=Math.max(1,(/(\d+)/.exec(v.gn)||[0,6])[1]|0),rows=D>=800&&n>=8&&t==="rsaladf"?2:1,perRow=Math.ceil(n/rows),gw=176,gd=325,tw=perRow*gw+(perRow-1)*8;
    const gx=Math.max(60,(W-tw)/2),gy=t==="rsaladr"?40:Math.max(60,(D-rows*gd-(rows-1)*20)/2-40);
    for(let r=0;r<rows;r++)for(let i=0;i<perRow;i++)b+=rc(px+(gx+i*(gw+8))*s,py+(gy+r*(gd+20))*s,gw*s,gd*s,.18,"#FFFFFF");
    b+=rc(px+(gx-20)*s,py+(gy-20)*s,(tw+40)*s,(rows*gd+(rows-1)*20+40)*s,.2,"none","1.2 .6");
    b+=tx(px+W*s/2,py+(gy+rows*gd+(rows-1)*20+20)*s+3,t==="rsaladf"?"GN pans flush, sliding lid":"raised GN rail, hinged lid","middle",P.dim,1.8);}
  if(isRefr(t)){const cw=450,cx=v.comp==="Right end"?W-cw:0;if(v.comp!=="Remote")b+=rc(px+cx*s,py+(D-60)*s,cw*s,60*s,.15,"none","1 .6");}
  if(t==="hood"){const n=Math.max(1,(/(\d+)/.exec(v.filters)||[0,1])[1]|0),fw=500,fx=(W-n*fw)/2;for(let i=0;i<n;i++)b+=rc(px+(fx+i*fw)*s,py+(D*.35)*s,fw*s,(D*.3)*s,.15,"none");
    const sp=triple(v.spigot);const sw=(sp[1]||400),sd=(sp[2]||300),nS=/^2\s*×/.test(v.spigot)?2:1;for(let i=0;i<nS;i++){const cx=W*(i+1)/(nS+1);b+=rc(px+(cx-sw/2)*s,py+(D*.75-sd/2)*s,sw*s,sd*s,.25,"none");b+=ln(px+(cx-sw/2)*s,py+(D*.75-sd/2)*s,px+(cx+sw/2)*s,py+(D*.75+sd/2)*s,.12);}}
  if(t==="wshelf"||t==="gantry"){const n=t==="gantry"?2:Math.max(2,Math.ceil(W/900)+1);for(let i=0;i<n;i++){const x=n===1?W/2:30+(W-60)*i/(n-1);b+=ln(px+x*s,py,px+x*s,py+D*s*.8,.15,"1 .6");}}
  if(t==="cab"||t==="wcab"){const n=t==="wcab"?mmOf(v.doors)||2:W>1400?3:2;b+=ln(px,py+(D-30)*s,px+W*s,py+(D-30)*s,.12);}
  b+=dimH(px,px+W*s,py,`${W}`,-3.2);b+=dimV(py,py+D*s,px-3.2,`${D}`);

  /* ---- FRONT ELEVATION ---- */
  const fx=ox,fbase=fy+viewH*s;   /* floor (or underside for over items) line */
  const FY=z=>fbase-z*s;            /* height z (from floor / underside) to paper y */
  b+=tx(fx,fy-2.2,"FRONT","start",P.ink,2.4);
  if(!over)b+=`<path d="M${fx-3} ${fbase}H${fx+W*s+3}" stroke="${P.ink}" stroke-width=".35"/>`+`<path d="M${fx-3} ${fbase}H${fx+W*s+3}" stroke="${P.ink}" stroke-width="1.6" stroke-dasharray=".25 1.2" opacity=".35"/>`;
  b+=front(t,it,v,fx,FY,W,H,s,P,{rc,ln,tx,fill,bowlXs,up,topped});
  b+=dimH(fx,fx+W*s,fbase,`${W}`,over?4:5);
  /* ---- SIDE ELEVATION (front on the left) ---- */
  b+=tx(sx,fy-2.2,"SIDE","start",P.ink,2.4);
  if(!over)b+=`<path d="M${sx-3} ${fbase}H${sx+D*s+3}" stroke="${P.ink}" stroke-width=".35"/>`;
  b+=side(t,it,v,sx,FY,D,H,s,P,{rc,ln,tx,fill,up,topped});
  b+=dimH(sx,sx+D*s,fbase,`${D}`,over?4:5);
  /* heights on the right of the side view */
  const hx=sx+D*s+3.5;if(t==="wshelf"){const top=viewH;b+=dimV(FY(top),FY(top-H),hx,`${H}`);}else b+=dimV(FY(H),FY(0),hx,`${H}`);
  if(up&&topped&&!over)b+=dimV(FY(H+up),FY(H),hx+4,`${up}`);
  if(!over&&["table","landing","sink1","sink2","sink3"].includes(t)&&/undershelf/i.test(v.base))b+=dimV(FY(mmOf(v.shelfH)),FY(0),hx+(up?8:4),`${mmOf(v.shelfH)}`);
  if(nb&&t!=="hand"){const [,,,]=bowlXs[0]||[];const bh=triple(v.bowl)[2]||300;b+=dimV(FY(H),FY(H-bh),fx-3.2,`${bh}`);}
  const w=hx+(up?12:8)+2,h=fbase+(over?8:10);
  return {w,h,body:b};
}
function legsX(W){const xs=[0,W-41];if(W>1900)xs.splice(1,0,W/2-20);return xs;}
function front(t,it,v,fx,FY,W,H,s,P,k){const {rc,ln,fill}=k;let b="";const X=x=>fx+x*s;
  const legs=(topZ,feet=true)=>{let o="";for(const x of legsX(W))o+=rc(X(x),FY(topZ),41*s,(topZ-(feet?25:0))*s,.25,fill);if(feet)for(const x of legsX(W))o+=`<path d="M${X(x+5)} ${FY(25)}L${X(x+36)} ${FY(25)}L${X(x+30)} ${FY(0)}L${X(x+11)} ${FY(0)}Z" fill="${fill}" stroke="${P.ink}" stroke-width=".2"/>`;return o;};
  const castors=()=>{let o="";for(const x of [60,W-60])o+=`<circle cx="${X(x)}" cy="${FY(50)}" r="${50*s}" fill="none" stroke="${P.ink}" stroke-width=".25"/>`;return o;};
  const top=(z,edge=40)=>rc(X(0),FY(z),W*s,edge*s,.35,fill)+(v.edge==="Marine (raised lip)"?rc(X(0),FY(z+12),W*s,12*s,.25,fill):"");
  const upst=z=>k.up?rc(X(0),FY(z+k.up),W*s,k.up*s,.2,"none"):"";
  const castor=v.feet==="Castors, 2 braked";
  if(["table","landing","sink1","sink2","sink3"].includes(t)){
    b+=upst(H)+top(H);
    b+=castor?(()=>{let o="";for(const x of legsX(W))o+=rc(X(x),FY(H-40),41*s,(H-140)*s,.25,fill);return o+castors();})():legs(H-40);
    if(/undershelf/i.test(v.base)){const z=mmOf(v.shelfH);b+=rc(X(41),FY(z),(W-82)*s,40*s,.25,fill);}
    if(v.base==="Drawers")b+=rc(X(W/2-250),FY(H-40),500*s,120*s,.25,fill)+ln(X(W/2-60),FY(H-100),X(W/2+60),FY(H-100),.35);
    if(k.bowlXs.length){const bh=triple(v.bowl)[2]||300;for(const [bx,bw] of k.bowlXs)b+=rc(X(bx),FY(H),bw*s,bh*s,.2,"none","1.2 .7");}
    if(t==="landing"&&has(it,"Pre-rinse sink"))b+=rc(X(W-500),FY(H),400*s,250*s,.2,"none","1.2 .7");
  }else if(t==="cab"){b+=upst(H)+top(H);const z0=150;b+=rc(X(0),FY(H-40),W*s,(H-40-z0)*s,.3,fill);const n=W>1400?3:2;for(let i=1;i<n;i++)b+=ln(X(W*i/n),FY(H-60),X(W*i/n),FY(z0+20),.2);for(let i=0;i<n;i++)b+=rc(X(W*(i+.5)/n-40),FY((H+z0)/2+15),80*s,30*s,.2,"none");
    b+=ln(X(20),FY((H+z0)/2-40),X(W-20),FY((H+z0)/2-40),.15,"1 .6");for(const x of [30,W-71])b+=rc(X(x),FY(z0),41*s,z0*s,.25,fill);}
  else if(isRefr(t)){const z0=150,topZ=t==="rsaladr"?H:H;b+=upst(H)+top(H);b+=rc(X(0),FY(H-40),W*s,(H-40-z0)*s,.3,fill);
    const cw=v.comp==="Remote"?0:450,cx=v.comp==="Right end"?W-cw:0;if(cw){b+=rc(X(cx),FY(H-40),cw*s,(H-40-z0)*s,.25,"none");for(let y=z0+60;y<H-80;y+=40)b+=ln(X(cx+60),FY(y),X(cx+cw-60),FY(y),.15);}
    const ax=cw&&cx===0?cw:0,aw=W-cw;
    if(t==="rlowboy"){const nd=Math.max(2,mmOf(v.drawers)),sec=Math.max(1,Math.round(nd/2));for(let i=0;i<sec;i++){const x=ax+aw*i/sec,w2=aw/sec;const hh=(H-40-z0)/2;for(let j=0;j<2;j++){b+=rc(X(x+15),FY(z0+hh*(j+1)-10),(w2-30)*s,(hh-20)*s,.25,"none");b+=ln(X(x+w2/2-80),FY(z0+hh*(j+1)-40),X(x+w2/2+80),FY(z0+hh*(j+1)-40),.4);}}}
    else{const nd=Math.max(1,mmOf(v.doors));for(let i=0;i<nd;i++){const x=ax+aw*i/nd,w2=aw/nd;b+=rc(X(x+15),FY(H-60),(w2-30)*s,(H-60-z0-20)*s,.25,"none");b+=ln(X(x+w2-70),FY(H-120),X(x+w2-70),FY(H-280),.45);}}
    if(t==="rsaladr")b+=rc(X(60),FY(H+220),(W-120)*s,220*s,.3,fill)+ln(X(60),FY(H+220),X(W-60),FY(H+150),.15);
    if(t==="rsaladf")b+=rc(X(60),FY(H),(W-120)*s,150*s,.18,"none","1.2 .7");
    for(const x of [40,W-81])b+=rc(X(x),FY(z0),41*s,z0*s,.25,fill);}
  else if(t==="hand"){const [bw,,bh]=triple(v.bowl);b+=rc(X(0),FY(H),W*s,(bh+80)*s,.3,fill);b+=rc(X((W-bw)/2),FY(H-10),bw*s,bh*s,.2,"none","1.2 .7");b+=rc(X(0),FY(H+300),W*s,300*s,.15,"none","1.2 .7")+rc(X(W/2-12),FY(H+170),24*s,90*s,.2,fill);b+=rc(X(W/2-40),FY(H-bh-200),80*s,90*s,.25,fill);b+=k.tx(X(W/2),FY(H-bh-240),"knee valve","middle",P.dim,1.6);}
  else if(t==="rack"){const n=Math.max(2,mmOf(v.tiers));for(const x of [0,W-30])b+=rc(X(x),FY(H),30*s,H*s,.25,fill);for(let i=0;i<n;i++){const z=150+(H-190)*i/(n-1);b+=rc(X(0),FY(z+40),W*s,40*s,.25,fill);}}
  else if(t==="trolley"){for(const x of [0,W-30])b+=rc(X(x),FY(H),30*s,(H-120)*s,.25,fill);b+=rc(X(0),FY(H),W*s,30*s,.25,fill);b+=rc(X(0),FY(150),W*s,30*s,.25,fill);const n=Math.max(2,mmOf(v.tiers));for(let i=0;i<n;i++){const z=200+(H-260)*i/Math.max(1,n-1);b+=ln(X(30),FY(z),X(W-30),FY(z),.12,"1 .6");}for(const x of [60,W-60])b+=`<circle cx="${X(x)}" cy="${FY(50)}" r="${50*s}" fill="none" stroke="${P.ink}" stroke-width=".25"/>`;}
  else if(t==="wshelf"){const n=Math.max(1,mmOf(v.tiers)),top=H+250+350*(n-1);const nb=Math.max(2,Math.ceil(W/900)+1);for(let i=0;i<n;i++){const z=top-350*i;b+=rc(X(0),FY(z),W*s,H*s,.3,fill);for(let j=0;j<nb;j++){const x=30+(W-60)*j/(nb-1);b+=ln(X(x),FY(z-H),X(x),FY(z-H-220),.2,"1 .6");}}}
  else if(t==="wcab"){b+=rc(X(0),FY(H),W*s,H*s,.3,fill);const n=mmOf(v.doors)||2;for(let i=1;i<n;i++)b+=ln(X(W*i/n),FY(H-15),X(W*i/n),FY(15),.2);b+=ln(X(15),FY(H/2),X(W-15),FY(H/2),.15,"1 .6");}
  else if(t==="hood"){b+=rc(X(0),FY(H),W*s,H*s,.35,fill);const n=Math.max(1,(/(\d+)/.exec(v.filters)||[0,1])[1]|0),fw=500,f0=(W-n*fw)/2;for(let i=0;i<n;i++){b+=rc(X(f0+i*fw+10),FY(H*.55),(fw-20)*s,H*.4*s,.15,"none","1 .6");}
    b+=ln(X(0),FY(40),X(W),FY(40),.2);const sp=triple(v.spigot),sw=sp[1]||400,nS=/^2\s*×/.test(v.spigot)?2:1;for(let i=0;i<nS;i++){const cx=W*(i+1)/(nS+1);b+=rc(X(cx-sw/2),FY(H+150),sw*s,150*s,.25,"none");}}
  else if(t==="gantry"){for(const x of [40,W-81])b+=rc(X(x),FY(H),41*s,H*s,.25,fill);const n=Math.max(1,mmOf(v.tiers));for(let i=0;i<n;i++){const z=H-i*Math.min(300,H/2);b+=rc(X(0),FY(z),W*s,30*s,.3,fill);}
    const nl=mmOf(v.lamps);for(let i=0;i<nl;i++){const x=W*(i+.5)/nl;b+=`<path d="M${X(x-60)} ${FY(H-30)}L${X(x+60)} ${FY(H-30)}L${X(x+30)} ${FY(H-110)}L${X(x-30)} ${FY(H-110)}Z" fill="none" stroke="${P.ink}" stroke-width=".2"/>`;}}
  else b+=rc(X(0),FY(H),W*s,H*s,.3,fill);
  return b;}
function side(t,it,v,sx,FY,D,H,s,P,k){const {rc,ln,fill}=k;let b="";const X=x=>sx+x*s;   /* x 0 = front */
  const upst=z=>k.up?rc(X(D-12),FY(z+k.up),12*s,k.up*s,.25,fill):"";
  if(["table","landing","sink1","sink2","sink3","cab"].includes(t)||isRefr(t)){
    b+=upst(H)+rc(X(0),FY(H),D*s,40*s,.35,fill);if(v.edge==="Marine (raised lip)")b+=rc(X(0),FY(H+12),20*s,12*s,.25,fill);
    if(t==="cab"||isRefr(t)){const z0=150;b+=rc(X(0),FY(H-40),D*s,(H-40-z0)*s,.3,fill);for(const x of [30,D-71])b+=rc(X(x),FY(z0),41*s,z0*s,.25,fill);
      if(t==="rsaladr")b+=`<path d="M${X(D-260)} ${FY(H)}L${X(D-260)} ${FY(H+220)}L${X(D-20)} ${FY(H+220)}L${X(D-20)} ${FY(H)}" fill="${fill}" stroke="${P.ink}" stroke-width=".3"/>`+rc(X(30),FY(H+25),(D-320)*s,25*s,.2,"none");
      if(t==="rsaladf")b+=rc(X(60),FY(H),325*s,150*s,.18,"none","1.2 .7");}
    else{const castor=v.feet==="Castors, 2 braked";for(const x of [0,D-41])b+=rc(X(x),FY(H-40),41*s,(H-40-(castor?100:25))*s,.25,fill);
      if(/undershelf/i.test(v.base)){const z=mmOf(v.shelfH);b+=rc(X(41),FY(z),(D-82)*s,40*s,.25,fill);}
      if(bowlsOf(t)){const [,bd,bh]=triple(v.bowl);const by=Math.max(80,Math.min(D-bd-60,D-bd-90));b+=rc(X(D-by-bd),FY(H),bd*s,bh*s,.2,"none","1.2 .7");}}}
  else if(t==="hand"){const [,bd,bh]=triple(v.bowl);b+=`<path d="M${X(D)} ${FY(H+300)}V${FY(H-bh-80)}L${X(0)} ${FY(H-bh-80)}V${FY(H)}H${X(D)}" fill="${fill}" stroke="${P.ink}" stroke-width=".3"/>`;b+=rc(X(D-bd-40),FY(H-10),bd*s,bh*s,.2,"none","1.2 .7");}
  else if(t==="rack"){const n=Math.max(2,mmOf(v.tiers));for(const x of [0,D-30])b+=rc(X(x),FY(H),30*s,H*s,.25,fill);for(let i=0;i<n;i++){const z=150+(H-190)*i/(n-1);b+=rc(X(0),FY(z+40),D*s,40*s,.25,fill);}}
  else if(t==="trolley"){for(const x of [0,D-30])b+=rc(X(x),FY(H),30*s,(H-120)*s,.25,fill);const n=Math.max(2,mmOf(v.tiers));for(let i=0;i<n;i++){const z=200+(H-260)*i/Math.max(1,n-1);b+=ln(X(30),FY(z),X(D-30),FY(z),.2);}for(const x of [60,D-60])b+=`<circle cx="${X(x)}" cy="${FY(50)}" r="${50*s}" fill="none" stroke="${P.ink}" stroke-width=".25"/>`;}
  else if(t==="wshelf"){const n=Math.max(1,mmOf(v.tiers)),top=H+250+350*(n-1),bd=Math.min(220,D*.7);for(let i=0;i<n;i++){const z=top-350*i;b+=rc(X(0),FY(z),D*s,H*s,.3,fill)+`<path d="M${X(D)} ${FY(z-H)}L${X(D)} ${FY(z-H-bd)}L${X(D-bd)} ${FY(z-H)}Z" fill="none" stroke="${P.ink}" stroke-width=".2"/>`;}b+=ln(X(D+1.5/s),FY(top+60),X(D+1.5/s),FY(0),.5);}
  else if(t==="wcab"){b+=`<path d="M${X(0)} ${FY(H-60)}L${X(D)} ${FY(H)}V${FY(0)}H${X(0)}Z" fill="${fill}" stroke="${P.ink}" stroke-width=".3"/>`+ln(X(D+3),FY(H+60),X(D+3),FY(-60),.5);}
  else if(t==="hood"){b+=`<path d="M${X(0)} ${FY(0)}V${FY(H*.45)}L${X(D*.25)} ${FY(H)}H${X(D)}V${FY(0)}H${X(D-80)}L${X(80)} ${FY(H*.25)}" fill="${fill}" stroke="${P.ink}" stroke-width=".35"/>`;b+=ln(X(D*.35),FY(H*.2),X(D*.55),FY(H*.85),.2,"1 .6");b+=ln(X(D+3),FY(H+150),X(D+3),FY(-60),.5);}
  else if(t==="gantry"){b+=rc(X(D/2-20),FY(H),41*s,H*s,.25,fill);const n=Math.max(1,mmOf(v.tiers));for(let i=0;i<n;i++){const z=H-i*Math.min(300,H/2);b+=rc(X(0),FY(z),D*s,30*s,.3,fill);}}
  else b+=rc(X(0),FY(H),D*s,H*s,.3,fill);
  return b;}

/* group identical fabrication items so the fabricator gets one detail per design, with the quantity */
function groupKey(it){return [typeOf(it),it.w,it.d,it.h,it.mat||"",(it.opts||[]).join("|"),JSON.stringify(resolved(it)),it.kw||""].join("~");}

root.KS_fab={typeOf,migrate,fields,defaults,spec,card,groupKey,isRefr,REFR,SS_TYPES,LABEL};
})(typeof window!=="undefined"?window:globalThis);
