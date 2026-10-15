import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyQueue, applyCommand, inspectQueue, validateQueue, transact} from './queue.mjs';

const NOW = Date.parse('2026-10-15T12:00:00Z');
const clone = value => structuredClone(value);
const enqueue = id => ({opId:`enqueue-${id}`, type:'enqueue', task:{id, owner:'builder', kind:'work', title:`Work ${id}`}});
const claim = (id, runId, opId = `claim-${runId}`) => ({opId, type:'claim', taskId:id, worker:'builder', runId, leaseMs:60_000});

function seed(...ids) {
  return ids.reduce((queue,id) => applyCommand(queue,enqueue(id),NOW).queue,emptyQueue());
}

// Models an atomic ref update, with no network, Git, timers, or external APIs.
function memoryStore(initial, {raceFirstReads = false, rejectAll = false, loseFirstResponse = false} = {}) {
  let queue = clone(initial), revision = initial.revision, reads = 0;
  let releaseReads;
  const firstReads = raceFirstReads ? new Promise(resolve => { releaseReads = resolve; }) : null;
  const writes = [];
  return {
    writes,
    get queue() { return clone(queue); },
    get reads() { return reads; },
    async read() {
      const snapshot = {queue:clone(queue), revision};
      reads++;
      if (raceFirstReads && reads <= 2) {
        if (reads === 2) releaseReads();
        await firstReads;
      }
      return snapshot;
    },
    async compareAndSwap(expected, next) {
      const accepted = !rejectAll && expected === revision;
      writes.push({expected, accepted, queue:clone(next)});
      if (!accepted) return false;
      queue = clone(next);
      revision++;
      if (loseFirstResponse) {
        loseFirstResponse = false;
        throw new Error('Response lost after successful atomic write');
      }
      return true;
    },
  };
}

test('competing claims from the same revision persist exactly one owner', async () => {
  const store = memoryStore(seed('one'), {raceFirstReads:true});
  const results = await Promise.allSettled([
    transact(store,claim('one','run-a'),NOW),
    transact(store,claim('one','run-b'),NOW),
  ]);
  const winner = results.find(result => result.status === 'fulfilled');
  const loser = results.find(result => result.status === 'rejected');
  assert.ok(winner && loser, 'one claimant wins and the other is fenced');
  assert.match(loser.reason.message,/not claimable/);
  const task = store.queue.tasks.one;
  assert.equal(task.status,'leased');
  assert.equal(task.generation,1);
  assert.equal(task.attempts,1);
  assert.equal(task.lease.token,winner.value.result.token);
  assert.equal(store.writes.filter(write => write.accepted).length,1);
  assert.equal(store.writes.filter(write => !write.accepted).length,1);
  assert.equal(store.queue.revision,2);
  assert.equal(Object.keys(store.queue.operations).filter(id => id.startsWith('claim-')).length,1);
});

test('concurrent replay of one operation returns the persisted lease to both callers', async () => {
  const store = memoryStore(seed('one'), {raceFirstReads:true});
  const command = claim('one','same-run','same-operation');
  const [first,replayed] = await Promise.all([
    transact(store,command,NOW),transact(store,clone(command),NOW),
  ]);
  assert.deepEqual(first.result,replayed.result);
  assert.deepEqual(first.queue,replayed.queue);
  assert.equal(store.writes.filter(write => write.accepted).length,1);
  assert.equal(store.writes.length,2);
  assert.equal(store.reads,3);
  assert.equal(store.queue.tasks.one.attempts,1);
  assert.equal(store.queue.tasks.one.generation,1);
});

test('a lost successful-write response is recovered with the same opId without a second write', async () => {
  const store = memoryStore(seed('one'), {loseFirstResponse:true});
  const command = claim('one','run-a','uncertain-claim');
  await assert.rejects(transact(store,command,NOW),/Response lost/);
  const persisted = store.queue;
  const recovered = await transact(store,command,NOW + 1);
  assert.equal(recovered.result.token,persisted.tasks.one.lease.token);
  assert.deepEqual(store.queue,persisted);
  assert.equal(store.writes.length,1);
});

test('CAS loser replays against fresh state and preserves an unrelated winning claim', async () => {
  const store = memoryStore(seed('one','two'), {raceFirstReads:true});
  await Promise.all([
    transact(store,claim('one','run-a'),NOW),
    transact(store,claim('two','run-b'),NOW),
  ]);
  assert.equal(store.queue.tasks.one.lease.runId,'run-a');
  assert.equal(store.queue.tasks.two.lease.runId,'run-b');
  assert.equal(store.queue.tasks.one.attempts,1);
  assert.equal(store.queue.tasks.two.attempts,1);
  assert.equal(store.queue.revision,4);
  assert.equal(store.writes.filter(write => write.accepted).length,2);
  assert.equal(store.writes.filter(write => !write.accepted).length,1);
  assert.equal(store.reads,3);
});

test('persistent CAS contention stops at the configured bound and leaves state unchanged', async () => {
  const initial = seed('one');
  const store = memoryStore(initial, {rejectAll:true});
  const command = claim('one','run-a','retry-with-this-id');
  await assert.rejects(transact(store,command,NOW,{maxRetries:3}),/contention.*SAME opId/);
  assert.equal(store.reads,3);
  assert.equal(store.writes.length,3);
  assert.ok(store.writes.every(write => !write.accepted));
  assert.ok(store.writes.every(write => Object.hasOwn(write.queue.operations,command.opId)));
  assert.deepEqual(store.queue,initial);
});

test('reusing a committed operation ID with altered payload cannot reach CAS', async () => {
  const store = memoryStore(seed('one'));
  const command = claim('one','run-a','immutable-operation');
  await transact(store,command,NOW);
  const persisted = store.queue;
  await assert.rejects(transact(store,{...command,runId:'run-b'},NOW),/different command/);
  assert.equal(store.writes.length,1);
  assert.deepEqual(store.queue,persisted);
});

test('competing handoff acknowledgements grant exactly one fresh target lease', async () => {
  const source = applyCommand(seed('one'),claim('one','source'),NOW);
  const handoff = applyCommand(source.queue,{
    opId:'handoff', type:'handoff', taskId:'one', worker:'builder', runId:'source',
    ...source.result, to:'reviewer', summary:'Ready for review',
    evidence:{outcome:'pass',refs:['https://example.test/commit/one']},
  },NOW);
  const store = memoryStore(handoff.queue,{raceFirstReads:true});
  const accept = runId => ({opId:`accept-${runId}`,type:'accept',taskId:'one',worker:'reviewer',runId,receiptId:handoff.result.receiptId,leaseMs:60_000});
  const results = await Promise.allSettled([
    transact(store,accept('review-a'),NOW),transact(store,accept('review-b'),NOW),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length,1);
  assert.equal(results.filter(result => result.status === 'rejected').length,1);
  const task = store.queue.tasks.one;
  assert.equal(task.owner,'reviewer');
  assert.equal(task.generation,source.result.generation + 1);
  assert.equal(task.totalAttempts,2);
  assert.equal(store.queue.receipts[handoff.result.receiptId].acceptedBy.runId,task.lease.runId);
  assert.equal(store.writes.filter(write => write.accepted).length,1);
});

test('racing source completion and handoff cannot both publish transitions', async () => {
  const source = applyCommand(seed('one'),claim('one','source'),NOW);
  const store = memoryStore(source.queue,{raceFirstReads:true});
  const fence = {taskId:'one',worker:'builder',runId:'source',...source.result};
  const proof = {outcome:'pass',refs:['https://example.test/commit/one']};
  const results = await Promise.allSettled([
    transact(store,{opId:'complete-source',type:'complete',...fence,evidence:proof},NOW),
    transact(store,{opId:'handoff-source',type:'handoff',...fence,to:'reviewer',summary:'Ready for review',evidence:proof},NOW),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length,1);
  assert.equal(results.filter(result => result.status === 'rejected').length,1);
  assert.equal(store.writes.filter(write => write.accepted).length,1);
  assert.equal(store.queue.tasks.one.lease,null);
  assert.ok(['done','awaiting_ack'].includes(store.queue.tasks.one.status));
  const acceptedOps = ['complete-source','handoff-source'].filter(id => Object.hasOwn(store.queue.operations,id));
  assert.equal(acceptedOps.length,1);
  assert.equal(Object.keys(store.queue.receipts).length,store.queue.tasks.one.status === 'awaiting_ack' ? 1 : 0);
});

test('distinct tasks racing for one resource persist only one lease', async () => {
  let queue = emptyQueue();
  for (const id of ['one','two']) {
    const command = enqueue(id);
    command.task.resource = 'catalogue-writer';
    queue = applyCommand(queue,command,NOW).queue;
  }
  const store = memoryStore(queue,{raceFirstReads:true});
  const results = await Promise.allSettled([
    transact(store,claim('one','run-a'),NOW),transact(store,claim('two','run-b'),NOW),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length,1);
  const loser = results.find(result => result.status === 'rejected');
  assert.match(loser.reason.message,/Exclusive resource/);
  assert.equal(Object.values(store.queue.tasks).filter(task => task.status === 'leased').length,1);
  assert.equal(Object.values(store.queue.tasks).filter(task => task.status === 'ready').length,1);
  assert.equal(store.writes.filter(write => write.accepted).length,1);
});

test('malformed handoff deadlines, worker receipts, and operation receipts fail closed', () => {
  const source = applyCommand(seed('one'),claim('one','source'),NOW);
  const handoff = applyCommand(source.queue,{
    opId:'handoff',type:'handoff',taskId:'one',worker:'builder',runId:'source',...source.result,
    to:'reviewer',summary:'Ready for review',evidence:{outcome:'pass',refs:['https://example.test/review']},
  },NOW);
  const ticked = applyCommand(handoff.queue,{
    opId:'worker-tick',type:'worker_tick',worker:'reviewer',runId:'review-1',expectedEveryMs:3_600_000,
  },NOW).queue;
  const corruptions = [
    queue => { queue.receipts[handoff.result.receiptId].ackDueAt = 'not-a-date'; },
    queue => { delete queue.receipts[handoff.result.receiptId]; },
    queue => { queue.workers.reviewer = null; },
    queue => { queue.workers.reviewer.at = 'not-a-date'; },
    queue => { queue.workers.reviewer.expectedEveryMs = -1; },
    queue => { queue.operations.handoff.fingerprint = 'invalid'; },
    queue => { queue.operations.handoff.result = null; },
  ];
  for (const corrupt of corruptions) {
    const queue = clone(ticked);
    corrupt(queue);
    assert.throws(() => validateQueue(queue),/Corrupt|Missing/);
    assert.throws(() => inspectQueue(queue,NOW + 7_200_000),/Corrupt|Missing/);
  }
});

test('CAS replay obtains a fresh clock after a later competing write', async () => {
  let queue = seed('one'), conflicts = 0, writes = 0, clockCalls = 0;
  const store = {
    async read() { return {queue:clone(queue),revision:queue.revision}; },
    async compareAndSwap(expected,next) {
      writes++;
      if (conflicts++ === 0) {
        queue = applyCommand(queue,{opId:'other-write',type:'worker_tick',worker:'supervisor',runId:'watch-1'},NOW + 2).queue;
        return false;
      }
      assert.equal(expected,queue.revision);
      queue = clone(next);
      return true;
    },
  };
  const result = await transact(store,claim('one','run-a'),() => NOW + ++clockCalls);
  assert.equal(writes,2);
  assert.equal(clockCalls,4);
  assert.equal(queue.workers.supervisor.runId,'watch-1');
  assert.equal(queue.tasks.one.lease.token,result.result.token);
  assert.equal(queue.updatedAt,new Date(NOW + 3).toISOString());
});

test('an owner lease expiring while preparing the candidate is rejected before CAS', async () => {
  const source = applyCommand(seed('one'),claim('one','source'),NOW);
  const store = memoryStore(source.queue);
  const times = [NOW + 10,NOW + 60_000];
  const command = {opId:'late-completion',type:'complete',taskId:'one',worker:'builder',runId:'source',...source.result,evidence:{outcome:'pass',refs:['https://example.test/proof']}};
  await assert.rejects(transact(store,command,() => times.shift()),/expired before CAS/);
  assert.equal(store.writes.length,0);
  assert.deepEqual(store.queue,source.queue);
});

test('retirement requires the supervisor and cannot cancel a live owner or pending handoff', () => {
  const ready = seed('one');
  const retire = {opId:'retire',type:'retire',taskId:'one',worker:'supervisor',resolution:'Reconciled and superseded',refs:['https://example.test/resolution']};
  assert.throws(() => applyCommand(ready,{...retire,worker:'builder'},NOW),/Only supervisor/);
  const source = applyCommand(ready,claim('one','source'),NOW);
  assert.throws(() => applyCommand(source.queue,retire,NOW),/inactive work/);
  const handedOff = applyCommand(source.queue,{
    opId:'handoff',type:'handoff',taskId:'one',worker:'builder',runId:'source',...source.result,
    to:'reviewer',summary:'Review pending',evidence:{outcome:'pass',refs:['https://example.test/proof']},
  },NOW).queue;
  assert.throws(() => applyCommand(handedOff,retire,NOW),/inactive work/);
  assert.equal(handedOff.tasks.one.status,'awaiting_ack');
});

test('retiring exhausted blocked work releases its resource without claiming delivery', () => {
  let queue = emptyQueue();
  for (const id of ['one','two']) {
    const command = enqueue(id);
    Object.assign(command.task,{resource:'catalogue-writer',maxAttempts:1,maxTotalAttempts:1});
    queue = applyCommand(queue,command,NOW).queue;
  }
  const source = applyCommand(queue,claim('one','source'),NOW);
  queue = applyCommand(source.queue,{
    opId:'failure',type:'fail',taskId:'one',worker:'builder',runId:'source',...source.result,
    reason:'Acquisition budget exhausted',retryable:true,
  },NOW).queue;
  assert.equal(queue.tasks.one.status,'blocked');
  assert.throws(() => applyCommand(queue,claim('two','replacement'),NOW),/Exclusive resource/);
  queue = applyCommand(queue,{
    opId:'retire',type:'retire',taskId:'one',worker:'supervisor',
    resolution:'External effects reconciled; follow-up has a separate scope',refs:['https://example.test/reconciliation'],
  },NOW).queue;
  assert.equal(queue.tasks.one.status,'cancelled');
  assert.equal(queue.tasks.one.totalAttempts,1);
  assert.equal(queue.tasks.one.evidence,null);
  assert.equal(queue.tasks.one.completedAt,undefined);
  assert.equal(queue.tasks.one.lease,null);
  const next = applyCommand(queue,claim('two','replacement'),NOW).queue;
  assert.equal(next.tasks.two.status,'leased');
});

test('approval-held retirement requires a referenced human decision and never completes work', () => {
  const source = applyCommand(seed('one'),claim('one','source'),NOW);
  const held = applyCommand(source.queue,{
    opId:'approval-hold',type:'block',taskId:'one',worker:'builder',runId:'source',...source.result,
    reason:'Human asset decision needed',approvalRequired:true,
  },NOW).queue;
  const retire = {opId:'retire',type:'retire',taskId:'one',worker:'supervisor',resolution:'Recorded human decision closes this scope',refs:['https://example.test/decision']};
  for (const humanDecision of [undefined,{decision:'approved'},{decision:'automatic',reference:'Human conversation 123'}]) {
    assert.throws(() => applyCommand(held,{...retire,humanDecision},NOW),/Actual human decision/);
  }
  for (const decision of ['approved','declined']) {
    const humanDecision = {decision,reference:'Trusted human conversation 123'};
    const retired = applyCommand(held,{...retire,humanDecision},NOW).queue;
    assert.equal(retired.tasks.one.status,'cancelled');
    assert.equal(retired.tasks.one.evidence,null);
    assert.equal(retired.tasks.one.completedAt,undefined);
    assert.deepEqual(retired.tasks.one.retirement.humanDecision,humanDecision);
  }
});

test('retiring a prerequisite keeps dependent work unclaimable and visible', () => {
  let queue = seed('one');
  const dependent = enqueue('dependent');
  dependent.task.dependencies = ['one'];
  queue = applyCommand(queue,dependent,NOW).queue;
  queue = applyCommand(queue,{
    opId:'retire-source',type:'retire',taskId:'one',worker:'supervisor',
    resolution:'Prerequisite scope declined',refs:['https://example.test/resolution'],
  },NOW).queue;
  assert.equal(queue.tasks.one.status,'cancelled');
  assert.equal(queue.tasks.dependent.status,'ready');
  assert.throws(() => applyCommand(queue,claim('dependent','dependent-run'),NOW),/Dependencies are incomplete/);
  assert.ok(inspectQueue(queue,NOW).some(issue => issue.key === 'dependency:dependent'));
});

test('a failing inner command discards the entire batch without changing input or store',async()=>{
  const queue=emptyQueue(),snapshot=clone(queue),store=memoryStore(queue);
  const command={opId:'atomic-batch',type:'batch',commands:[enqueue('one'),claim('one','wrong-role')]};
  command.commands[1].worker='reviewer';
  assert.throws(()=>applyCommand(queue,command,NOW),/another role/);
  assert.deepEqual(queue,snapshot);
  await assert.rejects(transact(store,command,NOW),/another role/);
  assert.equal(store.writes.length,0);
  assert.deepEqual(store.queue,snapshot);
});

test('outer and inner batch receipts replay without another acquisition or CAS',async()=>{
  const inner=[enqueue('one'),claim('one','source')];
  const command={opId:'atomic-batch',type:'batch',commands:inner};
  const store=memoryStore(emptyQueue());
  const first=await transact(store,command,NOW);
  const persisted=store.queue;
  assert.deepEqual((await transact(store,command,NOW+1)).result,first.result);
  assert.deepEqual((await transact(store,inner[1],NOW+1)).result,first.result.results[1]);
  assert.deepEqual(store.queue,persisted);
  assert.equal(store.queue.tasks.one.attempts,1);
  assert.equal(store.writes.length,1);
  await assert.rejects(transact(store,{...command,commands:[...inner,enqueue('two')]},NOW),/different command/);
});

test('batches reject nesting and more than ten commands before producing state',()=>{
  const queue=emptyQueue();
  assert.throws(()=>applyCommand(queue,{opId:'outer',type:'batch',commands:[{opId:'inner',type:'batch',commands:[enqueue('one')]}]},NOW),/Invalid bounded/);
  assert.throws(()=>applyCommand(queue,{opId:'outer',type:'batch',commands:Array.from({length:11},(_,i)=>enqueue('task-'+i))},NOW),/Invalid bounded/);
  assert.deepEqual(queue,emptyQueue());
});

test('a batch cannot complete an owner lease that expired before CAS',async()=>{
  const source=applyCommand(seed('one'),claim('one','source'),NOW);
  const store=memoryStore(source.queue),times=[NOW+10,NOW+60_000];
  const complete={opId:'complete-in-batch',type:'complete',taskId:'one',worker:'builder',runId:'source',...source.result,evidence:{outcome:'pass',refs:['https://example.test/proof']}};
  const command={opId:'late-batch',type:'batch',commands:[complete]};
  await assert.rejects(transact(store,command,()=>times.shift()),/expired before CAS/);
  assert.equal(store.writes.length,0);
  assert.deepEqual(store.queue,source.queue);
});
