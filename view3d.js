/* 3D view: orbit + first-person walkthrough. Needs THREE (r128). Local item coords in mm: x width, y up, z depth (0 = back). */
const KS3D=(function(){
  let R,scene,cam,root,host,canvas,inited=false,M={},UNIT,UCYL,UEDGE,EMAT,raf=0,onSelect=null;
  let mode="orbit",orb={th:.55,ph:.95,r:10,tx:0,ty:1,tz:0},walk={x:0,z:0,yaw:0,pitch:0},joy={f:0,s:0},keys={},room={w:9,d:6,h:3},blocks=[],poly=null;
  function inPoly(x,z){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
  const ok=()=>typeof THREE!=="undefined";
  function mat(c,o){return new THREE.MeshStandardMaterial(Object.assign({color:c,metalness:.25,roughness:.45},o||{}));}
  function init(h,cv,selectCb){
    host=h;canvas=cv;onSelect=selectCb;if(!ok())return false;if(inited)return true;
    try{R=new THREE.WebGLRenderer({canvas,antialias:true});}catch(e){return false;}
    R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));R.outputEncoding=THREE.sRGBEncoding;R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;
    scene=new THREE.Scene();cam=new THREE.PerspectiveCamera(45,1,.05,200);root=new THREE.Group();scene.add(root);
    UNIT=new THREE.BoxGeometry(1,1,1);UCYL=new THREE.CylinderGeometry(1,1,1,28);UEDGE=new THREE.EdgesGeometry(UNIT);
    EMAT=new THREE.LineBasicMaterial({color:0x39444c});
    M={steel:mat(0xc5ced4,{metalness:.45,roughness:.32}),steel2:mat(0xaeb9c0,{metalness:.45,roughness:.4}),dark:mat(0x22282d,{metalness:.2,roughness:.6}),
      glass:mat(0x16232b,{metalness:.1,roughness:.08}),iron:mat(0x15181a,{roughness:.8,metalness:.1}),white:mat(0xe9edef,{metalness:.05,roughness:.5}),
      warm:mat(0xd9c48a,{roughness:.6}),lamp:mat(0xffb060,{emissive:0xff8a30,emissiveIntensity:.8}),screen:mat(0x2a66ff,{emissive:0x1d4fd0,emissiveIntensity:.7}),
      water:mat(0x7d8b94,{metalness:.5,roughness:.25}),doorleaf:mat(0x8a97a1,{metalness:.1,roughness:.6}),sky:mat(0xa9d4ee,{emissive:0x6fa8c8,emissiveIntensity:.5,roughness:.1}),wall:mat(0xdfe2dd,{metalness:0,roughness:.95}),gasy:mat(0xd9a514,{roughness:.5}),waterb:mat(0x2a86c9,{roughness:.5}),powr:mat(0x8b9399,{roughness:.6}),rubber:mat(0x111111,{roughness:.9,metalness:0})};
    bind();inited=true;return true;
  }
  /* primitives (mm) */
  function B(g,x,y,z,w,h,d,m,edge){if(!(w>0&&h>0&&d>0))return;const o=new THREE.Mesh(UNIT,m);o.scale.set(w,h,d);o.position.set(x+w/2,y+h/2,z+d/2);o.castShadow=o.receiveShadow=true;g.add(o);
    if(edge){const l=new THREE.LineSegments(UEDGE,EMAT);l.scale.copy(o.scale);l.position.copy(o.position);g.add(l);}return o;}
  function Cy(g,cx,y,cz,r,h,m,axis){const o=new THREE.Mesh(UCYL,m);o.scale.set(r,h,r);o.position.set(cx,y+h/2,cz);if(axis==="z"){o.rotation.x=Math.PI/2;o.position.set(cx,y,cz);}if(axis==="x"){o.rotation.z=Math.PI/2;o.position.set(cx,y,cz);}o.castShadow=true;g.add(o);return o;}
  const feet=(g,w,d,fh)=>{for(const [x,z] of [[50,50],[w-100,50],[50,d-110],[w-100,d-110]])B(g,x,0,z,50,fh,50,M.steel2);};
  const handleH=(g,x,y,z,len)=>{B(g,x,y,z,len,22,40,M.steel2);};
  const handleV=(g,x,y,z,len)=>{B(g,x,y,z,22,len,40,M.steel2);};
  const knobRow=(g,n,w,y,z)=>{for(let i=0;i<n;i++)Cy(g,w*(i+.5)/n,y,z+12,Math.min(24,w/n*.2),24,M.dark,"z");};
  function tap(g,cx,y,cz){Cy(g,cx,y,cz,14,260,M.water);B(g,cx-10,y+250,cz,20,20,190,M.water);}

  function build(it,sym){
    const g=new THREE.Group(),w=it.w,d=it.d,h=it.h,o=it.opts||[],cols=Math.max(1,Math.round(w/400));
    const floorEq=it.mount==="floor"&&h>500,fh=floorEq?110:0,F=d;/* front plane z */
    const body=(m)=>B(g,0,fh,0,w,h-fh,d,m||M.steel,true);
    switch(sym){
      case "range":{feet(g,w,d,fh);B(g,0,fh,0,w,h-fh-12,d,M.steel,true);B(g,0,h-12,0,w,12,d-90,M.iron);B(g,0,h,0,w,70,80,M.steel2,true);
        const cw=w/cols,ch=(d-200)/2;for(let i=0;i<cols;i++)for(let j=0;j<2;j++){const cx=cw*(i+.5),cz=95+ch*(j+.5),r=Math.min(cw,ch)*.36;Cy(g,cx,h,cz,r*.45,14,M.steel2);B(g,cx-r,h+14,cz-10,2*r,14,20,M.iron);B(g,cx-10,h+14,cz-r,20,14,2*r,M.iron);}
        knobRow(g,cols*2,w,h-75,F);B(g,50,fh+60,F,w-100,h-fh-220,14,M.steel2,true);B(g,80,fh+110,F+14,w-160,(h-fh-320)*.6,4,M.glass);handleH(g,w*.2,h-185,F+14,w*.6);break;}
      case "griddle":case "induction":case "chargrill":case "fryer":case "pasta":{
        const topUnit=h<400;if(!topUnit)feet(g,w,d,fh);B(g,0,fh,0,w,h-fh,d,M.steel,true);B(g,0,h,0,w,topUnit?40:80,90,M.steel2,true);
        if(sym==="griddle")B(g,40,h,100,w-80,14,d-250,M.steel2,true);
        if(sym==="induction"){B(g,30,h,30,w-60,6,d-150,M.glass);}
        if(sym==="chargrill"){for(let x=60;x<w-50;x+=45)B(g,x,h,100,16,16,d-220,M.iron);}
        if(sym==="fryer"||sym==="pasta"){const cw=w/cols;for(let i=0;i<cols;i++){B(g,cw*i+35,h,135,cw-70,4,d-290,sym==="pasta"?M.water:M.warm);B(g,cw*i+cw*.3,h+4,d-160,14,60,120,M.dark);B(g,cw*i+cw*.62,h+4,d-160,14,60,120,M.dark);}}
        knobRow(g,Math.max(1,cols),w,topUnit?h*.4:h-120,F);
        if(!topUnit)for(let i=0;i<cols;i++){const cw=w/cols;B(g,cw*i+20,fh+40,F,cw-40,h-fh-250,12,M.steel2,true);handleH(g,cw*i+cw*.3,h-260,F+12,cw*.4);}
        break;}
      case "oven":{if(floorEq)feet(g,w,d,fh);body();const dw=w*.84,hb=h-fh;B(g,15,fh+15,F,dw-25,hb-30,16,M.steel2,true);B(g,60,fh+70,F+16,dw-125,hb-150,5,M.glass);handleV(g,dw-45,fh+hb*.2,F+16,hb*.6);
        B(g,dw+8,fh+15,F,w-dw-20,hb-30,8,M.dark);B(g,dw+20,h-hb*.35,F+8,w-dw-44,hb*.22,4,M.screen);Cy(g,dw+(w-dw)/2,h-hb*.5,F+14,Math.min(34,w*.035),20,M.steel2,"z");Cy(g,w*.12,h,70,32,50,M.steel2);break;}
      case "hsoven":case "salamander":body();B(g,w*.06,h*.08,F,w*.88,h*.62,14,M.steel2,true);B(g,w*.12,h*.16,F+14,w*.76,h*.4,4,M.glass);handleH(g,w*.2,h*.62,F+14,w*.6);B(g,w*.3,h*.78,F,w*.4,h*.14,5,M.screen);break;
      case "tiltpan":B(g,0,0,0,w*.1,h*.9,d,M.steel,true);B(g,w*.9,0,0,w*.1,h*.9,d,M.steel,true);B(g,w*.1,h*.38,60,w*.8,h*.4,d-120,M.steel,true);B(g,w*.08,h*.78,40,w*.84,h*.08,d-80,M.steel2,true);B(g,w*.91,h*.62,F,w*.08,h*.18,6,M.screen);break;
      case "fridge":{feet(g,w,d,fh);body();const n=w>1000?2:1,dw=w/n,gr=Math.min(190,h*.1);B(g,w*.06,h-gr+25,F,w*.88,gr-50,8,M.dark);
        for(let i=0;i<n;i++){B(g,dw*i+10,fh+10,F,dw-20,h-fh-gr-20,28,M.steel,true);const hx=n===2?(i?dw+50:dw-72):50;handleV(g,hx,fh+(h-fh)*.4,F+28,(h-fh)*.22);}break;}
      case "counter":{feet(g,w,d,fh);B(g,0,fh,0,w,h-fh-40,d,M.steel,true);B(g,-10,h-40,-5,w+20,40,d+20,M.steel2,true);const comp=Math.min(420,w*.26),n=Math.max(1,Math.round((w-comp)/460)),dw=(w-comp)/n;
        for(let y=fh+60;y<h-130;y+=50)B(g,40,y,F,comp-80,22,6,M.dark);
        for(let i=0;i<n;i++){B(g,comp+dw*i+8,fh+20,F,dw-16,h-fh-80,24,M.steel,true);handleH(g,comp+dw*i+dw*.3,h-120,F+24,dw*.4);}
        if(/pan|salad|prep counter/i.test(it.name||""))B(g,comp,h,20,w-comp-20,60,d*.32,M.dark);break;}
      case "ice":if(floorEq)feet(g,w,d,fh);body();B(g,w*.08,fh+(h-fh)*.45,F,w*.84,(h-fh)*.4,18,M.steel2,true);for(let y=fh+30;y<fh+(h-fh)*.35;y+=40)B(g,w*.1,y,F,w*.8,18,6,M.dark);break;
      case "dishuc":feet(g,w,d,fh);body();B(g,12,fh+70,F,w-24,h-fh-180,18,M.steel2,true);handleH(g,w*.2,h-170,F+18,w*.6);B(g,w*.08,h-75,F,w*.3,45,5,M.screen);break;
      case "dishhood":{feet(g,w,d,fh);const top=h*.58,gap=h*.44;B(g,0,fh,0,w,gap-fh,d,M.steel,true);B(g,0,top,0,w,h-top,d,M.steel,true);for(const [x,z] of [[0,0],[w-50,0]])B(g,x,gap,z,50,top-gap,50,M.steel2);
        B(g,(w-500)/2,gap,(d-500)/2,500,20,500,M.dark);B(g,-40,top+40,F+30,w+80,30,30,M.steel2);B(g,-40,top+40,F-60,30,30,120,M.steel2);B(g,w+10,top+40,F-60,30,30,120,M.steel2);B(g,w*.6,h-110,F,w*.32,70,5,M.screen);B(g,20,fh+40,F,w-40,gap-fh-80,12,M.steel2,true);break;}
      case "dishconv":feet(g,w,d,fh);B(g,0,fh,0,w,(h-fh)*.42,d,M.steel,true);B(g,0,fh+(h-fh)*.56,0,w,(h-fh)*.44,d,M.steel,true);B(g,0,fh+(h-fh)*.42,0,w,(h-fh)*.14,60,M.steel2);B(g,w*.08,fh+(h-fh)*.6,F,w*.38,(h-fh)*.34,14,M.steel2,true);B(g,w*.54,fh+(h-fh)*.6,F,w*.38,(h-fh)*.34,14,M.steel2,true);break;
      case "mixer":B(g,w*.08,0,d*.1,w*.84,h*.1,d*.85,M.white,true);B(g,w*.25,h*.1,d*.05,w*.5,h*.68,d*.3,M.white,true);B(g,w*.2,h*.76,d*.05,w*.6,h*.24,d*.85,M.white,true);Cy(g,w/2,h*.16,d*.62,Math.min(w,d)*.3,h*.36,M.steel);Cy(g,w/2,h*.52,d*.62,18,h*.24,M.steel2);break;
      case "bowl":{const r=Math.min(w,d)*.36;if(/round|rice/i.test(it.name||"")){Cy(g,w/2,0,d/2,Math.min(w,d)*.49,h*.85,M.steel);Cy(g,w/2,h*.85,d/2,Math.min(w,d)*.44,h*.15,M.dark);}
        else{B(g,w*.12,0,d*.12,w*.76,h*.45,d*.76,M.white,true);Cy(g,w/2,h*.45,d/2,r,h*.5,M.steel);Cy(g,w/2,h*.95,d/2,r*.85,h*.05,M.dark);}break;}
      case "vacuum":B(g,0,0,0,w,h*.6,d,M.steel,true);B(g,25,h*.6,25,w-50,h*.4,d-90,M.glass);B(g,w*.2,h*.25,F,w*.6,h*.2,5,M.screen);break;
      case "bath":B(g,0,0,0,w,h,d,M.steel,true);B(g,25,h,25,w-50,4,d-90,M.water);break;
      case "slicer":B(g,0,0,0,w,h*.35,d,M.white,true);Cy(g,w*.62,h*.62,d*.45,Math.min(w,d)*.3,24,M.steel,"x");B(g,w*.06,h*.35,d*.2,w*.3,h*.3,d*.55,M.steel2,true);break;
      case "espresso":{for(const [x,z] of [[40,40],[w-80,40],[40,d-80],[w-80,d-80]])B(g,x,0,z,40,h*.06,40,M.dark);B(g,0,h*.06,0,w,h*.12,d,M.steel,true);B(g,0,h*.5,0,w,h*.5,d*.8,M.steel,true);B(g,w*.04,h*.18,0,w*.92,h*.32,d*.45,M.dark);
        const n=w>600?2:1;for(let i=0;i<n;i++){const x=w*(i+1)/(n+1);Cy(g,x,h*.38,d*.62,40,h*.12,M.steel2);B(g,x-12,h*.36,d*.62,24,22,170,M.dark);}break;}
      case "coldroom":B(g,0,0,0,w,h,d,M.white,true);B(g,w*.3,0,F,900,Math.min(1900,h-150),40,M.steel,true);handleV(g,w*.3+780,900,F+40,300);B(g,w*.3+200,h-120,F,500,90,60,M.dark);break;
      case "arch:door":case "arch:door2":{const dh=Math.min(2100,it.h||2100);B(g,-50,0,d-10,w+100,dh+50,30,M.dark);const n=sym==="arch:door2"?2:1;for(let i=0;i<n;i++){B(g,w/n*i+8,0,d-5,w/n-16,dh,40,M.doorleaf,true);B(g,n===2?(i?w/2+60:w/2-100):(it.flip?60:w-100),dh*.48,d+35,40,120,30,M.steel2);}break;}
      case "arch:window":B(g,-40,1000,d-10,w+80,1200,25,M.dark);B(g,0,1040,d-5,w,1120,30,M.sky);break;
      case "arch:column":B(g,0,0,0,w,it.h,d,M.wall,true);break;
      case "arch:drain":Cy(g,w/2,1,d/2,w*.45,6,M.dark);break;
      case "arch:gas":Cy(g,w/2,0,d/2,18,500,M.gasy);B(g,w/2-40,420,d/2-40,80,80,80,M.gasy);break;
      case "arch:water":Cy(g,w/2,0,d/2,16,550,M.waterb);B(g,w/2-35,480,d/2-35,70,70,70,M.waterb);break;
      case "arch:power":B(g,w/2-150,1300,d/2-40,300,400,80,M.powr,true);break;
      case "ss:table":case "ss:landing":case "ss:sink1":case "ss:sink2":case "ss:sink3":{
        const cast=o.includes("Castors"),lb=cast?110:0;B(g,0,h-40,0,w,40,d,M.steel,true);for(const [x,z] of [[30,30],[w-70,30],[30,d-70],[w-70,d-70]]){B(g,x,lb,z,40,h-40-lb,40,M.steel2);if(cast){Cy(g,x+20,55,z+20,55,30,M.rubber,"x");}}
        if(o.includes("Undershelf"))B(g,30,220,30,w-60,30,d-60,M.steel,true);if(o.some(x=>x.startsWith("Upstand")))B(g,0,h,0,w,100,20,M.steel,true);
        if(o.includes("Drawer"))B(g,w*.1,h-190,d-420,w*.3,150,425,M.steel2,true);
        const n=({"ss:sink1":1,"ss:sink2":2,"ss:sink3":3})[sym]||0;
        if(n){const Ld=o.includes("Left drainer"),Rd=o.includes("Right drainer"),x0=Ld?w*.32:60,x1=Rd?w*.68:w-60,bw=Math.min(600,(x1-x0-50*(n-1))/n),bd=Math.min(520,d-210),tot=n*bw+50*(n-1),sx=x0+(x1-x0-tot)/2,bz=(d-bd)/2+25;
          for(let i=0;i<n;i++){const bx=sx+i*(bw+50);B(g,bx,h-300,bz,bw,260,bd,M.steel2,true);B(g,bx+8,h,bz+8,bw-16,2,bd-16,M.dark);tap(g,bx+bw/2,h,bz-50);}}
        if(o.includes("Pre-rinse sink")){B(g,w-560,h-300,(d-450)/2,480,260,450,M.steel2,true);B(g,w-552,h,(d-450)/2+8,464,2,434,M.dark);Cy(g,w-320,h,55,14,900,M.water);}
        break;}
      case "ss:hand":B(g,0,h-200,0,w,200,d,M.steel,true);B(g,w*.12,h,d*.3,w*.76,2,d*.58,M.dark);tap(g,w/2,h,50);Cy(g,w/2,h*.45,d*.4,22,h*.55-200,M.steel2);break;
      case "ss:cab":feet(g,w,d,100);B(g,0,100,0,w,h-140,d,M.steel,true);B(g,0,h-40,0,w,40,d,M.steel2,true);B(g,10,120,F,w/2-5,h-180,10,M.steel2,true);B(g,w/2-5,120,F-12,w/2-5,h-180,10,M.steel2,true);handleV(g,w/2-90,h*.4,F+10,120);if(o.some(x=>x.startsWith("Upstand")))B(g,0,h,0,w,100,20,M.steel,true);break;
      case "ss:rack":for(const [x,z] of [[0,0],[w-40,0],[0,d-40],[w-40,d-40]])B(g,x,0,z,40,h,40,M.steel2);for(let i=0;i<4;i++)B(g,0,h*.12+i*(h*.84/3)-35,0,w,35,d,M.steel,true);break;
      case "ss:trolley":for(const [x,z] of [[0,0],[w-30,0],[0,d-30],[w-30,d-30]]){B(g,x,120,z,30,h-120,30,M.steel2);Cy(g,x+15,55,z+15,55,30,M.rubber,"x");}B(g,0,h-30,0,w,30,d,M.steel,true);B(g,0,120,0,w,30,d,M.steel,true);for(let y=220;y<h-80;y+=75){B(g,30,y,0,25,12,d,M.steel2);B(g,w-55,y,0,25,12,d,M.steel2);}break;
      case "ss:wshelf":B(g,0,0,0,w,Math.max(h,30),d,M.steel,true);for(const x of [w*.15,w*.85]){B(g,x-15,-200,0,30,200,20,M.steel2);B(g,x-15,-30,0,30,30,d*.85,M.steel2);}if(o.includes("Double tier"))B(g,0,380,0,w,30,d,M.steel,true);break;
      case "ss:wcab":B(g,0,0,0,w,h,d,M.steel,true);B(g,8,8,F,w/2-10,h-16,10,M.steel2,true);B(g,w/2+2,8,F,w/2-10,h-16,10,M.steel2,true);break;
      case "ss:hood":B(g,0,h*.65,0,w,h*.35,d,M.steel,true);B(g,0,0,0,w,h*.65,30,M.steel,true);B(g,0,0,d-30,w,h*.65,30,M.steel,true);B(g,0,0,0,30,h*.65,d,M.steel,true);B(g,w-30,0,0,30,h*.65,d,M.steel,true);
        {const f=new THREE.Mesh(UNIT,M.steel2);f.scale.set(w-60,20,d*.55);f.position.set(w/2,h*.33,d*.3);f.rotation.x=-.6;g.add(f);}B(g,w*.42,h,d*.2,w*.16,Math.min(500,1e3),w*.16,M.steel2,true);
        if(o.includes("Lights"))for(let i=0;i<Math.max(2,Math.round(w/900));i++)B(g,w*(i+.5)/Math.max(2,Math.round(w/900))-150,h*.62,d*.7,300,15,80,M.lamp);break;
      case "ss:gantry":B(g,30,0,d/2-20,40,h,40,M.steel2);B(g,w-70,0,d/2-20,40,h,40,M.steel2);B(g,0,h-35,0,w,35,d,M.steel,true);if(o.includes("Double tier"))B(g,0,h*.5,0,w,30,d,M.steel,true);
        if(o.includes("Heat lamps")){const n=Math.max(2,Math.round(w/600));for(let i=0;i<n;i++){const x=w*(i+.5)/n;Cy(g,x,h-95,d/2,8,60,M.dark);Cy(g,x,h-150,d/2,70,55,M.lamp);}}break;
      default:if(floorEq)feet(g,w,d,fh);body();B(g,w*.06,fh+(h-fh)*.08,F,w*.88,(h-fh)*.7,10,M.steel2,true);B(g,w*.1,h-(h-fh)*.16,F,w*.3,(h-fh)*.09,5,M.screen);
    }
    return g;
  }

  function rebuild(state,selId,C,zOf,symOf,fw,fd){
    if(!inited)return;
    while(root.children.length)root.remove(root.children[0]);
    room={w:state.room.w/1000,d:state.room.d/1000,h:state.room.h/1000};
    scene.background=new THREE.Color(C.sunk||"#dde3e8");
    const dark=(C.ground||"#fff").toLowerCase()<"#8";
    root.add(new THREE.HemisphereLight(0xffffff,dark?0x30363b:0x9aa3a9,dark?.6:.72));
    const sun=new THREE.DirectionalLight(0xffffff,.65);sun.position.set(room.w*.75,room.h*2.2,room.d*1.3);sun.target.position.set(room.w/2,0,room.d/2);sun.castShadow=true;
    const sc=sun.shadow.camera,ext=Math.max(room.w,room.d);sc.left=-ext;sc.right=ext;sc.top=ext;sc.bottom=-ext;sc.far=ext*5;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0006;root.add(sun,sun.target);
    // floor with 300 mm tiles
    const tc=document.createElement("canvas");tc.width=tc.height=128;const x=tc.getContext("2d");x.fillStyle=dark?"#3a4247":"#b9bfbd";x.fillRect(0,0,128,128);x.strokeStyle=dark?"#2b3236":"#8f9693";x.lineWidth=3;x.strokeRect(0,0,128,128);
    const tex=new THREE.CanvasTexture(tc);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(room.w/.3,room.d/.3);tex.encoding=THREE.sRGBEncoding;
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(room.w,room.d),new THREE.MeshStandardMaterial({map:tex,roughness:.85,metalness:0}));fl.rotation.x=-Math.PI/2;fl.position.set(room.w/2,0,room.d/2);fl.receiveShadow=true;root.add(fl);
    poly=Array.isArray(state.room.poly)&&state.room.poly.length>2?state.room.poly.map(p=>[p[0]/1000,p[1]/1000]):null;
    const wallMat=new THREE.MeshStandardMaterial({color:dark?0x4a5359:0xdfe2dd,roughness:.95,metalness:0});
    if(!poly){const shell=new THREE.Mesh(new THREE.BoxGeometry(room.w,room.h,room.d),new THREE.MeshStandardMaterial({color:dark?0x4a5359:0xdfe2dd,roughness:.95,metalness:0,side:THREE.BackSide}));shell.position.set(room.w/2,room.h/2+.001,room.d/2);shell.receiveShadow=true;root.add(shell);}
    else{fl.visible=false;const sh=new THREE.Shape();poly.forEach((p,i)=>i?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]));const sg=new THREE.ShapeGeometry(sh);
      const tex2=tex.clone();tex2.needsUpdate=true;tex2.repeat.set(1/.3,1/.3);const f2=new THREE.Mesh(sg,new THREE.MeshStandardMaterial({map:tex2,roughness:.85,metalness:0,side:THREE.DoubleSide}));f2.rotation.x=Math.PI/2;f2.receiveShadow=true;root.add(f2);
      const ce=new THREE.Mesh(sg,wallMat);ce.rotation.x=Math.PI/2;ce.position.y=room.h;root.add(ce);
      for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<.01)continue;
        let th=Math.atan2(-dz,dx);const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;if(!inPoly(mx-dz/L*.05,mz+dx/L*.05))th+=Math.PI;
        const w=new THREE.Mesh(new THREE.PlaneGeometry(L,room.h),wallMat);w.position.set(mx,room.h/2,mz);w.rotation.y=th;w.receiveShadow=true;root.add(w);}}
    blocks=[];
    for(const it of state.items){
      const g=build(it,symOf(it)),W=fw(it)/1000,D=fd(it)/1000,z=zOf(it)/1000;
      const inner=new THREE.Group();inner.add(g);g.position.set(-it.w/2,0,-it.d/2);inner.scale.setScalar(.001);
      const outer=new THREE.Group();outer.add(inner);outer.position.set(it.x/1000+W/2,z,it.y/1000+D/2);outer.rotation.y=-it.rot*Math.PI/180;outer.userData.id=it.id;root.add(outer);
      if(it.mount==="floor")blocks.push([it.x/1000,it.y/1000,it.x/1000+W,it.y/1000+D]);
      if(it.id===selId){const bx=new THREE.LineSegments(UEDGE,new THREE.LineBasicMaterial({color:new THREE.Color(C.accent||"#2347c5")}));bx.scale.set(W+.04,it.h/1000+.04,D+.04);bx.position.set(it.x/1000+W/2,z+it.h/2000,it.y/1000+D/2);root.add(bx);}
    }
    resize();
  }
  function resetOrbit(){orb.tx=room.w/2;orb.tz=room.d/2;orb.ty=.9;orb.r=Math.max(room.w,room.d)*1.05+1.5;orb.th=.55;orb.ph=.95;}
  function placeCam(){
    if(mode==="orbit"){const s=Math.sin(orb.ph);cam.position.set(orb.tx+orb.r*s*Math.sin(orb.th),orb.ty+orb.r*Math.cos(orb.ph),orb.tz+orb.r*s*Math.cos(orb.th));cam.fov=45;cam.lookAt(orb.tx,orb.ty,orb.tz);}
    else{cam.fov=68;cam.position.set(walk.x,1.62,walk.z);const cp=Math.cos(walk.pitch);cam.lookAt(walk.x-Math.sin(walk.yaw)*cp,1.62+Math.sin(walk.pitch),walk.z-Math.cos(walk.yaw)*cp);}
    cam.updateProjectionMatrix();
  }
  function draw(){if(!inited)return;placeCam();R.render(scene,cam);}
  function resize(){if(!inited)return;const w=Math.max(200,host.clientWidth),h=Math.round(window.KS_ASPECT?w*window.KS_ASPECT:(host.clientHeight>150?host.clientHeight:Math.min(window.innerHeight*.68,Math.max(300,w*.68))));R.setSize(w,h,false);canvas.style.width=w+"px";canvas.style.height=h+"px";cam.aspect=w/h;draw();}
  function free(x,z){const r=.22;if(x<r||z<r||x>room.w-r||z>room.d-r)return false;if(poly&&!(inPoly(x-r,z-r)&&inPoly(x+r,z-r)&&inPoly(x-r,z+r)&&inPoly(x+r,z+r)))return false;for(const b of blocks)if(x>b[0]-r&&x<b[2]+r&&z>b[1]-r&&z<b[3]+r)return false;return true;}
  function startSpot(){const tries=[[room.w/2,room.d/2],[room.w/2,room.d-.6],[room.w*.25,room.d*.6],[room.w*.75,room.d*.6]];for(let z=room.d-.5;z>.4;z-=.3)for(let x=.5;x<room.w-.4;x+=.3)tries.push([x,z]);for(const [x,z] of tries)if(free(x,z))return [x,z];return [room.w/2,room.d/2];}
  let last=0;
  function tick(ts){
    if(mode!=="walk"){raf=0;return;}
    const dt=Math.min(.05,(ts-last)/1000||0);last=ts;
    let f=joy.f+((keys.w||keys.arrowup)?1:0)-((keys.s||keys.arrowdown)?1:0),s=joy.s+(keys.d?1:0)-(keys.a?1:0);
    const turn=(keys.arrowright?1:0)-(keys.arrowleft?1:0);if(turn)walk.yaw-=turn*1.8*dt;
    if(f||s||turn){const sp=1.6*dt,dx=(-Math.sin(walk.yaw)*f+Math.cos(walk.yaw)*s)*sp,dz=(-Math.cos(walk.yaw)*f-Math.sin(walk.yaw)*s)*sp;
      if(free(walk.x+dx,walk.z))walk.x+=dx;if(free(walk.x,walk.z+dz))walk.z+=dz;}
    draw();raf=requestAnimationFrame(tick);
  }
  function setMode(m){mode=m;if(m==="walk"){const [x,z]=startSpot();walk.x=x;walk.z=z;walk.pitch=-.05;walk.yaw=Math.atan2(x-room.w/2,z-room.d*.2);last=performance.now();if(!raf)raf=requestAnimationFrame(tick);}else{joy.f=joy.s=0;}draw();}
  function bind(){
    const pts=new Map();let moved=0,pinch=0;
    canvas.addEventListener("pointerdown",e=>{pts.set(e.pointerId,[e.clientX,e.clientY]);moved=0;try{canvas.setPointerCapture(e.pointerId);}catch(_){}
      if(pts.size===2){const a=[...pts.values()];pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);}});
    canvas.addEventListener("pointermove",e=>{const p=pts.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];moved+=Math.abs(dx)+Math.abs(dy);pts.set(e.pointerId,[e.clientX,e.clientY]);
      if(pts.size===2&&mode==="orbit"){const a=[...pts.values()],dd=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(pinch)orb.r=Math.max(1.2,Math.min(80,orb.r*pinch/dd));pinch=dd;
        const k=orb.r*.0012;orb.tx-=(Math.cos(orb.th)*dx*.5)*k;orb.tz+=(Math.sin(orb.th)*dx*.5)*k;orb.ty=Math.max(0,Math.min(room.h,orb.ty+dy*.5*k));}
      else if(mode==="orbit"){if(e.shiftKey||e.buttons===2){const k=orb.r*.0015;orb.tx-=Math.cos(orb.th)*dx*k;orb.tz+=Math.sin(orb.th)*dx*k;orb.ty=Math.max(0,orb.ty+dy*k);}else{orb.th-=dx*.006;orb.ph=Math.max(.08,Math.min(1.52,orb.ph-dy*.006));}}
      else{walk.yaw+=dx*.004;walk.pitch=Math.max(-1.2,Math.min(1.2,walk.pitch+dy*.004));}
      if(mode==="orbit")draw();});
    const up=e=>{const had=pts.delete(e.pointerId);pinch=0;if(had&&moved<6&&onSelect){const r=canvas.getBoundingClientRect(),v=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1)),rc=new THREE.Raycaster();rc.setFromCamera(v,cam);
        const hits=rc.intersectObjects(root.children,true);let id=null;for(const hi of hits){let o=hi.object;while(o&&!o.userData.id)o=o.parent;if(o){id=o.userData.id;break;}if(hi.object.type==="Mesh")break;}onSelect(id);}};
    canvas.addEventListener("pointerup",up);canvas.addEventListener("pointercancel",e=>{pts.delete(e.pointerId);});
    canvas.addEventListener("wheel",e=>{if(mode!=="orbit")return;e.preventDefault();orb.r=Math.max(1.2,Math.min(80,orb.r*(e.deltaY>0?1.1:.9)));draw();},{passive:false});
    canvas.addEventListener("contextmenu",e=>e.preventDefault());
    window.addEventListener("keydown",e=>{if(mode!=="walk"||/input|select|textarea/i.test(e.target.tagName))return;const k=e.key.toLowerCase();if(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k)){keys[k]=1;e.preventDefault();}});
    window.addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=0;});
  }
  function bindJoy(pad,nub){
    let id=null;const set=e=>{const r=pad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,m=r.width/2;let dx=(e.clientX-cx)/m,dy=(e.clientY-cy)/m;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l;}joy.s=dx;joy.f=-dy;nub.style.transform=`translate(${dx*m*.6}px,${dy*m*.6}px)`;};
    pad.addEventListener("pointerdown",e=>{id=e.pointerId;try{pad.setPointerCapture(id);}catch(_){}set(e);e.preventDefault();});
    pad.addEventListener("pointermove",e=>{if(e.pointerId===id)set(e);});
    const end=e=>{if(e.pointerId!==id)return;id=null;joy.f=joy.s=0;nub.style.transform="";};pad.addEventListener("pointerup",end);pad.addEventListener("pointercancel",end);
  }
  return {ok,init,rebuild,resize,draw,setMode,resetOrbit,bindJoy,zoom:f=>{orb.r=Math.max(1.2,Math.min(80,orb.r*f));draw();},get mode(){return mode;},stop:()=>{mode="orbit";joy.f=joy.s=0;}};
})();
