"""Case persistence — SQLite system of record for the runnable app.

This is the runnable counterpart of the PostgreSQL schema in docs/04: cases, scans,
entities (deduplicated per case), per-attribute findings with provenance, and typed
relationships. It lets investigators reopen a case and keep building its link graph
over time — the accumulated entities/relationships ARE the case graph.

SQLite is used so the app runs anywhere (including air-gapped) with no external DB.
WAL mode + a write lock keep it safe under FastAPI's threadpool. For production, swap
this module for the PostgreSQL/Neo4j stores; the call surface is intentionally small.
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import time
import uuid
from pathlib import Path
from threading import Lock

_DATA = Path(os.environ.get("RAVEN_DATA", Path(__file__).parent / "data"))
_DATA.mkdir(exist_ok=True)
_DB = _DATA / "raven.db"
_write_lock = Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS cases (
  id          TEXT PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  priority    TEXT NOT NULL DEFAULT 'medium',
  legal_basis TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  created_at  REAL NOT NULL,
  updated_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS scans (
  id          TEXT PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES cases(id),
  actor       TEXT NOT NULL,
  inputs      TEXT NOT NULL,
  summary     TEXT NOT NULL,
  depth       INTEGER NOT NULL DEFAULT 0,
  created_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS entities (
  id          TEXT PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES cases(id),
  kind        TEXT NOT NULL,
  value       TEXT NOT NULL,
  value_norm  TEXT NOT NULL,
  label       TEXT NOT NULL,
  confidence  INTEGER NOT NULL DEFAULT 50,
  origin      TEXT NOT NULL DEFAULT 'manual',   -- 'seed' | 'pivot' | derived
  first_seen  REAL NOT NULL,
  last_seen   REAL NOT NULL,
  UNIQUE (case_id, kind, value_norm)
);
CREATE TABLE IF NOT EXISTS findings (
  id          TEXT PRIMARY KEY,
  entity_id   TEXT NOT NULL REFERENCES entities(id),
  scan_id     TEXT REFERENCES scans(id),
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,        -- json-encoded
  source      TEXT NOT NULL,
  confidence  INTEGER NOT NULL,
  note        TEXT,
  created_at  REAL NOT NULL,
  UNIQUE (entity_id, key, value)
);
CREATE TABLE IF NOT EXISTS relationships (
  id          TEXT PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES cases(id),
  src         TEXT NOT NULL REFERENCES entities(id),
  dst         TEXT NOT NULL REFERENCES entities(id),
  rel         TEXT NOT NULL,
  confidence  INTEGER NOT NULL DEFAULT 50,
  note        TEXT,
  scan_id     TEXT REFERENCES scans(id),
  created_at  REAL NOT NULL,
  UNIQUE (case_id, src, dst, rel)
);
CREATE INDEX IF NOT EXISTS idx_entities_case ON entities(case_id);
CREATE INDEX IF NOT EXISTS idx_findings_entity ON findings(entity_id);
CREATE INDEX IF NOT EXISTS idx_rel_case ON relationships(case_id);
"""


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(_DB, timeout=15)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA foreign_keys=ON")
    return c


def init() -> None:
    with _write_lock, _conn() as c:
        c.executescript(_SCHEMA)


def _now() -> float:
    return time.time()


def _uid() -> str:
    return str(uuid.uuid4())


def normalize(kind: str, value: str) -> str:
    v = (value or "").strip()
    if kind == "phone":
        return re.sub(r"[^\d+]", "", v)
    if kind in ("email", "domain", "service", "breach", "host"):
        return v.lower()
    if kind in ("username", "profile"):
        return v.lstrip("@").lower()
    if kind == "ip":
        return v
    return v.lower()


# ----------------------------- cases -----------------------------
def create_case(code: str, title: str, legal_basis: str, created_by: str,
                priority: str = "medium") -> dict:
    cid = _uid()
    now = _now()
    with _write_lock, _conn() as c:
        try:
            c.execute(
                "INSERT INTO cases(id,code,title,status,priority,legal_basis,created_by,created_at,updated_at)"
                " VALUES(?,?,?,?,?,?,?,?,?)",
                (cid, code, title, "active", priority, legal_basis, created_by, now, now))
        except sqlite3.IntegrityError:
            raise ValueError(f"case code '{code}' already exists")
    return get_case(cid)


def get_case(case_id: str) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM cases WHERE id=? OR code=?", (case_id, case_id)).fetchone()
        return dict(r) if r else None


def list_cases() -> list[dict]:
    with _conn() as c:
        rows = c.execute("SELECT * FROM cases ORDER BY updated_at DESC").fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["entity_count"] = c.execute(
                "SELECT COUNT(*) FROM entities WHERE case_id=?", (r["id"],)).fetchone()[0]
            d["scan_count"] = c.execute(
                "SELECT COUNT(*) FROM scans WHERE case_id=?", (r["id"],)).fetchone()[0]
            out.append(d)
        return out


def touch_case(case_id: str) -> None:
    with _write_lock, _conn() as c:
        c.execute("UPDATE cases SET updated_at=? WHERE id=?", (_now(), case_id))


# ----------------------------- scans -----------------------------
def create_scan(case_id: str, actor: str, inputs: dict, summary: dict, depth: int = 0) -> str:
    sid = _uid()
    with _write_lock, _conn() as c:
        c.execute("INSERT INTO scans(id,case_id,actor,inputs,summary,depth,created_at)"
                  " VALUES(?,?,?,?,?,?,?)",
                  (sid, case_id, actor, json.dumps(inputs), json.dumps(summary), depth, _now()))
    return sid


# ----------------------------- entities & findings -----------------------------
def upsert_entity(case_id: str, kind: str, value: str, *, label: str | None = None,
                  confidence: int = 50, origin: str = "derived") -> str:
    norm = normalize(kind, value)
    now = _now()
    with _write_lock, _conn() as c:
        r = c.execute("SELECT id,confidence FROM entities WHERE case_id=? AND kind=? AND value_norm=?",
                      (case_id, kind, norm)).fetchone()
        if r:
            c.execute("UPDATE entities SET last_seen=?, confidence=MAX(confidence,?) WHERE id=?",
                      (now, confidence, r["id"]))
            return r["id"]
        eid = _uid()
        c.execute("INSERT INTO entities(id,case_id,kind,value,value_norm,label,confidence,origin,first_seen,last_seen)"
                  " VALUES(?,?,?,?,?,?,?,?,?,?)",
                  (eid, case_id, kind, value, norm, label or value, confidence, origin, now, now))
        return eid


def add_finding(entity_id: str, scan_id: str | None, key: str, value, source: str,
                confidence: int, note: str = "") -> None:
    with _write_lock, _conn() as c:
        try:
            c.execute("INSERT INTO findings(id,entity_id,scan_id,key,value,source,confidence,note,created_at)"
                      " VALUES(?,?,?,?,?,?,?,?,?)",
                      (_uid(), entity_id, scan_id, key, json.dumps(value), source,
                       confidence, note, _now()))
        except sqlite3.IntegrityError:
            pass  # duplicate finding for this entity; keep first


def add_relationship(case_id: str, src: str, dst: str, rel: str, confidence: int,
                     note: str = "", scan_id: str | None = None) -> None:
    if src == dst:
        return
    with _write_lock, _conn() as c:
        try:
            c.execute("INSERT INTO relationships(id,case_id,src,dst,rel,confidence,note,scan_id,created_at)"
                      " VALUES(?,?,?,?,?,?,?,?,?)",
                      (_uid(), case_id, src, dst, rel, confidence, note, scan_id, _now()))
        except sqlite3.IntegrityError:
            pass


def find_entity(case_id: str, kind: str, value: str) -> str | None:
    norm = normalize(kind, value)
    with _conn() as c:
        r = c.execute("SELECT id FROM entities WHERE case_id=? AND kind=? AND value_norm=?",
                      (case_id, kind, norm)).fetchone()
        return r["id"] if r else None


# ----------------------------- read: case graph & detail -----------------------------
def case_graph(case_id: str) -> dict:
    with _conn() as c:
        ents = c.execute("SELECT id,kind,value,label,confidence,origin FROM entities WHERE case_id=?",
                         (case_id,)).fetchall()
        rels = c.execute("SELECT src,dst,rel,confidence,note FROM relationships WHERE case_id=?",
                        (case_id,)).fetchall()
    nodes = [{"id": e["id"], "kind": e["kind"], "label": e["label"], "value": e["value"],
              "confidence": e["confidence"], "origin": e["origin"]} for e in ents]
    edges = [{"source": r["src"], "target": r["dst"], "rel": r["rel"],
              "confidence": r["confidence"], "note": r["note"]} for r in rels]
    return {"nodes": nodes, "edges": edges}


def case_entities(case_id: str) -> list[dict]:
    """Entities with their findings — the card view for a case."""
    with _conn() as c:
        ents = c.execute("SELECT * FROM entities WHERE case_id=? ORDER BY first_seen", (case_id,)).fetchall()
        out = []
        for e in ents:
            fs = c.execute("SELECT key,value,source,confidence,note FROM findings WHERE entity_id=? ORDER BY confidence DESC",
                          (e["id"],)).fetchall()
            out.append({
                "id": e["id"], "kind": e["kind"], "value": e["value"], "label": e["label"],
                "confidence": e["confidence"], "origin": e["origin"],
                "findings": [{"key": f["key"], "value": json.loads(f["value"]),
                              "source": f["source"], "confidence": f["confidence"],
                              "note": f["note"]} for f in fs],
            })
        return out
