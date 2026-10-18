# Coordinated Kitchen Studio workers

Workers wake on their existing schedules and poll this queue. A handoff makes work available for the next eligible poll; it does not invoke an unsupported webhook or promise laptop-off execution. `workers.json` records the intended role map and the 1,001-live-item target for 31 October. It is not proof that schedules were changed.

## One durable queue across environments

The queue is `coordination/queue.json` on the dedicated `coordination-state` Git branch in this repository. Application source stays on main. Never put customer records, credentials, buyer-question banks, commercial hypotheses, raw private notes or private document URLs on this public branch. Store only sanitized task IDs, roles, public evidence references, artifact hashes and outcomes. Public lease tokens are fencing identifiers, not credentials. Repository write access is the trust boundary.

**Activation gate observed 15 October 2026:** the bounded connected pilot proved GitHub CAS, but Cloudflare currently builds and deploys a preview after each coordination-state commit. Do not enable recurring ledger writes until the authorized configuration owner excludes that metadata branch, or a supported non-deploying CAS backend is verified. Do not silently change Cloudflare settings or mistake a successful preview check for a skipped build. Source and tests can ship while this operational gate remains explicit.

Use the connected GitHub tools already authorized for this repository. No new account, service, token, database or scheduler configuration is required. Do not edit Codex's hidden scheduler database or TOML files. If the calling environment cannot update a schedule through the supported scheduler API, record that exact blocker and leave the configuration unchanged.

### Optimistic transaction protocol

The preferred small-call path is `githubContentsStore` in `github-store.mjs`: map `readFile` to connected `fetch_file`, unwrap its `{content,sha}`, and map `updateFile` to connected `update_file`. The latter sends the observed **blob SHA** to GitHub's Contents API, which rejects a stale file replacement. Map an explicit GitHub 409/SHA mismatch to `{conflict:true}`; propagate other failures/uncertain responses and reread before replay. A successful transaction reads state, conditionally writes it, then reads the exact returned commit and checks its blob and complete content. `readFile` must honor the supplied `ref`, including immutable commit SHAs; a bridge returning a static cached snapshot fails closed. Budget all three calls, never parallelize same-file writes, and do not treat a write response alone as an acquired lease. This path avoids creating blobs/trees/commits in separate calls. Use bounded `batch` to atomically record a worker tick, enqueue an actually due unit and claim it within one transaction. Per-run call/quota bounds still apply; checkpoint when contention consumes the budget.

The equivalent lower-level Git protocol is:

1. Read `refs/heads/coordination-state` and its commit/tree SHA, then fetch the queue at that **exact commit**, not an unpinned moving branch. Reject a missing/malformed queue; initialization is a separate one-time action and must never overwrite existing state.
2. Read fresh UTC time. Prepare a stable command ID such as `KS-EQ-20261016-<batch>:claim:<run-id>`. Preserve the exact command for a lost-response retry. Never reuse an ID with different arguments.
3. Download the reviewed reducer and its pinned workers.json registry from the same current main commit when they are not already available. Run `node coordination/cli.mjs apply QUEUE.json COMMAND.json NEXT.json`. This creates a **local candidate**, not a committed claim. CLI files are per-run private scratch files, never a shared mutable queue.
4. Create a blob containing NEXT.json, a tree based on the observed state tree changing only `coordination/queue.json`, and a commit with **one parent: the observed state head**. Connected GitHub `create_blob`, `create_tree` and `create_commit` support these operations.
5. Update `coordination-state` with `update_ref`, `force=false`, and `expected_sha` equal to the observed head. Never force a state write. Git's fast-forward rule is the atomic guard: two sibling candidate commits cannot both fast-forward the same ref. A preliminary expected-SHA check alone is insufficient.
6. If rejected or uncertain, reread the ref and queue, then replay the **same command ID** against fresh state/time. A committed operation returns its original receipt, including lease token; a competing claim is denied. Retry at most five CAS conflicts, then checkpoint/back off. Do not retry a charged generation, publication or deployment just because its response was lost.
7. Only act after the committed queue readback confirms the lease. Use per-task deterministic external operation IDs and recheck current ownership and unexpired lease immediately before each external side effect. A queue lease cannot cancel a side effect already in flight. After a lost lease, reconcile actual GitHub/deployment/file results; never assume nothing happened.

`transact(store, command)` implements this replay contract for an injected CAS store. Use its default fresh clock, or a function returning fresh UTC per replay; numeric clocks exist for deterministic tests. Hosts must have trustworthy clocks. Backwards state time fails closed. Client checks cannot make a remote ref enforce a wall-clock deadline, so renew before long operations, stop near expiry and independently reconcile uncertain effects.

## Work lifecycle

Start every wake by recording `worker_tick`, reading existing tasks and receipts, and claiming the oldest eligible assigned work. Do not invent another task while an equivalent ID/dedupe key or unresolved resource already exists. For a genuine recurring unit, derive its ID from the Dubai date and the existing batch/asset/revision identifier. Import outstanding work from the existing manufacturer batch queue or role checkpoint before proposing new work.

- `enqueue`: stable ID, owner role, kind (`work`, `release`, `content`), dependencies, bounded attempts, optional deadline and exclusive resource. Dependencies must already exist. Use `catalogue-writer` for **every** catalogue-writing/release task across all workers. Occupied, blocked, approval-held and retrying resources cannot be bypassed by minting another task ID.
- `batch`: at most ten ordinary commands in one atomic candidate (no nested batches). The outer ID and every inner ID remain idempotent. A failing command discards the whole candidate; publish it only through the shared CAS store.
- `claim`: requires assigned role, eligible dependencies and backoff. Returns a run-bound token and monotonically increasing generation. Heartbeat at useful checkpoints, generally within five minutes; leases last at most 30 minutes. Only one committed claim wins.
- `heartbeat`, `complete`, `handoff`, `fail`, `block`: require current worker, run ID, token, generation and an unexpired lease. Old owners cannot finish work after reacquisition.
- `handoff`: atomically stores a unique receipt, evidence and target role, removes the source lease and enters `awaiting_ack`. The target uses `accept` with that exact receipt to acknowledge and acquire the next lease. A lost handoff/ACK response is recovered by operation replay. Overdue ACKs are visible to the supervisor; they are never silently dropped.
- `fail`: explicitly classified safe retry gets exponential backoff (one minute, doubling to one hour), with per-stage and total acquisition limits. Nonretryable failures become `blocked`.
- `sweep`: an expired unknown outcome becomes blocked for reconciliation. Only `work` explicitly marked `retrySafe:true` may automatically back off after expiry; releases and content generation cannot opt in. Blocked/approval tasks never auto-restart.
- `resume`: supervisor-only, non-approval blockers, new resolution evidence required. Total acquisition cap is retained. Exhausted budgets need a separately identified, justified follow-up task rather than an invisible counter reset.
- `request_approval` / `resume_approved`: supervisor-only, same-task scoped approval lifecycle described below. A valid still-matching decision does not require retirement or another task. Neither command grants platform permissions.
- `retire`: supervisor-only for inactive work, with resolution references, explicitly closes the old record as cancelled and frees its resource. First reconcile external effects. An approval-held record additionally needs the actual human decision and its reference; verify that trusted conversation evidence rather than manufacturing a reference. Retirement never marks work delivered or executes the approved action. Approved follow-up work gets a new stable ID and explicit scope; declined work stays closed. There is no automatic approval command. A queue record does not grant authority. Dependents of cancelled work remain attention items, not automatically completed.
- `complete`: work needs passing evidence; content additionally needs an exact artifact SHA-256 and completed QA. A release additionally needs exact commit, passing CI, deployment evidence and actual production URL/readback timestamp. A draft, PR, merge, preview or unverified deploy alone is insufficient. Workers must verify the referenced observations; the reducer validates evidence structure, not the truth of a URL.

## Supervision and quiet notifications

### Same-task approval and trusted provenance

`request_approval` binds inactive `ready`, `retry_wait` or legacy `needs_approval` work using a fresh `expectedGeneration` and exact `expectedUpdatedAt`. Supply `scope: {action, target, revision}`: one named action, an exact target, and an immutable 40-character commit or 64-character artifact hash. The returned request includes its ID, task/owner/specification hash, generation and original hold time. Repeated identical requests return that recorded binding; a pending request cannot silently change scope. Legacy holds keep their original hold time, so a real decision made after the hold but before metadata binding can be verified without asking again.

For a consumed grant in `retry_wait`, the supervisor must first supply a new `resolution` and bounded evidence `refs` reconciling the external outcome. The trusted host must independently verify those references against the actual operation before accepting the new decision; descriptive text is not reconciliation. The request retains that reconciliation and the original `retryNotBefore`; neither requesting nor recording a fresh decision clears backoff or resets counters. `resume_approved` returns `retry_wait` while that time is still in the future, then the existing claim guard permits one fresh approved attempt only after backoff. Approval expiry while waiting remains visible. A retry classification or a new decision alone is not evidence that an uncertain merge/publication never happened.

`resume_approved` supplies the task ID, supervisor role and a bounded approval receipt: `id`, `decision: "approved"`, `reference`, `requestId`, the exact `scope`, `taskHash`, `generation`, `issuedAt` and `expiresAt`. Validity is positive and at most 24 hours. Issuance must be after the hold, not in the future, and expiry/deadline must remain valid through the conditional write. Use the actual decision's time and scope; never invent these from a relay or a broad approval for another action. Approval does not reset stage/total acquisition counters, change owner/resource/dependencies, or discard audit history. Exhausted budgets remain explicit blockers.

The reducer and CLI fail closed without a trusted host verifier. The connected host must supply its existing authorized decision resolver, for example:

```js
await transact(store, resumeCommand, () => Date.now(), {
  maxRetries: 2,
  authorizeApproval: trustedHost.verifyScopedDecision,
});
```

The verifier receives `{taskId, request, approval}` and must independently resolve the referenced human decision through an already authorized trusted surface, check the exact action/target/revision and times, and return literal `true` only when that evidence and the platform's current authorization rules permit it. Async verifiers are supported by `transact`; they are re-evaluated after CAS conflicts. Pure `applyCommand` supports only an explicit synchronous verifier. There is no always-approve production fallback, and this patch installs no trusted resolver. A queue string, saved file, forwarded transcript, coordinator summary or successful unit-test fixture is not human authorization. If the platform rejects a cross-chat approval or message, leave that action stopped and request its narrow supported authorization; this module cannot override it.

The assigned owner then claims with `approvalScope` matching the stored action/target/revision. The approved pending claim retains its exclusive resource reservation; expiry remains an explicit supervisor alert rather than freeing the resource for a competing task. That grant is consumed for one lease generation. Replays return the recorded receipt; a duplicate resume never revives `blocked`, leased or completed work and reports its current state. Unknown external outcomes still require reconciliation and a new scoped decision before another attempt. Approval history survives handoff, but action authority does not transfer to the recipient's new lease generation.

Immediately before the external action, read fresh shared state and the actual target revision, then call `assertApprovedAction(queue, {...leaseFence, approvalScope}, freshUtc)`. Keep the downstream service's own immutable guard, such as GitHub `expected_head_sha`; a local assertion cannot prevent a later remote head change. Approval-bound claims/renewals cannot extend beyond the approval expiry or task deadline. Fresh lease/readback, usage/model gates, service permissions and genuine completion evidence all remain required.

This lifecycle does not retroactively reopen retired work, reset an exhausted release, replay a merge/publication, clear activation holds, or change workers, schedules, platform/account permissions, content QA or production configuration. Existing equipment verification and security blockers remain separate. A draft PR and protocol tests are not operational activation.

The existing hourly supervisor runs `inspectQueue`, then `scan` to persist alert fingerprints. Inspect before sweeping so expired leases remain distinguishable from subsequent blocked states. Watch expired leases, overdue handoff receipts, blocked dependencies, missed worker receipts and deadlines. The registry includes expected roles before their first tick; startup anchors are persisted once (legacy state uses earliest committed operation time), so never-started workers cannot disappear from monitoring. Missing startup history is an explicit uninitialized warning, never a healthy default. Repeated unchanged scans produce no new notification. Deliver meaningful state changes, approval needs, material blockers, milestones or deadline risk only; ordinary success stays quiet. Failed-runs-only scheduler settings may suppress ordinary role messages but do not themselves implement semantic alert routing.

Keep one catalogue pipeline owner. The older half-hour importer and daily researcher have useful evidence but stale independent release cursors; preserve and reconcile their checkpoints before stopping duplicate dispatch. The hourly supervisor owns escalation and existing CEO incidents, while specialists own concrete evidence tasks. One media worker owns recovery/QA and the approved drawing-led production direction; growth's second production lane and the finite experiment should become queued work, not competing generators.

The coordination request adds no permission to publish, contact suppliers/customers, purchase, change accounts/security or consume recurring paid-generation credits. Preserve actual asset approvals. The corrected drawing-led sample was approved; that clears its creative hold, not all future publication or spending gates. Do not revive rejected samples. Quota gates and inability to save a handoff are explicit blockers, not healthy outcomes. Existing authorized research and exact-model additive catalogue releases retain their actual authority and verification gates.

## Checks and pilot

```
node --test coordination/*.test.mjs
node coordination/pilot.mjs
node coordination/cli.mjs init
node coordination/cli.mjs inspect PRIVATE_QUEUE_SNAPSHOT.json
```

The runnable pilot uses an in-memory CAS store: two claimants race, one wins, a handoff response is replayed, a target acknowledges and records verified completion. It makes zero product or external writes. Tests cover contention, lost responses, no lost handoff, lease fencing, exclusive resources, stale detection, bounded backoff and proof gates. This pilot is a protocol demonstration, not evidence that a scheduled worker executed. A separate connected-GitHub pilot/readback is needed to prove shared-state access in each environment.
