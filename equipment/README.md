# Daily equipment verification and release

Goal: more than 1,000 real distinct equipment entries on the live platform by 2026-10-31. The verified source baseline on 2026-10-15 is 444 rows at main f44cb7cf826ba4a62de0652728b52c1783919597. The parent independently verified the initial live app at 444 on 2026-10-15 at 16:18 UTC. At 17:17:25 UTC, authenticated production verification confirmed both catalogue endpoints at 483, matching source with all 39 additions present; production interactive browser QA remains untested. See the ledger for the complete deployment receipt. At least 557 net additions are needed from that baseline. Aim for 35–40 daily, split into small manufacturer-specific reviewable batches; evidence quality takes priority.

## Daily execution instruction

1. Fetch main, inspect current instructions and open equipment PRs, and resume unfinished batches before creating a new batch. Preserve unrelated work, including draft PR #6. One owner integrates changes; independent researchers may collect evidence.
2. Read `batch-ledger.json`, `next-batch-queue.json`, `catalogue-evidence.json`, and current `cat.js`. Record source/merged/live counts separately. Read the actual production `/app/catalogue.json` and exercise app search/selection before reporting delivered entries. A merge or successful preview alone is not delivery.
3. Resolve the legacy 455 held candidates from their original Sheet/CSV when accessible; they are candidates, not certified equipment. PR #5 and import-queue.mjs reference that queue but omit its ID. Do not invent its contents. Deduplicate new research against both main and the restored queue; do not count the same manufacturer's SKU twice because its display name differs.
4. Select a small manufacturer batch. Retain official exact-model product/specification URLs, retrieval date, revision, field locators, dimensions and their orientation/units, mounting, input power, electrical voltage/phase/frequency, gas requirements, water/drain and installation details. Distinguish unknown from not applicable. For passive units, document the complete mechanical construction supporting utility nonapplicability. Do not extrapolate variants, use shipping dimensions, or copy family-level specifications into exact models. Hold unresolved conflicts with precise missing evidence.
5. Store evidence and per-model status durably. Before importing, record the immediate pre-import main commit as `source_before_sha` and its count as `source_before` in that batch (never reuse the initial baseline for later batches). Append only ready rows through `node import-queue.mjs <batch.csv> --dry`, then the same command without `--dry`. Preserve all existing rows. Check normalized brand/model plus manufacturer SKU aliases, and re-run dry import to establish zero further additions.
6. Run build, existing app/browser and MCP regressions, batch evidence checks, duplicate checks and original-row preservation. Use the pinned Playwright browser normally. If downloads are restricted, the system Chromium can run the same suite with a temporary PLAYWRIGHT_BROWSERS_PATH; disclose that substitution. Do not weaken tests.
7. Open an equipment-only PR, inspect CI, automated review and preview at the latest head, resolve relevant findings and satisfy required approvals. Use the ordinary merge operation without admin bypass. Main is documented to deploy through the connected Cloudflare Worker; never deploy an unreviewed branch to production.
8. Verify production catalog exact rows and app search/add behavior after deployment. Record PR, merge SHA, deployment evidence, timestamp and live count. If blocked, leave delivered count zero/unknown as appropriate and resume verification next run. Update ledger/queue without duplicating candidates.

## Required access

- Repository read/push/PR/check/review access and ordinary merge permission subject to protections.
- Cloudflare connected production deployment and logs/status access if GitHub status is insufficient.
- Network/browser access to kitchenstudio.design and official manufacturer documents.
- Connected Drive access to the original held-candidate Sheet, plus its exact URL/ID (not discoverable in this run's Drive searches).
- Node/npm dependencies and Chromium for the existing test suite.

The parent configures daily scheduling. This repository workflow creates no automation, supplier outreach, purchase, or unrelated product change.
