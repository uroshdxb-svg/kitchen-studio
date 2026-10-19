// Delivery checks are deterministic; no model, publisher or account calls occur here.
export const DELIVERY_POLICY = Object.freeze({
  version: '2026-10-20',
  warningMs: 24 * 60 * 60 * 1000,
  criticalMs: 48 * 60 * 60 * 1000,
  reminderMs: 24 * 60 * 60 * 1000,
  reviewMs: 84 * 60 * 60 * 1000,
});

const iso = value => new Date(value).toISOString();
const time = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const text = (value, max = 500) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const requireThat = (value, message) => { if (!value) throw new Error(message); };
const refs = value => Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(x => text(x, 1000));
const revision = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

export function validateDeliveryState(queue) {
  for (const task of Object.values(queue.tasks)) {
    if (task.progress === undefined && task.lastProgressAt === undefined) continue;
    requireThat(time(task.lastProgressAt) && Date.parse(task.lastProgressAt) <= Date.parse(queue.updatedAt), 'Corrupt delivery progress time');
    requireThat(Array.isArray(task.progress) && task.progress.length <= 100, 'Corrupt delivery progress');
    const ids = new Set(), artifacts = new Set();
    for (const item of task.progress) {
      requireThat(text(item.id, 120) && time(item.at) && refs(item.refs) && text(item.summary), 'Corrupt progress evidence');
      requireThat(/^[a-f0-9]{40}$|^[a-f0-9]{64}$/.test(item.artifact ?? ''), 'Immutable progress artifact required');
      requireThat(!ids.has(item.id) && !artifacts.has(item.artifact), 'Duplicate progress evidence');
      ids.add(item.id); artifacts.add(item.artifact);
      requireThat(Date.parse(item.at) <= Date.parse(task.lastProgressAt), 'Corrupt progress ordering');
    }
  }
  const cycle = queue.improvementCycle;
  if (cycle === undefined) return;
  requireThat(cycle && cycle.policyVersion === DELIVERY_POLICY.version && time(cycle.startedAt) && time(cycle.nextDueAt), 'Corrupt improvement cycle');
  requireThat(cycle.lastReviewAt === null || time(cycle.lastReviewAt), 'Corrupt review time');
  requireThat(cycle.taskId === null || queue.tasks[cycle.taskId]?.owner === 'supervisor', 'Missing improvement review task');
  requireThat(Array.isArray(cycle.history), 'Corrupt review history');
  requireThat(cycle.sequence === undefined || (Number.isSafeInteger(cycle.sequence) && cycle.sequence >= 0), 'Corrupt review sequence');
}

export function recordProgress(task, command, now) {
  const e = command.evidence;
  requireThat(text(command.milestoneId, 120) && text(command.summary), 'Named progress milestone required');
  requireThat(e?.outcome === 'pass' && refs(e.refs) && time(e.checkedAt), 'Checked progress evidence required');
  requireThat(Date.parse(e.checkedAt) <= now && Date.parse(e.checkedAt) >= Date.parse(task.lease.claimedAt), 'Progress must be checked during the current lease');
  const artifact = e.artifactSha256 ?? e.commit;
  requireThat(/^[a-f0-9]{40}$|^[a-f0-9]{64}$/.test(artifact ?? ''), 'Immutable progress artifact required');
  const history = task.progress ?? [];
  requireThat(history.length < 100 && !history.some(x => x.id === command.milestoneId || x.artifact === artifact), 'Repeated artifacts/status notes are not new progress');
  task.progress = [...history, {id: command.milestoneId, summary: command.summary, artifact, refs: [...e.refs], at: e.checkedAt}];
  task.lastProgressAt = e.checkedAt;
}

export function progressAge(task, now) {
  // updatedAt, heartbeats, claims, failures and retries never reset delivery age.
  const anchor = task.lastProgressAt ?? task.createdAt;
  return time(anchor) ? now - Date.parse(anchor) : null;
}

export function scheduleImprovementReview(queue, now) {
  queue.improvementCycle ??= {
    policyVersion: DELIVERY_POLICY.version, startedAt: iso(now), nextDueAt: iso(now),
    lastReviewAt: null, taskId: null, history: [],
  };
  const cycle = queue.improvementCycle;
  if (cycle.taskId || now < Date.parse(cycle.nextDueAt)) return null;
  cycle.sequence = (cycle.sequence ?? 0) + 1;
  const id = 'KS-IMPROVE-' + cycle.nextDueAt.replace(/[^0-9]/g, '').slice(0, 14) + '-' + cycle.sequence;
  requireThat(!queue.tasks[id], 'Improvement cycle task identity collision');
  return {id, owner: 'supervisor', kind: 'work',
    title: 'Review delivery failures, test one improvement and record an evidence-based decision',
    dependencies: [], maxAttempts: 3, maxTotalAttempts: 12,
    deadline: iso(Date.parse(cycle.nextDueAt) + DELIVERY_POLICY.warningMs),
    dedupeKey: id, retrySafe: true, resource: 'improvement-review'};
}

export function retireImprovementReview(queue, task, now) {
  const cycle = queue.improvementCycle;
  if (cycle?.taskId !== task.id) return;
  (cycle.retirements ??= []).push({taskId: task.id, at: iso(now), refs: [...task.retirement.refs]});
  cycle.taskId = null;
  cycle.nextDueAt = iso(now);
  // Retiring an attempt does not mean a review succeeded or cancel the ongoing policy.
}

export function finishImprovementReview(queue, task, evidence, now) {
  const cycle = queue.improvementCycle;
  if (cycle?.taskId !== task.id) return;
  const r = evidence.review;
  requireThat(r && ['adopt', 'keep', 'revert', 'blocked'].includes(r.decision), 'Improvement review decision required');
  requireThat(Array.isArray(r.incidentKeys) && r.incidentKeys.length > 0 && r.incidentKeys.length <= 20 && r.incidentKeys.every(x => text(x, 200)), 'Review incident references required');
  requireThat(text(r.cause) && text(r.nextAction) && refs(r.testRefs), 'Review cause, tests and next action required');
  requireThat(revision(r.baselineRevision) && revision(r.candidateRevision), 'Exact baseline and candidate revisions required');
  requireThat(Number.isSafeInteger(r.caseCount) && r.caseCount > 0 && Number.isSafeInteger(r.baselinePassed) && Number.isSafeInteger(r.candidatePassed) && r.baselinePassed >= 0 && r.candidatePassed >= 0 && r.baselinePassed <= r.caseCount && r.candidatePassed <= r.caseCount, 'Comparable review test counts required');
  requireThat(typeof r.regressionPassed === 'boolean', 'Regression result required');
  if (r.decision === 'adopt') requireThat(r.regressionPassed && r.candidatePassed > r.baselinePassed, 'Adoption requires measured improvement and no regression');
  cycle.history.push({taskId: task.id, at: iso(now), ...structuredClone(r)});
  cycle.lastReviewAt = iso(now);
  cycle.nextDueAt = iso(now + DELIVERY_POLICY.reviewMs);
  cycle.taskId = null;
  // A review is evidence of a decision, not proof of deployment or delivered specialist work.
}
