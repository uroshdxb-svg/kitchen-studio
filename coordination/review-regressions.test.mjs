import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyQueue,applyCommand,inspectQueue,validateQueue} from './queue.mjs';

const NOW=Date.parse('2026-10-15T12:00:00Z'),HOUR=3_600_000;
const clone=value=>structuredClone(value);
const refs=['https://example.test/public-evidence'];
const step=(q,c,at=NOW)=>applyCommand(q,c,at).queue;
const workerIssues=(q,at)=>inspectQueue(q,at).filter(x=>x.key==='worker:supervisor');

function blocked(approvalRequired=false){
 let q=step(emptyQueue(),{opId:'enqueue',type:'enqueue',task:{id:'one',owner:'builder',kind:'work',title:'Sanitized task'}});
 const claimed=applyCommand(q,{opId:'claim',type:'claim',taskId:'one',worker:'builder',runId:'run-1',leaseMs:60_000},NOW);
 return step(claimed.queue,{opId:'block',type:'block',taskId:'one',worker:'builder',runId:'run-1',...claimed.result,reason:'Upstream unavailable',approvalRequired});
}
const resolution=(type='resume')=>({opId:type,type,taskId:'one',worker:'supervisor',resolution:'Upstream reconciled with public evidence',refs});

test('never-started expected workers become overdue only after fixed startup cadence and grace',()=>{
 const q=step(emptyQueue(),{opId:'anchor',type:'scan'});
 assert.equal(q.expectationsStartedAt,new Date(NOW).toISOString());
 assert.equal(Object.hasOwn(q.workers,'supervisor'),false);
 assert.equal(workerIssues(q,NOW+2*HOUR).length,0);
 const first=workerIssues(q,NOW+2*HOUR+1);
 assert.equal(first.length,1);
 assert.match(first[0].reason,/never reported/);
 assert.deepEqual(workerIssues(q,NOW+3*HOUR).map(x=>x.fingerprint),first.map(x=>x.fingerprint));
 const later=step(q,{opId:'later-scan',type:'scan'},NOW+3*HOUR);
 assert.equal(later.expectationsStartedAt,q.expectationsStartedAt,'a later scan must not restart the startup clock');
 assert.equal(workerIssues(later,NOW+3*HOUR).length,1);
});

test('explicit firstExpectedAt handles future first runs and cannot be replaced by an unrelated tick',()=>{
 let q=emptyQueue();
 q.expectedWorkers.supervisor.firstExpectedAt=new Date(NOW+4*HOUR).toISOString();
 q=step(q,{opId:'other',type:'worker_tick',worker:'catalog',runId:'catalog-1'});
 assert.equal(workerIssues(q,NOW+5*HOUR).length,0);
 assert.equal(workerIssues(q,NOW+5*HOUR+1).length,1);
 q=step(q,{opId:'supervisor-tick',type:'worker_tick',worker:'supervisor',runId:'watch-1'},NOW+5*HOUR+1);
 assert.equal(workerIssues(q,NOW+5*HOUR+1).length,0);
 assert.equal(workerIssues(q,NOW+7*HOUR+2).length,1);
});

test('legacy schema1 revision5 uses earliest committed operation without rewriting inspection state',()=>{
 let q=step(emptyQueue(),{opId:'first-committed',type:'scan'});
 q=step(q,{opId:'recent-committed',type:'scan'},NOW+3*HOUR);
 q.revision=5;delete q.expectedWorkers;delete q.expectationsStartedAt;
 const snapshot=clone(q);
 assert.equal(workerIssues(q,NOW+3*HOUR).length,1);
 assert.deepEqual(q,snapshot);
 const next=step(q,{opId:'migrate-anchor',type:'scan'},NOW+4*HOUR);
 assert.equal(next.expectationsStartedAt,new Date(NOW).toISOString());
 assert.equal(workerIssues(next,NOW+4*HOUR).length,1);
 assert.ok(next.operations['first-committed']);
 assert.equal(next.revision,6);
});

test('missing startup history remains uninitialized across scans instead of silently healthy',()=>{
 const fresh=emptyQueue(),snapshot=clone(fresh);
 assert.ok(inspectQueue(fresh,NOW).some(x=>x.key==='worker-uninitialized:supervisor'));
 assert.deepEqual(fresh,snapshot);
 const legacy=emptyQueue();legacy.revision=5;legacy.updatedAt=new Date(NOW).toISOString();
 delete legacy.expectedWorkers;delete legacy.expectationsStartedAt;
 const next=step(legacy,{opId:'observe-uninitialized',type:'scan'},NOW+HOUR);
 assert.equal(next.expectationsStartedAt,null,'do not derive a fresh anchor for nonempty legacy state without history');
 assert.ok(inspectQueue(next,NOW+HOUR).some(x=>x.key==='worker-uninitialized:supervisor'));
 assert.ok(next.operations['observe-uninitialized']);
 const later=step(next,{opId:'observe-again',type:'scan'},NOW+3*HOUR);
 assert.equal(later.expectationsStartedAt,null);
 assert.ok(inspectQueue(later,NOW+3*HOUR).some(x=>x.key==='worker-uninitialized:supervisor'));
});

test('corrupt persisted expectation and receipt metadata fails closed',()=>{
 const seed=step(emptyQueue(),{opId:'anchor',type:'scan'});
 for(const corrupt of [
  q=>{q.expectedWorkers=null;},q=>{delete q.expectedWorkers.supervisor;},
  q=>{q.expectedWorkers.supervisor.expectedEveryMs=-1;},
  q=>{q.expectedWorkers.supervisor.graceMs='forever';},
  q=>{q.expectedWorkers.supervisor.firstExpectedAt='not-a-date';},
  q=>{q.expectedWorkers.supervisor.privateNotes='not permitted';},
  q=>{q.expectationsStartedAt='not-a-date';},
  q=>{q.expectationsStartedAt=new Date(NOW+HOUR).toISOString();},
 ]){
  const q=clone(seed);corrupt(q);
  assert.throws(()=>validateQueue(q),/Corrupt/);
  assert.throws(()=>inspectQueue(q,NOW+3*HOUR),/Corrupt/);
 }
});

test('resume and retire reject object, blank, long and over-10KB references without changing state',()=>{
 for(const type of ['resume','retire']){
  const q=blocked(),snapshot=clone(q);
  for(const bad of [undefined,[],[{}],[null],[' '],['x'.repeat(1001)],Array.from({length:11},()=> 'x'.repeat(999))]){
   assert.throws(()=>step(q,{...resolution(type),refs:bad}),/references|metadata|raw notes/);
   assert.deepEqual(q,snapshot);
  }
  const next=step(q,resolution(type));
  assert.equal(next.tasks.one.status,type==='resume'?'ready':'cancelled');
  assert.deepEqual(q,snapshot);
 }
});

test('retirement validates optional human decisions even for work without an approval hold',()=>{
 for(const q of [blocked(),blocked(true)])for(const humanDecision of [
  {decision:'approved',reference:{}},
  {decision:'approved',reference:'x'.repeat(501)},
  {decision:'approved',reference:'Trusted public reference',rawNotes:'not permitted'},
  {decision:'automatic',reference:'Trusted public reference'},
 ]){
  const snapshot=clone(q);
  assert.throws(()=>step(q,{...resolution('retire'),humanDecision}),/Actual human decision/);
  assert.deepEqual(q,snapshot);
 }
 const q=step(blocked(true),{...resolution('retire'),humanDecision:{decision:'declined',reference:'Trusted human decision receipt'}});
 assert.equal(q.tasks.one.status,'cancelled');
 assert.equal(q.tasks.one.completedAt,undefined);
});

test('persisted resolution and retirement records cannot smuggle malformed or unbounded metadata',()=>{
 for(const type of ['resume','retire']){
  const seed=step(blocked(),resolution(type)),field=type==='resume'?'resolution':'retirement';
  for(const corrupt of [
   m=>{m.refs=[{}];},m=>{m.refs=['x'.repeat(1001)];},
   m=>{m.refs=Array.from({length:11},()=> 'x'.repeat(999));},
   m=>{m.at='not-a-date';},m=>{m.rawNotes='not permitted';},
   m=>{if(type==='resume')m.summary={};else m.humanDecision={decision:'approved',reference:{}};},
  ]){
   const q=clone(seed);corrupt(q.tasks.one[field]);
   assert.throws(()=>validateQueue(q),/Corrupt|references|metadata|human decision|raw notes/);
   assert.throws(()=>inspectQueue(q,NOW),/Corrupt|references|metadata|human decision|raw notes/);
  }
 }
});
