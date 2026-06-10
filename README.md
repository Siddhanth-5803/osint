# PROJECT RAVEN

**Advanced Intelligence Fusion & Investigation Platform**

> "Bring Your Own Data. Bring Your Own AI. Bring Your Own APIs. Bring Your Own Infrastructure."

Project Raven is an enterprise-grade, vendor-independent intelligence and OSINT platform that lets
authorized investigators correlate lawful OSINT sources, commercial intelligence feeds, agency-owned
databases, public records, breach-monitoring feeds, geospatial data, media intelligence, and digital
forensic evidence into a single investigative workspace — online, hybrid, or fully air-gapped.

**Intended users:** national police organizations, cyber crime units, intelligence agencies, military
intelligence, counter-terrorism units, financial crime investigation teams, digital forensic labs,
border security agencies, special investigation units, and corporate threat intelligence teams.

**Lawful-use mandate:** Raven is designed exclusively for lawful, authorized investigations. Every
collection action is bound to a case with a recorded legal basis, every data source is a lawfully
obtained feed or agency-owned repository, and every action is written to an immutable audit log.

---

## Design Documentation Index

| # | Document | Contents |
|---|----------|----------|
| 01 | [Product Specification](docs/01-product-specification.md) | Vision, modules A–H, functional requirements, NFRs |
| 02 | [UI Wireframes](docs/02-ui-wireframes.md) | ASCII wireframes for every major screen |
| 03 | [Screen-by-Screen Design](docs/03-screen-designs.md) | Obsidian Orange theme, component specs, motion design |
| 04 | [Database Schema](docs/04-database-schema.md) | PostgreSQL DDL, Elasticsearch mappings, Redis keyspace |
| 05 | [API Architecture](docs/05-api-architecture.md) | REST + GraphQL + WebSocket contracts, gateway design |
| 06 | [Neo4j Graph Design](docs/06-neo4j-graph-design.md) | Node/relationship taxonomy, Cypher patterns, GDS analytics |
| 07 | [RBAC / ABAC Model](docs/07-rbac-model.md) | Roles, permissions, clearance/compartment ABAC policies |
| 08 | [AI Architecture](docs/08-ai-architecture.md) | Copilot, RAG, provider-agnostic LLM layer, local inference |
| 09 | [Folder Structure](docs/09-folder-structure.md) | Complete monorepo layout |
| 10 | [Frontend Code Samples](docs/10-frontend-code-samples.md) | Next.js/React/TS/Tailwind/Framer Motion code |
| 11 | [Backend Code Samples](docs/11-backend-code-samples.md) | FastAPI/GraphQL/Neo4j/connector-framework code |
| 12 | [Deployment Architecture](docs/12-deployment-architecture.md) | Kubernetes, Docker, air-gapped deployment |
| 13 | [Enterprise Security Model](docs/13-security-model.md) | Zero-trust, encryption, audit, evidence integrity |
| 14 | [Investigation Workflow Design](docs/14-investigation-workflows.md) | Case lifecycle, chain of custody, approval flows |
| 15 | [Production Roadmap](docs/15-production-roadmap.md) | Phased delivery plan with team sizing |
| 16 | [Intelligence Connector Framework](docs/16-connector-framework.md) | Plugin architecture, BYO-API/AI, fallback, No-API mode |

## Platform at a Glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PROJECT RAVEN — FUSION CORE                       │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│  IDENTITY    │   SOCIAL     │    MEDIA     │  GEOSPATIAL  │   CYBER     │
│ INTELLIGENCE │ INTELLIGENCE │ INTELLIGENCE │ INTELLIGENCE │ INTELLIGENCE│
├──────────────┼──────────────┼──────────────┼──────────────┼─────────────┤
│   THREAT     │  DARK WEB    │  FINANCIAL   │   FORENSIC   │    CASE     │
│ INTELLIGENCE │  MONITORING  │ INTELLIGENCE │  INGESTION   │ MANAGEMENT  │
├──────────────┴──────────────┴──────────────┴──────────────┴─────────────┤
│           AI INVESTIGATION ENGINE  ·  LINK ANALYSIS SYSTEM              │
├─────────────────────────────────────────────────────────────────────────┤
│      PLUGIN-BASED INTELLIGENCE COLLECTION FRAMEWORK (BYO everything)    │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL · Neo4j · Elasticsearch · Redis · MinIO · Kafka/Redpanda    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Principles

1. **Vendor independence** — no provider, cloud, feed, or API is hardcoded. Everything is a plugin.
2. **Air-gap first** — every feature degrades gracefully to fully offline operation with local AI.
3. **Evidence integrity** — hash-verified evidence vault, immutable chain of custody, full audit trail.
4. **Lawful by design** — legal-basis tagging, retention policies, warrant/authorization tracking,
   compartmented access control.
5. **Analyst velocity** — one workspace: search, graph, map, timeline, media, AI copilot.

## Stack

Frontend: **Next.js 15 · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion**
Backend: **FastAPI · Python 3.12 · Strawberry GraphQL · PostgreSQL 16 · Redis 7**
Search: **Elasticsearch 8** · Graph: **Neo4j 5 + GDS** · Objects: **MinIO**
AI: **provider-agnostic LLM layer (OpenAI / Anthropic / Gemini / Grok / DeepSeek / OpenRouter / Ollama / vLLM / self-hosted) + RAG**
Deploy: **Kubernetes · Docker · Helm · fully air-gapped offline bundle**
