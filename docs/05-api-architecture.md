# 05 — API Architecture

## 1. Topology

```
                         ┌──────────────────────────────────────┐
   Browser (Next.js) ───▶│  API Gateway (Traefik/Envoy)         │
                         │  TLS, JWT verify, rate limit, WAF    │
                         └───────────────┬──────────────────────┘
                                         │
            ┌────────────────────────────┼─────────────────────────────┐
            ▼                            ▼                              ▼
   ┌─────────────────┐        ┌──────────────────┐          ┌────────────────────┐
   │ GraphQL BFF     │        │ REST services    │          │ WebSocket / SSE hub │
   │ (Strawberry)    │        │ (FastAPI routers)│          │ (graph/presence/feed)│
   └────────┬────────┘        └────────┬─────────┘          └─────────┬──────────┘
            │                          │                              │
            ▼                          ▼                              ▼
   ┌───────────────────────────────────────────────────────────────────────────┐
   │ Domain services: cases · entities · graph · evidence · intel · ai · connectors│
   └───────────────────────────────────────────────────────────────────────────┘
            │            │             │            │            │
            ▼            ▼             ▼            ▼            ▼
        PostgreSQL    Neo4j     Elasticsearch    Redis      MinIO / Vault
```

- **GraphQL BFF** is the primary client API (rich nested reads, the graph workspace, case views).
- **REST** is used for file upload/download, webhooks, connector callbacks, admin operations, and
  health — anything streaming-binary or third-party-facing.
- **WebSocket** carries real-time: graph deltas, collaboration presence, live feed, job progress,
  alerts.
- All three sit behind one gateway; one OIDC/JWT session works across them.

## 2. AuthN / AuthZ

- Login → short-lived access JWT (10 min) + rotating refresh token (httpOnly cookie). MFA enforced.
- SSO via OIDC/SAML (IdPs configured in admin, never hardcoded).
- Every request → gateway verifies JWT → service calls **policy engine** (doc 07) with
  `(subject attrs, action, resource attrs, context)` → allow/deny. Deny is logged.
- Service-to-service: mTLS + signed internal tokens.

## 3. GraphQL Schema (excerpt)

```graphql
scalar DateTime
scalar JSON
scalar UUID

type Query {
  case(id: UUID!): Case
  cases(filter: CaseFilter, page: Page): CaseConnection!
  entity(id: UUID!): Entity
  searchEntities(q: String!, types: [EntityType!], page: Page): EntitySearchResult!
  graph(caseId: UUID!, focus: UUID, depth: Int = 1): GraphView!
  shortestPaths(from: UUID!, to: UUID!, maxDepth: Int = 6): [GraphPath!]!
  timeline(caseId: UUID!, range: TimeRange): [TimelineEvent!]!
  connectors(category: String): [Connector!]!          # admin
  approvals(status: ApprovalStatus): [Approval!]!
}

type Mutation {
  createCase(input: CaseInput!): Case!
  addEntityToCase(caseId: UUID!, entityId: UUID!): CaseEntity!
  createEntity(input: EntityInput!): Entity!
  mergeEntities(survivorId: UUID!, mergedId: UUID!): Entity!
  runTransform(input: TransformInput!): CollectionJob!     # invokes connector framework
  requestApproval(input: ApprovalInput!): Approval!
  decideApproval(id: UUID!, decision: ApprovalDecision!, note: String): Approval!
  ingestEvidence(input: EvidenceInput!): EvidenceItem!     # finalizes an uploaded object
  askCopilot(input: CopilotInput!): CopilotTurn!           # streamed via subscription
}

type Subscription {
  graphUpdates(caseId: UUID!): GraphDelta!
  casePresence(caseId: UUID!): PresenceEvent!
  intelFeed(caseId: UUID): IntelFeedItem!
  jobProgress(jobId: UUID!): JobProgress!
  copilotStream(turnId: UUID!): CopilotChunk!
}

enum EntityType { PERSON EMAIL PHONE USERNAME DOMAIN IP ORGANIZATION VEHICLE LOCATION DEVICE ACCOUNT WALLET FILE EVENT DOCUMENT }

type Entity {
  id: UUID!
  type: EntityType!
  label: String!
  riskScore: Int!
  riskFactors: JSON!
  confidence: Int!
  attributes: [EntityAttribute!]!
  relationships(types: [String!], page: Page): RelationshipConnection!
  sources: [IntelSource!]!          # provenance
  compartments: [String!]!
}

type EntityAttribute {
  key: String!
  value: JSON!
  confidence: Int!
  observedAt: DateTime
  source: IntelSource
  evidence: EvidenceItem
}

input TransformInput {
  caseId: UUID!
  entityId: UUID!
  transform: String!        # e.g. "username.enumerate", "web.fetch", "web.search", "domain.whois"
  params: JSON
  legalBasisId: UUID
}
```

## 4. REST Surface (selected)

| Method & path | Purpose |
|---------------|---------|
| `POST /api/v1/uploads` | initiate multipart/resumable evidence upload (returns presigned URLs) |
| `POST /api/v1/evidence/{id}/verify` | recompute + verify hashes, append custody event |
| `GET  /api/v1/evidence/{id}/download` | streamed, audited, custody-logged |
| `GET  /api/v1/reports/{id}/export?format=pdf` | render & download report |
| `POST /api/v1/connectors/{id}/test` | live connection test |
| `GET  /api/v1/connectors/{id}/usage` | usage/consumption metrics |
| `POST /api/v1/webhooks/feeds/{connector}` | inbound push feed (TAXII/MISP/custom), HMAC-verified |
| `GET  /api/v1/health` `/ready` `/metrics` | ops (Prometheus) |

API standards: cursor pagination, RFC 7807 problem+json errors, idempotency keys on mutations,
`ETag`/`If-Match` on entity writes, OpenAPI 3.1 + GraphQL SDL published and versioned (`/api/v1`).

## 5. Collection / Transform API (connector framework, doc 16)

`runTransform` is the single entrypoint that all collection flows funnel through. The orchestrator:

1. Resolves which connectors implement the requested transform & capability.
2. Orders them by `priority`, filtered by health/rate-limit/circuit-breaker.
3. Checks legal basis + permissions + retention policy.
4. Executes against the top connector; on failure applies the fallback chain (doc 16 §5).
5. Normalizes the result into entities/relationships/events with provenance, queues graph + ES
   projection, and emits `jobProgress`/`graphUpdates`.

This is where **Open Internet Collection** plugs in: transforms like `web.search`, `web.fetch`,
`web.crawl`, and `web.extract` are connectors like any other, so the orchestration, fallback, rate
limiting, caching, and provenance are identical to commercial-API transforms. See doc 16 §8.

## 6. Rate Limiting, Resilience, Observability

- Per-user and per-connector token-bucket limits in Redis; gateway-level global ceilings.
- Circuit breakers per connector (state in Redis); exponential backoff with jitter on outbound calls.
- Tracing: OpenTelemetry across gateway→services→connectors; trace id surfaced in audit log.
- Metrics: RED (rate/errors/duration) per route + per connector; dashboards shipped (doc 12).
- Air-gapped mode disables all egress at the gateway except to explicitly allowlisted internal
  connectors; telemetry exporters are local-only.
