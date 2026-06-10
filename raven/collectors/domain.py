"""Domain / cyber intelligence — WHOIS, DNS records, and certificate-transparency
subdomain discovery. All from free, public sources (no API key).

WHOIS and DNS are public registries; crt.sh is the public Certificate Transparency
log search. This is passive reconnaissance of infrastructure the domain owner has
published — it does not touch the target's hosts beyond standard DNS resolution.
"""
from __future__ import annotations

import dns.resolver
import httpx

from ..model import Target

_UA = "RavenOSINT/0.1 (+lawful-investigation)"
_RECORDS = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"]


def _dns(domain: str, t: Target) -> None:
    resolver = dns.resolver.Resolver()
    resolver.lifetime = 8
    for rtype in _RECORDS:
        try:
            answers = resolver.resolve(domain, rtype)
            vals = [r.to_text() for r in answers]
            if vals:
                t.add(f"dns_{rtype}", vals, "dns", 90)
        except Exception:
            continue


def _rdap(domain: str, t: Target) -> None:
    """RDAP — the HTTPS (port 443) successor to WHOIS. Works where port 43 is blocked
    and returns structured JSON (registrar, key dates, nameservers, status)."""
    try:
        with httpx.Client(headers={"User-Agent": _UA}, timeout=15, follow_redirects=True) as c:
            r = c.get(f"https://rdap.org/domain/{domain}")
            if r.status_code != 200:
                t.errors.append(f"rdap status {r.status_code}")
                return
            d = r.json()
    except Exception as e:
        t.errors.append(f"rdap failed: {e}")
        return
    src = "rdap"
    # key dates
    for ev in d.get("events", []):
        action = ev.get("eventAction", "")
        if action in ("registration", "expiration", "last changed"):
            t.add(action.replace(" ", "_") + "_date", ev.get("eventDate"), src, 88)
    # registrar / registrant entities
    for ent in d.get("entities", []):
        roles = ent.get("roles", [])
        name = _vcard_field(ent, "fn")
        org = _vcard_field(ent, "org")
        if "registrar" in roles and name:
            t.add("registrar", name, src, 88)
        if "registrant" in roles:
            if org:
                t.add("registrant_org", org, src, 75)
            country = _vcard_field(ent, "country-name") or _vcard_adr_country(ent)
            if country:
                t.add("registrant_country", country, src, 70)
    # nameservers + status
    ns = sorted({n.get("ldhName", "").lower() for n in d.get("nameservers", []) if n.get("ldhName")})
    if ns:
        t.add("name_servers", ns, src, 85)
    if d.get("status"):
        t.add("status", d["status"], src, 85)


def _vcard_field(entity: dict, field: str):
    for item in entity.get("vcardArray", [None, []])[1]:
        if item and item[0] == field:
            return item[3] if len(item) > 3 else None
    return None


def _vcard_adr_country(entity: dict):
    for item in entity.get("vcardArray", [None, []])[1]:
        if item and item[0] == "adr" and len(item) > 3 and isinstance(item[3], list):
            return item[3][-1] or None
    return None


def _crtsh(domain: str, t: Target) -> None:
    """Certificate Transparency subdomain discovery via the public crt.sh log."""
    try:
        with httpx.Client(headers={"User-Agent": _UA}, timeout=20, follow_redirects=True) as c:
            r = c.get("https://crt.sh/", params={"q": f"%.{domain}", "output": "json"},
                      timeout=35)
            if r.status_code != 200:
                return
            data = r.json()
    except Exception as e:
        t.errors.append(f"crt.sh failed: {e}")
        return
    subs = set()
    for row in data:
        for name in str(row.get("name_value", "")).splitlines():
            name = name.strip().lstrip("*.").lower()
            if name.endswith(domain):
                subs.add(name)
    if subs:
        t.add("subdomains", sorted(subs), "https://crt.sh", 80,
              note=f"{len(subs)} names seen in public Certificate Transparency logs")


def collect(domain: str, *, do_crtsh: bool = True) -> Target:
    domain = domain.strip().lower().lstrip("@")
    if domain.startswith("http"):
        from urllib.parse import urlparse
        domain = urlparse(domain).netloc or domain
    t = Target(kind="domain", value=domain)
    _dns(domain, t)
    _rdap(domain, t)
    if do_crtsh:
        _crtsh(domain, t)
    if not t.findings:
        t.errors.append("no public DNS/WHOIS/CT data retrieved")
    return t
