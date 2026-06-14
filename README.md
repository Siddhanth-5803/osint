# Reelio

AI Reel Studio — turn photos and videos into beat-synced, platform-ready Reels.

- **[`PRODUCT_BLUEPRINT.md`](PRODUCT_BLUEPRINT.md)** — the full product blueprint
  (concept, users, features, AI workflow, music/licensing, tech stack, roadmap,
  UI/UX, monetization, risks).
- **[`web/`](web/)** — a working prototype: a premium animated **website** plus
  an **Android app** (Capacitor). Upload media → pick a vibe → get beat-synced
  reels → export video + captions/hashtags. See [`web/README.md`](web/README.md).

## Quick start

```bash
cd web
npm install
npm run dev          # website at http://localhost:5173
npm run android:apk  # build the Android APK (needs Android SDK)
```

The Android APK is also built automatically in CI — see the
**Build Android APK** workflow and download `reelio-debug-apk` from its artifacts.
