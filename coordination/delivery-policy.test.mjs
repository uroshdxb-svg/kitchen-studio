import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './queue.mjs';
import {DELIVERY_POLICY} from './delivery-policy.mjs';
import {evaluateDelivery} from './delivery-evals.mjs';

const START = Date.parse('2026-10-20T00:00:00Z'), H = 3600000;
const refs = ['https://example.test/test-results'];
function fixture() {
  let q = api.emptyQueue(), seq = 0;
  return {get q() {return q;}, replace(value) {q = value;},
    send(c, at = START) {const r = api.applyCommand(q, {opId: 'test-' + ++seq, ...c}, at); q = r.queue; return r.result;},
    add() {this.send({type: 'enqueue', task: {id: 'work', owner: 'product', title: 'Operator acceptance output', kind: 'work', retrySafe: true}});},
    claim(taskId = 'work', worker = 'product', at = START) {return {...this.send({type: 'claim', taskId, worker, runId: 'run'}, at), worker, runId: 'run'};},
  };
}

test('known delivery failures and healthy controls pass the common evaluation suite', () => {
  const result = evaluateDelivery(api);
  assert.equal(result.passed, result.caseCount, JSON.stringify(result));
});

test('stall thresholds include the exact boundary; 84 hours is half of seven days', () => {
  const h = fixture(); h.add();
  assert.equal(DELIVERY_POLICY.reviewMs, 7 * 24 * H / 2);
  const issue = at => api.inspectQueue(h.q, at).find(x => x.key === 'stalled:work');
  assert.equal(issue(START + 24 * H - 1), undefined);
  assert.equal(issue(START + 24 * H).severity, 'warning');
  assert.equal(issue(START + 48 * H).severity, 'critical');
});

test('new immutable checked progress resets stall age; repeated artifacts and stale leases cannot', () => {
  const h = fixture(); h.add(); const lease = h.claim('work', 'product', START + 25 * H);
  const command = {type: 'progress', ...lease, milestoneId: 'acceptance-test', summary: 'Acceptance artifact verified',
    evidence: {outcome: 'pass', refs, checkedAt: new Date(START + 25 * H).toISOString(), artifactSha256: 'a'.repeat(64)}};
  h.send(command, START + 25 * H);
  assert.ok(!api.inspectQueue(h.q, START + 26 * H).some(x => x.key === 'stalled:work'));
  assert.throws(() => h.send({...command, milestoneId: 'renamed-same-result'}, START + 25 * H + 1), /Repeated artifacts/);
  assert.throws(() => h.send({...command, token: 'wrong'}, START + 25 * H + 1), /fence/);
  assert.throws(() => h.send({...command, milestoneId: 'later', evidence: {...command.evidence, artifactSha256: 'b'.repeat(64)}}, START + 26 * H), /expired/);
  assert.equal(api.inspectQueue(h.q, START + 49 * H).find(x => x.key === 'stalled:work').severity, 'warning');
});

test('claims, retries, repeated failures and updatedAt do not reset the delivery clock', () => {
  const h = fixture(); h.add(); const lease = h.claim('work', 'product', START + 23 * H);
  h.send({type: 'fail', ...lease, retryable: true, reason: 'Temporary network issue'}, START + 23 * H);
  const again = h.claim('work', 'product', START + 25 * H);
  h.send({type: 'heartbeat', ...again}, START + 25 * H + 1);
  assert.ok(api.inspectQueue(h.q, START + 25 * H + 2).some(x => x.key === 'stalled:work'));
});

test('legacy alerts without delivery timestamps are emitted once, then remind at 24 hours', () => {
  const h = fixture(); h.add(); h.send({type: 'scan'}, START + 24 * H);
  const legacy = structuredClone(h.q); delete legacy.alerts['stalled:work'].lastEmittedAt; h.replace(legacy);
  assert.equal(h.send({type: 'scan'}, START + 24 * H + 1).notify.find(x => x.key === 'stalled:work').notificationReason, 'legacy-unconfirmed');
  assert.ok(!h.send({type: 'scan'}, START + 24 * H + 2).notify.some(x => x.key === 'stalled:work'));
  assert.equal(h.send({type: 'scan'}, START + 48 * H).notify.find(x => x.key === 'stalled:work').notificationReason, 'changed');
  assert.equal(h.send({type: 'scan'}, START + 72 * H).notify.find(x => x.key === 'stalled:work').notificationReason, 'reminder');
});

test('resolved alerts clear and recurring incidents notify again', () => {
  const h = fixture(); h.add(); h.send({type: 'scan'}, START + 25 * H);
  const lease = h.claim('work', 'product', START + 25 * H);
  h.send({type: 'complete', ...lease, evidence: {outcome: 'pass', refs}}, START + 25 * H);
  h.send({type: 'scan'}, START + 25 * H);
  assert.equal(h.q.alerts['stalled:work'], undefined);
});

test('review completion requires comparable tests and schedules the next review in 84 hours', () => {
  const h = fixture(); const first = h.send({type: 'scan'}); const id = first.improvementTaskId;
  const lease = h.claim(id, 'supervisor');
  assert.throws(() => h.send({type: 'complete', ...lease, evidence: {outcome: 'pass', refs}}), /review decision/);
  const review = {decision: 'adopt', incidentKeys: ['stalled:work'], cause: 'Repeated alerts were suppressed indefinitely', nextAction: 'Verify the next scheduled scan',
    baselineRevision: 'a'.repeat(40), candidateRevision: 'b'.repeat(40), caseCount: 6, baselinePassed: 2, candidatePassed: 6, regressionPassed: true, testRefs: refs};
  assert.throws(() => h.send({type: 'complete', ...lease, evidence: {outcome: 'pass', refs, review: {...review, candidatePassed: 2}}}), /measured improvement/);
  assert.throws(() => h.send({type: 'complete', ...lease, evidence: {outcome: 'pass', refs, review: {...review, regressionPassed: false}}}), /no regression/);
  h.send({type: 'complete', ...lease, evidence: {outcome: 'pass', refs, review}});
  assert.equal(h.q.improvementCycle.nextDueAt, new Date(START + 84 * H).toISOString());
  assert.equal(h.send({type: 'scan'}, START + 84 * H - 1).improvementTaskId, null);
  const next = h.send({type: 'scan'}, START + 84 * H).improvementTaskId;
  assert.notEqual(next, id); assert.equal(h.q.improvementCycle.history.length, 1);
  assert.equal(h.q.tasks[id].status, 'done');
});

test('an unfinished review stays visible and cannot multiply into duplicate work', () => {
  const h = fixture(); const first = h.send({type: 'scan'}).improvementTaskId;
  const later = h.send({type: 'scan'}, START + 7 * 24 * H);
  assert.equal(later.improvementTaskId, first);
  assert.equal(Object.keys(h.q.tasks).length, 1);
  assert.ok(later.issues.some(x => x.taskId === first && x.key.startsWith('deadline:')));
});

test('scan replay preserves its notification receipt without additional writes or review tasks', () => {
  const h = fixture(); h.add(); const c = {type: 'scan', opId: 'same-scan'};
  const first = h.send(c, START + 25 * H), before = structuredClone(h.q);
  assert.deepEqual(h.send(c, START + 26 * H), first); assert.deepEqual(h.q, before);
});

test('cloud watchdog notification history is independent of the primary supervisor', () => {
  const h = fixture(); h.add();
  assert.ok(h.send({type: 'scan'}, START + 24 * H).notify.some(x => x.key === 'stalled:work'));
  assert.ok(h.send({type: 'scan', channel: 'cloud-watchdog'}, START + 24 * H + 1).notify.some(x => x.key === 'stalled:work'));
  assert.ok(!h.send({type: 'scan', channel: 'cloud-watchdog'}, START + 24 * H + 2).notify.some(x => x.key === 'stalled:work'));
  assert.ok(!h.send({type: 'scan'}, START + 24 * H + 3).notify.some(x => x.key === 'stalled:work'));
  assert.throws(() => h.send({type: 'scan', channel: 'arbitrary-channel'}, START + 24 * H + 4), /Unknown monitor/);
});
