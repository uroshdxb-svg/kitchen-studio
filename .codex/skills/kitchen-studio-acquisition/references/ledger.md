# Private acquisition ledger

`scripts/pipeline.py` uses Python's standard library. It stores public-source provenance, drafts, hash-bound authorization, reservations, replies, suppression and outcome evidence. It never sends messages or accesses the network. Native GPT/Work tools do research and authorized external actions.

## Commands

```bash
python3 scripts/pipeline.py init --db /private/Kitchen_Studio_Acquisition_Pipeline.json --profile /private/profile.json
python3 scripts/pipeline.py status --db /private/Kitchen_Studio_Acquisition_Pipeline.json
python3 scripts/pipeline.py apply --db /private/Kitchen_Studio_Acquisition_Pipeline.json --expect-revision 0 --events /private/events.json
python3 scripts/pipeline.py check --db /private/Kitchen_Studio_Acquisition_Pipeline.json --draft draft_id
python3 scripts/pipeline.py packet --db /private/Kitchen_Studio_Acquisition_Pipeline.json --out /private/review.md
```

Use paths from the actual runtime. `apply` takes an event array and commits it atomically. Read status again after a conflict; do not overwrite. A lock prevents simultaneous writers. Local revision and file-connector version guards are separate; preserve both.

## Events

Import a public lead:

```json
{
  "op":"lead", "name":"Example Café", "domain":"https://example.com",
  "project":"new-branch", "origin":"public_business", "email":"team@example.com",
  "contact_source":"https://example.com/contact",
  "sources":[{"url":"https://example.com/locations","observed_at":"2026-10-13","signal":"Company announces a forthcoming branch"}],
  "score":5, "score_reason":"Relevant café and opening signal; planning stage unknown",
  "gaps":["Confirm timing", "Confirm plan", "Confirm decision influence"]
}
```

Lead ID hashes normalized domain + project key. Reimport merges new sources without resetting status or replies. Group projects before approaching one inbox.

Draft:

```json
{"op":"draft","lead_id":"lead_id","kind":"initial","sender":"","subject":"Project question","body":"Exact message and signature"}
```

Empty sender is allowed for preparation. Set the verified mailbox before authorization. To edit, include existing `draft_id`; recipient always comes from the lead's published email. Edits invalidate authorization; identical drafts deduplicate. Use `kind:"response"` plus `reply_id` for a real reply, or `kind:"followup"` for an unanswered accepted initial message. Supply `provider_thread_id` on responses when available.

Authorize, reserve and receipt:

```json
{"op":"authorize","draft_id":"draft_id","content_hash":"hash_from_packet","instruction":"Actual user instruction authorizing this exact message","actor":"user"}
{"op":"reserve","draft_id":"draft_id"}
{"op":"receipt","draft_id":"draft_id","attempt_id":"returned_token","result":"accepted","provider_id":"actual_message_id"}
```

Copy authorization only from the real conversation; the script cannot verify who issued an instruction. `reserve` validates the exact hash and returns a message for one connector call. Save the reserved ledger before that call. Use `unknown` for uncertainty and `failed` only for a definite non-send. Reconcile unknown to accepted/failed only with `provider_evidence`. Never infer success or automatically resend; there is no reset/retry command.

Replies, qualification and outcomes:

```json
{"op":"reply","lead_id":"lead_id","provider_id":"incoming_id","kind":"interested","text":"Original reply","provider_thread_id":"thread_id"}
{"op":"qualify","lead_id":"lead_id","active_within_6_months":true,"has_plan":true,"decision_influence":true,"evidence":"Reply/session reference confirming the checks"}
{"op":"outcome","lead_id":"lead_id","metric":"pilot_completed","value":true,"evidence":"Session date and actual observation"}
```

Qualification fields accept true/false/null. Only all true marks qualified. Outcome metrics are `plan_received`, `pilot_completed`, `supplier_handoff_useful`, `paid`; unknown is null. Each measurement requires evidence. A payment also requires a positive `amount` and three-letter `currency`. Reply kinds: interested, question, later, declined, opt_out, bounce. Explicit stop/remove wording is conservatively upgraded to opt-out.

## Storage

Keep ledger/packet private and preserve file identity/version metadata. Never commit contacts, plans, sender IDs, authorization quotes or provider receipts to a public repository. Commit only reusable skill instructions/scripts. Audit events distinguish observations from actions.
