"""Project Raven — web application server.

FastAPI backend that exposes the OSINT collectors over a JSON API and serves the
Obsidian Orange web UI. Accessible from any browser or phone — no app install.

Lawful-investigation governance is enforced here:
  * login required (roles: admin = free/unlimited, investigator = paid tier w/ quota)
  * every scan requires a case ID and a stated legal basis
  * every scan is written to the hash-chained audit log

Run:  uvicorn raven.server:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import auth, audit
from .correlate import build_graph
from .collectors import phone as phone_c
from .collectors import email as email_c
from .collectors import username as username_c
from .collectors import domain as domain_c
from .collectors import breach as breach_c
from .collectors import email_accounts as accounts_c

app = FastAPI(title="Project Raven", version="1.0")
WEB = Path(__file__).parent / "web"


# ----------------------------- models -----------------------------
class LoginIn(BaseModel):
    username: str
    password: str


class ScanIn(BaseModel):
    case_id: str
    legal_basis: str
    phone: str | None = None
    email: str | None = None
    username: str | None = None
    domain: str | None = None
    region: str = "IN"


# ----------------------------- auth dep -----------------------------
def current_user(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "authentication required")
    user = auth.read_token(authorization.split(" ", 1)[1])
    if not user:
        raise HTTPException(401, "invalid or expired session")
    return user


# ----------------------------- API -----------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "audit_chain_intact": audit.verify_chain()}


@app.post("/api/login")
def login(body: LoginIn):
    user = auth.verify(body.username, body.password)
    if not user:
        raise HTTPException(401, "invalid credentials")
    return {"token": auth.issue_token(user), "role": user["role"],
            "display_name": user["display_name"], "quota": auth.QUOTA.get(user["role"])}


@app.get("/api/me")
def me(authorization: str | None = Header(default=None)):
    return current_user(authorization)


# sync def -> FastAPI runs it in a threadpool, so collectors' internal asyncio.run works
@app.post("/api/scan")
def scan(body: ScanIn, request: Request, authorization: str | None = Header(default=None)):
    user = current_user(authorization)
    if not body.case_id.strip() or not body.legal_basis.strip():
        raise HTTPException(400, "case_id and legal_basis are required for any collection")

    requested = [k for k in ("phone", "email", "username", "domain") if getattr(body, k)]
    if not requested:
        raise HTTPException(400, "provide at least one identifier")

    allowed, remaining = auth.check_and_consume_quota(user["username"], user["role"],
                                                      cost=len(requested))
    if not allowed:
        raise HTTPException(429, "daily quota exhausted for your tier")

    targets = []
    if body.phone:
        targets.append(phone_c.collect(body.phone, default_region=body.region))
    if body.email:
        t = email_c.collect(body.email)
        for extra in (accounts_c.collect(body.email), breach_c.collect(body.email)):
            t.findings.extend(extra.findings)
            t.errors.extend(extra.errors)
        targets.append(t)
    if body.username:
        targets.append(username_c.collect(body.username))
    if body.domain:
        targets.append(domain_c.collect(body.domain))

    graph = build_graph(targets)
    summary = {"identifiers": requested,
               "findings": sum(len(t.findings) for t in targets),
               "links": len(graph["edges"])}
    audit.record(actor=user["username"], action="scan", case_id=body.case_id,
                 legal_basis=body.legal_basis,
                 inputs={k: getattr(body, k) for k in requested},
                 summary=summary, ip=request.client.host if request.client else None)

    return {"targets": [t.to_dict() for t in targets], "graph": graph,
            "summary": summary, "quota_remaining": remaining}


@app.get("/api/audit")
def get_audit(authorization: str | None = Header(default=None)):
    user = current_user(authorization)
    if user["role"] != "admin":
        raise HTTPException(403, "audit log is admin-only")
    return {"entries": audit.tail(200), "chain_intact": audit.verify_chain()}


# ----------------------------- static UI -----------------------------
@app.get("/")
def index():
    return FileResponse(WEB / "index.html")


app.mount("/static", StaticFiles(directory=WEB), name="static")


@app.exception_handler(HTTPException)
def http_exc(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
