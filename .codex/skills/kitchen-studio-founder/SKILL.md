---
name: kitchen-studio-founder
description: >-
  Apply eleven founder capabilities to Kitchen Studio's existing agents: strategy review, competitor research, objection rehearsal, pricing experiments, offer design, unit economics, marketing, brand consistency, operations, validation launch and evidence synthesis. Use when updating Kitchen Studio agents, pressure-testing its business, reviewing an offer, planning validation, checking economics or deciding the next commercial move. Keep simulations separate from real demand.
---

# Kitchen Studio Founder Toolkit

Apply the relevant module to the existing responsible role. Use native Codex/GPT Work research, files, Python and available connectors. Read only the modules needed for the current task; do not run eleven reviews or create eleven background agents by default.

## Ground the run

Read the current `Kitchen_Studio_Agent_Playbook.md`, `Kitchen_Studio_Marketing_Operating_Playbook.md`, improvement plan and validation brief. For recruitment, resume `Kitchen_Studio_Acquisition_Pipeline.json` through `$kitchen-studio-acquisition`. Retain its identity/version, suppression and send controls. Current user instructions take precedence over dated playbook text.

Keep private customer, financial and authorization records in the user's private files, outside public source code. Preserve file identity/version on replacement. Store code changes in git; save operational findings with the user's file workflow. If inputs are missing, finish the independent work and label the gap rather than inventing facts or making every question a blocker.

Use the current supported Kitchen Studio claim register. Target small café/QSR operators opening/refitting a kitchen. Treat drawings as concept material for supplier/fabricator review; do not promise engineering, approvals or validated savings. Read current source and verify released behavior before calling a feature usable.

## Route the capabilities

| Capability | Read | Responsible role |
|---|---|---|
| Board/strategy challenge | [board](references/board.md) | Coordinator; Product for experience risks |
| Direct, indirect and substitute research | [competitors](references/competitors.md) | Growth/Marketing; Equipment for source context |
| Buyer objection rehearsal | [consumer](references/consumer.md) | Outreach/CX; Content for wording |
| Pricing experiments | [pricing](references/pricing.md) | Growth/Coordinator |
| Deliverable offer design | [offer](references/offer.md) | Marketing/Outreach |
| Contribution, capacity and cash | [cfo](references/cfo.md) | Coordinator/Growth |
| Positioning and campaign choices | [marketing](references/marketing.md) | Marketing/Growth |
| Approved brand consistency | [brand](references/brand.md) | Content/Marketing |
| Operating routines and cost/risk handoffs | [ops](references/ops.md) | CX/Coordinator; Equipment/Product for dependencies |
| Cheap real validation and readiness | [launch](references/launch.md) | Growth/Product/CX |
| Evidence and decision synthesis | [plan](references/plan.md) | Coordinator |

## Preserve the evidence boundary

Tag every material statement as `observed`, `published`, `hypothesis` or `simulated`, with a dated source/reference and scope. Unknown is null/`not_measured`, not zero. Never turn a source-present feature into deployed success, a candidate into a customer, a free trial into payment, or a synthetic quote into a testimonial.

Use simulated scenarios only to identify objections, missing proof, qualification questions and possible friction. Do not treat synthetic buy rates as conversion forecasts, statistical bounds, price validation, CAC/LTV inputs or a profitability gate. Real replies, supplied plans, sessions and payments must come from real evidence and remain in their own ledger.

Use three analytical passes for board review. Run scenario rehearsal sequentially by default with six relevant cases. Spawn independent agents only when the user or an applicable task workflow explicitly calls for that work; never launch the upstream 100-agent swarm automatically. Reuse current brand/media and the established campaign queue; respect the rejected asset and personal-network exclusion.

## Use the deterministic helper

For economics or current evidence, read [CFO](references/cfo.md) and [Plan](references/plan.md), then run:

```bash
python3 scripts/decision_tools.py --numbers /private/numbers.json --pipeline /private/Kitchen_Studio_Acquisition_Pipeline.json --out /private/decision.md
```

Omit either optional input when unavailable. Start from `assets/numbers-template.json` and fill only sourced numbers or explicitly marked planning hypotheses. The helper has no network, spending, sending or deployment actions. It returns `incomplete`, `projection_fails` or `projection_passes_under_assumptions`; demand evidence is reported separately. It never declares the business validated or profitable from a simulation.

## Close the run

Deliver one packet: conclusion, evidence/revision, strongest objections, measured counts/unknowns, one next test, owner and acceptance rule. Route equipment gaps to Equipment, reproducible failures to Product, and session friction to CX. Record the specific outputs actually completed and save them. Run checks appropriate to any code changes.

Continue already authorized actions without requesting permission again. Prepare a concrete result before any required release decision. Skill installation or an agent-profile update does not authorize sending, publishing, spending, deployment or recurring execution. Keep the user's stop on scheduled project agents in effect.

Read [source and adaptation notes](references/source.md) when inspecting provenance or reviewing an upstream update. Retain the bundled MIT attribution on redistribution.
