"""Project Raven — web application server.

FastAPI backend that exposes case management + auto-pivot OSINT collection over a
JSON API and serves the Obsidian Orange web UI. Accessible from any browser or phone.

Lawful-investigation governance is enforced here:
  * login required (roles: admin = free/unlimited, investigator = paid tier w/ quota)
  * a case (with a stated legal basis) must exist before any collection
  * every collection is auto-pivoted, persisted to the case, and written to the
    hash-chained audit log

Run:  uvicorn raven.server:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import auth, audit, store, pivot

app = FastAPI(title="Project Raven", version="1.1")
WEB = Path(__file__).parent / "web"

ROLE_LIMITS = {"admin": {"max_depth": 2, "max_collections": 25},
               "investigator": {"max_depth": 1, "max_collections": 12}}


@app.on_event("startup")
def _startup():
    store.init()


# ----------------------------- models -----------------------------
class LoginIn(BaseModel):
    username: str
    password: str


class CaseIn(BaseModel):
    code: str
    title: str
    legal_basis: str
    priority: str = "medium"


class ScanIn(BaseModel):
    case_id: str
    phone: str | None = None
    email: str | None = None
    username: str | None = None
    domain: str | None = None
    region: str = "IN"
    max_depth: int | None = None     # None -> role default


# ----------------------------- auth helper -----------------------------
def current_user(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "authentication required")
    user = auth.read_token(authorization.split(" ", 1)[1])
    if not user:
        raise HTTPException(401, "invalid or expired session")
    return user


def _ip(request: Request) -> str | None:
    return request.client.host if request.client else None


# ----------------------------- auth API -----------------------------
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


# ----------------------------- cases -----------------------------
@app.get("/api/cases")
def list_cases(authorization: str | None = Header(default=None)):
    current_user(authorization)
    return {"cases": store.list_cases()}


@app.post("/api/cases")
def create_case(body: CaseIn, request: Request, authorization: str | None = Header(default=None)):
    user = current_user(authorization)
    if not body.code.strip() or not body.title.strip() or not body.legal_basis.strip():
        raise HTTPException(400, "code, title and legal_basis are required")
    try:
        case = store.create_case(body.code.strip(), body.title.strip(),
                                 body.legal_basis.strip(), user["username"], body.priority)
    except ValueError as e:
        raise HTTPException(409, str(e))
    audit.record(actor=user["username"], action="case.create", case_id=case["code"],
                 legal_basis=case["legal_basis"], inputs={"title": case["title"]},
                 summary={}, ip=_ip(request))
    return case


@app.get("/api/cases/{case_id}")
def get_case(case_id: str, authorization: str | None = Header(default=None)):
    current_user(authorization)
    case = store.get_case(case_id)
    if not case:
        raise HTTPException(404, "case not found")
    return {"case": case, "graph": store.case_graph(case["id"]),
            "entities": store.case_entities(case["id"])}


# ----------------------------- scan (auto-pivot) -----------------------------
# sync def -> FastAPI threadpool, so collectors' internal asyncio.run works
@app.post("/api/scan")
def scan(body: ScanIn, request: Request, authorization: str | None = Header(default=None)):
    user = current_user(authorization)
    case = store.get_case(body.case_id)
    if not case:
        raise HTTPException(404, "case not found — create the case first")

    requested = [k for k in ("phone", "email", "username", "domain") if getattr(body, k)]
    if not requested:
        raise HTTPException(400, "provide at least one identifier")

    allowed, remaining = auth.check_and_consume_quota(user["username"], user["role"],
                                                      cost=len(requested))
    if not allowed:
        raise HTTPException(429, "daily quota exhausted for your tier")

    limits = ROLE_LIMITS.get(user["role"], ROLE_LIMITS["investigator"])
    depth = body.max_depth if body.max_depth is not None else limits["max_depth"]
    depth = max(0, min(depth, limits["max_depth"]))

    inputs = {k: getattr(body, k).strip() for k in requested}
    result = pivot.run_collection(case["id"], user["username"], inputs,
                                  region=body.region, max_depth=depth,
                                  max_collections=limits["max_collections"])

    audit.record(actor=user["username"], action="scan", case_id=case["code"],
                 legal_basis=case["legal_basis"], inputs=inputs,
                 summary=result["summary"], ip=_ip(request))

    return {"summary": result["summary"], "quota_remaining": remaining,
            "graph": store.case_graph(case["id"]),
            "entities": store.case_entities(case["id"])}


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
