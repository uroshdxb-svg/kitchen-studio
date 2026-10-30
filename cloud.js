/* Kitchen Studio cloud layer: accounts, saved kitchens, share links, custom models and the AI proxy, on Supabase.
   Exposes window.KS_backend (or null when the page has no Supabase config, in which case the app runs local-only). */
(function(){
  const cfg=window.KS_CONFIG||{};
  if(window.KS_backend)return;/* a backend was injected already (tests, mocks) */
  if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase){window.KS_backend=null;return;}
  /* a sign-in link that failed comes back with the reason in the URL; keep it for the app to show, then tidy the address bar */
  let linkError=null;try{const q=new URLSearchParams((location.hash||"").replace(/^#/,"")+"&"+(location.search||"").replace(/^\?/,""));
    if(q.get("error")||q.get("error_code")){const code=q.get("error_code")||q.get("error");linkError=code==="otp_expired"?"That sign-in link has expired or was already used. Send yourself a new one.":(q.get("error_description")||"The sign-in link didn't work.").replace(/\+/g," ")+" Send yourself a new one.";
      history.replaceState(null,"",location.pathname);}}catch(_){}
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
  async function aiFailure(error,data){
    let payload=data,st=error&&error.context&&error.context.status;
    if(!payload&&error&&error.context&&typeof error.context.json==="function"){
      try{payload=await error.context.json();}catch(_){}
    }
    const code=payload&&payload.code;
    let kind=code||((st===401||st===403)?"not_granted":st===429?"rate_limited":st===504?"timeout":error&&error.name==="FunctionsFetchError"?"unreachable":"failed");
    if(code==="ai_not_configured"||/AI is not configured/i.test(payload&&payload.error||""))kind="ai_not_configured";
    const messages={
      ai_not_configured:"Document reading is unavailable because the AI service is not configured. Use CSV or manual entry for now.",
      not_granted:"Your sign-in session could not be verified. Sign in again, then retry. Your file is still selected.",
      rate_limited:"The AI reader is busy or its daily limit has been reached. Try again later, or use CSV or manual entry.",
      timeout:"Document reading took too long. Your file is still selected. Try fewer pages or a clearer crop, or use CSV or manual entry.",
      unreachable:"Could not reach the document reader. Your file is still selected. Check your connection and retry, or use CSV or manual entry.",
      provider_unavailable:"The AI provider is unavailable. Your file is still selected. Try again later, or use CSV or manual entry.",
      invalid_response:"The document reader could not finish extracting the equipment. Try fewer items or a clearer image, or use CSV or manual entry."
    };
    const e=new Error(messages[kind]||"The document reader could not complete this request. Your file is still selected. Retry or use CSV or manual entry.");e.code=kind;return e;
  }
  window.KS_backend={
    ready,linkError:()=>linkError,user:()=>user,providers:()=>providers,onAuth:f=>{listeners.add(f);return()=>listeners.delete(f);},
    signInEmail:async(email,redirect)=>{const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:redirect||siteUrl+"/app/"}});if(error){if(error.status===429||/rate limit/i.test(error.message||""))error.message="Too many sign-in emails in a short time. Wait a few minutes and try again.";fail(error);}},
    signInGoogle:async redirect=>{const {error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:redirect||siteUrl+"/app/"}});if(error)fail(error);},
    /* OAuth consent for apps such as Claude's Kitchen Studio connector (Supabase OAuth 2.1 server) */
    oauthDetails:async id=>{const {data,error}=await sb.auth.oauth.getAuthorizationDetails(id);if(error)fail(error);return data;},
    oauthDecide:async(id,approve)=>{const fn=approve?sb.auth.oauth.approveAuthorization:sb.auth.oauth.denyAuthorization;const {data,error}=await fn.call(sb.auth.oauth,id,{skipBrowserRedirect:true});if(error)fail(error);return data;},
    signOut:()=>sb.auth.signOut(),
    listProjects:async()=>{need();const {data,error}=await sb.from("projects").select("id,name,summary,updated_at,is_public,public_id,version").order("updated_at",{ascending:false});if(error)fail(error);return data||[];},
    loadProject:async id=>{need();const {data,error}=await sb.from("projects").select("id,name,data,updated_at,is_public,public_id,version").eq("id",id).maybeSingle();if(error)fail(error);return data;},
    createProject:async(name,payload)=>{need();const s=strip(payload);const {data,error}=await sb.from("projects").insert({owner:user.id,name:name||"Untitled kitchen",data:s.data,summary:summary(payload)}).select("id,public_id,version,updated_at").single();if(error)fail(error);return Object.assign({stripped:s.stripped},data);},
    saveProject:async(id,payload,name,expectedVersion)=>{need();const s=strip(payload);const row={data:s.data,summary:summary(payload),updated_at:new Date().toISOString()};if(name)row.name=name;let q=sb.from("projects").update(row).eq("id",id);if(Number.isInteger(expectedVersion))q=q.eq("version",expectedVersion);const {data,error}=await q.select("version,updated_at").maybeSingle();if(error)fail(error);if(!data){const e=new Error("A newer online version exists");e.code="conflict";throw e;}return {stripped:s.stripped,version:data.version,updated_at:data.updated_at};},
    renameProject:async(id,name)=>{need();const {error}=await sb.from("projects").update({name}).eq("id",id);if(error)fail(error);},
    deleteProject:async id=>{need();const {error}=await sb.from("projects").delete().eq("id",id);if(error)fail(error);},
    setPublic:async(id,on)=>{need();const {data,error}=await sb.from("projects").update({is_public:!!on}).eq("id",id).select("public_id").single();if(error)fail(error);return data.public_id;},
    shareUrl:pid=>siteUrl+"/k/"+pid,
    loadShared:async pid=>{const {data,error}=await sb.rpc("shared_project",{pid});if(error)fail(error);const row=Array.isArray(data)?data[0]:data;return row||null;},
    listEquipment:async()=>{need();const {data,error}=await sb.from("equipment").select("data").order("created_at",{ascending:false});if(error)fail(error);return (data||[]).map(r=>r.data);},
    saveEquipment:async e=>{need();const {error}=await sb.from("equipment").upsert({owner:user.id,cid:e.cid,data:e},{onConflict:"owner,cid"});if(error)fail(error);},
    deleteEquipment:async cid=>{need();const {error}=await sb.from("equipment").delete().eq("cid",cid);if(error)fail(error);},
    ai:async(prompt,opts)=>{need();opts=opts||{};const controller=new AbortController();let timer;
      const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();const e=new Error("timeout");e.code="timeout";reject(e);},110000);});
      try{const {data,error}=await Promise.race([sb.functions.invoke("ai",{signal:controller.signal,body:{prompt,tier:opts.modelTier||"default",kind:opts.kind||null,images:opts.images||null,max_tokens:opts.maxTokens||null}}),deadline]);
        if(error||data&&data.error)throw await aiFailure(error,data&&data.error?data:null);
        if(!data||!data.json)throw await aiFailure(null,{code:"invalid_response"});return data.json;
      }catch(e){if(e.code==="timeout"||controller.signal.aborted)throw await aiFailure(null,{code:"timeout"});if(e.code)throw e;throw await aiFailure(e);}
      finally{clearTimeout(timer);}},
    report:async r=>{const row={kind:r.kind||"gap",message:String(r.message||"").slice(0,4000),view:r.view||null,context:r.context||null,project:r.project||null,email:user?(user.email||null):(r.email||null)};if(user)row.reporter=user.id;
      const {error}=await sb.from("reports").insert(row);if(error)fail(error);},
    waitlist:async(email,consent,note)=>{if(consent!==true){const e=new Error("Marketing consent is required");e.code="consent_required";throw e;}const {error}=await sb.from("waitlist").insert({email,note:note||null,source:location.pathname,marketing_consent:true,consent_at:new Date().toISOString(),consent_version:"v1"});if(error)fail(error);}
  };
})();
