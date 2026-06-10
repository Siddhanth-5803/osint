"""Pluggable enrichment providers (Bring-Your-Own, off by default).

Some signals — WhatsApp/Telegram registration, spam reputation, live carrier/HLR —
cannot be obtained freely, anonymously, and reliably. There is no honest free public
check. So instead of fabricating results, RAVEN treats these as connectors that an
agency configures (BYO API), exactly as in docs/16:

  * If a provider URL is configured via env, RAVEN calls it and maps the JSON result.
  * If nothing is configured, RAVEN reports "not configured" and emits manual
    verification LEADS (links an investigator can open by hand) — never a fake result.

Generic HTTP provider contract (so any vendor or self-hosted service fits):
  GET  <PROVIDER_URL>?number=<E164>     with optional header from <PROVIDER_HEADER>
  ->   JSON object; RAVEN records each top-level scalar field as a finding.

Env vars:
  RAVEN_PHONE_PROVIDER_URL / RAVEN_PHONE_PROVIDER_HEADER     (general enrichment)
  RAVEN_WHATSAPP_PROVIDER_URL / RAVEN_TELEGRAM_PROVIDER_URL  (messaging presence)
  RAVEN_SPAM_PROVIDER_URL                                    (spam reputation)
"""
from __future__ import annotations

import json
import os

import httpx

_UA = "RavenOSINT/0.1 (+lawful-investigation)"
Finding = tuple  # (key, value, source, confidence, note)


def _headers(env_name: str) -> dict:
    raw = os.environ.get(env_name)
    if not raw:
        return {"User-Agent": _UA}
    try:
        h = json.loads(raw)
        h.setdefault("User-Agent", _UA)
        return h
    except Exception:
        return {"User-Agent": _UA}


def _call_generic(url: str, headers: dict, number: str) -> dict | None:
    try:
        with httpx.Client(timeout=12, headers=headers) as c:
            r = c.get(url, params={"number": number})
            if r.status_code == 200:
                return r.json()
    except Exception:
        return None
    return None


def _map_scalars(data: dict, source: str, prefix: str = "") -> list[Finding]:
    out: list[Finding] = []
    for k, v in (data or {}).items():
        if isinstance(v, (str, int, float, bool)) and v not in ("", None):
            out.append((f"{prefix}{k}", v, source, 75, "provider result"))
    return out


def phone_enrichment(e164: str) -> list[Finding]:
    """All phone enrichment: general provider + messaging presence + spam reputation.
    Always honest: configured -> real data; not configured -> status + manual leads."""
    out: list[Finding] = []

    # 1) general configurable provider (carrier/HLR/line status, vendor-defined)
    url = os.environ.get("RAVEN_PHONE_PROVIDER_URL")
    if url:
        data = _call_generic(url, _headers("RAVEN_PHONE_PROVIDER_HEADER"), e164)
        if data is not None:
            out += _map_scalars(data, source=url, prefix="provider_")
        else:
            out.append(("provider", "error/unreachable", url, 0, "configured provider did not respond"))

    # 2) messaging presence (WhatsApp / Telegram)
    for app, env in (("WhatsApp", "RAVEN_WHATSAPP_PROVIDER_URL"),
                     ("Telegram", "RAVEN_TELEGRAM_PROVIDER_URL")):
        purl = os.environ.get(env)
        if purl:
            data = _call_generic(purl, {"User-Agent": _UA}, e164)
            if data is not None:
                registered = bool(data.get("registered") or data.get("exists"))
                out.append((f"messaging:{app}", "registered" if registered else "not registered",
                            purl, 80, "provider result"))
            else:
                out.append((f"messaging:{app}", "provider unreachable", purl, 0, ""))
        else:
            out.append((f"messaging:{app}", "not configured", "provider", 0,
                        f"no {app} provider configured (BYO in Integrations); presence not asserted"))

    # 3) spam reputation
    surl = os.environ.get("RAVEN_SPAM_PROVIDER_URL")
    if surl:
        data = _call_generic(surl, {"User-Agent": _UA}, e164)
        if data is not None:
            out += _map_scalars(data, source=surl, prefix="spam_")
    else:
        out.append(("spam_reputation", "not configured", "provider", 0,
                    "no spam-reputation provider configured (BYO)"))

    return out


def phone_manual_leads(e164: str) -> list[Finding]:
    """Links an investigator can open by hand to verify messaging presence.
    These are LEADS to check, not assertions of registration (confidence 0)."""
    digits = e164.lstrip("+")
    return [
        ("lead:WhatsApp", f"https://wa.me/{digits}", "manual-lead", 0,
         "open to manually verify WhatsApp presence — not an assertion"),
        ("lead:Telegram", f"https://t.me/+{digits}", "manual-lead", 0,
         "open to manually verify Telegram presence — not an assertion"),
    ]
