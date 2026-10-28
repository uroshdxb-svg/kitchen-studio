/* Reference-led visual models, not manufacturer CAD. Coordinates are millimetres.
 * Exact brand/model keys deliberately precede category geometry. New variants must
 * be reviewed against their own reference before adding them to this registry. */
const KS3DEquipment=(()=>{
 const entries=[
  {id:'rc-r301',brand:'Robot Coupe',model:'R 301 Ultra',family:'veg',plastic:true,features:['Composite motor base','Twin feed hoppers','Pusher lever','Side discharge chute'],configuration:'Vegetable-prep head fitted; the separate cutter bowl is not shown.'},
  {id:'rc-cl50',brand:'Robot Coupe',model:'CL 50 Ultra',family:'veg',features:['Stainless motor base','Metal feed head','Twin feed hoppers','Side discharge chute']},
  {id:'rc-r2',brand:'Robot Coupe',model:'R 2',family:'cutter',composite:true,litres:'2.9 L',features:['Brushed steel bowl','Clear domed lid','Front bowl handle','Composite motor base']},
  {id:'rc-r4',brand:'Robot Coupe',model:'R 4',family:'cutter',speed:true,litres:'4.5 L',features:['Metal motor base','Front bowl handle','Clear lid','Two-speed selector']},
  {id:'rc-r4vv',brand:'Robot Coupe',model:'R 4 V.V.',family:'cutter',speed:true,variable:true,litres:'4.5 L',features:['Metal motor base','Front bowl handle','Clear lid','Variable-speed dial']},
  {id:'rc-r5',brand:'Robot Coupe',model:'R 5 - 2V',family:'cutter',timer:true,litres:'5.9 L',features:['Larger steel bowl','Steel loop handle','Clear lid','Timer and speed controls']},
  {id:'rc-blixer2',brand:'Robot Coupe',model:'Blixer 2',family:'cutter',composite:true,scraper:true,litres:'2.9 L',features:['Brushed steel bowl','Sealed clear lid','Lid scraper crank','Composite motor base']},
  {id:'rc-blixer4',brand:'Robot Coupe',model:'Blixer 4',family:'cutter',scraper:true,litres:'4.5 L',features:['Metal motor base','Sealed clear lid','Lid scraper crank','Front bowl handle']},
  {id:'rondo-stm5303',brand:'Rondo',model:'Econom 4000 STM5303',family:'sheeter',features:['Twin conveyor belts','Exposed rollers and guards','Roller adjustment lever','Tabletop feet'],configuration:'Working position. Catalogue envelope retained; the current manufacturer brochure lists different overall dimensions. Variant confirmation is still needed.'},
  {id:'sinmag-sm520f',brand:'Sinmag',model:'SM-520F',family:'sheeter',floor:true,features:['Twin conveyor belts','Safety grids','Diagonal table supports','Teal cabinet and castors'],configuration:'Working position. The catalogue envelope is retained; the manufacturer lists 940 mm depth and 500 mm working width for this variant.'}
 ];
 const key=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''),index=new Map(entries.map(e=>[key(e.brand)+'/'+key(e.model),e]));
 const identify=it=>it.kind&&it.kind!=='eq'?null:index.get(key(it.brand)+'/'+key(it.model))||null;
 const cache=new WeakMap(),panels=new Map();
 function materials(M){
  if(cache.has(M))return cache.get(M);
  const mat=(color,roughness=.5,metalness=0,extra={})=>new THREE.MeshStandardMaterial({color:KS3DAssets.linear(color),roughness,metalness,...extra});
  const m={...M,composite:mat(0x4d5559,.47),cast:mat(0xb7bcc0,.44,.52),paint:mat(0xdadbd7,.43),ivory:mat(0xe5e5de,.39),teal:mat(0x22505c,.48),belt:mat(0xe2e3d5,.93),red:mat(0xb82825,.38),green:mat(0x178851,.42),yellow:mat(0xe8ba35,.5),clear:mat(0xdce9e8,.1,.02,{transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide}),clearEdge:mat(0xc1d5d5,.17,.12,{transparent:true,opacity:.65,depthWrite:false})};
  m.steel=M.steel.clone();m.steel.metalness=.78;m.steel.roughness=.34;m.steel.envMapIntensity=1.4;
  m.steel2=M.steel2.clone();m.steel2.metalness=.80;m.steel2.envMapIntensity=1.3;
  // Fine woven PVC belt texture. Shared across machines and scene rebuilds.
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#dedfd4';x.fillRect(0,0,128,128);x.strokeStyle='#d2d3c9';x.lineWidth=.5;for(let i=0;i<128;i+=4){x.beginPath();x.moveTo(i,0);x.lineTo(i,128);x.moveTo(0,i);x.lineTo(128,i);x.stroke();}const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,3);m.belt.map=t;cache.set(M,m);return m;
 }
 function panel(e){
  if(panels.has(e.id))return panels.get(e.id);const c=document.createElement('canvas');c.width=512;c.height=320;const x=c.getContext('2d');
  x.fillStyle=e.composite||e.plastic?'#e6e5df':'#c8cece';x.fillRect(0,0,512,320);x.strokeStyle='#8b9293';x.lineWidth=6;x.strokeRect(4,4,504,312);
  x.fillStyle='#303c41';x.font='italic 700 53px Arial';x.fillText('robot coupe',28,75);x.font='700 31px Arial';x.fillText(e.model.replace(' - ',' '),30,287);x.font='21px Arial';x.fillText(e.litres||'',418,290);
  if(e.speed){x.font='16px Arial';x.fillText(e.variable?'300 — 3500':'1     2',350,135);}
  if(e.timer){x.fillStyle='#263134';x.fillRect(365,95,100,45);x.fillStyle='#9db6a4';x.font='27px monospace';x.fillText('00:00',373,128);}
  for(const [xx,yy] of [[15,15],[497,15],[15,305],[497,305]]){x.fillStyle='#899494';x.beginPath();x.arc(xx,yy,4,0,Math.PI*2);x.fill();}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const m=new THREE.MeshStandardMaterial({map:t,roughness:.6,metalness:.12});panels.set(e.id,m);return m;
 }
 function build(it,a){
  const e=identify(it);if(!e)return null;const m=materials(a.M),g=new THREE.Group(),{w,d,h}=it;
  g.userData.equipmentModel=e.id;g.userData.features=e.features.slice();
  function mesh(geo,mat,x=0,y=0,z=0){geo.userData.ownedByScene=true;const o=new THREE.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=!mat.transparent;o.receiveShadow=true;g.add(o);return o;}
  function box(x,y,z,ww,hh,dd,mat,r=5){
   if(Math.min(ww,hh,dd)<=0)return null;r=Math.min(r,ww/3,hh/3,dd/3);const geo=new THREE.BoxGeometry(ww,hh,dd,4,4,4),p=geo.attributes.position,n=geo.attributes.normal;
   for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)],s=[ww,hh,dd];for(let j=0;j<3;j++)if(Math.abs(v[j])>s[j]*.1&&Math.abs(v[j])<s[j]*.4)v[j]=Math.sign(v[j])*(s[j]/2-r);const c=v.map((q,j)=>THREE.MathUtils.clamp(q,-s[j]/2+r,s[j]/2-r)),nn=new THREE.Vector3(...v.map((q,j)=>q-c[j])).normalize();p.setXYZ(i,c[0]+nn.x*r,c[1]+nn.y*r,c[2]+nn.z*r);n.setXYZ(i,nn.x,nn.y,nn.z);}
   return mesh(geo,mat,x+ww/2,y+hh/2,z+dd/2);
  }
  function cy(x,y,z,r,len,mat,axis='y',r2=r){const o=mesh(new THREE.CylinderGeometry(r2,r,len,48),mat,x,y,z);if(axis==='z')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.z=Math.PI/2;return o;}
  function lathe(x,y,z,pts,mat){return mesh(new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(...p)),64),mat,x,y,z);}
  function tube(pts,r,mat){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'centripetal'),Math.max(8,pts.length*5),r,10,false),mat);}
  function ring(x,y,z,r,thick,mat,axis='y'){const o=mesh(new THREE.TorusGeometry(r,thick,10,64),mat,x,y,z);if(axis==='y')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.y=Math.PI/2;return o;}
  function text(x,y,z,ww,words){
   const k='mark:'+words;if(!panels.has(k)){const c=document.createElement('canvas');c.width=512;c.height=100;const t=c.getContext('2d');t.font='700 70px Arial';t.fillStyle=words==='SINMAG'?'#b9e0ed':'#26383b';t.textAlign='center';t.textBaseline='middle';t.fillText(words,256,53,490);const map=new THREE.CanvasTexture(c);map.encoding=THREE.sRGBEncoding;panels.set(k,new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false}));}
   return mesh(new THREE.PlaneGeometry(ww,ww/5),panels.get(k),x,y,z);
  }
  function motor(cx,bw,bh,bd,mat){
   box(cx-bw/2,h*.025,d*.06,bw,bh,bd,mat,12);box(cx-bw*.49,h*.025,d*.07,bw*.98,9,bd*.98,m.composite,5);
   for(const xx of [cx-bw*.35,cx+bw*.35])for(const zz of [d*.17,d*.76])cy(xx,5,zz,12,10,m.rubber);
   for(let i=0;i<7;i++)box(cx+bw/2-.5,h*.09+i*8,d*.23,1.5,3,bd*.27,m.dark,1);
   const pw=bw*.88,ph=bh*.72,py=bh*.59,pz=d*.06+bd+2;
   const face=mesh(new THREE.PlaneGeometry(pw,ph),panel(e),cx,py,pz);
   const rad=bw*.048,yy=py-ph*.07,xx=cx-pw*.28;
   for(const [i,mat] of (e.timer?[m.green,m.dark,m.green,m.red]:[m.dark,m.green,m.red]).entries()){const step=bw*(e.timer?.19:.15);cy(xx+i*step,yy,pz+5,rad+2,4,m.steel2,'z');cy(xx+i*step,yy,pz+8,rad,5,mat,'z');}
   if(e.speed){cy(cx+bw*.26,yy,pz+9,bw*.09,16,m.dark,'z');const line=box(cx+bw*.26-2,yy-bw*.065,pz+19,4,bw*.13,2,m.white,1);line.rotation.z=e.variable?0:.45;}
  }
  function cutter(){
   const cx=w*.5,cz=d*.40,bh=h*.40,r=w*(e.timer?.395:.425),bottom=h*.43,top=h*(e.scraper?.80:.835),height=top-bottom;
   motor(cx,w*.92,bh,d*.79,e.composite?m.composite:m.cast);
   cy(cx,bottom-3,cz,r*.92,7,m.rubber);
   lathe(cx,bottom,cz,[[0,0],[r*.91,0],[r*.99,7],[r*.96,22],[r*.95,height-5],[r,height],[r-3,height+1],[r*.95-3,height-5],[r*.95-3,10],[0,10]],m.steel);
   ring(cx,top,cz,r-1,2.2,m.steel2);ring(cx,bottom+height*.13,cz,r*.974,1,m.steel2);
   cy(cx,bottom+height*.46,cz,r*.07,height*.85,m.ivory);
   // Twin blade tips remain visible through the clear lid, not a solid dark cap.
   for(let side of [-1,1]){const blade=box(cx,bottom+15,cz-r*.08,r*.73,2.5,r*.20,m.steel2,1);if(side<0){blade.position.x=cx-r*.365;blade.position.y+=7;}}
   const lidTop=top+h*.09;
   lathe(cx,top,cz,[[r,0],[r,5],[r*.9,10],[r*.64,h*.055],[r*.23,h*.08],[r*.2,h*.08+3]],m.clear);
   ring(cx,top+4,cz,r,3,m.clearEdge);
   for(let i=0;i<8;i++){const t=i*Math.PI/4;tube([[cx+Math.cos(t)*r,top+5,cz+Math.sin(t)*r],[cx+Math.cos(t)*r*.7,top+h*.05,cz+Math.sin(t)*r*.7],[cx+Math.cos(t)*r*.24,lidTop-3,cz+Math.sin(t)*r*.24]],1.7,m.clearEdge);}
   if(e.id==='rc-r2')lathe(cx,lidTop-7,cz,[[r*.33,0],[r*.33,8],[r*.31,8],[r*.31,0]],m.clearEdge);
   else lathe(cx,lidTop-5,cz,[[r*.20,0],[r*.16,7],[r*.22,h*.035],[r*.27,h*.045],[r*.24,h*.045],[r*.19,h*.035],[r*.14,7]],m.clearEdge);
   const hz=cz+r+9,hy=bottom+height*.14;
   if(e.timer){tube([[cx-14,top-22,cz+r-4],[cx-14,top-22,hz+22],[cx-14,bottom+25,hz+22],[cx-14,bottom+25,cz+r-4]],6,m.steel2);}
   else{tube([[cx,top-22,cz+r-3],[cx,top-30,hz+18],[cx,hy+12,hz+18],[cx,hy,cz+r-4]],9,m.dark);box(cx-11,hy+14,hz+11,22,height*.60,18,m.dark,8);}
   box(cx-14,top-28,cz+r-1,28,26,5,m.steel2,2);box(cx-10,top-8,cz+r,20,14,8,m.clearEdge,2);
   if(e.scraper){const sy=lidTop+h*.045;cy(cx,sy,cz,r*.25,7,m.composite);tube([[cx,sy+3,cz],[cx-r*.45,sy+h*.017,cz],[cx-r*.82,sy,cz]],4,m.composite);cy(cx-r*.82,sy+10,cz,7,24,m.composite);tube([[cx,top-5,cz],[cx+r*.73,top-7,cz],[cx+r*.73,bottom+17,cz]],4,m.ivory);}
  }
  function veg(){
   const cx=w*.34,bw=w*.61,bh=h*.44,cz=d*.43,head=e.plastic?m.ivory:m.steel;
   motor(cx,bw,bh,d*.83,e.plastic?m.composite:m.steel);
   const rad=w*.30,by=h*.465,hy=h*.635;
   cy(cx,by+h*.055,cz,rad,h*.11,head);ring(cx,by+.5,cz,rad,2.5,m.steel2);
   // Side discharge has an open underside and a sloped hood, never an oven door.
   box(cx+rad*.45,by,d*.18,w*.48,h*.025,d*.55,head,5);
   for(const z of [d*.18,d*.71]){const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(w*.47,0);sh.lineTo(w*.47,h*.09);sh.lineTo(w*.20,h*.18);sh.lineTo(0,h*.18);sh.closePath();mesh(new THREE.ExtrudeGeometry(sh,{depth:5,bevelEnabled:true,bevelThickness:2,bevelSize:2,bevelSegments:2}),head,cx+rad*.45,by,z);}
   const hood=box(cx+rad*.46,by+h*.09,d*.18,w*.49,h*.025,d*.55,head,5);hood.rotation.z=-.24;
   box(w*.87,by+4,d*.20,6,h*.06,d*.48,m.dark,2);
   // Large half-moon feed hopper with a separate narrow cylindrical feed tube.
   const hr=rad*.72,hx=cx-w*.045,hz=cz+d*.09,hh=h*.22;
   lathe(hx,hy,hz,[[hr,0],[hr,hh],[hr-3,hh],[hr-3,3]],head);cy(hx,hy+2,hz,hr-4,3,m.dark);
   const sx=cx+rad*.64,sz=cz-d*.22,sr=Math.min(29,w*.085);
   lathe(sx,hy-10,sz,[[sr,0],[sr,hh+8],[sr-3,hh+8],[sr-3,0]],head);cy(sx,hy+hh+4,sz,sr-3,8,m.dark);ring(sx,hy+hh+8,sz,sr,3,m.dark);
   const py=hy+hh+1;cy(hx,py-12,hz,hr*.94,7,head);cy(hx,py+h*.035,hz,8,h*.10,m.steel2);
   cy(hx-hr-10,(hy+py)/2,hz,7,py-hy,m.steel2);
   const arch=new THREE.Shape();arch.moveTo(hx-hr-17,py-25);arch.quadraticCurveTo(hx-hr-12,py+45,hx+8,py+40);arch.lineTo(hx+8,py+23);arch.quadraticCurveTo(hx-hr+13,py+30,hx-hr+5,py-25);arch.closePath();
   mesh(new THREE.ExtrudeGeometry(arch,{depth:14,bevelEnabled:true,bevelSize:3,bevelThickness:2,bevelSegments:3,curveSegments:16}),head,0,0,hz-7);
   cy(hx,py+h*.096,hz,16,24,m.dark, 'y',19);cy(hx-hr-10,hy+12,hz,11,18,m.steel2,'z');
  }
  function sheeter(){
   const floor=!!e.floor,cx=w/2,beltY=h*(floor?.69:.34),beltD=d*.51,z0=d*.18,cw=w*(floor?.155:.215),headH=h*(floor?.28:.61),bodyZ=d*.08,front=d*.82,coat=floor?m.ivory:m.paint;
   if(floor){
    box(cx-cw*.47,100,bodyZ,cw*.94,beltY-98,d*.70,coat,14);box(cx-cw*.45,110,front-8,cw*.90,beltY-120,14,m.teal,3);
    for(const z of [d*.12,d*.76]){box(cx-cw*.84,58,z-25,cw*1.68,38,50,m.paint,5);for(const x of [cx-cw*.72,cx+cw*.72]){cy(x,32,z,32,22,m.rubber,'x');cy(x+12,32,z,19,3,m.steel2,'x');box(x-16,35,z-15,32,38,30,m.steel2,2);}}
    tube([[cx-cw*.5,beltY-44,front+12],[cx+cw*.5,beltY-44,front+12]],8,m.steel2);for(const x of [cx-cw*.52,cx+cw*.52])cy(x,beltY-44,front+12,13,18,m.dark,'x');
    box(cx+cw*.18,beltY-160,front+12,52,52,5,m.yellow,3);cy(cx+cw*.18+26,beltY-134,front+22,22,12,m.red,'z');text(cx,beltY-93,front+9,cw*.55,'SINMAG');
   }else for(const x of [cx-cw*.4,cx+cw*.4])for(const z of [d*.17,d*.67]){box(x-15,0,z,30,beltY-20,35,m.steel2,3);box(x-17,0,z-1,34,7,37,m.rubber,2);}
   const edge=w*.045,len=cx-cw*.46-edge;
   for(const side of [-1,1]){
    const bx=side<0?edge:cx+cw*.46;
    box(bx,beltY-38,z0-12,len,35,beltD+24,m.steel2,6);box(bx,beltY-7,z0,len,12,beltD,m.belt,5);
    cy(side<0?bx:bx+len,beltY-12,z0+beltD/2,22,beltD,m.belt,'z');
    for(const z of [z0-13,z0+beltD+5]){box(bx,beltY-35,z,len,30,8,m.steel,4);for(const x of [bx+25,bx+len-25])cy(x,beltY-21,z+5,5,3,m.steel2,'z');}
    // Removable catch tray and side lips at the end of each belt.
    const tx=side<0?0: w-edge;box(tx,beltY-43,z0,edge,5,beltD,m.steel,2);for(const z of [z0,z0+beltD-4])box(tx,beltY-42,z,edge,25,4,m.steel2,2);
    if(floor)for(const z of [z0+10,z0+beltD-10])tube([[cx+side*cw*.44,180,z],[cx+side*w*.29,beltY-42,z]],10,m.steel2);
    // Safety grids slope away from the nip, leaving the rollers visible.
    const start=cx+side*cw*.37,end=cx+side*cw*1.10,gy=beltY+headH*.35;
    for(let i=0;i<=11;i++){const z=z0+beltD*i/11;tube([[start,gy,z],[end,beltY+25,z]],3,m.steel2);}
    tube([[start,gy,z0],[start,gy,z0+beltD]],5,m.steel2);tube([[end,beltY+25,z0],[end,beltY+25,z0+beltD]],5,m.steel2);
   }
   // Independent front and rear castings: open space between them contains the rolls.
   for(const z of [bodyZ,front-d*.105]){
    const hh=z===bodyZ?headH:headH*(floor?.9:.78);
    const sh=new THREE.Shape(),bw=cw*.48;sh.moveTo(-bw,0);sh.lineTo(bw,0);sh.lineTo(bw,hh*.40);sh.quadraticCurveTo(bw,hh*.52,bw*.75,hh*.8);sh.quadraticCurveTo(bw*.65,hh,bw*.35,hh);sh.lineTo(-bw*.45,hh);sh.quadraticCurveTo(-bw,hh,-bw,hh*.85);sh.closePath();
    mesh(new THREE.ExtrudeGeometry(sh,{depth:d*.105,bevelEnabled:true,bevelSize:9,bevelThickness:6,bevelSegments:3,curveSegments:10}),coat,cx,beltY-70,z);
   }
   const rollerR=floor?48:42;
   for(const y of [beltY-20,beltY+rollerR*1.45])cy(cx,y,z0+beltD/2,rollerR,beltD,m.steel2,'z');
   // Open flour well at the rear/top, with a sloping front apron.
   box(cx-cw*.28,beltY+headH*.49,bodyZ+25,cw*.56,7,d*.47,m.steel2,2);
   for(const x of [cx-cw*.35,cx+cw*.28]){
    const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(d*.51,0);sh.lineTo(d*.51,headH*.12);sh.lineTo(d*.20,headH*.30);sh.lineTo(0,headH*.30);sh.closePath();const side=mesh(new THREE.ExtrudeGeometry(sh,{depth:cw*.07,bevelEnabled:true,bevelThickness:4,bevelSize:5,bevelSegments:3}),coat,x+cw*.07,beltY+headH*.49,bodyZ+20);side.rotation.y=-Math.PI/2;
   }
   box(cx-cw*.28,beltY+headH*.49,bodyZ+20,cw*.56,headH*.30,16,coat,5);
   box(cx-cw*.30,beltY+headH*.49,bodyZ+d*.51,cw*.60,headH*.12,18,coat,5);
   const gy=beltY+headH*.36,gz=front+8,gr=cw*.24;
   cy(cx,gy,gz,gr,16,m.steel2,'z');ring(cx,gy,gz+9,gr*.92,2.5,m.steel,'z');cy(cx,gy,gz+12,gr*.66,12,coat,'z');
   tube([[cx,gy,gz+24],[cx+cw*.14,gy-headH*.19,gz+40],[cx+cw*.37,gy-headH*.39,gz+52]],floor?14:13,m.steel2);
   cy(cx,gy+gr*.52,gz+22,13,12,m.dark,'z');
   if(!floor){text(cx,beltY-34,front+8,cw*.56,'RONDO');cy(cx+cw*.2,beltY+headH*.70,front-d*.10,13,24,m.dark);cy(cx+cw*.2,beltY+headH*.73,front-d*.10,20,10,m.red);}
   else{for(const z of [z0,z0+beltD])box(w*.88,beltY,z,12,110,12,m.steel2,2);cy(w*.886,beltY+108,z0+beltD/2,16,beltD,m.belt,'z');}
  }
  if(e.family==='cutter')cutter();else if(e.family==='veg')veg();else sheeter();
  // Preserve the planner's authoritative catalogue envelope. Do not silently
  // replace dimensions with dimensions from another model year or attachment.
  g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3()),k=Math.min(1,w/s.x,h/s.y,d/s.z);
  for(const o of g.children){o.position.sub(new THREE.Vector3(b.min.x,b.min.y,b.min.z)).multiplyScalar(k);o.scale.multiplyScalar(k);o.position.x+=(w-s.x*k)/2;o.position.z+=(d-s.z*k)/2;}
  return g;
 }
 return {entries,identify,build};
})();
