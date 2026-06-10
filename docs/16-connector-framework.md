# 16 — Intelligence Connector Framework (Plugin Architecture)

The framework that makes Raven **completely modular and vendor-independent**. Everything external — a
paid API, a commercial feed, a government source, an open-source API, a public dataset, a self-hosted
store, an internal agency database, an offline repository, an AI provider, **or the open internet** —
is a **connector plugin**. No provider, cloud, feed, or vendor is ever hardcoded.

> **Philosophy:** Bring Your Own Data. Bring Your Own AI. Bring Your Own APIs. Bring Your Own
> Infrastructure. The platform behaves identically whether the customer runs 100 commercial APIs,
> 10 custom APIs, open-source APIs only, local databases only, or completely offline.

## 1. Concepts

| Concept | Meaning |
|---------|---------|
| **Capability / transform** | A named operation, e.g. `web.search`, `email.breach_lookup`, `domain.whois`, `username.enumerate`, `chat`, `embeddings`. The platform speaks transforms, not vendors. |
| **Connector** | A plugin that implements one or more transforms against a source/provider. |
| **Manifest** | Declares plugin id, category, capabilities, config schema, secrets, `requires_egress`. |
| **Registry** | Discovers installed connectors and which transforms each implements. |
| **Orchestrator** | Selects/executes connectors per transform with priority + fallback (doc 11 §3). |
| **Provenance** | Every produced entity/edge/event records the source connector + confidence + retention. |

Because callers only ever request a **transform**, the same investigation workflow runs unchanged
across any mix of providers — or none.

## 2. Connector Categories

`identity · social · media · geo · cyber · threat-intel · breach · financial · records · ai · web ·
custom`. A connector can self-host (`requires_egress: false`) or call out (`true`).

## 3. Connector Contract

Connectors implement the SDK `Connector` protocol (doc 11 §4): `health()`, `test(config)`,
`execute(transform, input) -> TransformResult`. They depend **only** on `raven_connector_sdk` and run
as isolated pods (one per connector), so a new source ships with **no core code change and no platform
restart**. Results are always normalized into the fusion model with provenance.

```python
# connectors/cyber-whois/connector.py  (illustrative, ~40 lines)
from raven_connector_sdk.base import Connector, TransformResult

class WhoisConnector(Connector):
    plugin_id = "raven.cyber.whois.generic"
    category = "cyber"
    capabilities = {"domain.whois"}
    requires_egress = True

    def __init__(self, config, secret_provider=None):
        self.cfg = config
        self.key = secret_provider and secret_provider.get("api_key")  # optional!

    async def execute(self, transform, input):
        domain = input["domain"]
        record = await self._lookup(domain)          # vendor API OR local whois OR imported dataset
        ents = [{"type": "person", "label": record["registrant"], "confidence": 50,
                 "attributes": {"role": "registrant"}}] if record.get("registrant") else []
        rels = [{"source": domain, "target": record["registrant"], "type": "REGISTERED",
                 "weight": 0.7}] if record.get("registrant") else []
        return TransformResult(entities=ents, relationships=rels, raw=record,
                               summary={"domain": domain})
```

## 4. Administration: the Integrations Center

A dedicated, code-free admin surface (doc 02 §13, doc 03 §2.12) where operators:

- **Add connectors** (wizard §7) and **add API keys** (stored only in Vault).
- **Enable / disable** providers per category.
- Set **usage limits** (per-minute/day + budget) and watch **API consumption** dashboards.
- Set **priority order** and configure **fallback providers** (chains).
- **Test connections** live (`POST /connectors/{id}/test`).
- Define per-source **trust score, reliability score, priority, collection frequency, retention
  policy** (and optional Admiralty grading).
- Import/export **connector bundles** and browse the **marketplace**.

No connector behavior is hardcoded — it is all configuration.

## 5. Fallback System

When a provider fails, the orchestrator continues without interrupting the investigation:

```
Request transform "domain.whois"
   candidates by priority (healthy, under rate limit, breaker closed):
   ┌ Provider A (priority 1) ── FAILURE ─┐  → log event, notify admins, breaker++  ─┐
   │ Provider B (priority 2) ── ACTIVE  ─┘  → success → normalize → done            │
   └ Provider C (priority 3) ── STANDBY ────────────────────────────────────────────┘
```

1. Automatically switch to the backup provider. 2. Continue the investigation without interruption.
3. Log the failure event (audit). 4. Notify administrators. Circuit breakers + exponential backoff
prevent hammering a failing provider; a recovered provider re-enters the rotation automatically.

## 6. No-API Mode & Air-Gapped Operation

The platform is fully functional with **zero third-party APIs configured**. When none are present, all
of the following remain operational on offline-capable connectors and local services:

- Core OSINT (offline `username.enumerate`, local datasets) · Local search (Elasticsearch) ·
  Case management · Graph analysis (Neo4j/GDS) · Timeline analysis · Entity correlation ·
  **Local AI models** (Ollama/vLLM) · Offline intelligence repositories (imported datasets/feeds).

**Air-gapped mode** (doc 12 §5): no internet, no cloud, no external API, **no telemetry, no vendor
lock-in**. Connectors with `requires_egress: true` (including the Open Internet connector) are
automatically disabled; the gateway blocks all outbound. Suitable for military, intelligence, national
security, sensitive, and classified environments.

## 7. Creating a Custom Connector (no core changes)

Users can build connectors for websites, APIs, databases, intelligence feeds, internal systems, and
evidence repositories without modifying the application:

1. `raven connector init my-source` → scaffolds manifest + `connector.py` from the SDK.
2. Declare `capabilities` (transforms), `config_schema`, `secrets`, and `requires_egress`.
3. Implement `execute()` to call the source and return a normalized `TransformResult`.
4. Build the connector image; push to the (internal) registry.
5. In the Integrations Center: add the connector, supply config/keys, set priority/limits/fallback,
   test, enable. It is live immediately — no platform restart.

Two thin variants cover most internal sources:
- **Database connector**: SQL/NoSQL query templates → rows mapped to entities (for internal agency DBs,
  offline repositories, local evidence collections).
- **API connector**: declarative request/response mapping (endpoint, auth, JSONPath → fields) for REST
  sources, configurable entirely from the UI.

## 8. ★ Open Internet Collection — full OSINT over a plain internet connection

A first-class built-in connector (`raven.web.open_internet`, doc 11 §5) lets Raven **read through the
regular internet and do the same thing with no paid API and no API key**. It implements:

| Transform | Does |
|-----------|------|
| `web.search` | Query a self-hosted SearXNG (key-free) or scrape a public results page; each hit → document entity |
| `web.fetch` | Retrieve one page and extract emails, phones, handles, links, and text → entities/edges |
| `web.crawl` | Bounded, robots-respecting BFS of a site; aggregates entities across pages |
| `web.extract` | Parse supplied HTML into the fusion model |

Properties:
- **Zero secrets**: `secrets: []` — works with nothing but connectivity. SearXNG is optional and also
  self-hostable, keeping everything key-free.
- **Same pipeline as paid feeds**: results flow through the orchestrator (priority, fallback, rate
  limit, caching) and normalize into entities/relationships/events with `source_url` provenance and
  confidence — so graph, timeline, search, reports, and the AI copilot's `collect.transform` tool all
  use it transparently.
- **Lawful & polite**: obeys `robots.txt`, rate-limits, identifies via a clear User-Agent, and is
  subject to SSRF protections (blocks internal/metadata addresses, size caps, DNS-rebinding guard;
  doc 13 §7).
- **Egress-gated**: `requires_egress: true`, so it is automatically disabled in air-gapped mode while
  every other capability keeps working offline.

Net effect: a customer with **only an internet connection** — no commercial intelligence subscriptions
— can still profile identities, discover usernames/aliases, pivot across social and cyber surfaces,
build graphs and timelines, and generate reports. Add paid feeds later and the workflows are
unchanged; remove them and the platform falls back to Open Internet, then to offline datasets — same
investigation experience throughout.

## 9. Data Source Prioritization & Trust

Each connector/source carries: **Trust Score**, **Reliability Score**, **Priority Level**,
**Collection Frequency**, **Retention Policy** (doc 04 `connectors`/`intel_sources`). The orchestrator
uses priority for selection; trust/reliability weight confidence on produced facts and surface in the
SourceBadge; retention drives automatic purge; frequency drives scheduled collection. Conflicting facts
from multiple sources are reconciled by weighted confidence and shown with all provenance.

## 10. Why this satisfies "bring your own everything"

| Customer posture | How Raven runs |
|------------------|----------------|
| 100 commercial APIs | All as connectors, prioritized with fallback chains |
| 10 custom APIs | UI-built API/DB connectors, no core changes |
| Open-source APIs only | Open-source + Open Internet connectors |
| Local databases only | Database connectors + local datasets, No-API mode |
| Completely offline | Air-gapped bundle, offline connectors + local AI, zero telemetry |

Identical user experience and investigation workflows in every column.
