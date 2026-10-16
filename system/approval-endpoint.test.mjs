import test from 'node:test';
import assert from 'node:assert/strict';
import {approvalApi} from './approval-endpoint.mjs';

// HTTP/RPC contract tests with a deliberately injected fake service. These do
// NOT establish deployed SQL correctness, live auth, consumer execution or ACK.
const origin='https://kitchenstudio.design',base=origin+'/system/private/approvals';
const id='10000000-0000-4000-8000-000000000001',uid='20000000-0000-4000-8000-000000000001',key='30000000-0000-4000-8000-000000000001',receipt='40000000-0000-4000-8000-000000000001';
const token='fake.test-token.123456789';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const pending=()=>({id,version:1,taskId:'EXAMPLE-TASK',title:'Approve exact example release',action:'catalogue.release',targetVersion:'a'.repeat(40),status:'pending',expiresAt:'2026-10-16T14:00:00Z',chatUrl:'https://chatgpt.com/c/11111111-2222-3333-4444-555555555555',workerAcknowledgedAt:null,canApprove:true});
const get=(headers={})=>new Request(base,{headers:{Authorization:'Bearer '+token,...headers}});
const post=(body={version:1,idempotencyKey:key},headers={})=>new Request(base+'/'+id+'/decision',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
function service({authStatus=200,authorized=true,ready=true,row=pending(),rpcStatus=200,dropFirst=false,modify=value=>value}={}){
  const calls=[];let decisions=0,saved=null,dropped=false;
  const fetcher=async(url,init)=>{
    calls.push({url,init});
    if(url.endsWith('/auth/v1/user'))return json({id:uid,user_metadata:{role:'admin'},app_metadata:{}},authStatus);
    if(!authorized)return json({message:'secret SQL error'},403);
    if(rpcStatus!==200)return json({message:'private diagnostic'},rpcStatus);
    if(!ready)return json({consumerReady:false,requests:[{...row,canApprove:false}]});
    if(url.endsWith('/system_approval_list'))return json(modify({requests:[row],consumerReady:true}));
    const b=JSON.parse(init.body);
    if(b.p_request!==id||b.p_version!==row.version||row.status==='stale')return json({},409);
    if(saved&&saved.key!==b.p_idempotency)return json({},409);
    if(!saved){decisions++;saved={key:b.p_idempotency,value:{request:{...row,status:'approved',canApprove:false},receiptId:receipt,approvedAt:'2026-10-16T13:00:00Z',consumerReady:true}};}
    if(dropFirst&&!dropped){dropped=true;throw new Error('lost response after durable write');}
    return json(modify(saved.value));
  };
  return {fetcher,calls,decisions:()=>decisions};
}
test('anonymous request never contacts auth/store or exposes private data',async()=>{
  const s=service();const r=await approvalApi(new Request(base),{},s.fetcher);assert.equal(r.status,401);assert.equal(s.calls.length,0);assert.equal((await r.text()).includes('chatgpt'),false);
});
test('expired/invalid token is denied before private RPC',async()=>{
  const s=service({authStatus:401});assert.equal((await approvalApi(get(),{},s.fetcher)).status,401);assert.equal(s.calls.length,1);
});
test('ordinary customer and metadata-spoofed administrator require independent RPC ACL',async()=>{
  const s=service({authorized:false});const r=await approvalApi(get(),{},s.fetcher);assert.equal(r.status,403);assert.equal(s.calls.length,2);assert.deepEqual(await r.json(),{error:'Not authorized'});
});
test('same-origin authenticated list is explicitly projected and private/no-store',async()=>{
  const s=service({modify:v=>({...v,privateToken:'do-not-leak',requests:v.requests.map(r=>({...r,fencingToken:'secret'}))})});
  const r=await approvalApi(get(),{},s.fetcher);assert.equal(r.status,200);assert.match(r.headers.get('Cache-Control'),/private, no-store/);assert.match(r.headers.get('Vary'),/Authorization/);
  assert.deepEqual(await r.json(),{requests:[pending()],consumerReady:true});
  assert.ok(s.calls.every(c=>c.init.redirect==='error'&&c.init.cache==='no-store'));
});
test('unconfigured private RPC/store fails closed without chat disclosure',async()=>{
  for(const setup of [{rpcStatus:404},{rpcStatus:500}]){const s=service(setup);const r=await approvalApi(get(),{},s.fetcher);assert.equal(r.status,503);assert.equal((await r.text()).includes('chatgpt'),false);}
});
test('authorized private chat remains useful while consumer unavailable; approval stays disabled',async()=>{
  const s=service({ready:false});const r=await approvalApi(get(),{},s.fetcher);assert.equal(r.status,200);const v=await r.json();assert.equal(v.consumerReady,false);assert.equal(v.requests[0].canApprove,false);assert.equal(v.requests[0].chatUrl,pending().chatUrl);
  assert.equal((await approvalApi(post(),{},s.fetcher)).status,503);assert.equal(s.decisions(),0);
});
test('upstream cannot enable approvals when its consumer reports unavailable',async()=>{
  const s=service({modify:v=>({...v,consumerReady:false})});assert.equal((await approvalApi(get(),{},s.fetcher)).status,503);
});
test('environment flags cannot enable approval or bypass auth/ACL',async()=>{
  const s=service({ready:false});assert.equal((await approvalApi(post(),{APPROVAL_ENABLED:true,APPROVER_ID:uid},s.fetcher)).status,503);assert.equal(s.decisions(),0);
});
test('cross-origin, missing-origin and cross-site mutations stop before auth',async()=>{
  for(const h of [{Origin:'https://evil.example'},{Origin:''},{'Sec-Fetch-Site':'cross-site'}]){const s=service();assert.equal((await approvalApi(post(undefined,h),{},s.fetcher)).status,403);assert.equal(s.calls.length,0);}
});
test('cross-origin private GET is denied',async()=>{const s=service();assert.equal((await approvalApi(get({Origin:'https://evil.example'}),{},s.fetcher)).status,403);assert.equal(s.calls.length,0);});
test('strict JSON and bounded payload reject target/action/identity tampering',async()=>{
  for(const body of [{version:1,idempotencyKey:key,action:'system.release'},{version:1,idempotencyKey:key,taskId:'other'},{version:0,idempotencyKey:key},{version:1,idempotencyKey:'bad'},[]]){const s=service();assert.equal((await approvalApi(post(body),{},s.fetcher)).status,400);assert.equal(s.calls.length,0);}
  assert.equal((await approvalApi(post(undefined,{'Content-Type':'text/plain'}))).status,415);
  assert.equal((await approvalApi(post({padding:'x'.repeat(5000)}))).status,413);
});
test('malformed JSON, target ID and query-string credentials are denied',async()=>{
  const malformed=new Request(base+'/'+id+'/decision',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},body:'{'});
  assert.equal((await approvalApi(malformed)).status,400);
  assert.equal((await approvalApi(new Request(base+'?token=secret',{headers:{Authorization:'Bearer '+token}}))).status,400);
  assert.equal((await approvalApi(new Request(base+'/bad/decision',{method:'POST',headers:{Origin:origin}}))).status,400);
});
test('approval response requires durable receipt and does not manufacture worker ACK',async()=>{
  const s=service();const r=await approvalApi(post(),{},s.fetcher);assert.equal(r.status,200);const value=await r.json();assert.equal(value.receiptId,receipt);assert.equal(value.request.status,'approved');assert.equal(value.request.workerAcknowledgedAt,null);assert.equal(value.request.canApprove,false);assert.equal(s.decisions(),1);
});
test('concurrent clicks reuse the same fake durable receipt exactly once',async()=>{
  const s=service();const results=await Promise.all([approvalApi(post(),{},s.fetcher),approvalApi(post(),{},s.fetcher)]);assert.ok(results.every(r=>r.status===200));assert.deepEqual(await results[0].json(),await results[1].json());assert.equal(s.decisions(),1);
});
test('lost response replay recovers existing receipt without another decision',async()=>{
  const s=service({dropFirst:true});assert.equal((await approvalApi(post(),{},s.fetcher)).status,503);assert.equal((await approvalApi(post(),{},s.fetcher)).status,200);assert.equal(s.decisions(),1);
});
test('another idempotency key after approval does not create another decision',async()=>{
  const s=service();await approvalApi(post(),{},s.fetcher);assert.equal((await approvalApi(post({version:1,idempotencyKey:'30000000-0000-4000-8000-000000000002'}),{},s.fetcher)).status,409);assert.equal(s.decisions(),1);
});
test('stale task/head/expiry RPC rejection and version mismatch surface refresh state',async()=>{
  for(const setup of [{rpcStatus:409},{row:{...pending(),status:'stale',canApprove:false}},{row:{...pending(),version:2}}]){const s=service(setup);assert.equal((await approvalApi(post(),{},s.fetcher)).status,409);assert.equal(s.decisions(),0);}
});
test('invalid or mismatched upstream receipt is never shown as successful approval',async()=>{
  for(const modify of [v=>({...v,receiptId:null}),v=>({...v,request:{...v.request,id:'10000000-0000-4000-8000-000000000002'}}),v=>({...v,request:{...v.request,version:2}}),v=>({...v,request:{...v.request,status:'pending',canApprove:true}})]){const s=service({modify});assert.equal((await approvalApi(post(),{},s.fetcher)).status,503);}
});
test('unverified, credentialed, redirected or script chat links fail closed',async()=>{
  for(const chatUrl of ['javascript:alert(1)','https://evil.example/c/'+id,'https://chatgpt.com/c/'+id+'?x=private','https://evil@chatgpt.com/c/'+id,'https://chatgpt.com/c/'+id+'/']){const s=service({row:{...pending(),chatUrl}});assert.equal((await approvalApi(get(),{},s.fetcher)).status,503);}
});
test('actual acknowledgement remains a separate server-owned field',async()=>{
  const s=service({row:{...pending(),status:'acknowledged',canApprove:false,workerAcknowledgedAt:'2026-10-16T13:05:00Z'}});const r=await approvalApi(get(),{},s.fetcher);assert.equal((await r.json()).requests[0].status,'acknowledged');
});
test('network and corrupt upstream responses hide details and private requests',async()=>{
  for(const f of [async()=>{throw new Error('secret service key');},async()=>new Response('bad-json'),async()=>json({id:uid,padding:'x'.repeat(70000)})]){const r=await approvalApi(get(),{},f);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'Private approvals unavailable'});}
});
test('unknown private paths and methods never become mutation fallbacks',async()=>{
  assert.equal((await approvalApi(new Request(base+'/other'))).status,404);
  assert.equal((await approvalApi(new Request(base,{method:'DELETE'}))).status,405);
});
