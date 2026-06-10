"""Append-only, hash-chained audit log (JSONL).

Every collection action is recorded with the operator, the case, the legal basis, the
inputs, and a result summary. Each line includes prev_hash + row_hash so the chain is
tamper-evident — matching the audit design in docs/04 and docs/13. For production this
is the PostgreSQL audit_log table; the file form keeps the app runnable standalone.
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

_DATA = Path(os.environ.get("RAVEN_DATA", Path(__file__).parent / "data"))
_DATA.mkdir(exist_ok=True)
_LOG = _DATA / "audit.jsonl"
_lock = Lock()


def _last_hash() -> str:
    if not _LOG.exists():
        return "0" * 64
    last = "0" * 64
    with _LOG.open() as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    last = json.loads(line)["row_hash"]
                except Exception:
                    pass
    return last


def record(*, actor: str, action: str, case_id: str, legal_basis: str,
           inputs: dict, summary: dict, ip: str | None = None) -> str:
    with _lock:
        prev = _last_hash()
        row = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": actor, "action": action, "case_id": case_id,
            "legal_basis": legal_basis, "inputs": inputs, "summary": summary,
            "ip": ip, "prev_hash": prev,
        }
        row_hash = hashlib.sha256(
            (prev + json.dumps(row, sort_keys=True, separators=(",", ":"))).encode()
        ).hexdigest()
        row["row_hash"] = row_hash
        with _LOG.open("a") as f:
            f.write(json.dumps(row) + "\n")
        return row_hash


def tail(n: int = 100) -> list[dict]:
    if not _LOG.exists():
        return []
    rows = [json.loads(l) for l in _LOG.read_text().splitlines() if l.strip()]
    return rows[-n:][::-1]


def verify_chain() -> bool:
    """Re-walk the chain; returns True if intact."""
    if not _LOG.exists():
        return True
    prev = "0" * 64
    for line in _LOG.read_text().splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        stored = row.pop("row_hash")
        if row["prev_hash"] != prev:
            return False
        calc = hashlib.sha256(
            (prev + json.dumps(row, sort_keys=True, separators=(",", ":"))).encode()
        ).hexdigest()
        if calc != stored:
            return False
        prev = stored
    return True
