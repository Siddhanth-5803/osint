"""Auto-pivot collection engine.

Runs a collection against a case and automatically follows newly discovered
identifiers back into the collectors to grow the case link graph — without the
investigator re-typing anything.

Bounded and safe:
  * breadth-first with a global cap (max_collections) so it can never run away
  * depth cap (max_depth) limits how many hops from the seed identifiers
  * dedup by normalized (kind, value) so nothing is collected twice in a run
  * every collected entity/relationship is persisted to the case (store.py) and
    every step is attributable to the scan record

Pivot rules come from correlate.decompose():
  email  -> its domain (USES_DOMAIN) and username candidates (POSSIBLE_HANDLE)
  domain -> registrant emails if present (REGISTERED_BY)
Derived terminal nodes (services, profiles, breaches, subdomains, IPs, orgs) are
attached to their root with an edge but are not themselves pivoted.
"""
from __future__ import annotations

from collections import deque

from . import store
from .correlate import decompose
from .collectors import phone as phone_c
from .collectors import email as email_c
from .collectors import username as username_c
from .collectors import domain as domain_c
from .collectors import email_accounts as accounts_c
from .collectors import breach as breach_c


def collect_one(kind: str, value: str, region: str = "IN"):
    if kind == "phone":
        return phone_c.collect(value, default_region=region)
    if kind == "email":
        t = email_c.collect(value)
        for extra in (accounts_c.collect(value), breach_c.collect(value)):
            t.findings.extend(extra.findings)
            t.errors.extend(extra.errors)
        return t
    if kind == "username":
        return username_c.collect(value)
    if kind == "domain":
        return domain_c.collect(value)
    raise ValueError(f"no collector for kind {kind}")


def _ingest(case_id: str, target, scan_id: str, *, origin_eid=None, origin_rel=None,
            origin_conf=50, origin_note="", origin_flag="derived"):
    """Persist a Target as entities + findings + relationships. Returns (root_eid, pivots)."""
    parts = decompose(target)
    root = parts["root"]
    root_eid = store.upsert_entity(case_id, root["kind"], root["value"],
                                   label=root["label"], confidence=root["confidence"],
                                   origin=origin_flag)
    for a in parts["attributes"]:
        store.add_finding(root_eid, scan_id, a["key"], a["value"], a["source"],
                          a["confidence"], a["note"])
    if origin_eid and origin_rel:
        store.add_relationship(case_id, origin_eid, root_eid, origin_rel,
                               origin_conf, origin_note, scan_id)
    for d in parts["derived"]:
        deid = store.upsert_entity(case_id, d["kind"], d["value"], label=d["label"],
                                   confidence=d["confidence"], origin="derived")
        store.add_relationship(case_id, root_eid, deid, d["rel"], d["confidence"],
                               d["note"], scan_id)
    # carry the persisted error notes onto the root for transparency
    for e in target.errors:
        store.add_finding(root_eid, scan_id, "note", e, "collector", 0, "")
    return root_eid, parts["pivots"]


def run_collection(case_id: str, actor: str, inputs: dict, *, region: str = "IN",
                   max_depth: int = 1, max_collections: int = 12) -> dict:
    """Collect the seed identifiers in `inputs` and auto-pivot. Returns a summary."""
    summary = {"collections": 0, "pivots": 0, "max_depth": max_depth}
    scan_id = store.create_scan(case_id, actor, inputs, summary, depth=max_depth)

    seen: set[tuple[str, str]] = set()
    # (kind, value, depth, origin_eid, rel, conf, note, origin_flag)
    queue: deque = deque()
    for kind in ("phone", "email", "username", "domain"):
        if inputs.get(kind):
            queue.append((kind, inputs[kind], 0, None, None, 50, "", "seed"))

    while queue and summary["collections"] < max_collections:
        kind, value, depth, origin_eid, rel, conf, note, flag = queue.popleft()
        key = (kind, store.normalize(kind, value))
        if key in seen:
            # still link origin to the already-existing entity, if any
            if origin_eid:
                existing = store.find_entity(case_id, kind, value)
                if existing:
                    store.add_relationship(case_id, origin_eid, existing, rel or "RELATED_TO",
                                           conf, note, scan_id)
            continue
        seen.add(key)

        try:
            target = collect_one(kind, value, region)
        except Exception as e:  # noqa: BLE001
            continue
        summary["collections"] += 1

        root_eid, pivots = _ingest(case_id, target, scan_id, origin_eid=origin_eid,
                                   origin_rel=rel, origin_conf=conf, origin_note=note,
                                   origin_flag=flag)

        if depth < max_depth:
            for p in pivots:
                pkey = (p["kind"], store.normalize(p["kind"], p["value"]))
                if pkey in seen:
                    existing = store.find_entity(case_id, p["kind"], p["value"])
                    if existing:
                        store.add_relationship(case_id, root_eid, existing, p["rel"],
                                               p["confidence"], p["note"], scan_id)
                    continue
                summary["pivots"] += 1
                queue.append((p["kind"], p["value"], depth + 1, root_eid, p["rel"],
                              p["confidence"], p["note"], "pivot"))

    store.touch_case(case_id)
    graph = store.case_graph(case_id)
    summary["case_entities"] = len(graph["nodes"])
    summary["case_links"] = len(graph["edges"])
    return {"scan_id": scan_id, "summary": summary}
