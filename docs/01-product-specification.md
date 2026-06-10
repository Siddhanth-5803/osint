# 01 — Complete Product Specification

## 1. Vision

Project Raven is a single investigative workspace where authorized analysts fuse every lawful
intelligence source — OSINT, commercial feeds, agency databases, public records, breach-monitoring
feeds, geospatial data, media, and forensic evidence — into entities, relationships, timelines, and
reports. It looks and behaves like a classified military command center, runs anywhere from a laptop
to an air-gapped enclave, and is never locked to any vendor.

### Product pillars

| Pillar | Meaning |
|--------|---------|
| Fusion | All sources normalize into one entity/relationship/event model |
| Velocity | Search → pivot → graph → map → timeline → report without leaving one screen flow |
| Integrity | Hash-verified evidence, immutable audit, chain of custody on everything |
| Sovereignty | BYO data/AI/APIs/infrastructure; air-gapped operation with zero telemetry |
| Lawfulness | Legal basis bound to every collection task; compartmented, audited access |

## 2. Personas

| Persona | Role | Primary surfaces |
|---------|------|------------------|
| Case Investigator | Runs investigations end-to-end | Search, entity profiles, graph, timeline |
| Intelligence Analyst | Deep correlation & production | Graph workspace, AI copilot, briefing builder |
| Forensic Examiner | Ingests/validates device extractions | Evidence vault, ingestion pipelines |
| OSINT Collector | Configures and runs collection | Collection console, Integrations Center |
| Supervisor | Approves, assigns, reviews | Case dashboard, approval queue, audit views |
| System Administrator | Operates platform | Admin panel, connectors, RBAC, health |
| Executive / Chief | Situational awareness | Executive dashboard, briefings |

## 3. Core Investigation Modules

### A. Identity Intelligence
- **Person profiling**: consolidated profile (names, DOBs, identifiers, photos, biometrics references,
  documents) with per-attribute source provenance and confidence (0–100).
- **Alias discovery**: phonetic (Double Metaphone), transliteration, and embedding-based name
  similarity across all ingested records; AI-suggested alias candidates with evidence chains.
- **Username correlation**: seed username → enumerate presence across configured platforms via
  connector plugins (Sherlock-class capability as a built-in offline-capable connector); fuzzy
  variants (leet, separators, year suffixes).
- **Email correlation**: format validation, domain intelligence, gravatar/profile discovery via
  connectors, breach-exposure lookups via lawful breach feeds, email→account pivots.
- **Phone intelligence**: parsing/normalization (libphonenumber), carrier/line-type/region from local
  datasets, caller-ID and messaging-app presence via optional connectors, phone→person pivots.
- **Address intelligence**: geocoding (online or offline Nominatim/Pelias), occupancy history from
  public records connectors, co-residency analysis.
- **Organization associations, employment & education history**: extracted from records and
  documents; rendered as graph edges with date ranges.
- **Public records integration**: pluggable connectors for corporate registries, court records,
  property, vehicle, voter, licensing, sanctions/PEP lists; agency-licensed sources mount the same way.

### B. Social Intelligence
- Social media discovery from seed identifiers (username/email/phone/name+location) through connectors.
- Cross-platform profile correlation: avatar perceptual-hash + face embedding match, bio text
  similarity, posting-time-fingerprint, mutual-network overlap → composite match score.
- Profile similarity analysis with explainable per-feature scores.
- Network mapping: follower/friend graphs into Neo4j; community detection (Louvain/Leiden);
  influence analysis (PageRank, betweenness, eigenvector centrality).
- Relationship mapping with typed edges (FOLLOWS, MENTIONS, REPLIES_TO, TAGGED_WITH).

### C. Media Intelligence
- Image metadata + full EXIF extraction (GPS, device make/model/serial, software, timestamps).
- Face comparison workflows: detect → align → embed (local ONNX models, e.g. ArcFace-class) →
  1:1 verify and 1:N search within case-scoped, legally authorized galleries; human-in-the-loop
  adjudication required before any identity assertion; thresholds and usage policy set by admin.
- Reverse image search: pluggable engines (commercial APIs or self-hosted index over case media).
- Object/logo/landmark detection: local models (YOLO-class, CLIP retrieval) or cloud vision connectors.
- OCR (Tesseract/PaddleOCR local; cloud optional) with language packs; searchable text indexed in ES.
- Video: scene/keyframe extraction (ffmpeg + shot detection), per-frame analysis pipeline.
- Audio: transcription via local Whisper-class models or cloud connectors; diarization; translation.

### D. Geospatial Intelligence
- Interactive world map (MapLibre GL; offline tile packages for air-gap) with dark tactical basemap.
- Location clustering (DBSCAN/H3), heatmaps, geofence creation with retro-/prospective alerts on
  case data.
- Movement analysis & travel pattern visualization from timestamped geodata in evidence (EXIF, CDR
  imports, forensic extractions, transaction locations).
- Timeline-coupled playback: scrub time → markers animate across map.

### E. Cyber Intelligence
- Domain intelligence: WHOIS (live connector or imported datasets), registration history, registrant
  pivots.
- DNS intelligence: current + passive DNS (pluggable pDNS providers or internal stores), subdomain
  enumeration via connectors, record history diffing.
- IP intelligence: geolocation (local MMDB), ASN, reverse DNS, open-port/banner data via lawful scan
  data providers (e.g. agency-licensed Shodan/Censys-class feeds), reputation scoring.
- SSL certificate mapping: CT-log ingestion, cert→domain→IP pivot graphs, fingerprint reuse detection.
- Infrastructure correlation: shared registrant/NS/IP/cert/analytics-ID clustering → graph clusters
  supporting threat actor attribution assessments (always presented as assessments with confidence,
  never as facts).

### F. Threat Intelligence
- IOC management: STIX 2.1-native objects (indicator, malware, threat-actor, campaign, intrusion-set,
  attack-pattern mapped to MITRE ATT&CK), TLP/PAP marking, expiry & sighting tracking.
- Feed ingestion: TAXII 2.1, MISP sync, CSV/JSON feeds, vendor connectors; dedup + merge.
- Malware intelligence: hash lookups against configured providers or imported datasets; sandbox
  report attachment; YARA rule storage and matching over evidence vault (defensive analysis only).
- Risk scoring: configurable weighted model per entity (exposure, associations, IOC overlap,
  recency); explainable factor breakdown.
- Adversary tracking: actor dossiers, campaign timelines, TTP matrices.

### G. Dark Web Monitoring (lawful feeds only)
- Ingests **legally obtained** commercial dark-web intelligence feeds and breach-monitoring feeds —
  the platform does not itself crawl illegal marketplaces.
- Breach monitoring: watchlists of agency-authorized identifiers (emails/domains/usernames) checked
  against subscribed breach feeds; credential-exposure alerts (passwords never displayed in clear by
  default; reveal requires elevated permission + audit event).
- Marketplace monitoring intelligence: vendor-supplied listings/actor data normalized into entities.
- Threat actor tracking: handle correlation across feeds, PGP-key reuse, writing-style similarity
  (stylometry, presented with confidence bands).

### H. Financial Intelligence
- Transaction ingestion (CSV/JSON/ISO 20022 imports, agency systems via connectors).
- Transaction relationship visualization: account→account flow graphs with amount-weighted edges,
  time filtering, flow aggregation.
- Suspicious activity clustering: structuring detection, rapid in/out, round-tripping, fan-in/fan-out
  patterns, peeling chains; rule library + anomaly models; every detection explainable.
- Entity relationship mapping: accounts↔persons↔organizations↔assets in the same graph as all other
  intelligence.
- Asset intelligence: property/vehicle/company holdings from public-record connectors;
  cryptocurrency address clustering via pluggable chain-analytics providers or imported attribution
  datasets.

## 4. Cross-Cutting Systems

- **AI Investigation Engine** — see doc 08. NL investigation, summarization, lead generation, link
  analysis, entity extraction, timeline creation, threat scoring, pattern detection, report and
  intelligence-brief generation. All AI output is marked as machine-generated, cites sources, and
  requires analyst confirmation before becoming case fact.
- **Link Analysis System** — see doc 06 + 10. Palantir/i2/Maltego-class interactive graph: infinite
  zoom canvas (WebGL), entity clustering, relationship weighting, dynamic expansion ("transforms"),
  saved investigation workspaces, real-time collaborative updates via WebSocket.
- **Digital Forensics Integration** — importers for standard mobile/computer/memory/cloud forensic
  export formats (UFDR-class mobile extraction reports, E01/AFF4 disk image metadata, memory-analysis
  tool output, cloud-acquisition exports, OSINT tool exports such as Maltego CSV) → evidence vault
  with SHA-256/512 verification, chain of custody, and entity extraction into the fusion model.
- **Case Management** — see doc 14. Multi-user collaboration, notes, evidence tagging, tasking,
  approval workflows, timelines, dashboards, secure sharing (internal compartments + exportable
  encrypted case packages).
- **Plugin-Based Intelligence Collection Framework** — see doc 16. Everything external is a connector.

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Scale | 10M+ entities, 100M+ relationships, 1B+ documents per deployment; 500 concurrent analysts |
| Graph perf | Expand-1-hop < 300 ms p95 at 50M edges; canvas 10k visible nodes at 60 fps |
| Search | Full-text across all indexed intel < 800 ms p95 |
| Availability | 99.9% (HA mode); single-node mode for tactical kits |
| Security | Zero-trust, RBAC+ABAC, MFA, SSO (OIDC/SAML), FIPS-capable crypto, full audit |
| Air-gap | 100% functionality (minus live external feeds) offline; zero telemetry; offline updates |
| Data residency | Customer-controlled storage only; no data leaves deployment unless a connector is explicitly configured |
| Compliance posture | Audit/chain-of-custody designed to satisfy evidentiary standards; retention policies per source & legal basis |
| i18n | Full Unicode; RTL support; transliteration-aware search |
| Extensibility | New connector deployable without core code changes or platform restart |

## 6. Out of Scope / Prohibited by Design

- No unlawful interception, no hacking/exploitation tooling, no unauthorized access capability.
- No autonomous action against targets; the platform only collects from configured lawful sources.
- Face recognition and breach data are permission-gated, policy-bound, and fully audited.
- No vendor telemetry, ever.
