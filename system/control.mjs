// Private data comes only from the authenticated API. No private links enter the public feed.
export const PRIVATE_API='/system/private/approvals';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function verifiedChat(value){return typeof value==='string'&&/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?value:null;}
export function canDecide(r,ready,now=Date.now()){return ready===true&&r?.canApprove===true&&r.status==='pending'&&Number.isFinite(Date.parse(r.expiresAt))&&Date.parse(r.expiresAt)>now;}
export function summaryState(r){return r.workerAcknowledgedAt?'Worker acknowledged':r.status==='approved'?'Approved — waiting for worker acknowledgement':r.status==='acknowledged'?'Acknowledgement requires verification':r.status==='pending'?'Awaiting your decision':'Request is no longer actionable';}
export function validSummary(r){return !!(r&&UUID.test(r.id)&&Number.isSafeInteger(r.version)&&r.version>0&&['pending','approved','acknowledged','stale'].includes(r.status)&&['taskId','title','action','targetVersion'].every(k=>typeof r[k]==='string'&&r[k].length<=1000)&&typeof r.expiresAt==='string'&&Number.isFinite(Date.parse(r.expiresAt))&&(r.workerAcknowledgedAt==null||typeof r.workerAcknowledgedAt==='string'&&Number.isFinite(Date.parse(r.workerAcknowledgedAt))));}
// Kept separate so retries reuse an opaque operation key after a response is lost.
export function decisionKey(storage,userId,r,random=()=>crypto.randomUUID()){
 const slot=`ks-owner-decision:${userId}:${r.id}:${r.version}`;let key;try{key=storage?.getItem(slot);}catch{}
 if(!UUID.test(key||'')){key=random();try{storage?.setItem(slot,key);}catch{}}return key;
}
export function mountOwnerControls({document,auth,fetcher=fetch,storage,now=()=>Date.now(),random=()=>crypto.randomUUID(),schedule=setTimeout,cancel=clearTimeout}){
 const status=document.querySelector('#access-status'),list=document.querySelector('#private-requests'),refresh=document.querySelector('#refresh-private'),login=document.querySelector('#sign-in');
 let busy=false,timer=null,generation=0,stopped=false,reloadAfterAuth=false;const operationKeys=new Map();
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const clear=()=>{list.replaceChildren();list.hidden=true;};
 function fail(message){clear();status.textContent=message;}
 async function session(){const {data,error}=await auth.getSession();if(error)throw Error('session');return data?.session||null;}
 async function api(path,options={}){
  const s=await session();if(!s?.access_token||!s.user?.id)throw Object.assign(Error('signed-out'),{status:401});
  const controller=new AbortController(),timeout=schedule(()=>controller.abort(),8000);
  try{const response=await fetcher(path,{...options,cache:'no-store',credentials:'omit',redirect:'error',headers:{Authorization:`Bearer ${s.access_token}`,...options.headers},signal:controller.signal});
   if(!response.ok)throw Object.assign(Error('private-api'),{status:response.status});return await response.json();
  }finally{cancel(timeout);}
 }
 function render(r,ready,userId,epoch){
  const card=el('article',undefined,'request');card.dataset.request=r.id;
  const badge=el('span',summaryState(r),'state');card.append(badge,el('h2',r.title));
  const dl=el('dl');for(const [label,value]of [['Task',r.taskId],['Action',r.action],['Exact version',r.targetVersion],['Request version',String(r.version)],['Expires',new Date(r.expiresAt).toLocaleString()]]){dl.append(el('dt',label),el('dd',value));}card.append(dl);
  const actions=el('div',undefined,'actions'),approve=el('button',r.status==='approved'||r.workerAcknowledgedAt?'Approved':'Approve','primary');approve.type='button';approve.disabled=!canDecide(r,ready,now());
  actions.append(approve);const chat=verifiedChat(r.chatUrl);if(chat){const a=el('a','Go to chat');a.href=chat;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';actions.append(a);}else{const unavailable=el('button','Go to chat');unavailable.type='button';unavailable.disabled=true;actions.append(unavailable);}
  const feedback=el('p',r.workerAcknowledgedAt?`Acknowledged at ${new Date(r.workerAcknowledgedAt).toLocaleString()}`:chat?'':'A verified conversation link has not been supplied.','decision-status');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');card.append(actions,feedback);
  approve.addEventListener('click',async()=>{
   if(approve.disabled||epoch!==generation)return;if(!canDecide(r,ready,now())){approve.disabled=true;feedback.textContent='This request expired. Refresh to review its current version.';return;}approve.disabled=true;feedback.textContent='Saving your decision…';
   const slot=`${userId}:${r.id}:${r.version}`;if(!operationKeys.has(slot))operationKeys.set(slot,decisionKey(storage,userId,r,random));
   try{const result=await api(`${PRIVATE_API}/${r.id}/decision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:r.version,idempotencyKey:operationKeys.get(slot)})});
    if(epoch!==generation)return;if(!result?.receiptId||!result?.request||result.request.id!==r.id||result.request.version!==r.version)throw Error('invalid receipt');
    approve.textContent='Approved';badge.textContent=summaryState(result.request);feedback.textContent=result.request.workerAcknowledgedAt?'Worker acknowledgement verified.':`Decision saved (${result.receiptId}). Waiting for worker acknowledgement.`;
   }catch(error){if(epoch!==generation)return;if(error.status===401||error.status===403){fail(error.status===401?'Your session ended. Sign in again.':'This account is not authorized for this request.');return;}
    if(error.status===409){feedback.textContent='This request changed or expired. Refresh to review its current version.';return;}
    feedback.textContent='The decision could not be confirmed. Retry uses the same operation key; refresh checks for a saved receipt.';approve.disabled=!canDecide(r,ready,now());
   }
  });return card;
 }
 async function load(){
  if(busy||stopped)return;busy=true;refresh.disabled=true;cancel(timer);const epoch=++generation;clear();
  try{const s=await session();if(epoch!==generation)return;if(!s?.access_token||!s?.user?.id){status.textContent='Sign in to Kitchen Studio to check your designated approval requests.';login.hidden=false;refresh.hidden=true;return;}
   login.hidden=true;refresh.hidden=false;status.textContent='Verifying your private approval access…';const data=await api(PRIVATE_API);if(epoch!==generation)return;
   if(typeof data.consumerReady!=='boolean'||!Array.isArray(data.requests)||data.requests.length>100)throw Error('unavailable');
   const rows=data.requests.filter(validSummary);
   if(rows.length!==data.requests.length||!data.consumerReady&&rows.some(r=>r.canApprove))throw Error('invalid response');list.replaceChildren(...rows.map(r=>render(r,data.consumerReady,s.user.id,epoch)));list.hidden=false;status.textContent=!data.consumerReady?'Approval is unavailable until the receiving worker is verified. You can still open a verified conversation.':rows.length?'Your private requests are ready. Review the exact action and version before approving.':'No requests are assigned to this account.';
  }catch(error){if(epoch!==generation)return;fail(error.status===401?'Your session ended. Sign in again.':error.status===403?'This account is not a designated system approver.':'Approval is unavailable. The private decision store and receiving worker must be enabled and verified. No decision was sent.');if(error.status===401)login.hidden=false;
  }finally{busy=false;refresh.disabled=false;if(!stopped){const delay=reloadAfterAuth?0:30000;reloadAfterAuth=false;timer=schedule(()=>{if(!document.hidden)load();else timer=schedule(load,30000);},delay);}}
 }
 const change=()=>{generation++;clear();schedule(()=>{if(busy)reloadAfterAuth=true;else load();},0);};const subscription=auth.onAuthStateChange?.(change);refresh.addEventListener('click',load);load();
 return {refresh:load,destroy(){stopped=true;generation++;cancel(timer);subscription?.data?.subscription?.unsubscribe?.();clear();}};
}
if(typeof window!=='undefined'&&window.document){
 const cfg=window.KS_CONFIG||{};
 if(window.supabase&&cfg.supabaseUrl&&cfg.supabaseAnonKey){const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});let storage;try{storage=window.sessionStorage;}catch{}mountOwnerControls({document:window.document,auth:sb.auth,storage});}
 else document.querySelector('#access-status').textContent='Kitchen Studio sign-in is unavailable. No private requests have been loaded.';
}
