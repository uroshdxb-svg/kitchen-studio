/* Kitchen Studio cloud layer: accounts, saved kitchens, share links, custom models and the AI proxy, on Supabase.
   Exposes window.KS_backend (or null when the page has no Supabase config, in which case the app runs local-only). */
(function(){
  const cfg=window.KS_CONFIG||{};
  if(window.KS_backend)return;/* a backend was injected already (tests, mocks) */
  if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase){window.KS_backend=null;return;}
  const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const siteUrl=(cfg.siteUrl||location.origin).replace(/\/$/,"");
  let user=null;const listeners=new Set();
  const ready=sb.auth.getSession().then(({data})=>{user=data&&data.session?data.session.user:null;return user;}).catch(()=>null);
  sb.auth.onAuthStateChange((_e,s)=>{const u=s?s.user:null;const was=user&&user.id;user=u;if((u&&u.id)!==was)listeners.forEach(f=>{try{f(user);}catch(_){}});});
  const need=()=>{if(!user){const e=new Error("Sign in first");e.code="not_granted";throw e;}};
  const fail=err=>{const e=new Error(err&&err.message||"Request failed");e.code=err&&err.code;throw e;};
  const MAX=1500000;
  function strip(p){let s=JSON.stringify(p);if(s.length<=MAX)return {data:p,stripped:false};const q=JSON.parse(s);if(q.under)q.under.src=null;return {data:q,stripped:true};}
  const summary=p=>{try{const R=p.room,n=(p.items||[]).filter(i=>i.kind!=="arch").length;return `${(R.w/1000).toFixed(1)} × ${(R.d/1000).toFixed(1)} m · ${n} item${n===1?"":"s"}`;}catch(_){return "";}};
  const providers=fetch(cfg.supabaseUrl+"/auth/v1/settings",{headers:{apikey:cfg.supabaseAnonKey}}).then(r=>r.json()).then(j=>Object.keys(j.external||{}).filter(k=>j.external[k])).catch(()=>["email"]);
  window.KS_backend={
    ready,user:()=>user,providers:()=>providers,onAuth:f=>{listeners.add(f);return()=>listeners.delete(f);},
    signInEmail:async email=>{const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:siteUrl+"/app/"}});if(error)fail(error);},
    signInGoogle:async()=>{const {error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:siteUrl+"/app/"}});if(error)fail(error);},
    signOut:()=>sb.auth.signOut(),
    listProjects:async()=>{need();const {data,error}=await sb.from("projects").select("id,name,summary,updated_at,is_public,public_id").order("updated_at",{ascending:false});if(error)fail(error);return data||[];},
    loadProject:async id=>{need();const {data,error}=await sb.from("projects").select("id,name,data,updated_at,is_public,public_id").eq("id",id).maybeSingle();if(error)fail(error);return data;},
    createProject:async(name,payload)=>{need();const s=strip(payload);const {data,error}=await sb.from("projects").insert({owner:user.id,name:name||"Untitled kitchen",data:s.data,summary:summary(payload)}).select("id,public_id").single();if(error)fail(error);return Object.assign({stripped:s.stripped},data);},
    saveProject:async(id,payload,name)=>{need();const s=strip(payload);const row={data:s.data,summary:summary(payload),updated_at:new Date().toISOString()};if(name)row.name=name;const {error}=await sb.from("projects").update(row).eq("id",id);if(error)fail(error);return {stripped:s.stripped};},
    renameProject:async(id,name)=>{need();const {error}=await sb.from("projects").update({name}).eq("id",id);if(error)fail(error);},
    deleteProject:async id=>{need();const {error}=await sb.from("projects").delete().eq("id",id);if(error)fail(error);},
    setPublic:async(id,on)=>{need();const {data,error}=await sb.from("projects").update({is_public:!!on}).eq("id",id).select("public_id").single();if(error)fail(error);return data.public_id;},
    shareUrl:pid=>siteUrl+"/k/"+pid,
    loadShared:async pid=>{const {data,error}=await sb.rpc("shared_project",{pid});if(error)fail(error);const row=Array.isArray(data)?data[0]:data;return row||null;},
    listEquipment:async()=>{need();const {data,error}=await sb.from("equipment").select("data").order("created_at",{ascending:false});if(error)fail(error);return (data||[]).map(r=>r.data);},
    saveEquipment:async e=>{need();const {error}=await sb.from("equipment").upsert({owner:user.id,cid:e.cid,data:e},{onConflict:"owner,cid"});if(error)fail(error);},
    deleteEquipment:async cid=>{need();const {error}=await sb.from("equipment").delete().eq("cid",cid);if(error)fail(error);},
    ai:async(prompt,opts)=>{need();const {data,error}=await sb.functions.invoke("ai",{body:{prompt,tier:opts&&opts.modelTier||"default"}});
      if(error){const st=error.context&&error.context.status;const e=new Error(error.message||"AI request failed");e.code=st===429?"rate_limited":st===401||st===403?"not_granted":"failed";throw e;}
      if(data&&data.error){const e=new Error(data.error);e.code=data.code||"failed";throw e;}return data&&data.json;},
    waitlist:async(email,note)=>{const {error}=await sb.from("waitlist").insert({email,note:note||null,source:location.pathname});if(error)fail(error);}
  };
})();
