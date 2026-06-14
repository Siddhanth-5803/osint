# Reelio — AI Reel Studio (web + Android)

A working prototype of the product described in
[`../PRODUCT_BLUEPRINT.md`](../PRODUCT_BLUEPRINT.md): upload photos → pick a vibe
→ get beat-synced reels, then export the video with a generated caption and
hashtags. It runs entirely in the browser (no backend), and the same build is
packaged into an Android app via Capacitor.

## What's real here

- **Premium, animated UI** — dark-first design, fluid Framer Motion transitions,
  live gradient aurora, beat-pulse indicator, multi-step wizard.
- **Working reel engine** — `src/lib/reel.ts` renders a deterministic,
  beat-synced slideshow to a `<canvas>`: Ken Burns motion, crossfade/cut/zoom/
  slide transitions, per-theme color grades (cinematic letterbox, dreamy wash,
  mono, etc.), animated title + progress segments.
- **Beat sync** — cut timing is derived from the selected track's BPM and the
  mood's energy (`effectiveBpm`), so cuts land on the beat.
- **Multiple versions** — `buildVariants()` produces 3 distinct cuts (Smooth /
  Punchy / Dynamic) of the same media to choose from.
- **Real export** — records the canvas with `MediaRecorder` and downloads an
  MP4/WebM. Captions + hashtags are generated per theme/prompt.
- **Music is metadata-only** — tracks drive *tempo/mood*, never embedded audio,
  matching the legal approach in the blueprint (§7).

## Run the website

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
```

## Build the Android APK

Requires a JDK (17+) and the Android SDK (`ANDROID_HOME` set).

```bash
cd web
npm run android:apk
# → android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run android:apk` builds the web app, runs `npx cap sync android`, then
`./gradlew assembleDebug`. Install the APK on a device with
`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

### CI builds the APK for you

`.github/workflows/android.yml` builds the APK on every push that touches `web/`
(and via **Run workflow**). Download it from the run's **Artifacts →
`reelio-debug-apk`**. This is the most reliable way to get an installable APK
without a local Android toolchain.

> The committed APK is a **debug** build (debug-signed) for testing. For Play
> Store / production, generate a release keystore and run `assembleRelease`.

## Tech

Vite · React 18 · TypeScript · Tailwind CSS · Framer Motion · lucide-react ·
Capacitor (Android). No backend — all generation is client-side canvas + Web
APIs, which keeps the prototype self-contained.

## Project layout

```
web/
  src/
    App.tsx                 # landing ↔ studio switch
    components/
      Landing.tsx           # marketing/hero
      Studio.tsx            # upload → vibe → generating → results → export
      ReelPlayer.tsx        # canvas player (rAF render loop + beat pulse)
      ui.tsx                # Button, Chip, Card, Logo, StepDots
    lib/
      presets.ts            # themes, moods, tracks, captions, hashtags
      reel.ts               # the beat-synced canvas render engine + variants
      recorder.ts           # MediaRecorder export + download
  capacitor.config.ts       # Capacitor app config (com.reelio.app)
  android/                  # generated native Android project
```
