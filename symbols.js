/* Drawing symbols: plan + elevation. Local coords: x 0..w left to right, plan y 0 = back, y = d = front. */
function KS_symOf(it){
  if(it.kind==="arch")return "arch:"+it.archType;
  if(it.kind==="ss")return "ss:"+it.ssType;
  const t=((it.cat||"")+" "+(it.name||"")+" "+(it.model||"")).toLowerCase(),has=(...k)=>k.some(x=>t.includes(x));
  if(has("cold room","freezer room","walk-in"))return "coldroom";
  if(has("shelving","dunnage"))return "ss:rack";
  if(has("racking trolley","tray trolley","rack trolley"))return "ss:trolley";
  if(has("conveyor")&&has("dishwash","warewash"))return "dishconv";
  if(has("hood dishwasher","hood-type","pass-through","hood type"))return "dishhood";
  if(has("dishwasher","glasswasher","warewash"))return "dishuc";
  if(has("tilting","bratt","ivario","steam kettle","boiling pan"))return "tiltpan";
  if(has("induction"))return "induction";
  if(has("fry top","griddle","plancha"))return "griddle";
  if(has("chargrill","char grill","gas grill","grill 800"))return "chargrill";
  if(has("pasta"))return "pasta";
  if(has("fryer"))return "fryer";
  if(has("range","burner","stove"))return "range";
  if(has("salamander"))return "salamander";
  if(has("high-speed","rapid-cook","microwave","pizza","deck oven"))return "hsoven";
  if(has("ice maker","ice machine","ice "))return "ice";
  if(has("counter","undercounter","saladette"))if(has("fridge","refrigerat","freezer","prep counter","salad"))return "counter";
  if(has("fridge","refrigerator","freezer","blast","chiller","reach-in","bottle cooler","multideck","display"))return "fridge";
  if(has("combi","oven","cook & hold","cook and hold","holding cabinet","cvap","hold"))return "oven";
  if(has("spiral","planetary","stand mixer","dough mixer"))return "mixer";
  if(has("vacuum"))return "vacuum";
  if(has("sous-vide","water bath","bain marie","bain-marie"))return "bath";
  if(has("slicer"))return "slicer";
  if(has("grinder"))return "bowl";
  if(has("espresso","coffee"))return "espresso";
  if(has("blender","processor","veg prep","vegetable prep","cutter","blixer","pacojet","thermomix","rice cooker","mincer","juicer"))return "bowl";
  return "generic";
}

function KS_planSym(it,upp,C,ink){
  const w=it.w,d=it.d,k=KS_symOf(it),t=upp*.9,da=`${4*upp} ${3*upp}`;let s="";
  const R=(x,y,W,H,rx,fill,dash,col)=>W>0&&H>0?`<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="${rx||0}" fill="${fill||"none"}" stroke="${col||ink}" stroke-width="${t}" ${dash?`stroke-dasharray="${da}"`:""}/>`:"";
  const Ci=(cx,cy,r,fill)=>r>0?`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill||"none"}" stroke="${ink}" stroke-width="${t}"/>`:"";
  const P=(p,dash,col)=>`<path d="${p}" fill="none" stroke="${col||ink}" stroke-width="${t}" ${dash?`stroke-dasharray="${da}"`:""}/>`;
  const door=(x0,dw,hinge)=>hinge==="L"?P(`M${x0} ${d}v${dw}`)+P(`M${x0} ${d+dw}A${dw} ${dw} 0 0 0 ${x0+dw} ${d}`,1,C.muted):P(`M${x0+dw} ${d}v${dw}`)+P(`M${x0+dw} ${d+dw}A${dw} ${dw} 0 0 1 ${x0} ${d}`,1,C.muted);
  const knobs=(n,y)=>{let o="";for(let i=0;i<n;i++)o+=Ci(w*(i+.5)/n,y,Math.min(22,w/n*.18),ink);return o;};
  const cols=Math.max(1,Math.round(w/400));
  switch(k){
    case "range":{s+=R(0,0,w,70,0,C.sunk);const y0=90,y1=d-110,ch=(y1-y0)/2,cw=w/cols,r=Math.min(cw,ch)*.38;
      for(let i=0;i<cols;i++)for(let j=0;j<2;j++){const cx=cw*(i+.5),cy=y0+ch*(j+.5);s+=Ci(cx,cy,r)+Ci(cx,cy,r*.45)+P(`M${cx-r} ${cy}H${cx+r}M${cx} ${cy-r}V${cy+r}`);}
      s+=P(`M0 ${d-90}H${w}`)+knobs(cols*2,d-45);break;}
    case "griddle":s+=R(0,0,w,70,0,C.sunk)+R(40,95,w-80,d-260,8)+R(40,d-150,w-80,34,4,C.sunk)+P(`M0 ${d-90}H${w}`)+knobs(2,d-45);break;
    case "chargrill":{s+=R(0,0,w,70,0,C.sunk)+R(40,95,w-80,d-215);let p="";for(let x=70;x<w-50;x+=45)p+=`M${x} 95V${d-120}`;s+=P(p)+P(`M0 ${d-90}H${w}`)+knobs(2,d-45);break;}
    case "induction":{s+=R(30,30,w-60,d-150,12);const cw=(w-60)/cols,ch=(d-150)/2,z=Math.min(cw,ch)*.78;
      for(let i=0;i<cols;i++)for(let j=0;j<2;j++){const cx=30+cw*(i+.5),cy=30+ch*(j+.5);s+=R(cx-z/2,cy-z/2,z,z,14)+Ci(cx,cy,z*.3);}
      s+=P(`M0 ${d-90}H${w}`)+knobs(cols*2,d-45);break;}
    case "fryer":{s+=R(0,0,w,110,0,C.sunk);const cw=w/cols;for(let i=0;i<cols;i++){const x=cw*i+35,W=cw-70,H=d-290;s+=R(x,135,W,H,14);
        const bw=(W-30)/2;for(let b=0;b<2;b++){const bx=x+10+b*(bw+10);s+=R(bx,155,bw,H-60,6,"none",1)+P(`M${bx+bw/2} ${155+H-60}V${d-70}`);}}
      s+=P(`M0 ${d-60}H${w}`);break;}
    case "pasta":{s+=R(0,0,w,80,0,C.sunk)+R(35,110,w-70,d-260,14);const r=Math.min((w-110)/2,(d-300)/6);for(let j=0;j<3;j++)s+=Ci(w/2,140+r+j*(2*r+14),r);s+=P(`M0 ${d-90}H${w}`)+knobs(1,d-45);break;}
    case "oven":{const dw=Math.round(w*.84);s+=P(`M${dw} 0V${d}`)+R(55,70,dw-110,d-170,10,"none",1)+R(0,d-45,dw,45,0,ink)+Ci(w*.12,60,28)+R(dw+w*.03,d-130,w*.1,50,4)+door(0,dw,"L");break;}
    case "salamander":{let p="";for(let x=50;x<w-40;x+=40)p+=`M${x} 50V${d-80}`;s+=R(30,30,w-60,d-90)+P(p)+P(`M60 ${d+30}H${w-60}`);break;}
    case "hsoven":s+=R(40,40,w-80,d-110,8,"none",1)+R(0,d-40,w,40,0,ink)+R(w*.06,d,w*.88,Math.min(320,it.h*.55),0,"none",1,C.muted);break;
    case "tiltpan":s+=R(0,0,85,d,0,C.sunk)+R(w-85,0,85,d,0,C.sunk)+R(120,110,w-240,d-250,55)+P(`M${w/2-60} ${d-140}l60 70l60 -70`)+Ci(w-42,d-70,20,ink);break;
    case "fridge":{const n=w>1000?2:1,dw=w/n;s+=R(0,0,w,45,0,C.sunk)+R(0,d-60,w,60,0,C.sunk);if(n===2){s+=P(`M${dw} ${d-60}V${d}`)+door(0,dw,"L")+door(dw,dw,"R");}else s+=door(0,dw,"R");
      s+=R(40,80,w-80,d-180,0,"none",1);break;}
    case "counter":{const comp=Math.min(420,w*.26),n=Math.max(1,Math.round((w-comp)/460)),dw=(w-comp)/n;s+=R(12,12,w-24,d-24,0,"none",0,C.muted);
      let h="";for(let x=30;x<comp;x+=45)h+=`M${x} ${d-25}V${d-170}`;s+=P(`M${comp} 0V${d}`,1)+P(h);
      for(let i=0;i<n;i++){if(i)s+=P(`M${comp+dw*i} 0V${d}`,1);s+=door(comp+dw*i,Math.min(dw,d*.8),i%2?"R":"L");}
      if(/pan|salad|prep counter/i.test(it.name||"")){const pn=Math.max(3,Math.round((w-comp)/180)),pw=(w-comp-40)/pn;for(let i=0;i<pn;i++)s+=R(comp+20+pw*i+5,40,pw-10,d*.28,4);}
      break;}
    case "ice":s+=R(30,30,w-60,d*.45,6,"none",1)+P(`M0 ${d*.55}H${w}`)+R(0,d-40,w,40,0,C.sunk)+P(`M${w/2-40} ${d*.25}h80M${w/2} ${d*.25-40}v80M${w/2-28} ${d*.25-28}l56 56M${w/2-28} ${d*.25+28}l56 -56`);break;
    case "dishuc":s+=R((w-500)/2,Math.max(20,(d-500)/2),500,Math.min(500,d-40),0,"none",1)+R(0,d-40,w,40,0,ink)+R(0,d,w,Math.min(420,it.h*.5),0,"none",1,C.muted);break;
    case "dishhood":s+=R((w-500)/2,Math.max(30,(d-500)/2),500,Math.min(500,d-60),0,"none",1)+P(`M${(w-500)/2} ${d/2}h500M${w/2} ${Math.max(30,(d-500)/2)}v${Math.min(500,d-60)}`,1,C.muted)+R(0,0,70,70,0,C.sunk)+R(w-70,0,70,70,0,C.sunk)+P(`M40 ${d+45}H${w-40}M40 ${d}v45M${w-40} ${d}v45`);break;
    case "dishconv":{const n=Math.max(1,Math.floor((w-100)/520));for(let i=0;i<n;i++)s+=R(50+(w-100-n*500)/(n+1)*(i+1)+500*i,(d-500)/2,500,500,0,"none",1);s+=P(`M${w*.2} ${d-60}H${w*.8}l-60 -35m60 35l-60 35`);break;}
    case "mixer":s+=R(w*.25,20,w*.5,d*.34,10,C.sunk)+Ci(w/2,d*.64,Math.min(w,d)*.31)+Ci(w/2,d*.64,Math.min(w,d)*.24);break;
    case "bowl":{const r=Math.min(w,d)*(/round|rice/i.test(it.name||"")?.49:.36);s+=Ci(w/2,d/2,r)+Ci(w/2,d/2,r*.62)+Ci(w/2,d/2,r*.12,ink);break;}
    case "vacuum":s+=R(25,25,w-50,d-105,38)+P(`M60 ${d-130}H${w-60}`)+R(w*.2,d-60,w*.6,35,4,C.sunk);break;
    case "bath":{s+=R(25,25,w-50,d-90,16);if(/bain/i.test(it.name||"")){const n=Math.max(2,Math.round(w/350));for(let i=1;i<n;i++)s+=P(`M${25+(w-50)*i/n} 25V${d-65}`);}s+=Ci(w-60,d-32,14,ink);break;}
    case "slicer":s+=Ci(w*.62,d*.45,Math.min(w,d)*.3)+Ci(w*.62,d*.45,Math.min(w,d)*.06,ink)+R(w*.06,d*.2,w*.3,d*.55,8);break;
    case "espresso":{s+=R(20,20,w-40,d*.32,6,C.sunk)+R(w*.1,d-150,w*.8,110,6);const n=w>600?2:1;for(let i=0;i<n;i++)s+=Ci(w*(i+1)/(n+1),d-210,38)+P(`M${w*(i+1)/(n+1)} ${d-172}v70`);break;}
    case "coldroom":s+=R(80,80,w-160,d-160,0,C.surface)+P(`M${w*.3} ${d-80}V${d}M${w*.3+900} ${d-80}V${d}`)+door(w*.3,900,"L")+P(`M${w*.5-150} ${d*.35}h300M${w*.5} ${d*.35-150}v300M${w*.5-106} ${d*.35-106}l212 212M${w*.5-106} ${d*.35+106}l212 -212`,0,C.muted);break;
    case "arch:door":case "arch:door2":{s+=R(0,0,w,d,0,C.surface)+P(`M0 0V${d}M${w} 0V${d}`);
      if(k==="arch:door2"){const l=w/2;s+=P(`M0 ${d}v${l}`)+P(`M0 ${d+l}A${l} ${l} 0 0 0 ${l} ${d}`,1,C.muted)+P(`M${w} ${d}v${l}`)+P(`M${w} ${d+l}A${l} ${l} 0 0 1 ${l} ${d}`,1,C.muted);}
      else s+=door(0,w,it.flip?"R":"L");break;}
    case "arch:window":s+=R(0,0,w,d,0,C.surface)+P(`M0 ${d*.35}H${w}M0 ${d*.65}H${w}M0 0V${d}M${w} 0V${d}`);break;
    case "arch:column":s+=P(`M0 0L${w} ${d}M${w} 0L0 ${d}`);break;
    case "arch:drain":s+=Ci(w/2,d/2,w*.42,C.surface)+P(`M${w*.2} ${d*.2}L${w*.8} ${d*.8}M${w*.8} ${d*.2}L${w*.2} ${d*.8}M${w/2} ${d*.08}V${d*.92}M${w*.08} ${d/2}H${w*.92}`);break;
    case "arch:gas":case "arch:water":case "arch:power":{const L={"arch:gas":"G","arch:water":"W","arch:power":"E"}[k],col={"arch:gas":"#C8900A","arch:water":"#1F7FC2","arch:power":"#C8451B"}[k];
      s+=`<circle cx="${w/2}" cy="${d/2}" r="${w*.46}" fill="${col}" stroke="${ink}" stroke-width="${t}"/><text x="${w/2}" y="${d/2+w*.2}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${w*.55}" fill="#fff">${L}</text>`;break;}
    case "ss:table":case "ss:landing":case "ss:cab":{s+=R(14,14,w-28,d-28,0,"none",0,C.muted);
      if(k!=="ss:cab")for(const [x,y] of [[30,30],[w-70,30],[30,d-70],[w-70,d-70]])s+=R(x,y,40,40,0,"none",1,C.muted);
      else s+=P(`M20 ${d-22}H${w*.54}M${w*.46} ${d-42}H${w-20}`);
      if(it.opts&&it.opts.includes("Pre-rinse sink")){s+=R(w-560,(d-450)/2,480,450,40,C.surface)+Ci(w-320,d/2,22)+Ci(w-320,55,20,ink)+P(`M${w-320} 55v${d*.28}`);}
      if(it.opts&&it.opts.includes("Rack slide"))s+=R(40,(d-500)/2,500,500,0,"none",1,C.muted);
      if(it.opts&&it.opts.includes("Drawer"))s+=R(w*.1,d-16,w*.3,16,0,ink);
      break;}
    case "ss:sink1":case "ss:sink2":case "ss:sink3":{const n=+k.slice(-1),o=it.opts||[],Ld=o.includes("Left drainer"),Rd=o.includes("Right drainer");
      const x0=Ld?w*.32:60,x1=Rd?w*.68:w-60,gap=50,bw=Math.min(600,(x1-x0-gap*(n-1))/n),bd=Math.min(520,d-210),tot=n*bw+gap*(n-1),sx=x0+(x1-x0-tot)/2,by=(d-bd)/2+25;
      s+=R(14,14,w-28,d-28,0,"none",0,C.muted);
      for(let i=0;i<n;i++){const bx=sx+i*(bw+gap);s+=R(bx,by,bw,bd,45,C.surface)+Ci(bx+bw/2,by+bd/2,24)+Ci(bx+bw/2,by-48,20,ink)+P(`M${bx+bw/2} ${by-48}v${bd*.34}`);}
      const ribs=(a,b)=>{let p="";for(let x=a+40;x<b-20;x+=55)p+=`M${x} ${by}V${by+bd}`;return P(p,0,C.muted);};
      if(Ld)s+=ribs(40,x0-20);if(Rd)s+=ribs(x1+20,w-40);break;}
    case "ss:hand":s+=`<ellipse cx="${w/2}" cy="${d*.58}" rx="${w*.38}" ry="${d*.3}" fill="${C.surface}" stroke="${ink}" stroke-width="${t}"/>`+Ci(w/2,d*.58,16)+Ci(w/2,d*.16,18,ink)+P(`M${w/2} ${d*.16}v${d*.3}`);break;
    case "ss:rack":{let p="";for(let x=60;x<w;x+=60)p+=`M${x} 8V${d-8}`;s+=P(p,0,C.muted);for(const [x,y] of [[0,0],[w-40,0],[0,d-40],[w-40,d-40]])s+=R(x,y,40,40,0,ink);break;}
    case "ss:trolley":{let p="";for(let y=50;y<d-30;y+=70)p+=`M25 ${y}H${w-25}`;s+=P(p,0,C.muted);for(const [x,y] of [[35,35],[w-35,35],[35,d-35],[w-35,d-35]])s+=Ci(x,y,28);s+=P(`M0 ${d+40}H${w}M0 ${d}v40M${w} ${d}v40`);break;}
    case "ss:wshelf":s+=P(`M${w*.15} 0V${d}M${w*.85} 0V${d}`,1,C.muted);break;
    case "ss:wcab":s+=P(`M0 0L${w} ${d}`,1,C.muted)+P(`M${w/2} ${d-30}V${d}`);break;
    case "ss:hood":s+=R(150,150,w-300,d-300,0,"none",1,C.muted)+P(`M0 0L150 150M${w} 0L${w-150} 150M0 ${d}L150 ${d-150}M${w} ${d}L${w-150} ${d-150}`,1,C.muted)+R(150,60,w-300,70,0,"none",1,C.muted);break;
    case "ss:gantry":s+=R(0,d/2-25,50,50,0,ink)+R(w-50,d/2-25,50,50,0,ink)+P(`M50 ${d/2}H${w-50}`,1,C.muted);break;
    default:s+=P(`M0 0L${w} ${d}M${w} 0L0 ${d}`,0,C.muted)+R(0,d-40,w,40,0,C.sunk);
  }
  return s;
}

/* Elevation: box is W wide, it.h tall, y = 0 at the top. front = the item faces the viewer. */
function KS_elevSym(it,W,front,upp,C,ink,sw){
  const h=it.h,k=KS_symOf(it),t=upp*.9,da=`${4*upp} ${3*upp}`;let s="";
  const steel=C["steel-fill"],body=it.kind==="ss"?steel:it.mount==="top"?C["top-fill"]:C.surface;
  const R=(x,y,w,H,rx,fill,thick)=>w>0&&H>0?`<rect x="${x}" y="${y}" width="${w}" height="${H}" rx="${rx||0}" fill="${fill||"none"}" stroke="${ink}" stroke-width="${thick?sw:t}"/>`:"";
  const Ci=(cx,cy,r,fill)=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill||"none"}" stroke="${ink}" stroke-width="${t}"/>`;
  const P=(p,dash,fill)=>`<path d="${p}" fill="${fill||"none"}" stroke="${ink}" stroke-width="${t}" ${dash?`stroke-dasharray="${da}"`:""}/>`;
  const hit=`<rect width="${W}" height="${h}" fill="${C.surface}" fill-opacity="0.01"/>`;
  const feet=(hb)=>R(45,hb,45,h-hb,0,C.sunk)+R(W-90,hb,45,h-hb,0,C.sunk);
  const knobs=(n,y,x0=0,x1=W)=>{let o="";for(let i=0;i<n;i++)o+=Ci(x0+(x1-x0)*(i+.5)/n,y,Math.min(24,(x1-x0)/n*.2),C.sunk);return o;};
  const floorEq=it.mount==="floor"&&h>500,hb=floorEq?h-110:h;
  if(it.kind==="ss"){
    const o=it.opts||[],up=o.some(x=>x.startsWith("Upstand"));
    switch(it.ssType){
      case "table":case "landing":case "sink1":case "sink2":case "sink3":{s+=hit+R(0,0,W,40,0,steel,1);if(up)s+=R(0,-100,W,100,0,steel);
        s+=R(30,40,40,h-40,0,steel)+R(W-70,40,40,h-40,0,steel);if(o.includes("Undershelf"))s+=R(30,h-220,W-60,30,0,steel);
        if(o.includes("Drawer")&&front)s+=R(W*.1,45,W*.3,140,0,steel)+P(`M${W*.2} 115h${W*.1}`);
        if(o.includes("Castors"))s+=Ci(50,h-40,38,C.sunk)+Ci(W-50,h-40,38,C.sunk);
        const n=SS_BOWLS[it.ssType];if(n&&front){const Ld=o.includes("Left drainer"),Rd=o.includes("Right drainer"),x0=Ld?W*.32:60,x1=Rd?W*.68:W-60,bw=Math.min(600,(x1-x0-50*(n-1))/n),tot=n*bw+50*(n-1),sx=x0+(x1-x0-tot)/2;
          for(let i=0;i<n;i++){const bx=sx+i*(bw+50);s+=P(`M${bx} 40v270h${bw}v-270`,1)+P(`M${bx+bw/2} ${up?-100:0}v-180q0 -60 60 -60h70v40`);}}
        break;}
      case "hand":s+=hit+P(`M0 0H${W}L${W*.85} 200H${W*.15}Z`,0,steel)+P(`M${W/2} 200V${h*.55}`)+P(`M${W/2} 0v-160q0 -50 50 -50h50v35`);break;
      case "cab":s+=R(0,0,W,40,0,steel,1)+(up?R(0,-100,W,100,0,steel):"")+R(0,40,W,h-140,0,steel,1)+feet(h-100);if(front)s+=P(`M${W/2} 40V${h-100}`)+P(`M${W/2-90} ${h*.45}v120M${W/2+90} ${h*.45}v120`);break;
      case "rack":{s+=hit+R(0,0,40,h,0,steel)+R(W-40,0,40,h,0,steel);for(let i=0;i<4;i++)s+=R(0,h*.04+i*(h*.84/3),W,35,0,steel,!i);break;}
      case "trolley":{s+=hit+R(0,0,W,h-120,0,"none",1)+Ci(50,h-55,50,C.sunk)+Ci(W-50,h-55,50,C.sunk);let p="";for(let y=90;y<h-160;y+=75)p+=`M20 ${y}H${W-20}`;s+=P(p);break;}
      case "wshelf":s+=R(0,0,W,Math.max(h,30),0,steel,1)+P(`M${W*.15} ${h}v220l${Math.min(200,W*.1)} -220M${W*.85} ${h}v220l${-Math.min(200,W*.1)} -220`);if(o.includes("Double tier"))s+=R(0,-380,W,30,0,steel);break;
      case "wcab":s+=R(0,0,W,h,0,steel,1);if(front)s+=P(`M${W/2} 0V${h}`)+P(`M${W/2-80} ${h*.6}v${h*.25}M${W/2+80} ${h*.6}v${h*.25}`);break;
      case "hood":s+=P(`M0 0H${W}V${h}H0Z`,0,steel)+P(`M0 ${h*.35}H${W}`);if(front){const n=Math.max(2,Math.round(W/500));let p="";for(let i=1;i<n;i++)p+=`M${W*i/n} ${h*.35}V${h}`;s+=P(p);s+=R(W*.42,-Math.min(400,Math.max(0,h)),W*.16,Math.min(400,h),0,steel);}break;
      case "gantry":s+=hit+R(30,0,40,h,0,steel)+R(W-70,0,40,h,0,steel)+R(0,0,W,35,0,steel,1);if(o.includes("Double tier"))s+=R(0,h*.5,W,30,0,steel);if(o.includes("Heat lamps")){const n=Math.max(2,Math.round(W/600));for(let i=0;i<n;i++){const x=W*(i+.5)/n;s+=P(`M${x} 35v60M${x-70} 150q70 -110 140 0z`,0,C["top-fill"]);}}break;
      default:s+=R(0,0,W,h,0,steel,1);
    }
    return s;
  }
  if(!front){s+=R(0,0,W,hb,0,body,1)+(floorEq?feet(hb):"");
    if(k==="dishhood")s+=P(`M0 ${h*.42}H${W}M0 ${h*.56}H${W}`);
    if(["range","fryer","chargrill","pasta","griddle"].includes(k))s+=R(0,-60,Math.min(110,W*.15),60,0,C.sunk);
    return s;}
  switch(k){
    case "range":{const n=Math.max(1,Math.round(W/400))*2;s+=R(0,0,W,hb,0,body,1)+feet(hb)+P(`M0 45H${W}M0 170H${W}`)+knobs(n,108)+R(50,215,W-100,hb-270,8)+P(`M${W*.2} 270H${W*.8}`)+R(70,320,W-140,(hb-420)*.6,6,C.sunk);
      let g="";const c=n/2;for(let i=0;i<c;i++){const x=W*(i+.5)/c;g+=`M${x-90} 0v-28h180v28`;}s+=P(g);break;}
    case "fryer":case "pasta":case "chargrill":{const n=k==="chargrill"?1:Math.max(1,Math.round(W/400));s+=R(0,0,W,hb,0,body,1)+feet(hb)+P(`M0 60H${W}M0 190H${W}`)+knobs(Math.max(1,n),125);
      for(let i=0;i<n;i++){const dw=W/n;s+=R(dw*i+25,225,dw-50,hb-265,6)+P(`M${dw*i+dw*.3} 275h${dw*.4}`);}break;}
    case "griddle":case "induction":s+=R(0,0,W,h,0,body,1)+P(`M0 ${h*.3}H${W}`)+knobs(Math.max(2,Math.round(W/400)*(k==="induction"?2:1)),h*.65);break;
    case "oven":{const dw=W*.84;s+=R(0,0,W,hb,0,body,1)+(floorEq?feet(hb):"")+R(18,18,dw-30,hb-36,10)+R(60,70,dw-130,hb-150,26,C.sunk)+P(`M${dw-38} ${hb*.2}V${hb*.8}`)+R(dw+W*.025,30,W*.16-W*.05,hb*.3,6,C.sunk)+Ci(dw+W*.08,hb*.3+30+Math.min(80,hb*.1),Math.min(34,W*.035),C.sunk);break;}
    case "hsoven":case "salamander":s+=R(0,0,W,h,0,body,1)+R(W*.06,h*.3,W*.88,h*.62,8)+R(W*.12,h*.42,W*.76,h*.4,8,C.sunk)+P(`M${W*.2} ${h*.35}H${W*.8}`)+R(W*.3,h*.07,W*.4,h*.14,4,C.sunk);break;
    case "tiltpan":s+=hit+R(0,h*.1,W*.1,h*.9,0,body,1)+R(W*.9,h*.1,W*.1,h*.9,0,body,1)+R(W*.1,h*.22,W*.8,h*.4,12,body,1)+R(W*.08,h*.14,W*.84,h*.08,6,body)+R(W*.91,h*.2,W*.08,h*.18,4,C.sunk)+P(`M${W*.3} ${h*.18}h${W*.4}`);break;
    case "fridge":{const n=W>1000?2:1,dw=W/n,g=Math.min(190,h*.1);s+=R(0,0,W,hb,0,body,1)+feet(hb);let p="";for(let y=35;y<g-20;y+=32)p+=`M${W*.08} ${y}H${W*.92}`;s+=P(`M0 ${g}H${W}`)+P(p)+R(W*.4,g*.25,W*.2,g*.5,4,C.sunk);
      for(let i=0;i<n;i++){s+=R(dw*i+14,g+14,dw-28,hb-g-28,6);const hx=n===2?(i?dw+70:dw-70):70;s+=P(`M${hx} ${g+(hb-g)*.38}v${(hb-g)*.24}`);}
      if(/blast|chill/i.test(it.cat+it.name))s+=R(W*.3,g+40,W*.4,60,4,C.sunk);break;}
    case "counter":{const comp=Math.min(420,W*.26),n=Math.max(1,Math.round((W-comp)/460)),dw=(W-comp)/n;s+=R(0,0,W,hb,0,body,1)+feet(hb)+R(-10,0,W+20,40,0,steel);let p="";for(let y=110;y<hb-60;y+=45)p+=`M40 ${y}H${comp-40}`;s+=P(p)+R(60,55,comp-120,40,4,C.sunk);
      for(let i=0;i<n;i++)s+=R(comp+dw*i+10,55,dw-20,hb-75,6)+P(`M${comp+dw*i+dw*.3} 95h${dw*.4}`);break;}
    case "ice":s+=R(0,0,W,hb,0,body,1)+(floorEq?feet(hb):"")+P(`M0 ${hb*.12}L${W} ${hb*.12}`)+R(W*.08,hb*.16,W*.84,hb*.4,8)+P(`M${W*.35} ${hb*.5}h${W*.3}`);{let p="";for(let y=hb*.66;y<hb-30;y+=34)p+=`M${W*.1} ${y}H${W*.9}`;s+=P(p);}break;
    case "dishuc":s+=R(0,0,W,hb,0,body,1)+feet(hb)+P(`M0 95H${W}`)+R(W*.08,25,W*.3,45,4,C.sunk)+Ci(W*.8,48,20,C.sunk)+R(15,110,W-30,hb-190,6)+P(`M${W*.2} 160H${W*.8}`)+P(`M0 ${hb-65}H${W}`);break;
    case "dishhood":{const top=h*.42,gap=h*.56;s+=hit+R(0,0,W,top,0,body,1)+R(W*.62,30,W*.3,70,4,C.sunk)+P(`M-45 ${top-45}H${W+45}M-45 ${top-45}v-90M${W+45} ${top-45}v-90`)+R(0,top,50,gap-top,0,body)+R(W-50,top,50,gap-top,0,body)+R(W/2-250,gap-70,500,70,0,"none")+R(0,gap,W,hb-gap,0,body,1)+feet(hb)+R(20,gap+60,W-40,hb-gap-90,6);break;}
    case "dishconv":s+=R(0,0,W,hb,0,body,1)+feet(hb)+P(`M0 ${hb*.45}H${W}M0 ${hb*.58}H${W}`)+R(W*.08,hb*.08,W*.38,hb*.32,8)+R(W*.54,hb*.08,W*.38,hb*.32,8)+R(W*.35,hb*.64,W*.3,hb*.12,4,C.sunk);break;
    case "mixer":s+=hit+R(W*.08,h*.88,W*.84,h*.12,8,body,1)+R(W*.58,h*.2,W*.3,h*.68,6,body,1)+R(W*.05,0,W*.85,h*.24,24,body,1)+P(`M${W*.12} ${h*.5}H${W*.56}L${W*.5} ${h*.84}H${W*.18}Z`,0,steel)+P(`M${W*.34} ${h*.24}V${h*.5}`)+Ci(W*.73,h*.12,Math.min(28,W*.06),C.sunk);break;
    case "bowl":case "slicer":s+=hit+R(W*.12,h*.55,W*.76,h*.45,10,body,1)+P(`M${W*.2} ${h*.06}H${W*.8}L${W*.7} ${h*.55}H${W*.3}Z`,0,steel)+R(W*.26,0,W*.48,h*.06,4,C.sunk)+Ci(W*.5,h*.78,Math.min(30,W*.09),C.sunk);break;
    case "espresso":{s+=hit+R(0,0,W,h*.5,10,body,1)+R(W*.04,h*.5,W*.92,h*.32,0,C.sunk)+R(0,h*.82,W,h*.12,4,body,1)+R(40,h*.94,40,h*.06,0,C.sunk)+R(W-80,h*.94,40,h*.06,0,C.sunk);const n=W>600?2:1;for(let i=0;i<n;i++){const x=W*(i+1)/(n+1);s+=R(x-45,h*.5,90,h*.1,6,body)+P(`M${x} ${h*.6}v${h*.06}`);}break;}
    default:s+=R(0,0,W,hb,0,body,1)+(floorEq?feet(hb):"")+P(`M0 ${Math.min(120,hb*.18)}H${W}`)+R(W*.1,Math.min(120,hb*.18)*.25,W*.3,Math.min(120,hb*.18)*.5,4,C.sunk)+(hb>400?R(W*.06,Math.min(120,hb*.18)+20,W*.88,hb-Math.min(120,hb*.18)-50,6):"");
  }
  return s;
}
const SS_BOWLS={sink1:1,sink2:2,sink3:3};
