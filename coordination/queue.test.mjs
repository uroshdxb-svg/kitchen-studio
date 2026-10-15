import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyQueue, applyCommand, inspectQueue } from './queue.mjs';

const START = Date.parse('2026-10-15T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const LEASE = 60_000;
const evidence = () => ({ refs: ['https://example.test/evidence/1'], outcome: 'pass' });

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function harness() {
  let queue = emptyQueue();
  let now = START;
  let sequence = 0;
  return {
    get queue() { return queue; },
    get now() { return now; },
    advance(ms) { now += ms; },
    command(command) {
      const snapshot = structuredClone(queue);
      freeze(queue);
      const next = applyCommand(queue, { opId: `operation-${++sequence}`, ...command }, now);
      assert.deepEqual(queue, snapshot, 'commands must leave their input queue unchanged');
      assert.ok(next && next.queue && Object.hasOwn(next, 'result'));
      queue = next.queue;
      return next.result;
    },
    reject(command) {
      const snapshot = structuredClone(queue);
      freeze(queue);
      assert.throws(() => applyCommand(queue, { opId: `operation-${++sequence}`, ...command }, now));
      assert.deepEqual(queue, snapshot, 'rejected commands must leave the queue unchanged');
    },
    enqueue(id, overrides = {}) {
      return this.command({ type: 'enqueue', task: {
        id, owner: 'builder', kind: 'work', title: `Work on ${id}`,
        dependencies: [], maxAttempts: 3, deadline: null,
        retrySafe: (overrides.kind ?? 'work') === 'work', ...overrides,
      } });
    },
    claim(taskId, runId = 'run-1', worker = 'builder') {
      const result = this.command({ type: 'claim', taskId, worker, runId, leaseMs: LEASE });
      assert.equal(result.taskId, taskId);
      assert.equal(typeof result.token, 'string');
      assert.ok(result.token.length > 0);
      assert.ok(Number.isInteger(result.generation));
      return { taskId, worker, runId, token: result.token, generation: result.generation };
    },
  };
}

test('opId replay returns the original result; collisions cannot overwrite a task', () => {
  const h = harness();
  const command = { opId: 'enqueue-once', type: 'enqueue', task: {
    id: 'one', owner: 'builder', kind: 'work', title: 'First task',
    dependencies: [], maxAttempts: 3, deadline: null,
  } };
  const first = h.command(command);
  const saved = structuredClone(h.queue);
  assert.deepEqual(h.command(command), first);
  assert.deepEqual(h.queue, saved);
  h.reject({ ...command, task: { ...command.task, title: 'Changed task' } });
  assert.equal(h.queue.tasks.one.title, 'First task');
});

test('a live claim excludes another run and a replay does not allocate another lease', () => {
  const h = harness();
  h.enqueue('one');
  const command = { opId: 'claim-once', type: 'claim', taskId: 'one', worker: 'builder', runId: 'run-1', leaseMs: LEASE };
  const first = h.command(command);
  const saved = structuredClone(h.queue);
  assert.deepEqual(h.command(command), first);
  assert.deepEqual(h.queue, saved);
  h.reject({ ...command, opId: 'competing-claim', runId: 'run-2' });
});

test('dependencies must complete before dependent work can be claimed', () => {
  const h = harness();
  h.enqueue('source');
  h.enqueue('dependent', { dependencies: ['source'] });
  h.reject({ type: 'claim', taskId: 'dependent', worker: 'builder', runId: 'too-early', leaseMs: LEASE });
  const source = h.claim('source');
  h.command({ type: 'complete', ...source, evidence: evidence() });
  assert.equal(h.queue.tasks.source.status, 'done');
  h.claim('dependent');
});

test('lease ownership and generation fence every active-lease mutation', () => {
  const h = harness();
  h.enqueue('one');
  const lease = h.claim('one');
  const mutations = [
    { type: 'heartbeat', leaseMs: LEASE },
    { type: 'handoff', to: 'reviewer', summary: 'Ready to review', evidence: evidence() },
    { type: 'complete', evidence: evidence() },
    { type: 'fail', reason: 'Transient error', retryable: true },
    { type: 'block', reason: 'Approval needed', approvalRequired: true },
  ];
  for (const mutation of mutations) {
    h.reject({ ...mutation, ...lease, token: 'incorrect-token' });
    h.reject({ ...mutation, ...lease, generation: lease.generation + 1 });
    h.reject({ ...mutation, ...lease, runId: 'another-run' });
  }
  h.command({ type: 'heartbeat', ...lease, leaseMs: LEASE });
});

test('expired leases are detectable and fenced after sweep and a new claim', () => {
  const h = harness();
  h.enqueue('one');
  const oldLease = h.claim('one');
  h.advance(LEASE + 1);
  const first = inspectQueue(h.queue, h.now);
  assert.ok(Array.isArray(first) && first.length > 0, 'inspection must detect expired work');
  assert.ok(first.every(issue => typeof issue.fingerprint === 'string' && issue.fingerprint.length > 0));
  assert.deepEqual(inspectQueue(h.queue, h.now).map(x => x.fingerprint), first.map(x => x.fingerprint));
  h.command({ type: 'sweep' });
  assert.equal(h.queue.tasks.one.status, 'retry_wait');
  h.advance(DAY);
  const newLease = h.claim('one', 'run-2');
  assert.ok(newLease.generation > oldLease.generation, 'reclaims must advance the fencing generation');
  assert.notEqual(newLease.token, oldLease.token);
  h.reject({ type: 'heartbeat', ...oldLease, leaseMs: LEASE });
  h.reject({ type: 'complete', ...oldLease, evidence: evidence() });
  h.command({ type: 'complete', ...newLease, evidence: evidence() });
});

test('expired release requires reconciliation and cannot automatically reacquire', () => {
  const h = harness();
  h.enqueue('release', { kind: 'release', owner: 'release' });
  assert.equal(h.queue.tasks.release.retrySafe, false);
  const expiredLease = h.claim('release', 'release-1', 'release');
  h.advance(LEASE + 1);
  h.reject({ type: 'heartbeat', ...expiredLease, leaseMs: LEASE });
  h.command({ type: 'sweep' });
  assert.equal(h.queue.tasks.release.status, 'blocked');
  assert.equal(h.queue.tasks.release.retryAt, null);
  assert.match(h.queue.tasks.release.reason, /external effect|reconcil/i);
  h.advance(DAY);
  h.command({ type: 'sweep' });
  h.reject({ type: 'claim', taskId: 'release', worker: 'release', runId: 'automatic-retry', leaseMs: LEASE });
  assert.equal(h.queue.tasks.release.totalAttempts, 1);
});

test('handoff and acceptance survive lost acknowledgements without duplicate ownership', () => {
  const h = harness();
  h.enqueue('one');
  const lease = h.claim('one');
  const handoff = { opId: 'handoff-once', type: 'handoff', ...lease, to: 'reviewer', summary: 'Implementation ready', evidence: evidence() };
  const receipt = h.command(handoff);
  assert.equal(typeof receipt.receiptId, 'string');
  assert.ok(receipt.receiptId.length > 0);
  const handedOff = structuredClone(h.queue);
  assert.deepEqual(h.command(handoff), receipt);
  assert.deepEqual(h.queue, handedOff);
  h.reject({ type: 'complete', ...lease, evidence: evidence() });
  h.reject({ type: 'accept', taskId: 'one', worker: 'reviewer', runId: 'review-1', receiptId: 'wrong-receipt', leaseMs: LEASE });
  h.reject({ type: 'accept', taskId: 'one', worker: 'unrelated-role', runId: 'wrong-role', receiptId: receipt.receiptId, leaseMs: LEASE });
  const accept = { opId: 'accept-once', type: 'accept', taskId: 'one', worker: 'reviewer', runId: 'review-1', receiptId: receipt.receiptId, leaseMs: LEASE };
  const accepted = h.command(accept);
  const acceptedQueue = structuredClone(h.queue);
  assert.deepEqual(h.command(accept), accepted);
  assert.deepEqual(h.queue, acceptedQueue);
  h.reject({ ...accept, opId: 'accept-again', runId: 'review-2' });
  assert.ok(accepted.generation > lease.generation);
  h.command({ type: 'complete', taskId: 'one', worker: 'reviewer', runId: 'review-1', token: accepted.token, generation: accepted.generation, evidence: evidence() });
  assert.equal(h.queue.tasks.one.status, 'done');
});

test('handoff resets stage attempts while preserving and enforcing the total budget', () => {
  const h = harness();
  h.enqueue('one', { maxAttempts: 3, maxTotalAttempts: 3 });
  const builder = h.claim('one');
  assert.equal(h.queue.tasks.one.totalAttempts, 1);
  const toReviewer = h.command({ type: 'handoff', ...builder, to: 'reviewer', summary: 'Ready for review', evidence: evidence() });
  const review = h.command({ type: 'accept', taskId: 'one', worker: 'reviewer', runId: 'review-1', receiptId: toReviewer.receiptId, leaseMs: LEASE });
  assert.equal(h.queue.tasks.one.attempts, 1);
  assert.equal(h.queue.tasks.one.totalAttempts, 2);
  const reviewer = { taskId: 'one', worker: 'reviewer', runId: 'review-1', token: review.token, generation: review.generation };
  const toBuilder = h.command({ type: 'handoff', ...reviewer, to: 'builder', summary: 'One revision required', evidence: evidence() });
  const revision = h.command({ type: 'accept', taskId: 'one', worker: 'builder', runId: 'revision-1', receiptId: toBuilder.receiptId, leaseMs: LEASE });
  assert.equal(h.queue.tasks.one.attempts, 1);
  assert.equal(h.queue.tasks.one.totalAttempts, 3);
  const finalLease = { taskId: 'one', worker: 'builder', runId: 'revision-1', token: revision.token, generation: revision.generation };
  h.reject({ type: 'handoff', ...finalLease, to: 'reviewer', summary: 'Try another cycle', evidence: evidence() });
  h.command({ type: 'fail', ...finalLease, reason: 'Total acquisition budget exhausted', retryable: true });
  assert.equal(h.queue.tasks.one.status, 'blocked');
  h.advance(DAY);
  h.command({ type: 'sweep' });
  h.reject({ type: 'claim', taskId: 'one', worker: 'builder', runId: 'over-total-budget', leaseMs: LEASE });
  assert.equal(h.queue.tasks.one.totalAttempts, 3);
});

test('retryable failures back off and stop at maxAttempts', () => {
  const h = harness();
  h.enqueue('one', { maxAttempts: 2 });
  const first = h.claim('one');
  h.command({ type: 'fail', ...first, reason: 'Temporary upstream failure', retryable: true });
  assert.equal(h.queue.tasks.one.status, 'retry_wait');
  h.reject({ type: 'claim', taskId: 'one', worker: 'builder', runId: 'immediate-retry', leaseMs: LEASE });
  h.advance(DAY);
  const second = h.claim('one', 'run-2');
  h.command({ type: 'fail', ...second, reason: 'Still unavailable', retryable: true });
  h.advance(DAY);
  h.command({ type: 'sweep' });
  h.reject({ type: 'claim', taskId: 'one', worker: 'builder', runId: 'over-budget', leaseMs: LEASE });
  assert.equal(h.queue.tasks.one.status, 'blocked');
});

test('a nonretryable failure cannot be revived by sweep', () => {
  const h = harness();
  h.enqueue('one');
  const lease = h.claim('one');
  h.command({ type: 'fail', ...lease, reason: 'Invalid upstream specification', retryable: false });
  h.advance(DAY);
  h.command({ type: 'sweep' });
  assert.equal(h.queue.tasks.one.status, 'blocked');
  h.reject({ type: 'claim', taskId: 'one', worker: 'builder', runId: 'retry', leaseMs: LEASE });
});

test('release completion requires explicit production evidence, not only a PR or preview', () => {
  const h = harness();
  h.enqueue('release', { kind: 'release', owner: 'release' });
  const lease = h.claim('release', 'release-1', 'release');
  const proof = { ...evidence(), commit: 'a'.repeat(40), ciUrl: 'https://github.com/example/repo/actions/runs/1', deploymentUrl: 'https://dash.cloudflare.com/deployment/1', productionUrl: 'https://kitchenstudio.design/guides/', checkedAt: new Date(h.now).toISOString(), liveVerified: true };
  h.reject({ type: 'complete', ...lease, evidence: evidence() });
  h.reject({ type: 'complete', ...lease, evidence: { ...proof, liveVerified: false } });
  h.reject({ type: 'complete', ...lease, evidence: { ...proof, productionUrl: 'https://preview.example.test/guides/' } });
  h.reject({ type: 'complete', ...lease, evidence: { ...proof, commit: 'not-a-commit' } });
  h.command({ type: 'complete', ...lease, evidence: proof });
  assert.equal(h.queue.tasks.release.status, 'done');
});

test('content completion requires artifact identity and passed QA', () => {
  const h = harness();
  h.enqueue('content', { kind: 'content' });
  const lease = h.claim('content');
  h.reject({ type: 'complete', ...lease, evidence: evidence() });
  h.reject({ type: 'complete', ...lease, evidence: { ...evidence(), artifactSha256: 'b'.repeat(64), qaPassed: false } });
  h.reject({ type: 'complete', ...lease, evidence: { ...evidence(), artifactSha256: 'short', qaPassed: true } });
  h.command({ type: 'complete', ...lease, evidence: { ...evidence(), artifactSha256: 'b'.repeat(64), qaPassed: true } });
  assert.equal(h.queue.tasks.content.status, 'done');
});

test('approval-required blocks persist across sweep and cannot be claimed', () => {
  const h = harness();
  h.enqueue('one');
  const lease = h.claim('one');
  h.command({ type: 'block', ...lease, reason: 'Human approval required for this action', approvalRequired: true });
  const awaitingApproval = h.queue.tasks.one.status;
  assert.equal(awaitingApproval, 'needs_approval');
  h.advance(DAY);
  h.command({ type: 'sweep' });
  assert.equal(h.queue.tasks.one.status, awaitingApproval);
  h.reject({ type: 'claim', taskId: 'one', worker: 'builder', runId: 'sweep-retry', leaseMs: LEASE });
  const issues = inspectQueue(h.queue, h.now);
  assert.ok(issues.length > 0, 'blocked approvals must remain visible');
  assert.deepEqual(inspectQueue(h.queue, h.now + 1).map(x => x.fingerprint), issues.map(x => x.fingerprint), 'issue fingerprints must remain stable over time');
});
