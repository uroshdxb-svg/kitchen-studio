# Delivery coordination protocol

This reference documents the generic coordination implementation. Runtime identities, private runbooks, account settings, business evidence and customer records are outside its scope.

## Delivery policy

| Condition | Behavior |
| --- | --- |
| No verified task progress for 24 hours | Warning |
| No verified task progress for 48 hours | Critical escalation |
| An unresolved alert stays unchanged for 24 hours | Reminder |
| Severity or reason changes | Immediate notification candidate on the next scan |
| Improvement review completes | Next review due in 84 hours |

The cadence is a policy clock. It does not activate or reconfigure an external scheduler. Actual dispatch depends on an eligible executing host. Earlier task deadlines and existing lease/approval rules continue to apply.

## Owned handoffs

Keep one stable task ID and one current owner. Persist a handoff receipt with exact output evidence; the receiving worker must acknowledge it before acting. Reconcile uncertain external effects before retrying. Do not use a new task ID to evade an occupied resource, attempt cap or unresolved approval.

Every task should define its inputs, required output, acceptance evidence, dependencies and responsible role. A completion claim is distinct from a run starting, a draft existing or an action being requested. The existing reducer preserves the content and release evidence requirements.

## Progress evidence

Creation time starts the delivery clock. Heartbeats, claims, retries, scans and updatedAt do not reset it. A lease-fenced progress command can record a meaningful partial result:

- Unique milestoneId and concise summary.
- Passing evidence with refs, an actual checkedAt, and immutable commit or artifactSha256.
- The check must occur during the current lease. Repeated artifact identities cannot count again.

The host must verify the artifact and its relevance. The reducer checks structure, identity and ownership; it cannot establish the truth of an arbitrary evidence URL.

## Monitoring

inspectQueue is read-only. scan records notification candidates and queues a due review. A repeated unchanged incident stays quiet inside its reminder interval; it remains visible in the issue list. Resolved alerts clear; their earlier operation receipts remain.

Default scans use the primary alert history. scan with channel: "cloud-watchdog" uses an independent history so one monitor cannot consume the other's reminders. lastEmittedAt records a returned notification candidate, not proof that a person saw it. The host must deliver actionable text and report delivery uncertainty.

If monitoring cannot read or commit its checkpoint, report unavailable monitoring. Missing evidence is unknown, not healthy. A missing-worker receipt is also separate from an observed scheduler configuration.

## Improvement review

The first policy scan queues one supervisor-owned review. Keep that task visible until it is handled; repeated scans cannot generate competing reviews. The review itself has a deadline and the same stall checks. It should:

1. Select an observed failure and reproduce it in a sanitized test.
2. Measure the exact baseline version, including successful controls.
3. Make one bounded, reviewable change with a rollback path.
4. Evaluate the candidate against the identical cases and existing regressions.
5. Adopt, keep, revert or explicitly block; retain the evidence and update the relevant operating instructions.

Review completion uses ordinary passing references plus evidence.review:

| Field | Requirement |
| --- | --- |
| decision | adopt, keep, revert or blocked |
| incidentKeys, cause | Referenced failures and actual diagnosis; unknowns stated |
| baselineRevision, candidateRevision | Exact commit identities |
| caseCount, baselinePassed, candidatePassed | Real comparable counts from the same positive case set |
| regressionPassed, testRefs | Actual regression result and evidence |
| nextAction | Concrete continuation or recovery action |

Adoption requires improved targeted pass counts and passing regressions. A review does not grant release authority or prove deployment. If evaluation cannot run, block the task with the real reason rather than inventing scores. The next cycle is due 84 hours after a completed evidence-backed decision. Immediate failures and 24/48-hour escalations do not wait for that review.

## Tests and references

Run `node --test coordination/*.test.mjs` and `node coordination/delivery-evals.mjs`. The latter accepts an optional absolute path to another queue.mjs for comparison against the same sanitized scenarios. The cases cover stale ready work, misleading heartbeats, suppressed repeat alerts, quiet healthy behavior, completed-work exclusion and a single owned review.

Design references consulted 20 October 2026:

- [Anthropic: Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
- [LangGraph: Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Google SRE: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [Anthropic: Demystifying Evals for AI Agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Langfuse: Evaluation](https://langfuse.com/docs/evaluation/overview)

These references inform the existing implementation. No additional framework, paid service, account connection or trace-collection platform is installed by this protocol.
