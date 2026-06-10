# 07 — RBAC + ABAC Access Control Model

Raven uses **RBAC for coarse capability** and **ABAC for fine-grained, context-aware control**
(clearance, compartment, case membership, legal basis, data sensitivity). Both are evaluated by one
policy engine on every request; deny always wins.

## 1. Permission Catalog (RBAC)

Permissions are `domain:action` strings attached to roles.

| Domain | Permissions |
|--------|-------------|
| case | `case:create` `case:read` `case:update` `case:close` `case:export` `case:share` |
| entity | `entity:read` `entity:create` `entity:update` `entity:merge` `entity:delete` |
| graph | `graph:read` `graph:edit` `graph:transform.run` |
| evidence | `evidence:ingest` `evidence:read` `evidence:download` `evidence:verify` `evidence:transfer` |
| intel | `intel:read` `ioc:manage` `feed:manage` |
| breach | `breach:read` `breach:reveal` (sensitive) |
| face | `face:search` (sensitive) |
| financial | `financial:read` `financial:analyze` |
| ai | `ai:use` `ai:report.generate` |
| connector | `connector:read` `connector:manage` `connector:keys.manage` |
| admin | `user:manage` `role:manage` `policy:manage` `audit:read` `system:manage` |
| approval | `approval:request` `approval:decide` |

## 2. System Roles (default bundles)

| Role | Permission summary |
|------|--------------------|
| **Viewer** | `*:read` within assigned cases only; no exports, no sensitive reveals |
| **Investigator** | Viewer + case/entity/graph create/update, `graph:transform.run`, `ai:use`, `evidence:read`, `approval:request` |
| **Senior Investigator** | Investigator + `evidence:ingest/download`, `ioc:manage`, `financial:analyze`, `case:export` (with approval) |
| **Forensic Examiner** | `evidence:*`, `entity:read/create`, `graph:read` — scoped to assigned cases |
| **OSINT Collector** | `graph:transform.run`, `connector:read`, `entity:create`, `intel:read` |
| **Analyst (Intel)** | Investigator + `ai:report.generate`, full graph edit, `intel:read`, cross-case read in own compartments |
| **Supervisor** | Investigator + `approval:decide`, `case:close`, `user:manage` (team), `audit:read` (team) |
| **Administrator** | `connector:*`, `user:manage`, `role:manage`, `policy:manage`, `system:manage`, `audit:read` |
| **Auditor** | `audit:read`, read-only across org; cannot mutate or reveal secrets |

Sensitive permissions (`breach:reveal`, `face:search`, `case:export`, `evidence:transfer`) **always**
additionally require an approval workflow even when the role grants them.

## 3. ABAC Attributes

| Subject (user) | Resource | Environment/context |
|----------------|----------|---------------------|
| `clearance_level` (0–4) | `classification` / `sensitivity` | time of day, location/network |
| `compartments[]` | `compartments[]` | deployment mode (air-gap) |
| `roles[]`, case memberships | `case_id`, `owner`, `legal_basis_valid` | MFA-recently-verified flag |
| `org_id` | `retention_state`, `legal_hold` | request risk score |

### Core ABAC rules

1. **Clearance dominance**: `subject.clearance_level >= resource.required_clearance`.
2. **Compartment containment**: `resource.compartments ⊆ subject.compartments` (empty = unrestricted).
3. **Case membership**: mutating case data requires membership in that case (or org-wide elevated role).
4. **Legal-basis gate**: running collection transforms / revealing breach data requires an active,
   unexpired `case_legal_bases` row; expired basis → deny + alert.
5. **Need-to-know**: cross-case entity reads allowed only within shared compartments.
6. **Step-up**: sensitive actions require MFA verified within the last 15 minutes.
7. **Air-gap policy**: in air-gapped mode, any connector flagged `requires_egress` is denied.

### Policy representation

Stored in `abac_policies.condition` as JSON-logic / CEL, e.g. breach reveal:

```json
{
  "effect": "allow",
  "action": "breach:reveal",
  "condition": {
    "and": [
      {">=": [{"var":"subject.clearance_level"}, 2]},
      {"in": ["breach:reveal", {"var":"subject.permissions"}]},
      {"==": [{"var":"resource.approval.status"}, "approved"]},
      {"var": "resource.legal_basis_valid"},
      {"var": "context.mfa_fresh"}
    ]
  }
}
```

## 4. Evaluation Flow (PDP/PEP)

```
Request ─▶ PEP (gateway + service) ─▶ PDP (policy engine)
   PDP steps:
   1. Gather subject attrs (JWT + user record), resource attrs (DB), context.
   2. RBAC check: does any role grant the permission? if none → DENY.
   3. ABAC: evaluate all matching policies by priority; explicit DENY wins;
      else require at least one ALLOW.
   4. Sensitive-action gate: approval + legal basis + step-up.
   5. Emit decision + reason to audit_log (allow and deny).
```

Decisions are cached briefly per `(subject, action, resource-version)`; resource mutations bust cache.

## 5. Compartmentation in Storage

- PostgreSQL row-level security keys off `current_setting('raven.user_compartments')` (doc 04 §1).
- Neo4j queries always include the compartment predicate (doc 06 §3).
- Elasticsearch queries inject a compartment filter clause server-side; clients cannot remove it.
- MinIO evidence objects are encrypted per-case (envelope keys); download requires PEP allow + custody
  event.

## 6. Delegation, Break-Glass, Separation of Duty

- **Case-scoped roles**: a user can be Investigator org-wide but Lead on one case via
  `user_roles.scope_case_id`.
- **Break-glass**: emergency elevated access requires two-person authorization, is time-boxed, raises a
  CRITICAL alert, and is heavily audited.
- **Separation of duty**: the requester of a sensitive approval cannot be its approver; report author
  cannot be sole approver for court-disclosure exports.
