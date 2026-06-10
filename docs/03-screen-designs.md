# 03 — Screen-by-Screen Design & Obsidian Orange Design System

## 1. Design Language: OBSIDIAN ORANGE

A military-grade command-center aesthetic: near-black obsidian surfaces, cinematic orange light,
glassmorphism overlays, radar-inspired live elements, restrained tactical typography.

### 1.1 Color Tokens

```css
:root {
  /* brand */
  --raven-orange:        #FF6A00;  /* primary actions, active states, brand glow */
  --raven-orange-2:      #FF8C00;  /* hovers, secondary emphasis, gradients */
  --raven-orange-3:      #FFA500;  /* accents, sparklines, focus rings */

  /* surfaces */
  --raven-bg:            #050505;  /* app background */
  --raven-panel:         #0A0A0A;  /* nav rail, side panels, drawers */
  --raven-card:          #111111;  /* cards, widgets, modals */
  --raven-border:        #202020;  /* 1px hairlines everywhere */

  /* text */
  --raven-text:          #F5F5F5;
  --raven-text-2:        #B0B0B0;

  /* semantics */
  --raven-success:       #00D26A;
  --raven-warning:       #FFB020;
  --raven-danger:        #FF3B30;

  /* derived */
  --raven-glow:          0 0 24px rgba(255,106,0,.35);
  --raven-glass:         rgba(17,17,17,.55);          /* + backdrop-blur(16px) */
  --raven-grid-line:     rgba(255,106,0,.06);          /* tactical bg grid */
}
```

Usage rules:
- Orange is **scarce and meaningful**: primary buttons, active nav, live indicators, selected nodes,
  critical data. Never use it for large fills.
- Risk gradient: `#B0B0B0 → #FFB020 → #FF8C00 → #FF3B30` (low→critical).
- Confidence is always rendered as a 0–100 bar in `--raven-orange-3` at 60% opacity.
- Classification banner colors follow agency policy and are admin-configurable.

### 1.2 Typography

| Role | Font | Notes |
|------|------|-------|
| UI | Inter (variable) | 13/14/16px scale, tracking -0.01em |
| Data/mono | JetBrains Mono | identifiers, hashes, coordinates, timestamps |
| Display | Eurostile-like (e.g. "Michroma"/"Saira Semi Condensed") | module titles, dashboard numerals, uppercase + letterspacing 0.12em |

Timestamps always dual: `14:32:07Z · 16:32 local`, mono font.

### 1.3 Surfaces & Depth

- Background `#050505` with a faint tactical grid (1px lines, `--raven-grid-line`, 32px cells) and a
  slow radial "breathing" vignette in orange at 3% opacity (disabled in reduced-motion).
- Cards: `#111111`, 1px `#202020` border, `border-radius: 10px`, no drop shadows — depth comes from
  border luminance + inner top-edge highlight `rgba(255,255,255,.03)`.
- Glassmorphism reserved for **overlays only** (cluster hulls, map HUD, command palette):
  `background: var(--raven-glass); backdrop-filter: blur(16px) saturate(1.2); border:1px solid rgba(255,106,0,.18)`.
- Hover state: border shifts to `rgba(255,106,0,.4)` + `--raven-glow` at 40% strength.

### 1.4 Motion Design (Framer Motion)

| Effect | Spec |
|--------|------|
| Page/module transition | opacity 0→1 + y 8→0, 240ms, `[0.22,1,0.36,1]` ease; subtle holographic chromatic-shimmer sweep on module title (one pass, 600ms) |
| Live data pulse | nodes/feed rows emit a 1.5s expanding ring (scale 1→1.6, opacity .5→0) on update |
| Tactical scan | media analysis + geofence triggers: horizontal scanline (2px, orange, blur 6px) sweeps element once |
| Radar sweep | dashboard map + "live" badges: conic-gradient sweep rotating 4s linear, masked to circle |
| Feed entry | new intel rows slide in x:-12→0 with a 300ms orange left-border flash, then settle |
| Particle field | login + dashboard hero: ~120 drifting 1px particles (canvas, GPU-cheap), orange at 8% opacity |
| Count-up numerals | dashboard KPIs animate via spring on value change |
| Graph edge pulse | a small light dot travels along edges receiving live updates |
| Skeletons | shimmer = slow orange gradient sweep over `#111` blocks |

Global rule: every animation respects `prefers-reduced-motion`; all loops pause when tab is hidden.

### 1.5 Core Components

- **Buttons**: primary (orange fill, black text, glow on hover), secondary (card bg, orange border),
  ghost, destructive (`--raven-danger` outline). Heights 32/40px.
- **EntityChip**: type glyph + label + confidence tick; color-coded left border by entity type
  (person=orange, domain=cyan #38BDF8, ip=violet #A78BFA, org=teal #2DD4BF, location=lime #A3E635,
  phone=amber, email=rose #FB7185, vehicle=stone, device=sky, username=fuchsia).
- **SourceBadge**: provenance pill (`feed:BR-12`, `EV-031`, `manual`), hover → trust/reliability scores.
- **ConfidenceBar**, **RiskRing** (radial gauge with glow proportional to score), **TLPBadge**,
  **ClassificationBanner** (full-width, always visible, not dismissible).
- **DataTable**: virtualized, mono columns for identifiers, row-level live-pulse.
- **CommandPalette** (`⌘K`): glass overlay; sections Entities/Cases/Actions/AI; AI fallthrough — an
  unmatched query becomes a copilot prompt.

## 2. Screen Specifications

### 2.1 Login / Authentication
- Full-bleed `#050505`, particle field, slow radar ring behind centered glass card.
- RAVEN wordmark with one-time shimmer. Username/password → MFA step (TOTP/WebAuthn) → optional SSO
  buttons (rendered only for admin-configured IdPs).
- Footer: deployment mode (`AIR-GAPPED ENCLAVE`), build hash, legal notice. No external requests.

### 2.2 Executive Dashboard
- 12-col responsive grid of widgets (layout per wireframe doc 02 §2); widgets are draggable/resizable
  (saved per user, per role default).
- KPI cards: display-font count-up numerals, 7-day sparkline in `--raven-orange-3`.
- Threat Alerts: severity-sorted; CRITICAL rows get persistent slow pulse (2s) in danger color.
- Global Intelligence Feed: virtualized stream, type-tag pills, feed-entry animation; pause-on-hover.
- Geospatial widget: MapLibre dark style, event dots with pulse, click → Map workspace deep-link.
- Risk Heatmap: case×factor matrix, cells `#111`→orange gradient by score, click → case drill-down.
- AI Recommendations: card list, each with "evidence" expander citing sources; Accept → creates task.
- Intelligence Briefing Panel: renders latest AI brief (doc 08) with citation chips; `Generate` shows
  streaming text with cursor glow.

### 2.3 Case Workspace
- Header: case code, title, status select, priority flame icon (animated for CRITICAL), lead avatar,
  legal-basis chip (red outline if expiring <7 days).
- Tab bar with orange active underline that slides (layoutId shared element).
- Overview = 2-col: summary/key-entities/legal left; tasks/activity/collaborators right.
- Presence: live avatars (WebSocket), colored cursors in shared notes (CRDT/Yjs).

### 2.4 Entity Profile
- Identity header: photo carousel, canonical name (display font), risk ring, confidence bar,
  watch-toggle (eye icon pulses when active).
- Every attribute row: value (mono where applicable) + SourceBadge(s) + confidence + added-by.
- Tabs per wireframe. **Exposure tab** is permission-gated: until granted it renders a locked state
  with "request access" → approval workflow; passwords masked even after grant unless reveal approved.
- "Expand" dropdown = transform runner: lists applicable connector transforms for this entity type
  with provider, cost estimate, and rate-limit headroom; running shows tactical scan over the section.

### 2.5 Graph Workspace (flagship screen)
- Full-viewport WebGL canvas (Sigma.js/regl custom renderer). 60fps target at 10k nodes.
- Nodes: circular glyph, type color ring, risk glow halo, selected = orange double-ring + 4 anchor
  handles. Labels LOD: hidden < zoom 0.4, abbreviated < 0.8, full ≥ 0.8.
- Edges: weight→thickness (1–6px), directional particle on hover, relationship label on zoom ≥ 1.2.
- Cluster hulls: convex glass polygons with cluster label + count.
- Left palette: drag entity type onto canvas to create; right inspector: properties, sources,
  transform list, "pin/unpin", "hide", "add note".
- Toolbar: layout switcher (force/hierarchic/radial/timeline-x), fit, lasso select, path-find tool
  (select 2 nodes → shortest paths overlay in orange), time scrubber filtering edges by validity
  interval, undo/redo, snapshot (PNG/SVG export with classification stamp).
- Real-time: other analysts' selections shown in their presence color; new nodes from live collection
  drop in with pulse ring.

### 2.6 Map Workspace
- MapLibre GL, custom `raven-dark` style (offline tile bundle support). HUD overlays are glass.
- Tools: geofence draw (circle/polygon) → saved with alert rules; heatmap toggle (H3 cells);
  cluster toggle; measurement tool; coordinate entry (MGRS/UTM/decimal support).
- Movement playback: time scrubber + play; trails draw with comet-tail gradient; speed control.

### 2.7 Media Workbench
- Left: viewer (image zoom/pan; video with frame strip + I-frame thumbnails; audio waveform).
- Right: analysis tabs. Each "Analyze" action shows the scanline effect and streams results.
- Faces tab ⚿: detected faces as crops; "Compare" opens side-by-side with similarity gauge and
  mandatory adjudication buttons (Match/No match/Inconclusive) — recorded with analyst ID.
- Every extracted artifact has "promote to entity/event" buttons.

### 2.8 Threat Intel Console
- IOC table (virtualized) + right actor-dossier drawer with ATT&CK heat-grid (technique cells shaded
  by observed frequency).
- Feed health strip: per-feed status dot, last-sync, item rate (sparkline).

### 2.9 Dark Web / Breach Monitoring
- Watchlist CRUD requires legal-basis selection; list shows basis + expiry.
- Alert cards: severity edge-glow; credential alerts show masked secrets with ⚿ reveal flow.

### 2.10 Financial Workspace
- Flow graph (Sankey-style, deck.gl) + pattern-detection drawer listing rule hits with explanation
  ("9 transactions of €9,900 within 48h across 3 accounts — threshold-avoidance pattern").
- Click pattern → involved edges highlight red-dashed, others dim to 20%.

### 2.11 Evidence Vault
- Table per wireframe; hash column mono with verify state icon; failed verify = danger glow row.
- Row expand: custody ledger rendered as vertical chain (each link = who/action/timestamp/hash,
  connected by orange line); export custody report (PDF, signed).
- Ingest wizard: source tool selector → file drop → hash computed client+server → metadata form
  (collector, method, legal basis) → confirmation with custody entry #1.

### 2.12 Admin / Integrations Center
- Connector table per wireframe doc 02 §13; "Add connector" wizard per doc 16 §7.
- Other admin tabs: Users & Roles (RBAC matrix editor), Policies (ABAC rule builder), Audit Explorer
  (filterable, export), System Health (service tiles with live charts), Model Manager (local AI
  models: pull/import, VRAM gauge, throughput), Retention (per-source policy editor).

### 2.13 Report Builder
- Block editor (headings, entity cards, graph snapshots, map snapshots, timelines, tables, AI
  sections clearly badged "AI-assisted — verified by ___").
- Templates: Intelligence Brief, Target Package, Case Summary, Court Disclosure (strips AI-only
  inferences, includes custody appendix).
- Export: PDF/DOCX with classification headers/footers on every page, watermark = user + timestamp.

## 3. Accessibility & Ergonomics
- WCAG 2.2 AA on dark palette (text contrast ≥ 7:1 for body); focus rings `--raven-orange-3` 2px.
- Full keyboard map (graph: arrows pan, +/- zoom, E expand, F fit). Command palette for everything.
- Analyst comfort: density toggle (comfortable/compact), per-monitor multi-window support
  (graph/map/case can pop out and stay synced via BroadcastChannel/WebSocket).
