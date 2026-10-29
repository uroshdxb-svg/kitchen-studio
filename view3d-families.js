/* Detailed, catalogue-driven construction. Dimensions are mm; proportions and
 * cosmetic geometry are interpretations, not individually approved product CAD.
 * The 27 individually referenced models keep priority in view3d.js. */
const KS3DFamilies=(()=>{
 const key=(brand,model)=>[brand,model].map(s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'')).join('/');
 const profiles=new Map((typeof KS3DProfiles==='undefined'?[]:KS3DProfiles).map(p=>[p.key,p]));
 const identify=it=>(!it.kind||it.kind==='eq')?profiles.get(key(it.brand,it.model))||null:null;
 const cache=new WeakMap();
 function materials(M){
  if(cache.has(M))return cache.get(M);
  const mat=(c,r=.45,metal=0,extra={})=>new THREE.MeshStandardMaterial({color:KS3DAssets.linear(c),roughness:r,metalness:metal,...extra});
  const m={...M,paint:mat(0xd4d8d5,.38),black:mat(0x202a30,.38),polymer:mat(0xc9cfca,.8),blue:mat(0x366b82,.52),red:mat(0xb6312c,.38),green:mat(0x2d7f56,.48),orange:mat(0xd69b39,.5),clay:mat(0xb09276,.95),stone:mat(0xafa68e,.85),belt:mat(0xb8b6a5,.85),clear:mat(0xd9e6e3,.15,.06,{transparent:true,opacity:.21,depthWrite:false,side:THREE.DoubleSide}),glass:mat(0x7b989d,.17,.12,{transparent:true,opacity:.33,depthWrite:false,side:THREE.DoubleSide}),light:mat(0xd7ebed,.2,.1,{emissive:KS3DAssets.linear(0xd4e7df),emissiveIntensity:.3})};
  m.steel=M.steel.clone();m.steel.metalness=.85;m.steel.roughness=.32;m.steel.envMapIntensity=1.3;
  m.steel2=M.steel2.clone();m.steel2.metalness=.8;m.steel2.roughness=.39;
  cache.set(M,m);return m;
 }
 function build(it,a){
  const p=identify(it);if(!p)return null;if(['planetary','spiral'].includes(p.family)){const g=KS3DEquipment.build(it,a);g.userData.constructionFamily=p.family;g.userData.constructionProfile=p.id;g.userData.features=p.features.slice();return g;}const {w,h,d}=it,m=materials(a.M),g=new THREE.Group(),t=(it.name+' '+it.model).toLowerCase();
  g.userData.constructionFamily=p.family;g.userData.constructionProfile=p.id;g.userData.features=p.features.slice();
  const min=Math.min(w,h,d),fh=it.mount==='floor'?Math.min(.16,100/h):.025;
  function mesh(geo,mat,x=0,y=0,z=0){geo.userData.ownedByScene=true;const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=!mat.transparent;o.receiveShadow=true;g.add(o);return o;}
  function rounded(ww,hh,dd,r){
   if(r<=0)return new THREE.BoxGeometry(ww,hh,dd);
   r=Math.min(r,ww*.2,hh*.2,dd*.2);const geo=new THREE.BoxGeometry(ww,hh,dd,4,4,4),v=geo.attributes.position,n=geo.attributes.normal;
   for(let i=0;i<v.count;i++){const s=[ww,hh,dd],q=[v.getX(i),v.getY(i),v.getZ(i)].map((x,j)=>Math.abs(x)>s[j]*.1&&Math.abs(x)<s[j]*.4?Math.sign(x)*(s[j]/2-r):x),c=q.map((x,j)=>THREE.MathUtils.clamp(x,-s[j]/2+r,s[j]/2-r)),nn=new THREE.Vector3(...q.map((x,j)=>x-c[j])).normalize();v.setXYZ(i,c[0]+nn.x*r,c[1]+nn.y*r,c[2]+nn.z*r);n.setXYZ(i,nn.x,nn.y,nn.z);}return geo;
  }
  function box(x,y,z,ww,hh,dd,mat=m.steel,r=4){if(Math.min(ww,hh,dd)<=0)return null;return mesh(rounded(ww*w,hh*h,dd*d,r),mat,(x+ww/2)*w,(y+hh/2)*h,(z+dd/2)*d);}
  function cylinder(x,y,z,rx,hy,rz,mat=m.steel,taper=1){const o=mesh(new THREE.CylinderGeometry(taper,1,1,32),mat,x*w,(y+hy/2)*h,z*d);o.scale.set(rx*w,hy*h,rz*d);return o;}
  function disc(x,y,z,r,depth,mat=m.steel,axis='z'){const o=mesh(new THREE.CylinderGeometry(r,r,depth,32),mat,x*w,y*h,z*d);if(axis==='z')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.z=Math.PI/2;return o;}
  function tube(pts,r=3,mat=m.steel2){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(v[0]*w,v[1]*h,v[2]*d)),false,'centripetal'),Math.max(6,pts.length*4),r,8,false),mat);}
  function ring(x,y,z,rx,rz,thick=3,mat=m.steel2){const pts=Array.from({length:33},(_,i)=>{const q=i*Math.PI/16;return[x+Math.cos(q)*rx,y,z+Math.sin(q)*rz];});return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(v[0]*w,v[1]*h,v[2]*d)),false,'centripetal'),32,thick,6,false),mat);}
  function bowl(x,y,z,rx,rz,hh,mat=m.steel){
   const pts=[[0,0],[.72,0],[.90,.06],[1,.9],[1,1],[.965,1],[.955,.91],[.86,.09],[.69,.05],[0,.05]].map(([r,y])=>new THREE.Vector2(r,y));const o=mesh(new THREE.LatheGeometry(pts,40),mat,x*w,y*h,z*d);o.scale.set(rx*w,hh*h,rz*d);ring(x,y+hh,z,rx,rz,Math.min(3,min*.008),m.steel2);return o;
  }
  function label(text,x,y,z,ww=.25){return mesh(new THREE.PlaneGeometry(ww*w,ww*w/5),KS3DAssets.label(text),x*w,y*h,z*d);}
  function knob(x,y,z,r=.025,color=m.black){disc(x,y,z,min*r,6,m.steel2);disc(x,y,z+.009,min*r*.82,8,color);box(x-.002,y,z+.018,.004,.018,.002,m.white,0);}
  function panel(x,y,z,ww=.2,hh=.12){box(x,y,z,ww,hh,.012,m.black);box(x+ww*.16,y+hh*.32,z+.014,ww*.68,hh*.48,.002,m.screen);for(let i=0;i<3;i++)disc(x+ww*(.25+i*.25),y+hh*.16,z+.018,min*.008,3,i===0?m.green:m.black);}
  function vents(x,y,z,ww,hh,n=8){box(x,y,z,ww,hh,.006,m.dark,1);for(let i=0;i<n;i++)box(x+.005,y+hh*(i+.4)/n,z+.008,ww-.01,Math.min(.006,hh/n*.3),.007,m.steel2,1);}
  function handle(x,y,z,ww=.24,hh=0){tube([[x,y,z],[x,y,z+.035],[x+ww,y+hh,z+.035],[x+ww,y+hh,z]],Math.max(3,min*.012));}
  function feet(wheels=p.wheels,top=fh){
   for(const x of [.08,.92])for(const z of [.09,.89]){
    if(wheels){const r=Math.min(45,top*h*.38);disc(x,r/h,z,r,Math.min(26,w*.06),m.rubber,'x');disc(x+.015,r/h,z,r*.46,3,m.steel2,'x');box(x-.025,r/h,z-.025,.05,top-r/h,.05,m.steel2,2);box(x-.04,top-.015,z-.04,.08,.015,.08,m.steel2,2);}
    else{cylinder(x,0,z,.025,top*.2,.025,m.rubber);cylinder(x,top*.2,z,.018,top*.8,.018,m.steel2);ring(x,top*.2,z,.025,.025,2);}
   }
  }
  function shell(bottom=fh,top=.96,front=.92,mat=m.steel){
   box(.02,bottom,.02,.96,.018,front-.02,mat);box(.02,bottom,.02,.018,top-bottom,front-.02,mat);box(.962,bottom,.02,.018,top-bottom,front-.02,mat);box(.038,bottom,.02,.924,top-bottom,.018,mat);box(.02,top-.018,.02,.96,.018,front-.02,mat);
  }
  function door(x,y,z,ww,hh,glass=false,hinge='left'){
   if(glass){box(x,y,z,ww,.02,.015,m.rubber);box(x,y+hh-.02,z,ww,.02,.015,m.rubber);box(x,y,z,.02,hh,.015,m.rubber);box(x+ww-.02,y,z,.02,hh,.015,m.rubber);}else box(x,y,z,ww,hh,.015,m.rubber);if(glass){box(x+.012,y+.012,z+.016,.035,hh-.024,.025);box(x+ww-.047,y+.012,z+.016,.035,hh-.024,.025);box(x+.047,y+.012,z+.016,ww-.094,.035,.025);box(x+.047,y+hh-.047,z+.016,ww-.094,.035,.025);box(x+.047,y+.047,z+.019,ww-.094,hh-.094,.004,m.glass,0);}else box(x+.008,y+.008,z+.016,ww-.016,hh-.016,.025);
   const hx=hinge==='left'?x+ww-.06:x+.045;handle(hx,y+hh*.28,z+.044,0,hh*.40);for(const yy of [y+hh*.15,y+hh*.82]){box(hinge==='left'?x+.01:x+ww-.025,yy,z+.041,.015,hh*.055,.017,m.steel2,2);}
  }
  function tray(x,y,z,ww,dd,depth=.06){box(x,y-depth,z,ww,.008,dd,m.steel2,2);box(x,y-depth,z,.008,depth,dd,m.steel2,1);box(x+ww-.008,y-depth,z,.008,depth,dd,m.steel2,1);box(x,y-depth,z,ww,depth,.008,m.steel2,1);box(x,y-depth,z+dd-.008,ww,depth,.008,m.steel2,1);}
  function well(x,y,z,ww,dd,depth=.18){tray(x,y,z,ww,dd,depth);box(x-.008,y,z-.008,ww+.016,.009,.014,m.steel2,2);box(x-.008,y,z+dd-.006,ww+.016,.009,.014,m.steel2,2);box(x-.008,y,z,.014,.009,dd,m.steel2,2);box(x+ww-.006,y,z,.014,.009,dd,m.steel2,2);cylinder(x+ww/2,y-depth+.01,z+dd/2,.022,.002,.022,m.dark);}
  function grille(x,y,z,ww,dd,n=14,mat=m.steel2){for(let j=0;j<n;j++)box(x+ww*j/n,y,z,Math.min(.008,ww/n*.35),.008,dd,mat,1);box(x,y,z,ww,.008,.012,mat,1);box(x,y,z+dd-.012,ww,.008,.012,mat,1);}
  function legsFrame(top=.9,bottom=fh){feet(p.wheels,bottom);for(const x of [.06,.9])for(const z of [.06,.86])box(x,bottom,z,.04,top-bottom,.04,m.steel2,2);for(const z of [.06,.86])box(.06,bottom+.04,z,.88,.025,.04,m.steel2,2);for(const x of [.06,.9])box(x,bottom+.04,.10,.04,.025,.76,m.steel2,2);}
  function faucet(x,y,z,hh=.23){tube([[x,y,z],[x,y+hh*.8,z],[x,y+hh,z+.05],[x,y+hh*.95,z+.18],[x,y+hh*.72,z+.20]],Math.max(3,min*.014));cylinder(x,y,z,.03,.025,.03);handle(x+.02,y+.035,z,.09,0);}
  function worktop(y=.94){box(.01,y,.01,.98,.045,.96,m.steel,3);box(.03,y-.018,.03,.94,.018,.91,m.steel2,2);}
  function rails(bottom=.16,top=.88,n=8){for(let i=0;i<n;i++){const y=bottom+(top-bottom)*i/Math.max(1,n-1);for(const x of [.07,.89]){box(x,y,.08,.04,.008,.72,m.steel2,1);box(x,y,.08,.008,.025,.72,m.steel2,1);}}}
  function brand(y=.83,z=.975){label(it.brand,.5,y,z,Math.min(.30,130/w));}
  function underCooking(top=.78){
   if(p.stockpot||p.wok){legsFrame(top,fh);tray(.08,fh+.10,.08,.84,.78,.035);return;}feet();if(it.mount==='floor'&&h>500){shell(fh,top,.91);if(p.open&&!p.oven){rails(fh+.05,top-.05,2);}else if(p.oven){for(let i=0;i<p.ovens;i++){door(.04+i*.92/p.ovens,fh+.02,.91,.90/p.ovens,top-fh-.05,false);handle(.12+i*.92/p.ovens,top-.10,.958,.64/p.ovens);}vents(.15,fh+.05,.958,.7,.055,4);}else for(let i=0;i<Math.max(1,p.doors);i++)door(.04+i*.92/p.doors,fh+.02,.91,.90/p.doors,top-fh-.05,false,i?'right':'left');}
   else shell(fh,top,.91);
  }
  function cooking(){
   const y=p.clamshell?.66:.88,cols=p.stockpot?1:p.wok?(p.family==='induction'?1:/3-chamber/.test(t)?3:2):Math.max(1,Math.ceil(p.zones/2));underCooking(.72);box(.02,.72,.02,.96,.11,.94);box(.02,.83,.02,.96,.05,.07);box(.02,.81,.89,.96,.07,.07,m.steel2);const n=p.stockpot?1:p.wok?cols:p.zones;
   if(['griddle','solidtop','chargrill','induction'].includes(p.family)){
    const combo=p.burners>0&&['griddle','solidtop'].includes(p.family),surface=combo?.44:.88;box(.06,y-.01,.11,surface,.02,.72,p.family==='induction'?m.black:p.family==='solidtop'?m.iron:m.steel2);
    if(p.family==='chargrill')grille(.07,y+.025,.13,.86,.67,Math.round(w/28),m.iron);
    if(p.family==='griddle'){box(.05,y,.10,.01,.10,.74);box(.94,y,.10,.01,.10,.74);box(.05,y,.10,.9,.1,.015);box(.06,y,.81,.88,.015,.06,m.dark);if(p.ribbed)grille(.08,y+.01,.14,p.smooth?.27:surface-.06,.63,Math.round(w/22),m.iron);handle(.70,.73,.96,.18);}
    if(p.family==='induction'&&p.wok){bowl(.5,y-.14,.48,.34,.34,.14,m.black);}else if(p.family==='induction'&&!p.freezone)for(let i=0;i<n;i++){const x=.10+.8*((i%cols)+.5)/cols,z=.14+.65*(Math.floor(i/cols)+.5)/Math.ceil(n/cols);ring(x,y+.014,z,Math.min(.32/cols,.15),.12,1.2,m.steel2);}
    if(p.family==='solidtop'){const sx=combo?.28:.5;ring(sx,y+.018,.48,.15,.16,2,m.dark);ring(sx,y+.019,.48,.10,.11,2,m.dark);}if(combo){const cols=Math.ceil(p.burners/2);for(let i=0;i<p.burners;i++){const x=.55+.40*(i%cols+.5)/cols,z=.15+.64*(Math.floor(i/cols)+.5)/2;cylinder(x,y,z,.075,.025,.075,m.iron);ring(x,y+.027,z,.07,.07,3,m.steel2);tube([[x-.07,y+.06,z-.13],[x-.07,y+.06,z+.13]],5,m.iron);tube([[x+.07,y+.06,z-.13],[x+.07,y+.06,z+.13]],5,m.iron);tube([[x-.10,y+.06,z],[x+.10,y+.06,z]],5,m.iron);}}if(p.clamshell){box(.06,.86,.13,.88,.08,.66);box(.08,.84,.15,.84,.02,.62,m.iron);for(const x of [.1,.9])tube([[x,.66,.11],[x,.94,.11],[x,.94,.82]],8);handle(.1,.94,.83,.8);}
   }else for(let i=0;i<n;i++){
    const x=.06+.88*((i%cols)+.5)/cols,z=p.wok||p.stockpot?.48:.14+.64*(Math.floor(i/cols)+.5)/Math.ceil(n/cols),rx=Math.min(.34/cols,.24),rz=p.wok?.26:.15;
    if(p.family==='hotplate'||(p.stockpot&&/electric/.test(t))){if(p.square)box(x-rx,y,z-rz,rx*2,.025,rz*2,m.iron);else cylinder(x,y,z,rx,.025,rz,m.iron);ring(x,y+.027,z,rx*.77,rz*.77,1,m.steel2);}
    else{cylinder(x,y,z,rx*.5,.025,rz*.5,m.iron);ring(x,y+.025,z,rx*.5,rz*.5,3,m.steel2);if(p.wok)ring(x,y+.06,z,rx,rz,9,m.iron);else{for(const q of [-1,1]){tube([[x-rx,y+.06,z+rz*q],[x+rx,y+.06,z+rz*q]],5,m.iron);tube([[x+rx*q,y+.06,z-rz],[x+rx*q,y+.06,z+rz]],5,m.iron);}tube([[x-rx,y+.06,z],[x+rx,y+.06,z]],6,m.iron);tube([[x,y+.06,z-rz],[x,y+.06,z+rz]],6,m.iron);}}
   }
   for(let i=0;i<(['range','hotplate','induction'].includes(p.family)?n:Math.max(1,Math.round(w/450)));i++)knob((i+.5)/(['range','hotplate','induction'].includes(p.family)?n:Math.max(1,Math.round(w/450))),.775,.97,.027);
   if(p.wok)faucet(.5,.88,.04,.12);
  }
  function fryer(){
   underCooking(.67);const n=Math.max(1,p.wells),ww=.88/n;
   box(.02,.67,.02,.96,.30,.12);box(.02,.67,.14,.03,.18,.82);box(.95,.67,.14,.03,.18,.82);box(.05,.67,.88,.9,.18,.08);vents(.07,.86,.145,.86,.10,5);
   for(let i=0;i<n;i++){const x=.06+ww*i;well(x,.84,.18,ww-.025,.64,.16);box(x+.012,.69,.19,ww-.05,.008,.61,p.family==='pasta'?m.water:m.oil);
    const bx=x+.02,bw=ww-.065;for(let j=0;j<9;j++){const z=.21+.56*j/8;tube([[bx,.87,z],[bx,.76,z],[bx+bw,.76,z],[bx+bw,.87,z]],1.6);}
    for(let j=0;j<8;j++){const xx=bx+bw*j/7;tube([[xx,.87,.21],[xx,.76,.21],[xx,.76,.77],[xx,.87,.77]],1.6);}for(const yy of [.78,.82,.87])tube([[bx,yy,.21],[bx+bw,yy,.21],[bx+bw,yy,.77],[bx,yy,.77],[bx,yy,.21]],1.6);
    tube([[x+ww*.5,.87,.77],[x+ww*.5,.97,.85],[x+ww*.5,.97,.96]],5,m.black);knob(x+ww*.5,.77,.975,.027);
    if(p.pressure){box(x,.86,.19,ww-.025,.04,.61,m.steel2,8);handle(x+.08,.91,.82,ww-.18);tube([[x+.05,.96,.25],[x+ww*.5,.98,.55],[x+ww-.07,.96,.25]],6);}
   }if(p.family==='pasta')faucet(.90,.83,.13,.15);
  }
  function cupboard(){
   const low=['cabinet','hotcupboard','counter','drawers'].includes(p.family),top=p.upstand?.86:.97;feet();shell(fh,p.pans?top-.10:top,.92);
   const comp=p.family==='counter'&&w>1250?.22:0,span=.92-comp,drawerCount=p.drawers||(['drawers'].includes(p.family)?2:0);
   if(comp)vents(.04,fh+.07,.945,comp-.06,top-fh-.18,16);
   if(p.plainFront&&!drawerCount){box(.04,fh,.93,.92,top-fh,.03);}else if(p.open){rails(fh+.06,top-.06,2);}
   else if(drawerCount){const cols=drawerCount>3?Math.ceil(drawerCount/2):drawerCount===1?1:it.h>700?1:drawerCount,rs=Math.ceil(drawerCount/cols);for(let i=0;i<drawerCount;i++){const x=.04+comp+(i%cols)*span/cols,y=fh+.015+Math.floor(i/cols)*(top-fh-.03)/rs,hh=(top-fh-.03)/rs-.015;box(x,y,.925,span/cols-.015,hh,.035);handle(x+span/cols*.15,y+hh*.77,.96,span/cols*.65);}}
   else for(let i=0;i<p.doors;i++){
    const x=.04+comp+i*span/p.doors;if(/sliding/.test(t)){box(x,fh+.02,.92+i*.012,span/p.doors+.015,top-fh-.05,.025);box(x+span/p.doors*.75,fh+(top-fh)*.47,.954+i*.012,.045,.09,.008,m.dark,4);}else door(x,fh+.02,.92,span/p.doors-.015,top-fh-.05,p.glass,i?'right':'left');
   }
   if(p.glass){for(const y of [.25,.45,.65,.83])grille(.06,y,.10,.86,.75,12);box(.06,fh,.90,.008,top-fh,.008,m.light);}
   if(low&&!p.pans)worktop(top-.035);
   if(p.upstand)box(.01,top,.01,.98,.99-top,.025);
   if(p.pans){const n=p.panCount,rows=p.family==='counter'?2:1,cols=Math.ceil(n/rows),depth=p.family==='counter'?.43:.82;for(let i=0;i<n;i++)well(.05+(i%cols)*.9/cols,.99,.06+Math.floor(i/cols)*depth/rows,.9/cols-.012,depth/rows-.012,.07);if(p.family==='counter')box(.03,.94,.52,.94,.03,.40,m.white);}
   if(['hotcupboard','counter','drawers'].includes(p.family))panel(comp?.05:.80,top-.09,.968,.12,.06);
  }
  function refrigeration(){
   if(p.family==='counter'){cupboard();return;}
   if(p.family==='chest'){feet(true);shell(fh,.91,.94);box(.02,.91,.02,.96,.02,.93,m.rubber);box(.02,.93,.02,.96,.05,.93);handle(.33,.95,.94,.34);vents(.69,.18,.967,.24,.18,9);return;}
   const blast=p.family==='blast',base=blast?.24:.12,top=blast?.95:.85;feet();shell(fh,.97,.92);box(.04,base,.05,.92,top-base,.007,m.dark);rails(base+.05,top-.04,Math.min(15,Math.round(h/100)));
   for(let i=0;i<p.doors;i++)door(.04+.92*i/p.doors,base,.93,.90/p.doors,top-base,p.glass,i?'right':'left');
   vents(.05,blast?fh+.025:.87,.95,.90,blast?base-fh-.07:.075,blast?7:5);panel(.78,blast?base-.075:.89,.965,.15,.055);brand(blast?.93:.965,.975);
  }
  function oven(){
   const charcoal=p.family==='charcoal',rack=p.family==='rackoven',micro=p.family==='microwave',rapid=p.family==='rapid',hold=p.family==='holding',deck=p.family==='deck';feet(p.wheels||hold||rack);const base=charcoal&&it.mount==='floor'?.28:fh,top=charcoal?.74:.97;shell(base,top,.92,charcoal?m.black:m.steel);const left=p.leftControls,control=micro?.22:deck?.17:.19,dx=left?.04+control:.04,dw=.91-control;
   if(charcoal){box(.05,base+.02,.12,.90,top-base-.05,.01,m.dark);grille(.08,base+(top-base)*.5,.15,.84,.70,18,m.iron);door(.04,base+.04,.92,.92,top-base-.10,false);handle(.25,base+(top-base)*.7,.97,.5);vents(.15,base+.05,.973,.7,.07,4);cylinder(.50,.74,.22,.065,.18,.085,m.black);cylinder(.5,.92,.22,.12,.025,.14,m.black);disc(.5,.82,.31,18,5,m.steel2);if(base>.2)legsFrame(base,fh);brand(top-.04);return;}
   const compartments=deck?p.decks:hold&&h>1500?2:p.family==='rapid'&&p.decks>1?p.decks:1;
   for(let q=0;q<compartments;q++){
    const y=base+.025+q*(top-base-.04)/compartments,hh=(top-base-.05)/compartments-.015;
    box(dx+.03,y+.025,.08,dw-.06,hh-.05,.008,m.dark);for(let i=0;i<(deck?1:Math.max(2,Math.round(h*hh/90)));i++){const yy=y+.05+(hh-.10)*i/Math.max(1,(deck?1:Math.round(h*hh/90))-1);grille(dx+.045,yy,.13,dw-.09,.72,deck?2:8,deck?m.stone:m.steel2);}
    door(dx,y,.92,dw,hh,(!hold||p.glass)&&!p.solidDoor,left?'right':'left');
    if(deck||rapid)handle(dx+dw*.16,y+hh*.80,.968,dw*.68);
    if(deck){panel(left?.04:.80,y+hh*.48,.96,.14,hh*.24);knob(left?.10:.87,y+hh*.2,.975);}
   }
   if(!deck){const cx=left?.04:.80;box(cx,base+.025,.93,control-.03,top-base-.05,.02,m.black);panel(cx+.02,top-.27,.955,control-.07,.19);knob(cx+(control-.03)/2,base+(top-base)*.30,.975,.035);if(micro)for(let i=0;i<6;i++)disc(cx+.035+(i%2)*.07,base+.07+Math.floor(i/2)*.07,.978,5,2,m.steel2);}
   if(rack){box(.05,.90,.05,.90,.08,.8);vents(.10,.92,.94,.65,.04,4);}brand(.98,.975);
  }
  function conveyor(){
   const toaster=p.family==='toaster',y=it.mount==='floor'?.50:.25;feet();if(it.mount==='floor')legsFrame(y,fh);const start=toaster?.08:.25,span=toaster?.84:.5;
   box(start,y,.08,span,.04,.82);box(start,y+.04,.08,.045,.48,.82);box(start+span-.045,y+.04,.08,.045,.48,.82);box(start,y+.49,.08,span,.12,.82);box(start,y,.08,span,.6,.035);
   if(toaster){grille(.10,y+.08,.10,.80,.83,23);box(.12,y-.05,.55,.76,.035,.40,m.steel2);panel(.62,y+.49,.918,.22,.09);for(const z of [.12,.88])disc(.5,y+.10,z,.04*h,.8*w,m.steel2,'x');}
   else{for(let i=0;i<46;i++)box(.025+i*.95/46,y+.06,.18,.012,.009,.64,m.steel2,1);for(const x of [.03,.97])disc(x,y+.04,.50,.035*h,.64*d,m.steel2,'z');for(const z of [.15,.83])box(.02,y-.025,z,.96,.06,.025);panel(.64,y+.29,.926,.10,.15);vents(.3,y+.51,.923,.25,.06,5);}
   brand(y+.57,.93);
  }
  function waterCooking(){
   if(p.family==='kettle'||p.family==='tandoor'){feet();const y=.2;legsFrame(.4,fh);bowl(.50,y,.48,.40,.38,.62,p.family==='tandoor'?m.clay:m.steel);if(p.family==='tandoor'){shell(fh,.83,.94);ring(.5,.84,.48,.35,.35,12,m.clay);cylinder(.5,.87,.48,.22,.025,.22);handle(.4,.92,.48,.2);vents(.3,.17,.967,.4,.12,6);}else{cylinder(.5,.83,.48,.39,.018,.37);handle(.35,.89,.48,.3);disc(.10,.62,.48,35,35,m.steel2,'x');disc(.90,.62,.48,35,35,m.steel2,'x');tube([[.5,.25,.80],[.5,.25,.95],[.5,.2,.97]],14);knob(.5,.3,.96,.05);panel(.02,.48,.90,.16,.14);}return;}
   if(p.family==='bratt'){feet();box(.02,fh,.04,.14,.90-fh,.86);box(.84,fh,.04,.14,.90-fh,.86);well(.19,.82,.12,.62,.72,.35);box(.18,.84,.08,.64,.035,.70);handle(.32,.88,.84,.36);disc(.84,.68,.50,35,30,m.steel2,'x');disc(.94,.55,.96,min*.09,10,m.steel2);knob(.94,.55,.98,.07);panel(.025,.64,.92,.12,.19);return;}
   // Water bath and food holding wells have actual recessed cavities.
   underCooking(.72);const n=Math.max(1,Math.round(w/400));for(let i=0;i<n;i++)well(.05+i*.9/n,.92,.09,.9/n-.025,.74,.18);box(.02,.72,.86,.96,.20,.10);knob(.77,.82,.975,.03);disc(.2,.82,.975,8,5,m.green);
  }
  function display(){
   const multi=p.family==='multideck',low=it.mount==='top',base=low?.14:.27;feet();shell(fh,base,.94);vents(.07,fh+.02,.96,.86,base-fh-.06,6);box(.03,base,.02,.94,.98-base,.03);box(.03,base,.05,.016,.98-base,.86,m.glass);box(.951,base,.05,.016,.98-base,.86,m.glass);
   for(let i=0;i<(multi?5:3);i++){const y=base+.03+i*(.87-base)/(multi?5:3);box(.055,y,.08,.89,.012,multi?.64:.79,m.steel2,2);box(.055,y+.005,multi?.72:.87,.89,.016,.012,m.white,1);}
   box(.03,.96,.02,.94,.025,.9);box(.06,.94,.78,.88,.006,.012,m.light);if(!multi)box(.04,base,.92,.92,.94-base,.005,m.glass);panel(.77,base-.08,.975,.14,.055);
  }
  function ice(){
   feet();const combined=p.modular&&!p.headOnly,split=combined?.58:p.headOnly?.12:.78;shell(fh,.97,.94);if(!p.headOnly){door(.055,fh+.10,.93,.89,split-fh-.13,false);handle(.28,split-.065,.975,.44);}vents(.06,p.headOnly?.18:combined?.68:fh+.02,.96,.88,p.headOnly?.55:combined?.15:.07,p.headOnly?16:8);if(combined)box(.04,.60,.04,.92,.015,.9,m.black);panel(.76,.88,.969,.15,.06);brand(.955,.976);
  }
  function washer(){
   feet();const hood=p.family==='dishhood',conv=p.family==='dishconveyor';shell(fh,hood?.40:conv?.45:.96,.91);
   if(hood){for(const x of [.05,.91])box(x,.40,.05,.035,.53,.04);box(.04,.63,.04,.92,.32,.87);grille(.10,.43,.13,.80,.70,12);for(let i=0;i<8;i++)tube([[.12,.45,.14+i*.085],[.12,.55,.14+i*.085],[.88,.55,.14+i*.085],[.88,.45,.14+i*.085]],2,m.blue);handle(.04,.67,.93,.92);tube([[.04,.67,.93],[.04,.8,.5],[.04,.8,.09]],5);tube([[.96,.67,.93],[.96,.8,.5],[.96,.8,.09]],5);panel(.35,.31,.93,.30,.07);}
   else if(conv){box(.15,.45,.06,.70,.48,.025);box(.15,.91,.06,.70,.06,.86);for(const x of [.15,.82]){box(x,.45,.06,.025,.46,.86);for(let j=0;j<10;j++)box(x,.47,.12+j*.073,.012,.4,.062,m.rubber,1);}for(let i=0;i<25;i++)box(.03+i*.94/25,.46,.13,.013,.015,.70,m.blue,1);for(let i=0;i<2;i++)door(.20+i*.30,.52,.925,.28,.32);panel(.64,.86,.963,.14,.06);}
   else{box(.07,fh+.06,.08,.86,.68,.015,m.dark);grille(.10,fh+.12,.15,.8,.68,12);door(.045,fh+.035,.925,.91,.83-fh,false);handle(.20,.76,.97,.60);panel(.59,.86,.957,.29,.07);vents(.08,fh+.02,.96,.4,.04,3);}brand(.98,.97);
  }
  function table(){
   const y=p.upstand?.88:.96;legsFrame(y-.02,fh);worktop(y-.035);if(p.shelf)tray(.07,.22,.07,.86,.80,.035);if(p.upstand)box(.01,y,.01,.98,.99-y,.02);if(w>2000)for(const z of [.06,.86]){box(.48,fh,z,.04,y-fh,.04,m.steel2);cylinder(.5,0,z+.02,.025,fh,.025,m.steel2);}for(const x of [.08,.92])for(const z of [.09,.88])disc(x,y-.04,z,3,3,m.steel2);}
  function stand(){
   const sides=/stand ii|stand iii|stand iv|mobility|ultravent|xs stand ii/i.test(t),back=/stand iii|stand iv|ultravent/.test(t),doors=/stand iv/.test(t);legsFrame(.96,fh);worktop(.94);if(sides)for(const x of [.04,.94])box(x,fh+.03,.06,.02,.90-fh,.83);if(back)box(.06,fh+.03,.04,.88,.90-fh,.02);if(doors)for(let i=0;i<2;i++)door(.05+i*.45,fh+.02,.92,.44,.90-fh,false,i?'right':'left');else if(sides)rails(fh+.06,.87,Math.max(3,Math.min(20,Math.round(h/60))));else tray(.07,fh+.15,.07,.86,.80,.03);}
  function storage(){
   const f=p.family;if(f==='table'){table();return;}if(f==='stand'){stand();return;}if(f==='cabinet'){cupboard();return;}
   if(f==='sink'){shell(fh,.84,.92);well(.10,.94,.22,.80,.64,.55);faucet(.5,.87,.10,.12);return;}
   if(['traytrolley','rack','trolley','platedispenser','dishcaddy','dolly'].includes(f)){
    if(f==='rack'&&p.dunnage){legsFrame(.90,.08);grille(.03,.92,.03,.94,.91,Math.round(w/70),m.polymer);return;}const mobile=f!=='rack',bottom=mobile?Math.min(.25,110/h):fh;feet(mobile,bottom);
    if(f==='dolly'){box(.03,bottom,.04,.94,.17,.90,/brute/.test(t)?m.black:m.blue);for(const z of [.04,.90])box(.03,bottom+.17,z,.94,.10,.035,m.blue);return;}
    if(f==='platedispenser'){shell(bottom,.86,.94);for(const x of [.27,.73]){cylinder(x,.86,.48,.17,.015,.29,m.dark);for(let k=0;k<9;k++){cylinder(x,.84+k*.008,.48,.155,.006,.27,m.white);ring(x,.85+k*.008,.48,.155,.27,1,m.steel2);}tube([[x-.18,.85,.40],[x-.18,.97,.40]],4);tube([[x+.18,.85,.40],[x+.18,.97,.40]],4);}handle(.08,.95,.90,.84);return;}
    if(f==='dishcaddy'){box(.04,bottom,.04,.92,.60,.90,m.blue,15);for(let i=0;i<6;i++){const x=.2+(i%3)*.30,z=.28+Math.floor(i/3)*.43;cylinder(x,.50,z,.125,.30,.17,m.dark);for(let j=0;j<10;j++)ring(x,.69+j*.015,z,.12,.165,2,m.white);}handle(.06,.88,.87,.88);return;}
    for(const x of [.05,.92])for(const z of [.06,.88])cylinder(x,bottom,z,.018,.97-bottom,.025,/cambro/i.test(it.brand)?m.polymer:m.steel2);
    if(f==='traytrolley'){const n=Math.min(24,Math.max(4,p.levels)),cols=w>800?Math.round(w/500):1;for(let i=0;i<n;i++){const y=bottom+.04+(.87-bottom)*i/n;for(let col=0;col<cols;col++)for(const x of [.08+col*.86/cols,.08+(col+1)*.86/cols-.03]){box(x,y,.09,.03,.009,.77,m.steel2,1);box(x,y,.09,.006,.025,.77,m.steel2,1);}}}
    else{const n=f==='rack'?/dunnage/.test(t)?1:p.shelves:/platform/.test(t)?1:p.shelves;for(let j=0;j<n;j++){const y=n===1?f==='rack'?.91:bottom+.04:bottom+.03+(.90-bottom)*j/(n-1);if(f==='rack'){grille(.05,y,.07,.90,.83,Math.max(9,Math.round(w/35)),/cambro/i.test(it.brand)?m.polymer:m.steel2);for(const z of [.07,.86])box(.05,y-.02,z,.90,.025,.025,m.steel2,1);}else tray(.05,y,.07,.90,.83,.035);}}
    if(mobile)handle(.05,.95,.92,.87);return;
   }
   if(f==='transport'){feet(p.wheels||h>900);shell(fh,.97,.93,m.black);const n=h>1000?2:1;for(let i=0;i<n;i++){const y=fh+.025+i*(.92-fh)/n,hh=(.91-fh)/n;box(.055,y,.935,.89,hh,.025,m.rubber,10);box(.075,y+.015,.965,.85,hh-.03,.025,m.black,12);for(const x of [.05,.90]){box(x,y+hh*.20,.97,.05,hh*.16,.04,m.steel2);box(x,y+hh*.67,.97,.05,hh*.16,.04,m.steel2);}for(let j=0;j<4;j++)box(.18,y+hh*(.2+j*.17),.993,.64,.015,.006,m.polymer,2);}handle(.15,.99,.45,.7);return;}
   if(f==='ingredient'||f==='waste'){
    const y=p.wheels?.14:.02;feet(p.wheels,y);const round=/round|brute/.test(t);if(round){bowl(.5,y,.5,.43,.43,.86,m.polymer);for(const x of [.02,.88])box(x,.77,.40,.10,.08,.20,m.polymer,8);}
    else{shell(y,.83,.94,m.polymer);box(.07,.83,.07,.86,.025,.84,m.polymer,8);if(f==='ingredient'){box(.06,.86,.07,.88,.08,.82,m.clear,8);handle(.33,.93,.86,.34);box(.08,.86,.07,.84,.08,.26,m.polymer,6);}else{box(.07,.08,.08,.86,.72,.01,m.dark);for(const x of [.03,.94])box(x,.80,.2,.03,.13,.6,m.polymer,4);}}return;
   }
  }
  function smallPrep(){
   const f=p.family,cx=.5,cz=.42;feet(false,.035);
   if(['planetary','spiral','cutter','cookingprocessor','rice','soupkettle','peeler','spinner'].includes(f)){
    const spiral=f==='spiral',planet=f==='planetary',cutter=f==='cutter',rice=f==='rice'||f==='soupkettle',drum=f==='peeler'||f==='spinner';
    if(planet||spiral){box(.08,.025,.07,.84,.07,.84,m.paint,12);box(.23,.06,.06,.54,.74,.22,m.paint,14);box(.17,.77,.08,.66,.17,.70,m.paint,18);const by=spiral?.12:.24,hh=spiral?.48:.38; bowl(.5,by,.61,.36,.29,hh);cylinder(.5,by-.02,.61,.28,.025,.23,m.steel2);tube([[.5,.83,.58],[.5,.48,.58],[.62,.40,.64],[.54,.34,.72]],7);if(spiral)tube([[.58,.79,.47],[.58,.25,.47]],6);for(let i=0;i<12;i++){const q=Math.PI*i/11;tube([[.5+.35*Math.cos(q),by+hh,.61+.28*Math.sin(q)],[.5+.32*Math.cos(q),.76,.61+.25*Math.sin(q)]],2);}ring(.5,.76,.61,.33,.26,3);handle(.12,.56,.2,0,.18);panel(.32,.82,.79,.36,.10);return;}
    if(drum){const by=f==='peeler'?.22:.12;bowl(.5,by,.46,.40,.38,.65,m.steel);cylinder(.5,.88,.46,.40,.025,.38,m.clear);handle(.35,.94,.53,.3);if(f==='peeler'){box(.28,.26,.77,.44,.30,.13);box(.30,.30,.91,.40,.20,.05,m.dark);tray(.26,.28,.90,.48,.10,.04);handle(.36,.48,.97,.28);legsFrame(.28,.06);}else feet(true,.13);panel(.69,.72,.85,.20,.14);return;}
    if(rice){const coat=f==='soupkettle'?m.black:m.paint;bowl(.5,.08,.5,.44,.41,.68,coat);cylinder(.5,.76,.5,.45,.04,.42,m.steel2);cylinder(.5,.8,.5,.42,.05,.40,m.steel2,.75);handle(.36,.90,.5,.28);for(const x of [.015,.88])box(x,.49,.38,.105,.08,.24,m.black,8);knob(.5,.26,.94,.06);return;}
    const heated=f==='cookingprocessor';box(.06,.03,.08,.88,.30,.79,heated?m.paint:m.steel,15);bowl(.50,.34,.45,.37,.32,.43);cylinder(.5,.77,.45,.39,.03,.34,heated?m.black:m.clear);handle(.28,.82,.46,.44);cylinder(.5,.38,.45,.035,.38,.035,m.paint);for(const x of [.18,.5])box(x,.40,.40,.32,.005,.09,m.steel2,1);handle(.87,.41,.43,0,.26);panel(.21,.10,.91,.40,.16);knob(.76,.18,.94,.045);return;
   }
   if(f==='bonesaw'){box(.06,.03,.08,.88,.30,.80);box(.05,.33,.13,.24,.50,.24);box(.05,.82,.13,.86,.13,.24);worktop(.34);box(.77,.38,.28,.006,.48,.035,m.steel2,0);box(.47,.36,.15,.018,.17,.72);box(.20,.84,.375,.67,.035,.01,m.black);knob(.19,.19,.93,.04,m.green);knob(.34,.19,.93,.04,m.red);handle(.60,.43,.82,.12);return;}
   if(f==='breadslicer'){shell(.04,.73,.90);box(.07,.73,.08,.86,.08,.28);for(let i=0;i<24;i++)box(.08+i*.84/24,.37,.40,.004,.39,.33,m.steel2,0);tray(.08,.39,.47,.84,.45,.035);handle(.18,.92,.50,.64);panel(.72,.14,.95,.18,.12);return;}
   if(f==='slicer'){box(.06,.04,.08,.88,.15,.83,m.paint,12);const blade=disc(.59,.57,.43,Math.min(w*.36,h*.39),8,m.steel2,'z');disc(.59,.57,.448,Math.min(w*.32,h*.34),5,m.steel,'z');disc(.59,.57,.46,min*.05,10,m.black);box(.10,.28,.49,.53,.035,.43);box(.08,.28,.51,.04,.32,.36);tube([[.17,.26,.85],[.78,.26,.85]],7);box(.51,.91,.36,.22,.07,.17,m.black,7);knob(.80,.19,.96,.07);handle(.10,.60,.86,.25);return;}
   if(f==='circulator'){box(.08,.63,.07,.84,.32,.76,m.black,12);panel(.16,.70,.85,.68,.17);cylinder(.5,.05,.43,.20,.58,.20);for(let i=0;i<6;i++)box(.31+i*.07,.05,.62,.025,.12,.02,m.dark,1);tube([[.78,.65,.35],[.99,.65,.35],[.99,.40,.35]],5);return;}
   if(f==='pacotizer'){box(.08,.03,.04,.84,.075,.88,m.black,10);box(.12,.09,.05,.76,.86,.25,m.steel,12);box(.08,.64,.05,.84,.32,.78,m.steel,14);bowl(.5,.13,.61,.32,.27,.43);cylinder(.5,.55,.61,.34,.04,.29,m.black);handle(.16,.22,.85,0,.23);panel(.18,.75,.85,.64,.14);brand(.68,.86);return;}
   if(f==='mincer'||f==='sieve'){box(.12,.06,.06,.76,.44,.60,m.steel,16);disc(.5,.34,.68,min*.19,.42*d,m.steel2);disc(.5,.34,.90,min*.19,12,m.steel2);disc(.5,.34,.92,min*.155,3,m.dark);for(let i=0;i<20;i++){const q=i*Math.PI*.1;disc(.5+Math.cos(q)*.13,.34+Math.sin(q)*min*.13/h,.928,2.7,2,m.steel2);}cylinder(.50,.49,.48,.13,.24,.15);tray(.10,.81,.10,.80,.72,.08);cylinder(.5,.75,.47,.095,.22,.10,m.polymer);panel(.20,.13,.68,.25,.16);return;}
   if(f==='veg'||f==='juicer'){box(.07,.04,.08,.63,.43,.76,m.steel,12);cylinder(.40,.47,.43,.32,.14,.32);bowl(.40,.60,.43,.26,.25,.21);cylinder(.4,.80,.43,.24,.012,.23,m.black);tube([[.14,.64,.43],[.14,.94,.43],[.40,.94,.43],[.40,.82,.43]],5);box(.64,.46,.18,.32,.04,.53);box(.65,.50,.18,.30,.15,.025);box(.65,.50,.685,.30,.15,.025);panel(.17,.15,.94,.30,.19);if(f==='juicer'){box(.70,.11,.06,.25,.55,.58,m.black,10);tray(.13,.05,.73,.62,.26,.035);}return;}
   if(f==='liquidiser'){feet(true,.09);box(.12,.09,.08,.76,.035,.21);cylinder(.5,.11,.18,.045,.57,.035);box(.17,.62,.09,.66,.19,.24,m.steel,12);tube([[.5,.63,.25],[.5,.34,.91]],19);cylinder(.5,.20,.92,.11,.12,.06,m.steel2);panel(.28,.67,.35,.44,.10);return;}
  }
  function beverages(){
   const f=p.family;feet();
   if(f==='espresso'){box(.03,.04,.04,.94,.10,.89);box(.03,.14,.04,.94,.54,.37,m.steel,14);box(.03,.65,.04,.94,.16,.69,m.steel,13);grille(.08,.15,.48,.84,.43,24);for(const x of [.07,.92])tube([[x,.84,.10],[x,.90,.10],[x,.90,.69],[x,.84,.69]],4);tube([[.07,.90,.10],[.92,.90,.10]],4);for(let i=0;i<p.groups;i++){const x=.16+.68*(i+.5)/p.groups;cylinder(x,.43,.60,.052,.14,.09,m.steel2);tube([[x,.45,.61],[x,.43,.80],[x,.42,.94]],6,m.black);for(let j=0;j<4;j++)disc(x-.045+j*.03,.72,.76,4,3,m.black);}for(const x of [.09,.91]){knob(x,.62,.79,.03);tube([[x,.58,.74],[x,.47,.89],[x,.22,.88]],4);}brand(.82,.75);return;}
   if(f==='grinder'){box(.10,.03,.08,.80,.08,.82,m.black,12);cylinder(.5,.11,.4,.30,.45,.28,m.black);bowl(.5,.65,.40,.37,.33,.27,m.clear);cylinder(.5,.94,.4,.38,.025,.34,m.black);ring(.5,.64,.40,.31,.29,6,m.black);panel(.34,.42,.74,.32,.16);tube([[.35,.26,.60],[.35,.26,.85]],4);tube([[.65,.26,.60],[.65,.26,.85]],4);tray(.21,.12,.63,.58,.29,.025);return;}
   if(f==='brewer'){box(.12,.03,.05,.76,.05,.90,m.black);box(.10,.08,.04,.80,.81,.24);box(.04,.79,.05,.92,.16,.80);bowl(.5,.67,.59,.34,.28,.12,m.black);cylinder(.5,.12,.59,.30,.47,.27);cylinder(.5,.60,.59,.30,.04,.27,m.black);tube([[.5,.62,.60],[.5,.68,.60],[.5,.68,.80]],5,m.black);panel(.17,.83,.87,.66,.10);return;}
   if(f==='automatic'){shell(.06,.78,.88,m.black);for(const x of [.26,.74]){bowl(x,.79,.35,.22,.26,.15,m.clear);cylinder(x,.95,.35,.23,.025,.27,m.black);}panel(.14,.53,.92,.72,.20);box(.15,.14,.73,.70,.37,.02,m.dark);for(const x of [.44,.56])cylinder(x,.39,.84,.025,.08,.025);grille(.13,.12,.70,.74,.25,13);return;}
   if(f==='drinkmixer'){box(.05,.03,.08,.90,.07,.84,m.black);box(.10,.10,.07,.80,.67,.13,m.steel2);for(let i=0;i<3;i++){const x=.18+i*.32;cylinder(x,.79,.28,.15,.16,.19,m.paint);cylinder(x,.30,.43,.012,.50,.013,m.steel2);bowl(x,.15,.45,.13,.18,.40);knob(x,.87,.49,.025);}return;}
   if(f==='softserve'){shell(fh,.95,.88);vents(.05,.17,.91,.90,.20,12);box(.17,.52,.90,.66,.20,.065,m.black,8);cylinder(.5,.44,.94,.05,.12,.05,m.polymer);tube([[.50,.64,.95],[.50,.86,.97]],6,m.black);grille(.15,.12,.77,.70,.21,15);panel(.25,.79,.91,.50,.12);box(.06,.95,.06,.88,.025,.79);return;}
   if(f==='slush'){shell(fh,.34,.89);vents(.10,.12,.92,.8,.13,8);const n=/3/.test(it.model)&&!/2/.test(it.model)?3:2;for(let i=0;i<n;i++){const x=(i+.5)/n;cylinder(x,.39,.42,.43/n,.43,.33,m.clear);cylinder(x,.82,.42,.45/n,.055,.34,m.black);disc(x,.59,.65,min*.14,.48*d,m.polymer);cylinder(x,.30,.89,.035,.15,.035,m.black);tube([[x,.45,.85],[x,.56,.90]],4,m.black);tray(x-.36/n,.07,.75,.72/n,.23,.025);}return;}
   if(f==='citrus'){shell(fh,.93,.88,m.orange);box(.10,.27,.88,.80,.55,.005,m.clear);for(const x of [.31,.69])for(const y of [.43,.64])disc(x,y,.77,min*.16,55,m.orange);bowl(.5,.85,.35,.31,.28,.12,m.steel);grille(.12,.13,.64,.76,.33,16);panel(.72,.18,.93,.15,.07);return;}
  }
  function vacuum(){
   const floor=it.mount==='floor',bottom=floor?.72:.64,n=p.wells;feet(floor);shell(fh,bottom,.92);for(let i=0;i<n;i++){const x=.05+i*.90/n,ww=.90/n-.015;well(x,bottom+.025,.09,ww,.76,.09);box(x+.03,bottom+.02,.78,ww-.06,.025,.045,m.orange,2);if(n===1){box(x+.01,bottom+.04,.10,ww-.02,.16,.73,m.clear,20);handle(x+ww*.2,bottom+.20,.88,ww*.6);}else{box(x+.01,.78,.10,ww-.02,.06,.73,m.steel2,16);for(const z of [.12,.83])tube([[.10,.65,z],[.10,.89,z],[.9,.89,z],[.9,.65,z]],8);}}panel(.20,Math.max(.07,bottom-.17),.96,.42,.12);knob(.78,bottom-.10,.965,.045);brand(bottom-.03);}
  function countertop(){
   const f=p.family;if(f==='salamander'){box(.04,.04,.05,.92,.10,.87);box(.05,.14,.05,.12,.80,.18);box(.83,.14,.05,.12,.80,.18);box(.04,.73,.05,.92,.20,.85);grille(.10,.23,.16,.80,.69,20);box(.10,.71,.15,.80,.02,.66,m.iron);handle(.14,.73,.92,.72);tray(.08,.17,.14,.84,.77,.04);knob(.88,.84,.93,.035);return;}
   if(f==='stripheater'){box(.02,.20,.12,.96,.65,.76);for(const z of [.24,.50,.76])tube([[.07,.17,z],[.93,.17,z]],4,m.iron);for(const x of [.14,.84])box(x,.85,.20,.04,.15,.60,m.steel2);return;}
   if(f==='heatedshelf'){feet(false,.18);worktop(.57);knob(.85,.40,.97,.05);return;}
   if(f==='cubbies'){feet();const rows=2,cols=/locker/.test(t)?2:Math.max(2,Math.round(w/210));shell(fh,.96,.92);for(let i=1;i<cols;i++)box(.04+.92*i/cols,fh,.05,.015,.92-fh,.86);for(let j=0;j<rows;j++){box(.04,fh+(j+1)*(.89-fh)/rows,.04,.92,.025,.87);for(let i=0;i<cols;i++){tray(.055+i*.92/cols,fh+.05+j*(.89-fh)/rows,.13,.92/cols-.03,.75,.03);panel(.075+i*.92/cols,fh+(j+1)*(.89-fh)/rows+.006,.93,.92/cols-.06,.04);}}return;}
   if(f==='chipdump'&&h<=450){feet();shell(fh,.70,.92);well(.08,.95,.10,.84,.77,.18);grille(.10,.79,.12,.80,.73,18);box(.02,.70,.91,.96,.24,.05);knob(.80,.81,.98,.04);return;}
   if(f==='carving'||f==='chipdump'){box(.04,.04,.08,.92,.16,.87);well(.09,.24,.15,.82,.72,.07);if(f==='carving'||h>450){tube([[.12,.20,.12],[.12,.84,.12],[.5,.94,.55]],9);if(f==='carving'){cylinder(.5,.77,.55,.20,.15,.19,m.steel2,.45);cylinder(.5,.76,.55,.16,.015,.16,m.lamp);}else{box(.05,.81,.10,.90,.12,.72);box(.1,.795,.16,.8,.02,.59,m.lamp);}}grille(.12,.21,.18,.76,.65,18);knob(.81,.12,.97,.035);return;}
   if(f==='buntoaster'){shell(.05,.84,.76);box(.11,.85,.08,.78,.015,.64,m.black);box(.08,.86,.08,.84,.10,.035);box(.08,.86,.70,.84,.10,.035);const chute=box(.12,.15,.68,.76,.025,.29);chute.rotation.x=-.3;knob(.25,.63,.80,.04);knob(.75,.63,.80,.04);return;}
   if(f==='steamer'){shell(.04,.72,.90);box(.04,.72,.05,.92,.10,.84);handle(.27,.87,.76,.46);panel(.61,.20,.94,.25,.23);return;}
   // Waffle, contact grill and crepe plate retain visible cooking surfaces.
   shell(.06,.43,.92);knob(.30,.23,.95,.05);disc(.67,.23,.95,6,5,m.green);
   if(f==='crepe'){cylinder(.5,.44,.48,.47,.12,.45,m.iron);ring(.5,.56,.48,.45,.43,2,m.steel2);return;}
   const upper=p.family==='contact'&&/speedelight/.test(t)?.89:.70;
   box(.06,.44,.10,.88,.055,.77,m.iron);box(.06,upper,.10,.88,.075,.77,m.steel2,9);box(.08,upper-.02,.12,.84,.02,.73,m.iron);
   for(let i=0;i<17;i++){box(.09+i*.82/17,.50,.14,.008,.009,.67,m.iron,1);if(f==='waffle')box(.09,.50,.14+i*.67/17,.82,.009,.008,m.iron,1);}for(const x of [.07,.91])tube([[x,.44,.10],[x,upper,.10],[x,upper+.09,.85]],6);handle(.07,upper+.09,.87,.84);tray(.12,.10,.93,.76,.05,.02);
  }
  function coldroom(){
   shell(.01,.99,.94,m.paint);box(.01,0,.01,.98,.02,.93,m.steel2);for(let i=1;i<Math.ceil(w/600);i++)box(i/Math.ceil(w/600),.02,.945,.002,.97,.003,m.steel2,0);for(const x of [.015,.977])for(let i=1;i<Math.ceil(d/600);i++)box(x,.02,i/Math.ceil(d/600),.003,.97,.002,m.steel2,0);door(.15,.035,.95,.45,.87,false);box(.58,.49,.987,.06,.09,.01,m.black);if(/integral|int\b/.test(t)){box(.65,.72,.52,.30,.24,.40,m.steel);vents(.68,.77,.943,.24,.15,10);}panel(.69,.62,.96,.13,.08);
  }
  function doner(){
   feet(false,.025);tray(.02,.10,.02,.96,.95,.07);box(.17,.12,.04,.66,.77,.16);for(let i=0;i<p.burners;i++){const y=.19+i*.62/p.burners;box(.22,y,.205,.56,.52/p.burners,.025,m.clay,2);for(let j=0;j<5;j++)tube([[.23,y+(.52/p.burners)*(j+.5)/5,.234],[.77,y+(.52/p.burners)*(j+.5)/5,.234]],1.2,m.iron);knob(.88,y+.03,.20,.025);}tube([[.5,.09,.69],[.5,.94,.69]],4);cylinder(.5,.11,.69,.25,.015,.24,m.steel2);box(.37,.90,.45,.26,.08,.38,m.black,8);tube([[.5,.94,.19],[.5,.94,.60]],6);for(const x of [.16,.82])box(x,.13,.05,.02,.76,.33);brand(.83,.215);
  }
  function lifter(){feet();shell(fh,.92,.88);box(.28,.25,.25,.44,.72,.18);for(const x of [.12,.88])tube([[.5,.90,.43],[x,.90,.60],[x,.90,.97]],6);panel(.20,.66,.93,.60,.17);}
  const groups={
   cooking:['range','hotplate','induction','solidtop','griddle','chargrill'],fryer:['fryer','pasta'],waterCooking:['bratt','kettle','tandoor','bainmarie'],oven:['combi','charcoal','rackoven','holding','deck','microwave','rapid'],conveyor:['conveyor','toaster'],refrigeration:['upright','blast','counter','chest'],display:['display','multideck'],ice:['ice'],washer:['dishuc','dishhood','dishconveyor'],cupboard:['drawers','hotcupboard'],storage:['table','stand','cabinet','sink','rack','traytrolley','trolley','platedispenser','dishcaddy','dolly','transport','ingredient','waste'],doner:['doner'],smallPrep:['planetary','spiral','cutter','cookingprocessor','rice','soupkettle','peeler','spinner','bonesaw','breadslicer','slicer','circulator','pacotizer','mincer','sieve','veg','juicer','liquidiser'],beverages:['espresso','grinder','brewer','automatic','drinkmixer','softserve','slush','citrus'],vacuum:['vacuum'],countertop:['salamander','stripheater','heatedshelf','cubbies','chipdump','carving','buntoaster','steamer','contact','waffle','crepe'],coldroom:['coldroom'],lifter:['lifter']
  };
  const builders={cooking,fryer,waterCooking,oven,conveyor,refrigeration,display,ice,washer,cupboard,storage,smallPrep,beverages,vacuum,countertop,coldroom,lifter,doner};
  const builder=Object.keys(groups).find(k=>groups[k].includes(p.family));if(!builder)throw new Error('Missing construction builder: '+p.family);builders[builder]();
  if(!g.children.length)throw new Error('Empty construction: '+p.family);
  // Keep every handle and attachment within the catalogue envelope used by clash checks.
  g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g),size=b.getSize(new THREE.Vector3()),scale=Math.min(1,w/size.x,h/size.y,d/size.z),offset=new THREE.Vector3(b.min.x,b.min.y,b.min.z);
  for(const o of g.children){o.position.sub(offset).multiplyScalar(scale);o.scale.multiplyScalar(scale);o.position.x+=(w-size.x*scale)/2;o.position.z+=(d-size.z*scale)/2;}
  return g;
 }
 return {identify,build,profiles};
})();
