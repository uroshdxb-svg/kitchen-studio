// Coordination metadata only. This module never publishes, deploys, or calls an AI service.
import {createHash, randomUUID} from 'node:crypto';
import registry from './workers.json' with {type:'json'};
const hash=x=>createHash('sha256').update(stable(x)).digest('hex');
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const copy=x=>structuredClone(x);
const requireThat=(v,m)=>{if(!v)throw new Error(m);};
const iso=n=>new Date(n).toISOString();
const terminal=new Set(['done','cancelled']);
const text=(v,max=500)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const validId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(v);
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const timestamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const boundedMetadata=(v,message)=>requireThat(record(v)&&stable(v).length<=10000,message);
function references(refs){
 requireThat(Array.isArray(refs)&&refs.length>0&&refs.every(x=>text(x,1000)),'Evidence references must be nonempty strings up to 1000 characters');
 requireThat(stable(refs).length<=10000,'Evidence is metadata, not raw notes');return copy(refs);
}
function humanDecision(value){
 requireThat(record(value)&&Object.keys(value).every(k=>['decision','reference'].includes(k))&&['approved','declined'].includes(value.decision)&&text(value.reference),'Actual human decision reference required for approval-held work');
 return copy(value);
}
function resolutionMetadata(value,retired=false){
 boundedMetadata(value,'Corrupt resolution/retirement metadata');
 const allowed=retired?['at','refs','humanDecision']:['summary','refs','at'];
 requireThat(Object.keys(value).every(k=>allowed.includes(k))&&timestamp(value.at),'Corrupt resolution/retirement metadata');
 references(value.refs);
 if(retired){requireThat(Object.hasOwn(value,'humanDecision'),'Corrupt retirement decision');if(value.humanDecision!==null)humanDecision(value.humanDecision);}
 else requireThat(text(value.summary),'Corrupt resolution summary');
 return copy(value);
}
function expectedWorkers(q){
 const expected=q.expectedWorkers===undefined?registry.expectedWorkers:q.expectedWorkers;
 requireThat(record(expected)&&Object.keys(registry.expectedWorkers).every(id=>Object.hasOwn(expected,id)),'Corrupt/missing expected worker registry');
 for(const [id,e] of Object.entries(expected))requireThat(validId(id)&&record(e)&&Object.keys(e).every(k=>['expectedEveryMs','graceMs','firstExpectedAt'].includes(k))&&Number.isSafeInteger(e.expectedEveryMs)&&e.expectedEveryMs>=3600000&&e.expectedEveryMs<=31*86400000&&Number.isSafeInteger(e.graceMs)&&e.graceMs>=0&&e.graceMs<=86400000&&(e.firstExpectedAt===null||timestamp(e.firstExpectedAt)),'Corrupt expected worker '+id);
 return expected;
}
const earliestOperation=q=>Object.values(q.operations).reduce((first,o)=>first===null?Date.parse(o.at):Math.min(first,Date.parse(o.at)),null);
export const emptyQueue=()=>({schemaVersion:1,revision:0,updatedAt:null,expectationsStartedAt:null,expectedWorkers:copy(registry.expectedWorkers),tasks:{},operations:{},receipts:{},workers:{},alerts:{}});
export function validateQueue(q){
 requireThat(q?.schemaVersion===1&&Number.isInteger(q.revision),'Unknown/corrupt queue schema');
 for(const k of ['tasks','operations','receipts','workers','alerts'])requireThat(q[k]&&typeof q[k]==='object'&&!Array.isArray(q[k]),'Missing queue collection: '+k);
 const statuses=new Set(['ready','leased','awaiting_ack','retry_wait','blocked','needs_approval','done','cancelled']);
 for(const [id,t] of Object.entries(q.tasks)){
  requireThat(t.id===id&&validId(id)&&text(t.owner)&&Array.isArray(t.dependencies)&&Number.isInteger(t.generation)&&t.generation>=0&&statuses.has(t.status),'Corrupt task '+id);
  requireThat(t.dependencies.every(dep=>q.tasks[dep]&&dep!==id),'Missing task dependency '+id);
  requireThat(Number.isInteger(t.attempts)&&t.attempts>=0&&Number.isInteger(t.totalAttempts)&&t.totalAttempts>=t.attempts&&Number.isInteger(t.maxAttempts)&&t.maxAttempts>0&&Number.isInteger(t.maxTotalAttempts)&&t.maxTotalAttempts>=t.maxAttempts,'Corrupt retry counters '+id);
  requireThat(['work','release','content'].includes(t.kind)&&t.specification&&typeof t.specification==='object'&&text(t.specification.dedupeKey)&&typeof t.retrySafe==='boolean'&&(!t.retrySafe||t.kind==='work'),'Corrupt task specification '+id);
  requireThat(!t.deadline||Number.isFinite(Date.parse(t.deadline)),'Corrupt deadline '+id);
  requireThat(t.resource===null||validId(t.resource),'Corrupt exclusive resource '+id);
  if(t.status==='leased')requireThat(t.lease&&t.lease.worker===t.owner&&validId(t.lease.runId)&&text(t.lease.token)&&t.lease.generation===t.generation&&Number.isFinite(Date.parse(t.lease.expiresAt)),'Corrupt lease '+id);
  else requireThat(t.lease===null,'Unexpected active lease '+id);
  if(t.status==='awaiting_ack')requireThat(q.receipts[t.pendingReceipt]?.taskId===id&&!q.receipts[t.pendingReceipt].acceptedAt,'Missing pending handoff '+id);
  if(t.status==='retry_wait')requireThat(Number.isFinite(Date.parse(t.retryAt)),'Missing retry time '+id);
  if(t.resolution!==undefined)resolutionMetadata(t.resolution);
  if(t.retirement!==undefined){resolutionMetadata(t.retirement,true);requireThat(t.status==='cancelled'&&text(t.reason),'Corrupt retired task '+id);boundedMetadata({summary:t.reason,...t.retirement},'Corrupt retirement metadata');}
 }
 requireThat(q.updatedAt===null||timestamp(q.updatedAt),'Corrupt queue timestamp');
 expectedWorkers(q);
 requireThat(q.expectationsStartedAt===undefined||q.expectationsStartedAt===null||(timestamp(q.expectationsStartedAt)&&(q.updatedAt===null?q.revision===0:Date.parse(q.expectationsStartedAt)<=Date.parse(q.updatedAt))),'Corrupt expectation startup anchor');
 for(const [id,r] of Object.entries(q.receipts))requireThat(r&&r.id===id&&q.tasks[r.taskId]&&text(r.from)&&text(r.to)&&Number.isFinite(Date.parse(r.ackDueAt))&&Number.isFinite(Date.parse(r.createdAt)),'Corrupt handoff receipt '+id);
 for(const [id,w] of Object.entries(q.workers))requireThat(w&&validId(id)&&validId(w.runId)&&Number.isFinite(Date.parse(w.at))&&(w.expectedEveryMs===null||(Number.isSafeInteger(w.expectedEveryMs)&&w.expectedEveryMs>=3600000))&&(w.graceMs===undefined||(Number.isSafeInteger(w.graceMs)&&w.graceMs>=0&&w.graceMs<=86400000)),'Corrupt worker receipt '+id);
 for(const [id,o] of Object.entries(q.operations))requireThat(validId(id)&&o&&/^[a-f0-9]{64}$/.test(o.fingerprint??'')&&o.result&&typeof o.result==='object'&&Number.isFinite(Date.parse(o.at)),'Corrupt operation receipt '+id);
 return q;
}
function lease(q,c,now){
 const t=q.tasks[c.taskId];requireThat(t,'Unknown task');
 const l=t.lease;
 requireThat(t.status==='leased'&&l&&l.worker===c.worker&&l.runId===c.runId&&l.token===c.token&&l.generation===c.generation,'Lease ownership/fence mismatch');
 requireThat(Date.parse(l.expiresAt)>now,'Lease expired');return t;
}
function acquire(t,c,now){
 requireThat(c.worker===t.owner,'Task belongs to another role');
 requireThat(validId(c.runId),'Invalid run ID');
 const ms=c.leaseMs??900000;requireThat(Number.isInteger(ms)&&ms>=1000&&ms<=1800000,'Lease must be 1 second to 30 minutes');
 requireThat(t.totalAttempts<t.maxTotalAttempts,'Total acquisition limit reached');
 t.generation++;t.attempts++;t.totalAttempts++;t.status='leased';t.retryAt=null;
 t.lease={worker:c.worker,runId:c.runId,token:randomUUID(),generation:t.generation,claimedAt:iso(now),heartbeatAt:iso(now),expiresAt:iso(now+ms)};
 return {taskId:t.id,token:t.lease.token,generation:t.generation};
}
function availableResource(q,t){
 if(!t.resource)return;
 const occupied=new Set(['leased','awaiting_ack','retry_wait','blocked','needs_approval']);
 requireThat(!Object.values(q.tasks).some(other=>other.id!==t.id&&other.resource===t.resource&&occupied.has(other.status)),'Exclusive resource requires reconciliation or completion: '+t.resource);
}
function evidence(e,kind){
 requireThat(e?.outcome==='pass','Passing evidence references required');
 references(e.refs);boundedMetadata(e,'Evidence is metadata, not raw notes');
 if(kind==='release'){
  requireThat(/^[a-f0-9]{40}$/.test(e.commit??'')&&/^https:\/\//.test(e.ciUrl??'')&&/^https:\/\//.test(e.deploymentUrl??''),'Release requires commit, CI and deployment evidence');
  requireThat(/^https:\/\/kitchenstudio\.design\//.test(e.productionUrl??'')&&Number.isFinite(Date.parse(e.checkedAt))&&e.liveVerified===true,'Release requires actual production readback');
 }
 if(kind==='content')requireThat(/^[a-f0-9]{64}$/.test(e.artifactSha256??'')&&e.qaPassed===true,'Content requires exact artifact hash and completed QA');
 return copy(e);
}
function defer(t,now,reason,retryable){
 t.lease=null;t.reason=reason;
 if(!retryable||t.attempts>=t.maxAttempts||t.totalAttempts>=t.maxTotalAttempts){t.status='blocked';t.retryAt=null;return;}
 t.status='retry_wait';t.retryAt=iso(now+Math.min(3600000,60000*2**Math.max(0,t.attempts-1)));
}
export function inspectQueue(input,now=Date.now()){
 const q=validateQueue(input),issues=[];requireThat(Number.isFinite(now),'Invalid clock');
 const add=(key,severity,taskId,reason)=>issues.push({key,severity,taskId,reason,fingerprint:hash({key,severity,reason})});
 for(const t of Object.values(q.tasks)){
  if(t.status==='leased'&&Date.parse(t.lease.expiresAt)<=now)add('lease:'+t.id,'warning',t.id,'Lease expired; reconcile side effects before retry');
  if(t.status==='awaiting_ack'&&Date.parse(q.receipts[t.pendingReceipt].ackDueAt)<=now)add('handoff:'+t.id,'warning',t.id,'Handoff acknowledgment overdue');
  if(['blocked','needs_approval'].includes(t.status))add('blocked:'+t.id,t.status==='needs_approval'?'approval':'warning',t.id,t.reason);
  if(t.deadline&&!terminal.has(t.status)&&Date.parse(t.deadline)<=now)add('deadline:'+t.id,'critical',t.id,'Task deadline passed without verified completion');
  if(!terminal.has(t.status)&&t.dependencies.some(id=>['blocked','needs_approval','cancelled'].includes(q.tasks[id]?.status)))add('dependency:'+t.id,'warning',t.id,'Dependency requires attention');
 }
 const expected=expectedWorkers(q),anchor=Object.hasOwn(q,'expectationsStartedAt')?(q.expectationsStartedAt===null?null:Date.parse(q.expectationsStartedAt)):earliestOperation(q);
 for(const [id,e] of Object.entries(expected)){
  const w=q.workers[id];
  if(w){if(now-Date.parse(w.at)>e.expectedEveryMs+e.graceMs)add('worker:'+id,'warning',null,'Expected worker receipt overdue: '+id);continue;}
  const due=e.firstExpectedAt!==null?Date.parse(e.firstExpectedAt):(anchor===null?null:anchor+e.expectedEveryMs);
  if(due===null)add('worker-uninitialized:'+id,'warning',null,'Expected worker startup anchor uninitialized: '+id);
  else if(now>due+e.graceMs)add('worker:'+id,'warning',null,'Expected worker has never reported: '+id);
 }
 for(const [id,w] of Object.entries(q.workers))if(!Object.hasOwn(expected,id)&&w.expectedEveryMs&&now-Date.parse(w.at)>w.expectedEveryMs+(w.graceMs??3600000))add('worker:'+id,'warning',null,'Expected worker receipt overdue: '+id);
 return issues;
}
export function applyCommand(input,c,now=Date.now()){
 validateQueue(input);requireThat(Number.isFinite(now),'Invalid clock');requireThat(validId(c?.opId),'Stable opId required');
 const fingerprint=hash(c),prior=input.operations[c.opId];
 if(prior){requireThat(prior.fingerprint===fingerprint,'opId reused with different command');return {queue:copy(input),result:copy(prior.result)};}
 requireThat(!input.updatedAt||now>=Date.parse(input.updatedAt),'Clock moved backwards; refresh authoritative UTC time');
 const q=copy(input);let result={ok:true};
 // Anchor once to committed history; a legacy nonempty state without history stays visibly uninitialized.
 if(q.expectationsStartedAt===undefined){
  const anchor=earliestOperation(q);
  q.expectationsStartedAt=anchor!==null?iso(anchor):(q.revision===0?iso(now):null);
 }else if(q.expectationsStartedAt===null&&q.revision===0)q.expectationsStartedAt=iso(now);
 switch(c.type){
 case 'batch':{
  requireThat(Array.isArray(c.commands)&&c.commands.length>0&&c.commands.length<=10&&c.commands.every(x=>x.type!=='batch'&&x.opId!==c.opId),'Invalid bounded command batch');
  const results=[];for(const command of c.commands){const step=applyCommand(q,command,now);Object.assign(q,step.queue);results.push(step.result);}result={results};break;
 }
 case 'enqueue':{
  const s=c.task;requireThat(s&&validId(s.id)&&text(s.owner,120)&&text(s.title,200),'Invalid task');
  requireThat(['work','release','content'].includes(s.kind),'Unsupported automated work type');
  const allowed=['id','owner','kind','title','dependencies','maxAttempts','maxTotalAttempts','deadline','dedupeKey','retrySafe','resource'];
  requireThat(Object.keys(s).every(k=>allowed.includes(k)),'Only sanitized task metadata is permitted');
  requireThat((s.dependencies??[]).every(id=>id!==s.id&&q.tasks[id]),'Dependencies must already exist');
  requireThat(!s.deadline||Number.isFinite(Date.parse(s.deadline)),'Invalid deadline');
  requireThat(!s.maxAttempts||(Number.isInteger(s.maxAttempts)&&s.maxAttempts>=1&&s.maxAttempts<=5),'Invalid retry limit');
  requireThat(s.maxTotalAttempts===undefined||(Number.isInteger(s.maxTotalAttempts)&&s.maxTotalAttempts>=(s.maxAttempts??3)&&s.maxTotalAttempts<=20),'Invalid total acquisition limit');
  requireThat(!s.retrySafe||s.kind==='work','Only explicitly safe work may retry after an unknown expired outcome');
  requireThat(s.resource===undefined||s.resource===null||validId(s.resource),'Invalid resource');
  const specification={id:s.id,owner:s.owner,kind:s.kind,title:s.title,dependencies:s.dependencies??[],maxAttempts:s.maxAttempts??3,maxTotalAttempts:s.maxTotalAttempts??12,deadline:s.deadline??null,dedupeKey:s.dedupeKey??s.id,retrySafe:s.retrySafe===true,resource:s.resource??null};
  const existing=q.tasks[s.id]??Object.values(q.tasks).find(t=>t.specification.dedupeKey===specification.dedupeKey);
  if(existing){requireThat(stable(existing.specification)===stable(specification),'Task ID/dedupe key collision');result={taskId:existing.id,existing:true};break;}
  q.tasks[s.id]={...copy(specification),specification,status:'ready',attempts:0,totalAttempts:0,generation:0,lease:null,retryAt:null,createdAt:iso(now),updatedAt:iso(now),evidence:null,pendingReceipt:null};result={taskId:s.id};break;
 }
 case 'claim':{
  const t=q.tasks[c.taskId];requireThat(t,'Unknown task');requireThat(['ready','retry_wait'].includes(t.status),'Task is not claimable');
  requireThat(t.dependencies.every(id=>q.tasks[id]?.status==='done'),'Dependencies are incomplete');
  requireThat(!t.retryAt||Date.parse(t.retryAt)<=now,'Retry backoff is active');
  requireThat(t.attempts<t.maxAttempts,'Retry limit reached');availableResource(q,t);result=acquire(t,c,now);break;
 }
 case 'heartbeat':{
  const t=lease(q,c,now),ms=c.leaseMs??900000;requireThat(Number.isInteger(ms)&&ms>=1000&&ms<=1800000,'Invalid lease extension');
  t.lease.heartbeatAt=iso(now);t.lease.expiresAt=iso(now+ms);break;
 }
 case 'handoff':{
  const t=lease(q,c,now);requireThat(text(c.to,120)&&c.to!==t.owner&&text(c.summary,500),'Invalid handoff');requireThat(t.totalAttempts<t.maxTotalAttempts,'Total acquisition limit reached; record blocked work');
  const e=evidence(c.evidence,'work'),id=t.id+':'+t.generation+':handoff';
  q.receipts[id]={id,taskId:t.id,from:t.owner,to:c.to,summary:c.summary,evidence:e,createdAt:iso(now),ackDueAt:iso(now+3600000),acceptedAt:null,acceptedBy:null};
  t.pendingReceipt=id;t.status='awaiting_ack';t.lease=null;result={receiptId:id};break;
 }
 case 'accept':{
  const t=q.tasks[c.taskId],r=q.receipts[c.receiptId];requireThat(t&&r&&t.status==='awaiting_ack'&&t.pendingReceipt===r.id&&r.taskId===t.id&&!r.acceptedAt&&r.to===c.worker,'Handoff cannot be accepted');
  t.owner=r.to;t.attempts=0;result=acquire(t,c,now);r.acceptedAt=iso(now);r.acceptedBy={worker:c.worker,runId:c.runId};break;
 }
 case 'complete':{
  const t=lease(q,c,now);t.evidence=evidence(c.evidence,t.kind);t.status='done';t.completedAt=iso(now);t.lease=null;break;
 }
 case 'fail':{
  const t=lease(q,c,now);requireThat(text(c.reason),'Failure reason required');defer(t,now,c.reason,c.retryable===true);break;
 }
 case 'block':{
  const t=lease(q,c,now);requireThat(text(c.reason),'Block reason required');t.status=c.approvalRequired?'needs_approval':'blocked';t.reason=c.reason;t.lease=null;t.retryAt=null;break;
 }
 case 'resume':{
  const t=q.tasks[c.taskId];requireThat(c.worker==='supervisor'&&t?.status==='blocked'&&text(c.resolution),'Only supervisor may resume resolved non-approval blockers');
  // A supervisor may queue a fresh bounded attempt only after recording new evidence.
  requireThat(c.resolution!==t.reason,'New resolution evidence required');t.status='ready';t.reason=null;t.attempts=0;t.retryAt=null;t.resolution=resolutionMetadata({summary:c.resolution,refs:c.refs,at:iso(now)});break;
 }
 case 'retire':{
  const t=q.tasks[c.taskId];requireThat(c.worker==='supervisor'&&t&&['blocked','needs_approval','ready','retry_wait'].includes(t.status)&&text(c.resolution),'Only supervisor may retire inactive work with resolution evidence');
  if(t.status==='needs_approval'||c.humanDecision!==undefined)humanDecision(c.humanDecision);
  const retirement=resolutionMetadata({at:iso(now),refs:c.refs,humanDecision:c.humanDecision??null},true);
  boundedMetadata({summary:c.resolution,...retirement},'Evidence is metadata, not raw notes');
  t.status='cancelled';t.reason=c.resolution;t.retryAt=null;t.lease=null;t.retirement=retirement;break;
 }
 case 'worker_tick':{
  requireThat(validId(c.worker)&&validId(c.runId),'Worker identity required');
  requireThat(c.expectedEveryMs===undefined||(Number.isInteger(c.expectedEveryMs)&&c.expectedEveryMs>=3600000),'Expected polling cadence must be at least hourly');
  q.workers[c.worker]={at:iso(now),runId:c.runId,expectedEveryMs:c.expectedEveryMs??null,graceMs:3600000};break;
 }
 case 'sweep':{
  for(const t of Object.values(q.tasks))if(t.status==='leased'&&Date.parse(t.lease.expiresAt)<=now)defer(t,now,'Lease expired; verify any external effect before resuming',t.retrySafe===true);
  result={issues:inspectQueue(q,now)};break;
 }
 case 'scan':{
  const issues=inspectQueue(q,now),current=new Set(issues.map(x=>x.key)),notify=[];
  for(const i of issues){if(q.alerts[i.key]?.fingerprint!==i.fingerprint)notify.push(i);q.alerts[i.key]={...i,observedAt:iso(now)};}
  for(const key of Object.keys(q.alerts))if(!current.has(key))delete q.alerts[key];
  result={notify,issues};break;
 }
 default:throw new Error('Unknown command');
 }
 if(c.taskId&&q.tasks[c.taskId])q.tasks[c.taskId].updatedAt=iso(now);
 q.revision++;q.updatedAt=iso(now);q.operations[c.opId]={fingerprint,result:copy(result),at:iso(now)};
 return {queue:validateQueue(q),result};
}

// CAS backend is injected. For Git: read exact ref; commit with that single parent;
// update the ref with force=false. A sibling commit must fail fast-forward checks.
export async function transact(store,command,now=()=>Date.now(),{maxRetries=5}={}){
 for(let n=0;n<maxRetries;n++){
  const {queue,revision}=await store.read();
  const at=typeof now==='function'?now():now;
  const outcome=applyCommand(queue,command,at);
  if(outcome.queue.revision===queue.revision)return outcome;
  const beforeCas=typeof now==='function'?now():now;
  const commands=command.type==='batch'?command.commands:[command];
  for(const part of commands){
   const existing=part.taskId&&queue.tasks[part.taskId]?.lease;
   if(existing&&existing.token===part.token)requireThat(Date.parse(existing.expiresAt)>beforeCas,'Lease expired before CAS; reconcile before retry');
   const acquired=part.taskId&&outcome.queue.tasks[part.taskId]?.lease;
   if(acquired)requireThat(Date.parse(acquired.expiresAt)>beforeCas,'New lease expired before CAS');
  }
  if(await store.compareAndSwap(revision,outcome.queue))return outcome;
 }
 throw new Error('Queue contention; checkpoint and retry later with the SAME opId');
}
