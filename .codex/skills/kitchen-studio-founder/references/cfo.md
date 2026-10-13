# CFO: assumptions and deterministic economics

Start with `assets/numbers-template.json`. Select one billed unit: paid project or customer-month. Avoid mixing a one-off package with subscription retention. Allocate acquisition cost per billed unit explicitly; do not claim LTV/CAC without measured cohort retention and acquisition costs.

Each input is `{value, basis, source}`. Basis is `observed`, `published`, `hypothesis` or `unknown`. Use null for missing values. Source actual receipts/quotes first, public prices second, and explicit forecast assumptions third. Never import simulated purchases or price answers as demand inputs.

Required economics inputs are price, direct cost per unit, service minutes per unit, labor rate per hour, acquisition allocation per unit, monthly fixed costs, startup costs, monthly capacity and twelve monthly volume entries. Include payment/expected refund costs and variable hosting/AI in direct cost; include ongoing support and relevant data work in labor. Do not count founder time as free. Keep currency explicit. Revenue is before taxes and this is a defined-scope operating model, not verified net profit.

Run:

```bash
python3 scripts/decision_tools.py --numbers /private/numbers.json --pipeline /private/Kitchen_Studio_Acquisition_Pipeline.json --out /private/decision.md
```

The helper computes unit contribution before/after acquisition allocation, monthly break-even, twelve-month cash needs, payback and price/volume/cost sensitivities when the inputs are complete. Unknown inputs produce an incomplete model, not assumed zeros. Nonpositive contribution and capacity violations fail the projection. The output does not certify the business as profitable.

Return the highest-sensitivity assumption, minimum missing inputs, a realistic capacity limit and one cost/offer experiment. Keep real customer evidence separate. Do not invent supplier, payment or tax prices; look up current official sources if those values are part of the task.
