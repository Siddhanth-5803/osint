import { useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  UploadCloud,
  X,
  ArrowLeft,
  ArrowRight,
  Wand2,
  Download,
  Copy,
  Check,
  Image as ImageIcon,
  Music4,
  Loader2,
} from "lucide-react";
import { Button, Card, Chip, StepDots, Logo } from "./ui";
import ReelPlayer from "./ReelPlayer";
import {
  THEMES,
  MOODS,
  TRACKS,
  FORMATS,
  captionFor,
  hashtagsFor,
  effectiveBpm,
} from "../lib/presets";
import { buildVariants, loopDuration, type ReelConfig, type Variant } from "../lib/reel";
import { recordCanvas, downloadBlob, pickMimeType, extFor } from "../lib/recorder";

type Step = "upload" | "vibe" | "generating" | "results" | "export";
const STEPS: Step[] = ["upload", "vibe", "generating", "results", "export"];

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3 },
};

export default function Studio({ onHome }: { onHome: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [images, setImages] = useState<string[]>([]);
  const [themeId, setThemeId] = useState("cinematic");
  const [moodId, setMoodId] = useState("happy");
  const [trackId, setTrackId] = useState("t2");
  const [formatId, setFormatId] = useState("reel");
  const [prompt, setPrompt] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selected, setSelected] = useState(0);

  const theme = THEMES.find((t) => t.id === themeId)!;
  const mood = MOODS.find((m) => m.id === moodId)!;
  const track = TRACKS.find((t) => t.id === trackId)!;
  const format = FORMATS.find((f) => f.id === formatId)!;

  const baseConfig: ReelConfig = useMemo(
    () => ({
      bpm: effectiveBpm(track, mood.energy),
      beatsPerSlide: theme.beatsPerSlide,
      grade: theme.grade,
      transition: "crossfade",
      title: prompt.trim().split(/\s+/).slice(0, 3).join(" ") || theme.label,
      seed: themeId.length + mood.energy * 100,
    }),
    [track, mood, theme, prompt, themeId]
  );

  const onFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))
      .map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...urls].slice(0, 12));
  }, []);

  const generate = () => {
    setStep("generating");
    setVariants(buildVariants(baseConfig));
    window.setTimeout(() => {
      setSelected(0);
      setStep("results");
    }, 2600);
  };

  const idx = STEPS.indexOf(step);

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5">
      <header className="flex items-center justify-between py-5">
        <button onClick={onHome} className="transition-opacity hover:opacity-80">
          <Logo />
        </button>
        <div className="hidden sm:block">
          <StepDots total={STEPS.length} current={idx} />
        </div>
        <Button variant="ghost" onClick={onHome}>
          Exit
        </Button>
      </header>

      <main className="flex-1 pb-16">
        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div key="upload" {...fade}>
              <UploadView
                images={images}
                onFiles={onFiles}
                onRemove={(i) =>
                  setImages((p) => p.filter((_, j) => j !== i))
                }
                onNext={() => setStep("vibe")}
              />
            </motion.div>
          )}

          {step === "vibe" && (
            <motion.div key="vibe" {...fade}>
              <VibeView
                themeId={themeId}
                setThemeId={setThemeId}
                moodId={moodId}
                setMoodId={setMoodId}
                trackId={trackId}
                setTrackId={setTrackId}
                formatId={formatId}
                setFormatId={setFormatId}
                prompt={prompt}
                setPrompt={setPrompt}
                images={images}
                config={baseConfig}
                onBack={() => setStep("upload")}
                onGenerate={generate}
              />
            </motion.div>
          )}

          {step === "generating" && (
            <motion.div key="gen" {...fade}>
              <GeneratingView themeLabel={theme.label} bpm={baseConfig.bpm} />
            </motion.div>
          )}

          {step === "results" && (
            <motion.div key="results" {...fade}>
              <ResultsView
                variants={variants}
                selected={selected}
                setSelected={setSelected}
                images={images}
                format={format}
                onBack={() => setStep("vibe")}
                onExport={() => setStep("export")}
              />
            </motion.div>
          )}

          {step === "export" && (
            <motion.div key="export" {...fade}>
              <ExportView
                variant={variants[selected]}
                images={images}
                format={format}
                themeId={themeId}
                prompt={prompt}
                onBack={() => setStep("results")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ----------------------------- Upload ----------------------------- */
function UploadView({
  images,
  onFiles,
  onRemove,
  onNext,
}: {
  images: string[];
  onFiles: (f: FileList | null) => void;
  onRemove: (i: number) => void;
  onNext: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Add your media</h1>
      <p className="mt-2 text-muted">
        Drop in photos or clips — Reelio picks the best moments and orders them.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFiles(e.dataTransfer.files);
        }}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all ${
          drag
            ? "border-brand bg-brand-grad-soft"
            : "border-line bg-surface/60 hover:border-brand-soft/60"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-grad text-white shadow-glow">
          <UploadCloud size={26} />
        </div>
        <p className="mt-4 font-semibold">Drag & drop, or tap to browse</p>
        <p className="mt-1 text-sm text-muted">JPG, PNG or MP4 · up to 12 items</p>
      </label>

      {images.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((src, i) => (
            <motion.div
              key={src}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative aspect-square overflow-hidden rounded-xl border border-line"
            >
              <Thumb src={src} />
              <button
                onClick={() => onRemove(i)}
                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X size={15} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <span className="text-sm text-muted">
          {images.length
            ? `${images.length} item${images.length > 1 ? "s" : ""} added`
            : "Add at least one item — or continue to preview the demo"}
        </span>
        <Button onClick={onNext}>
          Continue <ArrowRight size={18} />
        </Button>
      </div>
    </div>
  );
}

function Thumb({ src }: { src: string }) {
  // object URLs from videos won't render in <img>; show a chip for those.
  return (
    <>
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0")}
      />
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-muted">
        <ImageIcon size={18} className="opacity-0" />
      </div>
    </>
  );
}

/* ------------------------------ Vibe ------------------------------ */
function VibeView({
  themeId,
  setThemeId,
  moodId,
  setMoodId,
  trackId,
  setTrackId,
  formatId,
  setFormatId,
  prompt,
  setPrompt,
  images,
  config,
  onBack,
  onGenerate,
}: {
  themeId: string;
  setThemeId: (s: string) => void;
  moodId: string;
  setMoodId: (s: string) => void;
  trackId: string;
  setTrackId: (s: string) => void;
  formatId: string;
  setFormatId: (s: string) => void;
  prompt: string;
  setPrompt: (s: string) => void;
  images: string[];
  config: ReelConfig;
  onBack: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Set the vibe</h1>
        <p className="mt-2 text-muted">
          Pick a theme and mood — the preview updates live on the right.
        </p>

        <Section title="Theme">
          <div className="flex flex-wrap gap-2.5">
            {THEMES.map((t) => (
              <Chip key={t.id} active={t.id === themeId} onClick={() => setThemeId(t.id)}>
                <span className="mr-1">{t.emoji}</span>
                {t.label}
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            {THEMES.find((t) => t.id === themeId)!.blurb}
          </p>
        </Section>

        <Section title="Mood">
          <div className="flex flex-wrap gap-2.5">
            {MOODS.map((m) => (
              <Chip key={m.id} active={m.id === moodId} onClick={() => setMoodId(m.id)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Prompt (optional)">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='e.g. "make it a nostalgic travel reel"'
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted focus:border-brand-soft"
          />
        </Section>

        <Section title="Music (metadata-only · beat timing)">
          <div className="space-y-2">
            {TRACKS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTrackId(t.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${
                  t.id === trackId
                    ? "border-brand-soft bg-brand-grad-soft"
                    : "border-line bg-surface hover:border-brand-soft/40"
                }`}
              >
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-surface2 text-brand-soft">
                  <Music4 size={17} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{t.title}</div>
                  <div className="text-xs text-muted">{t.artist}</div>
                </div>
                <div className="text-xs font-semibold text-muted">{t.bpm} BPM</div>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Format">
          <div className="flex flex-wrap gap-2.5">
            {FORMATS.map((f) => (
              <Chip key={f.id} active={f.id === formatId} onClick={() => setFormatId(f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </Section>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={18} /> Back
          </Button>
          <Button onClick={onGenerate} className="px-6">
            <Wand2 size={18} /> Generate reels
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-sm font-semibold text-muted">Live preview</p>
        <ReelPlayer images={images} config={config} width={320} height={569} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-7">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* --------------------------- Generating --------------------------- */
function GeneratingView({ themeLabel, bpm }: { themeLabel: string; bpm: number }) {
  const steps = [
    "Analyzing your media",
    `Finding the beat · ${bpm} BPM`,
    `Planning the ${themeLabel.toLowerCase()} edit`,
    "Rendering 3 versions",
  ];
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center text-center">
      <div className="w-full">
        <div className="mx-auto mb-8 grid h-20 w-20 place-items-center rounded-3xl bg-brand-grad shadow-glow">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          >
            <Wand2 className="text-white" size={32} />
          </motion.div>
        </div>
        <h2 className="text-2xl font-bold">Cooking your reels…</h2>
        <p className="mt-1 text-muted">This usually takes a few seconds.</p>

        <div className="mt-8 space-y-3 text-left">
          {steps.map((s, i) => (
            <motion.div
              key={s}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.55 }}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.55 + 0.45, type: "spring" }}
                className="grid h-6 w-6 place-items-center rounded-full bg-brand-grad"
              >
                <Check size={14} className="text-white" />
              </motion.span>
              <span className="text-sm">{s}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Results ---------------------------- */
function ResultsView({
  variants,
  selected,
  setSelected,
  images,
  format,
  onBack,
  onExport,
}: {
  variants: Variant[];
  selected: number;
  setSelected: (i: number) => void;
  images: string[];
  format: { w: number; h: number };
  onBack: () => void;
  onExport: () => void;
}) {
  const current = variants[selected];
  const ar = format.w / format.h;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pick your favorite</h1>
        <p className="mt-2 text-muted">
          Three AI cuts of the same media — tap to preview, then export.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-4">
          {variants.map((v, i) => (
            <button key={v.id} onClick={() => setSelected(i)} className="text-left">
              <motion.div
                whileHover={{ y: -4 }}
                className={`overflow-hidden rounded-2xl border-2 transition-colors ${
                  i === selected ? "border-brand shadow-glow" : "border-line"
                }`}
              >
                <ReelPlayer
                  images={images}
                  config={v.config}
                  width={Math.round(220 * ar)}
                  height={220}
                  autoplay={i === selected}
                />
              </motion.div>
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold">{v.name}</span>
                <span className="text-xs text-muted">{v.config.bpm} BPM</span>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={18} /> Tweak vibe
          </Button>
          <Button onClick={onExport} className="px-6">
            Export "{current.name}" <ArrowRight size={18} />
          </Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-3 text-sm font-semibold text-muted">Now playing · {current.name}</p>
        <ReelPlayer images={images} config={current.config} width={340} height={Math.round(340 / ar)} />
      </div>
    </div>
  );
}

/* ------------------------------ Export ---------------------------- */
function ExportView({
  variant,
  images,
  format,
  themeId,
  prompt,
  onBack,
}: {
  variant: Variant;
  images: string[];
  format: { w: number; h: number; label: string };
  themeId: string;
  prompt: string;
  onBack: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState<"cap" | "tags" | null>(null);

  const caption = useMemo(() => captionFor(themeId, prompt), [themeId, prompt]);
  const tags = useMemo(() => hashtagsFor(themeId), [themeId]);
  const ar = format.w / format.h;

  const doExport = async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    setDone(false);
    const seconds = Math.min(12, Math.max(4, loopDuration(variant.config, images.length || 4)));
    const blob = await recordCanvas(canvasRef.current, seconds, setProgress);
    downloadBlob(blob, `reelio-${variant.name.toLowerCase()}.${extFor(pickMimeType())}`);
    setExporting(false);
    setDone(true);
  };

  const copy = (text: string, which: "cap" | "tags") => {
    navigator.clipboard?.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <div>
        <p className="mb-3 text-sm font-semibold text-muted">{format.label}</p>
        <ReelPlayer
          images={images}
          config={variant.config}
          width={340}
          height={Math.round(340 / ar)}
          onCanvasReady={(c) => (canvasRef.current = c)}
        />
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export & post</h1>
        <p className="mt-2 text-muted">
          Download the video, then copy your caption and hashtags.
        </p>

        <Card className="mt-6 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Video file</div>
              <div className="text-sm text-muted">
                {format.label} · {pickMimeType().includes("mp4") ? "MP4" : "WebM"} · 1080p
              </div>
            </div>
            <Button onClick={doExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Rendering…
                </>
              ) : done ? (
                <>
                  <Check size={18} /> Saved
                </>
              ) : (
                <>
                  <Download size={18} /> Download
                </>
              )}
            </Button>
          </div>
          {exporting && (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full bg-brand-grad transition-[width] duration-100"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </Card>

        <CopyBlock
          label="Caption"
          value={caption}
          copied={copied === "cap"}
          onCopy={() => copy(caption, "cap")}
        />
        <CopyBlock
          label="Hashtags"
          value={tags.map((t) => `#${t}`).join(" ")}
          copied={copied === "tags"}
          onCopy={() => copy(tags.map((t) => `#${t}`).join(" "), "tags")}
        />

        <div className="mt-8">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft size={18} /> Back to versions
          </Button>
        </div>
      </div>
    </div>
  );
}

function CopyBlock({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Card className="mt-4 p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold uppercase tracking-wider text-muted">
          {label}
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-soft hover:text-ink"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-sm leading-relaxed text-ink/90">{value}</p>
    </Card>
  );
}
