import config from '../site.config.json' with {type:'json'};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHAT=/^https:\/\/chatgpt\.com\/c\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Pragma':'no-cache','Vary':'Authorization, Origin','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
const fail=status=>reply(status,{error:({400:'Invalid request',401:'Sign in required',403:'Not authorized',404:'Not found',405:'Method not allowed',409:'Approval changed; refresh before deciding',413:'Request too large',415:'JSON required',503:'Private approvals unavailable'})[status]||'Private approvals unavailable'});
const string=(x,n)=>typeof x==='string'&&x.length>0&&x.length<=n;
const instant=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
async function readJson(response,limit){
  if(Number(response.headers.get('content-length'))>limit)throw new Error('size');
  const reader=response.body?.getReader();if(!reader)throw new Error('body');
  let size=0,parts=[],expired=false;
  const deadline=setTimeout(()=>{expired=true;reader.cancel().catch(()=>{});},5000);
  try{for(;;){const {done,value}=await reader.read();if(expired)throw new Error('timeout');if(done)break;size+=value.length;if(size>limit)throw new Error('size');parts.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{clearTimeout(deadline);}
  const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function summary(row){
  if(!row||!UUID.test(row.id)||!Number.isSafeInteger(row.version)||row.version<1||!string(row.taskId,120)||!string(row.title,200)||!string(row.action,80)||!string(row.targetVersion,240)||!['pending','approved','acknowledged','stale'].includes(row.status)||!instant(row.expiresAt)||(row.chatUrl!==null&&!CHAT.test(row.chatUrl))||(row.workerAcknowledgedAt!==null&&!instant(row.workerAcknowledgedAt))||typeof row.canApprove!=='boolean')throw new Error('Invalid private response');
  if(row.canApprove&&row.status!=='pending')throw new Error('Invalid decision state');
  return Object.fromEntries(['id','version','taskId','title','action','targetVersion','status','expiresAt','chatUrl','workerAcknowledgedAt','canApprove'].map(key=>[key,row[key]]));
}
/** Private API only. The database RPC independently authorizes auth.uid() and
 * requires an explicitly enabled, verified durable store/consumer. No client
 * claims, public queue entry or injected environment flag grants approval. */
export async function approvalApi(request,env={},fetcher=fetch){
  const url=new URL(request.url),base='/system/private/approvals';
  const match=url.pathname.match(/^\/system\/private\/approvals\/([^/]+)\/decision$/);
  if(url.pathname!==base&&!match)return fail(404);
  if((url.pathname===base&&request.method!=='GET')||(match&&request.method!=='POST'))return fail(405);
  if(url.search||url.username||url.password)return fail(400);
  const origin=request.headers.get('Origin');
  if((request.method==='POST'&&!origin)||(origin&&origin!==url.origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail(403);
  if(match&&!UUID.test(match[1]))return fail(400);
  const authorization=request.headers.get('Authorization');
  if(!authorization||!/^Bearer [A-Za-z0-9._~-]{16,8192}$/.test(authorization))return fail(401);
  let body;
  if(match){
    if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('Content-Type')||''))return fail(415);
    try{body=await readJson(request,4096);}catch(error){return fail(error.message==='size'?413:400);}
    if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!=='idempotencyKey,version'||!Number.isSafeInteger(body.version)||body.version<1||!UUID.test(body.idempotencyKey))return fail(400);
  }
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const authHeaders={apikey:config.supabaseAnonKey,Authorization:authorization,Accept:'application/json'};
    const auth=await fetcher(config.supabaseUrl.replace(/\/$/,'')+'/auth/v1/user',{headers:authHeaders,signal:controller.signal,redirect:'error',cache:'no-store'});
    if(auth.status===401||auth.status===403)return fail(401);
    if(!auth.ok)return fail(503);
    const user=await readJson(auth,65536);if(!UUID.test(user?.id))return fail(401);
    // No authorization based on email, profile or user_metadata. RPC checks its
    // server-owned ACL even though this token has already been authenticated.
    const rpc=match?'system_approval_decide':'system_approval_list';
    const result=await fetcher(config.supabaseUrl.replace(/\/$/,'')+'/rest/v1/rpc/'+rpc,{method:'POST',headers:{...authHeaders,'Content-Type':'application/json'},body:JSON.stringify(match?{p_request:match[1],p_version:body.version,p_idempotency:body.idempotencyKey}:{}),signal:controller.signal,redirect:'error',cache:'no-store'});
    if(!result.ok)return fail([401,403,409].includes(result.status)?result.status:503);
    const value=await readJson(result,131072);
    if(!value||typeof value.consumerReady!=='boolean')return fail(503);
    if(!match){
      if(!Array.isArray(value.requests)||value.requests.length>100)throw new Error('Invalid list');
      const rows=value.requests.map(summary);
      if(!value.consumerReady&&rows.some(row=>row.canApprove))throw new Error('Consumer unavailable');
      return reply(200,{requests:rows,consumerReady:value.consumerReady});
    }
    if(value.consumerReady!==true)return fail(503);
    if(!UUID.test(value.receiptId)||!instant(value.approvedAt))throw new Error('Missing durable receipt');
    const row=summary(value.request);if(row.id.toLowerCase()!==match[1].toLowerCase()||row.version!==body.version||!['approved','acknowledged'].includes(row.status)||row.canApprove)throw new Error('Decision not durable');
    return reply(200,{request:row,receiptId:value.receiptId,approvedAt:value.approvedAt});
  }catch{return fail(503);}finally{clearTimeout(timeout);}
}
