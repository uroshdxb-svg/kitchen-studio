/* Illustrative equipment families. These never assign a manufacturer model ID.
 * Identify from the equipment description, not incidental words in a category.
 * All geometry is fitted uniformly inside the existing catalogue envelope. */
const KS3DFamilies=(()=>{
 function identify(it){
  if(it.kind&&it.kind!=='eq')return null;
  const n=String(it.name||'').toLowerCase();
  const has=re=>re.test(n);
  if(has(/^(?:cocktail bar station|bar (?:mixology station|wet-waste sink|fusion hand-wash|drainboard blender station|hand sink|blender station))/))return 'bar-station';
  if(has(/^\d+-inch (?:mixology cocktail station|freestanding dry-waste bar cabinet|bar (?:drainboard with recessed wet-waste sink|wet-waste sink cabinet))/))return 'bar-station';
  if(has(/ingredient bin/))return 'ingredient-bin';
  if(has(/waste container|round container/))return 'waste-bin';
  if(has(/dish caddy|plate dispenser/))return 'plate-cart';
  if(has(/dolly|platform trolley/))return 'dolly';
  if(has(/insulated.*(?:cart|carrier)|transport box/))return 'insulated-carrier';
  if(has(/shelf.*cart|utility cart|(?:two|three)[ -]tier.*trolley/))return 'utility-cart';
  if(has(/service trolley.*plates|plate and rack trolley/))return 'utility-cart';
  if(has(/trolley/)&&!has(/combi|oven/))return 'tray-trolley';
  if(has(/oven stand/))return 'oven-stand';
  if(has(/storage cabinet|base cupboard|closed base/))return 'storage-cabinet';
  if(has(/open base/)&&!has(/on\s+(?:an?\s+)?open base/))return 'open-base';
  if(has(/work table/))return 'work-table';
  if(has(/sink top|worktop with.*well/))return 'sink-top';
  if(has(/neutral worktop|ambient.*worktop/))return 'neutral-top';
  if(has(/rice cooker|soup kettle/))return 'rice-soup';
  if(has(/chest freezer/))return 'chest-freezer';
  if(has(/prep.*(?:fridge|table)|pizza prep|saladette|prep counter/))return 'prep-counter';
  if(has(/refrigerated (?:counter|base)|undercounter.*(?:fridge|freezer)|counter.*(?:fridge|freezer)|drawer.*fridge|fridge counter|freezer base|lowboy|chef base/))return 'refrigerated-counter';
  if(has(/ice maker|ice machine|ice cuber|dice cuber/))return has(/head|bin separate/)?'ice-head':has(/dispenser/)?'ice-dispenser':'ice-machine';
  if(has(/ice.*(?:bin|storage)/))return 'ice-bin';
  if(has(/cold room|freezer room|walk-in/))return 'coldroom';
  if(has(/multideck|display.*(?:fridge|refrigerat|counter)|glass door upright fridge|bottle cooler/))return 'display-fridge';
  if(has(/conveyor.*(?:dishwash|warewash)/))return 'conveyor-washer';
  if(has(/hood.*(?:dishwash|utensil|washer)|pass-through.*washer/))return 'hood-washer';
  if(has(/dishwasher|glasswasher|utensil washer|pot washer/))return 'front-washer';
  if(has(/carving station|fry holding|chip scuttle/))return 'holding-station';
  if(has(/holding bin|pick-up locker|product holding/))return 'holding-cubbies';
  if(has(/holding.*display cabinet|heated merchandiser/))return 'heated-display';
  if(has(/holding.*(?:cabinet|cart)|banquet cart|cook & hold|hold & serve drawers|drawer warmer|hot cupboard/)&&!has(/bain.marie/))return 'hot-cabinet';
  if(has(/strip heater|heated shelf/))return 'heated-shelf';
  if(has(/oil filter/))return 'oil-filter';
  if(has(/dunnage rack/))return 'dunnage-rack';
  if(has(/doner|shawarma/))return 'spit-grill';
  if(has(/tandoor/))return 'tandoor';
  if(has(/charcoal oven/))return 'charcoal-oven';
  if(has(/stock.?pot|wok range/))return 'stockpot-range';
  if(has(/steam kettle|boiling pan/))return 'kettle';
  if(has(/bratt|tilting pan|ivario|multifunctional cooker/))return 'bratt-pan';
  if(has(/basket lifting/))return 'basket-lift';
  if(has(/contact grill|clamshell|sandwich press|waffle/))return 'contact-grill';
  if(has(/crepe/))return 'crepe';
  if(has(/(?:range|burner).*(?:griddle)/))return 'combination-range';
  if(has(/fry top|griddle|plancha/))return 'griddle';
  if(has(/chargrill|charbroil|lava.*grill|powergrill/))return 'chargrill';
  if(has(/induction|infrared|hot (?:round |square )?plates?|electric hob/))return 'hob';
  if(has(/solid top/))return 'solid-top';
  if(has(/salamander/))return 'salamander';
  if(has(/conveyor.*pizza|conveyor.*oven/))return 'conveyor-oven';
  if(has(/deck.*(?:oven|pizza)|baking chamber/))return 'deck-oven';
  if(has(/multi-cook oven/))return 'multi-oven';
  if(has(/high-speed|rapid-cook|microwave|ventless.*pizza/))return 'speed-oven';
  if(has(/conveyor toaster/))return 'conveyor-toaster';
  if(has(/bun toaster/))return 'bun-toaster';
  if(has(/immersion circulator/))return 'circulator';
  if(has(/water bath|bain.marie|warmer.*steamer|rethermalizer/))return 'water-bath';
  if(has(/chamber vacuum/))return 'vacuum';
  if(has(/bread slicer/))return 'bread-slicer';
  if(has(/gravity slicer|vertical slicer|food slicer/))return 'slicer';
  if(has(/bone saw/))return 'bone-saw';
  if(has(/potato peeler/))return 'peeler';
  if(has(/salad spinner/))return 'spinner';
  if(has(/meat mincer/))return 'mincer';
  if(has(/turbo liquidiser/))return 'liquidiser';
  if(has(/sieve|coulis/))return 'sieve';
  if(has(/frozen.*processor|pacotizing|micro.puree/))return 'frozen-processor';
  if(has(/cooking food processor/))return 'heated-processor';
  if(has(/veg.*prep|vegetable preparation/))return 'veg-processor';
  if(has(/cutter|blixer|blender.mixer/))return 'cutter';
  if(has(/citrus juicer/))return 'citrus-juicer';
  if(has(/centrifugal juicer/))return 'juicer';
  if(has(/coffee grinder|espresso grinder/))return 'coffee-grinder';
  if(has(/blender/))return 'blender';
  if(has(/soft serve/))return 'soft-serve';
  if(has(/granita|slush/))return 'slush';
  if(has(/milkshake|drink mixer/))return 'drink-mixer';
  if(has(/hot[- ]water dispenser/))return 'water-urn';
  if(has(/hot[- ]water boiler/))return 'water-boiler';
  if(has(/batch.*brewer/))return 'batch-brewer';
  if(has(/super.automatic|bean.to.cup/))return 'automatic-coffee';
  if(has(/espresso machine/))return 'espresso';
  return null;
 }
 const cache=new WeakMap();
 function materials(M){
  if(cache.has(M))return cache.get(M);
  const mat=(color,roughness=.5,metalness=0,extra={})=>new THREE.MeshStandardMaterial({color:KS3DAssets.linear(color),roughness,metalness,...extra});
  const m={...M,paint:mat(0xe0e1de,.4),plastic:mat(0x343b40,.65),blue:mat(0x758e9d,.7),red:mat(0x9d2c24,.4),green:mat(0x277c58,.5),orange:mat(0xe4a538,.5),cream:mat(0xd5c6a8,.8),clear:mat(0xc7d6dc,.12,.03,{transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide})};
  m.polished=M.steel.clone();m.polished.metalness=1;m.polished.roughness=.22;
  cache.set(M,m);return m;
 }
 function build(it,a){
  const family=identify(it);if(!family)return null;
  const {w,h,d}=it,n=String(it.name||'').toLowerCase(),m=materials(a.M),g=new THREE.Group(),small=Math.min(w,h,d),floor=it.mount==='floor',fy=floor?.10:.025;
  g.userData.modelFamily=family;g.userData.equipmentModel=null;
  const mesh=(geo,mat,x=0,y=0,z=0)=>{geo.userData.ownedByScene=true;const o=new THREE.Mesh(geo,mat);o.position.set(x*w,y*h,z*d);o.castShadow=!mat.transparent;o.receiveShadow=true;g.add(o);return o;};
  function box(x,y,z,ww,hh,dd,mat=m.steel){
   if(Math.min(ww,hh,dd)<=0)return;
   const dims=[ww*w,hh*h,dd*d],r=Math.min(4,...dims.map(v=>v*.12)),geo=new THREE.BoxGeometry(...dims,4,4,4),p=geo.attributes.position,nm=geo.attributes.normal;
   for(let i=0;i<p.count;i++){const v=[p.getX(i),p.getY(i),p.getZ(i)];for(let j=0;j<3;j++)if(Math.abs(v[j])>dims[j]*.1&&Math.abs(v[j])<dims[j]*.4)v[j]=Math.sign(v[j])*(dims[j]/2-r);const c=v.map((q,j)=>THREE.MathUtils.clamp(q,-dims[j]/2+r,dims[j]/2-r)),nn=new THREE.Vector3(...v.map((q,j)=>q-c[j])).normalize();p.setXYZ(i,c[0]+nn.x*r,c[1]+nn.y*r,c[2]+nn.z*r);nm.setXYZ(i,nn.x,nn.y,nn.z);}
   return mesh(geo,mat,x+ww/2,y+hh/2,z+dd/2);
  }
  function cy(x,y,z,r,len,mat=m.steel2,axis='y',r2=r){const o=mesh(new THREE.CylinderGeometry(r2*Math.min(w,d),r*Math.min(w,d),len*({x:w,y:h,z:d}[axis]),32),mat,x,y,z);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o;}
  function tube(pts,r=.007,mat=m.steel2){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(p[0]*w,p[1]*h,p[2]*d)),false,'centripetal'),Math.max(8,pts.length*5),small*r,8,false),mat);}
  function ring(x,y,z,r,mat=m.steel2,axis='y',th=.006){const o=mesh(new THREE.TorusGeometry(r*Math.min(w,d),small*th,8,40),mat,x,y,z);if(axis==='y')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.y=Math.PI/2;return o;}
  function bowl(x,y,z,r,height,mat=m.polished){const rad=r*Math.min(w,d),hh=height*h,t=Math.min(3,rad*.04);return mesh(new THREE.LatheGeometry([[0,0],[rad*.72,0],[rad*.96,hh*.18],[rad,hh],[rad-t,hh],[rad-t,hh*.2],[rad*.70,t],[0,t]].map(p=>new THREE.Vector2(...p)),40),mat,x,y,z);}
  const handle=(x,y,z,len)=>tube([[x,y,z],[x,y,z+.045],[x+len,y,z+.045],[x+len,y,z]],.011);
  const button=(x,y,z,mat=m.dark,r=.018)=>{cy(x,y,z,r, .012,m.steel2,'z');cy(x,y,z+.01,r*.7,.013,mat,'z');};
  const controls=(y=.83,z=.965,count=2)=>{box(.08,y-.04,z,.22,.08,.012,m.dark);for(let i=0;i<count;i++)button(.68+i*.18/Math.max(1,count-1),y,z+.012);};
  const vents=(x,y,z,ww,hh,count=8)=>{box(x,y,z,ww,hh,.008,m.dark);for(let i=1;i<count;i++)box(x+.01,y+hh*i/count,z+.01,ww-.02,Math.min(.008,hh/(count*3)),.008,m.steel2);};
  function legs(top=.9,wheels=false){for(const x of [.08,.92])for(const z of [.08,.9]){if(wheels){cy(x,.045,z,.044,.035,m.rubber,'x');cy(x,.045,z,.024,.042,m.steel2,'x');box(x-.025,.06,z-.025,.05,.055,.05,m.steel2);}box(x-.02,wheels?.10:.02,z-.02,.04,top-(wheels?.10:.02),.04,m.steel2);if(!wheels)cy(x,.015,z,.028,.03,m.rubber);}}
  function shell(top=.94){legs(fy);box(.02,fy,.02,.96,top-fy,.91);box(.03,top,.015,.94,.025,.93,m.polished);}
  function door(x,y,width,height,z=.94){box(x,y,z,width,height,.016,m.rubber);box(x+.006,y+.008,z+.018,width-.012,height-.016,.018,m.steel);handle(x+width*.2,y+height*.85,z+.04,width*.6);}
  function grid(x,y,z,ww,dd,mat=m.steel2,step=10){for(let i=0;i<=step;i++)box(x+ww*i/step,y,z,.005,.007,dd,mat);for(let i=0;i<=6;i++)box(x,y,z+dd*i/6,ww,.007,.005,mat);}
  function tray(x,y,z,ww,dd){box(x,y,z,ww,.012,dd,m.polished);for(const xx of [x,x+ww-.009])box(xx,y,z,.009,.03,dd,m.steel2);for(const zz of [z,z+dd-.009])box(x,y,zz,ww,.03,.009,m.steel2);}
  function cooking(){
   const top=.80;shell(top-.08);controls(fy+(top-fy)*.55,.95,Math.max(1,Math.min(4,Math.round(w/400))));
   if(floor)door(.06,fy+.02,.88,.38);
   box(.04,top,.04,.92,.04,.86,m.steel2);box(.025,top,.025,.025,.17,.88);box(.95,top,.025,.025,.17,.88);box(.025,top,.025,.95,.17,.025);
   if(family==='griddle'||family==='solid-top'||family==='combination-range'){
    const sw=family==='combination-range'?.48:.87;box(.065,top+.035,.08,sw,.025,.70,family==='solid-top'?m.iron:m.polished);
    if(/ribbed/.test(n))for(let i=0;i<16;i++)box(.07+sw*i/16,top+.062,.09,.007,.008,.67,m.steel2);
    box(.08,top+.018,.81,.80,.018,.035,m.dark);box(.07,top-.04,.88,.20,.045,.05,m.steel2);
   }
   if(family==='chargrill')for(let i=0;i<24;i++)box(.065+.87*i/24,top+.045,.08,.018,.025,.73,m.iron);
   if(family==='hob'||family==='combination-range'){
    const zones=+(n.match(/(\d)[ -](?:zone|round hot|square hot|hot plate)/)||[])[1]||(/single|1 zone|wok/.test(n)?1:w>600?4:2),x0=family==='combination-range'?.57:.07,ww=.90-x0;
    box(x0,top+.04,.08,ww,.016,.73,m.glass);
    for(let i=0;i<zones;i++){const cols=zones>2?2:1,x=x0+ww*((i%cols)+.5)/cols,z=.08+.73*(Math.floor(i/cols)+.5)/Math.ceil(zones/cols),r=Math.min(ww*w/cols,.73*d/Math.ceil(zones/cols))*.34/Math.min(w,d);if(/wok/.test(n))bowl(x,top+.02,z,r,.06,m.iron);else if(/hot plate/.test(n))cy(x,top+.065,z,r,.025,m.iron);else{ring(x,top+.061,z,r,m.steel2);ring(x,top+.061,z,r*.84,m.steel2);}}
   }
  }
  function table(){
   if(family==='bar-station'){
    // Illustrative fixture construction, not manufacturer CAD or a working envelope.
    // Blender shelves and empty outlet boxes do not imply an included appliance.
    const mixology=/mixology cocktail station/.test(n),cocktail=/cocktail bar station/.test(n)||mixology,sink=/sink/.test(n)||mixology,rinser=/rinser/.test(n)||mixology,dry=/dry-waste/.test(n),top=.80;
    legs(top-.03);box(.03,.64,.03,.94,.15,.018);box(.03,.64,.90,.94,.15,.018);
    box(.03,top,.025,.94,.18,.025);box(.03,top,.05,.94,.025,.10,m.polished);
    box(.03,top,.82,.94,.025,.10,m.polished);
    function well(x,z,ww,dd){
     box(x,top-.14,z,ww,.012,dd,m.polished);
     for(const xx of [x,x+ww-.012])box(xx,top-.14,z,.012,.16,dd,m.polished);
     for(const zz of [z,z+dd-.012])box(x,top-.14,zz,ww,.16,.012,m.polished);
     cy(x+ww/2,top-.12,z+dd/2,.025,.008,m.dark);
    }
    if(cocktail){well(.08,.18,.24,.61);well(.38,.18,.54,.61);box(.06,.56,.84,.88,.018,.13);box(.06,.56,.955,.88,.12,.018);}
    else if(sink){well(.14,.18,.72,.61);box(.03,top,.15,.11,.025,.67);box(.86,top,.15,.11,.025,.67);}
    else if(dry){box(.04,top,.16,.92,.025,.63);cy(.5,top+.028,.46,.20,.008,m.dark);ring(.5,top+.036,.46,.20,m.polished);}
    else{tray(.04,top,.16,.92,.63);grid(.07,top+.02,.19,.86,.57);}
    if(sink){const x=cocktail?.20:.52;tube([[x,.81,.12],[x,.96,.12],[x,.97,.25],[x,.91,.34]],.009);for(const xx of [x-.09,x+.09])cy(xx,.84,.12,.018,.035,m.polished);}
    if(rinser){cy(.75,top+.04,.56,.075,.02,m.dark);cy(.75,top+.065,.56,.035,.025,m.steel2);}
    if(/dipper well/.test(n))bowl(.22,top-.07,.35,.075,.09);
    if(/cutting board/.test(n))box(.15,top+.035,.48,.68,.016,.30,m.plastic);
    if(/blender/.test(n))box(.11,.51,.35,.78,.025,.48,m.polished);
    if(/cabinet/.test(n)){
     if(/bar wet-waste sink cabinet/.test(n)){box(.05,.15,.06,.90,.02,.78);for(const x of [.05,.49,.93])box(x,.17,.06,.02,.47,.78);box(.05,.17,.06,.90,.47,.02);}
     else{box(.05,.15,.06,.90,.48,.78);door(.07,.17,.86,.43,.91);}
    }
    if(/towel and soap/.test(n)){box(.20,.50,.90,.60,.15,.06);box(.27,.515,.965,.46,.025,.012,m.dark);cy(.83,.86,.17,.03,.08,m.plastic);}
    return;
   }
   if(family==='dunnage-rack'){legs(.80);box(.03,.80,.03,.94,.10,.90,m.plastic);for(let i=0;i<7;i++)box(.08+i*.13,.91,.10,.07,.008,.76,m.dark);return;}
   if(family==='sink-top'){
    // The top and bowl are open geometry; a solid cabinet would fill the well.
    box(.02,.04,.02,.96,.025,.94);for(const x of [.02,.95])box(x,.065,.02,.03,.89,.94);for(const z of [.02,.93])box(.02,.065,z,.96,.89,.03);
    box(.02,.94,.02,.96,.035,.16);box(.02,.94,.80,.96,.035,.16);box(.02,.94,.18,.13,.035,.62);box(.85,.94,.18,.13,.035,.62);
    box(.15,.26,.18,.70,.018,.62,m.polished);box(.15,.26,.18,.012,.70,.62);box(.838,.26,.18,.012,.70,.62);box(.15,.26,.18,.70,.70,.012);box(.15,.26,.788,.70,.70,.012);cy(.5,.29,.5,.028,.008,m.dark);
    // Catalogue descriptions explicitly exclude the optional tap height.
    return;
   }
   const top=/upstand/.test(n)?.88:.97,under=/lower shelf|undershelf/.test(n);
   if(family==='work-table'||family==='oven-stand'||family==='open-base'){
    legs(top-.035,/wheel|castor|mobility/.test(n));box(.02,top-.035,.02,.96,.035,.94,m.polished);
    if(under||family==='open-base'||/1 shelf|stand i\b/.test(n))box(.06,.20,.06,.88,.02,.84);
    if(family==='oven-stand'){
     if(/side wall|stand ii|stand iii|stand iv/.test(n)){box(.04,.14,.06,.012,top-.2,.84);box(.948,.14,.06,.012,top-.2,.84);}
     if(/back wall|stand iii/.test(n))box(.06,.14,.04,.88,top-.2,.012);
     const levels=+(n.match(/(\d+) (?:gn )?runner/)||[])[1]||0;for(let i=0;i<Math.min(levels,24);i++){const y=.19+(top-.27)*i/Math.max(1,levels-1);for(const x of [.06,.89])box(x,y,.09,.05,.009,.78);}
     if(/doors/.test(n))for(let i=0;i<2;i++)door(.06+i*.44,.14,.43,top-.19);
    }else{for(const z of [.08,.88])box(.08,.20,z,.84,.025,.025);}
   }else if(family==='storage-cabinet'){
    shell(top-.03);const cols=w>750?2:1;for(let i=0;i<cols;i++)door(.04+i*.92/cols,fy+.02,.91/cols,top-fy-.09);
   }else{shell(top-.04);if(/drawer/.test(n))door(.06,.35,.88,.30);}
   if(/upstand/.test(n))box(.02,top-.01,.02,.96,1-top,.02);
  }
  function refrigerated(){
   if(family==='chest-freezer'){legs(.09);box(.03,.09,.03,.94,.79,.90,m.paint);box(.02,.89,.02,.96,.07,.92);handle(.3,.92,.96,.4);for(const x of [.15,.80])box(x,.85,.02,.06,.12,.035,m.steel2);vents(.08,.15,.94,.25,.17,7);return;}
   if(family==='coldroom'){
    box(.015,.01,.015,.97,.97,.93,m.paint);for(let x=.15;x<.95;x+=.15)box(x,.02,.947,.004,.94,.004,m.steel2);
    door(.24,.025,.49,.82,.95);box(.27,.86,.97,.30,.065,.02,m.dark);for(const y of [.15,.65])box(.22,y,.98,.035,.08,.02,m.steel2);return;
   }
   if(family==='display-fridge'){
    legs(.08);box(.03,.08,.02,.94,.85,.12);box(.03,.08,.02,.04,.85,.90);box(.93,.08,.02,.04,.85,.90);box(.03,.93,.02,.94,.04,.90);box(.03,.08,.02,.94,.12,.90);
    for(let j=0;j<4;j++)tray(.09,.24+j*.20,.12,.82,.72);
    box(.08,.21,.89,.84,.69,.008,m.clear);handle(.83,.56,.91,.03);vents(.08,.1,.93,.84,.08,5);return;
   }
   const prep=family==='prep-counter',top=prep?.76:.94;shell(top);
   const drawers=+(n.match(/(\d+)[ -]drawer/)||[])[1]||(/single drawer/.test(n)?1:0),cols=+(n.match(/(\d+)[ -](?:door|section)/)||[])[1]||(drawers?Math.min(drawers,Math.max(1,Math.round(w/600))):Math.max(1,Math.round(w/600))),comp=.20,ww=(.93-comp)/cols;
   vents(.04,fy+.08,.956,.14,top-fy-.15,10);
   for(let i=0;i<cols;i++){const nd=drawers?Math.ceil(drawers/cols):1;for(let j=0;j<nd;j++)door(comp+i*ww,fy+.015+j*(top-fy-.03)/nd,ww-.012,(top-fy-.05)/nd);}
   if(prep){
    box(.025,top+.025,.03,.95,.15,.035);box(.025,top+.025,.03,.025,.15,.43);box(.95,top+.025,.03,.025,.15,.43);
    const count=Math.max(3,Math.min(8,Math.round(w/250)));for(let i=0;i<count;i++){const x=.06+i*.88/count;box(x,top-.03,.09,.83/count,.02,.30,m.polished);box(x,top-.03,.09,.008,.10,.30);box(x+.83/count,top-.03,.09,.008,.10,.30);box(x,top+.06,.09,.83/count,.008,.008);box(x,top+.06,.38,.83/count,.008,.008);}
    box(.04,top+.029,.49,.92,.035,.43,m.cream);
   }
  }
  function ice(){
   shell();const modular=family==='ice-head',bin=family==='ice-bin';
   if(!modular){door(.07,.39,.86,.46);handle(.17,.79,.985,.66);}
   if(!bin)vents(.07,modular?.20:fy+.06,.96,.86,modular?.50:.18,12);
   if(family==='ice-dispenser'){box(.22,.36,.975,.56,.43,.018,m.dark);box(.32,.70,.98,.36,.065,.07,m.steel2);tray(.19,.30,.84,.62,.14);}
   for(const x of [.07,.92])for(const y of [.16,.90])button(x,y,.968,m.steel2,.006);
  }
  function washer(){
   const hood=family==='hood-washer',conv=family==='conveyor-washer';
   if(hood||conv){
    legs(.14);box(.04,.14,.04,.92,.27,.90);box(.04,.64,.04,.92,.31,.90);box(.04,.41,.04,.045,.23,.86);box(.915,.41,.04,.045,.23,.86);
    grid(.10,.42,.10,.80,.72,m.blue,12);box(.08,.44,.09,.84,.08,.018,m.blue);box(.08,.44,.79,.84,.08,.018,m.blue);
    if(hood){for(const x of [.02,.98])tube([[x,.79,.15],[x,.59,.98],[x,.57,1]],.012);tube([[.02,.57,1],[.98,.57,1]],.014);}
    else{for(const x of [.10,.53]){door(x,.66,.36,.25,.95);for(let j=0;j<7;j++)box(x+j*.05,.44,.09,.022,.18,.015,m.rubber);}}
    controls(.88);door(.07,.17,.86,.20);
   }else{shell();door(.055,fy+.07,.89,.66);controls(.88,.96,1);box(.06,fy+.03,.958,.88,.018,.008,m.dark);}
  }
  function oven(){
   if(family==='salamander'){
    box(.03,.04,.05,.94,.08,.85);box(.03,.04,.05,.07,.90,.80);box(.90,.04,.05,.07,.90,.80);box(.03,.82,.05,.94,.15,.80);box(.10,.13,.05,.80,.69,.035,m.dark);grid(.14,.28,.12,.72,.67);handle(.12,.26,.85,.76);controls(.91,.86,2);
    for(let i=0;i<8;i++)box(.15+i*.095,.80,.12,.02,.02,.62,m.iron);return;
   }
   if(family==='conveyor-oven'||family==='conveyor-toaster'){
    legs(.10);box(.21,.12,.06,.58,.24,.88);box(.21,.61,.06,.58,.32,.88);box(.21,.36,.06,.05,.25,.88);box(.74,.36,.06,.05,.25,.88);box(.26,.36,.07,.48,.25,.025,m.dark);
    grid(.02,.39,.14,.96,.70,m.steel2,32);for(const x of [.02,.98])cy(x,.38,.49,.025,.70,m.steel2,'z');box(.02,.31,.12,.96,.035,.025);box(.02,.31,.84,.96,.035,.025);controls(.78,.96,2);return;
   }
   shell();const decks=family==='multi-oven'?3:family==='deck-oven'?(/double|twin|2.*deck/.test(n)?2:1):1;
   for(let i=0;i<decks;i++){const y=fy+.04+i*.69/decks,hh=.64/decks;box(.06,y,.95,.73,hh,.02,m.dark);box(.09,y+.03,.975,.67,hh-.06,.008,m.glass);handle(.12,y+hh-.04,.98,.60);button(.87,y+hh*.5,.97);}
   controls(.89,.96,1);vents(.04,.08,.965,.90,.05,4);
   if(family==='speed-oven'&&!/microwave/.test(n)){box(.81,.35,.973,.12,.27,.01,m.dark);for(let i=0;i<3;i++)box(.83,.39+i*.07,.987,.075,.035,.003,m.blue);}
  }
  function pan(){
   if(family==='kettle'){
    legs(.22);bowl(.5,.22,.5,.39,.60);ring(.5,.82,.5,.40);cy(.5,.845,.5,.39,.025,m.steel);handle(.37,.88,.5,.26);
    for(const x of [.07,.93]){box(x-.035,.12,.30,.07,.66,.40);cy(x,.64,.5,.045,.08,m.steel2,'x');}tube([[.5,.31,.86],[.5,.24,.94],[.5,.17,.94]],.018);button(.9,.58,.72);return;
   }
   legs(.18);box(.05,.18,.05,.90,.25,.86);box(.08,.43,.12,.84,.035,.72,m.polished);box(.08,.43,.12,.025,.34,.72);box(.895,.43,.12,.025,.34,.72);box(.08,.43,.12,.84,.34,.025);box(.08,.43,.815,.84,.34,.025);
   const lid=box(.065,.81,.11,.87,.025,.72,m.steel2);lid.rotation.x=-.12;handle(.26,.85,.67,.48);controls(.33,.96,2);cy(.96,.60,.50,.07,.035,m.dark,'x');
  }
  function trolley(){
   const dolly=family==='dolly',utility=family==='utility-cart',plate=family==='plate-cart';
   legs(dolly?.20:.96,true);
   if(dolly){box(.03,.14,.03,.94,/platform/.test(n)?.12:.72,.92,m.plastic);if(/platform/.test(n))tube([[.08,.21,.10],[.08,.95,.10],[.92,.95,.10],[.92,.21,.10]],.02);return;}
   if(utility){for(const y of /two[ -]tier/.test(n)?[.17,.88]:[.17,.52,.88])tray(.035,y,.035,.93,.90);tube([[.06,.8,.04],[.06,.97,.04],[.94,.97,.04],[.94,.8,.04]],.016);return;}
   if(plate){
    box(.06,.14,.06,.88,.54,.86,m.plastic);for(const x of [.29,.71]){cy(x,.68,.49,.17,.07,m.steel2);for(let i=0;i<12;i++)cy(x,.73+i*.016,.49,.16,.012,m.white);for(const z of [.27,.71])box(x-.015,.68,z,.03,.28,.03,m.steel2);}return;
   }
   const levels=Math.max(4,Math.min(30,+(n.match(/(?:for |, |^)(\d+)(?:x| | levels)/)||[])[1]||16));
   for(let i=0;i<levels;i++){const y=.18+i*.74/(levels-1);for(const x of [.09,.85])box(x,y,.06,.06,.01,.86);}
   for(const z of [.08,.90])box(.09,.17,z,.82,.02,.02);if(/worktop/.test(n))box(.03,.95,.03,.94,.025,.92);
  }
  function bin(){
   const insulated=family==='insulated-carrier',waste=family==='waste-bin',round=/round/.test(n),mobile=/mobile|cart/.test(n);
   if(mobile)legs(.13,true);
   if(round){bowl(.5,.03,.5,.42,.90,m.plastic);ring(.5,.94,.5,.43,m.plastic,'y',.02);for(const x of [.04,.96])box(x-.025,.78,.37,.05,.06,.26,m.plastic);return;}
   if(waste){
    box(.06,.02,.06,.88,.025,.86,m.plastic);for(const x of [.06,.925])box(x,.045,.06,.015,.89,.86,m.plastic);for(const z of [.06,.905])box(.06,.045,z,.88,.89,.015,m.plastic);
    for(const x of [.035,.935])box(x,.92,.035,.03,.04,.91,m.plastic);for(const z of [.035,.915])box(.035,.92,z,.93,.04,.03,m.plastic);for(const x of [.015,.965])box(x-.01,.80,.36,.02,.06,.28,m.plastic);return;
   }
   box(.04,mobile?.13:.02,.04,.92,mobile?.78:.90,.90,insulated?m.blue:m.paint);
   if(insulated){door(.08,.20,.84,.66,.95);for(const x of [.12,.80])box(x,.30,.98,.07,.13,.025,m.plastic);if(/2 compartment/.test(n))box(.06,.56,.96,.88,.02,.025,m.dark);}
   else{box(.03,.92,.03,.94,.035,.93,m.plastic);box(.12,.955,.28,.76,.018,.58,m.clear);handle(.34,.975,.77,.32);}
  }
  function smallCook(){
   if(family==='rice-soup'){
    cy(.5,.07,.5,.35,.10,m.dark);bowl(.5,.10,.5,.43,.65,/soup/.test(n)?m.plastic:m.steel);cy(.5,.78,.5,.44,.045,m.steel2);cy(.5,.84,.5,.06,.07,m.dark);for(const x of [.035,.965])box(x-.03,.54,.35,.06,.10,.3,m.dark);controls(.25,.91,1);return;
   }
   if(family==='circulator'){
    box(.20,.60,.20,.60,.38,.60,m.plastic);cy(.5,.30,.5,.18,.6,m.steel);box(.28,.78,.81,.44,.10,.02,m.dark);tube([[.25,.6,.25],[.08,.55,.25],[.08,.38,.25]],.02);
    button(.38,.70,.82,m.green,.035);button(.62,.70,.82,m.dark,.035);ring(.5,.05,.5,.18,m.steel2);for(let i=0;i<6;i++)box(.38+i*.04,.07,.66,.012,.15,.008,m.dark);return;
   }
   if(family==='basket-lift'){
    box(.15,.05,.15,.7,.72,.55);box(.20,.77,.20,.60,.20,.40);tube([[.5,.86,.55],[.5,.87,.92],[.5,.64,.92]],.025);controls(.60,.72,1);return;
   }
   if(family==='water-bath'){
    box(.03,.05,.03,.94,.03,.90);box(.03,.05,.03,.035,.80,.90);box(.935,.05,.03,.035,.80,.90);box(.03,.05,.03,.94,.80,.035);box(.03,.05,.895,.94,.80,.035);box(.065,.46,.065,.87,.018,.83,m.water);controls(.35,.95,2);return;
   }
   if(family==='crepe'){shell(.78);cy(.5,.89,.5,.43,.12,m.iron);controls(.43,.95,1);return;}
   shell(.30);
   if(family==='bun-toaster'){box(.06,.40,.09,.88,.55,.73);box(.06,.30,.09,.07,.10,.73);box(.87,.30,.09,.07,.10,.73);box(.12,.94,.24,.76,.025,.14,m.dark);box(.12,.31,.16,.76,.085,.02,m.dark);tray(.1,.29,.60,.8,.34);controls(.20,.96,1);return;}
   box(.05,.34,.07,.90,.04,.82,m.iron);const top=box(.05,.68,.08,.90,.06,.82,m.steel2);top.rotation.x=-.32;
   for(let i=0;i<22;i++){box(.08+i*.038,.382,.10,.012,.012,.76,m.iron);if(/waffle/.test(n))box(.08,.382,.10+i*.032,.84,.012,.012,m.iron);}
   for(const x of [.09,.91])tube([[x,.38,.09],[x,.74,.09],[x,.84,.83]],.015);tube([[.09,.84,.83],[.91,.84,.83]],.022,m.dark);controls(.20,.95,2);
  }
  function prep(){
   if(family==='mincer'){
    box(.12,.03,.08,.76,.53,.60);cy(.5,.37,.72,.20,.38,m.polished,'z');ring(.5,.37,.92,.20,m.steel2,'z',.012);cy(.5,.37,.925,.17,.012,m.steel2,'z');for(let i=0;i<24;i++){const t=i*Math.PI/12;cy(.5+Math.cos(t)*.13,.37+Math.sin(t)*.13*w/h,.938,.012,.006,m.dark,'z');}cy(.5,.67,.39,.10,.35);tray(.08,.84,.08,.84,.65);button(.79,.22,.70,m.red);return;
   }
   if(family==='bone-saw'||family==='bread-slicer'){
    box(.04,.03,.06,.92,.18,.86);box(.04,.2,.06,.20,.76,.40);box(.04,.79,.06,.92,.17,.40);box(.04,.43,.06,.92,.025,.86,m.polished);
    if(family==='bone-saw'){box(.82,.21,.35,.006,.61,.012,m.steel2);box(.37,.46,.20,.025,.14,.55,m.steel2);handle(.42,.51,.75,.30);}
    else{for(let i=0;i<22;i++)box(.27+i*.03,.25,.35,.003,.54,.02,m.steel2);tray(.26,.44,.46,.69,.45);}button(.15,.69,.48,m.green);return;
   }
   if(family==='peeler'||family==='spinner'||family==='sieve'){
    if(floor)legs(.28,/mobile/.test(n));cy(.5,.22,.48,.36,.26,m.steel2);bowl(.5,.33,.48,.40,.50);cy(.5,.85,.48,.405,.025,m.clear);handle(.35,.9,.48,.3);controls(.25,.90,1);
    if(family!=='spinner'){box(.65,.48,.62,.29,.21,.22);box(.67,.50,.85,.25,.15,.035,m.dark);handle(.68,.65,.86,.22);}return;
   }
   if(family==='liquidiser'){
    legs(.12,true);box(.1,.12,.1,.8,.06,.7);box(.43,.16,.12,.14,.78,.14);tube([[.5,.82,.2],[.5,.72,.62],[.5,.27,.81]],.025);cy(.5,.65,.6,.13,.28,m.steel);cy(.5,.23,.81,.13,.09,m.steel2);return;
   }
   const grinder=family==='coffee-grinder',blender=family==='blender',veg=family==='veg-processor',frozen=family==='frozen-processor',cutter=family==='cutter'||family==='heated-processor';
   if(frozen){box(.10,.04,.12,.80,.90,.40,m.plastic);box(.10,.04,.12,.80,.08,.74,m.plastic);box(.10,.65,.12,.80,.29,.74,m.plastic);box(.18,.12,.53,.64,.53,.012,m.dark);cy(.5,.32,.69,.26,.38,m.polished);cy(.5,.54,.69,.18,.08,m.dark);tube([[.73,.47,.71],[.92,.46,.71],[.92,.23,.71],[.73,.22,.71]],.02,m.dark);box(.2,.76,.875,.6,.12,.012,m.dark);button(.77,.72,.90,m.green);return;}
   box(.12,.02,.10,.76,cutter?.36:.39,.70,m.paint);controls(.22,.82,2);
   if(grinder){
    cy(.5,.55,.43,.30,.42,m.plastic);bowl(.5,.74,.43,.37,.23,m.clear);cy(.5,.98,.43,.38,.025,m.dark);box(.38,.52,.72,.24,.12,.20,m.steel2);tube([[.35,.29,.72],[.35,.29,.93],[.65,.29,.93],[.65,.29,.72]],.012);tray(.23,.03,.61,.54,.33);return;
   }
   if(veg){
    cy(.43,.48,.40,.32,.16,m.steel);cy(.39,.68,.43,.21,.29,m.steel2);cy(.70,.70,.26,.075,.32,m.dark);box(.64,.43,.36,.31,.10,.42,m.steel);box(.81,.45,.77,.15,.06,.02,m.dark);tube([[.20,.57,.45],[.16,.93,.45],[.45,.96,.45],[.45,.84,.45]],.02,m.dark);return;
   }
   if(blender){
    bowl(.46,.43,.42,.29,.43,m.clear);cy(.46,.87,.42,.31,.035,m.dark);cy(.46,.92,.42,.09,.07,m.clear);tube([[.73,.82,.42],[.93,.77,.42],[.92,.53,.42],[.73,.50,.42]],.022,m.clear);cy(.46,.45,.42,.10,.03,m.steel2);return;
   }
   if(cutter){
    bowl(.5,.39,.43,.36,.41);cy(.5,.81,.43,.37,.025,m.clear);ring(.5,.825,.43,.36,m.steel2);cy(.5,.85,.43,.08,.06,m.clear);tube([[.50,.73,.78],[.50,.72,.94],[.50,.46,.94],[.50,.47,.78]],.025,m.dark);cy(.5,.60,.43,.035,.34,m.steel2);box(.27,.45,.40,.46,.012,.06,m.steel2);return;
   }
   // Centrifugal juicer: vertical body, feed tube, side spout and pulp bin.
   cy(.43,.61,.43,.29,.46,m.steel);cy(.43,.86,.43,.30,.05,m.clear);cy(.43,.94,.43,.09,.14,m.dark);box(.74,.06,.15,.22,.61,.55,m.plastic);tube([[.43,.48,.71],[.43,.43,.92]],.027);tray(.19,.06,.67,.48,.30);
  }
  function beverage(){
   if(family==='water-boiler'){
    box(.05,.04,.04,.90,.81,.66);box(.04,.85,.03,.92,.08,.68,m.dark);box(.08,.93,.06,.84,.025,.62,m.steel2);
    box(.35,.73,.705,.30,.11,.018,m.dark);button(.42,.78,.73,m.green,.02);button(.60,.78,.73,m.orange,.02);
    tube([[.5,.52,.70],[.5,.52,.87],[.5,.43,.87]],.026,m.dark);box(.44,.55,.77,.12,.04,.12,m.dark);
    tray(.10,.06,.71,.80,.25);grid(.13,.09,.73,.74,.20);return;
   }
   if(family==='water-urn'){
    cy(.5,.07,.43,.38,.10,m.plastic);cy(.5,.49,.43,.37,.74,m.steel);cy(.5,.88,.43,.39,.045,m.dark);cy(.5,.93,.43,.055,.075,m.dark);
    for(const x of [.08,.92])box(x-.035,.65,.30,.07,.12,.24,m.dark);
    tube([[.5,.30,.70],[.5,.30,.92],[.5,.23,.92]],.024,m.dark);box(.44,.32,.86,.12,.04,.08,m.dark);box(.34,.12,.735,.32,.13,.018,m.dark);button(.41,.18,.76,m.green,.018);button(.59,.18,.76,m.orange,.018);return;
   }
   if(family==='drink-mixer'){
    box(.03,.02,.04,.94,.07,.88,m.plastic);const count=/triple/.test(n)?3:1;
    for(let i=0;i<count;i++){const x=(i+.5)/count;box(x-.06,.09,.12,.12,.70,.18);cy(x,.83,.31,.12,.20,m.steel2);cy(x,.49,.50,.012,.52,m.steel2);bowl(x,.10,.50,Math.min(.14,.4/count),.35);};return;
   }
   if(family==='slush'){
    box(.03,.03,.06,.94,.24,.80,m.plastic);const count=+(n.match(/(\d)\s*x\s*10/)||[])[1]||2;
    for(let i=0;i<count;i++){const x=(i+.5)/count,ww=.84/count;box(x-ww/2,.30,.13,ww,.53,.64,m.clear);box(x-ww/2-.01,.84,.12,ww+.02,.045,.66,m.dark);cy(x,.52,.44,.025,.44,m.steel2,'z');for(let j=0;j<5;j++)ring(x,.52,.26+j*.09,.13/count,m.white,'z',.008);tube([[x,.34,.77],[x,.25,.88]],.02,m.dark);cy(x,.33,.84,.022,.11,m.dark);tray(x-.35/count,.07,.76,.70/count,.17);}return;
   }
   if(family==='citrus-juicer'){
    shell(.89);box(.10,.35,.956,.80,.47,.01,m.clear);for(const x of [.32,.68])cy(x,.61,.97,.12,.04,m.orange,'z');cy(.5,.35,.97,.04,.07,m.steel2,'z');tray(.17,.12,.79,.66,.18);bowl(.5,.90,.46,.30,.09,m.steel2);return;
   }
   if(family==='soft-serve'){
    shell();vents(.06,.16,.956,.88,.18,9);box(.16,.52,.958,.68,.22,.018,m.plastic);for(const x of /single/.test(n)?[.5]:[.35,.65]){tube([[x,.67,.99],[x,.83,.99]],.015,m.dark);cy(x,.49,.97,.035,.12,m.white);}tray(.15,.36,.80,.7,.17);return;
   }
   if(family==='batch-brewer'||family==='automatic-coffee'){
    box(.06,.04,.08,.88,.10,.84);box(.06,.14,.08,.88,.80,.38,m.plastic);box(.06,.74,.08,.88,.20,.72);box(.17,.80,.81,.45,.10,.012,m.dark);
    if(family==='batch-brewer'){cy(.50,.38,.65,.25,.39,m.steel);cy(.5,.61,.65,.22,.05,m.dark);tube([[.71,.46,.65],[.86,.43,.65],[.86,.27,.65],[.71,.24,.65]],.02,m.dark);}
    else{box(.36,.55,.54,.28,.16,.20,m.steel2);for(const x of [.44,.56])cy(x,.53,.74,.015,.08,m.steel2);tray(.18,.16,.48,.64,.40);}return;
   }
   // Espresso machine: open working bay, separate groups, wands and drip grille.
   legs(.10);box(.02,.10,.03,.96,.12,.91);box(.02,.55,.03,.96,.40,.69);box(.02,.22,.03,.96,.33,.32,m.dark);grid(.06,.235,.37,.88,.53,m.steel2,28);
   const groups=+(n.match(/(\d)[ -]group/)||[])[1]||2;
   for(let i=0;i<groups;i++){const x=.12+.76*(i+.5)/groups;cy(x,.54,.65,.055,.13,m.polished);tube([[x,.48,.68],[x,.45,.92]],.018,m.dark);for(let j=0;j<3;j++)button(x-.045+j*.045,.73,.74,m.dark,.008);}
   for(const x of [.06,.94]){tube([[x,.58,.62],[x,.46,.72],[x,.30,.82]],.009);button(x,.70,.74,m.dark,.028);}tube([[.04,.97,.1],[.04,.97,.67],[.96,.97,.67],[.96,.97,.1]],.008);
  }
  function vacuum(){
   shell(.51);box(.07,.54,.07,.86,.025,.80,m.dark);box(.09,.55,.09,.82,.02,.76,m.polished);box(.08,.56,.10,.84,.26,.015,m.clear);box(.08,.56,.85,.84,.26,.015,m.clear);box(.08,.56,.10,.015,.26,.75,m.clear);box(.905,.56,.10,.015,.26,.75,m.clear);box(.08,.82,.10,.84,.018,.75,m.clear);handle(.23,.75,.87,.54);box(.16,.58,.73,.68,.015,.035,m.cream);controls(.33,.96,2);
  }
  function holding(){
   if(family==='hot-cabinet'){
    shell();const drawers=/drawer/.test(n),levels=drawers?(+(n.match(/(\d+)[ -]drawer/)||[])[1]||2):/double|2 compartment/.test(n)?2:1;
    for(let i=0;i<levels;i++)door(.06,fy+.03+i*.73/levels,.88,.69/levels);controls(.89,.96,1);return;
   }
   if(family==='heated-shelf'){
    const strip=/strip heater/.test(n);if(!strip)legs(.22);box(.02,strip?.04:.22,.02,.96,strip?.82:.65,.92);for(let i=0;i<4;i++)box(.04,strip?.025:.89,.12+i*.18,.92,.018,.06,strip?m.lamp:m.steel2);button(.92,.50,.96,m.dark,.02);return;
   }
   if(family==='holding-station'){
    box(.03,.04,.05,.94,.08,.90);tray(.08,.12,.12,.84,.77);
    if(/carving/.test(n)){box(.10,.15,.16,.80,.035,.69,m.cream);tube([[.5,.12,.12],[.5,.92,.12],[.5,.95,.48]],.014);cy(.5,.87,.48,.14,.14,m.steel2,'y',.06);cy(.5,.80,.48,.12,.014,m.lamp);}
    else{for(const x of [.04,.92])box(x,.12,.06,.04,.72,.82);box(.04,.84,.06,.92,.10,.82);box(.10,.83,.12,.80,.01,.67,m.lamp);grid(.10,.17,.15,.80,.65);}
    return;
   }
   box(.03,.03,.04,.94,.10,.88);box(.03,.89,.04,.94,.08,.88);
   if(family==='heated-display'){
    for(const x of [.04,.94])for(const z of [.06,.90])box(x-.015,.13,z-.015,.03,.76,.03,m.steel2);
    for(const x of [.055,.935])box(x,.13,.07,.008,.75,.82,m.clear);box(.06,.13,.91,.88,.75,.008,m.clear);box(.06,.13,.06,.88,.75,.008,m.clear);
    for(const y of [.16,.40,.64])tray(.09,y,.10,.82,.77);handle(.82,.49,.93,.025);
   }else{
    for(const x of [.04,.48,.92])box(x,.13,.06,.04,.76,.84);box(.04,.50,.06,.92,.035,.84);
    for(const y of [.15,.54])for(const x of [.10,.54]){tray(x,y,.10,.36,.75);if(/locker/.test(n)){box(x,y,.91,.35,.31,.012,m.clear);handle(x+.10,y+.26,.93,.15);}}
   }
  }
  function specialty(){
   if(family==='oil-filter'){
    tray(.03,.02,.03,.94,.91);box(.13,.09,.09,.74,.47,.78,m.steel2);box(.20,.56,.17,.60,.35,.48);vents(.25,.65,.66,.50,.15,6);handle(.28,.94,.36,.44);button(.69,.82,.67,m.green);return;
   }
   if(family==='spit-grill'){
    tray(.02,.03,.02,.96,.93);box(.08,.10,.04,.84,.85,.20);const count=+(n.match(/(\d+) burners/)||[])[1]||3;
    for(let i=0;i<count;i++){box(.17,.20+i*.65/count,.25,.66,.54/count,.025,m.cream);button(.91,.24+i*.65/count,.26);}
    cy(.50,.53,.64,.009,.86,m.steel2);cy(.5,.16,.64,.19,.025,m.polished);box(.36,.92,.12,.28,.06,.53);cy(.5,.96,.63,.055,.06,m.dark);return;
   }
   if(family==='tandoor'){
    legs(.12,/caster|castor/.test(n));for(const x of [.03,.94])box(x,.12,.03,.03,.82,.90);for(const z of [.03,.90])box(.03,.12,z,.94,.82,.03);
    bowl(.5,.16,.48,.43,.76,m.cream);ring(.5,.93,.48,.44,m.steel2,'y',.025);box(.31,.15,.935,.38,.15,.018,m.dark);handle(.38,.25,.96,.24);return;
   }
   if(family==='charcoal-oven'){
    const base=/on stand/.test(n)?.32:fy;legs(base);box(.03,base,.03,.94,.65-base,.86);door(.10,base+.05,.80,.52-base,.90);vents(.17,base+.05,.953,.66,.08,5);
    cy(.5,.79,.33,.095,.30,m.dark);cy(.5,.95,.33,.16,.04,m.dark);box(.03,.65,.03,.94,.035,.88);return;
   }
   // Low stockpot and wok ranges have one row of large burners, not a full range.
   legs(.20);box(.03,.20,.03,.94,.56,.89);const count=+(n.match(/(\d+)-chamber/)||[])[1]||1;
   for(let i=0;i<count;i++){const x=(i+.5)/count,rr=Math.min(w/count,d)*.34/Math.min(w,d);ring(x,.79,.50,rr,m.iron,'y',.024);cy(x,.76,.50,rr*.55,.045,m.iron);for(const z of [.22,.78])box(x-.35/count,.83,z,.70/count,.025,.035,m.iron);button(x,.54,.94);}
   box(.03,.76,.03,.94,.20,.025);return;
  }
  function slicer(){
   box(.04,.03,.06,.92,.22,.87,m.paint);const blade=cy(.62,.61,.38,.31,.025,m.polished,'x');ring(.64,.61,.38,.30,m.steel2,'x');cy(.65,.61,.38,.25,.02,m.steel2,'x');box(.1,.26,.08,.25,.04,.78,m.steel2);const carriage=box(.16,.32,.20,.24,.25,.57,m.polished);carriage.rotation.z=-.2;tube([[.12,.40,.76],[.12,.56,.83],[.28,.56,.83]],.025,m.dark);box(.52,.86,.28,.24,.10,.20,m.dark);button(.3,.16,.95,m.dark,.055);
  }
  const groups={cooking:['griddle','chargrill','hob','solid-top','combination-range'],table:['work-table','oven-stand','open-base','storage-cabinet','neutral-top','sink-top'],refrigerated:['coldroom','refrigerated-counter','prep-counter','display-fridge'],ice:['ice-machine','ice-head','ice-bin','ice-dispenser'],washer:['front-washer','hood-washer','conveyor-washer'],oven:['speed-oven','deck-oven','conveyor-oven','conveyor-toaster','salamander'],pan:['bratt-pan','kettle'],trolley:['tray-trolley','plate-cart','utility-cart','dolly'],bin:['ingredient-bin','waste-bin','insulated-carrier'],smallCook:['rice-soup','water-bath','circulator','basket-lift','crepe','contact-grill','bun-toaster'],prep:['mincer','bone-saw','bread-slicer','peeler','spinner','sieve','liquidiser','cutter','heated-processor','frozen-processor','veg-processor','blender','coffee-grinder','juicer'],beverage:['espresso','automatic-coffee','batch-brewer','soft-serve','slush','drink-mixer','citrus-juicer'],vacuum:['vacuum'],slicer:['slicer']};
  groups.beverage.push('water-urn','water-boiler');groups.oven.push('multi-oven');groups.refrigerated.push('chest-freezer');groups.table.push('dunnage-rack','bar-station');groups.holding=['holding-station','holding-cubbies','heated-display','hot-cabinet','heated-shelf'];groups.specialty=['oil-filter','spit-grill','tandoor','charcoal-oven','stockpot-range'];
  const builders={cooking,table,refrigerated,ice,washer,oven,pan,trolley,bin,smallCook,prep,beverage,vacuum,slicer,holding,specialty},key=Object.keys(groups).find(k=>groups[k].includes(family));
  if(!key)throw new Error('Missing equipment family builder: '+family);builders[key]();
  g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g),s=b.getSize(new THREE.Vector3()),k=Math.min(w/s.x,h/s.y,d/s.z,1),offset=new THREE.Vector3(b.min.x,b.min.y,b.min.z);
  for(const o of g.children){o.position.sub(offset).multiplyScalar(k);o.scale.multiplyScalar(k);o.position.x+=(w-s.x*k)/2;o.position.z+=(d-s.z*k)/2;}
  return g;
 }
 return {identify,build};
})();
