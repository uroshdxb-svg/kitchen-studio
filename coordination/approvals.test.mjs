import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyQueue,applyCommand,transact,assertApprovedAction,validateQueue,inspectQueue} from './queue.mjs';
const NOW=Date.parse('2026-10-18T12:00:00Z'),scope={action:'merge_pull_request',target:'example/repo#17',revision:'a'.repeat(40)};
const step=(q,c,at=NOW,authorizeApproval=()=>true)=>applyCommand(q,c,at,{authorizeApproval});
const clone=x=>structuredClone(x);
function bound(id='one',overrides={}){
 let q=step(emptyQueue(),{opId:'enqueue-'+id,type:'enqueue',task:{id,owner:'catalog',kind:'release',title:'Exact approved release',resource:'catalogue-writer',...overrides}}).queue;
 const lease=step(q,{opId:'claim-'+id,type:'claim',taskId:id,worker:'catalog',runId:'prepare',leaseMs:30_000});
 q=step(lease.queue,{opId:'hold-'+id,type:'block',taskId:id,worker:'catalog',runId:'prepare',...lease.result,reason:'Explicit decision needed',approvalRequired:true}).queue;
 const requested=step(q,{opId:'request-'+id,type:'request_approval',taskId:id,worker:'supervisor',expectedGeneration:q.tasks[id].generation,expectedUpdatedAt:q.tasks[id].updatedAt,scope},NOW+10);
 return {queue:requested.queue,request:requested.result.request};
}
const decision=r=>({id:'human-approval-'+r.id,decision:'approved',reference:'trusted-surface:human-message-17',requestId:r.id,scope:clone(r.scope),taskHash:r.taskHash,generation:r.generation,issuedAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+60_000).toISOString()});
const resume=(r,extra={})=>({opId:'resume-'+r.id,type:'resume_approved',taskId:'one',worker:'supervisor',approval:decision(r),...extra});
const claim=(run='release')=>({opId:'claim-'+run,type:'claim',taskId:'one',worker:'catalog',runId:run,leaseMs:30_000,approvalScope:clone(scope)});
function memoryStore(initial,{race=false,lost=false}={}){
 let queue=clone(initial),revision=0,reads=0,release;
 const gate=new Promise(r=>release=r),writes=[];
 return {writes,get queue(){return clone(queue);},async read(){const snapshot={queue:clone(queue),revision};if(race&&++reads<=2){if(reads===2)release();await gate;}return snapshot;},async compareAndSwap(expected,next){if(expected!==revision)return false;queue=clone(next);revision++;writes.push(clone(next));if(lost){lost=false;throw Error('lost response');}return true;}};
}
test('legacy approval hold resumes the same task, preserving owner, limits and history',()=>{
 const {queue,request}=bound(),before=clone(queue),result=step(queue,resume(request),NOW+20);
 assert.deepEqual(queue,before);
 const t=result.queue.tasks.one;
 assert.equal(t.id,'one');assert.equal(t.status,'ready');assert.equal(t.owner,'catalog');assert.equal(t.resource,'catalogue-writer');
 assert.equal(t.attempts,1);assert.equal(t.totalAttempts,1);assert.equal(t.generation,1);
 assert.equal(Object.keys(result.queue.tasks).length,1);assert.equal(t.retirement,undefined);
 assert.deepEqual(t.approvalRequests,[request]);assert.equal(t.approvalHistory[0].reference,'trusted-surface:human-message-17');
 const lease=step(result.queue,claim(),NOW+30);
 assert.equal(lease.queue.tasks.one.generation,2);assert.equal(lease.queue.tasks.one.totalAttempts,2);
 assert.equal(assertApprovedAction(lease.queue,{...claim(),...lease.result},NOW+40).scope.revision,scope.revision);
});
test('approval provenance fails closed without a trusted host, including CLI-style direct apply',async()=>{
 const {queue,request}=bound(),c=resume(request),before=clone(queue);
 assert.throws(()=>applyCommand(queue,c,NOW+20),/Trusted host/);
 assert.throws(()=>step(queue,c,NOW+20,()=>Promise.resolve(true)),/Trusted host/);
 for(const verifier of [undefined,()=>false,()=>({approved:true})]){
  const store=memoryStore(queue);await assert.rejects(transact(store,c,NOW+20,{authorizeApproval:verifier}),/Trusted host/);assert.equal(store.writes.length,0);
 }
 assert.deepEqual(queue,before);
});
test('wrong action, target, head, hold, generation, dates and unbounded receipts cannot resume',()=>{
 const {queue,request}=bound(),before=clone(queue);
 const mutations=[a=>a.scope.action='publish',a=>a.scope.target='example/repo#18',a=>a.scope.revision='b'.repeat(40),a=>a.requestId='other',a=>a.generation++,a=>a.taskHash='b'.repeat(64),a=>a.issuedAt=new Date(NOW-1).toISOString(),a=>a.issuedAt=new Date(NOW+1000).toISOString(),a=>a.expiresAt=new Date(NOW+20).toISOString(),a=>a.expiresAt=new Date(NOW+86_400_001).toISOString(),a=>a.reference='x'.repeat(501),a=>a.rawNotes='not permitted',a=>a.decision='declined'];
 for(const mutate of mutations){const c=resume(request);mutate(c.approval);assert.throws(()=>step(queue,c,NOW+20));assert.deepEqual(queue,before);}
 const tampered=clone(queue);tampered.tasks.one.owner='other';assert.throws(()=>step(tampered,resume(request),NOW+20),/scope\/head\/hold/);
});
test('request binding is immutable and repeated requests return the recorded request without a new hold',()=>{
 const {queue,request}=bound();const c={opId:'request-again',type:'request_approval',taskId:'one',worker:'supervisor',expectedGeneration:1,expectedUpdatedAt:queue.tasks.one.updatedAt,scope};
 const again=step(queue,c,NOW+20);assert.equal(again.result.request.id,request.id);assert.equal(again.queue.tasks.one.approvalRequests.length,1);
 assert.throws(()=>step(queue,{...c,expectedGeneration:0},NOW+20),/Stale/);
 assert.throws(()=>step(queue,{...c,scope:{...scope,revision:'b'.repeat(40)}},NOW+20),/already bound/);
 const ready=step(queue,resume(request),NOW+20).queue;
 const seen=step(ready,{...c,expectedUpdatedAt:ready.tasks.one.updatedAt},NOW+30);assert.equal(seen.result.alreadyApproved,true);assert.equal(seen.queue.tasks.one.status,'ready');
});
test('duplicate resumes acknowledge history and never revive an uncertain external effect',()=>{
 const {queue,request}=bound(),c=resume(request),ready=step(queue,c,NOW+20);
 assert.deepEqual(step(ready.queue,c,NOW+30).queue,ready.queue);
 const leased=step(ready.queue,claim(),NOW+30),fence={taskId:'one',worker:'catalog',runId:'release',...leased.result};
 const blocked=step(leased.queue,{opId:'uncertain-effect',type:'block',...fence,reason:'Merge response unknown; reconcile'},NOW+40).queue;
 const duplicate=step(blocked,{...c,opId:'ack-existing-decision'},NOW+50);
 assert.equal(duplicate.result.alreadyApplied,true);assert.equal(duplicate.result.status,'blocked');assert.equal(duplicate.queue.tasks.one.status,'blocked');
 assert.throws(()=>assertApprovedAction(duplicate.queue,{...fence,approvalScope:scope},NOW+50),/fence/);
 const resolved=step(blocked,{opId:'resolve',type:'resume',taskId:'one',worker:'supervisor',resolution:'Read back actual external outcome',refs:['https://example.test/receipt']},NOW+50).queue;
 assert.throws(()=>step(resolved,claim('another'),NOW+60),/Consumed approval/);
 assert.throws(()=>step(blocked,{...c,opId:'changed-decision',approval:{...c.approval,reference:'other'}},NOW+50),/ID reused/);
});
test('claim and action checks reject wrong heads, stale fences and expiry; renewals cannot extend approval',()=>{
 const {queue,request}=bound(),ready=step(queue,resume(request),NOW+20).queue;
 assert.throws(()=>step(ready,{...claim(),approvalScope:{...scope,revision:'b'.repeat(40)}},NOW+30),/approved action\/head/);
 assert.throws(()=>step(ready,claim(),NOW+60_000),/expired/);
 const leased=step(ready,{...claim(),leaseMs:120_000},NOW+30),t=leased.queue.tasks.one;
 assert.equal(t.lease.expiresAt,new Date(NOW+60_000).toISOString());
 const fence={taskId:'one',worker:'catalog',runId:'release',...leased.result,approvalScope:scope};
 assert.throws(()=>assertApprovedAction(leased.queue,{...fence,approvalScope:{...scope,revision:'b'.repeat(40)}},NOW+40),/changed or expired/);
 assert.throws(()=>assertApprovedAction(leased.queue,{...fence,generation:1},NOW+40),/fence/);
 const renewed=step(leased.queue,{opId:'renew',type:'heartbeat',...fence,leaseMs:120_000},NOW+40).queue;
 assert.equal(renewed.tasks.one.lease.expiresAt,t.lease.expiresAt);
 assert.throws(()=>assertApprovedAction(renewed,fence,NOW+60_000),/expired/);
});
test('approval cannot reset an exhausted budget or resume a non-approval blocker',()=>{
 const {queue,request}=bound();
 for(const change of [t=>{t.status='blocked';},t=>{t.attempts=t.maxAttempts;},t=>{t.totalAttempts=t.maxTotalAttempts;}]){
  const q=clone(queue);change(q.tasks.one);assert.throws(()=>step(q,resume(request),NOW+20));
 }
});

test('same-resource competitors cannot bypass an approved pending claim; expiry remains visible',()=>{
 const {queue,request}=bound(),ready=step(queue,resume(request),NOW+20).queue;
 const added=step(ready,{opId:'enqueue-two',type:'enqueue',task:{id:'two',owner:'catalog',kind:'release',title:'Other release',resource:'catalogue-writer'}},NOW+30).queue;
 assert.throws(()=>step(added,{...claim('other'),taskId:'two'},NOW+40),/Exclusive resource/);
 assert.equal(inspectQueue(added,NOW+60_000).find(x=>x.key==='approval:one')?.severity,'approval');
 assert.throws(()=>step(added,{...claim('other-later'),taskId:'two'},NOW+60_000),/Exclusive resource/);
});
test('concurrent approved resume/claim batches persist one owner and one decision',async()=>{
 const {queue,request}=bound(),store=memoryStore(queue,{race:true});
 const command=run=>({opId:'batch-'+run,type:'batch',commands:[resume(request),claim(run)]});
 const results=await Promise.allSettled(['a','b'].map(run=>transact(store,command(run),NOW+20,{authorizeApproval:async()=>true})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(store.writes.length,1);
 assert.equal(store.queue.tasks.one.approvalHistory.length,1);assert.equal(store.queue.tasks.one.totalAttempts,2);
});
test('lost approved-claim response replays the same receipt without a second write or action',async()=>{
 const {queue,request}=bound(),store=memoryStore(queue,{lost:true});
 const c={opId:'approved-batch',type:'batch',commands:[resume(request),claim()]};
 await assert.rejects(transact(store,c,NOW+20,{authorizeApproval:async()=>true}),/lost response/);
 const first=store.queue,again=await transact(store,c,NOW+30);
 assert.deepEqual(again.queue,first);assert.equal(store.writes.length,1);
});
test('approval expiring during trusted verification cannot reach conditional write',async()=>{
 const {queue,request}=bound(),store=memoryStore(queue);let now=NOW+20;
 await assert.rejects(transact(store,resume(request),()=>now,{authorizeApproval:async()=>{now=NOW+60_000;return true;}}),/expired before CAS/);
 assert.equal(store.writes.length,0);
});

test('task deadlines also bound approval resumption, claims and lease renewals',()=>{
 const {queue,request}=bound('one',{deadline:new Date(NOW+50_000).toISOString()});
 assert.throws(()=>step(queue,resume(request),NOW+50_000),/deadline expired/);
 const ready=step(queue,resume(request),NOW+20).queue;
 assert.throws(()=>step(ready,claim(),NOW+50_000),/deadline expired/);
 const leased=step(ready,{...claim(),leaseMs:120_000},NOW+30);
 assert.equal(leased.queue.tasks.one.lease.expiresAt,new Date(NOW+50_000).toISOString());
 const renewed=step(leased.queue,{opId:'deadline-renew',type:'heartbeat',taskId:'one',worker:'catalog',runId:'release',...leased.result,approvalScope:scope,leaseMs:120_000},NOW+40);
 assert.equal(renewed.queue.tasks.one.lease.expiresAt,new Date(NOW+50_000).toISOString());
});

test('a later reconciled attempt needs a new hold and new exact decision, retaining both histories',()=>{
 const first=bound(),ready=step(first.queue,resume(first.request),NOW+20),leased=step(ready.queue,claim(),NOW+30);
 const blocked=step(leased.queue,{opId:'later-hold',type:'block',taskId:'one',worker:'catalog',runId:'release',...leased.result,reason:'Another exact decision required after reconciliation',approvalRequired:true},NOW+40).queue;
 const requested=step(blocked,{opId:'request-later',type:'request_approval',taskId:'one',worker:'supervisor',expectedGeneration:2,expectedUpdatedAt:blocked.tasks.one.updatedAt,scope},NOW+50);
 const a={...decision(requested.result.request),reference:'trusted-surface:new-human-message',issuedAt:new Date(NOW+40).toISOString()};
 const resumed=step(requested.queue,resume(requested.result.request,{approval:a}),NOW+60);
 assert.equal(resumed.queue.tasks.one.approvalHistory.length,2);assert.equal(resumed.queue.tasks.one.approvalRequests.length,2);
 assert.equal(resumed.queue.tasks.one.totalAttempts,2);assert.equal(resumed.queue.tasks.one.attempts,2);
 const next=step(resumed.queue,claim('new-approved-attempt'),NOW+70);assert.equal(next.queue.tasks.one.generation,3);
});

test('a consumed approval in retry backoff can request a reconciled fresh decision without skipping backoff',()=>{
 const first=bound(),ready=step(first.queue,resume(first.request),NOW+20),leased=step(ready.queue,claim(),NOW+30);
 const failed=step(leased.queue,{opId:'safe-failure',type:'fail',taskId:'one',worker:'catalog',runId:'release',...leased.result,reason:'Confirmed action not invoked',retryable:true},NOW+40).queue;
 assert.equal(failed.tasks.one.status,'retry_wait');const retryAt=failed.tasks.one.retryAt;
 const requestCommand={opId:'retry-approval-request',type:'request_approval',taskId:'one',worker:'supervisor',expectedGeneration:2,expectedUpdatedAt:failed.tasks.one.updatedAt,scope};
 for(const extra of [{},{resolution:'Confirmed action not invoked',refs:['https://example.test/receipt']},{resolution:'External outcome reconciled',refs:[{}]}]){
  assert.throws(()=>step(failed,{...requestCommand,...extra},NOW+50));
 }
 const requested=step(failed,{...requestCommand,resolution:'External outcome read back; no merge occurred',refs:['https://example.test/no-merge-receipt']},NOW+50);
 assert.equal(requested.result.request.retryNotBefore,retryAt);assert.equal(requested.queue.tasks.one.retryAt,retryAt);
 assert.equal(requested.result.request.reconciliation.summary,'External outcome read back; no merge occurred');
 const a={...decision(requested.result.request),reference:'trusted-surface:new-retry-decision',issuedAt:new Date(NOW+50).toISOString(),expiresAt:new Date(NOW+180_000).toISOString()};
 const resumed=step(requested.queue,resume(requested.result.request,{approval:a}),NOW+60);
 assert.equal(resumed.result.status,'retry_wait');assert.equal(resumed.queue.tasks.one.retryAt,retryAt);
 assert.equal(resumed.queue.tasks.one.attempts,2);assert.equal(resumed.queue.tasks.one.totalAttempts,2);assert.equal(resumed.queue.tasks.one.approvalHistory.length,2);
 assert.throws(()=>step(resumed.queue,claim('too-early'),NOW+70),/backoff/);
 const next=step(resumed.queue,claim('after-backoff'),Date.parse(retryAt)+1);
 assert.equal(next.queue.tasks.one.totalAttempts,3);assert.equal(next.queue.tasks.one.generation,3);
 assert.equal(assertApprovedAction(next.queue,{...claim('after-backoff'),...next.result},Date.parse(retryAt)+2).id,a.id);
});

test('backoff expiry is still visible and persisted reconciliation cannot be malformed',()=>{
 const first=bound(),ready=step(first.queue,resume(first.request),NOW+20),leased=step(ready.queue,claim(),NOW+30);
 const failed=step(leased.queue,{opId:'backoff-failure',type:'fail',taskId:'one',worker:'catalog',runId:'release',...leased.result,reason:'Confirmed safe retry',retryable:true},NOW+40).queue;
 const requested=step(failed,{opId:'backoff-request',type:'request_approval',taskId:'one',worker:'supervisor',expectedGeneration:2,expectedUpdatedAt:failed.tasks.one.updatedAt,scope,resolution:'Confirmed external state via receipt',refs:['https://example.test/receipt']},NOW+50);
 const a={...decision(requested.result.request),issuedAt:new Date(NOW+50).toISOString()};
 const resumed=step(requested.queue,resume(requested.result.request,{approval:a}),NOW+60).queue;
 assert.equal(inspectQueue(resumed,NOW+60_000).find(x=>x.key==='approval:one')?.severity,'approval');
 assert.throws(()=>step(resumed,claim('expired-backoff'),Date.parse(resumed.tasks.one.retryAt)+1),/expired/);
 for(const mutate of [r=>r.retryNotBefore='invalid',r=>r.reconciliation.refs=[{}],r=>r.reconciliation.rawNotes='private',r=>delete r.reconciliation]){
  const q=clone(requested.queue);mutate(q.tasks.one.approvalRequests.at(-1));assert.throws(()=>validateQueue(q));
 }
});

test('expired approved safe work can reconcile without replaying the old lease or bypassing backoff',()=>{
 const first=bound('one',{kind:'work',retrySafe:true}),ready=step(first.queue,resume(first.request),NOW+20),leased=step(ready.queue,claim(),NOW+30);
 const swept=step(leased.queue,{opId:'sweep-approved-expiry',type:'sweep'},NOW+31_000).queue;
 assert.equal(swept.tasks.one.status,'retry_wait');const retryAt=swept.tasks.one.retryAt;
 const requested=step(swept,{opId:'expired-work-decision',type:'request_approval',taskId:'one',worker:'supervisor',expectedGeneration:2,expectedUpdatedAt:swept.tasks.one.updatedAt,scope,resolution:'Expired worker effect reconciled through actual service receipt',refs:['https://example.test/reconciled-service-receipt']},NOW+31_010);
 const a={...decision(requested.result.request),issuedAt:new Date(NOW+31_010).toISOString(),expiresAt:new Date(NOW+180_000).toISOString()};
 const resumed=step(requested.queue,resume(requested.result.request,{approval:a}),NOW+31_020).queue;
 assert.throws(()=>step(resumed,claim('premature-expired-retry'),NOW+31_030),/backoff/);
 assert.throws(()=>assertApprovedAction(resumed,{...claim(),...leased.result},NOW+31_030),/fence/);
 const next=step(resumed,claim('reconciled-expiry'),Date.parse(retryAt)+1);
 assert.equal(next.queue.tasks.one.generation,3);assert.equal(next.queue.tasks.one.totalAttempts,3);
 assert.equal(next.queue.tasks.one.approvalHistory.length,2);assert.equal(next.queue.tasks.one.approvalRequests.at(-1).retryNotBefore,retryAt);
});
test('handoff acknowledgement retains approval history but cannot transfer action authority',()=>{
 const {queue,request}=bound(),ready=step(queue,resume(request),NOW+20),leased=step(ready.queue,claim(),NOW+30);
 const fence={taskId:'one',worker:'catalog',runId:'release',...leased.result};
 const sent=step(leased.queue,{opId:'handoff',type:'handoff',...fence,to:'reviewer',summary:'Verify actual production',evidence:{outcome:'pass',refs:['https://example.test/commit']}},NOW+40);
 const accepted=step(sent.queue,{opId:'ack',type:'accept',taskId:'one',receiptId:sent.result.receiptId,worker:'reviewer',runId:'review',leaseMs:10_000},NOW+50);
 assert.equal(accepted.queue.tasks.one.owner,'reviewer');assert.equal(accepted.queue.tasks.one.approvalHistory.length,1);
 assert.equal(accepted.queue.tasks.one.approvalGrant,undefined,'review handoff archives, rather than transfers, action authority');
 assert.throws(()=>assertApprovedAction(accepted.queue,{taskId:'one',worker:'reviewer',runId:'review',...accepted.result,approvalScope:scope},NOW+60),/No approval bound/);
});
test('persisted approval metadata rejects corruption and cross-task receipt reuse',()=>{
 const {queue,request}=bound(),ready=step(queue,resume(request),NOW+20).queue;
 for(const mutate of [t=>t.approvalHistory[0].scope.revision='b'.repeat(40),t=>t.approvalRequests[0].rawNotes='private',t=>t.approvalGrant.approvalId='missing',t=>t.approvalGrant.claimedGeneration=999,t=>t.approvalHistory[0].reference={}]){
  const q=clone(ready);mutate(q.tasks.one);assert.throws(()=>validateQueue(q));
 }
 const other=bound('two'),q=clone(ready);q.tasks.two=other.queue.tasks.two;
 assert.throws(()=>step(q,{...resume(other.request),taskId:'two',approval:{...decision(other.request),id:ready.tasks.one.approvalHistory[0].id}},NOW+30),/ID reused/);
});
