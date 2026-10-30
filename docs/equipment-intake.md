# Equipment intake — first implementation

Users can open **Equipment → Add equipment from a quotation**, review equipment lines, confirm exact identity/configuration/dimensions, and save private models or place a batch. This implementation is a review build, not a production release.

## Implemented

- CSV/TSV parsing on the device; manual entry; PDF, JPEG/PNG/WebP and pasted-text extraction through the existing signed-in AI endpoint. Explicit consent is required before document content goes to AI.
- Limits: 10 MB file, four PDF pages, 60,000 text characters, 50 lines and 100 placed pieces per batch. Oversized PDFs and truncated extraction are rejected, never silently partially imported. Excel workbooks must first be exported as CSV.
- Editable review with exact brand/model matches, configuration/dimension/utility differences, explicit catalogue selection, and confirmation. Missing dimensions/placement keep a line in the browser draft. Unchecked lines remain available for later completion.
- Catalogue choices carry a specification fingerprint in the draft. Reordering the catalogue preserves the choice; changed specifications require confirmation again. Placed items retain their specification snapshot.
- New equipment remains `conf: user`, `verification: unverified`. Unknown utility values stay null in saved equipment, schedules, CSV/PDF exports and the MCP schedule. Totals flag missing requirements. Quantity is not a property of the shared model.
- Saved private models use the existing owner-scoped `equipment` table. Intake drafts and local model copies are scoped by signed-in account (or a separate device scope). Original files are never persisted. Draft excerpts remain local and are excluded from project and contribution payloads.
- Confirmed contribution requests use the existing `reports` insert path (`kind: equipment`, `view: equipment-intake`). The payload contains an allowlisted product record and stable `submissionId`, not a quotation, excerpt, prices or quantity. The account still identifies the sender. Users can retry failed saves/requests; confirmed requests are not sent again.
- Placement has stable per-row/per-copy identifiers to prevent duplicate layout items on a retry. Batch placement is one undo step. Saved models and draft completion are independent from placement.

## Reviewer handoff and next increment

The existing Supabase reports table is the initial reviewer inbox. Filter `view = equipment-intake`; group by `context.submissionId`. A response lost after insertion can produce duplicate reports on an explicit retry, so this ID must be used to reconcile requests. A database-backed unique submission record is the next hardening step.

`Review requested` means only that the existing report API acknowledged the insert. It does not mean reviewed, manufacturer-verified, approved, scheduled or published. The browser does not have read access to reports, and this version does not claim live review-status tracking.

For a request to enter the shared catalogue, a reviewer still needs the existing equipment-research readiness process: exact variant/market, field-level manufacturer evidence, installation/revision checks, passing readiness certificate, catalogue-only import, release checks and live readback. No code in this feature publishes catalogue records or marks a submission verified.

Remaining product work: dedicated review/status service and reviewer screen, server-enforced submission idempotency, manufacturer research integration, and user adoption of verified revisions. No database migration, new access grant, new paid provider, deployment or automated research schedule is included in this change.

## Validation and preview

```
npm run build
npm run test:intake
npm test
node serve.mjs 5188
```

Open `http://localhost:5188/app/`. Local CSV and manual entry work without signing in. Live document reading uses the configured AI provider and account allowance; the automated tests substitute the AI/backend and make no paid inference calls. PDF parsing and rendering in the tests use the real bundled PDF library, and browser tests cover desktop/mobile review, save/reload, unknown values, failed saves/retry, contribution privacy and catalogue selection.

On Windows with Chrome installed, set `KS_TEST_EXECUTABLE` to the Chrome executable if the matching Playwright Chromium is not installed. The full catalogue renderer suite remains a separate `npm run test:3d`/CI check.
