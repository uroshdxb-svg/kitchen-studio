# Kitchen Studio system view

## Mission Control visual direction

The dark navy orbital layout implements a parent-verified visual specification (1672x941). The parent inspected the actual reference pixels and owns reference comparison; this executor implemented from the inspected specification.

Six read-only views cover Overview, Agents, Missions, Evidence, Handoffs and Activity. Native dialog drawers support worker/mission drilldown, keyboard Escape and focus return. Task search, role/state filters, incident inspection and timestamped activity use only the public projection. Evidence links allow only exact HTTPS PR/commit/CI paths in this repository, without query strings, fragments or embedded credentials. The public view has no action controls; a link opens the separate owner sign-in shell. Static orb/connector glow is decorative; only the existing verified lease dot can pulse. Mobile uses a compact orbital graphic plus readable worker cards rather than a scaled desktop image.

`/system/` is a read-only view of nine worker roles. `/system/state.json` reads the existing public coordination-state ledger, limits the upstream response to1MiB/5seconds, and returns an explicit allowlist. Tokens, fencing generation/run IDs, operation history, raw evidence, account data and private checkpoints are never sent in that public feed. The separate owner view and fail-closed API are described in [OWNER-DECISIONS.md](OWNER-DECISIONS.md). No schema, permissions, credentials, scheduler or infrastructure changes are applied by this PR.

The browser performs one non-overlapping read every60seconds while visible, times out at8seconds, and throttles manual refresh to15seconds. Responses use no-store. A failed read displays an offline snapshot; a successful read older than90seconds displays stale. Activity is recomputed everysecond even between fetches. Pulse requires a structurally verified lease owned by that role, expiry in the future, heartbeat no more than5minutes old and not in the future, and a current successful feed. A tick or enabled schedule never pulses. Reduced motion suppresses animation. Pending QA/approval/handoff, queued, done, expired and unobserved states stay distinct.

Cadences are nominal public-registry descriptions, not live scheduler readback. Exact next wakes are not exposed and remain unknown.483/1,001 is explicitly the15October2026 observed baseline and31October goal, not a live catalogue count. Work outside the shared ledger may be unobserved. No claim of constant execution is made.

Existing Worker preview hosts serve only the new/system routes without the normal canonical-domain redirect, so a preview can actually show the dashboard. Other aliases/app routes retain existing behavior. Production is unaffected until an explicit reviewed merge/deploy.

Tests: `node --test system/*.test.mjs`; existing hosted CI runs `npm run test:system` after the normal regressions. Browser tests intercept only isolated HTTP fixtures and never mutate the shared queue. Fixture screenshots carry a conspicuous test label; separate observed screenshots use a fresh public read. Evidence is uploaded with the existing browser-test-results artifact. A platform/build preview is not production.
