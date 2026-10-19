import {pathToFileURL} from 'node:url';

// Sanitized reproductions of observed failure modes, shared by baseline and candidate.
export function evaluateDelivery(api) {
  const H = 3600000, start = Date.parse('2026-10-20T00:00:00Z');
  function fixture() {
    let q = api.emptyQueue(), seq = 0;
    const send = (c, at = start) => {
      const result = api.applyCommand(q, {opId: 'eval-' + ++seq, ...c}, at);
      q = result.queue; return result.result;
    };
    send({type: 'enqueue', task: {id: 'work', owner: 'product', kind: 'work', title: 'Deliver a verified operator outcome', retrySafe: true}});
    return {send, get q() { return q; }};
  }
  const cases = [
    ['ready-work-warns-at-24h', () => {
      const h = fixture();
      return api.inspectQueue(h.q, start + 24 * H).some(x => x.key === 'stalled:work' && x.severity === 'warning');
    }],
    ['heartbeats-do-not-hide-48h-stall', () => {
      const h = fixture(); h.send({type: 'worker_tick', worker: 'product', runId: 'still-awake'}, start + 48 * H);
      return api.inspectQueue(h.q, start + 48 * H).some(x => x.key === 'stalled:work' && x.severity === 'critical');
    }],
    ['unchanged-block-repeats-after-24h', () => {
      const h = fixture();
      const claim = h.send({type: 'claim', taskId: 'work', worker: 'product', runId: 'run'});
      h.send({type: 'block', ...claim, worker: 'product', runId: 'run', reason: 'Access unavailable'});
      h.send({type: 'scan'});
      return h.send({type: 'scan'}, start + 24 * H).notify.some(x => x.key === 'blocked:work');
    }],
    ['same-hour-does-not-repeat-alert', () => {
      const h = fixture(); h.send({type: 'scan'}, start + 24 * H);
      return !h.send({type: 'scan'}, start + 24 * H + 1).notify.some(x => x.key === 'stalled:work');
    }],
    ['completed-work-does-not-trigger-stall', () => {
      const h = fixture();
      const claim = h.send({type: 'claim', taskId: 'work', worker: 'product', runId: 'run'});
      h.send({type: 'complete', ...claim, worker: 'product', runId: 'run', evidence: {outcome: 'pass', refs: ['https://example.test/verified-output']}});
      return !api.inspectQueue(h.q, start + 84 * H).some(x => x.key === 'stalled:work');
    }],
    ['one-owned-improvement-review', () => {
      const h = fixture(); h.send({type: 'scan'}); h.send({type: 'scan'}, start + H);
      const tasks = Object.values(h.q.tasks).filter(x => x.id.startsWith('KS-IMPROVE-'));
      return tasks.length === 1 && tasks[0].owner === 'supervisor' && h.q.improvementCycle?.taskId === tasks[0].id;
    }],
  ];
  const results = cases.map(([id, check]) => {
    try { return {id, passed: check() === true}; }
    catch (error) { return {id, passed: false, error: error.message}; }
  });
  return {caseCount: results.length, passed: results.filter(x => x.passed).length, results};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const api = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : './queue.mjs');
  const result = evaluateDelivery(api);
  console.log(JSON.stringify(result, null, 2));
  if (result.passed !== result.caseCount) process.exitCode = 1;
}
