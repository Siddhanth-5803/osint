"""Decompose a collector Target into graph-ready parts.

Given one Target, classify its findings into:
  * attributes — scalar facts stored on the root entity (shown in its detail card)
  * derived    — terminal graph nodes created from findings (services, profiles,
                 breaches, subdomains, IPs, organizations) with an edge from the root
  * pivots     — NEW identifiers that should be fed back into collectors to grow the
                 case graph (the auto-pivot engine consumes these)

This keeps the link-graph logic in one place, used by both persistence (store/ingest)
and the auto-pivot engine.
"""
from __future__ import annotations

from .model import Target

# finding-key prefixes/keys that become their own graph node (not a root attribute)
_DERIVED_KEYS = {"subdomains", "dns_A", "dns_AAAA", "registrant_org"}


def decompose(target: Target) -> dict:
    root = {"kind": target.kind, "value": target.value, "label": target.value,
            "confidence": max((f.confidence for f in target.findings), default=50)}
    attributes: list[dict] = []
    derived: list[dict] = []
    pivots: list[dict] = []

    for f in target.findings:
        key = f.key
        if key.startswith("account:"):
            svc = key.split(":", 1)[1]
            derived.append({"kind": "service", "value": svc, "label": svc,
                            "rel": "REGISTERED_ON", "confidence": f.confidence, "note": f.note})
        elif key.startswith("profile:"):
            site = key.split(":", 1)[1]
            derived.append({"kind": "profile", "value": str(f.value), "label": site,
                            "rel": "HAS_PROFILE", "confidence": f.confidence, "note": f.note})
        elif key.startswith("breach:"):
            name = key.split(":", 1)[1]
            derived.append({"kind": "breach", "value": name, "label": name,
                            "rel": "EXPOSED_IN", "confidence": f.confidence, "note": f.note})
        elif key == "subdomains":
            for sub in (f.value if isinstance(f.value, list) else [])[:40]:
                derived.append({"kind": "host", "value": sub, "label": sub,
                                "rel": "HAS_SUBDOMAIN", "confidence": f.confidence, "note": ""})
        elif key in ("dns_A", "dns_AAAA"):
            for ip in (f.value if isinstance(f.value, list) else []):
                derived.append({"kind": "ip", "value": ip, "label": ip,
                                "rel": "RESOLVES_TO", "confidence": f.confidence, "note": ""})
        elif key == "registrant_org":
            derived.append({"kind": "organization", "value": str(f.value), "label": str(f.value),
                            "rel": "REGISTERED_BY", "confidence": f.confidence, "note": f.note})
        else:
            attributes.append({"key": key, "value": f.value, "source": f.source,
                               "confidence": f.confidence, "note": f.note})

    # ---- pivots: new identifiers to re-collect ----
    if target.kind == "email" and "@" in target.value:
        dom = target.value.rsplit("@", 1)[1].lower()
        pivots.append({"kind": "domain", "value": dom, "rel": "USES_DOMAIN",
                       "confidence": 70, "note": "email domain"})
        for f in target.findings:
            if f.key == "username_candidates":
                for cand in (f.value if isinstance(f.value, list) else [f.value]):
                    pivots.append({"kind": "username", "value": str(cand),
                                   "rel": "POSSIBLE_HANDLE", "confidence": 40,
                                   "note": "derived from email local-part"})
    if target.kind == "domain":
        for f in target.findings:
            if f.key == "emails":
                for addr in (f.value if isinstance(f.value, list) else [f.value]):
                    pivots.append({"kind": "email", "value": str(addr), "rel": "REGISTERED_BY",
                                   "confidence": 60, "note": "WHOIS/RDAP registrant email"})

    return {"root": root, "attributes": attributes, "derived": derived, "pivots": pivots}
