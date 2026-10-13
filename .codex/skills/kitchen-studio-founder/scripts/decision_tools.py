#!/usr/bin/env python3
"""Conditional economics and real acquisition evidence. No external actions."""
import argparse
import copy
import json
import math
import re
import sys
from pathlib import Path

FIELDS = ("price", "direct_cost_per_unit", "labor_minutes_per_unit", "labor_rate_per_hour",
          "acquisition_cost_per_unit", "fixed_monthly", "startup", "capacity_per_month")
BASES = {"observed", "published", "hypothesis", "unknown"}


def number(record, label, missing, assumptions):
    if record is None:
        missing.append(label)
        return None
    if not isinstance(record, dict):
        raise ValueError(label + " requires value, basis and source")
    basis = record.get("basis", "unknown")
    if basis not in BASES:
        raise ValueError(label + ": simulated inputs are not financial/demand evidence")
    value = record.get("value")
    if value is None or basis == "unknown":
        missing.append(label)
        return None
    if type(value) not in {int, float} or not math.isfinite(value) or value < 0:
        raise ValueError(label + " must be a finite nonnegative number")
    if not isinstance(record.get("source"), str) or not record["source"].strip():
        raise ValueError(label + " requires provenance, including planning assumptions")
    if basis == "hypothesis":
        assumptions.append(label)
    return float(value)


def economics(spec):
    if spec is None:
        return {"status": "incomplete", "missing": ["financial inputs"], "assumptions": []}
    currency = spec.get("currency", "")
    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise ValueError("Explicit three-letter currency is required")
    if not isinstance(spec.get("sale_unit"), str) or not spec["sale_unit"].strip():
        raise ValueError("Select one billed sale unit")
    missing, assumptions = [], []
    values = {key: number(spec.get(key), key, missing, assumptions) for key in FIELDS}
    ramp = spec.get("units_per_month")
    if ramp is None:
        ramp = [None] * 12
    if not isinstance(ramp, list) or len(ramp) != 12:
        raise ValueError("units_per_month needs twelve entries")
    units = [number(row, f"units_per_month[{i + 1}]", missing, assumptions) for i, row in enumerate(ramp)]
    if missing:
        return {"status": "incomplete", "currency": currency, "sale_unit": spec["sale_unit"],
                "missing": missing, "assumptions": assumptions}
    labor = values["labor_minutes_per_unit"] / 60 * values["labor_rate_per_hour"]
    before_acquisition = values["price"] - values["direct_cost_per_unit"] - labor
    contribution = before_acquisition - values["acquisition_cost_per_unit"]
    breakeven = values["fixed_monthly"] / contribution if contribution > 0 else None
    cumulative = -values["startup"]
    cash_needed = values["startup"]
    payback = 0 if values["startup"] == 0 else None
    months = []
    for month, count in enumerate(units, 1):
        revenue = count * values["price"]
        operating_result = count * contribution - values["fixed_monthly"]
        cumulative += operating_result
        cash_needed = max(cash_needed, -cumulative)
        if payback is None and cumulative >= 0:
            payback = month
        months.append({"month": month, "units": count, "revenue": revenue,
                       "operating_result": operating_result, "cumulative_after_startup": cumulative})
    year_result = sum(row["operating_result"] for row in months)
    failures = []
    if contribution <= 0:
        failures.append("Nonpositive contribution after delivery, founder labor and acquisition allocation")
    if year_result <= 0:
        failures.append("Nonpositive projected year-one operating result")
    if breakeven is None or breakeven > values["capacity_per_month"]:
        failures.append("Monthly break-even cannot fit supplied capacity")
    if max(units) > values["capacity_per_month"]:
        failures.append("Forecast volume exceeds supplied monthly capacity")
    return {"status": "projection_fails" if failures else "projection_passes_under_assumptions",
            "currency": currency, "sale_unit": spec["sale_unit"], "missing": [], "assumptions": assumptions,
            "price": values["price"], "labor_per_unit": labor,
            "contribution_before_acquisition": before_acquisition,
            "contribution_after_acquisition": contribution,
            "monthly_break_even_units": breakeven, "capacity_per_month": values["capacity_per_month"],
            "year_one_revenue": sum(row["revenue"] for row in months),
            "year_one_operating_result": year_result, "year_one_after_startup": year_result - values["startup"],
            "cash_needed_under_model": cash_needed, "startup_payback_month": payback,
            "months": months, "failures": failures,
            "scope": "Conditional operating projection before taxes; not confirmed net profit or demand"}


def evidence(pipeline):
    if pipeline is None:
        return {"status": "not_measured", "source": "No acquisition ledger supplied", "paid_customers": None}
    if pipeline.get("schema_version") != 1 or not isinstance(pipeline.get("leads"), dict):
        raise ValueError("Expected acquisition ledger schema 1")
    leads = list(pipeline["leads"].values())
    result = {"ledger_revision": pipeline.get("revision"), "candidates": len(leads),
              "qualified": 0, "plan_received": 0, "pilot_completed": 0,
              "supplier_handoff_useful": 0, "paid_projects": 0, "paid_customers": 0,
              "unmeasured": {key: 0 for key in ("plan_received", "pilot_completed", "supplier_handoff_useful", "paid")},
              "invalid_evidence": []}
    paid_domains = set()
    for lead in leads:
        qualification = lead.get("qualification", {})
        if qualification.get("status") == "qualified":
            checks = all(qualification.get(key) is True for key in
                         ("active_within_6_months", "has_plan", "decision_influence"))
            if checks and qualification.get("evidence") and lead.get("replies"):
                result["qualified"] += 1
            else:
                result["invalid_evidence"].append(lead.get("id", "unknown") + ": qualification lacks confirmation")
        outcomes = lead.get("outcomes", {})
        for key in result["unmeasured"]:
            outcome = outcomes.get(key)
            if outcome is None:
                result["unmeasured"][key] += 1
                continue
            valid = isinstance(outcome, dict) and type(outcome.get("value")) is bool and bool(outcome.get("evidence"))
            if key == "paid" and valid and outcome["value"]:
                amount = outcome.get("amount")
                valid = (type(amount) in {int, float} and math.isfinite(amount) and amount > 0
                         and bool(re.fullmatch(r"[A-Z]{3}", outcome.get("currency", ""))))
            if not valid:
                result["unmeasured"][key] += 1
                result["invalid_evidence"].append(lead.get("id", "unknown") + ": invalid " + key)
                continue
            if outcome["value"]:
                if key == "paid":
                    result["paid_projects"] += 1
                    paid_domains.add(lead["domain"])
                else:
                    result[key] += 1
    result["paid_customers"] = len(paid_domains)
    result["status"] = "observed_paid_interest" if paid_domains else "demand_unvalidated"
    result["scope"] = "Recorded evidence, not independently verified profitability or broad market validation"
    return result


def evaluate(spec=None, pipeline=None):
    projection = economics(spec)
    result = {"economics": projection, "real_customer_evidence": evidence(pipeline),
              "simulation_used_for_verdict": False}
    if spec is not None and projection["status"] != "incomplete":
        scenarios = []
        for label, changes in (("price_minus_10pct", {"price": .9}),
                               ("volume_minus_20pct", {"units_per_month": .8}),
                               ("direct_and_labor_cost_plus_15pct", {"direct_cost_per_unit": 1.15, "labor_rate_per_hour": 1.15})):
            modified = copy.deepcopy(spec)
            for key, factor in changes.items():
                rows = modified[key] if isinstance(modified[key], list) else [modified[key]]
                for row in rows:
                    row["value"] *= factor
                    row["basis"] = "hypothesis"
                    row["source"] = "Sensitivity: " + label + "; based on " + row["source"]
            outcome = economics(modified)
            scenarios.append({"scenario": label, "status": outcome["status"],
                              "contribution_after_acquisition": outcome["contribution_after_acquisition"],
                              "monthly_break_even_units": outcome["monthly_break_even_units"],
                              "year_one_operating_result": outcome["year_one_operating_result"]})
        result["sensitivities"] = scenarios
    return result


def report(result):
    return ("# Kitchen Studio founder decision evidence\n\n"
            "Economics are conditional on the supplied assumptions. Customer outcomes below come from the recorded ledger.\n"
            "Simulated scenarios do not validate demand, price, conversion or profit.\n\n"
            "```json\n" + json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n```\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--numbers", type=Path)
    parser.add_argument("--pipeline", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    read = lambda path: json.loads(path.read_text()) if path else None
    result = evaluate(read(args.numbers), read(args.pipeline))
    if args.out:
        if args.out.resolve() in {path.resolve() for path in (args.numbers, args.pipeline) if path}:
            raise ValueError("Output must not overwrite an input")
        args.out.write_text(report(result))
        print(json.dumps({"path": str(args.out), "economics": result["economics"]["status"],
                          "demand": result["real_customer_evidence"]["status"]}))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, TypeError, KeyError, OSError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        sys.exit(2)
