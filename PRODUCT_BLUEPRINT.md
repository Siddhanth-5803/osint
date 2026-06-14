# Product Blueprint — AI Reels & Social Content Generator

> A complete, build-ready blueprint for an app/website that automatically turns
> user-uploaded photos, videos, and music preferences into Instagram-style Reels,
> carousels, meme edits, beat-synced videos, captions, and platform-ready posts.

---

## ✅ Working prototype (this repo)

This is no longer just a document — a functional prototype now lives in
[`web/`](web/), shipping as **both a website and an Android app**:

- **Website** — Vite + React + TypeScript + Tailwind + Framer Motion. Premium
  dark UI, fluid motion, and a full wizard: landing → upload → vibe (theme /
  mood / track / format / prompt) → animated "generating" → choose from 3
  variants → export.
- **Real reel engine** — a deterministic, **beat-synced** canvas renderer
  (`web/src/lib/reel.ts`) with Ken Burns motion, multiple transition styles,
  per-theme color grades, animated titles, and live preview. Cut timing comes
  from track BPM × mood energy.
- **Real export** — records the canvas to a downloadable MP4/WebM via
  `MediaRecorder`, with auto-generated caption + hashtags.
- **Android app** — the same build wrapped with **Capacitor** (`com.reelio.app`),
  producing an installable APK. A GitHub Actions workflow
  (`.github/workflows/android.yml`) builds the APK as a downloadable artifact.
- **Licensing-safe music** — tracks are **metadata-only** (tempo/mood) and never
  embed third-party audio, exactly as recommended in §7.

Run it: `cd web && npm install && npm run dev`. Build the APK:
`npm run android:apk`. See [`web/README.md`](web/README.md) for details.

The sections below remain the full product vision the prototype is a first
slice of.

---

## Table of Contents

1. [Product Name Ideas](#1-product-name-ideas)
2. [Core Concept](#2-core-concept)
3. [Target Users](#3-target-users)
4. [Main Features](#4-main-features)
5. [User Flow](#5-user-flow)
6. [AI Workflow](#6-ai-workflow)
7. [Spotify / Music Integration](#7-spotify--music-integration)
8. [Tech Stack](#8-tech-stack)
9. [MVP Version](#9-mvp-version)
10. [Advanced Version](#10-advanced-version)
11. [UI/UX Design](#11-uiux-design)
12. [Monetization](#12-monetization)
13. [Risks and Challenges](#13-risks-and-challenges)
14. [How to Make It 10x Better](#14-how-to-make-it-10x-better)
15. [Final Output](#15-final-output)

---

## 1. Product Name Ideas

Ten modern, brandable names. Each is short, pronounceable, and has a plausible
domain/handle story.

| # | Name | Rationale |
|---|------|-----------|
| 1 | **Reelio** | "Reel" + playful "-io"; easy to say, app-store friendly. |
| 2 | **Snapcut** | Evokes fast editing ("snap") + "cut"; punchy and verb-able ("just Snapcut it"). |
| 3 | **Vibe Reel** | Leads with mood/"vibe", the emotional core of the product. |
| 4 | **Moodframe** | Mood detection + framing/editing; premium and design-forward. |
| 5 | **Clipwave** | Clips synced to the "wave" of the beat; motion + audio in one word. |
| 6 | **Auralis** | From "aural" + "aura"; aspirational, premium, music-led. |
| 7 | **Beatframe** | Beat-sync is the hero feature; concrete and memorable. |
| 8 | **Storimint** | "Story" + "mint" (to create/mint content); fresh and ownable. |
| 9 | **Frameberry** | Friendly, consumer brand energy (à la BlackBerry/Bumble). |
| 10 | **Kineo** | From "kinetic"; ultra-short, abstract, scalable as a brand. |

**Recommended shortlist:** `Reelio` (consumer-friendly), `Snapcut` (verb-able,
viral), `Clipwave` (feature-led). Validate trademark + domain (.com/.app) and
Instagram/TikTok handle availability before committing.

---

## 2. Core Concept

**In one sentence:** Upload your photos and videos, pick a mood or a song, and
the app instantly edits a scroll-stopping Reel, carousel, or meme for you — no
editing skills required.

**What it does**
- Takes raw media (photos, videos, short clips) plus a mood/theme and optional
  music, and **automatically produces finished, platform-ready content**:
  Reels, carousels, Shorts, Stories, and feed posts.
- Handles the tedious parts — trimming, beat-syncing, transitions, captions,
  hashtags, text overlays, and resizing per platform — using AI.
- Generates **multiple versions** so the user picks the best, instead of
  starting from a blank timeline.

**Who it is for**
- Anyone who needs consistent, good-looking short-form content but lacks the
  time, skill, or budget for manual editing — from solo creators to small
  business owners and social media managers.

**Why people use it**
- **Speed:** finished content in under a minute vs. 30–60 minutes in CapCut.
- **No skill required:** the AI makes editing decisions (timing, transitions,
  pacing) that normally take experience.
- **Consistency:** brand kit + templates keep output on-brand every time.
- **Trend-readiness:** beat-synced, meme-timed edits matched to current formats.
- **Decision-free:** "make it funny / emotional / cinematic" instead of fiddling
  with sliders.

**Positioning:** Not a manual editor (CapCut/InShot) and not a static design
tool (Canva). It is an **AI auto-editor** — closer to "describe the vibe, get the
video." Manual fine-tuning exists but is optional, not required.

---

## 3. Target Users

| Segment | Core need | Killer feature for them | Willingness to pay |
|---|---|---|---|
| **Instagram creators** | Daily Reels without burnout | Beat-sync + multiple versions | High |
| **Small businesses** | Promo content without an agency | Brand kit + templates + auto captions | High |
| **Influencers** | High volume, on-brand, fast | Bulk generation + scheduling | High |
| **Students** | Cheap, fun, fast edits | Free tier + meme/comedy mode | Low |
| **Couples / friends** | Memory/relationship reels | Romantic/friendship themes + music mood | Low–Medium |
| **Event editors** | Birthdays, weddings, festivals | Theme packs + fast batch render | Medium |
| **Meme page admins** | Comedy timing at scale | Meme/comedy mode + caption timing | Medium |
| **Marketing teams** | Consistent multi-platform output | Team collaboration + brand kit + analytics | Very High |

**Primary launch focus (MVP):** Instagram creators + small businesses — highest
pain, clearest willingness to pay, and the most viral word-of-mouth loop.

---

## 4. Main Features

### Input & Media
- **Upload media** — drag-and-drop photos, videos, clips; mobile camera roll
  import; URL import; max-file and duration guidance per plan.
- **Caption / mood input** — free text ("make this emotional") or mood chips.
- **Theme selector** — comedy, romantic, cinematic, travel, birthday, aesthetic,
  sad, friendship, corporate, festival, and more.
- **Music input** — royalty-free library, manual audio upload, or Spotify track
  *metadata* (mood/tempo) for guidance (see §7).

### AI Editing Engine
- **AI mood detection** — infers emotion/scene from media + text to drive style.
- **Music / beat sync** — detects BPM and beats; cuts media on the beat.
- **Reel generator** — vertical 9:16 video with transitions, pacing, overlays.
- **Carousel generator** — multi-slide posts with cohesive design + transitions.
- **Meme / comedy mode** — meme-style timing, punchline pauses, caption pop-ins.
- **Cinematic mode** — color grade, slow zooms, letterbox, dramatic transitions.
- **AI-suggested transitions & effects** — context-aware (not random).
- **AI-generated templates** — layouts adapted to the user's media count/type.

### Text & Discovery
- **Auto captions** — speech-to-text subtitles with styled, animated text.
- **Hashtag generator** — relevant, mood/topic-aware, with reach/competition mix.
- **Text overlays** — animated titles, lower-thirds, sticker text.

### Brand & Assets
- **Template library** — curated, theme-categorized, regularly refreshed.
- **Brand kit** — logo, fonts, color palette, watermark, intro/outro (paid).

### Output
- **Export options** — resolution (720p/1080p/4K), watermark toggle (paid),
  MP4/MOV, frame rate.
- **Platform-specific formats** — Reel (9:16), Story (9:16), Shorts (9:16),
  Post (1:1 / 4:5), TikTok, YouTube Shorts, with safe-zone awareness.
- **Multiple versions** — 3–5 variants per request to choose from.
- **Scheduling / publish (advanced)** — connect accounts and post directly.

---

## 5. User Flow

**Step-by-step (happy path):**

1. **Land / sign in** — sign up with Google/Apple/email; see a 30-second
   "what you can make" preview.
2. **Start a project** — tap **Create** → choose output type (Reel / Carousel /
   Story / Post) or "Surprise me."
3. **Upload media** — drag in photos/videos; thumbnails appear in a tray; reorder
   by drag.
4. **Set the vibe** — pick a theme chip (comedy, cinematic…) and/or type a prompt
   ("make it a nostalgic travel reel"). Optional caption.
5. **Pick music** — choose from royalty-free library (filtered by mood), upload
   audio, or search a song to match *tempo/mood* (metadata only).
6. **Generate** — tap **Generate**. Progress UI shows AI steps (analyzing →
   syncing → rendering). Takes seconds to ~1–2 min.
7. **Review versions** — 3–5 variants appear as a swipeable gallery; preview each.
8. **Fine-tune (optional)** — open the simple timeline editor to swap clips,
   edit text, change music start, adjust transitions, tweak colors.
9. **Export / publish** — choose format + quality; download, copy
   caption + hashtags, or schedule/post to connected accounts.
10. **Save / reuse** — project saved to dashboard; "remix" to make a new variant
    or re-render in another format.

**Onboarding shortcut:** First-run "magic moment" — upload 3 photos, tap one
theme, get a finished Reel in <30s before any account friction (gate export/HD
behind sign-up).

---

## 6. AI Workflow

The generation pipeline, stage by stage. Each stage produces structured metadata
that feeds an **Edit Decision List (EDL)** — the render plan — consumed by the
video renderer.

```
Upload → Analyze media → Detect mood/scene → Plan music/beats →
Plan edits (EDL) → Generate text → Render variants → Re-rank → Deliver
```

1. **Image analysis** — object/scene detection, aesthetic scoring (pick best
   shots), face detection, dominant colors, orientation/quality, deduplication of
   near-identical frames. Models: vision encoder (e.g., CLIP-style), face
   detector, image-quality/aesthetic scorer.

2. **Video analysis** — shot/scene boundary detection, motion/action detection,
   "best moment" extraction (highlight detection), stabilization need, audio
   presence, silence/loudness profiling.

3. **Faces / emotions** — detect faces, estimate emotion (happy/sad/neutral) and
   group size; informs theme fit (e.g., group selfies → friendship/party).
   *Privacy: on-device or ephemeral processing; no biometric storage. See §13.*

4. **Scene type** — classify each asset (indoor/outdoor, nature, food, party,
   portrait, document/screenshot) to choose templates and transitions.

5. **Music mood** — derive valence/energy from the chosen track's audio (if
   uploaded/royalty-free) or from **Spotify audio-features metadata**
   (tempo, energy, valence, danceability). Maps to pacing and color grade.

6. **Beat detection** — analyze the actual audio waveform (royalty-free/uploaded)
   to extract BPM + beat timestamps + downbeats. Cut points snap to beats; high-
   energy sections get faster cuts. (For Spotify, only *metadata* tempo is used —
   never their raw audio; see §7.)

7. **Transitions** — choose transitions per cut from scene change + energy:
   hard cut on beat for high energy, crossfade/zoom for calm, whip-pan for
   travel, glitch/meme-pop for comedy. Effects (zoom, shake, grain, light leaks)
   chosen by theme, not randomly.

8. **Captions / text** — speech-to-text for spoken video (Whisper-class ASR);
   LLM generates title overlays, on-screen captions, post caption, and hashtags
   from detected content + mood + user prompt. Hashtags balanced across
   reach/niche tiers.

9. **Final edit (assembly & render)** — compile the EDL (ordered clips, in/out
   points, transitions, overlays, music with beat-aligned cuts, color grade) and
   render per platform aspect ratio. Generate 3–5 variants by varying
   pacing/template/music-start. A **re-ranker** scores variants (visual variety,
   beat alignment, face framing) and orders them best-first.

**Orchestration:** an LLM "director" turns the user prompt + media analysis into
the EDL (a JSON spec). The renderer is deterministic given the EDL, which makes
output reproducible, debuggable, and cacheable.

---

## 7. Spotify / Music Integration

**The core legal reality:** Spotify's API **does not allow downloading or
embedding full-track audio into your own exported videos.** Spotify only serves
~30-second preview clips and streaming through *their* player, governed by their
Developer Terms. Putting commercial-label music into a user-exported MP4 also
creates **copyright/sync-licensing liability** regardless of Spotify. So: **do
not bake Spotify (or any major-label) audio into exports.**

### What IS possible / legal
- **Spotify track metadata & audio features** — via the Spotify Web API you can
  pull title, artist, album art, and **audio features** (tempo/BPM, energy,
  valence, danceability, key). Use these to *inform* mood, pacing, and beat-sync
  against a **different, licensed** audio source.
- **30-sec preview playback** — for in-app discovery/mood selection only (not in
  exports), inside Spotify's player rules.
- **"Find similar royalty-free track"** — user picks a Spotify song; you read its
  audio features and recommend a royalty-free track with matching tempo/mood that
  you *can* legally embed.

### Recommended approach (legal & practical)
1. **Royalty-free music library** — license a catalog (e.g., via providers like
   Epidemic Sound, Artlist, Uppbeat, or a stock-music API) and make it the
   default for exports. This is the clean, scalable path.
2. **User-provided audio upload** — let users upload their own audio; show a
   clear notice that they're responsible for rights to anything they upload.
3. **Spotify for mood/tempo only** — "Match the vibe of this song" → read audio
   features → auto-pick a royalty-free track + pacing. Best of both worlds.
4. **Platform-native music (publish-side)** — when posting directly to
   Instagram/TikTok, those platforms have their own licensed music libraries;
   guide users to add trending audio *in-platform* after export for organic
   (non-monetized personal) posts.

### What to avoid
- Downloading/ripping Spotify audio. Embedding label tracks in commercial
  exports. Implying you have rights you don't. Storing Spotify audio.

**Summary:** Spotify = **discovery + mood/tempo intelligence**. Exported audio =
**royalty-free or user-owned**. This keeps the product shippable and lawsuit-free.

---

## 8. Tech Stack

| Layer | Recommendation | Why |
|---|---|---|
| **Frontend (web)** | Next.js (React) + TypeScript, Tailwind CSS, shadcn/ui, Framer Motion | Fast, SEO-able marketing + app; great DX; smooth animations for a premium feel. |
| **Mobile (advanced)** | React Native (Expo) or Flutter | Reuse skills/logic; ship iOS + Android from one codebase. |
| **In-browser editing/preview** | Remotion (React video) or WebCodecs + Canvas/WebGL | Frame-accurate preview; Remotion lets you define video as React components. |
| **Backend / API** | Node.js (NestJS) or Python (FastAPI) | FastAPI pairs naturally with the AI/ML stack; NestJS if team is JS-first. |
| **Job queue / orchestration** | Redis + BullMQ (Node) or Celery (Python); workers autoscaled | Rendering is heavy/async; queue + workers prevent request blocking. |
| **AI — vision** | CLIP-style encoder, YOLO/face detector, aesthetic scorer (open models, self-host or via API) | Scene/object/face/quality analysis. |
| **AI — audio** | librosa / Essentia / `aubio` for BPM + beat detection; Whisper for ASR captions | Reliable, open, well-documented beat + speech tooling. |
| **AI — language** | Claude API (`claude-fable-5` for quality, `claude-haiku-4-5` for cheap/fast) | EDL "director" planning, captions, hashtags, prompt understanding. |
| **AI — music features** | Spotify Web API (metadata/audio-features only) | Legal mood/tempo signal (see §7). |
| **Video rendering** | FFmpeg (core), Remotion (programmatic React→video), GPU workers for scale | FFmpeg is the workhorse; Remotion for rich templated motion graphics. |
| **Database** | PostgreSQL (primary) + Redis (cache/queue) | Relational data (users, projects, jobs); Redis for sessions/jobs. |
| **Object storage** | Amazon S3 / Cloudflare R2 (R2 = no egress fees) | Store uploads, renders, thumbnails. |
| **CDN** | Cloudflare / CloudFront | Fast global media delivery. |
| **Auth** | Clerk / Auth0 / Supabase Auth | Social login, sessions, low lift. |
| **Payments** | Stripe (subscriptions + metered usage) | Plans, trials, usage-based render credits. |
| **Deployment** | Vercel (frontend) + AWS/GCP (GPU render workers, ideally spot instances) + Docker/Kubernetes for workers | Split static front from heavy compute; scale workers independently. |
| **Observability** | Sentry, OpenTelemetry, a metrics/logs stack (e.g., Grafana) | Track render failures, latency, cost per job. |

**Architecture sketch:**

```
Client (Next.js / RN)
   │  upload (presigned URL) → S3/R2
   ▼
API (FastAPI/NestJS) ── enqueue job ──► Queue (Redis/BullMQ)
   │                                        │
   │                                   Worker pool (GPU)
   │                          ┌── media analysis (vision/audio)
   │                          ├── LLM director → EDL (JSON)
   │                          ├── render variants (FFmpeg/Remotion)
   │                          └── upload renders → S3/R2 → CDN
   ▼
Postgres (users, projects, jobs)   Webhooks → notify client when done
```

---

## 9. MVP Version

**Goal:** Prove the magic moment — "upload → pick vibe → get a finished Reel" —
with the smallest possible surface. Web-first.

**MVP scope (build this):**
- Auth (social login) + simple dashboard.
- Upload 3–15 photos and/or short clips (size/duration caps).
- **One output format: vertical Reel (9:16).**
- 3–4 themes (e.g., aesthetic, travel, comedy, cinematic).
- Royalty-free music library (small, ~30 tracks) + **beat-sync** + user upload.
- One text prompt field + mood chips.
- AI pipeline: image quality/scene ranking → beat detection → EDL → FFmpeg
  render with templated transitions + text overlay.
- **Generate 2–3 variants**; preview; download MP4 (watermark on free).
- Auto caption text + hashtags (LLM) shown next to the video.
- Stripe with one paid tier (remove watermark, HD, more renders).

**Deliberately excluded from MVP:** carousels, full timeline editor, brand kit,
mobile app, direct publishing, Spotify integration, team features, 4K.

**Why this scope:** Reels are the highest-demand format and the clearest "wow."
Everything cut is additive later without re-architecting (the EDL/renderer
design already supports more formats).

**Rough timeline (small team):** 8–12 weeks to a usable beta.

---

## 10. Advanced Version

Built on the same EDL + renderer core; each item is an additive module.

- **All formats** — carousels, Stories, Shorts, 1:1/4:5 posts, TikTok/YouTube,
  with one-tap "resize to all platforms."
- **Powerful AI editing** — generative B-roll, AI background removal, object
  cleanup, auto-reframe (subject tracking across aspect ratios), AI voiceover,
  style transfer, talking-head auto-cut (remove silences/filler words).
- **Rich template marketplace** — creator-made templates, trending-format packs
  refreshed weekly, "remix this trend."
- **Brand kit** — logos, fonts, palettes, watermarks, intros/outros, brand voice
  for captions; enforce across all output.
- **Spotify mood/tempo integration** — "match this song's vibe" → royalty-free
  recommendation + auto pacing (§7).
- **Mobile apps** — iOS/Android with camera capture, mobile upload, push notifs.
- **Team collaboration** — shared workspaces, roles/permissions, comments,
  approval workflows, asset library.
- **Scheduling & publishing** — connect IG/TikTok/YouTube, schedule, calendar,
  best-time-to-post suggestions.
- **Analytics** — track posted content performance; feed back into AI
  recommendations ("your travel reels with fast cuts perform best").
- **Bulk / batch** — generate many variants or many posts from a media library
  at once (influencer/agency use).
- **API / integrations** — let other tools generate content programmatically.

---

## 11. UI/UX Design

**Design direction:** Premium, modern, creator-focused, and friendly to
non-technical users. Dark-first interface (content/media looks best on dark),
with vibrant accent gradients, generous spacing, large rounded media tiles, and
fluid micro-animations. Mobile-first responsive layouts. Think "Linear meets
CapCut" — clean and confident, not cluttered.

**Visual system**
- **Theme:** Dark canvas (`#0E0E12`) with elevated surfaces (`#1A1A22`); vivid
  gradient accent (e.g., violet→pink or teal→indigo) for primary actions.
- **Typography:** A modern geometric sans (e.g., Inter / General Sans) — bold,
  large headlines; high legibility.
- **Motion:** Spring-based transitions (Framer Motion), animated progress states,
  subtle hover lift on cards. Motion communicates "AI is working."
- **Tone:** Encouraging, playful microcopy ("Cooking your reel… 🔥").

**Key screens**

1. **Dashboard** — grid of past projects (video thumbnails with hover preview),
   a prominent **+ Create** button, format quick-starts (Reel / Carousel / Story
   / Post), and a "Trending templates" row. Left rail nav: Projects, Templates,
   Brand kit, Schedule, Settings.

2. **Upload screen** — large drag-and-drop zone with dashed border; uploaded
   media as reorderable thumbnail tray; counters + tips; primary CTA stays
   visible (sticky bottom bar). Show accepted types and limits inline.

3. **Template / theme selection** — horizontally scrollable, video-previewing
   theme cards (comedy, cinematic, travel…); a prompt input ("Describe the vibe");
   a mood-chip row; music picker (library / upload / "match a song").

4. **Generating state** — full-bleed animated progress with step labels
   (Analyzing media → Finding the beat → Editing → Rendering) and an estimated
   time. Keep it delightful — this is the "wait" that builds anticipation.

5. **Edit / preview** — center: 9:16 video player with variant switcher (swipe /
   tabs: "Version 1/2/3"). Right panel: quick edits (swap music, edit caption,
   change theme, regenerate). "Looks great" → Export.

6. **Timeline editor (optional/advanced)** — horizontal track of clips with beat
   markers shown on the music track; tap a clip to trim/replace; text/overlay
   track above; transition icons between clips. Kept *simple* — most users never
   open it; power users can.

7. **Export screen** — choose format(s), resolution, watermark toggle (gated by
   plan); shows the auto-generated caption + hashtags with a "Copy" button;
   buttons for Download / Schedule / Publish.

**UX principles**
- **Zero blank canvas** — always start with AI output, never an empty editor.
- **Progressive disclosure** — advanced controls hidden until wanted.
- **Always show multiple versions** — choice over configuration.
- **One-tap everything** — regenerate, resize, change vibe.
- **Fast feedback** — instant previews, clear progress, no dead waits.

---

## 12. Monetization

Subscription tiers + usage-based render credits, with a generous-but-gated free
tier to drive the viral loop (watermark = free marketing).

| Plan | Price (indicative) | Who | Key limits/perks |
|---|---|---|---|
| **Free** | $0 | Trial users, students | ~5 renders/mo, 720p, **watermark**, basic themes, royalty-free music only, no scheduling. |
| **Creator** | ~$12–15/mo | Solo creators | ~50–100 renders/mo, 1080p, **no watermark**, all themes, captions/hashtags, basic templates. |
| **Pro** | ~$25–35/mo | Power creators/influencers | Unlimited/large render quota, 4K, brand kit (1), all templates, scheduling, priority render queue. |
| **Business** | ~$60–90/mo | Small businesses | Multiple brand kits, analytics, scheduling for multiple accounts, premium music, 3–5 seats. |
| **Agency** | ~$200+/mo or custom | Agencies/teams | Many seats + roles, client workspaces, bulk generation, approval workflows, API access, dedicated support. |

**Additional revenue levers**
- **Pay-as-you-go render credits** for users who exceed plan quotas.
- **Template marketplace** — revenue share with creators who sell templates.
- **Premium music add-on** — expanded licensed royalty-free catalog.
- **Annual billing discount** (~2 months free) to improve retention/cash flow.
- **Affiliate/referral** credits to fuel growth.

**Pricing principle:** charge against the **expensive resource (rendering)** via
quotas, and against **value (no watermark, brand, team, publishing)** via tiers.
Keep margins safe by costing GPU render time per job and setting quotas above it.

---

## 13. Risks and Challenges

| Category | Risk | Mitigation |
|---|---|---|
| **Legal / copyright** | Embedding Spotify/label music in exports = infringement + sync-license liability. | Royalty-free/user-owned audio only in exports; Spotify for metadata/discovery only (§7). Clear ToS shifting upload-rights responsibility to users. |
| **Privacy / biometrics** | Face/emotion detection touches biometric-privacy laws (e.g., BIPA, GDPR). | Ephemeral, in-pipeline processing; no biometric templates stored; explicit consent; data-deletion controls; region-aware policies. |
| **User-generated content** | Users upload illegal/abusive media. | Content moderation (automated NSFW/abuse detection + reporting), DMCA process, ToS. |
| **Rendering cost** | GPU rendering is expensive; heavy users erode margins. | Per-job cost tracking, plan quotas + credits, spot/preemptible GPUs, aggressive caching (deterministic EDL renders), tiered quality. |
| **Storage cost** | Media (uploads + renders) balloons fast. | Lifecycle policies (auto-delete free-tier media after N days), Cloudflare R2 (no egress fees), thumbnail-only retention options. |
| **Quality / "AI looks generic"** | Output feels templated or wrong. | Strong re-ranker, multiple variants, theme-tuned templates, optional manual editor, continuous template refresh. |
| **Latency** | Slow generation kills the "magic." | Queue + autoscaling workers, progressive preview, cache analysis results, cheaper fast path for low tiers. |
| **Platform dependency** | Spotify/IG/TikTok API or policy changes. | Abstract integrations behind adapters; don't make any single API load-bearing; royalty-free music as the default not the exception. |
| **Competition** | Canva, CapCut, InShot, Adobe Express, Opus, Submagic, etc. | Differentiate on **full auto** (not manual) + multiple-version output + beat-sync + mood-first UX (§14). |
| **Scaling/abuse** | Free-tier farming, bulk abuse. | Rate limits, device/account checks, watermark on free, credit system. |
| **Trends move fast** | Formats/transitions go stale. | Weekly template/trend refresh pipeline; analytics-driven recommendations. |

---

## 14. How to Make It 10x Better

Ways to leap past Canva / CapCut / InShot / Adobe Express — most of those are
**manual editors**; the wedge is **true automation + intelligence**.

1. **Truly automatic, not a blank timeline.** Competitors hand you tools; this
   hands you a finished video. "Describe the vibe → get the reel" is the moat.
2. **Multiple AI versions every time.** Choose-from-options beats configure-it-
   yourself. No one else leads with this.
3. **Best-in-class beat-sync + meme timing.** Frame-accurate cuts on the beat and
   comedy timing (punchline pauses, caption pops) that feel hand-edited.
4. **Mood-first input.** Type a feeling, not settings. AI mood detection from
   media + text + music is the primary interface.
5. **Trend engine.** Auto-ingest current trending formats/sounds and offer
   "make my version of this trend" — always current, never stale.
6. **Performance feedback loop.** Connect accounts → learn which of *your* edits
   perform → bias future generations toward what works for *you*.
7. **One-tap multi-platform.** Generate once, auto-reframe (subject-tracking) to
   Reel/Story/Post/TikTok/Shorts with safe zones — a real time-sink solved.
8. **Brand voice + brand kit AI.** Captions and visuals automatically on-brand;
   businesses get consistency without a designer.
9. **Conversational editing.** "Make it faster, swap the second clip, add a sad
   filter" in plain language instead of menus.
10. **Speed as a feature.** Sub-30-second first result. Make the wait delightful
    and short — that's the viral, shareable moment.

**One-line wedge:** *Everyone else makes you edit. We make the edit for you — and
give you three to choose from.*

---

## 15. Final Output

### Complete app concept
An **AI auto-editor for short-form social content.** Users upload photos/videos,
state a mood/theme (or song to match), and the app's AI pipeline analyzes the
media, detects beats, plans the edit, and renders **multiple finished variants**
of Reels, carousels, Shorts, Stories, and posts — complete with transitions,
captions, hashtags, and platform-correct sizing. Music in exports is royalty-free
or user-owned; Spotify is used only for mood/tempo discovery. The wedge is
**full automation + choose-from-versions**, versus the manual editors (CapCut,
Canva, InShot, Adobe Express) it competes with.

### Feature list (summary)
Upload media · AI mood detection · music/beat-sync · Reel generator · carousel
generator · meme/comedy mode · cinematic mode · auto captions · hashtag generator
· text overlays · template library · brand kit · multi-platform export · multiple
versions · (advanced) scheduling, analytics, team collaboration, mobile apps.

### MVP roadmap (8–12 weeks)
1. **Weeks 1–2:** Auth, dashboard, upload + storage (S3/R2), project model.
2. **Weeks 3–5:** AI pipeline v1 — image ranking, beat detection, EDL spec,
   FFmpeg render of one 9:16 Reel template.
3. **Weeks 6–7:** Themes (3–4), royalty-free music + beat-sync, LLM captions +
   hashtags, multiple-variant generation.
4. **Weeks 8–9:** Preview UI + variant switcher, export (watermark logic),
   Stripe (one paid tier).
5. **Weeks 10–12:** Polish, queue/worker autoscale, moderation, beta launch.

### Advanced roadmap (post-PMF)
Carousels & all formats → timeline editor → brand kits → Spotify mood matching →
scheduling/publishing → mobile apps → team collaboration → analytics + feedback
loop → template marketplace → conversational editing & generative B-roll → API.

### UI/UX direction
Dark-first, premium, mobile-first. Zero blank canvas (always start from AI
output), progressive disclosure of advanced tools, always-multiple-versions,
one-tap regenerate/resize, delightful generating state. Screens: Dashboard,
Upload, Theme/Template, Generating, Preview/Edit, (optional) Timeline, Export.

### Development plan
- **Architecture:** Client → API → job queue → GPU worker pool (analyze → LLM
  director → EDL → render → CDN) → Postgres + S3/R2. Deterministic EDL enables
  caching, reproducibility, and easy format expansion.
- **Stack:** Next.js + TS + Tailwind (web), FastAPI/NestJS (API), Redis/BullMQ
  (queue), FFmpeg + Remotion (render), CLIP/face/aesthetic + librosa/Whisper
  (AI), Claude API (director/captions), Postgres + Redis, S3/R2 + CDN, Stripe,
  Vercel + AWS/GCP GPU workers.
- **Team:** 1 full-stack lead, 1 frontend, 1 backend/ML, 1 designer (part-time)
  for MVP.

### Claude / AI builder-ready instructions
Use these as a starting brief for an AI app builder:

```
Build an AI auto-editor web app ("Reelio") that turns uploaded photos/videos +
a mood/theme + music into finished vertical Reels.

Architecture:
- Next.js + TypeScript + Tailwind + shadcn/ui frontend.
- FastAPI backend; Redis + BullMQ job queue; GPU render workers (Docker).
- Postgres for users/projects/jobs; S3/R2 for media; Cloudflare CDN.
- Stripe subscriptions; Clerk/Auth0 auth.

Generation pipeline (worker):
1. Analyze images (scene/quality/face) and videos (shots/highlights).
2. Detect BPM + beat timestamps from chosen royalty-free/uploaded audio
   (librosa). NEVER use Spotify audio in exports — metadata/tempo only.
3. Call Claude (claude-fable-5) as the "director": input = media analysis JSON +
   user prompt/theme; output = an Edit Decision List (EDL) JSON: ordered clips
   with in/out points, transitions, text overlays, music start, color grade.
4. Render the EDL with FFmpeg/Remotion to a 9:16 MP4 per variant (generate 3).
5. Generate post caption + hashtags with Claude.
6. Upload renders to storage; notify the client via webhook.

Frontend flow: Dashboard → Create → Upload (drag-drop, reorderable) → pick theme
+ prompt + music → Generate (animated progress) → review 3 variants → optional
quick edits → Export (format/quality, watermark gated by plan) with copyable
caption/hashtags.

Constraints: exports use royalty-free or user-uploaded audio only; no biometric
storage; per-job GPU cost tracking with plan quotas; deterministic EDL so renders
are cacheable. Ship MVP with one format (Reel), 3–4 themes, ~30 royalty-free
tracks, beat-sync, multiple variants, auto captions/hashtags, and one paid tier.
```

---

*Blueprint complete. This document is structured to hand directly to a developer
or AI app builder to begin execution.*
