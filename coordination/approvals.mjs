// Approval metadata is not human authorization. The host must verify provenance
// through its trusted approval surface; forwarded text alone is not a verifier.
import {createHash} from 'node:crypto';
const copy=x=>structuredClone(x);
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const digest=x=>createHash('sha256').update(stable(x)).digest('hex');
const need=(v,m)=>{if(!v)throw new Error(m);};
const text=(x,max=500)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const id=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(x);
const date=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const keys=(x,allowed)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).every(k=>allowed.includes(k));
const iso=n=>new Date(n).toISOString();
const DAY=86_400_000;
export const taskApprovalHash=t=>digest({specification:t.specification,id:t.id,owner:t.owner,kind:t.kind,dependencies:t.dependencies,resource:t.resource,maxAttempts:t.maxAttempts,maxTotalAttempts:t.maxTotalAttempts,deadline:t.deadline,retrySafe:t.retrySafe});
function scope(s){
 need(keys(s,['action','target','revision'])&&id(s.action)&&text(s.target,300)&&/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(s.revision??''),'Exact approval action, target and immutable revision required');
 return copy(s);
}
function request(r){
 need(keys(r,['id','scope','taskHash','generation','heldAt','requestedAt'])&&id(r.id)&&/^[a-f0-9]{64}$/.test(r.taskHash??'')&&Number.isInteger(r.generation)&&r.generation>=0&&date(r.heldAt)&&date(r.requestedAt)&&Date.parse(r.heldAt)<=Date.parse(r.requestedAt),'Corrupt approval request');scope(r.scope);
}
function approval(a,persisted=false){
 const allowed=['id','decision','reference','requestId','scope','taskHash','generation','issuedAt','expiresAt',...(persisted?['recordedAt']:[])];
 need(keys(a,allowed)&&id(a.id)&&a.decision==='approved'&&text(a.reference)&&id(a.requestId)&&/^[a-f0-9]{64}$/.test(a.taskHash??'')&&Number.isInteger(a.generation)&&a.generation>=0&&date(a.issuedAt)&&date(a.expiresAt),'Scoped human approval receipt required');scope(a.scope);
 need(Date.parse(a.expiresAt)>Date.parse(a.issuedAt)&&Date.parse(a.expiresAt)-Date.parse(a.issuedAt)<=DAY,'Approval validity must be positive and at most 24 hours');
 if(persisted)need(date(a.recordedAt)&&Date.parse(a.issuedAt)<=Date.parse(a.recordedAt)&&Date.parse(a.recordedAt)<Date.parse(a.expiresAt),'Corrupt approval recording time');
}
export function validateApprovalState(t){
 for(const [name,check] of [['approvalRequests',request],['approvalHistory',a=>approval(a,true)]]){
  if(t[name]===undefined)continue;
  need(Array.isArray(t[name])&&new Set(t[name].map(x=>x?.id)).size===t[name].length,'Corrupt approval history');
  for(const entry of t[name]){check(entry);need(stable(entry).length<=10000,'Approval metadata too large');}
 }
 for(const a of t.approvalHistory??[]){
  const r=t.approvalRequests?.find(r=>r.id===a.requestId);need(r&&a.taskHash===r.taskHash&&a.generation===r.generation&&stable(a.scope)===stable(r.scope)&&Date.parse(a.issuedAt)>=Date.parse(r.heldAt),'Corrupt approval binding');
 }
 if(t.approvalGrant!==undefined){
  const g=t.approvalGrant;
  const a=t.approvalHistory?.find(a=>a.id===g?.approvalId);
  need(keys(g,['approvalId','claimedGeneration'])&&a&&(g.claimedGeneration===null||(g.claimedGeneration===a.generation+1&&g.claimedGeneration<=t.generation)),'Corrupt approval grant');
 }
}
export function requestApproval(q,c,now){
 const t=q.tasks[c.taskId];
 need(c.worker==='supervisor'&&t&&['ready','needs_approval'].includes(t.status),'Only supervisor may bind inactive approval work');
 need(c.expectedGeneration===t.generation&&c.expectedUpdatedAt===t.updatedAt,'Stale approval hold snapshot');
 const s=scope(c.scope),previous=t.approvalRequests?.at(-1),grant=t.approvalGrant&&t.approvalHistory?.find(a=>a.id===t.approvalGrant.approvalId);
 if(previous&&t.status==='needs_approval'&&previous.generation===t.generation&&!(t.approvalHistory??[]).some(a=>a.requestId===previous.id)){
  need(stable(previous.scope)===stable(s)&&previous.taskHash===taskApprovalHash(t)&&previous.generation===t.generation,'Approval request already bound; reconcile changed scope');
  return {taskId:t.id,request:copy(previous),alreadyRequested:true};
 }
 if(grant&&t.approvalGrant.claimedGeneration===null&&grant.taskHash===taskApprovalHash(t)&&grant.generation===t.generation&&Date.parse(grant.expiresAt)>now&&stable(grant.scope)===stable(s))return {taskId:t.id,approvalId:grant.id,status:t.status,alreadyApproved:true};
 // A legacy needs_approval hold can be bound after its human decision. Issuance
 // must still be after the original hold, not merely after this metadata bind.
 const r={id:c.opId,scope:s,taskHash:taskApprovalHash(t),generation:t.generation,heldAt:t.status==='needs_approval'?t.updatedAt:iso(now),requestedAt:iso(now)};
 request(r);(t.approvalRequests??=[]).push(r);delete t.approvalGrant;
 t.status='needs_approval';t.reason='Awaiting scoped approval: '+s.action;t.retryAt=null;
 return {taskId:t.id,request:copy(r)};
}
export function resumeApproved(q,c,now,authorizeApproval){
 const t=q.tasks[c.taskId];need(c.worker==='supervisor'&&t,'Only supervisor may resume approved work');
 approval(c.approval);const a=c.approval;
 const used=Object.values(q.tasks).flatMap(task=>(task.approvalHistory??[]).map(receipt=>({task,receipt}))).find(x=>x.receipt.id===a.id);
 if(used){
  const {recordedAt,...original}=used.receipt;
  need(used.task.id===t.id&&stable(original)===stable(a),'Approval receipt ID reused with different binding');
  // A duplicate is an acknowledgement, never a second resume or permission to
  // replay an uncertain external effect. Callers must inspect current status.
  return {taskId:t.id,approvalId:a.id,requestId:a.requestId,status:t.status,alreadyApplied:true};
 }
 const r=t.approvalRequests?.at(-1);
 need(t.status==='needs_approval'&&r,'Task needs a bound approval request');
 need(a.requestId===r.id&&a.taskHash===r.taskHash&&a.taskHash===taskApprovalHash(t)&&a.generation===r.generation&&a.generation===t.generation&&stable(a.scope)===stable(r.scope),'Stale or mismatched approval scope/head/hold');
 need(Date.parse(a.issuedAt)>=Date.parse(r.heldAt)&&Date.parse(a.issuedAt)<=now&&Date.parse(a.expiresAt)>now,'Approval is stale, future-dated or expired');
 need(!t.deadline||Date.parse(t.deadline)>now,'Task deadline expired');
 need(t.attempts<t.maxAttempts&&t.totalAttempts<t.maxTotalAttempts,'Approval cannot reset acquisition limits');
 need(typeof authorizeApproval==='function'&&authorizeApproval(copy({taskId:t.id,request:r,approval:a}))===true,'Trusted host approval verifier required; forwarded text is not authorization');
 (t.approvalHistory??=[]).push({...copy(a),recordedAt:iso(now)});
 t.approvalGrant={approvalId:a.id,claimedGeneration:null};t.status='ready';t.reason=null;t.retryAt=null;
 return {taskId:t.id,approvalId:a.id,requestId:r.id,status:'ready'};
}
export function approvalForClaim(t,c,now){
 if(!t.approvalGrant)return null;
 need(t.approvalGrant.claimedGeneration===null,'Consumed approval cannot authorize another attempt');
 const a=t.approvalHistory.find(a=>a.id===t.approvalGrant.approvalId);
 need(a.taskHash===taskApprovalHash(t)&&a.generation===t.generation&&stable(scope(c.approvalScope))===stable(a.scope),'Claim must match approved action/head');
 need(Date.parse(a.expiresAt)>now+1000,'Approval expired before claim');return a;
}
export function assertApprovalAction(t,actionScope,now){
 need(t.approvalGrant?.claimedGeneration===t.generation,'No approval bound to this lease generation');
 const a=t.approvalHistory.find(a=>a.id===t.approvalGrant.approvalId);
 need(a.taskHash===taskApprovalHash(t)&&stable(scope(actionScope))===stable(a.scope)&&Date.parse(a.expiresAt)>now&&(!t.deadline||Date.parse(t.deadline)>now),'Approval action/head changed or expired');return copy(a);
}
