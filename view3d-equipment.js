/* Reference-led visual models, not manufacturer CAD. Coordinates are millimetres.
 * Exact brand/model keys deliberately precede category geometry. New variants must
 * be reviewed against their own reference before adding them to this registry. */
const KS3DEquipment=(()=>{
 const entries=[
  {id:'hobart-hsm20',brand:'Hobart',model:'HSM20',family:'planetary',hobart:true,bowlDiameter:355,bowlHeight:310,features:['Cast metal head and column','Wire bowl guard','Suspended stainless bowl','Bowl lift lever and speed selector'],configuration:'Standard bench mixer with bowl and wire guard fitted.'},
  ...[[10,279,236],[20,333,296],[30,380,340],[40,422,367]].map(([size,bowlDiameter,bowlHeight])=>({id:'sammic-bp'+size,brand:'Sammic',model:'BP-'+size,family:'planetary',bowlDiameter,bowlHeight,features:[size+' L stainless bowl','Wire safety guard','Front keypad and display','Bowl lift and open stainless legs'],configuration:'Current BP housing and keypad; standard column, without the optional attachment drive.'})),
  {id:'sammic-gsm300',brand:'Sammic',model:'GSM-300',family:'slicer',features:['300 mm circular blade','Sliding ribbed carriage','Thickness adjustment dial','Blade guard and top sharpener']},
  {id:'vitamix-vitaprep3',brand:'Vitamix',model:'Vita-Prep 3',family:'blender',features:['Clear tapered 2 L container','Moulded handle and lid plug','Red fascia and variable-speed dial','Vented motor base']},
  {id:'vitamix-quietone',brand:'Vitamix',model:'The Quiet One',family:'blender',quiet:true,features:['Clear sound enclosure','Advance container and handle','Digital preset keypad','Hinged enclosure and broad grip'],configuration:'Sound enclosure closed. The planner retains the catalogue height for the closed machine.'},
  {id:'mahlkonig-ek43',brand:'Mahlkonig',model:'EK43',family:'grinder',ek:true,features:['Horizontal grinding chamber','Large adjustment wheel','Clear tapered bean hopper','Bag clamp and open pedestal'],configuration:'Standard black finish and full-size hopper.'},
  {id:'mahlkonig-e65s',brand:'Mahlkonig',model:'E65S',family:'grinder',features:['Clear bean hopper','Cylindrical motor housing','Front display and grind adjustment','Portafilter fork and grounds tray'],configuration:'Standard black finish and hopper; catalogue envelope retained.'},
  {id:'rc-j80',brand:'Robot Coupe',model:'J 80',family:'juicer',features:['Stainless centrifugal body','Wide feed tube','Rear pulp container','Juice spout and removable drip tray']},
  ...[[2,'Linea PB 2-group'],[3,'Linea PB 3 group']].map(([groups,model])=>({id:'lm-pb'+groups,brand:'La Marzocco',model,family:'espresso',groups,features:[groups+' separate brew groups','Portafilters and twin steam wands','Cup rail and slotted drip tray','Group buttons and pressure gauge'],configuration:'Brushed stainless Linea PB AV with high legs, matching the reference configuration.'})),
  ...[['35','Boxer 35'],['42','Boxer 42'],['52','Boxer 52'],['jumbo','Jumbo 30']].map(([size,model])=>({id:size==='jumbo'?'henkelman-jumbo30':'henkelman-boxer'+size,brand:'Henkelman',model,family:'vacuum',jumbo:size==='jumbo',twin:size==='52',features:['Transparent domed lid','Recessed stainless chamber',size==='52'?'Twin side sealing bars':'Front sealing bar','Membrane controls and vacuum gauge'],configuration:'Shown with lid closed; the manufacturer photo shows it open.'+(size==='42'?' Catalogue envelope retained; the current manufacturer lists 490 × 530 × 440 mm.':'' )})),

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
 // Family geometry is deliberately separate from the reference-reviewed registry.
 // It improves unreviewed mixers without presenting them as exact replicas.
 function mixerFamily(it){
  if(it.kind&&it.kind!=='eq')return null;
  const name=String(it.name||'').toLowerCase();
  if(/spiral.*mixer|mixer.*spiral/.test(name))return 'spiral';
  if(/planetary.*mixer|mixer.*planetary|stand mixer|bowl-lift.*mixer|dough mixer/.test(name))return 'planetary';
  return null;
 }
 const cache=new WeakMap(),panels=new Map();
 function materials(M){
  if(cache.has(M))return cache.get(M);
  const mat=(color,roughness=.5,metalness=0,extra={})=>new THREE.MeshStandardMaterial({color:KS3DAssets.linear(color),roughness,metalness,...extra});
  const m={...M,composite:mat(0x4d5559,.47),cast:mat(0xb7bcc0,.44,.52),paint:mat(0xdadbd7,.43),ivory:mat(0xe5e5de,.39),teal:mat(0x22505c,.48),belt:mat(0xe2e3d5,.93),red:mat(0xb82825,.38),green:mat(0x178851,.42),yellow:mat(0xe8ba35,.5),coffee:mat(0x342016,.9),seal:mat(0xb18a58,.7),cover:mat(0xc6d7db,.16,.06,{transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide}),clear:mat(0xdce9e8,.1,.02,{transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide}),clearEdge:mat(0xc1d5d5,.17,.12,{transparent:true,opacity:.65,depthWrite:false})};
  m.steel=M.steel.clone();m.steel.metalness=.78;m.steel.roughness=.34;m.steel.envMapIntensity=1.4;
  m.steel2=M.steel2.clone();m.steel2.metalness=.80;m.steel2.envMapIntensity=1.3;
  m.bowl=m.steel.clone();m.bowl.metalness=1;m.bowl.roughness=.21;m.bowl.envMapIntensity=1.25;
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
  const exact=identify(it),family=mixerFamily(it),e=exact||(family?{family:'mixer',mixerType:family,features:[]}:null);if(!e)return null;const m=materials(a.M),g=new THREE.Group(),{w,d,h}=it;
  g.userData.equipmentModel=exact?.id||null;g.userData.modelFamily=e.mixerType||e.family;g.userData.features=e.features.slice();
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
   const k='mark:'+words;if(!panels.has(k)){const c=document.createElement('canvas');c.width=512;c.height=100;const t=c.getContext('2d');t.font='700 70px Arial';t.fillStyle=words==='SINMAG'?'#b9e0ed':words==='Vitamix'?'#ffffff':words==='LA MARZOCCO'?'#b63a32':'#26383b';t.textAlign='center';t.textBaseline='middle';t.fillText(words,256,53,490);const map=new THREE.CanvasTexture(c);map.encoding=THREE.sRGBEncoding;panels.set(k,new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false}));}
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
  function mixer(){
   const spiral=e.mixerType==='spiral',cx=w/2,cz=d*(spiral?.65:.63),r=Math.min(w*(spiral?.47:.40),d*.31),bottom=h*(spiral?.34:.20),top=h*(spiral?.67:.55),bh=top-bottom;
   const coat=m.paint,rod=Math.max(2,w*.009);
   // A lathed shell gives the bowl a rounded base, real wall thickness and an
   // open interior. No solid cap hides the beater or the spiral inside it.
   lathe(cx,bottom,cz,[[0,0],[r*.26,0],[r*.52,bh*.07],[r*.77,bh*.23],[r*.93,bh*.46],[r,bh*.76],[r,bh],[r-3,bh+2],[r-5,bh],[r-5,bh*.76],[r*.90,bh*.46],[r*.74,bh*.24],[r*.48,bh*.10],[r*.24,6],[0,6]],m.bowl);
   ring(cx,top,cz,r-1,3,m.steel2);
   if(spiral){
    box(w*.12,h*.04,d*.035,w*.76,h*.18,d*.86,coat,18);
    box(w*.17,h*.16,d*.025,w*.66,h*.65,d*.30,coat,18);
    box(w*.13,h*.79,d*.025,w*.74,h*.17,d*.64,coat,22);
    box(w*.15,h*.775,d*.035,w*.70,5,d*.60,m.dark,2);
    cy(cx,(h*.22+bottom)/2,cz,r*.57,bottom-h*.22,m.steel2);
    // Continuous helical dough hook and the separate straight breaker bar.
    const pts=[],sx=cx-r*.25,sz=cz-r*.12,turns=1.6;
    for(let i=0;i<=64;i++){const t=i/64,angle=t*Math.PI*2*turns;pts.push([sx+Math.sin(angle)*r*.28,bottom+bh*.18+t*bh*.94,sz+Math.cos(angle)*r*.28]);}
    tube(pts,rod*1.6,m.steel2);cy(sx,top+(h*.80-top)/2,sz+r*.28,rod*1.6,h*.80-top,m.steel2);
    cy(cx+r*.34,bottom+bh*.58,cz,rod*1.8,bh*.95,m.steel2);
    // Closed horizontal wire grid, with the mixing tools visible underneath.
    const gy=top+h*.035;ring(cx,gy,cz,r*.98,rod,m.steel2);
    for(let i=-7;i<=7;i++){const dx=r*i/8,dz=Math.sqrt(r*r*.94-dx*dx);tube([[cx+dx,gy,cz-dz],[cx+dx,gy,cz+dz]],rod*.55,m.steel2);}
    for(const x of [cx-r*.7,cx+r*.7])tube([[x,gy,cz-r*.7],[x,h*.81,d*.30]],rod,m.steel2);
    box(cx-w*.24,h*.815,d*.668,w*.48,h*.105,5,m.dark,5);
    cy(cx-w*.13,h*.865,d*.68,w*.035,8,m.green,'z');cy(cx+w*.14,h*.865,d*.68,w*.045,9,m.red,'z');cy(cx,h*.865,d*.68,w*.045,8,m.dark,'z');
    for(const x of [w*.22,w*.78])for(const z of [d*.15,d*.76])cy(x,h*.025,z,w*.055,h*.05,m.rubber);
   }else{
    // Raised four-legged base and cast rear column, leaving daylight below
    // the bowl. A separate head, gearbox seam and drive hub break up the body.
    for(const x of [w*.12,w*.82])for(const z of [d*.13,d*.84]){const foot=box(x-w*.045,h*.025,z-d*.035,w*.09,h*.15,d*.075,coat,4);foot.rotation.z=x<cx?-.10:.10;box(x-w*.055,0,z-d*.04,w*.11,h*.026,d*.085,m.rubber,3);}
    for(const z of [d*.13,d*.82])box(w*.09,h*.13,z,w*.82,h*.055,d*.06,coat,4);
    box(w*.20,h*.16,d*.045,w*.60,h*.65,d*.29,coat,14);
    box(w*.14,h*.79,d*.04,w*.72,h*.19,d*.70,coat,25);
    box(w*.145,h*.785,d*.05,w*.71,5,d*.68,m.steel2,2);
    cy(cx,h*.77,cz,r*.70,h*.12,coat);
    cy(cx,h*.70,cz,r*.66,h*.035,m.steel2);
    cy(cx,h*.615,cz,rod*2.7,h*.16,m.steel2);
    // Flat beater: hollow perimeter and crossbars, rather than a solid block.
    const by=bottom+bh*.22;
    tube([[cx,top+h*.07,cz],[cx+r*.50,top-h*.03,cz],[cx+r*.35,by,cz],[cx-r*.35,by,cz],[cx-r*.50,top-h*.03,cz],[cx,top+h*.07,cz]],rod,m.steel2);
    tube([[cx,top+h*.07,cz],[cx,by,cz]],rod,m.steel2);tube([[cx-r*.4,by+bh*.25,cz],[cx+r*.4,by+bh*.25,cz]],rod,m.steel2);
    // Bowl-lift cradle, guide rods, mounts and the side operating handle.
    for(const side of [-1,1]){const x=cx+side*r*.94;cy(cx+side*w*.20,h*.44,d*.36,rod*1.8,h*.43,m.steel2);tube([[cx+side*w*.22,bottom+bh*.55,d*.30],[x,bottom+bh*.55,cz-r*.3],[x,bottom+bh*.65,cz]],rod*3,coat);box(x-rod*2,top-bh*.40,cz-rod*3,rod*4,bh*.17,rod*6,m.steel2,2);}
    tube([[w*.81,h*.63,d*.22],[w*.93,h*.63,d*.26],[w*.93,h*.39,d*.26]],rod*1.3,m.steel2);cy(w*.93,h*.385,d*.26,rod*2,h*.07,m.dark);
    const gh=h*.145,gr=r*1.02;
    lathe(cx,top+4,cz,[[gr,0],[gr*.94,gh*.30],[gr*.76,gh*.78],[gr*.58,gh],[gr*.57,gh]],m.clear);
    ring(cx,top+5,cz,gr,rod,m.steel2);ring(cx,top+gh+4,cz,gr*.58,rod*.8,m.steel2);
    for(const side of [-1,1])tube([[cx+side*gr,top+5,cz],[cx+side*gr*.88,top+gh*.5,cz],[cx+side*gr*.58,top+gh+4,cz]],rod,m.steel2);
    // Front attachment hub and separate start/stop controls on the head.
    cy(cx,h*.845,d*.75,w*.055,12,m.steel2,'z');cy(cx,h*.845,d*.765,w*.028,6,m.dark,'z');
    box(w*.64,h*.90,d*.74,w*.11,h*.055,5,m.dark,4);cy(w*.695,h*.936,d*.75,w*.022,4,m.green,'z');cy(w*.695,h*.91,d*.75,w*.022,4,m.red,'z');
    cy(w*.80,h*.77,d*.20,w*.04,8,m.dark,'x');tube([[w*.81,h*.77,d*.20],[w*.86,h*.83,d*.20]],rod,m.steel2);
   }
   // Small seams, rear service panel and ventilation also read from the back.
   box(w*.30,h*.29,d*.022,w*.40,h*.34,3,coat,5);
   for(let i=0;i<6;i++)box(w*.35,h*(.33+i*.035),d*.018,w*.30,Math.max(2,h*.006),3,m.dark,1);
   for(const x of [w*.32,w*.68])for(const y of [h*.31,h*.60])cy(x,y,d*.014,rod*.75,3,m.steel2,'z');
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
  // Shared construction primitives; each family keeps its own silhouette and
  // mechanical layout. No model-name substring matching or generic reskins.
  function feet4(y=8){for(const x of [w*.14,w*.86])for(const z of [d*.13,d*.85])cy(x,y,z,Math.min(w*.045,18),y*2,m.rubber);}
  function button(x,y,z,r,mat=m.dark){cy(x,y,z,r+2,3,m.steel2,'z');cy(x,y,z+3,r,6,mat,'z');}
  function arc(cx,cyy,cz,rx,rz,start,end,mat=m.steel2,thick=2.5){tube(Array.from({length:33},(_,i)=>{const a=start+(end-start)*i/32;return [cx+rx*Math.cos(a),cyy,cz+rz*Math.sin(a)];}),thick,mat);}
  // Rounded-rectangle loft. Open ends allow real cavities and transparent shells.
  function outline(cx,cz,ww,dd,r){const out=[];for(const [xx,zz,a] of [[cx+ww/2-r,cz+dd/2-r,0],[cx-ww/2+r,cz+dd/2-r,Math.PI/2],[cx-ww/2+r,cz-dd/2+r,Math.PI],[cx+ww/2-r,cz-dd/2+r,Math.PI*1.5]])for(let i=0;i<8;i++){const t=a+i*Math.PI/14;out.push([xx+Math.cos(t)*r,zz+Math.sin(t)*r]);}return out;}
  function loft(cx,cz,levels,mat){const v=[],idx=[],uv=[];for(let j=0;j<levels.length;j++)for(let i=0;i<32;i++)uv.push(i/32,j/(levels.length-1));for(const [y,ww,dd,r] of levels)for(const [x,z] of outline(cx,cz,ww,dd,r))v.push(x,y,z);const n=32;for(let j=0;j<levels.length-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=a+n,dd=b+n;idx.push(a,c,b,b,c,dd);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return mesh(geo,mat);}
  function plate(cx,y,cz,ww,dd,r,mat){const pts=outline(cx,cz,ww,dd,r),v=[cx,y,cz],uv=[.5,.5],idx=[];for(const [x,z] of pts){v.push(x,y,z);uv.push((x-cx)/ww+.5,(z-cz)/dd+.5);}for(let i=0;i<32;i++)idx.push(0,(i+1)%32+1,i+1);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return mesh(geo,mat);}
  function trim(cx,y,cz,ww,dd,r,mat=m.steel2,thick=2){const p=outline(cx,cz,ww,dd,r).map(([x,z])=>[x,y,z]);p.push(p[0]);tube(p,thick,mat);}
  function fascia(x,y,z,ww,hh,kind){
   const k='fascia:'+e.id+':'+kind;if(!panels.has(k)){const c=document.createElement('canvas');c.width=512;c.height=200;const ctx=c.getContext('2d');ctx.fillStyle=kind==='vacuum'?'#d4e2df':'#202b30';ctx.fillRect(0,0,512,200);
    if(kind==='vacuum'){ctx.strokeStyle='#75b8ad';ctx.lineWidth=13;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(20,190-i*16);ctx.quadraticCurveTo(280,240,490,50+i*20);ctx.stroke();}}
    ctx.fillStyle=kind==='vacuum'?'#24413f':'#d2dada';ctx.font='600 23px Arial';ctx.fillText(e.brand,20,30);ctx.fillStyle='#111b1c';ctx.fillRect(170,47,170,57);ctx.fillStyle=kind==='vacuum'?'#d9504c':'#a6cfda';ctx.font='33px monospace';ctx.fillText(kind==='vacuum'?'99.9':'00:00',184,87);ctx.strokeStyle=kind==='vacuum'?'#263c3c':'#778e95';ctx.lineWidth=2;for(let i=0;i<6;i++){ctx.strokeRect(40+i*71,137,42,36);ctx.font='18px Arial';ctx.fillStyle=ctx.strokeStyle;ctx.fillText(String(i+1),54+i*71,162);}const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;panels.set(k,new THREE.MeshStandardMaterial({map:t,roughness:.5,metalness:.1}));}
   return mesh(new THREE.PlaneGeometry(ww,hh),panels.get(k),x,y,z);
  }
  function planetary(){
   const hob=!!e.hobart,cx=w/2,cz=d*.63,r=e.bowlDiameter/2,bh=e.bowlHeight,by=h*(hob?.22:it.mount==='top'?.20:.30),rim=by+bh,headY=h*.73,coat=hob?m.cast:m.steel;
   // Two separated feet and a rear column leave space below and behind the bowl.
   for(const x of [w*.08,w*.85]){box(x,it.mount==='floor'?h*.06:12,d*.12,w*.075,h*.045,d*.80,coat,5);box(x+2,0,d*.82,w*.065,it.mount==='floor'?h*.065:20,d*.08,m.rubber,3);}
   box(w*.20,h*.06,d*.07,w*.60,h*.72,d*.27,coat,18);
   box(w*.24,h*.76,d*.09,w*.52,h*.19,d*.35,coat,18);
   if(!hob){
    // The sloped graphite cap is characteristic of the current Sammic BP range.
    loft(cx,d*.44,[[h*.90,w*.73,d*.75,w*.26],[h*.94,w*.73,d*.75,w*.26],[h*.985,w*.65,d*.63,w*.22]],m.dark);plate(cx,h*.985,d*.44,w*.65,d*.63,w*.22,m.dark);
    const p=fascia(cx,h*.99,d*.48,w*.37,h*.075,'bp');p.rotation.x=-Math.PI/2;
    cy(cx,h*.795,cz,r*.97,h*.25,m.steel);
    cy(cx,h*.79,cz+r*.98,w*.045,3,m.composite,'z');text(cx,h*.72,cz+r+1,w*.23,'SAMMIC');
   }else{
    box(w*.17,h*.855,d*.09,w*.66,h*.10,d*.66,m.cast,12);box(w*.17,h*.95,d*.09,w*.66,5,d*.66,m.steel2,3);cy(cx,h*.78,cz,r*.65,h*.20,m.cast);ring(cx,h*.69,cz,r*.65,2,m.steel2);
    text(cx,h*.89,d*.765,w*.31,'HOBART');button(w*.26,h*.87,d*.75,11,m.dark);button(w*.77,h*.88,d*.75,9,m.red);button(w*.77,h*.835,d*.75,9,m.green);
    box(w*.36,headY-8,cz-r*.5,w*.28,20,r,m.cast,6);cy(cx,headY-5,cz,r*.45,25,m.steel2);
   }
   lathe(cx,by,cz,[[0,0],[r*.38,0],[r*.68,bh*.08],[r*.87,bh*.25],[r*.98,bh*.65],[r,bh],[r-3,bh],[r*.96,bh*.65],[r*.84,bh*.26],[r*.64,bh*.10],[0,6]],m.steel);ring(cx,rim,cz,r,3,m.steel2);
   for(const side of [-1,1]){tube([[cx+side*r*.92,rim-25,cz],[cx+side*(r+22),rim-25,cz],[cx+side*(r+22),rim-65,cz],[cx+side*r*.94,rim-65,cz]],5,m.steel2);box(cx+side*r-10,by+bh*.52,d*.27,20,25,cz-d*.27,m.cast,3);}
   cy(cx,headY-h*.035,cz,12,h*.16,m.steel2);
   // Wire whisk remains visible inside the safety cage and bowl.
   for(let i=0;i<6;i++){const a=i*Math.PI/3,xx=Math.cos(a),zz=Math.sin(a);tube([[cx,headY-h*.08,cz],[cx+xx*r*.36,rim-15,cz+zz*r*.36],[cx+xx*r*.24,by+bh*.22,cz+zz*r*.24],[cx,by+bh*.17,cz]],1.6,m.steel2);}
   const gy=hob?Math.max(rim+30,headY-h*.14):h*.67,gr=r*1.04;
   for(let j=0;j<4;j++)arc(cx,rim+8+j*(gy-rim)/3,cz,gr,gr,-.10,Math.PI+.10,m.steel2,2);
   for(let i=0;i<=14;i++){const a=Math.PI*i/14;tube([[cx+Math.cos(a)*gr,rim+5,cz+Math.sin(a)*gr],[cx+Math.cos(a)*gr,gy,cz+Math.sin(a)*gr],[cx+Math.cos(a)*(hob?r*.50:gr),hob?headY-4:gy+5,cz+Math.sin(a)*(hob?r*.50:gr)]],2,m.steel2);}
   tube([[w*.82,h*.68,d*.25],[w*.95,h*.66,d*.28],[w*.94,h*.51,d*.44]],5,m.steel2);cy(w*.94,h*.51,d*.44,9,h*.10,m.dark);
   for(let i=0;i<6;i++)box(w*.806,h*.42+i*9,d*.14,2,3,d*.12,m.dark,1);
  }
  function blender(){
   const q=!!e.quiet,cx=w*.5,cz=d*.46,base=h*(q?.31:.28),jtop=h*(q?.86:.87),jb=base+h*.04,jarW=w*(q?.53:.62),jarD=d*(q?.51:.55);
   feet4(5);box(w*.03,10,d*.03,w*.94,base-10,d*.87,m.dark,14);box(w*.08,base-7,d*.1,w*.84,8,d*.73,m.rubber,3);
   for(const side of [.025,.963])for(let i=0;i<7;i++)box(w*side,22+i*5,d*.24,2,2,d*.45,m.composite,1);
   if(q){fascia(cx,base*.61,d*.906,w*.76,base*.43,'quiet');}
   else{box(w*.05,base*.44,d*.902,w*.90,base*.24,4,m.red,3);text(cx,base*.53,d*.93,w*.55,'Vitamix');cy(cx,base*.80,d*.925,w*.088,4,m.steel2,'z');cy(cx,base*.80,d*.95,w*.075,10,m.dark,'z');box(cx-1.5,base*.80,d*.98,3,w*.055,2,m.white,1);for(let i=0;i<11;i++){const a=Math.PI*i/10;box(cx+Math.cos(a)*w*.11,base*.80+Math.sin(a)*w*.11,d*.916,1.5,3,2,m.white,0);}for(const x of [w*.19,w*.81]){box(x-10,base*.73,d*.91,20,24,3,m.steel2,2);box(x-7,base*.75,d*.916,14,15,4,m.dark,1);}}
   cy(cx,jb-6,cz,jarW*.42,16,m.composite);ring(cx,jb,cz,jarW*.39,3,m.steel2);
   loft(cx,cz,[[jb,jarW*.68,jarD*.68,12],[jb+15,jarW*.73,jarD*.73,14],[jtop,jarW,jarD,18]],m.clear);
   trim(cx,jtop,cz,jarW,jarD,18,m.clearEdge,2);
   for(const [xx,zz] of [[-1,-1],[-1,1],[1,-1],[1,1]])tube([[cx+xx*jarW*.30,jb+8,cz+zz*jarD*.30],[cx+xx*jarW*.45,jtop-8,cz+zz*jarD*.45]],1.7,m.clearEdge);
   for(let i=0;i<7;i++)box(cx-jarW*.13,jb+28+(jtop-jb-45)*i/7,cz+jarD*(.38+i*.014),jarW*(i%2?.15:.23),1,1,m.composite,0);
   const hx=cx-jarW*.5; tube([[hx,jtop-18,cz],[hx-w*.13,jtop-26,cz],[hx-w*.15,jb+(jtop-jb)*.28,cz],[hx+w*.03,jb+(jtop-jb)*.20,cz]],q?6:7,m.clearEdge);
   cy(cx,jb+8,cz,6,18,m.steel2);for(const a of [0,Math.PI/2]){const blade=box(cx-jarW*.26,jb+8,cz-4,jarW*.52,2,8,m.steel2,1);blade.rotation.y=a;}
   if(q)box(cx-jarW*.55,jtop,cz-jarD*.55,jarW*1.10,16,jarD*1.10,m.rubber,12);else{cy(cx,jtop+9,cz,jarW*.58,23,m.rubber);ring(cx,jtop-1,cz,jarW*.58,3,m.clearEdge);}cy(cx,jtop+22,cz,jarW*.24,20,m.clearEdge);cy(cx,jtop+31,cz,jarW*.25,4,m.composite);
   if(q){const z=d*.42,ww=w*.88,dd=d*.76;loft(cx,z,[[base,ww,dd,10],[h*.94,ww,dd,14],[h*.978,ww*.93,dd*.94,16]],m.clear);box(cx-ww*.465,h*.978,z-dd*.47,ww*.93,3,dd*.94,m.clear,10);trim(cx,h*.985,z,ww*.93,dd*.94,14,m.composite,3);for(const x of [w*.06,w*.94])tube([[x,base,z-dd/2],[x,h*.96,z-dd/2],[x,h*.98,z+dd*.45],[x,base+12,z+dd/2]],3,m.clearEdge);box(w*.12,base+25,z+dd/2-4,w*.76,20,14,m.cast,7);for(const x of [w*.16,w*.84])cy(x,h*.88,z-dd/2,8,25,m.composite,'x');}
  }
  function grinder(){
   const ek=!!e.ek,cx=w/2,cz=d*(ek?.40:.43),hopperBase=h*(ek?.62:.60),hr=w*(ek?.34:.43),top=h*.98;
   if(ek){for(const x of [w*.04,w*.80])box(x,6,d*.08,w*.16,h*.035,d*.85,m.dark,6);box(w*.04,6,d*.08,w*.92,h*.035,d*.17,m.dark,6);arc(cx,h*.04,d*.68,w*.30,d*.19,0,Math.PI,m.steel2,2);}else box(w*.04,6,d*.08,w*.92,h*.045,d*.85,m.dark,11);feet4(5);
   if(ek){
    // Tall, tapered pedestal and horizontal burr chamber identify the EK43.
    loft(cx,d*.25,[[h*.05,w*.46,d*.29,6],[h*.48,w*.31,d*.25,7]],m.dark);
    cy(cx,h*.51,d*.40,w*.245,d*.52,m.dark,'z');ring(cx,h*.51,d*.68,w*.246,2,m.composite,'z');
    cy(cx,h*.51,d*.68,w*.21,16,m.composite,'z');cy(cx,h*.51,d*.73,w*.14,18,m.dark,'z');
    for(let i=0;i<16;i++){const a=i*Math.PI/8;cy(cx+Math.sin(a)*w*.18,h*.51+Math.cos(a)*w*.18,d*.699,1.6,2,m.white,'z');}
    box(cx-3,h*.51,d*.78,6,w*.12,3,m.white,1);box(cx-w*.09,h*.35,d*.63,w*.18,h*.11,d*.14,m.dark,6);
    tube([[cx-w*.09,h*.42,d*.66],[cx-w*.14,h*.40,d*.81],[cx+w*.14,h*.40,d*.81],[cx+w*.09,h*.42,d*.66]],3,m.steel2);box(cx-6,h*.33,d*.80,12,h*.07,10,m.dark,3);
    button(w*.68,h*.27,d*.40,6,m.red);text(cx,h*.14,d*.40,w*.18,'EK43');
    for(let i=0;i<9;i++)box(w*.738,h*.47+i*6,d*.21,1,3,d*.18,m.composite,1);
   }else{
    cy(cx,h*.32,cz,w*.39,h*.53,m.dark);cy(cx,h*.58,cz,w*.40,h*.035,m.steel2);
    box(w*.19,h*.31,d*.57,w*.62,h*.22,d*.16,m.dark,10);fascia(cx,h*.47,d*.738,w*.52,h*.10,'grind');
    cy(cx,h*.36,d*.76,w*.08,14,m.steel2,'z');box(w*.43,h*.26,d*.68,w*.14,h*.07,d*.11,m.steel2,4);
    for(const x of [w*.36,w*.64])tube([[x,h*.19,d*.61],[x,h*.19,d*.86]],4,m.steel2);
    tube([[w*.32,h*.19,d*.64],[w*.32,h*.28,d*.68]],3,m.steel2);button(w*.73,h*.47,d*.735,5,m.composite);
    cy(cx,h*.08,d*.73,w*.31,7,m.composite);for(let i=0;i<5;i++)box(w*.33+i*w*.08,h*.09,d*.60,3,2,d*.26,m.dark,0);
   }
   cy(cx,hopperBase,cz,hr*.36,h*.05,m.dark);lathe(cx,hopperBase,cz,[[hr*.36,0],[hr*.46,h*.05],[hr*.88,(top-hopperBase)*.68],[hr,top-hopperBase],[hr-2,top-hopperBase],[hr*.86,(top-hopperBase)*.68],[hr*.43,h*.05],[hr*.34,0]],m.clear);
   cy(cx,top,cz,hr+2,8,m.dark);ring(cx,top-5,cz,hr,2,m.clearEdge);
   // A deterministic small bean bed gives scale through the hopper, without a texture download.
   const coffee=m.coffee;cy(cx,hopperBase+h*.05,cz,hr*.44,h*.07,coffee,'y',hr*.60);for(let i=0;i<35;i++){const a=i*2.39996,rr=Math.sqrt((i+.5)/35)*hr*.53;const o=mesh(new THREE.SphereGeometry(hr*.055,6,4),coffee,cx+Math.cos(a)*rr,hopperBase+h*.092+Math.sin(i*4)*2,cz+Math.sin(a)*rr);o.scale.set(1,.6,1.5);o.rotation.y=a;}
  }
  function juicer(){
   const cx=w*.48,cz=d*.50,r=w*.42;for(const x of [w*.20,w*.76])for(const z of [d*.34,d*.64])cy(x,12,z,10,24,m.rubber);
   box(w*.17,h*.06,d*.03,w*.66,h*.55,d*.26,m.composite,22);box(w*.16,h*.59,d*.02,w*.68,h*.045,d*.27,m.composite,14);
   cy(cx,h*.31,cz,r,h*.53,m.steel);cy(cx,h*.065,cz,r*1.02,18,m.composite);ring(cx,h*.46,cz,r,2,m.steel2);
   lathe(cx,h*.57,cz,[[r,0],[r*1.03,18],[r*.95,32],[r*.57,h*.11]],m.composite);
   cy(cx,h*.76,cz,r*.58,h*.20,m.steel);cy(cx,h*.88,cz,r*.77,9,m.dark);cy(cx,h*.93,cz,r*.40,h*.08,m.composite);cy(cx,h*.975,cz,r*.46,6,m.dark);
   for(const side of [-1,1])tube([[cx+side*r*.92,h*.24,cz],[cx+side*r*1.03,h*.25,cz],[cx+side*r*1.03,h*.60,cz],[cx+side*r*.81,h*.64,cz]],3,m.steel2);
   tube([[cx,h*.36,cz+r*.95],[cx,h*.34,cz+r*1.24],[cx,h*.28,cz+r*1.39]],9,m.steel2);cy(cx,h*.275,cz+r*1.39,10,8,m.dark);
   box(w*.05,5,d*.66,w*.86,10,d*.33,m.dark,7);for(const x of [w*.05,w*.88])box(x,12,d*.66,w*.03,13,d*.33,m.dark,3);box(w*.05,12,d*.96,w*.86,13,d*.03,m.dark,3);for(let i=0;i<10;i++)box(w*.09+i*w*.078,16,d*.75,2,2,d*.21,m.steel2,1);
   button(cx+r*.70,h*.24,cz+r*.74,7,m.green);button(cx+r*.70,h*.18,cz+r*.74,7,m.red);text(cx,h*.23,cz+r+2,w*.48,'robot coupe');text(cx,h*.16,cz+r+2,w*.24,'J 80');
  }
  function slicer(){
   feet4(10);box(w*.08,22,d*.07,w*.77,h*.18,d*.76,m.cast,18);box(w*.10,h*.12,d*.23,w*.45,h*.20,d*.55,m.cast,17);
   const cx=w*.49,yy=h*.58,zz=d*.34,rad=150;
   // The blade, cover and carriage are separate, leaving an unmistakable cutting plane.
   const start=g.children.length;cy(cx,yy,zz,rad,9,m.steel2,'z');ring(cx,yy,zz+6,rad,3,m.steel2,'z');cy(cx,yy,zz+8,rad*.87,6,m.steel,'z');ring(cx,yy,zz+13,rad*.82,1,m.steel2,'z');cy(cx,yy,zz+14,14,5,m.cast,'z');
   box(cx-rad*.38,yy+rad-12,zz-24,rad*.76,35,55,m.cast,11);button(cx,yy+rad+16,zz+10,8,m.dark);
   // Tilt blade assembly about its own centre, as on the gravity-feed machine.
   const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.22),origin=new THREE.Vector3(cx,yy,zz);for(const o of g.children.slice(start)){o.position.sub(origin).applyQuaternion(q).add(origin);o.quaternion.premultiply(q);}
   cy(w*.56,h*.25,d*.79,9,w*.69,m.steel2,'x');box(w*.54,h*.24,d*.72,w*.10,h*.27,d*.12,m.cast,7);
   const tray=box(w*.20,h*.42,d*.43,w*.53,8,d*.42,m.steel2,5);tray.rotation.x=-.16;tray.rotation.z=-.13;
   // Raised ribbed fence on the sliding product carriage.
   const fence=box(w*.18,h*.43,d*.78,w*.46,h*.34,10,m.cast,6);fence.rotation.z=-.16;
   for(let i=0;i<11;i++){const o=box(w*.19,h*.45+i*h*.025,d*.815,w*.44,2,3,m.steel2,1);o.rotation.z=-.16;}
   tube([[w*.65,h*.57,d*.67],[w*.83,h*.57,d*.67],[w*.87,h*.44,d*.67]],5,m.steel2);cy(w*.84,h*.57,d*.67,12,w*.10,m.dark,'x');
   cy(w*.29,h*.18,d*.87,30,22,m.dark,'z');ring(w*.29,h*.18,d*.884,24,2,m.steel2,'z');button(w*.15,h*.18,d*.856,8,m.green);button(w*.20,h*.18,d*.856,8,m.red);button(w*.75,h*.25,d*.84,11,m.dark);
  }
  function espresso(){
   const leg=h*.13,deck=h*.25,upper=h*.70,front=d*.69,groups=e.groups;
   for(const x of [w*.06,w*.91])for(const z of [d*.12,d*.80]){box(x,3,z,w*.035,leg,d*.07,m.dark,4);box(x,leg-12,z,w*.035,14,d*.07,m.steel2,2);}
   box(w*.025,leg,d*.05,w*.95,h*.12,d*.86,m.steel,8);box(w*.03,deck,d*.05,w*.94,upper-deck,d*.30,m.steel,5);
   // Sloping side cheeks enclose the boiler; the entire work area stays open.
   for(const x of [w*.025,w*.95]){const sh=new THREE.Shape();sh.moveTo(d*.04,deck);sh.lineTo(d*.37,deck);sh.lineTo(d*.72,h*.91);sh.lineTo(d*.04,h*.95);sh.closePath();const side=mesh(new THREE.ExtrudeGeometry(sh,{depth:w*.025,bevelEnabled:true,bevelSize:2,bevelThickness:2,bevelSegments:2}),m.steel,x,0,0);side.rotation.y=-Math.PI/2;side.position.x+=w*.025;}
   box(w*.03,upper,d*.08,w*.94,h*.21,d*.61,m.steel,5);box(w*.03,upper-3,front-8,w*.94,6,14,m.dark,1);
   // Top cup tray and three open retaining rails.
   box(w*.05,h*.912,d*.08,w*.90,4,d*.57,m.steel2,2);for(const z of [d*.09,d*.65])for(const x of [w*.07,w*.93])cy(x,h*.953,z,3,h*.08,m.steel2);
   for(const y of [h*.935,h*.98])tube([[w*.07,y,d*.65],[w*.07,y,d*.09],[w*.93,y,d*.09],[w*.93,y,d*.65]],3,m.steel2);
   for(let i=0;i<16;i++)box(w*.08+i*w*.054,h*.917,d*.13,2,1,d*.45,m.dark,0);
   box(w*.06,deck,d*.40,w*.88,10,d*.48,m.steel2,4);for(let i=0;i<Math.round(w/16);i++)box(w*.08+i*(w*.84/Math.round(w/16)),deck+10,d*.43,3,1,d*.40,m.dark,1);
   for(let i=0;i<groups;i++){
    const x=w*(.22+i*.56/(groups-1));box(x-34,upper-36,d*.49,68,48,95,m.steel2,8);cy(x,upper-43,d*.61,31,24,m.steel2);cy(x,upper-58,d*.61,29,12,m.dark);cy(x,upper-65,d*.61,27,8,m.steel2);
    tube([[x,upper-68,d*.62],[x+10,upper-76,d*.74],[x+20,upper-90,d*.87]],8,m.dark);tube([[x-8,upper-72,d*.60],[x-11,upper-88,d*.61]],3,m.steel2);tube([[x+8,upper-72,d*.60],[x+11,upper-88,d*.61]],3,m.steel2);
    for(let j=0;j<3;j++)button(x+(j-1)*18,h*.79,front+1,5,m.steel2);
   }
   for(const x of [w*.09,w*.91]){cy(x,h*.80,front+8,19,24,m.dark,'z');cy(x,h*.80,front+23,12,8,m.composite,'z');tube([[x,h*.72,front-4],[x,h*.55,front+9],[x+(x<w/2?-12:12),h*.49,d*.80],[x+(x<w/2?-10:10),deck+26,d*.82]],4,m.steel2);cy(x,h*.58,front+9,7,h*.10,m.dark);}
   cy(w*(groups===3?.36:.5),h*.80,front+3,16,4,m.steel2,'z');cy(w*(groups===3?.36:.5),h*.80,front+6,13,1,m.white,'z');const needle=box(w*(groups===3?.36:.5)-1,h*.80-1,front+8,2,11,1,m.red,0);needle.rotation.z=.65;
   box(w*.5-23,h*.87,front+1,46,12,1,m.dark,1);text(w*.5,h*.18,d*.914,w*.14,'LA MARZOCCO');text(w*.5,h*.60,d*.045,w*.28,'LA MARZOCCO').rotation.y=Math.PI;
  }
  function vacuum(){
   const cx=w/2,cz=d*.47,body=h*.70,ww=w*.94,dd=d*.88;feet4(6);
   box(w*.03,12,d*.03,ww,body-37,dd,m.steel,10);
   // A chamber liner sits above the motor cabinet, with visible recessed floor.
   box(w*.08,body-20,d*.08,w*.84,5,d*.76,m.steel2,8);
   for(const x of [w*.03,w*.95])box(x,body-20,d*.03,w*.02,35,dd,m.steel2,3);
   for(const z of [d*.03,d*.88])box(w*.03,body-20,z,ww,35,d*.03,m.steel2,3);
   trim(cx,body+14,cz,ww-8,dd-8,12,m.rubber,3);
   if(e.twin)for(const x of [w*.15,w*.85])box(x-7,body-9,d*.14,14,15,d*.66,m.seal,3);
   else box(w*.13,body-9,d*.76,w*.74,15,14,m.seal,3);
   loft(cx,cz,[[body+16,ww,dd,13],[body+30,ww*.98,dd*.97,19],[h*.96,ww*.79,dd*.74,28],[h*.98,ww*.73,dd*.69,27]],m.cover);
   plate(cx,h*.98,cz,ww*.73,dd*.69,27,m.cover);trim(cx,body+17,cz,ww,dd,13,m.clearEdge,3);trim(cx,h*.975,cz,ww*.74,dd*.70,26,m.clearEdge,2);
   for(const x of [w*.18,w*.82]){cy(x,body+14,d*.045,8,w*.11,m.steel2,'x');tube([[x,body-5,d*.055],[x,body+26,d*.10]],5,m.steel2);}
   tube([[w*.22,body+25,d*.875],[w*.22,body+38,d*.935],[w*.78,body+38,d*.935],[w*.78,body+25,d*.875]],5,m.steel2);
   box(w*.14,h*.16,d*.914,w*.72,h*.38,3,m.dark,4);fascia(cx,h*.35,d*.921,w*.65,h*.30,'vacuum');
   cy(w*.73,h*.40,d*.927,w*.045,4,m.steel2,'z');cy(w*.73,h*.40,d*.931,w*.039,2,m.white,'z');const needle=box(w*.73-1,h*.40,d*.934,2,w*.029,1,m.dark,0);needle.rotation.z=-.7;
   text(cx,h*.62,d*.916,w*.28,'Henkelman');for(let i=0;i<9;i++)box(w*.974,h*.16+i*7,d*.23,1,3,d*.36,m.dark,1);
  }

  const builders={mixer,cutter,veg,sheeter,planetary,blender,grinder,juicer,slicer,espresso,vacuum};
  if(!builders[e.family])throw new Error('Unknown equipment family: '+e.family);builders[e.family]();
  // Preserve the planner's authoritative catalogue envelope. Do not silently
  // replace dimensions with dimensions from another model year or attachment.
  g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3()),k=Math.min(1,w/s.x,h/s.y,d/s.z);
  for(const o of g.children){o.position.sub(new THREE.Vector3(b.min.x,b.min.y,b.min.z)).multiplyScalar(k);o.scale.multiplyScalar(k);o.position.x+=(w-s.x*k)/2;o.position.z+=(d-s.z*k)/2;}
  return g;
 }
 return {entries,identify,mixerFamily,build};
})();
