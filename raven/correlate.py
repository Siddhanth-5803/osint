"""Lightweight correlation — turn a set of scanned Targets into a link graph.

Produces {nodes, edges} suitable for the UI. Nodes are the scanned identifiers plus
entities derived from findings (services, subdomains, breaches). Edges record why two
things are linked, each with a confidence. This is the runnable seed of the full Neo4j
link-analysis design in docs/06.
"""
from __future__ import annotations

from .model import Target


def build_graph(targets: list[Target]) -> dict:
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    def node(nid: str, kind: str, label: str | None = None):
        if nid not in nodes:
            nodes[nid] = {"id": nid, "kind": kind, "label": label or nid}
        return nid

    def edge(a: str, b: str, rel: str, conf: int, note: str = ""):
        edges.append({"source": a, "target": b, "rel": rel, "confidence": conf, "note": note})

    derived_usernames: dict[str, str] = {}  # candidate -> origin node

    for t in targets:
        root = node(t.value, t.kind)
        for f in t.findings:
            if f.key.startswith("account:"):
                svc = f.key.split(":", 1)[1]
                node(f"svc:{svc}", "service", svc)
                edge(root, f"svc:{svc}", "registered_on", f.confidence,
                     "email in use on this service")
            elif f.key.startswith("profile:"):
                site = f.key.split(":", 1)[1]
                node(str(f.value), "profile", site)
                edge(root, str(f.value), "has_profile", f.confidence, f.note)
            elif f.key.startswith("breach:"):
                b = f.key.split(":", 1)[1]
                node(f"breach:{b}", "breach", b)
                edge(root, f"breach:{b}", "exposed_in", f.confidence, f.note)
            elif f.key == "username_candidates":
                for cand in (f.value if isinstance(f.value, list) else [f.value]):
                    derived_usernames[cand] = root
            elif f.key == "subdomains":
                for sub in (f.value if isinstance(f.value, list) else [])[:50]:
                    node(f"host:{sub}", "host", sub)
                    edge(root, f"host:{sub}", "has_subdomain", f.confidence)
            elif f.key in ("registrant_org", "carrier", "region"):
                node(f"{f.key}:{f.value}", f.key, str(f.value))
                edge(root, f"{f.key}:{f.value}", f.key, f.confidence)

    # cross-target: a scanned username matching a derived candidate is a strong link
    scanned = {t.value.lstrip("@"): t.value for t in targets if t.kind == "username"}
    for cand, origin in derived_usernames.items():
        if cand in scanned:
            edge(origin, scanned[cand], "likely_same_handle", 60,
                 "email local-part matches scanned username")

    return {"nodes": list(nodes.values()), "edges": edges}
