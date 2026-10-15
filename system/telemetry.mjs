// Shared, side-effect-free public projection. Never send the raw coordination ledger to a browser.
export const FRESH_FETCH_MS = 90000;
export const FRESH_ACTIVITY_MS = 300000;
export const ROLES = [
  ['supervisor','Supervisor','Coordinate & unblock','hourly polling','S'],
  ['catalog','Equipment catalogue','Research → verified equipment','daily around 08:00 Dubai','EQ'],
  ['product','Product','Requirements & acceptance','Thursday, nominal 09:00 local','P'],
  ['reviewer','Code review','Independent change review','Wednesday / Friday, nominal 09:00 local','R'],
  ['reliability','Reliability','Production evidence & checks','Monday / Thursday / Saturday, nominal 15:00 local','✓'],
  ['discovery','Discovery','Buyer questions & honest measurement','daily around 08:00 Dubai','D'],
  ['content-qa','Content & QA','Media, claims & asset quality','daily 09:00 Dubai','CQ'],
  ['social-readiness','Social readiness','Release-ready media & coverage','daily 08:00 / 17:00 Dubai','SR'],
  ['cx','Customer experience','Feedback & research proposals','Wednesday, nominal 15:00 local','CX']
].map(([id,name,purpose,cadence,mark])=>({id,name,purpose,cadence,mark}));
export const GOAL={observed:483,target:1001,observedDate:'2026-10-15',deadline:'2026-10-31T19:59:59Z'};
const states=new Set(['ready','leased','awaiting_ack','retry_wait','blocked','needs_approval','done','cancelled']);
const roles=new Set(ROLES.map(r=>r.id));
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?x:null;
const text=(x,n=500)=>typeof x==='string'?x.slice(0,n):'';
const entries=x=>x&&typeof x==='object'&&!Array.isArray(x)?Object.entries(x):[];
export function projectQueue(q,now=Date.now()){
  if(q?.schemaVersion!==1||!Number.isSafeInteger(q.revision)||q.revision<0||!time(q.updatedAt)||Date.parse(q.updatedAt)>now+60000||!q.tasks||!q.workers||!q.receipts)throw new Error('Invalid public queue');
  if(entries(q.tasks).length>500)throw new Error('Queue exceeds view capacity');
  const tasks=entries(q.tasks).map(([id,t])=>{
    if(t?.id!==id||!roles.has(t.owner)||!states.has(t.status))throw new Error('Invalid task metadata');
    const l=t.status==='leased'?t.lease:null;
    const verified=!!(l&&l.worker===t.owner&&typeof l.runId==='string'&&l.runId.length>0&&typeof l.token==='string'&&l.token.length>0&&Number.isInteger(l.generation)&&l.generation===t.generation&&l.generation>0&&time(l.claimedAt)&&time(l.heartbeatAt)&&time(l.expiresAt)&&Date.parse(l.claimedAt)<=Date.parse(l.heartbeatAt)&&Date.parse(l.heartbeatAt)<Date.parse(l.expiresAt)&&Date.parse(l.heartbeatAt)<=now+60000);
    return {id:text(id,120),owner:t.owner,title:text(t.title,200),status:t.status,reason:text(t.reason),createdAt:time(t.createdAt),updatedAt:time(t.updatedAt),completedAt:time(t.completedAt),deadline:time(t.deadline),retryAt:time(t.retryAt),lease:l?{verified,heartbeatAt:time(l.heartbeatAt),expiresAt:time(l.expiresAt)}:null};
  });
  const workers=Object.fromEntries(entries(q.workers).filter(([id])=>roles.has(id)).map(([id,w])=>[id,{at:time(w.at)}]));
  const handoffs=entries(q.receipts).map(([,r])=>({taskId:text(r.taskId,120),from:roles.has(r.from)?r.from:null,to:roles.has(r.to)?r.to:null,createdAt:time(r.createdAt),ackDueAt:time(r.ackDueAt),acceptedAt:time(r.acceptedAt)})).filter(r=>r.from&&r.to).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,12);
  return {schemaVersion:1,revision:q.revision,queueUpdatedAt:q.updatedAt,fetchedAt:new Date(now).toISOString(),roles:ROLES,goal:GOAL,tasks,workers,handoffs};
}
export function feedState(data,now,failed=false){
  if(!data)return failed?'offline':'unknown';
  const fetched=Date.parse(data.fetchedAt);
  if(failed)return 'offline';
  if(!Number.isFinite(fetched)||fetched>now+60000||now-fetched>FRESH_FETCH_MS)return 'stale';
  return 'current';
}
export function taskState(t,now,feed='current'){
  if(t.status!=='leased')return ({ready:'queued',retry_wait:'queued',awaiting_ack:'handoff',needs_approval:'approval',cancelled:'cancelled'})[t.status]||t.status;
  const l=t.lease;
  if(!l?.verified)return 'unknown';
  if(Date.parse(l.expiresAt)<=now)return 'expired';
  const heartbeat=Date.parse(l.heartbeatAt);
  if(feed!=='current'||!Number.isFinite(heartbeat)||heartbeat>now||now-heartbeat>FRESH_ACTIVITY_MS)return 'unconfirmed';
  return 'working';
}
export function roleView(data,id,now,feed){
  const tasks=(data?.tasks||[]).filter(t=>t.owner===id);
  const priority=['working','approval','blocked','handoff','expired','unconfirmed','unknown','queued','done','cancelled'];
  const ranked=tasks.map(task=>({task,state:taskState(task,now,feed)})).sort((a,b)=>priority.indexOf(a.state)-priority.indexOf(b.state)||Date.parse(b.task.updatedAt||0)-Date.parse(a.task.updatedAt||0));
  const current=ranked.find(x=>!['done','cancelled'].includes(x.state))||ranked[0];
  return {id,tasks:ranked,current:current?.task??null,state:current?.state||(data?.workers?.[id]?.at?'idle':'unknown'),lastTick:data?.workers?.[id]?.at??null};
}
export const LABELS={working:'Working',queued:'Queued',blocked:'Blocked',approval:'Awaiting approval',handoff:'Awaiting ACK',done:'Done',idle:'Idle',unknown:'Unobserved',expired:'Lease expired',unconfirmed:'Activity unconfirmed',cancelled:'Cancelled'};
