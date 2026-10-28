/* Shared 3D assets. Textures/models are requested only when the 3D view opens. */
const KS3DAssets=(()=>{
  let renderer,redraw,chefModel,chefTask,floorTask,chefState='idle';
  const floorMaps={},shared=new Set(),labels=new Map();
  const linear=c=>new THREE.Color(c).convertSRGBToLinear();
  function configure(r){r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=.95;r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;}
  function environment(r){
    const s=new THREE.Scene(),resources=[];s.background=new THREE.Color(0x202631);
    const panel=(x,y,z,w,h,rx,ry,color,intensity)=>{const geo=new THREE.PlaneGeometry(w,h),m=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});m.color.multiplyScalar(intensity);const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.rotation.set(rx,ry,0);s.add(o);resources.push(geo,m);};
    panel(0,5,0,14,10,Math.PI/2,0,0xc3ceda,.45);panel(0,-3,0,16,12,Math.PI/2,0,0x555148,.3);
    panel(-6,1,0,12,6,0,Math.PI/2,0xd9e6ff,.7);panel(6,1,0,12,6,0,Math.PI/2,0xffe4ca,.4);
    panel(0,1,-6,12,6,0,0,0x515a64,.4);panel(0,1,6,12,6,0,0,0xd4dcdd,.6);
    for(const z of [-3,0,3])panel(0,4.9,z,8,.7,Math.PI/2,0,0xffffff,3);
    panel(-5.9,1.5,0,4,3,0,Math.PI/2,0xd9eaff,2);
    const pmrem=new THREE.PMREMGenerator(r),target=pmrem.fromScene(s,.04,.1,40);pmrem.dispose();resources.forEach(o=>o.dispose());return target;
  }
  function init(r,onReady){
    renderer=r;redraw=onReady;
    floorTask=Promise.all(Object.entries(window.KS_3D_URLS.floor).map(([key,url])=>new Promise(resolve=>{
      const c=document.createElement('canvas');c.width=c.height=2;const x=c.getContext('2d');x.fillStyle=key==='normal'?'#8080ff':key==='rough'?'#dddddd':'#a8a79e';x.fillRect(0,0,2,2);
      const t=new THREE.TextureLoader().load(url,()=>{redraw();resolve();},undefined,()=>{t.image=c;t.needsUpdate=true;resolve();});
      t.image=c;t.encoding=key==='diffuse'?THREE.sRGBEncoding:THREE.LinearEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,r.capabilities.getMaxAnisotropy());t.needsUpdate=true;shared.add(t);floorMaps[key]=t;
    })));
  }
  function floor(w,d,polygon=false){
    for(const t of Object.values(floorMaps))t.repeat.set((polygon?1:w)/1.9,(polygon?1:d)/1.9);
    return new THREE.MeshStandardMaterial({map:floorMaps.diffuse,normalMap:floorMaps.normal,normalScale:new THREE.Vector2(.35,.35),roughnessMap:floorMaps.rough,roughness:.9,metalness:0,color:linear(0xd3d7da),side:polygon?THREE.DoubleSide:THREE.FrontSide});
  }
  function loadChef(){
    if(chefTask)return chefTask;chefState='loading';
    chefTask=new Promise(resolve=>{
      const loader=new THREE.GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(window.KS_3D_URLS.chef,gltf=>{chefModel=gltf.scene;chefModel.updateMatrixWorld(true);chefModel.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;const mm=Array.isArray(o.material)?o.material:[o.material];mm.forEach(m=>{if(m.map)m.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());});}});chefState='ready';resolve(chefModel);},undefined,()=>{chefState='unavailable';resolve(null);});
    });return chefTask;
  }
  function chef(it){
    const g=new THREE.Group();g.userData.asset='chef';
    const geo=new THREE.CylinderGeometry(65,95,it.h*.75,24),m=new THREE.MeshStandardMaterial({color:0x8b9399,transparent:true,opacity:.22});geo.userData.ownedByScene=true;
    const placeholder=new THREE.Mesh(geo,m);placeholder.userData.selectionMaterial=true;placeholder.position.set(it.w/2,it.h*.375,it.d/2);g.add(placeholder);
    const attach=model=>{if(!model)return;const o=model.clone(true),box=new THREE.Box3().setFromObject(o),sz=box.getSize(new THREE.Vector3()),k=Math.min(it.h/sz.y,it.w/sz.x,it.d/sz.z);o.scale.multiplyScalar(k);o.position.set(it.w/2-(box.min.x+sz.x/2)*k,-box.min.y*k,it.d/2-(box.min.z+sz.z/2)*k);g.remove(placeholder);geo.dispose();m.dispose();g.add(o);redraw();};
    if(chefModel)attach(chefModel);else loadChef().then(attach);return g;
  }
  function label(text){
    if(labels.has(text))return labels.get(text);const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.fillStyle='#e6eeee';x.font='600 42px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(String(text).slice(0,26),256,48,495);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
    const m=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,toneMapped:false});labels.set(text,m);return m;
  }
  function display(){
    if(labels.has('display'))return labels.get('display');const c=document.createElement('canvas');c.width=256;c.height=384;const x=c.getContext('2d');x.fillStyle='#101a22';x.fillRect(0,0,256,384);x.fillStyle='#dcece6';x.font='28px Arial';x.fillText('180 °C',28,64);x.fillStyle='#8caba6';x.font='19px Arial';x.fillText('COMBI',28,108);
    for(let j=0;j<3;j++)for(let i=0;i<2;i++){x.fillStyle=['#447f96','#85764f','#6d9180'][j];x.fillRect(24+i*116,142+j*66,92,48);}x.fillStyle='#e5e7df';x.font='22px Arial';x.fillText('00:24',28,365);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const m=new THREE.MeshBasicMaterial({map:t,toneMapped:false});labels.set('display',m);return m;
  }
  function compact(g){
    const batches=new Map(),old=[],disposed=new Set();g.updateMatrixWorld(true);
    g.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geo);old.push(o);});
    old.forEach(o=>{o.parent.remove(o);if(o.geometry.userData.ownedByScene&&!disposed.has(o.geometry)){o.geometry.dispose();disposed.add(o.geometry);}});
    for(const [m,list] of batches){const geo=THREE.BufferGeometryUtils.mergeBufferGeometries(list,false);list.forEach(x=>x.dispose());if(!geo)throw new Error('Incompatible equipment geometry');geo.userData.ownedByScene=true;const o=new THREE.Mesh(geo,m);o.castShadow=o.receiveShadow=true;g.add(o);}return g;
  }
  return {configure,environment,init,floor,chef,compact,label,display,linear,isShared:t=>shared.has(t),ready:()=>Promise.all([floorTask,chefTask]),get chefState(){return chefState;}};
})();
