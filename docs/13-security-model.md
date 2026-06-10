# 13 — Enterprise Security Model

Zero-trust, defense-in-depth, evidence-grade integrity, and sovereignty (no telemetry, no vendor
lock-in). Designed to operate in classified, air-gapped environments.

## 1. Principles

1. **Zero trust** — authenticate and authorize every request (user→service and service→service); never
   trust the network.
2. **Least privilege** — RBAC + ABAC (doc 07); compartmentation enforced in every datastore.
3. **Tamper-evidence** — append-only, hash-chained audit and chain of custody.
4. **Data sovereignty** — customer controls all storage and keys; no data egress without an explicit
   configured connector; zero telemetry.
5. **Defense in depth** — controls at edge, app, data, and infra layers.
6. **Lawful by construction** — legal basis required to collect/reveal; retention enforced per source.

## 2. Identity & Access

- **AuthN**: password (Argon2id) + mandatory MFA (TOTP / WebAuthn-FIDO2). SSO via OIDC/SAML to
  customer IdP (configured, never hardcoded). Short-lived access JWT (10 min) + rotating refresh in
  httpOnly/SameSite=strict cookie. Device binding optional.
- **Step-up auth** for sensitive actions (breach reveal, face search, export, key management): MFA
  re-verification within 15 minutes.
- **Session security**: idle + absolute timeouts, concurrent-session limits, server-side revocation,
  IP/network-context checks.
- **AuthZ**: PEP at gateway and in services → central PDP (doc 07); deny-by-default; every decision
  audited.

## 3. Cryptography

| Layer | Control |
|-------|---------|
| In transit | TLS 1.3 everywhere (external + internal mTLS); FIPS 140-3 validated modules where required |
| At rest — DB | PostgreSQL/Neo4j/ES volume encryption (LUKS/cloud KMS) + column-level envelope encryption for secrets (MFA seeds, tokens) |
| At rest — evidence | Per-case envelope encryption: data key wraps object; key encrypted by org KEK in Vault; MinIO WORM + object lock |
| Key management | HashiCorp Vault (or HSM/PKCS#11 in high-assurance/air-gap); KEK rotation; split-knowledge/dual-control for master keys |
| Hashing | SHA-256 + SHA-512 for evidence; Argon2id for passwords; HMAC for webhook verification |
| Signing | cosign-signed images; signed report exports; signed audit export bundles |

## 4. Evidence Integrity & Chain of Custody

- On ingest: SHA-256 + SHA-512 computed (client and server), stored, and re-verified on every access
  and on a schedule; mismatch → CRITICAL alert + row flagged.
- **Custody ledger** (`custody_events`): append-only, each row hash-chained to the previous
  (`row_hash = sha256(prev_hash || canonical(row))`); UPDATE/DELETE revoked + trigger-guarded.
- Every evidence access/download/export/transfer writes a custody event with actor, time, purpose, and
  legal basis.
- WORM object storage with object-lock retention prevents binary tampering/deletion within retention.
- Court-disclosure export produces a signed custody report and excludes AI-only inferences.

## 5. Audit

- **Everything is audited**: reads of sensitive data, all mutations, auth events, policy decisions
  (allow and deny), connector key changes, exports, break-glass, AI tool calls.
- `audit_log` is append-only, hash-chained, partitioned, with 7-year default retention (configurable);
  exportable as a signed bundle for oversight bodies.
- Audit Explorer (admin) is filterable/searchable; Auditor role is read-only org-wide and cannot reveal
  secrets.

## 6. Data Protection & Privacy

- **Compartmentation** at row level (PG RLS), graph (Cypher predicate), search (injected filter), and
  object (per-case keys).
- **Retention by source**: each `intel_sources`/`connectors` row carries a retention policy; expired
  data is purged nightly unless under legal hold.
- **Minimization & masking**: breach passwords stored masked; reveal requires approval + step-up +
  audit. PII redaction policy can strip selectors before any egress to a cloud connector.
- **Legal hold** overrides retention for pinned case data; lifting a hold is a dual-control action.

## 7. Application Security

- Strict input validation (pydantic), parameterized queries, output encoding; CSP, HSTS,
  X-Frame-Options, COOP/COEP on the web app.
- **Prompt-injection / untrusted-content handling** (doc 08 §6): web pages, feed text, documents, and
  PR/issue-style external content are treated as data, never instructions; tool-call arguments derived
  from external text are screened.
- SSRF protections on the Open Internet connector: egress allowlist/denylist, block of internal/link-
  local/metadata addresses, DNS-rebinding guard, response size caps, robots.txt compliance.
- Secrets never logged; connector keys only in Vault; redaction in logs/traces.
- Supply chain: signed images, SBOM, dependency scanning, pinned digests, reproducible air-gap bundle.

## 8. Infrastructure & Network

- Default-deny network policy; only connector pods may egress, only when permitted; air-gap blocks all
  outbound at the gateway.
- Namespace isolation, pod security standards (restricted), read-only root FS, non-root users, seccomp.
- Secrets via CSI from Vault; no plaintext secrets in manifests/env.
- mTLS service mesh (optional) for east-west; rate limiting + WAF at the edge.

## 9. Hardening & Assurance Posture

- Designed to support accreditation regimes (e.g. ISO 27001, SOC 2, and government frameworks);
  controls map to NIST 800-53 families (AC, AU, IA, SC, SI).
- Regular SAST/DAST/dependency scans in CI; periodic third-party penetration testing recommended.
- Break-glass requires two-person authorization, is time-boxed, and raises a CRITICAL alert.
- No telemetry, no phone-home, no usage analytics leave the deployment — verifiable via default-deny
  egress.
