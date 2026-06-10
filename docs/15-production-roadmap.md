# 15 — Production Roadmap

Phased delivery to a deployable, accreditation-ready platform. Durations assume the team in §3; adjust
to staffing. Each phase ends with a demoable, tested, documented increment.

## Phase 0 — Foundation (Weeks 1–6)

**Goal:** skeleton that boots online and air-gapped.

- Monorepo, CI (lint/test/build/sign/SBOM), Helm umbrella, dev `docker compose`.
- Obsidian Orange design system + component library (tokens, shell, primitives, fx).
- Auth (password + MFA), session, OIDC/SAML scaffolding; PEP/PDP skeleton (RBAC).
- PostgreSQL schema + migrations; entity/case/audit core; hash-chained audit + custody writers.
- GraphQL BFF + REST scaffolding; health/observability baseline.

**Exit:** log in, create a case, create entities, see audit entries; one-command deploy (tactical).

## Phase 1 — Core Investigation MVP (Weeks 7–16)

**Goal:** a usable single-analyst investigation loop.

- Entity fusion model + attributes with provenance/confidence; entity resolution/merge.
- Neo4j projection (CDC) + **Graph Workspace** (WebGL canvas, expand, inspector, layouts).
- Elasticsearch indexing + omni-search; entity profile screens.
- **Connector framework** + SDK + orchestrator (priority, fallback, breakers, rate limit).
- **Open Internet connector** (`web.search/fetch/crawl/extract`) — full OSINT with no paid API.
- Offline `username.enumerate`, `cyber-whois-local`, `local-datasets` connectors.
- Case workspace (overview, tasks, notes), timeline v1, executive dashboard v1.
- RBAC + ABAC enforcement across datastores (RLS, Cypher predicate, ES filter).

**Exit:** run the doc 14 §8 worked example end-to-end using only an internet connection.

## Phase 2 — Intelligence Modules (Weeks 17–28)

**Goal:** breadth across the intelligence domains.

- Identity, Social, Cyber intelligence transforms (connector-backed) + graph pivots.
- Geospatial workspace (tactical map, clustering, geofence, movement playback; offline tiles).
- Media workbench (EXIF, OCR, object/logo, video keyframes, audio transcription — local models).
- Threat Intel (IOC/STIX, TAXII/MISP ingest, ATT&CK dossiers, risk scoring).
- Financial workspace (transaction graph, pattern detection) v1.
- GDS analytics (community, PageRank, betweenness) surfaced in graph UI.

**Exit:** all core modules A–F operational with at least one connector each + offline fallback.

## Phase 3 — AI Investigation Engine (Weeks 25–34, overlaps Phase 2)

**Goal:** grounded, provider-agnostic copilot.

- LLM abstraction + adapters (OpenAI/Anthropic/Gemini/Grok/DeepSeek/OpenRouter/Ollama/vLLM/LM Studio).
- RAG (pgvector + ES hybrid, rerank, compartment-safe retrieval); citation enforcement.
- Tool layer (graph/search/timeline/map/collect/report) + agentic loop; streaming copilot UI.
- Report builder + templates (brief, target package, case summary, court disclosure).
- Model Manager (local model pull/import, VRAM/throughput); fallback + air-gap local-only mode.

**Exit:** the example NL queries work with citations; reports export; runs fully on local models.

## Phase 4 — Forensics, Dark Web, Collaboration (Weeks 33–42)

**Goal:** evidence-grade workflows and teamwork.

- Evidence vault + importers (mobile-extraction, disk-image, memory, cloud-acq, OSINT exports).
- Chain of custody UI + verification scheduler + signed custody reports.
- Dark Web / breach monitoring (lawful feeds), watchlists, alerts, reveal approval flow.
- Real-time collaboration (presence, CRDT notes), approval workflows, separation of duty.
- Financial intelligence v2 (clustering, asset/crypto via pluggable analytics).

**Exit:** ingest a forensic export, correlate, monitor a watchlist, collaborate, approve a reveal.

## Phase 5 — Hardening, Air-Gap, Accreditation (Weeks 41–52)

**Goal:** production + classified readiness.

- Air-gapped offline bundle (images, charts, models, datasets, registry) + signed offline updates.
- HA topologies (PG/Neo4j/ES/Redis/MinIO clustering, autoscaling, backups/restore runbooks).
- Security: pen test, SAST/DAST, SSRF/prompt-injection hardening, FIPS crypto, Vault/HSM, break-glass.
- Performance: graph/search/AI load testing to NFR targets (doc 01 §5); tuning.
- Accreditation pack: control mappings (NIST 800-53), audit export, documentation, runbooks.
- Integrations Center polish: marketplace, connector bundles, usage analytics, trust/reliability.

**Exit:** passes security review + load targets; deploys in an air-gapped enclave with zero telemetry.

## Phase 6 — GA & Beyond (Ongoing)

- Connector marketplace growth; community connector SDK + signing.
- Advanced analytics (temporal graph ML, stylometry, link prediction).
- Mobile/field companion (read-mostly); multi-region federation; cross-agency sharing protocols.
- Continuous model updates (offline-distributable); UX refinement from operator feedback.

## Cross-Cutting (every phase)

Accessibility (WCAG 2.2 AA), i18n/RTL, documentation, test coverage (unit/integration/e2e/load),
threat modeling on new surfaces, and audit completeness.

## 3. Suggested Team (~14–20)

| Function | Count |
|----------|-------|
| Frontend (React/graph/map/viz) | 3–4 |
| Backend / platform (FastAPI, data) | 4–5 |
| Graph/search/data engineering | 2 |
| AI/ML (RAG, models, vision/audio) | 2–3 |
| Connector/integrations engineering | 1–2 |
| Security engineering | 1–2 |
| DevOps/SRE (K8s, air-gap, CI/CD) | 2 |
| UX/UI design | 1 |
| Product/Tech lead | 1 |
| QA / test automation | 1–2 |

## 4. Top Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Graph performance at scale | WebGL renderer, GDS off write-path, projection caching, early load tests |
| Vendor/data lock-in creep | hard rule: all external access via connectors; No-API mode in CI matrix |
| Air-gap drift (features needing internet) | air-gap deployment tested every phase; `requires_egress` gating enforced |
| Legal/ethical misuse | legal-basis gating, approvals, audit, no offensive tooling — enforced in code |
| AI hallucination in evidence | mandatory citations, human-in-the-loop, AI excluded from court exports |
| Prompt injection from web/feeds | untrusted-content handling + SSRF guards + arg screening |
