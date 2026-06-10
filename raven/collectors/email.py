"""Email intelligence — syntax validation, domain/MX checks (DNS), public Gravatar
presence, and username-candidate derivation.

Non-invasive: it validates the address shape, confirms the domain can receive mail,
and checks only the *public* Gravatar avatar service (which is designed to be queried
by content hash). It does not attempt to log in, send mail, or access any mailbox.
No breach database is queried unless an offline copy is configured (none here).
"""
from __future__ import annotations

import hashlib
import re
import socket

import httpx

from ..model import Target

_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
_UA = "RavenOSINT/0.1 (+lawful-self-exposure-check)"


def _mx_hosts(domain: str) -> list[str]:
    """Best-effort MX lookup using stdlib only (no extra deps)."""
    try:
        # getaddrinfo proves the domain resolves; for MX we shell to nslookup if present.
        import subprocess
        out = subprocess.run(["nslookup", "-query=mx", domain],
                             capture_output=True, text=True, timeout=8)
        hosts = re.findall(r"mail exchanger = (\S+)", out.stdout)
        if hosts:
            return hosts
    except Exception:
        pass
    # fallback: at least confirm the domain resolves to an address
    try:
        socket.getaddrinfo(domain, None)
        return []
    except Exception:
        return []


def collect(addr: str) -> Target:
    t = Target(kind="email", value=addr)
    addr = addr.strip()
    valid_syntax = bool(_EMAIL_RE.match(addr))
    t.add("valid_syntax", valid_syntax, "offline:regex", 90)
    if not valid_syntax:
        t.errors.append("invalid email syntax")
        return t

    local, domain = addr.rsplit("@", 1)
    t.add("local_part", local, "offline:parse", 95)
    t.add("domain", domain, "offline:parse", 95)

    # domain deliverability
    try:
        socket.getaddrinfo(domain, None)
        t.add("domain_resolves", True, "dns", 90)
    except Exception:
        t.add("domain_resolves", False, "dns", 90)
        t.errors.append("domain does not resolve")
    mx = _mx_hosts(domain)
    if mx:
        t.add("mx_hosts", mx, "dns:mx", 85, note="domain can receive mail")

    # public Gravatar presence (content-addressed, public by design)
    h = hashlib.md5(addr.lower().encode()).hexdigest()
    grav = f"https://www.gravatar.com/avatar/{h}?d=404"
    try:
        with httpx.Client(headers={"User-Agent": _UA}, timeout=10, follow_redirects=True) as c:
            r = c.get(grav)
            if r.status_code == 200:
                t.add("gravatar", f"https://www.gravatar.com/avatar/{h}",
                      grav, 80, note="a public Gravatar avatar exists for this address")
            # profile JSON (public if the user set one up)
            pr = c.get(f"https://www.gravatar.com/{h}.json")
            if pr.status_code == 200:
                t.add("gravatar_profile", f"https://www.gravatar.com/{h}.json", pr.url.__str__(),
                      75, note="public Gravatar profile data present")
    except Exception as e:
        t.errors.append(f"gravatar check failed: {e}")

    # username candidates for cross-platform pivoting
    cand = sorted({local, re.sub(r"[._%+\-].*$", "", local), re.sub(r"\d+$", "", local)})
    cand = [c for c in cand if len(c) >= 3]
    t.add("username_candidates", cand, "offline:derive", 50,
          note="derived from local-part; not confirmed to belong to the owner")
    return t
