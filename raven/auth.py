"""Minimal but real auth + role/tier layer for the Raven app.

Roles:
  admin        — free, unlimited (the operating agency / your org)
  investigator — the paid tier ($2.99/user); subject to a daily scan quota

Users live in raven/users.json (seeded with one admin on first run). Passwords are
salted + hashed with PBKDF2-HMAC-SHA256 (stdlib). Sessions are stateless signed
tokens (itsdangerous). This is intentionally dependency-light so it runs anywhere,
including air-gapped; for production, back it with the PostgreSQL schema in docs/04.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
from datetime import date
from pathlib import Path

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

_DATA = Path(os.environ.get("RAVEN_DATA", Path(__file__).parent / "data"))
_DATA.mkdir(exist_ok=True)
_USERS = _DATA / "users.json"
_QUOTA = _DATA / "quota.json"
_SECRET_FILE = _DATA / "secret.key"

TOKEN_TTL = 60 * 60 * 12  # 12h
QUOTA = {"admin": None, "investigator": 50}  # None = unlimited; investigator = paid tier/day


def _secret() -> str:
    s = os.environ.get("RAVEN_SECRET")
    if s:
        return s
    if _SECRET_FILE.exists():
        return _SECRET_FILE.read_text().strip()
    s = secrets.token_hex(32)
    _SECRET_FILE.write_text(s)
    return s


_serializer = URLSafeTimedSerializer(_secret(), salt="raven-auth")


def _hash(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()


def _load_users() -> dict:
    if not _USERS.exists():
        # seed a default admin; password is printed once to stdout on first boot
        salt = secrets.token_hex(16)
        pw = os.environ.get("RAVEN_ADMIN_PASSWORD", "raven-admin")
        users = {"admin": {"display_name": "Administrator", "role": "admin",
                           "salt": salt, "hash": _hash(pw, salt)}}
        _USERS.write_text(json.dumps(users, indent=2))
        print(f"[raven] seeded admin user — username 'admin', password '{pw}' "
              f"(set RAVEN_ADMIN_PASSWORD to override; change after first login)")
    return json.loads(_USERS.read_text())


def _save_users(users: dict) -> None:
    _USERS.write_text(json.dumps(users, indent=2))


def create_user(username: str, password: str, role: str = "investigator",
                display_name: str | None = None) -> None:
    users = _load_users()
    salt = secrets.token_hex(16)
    users[username] = {"display_name": display_name or username, "role": role,
                       "salt": salt, "hash": _hash(password, salt)}
    _save_users(users)


def verify(username: str, password: str) -> dict | None:
    users = _load_users()
    u = users.get(username)
    if not u:
        return None
    if secrets.compare_digest(_hash(password, u["salt"]), u["hash"]):
        return {"username": username, "role": u["role"], "display_name": u["display_name"]}
    return None


def issue_token(user: dict) -> str:
    return _serializer.dumps({"u": user["username"], "r": user["role"],
                              "n": user["display_name"]})


def read_token(token: str) -> dict | None:
    try:
        data = _serializer.loads(token, max_age=TOKEN_TTL)
    except (BadSignature, SignatureExpired):
        return None
    return {"username": data["u"], "role": data["r"], "display_name": data["n"]}


def check_and_consume_quota(username: str, role: str, cost: int = 1) -> tuple[bool, int | None]:
    """Returns (allowed, remaining). Admins are unlimited (remaining None)."""
    limit = QUOTA.get(role)
    if limit is None:
        return True, None
    today = date.today().isoformat()
    q = json.loads(_QUOTA.read_text()) if _QUOTA.exists() else {}
    rec = q.get(username, {})
    used = rec.get("count", 0) if rec.get("date") == today else 0
    if used + cost > limit:
        return False, 0
    q[username] = {"date": today, "count": used + cost}
    _QUOTA.write_text(json.dumps(q))
    return True, limit - (used + cost)
