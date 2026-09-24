// Injected before the app loads (page.addInitScript). An in-memory Supabase stand-in persisted in localStorage so two tabs share it.
(function(){
  const K="ks.mock";const load=()=>{try{return JSON.parse(localStorage.getItem(K)||"null")||{user:null,projects:[],equipment:[],waitlist:[]};}catch(_){return {user:null,projects:[],equipment:[],waitlist:[]};}};
  const save=s=>localStorage.setItem(K,JSON.stringify(s));
  let S=load();const listeners=new Set();const uid=()=>Math.random().toString(36).slice(2,10);
  const emit=()=>listeners.forEach(f=>f(S.user));
  window.KS_backend={
    ready:Promise.resolve(),user:()=>S.user,onAuth:f=>{listeners.add(f);return()=>listeners.delete(f);},
    signInEmail:async email=>{setTimeout(()=>{S=load();S.user={id:"u1",email};save(S);emit();},300);},
    signInGoogle:async()=>{S.user={id:"u1",email:"g@example.com"};save(S);emit();},
    signOut:async()=>{S.user=null;save(S);emit();},
    listProjects:async()=>{S=load();return S.projects.map(p=>({id:p.id,name:p.name,summary:p.summary,updated_at:p.updated_at,is_public:p.is_public,public_id:p.public_id})).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));},
    loadProject:async id=>{S=load();return S.projects.find(p=>p.id===id)||null;},
    createProject:async(name,data)=>{S=load();const p={id:uid(),name,data,summary:`${(data.room.w/1000).toFixed(1)} × ${(data.room.d/1000).toFixed(1)} m · ${data.items.length} items`,is_public:false,public_id:uid()+uid(),updated_at:new Date().toISOString()};S.projects.push(p);save(S);return {id:p.id,public_id:p.public_id,stripped:false};},
    saveProject:async(id,data,name)=>{S=load();const p=S.projects.find(p=>p.id===id);if(!p)throw new Error("missing");p.data=data;if(name)p.name=name;p.updated_at=new Date().toISOString();save(S);return {stripped:false};},
    renameProject:async(id,name)=>{S=load();const p=S.projects.find(p=>p.id===id);p.name=name;save(S);},
    deleteProject:async id=>{S=load();S.projects=S.projects.filter(p=>p.id!==id);save(S);},
    setPublic:async(id,on)=>{S=load();const p=S.projects.find(p=>p.id===id);p.is_public=on;save(S);return p.public_id;},
    shareUrl:pid=>location.origin+"/k/"+pid,
    loadShared:async pid=>{S=load();const p=S.projects.find(p=>p.public_id===pid&&p.is_public);return p?{name:p.name,data:p.data,updated_at:p.updated_at}:null;},
    listEquipment:async()=>{S=load();return S.equipment;},saveEquipment:async e=>{S=load();S.equipment=S.equipment.filter(x=>x.cid!==e.cid).concat([e]);save(S);},deleteEquipment:async cid=>{S=load();S.equipment=S.equipment.filter(x=>x.cid!==cid);save(S);},
    ai:async prompt=>{if(!S.user){const e=new Error("no");e.code="not_granted";throw e;}return {found:false,note:"mock"};},
    waitlist:async email=>{S=load();S.waitlist.push(email);save(S);}
  };
})();
