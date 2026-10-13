#!/usr/bin/env python3
"""Private, atomic acquisition ledger. No network access or message sending."""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import uuid
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

CHECKS = ("active_within_6_months", "has_plan", "decision_influence")
METRICS = ("plan_received", "pilot_completed", "supplier_handoff_useful", "paid")
REPLY_KINDS = {"interested", "question", "later", "declined", "opt_out", "bounce"}
FINAL_DRAFTS = {"dispatching", "accepted", "unknown", "failed"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def digest(value):
    raw = json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def email(value):
    value = value.strip().lower()
    require(bool(re.fullmatch(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+", value)), "Invalid email")
    return value


def public_url(value):
    parsed = urlsplit(value)
    require(parsed.scheme in {"https", "http"} and parsed.hostname and not parsed.username,
            "Evidence must have a public HTTP(S) URL")
    return value


def domain(value):
    host = urlsplit(value if "://" in value else "https://" + value).hostname
    require(host and "." in host, "Invalid business domain")
    return host.lower().removeprefix("www.")


def lead_id(host, project):
    return "lead_" + digest([domain(host), project.strip().lower()])[:16]


def message_hash(draft):
    return digest({k: draft.get(k, "") for k in
                   ("recipient", "sender", "subject", "body", "kind", "reply_id", "provider_thread_id")})


def fresh(profile):
    return {"schema_version": 1, "revision": 0, "created_at": now(), "profile": profile,
            "leads": {}, "drafts": {}, "suppressed_emails": [], "suppressed_domains": [], "audit": []}


def load(path):
    state = json.loads(Path(path).read_text())
    require(state.get("schema_version") == 1, "Unsupported ledger schema")
    return state


def atomic_write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".acquisition-")
    try:
        with os.fdopen(fd, "w") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        # Preserve metadata written by the user's file connector through atomic replacement.
        if path.exists() and hasattr(os, "listxattr"):
            for attr in os.listxattr(path):
                os.setxattr(temporary, attr, os.getxattr(path, attr))
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def blocked(state, draft):
    lead = state["leads"][draft["lead_id"]]
    if lead["email"] in state["suppressed_emails"] or lead["domain"] in state["suppressed_domains"]:
        return "suppressed"
    if lead["stage"] in {"closed", "paused"}:
        return "lead is closed/paused"
    if draft["status"] != "approved":
        return "draft is not approved"
    if not draft.get("sender"):
        return "verified sender is missing"
    if draft.get("authorization", {}).get("content_hash") != message_hash(draft):
        return "authorization does not match current message"
    related = [x for x in state["leads"].values() if x["email"] == lead["email"]]
    replies = [r for x in related for r in x["replies"]]
    if draft["kind"] != "response" and replies:
        return "recipient has replied; stop initial/follow-up outreach"
    if draft["kind"] == "response":
        if not any(r["provider_id"] == draft.get("reply_id") and r["kind"] in {"interested", "question"}
                   for r in lead["replies"]):
            return "response must reference an interested/question reply"
    sent = [d for d in state["drafts"].values() if d["recipient"] == draft["recipient"]
            and d["status"] in FINAL_DRAFTS]
    if draft["kind"] == "initial" and sent:
        return "recipient already has an outbound attempt"
    if draft["kind"] == "followup":
        if not any(d["kind"] == "initial" and d["status"] == "accepted" for d in sent):
            return "follow-up requires an accepted initial message"
        if any(d["kind"] == "followup" for d in sent):
            return "one follow-up already attempted"
    if draft["kind"] == "response" and any(d["kind"] == "response" and
            d.get("reply_id") == draft.get("reply_id") for d in sent):
        return "this reply already has an outbound response attempt"
    if any(d["status"] in {"dispatching", "unknown", "failed"} for d in sent):
        return "recipient has an unresolved/failed attempt"
    return None


def event(state, item):
    op = item["op"]
    if op == "lead":
        require(item.get("origin") == "public_business", "Only public business prospecting is allowed")
        host, project = domain(item["domain"]), item["project"].strip().lower()
        require(project and item["name"].strip(), "Name and project are required")
        recipient = email(item["email"])
        public_url(item["contact_source"])
        sources = item["sources"]
        require(isinstance(sources, list) and sources, "At least one public source is required")
        for source in sources:
            public_url(source["url"])
            date.fromisoformat(source["observed_at"])
            require(source["signal"].strip(), "A source must contain its actual signal")
        score = item.get("score", 0)
        require(type(score) is int and 0 <= score <= 10, "Score must be an integer from 0 to 10")
        key = lead_id(host, project)
        if key not in state["leads"]:
            state["leads"][key] = {"id": key, "name": item["name"], "domain": host, "project": project,
                "email": recipient, "contact_source": item["contact_source"], "origin": "public_business",
                "sources": [], "score": score, "score_reason": item.get("score_reason", ""),
                "gaps": item.get("gaps", []), "stage": "researched", "qualification":
                {"status": "needs_qualification", **{k: None for k in CHECKS}},
                "replies": [], "outcomes": {k: None for k in METRICS}}
        lead = state["leads"][key]
        require(lead["email"] == recipient, "Contact changed; review before creating a separate contact")
        for source in sources:
            if source not in lead["sources"]:
                lead["sources"].append(source)
        return {"lead_id": key}
    if op == "draft":
        lead = state["leads"][item["lead_id"]]
        kind = item.get("kind", "initial")
        require(kind in {"initial", "followup", "response"}, "Invalid draft kind")
        require(item["subject"].strip() and item["body"].strip(), "Subject/body are required")
        require("\n" not in item["subject"] and "\r" not in item["subject"], "Subject must be one line")
        draft = {"lead_id": lead["id"], "recipient": lead["email"], "kind": kind,
                 "sender": email(item["sender"]) if item.get("sender") else "",
                 "subject": item["subject"], "body": item["body"],
                 "reply_id": item.get("reply_id", ""), "provider_thread_id": item.get("provider_thread_id", "")}
        if kind == "response":
            require(any(r["provider_id"] == draft["reply_id"] for r in lead["replies"]), "Unknown reply ID")
        content_hash = message_hash(draft)
        key = item.get("draft_id") or "draft_" + digest([lead["id"], content_hash])[:16]
        previous = state["drafts"].get(key)
        if previous:
            require(previous["lead_id"] == lead["id"], "Cannot move a draft to another lead")
            if previous["content_hash"] == content_hash:
                return {"draft_id": key, "content_hash": content_hash, "unchanged": True}
            require(previous["status"] not in FINAL_DRAFTS, "Cannot edit an attempted message")
        state["drafts"][key] = {**draft, "id": key, "content_hash": content_hash,
                                "status": "review_pending", "created_at": now()}
        return {"draft_id": key, "content_hash": content_hash}
    if op == "authorize":
        draft = state["drafts"][item["draft_id"]]
        require(draft["status"] not in FINAL_DRAFTS, "Attempted message cannot be reauthorized")
        require(item.get("actor") == "user" and item.get("instruction", "").strip(), "Actual user instruction required")
        require(item["content_hash"] == message_hash(draft), "Authorization hash mismatch")
        require(draft["sender"], "Set the verified sender before authorization")
        draft["authorization"] = {"actor": "user", "instruction": item["instruction"],
                                  "content_hash": item["content_hash"], "at": now()}
        draft["status"] = "approved"
        return {"draft_id": draft["id"], "status": "approved"}
    if op == "reserve":
        draft = state["drafts"][item["draft_id"]]
        reason = blocked(state, draft)
        require(reason is None, reason)
        draft.update(status="dispatching", attempt_id=str(uuid.uuid4()), reserved_at=now())
        return {"draft_id": draft["id"], "attempt_id": draft["attempt_id"],
                **{k: draft[k] for k in ("sender", "recipient", "subject", "body", "provider_thread_id")}}
    if op == "receipt":
        draft = state["drafts"][item["draft_id"]]
        require(draft.get("attempt_id") == item["attempt_id"], "Attempt token mismatch")
        result = item["result"]
        require(result in {"accepted", "unknown", "failed"}, "Invalid connector result")
        if draft["status"] == result and draft.get("provider_id", "") == item.get("provider_id", ""):
            return {"draft_id": draft["id"], "unchanged": True}
        require(draft["status"] in {"dispatching", "unknown"}, "Receipt requires a pending attempt")
        if draft["status"] == "unknown" and result != "unknown":
            require(item.get("provider_evidence", "").strip(), "Reconciliation requires provider evidence")
        if result == "accepted":
            require(item.get("provider_id", "").strip(), "Accepted result requires connector message ID")
        draft.update(status=result, provider_id=item.get("provider_id", ""), receipt_at=now(),
                     provider_evidence=item.get("provider_evidence", ""))
        return {"draft_id": draft["id"], "status": result}
    if op == "reply":
        lead = state["leads"][item["lead_id"]]
        require(item["kind"] in REPLY_KINDS and item["provider_id"].strip(), "Reply kind and message ID required")
        require(item["text"].strip(), "Original reply is required")
        if any(r["provider_id"] == item["provider_id"] for x in state["leads"].values() for r in x["replies"]):
            return {"lead_id": lead["id"], "unchanged": True}
        kind = item["kind"]
        if re.search(r"\b(unsubscribe|remove me|do not contact|stop emailing|stop contacting)\b", item["text"], re.I):
            kind = "opt_out"
        lead["replies"].append({"provider_id": item["provider_id"], "kind": kind, "text": item["text"],
                               "provider_thread_id": item.get("provider_thread_id", ""), "at": now()})
        lead["stage"] = "replied" if kind in {"interested", "question"} else "paused" if kind == "later" else "closed"
        if kind in {"opt_out", "bounce"} and lead["email"] not in state["suppressed_emails"]:
            state["suppressed_emails"].append(lead["email"])
        if kind == "opt_out" and lead["domain"] not in state["suppressed_domains"]:
            state["suppressed_domains"].append(lead["domain"])
        for draft in state["drafts"].values():
            if draft["recipient"] == lead["email"] and draft["status"] not in FINAL_DRAFTS:
                draft["status"] = "paused"
        return {"lead_id": lead["id"], "kind": kind}
    if op == "qualify":
        lead = state["leads"][item["lead_id"]]
        require(item.get("evidence", "").strip(), "Qualification evidence is required")
        require(lead["replies"] and lead["stage"] == "replied", "Qualification requires a relevant reply")
        for key in CHECKS:
            value = item.get(key, lead["qualification"][key])
            require(value is None or type(value) is bool, "Qualification values must be boolean or null")
            lead["qualification"][key] = value
        values = [lead["qualification"][key] for key in CHECKS]
        lead["qualification"].update(status="qualified" if all(v is True for v in values)
                                     else "unqualified" if any(v is False for v in values)
                                     else "needs_qualification", evidence=item["evidence"], at=now())
        return {"lead_id": lead["id"], "qualification": lead["qualification"]["status"]}
    if op == "outcome":
        lead = state["leads"][item["lead_id"]]
        metric = item["metric"]
        require(metric in METRICS and type(item["value"]) is bool, "Invalid measured outcome")
        require(item.get("evidence", "").strip(), "Outcome evidence is required")
        outcome = {"value": item["value"], "evidence": item["evidence"], "at": now()}
        if metric == "paid" and item["value"]:
            amount, currency = item.get("amount"), item.get("currency", "")
            require(type(amount) in {int, float} and amount > 0 and re.fullmatch("[A-Z]{3}", currency),
                    "Payment requires positive amount and currency")
            outcome.update(amount=amount, currency=currency)
        lead["outcomes"][metric] = outcome
        return {"lead_id": lead["id"], "metric": metric}
    raise ValueError("Unknown operation: " + op)


def apply(path, events, revision):
    require(isinstance(events, list) and events, "Supply a nonempty event array")
    path = Path(path)
    lock = path.with_name(path.name + ".lock")
    descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.close(descriptor)
        state = load(path)
        require(state["revision"] == revision, "Revision conflict; reload current ledger")
        results = []
        for item in events:
            result = event(state, item)
            results.append(result)
            state["audit"].append({"at": now(), "revision": revision + 1, "op": item["op"],
                                   "event_hash": digest(item), "result": result})
        state["revision"] += 1
        atomic_write(path, state)
        return {"revision": state["revision"], "results": results}
    finally:
        lock.unlink()


def stats(state):
    leads, drafts = list(state["leads"].values()), list(state["drafts"].values())
    result = {"revision": state["revision"], "candidates": len(leads),
        "qualified": sum(x["qualification"]["status"] == "qualified" for x in leads),
        "replying_businesses": len({x["domain"] for x in leads if x["replies"]}),
        "accepted_outbound_requests": sum(x["status"] == "accepted" for x in drafts),
        "delivery": None, "open_rate": None,
        "suppressed_addresses": len(state["suppressed_emails"]),
        "draft_statuses": {key: sum(d["status"] == key for d in drafts) for key in
                           ("review_pending", "approved", "dispatching", "accepted", "paused", "unknown", "failed")}}
    for metric in METRICS:
        measured = [x["outcomes"][metric] for x in leads if x["outcomes"][metric] is not None]
        result[metric] = {"confirmed": sum(x["value"] is True for x in measured),
                          "measured": len(measured), "not_measured": len(leads) - len(measured)}
    return result


def packet(state):
    lines = ["# Kitchen Studio acquisition review", "", "Generated " + now(), "",
             "Run state and outcomes reflect recorded evidence. Accepted requests are not confirmed delivery.",
             "", "```json", json.dumps(stats(state), ensure_ascii=False, indent=2), "```", ""]
    for lead in sorted(state["leads"].values(), key=lambda x: -x["score"]):
        lines += ["## " + lead["name"], "", "ID: `" + lead["id"] + "`", "",
                  "Qualification: " + lead["qualification"]["status"] + "; stage: " + lead["stage"],
                  "", f"Score: {lead['score']}/10 — {lead['score_reason']}", "",
                  "Published contact: " + lead["email"] + " — " + lead["contact_source"], ""]
        for source in lead["sources"]:
            lines += ["- " + source["signal"] + " (observed " + source["observed_at"] + ") — " + source["url"]]
        lines += ["", "Gaps: " + "; ".join(lead["gaps"]), ""]
        for draft in state["drafts"].values():
            if draft["lead_id"] != lead["id"]:
                continue
            lines += ["### " + draft["kind"] + " message — " + draft["status"], "",
                      "Draft: `" + draft["id"] + "`", "", "Hash: `" + message_hash(draft) + "`", "",
                      "From: " + (draft["sender"] or "not selected"), "To: " + draft["recipient"],
                      "", "Subject: " + draft["subject"], "", draft["body"], ""]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["init", "apply", "status", "packet", "check"])
    parser.add_argument("--db", required=True, type=Path)
    parser.add_argument("--profile", type=Path)
    parser.add_argument("--events", type=Path)
    parser.add_argument("--expect-revision", type=int)
    parser.add_argument("--draft")
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.command == "init":
        require(not args.db.exists(), "Ledger already exists; refusing to overwrite")
        profile = json.loads(args.profile.read_text()) if args.profile else {}
        atomic_write(args.db, fresh(profile))
        result = {"revision": 0, "path": str(args.db)}
    elif args.command == "apply":
        require(args.events is not None and args.expect_revision is not None, "Events and revision required")
        result = apply(args.db, json.loads(args.events.read_text()), args.expect_revision)
    else:
        state = load(args.db)
        if args.command == "status":
            result = stats(state)
        elif args.command == "check":
            require(args.draft in state["drafts"], "Known draft ID required")
            draft = state["drafts"][args.draft]
            reason = blocked(state, draft)
            result = {"allowed": reason is None, "reason": reason, "content_hash": message_hash(draft)}
        else:
            require(args.out is not None and args.out.resolve() != args.db.resolve(), "Separate packet path required")
            args.out.write_text(packet(state))
            result = {"path": str(args.out), "revision": state["revision"]}
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, FileNotFoundError, FileExistsError, json.JSONDecodeError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        sys.exit(2)
