"""Raven OSINT CLI — open-internet + offline collection. No third-party AI, no paid APIs.

Usage:
    python -m raven.cli phone    "+91 98992 94332"
    python -m raven.cli email    someone@example.com
    python -m raven.cli username eccentric.2
    python -m raven.cli auto     <value>          # guess the type
    python -m raven.cli scan --phone ... --email ... --username ...   # multi, JSON out

Self-exposure use: run it against your OWN identifiers to see your public footprint.
It reports only what it actually retrieves; absent data is reported as 'nothing found'.
"""
from __future__ import annotations

import argparse
import json
import re
import sys

from .collectors import phone as phone_c
from .collectors import email as email_c
from .collectors import username as username_c
from .model import Target

ORANGE = "\033[38;5;208m"
DIM = "\033[2m"
BOLD = "\033[1m"
RESET = "\033[0m"
GREEN = "\033[38;5;42m"
RED = "\033[38;5;203m"


def guess_kind(value: str) -> str:
    v = value.strip()
    if "@" in v and re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
        return "email"
    if re.match(r"^\+?[\d\s().\-]{7,}$", v):
        return "phone"
    return "username"


def run_one(kind: str, value: str, region: str = "IN") -> Target:
    if kind == "phone":
        return phone_c.collect(value, default_region=region)
    if kind == "email":
        return email_c.collect(value)
    if kind == "username":
        return username_c.collect(value)
    raise ValueError(f"unknown kind {kind}")


def print_target(t: Target) -> None:
    head = f"{ORANGE}{BOLD}◢ {t.kind.upper()}{RESET}  {t.value}"
    print(f"\n{head}")
    print(f"{DIM}{'─' * 60}{RESET}")
    if t.findings:
        width = max(len(f.key) for f in t.findings)
        for f in t.findings:
            val = f.value
            if isinstance(val, list):
                val = ", ".join(map(str, val)) if val else "—"
            conf = f"{GREEN if f.confidence >= 70 else ORANGE}{f.confidence:>3}{RESET}"
            print(f"  {ORANGE}{f.key:<{width}}{RESET}  {val}")
            print(f"  {' ':<{width}}  {DIM}conf {f.confidence} · src {f.source}"
                  + (f" · {f.note}" if f.note else "") + RESET)
    else:
        print(f"  {DIM}no findings{RESET}")
    for e in t.errors:
        print(f"  {RED}! {e}{RESET}")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="raven", description="Raven open-internet OSINT collector")
    p.add_argument("--json", action="store_true", help="emit JSON instead of formatted text")
    p.add_argument("--region", default="IN", help="default phone region (ISO-3166), default IN")
    sub = p.add_subparsers(dest="cmd", required=True)

    for k in ("phone", "email", "username", "auto"):
        sp = sub.add_parser(k)
        sp.add_argument("value")

    sc = sub.add_parser("scan")
    sc.add_argument("--phone")
    sc.add_argument("--email")
    sc.add_argument("--username")

    args = p.parse_args(argv)
    targets: list[Target] = []

    if args.cmd == "scan":
        if args.phone:
            targets.append(run_one("phone", args.phone, args.region))
        if args.email:
            targets.append(run_one("email", args.email))
        if args.username:
            targets.append(run_one("username", args.username))
        if not targets:
            p.error("scan needs at least one of --phone/--email/--username")
    else:
        kind = guess_kind(args.value) if args.cmd == "auto" else args.cmd
        targets.append(run_one(kind, args.value, args.region))

    if args.json:
        print(json.dumps([t.to_dict() for t in targets], indent=2, default=str))
    else:
        print(f"{ORANGE}{BOLD}PROJECT RAVEN{RESET} {DIM}· open-internet collector "
              f"· no third-party AI · no paid APIs{RESET}")
        for t in targets:
            print_target(t)
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
