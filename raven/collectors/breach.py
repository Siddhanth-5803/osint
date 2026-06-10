"""Breach / credential-exposure intelligence.

Two lawful modes, both keeping the platform free for the operating agency:

  1. Offline dataset  — point RAVEN_BREACH_DB at a JSON file of lawfully obtained
     breach records ({"email": [ {name, date, data_classes}, ... ]}). Fully offline,
     air-gap friendly, no third party. This is the default for government deployments.

  2. HIBP API (optional) — if RAVEN_HIBP_KEY is set, query Have I Been Pwned. Requires
     a key (paid). Used only when an agency chooses to enable it.

Passwords are never displayed; only breach names, dates, and exposed data classes.
Revealing any cleartext requires the platform's approval + audit flow (docs/14), not
this collector.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

from ..model import Target

_UA = "RavenOSINT/0.1 (+lawful-investigation)"


def _offline_lookup(addr: str) -> list[dict] | None:
    path = os.environ.get("RAVEN_BREACH_DB")
    if not path or not Path(path).exists():
        return None
    try:
        db = json.loads(Path(path).read_text())
    except Exception:
        return None
    return db.get(addr.lower())


def _hibp_lookup(addr: str) -> list[dict] | None:
    key = os.environ.get("RAVEN_HIBP_KEY")
    if not key:
        return None
    url = f"https://haveibeenpwned.com/api/v3/breachedaccount/{addr}"
    try:
        with httpx.Client(timeout=15, headers={"User-Agent": _UA, "hibp-api-key": key}) as c:
            r = c.get(url, params={"truncateResponse": "false"})
            if r.status_code == 404:
                return []          # confirmed: no breaches
            if r.status_code == 200:
                return [{"name": b.get("Name"), "date": b.get("BreachDate"),
                         "data_classes": b.get("DataClasses", [])} for b in r.json()]
    except Exception:
        return None
    return None


def collect(addr: str) -> Target:
    t = Target(kind="email", value=addr)
    addr = addr.strip().lower()

    offline = _offline_lookup(addr)
    if offline is not None:
        for b in offline:
            t.add(f"breach:{b.get('name','?')}", b.get("data_classes", []),
                  "offline:breach_db", 85,
                  note=f"date {b.get('date','?')} (lawfully obtained dataset)")
        if not offline:
            t.add("breaches", "none in offline dataset", "offline:breach_db", 80)
        return t

    hibp = _hibp_lookup(addr)
    if hibp is not None:
        if hibp:
            for b in hibp:
                t.add(f"breach:{b['name']}", b["data_classes"], "hibp", 85,
                      note=f"date {b['date']}")
        else:
            t.add("breaches", "none found via HIBP", "hibp", 85)
        return t

    t.errors.append(
        "no breach source configured — set RAVEN_BREACH_DB (offline, free) or "
        "RAVEN_HIBP_KEY (HIBP API). See raven/README.md.")
    return t
