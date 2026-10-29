/* Dimension-driven visual models. Units: mm. Not manufacturer CAD. */
const KS3DDetails=(()=>{
 function build(it,sym,a){
  const {B,Cy,M,feet,handleH,handleV,knobRow}=a,{w,d,h}=it,g=new THREE.Group(),fh=it.mount==='floor'&&h>500?110:0;
  const mesh=(geo,m,x=0,y=0,z=0)=>{geo.userData.ownedByScene=true;const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=!m.transparent;o.receiveShadow=true;g.add(o);return o;};
  const pipe=(pts,r=5,m=M.steel2)=>mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),20,r,8,false),m);
  const badge=(x,y,z,text,ww=120)=>mesh(new THREE.PlaneGeometry(ww,ww/5),KS3DAssets.label(text),x,y,z);
  const vents=(x,y,z,ww,hh)=>{B(g,x,y,z,ww,hh,3,M.dark);for(let yy=y+6;yy<y+hh-4;yy+=14)B(g,x+5,yy,z+4,ww-10,4,3,M.steel2);};
  const door=(x,y,z,ww,hh)=>{B(g,x,y,z,ww,hh,4,M.rubber,true);B(g,x+5,y+5,z+6,ww-10,hh-10,22,M.steel,true);};
  const cabinet=(top=h)=>{if(fh)feet(g,w,d,fh);B(g,0,fh,0,w,top-fh,d-26,M.steel,true);};
  switch(sym){
   case 'oven':{
    const left=/rational/i.test(it.brand||''),cw=Math.max(110,w*.19),dw=w-cw-22,dx=left?cw+10:12,cx=left?12:w-cw,b=fh+20,dh=h-42-fh;
    if(fh)feet(g,w,d,fh);
    B(g,0,fh,0,w,h-fh,28,M.steel,true);B(g,0,fh,0,20,h-fh,d,M.steel,true);B(g,w-20,fh,0,20,h-fh,d,M.steel,true);
    B(g,0,h-24,0,w,24,d,M.steel,true);B(g,0,fh,0,w,24,d,M.steel,true);
    B(g,dx+25,b+25,55,dw-50,dh-50,8,M.dark);
    for(let y=b+50;y<b+dh-45;y+=70){B(g,dx+35,y,70,dw-70,6,d-130,M.steel2,true);}
    B(g,dx,b,d-22,30,dh,28,M.steel,true);B(g,dx+dw-30,b,d-22,30,dh,28,M.steel,true);
    B(g,dx+30,b,d-22,dw-60,30,28,M.steel,true);B(g,dx+30,b+dh-30,d-22,dw-60,30,28,M.steel,true);
    B(g,dx+32,b+32,d+2,dw-64,dh-64,3,M.ovenGlass);handleV(g,left?dx+12:dx+dw-40,b+dh*.3,d+10,dh*.4);
    for(const y of [b+35,b+dh-70])B(g,left?dx+dw-15:dx-4,y,d+6,20,32,20,M.steel2,true);
    B(g,cx,fh+15,d-18,cw-16,h-fh-30,22,M.dark,true);
    mesh(new THREE.PlaneGeometry(cw-46,Math.min(220,dh*.4)),KS3DAssets.display(),cx+(cw-16)/2,h-dh*.34,d+6);
    Cy(g,cx+(cw-16)/2,b+dh*.25,d+14,23,14,M.steel2,'z');Cy(g,cx+(cw-16)/2,b+dh*.25,d+22,17,3,M.dark,'z');badge(dx+dw*.55,h-16,d+7,it.brand||'COMBI');break;
   }
   case 'fridge':{
    cabinet();const n=w>1000?2:1,dw=w/n,gr=Math.min(230,h*.13);B(g,0,h-gr,0,w,gr,d,M.steel,true);vents(25,h-gr+20,d+2,w-50,gr-70);
    for(let i=0;i<n;i++){const hh=h-fh-gr-15;door(i*dw+8,fh+6,d-16,dw-16,hh);handleV(g,n===2?(i?dw+36:dw-60):36,fh+hh*.35,d+13,hh*.3);for(const y of [fh+70,fh+hh-100])B(g,i?w-20:10,y,d+10,14,35,20,M.steel2,true);}
    B(g,w-130,h-44,d+2,95,26,4,M.dark,true);badge(w-82,h-31,d+7,'4 °C',60);badge(w*.23,h-32,d+5,it.brand||'REFRIGERATION',Math.min(150,w*.3));break;
   }
   case 'range':{
    cabinet();B(g,0,h-40,0,w,40,d,M.steel,true);B(g,10,h+1,70,w-20,4,d-160,M.iron);B(g,0,h,0,w,65,40,M.steel,true);
    const count=Math.max(1,Math.round(w/400)),cw=w/count,cd=(d-180)/2;
    for(let i=0;i<count;i++)for(let j=0;j<2;j++){const x=cw*(i+.5),z=90+cd*(j+.5),r=Math.min(cw,cd)*.34;Cy(g,x,h+5,z,r*.45,13,M.iron);const ring=mesh(new THREE.TorusGeometry(r*.46,4,8,28),M.steel2,x,h+18,z);ring.rotation.x=Math.PI/2;for(let k=0;k<4;k++){const t=k*Math.PI/2;pipe([[x+Math.sin(t)*r*.45,h+30,z+Math.cos(t)*r*.45],[x+Math.sin(t)*r,h+30,z+Math.cos(t)*r]],6,M.iron);}const grate=mesh(new THREE.TorusGeometry(r,6,6,4),M.iron,x,h+28,z);grate.rotation.x=Math.PI/2;grate.rotation.z=Math.PI/4;}
    B(g,8,h-106,d-4,w-16,62,10,M.steel2,true);knobRow(g,count*2,w,h-76,d+8);
    for(let i=0;i<count*2;i++)B(g,w*(i+.5)/(count*2)-2,h-67,d+34,4,10,3,M.white);
    if(it.mount!=='top'){door(18,fh+18,d-12,w-36,h-fh-154);handleH(g,w*.18,h-168,d+18,w*.64);vents(w*.15,fh+40,d+18,w*.7,38);}break;
   }
   case 'fryer':case 'pasta':{
    const n=Math.max(1,Math.round(w/400)),cw=w/n;cabinet(h-175);
    B(g,0,h-175,0,25,175,d,M.steel,true);B(g,w-25,h-175,0,25,175,d,M.steel,true);B(g,0,h-175,0,w,175,110,M.steel,true);B(g,0,h-65,d-70,w,65,70,M.steel,true);
    B(g,0,h,0,w,135,85,M.steel,true);vents(22,h+23,86,w-44,90);
    for(let i=0;i<n;i++){const x=i*cw+32,bw=cw-64,z=125,bd=Math.max(140,d-220),by=h-55;
     B(g,x,h-155,z,bw,5,bd,sym==='pasta'?M.water:M.oil);B(g,x,h-155,z,4,155,bd,M.steel2);B(g,x+bw-4,h-155,z,4,155,bd,M.steel2);
     for(let xx=x+10;xx<=x+bw-10;xx+=24)pipe([[xx,by+80,z+10],[xx,by,z+10],[xx,by,z+bd-10],[xx,by+80,z+bd-10]],1.7);
     for(let zz=z+10;zz<=z+bd-10;zz+=24)pipe([[x+10,by+80,zz],[x+10,by,zz],[x+bw-10,by,zz],[x+bw-10,by+80,zz]],1.7);
     for(let yy=by+22;yy<=by+80;yy+=24)pipe([[x+10,yy,z+10],[x+bw-10,yy,z+10],[x+bw-10,yy,z+bd-10],[x+10,yy,z+bd-10],[x+10,yy,z+10]],1.7);
     pipe([[x+bw/2,h+25,z+bd-10],[x+bw/2,h+110,d+25],[x+bw/2,h+110,d+130]],7,M.dark);door(i*cw+10,fh+15,d-16,cw-20,h-fh-130);handleH(g,i*cw+cw*.3,h-155,d+16,cw*.4);
    }knobRow(g,n,w,h-65,d+7);break;
   }
   case 'ss:hood':{
    B(g,0,h-30,0,w,30,d*.68,M.steel,true);B(g,0,0,0,w,h,22,M.steel,true);const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(d,0);sh.lineTo(d*.68,h);sh.lineTo(0,h);sh.closePath();
    for(const x of [22,w]){const o=mesh(new THREE.ExtrudeGeometry(sh,{depth:22,bevelEnabled:false}),M.steel,x,0,0);o.rotation.y=-Math.PI/2;}
    const front=B(g,22,0,d-25,w-44,Math.hypot(h,d*.32),22,M.steel,true);front.rotation.x=-Math.atan2(d*.32,h);front.position.y=h/2;front.position.z=d*.84;
    for(let x=45;x<w-45;x+=55){const slat=B(g,x,60,d*.16,16,10,d*.64,M.steel2,true);slat.rotation.x=-.22;}
    B(g,22,-3,d-40,w-44,28,40,M.steel2,true);B(g,w*.4,h,d*.13,w*.2,400,d*.27,M.steel,true);
    if((it.opts||[]).includes('Lights'))for(let x=w*.23;x<w;x+=w*.54)B(g,x-130,12,d*.76,260,12,60,M.lamp,true);break;
   }
   case 'ss:rack':{
    for(const [x,z] of [[24,24],[w-24,24],[24,d-24],[w-24,d-24]]){Cy(g,x,12,z,21,h-12,M.steel2);Cy(g,x,0,z,25,22,M.rubber);}
    for(const y of [0,1,2,3].map(i=>Math.min(180,h*.15)+(h-Math.min(180,h*.15)-25)*i/3)){B(g,0,y,0,w,25,16,M.steel2,true);B(g,0,y,d-16,w,25,16,M.steel2,true);for(let x=18;x<w-15;x+=30)B(g,x,y+12,16,5,5,d-32,M.steel2);for(let z=55;z<d;z+=120)B(g,15,y,z,w-30,5,5,M.steel2);}break;
   }
   default:return null;
  }
  return g;
 }
 return {build};
})();
