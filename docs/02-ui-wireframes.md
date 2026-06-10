# 02 — UI Wireframes

All screens share the **Obsidian Orange** shell: left tactical nav rail, top command bar with global
omni-search (`⌘K`), right slide-over AI copilot, status strip at bottom (classification banner,
connection mode, clock UTC/local).

Legend: `▣` widget · `◉` live/animated element · `⚿` permission-gated.

---

## 1. App Shell

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ███ CLASSIFICATION BANNER (configurable, e.g. RESTRICTED) ███████████████████ │
├────┬─────────────────────────────────────────────────────────────┬───────────┤
│    │  ⌕ Omni-search (entities, cases, IOCs, files…)   ⌘K        │ 🔔 ▾ user │
│ R  ├─────────────────────────────────────────────────────────────┴───────────┤
│ A  │                                                                          │
│ V  │                        ACTIVE MODULE VIEWPORT                            │
│ E  │                                                                          │
│ N  │                                                                          │
│    │                                                                          │
│ ── │                                                                          │
│ ⌂  │  Dashboard                                                               │
│ ▤  │  Cases                                                                   │
│ ⌖  │  Search                                                                  │
│ ☍  │  Graph                                                                   │
│ ◬  │  Map                                                                     │
│ ▦  │  Media                                                                   │
│ ⚠  │  Threat Intel                                                            │
│ 🌑 │  Dark Web ⚿                                                              │
│ ₿  │  Financial                                                               │
│ 🗄 │  Evidence                                                                │
│ ⚙  │  Admin ⚿                                                                 │
├────┴──────────────────────────────────────────────────────────────────────────┤
│ ◉ MODE: AIR-GAPPED │ CASE: OP-2231 GREYFALCON │ 14:32:07Z │ ◉ feeds: 6/6 OK   │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 2. Executive Dashboard

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ EXECUTIVE DASHBOARD                                   range: [24h ▾]  ⟳ live │
├───────────────┬───────────────┬───────────────┬──────────────────────────────┤
│ ▣ ACTIVE      │ ▣ THREAT      │ ▣ EVIDENCE    │ ▣ AI RECOMMENDATIONS ◉       │
│   CASES       │   ALERTS ◉    │   INGESTED    │ • Link P-1182 ↔ ORG-771      │
│     47        │   12 ▲3       │   1.2 TB      │   (shared phone, conf 0.87)  │
│  ▁▃▅▇ trend   │  3 CRITICAL   │  98 items/24h │ • Review anomaly in OP-2231  │
├───────────────┴───────┬───────┴───────────────┴──────────────────────────────┤
│ ▣ GEOSPATIAL MAP ◉    │ ▣ GLOBAL INTELLIGENCE FEED ◉                         │
│  (dark world map,     │  14:31Z  [BREACH] watchlist hit: domain agency.x     │
│   pulsing event dots, │  14:29Z  [OSINT] new profile match P-0441 conf 0.91  │
│   geofence rings)     │  14:25Z  [TI] IOC sighting ip 203.0.113.7 (OP-2231)  │
│                       │  14:21Z  [CASE] OP-2240 escalated by R.Vance         │
├───────────────────────┴───────────────┬──────────────────────────────────────┤
│ ▣ ENTITY CORRELATION GRAPH (mini) ◉   │ ▣ RISK HEATMAP                       │
│   live force layout preview,          │   matrix: case × risk-factor,        │
│   click → opens Graph workspace       │   orange-gradient cells              │
├───────────────────────────────────────┴──────────────────────────────────────┤
│ ▣ INVESTIGATION TIMELINE (all my cases, swimlanes)  ──●───●──●────●──▶        │
├───────────────────────────────────────────────────────────────────────────────┤
│ ▣ INTELLIGENCE BRIEFING PANEL — AI morning brief (sources cited)  [Generate] │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 3. Case Workspace

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ OP-2231 GREYFALCON   status:[ACTIVE ▾]  priority:CRITICAL  lead: A.Reyes     │
│ tabs: Overview │ Entities │ Graph │ Map │ Timeline │ Evidence │ Tasks │ Notes │ Reports │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ ▣ SUMMARY (AI-drafted, ⚑      │ ▣ TASKS                                      │
│   analyst-approved badge)     │ ☐ Verify alias "kestrel_9" — due 12 Jun     │
│ ▣ KEY ENTITIES (chips)        │ ☑ Ingest UFDR extraction — done              │
│  [P-0441 ★][D-toxin.example]  │ ☐ Supervisor approval: breach reveal ⚿       │
│ ▣ LEGAL BASIS                 │ ▣ RECENT ACTIVITY (audit-fed feed)           │
│  Warrant #W-88123 · exp 30 Jun│ ▣ COLLABORATORS  ●A.Reyes ●K.Osei ●+3        │
├───────────────────────────────┴──────────────────────────────────────────────┤
│ ▣ CASE TIMELINE  ──●────●──●────────●──▶   [+ add event] [AI: build timeline]│
└───────────────────────────────────────────────────────────────────────────────┘
```

## 4. Entity Profile (Person)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⬤ PERSON P-0441 "Viktor MARES"      risk ▮▮▮▮▮▮▮░░░ 68   conf 0.92          │
│ [Add to graph] [Watch] [Expand ▾(transforms)] [AI: summarize] [Report]      │
├──────────────┬───────────────────────────────────────────────┬───────────────┤
│ PHOTO(S)     │ IDENTIFIERS                                   │ SOURCES (per  │
│ ▢ ▢ ▢        │ names: V. Mares; "kestrel_9" (alias, 0.87)    │ attribute):   │
│ face-match ⚿ │ emails: vm@…(2 breaches ⚿) │ phones: +43…    │ ▪ registry-AT │
│              │ usernames: kestrel_9 (4 platforms)            │ ▪ feed:BR-12  │
├──────────────┴───────────────────────────────────────────────┴───────────────┤
│ tabs: Overview │ Connections │ Social │ Media │ Locations │ Records │ Exposure ⚿ │ Audit │
│ ▣ CONNECTIONS mini-graph ◉      ▣ ACTIVITY TIMELINE      ▣ ORGS & EMPLOYMENT │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 5. Link Analysis Graph Workspace

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ GRAPH — OP-2231   layout:[force▾] [▶ live] [⌖ fit] [∞ zoom] [👥 2 viewing]   │
├──────┬───────────────────────────────────────────────────────────┬───────────┤
│ PAL- │                                                           │ INSPECTOR │
│ ETTE │        ◉───────◉                Entity canvas (WebGL)     │ ────────  │
│ ⬤per │       ╱ ╲     ╱                 nodes glow by risk,       │ selected: │
│ ✉eml │  ◉───◉   ◉──◉==◉  weighted     edges pulse on update ◉   │ P-0441    │
│ ☎phn │       ╲ ╱     ╲   edge         cluster hulls (orange     │ props,    │
│ ◫dom │        ◉       ◉   thickness    glass overlays)           │ sources,  │
│ ⌬ip  │         ╲     ╱                                           │ expand ▾: │
│ ⌂org │          ◉───◉                                            │ • emails  │
│ 🚗veh│                                                           │ • cohabs  │
│ ⌖loc │  timeline scrubber: ├────●━━━━━━━━━━━━━─────┤ 2024–2026  │ • infra   │
│ ▣dev │                                                           │ [run ⚡]   │
├──────┴───────────────────────────────────────────────────────────┴───────────┤
│ ◉ AI: "3 hidden paths between P-0441 and ORG-771 — show?"  [Show] [Dismiss]  │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 6. Geospatial Workspace

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MAP — OP-2231   base:[tactical-dark▾] [draw geofence] [heatmap ◉] [cluster]  │
├──────────────────────────────────────────────────────────────────┬───────────┤
│   (full-bleed dark map; radar-sweep on live geofences ◉;         │ LAYERS    │
│    entity pins; movement trails with direction arrows;           │ ☑ EXIF    │
│    H3 heat cells in orange gradient)                             │ ☑ CDR imp │
│                                                                  │ ☐ Trans.  │
│   ⏱ time scrub: ├──────●━━━━━━━━━━━─────┤  [▶ play movement]    │ ☑ Geofence│
└──────────────────────────────────────────────────────────────────┴───────────┘
```

## 7. Media Intelligence Workbench

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ MEDIA — drop files or [select from evidence vault]                           │
├─────────────────────────┬────────────────────────────────────────────────────┤
│ ▢ preview (image/video  │ tabs: EXIF │ Faces ⚿ │ Objects │ OCR │ Reverse ⌕   │
│   with frame strip)     │ EXIF: GPS 48.2082,16.3738 → [pin to map]           │
│ ◉ scanline analysis fx  │ Device: Pixel 8 Pro · 2026-01-14T09:12:33+01:00    │
│                         │ Faces: 2 detected → [compare to case gallery ⚿]   │
│                         │ OCR: "…invoice № 88123…" → [index] [add entity]    │
└─────────────────────────┴────────────────────────────────────────────────────┘
```

## 8. Threat Intel / IOC Console

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ THREAT INTEL   [+ IOC] [import STIX/TAXII] [feeds: 6 active ◉]               │
├──────────────────────────────────────────────────────────────────────────────┤
│ filter: type[all▾] tlp[all▾] confidence[≥50] ⌕                               │
│ TYPE   VALUE                 TLP    CONF  SIGHTINGS  EXPIRES   ACTOR         │
│ ip     203.0.113.7           AMBER  85    4 ◉        30d       UNC-RAVEN-3   │
│ domain mal.example           RED    92    1          14d       —             │
│ hash   9f86d08…              GREEN  60    0          90d       FIN-SET-12    │
├──────────────────────────────────────────────────────────────────────────────┤
│ ▣ ACTOR DOSSIER side panel: TTP matrix (ATT&CK heat-grid), campaigns, infra  │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 9. Dark Web / Breach Monitoring ⚿

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ DARK WEB MONITORING (lawful feeds)        legal basis: required per watchlist│
├──────────────────────────────┬───────────────────────────────────────────────┤
│ WATCHLISTS                   │ ALERTS ◉                                      │
│ ▪ agency-domains (12 items)  │ 14:02Z credential exposure: j.doe@agency.x    │
│ ▪ OP-2231 identifiers (6) ⚿  │        source: feed BR-12 · pwd: ••••••••     │
│ [+ new watchlist → approval] │        [reveal ⚿ requires supervisor + audit] │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

## 10. Financial Flow Workspace

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ FINANCIAL — OP-2231   [import transactions] [detect patterns ▾]              │
├──────────────────────────────────────────────────────────────┬───────────────┤
│   Sankey/flow graph: ACC-01 ══▶ ACC-07 ─▶ ACC-13             │ DETECTIONS    │
│   edge width = volume; red-dashed = flagged pattern          │ ⚠ structuring │
│   ⏱ window slider                                            │   9×€9,900    │
│                                                              │ ⚠ fan-out 1→14│
└──────────────────────────────────────────────────────────────┴───────────────┘
```

## 11. Evidence Vault

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ EVIDENCE VAULT — OP-2231   [+ ingest] [verify all hashes]                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ ID      NAME                TYPE        SHA-256      CUSTODY  STATUS         │
│ EV-031  phone_extract.ufdr  mobile-ext  9f86…✔       4 events ✅ verified    │
│ EV-032  disk01.E01          disk-image  a1b2…✔       2 events ✅ verified    │
│ EV-033  cam_north.mp4       video       77aa…⚠       3 events ⚠ re-verify    │
│ → row expands: chain of custody ledger (who/when/action/hash), extraction    │
│   results (entities found), [open in media workbench]                        │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 12. AI Copilot (right slide-over, available everywhere)

```
┌───────────────────────────────┐
│ ◉ RAVEN AI        model:[▾]  │  ← model picker lists ONLY admin-configured
│ context: OP-2231 · 14 entities│     providers (cloud or local)
├───────────────────────────────┤
│ You: show all known           │
│ connections between P-0441    │
│ and ORG-771                   │
│                               │
│ AI: Found 3 paths (cites      │
│ [EV-031],[feed:BR-12]):       │
│ 1. shared phone +43…  ➊       │
│ 2. cohabitation 2024  ➋      │
│ [Render on graph] [Add to     │
│ case notes] [Generate brief]  │
├───────────────────────────────┤
│ ⚡ /timeline /aliases /report  │
│ ⌨ ask anything…           ➤  │
└───────────────────────────────┘
```

## 13. Integrations Center (Admin) — see doc 16

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ INTEGRATIONS CENTER   [+ add connector] [import bundle] [marketplace]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ PROVIDER          CAT       STATUS    PRIORITY  USAGE 24h   LIMIT   FALLBACK │
│ ◉ whois-vendor-a  cyber     ● active  1         412/1000    1000    vendor-b │
│ ◉ whois-vendor-b  cyber     ◐ standby 2         0           5000    local-db │
│ ◉ local-whois-db  cyber     ● active  3         88          ∞       —        │
│ ◉ ollama-local    ai        ● active  1         9.1k tok/s  ∞       —        │
│ ◉ anthropic       ai        ○ disabled 2        —           —       —        │
│ row → [test connection] [edit keys] [usage chart] [trust/reliability scores] │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 14. Search Results (omni-search full page)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⌕ "kestrel_9"                       sources: [all configured ▾] [search]     │
├────────────┬─────────────────────────────────────────────────────────────────┤
│ FACETS     │ ① PERSON P-0441 (alias match 0.87) — OP-2231        [profile]   │
│ type ▾     │ ② USERNAME kestrel_9 — 4 platform hits ◉ (live collection done) │
│ case ▾     │ ③ DOCUMENT EV-031/chat_db: 212 message hits          [open]     │
│ source ▾   │ ④ BREACH FEED BR-12: 1 exposure record ⚿            [request]  │
│ date ▾     │   …each result shows source badge + confidence + retention tag  │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

## 15. Approval Queue (Supervisor)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPROVALS (4 pending)                                                        │
│ ⚿ Breach-data reveal — OP-2231 — requested by K.Osei — basis: W-88123        │
│   [view justification] [APPROVE] [DENY + reason]                             │
│ ⚿ Case export package — OP-2240 → Europol liaison — [review manifest]        │
└───────────────────────────────────────────────────────────────────────────────┘
```
