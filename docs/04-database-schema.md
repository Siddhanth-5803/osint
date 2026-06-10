# 04 — Database Schema

Polyglot persistence, one system of record per concern:

| Store | Role |
|-------|------|
| PostgreSQL 16 | System of record: cases, entities, evidence, custody, audit, config, RBAC |
| Neo4j 5 | Relationship analytics & graph workspace (projection of PG entities) — doc 06 |
| Elasticsearch 8 | Full-text + faceted search over entities, documents, extracted text, intel items |
| Redis 7 | Sessions, queues (Streams), rate limits, presence, cache |
| MinIO (S3) | Evidence binaries, media, model artifacts, report exports (versioned, WORM buckets) |

PG conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz` everywhere, soft-delete only where
legally permitted, row-level security for compartmentation, partitioning on high-volume tables.

## 1. PostgreSQL DDL (core)

```sql
-- ============ TENANCY, USERS, ACCESS ============
CREATE TABLE organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  classification_banner text NOT NULL DEFAULT 'UNCLASSIFIED',
  settings      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  username      citext NOT NULL,
  email         citext NOT NULL,
  display_name  text NOT NULL,
  password_hash text,                       -- argon2id; NULL if SSO-only
  mfa_secret    bytea,                      -- encrypted (envelope, see doc 13)
  webauthn_credentials jsonb NOT NULL DEFAULT '[]',
  clearance_level smallint NOT NULL DEFAULT 0,        -- ABAC attribute
  compartments  text[] NOT NULL DEFAULT '{}',         -- ABAC attribute
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','suspended','disabled')),
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, username)
);

CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  name        text NOT NULL,                -- e.g. 'investigator', 'supervisor'
  is_system   boolean NOT NULL DEFAULT false,
  permissions text[] NOT NULL DEFAULT '{}', -- 'case:create', 'breach:reveal', ...
  UNIQUE (org_id, name)
);

CREATE TABLE user_roles (
  user_id uuid REFERENCES users(id),
  role_id uuid REFERENCES roles(id),
  scope_case_id uuid,                       -- NULL = org-wide; else case-scoped role
  PRIMARY KEY (user_id, role_id, scope_case_id)
);

CREATE TABLE abac_policies (                -- doc 07; evaluated by policy engine
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id    uuid NOT NULL REFERENCES organizations(id),
  name      text NOT NULL,
  effect    text NOT NULL CHECK (effect IN ('allow','deny')),
  priority  int  NOT NULL DEFAULT 100,
  condition jsonb NOT NULL,                 -- CEL/JSON-logic expression
  enabled   boolean NOT NULL DEFAULT true
);

-- ============ CASES ============
CREATE TABLE cases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  code          text NOT NULL,              -- 'OP-2231'
  title         text NOT NULL,
  summary       text,
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('draft','open','active','suspended','closed','archived')),
  priority      text NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low','medium','high','critical')),
  classification text NOT NULL DEFAULT 'restricted',
  compartments  text[] NOT NULL DEFAULT '{}',
  lead_user_id  uuid REFERENCES users(id),
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  closed_at     timestamptz,
  UNIQUE (org_id, code)
);

CREATE TABLE case_legal_bases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid NOT NULL REFERENCES cases(id),
  kind        text NOT NULL,                -- 'warrant','court_order','statute','consent','mou'
  reference   text NOT NULL,                -- 'W-88123'
  description text,
  valid_from  date NOT NULL,
  valid_until date,
  document_object_key text,                 -- MinIO key of scanned authorization
  created_by  uuid NOT NULL REFERENCES users(id)
);

CREATE TABLE case_members (
  case_id   uuid REFERENCES cases(id),
  user_id   uuid REFERENCES users(id),
  case_role text NOT NULL DEFAULT 'investigator',  -- 'lead','investigator','viewer','examiner'
  added_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, user_id)
);

CREATE TABLE tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid NOT NULL REFERENCES cases(id),
  title       text NOT NULL,
  detail      text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','cancelled')),
  assignee_id uuid REFERENCES users(id),
  due_at      timestamptz,
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    uuid NOT NULL REFERENCES cases(id),
  author_id  uuid NOT NULL REFERENCES users(id),
  body_crdt  bytea,                          -- Yjs document for live collab
  body_text  text,                           -- rendered snapshot, ES-indexed
  pinned     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE approvals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      uuid REFERENCES cases(id),
  kind         text NOT NULL,               -- 'breach_reveal','case_export','watchlist_create','face_search'
  payload      jsonb NOT NULL,
  justification text NOT NULL,
  requested_by uuid NOT NULL REFERENCES users(id),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','expired')),
  decided_by   uuid REFERENCES users(id),
  decided_at   timestamptz,
  decision_note text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============ ENTITY FUSION MODEL ============
CREATE TABLE entities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  type        text NOT NULL CHECK (type IN
              ('person','email','phone','username','domain','ip','organization',
               'vehicle','location','device','account','wallet','file','event','document')),
  label       text NOT NULL,                -- canonical display value
  risk_score  smallint NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  risk_factors jsonb NOT NULL DEFAULT '[]', -- explainable scoring breakdown
  confidence  smallint NOT NULL DEFAULT 50,
  compartments text[] NOT NULL DEFAULT '{}',
  merged_into uuid REFERENCES entities(id), -- entity resolution: survivor pointer
  created_by  uuid REFERENCES users(id),    -- NULL = system/connector
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON entities (org_id, type);
CREATE INDEX entities_label_trgm ON entities USING gin (label gin_trgm_ops);

-- every attribute value carries its own provenance + confidence
CREATE TABLE entity_attributes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid NOT NULL REFERENCES entities(id),
  key         text NOT NULL,                -- 'name','dob','email','imei','passport_no',...
  value       jsonb NOT NULL,
  value_norm  text,                         -- normalized for matching (lower, E.164, punycode…)
  confidence  smallint NOT NULL DEFAULT 50,
  observed_at timestamptz,                  -- when true in the world
  source_id   uuid REFERENCES intel_sources(id),
  evidence_id uuid REFERENCES evidence_items(id),
  collected_by uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON entity_attributes (entity_id, key);
CREATE INDEX ON entity_attributes (key, value_norm);

CREATE TABLE relationships (                -- system of record; projected to Neo4j by CDC
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  source_entity_id uuid NOT NULL REFERENCES entities(id),
  target_entity_id uuid NOT NULL REFERENCES entities(id),
  type        text NOT NULL,                -- doc 06 taxonomy: KNOWS, OWNS, RESOLVES_TO, ...
  weight      real NOT NULL DEFAULT 1.0,
  confidence  smallint NOT NULL DEFAULT 50,
  valid_from  timestamptz,
  valid_until timestamptz,
  properties  jsonb NOT NULL DEFAULT '{}',
  source_id   uuid REFERENCES intel_sources(id),
  evidence_id uuid REFERENCES evidence_items(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON relationships (source_entity_id);
CREATE INDEX ON relationships (target_entity_id);
CREATE INDEX ON relationships (org_id, type);

CREATE TABLE case_entities (                -- which entities are in which case workspace
  case_id   uuid REFERENCES cases(id),
  entity_id uuid REFERENCES entities(id),
  pinned    boolean NOT NULL DEFAULT false,
  graph_position point,                     -- saved canvas layout
  added_by  uuid REFERENCES users(id),
  added_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, entity_id)
);

CREATE TABLE timeline_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     uuid NOT NULL REFERENCES cases(id),
  entity_ids  uuid[] NOT NULL DEFAULT '{}',
  title       text NOT NULL,
  description text,
  event_at    timestamptz NOT NULL,
  event_end   timestamptz,
  location    geography(Point,4326),        -- PostGIS
  kind        text NOT NULL DEFAULT 'observation',
  confidence  smallint NOT NULL DEFAULT 50,
  source_id   uuid REFERENCES intel_sources(id),
  evidence_id uuid REFERENCES evidence_items(id),
  created_by  uuid REFERENCES users(id)
);
CREATE INDEX ON timeline_events (case_id, event_at);
CREATE INDEX timeline_events_geo ON timeline_events USING gist (location);

-- ============ EVIDENCE VAULT & CHAIN OF CUSTODY ============
CREATE TABLE evidence_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       uuid NOT NULL REFERENCES cases(id),
  ref_code      text NOT NULL,              -- 'EV-031'
  name          text NOT NULL,
  kind          text NOT NULL,              -- 'mobile-extraction','disk-image','memory-dump',
                                            -- 'cloud-acquisition','document','image','video','audio','dataset'
  object_key    text NOT NULL,              -- MinIO (WORM bucket)
  size_bytes    bigint NOT NULL,
  sha256        char(64) NOT NULL,
  sha512        char(128),
  hash_verified_at timestamptz,
  source_tool   text,                       -- originating forensic tool name/version
  acquisition_meta jsonb NOT NULL DEFAULT '{}',
  legal_basis_id uuid REFERENCES case_legal_bases(id),
  ingested_by   uuid NOT NULL REFERENCES users(id),
  ingested_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, ref_code)
);

CREATE TABLE custody_events (               -- append-only, hash-chained ledger
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evidence_id   uuid NOT NULL REFERENCES evidence_items(id),
  action        text NOT NULL,              -- 'ingested','accessed','exported','verified','transferred','analyzed'
  actor_id      uuid NOT NULL REFERENCES users(id),
  detail        jsonb NOT NULL DEFAULT '{}',
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  prev_hash     char(64) NOT NULL,          -- chain: sha256(prev_hash || row-canonical-json)
  row_hash      char(64) NOT NULL
);
REVOKE UPDATE, DELETE ON custody_events FROM PUBLIC;  -- enforced + trigger guard

CREATE TABLE evidence_tags (
  evidence_id uuid REFERENCES evidence_items(id),
  tag         text NOT NULL,
  tagged_by   uuid REFERENCES users(id),
  PRIMARY KEY (evidence_id, tag)
);

-- ============ INTEL SOURCES & CONNECTORS (doc 16) ============
CREATE TABLE connectors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  plugin_id     text NOT NULL,              -- 'raven.cyber.whois.generic'
  display_name  text NOT NULL,
  category      text NOT NULL,              -- 'identity','social','cyber','ti','breach','ai','records','financial','custom'
  status        text NOT NULL DEFAULT 'disabled'
                CHECK (status IN ('active','standby','disabled','error')),
  priority      int  NOT NULL DEFAULT 100,  -- lower = preferred
  fallback_connector_id uuid REFERENCES connectors(id),
  config        jsonb NOT NULL DEFAULT '{}',          -- non-secret config
  secret_ref    text,                                  -- vault path for API keys
  rate_limit    jsonb NOT NULL DEFAULT '{}',           -- {per_minute, per_day, budget}
  usage_counters jsonb NOT NULL DEFAULT '{}',
  trust_score   smallint NOT NULL DEFAULT 50,
  reliability_score smallint NOT NULL DEFAULT 50,
  collection_frequency interval,
  retention_policy jsonb NOT NULL DEFAULT '{}',        -- {days, legal_hold_exempt}
  last_health   jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intel_sources (                -- provenance registry (1 row per source identity)
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  connector_id uuid REFERENCES connectors(id),  -- NULL for manual / evidence-derived
  name        text NOT NULL,                -- 'feed:BR-12', 'registry-AT', 'manual'
  kind        text NOT NULL,                -- 'api','feed','dataset','manual','evidence','internal_db'
  trust_score smallint NOT NULL DEFAULT 50,
  reliability_score smallint NOT NULL DEFAULT 50,
  admiralty_code char(2)                    -- optional: 'B2' style source grading
);

CREATE TABLE collection_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      uuid REFERENCES cases(id),
  connector_id uuid NOT NULL REFERENCES connectors(id),
  transform    text NOT NULL,               -- 'email.breach_lookup', 'username.enumerate'
  input        jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued','running','succeeded','failed','fallback','cancelled')),
  attempts     int NOT NULL DEFAULT 0,
  fallback_of  uuid REFERENCES collection_jobs(id),
  result_summary jsonb,
  error        text,
  requested_by uuid NOT NULL REFERENCES users(id),
  legal_basis_id uuid REFERENCES case_legal_bases(id),
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- ============ THREAT INTEL ============
CREATE TABLE iocs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  type        text NOT NULL,                -- 'ip','domain','url','file_hash','email','mutex',...
  value       text NOT NULL,
  value_norm  text NOT NULL,
  tlp         text NOT NULL DEFAULT 'amber' CHECK (tlp IN ('clear','green','amber','amber_strict','red')),
  confidence  smallint NOT NULL DEFAULT 50,
  stix        jsonb,                        -- full STIX 2.1 object
  actor_entity_id uuid REFERENCES entities(id),
  source_id   uuid REFERENCES intel_sources(id),
  first_seen  timestamptz,
  last_seen   timestamptz,
  expires_at  timestamptz,
  UNIQUE (org_id, type, value_norm)
);

CREATE TABLE ioc_sightings (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ioc_id    uuid NOT NULL REFERENCES iocs(id),
  case_id   uuid REFERENCES cases(id),
  context   jsonb NOT NULL DEFAULT '{}',
  sighted_at timestamptz NOT NULL DEFAULT now()
);

-- ============ WATCHLISTS & ALERTS ============
CREATE TABLE watchlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  case_id     uuid REFERENCES cases(id),
  name        text NOT NULL,
  kind        text NOT NULL,                -- 'breach','ioc','geofence','entity_activity'
  items       jsonb NOT NULL DEFAULT '[]',
  legal_basis_id uuid REFERENCES case_legal_bases(id),
  approval_id uuid REFERENCES approvals(id),
  created_by  uuid NOT NULL REFERENCES users(id),
  enabled     boolean NOT NULL DEFAULT true
);

CREATE TABLE alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  watchlist_id uuid REFERENCES watchlists(id),
  case_id     uuid REFERENCES cases(id),
  severity    text NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  title       text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',  -- secrets stored masked; raw behind reveal flow
  status      text NOT NULL DEFAULT 'new' CHECK (status IN ('new','acknowledged','resolved','false_positive')),
  created_at  timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- ============ AI ENGINE ============
CREATE TABLE ai_conversations (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id   uuid REFERENCES cases(id),
  user_id   uuid NOT NULL REFERENCES users(id),
  provider_connector_id uuid REFERENCES connectors(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id),
  role       text NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content    jsonb NOT NULL,
  citations  jsonb NOT NULL DEFAULT '[]',   -- [{source_id|evidence_id|entity_id, span}]
  tokens_in  int, tokens_out int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rag_documents (                -- chunk registry; vectors live in pgvector
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL,
  case_id    uuid,
  source_kind text NOT NULL,                -- 'note','evidence_text','report','intel_item'
  source_ref uuid NOT NULL,
  chunk_no   int NOT NULL,
  text       text NOT NULL,
  embedding  vector(1024),                  -- pgvector; dim per configured embedder
  compartments text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX ON rag_documents USING hnsw (embedding vector_cosine_ops);

-- ============ REPORTS ============
CREATE TABLE reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    uuid NOT NULL REFERENCES cases(id),
  template   text NOT NULL,                 -- 'intel_brief','target_package','case_summary','court_disclosure'
  title      text NOT NULL,
  blocks     jsonb NOT NULL DEFAULT '[]',
  status     text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','published')),
  export_object_key text,
  created_by uuid NOT NULL REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ AUDIT (append-only, hash-chained, partitioned) ============
CREATE TABLE audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY,
  org_id      uuid NOT NULL,
  actor_id    uuid,                          -- NULL = system
  action      text NOT NULL,                 -- 'entity.read','case.export','connector.key.update',...
  object_type text NOT NULL,
  object_id   text,
  case_id     uuid,
  ip          inet,
  user_agent  text,
  detail      jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  prev_hash   char(64) NOT NULL,
  row_hash    char(64) NOT NULL,
  PRIMARY KEY (occurred_at, id)
) PARTITION BY RANGE (occurred_at);
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
```

Row-level security (compartmentation) example:

```sql
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY entity_compartment ON entities
  USING (
    compartments = '{}'::text[]
    OR compartments <@ current_setting('raven.user_compartments')::text[]
  );
```

## 2. Elasticsearch Indices

| Index | Purpose | Notable fields |
|-------|---------|----------------|
| `raven-entities` | omni-search over entities | `type`, `label` (text + keyword + phonetic analyzer + ICU folding), `attributes.*`, `risk_score`, `compartments` (filtered at query time) |
| `raven-documents` | extracted text (OCR, transcripts, evidence text, notes) | `text` (per-language analyzers), `case_id`, `evidence_id`, `lang`, highlights enabled |
| `raven-intel-items` | normalized feed items | `feed`, `category`, `observed_at`, `iocs`, `raw` |
| `raven-audit` | audit explorer (read replica of PG audit) | keyword-heavy, ILM 7y default |

Phonetic + fuzzy alias matching uses a custom analyzer chain: `icu_normalizer → icu_folding →
double_metaphone` plus an `edge_ngram` subfield for type-ahead.

## 3. Redis Keyspace

| Pattern | Type | Use |
|---------|------|-----|
| `sess:{token}` | hash, TTL | auth sessions |
| `presence:case:{id}` | hash | live collaborator cursors/selections |
| `rl:{connector}:{window}` | counter, TTL | connector rate limiting |
| `stream:jobs:collect` | stream + consumer groups | collection job queue |
| `stream:events:graph` | stream | real-time graph updates → WebSocket fanout |
| `cache:transform:{hash}` | string, TTL per source policy | connector response cache |
| `cb:{connector}` | hash | circuit-breaker state (failures, open-until) |

## 4. Data Lifecycle

- Every `entity_attributes` / `relationships` / `alerts` row inherits a retention policy from its
  `intel_sources` row; a nightly job hard-deletes expired rows unless a case legal hold pins them.
- Entity merges keep both rows (`merged_into`), all reads resolve to survivor; demerge is possible.
- PG → Neo4j and PG → ES projections run via Debezium CDC (online) or batch sync (air-gapped).
