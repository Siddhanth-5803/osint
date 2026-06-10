# 14 — Investigation Workflow Design

How analysts actually work in Raven, end to end, with the legal, collaboration, and integrity controls
that make outputs defensible.

## 1. Case Lifecycle

```
 draft ──▶ open ──▶ active ──▶ suspended ──▶ closed ──▶ archived
   │         │         │           │            │
 create   add legal  collect/   pause (no     supervisor
 case     basis +    analyze    collection)   approval to
          members                              close
```

- **Create** (`case:create`): code, title, classification, compartments, lead.
- **Legal basis** (`case_legal_bases`): warrant/order/statute/consent/MOU with validity window and
  scanned authorization. **Collection transforms and sensitive reveals are blocked until a valid basis
  exists**; expiry triggers an alert and re-blocks.
- **Membership**: add investigators/examiners/viewers with case-scoped roles.
- **Close/Archive**: supervisor approval; closing freezes collection; archived cases are read-only but
  fully preserved (evidence, custody, audit).

## 2. Collection → Fusion Flow (the core loop)

```
 SEED ──▶ TRANSFORM ──▶ NORMALIZE ──▶ RESOLVE ──▶ ENRICH ──▶ REVIEW ──▶ FACT
 (entity)  (connector)  (to model)   (merge?)   (more)    (analyst)  (case)
```

1. **Seed**: analyst adds/searches an entity (person, email, username, domain, IP, phone, wallet…).
2. **Transform**: run a connector transform from the entity "Expand" menu, the graph inspector, or the
   AI copilot. This includes **Open Internet** transforms (`web.search`, `web.fetch`, `web.crawl`) so a
   plain internet connection alone can drive discovery — no paid API needed.
3. **Normalize**: results become entities/relationships/events with **provenance + confidence**.
4. **Resolve**: entity-resolution proposes merges (e.g. two `person` records → one) for analyst
   confirmation; merges are reversible.
5. **Enrich**: pivot further (username→profiles, domain→infra, phone→accounts), building the graph.
6. **Review**: analyst confirms/marks each AI- or connector-derived item; unconfirmed items are badged
   "unverified."
7. **Fact**: confirmed items become case fact, visible in graph/map/timeline/reports.

Every step writes an audit entry; every collection job records the legal basis it ran under.

## 3. Multi-User Collaboration

- **Presence**: live avatars + colored cursors/selections in graph and notes (WebSocket).
- **Shared notes**: CRDT (Yjs) concurrent editing; snapshots indexed for search.
- **Tasking**: create/assign tasks with due dates and status; tasks tie to entities/evidence.
- **Hand-off**: case timeline + audit give a complete picture for shift changes.
- **Comments/mentions**: @mention notifies; threads attach to entities, evidence, or graph regions.

## 4. Approval Workflows

Requested via `approval:request`, decided via `approval:decide` (separation of duty enforced):

| Action | Why gated | Requires |
|--------|-----------|----------|
| Breach data reveal | exposes credentials | supervisor approval + step-up + legal basis + audit |
| Face search (1:N) | biometric sensitivity | approval + policy thresholds + human adjudication |
| Case export / share | data leaving compartment | manifest review + approval + signed package |
| Evidence transfer | custody change | dual-control + custody event |
| Watchlist creation | ongoing monitoring | legal basis + approval |
| Court-disclosure report | evidentiary output | author ≠ sole approver; AI inferences stripped |

Approval requests appear in the Supervisor queue with justification and context; decisions (with
reason) are audited and notify the requester.

## 5. Evidence & Forensics Workflow

```
 ACQUIRE (external tool) ─▶ INGEST (hash+custody) ─▶ EXTRACT (importer) ─▶
 CORRELATE (into graph/timeline) ─▶ ANALYZE (media/AI) ─▶ REPORT (with custody appendix)
```

- **Ingest wizard**: select source tool (mobile-extraction, disk-image, memory-dump,
  cloud-acquisition, OSINT export), upload, hashes computed both sides, metadata + legal basis
  captured, custody event #1 written.
- **Importers** parse standard forensic exports into entities/events (e.g. contacts, calls, messages,
  media, locations) — all tagged with the evidence ID as provenance.
- **Verification**: scheduled + on-access hash re-verification; mismatch → CRITICAL alert.
- **Media analysis**: EXIF/faces/OCR/objects/transcription in the workbench; artifacts promote to
  entities/events on analyst action.

## 6. Timeline Reconstruction

- Events flow from evidence, transactions, geodata, and manual entry into `timeline_events`.
- AI "build a timeline" assembles dated events (cited) for analyst review.
- Timeline is coupled to the map (scrub time → movement plays) and to the graph (edges filtered by
  validity interval).

## 7. Reporting & Dissemination

- Report builder (doc 03 §2.13): blocks for entities, graph/map snapshots, timelines, tables, AI
  sections (clearly badged and analyst-verified).
- Templates: Intelligence Brief, Target Package, Case Summary, Court Disclosure.
- Export: PDF/DOCX with classification headers/footers and per-page watermark (user + timestamp);
  court template includes the signed custody appendix and excludes AI-only inferences.
- Dissemination: internal compartment share, or encrypted case package for external liaison (approval +
  manifest + signing).

## 8. Worked Example — "OP-2231 GREYFALCON" (online, no paid APIs)

1. Open case, attach warrant W-88123 (legal basis), add team.
2. Seed username `kestrel_9`. Run `username.enumerate` (offline-capable) **and** `web.search`
   (Open Internet, key-free) from the Expand menu.
3. Open Internet `web.fetch`/`web.crawl` on returned profile pages → extracts emails, a phone, and
   linked handles, each with `source_url` provenance.
4. Entity resolution proposes merging two extracted personas into Person P-0441 (alias 0.87); analyst
   confirms.
5. Copilot: "Show all known connections between P-0441 and ORG-771." It runs `graph.paths`, returns 3
   cited paths, "Render on graph."
6. Copilot: "Build a timeline" and "Identify possible aliases" → reviewable outputs.
7. Ingest a mobile extraction (UFDR-class) → custody chain started, contacts/messages correlate into
   the graph, corroborating the web findings.
8. Supervisor approves a breach-data reveal for one email; copilot drafts an Intelligence Brief with
   citations; analyst verifies and exports a watermarked PDF.

Every action above was lawful-basis-bound, provenance-tracked, and audited — and the discovery phase
ran on **nothing but a normal internet connection**.
