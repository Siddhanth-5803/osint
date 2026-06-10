# 12 — Deployment Architecture

Three supported topologies from one codebase: **Tactical (single node)**, **Enterprise HA (cloud or
on-prem Kubernetes)**, and **Air-Gapped Enclave**. Identical features and UX across all three; only the
connector set and replica counts differ.

## 1. Container Inventory

| Component | Image | Notes |
|-----------|-------|-------|
| web | `raven/web` | Next.js (standalone output) |
| gateway | `raven/gateway` | Traefik/Envoy + auth filter |
| api | `raven/api` | GraphQL BFF + REST + WS |
| collector | `raven/collector` | connector orchestrator + workers |
| ai | `raven/ai` | orchestrator + RAG + LLM router |
| entities/graphsvc/search/evidence/intel/geo/media/financial | `raven/<svc>` | domain services |
| scheduler | `raven/scheduler` | retention, feed sync, GDS refresh |
| connectors-* | `raven/connector-<name>` | one pod per enabled connector (incl. `web-open-internet`) |
| postgres | `postgres:16` + pgvector + PostGIS | system of record |
| neo4j | `neo4j:5-enterprise` (+GDS) | graph |
| elasticsearch | `elasticsearch:8` | search |
| redis | `redis:7` | cache/queues/presence |
| minio | `minio` | evidence/media/objects (WORM buckets) |
| vault | `hashicorp/vault` | secrets (connector keys, envelope keys) |
| searxng (optional) | `searxng/searxng` | key-free meta-search backing the Open Internet connector |
| ollama / vllm (optional) | `ollama/ollama`, `vllm/vllm` | local AI inference |

## 2. Kubernetes (Enterprise HA)

```
                       ┌────────────── Ingress (TLS, WAF) ──────────────┐
                       ▼                                                 ▼
                  raven-web (HPA 3–10)                            raven-gateway (3)
                                                                        │
        ┌───────────────┬───────────────┬───────────────┬──────────────┼───────────────┐
        ▼               ▼               ▼               ▼              ▼               ▼
     raven-api      raven-ai      raven-collector   domain svcs   connector pods   scheduler
     (HPA)          (GPU pool)    (KEDA on queue)   (HPA)         (per connector)  (1, leader-elect)
        │               │               │               │              │
        └───────────────┴───────────────┴───────────────┴──────────────┘
                                        │  StatefulSets / Operators
        ┌───────────────┬───────────────┼───────────────┬───────────────┬──────────┐
        ▼               ▼               ▼               ▼               ▼          ▼
   PostgreSQL HA   Neo4j cluster   Elasticsearch    Redis (Sentinel)  MinIO     Vault
   (Patroni, 3)    (3 core)        (3 data/2 master) cluster          (4, EC)   (3, raft)
```

- **Namespaces**: `raven-app`, `raven-data`, `raven-connectors`, `raven-ai`, `raven-observability`.
- **Autoscaling**: HPA on stateless services; **KEDA** scales collector/connector workers on Redis
  Stream depth; AI on GPU node pool with request-based scaling.
- **Storage**: fast SSD PVCs for data tier; MinIO with erasure coding; nightly snapshots (Velero).
- **Network policy**: default-deny; explicit east-west allowlists; connector pods are the **only**
  workloads permitted egress, and only when `requires_egress: true` and deployment is not air-gapped.
- **Secrets**: CSI driver pulls from Vault; no secret in env/manifest. Connector API keys live in Vault
  under `secret/raven/connectors/<id>`.

## 3. Helm

```
deploy/helm/raven/
├── Chart.yaml            # umbrella
├── values.yaml           # defaults (HA)
├── values-tactical.yaml  # single-node overrides
├── values-airgap.yaml    # offline overrides (egress off, local AI on)
└── charts/               # subcharts: web, api, ai, collector, data, connectors, observability
```

```bash
# Enterprise HA
helm install raven deploy/helm/raven -n raven-app --create-namespace

# Tactical single node (laptop/field kit, k3s)
helm install raven deploy/helm/raven -f deploy/helm/raven/values-tactical.yaml

# Air-gapped (images from internal registry, egress disabled, local models)
helm install raven deploy/helm/raven -f deploy/helm/raven/values-airgap.yaml
```

## 4. Tactical Single-Node (field kit)

- `docker compose` or k3s on one machine (e.g. ruggedized laptop / 1U server).
- Single replicas of each service; Neo4j/ES/PG single-node; local Ollama for AI.
- Open Internet connector enabled **only if** the kit has connectivity; otherwise offline datasets
  carry the load. Same investigative UX.

## 5. Air-Gapped Enclave (offline bundle)

The offline installer ships everything; **no internet, no cloud, no external API, zero telemetry.**

```
deploy/airgap/
├── build-bundle.sh        # produces raven-airgap-<version>.tar.zst on a connected build host
├── images/                # all container images (saved via `docker save`/oci layout)
├── charts/                # pinned Helm charts
├── models/                # local LLMs + embedders + rerankers (GGUF/safetensors)
├── datasets/              # offline OSINT data: GeoIP MMDB, registries, sanctions/PEP,
│                          # map tiles, language packs, username-platform list
├── registry/              # portable OCI registry (Zot/Harbor) seed
└── install-airgap.sh      # loads registry, helm install -f values-airgap.yaml
```

Air-gap value overrides:

```yaml
# deploy/helm/raven/values-airgap.yaml (excerpt)
global:
  airGapped: true
  telemetry: false
  imageRegistry: registry.internal.enclave:5000
gateway:
  egress: deny-all          # blocks ALL outbound; connectors with requires_egress are disabled
ai:
  providers: [ollama, vllm] # local only
  modelsPath: /models
connectors:
  enabled: [identity-username-enum, cyber-whois-local, local-datasets, financial-iso20022,
            ti-stix-file, breach-feed-local-import]   # offline-capable set
  disabled: [web-open-internet]                        # requires_egress → auto-off in air-gap
search: { tiles: /datasets/tiles }
```

Offline updates: new bundles are carried in on removable media, verified by signature, loaded into the
internal registry, and rolled out via Helm — never via internet.

## 6. Hybrid Mode

Online enclave with selective egress: Open Internet + chosen commercial connectors enabled, but
sensitive AI/RAG kept on local models; a redaction policy strips selectors before any data crosses to a
cloud provider. Per-connector `requires_egress` + network policy make the boundary explicit and audited.

## 7. CI/CD & Supply Chain

- GitHub Actions: lint → unit → integration (ephemeral PG/Neo4j/ES via services) → build → **sign
  images (cosign)** → **SBOM (syft)** → scan (grype/trivy) → push.
- Air-gap path: same pipeline outputs are mirrored into the offline bundle; signatures verified at
  install time.
- Migrations run as pre-upgrade Helm hooks (Alembic + Cypher + ES templates).

## 8. Observability & Ops

- Prometheus + Grafana (shipped dashboards: API RED, connector health/usage, queue depth, Neo4j/ES/PG
  health, AI tokens/latency, evidence-verify status).
- Loki for logs; OpenTelemetry traces (Tempo). In air-gap, all telemetry is **local-only**.
- Alerting (Alertmanager) for: connector down, fallback engaged, custody-hash mismatch, legal-basis
  expiry, break-glass usage, queue backlog.
- Backups: PG (WAL + base), Neo4j snapshots, ES snapshots to MinIO, MinIO replication; tested restore
  runbooks; encrypted at rest.
