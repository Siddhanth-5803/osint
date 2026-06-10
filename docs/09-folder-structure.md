# 09 — Complete Folder Structure

Monorepo (pnpm + turborepo for JS, uv/poetry per Python service). Connectors are independently
deployable plugins so new sources ship without touching core.

```
project-raven/
├── README.md
├── docs/                              # this design package
├── turbo.json  pnpm-workspace.yaml  .editorconfig  .pre-commit-config.yaml
│
├── apps/
│   ├── web/                           # Next.js 15 frontend (App Router)
│   │   ├── package.json  next.config.ts  tailwind.config.ts  tsconfig.json
│   │   ├── public/                    # fonts, offline map tiles bundle, brand
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/login/page.tsx
│   │       │   ├── (app)/
│   │       │   │   ├── layout.tsx                # app shell (nav, banner, copilot)
│   │       │   │   ├── dashboard/page.tsx
│   │       │   │   ├── cases/[caseId]/
│   │       │   │   │   ├── page.tsx              # overview
│   │       │   │   │   ├── graph/page.tsx
│   │       │   │   │   ├── map/page.tsx
│   │       │   │   │   ├── timeline/page.tsx
│   │       │   │   │   ├── evidence/page.tsx
│   │       │   │   │   └── reports/page.tsx
│   │       │   │   ├── entities/[id]/page.tsx
│   │       │   │   ├── search/page.tsx
│   │       │   │   ├── threat-intel/page.tsx
│   │       │   │   ├── darkweb/page.tsx
│   │       │   │   ├── financial/page.tsx
│   │       │   │   └── admin/
│   │       │   │       ├── integrations/page.tsx # Integrations Center
│   │       │   │       ├── users/page.tsx
│   │       │   │       ├── policies/page.tsx
│   │       │   │       ├── models/page.tsx
│   │       │   │       └── audit/page.tsx
│   │       ├── components/
│   │       │   ├── shell/             # NavRail, CommandBar, ClassificationBanner, StatusStrip
│   │       │   ├── graph/             # GraphCanvas, Inspector, Palette, Toolbar
│   │       │   ├── map/               # TacticalMap, GeofenceTool, MovementPlayer
│   │       │   ├── copilot/           # CopilotPanel, ModelPicker, CitationChip
│   │       │   ├── entity/            # EntityChip, EntityProfile, ConfidenceBar, RiskRing
│   │       │   ├── widgets/           # dashboard widgets
│   │       │   ├── fx/                # ParticleField, RadarSweep, Scanline, PulseRing
│   │       │   └── ui/                # buttons, tables, modals, glass primitives
│   │       ├── lib/
│   │       │   ├── graphql/           # generated types, client, operations
│   │       │   ├── ws/                # websocket/subscription client
│   │       │   ├── auth/              # session, MFA, SSO
│   │       │   └── theme/             # obsidian-orange tokens
│   │       ├── hooks/                 # useGraph, useCopilot, usePresence, useLiveFeed
│   │       └── styles/globals.css
│   │
│   └── docs-site/                     # (optional) internal design/handbook site
│
├── services/                          # Python backend (FastAPI)
│   ├── gateway/                       # edge: auth verify, rate limit, routing config
│   ├── api/                           # GraphQL BFF + REST routers
│   │   └── raven_api/
│   │       ├── main.py
│   │       ├── graphql/               # Strawberry schema, resolvers, dataloaders
│   │       ├── rest/                  # uploads, evidence, reports, webhooks, health
│   │       ├── ws/                    # graph/presence/feed hubs
│   │       └── policy/                # PEP hooks → policy engine
│   ├── core/                          # shared domain library (installed by services)
│   │   └── raven_core/
│   │       ├── models/                # pydantic + SQLAlchemy
│   │       ├── db/  graph/  search/   # PG, Neo4j, ES clients
│   │       ├── policy/                # PDP (RBAC+ABAC), CEL/json-logic eval
│   │       ├── audit/                 # hash-chained audit + custody writers
│   │       ├── crypto/                # envelope encryption, hashing, signing
│   │       └── provenance/            # source/confidence helpers
│   ├── entities/                      # entity fusion, resolution/merge, attributes
│   ├── graphsvc/                      # Neo4j projection + GDS analytics jobs
│   ├── search/                        # ES indexing + query service
│   ├── evidence/                      # vault, custody, hash verify, forensic importers
│   │   └── importers/                 # ufdr, e01/aff4, memory, cloud-acq, maltego-csv
│   ├── intel/                         # IOC/STIX/TAXII/MISP, feeds, watchlists, alerts
│   ├── geo/                           # PostGIS clustering, movement, geofence eval
│   ├── media/                         # exif, faces, ocr, objects, video, audio pipelines
│   ├── financial/                     # transaction graph, pattern detection
│   ├── ai/                            # orchestrator, RAG, LLM router, tools
│   │   └── raven_ai/providers/        # openai, anthropic, gemini, grok, deepseek,
│   │                                  # openrouter, ollama, vllm, lmstudio, openai_compat
│   ├── collector/                     # connector orchestrator + worker (transforms, fallback)
│   └── scheduler/                     # cron: retention, feed sync, health, GDS refresh
│
├── connectors/                        # PLUGINS — independently versioned/deployable (doc 16)
│   ├── sdk-python/                    # raven_connector_sdk (base classes, manifest schema)
│   ├── sdk-docs/
│   ├── web-open-internet/             # ★ search, fetch, crawl, extract over plain internet
│   ├── identity-username-enum/        # offline-capable username presence
│   ├── identity-public-records/
│   ├── cyber-whois/  cyber-dns/  cyber-ip/  cyber-ct-logs/
│   ├── ti-taxii/  ti-misp/  ti-stix-file/
│   ├── breach-feed-generic/
│   ├── financial-iso20022/  financial-chain-analytics/
│   ├── ai-openai/  ai-anthropic/  ai-ollama/  ...   (provider wrappers as connectors)
│   └── local-datasets/                # offline MMDB, registries, tiles, language packs
│
├── packages/                          # shared JS libs
│   ├── ui-tokens/                     # obsidian-orange design tokens (TS + CSS)
│   ├── graph-engine/                  # WebGL renderer wrapper
│   └── api-types/                     # GraphQL codegen output shared across apps
│
├── deploy/
│   ├── docker/                        # Dockerfiles per service + compose for dev
│   ├── helm/raven/                    # umbrella chart + subcharts
│   ├── k8s/                           # base manifests, overlays (online/airgap)
│   ├── airgap/                        # offline bundle builder, image mirror, model packs
│   └── terraform/                     # optional infra (when cloud is permitted)
│
├── migrations/                        # alembic (PG), neo4j cypher migrations, ES templates
├── scripts/                           # seed, demo-data, backup/restore, bundle build
├── tests/                             # unit, integration, e2e (Playwright), load (k6)
└── .github/workflows/                 # CI: lint, test, build, sign images, SBOM
```

Conventions: every service is independently buildable/deployable; `raven_core` is the only shared
backend dependency; connectors depend solely on `sdk-python` and communicate with the platform over
the connector contract (doc 16) — never importing core internals.
