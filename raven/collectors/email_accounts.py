"""Email account-existence — discover which online services an email is registered on,
by observing public signup / password-reset responses (the holehe technique).

No API key. The platform sends a normal, unauthenticated request to a service's
account-check or reset endpoint and reads whether the response indicates the address
is already in use. It never logs in, never completes a reset, and reads no private
data — it only observes the binary "known / unknown" the service itself exposes.

Self-calibrating: every probe is run with the real address AND a random control
address. A "registered" result is recorded only when the two responses differ. Many
services now return identical responses by design (anti-enumeration) — those are
reported as INCONCLUSIVE, never as a hit. Honesty over coverage.

The probe set is data-driven so agencies can extend it without code changes.
"""
from __future__ import annotations

import asyncio
import json
import secrets

import httpx

from ..model import Target

_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


# Each probe: name, method, url, how to build params/json, and a function that maps a
# response to True (registered) / False (not) / None (can't tell). Kept conservative.
async def _probe_gravatar(client, email):
    import hashlib
    h = hashlib.md5(email.lower().encode()).hexdigest()
    r = await client.get(f"https://www.gravatar.com/avatar/{h}?d=404")
    if r.status_code == 200:
        return True
    if r.status_code == 404:
        return False
    return None


async def _probe_spotify(client, email):
    # Spotify's public signup validator reports whether an email is already in use.
    r = await client.get("https://spclient.wg.spotify.com/signup/public/v1/account",
                         params={"validate": 1, "email": email})
    try:
        data = r.json()
    except Exception:
        return None
    status = data.get("status")
    if status == 20:          # already registered
        return True
    if status == 1:           # valid & available
        return False
    return None


PROBES = {
    "Gravatar": _probe_gravatar,
    "Spotify": _probe_spotify,
}


async def _run(email: str) -> dict[str, object]:
    control = f"raven{secrets.token_hex(8)}@gmail.com"
    out: dict[str, object] = {}
    async with httpx.AsyncClient(headers={"User-Agent": _UA}, timeout=12,
                                 follow_redirects=True) as client:
        for name, fn in PROBES.items():
            try:
                real, ctrl = await asyncio.gather(fn(client, email), fn(client, control))
            except Exception:
                out[name] = "error"
                continue
            if real is True and ctrl is False:
                out[name] = "registered"
            elif real is False:
                out[name] = "not_registered"
            elif real is None or real == ctrl:
                out[name] = "inconclusive"
            else:
                out[name] = "inconclusive"
    return out


def collect(email: str) -> Target:
    t = Target(kind="email", value=email)
    email = email.strip().lower()
    try:
        results = asyncio.run(_run(email))
    except Exception as e:
        t.errors.append(f"account-existence probe failed: {e}")
        return t

    registered = [s for s, v in results.items() if v == "registered"]
    inconclusive = [s for s, v in results.items() if v == "inconclusive"]
    for s in registered:
        t.add(f"account:{s}", "registered", "signup-probe", 75,
              note="email is in use on this service (distinguished from control)")
    if inconclusive:
        t.add("inconclusive_services", inconclusive, "calibration", 0,
              note="service returns identical responses for any address (anti-enumeration)")
    if not registered:
        t.errors.append("no service registration could be reliably confirmed")
    return t
