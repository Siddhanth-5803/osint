# 06 — Neo4j Graph Design

Neo4j is the analytics + workspace projection of the PostgreSQL `entities`/`relationships` system of
record (kept in sync via CDC online, batch in air-gap). It powers link analysis, pathfinding,
community detection, and centrality.

## 1. Node Model

Every fusion entity becomes a node labelled `:Entity` plus a type label. Common properties:

```
(:Entity {
  id, orgId, label, type,
  riskScore, confidence,
  compartments,        // []  — enforced in every query
  createdAt, updatedAt
})
```

Type labels: `:Person :Email :Phone :Username :Domain :IP :Organization :Vehicle :Location
:Device :Account :Wallet :File :Document :Event`.

Supporting nodes: `:Case`, `:User`, `:IntelSource`, `:Evidence` (used for provenance + scoping edges).

Constraints & indexes:

```cypher
CREATE CONSTRAINT entity_id    IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT case_id      IF NOT EXISTS FOR (c:Case)   REQUIRE c.id IS UNIQUE;
CREATE INDEX entity_type       IF NOT EXISTS FOR (e:Entity) ON (e.type);
CREATE INDEX entity_label      IF NOT EXISTS FOR (e:Entity) ON (e.label);
CREATE INDEX entity_risk       IF NOT EXISTS FOR (e:Entity) ON (e.riskScore);
CREATE FULLTEXT INDEX entitySearch IF NOT EXISTS FOR (e:Entity) ON EACH [e.label];
```

## 2. Relationship Model

Typed, directed, weighted, time-bounded, provenance-carrying:

```
()-[:REL {
  id, type,            // semantic type below
  weight, confidence,
  validFrom, validUntil,
  sourceId, evidenceId,
  properties           // map
}]->()
```

We use a single `:REL` type with a `type` property for flexible analytics, **and** mirror the
semantic type as an additional relationship type for fast Cypher pattern matching. Semantic taxonomy:

| Domain | Relationship types |
|--------|--------------------|
| Identity | `KNOWS`, `ALIAS_OF`, `RELATED_TO`, `EMPLOYED_BY`, `STUDIED_AT`, `MEMBER_OF`, `OWNS`, `CONTACT_OF` |
| Communication | `EMAILED`, `CALLED`, `MESSAGED`, `MENTIONS`, `REPLIED_TO`, `FOLLOWS` |
| Cyber | `RESOLVES_TO`, `HOSTED_ON`, `REGISTERED`, `USES_CERT`, `SUBDOMAIN_OF`, `COMMUNICATES_WITH`, `INDICATES` |
| Geospatial | `LOCATED_AT`, `TRAVELLED_TO`, `RESIDES_AT`, `SEEN_AT` |
| Device | `USED_DEVICE`, `LOGGED_IN_FROM`, `HAS_IMEI`, `CONNECTED_TO` |
| Financial | `TRANSFERRED_TO`, `HOLDS_ACCOUNT`, `CONTROLS_WALLET`, `BENEFICIARY_OF` |
| Provenance | `DERIVED_FROM` (→ `:Evidence`/`:IntelSource`), `COLLECTED_BY` (→ `:User`) |
| Case scope | `IN_CASE` (Entity→Case) |

## 3. Canonical Queries

Expand one hop (graph workspace, compartment-filtered):

```cypher
MATCH (e:Entity {id:$id})
WHERE any(c IN e.compartments WHERE c IN $userCompartments) OR e.compartments = []
MATCH (e)-[r:REL]-(n:Entity)
WHERE r.confidence >= $minConf
  AND (n.compartments = [] OR any(c IN n.compartments WHERE c IN $userCompartments))
RETURN e, r, n
ORDER BY r.weight DESC
LIMIT $limit;
```

Shortest / k-shortest hidden paths between two entities:

```cypher
MATCH (a:Entity {id:$from}), (b:Entity {id:$to})
CALL apoc.algo.allSimplePaths(a, b, '', $maxDepth) YIELD path
WITH path, reduce(w=0.0, r IN relationships(path) | w + r.weight) AS score
RETURN path ORDER BY length(path), score DESC LIMIT 5;
```

Infrastructure correlation cluster (shared selectors around a domain):

```cypher
MATCH (d:Domain {id:$id})-[:RESOLVES_TO]->(ip:IP)<-[:RESOLVES_TO]-(d2:Domain)
OPTIONAL MATCH (d)-[:REGISTERED]->(reg)<-[:REGISTERED]-(d2)
RETURN d2, count(DISTINCT ip) AS sharedIPs, count(DISTINCT reg) AS sharedReg
ORDER BY sharedIPs + sharedReg DESC;
```

## 4. Graph Data Science (GDS) Analytics

Project a case subgraph, then run analytics; results are written back as node properties surfaced in
the UI (node size, cluster hull color, influence ranking).

```cypher
CALL gds.graph.project.cypher(
  'case-2231',
  'MATCH (e:Entity)-[:IN_CASE]->(:Case {id:$cid}) RETURN id(e) AS id',
  'MATCH (a:Entity)-[r:REL]->(b:Entity) RETURN id(a) AS source, id(b) AS target, r.weight AS weight',
  {parameters:{cid:$cid}}
);

CALL gds.louvain.write('case-2231', {writeProperty:'community'});       // community detection
CALL gds.pageRank.write('case-2231', {writeProperty:'influence',
     relationshipWeightProperty:'weight'});                            // influence analysis
CALL gds.betweenness.write('case-2231', {writeProperty:'betweenness'}); // brokers / cut-points
CALL gds.beta.closeness.write('case-2231', {writeProperty:'closeness'});
```

| Analytic | UI meaning |
|----------|-----------|
| Louvain / Leiden `community` | cluster hulls, "community detection" |
| PageRank `influence` | node size + "influence analysis" ranking |
| Betweenness `betweenness` | flags brokers / key intermediaries (orange ring) |
| Node similarity | "profile similarity" / alias suggestions |
| Shortest paths | "show connections between entities" |

## 5. Temporal & Versioning

- Relationships carry `validFrom`/`validUntil`; the timeline scrubber filters edges by interval.
- Graph snapshots for reports: a query at time T returns only edges valid at T.
- Change feed: PG CDC → `stream:events:graph` → server applies to Neo4j and pushes `GraphDelta` to
  subscribed clients for real-time updates.

## 6. Performance & Scale

- Target: 50M nodes / 500M relationships per deployment; 1-hop expand < 300 ms p95.
- Composite indexes on `(type)`, `(riskScore)`; relationship type mirroring avoids full `:REL` scans.
- Heavy GDS runs execute on named projections off the write path; results cached in Redis per case.
- Air-gapped: single-node Neo4j with periodic snapshot backups; HA uses a causal cluster (3 cores).
