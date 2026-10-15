# Kitchen Studio system view

`/system/` is a read-only view of nine worker roles. `/system/state.json` reads the existing public coordination-state ledger, limits the upstream response to1MiB/5seconds, and returns an explicit allowlist. Tokens, fencing generation/run IDs, operation history, raw evidence, account data and private checkpoints are never sent to the browser. No auth, write API, queue migration, scheduler change or new infrastructure is added.

The browser performs one non-overlapping read every60seconds while visible, times out at8seconds, and throttles manual refresh to15seconds. Responses use no-store. A failed read displays an offline snapshot; a successful read older than90seconds displays stale. Activity is recomputed everysecond even between fetches. Pulse requires a structurally verified lease owned by that role, expiry in the future, heartbeat no more than5minutes old and not in the future, and a current successful feed. A tick or enabled schedule never pulses. Reduced motion suppresses animation. Pending QA/approval/handoff, queued, done, expired and unobserved states stay distinct.

Cadences are nominal public-registry descriptions, not live scheduler readback. Exact next wakes are not exposed and remain unknown.483/1,001 is explicitly the15October2026 observed baseline and31October goal, not a live catalogue count. Work outside the shared ledger may be unobserved. No claim of constant execution is made.

Existing Worker preview hosts serve only the new/system routes without the normal canonical-domain redirect, so a preview can actually show the dashboard. Other aliases/app routes retain existing behavior. Production is unaffected until an explicit reviewed merge/deploy.

Tests: `node --test system/*.test.mjs`; existing hosted CI runs `npm run test:system` after the normal regressions. Browser tests intercept only isolated HTTP fixtures and never mutate the shared queue. Fixture screenshots carry a conspicuous test label; separate observed screenshots use a fresh public read. Evidence is uploaded with the existing browser-test-results artifact. A platform/build preview is not production.
