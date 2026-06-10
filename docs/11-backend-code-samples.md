# 11 — Backend Code Samples

FastAPI · Python 3.12 · Strawberry GraphQL · SQLAlchemy 2 · Neo4j driver · Redis. These illustrate the
patterns; production code lives under `services/` (doc 09).

## 1. FastAPI app with policy-enforcing dependency

```python
# services/api/raven_api/main.py
from fastapi import Depends, FastAPI, Request
from strawberry.fastapi import GraphQLRouter
from raven_core.policy import PolicyEngine, Decision
from raven_core.audit import audit
from .graphql.schema import schema
from .rest import uploads, evidence, reports, webhooks, health

app = FastAPI(title="Project Raven API", version="1.0")
policy = PolicyEngine()

async def get_context(request: Request):
    user = await authenticate(request)                # JWT verify, raises 401
    return {"user": user, "request": request, "policy": policy}

def require(permission: str):
    async def dep(request: Request):
        user = await authenticate(request)
        decision: Decision = await policy.check(user, permission, resource=None, ctx=request)
        await audit.log(actor=user.id, action=permission, allowed=decision.allow,
                        detail={"reason": decision.reason}, request=request)
        if not decision.allow:
            from fastapi import HTTPException
            raise HTTPException(403, decision.reason)
        return user
    return Depends(dep)

app.include_router(GraphQLRouter(schema, context_getter=get_context), prefix="/graphql")
app.include_router(uploads.router,  prefix="/api/v1", dependencies=[require("evidence:ingest")])
app.include_router(evidence.router, prefix="/api/v1")
app.include_router(reports.router,  prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(health.router)
```

## 2. GraphQL resolver: runTransform → connector orchestrator

```python
# services/api/raven_api/graphql/transforms.py
import strawberry
from raven_core.policy import ensure_legal_basis
from raven_collector.orchestrator import Orchestrator

orchestrator = Orchestrator()

@strawberry.type
class CollectionJob:
    id: strawberry.ID
    status: str
    transform: str

@strawberry.input
class TransformInput:
    case_id: strawberry.ID
    entity_id: strawberry.ID
    transform: str          # "web.search", "web.fetch", "username.enumerate", "domain.whois", ...
    params: strawberry.scalars.JSON | None = None
    legal_basis_id: strawberry.ID | None = None

@strawberry.mutation
async def run_transform(self, info, input: TransformInput) -> CollectionJob:
    user = info.context["user"]
    await info.context["policy"].require(user, "graph:transform.run")
    await ensure_legal_basis(input.case_id, input.legal_basis_id, user)
    job = await orchestrator.submit(
        transform=input.transform, case_id=input.case_id, entity_id=input.entity_id,
        params=input.params or {}, requested_by=user.id, legal_basis_id=input.legal_basis_id,
    )
    return CollectionJob(id=job.id, status=job.status, transform=job.transform)
```

## 3. Connector orchestrator with priority + automatic fallback

```python
# services/collector/raven_collector/orchestrator.py
import asyncio, time
from raven_core.db import db
from raven_core.audit import audit
from .registry import ConnectorRegistry
from .breaker import CircuitBreaker
from .normalize import ingest_result

class Orchestrator:
    def __init__(self):
        self.registry = ConnectorRegistry()
        self.breakers: dict[str, CircuitBreaker] = {}

    async def submit(self, *, transform, case_id, entity_id, params, requested_by, legal_basis_id):
        job = await db.create_collection_job(transform=transform, case_id=case_id,
            input={"entity_id": entity_id, **params}, requested_by=requested_by,
            legal_basis_id=legal_basis_id, status="queued")
        asyncio.create_task(self._run(job))
        return job

    async def _run(self, job):
        # ordered candidates implementing this transform, by priority, healthy & under rate limit
        chain = await self.registry.candidates(job.transform)
        last_error = None
        for conn in chain:
            br = self.breakers.setdefault(conn.id, CircuitBreaker(conn.id))
            if br.is_open():
                continue
            if not await self.registry.allow_rate(conn):
                continue
            try:
                await db.update_job(job.id, status="running", connector=conn.id)
                result = await conn.execute(job.transform, job.input)        # the plugin call
                await ingest_result(job, conn, result)                       # → entities/edges + provenance
                await br.record_success()
                await db.update_job(job.id, status="succeeded",
                                    result_summary=result.summary)
                return
            except Exception as e:                                            # noqa: BLE001
                last_error = str(e)
                await br.record_failure()
                await audit.log(action="connector.failure", object_id=conn.id,
                                detail={"transform": job.transform, "error": last_error})
                await db.update_job(job.id, status="fallback", error=last_error)
                await self._notify_admins(conn, last_error)                   # admin notification
                continue                                                      # → next provider
        await db.update_job(job.id, status="failed", error=last_error or "no provider available")
```

## 4. Connector SDK base + manifest

```python
# connectors/sdk-python/raven_connector_sdk/base.py
from dataclasses import dataclass, field
from typing import Any, Protocol

@dataclass
class TransformResult:
    entities: list[dict] = field(default_factory=list)      # {type,label,attributes,confidence}
    relationships: list[dict] = field(default_factory=list) # {source,target,type,weight}
    events: list[dict] = field(default_factory=list)
    raw: Any = None
    summary: dict = field(default_factory=dict)

class Connector(Protocol):
    plugin_id: str
    category: str
    capabilities: set[str]          # transform names this connector implements
    requires_egress: bool           # denied in air-gapped mode if True

    async def health(self) -> dict: ...
    async def test(self, config: dict) -> dict: ...
    async def execute(self, transform: str, input: dict) -> TransformResult: ...
```

```yaml
# connectors/web-open-internet/manifest.yaml
plugin_id: raven.web.open_internet
display_name: Open Internet Collection
category: web
version: 1.0.0
requires_egress: true              # disabled automatically in air-gapped mode
capabilities: [web.search, web.fetch, web.crawl, web.extract]
config_schema:
  search_backend: { type: string, enum: [searxng, html_scrape, api], default: searxng }
  searxng_url:    { type: string, required: false }   # self-hostable, no API key needed
  user_agent:     { type: string, default: "RavenOSINT/1.0 (+lawful-investigation)" }
  respect_robots: { type: boolean, default: true }
  max_depth:      { type: integer, default: 2 }
  rate_per_min:   { type: integer, default: 30 }
secrets: []                        # ★ works with ZERO API keys — plain internet only
```

## 5. ★ Open Internet connector — OSINT using just a normal internet connection

This is the connector that lets Raven "read through the regular internet and do the same thing" with
**no paid API and no API key** — it searches, fetches, crawls, and extracts structured intelligence
straight from public web pages.

```python
# connectors/web-open-internet/connector.py
import asyncio, re, urllib.parse, urllib.robotparser as robotparser
import httpx
from selectolax.parser import HTMLParser
from raven_connector_sdk.base import Connector, TransformResult

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")
HANDLE_RE = re.compile(r"(?:^|[\s/@])@([A-Za-z0-9_]{3,30})")

class OpenInternetConnector(Connector):
    plugin_id = "raven.web.open_internet"
    category = "web"
    capabilities = {"web.search", "web.fetch", "web.crawl", "web.extract"}
    requires_egress = True

    def __init__(self, config: dict, secret_provider=None):
        self.cfg = config
        self.client = httpx.AsyncClient(
            headers={"User-Agent": config.get("user_agent", "RavenOSINT/1.0")},
            follow_redirects=True, timeout=20.0,
        )

    async def health(self) -> dict:
        try:
            r = await self.client.head(self.cfg.get("searxng_url", "https://example.org"))
            return {"ok": r.status_code < 500}
        except Exception:
            return {"ok": False}

    async def test(self, config: dict) -> dict:
        res = await self.search("test query", limit=1)
        return {"ok": bool(res), "sample": res[:1]}

    async def execute(self, transform: str, input: dict) -> TransformResult:
        if transform == "web.search":
            return await self._t_search(input)
        if transform == "web.fetch":
            return await self._t_fetch(input)
        if transform == "web.crawl":
            return await self._t_crawl(input)
        if transform == "web.extract":
            return await self._t_extract(input)
        raise ValueError(f"unsupported transform {transform}")

    # ---- search: query a self-hosted SearXNG meta-search OR scrape a public engine (no key) ----
    async def search(self, query: str, limit: int = 10) -> list[dict]:
        searx = self.cfg.get("searxng_url")
        if searx:                                              # preferred: self-hosted, key-free
            r = await self.client.get(f"{searx}/search",
                params={"q": query, "format": "json"})
            data = r.json().get("results", [])[:limit]
            return [{"title": d.get("title"), "url": d.get("url"),
                     "snippet": d.get("content")} for d in data]
        # fallback: parse a public HTML results page (no API key required)
        r = await self.client.get("https://html.duckduckgo.com/html/", params={"q": query})
        tree = HTMLParser(r.text)
        out = []
        for a in tree.css("a.result__a")[:limit]:
            out.append({"title": a.text(strip=True),
                        "url": a.attributes.get("href"), "snippet": ""})
        return out

    async def _t_search(self, input: dict) -> TransformResult:
        results = await self.search(input["query"], input.get("limit", 10))
        ents, rels = [], []
        seed = input.get("entity_id")
        for r in results:                                      # each hit becomes a document entity
            ents.append({"type": "document", "label": r["title"] or r["url"],
                         "attributes": {"url": r["url"], "snippet": r["snippet"]},
                         "confidence": 40})
            if seed:
                rels.append({"source": seed, "target": r["url"], "type": "MENTIONS", "weight": 0.3})
        return TransformResult(entities=ents, relationships=rels, raw=results,
                               summary={"hits": len(results)})

    # ---- fetch a single page and pull entities straight out of the HTML ----
    async def _t_fetch(self, input: dict) -> TransformResult:
        url = input["url"]
        if self.cfg.get("respect_robots", True) and not await self._robots_ok(url):
            return TransformResult(summary={"skipped": "robots.txt disallow"})
        r = await self.client.get(url)
        return self._extract_from_html(url, r.text)

    # ---- bounded breadth-first crawl of a site ----
    async def _t_crawl(self, input: dict) -> TransformResult:
        start = input["url"]
        max_depth = min(input.get("depth", self.cfg.get("max_depth", 2)), 3)
        rate = self.cfg.get("rate_per_min", 30)
        seen, queue, agg = set(), [(start, 0)], TransformResult()
        host = urllib.parse.urlparse(start).netloc
        while queue:
            url, depth = queue.pop(0)
            if url in seen or depth > max_depth:
                continue
            seen.add(url)
            if self.cfg.get("respect_robots", True) and not await self._robots_ok(url):
                continue
            try:
                r = await self.client.get(url)
            except Exception:
                continue
            page = self._extract_from_html(url, r.text)
            agg.entities += page.entities
            agg.relationships += page.relationships
            for link in self._links(url, r.text):
                if urllib.parse.urlparse(link).netloc == host and link not in seen:
                    queue.append((link, depth + 1))
            await asyncio.sleep(60 / rate)                     # polite rate limiting
        agg.summary = {"pages": len(seen), "entities": len(agg.entities)}
        return agg

    async def _t_extract(self, input: dict) -> TransformResult:
        return self._extract_from_html(input.get("url", ""), input["html"])

    # ---- shared: turn raw HTML into entities (emails, phones, handles, links, text) ----
    def _extract_from_html(self, url: str, html: str) -> TransformResult:
        tree = HTMLParser(html)
        text = tree.body.text(separator=" ", strip=True) if tree.body else ""
        ents, rels = [], []
        doc_label = (tree.css_first("title").text(strip=True) if tree.css_first("title") else url)
        ents.append({"type": "document", "label": doc_label,
                     "attributes": {"url": url, "text": text[:20000]}, "confidence": 50})
        for em in set(EMAIL_RE.findall(text)):
            ents.append({"type": "email", "label": em.lower(),
                         "attributes": {"source_url": url}, "confidence": 55})
            rels.append({"source": url, "target": em.lower(), "type": "MENTIONS", "weight": 0.4})
        for ph in set(PHONE_RE.findall(text)):
            ents.append({"type": "phone", "label": re.sub(r"[^\d+]", "", ph),
                         "attributes": {"source_url": url}, "confidence": 45})
        for h in set(m for m in HANDLE_RE.findall(text)):
            ents.append({"type": "username", "label": h,
                         "attributes": {"source_url": url}, "confidence": 45})
        return TransformResult(entities=ents, relationships=rels, raw={"url": url},
                               summary={"emails": sum(1 for e in ents if e['type']=='email')})

    def _links(self, base: str, html: str) -> list[str]:
        tree = HTMLParser(html)
        out = []
        for a in tree.css("a[href]"):
            href = a.attributes.get("href", "")
            if href and not href.startswith(("javascript:", "mailto:", "#")):
                out.append(urllib.parse.urljoin(base, href))
        return out

    async def _robots_ok(self, url: str) -> bool:
        p = urllib.parse.urlparse(url)
        rp = robotparser.RobotFileParser()
        try:
            r = await self.client.get(f"{p.scheme}://{p.netloc}/robots.txt")
            rp.parse(r.text.splitlines())
            return rp.can_fetch(self.cfg.get("user_agent", "RavenOSINT/1.0"), url)
        except Exception:
            return True
```

With this connector enabled, every Raven workflow — entity profiling, alias/username discovery,
social/cyber pivots, the AI copilot's `collect.transform` tool — can operate over the **open internet
with no third-party API and no key**. It obeys `robots.txt`, rate-limits politely, records full
provenance (`source_url`), and feeds results into the same fusion model, graph, timeline, and search
as any paid feed. See doc 16 §8 for how it slots into the connector framework and No-API mode.

## 6. Evidence ingest with hash + custody (chain-of-custody writer)

```python
# services/evidence/raven_evidence/ingest.py
import hashlib
from raven_core.db import db
from raven_core.audit import custody

async def ingest_evidence(*, case_id, ref_code, name, kind, object_key, size, source_tool,
                          acquisition_meta, legal_basis_id, user):
    sha256, sha512 = await _hash_object(object_key)           # streamed from MinIO
    item = await db.insert_evidence_item(
        case_id=case_id, ref_code=ref_code, name=name, kind=kind, object_key=object_key,
        size_bytes=size, sha256=sha256, sha512=sha512, source_tool=source_tool,
        acquisition_meta=acquisition_meta, legal_basis_id=legal_basis_id, ingested_by=user.id)
    await custody.append(evidence_id=item.id, action="ingested", actor_id=user.id,
                         detail={"sha256": sha256, "tool": source_tool})    # hash-chained ledger
    await _run_extraction_pipeline(item)                       # importer → entities/events
    return item

async def _hash_object(object_key) -> tuple[str, str]:
    s256, s512 = hashlib.sha256(), hashlib.sha512()
    async for chunk in db.objectstore.stream(object_key):
        s256.update(chunk); s512.update(chunk)
    return s256.hexdigest(), s512.hexdigest()
```

```python
# services/core/raven_core/audit/custody.py  — append-only, tamper-evident
import hashlib, json
from raven_core.db import db

async def append(*, evidence_id, action, actor_id, detail):
    prev = await db.last_custody_hash(evidence_id) or ("0" * 64)
    row = {"evidence_id": str(evidence_id), "action": action, "actor_id": str(actor_id),
           "detail": detail, "prev_hash": prev}
    row_hash = hashlib.sha256(
        (prev + json.dumps(row, sort_keys=True, separators=(",", ":"))).encode()).hexdigest()
    await db.insert_custody_event(**row, row_hash=row_hash)
    return row_hash
```

## 7. Provider-agnostic LLM router (BYO-AI)

```python
# services/ai/raven_ai/router.py
from raven_ai.providers import REGISTRY          # name -> adapter factory
from raven_core.db import db

class LLMRouter:
    async def chat(self, *, prompt, messages, tools, user, case_id):
        # ordered, enabled AI connectors (cloud or local); air-gap leaves only local ones
        providers = await db.enabled_ai_connectors(user.org_id)
        last = None
        for p in sorted(providers, key=lambda c: c.priority):
            adapter = REGISTRY[p.plugin_id](p.config, secret_ref=p.secret_ref)
            if not await adapter.health():
                continue
            try:
                async for chunk in adapter.chat(messages, tools=tools, stream=True):
                    yield chunk
                return
            except Exception as e:                  # automatic failover to next provider
                last = e
                continue
        raise RuntimeError(f"no AI provider available: {last}")
```

## 8. Real-time graph delta over WebSocket

```python
# services/api/raven_api/ws/graph_hub.py
from fastapi import WebSocket
from raven_core.redis import redis

async def graph_ws(ws: WebSocket, case_id: str, user):
    await ws.accept()
    async with redis.pubsub() as ps:
        await ps.subscribe(f"stream:events:graph:{case_id}")
        async for msg in ps.listen():
            delta = filter_by_compartments(msg["data"], user.compartments)   # ACL at the edge
            if delta:
                await ws.send_json(delta)
```
